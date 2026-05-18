// 09 — Preflight a proxy before opening the Copilot client
//
// The SDK does not surface proxy errors clearly — a misconfigured HTTPS_PROXY
// usually shows up as a long timeout inside the underlying CLI subprocess.
// Detect the failure up front by parsing the proxy URL and opening a TCP
// connection to host:port. Only after the proxy answers do we instantiate
// CopilotClient. This shortens "why is it hanging" to a 3-second hard error.
//
// Run: node examples/simple-sdk/09-proxy-preflight.mjs

import net from "node:net";
import { CopilotClient } from "@github/copilot-sdk";

// Disable any user-configured MCP servers so this example runs against the
// bare SDK surface only.
process.env.COPILOT_DISABLE_MCP = "1";

const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
if (!proxy) {
  console.log("no HTTPS_PROXY set; assuming direct connection.");
} else {
  const { hostname, port } = new URL(proxy);
  const portNum = Number(port) || 8080;
  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: hostname, port: portNum, timeout: 3000 });
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`proxy ${hostname}:${portNum} did not accept TCP within 3s`));
    });
    socket.once("error", reject);
  }).catch((err) => {
    console.error(`proxy preflight failed: ${err.message}`);
    process.exit(2);
  });
  console.log(`proxy ${hostname}:${portNum} reachable.`);
}

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const response = await session.sendAndWait({ prompt: "Reply with OK." });
console.log(response?.data.content);

await client.stop();
process.exit(0);
