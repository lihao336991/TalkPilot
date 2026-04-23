#!/usr/bin/env bash

set -euo pipefail

PROFILE="${1:-development}"
PLATFORM="${2:-ios}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

resolve_env_name() {
  case "$1" in
    development|preview) echo "development" ;;
    production) echo "production" ;;
    *)
      echo "Error: invalid profile '$1'" >&2
      exit 1
      ;;
  esac
}

usage() {
  echo "Usage: $0 [profile] [platform]"
  echo
  echo "profile: development | preview | production (default: development)"
  echo "platform: ios | android | all (default: ios)"
  echo
  echo "Examples:"
  echo "  $0"
  echo "  $0 preview ios"
  echo "  $0 production all"
}

case "$PROFILE" in
  development|preview|production) ;;
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

echo "Starting EAS cloud build..."
echo "Profile : $PROFILE"
echo "Platform: $PLATFORM"
echo "Env     : $ENV_NAME"
echo "Env file: $ENV_FILE"

npx eas build --profile "$PROFILE" --platform "$PLATFORM"
