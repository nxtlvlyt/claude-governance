// Independent adversarial replay of hunt-8 kill-shapes at SHIPPED DEFAULTS.
// No preflightAfter/minFails/windowMs overrides — only injectable fs/now hooks.
import { retroRepeatBlocked } from 'file:///C:/Users/marka/.claude/muezzin-plugin/muezzin-daemon.mjs';

const NOW = Date.parse('2026-07-07T12:00:00Z');
let fails = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const iso = (ms) => new Date(ms).toISOString().replace(/:/g, '-').replace('.', '-');
const retro = (stem, ms) => `${stem}-${iso(ms)}.md`;
const H = 3600e3;

// SHAPE1: ONE FAILED retro (in window), no receipt. Pre-fix (preflightAfter=5, minFails=3): NO gate.
{
  const r = retroRepeatBlocked('s1', '/r', NOW - 48 * H, {
    readdir: () => [retro('s1', NOW - 2 * H)],
    readHead: () => '# RETRO s1 — FAILED(verify)',
    now: NOW,
  });
  ck(r.blocked === true && r.needsPreflight === true && r.killingClass === 'verify',
    `SHAPE1 one-fail/no-receipt -> blocked=${r.blocked} needsPreflight=${r.needsPreflight} killingClass=${r.killingClass}`);
}

// SHAPE2: FOUR fails in window + AMENDED mission mtime, no receipt. Pre-fix: mtime bump alone passed.
{
  const failsArr = [1, 2, 3, 4].map((h) => retro('s2', NOW - h * H));
  const r = retroRepeatBlocked('s2', '/r', NOW - 0.5 * H /* amended after newest fail */, {
    readdir: () => failsArr,
    readHead: () => '# RETRO s2 — FAILED(verify)',
    now: NOW,
  });
  ck(r.blocked === true, `SHAPE2 four-fails+amended-mtime/no-receipt -> blocked=${r.blocked} needsPreflight=${r.needsPreflight}`);
}

// SHAPE3: FIVE fails, all OLDER than 24h. Pre-fix: windowed count 0 -> invisible.
{
  const failsArr = [30, 40, 50, 60, 70].map((h) => retro('s3', NOW - h * H));
  const r = retroRepeatBlocked('s3', '/r', NOW - 80 * H, {
    readdir: () => failsArr,
    readHead: () => '# RETRO s3 — FAILED(verify)',
    now: NOW,
  });
  ck(r.blocked === true && r.totalFails === 5 && r.count === 0,
    `SHAPE3 five-fails-all->24h -> blocked=${r.blocked} totalFails=${r.totalFails} windowedCount=${r.count}`);
}

// SHAPE4: HOLLOW receipt (fresh mtime, empty content). Pre-#24: mtime alone opened the gate.
{
  const failsArr = [retro('s4', NOW - 2 * H)];
  const r = retroRepeatBlocked('s4', '/r', NOW - 48 * H, {
    readdir: () => failsArr,
    readHead: () => '# RETRO s4 — FAILED(verify)',
    now: NOW,
    preflightMtimeMs: NOW - 1 * H, // fresher than newest retro
    readPreflight: () => '',
  });
  ck(r.blocked === true, `SHAPE4 hollow-receipt -> blocked=${r.blocked}`);
}

// SHAPE5: WRONG-CLASS receipt: COVERS FAILED(plan), killing class is verify.
{
  const failsArr = [retro('s5', NOW - 2 * H)];
  const r = retroRepeatBlocked('s5', '/r', NOW - 48 * H, {
    readdir: () => failsArr,
    readHead: () => '# RETRO s5 — FAILED(verify)',
    now: NOW,
    preflightMtimeMs: NOW - 1 * H,
    readPreflight: () => 'COVERS: FAILED(plan) -- dry-ran the old planning issue',
  });
  ck(r.blocked === true, `SHAPE5 wrong-class-receipt -> blocked=${r.blocked}`);
}

// SHAPE6: LEGITIMATE fresh class-covering receipt (2 fails in window, receipt fresher than newest, covers verify).
{
  const failsArr = [retro('s6', NOW - 3 * H), retro('s6', NOW - 2 * H)];
  const r = retroRepeatBlocked('s6', '/r', NOW - 48 * H, {
    readdir: () => failsArr,
    readHead: () => '# RETRO s6 — FAILED(verify)',
    now: NOW,
    preflightMtimeMs: NOW - 1 * H,
    readPreflight: () => 'COVERS: FAILED(verify) -- re-ran the verify step end-to-end, PASS',
  });
  ck(r.blocked === false && r.preflighted === true,
    `SHAPE6 legitimate-receipt -> blocked=${r.blocked} preflighted=${r.preflighted}`);
}

// EXTRA adversarial probe: 3+ fails IN window + fresh covering receipt but UNAMENDED text -> must still block (amendment guard).
{
  const failsArr = [1, 2, 3].map((h) => retro('s7', NOW - h * H));
  const r = retroRepeatBlocked('s7', '/r', NOW - 48 * H /* NOT amended */, {
    readdir: () => failsArr,
    readHead: () => '# RETRO s7 — FAILED(verify)',
    now: NOW,
    preflightMtimeMs: NOW - 0.5 * H,
    readPreflight: () => 'COVERS: FAILED(verify)',
  });
  ck(r.blocked === true && r.needsAmendment === true,
    `EXTRA 3-in-window+receipt+unamended -> blocked=${r.blocked} needsAmendment=${r.needsAmendment}`);
}

console.log(fails === 0 ? 'REPLAY ALL PASS' : `${fails} REPLAY FAILURES`);
process.exit(fails === 0 ? 0 : 1);
