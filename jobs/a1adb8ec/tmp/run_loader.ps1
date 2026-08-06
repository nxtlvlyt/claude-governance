# Runs the cgsports loader. Arg sets are BAKED IN and selected by a single
# MODE token (no quoted-string passing through ssh->cmd->powershell, which
# mangles quotes). Key loads from C:\temp\cgs\odds.env; never echoed.
param([string]$Mode = "dry-mlb")

$ARGSETS = @{
    "dry-mlb"        = @("--dry-run", "--families", "mlb")
    "dry-soccer"     = @("--dry-run", "--families", "soccer", "--max-soccer-leagues", "3")
    "dry-all"        = @("--dry-run", "--families", "nfl,ncaaf,nba,ncaab,mlb,nhl,soccer", "--max-soccer-leagues", "2")
    "live-inseason"  = @("--families", "mlb,wnba,soccer", "--with-scores")
    "live-wnba"      = @("--families", "wnba", "--with-scores")
    # Single-sport live modes. Added 2026-07-25 to verify the region widening
    # (us -> us,uk,eu,au) without paying for a 38-league soccer sweep. Cost per
    # run at 4 regions x 3 markets: 12 credits odds + 2 credits scores = 14.
    "live-mlb"       = @("--families", "mlb", "--with-scores")
    "live-us"        = @("--families", "nfl,ncaaf,nba,ncaab,mlb,nhl,wnba", "--with-scores")
    "live-all"       = @("--families", "nfl,ncaaf,nba,ncaab,mlb,nhl,wnba,soccer", "--with-scores")
}
if (-not $ARGSETS.ContainsKey($Mode)) {
    Write-Error "Unknown mode '$Mode'. Valid: $($ARGSETS.Keys -join ', ')"
    exit 2
}

foreach ($line in Get-Content "C:\Users\marka\cgsports-pipeline\odds.env") {
    if ($line -match "^([A-Z_]+)=(.+)$") {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
    }
}

if ($Mode -notlike "dry-*") {
    # DB creds pulled from the running container at exec time; never stored/printed.
    $pw = (docker exec cgsports-v2-db printenv POSTGRES_PASSWORD)
    if ($pw) { $env:CGSPORTS_DB_PASSWORD = $pw.Trim() }
    $portLine = (docker port cgsports-v2-db 5432/tcp | Select-Object -First 1)
    if ($portLine) { $env:CGSPORTS_DB_PORT = ($portLine -replace ".*:", "").Trim() }
}

# Log each run for receipts (scheduled-task runs are invisible otherwise).
$logDir = "C:\Users\marka\cgsports-pipeline\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory $logDir | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
python C:\Users\marka\cgsports-pipeline\cgsports_v2_loader.py @($ARGSETS[$Mode]) *>&1 |
    Tee-Object -FilePath "$logDir\run_${stamp}_$Mode.log"
# Keep the newest 200 logs
Get-ChildItem $logDir -Filter "run_*.log" | Sort-Object Name -Descending |
    Select-Object -Skip 200 | Remove-Item -Force -ErrorAction SilentlyContinue
exit $LASTEXITCODE
