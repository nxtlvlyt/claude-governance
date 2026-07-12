import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: orchestrate.mjs line 779 (personally read this turn: resetAllowFiles runs unconditionally in sandbox setup for every code-repo mission fire, with no REQUIRES-aware exemption) plus mission-events.jsonl for the S2 stem (personally read, showing the files vanish on every retry) plus the quarantine directory (personally verified byte-identical recovered content).\n  failure_mode: treating quarantine-not-destroy as the complete fix when it only solved data loss; the split-mission handoff pattern itself is still structurally broken and will keep failing on every retry.\n  work: restore the quarantined files (done), park mt-integrate-poi-dedup-audit.S2 again with this deeper structural finding (not a blind re-fire), file a new gap distinct from the now-correctly-closed data-loss gap, and recommend the durable fix (merge S1+S2 into one non-split mission, or an engine-level REQUIRES-aware reset exemption).";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
