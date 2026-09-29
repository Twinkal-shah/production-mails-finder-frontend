#!/usr/bin/env bash
# Redeploy the frontend on the Hetzner box. Run from the repo root.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building image"
# --build is required for any NEXT_PUBLIC_* change: those are inlined at build time.
docker compose build

echo "==> Restarting container"
docker compose up -d

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
docker compose logs --tail=50 >&2
exit 1
