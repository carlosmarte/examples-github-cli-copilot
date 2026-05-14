# Go examples — `github.com/github/copilot-sdk/go`

Six Go ports of the canonical Copilot SDK patterns. Each example is a single
`cmd/<name>/main.go` binary; the Node twins live in `../nodejs/simple-sdk/`,
the Java twins in `../java/`, the Python twins in `../python/`.

## Prerequisites

1. **Go 1.24+** — the SDK's `go.mod` requires `go 1.24`.
2. **GitHub Copilot CLI 1.0.17+, authenticated** — the SDK launches it as a
   subprocess, identical to the Node, Java, and Python SDKs.
   ```sh
   copilot --version       # 1.0.17 or newer
   copilot auth status     # must report logged in
   ```

## Layout

```
examples/go/
├── go.mod
├── README.md
└── cmd/
    ├── hello-world/main.go         # 01 — one prompt, one response
    ├── multi-turn/main.go          # 02 — one session, sequential prompts
    ├── streaming-deltas/main.go    # 03 — Streaming:true + AssistantMessageDeltaData
    ├── explain-code-file/main.go   # 04 — file → labeled-separator prompt
    ├── commit-from-diff/main.go    # 05 — git diff --cached → prompt
    └── graceful-shutdown/main.go   # 06 — Stop() on success / error / signal
```

## Install & run

```sh
go mod tidy           # resolve the SDK to its latest published version

go run ./cmd/hello-world
go run ./cmd/multi-turn
go run ./cmd/streaming-deltas
go run ./cmd/explain-code-file cmd/hello-world/main.go
go run ./cmd/commit-from-diff
go run ./cmd/graceful-shutdown
```

## API surface used

| Node (`@github/copilot-sdk`)            | Go (`github.com/github/copilot-sdk/go`)                                  |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `new CopilotClient()`                   | `copilot.NewClient(&copilot.ClientOptions{})` + `client.Start(ctx)`      |
| `client.createSession({ model, … })`    | `client.CreateSession(ctx, &copilot.SessionConfig{Model: …})`            |
| `session.sendAndWait({ prompt })`       | `session.Send(ctx, copilot.MessageOptions{Prompt: …})` + idle channel   |
| `response?.data.content`                | `event.Data.(*copilot.AssistantMessageData).Content`                     |
| `session.on("assistant.message_delta")` | `session.On(func(ev) { … case *AssistantMessageDeltaData: … })`         |
| `session.on("session.idle")`            | `case *copilot.SessionIdleData:` inside the same handler                 |
| `await client.stop()`                   | `defer client.Stop()`                                                    |

## Notes

- The SDK is context-based; every async call takes a `context.Context`.
- `OnPermissionRequest` is required on `SessionConfig`. The examples use
  `copilot.PermissionHandler.ApproveAll` — fine for examples, not for
  production.
- `session.On` returns an unsubscribe `func()`; `streaming-deltas` calls it
  via `defer off()` to demonstrate the cleanup hook.
- The multi-turn example uses `sync/atomic.Pointer[chan struct{}]` to swap
  per-turn done channels under the single registered handler — that's
  idiomatic for "one handler, many waits."
- The graceful-shutdown example wraps `client.Stop()` in `sync.Once` so the
  signal goroutine and the happy-path call don't race; exit code 130 for
  SIGINT, 143 for SIGTERM, matching the Node and Python twins.
- The `go.mod` pins `v0.1.0` as a placeholder — run `go mod tidy` to resolve
  to the current release.
