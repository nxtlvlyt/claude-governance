# ~/.claude/hooks/laguna-prose-governance.ps1
#
# On-demand governance audit for prose repos (.laguna-prose).
# Invoked via: git governance-prose
# NOT a blocking hook — explicit operator dispatch before prose commits.
#
# Reviews staged prose files against granite4.1:30b for:
#   - FAITH alignment
#   - Structural coherence
#   - Unverified claims
#   - STATE.md consistency
# Returns VERDICT: PASS / WARN / BLOCK

$ErrorActionPreference = 'SilentlyContinue'
$ollamaBase = 'http://localhost:11434'
$model      = 'granite4.1:30b'

$repoRoot    = git rev-parse --show-toplevel 2>$null
$stagedFiles = @(git diff --cached --name-only 2>$null)
$proseFiles  = @($stagedFiles | Where-Object { $_ -match '\.(md|txt|markdown)$' })

if ($proseFiles.Count -eq 0) {
    Write-Host "[prose-governance] No prose files staged." -ForegroundColor Gray
    exit 0
}

$diff = git diff --cached -- $proseFiles 2>$null

$systemPrompt = @"
You are a governance auditor for an AI governance book. The book's thesis: AI systems
work better under governance derived from deep human traditions (specifically Islamic
practice), because those traditions have accumulated wisdom about holding relationship
to source across time.

Review staged prose changes for:
1. FAITH alignment — does the writing hold to the book's governing thesis?
2. Structural coherence — does the argument hold together internally?
3. Unverified claims — what is asserted more strongly than it can be supported?
4. STATE.md consistency — do the changes match what is documented as current?

Return your verdict in EXACTLY this format (the last VERDICT line is authoritative):
VERDICT: PASS
ISSUES:
- [WARN] description (file if visible in diff)
NOTES: one-line summary
"@

$userMsg = "Staged files:`n$($proseFiles -join "`n")`n`n<<<DIFF_START>>>`n$diff`n<<<DIFF_END>>>"

$body = @{
    model    = $model
    messages = @(
        @{ role = 'system'; content = $systemPrompt }
        @{ role = 'user';   content = $userMsg }
    )
    stream   = $false
    options  = @{ num_ctx = 65536; temperature = 0.3 }
} | ConvertTo-Json -Depth 10

Write-Host "`n[prose-governance] Dispatching granite4.1:30b audit ($($proseFiles.Count) file(s))..." -ForegroundColor DarkCyan

# Reachability check
try {
    $null = Invoke-RestMethod -Uri "$ollamaBase/api/tags" -Method Get -TimeoutSec 4
} catch {
    Write-Host "[prose-governance] ERROR — Ollama not reachable at $ollamaBase. Audit did not run." -ForegroundColor Red
    exit 1
}

try {
    $response = Invoke-RestMethod -Uri "$ollamaBase/api/chat" `
        -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 600
    $critique = $response.message.content
} catch {
    Write-Host "[prose-governance] ERROR — $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Last-match verdict parsing (GLM finding: first-match can be fooled by echoed diff content)
$verdict = 'PASS'
$verdictMatches = [regex]::Matches($critique, '(?m)^VERDICT:\s*(BLOCK|WARN|PASS)', 'IgnoreCase')
if ($verdictMatches.Count -gt 0) {
    $verdict = $verdictMatches[$verdictMatches.Count - 1].Groups[1].Value.ToUpper()
}

Write-Host ""
Write-Host "┌─ Prose Governance Audit (Granite 4.1) ─────────────────────────" -ForegroundColor DarkCyan
Write-Host $critique
Write-Host "└─────────────────────────────────────────────────────────────────" -ForegroundColor DarkCyan
Write-Host ""

switch ($verdict) {
    'BLOCK' { Write-Host "[prose-governance] BLOCK — resolve issues before committing." -ForegroundColor Red;             exit 1 }
    'WARN'  { Write-Host "[prose-governance] WARN — issues noted. Commit at operator discretion." -ForegroundColor Yellow; exit 0 }
    default { Write-Host "[prose-governance] PASS" -ForegroundColor Green;                                                 exit 0 }
}
