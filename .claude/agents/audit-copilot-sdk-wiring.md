---
name: audit-copilot-sdk-wiring
description: Audits an existing @github/copilot-sdk integration for the canonical correctness checks — missing client.stop(), streaming:true without an assistant.message_delta subscriber, response.content vs response.data.content misuse, CJS/ESM mismatch, missing copilot CLI prerequisite, multi-client subprocess leaks — and emits a per-file PASS / WARN / FAIL report with remediation patches.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Audit Copilot SDK Wiring

## Pattern Summary

A repo has already adopted `@github/copilot-sdk` but the integration is suspected of correctness defects: subprocess leaks from missing `client.stop()`, deltas dropped because `streaming: true` was passed without subscribing to `assistant.message_delta`, return values silently `undefined` because the caller read `response.content` instead of `response.data.content`, or the host being CJS while the SDK is ESM-only. This skill runs each check, classifies findings, and emits remediation patches.

## Root Cause

The SDK's surface is small but its failure modes are quiet. None of these defects throw at integration time:

- Missing `client.stop()` leaks a Copilot CLI subprocess; the parent process exits but `ps` still shows children for one tick — easily missed in dev, painful in long-running servers.
- `streaming: true` without a delta subscriber works (the `sendAndWait` promise still resolves), but throws away the streaming UX the caller asked for.
- `response.content` is `undefined` (the real path is `response.data.content`); the caller logs an empty string and chases ghosts.
- CJS hosts get an `ERR_REQUIRE_ESM` only when the import line first executes — often inside a route handler that's never hit in unit tests.

Because none of these are loud, they survive PR review and only surface in production. A standing audit that runs each check is the cheapest backstop.

## Detection Signals

Run these greps over the target repo (excluding `node_modules`):

- `grep -rIn "new CopilotClient(" --include='*.mjs' --include='*.js' --include='*.ts'` — every hit is a client-lifetime call site to audit.
- `grep -rIn "streaming: true" --include='*.mjs' --include='*.js' --include='*.ts'` — every hit must be paired with a `session.on("assistant.message_delta"` in the same file.
- `grep -rIn "response\.content\b" --include='*.mjs' --include='*.js' --include='*.ts'` — likely a misread of the response shape; correct path is `response?.data.content`.
- `grep -rIn "require(['\"]@github/copilot-sdk['\"])" --include='*.js' --include='*.cjs'` — the SDK is ESM; CJS `require()` will fail.
- `grep -rIn "@github/copilot-sdk" package.json` while `grep -rIn '"type"' package.json` does NOT show `"module"` and the importing files are `.js` (not `.mjs`) — likely CJS/ESM mismatch.
- `grep -rIln "CopilotClient" --include='*.mjs' --include='*.js' --include='*.ts'` count > 1 distinct module — possible subprocess fan-out.

## Validation Steps

For each signal, confirm the defect:

