// 06 — Tear the stack down
//
// `docker compose down` stops and removes the containers. By default the
// `session-data` volume is preserved so subsequent runs keep their session
// state. Pass `--volumes` to drop it as well (full reset).
//
// Run:
//   node examples/docker/tests/06-compose-down.mjs
//   node examples/docker/tests/06-compose-down.mjs --volumes

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPOSE_DIR = path.resolve(HERE, "..");

const args = ["compose", "down"];
if (process.argv.includes("--volumes")) args.push("--volumes");

execFileSync("docker", args, { cwd: COMPOSE_DIR, stdio: "inherit" });
console.log(`stack down${args.includes("--volumes") ? " (volumes dropped)" : ""}.`);
