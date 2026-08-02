#!/bin/bash
if pgrep -f "bfcl generate" >/dev/null 2>&1; then
  echo "ABORT: bfcl already running — refusing to duplicate"; pgrep -af "bfcl generate" | head -3; exit 1
fi
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
B=~/bfclenv/bin/bfcl
echo "=== GENERATE simple_python (400 cases) ==="
$B generate --model arch-gov-27b --test-category simple_python --skip-server-setup --num-threads 4 2>&1 | tail -2
echo "=== EVALUATE simple_python ==="
$B evaluate --model arch-gov-27b --test-category simple_python 2>&1 | tail -8
echo "SIMPLE-PYTHON-COMPLETE"
