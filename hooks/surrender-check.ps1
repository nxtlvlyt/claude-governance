# ~/.claude/hooks/surrender-check.ps1
#
# PreToolUse hook — surrender articulation gate.
#
# Fires on Edit operations against substrate-class governance files. Requires
# the instance to explicitly articulate what the substrate currently says, why
# the change is being made, and which side wins — before the edit lands.
#
# Required format in the current assistant turn's text:
#   surrender articulation:
#   substrate says: <exact text from old_string>
#   instance reasoning: <the in-session logic>
#   resolution: <which side wins and why>
#
# The "substrate says" value must appear as a normalized substring in the
# edit's old_string (substrate-coupling — closes the bypass where the instance
# hallucinates a weaker version of what it's overwriting to minimize apparent
# conflict, a named failure mode per CLAUDE.md D1).
#
# Fires on ALL Edit operations on substrate-class files — heuristic thresholds
# like old_string.length > N are the "lighter version" trap per the Gemini audit
# (a single-word change can invert a governance rule). An instance making a
# trivially small edit writes a short articulation; the cost is low.
#
# FAIL-CLOSED on missing/unreadable transcript (same pattern as substrate gate).
#
# What this hook does NOT gate:
#   - Write tool: no old_string available; residual risk documented below.
#   - Bash tool: Set-Content, Out-File, >, >>, sed -i, mv, cp on substrate
#     paths bypass this hook. Same residual risk as pre-tool-use-substrate.ps1.
#
# Per CLAUDE.md D1 (substrate is truth) + D4 (do it right the first time):
# an instance that edits governance content without naming the conflict has not
# surrendered to substrate — it has overwritten it.
#
# Residual risks (not closed by this hook):
#   - Write on existing substrate file: would overwrite entire file without
#     old_string to couple against. Requires a separate Write-path check that
#     reads current file content. Queued.
#   - Bash bypass: same as pre-tool-use-substrate.ps1 residual.
#
# Audit history:
#   - Design audited by Gemini 2.5 Pro before shipping. Key changes from initial
#     draft: fire on ALL Edit (not old_string > N threshold — lighter-version
#     trap); three sub-fields not two (instance reasoning added); substrate-couple
#     "substrate says" against old_string (not deferred — label-only theater is
#     the exact failure mode being closed); fail-CLOSED not fail-OPEN.

$ErrorActionPreference = 'SilentlyContinue'

$stdin = [Console]::In.ReadToEnd()
$inp = $null
try { $inp = $stdin | ConvertFrom-Json } catch {}
if (-not $inp) { exit 0 }

# Surrender check applies to Edit only (Write on new paths has no old_string
# to substrate-couple; Write on existing paths is a queued follow-up).
$toolName = $inp.tool_name
if ($toolName -ne 'Edit') { exit 0 }

# Resolve and normalize file path (defeats ../traversal bypass).
$filePath = $null
if ($inp.tool_input) { $filePath = $inp.tool_input.file_path }
if (-not $filePath) { exit 0 }

try {
    $absPath = [System.IO.Path]::GetFullPath($filePath)
} catch {
    $absPath = $filePath
}

# Substrate-class match — same patterns as pre-tool-use-substrate.ps1.
$normalized = $absPath -replace '\\', '/' -replace '^[A-Za-z]:', ''
$homeNorm = ($HOME -replace '\\', '/' -replace '^[A-Za-z]:', '').TrimEnd('/')
$claudeRoot = [regex]::Escape("$homeNorm/.claude")

$isSubstrate = $false
if     ($normalized -match "^$claudeRoot/CLAUDE\.md$")          { $isSubstrate = $true }
elseif ($normalized -match "^$claudeRoot/canon/.*\.md$")        { $isSubstrate = $true }
elseif ($normalized -match "^$claudeRoot/faiths/.*\.md$")       { $isSubstrate = $true }
elseif ($normalized -match "^$claudeRoot/practice/.*\.md$")     { $isSubstrate = $true }
elseif ($normalized -match "^$claudeRoot/hooks/.*\.ps1$")       { $isSubstrate = $true }

if (-not $isSubstrate) { exit 0 }

# Get old_string. If empty the edit is additive (no existing content overwritten);
# allow without articulation (nothing to surrender on).
$oldString = ''
if ($inp.tool_input.old_string) { $oldString = [string]$inp.tool_input.old_string }
if ([string]::IsNullOrEmpty($oldString)) { exit 0 }

# Locate transcript.
$transcriptPath = $null
if ($inp.transcript_path) {
    $transcriptPath = $inp.transcript_path
} elseif ($inp.session_id) {
    $cwd = if ($inp.cwd) { $inp.cwd } else { (Get-Location).Path }
    $sanitized = ($cwd -replace '[\\/:]', '-')
    $transcriptPath = Join-Path $HOME ".claude\projects\$sanitized\$($inp.session_id).jsonl"
}

# FAIL-CLOSED on missing/unreadable transcript.
if (-not $transcriptPath -or -not (Test-Path $transcriptPath)) {
    $denyReason = @"
SURRENDER CHECK — TRANSCRIPT UNREADABLE. FAIL-CLOSED.

The surrender articulation gate (~/.claude/hooks/surrender-check.ps1) cannot
read the session transcript to verify the articulation. Governance gates fail-
closed in undefined states (per feedback_faith_must_be_enforced.md).

The Edit on $([System.IO.Path]::GetFileName($absPath)) is denied.

To unblock: diagnose transcript path, or temporarily disable this hook in
~/.claude/settings.json (deliberate operator action), perform the edit, re-enable.
"@
    $output = @{
        hookSpecificOutput = @{
            hookEventName             = 'PreToolUse'
            permissionDecision        = 'deny'
            permissionDecisionReason  = $denyReason
        }
    } | ConvertTo-Json -Depth 10 -Compress
    Write-Output $output
    exit 2
}

