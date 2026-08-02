#!/bin/bash
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
B=~/bfclenv/bin/bfcl
# wait for whatever generate is currently alive to finish (do NOT start a duplicate)
while pgrep -f "bfcl generate" >/dev/null 2>&1; do sleep 60; done
echo "=== BASE EVALUATE irrelevance ==="
$B evaluate --model qwen3.6-27b-base --test-category irrelevance 2>&1 | grep -E "Accuracy|Model:" | head -3
echo "=== BASE GENERATE simple_python ==="
$B generate --model qwen3.6-27b-base --test-category simple_python --skip-server-setup --num-threads 4 2>&1 | tail -1
echo "=== BASE EVALUATE simple_python ==="
$B evaluate --model qwen3.6-27b-base --test-category simple_python 2>&1 | grep -E "Accuracy|Model:" | head -3
echo "BASE-SEQUENCE-COMPLETE"
