#!/usr/bin/env python3
"""Is base 0/66 think-token starvation? top_p was refuted; this is suspect #2.
qwen3.6 is a hybrid thinker — with think on, output lands in message.thinking and content
stays empty until thinking ends; num_predict 600 may be consumed entirely inside <think>.
The tuned models answer directly (their corpus has no think blocks), so only base starves.
Same defect shape as kimi's empty-content day: budget eaten by thinking, wrong field read."""
import io, json, urllib.request

OLLAMA = "http://172.30.144.1:11434"
rows = [json.loads(l) for l in io.open("/mnt/c/Users/marka/cq-v34/phase4/holdout-v34-valid.jsonl", encoding="utf-8") if l.strip()]
msgs = [{"role": m["role"], "content": m["content"]} for m in rows[0]["messages"] if m["role"] in ("system", "user")]

for label, extra in [("think ON (as evaluated)", {}),
                     ("think OFF", {"think": False}),
                     ("think ON, budget 4000", {"options": {"num_predict": 4000}})]:
    body = {"model": "qwen3.6:27b", "messages": msgs, "stream": False,
            "options": {"num_predict": 600, "temperature": 0.3}}
    body.update(extra)
    if "options" in extra:
        body["options"].update(extra["options"])
    req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        d = json.loads(urllib.request.urlopen(req, timeout=300).read().decode("utf-8", "replace"))
        m = d.get("message") or {}
        print("%-26s content=%5d  thinking=%5d  done=%s"
              % (label, len(m.get("content") or ""), len(m.get("thinking") or ""), d.get("done_reason")))
    except Exception as e:
        print("%-26s FAILED %s" % (label, str(e)[:80]))
