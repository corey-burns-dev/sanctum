package models

import "time"

// ChatroomMute stores room-scoped mutes for moderation.
type ChatroomMute struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	ConversationID uint       `gorm:"not null;index" json:"conversation_id"`
	UserID         uint       `gorm:"not null;index" json:"user_id"`
	MutedByUserID  uint       `gorm:"not null;index" json:"muted_by_user_id"`
	Reason         string     `gorm:"type:varchar(255);not null;default:''" json:"reason"`
	MutedUntil     *time.Time `json:"muted_until,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`

	User         *User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	MutedByUser  *User         `gorm:"foreignKey:MutedByUserID" json:"muted_by_user,omitempty"`
	Conversation *Conversation `gorm:"foreignKey:ConversationID" json:"conversation,omitempty"`
}

// TableName returns the database table name for ChatroomMute.
func (ChatroomMute) TableName() string {
	return "chatroom_mutes"
}
