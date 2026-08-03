#!/bin/bash
if pgrep -f "bfcl generate" >/dev/null 2>&1; then echo "ABORT: bfcl already running"; exit 1; fi
export BFCL_PROJECT_ROOT=~/bfclproj
export OPENAI_API_KEY=ollama
export REMOTE_OPENAI_BASE_URL=http://172.30.144.1:11434/v1
export REMOTE_OPENAI_API_KEY=ollama
cd $BFCL_PROJECT_ROOT
B=~/bfclenv/bin/bfcl
MODEL="$1"
# every category except the two already done for this model, and except web_search/memory
# (those need external services we do not have)
for CAT in multiple parallel parallel_multiple simple_java simple_javascript \
           live_simple live_multiple live_parallel live_parallel_multiple \
           live_irrelevance live_relevance \
           multi_turn_base multi_turn_miss_func multi_turn_miss_param multi_turn_long_context; do
  if pgrep -f "bfcl generate" >/dev/null 2>&1; then echo "SKIP $CAT (another run alive)"; continue; fi
  echo "=== $MODEL / $CAT ==="
  timeout 5400 $B generate --model "$MODEL" --test-category $CAT --skip-server-setup --num-threads 4 >/dev/null 2>&1
  $B evaluate --model "$MODEL" --test-category $CAT 2>&1 | grep -E "Accuracy" | head -2
done
echo "FULL-SUITE-COMPLETE $MODEL"
