#!/usr/bin/env bash
# Redeploy the frontend on the Hetzner box. Run from the repo root.
set -euo pipefail

cd "$(dirname "$0")/.."

# The compose file lives in docker/ -- the root docker-compose.yml was removed.
# Every compose call must name it explicitly or docker finds nothing.
COMPOSE="docker compose -f docker/docker-compose.yml"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Checking build-time env"
# NEXT_PUBLIC_* are inlined into the bundle during `next build`, read from the
# .env that compose mounts as a BuildKit secret. If the backend URL is missing
# the build silently bakes in an empty string and API calls break at runtime.
if ! grep -qE '^NEXT_PUBLIC_(API_URL_PROD|SERVER_URL)=.+' .env 2>/dev/null; then
  echo "!! .env has no NEXT_PUBLIC_API_URL_PROD or NEXT_PUBLIC_SERVER_URL." >&2
  echo "!! Refusing to build -- the frontend would ship without a backend URL." >&2
  exit 1
fi

echo "==> Building image"
# --build is required for any NEXT_PUBLIC_* change: those are inlined at build time.
$COMPOSE build

echo "==> Restarting container"
$COMPOSE up -d

echo "==> Waiting for health check"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "==> Healthy. Deploy complete."
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "!! Health check failed after 60s. Recent logs:" >&2
$COMPOSE logs --tail=50 >&2
exit 1
