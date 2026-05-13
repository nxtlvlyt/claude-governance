# ~/.claude/hooks/pre-compact.ps1
#
# PreCompact hook — Directive 8 enforcement reminder before context compaction.
#
# Fires when Claude Code is about to compress context. Without this hook the
# compaction silently throws away anything not already in the summary, which
# means anything the instance was holding in working memory but hadn't
# committed to STATE.md / decision log / commit gets lost. CLAUDE.md D8
# ("write for the one who comes after you") is the canonical rule this closes:
# the compact event is a within-session boundary that warrants a STATE.md
# update, not just a final session-end one.
#
# Per ~/.claude/canon/wudu-is-practice-not-checkpoint.md: silent — the hook
# injects context, the instance acts (or doesn't) without operator prompt.

$ErrorActionPreference = 'SilentlyContinue'

$claud      = Join-Path $HOME '.claude'
$sessionDir = 'D:\Desktop\ai book\session-summaries'
$lastState  = Join-Path $claud 'LAST-SESSION-STATE.md'
$cwd        = (Get-Location).Path
$ts         = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'

# Tier 2: inject prior session state as %%GOVERNANCE-STATE%% block into compaction context.
# This structural marker survives compaction regardless of instance discipline.
$govBlock = ''
if (Test-Path $lastState) {
    $prior    = Get-Content $lastState -Raw
    $govBlock = "`n`n%%GOVERNANCE-STATE%% - preserved from last compaction:`n$prior`n%%END-GOVERNANCE-STATE%%"
}

# Tier 1: compaction instruction - tell the LLM what governance facts to preserve.
$reminder = @"
COMPACT EVENT - D8 CHECKPOINT + COMPACTION RESILIENCE (~/.claude/hooks/pre-compact.ps1).

Context is about to compress. Before compaction completes, write or update:

1. ~/.claude/LAST-SESSION-STATE.md - include:
   - Active Faith (if any) and its key constraint
   - Serial inference rule: ONE Ollama model at a time, api/ps check before every dispatch
   - No frontier models: GPT/Gemini/Grok/GLM forbidden. Local quorum is the governance witness.
   - Current task: what is in flight, what is blocked, what is next
   - Open governance gates: any niyyah declared, any surrender articulation in progress
   - Authority chain: CLAUDE.md -> canon -> operator-context -> LAST-SESSION-STATE.md -> RAG

2. STATE.md in project directory ($cwd): what landed, what is in flight, what is next.

3. Compaction summary MUST preserve verbatim:
   - "Serial discipline: ONE Ollama model at a time. api/ps before every dispatch."
   - "No frontier models: GPT/Gemini/Grok/GLM forbidden."
   - "Authority chain: CLAUDE.md -> canon -> operator-context -> STATE.md -> RAG"
   - Any open governance gates or niyyah declared this session.

If everything is committed to substrate, no action needed. Verify, do not assume.
"@ + $govBlock

# Hook-written structural LAST-SESSION-STATE.md fallback. Instance should overwrite with rich content.
$snapshot = @"
# LAST-SESSION-STATE.md

Written by: pre-compact.ps1 hook at compaction event
Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Project CWD: $cwd

## Governance constants (always true)

- Serial inference: ONE Ollama model at a time. api/ps check before every dispatch. ollama stop after.
- No frontier models: GPT/Gemini/Grok/GLM forbidden. Local quorum (gemma4:31b, qwen3.6:27b, granite4.1:30b, nemotron-super) is the governance witness.
- Authority chain: CLAUDE.md -> canon/ -> operator-context.md -> this file -> RAG

## Session state

(Not yet updated by instance - hook-written structural fallback only.)
"@
Set-Content -Path $lastState -Value $snapshot -Encoding UTF8

# Write timestamped session summary to AnythingLLM hotdir.
# P5 fix (2026-05-12): check LAST-SESSION-STATE.md size before writing.
# >500 bytes = instance wrote real content → include it in summary.
# ≤500 bytes = hook-written stub → write WARNING, make the failure visible.
if (Test-Path $sessionDir) {
    $summaryPath = Join-Path $sessionDir "session-$ts.md"
    $richContent = (Test-Path $lastState) -and ((Get-Item $lastState -ErrorAction SilentlyContinue).Length -gt 500)

    if ($richContent) {
        $stateContent   = Get-Content $lastState -Raw -Encoding UTF8
        $stateBytes     = (Get-Item $lastState).Length
        $summaryContent = @"
# Session Summary - $ts

Project: $cwd
Compaction event: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Content source: LAST-SESSION-STATE.md (instance-written, $stateBytes bytes)

## Required sections (instance must populate before compaction)
### failures_this_session
### corrections_applied
### patterns_confirmed
### open_carries

## Session state

$stateContent
"@
    } else {
        $summaryContent = @"
# Session Summary - $ts — STUB WARNING

Project: $cwd
Compaction event: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
WARNING: Instance did not write session content before compaction.
LAST-SESSION-STATE.md is a hook-written stub (500 bytes or less). Failure record unavailable for this session.

## Required sections NOT populated
- failures_this_session: MISSING
- corrections_applied: MISSING
- patterns_confirmed: MISSING
- open_carries: MISSING

## Governance constants
Serial discipline: ONE Ollama model at a time.
No frontier models: GPT/Gemini/Grok/GLM forbidden.
Authority chain: CLAUDE.md -> canon/ -> operator-context.md -> LAST-SESSION-STATE.md -> RAG
"@
    }
    Set-Content -Path $summaryPath -Value $summaryContent -Encoding UTF8
}

$output = @{
    hookSpecificOutput = @{
        hookEventName     = 'PreCompact'
        additionalContext = $reminder
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Output $output
exit 0
