import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: three independent observations this turn (two real mission FAILEDs plus my own personal PowerShell dry-run) all truncating at the identical point in a deterministic PASS sequence -- strong evidence of a step-execution timeout, though I could not pin the exact governing constant (a specific 300000ms figure I found was mis-attributed to a different subsystem and is retracted).\n  failure_mode: re-bareing a mission a third time on an unchanged, structurally-doomed step instead of amending the actual defect -- the ninth law's own point; also overclaiming a precise root-cause value I had not actually verified.\n  work: amend engine-heal-selftest-race-fix.mission.txt step 1 to drop the full slow --selftest requirement (replace with git-state + node --check syntax only, deferring the real behavioral verification to step 3 against the PATCHED fast file), write a preflight receipt covering FAILED(verify), then re-bare.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
