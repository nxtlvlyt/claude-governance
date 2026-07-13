#!/usr/bin/env node
// witness-refire-hold-daemon-wire-patch.mjs -- gap-witness-revise-on-refire, part 2 of 2
// (part 1, the mechanism itself, landed in self_witness.mjs this session). Wires
// witnessRefireHold() into the daemon's own fire loop, mirroring the existing
// searchReadinessGate hold/block/fire pattern exactly: a HOLD spends no attempt and
// leaves the line pending, re-checked next poll. Requires an mt daemon restart to take
// effect (Node does not hot-reload an already-running process's own source file).
import { readFileSync, writeFileSync } from 'fs';

const path = process.argv[2] || 'muezzin-daemon.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('witnessRefireHold')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const importOld = `import { witnessArtifact, buildAfterContext } from './self_witness.mjs';`;
const importNew = `import { witnessArtifact, buildAfterContext, witnessRefireHold } from './self_witness.mjs';`;
const impN = t.split(importOld).length - 1;
if (impN !== 1) { console.error(`NOT-UNIQUE: found ${impN} occurrences of the self_witness import line`); process.exit(1); }
t = t.replace(importOld, importNew);

const gateOld = `      // gate.action === 'fire' -> fall through unchanged
    } catch (e) { evt(\`readiness-gate error (continuing to fire, fail-open): \${raw} — \${e.message}\`); }
    const n = (attempts.get(raw) || 0) + 1; attempts.set(raw, n);`;
const gateNew = `      // gate.action === 'fire' -> fall through unchanged
    } catch (e) { evt(\`readiness-gate error (continuing to fire, fail-open): \${raw} — \${e.message}\`); }
    // WITNESS-REFIRE HOLD (gap-witness-revise-on-refire, priority-elevated 2026-07-13):
    // a same-stem REFIRE (priorAttempts >= 1) whose BEFORE-pass witness flagged a REVISE/
    // REJECT is held until the conductor has explicitly acknowledged reading the flagged
    // plan (node self_witness.mjs --ack-plan-read <stem> [note]). Mirrors the search-
    // readiness gate exactly: a HOLD spends no attempt, the line stays pending, re-checked
    // next poll. Fail-open by construction (witnessRefireHold itself never throws outward).
    try {
      const wStem = path.basename(raw).replace(/\\.mission\\.txt$/, '');
      const wGate = witnessRefireHold(wStem, attempts.get(raw) || 0);
      if (wGate.action === 'hold') { evt(\`HELD (witness flag unacknowledged): \${raw} — \${wGate.reason}\`); return; }   // NO attempts++, line stays pending
    } catch (e) { evt(\`witness-refire-hold error (continuing to fire, fail-open): \${raw} — \${e.message}\`); }
    const n = (attempts.get(raw) || 0) + 1; attempts.set(raw, n);`;
const gN = t.split(gateOld).length - 1;
if (gN !== 1) { console.error(`NOT-UNIQUE: found ${gN} occurrences of the gate-insertion anchor`); process.exit(1); }
t = t.replace(gateOld, gateNew);

writeFileSync(path, t);
console.log('PATCHED');
