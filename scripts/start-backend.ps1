#!/usr/bin/env pwsh
# -*- coding: utf-8 -*-
#
# start-backend.ps1 - Start backend services for local development
#
# This script starts only the backend services (LangGraph + Gateway)
# without Nginx. Frontend should be started separately with Next.js dev server.
#
# Usage:
#   .\scripts\start-backend.ps1 [-SkipLangGraph]
#
# Must be run from the repo root directory.

param(
    [switch]$SkipLangGraph
)

# Set UTF-8 encoding for console output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

# Get repository root
$REPO_ROOT = Split-Path -Parent $PSScriptRoot
Set-Location $REPO_ROOT

# ── Load environment variables from .env ──────────────────────────────────────
if (Test-Path "$REPO_ROOT\.env") {
    Get-Content "$REPO_ROOT\.env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove quotes if present
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $matches[1]
            }
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

# ── Stop existing backend services ────────────────────────────────────────────

Write-Host "Stopping existing backend services if any..."
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*langgraph dev*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*uvicorn app.gateway.app:app*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Clean up containers
if (Test-Path ".\scripts\cleanup-containers.ps1") {
    & ".\scripts\cleanup-containers.ps1" "deer-flow-sandbox" 2>$null
}
Start-Sleep -Seconds 1

# ── Banner ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=========================================="
Write-Host "  Starting DeerFlow Backend Services"
Write-Host "=========================================="
Write-Host ""
Write-Host "  Mode: Local Development (no Nginx)"
Write-Host ""
Write-Host "Services starting up..."
Write-Host "  → LangGraph: localhost:2024"
Write-Host "  → Gateway:   localhost:8001"
Write-Host ""

# ── Config check ─────────────────────────────────────────────────────────────

$configFound = $false
if ($env:DEER_FLOW_CONFIG_PATH -and (Test-Path $env:DEER_FLOW_CONFIG_PATH)) {
    $configFound = $true
} elseif (Test-Path "backend\config.yaml") {
    $configFound = $true
} elseif (Test-Path "config.yaml") {
    $configFound = $true
}

if (-not $configFound) {
    Write-Host "✗ No DeerFlow config file found."
    Write-Host "  Checked these locations:"
    Write-Host "    - $env:DEER_FLOW_CONFIG_PATH (when DEER_FLOW_CONFIG_PATH is set)"
    Write-Host "    - backend\config.yaml"
    Write-Host "    - .\config.yaml"
    Write-Host ""
    Write-Host "  Run 'make config' from the repo root to generate .\config.yaml, then set required model API keys in .env or your config file."
    exit 1
}

# ── Auto-upgrade config ──────────────────────────────────────────────────

if (Test-Path ".\scripts\config-upgrade.ps1") {
    & ".\scripts\config-upgrade.ps1"
} elseif (Test-Path ".\scripts\config-upgrade.sh") {
    # Try to run with Git Bash if available
    if (Get-Command "bash" -ErrorAction SilentlyContinue) {
        bash ".\scripts\config-upgrade.sh"
    } elseif (Test-Path "C:\Program Files\Git\bin\bash.exe") {
        & "C:\Program Files\Git\bin\bash.exe" ".\scripts\config-upgrade.sh"
    } else {
        Write-Host "Warning: config-upgrade.sh requires bash. Skipping config upgrade." -ForegroundColor Yellow
    }
}

# ── Helper function: Wait for port ───────────────────────────────────────────

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$Timeout = 60,
        [string]$ServiceName = "Service"
    )

    $elapsed = 0
    $interval = 1

    while ($elapsed -lt $Timeout) {
        # Check if port is listening
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($connection) {
            return $true
        }

        Write-Host -NoNewline "`r  Waiting for $ServiceName on port $Port... ${elapsed}s  "
        Start-Sleep -Seconds $interval
        $elapsed += $interval
    }

    Write-Host ""
    Write-Host "✗ $ServiceName failed to start on port $Port after ${Timeout}s"
    return $false
}

# ── Cleanup trap ─────────────────────────────────────────────────────────────

function Cleanup {
    Write-Host ""
    Write-Host "Shutting down backend services..."
    if (-not $SkipLangGraph) {
        Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*langgraph dev*"
        } | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*uvicorn app.gateway.app:app*"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "Cleaning up sandbox containers..."
    if (Test-Path ".\scripts\cleanup-containers.ps1") {
        & ".\scripts\cleanup-containers.ps1" "deer-flow-sandbox" 2>$null
    }
    Write-Host "✓ Backend services stopped"
}

