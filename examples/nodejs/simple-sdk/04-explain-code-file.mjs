// 04 — Explain a code file
//
// Read a file from disk and ask Copilot for a plain-English explanation.
//
// Run: node examples/04-explain-code-file.mjs <path-to-source-file>
// e.g. node examples/04-explain-code-file.mjs examples/01-hello-world.mjs

import { readFile } from "node:fs/promises";
import { CopilotClient } from "@github/copilot-sdk";

// Disable any user-configured MCP servers so this example runs against the
// bare SDK surface only.
process.env.COPILOT_DISABLE_MCP = "1";

const target = process.argv[2];
if (!target) {
  console.error("usage: node examples/04-explain-code-file.mjs <file>");
  process.exit(1);
}

const source = await readFile(target, "utf8");

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const prompt = [
  `Explain what this file does in 4-6 bullet points.`,
  `Call out anything subtle (race conditions, hidden side effects, error swallowing).`,
  ``,
  `--- ${target} ---`,
  source,
].join("\n");

const response = await session.sendAndWait({ prompt });
console.log(response?.data.content);

await client.stop();
process.exit(0);
