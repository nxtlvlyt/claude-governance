# ~/.claude/hooks/stop-validation.ps1
#
# Stop hook — structural enforcement of delegation-and-stall-discipline.md.
#
# Refuses turn-end when stop-language is detected in the last assistant message
# WITHOUT a foreign-frontier dispatch (mcp__gemini-worker, mcp__gpt-worker,
# mcp__grok-worker, mcp__glm-worker, WebSearch, WebFetch) appearing in the
# recent tool_use blocks.
#
# Per ~/.claude/canon/delegation-and-stall-discipline.md (cited-but-not-applied):
# "the structural enforcement layer that the ummah parallel above already names —
#  a Stop hook reading the JSONL transcript for the dispatch tool use, refusing
#  turn-end without it."
#
# Per ~/.claude/canon/wudu-is-practice-not-checkpoint.md: this hook performs the
# practice silently. Its only surface to the operator is the substantive question
# downstream of re-anchoring (when the model continues after the block, it does so
# from a re-anchored position, not from a "should I have re-anchored" meta-prompt).
#
# === Refinement C — humility-marker structural payload-grep verification ===
# At/above the ratchet threshold (fire 3+), foreign-frontier dispatch alone is
# no longer sufficient: the assistant text must contain a "humility check:"
# marker carrying two SPECIFIC sub-fields (`drift mode: <value>` and
# `material delta: <value>`), AND those normalized values must appear in the
# SAME load-bearing dispatch's input payload. This couples the surface text to
# the dispatched audit so the framing being reviewed is the framing being
# claimed — closing the bypass surface where an instance writes the marker on
# the surface (cosmetic) while the dispatch payload omits it (no actual review
# of the audit framing).
#
# Below threshold (fires 1-2): unchanged. The existing exit-0 path for
# foreign-frontier-present runs untouched, and the marker check does NOT run.
#
# Per Gemini audit (foreign-frontier dispatch on the change-shape):
#   - Whitespace normalization collapses \s+ to single space and trims
#     (NOT aggressive strip-all), preserving word boundaries against
#     false-positive substring collisions.
#   - String extraction from the dispatch input recurses into nested
#     objects/arrays (leaf-string concatenation) so complex payload shapes
#     are not falsely-blocked.
#   - The marker check strictly gates the threshold exit-0 path: presence of
#     a foreign-frontier dispatch is no longer sufficient at fire 3+; the
#     dispatch must also carry the marker payload.
#
# The "load-bearing dispatch" rule: at least ONE foreign-frontier dispatch in
# the turn-block must satisfy BOTH the existing check (it has a foreign-frontier
# tool name) AND the new check (its normalized input payload contains BOTH
# normalized marker values). If the marker fields are split across two
# different dispatches, that is a bypass and the hook blocks.
#
# === Refinement D — prior-verdict-quote sub-field + transcript verification ===
# At/above threshold, adds a THIRD required sub-field to the humility marker:
# `prior verdict quote: <exact text from a prior tool_result>`. The hook reads
# the full session transcript, collects all tool_result content blocks, and
# verifies that the normalized quote value appears as a substring in at least
# one of them. This closes the rationalization named in drift-and-ratchet.md:
# "I cited the prior dispatch and continued" — an instance can write any quote
# string; the transcript-coupling forces the quote to match an actual prior
# result rather than a plausible-sounding paraphrase.
#
# The dispatch payload check (drift mode + material delta) is unchanged; the
# quote is verified against transcript tool_results only (it comes FROM a result,
# not into one). Distinct block reasons surface each failure mode clearly.

$ErrorActionPreference = 'SilentlyContinue'

# Read hook input from stdin.
$stdin = [Console]::In.ReadToEnd()
$inp = $null
try { $inp = $stdin | ConvertFrom-Json } catch {}

if (-not $inp) { exit 0 }

