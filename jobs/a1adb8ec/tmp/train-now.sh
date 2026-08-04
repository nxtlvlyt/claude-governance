#!/usr/bin/env bash
# Train v3.4. Everything it depends on is verified, not assumed.
#
# VERIFIED BEFORE THIS RUNS (each was a real defect found and fixed during the wait):
#   python      /root/cq-venv/bin/python3 — torch 2.11, unsloth 2026.7.5 (bare python3 has none)
#   corpus      1741 rows, shipped to nxtbeast (it existed only on the laptop)
#   tool args   render as <parameter=mission>x</parameter> (were being silently DROPPED)
#   artifacts   CQ_RUN_DIR=/mnt/d (C: had 64GB free; a merged 27B is ~55GB)
#   VRAM        Ollama unloaded first (it held 17.6GB of a 24GB card)
#   dry-run     rc=0 — model loads, target modules present, 1741 rows, template renders
#   VM          vmIdleTimeout=-1 (an idle shutdown killed the whole chain at 09:4x)
#
# Waits for a clear lane and releases VRAM again, because both can change between the check
# and the run — the earlier chain proved that a correct wait is not the same as a free GPU.
set -uo pipefail
PY=/root/cq-venv/bin/python3
CQ=/mnt/c/Users/marka/cq-v34
LOG=/root/bfclproj/train-v34.log

exec > >(tee -a "$LOG") 2>&1
echo "######## TRAIN v3.4 $(date -Is) ########"

echo "=== wait for any bfcl lane to clear ==="
w=0
while [ "$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)" -gt 0 ]; do
  sleep 60; w=$((w+60)); [ $w -ge 21600 ] && { echo "  timeout"; exit 1; }
done
echo "  clear after ${w}s"

echo
echo "=== release VRAM (Ollama holds weights long after a lane exits) ==="
for m in $(curl -s http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json;[print(x["name"]) for x in (json.load(sys.stdin).get("models") or [])]' 2>/dev/null); do
  echo "  unloading $m"
  curl -s http://172.30.144.1:11434/api/generate -d "{\"model\":\"$m\",\"keep_alive\":0}" -o /dev/null
done
sleep 10
echo "  gpu: $(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader 2>/dev/null | head -1)"

echo
echo "=== TRAIN ==="
cd "$CQ"
export HF_HOME=/root/.cache/huggingface
export CQ_RUN_DIR=/mnt/d/conductor-qwen-run
mkdir -p "$CQ_RUN_DIR/models"
timeout 21600 "$PY" nxtbeast/train_student_generic.py \
    --profile "$CQ/model-profiles/arch-gov-27b-v34.json" \
    --corpus  "$CQ/phase4/train-v34-train.jsonl"
RC=$?
echo "### TRAIN rc=$RC $(date -Is)"

echo
echo "=== artifact ==="
ls -la "$CQ_RUN_DIR/models/arch-gov-27b-v34-merged" 2>/dev/null | head -8 || echo "  no merged dir"
du -sh "$CQ_RUN_DIR/models/arch-gov-27b-v34-merged" 2>/dev/null || true

if [ $RC -eq 0 ]; then
  echo
  echo "=== chain the base controls behind it ==="
  bash /mnt/c/Users/marka/run-base-control.sh || echo "### base-prompt rc=$?"
  while [ "$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)" -gt 0 ]; do sleep 60; done
  bash /mnt/c/Users/marka/run-base-fc.sh || echo "### base-fc rc=$?"
fi

echo
echo "######## TRAIN CHAIN DONE $(date -Is) ########"
