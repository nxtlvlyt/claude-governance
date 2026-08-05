#!/usr/bin/env bash
# Graceful VRAM release: ask the idle SD server (A1111 or ComfyUI) to unload, no process kill.
set -uo pipefail
H=172.30.144.1
for p in 7860 8188; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$H:$p/" || true)
  echo "port $p -> HTTP $code"
done
# A1111: POST /sdapi/v1/unload-checkpoint
r=$(curl -s -X POST --max-time 20 "http://$H:7860/sdapi/v1/unload-checkpoint" -o /dev/null -w '%{http_code}' || true)
echo "a1111 unload -> HTTP $r"
# ComfyUI: POST /free {"unload_models":true,"free_memory":true}
r=$(curl -s -X POST --max-time 20 "http://$H:8188/free" -H 'Content-Type: application/json' -d '{"unload_models":true,"free_memory":true}' -o /dev/null -w '%{http_code}' || true)
echo "comfy free -> HTTP $r"
sleep 10
echo -n "GPU now: "; nvidia-smi --query-gpu=memory.used --format=csv,noheader | head -1
exit 0
