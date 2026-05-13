---
name: example-secret-via-os-keychain
description: Port the OS-keychain credential pattern — read or prompt-once-then-write a secret to the platform credential store (macOS Keychain, Windows Credential Manager, Linux Secret Service / libsecret), then materialize it as an env var only for the lifetime of one subprocess invocation. References are examples/nodejs/simple-sdk/11-keychain-proxy-creds.mjs and examples/nodejs/docker/tests/{01,02}-keychain-*.mjs.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Example — Secret Via OS Keychain

## Pattern Summary

A secret (proxy password, GitHub PAT, API key) lives in the user's OS keychain — not in a shell rc file, not in `.env`, not in `@AppStorage`. The example reads from the keychain at runtime; if no entry exists, it prompts once (password input masked), shape-checks the answer, and writes the entry. The secret then enters the process environment only for the lifetime of the downstream subprocess call — never persisted to disk, never logged, never visible after the run.

Two reference variants share this pattern: `11-keychain-proxy-creds.mjs` stores `user\npassword` for a proxy host; `docker/tests/01-keychain-store-token.mjs` and `02-keychain-load-token.mjs` store a single PAT under `service=copilot-sdk-docker, account=github-token`. Both use the macOS `security` CLI; both follow the same six-step shape.

## Root Cause

Storing secrets in shell rc files or `.env` exposes them to: backups, dotfile sync (git, iCloud, Dropbox), screen-shares, shell history greps, accidental `git add .`, and every subprocess for the rest of the login session. The OS keychain is purpose-built for at-rest secret storage behind the user's login password and is the only cross-platform credential surface that does not require running a daemon or installing extra packages. Ports that skip the keychain step either hard-code secrets (worst), use `.env` (footgun), or invent a one-off encrypted-file scheme (over-engineered and still leaky).

## Detection Signals

- Target-language repo handles credentials but reads them from `.env`, hard-codes them, or stores them in `@AppStorage` / `UserDefaults`
- Existing port shells out to `security` (macOS) but has no fallback for Linux/Windows callers and no clear "macOS only" exit message
- No shape check on the secret before writing (writing whatever the user typed, including obviously-wrong values)
- Password input is not masked (a `TextField` instead of a `SecureField`, or a readline read without echo suppression)

## Validation Steps

1. Read all three references: `11-keychain-proxy-creds.mjs`, `docker/tests/01-keychain-store-token.mjs`, `docker/tests/02-keychain-load-token.mjs`
2. Confirm the target language has:
   - Subprocess execution returning captured stdout (`spawnSync`, `subprocess.run`, `exec.Command`)
   - Interactive read with echo suppression (`readline` + a sink Writable in Node; `getpass.getpass` in Python; `term.MakeRaw` + manual handling in Go; `rpassword` crate in Rust)
   - Platform-detection primitive (`process.platform`, `sys.platform`, `runtime.GOOS`, `std::env::consts::OS`)
3. Confirm the platform target — for macOS, the `security` CLI is preinstalled; for Linux, `secret-tool` (libsecret) or `keyring` (Python lib) is the equivalent; for Windows, `cmdkey` or `wincred`. The port may legitimately be macOS-only if it mirrors the references; clearly state and check the platform up front

## Remediation Actions

Port by reproducing the six-step shape:

1. **Platform check** — if not the supported platform, print a clear "this example uses <keychain>; not portable" message and exit 1. Better to fail explicitly than to half-implement a Linux fallback inline
2. **Constants** — `SERVICE = "<bundle-id-or-app-name>"`, `ACCOUNT = "<stable-account-name>"` (use the proxy host for variant A; use a fixed `github-token` for variant B). Service+account is the keychain primary key
3. **`readKeychain(account)` helper** — wraps the read subprocess (`security find-generic-password -s SERVICE -a ACCOUNT -w`), returns `null` on non-zero exit, strips the trailing newline on success
4. **`writeKeychain(account, secret)` helper** — wraps the write subprocess (`security add-generic-password -U -s SERVICE -a ACCOUNT -w secret`). The `-U` flag updates an existing entry instead of failing with "already exists"
5. **`ask(label, {mask})` helper** — interactive prompt; when `mask=true`, suppress echo (sink the readline output stream, or use the language's `getpass`). Trim the answer before returning
6. **Top-level flow**:
   - Try `readKeychain(account)` first
   - On hit: parse the secret (split on `\n` for the two-field user+pass variant; use raw for the single-PAT variant)
   - On miss: log "no entry yet; prompting once", call `ask` for each field, shape-check the answer (≥ 20 chars and ASCII-only for a GitHub PAT; both fields non-empty for proxy creds), call `writeKeychain`, log "stored"
   - Then construct the downstream URL or env var and proceed with the SDK work

## Prevention Guardrails

- Naming: `11-keychain-<purpose>.<ext>` (proxy variant) or `01-keychain-store-token.<ext>` + `02-keychain-load-token.<ext>` (split-read-write variant when one script stores and a different one consumes)
- Reviewer checklist: platform guard at the top; SERVICE/ACCOUNT constants visible; `-U` flag on the add command; password input masked; shape check before write; no `console.log(secret)` anywhere
- Document the cleanup command in a comment near the top — `security delete-generic-password -s <SERVICE> -a <ACCOUNT>` — so the user can wipe a bad entry without code-spelunking
- A CI guard that greps the example for known token shapes (`ghp_`, `ghs_`, etc.) catches accidental commits of real secrets

## Cross-Project Application

1. Search the target repo for `.env`-based credential handling, hard-coded tokens, or `@AppStorage` keys named `token`/`pat`/`key`
2. For each finding, propose migration to the keychain pattern with the six-step shape
3. Verify any existing keychain-using code uses the `-U` (update) flag so re-runs do not fail with "already exists"
4. If the target supports multiple platforms, decide explicitly: support all three (libsecret + Keychain + cmdkey wrappers), or document macOS-only with an explicit platform check

## Usage

When invoked with a target language and a downstream consumer (proxy URL, env var name, SDK init arg):

1. Run **Detection Signals**
2. Read the three reference files
3. Emit the target-language port following **Remediation Actions** — six steps in order
4. Apply **Prevention Guardrails** — platform guard, masked input, shape check, `-U` flag, no logged secrets
5. Report PASS / WARN / FAIL with evidence
