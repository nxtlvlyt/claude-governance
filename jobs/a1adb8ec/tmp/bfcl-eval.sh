#!/bin/bash
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
~/bfclenv/bin/bfcl evaluate --model arch-gov-27b --test-category simple_python 2>&1 | tail -8
echo "--- non-live scorecard ---"
cat ~/bfclproj/score/data_non_live.csv 2>/dev/null | head -3
