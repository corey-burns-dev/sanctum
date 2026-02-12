// Package models contains data structures for the application's domain models.
package models

import "time"

// Poll represents a poll attached to a post.
type Poll struct {
	ID                 uint         `gorm:"primaryKey" json:"id"`
	PostID             uint         `gorm:"uniqueIndex;not null" json:"post_id"`
	Post               *Post        `gorm:"foreignKey:PostID" json:"-"`
	Question           string       `gorm:"type:text;not null" json:"question"`
	Options            []PollOption `gorm:"foreignKey:PollID" json:"options,omitempty"`
	UserVoteOptionID   *uint        `gorm:"-" json:"user_vote_option_id,omitempty"` // filled when loading for current user
	CreatedAt          time.Time    `json:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at"`
}

// PollOption represents a single choice in a poll.
type PollOption struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	PollID      uint   `gorm:"not null;index" json:"poll_id"`
	OptionText  string `gorm:"type:varchar(500);not null" json:"option_text"`
	DisplayOrder int   `gorm:"not null;default:0" json:"display_order"`
	// VotesCount is computed when loading for display
	VotesCount int `gorm:"->" json:"votes_count,omitempty"`
}

// PollVote records a user's vote for one option in a poll.
type PollVote struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	UserID       uint       `gorm:"uniqueIndex:uq_poll_votes_user_poll;not null" json:"user_id"`
	PollID       uint       `gorm:"uniqueIndex:uq_poll_votes_user_poll;not null" json:"poll_id"`
	PollOptionID uint       `gorm:"not null" json:"poll_option_id"`
	CreatedAt    time.Time  `json:"created_at"`
}

// TableName overrides the table name for PollVote to match migration.
func (PollVote) TableName() string {
	return "poll_votes"
}
