import { readFileSync } from 'fs';
const text = readFileSync('C:/Users/marka/.claude/muezzin-plugin/missions/AUTORUN.md', 'utf8');
const STATUS_RE = /^(DONE|FAILED|RUNNING|PARKED|SPLIT)\b/;
const lines = text.split(/\r?\n/);
for (const line of lines) {
  if (line.includes('engine-srcsha-fixture-update')) {
    const s = line.trim();
    const isComment = s.startsWith('#');
    const m = s.match(STATUS_RE);
    console.log(JSON.stringify({ isComment, status: m ? m[1] : 'BARE-PENDING', preview: s.slice(0, 90) }));
  }
}
