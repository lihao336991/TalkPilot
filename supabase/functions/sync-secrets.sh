#!/bin/bash

set -euo pipefail

# TalkPilot Edge Functions Secrets Sync Script
# Pushes local env values to Supabase Edge Functions secrets

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

show_usage() {
    echo "Usage: ./sync-secrets.sh [development|production]"
    echo ""
    echo "Examples:"
    echo "  ./sync-secrets.sh development"
    echo "  ./sync-secrets.sh production"
    exit 1
}

resolve_env_file() {
    local env_name=$1
    case "$env_name" in
        development|production)
            echo "$REPO_ROOT/.env.$env_name"
            ;;
        *)
            echo "Error: unsupported env '$env_name'" >&2
            exit 1
            ;;
    esac
}

validate_translation_provider_config() {
    local provider="${TRANSLATION_PROVIDER:-llm}"

    echo "Translation provider: $provider"

    case "$provider" in
        llm)
            echo "Using LLM translation backend for assist-reply."
            ;;
        google)
            if [[ -z "${GOOGLE_TRANSLATE_API_KEY:-}" ]]; then
                echo "❌ GOOGLE_TRANSLATE_API_KEY is required when TRANSLATION_PROVIDER=google"
                exit 1
            fi
            echo "Google Translate secret is configured."
            ;;
        azure)
            if [[ -z "${AZURE_TRANSLATOR_KEY:-}" ]]; then
                echo "❌ AZURE_TRANSLATOR_KEY is required when TRANSLATION_PROVIDER=azure"
                exit 1
            fi
            if [[ -z "${AZURE_TRANSLATOR_REGION:-}" ]]; then
                echo "❌ AZURE_TRANSLATOR_REGION is required when TRANSLATION_PROVIDER=azure"
                exit 1
            fi
            echo "Azure Translator secrets are configured."
            ;;
        *)
            echo "❌ Unsupported TRANSLATION_PROVIDER: $provider"
            echo "Expected one of: llm, google, azure"
            exit 1
            ;;
    esac
}

confirm_production() {
    local answer
    echo "⚠️  You are syncing secrets to PRODUCTION."
    read -r -p "Type 'SYNC PRODUCTION SECRETS' to continue: " answer
    if [[ "$answer" != "SYNC PRODUCTION SECRETS" ]]; then
        echo "Aborted."
        exit 1
    fi
}

if [[ $# -ne 1 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    show_usage
fi

ENV_NAME=$1
ENV_FILE="$(resolve_env_file "$ENV_NAME")"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Env file not found: $ENV_FILE"
    exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
    echo "❌ SUPABASE_PROJECT_REF is missing in $ENV_FILE"
    exit 1
fi

validate_translation_provider_config

if [[ "$ENV_NAME" == "production" ]]; then
    confirm_production
fi

echo "==========================================="
echo "🔐 Syncing Supabase Edge Function secrets"
echo "==========================================="
echo "Environment: $ENV_NAME"
echo "Project: $SUPABASE_PROJECT_REF"
echo "Env file: $ENV_FILE"
echo ""
echo "This updates Supabase Edge Functions secrets only."
echo "Secret values will not be printed."
echo ""

npx supabase secrets set --env-file "$ENV_FILE" --project-ref "$SUPABASE_PROJECT_REF"

echo ""
echo "✅ Secrets synced successfully."
echo "Tip: if you changed translation or LLM provider config, redeploy assist-reply with ./deploy.sh $ENV_NAME assist-reply"
