package cache

import (
	"context"
	"fmt"
	"time"
)

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

const (
	UserTTL           = 5 * time.Minute
	SanctumTTL        = 10 * time.Minute
	MessageHistoryTTL = 2 * time.Minute
	PostTTL           = 30 * time.Minute
	ListTTL           = 2 * time.Minute
)

func UserKey(userID uint) string {
	return fmt.Sprintf(UserKeyPrefix, userID)
}

func UserConversationsKey(userID uint) string {
	return fmt.Sprintf(UserConversationsPrefix, userID)
}

func PostKey(postID uint) string {
	return fmt.Sprintf(PostKeyPrefix, postID)
}

func PostsListKey(ctx context.Context) string {
	version := GetVersion(ctx, PostsListVersionKey)
	return fmt.Sprintf("%s:v%d", PostsListGlobalPrefix, version)
}

func ChatroomsAllKeyWithVersion(ctx context.Context) string {
	version := GetVersion(ctx, ChatroomsVersionKey)
	return fmt.Sprintf("%s:v%d", ChatroomsAllKey, version)
}

func SanctumKey(slug string) string {
	return fmt.Sprintf(SanctumKeyPrefix, slug)
}

func RoomKey(roomID uint) string {
	return fmt.Sprintf(RoomKeyPrefix, roomID)
}

func MessageHistoryKey(roomID uint) string {
	return fmt.Sprintf(MessageHistoryPrefix, roomID)
}

func GetVersion(ctx context.Context, key string) int64 {
	if client == nil {
		return 0
	}
	v, _ := client.Get(ctx, key).Int64()
	return v
}

func BumpVersion(ctx context.Context, key string) {
	if client != nil {
		client.Incr(ctx, key)
	}
}

func Invalidate(ctx context.Context, key string) {
	if client != nil {
		client.Del(ctx, key)
	}
}

func InvalidateUser(ctx context.Context, userID uint) {
	Invalidate(ctx, UserKey(userID))
	Invalidate(ctx, UserConversationsKey(userID))
}

func InvalidateRoom(ctx context.Context, roomID uint) {
	Invalidate(ctx, RoomKey(roomID))
	Invalidate(ctx, MessageHistoryKey(roomID))
	BumpVersion(ctx, ChatroomsVersionKey)
}

func InvalidatePostsList(ctx context.Context) {
	BumpVersion(ctx, PostsListVersionKey)
}

func InvalidateSanctum(ctx context.Context, slug string) {
	Invalidate(ctx, SanctumKey(slug))
}
