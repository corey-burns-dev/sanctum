package service

import (
	"context"
	"encoding/json"
	"errors"

	"sanctum/internal/models"
	"sanctum/internal/repository"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ChatService struct {
	chatRepo            repository.ChatRepository
	userRepo            repository.UserRepository
	db                  *gorm.DB
	isAdmin             func(ctx context.Context, userID uint) (bool, error)
	canModerateChatroom func(ctx context.Context, userID, roomID uint) (bool, error)
}

type CreateConversationInput struct {
	UserID         uint
	Name           string
	IsGroup        bool
	ParticipantIDs []uint
}

type SendMessageInput struct {
	UserID         uint
	ConversationID uint
	Content        string
	MessageType    string
	Metadata       json.RawMessage
}

func NewChatService(
	chatRepo repository.ChatRepository,
	userRepo repository.UserRepository,
	db *gorm.DB,
	isAdmin func(ctx context.Context, userID uint) (bool, error),
	canModerateChatroom func(ctx context.Context, userID, roomID uint) (bool, error),
) *ChatService {
	return &ChatService{
		chatRepo:            chatRepo,
		userRepo:            userRepo,
		db:                  db,
		isAdmin:             isAdmin,
		canModerateChatroom: canModerateChatroom,
	}
}

type ChatroomWithJoined struct {
	Conversation *models.Conversation
	IsJoined     bool
}

func (s *ChatService) CreateConversation(ctx context.Context, in CreateConversationInput) (*models.Conversation, error) {
	if in.IsGroup && in.Name == "" {
		return nil, models.NewValidationError("Group conversations require a name")
	}
	if len(in.ParticipantIDs) == 0 {
		return nil, models.NewValidationError("At least one participant is required")
	}

	if !in.IsGroup && len(in.ParticipantIDs) == 1 && in.ParticipantIDs[0] != in.UserID && s.db != nil {
		otherUserID := in.ParticipantIDs[0]
		var existing models.Conversation
		findErr := s.db.WithContext(ctx).
			Model(&models.Conversation{}).
			Joins(
				"JOIN conversation_participants cp_self ON cp_self.conversation_id = conversations.id AND cp_self.user_id = ?",
				in.UserID,
			).
			Joins(
				"JOIN conversation_participants cp_other ON cp_other.conversation_id = conversations.id AND cp_other.user_id = ?",
				otherUserID,
			).
			Where("conversations.is_group = ?", false).
			Where(
				"NOT EXISTS (SELECT 1 FROM conversation_participants cp_extra WHERE cp_extra.conversation_id = conversations.id AND cp_extra.user_id NOT IN (?, ?))",
				in.UserID,
				otherUserID,
			).
			Order("conversations.updated_at DESC").
			First(&existing).Error
		switch {
		case findErr == nil:
			return s.chatRepo.GetConversation(ctx, existing.ID)
		case errors.Is(findErr, gorm.ErrRecordNotFound):
			// Create a new DM below.
		default:
			return nil, findErr
		}
	}

	conv := &models.Conversation{
		Name:      in.Name,
		IsGroup:   in.IsGroup,
		CreatedBy: in.UserID,
	}
	if err := s.chatRepo.CreateConversation(ctx, conv); err != nil {
		return nil, err
	}

	if err := s.chatRepo.AddParticipant(ctx, conv.ID, in.UserID); err != nil {
		return nil, err
	}

	for _, participantID := range in.ParticipantIDs {
		if participantID == in.UserID {
			continue
		}
		if err := s.chatRepo.AddParticipant(ctx, conv.ID, participantID); err != nil {
			return nil, err
		}
	}

	return s.chatRepo.GetConversation(ctx, conv.ID)
}

func (s *ChatService) GetConversations(ctx context.Context, userID uint) ([]*models.Conversation, error) {
	return s.chatRepo.GetUserConversations(ctx, userID)
}

func (s *ChatService) GetConversationForUser(ctx context.Context, convID, userID uint) (*models.Conversation, error) {
	conv, err := s.chatRepo.GetConversation(ctx, convID)
	if err != nil {
		return nil, err
	}
	if !isConversationParticipant(conv, userID) {
		return nil, models.NewUnauthorizedError("You are not a participant in this conversation")
	}
	return conv, nil
}

func (s *ChatService) SendMessage(ctx context.Context, in SendMessageInput) (*models.Message, *models.Conversation, error) {
	if in.Content == "" {
		return nil, nil, models.NewValidationError("Message content is required")
	}
	if in.MessageType == "" {
		in.MessageType = "text"
	}
	if in.Metadata == nil {
		in.Metadata = json.RawMessage("{}")
	}

	conv, err := s.chatRepo.GetConversation(ctx, in.ConversationID)
	if err != nil {
		return nil, nil, err
	}
	if !isConversationParticipant(conv, in.UserID) {
		return nil, nil, models.NewUnauthorizedError("You are not a participant in this conversation")
	}

	message := &models.Message{
		ConversationID: in.ConversationID,
		SenderID:       in.UserID,
		Content:        in.Content,
		MessageType:    in.MessageType,
		Metadata:       in.Metadata,
	}
	if err := s.chatRepo.CreateMessage(ctx, message); err != nil {
		return nil, nil, err
	}

	if sender, err := s.userRepo.GetByID(ctx, in.UserID); err == nil {
		message.Sender = sender
	}

	return message, conv, nil
}

func (s *ChatService) GetMessagesForUser(ctx context.Context, convID, userID uint, limit, offset int) ([]*models.Message, error) {
	conv, err := s.chatRepo.GetConversation(ctx, convID)
	if err != nil {
		return nil, err
	}
	if !isConversationParticipant(conv, userID) {
		return nil, models.NewUnauthorizedError("You are not a participant in this conversation")
	}
	return s.chatRepo.GetMessages(ctx, convID, limit, offset)
}

func (s *ChatService) AddParticipant(ctx context.Context, convID, actorUserID, participantUserID uint) error {
	conv, err := s.chatRepo.GetConversation(ctx, convID)
	if err != nil {
		return err
	}
	if !isConversationParticipant(conv, actorUserID) {
		return models.NewUnauthorizedError("You are not a participant in this conversation")
	}
	if !conv.IsGroup {
		return models.NewValidationError("Cannot add participants to 1-on-1 conversations")
	}
	return s.chatRepo.AddParticipant(ctx, convID, participantUserID)
}

func (s *ChatService) LeaveConversation(ctx context.Context, convID, userID uint) (*models.Conversation, error) {
	conv, err := s.chatRepo.GetConversation(ctx, convID)
	if err != nil {
		return nil, err
	}
	if !isConversationParticipant(conv, userID) {
		return nil, models.NewUnauthorizedError("You are not a participant in this conversation")
	}
	if err := s.chatRepo.RemoveParticipant(ctx, convID, userID); err != nil {
		return nil, err
	}
	return conv, nil
}

func (s *ChatService) GetAllChatrooms(ctx context.Context, userID uint) ([]ChatroomWithJoined, error) {
	var chatrooms []*models.Conversation
	err := s.db.WithContext(ctx).
		Where("is_group = ?", true).
		Preload("Participants").
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC").Limit(1)
		}).
		Preload("Messages.Sender").
		Order("name ASC").
		Find(&chatrooms).Error
	if err != nil {
		return nil, err
	}

	result := make([]ChatroomWithJoined, 0, len(chatrooms))
	for _, room := range chatrooms {
		isJoined := false
		for _, p := range room.Participants {
			if p.ID == userID {
				isJoined = true
				break
			}
		}
		result = append(result, ChatroomWithJoined{
			Conversation: room,
			IsJoined:     isJoined,
		})
	}

	return result, nil
}

