// ExpressJS — Copilot SDK request handler
//
// Boots a single CopilotClient at startup, then for each incoming request opens
// a fresh session, forwards the request body's `prompt` (default: "What is 2 + 2?"),
// extracts the assistant's text from `response.data.content`, and returns it as JSON.
//
// Run:
//   npm install
//   node server.mjs
//
// Try:
//   curl -s localhost:3000/ask
//   curl -s -X POST localhost:3000/ask -H 'content-type: application/json' \
//        -d '{"prompt":"What is 2 + 2?"}'

import express from "express";
import { CopilotClient } from "@github/copilot-sdk";

// Disable any user-configured MCP servers so this example runs against the
// bare SDK surface only.
process.env.COPILOT_DISABLE_MCP = "1";

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.COPILOT_MODEL || "gpt-4.1";

const client = new CopilotClient();

const app = express();
app.use(express.json());

async function ask(prompt) {
  const session = await client.createSession({ model: MODEL });
  const response = await session.sendAndWait({ prompt });
  return response?.data?.content ?? "";
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", model: MODEL });
});

app.all("/ask", async (req, res) => {
  const prompt =
    (req.body && typeof req.body.prompt === "string" && req.body.prompt) ||
    (typeof req.query.prompt === "string" && req.query.prompt) ||
    "What is 2 + 2?";
  try {
    const answer = await ask(prompt);
    res.json({ prompt, answer });
  } catch (err) {
    res.status(500).json({ error: "copilot_failed", message: String(err?.message ?? err) });
  }
});

const server = app.listen(PORT, () => {
  console.log(`express listening on :${PORT} (model=${MODEL})`);
});

const shutdown = async (code = 0) => {
  server.close();
  try {
    await client.stop();
  } catch (err) {
    console.error("client.stop() failed:", err);
  }
  process.exit(code);
};

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));
