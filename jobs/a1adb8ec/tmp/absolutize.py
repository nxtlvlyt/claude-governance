import io, re

P = r'C:\Users\marka\.claude\muezzin-plugin\missions\cq-train-v33-27b.mission.txt'
ROOT = 'C:\\Users\\marka\\conductor-qwen'

s = io.open(P, encoding='utf-8').read()
start = s.index('```pwsh')
end = s.index('```', start + 7)
head, body, tail = s[:start], s[start:end], s[end:]

# lambda repl => no escape processing on the replacement text
body = re.sub(r'(?<![\\/\w:])phase3\\', lambda m: ROOT + '\\phase3\\', body)
body = body.replace("open('phase3/train-v33.jsonl'",
                    "open('C:/Users/marka/conductor-qwen/phase3/train-v33.jsonl'")
body = body.replace('Set-Content V33-TRAIN-27B-RECEIPT.md',
                    'Set-Content ' + ROOT + '\\V33-TRAIN-27B-RECEIPT.md')

s = head + body + tail
io.open(P, 'w', encoding='utf-8').write(s)

blk = s[s.index('```pwsh'): s.index('```', s.index('```pwsh') + 7)]
rel = re.findall(r'(?<![\\/\w:])phase3[\\/]', blk)
print('relative phase3 refs remaining :', len(rel))
print('absolute backslash refs        :', blk.count(ROOT + '\\phase3'))
print('absolute forward-slash refs    :', blk.count('C:/Users/marka/conductor-qwen/phase3'))
print('receipt to abs path            :', ('Set-Content ' + ROOT + '\\V33-TRAIN-27B-RECEIPT.md') in blk)
for line in blk.split('\n'):
    if 'phase3' in line:
        j = line.find('phase3')
        print('   ...%s' % line[max(0, j - 50):j + 25])
