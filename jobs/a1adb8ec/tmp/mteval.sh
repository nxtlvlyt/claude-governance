#!/bin/bash
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
cd ~/bfclproj
for C in multi_turn_base multi_turn_miss_func multi_turn_miss_param; do
  echo "-- $C"
  ~/bfclenv/bin/bfcl evaluate --model arch-gov-27b --test-category $C 2>&1 | grep -E "Accuracy|Error|error" | head -2
done
