#!/usr/bin/env bash
# Stuck counter: real stall or log buffering? mtime + GPU activity + newest counters.
set -uo pipefail
echo -n "log mtime : "; stat -c '%y' /root/bfclproj/train-v35.log
echo -n "gpu       : "; nvidia-smi --query-gpu=memory.used,utilization.gpu,power.draw --format=csv,noheader | head -1
echo "--- last 3 counters in log ---"
tr '\r' '\n' < /root/bfclproj/train-v35.log | grep -oE '[0-9]+/720 \[[^]]*\]' | tail -3
echo -n "trainer procs: "; ps -eo pid,etime,pcpu,args | grep '[t]rain_student_generic' | head -2
exit 0
