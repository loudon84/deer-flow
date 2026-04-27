#!/usr/bin/env bash
#
# verify-studio-config.sh - Verify Studio frontend-backend configuration
#

set -e

echo "=========================================="
echo "  Studio Configuration Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
    fi
}

# 1. Check backend port
echo "1. Checking backend configuration..."
echo ""

# Check if Studio settings file exists
if [ -f "backend/packages/studio/settings/studio_settings.py" ]; then
    check "Studio settings file exists"
    
    # Extract default port
    DEFAULT_PORT=$(grep "STUDIO_PORT" backend/packages/studio/settings/studio_settings.py | grep -oP '\d+' | head -1)
    echo "   Default port: $DEFAULT_PORT"
else
    echo -e "${RED}✗${NC} Studio settings file not found"
fi

# Check environment variable
if [ -n "$STUDIO_PORT" ]; then
    echo -e "${GREEN}✓${NC} STUDIO_PORT is set: $STUDIO_PORT"
    BACKEND_PORT=$STUDIO_PORT
else
    echo -e "${YELLOW}⚠${NC} STUDIO_PORT not set, using default: 8320"
    BACKEND_PORT=8320
fi

echo ""

# 2. Check frontend configuration
echo "2. Checking frontend configuration..."
echo ""

# Check next.config.js
if [ -f "frontend/next.config.js" ]; then
    check "next.config.js exists"
    
    # Check if Studio URL is configured
    if grep -q "LOCAL_STUDIO_URL" frontend/next.config.js; then
        check "Studio URL configured in next.config.js"
        
        # Extract Studio URL
        STUDIO_URL=$(grep "LOCAL_STUDIO_URL" frontend/next.config.js | grep -oP 'http://[^"]+' | head -1)
        echo "   Studio URL: $STUDIO_URL"
    else
        echo -e "${RED}✗${NC} Studio URL not found in next.config.js"
    fi
    
    # Check if rewrite is configured
    if grep -q '"/api/v1"' frontend/next.config.js; then
        check "API v1 rewrite configured"
    else
        echo -e "${RED}✗${NC} API v1 rewrite not found"
    fi
else
    echo -e "${RED}✗${NC} next.config.js not found"
fi

# Check API client
if [ -f "frontend/src/core/studio/api/client.ts" ]; then
    check "Studio API client exists"
else
    echo -e "${RED}✗${NC} Studio API client not found"
fi

# Check API files
for file in templates jobs documents; do
    if [ -f "frontend/src/core/studio/api/$file.ts" ]; then
        check "API file exists: $file.ts"
        
        # Check if using correct path
        if grep -q '"/api/v1/'"frontend/src/core/studio/api/$file.ts"; then
            check "Using correct API path in $file.ts"
        else
            echo -e "${RED}✗${NC} Incorrect API path in $file.ts"
        fi
    else
        echo -e "${RED}✗${NC} API file not found: $file.ts"
    fi
done

echo ""

# 3. Check if services are running
echo "3. Checking running services..."
echo ""

# Check backend
if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend Studio is running on port $BACKEND_PORT"
    
    # Test API endpoint
    if curl -s "http://localhost:$BACKEND_PORT/api/v1/templates" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Templates API is accessible"
    else
        echo -e "${YELLOW}⚠${NC} Templates API returned error (may need database)"
    fi
else
    echo -e "${YELLOW}⚠${NC} Backend Studio is not running on port $BACKEND_PORT"
    echo "   Start with: cd backend && PYTHONPATH=packages/studio:. uv run python debug_studio.py"
fi

# Check frontend
if curl -s "http://localhost:3000" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend is running on port 3000"
    
    # Test proxy
    if curl -s "http://localhost:3000/api/v1/templates" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend proxy is working"
    else
        echo -e "${YELLOW}⚠${NC} Frontend proxy returned error"
    fi
else
    echo -e "${YELLOW}⚠${NC} Frontend is not running on port 3000"
    echo "   Start with: cd frontend && pnpm dev"
fi

echo ""

# 4. Summary
echo "=========================================="
echo "  Configuration Summary"
echo "=========================================="
echo ""
echo "Backend:"
echo "  - Port: $BACKEND_PORT"
echo "  - URL: http://localhost:$BACKEND_PORT"
echo "  - API: http://localhost:$BACKEND_PORT/api/v1/*"
echo ""
echo "Frontend:"
echo "  - Port: 3000"
echo "  - URL: http://localhost:3000"
echo "  - Studio: http://localhost:3000/workspace/studio"
echo "  - Proxy: /api/v1/* → http://localhost:$BACKEND_PORT/api/v1/*"
echo ""

# 5. Test commands
echo "=========================================="
echo "  Test Commands"
echo "=========================================="
echo ""
echo "# Test backend directly:"
echo "curl http://localhost:$BACKEND_PORT/health"
echo "curl http://localhost:$BACKEND_PORT/api/v1/templates"
echo ""
echo "# Test through frontend proxy:"
echo "curl http://localhost:3000/api/v1/templates"
echo ""
echo "# Access Studio UI:"
echo "open http://localhost:3000/workspace/studio/templates"
echo ""
