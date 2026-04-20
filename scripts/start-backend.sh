#!/usr/bin/env bash
#
# start-backend.sh - Start backend services for local development
#
# This script starts only the backend services (LangGraph + Gateway)
# without Nginx. Frontend should be started separately with Next.js dev server.
#
# Usage:
#   ./scripts/start-backend.sh [--skip-langgraph]
#
# Must be run from the repo root directory.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Load environment variables from .env ──────────────────────────────────────
if [ -f "$REPO_ROOT/.env" ]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
fi

# ── Argument parsing ─────────────────────────────────────────────────────────

SKIP_LANGGRAPH=false
for arg in "$@"; do
    case "$arg" in
        --skip-langgraph)  SKIP_LANGGRAPH=true ;;
        *) echo "Unknown argument: $arg"; echo "Usage: $0 [--skip-langgraph]"; exit 1 ;;
    esac
done

# ── Stop existing backend services ────────────────────────────────────────────

echo "Stopping existing backend services if any..."
pkill -f "langgraph dev" 2>/dev/null || true
pkill -f "uvicorn app.gateway.app:app" 2>/dev/null || true
./scripts/cleanup-containers.sh deer-flow-sandbox 2>/dev/null || true
sleep 1

# ── Banner ────────────────────────────────────────────────────────────────────

echo ""
echo "=========================================="
echo "  Starting DeerFlow Backend Services"
echo "=========================================="
echo ""
echo "  Mode: Local Development (no Nginx)"
echo ""
echo "Services starting up..."
echo "  → LangGraph: localhost:2024"
echo "  → Gateway:   localhost:8001"
echo ""

# ── Config check ─────────────────────────────────────────────────────────────

if ! { \
        [ -n "$DEER_FLOW_CONFIG_PATH" ] && [ -f "$DEER_FLOW_CONFIG_PATH" ] || \
        [ -f backend/config.yaml ] || \
        [ -f config.yaml ]; \
    }; then
    echo "✗ No DeerFlow config file found."
    echo "  Checked these locations:"
    echo "    - $DEER_FLOW_CONFIG_PATH (when DEER_FLOW_CONFIG_PATH is set)"
    echo "    - backend/config.yaml"
    echo "    - ./config.yaml"
    echo ""
    echo "  Run 'make config' from the repo root to generate ./config.yaml, then set required model API keys in .env or your config file."
    exit 1
fi

# ── Auto-upgrade config ──────────────────────────────────────────────────

"$REPO_ROOT/scripts/config-upgrade.sh"

# ── Cleanup trap ─────────────────────────────────────────────────────────────

cleanup() {
    trap - INT TERM
    echo ""
    echo "Shutting down backend services..."
    if [ "$SKIP_LANGGRAPH" = "false" ]; then
        pkill -f "langgraph dev" 2>/dev/null || true
    fi
    pkill -f "uvicorn app.gateway.app:app" 2>/dev/null || true
    echo "Cleaning up sandbox containers..."
    ./scripts/cleanup-containers.sh deer-flow-sandbox 2>/dev/null || true
    echo "✓ Backend services stopped"
    exit 0
}
trap cleanup INT TERM

# ── Start services ────────────────────────────────────────────────────────────

mkdir -p logs

if [ "$SKIP_LANGGRAPH" = "false" ]; then
    echo "Starting LangGraph server..."
    # Read log_level from config.yaml, fallback to env var, then to "info"
    CONFIG_LOG_LEVEL=$(grep -m1 '^log_level:' config.yaml 2>/dev/null | awk '{print $2}' | tr -d ' ')
    LANGGRAPH_LOG_LEVEL="${LANGGRAPH_LOG_LEVEL:-info}"
    (cd backend && NO_COLOR=1 uv run langgraph dev --host 0.0.0.0 --no-browser --allow-blocking --server-log-level $LANGGRAPH_LOG_LEVEL --no-reload > ../logs/langgraph.log 2>&1) &
    ./scripts/wait-for-port.sh 2024 60 "LangGraph" || {
        echo "  See logs/langgraph.log for details"
        tail -20 logs/langgraph.log
        if grep -qE "config_version|outdated|Environment variable .* not found|KeyError|ValidationError|config\.yaml" logs/langgraph.log 2>/dev/null; then
            echo ""
            echo "  Hint: This may be a configuration issue. Try running 'make config-upgrade' to update your config.yaml."
        fi
        cleanup
    }
    echo "✓ LangGraph server started on localhost:2024"
else
    echo "⏩ Skipping LangGraph server (--skip-langgraph)"
    echo "   Use /api/langgraph-compat/* via Gateway instead"
fi

echo "Starting Gateway API..."
(cd backend && PYTHONPATH=. uv run uvicorn app.gateway.app:app --host 0.0.0.0 --port 8001 --reload --reload-include='*.yaml' --reload-include='.env' --reload-exclude='*.pyc' --reload-exclude='__pycache__' --reload-exclude='sandbox/' --reload-exclude='.deer-flow/' > ../logs/gateway.log 2>&1) &
./scripts/wait-for-port.sh 8001 30 "Gateway API" || {
    echo "✗ Gateway API failed to start. Last log output:"
    tail -60 logs/gateway.log
    echo ""
    echo "Likely configuration errors:"
    grep -E "Failed to load configuration|Environment variable .* not found|config\.yaml.*not found" logs/gateway.log | tail -5 || true
    echo ""
    echo "  Hint: Try running 'make config-upgrade' to update your config.yaml with the latest fields."
    cleanup
}
echo "✓ Gateway API started on localhost:8001"

# ── Ready ─────────────────────────────────────────────────────────────────────

echo ""
echo "=========================================="
echo "  ✓ Backend services are running!"
echo "=========================================="
echo ""
echo "  🤖 LangGraph:  http://localhost:2024"
echo "  📡 Gateway:    http://localhost:8001"
echo ""
echo "  📋 Logs:"
echo "     - LangGraph: logs/langgraph.log"
echo "     - Gateway:   logs/gateway.log"
echo ""
echo "  💡 Next steps:"
echo "     1. Start frontend: cd frontend && pnpm dev"
echo "     2. Access app at: http://localhost:3000"
echo ""
echo "  🔧 Frontend rewrite config (already set in next.config.js):"
echo "     - /api/langgraph/* → http://localhost:2024/*"
echo "     - /api/models      → http://localhost:8001/api/models"
echo "     - /api/agents/*    → http://localhost:8001/api/agents/*"
echo "     - /api/article-studio/* → http://localhost:8001/api/article-studio/*"
echo ""
echo "Press Ctrl+C to stop backend services"
echo ""

wait
