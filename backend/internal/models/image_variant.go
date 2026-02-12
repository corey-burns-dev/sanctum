package models

import "time"

// ImageVariant stores one generated variant per size/format.
type ImageVariant struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ImageID   uint      `gorm:"not null;index;uniqueIndex:uq_variant" json:"image_id"`
	SizeName  string    `gorm:"type:varchar(20);not null" json:"size_name"`
	SizePx    int       `gorm:"not null;uniqueIndex:uq_variant" json:"size_px"`
	Format    string    `gorm:"type:varchar(10);not null;uniqueIndex:uq_variant" json:"format"`
	Path      string    `gorm:"type:varchar(512);not null" json:"-"`
	Width     int       `gorm:"not null" json:"width"`
	Height    int       `gorm:"not null" json:"height"`
	Bytes     int64     `gorm:"not null" json:"bytes"`
	CreatedAt time.Time `json:"created_at"`
}
