#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
./scripts/run.sh
runtime_node=$(./scripts/node-runtime.sh)
runtime_root=$(dirname "$(dirname "$runtime_node")")
PATH="$runtime_root/bin:$PATH"
export PATH
"$runtime_node" "$runtime_root/lib/node_modules/npm/bin/npm-cli.js" ci --prefix desktop --no-audit --no-fund
"$runtime_node" desktop/node_modules/electron/install.js
exec "$runtime_node" desktop/node_modules/electron/cli.js desktop
