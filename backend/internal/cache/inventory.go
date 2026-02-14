package cache

import (
	"context"
	"fmt"
	"time"
)

// Cache key prefixes
const (
	UserKeyPrefix           = "user:%d"
	UserConversationsPrefix = "user:%d:conversations"
	PostKeyPrefix           = "post:%d"
	PostsListGlobalPrefix   = "posts:list:global"
	PostsListVersionKey     = "posts:list:version"
	SanctumKeyPrefix        = "sanctum:%s"
	RoomKeyPrefix           = "room:%d"
	ChatroomsAllKey         = "chatrooms:all"
	ChatroomsVersionKey     = "chatrooms:version"
	MessageHistoryPrefix    = "room:%d:messages"
)

// Cache TTLs
const (
	UserTTL           = 5 * time.Minute
	SanctumTTL        = 10 * time.Minute
	MessageHistoryTTL = 2 * time.Minute
	PostTTL           = 30 * time.Minute
	ListTTL           = 2 * time.Minute
)

// UserKey returns the cache key for a user.
func UserKey(userID uint) string {
	return fmt.Sprintf(UserKeyPrefix, userID)
}

// UserConversationsKey returns the cache key for a user's conversations.
func UserConversationsKey(userID uint) string {
	return fmt.Sprintf(UserConversationsPrefix, userID)
}

// PostKey returns the cache key for a post.
func PostKey(postID uint) string {
	return fmt.Sprintf(PostKeyPrefix, postID)
}

// PostsListKey returns the versioned cache key for the global posts list.
func PostsListKey(ctx context.Context) string {
	version := GetVersion(ctx, PostsListVersionKey)
	return fmt.Sprintf("%s:v%d", PostsListGlobalPrefix, version)
}

// ChatroomsAllKeyWithVersion returns the versioned cache key for the all chatrooms list.
func ChatroomsAllKeyWithVersion(ctx context.Context) string {
	version := GetVersion(ctx, ChatroomsVersionKey)
	return fmt.Sprintf("%s:v%d", ChatroomsAllKey, version)
}

// SanctumKey returns the cache key for a sanctum by slug.
func SanctumKey(slug string) string {
	return fmt.Sprintf(SanctumKeyPrefix, slug)
}

// RoomKey returns the cache key for a chat room.
func RoomKey(roomID uint) string {
	return fmt.Sprintf(RoomKeyPrefix, roomID)
}

// MessageHistoryKey returns the cache key for a room's message history.
func MessageHistoryKey(roomID uint) string {
	return fmt.Sprintf(MessageHistoryPrefix, roomID)
}

// GetVersion returns the current version number for a versioned cache key.
func GetVersion(ctx context.Context, key string) int64 {
	if client == nil {
		return 0
	}
	v, _ := client.Get(ctx, key).Int64()
	return v
}

// BumpVersion increments the version number for a versioned cache key.
func BumpVersion(ctx context.Context, key string) {
	if client != nil {
		client.Incr(ctx, key)
	}
}

// Invalidate removes a key from the cache.
func Invalidate(ctx context.Context, key string) {
	if client != nil {
		client.Del(ctx, key)
	}
}

// InvalidateUser invalidates all cache entries related to a user.
func InvalidateUser(ctx context.Context, userID uint) {
	Invalidate(ctx, UserKey(userID))
	Invalidate(ctx, UserConversationsKey(userID))
}

// InvalidateRoom invalidates all cache entries related to a chat room.
func InvalidateRoom(ctx context.Context, roomID uint) {
	Invalidate(ctx, RoomKey(roomID))
	Invalidate(ctx, MessageHistoryKey(roomID))
	BumpVersion(ctx, ChatroomsVersionKey)
}

// InvalidatePostsList triggers a version bump for the global posts list.
func InvalidatePostsList(ctx context.Context) {
	BumpVersion(ctx, PostsListVersionKey)
}

// InvalidateSanctum invalidates the cache entry for a sanctum.
func InvalidateSanctum(ctx context.Context, slug string) {
	Invalidate(ctx, SanctumKey(slug))
}
