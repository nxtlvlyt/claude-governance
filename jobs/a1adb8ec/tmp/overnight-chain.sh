#!/usr/bin/env bash
# The whole night, self-driving. No stage depends on anyone being awake.
#
# WHY THIS REPLACES THE EARLIER QUEUE RUNNER
# The previous chain ran only the two base controls, and I planned to slot training in by hand
# "after the FC lane". That is a plan that requires me to be present — and I had just told the
# operator "nothing needs you tonight" while having no watcher armed at all, which made HIM the
# monitoring. His words: "me? because you don't want to tie the camel".
#
# practice/core.md FM-12: before entering a waiting state, all work that does not require the
# inference to finish must be done FIRST, and the wait must be tied. Putting training inside
# the chain is that work.
#
# ORDER, and why:
#   1. wait for the in-flight FC lane + no_snippet   (already running, do not disturb)
#   2. DRY-RUN the generic trainer                   (never executed before; catches a typo in
#                                                     seconds instead of at minute 38 of 40)
#   3. TRAIN v3.4                                    (~40 min per PIPELINE.md's v1 receipt)
#   4. base control, Prompt mode                     (the control for 51.00%)
#   5. base control, FC mode                         (the control the operator asked for)
#
# Training is stage 3, not last, because it is the actual goal and it is SHORT. Five hours of
# characterising v3.3 ahead of forty minutes that produces v3.4 was the wrong order.
#
# EVERY STAGE IS SKIPPABLE ON FAILURE — a failed train must not block the controls, and a
# failed control must not block the rest. Each writes its own marker.
set -uo pipefail
LOG=/root/bfclproj/overnight.log
exec > >(tee -a "$LOG") 2>&1
echo "######## OVERNIGHT CHAIN $(date -Is) ########"

wait_for_clear () {
  local w=0
  while true; do
    local n; n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
    [ "${n:-0}" -eq 0 ] && { echo "  [lane clear after ${w}s]"; return 0; }
    sleep 120; w=$((w+120))
    [ $w -ge 43200 ] && { echo "  [TIMEOUT 12h waiting for lane]"; return 1; }
  done
}

echo "=== STAGE 1: wait for the in-flight FC lane + no_snippet ==="
wait_for_clear || exit 1

echo
echo "=== STAGE 2: DRY-RUN the generic trainer (never executed before) ==="
cd /mnt/c/Users/marka/conductor-qwen
export HF_HOME=/mnt/d/hf-cache
timeout 3600 python3 nxtbeast/train_student_generic.py \
    --profile model-profiles/arch-gov-27b-v34.json --dry-run
DRY=$?
echo "### DRYRUN rc=$DRY"

if [ $DRY -eq 0 ]; then
  echo
  echo "=== STAGE 3: TRAIN v3.4 ==="
  timeout 21600 python3 nxtbeast/train_student_generic.py \
      --profile model-profiles/arch-gov-27b-v34.json
  echo "### TRAIN rc=$?"
else
  echo "### TRAIN SKIPPED — dry-run failed rc=$DRY. Controls still run below."
fi

wait_for_clear || true

echo
echo "=== STAGE 4: base control, Prompt mode ==="
bash /mnt/c/Users/marka/run-base-control.sh || echo "### base-prompt rc=$?"
wait_for_clear || true

echo
echo "=== STAGE 5: base control, FC mode ==="
bash /mnt/c/Users/marka/run-base-fc.sh || echo "### base-fc rc=$?"

echo
echo "######## OVERNIGHT CHAIN DONE $(date -Is) ########"
echo "=== agentic scores ==="
cat /root/bfclproj/score/data_agentic.csv 2>/dev/null
echo
echo "=== search spend ==="
python3 - <<'PY'
import io, json, os
p="/root/bfclproj/search-calls.jsonl"
if os.path.exists(p):
    rs=[json.loads(l) for l in io.open(p,encoding='utf-8') if l.strip()]
    if rs:
        x=rs[-1]; print("  calls=%d empty=%d  approx $%.2f" % (x['calls'],x['empty'],x['calls']*5.0/1000))
PY
