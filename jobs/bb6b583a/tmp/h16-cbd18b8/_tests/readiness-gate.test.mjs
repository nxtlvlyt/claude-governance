// _tests/readiness-gate.test.mjs — unit tests for searchReadinessGate (M-READINESS-GATE.1).
// Pure, zero network, zero daemon: probe/heal are injected stubs. Asserts the 5 branches.
// Run: node _tests/readiness-gate.test.mjs   (exit 0 = all pass)
import { searchReadinessGate } from '../muezzin-daemon.mjs';

let pass = 0, fail = 0;
const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };
const OK = { verdict: 'OK', results: 12, reason: '' };
const BLIND = { verdict: 'BLOCK', results: 0, reason: 'zero results — search is blind' };
const NO_SEARCH = 'MISSION-CLASS: research\nMaqsad: write a doc. Done means: doc exists.';
const NEEDS_SEARCH = 'MISSION-CLASS: research\nREQUIRES: search\nMaqsad: research X. Done means: findings doc.';

(async () => {
  // 1. no search requirement -> fire, probe never called
  {
    let probed = false;
    const r = await searchReadinessGate(NO_SEARCH, { probe: async () => { probed = true; return OK; }, holds: new Map(), key: 'k' });
    ck(r.action === 'fire' && !probed, '1. no search requirement -> fire without probing');
  }
  // 2. backend live -> fire, heal never called
  {
    let healed = false;
    const r = await searchReadinessGate(NEEDS_SEARCH, { probe: async () => OK, heal: async () => { healed = true; }, holds: new Map(), key: 'k' });
    ck(r.action === 'fire' && !healed, '2. search live -> fire, heal not called');
  }
  // 3. blind then heal makes it live -> fire, heal called exactly once
  {
    let healN = 0, probeN = 0;
    const r = await searchReadinessGate(NEEDS_SEARCH, {
      probe: async () => (++probeN === 1 ? BLIND : OK),
      heal: async () => { healN++; },
      holds: new Map(), key: 'k',
    });
    ck(r.action === 'fire' && healN === 1 && probeN === 2, '3. blind -> heal -> live -> fire (heal called once, re-probed)');
  }
  // 4. blind and stays blind -> hold (heal called), NO block on first hold
  {
    const holds = new Map();
    const r = await searchReadinessGate(NEEDS_SEARCH, { probe: async () => BLIND, heal: async () => {}, holds, key: 'k' });
    ck(r.action === 'hold' && holds.get('k') === 1, '4. blind stays blind -> hold (count=1), not block');
  }
  // 5. three consecutive holds -> block (and counter resets)
  {
    const holds = new Map();
    const opts = { probe: async () => BLIND, heal: async () => {}, holds, key: 'k' };
    const r1 = await searchReadinessGate(NEEDS_SEARCH, opts);
    const r2 = await searchReadinessGate(NEEDS_SEARCH, opts);
    const r3 = await searchReadinessGate(NEEDS_SEARCH, opts);
    ck(r1.action === 'hold' && r2.action === 'hold' && r3.action === 'block', '5. 3rd consecutive blind hold -> block');
    ck(!holds.has('k'), '5b. block resets the hold counter');
  }
  // 6. a live probe resets a prior hold streak (recovery)
  {
    const holds = new Map([['k', 2]]);
    const r = await searchReadinessGate(NEEDS_SEARCH, { probe: async () => OK, heal: async () => {}, holds, key: 'k' });
    ck(r.action === 'fire' && !holds.has('k'), '6. recovery: live probe clears the hold streak');
  }
  // 7. fail-soft: a throwing probe -> hold, never throws
  {
    let threw = false; let r;
    try { r = await searchReadinessGate(NEEDS_SEARCH, { probe: async () => { throw new Error('net down'); }, holds: new Map(), key: 'k' }); }
    catch { threw = true; }
    ck(!threw && r && r.action === 'hold', '7. fail-soft: throwing probe resolves to hold, never throws');
  }

  console.log(`\n${fail === 0 ? 'ALL PASS' : fail + ' FAIL'} (${pass} passed)`);
  process.exit(fail ? 1 : 0);
})();
