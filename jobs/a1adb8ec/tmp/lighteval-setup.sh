#!/usr/bin/env bash
# Lighteval gate prep (CPU-only, safe beside the trainer): venv + extras + task-name verify.
set -uo pipefail
LOG=/root/bfclproj/lighteval-setup.log
exec > >(tee -a "$LOG") 2>&1
echo "######## LIGHTEVAL SETUP $(date -Is) ########"
if [ ! -d /root/lighteval-venv ]; then
  python3 -m venv /root/lighteval-venv
fi
/root/lighteval-venv/bin/pip install --quiet --upgrade pip
/root/lighteval-venv/bin/pip install --quiet "lighteval[litellm,extended_tasks,math]"
echo "=== version ==="
/root/lighteval-venv/bin/lighteval --version 2>/dev/null || /root/lighteval-venv/bin/pip show lighteval | head -2
echo "=== verify task names on-box (never guess) ==="
/root/lighteval-venv/bin/lighteval tasks list 2>/dev/null | grep -iE 'gsm8k|ifeval' | head -12
echo "######## LIGHTEVAL SETUP DONE $(date -Is) ########"
exit 0
