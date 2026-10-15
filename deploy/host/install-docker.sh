#!/usr/bin/env bash
# Administrator-only, one-time. Installs Docker Engine from Docker's official Ubuntu repo.
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi
if command -v docker >/dev/null 2>&1; then
  docker version
  echo "Docker already installed; nothing to do."
  exit 0
fi
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker compose version
echo "Do NOT add the GitHub runner user to group docker unless you accept root-equivalent access."
