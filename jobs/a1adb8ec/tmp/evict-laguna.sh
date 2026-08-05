#!/usr/bin/env bash
# Force-unload laguna (idle-resident, dead client, 4h keep_alive) and verify.
set -uo pipefail
curl -s http://172.30.144.1:11434/api/generate -d '{"model":"laguna-xs-2.1:q8_0","keep_alive":0}' -o /dev/null -w 'unload req: %{http_code}\n'
sleep 15
echo -n "residency: "; curl -s http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json; ms=json.load(sys.stdin).get("models") or []; print("(none)" if not ms else ", ".join(m["name"] for m in ms))'
echo -n "gpu used : "; nvidia-smi --query-gpu=memory.used --format=csv,noheader | head -1
exit 0
