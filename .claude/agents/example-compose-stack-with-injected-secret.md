---
name: example-compose-stack-with-injected-secret
description: Port the docker-compose deployment example — a two-service stack (headless CLI + minimal probe API) that gets its secret only via the launching process's environment (never `.env`, never a file). Includes the up/wait, down, port-probe, and HTTP-end-to-end test scripts. References are examples/nodejs/docker/{docker-compose.yml,Dockerfile,api/,tests/03-06}.
tools: Read, Glob, Grep, Bash
model: sonnet
---

# Example — Compose Stack With Injected Secret

## Pattern Summary

A `docker-compose.yml` declares two services — a headless CLI container that needs a PAT, and a minimal dep-free probe API that proxies a `/health` check from outside the compose network — joined by a volume for session state. The crucial property is that the PAT enters the stack via `${COPILOT_GITHUB_TOKEN}` interpolation at compose-up time and is never written to a file. A launcher script (e.g. `tests/03`) sources the token from the OS keychain, runs `docker compose up -d` with the token spliced into the inherited env, then polls both host-mapped ports until they answer TCP. A teardown script (`tests/06`) wraps `docker compose down` with optional `--volumes`. A direct-port probe (`tests/04`) tests the CLI from the host. An HTTP probe (`tests/05`) tests the api's `/health`, which itself TCP-probes the CLI from inside the compose network — distinguishing "api up but cli unreachable" (503) from "api down" (connection refused).

## Root Cause

Backend deployment of an SDK that needs a long-lived auth token is one of the most error-prone surfaces a project has. The common failure modes — leaked tokens in `.env`, opaque "stack won't start" with no signal on which container died, no test harness so failures are diagnosed by hand from `docker logs` — all stem from skipping the same five disciplines: secret stays in env (not in a file), launcher polls until ready (not "sleep 5"), two probe levels (port-only + inside-network), idempotent teardown with optional volume retention, dep-free probe API (build in seconds, failure surface tiny). The reference stack codifies all five.

## Detection Signals

- Target-language repo has SDK examples but no deployment example
- Existing deployment puts the token in a committed `.env` or a baked-in Dockerfile `ENV`
- Existing harness uses `sleep N` instead of port-polling — flaky in CI and pointless locally
- No way to distinguish "api up, cli down" from "api down" — the operator runs `docker logs` blind
- No teardown script — the operator runs `docker compose down` from memory each time

## Validation Steps

1. Read all the reference files:
   - `docker/docker-compose.yml` — the two-service shape
   - `docker/Dockerfile` — minimal build of the api
   - `docker/api/server.mjs` — dep-free `/health` with TCP probe to `CLI_URL`
   - `docker/.env.example` — template only, real `.env` is gitignored
   - `docker/tests/03-compose-up-with-keychain.mjs` — load secret → up → poll both ports
   - `docker/tests/04-cli-port-reachable.mjs` — host TCP probe
   - `docker/tests/05-api-end-to-end.mjs` — HTTP /health probe with structured body
   - `docker/tests/06-compose-down.mjs` — teardown with optional volumes
2. Confirm the target environment has docker + docker-compose v2
3. Confirm the secret source is available (`example-secret-via-os-keychain` already ported, or an alternative)

## Remediation Actions

Port the stack in this order:

1. **`docker-compose.yml`** — two services. The CLI service pulls the canonical headless image, declares `${SECRET_ENV_VAR}` (verbatim, with the braces), maps the CLI port to host, mounts a named volume for session state, sets `restart: always`. The api service builds from `.`, sets `CLI_URL=<cli-service-name>:<port>` so the api inside the network can reach the CLI by service-name DNS, declares `depends_on: [<cli-service>]`, maps its own port to host
2. **`Dockerfile`** — minimal base image for the target language, copy package manifest first (for layer caching), install deps without dev, copy the api source, expose the api port, exec the runtime
3. **`api/<server>`** — dependency-free HTTP server in the target language. One route: `GET /health` returns JSON `{status, cli: {host, port, reachable}}` after a TCP probe (≤ 1.5 s timeout) of `CLI_URL`. Status code 200 if reachable, 503 if not. Any other route returns 404
4. **`.env.example`** — template with the env var commented and a warning to gitignore the real `.env`. Document both alternatives (keychain-sourced, `--env-file`)
5. **`tests/01-store-token`** + **`tests/02-load-token`** — defer to the keychain skill (`example-secret-via-os-keychain`)
6. **`tests/03-up-with-keychain`** — load secret via the keychain skill's helper; run `docker compose up -d` with the token spliced into the inherited env (never write a file); then poll both host-mapped ports with a `ping(host,port)→bool` + `waitFor(host, port, label, attempts)` helper that sleeps 1 s between probes; throw after N attempts so a hang surfaces as a clear error
7. **`tests/04-cli-port-reachable`** — single TCP probe of the host-mapped CLI port. On failure, print a hint pointing to `docker compose logs <cli-service>` because the most common cause is an invalid/expired token
8. **`tests/05-api-end-to-end`** — HTTP fetch of `/health`, parse JSON, assert `status == 200` AND `body.cli.reachable === true`. This is the strict end-to-end test (port + intra-network connectivity)
9. **`tests/06-down`** — `docker compose down`, optional `--volumes` flag passthrough

## Prevention Guardrails

- The launcher script MUST NOT write a `.env` file — pass the secret only as an inherited env var to the `docker compose up` subprocess
- The `.env.example` must be checked in; the real `.env` must be in `.gitignore` from day one
- Both port-level (04) and HTTP-level (05) probes must exist as separate tests — they distinguish container-boot failure from intra-network failure
- The api server stays dependency-free; introducing a framework defeats the "tiny failure surface" property
- README must document the security caveat: once `compose up` has run, the token is visible inside the container's env via `docker inspect` — the keychain protects the token *at rest on the host*, not from anyone with docker-socket access

## Cross-Project Application

1. Find any existing deployment scripts in the target repo; check for `.env` files holding real secrets, baked-in `ENV TOKEN=` in Dockerfiles, `sleep` instead of polling
2. For each finding, propose migration to the five-discipline shape (env-only secret, polling launcher, two probe levels, idempotent teardown, dep-free probe)
3. Validate the api stays dep-free in the port — adding express/flask/gin defeats the property

## Usage

When invoked with a target language:

1. Run **Detection Signals**
2. Read all reference files in `examples/nodejs/docker/**`
3. Emit target-language ports of the stack and the four test scripts following **Remediation Actions**
4. Apply **Prevention Guardrails** — env-only secret, polling, two probe levels, dep-free api
5. Report PASS / WARN / FAIL per file
