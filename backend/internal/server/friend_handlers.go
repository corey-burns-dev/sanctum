// Package server contains HTTP and WebSocket handlers for the application's API endpoints.
package server

import (
	"time"

	"vibeshift/internal/models"

	"github.com/gofiber/fiber/v2"
)

// SendFriendRequest handles POST /api/friends/requests/:userId
func (s *Server) SendFriendRequest(c *fiber.Ctx) error {
	ctx := c.Context()
	userID := c.Locals("userID").(uint)
	targetUserID, err := c.ParamsInt("userId")
	if err != nil {
		return models.RespondWithError(c, fiber.StatusBadRequest,
			models.NewValidationError("Invalid user ID"))
	}

	// Cannot send friend request to yourself
	if targetUserID < 0 {
		return models.RespondWithError(c, fiber.StatusBadRequest,
			models.NewValidationError("Invalid user ID"))
	}
	if userID == uint(targetUserID) {
		return models.RespondWithError(c, fiber.StatusBadRequest,
			models.NewValidationError("Cannot send friend request to yourself"))
	}

	// Check if target user exists
	_, getUserErr := s.userRepo.GetByID(ctx, uint(targetUserID))
	if getUserErr != nil {
		return models.RespondWithError(c, fiber.StatusNotFound, getUserErr)
	}

	// Check if friendship already exists
	existing, getFriendshipErr := s.friendRepo.GetFriendshipBetweenUsers(ctx, userID, uint(targetUserID))
	if getFriendshipErr != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, getFriendshipErr)
	}
	if existing != nil {
		switch existing.Status {
		case models.FriendshipStatusAccepted:
			return models.RespondWithError(c, fiber.StatusConflict,
				models.NewValidationError("You are already friends"))
		case models.FriendshipStatusPending:
			if existing.RequesterID == userID {
				return models.RespondWithError(c, fiber.StatusConflict,
					models.NewValidationError("Friend request already sent"))
			}
			return models.RespondWithError(c, fiber.StatusConflict,
				models.NewValidationError("You already have a pending friend request from this user"))
		}
	}

	// Create a pending friend request; addressee can accept or reject later.
	friendship := &models.Friendship{
		RequesterID: userID,
		AddresseeID: uint(targetUserID),
		Status:      models.FriendshipStatusPending,
	}

	if createErr := s.friendRepo.Create(ctx, friendship); createErr != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, createErr)
	}

	// Load full friendship for response
	friendship, err = s.friendRepo.GetByID(ctx, friendship.ID)
	if err != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, err)
	}

	// Notify both users so UI updates immediately.
	s.publishUserEvent(friendship.AddresseeID, "friend_request_received", map[string]interface{}{
		"request_id": friendship.ID,
		"from_user":  userSummary(friendship.Requester),
		"created_at": time.Now().UTC().Format(time.RFC3339Nano),
	})
	s.publishUserEvent(friendship.RequesterID, "friend_request_sent", map[string]interface{}{
		"request_id": friendship.ID,
		"to_user":    userSummary(friendship.Addressee),
		"created_at": time.Now().UTC().Format(time.RFC3339Nano),
	})

	return c.Status(fiber.StatusCreated).JSON(friendship)
}

// GetPendingRequests handles GET /api/friends/requests
func (s *Server) GetPendingRequests(c *fiber.Ctx) error {
	ctx := c.Context()
	userID := c.Locals("userID").(uint)

	requests, err := s.friendRepo.GetPendingRequests(ctx, userID)
	if err != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, err)
	}

	return c.JSON(requests)
}

// GetSentRequests handles GET /api/friends/requests/sent
func (s *Server) GetSentRequests(c *fiber.Ctx) error {
	ctx := c.Context()
	userID := c.Locals("userID").(uint)

	requests, err := s.friendRepo.GetSentRequests(ctx, userID)
	if err != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, err)
	}

	return c.JSON(requests)
}

// AcceptFriendRequest handles POST /api/friends/requests/:requestId/accept
func (s *Server) AcceptFriendRequest(c *fiber.Ctx) error {
	ctx := c.Context()
	userID := c.Locals("userID").(uint)
	requestID, err := c.ParamsInt("requestId")
	if err != nil || requestID < 0 {
		return models.RespondWithError(c, fiber.StatusBadRequest,
			models.NewValidationError("Invalid request ID"))
	}

	// Get the friendship request
	friendship, err := s.friendRepo.GetByID(ctx, uint(requestID))
	if err != nil {
		return models.RespondWithError(c, fiber.StatusNotFound, err)
	}

	// Check if user is the addressee
	if friendship.AddresseeID != userID {
		return models.RespondWithError(c, fiber.StatusForbidden,
			models.NewUnauthorizedError("You can only accept friend requests sent to you"))
	}

	// Check if already accepted
	if friendship.Status != models.FriendshipStatusPending {
		return models.RespondWithError(c, fiber.StatusConflict,
			models.NewValidationError("Friend request is not pending"))
	}

	// Accept the request
	if updateErr := s.friendRepo.UpdateStatus(ctx, uint(requestID), models.FriendshipStatusAccepted); updateErr != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, updateErr)
	}

	// Get updated friendship
	friendship, err = s.friendRepo.GetByID(ctx, uint(requestID))
	if err != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, err)
	}

	s.publishUserEvent(friendship.RequesterID, "friend_request_accepted", map[string]interface{}{
		"request_id":  friendship.ID,
		"friend_user": userSummary(friendship.Addressee),
		"created_at":  time.Now().UTC().Format(time.RFC3339Nano),
	})
	s.publishUserEvent(friendship.AddresseeID, "friend_added", map[string]interface{}{
		"request_id":  friendship.ID,
		"friend_user": userSummary(friendship.Requester),
		"created_at":  time.Now().UTC().Format(time.RFC3339Nano),
	})

	return c.JSON(friendship)
}

