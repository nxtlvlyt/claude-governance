#!/usr/bin/env bash
# Kill the STALLED trainer chain (1h frozen at step 295, py-spy receipt banked) ahead of refire.
set -uo pipefail
for pid in $(ps -eo pid,args | grep -E '[t]rain_student_generic|[t]rain-v35' | awk '{print $1}'); do
  echo "kill $pid"; kill "$pid" 2>/dev/null || true
done
sleep 5
for pid in $(ps -eo pid,args | grep -E '[t]rain_student_generic' | awk '{print $1}'); do
  echo "kill -9 $pid"; kill -9 "$pid" 2>/dev/null || true
done
sleep 3
echo -n "remaining trainer procs: "; ps -eo args | grep -c '[t]rain_student_generic' || true
echo -n "gpu after: "; nvidia-smi --query-gpu=memory.used --format=csv,noheader | head -1
exit 0
