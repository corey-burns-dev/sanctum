package models

import "time"

// Image stores filesystem-backed upload metadata.
type Image struct {
	ID                  uint           `gorm:"primaryKey" json:"id"`
	Hash                string         `gorm:"size:64;not null;uniqueIndex" json:"hash"`
	UserID              uint           `gorm:"not null;index" json:"user_id"`
	User                *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	OriginalFilename    string         `gorm:"size:255;not null" json:"original_filename"`
	MimeType            string         `gorm:"size:50;not null" json:"mime_type"`
	SizeBytes           int64          `gorm:"not null" json:"size_bytes"`
	Width               int            `gorm:"not null" json:"width"`
	Height              int            `gorm:"not null" json:"height"`
	OriginalPath        string         `gorm:"size:512;not null" json:"original_path"`
	ThumbnailPath       string         `gorm:"size:512;not null" json:"thumbnail_path"`
	MediumPath          string         `gorm:"size:512;not null" json:"medium_path"`
	Status              string         `gorm:"size:20;not null;default:ready;index" json:"status"`
	Blurhash            string         `gorm:"size:83" json:"blurhash,omitempty"`
	Error               string         `gorm:"type:text" json:"-"`
	CropMode            string         `gorm:"size:20;not null;default:free" json:"crop_mode"`
	CropX               int            `gorm:"not null;default:0" json:"crop_x"`
	CropY               int            `gorm:"not null;default:0" json:"crop_y"`
	CropW               int            `gorm:"not null;default:0" json:"crop_w"`
	CropH               int            `gorm:"not null;default:0" json:"crop_h"`
	ProcessingStartedAt *time.Time     `json:"-"`
	ProcessingAttempts  int            `gorm:"not null;default:0" json:"-"`
	Variants            []ImageVariant `gorm:"foreignKey:ImageID" json:"variants,omitempty"`
	UploadedAt          time.Time      `gorm:"not null;default:now()" json:"uploaded_at"`
	LastAccessedAt      *time.Time     `json:"last_accessed_at,omitempty"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
}
