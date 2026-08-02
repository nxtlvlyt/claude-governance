#!/bin/bash
B=~/bfclenv/bin/bfcl
$B --help 2>&1 | head -20
echo "=== does it list models? ==="
$B models 2>&1 | head -5
echo "=== any generic/local/openai-compatible handler? ==="
grep -ril "openai_compatible\|OpenAICompletions\|local_server\|novita\|generic" ~/bfclenv/lib/python3.12/site-packages/bfcl_eval/model_handler/ 2>/dev/null | head -8
echo "=== test categories ==="
ls ~/bfclenv/lib/python3.12/site-packages/bfcl_eval/constants/ 2>/dev/null | head -10
