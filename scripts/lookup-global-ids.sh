#!/bin/bash
# Looks up Sabre hotel codes and chain codes for a list of Global IDs
# Usage: ./scripts/lookup-global-ids.sh [input_csv] [output_csv]
#
# Requires the FlightMapping API to be running on localhost:5105

INPUT_CSV="${1:-/Users/jonathanfriedman/Downloads/Untitled spreadsheet - Sheet1-36.csv}"
OUTPUT_CSV="${2:-/Users/jonathanfriedman/Downloads/hotel-global-lookup-results.csv}"
API_URL="http://localhost:5105/api/hotel/raw"
CHECKIN="2026-04-01"
CHECKOUT="2026-04-03"
CONCURRENCY=5
DELAY=0.2

echo "GlobalID,SabreHotelCode,ChainCode,ChainName,BrandCode,BrandName,HotelName,SabreRating,Status" > "$OUTPUT_CSV"

TOTAL=$(grep -c '[0-9]' "$INPUT_CSV")
COUNT=0
FOUND=0
FAILED=0

echo "Processing $TOTAL hotels..."
echo ""

lookup_hotel() {
    local global_id="$1"
    local response
    response=$(curl -s --max-time 15 -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"GetHotelDetailsRQ\": {
                \"SearchCriteria\": {
                    \"HotelRefs\": {
                        \"HotelRef\": {
                            \"HotelCode\": \"$global_id\",
                            \"CodeContext\": \"GLOBAL\"
                        }
                    },
                    \"RateInfoRef\": {
                        \"CurrencyCode\": \"USD\",
                        \"StayDateTimeRange\": {
                            \"StartDate\": \"$CHECKIN\",
                            \"EndDate\": \"$CHECKOUT\"
                        },
                        \"Rooms\": {
                            \"Room\": [{\"Index\": 1, \"Adults\": 1}]
                        }
                    },
                    \"HotelContentRef\": {
                        \"DescriptiveInfoRef\": {
                            \"PropertyInfo\": true
                        }
                    }
                }
            }
        }" 2>/dev/null)

    if [ -z "$response" ]; then
        echo "$global_id,,,,,,,,TIMEOUT"
        return 1
    fi

    local hotel_info
    hotel_info=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    rs = data.get('GetHotelDetailsRS', {})
    info = rs.get('HotelDetailsInfo', {})
    hi = info.get('HotelInfo', {}) if info else {}
    if hi:
        fields = [
            hi.get('SabreHotelCode', ''),
            hi.get('ChainCode', ''),
            hi.get('ChainName', ''),
            hi.get('BrandCode', ''),
            hi.get('BrandName', ''),
            hi.get('HotelName', '').replace(',', ';'),
            hi.get('SabreRating', ''),
            'OK'
        ]
        print(','.join(str(f) for f in fields))
    else:
        # Check for warnings
        warnings = rs.get('ApplicationResults', {}).get('Warning', [])
        msg = ''
        for w in warnings:
            for ssr in w.get('SystemSpecificResults', []):
                for m in ssr.get('Message', []):
                    if m.get('code') != 'WarningDetails':
                        msg = m.get('value', 'Unknown error')
        print(f',,,,,,,{msg or \"NO_DATA\"}')
except Exception as e:
    print(f',,,,,,,ERROR: {e}')
" 2>/dev/null)

    echo "$global_id,$hotel_info"
    [ "$(echo "$hotel_info" | cut -d',' -f8)" = "OK" ] && return 0 || return 1
}

# Process hotels with limited concurrency
RUNNING=0
while IFS= read -r line || [ -n "$line" ]; do
    global_id=$(echo "$line" | tr -d '[:space:]' | tr -d '"')
    [ -z "$global_id" ] && continue
    [[ ! "$global_id" =~ ^[0-9]+$ ]] && continue

    COUNT=$((COUNT + 1))

    {
        result=$(lookup_hotel "$global_id")
        echo "$result" >> "$OUTPUT_CSV"
        status=$(echo "$result" | rev | cut -d',' -f1 | rev)
        if [ "$status" = "OK" ]; then
            sabre_code=$(echo "$result" | cut -d',' -f2)
            chain=$(echo "$result" | cut -d',' -f3)
            printf "\r[%d/%d] %s -> Sabre: %s, Chain: %s     " "$COUNT" "$TOTAL" "$global_id" "$sabre_code" "$chain"
        else
            printf "\r[%d/%d] %s -> %s     " "$COUNT" "$TOTAL" "$global_id" "$status"
        fi
    } &

    RUNNING=$((RUNNING + 1))
    if [ "$RUNNING" -ge "$CONCURRENCY" ]; then
        wait
        RUNNING=0
        sleep "$DELAY"
    fi
done < "$INPUT_CSV"

wait

# Count results
FOUND=$(awk -F',' '$NF == "OK"' "$OUTPUT_CSV" | wc -l | tr -d ' ')
TOTAL_PROCESSED=$(tail -n +2 "$OUTPUT_CSV" | wc -l | tr -d ' ')

echo ""
echo ""
echo "============================="
echo "Complete!"
echo "Total processed: $TOTAL_PROCESSED"
echo "Found: $FOUND"
echo "Failed: $((TOTAL_PROCESSED - FOUND))"
echo "Output: $OUTPUT_CSV"
echo "============================="
