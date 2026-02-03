package notifications

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

type MockConn struct {
	LastMessage []byte
}

func (m *MockConn) WriteMessage(_ int, data []byte) error {
	m.LastMessage = data
	return nil
}

func (m *MockConn) Close() error {
	return nil
}

func TestChatHub_RegisterUnregister(t *testing.T) {
	hub := NewChatHub()
	client := &Client{
		UserID: 1,
		Send:   make(chan []byte, 10),
	}

	// Register
	hub.RegisterUser(client)
	hub.mu.RLock()
	assert.Len(t, hub.userConns[1], 1)
	hub.mu.RUnlock()

	// Unregister
	hub.UnregisterUser(client)
	hub.mu.RLock()
	assert.Empty(t, hub.userConns[1])
	hub.mu.RUnlock()
}

func TestChatHub_BroadcastToConversation(t *testing.T) {
	hub := NewChatHub()
	client := &Client{
		UserID: 1,
		Send:   make(chan []byte, 10),
	}
	hub.RegisterUser(client)
	hub.JoinConversation(1, 101)

	msg := ChatMessage{
		Type:           "message",
		ConversationID: 101,
		Payload:        "Hello",
	}

	hub.BroadcastToConversation(101, msg)

	// Check if message was sent to client channel
	sentMsg := <-client.Send
	var received ChatMessage
	err := json.Unmarshal(sentMsg, &received)
	assert.NoError(t, err)
	assert.Equal(t, "message", received.Type)
	assert.Equal(t, uint(101), received.ConversationID)
}
