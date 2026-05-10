#!/usr/bin/env bash

set -euo pipefail

PROFILE="${1:-development}"
PLATFORM="${2:-ios}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

resolve_env_name() {
  case "$1" in
    development) echo "development" ;;
    preview|preview-devtools|production) echo "production" ;;
    *)
      echo "Error: invalid profile '$1'" >&2
      exit 1
      ;;
  esac
}

usage() {
  echo "Usage: $0 [profile] [platform]"
  echo
  echo "profile: development | preview | preview-devtools | production (default: development)"
  echo "platform: ios | android | all (default: ios)"
  echo
  echo "Examples:"
  echo "  $0"
  echo "  $0 preview ios"
  echo "  $0 preview-devtools ios"
  echo "  $0 production all"
}

case "$PROFILE" in
  development|preview|preview-devtools|production) ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "Error: invalid profile '$PROFILE'"
    usage
    exit 1
    ;;
esac

case "$PLATFORM" in
  ios|android|all) ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "Error: invalid platform '$PLATFORM'"
    usage
    exit 1
    ;;
esac

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required but not found."
  exit 1
fi

resolve_supabase_ref_from_url() {
  local url="$1"
  url="${url#https://}"
  url="${url#http://}"
  echo "${url%%.*}"
}

ENV_NAME="$(resolve_env_name "$PROFILE")"
ENV_FILE="$REPO_ROOT/.env.${ENV_NAME}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE"
  exit 1
fi

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

echo "Starting EAS cloud build..."
echo "Profile : $PROFILE"
echo "Platform: $PLATFORM"
echo "Env     : $ENV_NAME"
echo "Env file: $ENV_FILE"
echo "Supabase: $SUPABASE_URL_REF"
echo "Dotenv  : disabled for Expo CLI"

npx eas build --profile "$PROFILE" --platform "$PLATFORM"
