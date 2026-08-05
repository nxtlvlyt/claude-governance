#!/usr/bin/env bash
# Take the value after the colon on the 'API...' line; probe; wire on success.
set -uo pipefail
F=/mnt/d/Downloads/AIMLAPI_APIkey_0a049c9d.txt
KEY=$(tr -d '\r' < "$F" | grep -i '^API' | head -1 | sed 's/^[^:]*:[[:space:]]*//' | tr -d ' ')
echo "extracted key len: ${#KEY} (not shown)"
CODE=$(curl -s -o /tmp/probe.json -w '%{http_code}' --max-time 25 \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"anthropic/claude-sonnet-5","messages":[{"role":"user","content":"hi"}],"max_tokens":1}' \
  https://api.aimlapi.com/v1/chat/completions)
echo "completions probe -> HTTP $CODE"
grep -o '"message":"[^"]*"' /tmp/probe.json | head -1 || true
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  sed -i '/^AIMLAPI_KEY=/d' /root/bfclproj/.env
  echo "AIMLAPI_KEY=$KEY" >> /root/bfclproj/.env
  echo ".env updated with WORKING key"
fi
exit 0
