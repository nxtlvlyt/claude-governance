"""
Swap BFCL's web_search backend from SerpAPI to the operator's SearXNG.

WHY: every BFCL number produced so far is the model answering COLD — no tools, no
retrieval. That is the opposite of the project's thesis ("a local model should be a router
of knowledge, it pulls the knowledge from outside of itself"). BFCL's `web_search` category
is the one that actually executes searches, but it ships hard-wired to SerpAPI, which needs
a paid SERPAPI_API_KEY and would test SerpAPI rather than the operator's own search.

The operator's standing ruling (2026-06-09) names SearXNG as "our SOTA search". This patch
points the category at it, so the category measures MODEL + OUR SEARCH.

The patch is surgical: it replaces only the SerpAPI request block and rebuilds the exact
`{"organic_results": [...]}` shape BFCL expects downstream, so the result-mapping code,
snippet handling and max_results slicing are untouched.
"""

import io
import os
import re
import sys

F = os.path.expanduser(
    "~/bfclenv/lib/python3.12/site-packages/bfcl_eval/eval_checker/"
    "multi_turn_eval/func_source_code/web_search.py"
)

src = io.open(F, encoding="utf-8").read()

if "SEARXNG_BASE" in src:
    print("ALREADY-PATCHED")
    sys.exit(0)

start = src.find('        backoff = 2  # initial back-off in seconds')
end = src.find('            break  # Success – no rate-limit error detected')
if start < 0 or end < 0:
    print("ANCHORS-NOT-FOUND start=%s end=%s" % (start, end))
    sys.exit(1)
end = src.index("\n", end) + 1

replacement = '''        # ---- SearXNG backend (operator ruling 2026-06-09: "our SOTA search" = SearXNG) ----
        # Replaces the SerpAPI/GoogleSearch call. Builds the SAME {"organic_results": [...]}
        # payload BFCL expects, so all downstream mapping is unchanged. No API key, no quota,
        # no 429 retry loop -- SearXNG is local.
        SEARXNG_BASE = os.getenv("SEARXNG_URL", "http://localhost:8080")
        search_results = {}
        try:
            resp = requests.get(
                SEARXNG_BASE.rstrip("/") + "/search",
                params={"q": keywords, "format": "json"},
                timeout=30,
            )
            resp.raise_for_status()
            payload = resp.json()
            organic = []
            for r in payload.get("results", []):
                organic.append(
                    {
                        "title": r.get("title") or "",
                        "link": r.get("url") or "",
                        "snippet": r.get("content") or "",
                    }
                )
            if organic:
                search_results = {"organic_results": organic}
            else:
                # EMPTY is a legitimate outcome and must surface as such, never as a
                # fabricated placeholder the model could quote back as a finding.
                search_results = {
                    "error": "SearXNG returned no results for this query."
                }
        except Exception as e:
            search_results = {"error": "SearXNG request failed: %s" % e}
'''

out = src[:start] + replacement + src[end:]
io.open(F, "w", encoding="utf-8").write(out)
print("PATCHED web_search.py -> SearXNG")
