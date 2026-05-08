#!/usr/bin/env python3
"""scan_token.py — locate cached GitHub Copilot / gh CLI / Anthropic OAuth
tokens on disk and in the environment. Read-only.

Usage:
    python3 scan_token.py              # redacted preview
    python3 scan_token.py --show       # print full tokens (DANGEROUS)
    python3 scan_token.py --json       # one JSON object per line

See README.md for the OAuth-scope caveat: a Copilot session/CAPI token is NOT
a GitHub PAT and will not authenticate api.github.com REST calls.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

PAT_RE = re.compile(
    r"(?:gh[psoura]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,})"
)
KV_RE = re.compile(
    r'"(access_token|oauth_token|github_token|token|api_token|refresh_token|copilot_token)"'
    r'\s*:\s*"([^"]+)"'
)
YAML_RE = re.compile(
    r"^\s*(oauth_token|github_token|token):\s*([^\s#]+)", re.MULTILINE
)
TOKEN_KEYS = {"access_token", "oauth_token", "github_token", "token",
              "api_token", "refresh_token", "copilot_token"}
SKIP_EXT = {".db", ".wasm", ".so", ".dylib", ".a", ".zip", ".gz",
            ".png", ".jpg", ".jpeg", ".ico", ".pdf", ".bin"}
MAX_SIZE = 1024 * 1024
ENV_KEYS = [
    "GITHUB_TOKEN", "GH_TOKEN",
    "GITHUB_COPILOT_GITHUB_TOKEN", "COPILOT_GITHUB_TOKEN",
    "GITHUB_COPILOT_API_TOKEN", "GITHUB_VERIFICATION_TOKEN",
    "ANTHROPIC_API_KEY",
]


def candidate_dirs() -> list[Path]:
    home = Path.home()
    xdg_cache = Path(os.environ.get("XDG_CACHE_HOME", home / ".cache"))
    xdg_config = Path(os.environ.get("XDG_CONFIG_HOME", home / ".config"))
    out: list[Path] = []
    if v := os.environ.get("COPILOT_HOME"):
        out.append(Path(v))
    out.append(home / ".copilot")
    if v := os.environ.get("COPILOT_CACHE_HOME"):
        out.append(Path(v))
    if sys.platform == "darwin":
        out.append(home / "Library" / "Caches" / "copilot")
    elif sys.platform == "win32":
        if v := os.environ.get("LOCALAPPDATA"):
            out.append(Path(v) / "copilot")
    else:
        out.append(xdg_cache / "copilot")
    if v := os.environ.get("ANTHROPIC_CONFIG_DIR"):
        out.append(Path(v))
    out.append(xdg_config / "anthropic")
    out.append(xdg_config / "gh")
    out.append(xdg_config / "github-copilot")
    return out


def redact(value: str, show: bool) -> str:
    if show:
        return value
    if len(value) <= 12:
        return f"[short:{len(value)}c]"
    return f"{value[:8]}…{value[-4:]}"


def visit_json(obj, prefix: str, sink):
    if isinstance(obj, dict):
        for k, v in obj.items():
            full = f"{prefix}.{k}" if prefix else k
            if isinstance(v, str) and k in TOKEN_KEYS and len(v) >= 16:
                sink(full, v)
            elif isinstance(v, (dict, list)):
                visit_json(v, full, sink)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            visit_json(v, f"{prefix}[{i}]", sink)


def scan_file(path: Path, findings: list, show: bool) -> None:
    if path.suffix.lower() in SKIP_EXT:
        return
    try:
        size = path.stat().st_size
    except OSError:
        return
    if size == 0 or size > MAX_SIZE:
        return
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return
    if "\0" in text[:4096]:
        return

    src = str(path)

    def add(key: str, val: str) -> None:
        findings.append({
            "source": src, "key": key,
            "preview": redact(val, show), "length": len(val),
        })

    for m in PAT_RE.finditer(text):
        add("pattern", m.group(0))

    if path.suffix == ".json" or text.lstrip().startswith("{"):
        try:
            visit_json(json.loads(text), "", add)
        except json.JSONDecodeError:
            pass

    for m in KV_RE.finditer(text):
        add(m.group(1), m.group(2))
    for m in YAML_RE.finditer(text):
        if len(m.group(2)) >= 16:
            add(m.group(1), m.group(2))


def main() -> int:
    ap = argparse.ArgumentParser(description="Scan for cached OAuth tokens.")
    ap.add_argument("--show", action="store_true",
                    help="print full tokens (default: redact)")
    ap.add_argument("--json", action="store_true",
                    help="emit one JSON object per finding")
    args = ap.parse_args()

    findings: list[dict] = []
    for k in ENV_KEYS:
        v = os.environ.get(k)
        if v:
            findings.append({
                "source": "env", "key": k,
                "preview": redact(v, args.show), "length": len(v),
            })

    seen: set[Path] = set()
    dirs = candidate_dirs()
    for d in dirs:
        if d in seen or not d.is_dir():
            continue
        seen.add(d)
        for path in d.rglob("*"):
            if path.is_file():
                scan_file(path, findings, args.show)

    if args.json:
        for r in findings:
            print(json.dumps(r))
        return 0

    print("# scan_token.py — read-only token scan (--show to reveal full tokens)")
    print("# Locations checked:")
    for d in dirs:
        print(f"#   {d}")
    print()
    print(f"{'SOURCE':<60} {'KEY':<22} PREVIEW")
    print(f"{'------':<60} {'---':<22} -------")
    for r in findings:
        print(f"{r['source']:<60} {r['key']:<22} {r['preview']}  (len={r['length']})")
    if not findings:
        print("(no tokens found — run `copilot` or `gh auth login` to populate caches)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
