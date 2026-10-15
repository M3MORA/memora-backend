#!/usr/bin/env bash
set -euo pipefail
exec "$(dirname "$0")/../host/memora-deploy.sh" bootstrap "$@"
