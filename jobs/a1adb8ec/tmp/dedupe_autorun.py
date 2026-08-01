import io

P = r'C:\Users\marka\.claude\muezzin-plugin\missions\AUTORUN.md'
lines = io.open(P, encoding='utf-8', errors='replace').read().split('\n')

keep_idx = None
drop_idx = []
for i, l in enumerate(lines):
    if 'cq-import-score-v33.mission.txt' in l:
        # keep the daemon's line (it carries the run history marks), drop my QUEUED duplicate
        if 'RUNNING-marked' in l or 'FAILED-marked' in l:
            keep_idx = i
        else:
            drop_idx.append(i)

print('keep line  :', (keep_idx + 1) if keep_idx is not None else None)
print('drop lines :', [i + 1 for i in drop_idx])

if keep_idx is None:
    print('NO daemon-marked line found — keeping first, dropping rest')
    idxs = [i for i, l in enumerate(lines) if 'cq-import-score-v33.mission.txt' in l]
    keep_idx, drop_idx = idxs[0], idxs[1:]

out = [l for i, l in enumerate(lines) if i not in set(drop_idx)]
io.open(P, 'w', encoding='utf-8').write('\n'.join(out))

remaining = [l for l in out if 'cq-import-score-v33.mission.txt' in l]
print('remaining lines for this mission:', len(remaining))
for l in remaining:
    status = l.split(' ')[0] if not l.startswith('missions/') else 'BARE(pending)'
    print('  status:', status)
    print('  head  :', l[:150])
