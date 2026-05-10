#!/usr/bin/env bash

set -euo pipefail

ENV_NAME="${1:-development}"
shift || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.${ENV_NAME}"

if [[ "$ENV_NAME" != "development" && "$ENV_NAME" != "production" ]]; then
  echo "Error: unsupported env '$ENV_NAME'. Use development or production."
  exit 1
fi

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 [development|production] <command...>"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

export APP_ENV="$ENV_NAME"

echo "Using env: $ENV_NAME"
echo "Env file: $ENV_FILE"

exec "$@"
