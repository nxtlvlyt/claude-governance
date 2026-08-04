#!/usr/bin/env bash
# Correct the guard's hook placement. The counter was measuring itself.
#
# WHAT WAS WRONG
#   search_results = {}          <- INITIALIZATION, runs on every query before the request
#   _cq_record(keywords, 0)      <- my hook, so every healthy query logged one false "empty"
#   try:
#       ...
#       _cq_record(keywords, len(organic))   <- the correct hook
#
# Result: telemetry reported "50% of searches return nothing" when the true rate was 0%. Serial
# re-test returned 20 results for every query flagged empty; a 4-way concurrency test returned
# 19-20 for all. Brave direct returned HTTP 200.
#
# I labelled that line "the silent return" in my own installation script. It is not the failure
# path - it is the initialiser. I never read the function body before hooking it, on a file I
# had already broken once today by editing without reading (D6).
#
# CORRECT PLACEMENT
#   - remove the hook after the initialiser
#   - keep _cq_record(keywords, len(organic)) - it records 0 when SearXNG genuinely returns
#     nothing, which is a real empty
#   - add a hook in the `except` branch, where a request actually fails
#
# Note the accidental save: because a genuine failure raises before the success hook, the false
# init-hook was the only record on failure, so consecutive-empty still climbed and the guard
# would still have fired. It worked for the wrong reason. Telemetry and spend were doubled.
set -uo pipefail
WS=/root/bfclenv/lib/python3.12/site-packages/bfcl_eval/eval_checker/multi_turn_eval/func_source_code/web_search.py

cp "$WS" "$WS.bak-hookfix-20260803"
echo "  backed up"

python3 - "$WS" <<'PY'
import ast, io, re, sys
p = sys.argv[1]
src = io.open(p, encoding="utf-8").read()

# 1. Remove the false hook that follows the initialiser.
m = re.search(r"^([ \t]*)search_results = \{\}\n\1_cq_record\(keywords, 0\)\n", src, re.M)
if not m:
    print("  init-hook not found in expected form; refusing to guess"); raise SystemExit(1)
indent = m.group(1)
src = src.replace(m.group(0), indent + "search_results = {}\n", 1)
print("  removed false init hook (indent %d)" % len(indent))

# 2. Add a real hook where the request actually fails.
mex = re.search(r"^([ \t]*)except Exception as e:\n\1( +)search_results = \{\"error\": \"SearXNG request failed", src, re.M)
if mex:
    ei, bi = mex.group(1), mex.group(1) + mex.group(2)
    old = mex.group(0)
    new = (ei + "except Exception as e:\n" + bi + "_cq_record(keywords, 0)\n"
           + bi + "search_results = {\"error\": \"SearXNG request failed")
    src = src.replace(old, new, 1)
    print("  added hook to the except branch")
else:
    print("  WARNING: except branch not matched; failures will only be caught by the success "
          "hook not running")

try:
    ast.parse(src)
except SyntaxError as e:
    print("  REFUSING TO WRITE - does not parse: %s line %s" % (e.msg, e.lineno))
    raise SystemExit(1)
io.open(p, "w", encoding="utf-8").write(src)
print("  parsed OK, written")
PY

echo
echo "=== reset the contaminated log (it double-counted every call) ==="
if [ -f /root/bfclproj/search-calls.jsonl ]; then
  mv /root/bfclproj/search-calls.jsonl /root/bfclproj/search-calls.jsonl.bak-doublecounted
  echo "  old log moved aside; counts in it are 2x reality"
fi

echo
echo "=== verify: one healthy call should log exactly ONE record, with a real count ==="
cd /root/bfclproj
set -a; . ./.env; set +a
python3 - <<'PY'
import sys
sys.path.insert(0, "/root/bfclenv/lib/python3.12/site-packages")
from bfcl_eval.eval_checker.multi_turn_eval.func_source_code.web_search import WebSearchAPI
out = str(WebSearchAPI().search_engine_query(keywords="2024 academy awards best picture"))
print("  call returned %d chars" % len(out))
PY
echo "  log after one call:"
cat /root/bfclproj/search-calls.jsonl 2>/dev/null | sed 's/^/    /'
