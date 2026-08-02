#!/bin/bash
~/bfclenv/bin/python /mnt/c/Users/marka/bfcl-register.py
echo "=== resolve the ollama endpoint from inside WSL ==="
HOSTIP=$(ip route show default | awk '{print $3}' | head -1)
for U in "http://nxtbeast:11434" "http://$HOSTIP:11434" "http://localhost:11434"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$U/api/tags")
  echo "  $U -> $code"
  if [ "$code" = "200" ]; then echo "USABLE=$U" > /tmp/ollama_url; fi
done
cat /tmp/ollama_url 2>/dev/null || echo "NO-USABLE-ENDPOINT"
echo "=== does bfcl see the new models? ==="
~/bfclenv/bin/bfcl models 2>&1 | grep -i "arch-gov\|qwen3.6-27b-base" | head -6
