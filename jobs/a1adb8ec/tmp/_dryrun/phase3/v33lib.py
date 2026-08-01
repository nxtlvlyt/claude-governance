#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v33lib.py -- shared machinery for the v3.3 router corpus.

Two things live here and nothing else:
  1. SPECIFIC EXTRACTION  -- what counts as an asserted specific in a target
  2. THE HARD GATE        -- every specific in a target must be verbatim in its own prompt

Imported by build-train-v33.py.  Kept separate so the gate can be re-run against any
JSONL without re-running the build.
"""
import re

# ---------------------------------------------------------------------------
# 1. SPECIFIC EXTRACTION
# ---------------------------------------------------------------------------
# Ordered longest-first at match time.  Each kind is a class of thing a model can
# FABRICATE.  Governance vocabulary is deliberately NOT here (see WHITELIST) --
# "RESOLVED-LANDED" is a disposition, not a receipt.

PATTERNS = [
    ("url",        re.compile(r"https?://[^\s)>\]\"',]+")),
    # One datetime pattern, tolerant of the muezzin fuzz form and of a MISSING trailing
    # Z.  The three narrower patterns this replaces all failed on `2026-07-03T21:3x`,
    # and the date pattern below could not rescue it either: `\b` after the day fails
    # when the next character is `T`.  The timestamp then shattered into `2026` and
    # `3x`, which the evidence block dutifully listed as two unrelated fields -- so a
    # target could reassemble a timestamp out of parts and pass the gate.  Found by an
    # independent check after the first build claimed 0/360; see TRAIN-V33-REPORT.md s4a.
    ("iso_ts",     re.compile(r"\b\d{4}-\d{2}-\d{2}T[0-9x]{1,2}:[0-9x]{1,3}"
                              r"(?::[0-9x]{1,2}(?:\.\d+)?)?Z?")),
    ("date",       re.compile(r"\b\d{4}-\d{2}-\d{2}(?![-\d])")),
    ("clock",      re.compile(r"\b\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\b")),
    ("path",       re.compile(r"(?:[A-Za-z]:)?[\w.$-]*(?:[/\\][\w.$@-]+)+[/\\]?")),
    ("filename",   re.compile(r"\b[\w.$-]+\.(?:md|mjs|js|json|jsonl|py|txt|html|htm|toml|cmd|ps1|sh|yml|yaml|geojson|gguf|log|css|ts|tsx|csv|png|jpg|svg|xml|ini|env|lock|sql|tar|zip|gz)\b")),
    ("mission",    re.compile(r"\b(?:mt|atv|agy|cg|wr|eng)-[\w.-]*[\w]\b")),
    ("workflow",   re.compile(r"\bwf_[0-9a-zA-Z_]+\b")),
    ("sha",        re.compile(r"\b(?=[0-9a-f]{7,40}\b)(?=[0-9a-f]*[a-f])(?=[0-9a-f]*[0-9])[0-9a-f]{7,40}\b")),
    ("runid",      re.compile(r"\b\d{5,}\b")),
    ("kv",         re.compile(r"\b[A-Za-z][A-Za-z0-9_]{1,}=[^\s,;)\"]+")),
    ("measure",    re.compile(r"\b\d+(?:\.\d+)?\s?(?:ms|s|m|h|min|sec|GB|MB|KB|kB|TB|B|%|x|k)\b")),
    ("count",      re.compile(r"\b\d+\s*/\s*\d+\b")),
    ("exit",       re.compile(r"\bexit\s+\d+\b")),
    ("http",       re.compile(r"\bHTTP\s*\d{3}\b")),
    # NOTE: a bare two-part decimal is NOT a version here -- in this corpus it is
    # almost always a confidence ("APPROVE at 0.70").  Gating those produced a large
    # false-positive class on the prior corpora.  Limitation stated in the report.
    ("version",    re.compile(r"\bv\d+(?:\.\d+)+\b|\b\d+\.\d+\.\d+\b")),
    ("number",     re.compile(r"(?<![\w.])\d{3,}(?![\w.])")),
    ("probe_tok",  re.compile(r"\b[A-Z][A-Z0-9]*(?:[-_][A-Z0-9]+)+\b")),
    ("backtick",   re.compile(r"`[^`\n]{2,}`")),
    ("quoted",     re.compile(r"\"[^\"\n]{4,}\"")),
]

# Kinds that a CLASS R target may never contain at all -- these ARE receipts.
RECEIPT_KINDS = {"sha", "runid", "kv", "measure", "count", "exit", "http",
                 "url", "workflow", "iso_ts", "clock", "version", "number"}

# ---------------------------------------------------------------------------
# 1a. SPAN NORMALISATION FOR THE MEMBERSHIP TEST
# ---------------------------------------------------------------------------
# The two COMPOSITE kinds carry their own delimiters: `quoted` matches "..." INCLUDING
# the quote marks, `backtick` matches `...` including the backticks, and
# extract_specifics deliberately does NOT strip them (the composite-expansion step below
# recognises a composite by its delimiters, and strip_specifics has to delete the whole
# delimited run out of a CLASS R prompt).  The gate's membership test is verbatim
# substring containment, so a target that quotes its own prompt back registered as
# UNSOURCED whenever the prompt carries that phrase WITHOUT quotes: the phrase matches,
# the delimiters do not.
#
# Receipt (2026-08-01, eval/lane-claude-bare/LANE-NOTES.md s8a): 42 of that lane's 52
# flagged spans were `quoted` kind, and holdout row 26 was flagged for
#     "GENUINELY FAILED, not stale"
# -- a phrase present verbatim in row 26's own prompt, unquoted.  Uncorrected, the
# instrument reports quotation as fabrication and every lane comparison inherits it.
#
# This is a NORMALISATION, not a re-classification.  The span is still extracted, still
# carries its kind, and is still REPORTED with its delimiters so a reader sees what the
# model actually wrote; only the containment test sees the stripped form.  Stripping is
# iterative, so a fragment the model quotes out of a prompt span that is ITSELF quoted
# ("'GENUINELY FAILED'" -> GENUINELY FAILED) bottoms out at the bare phrase.
#
# Case is NOT folded.  Verbatim is the contract (README s1.1: "a token is a substring of
# the prompt or it is not"), and GENUINELY-FAILED vs Genuinely-failed is a real
# difference where the token is a disposition.  Re-cased echoes stay flagged.
QUOTE_CHARS = "\"'`“”‘’«»"


def unquote_span(tok):
    """Strip surrounding quote characters -- straight and curly, single and double, plus
    backticks -- and any whitespace they leave behind.  Idempotent, and a no-op on a span
    that carries no delimiters."""
    prev = None
    t = tok
    while t != prev:
        prev = t
        t = t.strip(QUOTE_CHARS).strip()
    return t


def is_sourced(tok, prompt):
    """Rule 1's membership test: is this asserted span present in the prompt?

    True when the span is verbatim in the prompt, OR when the span with its surrounding
    quote/backtick delimiters removed is.  The 2-character floor mirrors the one
    extract_specifics applies, so stripping can never reduce a span to a character that
    trivially matches."""
    if tok in prompt:
        return True
    t = unquote_span(tok)
    return len(t) >= 2 and t in prompt

# ---------------------------------------------------------------------------
# 2. WHITELIST -- tokens a target may name WITHOUT them appearing in the prompt
# ---------------------------------------------------------------------------
# Two families only, both documented in TRAIN-V33-REPORT.md:
#   (a) LADDER PROBES -- the actions the canon's ladder names.  A proposed probe
#       is not an asserted receipt; naming `ssh nxtbeast` claims nothing.
#   (b) BOARD FURNITURE -- the daemon's fixed layout, named by conductor-core.md's
#       own five-verb evidence map.  Not receipts; the room the conductor stands in.
# Nothing with a VALUE is ever whitelisted: no SHA, no timestamp, no count, no
# measurement, no run id, no mission-specific path.

WHITELIST_PROBES = [
    "ssh nxtbeast", "ollama /api/ps", "/api/ps", "/api/tags", "/api/show",
    "git show", "git log", "git status", "git diff", "git fsck", "node --check",
    "WebFetch", "SearXNG", "mcp__ollama-", "mcp__searxng-", "Read", "Grep", "Glob",
    "Agent", "curl", "wrangler", "npx", "python", "node",
]
WHITELIST_FURNITURE = [
    "AUTORUN.md", "QUEUE.md", "INBOX.md", "STATUS-BOARD.md", "STATE.md",
    "MISSION-LEDGER.md", "MISSION-STATUS.md", "OPERATOR-NOTIFY.log",
    "mission-events.jsonl", "missions/_logs/retro/", "missions/_logs/",
    "missions/", ".result.json", "result.json", "mission.result.json",
    ".mission.txt", "CLAUDE.md",
    "conductor-core.md", "operator-rulings.md", "muezzin-plugin",
]
# MATCHING IS EXACT, NOT SUBSTRING.  The substring rule was the same defect twice:
# it let the whitelisted probe `git diff` swallow the SHA beside it inside a backtick
# span, and it let the furniture DIRECTORY `missions/_logs/` whitelist every artifact
# beneath it -- which is how `missions/_logs/srcsha-fixture-update-patch.mjs`, a
# specific file this corpus must gate, was silently treated as furniture.
# A directory is furniture; a named file inside it is a receipt.  Only these few
# entries are genuine prefixes, and they are listed rather than inferred.
WHITELIST_PREFIX = ["mcp__ollama-", "mcp__searxng-"]
WHITELIST_EXACT = set(WHITELIST_PROBES) | set(WHITELIST_FURNITURE)
# Governance vocabulary: dispositions, laws, directives, gate names.  These are
# probe_tok-shaped but assert nothing about the world.
WHITELIST_GOVERNANCE = [
    "RESOLVED-LANDED", "FAILED-DIAGNOSED", "RESOLVED-SUPERSEDED", "RETIRE-SUPERSEDED",
    "DUPLICATE-RETIRED", "RETIRED-HISTORY", "PRODUCTION-SHIPPED", "NINTH-LAW",
    "GAP-PRIORITY-HOLD", "GAP-CLASS", "FAILED-STREAK-HOLD", "RUNNING-marked",
    "FAILED-marked", "DONE-marked", "QUEUE-DUP", "RE-BARED", "SPLIT-CHILD",
    "DONE-WITH-RECEIPT", "MIQAT-REFUSED", "REVISIT-JUDGED", "FALSE-DEATH",
    "KERNEL_SECURITY", "REAL_COST", "OPERATOR_VALUES", "NONE_OF_THE_THREE",
    "CLASS-R", "CLASS-I", "CLASS-P", "NO-RECEIPT", "STILL-BLOCKED",
    "ALLOW-FILES", "E2E", "CI", "D1", "D2", "D3", "D4", "D5", "D8", "D9", "D12", "D14",
]
WHITELIST = WHITELIST_PROBES + WHITELIST_FURNITURE + WHITELIST_GOVERNANCE


def _extract_flat(text, skip_composite=True):
    """Raw span pass: regexes + longest-first containment, no whitelist, no composite
    expansion.  Used on the INSIDE of a backticked or quoted span, where the composite
    kinds must be skipped or the recursion never bottoms out."""
    spans = []
    for kind, rx in PATTERNS:
        if skip_composite and kind in ("backtick", "quoted"):
            continue
        for m in rx.finditer(text):
            spans.append((m.start(), m.end(), m.group(0), kind))
    spans.sort(key=lambda s: (-(s[1] - s[0]), s[0]))
    taken, out = [], []
    for a, b, tok, kind in spans:
        if any(a >= x and b <= y for x, y in taken):
            continue
        taken.append((a, b))
        tok = tok.strip(" .,;:)(")
        if len(tok) >= 2:
            out.append((tok, kind))
    return out


def extract_specifics(text):
    """Return [(token, kind)] for every asserted specific in `text`, longest-first,
    non-overlapping, composites opened, whitelist applied."""
    spans = []
    for kind, rx in PATTERNS:
        for m in rx.finditer(text):
            spans.append((m.start(), m.end(), m.group(0), kind))
    # longest-first, then leftmost; drop any span contained in an accepted one
    spans.sort(key=lambda s: (-(s[1] - s[0]), s[0]))
    taken = []
    out = []
    for a, b, tok, kind in spans:
        if any(a >= x and b <= y for x, y, in taken):
            continue
        taken.append((a, b))
        if kind not in ("backtick", "quoted"):
            tok = tok.strip(" .,;:)(")          # regex tails, not part of the specific
        if len(tok) < 2:
            continue
        out.append((tok, kind))
    # A COMPOSITE SPAN IS NEVER WHITELISTED AS A UNIT.  `git show 03900d0` contains a
    # whitelisted probe AND a receipt; matching the whitelist against the whole span
    # dropped both.  That is how `git diff --quiet a2ecb2a` reached a target with a SHA
    # its prompt did not hold.  Composites are opened and their contents re-extracted,
    # so the command words are whitelisted and the receipt inside is not.
    expanded = []
    for tok, kind in out:
        if kind in ("backtick", "quoted"):
            inner = tok.strip("`\"")
            sub = [(t2, k2) for t2, k2 in _extract_flat(inner)]
            if sub:
                expanded.extend(sub)
                continue
        expanded.append((tok, kind))
    out = expanded
    # whitelist
    kept = []
    for tok, kind in out:
        t = tok.strip("`\"")
        if t in WHITELIST_EXACT or any(t.startswith(p) for p in WHITELIST_PREFIX):
            continue
        if t in WHITELIST_GOVERNANCE:
            continue
        # bare single characters
        if len(t) < 2:
            continue
        if kind in ("probe_tok", "version") and len(t) < 3:
            continue
        kept.append((tok, kind))
    # dedupe preserving order
    seen = set()
    ded = []
    for tok, kind in kept:
        if tok in seen:
            continue
        seen.add(tok)
        ded.append((tok, kind))
    return ded


def strip_specifics(text):
    """Delete every specific from `text` and tidy the wreckage.  Used to build the
    receipt-free board excerpt for CLASS R -- no [redacted] markers, because a
    marker is a cue and a cue defeats the class."""
    out = text
    for tok, _ in sorted(extract_specifics(text), key=lambda p: -len(p[0])):
        out = out.replace(tok, " ")
    # second pass: any surviving numeric literal is a magnitude, and a magnitude
    # in a CLASS R prompt is a receipt.  Governance tokens carry no digits.
    out = re.sub(r"(?<![\w])\d[\w.^/x-]*", " ", out)
    out = re.sub(r"\(\s*[;,/\-]*\s*\)", " ", out)
    out = re.sub(r"\[\s*\]", " ", out)
    out = re.sub(r"\s*[;,]\s*(?=[;,)])", "", out)
    out = re.sub(r"\(\s*", "(", out)
    out = re.sub(r"\s*\)", ")", out)
    out = re.sub(r"\s{2,}", " ", out)
    out = re.sub(r"\s+([.,;:)])", r"\1", out)
    out = re.sub(r"[ ]*\|[ ]*\|[ ]*", " | ", out)
    out = re.sub(r"(?:^|\s)[.:;,]+(?=\s|$)", " ", out)
    out = re.sub(r"\s{2,}", " ", out)
    return out.strip(" .,;:|-")


# ---------------------------------------------------------------------------
# 3. THE HARD GATE
# ---------------------------------------------------------------------------
def gate(prompt, target, cls, strict_r=True):
    """Return list of violation strings.  Empty list == row passes.

    Rule 1 (all classes): every specific asserted in the target must appear
                          verbatim in that row's own prompt.
    Rule 2 (CLASS R, strict): the target may contain no receipt-kind specific at
                          all.  Strict applies to redacted-board rows, whose prompt
                          holds no receipt by construction.  It is relaxed only for
                          escalation rows, whose prompt DOES carry the work already
                          done and whose target is supposed to cite it -- Rule 1
                          still binds those completely.
    Rule 3 (CLASS I):     the target must cite at least one specific from the prompt.
    """
    viol = []
    specs = extract_specifics(target)
    for tok, kind in specs:
        if not is_sourced(tok, prompt):     # quote/backtick delimiters normalised -- s1a
            viol.append("UNSOURCED_%s:%s" % (kind.upper(), tok[:60]))
    if cls == "R" and strict_r:
        for tok, kind in specs:
            if kind in RECEIPT_KINDS:
                viol.append("R_CARRIES_RECEIPT_%s:%s" % (kind.upper(), tok[:60]))
    if cls == "I":
        if not any(is_sourced(tok, prompt) for tok, _ in specs):
            viol.append("I_CITES_NOTHING")
    return viol
