//! 01 — Hello world
//!
//! The smallest useful Copilot SDK program: open a client, create a session,
//! send one prompt, print the answer, shut the client down.
//!
//! Run: cargo run --bin hello_world

use github_copilot_sdk::{Client, ClientOptions, SessionConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::start(ClientOptions::default()).await?;

    let mut config = SessionConfig::default();
    config.model = Some("gpt-4.1".to_string());
    let session = client.create_session(config).await?;

    if let Some(event) = session.send_and_wait("What is 2 + 2?").await? {
        if let Some(content) = event.data.get("content").and_then(|v| v.as_str()) {
            println!("{}", content);
        }
    }

    session.destroy().await?;
    client.stop().await?;
    Ok(())
}
