#!/usr/bin/env bash
# Verify the training environment BEFORE stage 2 needs it.
#
# FM-12 (practice/core.md): "all substrate reads, file authoring, log checks, or other work not
# requiring inference model completion must be done first". The chain is waiting on the FC lane.
# Everything below is knowable now, and each item has burned this project before:
#
#   - unsloth/trl/datasets missing from the python3 the chain calls -> dry-run dies at once
#   - HF_HOME not on D: -> PIPELINE.md:19, v1 pulled ~100GB into the WSL VHD and starved it
#   - disk headroom -> PIPELINE.md:14, a full C: killed a 27B GGUF write mid-run
#   - base model not cached -> a 55GB download starts inside a "40 minute" training window
set -uo pipefail
echo "=== $(date) ==="

echo
echo "=== 1. which python3, and are the training libs importable? ==="
which python3
python3 - <<'PY'
import importlib, sys
print("  python", sys.version.split()[0])
for m in ("torch", "unsloth", "trl", "datasets", "transformers", "peft", "bitsandbytes"):
    try:
        mod = importlib.import_module(m)
        v = getattr(mod, "__version__", "?")
        print("  OK      %-14s %s" % (m, v))
    except Exception as e:
        print("  MISSING %-14s %s: %s" % (m, type(e).__name__, str(e)[:70]))
PY

echo
echo "=== 2. GPU visible to torch? ==="
python3 - <<'PY'
try:
    import torch
    print("  cuda available:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("  device:", torch.cuda.get_device_name(0))
        free, total = torch.cuda.mem_get_info()
        print("  vram free: %.1f GB of %.1f GB" % (free/1e9, total/1e9))
except Exception as e:
    print("  torch check failed:", type(e).__name__, str(e)[:90])
PY

echo
echo "=== 3. HF cache location (PIPELINE.md:19 — must NOT be inside the VHD) ==="
echo "  HF_HOME=${HF_HOME:-<unset — will default into the VHD>}"
for d in /mnt/d/hf-cache /root/.cache/huggingface; do
  if [ -d "$d" ]; then echo "  exists: $d  ($(du -sh "$d" 2>/dev/null | cut -f1))"; else echo "  absent: $d"; fi
done

echo
echo "=== 4. is the base model already cached, or does training start with a download? ==="
find /mnt/d/hf-cache /root/.cache/huggingface -maxdepth 3 -iname '*Qwen3.6*' 2>/dev/null | head -5 || true
echo "  (empty above = the first training run downloads the base model first)"

echo
echo "=== 5. disk headroom (PIPELINE.md:14 — a full volume killed a GGUF write) ==="
df -h /mnt/d /mnt/c / 2>/dev/null | awk 'NR==1 || /mnt|^\//'

echo
echo "=== 6. corpus the chain will actually train on ==="
F=/mnt/c/Users/marka/conductor-qwen/phase4/train-v34-train.jsonl
echo "  rows: $(wc -l < "$F")"
python3 - "$F" <<'PY'
import io, json, sys
rows = [json.loads(l) for l in io.open(sys.argv[1], encoding="utf-8") if l.strip()]
sysset = {m["content"] for r in rows for m in r["messages"] if m["role"] == "system"}
print("  distinct system prompts: %d  (the builder asserts exactly 1)" % len(sysset))
print("  message-shape counts:")
from collections import Counter
for s, c in Counter(tuple(m["role"] for m in r["messages"]) for r in rows).most_common():
    print("    %-46s %5d" % (" -> ".join(s), c))
PY
