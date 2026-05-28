# ~/.claude/install.ps1
#
# Governance system installer for Windows.
# Run this after copying ~/.claude/ to a new machine, or via bootstrap:
#   irm https://nxtlvl.studio/get | iex
#
# Direct usage (interactive):
#   pwsh -ExecutionPolicy Bypass -File ~/.claude/install.ps1
#
# Non-interactive (called by bootstrap — no prompts, auto-detects tier from RAM):
#   pwsh -ExecutionPolicy Bypass -File ~/.claude/install.ps1 -NonInteractive
#   pwsh -ExecutionPolicy Bypass -File ~/.claude/install.ps1 -Tier 4 -NonInteractive

param(
    [int]$Tier = 0,
    [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
$claud = Join-Path $HOME '.claude'

Write-Host ""
Write-Host "========================================"
Write-Host " Governance System Installer"
Write-Host "========================================"
Write-Host ""

# ── Prerequisite checks ──────────────────────────────────────────────────────

$prereqOk = $true

function Check-Command($cmd, $label, $url) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "  MISSING  $label — $url" -ForegroundColor Red
        return $false
    }
    Write-Host "  OK       $label" -ForegroundColor Green
    return $true
}

Write-Host "Checking prerequisites..."
$prereqOk = (Check-Command 'ollama'  'Ollama'       'https://ollama.com/download') -and $prereqOk
$prereqOk = (Check-Command 'docker'  'Docker'       'https://www.docker.com/products/docker-desktop/') -and $prereqOk
$prereqOk = (Check-Command 'node'    'Node.js 18+'  'https://nodejs.org/') -and $prereqOk
$prereqOk = (Check-Command 'claude'  'Claude Code'  'npm install -g @anthropic-ai/claude-code') -and $prereqOk

if (-not $prereqOk) {
    Write-Host ""
    Write-Host "Install missing prerequisites then re-run this script." -ForegroundColor Yellow
    exit 1
}

# CredentialManager module — required for secure token storage in git-anchor.ps1
if (-not (Get-Module -ListAvailable -Name CredentialManager -ErrorAction SilentlyContinue)) {
    Write-Host "Installing CredentialManager PowerShell module (secure token storage)..."
    Install-Module CredentialManager -Scope CurrentUser -Force -AllowClobber
    Write-Host "  CredentialManager installed" -ForegroundColor Green
} else {
    Write-Host "  OK       CredentialManager module" -ForegroundColor Green
}

Write-Host ""

# ── Tier selection ────────────────────────────────────────────────────────────

# Auto-detect tier from RAM if not supplied
if ($Tier -eq 0) {
    $ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
    $Tier = if ($ramGB -ge 128) { 4 } elseif ($ramGB -ge 32) { 3 } elseif ($ramGB -ge 16) { 2 } else { 1 }
    if (-not $NonInteractive) {
        Write-Host "Select installation tier:"
        Write-Host "  1) Structure + Cloud   (8GB+   RAM) — hooks, governance bootstrap, cloud model guidance."
        Write-Host "     Use Claude API or claude.ai as your AI layer. No local models required."
        Write-Host "  2) Lightweight chain   (16GB+  RAM) — Tier 1 + small local models (4-9B)."
        Write-Host "     Models: nemotron-mini:4b, qwen3:8b, granite4.1:8b"
        Write-Host "  3) Governance chain    (32GB+  RAM) — Tier 2 + full MoE deliberation chain."
        Write-Host "     Models: gemma4:26b (MoE ~8GB), qwen3.6:27b (MoE ~20GB), laguna-xs.2, nemotron-cascade-2"
        Write-Host "  4) The Factory         (128GB+ RAM) — Tier 3 + dense full chain."
        Write-Host "     Models: + granite4.1:30b, nemotron-3-super, gemma4:31b (dense, max resolution)"
        Write-Host ""
        Write-Host "  Serial inference discipline: only one model runs at a time." -ForegroundColor DarkGray
        Write-Host "  RAM requirement = largest single model, not sum of all models." -ForegroundColor DarkGray
        Write-Host ""
        $tierInput = Read-Host "Tier (1/2/3/4) [detected $Tier from ${ramGB}GB RAM — Enter to accept]"
        if ($tierInput -and $tierInput -notin @('1','2','3','4')) {
            Write-Host "Invalid tier. Exiting." -ForegroundColor Red
            exit 1
        }
        if ($tierInput) { $Tier = [int]$tierInput }
    } else {
        Write-Host "  Auto-detected Tier $Tier from ${ramGB}GB RAM" -ForegroundColor Cyan
    }
}
$tierNum = $Tier
$tier = "$Tier"

