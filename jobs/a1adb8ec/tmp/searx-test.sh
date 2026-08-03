#!/bin/bash
U="http://100.95.116.67:8080"
echo "=== WSL -> laptop SearXNG over tailscale ==="
curl -s -o /dev/null -w "  %{http_code} in %{time_total}s\n" --max-time 20 "$U/search?q=test&format=json"
echo "=== real query, result shape ==="
curl -s --max-time 25 "$U/search?q=berkeley+function+calling+leaderboard&format=json" \
 | ~/bfclenv/bin/python -c "
import json,sys
d=json.load(sys.stdin); r=d.get('results',[])
print('  results:',len(r))
for x in r[:3]:
    print('   -',(x.get('title') or '')[:60],'|',(x.get('url') or '')[:40])
"