1. **Stop-call accounting.** For each file with `new CopilotClient(`, grep the same file for `client.stop()` (or `await this.client?.stop()` for class-wrapped variants). Constructions without a matching `stop()` on every code path (including the `catch` branch) → FAIL.
2. **Streaming subscriber pairing.** For each file that passes `streaming: true`, grep for `session.on("assistant.message_delta"` in the same module. Absent → FAIL ("streaming without delta subscriber"). Present but no `session.on("session.idle"` → WARN ("no idle handler — caller cannot tell when response is complete").
3. **Response shape.** For each `response.content` or `response.data` read (where the next dotted segment isn't `.content`), confirm against the docs: the correct path is `response?.data.content`. Mismatch → FAIL.
4. **CJS/ESM.** If `package.json` has `@github/copilot-sdk` but `"type": "module"` is absent and the importer is `.js` rather than `.mjs`, run `node -e "require('@github/copilot-sdk')"` from the repo root. Throws `ERR_REQUIRE_ESM` → FAIL.
5. **CLI prerequisite.** Run `command -v copilot && copilot --version`. Missing → WARN (host machine cannot smoke-test; CI must install the CLI).
6. **Subprocess fan-out.** Count distinct files containing `new CopilotClient(`. > 1 → WARN ("each client owns a CLI subprocess; consider centralizing in `lib/copilot.mjs` per `wire-copilot-sdk-into-node-app`").
7. **Idempotent shutdown.** Search for SIGINT/SIGTERM handlers; confirm they call `stop()` and survive being invoked twice (e.g. SIGINT during shutdown). Missing → WARN.

## Remediation Actions

For each confirmed defect:

1. **FAIL: missing stop()** — wrap the work in `try { … } finally { await client.stop(); }`. If the construction is per-request, this is sufficient. If it's a singleton, also register a SIGINT/SIGTERM handler that awaits `stop()` before `process.exit()`.
2. **FAIL: streaming without delta subscriber** — either drop `streaming: true` (the caller didn't actually need streaming) OR add `session.on("assistant.message_delta", (event) => process.stdout.write(event?.data?.content ?? ""))` plus a `session.on("session.idle", …)` resolver. Pick based on whether the caller is interactive.
3. **FAIL: `response.content` misread** — change to `response?.data.content`. Add a unit test that asserts the return is `string | undefined`, not `undefined` for known-good prompts.
4. **FAIL: CJS/ESM mismatch** — set `"type": "module"` in `package.json` and rename `.js` importers to `.mjs` (or leave them `.js` since type:module makes them ESM). If the host *must* stay CJS, hide the SDK behind a dynamic `import()` inside an `async` boundary.
5. **WARN: missing CLI** — add a Setup section to README pointing at the Copilot CLI install docs; in CI, install the CLI in the workflow before `npm test`.
6. **WARN: subprocess fan-out** — invoke `wire-copilot-sdk-into-node-app` to consolidate into `lib/copilot.mjs`.
7. **WARN: missing idle handler in streaming** — add `session.on("session.idle", resolve)` so the caller can await response completion deterministically.
8. **WARN: non-idempotent shutdown** — guard `stop()` with a `stopped` boolean (or check `client[Symbol.for("stopped")]`) so double-SIGINT during shutdown doesn't throw.

## Prevention Guardrails

- ESLint custom rule (or grep-based pre-commit hook): `new CopilotClient(` and `client.stop()` counts must match per file.
- ESLint custom rule: `streaming: true` in any `createSession` call requires `session.on("assistant.message_delta"` in the same file.
- TypeScript users: type the response as `{ data: { content: string } } | undefined` and let `tsc` reject `response.content`.
- CI step: `node -e "import('@github/copilot-sdk').then(() => process.exit(0))"` to assert the package loads under the host's `package.json` settings before running any tests.
- README must document the Copilot CLI install + `copilot --version` step; CI must install the CLI before tests that exercise the SDK.

## Cross-Project Application

To assess any project for this audit:

1. Confirm `@github/copilot-sdk` is in `package.json` dependencies. Absent → not in scope (use `scaffold-copilot-sdk-integration` or `wire-copilot-sdk-into-node-app`).
2. Walk every detection grep; tally hits per file; classify each per the validation steps.
3. For polyglot monorepos, scope the audit to the JS/TS workspace(s) — Python or Go siblings won't be using this SDK.
4. For server frameworks (Express, Fastify, Hono), additionally check that the framework's `onClose` / shutdown hook awaits the SDK's `stop()`. The framework will exit before the SDK's subprocess does otherwise.
5. For test suites, ensure the SDK is mocked at the module boundary — calling the real SDK in unit tests means tests fail without `copilot --version`.

## Usage

When invoked against a target project:

1. Run all **Detection Signals** greps and tally per-file hits.
2. For each hit, execute the matching **Validation Step** to confirm or rule out.
3. For each confirmed defect, apply the matching **Remediation Action** (or recommend it, if the user wants a report-only pass).
4. Recommend applicable **Prevention Guardrails** for any FAIL/WARN that landed.
5. Report findings as a per-file table:
   - **PASS** — file imports the SDK correctly, all stop() calls accounted for, streaming subscribers paired, response shape correct.
   - **WARN** — non-blocking issues (missing idle handler, subprocess fan-out, missing CLI on host, non-idempotent shutdown).
   - **FAIL** — confirmed defects (missing stop(), streaming without delta, response.content misread, CJS/ESM mismatch).
   Include `path:lineno` evidence for every finding so the user can navigate directly.
