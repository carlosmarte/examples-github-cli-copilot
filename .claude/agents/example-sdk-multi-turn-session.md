---
name: example-sdk-multi-turn-session
description: Port the multi-turn conversation example — one session, sequential prompts where later turns build on earlier answers. Reference is examples/nodejs/simple-sdk/02-multi-turn-conversation.mjs.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Example — SDK Multi-Turn Session

## Pattern Summary

A single session is reused across N sequential prompts so prior turns remain in context and later prompts can refer to earlier answers ("Now write a function for that", "Add a memoized version below the first one"). The pattern is just `for prompt in turns: sendAndWait({prompt})` — but it is non-obvious to beginners who instinctively open a new session per call and lose the conversation history.

## Root Cause

Stateless HTTP APIs train developers to think every request is independent. SDKs that bundle multi-turn state inside a session object invert this expectation: the same session can be sent many prompts and accumulates history, while two sessions opened from the same client see zero shared context. Ports that ignore this distinction either (a) construct a new session per call and silently lose context, or (b) try to manually pass history strings on every call when the SDK already tracks it.

## Detection Signals

- Target-language repo has `01-hello-world` but no follow-up showing session reuse
- An existing port loops over prompts but opens a new session per iteration
- A user asks "how do I make Copilot remember the previous answer" in the target language

## Validation Steps

1. Read `examples/nodejs/simple-sdk/02-multi-turn-conversation.mjs` as reference
2. Confirm the target-language SDK supports calling `sendAndWait` multiple times on the same session without resetting context
3. Confirm `await`/`async` semantics in the target language allow a sequential for-loop over prompts (not parallel — sequence matters)

## Remediation Actions

Port by reproducing:

1. **One client, one session** — construct both outside the loop
2. **A list of related prompts** — at least three turns where turn N references the answer from turn N−1 (the reference uses Fibonacci description → implementation → memoized variant)
3. **Sequential await in a loop** — `for prompt in turns: response = await session.sendAndWait({prompt}); print(response)`. Do NOT use `Promise.all` / `gather` / parallel constructs; parallelism breaks turn ordering
4. **Print each prompt + response together** — the reference prefixes prompts with `>>>` so the output shows the conversational arc
5. **Single `stop()` after the loop** — not inside it

## Prevention Guardrails

- Naming: `02-multi-turn-conversation.<ext>` — second numbered example, after hello-world
- Reviewer checklist: zero `createSession` calls inside the loop; zero parallel-await constructs; at least one prompt referring to a prior answer to prove context retention
- A test that compares the third response against a sentinel from the first answer can detect lost context regressions

## Cross-Project Application

1. Search the target SDK's docs for "session", "thread", "conversation" — note the documented stateful unit
2. Find any existing port loop; verify it opens the session once
3. Look for evidence the example exercises multi-turn (prompts that semantically depend on prior turns), not just N independent queries

## Usage

When invoked with a target language:

1. Run **Detection Signals**
2. Read the reference `02-multi-turn-conversation.mjs`
3. Emit a target-language port following **Remediation Actions** step-for-step
4. Apply **Prevention Guardrails** — sequential loop, single session, single stop
5. Report PASS / WARN / FAIL with evidence
