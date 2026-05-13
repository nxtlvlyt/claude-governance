# MASTER PLAN: GridironGuru Unified Platform
## Hybrid ML+AI · Market Registry · Autonomous Session Architecture

---

## PART 0 — THE META-PROBLEM (Fix This First)

The docs and substrate are too confusing for autonomous loops. Every session wastes
time re-orienting. This plan fixes the infrastructure that makes all other work possible.

**What breaks autonomous loops:**
- STATE.md has vague "next task" descriptions
- SUBSTRATE.md has 20+ wires with statuses that don't reflect reality ("built" vs "deployed")
- Docs contradict each other across ROADMAP, SUBSTRATE, STATE, and PROJECT_SUBSTRATE folder
- No definition of "done" — I can't verify if a wire is truly complete
- No ordered work queue — I can't pick up where the last session ended without reading 5 files

**The fix: three documents do everything**

```
STATE.md        → What to build RIGHT NOW. One task. Unambiguous.
SUBSTRATE.md    → All wires. Machine-readable status. Dependency order. Done criteria.
QUEUE.md        → Ordered list of READY wires. I execute top-to-bottom. No decisions needed.
```

Everything else (ROADMAP, LLM_AUTONOMY_CONTEXT, blueprints) is reference only. I read
STATE.md first, then QUEUE.md, then build. That's the autonomous loop.

---

## PART 0A — New Document Architecture

### STATE.md (redesigned)
```markdown
# STATE.md

## CURRENT TASK
Wire: W21
Status: IN_PROGRESS
Started: 2026-04-17
What to build: shared/sportAdapter.ts + shared/marketRegistry.ts
Done when: /api/mlb/games response feeds through MLB adapter without data loss.
  All 9 MLB markets render in SportGameCard using MarketRegistry.
  Confidence values 0-100, linePick.formatted never reconstructed in UI.

## LAST COMPLETED
Wire: W08 (Home Bias Bug)
Commit: ab517a1
Verified: nfl-v2-rare-edge renders correct team + sign. Edge shows 7.6% not 760%.

## BLOCKED
Nothing blocked.

## DEPLOY STATUS
Commit db3c3eb (MLB SOTA) — staged, needs: bash /volume1/web/cgsports/deploy.sh
Commit ab517a1 (W08 fix) — staged, needs same deploy

## SESSION PROTOCOL
1. Read STATE.md (this file) — 30 seconds
2. Read QUEUE.md — know the next 5 wires in order
3. Build current task. Update STATE.md when done.
4. Pick next wire from QUEUE.md. Repeat.
5. Session end: update STATE.md current task + QUEUE.md status
```

### SUBSTRATE.md (redesigned wire format)
Each wire gets a machine-readable block:

```markdown
## W21 — Unified Sport Adapter + Market Registry
Status: READY
Files: shared/sportAdapter.ts, shared/marketRegistry.ts
Depends on: W01 (schema exists)
Unlocks: W22, W23, SportGameCard, SportRareEdge
Done when:
  - [ ] normalizeConf unit test passes (0.75→75, 75→75, never 7500)
  - [ ] resolveTeam('Home', 'KC', 'DAL') === 'KC'
  - [ ] formatLinePick('KC', -7.5).formatted === 'KC -7.5'
  - [ ] MLB adapter: /api/mlb/games feeds through, all 9 markets in MarketRegistry render
  - [ ] SportGameCard renders MLB games without hardcoded field names
Build estimate: 1 session
```

Status values (machine-readable):
- `READY` — all dependencies met, build now
- `IN_PROGRESS` — current session
- `BLOCKED:W##` — waiting on specific wire
- `DONE` — done criteria verified ✓
- `PLANNED` — not ready yet, dependencies pending

