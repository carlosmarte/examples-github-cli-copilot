---
name: example-sdk-graceful-shutdown
description: Port the graceful-shutdown example — `client.stop()` must run on success, on throw, and on SIGINT/SIGTERM, so the underlying CLI subprocess never leaks. Reference is examples/nodejs/simple-sdk/06-graceful-shutdown.mjs.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Example — SDK Graceful Shutdown

## Pattern Summary

Any SDK that owns a child subprocess (a CLI, a daemon, a worker pool) needs three independent paths to `stop()`: the success path, the exception path, and the signal-interrupted path (Ctrl-C / SIGTERM). The example wraps the work in `try/catch`, defines a `shutdown(code)` helper that wraps `stop()` in its own try/catch (so a failing stop never masks the original exit code), and installs SIGINT/SIGTERM handlers that call the helper. The non-obvious move is making `shutdown` itself fault-tolerant — if `stop()` throws, the helper logs and exits anyway rather than hanging waiting for cleanup.

## Root Cause

A naive shutdown is `await stop()` at the end of `main` — fine on the happy path, broken when any prior `await` throws, broken when the user hits Ctrl-C. Each missed path leaves a CLI subprocess running, which holds an auth token, a port, or a session file. The leaked subprocesses accumulate across runs and the user eventually notices when they hit a fd / port / auth limit, by which point the cause is buried under hours of unrelated activity.

## Detection Signals

- Target-language repo has SDK examples but none demonstrating signal handling
- Existing port calls `stop()` at the end of main with no `try/finally` wrapping
- Existing port has signal handlers but they call `process.exit()` directly without first invoking the SDK's stop
- An ops report mentions accumulated subprocesses, leaked sessions, or port-in-use errors on repeated runs

## Validation Steps

1. Read `examples/nodejs/simple-sdk/06-graceful-shutdown.mjs`
2. Confirm the target language has:
   - A try/catch (try/except, defer + recover, etc.) that runs cleanup on exception
   - Signal-handler registration (`signal.signal` in Python, `signal.Notify` channel in Go, `tokio::signal` in Rust)
   - A way to call async cleanup from a sync signal handler (Python: `loop.add_signal_handler`; Go: signal channel + goroutine)
3. Confirm the target language's process-exit primitive (`process.exit`, `sys.exit`, `os.Exit`, `std::process::exit`) accepts a numeric code

## Remediation Actions

Port by reproducing the three-path discipline:

1. **Construct the client outside the try block** — it must be reachable from the catch and from signal handlers
2. **Define a `shutdown(code)` helper** that:
   - Awaits `client.stop()` inside its own try/catch
   - Logs the stop failure but does not re-throw (do not mask the original exit reason)
   - Calls process-exit with the passed code
3. **Register signal handlers BEFORE doing the SDK work** — SIGINT → `shutdown(130)`, SIGTERM → `shutdown(143)` (use the language's standard interrupted-by-signal exit codes if it has them)
4. **Wrap the SDK work in try/catch** — on success: `await shutdown(0)`; on error: log the error, then `await shutdown(1)`
5. **No path skips `shutdown`** — even an early `usage:` exit should route through it once the client is constructed

## Prevention Guardrails

- Naming: `06-graceful-shutdown.<ext>` — sixth numbered example, after all the simple roundtrip variants
- Reviewer checklist: shutdown helper present; SIGINT + SIGTERM both handled; helper wraps `stop()` in its own try/catch; no path bypasses the helper
- Smoke test: spawn the example, send SIGINT after 1 s, confirm the child process count is zero within 2 s
- Lint rule (if available): every `new CopilotClient(` (or target equivalent) must be matched by a `client.stop(` in the same scope or via a shutdown helper

## Cross-Project Application

1. Search the target codebase for the SDK constructor; count instances vs. matching `stop()` calls
2. For each constructor, confirm at least one path to `stop()` from a signal handler
3. Check for the anti-pattern of registering signal handlers that call `process.exit` directly without invoking SDK cleanup

## Usage

When invoked with a target language:

1. Run **Detection Signals**
2. Read the reference `06-graceful-shutdown.mjs`
3. Emit a target-language port following **Remediation Actions** — three independent paths to stop
4. Apply **Prevention Guardrails** — helper-routed exits, signal handlers, fault-tolerant stop
5. Report PASS / WARN / FAIL
