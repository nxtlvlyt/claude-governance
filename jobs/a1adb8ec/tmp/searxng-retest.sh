#!/usr/bin/env bash
# Retest search reachability with the CORRECT laptop Tailscale IP.
#
# The previous probe used 100.106.55.85 for the laptop. That address was invented, not looked
# up; the real one is 100.95.116.67 (`tailscale ip -4` on the laptop). So one of the four
# "HTTP 000" results was a test of nothing. Same failure mode as the rest of today: an
# instrument reporting about itself.
#
# The laptop's SearXNG listens on :::8080 (all IPv6 interfaces) per Get-NetTCPConnection, so
# it may be reachable over Tailscale even though localhost-in-WSL is not.
set -uo pipefail

echo "=== date ==="; date
echo
echo "=== generate processes still alive? ==="
ps -eo pid,etime,args | grep '^ *[0-9]* *[0-9:]* */root/bfclenv/bin/python3 /root/bfclenv/bin/bfcl' || echo "  none (cliff test stopped)"

probe () {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "$url/search?q=test&format=json" 2>/dev/null || echo "000")
  printf "  %-32s %-40s HTTP %s\n" "$label" "$url" "$code"
  if [ "$code" = "200" ]; then
    curl -s -m 25 "$url/search?q=qlora+fine-tuning+catastrophic+forgetting&format=json" 2>/dev/null \
      | python3 -c '
import sys, json
d = json.load(sys.stdin)
rs = d.get("results") or []
print("      results: %d   unresponsive: %s" % (len(rs), [e[0] if isinstance(e,list) else e for e in (d.get("unresponsive_engines") or [])][:3]))
for r in rs[:3]:
    print("        -", (r.get("title") or "")[:70])
' 2>/dev/null || echo "      (json parse failed)"
  fi
}

echo
echo "=== reachability from nxtbeast WSL ==="
probe "laptop tailscale (CORRECT)"  "http://100.95.116.67:8080"
probe "laptop tailscale IPv6-ish"   "http://[fd7a:115c:a1e0::1]:8080"
probe "nxtbeast windows host"       "http://172.30.144.1:8080"
probe "nxtbeast tailscale"          "http://100.103.44.13:8080"

echo
echo "=== is a searxng container running anywhere on nxtbeast? ==="
which docker >/dev/null 2>&1 && docker ps --format '  {{.Names}}  {{.Image}}  {{.Status}}  {{.Ports}}' 2>/dev/null | head || echo "  docker not available in WSL"
