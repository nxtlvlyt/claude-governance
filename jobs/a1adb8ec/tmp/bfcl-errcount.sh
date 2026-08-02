#!/bin/bash
python3 - <<'PY'
import json,glob,os
for f in sorted(glob.glob(os.path.expanduser('~/bfclproj/result/**/*.json'), recursive=True)):
    n=err=real=0; lat=[]
    for line in open(f,encoding='utf-8',errors='replace'):
        line=line.strip()
        if not line: continue
        try: d=json.loads(line)
        except: continue
        n+=1
        r=str(d.get('result') or '')
        if 'Error during inference' in r or 'timed out' in r.lower(): err+=1
        else:
            real+=1
            if d.get('latency'): lat.append(d['latency'])
    lat.sort()
    med = lat[len(lat)//2] if lat else 0
    print(f"  {os.path.basename(f)[9:-12]:26} rows={n:4} REAL={real:4} TIMEOUT={err:4} ({100*err//max(n,1):3}%)  median_latency={med:.0f}s")
PY
