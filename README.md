# examples-github-cli-copilot

Runnable examples of [`@github/copilot-sdk`](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started)
usage patterns. Each script is standalone — pick the one closest to what you
want and adapt.

## Setup

The SDK shells out to the GitHub Copilot CLI, so install and authenticate that
first:

```sh
# install Copilot CLI per GitHub docs, then verify:
copilot --version

# install the SDK
npm install
```

## Examples

### `simple-sdk/` — core SDK patterns

| # | Script | What it shows |
| - | ------ | ------------- |
| 1 | [`examples/simple-sdk/01-hello-world.mjs`](examples/simple-sdk/01-hello-world.mjs) | Smallest possible round-trip: client → session → `sendAndWait` → `stop`. |
| 2 | [`examples/simple-sdk/02-multi-turn-conversation.mjs`](examples/simple-sdk/02-multi-turn-conversation.mjs) | One session, several sequential prompts that build on each other. |
| 3 | [`examples/simple-sdk/03-streaming-deltas.mjs`](examples/simple-sdk/03-streaming-deltas.mjs) | `streaming: true` plus `session.on("assistant.message_delta", …)` to print chunks live, and `session.idle` to know when the response is done. |
| 4 | [`examples/simple-sdk/04-explain-code-file.mjs`](examples/simple-sdk/04-explain-code-file.mjs) | Read a file off disk and ask Copilot to explain it. Pass the path as an argv. |
| 5 | [`examples/simple-sdk/05-commit-message-from-diff.mjs`](examples/simple-sdk/05-commit-message-from-diff.mjs) | Pipe `git diff --cached` into Copilot and get back a Conventional Commits message. |
| 6 | [`examples/simple-sdk/06-graceful-shutdown.mjs`](examples/simple-sdk/06-graceful-shutdown.mjs) | Wrap the work in `try/finally` and hook `SIGINT`/`SIGTERM` so `client.stop()` always runs. |

### `simple-sdk/` — proxy authentication

`gh copilot` has no built-in command to set proxy authentication and will not
interactively prompt for it. Like the rest of `gh`, it reads the standard
`HTTPS_PROXY` / `HTTP_PROXY` env vars — credentials must be embedded in the
URL. These examples cover the common configurations.

| # | Script | What it shows |
| - | ------ | ------------- |
| 7  | [`examples/simple-sdk/07-https-proxy.mjs`](examples/simple-sdk/07-https-proxy.mjs) | Read `HTTPS_PROXY` with embedded `user:pass`, log the host/port, and run a normal session through it. |
| 8  | [`examples/simple-sdk/08-url-encoded-credentials.mjs`](examples/simple-sdk/08-url-encoded-credentials.mjs) | URL-encode passwords containing `@`, `:`, `#`, `/`, etc. Sanity-check that the parsed hostname matches the literal one. |
| 9  | [`examples/simple-sdk/09-proxy-preflight.mjs`](examples/simple-sdk/09-proxy-preflight.mjs) | TCP-probe the proxy with a 3 s timeout before opening the SDK so misconfigurations fail loudly instead of hanging. |
| 10 | [`examples/simple-sdk/10-fail-fast-no-proxy-creds.mjs`](examples/simple-sdk/10-fail-fast-no-proxy-creds.mjs) | When `REQUIRE_PROXY=1`, refuse to start unless `HTTPS_PROXY` is set *and* contains user:password. |
| 11 | [`examples/simple-sdk/11-keychain-proxy-creds.mjs`](examples/simple-sdk/11-keychain-proxy-creds.mjs) | macOS only: read proxy username/password from the login Keychain (service `copilot-sdk-proxy`), prompting once and writing them via `security` if not yet stored. |

### `docker/` — docker-compose deployment + Keychain-sourced token

The compose stack from the [Copilot SDK backend-services guide](https://docs.github.com/en/copilot/how-tos/copilot-sdk/set-up-copilot-sdk/backend-services#docker-compose-deployment),
plus a minimal `api` container and six numbered tests. `COPILOT_GITHUB_TOKEN`
is sourced from the macOS Keychain (service `copilot-sdk-docker`) the same
way example 11 sources proxy credentials. See
[`examples/docker/README.md`](examples/docker/README.md) for layout and
caveats.

| # | Script | What it shows |
| - | ------ | ------------- |
| 1 | [`examples/docker/tests/01-keychain-store-token.mjs`](examples/docker/tests/01-keychain-store-token.mjs) | Interactively prompt for the GitHub PAT (input masked), shape-check it, and write to the login Keychain. |
| 2 | [`examples/docker/tests/02-keychain-load-token.mjs`](examples/docker/tests/02-keychain-load-token.mjs) | Read the token back; print as a shell `export …` line, or as a raw value with `--raw`. |
| 3 | [`examples/docker/tests/03-compose-up-with-keychain.mjs`](examples/docker/tests/03-compose-up-with-keychain.mjs) | Source from Keychain, run `docker compose up -d`, poll until both ports answer. |
| 4 | [`examples/docker/tests/04-cli-port-reachable.mjs`](examples/docker/tests/04-cli-port-reachable.mjs) | TCP-probe the host-mapped CLI port (4321) — fast signal that the cli container is bound and not crash-looping on a bad token. |
| 5 | [`examples/docker/tests/05-api-end-to-end.mjs`](examples/docker/tests/05-api-end-to-end.mjs) | `GET /health` on the `api` container, which itself probes `copilot-cli:4321` from inside the compose network. Distinguishes "api up but cli unreachable" (503) from "api down" (connection refused). |
| 6 | [`examples/docker/tests/06-compose-down.mjs`](examples/docker/tests/06-compose-down.mjs) | `docker compose down`, optionally `--volumes` to also drop `session-data`. |

> **Security note.** Embedding `user:password` in `HTTPS_PROXY` exposes the
> password as plain text in the process environment. Anything that can read
> `/proc/<pid>/environ` (on Linux) or list environment vars for your user can
> see it. Avoid baking it into shared `.bashrc` / `.zshrc` files or shell
> history; example 11 keeps it in the Keychain instead.

## Run

```sh
npm run ex:hello
npm run ex:multi-turn
npm run ex:streaming
npm run ex:explain -- examples/simple-sdk/01-hello-world.mjs
npm run ex:commit-msg
npm run ex:graceful

# proxy
HTTPS_PROXY=http://user:pass@proxy.example.com:8080 npm run ex:proxy
PROXY_USER=me PROXY_PASS='p@ss:w#rd' PROXY_HOST=proxy.example.com npm run ex:proxy-encode
npm run ex:proxy-preflight
REQUIRE_PROXY=1 npm run ex:proxy-required
PROXY_HOST=proxy.example.com npm run ex:proxy-keychain

# docker
npm run dk:store-token
npm run dk:up
npm run dk:cli-reachable
npm run dk:e2e
npm run dk:down
```

## API surface used

Only methods documented in the [Getting Started guide](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started):

- `new CopilotClient()` — construct the client
- `client.createSession({ model, streaming? })` — open a session
- `session.sendAndWait({ prompt })` — send a prompt, await the full response
- `session.on(eventType, handler)` — subscribe to `assistant.message_delta` / `session.idle`; returns an unsubscribe fn
- `response?.data.content` — the assistant's text
- `client.stop()` — close the underlying CLI process
