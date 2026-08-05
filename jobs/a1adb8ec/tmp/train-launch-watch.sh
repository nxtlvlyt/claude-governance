#!/usr/bin/env bash
# Watch the CURRENT trainer launch: everything after the newest banner only.
set -uo pipefail
sleep 120
echo "--- lines after the newest TRAIN banner ---"
awk '/######## TRAIN v3.5 2026-08-05T02:18/{found=1} found' /root/bfclproj/train-v35.log | tail -20
echo -n "--- trainer procs: "; ps -eo args | grep -c '[t]rain_student_generic' || true
echo -n "--- gpu used: "; nvidia-smi --query-gpu=memory.used --format=csv,noheader | head -1
exit 0