# ── Tier 1 cloud model guidance ──────────────────────────────────────────────

if ($tier -eq '1') {
    Write-Host ""
    Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host " Tier 1 — Governance Structure + Cloud AI"                  -ForegroundColor Cyan
    Write-Host "──────────────────────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  This installs the full governance framework — hooks, canon, faiths," -ForegroundColor White
    Write-Host "  deliberation patterns, P6 anchoring — without requiring local models." -ForegroundColor White
    Write-Host ""
    Write-Host "  Recommended cloud setup:" -ForegroundColor Yellow
    Write-Host "    1. Claude Code (you have it): claude.ai/code" -ForegroundColor Yellow
    Write-Host "       The governance hooks, canon, and deliberation chain all work" -ForegroundColor Yellow
    Write-Host "       inside Claude Code sessions with zero local model dependency." -ForegroundColor Yellow
    Write-Host "    2. Anthropic API key: console.anthropic.com -> API Keys" -ForegroundColor Yellow
    Write-Host "       Set ANTHROPIC_API_KEY in your shell for chain scripts." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Suggested model mapping for the 6-seat deliberation chain:" -ForegroundColor Yellow
    Write-Host "    Architects (Seats 1-3): claude-sonnet-4-6" -ForegroundColor White
    Write-Host "    Executor   (Seat 4):    claude-sonnet-4-6" -ForegroundColor White
    Write-Host "    Validator  (Seat 5):    claude-haiku-4-5  (faster, lower cost)" -ForegroundColor White
    Write-Host "    Scanner    (Seat 6):    claude-haiku-4-5" -ForegroundColor White
    Write-Host "    Auditor    (Seat 7):    claude-sonnet-4-6" -ForegroundColor White
    Write-Host ""
    Write-Host "  Upgrade path: re-run this script with Tier 2 (16GB+) to add" -ForegroundColor Cyan
    Write-Host "  local Ollama models without losing your current configuration." -ForegroundColor Cyan
    Write-Host ""
}

# ── settings.json — hook paths ────────────────────────────────────────────────

Write-Host ""
Write-Host "Writing settings.json..."

$username = $env:USERNAME
$settingsPath = Join-Path $claud 'settings.json'

# Back up existing settings.json before overwriting.
if (Test-Path $settingsPath) {
    $backup = "$settingsPath.bak"
    Copy-Item $settingsPath $backup -Force
    Write-Host "  Backed up existing settings.json -> settings.json.bak" -ForegroundColor Cyan
}

# Patch the canonical settings.json (already in the cloned repo) for this user.
# Rather than regenerating from a hardcoded template, we patch the live canonical
# version so it stays synchronized with whatever the repo contains.
if (Test-Path $settingsPath) {
    $content = Get-Content $settingsPath -Raw
    $patched = $content.Replace('C:\\Users\\marka\\.claude', "C:\\Users\\$username\\.claude")
    if ($content -ne $patched) {
        Copy-Item $settingsPath "$settingsPath.bak" -Force
        Set-Content $settingsPath $patched -Encoding UTF8
        Write-Host "  Patched: $settingsPath (username: $username)" -ForegroundColor Green
    } else {
        Write-Host "  Already correct: $settingsPath" -ForegroundColor Green
    }
} else {
    Write-Host "  WARNING: settings.json not found — was the repo cloned correctly?" -ForegroundColor Red
}

# ── MCP server registration ───────────────────────────────────────────────────

Write-Host ""
Write-Host "Registering MCP servers..."

$toolsDir = Join-Path $claud 'tools'

$existingMcp = (claude mcp list 2>$null) -join "`n"

