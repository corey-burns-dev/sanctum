package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"vibeshift/internal/handlers"
	"vibeshift/pkg/db"
	redispkg "vibeshift/pkg/redis"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize Redis client from REDIS_URL
	raw := os.Getenv("REDIS_URL")
	rawClient := redispkg.NewClient(raw)
	redisClient := redispkg.NewAdapter(rawClient)
	// Initialize Postgres DB (if DATABASE_URL or env vars are set).
	database, err := db.NewDB()
	if err != nil {
		// Fail fast: if DB is required, it's better to know at startup.
		// If you prefer the app to continue without DB, change this to log and continue.
		log.Fatalf("failed to connect to database: %v", err)
	}

	h := &handlers.Handlers{Redis: redisClient}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", h.Health)
	mux.HandleFunc("/ping", h.Ping)
	mux.Handle("/", http.NotFoundHandler())

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		log.Printf("Server starting on port :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Wait for termination signal and gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	_ = redisClient.Close()
	if database != nil {
		_ = database.Close()
	}
}