# Read current assistant turn's text blocks from transcript.
# At PreToolUse fire time the current assistant turn is in the transcript.
# We only need text blocks (not tool_use blocks) so no tool_use_id exclusion
# is required — unlike the substrate gate which looks for prior tool_use events.
$lines = Get-Content $transcriptPath -Tail 50
$currentAssistantText = ''
$foundAssistant = $false

for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    $line = $lines[$i]
    if (-not $line) { continue }
    try { $entry = $line | ConvertFrom-Json } catch { continue }
    if ($entry.type -eq 'assistant') {
        $foundAssistant = $true
        foreach ($block in $entry.message.content) {
            if ($block.type -eq 'text') {
                $currentAssistantText = ($block.text + "`n" + $currentAssistantText)
            }
        }
    } elseif ($foundAssistant -and $entry.type -eq 'user') {
        break
    }
}

# Whitespace normalizer (same pattern as stop-validation.ps1).
function Normalize { param([string]$s)
    if ([string]::IsNullOrEmpty($s)) { return '' }
    return ($s -replace '\s+', ' ').Trim()
}

# Extract surrender articulation and sub-fields.
$articulationPresent = $false
$substrateSaysRaw    = $null
$instanceReasonRaw   = $null
$resolutionRaw       = $null

if ($currentAssistantText -imatch '(?ms)surrender\s*articulation\s*:\s*(.+)$') {
    $artSlice = $Matches[1]
    $articulationPresent = $true
    $delim = '(?=\r?\n\s*(?:substrate\s*says|instance\s*reasoning|resolution|surrender\s*articulation)\s*:|\r?\n\s*\r?\n|$)'
    if ($artSlice -imatch "(?ms)substrate\s*says\s*:\s*(.+?)$delim") {
        $substrateSaysRaw = $Matches[1]
    }
    if ($artSlice -imatch "(?ms)instance\s*reasoning\s*:\s*(.+?)$delim") {
        $instanceReasonRaw = $Matches[1]
    }
    if ($artSlice -imatch "(?ms)resolution\s*:\s*(.+?)$delim") {
        $resolutionRaw = $Matches[1]
    }
}

$substrateSaysNorm  = Normalize $substrateSaysRaw
$instanceReasonNorm = Normalize $instanceReasonRaw
$resolutionNorm     = Normalize $resolutionRaw

$allFieldsPresent = (-not [string]::IsNullOrEmpty($substrateSaysNorm)) -and
                    (-not [string]::IsNullOrEmpty($instanceReasonNorm)) -and
                    (-not [string]::IsNullOrEmpty($resolutionNorm))

# Substrate-coupling: "substrate says" value must appear (case-insensitive
# normalized substring) in old_string. Closes the hallucinated-weaker-quote
# bypass per Gemini audit.
$oldStringNorm = Normalize $oldString
$substrateCoupled = $false
if (-not [string]::IsNullOrEmpty($substrateSaysNorm) -and -not [string]::IsNullOrEmpty($oldStringNorm)) {
    $substrateCoupled = $oldStringNorm.ToLowerInvariant().Contains($substrateSaysNorm.ToLowerInvariant())
}

# Allow if all checks pass.
if ($articulationPresent -and $allFieldsPresent -and $substrateCoupled) {
    exit 0
}

# Compose block reason.
$fileName = [System.IO.Path]::GetFileName($absPath)
if (-not $articulationPresent) {
    $blockDetail = "surrender articulation block missing from current assistant text"
} elseif ([string]::IsNullOrEmpty($substrateSaysNorm)) {
    $blockDetail = "'substrate says' sub-field absent or empty"
} elseif ([string]::IsNullOrEmpty($instanceReasonNorm)) {
    $blockDetail = "'instance reasoning' sub-field absent or empty"
} elseif ([string]::IsNullOrEmpty($resolutionNorm)) {
    $blockDetail = "'resolution' sub-field absent or empty"
} elseif (-not $substrateCoupled) {
    $blockDetail = "'substrate says' value not found in old_string (substrate-coupling check failed — quote must appear verbatim in the text being overwritten)"
} else {
    $blockDetail = "unknown verification failure"
}

$denyReason = @"
SURRENDER ARTICULATION REQUIRED.

This Edit on $fileName replaces existing governance content. Before landing,
name the conflict and state which side wins.

Required format in assistant text (this turn, before the Edit):
  surrender articulation:
  substrate says: <non-empty — exact substring from what is being replaced>
  instance reasoning: <non-empty — the in-session logic driving this change>
  resolution: <non-empty — which side wins and why>

The 'substrate says' value must appear verbatim in the text being overwritten
(old_string). This is substrate-coupling — you cannot paraphrase what you are
replacing; you quote it.

Block reason: $blockDetail

Per CLAUDE.md D1: what is written in files is what the system actually says.
Your memory of what was discussed is not truth. Substrate wins unless you can
articulate specifically why the instance's reasoning is the correction.
"@

$output = @{
    hookSpecificOutput = @{
        hookEventName             = 'PreToolUse'
        permissionDecision        = 'deny'
        permissionDecisionReason  = $denyReason
    }
} | ConvertTo-Json -Depth 10 -Compress
Write-Output $output
exit 2