// RejectFriendRequest handles POST /api/friends/requests/:requestId/reject
func (s *Server) RejectFriendRequest(c *fiber.Ctx) error {
	ctx := c.Context()
	userID := c.Locals("userID").(uint)
	requestID, err := c.ParamsInt("requestId")
	if err != nil || requestID < 0 {
		return models.RespondWithError(c, fiber.StatusBadRequest,
			models.NewValidationError("Invalid request ID"))
	}

	// Get the friendship request
	friendship, err := s.friendRepo.GetByID(ctx, uint(requestID))
	if err != nil {
		return models.RespondWithError(c, fiber.StatusNotFound, err)
	}

	// Addressee can reject, requester can cancel their own pending request.
	if friendship.AddresseeID != userID && friendship.RequesterID != userID {
		return models.RespondWithError(c, fiber.StatusForbidden,
			models.NewUnauthorizedError("You can only reject or cancel your own pending requests"))
	}

	// Check if already processed
	if friendship.Status != models.FriendshipStatusPending {
		return models.RespondWithError(c, fiber.StatusConflict,
			models.NewValidationError("Friend request is not pending"))
	}

	// Delete the request (reject)
	if deleteErr := s.friendRepo.Delete(ctx, uint(requestID)); deleteErr != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, deleteErr)
	}

	eventType := "friend_request_rejected"
	if friendship.RequesterID == userID {
		eventType = "friend_request_cancelled"
	}
	s.publishUserEvent(friendship.RequesterID, eventType, map[string]interface{}{
		"request_id":  friendship.ID,
		"by_user_id":  userID,
		"rejected_at": time.Now().UTC().Format(time.RFC3339Nano),
	})
	s.publishUserEvent(friendship.AddresseeID, eventType, map[string]interface{}{
		"request_id":  friendship.ID,
		"by_user_id":  userID,
		"rejected_at": time.Now().UTC().Format(time.RFC3339Nano),
	})

	return c.SendStatus(fiber.StatusNoContent)
}

// GetFriends handles GET /api/friends
func (s *Server) GetFriends(c *fiber.Ctx) error {
	ctx := c.Context()
	userID := c.Locals("userID").(uint)

	friends, err := s.friendRepo.GetFriends(ctx, userID)
	if err != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, err)
	}

	return c.JSON(friends)
}

// GetFriendshipStatus handles GET /api/friends/status/:userId
func (s *Server) GetFriendshipStatus(c *fiber.Ctx) error {
	ctx := c.Context()
	userID := c.Locals("userID").(uint)
	targetUserID, err := c.ParamsInt("userId")
	if err != nil || targetUserID < 0 {
		return models.RespondWithError(c, fiber.StatusBadRequest,
			models.NewValidationError("Invalid user ID"))
	}

	// Check if target user exists
	_, getUserErr := s.userRepo.GetByID(ctx, uint(targetUserID))
	if getUserErr != nil {
		return models.RespondWithError(c, fiber.StatusNotFound, getUserErr)
	}

	// Get friendship status
	friendship, getFriendshipErr := s.friendRepo.GetFriendshipBetweenUsers(ctx, userID, uint(targetUserID))
	if getFriendshipErr != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, getFriendshipErr)
	}

	status := "none"
	var requestID uint
	if friendship != nil {
		switch friendship.Status {
		case models.FriendshipStatusAccepted:
			status = "friends"
		case models.FriendshipStatusPending:
			requestID = friendship.ID
			if friendship.RequesterID == userID {
				status = "pending_sent"
			} else {
				status = "pending_received"
			}
		default:
			status = string(friendship.Status)
		}
	}

	return c.JSON(fiber.Map{
		"status":     status,
		"request_id": requestID,
		"friendship": friendship,
	})
}

// RemoveFriend handles DELETE /api/friends/:userId
func (s *Server) RemoveFriend(c *fiber.Ctx) error {
	ctx := c.Context()
	userID := c.Locals("userID").(uint)
	targetUserID, err := c.ParamsInt("userId")
	if err != nil || targetUserID < 0 {
		return models.RespondWithError(c, fiber.StatusBadRequest,
			models.NewValidationError("Invalid user ID"))
	}

	// Check if friendship exists and is accepted
	friendship, getFriendshipErr := s.friendRepo.GetFriendshipBetweenUsers(ctx, userID, uint(targetUserID))
	if getFriendshipErr != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, getFriendshipErr)
	}
	if friendship == nil || friendship.Status != models.FriendshipStatusAccepted {
		return models.RespondWithError(c, fiber.StatusNotFound,
			models.NewNotFoundError("Friendship", 0))
	}

	// Remove friendship
	if removeErr := s.friendRepo.RemoveFriendship(ctx, userID, uint(targetUserID)); removeErr != nil {
		return models.RespondWithError(c, fiber.StatusInternalServerError, removeErr)
	}

	s.publishUserEvent(userID, "friend_removed", map[string]interface{}{
		"user_id":    uint(targetUserID),
		"removed_at": time.Now().UTC().Format(time.RFC3339Nano),
	})
	s.publishUserEvent(uint(targetUserID), "friend_removed", map[string]interface{}{
		"user_id":    userID,
		"removed_at": time.Now().UTC().Format(time.RFC3339Nano),
	})

	return c.SendStatus(fiber.StatusOK)
}
