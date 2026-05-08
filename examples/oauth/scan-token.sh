#!/usr/bin/env bash
# scan-token.sh — locate cached GitHub Copilot / gh CLI / Anthropic OAuth tokens
# on disk and in the environment.
#
# Usage:
#   ./scan-token.sh              # redacted preview of any tokens found
#   ./scan-token.sh --show       # print full tokens (DANGEROUS, never pipe to logs)
#   ./scan-token.sh --json       # emit structured findings as JSON-ish lines
#
# Read-only. Walks documented cache locations, JSON/YAML config files, and env
# vars. See README.md for the OAuth-scope caveat — a Copilot session token is
# NOT the same thing as a PAT and will not authenticate api.github.com calls.

set -u

SHOW=0
JSON=0
for arg in "$@"; do
  case "$arg" in
    --show) SHOW=1 ;;
    --json) JSON=1 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# --- candidate locations (mirrors @github/copilot CLI resolution) ---------
candidates=()

# Primary copilot home
[ -n "${COPILOT_HOME:-}" ] && candidates+=("$COPILOT_HOME")
candidates+=("$HOME/.copilot")

# Package cache
[ -n "${COPILOT_CACHE_HOME:-}" ] && candidates+=("$COPILOT_CACHE_HOME")
case "$(uname -s)" in
  Darwin) candidates+=("$HOME/Library/Caches/copilot") ;;
  Linux)  candidates+=("${XDG_CACHE_HOME:-$HOME/.cache}/copilot") ;;
  MINGW*|MSYS*|CYGWIN*) [ -n "${LOCALAPPDATA:-}" ] && candidates+=("$LOCALAPPDATA/copilot") ;;
esac

# Anthropic SDK profile credentials (used by Copilot managed-agents flow)
[ -n "${ANTHROPIC_CONFIG_DIR:-}" ] && candidates+=("$ANTHROPIC_CONFIG_DIR")
candidates+=("${XDG_CONFIG_HOME:-$HOME/.config}/anthropic")

# gh CLI (token frequently lives here on developer machines)
candidates+=("${XDG_CONFIG_HOME:-$HOME/.config}/gh")
candidates+=("${XDG_CONFIG_HOME:-$HOME/.config}/github-copilot")

# --- env-var sweep --------------------------------------------------------
env_keys=(
  GITHUB_TOKEN GH_TOKEN
  GITHUB_COPILOT_GITHUB_TOKEN COPILOT_GITHUB_TOKEN
  GITHUB_COPILOT_API_TOKEN GITHUB_VERIFICATION_TOKEN
  ANTHROPIC_API_KEY
)

redact() {
  # echo first 8 chars + … + last 4 chars
  local v="$1"
  local n=${#v}
  if [ "$SHOW" -eq 1 ]; then printf '%s' "$v"; return; fi
  if [ "$n" -le 12 ]; then printf '%s' "[short:${n}c]"; return; fi
  printf '%s…%s' "${v:0:8}" "${v: -4}"
}

emit() {
  # emit source key value
  local source="$1" key="$2" val="$3"
  local preview; preview="$(redact "$val")"
  if [ "$JSON" -eq 1 ]; then
    printf '{"source":"%s","key":"%s","preview":"%s","length":%d}\n' \
      "$source" "$key" "$preview" "${#val}"
  else
    printf '%-42s %-22s %s  (len=%d)\n' "$source" "$key" "$preview" "${#val}"
  fi
}

# Token-shaped patterns (GitHub PAT / OAuth / app installation tokens)
PAT_RE='(ghp|ghs|gho|ghu|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,}'

scan_file() {
  local f="$1"
  # Skip non-regular and obviously binary files
  [ -f "$f" ] || return 0
  case "$f" in
    *.db|*.wasm|*.so|*.dylib|*.a|*.zip|*.gz|*.png|*.jpg|*.jpeg|*.ico|*.pdf|*.bin) return 0 ;;
  esac
  # Skip files >1MB (token files are tiny)
  local size
  size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null || echo 0)
  [ "$size" -gt 1048576 ] && return 0

  # 1. Token-shaped substrings
  local hits
  hits=$(grep -aoE "$PAT_RE" "$f" 2>/dev/null | sort -u)
  if [ -n "$hits" ]; then
    while IFS= read -r tok; do emit "$f" "pattern" "$tok"; done <<<"$hits"
  fi

  # 2. JSON-style key=value pairs for likely token fields
  local kv
  kv=$(grep -aoE '"(access_token|oauth_token|github_token|token|api_token|refresh_token|copilot_token)"[[:space:]]*:[[:space:]]*"[^"]+"' "$f" 2>/dev/null)
  if [ -n "$kv" ]; then
    while IFS= read -r line; do
      local k v
      k=$(printf '%s' "$line" | sed -E 's/^"([^"]+)".*/\1/')
      v=$(printf '%s' "$line" | sed -E 's/.*"([^"]+)"$/\1/')
      [ -n "$v" ] && emit "$f" "$k" "$v"
    done <<<"$kv"
  fi

  # 3. YAML-style oauth_token: value (gh CLI hosts.yml)
  local yhits
  yhits=$(grep -aoE '(oauth_token|github_token|token):[[:space:]]*[A-Za-z0-9_!@#$%^&*()-]{16,}' "$f" 2>/dev/null)
  if [ -n "$yhits" ]; then
    while IFS= read -r line; do
      local k v
      k=$(printf '%s' "$line" | sed -E 's/^([a-z_]+):.*/\1/')
      v=$(printf '%s' "$line" | sed -E 's/^[a-z_]+:[[:space:]]*//')
      [ -n "$v" ] && emit "$f" "$k" "$v"
    done <<<"$yhits"
  fi
}

[ "$JSON" -eq 0 ] && {
  echo "# scan-token.sh — read-only token scan (--show to reveal full tokens)"
  echo "# Locations checked:"
  for d in "${candidates[@]}"; do echo "#   $d"; done
  echo
  printf '%-42s %-22s %s\n' "SOURCE" "KEY" "PREVIEW"
  printf '%-42s %-22s %s\n' "------" "---" "-------"
}

# Env vars first
for k in "${env_keys[@]}"; do
  v="${!k:-}"
  [ -n "$v" ] && emit "env" "$k" "$v"
done

# Then files
seen=""
for d in "${candidates[@]}"; do
  [ -d "$d" ] || continue
  case ":$seen:" in *":$d:"*) continue ;; esac
  seen="$seen:$d"
  while IFS= read -r f; do scan_file "$f"; done < <(find "$d" -type f 2>/dev/null)
done

[ "$JSON" -eq 0 ] && echo
[ "$JSON" -eq 0 ] && echo "# Done. If empty: run \`copilot\` or \`gh auth login\` first to populate caches."
