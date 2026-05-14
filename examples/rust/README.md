# Rust examples — `github-copilot-sdk`

Six Rust ports of the canonical Copilot SDK patterns. Each example is a
single `src/bin/<name>.rs` binary; the Node twins live in
`../nodejs/simple-sdk/`, the Java twins in `../java/`, the Python twins in
`../python/`, the Go twins in `../go/`.

## Prerequisites

1. **Rust 1.94+, edition 2024** — the SDK's `Cargo.toml` sets
   `edition = "2024"` and an MSRV of `1.94`.
2. **GitHub Copilot CLI 1.0.17+, authenticated** — the SDK launches it as a
   subprocess, identical to the other-language SDKs.
   ```sh
   copilot --version       # 1.0.17 or newer
   copilot auth status     # must report logged in
   ```

## Layout

```
examples/rust/
├── Cargo.toml
├── README.md
└── src/bin/
    ├── hello_world.rs         # 01 — one prompt, one response
    ├── multi_turn.rs          # 02 — one session, sequential prompts
    ├── streaming_deltas.rs    # 03 — SessionHandler + assistant.message_delta
    ├── explain_code_file.rs   # 04 — file → labeled-separator prompt
    ├── commit_from_diff.rs    # 05 — git diff --cached → prompt
    └── graceful_shutdown.rs   # 06 — stop() on success / error / signal
```

## Build & run

```sh
cargo build                           # resolve deps + compile all six binaries

cargo run --bin hello_world
cargo run --bin multi_turn
cargo run --bin streaming_deltas
cargo run --bin explain_code_file -- src/bin/hello_world.rs
cargo run --bin commit_from_diff
cargo run --bin graceful_shutdown
```

## API surface used

| Node (`@github/copilot-sdk`)            | Rust (`github_copilot_sdk`)                                          |
| --------------------------------------- | -------------------------------------------------------------------- |
| `new CopilotClient()`                   | `Client::start(ClientOptions::default()).await?`                     |
| `client.createSession({ model, … })`    | `client.create_session(config).await?` with `config.model = Some(…)` |
| `session.sendAndWait({ prompt })`       | `session.send_and_wait(prompt).await?` → `Option<SessionEvent>`      |
| `response?.data.content`                | `event.data.get("content").and_then(\|v\| v.as_str())`               |
| `session.on("assistant.message_delta")` | `impl SessionHandler` + `config.with_handler(Arc::new(_))`           |
| `session.on("session.idle")`            | `event.event_type == "session.idle"` inside the handler              |
| `await client.stop()`                   | `client.stop().await?`                                               |

## Notes

- The SDK is fully Tokio-based. Each binary is annotated `#[tokio::main]`.
- `event.data` is `serde_json::Value`; field access uses
  `event.data.get("content").and_then(|v| v.as_str())` — the equivalent of
  Node's null-safe `response?.data.content`.
- `streaming_deltas.rs` implements `SessionHandler` via `#[async_trait]` and
  registers it through the builder method `SessionConfig::with_handler`.
  Streaming chunks arrive as events with `event_type == "assistant.message_delta"`
  and `data.deltaContent: &str`.
- `graceful_shutdown.rs` uses `tokio::signal::unix` (SIGINT → 130,
  SIGTERM → 143). For Windows portability swap in `tokio::signal::ctrl_c()`.
- Pinned to `github-copilot-sdk = "1.0.0-beta.4"`. The crate is technical
  preview; bump in `Cargo.toml` as new releases land.
- Two assumptions came from web research, not a local `cargo check`:
  (a) `SessionConfig::model` is a public `Option<String>` field, and
  (b) the streaming-delta payload field is `deltaContent`. If either is
  named differently, the fix is a one-line identifier swap per file.
