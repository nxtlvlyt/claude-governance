#!/usr/bin/env bash
# What does gradient_checkpointing.py:808 do, and what does UNSLOTH_GC control?
set -uo pipefail
F=/root/cq-venv/lib/python3.12/site-packages/unsloth_zoo/gradient_checkpointing.py
echo "--- lines 780-825 ---"
sed -n '780,825p' "$F"
echo "--- UNSLOTH_GC env reads across unsloth_zoo ---"
grep -rn "UNSLOTH_GC" /root/cq-venv/lib/python3.12/site-packages/unsloth_zoo/*.py | head -8
exit 0
