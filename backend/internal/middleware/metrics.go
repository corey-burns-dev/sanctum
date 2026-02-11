package middleware

import (
	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// ActiveWebSockets tracks the number of currently active WebSocket connections
	ActiveWebSockets = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "sanctum_active_websockets",
		Help: "The total number of active WebSocket connections",
	})

	// DatabaseErrors tracks the number of database operation errors
	DatabaseErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "sanctum_database_errors_total",
		Help: "The total number of database errors",
	}, []string{"operation"})

	// RedisErrors tracks the number of Redis operation errors
	RedisErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "sanctum_redis_errors_total",
		Help: "The total number of redis errors",
	}, []string{"operation"})
)

// InitMetrics initializes and returns the Prometheus middleware
func InitMetrics(appName string) *fiberprometheus.FiberPrometheus {
	prometheus := fiberprometheus.New(appName)
	return prometheus
}

// MetricsMiddleware returns a middleware that registers the Prometheus metrics
func MetricsMiddleware(p *fiberprometheus.FiberPrometheus) fiber.Handler {
	return p.Middleware
}
