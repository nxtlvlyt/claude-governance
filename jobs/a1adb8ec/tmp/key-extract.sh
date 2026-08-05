#!/usr/bin/env bash
# Identify the key line by shape (per-line len + head3 only), then wire the real key + re-probe.
set -uo pipefail
F=/mnt/d/Downloads/AIMLAPI_APIkey_0a049c9d.txt
echo "--- line shapes of $(basename "$F") ---"
n=0
while IFS= read -r line; do
  n=$((n+1)); s=$(echo "$line" | tr -d '\r\n ')
  echo "line $n: len=${#s} head3=${s:0:3}"
done < "$F"
# The key = the longest line that contains no spaces mid-string and len>=30
KEY=$(tr -d '\r' < "$F" | awk 'length($0)>=30 && $0 !~ / / {print}' | awk '{ if (length($0)>l) {l=length($0); k=$0} } END {print k}')
echo "chosen key line len: ${#KEY} (not shown)"
sleep 60  # let the 429 rate-limit window cool before re-probing
CODE=$(curl -s -o /tmp/probe.json -w '%{http_code}' --max-time 25 \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"anthropic/claude-sonnet-5","messages":[{"role":"user","content":"hi"}],"max_tokens":1}' \
  https://api.aimlapi.com/v1/chat/completions)
echo "completions probe -> HTTP $CODE"
head -c 200 /tmp/probe.json | grep -o '"message":"[^"]*"' || true
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  sed -i '/^AIMLAPI_KEY=/d' /root/bfclproj/.env
  echo "AIMLAPI_KEY=$KEY" >> /root/bfclproj/.env
  echo ".env updated with WORKING key"
fi
exit 0
