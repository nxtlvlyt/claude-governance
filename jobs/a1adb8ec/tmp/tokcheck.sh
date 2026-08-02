#!/bin/bash
python3 - <<'PY'
import json,glob,os
f=sorted(glob.glob(os.path.expanduser('~/bfclproj/result/**/*irrelevance*.json'),recursive=True))
if not f: print("  no rows yet"); raise SystemExit
rows=[]
for line in open(f[0],encoding='utf-8',errors='replace'):
    line=line.strip()
    if line:
        try: rows.append(json.loads(line))
        except: pass
print(f"  rows={len(rows)}")
for r in rows[:4]:
    print(f"   in={r.get('input_token_count')} out={r.get('output_token_count')} lat={r.get('latency',0):.0f}s")
outs=[r.get('output_token_count') or 0 for r in rows]
lats=[r.get('latency') or 0 for r in rows]
if outs:
    print(f"  mean_out_tokens={sum(outs)/len(outs):.0f}  max={max(outs)}")
    print(f"  mean_latency={sum(lats)/len(lats):.0f}s")
    print(f"  implied tok/s = {sum(outs)/max(sum(lats),1):.1f}")
PY
