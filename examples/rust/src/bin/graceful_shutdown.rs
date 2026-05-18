//! 06 — Graceful shutdown
//!
//! `client.stop().await` must run on success, on error, and on SIGINT/SIGTERM,
//! or the underlying Copilot CLI subprocess can leak. `tokio::select!` races
//! the work future against the two signal futures; whichever arm wins, the
//! single trailing `client.stop().await` cleans up before exit.
//!
//! Run: cargo run --bin graceful_shutdown

use github_copilot_sdk::{Client, ClientOptions, SessionConfig};
use tokio::signal::unix::{SignalKind, signal};

async fn run(client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let mut config = SessionConfig::default();
    config.model = Some("gpt-4.1".to_string());
    let session = client.create_session(config).await?;

    if let Some(event) = session
        .send_and_wait(
            "Name three failure modes that show up only in long-running CLI subprocesses.",
        )
        .await?
    {
        if let Some(content) = event.data.get("content").and_then(|v| v.as_str()) {
            println!("{}", content);
        }
    }

    session.destroy().await?;
    Ok(())
}

#[tokio::main]
async fn main() {
    // Disable any user-configured MCP servers so this example runs against
    // the bare SDK surface only.
    unsafe { std::env::set_var("COPILOT_DISABLE_MCP", "1"); }

    let client = match Client::start(ClientOptions::default()).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("client.start failed: {}", e);
            std::process::exit(1);
        }
    };

    let mut sigint = signal(SignalKind::interrupt()).expect("install SIGINT handler");
    let mut sigterm = signal(SignalKind::terminate()).expect("install SIGTERM handler");

    let code = tokio::select! {
        result = run(&client) => match result {
            Ok(()) => 0,
            Err(e) => { eprintln!("session failed: {}", e); 1 }
        },
        _ = sigint.recv() => 130,
        _ = sigterm.recv() => 143,
    };

    if let Err(e) = client.stop().await {
        eprintln!("client.stop() failed: {}", e);
    }
    std::process::exit(code);
}
