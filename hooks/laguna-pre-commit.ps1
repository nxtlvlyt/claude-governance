# ~/.claude/hooks/laguna-pre-commit.ps1
#
# Pre-commit code quality gate.
# Pipes staged diff to Laguna (laguna-xs.2:q4_K_M) via Ollama HTTP API.
#
# Verdict semantics:
#   BLOCK — security hole, data loss risk, broken dependency, production crash.
#           Exits 1. Git aborts the commit.
#   WARN  — code smell, missing error handling, style gap, perf concern.
#           Exits 0. Commit proceeds. Critique is shown.
#   PASS  — no significant issues. Exits 0.
#
# Cannot verify = cannot approve:
#   - Ollama unreachable → BLOCK (use --no-verify for explicit auditable bypass)
#   - Timeout           → BLOCK
#   - Diff exceeds context window → BLOCK (incomplete review is no review)
#
# Bypass: git commit --no-verify

$ErrorActionPreference = 'SilentlyContinue'

$ollamaBase = 'http://localhost:11434'
$repoRoot = git rev-parse --show-toplevel 2>$null

# --- Prose repo detection ---
# .laguna-prose marker = prose-only repo; code review is a category error here.
# Governance for prose commits is handled via explicit granite audit (git governance-prose).
# .laguna-warroom and .laguna-prose are mutually exclusive — dual-marker is a config error.
if ($repoRoot) {
    $proseMarker   = Join-Path $repoRoot '.laguna-prose'
    $warroomMarker = Join-Path $repoRoot '.laguna-warroom'
    $hasProse      = Test-Path -LiteralPath $proseMarker   -PathType Leaf
    $hasWarroom    = Test-Path -LiteralPath $warroomMarker -PathType Leaf
    if ($hasProse -and $hasWarroom) {
        Write-Host "[laguna-review] CONFIG ERROR — .laguna-prose and .laguna-warroom both present. Markers are mutually exclusive. Resolve before committing." -ForegroundColor Red
        exit 1
    }
    if ($hasProse) {
        Write-Host "[laguna-review] PROSE MODE — Skipping automatic code review. Run 'git governance-prose' if required." -ForegroundColor Gray
        exit 0
    }
}

if ($repoRoot) {
    $resYaml = Join-Path $repoRoot 'config\resources.yaml'
    if (Test-Path $resYaml) {
        try {
            $inOllama = $false
            foreach ($yamlLine in (Get-Content $resYaml -ErrorAction Stop)) {
                if ($yamlLine -match '^ollama:\s*$') { $inOllama = $true; continue }
                if ($inOllama -and $yamlLine -match '^\s+host:\s*["'']?([^"''#\s\r\n]+)') {
                    $candidate = $Matches[1].Trim()
                    if ($candidate) { $ollamaBase = $candidate }
                    break
                }
                if ($inOllama -and $yamlLine -match '^[a-zA-Z]') { break }
            }
        } catch {}
    }
}
$model      = 'laguna-xs.2:q4_K_M'

# laguna context window: 131,072 tokens ~= 524,288 chars at 4 chars/token.
# If the diff exceeds this, we CANNOT review it completely — BLOCK rather than
# pass on incomplete context (incomplete review is not a review).
# Timeout: 131,072 tokens / 5 tok/s (conservative CPU) = 26,214s -> 131,072s (36 hrs).
# Rule (Mark 2026-05-05): Timeout (seconds) must be >= num_ctx (tokens).
$maxChars   = 524288
$timeoutSec = 131072

# --- Staged diff ----------------------------------------------------------
$stagedFiles = git diff --cached --name-only 2>$null
$diff        = git diff --cached --unified=3 --no-ext-diff --no-textconv 2>$null

if ([string]::IsNullOrWhiteSpace($diff)) {
    exit 0  # nothing staged, nothing to review
}

# --- Log setup ------------------------------------------------------------
$logDir  = "$env:USERPROFILE\.claude\logs\laguna"
$logFile = "$logDir\verdicts.jsonl"
$diffHash = $null
try {
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $diffHash = git diff --cached | git hash-object --stdin 2>$null
} catch {
    Write-Host "[laguna-review] WARN — log setup or diff hash failed. Logging may be degraded." -ForegroundColor Gray
}

