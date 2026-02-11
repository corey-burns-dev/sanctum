package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
)

// IssueWSTicket issues a short-lived ticket for WebSocket authentication.
// @Summary Issue WebSocket ticket
// @Description Generates a short-lived (60s), single-use ticket for WebSocket authentication to avoid sending JWTs in query parameters.
// @Tags websocket
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{} "ticket: string, expires_in: int"
// @Failure 401 {object} map[string]string "error: unauthorized"
// @Failure 503 {object} map[string]string "error: Redis not available"
// @Router /ws/ticket [post]
func (s *Server) IssueWSTicket(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	// Generate a random ticket
	ticket, err := generateRandomString(32)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate ticket",
		})
	}

	// Store ticket in Redis with short TTL (60 seconds)
	// Key format: ws_ticket:TICKET_STRING
	if s.redis == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Redis not available for ticket storage",
		})
	}

	ctx := context.Background()
	key := fmt.Sprintf("ws_ticket:%s", ticket)
	err = s.redis.Set(ctx, key, userID, 60*time.Second).Err()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to store ticket",
		})
	}

	return c.JSON(fiber.Map{
		"ticket":     ticket,
		"expires_in": 60,
	})
}

// generateRandomString generates a secure random string of given length
func generateRandomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
