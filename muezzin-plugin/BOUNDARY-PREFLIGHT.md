# BOUNDARY-PREFLIGHT.md

`boundary_preflight.mjs` — the boundary miqat. Built 2026-08-01, from six failures in one
session, all of the same shape: **the conductor asserted that something worked across a
boundary without testing the boundary, and a mission died.**

A boundary is any place where one interpreter hands a string to another: local shell → ssh →
remote Windows shell → WSL; mission text → `command_queue.mjs`; a fresh line → `AUTORUN.md`;
a file on this disk → a file on that one. Each hop can consume, rewrite, or silently
reinterpret what passes through it. None of them announce that they did.

This file is **not** documentation of the six failures. It is an executable that re-derives
each one against the live machine in about a minute and prints a receipt. Run it before you
fire; read the receipt instead of trusting your memory of how the boundary behaves.

```
node boundary_preflight.mjs                                    # B1-B5, environment only
node boundary_preflight.mjs --mission missions/x.mission.txt    # + B6-B9, gates the fire
node boundary_preflight.mjs --selftest                          # parsing logic, no ssh
node boundary_preflight.mjs --json                              # machine-readable receipt
```

Flags: `--host <name>` (default `nxtbeast`) · `--distro <name>` (default `Ubuntu`) ·
`--skip-remote` · `--strict-remote` (remote WARN → FAIL) · `--allow-wsl-shutdown`.

**Exit code is the gate.** Any `FAIL` → exit 1. `WARN` and `SKIP` → exit 0.

---

## Why an executable and not a checklist

Four of the six failures were already covered by a rule, a convention, or a comment somewhere
in this repo. None of those stopped them. The conductor read the mechanism, believed it, and
wrote the broken form anyway — because a remembered mechanism and a probed mechanism feel
identical from the inside. Conductor-core's first law ("read before you claim") and fifth law
("grade it or refute it — EXECUTED, with the receipt, or HYPOTHESIS") only bite when there is
something cheap to execute. This is that something.

Two of the six were also **causal claims that turned out to be wrong**, and the probes caught
them (see B3 below). A checklist would have carried the wrong claim forward forever.

---

## The checks

### B1 SHELL-REDIRECT — *does `<` / `>` survive `ssh host "wsl -d D -- ..."`?*

**Failures it came from (1 and 2).**
`ssh nxtbeast "wsl -d Ubuntu -- wc -c < FILE"` → `The system cannot find the path specified.`
And a `>` in the same position produced a zero-byte script → `TRAP6-ZERO-BYTE-SCRIPT`.

**Mechanism, probed live 2026-08-01.** Windows OpenSSH's default remote shell is `cmd.exe`.
`ssh host "STRING"` hands `STRING` to cmd, which parses `< > &` **itself**, before `wsl.exe`
is ever launched. The redirect therefore happens on the *Windows* filesystem, against a path
that only exists inside WSL.

Receipts the check prints:

| probe | result |
|---|---|
| `wsl -d Ubuntu -- stat -c %s /tmp/probe` (redirect-free) | `9` |
| `wsl -d Ubuntu -- wc -c < /tmp/probe` | `The system cannot find the file specified.` |
| `wsl -d Ubuntu -- bash -c 'wc -c < /tmp/probe'` | **same error — single quotes do not protect** |
| `wsl -d Ubuntu -- echo X > %TEMP%\f` | a *Windows-side* file is created, 15 bytes |

That last row is the whole of failure 2: the bytes went to Windows, and the WSL-side script
you thought you wrote was never there.

**The `bash -c '...'` row matters most.** The instinct after seeing failure 1 is to wrap the
payload in single quotes. cmd does not honour single quotes, so the wrap changes nothing —
proven, not assumed.

**Cures the check prints:**
- size of a file → `wsl -d D -- stat -c %s FILE` (never `wc -c < FILE`)
- read a file → `wsl -d D -- cat FILE`
- edit in place → `wsl -d D -- cp SRC DST` then `wsl -d D -- sed -i -e ... DST` (never `sed … > out`)
- anything genuinely needing `< > & |` → put it in a `.sh` file, `scp` the file up, run
  `wsl -d D -- bash /path/script.sh`. No metacharacter ever appears in the ssh payload.

**Verdict.** `EATEN` → PASS (that is the architecture, correctly observed). `SURVIVES` → WARN
(the environment changed; this document is now stale). No numeric baseline → WARN
INDETERMINATE, usually because WSL is down — see B5. **FAIL** when the redirect is eaten *and*
`--mission` carries the broken shape inside a quoted `ssh` payload.

