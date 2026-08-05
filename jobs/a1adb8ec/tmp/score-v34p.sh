#!/usr/bin/env bash
# Score the completed v3.4-Prompt lane, then watch the trainer launch (sweep receipt + dry-run).
set -uo pipefail
cd /root/bfclproj
set -a; . ./.env; set +a
/root/bfclenv/bin/bfcl evaluate --model arch-gov-27b-v34 --test-category web_search_base \
  --result-dir /root/bfclproj/result --score-dir /root/bfclproj/score
echo "=== denominators ==="
R=/root/bfclproj/result/arch-gov-27b-v34/agentic/BFCL_v4_web_search_base_result.json
echo -n "rows: "; wc -l < "$R"
echo -n "timeout rows: "; grep -c 'APITimeoutError\|Request timed out' "$R" || true
echo "=== wait up to 7 min for the trainer to pass its release step ==="
for i in $(seq 1 42); do
  if grep -q 'DRYRUN rc=' /root/bfclproj/train-v35.log 2>/dev/null; then break; fi
  sleep 10
done
echo "--- train-v35.log tail ---"
tail -15 /root/bfclproj/train-v35.log
echo -n "--- trainer procs: "; ps -eo args | grep -c '[t]rain_student_generic' || true
exit 0
