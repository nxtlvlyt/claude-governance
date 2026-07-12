import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: conductor-core.md's seventh law -- a FAILED mark is diagnosis debt due same-wake; personally read the mission's result.json, the crash stack trace, and heal()'s source around the crash site before writing any annotation.\n  failure_mode: annotating a FAILED mark with a guess instead of a verified diagnosis, or letting the diagnosis debt sit while moving to other STATUS CRON items without at least naming the root cause and owner.\n  work: annotate engine-srcsha-anchor-fix.mission.txt's FAILED line in AUTORUN.md with the verified diagnosis (pre-existing heal() selftest-harness crash, unrelated to my patch, patcher never ran) and file gap-heal-selftest-chain-crash in GAP-REGISTER.jsonl owned by the dispatched investigation agent.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
