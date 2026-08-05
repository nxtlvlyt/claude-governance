#!/usr/bin/env bash
# Multi-turn checker: state-based or response-based comparison?
set -uo pipefail
PKG=$(/root/bfclenv/bin/python3 -c 'import bfcl_eval, os; print(os.path.dirname(bfcl_eval.__file__))')
CH="$PKG/eval_checker/multi_turn_eval/multi_turn_checker.py"
echo "--- checker def lines ---"
grep -n 'def \|state_based\|response_based\|compare\|ground_truth' "$CH" | head -25
