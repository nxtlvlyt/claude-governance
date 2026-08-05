#!/usr/bin/env bash
# Train v3.5 — waits for the GPU lane, releases VRAM, dry-runs, trains. Same guards as v3.4's
# run (each one paid for): lane wait, Ollama unload before load, dry-run before train,
# artifacts to D:. One variable vs v3.4: sentence-boundary clipping in the corpus.
set -uo pipefail
PY=/root/cq-venv/bin/python3
CQ=/mnt/c/Users/marka/cq-v34
LOG=/root/bfclproj/train-v35.log
exec > >(tee -a "$LOG") 2>&1
echo "######## TRAIN v3.5 $(date -Is) ########"

echo "=== wait for the bfcl lane (base-FC control, ~3.5h) ==="
w=0
while [ "$(ps -eo args | grep -c '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' || true)" -gt 0 ]; do
  sleep 300; w=$((w+300)); [ $w -ge 43200 ] && { echo "timeout"; exit 1; }
done
echo "  clear after ${w}s"

echo "=== release VRAM ==="
for m in $(curl -s http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json;[print(x["name"]) for x in (json.load(sys.stdin).get("models") or [])]' 2>/dev/null); do
  curl -s http://172.30.144.1:11434/api/generate -d "{\"model\":\"$m\",\"keep_alive\":0}" -o /dev/null
done
sleep 10
# HUNG-RUNNER SWEEP (2026-08-05): /api/ps empty + llama-server.exe alive = orphaned runner
# holding VRAM (the operator's hypothesis for the 23:24/23:59 OOMs — this receipts + clears it).
RESIDENT=$(curl -s http://172.30.144.1:11434/api/ps | python3 -c 'import sys,json;print(len(json.load(sys.stdin).get("models") or []))' 2>/dev/null || echo unknown)
if [ "$RESIDENT" = "0" ]; then
  if /mnt/c/Windows/System32/tasklist.exe /FI "IMAGENAME eq llama-server.exe" 2>/dev/null | grep -q llama-server; then
    echo "  HUNG RUNNER DETECTED (api/ps empty, llama-server alive) — sweeping"
    /mnt/c/Windows/System32/taskkill.exe /IM llama-server.exe /F 2>/dev/null || true
    sleep 5
  fi
fi
echo "  gpu: $(nvidia-smi --query-gpu=memory.used --format=csv,noheader | head -1)"

cd "$CQ"
export HF_HOME=/root/.cache/huggingface
export CQ_RUN_DIR=/mnt/d/conductor-qwen-run
# CE-GATE FIX (2026-08-05, OOM #4): unsloth's fused-CE sizes chunks from INSTANTANEOUS free
# VRAM at step 0; with ~4GB desktop squat it reads ~0 and raises. Fixed budget = documented
# override (cross_entropy_loss.py:33). Chunked CE is numerically identical loss math —
# training config untouched, attribution intact.
export UNSLOTH_CE_LOSS_TARGET_GB=2
# STALL FIX (2026-08-05 13:0x): step-295 hang — py-spy showed backward waiting on a torch
# Inductor COMPILE SUBPROCESS (chunked-CE recompiles per shape; worker hung; GPU 0%, CPU 100%,
# log frozen 1h). Off-switch ships in the same source (cross_entropy_loss.py:51). Eager chunked
# CE = identical math, no compiler.
export UNSLOTH_FUSED_CE_COMPILE_DISABLE=1
# RUNTIME-OOM FIX (2026-08-05, rc=134 at ~step 280): CUDA OOM in backward — v3.5's
# sentence-clipped corpus has longer max-length rows than v3.4's, spiking backward memory.
# Env-only levers, training math untouched: expandable segments kill fragmentation OOMs;
# CE budget 2->1 shrinks the loss transient.
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export UNSLOTH_CE_LOSS_TARGET_GB=1
# STALL FIX #2 (2026-08-05 ~17:00, second identical hang at step 170 DESPITE fused-CE compile
# disable — py-spy again showed backward waiting on an Inductor compile SUBPROCESS; unsloth
# compiles more regions than fused-CE). Receipted switches from installed source:
# unsloth_zoo/compiler.py:183 = global compile off; torch _inductor/config.py:1086 = "disable
# async compiling" via threads=1 (no subprocess pool at all). Env-only, math identical.
export UNSLOTH_COMPILE_DISABLE=1
export TORCHINDUCTOR_COMPILE_THREADS=1
mkdir -p "$CQ_RUN_DIR/models"

echo "=== dry-run ==="
timeout 3600 "$PY" nxtbeast/train_student_generic.py \
  --profile "$CQ/model-profiles/arch-gov-27b-v35.json" \
  --corpus  "$CQ/phase4/train-v35-train.jsonl" --dry-run
DRY=$?
echo "### DRYRUN rc=$DRY"
[ $DRY -ne 0 ] && { echo "### TRAIN SKIPPED"; exit 2; }

echo "=== train ==="
timeout 21600 "$PY" nxtbeast/train_student_generic.py \
  --profile "$CQ/model-profiles/arch-gov-27b-v35.json" \
  --corpus  "$CQ/phase4/train-v35-train.jsonl"
echo "### TRAIN rc=$? $(date -Is)"
ls -la "$CQ_RUN_DIR/models/arch-gov-27b-v35-merged" 2>/dev/null | head -4
echo "######## TRAIN v3.5 DONE $(date -Is) ########"
