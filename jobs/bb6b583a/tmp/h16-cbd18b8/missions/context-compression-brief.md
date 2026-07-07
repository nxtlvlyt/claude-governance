# RESEARCH BRIEF — Context Compression / Token Optimization for the Muezzin Orchestrator
Date issued: 2026-06-11 · Supplied by the operator, stored verbatim as mission substrate
for context-compression-research.mission.txt. SOURCE MANIFEST ONLY — every claim below
is vendor/aggregator-claimed until independently verified per §6.

## 0. Mission for the researching agent
Evaluate whether a context-compression layer should sit anywhere in the muezzin mission
pipeline (seat dispatch, witness panels, retro corpus, heartbeat/beat reports), and if
so, where. Constraints:
- Verification-integrity (non-negotiable): any lossy transform upstream of fabrication
  detection or witness verification can cause false strikes. Establish, per tool,
  exactly what is altered, when, and whether originals are retrievable deterministically.
- License: commercial use required. Read the actual LICENSE file, not the badge.
- Local-first: no paid APIs at runtime; hosted compression services disqualified at
  runtime but may be studied for technique.
Output: ranked recommendation with an explicit "do not compress" boundary.

## 1. Primary tools / repos (verify each)
### 1.1 Headroom — chopratejas/headroom
- Repo: https://github.com/chopratejas/headroom · Docs: https://headroom-docs.vercel.app/docs
- llms.txt: repo /llms.txt + https://headroom-docs.vercel.app/llms-full.txt
- Model: https://huggingface.co/chopratejas/kompress-base
- CLAIMED: 60-95% reduction; library/proxy/MCP/wrap-claude modes; ContentRouter →
  SmartCrusher (JSON) → CodeCompressor (AST) → Kompress-base (prose); CacheAligner;
  CCR reversible compression (headroom_retrieve); cross-agent memory; headroom learn.
  Apache 2.0 badge.
- VERIFY: CCR byte-identical retrieval? proxy treatment of tool_use/tool_result;
  compression vs hooks ordering; /docs/benchmarks methodology; /docs/limitations;
  LICENSE + NOTICE. Star-count discrepancy: aggregator ~22k vs GitHub ~16.3k (2026-06-11).
### 1.2 RTK — rtk-ai/rtk
- Repo: https://github.com/rtk-ai/rtk · Site: https://www.rtk-ai.app/
- CLAIMED: Rust binary CLI proxy; filters 100+ dev command outputs pre-LLM; 60-90%
  savings; <10ms; failure → full output saved to disk; hooks only Bash tool calls
  (native Read/Grep/Glob untouched).
- VERIFY: license; which integrations rewrite commands; stderr/exit codes; disk path/
  retention; Windows behavior; rtk discover.
- Secondary: https://dev.to/arshtechpro/how-rtk-reduces-llm-token-usage-for-ai-coding-agents-2kfd
### 1.3 LeanCTX — yvgude/lean-ctx
- Repo: https://github.com/yvgude/lean-ctx · Releases: /releases · Site: https://leanctx.com/
- CLAIMED: Rust local-first context-intelligence layer; 10 read modes (~13-token cached
  re-reads); session memory; property-graph code intel; MCP (~69-76 tools, varies);
  shell-hook compression; PathJail; allowlist; secret redaction; audit trail;
  Context Proof (ctx_proof/ctx_verify, 4-layer engine); savings ledger; ctx_url_read;
  full reversibility via ctx_retrieve. Positions one layer deeper than Headroom.
- VERIFY: license; what ctx_proof/ctx_verify actually prove (overlaps the muezzin
  witness model — relevant beyond compression); byte-identical guarantees; ledger
  auditability.
### 1.4 Microsoft LLMLingua — microsoft/LLMLingua
- CLAIMED: up to 20x; LLMLingua (EMNLP'23), LongLLMLingua (ACL'24, +21.4% RAG at 1/4
  tokens), LLMLingua-2 (distilled BERT-level classifier, 3-6x faster). LangChain/
  LlamaIndex integrations.
- VERIFY: MIT badge vs LICENSE; model weight licenses separately; CPU/local viability;
  faithfulness at aggressive ratios.
### 1.5 PCToolkit — https://arxiv.org/pdf/2403.17411
- Benchmark harness (Selective Context, LLMLingua, LongLLMLingua, SCRL, KiS). Find repo;
  use as evaluation rig before adoption.

