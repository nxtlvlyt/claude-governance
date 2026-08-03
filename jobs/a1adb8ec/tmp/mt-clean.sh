#!/bin/bash
if pgrep -f "bfcl generate" >/dev/null 2>&1; then echo "ABORT: already running"; exit 1; fi
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
# partial file must go or BFCL length-checks will reject the run; keepalive holds the VM
rm -f result/arch-gov-27b/multi_turn/BFCL_v4_multi_turn_base_result.json
echo "=== GENERATE multi_turn_base, clean start ==="
~/bfclenv/bin/bfcl generate --model arch-gov-27b --test-category multi_turn_base --skip-server-setup --num-threads 4 2>&1 | tail -2
echo "=== EVALUATE ==="
~/bfclenv/bin/bfcl evaluate --model arch-gov-27b --test-category multi_turn_base 2>&1 | grep -E "Accuracy|ValueError" | head -2
echo "MT-BASE-DONE"
