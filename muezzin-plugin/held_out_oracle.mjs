// held_out_oracle.mjs — metamorphic / held-out reliability oracle.
//
// SOTA-found signal: a step's OWN visible test passing proves little — a step can be tuned (knowingly or not)
// to pass exactly what it was shown ("reward hacking" / overfitting to the visible check). The reliable
// signal is the gap between the visible test (the step saw it) and a HIDDEN held-out assertion (it never did):
// if it passes what it saw but FAILS the hidden check, that step's green is not trustworthy.
//
// This module runs the held-out command via the muezzin's real witness (execReceipt — the deed, not the word)
// and tracks the per-mission reward-hacking rate across steps.

import { execReceipt } from './seat_dispatch.mjs';

// runHeldOut — run a HIDDEN assertion the step never saw, and measure the visible-vs-held-out gap.
//   visiblePass    : boolean — did the step's own (visible) test pass?
//   heldOutCommand : string  — a command encoding an assertion the step was never shown.
//   cwd            : string  — working directory for the held-out command.
// returns { visible_pass, held_out_pass, reward_hacking_gap }
//   held_out_pass     = execReceipt(heldOutCommand, cwd).ok  (exit 0 only)
//   reward_hacking_gap= visible_pass === true && held_out_pass === false
//                       (passed what it saw, failed the hidden check — its green is not trustworthy)
export function runHeldOut(visiblePass, heldOutCommand, cwd) {
  const visible_pass = visiblePass === true;
  const receipt = execReceipt(heldOutCommand, cwd);
  const held_out_pass = receipt.ok === true;
  const reward_hacking_gap = visible_pass === true && held_out_pass === false;
  return { visible_pass, held_out_pass, reward_hacking_gap };
}

// makeGapTracker — accumulate the per-mission reward-hacking rate across steps.
//   record(gapBool) : count one step; gapped if gapBool === true.
//   summary()       : { steps, gapped, rate }  (rate = gapped/steps, 0 when no steps).
export function makeGapTracker() {
  let steps = 0;
  let gapped = 0;
  return {
    record(gapBool) {
      steps += 1;
      if (gapBool === true) gapped += 1;
    },
    summary() {
      return { steps, gapped, rate: steps === 0 ? 0 : gapped / steps };
    },
  };
}

// --------------------------------------------------------------------------- offline self-test
if (process.argv[1]?.endsWith('held_out_oracle.mjs')) {
  let pass = true;
  const fail = (m) => { pass = false; console.log('  FAIL:', m); };

  // Case 1: held-out command PASSES (exit 0) with visiblePass=true -> gap=false.
  const passCmd = `node -e "process.exit(0)"`;
  const r1 = runHeldOut(true, passCmd, process.cwd());
  console.log('[case1] held-out PASSES, visiblePass=true ->', JSON.stringify(r1));
  if (r1.visible_pass !== true) fail('case1 visible_pass should be true');
  if (r1.held_out_pass !== true) fail('case1 held_out_pass should be true (exit 0)');
  if (r1.reward_hacking_gap !== false) fail('case1 reward_hacking_gap should be false');

  // Case 2: held-out command FAILS (exit 1) with visiblePass=true -> gap=true (passed visible, failed hidden).
  const failCmd = `node -e "process.exit(1)"`;
  const r2 = runHeldOut(true, failCmd, process.cwd());
  console.log('[case2] held-out FAILS, visiblePass=true ->', JSON.stringify(r2));
  if (r2.visible_pass !== true) fail('case2 visible_pass should be true');
  if (r2.held_out_pass !== false) fail('case2 held_out_pass should be false (exit 1)');
  if (r2.reward_hacking_gap !== true) fail('case2 reward_hacking_gap should be true');

  // Tracker: record both steps; exactly one (case2) is gapped.
  const t = makeGapTracker();
  t.record(r1.reward_hacking_gap);
  t.record(r2.reward_hacking_gap);
  const s = t.summary();
  console.log('[tracker] summary ->', JSON.stringify(s));
  if (s.steps !== 2) fail('tracker steps should be 2');
  if (s.gapped !== 1) fail('tracker gapped should be 1 (only the held-out failure)');
  if (s.rate !== 0.5) fail('tracker rate should be 0.5');

  // Empty tracker: no division-by-zero, rate=0.
  const empty = makeGapTracker().summary();
  if (!(empty.steps === 0 && empty.gapped === 0 && empty.rate === 0)) fail('empty tracker should be {0,0,0}');

  console.log(pass ? '\nHELD-OUT ORACLE OK — visible-vs-held-out gap detected; reward-hacking step counted.'
                   : '\nSELF-TEST FAILED — see FAIL lines above.');
  process.exit(pass ? 0 : 1);
}
