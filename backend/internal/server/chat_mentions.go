package server

import (
	"context"
	"regexp"
	"strings"
	"time"

	"sanctum/internal/models"
	"sanctum/internal/notifications"

	"gorm.io/gorm/clause"
)

var mentionPattern = regexp.MustCompile(`@([a-zA-Z0-9_]{2,32})`)

func extractMentionUsernames(content string) []string {
	matches := mentionPattern.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return nil
	}
	seen := map[string]bool{}
	result := make([]string, 0, len(matches))
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		username := strings.TrimSpace(strings.ToLower(match[1]))
		if username == "" || seen[username] {
			continue
		}
		seen[username] = true
		result = append(result, username)
	}
	return result
}

func (s *Server) persistMessageMentions(
	ctx context.Context,
	conversationID uint,
	message *models.Message,
	senderID uint,
	participants []models.User,
) {
	if message == nil {
		return
	}
	mentions := extractMentionUsernames(message.Content)
	if len(mentions) == 0 {
		return
	}

	participantsByUsername := make(map[string]uint, len(participants))
	for _, participant := range participants {
		participantsByUsername[strings.ToLower(participant.Username)] = participant.ID
	}

	for _, mention := range mentions {
		mentionedUserID, ok := participantsByUsername[mention]
		if !ok || mentionedUserID == senderID {
			continue
		}
		record := models.MessageMention{
			MessageID:         message.ID,
			ConversationID:    conversationID,
			MentionedUserID:   mentionedUserID,
			MentionedByUserID: senderID,
		}
		if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&record).Error; err != nil {
			continue
		}

		s.publishUserEvent(mentionedUserID, EventChatMention, map[string]interface{}{
			"conversation_id":   conversationID,
			"message_id":        message.ID,
			"mentioned_user_id": mentionedUserID,
			"from_user_id":      senderID,
			"preview":           message.Content,
			"created_at":        time.Now().UTC().Format(time.RFC3339Nano),
		})

		if s.chatHub != nil {
			s.chatHub.BroadcastToConversation(conversationID, modelsToMentionMessage(conversationID, senderID, mentionedUserID, message.ID))
		}
	}
}

func modelsToMentionMessage(conversationID, senderID, mentionedUserID, messageID uint) notifications.ChatMessage {
	return notifications.ChatMessage{
		Type:           "chat_mention",
		ConversationID: conversationID,
		UserID:         senderID,
		Payload: map[string]interface{}{
			"conversation_id":   conversationID,
			"message_id":        messageID,
			"mentioned_user_id": mentionedUserID,
			"from_user_id":      senderID,
		},
	}
}
