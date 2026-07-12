import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: daemon-events.log (personally read this turn, live queuedDepsHold advisory for this exact stem naming its REQUIRES token as unresolved) plus a direct disk check confirming the two deliverable files are genuinely absent from their expected paths, matching the same failure shape already diagnosed and filed as QUEUE.md ITEM 28.\n  failure_mode: leaving a mission bare and fireable when its dependency gate is known-broken and a guaranteed repeat failure is predictable in advance, wasting a daemon cycle the same way poi-dedup S2 already did three times.\n  work: park mt-integrate-poi-tags-2026-06-23.S1.S2.mission.txt against the already-filed QUEUE.md ITEM 28, preventing a predictable, avoidable failure before it happens rather than diagnosing it after the fact.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
