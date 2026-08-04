#!/usr/bin/env bash
# Launch web_search_base so it SURVIVES an ssh drop.
#
# WHY THIS PATTERN AND NOT THE ONE I HAVE BEEN USING
# Four runs today were launched by holding a foreground ssh session. Each time the local task
# was killed or dropped, and the job either died with it or appeared to. The last one died at
# 32/100 with no error and no traceback - the signature of SIGHUP, not a crash.
#
# PIPELINE.md:23 records the pattern, and I did not use it:
#   "DETACH PATTERN, exact: setsid nohup bash <script> </dev/null > <log> 2>&1 & disown
#    - the </dev/null is mandatory (two installs died without it), verify the process is alive
#    (pgrep) before ending the beat"
#
# The </dev/null matters: without it the child inherits the ssh session's stdin, and closing
# that connection takes the job down. setsid detaches it from the controlling terminal so a
# hangup cannot reach it.
#
# The other half of PIPELINE.md:23 is "verify the process is alive before ending the beat" -
# so this script launches, waits, and proves liveness before returning.
set -uo pipefail

RUN=/mnt/c/Users/marka/resume-clean-inner.sh
LOG=/root/bfclproj/websearch-detached.log

cat > "$RUN" <<'INNER'
#!/usr/bin/env bash
set -uo pipefail
BFCL=/root/bfclenv/bin/bfcl
RES=/root/bfclproj/result
SCORE=/root/bfclproj/score
F="$RES/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json"
cd /root/bfclproj
set -a; . ./.env; set +a

echo "### START $(date -Is)  rows=$(wc -l < "$F" 2>/dev/null || echo 0)"

python3 - <<'PY'
import sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
if len(out) < 200:
    print("PREFLIGHT FAIL: search returned %d chars" % len(out)); raise SystemExit(2)
print("preflight OK: %d chars" % len(out))
PY
[ $? -ne 0 ] && { echo "### ABORT: preflight failed"; exit 2; }

$BFCL generate --model arch-gov-27b-sys --test-category web_search_base \
    --skip-server-setup --num-threads 4 --result-dir "$RES"
echo "### generate rc=$?  rows=$(wc -l < "$F" 2>/dev/null || echo 0)"

$BFCL evaluate --model arch-gov-27b-sys --test-category web_search_base \
    --result-dir "$RES" --score-dir "$SCORE" 2>&1 | grep -E "Accuracy|Error"

echo "### search telemetry"
python3 - <<'PY'
import io, json, os
p = "/root/bfclproj/search-calls.jsonl"
if os.path.exists(p):
    rs = [json.loads(l) for l in io.open(p, encoding="utf-8") if l.strip()]
    if rs:
        last = rs[-1]
        print("  calls=%d empty=%d (%.1f%%)  approx spend=$%.2f"
              % (last["calls"], last["empty"],
                 100.0*last["empty"]/max(last["calls"],1), last["calls"]*5.0/1000))
PY
echo "### DONE $(date -Is)"
cat "$SCORE/data_agentic.csv" 2>/dev/null
INNER
chmod +x "$RUN"
sed -i 's/\r$//' "$RUN"
bash -n "$RUN" && echo "  inner script parses OK"

echo "=== refuse to stack a second generate ==="
n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
if [ "${n:-0}" -gt 0 ]; then echo "  ABORT: $n already running"; exit 3; fi
echo "  clear"

echo
echo "=== launch detached (setsid + nohup + </dev/null, per PIPELINE.md:23) ==="
setsid nohup bash "$RUN" </dev/null > "$LOG" 2>&1 &
disown || true
sleep 12

echo "=== verify alive BEFORE returning (the other half of PIPELINE.md:23) ==="
echo -n "  generate procs: "
ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true
echo -n "  inner script procs: "
ps -eo args | grep -c 'resume-clean-inner' || true
echo "  log so far:"
tr '\r' '\n' < "$LOG" 2>/dev/null | grep -viE 'screen size|^\s*$' | tail -5 | sed 's/^/    /'
echo
echo "  log: $LOG"
