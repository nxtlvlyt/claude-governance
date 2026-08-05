#!/usr/bin/env bash
# 1) Kill ONLY the sonnet lanes (never the trainer). 2) Trash their garbage result rows.
# 3) Probe every key file against the COMPLETIONS endpoint (1-token call). 4) Fix .env.
set -uo pipefail
echo "--- killing sonnet lane procs ---"
for pid in $(ps -eo pid,args | grep '[s]onnet-5-aiml' | awk '{print $1}'); do
  echo "kill $pid"; kill "$pid" 2>/dev/null || true
done
pkill -f 'run-sonnet5.sh' 2>/dev/null || true
sleep 2
echo "--- removing garbage result dirs ---"
rm -rf /root/bfclproj/result/sonnet-5-aiml-FC /root/bfclproj/result/sonnet-5-aiml
echo "--- probing all key files against completions (1 token, cheapest) ---"
GOOD=""
for f in $(ls -t /mnt/d/Downloads/AIMLAPI_APIkey_*.txt "/mnt/d/Downloads/muddy tires/AIMLAPI_APIkey_5695e802.txt" 2>/dev/null); do
  K=$(tr -d '\r\n ' < "$f")
  CODE=$(curl -s -o /tmp/probe.json -w '%{http_code}' --max-time 25 \
    -H "Authorization: Bearer $K" -H 'Content-Type: application/json' \
    -d '{"model":"anthropic/claude-sonnet-5","messages":[{"role":"user","content":"hi"}],"max_tokens":1}' \
    https://api.aimlapi.com/v1/chat/completions)
  echo "$(basename "$f") len=${#K} -> HTTP $CODE"
  if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then GOOD="$K"; echo "  ^ WORKS"; break; fi
done
if [ -n "$GOOD" ]; then
  sed -i '/^AIMLAPI_KEY=/d' /root/bfclproj/.env
  echo "AIMLAPI_KEY=$GOOD" >> /root/bfclproj/.env
  echo ".env updated with working key (not shown)"
else
  echo "NO KEY WORKS ON COMPLETIONS — operator's account may need a top-up or fresh key"
fi
exit 0
