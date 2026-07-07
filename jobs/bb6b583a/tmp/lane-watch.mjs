// Lane-boundary watcher: exits 0 when the daemon has zero lanes (safe reload window),
// exits 1 after ~50 min if the lane never ends (stall signal — investigate, don't reload).
import { readFileSync } from 'fs';
const STATUS = 'C:/Users/marka/.claude/muezzin-plugin/missions/_logs/daemon-status.json';
const t0 = Date.now();
while (Date.now() - t0 < 50 * 60e3) {
  try {
    const s = JSON.parse(readFileSync(STATUS, 'utf8'));
    if (!Array.isArray(s.lanes) || s.lanes.length === 0) {
      console.log(`LANE BOUNDARY at ${new Date().toISOString()} — safe reload window (daemon pid ${s.pid})`);
      process.exit(0);
    }
  } catch { /* transient read race — keep polling */ }
  await new Promise((r) => setTimeout(r, 30e3));
}
console.log('WATCH TIMEOUT: lane still running after 50min — stall-check the lane before reloading');
process.exit(1);
