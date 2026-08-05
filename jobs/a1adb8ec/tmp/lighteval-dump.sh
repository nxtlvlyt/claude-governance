#!/usr/bin/env bash
# Dump task registry as JSON, filter for gsm8k/ifeval ids.
set -uo pipefail
LE=/root/lighteval-venv/bin/lighteval
"$LE" tasks dump > /root/lighteval-tasks.json 2>/dev/null || true
python3 - <<'EOF'
import json
try:
    d = json.load(open('/root/lighteval-tasks.json'))
except Exception as e:
    print('dump unparsable:', e); raise SystemExit
items = d if isinstance(d, list) else list(d.keys()) if isinstance(d, dict) else []
names = []
for it in items:
    n = it if isinstance(it, str) else (it.get('name') or it.get('task') or '')
    names.append(n)
hits = sorted({n for n in names if 'gsm8k' in n.lower() or 'ifeval' in n.lower()})
print('total tasks:', len(names))
print('gsm8k/ifeval ids:')
for h in hits[:15]: print(' ', h)
EOF
exit 0
