#!/usr/bin/env bash
# What GPU baseline did v3.4's successful train start from?
set -uo pipefail
echo "--- logs mentioning TRAIN v3.4 ---"
grep -l 'TRAIN v3.4' /root/bfclproj/*.log /root/*.log 2>/dev/null || echo "(none found)"
echo "--- all gpu: baseline lines across train logs ---"
grep -Hn 'gpu:' /root/bfclproj/*.log /root/*.log 2>/dev/null | tail -8
echo "--- v3.5 OOM context (5 lines around) ---"
grep -n -B2 -A3 'negligible GPU memory' /root/bfclproj/train-v35.log | head -20
exit 0
