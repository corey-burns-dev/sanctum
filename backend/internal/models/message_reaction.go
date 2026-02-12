package models

import "time"

// MessageReaction stores a user's emoji reaction on a message.
type MessageReaction struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	MessageID uint      `gorm:"not null;index" json:"message_id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Emoji     string    `gorm:"type:varchar(32);not null" json:"emoji"`
	CreatedAt time.Time `json:"created_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (MessageReaction) TableName() string {
	return "message_reactions"
}
