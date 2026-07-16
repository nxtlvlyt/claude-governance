# WEBSITE-PACKAGE INTAKE — operator charter, 2026-07-16

## The operator's words (verbatim, ~02:5xZ, recorded same-hour per the GR16 migration-loss lesson)

> "every website we build should have a package that includes the voice, competition
> analysis, monetization motivations, images, videos ect. and this process should be
> automatic. I believe we are getting close. we should be able to get this process so
> good that even a local conductor and models running muezzin could get this done with
> using tools like Sota search firecrawl. ffmpeg, remotion, hyperframes, stitch ect."

Conductor grading: this is a CHARTER (north-star spec), same class as the warroom
intake. It does not jump the standing sequences (gap ruling, N5 pull-forward, agy-100%)
— it names what those sequences are building TOWARD.

## The package (standard contents per site)

| # | Artifact | Status 2026-07-16 | Receipt |
|---|----------|-------------------|---------|
| 1 | VOICE — CONTENT-CONTRACT.md | EXISTS (atv + mt) | committed both repos |
| 2 | LOOK — DESIGN.md + Stitch reference binding | EXISTS (atv; mt has none — recorded honestly in its manifest) | atv DESIGN.md V3; Stitch gen receipted 2026-07-12; ship-half fixed 2026-07-15 |
| 3 | IMAGES — IMAGERY-CONTRACT.md + generation/capture pipeline | EXISTS v1 (atv) | contract committed; OG card generated-rendered-shipped 2026-07-15 |
| 4 | COMPETITORS — text + VISUAL analysis | HALF — text corpus exists (zero imagery data, receipted); Firecrawl live as of tonight adds screenshots/deep-read | firecrawl self-host receipt (scrape HTTP 200); tryout spec in INBOX |
| 5 | MONETIZATION — per-site contract | MISSING as a contract — partial deliverables only (mt affiliate-programs doc) | mt-money-affiliate-programs receipt |
| 6 | VIDEO — HyperFrames pipeline | EXISTS, receipted end-to-end tonight | mt promo v2: capture->storyboard->build->3 gates->render->frame QC->delivered |
| 7 | INDEX — IDENTITY-MANIFEST.md | EXISTS (atv + mt) | committed both repos |
| 8 | GATES — fidelity gate, deploy guards, vision-QC witness | DESIGNED with receipts, landing in flight | fidelity_gate.mjs + deploy-guards.mjs prep deliverables; vision seat blind-test receipt |

## The local-holdability thesis (his core claim, endorsed with receipts)

Every failure class burned this week came from PROSE steps improvised by seats; every
fix that landed came from LITERAL steps + MECHANICAL gates. RULE 16 (landed 2026-07-16)
now refuses prose-scripted steps at lint time. A package pipeline whose every step is
pinned literal + gate-checked is executable by local seats BY CONSTRUCTION — the
receipted proofs: gemma4:12b blind-caught the OG-card defect; the qwen 5/5 relay
audition; the S1/S2/S3 fix-shape (measure -> validate live -> pin -> gate).

## Tool roster (per his word)

SearXNG (find) -> Firecrawl (read/screenshot) -> Stitch (design/generate) -> HyperFrames
+ ffmpeg (video/encode) -> playwright + local vision seat (witness). Remotion: skipped
(HyperFrames is the picked horse; translator exists if ever needed).

## Owner + sequencing

- The PACKAGE SPEC + pipeline mission-chain template = an engine batch item; it BUILDS
  ON N5 items 12/13 (landed/landing) and the in-flight gap fixes; it does not preempt
  them. NOTE: a site-factory repo is referenced in QUEUE laptop-parity notes — the next
  builder MUST inventory it before designing (first law; it may already carry parts).
- MONETIZATION contract template = the one net-new authoring item; charter it alongside
  the package spec.
- This intake is the standing pointer; it changes only by the operator's word.