**Law served:** first law (read before you claim); sixth law (a `.sh` file scp'd up is the
purpose-built form — hand-rolled quoting is the re-buy).

---

### B2 AMPERSAND — *does `&` survive the same path?*

**Failure it came from (3).** `& disown` for a detached launch → `'disown' is not recognized`.

**Mechanism, probed live.** Same as B1: cmd splits the payload at `&` and runs the tail
itself. The check proves it two ways —

| probe | result |
|---|---|
| `wsl -d Ubuntu -- true & disown` | `'disown' is not recognized as an internal or external command` |
| `wsl -d Ubuntu -- echo BP_A & echo BP_B_FROM_CMD` | `BP_B_FROM_CMD` — printed by **cmd**, not by WSL |

The second row is the unambiguous one: the tail of the payload executed in the wrong
interpreter, on the wrong machine's shell.

**Cure.** The reliable detached form puts the backgrounding *inside a file*: the script
contains `nohup ... &`, and the ssh payload contains no `&` at all —
`ssh host "wsl -d D -- bash /path/run.sh"`.

**Verdict.** Same scheme as B1; **FAIL** when `&` is eaten *and* the mission carries a bare
`&` inside a quoted ssh payload.

**Law served:** first law; fourth law (a named bug is not a handled bug — the name
`'disown' is not recognized` is now a gate).

---

### B3 LINE-ENDINGS — *where does the CR actually come from?*

**Failure it came from (6).** A byte-equality assertion between an Ollama-served string and a
local file: 4371 vs 4340 bytes. 31 CR = the entire delta. The content was identical and the
**check** was wrong.

**The claim that motivated this check was itself wrong, and the probe refuted it.** The
diagnosis on the night was "`scp` from Windows writes CRLF." Measured 2026-08-01:

| hop | bytes | CR |
|---|---|---|
| local write via node `fs.writeFileSync` | 17 | 0 |
| after `scp` up to nxtbeast and back | 17 | **0 — scp is byte-exact** |
| `pwsh -NoProfile -Command "Set-Content …"` | 20 | **3 — one per line** |
| `Out-File -Encoding ascii` | 20 | **3** |
| `git config core.autocrlf` in muezzin-plugin | — | **`true`** |

`scp` is not the culprit and never was. The CR comes from **the local writer** (any
PowerShell text writer emits CRLF) and from **git checkout** under `core.autocrlf=true`. This
matches the existing memory note *muezzin-plugin CRLF dry-run trap* — `git show HEAD:file`
normalises to LF and masks real CRLF files — which is the same hazard from the other side.

The signature to recognise: **a byte delta exactly equal to the line count is CRLF, not
content.** 31 CR = 31 lines.

**Cure the check prints.** Count CR on both sides; compare content-normalised (`strip \r`) as
well as raw; write with node `fs.writeFileSync` when the bytes must be LF-exact.

**Verdict.** PASS when the scp round trip is byte-identical. **FAIL** if scp ever *does*
inject CR (that would make every byte-equality assertion across it unsound). WARN for the
standing hazards: PowerShell writers injecting CR, `core.autocrlf=true` on a probed repo.

**Law served:** fifth law, exhaustive-probe clause — "X is why Y failed" ships only with X's
presence receipted at the failure. The scp hypothesis died on first contact with a probe.

---

### B4 EXEC-RESOLUTION — *which binaries actually resolve in the shell the engine uses?*

Not one of the six, but the same class: an assumption about a boundary — the PATH the
*engine* sees, not the one your interactive terminal sees. `seat_dispatch.mjs:288` runs every
command and validation line through `pwsh.exe -NoProfile -NonInteractive -Command`. This
check resolves `ssh scp node wsl git python python3 pwsh` **in that exact shell**.

Live result on Hermes 2026-08-01:

```
ssh, scp, node, wsl, git, pwsh -> real binaries
python  -> C:\Users\marka\AppData\Local\Microsoft\WindowsApps\python.exe   [STORE ALIAS STUB]
python3 -> C:\Users\marka\AppData\Local\Microsoft\WindowsApps\python3.exe  [STORE ALIAS STUB]
```

A `WindowsApps` path is a zero-byte Store execution alias: running it opens the Microsoft
Store and returns success-shaped nothing. **Any mission that shells `python` on this laptop
is broken before it starts.**

**Verdict.** FAIL if `ssh`, `node`, or `git` is absent, or if `pwsh.exe` itself cannot be
invoked. WARN for each Store alias stub.

**Law served:** first law; sixth law (name the tool that exists — and check it is the real one).

---

