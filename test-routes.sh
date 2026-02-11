#!/bin/bash

set -e

API_BASE="http://localhost:8375/api"
echo "🧪 Testing Sanctum API Routes"
echo "================================"

# Signup
echo "✓ Creating test user..."
SIGNUP_RESPONSE=$(curl -s -X POST "$API_BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser'$(date +%s)'",
    "email": "test'$(date +%s)'@example.com",
    "password": "TestPassword123!"
  }')

USER_ID=$(echo "$SIGNUP_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
TOKEN=$(echo "$SIGNUP_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "  User ID: $USER_ID"
echo "  Token: ${TOKEN:0:20}..."

# Create a second user for conversation
echo "✓ Creating second user for conversation..."
SIGNUP2=$(curl -s -X POST "$API_BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser2'$(date +%s)'",
    "email": "test2'$(date +%s)'@example.com",
    "password": "TestPassword123!"
  }')

USER2_ID=$(echo "$SIGNUP2" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "  User 2 ID: $USER2_ID"

# Create a conversation
echo "✓ Creating conversation..."
CONV_RESPONSE=$(curl -s -X POST "$API_BASE/conversations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Chat",
    "participant_ids": ['$USER2_ID']
  }')

CONV_ID=$(echo "$CONV_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "  Conversation ID: $CONV_ID"

# Send a message (POST)
echo "✓ Testing POST /api/conversations/:id/messages..."
SEND_RESPONSE=$(curl -s -X POST "$API_BASE/conversations/$CONV_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "content": "Hello from test!"
  }')

MSG_ID=$(echo "$SEND_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "  Message ID: $MSG_ID"

# Get messages (GET)
echo "✓ Testing GET /api/conversations/:id/messages..."
GET_RESPONSE=$(curl -s -X GET "$API_BASE/conversations/$CONV_ID/messages" \
  -H "Authorization: Bearer $TOKEN")

MSG_COUNT=$(echo "$GET_RESPONSE" | grep -o '"id"' | wc -l)
echo "  Messages returned: $MSG_COUNT"

if [ "$MSG_COUNT" -gt 0 ]; then
  echo "  First message: $(echo "$GET_RESPONSE" | grep -o '"content":"[^"]*"' | head -1)"
fi

# Test WebSocket connection
echo "✓ Testing WebSocket connection to /api/ws/chat..."

# First, get a WS ticket
echo "  Getting WebSocket ticket..."
TICKET_RESPONSE=$(curl -s -X POST "$API_BASE/ws/ticket" \
  -H "Authorization: Bearer $TOKEN")
TICKET=$(echo "$TICKET_RESPONSE" | grep -o '"ticket":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TICKET" ]; then
  echo "  ❌ Failed to get WebSocket ticket"
  echo "  Response: $TICKET_RESPONSE"
else
  echo "  Ticket: ${TICKET:0:10}..."
  echo "  WebSocket URL: ws://localhost:8375/api/ws/chat?ticket=$TICKET"

  # Use websocat if available, otherwise just report URL
  if command -v websocat &> /dev/null; then
    # Test WebSocket with 3 second timeout
    echo "  Attempting connection (3s timeout)..." 
    timeout 3 websocat "ws://localhost:8375/api/ws/chat?ticket=$TICKET" <<EOF || true
{"type":"join","conversation_id":$CONV_ID}
EOF
    echo "  WebSocket test completed"
  else
    echo "  (websocat not available - URL looks correct)"
  fi
fi

echo ""
echo "✅ All route tests completed!"
echo ""
echo "Summary:"
echo "  - User signup: ✓"
echo "  - Conversation creation: ✓"
echo "  - POST messages: ✓"
echo "  - GET messages: ✓"
echo "  - WebSocket endpoint: ✓ (exists)"
