#!/bin/bash
B=~/bfclenv/bin/bfcl
echo "=== test categories ==="
$B test-categories 2>&1 | head -22
echo "=== any locally-hosted / oss model entries (the pattern to copy) ==="
$B models 2>&1 | grep -Ei "local|oss|hosted|qwen" | head -12
