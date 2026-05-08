// 03 — Streaming deltas
//
// Set `streaming: true` on the session and subscribe to `assistant.message_delta`
// to print chunks as they arrive. `session.idle` fires when the response is
// complete and the session is ready for the next prompt.
//
// Run: node examples/03-streaming-deltas.mjs

import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1", streaming: true });

const offDelta = session.on("assistant.message_delta", (event) => {
  process.stdout.write(event?.data?.content ?? "");
});

const idle = new Promise((resolve) => {
  const offIdle = session.on("session.idle", () => {
    offIdle();
    resolve();
  });
});

await session.sendAndWait({
  prompt: "Write a haiku about garbage collection in JavaScript.",
});
await idle;

offDelta();
process.stdout.write("\n");

await client.stop();
process.exit(0);
