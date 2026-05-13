# ~/.claude/hooks/pre-tool-use-substrate.ps1
#
# PreToolUse hook — HARD fail-closed gate on substrate-class edits.
#
# Replaces the prior soft surface (which injected a reminder and allowed the
# edit) with structural enforcement: refuses the Edit/Write/NotebookEdit
# unless the session transcript shows a foreign-frontier dispatch since the
# most recent prior substrate edit (or session start if none).
#
# The substrate-class targets:
#   - ~/.claude/CLAUDE.md (scripture)
#   - ~/.claude/canon/*.md (canon rulings)
#   - ~/.claude/faiths/*.md (Faith files)
#   - ~/.claude/practice/*.md (practice layer, including extended/)
#   - ~/.claude/hooks/*.ps1 (enforcement layer itself — protects against
#     a model rewriting the gate to allow itself through)
#
# What this hook closes (per ~/.claude/canon/delegation-and-stall-discipline.md
# "cited-but-not-applied"):
#
#   "the structural enforcement layer that the ummah parallel above already
#    names — a Stop hook reading the JSONL transcript for the dispatch tool
#    use, refusing turn-end without it."
#
# This is the PreToolUse-on-substrate-edits equivalent of that Stop hook.
# Each substrate edit attempt must be witnessed by a foreign-frontier
# dispatch on the change-shape — same-tribe self-validation (Claude/Opus
# auditing Claude/Opus) is the failure mode the canon names.
#
# What this hook does NOT do:
#
# 1. It does not validate that the dispatch was *on the change-shape* of
#    THIS specific edit. The hook performs the structural check; the
#    operator's audit downstream catches misaligned dispatch (model
#    dispatches on file A but edits file B). This is the same precision
#    tradeoff the niyyah gate makes — gate the operation, not the substance.
#
# 2. It does not gate Bash. A model could bypass this hook by using
#    `Set-Content`, `Out-File`, `>`, `>>`, `tee`, `sed -i`, `cp`, `mv`, or
#    similar via the Bash tool. This is a documented residual risk — closing
#    it requires a Bash-matcher hook with substrate-path detection in the
#    command string. Queued for a follow-up wire.
#
# 3. It does not gate parent directory creation, file moves, or filesystem
#    metadata operations. Same residual risk as #2.
#
# Failure modes:
#
# - Transcript missing/unreadable: FAIL-CLOSED (deny the edit). Per the
#   canon, governance gates must fail-closed in undefined states. A
#   quietable governance hook is a bypass surface. The deny reason
#   surfaces the diagnosis path so the operator can recover.
#
# - Transcript present but no foreign-frontier dispatch since last
#   substrate edit: BLOCK with deny reason that names the canon, lists
#   the foreign-frontier transports, and specifies the retry path.
#
# Audit history:
#   - Prior soft version reviewed via mcp__gemini-api-worker on 2026-05-03
#     before this rewrite. Adjustments adopted: path normalization with
#     GetFullPath, fail-closed on missing transcript, hooks/ added to
#     substrate-class, lookback window changed from "last user message" to
#     "last prior substrate edit attempt." Bypass surfaces accepted as
#     residual risk are noted above.

$ErrorActionPreference = 'SilentlyContinue'

$stdin = [Console]::In.ReadToEnd()
$inp = $null
try { $inp = $stdin | ConvertFrom-Json } catch {}

if (-not $inp) { exit 0 }

# Tool name and target file path.
$toolName = $inp.tool_name
if ($toolName -ne 'Edit' -and $toolName -ne 'Write' -and $toolName -ne 'NotebookEdit') {
    exit 0
}

# The tool_use_id of the CURRENT evaluation. PreToolUse fires after the assistant
# message containing this tool_use is in transcript, so a naive walk would treat
# the current attempt as the "most recent prior substrate edit" and self-block.
# Exclude this id from the walk below.
$currentToolUseId = $null
if ($inp.tool_use_id) { $currentToolUseId = [string]$inp.tool_use_id }

$filePath = $null
if ($inp.tool_input) {
    $filePath = $inp.tool_input.file_path
    if (-not $filePath) { $filePath = $inp.tool_input.notebook_path }
}

if (-not $filePath) { exit 0 }

# Resolve absolute path (defeats relative-path / `..` traversal bypass).
try {
    $absPath = [System.IO.Path]::GetFullPath($filePath)
} catch {
    $absPath = $filePath
}

