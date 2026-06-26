// run-mission.mjs — detached mission launcher: node run-mission.mjs <mission-file> <cwd>
// Missions are FILES, not argv strings: multi-line Maqsad+niyyah text does not survive
// process-spawn quoting (found live: P0-CORPUS launch — a niyyah fragment became the cwd
// and the sandbox gate correctly refused it). The file is also the mission's durable
// record (Directive 8).
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { orchestrate } from './orchestrate.mjs';

// auto-push — runs in the ENGINE (below every CLI), so missions fired by agy,
// hermes, Claude, the daemon, or a human all back up identically. A mission
// commits locally; without this, the work strands on whatever machine ran it
// (root cause of the 06-2x stranded-branch backlog). Device-agnostic only holds
// if GitHub is always current. NON-FATAL by contract: a push problem (offline,
// no remote, auth) NEVER flips the mission result — the commit is already durable
// locally and the next mission's push (or a manual sweep) catches it up.
function autoPushAfterMission(cwd) {
  const opt = { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' };
  try {
    execSync('git rev-parse --is-inside-work-tree', opt);
  } catch {
    return; // not a git repo (e.g. fresh sandbox orchestration) — nothing to push
  }
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', opt).trim();
    if (!branch || branch === 'HEAD') {
      console.error('[auto-push] detached HEAD — skipping (work is committed locally)');
      return;
    }
    const remotes = execSync('git remote', opt).trim().split(/\s+/).filter(Boolean);
    if (!remotes.length) {
      console.error('[auto-push] no git remote — skipping (work is committed locally)');
      return;
    }
    const remote = remotes.includes('github') ? 'github'
      : remotes.includes('origin') ? 'origin' : remotes[0];
    execSync(`git push -u ${remote} ${branch}`, opt);
    console.error(`[auto-push] pushed ${branch} -> ${remote}`);
  } catch (e) {
    // Backup is best-effort. The mission's work is safe in the local commit;
    // surface the reason so a later sweep can retry, but do NOT fail the mission.
    console.error(`[auto-push] non-fatal push failure (work committed locally, retry later): ${String(e && e.message || e).slice(0, 200)}`);
  }
}

const [missionFile, cwd] = process.argv.slice(2);
if (!missionFile || !cwd) {
  console.error('usage: node run-mission.mjs <mission-file> <cwd>');
  process.exit(2);
}
const mission = readFileSync(missionFile, 'utf8');
mkdirSync(cwd, { recursive: true });

const r = await orchestrate(mission, cwd, { maxRepairs: 1 });
const report = JSON.stringify(r, null, 2);
console.log(report);
// Receipt lands next to the mission file regardless of how the process was observed.
writeFileSync(missionFile.replace(/\.[^.]+$/, '') + '.result.json', report, 'utf8');
// Back up the work to GitHub before exiting — always attempted, never fatal.
autoPushAfterMission(cwd);
process.exit(r.ok ? 0 : 1);
