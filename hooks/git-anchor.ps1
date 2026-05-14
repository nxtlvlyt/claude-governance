# ~/.claude/hooks/git-anchor.ps1
#
# Stop hook — SSH-signed Git commit + dual-remote push for P6 artifact anchoring.
#
# Static repos anchored at every session end:
#   - ~/.claude/   (governance framework)
#   - D:\Desktop\ai book\  (AI book)
#
# Dynamic repo anchoring (project-aware):
#   Reads the session CWD from hook stdin. If CWD is a safe path (under user
#   home or operator-configured project_root_prefixes in p6-config.json) and
#   not a system directory, it is anchored as well.
#   If CWD is not yet a git repo, auto-init runs: git init + GitHub/Codeberg
#   repo creation via API + initial push. Credentials read from p6-config.json.
#
# Commits are SSH-signed and pushed to two independent remotes:
#   - codeberg: git@codeberg.org:nxtlvl/<repo>.git  (primary)
#   - github:   git@github.com:nxtlvlyt/<repo>.git  (secondary)
#
# This satisfies Kiraman Katibin: records kept by parties outside operator control.
# Both remotes serve as independent witnesses. Compromise of one does not invalidate.
#
# Failure behavior: fail-OPEN. Push failures log WARNING but do not block session end.
# The signed commit exists locally even if push fails — local record is still signed.
#
# SETUP COMPLETE (2026-05-14):
#   Repos created: codeberg.org/nxtlvl/claude-governance, codeberg.org/nxtlvl/ai-book
#   SSH key uploaded: nxtlvl-deploy (id: 391233)
#   Remotes configured and first push verified for both repos.

$ErrorActionPreference = 'SilentlyContinue'

# ── Read session CWD from hook stdin ─────────────────────────────────────────
$stdin = [Console]::In.ReadToEnd()
$inp = $null
try { $inp = $stdin | ConvertFrom-Json } catch {}
$sessionCwd = if ($inp -and $inp.cwd) { $inp.cwd } else { $null }

# ── Load P6 config (credentials + project root prefixes) ─────────────────────
$p6ConfigPath = Join-Path $HOME '.claude\p6-config.json'
$p6Config = $null
if (Test-Path $p6ConfigPath) {
    try { $p6Config = Get-Content $p6ConfigPath -Raw | ConvertFrom-Json } catch {}
}

# ── System path guard ─────────────────────────────────────────────────────────
# Paths that must never be auto-init'd or anchored as project repos.
$systemGuards = @(
    $env:SystemRoot,
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)},
    $env:ProgramData,
    (Join-Path $env:SystemDrive '\')
) | Where-Object { $_ }

