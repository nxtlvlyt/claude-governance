#!/usr/bin/env bash
# The whole night, self-driving. No stage depends on anyone being awake.
#
# CORRECTED 2026-08-04 02:0x, before stage 2 ever ran, by checking the environment during the
# wait instead of after it (practice/core.md FM-12: do the work that does not require the
# inference FIRST). Two fatal defects were found and fixed:
#
#   1. The chain called bare `python3` = /usr/bin/python3, which has NO torch, unsloth, trl,
#      datasets, transformers, peft or bitsandbytes. Training would have died in seconds at
#      ~03:00 and the night would have produced only controls. The real environment is
#      /root/cq-venv (torch 2.11.0+cu130, unsloth 2026.7.5, CUDA True, 20.8GB free of 25.8).
#   2. The corpus did not exist on nxtbeast at all. train-v34-train.jsonl was built on the
#      laptop; nxtbeast has no conductor-qwen tree. Files are now mirrored to
#      /mnt/c/Users/marka/cq-v34/ and the corpus is passed by ABSOLUTE path, because the
#      trainer resolves a relative corpus_path against its own directory.
#
# ORDER, and why:
#   1. wait for the in-flight FC lane + no_snippet   (already running, do not disturb)
#   2. DRY-RUN the generic trainer                   (never executed before; catches a typo in
#                                                     seconds instead of at minute 38 of 40)
#   3. TRAIN v3.4                                    (~40 min per PIPELINE.md's v1 receipt)
#   4. base control, Prompt mode                     (the control for 51.00%)
#   5. base control, FC mode                         (the control the operator asked for)
#
# EVERY STAGE IS SKIPPABLE ON FAILURE — a failed train must not block the controls.
set -uo pipefail
LOG=/root/bfclproj/overnight.log
PY=/root/cq-venv/bin/python3
CQ=/mnt/c/Users/marka/cq-v34
CORPUS=$CQ/phase4/train-v34-train.jsonl
PROFILE=$CQ/model-profiles/arch-gov-27b-v34.json

exec > >(tee -a "$LOG") 2>&1
echo "######## OVERNIGHT CHAIN (v2, corrected) $(date -Is) ########"
echo "  python : $PY"
echo "  corpus : $CORPUS ($(wc -l < "$CORPUS" 2>/dev/null || echo MISSING) rows)"
echo "  profile: $PROFILE"

wait_for_clear () {
  local w=0
  while true; do
    local n; n=$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)
    [ "${n:-0}" -eq 0 ] && { echo "  [lane clear after ${w}s]"; return 0; }
    sleep 120; w=$((w+120))
    [ $w -ge 43200 ] && { echo "  [TIMEOUT 12h waiting for lane]"; return 1; }
  done
}

echo
echo "=== STAGE 1: wait for the in-flight FC lane + no_snippet ==="
wait_for_clear || exit 1

echo
echo "=== STAGE 2: DRY-RUN the generic trainer (never executed before) ==="
cd "$CQ"
export HF_HOME=/root/.cache/huggingface   # where unsloth/Qwen3.6-27B is already cached
timeout 3600 "$PY" nxtbeast/train_student_generic.py \
    --profile "$PROFILE" --corpus "$CORPUS" --dry-run
DRY=$?
echo "### DRYRUN rc=$DRY"

if [ $DRY -eq 0 ]; then
  echo
  echo "=== STAGE 3: TRAIN v3.4 ==="
  timeout 21600 "$PY" nxtbeast/train_student_generic.py \
      --profile "$PROFILE" --corpus "$CORPUS"
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
cat /root/bfclproj/score/data_agentic.csv 2>/dev/null
