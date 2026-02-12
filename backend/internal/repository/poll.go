// Package repository provides data access layer implementations for the application.
package repository

import (
	"context"

	"sanctum/internal/models"

	"gorm.io/gorm"
)

// PollRepository defines the interface for poll data operations.
type PollRepository interface {
	Create(ctx context.Context, postID uint, question string, options []string) (*models.Poll, error)
	Vote(ctx context.Context, userID, pollID, pollOptionID uint) error
	EnrichWithResults(ctx context.Context, poll *models.Poll, currentUserID uint) error
}

type pollRepository struct {
	db *gorm.DB
}

// NewPollRepository creates a new poll repository.
func NewPollRepository(db *gorm.DB) PollRepository {
	return &pollRepository{db: db}
}

func (r *pollRepository) Create(ctx context.Context, postID uint, question string, options []string) (*models.Poll, error) {
	poll := &models.Poll{
		PostID:   postID,
		Question: question,
	}
	if err := r.db.WithContext(ctx).Create(poll).Error; err != nil {
		return nil, err
	}
	for i, text := range options {
		opt := models.PollOption{
			PollID:       poll.ID,
			OptionText:   text,
			DisplayOrder: i,
		}
		if err := r.db.WithContext(ctx).Create(&opt).Error; err != nil {
			return nil, err
		}
		poll.Options = append(poll.Options, opt)
	}
	return poll, nil
}

func (r *pollRepository) Vote(ctx context.Context, userID, pollID, pollOptionID uint) error {
	// Upsert: one vote per user per poll. Use raw SQL for ON CONFLICT.
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO poll_votes (user_id, poll_id, poll_option_id, created_at)
		 VALUES (?, ?, ?, NOW())
		 ON CONFLICT (user_id, poll_id) DO UPDATE SET poll_option_id = ?`,
		userID, pollID, pollOptionID, pollOptionID,
	).Error
}

func (r *pollRepository) EnrichWithResults(ctx context.Context, poll *models.Poll, currentUserID uint) error {
	if poll == nil || len(poll.Options) == 0 {
		return nil
	}
	for i := range poll.Options {
		var count int64
		if err := r.db.WithContext(ctx).Model(&models.PollVote{}).
			Where("poll_option_id = ?", poll.Options[i].ID).
			Count(&count).Error; err != nil {
			return err
		}
		poll.Options[i].VotesCount = int(count)
	}
	if currentUserID != 0 {
		var vote models.PollVote
		if err := r.db.WithContext(ctx).Where("poll_id = ? AND user_id = ?", poll.ID, currentUserID).First(&vote).Error; err == nil {
			poll.UserVoteOptionID = &vote.PollOptionID
		}
	}
	return nil
}
