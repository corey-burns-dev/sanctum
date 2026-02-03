package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
)

func TestStructuredLogger(t *testing.T) {
	t.Parallel()

	app := fiber.New()
	app.Use(StructuredLogger())

	app.Get("/success", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	app.Get("/error", func(_ *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusInternalServerError, "test error")
	})

	tests := []struct {
		name           string
		path           string
		expectedStatus int
	}{
		{
			name:           "Log successful request",
			path:           "/success",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Log failed request",
			path:           "/error",
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			resp, err := app.Test(req)
			defer func() { _ = resp.Body.Close() }()
			assert.NoError(t, err)
			assert.Equal(t, tt.expectedStatus, resp.StatusCode)
		})
	}
}
