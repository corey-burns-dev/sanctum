package server

import (
	"encoding/json"
	"log"
	"strconv"
	"vibeshift/models"
	"vibeshift/notifications"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

// CreateGameRoom handles the creation of a new game room
func (s *Server) CreateGameRoom(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var req struct {
		Type models.GameType `json:"type"`
	}
	if err := c.BodyParser(&req); err != nil {
		return models.RespondWithError(c, fiber.StatusBadRequest, models.NewValidationError("Invalid request body"))
	}

	room := &models.GameRoom{
		Type:         req.Type,
		Status:       models.GamePending,
		CreatorID:    userID,
		CurrentState: "{}", // Initial empty state
	}

	if err := s.gameRepo.CreateRoom(room); err != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, models.NewInternalError(err))
	}

	return c.Status(fiber.StatusCreated).JSON(room)
}

// GetActiveGameRooms returns pending rooms for a game type
func (s *Server) GetActiveGameRooms(c *fiber.Ctx) error {
	gameType := models.GameType(c.Query("type", string(models.TicTacToe)))
	rooms, err := s.gameRepo.GetActiveRooms(gameType)
	if err != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, models.NewInternalError(err))
	}

	return c.JSON(rooms)
}

// GetGameStats fetches stats for a user and game type
func (s *Server) GetGameStats(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	gameType := models.GameType(c.Params("type"))

	stats, err := s.gameRepo.GetStats(userID, gameType)
	if err != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, models.NewInternalError(err))
	}

	return c.JSON(stats)
}

// GetGameRoom fetches a specific game room
func (s *Server) GetGameRoom(c *fiber.Ctx) error {
	id, _ := strconv.ParseUint(c.Params("id"), 10, 32)
	room, err := s.gameRepo.GetRoom(uint(id))
	if err != nil {
		return models.RespondWithError(c, fiber.StatusNotFound, models.NewNotFoundError("GameRoom", id))
	}

	return c.JSON(room)
}

// WebSocketGameHandler handles real-time game coordination
func (s *Server) WebSocketGameHandler() fiber.Handler {
	return websocket.New(func(c *websocket.Conn) {
		userIDVal := c.Locals("userID")
		if userIDVal == nil {
			log.Println("GameWS: No userID in locals")
			c.Close()
			return
		}
		userID := userIDVal.(uint)

		roomIDStr := c.Query("room_id")
		if roomIDStr == "" {
			log.Println("GameWS: No room_id in query")
			c.Close()
			return
		}
		roomID64, _ := strconv.ParseUint(roomIDStr, 10, 32)
		roomID := uint(roomID64)

		// Register connection with GameHub
		s.gameHub.Register(userID, roomID, c)

		defer func() {
			s.gameHub.Unregister(userID, roomID, c)
			c.Close()
		}()

		// Read loop
		for {
			_, msg, err := c.ReadMessage()
			if err != nil {
				log.Printf("GameWS: Error reading message (User %d, Room %d): %v", userID, roomID, err)
				break
			}

			var action notifications.GameAction
			if err := json.Unmarshal(msg, &action); err != nil {
				log.Printf("GameWS: Failed to unmarshal action: %v", err)
				continue
			}

			action.UserID = userID
			action.RoomID = roomID

			// Handle the action through the hub
			s.gameHub.HandleAction(userID, action)
		}
	})
}
