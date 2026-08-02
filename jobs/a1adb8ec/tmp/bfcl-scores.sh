#!/bin/bash
echo "=== overall ==="
cat ~/bfclproj/score/data_overall.csv 2>/dev/null | head -5
echo "=== non-live ==="
cat ~/bfclproj/score/data_non_live.csv 2>/dev/null | head -5
echo "=== did generation produce real text? sample one result row ==="
F=$(find ~/bfclproj/result -name "*irrelevance*" | head -1)
echo "file: $F"
head -c 700 "$F" 2>/dev/null
echo
echo "=== count of empty vs non-empty results ==="
python3 - <<'PY'
import json,glob,os
for f in glob.glob(os.path.expanduser('~/bfclproj/result/**/*.json'), recursive=True):
    n=e=0
    for line in open(f, encoding='utf-8', errors='replace'):
        line=line.strip()
        if not line: continue
        try: d=json.loads(line)
        except: continue
        n+=1
        r=d.get('result')
        if not r or (isinstance(r,str) and not r.strip()): e+=1
    print(f"  {os.path.basename(f)}: rows={n} empty={e}")
PY
