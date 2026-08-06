# ============================= cgs_receipts.py =============================
"""cgs_receipts.py -- the daily graded-receipts post for the CGS community.

Composes ONE Discord embed from value_record.jsonl (the store cgs_value_record
--grade maintains) and posts it via CGS_WEBHOOK_URL:

  1. YESTERDAY  -- every bettable-era value pick whose game landed on
                   yesterday ET and went final: W-L-P line by line,
                   MISSES INCLUDED (a loss renders exactly like a win), each
                   at the journaled alerted price with its flat-1u ROI.
  2. CUMULATIVE -- the running bettable-era record: W-L-P, win pct of decided,
                   ROI at the alerted price, CLV vs the best real close
                   (is_closing rows only), pending + tracked counts. Small-N
                   honesty is AUTOMATIC: under 100 graded picks the card says
                   so ("N=x -- early, not proof"); the line disappears only
                   when the sample earns it.
  3. SHADOW     -- optional one-liner from sharp_record.jsonl: the sharp-watch
                   shadow tape graded W-L-P (signals observed + tracked,
                   never posted as picks). Absent file / no graded shadow rows
                   -> section silently absent.

HONESTY CONTRACT (inherited from cgs_value_record / cgs_brief):
  - Eras never mix: the headline is bettable-era only; prefilter-era rows are
    excluded here and reported by cgs_value_record --report separately.
  - NO BOOK NAMES ship: nothing renders best_book, AND every book name found
    in the record is passed to apply_gates as a name blocklist, so a leaked
    book name mechanically blocks the post (fail-closed, not a convention).
  - Every rendered number is registered as a gate source (cgs_gates
    number_gate); hype language is blocked by the same apply_gates call.
  - ROI is paper at the alerted price, flat 1u, never a filled ticket -- the
    embed says so.
  - Empty record -> NO post, exit 0 (quiet respect). A day with no graded
    picks still posts the cumulative record with an explicit "nothing went
    final yesterday" line -- that absence is information, not noise.

DEDUP: a state file (receipts_state.json) stores the last ET date a live post
shipped. --once refuses a second post on the same ET date (exit 0, logged)
unless --force is given, so a manual run today plus the scheduled task
tomorrow can never double-post the same day.

Modes:
  python cgs_receipts.py --dry        # compose + gate + print; no post
  python cgs_receipts.py --once       # one live cycle: compose + gate + post
  python cgs_receipts.py --selftest   # offline: synthetic rows; no net

Env: CGS_WEBHOOK_URL (required for --once; run_receipts_cgs.bat loads bot.env).
Reads value_record.jsonl + sharp_record.jsonl; writes only receipts_state.json.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cgs_gates import apply_gates
from cgs_brief import post_webhook, Src, _name_numbers   # proven plumbing

log = logging.getLogger("cgs_receipts")

# ----------------------------------------------------------------- constants

PIPELINE_DIR = Path(r"C:\Users\marka\cgsports-pipeline")
VALUE_RECORD = PIPELINE_DIR / "value_record.jsonl"
SHARP_RECORD = PIPELINE_DIR / "sharp_record.jsonl"
STATE_PATH = PIPELINE_DIR / "receipts_state.json"

COLOR_RECEIPTS = 0xE67E22
TITLE_EMOJI = "\U0001F9FE"        # receipt
MARK_WIN = "✅"
MARK_LOSS = "❌"
MARK_PUSH = "➖"
MARKS = {"win": MARK_WIN, "loss": MARK_LOSS, "push": MARK_PUSH}
WLP = ("win", "loss", "push")
SMALL_N_FLOOR = 100               # below this many graded picks, say so
MAX_PICK_LINES = 12
SEP = " · "
FOOTER = ("graded paper record at the alerted prices -- no tickets, "
          "no advice, educational tracking only")

try:
    from zoneinfo import ZoneInfo
    _ET = ZoneInfo("America/New_York")
except Exception:                 # loud-labeled fallback, cgs_brief pattern
    _ET = timezone.utc


def now_et() -> datetime:
    return datetime.now(timezone.utc).astimezone(_ET)


# ---------------------------------------------------------------- record I/O

def load_rows(path: Path) -> list:
    """value/sharp record jsonl -> list of row dicts, last line wins per
    play_id (cgs_sharp_record.load_record semantics, inlined: no DB import)."""
    out: dict = {}
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            pid = r.get("play_id")
            if pid:
                out[pid] = r
    return list(out.values())


def et_date(iso_ts):
    """ET calendar date of an ISO timestamp (None if unparseable -- a row
    without a readable game_date can never claim a date bucket)."""
    try:
        ts = datetime.fromisoformat(iso_ts)
    except (TypeError, ValueError):
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(_ET).date()


def book_blocklist(rows: list) -> tuple:
    """Every book name the record knows about -- fed to apply_gates so a book
    name in outbound text blocks the post mechanically."""
    books = {str(r.get("best_book")).strip() for r in rows
             if r.get("best_book")}
    return tuple(sorted(b for b in books if len(b) >= 3))


# ------------------------------------------------------------------- compose

def _pick_line(r: dict, src: Src) -> str:
    """One graded pick, miss or hit, at the alerted price. Never the book."""
    result = r["result"]
    mark = MARKS.get(result, "?")
    game = str(r.get("game") or "{} @ {}".format(r.get("away"), r.get("home")))
    market = str(r.get("market") or "?")
    side = str(r.get("side") or "?")
    src.add(*_name_numbers(game, side))
    pt = r.get("point")
    pt_txt = ""
    if pt is not None:
        src.add(pt)
        pt_txt = (" {:+g}".format(float(pt)) if market == "spreads"
                  else " {:g}".format(float(pt)))
    bp = r.get("best_price")
    if isinstance(bp, (int, float)) and not isinstance(bp, bool):
        src.add(bp)
        price_txt = " @ {:+d}".format(int(bp))
    else:
        price_txt = " @ n/a"
    u = r.get("roi_units_best")
    if u is not None:
        ru = round(float(u), 2)
        # register the integer part too: "+1.15u" backtracks to token "+1"
        # under the gate tokenizer (trailing u glues the decimals)
        src.add(float(u), ru, int(float(u)))
        u_txt = " ({:+.2f}u)".format(ru)
    else:
        u_txt = ""
    return "{} {} -- {} {}{}{}: {}{}".format(
        mark, game, market, side, pt_txt, price_txt, result.upper(), u_txt)


def _cum(bett: list) -> dict:
    graded = [r for r in bett if r.get("result") in WLP]
    w = sum(1 for r in graded if r["result"] == "win")
    l = sum(1 for r in graded if r["result"] == "loss")
    p = sum(1 for r in graded if r["result"] == "push")
    risked = [r for r in graded if r["result"] != "push"
              and r.get("roi_units_best") is not None]
    units = sum(float(r["roi_units_best"]) for r in risked)
    clv_rows = [r for r in bett if r.get("beat_close") is not None]
    beat = sum(1 for r in clv_rows if r["beat_close"])
    return {"graded": len(graded), "w": w, "l": l, "p": p,
            "decided": w + l, "units": units, "risked": len(risked),
            "clv_n": len(clv_rows), "clv_beat": beat,
            "pending": len(bett) - len(graded), "tracked": len(bett)}


def compose(value_rows: list, sharp_rows: list, yday, when: datetime):
    """Build (embed, sources). (None, None) when the bettable-era record has
    nothing graded at all -- the first public post waits for a real receipt."""
    bett = [r for r in value_rows if r.get("era") == "bettable"]
    c = _cum(bett)
    if c["graded"] == 0:
        return None, None

    src = Src()
    day = when.day
    src.add(day)
    title = "{} CGS Value Receipts{}{} {}".format(
        TITLE_EMOJI, SEP, when.strftime("%a %b"), day)
    description = ("*Yesterday graded line-shop value picks + the running "
                   "record. Every miss stays on the tape.*")
    embed = {"title": title, "description": description,
             "color": COLOR_RECEIPTS,
             "timestamp": datetime.now(timezone.utc).isoformat(),
             "fields": [], "footer": {"text": FOOTER}}

    # 1. YESTERDAY -- graded picks, misses included.
    y_rows = [r for r in bett if et_date(r.get("game_date")) == yday]
    y_graded = sorted((r for r in y_rows if r.get("result") in WLP),
                      key=lambda r: r.get("game_date") or "")
    y_pending = len(y_rows) - len(y_graded)
    if y_graded:
        yw = sum(1 for r in y_graded if r["result"] == "win")
        yl = sum(1 for r in y_graded if r["result"] == "loss")
        yp = sum(1 for r in y_graded if r["result"] == "push")
        y_units = sum(float(r["roi_units_best"]) for r in y_graded
                      if r["result"] != "push"
                      and r.get("roi_units_best") is not None)
        yu = round(y_units, 2)
        src.add(yw, yl, yp, y_units, yu, int(y_units))
        head = ("**{}-{}-{}** (W-L-P), net **{:+.2f}u** at the alerted "
                "prices.".format(yw, yl, yp, yu))
        if y_pending:
            src.add(y_pending)
            head += " {} still pending a final.".format(y_pending)
        # Fit the pick lines inside the 1024-char Discord field limit
        # WITHOUT slicing text (a sliced number would be an unregistered
        # token): drop whole lines from the end until it fits, keeping
        # the "+N more" remainder honest and gate-registered.
        lines = [_pick_line(r, src) for r in y_graded[:MAX_PICK_LINES]]
        while True:
            extra = len(y_graded) - len(lines)
            tail = []
            if extra > 0:
                src.add(extra)
                tail = ["+{} more on the tape".format(extra)]
            y_val = chr(10).join([head] + lines + tail)
            if len(y_val) <= 1024 or not lines:
                break
            lines.pop()
    else:
        y_val = ("No value picks went final yesterday -- nothing to grade. "
                 "An empty day posts as an empty day.")
        if y_pending:
            src.add(y_pending)
            y_val += " ({} pending a final.)".format(y_pending)
    embed["fields"].append({"name": "Yesterday" + SEP + "graded value picks",
                            "value": y_val[:1024], "inline": False})

    # FEED-HEALTH BANNER (2026-08-06 receipt: the odds API key died ~Jul 29 and the brief
    # posted "empty day" for 8 straight days over a DEAD feed -- a frozen record renders
    # identically to a quiet market unless the brief says which it is. If the alerts
    # journal hasn't written in >48h, say so LOUDLY at the top; silence is the bug.)
    try:
        _journal = Path(__file__).resolve().parent / "alerts_journal.jsonl"
        if _journal.exists():
            _age_h = (datetime.now(timezone.utc).timestamp() - _journal.stat().st_mtime) / 3600.0
            if _age_h > 48:
                _days = int(_age_h // 24)
                embed["fields"].insert(0, {
                    "name": "⚠ FEED HEALTH -- picks paused",
                    "value": ("The odds feed has produced no alerts for {} day(s). "
                              "The record below is FROZEN, not clean -- check "
                              "ODDS_API_KEY in odds.env (a dead key posts as endless "
                              "empty days).".format(_days))[:1024],
                    "inline": False})
    except Exception:
        pass  # the banner must never break the brief itself

    # 2. CUMULATIVE -- the bettable-era running record.
    src.add(c["w"], c["l"], c["p"], c["graded"], c["decided"], c["risked"],
            c["pending"], c["tracked"], c["clv_n"], c["clv_beat"])
    cu = round(c["units"], 2)
    src.add(c["units"], cu, int(c["units"]))
    first = "**{}-{}-{}** (W-L-P)".format(c["w"], c["l"], c["p"])
    if c["decided"]:
        first += SEP + "won {}% of decided".format(
            src.fmt(100.0 * c["w"] / c["decided"], 1))
    rec_lines = [first]
    if c["risked"]:
        rec_lines.append(
            "ROI **{:+.2f}u** on {}u risked ({}%) -- flat 1u paper at the "
            "alerted price, not filled tickets".format(
                cu, c["risked"], src.fmt(100.0 * c["units"] / c["risked"], 1)))
    if c["clv_n"]:
        rec_lines.append(
            "CLV: beat the best real closing price on {}/{} ({}%)".format(
                c["clv_beat"], c["clv_n"],
                src.fmt(100.0 * c["clv_beat"] / c["clv_n"], 1)))
    rec_lines.append("{} pending{}{} tracked since the bettable-books "
                     "filter landed".format(c["pending"], SEP, c["tracked"]))
    if c["graded"] < SMALL_N_FLOOR:
        rec_lines.append("N={} -- early, not proof. The record keeps posting "
                         "either way.".format(c["graded"]))
    embed["fields"].append({"name": "Bettable-era record" + SEP + "cumulative",
                            "value": "\n".join(rec_lines)[:1024],
                            "inline": False})

    # 3. SHADOW -- optional sharp-watch section.
    sh = [r for r in sharp_rows if r.get("source") == "shadow"
          and r.get("result") in WLP]
    if sh:
        sw = sum(1 for r in sh if r["result"] == "win")
        sl = sum(1 for r in sh if r["result"] == "loss")
        sp = sum(1 for r in sh if r["result"] == "push")
        src.add(sw, sl, sp, len(sh))
        embed["fields"].append({
            "name": "Sharp-watch shadow tape" + SEP + "context only",
            "value": ("**{}-{}-{}** graded from {} shadow signals -- "
                      "line-move signals observed and tracked, never posted "
                      "as picks.".format(sw, sl, sp, len(sh))),
            "inline": False})

    return embed, src.vals


# --------------------------------------------------------------- dedup state

def already_posted(today_iso: str, state_path: Path = STATE_PATH) -> bool:
    try:
        with open(state_path, encoding="utf-8") as fh:
            return json.load(fh).get("last_posted_et") == today_iso
    except (OSError, json.JSONDecodeError, AttributeError):
        return False


def mark_posted(today_iso: str, message_id, state_path: Path = STATE_PATH):
    tmp = str(state_path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"last_posted_et": today_iso,
                   "message_id": message_id,
                   "at": datetime.now(timezone.utc).isoformat()}, fh)
    os.replace(tmp, state_path)


# -------------------------------------------------------------------- cycle

def run_cycle(dry: bool, force: bool = False) -> int:
    webhook_url = os.environ.get("CGS_WEBHOOK_URL")
    if not dry and not webhook_url:
        raise RuntimeError("CGS_WEBHOOK_URL not set -- refusing a live cycle "
                           "(run_receipts_cgs.bat loads it from bot.env)")

    value_rows = load_rows(VALUE_RECORD)
    sharp_rows = load_rows(SHARP_RECORD)
    when = now_et()
    yday = when.date() - timedelta(days=1)

    embed, sources = compose(value_rows, sharp_rows, yday, when)
    if embed is None:
        log.info("bettable-era record has nothing graded -- no receipts post "
                 "yet (and that is correct)")
        return 0

    ok, report = apply_gates(embed, sources,
                             blocklist=book_blocklist(value_rows))
    if not ok:
        log.error("GATE BLOCK -- receipts do NOT ship: %s", json.dumps(report))
        return 1

    if dry:
        print("\n--- WOULD POST (receipts) ---")
        print(json.dumps(embed, indent=2))
        return 0

    today_iso = when.date().isoformat()
    if already_posted(today_iso) and not force:
        log.info("receipts already posted today (%s) -- dedup refuses a "
                 "second post (use --force to override)", today_iso)
        return 0

    result = post_webhook(webhook_url, embed)
    if result["status"] in (200, 204):
        mark_posted(today_iso, result["message_id"])
        log.info("receipts posted (msg %s)", result["message_id"])
        return 0
    log.error("webhook post FAILED status=%s", result["status"])
    return 1


# ----------------------------------------------------------------- selftest

def _mk(result="win", **kw):
    d = {"era": "bettable", "game": "Alpha @ Beta", "market": "h2h",
         "side": "alpha", "point": None, "price": 115,
         "gd": "2026-07-27T23:00:00+00:00", "beat": None, "book": "bookx"}
    d.update(kw)
    roi = {"win": 1.15, "loss": -1.0, "push": 0.0}.get(result)
    return {"play_id": "{}|{}|{}|{}|{}|{}|{}".format(
                d["game"], d["market"], d["side"], d["point"], d["gd"],
                result, d["price"]),
            "era": d["era"], "result": result, "roi_units_best": roi,
            "game": d["game"], "market": d["market"], "side": d["side"],
            "point": d["point"], "best_price": d["price"],
            "game_date": d["gd"], "beat_close": d["beat"],
            "best_book": d["book"]}


def selftest() -> int:
    import tempfile
    failures = []

    def check(name, cond):
        print("[{}] {}".format("PASS" if cond else "FAIL", name))
        if not cond:
            failures.append(name)

    when = datetime(2026, 7, 28, 9, 53, tzinfo=_ET)
    yday = when.date() - timedelta(days=1)

    rows = [
        _mk("win", gd="2026-07-27T23:00:00+00:00", beat=True),
        _mk("loss", game="Gamma @ Delta 76ers", side="delta 76ers",
            market="spreads", point=-1.5, price=-120,
            gd="2026-07-28T01:30:00+00:00", beat=False),   # 07-27 ET
        _mk("push", game="Eps @ Zeta", side="under", market="totals",
            point=2.5, price=-105, gd="2026-07-27T20:00:00+00:00"),
        _mk(None, game="Eta @ Theta", gd="2026-07-27T22:00:00+00:00"),
        _mk("win", game="Old @ Older", gd="2026-07-20T22:00:00+00:00",
            beat=True),
        _mk("win", era="prefilter", game="Pre @ Filter",
            gd="2026-07-27T21:00:00+00:00"),
    ]
    sharp = [{"play_id": "s1", "source": "shadow", "result": "win"},
             {"play_id": "s2", "source": "shadow", "result": "loss"},
             {"play_id": "s3", "source": "posted", "result": "win"},
             {"play_id": "s4", "source": "shadow", "result": None}]

    # 1. Full card composes and passes all gates (blocklist active).
    embed, src = compose(rows, sharp, yday, when)
    ok, report = apply_gates(embed, src, blocklist=book_blocklist(rows))
    check("full receipts card passes gates", ok)
    if not ok:
        print("  gate report:", json.dumps(report))

    ytext = embed["fields"][0]["value"]

    # 2. The loss ships too -- misses included, at its price, with -1.00u.
    check("miss rendered with X mark, price and -1.00u",
          MARK_LOSS in ytext and "-120" in ytext and "-1.00u" in ytext)

    # 3. ET bucketing: 01:30Z on the 28th is the 27th ET -> in yesterday.
    check("late-night UTC game lands on yesterday ET tape",
          "Gamma @ Delta" in ytext)

    # 4. Out-of-window and prefilter rows stay out of the yesterday field.
    check("old + prefilter rows excluded from yesterday",
          "Old @ Older" not in ytext and "Pre @ Filter" not in ytext)

    # 5. Cumulative is bettable-era only (prefilter win excluded): 2-1-1.
    ctext = embed["fields"][1]["value"]
    check("cumulative counts bettable era only (2-1-1)", "**2-1-1**" in ctext)

    # 6. Small-N honesty line present under the floor.
    check("small-N honesty language present", "early, not proof" in ctext)

    # 7. Large N: honesty line absent once the sample earns it.
    big = ([_mk("win", game="T{} @ U{}".format(i, i), side="t{}".format(i),
                gd="2026-07-20T22:00:00+00:00") for i in range(60)]
           + [_mk("loss", game="V{} @ W{}".format(i, i), side="v{}".format(i),
                  gd="2026-07-20T22:00:00+00:00") for i in range(60)])
    embed_big, src_big = compose(big, [], yday, when)
    ok_big, rep_big = apply_gates(embed_big, src_big,
                                  blocklist=book_blocklist(big))
    check("120-graded card gates clean, no small-N line",
          ok_big and "early, not proof" not in embed_big["fields"][1]["value"])
    if not ok_big:
        print("  gate report:", json.dumps(rep_big))

    # 8. Tampered number is caught.
    embed_t, src_t = compose(rows, sharp, yday, when)
    embed_t["fields"][1]["value"] += " True edge 12.7% nightly."
    ok_t, _ = apply_gates(embed_t, src_t, blocklist=book_blocklist(rows))
    check("tampered number blocked", not ok_t)

    # 9. A leaked book name is caught by the blocklist, mechanically.
    embed_b, src_b = compose(rows, sharp, yday, when)
    embed_b["fields"][0]["value"] += " best price was at bookx."
    ok_b, rep_b = apply_gates(embed_b, src_b, blocklist=book_blocklist(rows))
    check("leaked book name blocked", not ok_b and bool(rep_b["name_hits"]))

    # 10. No book name in the honestly composed card.
    check("composed card never names a book",
          "bookx" not in json.dumps(embed).lower())

    # 11. Empty bettable record -> no post.
    e_none, s_none = compose([_mk("win", era="prefilter")], [], yday, when)
    check("no graded bettable rows -> composes nothing",
          e_none is None and s_none is None)

    # 12. Quiet yesterday still posts cumulative with the honest line.
    only_old = [_mk("win", game="Old @ Older",
                    gd="2026-07-20T22:00:00+00:00", beat=True)]
    embed_q, src_q = compose(only_old, [], yday, when)
    ok_q, _ = apply_gates(embed_q, src_q, blocklist=book_blocklist(only_old))
    check("no-graded-yesterday card gates + says so",
          ok_q and "No value picks went final yesterday"
          in embed_q["fields"][0]["value"])

    # 13. Shadow section present only when shadow rows graded.
    names = [f["name"] for f in embed["fields"]]
    names_q = [f["name"] for f in embed_q["fields"]]
    check("shadow field present with rows, absent without",
          any("shadow" in n.lower() for n in names)
          and not any("shadow" in n.lower() for n in names_q))

    # 14. Dedup state: refuses same ET date, allows a new one.
    with tempfile.TemporaryDirectory() as td:
        sp = Path(td) / "state.json"
        check("fresh state -> not posted",
              not already_posted("2026-07-28", sp))
        mark_posted("2026-07-28", "123", sp)
        check("same date -> already posted", already_posted("2026-07-28", sp))
        check("next date -> not posted", not already_posted("2026-07-29", sp))

    print()
    if failures:
        print("SELFTEST FAILED: {}".format(failures))
        return 1
    print("SELFTEST PASSED: all cases green")
    return 0


# --------------------------------------------------------------------- main

def main() -> int:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)-7s %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S")
    ap = argparse.ArgumentParser(description="CGS daily graded receipts")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry", action="store_true")
    g.add_argument("--once", action="store_true")
    g.add_argument("--selftest", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="override the same-day dedup (live mode only)")
    args = ap.parse_args()

    if args.selftest:
        return selftest()
    if args.dry:
        return run_cycle(dry=True)
    return run_cycle(dry=False, force=args.force)


if __name__ == "__main__":
    raise SystemExit(main())
