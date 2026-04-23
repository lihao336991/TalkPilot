#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

show_usage() {
    echo "Usage: ./db-push.sh [development|production]"
    echo ""
    echo "Examples:"
    echo "  ./db-push.sh development"
    echo "  ./db-push.sh production"
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

confirm_production() {
    local answer
    echo "⚠️  You are pushing database migrations to PRODUCTION."
    read -r -p "Type 'PUSH PRODUCTION DB' to continue: " answer
    if [[ "$answer" != "PUSH PRODUCTION DB" ]]; then
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

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
    echo "Error: SUPABASE_DB_PASSWORD is missing in $ENV_FILE"
    echo "Add the remote database password for the '$ENV_NAME' Supabase project."
    exit 1
fi

if [[ "$ENV_NAME" == "production" ]]; then
    confirm_production
fi

echo "==========================================="
echo "🗄️  Pushing Supabase migrations"
echo "==========================================="
echo "Environment: $ENV_NAME"
echo "Project ref: $SUPABASE_PROJECT_REF"
echo "Env file   : $ENV_FILE"
echo ""

npx supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
npx supabase db push --linked --password "$SUPABASE_DB_PASSWORD"

echo ""
echo "✅ Database migrations pushed successfully."
