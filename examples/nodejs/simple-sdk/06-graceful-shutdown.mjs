// 06 — Graceful shutdown
//
// `client.stop()` must run even if the prompt throws, otherwise the underlying
// Copilot CLI process can be left alive. Wrap the work in try/finally and also
// hook SIGINT so Ctrl-C does the same cleanup.
//
// Run: node examples/06-graceful-shutdown.mjs

import { CopilotClient } from "@github/copilot-sdk";

// Disable any user-configured MCP servers so this example runs against the
// bare SDK surface only.
process.env.COPILOT_DISABLE_MCP = "1";

const client = new CopilotClient();

const shutdown = async (code = 0) => {
  try {
    await client.stop();
  } catch (err) {
    console.error("client.stop() failed:", err);
  }
  process.exit(code);
};

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

try {
  const session = await client.createSession({ model: "gpt-4.1" });
  const response = await session.sendAndWait({
    prompt: "Name three failure modes that show up only in long-running CLI subprocesses.",
  });
  console.log(response?.data.content);
} catch (err) {
  console.error("session failed:", err);
  await shutdown(1);
}

await shutdown(0);
