#!/bin/bash
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
~/bfclenv/bin/bfcl evaluate --model qwen3.6-27b-base --test-category irrelevance 2>&1 | grep -E "Accuracy|Model:" | head -4
