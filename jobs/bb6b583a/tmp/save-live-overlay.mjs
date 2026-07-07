import { writeFileSync } from 'node:fs';
const res = await fetch('https://muddytires.ca/js/crown-land-overlay.js');
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync('C:/Users/marka/.claude/jobs/bb6b583a/tmp/live-overlay.js', buf);
console.log('saved', buf.length, 'bytes, status', res.status);
