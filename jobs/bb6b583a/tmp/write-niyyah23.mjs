import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: QUEUE.md ITEM 28 (my own diagnosis, read directly this turn) plus mt-integrate-poi-tags-2026-06-23.S1.S1's AUTORUN annotation (read directly this turn, confirming it's already FAILED/PARKED from 2026-07-10, not currently at live risk).\n  failure_mode: naming a broader systemic risk in a diagnosis and stopping there instead of actually surveying whether it materializes elsewhere.\n  work: update QUEUE.md ITEM 28 with the confirmed second affected pair (poi-tags-2026-06-23.S1.S1 to S1.S2), noting it is not currently at live risk (S1.S1 already parked pending a separate decision, S1.S2 never fired) but shares the identical exposure shape, strengthening the case for the engine-level fix over the narrower per-mission merge.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
