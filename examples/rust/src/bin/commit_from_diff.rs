//! 05 — Generate a commit message from staged changes
//!
//! Runs `git diff --cached` and asks Copilot for a Conventional-Commits-style
//! message. Stage some changes first (`git add -p`) before running.
//!
//! Run: cargo run --bin commit_from_diff

use github_copilot_sdk::{Client, ClientOptions, SessionConfig};
use std::process::Command;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new("git").args(["diff", "--cached"]).output()?;
    if !output.status.success() {
        eprintln!("git diff --cached failed (exit {})", output.status);
        std::process::exit(1);
    }
    let diff = String::from_utf8_lossy(&output.stdout).into_owned();
    if diff.trim().is_empty() {
        eprintln!("No staged changes. Run `git add` first.");
        std::process::exit(1);
    }

    let prompt = [
        "Write a Conventional Commits message for the following staged diff.".to_string(),
        "Format: <type>(<scope>): <subject> on the first line, blank line, then a short body."
            .to_string(),
        "Keep the subject under 72 characters. Focus on the *why*, not the *what*.".to_string(),
        String::new(),
        "--- diff ---".to_string(),
        diff,
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