func (s *ChatService) GetJoinedChatrooms(ctx context.Context, userID uint) ([]*models.Conversation, error) {
	var chatrooms []*models.Conversation
	err := s.db.WithContext(ctx).
		Joins("JOIN conversation_participants cp ON cp.conversation_id = conversations.id").
		Where("conversations.is_group = ? AND cp.user_id = ?", true, userID).
		Preload("Participants").
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC").Limit(1)
		}).
		Preload("Messages.Sender").
		Order("conversations.name ASC").
		Find(&chatrooms).Error
	if err != nil {
		return nil, err
	}
	return chatrooms, nil
}

func (s *ChatService) JoinChatroom(ctx context.Context, roomID, userID uint) (*models.Conversation, error) {
	var conv models.Conversation
	if err := s.db.WithContext(ctx).First(&conv, roomID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, models.NewNotFoundError("Chatroom", roomID)
		}
		return nil, err
	}
	if !conv.IsGroup {
		return nil, models.NewValidationError("Cannot join a 1-on-1 conversation")
	}

	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&models.ConversationParticipant{
		ConversationID: roomID,
		UserID:         userID,
	}).Error
	if err != nil {
		return nil, err
	}

	return &conv, nil
}

func (s *ChatService) RemoveParticipant(ctx context.Context, roomID, actorUserID, participantUserID uint) (string, error) {
	var conv models.Conversation
	if err := s.db.WithContext(ctx).First(&conv, roomID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", models.NewNotFoundError("Chatroom", roomID)
		}
		return "", err
	}

	authorized := false
	if s.canModerateChatroom != nil {
		var err error
		authorized, err = s.canModerateChatroom(ctx, actorUserID, roomID)
		if err != nil {
			return "", err
		}
	} else {
		admin := false
		if s.isAdmin != nil {
			var err error
			admin, err = s.isAdmin(ctx, actorUserID)
			if err != nil {
				return "", err
			}
		}
		authorized = admin || conv.CreatedBy == actorUserID
	}

	if !authorized {
		return "", models.NewUnauthorizedError("You do not have permission to moderate this chatroom")
	}

	if err := s.db.WithContext(ctx).
		Where("conversation_id = ? AND user_id = ?", roomID, participantUserID).
		Delete(&models.ConversationParticipant{}).Error; err != nil {
		return "", err
	}

	username := ""
	if user, err := s.userRepo.GetByID(ctx, actorUserID); err == nil && user != nil {
		username = user.Username
	}

	return username, nil
}

func isConversationParticipant(conv *models.Conversation, userID uint) bool {
	for _, participant := range conv.Participants {
		if participant.ID == userID {
			return true
		}
	}
	return false
}
