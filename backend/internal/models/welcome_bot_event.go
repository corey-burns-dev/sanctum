package models

import "time"

// Welcome bot event types
const (
	WelcomeEventSignupDM = "signup_dm"
	WelcomeEventRoomJoin = "room_join"
)

// WelcomeBotEvent tracks one-time welcome bot sends per user and scope.
type WelcomeBotEvent struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	UserID         uint      `gorm:"not null;index" json:"user_id"`
	ConversationID *uint     `gorm:"index" json:"conversation_id,omitempty"`
	EventType      string    `gorm:"type:varchar(40);not null;index" json:"event_type"`
	CreatedAt      time.Time `json:"created_at"`

	User         *User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Conversation *Conversation `gorm:"foreignKey:ConversationID" json:"conversation,omitempty"`
}

// TableName returns the database table name for WelcomeBotEvent.
func (WelcomeBotEvent) TableName() string {
	return "welcome_bot_events"
}
