export function queuedDepsHold(missionText, missionPath, autorunText, resultOkFn) {
  const txt = String(missionText || '');
  // SELF-RESOLVED CHECK (2026-07-02, d1-migrations resurrection loop): a conductor-RESOLVED
  // mission must never refire — but graceful reloads interrupt in-flight attempts, and the
  // boot-time RUNNING->pending revert resurrected a mission whose PENDING line was already
  // resolved. If AUTORUN carries a RESOLVED comment naming THIS mission, it is retired.
  const selfEsc = String(missionPath || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^#.*RESOLVED.*${selfEsc}`, 'm').test(autorunText)) {
    return { hold: true, resolvedSelf: true, dep: missionPath, why: 'mission itself is conductor-RESOLVED in AUTORUN — retired from firing (work landed)' };
  }
  const deps = new Set();
  // (a) explicit mission-file list
  const reqLine = (txt.match(/^REQUIRES:\s*(.+)$/im) || [])[1] || '';
  for (const m of reqLine.matchAll(/missions\/\S+?\.mission\.txt/g)) deps.add(m[0]);
  // (b) tartib child form — resolve the predecessor ID to a path if a file matches
  const pred = (reqLine.match(/predecessor\s+(\S+)\s+DONE/i) || [])[1];
  if (pred) deps.add(`missions/${pred.replace(/^missions\//, '').replace(/\.mission\.txt$/, '')}.mission.txt`);
  // (c) implicit .Sn -> .S(n-1)
  const sn = String(missionPath || '').match(/^(.*\.S)(\d+)\.mission\.txt$/);
  if (sn && parseInt(sn[2], 10) >= 2) deps.add(`${sn[1]}${parseInt(sn[2], 10) - 1}.mission.txt`);
  for (const dep of deps) {
    if (dep === missionPath) continue;
    const doneRe = new RegExp(`^DONE\\s+${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    const resolvedRe = new RegExp(`^#.*RESOLVED.*${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    if (resolvedRe.test(autorunText)) continue;                                  // conductor-landed
    if (doneRe.test(autorunText) && resultOkFn(dep) === true) continue;          // DONE + PASS receipt
    return { hold: true, dep, why: doneRe.test(autorunText) ? `dependency ${dep} is DONE but its result.json is not ok:true (hollow receipt)` : `dependency ${dep} not DONE/RESOLVED` };
  }
  return { hold: false };
}
