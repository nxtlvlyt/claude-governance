#!/usr/bin/env bash
# Did relaunch #6 actually run WITHOUT the offload? Check its own log section + stack.
set -uo pipefail
echo "--- newest banner + smartly-offload lines after it ---"
awk '/######## TRAIN v3.5 2026-08-05T17:5/{found=1} found' /root/bfclproj/train-v35.log | grep -iE "smartly|offload|PLAN" | head -4
echo "--- stack head of spinning proc ---"
PID=$(ps -eo pid,pcpu,args | grep '[t]rain_student_generic' | sort -k2 -rn | head -1 | awk '{print $1}')
/root/cq-venv/bin/py-spy dump --pid "$PID" 2>&1 | grep -E "Thread|gradient_checkpointing|backward|Inductor" | head -12
exit 0
