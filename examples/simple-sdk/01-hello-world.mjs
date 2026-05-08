// 01 — Hello world
//
// The smallest useful Copilot SDK program: open a client, create a session,
// send one prompt, print the answer, shut the client down.
//
// Run: node examples/01-hello-world.mjs

import { CopilotClient } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const response = await session.sendAndWait({ prompt: "What is 2 + 2?" });
console.log(response?.data.content);

await client.stop();
process.exit(0);
