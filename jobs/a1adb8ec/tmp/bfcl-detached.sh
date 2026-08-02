#!/bin/bash
export BFCL_PROJECT_ROOT=~/bfclproj
mkdir -p $BFCL_PROJECT_ROOT
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
rm -f bfcl.log bfcl.done
nohup bash -c '
  for CAT in irrelevance simple_python multi_turn_miss_func; do
    echo "=== CATEGORY: $CAT ==="
    ~/bfclenv/bin/bfcl generate --model arch-gov-27b --test-category $CAT --skip-server-setup --num-threads 1
    ~/bfclenv/bin/bfcl evaluate --model arch-gov-27b --test-category $CAT
  done
  echo DONE > ~/bfclproj/bfcl.done
' >> ~/bfclproj/bfcl.log 2>&1 &
disown
sleep 3
echo "LAUNCHED pid=$(pgrep -f 'bfcl generate' | head -1)"