function Add-Mcp($name, $cmd, $args) {
    Write-Host "  Registering $name..." -NoNewline
    if ($existingMcp -match [regex]::Escape($name)) {
        Write-Host " already registered, skipping" -ForegroundColor Cyan
        return
    }
    if ($cmd -eq 'node' -and $args.Count -gt 0 -and -not (Test-Path $args[0])) {
        Write-Host " SKIPPED (file not found: $($args[0]))" -ForegroundColor Yellow
        return
    }
    try {
        & claude mcp add $name $cmd @args 2>&1 | Out-Null
        Write-Host " OK" -ForegroundColor Green
    } catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
    }
}

# Ensure npm dependencies are installed for bundled MCP tools.
$toolPath = Join-Path $toolsDir 'ollama-mcp'
if (Test-Path (Join-Path $toolPath 'package.json')) {
    Write-Host "  npm install — ollama-mcp..." -NoNewline
    Push-Location $toolPath
    npm install --silent 2>$null
    Pop-Location
    Write-Host " OK" -ForegroundColor Green
}

Add-Mcp 'ollama-mcp'  'node' @("$toolsDir\ollama-mcp\server.js")
Add-Mcp 'searxng-mcp' 'npx'  @('-y', 'mcp-searxng')

Write-Host ""
if ($NonInteractive) {
    $mcpServersPath = ''
    Write-Host "  Skipping frontier workers (non-interactive — add manually with: claude mcp add)" -ForegroundColor Yellow
} else {
    $mcpServersPath = Read-Host "Path to mcp-servers directory (frontier workers — press Enter to skip)"
}
if ($mcpServersPath -and (Test-Path $mcpServersPath)) {
    Add-Mcp 'gemini-worker'     'node' @("$mcpServersPath\gemini-worker\index.js")
    Add-Mcp 'gemini-api-worker' 'node' @("$mcpServersPath\gemini-api-worker\index.js")
    Add-Mcp 'gpt-worker'        'node' @("$mcpServersPath\gpt-worker\index.js")
    Add-Mcp 'grok-worker'       'node' @("$mcpServersPath\grok-worker\index.js")
    Add-Mcp 'glm-worker'        'node' @("$mcpServersPath\glm-worker\index.js")
} else {
    Write-Host "  Skipping frontier workers." -ForegroundColor Yellow
    Write-Host "  Note: stop hook requires an Ollama dispatch to clear stop-language." -ForegroundColor Yellow
}

# ── Ollama model pulls ────────────────────────────────────────────────────────

Write-Host ""
Write-Host "Pulling Ollama models for Tier $tier..."

$modelsToPull = @('nomic-embed-text:latest')  # ~300MB, used by AnythingLLM for embeddings

if ($tierNum -ge 2) {
    # Tier 2 — small dense models (4-9B), run on 16GB serial
    $modelsToPull += @('nemotron-mini:4b', 'qwen3:8b', 'granite4.1:8b')
}
if ($tierNum -ge 3) {
    # Tier 3 — MoE governance chain: large param count, low active RAM per token
    $modelsToPull += @('gemma4:26b', 'qwen3.6:27b', 'laguna-xs.2:q4_K_M', 'nemotron-cascade-2:latest')
}
if ($tierNum -ge 4) {
    # Tier 4 — dense full chain: all params active, max resolution
    $modelsToPull += @('granite4.1:30b', 'nemotron-3-super:latest', 'gemma4:31b')
}

$skipPulls = if ($NonInteractive) { 'n' } else { Read-Host "Pull models now? Large models may take 30+ minutes each. (Y/n)" }
if ($skipPulls -eq 'n') {
    Write-Host "  Skipping model pulls. Run manually: ollama pull <model>" -ForegroundColor Yellow
    Write-Host "  Models needed for Tier $tier`: $($modelsToPull -join ', ')" -ForegroundColor Yellow
} else {
    $existingModels = (ollama list 2>$null) -join "`n"
    foreach ($model in $modelsToPull) {
        if ($existingModels -match [regex]::Escape($model)) {
            Write-Host "  Already present: $model" -ForegroundColor Cyan
        } else {
            Write-Host "  Pulling $model (this may take a while)..."
            ollama pull $model
        }
    }
    Write-Host ""
    Write-Host "  Model pulls complete. Verify with: ollama list" -ForegroundColor Green
}

