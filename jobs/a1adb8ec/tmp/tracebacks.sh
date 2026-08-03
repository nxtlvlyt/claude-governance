#!/usr/bin/env bash
set -uo pipefail
LOG=/root/bfclproj/serial-multiturn.log
echo "=== date ==="; date
echo
echo "=== traceback count ==="
tr '\r' '\n' < "$LOG" | grep -c "Traceback" || echo 0
echo
echo "=== each traceback with 14 lines of context ==="
tr '\r' '\n' < "$LOG" | grep -n -A14 "Traceback" | head -70
echo
echo "=== is generate still alive? (non-self-matching) ==="
ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true
echo
echo "=== rows now ==="
wc -l < /root/bfclproj/result/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json 2>/dev/null || echo 0
echo
echo "=== last 6 progress-bar states ==="
tr '\r' '\n' < "$LOG" | grep -o '[0-9]*/200 \[[^]]*\]' | tail -6
