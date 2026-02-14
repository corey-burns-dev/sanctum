package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"sanctum/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupChatSafetyTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.Conversation{},
		&models.Message{},
		&models.MessageMention{},
		&models.MessageReaction{},
	); err != nil {
		t.Fatalf("migrate sqlite: %v", err)
	}

	return db
}

func TestGetMyMentions(t *testing.T) {
	t.Parallel()
	db := setupChatSafetyTestDB(t)
	s := &Server{db: db}
	app := fiber.New()

	user := models.User{Username: "user", Email: "u@e.com"}
	db.Create(&user)

	app.Get("/users/me/mentions", func(c *fiber.Ctx) error {
		c.Locals("userID", user.ID)
		return s.GetMyMentions(c)
	})

	t.Run("empty", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/users/me/mentions", nil)
		resp, _ := app.Test(req)
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", resp.StatusCode)
		}
	})

	t.Run("with mentions", func(t *testing.T) {
		sender := models.User{Username: "sender", Email: "s@e.com"}
		db.Create(&sender)
		conv := models.Conversation{}
		db.Create(&conv)
		msg := models.Message{ConversationID: conv.ID, SenderID: sender.ID, Content: "hello @user"}
		db.Create(&msg)
		db.Create(&models.MessageMention{MessageID: msg.ID, MentionedUserID: user.ID, ConversationID: conv.ID})

		req := httptest.NewRequest(http.MethodGet, "/users/me/mentions", nil)
		resp, _ := app.Test(req)
		defer func() { _ = resp.Body.Close() }()
		var mentions []models.MessageMention
		if err := json.NewDecoder(resp.Body).Decode(&mentions); err != nil {
			t.Fatalf("decode mentions: %v", err)
		}
		if len(mentions) != 1 {
			t.Errorf("expected 1 mention, got %d", len(mentions))
		}
	})
}

func TestGetMessageReactionSummary(t *testing.T) {
	t.Parallel()
	db := setupChatSafetyTestDB(t)
	s := &Server{db: db}

	user1 := models.User{Username: "u1", Email: "u1@e.com"}
	db.Create(&user1)
	user2 := models.User{Username: "u2", Email: "u2@e.com"}
	db.Create(&user2)
	msg := models.Message{Content: "msg"}
	db.Create(&msg)

	db.Create(&models.MessageReaction{MessageID: msg.ID, UserID: user1.ID, Emoji: "👍"})
	db.Create(&models.MessageReaction{MessageID: msg.ID, UserID: user2.ID, Emoji: "👍"})
	db.Create(&models.MessageReaction{MessageID: msg.ID, UserID: user1.ID, Emoji: "❤️"})

	summary, err := s.getMessageReactionSummary(context.Background(), msg.ID, user1.ID)
	if err != nil {
		t.Fatalf("summary error: %v", err)
	}

	if len(summary) != 2 {
		t.Fatalf("expected 2 emojis, got %d", len(summary))
	}

	// summary should be sorted by count desc
	if summary[0].Emoji != "👍" || summary[0].Count != 2 {
		t.Errorf("expected 👍 with count 2 first")
	}
	if !summary[0].ReactedByMe {
		t.Errorf("expected reacted_by_me true for 👍")
	}

	if summary[1].Emoji != "❤️" || summary[1].Count != 1 {
		t.Errorf("expected ❤️ with count 1 second")
	}
}
