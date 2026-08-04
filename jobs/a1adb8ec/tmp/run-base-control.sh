#!/usr/bin/env bash
# The control that should have run before 51.00% was ever quoted.
#
# WHY THIS EXISTS
# Score files, read 2026-08-04:
#   irrelevance     tuned 94.58  base 90.42   tune better
#   simple_python   tuned 65.00  base 66.25   tune worse
#   multi_turn      tuned 30.00  base 40.00   base higher (n=10, underpowered)
#   web_search_base tuned 51.00  base  ——     NO RESULT FILE FOR THE BASE AT ALL
#
# The whole of 2026-08-03 was spent establishing that a benchmark number without a control is
# uninterpretable — 14.00% was voided for exactly that. Then 51.00% was reported, scraped
# against a leaderboard, and written into three documents with no control of its own. Same
# defect, one level up, in the number being celebrated.
#
# So: untuned qwen3.6:27b, same 100 web_search_base entries, same live SearXNG backend, same
# grader. That answers whether the tune helped web_search at all.
#
# The base runs WITHOUT a system prompt because that is its native condition — it was never
# trained with one. The tuned model runs WITH its own, because that is how it ships. Both get
# working search. That is the honest pairing.
set -uo pipefail
BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score

cd /root/bfclproj
set -a; . ./.env; set +a

echo "=== preflight: search live ==="
python3 - <<'PY'
import sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
if len(out) < 200:
    print("PREFLIGHT FAIL: %d chars" % len(out)); raise SystemExit(2)
print("  live: %d chars" % len(out))
PY
[ $? -ne 0 ] && exit 2

n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
if [ "${n:-0}" -gt 0 ]; then echo "ABORT: $n generate already running — this must run SERIAL"; exit 3; fi

echo
echo "=== untuned base :: web_search_base :: live search :: $(date -Is) ==="
$BFCL generate --model qwen3.6-27b-base --test-category web_search_base \
    --skip-server-setup --num-threads 4 --result-dir "$RES"
echo "  rc=$?  rows=$(wc -l < "$RES/qwen3.6-27b-base/agentic/BFCL_v4_web_search_base_result.json" 2>/dev/null || echo 0)"

$BFCL evaluate --model qwen3.6-27b-base --test-category web_search_base \
    --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Error"

echo
echo "=== THE COMPARISON ==="
cat "$SCORE/data_agentic.csv"
echo
echo "### CONTROL DONE $(date -Is)"
