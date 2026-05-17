// Few-shot — Node ESM driver for the `copilot` CLI
//
// The Copilot CLI does not accept inline `--agents '<json>'`; instead, an
// `@<path>` token inside the prompt is replaced at launch by the contents of
// that file. We inject `prompts/cleaner.md` — which carries Input → Output
// examples — and append the user snippet beneath it. Pattern reference:
// CLI.md §3.
//
// Run from this directory so the relative `@./prompts/cleaner.md` resolves:
//   node run.mjs
//   node run.mjs "try { fs.readFile(p); } catch(e) { console.log(e); }"

import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(dirname(fileURLToPath(import.meta.url)));

const snippet = process.argv[2] ?? "try { db.connect(); } catch(e) { console.log(e); }";

const prompt = [
  "@./prompts/cleaner.md",
  "",
  "Snippet to rewrite:",
  snippet,
].join("\n");

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