# ── AnythingLLM (optional) ────────────────────────────────────────────────────

Write-Host ""
$setupAnything = if ($NonInteractive) { 'n' } else { Read-Host "Set up AnythingLLM RAG layer? (y/N)" }
if ($setupAnything -eq 'y') {
    $anythingDir = Read-Host "AnythingLLM directory (e.g. E:\anythingllm)"
    $hotdirPath  = Read-Host "Session summaries hotdir path (e.g. D:\Desktop\ai book\session-summaries)"

    $alModel = switch ($tierNum) {
        1       { 'none' }                       # Tier 1: configure model via AnythingLLM UI
        2       { 'qwen3:8b' }                   # Tier 2: lightweight local model
        3       { 'nemotron-cascade-2:latest' }  # Tier 3: MoE governance model
        default { 'nemotron-cascade-2:latest' }  # Tier 4: same as 3 for RAG seat
    }
    $alTokenLimit = switch ($tierNum) {
        1       { '8192' }
        2       { '8192' }
        default { '16384' }
    }

    if (-not (Test-Path $anythingDir)) {
        New-Item -ItemType Directory -Force -Path $anythingDir | Out-Null
    }

    $jwtSecret = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

    $compose = @"
services:
  anythingllm:
    image: mintplexlabs/anythingllm:latest
    container_name: anythingllm
    ports:
      - "3001:3001"
    environment:
      STORAGE_DIR: /app/server/storage
      JWT_SECRET: $jwtSecret
      LLM_PROVIDER: ollama
      OLLAMA_BASE_PATH: http://host.docker.internal:11434
      OLLAMA_MODEL_PREF: $alModel
      OLLAMA_MODEL_TOKEN_LIMIT: "$alTokenLimit"
      EMBEDDING_ENGINE: ollama
      EMBEDDING_MODEL_PREF: nomic-embed-text:latest
      EMBEDDING_BASE_PATH: http://host.docker.internal:11434
    volumes:
      - "./storage:/app/server/storage"
      - "${hotdirPath}:/app/collector/hotdir"
    restart: unless-stopped
"@

    $composePath = Join-Path $anythingDir 'docker-compose.yml'
    Set-Content -Path $composePath -Value $compose -Encoding UTF8
    Write-Host "  Written: $composePath" -ForegroundColor Green

    Set-Location $anythingDir
    docker compose up -d
    Write-Host "  AnythingLLM starting at http://localhost:3001" -ForegroundColor Green
}

# ── P6 — Cryptographic non-repudiation setup ─────────────────────────────────

