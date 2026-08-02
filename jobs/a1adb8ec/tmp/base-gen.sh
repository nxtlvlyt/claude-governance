#!/bin/bash
if pgrep -f "bfcl generate" >/dev/null 2>&1; then echo "ABORT: already running"; exit 1; fi
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
nohup ~/bfclenv/bin/bfcl generate --model qwen3.6-27b-base --test-category irrelevance --skip-server-setup --num-threads 4 > ~/bfclproj/base-gen.log 2>&1 &
disown
sleep 5
echo "LAUNCHED pid=$(pgrep -f 'bfcl generate' | head -1)"
head -c 300 ~/bfclproj/base-gen.log 2>/dev/null | tr -d '\r'
