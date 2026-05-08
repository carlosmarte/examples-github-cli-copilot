// 05 — Generate a commit message from staged changes
//
// Pipes `git diff --cached` into Copilot and asks for a Conventional-Commits
// style message. Stage some changes first (`git add -p`) before running.
//
// Run: node examples/05-commit-message-from-diff.mjs

import { execSync } from "node:child_process";
import { CopilotClient } from "@github/copilot-sdk";

const diff = execSync("git diff --cached", { encoding: "utf8" });
if (!diff.trim()) {
  console.error("No staged changes. Run `git add` first.");
  process.exit(1);
}

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const prompt = [
  `Write a Conventional Commits message for the following staged diff.`,
  `Format: <type>(<scope>): <subject> on the first line, blank line, then a short body.`,
  `Keep the subject under 72 characters. Focus on the *why*, not the *what*.`,
  ``,
  `--- diff ---`,
  diff,
].join("\n");

const response = await session.sendAndWait({ prompt });
console.log(response?.data.content);

await client.stop();
process.exit(0);
