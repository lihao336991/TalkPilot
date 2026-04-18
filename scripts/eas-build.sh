#!/usr/bin/env bash

set -euo pipefail

PROFILE="${1:-development}"
PLATFORM="${2:-ios}"

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

echo "Starting EAS cloud build..."
echo "Profile : $PROFILE"
echo "Platform: $PLATFORM"

npx eas build --profile "$PROFILE" --platform "$PLATFORM"
