---
name: example-sdk-minimal-roundtrip
description: Port the smallest viable Copilot-SDK example to a target language — one client, one session, one prompt, one shutdown. Reference is examples/nodejs/simple-sdk/01-hello-world.mjs.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Example — SDK Minimal Roundtrip

## Pattern Summary

The smallest useful program against a chat-style SDK: construct a client, open a session with an explicit model, send one prompt, await the full response, read the assistant content, shut the client down. This is the canonical "hello world" for any SDK port and the foundational shape every other example builds on. Each step is mandatory — skipping `stop()` leaks a subprocess; skipping the model selector pins the user to whatever the SDK defaults to; reading `response.content` instead of the nested `response.data.content` returns undefined silently.

## Root Cause

SDKs that shell out to a long-running CLI subprocess separate process lifetime from session lifetime, and separate session state from response payload. Beginners typically conflate all three — they treat `client` as stateless, omit `stop()` because nothing visibly breaks, and reach into the response with the first key they find. Ports that ship without all four steps (construct → session → send → stop) drift into the same defects in every language.

## Detection Signals

This skill applies when:

- The user asks for a "hello world" / "smoke test" / "minimal example" port of the Copilot SDK in a language other than Node ESM
- A target-language repo has the SDK installed but no smallest-possible-roundtrip example yet
- An existing port skips `client.stop()` (or its target-language equivalent) and the subprocess leaks across runs

## Validation Steps

Before porting, confirm the target language has the four primitives:

1. Read `examples/nodejs/simple-sdk/01-hello-world.mjs` as the reference shape
2. Confirm the target language has an SDK binding (or an HTTP-level fallback) exposing: client constructor, `createSession({model})`, `sendAndWait({prompt})`, `stop()` (or close/dispose)
3. Confirm the target language has a top-level-await equivalent (async main, `asyncio.run`, `tokio::main`, etc.) — synchronous languages need an explicit `main()` wrapper
4. Confirm `response.data.content` (or its named-field equivalent in a typed SDK) is the documented payload path; reject ports that read `response.content`

## Remediation Actions

Port the example by reproducing each numbered step from the reference, in order:

1. **Import / construct client** — the target language's idiomatic constructor (`CopilotClient()` in JS, `CopilotClient()` in Python, `copilot.NewClient()` in Go, etc.)
2. **Create session with explicit model** — pass `model: "gpt-4.1"` (or current canonical default) as a named arg; do not let it default
3. **Send one prompt, await full response** — block until complete; do not introduce streaming at this stage (that is `example-sdk-streaming-response`)
4. **Read `response.data.content` (or named-field equivalent)** — use the language's null-safe accessor (`?.` in JS, `getattr(.., "content", None)` in Python, optional-chain in Swift) so a missing field surfaces a clear error, not a crash
5. **Shut the client down** — call `stop()` / `close()` / `dispose()` even on the success path; mirror Node's explicit `process.exit(0)` so the process does not hang on a still-open subprocess handle
6. **No try/catch yet** — the minimal example deliberately lets failures throw. Robust shutdown belongs in `example-sdk-graceful-shutdown`, not here

## Prevention Guardrails

- Every port directory MUST contain `01-hello-world.<ext>` as the first numbered example before any other example file lands
- A `--version` smoke check (call the underlying CLI, confirm it answers) belongs in a README prerequisite, not in the script itself — keep the minimal example minimal
- CI smoke step: run the hello-world example with a recorded mock backend (or skip if no credentials) — it must complete in < 5 s and exit 0
- Reviewer checklist: no `try/catch`, no signal handlers, no streaming flags, no env-var branching in `01-*` — those belong in their own examples

## Cross-Project Application

To find or port this pattern in another SDK / project:

1. Locate the SDK's documented "getting started" page; identify the four primitives (construct, open, send, close)
2. Search the repo for a file matching `01-hello-world.*`, `hello.*`, or `minimal.*` — if absent, scaffold one
3. Check for the four anti-patterns in any existing minimal example: missing `stop()`, missing model arg, wrong payload path, swallowed errors

## Usage

When invoked with a target language and an output directory:

1. Run **Detection Signals** — confirm the port is wanted and a hello-world doesn't already exist
2. Read the reference `01-hello-world.mjs` to lock in the shape
3. For each **Remediation Actions** step, emit the target-language equivalent
4. Apply **Prevention Guardrails** — confirm the new file numbering, naming, and minimality
5. Report findings as: PASS (port written and runs to completion), WARN (port written but prerequisites unverified), or FAIL (target language missing a required primitive)
