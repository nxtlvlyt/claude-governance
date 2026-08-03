#!/usr/bin/env bash
# Real progress check: row count + mtime, not the \r-buffered progress bar.
set -uo pipefail
F=/root/bfclproj/result/qwen3.6-27b-base/multi_turn/BFCL_v4_multi_turn_base_result.json
date
if [ -f "$F" ]; then
  echo "rows : $(wc -l < "$F")"
  stat -c 'mtime: %y' "$F"
else
  echo "rows : 0 (file not created yet)"
fi
echo "started: $(grep -m1 'GENERATE CONTROL' /root/bfclproj/serial-multiturn.log | sed 's/.*:: //')"
echo "bar    : $(tr '\r' '\n' < /root/bfclproj/serial-multiturn.log | grep -o '[0-9]*/200 \[[^]]*\]' | tail -1)"