Write-Host ""
$setupP6 = if ($NonInteractive) { 'n' } else { Read-Host "Set up P6 cryptographic non-repudiation (SSH-signed commits + dual remotes)? (y/N)" }
if ($setupP6 -eq 'y') {

    # SSH key
    $sshDir     = Join-Path $HOME '.ssh'
    $sshKeyPath = Join-Path $sshDir 'id_ed25519'
    if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Force -Path $sshDir | Out-Null }

    if (-not (Test-Path $sshKeyPath)) {
        Write-Host "  Generating SSH key (ed25519)..."
        ssh-keygen -t ed25519 -C "governance-deploy" -f $sshKeyPath -N ""
        Write-Host "  Key generated: $sshKeyPath" -ForegroundColor Green
    } else {
        Write-Host "  SSH key exists: $sshKeyPath" -ForegroundColor Cyan
    }
    $pubKeyContent = (Get-Content "$sshKeyPath.pub" -Raw -ErrorAction SilentlyContinue).Trim()

    # Git identity (required for commits)
    $gitEmail = (git config --global user.email 2>&1)
    if (-not $gitEmail) {
        $gitEmail = Read-Host "  Git user email"
        git config --global user.email $gitEmail
    }
    $gitName = (git config --global user.name 2>&1)
    if (-not $gitName) {
        $gitName = Read-Host "  Git user name"
        git config --global user.name $gitName
    }

    # SSH signing config
    git config --global gpg.format ssh
    git config --global user.signingkey $sshKeyPath
    git config --global commit.gpgsign true
    Write-Host "  Git SSH signing configured" -ForegroundColor Green

    # Repos to anchor
    $defaultBookPath = "D:\Desktop\ai book"
    $bookPathInput = Read-Host "  Path to project/book directory for anchoring (default: $defaultBookPath — Enter to accept)"
    $bookPath = if ($bookPathInput) { $bookPathInput } else { $defaultBookPath }

    $anchorRepos = @(
        @{ Path = (Join-Path $HOME '.claude'); Name = 'claude-governance' },
        @{ Path = $bookPath;                   Name = 'ai-book' }
    )

    foreach ($repo in $anchorRepos) {
        if ((Test-Path $repo.Path) -and -not (Test-Path (Join-Path $repo.Path '.git'))) {
            Push-Location $repo.Path
            git init -b master 2>&1 | Out-Null
            git add -A 2>&1 | Out-Null
            git commit -S -m "governance: initial commit" 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) { git commit -m "governance: initial commit [signing-failed]" 2>&1 | Out-Null }
            Pop-Location
            Write-Host "  Initialized git repo: $($repo.Path)" -ForegroundColor Green
        }
    }

    # GitHub
    Write-Host ""
    $githubUser = Read-Host "  GitHub username (Enter to skip)"
    if ($githubUser) {
        if (Get-Command 'gh' -ErrorAction SilentlyContinue) {
            $authLine = (gh auth status 2>&1) | Select-String 'Logged in'
            if (-not $authLine) {
                Write-Host "  Authenticate with GitHub (browser will open)..." -ForegroundColor Yellow
                gh auth login --git-protocol ssh --web
            }
            $keyTitle = "governance-deploy-$(hostname)"
            gh ssh-key add "$sshKeyPath.pub" --title $keyTitle 2>&1 | Out-Null
            Write-Host "  SSH key uploaded to GitHub" -ForegroundColor Green

            foreach ($repo in $anchorRepos) {
                gh repo create "$githubUser/$($repo.Name)" --private 2>&1 | Out-Null
                Push-Location $repo.Path
                $existingRemotes = (git remote 2>&1)
                if ($existingRemotes -notcontains 'github') {
                    git remote add github "git@github.com:$githubUser/$($repo.Name).git" 2>&1 | Out-Null
                    Write-Host "  Remote: github -> $githubUser/$($repo.Name)" -ForegroundColor Green
                } else {
                    Write-Host "  Remote github already exists for $($repo.Name)" -ForegroundColor Cyan
                }
                Pop-Location
            }
        } else {
            Write-Host "  gh CLI not found — install from https://cli.github.com/ for automation." -ForegroundColor Yellow
            Write-Host "  Manual: create repos, upload $sshKeyPath.pub, add github remotes." -ForegroundColor Yellow
        }
        ssh-keyscan -H github.com 2>$null >> (Join-Path $HOME '.ssh\known_hosts')
    }

    # Codeberg
    Write-Host ""
    $codebergUser = Read-Host "  Codeberg username (Enter to skip)"
    if ($codebergUser) {
        $codebergToken = Read-Host "  Codeberg API token (create at https://codeberg.org/user/settings/applications)"
        $cbHeaders = @{ Authorization = "token $codebergToken"; 'Content-Type' = 'application/json' }

        $keyPayload = @{ key = $pubKeyContent; read_only = $false; title = "governance-deploy-$(hostname)" } | ConvertTo-Json
        try {
            Invoke-RestMethod -Uri 'https://codeberg.org/api/v1/user/keys' -Method Post -Headers $cbHeaders -Body $keyPayload -ErrorAction Stop | Out-Null
            Write-Host "  SSH key uploaded to Codeberg" -ForegroundColor Green
        } catch { Write-Host "  Codeberg key upload: $($_.Exception.Message) (may already exist)" -ForegroundColor Yellow }

        ssh-keyscan -H codeberg.org 2>$null >> (Join-Path $HOME '.ssh\known_hosts')

        foreach ($repo in $anchorRepos) {
            $repoPayload = @{ name = $repo.Name; private = $false; auto_init = $false } | ConvertTo-Json
            try {
                Invoke-RestMethod -Uri 'https://codeberg.org/api/v1/user/repos' -Method Post -Headers $cbHeaders -Body $repoPayload -ErrorAction Stop | Out-Null
                Write-Host "  Created Codeberg repo: $codebergUser/$($repo.Name)" -ForegroundColor Green
            } catch { Write-Host "  Codeberg $($repo.Name): may already exist" -ForegroundColor Yellow }

            Push-Location $repo.Path
            $existingRemotes = (git remote 2>&1)
            if ($existingRemotes -notcontains 'codeberg') {
                git remote add codeberg "git@codeberg.org:$codebergUser/$($repo.Name).git" 2>&1 | Out-Null
                Write-Host "  Remote: codeberg -> $codebergUser/$($repo.Name)" -ForegroundColor Green
            } else {
                Write-Host "  Remote codeberg already exists for $($repo.Name)" -ForegroundColor Cyan
            }
            Pop-Location
        }
    }

    # Patch git-anchor.ps1 with actual usernames
    $anchorHook = Join-Path $claud 'hooks\git-anchor.ps1'
    if (Test-Path $anchorHook) {
        $hookContent = Get-Content $anchorHook -Raw
        if ($codebergUser) { $hookContent = $hookContent -replace 'git@codeberg\.org:[^/]+/', "git@codeberg.org:$codebergUser/" }
        if ($githubUser)   { $hookContent = $hookContent -replace 'git@github\.com:[^/]+/',   "git@github.com:$githubUser/"   }
        Set-Content $anchorHook $hookContent -Encoding UTF8
        Write-Host "  Updated git-anchor.ps1 with remote usernames" -ForegroundColor Green
    }

    # Initial push
    Write-Host ""
    Write-Host "  Pushing to remotes..."
    foreach ($repo in $anchorRepos) {
        if (Test-Path (Join-Path $repo.Path '.git')) {
            Push-Location $repo.Path
            $remoteList = (git remote 2>&1)
            foreach ($remote in $remoteList) {
                Write-Host "    $($repo.Name) -> $remote ..." -NoNewline
                git push -u $remote master 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green }
                else { Write-Host " WARN (may need manual push)" -ForegroundColor Yellow }
            }
            Pop-Location
        }
    }

    # Write p6-config.json — non-sensitive fields only (usernames, prefixes)
    # The Codeberg token is stored in Windows Credential Manager, NOT in this file
    $p6Cfg = [ordered]@{
        github_user           = if ($githubUser)   { $githubUser }   else { '' }
        codeberg_user         = if ($codebergUser) { $codebergUser } else { '' }
        project_root_prefixes = @()
    }
    $p6Cfg | ConvertTo-Json | Set-Content (Join-Path $claud 'p6-config.json') -Encoding UTF8
    Write-Host "  p6-config.json written (non-sensitive fields only)" -ForegroundColor Green

    # Store Codeberg token in Windows Credential Manager (DPAPI-protected, not plaintext)
    if ($codebergToken) {
        cmdkey /generic:"governance:codeberg" /user:"token" /pass:"$codebergToken" 2>&1 | Out-Null
        Write-Host "  Codeberg token stored in Windows Credential Manager (target: governance:codeberg)" -ForegroundColor Green
        Write-Host ""
        Write-Host "  ADVISORY (C3): For least-privilege, create a Codeberg token scoped to" -ForegroundColor Yellow
        Write-Host "  'repository:create' only at https://codeberg.org/user/settings/applications" -ForegroundColor Yellow
        Write-Host "  The current token has full user access. A scoped token limits blast radius." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "  P6 complete — Kiraman Katibin operational." -ForegroundColor Green
    Write-Host "  SSH-signed commits pushed to external witnesses at every session end." -ForegroundColor Green
}

