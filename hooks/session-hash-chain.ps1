# ~/.claude/hooks/session-hash-chain.ps1
#
# Stop hook — SHA-256 rolling hash chain + RFC 3161 TSA anchoring.
#
# At session end:
# 1. Reads JSONL transcript line by line, computes rolling SHA-256 hash chain:
#    chain_hash_n = SHA256(line_n_bytes || chain_hash_{n-1})
# 2. Sends the final chain_hash to a public TSA (RFC 3161) — only the hash
#    leaves the machine, session content stays local.
# 3. Writes .hash-chain.json manifest with hash chain entries + TSA token.
#
# TSA token proves the final hash existed at a specific time, signed by an
# independent third party. This is cryptographic non-repudiation (P6 SOLVED).
#
# Failure behavior: fail-OPEN. TSA unavailability logs WARNING in manifest
# but does not block session end. Hash chain tamper-detection still applies.
#
# TSA endpoints (verified 2026-05-13):
#   Primary:   https://freetsa.org/tsr
#   Fallback1: http://timestamp.digicert.com
#   Fallback2: http://timestamp.acs.microsoft.com
#   Fallback3: http://timestamp.globalsign.com/tsa/r6advanced1
#
# Per IETF draft-sharif-agent-audit-trail (2025) + EU AI Act (Aug 2026).

$ErrorActionPreference = 'SilentlyContinue'

$stdin = [Console]::In.ReadToEnd()
$inp = $null
try { $inp = $stdin | ConvertFrom-Json } catch {}

if (-not $inp) { exit 0 }

$transcriptPath = $null
if ($inp.transcript_path) {
    $transcriptPath = $inp.transcript_path
} elseif ($inp.session_id) {
    $cwd = if ($inp.cwd) { $inp.cwd } else { (Get-Location).Path }
    $sanitized = ($cwd -replace '[\\/:]', '-')
    $transcriptPath = Join-Path $HOME ".claude\projects\$sanitized\$($inp.session_id).jsonl"
}

if (-not $transcriptPath -or -not (Test-Path $transcriptPath)) {
    exit 0
}

function Request-TSAToken([string]$hexHash) {
    $endpoints = @(
        'https://freetsa.org/tsr',
        'http://timestamp.digicert.com',
        'http://timestamp.acs.microsoft.com',
        'http://timestamp.globalsign.com/tsa/r6advanced1'
    )

    # Build RFC 3161 TimeStampReq ASN.1 DER (SHA-256 fixed structure)
    # SHA-256 OID: 2.16.840.1.101.3.4.2.1
    # Outer SEQUENCE length = 57 (0x39): version(3) + MessageImprint(51) + certReq(3)
    # MessageImprint length = 49 (0x31): AlgId(15) + OCTET STRING(34)
    # AlgorithmIdentifier length = 13 (0x0d): OID(11) + NULL(2)
    $hashBytes = [byte[]]::new(32)
    for ($i = 0; $i -lt 64; $i += 2) {
        $hashBytes[$i / 2] = [Convert]::ToByte($hexHash.Substring($i, 2), 16)
    }
    $header = [byte[]]@(
        0x30, 0x39,                                                    # SEQUENCE (57)
        0x02, 0x01, 0x01,                                              # version INTEGER 1
        0x30, 0x31,                                                    # MessageImprint SEQUENCE (49)
            0x30, 0x0d,                                                # AlgorithmIdentifier SEQUENCE (13)
                0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,  # SHA-256 OID
                0x05, 0x00,                                            # NULL
            0x04, 0x20                                                 # OCTET STRING (32)
    )
    $footer = [byte[]]@(0x01, 0x01, 0xff)                             # certReq BOOLEAN TRUE
    $tsaReq = $header + $hashBytes + $footer

    foreach ($ep in $endpoints) {
        try {
            $wr = [System.Net.WebRequest]::Create($ep)
            $wr.Method = 'POST'
            $wr.ContentType = 'application/timestamp-query'
            $wr.ContentLength = $tsaReq.Length
            $wr.Timeout = 8000
            $stream = $wr.GetRequestStream()
            $stream.Write($tsaReq, 0, $tsaReq.Length)
            $stream.Close()
            $resp = $wr.GetResponse()
            $ms = [System.IO.MemoryStream]::new()
            $resp.GetResponseStream().CopyTo($ms)
            $resp.Close()
            $tokenBytes = $ms.ToArray()
            if ($tokenBytes.Length -gt 10) {
                return [pscustomobject]@{
                    status   = 'OK'
                    endpoint = $ep
                    token    = [Convert]::ToBase64String($tokenBytes)
                }
            }
        } catch {}
    }
    return [pscustomobject]@{ status = 'FAILED_OPEN'; endpoint = $null; token = $null }
}

try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $enc    = [System.Text.Encoding]::UTF8

    function Compute-Hash([byte[]]$b) {
        -join ($sha256.ComputeHash($b) | ForEach-Object { $_.ToString('x2') })
    }

    $lines   = Get-Content $transcriptPath -Encoding UTF8 | Where-Object { $_ -ne $null }
    $genesis = '0' * 64
    $prev    = $genesis
    $entries = [System.Collections.Generic.List[object]]::new()

    foreach ($line in $lines) {
        $lb = $enc.GetBytes($line)
        $lh = Compute-Hash $lb
        $ch = Compute-Hash ($enc.GetBytes($line + $prev))
        $entries.Add([pscustomobject]@{ lh = $lh; ch = $ch })
        $prev = $ch
    }

    $sha256.Dispose()

    # Request TSA token for the final chain hash
    $tsa = Request-TSAToken $prev

    $manifest = [ordered]@{
        v           = 2
        transcript  = $transcriptPath
        ts          = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')
        session_id  = $inp.session_id
        n           = $lines.Count
        final       = $prev
        tsa_status  = $tsa.status
        tsa_endpoint = $tsa.endpoint
        tsa_token   = $tsa.token
        entries     = @($entries)
    }

    $manifestPath = ($transcriptPath -replace '\.jsonl$', '') + '.hash-chain.json'
    $manifest | ConvertTo-Json -Depth 4 -Compress |
        Set-Content -Path $manifestPath -Encoding UTF8 -NoNewline

    $short = if ($prev.Length -ge 16) { $prev.Substring(0,16) + '...' } else { $prev }
    if ($tsa.status -eq 'OK') {
        $ctx = "P6 hash chain + TSA token written: $manifestPath ($($lines.Count) entries, final=$short, tsa=$($tsa.endpoint))"
    } else {
        $ctx = "P6 hash chain written (TSA FAILED_OPEN): $manifestPath ($($lines.Count) entries, final=$short) — non-repudiation gap for this session"
    }
} catch {
    $ctx = "P6 hash chain: FAILED ($($_.Exception.Message)) — fail-open, session end not blocked"
}

$output = [ordered]@{
    decision = 'approve'
    reason   = $ctx
} | ConvertTo-Json -Compress

Write-Output $output
exit 0
