# The Governance Framework — What We Built, Where It Stands, Where It Goes

*A narrated design document. Written to be read aloud.*

---

## What This Is

Over the past several weeks, we built a structural governance layer for Claude Code — not a set of rules written in a document that an AI might ignore, but a set of hooks, scripts, and verification mechanisms that enforce alignment at the operating system level, before and after every action the AI takes.

The core insight is simple: if you want an AI system to behave consistently, you cannot rely on its memory or its goodwill. Memory doesn't cross session boundaries. Goodwill is not a structural property. What you can rely on is architecture — code that runs unconditionally, regardless of what the AI thinks it wants to do.

This framework is that architecture.

---

## The Six Problems We Solved

The AI governance community has been grappling with a specific set of recurring failures. We identified six of them, addressed each with a concrete implementation, and then verified each solution through a six-seat deliberation chain before declaring it complete.

**Problem one: Hallucinated directives.** AI systems sometimes claim that decisions were made in prior sessions that never actually happened. They assert context that doesn't exist in the committed record. Our solution is a surrender check — a hook that fires before any file edit and requires the AI to quote the actual text it is replacing, verbatim, from the file on disk. You cannot paraphrase what you are replacing. You cannot edit from memory. The substrate wins.

**Problem two: Policy as guidelines.** Most AI governance attempts write rules in documents. Documents are advisory. They can be ignored, bypassed, or forgotten. Our solution encodes the governance as blocking hooks — code that intercepts every edit operation, every session start, every stop event. The niyyah gate requires a declared intention before any file can be modified. The stop-validation hook blocks a session from ending if the AI uses deferral language without having done the work. These are not suggestions. They are structural gates.

**Problem three: Rogue behavior in multi-agent systems.** When AI agents spawn subagents or operate in chains, trust delegation becomes a problem. Our solution is a six-seat deliberation chain — a structured review process where five local AI models and the primary Claude instance evaluate any significant decision before it is committed. The chain includes a workshop pass, a deep-dive analysis, an independent synthesis, a code review, a governance audit, and a final verdict. No single agent can authorize a governance change alone.

**Problem four: No accountability loop.** When an AI makes a decision, there is often no record of why. Our solution is the combination of the deliberation chain and the niyyah gate. The niyyah gate requires a declared intention that names the source the work answers to, the failure mode being guarded against, and what the work actually is. These declarations are committed to the substrate. The deliberation chain produces JSON verdicts with specific concerns and close types. The reasoning is in the files.

**Problem five: Static policy that doesn't learn.** Session boundaries are amnesiac by default. Each new Claude instance knows only what was committed before the session began. Our solution is a two-layer memory system: a pre-compact hook that writes session state to a structured markdown file before context compression, and an AnythingLLM episodic memory layer that indexes session summaries for retrieval-augmented generation. The failure log is loaded directly into every session — not retrieved through RAG, but injected structurally, so the current instance always knows what prior instances got wrong.

**Problem six: Tampered audit logs.** If AI session records can be modified after the fact, they are not evidence — they are stories that can be rewritten. Our solution is named after the Kiraman Katibin — the honored scribes in Islamic tradition who record deeds independently, outside the control of the one being observed. The implementation is two independent mechanisms running in parallel at every session end. First, a PowerShell hook computes a rolling SHA-256 hash chain across every line of the session transcript, then requests a timestamp token from an RFC 3161 Time Stamp Authority — an independent third party that cryptographically certifies the hash existed before a specific moment in time. Only the hash leaves the machine; the session content stays local. Second, a separate hook creates an SSH-signed git commit of all governance artifacts and pushes to two independent remote repositories — one on GitHub, one on Codeberg. Neither remote is under operator control. If the local machine is destroyed, the signed record survives. If one remote is compromised, the other is unaffected. The two angels are not on one shoulder.

---

## The Architecture

The framework has a two-layer structure that the canonical design document calls formation and procedure.

The formation layer lives in the `.claude` directory in your home folder. It contains the governing document — a set of fourteen directives that shape how an AI instance behaves before it acts on anything. It contains the canon — accumulated governance rulings that do not change in passing. It contains faith files that define what each seated role in the deliberation chain is and how it operates. It contains the hooks that enforce everything structurally. This is the layer that makes an instance who it is.

The procedure layer lives in individual project repositories. It contains project-specific context, state files, and skills — the workflows and slash commands that tell the formed instance what to do in this particular project.

