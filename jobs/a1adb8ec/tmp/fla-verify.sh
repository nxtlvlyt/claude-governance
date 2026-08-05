#!/usr/bin/env bash
# Did relaunch #7 load WITHOUT the slow-path warning, and is it stepping faster?
set -uo pipefail
sleep 90
echo "--- fast-path warning present in newest section? ---"
LAST=$(grep -n '######## TRAIN v3.5' /root/bfclproj/train-v35.log | tail -1 | cut -d: -f1)
tail -n +$LAST /root/bfclproj/train-v35.log | grep -ci "fast path is not available" || echo "0 (warning GONE)"
echo "--- latest steps ---"
tail -n +$LAST /root/bfclproj/train-v35.log | tr '\r' '\n' | grep -oE '[0-9]+/720 \[[^]]*\]' | tail -3
echo -n "trainer procs: "; ps -eo args | grep -c '[t]rain_student_generic' || true
exit 0
