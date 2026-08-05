#!/usr/bin/env bash
# Sonnet 5 comparator lanes (FC then Prompt), same harness as every other cell.
# Remote endpoint — no GPU, safe beside the trainer. Env vars are process-local.
set -uo pipefail
LOG=/root/bfclproj/sonnet5.log
exec > >(tee -a "$LOG") 2>&1
echo "######## SONNET5 LANES $(date -Is) ########"
cd /root/bfclproj
set -a; . ./.env; set +a
export REMOTE_OPENAI_BASE_URL="https://api.aimlapi.com/v1"
export REMOTE_OPENAI_API_KEY="$AIMLAPI_KEY"

echo "=== preflight: search live ==="
R=$(curl -s --max-time 25 "$SEARXNG_URL/search?q=test+preflight&format=json" | head -c 300)
if [ "${#R}" -lt 200 ]; then echo "SEARCH PREFLIGHT FAILED (${#R} chars)"; exit 1; fi
echo "  search ok (${#R} chars)"

echo "=== lane 1: sonnet-5-aiml-FC :: web_search_base :: $(date -Is) ==="
/root/bfclenv/bin/bfcl generate --model sonnet-5-aiml-FC --test-category web_search_base \
  --skip-server-setup --num-threads 2 --result-dir /root/bfclproj/result
echo "### FC LANE rc=$? $(date -Is)"

echo "=== lane 2: sonnet-5-aiml (Prompt) :: web_search_base :: $(date -Is) ==="
/root/bfclenv/bin/bfcl generate --model sonnet-5-aiml --test-category web_search_base \
  --skip-server-setup --num-threads 2 --result-dir /root/bfclproj/result
echo "### PROMPT LANE rc=$? $(date -Is)"

echo "=== score both ==="
/root/bfclenv/bin/bfcl evaluate --model sonnet-5-aiml-FC --test-category web_search_base \
  --result-dir /root/bfclproj/result --score-dir /root/bfclproj/score
/root/bfclenv/bin/bfcl evaluate --model sonnet-5-aiml --test-category web_search_base \
  --result-dir /root/bfclproj/result --score-dir /root/bfclproj/score
echo "######## SONNET5 LANES DONE $(date -Is) ########"