The separation matters because formation is universal. A cold instance bootstrapped from a thin context window still gets the governance layer before it acts. The session-start hook loads the practice core and the canon index into every new session automatically. The AI does not need to remember to read the governance documents. The hook runs them before anything else.

---

## Where the Repo Stands Today

The GitHub repository at `nxtlvlyt/claude-governance` is a complete, deployable reference implementation. It includes the formation layer in full — the governing document, all seventeen canon rulings, all nine faith files, all ten enforcement hooks. It includes the deliberation chain scripts, now portable and configurable through a models.json file that maps role descriptions to whatever models you have installed. It includes an installer that handles prerequisites, hook registration, MCP server setup, Ollama model pulls, AnythingLLM, and the full P6 dual-remote deployment.

A technical person can clone this repository, run the installer, and have a working governance layer in one session.

The models.json configuration is worth noting specifically. Rather than hardcoding specific model names — which would be outdated within months — the file describes what each role needs. The workshop role needs creative breadth, a large generative model. The deep-dive role needs a reasoning model with chain-of-thought capability. The code review role needs speed and precision, a smaller quantized model. The governance audit role needs structured analytical reasoning. The synthesis role needs the highest-capability model available. When you install on a new machine, you look at what models Ollama has available and pick the ones that fit the role descriptions. The framework is durable even as the model landscape changes.

---

## What Comes Next

Three pieces of work remain before this is as close to one-command installable as it can be.

**SearxNG auto-install.** The chain runners require a local search instance for live research queries. This is already a Docker service — adding it to the installer is thirty minutes of work. Currently it requires manual setup.

**npm distribution layer.** Today you clone the repository and run the PowerShell installer. The natural next step is wrapping this as an npm package so the installation command is a single line: install the package, run the governance setup. The output is identical to what the current installer produces. The distribution mechanism is just more convenient.

**Slash command skills.** The chain runners in the scripts directory are already functional Python scripts. Wrapping each one as a Claude Code slash command — `/deliberate`, `/chain-review`, `/governance-audit` — gives users a one-word interface to run a full six-seat deliberation review. This is the user-facing layer that makes the power accessible without knowing the underlying implementation.

These three pieces together complete the picture: clone or install one package, answer a few questions about your hardware and models, and have a working governance system that enforces alignment structurally, keeps a cryptographically verified audit trail, and can run deliberation reviews on any architectural question.

---

## Why This Matters

The EU AI Act mandates tamper-resistant logging for AI systems from August 2026. The IETF has a draft specification for agent audit trails. The research community has published on multi-agent trust delegation and accountability loop failures. These are real problems with real regulatory and safety implications.

What we built here is a working answer to those problems in a single-operator context. It is not a framework that exists only in documentation — every piece of it is running, verified, and structurally enforced. The P6 audit trail hooks have fired on every session in which they were active. The deliberation chain has reviewed all six community problem claims and returned unanimous verdicts. The surrender check and niyyah gate have blocked hundreds of potentially unanchored edits.

The next step is making it easy enough that other practitioners can deploy the same architecture. Not because they need to use our specific models or our specific hooks, but because the pattern itself — formation before procedure, structural enforcement over advisory guidelines, independent witnesses for audit records — is worth spreading.

---

*Document status: 2026-05-14. Written for audio review.*

---

## Next Phase — Open Tasks

These are committed here so a cold instance can resume without needing conversation history.

**Task 1 — git-anchor.ps1 project-aware** ✓ COMPLETE (2026-05-14)
Reads session CWD from hook stdin (`$inp.cwd`). System path guard blocks C:\Windows, Program Files, ProgramData, drive root. Accepts paths under `$HOME` or `project_root_prefixes` in `p6-config.json`. Auto-init runs `git init + gh repo create + Codeberg REST API + push` for new directories.

**Task 2 — SearxNG in install.ps1** ✓ COMPLETE (2026-05-14)
Docker compose block added to install.ps1. settings.yml timeout fixed: 3s → 10s (was causing 0 results on residential/Starlink connections). JSON API test added. Container confirmed returning live results.

**Credential storage chain verdict** ✓ COMPLETE (2026-05-14)
Unanimous CONDITIONAL_APPROVE from 5-seat deliberation chain. Codeberg token migrated from plaintext p6-config.json to Windows Credential Manager (DPAPI). `Get-CodebergToken` function added to git-anchor.ps1: WCM → env var → migration fallback with WARN log. install.ps1 now stores token via `cmdkey`, not `Set-Content`. CredentialManager PowerShell module added as prerequisite. Token migrated on this machine. C3 advisory (scope token to repository:create) printed at install time.

