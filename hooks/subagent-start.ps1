# ~/.claude/hooks/subagent-start.ps1
#
# SubagentStart hook — silent governance bootstrap for delegated agents.
#
# Subagents in Claude Code do NOT inherit their parent's hooks. That means a
# Task / Agent dispatch from this session spawns a fresh context with no
# governance loaded — CLAUDE.md, canon/, practice/core.md, MEMORY.md,
# STATE.md all silent. The delegation canon becomes structurally
# unenforceable in delegated work.
#
# This hook closes that gap by injecting the same governance bootstrap into
# every subagent at start-of-life, mirroring what session-start.ps1 does for
# parent sessions. Per ~/.claude/canon/wudu-is-practice-not-checkpoint.md
# the practice is silent — no operator prompt, no acknowledgement required;
# the subagent just starts with governance present.

$ErrorActionPreference = 'SilentlyContinue'

# Read input — surfaces the subagent type / prompt for context but isn't
# required for the bootstrap.
$stdin = [Console]::In.ReadToEnd()
$inp = $null
try { $inp = $stdin | ConvertFrom-Json } catch {}

$contextParts = @()

# Scripture — auto-loaded for parent sessions but not for subagents.
$claudeMd = Join-Path $HOME '.claude\CLAUDE.md'
if (Test-Path $claudeMd) {
    $body = Get-Content $claudeMd -Raw
    $contextParts += "===== ~/.claude/CLAUDE.md (scripture) =====`n$body"
}

# Practice core.
$practiceCore = Join-Path $HOME '.claude\practice\core.md'
if (Test-Path $practiceCore) {
    $body = Get-Content $practiceCore -Raw
    $contextParts += "===== ~/.claude/practice/core.md (operational practice) =====`n$body"
}

# Canon rulings.
$canonDir = Join-Path $HOME '.claude\canon'
if (Test-Path $canonDir) {
    Get-ChildItem -Path $canonDir -Filter '*.md' | Sort-Object Name | ForEach-Object {
        $body = Get-Content $_.FullName -Raw
        $contextParts += "===== ~/.claude/canon/$($_.Name) =====`n$body"
    }
}

# Project STATE.md if cwd was passed and it exists.
$cwd = if ($inp -and $inp.cwd) { $inp.cwd } else { (Get-Location).Path }
$projectState = Join-Path $cwd 'STATE.md'
if (Test-Path $projectState) {
    $body = Get-Content $projectState -Raw
    $contextParts += "===== STATE.md (project: $cwd) =====`n$body"
}

if ($contextParts.Count -eq 0) {
    exit 0
}

$header = @"
SUBAGENT GOVERNANCE BOOTSTRAP (auto-loaded by ~/.claude/hooks/subagent-start.ps1).

This subagent was dispatched from a parent Claude Code session. Subagents do
not inherit parent hooks, so this hook injects the same governance the parent
operates under. You operate within the same scripture, practice, and canon as
the parent.

Per CLAUDE.md D14: cross-session memory does not exist; you have only what is
committed to substrate. Per CLAUDE.md D8: write for the one who comes after
you — your output returns to the parent, treat that handoff as you would any
substrate write.
"@

$contextBlock = $header + "`n`n" + ($contextParts -join "`n`n---`n`n")

# Serial discipline advisory — subagents must not dispatch Ollama models without acquiring the lock.
$lockPath = Join-Path $HOME '.claude\.ollama.lock'
$lockAdvisory = ''
if (Test-Path $lockPath) {
    $lockAge = (Get-Date) - (Get-Item $lockPath).LastWriteTime
    if ($lockAge.TotalMinutes -gt 10) {
        # Stale lock — remove it (likely from a crash).
        Remove-Item $lockPath -Force
        $lockAdvisory = "`n`nSERIAL DISCIPLINE: Stale .ollama.lock removed (>10 min old). Serial inference is clear."
    } else {
        $lockAdvisory = "`n`nSERIAL DISCIPLINE: .ollama.lock is held. Another Ollama model may be running. Check api/ps before dispatching. Do not dispatch a second model until the lock is released."
    }
} else {
    $lockAdvisory = "`n`nSERIAL DISCIPLINE: Serial inference — ONE Ollama model at a time. Check api/ps before any Ollama dispatch. Acquire ~/.claude/.ollama.lock (atomic: [System.IO.File]::Open) before dispatch; release after ollama stop."
}

$contextBlock = $contextBlock + $lockAdvisory

$output = @{
    hookSpecificOutput = @{
        hookEventName     = 'SubagentStart'
        additionalContext = $contextBlock
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Output $output
exit 0
