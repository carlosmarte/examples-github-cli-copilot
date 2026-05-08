// 01 — Store COPILOT_GITHUB_TOKEN in the macOS Keychain
//
// The docker-compose stack reads COPILOT_GITHUB_TOKEN from the host
// environment. Avoid putting it in a shared shell rc file or a checked-in
// .env. Store it once in the user's login Keychain and read at compose-up
// time (see tests/02 and tests/03). Same Keychain pattern as
// `examples/simple-sdk/11-keychain-proxy-creds.mjs`.
//
// Service:  copilot-sdk-docker
// Account:  github-token
//
// Run: node examples/docker/tests/01-keychain-store-token.mjs
//
// To clear:
//   security delete-generic-password -s copilot-sdk-docker -a github-token

import { execFileSync } from "node:child_process";
import readline from "node:readline";
import { Writable } from "node:stream";

if (process.platform !== "darwin") {
  console.error("this test uses macOS Keychain (`security`); not portable.");
  process.exit(1);
}

const SERVICE = "copilot-sdk-docker";
const ACCOUNT = "github-token";

async function ask(label, { mask = false } = {}) {
  const out = mask
    ? new Writable({ write(_chunk, _enc, cb) { cb(); } })
    : process.stdout;
  const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
  process.stdout.write(label);
  const answer = await new Promise((resolve) => rl.question("", resolve));
  rl.close();
  if (mask) process.stdout.write("\n");
  return answer.trim();
}

const token = await ask("paste COPILOT_GITHUB_TOKEN (input hidden): ", { mask: true });

// Shape-check: GitHub PATs (classic ghp_*, fine-grained github_pat_*) are
// well above 20 chars and ASCII-only. Reject the obvious junk before we
// commit it to the Keychain.
if (token.length < 20 || !/^[\x21-\x7e]+$/.test(token)) {
  console.error("token looks too short or contains non-printable bytes; refusing to store.");
  process.exit(1);
}

execFileSync("security", [
  "add-generic-password",
  "-U",
  "-s", SERVICE,
  "-a", ACCOUNT,
  "-w", token,
]);
console.log(`stored COPILOT_GITHUB_TOKEN in Keychain (${SERVICE}/${ACCOUNT}).`);
