#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  umask 077
  password=$(openssl rand -hex 24)
  printf 'DB_PASSWORD=%s\nAPP_PORT=8082\n' "$password" > .env
  printf '%s\n' 'Created local database credentials in .env.'
fi
docker compose up --build -d --wait
printf '%s\n' 'Catalogue service is ready. Default address: http://localhost:8082 (or APP_PORT from .env).'
