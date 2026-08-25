# ~/.claude/hooks/pre-tool-use-chain-timing.ps1
#
# PreToolUse hook — chain timing gate.
#
# Blocks Bash/PowerShell dispatch of CPU-intensive chain models without
# explicit operator timing confirmation (CHAIN-TIMING-CONFIRMED token).
#
# CPU inference on this machine (CPU-only, 192GB RAM) pegs all cores for
# hours. On 2026-05-11 an instance started gemma4:31b then qwen3.6:27b
# mid-conversation without asking, locking the operator out of their
# machine. This gate prevents that structurally.
#
# How it works:
#   - Fires on Bash and PowerShell tool calls only.
#   - Checks if the command contains chain model names or dispatch scripts.
#   - If yes, walks the session JSONL for CHAIN-TIMING-CONFIRMED in any
#     user text block. If found, passes. If not found, blocks.
#
# To authorize a chain dispatch: type CHAIN-TIMING-CONFIRMED in your
# message. The gate opens for the rest of the session (resets on compaction).

$ErrorActionPreference = 'SilentlyContinue'

$stdin = [Console]::In.ReadToEnd()
$inp = $null
try { $inp = $stdin | ConvertFrom-Json } catch {}

if (-not $inp) { exit 0 }

# Only fire on Bash and PowerShell
$toolName = $inp.tool_name
if ($toolName -ne 'Bash' -and $toolName -ne 'PowerShell') {
    exit 0
}

# Get command
$command = $inp.tool_input.command
if (-not $command) { exit 0 }

# Pass safe unload operations unconditionally — ollama stop is maintenance, not inference.
if ($command -match 'ollama\s+stop') { exit 0 }

# RECALIBRATED 2026-06-30 (operator: the per-session token resets on compaction and forces
# his presence). The lockout this guards (2026-05-11) was THIS LAPTOP's CPU pegging. None of
# these can lock the laptop, so none should ever gate:
#   - read-only metadata endpoints (never inference)
if ($command -match '/api/tags|/api/show|/api/ps|/api/version|/api/embeddings') { exit 0 }
#   - remote dispatch (nxtbeast / Tailscale) runs on ANOTHER machine, cannot freeze this one
if ($command -match 'nxtbeast|100\.103\.44\.13') { exit 0 }
#   - operator STANDING authorization file (set once) — no per-session token, survives compaction
#     2026-07-01: SAME-DAY bound, not indefinite. An audit flagged this as an unconditional,
#     unscoped exit 0 for the rest of any session where the file exists, with no expiry check —
#     a future session could inherit a stale authorization from days/weeks earlier and never
#     notice. The file's own content already embeds the date it was authorized (e.g. "operator
#     standing authorization 2026-06-30 - ..."); parse it and require it to match TODAY. An
#     expired file is treated as absent (falls through to the normal chain-timing check below),
#     never as an error — fail toward re-confirming, not toward a crash.
$standingOkPath = "$env:USERPROFILE\.claude\state\chain-timing-standing-ok"
if (Test-Path $standingOkPath) {
    $standingOkContent = Get-Content $standingOkPath -Raw -ErrorAction SilentlyContinue
    $dateMatch = [regex]::Match($standingOkContent, '\d{4}-\d{2}-\d{2}')
    if ($dateMatch.Success -and $dateMatch.Value -eq (Get-Date).ToString('yyyy-MM-dd')) {
        exit 0
    }
    # no date found, or date is not today -- expired/malformed, do NOT honor it silently
}

# Dispatch scripts always indicate chain inference dispatch.
$isChainDispatch = $false
if ($command -match 'dispatch-seat|python.*dispatch') { $isChainDispatch = $true }

# Model names only flag as dispatch when paired with inference API endpoints.
if (-not $isChainDispatch) {
    if ($command -match '/api/generate|/api/chat|Invoke-RestMethod|Invoke-WebRequest|curl.*api') {
        if ($command -match 'gemma4|qwen3\.6|granite4\.1|nemotron-3-super') {
            $isChainDispatch = $true
        }
    }
}

if (-not $isChainDispatch) { exit 0 }

# Chain dispatch detected — locate transcript
$transcriptPath = $null
if ($inp.transcript_path) {
    $transcriptPath = $inp.transcript_path
} elseif ($inp.session_id) {
    $cwd = if ($inp.cwd) { $inp.cwd } else { (Get-Location).Path }
    $sanitized = ($cwd -replace '[\\/:]', '-')
    $transcriptPath = Join-Path $HOME ".claude\projects\$sanitized\$($inp.session_id).jsonl"
}

if (-not $transcriptPath -or -not (Test-Path $transcriptPath)) {
    $output = @{
        decision = "block"
        reason   = "CHAIN TIMING GATE: Cannot read session transcript. Type CHAIN-TIMING-CONFIRMED in your message to authorize this chain dispatch."
    } | ConvertTo-Json -Compress
    Write-Output $output
    exit 1
}

# Walk transcript for CHAIN-TIMING-CONFIRMED.
# Operator text is stored as {"type":"last-prompt","lastPrompt":"..."} in the JSONL.
# Tool results appear as {"type":"user","message":{"content":[{"type":"tool_result",...}]}}.
#
# Dual-write fix: In remote-control/subagent architectures Claude Code provides a
# bridge session JSONL as transcript_path while last-prompt entries land in a sibling
# file. Scan the primary file first, then up to 2 recently modified siblings, and
# confirm if ANY file contains the token after its last compact_boundary.
$confirmed = $false

function Test-ChainConfirmed($path) {
    if (-not $path -or -not (Test-Path $path)) { return $false }
    $loc = $false
    foreach ($line in (Get-Content $path)) {
        if (-not $line) { continue }
        try { $entry = $line | ConvertFrom-Json } catch { continue }
        if ($entry.type -eq 'last-prompt' -and $entry.lastPrompt -imatch 'CHAIN-TIMING-CONFIRMED') { $loc = $true }
        if ($entry.type -eq 'user' -and $entry.message.content) {
            foreach ($block in $entry.message.content) {
                if ($block.type -eq 'text' -and $block.text -imatch 'CHAIN-TIMING-CONFIRMED') { $loc = $true }
            }
        }
    }
    return $loc
}

if (Test-ChainConfirmed $transcriptPath) { $confirmed = $true }
if (-not $confirmed) {
    $dir = Split-Path $transcriptPath -Parent
    Get-ChildItem $dir -Filter '*.jsonl' -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -ne $transcriptPath } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 2 |
        ForEach-Object { if (Test-ChainConfirmed $_.FullName) { $confirmed = $true } }
}

if ($confirmed) { exit 0 }

# Block — no timing confirmation found
$cmdPreview = if ($command.Length -gt 80) { $command.Substring(0, 80) + '...' } else { $command }
$reason = @"
CHAIN TIMING GATE (~/.claude/hooks/pre-tool-use-chain-timing.ps1).

Chain model dispatch detected:
  $cmdPreview

CPU inference pegs all cores for hours on this machine. Before this
dispatch fires, confirm timing is acceptable by typing exactly:

  CHAIN-TIMING-CONFIRMED

in your next message. The gate opens for the rest of the session and
resets after compaction. No other authorization is required once the
token is present in transcript.
"@

$output = @{ decision = "block"; reason = $reason } | ConvertTo-Json -Compress
Write-Output $output
exit 1
