#!/bin/bash
# ONE category, ONE process. Refuses to start if any bfcl is already running.
if pgrep -f "bfcl generate" >/dev/null 2>&1; then
  echo "ABORT: a bfcl generate is already running — refusing to create a duplicate"
  pgrep -af "bfcl generate" | head -3
  exit 1
fi
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
rm -rf result score
B=~/bfclenv/bin/bfcl
echo "=== GENERATE irrelevance (240 cases) ==="
$B generate --model arch-gov-27b --test-category irrelevance --skip-server-setup --num-threads 4 2>&1 | tail -3
echo "=== EVALUATE irrelevance ==="
$B evaluate --model arch-gov-27b --test-category irrelevance 2>&1 | tail -8
echo "SINGLE-CATEGORY-COMPLETE"
