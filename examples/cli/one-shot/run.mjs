// One-shot — Node ESM driver for the `copilot` CLI
//
// Spawns `copilot -p "<prompt>" --allow-all-tools` as a child process,
// inherits stdio so the result streams straight to the parent terminal, and
// forwards the exit code. CLI-driven counterpart of
// examples/nodejs/simple-sdk/01-hello-world.mjs.
//
// Pattern reference: CLI.md §1.
//
// Run:
//   node run.mjs
//   node run.mjs "Summarize the last 5 git commits as a markdown list"

import { spawn } from "node:child_process";

const prompt = process.argv[2] ?? "What is 2 + 2? Reply with only the digit.";

const child = spawn(
  "copilot",
  ["-p", prompt, "--allow-all-tools"],
  { stdio: "inherit" },
);

child.on("error", (err) => {
  console.error(`failed to spawn copilot: ${err.message}`);
  process.exit(127);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