# Locate transcript JSONL.
$transcriptPath = $null
if ($inp.transcript_path) {
    $transcriptPath = $inp.transcript_path
} elseif ($inp.session_id) {
    # Fallback: derive from session_id and cwd (if provided).
    $cwd = if ($inp.cwd) { $inp.cwd } else { (Get-Location).Path }
    $sanitized = ($cwd -replace '[\\/:]', '-')
    $transcriptPath = Join-Path $HOME ".claude\projects\$sanitized\$($inp.session_id).jsonl"
}

if (-not $transcriptPath -or -not (Test-Path $transcriptPath)) {
    # Can't validate without transcript; fail-open (do not block).
    exit 0
}

# Read the last 30 entries — enough to capture the most recent assistant turn
# plus its tool_use context, but bounded for speed.
$lines = Get-Content $transcriptPath -Tail 30

# Walk in reverse to find the LAST assistant entry. Collect its text blocks
# and ALL tool_use names from that single most-recent assistant turn.
$lastAssistantText = ''
$lastTurnToolUses = @()
# Refinement C: also capture the FULL tool_use blocks (name + input) so the
# threshold path can grep dispatch input payloads. We retain $lastTurnToolUses
# (names only) for the existing foreign-frontier check; $lastTurnToolUseBlocks
# carries the input objects for the marker-payload verification.
$lastTurnToolUseBlocks = @()
$foundAssistant = $false

for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    $line = $lines[$i]
    if (-not $line) { continue }
    try {
        $entry = $line | ConvertFrom-Json
    } catch { continue }

    if ($entry.type -eq 'assistant') {
        $foundAssistant = $true
        $content = $entry.message.content
        if (-not $content) { continue }
        foreach ($block in $content) {
            if ($block.type -eq 'text') {
                $lastAssistantText = ($block.text + "`n" + $lastAssistantText)
            } elseif ($block.type -eq 'tool_use') {
                $lastTurnToolUses += $block.name
                $lastTurnToolUseBlocks += $block
            }
        }
    } elseif ($foundAssistant -and $entry.type -eq 'user') {
        # We've walked past the start of the last assistant turn. Stop.
        break
    }
}

if (-not $lastAssistantText) {
    # No text surface in the last assistant turn (e.g., pure tool_use turn).
    # No stop-language possible. Allow.
    exit 0
}

# Stop-language patterns (case-insensitive). Tight enough to catch the canonical
# drift without false-positiving on benign use. Each pattern is paired with the
# canon-named failure mode it matches.
#
# NOTE on false positives: discussing the patterns themselves (e.g., quoting
# them while explaining the hook) will trigger this hook. That is BY DESIGN —
# the louder hook is the principled refinement; a hook that ignored quoted
# instances would be a bypass surface (instance could wrap actual deferral in
# backticks to dodge). Per the canon, the practice when the hook fires on a
# meta-reference is the same as when it fires on a real reach: dispatch the
# foreign-frontier validator on the framing, then continue. The cost of a
# spurious dispatch is small; the cost of a quietable hook is large.
$stopLanguagePatterns = @(
    'want me to\b',                       # canon-named
    '\byour call\b',                      # canon-named
    '\bshould I (?:proceed|continue|do|wire|ship|fire|run|pull|build|start|go)',
    '\boperator decision\b',              # canon-named
    'stopping (?:here|for now)',          # canon-named
    'ready (?:when you are|to (?:proceed|continue|ship))',
    '\bstanding by\b',                    # canon-named: drift signal
    'let me know if you'                  # passive deferral
)

$matchedPattern = $null
foreach ($pat in $stopLanguagePatterns) {
    if ($lastAssistantText -imatch $pat) {
        $matchedPattern = $Matches[0]
        break
    }
}

if (-not $matchedPattern) {
    exit 0
}

# Stop-language fired. Check for foreign-frontier dispatch in this turn's tool calls.
$foreignFrontierFired = $false
foreach ($name in $lastTurnToolUses) {
    if ($name -match '^mcp__(?:gemini|gpt|grok|glm|ollama)' -or
        $name -eq 'WebSearch' -or
        $name -eq 'WebFetch') {
        $foreignFrontierFired = $true
        break
    }
}

