#!/usr/bin/env bash
# The first VALID web_search_base measurement: system prompt present, search backend live,
# full n=100. Everything before this measured a muted model using a disconnected tool.
set -uo pipefail
echo "=== $(date) ==="
echo "=== run tail ==="
tr '\r' '\n' < /root/bfclproj/websearch-detached.log | grep -E '^###|Accuracy|calls=' | tail -8

echo
echo "=== search telemetry for the whole run (was it live throughout?) ==="
python3 - <<'PY'
import io, json, os
p = "/root/bfclproj/search-calls.jsonl"
if not os.path.exists(p):
    print("  no log"); raise SystemExit
rs = [json.loads(l) for l in io.open(p, encoding="utf-8") if l.strip()]
if not rs:
    print("  empty"); raise SystemExit
last = rs[-1]
print("  calls=%d  empty=%d (%.1f%%)  approx Brave spend=$%.2f"
      % (last["calls"], last["empty"], 100.0*last["empty"]/max(last["calls"],1),
         last["calls"]*5.0/1000))
# A run that was healthy throughout should have no long empty streak.
streak = best = 0
for r in rs:
    streak = streak + 1 if r["n"] == 0 else 0
    best = max(best, streak)
print("  longest consecutive-empty streak: %d  (guard fires at 5)" % best)
print("  -> %s" % ("search was live throughout" if best < 5 else "SEARCH DIED DURING THE RUN"))
PY

echo
echo "=== score at full n=100 ==="
cd /root/bfclproj
set -a; . ./.env; set +a
/root/bfclenv/bin/bfcl evaluate --model arch-gov-27b-sys --test-category web_search_base \
    --result-dir /root/bfclproj/result --score-dir /root/bfclproj/score 2>&1 | grep -E "Accuracy|Error"

echo
echo "=== how many entries actually reached an answer ==="
python3 - <<'PY'
import io, json, re
p = "/root/bfclproj/result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json"
rows = q = ans = 0
for line in io.open(p, encoding="utf-8"):
    line = line.strip()
    if not line: continue
    rows += 1
    s = json.dumps(json.loads(line).get("result"))
    q += len(re.findall(r"search_engine_query", s))
    if "'answer'" in s or '"answer"' in s: ans += 1
print("  rows=%d  search_calls=%d (%.1f/entry)  reached_an_answer=%d (%.0f%%)"
      % (rows, q, q/max(rows,1), ans, 100.0*ans/max(rows,1)))
PY

echo
echo "=== TABLE ==="
cat /root/bfclproj/score/data_agentic.csv 2>/dev/null
