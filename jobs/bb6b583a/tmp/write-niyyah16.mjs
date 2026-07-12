import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: the background investigation agent's confirmed finding (seat_dispatch.mjs:181-185 execTimeoutMs, orchestrate.mjs:1073/1173, receipted against mission-events.jsonl timestamps showing ~120000ms elapsed on both attempts) -- closing the open question my own preflight receipt explicitly flagged as unresolved.\n  failure_mode: leaving a diagnosis document stating an open question is now stale once the answer is known, misleading whoever reads it next.\n  work: update missions/_logs/preflight/engine-heal-selftest-race-fix.md and missions/_logs/heal-selftest-crash-diagnosis.md to record the confirmed timeout mechanism precisely instead of leaving it as unconfirmed.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
