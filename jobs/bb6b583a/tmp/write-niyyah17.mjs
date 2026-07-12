import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: seat_dispatch.mjs lines 175-192 (personally read and confirmed this turn: execTimeoutMs returns 120000ms for tier-0 single-line commands) plus mission-events.jsonl for this stem (personally grepped, confirming both attempts elapsed 120171ms and 120554ms) -- independently verifying a sub-agent's report rather than trusting it blindly.\n  failure_mode: writing an unverified sub-agent finding into a permanent diagnosis record as if personally confirmed.\n  work: update missions/_logs/preflight/engine-heal-selftest-race-fix.md to record the now-confirmed timeout mechanism, closing the open question the document previously flagged as unresolved.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
