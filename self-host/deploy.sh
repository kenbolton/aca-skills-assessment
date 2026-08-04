#!/usr/bin/env bash
# Update this app on a self-hosted server: pull, verify, build, restart, prove.
#
# Run it ON the server, from anywhere:
#     ~/aca-skills-assessment/self-host/deploy.sh
#
# Why this exists: the manual sequence (ssh, pull, npm ci, build, systemctl
# restart) was easy to skip, so a server could sit days behind the repo without
# anyone noticing. This makes the whole sequence one command, and it FAILS
# LOUDLY rather than leaving a half-deployed tree.
#
# Two deliberate choices:
#   1. Tests gate the build. A server that serves a broken build offline is
#      worse than one that stayed on the last good build.
#   2. It health-checks AFTER restarting. systemd reports "active" for a
#      process that started and immediately misbehaves, so "active" is not
#      evidence the app is being served.
#
# NOTE: lessons-content/*.html is git-ignored and arrives by rsync, not by
# pull. This script never touches it, so a deploy cannot silently drop the
# private teaching content.

set -euo pipefail

SERVICE=aca-assessment
PORT=8787
HEALTH_PATH=/api/sessions       # returns a JSON array; cheap and side-effect free

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

say "Repo: $REPO"
git rev-parse --short HEAD | sed 's/^/before: /'

say "Pulling"
# --ff-only: refuse to create a merge commit on a server. If this fails, the
# server has local commits and a human needs to look at it.
git pull --ff-only

AFTER=$(git rev-parse --short HEAD)
echo "after:  $AFTER"

say "Installing dependencies (npm ci)"
npm ci --silent

say "Running tests (deploy gate)"
npm test

say "Building"
# BASE_PATH=/  -> served at the site root, not a GitHub Pages subpath.
# VITE_PRIVATE -> Sync button, past-assessments archive, teaching links.
BASE_PATH=/ VITE_PRIVATE=true npm run build

say "Restarting $SERVICE"
sudo systemctl restart "$SERVICE"

say "Health check"
for i in $(seq 1 10); do
  sleep 2
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:${PORT}${HEALTH_PATH}" || true)
  if [ "$code" = "200" ]; then
    echo "OK: ${HEALTH_PATH} returned 200 after ~$((i * 2))s"
    echo "Deployed $AFTER"
    exit 0
  fi
done

echo "FAILED: ${HEALTH_PATH} never returned 200. Service state:" >&2
systemctl --no-pager --lines=20 status "$SERVICE" >&2 || true
exit 1
