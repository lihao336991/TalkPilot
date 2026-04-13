#!/bin/bash

set -euo pipefail

# TalkPilot Edge Functions Secrets Sync Script
# Pushes local .env values to Supabase Edge Functions secrets

PROJECT_REF="${PROJECT_REF:-joweqhgtueqfeasweigh}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEFAULT_ENV_FILE="$REPO_ROOT/.env"
ENV_FILE="${1:-$DEFAULT_ENV_FILE}"

show_usage() {
    echo "Usage: ./sync-secrets.sh [env_file]"
    echo ""
    echo "Examples:"
    echo "  ./sync-secrets.sh"
    echo "  ./sync-secrets.sh ../../.env"
    echo "  PROJECT_REF=your-project-ref ./sync-secrets.sh"
    exit 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    show_usage
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Env file not found: $ENV_FILE"
    exit 1
fi

echo "==========================================="
echo "🔐 Syncing Supabase Edge Function secrets"
echo "==========================================="
echo "Project: $PROJECT_REF"
echo "Env file: $ENV_FILE"
echo ""
echo "This updates Supabase Edge Functions secrets only."
echo "Secret values will not be printed."
echo ""

npx supabase secrets set --env-file "$ENV_FILE" --project-ref "$PROJECT_REF"

echo ""
echo "✅ Secrets synced successfully."
echo "Tip: if you changed provider/model keys, redeploy functions with ./deploy.sh all"
