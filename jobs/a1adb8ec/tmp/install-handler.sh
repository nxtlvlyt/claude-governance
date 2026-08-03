#!/usr/bin/env bash
# Install the fixed arch_local BFCL handler and score multi_turn_base.
#
# Runs as a SCRIPT rather than an inline ssh string on purpose: quoting through
# PowerShell -> ssh -> cmd.exe -> wsl -> bash eats $, backticks and quotes, which is how
# the previous attempt produced `cp: missing destination file operand`. See
# ~/.claude/projects/.../memory/nxtbeast-wsl-orphaned-vm.md ("cmd boundary trap").
set -euo pipefail

H=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/api_inference/arch_local.py
SRC=/mnt/c/Users/marka/arch_local_new.py

echo "=== install handler ==="
test -f "$SRC" || { echo "FATAL: source $SRC missing"; exit 2; }
cp -p "$H" "$H.bak-20260803"
tr -d '\r' < "$SRC" > "$H"

python3 - "$H" <<'PY'
import ast, sys
src = open(sys.argv[1], encoding="utf-8").read()
ast.parse(src)
assert "setdefault" in src, "placeholder line missing"
assert "11434" in src, "local ollama base_url missing"
print("AST OK, %d lines, placeholder present, local base_url present" % len(src.splitlines()))
PY

echo
echo "=== confirm no real credential is present in the environment ==="
# Guard, not cosmetic: proves the score below came from the local model, not a paid API.
if [ -n "${OPENAI_API_KEY:-}" ]; then
  echo "OPENAI_API_KEY is set in env: ${OPENAI_API_KEY:0:12}..."
else
  echo "OPENAI_API_KEY unset in env (handler will set its placeholder)"
fi

echo
echo "=== row counts before scoring ==="
wc -l /root/bfclproj/result/arch-gov-27b/multi_turn/*.json

echo
echo "=== evaluate multi_turn_base ==="
cd /root/bfclproj
timeout 1800 /root/bfclenv/bin/bfcl evaluate \
  --model arch-gov-27b \
  --test-category multi_turn_base \
  --result-dir /root/bfclproj/result \
  --score-dir /root/bfclproj/score 2>&1 | tail -14

echo
echo "=== SCORE CSV (mtime proves freshness) ==="
date
stat -c '%y %n' /root/bfclproj/score/data_multi_turn.csv
cat /root/bfclproj/score/data_multi_turn.csv