### QUEUE.md (the autonomous work queue)
```markdown
# QUEUE.md — Ordered Work Queue

Execute top-to-bottom. Each wire is READY when you reach it.
Update status when done. Pick next.

1. [DEPLOY] Run deploy.sh on NAS — ships db3c3eb + ab517a1
2. [W21] Sport Adapter + Market Registry
3. [W22-L1] AnythingLLM client + contextual adjustments (Python)
4. [W22-L2] SportAiService (Gemma 4 commentary, all sports)
5. [W22-L3] ComfyUI prompt generator (sport card art from picks)
6. [W22-L4] Whisper + Gemma picks extractor (voice → structured data)
7. [W22-L5] Grading pattern analysis (model drift detection)
8. [W22-L6] Rare Edge validator (pre-flag quality check)
9. [W22-L7] Line movement interpreter (sharp money detection)
10. [W23] Hygen sport scaffolding templates
11. [SPORTS] NHL adapter → NBA adapter → NFL V2 adapter
12. [UI] SportGameCard → SportRareEdge → SportAnalytics
13. [MLB-BACKFILL] python3 backfill_mlb_historical.py --seasons 2024,2025
14. [W08-DOCS] Update SUBSTRATE W08 → DONE, add W21/W22/W23
```

---

## PART 1 — All Hybrid Tools (Complete List)

Gemma 4 31b amplifies any tool that produces structured output or takes complex input.

### Category A: Prediction Pipeline (cgsports)

**A1. Python ML prediction scripts** *(in plan)*
- Tool: XGBoost (NFL/NBA), Poisson+Bayesian (MLB/NHL)
- Gemma adds: contextual confidence adjustment via AnythingLLM RAG
- File: `python_backend/get_contextual_adjustments.py`

**A2. Data scrapers** *(W02 — currently brittle)*
- Tool: DOM scrapers for game data, Odds API fetchers
- Gemma adds: failure diagnosis before repair pipeline
  - Reads error log → identifies root cause ("Covers.com changed CSS class")
  - Writes targeted repair brief → Level 2/3 pipeline executes it
  - Result: repair loop goes from hours to minutes
- File: `python_backend/scraper_diagnostics.py`

**A3. Grading service**
- Tool: Grades ML/line/total predictions against final scores
- Gemma adds: pattern analysis after each grading pass
  - "Lost 7 of last 10 NHL P2 totals on back-to-back home games"
  - Returns structured insight → stored → feeds into next prediction's confidence
  - Automated model drift detection without manual review
- File: `python_backend/grading_pattern_analyzer.py`

**A4. Rare Edge scoring**
- Tool: Rule-based threshold (75%+ conf AND 10%+ edge)
- Gemma adds: pre-flag quality validation
  - Is the line moving in this pick's direction? (sharp money confirming)
  - Has the model been right in similar game contexts historically?
  - Only flags as Rare Edge if Gemma also agrees it's genuine
  - Makes Rare Edge actually rare and actually valuable
- Method: `rareEdgeService.validateWithGemma(pick)`

**A5. Odds API line movement**
- Tool: Snapshots current odds for edge calculation
- Gemma adds: opening-to-closing line movement interpretation
  - Detects significant movement (>1.5 points in 24hr)
  - Interprets direction: "Steam move — sharp money on home team"
  - Adds `lineMovementSignal` to CommonPrediction
  - When model and line movement agree → confidence boost
- File: `server/services/lineMovementService.ts`

**A6. Live Ticker (W14)**
- Tool: Score polling, game status updates
- Gemma adds: in-game narrative commentary as scores update
  - "Up 2-0 after P1 — puck line still alive, model liked home team, tracking"
  - Generates at score change events, not on a timer
- Method: `sportAiService.generateLiveUpdate(sport, score, prediction)`

**A7. Analytics endpoint**
- Tool: Returns win rate numbers per market
- Gemma adds: weekly performance article in character voice
  - Reads win rate data → writes narrative summary
  - "Sultan's Week 14 Diamond Report: 73% on run lines this week..."
  - Generated on-demand or scheduled weekly
- Route: `GET /api/mlb/analytics/weekly-report`

### Category B: Media Pipeline (NxTLvL)

