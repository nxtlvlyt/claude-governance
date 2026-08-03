#!/usr/bin/env bash
# Finish web_search_base ONLY. Do not run web_search_no_snippet.
#
# WHY THE SCOPE IS CUT
# Operator, 2026-08-03: "I see brave Api is almost maxed" / "if it's necessary that's fine".
# Measured before deciding: braveapi supplies 59/59 results across three probe queries;
# duckduckgo and startpage are CAPTCHA'd and the brave scraper reaches only 20. So search
# genuinely depends on the paid engine - it is necessary, and he has approved it.
#
# But the queued plan spent more than the question needs:
#   web_search_base remaining   ~69 entries x ~2.5 searches  = ~172 calls
#   web_search_no_snippet       ~100 entries x ~2.5 searches = ~250 calls
# The GATE-0 baseline that §4 requires is web_search_base. no_snippet is secondary and can
# wait for the quota to reset. Cutting it saves ~250 calls of a ~1000/month free tier at no
# cost to the load-bearing measurement.
#
# Restarting rather than editing the running script: bash reads scripts incrementally, so
# editing a file mid-execution can corrupt the remaining parse. BFCL resumes from existing
# rows, so a restart costs nothing already banked.
set -uo pipefail

BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score
F="$RES/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json"

cd /root/bfclproj
set -a; . ./.env; set +a

echo "=== stop the two-stage runner before it reaches no_snippet ==="
pkill -f 'run-search-real.sh' 2>/dev/null && echo "  launcher stopped" || echo "  launcher not running"
sleep 2
pkill -f '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' 2>/dev/null && echo "  generate stopped" || echo "  generate not running"
sleep 3
echo -n "  generate procs remaining: "; ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true
echo "  rows banked (NEVER deleted): $(wc -l < "$F" 2>/dev/null || echo 0) / 100"

echo
echo "=== preflight: search must be live, or this is another void run ==="
python3 - <<'PY'
import sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
if out.strip() in ("{}", "[]", "None", ""):
    print("PREFLIGHT FAIL: search empty. Refusing."); raise SystemExit(2)
print("PREFLIGHT OK: %d chars" % len(out))
PY
[ $? -ne 0 ] && exit 2

echo
echo "=== resume web_search_base to 100 (skips banked rows) ==="
$BFCL generate --model arch-gov-27b-sys --test-category web_search_base \
    --skip-server-setup --num-threads 4 --result-dir "$RES"
echo "  rc=$?  rows: $(wc -l < "$F" 2>/dev/null || echo 0)"

echo
echo "=== score at full n ==="
$BFCL evaluate --model arch-gov-27b-sys --test-category web_search_base \
    --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Error"

echo
echo "=== search calls actually issued (Brave consumption proxy) ==="
python3 - <<'PY'
import io, json, re
p = "/root/bfclproj/result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json"
q = rows = 0
for line in io.open(p, encoding="utf-8"):
    line = line.strip()
    if not line: continue
    rows += 1
    q += len(re.findall(r"search_engine_query", json.dumps(json.loads(line).get("result"))))
print("  rows=%d  search_engine_query calls=%d  (%.1f per entry)" % (rows, q, q / max(rows, 1)))
PY

echo
echo "NOT RUN, deliberately: web_search_no_snippet (~250 Brave calls). Deferred until quota"
echo "resets. It is secondary to the GATE-0 baseline; web_search_base is the required one."
echo "DONE $(date -Is)"
