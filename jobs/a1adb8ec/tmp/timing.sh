#!/bin/bash
python3 - <<'PY'
import json,urllib.request,time
b=json.dumps({"model":"arch-gov-27b-v33-bfcl","prompt":"List three colours.","stream":False,
              "think":False,"keep_alive":"4h"}).encode()
r=urllib.request.Request('http://172.30.144.1:11434/api/generate',data=b,headers={'Content-Type':'application/json'})
t0=time.time(); d=json.load(urllib.request.urlopen(r,timeout=900)); el=time.time()-t0
ns=1e9
print(f"  wall                 {el:8.2f}s")
for k in ("total_duration","load_duration","prompt_eval_duration","eval_duration"):
    print(f"  {k:20} {d.get(k,0)/ns:8.2f}s")
print(f"  prompt_eval_count    {d.get('prompt_eval_count')}")
print(f"  eval_count           {d.get('eval_count')}")
acc=(d.get('load_duration',0)+d.get('prompt_eval_duration',0)+d.get('eval_duration',0))/ns
print(f"  ACCOUNTED            {acc:8.2f}s   UNACCOUNTED {d.get('total_duration',0)/ns-acc:8.2f}s")
PY
