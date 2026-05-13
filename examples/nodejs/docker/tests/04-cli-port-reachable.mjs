// 04 — Probe the headless copilot-cli port directly
//
// docker-compose maps the container's 4321 to host 4321. This test confirms
// the CLI is listening — useful for catching token-related boot failures: an
// unauthenticated CLI exits before binding the port, so a TCP failure here is
// almost always "bad COPILOT_GITHUB_TOKEN" rather than a network problem.
//
// Run: node examples/docker/tests/04-cli-port-reachable.mjs

import net from "node:net";

const HOST = process.env.CLI_HOST ?? "127.0.0.1";
const PORT = Number(process.env.CLI_PORT ?? 4321);

const ok = await new Promise((resolve) => {
  const s = net.createConnection({ host: HOST, port: PORT, timeout: 2000 });
  s.once("connect", () => { s.end(); resolve(true); });
  s.once("timeout", () => { s.destroy(); resolve(false); });
  s.once("error", () => resolve(false));
});

if (!ok) {
  console.error(`copilot-cli not reachable on ${HOST}:${PORT}`);
  console.error("hint: docker compose logs copilot-cli  (token may be invalid)");
  process.exit(1);
}
console.log(`copilot-cli reachable on ${HOST}:${PORT}.`);
