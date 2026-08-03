#!/bin/bash
~/bfclenv/bin/python /mnt/c/Users/marka/searxng_patch.py
echo "--- syntax check ---"
~/bfclenv/bin/python -c "
import ast,io
p='/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/eval_checker/multi_turn_eval/func_source_code/web_search.py'
ast.parse(io.open(p,encoding='utf-8').read()); print('  AST OK')"
echo "--- can WSL reach SearXNG on the laptop? ---"
curl -s -o /dev/null -w "  localhost:8080 -> %{http_code}\n" --max-time 8 http://localhost:8080/search?q=test
GW=$(ip route show default | awk '{print $3}' | head -1)
curl -s -o /dev/null -w "  gw($GW):8080 -> %{http_code}\n" --max-time 8 "http://$GW:8080/search?q=test"
