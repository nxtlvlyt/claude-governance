NEEDS-WORK

- CLOSED (1): Verdicts now structured JSON with machine-readable gates (BLOCK/REVISE/REJECT/APPROVE) — muezzin enforces programmatically, not prose parsing.
- CLOSED (6): Cross-mission memory — v0.2 explicitly "accumulate verdict patterns + repair heuristics across missions" (M33).
- CLOSED (8): Tamper-evidence — hash-chain added to state-compact sequence.
- CLOSED (9): "Muezzin does no work" — made mechanically true via deterministic enforcer role + restraint charter, not asserted abstraction.
- STILL OPEN (2,3,4,5,7): Correlated-failure detection flagged "GAP — new"; adaptive heal bounded but not validated; context-bloat has mechanism but no proven ceiling; durable-resume explicitly "TEST, don't assume" (untested); adversarial self-test deferred to M33.
- NEW BROKEN: §4 channel rule has collision — "GPU-free → parallel-safe (exempt from serial gate)" vs Ollama Cloud rate limits; no throttle model. §3 "size ceiling" undefined — who measures, what units, split criteria? §2 verdict envelope still lets generative seats write files that seats then "verify" — circular trust if same model family.