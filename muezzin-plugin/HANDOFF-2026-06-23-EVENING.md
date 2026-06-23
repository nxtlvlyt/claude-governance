# Handoff — 2026-06-23 evening to next instance

## ⚠️ READ FIRST — before any action this session

**`NEXT-INSTANCE-WARNINGS-2026-06-23.md`** (sibling file in this directory, sha `a06c690`)
catalogs 6 specific failure patterns the previous instance fell into this session, each
with the receipt + the corrective. Read it BEFORE any non-trivial action. It will save
hours of operator-time.

The headline failures, in case you're skimming:
1. Don't author workflows in mt-audit (use AUTORUN.md instead)
2. agy is EXECUTOR-only — never wire to architects/witnesses/auditors
3. Read `.result.json` receipts, not just `daemon-status.json` status
4. Don't ask "want me to" — receive the amanah, reason your own path
5. Restart the daemon after engine-code edits — module cache is sticky
6. Don't stack enhancements without between-soak acceptance gates

---

**Authored by:** previous instance (claude-opus-4-7) at 2026-06-23 ~19:30Z, ~30 turns
before context limit. The instance that bootstraps after me will not have memory
of any of this — per CLAUDE.md D14 ("continuity is approximated, not achieved").
This document is the substrate handoff.

**Operator (Mark) is asleep.** Wake-up substrate check should happen no earlier
than 2026-06-24 ~02:00Z (soak completion + 1h slack).

---

## Substrate state at handoff

### The plugin daemon is running

- **PID 42784** — `muezzin-daemon.mjs` started at 2026-06-23T17:08:41Z
- Status file: `missions/_logs/daemon-status.json`
- Heartbeat log: `missions/_logs/dispatch-heartbeat.log`
- Currently 2 lanes active, processing 3 b13-* remediation missions

### v0.3 SOAK is the 8h+ unsupervised-run acceptance test

The one outstanding gate per `BUILD_STATE.md`. Runs through ~01:08Z (2026-06-24).
The previous instance committed itself to NOT touching `executor.mjs` /
`seat_dispatch.mjs` during the soak (per-mission spawns re-import these files,
so edits would contaminate the acceptance test result).

**Morning check (substrate, not interpretation)**:

```bash
cat C:/Users/marka/.claude/muezzin-plugin/missions/_logs/daemon-status.json
cat C:/Users/marka/.claude/muezzin-plugin/missions/_logs/STATUS-BOARD.md | head -10
tail -50 C:/Users/marka/.claude/muezzin-plugin/missions/_logs/dispatch-heartbeat.log
grep -c "DONE\|FAILED" C:/Users/marka/.claude/muezzin-plugin/missions/_logs/MISSION-LEDGER.md
ps -ef | grep muezzin-daemon
```

