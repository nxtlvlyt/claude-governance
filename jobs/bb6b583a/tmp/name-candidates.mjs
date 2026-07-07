// Name the falseDeathScan candidates + doneness blocking items (sweep prints counts only).
import { readFileSync } from 'fs';
const base = 'C:/Users/marka/.claude/muezzin-plugin';
const mod = await import('file:///C:/Users/marka/.claude/muezzin-plugin/conduct-cycle.mjs');
const autorun = readFileSync(`${base}/missions/AUTORUN.md`, 'utf8');

if (typeof mod.falseDeathScan === 'function') {
  const fd = mod.falseDeathScan(autorun, base, {});
  const list = Array.isArray(fd) ? fd : fd?.candidates || [];
  console.log('FALSE-DEATH CANDIDATES:', list.length);
  for (const c of list) console.log(' -', c.stem || c.mission || JSON.stringify(c).slice(0, 200));
}

try {
  const d = JSON.parse(readFileSync(`${base}/missions/_logs/doneness.json`, 'utf8'));
  console.log('DONENESS blocking:', (d.blocking || []).length);
  for (const b of d.blocking || []) console.log(' *', typeof b === 'string' ? b : `${b.stem || b.mission || ''} :: ${(b.reason || b.why || '').slice(0, 160)}`);
} catch (e) { console.log('doneness.json:', e.message); }
