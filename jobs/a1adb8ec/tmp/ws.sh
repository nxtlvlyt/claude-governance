#!/bin/bash
F=~/bfclenv/lib/python3.12/site-packages/bfcl_eval/eval_checker/multi_turn_eval/func_source_code/web_search.py
wc -l $F
sed -n '1,20p' $F
echo "..."
sed -n '125,165p' $F
