// Minimal API container that pairs with the headless copilot-cli service in
// docker-compose. Exposes:
//   GET /health  — JSON status, plus a TCP probe of CLI_URL (host:port).
//
// Kept dependency-free on purpose so the container builds in seconds and the
// failure surface is tiny while wiring up the stack.

import http from "node:http";
import net from "node:net";

// Disable any user-configured MCP servers so this example runs against the
// bare SDK/CLI surface only. (Also set in docker-compose for completeness.)
process.env.COPILOT_DISABLE_MCP = "1";

const CLI_URL = process.env.CLI_URL ?? "copilot-cli:4321";
const [cliHost, cliPortStr] = CLI_URL.split(":");
const cliPort = Number(cliPortStr) || 4321;

function pingCli() {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: cliHost, port: cliPort, timeout: 1500 });
    sock.once("connect", () => { sock.end(); resolve(true); });
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
    sock.once("error", () => resolve(false));
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    const reachable = await pingCli();
    res.writeHead(reachable ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({
      status: reachable ? "ok" : "degraded",
      cli: { host: cliHost, port: cliPort, reachable },
    }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found", path: req.url }));
});

server.listen(3000, () => {
  console.log(`api listening on :3000 (CLI_URL=${CLI_URL})`);
});
