#!/usr/bin/env bash
# Score the completed v3.4-FC lane + denominators.
set -uo pipefail
cd /root/bfclproj
set -a; . ./.env; set +a
/root/bfclenv/bin/bfcl evaluate --model arch-gov-27b-v34-FC --test-category web_search_base \
  --result-dir /root/bfclproj/result --score-dir /root/bfclproj/score
echo "=== relevant CSV rows ==="
grep -i 'v34\|v3.4' /root/bfclproj/score/data_overall.csv | head -4
echo "=== denominators ==="
R=/root/bfclproj/result/arch-gov-27b-v34-FC/agentic/BFCL_v4_web_search_base_result.json
echo -n "rows: "; wc -l < "$R"
echo -n "timeout rows: "; grep -c 'APITimeoutError\|Request timed out' "$R" || true
exit 0
