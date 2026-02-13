package database

import (
	"testing"

	"sanctum/internal/config"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestConfigurePool(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	cfg := &config.Config{
		DBMaxOpenConns:           10,
		DBMaxIdleConns:           5,
		DBConnMaxLifetimeMinutes: 15,
	}

	err = configurePool(db, cfg)
	assert.NoError(t, err)

	_, err = db.DB()
	assert.NoError(t, err)
}
