export const meta = {
  name: 'gap7-board-truth-drain',
  description: 'Survey + adversarially verify every open DIAGNOSE/false-death item on the muezzin board (gap #7)',
  phases: [
    { title: 'Survey', detail: 'one agent per mission: read its own receipts + verify repo state' },
    { title: 'Refute', detail: 'adversarial check of each survey verdict' },
  ],
}

const ARGS = typeof args === 'string' ? JSON.parse(args) : (args || {})
const STEMS = Array.isArray(ARGS) ? ARGS : (ARGS.stems || [])
if (!STEMS.length) throw new Error('no stems provided')

const BASE = 'C:/Users/marka/.claude/muezzin-plugin'
const MT_REPO = 'C:/Users/marka/code/mt-integration-2026-06-22'

const SURVEY_SCHEMA = {
  type: 'object',
  required: ['stem', 'verdict', 'fixDisposition', 'annotationLine', 'receipts'],
  properties: {
    stem: { type: 'string' },
    verdict: { type: 'string', enum: ['RESOLVED-LANDED', 'GENUINE-FAILED', 'SUPERSEDED', 'ALREADY-ANNOTATED-OK'] },
    fixDisposition: { type: 'string', description: 'MUST start with exactly one of: FIX: (a conductor-performable fix, name it precisely) | pending engine batch: (name the engine class) | SUPERSEDED/RESOLVED: (why). If verdict is ALREADY-ANNOTATED-OK, restate the existing disposition.' },
    annotationLine: { type: 'string', description: 'The exact one-line annotation text to append to the AUTORUN.md comment for this mission, dated 2026-07-07, in the required vocabulary. Empty string if ALREADY-ANNOTATED-OK.' },
    receipts: { type: 'array', items: { type: 'object', required: ['source', 'quote'], properties: { source: { type: 'string' }, quote: { type: 'string' } } }, description: 'At least 2: one from the mission own diagnostics (result.json / retro / events), one from live repo state (git receipt) where the Done-means touches a repo.' },
    landedState: { type: 'string', description: 'For code-repo missions: are the ALLOW-FILES/feature markers present at HEAD of the target repo? Cite the git evidence. n/a otherwise.' },
    performableNow: { type: 'object', required: ['kind', 'detail'], properties: { kind: { type: 'string', enum: ['none', 'requeue-via-fix-ledger', 'cherry-pick', 'one-line-wiring', 'merge-target-branch'] }, detail: { type: 'string' } } },
  },
}

const REFUTE_SCHEMA = {
  type: 'object',
  required: ['refuted', 'reason'],
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
}

phase('Survey')
const results = await pipeline(
  STEMS,
  (stem) => agent(
    `You are surveying ONE failed muezzin mission for a board-truth audit (gap #7). Mission stem: ${stem}
READ-ONLY MANDATE: you may not Write/Edit anything, and any git command in any repo must be read-only (log/show/diff/branch --contains/grep/merge-base). You are gathering evidence for a conductor who will stamp the ledger personally.

Read, in order:
1. The existing AUTORUN annotation: Grep for "${stem}.mission.txt" in ${BASE}/missions/AUTORUN.md (content mode) — the HTML comment on that line is the prior judgment history. If it already contains a disposition in the required vocabulary (a "FIX: <performable fix>" OR "pending engine batch" OR "SUPERSEDED/RESOLVED"), note that — your verdict may be ALREADY-ANNOTATED-OK if nothing material changed since.
2. ${BASE}/missions/${stem}.mission.result.json (if present)
3. Retro files: Glob ${BASE}/missions/_logs/retro/${stem}-*.md and read the newest 1-2
4. ${BASE}/missions/${stem}/mission-events.jsonl — read only the LAST ~50 lines (it can be huge)
5. The mission text ${BASE}/missions/${stem}.mission.txt — extract REPO-ROOT, ALLOW-FILES, Done-means
6. If it is a code-repo mission: verify CURRENT repo state in its REPO-ROOT (usually ${MT_REPO}) — are the Done-means markers / ALLOW-FILES changes present at HEAD? Check for fix commits stranded on TARGET-BRANCH/feature branches (git branch --contains, git log --all --oneline, or by file). NOTE: main and master were both updated + production deployed 2026-07-07, so re-derive from CURRENT HEAD, not from any older note.

Then judge honestly:
- RESOLVED-LANDED: the work is at HEAD (byte/marker receipts) and the FAILED mark is a false death — annotationLine says RESOLVED-LANDED with the receipt.
- GENUINE-FAILED: work absent — fixDisposition MUST name the fix in required vocabulary: "FIX: <exactly what a conductor can do>" or "pending engine batch: <class>". Known classes fixed TODAY that may unblock requeues: inline-eval-mangle (validateMicroQueue now rejects long inline node -e — missions killed by that class are requeue candidates via fix-ledger), rule-9 handrolled-localhost-preview (mission texts being amended today with the wrangler preview-deploy verb).
- SUPERSEDED: purpose achieved by other means (name what).
- ALREADY-ANNOTATED-OK: prior annotation already carries a valid disposition and still holds.
performableNow: if a small receipted action would land already-paid work (e.g. cherry-pick a named sha onto main, add one script tag, requeue via fix-ledger with a landed class fix), name it precisely with the sha/file — the operator approved merges and preview deploys 2026-07-07.
Quote receipts EXACTLY (file:line or sha). Return the structured object only.`,
    { label: `survey:${stem}`, phase: 'Survey', schema: SURVEY_SCHEMA }
  ),
  (survey, stem) => survey && agent(
    `Adversarially refute this board-truth verdict for muezzin mission ${stem}:
${JSON.stringify(survey, null, 1)}
Spot-check its receipts yourself (READ-ONLY: Read/Grep the quoted files, read-only git in ${MT_REPO}). Refute if: a quoted receipt does not exist as quoted, the verdict contradicts current HEAD state, the fixDisposition is not actually performable as named, or an annotationLine would mislead a future conductor (e.g. RESOLVED-LANDED without byte/marker evidence at HEAD). Default refuted=true if you cannot verify the load-bearing receipt. Return refuted plus reason.`,
    { label: `refute:${stem}`, phase: 'Refute', schema: REFUTE_SCHEMA }
  ).then((r) => ({ survey, refute: r })),
)

const clean = results.filter(Boolean)
const upheld = clean.filter((r) => r.refute && !r.refute.refuted).map((r) => r.survey)
const disputed = clean.filter((r) => !r.refute || r.refute.refuted)
log(`${upheld.length} verdicts upheld, ${disputed.length} disputed/unverified of ${STEMS.length}`)
return {
  upheld,
  disputed: disputed.map((r) => ({ stem: r.survey?.stem, verdict: r.survey?.verdict, refuteReason: r.refute?.reason || 'refuter unavailable' })),
}