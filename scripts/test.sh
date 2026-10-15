#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
cleanup() { docker compose -f compose.test.yaml down --remove-orphans >/dev/null; }
trap cleanup EXIT HUP INT TERM
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from tests
