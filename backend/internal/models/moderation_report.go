package models

import "time"

const (
	ReportTargetPost    = "post"
	ReportTargetMessage = "message"
	ReportTargetUser    = "user"
)

const (
	ReportStatusOpen      = "open"
	ReportStatusResolved  = "resolved"
	ReportStatusDismissed = "dismissed"
)

// ModerationReport stores a user-submitted moderation report against content or users.
type ModerationReport struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	ReporterID       uint       `gorm:"not null;index" json:"reporter_id"`
	TargetType       string     `gorm:"type:varchar(20);not null;index" json:"target_type"`
	TargetID         uint       `gorm:"not null;index" json:"target_id"`
	ReportedUserID   *uint      `gorm:"index" json:"reported_user_id,omitempty"`
	Reason           string     `gorm:"type:varchar(120);not null" json:"reason"`
	Details          string     `gorm:"type:text;not null;default:''" json:"details"`
	Status           string     `gorm:"type:varchar(20);not null;default:'open';index" json:"status"`
	ResolvedByUserID *uint      `gorm:"index" json:"resolved_by_user_id,omitempty"`
	ResolvedAt       *time.Time `json:"resolved_at,omitempty"`
	ResolutionNote   string     `gorm:"type:text;not null;default:''" json:"resolution_note"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	Reporter       *User `gorm:"foreignKey:ReporterID" json:"reporter,omitempty"`
	ReportedUser   *User `gorm:"foreignKey:ReportedUserID" json:"reported_user,omitempty"`
	ResolvedByUser *User `gorm:"foreignKey:ResolvedByUserID" json:"resolved_by_user,omitempty"`
}

func (ModerationReport) TableName() string {
	return "moderation_reports"
}
