#!/usr/bin/env bash
# Give the BFCL web_search harness a search backend, and PROVE it through the harness's own
# code path rather than by pinging a URL.
#
# THE DEFECT
# bfcl_eval/.../web_search.py:138  SEARXNG_BASE = os.getenv("SEARXNG_URL", "http://localhost:8080")
# SEARXNG_URL was never set, and WSL cannot reach Windows-native localhost (PIPELINE.md:44).
# On failure the handler sets search_results = {} and returns silently - no error, no log line.
# So web_search_base 14.00% and web_search_no_snippet 7.00% were measured with a search tool
# that returned nothing on every call. V34-SUNNAH-SPEC calls those two numbers "the untrained
# shape" and builds its entire generalisation-cliff diagnosis on them.
#
# THE FIX
# The laptop (Hermes, 100.95.116.67) runs SearXNG and IS reachable from nxtbeast WSL over
# Tailscale: HTTP 200, 29 results for a real query. One env var.
#
# THE VERIFICATION THAT MATTERS
# Setting the variable is not evidence. Importing the harness's own search function and
# calling it is. A URL can answer while the harness still fails on parsing, auth, or shape -
# and this project has been bitten repeatedly by checks that pass while the thing is broken.
set -uo pipefail

ENVF=/root/bfclproj/.env
SEARX="http://100.95.116.67:8080"

echo "=== 1. record SEARXNG_URL in the project env ==="
if grep -q '^SEARXNG_URL=' "$ENVF" 2>/dev/null; then
  sed -i "s|^SEARXNG_URL=.*|SEARXNG_URL=$SEARX|" "$ENVF"
  echo "  updated existing SEARXNG_URL"
else
  cp "$ENVF" "$ENVF.bak-20260803"
  printf '\n# Added 2026-08-03. The harness defaults to localhost:8080, which WSL cannot reach\n# (PIPELINE.md:44). Without this, every search_engine_query returned {} silently and\n# web_search scores measured a void. Hermes laptop over Tailscale.\nSEARXNG_URL=%s\n' "$SEARX" >> "$ENVF"
  echo "  appended SEARXNG_URL"
fi
sed -E 's/(API_KEY=).*/\1<redacted>/' "$ENVF" | sed 's/^/    /'

echo
echo "=== 2. call the harness's OWN search function, with the env as bfcl will see it ==="
cd /root/bfclproj
set -a; . ./.env; set +a
python3 - <<'PY'
import os, sys
print("  SEARXNG_URL as seen by python:", os.getenv("SEARXNG_URL"))
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
try:
    from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI
except Exception as e:
    print("  IMPORT FAILED:", type(e).__name__, str(e)[:200]); raise SystemExit(1)

api = WebSearchAPI()
for meth in ("search_engine_query", "search", "web_search"):
    if hasattr(api, meth):
        fn = getattr(api, meth)
        print("  calling WebSearchAPI.%s(...)" % meth)
        try:
            out = fn(keywords="who won best picture at the 2024 academy awards")
        except TypeError:
            out = fn("who won best picture at the 2024 academy awards")
        except Exception as e:
            print("  CALL FAILED:", type(e).__name__, str(e)[:200]); raise SystemExit(1)
        s = str(out)
        print("  returned %d chars" % len(s))
        empty = s.strip() in ("{}", "[]", "None", "")
        print("  EMPTY RESULT:", "YES  <-- still broken" if empty else "NO   <-- search is live")
        print("  head:", s[:420].replace("\n", " "))
        break
else:
    print("  no recognised search method on WebSearchAPI; attrs:",
          [a for a in dir(api) if not a.startswith("_")][:15])
PY
