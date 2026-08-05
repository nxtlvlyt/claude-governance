#!/usr/bin/env bash
# Second graceful pass: ComfyUI system_stats view + double /free + settle time.
set -uo pipefail
H=172.30.144.1
echo "--- comfy system_stats (its own VRAM view) ---"
curl -s --max-time 10 "http://$H:8188/system_stats" | python3 -m json.tool 2>/dev/null | head -25
echo "--- /free again ---"
curl -s -X POST --max-time 20 "http://$H:8188/free" -H 'Content-Type: application/json' -d '{"unload_models":true,"free_memory":true}' -o /dev/null -w 'HTTP %{http_code}\n'
sleep 20
echo -n "GPU after /free + 20s: "; nvidia-smi --query-gpu=memory.used --format=csv,noheader | head -1
exit 0