# === Refinement C — read prior ratchet counter EARLY ===
# We need to know the prior count before deciding whether the dispatch-present
# exit-0 path is sufficient. At/above threshold the marker check gates it.
# Below threshold the existing behavior holds (dispatch → exit 0).
#
# Per ~/.claude/practice/extended/drift-and-ratchet.md: discipline lowers across
# repeat fires within a session. The counter surfaces that pattern back to the
# instance so the Nth fire reads louder than the first.
#
# Failure-closed semantics (per feedback_faith_must_be_enforced.md):
# On state-file read failure, treat as $RATCHET_THRESHOLD (not 1). The ratchet
# IS the failure mode being gated; a corrupted state file must not silently
# suppress detection. This parallels pre-tool-use-substrate.ps1's fail-closed-
# on-missing-transcript pattern; the opposite choice (fail-open) belongs to
# bootstrap-class hooks like niyyah-gate.ps1, not failure-class hooks like this.
# Reference the threshold via constant so future tuning of the threshold does
# not silently revert the failure-closed default. Use Set-Variable -Option
# Constant so a runtime variable overwrite cannot bypass the gate.
# On read failure, skip state-file write-back: the file is unreadable/locked; mutating
# it can throw and obscures the corruption. Hold the failure-closed value in memory and
# fire the gate.
Set-Variable -Name 'RATCHET_THRESHOLD' -Value 3 -Option Constant -Scope Local -ErrorAction SilentlyContinue
$ratchetCount = 0
$priorCount = 0
$ratchetHeader = ''
$sessionId = $inp.session_id
$readDegraded = $false
$stateFile = $null

if ($sessionId) {
    $stateDir = Join-Path $HOME '.claude\state'
    if (-not (Test-Path $stateDir)) {
        try {
            New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
        } catch {
            [Console]::Error.WriteLine("stop-validation: failed to create state dir '$stateDir': $($_.Exception.Message)")
        }
    }

    $stateFile = Join-Path $stateDir "stop-ratchet-$sessionId.txt"
    $readOk = $true

    if (Test-Path $stateFile) {
        try {
            $raw = Get-Content $stateFile -Raw -ErrorAction Stop
            $parsed = 0
            if ([int]::TryParse(($raw -as [string]).Trim(), [ref]$parsed)) {
                $priorCount = $parsed
            } else {
                throw "non-integer contents"
            }
        } catch {
            $readOk = $false
            $readDegraded = $true
            [Console]::Error.WriteLine("stop-validation: state-file read FAILED on '$stateFile' ($($_.Exception.Message)); defaulting to failure-CLOSED (RatchetCount forced to $RATCHET_THRESHOLD)")
        }
    }

    if (-not $readOk) {
        # Degraded mode: failure-CLOSED. Force priorCount to threshold so the
        # marker check engages on this fire even under corrupt state.
        $priorCount = $RATCHET_THRESHOLD
    }
}

# Threshold predicate: this fire would be at/above the ratchet threshold.
# Definition: priorCount + 1 >= THRESHOLD. Once a session has had THRESHOLD-1
# qualifying fires, the NEXT fire (qualifying or not) is at/above threshold —
# the ratchet ratchets. This is the substrate-true reading of "at/above
# threshold" per drift-and-ratchet.md: discipline DOES NOT reset just because
# the next fire happens to carry a dispatch.
$atThreshold = ($priorCount + 1) -ge $RATCHET_THRESHOLD

# === Refinement C+D — helper functions ===

