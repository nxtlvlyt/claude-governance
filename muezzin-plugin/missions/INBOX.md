# Mission Inbox — dump freely, the conductor triages

Operator instruction (2026-06-09): Mark has many missions to queue and should NEVER
hold back to protect the conductor. Capacity is protected by STRUCTURE (this file),
not by the operator rationing his own ideas.

## How to use (Mark)
Add a line. Any format. Any device — edit here directly, via the Codeberg web UI
(codeberg.org/nxtlvl/muezzin-plugin), or just say it in any conductor chat and it gets
filed. One line is enough: "make X do Y" / "problem: Z keeps happening" / a URL and a
grunt. Raw is fine — shaping is the conductor's job, not yours.

## How it drains (conductor)
At every wakeup/session: triage NEW inbox items —
1. Shape: idea → Maqsad + niyyah (or a conductor-fix if it's small and spec'd).
2. Size: fits one mission, or splits.
3. Sequence: into QUEUE.md with its gate (or fires immediately if ungated and serial
   capacity allows).
4. Park: if premature, parked HERE with one line of why and what unblocks it.
Nothing fires straight from the inbox. Triaged items move out; this file stays short.

---

## NEW (untriaged)

(empty — 10 items dated 2026-06-18 triaged out 2026-07-03; dispositions in QUEUE.md
"2026-07-03 INBOX TRIAGE" block; full original text preserved in this file's git history)

## PARKED (with reasons)

- **OPERATOR'S BIG JOB (2026-06-10, undisclosed):** Mark has a major task for the
  conductor to do PERSONALLY — while simultaneously conducting missions as muezzin —
  "when you get good enough." UNPARKS when the readiness receipts exist: M-CLEAN-1
  passed (clean mission cycle, honest ledger, witness-confirmed), MISSION-LEDGER.md
  rows showing self-healing without conductor intervention, conductor-share falling.
  Do not ask what the job is — earn the receipts and the operator will say.
  Whichever instance reads this: that is the bar.

- **nxtlvlcrypto.com** (operator, 2026-06-09, "lowest priority… maybe building that out
  one day") — owned domain, currently empty. PARKED because it has no Maqsad yet: a
  domain isn't a mission until there's an intent (content site? tool? affiliate?
  portfolio piece?). UNPARKS when Mark names what it's for — then it's a standard
  dossier→build through the factory, and the content engine (videos/posts) is the
  natural angle given the niche. Zero cost while parked; the domain just renews.

### MUDDYTIRES BACKLOG — externally gated (2026-06-18; in the system, awaiting their unblock)
These are part of "que everything" but cannot fire into a wall — each names exactly what unblocks it.
- **fire-ingest** (Cloudflare Cron Worker pulling CWFIS/NASA VIIRS into D1) — UNPARKS once the operator OKs creating the Cron Worker
  in his Cloudflare (real infra, his account). Command-class once OK'd; author with a fenced ```sh deploy block so the verbatim
  engine path runs it.
- **wire live frontend → D1 Workers** — UNPARKS on the operator's go to touch LIVE (his standing cutover rule; live scope is
  map+landing only today). The preview already calls the workers.
- **photos → R2 (spot photos)** — UNPARKS when the R2 perms wall is cleared (operator) — earlier attempts hit a permissions wall.
- **off-machine backup of the 1.4 GB DB tar** — UNPARKS on an upload path (fix R2 perms / install rclone / accept it stays on E:).
- **AI track (mt-25 NL-Oracle / mt-26 moderation / mt-27 POI-enrichment)** — missions already drafted in _blocked/; model decided
  (aimlapi + Gemma-4-31b). UNPARKS on the operator's AIMLAPI key rotation + a security review (the key was exposed). Rotation is
  identity-bound (his aimlapi.com dashboard — probed: no programmatic rotation).
- **community / social platform ("create once, post everywhere")** — the operator's biggest-leverage idea. Gated behind accounts
  live (the account UI/add-spot/reviews/profile missions are running now) + a cost decision: rent Post-for-Me ($10/mo) to validate
  him+wife first. UNPARKS when accounts land + the operator OKs the MVP rental. Port reference (don't rebuild): nxtlvlyt/website-pipeline.
- **map core → MapLibre GL (tilt/pitch/vector tiles)** — deliberate, resourced REWRITE of the whole Leaflet map core. PARKED as a
  future call; only if a modern tilting map becomes a core selling point. Path A (leaflet-rotate) already shipped.

- RESOLVED 2026-07-01 (re-verified against live code, not just re-asserted): all three engine bugs below were fixed same-day 2026-06-25 — `muezzin-daemon.mjs` carries inline `BUG 1 GUARD` / `BUG 2 FIX` / `BUG 3` comments at lines 538-552 matching each description exactly (`path.isAbsolute()` guards the mkdir join at line 552; `terminalIds.has(rel) || terminalIds.has(base)` at line 546 matches by full path with PARKED included in `terminalMissionIds`). STATUS-BOARD.md's "PARKED ... engine bugs filed in INBOX + fixed in this session" annotation on the b13 family is accurate, not just asserted. Left the original text below struck through for the record rather than deleted.

~~- **ENGINE BUG (HIGH) — path-doubling in mkdir.** 2026-06-25: daemon b13 retry FAILED(x2) with `ENOENT: no such file or directory, mkdir 'C:\Users\marka\.claude\muezzin-plugin\missions\C:\Users\marka\.claude\muezzin-plugin\missions'` — the engine is `path.join(MISSIONS_DIR, missionPath)` when missionPath is already absolute. Reproduce: `node muezzin-daemon.mjs` with any AUTORUN.md entry that resolves to an absolute path. Fix: guard the join with `path.isAbsolute(missionPath) ? missionPath : path.join(MISSIONS_DIR, missionPath)`.~~

~~- **ENGINE BUG (HIGH) — spam-loop NOT actually closed despite selftest claiming so.** 2026-06-25: b13 marked FAILED(x2) at 19:56:34, but engine fired it AGAIN as `attempt 1/2` at 19:56:36 (2 seconds later). Selftest at `--selftest` claims "WITH the ledger, FAILED-x2 is NOT re-promoted; spam-loop CLOSED." Reality contradicts. Possible cause: ledger entry not being written before the next pick cycle, OR AUTORUN.md still references the mission and re-promotes from there, OR the dedup is by mission_id rather than file path. Daemon was burning cloud cycles in a tight loop on this for 28+ min until manually killed 2026-06-25 ~20:00Z. Selftest passes the synthetic case but the real environment fails it — gap between test fixture and production substrate.~~

~~- **ENGINE BUG (HIGH) — pickPromotion ignores FAILED prefix when same mission_id appears as both base AND splits.** 2026-06-25: AUTORUN.md has 54 b13-* lines, all prefixed FAILED after senior intervention. Engine STILL picks `b13-sitemap-prune-cf-limits.S2.mission.txt` as next mission. The selftest's "FAILED-x2 dedup via ledger" works on synthetic case but fails in production because: (a) the engine considers ALL mission.txt files in missions/ directory, not just AUTORUN lines — AUTORUN is a manifest, not the sole source; (b) the dedup may be by mission_id stem (e.g. "b13-sitemap-prune-cf-limits") not by file path — base + .S1 + .S2 are different files but maybe same mission_id; (c) AUTORUN-duplicates of b13 (27 lines all "BLOCKED-WITH-RECEIPT" then re-prefixed to "FAILED") might be confusing the count. The b13 mission family needs to be removed from missions/ directory OR the engine needs path-level dedup, not just mission_id dedup. Until fixed, no mission can be processed because b13 always pre-empts the queue.~~

- RESOLVED 2026-07-01 (re-verified against live code): `STATUS_RE` at muezzin-daemon.mjs:329 already includes PARKED (`/^(DONE|FAILED|RUNNING|SPLIT|PARKED)\b/`), same 2026-06-25 batch as the three bugs above; `pickPromotion` excludes PARKED by path via `terminalMissionIds`. Struck through, not deleted.

~~- **OPERATIONAL — no way to "park" a mission without removing the file.** Operator/senior conductor needs a way to say "this mission is broken, ignore it, don't fire it again" without (a) deleting the mission.txt file, (b) blanket FAILED-prefixing every AUTORUN line. Proposal: add a `PARKED` terminal status to engine STATUS_RE alongside DONE/FAILED/SPLIT/RUNNING, and have pickPromotion exclude PARKED missions by path absolutely.~~