**B1. ComfyUI / Flux image generation**
- Tool: Generates images from text prompts
- Gemma adds: automatic prompt generation from sport context
  - Input: sport, teams, character name, pick direction, confidence tier
  - Output: optimized Flux prompt for sport card art
  - Result: picks automatically get artwork without manual prompting
  - Gemma also validates generated image quality by describing what it sees
- File: `python_backend/sport_card_prompt_generator.py`

**B2. Whisper ASR**
- Tool: Transcribes audio to text
- Gemma adds: structure extraction from transcriptions
  - Voice dictated: "I like the Lakers -4.5 tonight, 70% confidence, Sultan play"
  - Gemma extracts: `{ sport: 'nba', pick: 'LAL -4.5', confidence: 70, predictor: 'sultan' }`
  - Enables voice → structured betting slip workflow
- File: `python_backend/voice_picks_extractor.py`

**B3. SearXNG**
- Tool: Self-hosted web search
- Gemma adds: sports context interpretation
  - Query: "Bills WR corps injury news today"
  - Gemma reads results → extracts structured impact: `{ impact: 'negative', confidence_adj: -5 }`
  - Feeds into prediction pipeline as additional contextual signal
- File: `python_backend/sports_news_interpreter.py`

**B4. Social content pipeline**
- Tool: Generates social posts and content
- Gemma adds: sport-specific picks content
  - Daily picks summary (in character voice) from prediction data
  - Post-game analysis when picks grade out
  - Weekly record summary
  - Auto-formats for Twitter/X length constraints
- File: `server/services/sportsContentService.ts`

### Category C: Platform Intelligence

**C1. Guardian task queue**
- Tool: Processes `.md` task files in C:\orchestrator\queue\
- Gemma adds: task specification validation and decomposition
  - When Mark drops a complex task, Gemma breaks it into properly-scoped sub-tasks
  - Validates completed tasks meet acceptance criteria before marking done
  - Writes the `.md` file format correctly with all required fields
- Integration: Guardian calls Gemma before and after each task

**C2. Python backfill scripts**
- Tool: Imports historical sports data
- Gemma adds: data quality validation during import
  - Flags values that look wrong ("NBA team scored 200 points — outlier?")
  - Detects schema gaps ("no data for 2020-21 NBA bubble games")
  - Suggests alternative sources when primary API fails
- Method: `validate_import_batch(records) → { valid, flagged, errors }`

**C3. AnythingLLM ingestion**
- Tool: RAG knowledge base (W19)
- Gemma adds: automatic content ingestion from sports news
  - SearXNG finds relevant article → Gemma summarizes → AnythingLLM stores
  - Knowledge base stays current without manual curation
  - Enables richer contextual adjustments in prediction pipeline

---

## PART 2 — Technical Architecture

### Full Pipeline (updated)
```
┌──────────────────────────────────────────────────────────────────────┐
│  PREDICTION PIPELINE (per game)                                       │
│                                                                       │
│  1. Odds API → game data + current lines + line movement history     │
│                                                                       │
│  2. [A5] Line movement: Gemma interprets opening→closing shift       │
│     Output: lineMovementSignal (confirming/contradicting/neutral)    │
│                                                                       │
│  3. Python ML model → base probability                               │
│     XGBoost (NFL/NBA) | Poisson+Bayesian (MLB/NHL)                  │
│                                                                       │
│  4. [A1] AnythingLLM RAG → contextual query (8s timeout)             │
│     + [B3] SearXNG injury/news search (8s timeout, parallel)        │
│     Gemma interprets both → structured confidence adjustments        │
│                                                                       │
│  5. Blend: final_conf = base_conf + contextual_adj + movement_adj   │
│     Bounds: never below 40, never above 95                           │
│                                                                       │
│  6. [A4] Rare Edge validator: if pick meets threshold, Gemma checks  │
│     "is this genuinely rare or just a threshold artifact?"           │
│                                                                       │
│  7. Gemma 4 31b → per-market narrative (15s timeout)                 │
│     Narrates FINAL picks (post-adjustment), not base model output    │
│                                                                       │
│  8. CommonPrediction → API → MarketRegistry → UI                    │
│                                                                       │
│  Non-blocking: steps 2,4,6,7 fail gracefully. Base picks ship.      │
└──────────────────────────────────────────────────────────────────────┘
```

