#!/usr/bin/env node
// scan-token.mjs — locate cached GitHub Copilot / gh CLI / Anthropic OAuth
// tokens on disk and in the environment. Read-only.
//
// Usage:
//   node scan-token.mjs                 # redacted preview
//   node scan-token.mjs --show          # print full tokens (DANGEROUS)
//   node scan-token.mjs --json          # structured findings, one JSON object per line
//
// See README.md for the OAuth-scope caveat: a Copilot session/CAPI token is
// NOT a GitHub PAT and will not authenticate api.github.com REST calls.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { homedir, platform } from "node:os";

const argv = new Set(process.argv.slice(2));
const SHOW = argv.has("--show");
const JSON_OUT = argv.has("--json");

// --- candidate locations (mirrors @github/copilot CLI resolution) ---------
const home = homedir();
const xdgCache = process.env.XDG_CACHE_HOME || join(home, ".cache");
const xdgConfig = process.env.XDG_CONFIG_HOME || join(home, ".config");

const candidates = [];
if (process.env.COPILOT_HOME) candidates.push(process.env.COPILOT_HOME);
candidates.push(join(home, ".copilot"));

if (process.env.COPILOT_CACHE_HOME) candidates.push(process.env.COPILOT_CACHE_HOME);
if (platform() === "darwin") candidates.push(join(home, "Library", "Caches", "copilot"));
else if (platform() === "win32" && process.env.LOCALAPPDATA)
  candidates.push(join(process.env.LOCALAPPDATA, "copilot"));
else candidates.push(join(xdgCache, "copilot"));

if (process.env.ANTHROPIC_CONFIG_DIR) candidates.push(process.env.ANTHROPIC_CONFIG_DIR);
candidates.push(join(xdgConfig, "anthropic"));

candidates.push(join(xdgConfig, "gh"));
candidates.push(join(xdgConfig, "github-copilot"));

const ENV_KEYS = [
  "GITHUB_TOKEN", "GH_TOKEN",
  "GITHUB_COPILOT_GITHUB_TOKEN", "COPILOT_GITHUB_TOKEN",
  "GITHUB_COPILOT_API_TOKEN", "GITHUB_VERIFICATION_TOKEN",
  "ANTHROPIC_API_KEY",
];

const SKIP_EXT = new Set([
  ".db", ".wasm", ".so", ".dylib", ".a", ".zip", ".gz",
  ".png", ".jpg", ".jpeg", ".ico", ".pdf", ".bin",
]);
const MAX_SIZE = 1024 * 1024;

const PAT_RE = /(?:gh[psoura]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,})/g;
const TOKEN_KEYS = ["access_token", "oauth_token", "github_token", "token",
                    "api_token", "refresh_token", "copilot_token"];

const findings = [];

function redact(v) {
  if (SHOW) return v;
  if (v.length <= 12) return `[short:${v.length}c]`;
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

function record(source, key, value) {
  if (!value) return;
  findings.push({ source, key, preview: redact(value), length: value.length });
}

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

function scanFile(path) {
  if (SKIP_EXT.has(extname(path).toLowerCase())) return;
  let st; try { st = statSync(path); } catch { return; }
  if (st.size > MAX_SIZE || st.size === 0) return;

  let text;
  try { text = readFileSync(path, "utf-8"); } catch { return; }
  // Heuristic binary check: NUL byte in first 4KB
  if (text.slice(0, 4096).includes("\0")) return;

  // 1. Token-shaped substrings
  for (const m of text.matchAll(PAT_RE)) record(path, "pattern", m[0]);

  // 2. JSON keys
  if (path.endsWith(".json") || text.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const visit = (obj, prefix = "") => {
        if (!obj || typeof obj !== "object") return;
        for (const [k, v] of Object.entries(obj)) {
          const full = prefix ? `${prefix}.${k}` : k;
          if (typeof v === "string" && TOKEN_KEYS.includes(k) && v.length >= 16) {
            record(path, full, v);
          } else if (v && typeof v === "object") visit(v, full);
        }
      };
      visit(parsed);
    } catch {
      // Fall through to regex
    }
  }
  // Always also do a regex pass for malformed/embedded JSON
  const kvRe = /"(access_token|oauth_token|github_token|token|api_token|refresh_token|copilot_token)"\s*:\s*"([^"]+)"/g;
  for (const m of text.matchAll(kvRe)) record(path, m[1], m[2]);

  // 3. YAML-style (gh CLI hosts.yml)
  const yamlRe = /^(\s*)(oauth_token|github_token|token):\s*([^\s#]+)/gm;
  for (const m of text.matchAll(yamlRe)) {
    if (m[3].length >= 16) record(path, m[2], m[3]);
  }
}

// Env vars
for (const k of ENV_KEYS) {
  if (process.env[k]) record("env", k, process.env[k]);
}

// Files
const seen = new Set();
for (const d of candidates) {
  if (seen.has(d)) continue;
  seen.add(d);
  try { statSync(d); } catch { continue; }
  for (const f of walk(d)) scanFile(f);
}

if (JSON_OUT) {
  for (const r of findings) console.log(JSON.stringify(r));
} else {
  console.log("# scan-token.mjs — read-only token scan (--show to reveal full tokens)");
  console.log("# Locations checked:");
  for (const d of candidates) console.log(`#   ${d}`);
  console.log();
  console.log("SOURCE".padEnd(60), "KEY".padEnd(22), "PREVIEW");
  console.log("------".padEnd(60), "---".padEnd(22), "-------");
  for (const r of findings) {
    console.log(r.source.padEnd(60), r.key.padEnd(22), `${r.preview}  (len=${r.length})`);
  }
  if (findings.length === 0) {
    console.log("(no tokens found — run `copilot` or `gh auth login` to populate caches)");
  }
}
