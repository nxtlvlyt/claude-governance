#!/usr/bin/env bash
# What does the web_search checker actually compare? Read the installed source.
set -uo pipefail
PKG=$(/root/bfclenv/bin/python3 -c 'import bfcl_eval, os; print(os.path.dirname(bfcl_eval.__file__))')
echo "pkg: $PKG"
echo "--- files mentioning web_search in eval_checker ---"
grep -rl 'web_search' "$PKG/eval_checker" 2>/dev/null
echo "--- scoring function for web_search (context) ---"
grep -rn 'web_search' "$PKG/eval_checker"/*.py 2>/dev/null | head -20
