// 05 — End-to-end probe via the api container
//
// The api container's GET /health probes copilot-cli:4321 from inside the
// docker network. A 200 means both containers are up AND can talk to each
// other; a 503 means the api is up but the CLI is unreachable from it
// (network or cli-side failure). This complements tests/04, which only
// verifies the host-mapped port.
//
// Run: node examples/docker/tests/05-api-end-to-end.mjs

const URL = process.env.API_URL ?? "http://127.0.0.1:3000/health";

const res = await fetch(URL).catch((err) => {
  console.error(`api unreachable at ${URL}: ${err.message}`);
  process.exit(1);
});

const body = await res.json().catch(() => ({}));
console.log(`api → ${res.status}`, body);

if (res.status !== 200) {
  console.error(`expected 200 from ${URL}, got ${res.status}`);
  process.exit(1);
}
if (body?.cli?.reachable !== true) {
  console.error("api says copilot-cli is not reachable from inside the docker network.");
  process.exit(1);
}
console.log("end-to-end ok.");
