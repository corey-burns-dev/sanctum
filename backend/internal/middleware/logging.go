package middleware

import (
	"log/slog"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Logger is the global structured logger instance used throughout the application.
var Logger *slog.Logger

func init() {
	// Initialize a structured logger based on environment
	var handler slog.Handler
	level := slog.LevelInfo

	if os.Getenv("APP_ENV") == "production" {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	} else {
		// Pretty text output for local development
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	}

	Logger = slog.New(handler)
}

// StructuredLogger returns a Fiber middleware for logging requests using slog
func StructuredLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process request
		err := c.Next()

		// Log details after request is handled
		status := c.Response().StatusCode()
		latency := time.Since(start)

		fields := []any{
			slog.Int("status", status),
			slog.String("method", c.Method()),
			slog.String("path", c.Path()),
			slog.String("ip", c.IP()),
			slog.Duration("latency", latency),
			slog.String("user_agent", c.Get("User-Agent")),
		}

		if uid := c.Locals("userID"); uid != nil {
			fields = append(fields, slog.Any("user_id", uid))
		}

		if rid := c.Locals("requestid"); rid != nil {
			fields = append(fields, slog.Any("request_id", rid))
		}

		if err != nil {
			fields = append(fields, slog.String("error", err.Error()))
			Logger.Error("request failed", fields...)
		} else {
			Logger.Info("request processed", fields...)
		}

		return err
	}
}
