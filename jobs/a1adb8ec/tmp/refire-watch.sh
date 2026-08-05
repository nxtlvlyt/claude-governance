#!/usr/bin/env bash
# Watch the refired v3.5 attempt: wait 150s, then report log tail + trainer proc count.
set -uo pipefail
sleep 150
echo "--- train-v35.log tail ---"
tail -12 /root/bfclproj/train-v35.log
echo "--- trainer procs ---"
ps -eo args | grep -c '[t]rain_student_generic' || true
exit 0
