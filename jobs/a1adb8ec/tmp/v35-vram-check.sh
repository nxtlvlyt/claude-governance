#!/usr/bin/env bash
# V35-REFIRE-ROPE probe: is the GPU free enough to refire cq-train-v35?
# v3.4's successful baseline was 2153 MiB used (22.4GB free); v3.5 OOM'd at 5189 used (19.4GB free).
# Threshold: free >= 21500 MiB (used <= ~3064) — conservative midpoint receipted in QUEUE.md.
set -uo pipefail
TRAINERS=$(ps -eo args | grep -c '[t]rain_student_generic' || true)
if [ "$TRAINERS" -gt 0 ]; then
  echo "TRAINER-RUNNING"
  tr '\r' '\n' < /root/bfclproj/train-v35.log 2>/dev/null | grep -oE '[0-9]+/[0-9]+ \[[^]]*\]' | tail -1
  exit 0
fi
USED=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1 | tr -d ' ')
TOTAL=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1 | tr -d ' ')
FREE=$((TOTAL - USED))
if [ "$FREE" -ge 21500 ]; then
  echo "REFIRE-OK free=${FREE}MiB"
else
  echo "STILL-BLOCKED used=${USED}MiB free=${FREE}MiB"
fi
exit 0
