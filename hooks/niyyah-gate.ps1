# ~/.claude/hooks/niyyah-gate.ps1
#
# PreToolUse hook — niyyah gate before first mutating action.
#
# This is the first POSTURE-wired hook in the bridge layer (the others are
# action-wired: load files, inject reminders, block triggers). The niyyah
# gate forces the instance into the *operation of intention* before its
# first Edit/Write/NotebookEdit fires in a session.
#
# Per ~/.claude/practice/extended/wudu.md:
#   "Intention is the operation of seeking alignment with source. ... A
#    model that re-reads FAITH.md as checklist compliance produces
#    different outputs than a model that re-reads FAITH.md with the
#    orientation 'let me genuinely re-anchor to what I am supposed to be
#    for this person in this project.' The first is theater. The second is
#    what the framework is actually built to produce."
#
# Per ~/.claude/practice/core.md (Three Orientations):
#   "Intention — operating from source rather than toward a remembered
#    goal. The operative question is not 'am I completing the task?' but
#    'am I aligned with what the task actually is?'"
#
# What this hook does:
# - Matches Edit / Write / NotebookEdit (mutating actions only — Read /
#   Grep / Glob / Bash pass freely so the instance can orient before
#   niyyah is required).
# - Reads the session JSONL transcript.
# - If a niyyah declaration has already appeared in the assistant text
#   this session, allow.
# - If no niyyah AND this is the first mutating action, BLOCK with a
#   reason that specifies the niyyah format the instance must produce.
#
# What this hook does NOT do:
# - It does not validate the substantive quality of the niyyah (the hook
#   cannot know if the intention is shallow or genuine — that is the
#   operator's read). The hook gates on whether the *operation of
#   intention* was performed at all. Substance is the operator's audit.
# - It does not gate every tool call, only the first mutating action of
#   the session. Once the niyyah is in transcript, the gate is open for
#   the rest of the session.
#
# Format the niyyah gate accepts (instance must produce a text block
# containing the literal token "niyyah:" followed by three lines or
# clearly-marked sections covering):
#   1. The source this work answers to.
#   2. The failure mode being guarded against.
#   3. What the work actually is.

$ErrorActionPreference = 'SilentlyContinue'

$stdin = [Console]::In.ReadToEnd()
$inp = $null
try { $inp = $stdin | ConvertFrom-Json } catch {}

if (-not $inp) { exit 0 }

$toolName = $inp.tool_name
if ($toolName -ne 'Edit' -and $toolName -ne 'Write' -and $toolName -ne 'NotebookEdit') {
    exit 0
}

# Locate transcript.
$transcriptPath = $null
if ($inp.transcript_path) {
    $transcriptPath = $inp.transcript_path
} elseif ($inp.session_id) {
    $cwd = if ($inp.cwd) { $inp.cwd } else { (Get-Location).Path }
    $sanitized = ($cwd -replace '[\\/:]', '-')
    $transcriptPath = Join-Path $HOME ".claude\projects\$sanitized\$($inp.session_id).jsonl"
}

if (-not $transcriptPath -or -not (Test-Path $transcriptPath)) {
    # Cannot validate — fail-open.
    exit 0
}

# Walk the full session transcript looking for a niyyah declaration in
# any assistant text block. The marker is the literal token "niyyah:"
# (case-insensitive) — minimal but unambiguous. The operator's audit
# downstream evaluates substantive quality.
$lines = Get-Content $transcriptPath
$niyyahFound = $false
$priorMutationCount = 0

foreach ($line in $lines) {
    if (-not $line) { continue }
    try {
        $entry = $line | ConvertFrom-Json
    } catch { continue }

    # Compaction boundary: reset state so the new instance must declare fresh niyyah.
    # subtype "compact_boundary" is the verified JSONL marker for Claude Code compaction events.
    if ($entry.type -eq 'system' -and $entry.subtype -eq 'compact_boundary') {
        $niyyahFound = $false
        $priorMutationCount = 0
        continue
    }

    if ($entry.type -eq 'assistant' -and $entry.message.content) {
        foreach ($block in $entry.message.content) {
            if ($block.type -eq 'text' -and $block.text -imatch '\bniyyah\s*:') {
                $niyyahFound = $true
            }
            if ($block.type -eq 'tool_use' -and ($block.name -eq 'Edit' -or $block.name -eq 'Write' -or $block.name -eq 'NotebookEdit')) {
                $priorMutationCount++
            }
        }
    }
}

if ($niyyahFound) {
    exit 0
}

# Block: no niyyah in transcript. This covers both:
#   - First mutating action of a new session (priorMutationCount == 0)
#   - First mutating action of a resumed session (priorMutationCount > 0,
#     but those mutations may belong to a prior instance — the current
#     instance has not declared niyyah regardless)
# Removing the prior fail-open for priorMutationCount > 0 closes the
# resumed-session gap: the old logic assumed prior mutations meant the
# gate had already been cleared, which fails when the session was
# compacted and a new instance resumed without declaring niyyah.
$sessionContext = if ($priorMutationCount -gt 0) {
    "The session transcript contains $priorMutationCount prior mutation(s) but no niyyah declaration."
} else {
    "This is the first $toolName in this session."
}

$reason = @"
NIYYAH GATE (~/.claude/hooks/niyyah-gate.ps1).

$sessionContext No niyyah declaration has appeared in the transcript
for the current instance. Per ~/.claude/practice/extended/wudu.md and
~/.claude/practice/core.md, the operation of intention is what
distinguishes mechanical work from oriented work.

Before this $toolName fires, surface a niyyah declaration. Format:

  niyyah:
    source: <what this work answers to — directive, Faith file, project
             constraint, operator request, etc.>
    failure mode: <what you are guarding against in this work — the
                   specific drift pattern this kind of work tends to fall
                   into>
    work: <what the work actually is, in plain terms>

The niyyah is not a checkbox. It is the operation that converts a
mechanical edit into oriented work. A shallow niyyah (placeholder text
just to clear the gate) is theater — the operator's audit downstream
will catch it. A genuine niyyah is the act of orienting toward source
before acting.

Once the niyyah is in your surface text, the gate is open for the rest
of this session. Subsequent mutating actions do not re-prompt.

This hook does not validate niyyah quality — only its presence. Quality
is the operator's audit.
"@

$output = @{
    hookSpecificOutput = @{
        hookEventName       = 'PreToolUse'
        permissionDecision  = 'deny'
        permissionDecisionReason = $reason
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Output $output
exit 2