### B5 WSL-LIVENESS — *can `wsl -d Ubuntu --` run right now?*

nxtbeast's WSL intermittently refuses to attach its disk:

```
Failed to attach disk 'D:\WSL\Ubuntu\ext4.vhdx' to WSL2: Access is denied.
Error code: Wsl/Service/CreateInstance/MountDisk/HCS/E_ACCESSDENIED
```

Observed live during this build: **the same command failed and then succeeded minutes later
with no intervention.** That intermittency is precisely why this must be probed at fire time
rather than remembered from the last session.

The error text arrives as **UTF-16LE**, which reads as `F a i l e d   t o   a t t a c h` if
decoded as UTF-8 — a boundary inside the boundary. The script decodes by NUL-density so the
receipt is legible.

**Recovery is gated, deliberately.** `wsl --shutdown` fixes it, and it also kills every
running distro. So the check never runs it by default: `--allow-wsl-shutdown` is required
**and** `missions/_logs/daemon-status.json` must show zero lanes. This is
conductor-direct condition 3 (no lane running against the target) expressed mechanically —
during this build a `cq-score-v33` lane was live, so the recovery path was correctly refused.

**Verdict.** PASS when the probe echoes back. WARN when down and the mission does not use
WSL. **FAIL** when down *and* `--mission` invokes `wsl` — firing it is doomed.

**Law served:** eighth law ("is the broken thing actually broken RIGHT NOW?" — a park that
never re-probes its own premise is a memory-assertion wearing a disposition). The Stitch seat
sat healthy for a month behind parks that assumed it dead; this check is that question, asked
by a machine.

---

### B6 MISSION-CLASS — *will this mission's literal command queue actually be used?*

**Failure it came from (4), and it cost two missions.** A mission declared
`MISSION-CLASS: remote-compute`. There is no such class. `command_queue.mjs:20` matches only
`/MISSION-CLASS:\s*ops-deploy/i` or the literal token `command-class`; `mission_class.mjs:62-67`
recognises only `code-repo | research | code`. **An unrecognised value is never rejected — it
silently becomes `research`.** The fenced command block is then handed to the architect panel,
which is *instructed* to make paths cwd-relative, and the mission never runs from REPO-ROOT.

The check **imports** `isCommandClassMission` and `buildLiteralCommandQueue` — the engine's own
predicate, not a re-derivation (sixth law) — and reports:

- the class string the mission actually declared;
- whether it is one of `ops-deploy | code-repo | research | code`;
- the **effective** class, labelled `SILENT DEFAULT` when the declaration was ignored;
- for command-class missions: the built queue's step count, `mission_id`, and step 1 verbatim;
- for a fail-open: the engine's own reason string (missing `MISSION-ID`, missing `REPO-ROOT`,
  no fenced shell block).

**Verdict.** FAIL on an unrecognised class. FAIL when the mission *is* command-class but the
queue fail-opens. WARN when a non-command-class mission carries fenced shell commands anyway —
they will be re-planned, not run.

**Law served:** first law; sixth law.

---

### B7 AUTORUN-DUP — *will this line fire, or be silently skipped?*

**Failure it came from (5): `QUEUE-DUP skipped` ×4.** A fresh bare line was appended to
`AUTORUN.md` while a status line for the same path already existed. `readQueue`
(`muezzin-daemon.mjs:504-541`) skips it. Nothing fires; nothing errors; the queue just stays
quiet. **The convention is to RE-BARE THE ORIGINAL LINE IN PLACE.**

The check prints every AUTORUN line referencing the mission path, with line number and status
token, and returns one of:

| verdict | meaning | result |
|---|---|---|
| `WILL-FIRE` | exactly one actionable bare line | PASS |
| `QUEUE-DUP` | bare line beside a status line (no `<!-- SPLIT-CHILD -->`), or two bare lines | **FAIL** |
| `NOT-QUEUED` | only status lines — re-bare one in place | WARN |
| `ABSENT` | no line references this path | WARN |

