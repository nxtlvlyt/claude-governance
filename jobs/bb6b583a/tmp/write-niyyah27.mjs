import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: muezzin-daemon.mjs lines 665-693 (personally read directly this turn, confirming GAP_HOLD_PRODUCT_PREFIXES and the existsSync(GAP-PRIORITY-HOLD) mechanism) plus GAP-REGISTER.jsonl (personally grepped, confirming 6 open bite-class gaps right now).\n  failure_mode: treating gap-priority as a prose ordering I keep in my head instead of the mechanical flag file the standing ruling actually specifies, letting product missions fire alongside open bite-class gaps.\n  work: create missions/_logs/GAP-PRIORITY-HOLD as an empty flag file, mechanically enforcing the operator's standing 2026-07-03 ruling now that the operator has directly confirmed this framing.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
