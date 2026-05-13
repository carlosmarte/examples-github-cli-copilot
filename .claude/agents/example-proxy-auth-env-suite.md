---
name: example-proxy-auth-env-suite
description: Port the four proxy-authentication examples as a coherent suite — read HTTPS_PROXY (07), URL-encode credentials (08), TCP-preflight the proxy (09), fail fast when REQUIRE_PROXY=1 (10). The CLI has no proxy-login command and does not prompt, so credentials must be embedded in the URL. References are examples/nodejs/simple-sdk/07-https-proxy.mjs through 10-fail-fast-no-proxy-creds.mjs.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Example — Proxy Auth Env Suite

## Pattern Summary

The Copilot CLI (like `gh`) reads `HTTPS_PROXY` / `HTTP_PROXY` from the environment and offers no interactive proxy login. Credentials must be embedded in the URL itself before the client opens. This suite ports four cooperating examples that together make proxy authentication safe in production: (07) the happy-path read with a host:port log, (08) percent-encoding for passwords with reserved characters and a parse sanity check, (09) a TCP preflight that catches misconfiguration in 3 s instead of letting it hang, and (10) a `REQUIRE_PROXY=1` flag that refuses to start in environments that mandate egress through a proxy.

## Root Cause

Embedding `user:password` in a URL is fragile in three independent ways: passwords with `@`, `:`, `#`, `/`, `?` break the URL parser silently (the unencoded `@` ends the userinfo segment early); the SDK does not surface proxy connect failures as proxy errors (they appear as long timeouts deep inside the CLI subprocess); and on hosts that require a proxy, a missing env var hangs for minutes before timing out with no useful error. Each of the four examples addresses one of these failure modes. Skipping any one leaves the same defect in any language port.

## Detection Signals

- Target-language repo has SDK examples but no proxy-aware variants
- Existing proxy port does not URL-encode the password (will silently misroute on passwords with reserved chars)
- Existing proxy port opens the client first and times out 90 s later when the proxy is unreachable
- A CI runner with no direct egress hangs for minutes when the SDK is opened without proxy creds

## Validation Steps

1. Read all four reference files: `07-https-proxy.mjs`, `08-url-encoded-credentials.mjs`, `09-proxy-preflight.mjs`, `10-fail-fast-no-proxy-creds.mjs`
2. Confirm the target language has:
   - Env-var read (`os.environ`, `os.Getenv`, `std::env::var`)
   - A URL parser exposing hostname, port, username, password fields independently
   - A percent-encode primitive for URL components (`encodeURIComponent`, `urllib.parse.quote(safe='')`, `url.QueryEscape`)
   - A raw TCP connect with a short timeout (`net.createConnection`, `socket.create_connection`, `net.DialTimeout`)
3. Confirm the language's URL parser returns a host that does NOT equal the original `PROXY_HOST` when the password contains an unencoded reserved char — this is the sanity-check signal example 08 relies on

## Remediation Actions

Port all four variants:

1. **07 — read HTTPS_PROXY**
   - Read `HTTPS_PROXY` then fall back to `HTTP_PROXY`
   - If neither set, print a hint with an example `export` line and exit 1
   - Parse the URL, log only `hostname:port` (never log credentials)
   - Open client → session → trivial roundtrip
2. **08 — URL-encode credentials**
   - Read `PROXY_USER`, `PROXY_PASS`, `PROXY_HOST`, `PROXY_PORT` separately
   - Percent-encode user and pass with the language's URL-component encoder
   - Build the proxy URL string
   - **Sanity check**: parse the built URL and assert `parsed.hostname == PROXY_HOST`. If not, a reserved char in the password was not encoded; print a clear hint and exit 1
   - Set `HTTPS_PROXY` / `HTTP_PROXY` in the process env before opening the client
3. **09 — TCP preflight**
   - If no proxy env var set, log "assuming direct connection" and skip preflight
   - Otherwise: parse hostname/port, open a raw TCP socket with a 3 s timeout
   - On connect: close socket, log reachable
   - On timeout/error: print a clear `proxy <host:port> did not accept TCP within 3s` message and exit 2 (distinct from the SDK's own exit codes)
   - Only after preflight passes, open the SDK client
4. **10 — fail fast when REQUIRE_PROXY=1**
   - If `REQUIRE_PROXY=1`, refuse to start unless `HTTPS_PROXY` (or `HTTP_PROXY`) is set AND parses with a non-empty `username` AND `password`
   - On failure, print a hint that the CLI does not prompt — credentials must be in the URL
   - Exit 2 (configuration error, not transient)

## Prevention Guardrails

- Numbered naming: `07-https-proxy.<ext>`, `08-url-encoded-credentials.<ext>`, `09-proxy-preflight.<ext>`, `10-fail-fast-no-proxy-creds.<ext>` — preserve the suite ordering
- Reviewer checklist: every example logs only host:port, never the password; every example uses the language's URL-component encoder, not string concatenation; preflight uses a short timeout (≤ 3 s); REQUIRE_PROXY uses exit code 2 to distinguish "config wrong" from "transient failure"
- Security note in README: embedding credentials in env vars makes them visible to any subprocess and any tool that can read `/proc/<pid>/environ` — this suite is a stepping-stone toward `example-secret-via-os-keychain` (11), which moves the secret out of the env

## Cross-Project Application

1. Find any existing proxy-aware code in the target repo; check whether it URL-encodes, preflights, and validates required creds
2. Audit env-var-based credential handling for the three failure modes (unencoded reserved chars; long-hang on unreachable proxy; missing creds with no clear error)
3. Confirm the four variants are present as separate files — bundling them into one obscures which concern each addresses

## Usage

When invoked with a target language:

1. Run **Detection Signals**
2. Read all four reference `.mjs` files
3. Emit four target-language port files following **Remediation Actions** — one per concern
4. Apply **Prevention Guardrails** — naming, encoding, timeouts, exit codes
5. Report PASS / WARN / FAIL per variant in a 4-row table
