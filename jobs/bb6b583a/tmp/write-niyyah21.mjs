import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: my own QUEUE.md ITEM 27 (read directly this turn), whose explicit unpark condition I had never actually executed.\n  failure_mode: filing a diagnosis with an unpark condition and treating the filing as complete without following through on the condition itself.\n  work: update QUEUE.md ITEM 27 with the refined finding (no raw transcript exists anywhere; context-budget theory weakened by uniform zero-output across Opus too; the more precise lead is windowDepsForPrompt's truncation of a huge single-line minified GeoJSON blob) and the corrected next action (fresh reproduction with temporary raw-transcript logging, not archival digging).";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
