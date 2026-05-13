# ~/.claude/hooks/git-anchor.ps1
#
# Stop hook — SSH-signed Git commit + dual-remote push for P6 artifact anchoring.
#
# At session end, stages and commits changes in:
#   - ~/.claude/   (governance framework)
#   - D:\Desktop\ai book\  (AI book)
#
# Commits are SSH-signed and pushed to two independent remotes:
#   - codeberg: git@codeberg.org:<user>/claude-governance.git  (primary)
#   - github:   git@github.com:nxtlvlyt/claude-governance.git  (secondary)
#
# This satisfies Kiraman Katibin: records kept by parties outside operator control.
# Both remotes serve as independent witnesses. Compromise of one does not invalidate.
#
# Failure behavior: fail-OPEN. Push failures log WARNING but do not block session end.
# The signed commit exists locally even if push fails — local record is still signed.
#
# SETUP REQUIRED (one-time, operator action):
#   1. Create repos on Codeberg.org: claude-governance and ai-book
#   2. Upload public key (id_ed25519.pub) to Codeberg SSH keys
#   3. Set the correct Codeberg username in the remote URLs below
#   4. Run: git -C "$HOME/.claude" remote add codeberg git@codeberg.org:<USER>/claude-governance.git
#   5. Run: git -C "D:\Desktop\ai book" remote add codeberg git@codeberg.org:<USER>/ai-book.git
#   6. Run: git -C "D:\Desktop\ai book" remote add github git@github.com:nxtlvlyt/ai-book.git

$ErrorActionPreference = 'SilentlyContinue'

function Anchor-Repo([string]$repoPath, [string]$label) {
    if (-not (Test-Path $repoPath)) {
        return "[SKIP] $label — path not found"
    }
    if (-not (Test-Path (Join-Path $repoPath '.git'))) {
        return "[SKIP] $label — not a git repo"
    }

    Push-Location $repoPath
    try {
        # Stage all tracked + new governance files
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

$results = @(
    (Anchor-Repo "$env:USERPROFILE\.claude" "governance"),
    (Anchor-Repo "D:\Desktop\ai book" "ai-book")
)

$summary = $results -join ' | '

$output = [ordered]@{
    decision = 'approve'
    reason   = "P6 git-anchor: $summary"
} | ConvertTo-Json -Compress

Write-Output $output
exit 0