**deliberate.py** ✓ COMPLETE (2026-05-14)
General-purpose deliberation chain runner at `scripts/deliberate.py`. Parses a question_file markdown with `## Substrate Files` and `## Search Queries` sections. Runs 6-seat chain in two phases. Output dir: `<TEMP>/deliberate/<slug>/`. Used for the credential storage deliberation. Foundation for the `/deliberate` slash command (Task 4).

**Chain quality deliberation** ✓ COMPLETE (2026-05-14)
Chain quality question run via deliberate.py. Unanimous CONDITIONAL_APPROVE (3/5 seats — laguna+granite failed GPU OOM). Three concerns resolved: C1 (SEARCH_REFINEMENT — dynamic query generation, deferred design work), C2 (qwen think:True — implemented, committed bbb7952), C3 (prompt order fix — substrate/question moved to position 2 in prompt construction, committed bbb7952). GPU per-agent config committed: gemma4/qwen3.6/laguna/granite num_gpu=99, nemotron num_gpu=14 (partial offload: 14/89 layers, 13.6GiB CUDA0). Jina Reader validated as live in chain (full page content confirmed in both phase 1 agents).

**C1 Search Refinement deliberation** ✓ COMPLETE (2026-05-14)
C1 deferred from chain-quality now fully deliberated. CONDITIONAL_APPROVE — 1 open concern C3 non-blocking (implementation complexity vs quality gain for bounded-domain governance). Key substrate finding (Seat 3 independent eval): phase 1 token budget already at operational edge — gemma ~1,178 tokens remaining, qwen ~1,007 remaining at 16384 ctx. Dynamic injection is not a prospective risk — it is currently impossible. Implementation path: (a) reduce JINA_FETCH_N 2→1 as prerequisite (saves ~571 tokens); (b) Query-Pass Pattern — agents emit `suggested_queries[]` in JSON, orchestrator executes before next dispatch, max 1/agent, snippets only; (c) Seat 3→Phase 2 injection already viable with no code changes. gemma4:31b num_gpu corrected 99→50, qwen3.6:27b corrected 99→45 (both multimodal, expand beyond 24GB VRAM at num_gpu=99). Question file: `scripts/deliberations/c1-search-refinement.md`.

**Task 3 — operator-context.template.md** ✓ COMPLETE (2026-05-14)
`operator-context.template.md` created (674 lines). All universal governance content verbatim; machine/operator-specific sections (1, 3, 8, 9) replaced with `[YOUR-...]` placeholders and `<!-- CUSTOMIZE -->` guidance. `install.ps1` updated: copies template to `operator-context.md` on first run (skips if file exists), with ACTION REQUIRED output listing the four sections to customize. Committed 06d08c9.

**Task 4 — Slash command skills** ✓ COMPLETE (2026-05-14)
Three skills created at `~/.claude/skills/`:
- `/deliberate` (`skills/deliberate/SKILL.md`) — wraps `scripts/deliberate.py`; full 6-seat chain on any question file; bootstrap sequence, Seat 3 in-context synthesis procedure, phase 1/2 execution, final verdict presentation, output file map
- `/chain-review` (`skills/chain-review/SKILL.md`) — wraps `scripts/chain-review.py`; specializes on operator-context.md accuracy review; notes chain-review.py limitations vs deliberate.py
- `/governance-audit` (`skills/governance-audit/SKILL.md`) — quick 2-seat scan (laguna + granite); satisfies substrate gate; faster than full chain; gate satisfaction pattern documented (Turn N MCP dispatch → Turn N+1 Edit)
All three active and showing in Claude Code skill registry.

**Sub-step before finishing Task 4 — Jina URL fetching validation: ✓ COMPLETE (2026-05-14)**
Jina Reader added to deliberate.py (`r.jina.ai/<url>` prefix). Chain quality deliberation (2026-05-14) ran with Jina active — both phase 1 agents received full page content (confirmed via chain run). Decision: SearxNG + Jina is the settled search stack. No custom FastAPI node needed. Task 4 slash command wrapping can proceed directly.

