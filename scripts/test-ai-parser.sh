#!/bin/bash
# Test all 20 scenarios against the AI parse endpoint
API="http://localhost:5223/api/parse"
PASS=0
FAIL=0
RESULTS=""

test_parse() {
  local num="$1"
  local desc="$2"
  local text="$3"

  echo "[$num] $desc"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"$text\"}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    # Check that segments exist
    SEG_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('segments',[])))" 2>/dev/null)
    if [ "$SEG_COUNT" -gt 0 ] 2>/dev/null; then
      echo "  OK (${SEG_COUNT} segments)"
      PASS=$((PASS + 1))
      RESULTS="${RESULTS}\n[$num] PASS - $desc (${SEG_COUNT} segments)"
      echo "$BODY" | python3 -m json.tool
    else
      echo "  FAIL - 200 but no segments"
      FAIL=$((FAIL + 1))
      RESULTS="${RESULTS}\n[$num] FAIL - $desc (no segments)"
      echo "$BODY" | python3 -m json.tool
    fi
  else
    echo "  FAIL - HTTP $HTTP_CODE"
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}\n[$num] FAIL - $desc (HTTP $HTTP_CODE)"
    echo "$BODY"
  fi
  echo "---"
}

# Round Trips
test_parse 1 "Basic round trip business" \
  "2 adults flying business from NYC to London March 20, back March 27, prefer nonstop"

test_parse 2 "Cheapest round trip" \
  "cheapest flight from Miami to Cancun April 5-12 for 3 adults"

test_parse 3 "Premium economy round trip" \
  "SFO to Tokyo round trip May 1 returning May 15, premium economy, 1 adult"

test_parse 4 "Time preferences round trip" \
  "red-eye from LAX to JFK June 3, morning flight back June 7"

# One Way
test_parse 5 "One way with child" \
  "one way Dallas to Amsterdam September 10, business class, 2 adults 1 child"

test_parse 6 "Simple one way" \
  "need to get from Boston to Seattle August 22, nonstop if possible"

# Multi-City
test_parse 7 "4-city Europe trip" \
  "NYC to London March 20, London to Paris March 25, Paris to Rome March 28, Rome to NYC April 2, 2 adults"

test_parse 8 "4-city Asia-Pacific" \
  "fly from Chicago to Tokyo April 10, Tokyo to Bangkok April 17, Bangkok to Sydney April 24, then Sydney to SFO May 1"

test_parse 9 "Multi-city business" \
  "Houston to Dublin June 1, Dublin to Edinburgh June 5, Edinburgh to London June 8, London to Houston June 12, 1 adult business"

# Mixed Cabin
test_parse 10 "Mixed cabin 3-segment" \
  "business class NYC to London March 20, then economy London to Paris March 25, economy back to NYC March 30"

test_parse 11 "First/premium/economy mix" \
  "first class LAX to Singapore April 5, premium economy Singapore to Bali April 10, economy Bali to LAX April 17"

test_parse 12 "Business out economy back" \
  "2 adults, business outbound DFW to NRT May 3, economy return NRT to DFW May 18"

# Complex Passengers
test_parse 13 "Adults + children + infant" \
  "2 adults 2 children 1 infant, economy from Atlanta to Lisbon July 4 returning July 18"

test_parse 14 "Carrier preference" \
  "4 adults Denver to Honolulu December 20 back January 3, prefer United or Hawaiian"

# Vague / Conversational
test_parse 15 "Vague cheap request" \
  "I need to be in Singapore by March 25 flying out of San Francisco, coming home around April 1, don't care about class just make it cheap"

test_parse 16 "Conversational with budget" \
  "get me and my wife from DC to the Maldives sometime mid-April for about 10 days, willing to do one stop, budget around 2000 per person"

# Carrier Preferences
test_parse 17 "Specific carriers" \
  "Delta or American only, Atlanta to Paris CDG May 15, return May 22, business, 1 adult"

test_parse 18 "Carrier exclusion" \
  "no basic economy, avoid Spirit and Frontier, LAX to Denver March 28 round trip through March 31"

# Edge Cases
test_parse 19 "Complex multi-class multi-city" \
  "fly JFK-LHR Mar 20 morning, LHR-CDG Mar 23, CDG-FCO Mar 26 afternoon, FCO-JFK Mar 30 red-eye, 3 adults 1 child, business on the transatlantic legs economy on the intra-europe"

test_parse 20 "Open jaw" \
  "open jaw: fly into Barcelona April 1 from Miami, fly home to Miami from Rome April 10, 2 adults premium economy, prefer nonstop on the way there"

echo ""
echo "========================"
echo "RESULTS: $PASS passed, $FAIL failed out of 20"
echo "========================"
echo -e "$RESULTS"
