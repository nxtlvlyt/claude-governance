#!/usr/bin/env bash
# Pre-count error-class rows in the base-FC lane before scoring (per QUEUE.md scoring step).
set -uo pipefail
echo "--- fairbase.log error classes ---"
echo -n "APITimeoutError lines : "; grep -c 'APITimeoutError' /root/bfclproj/fairbase.log || true
echo -n "Empty response lines  : "; grep -c 'Empty response from the model' /root/bfclproj/fairbase.log || true
echo "--- result file rows (base-FC) ---"
R=$(ls /root/bfclproj/result/qwen3.6-27b-base-FC/*web_search_base* 2>/dev/null | head -1)
echo "file: ${R:-none-yet}"
if [ -n "${R:-}" ]; then
  echo -n "rows banked           : "; wc -l < "$R"
  echo -n "rows w/ error marker  : "; grep -c 'APITimeoutError\|Request timed out\|error' "$R" || true
fi
