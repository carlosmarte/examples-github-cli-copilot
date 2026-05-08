---
name: scaffold-copilot-sdk-integration
description: Greenfield scaffold of a Node ESM project that integrates with @github/copilot-sdk — package.json, examples/, README, and the six canonical usage patterns (hello, multi-turn, streaming, file-explainer, commit-message, graceful-shutdown).
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Scaffold Copilot SDK Integration

## Pattern Summary

A repo wants to call GitHub Copilot programmatically but has no SDK wiring at all — no `@github/copilot-sdk` dependency, no examples, no docs. Without a canonical starting layout, every consumer reinvents the same six patterns (hello-world, multi-turn, streaming, file-explainer, commit-message-from-diff, graceful-shutdown), usually getting one or two of them wrong (e.g. forgetting `client.stop()`, or setting `streaming: true` without subscribing to delta events). This skill emits a known-good greenfield layout in one shot.

## Root Cause

`@github/copilot-sdk` is thin and ergonomic, but it depends on the GitHub Copilot CLI subprocess being installed and authenticated, and on the host runtime being ESM. New projects that skip either prerequisite (CJS-only `package.json`, missing `copilot --version`, ad-hoc one-off scripts) hit the same class of failures: subprocess-leak on uncaught throws, `import` syntax errors, and `response.data.content` being read as `response.content`. Scaffolding all six canonical patterns up front establishes the conventions before the first real handler is written.

## Detection Signals

This skill applies when the target repo:

- Has no `@github/copilot-sdk` entry in any `package.json`
- Has no `examples/` directory referencing `CopilotClient`
- Mentions Copilot in `README.md` / issues / PR descriptions but contains no actual SDK calls
- Is empty or contains only a stub `README.md` plus `.git/`

## Validation Steps

Before scaffolding, confirm greenfield state and prerequisites:

1. `git ls-files | head` — confirm the repo is empty or stub-only
2. `grep -rIn "@github/copilot-sdk" --include='package.json' .` — must return zero matches
3. `grep -rIn "CopilotClient" --include='*.mjs' --include='*.js' --include='*.ts' .` — must return zero matches
4. `command -v copilot && copilot --version` — confirm the CLI is installed (warn if not; do not block scaffolding)
5. `node --version` — confirm Node ≥ 20 for top-level `await`

## Remediation Actions

When greenfield is confirmed, scaffold the canonical layout:

1. **`package.json`** — `"type": "module"`, `"engines": { "node": ">=20" }`, `"@github/copilot-sdk": "*"` dep, one `ex:*` script per example.
2. **`examples/01-hello-world.mjs`** — minimal `new CopilotClient()` → `createSession({ model: "gpt-4.1" })` → `sendAndWait` → `client.stop()` → `process.exit(0)`.
3. **`examples/02-multi-turn-conversation.mjs`** — single session, `for` loop of sequential `sendAndWait` calls, prompts that reference earlier turns.
4. **`examples/03-streaming-deltas.mjs`** — `createSession({ model, streaming: true })` plus `session.on("assistant.message_delta", …)` to print chunks and `session.on("session.idle", …)` to know when done.
5. **`examples/04-explain-code-file.mjs`** — `process.argv[2]` path → `readFile` → ask Copilot to explain in 4–6 bullets.
6. **`examples/05-commit-message-from-diff.mjs`** — `execSync("git diff --cached")` → ask for Conventional Commits message; abort if empty diff.
7. **`examples/06-graceful-shutdown.mjs`** — `try/finally` around the work, plus `SIGINT`/`SIGTERM` handlers calling `client.stop()`.
8. **`README.md`** — table of examples, setup instructions (install Copilot CLI + `npm install`), the documented API surface, and the responding shape `response?.data.content`.

## Prevention Guardrails

- Pin `"engines": { "node": ">=20" }` in `package.json` so CJS-only consumers are flagged early.
- Set `"type": "module"` so all `.js` files are ESM by default; use `.mjs` for unambiguity.
- Every example must end with `await client.stop()` before `process.exit` — make this a review checklist item.
- README must link `https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started` so future readers can verify the API surface against the canonical doc.
- Prefer top-level `await` (Node ≥ 20) over wrapping every example in `async function main()` — fewer footguns, simpler reading.

## Cross-Project Application

To assess whether another project should adopt this scaffold:

1. Look for `package.json` `dependencies` or `devDependencies` containing `@github/copilot-sdk`. Absent → candidate for scaffold. Present → switch to `wire-copilot-sdk-into-node-app` or `audit-copilot-sdk-wiring`.
2. Check for any `*.{mjs,js,ts}` file importing `CopilotClient`. Zero hits → greenfield.
3. Confirm the repo's runtime: if it's a Python or Rust project, this skill does not apply.
4. If `copilot --version` fails on the developer machine, add a Setup section in the README that links to the CLI install docs before scaffolding examples that depend on it.

## Usage

When invoked against a target project:

1. Run the **Detection Signals** checks against the target.
2. For each signal that fires, execute the **Validation Steps**.
3. If greenfield is confirmed, apply **Remediation Actions** to write the eight files.
4. Recommend applicable **Prevention Guardrails** (engines pin, type:module, stop() checklist).
5. Report findings as: PASS (already wired — skill does not apply), WARN (partial wiring — defer to `wire-copilot-sdk-into-node-app`), or FAIL (greenfield — scaffold applied, list files written).