# Normalize for matching.
$normalized = $absPath -replace '\\', '/' -replace '^[A-Za-z]:', ''
$home_norm = ($HOME -replace '\\', '/' -replace '^[A-Za-z]:', '').TrimEnd('/')
$claudeRoot = [regex]::Escape("$home_norm/.claude")

# Substrate-class match.
$isSubstrate = $false
if ($normalized -match "^$claudeRoot/CLAUDE\.md$")          { $isSubstrate = $true }
elseif ($normalized -match "^$claudeRoot/canon/.*\.md$")    { $isSubstrate = $true }
elseif ($normalized -match "^$claudeRoot/faiths/.*\.md$")   { $isSubstrate = $true }
elseif ($normalized -match "^$claudeRoot/practice/.*\.md$") { $isSubstrate = $true }
elseif ($normalized -match "^$claudeRoot/hooks/.*\.ps1$")   { $isSubstrate = $true }

if (-not $isSubstrate) { exit 0 }

# Locate transcript.
$transcriptPath = $null
if ($inp.transcript_path) {
    $transcriptPath = $inp.transcript_path
} elseif ($inp.session_id) {
    $cwd = if ($inp.cwd) { $inp.cwd } else { (Get-Location).Path }
    $sanitized = ($cwd -replace '[\\/:]', '-')
    $transcriptPath = Join-Path $HOME ".claude\projects\$sanitized\$($inp.session_id).jsonl"
}

# FAIL-CLOSED on missing transcript.
if (-not $transcriptPath -or -not (Test-Path $transcriptPath)) {
    $reason = @"
SUBSTRATE-CLASS HARD GATE — TRANSCRIPT UNREADABLE.

This hook (~/.claude/hooks/pre-tool-use-substrate.ps1) cannot validate
foreign-frontier dispatch without the session transcript JSONL. Per
~/.claude/canon/delegation-and-stall-discipline.md, governance gates
fail-closed in undefined states.

The $toolName on $filePath is denied.

Diagnosis paths:
  - transcript_path was not provided in the hook input.
  - The transcript file at the derived path does not exist.
  - Permissions or filesystem transport issue.

To unblock:
  - Diagnose the transcript-path issue, OR
  - Disable this hook in ~/.claude/settings.json (deliberate operator
    action — note that this disables the gate for all subsequent edits
    in the session), perform the edit, re-enable.

This is by design. A quietable governance hook is a bypass surface; a
loud hook is the practice.
"@
    $output = @{
        hookSpecificOutput = @{
            hookEventName = 'PreToolUse'
            permissionDecision = 'deny'
            permissionDecisionReason = $reason
        }
    } | ConvertTo-Json -Depth 10 -Compress
    Write-Output $output
    exit 2
}

# Walk transcript once, collect ordered events.
# An event is either:
#   - 'substrate_edit_attempt' — any prior Edit/Write/NotebookEdit on a
#                                 substrate-class file (success or block;
#                                 the rule treats them the same so that
#                                 retry-after-dispatch is a clean recovery).
#   - 'foreign_frontier_dispatch' — any mcp__(gemini|gpt|grok|glm|ollama)__* tool
#                                    use, OR WebSearch/WebFetch.
#
# Event ordering is by sequential tool_use index across the assistant
# messages in the transcript. Absolute ordering across turns.

# Dual-write fix: In remote-control/subagent architectures, Claude Code provides a
# bridge session JSONL as transcript_path, but assistant tool_use entries (dispatches
# and substrate edit attempts) land in a sibling JSONL. Collect events from the
# primary file AND up to 2 recently modified siblings. Check each file independently
# for the ordering invariant (dispatch after last substrate edit); confirm if ANY file
# passes (avoids cross-file idx ordering ambiguity).

function Get-SubstrateEvents($path, $skipId, $claudeRootPat) {
    $evts = @()
    $i = 0
    if (-not $path -or -not (Test-Path $path)) { return $evts }
    foreach ($line in (Get-Content $path)) {
        if (-not $line) { continue }
        try { $entry = $line | ConvertFrom-Json } catch { continue }
        if ($entry.type -ne 'assistant' -or -not $entry.message.content) { continue }
        foreach ($block in $entry.message.content) {
            if ($block.type -ne 'tool_use') { continue }
            if ($skipId -and ([string]$block.id) -eq $skipId) { continue }
            $i++
            if ($block.name -match '^mcp__(?:gemini|gpt|grok|glm|ollama)' -or
                $block.name -eq 'WebSearch' -or $block.name -eq 'WebFetch') {
                $evts += [pscustomobject]@{ kind = 'dispatch'; idx = $i }; continue
            }
            if ($block.name -in @('Edit','Write','NotebookEdit')) {
                $tp = if ($block.input.file_path) { $block.input.file_path } else { $block.input.notebook_path }
                if (-not $tp) { continue }
                try { $ta = [System.IO.Path]::GetFullPath($tp) } catch { $ta = $tp }
                $tn = $ta -replace '\\','/' -replace '^[A-Za-z]:',''
                if ($tn -match $claudeRootPat) { $evts += [pscustomobject]@{ kind = 'substrate_edit_attempt'; idx = $i } }
            }
        }
    }
    return $evts
}

