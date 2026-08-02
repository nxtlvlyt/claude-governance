#!/bin/bash
C=~/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py
echo "=== entries using a local/OSS qwen handler ==="
grep -n "QwenHandler" $C | head -6
echo "=== one such entry in full ==="
N=$(grep -n "model_handler=QwenHandler" $C | head -1 | cut -d: -f1)
if [ -n "$N" ]; then sed -n "$((N-8)),$((N+6))p" $C; else echo "none found"; fi
echo "=== how OSSHandler picks its endpoint ==="
grep -n "LOCAL_SERVER_ENDPOINT\|LOCAL_SERVER_PORT\|base_url" ~/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/local_inference/base_oss_handler.py 2>/dev/null | head -6