function Get-AllStringLeaves {
    # Recursively walk a value (PSCustomObject, hashtable, array, scalar) and
    # return all string-typed leaf values. Per Gemini audit: complex payload
    # shapes (nested objects, arrays of strings) must contribute their leaf
    # strings, otherwise the substring match falsely fails on legitimate
    # dispatches.
    param([Parameter(Mandatory = $false)] $Value)
    $out = New-Object System.Collections.ArrayList
    if ($null -eq $Value) { return @() }
    if ($Value -is [string]) {
        [void]$out.Add($Value)
        return ,$out.ToArray()
    }
    if ($Value -is [System.Collections.IDictionary]) {
        foreach ($k in $Value.Keys) {
            foreach ($leaf in (Get-AllStringLeaves -Value $Value[$k])) {
                [void]$out.Add($leaf)
            }
        }
        return ,$out.ToArray()
    }
    # Treat enumerables (arrays, lists) — but exclude strings (already handled).
    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        foreach ($item in $Value) {
            foreach ($leaf in (Get-AllStringLeaves -Value $item)) {
                [void]$out.Add($leaf)
            }
        }
        return ,$out.ToArray()
    }
    # PSCustomObject (most common shape from ConvertFrom-Json).
    if ($Value.PSObject -and $Value.PSObject.Properties) {
        foreach ($prop in $Value.PSObject.Properties) {
            foreach ($leaf in (Get-AllStringLeaves -Value $prop.Value)) {
                [void]$out.Add($leaf)
            }
        }
        return ,$out.ToArray()
    }
    # Other scalar types (int, bool, etc.) contribute nothing to text search.
    return @()
}

function Normalize-Whitespace {
    # Per Gemini audit: collapse \s+ to a single space and trim — preserve
    # word boundaries. Aggressive strip-all (\s -> '') invites false-positive
    # substring collisions and was rejected.
    param([string]$s)
    if ([string]::IsNullOrEmpty($s)) { return '' }
    return ($s -replace '\s+', ' ').Trim()
}

function Test-MarkerInDispatch {
    # Returns $true if the given normalized-payload string contains BOTH
    # normalized values as substrings (case-insensitive).
    param([string]$Payload, [string]$DriftValue, [string]$DeltaValue)
    if ([string]::IsNullOrEmpty($Payload)) { return $false }
    if ([string]::IsNullOrEmpty($DriftValue)) { return $false }
    if ([string]::IsNullOrEmpty($DeltaValue)) { return $false }
    $p = $Payload.ToLowerInvariant()
    $d = $DriftValue.ToLowerInvariant()
    $m = $DeltaValue.ToLowerInvariant()
    return ($p.Contains($d)) -and ($p.Contains($m))
}

function Get-ToolResultTexts {
    # Refinement D: Walk all JSONL lines, collecting text from tool_result
    # content blocks (user-turn entries). Returns an array of strings.
    # The content field of a tool_result block can be:
    #   - a plain string
    #   - an array of content blocks (each with type:'text' and text:'...')
    # Both shapes are handled.
    param([string[]]$TranscriptLines)
    $out = New-Object System.Collections.ArrayList
    foreach ($line in $TranscriptLines) {
        if (-not $line) { continue }
        try {
            $entry = $line | ConvertFrom-Json
        } catch { continue }
        if ($entry.type -ne 'user') { continue }
        $content = $entry.message.content
        if (-not $content) { continue }
        foreach ($block in $content) {
            if ($block.type -ne 'tool_result') { continue }
            if ($block.content -is [string]) {
                [void]$out.Add($block.content)
            } elseif ($block.content) {
                foreach ($cb in $block.content) {
                    if ($cb.type -eq 'text' -and $cb.text) {
                        [void]$out.Add($cb.text)
                    }
                }
            }
        }
    }
    return ,$out.ToArray()
}

# Marker extraction. The marker is located ONLY in the slice of assistant text
# starting at the literal token "humility check:" so a quoted/discussed marker
# elsewhere does not mask a missing real one. Capture each sub-field's value
# from after its label up to (a) the next sub-field label or (b) a blank line
# or (c) end-of-text. Multi-line values (e.g. a bullet on the next line) are
# preserved per Gemini audit. Empty/whitespace-only values count as absent.
#
# Sub-field delimiter alternation includes all three sub-field labels so each
# field's capture stops at the next sibling label.
$markerPresent = $false
$driftValueRaw = $null
$deltaValueRaw = $null
$quoteValueRaw = $null

