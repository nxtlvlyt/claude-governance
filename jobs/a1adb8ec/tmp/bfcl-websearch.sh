#!/bin/bash
if pgrep -f "bfcl generate" >/dev/null 2>&1; then echo "ABORT: bfcl already running"; exit 1; fi
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
export SEARXNG_URL=http://100.95.116.67:8080
cd $BFCL_PROJECT_ROOT
B=~/bfclenv/bin/bfcl
echo "=== web_search : tuned model + SearXNG ==="
timeout 5400 $B generate --model arch-gov-27b --test-category web_search --skip-server-setup --num-threads 2 2>&1 | tail -2
$B evaluate --model arch-gov-27b --test-category web_search 2>&1 | grep -E "Accuracy|Model:" | head -3
echo "WEB-SEARCH-COMPLETE"
