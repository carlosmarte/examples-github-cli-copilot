// 02 — Multi-turn conversation
//
// One session, multiple sequential prompts. The session keeps prior turns as
// context, so the second prompt can refer to the first answer.
//
// Run: node examples/02-multi-turn-conversation.mjs

import { CopilotClient } from "@github/copilot-sdk";

// Disable any user-configured MCP servers so this example runs against the
// bare SDK surface only.
process.env.COPILOT_DISABLE_MCP = "1";

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const turns = [
  "Give me a one-line description of the Fibonacci sequence.",
  "Now write a JavaScript function that returns the nth Fibonacci number.",
  "Add a memoized version below the first one.",
];

for (const prompt of turns) {
  console.log(`\n>>> ${prompt}\n`);
  const response = await session.sendAndWait({ prompt });
  console.log(response?.data.content);
}

await client.stop();
process.exit(0);
