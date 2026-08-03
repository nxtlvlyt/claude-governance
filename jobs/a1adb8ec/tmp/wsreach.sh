#!/bin/bash
U="http://100.95.116.67:8080"
python3 - <<'PY'
import json,urllib.request,urllib.parse
u="http://100.95.116.67:8080/search?"+urllib.parse.urlencode({"q":"berkeley function calling leaderboard","format":"json"})
try:
    d=json.load(urllib.request.urlopen(u,timeout=35))
    r=d.get('results',[])
    print(f"  WSL->SearXNG OK: {len(r)} results")
    for x in r[:2]: print("   ",(x.get('title') or '')[:60])
except Exception as e:
    print("  FAILED:",type(e).__name__,str(e)[:80])
PY
