#!/usr/bin/env bash
set -uo pipefail
L=/root/bfclproj/fc-detached.log
echo "=== $(date) ==="
echo -n "generate procs : "; ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true
echo -n "keepalive      : "; ps -eo args | grep -c '[s]leep 43200' || true
echo "--- rows ---"
for f in /root/bfclproj/result/arch-gov-27b-sys-FC/agentic/*.json /root/bfclproj/result/arch-gov-27b-sys/agentic/*.json; do
  [ -f "$f" ] && printf "  %4s  %s/%s\n" "$(wc -l < "$f")" "$(basename "$(dirname "$(dirname "$f")")")" "$(basename "$f")"
done
echo "--- progress bar ---"
tr '\r' '\n' < "$L" 2>/dev/null | grep -oE '[0-9]+/100 \[[^]]*\]' | tail -2
echo "--- any score yet ---"
grep -E 'Accuracy|### ' "$L" 2>/dev/null | tail -4
echo "--- search spend ---"
python3 - <<'PY'
import io, json, os
p="/root/bfclproj/search-calls.jsonl"
if os.path.exists(p):
    rs=[json.loads(l) for l in io.open(p,encoding='utf-8') if l.strip()]
    if rs:
        x=rs[-1]
        print("  calls=%d empty=%d (%.1f%%)  approx $%.2f" % (x['calls'],x['empty'],100.0*x['empty']/max(x['calls'],1),x['calls']*5.0/1000))
PY
