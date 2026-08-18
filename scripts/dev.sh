#!/usr/bin/env bash
# Install all dependencies and run the dev servers:
#   - PocketBase backend on http://127.0.0.1:8090 (auto-downloads the binary pinned in pocketbase/Dockerfile)
#   - Vite shell frontend on http://localhost:1420
# Ctrl+C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PB_DIR="$ROOT/pocketbase"
PB_BIN="$PB_DIR/pocketbase"
PB_URL="${VITE_PB_URL:-http://127.0.0.1:8090}"
PB_HTTP="${PB_URL#http://}"

# --- dependencies ---------------------------------------------------------

# Prefer corepack so the pnpm version pinned in package.json ("packageManager")
# is used even when an older global pnpm shadows it.
if command -v corepack >/dev/null 2>&1; then
  PNPM=(corepack pnpm)
elif command -v pnpm >/dev/null 2>&1; then
  PNPM=(pnpm)
else
  echo "error: pnpm is required (https://pnpm.io/installation)" >&2
  exit 1
fi

echo "==> pnpm install"
"${PNPM[@]}" install

if [[ ! -x "$PB_BIN" ]]; then
  PB_VERSION="$(sed -n 's/^ARG PB_VERSION=//p' "$PB_DIR/Dockerfile")"
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64)  PB_PLATFORM=darwin_arm64 ;;
    Darwin-x86_64) PB_PLATFORM=darwin_amd64 ;;
    Linux-aarch64) PB_PLATFORM=linux_arm64 ;;
    Linux-x86_64)  PB_PLATFORM=linux_amd64 ;;
    *) echo "error: unsupported platform $(uname -s)-$(uname -m); install pocketbase manually" >&2; exit 1 ;;
  esac
  echo "==> downloading pocketbase v$PB_VERSION ($PB_PLATFORM)"
  curl -fsSL -o /tmp/pb.zip \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_PLATFORM}.zip"
  unzip -o -q /tmp/pb.zip pocketbase -d "$PB_DIR"
  rm /tmp/pb.zip
fi

# --- run both servers -----------------------------------------------------

cleanup() { kill 0 2>/dev/null; }
trap cleanup EXIT INT TERM

echo "==> pocketbase on $PB_URL"
"$PB_BIN" serve \
  --http="$PB_HTTP" \
  --dir="$PB_DIR/pb_data" \
  --migrationsDir="$PB_DIR/pb_migrations" \
  --hooksDir="$PB_DIR/pb_hooks" &

echo "==> shell on http://localhost:1420"
"${PNPM[@]}" dev &

wait
