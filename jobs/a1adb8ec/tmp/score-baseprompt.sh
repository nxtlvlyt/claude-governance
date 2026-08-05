#!/usr/bin/env bash
# Score the completed base-Prompt lane (CPU-only) + error-row denominators per QUEUE.md rule.
set -uo pipefail
cd /root/bfclproj
set -a; . ./.env; set +a
/root/bfclenv/bin/bfcl evaluate --model qwen3.6-27b-base --test-category web_search_base \
  --result-dir /root/bfclproj/result --score-dir /root/bfclproj/score
echo "=== web_search rows in overall CSV ==="
grep -i 'qwen\|arch' /root/bfclproj/score/data_overall.csv | head -8
echo "=== error-row denominators (base-Prompt result) ==="
R=/root/bfclproj/result/qwen3.6-27b-base/agentic/BFCL_v4_web_search_base_result.json
echo -n "rows: "; wc -l < "$R"
echo -n "timeout rows: "; grep -c 'APITimeoutError\|Request timed out' "$R" || true
exit 0
