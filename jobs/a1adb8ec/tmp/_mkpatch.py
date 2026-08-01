#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Emit the score-v33 generation-receipt patch, byte-exact against the CRLF original.

Run:  python _mkpatch.py <path-to-original-score-v33.py> <out.patch>
Never writes into conductor-qwen.  The original is read only.
"""
import difflib, hashlib, sys

SRC, OUT = sys.argv[1], sys.argv[2]
raw = open(SRC, "rb").read()
txt = raw.decode("utf-8")
assert raw.count(b"\r\n") and raw.count(b"\n") == raw.count(b"\r\n"), "expected an all-CRLF file"

# ---------------------------------------------------------------------------- hunk 1: gen()
OLD1 = (
'def gen(api, host, model, prompt, system, timeout=600, attempts=3, num_predict=700):\r\n'
'    if api == "openai":\r\n'
'        msgs = ([{"role": "system", "content": system}] if system else []) + \\\r\n'
'               [{"role": "user", "content": prompt}]\r\n'
'        body = json.dumps({"model": model, "messages": msgs, "temperature": 0.2,\r\n'
'                           "max_tokens": num_predict, "stream": False}).encode()\r\n'
'        path, pick = "/v1/chat/completions", lambda d: d["choices"][0]["message"]["content"]\r\n'
'    else:\r\n'
'        pl = {"model": model, "prompt": prompt, "stream": False, "think": False,\r\n'
'              "options": {"temperature": 0.2, "num_predict": num_predict}}\r\n'
'        if system is not None:\r\n'
'            pl["system"] = system\r\n'
'        body = json.dumps(pl).encode()\r\n'
'        path, pick = "/api/generate", lambda d: d.get("response", "")\r\n'
'    last = None\r\n'
'    for a in range(attempts):\r\n'
'        try:\r\n'
'            req = urllib.request.Request(host.rstrip("/") + path, data=body,\r\n'
'                                         headers={"Content-Type": "application/json"})\r\n'
'            with urllib.request.urlopen(req, timeout=timeout) as r:\r\n'
'                return pick(json.load(r))\r\n'
'        except Exception as e:\r\n'
'            last = e\r\n'
'            print("    attempt %d/%d failed: %r" % (a + 1, attempts, e))\r\n'
'    raise last\r\n'
)

NEW1 = (
'def gen(api, host, model, prompt, system, timeout=600, attempts=3, num_predict=700):\r\n'
'    """Returns (text, meta).  meta records WHY the generation ended.\r\n'
'\r\n'
'    `response` on its own cannot tell a finished answer from one guillotined at\r\n'
'    num_predict, and the two are scored identically by every rule in this file.  A lane\r\n'
'    whose rows ended on `length` is holding cut-off text -- the clause that would have\r\n'
'    scored may be past the cap -- and it is NOT comparable to a lane that never hit it.\r\n'
'    `think` stays False on every lane: the corpus targets are annotation prose, the\r\n'
'    daemon consumes `response`, and an in-band reasoning trace spends the SAME budget\r\n'
'    the answer needs -- which is exactly the asymmetry this receipt makes visible."""\r\n'
'    if api == "openai":\r\n'
'        msgs = ([{"role": "system", "content": system}] if system else []) + \\\r\n'
'               [{"role": "user", "content": prompt}]\r\n'
'        body = json.dumps({"model": model, "messages": msgs, "temperature": 0.2,\r\n'
'                           "max_tokens": num_predict, "stream": False}).encode()\r\n'
'        path, pick = "/v1/chat/completions", lambda d: d["choices"][0]["message"]["content"]\r\n'
'        meta_of = lambda d: {"stop_reason": ((d.get("choices") or [{}])[0] or {}).get("finish_reason"),\r\n'
'                             "out_tokens": (d.get("usage") or {}).get("completion_tokens"),\r\n'
'                             "thinking_chars": 0}\r\n'
'    else:\r\n'
'        pl = {"model": model, "prompt": prompt, "stream": False, "think": False,\r\n'
'              "options": {"temperature": 0.2, "num_predict": num_predict}}\r\n'
'        if system is not None:\r\n'
'            pl["system"] = system\r\n'
'        body = json.dumps(pl).encode()\r\n'
'        path, pick = "/api/generate", lambda d: d.get("response", "")\r\n'
'        meta_of = lambda d: {"stop_reason": d.get("done_reason"),\r\n'
'                             "out_tokens": d.get("eval_count"),\r\n'
'                             "thinking_chars": len(d.get("thinking") or "")}\r\n'
'    last = None\r\n'
'    for a in range(attempts):\r\n'
'        try:\r\n'
'            req = urllib.request.Request(host.rstrip("/") + path, data=body,\r\n'
'                                         headers={"Content-Type": "application/json"})\r\n'
'            with urllib.request.urlopen(req, timeout=timeout) as r:\r\n'
'                d = json.load(r)\r\n'
'            return pick(d), meta_of(d)\r\n'
'        except Exception as e:\r\n'
'            last = e\r\n'
'            print("    attempt %d/%d failed: %r" % (a + 1, attempts, e))\r\n'
'    raise last\r\n'
)

