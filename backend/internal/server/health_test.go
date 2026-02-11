package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLivenessCheck(t *testing.T) {
	app := fiber.New()
	s := &Server{}
	app.Get("/health/live", s.LivenessCheck)

	req := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "up", body["status"])
}

func TestReadinessCheck_Healthy(t *testing.T) {
	// Setup mock DB
	gormDB, mock := setupMockDB(t)

	// Setup miniredis
	mr, err := miniredis.Run()
	require.NoError(t, err)
	defer mr.Close()
	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	s := &Server{
		db:    gormDB,
		redis: redisClient,
	}

	app := fiber.New()
	app.Get("/health/ready", s.ReadinessCheck)

	// Expect DB ping
	mock.ExpectPing()

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "healthy", body["status"])

	checks := body["checks"].(map[string]interface{})
	assert.Equal(t, "healthy", checks["database"])
	assert.Equal(t, "healthy", checks["redis"])

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestReadinessCheck_UnhealthyDB(t *testing.T) {
	// Setup mock DB
	gormDB, mock := setupMockDB(t)

	// Setup miniredis (healthy)
	mr, err := miniredis.Run()
	require.NoError(t, err)
	defer mr.Close()
	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	s := &Server{
		db:    gormDB,
		redis: redisClient,
	}

	app := fiber.New()
	app.Get("/health/ready", s.ReadinessCheck)

	// Expect DB ping to fail
	mock.ExpectPing().WillReturnError(fiber.ErrInternalServerError)

	req := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	assert.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "unhealthy", body["status"])

	checks := body["checks"].(map[string]interface{})
	assert.Equal(t, "unhealthy", checks["database"])
	assert.Equal(t, "healthy", checks["redis"])

	assert.NoError(t, mock.ExpectationsWereMet())
}
