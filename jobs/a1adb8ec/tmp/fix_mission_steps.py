import io

P = r'C:\Users\marka\.claude\muezzin-plugin\missions\cq-import-score-v33.mission.txt'
s = io.open(P, encoding='utf-8').read()

start = s.index('```pwsh')
end = s.index('```', start + 7)
head, tail = s[:start], s[end:]

MF = r'C:\Users\marka\conductor-qwen\Modelfile-arch-gov-27b-v33'
GG = '/mnt/d/conductor-qwen/models/arch-gov-27b-v33.q4km.gguf'

step1 = (
    '$q = ssh nxtbeast "wsl -d Ubuntu -- stat -c %s ' + GG + '"; '
    '"Q4KM-BYTES=$q (reference 16810713472)"; '
    'if ([long]$q -ne 16810713472) { "GGUF-SIZE-MISMATCH — do not import"; exit 1 }; '
    '$mf = Test-Path ' + MF + '; '
    "$r = (Select-String -Path " + MF + " -Pattern '^RENDERER qwen3.5$' -Quiet); "
    "$p = (Select-String -Path " + MF + " -Pattern '^PARSER qwen3.5$' -Quiet); "
    "$sy = (Select-String -Path " + MF + " -Pattern '^SYSTEM ' -Quiet); "
    '"MODELFILE present=$mf renderer=$r parser=$p system=$sy"; '
    'if (-not ($mf -and $r -and $p -and $sy)) { "MODELFILE-INCOMPLETE"; exit 1 }'
)

# no nested powershell: df inside wsl, and a LOCAL byte scan of the local Modelfile
step2 = (
    '$na = (Get-Content ' + MF + ' -AsByteStream | Where-Object { $_ -gt 127 } | Measure-Object).Count; '
    '"NON-ASCII-BYTES=$na (TRAP 19 requires 0)"; '
    'if ($na -ne 0) { "MODELFILE-NOT-ASCII — Ollama on Windows will mojibake this"; exit 1 }; '
    '$dfa = ssh nxtbeast "wsl -d Ubuntu -- df -BG --output=avail /mnt/e"; '
    '$free = ($dfa | Select-Object -Last 1) -replace "[^0-9]",""; '
    '"E-FREE-GB=$free (import needs ~17)"; '
    'if ([int]$free -lt 25) { "BLOB-VOLUME-LOW — TRAP 20: ollama create reports invalid file magic when the volume is full"; exit 1 }'
)

step3 = (
    'scp ' + MF + ' nxtbeast:C:/Users/marka/conductor-qwen-run/Modelfile-arch-gov-27b-v33; '
    'ssh nxtbeast "ollama create arch-gov-27b-v33 -f C:\\Users\\marka\\conductor-qwen-run\\Modelfile-arch-gov-27b-v33"; '
    'if ($LASTEXITCODE -ne 0) { "OLLAMA-CREATE-FAILED"; exit 1 }; '
    'ssh nxtbeast "ollama list" | Select-String "arch-gov-27b-v33"'
)

# LOCAL Invoke-RestMethod against nxtbeast — no remote shell nesting at all
step4 = (
    "$body = @{model='arch-gov-27b-v33'} | ConvertTo-Json; "
    "$shown = (Invoke-RestMethod 'http://nxtbeast:11434/api/show' -Method Post -Body $body -TimeoutSec 90).system; "
    '$local = (Get-Content C:\\Users\\marka\\conductor-qwen\\SYSTEM-arch-gov-27b-v33.txt -Raw).TrimEnd(); '
    '"SERVED-LEN=$($shown.Trim().Length) LOCAL-LEN=$($local.Length)"; '
    'if ($shown.Trim() -ne $local) { "TRAP19-ROUNDTRIP-FAILED: served system prompt is not byte-equal to the local file"; exit 1 }; '
    '"TRAP19-ROUNDTRIP-OK"'
)

step5 = (
    "$gb = @{model='arch-gov-27b-v33'; prompt='FAILED missions/x.mission.txt. No receipts are present on this line. Give the next annotation clause.'; stream=$false; options=@{num_predict=200}} | ConvertTo-Json; "
    "$gen = (Invoke-RestMethod 'http://nxtbeast:11434/api/generate' -Method Post -Body $gb -TimeoutSec 600).response; "
    '$t = $gen.Trim(); "SMOKE-LEN=$($t.Length)"; '
    'if ($t.Length -lt 20) { "TRAP-5.2b LIVE: empty or near-empty generation — chat format still wrong. Do NOT score this model."; exit 1 }; '
    'Set-Content C:\\Users\\marka\\conductor-qwen\\V33-IMPORT-RECEIPT.md "v3.3 imported $(Get-Date -Format o)`nq4km bytes 16810713472 reference-match`nrenderer/parser qwen3.5 copied verbatim from base qwen3.6:27b`nTRAP19 round-trip OK`nsmoke chars $($t.Length)`nfirst300: $($t.Substring(0,[Math]::Min(300,$t.Length)))"; '
    '"IMPORT-OK"'
)

block = '```pwsh\n' + '\n'.join([step1, step2, step3, step4, step5]) + '\n'
io.open(P, 'w', encoding='utf-8').write(head + block + tail)
print('steps rewritten: no nested powershell -Command anywhere')
for i, st in enumerate([step1, step2, step3, step4, step5], 1):
    print('  step %d: nested-powershell=%s' % (i, 'powershell -NoProfile -Command' in st))
