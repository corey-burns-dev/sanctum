package server

import (
	"context"
	"encoding/json"
	"log"

	"vibeshift/internal/models"
)

func (s *Server) publishUserEvent(userID uint, eventType string, payload map[string]interface{}) {
	if s.notifier == nil {
		return
	}

	event := map[string]interface{}{
		"type":    eventType,
		"payload": payload,
	}
	eventJSON, err := json.Marshal(event)
	if err != nil {
		log.Printf("failed to marshal %s event: %v", eventType, err)
		return
	}
	if err := s.notifier.PublishUser(context.Background(), userID, string(eventJSON)); err != nil {
		log.Printf("failed to publish %s event to user %d: %v", eventType, userID, err)
	}
}

func userSummary(user models.User) map[string]interface{} {
	return map[string]interface{}{
		"id":       user.ID,
		"username": user.Username,
		"avatar":   user.Avatar,
	}
}

func userSummaryPtr(user *models.User) map[string]interface{} {
	if user == nil {
		return nil
	}
	return userSummary(*user)
}
