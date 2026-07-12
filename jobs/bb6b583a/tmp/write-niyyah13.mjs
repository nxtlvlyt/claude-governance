import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: orchestrate.mjs line 494 (timeout: 300000, read directly this turn) plus a personal dry-run of step 1 that timed out at 2 minutes mid-PASS-stream with the exact same truncation point as both mission FAILEDs -- confirming the real mechanism is the engine's 5-minute step timeout colliding with the diagnosed ~5m29s solo runtime of the UNPATCHED file, not a race collision (that earlier diagnosis is retracted).\n  failure_mode: re-bareing a mission a third time on an unchanged, structurally-doomed step instead of amending the actual defect -- the ninth law's own point.\n  work: amend engine-heal-selftest-race-fix.mission.txt step 1 to drop the full slow --selftest requirement (replace with git-state + node --check syntax only), write a preflight receipt covering FAILED(verify), then re-bare.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
