#!/usr/bin/env bash
set -uo pipefail
echo "=== $(date) ==="
echo "--- processes ---"
ps -eo pid,etime,pcpu,rss,args | grep '[t]rain_student_generic' || echo "  NO TRAINER PROCESS"
echo -n "  train-now wrapper: "; ps -eo args | grep -c '[t]rain-now' || true
echo
echo "--- gpu ---"
nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader 2>/dev/null
echo
echo "--- log size / last write ---"
stat -c '  %s bytes, modified %y' /root/bfclproj/train-v34.log 2>/dev/null
echo
echo "--- last real progress line (CR-split) ---"
tr '\r' '\n' < /root/bfclproj/train-v34.log 2>/dev/null | grep -viE '^\s*$' | tail -6
echo
echo "--- did it get past loading? ---"
grep -cE 'loaded unsloth|target modules verified|training starts|dataset rows' /root/bfclproj/train-v34.log 2>/dev/null || echo 0
grep -E 'loaded unsloth|target modules verified|training starts|dataset rows|FATAL|Error|Traceback' /root/bfclproj/train-v34.log 2>/dev/null | tail -6
echo
echo "--- launch log (stderr) ---"
tail -6 /root/bfclproj/train-launch.log 2>/dev/null | grep -v '^\s*$' || echo "  (empty)"
