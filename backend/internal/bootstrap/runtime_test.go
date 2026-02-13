package bootstrap

import (
	"testing"

	"sanctum/internal/config"
	"sanctum/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupBootstrapTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestEnsureDevRootAdminCreatesUserIDOne(t *testing.T) {
	t.Parallel()
	db := setupBootstrapTestDB(t)
	cfg := &config.Config{
		Env:                     "development",
		DevBootstrapRoot:        true,
		DevRootUsername:         "sanctum_root",
		DevRootEmail:            "root@sanctum.local",
		DevRootPassword:         "DevRoot123!",
		DevRootForceCredentials: true,
	}

	if err := ensureDevRootAdmin(cfg, db); err != nil {
		t.Fatalf("ensure root: %v", err)
	}

	var root models.User
	if err := db.First(&root, 1).Error; err != nil {
		t.Fatalf("load root user: %v", err)
	}
	if root.ID != 1 {
		t.Fatalf("expected root user id 1, got %d", root.ID)
	}
	if !root.IsAdmin {
		t.Fatal("expected root user to be admin")
	}
	if root.Username != "sanctum_root" {
		t.Fatalf("expected username sanctum_root, got %q", root.Username)
	}
}

func TestEnsureDevRootAdminNoopOutsideDevelopment(t *testing.T) {
	t.Parallel()
	db := setupBootstrapTestDB(t)
	cfg := &config.Config{
		Env:                     "production",
		DevBootstrapRoot:        true,
		DevRootUsername:         "sanctum_root",
		DevRootEmail:            "root@sanctum.local",
		DevRootPassword:         "DevRoot123!",
		DevRootForceCredentials: true,
	}

	if err := ensureDevRootAdmin(cfg, db); err != nil {
		t.Fatalf("ensure root: %v", err)
	}

	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		t.Fatalf("count users: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no users in non-development env, got %d", count)
	}
}
