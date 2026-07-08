// Watch the fork's atv-1 mission to a terminal mark (DONE/FAILED) or 3h timeout.
import { readFileSync } from 'fs';
const AU = 'C:/Users/marka/agy-muezzin/missions/AUTORUN.md';
const t0 = Date.now();
while (Date.now() - t0 < 3 * 3600e3) {
  try {
    const line = readFileSync(AU, 'utf8').split(/\r?\n/).find((l) => l.includes('atv-1-competitor-analysis')) || '';
    if (/^(DONE|FAILED)/.test(line.trim())) { console.log('TERMINAL:', line.trim().slice(0, 160)); process.exit(0); }
  } catch { /* transient */ }
  await new Promise((r) => setTimeout(r, 60e3));
}
console.log('WATCH TIMEOUT 3h — stall-check the lane');
process.exit(1);
