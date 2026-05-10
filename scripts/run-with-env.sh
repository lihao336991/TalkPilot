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

resolve_supabase_ref_from_url() {
  local url="$1"
  url="${url#https://}"
  url="${url#http://}"
  echo "${url%%.*}"
}

set -a
source "$ENV_FILE"
set +a

export APP_ENV="$ENV_NAME"
export EXPO_PUBLIC_APP_ENV="$ENV_NAME"
export EXPO_NO_DOTENV=1

SUPABASE_URL_REF="$(resolve_supabase_ref_from_url "${EXPO_PUBLIC_SUPABASE_URL:-}")"
if [[ -z "${SUPABASE_PROJECT_REF:-}" || "$SUPABASE_URL_REF" != "$SUPABASE_PROJECT_REF" ]]; then
  echo "Error: Supabase env mismatch."
  echo "SUPABASE_PROJECT_REF=$SUPABASE_PROJECT_REF"
  echo "EXPO_PUBLIC_SUPABASE_URL ref=$SUPABASE_URL_REF"
  exit 1
fi

echo "Using env: $ENV_NAME"
echo "Env file: $ENV_FILE"
echo "Supabase: $SUPABASE_URL_REF"
echo "Dotenv  : disabled for Expo CLI"

exec "$@"
