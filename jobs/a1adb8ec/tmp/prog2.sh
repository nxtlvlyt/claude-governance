#!/bin/bash
python3 - <<'PY'
import json, glob, os
for f in sorted(glob.glob(os.path.expanduser('~/bfclproj/result/**/*.json'), recursive=True)):
    parts = f.split(os.sep)
    model = parts[-3] if len(parts) >= 3 else '?'
    n = err = 0
    for line in open(f, encoding='utf-8', errors='replace'):
        line = line.strip()
        if not line: continue
        try: d = json.loads(line)
        except Exception: continue
        n += 1
        r = str(d.get('result') or '')
        if 'Error during inference' in r or 'timed out' in r.lower(): err += 1
    cat = os.path.basename(f).replace('BFCL_v4_','').replace('_result.json','')
    print(f"  {model:22} {cat:22} rows={n:4} real={n-err:4} to={err:3}")
PY
echo "--- running ---"
pgrep -af "bfcl generate" | head -2
