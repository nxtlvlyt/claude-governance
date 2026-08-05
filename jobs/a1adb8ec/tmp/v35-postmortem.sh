#!/usr/bin/env bash
# What killed the 08:06 training run?
set -uo pipefail
echo "--- lines after the newest banner ---"
awk '/######## TRAIN v3.5 2026-08-05T02:18/{found=1} found' /root/bfclproj/train-v35.log | tail -30
echo "--- TRAIN rc lines (all) ---"
grep -n 'TRAIN rc=\|DONE 2026-08-05' /root/bfclproj/train-v35.log | tail -4
exit 0
