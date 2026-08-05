#!/usr/bin/env bash
# Which entries did v3.4-FC miss, and how? IDs from the score file, 3 sampled transcripts.
set -uo pipefail
S=/root/bfclproj/score/arch-gov-27b-v34-FC/agentic/BFCL_v4_web_search_base_score.json
R=/root/bfclproj/result/arch-gov-27b-v34-FC/agentic/BFCL_v4_web_search_base_result.json
python3 - <<'EOF'
import json
fails = []
with open('/root/bfclproj/score/arch-gov-27b-v34-FC/agentic/BFCL_v4_web_search_base_score.json') as f:
    for line in f:
        try: d = json.loads(line)
        except: continue
        if d.get('valid') is False or d.get('accuracy') == 0 or d.get('correct') is False:
            fails.append(d.get('id',''))
print('failed ids (%d):' % len(fails), fails[:40])
# categorize the failure notes if present
with open('/root/bfclproj/score/arch-gov-27b-v34-FC/agentic/BFCL_v4_web_search_base_score.json') as f:
    kinds = {}
    for line in f:
        try: d = json.loads(line)
        except: continue
        if d.get('id','') in fails:
            err = str(d.get('error_type') or d.get('error') or '')[:60]
            kinds[err] = kinds.get(err, 0) + 1
for k, v in sorted(kinds.items(), key=lambda x: -x[1])[:8]:
    print(f'{v:3d}  {k}')
EOF
exit 0
