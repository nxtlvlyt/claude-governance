#!/usr/bin/env bash
# V35-REFIRE-ROPE probe v3: TRAINER-RUNNING / TRAINER-QUEUED / REFIRE-OK / STILL-BLOCKED.
# Gate on NON-OLLAMA VRAM (train-v35.sh unloads Ollama itself). Threshold: non-Ollama <= 3000 MiB.
# v3 adds TRAINER-QUEUED: a train-v35.sh chain in its wait loop means DO NOT refire (double-queue).
set -uo pipefail
if [ "$(ps -eo args | grep -c '[t]rain_student_generic' || true)" -gt 0 ]; then
  echo "TRAINER-RUNNING"
  tr '\r' '\n' < /root/bfclproj/train-v35.log 2>/dev/null | grep -oE '[0-9]+/[0-9]+ \[[^]]*\]' | tail -1
  exit 0
fi
if [ "$(ps -eo args | grep -c '[t]rain-v35.sh' || true)" -gt 0 ]; then
  echo "TRAINER-QUEUED (chain waiting for the gpu lane; do not refire)"
  ps -eo pid,etime,args | grep '[b]fcl generate' | head -1 || echo "  (no lane visible — chain in sleep window)"
  exit 0
fi
USED=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1 | tr -d ' ')
OLLAMA_MB=$(curl -s --max-time 10 http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json; print(sum(m.get("size_vram",0) for m in (json.load(sys.stdin).get("models") or []))//(1024*1024))' 2>/dev/null || echo 0)
NONOLLAMA=$((USED - OLLAMA_MB))
if [ "$NONOLLAMA" -le 3000 ]; then
  echo "REFIRE-OK nonollama=${NONOLLAMA}MiB (used=${USED}, ollama=${OLLAMA_MB})"
else
  echo "STILL-BLOCKED nonollama=${NONOLLAMA}MiB (used=${USED}, ollama=${OLLAMA_MB})"
fi
exit 0
