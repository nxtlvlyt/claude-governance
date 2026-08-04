#!/usr/bin/env bash
# What did the dry-run actually say? rc=2 is the trainer's own refusal path — it stops rather
# than train on something wrong. Which refusal fired?
set -uo pipefail
echo "=== overnight.log, the STAGE 2 section verbatim ==="
tr '\r' '\n' < /root/bfclproj/overnight.log 2>/dev/null \
  | sed -n '/STAGE 2: DRY-RUN/,/DRYRUN rc=/p' | tail -60

echo
echo "=== launch log (stderr lands here if the chain died mid-write) ==="
tail -40 /root/bfclproj/overnight-launch.log 2>/dev/null | grep -v '^[[:space:]]*$'

echo
echo "=== run it again by hand, right now, so the error is unambiguous ==="
cd /mnt/c/Users/marka/cq-v34
export HF_HOME=/root/.cache/huggingface
export CQ_RUN_DIR=/mnt/d/conductor-qwen-run
mkdir -p "$CQ_RUN_DIR/models"
timeout 900 /root/cq-venv/bin/python3 nxtbeast/train_student_generic.py \
  --profile /mnt/c/Users/marka/cq-v34/model-profiles/arch-gov-27b-v34.json \
  --corpus  /mnt/c/Users/marka/cq-v34/phase4/train-v34-train.jsonl \
  --dry-run 2>&1 | tail -40
echo "  rc=$?"
