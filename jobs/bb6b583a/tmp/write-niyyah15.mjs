import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: mt-integrate-poi-dedup-audit.S1's own DONE annotation (read directly this turn) naming S2 as the unpark-next step, plus direct disk verification that S1's 3 deliverables now exist -- confirming S2's original REJECT (F1/F2 nothing staged, F3 artifacts empty) was caused by the now-fixed resetAllowFiles bug destroying inputs S2 needed, not a defect in S2 itself.\n  failure_mode: leaving S2 parked indefinitely after fixing its root cause, letting gap-reset-allowfiles-data-loss sit permanently unclosed for want of the final mechanical step.\n  work: write missions/_logs/preflight/mt-integrate-poi-dedup-audit.S2.md covering FAILED(verdict), then re-bare S2 now that its required inputs are confirmed present.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
