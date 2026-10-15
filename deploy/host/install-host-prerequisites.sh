#!/usr/bin/env bash
# Administrator-only check. Does not grant sudo or docker group to the runner.
set -euo pipefail
fail=0
need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "MISSING: $1" >&2
    fail=1
  else
    echo "ok $1 $($1 --version 2>/dev/null | head -1 || true)"
  fi
}
need docker
if command -v docker >/dev/null 2>&1; then
  docker compose version >/dev/null 2>&1 || { echo "MISSING: docker compose plugin" >&2; fail=1; }
  docker info >/dev/null 2>&1 || { echo "FAIL: docker daemon" >&2; fail=1; }
fi
[[ "$(uname -m)" == "x86_64" ]] || { echo "FAIL: need x86_64" >&2; fail=1; }
timedatectl status >/dev/null 2>&1 && timedatectl | grep -q 'synchronized: yes' || echo "WARN: check NTP sync"
echo "disk $(df -h / | awk 'NR==2{print $4}') free"
echo "memory $(free -h | awk '/Mem:/{print $7}') available"
id runner-memora-backend >/dev/null 2>&1 && echo "ok user runner-memora-backend" || echo "WARN: create user runner-memora-backend for the GitHub runner"
echo "Cloudflare Tunnel: confirm cloudflared is already running; this script does not change it."
echo "Install Docker with deploy/host/install-docker.sh if needed, then install-deploy-helper.sh."
exit "$fail"
