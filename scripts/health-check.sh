#!/bin/bash

# ============================================
# Health Check Script
# Verifica saúde de todos os serviços
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPOSE_FILE="${1:-docker-compose.prod.yml}"

echo "============================================"
echo "  Health Check - Services Status"
echo "============================================"
echo ""

check_service() {
    local service=$1
    local container=$2
    local url=$3

    echo -n "Checking $service... "

    if [ -n "$url" ]; then
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ OK${NC}"
            return 0
        else
            echo -e "${RED}✗ FAIL${NC}"
            return 1
        fi
    else
        if docker-compose -f "$COMPOSE_FILE" ps | grep "$container" | grep -q "healthy\|Up"; then
            echo -e "${GREEN}✓ OK${NC}"
            return 0
        else
            echo -e "${RED}✗ FAIL${NC}"
            return 1
        fi
    fi
}

# Check services
check_service "PostgreSQL" "postgres" ""
check_service "Redis" "redis" ""
check_service "Backend API" "backend" "http://localhost:3000/health"
check_service "Frontend Web" "web" "http://localhost:3001/"

echo ""
echo "============================================"
docker-compose -f "$COMPOSE_FILE" ps
echo "============================================"
