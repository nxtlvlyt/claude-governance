#!/usr/bin/env bash
# Timeout-row counts for the already-scored v3.3 lanes (fair-comparison rule).
set -uo pipefail
for m in arch-gov-27b-sys-FC arch-gov-27b-sys arch-gov-27b; do
  f="/root/bfclproj/result/$m/agentic/BFCL_v4_web_search_base_result.json"
  if [ -f "$f" ]; then
    echo "$m: rows=$(wc -l < "$f") timeouts=$(grep -c 'APITimeoutError' "$f" || true)"
  fi
done
exit 0
