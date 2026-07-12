import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: engine-heal-selftest-race-fix.mission.result.json (personally read this turn, all 4 steps ok:true including step 4's commit), git log (personally verified commit 874dc39 live, working tree clean), and a personal fresh selftest run (23s, 160 PASS / 0 FAIL, ALL PASS) -- confirming the FAILED mark is a false death, not a real defect.\n  failure_mode: leaving a genuinely-landed fix marked FAILED, or worse, re-firing a redundant attempt that could re-touch already-correct code.\n  work: annotate engine-heal-selftest-race-fix.mission.txt's FAILED line RESOLVED-LANDED with full receipts, close gap-heal-selftest-chain-crash in GAP-REGISTER.jsonl with the commit hash, and note the mt daemon restart owed before re-bareing engine-srcsha-anchor-fix.mission.txt.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
