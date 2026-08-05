#!/usr/bin/env bash
# What does lighteval 0.13.0's CLI actually accept, and what are the gsm8k/ifeval task ids?
set -uo pipefail
LE=/root/lighteval-venv/bin/lighteval
echo "=== top-level help ==="
"$LE" --help 2>&1 | head -25
echo "=== tasks subcommand help ==="
"$LE" tasks --help 2>&1 | head -15
echo "=== task list grep (raw attempt) ==="
"$LE" tasks list 2>&1 | head -5
echo "=== fallback: grep default_tasks in the package ==="
grep -rhoE '"(lighteval|extended|leaderboard|helm)\|[a-z0-9_:]*(gsm8k|ifeval)[a-z0-9_:]*\|?[0-9]*"' \
  /root/lighteval-venv/lib/python3*/site-packages/lighteval/tasks/ 2>/dev/null | sort -u | head -12
grep -rhoE "name=\"[a-z0-9_:-]*(gsm8k|ifeval)[a-z0-9_:-]*\"" \
  /root/lighteval-venv/lib/python3*/site-packages/lighteval/tasks/default_tasks.py \
  /root/lighteval-venv/lib/python3*/site-packages/lighteval/tasks/extended/*/main.py 2>/dev/null | sort -u | head -12
exit 0
