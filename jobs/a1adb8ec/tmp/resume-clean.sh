#!/usr/bin/env bash
# Resume web_search_base with verified-live search, discarding only the rows whose provenance
# cannot be established.
#
# SITUATION
# Brave's $5 monthly credit ran out mid-run (HTTP 402, current_spend 5.0 / usage_limit 5.0).
# All engines went unresponsive and searches returned 0 results. The operator has since raised
# the limit; the key now returns 19 results direct and SearXNG returns 20.
#
# PROVENANCE
#   rows 1-31   generated and SCORED (58.06%, 22/31 answered) while search was verified live
#               by preflight (4459 chars) - VALID, keep.
#   rows 32-57  generated in the window where the quota ran out. Answer rate 14/26 (54%) vs
#               22/31 (71%) - lower, but not zero, so no clean cutoff row exists. And
#               "answered" does not prove search worked: the model can answer some of these
#               from parametric knowledge, which is the confound. UNVERIFIABLE, regenerate.
#
# Regenerating 26 entries costs ~65 Brave calls (~$0.33). The whole of 2026-08-03 was spent
# discovering what unverified provenance costs; $0.33 is cheaper than one more such finding.
#
# The banked file is COPIED before truncation, never just deleted - a prior nohup relaunch
# after an `rm` lost 120 BFCL rows for nothing.
set -uo pipefail

BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score
F="$RES/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json"

cd /root/bfclproj
set -a; . ./.env; set +a

echo "=== preflight: search must be live, and the guard must be armed ==="
python3 - <<'PY'
import sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI, SearchBackendDead
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
if out.strip() in ("{}", "[]", "None", "") or len(out) < 200:
    print("PREFLIGHT FAIL: search returned %d chars. Refusing." % len(out)); raise SystemExit(2)
print("  search live: %d chars" % len(out))
print("  guard armed: %s importable, fires after 5 consecutive empties" % SearchBackendDead.__name__)
PY
[ $? -ne 0 ] && exit 2

echo
echo "=== preserve the banked file, then keep only the verified-live rows ==="
cp "$F" "$F.bak-57rows-mixed-provenance-20260803"
echo "  copied to $(basename "$F").bak-57rows-mixed-provenance-20260803 ($(wc -l < "$F") rows)"
head -31 "$F" > "$F.tmp" && mv "$F.tmp" "$F"
echo "  kept $(wc -l < "$F") verified-live rows; BFCL will regenerate the rest by id"

echo
echo "=== resume to 100 ==="
$BFCL generate --model arch-gov-27b-sys --test-category web_search_base \
    --skip-server-setup --num-threads 4 --result-dir "$RES"
echo "  rc=$?  rows: $(wc -l < "$F" 2>/dev/null || echo 0)"

echo
echo "=== search consumption during this run (the guard's log) ==="
if [ -f /root/bfclproj/search-calls.jsonl ]; then
  python3 - <<'PY'
import io, json
rows = [json.loads(l) for l in io.open("/root/bfclproj/search-calls.jsonl", encoding="utf-8") if l.strip()]
if rows:
    last = rows[-1]
    print("  total calls logged: %d   empty: %d   (%.1f%% empty)"
          % (last["calls"], last["empty"], 100.0*last["empty"]/max(last["calls"],1)))
    print("  approx Brave spend this session: $%.2f  (at $5 per 1000)" % (last["calls"]*5.0/1000))
PY
fi

echo
echo "=== score at full n ==="
$BFCL evaluate --model arch-gov-27b-sys --test-category web_search_base \
    --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Error"
echo
date
cat "$SCORE/data_agentic.csv" 2>/dev/null
