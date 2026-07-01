# preview-supervisor.ps1 — keeps a `wrangler pages dev` preview server alive on :8788
# for the muddytires target repo, so VISUAL-QC-REQUIRED missions have a live page to
# render-witness against. Built 2026-07-01 after diagnosing that ZERO visual-QC missions
# had ever completed: the code integrated fine, but every render-witness step died for
# lack of a running preview server (Start-Process ... file-not-found; localhost:8788 dead).
# Mirrors daemon-supervisor.ps1: restart-loop, rate-limited halt, logged.
#
# Usage:  pwsh -NoProfile -ExecutionPolicy Bypass -File preview-supervisor.ps1
# Stop:   Get-Process node | ? { $_.CommandLine -like '*wrangler*pages*dev*' } | Stop-Process
#
# Cloudflare Pages note (verified live 2026-07-01): a request to /map.html 308-redirects to
# the extensionless /map. A render-witness probing this server MUST follow redirects
# (curl -L, or Invoke-WebRequest default) and should probe /map (not /map.html) for a bare 200.

$ErrorActionPreference = 'Continue'
$RepoRoot = 'C:\Users\marka\code\mt-integration-2026-06-22'
$Port = 8788
$LogDir = 'C:\Users\marka\.claude\muezzin-plugin\missions\_logs'
$Log = Join-Path $LogDir 'preview-supervisor.log'
$OutLog = Join-Path $LogDir 'preview-stdout.log'
$HaltFile = Join-Path $LogDir 'preview-supervisor-halted.txt'

function Write-Log($msg) {
  $line = "{0} {1}" -f (Get-Date -Format 's'), $msg
  Add-Content -Path $Log -Value $line
}

if (Test-Path $HaltFile) { Remove-Item $HaltFile -Force }

$deaths = New-Object System.Collections.Generic.List[datetime]
Write-Log "PREVIEW-SUPERVISOR starting (repo=$RepoRoot port=$Port)"

while ($true) {
  # rate-limit: 5+ deaths in 10 min => halt (something is fundamentally wrong; stop thrashing)
  $now = Get-Date
  $recent = $deaths | Where-Object { ($now - $_).TotalMinutes -lt 10 }
  if ($recent.Count -ge 5) {
    Write-Log "PREVIEW-SUPERVISOR halting — $($recent.Count) deaths in 10 min. Wrote $HaltFile. Manual intervention needed."
    Set-Content -Path $HaltFile -Value "halted at $now after $($recent.Count) deaths in 10min"
    break
  }

  Write-Log "starting wrangler pages dev"
  # ROOT-CAUSE FIX (2026-07-01): Start-Process 'npx'/'wrangler' fails instantly with
  # "cannot find the file specified" because those are .cmd shims, not .exe — Start-Process
  # does not resolve PATH shims the way a shell does. This is the SAME bug the missions'
  # own render-witness steps hit. Invoke through cmd.exe /c with the full .cmd path so the
  # batch shim actually runs. (cmd.exe IS a real executable Start-Process can launch.)
  $wrangler = 'C:\Users\marka\AppData\Roaming\npm\wrangler.cmd'
  $cmdLine = "`"$wrangler`" pages dev . --port $Port --ip 127.0.0.1 --show-interactive-dev-session=false"
  $p = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList @('/c', $cmdLine) `
    -WorkingDirectory $RepoRoot -NoNewWindow -PassThru `
    -RedirectStandardOutput $OutLog -RedirectStandardError "$OutLog.err"

  Wait-Process -Id $p.Id
  $deaths.Add((Get-Date))
  Write-Log "wrangler exited (code $($p.ExitCode)) — restarting in 4s"
  Start-Sleep -Seconds 4
}
