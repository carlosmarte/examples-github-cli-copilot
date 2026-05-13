---
name: example-sdk-streaming-response
description: Port the streaming-deltas example — `streaming: true` on the session, subscribe to delta events for live chunks, await an idle signal to know the response is complete. Reference is examples/nodejs/simple-sdk/03-streaming-deltas.mjs.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Example — SDK Streaming Response

## Pattern Summary

Streaming SDKs deliver an assistant response as a sequence of incremental delta events (`assistant.message_delta`) plus a terminal idle event (`session.idle`). The example opens the session with `streaming: true`, subscribes to deltas with an unsubscribe handle, awaits the idle event explicitly, then writes a trailing newline and shuts down. The non-obvious part is the two-channel flow: `sendAndWait` returns but the *deltas* arrive on the side channel; the response is only truly done after `session.idle` fires.

## Root Cause

Most beginners expect `sendAndWait` to return the full content when streaming is enabled. In practice, when `streaming: true` is set, the return value is often empty or only the final chunk — the actual text was already delivered piecewise via the event subscription. Ports that mix the two models (set `streaming: true` AND read `response.data.content` as if it were a blocking call) print nothing or a fragment, and the user concludes streaming is broken.

## Detection Signals

- Target-language repo has streaming docs but the example reads from `sendAndWait`'s return value
- Existing port sets `streaming: true` but does not subscribe to a delta event
- Existing port subscribes to deltas but does not await an idle / done signal — output is truncated when the process exits early

## Validation Steps

1. Read `examples/nodejs/simple-sdk/03-streaming-deltas.mjs`
2. Confirm the target-language SDK exposes:
   - A `streaming: true` option on session creation
   - An event-subscribe primitive (`session.on(event, handler)`, callback registry, async iterator, etc.)
   - The two named events: delta-chunk event and session-idle event
3. Confirm the target language has a way to express "promise resolves when event fires" (Promise + once, asyncio.Event, channel, Future, etc.)

## Remediation Actions

Port by reproducing the dual-channel flow:

1. **Open session with streaming flag** — `{model: "gpt-4.1", streaming: true}` (or named equivalent)
2. **Subscribe to delta event** — handler writes `event.data.content` to stdout *without* trailing newline; capture the unsubscribe handle for later cleanup
3. **Build an idle-completion promise** — wrap the idle subscription so the outer code can `await` it. The handler must unsubscribe itself on first fire (idle should land exactly once per turn)
4. **Send the prompt** — `await session.sendAndWait({prompt})`. Do NOT read the return value for content
5. **Await the idle promise** — only after this resolves is the response truly complete
6. **Clean up** — call the delta-unsubscribe handle, write a trailing newline (the streamed content has no implicit one), then `client.stop()`

## Prevention Guardrails

- Naming: `03-streaming-deltas.<ext>` — third numbered example
- Reviewer checklist: streaming flag set; delta subscription present; idle awaited explicitly; unsubscribe called; no read of `sendAndWait`'s return for content
- Smoke test: pipe stdout through a "saw at least 2 chunks" detector; non-streamed content would arrive as one block

## Cross-Project Application

1. Find the target SDK's event registry — what events does it document for streaming?
2. Identify the delta event name and the terminal event name (some SDKs use `done`, `complete`, `finish` instead of `idle`)
3. Map the JS Promise-from-event pattern to the target language's idiom (`asyncio.Event.wait()`, channel recv, `tokio::sync::oneshot`)

## Usage

When invoked with a target language:

1. Run **Detection Signals**
2. Read the reference `03-streaming-deltas.mjs`
3. Emit a target-language port following **Remediation Actions**
4. Apply **Prevention Guardrails** — confirm idle awaited and deltas printed
5. Report PASS / WARN / FAIL
