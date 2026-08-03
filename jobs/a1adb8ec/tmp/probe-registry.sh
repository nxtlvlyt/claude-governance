#!/usr/bin/env bash
# Probe: what is the BFCL registry KEY for the untuned control, and does its Ollama tag exist?
# Scripted rather than inlined - the quoting chain (PowerShell -> ssh -> cmd -> wsl -> bash)
# has now eaten $, backticks and quotes three times this session.
set -uo pipefail
MC=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/model_config.py

echo "=== registry entries around the control (lines 1640-1700) ==="
sed -n '1640,1700p' "$MC" | grep -nE '^\s{4}"[^"]+": ModelConfig|model_name=|url=|display_name=' || true

echo
echo "=== all local:// registry keys ==="
grep -nB6 'url="local://' "$MC" | grep -E '^\s*[0-9]+.\s{4}"' || true

echo
echo "=== ollama tags on the server ==="
curl -s http://172.30.144.1:11434/api/tags | tr ',' '\n' | grep '"name"' | cut -d'"' -f4

echo
echo "=== any bfcl generate running right now? ==="
pgrep -a -f "bfcl generate" || echo "none"
