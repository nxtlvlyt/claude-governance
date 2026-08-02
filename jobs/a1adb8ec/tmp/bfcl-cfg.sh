#!/bin/bash
C=~/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py
echo "=== a qwen3 local entry (the template) ==="
grep -n -A12 '"qwen3-32b-FC"' $C | head -24
echo "=== what class do local models use? ==="
grep -n "class .*Handler" ~/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/local_inference/qwen.py 2>/dev/null | head -4
ls ~/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/ 2>/dev/null
