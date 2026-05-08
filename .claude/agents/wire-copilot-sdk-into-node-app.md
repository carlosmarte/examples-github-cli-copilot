---
name: wire-copilot-sdk-into-node-app
description: Detects an existing Node app that needs to call GitHub Copilot programmatically and wires in @github/copilot-sdk via a single canonical entrypoint module (lib/copilot.mjs) with a sendPrompt() helper, ESM normalization, CLI-prerequisite check, and graceful shutdown — instead of letting handlers reinvent client/session lifecycle inline.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Wire Copilot SDK Into Node App

## Pattern Summary

An existing Node app (CLI, server, worker, script collection) needs to call Copilot but has no integration yet, or has it scattered across handlers that each new their own `CopilotClient`, forget to `stop()`, and parse `response.data.content` differently. This skill wires the SDK in once — a single `lib/copilot.mjs` module that owns the client, exposes a `sendPrompt(prompt, opts)` helper, and is the only place that imports `@github/copilot-sdk`. Handlers consume the helper; lifecycle and error shape become invariants instead of per-handler choices.

## Root Cause

`@github/copilot-sdk` looks like a stateless function library on first read, but `CopilotClient` owns a Copilot CLI subprocess. Every `new CopilotClient()` spawns a process; every missing `client.stop()` leaks one. When integration is inlined per handler, you get N clients, N subprocess leaks on uncaught errors, and N copies of `response?.data.content` extraction — usually with at least one written as `response.content` or `response.data` and silently broken. Centralizing into one module with one client (or one client per request, with `try/finally`) makes the lifecycle auditable.

## Detection Signals

This skill applies when the target repo shows:

- A `package.json` with handlers, routes, or commands but no `@github/copilot-sdk` dependency, paired with prose, comments, or issues mentioning Copilot integration as planned/needed
- Multiple files containing `new CopilotClient(` with no shared module — i.e. ad-hoc instantiation per handler
- A `package.json` without `"type": "module"` while the planned integration uses ESM-only imports (the SDK is published as ESM)
- A `lib/`, `src/`, or `internal/` directory with utility modules but no `copilot.*` entrypoint among them
- README or PR description naming Copilot but no `import` of the SDK anywhere

## Validation Steps

Before wiring, characterize the host app:

1. `cat package.json | grep -E '"type"|"engines"|copilot-sdk'` — confirm ESM stance and whether the dep is already present.
2. `grep -rIn "CopilotClient" --include='*.mjs' --include='*.js' --include='*.ts' .` — count call sites. Zero → fresh wire-in. Multiple → consolidate into one module.
3. `find . -type d \( -name lib -o -name src -o -name internal \) -not -path './node_modules/*'` — pick the canonical module directory.
4. `command -v copilot && copilot --version` — confirm the Copilot CLI prerequisite. If missing, the integration cannot be smoke-tested; document the install step in the host README.
5. `node --version` — confirm Node ≥ 20 (top-level `await` and stable ESM).
6. `grep -rIn "process.on('SIGINT'" .` — check whether the host already has a shutdown lane to hook into.

## Remediation Actions

When wiring is confirmed needed, install the dep and add one canonical module:

1. **Add the dependency**: `npm install @github/copilot-sdk`. If the project is CJS-only, switch `package.json` to `"type": "module"` (or namespace the new module as `.mjs` and load it with dynamic `import()` from CJS callers — prefer the former).
2. **Create `lib/copilot.mjs`** (or `src/copilot.mjs`) as the *only* file that imports `CopilotClient`. Export:
   - `getClient()` — lazy singleton; first call constructs `new CopilotClient()`.
   - `sendPrompt(prompt, { model = "gpt-4.1", streaming = false, onDelta } = {})` — opens a session, sends the prompt, returns `response?.data.content`. If `streaming: true`, requires `onDelta` and wires `session.on("assistant.message_delta", onDelta)` plus `session.on("session.idle", …)` to know when to resolve.
   - `shutdown()` — calls `client.stop()` if a client was constructed; idempotent.
3. **Hook shutdown into the host's existing lifecycle**: add `await shutdown()` to whatever the host calls on SIGINT/SIGTERM/process exit. If the host has none, install handlers that call `shutdown()` then `process.exit(code)`.
4. **Migrate any existing inline `new CopilotClient()` call sites** to import `sendPrompt` from `lib/copilot.mjs`. Delete the inline client construction and `client.stop()` calls from the migrated sites.
5. **Add a smoke script** `scripts/copilot-smoke.mjs` that calls `sendPrompt("ping")` and prints the result — wired as `npm run copilot:smoke` — so developers can verify their `copilot --version` auth before debugging handler code.
6. **Document the prereq** in README: install Copilot CLI, run `copilot --version`, then `npm install`. Link `https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started`.

## Prevention Guardrails

- Lint rule (or review checklist): `import { CopilotClient } from "@github/copilot-sdk"` is allowed in exactly one file (`lib/copilot.mjs`). Anywhere else is a finding.
- Every entrypoint that imports `sendPrompt` must register a shutdown hook (process exit / SIGINT / framework `onClose`). Audit by grepping for `sendPrompt` and confirming each importing module is reachable from a shutdown lane.
- The `sendPrompt` helper must always read `response?.data.content` — never `response.content` or `response.data`. Add a unit test that asserts the return type is `string | undefined`.
- If `streaming: true` is passed without an `onDelta` callback, throw at the helper boundary rather than silently dropping deltas.
- Pin `"engines": { "node": ">=20" }` so CJS-targeted forks fail loudly instead of half-importing the ESM-only SDK.

## Cross-Project Application

To assess whether another Node project needs this skill applied:

1. `grep -rIn "@github/copilot-sdk" package.json` — present → check whether call sites are centralized.
2. `grep -rIn "new CopilotClient(" --include='*.mjs' --include='*.js' --include='*.ts' . | wc -l` — > 1 distinct file → consolidation candidate.
3. `grep -rIn "client.stop()" .` — count must equal number of `new CopilotClient(` constructions; mismatch → leak risk.
4. Check the framework: Express, Fastify, Hono, Yargs/Commander CLIs, and worker scripts each have a different idiomatic shutdown hook — wire `shutdown()` into the right one. For request-scoped frameworks, prefer per-request client construction with `try/finally` over a singleton.
5. If the host is a long-running server, prefer a singleton client; if it's a one-shot CLI invocation, prefer per-invocation client + `process.exit(0)` after `stop()`.

## Usage

When invoked against a target Node project:

1. Run the **Detection Signals** checks.
2. For each signal that fires, execute the **Validation Steps** to characterize the host (ESM/CJS, framework, existing shutdown hooks, call-site count).
3. Apply **Remediation Actions** in order — dep install, `lib/copilot.mjs` write, lifecycle hook, migration of inline call sites, smoke script, README update.
4. Recommend applicable **Prevention Guardrails** (single-import rule, return-type assertion, engines pin).
5. Report findings as: PASS (already centralized — refer to `audit-copilot-sdk-wiring` for correctness), WARN (host detected but prerequisites missing — list blockers), or FAIL (wired in, list files added/modified, list inline call sites migrated).
