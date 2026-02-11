package notifications

import (
	"context"
	"errors"
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"sanctum/internal/models"

	"github.com/gofiber/websocket/v2"
	"gorm.io/gorm"
)

const (
	maxPeersPerGameRoom = 2
)

// GameAction represents a message sent via WebSocket for games
type GameAction struct {
	Type    string      `json:"type"` // "create_room", "join_room", "make_move", "chat", "game_state", "error"
	RoomID  uint        `json:"room_id,omitempty"`
	UserID  uint        `json:"user_id,omitempty"`
	Payload interface{} `json:"payload"`
}

// GameHub manages real-time game interaction
type GameHub struct {
	mu sync.RWMutex

	// Map: roomID -> userID -> client
	rooms map[uint]map[uint]*Client

	// Map: userID -> set of rooms they are in (usually just one)
	userRooms map[uint]map[uint]struct{}

	db       *gorm.DB
	notifier *Notifier
}

// Name returns a human-readable identifier for this hub.
func (h *GameHub) Name() string { return "game hub" }

// NewGameHub creates a new GameHub instance
func NewGameHub(db *gorm.DB, notifier *Notifier) *GameHub {
	return &GameHub{
		rooms:     make(map[uint]map[uint]*Client),
		userRooms: make(map[uint]map[uint]struct{}),
		db:        db,
		notifier:  notifier,
	}
}

// Register registers a user's connection in a room. Returns Client or error if limits exceeded.
func (h *GameHub) Register(userID, roomID uint, conn *websocket.Conn) (*Client, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[roomID] == nil {
		h.rooms[roomID] = make(map[uint]*Client)
	}

	if len(h.rooms[roomID]) >= maxPeersPerGameRoom {
		// Only check if user is not already in the room
		if _, ok := h.rooms[roomID][userID]; !ok {
			return nil, errors.New("game room is full")
		}
	}

	client := NewClient(h, conn, userID)
	h.rooms[roomID][userID] = client

	if h.userRooms[userID] == nil {
		h.userRooms[userID] = make(map[uint]struct{})
	}
	h.userRooms[userID][roomID] = struct{}{}

	log.Printf("GameHub: User %d registered in room %d", userID, roomID)
	return client, nil
}

// UnregisterClient removes a user's connection
func (h *GameHub) UnregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	userID := client.UserID
	
	// Find which rooms this client is in
	rooms, ok := h.userRooms[userID]
	if !ok {
		return
	}

	for roomID := range rooms {
		if room, ok := h.rooms[roomID]; ok {
			if c, ok := room[userID]; ok && c == client {
				delete(room, userID)
				if len(room) == 0 {
					delete(h.rooms, roomID)
				}
				
				// Database cleanup: If the creator leaves a pending room, cancel it
				var gRoom models.GameRoom
				if err := h.db.First(&gRoom, roomID).Error; err == nil {
					if gRoom.Status == models.GamePending && gRoom.CreatorID == userID {
						gRoom.Status = models.GameCancelled
						h.db.Save(&gRoom)
						log.Printf("GameHub: Pending room %d cancelled because creator (User %d) disconnected", roomID, userID)
					}
				}
			}
		}
	}
	delete(h.userRooms, userID)
}

// Unregister is a legacy wrapper. Deprecated: use UnregisterClient.
func (h *GameHub) Unregister(userID, roomID uint, conn *websocket.Conn) {
	// Logic moved to UnregisterClient
}

// BroadcastToRoom sends a message to all users in a game room
func (h *GameHub) BroadcastToRoom(roomID uint, action GameAction) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users, ok := h.rooms[roomID]
	if !ok {
		return
	}

	actionJSON, err := json.Marshal(action)
	if err != nil {
		log.Printf("GameHub: Failed to marshal action: %v", err)
		return
	}

	for _, client := range users {
		client.TrySend(actionJSON)
	}
}

// ... (HandleAction unchanged)

func (h *GameHub) sendError(userID, roomID uint, message string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	room, ok := h.rooms[roomID]
	if !ok {
		return
	}

	client, ok := room[userID]
	if !ok {
		return
	}

	resp := GameAction{
		Type:   "error",
		RoomID: roomID,
		Payload: map[string]string{
			"message": message,
		},
	}
	respJSON, _ := json.Marshal(resp)
	client.TrySend(respJSON)
}

// StartWiring connects GameHub to Redis
func (h *GameHub) StartWiring(ctx context.Context, n *Notifier) error {
	return n.StartGameSubscriber(ctx, func(channel, payload string) {
		var roomID uint
		if _, err := fmt.Sscanf(channel, "game:room:%d", &roomID); err != nil {
			return
		}

		var action GameAction
		if err := json.Unmarshal([]byte(payload), &action); err != nil {
			return
		}
		action.RoomID = roomID

		h.BroadcastToRoom(roomID, action)
	})
}

// Shutdown gracefully closes all websocket connections
func (h *GameHub) Shutdown(_ context.Context) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Close all room connections
	for roomID, users := range h.rooms {
		for userID, conn := range users {
			shutdownMsg := GameAction{
				Type:    "server_shutdown",
				RoomID:  roomID,
				Payload: map[string]string{"message": "Server is shutting down"},
			}
			if msgJSON, err := json.Marshal(shutdownMsg); err == nil {
				if err := conn.WriteMessage(websocket.TextMessage, msgJSON); err != nil {
					log.Printf("failed to write shutdown message in room %d for user %d: %v", roomID, userID, err)
				}
			}
			if err := conn.Close(); err != nil {
				log.Printf("failed to close websocket in room %d for user %d: %v", roomID, userID, err)
			}
		}
	}

	// Clear all state
	h.rooms = make(map[uint]map[uint]*websocket.Conn)
	h.userRooms = make(map[uint]map[uint]struct{})

	return nil
}
