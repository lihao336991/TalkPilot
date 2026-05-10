#!/usr/bin/env bash

set -euo pipefail

PROFILE="${1:-preview}"
MESSAGE="${2:-}"
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

resolve_channel() {
  case "$1" in
    development) echo "development" ;;
    preview|production) echo "production" ;;
    preview-devtools) echo "preview-devtools" ;;
    *)
      echo "Error: invalid profile '$1'" >&2
      exit 1
      ;;
  esac
}

usage() {
  echo "Usage: $0 [profile] [message]"
  echo
  echo "profile: development | preview | preview-devtools | production (default: preview)"
  echo "message: optional EAS update message"
  echo
  echo "Examples:"
  echo "  $0 preview \"Fix transcript bubble layout\""
  echo "  $0 preview-devtools \"Debug build update\""
  echo "  $0 production \"Release 1.0.0 hotfix\""
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

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required but not found."
  exit 1
fi

ENV_NAME="$(resolve_env_name "$PROFILE")"
CHANNEL="$(resolve_channel "$PROFILE")"
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

echo "Starting EAS update..."
echo "Profile : $PROFILE"
echo "Channel : $CHANNEL"
echo "Env     : $ENV_NAME"
echo "Env file: $ENV_FILE"

if [[ -n "$MESSAGE" ]]; then
  npx eas update --channel "$CHANNEL" --message "$MESSAGE"
else
  npx eas update --channel "$CHANNEL"
fi
