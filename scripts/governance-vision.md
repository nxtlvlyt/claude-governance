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
Reads session CWD from hook stdin (`$inp.cwd`). System path guard blocks C:\Windows, Program Files, ProgramData, drive root. Accepts paths under `$HOME` or `project_root_prefixes` in `p6-config.json`. Auto-init runs `git init + gh repo create + Codeberg REST API + push` for new directories. Credentials stored in `~/.claude/p6-config.json` (gitignored). install.ps1 writes p6-config.json at P6 setup time.

**Task 2 — SearxNG in install.ps1** (Priority: high)
Add SearxNG Docker compose block to `install.ps1` as an optional component alongside AnythingLLM and Forgejo. The chain runner scripts (`scripts/community-fit-review.py`, `scripts/chain-review.py`) call SearxNG at `http://localhost:8080` — without it, all search queries return `[Search unavailable]`. Minimal Docker compose: `searxng/searxng` image, port 8080. Estimated: 30 minutes.

**Task 3 — operator-context.template.md** (Priority: high)
The current `operator-context.md` is personal history for this specific machine and operator. New users cloning the repo need a blank template with section headers and placeholder guidance. `install.ps1` should copy the template to `operator-context.md` on first run (only if no existing file). Estimated: 30 minutes.

**Task 4 — Slash command skills** (Priority: medium)
Wrap `scripts/community-fit-review.py` and `scripts/chain-review.py` as Claude Code slash command skills (`/deliberate`, `/chain-review`, `/governance-audit`). Each needs a `SKILL.md` with `bootstrap_sequence` and a wrapper that calls the Python script. This is the user-facing interface for deliberation reviews. Estimated: 1 session.

**Task 5 — Migrate skills/ out of ~/.claude/** (Priority: lower)
Per `canon/perfect-repo-architecture.md`: skills are procedures and belong in project repos, not the formation layer. The HyperFrames, Remotion, CSS animation, and other creative skills in `~/.claude/skills/` violate this ruling. Migration reduces formation layer context window usage and brings the repo into canon compliance. The target project repo for these skills needs to be identified first. Estimated: 1 session.

**NOT yet started — npm distribution wrapper**
Packaging `install.ps1` as an npm package (`npm install -g @nxtlvl/claude-governance`) makes distribution one command. Deferred until Tasks 1-3 are solid, since the installer output is what gets distributed. Cross-platform (Mac/Linux) support is the major variable — install.ps1 is Windows-only today; a bash equivalent would be 3-4 sessions of additional work.

*Task list last updated: 2026-05-14, session continuation (Task 1 complete).*
