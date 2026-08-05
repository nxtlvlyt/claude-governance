#!/usr/bin/env bash
# Show the dump's actual JSON shape + first entries, then search raw text for gsm8k/ifeval.
set -uo pipefail
python3 - <<'EOF'
import json
d = json.load(open('/root/lighteval-tasks.json'))
print('top-level type:', type(d).__name__)
if isinstance(d, dict):
    ks = list(d.keys())[:8]
    print('first keys:', ks)
    k0 = ks[0]
    v = d[k0]
    print('value type:', type(v).__name__)
    print('sample value (truncated):', str(v)[:300])
elif isinstance(d, list):
    print('first item:', str(d[0])[:300])
EOF
echo "=== raw text search ==="
grep -oiE '[a-z0-9_|:-]*gsm8k[a-z0-9_|:-]*|[a-z0-9_|:-]*ifeval[a-z0-9_|:-]*' /root/lighteval-tasks.json | sort -u | head
exit 0
