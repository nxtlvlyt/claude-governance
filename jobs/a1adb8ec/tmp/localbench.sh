#!/bin/bash
python3 - <<'PY'
import json,urllib.request,time
def t(model,npred=None):
    o={"keep_alive":"4h"}
    body={"model":model,"prompt":"List three colours.","stream":False,"think":False,"keep_alive":"4h"}
    b=json.dumps(body).encode()
    r=urllib.request.Request('http://172.30.144.1:11434/api/generate',data=b,headers={'Content-Type':'application/json'})
    t0=time.time(); d=json.load(urllib.request.urlopen(r,timeout=900)); el=time.time()-t0
    return el, d.get('eval_count',0), d.get('load_duration',0)/1e9, d.get('eval_duration',0)/1e9, d.get('total_duration',0)/1e9
for run in (1,2,3):
    el,ec,ld,ed,td = t("arch-gov-27b-v33-bfcl")
    print(f"  FROM-WSL run{run}: wall={el:5.1f}s  ollama_total={td:5.1f}s  load={ld:4.1f}s eval={ed:4.1f}s tok={ec}")
PY
