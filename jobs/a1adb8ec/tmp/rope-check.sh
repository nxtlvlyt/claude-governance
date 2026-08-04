#!/usr/bin/env bash
set -uo pipefail
echo "=== $(date) ==="
echo -n "holdout-eval procs: "; ps -eo args | grep -c '[h]oldout-eval' || true
echo -n "python3 cq procs  : "; ps -eo pid,etime,pcpu,args | grep '[p]ython3.*cq-v34' | head -3 || echo 0
echo "--- gpu ---"
nvidia-smi --query-gpu=memory.used,utilization.gpu --format=csv,noheader 2>/dev/null | head -1
echo "--- ollama residency ---"
curl -s http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json; ms=json.load(sys.stdin).get("models") or []; print("  (none)" if not ms else "\n".join("  %s vram=%.1fGB" % (m["name"], m.get("size_vram",0)/1e9) for m in ms))' 2>/dev/null
echo "--- results file? ---"
ls -la /mnt/c/Users/marka/cq-v34/phase4/holdout-results.jsonl 2>/dev/null || echo "  not yet written (script writes at end)"
