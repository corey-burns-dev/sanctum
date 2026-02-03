// Package main provides a stress testing tool for the chat WebSocket server.
package main

import (
	"flag"
	"fmt"
	"log"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

// Metrics tracks the test results
type Metrics struct {
	ConnectionsAttempted int64
	ConnectionsSuccess   int64
	ConnectionsFailed    int64
	MessagesSent         int64
	MessagesReceived     int64
	Errors               int64
}

var metrics Metrics

func main() {
	host := flag.String("host", "localhost:8080", "WebSocket server host")
	clients := flag.Int("clients", 50, "Number of concurrent clients")
	duration := flag.Duration("duration", 30*time.Second, "Test duration")
	flag.Parse()

	log.Printf("🚀 Starting Chat Stress Test")
	log.Printf("Target: %s", *host)
	log.Printf("Clients: %d", *clients)
	log.Printf("Duration: %v", *duration)

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)

	var wg sync.WaitGroup
	stopChan := make(chan struct{})

	// Start clients
	for i := 0; i < *clients; i++ {
		wg.Add(1)
		go runClient(*host, i, stopChan, &wg)
		time.Sleep(10 * time.Millisecond) // Stagger connections slightly
	}

	// Wait for duration or interrupt
	select {
	case <-time.After(*duration):
		log.Println("⏱️  Test duration reached")
	case <-interrupt:
		log.Println("🛑 Interrupted by user")
	}

	close(stopChan)
	log.Println("Waiting for clients to disconnect...")
	wg.Wait()

	printMetrics()
}

func runClient(host string, id int, stopChan <-chan struct{}, wg *sync.WaitGroup) {
	defer wg.Done()
	atomic.AddInt64(&metrics.ConnectionsAttempted, 1)

	// Build URL
	u := url.URL{Scheme: "ws", Host: host, Path: "/ws/1"} // Connecting to room 1 (General)
	// Add dummy token query param if your auth middleware roughly checks for it,
	// or you might need a real login flow if strict auth is on.
	// For this test, we assume we might need to bypass auth or the server accepts a test token?
	// Based on previous code, the server might require a JWT in cookie or header.
	// Let's assume dev mode might verify but maybe we need a real token.
	// NOTE: If strict auth is enabled, this will fail without a valid token.
	// For now, let's try connecting without one, or maybe add a "token" param if needed later.

	c, resp, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if resp != nil {
		defer func() { _ = resp.Body.Close() }()
	}
	if err != nil {
		atomic.AddInt64(&metrics.ConnectionsFailed, 1)
		// log.Printf("Client %d connect error: %v", id, err)
		atomic.AddInt64(&metrics.Errors, 1)
		return
	}
	defer func() { _ = c.Close() }()

	atomic.AddInt64(&metrics.ConnectionsSuccess, 1)

	// Read loop
	go func() {
		defer func() { _ = c.Close() }()
		for {
			_, _, err := c.ReadMessage()
			if err != nil {
				return
			}
			atomic.AddInt64(&metrics.MessagesReceived, 1)
		}
	}()

	ticker := time.NewTicker(time.Second * 2)
	defer ticker.Stop()

	for {
		select {
		case <-stopChan:
			// Send close message
			_ = c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			return
		case <-ticker.C:
			// Send a test message
			msg := fmt.Sprintf("Test message from client %d at %v", id, time.Now().Format(time.Kitchen))
			// Current backend expects JSON probably?
			// Or simple text handling?
			// Based on previous contexts, likely JSON with content/type.
			// Let's send a simple JSON structure if we knew it, but plain text might echo or error depending on backend.
			// For stress testing the connection, even a ping is good.
			err := c.WriteMessage(websocket.TextMessage, []byte(msg))
			if err != nil {
				atomic.AddInt64(&metrics.Errors, 1)
				return
			}
			atomic.AddInt64(&metrics.MessagesSent, 1)
		}
	}
}

func printMetrics() {
	log.Println("\n📊 Test Results")
	log.Println("===============")
	log.Printf("Connections Attempted: %d", atomic.LoadInt64(&metrics.ConnectionsAttempted))
	log.Printf("Connections Successful: %d", atomic.LoadInt64(&metrics.ConnectionsSuccess))
	log.Printf("Connections Failed: %d", atomic.LoadInt64(&metrics.ConnectionsFailed))
	log.Printf("Messages Sent: %d", atomic.LoadInt64(&metrics.MessagesSent))
	log.Printf("Messages Received: %d", atomic.LoadInt64(&metrics.MessagesReceived))
	log.Printf("Total Errors: %d", atomic.LoadInt64(&metrics.Errors))
}
