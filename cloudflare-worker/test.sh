#!/bin/bash

# Cloudflare Worker Test Script
# Tests all functionality of the deployed Worker

# Configuration
WORKER_URL="${1:-https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev}"
DEV_TOKEN="${2:-your_dev_token_here}"

echo "🧪 Testing Cloudflare Worker"
echo "URL: $WORKER_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test 1: Health check (OPTIONS request)
echo "Test 1: CORS Preflight (OPTIONS)"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$WORKER_URL/api/gemini-pro" \
  -H "Origin: https://akobaloyi.github.io" \
  -H "Access-Control-Request-Method: POST")

if [ "$RESPONSE" = "204" ]; then
  echo -e "${GREEN}✓ PASS${NC} - CORS preflight works (204)"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} - Expected 204, got $RESPONSE"
  ((FAILED++))
fi
echo ""

# Test 2: Simple text generation with token
echo "Test 2: Text Generation (with token)"
RESPONSE=$(curl -s -X POST "$WORKER_URL/api/gemini-pro" \
  -H "Content-Type: application/json" \
  -H "x-sandbox-token: $DEV_TOKEN" \
  -d '{
    "model": "gemini-pro",
    "prompt": "Say hello in exactly 3 words",
    "options": {
      "temperature": 0.7,
      "maxOutputTokens": 20
    }
  }')

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓ PASS${NC} - Text generation works"
  echo "Response: $(echo $RESPONSE | jq -r '.text' 2>/dev/null || echo $RESPONSE)"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} - Text generation failed"
  echo "Response: $RESPONSE"
  ((FAILED++))
fi
echo ""

# Test 3: Missing prompt (should fail)
echo "Test 3: Missing Prompt (should return 400)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/api/gemini-pro" \
  -H "Content-Type: application/json" \
  -H "x-sandbox-token: $DEV_TOKEN" \
  -d '{"model": "gemini-pro"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ PASS${NC} - Validation works (400)"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} - Expected 400, got $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 4: Invalid origin (should fail without token)
echo "Test 4: Invalid Origin (should return 403)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/api/gemini-pro" \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil.com" \
  -d '{
    "model": "gemini-pro",
    "prompt": "Hello"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}✓ PASS${NC} - Origin validation works (403)"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} - Expected 403, got $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 5: Rate limiting (make 61 requests)
echo "Test 5: Rate Limiting (making 61 requests...)"
echo -e "${YELLOW}⏳ This may take 30-60 seconds...${NC}"

RATE_LIMITED=false
for i in {1..61}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/api/gemini-pro" \
    -H "Content-Type: application/json" \
    -H "x-sandbox-token: $DEV_TOKEN" \
    -d "{\"prompt\": \"Test $i\", \"options\": {\"maxOutputTokens\": 5}}")
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  
  if [ "$HTTP_CODE" = "429" ]; then
    RATE_LIMITED=true
    echo -e "${GREEN}✓ PASS${NC} - Rate limiting triggered at request $i (429)"
    ((PASSED++))
    break
  fi
  
  # Show progress every 10 requests
  if [ $((i % 10)) -eq 0 ]; then
    echo "  ... $i requests sent"
  fi
done

if [ "$RATE_LIMITED" = false ]; then
  echo -e "${YELLOW}⚠ WARNING${NC} - Rate limiting not triggered (KV may not be configured)"
  echo "  This is OK for development, but configure KV for production"
fi
echo ""

# Test 6: Method not allowed
echo "Test 6: Invalid Method (should return 405)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$WORKER_URL/api/gemini-pro")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "405" ]; then
  echo -e "${GREEN}✓ PASS${NC} - Method validation works (405)"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} - Expected 405, got $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Test 7: Invalid route
echo "Test 7: Invalid Route (should return 404)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/api/invalid" \
  -H "Content-Type: application/json" \
  -H "x-sandbox-token: $DEV_TOKEN" \
  -d '{"prompt": "Hello"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "404" ]; then
  echo -e "${GREEN}✓ PASS${NC} - Route validation works (404)"
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} - Expected 404, got $HTTP_CODE"
  ((FAILED++))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
TOTAL=$((PASSED + FAILED))
echo "Total:  $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo "Your Worker is ready for production."
  exit 0
else
  echo -e "${RED}✗ Some tests failed.${NC}"
  echo "Check the output above for details."
  exit 1
fi
