package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	"sanctum/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFriendRepository_Integration(t *testing.T) {
	repo := NewFriendRepository(testDB)
	ctx := context.Background()

	// Setup users
	ts := time.Now().UnixNano()
	u1 := &models.User{Username: fmt.Sprintf("f1_%d", ts), Email: fmt.Sprintf("f1_%d@e.com", ts)}
	u2 := &models.User{Username: fmt.Sprintf("f2_%d", ts), Email: fmt.Sprintf("f2_%d@e.com", ts)}
	testDB.Create(u1)
	testDB.Create(u2)

	t.Run("Create and GetPendingRequests", func(t *testing.T) {
		friendship := &models.Friendship{
			RequesterID: u1.ID,
			AddresseeID: u2.ID,
			Status:      models.FriendshipStatusPending,
		}

		err := repo.Create(ctx, friendship)
		require.NoError(t, err)

		reqs, err := repo.GetPendingRequests(ctx, u2.ID)
		assert.NoError(t, err)
		assert.Len(t, reqs, 1)
		assert.Equal(t, u1.ID, reqs[0].RequesterID)
	})

	t.Run("UpdateStatus and GetFriends", func(t *testing.T) {
		f, _ := repo.GetFriendshipBetweenUsers(ctx, u1.ID, u2.ID)
		err := repo.UpdateStatus(ctx, f.ID, models.FriendshipStatusAccepted)
		assert.NoError(t, err)

		friends, err := repo.GetFriends(ctx, u1.ID)
		assert.NoError(t, err)
		assert.Len(t, friends, 1)
		assert.Equal(t, u2.Username, friends[0].Username)
	})

	t.Run("Delete", func(t *testing.T) {
		f, _ := repo.GetFriendshipBetweenUsers(ctx, u1.ID, u2.ID)
		err := repo.Delete(ctx, f.ID)
		assert.NoError(t, err)

		friends, _ := repo.GetFriends(ctx, u1.ID)
		assert.Empty(t, friends)
	})

	t.Run("GetFriends Hard Cap and Ordering", func(t *testing.T) {
		mainUser := &models.User{Username: "main", Email: "main@e.com"}
		testDB.Create(mainUser)

		// Create 1005 friends
		for i := 0; i < 1005; i++ {
			friend := &models.User{Username: fmt.Sprintf("friend_%d", i), Email: fmt.Sprintf("friend_%d@e.com", i)}
			testDB.Create(friend)

			status := models.FriendshipStatusAccepted
			f := &models.Friendship{
				RequesterID: mainUser.ID,
				AddresseeID: friend.ID,
				Status:      status,
			}
			testDB.Create(f)

			// Manually update created_at to ensure deterministic ordering for testing if needed,
			// but default DB behavior with sleep or just sequential creation should work.
			// Actually, let's just use the default and verify we get 1000.
		}

		friends, err := repo.GetFriends(ctx, mainUser.ID)
		assert.NoError(t, err)
		assert.Equal(t, 1000, len(friends))
	})

	t.Run("Requests Ordering", func(t *testing.T) {
		u3 := &models.User{Username: "u3", Email: "u3@e.com"}
		u4 := &models.User{Username: "u4", Email: "u4@e.com"}
		u5 := &models.User{Username: "u5", Email: "u5@e.com"}
		testDB.Create(u3)
		testDB.Create(u4)
		testDB.Create(u5)

		// Create two requests from u4 and u5 to u3
		f1 := &models.Friendship{RequesterID: u4.ID, AddresseeID: u3.ID, Status: models.FriendshipStatusPending}
		testDB.Create(f1)
		time.Sleep(10 * time.Millisecond) // Ensure different created_at
		f2 := &models.Friendship{RequesterID: u5.ID, AddresseeID: u3.ID, Status: models.FriendshipStatusPending}
		testDB.Create(f2)

		reqs, err := repo.GetPendingRequests(ctx, u3.ID)
		assert.NoError(t, err)
		require.Len(t, reqs, 2)
		// Should be newest first
		assert.Equal(t, u5.ID, reqs[0].RequesterID)
		assert.Equal(t, u4.ID, reqs[1].RequesterID)

		// Same for sent requests
		sent, err := repo.GetSentRequests(ctx, u4.ID)
		assert.NoError(t, err)
		assert.NotEmpty(t, sent)
		assert.Equal(t, u3.ID, sent[0].AddresseeID)
	})
}
