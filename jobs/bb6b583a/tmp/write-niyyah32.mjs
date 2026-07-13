import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: engine-item26b-rule14-content-contract.mission.result.json (personally read this turn, steps 1-2 ok:true confirming RULE 14 live) plus git log (personally verified commit 3c2987d matches my exact intended message) plus a fresh grep confirming content-pass-without-contract present 4 times in the live file.\n  failure_mode: leaving a genuinely-landed fix marked FAILED because the commit-wrapper's trailing syntax choked after the real work already succeeded.\n  work: annotate engine-item26b-rule14-content-contract.mission.txt RESOLVED-LANDED with receipts, close gap-seo-cro-copy-contract's mechanical half in GAP-REGISTER.jsonl.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
