#!/bin/bash

# TalkPilot Edge Functions Deploy Script
# Automatically applies --no-verify-jwt and project reference

PROJECT_REF="joweqhgtueqfeasweigh"
KNOWN_FUNCTIONS=("deepgram-token" "review" "suggest" "assist-reply" "revenuecat-webhook")

function show_usage() {
    echo "Usage: ./deploy.sh [function_name | all]"
    echo ""
    echo "Available functions:"
    for fn in "${KNOWN_FUNCTIONS[@]}"; do
        echo "  - $fn"
    done
    echo "  - all (deploys all known functions)"
    echo ""
    echo "Example: ./deploy.sh suggest"
    exit 1
}

function deploy_function() {
    local fn_name=$1
    echo "==========================================="
    echo "🚀 Deploying function: $fn_name"
    echo "==========================================="
    npx supabase functions deploy "$fn_name" --no-verify-jwt --project-ref "$PROJECT_REF"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully deployed $fn_name"
    else
        echo "❌ Failed to deploy $fn_name"
        exit 1
    fi
}

# 1. 检查参数
if [ $# -eq 0 ]; then
    show_usage
fi

TARGET=$1

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
