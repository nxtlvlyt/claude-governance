import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: engine-heal-selftest-race-fix.mission.result.json (read directly this turn) plus daemon-status.json showing 2 concurrent lanes were active at the failure timestamp (poi-dedup S1 + this mission itself) -- both just read.\n  failure_mode: assuming a FAILED mark on a dry-run-verified mission means the fix is wrong, instead of recognizing the failure signature matches the exact bug being fixed.\n  work: annotate engine-heal-selftest-race-fix.mission.txt's FAILED line with the diagnosis (step 1's baseline selftest, running on the UNPATCHED file, collided with a concurrently-running sibling lane -- the exact race this mission fixes, self-demonstrating before its own fix landed) and re-bare it now that lanes are clear.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
