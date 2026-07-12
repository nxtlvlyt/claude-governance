import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: daemon-events.log (personally read this turn, six live QUEUE-DUP skipped events at 20:45:04Z naming lines 1062-1067) plus AUTORUN.md grep confirming each has an earlier authoritative FAILED status line from 2026-07-07 -- these bare lines are genuine leftover duplicates, not live work.\n  failure_mode: dismissing a persistently-idle daemon with a nonzero queue as normal churn instead of checking what the daemon's own events log says it's actually doing.\n  work: retire the 6 duplicate bare-path lines (1062-1067) per the established DUPLICATE-RETIRED convention, matching the daemon's own explicit request in its skip log.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
