package models

import "time"

// UserBlock represents a one-way block relationship between users.
type UserBlock struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	BlockerID uint      `gorm:"not null;index" json:"blocker_id"`
	BlockedID uint      `gorm:"not null;index" json:"blocked_id"`
	CreatedAt time.Time `json:"created_at"`

	Blocker *User `gorm:"foreignKey:BlockerID" json:"blocker,omitempty"`
	Blocked *User `gorm:"foreignKey:BlockedID" json:"blocked,omitempty"`
}

func (UserBlock) TableName() string {
	return "user_blocks"
}
