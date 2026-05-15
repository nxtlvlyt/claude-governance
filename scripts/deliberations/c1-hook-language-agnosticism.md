# C1: Hook System Language-Agnosticism

This is the C1 concern deferred from the agent-platform-design deliberation (2026-05-14,
CONDITIONAL_APPROVE). The concern was marked **blocking for platform scale and multi-tenant
deployment**.

## Background

The governance framework has 13 enforcement hooks, all implemented as PowerShell scripts
(`.ps1`) registered in `~/.claude/settings.json` with commands of the form:

```
pwsh -NoProfile -ExecutionPolicy Bypass -File "C:\Users\marka\.claude\hooks\hook.ps1"
```

This works on Windows. It breaks on Linux and macOS. Any deployment of `@nxtlvl/claude-governance`
to a non-Windows machine requires rewriting every hook. This directly constrains the platform's
distribution reach and is the blocking item before the governance package can be offered as a
single-command install on any OS.

**SOTA finding (live research, 2026-05-14):** The established cross-platform pattern for
Claude Code hooks is Node.js `.mjs` files invoked with `node` in `settings.json`. Claude Code
guarantees Node.js is present on every platform (Windows/Linux/macOS) as a runtime dependency —
making it a safer portability guarantee than Python (`python3` availability varies) or compiled
binaries (requires per-platform builds). Three rules inside the .mjs files make them fully
portable: `os.homedir()` instead of `$env:USERPROFILE` or `$HOME`; `os.tmpdir()` instead of
`/tmp` or `$env:TEMP`; `path.join()` for all path construction. Exit code 2 = block, exit code
0 = allow — same contract as the current PS1 hooks.

**The one genuine Windows-specific dependency:** `git-anchor.ps1` uses the Windows Credential
Manager PowerShell module (`Get-StoredCredential`, `CredentialManager`) to read the Codeberg
personal access token — stored there by `install.ps1` via `cmdkey`. On Linux/macOS there is no
equivalent without an additional library. All other hooks are portable: SHA-256 hash chains
(`node:crypto`), RFC 3161 TSA calls (native `fetch`), git commands (`child_process.exec`),
stdin JSON reading (`process.stdin`), and `additionalContext` output to stdout.

**The hook inventory (13 scripts):**

Gate hooks (PreToolUse — blocking):
- `niyyah-gate.ps1` — blocks Edit/Write without a niyyah declaration
- `surrender-check.ps1` — blocks substrate edits without a surrender articulation
- `pre-tool-use-substrate.ps1` — blocks substrate edits without a foreign-frontier witness dispatch

Context hooks (SessionStart, UserPromptSubmit, PreCompact, SubagentStart):
- `session-start.ps1` — loads canon + practice + operator-context into context at session start
- `subagent-start.ps1` — same bootstrap for spawned Agent subagents
- `user-prompt-submit.ps1` — re-anchors on every operator message
- `pre-compact.ps1` — injects D8 reminder at context boundary
- `pre-tool-use-chain-timing.ps1` — timing enforcement for deliberation chain

Stop hooks (Stop — blocking):
- `stop-validation.ps1` — blocks stop-language without frontier dispatch
- `session-hash-chain.ps1` — SHA-256 rolling hash chain + RFC 3161 TSA anchoring (P6)
- `git-anchor.ps1` — SSH-signed git commit + dual-remote push (P6) — has WCM dependency

Git hooks (registered with git, not Claude Code):
- `laguna-pre-commit.ps1` — reviews staged diffs via laguna before commit
- `laguna-prose-governance.ps1` — prose governance audit for repos with `.laguna-prose`

## The Question

Should we port the governance hooks from PowerShell to Node.js ESM (`.mjs`)?
If so: what is the right migration path, how do we handle the WCM dependency in `git-anchor.ps1`,
and what does a complete cross-platform hook system look like?

**Specifically evaluate:**

1. **Full port vs. gradual migration.** Port all 13 hooks to .mjs in one release, or migrate
   in tiers (gate hooks first as they are simplest, then context hooks, then P6 hooks last as
   most complex)? What are the risks of partial migration state?

2. **WCM alternative for `git-anchor.ps1`.** Options:
   - Platform detection: `process.platform === 'win32'` → WCM via `child_process.exec('cmdkey ...')`;
     `linux` → `secret-tool` (libsecret); `darwin` → macOS `security` command
   - Cross-platform: environment variable `CODEBERG_TOKEN` (documented in installer, written
     to shell profile on non-Windows). Simple, works everywhere, less hardware-backed.
   - Hybrid: keep `git-anchor.ps1` as Windows-only for now, provide `git-anchor.sh` for
     non-Windows, both implement the same JSON stdin → git commit → push contract.
   Which approach gives the best portability/complexity tradeoff?

3. **Session-start additionalContext pattern.** `session-start.ps1` loads ~82KB of canon and
   practice files and injects them via the `additionalContext` JSON field. Node.js can do this
   identically (read files, JSON.stringify, write to stdout). Is there any reason this is harder
   in Node.js than in PowerShell?

4. **Performance.** PowerShell startup on Windows is ~200-400ms per hook fire. Node.js startup
   is ~30-80ms. All hooks run synchronously in sequence (gate hooks block the action). For 3
   gate hooks firing per Edit/Write, the current PS1 overhead is ~600-1200ms per mutating
   action. Does the Node.js migration close the latency concern raised in the agent-platform-design
   chain alongside the portability concern?

5. **Installer impact.** `install.ps1` currently registers all hooks as PS1 commands. The
   cross-platform installer would need to: (a) write `.mjs` files to `~/.claude/hooks/`, (b)
   register them with `node` in `settings.json`. What does the installer migration look like?
   Does this change what `@nxtlvl/claude-governance` needs to bundle?

6. **Git hooks (laguna-pre-commit, laguna-prose-governance).** These are registered with git,
   not Claude Code — they live in `.git/hooks/` as shell scripts. On Windows, git uses Git Bash
   or MSYS2 for shell hooks. Should these be migrated to Node.js as well (using a `node` shebang
   or a `.cmd` wrapper that calls node), or left as shell scripts since they are invoked by git's
   own mechanism?

7. **What NOT to port.** Is there anything in the current PS1 hooks that genuinely requires
   PowerShell — not just Windows, but specifically PowerShell? If so, what is the correct
   cross-platform abstraction?

Evaluate against: implementation complexity from current position, compatibility risk during
migration, whether a phased approach is safer than big-bang, and the single-operator vs.
future multi-platform deployment context.

## Substrate Files
- operator-context.md
- scripts/governance-vision.md

## Search Queries
- cross-platform Claude Code hooks Node.js ESM mjs portable Windows Linux macOS governance enforcement 2026
- Windows Credential Manager alternative cross-platform secret storage Node.js keytar libsecret environment variable 2026
- Node.js ESM hooks stdin stdout JSON exit code os.homedir path.join child_process git commit signing cross-platform
- PowerShell to Node.js migration governance hooks latency startup time enforcement audit trail
- git hooks cross-platform Node.js shebang Windows Git Bash MSYS2 portable pre-commit hook 2026
