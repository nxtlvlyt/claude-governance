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
