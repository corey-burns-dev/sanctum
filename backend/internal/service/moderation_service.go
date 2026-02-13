package service

import (
	"context"
	"log"
	"time"

	"sanctum/internal/models"

	"gorm.io/gorm"
)

type BanRequestRow struct {
	ReportedUserID uint        `json:"reported_user_id"`
	ReportCount    int64       `json:"report_count"`
	LatestReportAt time.Time   `json:"latest_report_at"`
	User           models.User `json:"user"`
}

type AdminUserDetail struct {
	User           models.User               `json:"user"`
	Reports        []models.ModerationReport `json:"reports"`
	ActiveMutes    []models.ChatroomMute     `json:"active_mutes"`
	BlocksGiven    []models.UserBlock        `json:"blocks_given"`
	BlocksReceived []models.UserBlock        `json:"blocks_received"`
	Warnings       []string                  `json:"warnings,omitempty"`
}

type ModerationService struct {
	db *gorm.DB
}

func NewModerationService(db *gorm.DB) *ModerationService {
	return &ModerationService{db: db}
}

func (s *ModerationService) GetAdminBanRequests(ctx context.Context, limit, offset int) ([]BanRequestRow, error) {
	type RawRow struct {
		ReportedUserID uint      `json:"reported_user_id"`
		ReportCount    int64     `json:"report_count"`
		LatestReportAt time.Time `json:"latest_report_at"`
	}

	var rows []RawRow
	if err := s.db.WithContext(ctx).
		Table("moderation_reports").
		Select("reported_user_id, COUNT(*) as report_count, MAX(created_at) as latest_report_at").
		Where("status = ? AND target_type = ? AND reported_user_id IS NOT NULL", models.ReportStatusOpen, models.ReportTargetUser).
		Group("reported_user_id").
		Order("report_count DESC, latest_report_at DESC").
		Limit(limit).
		Offset(offset).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	userIDs := make([]uint, 0, len(rows))
	for _, row := range rows {
		userIDs = append(userIDs, row.ReportedUserID)
	}

	usersByID := map[uint]models.User{}
	if len(userIDs) > 0 {
		var users []models.User
		if err := s.db.WithContext(ctx).Where("id IN ?", userIDs).Find(&users).Error; err != nil {
			return nil, err
		}
		for _, user := range users {
			usersByID[user.ID] = user
		}
	}

	resp := make([]BanRequestRow, 0, len(rows))
	for _, row := range rows {
		resp = append(resp, BanRequestRow{
			ReportedUserID: row.ReportedUserID,
			ReportCount:    row.ReportCount,
			LatestReportAt: row.LatestReportAt,
			User:           usersByID[row.ReportedUserID],
		})
	}
	return resp, nil
}

func (s *ModerationService) GetAdminUserDetail(ctx context.Context, userID uint) (*AdminUserDetail, error) {
	var user models.User
	if err := s.db.WithContext(ctx).First(&user, userID).Error; err != nil {
		return nil, err
	}

	detail := &AdminUserDetail{
		User: user,
	}

	// 1. Reports
	if err := s.db.WithContext(ctx).
		Where("reported_user_id = ?", userID).
		Order("created_at DESC").
		Limit(200).
		Find(&detail.Reports).Error; err != nil {
		log.Printf("[ModerationService] Warning: Failed to load reports for user %d: %v", userID, err)
		detail.Warnings = append(detail.Warnings, "Partial data: Moderation reports could not be loaded.")
	}

	// 2. Active Mutes
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&detail.ActiveMutes).Error; err != nil {
		log.Printf("[ModerationService] Warning: Failed to load active mutes for user %d: %v", userID, err)
		detail.Warnings = append(detail.Warnings, "Partial data: Active mutes could not be loaded.")
	}

	// 3. Blocks Given
	if err := s.db.WithContext(ctx).
		Where("blocker_id = ?", userID).
		Order("created_at DESC").
		Limit(200).
		Find(&detail.BlocksGiven).Error; err != nil {
		log.Printf("[ModerationService] Warning: Failed to load blocks given for user %d: %v", userID, err)
		detail.Warnings = append(detail.Warnings, "Partial data: Outgoing blocks could not be loaded.")
	}

	// 4. Blocks Received
	if err := s.db.WithContext(ctx).
		Where("blocked_id = ?", userID).
		Order("created_at DESC").
		Limit(200).
		Find(&detail.BlocksReceived).Error; err != nil {
		log.Printf("[ModerationService] Warning: Failed to load blocks received for user %d: %v", userID, err)
		detail.Warnings = append(detail.Warnings, "Partial data: Incoming blocks could not be loaded.")
	}

	return detail, nil
}
