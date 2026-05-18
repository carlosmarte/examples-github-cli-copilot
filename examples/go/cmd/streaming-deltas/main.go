// 03 — Streaming deltas
//
// Enable streaming on the session and subscribe to AssistantMessageDeltaData
// to print chunks as they arrive. SessionIdleData signals completion.
//
// Run: go run ./cmd/streaming-deltas
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	copilot "github.com/github/copilot-sdk/go"
)

func main() {
	// Disable any user-configured MCP servers so this example runs against
	// the bare SDK surface only.
	os.Setenv("COPILOT_DISABLE_MCP", "1")

	ctx := context.Background()

	client := copilot.NewClient(&copilot.ClientOptions{})
	if err := client.Start(ctx); err != nil {
		log.Fatalf("client.Start: %v", err)
	}
	defer client.Stop()

	session, err := client.CreateSession(ctx, &copilot.SessionConfig{
		Model:               "gpt-4.1",
		Streaming:           true,
		OnPermissionRequest: copilot.PermissionHandler.ApproveAll,
	})
	if err != nil {
		log.Fatalf("client.CreateSession: %v", err)
	}
	defer session.Disconnect()

	done := make(chan struct{})
	off := session.On(func(event copilot.SessionEvent) {
		switch d := event.Data.(type) {
		case *copilot.AssistantMessageDeltaData:
			fmt.Fprint(os.Stdout, d.Content)
		case *copilot.SessionIdleData:
			close(done)
		}
	})
	defer off()

	if _, err := session.Send(ctx, copilot.MessageOptions{
		Prompt: "Write a haiku about goroutines.",
	}); err != nil {
		log.Fatalf("session.Send: %v", err)
	}
	<-done
	fmt.Println()
}
