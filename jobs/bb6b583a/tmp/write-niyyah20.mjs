import { writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
const niyyah_text = "niyyah:\n  source: mission-events.jsonl for mt-enrich-scenic-wikidata (personally grepped this turn, confirming 22 of 28 attempts show a genuine 0-character seat output across multiple distinct models and escalation tiers, not a code-extraction parsing failure) plus the mission text's own step 1 (personally read, confirming it is a single dense unbroken paragraph).\n  failure_mode: parking a mission with only prose as its owner, or blindly re-firing a mission that has already burned 6+ heal attempts across escalated tiers on the identical failure shape.\n  work: file QUEUE.md ITEM 27 as the tracked owner, park mt-enrich-scenic-wikidata.mission.txt against it with the full diagnosis, and file a GAP-REGISTER entry since a universal empty-emission across multiple distinct seats/tiers on one step could be a systemic prompt-construction or context-budget issue, not isolated to this one mission.";
const obj = { ts: Date.now(), niyyah_text };
writeFileSync(path.join(os.homedir(), '.claude', 'state', 'pending-niyyah.json'), JSON.stringify(obj), 'utf8');
process.stdout.write('WROTE\n');
