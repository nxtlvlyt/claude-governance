import io

P = r'C:\Users\marka\.claude\muezzin-plugin\missions\cq-import-score-v33.mission.txt'
s = io.open(P, encoding='utf-8').read()

OLD = (
    r'$local = (Get-Content C:\Users\marka\conductor-qwen\SYSTEM-arch-gov-27b-v33.txt -Raw).TrimEnd(); '
    r'"SERVED-LEN=$($shown.Trim().Length) LOCAL-LEN=$($local.Length)"; '
    r'if ($shown.Trim() -ne $local) { "TRAP19-ROUNDTRIP-FAILED: served system prompt is not byte-equal to the local file"; exit 1 }; '
    r'"TRAP19-ROUNDTRIP-OK"'
)

NEW = (
    r'$local = (Get-Content C:\Users\marka\conductor-qwen\SYSTEM-arch-gov-27b-v33.txt -Raw); '
    '$sN = ($shown -replace "`r`n","`n").Trim(); '
    '$lN = ($local -replace "`r`n","`n").Trim(); '
    r'$na = ($sN.ToCharArray() | Where-Object {[int]$_ -gt 127}).Count; '
    r'"SERVED-NORM=$($sN.Length) LOCAL-NORM=$($lN.Length) NON-ASCII=$na"; '
    r'if ($na -ne 0) { "TRAP19 REAL: served prompt carries non-ascii - cp1252 mojibake"; exit 1 }; '
    r'if ($sN -cne $lN) { "TRAP19-ROUNDTRIP-FAILED: content differs after CRLF normalisation"; exit 1 }; '
    r'"TRAP19-ROUNDTRIP-OK (CRLF normalised: scp from Windows writes CRLF; measured 31 CR = the entire 4371-vs-4340 delta, content byte-identical, 0 non-ascii)"'
)

if OLD not in s:
    print('ANCHOR NOT FOUND - no change made')
    raise SystemExit(1)

s = s.replace(OLD, NEW)
io.open(P, 'w', encoding='utf-8').write(s)
print('step 4 amended: CRLF normalised, non-ascii still fails closed, content equality still strict')
print('anchor replaced:', OLD[:60], '...')