if ($lastAssistantText -imatch '(?ms)humility\s*check\s*:\s*(.+)$') {
    $markerSlice = $Matches[1]
    $markerPresent = $true
    $subFieldDelim = '(?=\r?\n\s*(?:material\s*delta|drift\s*mode|humility\s*check|prior\s*verdict\s*quote)\s*:|\r?\n\s*\r?\n|$)'
    if ($markerSlice -imatch "(?ms)drift\s*mode\s*:\s*(.+?)$subFieldDelim") {
        $driftValueRaw = $Matches[1]
    }
    if ($markerSlice -imatch "(?ms)material\s*delta\s*:\s*(.+?)$subFieldDelim") {
        $deltaValueRaw = $Matches[1]
    }
    if ($markerSlice -imatch "(?ms)prior\s*verdict\s*quote\s*:\s*(.+?)$subFieldDelim") {
        $quoteValueRaw = $Matches[1]
    }
}

$driftValueNorm  = Normalize-Whitespace $driftValueRaw
$deltaValueNorm  = Normalize-Whitespace $deltaValueRaw
$quoteValueNorm  = Normalize-Whitespace $quoteValueRaw

# $twoFieldsPresent: drift + delta both non-empty (required for dispatch payload check).
# $quotePresent: prior verdict quote non-empty (required for transcript verification).
# $markerValuesPresent: all three required sub-fields are present.
$twoFieldsPresent  = (-not [string]::IsNullOrEmpty($driftValueNorm)) -and (-not [string]::IsNullOrEmpty($deltaValueNorm))
$quotePresent      = -not [string]::IsNullOrEmpty($quoteValueNorm)
$markerValuesPresent = $twoFieldsPresent -and $quotePresent

# Walk every foreign-frontier dispatch in the turn-block and compute, per
# dispatch, whether its normalized payload contains drift / delta values.
# (Quote verification is against transcript tool_results, not dispatch input.)
$loadBearingFound = $false       # one dispatch contains BOTH drift + delta values
$anyDriftHit = $false             # at least one dispatch contains drift
$anyDeltaHit = $false             # at least one dispatch contains delta

if ($twoFieldsPresent) {
    foreach ($block in $lastTurnToolUseBlocks) {
        $name = $block.name
        $isFF = ($name -match '^mcp__(?:gemini|gpt|grok|glm|ollama)') -or ($name -eq 'WebSearch') -or ($name -eq 'WebFetch')
        if (-not $isFF) { continue }
        $leaves = @()
        try {
            $leaves = Get-AllStringLeaves -Value $block.input
        } catch {
            # Defensive: skip malformed input objects rather than crash the hook.
            continue
        }
        $payload = Normalize-Whitespace (($leaves -join ' '))
        $hasDrift = $false
        $hasDelta = $false
        if (-not [string]::IsNullOrEmpty($payload)) {
            $pLower = $payload.ToLowerInvariant()
            $hasDrift = $pLower.Contains($driftValueNorm.ToLowerInvariant())
            $hasDelta = $pLower.Contains($deltaValueNorm.ToLowerInvariant())
        }
        if ($hasDrift) { $anyDriftHit = $true }
        if ($hasDelta) { $anyDeltaHit = $true }
        if ($hasDrift -and $hasDelta) { $loadBearingFound = $true }
    }
}