## 2. Provider-native mechanisms (Anthropic — the no-dependency baseline)
- Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Context editing: https://platform.claude.com/docs/en/build-with-claude/context-editing
- Compaction (server-side recommended) — same doc + contexts section
- Memory tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- Cookbook (runnable, ~320K test corpus): https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools
- VERIFY: cache-invalidation triggers (tool_choice, images, JSON key-order); what
  compaction preserves/drops. Compaction × verdict-pipeline interaction is unstudied —
  produce that analysis.

## 3. Research papers
- Context Codec (May 2026): https://arxiv.org/abs/2605.17304 — verifiable compression
  where commitments provably survive. Most directly relevant; check for code.
- PoC (2026): https://arxiv.org/pdf/2603.19733 — bibliography maps the field (AttnComp
  EMNLP'25, semantic-anchor ICLR'26, arXiv:2602.01778, gist tokens NeurIPS'23,
  LLMLingua-2 ACL'24).
- Gist tokens (Mu et al. NeurIPS'23) — 26x learned-token compression; impractical
  locally, know the technique.
- Selective Context (Li et al. 2023) — self-information redundancy removal; local-friendly.
- Survey: https://arxiv.org/pdf/2312.03863 (prompt-compression section)
- Overview (secondary): https://www.emergentmind.com/topics/prompt-compression-for-large-language-models-llms
  — incl. LoPace (lossless, Feb 2026, 72.2% storage claim — find primary; lossless
  matters for evidence integrity)
- Practitioner (vendor): https://www.morphllm.com/prompt-compression

## 4. Aggregators (pointers only)
- https://www.beamforai.com/tools/chopratejas/headroom (stale star count observed)
- Hosted (runtime-disqualified, technique-study only): https://compresr.ai ·
  https://thetokencompany.ai

## 5. Research questions (deliverable structure)
1. Placement map per pipeline stage: none / lossless-only / reversible-lossy / freely-lossy.
2. Tiered rule: validate/refute sunnah-free, wajib-reversible, arkan-never.
3. False-strike analysis: can any tool alter a listing/path/value into a false
   fabrication strike? Test, don't assume.
4. Prefix-stability audit of muezzin dispatch prompts; quantify cache-hit potential —
   cheapest win, zero third-party code.
5. Licenses from LICENSE files (+ Kompress-base model license separately).
6. Build vs adopt: thin in-house "compress sunnah, retrieve on demand" (CCR pattern)
   vs adopting a fast-moving 16k-star dependency. Cost both.
7. Side-interest: ctx_proof/ctx_verify — anything the muezzin witness layer should
   steal, independent of compression?

## 6. Verification protocol (binding)
For every source: (a) fetch primary yourself; (b) note retrieval date; (c) every
quantitative claim VENDOR-CLAIMED until reproduced; (d) record LICENSE text hash or
SPDX; (e) prefer running benchmarks locally over citing; flag sources changed since
2026-06-11.

## 7. CONDUCTOR SPOT-VERIFICATION (SearXNG, 2026-06-11 ~14:05 — existence layer only)
Performed after the operator asked "did you use our SOTA search" — initial filing had
skipped it (a lapse; SearXNG itself was found WEDGED during the check and restarted).
- microsoft/LLMLingua: CONFIRMED (repo + EMNLP'23/ACL'24 + LLMLingua-2 classifier all
  match). BONUS primary evidence for the false-strike risk: issue #213 — "essential
  parts of the original prompt are being omitted... last sentence cut off."
- chopratejas/headroom: CONFIRMED (repo, PyPI headroom-ai, library/proxy/MCP modes,
  reversibility claims in third-party writeups). CAVEAT found: open issue re
  "Python 3.13 breaking MCP compression."
- rtk-ai/rtk: CONFIRMED (repo, Rust, 100+ commands, <10ms claims; wide writeup base).
- yvgude/lean-ctx: CONFIRMED (repo, leanctx.com docs, lib.rs crate). The brief's
  "tool count varies by source" is itself confirmed: 69 (lib.rs) vs 63 (ossinsight)
  vs 69-76 (brief).
Everything deeper (LICENSE files, CCR byte-identity, benchmarks, ctx_proof) remains
UNVERIFIED — that is the mission's work, per §6.
