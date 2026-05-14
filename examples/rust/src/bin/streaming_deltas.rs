//! 03 — Streaming deltas
//!
//! Implement SessionHandler to receive `assistant.message_delta` events as
//! they arrive. The handler is registered on SessionConfig before the session
//! is created.
//!
//! Run: cargo run --bin streaming_deltas

use async_trait::async_trait;
use github_copilot_sdk::handler::{HandlerEvent, HandlerResponse, SessionHandler};
use github_copilot_sdk::{Client, ClientOptions, SessionConfig};
use std::io::Write;
use std::sync::Arc;

struct StdoutPrinter;

#[async_trait]
impl SessionHandler for StdoutPrinter {
    async fn on_event(&self, event: HandlerEvent) -> HandlerResponse {
        if let HandlerEvent::SessionEvent { event, .. } = event {
            if event.event_type == "assistant.message_delta" {
                if let Some(text) = event.data.get("deltaContent").and_then(|v| v.as_str()) {
                    print!("{}", text);
                    let _ = std::io::stdout().flush();
                }
            }
        }
        HandlerResponse::Ok
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::start(ClientOptions::default()).await?;

    let mut config = SessionConfig::default();
    config.model = Some("gpt-4.1".to_string());
    config.streaming = Some(true);
    let config = config.with_handler(Arc::new(StdoutPrinter));

    let session = client.create_session(config).await?;

    session
        .send_and_wait("Write a haiku about Rust's borrow checker.")
        .await?;
    println!();

    session.destroy().await?;
    client.stop().await?;
    Ok(())
}