# Threshold-gated decision on the foreign-frontier exit-0 path.
# Below threshold: foreign-frontier dispatch alone suffices (existing behavior).
# At/above threshold: dispatch + marker (all three sub-fields) + payload-grep
#   (drift+delta in load-bearing dispatch) + quote-in-transcript all required.
$markerBlockReason = $null
if ($foreignFrontierFired) {
    if (-not $atThreshold) {
        # Below threshold: existing behavior — dispatch present, allow stop.
        # Non-qualifying fire: do NOT increment the ratchet counter.
        exit 0
    }

    # At threshold with dispatch present — apply full marker checks (C + D).
    if (-not $markerPresent -or -not $twoFieldsPresent) {
        # Marker absent or drift/delta fields missing.
        $markerBlockReason = @"
RATCHET DETECTED — humility-check marker required at fire 3+.

Format: ``humility check:`` followed by three sub-fields:
  drift mode: <specific value>
  material delta: <specific value>
  prior verdict quote: <exact quote from a prior tool_result>

The marker must be present in surface text AND both drift/delta values must appear in the same foreign-frontier dispatch input payload. The prior verdict quote must match text in a prior transcript tool_result.

Per ~/.claude/practice/extended/drift-and-ratchet.md: at the threshold the dispatch alone is no longer enough. Name the specific drift mode, the specific material delta, and quote the actual prior audit verdict — not a paraphrase.
"@
    } elseif (-not $quotePresent) {
        # Drift + delta present but prior verdict quote sub-field missing (Refinement D).
        $markerBlockReason = @"
RATCHET DETECTED — prior verdict quote sub-field required at fire 3+ (Refinement D).

The humility check: marker requires three sub-fields at fire 3+:
  drift mode: <specific value>        ✓ present
  material delta: <specific value>    ✓ present
  prior verdict quote: <exact quote>  ✗ MISSING

The quote must be verbatim text from a prior tool_result in this session's transcript. This closes the cited-but-not-applied rationalization named in drift-and-ratchet.md: "I cited the prior dispatch and continued." Citing is not engaging. The quote forces substrate-coupling with what the prior audit actually said.
"@
    } elseif (-not $loadBearingFound) {
        if ($anyDriftHit -and $anyDeltaHit) {
            # Values both present somewhere, but split across dispatches.
            $markerBlockReason = @"
RATCHET DETECTED — marker fields appear in different dispatches.

Both ``drift mode`` and ``material delta`` must be in the SAME load-bearing dispatch payload. Splitting the audit framing across two dispatches breaks the coupling the gate is enforcing — the foreign-frontier read must see the COMPLETE framing it is auditing.

Re-dispatch a single foreign-frontier validator whose input contains both fields together.
"@
        } else {
            # Marker present in surface text but not propagated.
            $markerBlockReason = @"
RATCHET DETECTED — humility-check marker present in surface text but not propagated into the foreign-frontier dispatch payload.

Per the audit pattern: passing the marker into the dispatch enables external review of the audit framing. A marker on surface text alone is cosmetic; the dispatch payload must carry the same drift-mode and material-delta values so the foreign frontier can audit the framing being claimed.

Re-dispatch with the marker values in the prompt/task input.
"@
        }
    } else {
        # Load-bearing dispatch found. Now verify prior verdict quote against transcript
        # tool_results (Refinement D). Read the full transcript for this check.
        $quoteFoundInTranscript = $false
        try {
            $allTranscriptLines = Get-Content $transcriptPath -ErrorAction Stop
            $toolResultTexts = Get-ToolResultTexts -TranscriptLines $allTranscriptLines
            foreach ($txt in $toolResultTexts) {
                $norm = Normalize-Whitespace $txt
                if ($norm.ToLowerInvariant().Contains($quoteValueNorm.ToLowerInvariant())) {
                    $quoteFoundInTranscript = $true
                    break
                }
            }
        } catch {
            # Fail-open on transcript read error for the quote check: the dispatch
            # and drift/delta payload checks have already passed; a file-read
            # failure here should not block an otherwise-valid compliant turn.
            [Console]::Error.WriteLine("stop-validation: transcript read for quote-verification FAILED ($($_.Exception.Message)); skipping quote check (fail-open for D-only failure)")
            $quoteFoundInTranscript = $true
        }

        if ($quoteFoundInTranscript) {
            # All checks pass — dispatch + marker + payload + quote. Allow stop.
            # Non-qualifying fire: do NOT increment the ratchet counter.
            exit 0
        } else {
            $markerBlockReason = @"
RATCHET DETECTED — prior verdict quote not found in transcript tool_results.

The ``prior verdict quote: <value>`` sub-field must contain text that appears verbatim in some prior tool_result block in this session's transcript. The hook searched all tool_result entries and the normalized quote was not found.

This closes the cited-but-not-applied pattern: writing a plausible-sounding quote that does not actually appear in any tool_result. The quote must be verbatim text from an actual prior result — copy it directly rather than paraphrasing.
"@
        }
    }

    # Fallthrough: marker check failed. Compose block. Do NOT increment counter
    # (the dispatch was present; this is a marker-shape failure, not a missing-
    # dispatch failure, so it should not advance the dispatch-absence ratchet).
    $reason = $markerBlockReason + @"


---

DELEGATION CANON ENFORCEMENT (~/.claude/canon/delegation-and-stall-discipline.md).

Stop-language detected in this turn ('$matchedPattern') with foreign-frontier dispatch present BUT failing the threshold-level humility-marker verification.

The stop is blocked. Correct the marker and re-dispatch with the full framing.
"@
    $output = @{
        decision = 'block'
        reason   = $reason
    } | ConvertTo-Json -Depth 5 -Compress
    Write-Output $output
    exit 0
}

