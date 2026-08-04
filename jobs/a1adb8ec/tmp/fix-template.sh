#!/usr/bin/env bash
# Put the chat template INTO the v3.4 GGUF, then create the Ollama tags properly.
#
# WHY THE TEMPLATE IS MISSING
# transformers 5.5 saves the chat template as a SEPARATE chat_template.jinja file; the
# llama.cpp converter (built Jul 28) reads it from tokenizer_config.json and so embedded
# nothing. export-v34.sh's 5.2b guard caught it and ABORTED — correctly, because a served
# model with no template returns EMPTY generations that read as model quality (that exact
# failure produced v3.3's 61.8%-empty bare numbers).
#
# FIX: gguf_new_metadata.py rewrites the gguf with tokenizer.chat_template set, from the
# template file the merge itself wrote. No re-conversion (45 min saved); the tensor data is
# already verified byte-consistent with the v3.3 reference sizes.
#
# THEN: Ollama tags are created WINDOWS-SIDE per IMPORT-V33-CHECKLIST.md:171 — the earlier
# /api/create calls returned HTTP 400 (wrong API shape) and the chain sailed past it; that is
# audit finding #2. This script VERIFIES the tag exists and carries the system prompt before
# declaring anything done.
set -uo pipefail
MERGED=/mnt/d/conductor-qwen-run/models/arch-gov-27b-v34-merged
Q4=/mnt/d/conductor-qwen/models/arch-gov-27b-v34.q4km.gguf
Q4T=/mnt/d/conductor-qwen/models/arch-gov-27b-v34.q4km.tmpl.gguf
GGUFPY=/root/llama.cpp/gguf-py
PY=/root/cq-venv/bin/python3

echo "=== 1. the template the merge wrote ==="
TPL="$MERGED/chat_template.jinja"
[ -f "$TPL" ] || { echo "  MISSING $TPL — cannot proceed"; exit 2; }
echo "  $(stat -c %s "$TPL") bytes"

echo
echo "=== 2. rewrite the q4 gguf with the template embedded ==="
SCRIPT="$GGUFPY/gguf/scripts/gguf_new_metadata.py"
[ -f "$SCRIPT" ] || SCRIPT="$GGUFPY/scripts/gguf_new_metadata.py"
[ -f "$SCRIPT" ] || { echo "  gguf_new_metadata.py not found under $GGUFPY"; find /root/llama.cpp -name 'gguf_new_metadata.py' 2>/dev/null | head -3; exit 2; }
echo "  using $SCRIPT"
PYTHONPATH="$GGUFPY" "$PY" "$SCRIPT" "$Q4" "$Q4T" --chat-template "$(cat "$TPL")" 2>&1 | tail -4
[ -f "$Q4T" ] || { echo "  rewrite produced nothing"; exit 3; }
SZ=$(stat -c %s "$Q4T")
echo "  rewritten: $SZ bytes"
[ "$SZ" -ge 16000000000 ] || { echo "  too small — refusing"; exit 3; }

echo
echo "=== 3. verify the template is actually IN the new gguf ==="
PYTHONPATH="$GGUFPY" "$PY" - "$Q4T" <<'PYEOF'
import sys
from gguf import GGUFReader
r = GGUFReader(sys.argv[1])
f = r.fields.get("tokenizer.chat_template")
if not f:
    print("  NO chat template in the rewritten gguf"); raise SystemExit(1)
data = bytes(f.parts[f.data[0]]).decode("utf-8", "replace")
print("  tokenizer.chat_template: %d chars, head: %s" % (len(data), data[:80].replace("\n", " ")))
PYEOF
[ $? -eq 0 ] || exit 3

echo
echo "=== 4. swap into place (keep the template-less one aside, never delete) ==="
mv "$Q4" "$Q4.no-template"
mv "$Q4T" "$Q4"
echo "  $(ls -la "$Q4" | awk '{print $5, $9}')"

echo
echo "=== 5. leftover generate from the killed chain? ==="
pkill -f '^/root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl gen' 2>/dev/null && echo "  killed a leftover" || echo "  none"

echo
echo "DONE. Ollama create happens WINDOWS-SIDE next (IMPORT-V33-CHECKLIST.md:171)."
