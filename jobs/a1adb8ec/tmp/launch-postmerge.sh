#!/usr/bin/env bash
# Syntax-check the post-merge pipeline and arm it as a Windows scheduled task.
#
# Scheduled task, not setsid and not a held ssh: both of those died today (setsid 6x within
# minutes, held session at 27% of training when the local task was killed). The Task Scheduler
# route survived the 109-minute training run. It must run as `marka` with /it — WSL refuses to
# run as SYSTEM (Wsl/WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED).
set -uo pipefail

echo "=== syntax check every script in the chain ==="
ok=1
for f in post-merge-chain register-and-eval-v34 export-v34 run-base-control run-base-fc; do
  p="/mnt/c/Users/marka/$f.sh"
  if [ ! -f "$p" ]; then echo "  MISSING $f.sh"; ok=0; continue; fi
  sed -i 's/\r$//' "$p"
  if bash -n "$p" 2>/dev/null; then echo "  OK   $f.sh"; else echo "  FAIL $f.sh"; bash -n "$p"; ok=0; fi
done
[ "$ok" -eq 1 ] || { echo "  refusing to arm a chain with a broken script"; exit 2; }

echo
echo "=== is the merge still running? (the chain waits for it either way) ==="
if pgrep -f 'train_student_generic' >/dev/null 2>&1; then
  echo "  yes — trainer still merging; the chain's STAGE 0 will wait"
else
  echo "  no — trainer already exited; the chain will proceed immediately"
fi

echo
echo "=== current merge state ==="
M=/mnt/d/conductor-qwen-run/models/arch-gov-27b-v34-merged
echo "  shards: $(find "$M" -maxdepth 1 -name '*.safetensors' 2>/dev/null | wc -l) / 15"
echo "  bytes : $(du -sb "$M" 2>/dev/null | cut -f1 || echo 0)"
echo "  D: free: $(df -h /mnt/d | tail -1 | awk '{print $4}')"