It also carries the `SPLIT-CHILD` exemption (daemon hunt-item #13) and the stacked-status
`missionPath` loop, so its answer matches the daemon's.

**Second finding in the same check: diagnosis visibility.** `parseAutorun`
(`conduct-cycle.mjs:70`) skips `#`-prefixed lines *entirely*. A diagnosis written as its own
`# RESOLVED-LANDED: missions/x…` line is invisible — the FAILED line re-flags as undiagnosed
debt every beat, forever. The check WARNs when a `FAILED`/`PARKED` line carries no disposition
token (`RESOLVED` / `SUPERSEDED` / `DUPLICATE-RETIRED` / `PARKED` / `pending-engine` /
`DIAGNOSED`) *inside its own `<!-- -->` comment*, and says so louder when a `#` line nearby
does carry one.

**Why mirrored and not imported.** `muezzin-daemon.mjs:1839` is a **top-level**
`if (process.argv.includes('--selftest'))` block. Importing the daemon from a script that has
its own `--selftest` flag would run the daemon's entire suite on import. That is itself a
boundary this file respects; the mirrored predicates are locked by fixtures taken from the
daemon's own tests.

**Law served:** seventh law (a FAILED mark is diagnosis debt with a due date — this check
finds the debt that is invisible to the sweep); eighth law (an ownerless park is the failure
continuing under a calmer name).

---

### B8 LINT — *what does the miqat already know about this text?*

Calls `lintMission` from `mission_lint.mjs` — 22+ rules, each one the sediment of a paid-for
failure — and prints `ok` plus every problem with its rule name. **FAIL** if `ok:false`.

No new logic. The point is that the lint runs *at the same moment* as the boundary probes, so
one command answers "is this mission fireable" rather than three.

**Law served:** fourth law.

---

### B9 PATHS — *do the relative paths in the fenced block resolve?*

A relative path in a fenced command resolves only if the engine hands the mission **REPO-ROOT**
as its cwd — which happens **only** on the literal command-class path. B6 determines that, so
B9 reads B6's answer:

- literal queue **will** be used → WARN, listing each relative token (they resolve, but only
  against REPO-ROOT — verify that is what you meant);
- literal queue **will not** be used → **FAIL** (the cwd is a sandbox/worktree *and* the
  planner rewrites absolute paths to relative — the exact mechanism that failed
  `mt-accounts-deploy-1` three times, per `command_queue.mjs`'s own header).

The scanner is deliberately conservative — tuned against its own first live run, which flagged
`pending/0` and `PASS/0` out of a PowerShell status string and buried the real finding. A token
counts as a relative path only when it is explicitly relative (`./`, `../`, `.\`), ends in a
directory slash, or carries a file extension on its last segment; `sed s/a/b/` expressions,
URLs, `%TEMP%` expansions, flags and subcommand words are excluded.

**Law served:** sixth law (the engine stores what it already paid to learn — `command_queue.mjs`
preserves absolute paths *by design*; write them absolute and the machinery works).

---

## `--selftest`

42 assertions over the parsing logic, with no ssh, no network, no filesystem writes outside
`os.tmpdir()`. Covers: UTF-16LE decode, CR counting, redirect classification, Store-alias
detection, the AUTORUN mirror (WILL-FIRE / QUEUE-DUP / SPLIT-CHILD exemption / NOT-QUEUED /
ABSENT / stacked statuses / `#`-line invisibility), diagnosis visibility, mission-class
recognition including the invented-class case, the relative-path scanner including its own
false-positive receipts, and the ssh-antipattern scanner.

One assertion is a **drift guard**: the local fenced-command extractor must agree
step-for-step with `buildLiteralCommandQueue` on a command-class fixture. If either side
changes, the suite fails rather than the mirror silently rotting.

## Write discipline

Read-only against `missions/`, `AUTORUN.md`, and every project repo. The only things it writes
are its own probe files — `os.tmpdir()` locally, `%TEMP%` on the remote Windows side, `/tmp`
inside WSL — each deleted by the run that created it. Destructive recovery (`wsl --shutdown`)
is refused while any lane is running.

## Receipt of the build

| check | ran live 2026-08-01 | result |
|---|---|---|
| B1 SHELL-REDIRECT | yes, against nxtbeast | EATEN confirmed, both `<` and `>`, and inside `bash -c '…'` |
| B2 AMPERSAND | yes | EATEN confirmed, both probes |
| B3 LINE-ENDINGS | yes | **scp exonerated**; PowerShell writers + `core.autocrlf=true` named instead |
| B4 EXEC-RESOLUTION | yes | `python`/`python3` are Store alias stubs on Hermes |
| B5 WSL-LIVENESS | yes | observed DOWN (`ext4.vhdx` access denied) then UP minutes later; recovery correctly refused while `cq-score-v33` held a lane |
| B6-B9 | yes, on a real ops-deploy mission and on a synthetic mission carrying all six failures | 5 FAIL, exit 1 — the gate holds |

Not tested from here: whether the cures behave identically under a **non-cmd** remote shell
(if nxtbeast's sshd `DefaultShell` is ever set to PowerShell, B1/B2 would report `SURVIVES`
and this document goes stale by design — that is what the `SURVIVES` → WARN branch is for).
