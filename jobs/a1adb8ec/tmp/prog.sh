#!/bin/bash
python3 - <<'PY'
import json, glob, os
for f in sorted(glob.glob(os.path.expanduser('~/bfclproj/result/**/*.json'), recursive=True)):
    n = 0
    err = 0
    lats = []
    outs = []
    for line in open(f, encoding='utf-8', errors='replace'):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except Exception:
            continue
        n += 1
        r = str(d.get('result') or '')
        if 'Error during inference' in r or 'timed out' in r.lower():
            err += 1
        else:
            if isinstance(d.get('latency'), (int, float)):
                lats.append(float(d['latency']))
            if isinstance(d.get('output_token_count'), int):
                outs.append(d['output_token_count'])
    lats.sort()
    med = lats[len(lats) // 2] if lats else 0.0
    mo = (sum(outs) / len(outs)) if outs else 0.0
    name = os.path.basename(f).replace('BFCL_v4_', '').replace('_result.json', '')
    print(f"  {name:24} rows={n:4} REAL={n-err:4} TIMEOUT={err:3} med_lat={med:6.1f}s mean_out={mo:6.0f}tok")
PY