# Foreign-frontier NOT fired at all: existing qualifying-fire path.
# Stop-language matched AND no foreign-frontier dispatch.
# Increment per-session ratchet counter for the missing-dispatch ratchet.

if ($sessionId -and $stateFile) {
    if ($readDegraded) {
        # Degraded mode: failure-CLOSED. Use threshold so the ratchet header
        # fires even on the first qualifying fire under corrupt state.
        $ratchetCount = $RATCHET_THRESHOLD
    } else {
        $ratchetCount = $priorCount + 1
    }

    # Write-back: skip on read failure. The file is unreadable/locked; mutating
    # it can throw and obscures the corruption. Hold the in-memory counter and
    # let the gate fire; operator triages via the stderr log.
    if (-not $readDegraded) {
        try {
            Set-Content -Path $stateFile -Value $ratchetCount -ErrorAction Stop
        } catch {
            [Console]::Error.WriteLine("stop-validation: state-file write failure on '$stateFile' ($($_.Exception.Message)); proceeding with in-memory counter $ratchetCount")
        }
    }

    if ($ratchetCount -ge $RATCHET_THRESHOLD) {
        $ordinal = switch ($ratchetCount) {
            1 { '1st' }
            2 { '2nd' }
            3 { '3rd' }
            default { "${ratchetCount}th" }
        }
        $ratchetHeader = @"
RATCHET DETECTED — this is the $ordinal qualifying Stop fire in this session.

Per ~/.claude/practice/extended/drift-and-ratchet.md: when foreign-frontier dispatch starts feeling redundant after a few fires, that feeling IS the drift mode, not principled efficiency. The cost of dispatching is small relative to what gets compounded if it's skipped.

---

"@
    }
}

# Block: stop-language without foreign-frontier dispatch.
$reason = $ratchetHeader + @"
DELEGATION CANON ENFORCEMENT (~/.claude/canon/delegation-and-stall-discipline.md).

Stop-language detected in this turn ('$matchedPattern') WITHOUT a foreign-frontier dispatch (mcp__gemini-worker / mcp__gpt-worker / mcp__grok-worker / mcp__glm-worker / WebSearch / WebFetch) in the same turn's tool calls.

Per canon (cited-but-not-applied failure mode): citing the canon at session start does not equal applying it at trigger time. The hook is the structural enforcement layer.

Required next action (in order, until one resolves):
  1. Verify against substrate — does source on disk already answer the question you are about to surface?
  2. If unclear, dispatch a foreign-frontier validator on the framing itself (not on a file — on the framing): "Operator-bound or substrate-resolvable? Here's what I have, here's what I'm about to ask."
  3. If the work is mechanical and the spec is known, dispatch an Agent (subagent_type=general-purpose).
  4. Only if all three resolve to "this genuinely needs the operator," surface the substantive question — explicitly classifying it as kernel-security / real-cost / operator-values-not-encoded-in-canon.

If the operator explicitly told you to wait / hold / pause earlier in the session, that is compliance, not stop-language reaching. Note that classification ("operator authorized waiting at <reference>") in the next surface and the hook will allow the next stop.

The stop is blocked. Reroute from re-anchored position.
"@

$output = @{
    decision = 'block'
    reason   = $reason
} | ConvertTo-Json -Depth 5 -Compress

Write-Output $output
exit 0