function Test-DispatchAfterSubstrate($evts) {
    $lastSub = -1
    for ($i = $evts.Count - 1; $i -ge 0; $i--) {
        if ($evts[$i].kind -eq 'substrate_edit_attempt') { $lastSub = $evts[$i].idx; break }
    }
    foreach ($ev in $evts) { if ($ev.kind -eq 'dispatch' -and $ev.idx -gt $lastSub) { return $true } }
    return $false
}

$substratePattern = "^($([regex]::Escape("$home_norm/.claude"))/CLAUDE\.md|$([regex]::Escape("$home_norm/.claude"))/canon/.*\.md|$([regex]::Escape("$home_norm/.claude"))/faiths/.*\.md|$([regex]::Escape("$home_norm/.claude"))/practice/.*\.md|$([regex]::Escape("$home_norm/.claude"))/hooks/.*\.ps1)$"

$events = @()
$dispatchAfter = $false

$events = Get-SubstrateEvents $transcriptPath $currentToolUseId $substratePattern
if (Test-DispatchAfterSubstrate $events) { $dispatchAfter = $true }

if (-not $dispatchAfter) {
    $dir = Split-Path $transcriptPath -Parent
    Get-ChildItem $dir -Filter '*.jsonl' -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -ne $transcriptPath } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 2 |
        ForEach-Object {
            if (-not $dispatchAfter) {
                $sibEvts = Get-SubstrateEvents $_.FullName $currentToolUseId $substratePattern
                if (Test-DispatchAfterSubstrate $sibEvts) { $dispatchAfter = $true }
            }
        }
}

if ($dispatchAfter) {
    exit 0
}

# Block.
$gateContext = if ($lastSubstrateEditIdx -gt 0) {
    "the prior substrate edit in this session"
} else {
    "the start of this session"
}

$reason = @"
SUBSTRATE-CLASS HARD GATE (~/.claude/hooks/pre-tool-use-substrate.ps1).

You are about to $toolName a governance-substrate file:
  $filePath

Per ~/.claude/canon/delegation-and-stall-discipline.md (foreign-frontier
witness rule + cited-but-not-applied failure mode):

  Edits to scripture, canon, Faith, practice, and the enforcement hooks
  themselves are load-bearing — they propagate across every future
  session, every project, every instance. Each substrate edit must be
  witnessed by a foreign-frontier validator on the change-shape itself.
  Same-tribe self-validation (Claude auditing Claude) is the failure
  mode the canon names; foreign-model validation is independent witness.

The transcript shows no foreign-frontier dispatch (mcp__gemini-* /
mcp__gpt-* / mcp__grok-* / mcp__glm-* / mcp__ollama-*
WebSearch / WebFetch) since
$gateContext.

Required next action:

  1. Dispatch a foreign-frontier validator on the change-shape of THIS
     edit. Prompt shape: "I am about to $toolName <path>. Here is the
     change-shape: <what is being added/removed and why>. Audit for
     canon-coherence and bypass surfaces."
  2. Read the validator's response.
  3. Adjust the edit if the validator surfaces issues.
  4. Retry the edit. The gate will pass once the dispatch is in
     transcript.

If all foreign-frontier MCP transports are unavailable: surface the
degradation explicitly to the operator ("foreign-frontier validators
unavailable; degraded mode") rather than editing anyway. Do not bypass
the gate by disabling it for a single edit unless the operator
explicitly authorizes it.

This hook does not validate that the dispatch was on the change-shape
specifically — that is the operator's audit downstream. The hook gates
the structural operation. Per the field report ~/.claude/practice/
extended/drift-and-ratchet.md: "when the foreign-frontier dispatch
starts feeling redundant after a few fires, that feeling is the drift
mode, not principled efficiency. Dispatch anyway. The cost is small
relative to what gets compounded if the dispatch is skipped."
"@

$output = @{
    hookSpecificOutput = @{
        hookEventName = 'PreToolUse'
        permissionDecision = 'deny'
        permissionDecisionReason = $reason
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Output $output
exit 2
