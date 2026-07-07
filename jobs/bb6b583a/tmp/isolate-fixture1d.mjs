// Isolation of selftest fixture 1d (heal refuses restart while a lane runs) — exact same
// inputs as conduct-cycle.mjs selftest lines 1788-1793, run alone to classify the suite
// crash as regression-at-HEAD vs fixture-ordering contamination. Read-only on the engine.
import { heal } from 'file:///C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const now = Date.now();
const tmp = mkdtempSync(path.join(os.tmpdir(), 'fix1d-'));
const logs = path.join(tmp, 'missions', '_logs');
mkdirSync(logs, { recursive: true });
writeFileSync(path.join(logs, 'daemon-status.json'), JSON.stringify({ pid: 999999999, state: 'running', lanes: ['missions/live.mission.txt'], queued: 0, ts: new Date(now - 10 * 60000).toISOString() }));
writeFileSync(path.join(logs, 'daemon.pid'), '999999999');
writeFileSync(path.join(tmp, 'missions', 'AUTORUN.md'), '# q\nRUNNING missions/live.mission.txt  <!-- t -->\n');

try {
  const h2 = heal(tmp, now, { exec: () => { throw new Error('RESTART FIRED WHILE A LANE WAS RUNNING'); } });
  const skipped = h2.performed.some((p) => p.action === 'restart-skipped');
  console.log(skipped ? 'PASS  isolation: heal skipped restart with a lane running' : `FAIL  isolation: no restart-skipped entry; performed=${JSON.stringify(h2.performed)}`);
} catch (e) {
  console.log(`CRASH in isolation too: ${e.message}`);
}
rmSync(tmp, { recursive: true, force: true });
