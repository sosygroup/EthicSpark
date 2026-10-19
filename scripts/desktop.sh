#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
./scripts/run.sh
runtime_node=$(./scripts/node-runtime.sh)
runtime_root=$(dirname "$(dirname "$runtime_node")")
PATH="$runtime_root/bin:$PATH"
export PATH
# Follow the backend actually started by Compose, including a custom APP_PORT.
if [ -z "${ETHICSPARK_URL:-}" ]; then
  backend_address=$(docker compose port application 8082)
  backend_port=${backend_address##*:}
  # Keep the existing localhost origin so saved model settings remain available.
  case "$backend_port" in ''|*[!0-9]*) printf '%s\n' 'Cannot determine the local application port.' >&2; exit 1;; esac
  ETHICSPARK_URL="http://localhost:$backend_port/"
  export ETHICSPARK_URL
fi
printf '[EthicSpark] Launcher project: %s\n' "$PWD"
"$runtime_node" "$runtime_root/lib/node_modules/npm/bin/npm-cli.js" ci --prefix desktop --no-audit --no-fund
"$runtime_node" desktop/node_modules/electron/install.js
exec "$runtime_node" desktop/node_modules/electron/cli.js desktop
