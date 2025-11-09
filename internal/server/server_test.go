package server

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	redispkg "vibeshift/pkg/redis"
)

// mockRedis implements the small RedisClient interface for tests.
type mockRedis struct{}

func (m *mockRedis) Get(ctx context.Context, key string) (string, error) { return "", nil }
func (m *mockRedis) Set(ctx context.Context, key string, val interface{}, ttl time.Duration) error {
	return nil
}
func (m *mockRedis) Close() error { return nil }

func TestRunWithQuit_StartsAndStops(t *testing.T) {
	// Swap out constructors with fakes.
	origRedis := newRedisAdapter
	origDB := newDB
	defer func() { newRedisAdapter = origRedis; newDB = origDB }()

	newRedisAdapter = func(raw string) redispkg.RedisClient { return &mockRedis{} }
	newDB = func() (*sql.DB, error) { return nil, nil }

	// Use port 0 so the OS assigns an ephemeral port and we don't collide.
	os.Setenv("PORT", "0")

	quit := make(chan os.Signal, 1)
	done := make(chan struct{})

	go func() {
		RunWithQuit(quit)
		close(done)
	}()

	// Give the server a short moment to start.
	time.Sleep(50 * time.Millisecond)

	// Signal shutdown and wait for RunWithQuit to return.
	quit <- os.Interrupt

	select {
	case <-done:
		// ok
	case <-time.After(2 * time.Second):
		t.Fatal("server did not stop in time")
	}
}
