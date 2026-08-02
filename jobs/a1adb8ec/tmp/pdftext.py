import re, zlib, sys

raw = open(sys.argv[1], 'rb').read()
chunks = []
for m in re.finditer(rb'stream\r?\n(.*?)endstream', raw, re.S):
    try:
        chunks.append(zlib.decompress(m.group(1)))
    except Exception:
        pass
txt = b'\n'.join(chunks).decode('utf-8', 'replace')

out = []
for m in re.finditer(r'\((?:\\.|[^()\\])*\)', txt):
    s = m.group(0)[1:-1]
    s = s.replace(r'\(', '(').replace(r'\)', ')').replace('\\\\', '\\')
    if s.strip():
        out.append(s)

body = re.sub(r'\s+', ' ', ' '.join(out))
print("extracted chars:", len(body))

KEY = ['multi-turn', 'multiturn', 'tool', 'function call', 'function-calling', 'ShareGPT',
       'conversations', 'LoRA', 'rank', 'alpha', 'catastrophic', 'forgetting', 'eval',
       'dataset', 'format', 'Unsloth', 'GRPO', 'RL', 'reward', 'colab', 'quantiz']
low = body.lower()
for k in KEY:
    n = low.count(k.lower())
    if n:
        print(f"  {k:18} x{n}")
print()
print(body[:1600])
