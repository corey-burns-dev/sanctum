package cache

import (
	"context"
	"fmt"
	"time"
)

// Cache Keys
const (
	UserKeyPrefix    = "user:%d"
	PostKeyPrefix    = "post:%d"
	SanctumKeyPrefix = "sanctum:%s"
)

// TTLs
const (
	UserTTL    = 1 * time.Hour
	PostTTL    = 30 * time.Minute
	SanctumTTL = 24 * time.Hour
)

// UserKey returns the cache key for a user by ID
func UserKey(userID uint) string {
	return fmt.Sprintf(UserKeyPrefix, userID)
}

// PostKey returns the cache key for a post by ID
func PostKey(postID uint) string {
	return fmt.Sprintf(PostKeyPrefix, postID)
}

// SanctumKey returns the cache key for a sanctum by slug
func SanctumKey(slug string) string {
	return fmt.Sprintf(SanctumKeyPrefix, slug)
}

// Invalidate removes a key from Redis
func Invalidate(ctx context.Context, key string) {
	if client != nil {
		client.Del(ctx, key)
	}
}
