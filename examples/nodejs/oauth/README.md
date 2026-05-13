# oauth — token cache scanners

Three read-only scripts that scan the documented cache locations the GitHub
Copilot CLI, `gh` CLI, and Anthropic SDK use for stored OAuth credentials, plus
the relevant environment variables. Output is redacted by default.

| Script              | Runtime                |
| ------------------- | ---------------------- |
| `scan-token.sh`     | bash + grep + find     |
| `scan-token.mjs`    | node ≥ 18 (ESM)        |
| `scan_token.py`     | python ≥ 3.10          |

## Usage

```sh
# Redacted preview (first 8 + last 4 chars)
./scan-token.sh
node scan-token.mjs
python3 scan_token.py

# Full tokens — DANGEROUS, never pipe to logs / clipboard / cloud shells
./scan-token.sh --show

# Machine-readable
node scan-token.mjs --json | jq .
```

## What gets scanned

Locations are checked in the same order the `@github/copilot` CLI itself
resolves them at runtime (verified against `app.js` v1.0.43):

1. `$COPILOT_HOME` → fallback `~/.copilot/`
2. `$COPILOT_CACHE_HOME` → platform default:
   - macOS: `~/Library/Caches/copilot/`
   - Linux: `${XDG_CACHE_HOME:-~/.cache}/copilot/`
   - Windows: `%LOCALAPPDATA%/copilot/`
3. `$ANTHROPIC_CONFIG_DIR/credentials/<profile>.json` → fallback
   `~/.config/anthropic/credentials/<profile>.json` (used by Copilot's
   managed-agents `user_oauth` flow)
4. `~/.config/gh/` (the `gh` CLI's `hosts.yml`)
5. `~/.config/github-copilot/`

Inside each directory the script walks every regular file ≤ 1 MB, skips
binary extensions (`.db`, `.wasm`, …), and looks for:

- **Token-shaped substrings** — `ghp_…`, `ghs_…`, `gho_…`, `ghu_…`, `ghr_…`,
  `github_pat_…`
- **JSON keys** — `access_token`, `oauth_token`, `github_token`, `token`,
  `api_token`, `refresh_token`, `copilot_token` (recursive)
- **YAML keys** — same set, for `gh` CLI's `hosts.yml`

It also prints any of these env vars if set: `GITHUB_TOKEN`, `GH_TOKEN`,
`GITHUB_COPILOT_GITHUB_TOKEN`, `COPILOT_GITHUB_TOKEN`,
`GITHUB_COPILOT_API_TOKEN`, `GITHUB_VERIFICATION_TOKEN`, `ANTHROPIC_API_KEY`.

## Empty result?

If you see `(no tokens found …)`, the most common reasons are:

1. You haven't authenticated yet — run `copilot` interactively (it triggers a
   device-code flow) or `gh auth login`. The CLI then writes credentials to
   one of the locations above.
2. You authenticated via a system keychain (macOS Keychain, Windows Credential
   Manager, Linux Secret Service). These scripts deliberately do **not** touch
   the keychain — query it explicitly:
   ```sh
   # macOS — gh CLI keychain entry (if used)
   security find-internet-password -s github.com -a 'gh:github.com' -w
   ```
3. The token is held only in memory by a long-running `copilot` process and
   never persisted (some flows behave this way).

## ⚠ Scope caveat — read this before reusing a found token

A token recovered from these caches is **not interchangeable** with a GitHub
Personal Access Token in the general case:

| Token kind                              | Valid against `api.github.com`? |
| --------------------------------------- | ------------------------------- |
| `gh` CLI OAuth token (`gho_…`)          | Yes — has user-granted scopes   |
| GitHub PAT (`ghp_…` or `github_pat_…`)  | Yes — scopes you granted        |
| Copilot CAPI session token              | **No** — Copilot service only   |
| Anthropic OAuth `access_token`          | **No** — Anthropic API only     |
| GitHub App installation token (`ghs_…`) | Yes — limited app permissions   |

The CAPI / "Copilot session token" the SDK exchanges for chat completions has
a short TTL and is scoped to `api.githubcopilot.com`. Using it for `GET
/user/issues` will return `401 Bad credentials`. If you need one token for
both, mint a fine-grained PAT and pass it in via `MY_CUSTOM_PAT` as in the
upstream guidance — don't try to "borrow" the cached SDK token.

## Safety notes

- Scripts are read-only. They do not write, network, exfiltrate, or modify
  any file.
- `--show` prints raw secrets to stdout. Don't pipe it into shell history,
  cloud-hosted terminals, screen recordings, or chat tools.
- The default redaction (`abcd1234…wxyz`) is enough to identify a token
  without leaking it.
