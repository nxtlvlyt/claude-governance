#!/usr/bin/env bash
# Restore web_search.py, then install the guard CORRECTLY.
#
# WHAT WENT WRONG IN THE FIRST ATTEMPT
# A blind string replace appended "\n            _cq_record(keywords, 0)" after
# "search_results = {}" using a hardcoded 12-space indent. The real line is indented 8. Result:
# IndentationError, and the broken file was WRITTEN BEFORE ast.parse ran - so validation
# happened after the damage instead of before it.
#
# Two directives were skipped:
#   D6  "Read a file fully before changing it." The indentation was never read, only assumed.
#   D4  Validation belongs before the write, not after.
# And a benchmark process was live against this module at the time.
#
# This version: read the real indentation from the file, build the replacement from it, parse
# the result IN MEMORY, and only write if it parses.
set -uo pipefail

WS=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/eval_checker/multi_turn_eval/func_source_code/web_search.py
BAK="$WS.bak-preguard-20260803"

echo "=== restore from backup ==="
test -f "$BAK" || { echo "FATAL: no backup at $BAK"; exit 2; }
cp "$BAK" "$WS"
python3 -c "import ast,sys; ast.parse(open(sys.argv[1],encoding='utf-8').read()); print('  restored file parses OK')" "$WS"

echo
echo "=== is the running benchmark still healthy? (it imported the module before the break) ==="
ps -eo pid,etime,args | grep '/root/bfclenv/bin/bfcl generate' | grep -v grep || echo "  no generate running"
echo -n "  rows: "; wc -l < /root/bfclproj/result/arch-gov-27b-sys/agentic/BFCL_v4_web_search_base_result.json 2>/dev/null || echo "?"

echo
echo "=== install guard, indentation read from the file, parse before write ==="
python3 - "$WS" <<'PY'
import ast, io, re, sys
p = sys.argv[1]
src = io.open(p, encoding="utf-8").read()

if "CQ_SEARCH_GUARD" in src:
    print("  already installed"); raise SystemExit(0)

# READ the actual indentation instead of assuming it.
m = re.search(r"^([ \t]*)search_results = \{\}\s*$", src, re.M)
if not m:
    print("  FAILED: could not locate the silent-empty line; refusing to guess"); raise SystemExit(1)
indent = m.group(1)
print("  silent-empty line indent measured: %d spaces" % len(indent))

guard = '''
# ---- CQ_SEARCH_GUARD (2026-08-03) --------------------------------------------------------
# A search backend that returns nothing SILENTLY is how web_search_base 14.00% was produced:
# SEARXNG_URL was unset, the harness fell back to localhost:8080 which WSL cannot reach, and
# every query returned {} with no error. That score measured a disconnected tool and was then
# cited as proof the model could not search. With the backend live, the same entries score
# 58.06%. So: count every call, and refuse to continue when search is dead.
import os as _cq_os, json as _cq_json, time as _cq_time, threading as _cq_threading

_CQ_LOG = _cq_os.getenv("CQ_SEARCH_LOG", "/root/bfclproj/search-calls.jsonl")
_CQ_MAX_EMPTY = int(_cq_os.getenv("CQ_MAX_CONSECUTIVE_EMPTY", "5"))
_cq_lock = _cq_threading.Lock()
_cq_state = {"calls": 0, "empty": 0, "consecutive_empty": 0}


class SearchBackendDead(RuntimeError):
    """Fatal by design. A benchmark that cannot search must stop, not score."""


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
                "q": (keywords or "")[:120], "n": n_results,
                "calls": snap["calls"], "empty": snap["empty"],
            }) + "\\n")
    except Exception:
        pass
    if snap["consecutive_empty"] >= _CQ_MAX_EMPTY:
        raise SearchBackendDead(
            "search returned nothing %d times in a row (%d empty of %d calls). Refusing to "
            "continue - a run that cannot search produces a score that measures the harness, "
            "not the model. Check SEARXNG_URL (%s) and the Brave API quota."
            % (snap["consecutive_empty"], snap["empty"], snap["calls"],
               _cq_os.getenv("SEARXNG_URL", "<unset -> localhost:8080, unreachable in WSL>")))
# ---- end CQ_SEARCH_GUARD -----------------------------------------------------------------
'''

last_import = 0
for mm in re.finditer(r"^(import|from)\s.*$", src, re.M):
    last_import = mm.end()
if not last_import:
    print("  FAILED: no import line"); raise SystemExit(1)
new = src[:last_import] + "\n" + guard + src[last_import:]

# Build the replacement using the MEASURED indent.
new = new.replace(indent + "search_results = {}",
                  indent + "search_results = {}\n" + indent + "_cq_record(keywords, 0)", 1)

msucc = re.search(r"^([ \t]*)if organic:\s*$", new, re.M)
if msucc:
    si = msucc.group(1)
    new = new.replace(si + "if organic:", si + "_cq_record(keywords, len(organic))\n" + si + "if organic:", 1)
    print("  success path instrumented at indent %d" % len(si))

# PARSE BEFORE WRITE. This is the whole lesson of the first attempt.
try:
    ast.parse(new)
except SyntaxError as e:
    print("  REFUSING TO WRITE - patched source does not parse: %s (line %s)" % (e.msg, e.lineno))
    raise SystemExit(1)
print("  patched source parses OK - writing")
io.open(p, "w", encoding="utf-8").write(new)
PY

echo
echo "=== verify live, on a real call ==="
cd /root/bfclproj
set -a; . ./.env; set +a
python3 - <<'PY'
import sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI, SearchBackendDead
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
print("  healthy call: %d chars, guard did not fire" % len(out))
print("  SearchBackendDead importable:", SearchBackendDead.__name__)
PY

echo
echo "=== call log ==="
[ -f /root/bfclproj/search-calls.jsonl ] && tail -2 /root/bfclproj/search-calls.jsonl || echo "  (empty)"
