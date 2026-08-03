#!/bin/bash
F=~/bfclenv/lib/python3.12/site-packages/bfcl_eval/eval_checker/multi_turn_eval/func_source_code/web_search.py
grep -n "def \|organic_results\|return " $F | head -24
echo "--- result mapping block ---"
sed -n '165,205p' $F