### Market Registry
```typescript
// shared/marketRegistry.ts
// Markets are data. Game card renders any market generically.
// Adding a market = one object. No component changes.

export interface Market {
  id: string; label: string; group: string;
  pickField: string; confField: string;
  edgeField?: string; resultField?: string;
  accentColor?: string; showLine?: boolean; lineField?: string;
}
// One registry per sport. SportGameCard renders from it.
```

### SportAdapter
```typescript
// shared/sportAdapter.ts
interface SportAdapter<TPred, TGame> {
  sport: Sport;
  lineLabel: string;
  confidenceScale: '0-1' | '0-100'; // declared, never inferred
  markets: Market[];
  toCommonGame(raw: TGame): CommonGame;
  toCommonPrediction(pred: TPred, game: CommonGame): CommonPrediction;
}
const normalizeConf  = (raw: number, scale: '0-1' | '0-100') => scale === '0-1' ? raw * 100 : raw;
const resolveTeam    = (pick: string, home: string, away: string) => pick === 'Home' ? home : pick === 'Away' ? away : pick;
const formatLinePick = (team: string, line: number) => ({ team, line, formatted: `${team} ${line > 0 ? '+' : ''}${line}` });
```

### SportAiService (all Gemma integrations)
```typescript
// server/services/sportAiService.ts
class SportAiService {
  // A1: Contextual confidence adjustment
  async getContextualAdjustment(sport, game, basePicks): Promise<ConfidenceAdjustment>

  // A2: Scraper failure diagnosis
  async diagnoseScraper(error, sport): Promise<RepairBrief>

  // A3: Grading pattern analysis
  async analyzeGradingPatterns(sport, recentGrades): Promise<PatternInsight[]>

  // A4: Rare Edge pre-validation
  async validateRareEdge(pick, sport): Promise<{ genuine: boolean; reasoning: string }>

  // A5: Line movement interpretation
  async interpretLineMovement(opening, current, sport): Promise<LineMovementSignal>

  // A6: Live game commentary
  async generateLiveUpdate(sport, score, prediction): Promise<string>

  // A7: Weekly performance article
  async generateWeeklyReport(sport, stats): Promise<string>

  // B1: Sport card image prompt
  async generateImagePrompt(sport, game, pick, tier): Promise<string>

  // All methods: 15s timeout, non-blocking, fail gracefully
}
```

---

## PART 3 — New Wire Definitions

**W21 — Unified Sport Adapter + Market Registry**
- Files: `shared/sportAdapter.ts`, `shared/marketRegistry.ts`
- Status: READY (no blockers)
- Unlocks: W22, W23, SportGameCard, SportRareEdge, SportAnalytics

**W22 — Hybrid ML+AI Service (all Gemma integrations)**
- Files: `server/services/sportAiService.ts`, `python_backend/get_contextual_adjustments.py`,
  `python_backend/sport_card_prompt_generator.py`, `python_backend/voice_picks_extractor.py`,
  `python_backend/sports_news_interpreter.py`, `python_backend/grading_pattern_analyzer.py`,
  `python_backend/scraper_diagnostics.py`
- Status: READY after W21
- Sub-wires in order: L1 (context adj) → L2 (commentary) → L3 (ComfyUI) → L4 (Whisper) → L5 (grading patterns) → L6 (rare edge) → L7 (line movement)
- Unlocks: W19 activation, W20 activation, content pipeline, voice workflow

**W23 — Sport Scaffolding (Hygen)**
- Files: `_templates/sport/new/` (10 templates)
- Status: READY after W21
- Unlocks: new sport in <4 hours (vs 2-3 days)

---

## PART 4 — Session Protocol (autonomous loop design)

Every session follows this exactly. No deviation needed.

