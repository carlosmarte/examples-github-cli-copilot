# `examples/docker/` — Copilot SDK behind docker-compose

The compose stack from the [GitHub Copilot SDK backend-services
guide](https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/backend-services#docker-compose-deployment),
plus a minimal `api` container and six numbered tests that exercise it.
The GitHub PAT (`COPILOT_GITHUB_TOKEN`) is sourced from the **macOS Keychain**
following the same pattern as
[`examples/simple-sdk/11-keychain-proxy-creds.mjs`](../simple-sdk/11-keychain-proxy-creds.mjs).

## Layout

```
examples/docker/
├── docker-compose.yml      # the doc's stack, verbatim
├── Dockerfile              # builds the `api` service image
├── .env.example            # template; do NOT commit a real .env
├── api/
│   ├── package.json
│   └── server.mjs          # tiny dep-free server — GET /health probes CLI_URL
└── tests/
    ├── 01-keychain-store-token.mjs        # interactive: prompt for PAT, store in Keychain
    ├── 02-keychain-load-token.mjs         # print as `export …` (or --raw)
    ├── 03-compose-up-with-keychain.mjs    # source from Keychain → docker compose up -d → wait
    ├── 04-cli-port-reachable.mjs          # TCP probe 127.0.0.1:4321
    ├── 05-api-end-to-end.mjs              # GET /health on the api → expect 200
    └── 06-compose-down.mjs                # docker compose down (--volumes optional)
```

## Prerequisites

- Docker Desktop (or any `docker compose` v2 CLI)
- macOS for tests 01–03 (uses the `security` CLI)
- A GitHub PAT with Copilot access

## Quick start

```sh
cd examples/docker

# one-time: store the PAT in the login Keychain
node tests/01-keychain-store-token.mjs

# bring the stack up; token is sourced from Keychain at run time
node tests/03-compose-up-with-keychain.mjs

# verify
node tests/04-cli-port-reachable.mjs
node tests/05-api-end-to-end.mjs

# tear down (add --volumes to also drop session-data)
node tests/06-compose-down.mjs
```

The test scripts are also wired to npm scripts at the repo root:

```sh
npm run dk:store-token
npm run dk:up
npm run dk:cli-reachable
npm run dk:e2e
npm run dk:down
```

## Why Keychain over `.env`

The compose file expects `${COPILOT_GITHUB_TOKEN}` from the host environment.
The two common ways to provide it are both a footgun:

- **Shell rc files** (`~/.zshrc` `export COPILOT_GITHUB_TOKEN=…`) — leaks into
  every subprocess for the rest of your login session and into screen-shares,
  shell-history greps, and dotfile backups.
- **`.env` next to `docker-compose.yml`** — survives the run, easy to
  accidentally `git add .`, and tools like `direnv` cache it in places you
  forget about.

Storing in the login Keychain (service `copilot-sdk-docker`,
account `github-token`) keeps the token at rest behind the user's login
password and only materializes it as a process-env var for the lifetime of
the `docker compose up` invocation.

> **Caveat.** Once `docker compose up -d` runs, the token is visible in the
> *container's* environment (via `docker inspect copilot-cli`). Anyone with
> docker-socket access on the host can read it; Keychain only protects the
> token at rest on the host filesystem.

## Manual override (without Keychain)

```sh
# one-shot, no rc-file persistence:
COPILOT_GITHUB_TOKEN='ghp_…' docker compose up -d

# or via .env (add `.env` to .gitignore first):
cp .env.example .env
$EDITOR .env
docker compose --env-file .env up -d
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Test 04 fails (port 4321 closed) but test 03 reported "up" | `copilot-cli` exited after binding — invalid/expired token. `docker compose logs copilot-cli`. |
| Test 05 returns 503 with `cli.reachable=false` | api is up but cannot reach `copilot-cli:4321` inside the compose network — check `docker compose ps` for the cli container's state. |
| `security: SecKeychainSearchCopyNext: The specified item could not be found` | No Keychain entry yet. Run `tests/01-keychain-store-token.mjs`. |
| Token works locally but not in CI | Keychain is macOS-only. Use `--env-file` or pass `COPILOT_GITHUB_TOKEN` directly in CI secrets. |
