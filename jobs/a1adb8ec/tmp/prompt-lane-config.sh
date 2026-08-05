#!/usr/bin/env bash
# Is the base-Prompt lane fairly served? Check think handling for qwen3.6-27b-base in bfcl config.
set -uo pipefail
echo "--- model entries for qwen3.6-27b-base in bfcl config ---"
grep -rn 'qwen3.6-27b-base' /root/bfclproj/*.py /root/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py 2>/dev/null | head -8
echo "--- think flag anywhere in the local handler ---"
grep -rn 'think' /root/bfclproj/*.py 2>/dev/null | head -10
echo "--- recent base-Prompt responses empty? (result file sample) ---"
R=/root/bfclproj/result/qwen3.6-27b-base/agentic/BFCL_v4_web_search_base_result.json
tail -1 "$R" | head -c 600
echo
exit 0
