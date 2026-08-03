#!/usr/bin/env bash
# Can the BFCL web_search harness actually reach a search engine from inside WSL?
#
# bfcl_eval/.../web_search.py:138  SEARXNG_BASE = os.getenv("SEARXNG_URL", "http://localhost:8080")
# SEARXNG_URL is not set in /root/bfclproj/.env, so the harness uses localhost:8080.
# PIPELINE.md:44 records that WSL cannot reach Windows-native localhost under NAT.
#
# If search is unreachable, then web_search_base 14.00% and web_search_no_snippet 7.00% -
# the two numbers V34-SUNNAH-SPEC calls the "untrained shape" and builds its whole diagnosis
# on - measure a model searching into a void, not a model failing to search.
#
# The operator asked directly, hours ago: "is it getting to use Sota search, that's its secret
# weapon". SearXNG was then repaired on the LAPTOP. This harness runs on nxtbeast, in WSL.
set -uo pipefail

echo "=== date ==="; date
echo
echo "=== 1. what the harness would use ==="
echo "  SEARXNG_URL env: ${SEARXNG_URL:-<unset, harness falls back to http://localhost:8080>}"

probe () {
  local label="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -m 12 -w "%{http_code}" "$url/search?q=test&format=json" 2>/dev/null || echo "000")
  printf "  %-34s %-46s HTTP %s\n" "$label" "$url" "$code"
  if [ "$code" = "200" ]; then
    local n
    n=$(curl -s -m 20 "$url/search?q=qlora+fine-tuning&format=json" 2>/dev/null \
        | python3 -c 'import sys,json; print(len((json.load(sys.stdin).get("results") or [])))' 2>/dev/null || echo "?")
    echo "                                     -> results for a real query: $n"
  fi
}

echo
echo "=== 2. candidate endpoints from inside WSL ==="
probe "harness default (WSL localhost)" "http://localhost:8080"
probe "WSL host bridge"                 "http://172.30.144.1:8080"
probe "nxtbeast tailscale"              "http://100.103.44.13:8080"
probe "laptop tailscale (Hermes)"       "http://100.106.55.85:8080"

echo
echo "=== 3. is anything listening on 8080 inside WSL? ==="
ss -tln 2>/dev/null | grep ':8080' || echo "  nothing listening on 8080 in this namespace"

echo
echo "=== 4. how the harness handles an unreachable backend ==="
sed -n '120,190p' /root/bfclenv/lib/python3.12/site-packages/bfcl_eval/eval_checker/multi_turn_eval/func_source_code/web_search.py
