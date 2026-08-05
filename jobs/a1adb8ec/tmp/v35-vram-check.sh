#!/usr/bin/env bash
# V35-REFIRE-ROPE probe v2: gate on NON-OLLAMA VRAM (the share train-v35.sh cannot clear itself).
# v3.4 trained from 2153 MiB non-Ollama baseline; v3.5 OOM'd at 5189. Threshold: non-Ollama <= 3000 MiB.
# (v1 gated on total free, which a daemon-warmed qwen3.6:27b masks forever; the script unloads Ollama.)
set -uo pipefail
TRAINERS=$(ps -eo args | grep -c '[t]rain_student_generic' || true)
if [ "$TRAINERS" -gt 0 ]; then
  echo "TRAINER-RUNNING"
  tr '\r' '\n' < /root/bfclproj/train-v35.log 2>/dev/null | grep -oE '[0-9]+/[0-9]+ \[[^]]*\]' | tail -1
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
