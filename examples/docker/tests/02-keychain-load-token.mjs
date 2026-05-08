// 02 — Load the token from Keychain and emit it to stdout
//
// Two output modes:
//   default — prints `export COPILOT_GITHUB_TOKEN='<value>'` so the result
//             can be eval'd by a shell:
//               eval "$(node examples/docker/tests/02-keychain-load-token.mjs)"
//   --raw   — prints just the token value, for command substitution:
//               COPILOT_GITHUB_TOKEN=$(node examples/docker/tests/02-keychain-load-token.mjs --raw) \
//                 docker compose up -d
//
// Exits non-zero (with a stderr message) if no Keychain entry exists.
//
// Run:
//   node examples/docker/tests/02-keychain-load-token.mjs
//   node examples/docker/tests/02-keychain-load-token.mjs --raw

import { spawnSync } from "node:child_process";

if (process.platform !== "darwin") {
  console.error("macOS Keychain only.");
  process.exit(1);
}

const SERVICE = "copilot-sdk-docker";
const ACCOUNT = "github-token";
const raw = process.argv.includes("--raw");

const r = spawnSync(
  "security",
  ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"],
  { encoding: "utf8" },
);
if (r.status !== 0) {
  console.error(`no Keychain entry for ${SERVICE}/${ACCOUNT}.`);
  console.error("run tests/01-keychain-store-token.mjs first.");
  process.exit(1);
}

const token = r.stdout.replace(/\n$/, "");

if (raw) {
  process.stdout.write(token);
} else {
  // Single-quote-escape: replace ' with '\''
  const escaped = token.replace(/'/g, "'\\''");
  console.log(`export COPILOT_GITHUB_TOKEN='${escaped}'`);
}
