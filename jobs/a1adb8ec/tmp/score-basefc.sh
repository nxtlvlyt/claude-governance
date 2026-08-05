#!/usr/bin/env bash
# Score the base-FC control lane, then print the score table + error-row denominators.
set -uo pipefail
cd /root/bfclproj
set -a; . ./.env; set +a
/root/bfclenv/bin/bfcl evaluate --model qwen3.6-27b-base-FC --test-category web_search_base \
  --result-dir /root/bfclproj/result --score-dir /root/bfclproj/score
echo "=== score CSV (web_search rows) ==="
grep -i 'web_search\|model\|qwen\|arch' /root/bfclproj/score/data_overall.csv 2>/dev/null | head -12
echo "=== per-model score files ==="
ls /root/bfclproj/score/qwen3.6-27b-base-FC/agentic/ 2>/dev/null
echo "=== error-row denominators (base-FC result) ==="
R=/root/bfclproj/result/qwen3.6-27b-base-FC/agentic/BFCL_v4_web_search_base_result.json
echo -n "rows: "; wc -l < "$R"
echo -n "timeout rows: "; grep -c 'APITimeoutError\|Request timed out' "$R" || true
exit 0
