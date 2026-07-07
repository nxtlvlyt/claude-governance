// Adversarial re-verification of hunt-8 e2e audit — independent replay, shipped defaults.
// Imports the exported retroRepeatBlocked (entry guard confirmed: mainLoop only runs when
// daemon file is argv[1]; selftest only under --selftest). Read-only: all fs injected.
import { retroRepeatBlocked } from 'file:///C:/Users/marka/.claude/muezzin-plugin/muezzin-daemon.mjs';

const NOW = Date.parse('2026-07-07T12:00:00Z');
const t = (iso) => iso.replace(/:/g, '-').replace('.', '-'); // 2026-07-07T01:00:00.000Z -> file ts
const retroName = (iso) => `st-${t(iso)}.md`;
let fails = 0;
const ck = (cond, label, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  ' + JSON.stringify(extra) : ''));
  if (!cond) fails++;
};

// SHAPE1: ONE failed retro (class verify), no preflight receipt. Pre-fix (preflightAfter=5): no gate.
{
  const r = retroRepeatBlocked('st', '/r', Date.parse('2026-07-01T00:00:00Z'), {
    now: NOW,
    readdir: () => [retroName('2026-07-07T01:00:00.000Z')],
    readHead: () => '# RETRO st — FAILED(verify)',
  });
  ck(r.blocked === true, 'SHAPE1 one FAILED, no receipt -> blocked', r);
  ck(r.needsPreflight === true, 'SHAPE1 names needsPreflight', r);
  ck(r.killingClass === 'verify', 'SHAPE1 killingClass=verify', r);
}

// SHAPE2: FOUR fails in-window + AMENDED mission mtime, no receipt. Pre-fix: amended mtime alone passed.
{
  const names = ['2026-07-07T01:00:00.000Z','2026-07-07T02:00:00.000Z','2026-07-07T03:00:00.000Z','2026-07-07T04:00:00.000Z'].map(retroName);
  const r = retroRepeatBlocked('st', '/r', Date.parse('2026-07-07T05:00:00Z'), {
    now: NOW, readdir: () => names, readHead: () => '# RETRO st — FAILED(verify)',
  });
  ck(r.blocked === true, 'SHAPE2 4 fails + amended mtime, no receipt -> blocked', r);
}

// SHAPE3: FIVE fails ALL older than 24h. Pre-fix: windowed count 0 -> invisible.
{
  const names = ['2026-07-01T00:00:00.000Z','2026-07-01T01:00:00.000Z','2026-07-01T02:00:00.000Z','2026-07-01T03:00:00.000Z','2026-07-01T04:00:00.000Z'].map(retroName);
  const r = retroRepeatBlocked('st', '/r', Date.parse('2026-06-30T00:00:00Z'), {
    now: NOW, readdir: () => names, readHead: () => '# RETRO st — FAILED(verify)',
  });
  ck(r.blocked === true, 'SHAPE3 five fails outside 24h -> blocked', r);
  ck(r.totalFails === 5 && r.count === 0, 'SHAPE3 totalFails=5, windowed count=0', r);
}

// SHAPE4: HOLLOW-touch receipt — fresh mtime, EMPTY content.
{
  const r = retroRepeatBlocked('st', '/r', Date.parse('2026-07-01T00:00:00Z'), {
    now: NOW,
    readdir: () => [retroName('2026-07-07T01:00:00.000Z')],
    readHead: () => '# RETRO st — FAILED(verify)',
    preflightMtimeMs: Date.parse('2026-07-07T02:00:00Z'), // fresher than newest retro
    readPreflight: () => '',
  });
  ck(r.blocked === true, 'SHAPE4 hollow receipt (fresh mtime, empty) -> blocked', r);
}

// SHAPE5: WRONG-class receipt — COVERS: FAILED(plan) vs killing class verify.
{
  const r = retroRepeatBlocked('st', '/r', Date.parse('2026-07-01T00:00:00Z'), {
    now: NOW,
    readdir: () => [retroName('2026-07-07T01:00:00.000Z')],
    readHead: () => '# RETRO st — FAILED(verify)',
    preflightMtimeMs: Date.parse('2026-07-07T02:00:00Z'),
    readPreflight: () => 'COVERS: FAILED(plan) -- dry-ran the old planning issue',
  });
  ck(r.blocked === true, 'SHAPE5 wrong-class receipt (plan vs verify) -> blocked', r);
}

// SHAPE6: LEGITIMATE fresh class-covering receipt (2 fails, <3-in-window so no amendment owed).
{
  const names = ['2026-07-07T01:00:00.000Z','2026-07-07T02:00:00.000Z'].map(retroName);
  const r = retroRepeatBlocked('st', '/r', Date.parse('2026-07-01T00:00:00Z'), {
    now: NOW, readdir: () => names,
    readHead: () => '# RETRO st — FAILED(verify)',
    preflightMtimeMs: Date.parse('2026-07-07T03:00:00Z'),
    readPreflight: () => 'COVERS: FAILED(verify) -- genuinely dry-ran the killing class, PASS',
  });
  ck(r.blocked === false && r.preflighted === true, 'SHAPE6 legitimate covering receipt -> NOT blocked, preflighted', r);
}

console.log(fails === 0 ? 'REPLAY ALL PASS (independent re-derivation)' : `${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
