#!/bin/bash

# TalkPilot Edge Functions Deploy Script
# Usage: ./deploy.sh [development|production] [function_name|all]

set -euo pipefail

KNOWN_FUNCTIONS=("deepgram-token" "review" "suggest" "assist-reply" "revenuecat-webhook" "revenuecat-sync-customer" "session-recap")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

function show_usage() {
    echo "Usage: ./deploy.sh [development|production] [function_name|all]"
    echo ""
    echo "Available functions:"
    for fn in "${KNOWN_FUNCTIONS[@]}"; do
        echo "  - $fn"
    done
    echo "  - all (deploys all known functions)"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh development suggest"
    echo "  ./deploy.sh production all"
    exit 1
}

function resolve_env_file() {
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

function validate_translation_provider_config() {
    local provider="${TRANSLATION_PROVIDER:-llm}"

    echo "Translation provider: $provider"

    case "$provider" in
        llm)
            echo "assist-reply will use the LLM translation backend."
            ;;
        google)
            if [[ -z "${GOOGLE_TRANSLATE_API_KEY:-}" ]]; then
                echo "❌ GOOGLE_TRANSLATE_API_KEY is required when TRANSLATION_PROVIDER=google"
                exit 1
            fi
            echo "assist-reply will use Google Translate."
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
            echo "assist-reply will use Azure Translator."
            ;;
        *)
            echo "❌ Unsupported TRANSLATION_PROVIDER: $provider"
            echo "Expected one of: llm, google, azure"
            exit 1
            ;;
    esac
}

function confirm_production() {
    local answer
    echo "⚠️  You are deploying to PRODUCTION."
    read -r -p "Type 'DEPLOY PRODUCTION' to continue: " answer
    if [[ "$answer" != "DEPLOY PRODUCTION" ]]; then
        echo "Aborted."
        exit 1
    fi
}

function deploy_function() {
    local fn_name=$1
    echo "==========================================="
    echo "🚀 Deploying function: $fn_name"
    echo "==========================================="
    npx supabase functions deploy "$fn_name" --no-verify-jwt --project-ref "$SUPABASE_PROJECT_REF"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully deployed $fn_name"
    else
        echo "❌ Failed to deploy $fn_name"
        exit 1
    fi
}

# 1. 检查参数
if [ $# -ne 2 ]; then
    show_usage
fi

ENV_NAME=$1
TARGET=$2
ENV_FILE="$(resolve_env_file "$ENV_NAME")"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: env file not found: $ENV_FILE"
    exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
    echo "Error: SUPABASE_PROJECT_REF is missing in $ENV_FILE"
    exit 1
fi

validate_translation_provider_config

if [[ "$ENV_NAME" == "production" ]]; then
    confirm_production
fi

echo "Environment: $ENV_NAME"
echo "Project ref: $SUPABASE_PROJECT_REF"
echo "Env file   : $ENV_FILE"
echo ""

# 2. 执行发布
if [ "$TARGET" == "all" ]; then
    echo "Deploying ALL functions..."
    for fn in "${KNOWN_FUNCTIONS[@]}"; do
        deploy_function "$fn"
    done
    echo "🎉 All functions deployed successfully!"
else
    # 检查是否在已知函数列表中
    VALID=false
    for fn in "${KNOWN_FUNCTIONS[@]}"; do
        if [ "$fn" == "$TARGET" ]; then
            VALID=true
            break
        fi
    done

    if [ "$VALID" == false ]; then
        echo "Error: Unknown function '$TARGET'"
        echo ""
        show_usage
    fi

    deploy_function "$TARGET"
fi
