// Adversarial re-check of hunt-16 audit: independent replay (NOT the auditor's script).
// Imports heal() from LIVE HEAD conduct-cycle.mjs, fires the gap's kill-shape at a scratch base.
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const PLUGIN = 'C:/Users/marka/.claude/muezzin-plugin';
const { heal } = await import(pathToFileURL(path.join(PLUGIN, 'conduct-cycle.mjs')).href);

const base = 'C:/Users/marka/.claude/jobs/bb6b583a/tmp/h16-refute-base';
rmSync(base, { recursive: true, force: true });
mkdirSync(path.join(base, 'missions', '_logs'), { recursive: true });
const now = Date.now();

// kill-shape: manifest lists 3 children.
// S1 = stranded (mission.txt on disk, ZERO AUTORUN presence — the silent appendQueue-failure shape)
// S2 = already queued
// S3 = named in manifest but file never created
writeFileSync(path.join(base, 'missions', 'repro.S1.mission.txt'), 'MISSION-ID: r1\nMaqsad: stranded\n');
writeFileSync(path.join(base, 'missions', 'repro.S2.mission.txt'), 'MISSION-ID: r2\nMaqsad: queued\n');
writeFileSync(path.join(base, 'missions', 'repro._split-manifest.json'), JSON.stringify({
  parentId: 'repro', ceiling: 8, originalStepCount: 15, groupCount: 3,
  children: [
    { id: 'repro.S1', file: 'missions/repro.S1.mission.txt', steps: 5, requires: null },
    { id: 'repro.S2', file: 'missions/repro.S2.mission.txt', steps: 5, requires: 'repro.S1' },
    { id: 'repro.S3', file: 'missions/repro.S3.mission.txt', steps: 5, requires: 'repro.S2' },
  ],
  ts: new Date(now).toISOString(),
}));
const QUEUED_LINE = 'missions/repro.S2.mission.txt  <!-- queued already -->';
writeFileSync(path.join(base, 'missions', 'AUTORUN.md'), `# q\n${QUEUED_LINE}\n`);

let fails = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

const h1 = heal(base, now, { exec: () => {} });
const recov = h1.performed.filter((p) => p.action === 'stranded-split-recovery');
ck(recov.some((p) => p.stem === 'repro.S1'), 'stranded child (file on disk, zero AUTORUN presence) recovered');
ck(!recov.some((p) => p.stem === 'repro.S2'), 'already-queued child not duplicated');
ck(!recov.some((p) => p.stem === 'repro.S3'), 'never-created child not fabricated');
const after = readFileSync(path.join(base, 'missions', 'AUTORUN.md'), 'utf8');
ck(/^missions\/repro\.S1\.mission\.txt\s+<!-- SPLIT-CHILD -->$/m.test(after), 'recovered line carries the SPLIT-CHILD marker');
ck(after.includes(QUEUED_LINE) && after.split('repro.S2.mission.txt').length === 2, 'queued line byte-unchanged, appears exactly once');
const ev = existsSync(path.join(base, 'missions', '_logs', 'daemon-events.log'))
  ? readFileSync(path.join(base, 'missions', '_logs', 'daemon-events.log'), 'utf8') : '';
ck(/STRANDED-SPLIT-RECOVERY.*repro\.S1/.test(ev), 'daemon-events.log records STRANDED-SPLIT-RECOVERY with the stem');
const h2 = heal(base, now, { exec: () => {} });
ck(!h2.performed.some((p) => p.action === 'stranded-split-recovery'), 'idempotent: second heal() recovers nothing further');

console.log('AUTORUN after heal:\n' + after);
rmSync(base, { recursive: true, force: true });
console.log(fails === 0 ? 'REPLAY: ALL PASS' : `REPLAY: ${fails} FAIL(S)`);
process.exit(fails === 0 ? 0 : 1);
