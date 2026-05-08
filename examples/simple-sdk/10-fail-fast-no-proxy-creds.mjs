// 10 — Fail fast when proxy auth is required but missing
//
// In environments that mandate a proxy (corporate networks, locked-down CI
// runners), opening the SDK without HTTPS_PROXY hangs until the underlying
// CLI's connect timeout fires — minutes, not seconds, with no clear cause.
// `gh copilot` will not interactively prompt for proxy credentials, so the
// host either has them in the environment or the call cannot succeed.
//
// REQUIRE_PROXY=1 declares "this host needs a proxy". Set it for CI runners
// where direct egress is blocked. The script then refuses to start unless
// HTTPS_PROXY is set AND contains embedded user:password.
//
// Run:
//   REQUIRE_PROXY=1 node examples/simple-sdk/10-fail-fast-no-proxy-creds.mjs
//   REQUIRE_PROXY=1 HTTPS_PROXY=http://user:pass@proxy.example.com:8080 \
//     node examples/simple-sdk/10-fail-fast-no-proxy-creds.mjs

import { CopilotClient } from "@github/copilot-sdk";

if (process.env.REQUIRE_PROXY === "1") {
  const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  if (!proxy) {
    console.error("REQUIRE_PROXY=1 but neither HTTPS_PROXY nor HTTP_PROXY is set.");
    console.error('export HTTPS_PROXY="http://user:pass@proxy.example.com:8080"');
    process.exit(2);
  }
  const { username, password, hostname, port } = new URL(proxy);
  if (!username || !password) {
    console.error(`proxy URL ${hostname}:${port} has no embedded credentials.`);
    console.error("gh copilot does not prompt — embed user:pass directly in the URL.");
    process.exit(2);
  }
}

const client = new CopilotClient();
const session = await client.createSession({ model: "gpt-4.1" });

const response = await session.sendAndWait({ prompt: "Reply with OK." });
console.log(response?.data.content);

await client.stop();
process.exit(0);
