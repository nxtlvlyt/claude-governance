#!/bin/bash
if pgrep -f "bfcl generate" >/dev/null 2>&1; then echo "ABORT: bfcl already running"; exit 1; fi
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
export SEARXNG_URL=http://100.95.116.67:8080
cd $BFCL_PROJECT_ROOT
B=~/bfclenv/bin/bfcl
M="${1:-arch-gov-27b}"
for CAT in multi_turn_base multi_turn_miss_func multi_turn_miss_param; do
  if pgrep -f "bfcl generate" >/dev/null 2>&1; then echo "SKIP $CAT"; continue; fi
  echo "=== $M / $CAT ==="
  timeout 5400 $B generate --model "$M" --test-category $CAT --skip-server-setup --num-threads 2 >/dev/null 2>&1
  $B evaluate --model "$M" --test-category $CAT 2>&1 | grep -E "Accuracy" | head -2
done
echo "MULTI-TURN-COMPLETE $M"
