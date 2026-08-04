#!/usr/bin/env bash
set -uo pipefail
F=/root/bfclproj/result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json
echo "=== $(date) ==="
echo -n "generate procs: "
ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true
echo -n "rows: "; wc -l < "$F" 2>/dev/null || echo 0
echo "--- progress bar ---"
tail -400 /root/bfclproj/search-real.log 2>/dev/null | tr '\r' '\n' | grep -o '[0-9]*/69 \[[^]]*\]' | tail -2
echo "--- guard telemetry (the point of installing it) ---"
python3 - <<'PY'
import io, json, os
p = "/root/bfclproj/search-calls.jsonl"
if not os.path.exists(p):
    print("  no log"); raise SystemExit
rs = [json.loads(l) for l in io.open(p, encoding="utf-8") if l.strip()]
if not rs:
    print("  empty"); raise SystemExit
last = rs[-1]
print("  calls=%d  empty=%d (%.1f%%)  consecutive-empty tolerance=5"
      % (last["calls"], last["empty"], 100.0*last["empty"]/max(last["calls"], 1)))
print("  approx Brave spend this session: $%.2f  (at $5 per 1000)" % (last["calls"]*5.0/1000))
recent = rs[-12:]
bad = sum(1 for r in recent if r["n"] == 0)
print("  last 12 calls: %d returned nothing" % bad)
PY
