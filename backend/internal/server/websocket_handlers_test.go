package server

import (
	"context"
	"testing"

	"sanctum/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestIsUserParticipant(t *testing.T) {
	mockChatRepo := new(MockChatRepository)
	s := &Server{chatRepo: mockChatRepo}

	tests := []struct {
		name           string
		userID         uint
		convID         uint
		mockSetup      func()
		expectedResult bool
	}{
		{
			name:   "User is participant",
			userID: 1,
			convID: 10,
			mockSetup: func() {
				mockChatRepo.On("GetConversation", mock.Anything, uint(10)).Return(&models.Conversation{
					Participants: []models.User{{ID: 1}},
				}, nil)
			},
			expectedResult: true,
		},
		{
			name:   "User is not participant",
			userID: 2,
			convID: 10,
			mockSetup: func() {
				mockChatRepo.On("GetConversation", mock.Anything, uint(10)).Return(&models.Conversation{
					Participants: []models.User{{ID: 1}},
				}, nil)
			},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.mockSetup()
			result := s.isUserParticipant(context.Background(), tt.userID, tt.convID)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}
