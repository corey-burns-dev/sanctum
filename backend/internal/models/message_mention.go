package models

import "time"

// MessageMention tracks a user mention in a chat message.
type MessageMention struct {
	ID                uint       `gorm:"primaryKey" json:"id"`
	MessageID         uint       `gorm:"not null;index" json:"message_id"`
	ConversationID    uint       `gorm:"not null;index" json:"conversation_id"`
	MentionedUserID   uint       `gorm:"not null;index" json:"mentioned_user_id"`
	MentionedByUserID uint       `gorm:"not null;index" json:"mentioned_by_user_id"`
	CreatedAt         time.Time  `json:"created_at"`
	ReadAt            *time.Time `json:"read_at,omitempty"`

	Message         *Message      `gorm:"foreignKey:MessageID" json:"message,omitempty"`
	MentionedUser   *User         `gorm:"foreignKey:MentionedUserID" json:"mentioned_user,omitempty"`
	MentionedByUser *User         `gorm:"foreignKey:MentionedByUserID" json:"mentioned_by_user,omitempty"`
	Conversation    *Conversation `gorm:"foreignKey:ConversationID" json:"conversation,omitempty"`
}

func (MessageMention) TableName() string {
	return "message_mentions"
}
