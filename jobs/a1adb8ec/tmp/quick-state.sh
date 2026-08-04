#!/usr/bin/env bash
set -uo pipefail
echo "=== $(date) ==="
echo -n "trainer/merge alive: "; ps -eo args | grep -c '[t]rain_student_generic' || true
echo -n "post-merge chain   : "; ps -eo args | grep -c '[p]ost-merge-chain' || true
echo "--- merge progress ---"
tr '\r' '\n' < /root/bfclproj/train-v34.log 2>/dev/null | grep -oE 'Merging weights into 16bit: +[0-9]+/15' | tail -1
grep -E 'merged 16-bit saved|TRAIN rc' /root/bfclproj/train-v34.log 2>/dev/null | tail -2
echo "--- post-merge chain log ---"
tail -5 /root/bfclproj/post-merge.log 2>/dev/null | grep -v '^\s*$'
