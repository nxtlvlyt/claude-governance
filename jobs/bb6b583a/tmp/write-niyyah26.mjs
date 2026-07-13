import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: AUTORUN.md lines 616-617 and 866/942 (personally grepped this turn), showing two bare-pending lines each sitting adjacent to or nearby an explicit RESOLVED-LANDED/TOPOLOGY-RESOLVED verdict for the identical stem saying do-not-requeue.\n  failure_mode: leaving stale bare-pending duplicates of already-resolved work inflating the queue count and confusing future conductor passes about what's actually outstanding.\n  work: retire the two stale bare lines (qc-concern-pwa-install-banner, mt-integrate-d1-migrations-apply-2026-06-23.S1) per the established DUPLICATE-RETIRED convention, citing the existing RESOLVED-LANDED/TOPOLOGY-RESOLVED verdicts as the reason.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
