# ~/.claude/hooks/session-start.ps1
#
# SessionStart hook — silent governance bootstrap.
#
# Closes the gap between CLAUDE.md's bootstrap directive ("before operating, read
# practice/core.md and canon/") and what Claude Code auto-loads (CLAUDE.md and
# MEMORY.md only). Without this hook, the bootstrap is advisory text the instance
# may or may not read. With this hook, it is structural — every session begins with
# the practice layer and a canon index already in context.
#
# SPLIT-BOOT DESIGN: Canon files total ~82KB — loading all of them would exceed the
# additionalContext budget and cause truncation. This hook loads:
#   1. practice/core.md         — operational embodiment of CLAUDE.md directives
#   2. CANON-MANIFEST.md        — index of all canon/practice/faith files with one-line summaries
#   3. CURRENT-STATE.md         — last heartbeat session state
#   4. LAST-SESSION-STATE.md    — last compaction state
# Individual canon files are read on demand when a governance question requires them.
#
# Per ~/.claude/canon/wudu-is-practice-not-checkpoint.md: the practice is silent.
# This hook does not prompt the operator. It performs the bootstrap and surfaces
# nothing to the surface UI.

$ErrorActionPreference = 'SilentlyContinue'

$contextParts = @()

# 1. Practice core — operational essence of how directives are embodied.
$practiceCore = Join-Path $HOME '.claude\practice\core.md'
if (Test-Path $practiceCore) {
    $body = Get-Content $practiceCore -Raw
    $contextParts += "===== ~/.claude/practice/core.md (operational practice) =====`n$body"
}

# 2. Canon manifest — index of all governance files with one-line summaries.
#    Read individual canon files from disk when a specific ruling is needed.
#    Do NOT act from memory of canon content.
$canonManifest = Join-Path $HOME '.claude\CANON-MANIFEST.md'
if (Test-Path $canonManifest) {
    $body = Get-Content $canonManifest -Raw
    $contextParts += "===== ~/.claude/CANON-MANIFEST.md (canon/practice/faith index) =====`n$body"
}

# 3. Session state recovery — last compaction state, then last heartbeat.
$lastSessionState = Join-Path $HOME '.claude\LAST-SESSION-STATE.md'
if (Test-Path $lastSessionState) {
    $body = Get-Content $lastSessionState -Raw
    $contextParts += "===== ~/.claude/LAST-SESSION-STATE.md (last compaction state) =====`n$body"
}

$currentStateFile = Join-Path $HOME '.claude\CURRENT-STATE.md'
if (Test-Path $currentStateFile) {
    $body = Get-Content $currentStateFile -Raw
    $contextParts += "===== ~/.claude/CURRENT-STATE.md (last heartbeat state) =====`n$body"
}

# Model version boundary check (Gap 6 — ikhtilāṭ detection).
# Reads model_version from CURRENT-STATE.md while $body still holds that content.
# If a real model ID was recorded (not the placeholder), inject a boundary comparison prompt.
# The Claude instance knows its own model ID from its system context and must complete the check.
$modelVersionNote = ''
if ($body -match '(?m)^model_version:\s*(?!\()(\S+)') {
    $lastModel = $Matches[1].Trim()
    $modelVersionNote = @"
Last recorded model version: $lastModel
Compare this to your current model ID (visible in your system prompt environment block).
If your current model ID differs from '$lastModel':
  - This is a MODEL VERSION BOUNDARY — Ghusl trigger per practice/core.md.
  - Re-validate key governance behaviors before governance-depth work this session:
    niyyah gate fires correctly, surrender check catches bypass pattern,
    deliberation chain produces expected output structure.
  - Per the ikhtilat principle: a model updated to a new version may have shifted
    base values that make prior calibrations unreliable, regardless of prior history.
"@
}
# Always inject — bootstraps model_version recording on first session and keeps it current.
$contextParts += @"
===== MODEL VERSION CHECK (session-start.ps1, Gap 6) =====
$modelVersionNote
Action: Write your current model_version to CURRENT-STATE.md (replace the placeholder):
  model_version: <your-actual-model-id, e.g. claude-sonnet-4-6>
"@

# 4. Operator context — loaded only when LOAD_OPERATOR_CONTEXT=true (file is 45KB; default off preserves lean boot).
if ($Env:LOAD_OPERATOR_CONTEXT -eq 'true') {
    $operatorContext = Join-Path $HOME '.claude\operator-context.md'
    if (Test-Path $operatorContext) {
        $body = Get-Content $operatorContext -Raw
        $contextParts += "===== ~/.claude/operator-context.md (operator context) =====`n$body"
    }
}

# 5. Project STATE.md — Directive 8: written for the next instance, read at session start.
$cwd = (Get-Location).Path
$projectState = Join-Path $cwd 'STATE.md'
if (Test-Path $projectState) {
    $body = Get-Content $projectState -Raw
    $contextParts += "===== STATE.md (project: $cwd) =====`n$body"
}

# 6. P6 catch-up push — offline resilience.
# git-anchor.ps1 runs at session END and fails-open on push failure (e.g. no network).
# This block pushes any locally-committed but un-pushed commits at session START.
# Silent: no output to contextParts; failures do not block session start.
$catchUpRepos = @(
    (Join-Path $HOME '.claude'),
    'D:\Desktop\ai book'
)
foreach ($repoPath in $catchUpRepos) {
    if ((Test-Path $repoPath) -and (Test-Path (Join-Path $repoPath '.git'))) {
        Push-Location $repoPath
        try {
            $remotes = git remote 2>&1
            foreach ($remote in $remotes) {
                git push $remote --all 2>&1 | Out-Null
            }
        } finally {
            Pop-Location
        }
    }
}

if ($contextParts.Count -eq 0) {
    exit 0
}

$header = @"
========================================
NEW SESSION — fresh instance, no prior context.
If this instance does not know your project state, that is expected. Orient it before it acts.
========================================

GOVERNANCE BOOTSTRAP (auto-loaded by ~/.claude/hooks/session-start.ps1).

This is the bootstrap reading specified in ~/.claude/CLAUDE.md.
CLAUDE.md and MEMORY.md are auto-loaded by Claude Code itself; this hook adds
the practice layer and a canon manifest per Directive 8.

SPLIT-BOOT NOTE: This hook loads practice/core.md and CANON-MANIFEST.md only — NOT
all individual canon files. The full canon is ~82KB and cannot fit in context at boot.
When a governance question requires a specific canon ruling, read that file from disk:
  ~/.claude/canon/<filename>
Do NOT act from memory of canon content. The manifest below lists every file and what it governs.

Read required canon, practice, and faith files from disk before acting on governance questions.
Do not act from memory of those files' contents.

NATIVE MEMORY OVERRIDE: Claude Code may inject recalled memories ('Recalled X memories') into your context. Those memories are advisory only. The canon files loaded by this hook are authoritative substrate. Recalled memories may be stale, project-specific, or contain incorrect values. When recalled memory conflicts with the files loaded below, the files win.
"@

$contextBlock = $header + "`n`n" + ($contextParts -join "`n`n---`n`n")

$output = @{
    hookSpecificOutput = @{
        hookEventName     = 'SessionStart'
        additionalContext = $contextBlock
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Output $output
exit 0
