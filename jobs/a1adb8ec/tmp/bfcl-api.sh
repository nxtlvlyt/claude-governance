#!/bin/bash
D=~/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/api_inference
echo "=== novita (OpenAI-compatible) handler head ==="
sed -n '1,30p' $D/novita.py
echo "=== its config entry ==="
grep -n -B2 -A11 "NovitaHandler" ~/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py | head -22
