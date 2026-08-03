#!/bin/bash
if pgrep -f "bfcl generate" >/dev/null 2>&1; then echo "ABORT: already running"; exit 1; fi
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
CAT="${1:-multi_turn_base}"
rm -f result/arch-gov-27b/multi_turn/BFCL_v4_${CAT}_result.json 2>/dev/null
nohup ~/bfclenv/bin/bfcl generate --model arch-gov-27b --test-category $CAT \
  --skip-server-setup --num-threads 4 > ~/bfclproj/mt-$CAT.log 2>&1 &
disown
sleep 6
echo "LAUNCHED $CAT pid=$(pgrep -f 'bfcl generate' | head -1)"