# Set up cleanup on exit
try {
    # ── Start services ────────────────────────────────────────────────────────────

    $null = New-Item -ItemType Directory -Force -Path "logs"

    if (-not $SkipLangGraph) {
        Write-Host "Starting LangGraph server..."
        # Read log_level from config.yaml, fallback to env var, then to "info"
        $LANGGRAPH_LOG_LEVEL = if ($env:LANGGRAPH_LOG_LEVEL) { $env:LANGGRAPH_LOG_LEVEL } else { "info" }
        if (Test-Path "config.yaml") {
            $configLogLevel = Select-String -Path "config.yaml" -Pattern '^log_level:\s*(\S+)' | Select-Object -First 1
            if ($configLogLevel) {
                $LANGGRAPH_LOG_LEVEL = $configLogLevel.Matches.Groups[1].Value
            }
        }

        $langgraphLog = Join-Path $REPO_ROOT "logs\langgraph.log"
        $langgraphErrLog = Join-Path $REPO_ROOT "logs\langgraph-error.log"
        Start-Process -FilePath "uv" -ArgumentList "run", "langgraph", "dev", "--host", "0.0.0.0", "--no-browser", "--allow-blocking", "--server-log-level", $LANGGRAPH_LOG_LEVEL, "--no-reload" -WorkingDirectory "backend" -RedirectStandardOutput $langgraphLog -RedirectStandardError $langgraphErrLog -NoNewWindow

        # Wait for LangGraph port
        if (-not (Wait-ForPort -Port 2024 -Timeout 60 -ServiceName "LangGraph")) {
            Write-Host "  See logs\langgraph.log for details"
            Get-Content "logs\langgraph.log" -Tail 20
            $logContent = Get-Content "logs\langgraph.log" -Raw -ErrorAction SilentlyContinue
            if ($logContent -match "config_version|outdated|Environment variable .* not found|KeyError|ValidationError|config\.yaml") {
                Write-Host ""
                Write-Host "  Hint: This may be a configuration issue. Try running 'make config-upgrade' to update your config.yaml."
            }
            Cleanup
            exit 1
        }
        Write-Host "✓ LangGraph server started on localhost:2024"
    } else {
        Write-Host "⏩ Skipping LangGraph server (-SkipLangGraph)"
        Write-Host "   Use /api/langgraph-compat/* via Gateway instead"
    }

    Write-Host "Starting Gateway API..."
    $gatewayLog = Join-Path $REPO_ROOT "logs\gateway.log"
    $gatewayErrLog = Join-Path $REPO_ROOT "logs\gateway-error.log"
    Start-Process -FilePath "uv" -ArgumentList "run", "uvicorn", "app.gateway.app:app", "--host", "0.0.0.0", "--port", "8001", "--reload", "--reload-include=*.yaml", "--reload-include=.env", "--reload-exclude=*.pyc", "--reload-exclude=__pycache__", "--reload-exclude=sandbox/", "--reload-exclude=.deer-flow/" -WorkingDirectory "backend" -RedirectStandardOutput $gatewayLog -RedirectStandardError $gatewayErrLog -NoNewWindow

    # Wait for Gateway port
    if (-not (Wait-ForPort -Port 8001 -Timeout 30 -ServiceName "Gateway API")) {
        Write-Host "✗ Gateway API failed to start. Last log output:"
        Get-Content "logs\gateway.log" -Tail 60
        Write-Host ""
        Write-Host "Likely configuration errors:"
        Select-String -Path "logs\gateway.log" -Pattern "Failed to load configuration|Environment variable .* not found|config\.yaml.*not found" | Select-Object -Last 5
        Write-Host ""
        Write-Host "  Hint: Try running 'make config-upgrade' to update your config.yaml with the latest fields."
        Cleanup
        exit 1
    }
    Write-Host "✓ Gateway API started on localhost:8001"

    # ── Ready ─────────────────────────────────────────────────────────────────────

    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  ✓ Backend services are running!"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "  🤖 LangGraph:  http://localhost:2024"
    Write-Host "  📡 Gateway:    http://localhost:8001"
    Write-Host ""
    Write-Host "  📋 Logs:"
    Write-Host "     - LangGraph: logs\langgraph.log"
    Write-Host "     - Gateway:   logs\gateway.log"
    Write-Host ""
    Write-Host "  💡 Next steps:"
    Write-Host "     1. Start frontend: cd frontend && pnpm dev"
    Write-Host "     2. Access app at: http://localhost:3000"
    Write-Host ""
    Write-Host "  🔧 Frontend rewrite config (already set in next.config.js):"
    Write-Host "     - /api/langgraph/* → http://localhost:2024/*"
    Write-Host "     - /api/models      → http://localhost:8001/api/models"
    Write-Host "     - /api/agents/*    → http://localhost:8001/api/agents/*"
    Write-Host "     - /api/article-studio/* → http://localhost:8001/api/article-studio/*"
    Write-Host ""
    Write-Host "Press Ctrl+C to stop backend services"
    Write-Host ""

    # Keep the script running
    while ($true) {
        Start-Sleep -Seconds 1
    }

} catch {
    Write-Host "Error: $_"
    Cleanup
    exit 1
}