```
SESSION START:
  1. Read STATE.md — 30 seconds. Know current task.
  2. Read QUEUE.md — know next 3 wires in order.
  3. Verify: is current task still unblocked? If not, take next READY item from queue.
  4. Build. Update files. Test where possible.
  5. When task done: mark QUEUE.md item complete, update STATE.md.

SESSION END:
  - STATE.md: update CURRENT TASK to next wire
  - SUBSTRATE.md: update wire status (IN_PROGRESS → DONE or next wire → IN_PROGRESS)
  - QUEUE.md: mark completed item, show next 3 ready
  - Commit all changes with clear message

AUTONOMOUS LOOP TRIGGERS (when I can keep going without input):
  - Wire has clear DONE criteria I can verify
  - No deploy needed (all code changes, no NAS restart required)
  - No credentials/keys needed that aren't already in .env

PAUSE POINTS (when I should stop and wait for Mark):
  - Deploy needed (bash deploy.sh — Mark runs this)
  - New API key or credential needed
  - Architectural decision that contradicts existing docs
  - Wire marked BLOCKED in SUBSTRATE.md
```

---

## PART 5 — Implementation Order (the QUEUE.md)

```
IMMEDIATE (this session after plan approval):
  [ ] 0. Restructure STATE.md, SUBSTRATE.md, create QUEUE.md
  [ ] 1. W21: shared/sportAdapter.ts + shared/marketRegistry.ts
  [ ] 2. MLB adapter (reference implementation)
  [ ] 3. python_backend/anythingllm_client.py
  [ ] 4. python_backend/get_contextual_adjustments.py
  [ ] 5. Wire hybrid pipeline into generate_mlb_prediction.py

NEXT SESSION:
  [ ] 6. server/services/sportAiService.ts (all Gemma methods)
  [ ] 7. SportGameCard — MarketRegistry driven
  [ ] 8. SportRareEdge — CommonRareEdgePick
  [ ] 9. Wire MLB pages to new components

FOLLOWING SESSIONS:
  [ ] 10. NHL adapter → NBA adapter → NFL V2 adapter
  [ ] 11. Swap each sport to unified components
  [ ] 12. python_backend/sport_card_prompt_generator.py (ComfyUI)
  [ ] 13. python_backend/voice_picks_extractor.py (Whisper)
  [ ] 14. python_backend/grading_pattern_analyzer.py
  [ ] 15. python_backend/scraper_diagnostics.py
  [ ] 16. Hygen scaffolding templates
  [ ] 17. Update all docs (SUBSTRATE W21/W22/W23, ROADMAP, LLM_AUTONOMY)
```

---

## Files Created/Modified

| File | Action | Wire |
|------|--------|------|
| `N:/cgsports/STATE.md` | REDESIGN — machine-readable format | Meta |
| `N:/cgsports/SUBSTRATE.md` | REDESIGN — done criteria per wire | Meta |
| `N:/cgsports/QUEUE.md` | NEW — ordered work queue | Meta |
| `shared/sportAdapter.ts` | NEW | W21 |
| `shared/marketRegistry.ts` | NEW | W21 |
| `server/services/sportAiService.ts` | NEW | W22 |
| `python_backend/get_contextual_adjustments.py` | NEW | W22-L1 |
| `python_backend/anythingllm_client.py` | NEW | W22-L1 |
| `python_backend/sport_card_prompt_generator.py` | NEW | W22-L3 |
| `python_backend/voice_picks_extractor.py` | NEW | W22-L4 |
| `python_backend/grading_pattern_analyzer.py` | NEW | W22-L5 |
| `python_backend/scraper_diagnostics.py` | NEW | W22-L2 |
| `python_backend/sports_news_interpreter.py` | NEW | W22 |
| `client/src/components/SportGameCard.tsx` | NEW | W21 |
| `client/src/components/SportRareEdge.tsx` | NEW | W21 |
| `client/src/components/SportAnalytics.tsx` | NEW | W21 |
| `_templates/sport/new/` (10 files) | NEW | W23 |
