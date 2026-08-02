#!/bin/bash
if pgrep -f "bfcl generate" >/dev/null 2>&1; then
  echo "ABORT: bfcl already running"; pgrep -af "bfcl generate" | head -3; exit 1
fi
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
B=~/bfclenv/bin/bfcl
for CAT in irrelevance simple_python; do
  echo "=== BASE GENERATE: $CAT ==="
  $B generate --model qwen3.6-27b-base --test-category $CAT --skip-server-setup --num-threads 4 2>&1 | tail -2
  echo "=== BASE EVALUATE: $CAT ==="
  $B evaluate --model qwen3.6-27b-base --test-category $CAT 2>&1 | grep -E "Accuracy|Model:" | head -3
done
echo "BASE-COMPLETE"