# ------------------------------------------------------------------- hunk 2: dispatch loop
OLD2 = (
'    for r in rows:\r\n'
'        p = os.path.join(outdir, "%02d-%s.txt" % (r["idx"], r["cls"]))\r\n'
'        if os.path.exists(p) and os.path.getsize(p) > 20:\r\n'
'            continue                                   # resume cache\r\n'
'        try:\r\n'
'            resp = gen(a.api, a.host, a.model, r["user"], system, num_predict=a.num_predict)\r\n'
'        except Exception as e:\r\n'
'            print("  row %02d: ERROR %r" % (r["idx"], e)); continue\r\n'
'        open(p, "w", encoding="utf-8").write(resp)\r\n'
'        print("  row %02d %s  %d chars" % (r["idx"], r["cls"], len(resp)))\r\n'
'\r\n'
'    agg, findings = score_dir(outdir, rows, lane)\r\n'
)

NEW2 = (
'    receipt = os.path.join(outdir, "GEN-RECEIPT.jsonl")\r\n'
'    for r in rows:\r\n'
'        p = os.path.join(outdir, "%02d-%s.txt" % (r["idx"], r["cls"]))\r\n'
'        if os.path.exists(p) and os.path.getsize(p) > 20:\r\n'
'            continue                                   # resume cache\r\n'
'        try:\r\n'
'            resp, meta = gen(a.api, a.host, a.model, r["user"], system,\r\n'
'                             num_predict=a.num_predict)\r\n'
'        except Exception as e:\r\n'
'            print("  row %02d: ERROR %r" % (r["idx"], e)); continue\r\n'
'        open(p, "w", encoding="utf-8").write(resp)\r\n'
'        meta.update({"idx": r["idx"], "cls": r["cls"], "chars": len(resp),\r\n'
'                     "num_predict": a.num_predict, "model": a.model, "api": a.api,\r\n'
'                     "when": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})\r\n'
'        with open(receipt, "a", encoding="utf-8") as fh:\r\n'
'            fh.write(json.dumps(meta) + "\\n")\r\n'
'        print("  row %02d %s  %d chars  stop=%s  out_tokens=%s%s"\r\n'
'              % (r["idx"], r["cls"], len(resp), meta.get("stop_reason"),\r\n'
'                 meta.get("out_tokens"),\r\n'
'                 "   <- CUT OFF AT num_predict" if meta.get("stop_reason") == "length" else ""))\r\n'
'\r\n'
'    # ---- generation receipts, read back over the WHOLE lane (not just this run) ---------\r\n'
'    # A resumed lane reuses transcripts this run never dispatched; their stop_reason is\r\n'
'    # unknown and is reported as unknown rather than assumed clean.\r\n'
'    seen = {}\r\n'
'    if os.path.exists(receipt):\r\n'
'        for ln in open(receipt, encoding="utf-8"):\r\n'
'            try:\r\n'
'                m = json.loads(ln)\r\n'
'            except Exception:\r\n'
'                continue\r\n'
'            seen[m.get("idx")] = m\r\n'
'    truncated = sorted(i for i, m in seen.items() if m.get("stop_reason") == "length")\r\n'
'    unreceipted = [r["idx"] for r in rows if r["idx"] not in seen]\r\n'
'    lane["truncated_rows"] = truncated\r\n'
'    lane["unreceipted_rows"] = unreceipted\r\n'
'    lane["gen_receipt"] = os.path.basename(receipt)\r\n'
'    json.dump(lane, open(os.path.join(outdir, "LANE.json"), "w", encoding="utf-8"), indent=2)\r\n'
'    if truncated:\r\n'
'        print("\\n  *** %d row(s) ended on `length`: %s"\r\n'
'              % (len(truncated), ", ".join("%02d" % i for i in truncated)))\r\n'
'        print("  *** Those transcripts are CUT OFF, not answers.  This lane is not")\r\n'
'        print("  *** comparable to a lane holding none.  Re-run it with a larger")\r\n'
'        print("  *** --num-predict into a FRESH --out directory -- the resume cache")\r\n'
'        print("  *** would otherwise keep every cut-off row.")\r\n'
'    if unreceipted:\r\n'
'        print("  NOTE: %d row(s) carry no generation receipt (transcript written before this\\n"\r\n'
'              "        scorer version, or resumed from cache): %s.\\n"\r\n'
'              "        Truncation is UNKNOWN for those rows -- do not read their absence\\n"\r\n'
'              "        from this list as a clean stop."\r\n'
'              % (len(unreceipted), ", ".join("%02d" % i for i in unreceipted)))\r\n'
'\r\n'
'    agg, findings = score_dir(outdir, rows, lane)\r\n'
)

new = txt
for old, rep in ((OLD1, NEW1), (OLD2, NEW2)):
    assert new.count(old) == 1, "anchor not unique/found:\n" + old[:120]
    new = new.replace(old, rep)

a = txt.split("\n")
b = new.split("\n")
diff = list(difflib.unified_diff(a, b, fromfile="a/phase3/score-v33.py",
                                 tofile="b/phase3/score-v33.py", n=3, lineterm=""))
body = "\n".join(diff) + "\n"
open(OUT, "w", encoding="utf-8", newline="").write(body)
print("original sha256 :", hashlib.sha256(raw).hexdigest())
print("patched  sha256 :", hashlib.sha256(new.encode("utf-8")).hexdigest())
print("wrote           :", OUT, len(body), "bytes")
open(OUT + ".expected", "w", encoding="utf-8", newline="").write(new)