# ── SearxNG local search (optional — required for chain runner live research) ─

Write-Host ""
$setupSearxng = if ($NonInteractive) { 'n' } else { Read-Host "Set up SearxNG local search (required for chain runner live search at http://localhost:8080)? (y/N)" }
if ($setupSearxng -eq 'y') {
    $searxngDir = Read-Host "  SearxNG data directory (e.g. C:\searxng-data or E:\AI_Storage\docker\searxng)"
    if (-not (Test-Path $searxngDir)) { New-Item -ItemType Directory -Force -Path $searxngDir | Out-Null }

    $searxngSettings = @'
general:
  instance_name: "SearXNG"
  enable_metrics: false

search:
  safe_search: 0
  formats:
    - html
    - json

server:
  secret_key: "change-this-to-a-random-string"
  limiter: false
  public_instance: false
  method: "POST"

outgoing:
  # 10s timeout — 3s is too short for residential connections (engines get CAPTCHA'd)
  request_timeout: 10.0
  max_request_timeout: 15.0
  enable_http2: true
'@

    $settingsPath = Join-Path $searxngDir 'settings.yml'
    if (-not (Test-Path $settingsPath)) {
        Set-Content $settingsPath $searxngSettings -Encoding UTF8
        Write-Host "  Written: $settingsPath" -ForegroundColor Green
    } else {
        Write-Host "  Settings already exist: $settingsPath (not overwritten)" -ForegroundColor Cyan
    }

    $searxngCompose = @"
services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    volumes:
      - "$($searxngDir -replace '\\', '/'):/etc/searxng"
    ports:
      - "8080:8080"
    restart: unless-stopped
"@

    $composePath = Join-Path $searxngDir 'docker-compose.yml'
    Set-Content $composePath $searxngCompose -Encoding UTF8
    Write-Host "  Written: $composePath" -ForegroundColor Green

    Push-Location $searxngDir
    docker compose up -d
    Pop-Location

    Start-Sleep 5
    try {
        $test = Invoke-RestMethod "http://localhost:8080/search?q=test&format=json" -ErrorAction Stop
        Write-Host "  SearxNG running — JSON API confirmed at http://localhost:8080" -ForegroundColor Green
    } catch {
        Write-Host "  SearxNG started (verify manually at http://localhost:8080)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "  Chain runners (scripts/chain-review.py, scripts/community-fit-review.py," -ForegroundColor Green
    Write-Host "  scripts/deliberate.py) will now have live search context per agent seat." -ForegroundColor Green
    Write-Host "  NOTE: If results are empty after start, wait 30s for engines to initialize." -ForegroundColor Yellow
}

# ── Forgejo local mirror (optional) ──────────────────────────────────────────

Write-Host ""
$setupForgejo = if ($NonInteractive) { 'n' } else { Read-Host "Set up local Forgejo mirror (browsable governance history at http://localhost:3002)? (y/N)" }
if ($setupForgejo -eq 'y') {
    $forgejoDir = Read-Host "  Forgejo data directory (e.g. C:\forgejo-data)"
    if (-not (Test-Path $forgejoDir)) { New-Item -ItemType Directory -Force -Path $forgejoDir | Out-Null }

    $forgejoCompose = @'
services:
  forgejo:
    image: codeberg.org/forgejo/forgejo:latest
    container_name: forgejo
    environment:
      USER_UID: "1000"
      USER_GID: "1000"
      FORGEJO__database__DB_TYPE: sqlite3
      FORGEJO__server__HTTP_PORT: "3002"
      FORGEJO__server__SSH_PORT: "2222"
      FORGEJO__server__DOMAIN: localhost
      FORGEJO__server__ROOT_URL: http://localhost:3002/
    volumes:
      - "./data:/data"
    ports:
      - "3002:3002"
      - "2222:22"
    restart: unless-stopped
'@

    $composePath = Join-Path $forgejoDir 'docker-compose.yml'
    Set-Content $composePath $forgejoCompose -Encoding UTF8
    Write-Host "  Written: $composePath" -ForegroundColor Green

    Push-Location $forgejoDir
    docker compose up -d
    Pop-Location

    Write-Host ""
    Write-Host "  Forgejo running at http://localhost:3002" -ForegroundColor Green
    Write-Host "  Next steps:" -ForegroundColor Yellow
    Write-Host "    1. Open http://localhost:3002 and complete the initial setup wizard" -ForegroundColor Yellow
    Write-Host "    2. Create your admin account and repos (claude-governance, ai-book)" -ForegroundColor Yellow
    Write-Host "    3. Add the forgejo remote to each local repo:" -ForegroundColor Yellow
    Write-Host "       git -C `"~/.claude`" remote add forgejo http://localhost:3002/<user>/claude-governance.git" -ForegroundColor Yellow
    Write-Host "       git -C `"D:\Desktop\ai book`" remote add forgejo http://localhost:3002/<user>/ai-book.git" -ForegroundColor Yellow
    Write-Host "    4. git-anchor.ps1 will auto-push to forgejo at every session end" -ForegroundColor Yellow
    Write-Host "  Note: SSH to forgejo uses port 2222 (not 22)." -ForegroundColor Yellow
}

# ── operator-context.md — copy template on first run ─────────────────────────

Write-Host ""
Write-Host "Checking operator-context.md..."

$opctxPath     = Join-Path $claud 'operator-context.md'
$opctxTemplate = Join-Path $claud 'operator-context.template.md'

if (-not (Test-Path $opctxPath)) {
    if (Test-Path $opctxTemplate) {
        Copy-Item $opctxTemplate $opctxPath
        Write-Host "  Copied operator-context.template.md -> operator-context.md" -ForegroundColor Green
        Write-Host "  ACTION REQUIRED: Open operator-context.md and fill in the [YOUR-...] placeholders." -ForegroundColor Yellow
        Write-Host "    - Section 1: your name, email, machine specs, GPU config" -ForegroundColor Yellow
        Write-Host "    - Section 3: your primary project path and entry point" -ForegroundColor Yellow
        Write-Host "    - Section 8: your username in key paths" -ForegroundColor Yellow
        Write-Host "    - Section 9: your infrastructure notes (NAS, cloud backup, etc.)" -ForegroundColor Yellow
    } else {
        Write-Host "  WARNING: operator-context.template.md not found — skipping." -ForegroundColor Yellow
        Write-Host "  You will need to create operator-context.md manually." -ForegroundColor Yellow
    }
} else {
    Write-Host "  operator-context.md already exists — not overwriting." -ForegroundColor Cyan
}

# ── Verification ──────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================"
Write-Host " Installation complete."
Write-Host "========================================"
Write-Host ""
Write-Host "Verification:"
Write-Host "  1. Open a new terminal and run: claude"
Write-Host "  2. Session-start output should show 'GOVERNANCE BOOTSTRAP' loading." -ForegroundColor Cyan
Write-Host "     If it does, hooks are wired and bootstrap gate is active." -ForegroundColor Cyan
Write-Host ""
if ($tierNum -ge 3) {
    Write-Host "  Model check: ollama list" -ForegroundColor Yellow
    Write-Host "    Expected: qwen3.6:27b, laguna-xs.2:q4_K_M, nemotron-cascade-2:latest" -ForegroundColor Yellow
    if ($tierNum -ge 4) {
        Write-Host "              granite4.1:30b, nemotron-3-super:latest, gemma4:31b" -ForegroundColor Yellow
    }
    Write-Host ""
}
if ($tierNum -eq 1) {
    Write-Host "  Next step: set ANTHROPIC_API_KEY in your environment to use Claude API" -ForegroundColor Yellow
    Write-Host "  for chain-dispatched deliberation work." -ForegroundColor Yellow
    Write-Host ""
}
Write-Host "  Troubleshooting: ~/.claude/canon/setup-issues-and-solutions.md" -ForegroundColor DarkGray
Write-Host ""
if ($NonInteractive) {
    Write-Host "Optional setup (run install.ps1 interactively to configure):" -ForegroundColor Cyan
    Write-Host "  - Model pulls:    ollama pull <model>  (see list above for Tier $tierNum)" -ForegroundColor DarkGray
    Write-Host "  - AnythingLLM:    pwsh ~/.claude/install.ps1  (select y at AnythingLLM prompt)" -ForegroundColor DarkGray
    Write-Host "  - P6 signing:     pwsh ~/.claude/install.ps1  (select y at P6 prompt)" -ForegroundColor DarkGray
    Write-Host "  - SearxNG:        pwsh ~/.claude/install.ps1  (select y at SearxNG prompt)" -ForegroundColor DarkGray
    Write-Host "  - Frontier MCPs:  claude mcp add <name> node <path>" -ForegroundColor DarkGray
    Write-Host ""
}
