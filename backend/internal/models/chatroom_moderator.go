package models

import "time"

// ChatroomModerator maps moderator users to chatrooms.
type ChatroomModerator struct {
	ConversationID  uint      `gorm:"primaryKey;autoIncrement:false" json:"conversation_id"`
	UserID          uint      `gorm:"primaryKey;autoIncrement:false" json:"user_id"`
	GrantedByUserID uint      `gorm:"not null" json:"granted_by_user_id"`
	CreatedAt       time.Time `json:"created_at"`
}

// TableName specifies the table name for GORM.
func (ChatroomModerator) TableName() string {
	return "chatroom_moderators"
}
