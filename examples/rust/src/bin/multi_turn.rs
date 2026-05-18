//! 02 — Multi-turn conversation
//!
//! One session, multiple sequential prompts. The session keeps prior turns as
//! context, so the second prompt can refer to the first answer.
//!
//! Run: cargo run --bin multi_turn

use github_copilot_sdk::{Client, ClientOptions, SessionConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Disable any user-configured MCP servers so this example runs against
    // the bare SDK surface only.
    unsafe { std::env::set_var("COPILOT_DISABLE_MCP", "1"); }

    let turns = [
        "Give me a one-line description of the Fibonacci sequence.",
        "Now write a Rust function that returns the nth Fibonacci number.",
        "Add a memoized version below the first one.",
    ];

    let client = Client::start(ClientOptions::default()).await?;

    let mut config = SessionConfig::default();
    config.model = Some("gpt-4.1".to_string());
    let session = client.create_session(config).await?;

    for prompt in turns {
        println!("\n>>> {}\n", prompt);
        if let Some(event) = session.send_and_wait(prompt).await? {
            if let Some(content) = event.data.get("content").and_then(|v| v.as_str()) {
                println!("{}", content);
            }
        }
    }

    session.destroy().await?;
    client.stop().await?;
    Ok(())
}
