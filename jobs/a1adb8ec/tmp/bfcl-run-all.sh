#!/bin/bash
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
mkdir -p $BFCL_PROJECT_ROOT
cd $BFCL_PROJECT_ROOT
rm -rf result score
B=~/bfclenv/bin/bfcl
for CAT in irrelevance simple_python multi_turn_miss_func; do
  echo "=== GENERATE: $CAT ==="
  $B generate --model arch-gov-27b --test-category $CAT --skip-server-setup --num-threads 4 2>&1 | tail -2
  echo "=== EVALUATE: $CAT ==="
  $B evaluate --model arch-gov-27b --test-category $CAT 2>&1 | tail -6
done
echo "ALL-CATEGORIES-COMPLETE"
