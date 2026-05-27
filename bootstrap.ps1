# bootstrap.ps1 — Claude OS one-command installer
#
# Quick install:
#   irm https://codeberg.org/nxtlvl/claude-governance/raw/branch/master/bootstrap.ps1 | iex
#
# Custom fork:
#   $env:CLAUDE_REPO = "https://github.com/YOURFORK/claude-governance.git"
#   irm https://codeberg.org/nxtlvl/claude-governance/raw/branch/master/bootstrap.ps1 | iex
#
# Environment overrides:
#   CLAUDE_REPO   — git clone URL (default: https://github.com/nxtlvlyt/claude-governance.git)
#   CLAUDE_BRANCH — branch name  (default: master)

param(
    [string]$Repo   = ($env:CLAUDE_REPO   ?? 'https://github.com/nxtlvlyt/claude-governance.git'),
    [string]$Branch = ($env:CLAUDE_BRANCH ?? 'master')
)

$ErrorActionPreference = 'Stop'
$dest = Join-Path $HOME '.claude'

Write-Host ''
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host '  Claude OS — Bootstrap Installer'         -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host "Repo:   $Repo"
Write-Host "Branch: $Branch"
Write-Host "Target: $dest"
Write-Host ''

# ── 1. Prerequisites ──────────────────────────────────────────────────────────

function Install-Prereq {
    param([string]$Label, [string]$WingetId, [string]$ManualUrl, [string]$CheckCmd)
    if (Get-Command $CheckCmd -ErrorAction SilentlyContinue) {
        Write-Host "  OK       $Label" -ForegroundColor Green
        return
    }
    Write-Host "  MISSING  $Label" -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "           Installing via winget..." -NoNewline
        winget install --id $WingetId --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
        # Refresh PATH so newly installed tools are visible without restarting terminal
        $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' +
                    [System.Environment]::GetEnvironmentVariable('PATH', 'User')
        if (Get-Command $CheckCmd -ErrorAction SilentlyContinue) {
            Write-Host ' OK' -ForegroundColor Green
        } else {
            Write-Host ' installed — open a new terminal if command is still not found' -ForegroundColor Yellow
        }
    } else {
        Write-Host "           Install manually: $ManualUrl" -ForegroundColor Red
    }
}

Write-Host 'Checking prerequisites...'

Install-Prereq -Label 'Git'            -WingetId 'Git.Git'               -ManualUrl 'https://git-scm.com/'                            -CheckCmd 'git'
Install-Prereq -Label 'Node.js 18+'    -WingetId 'OpenJS.NodeJS.LTS'     -ManualUrl 'https://nodejs.org/'                             -CheckCmd 'node'
Install-Prereq -Label 'Ollama'         -WingetId 'Ollama.Ollama'          -ManualUrl 'https://ollama.com/download'                     -CheckCmd 'ollama'
Install-Prereq -Label 'Docker Desktop' -WingetId 'Docker.DockerDesktop'   -ManualUrl 'https://www.docker.com/products/docker-desktop/'  -CheckCmd 'docker'

if (-not (Get-Command 'claude' -ErrorAction SilentlyContinue)) {
    Write-Host '  MISSING  Claude Code' -ForegroundColor Yellow
    if (Get-Command 'npm' -ErrorAction SilentlyContinue) {
        Write-Host '           npm install -g @anthropic-ai/claude-code...' -NoNewline
        npm install -g @anthropic-ai/claude-code 2>&1 | Out-Null
        Write-Host ' OK' -ForegroundColor Green
    } else {
        Write-Host '           Install Node.js first, then: npm install -g @anthropic-ai/claude-code' -ForegroundColor Red
    }
} else {
    Write-Host '  OK       Claude Code' -ForegroundColor Green
}

Write-Host ''

# ── 2. Clone or update repo ───────────────────────────────────────────────────

if (Test-Path (Join-Path $dest '.git')) {
    Write-Host "Governance repo found at $dest — pulling latest..."
    Push-Location $dest
    try {
        git pull origin $Branch 2>&1 | Out-Null
        Write-Host "  Up to date on branch $Branch" -ForegroundColor Green
    } catch {
        Write-Host "  Pull failed (local edits may be present). Continuing with existing state." -ForegroundColor Yellow
    }
    Pop-Location
} elseif (Test-Path $dest) {
    $backup = "$dest.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "Existing non-git ~/.claude found — backing up to:"
    Write-Host "  $backup" -ForegroundColor Cyan
    Rename-Item $dest $backup
    Write-Host "Cloning $Repo -> $dest..."
    git clone $Repo --branch $Branch $dest
    Write-Host "  Cloned." -ForegroundColor Green
} else {
    Write-Host "Cloning $Repo -> $dest..."
    git clone $Repo --branch $Branch $dest
    Write-Host "  Cloned." -ForegroundColor Green
}

Write-Host ''

# ── 3. Hand off to install.ps1 ────────────────────────────────────────────────

$installScript = Join-Path $dest 'install.ps1'
if (-not (Test-Path $installScript)) {
    Write-Host "ERROR: install.ps1 not found at $installScript" -ForegroundColor Red
    Write-Host 'The repo may be incomplete or cloned from an unexpected branch.' -ForegroundColor Red
    exit 1
}

Write-Host 'Handing off to install.ps1...'
Write-Host ''
& pwsh -NoProfile -ExecutionPolicy Bypass -File $installScript
