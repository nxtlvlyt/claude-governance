#!/usr/bin/env bash
set -uo pipefail
echo "=== /root/cq-venv training stack ==="
/root/cq-venv/bin/python3 - <<'PY'
import importlib
for m in ("torch","unsloth","trl","datasets","transformers","peft","bitsandbytes","accelerate"):
    try:
        mod = importlib.import_module(m)
        print("  OK      %-14s %s" % (m, getattr(mod, "__version__", "?")))
    except Exception as e:
        print("  MISSING %-14s %s" % (m, str(e)[:60]))
import torch
print("  cuda:", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")
free, total = torch.cuda.mem_get_info() if torch.cuda.is_available() else (0,0)
print("  vram free %.1f GB of %.1f GB" % (free/1e9, total/1e9))
PY
echo
echo "=== does nxtbeast have a conductor-qwen tree anywhere? ==="
ls -d /mnt/c/Users/marka/conductor-qwen 2>/dev/null || echo "  not at /mnt/c/Users/marka/conductor-qwen"
ls -d /mnt/d/conductor-qwen 2>/dev/null && ls /mnt/d/conductor-qwen | head -10
echo
echo "=== v1 run dir (where train.jsonl was expected) ==="
ls -la /mnt/c/Users/marka/conductor-qwen-run 2>/dev/null | head -8 || echo "  no conductor-qwen-run"
