//! 04 — Explain a code file
//!
//! Read a file from disk and ask Copilot for a plain-English explanation.
//!
//! Run: cargo run --bin explain_code_file -- <path-to-source-file>
//! e.g. cargo run --bin explain_code_file -- src/bin/hello_world.rs

use github_copilot_sdk::{Client, ClientOptions, SessionConfig};
use std::env;
use std::fs;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 || args[1].is_empty() {
        eprintln!("usage: cargo run --bin explain_code_file -- <file>");
        std::process::exit(1);
    }
    let target = PathBuf::from(&args[1]);
    let source = fs::read_to_string(&target)?;

    let prompt = [
        "Explain what this file does in 4-6 bullet points.".to_string(),
        "Call out anything subtle (race conditions, hidden side effects, error swallowing)."
            .to_string(),
        String::new(),
        format!("--- {} ---", target.display()),
        source,
    ]
    .join("\n");

    let client = Client::start(ClientOptions::default()).await?;
    let mut config = SessionConfig::default();
    config.model = Some("gpt-4.1".to_string());
    let session = client.create_session(config).await?;

    if let Some(event) = session.send_and_wait(prompt).await? {
        if let Some(content) = event.data.get("content").and_then(|v| v.as_str()) {
            println!("{}", content);
        }
    }

    session.destroy().await?;
    client.stop().await?;
    Ok(())
}
