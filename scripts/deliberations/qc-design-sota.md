# Deliberation: is our automated video-editing QC design SOTA + complete? (the cornerstone)

The QC is THE cornerstone of the autonomous editor — the 90%-or-it's-slop bar rides entirely on it (without it, the
machine ships slop and a human catches everything). We built a deterministic v1 (`qc_check.py`) that caught 3/4
operator-found flaws. This deliberation must pressure-test its DESIGN to SOTA — challenge it, research the real state of
the art, do not rubber-stamp.

## WHAT WE BUILT (v1 — under review)
`qc_check.py`: deterministic, no-LLM, 7 checks, each emits PASS/FAIL + clip + timecode + severity, 0–100 score:
1 HORIZON_LEVEL (Hough on sky/treeline band), 2 STITCH_SEAM (viewport-vs-seam ±90 + seam-artifact height-continuity),
3 HARD_CUTS (scene-cut list, hard-vs-dissolve), 4 CONTENT_REPEAT (transcript topic similarity), 5 WRONG_DAY (clip
capture-date vs target day), 6 STABILITY (inter-frame motion/jerk), 7 BASICS (black frames, audio present, duration).
Validated on the shipped sample: scored 20/100 FAIL, caught wrong-day + hard-cut + coffee-repeat with timecodes; also
surfaced that the RENDER didn't match the EDL (viewport aimed at the windshield, not the described interior subject).

## DESIGN PHILOSOPHY (under review — from prior moat deliberation)
MEASUREMENT-FIRST: lean on deterministic checks (reliable), use a DIVERSE multi-model vision panel only for the subjective
remainder (local models are weak at subjective taste; the moat chain warned not to lean on model-judgment).

## THE QUESTIONS (answer each, research-backed)
1. **COMPLETENESS** — what quality DIMENSIONS is the 7-check list missing? Candidates to weigh: composition/framing,
   exposure/color, audio quality (clipping, levels, music-vs-voice balance), pacing/rhythm, hook strength, engagement,
   caption legibility/safe-zone, music sync, narrative coherence, and the "VIEWPORT-AIMED-WRONG / subject-not-in-frame"
   class (the root of the operator's #1 complaint — render doesn't show the subject). Which are must-haves for ≥90%?
2. **SOTA RESEARCH** — what is the actual state of the art in AUTOMATED VIDEO QUALITY ASSESSMENT we should adopt or learn
   from? (e.g. VMAF, no-reference VQA models, aesthetic/quality scoring nets, LLM-as-video-judge, shot-quality metrics).
   Are we reinventing something that exists? What's adoptable LOCALLY (no frontier)?
3. **DETERMINISTIC vs VISION split** — is measurement-first correct? Which dimensions MUST use a vision model (e.g.
   subject-in-frame, composition, "is this the right angle"), and how to make those reliable (diverse panel? thresholds?).
4. **SCORING + GATE** — how should the 0–100 score + the 90% bar work? Weighting, hard-fail (any critical) vs soft,
   the gate logic that feeds the recut loop. Avoid both rubber-stamping AND infinite-loop false-fails.
5. **THE SUBJECT/ANGLE CHECK** — how does the QC verify a 360 cut actually SHOWS its subject (not the windshield)? This is
   the operator's central complaint and the make-or-break for 360 quality. Deterministic, vision, or both?
6. Honest: where will this QC still FAIL to see what a human sees, and is that acceptable for v1→ship while we iterate?
Return the standard verdict JSON schema; nemotron also empirical_gaps.

## Substrate Files
- C:\Users\marka\llama.cpp\qc_check.py
- C:\Users\marka\llama.cpp\dji_test\UNIVERSAL_EDITOR_HANDBOOK.md
- C:\Users\marka\llama.cpp\dji_test\EDITOR_ROADMAP.md

## Search Queries
- automated video quality assessment SOTA no-reference VQA model 2026
- VMAF perceptual video quality metric automated editing QC
- AI video editing quality control detect bad cuts framing automatically 2026
- LLM as video judge automated aesthetic quality scoring local model
- 360 video reframe subject tracking is subject in frame detection automated
