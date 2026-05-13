---
name: example-credential-cache-scanner
description: Port the read-only OAuth token scanner that walks documented cache locations and env vars, redacts findings by default, and supports `--show` and `--json` flags. The reference repo already ships three twin implementations (bash, Node, Python); use them as the parity contract for any further language. References are examples/nodejs/oauth/{scan-token.sh,scan-token.mjs,scan_token.py}.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Example — Credential Cache Scanner

## Pattern Summary

A diagnostic CLI that, given no input, walks every documented cache location the GitHub Copilot CLI / `gh` CLI / Anthropic SDK is known to write to (plus the relevant env vars), and prints any token-shaped or token-keyed values it finds — redacted by default, with explicit `--show` and `--json` opt-outs. The script is read-only: it does not write, network, or modify any file. The redaction format (`first8…last4`, with full length) is enough to identify a token without leaking it. The scanner exists in three twin languages already and must stay in parity across them.

## Root Cause

When a user says "Copilot suddenly doesn't authenticate," there are six likely culprits (env shadowing, stale cache, wrong profile, expired OAuth token, keychain vs file mismatch, wrong CLI version) and no one tool surfaces them at once. A read-only scanner across the documented surfaces gives the operator a one-shot diagnostic that distinguishes "no token anywhere" (need to log in) from "token present but wrong scope" (one of several specific Copilot/CAPI gotchas the README documents). Without it, debugging is whack-a-mole.

## Detection Signals

- Target-language repo has SDK examples but no diagnostic / scanner tool
- A user asks "why is auth failing" or "where is my token stored" in the target language
- An existing scanner walks only one location (only env vars, or only `~/.config/gh/`) — incomplete
- An existing scanner prints raw tokens by default — leakage risk
- The reference repo gains a fourth language port that diverges from the bash/Node/Python parity contract

## Validation Steps

1. Read all three reference implementations to establish the parity contract:
   - `examples/nodejs/oauth/scan-token.sh` (bash + grep + find baseline)
   - `examples/nodejs/oauth/scan-token.mjs` (Node ESM)
   - `examples/nodejs/oauth/scan_token.py` (Python ≥ 3.10)
2. Confirm the target language has:
   - Recursive directory walk with stat (`readdirSync withFileTypes`, `os.walk`, `filepath.Walk`, `std::fs::read_dir`)
   - File-size check + binary detection (NUL-byte heuristic in first 4 KB suffices)
   - Regex engine with named groups OR simple groups for token shapes
   - JSON parse (for structured detection) AND a regex fallback (for malformed/embedded JSON)
   - Argv parse for `--show` and `--json` flags

## Remediation Actions

Port by reproducing the same nine-section structure as the references:

1. **Argv parsing** — three flags: default (redacted text), `--show` (raw tokens, DANGEROUS), `--json` (one JSON object per line for `jq` / parsing)
2. **Candidate location list** — build in the same order as the references:
   - `$COPILOT_HOME` → `~/.copilot/`
   - `$COPILOT_CACHE_HOME` → platform default (macOS `~/Library/Caches/copilot/`, Linux `${XDG_CACHE_HOME:-~/.cache}/copilot/`, Windows `%LOCALAPPDATA%/copilot/`)
   - `$ANTHROPIC_CONFIG_DIR` → `~/.config/anthropic/`
   - `~/.config/gh/`
   - `~/.config/github-copilot/`
3. **Env-var allowlist** — the same seven names: `GITHUB_TOKEN, GH_TOKEN, GITHUB_COPILOT_GITHUB_TOKEN, COPILOT_GITHUB_TOKEN, GITHUB_COPILOT_API_TOKEN, GITHUB_VERIFICATION_TOKEN, ANTHROPIC_API_KEY`
4. **Skip filter** — extension blocklist (`.db .wasm .so .dylib .a .zip .gz .png .jpg .jpeg .ico .pdf .bin`) and a max size (1 MB)
5. **Binary detection** — NUL byte in first 4 KB → skip
6. **Token-shape regex** — `gh[psoura]_[A-Za-z0-9]{20,}` OR `github_pat_[A-Za-z0-9_]{40,}` (the two GitHub token families)
7. **Key-name match for JSON/YAML** — same set: `access_token, oauth_token, github_token, token, api_token, refresh_token, copilot_token`. Recursive descent for nested JSON; line-anchored regex for YAML (`gh` CLI's `hosts.yml`)
8. **Redaction** — `first8…last4` for values > 12 chars, `[short:Nc]` for shorter values; full length always reported alongside
9. **Output** — tabular text by default with a header row; one JSON object per line under `--json`; explicit `(no tokens found …)` message when the result set is empty

## Prevention Guardrails

- Output redaction must be the default; `--show` must be an explicit opt-in with a `DANGEROUS` comment in the source
- The script must be read-only — no `writeFileSync`, no network, no `fetch`, no `exec` of write operations
- The platform-conditional directory list must match across all language twins (any deviation is a regression — the README documents this as the parity contract)
- README scope caveat: a CAPI / Copilot-session token is NOT a GitHub PAT and will not authenticate `api.github.com` — the README's token-kind table must be reproduced verbatim in the target language's README to avoid the user "borrowing" the wrong token

## Cross-Project Application

1. Look for existing diagnostic/scanner scripts in the target repo; check whether they cover the same surfaces or only a subset
2. Verify any token-finder is read-only — a `--cleanup` or `--rotate` mode is a different tool, not a feature of this one
3. Confirm the target language port matches the canonical location list and env-var allowlist exactly; document any platform-specific extension (e.g. Windows-only `%APPDATA%` paths) as an explicit superset

## Usage

When invoked with a target language:

1. Run **Detection Signals**
2. Read all three reference twins
3. Emit a target-language port following **Remediation Actions** — preserve the nine-section structure
4. Apply **Prevention Guardrails** — redaction default, read-only, parity with siblings
5. Report PASS / WARN / FAIL with a small diff against the canonical location list and env-var allowlist
