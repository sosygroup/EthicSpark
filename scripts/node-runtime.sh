#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
version=22.16.0
case "$(uname -s)" in Darwin) platform=darwin;; Linux) platform=linux;; *) printf '%s\n' 'Desktop launcher currently supports macOS and Linux.' >&2; exit 1;; esac
case "$(uname -m)" in arm64|aarch64) architecture=arm64;; x86_64|amd64) architecture=x64;; *) printf '%s\n' 'Unsupported desktop architecture.' >&2; exit 1;; esac
runtime_dir="$PWD/tmp/desktop-runtime/node-v$version-$platform-$architecture"
if [ ! -x "$runtime_dir/bin/node" ]; then
  mkdir -p "$PWD/tmp/desktop-runtime"
  archive="node-v$version-$platform-$architecture.tar.gz"
  curl -fsSL "https://nodejs.org/dist/v$version/$archive" -o "$PWD/tmp/desktop-runtime/$archive"
  curl -fsSL "https://nodejs.org/dist/v$version/SHASUMS256.txt" -o "$PWD/tmp/desktop-runtime/SHASUMS256.txt"
  expected=$(awk -v archive="$archive" '$2 == archive {print $1}' "$PWD/tmp/desktop-runtime/SHASUMS256.txt")
  if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$PWD/tmp/desktop-runtime/$archive" | awk '{print $1}'); else actual=$(shasum -a 256 "$PWD/tmp/desktop-runtime/$archive" | awk '{print $1}'); fi
  [ -n "$expected" ] && [ "$actual" = "$expected" ] || { printf '%s\n' 'Node runtime checksum failed.' >&2; exit 1; }
  tar -xzf "$PWD/tmp/desktop-runtime/$archive" -C "$PWD/tmp/desktop-runtime"
fi
printf '%s\n' "$runtime_dir/bin/node"
