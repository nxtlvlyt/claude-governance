#!/usr/bin/env bash
# Make search failure LOUD. Install a guard so a benchmark can never again measure a void.
#
# THE FAILURE THIS CLOSES
# bfcl_eval/.../web_search.py sets `search_results = {}` and returns when SearXNG is
# unreachable or returns nothing - no exception, no log line. On 2026-08-03 that produced
# web_search_base 14.00% and web_search_no_snippet 7.00%, which V34-SUNNAH-SPEC then used as
# proof that the model "collapses outside its trained shape". With search live the same
# entries score 58.06%. A whole corpus rebuild was justified by a number that measured a
# disconnected tool.
#
# WHY A GUARD RATHER THAN MORE SEARCH ENGINES
# Operator, 2026-08-03: "should we just keep with brave this sounds complicated". He is right.
# Adding Marginalia/Mojeek hedges against quota exhaustion, but quota exhaustion is only
# dangerous BECAUSE it is silent. Fix the silence and one engine is fine. Fewer moving parts,
# no new keys, no non-commercial licence to track.
#
# WHAT IT INSTALLS
#   1. A counter: every search_engine_query call appends to a log with its result size, so
#      Brave consumption is visible DURING a run rather than inferred after it.
#   2. A hard failure: N consecutive empty results raises instead of returning {}. A benchmark
#      that cannot search should crash, not score.
set -uo pipefail

WS=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/eval_checker/multi_turn_eval/func_source_code/web_search.py

echo "=== backup ==="
cp -n "$WS" "$WS.bak-preguard-20260803" && echo "  saved $WS.bak-preguard-20260803" || echo "  backup already exists"

echo
echo "=== current failure path (the silent return) ==="
grep -n "search_results = {}" "$WS" | head -5

echo
echo "=== install guard ==="
python3 - "$WS" <<'PY'
import io, re, sys
p = sys.argv[1]
src = io.open(p, encoding="utf-8").read()

if "CQ_SEARCH_GUARD" in src:
    print("  guard already installed"); raise SystemExit(0)

guard = '''
# ---- CQ_SEARCH_GUARD (added 2026-08-03) --------------------------------------------------
# A search backend that returns nothing SILENTLY is how web_search_base 14.00% was produced:
# SEARXNG_URL was unset, the harness fell back to localhost:8080 which WSL cannot reach, and
# every query returned {} with no error. The score measured a disconnected tool and was then
# cited as evidence the model could not search. With the backend live the same entries score
# 58.06%.
#
# So: count every call, and refuse to keep going when search is dead.
import os as _cq_os, json as _cq_json, time as _cq_time, threading as _cq_threading

_CQ_LOG = _cq_os.getenv("CQ_SEARCH_LOG", "/root/bfclproj/search-calls.jsonl")
_CQ_MAX_EMPTY = int(_cq_os.getenv("CQ_MAX_CONSECUTIVE_EMPTY", "5"))
_cq_lock = _cq_threading.Lock()
_cq_state = {"calls": 0, "empty": 0, "consecutive_empty": 0}


class SearchBackendDead(RuntimeError):
    """Raised when the search backend returns nothing repeatedly.

    Deliberately fatal. A benchmark that cannot search must stop, not score. The alternative
    is a plausible-looking number that measures a dead tool - which this project has already
    paid for once.
    """


def _cq_record(keywords, n_results):
    with _cq_lock:
        _cq_state["calls"] += 1
        if n_results:
            _cq_state["consecutive_empty"] = 0
        else:
            _cq_state["empty"] += 1
            _cq_state["consecutive_empty"] += 1
        snap = dict(_cq_state)
        try:
            with open(_CQ_LOG, "a", encoding="utf-8") as fh:
                fh.write(_cq_json.dumps({
                    "ts": _cq_time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "q": (keywords or "")[:120],
                    "n": n_results,
                    "calls": snap["calls"],
                    "empty": snap["empty"],
                }) + "\\n")
        except Exception:
            pass
        if snap["consecutive_empty"] >= _CQ_MAX_EMPTY:
            raise SearchBackendDead(
                "search returned nothing %d times in a row (%d empty of %d calls). "
                "Refusing to continue - a run that cannot search produces a score that "
                "measures the harness, not the model. Check SEARXNG_URL (%s) and the "
                "Brave API quota."
                % (snap["consecutive_empty"], snap["empty"], snap["calls"],
                   _cq_os.getenv("SEARXNG_URL", "<unset -> localhost:8080, unreachable in WSL>")))
# ---- end CQ_SEARCH_GUARD -----------------------------------------------------------------
'''

# Insert after the import block.
m = re.search(r"^(import|from)\s.*$", src, re.M)
if not m:
    print("  FAILED: no import line found; refusing to guess an insertion point"); raise SystemExit(1)
last_import = 0
for mm in re.finditer(r"^(import|from)\s.*$", src, re.M):
    last_import = mm.end()
src = src[:last_import] + "\n" + guard + src[last_import:]

# Every silent-empty return now records, and trips the guard on a streak.
n = src.count("search_results = {}")
src = src.replace("search_results = {}",
                  "search_results = {}\n            _cq_record(keywords, 0)")
print("  instrumented %d silent-empty path(s)" % n)

# Record successful calls too, so consumption is visible.
if "if organic:" in src:
    src = src.replace("if organic:",
                      "_cq_record(keywords, len(organic))\n            if organic:", 1)
    print("  instrumented the success path")

io.open(p, "w", encoding="utf-8").write(src)

import ast
ast.parse(src)
print("  AST OK")
PY

echo
echo "=== verify the guard is live and does not break a healthy call ==="
cd /root/bfclproj
set -a; . ./.env; set +a
python3 - <<'PY'
import sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI, SearchBackendDead
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
print("  healthy call returned %d chars, guard did not fire" % len(out))
print("  SearchBackendDead is importable:", SearchBackendDead.__name__)
PY

echo
echo "=== consumption so far (this is now visible during a run) ==="
[ -f /root/bfclproj/search-calls.jsonl ] && tail -2 /root/bfclproj/search-calls.jsonl || echo "  (log starts on next run)"
