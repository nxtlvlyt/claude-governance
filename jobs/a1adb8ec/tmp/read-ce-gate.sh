#!/usr/bin/env bash
# Read the fused-CE chunk gate: how is target_gb derived, is there an env override?
set -uo pipefail
F=/root/cq-venv/lib/python3.12/site-packages/unsloth_zoo/fused_losses/cross_entropy_loss.py
echo "--- lines 120-175 ---"
sed -n '120,175p' "$F"
echo "--- env vars referenced anywhere in the file ---"
grep -n 'environ\|getenv' "$F" | head -10
echo "--- where target_gb comes from (callers) ---"
grep -rn 'target_gb' "$F" | head -12
exit 0
