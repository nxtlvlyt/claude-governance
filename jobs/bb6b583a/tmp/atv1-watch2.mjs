// Watch BOTH atv-1 split children to terminal marks (DONE/FAILED) or 4h timeout.
import { readFileSync } from 'fs';
const AU = 'C:/Users/marka/agy-muezzin/missions/AUTORUN.md';
const t0 = Date.now();
while (Date.now() - t0 < 4 * 3600e3) {
  try {
    const lines = readFileSync(AU, 'utf8').split(/\r?\n/);
    const kids = lines.filter((l) => /atv-1-competitor-analysis\.S\d/.test(l));
    const terminal = kids.filter((l) => /^(DONE|FAILED)/.test(l.trim()));
    if (kids.length >= 2 && terminal.length === kids.length) {
      console.log('ALL TERMINAL:'); terminal.forEach((l) => console.log(l.trim().slice(0, 140)));
      process.exit(0);
    }
    if (terminal.some((l) => l.trim().startsWith('FAILED'))) {
      console.log('A CHILD FAILED:'); terminal.forEach((l) => console.log(l.trim().slice(0, 140)));
      process.exit(0);
    }
  } catch { /* transient */ }
  await new Promise((r) => setTimeout(r, 120e3));
}
console.log('WATCH TIMEOUT 4h — stall-check the lanes');
process.exit(1);
