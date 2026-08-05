#!/usr/bin/env bash
# Deduped full claude-family catalog + any '5'-generation ids.
set -uo pipefail
set -a; . /root/bfclproj/.env; set +a
curl -s --max-time 20 -H "Authorization: Bearer $AIMLAPI_KEY" https://api.aimlapi.com/v1/models -o /tmp/aiml-models.json
python3 -c "
import json
d = json.load(open('/tmp/aiml-models.json'))
items = d.get('data', d if isinstance(d, list) else [])
ids = sorted({m.get('id','') for m in items if isinstance(m, dict)})
claude = [i for i in ids if 'claude' in i.lower()]
print('ALL claude ids (deduped):')
for i in claude: print(' ', i)
gen5 = [i for i in ids if any(t in i.lower() for t in ('sonnet-5','opus-5','fable','claude-5'))]
print('gen-5 hits:', gen5 or 'NONE')
"
exit 0