# --- Diff size gate -------------------------------------------------------
if ($diff.Length -gt $maxChars) {
    Write-Host "`n[laguna-review] BLOCKED — diff exceeds laguna context window ($($diff.Length) chars > $maxChars limit)." -ForegroundColor Red
    Write-Host "                Cannot review incomplete diff. Split commit or reduce diff size." -ForegroundColor DarkGray
    Write-Host "                To override: git commit --no-verify" -ForegroundColor DarkGray
    try {
        @{ ts=(Get-Date -Format 'o'); verdict='BLOCK'; kind='context_exceeded'; diff_hash=$diffHash; files=($stagedFiles -join ',') } `
            | ConvertTo-Json -Compress | Add-Content -Path $logFile
    } catch {
        Write-Host "[laguna-review] WARN — log write failed." -ForegroundColor Gray
    }
    exit 1
}

# --- Ollama reachability check --------------------------------------------
try {
    $null = Invoke-RestMethod -Uri "$ollamaBase/api/tags" -Method Get -TimeoutSec 4
} catch {
    # Cannot verify = cannot approve. Ollama down requires explicit --no-verify bypass.
    Write-Host "`n[laguna-review] BLOCKED — Ollama not reachable. Cannot verify commit." -ForegroundColor Red
    Write-Host "                Restore Ollama service or use: git commit --no-verify" -ForegroundColor DarkGray
    try {
        @{ ts=(Get-Date -Format 'o'); verdict='BLOCK'; kind='ollama_unreachable'; diff_hash=$diffHash; files=($stagedFiles -join ',') } `
            | ConvertTo-Json -Compress | Add-Content -Path $logFile
    } catch {
        Write-Host "[laguna-review] WARN — log write failed." -ForegroundColor Gray
    }
    exit 1
}

# --- Build prompt ---------------------------------------------------------
$systemPrompt = @"
You are a senior software engineer doing a pre-commit code review.
The codebase is a self-hosted AI media platform: PHP backend, Python workers, PowerShell scripts.

Return your review in EXACTLY this format — no extra text before the verdict line:

VERDICT: PASS
ISSUES:
- [WARN] description (file:line if visible in diff)
NOTES: one-line summary

VERDICT rules:
  BLOCK — use when: SQL injection / XSS / auth bypass, data loss, broken import/require,
           logic that will throw in production, secrets committed to diff.
  WARN  — use when: swallowed exception, missing null check, N+1 query risk,
           inconsistent error handling, dead code, style drift from surrounding file.
  PASS  — no issues worth surfacing.

Be specific. Cite file paths and line numbers from the diff when possible.
If diff is large, prioritize highest-risk changes.
"@

$userMessage = "Files changed:`n$($stagedFiles -join "`n")`n`nDiff:`n$diff"

$body = @{
    model    = $model
    messages = @(
        @{ role = 'system'; content = $systemPrompt }
        @{ role = 'user';   content = $userMessage }
    )
    stream   = $false
} | ConvertTo-Json -Depth 10

# --- Call Laguna ----------------------------------------------------------
$fileCount = ($stagedFiles | Measure-Object).Count
Write-Host "`n[laguna-review] Reviewing $fileCount file(s) — timeout $($timeoutSec)s (full context window)..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$ollamaBase/api/chat" `
        -Method Post -Body $body -ContentType 'application/json' -TimeoutSec $timeoutSec
    $critique = $response.message.content
} catch {
    $msg = $_.Exception.Message
    $isTimeout = $msg -match 'Timeout|elapsed'
    $kind = if ($isTimeout) { 'timeout' } else { 'error' }

    # Cannot verify = cannot approve.
    Write-Host "[laguna-review] BLOCKED — call $kind ($msg)." -ForegroundColor Red
    Write-Host "                Cannot verify = cannot approve. Use --no-verify for explicit bypass." -ForegroundColor DarkGray
    try {
        @{ ts=(Get-Date -Format 'o'); verdict='BLOCK'; kind=$kind; diff_hash=$diffHash; files=($stagedFiles -join ',') } `
            | ConvertTo-Json -Compress | Add-Content -Path $logFile
    } catch {
        Write-Host "[laguna-review] WARN — log write failed." -ForegroundColor Gray
    }
    exit 1
}

# --- Parse verdict --------------------------------------------------------
$verdict = 'PASS'
if ($critique -imatch '(?m)^VERDICT:\s*(BLOCK|WARN|PASS)') {
    $verdict = $Matches[1].ToUpper()
}

# --- Log ------------------------------------------------------------------
try {
    @{ ts=(Get-Date -Format 'o'); verdict=$verdict; diff_hash=$diffHash; files=($stagedFiles -join ',') } `
        | ConvertTo-Json -Compress | Add-Content -Path $logFile
} catch {
    Write-Host "[laguna-review] WARN — log write failed." -ForegroundColor Gray
}

# --- Display --------------------------------------------------------------
Write-Host ""
Write-Host "┌─ Laguna Code Review ────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host $critique
Write-Host "└─────────────────────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""

# --- Workshop receipt gate (F7) -------------------------------------------
# Fires only in the warroom repo when core/*.py is staged and verdict != BLOCK.
# Logs an auditable receipt to warroom/logs/receipts/YYYY/MM/DD/<ts>.jsonl.
# Blocks on write failure or null content hash — silent failure is a governance gap.

$lagunaReceiptRoot = git rev-parse --show-toplevel 2>$null
$lagunaIsWarroom   = $false
if ($lagunaReceiptRoot) {
    $lagunaIsWarroom = Test-Path (Join-Path $lagunaReceiptRoot '.laguna-warroom')
}

$lagunaCorePyFiles = @($stagedFiles | Where-Object { $_ -match '^core/' -and $_ -match '\.py$' })

if ($lagunaIsWarroom -and $lagunaCorePyFiles.Count -gt 0 -and $verdict -ne 'BLOCK') {

    $lagunaTs = Get-Date

    # Mutations (A/C/M/R/T) vs deletions — ls-files only returns mutations.
    $lagunaMutatedFiles = @(
        git diff --cached --diff-filter=ACMRT --name-only 2>$null |
        Where-Object { $_ -match '^core/' -and $_ -match '\.py$' }
    )

    # Content hash: SHA-256 of sorted index lines for mutated files.
    # Pure-deletion commits hash the sorted deleted-filename list (deterministic marker).
    $lagunaLsLines = if ($lagunaMutatedFiles.Count -gt 0) {
        git ls-files --cached --stage -- $lagunaMutatedFiles 2>$null | Sort-Object
    } else {
        $null
    }

    if ($lagunaMutatedFiles.Count -gt 0 -and -not $lagunaLsLines) {
        Write-Host "`n[laguna-receipt] BLOCKED — git ls-files returned empty for staged core/*.py mutations." -ForegroundColor Red
        Write-Host "                 Index may be in an inconsistent state. Use --no-verify to bypass." -ForegroundColor DarkGray
        exit 1
    }

    $lagunaHashInput = if ($lagunaLsLines) {
        $lagunaLsLines -join "`n"
    } else {
        "DELETED:$(($lagunaCorePyFiles | Sort-Object) -join ',')"
    }
    $lagunaHashBytes   = [System.Text.Encoding]::UTF8.GetBytes($lagunaHashInput)
    $lagunaHasher      = [System.Security.Cryptography.SHA256]::Create()
    $lagunaContentHash = $null
    try {
        $lagunaContentHash = [BitConverter]::ToString(
            $lagunaHasher.ComputeHash($lagunaHashBytes)
        ) -replace '-', ''
    } finally {
        $lagunaHasher.Dispose()
    }

    if ($null -eq $lagunaContentHash) {
        Write-Host "`n[laguna-receipt] BLOCKED — content hash computation failed." -ForegroundColor Red
        Write-Host "                 Use --no-verify to bypass." -ForegroundColor DarkGray
        exit 1
    }

    $lagunaAuthorRaw  = git config user.name 2>$null
    $lagunaAuthor     = if ($null -ne $lagunaAuthorRaw -and $lagunaAuthorRaw -ne '') { $lagunaAuthorRaw } else { $env:USERNAME }
    
    # --- Governance audit (Granite 4.1) -----------------------------------
    # Second opinion for structural coherence in the warroom repo.
    # Granite 4.1 is the deliberation-team lead for governance audits.
    Write-Host "[laguna-receipt] Dispatching governance audit (granite4.1:30b)..." -ForegroundColor DarkCyan
    $graniteSystem = @"
You are a governance-aware systems auditor. Your task is to identify untested 
assumptions, skipped validations, and blind spots in architectural or operational 
decisions. Review the staged changes for canon-coherence and bypass surfaces.
"@
    $graniteBody = @{
        model    = 'granite4.1:30b'
        messages = @(
            @{ role = 'system'; content = $graniteSystem }
            @{ role = 'user';   content = $userMessage }
        )
        stream   = $false
        options  = @{
            num_ctx = 131072
        }
    } | ConvertTo-Json -Depth 10
    
    $graniteAudit = $null
    try {
        $graniteResponse = Invoke-RestMethod -Uri "$ollamaBase/api/chat" `
            -Method Post -Body $graniteBody -ContentType 'application/json' -TimeoutSec $timeoutSec
        $graniteAudit = $graniteResponse.message.content
        
        Write-Host "┌─ Granite Governance Audit ──────────────────────────────────────" -ForegroundColor DarkCyan
        Write-Host $graniteAudit
        Write-Host "└─────────────────────────────────────────────────────────────────" -ForegroundColor DarkCyan
    } catch {
        Write-Host "[laguna-receipt] WARN — governance audit (Granite) failed: $($_.Exception.Message)" -ForegroundColor Gray
    }

    $lagunaReceiptDir = [System.IO.Path]::Combine(
        $lagunaReceiptRoot, 'logs', 'receipts',
        $lagunaTs.ToString('yyyy'), $lagunaTs.ToString('MM'), $lagunaTs.ToString('dd')
    )
    $lagunaReceiptLog = Join-Path $lagunaReceiptDir ($lagunaTs.ToString('yyyyMMddHHmmssfff') + '.jsonl')

    $lagunaReceiptObj = [ordered]@{
        schema_version    = 1
        ts                = $lagunaTs.ToString('o')
        author            = $lagunaAuthor
        repo              = $lagunaReceiptRoot
        core_py_files     = $lagunaCorePyFiles
        content_hash      = $lagunaContentHash
        laguna_verdict    = $verdict
        governance_audit  = $graniteAudit
        diff_hash         = $diffHash
    }

    try {
        [System.IO.Directory]::CreateDirectory($lagunaReceiptDir) | Out-Null
        [System.IO.File]::AppendAllText(
            $lagunaReceiptLog,
            ($lagunaReceiptObj | ConvertTo-Json -Compress) + "`n"
        )
        Write-Host "[laguna-receipt] Core change logged → $lagunaReceiptLog" -ForegroundColor DarkCyan
    } catch {
        Write-Host "`n[laguna-receipt] BLOCKED — receipt write failed." -ForegroundColor Red
        Write-Host "                 Target: $lagunaReceiptLog" -ForegroundColor DarkGray
        Write-Host "                 Error: $_" -ForegroundColor DarkGray
        Write-Host "                 Resolve write access or use: git commit --no-verify" -ForegroundColor DarkGray
        exit 1
    }
}

# --- Exit -----------------------------------------------------------------
switch ($verdict) {
    'BLOCK' {
        Write-Host "[laguna-review] BLOCKED — fix the issues above before committing." -ForegroundColor Red
        Write-Host "                To override: git commit --no-verify" -ForegroundColor DarkGray
        exit 1
    }
    'WARN' {
        Write-Host "[laguna-review] WARN — issues noted. Commit allowed." -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host "[laguna-review] PASS" -ForegroundColor Green
        exit 0
    }
}
