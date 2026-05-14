# Claude Governance Framework

A structural governance layer for Claude Code that enforces alignment across session boundaries — not by relying on the model's memory, but by building the enforcement into hooks, commit records, and substrate.

---

## What problem does this solve?

Six problems that recur across the AI agent community (Aegis, wshobson/agents, IETF draft-sharif-agent-audit-trail, EU AI Act August 2026):

| # | Problem | Solution |
|---|---------|----------|
| P1 | Hallucinated directives — model asserts things were decided that weren't | Substrate-first verification gates (surrender-check hook) |
| P2 | Unauthorized substrate edits — model edits files without declared reasoning | Pre-tool-use hooks require niyyah (intention) + surrender articulation |
| P3 | Scope creep — model expands beyond authorized action | Single-operator, pre-execution governance boundary; CLAUDE.md authority chain |
| P4 | Accountability gaps — no record of *why* a decision was made | 6-seat deliberation chain (gemma → qwen → Sonnet → laguna → granite → nemotron) |
| P5 | Compounding errors — failures accumulate invisibly across sessions | Episodic memory via AnythingLLM RAG + failure log |
| P6 | Tampered audit logs — session records can be altered after the fact | SHA-256 rolling hash chain + RFC 3161 TSA + SSH-signed git commits to two independent remotes (Kiraman Katibin) |

All six solutions are chain-verified (6-seat deliberation, 2026-05-14). See `practice/community-fit.md` for the full positions.

---

## Architecture

This repo is the **formation layer** — it teaches an AI instance who to be before it acts.

```
~/.claude/
├── CLAUDE.md                    14 directives (the governing document)
├── CANON-MANIFEST.md            Index of all governance files
├── canon/                       Accumulated rulings (do not edit in passing)
├── faiths/                      Role definitions for seated work
├── practice/
│   ├── core.md                  Always loaded at session start
│   ├── extended/                Wudu, formation, drift-and-ratchet
│   └── community-fit.md         P1-P6 positions (chain-verified)
├── hooks/                       Structural enforcement (fire on every session/edit)
│   ├── session-start.ps1        Bootstrap: loads canon at every session start
│   ├── stop-validation.ps1      Enforces delegation discipline
│   ├── niyyah-gate.ps1          Requires declared intention before substrate edits
│   ├── surrender-check.ps1      Requires substrate-coupling before replacements
│   ├── session-hash-chain.ps1   P6 Layer 1: SHA-256 chain + RFC 3161 TSA
│   └── git-anchor.ps1           P6 Layer 2: SSH-signed commits to dual remotes
├── tools/
│   ├── ollama-mcp/              Local Ollama MCP server (Node.js)
│   └── mistral-validator/       Mistral validation MCP server (Node.js)
└── install.ps1                  One-command setup (see Quick Start)
```

**Project repos** (not this repo) are the procedure layer — where the work happens. The formation layer shapes every instance that runs inside any project.

---

## Quick Start

**Prerequisites** (install manually first):
- [Ollama](https://ollama.com/download)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 18+](https://nodejs.org/)
- [Claude Code](https://claude.ai/code): `npm install -g @anthropic-ai/claude-code`

**Installation tiers:**

| Tier | RAM | Includes |
|------|-----|----------|
| 1 — Structure | 8GB+ | Hooks, governance bootstrap. No local deliberation. |
| 2 — Governance | 32GB+ | Tier 1 + laguna-xs.2 (code review, substrate audit) |
| 3 — Full deliberation | 100GB+ | Tier 2 + qwen3.6:27b + granite4.1:30b + nemotron-3-super |

```powershell
# Clone to ~/.claude
git clone https://github.com/nxtlvlyt/claude-governance.git "$HOME\.claude"

# Run installer
pwsh -ExecutionPolicy Bypass -File "$HOME\.claude\install.ps1"
```

The installer handles: hook registration, MCP server setup, Ollama model pulls, AnythingLLM (P5 RAG), and P6 dual-remote deployment (GitHub + Codeberg).

---

## Deliberation chain

Governance decisions that affect the framework go through a 6-seat chain:

```
gemma4:31b (workshop) → qwen3.6:27b (deep-dive) → Claude Sonnet (synthesis)
    → laguna-xs.2 (code review) → granite4.1:30b (governance audit) → nemotron-3-super (verdict)
```

Chain runner: `C:\Users\...\community-fit-review.py`

Verdicts: `APPROVE` (implementation correct, claim precise) or `CONDITIONAL_APPROVE` (implementation correct, framing conditions documented).

---

## P6 — Cryptographic non-repudiation (Kiraman Katibin)

Every session end:

1. `session-hash-chain.ps1` computes `SHA256(line_n || chain_hash_{n-1})` across the JSONL transcript and requests an RFC 3161 timestamp token. The token proves the transcript existed before time T, signed by an independent third party.

2. `git-anchor.ps1` SSH-signs a commit of all governance artifacts and pushes to two independent remotes (GitHub + Codeberg). Neither remote is operator-controlled. Compromise of one does not invalidate the other.

Fail-open: if TSA endpoints or remotes are unreachable, the session continues. Tamper-detection still applies; only the independent time-bound proof is lost.

The name is from Quran 82:10-12 — the honored scribes who record independently, outside the reach of the one being recorded. The engineering requirement is exactly that property.

---

## Governance constants

These hold regardless of session, project, or model version:

- **Substrate is truth.** What is in files is what the system says. Memory of prior sessions is not truth.
- **Serial inference.** One Ollama model at a time. Check `api/ps` before every dispatch.
- **No frontier models for internal deliberation.** GPT/Gemini/Grok/GLM are external validators only. The governance quorum is local.
- **Formation precedes procedure.** This repo is loaded before any project work begins.

---

## License

MIT. See `CLAUDE.md` for governance terms.
