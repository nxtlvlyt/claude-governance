// Replace the BEL byte (0x07) in STATE.md's bank line with a literal backslash.
import { readFileSync, writeFileSync } from 'fs';
const p = 'C:/Users/marka/.claude/muezzin-plugin/STATE.md';
const s = readFileSync(p, 'utf8');
const fixed = s.replace(/marka\x07gy-muezzin/g, 'marka\\agy-muezzin');
if (fixed === s) { console.log('NO MATCH — bytes differ from expectation'); process.exit(1); }
writeFileSync(p, fixed);
console.log('fixed:', fixed.slice(fixed.lastIndexOf('receipts in'), fixed.lastIndexOf('receipts in') + 60));
