#!/usr/bin/env bash
# Run the remaining lanes SERIALLY, unattended, so the 2x2 completes without babysitting.
#
# THE MATRIX BEING COMPLETED (operator asked "will there be a base fc?" — there will):
#   tuned Prompt  51.00%   done
#   tuned FC      in flight (this script waits for it)
#   base  Prompt  stage 1 here
#   base  FC      stage 2 here
#
# SERIAL IS A HARD RULE, not a preference. Two concurrent bfcl processes against one Ollama
# earlier in this project produced 366 timed-out rows and corrupted an hour of measurements.
# Each stage waits for the previous generate to exit.
#
# Each stage preflights search and refuses to start if a generate is already running, so a
# stale process cannot cause a silent double-run.
set -uo pipefail
LOG=/root/bfclproj/queue-runner.log
exec > >(tee -a "$LOG") 2>&1
echo "######## QUEUE RUNNER $(date -Is) ########"

wait_for_clear () {
  local waited=0
  while true; do
    local n
    n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
    [ "${n:-0}" -eq 0 ] && { echo "  lane clear after ${waited}s"; return 0; }
    sleep 120; waited=$((waited+120))
    if [ $waited -ge 43200 ]; then echo "  TIMEOUT waiting 12h for the lane to clear"; return 1; fi
  done
}

echo "=== waiting for the in-flight FC lane (and no_snippet behind it) to finish ==="
wait_for_clear || exit 1

echo
echo "########## STAGE 1: base, Prompt mode ##########"
bash /mnt/c/Users/marka/run-base-control.sh
echo "  stage 1 rc=$?"

wait_for_clear || exit 1

echo
echo "########## STAGE 2: base, FC mode ##########"
bash /mnt/c/Users/marka/run-base-fc.sh
echo "  stage 2 rc=$?"

echo
echo "######## QUEUE COMPLETE $(date -Is) ########"
echo "=== FULL 2x2 ==="
cat /root/bfclproj/score/data_agentic.csv 2>/dev/null
echo
echo "=== search spend across the session ==="
python3 - <<'PY'
import io, json, os
p="/root/bfclproj/search-calls.jsonl"
if os.path.exists(p):
    rs=[json.loads(l) for l in io.open(p,encoding='utf-8') if l.strip()]
    if rs:
        x=rs[-1]
        print("  calls=%d empty=%d (%.1f%%)  approx $%.2f" % (x['calls'],x['empty'],100.0*x['empty']/max(x['calls'],1),x['calls']*5.0/1000))
PY
