// 03 — Bring the docker-compose stack up using a Keychain-sourced token
//
// Loads COPILOT_GITHUB_TOKEN from the macOS Keychain, then runs
// `docker compose up -d` from examples/docker/. After bring-up, polls the
// host-mapped ports for both services until they accept TCP, then exits 0.
//
// If the cli port (4321) never comes up, the most likely cause is an invalid
// or expired token — check `docker compose logs copilot-cli`.
//
// Run: node examples/docker/tests/03-compose-up-with-keychain.mjs

import { spawnSync, execFileSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") {
  console.error("this test reads from macOS Keychain; not portable.");
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPOSE_DIR = path.resolve(HERE, "..");

function loadToken() {
  const r = spawnSync(
    "security",
    ["find-generic-password", "-s", "copilot-sdk-docker", "-a", "github-token", "-w"],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error("no token in Keychain; run tests/01-keychain-store-token.mjs first.");
    process.exit(1);
  }
  return r.stdout.replace(/\n$/, "");
}

function ping(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host, port, timeout: timeoutMs });
    s.once("connect", () => { s.end(); resolve(true); });
    s.once("timeout", () => { s.destroy(); resolve(false); });
    s.once("error", () => resolve(false));
  });
}

async function waitFor(host, port, label, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    if (await ping(host, port)) {
      console.log(`  ${label} ${host}:${port} ready (after ${i + 1}s)`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} ${host}:${port} never came up after ${attempts}s`);
}

const token = loadToken();
console.log("docker compose up -d ...");
execFileSync("docker", ["compose", "up", "-d"], {
  cwd: COMPOSE_DIR,
  // Token reaches the copilot-cli container via the ${COPILOT_GITHUB_TOKEN}
  // interpolation in docker-compose.yml; never written to a file.
  // COPILOT_DISABLE_MCP=1 keeps the example on the bare SDK/CLI surface.
  env: { ...process.env, COPILOT_GITHUB_TOKEN: token, COPILOT_DISABLE_MCP: "1" },
  stdio: "inherit",
});

await waitFor("127.0.0.1", 4321, "copilot-cli");
await waitFor("127.0.0.1", 3000, "api");
console.log("stack ready.");