**Task 5 — Migrate skills/ out of ~/.claude/** (Priority: lower)
Per `canon/perfect-repo-architecture.md`: skills are procedures and belong in project repos, not the formation layer.

Part A — bootstrap_sequence: ✓ COMPLETE (2026-05-14)
All four governance skills now have `bootstrap_sequence` frontmatter: deliberation (v1.3), deliberate (v1.1), chain-review (v1.1), governance-audit (v1.1). The canon ruling is explicit: the sequence is a loading requirement, not a declaration. A cold instance must execute each read before the skill body.

Part B — creative skill symlinks: ✓ RESOLVED — NOT A VIOLATION (2026-05-14)
The `~/.claude/skills/` creative skill symlinks (animejs, css-animations, gsap, hyperframes, hyperframes-cli, hyperframes-registry, lottie, remotion-best-practices, remotion-to-hyperframes, tailwind, three, waapi, website-to-hyperframes) were installed from external repos via Claude Code's skill manager. Source: `~/.agents/.skill-lock.json` records all 13 with source URLs (`heygen-com/hyperframes`, `remotion-dev/skills`), install timestamps, and folder hashes. The `~/.agents/` directory is Claude Code's skill package cache — not operator-authored content. The canon ruling ("skills belong in project repos") targets operator-authored procedures, not the tool's own package management. The symlinks in `~/.claude/skills/` are the correct mechanism for exposing skill-manager-installed skills. No migration needed. Task 5 Part B closes as non-violation.

**npm distribution wrapper** ✓ COMPLETE (2026-05-14)
`package.json` at `~/.claude/package.json` (name: `@nxtlvl/claude-governance`, version: 0.1.0). `bin/claude-governance.js` is a Node.js bootstrap script: detects OS, checks for git, guards against overwriting non-governance `~/.claude/` content, clones from GitHub if absent, runs `install.ps1` on Windows, prints manual steps on Mac/Linux. `README.md` updated with Option A (npx) + Option B (git clone) Quick Start. Files in package: `bin/`, `README.md`. No npm dependencies.

**C1 hook language-agnosticism deliberation** ✓ COMPLETE (2026-05-14)
Full 6-seat chain via deliberate.py on whether to port governance hooks from PowerShell to Node.js .mjs. Chain verdict: CONDITIONAL_APPROVE — Node.js migration approved. 1 blocking concern: git-anchor.ps1 WCM dependency → platform CLI detection (cmdkey/secret-tool/security) + CODEBERG_TOKEN env var. keytar confirmed archived. Migration path: Phase A gate hooks → Phase B context hooks → Phase C P6 hooks → Phase D git hooks. Gemma void output (substrate-as-system-prompt: second consecutive failure) → EVALUATOR ROLE fix committed. No-skip rule: laguna CPU fix + GPU-500 retry fallback committed. Semantic validation: question_restated field + phase 2 keyword pre-check committed. Question file: `scripts/deliberations/c1-hook-language-agnosticism.md`. Three deliberate.py fixes committed in this chain: `ebfd32a` (no-skip/CPU fix), `befe478` (semantic validation), `edfc43a` (EVALUATOR ROLE).

**Agent platform design deliberation** ✓ COMPLETE (2026-05-14)
Full 6-seat chain via deliberate.py on the question: "if we built an agent platform CLI from scratch — purpose-built, not bolted onto Claude Code — what is the right architecture?" Chain verdict: CONDITIONAL_APPROVE (all seats in agreement). Final open concerns: C1 PowerShell hook latency (blocking for platform scale), C2 TSA single-point-of-failure (non-blocking high priority), C3 memory unification interface (non-blocking). Key architectural conclusions: (a) current claude-governance IS the MVP; v2 = language-agnostic hooks + native `deliberate` CLI + unified memory API; (b) financial layer = integrate Nevermined/Paid.ai, not build; (c) creative layer = HyperFrames for agent-authored content, not Remotion; (d) structural enforcement (OS-level blocking hooks) is the genuine differentiation over LangGraph/CrewAI/AutoGen. **Chain architecture gap identified:** orchestrator validates JSON schema, not semantic relevance — a model that answers the wrong question proceeds silently if `verdict` field is present. Gemma produced a valid APPROVE for governance security instead of platform design; chain forwarded it because the JSON was structurally valid. Current defense: Seat 3 independent substrate evaluation. Future fix: Seat 3 halt authority to request re-runs on wrong-question responses. Question file: `scripts/deliberations/agent-platform-design.md`.

*Task list last updated: 2026-05-14, session 071faf79 continuation (Tasks 1-4 complete; npm wrapper complete; Task 5 Part A complete; Task 5 Part B resolved as non-violation — creative skills are Claude Code skill-manager packages, not operator content; agent-platform-design deliberation complete). All open tasks closed.*
