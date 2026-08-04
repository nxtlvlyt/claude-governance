#!/usr/bin/env bash
set -uo pipefail
echo "=== $(date) ==="
echo "--- base-FC lane progress ---"
tr '\r' '\n' < /root/bfclproj/fairbase.log 2>/dev/null | grep -oE '[0-9]+/80 \[[^]]*\]' | tail -2
echo "--- v3.5 trainer state (waiting for the lane, or started?) ---"
tail -4 /root/bfclproj/train-v35.log 2>/dev/null | grep -v '^\s*$' || echo "  (log not started)"
echo -n "  trainer procs: "; ps -eo args | grep -c '[t]rain_student_generic' || true
