#!/usr/bin/env bash
set -uo pipefail
grep -c 'TRAIN rc=' /root/bfclproj/train-v35.log || true
grep 'TRAIN rc=' /root/bfclproj/train-v35.log | tail -2
grep -c '######## TRAIN v3.5 2026' /root/bfclproj/train-v35.log || true
exit 0