function Test-SafePath([string]$path) {
    if (-not $path) { return $false }
    $norm = $path.TrimEnd('\').ToLower()
    foreach ($guard in $systemGuards) {
        if ($guard -and $norm.StartsWith($guard.TrimEnd('\').ToLower())) { return $false }
    }
    # Accept if under user home
    if ($norm.StartsWith($HOME.ToLower())) { return $true }
    # Accept if under operator-configured project root prefixes
    if ($p6Config -and $p6Config.project_root_prefixes) {
        foreach ($prefix in $p6Config.project_root_prefixes) {
            if ($prefix -and $norm.StartsWith($prefix.TrimEnd('\').ToLower())) { return $true }
        }
    }
    return $false
}

# ── Read Codeberg token: WCM -> env var -> p6-config.json (migration path) ────
function Get-CodebergToken {
    if (-not (Get-Command Get-StoredCredential -ErrorAction SilentlyContinue)) {
        Import-Module CredentialManager -ErrorAction SilentlyContinue
    }
    if (Get-Command Get-StoredCredential -ErrorAction SilentlyContinue) {
        try {
            $c = Get-StoredCredential -Target "governance:codeberg" -ErrorAction Stop
            if ($c) { return $c.GetNetworkCredential().Password }
        } catch {}
    }
    if ($env:CODEBERG_TOKEN) { return $env:CODEBERG_TOKEN }
    if ($p6Config -and $p6Config.codeberg_token) {
        Write-Error "WARN: Codeberg token read from plaintext p6-config.json — migrate to WCM"
        return $p6Config.codeberg_token
    }
    return $null
}

# ── Auto-init: git init + create remote repos + push ─────────────────────────
function Initialize-ProjectRepo([string]$repoPath) {
    if (-not $p6Config) { return "[SKIP] auto-init $(Split-Path $repoPath -Leaf) — no p6-config.json" }

    $repoName = Split-Path $repoPath -Leaf
    Push-Location $repoPath
    try {
        git init -b master 2>&1 | Out-Null
        git add -A 2>&1 | Out-Null
        $commitResult = git commit -S -m "project: initial commit" 2>&1
        if ($LASTEXITCODE -ne 0) {
            git commit -m "project: initial commit [signing-failed]" 2>&1 | Out-Null
        }

        $msgs = @("[INIT] $repoName")

        # GitHub
        if ($p6Config.github_user) {
            if (Get-Command 'gh' -ErrorAction SilentlyContinue) {
                gh repo create "$($p6Config.github_user)/$repoName" --private 2>&1 | Out-Null
                $existingRemotes = (git remote 2>&1)
                if ($existingRemotes -notcontains 'github') {
                    git remote add github "git@github.com:$($p6Config.github_user)/$repoName.git" 2>&1 | Out-Null
                }
                git push -u github master 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) { $msgs += "pushed to github" }
                else { $msgs += "WARN: github push failed" }
            }
        }

        # Codeberg
        $codebergToken = Get-CodebergToken
        if ($p6Config.codeberg_user -and $codebergToken) {
            $cbHeaders = @{
                Authorization  = "token $codebergToken"
                'Content-Type' = 'application/json'
            }
            $repoPayload = @{ name = $repoName; private = $true; auto_init = $false } | ConvertTo-Json
            try {
                Invoke-RestMethod -Uri 'https://codeberg.org/api/v1/user/repos' -Method Post `
                    -Headers $cbHeaders -Body $repoPayload -ErrorAction Stop | Out-Null
            } catch {}
            $existingRemotes = (git remote 2>&1)
            if ($existingRemotes -notcontains 'codeberg') {
                git remote add codeberg "git@codeberg.org:$($p6Config.codeberg_user)/$repoName.git" 2>&1 | Out-Null
            }
            git push -u codeberg master 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { $msgs += "pushed to codeberg" }
            else { $msgs += "WARN: codeberg push failed" }
        }

        return $msgs -join '; '
    } finally {
        Pop-Location
    }
}

# ── Anchor an existing git repo ───────────────────────────────────────────────
function Anchor-Repo([string]$repoPath, [string]$label) {
    if (-not (Test-Path $repoPath)) {
        return "[SKIP] $label — path not found"
    }
    if (-not (Test-Path (Join-Path $repoPath '.git'))) {
        return "[SKIP] $label — not a git repo"
    }

    Push-Location $repoPath
    try {
        # Stage all tracked + new files
        git add -A 2>&1 | Out-Null

        # Check if there's anything to commit
        $status = git status --porcelain 2>&1
        if (-not $status) {
            $remotes = (git remote 2>&1) -join ', '
            return "[OK] $label — no changes to commit (remotes: $remotes)"
        }

        # Commit with SSH signing
        $ts = (Get-Date -Format 'yyyy-MM-dd HH:mm zzz')
        $commitMsg = "governance: session-end anchor $ts"
        $commitResult = git commit -S -m $commitMsg 2>&1
        if ($LASTEXITCODE -ne 0) {
            # Try unsigned commit as fallback
            $commitResult = git commit -m "$commitMsg [signing-failed]" 2>&1
            if ($LASTEXITCODE -ne 0) {
                return "[WARN] $label — commit failed: $($commitResult -join ' ')"
            }
        }

        # Push to all configured remotes
        $remotes = git remote 2>&1
        $pushResults = @()
        foreach ($remote in $remotes) {
            $branch = git branch --show-current 2>&1
            $push = git push $remote $branch 2>&1
            if ($LASTEXITCODE -eq 0) {
                $pushResults += "pushed to $remote"
            } else {
                $pushResults += "WARN: push to $remote failed: $($push -join ' ')"
            }
        }

        return "[OK] $label — committed + $($pushResults -join '; ')"
    } finally {
        Pop-Location
    }
}

# ── Build repo list ───────────────────────────────────────────────────────────
$reposToAnchor = [System.Collections.Generic.List[hashtable]]::new()
$reposToAnchor.Add(@{ Path = "$env:USERPROFILE\.claude"; Label = 'governance' })
$reposToAnchor.Add(@{ Path = 'D:\Desktop\ai book';       Label = 'ai-book'    })

$results = [System.Collections.Generic.List[string]]::new()

# Add session CWD if it passes the safety guard and isn't already listed
if ($sessionCwd -and (Test-SafePath $sessionCwd)) {
    $cwdNorm = $sessionCwd.TrimEnd('\').ToLower()
    $alreadyListed = $reposToAnchor | Where-Object { $_.Path.TrimEnd('\').ToLower() -eq $cwdNorm }
    if (-not $alreadyListed) {
        # Auto-init if not yet a git repo
        if (-not (Test-Path (Join-Path $sessionCwd '.git'))) {
            $results.Add((Initialize-ProjectRepo $sessionCwd))
        }
        $reposToAnchor.Add(@{ Path = $sessionCwd; Label = (Split-Path $sessionCwd -Leaf) })
    }
}

# ── Anchor all repos ──────────────────────────────────────────────────────────
foreach ($repo in $reposToAnchor) {
    $results.Add((Anchor-Repo $repo.Path $repo.Label))
}

$summary = $results -join ' | '

$output = [ordered]@{
    decision = 'approve'
    reason   = "P6 git-anchor: $summary"
} | ConvertTo-Json -Compress

Write-Output $output
exit 0
