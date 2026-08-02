#!/bin/bash
python3 - <<'PY'
import json,glob,os
fs=sorted(glob.glob(os.path.expanduser('~/bfclproj/result/**/*.json'), recursive=True))
if not fs: print("  no result files yet")
for f in fs:
    n=err=0; lat=[]
    for line in open(f,encoding='utf-8',errors='replace'):
        line=line.strip()
        if not line: continue
        try: d=json.loads(line)
        except: continue
        n+=1
        r=str(d.get('result') or '')
        if 'Error during inference' in r or 'timed out' in r.lower(): err+=1
        elif d.get('latency'): lat.append(d['latency'])
    lat.sort(); med=lat[len(lat)//2] if lat else 0
    print(f"  {os.path.basename(f)[9:-12]:24} rows={n:4} REAL={n-err:4} TIMEOUT={err:4} med_lat={med:.1f}s")
PY
