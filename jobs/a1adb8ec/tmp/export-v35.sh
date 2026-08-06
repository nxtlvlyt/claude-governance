#!/usr/bin/env bash
# export-v35.sh — Stage 7 for v3.5, mirroring the v3.4 artifact lineage on disk
# (f16 gguf -> q4km gguf in /mnt/d/conductor-qwen/models/), with the template
# check TUNE-PIPELINE.md stage 7 mandates (CHAT TEMPLATE PRESENT or exit 3).
set -uo pipefail
MERGED=/mnt/d/conductor-qwen-run/models/arch-gov-27b-v35-merged
OUT=/mnt/d/conductor-qwen/models
F16=$OUT/arch-gov-27b-v35.f16.gguf
Q4=$OUT/arch-gov-27b-v35.q4km.gguf
LOG=/root/bfclproj/export-v35.log
exec > >(tee -a "$LOG") 2>&1
echo "######## EXPORT v3.5 $(date -Is) ########"

echo "=== convert to f16 gguf ==="
/root/cq-venv/bin/python3 /root/llama.cpp/convert_hf_to_gguf.py "$MERGED" \
  --outfile "$F16" --outtype f16 || { echo "### CONVERT FAILED"; exit 1; }
ls -la "$F16"

echo "=== quantize q4_k_m ==="
/root/llama.cpp/build/bin/llama-quantize "$F16" "$Q4" Q4_K_M || { echo "### QUANTIZE FAILED"; exit 2; }
ls -la "$Q4"

echo "=== template check (GGUFReader) ==="
/root/cq-venv/bin/python3 - "$Q4" <<'EOF'
import sys
sys.path.insert(0, "/root/llama.cpp/gguf-py")
from gguf import GGUFReader
r = GGUFReader(sys.argv[1])
f = r.get_field("tokenizer.chat_template")
tpl = ""
if f is not None:
    try:
        tpl = bytes(f.parts[f.data[0]]).decode("utf-8", "replace")
    except Exception:
        pass
print("template chars:", len(tpl))
sys.exit(0 if len(tpl) > 4000 else 3)
EOF
RC=$?
if [ $RC -eq 3 ]; then echo "### TEMPLATE MISSING (exit 3) — fix-template needed"; exit 3; fi
echo "CHAT TEMPLATE PRESENT"
echo "######## EXPORT v3.5 DONE rc=0 $(date -Is) ########"
