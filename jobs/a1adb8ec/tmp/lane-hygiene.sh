#!/usr/bin/env bash
# Kill the WSL-restart duplicates of ALREADY-COMPLETED evals (results banked in scorecards).
# KEEP: bfcl generate qwen3.6-27b-base (base-Prompt lane — fills the 2x2's empty cell).
# KEEP: the cq-train-v35 wait chain (correctly queued).
set -uo pipefail
echo "--- before ---"
ps -eo pid,args | grep -E '[r]ejudge-tools|[h]oldout-eval' || echo "(none)"
for pid in $(ps -eo pid,args | grep -E '[r]ejudge-tools\.py|[h]oldout-eval\.py' | awk '{print $1}'); do
  echo "killing $pid"
  kill "$pid" 2>/dev/null || true
done
sleep 3
echo "--- after ---"
ps -eo pid,args | grep -E '[r]ejudge-tools|[h]oldout-eval' || echo "(none left)"
echo "--- lane + trainer chain intact? ---"
ps -eo pid,args | grep '[b]fcl generate' | head -2
ps -eo pid,args | grep '[t]rain-v35' | head -3 || true
exit 0