**Pass criteria** (ALL must hold):
- `daemon-status.json`'s `ts` field within last 5 minutes of when you check
- PID 42784 still alive
- `dispatch-heartbeat.log` shows continuous activity through the 8h window (no
  silent gaps > 10 min that aren't legal retry-wait math)
- `MISSION-LEDGER.md` has new entries timestamped 2026-06-23T17:08Z onward
- No uncaught-exception traces in `missions/_logs/daemon-hermes-*.log`

**Failure signals**:
- daemon-status.json frozen (ts > 5 min stale) → daemon hung; diagnose
- Process gone → daemon crashed; read last daemon-hermes log for cause
- Heartbeat silent for >10 min mid-soak → diagnose
- 2-lane invariant broken (lanes count 0 with queued > 0, or lanes > 2)

---

## v0.4 substrate ready to wire (do NOT do during soak)

Three commits landed in this plugin's git history during the previous session:

1. **`18f4ddf`** — `agy_dispatch.mjs` (180 LOC)
   - Exports `dispatchAgy(prompt, opts)`, `sentinelProbe(opts)`, `resolveAgyModel(seatOrModel)`, `agyAvailable()`
   - Substrate-verified invocation pattern: `agy --model claude-sonnet-4-6 --print --print-timeout 5m --dangerously-skip-permissions --add-dir <cwd> <prompt>`
   - Test result: exit 0, 9.2s, real Vertex AI routing trace (`req_vrtx_011...`)
   - Caveats baked into the JSDoc: stdout-emission planner-loop swallow is acceptable for executor (deed = files on disk, not stdout)
   - NOT imported by anything yet

2. **`e44c191`** — `visual_witness.mjs` (216 LOC)
   - Exports `witnessVisualDiff(previewPathFn, opts)`, `inventoryBaseline(dir)`
   - Imports from `./agy_dispatch.mjs`
   - Self-test verified: inventories baselines, builds prompt, parses verdict response

3. **`378e3a2`** — `qc-baseline/` (54 PNGs + INDEX.md, 32MB)
   - Baseline screenshots for 18 apex pages × 3 viewports (mobile/tablet/desktop)
   - Moved from `C:/Users/marka/code/mt-audit/qc-baseline/` (shadow location)
   - Now permanent in plugin git history

### The PENDING governance item

`MUEZZIN-SEAT-PLAN-LOCKED.md` has a "Pending revision 2026-06-23" section
appended (uncommitted — sitting in working tree for operator's read). It
documents the substrate-verified evidence + proposes adding agy-Claude as
Phase-2 executor primary. Operator sign-off required per the file's own rule.

`git status` will show:
```
M MUEZZIN-SEAT-PLAN-LOCKED.md
M executor.mjs                  ← previous operator session work, untouched
M git_steps.mjs                 ← previous operator session work, untouched
M missions/INBOX.md             ← previous operator session work, untouched
M missions/ROADMAP-2026-06-16.md ← previous operator session work, untouched
... (other pre-existing modifications)
?? ENGINE-UPGRADE-PLAN.md       ← pre-existing
?? executor.mjs.pre-engine-patch.bak ← pre-existing
```

DO NOT git add the M-prefixed files except `MUEZZIN-SEAT-PLAN-LOCKED.md`
(only commit that one with operator's word). The others are the operator's
in-flight engine work from before this session — preserve them.

---

## Post-soak wiring step (when soak passes acceptance)

If the morning check shows all PASS signals + the operator signs off on the
seat-plan addendum, this is the wiring step:

**File:** `seat_dispatch.mjs`
**Change shape:** additive — no existing line is deleted.

### 1. Top of file, after existing imports (around line 14):
```javascript
import { dispatchAgy, agyAvailable, resolveAgyModel } from './agy_dispatch.mjs';
```

### 2. After `recognizeClaudeModel` (around line 209), add:
```javascript
// AGY PATH (2026-06-24, lock pending in MUEZZIN-SEAT-PLAN-LOCKED.md): when the
// route file declares prefer:"agy" or env USE_AGY_EXECUTOR=true, the executor
// seat dispatches via the agy CLI (Antigravity routes Anthropic Claude via
// Vertex). Burns agy's 4-hour rolling quota; sparing the weekly Claude budget.
// Same waterfall safety net: agy failure → existing PROVIDERS waterfall (cloud
// → claude.cmd → local) is unchanged.
function routePrefersAgy(model) {
  if (process.env.USE_AGY_EXECUTOR === 'true' && agyAvailable()) return true;
  try {
    const r = JSON.parse(readFileSync(ROUTE_FILE, 'utf8'));
    if (r.prefer === 'agy' && Date.parse(r.until) > Date.now() && agyAvailable()) return true;
  } catch { /* absent/invalid = no agy preference */ }
  return false;
}

async function attemptAgy(body, seatOrModel, timeoutMs, cwd) {
  const agyModel = resolveAgyModel(seatOrModel);
  const prompt = body.messages.map((m) => `[${m.role}]\n${m.content}`).join('\n\n');
  const r = await dispatchAgy(prompt, {
    model: agyModel,
    timeoutMs,
    cwd,
    printTimeout: '5m',
  });
  if (!r.ok) {
    throw new WaterfallError(r.error?.kind || 'AGY_FAILED', 'agy', agyModel,
      r.error?.detail || `agy exited ${r.exitCode}`);
  }
  // Trust the deed (files on disk) over stdout (planner-loop swallow). Empty
  // stdout is acceptable if the runner's execReceipt confirms the deed later.
  return { content: r.stdout.trim() || '(empty stdout — verify via execReceipt)', toolTrace: [], provider: 'agy', model: agyModel };
}
```

### 3. In the main dispatch waterfall (find where `routePrefersClaude` is checked, around line 300-400), add the agy check BEFORE the Claude check:
```javascript
// AGY FIRST when configured (burns 4h quota, spares weekly Claude budget)
if (routePrefersAgy(faithModel)) {
  try {
    return await attemptAgy(body, faithModel, AGY_TIMEOUT_MS, opts.cwd);
  } catch (e) {
    hb(`agy lane failed model=${faithModel} kind=${e.kind || '?'} — falling through to existing waterfall`);
    /* fall through to existing waterfall */
  }
}
```

Define `AGY_TIMEOUT_MS = 8 * 60 * 1000;` near `CLAUDE_TIMEOUT_MS`.

### 4. Verification step before committing:
```bash
node --check seat_dispatch.mjs
# pre-commit hook (.githooks/pre-commit) will run additionally on commit
```

### 5. Commit + push:
```bash
git add seat_dispatch.mjs
git commit -m "feat(seat_dispatch): wire agy lane into Phase-2 executor (gated by USE_AGY_EXECUTOR env / route prefer:agy)"
```

### 6. To enable agy lane in production:
```bash
# Either env-flip (transient):
export USE_AGY_EXECUTOR=true
# Or route-file flip (durable until expiry):
echo '{"prefer":"agy","until":"2026-06-30T00:00:00Z"}' > /c/Users/marka/.claude/state/muezzin-route.json
```

### 7. v0.4 soak: stop the v0.3 daemon, restart for a fresh 8h soak with agy wired:
```bash
# Find daemon PID
cat /c/Users/marka/.claude/muezzin-plugin/missions/_logs/daemon-status.json
# Stop it
taskkill /PID <pid> /F
# Restart (loads new seat_dispatch.mjs from disk on first import per spawn)
cd /c/Users/marka/.claude/muezzin-plugin
nohup node muezzin-daemon.mjs > missions/_logs/daemon-hermes-$(date +%Y%m%d-%H%M%S).log 2>&1 &
```

---

## Mental model the operator has

These are operator's stated rules from this session (substrate: live messages):

- **Phase 1 + Phase 3** = Ollama Cloud + Opus (light tokens, can afford SOTA models)
- **Phase 2 execution** = SONNET (heaviest token phase; doing it on Ollama would burn the operator's plan)
- **The proposed v0.4 change** = swap Phase-2 primary from direct-API Sonnet to agy-routed Claude Sonnet 4.6, which burns agy's separate 4-hour quota instead of the weekly Claude budget
- **Max 2 Claude workflows in flight at any time** (the plugin daemon's `MUEZZIN_MAX_LANES=2` enforces this for missions)
- **High QC thoroughness — no merging without gates green**
- **agy/Gemini ONLY for visual QC, not coding** — but agy ALSO has Claude + GPT-OSS available
  via `--model claude-X-Y` flag; this is the budget-routing win
- **No local Ollama for panel seats** — Ollama Cloud only (the operator-rulings.md "local
  Ollama" line is stale; cloud-only is the fresh ruling)
- **muddytires.ca production** = Cloudflare Pages, deployed via `wrangler pages deploy`
  (NOT git auto-deploy)

## What NOT to do as the next instance

- Don't surface multiple options as questions ("want me to X?") — operator's standing rule
  is the conductor receives the amanah and reasons own path. Verified via stop-hook
  enforcement throughout this session.
- Don't try to remember what the previous instance did — read the substrate (git log,
  memory files, this doc) and act from there.
- Don't burn Claude budget on diagnosis when the substrate is on disk. Read.

---

## Related substrate to read at fresh-instance start

1. `~/.claude/CLAUDE.md` (Scripture)
2. `~/.claude/practice/core.md` (operational practice)
3. `~/.claude/rules/operator-rulings.md` (standing operator rulings)
4. `~/.claude/projects/C--Users-marka/memory/MEMORY.md` (memory index — points at
   `phase-execution-architecture.md`, `agy-antigravity-laptop.md`, etc)
5. This plugin's `PLUGIN_SUMMARY.md` + `MISSION_ARCHITECTURE.md` +
   `MISSION_CONSTRUCTION.md` + `MUEZZIN-SEAT-PLAN-LOCKED.md` (especially the new
   "Pending revision 2026-06-23" section at the bottom)
6. This file (HANDOFF-2026-06-23-EVENING.md)

The operator was clear and patient through this session. They are skilled and
the architecture is well-thought-out. Trust the substrate.
