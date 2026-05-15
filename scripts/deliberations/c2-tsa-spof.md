The session-hash-chain.mjs stop hook computes a rolling SHA-256 hash chain across
the full session transcript and submits the final chain hash to an RFC 3161 Time Stamp
Authority (TSA) to produce a cryptographic timestamp token. The token proves the hash
existed before a specific moment in time and is used as tamper-evident audit trail
infrastructure per IETF draft-sharif-agent-audit-trail and the EU AI Act (Aug 2026).

The current implementation has two distinct failure modes that constitute the C2 concern:

FAILURE MODE 1 — Online but slow/unreliable (serial fallback latency):
The four TSA endpoints are tried in series with an 8-second timeout each:
  freetsa.org → digicert → microsoft → globalsign
Worst case latency if primary is unresponsive: 4 × 8s = 32 seconds added to every session
end. Even partial failures (primary unresponsive, backup slow) compound across sessions.

FAILURE MODE 2 — Fully offline (all TSAs unreachable):
When internet is unavailable, all four TSAs fail and the hook writes FAILED_OPEN:
session ends but with an explicit non-repudiation gap for that session. For the War Room
(the operator's offline fallback CLI), this failure fires on every session by design —
the warroom runs when internet is unavailable. A TSA-dependent audit trail is architecturally
wrong for an offline system.

The current implementation fails open (does not block session end), which is correct
behavior — but the non-repudiation gap means those sessions have no cryptographic
timestamp anchor. For regulatory compliance purposes (EU AI Act) this is a known gap
that needs a concrete resolution path, not just graceful degradation.

Evaluate: What is the right architecture for C2?

Specific questions:

1. PARALLEL TSA (online fix): Should the four endpoints be submitted in parallel
   (Promise.race over all four simultaneously) rather than serially? What is the correct
   timeout for the parallel submission, and what happens if the first response arrives
   but is malformed (body < 10 bytes)?

2. OPENTIMESTAMPS (offline fix): OpenTimestamps (opentimestamps.org) provides Bitcoin-
   blockchain-anchored timestamps. The workflow: (a) hash your data locally and generate
   a .ots commitment file, (b) submit the commitment to an OTS calendar server when
   internet is available, (c) Bitcoin eventually confirms the commitment in a block,
   (d) the .ots file is then independently verifiable against the Bitcoin blockchain.
   Is OpenTimestamps the right offline fallback? What are its trust model, verification
   independence, and operational complexity compared to RFC 3161 TSA?

3. COMBINED DESIGN: Should the fix be: parallel TSA (when online) with OpenTimestamps
   local commitment as offline fallback — or is there a cleaner architecture? Be specific
   about what the session-hash-chain.mjs code change looks like.

4. ZERO-DEPENDENCY CONSTRAINT: session-hash-chain.mjs currently has zero npm
   dependencies (RFC 3161 ASN.1 DER is built as raw Buffer). OpenTimestamps has a
   JavaScript library (javascript-opentimestamps) but it adds a dependency. Is the
   zero-dependency constraint worth preserving, and if so, can the OpenTimestamps
   commitment file be built without the library?

5. WARROOM TRANSLATION: The War Room is an offline-first CLI. Its session audit trail
   should not depend on TSA availability. What design should the warroom implement
   for session integrity when fully offline? Does it differ from the governance repo
   answer, or is it the same pattern applied in Python?

6. MANIFEST FORMAT: The current .hash-chain.json manifest stores one entry per
   transcript line (lh: line hash, ch: chain hash). If we add an OpenTimestamps .ots
   file as a sidecar, should the manifest reference it, or are they fully independent
   artifacts? What is the right file naming convention?

The current implementation is live in hooks/session-hash-chain.mjs.
If the chain recommends a change, be specific about what the replacement code does —
including whether the zero-dependency constraint holds, what the new manifest format
looks like, and how offline detection works (does the hook try TSA first and fall back,
or detect offline state before attempting).

## Substrate Files
hooks/session-hash-chain.mjs

## Search Queries
- OpenTimestamps Bitcoin blockchain timestamp RFC3161 comparison trust model verification 2025 2026
- RFC 3161 TSA parallel submission multiple timestamp authorities redundancy Node.js
- OpenTimestamps javascript library zero dependency pure Node.js ASN.1 commitment file
- EU AI Act August 2026 AI audit trail tamper-evident logging requirements cryptographic
- offline-first audit trail session integrity cryptographic proof without internet connectivity
- OpenTimestamps calendar server .ots file format commitment Bitcoin block confirmation
