# Laptop Setup — full conductor parity from any machine, any network

Target UX (operator, 2026-06-09): open laptop → ONE COMMAND → keys → pull any project →
continue working.

## The one command (exists today, needs the muezzin update — queued)

```powershell
irm https://nxtlvl.studio/get | iex
```

`/get` is the Claude OS bootstrap (PS5→PS7 guard, clones claude-governance, runs the
installer; last modified 2026-05-28). It predates the muezzin: UPDATE QUEUED to add —
clone + register muezzin-plugin (now on the gits: codeberg.org/nxtlvl/muezzin-plugin
PRIVATE — installer must check for an SSH key or token first), prompt/verify the three
env keys, offer `wrangler login`, finish with `muezzin doctor` (once built). Until the
update lands, the manual runbook below is the path. NOTE: /get currently serves from
the NAS (nginx) — works, but a CF Pages mirror is the road-safe home for the same file.

## One-time setup (≈15 min on a fresh machine)

1. **Base tools:** Claude Code, git, Node 18+ (wrangler runs via npx).
2. **Governance:** clone `claude-governance` → `~/.claude`
   (gits: github.com/nxtlvlyt + codeberg.org/nxtlvl). The hooks, canon, faiths, and
   practice arrive with it — the laptop conductor is governed identically to The
   Factory. (setup-guide.md canon covers verification.)
3. **The muezzin:** clone the muezzin-plugin repo (PUSH TO GITS FIRST — queued setup
   item; currently Factory-only) and register it (`.claude-plugin/plugin.json` is the
   manifest; `/muezzin` is the command).
4. **Keys (user-scope env):** `OLLAMA_API_KEY` (cloud seats — this is the only model
   access the laptop needs), `GOOGLE_PLACES_API_KEY` (scout), AIMLAPI key (media).
5. **Deploy auth:** `npx wrangler login` (browser OAuth to the Cloudflare account).

## What the laptop does NOT need

- **Local Ollama / local models.** The ollama-mcp wrapper (v1.1.0 waterfall) falls
  back to Ollama Cloud direct when no local daemon answers — labeled, never silent.
  Cloud seats do all seat-work on the road. (Local laguna-tier witnesses are a
  Factory luxury, not a dependency.)
- **Re-seating.** ROSTER.json is substrate in git: the laptop PULLS the seated roster;
  it never re-auditions. Only reseating triggers (catalog diff, digest change, canary
  failure) re-open seating, and those run wherever the conductor is.
- **The NAS.** Master storage syncs at home; nothing the laptop edits depends on it.

## Git push → all three remotes (operator requirement, 2026-06-09)

A bare `git push` hits ONE remote. The pattern for push-once-land-everywhere:
- **Laptop remotes = the two cloud gits** with a multi-push-URL remote:
  `git remote set-url --add --push origin git@github.com:nxtlvlyt/<repo>.git` then
  `--add --push` the codeberg URL — one `git push` now pushes both, serially.
- **The home Forgejo is a PULL-MIRROR, not a push target** — localhost:3002 is
  unreachable from the road, and a push-all containing it would fail at every
  campsite. Configure each Forgejo repo as a mirror of its Codeberg twin
  (Forgejo native mirroring, auto-sync interval) — home stays current without the
  laptop ever needing to reach it.
- Setup of both belongs in the /get installer update (queued mission).

## Daily flow on the road

1. `git pull` in `~/.claude` (governance current) and in the project repo (any client
   site, the factory, the plugin — all are clones).
2. Work: edit directly, or conduct — write a `*.mission.txt`, fire
   `node run-mission.mjs <mission-file> <sandbox>`, watch receipts.
3. Deploy: miniflare receipts locally → `wrangler` deploy → git push (Pages
   git-connected projects auto-deploy on push).
4. Content-only client changes don't even need the laptop — portal UI from any browser.

## To build (queued in missions/QUEUE.md)

- **`muezzin doctor`** — one command that checks: node/git present, env keys set,
  wrangler authed, ROSTER.json pulled + fresh (staleness window), one cheap canary
  ping per seated model via the cloud path, governance repo current. Green light =
  conduct from here.
- Push muezzin-plugin (+ site-factory when born) to the gits with the triple-remote
  pattern.
