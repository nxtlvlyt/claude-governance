#!/usr/bin/env bash
# Sonnet-5 FC miss ids + overlap with v3.4's 34 misses.
set -uo pipefail
python3 - <<'EOF'
import json

def fails(path):
    out = []
    with open(path) as f:
        for line in f:
            try: d = json.loads(line)
            except: continue
            if d.get('valid') is False or d.get('accuracy') == 0 or d.get('correct') is False:
                out.append(d.get('id',''))
    return set(out)

v34 = fails('/root/bfclproj/score/arch-gov-27b-v34-FC/agentic/BFCL_v4_web_search_base_score.json')
s5  = fails('/root/bfclproj/score/sonnet-5-aiml-FC/agentic/BFCL_v4_web_search_base_score.json')
print('v34 misses:', len(v34), '| sonnet5 misses:', len(s5))
both = sorted(v34 & s5)
print('BOTH miss (hard tasks):', len(both), both[:20])
only34 = sorted(v34 - s5)
print('v34-only misses (fixable gap):', len(only34), only34[:25])
EOF
exit 0
