# agy Implementation Research — Porting the Muezzin Engine onto Google Antigravity CLI

**Synthesized:** 2026-07-07, from 4 research lenses with per-claim adversarial verification.
**Verification legend:**
- **[VERIFIED]** — survived an adversarial re-verification pass with fresh receipts (refuted:false).
- **[PARTIALLY REFUTED]** — verification pass corrected part of the claim; corrected form given.
- **[REFUTED]** — failed verification; kept only as a warning.
- **[UNADJUDICATED]** — original researcher's receipts only; no adversarial pass ran. Original confidence shown.
- **[UNVERIFIED]** — web/community sources only, no local receipt.
- **[SYNTH]** — new finding produced during this synthesis from direct substrate reads (files read 2026-07-07 in this session).

**Input integrity note:** the findings payload handed to this synthesis was TRUNCATED mid-way
through lens 4 ("muezzin engine provider contract"): the last claim ("what agy_dispatch is
MISSING", item 6) was cut mid-sentence, and lens 4's adversarial-verification array plus any
later deliverables were lost entirely. Item 6 was completed here from a direct read of
`C:\Users\marka\.claude\muezzin-plugin\agy_dispatch.mjs` (full file) and
`seat_dispatch.mjs:300-379` this session. Anything the truncated tail contained beyond that is
NOT in this report — treat lens 4 as spot-confirmed but not fully adversarially verified.

---

## 1. How agy works (execution model, rules, plugins, sandbox)

### 1.1 Binary and engine architecture
**[VERIFIED, 0.95]** `agy.exe` is a single ~154MB Go binary (sole file in
`C:\Users\marka\AppData\Local\agy\bin`, 153,661,592 bytes) that on every logged run starts an
embedded local "language server" process listening on random localhost ports (gRPC/HTTPS +
plain HTTP; different port pairs each run). The agent engine is "Cortex", internal codename
"jetski", built on the Exafunction/Codeium (Windsurf) language-server architecture — binary
symbols include `google3/third_party/jetski/cortex/...` (98 lines),
`exa.language_server_pb.LanguageServerService` (32 hits), `codeium_common_go_proto` (168 hits).
*Source: `C:\Users\marka\.gemini\antigravity-cli\log\cli-20260623_002024.log:1-4`; rg -a over agy.exe; reproduced across 3 other run logs (2026-07-03, 2026-07-07 x2).*

### 1.2 Inference is cloud-only
**[UNADJUDICATED, 0.92]** The CLI authenticates via OS keyring OAuth (ChainedAuth, consumer
account; silent-auth in print mode), then calls Google's Cloud Code private API
(`https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` and
`:fetchAvailableModels`); the settings.json model is "propagated as backend override". No local
model path exists.
*Source: `cli-20260623_002024.log` ('ChainedAuth: authenticated via keyring', URL lines); `~/.gemini/antigravity-cli/settings.json` key `model`.*

### 1.3 Session model and projects
**[VERIFIED, 0.97]** Interactive TUI by default; `-p/--print` runs one prompt non-interactively
(`--print-timeout` default 5m0s); `-i/--prompt-interactive` seeds a session; `-c/--continue`
resumes the most recent conversation; `--conversation <id>` resumes by ID;
`--project`/`--new-project` bind the session to a project. Projects are tiny JSON registry
files at `~/.gemini/config/projects/<uuid>.json` (id → name → projectResources.resources[].folderUri);
workspace path → project id resolves via cache at startup.
*Source: agy --help (re-run at verification); `C:\Users\marka\.gemini\config\projects\4e33d074-....json`; `cli-20260623_002024.log:31-32,41` (project.go 'via cache' + server.go 'Backend project ID updated dynamically' + printmode.go start line).*

### 1.4 Conversation persistence
**[UNADJUDICATED, 0.9]** One SQLite `.db` per conversation under
`~/.gemini/antigravity-cli/conversations/` (452 present), plus `conversation_summaries.db` and
`history.jsonl` recording each prompt `{display, timestamp, workspace, conversationId}`. The
engine calls this the "trajectory store manager with proto store and SQLite store".
*Source: directory listing; history.jsonl; `cli-20260623_002024.log`.*

### 1.5 Brain directories and transcripts — PARTIALLY REFUTED
**[PARTIALLY REFUTED — corrected claim below]** Original claim said every conversation's brain
dir is a git repo holding artifacts and scratch scripts. Verification (2026-07-07):
- **HOLDS:** brain dirs `~/.gemini/antigravity-cli/brain/<conversationId>/` exist (452);
  450/452 contain `.system_generated\logs\transcript.jsonl` + `transcript_full.jsonl` (the
  transcriptPath hooks receive). Transcript records are step objects
  `{step_index, source: USER_EXPLICIT|SYSTEM|MODEL, type: USER_INPUT|PLANNER_RESPONSE|CHECKPOINT|GENERIC|CONVERSATION_HISTORY|RUN_COMMAND|VIEW_FILE, status, thinking, content, tool_calls}`.
  Long-context truncation via injected SYSTEM CHECKPOINT summary steps confirmed verbatim.
- **REFUTED:** "every ... is a real git repo" — only 17/452 have `.git` (git init is
  conditional); where git exists it snapshots ONLY the transcript files ("Snapshot" commits),
  zero artifacts/scratch in git; only 12/400 sampled dirs contain any non-system files;
  `.tempmediaStorage` exists in only 18/452 (screenshot-conditional).
- **Corrected claim:** every conversation gets a brain dir with the two transcript files
  (schema + CHECKPOINT mechanism as stated); git, artifacts, and media storage are conditional
  per-conversation features.
*Source: `C:\Users\marka\.gemini\antigravity-cli\brain\0486c426-...\` + 452-dir census (verification probe 2026-07-07).*

### 1.6 Tools = Cortex step types
**[UNADJUDICATED, 0.93]** 80+ step types enumerated in the binary (RUN_COMMAND, VIEW_FILE,
GREP_SEARCH, LIST_DIRECTORY, GIT_COMMIT, EDIT/EXECUTE_NOTEBOOK, GENERATE_IMAGE, MCP_TOOL,
INVOKE_SUBAGENT, BROWSER_SUBAGENT, large BROWSER_* family). Hook matcher tool names = step type
lowercased minus `CORTEX_STEP_TYPE_` prefix. Terminal commands execute locally via the language
server's `exebox` package; confirmations log approved/sandboxOverride/persistGrants; "always
allow" grants persist into settings.json `permissions.allow` as pattern strings
(`command(...)`, `read_url(...)`, `mcp(...)`; ~200 entries on this machine).
*Source: rg -a CORTEX_STEP_TYPE_ over agy.exe; `cli-20260626_141245.log` input_loop.go:459; settings.json; builtin hooks.md.*

### 1.7 Permission model
**[VERIFIED, 0.95]** `~/.gemini/antigravity-cli/settings.json` knobs: `toolPermission`
(always-proceed | request-review | strict | proceed-in-sandbox), `allowNonWorkspaceAccess`
(bool), `trustedWorkspaces` (currently just `C:\Users\marka`), `permissions.allow` grant list.
This machine runs `toolPermission=always-proceed` + `allowNonWorkspaceAccess=true` — effectively
unattended full-auto. `--dangerously-skip-permissions` exists as a CLI flag ("Auto-approve all
tool permission requests without prompting").
*Source: settings.json (read at verification); agy --help; binary strings; builtin/skills/antigravity_guide/references/app.md:46-48.*

### 1.8 Sandbox
**[UNADJUDICATED, 0.9]** `--sandbox` on Windows is implemented via Windows AppContainer: exebox
calls CreateAppContainerProfile/DeleteAppContainerProfile, path-capability SIDs limit
filesystem access, NetworkIsolationSetAppContainerConfig restricts network; `UnsafeNoSandbox`
option and per-tool-call `sandboxOverride` exist. Settings key: `enableTerminalSandbox`.
Third-party (UNVERIFIED) coverage: blocks writes outside project root; sandbox-exec on macOS /
nsjail on Linux.
*Source: rg -a strings from agy.exe; third-party: explainx.ai blog (unverified).*

### 1.9 Rules loading (AGENTS.md / GEMINI.md)
**[UNADJUDICATED, 0.92]** Standalone GEMINI.md / AGENTS.md are hierarchical directory rules —
always-on for their directory scope, no frontmatter, discovered by walking up from CWD (and
edited files' dirs) to the repo root; `.agents/rules/*.md` also load. Workspace customization
roots: `.agents/` (also `.agent/`, `_agents/`, `_agent/`); machine-global root:
`~/.gemini/config/`. Priority (high→low): workspace hierarchical > workspace-declared
skills.json/plugins.json > global discovery > built-in > global declared. Dedup by resolved
path per turn.
*Source: builtin `agy-customizations/SKILL.md` + `docs/rules.md` (both embedded verbatim in agy.exe).*

**[UNADJUDICATED, 0.75 — load-bearing caveat]** The user's `~/.agents/AGENTS.md` (+ faiths/,
rules/, skills/muezzin/) is honored NOT because `~/.agents` is a documented global root, but
because `C:\Users\marka` itself is the trusted workspace, making `~/.agents` the workspace root
under hierarchical discovery. **If agy runs with CWD inside another repo, the walk-up stops at
that repo's root and `~/.agents` may never be reached.** The documented machine-global location
is `~/.gemini/config/` (where the 8 plugins actually live).
*Source: settings.json trustedWorkspaces; history.jsonl workspace fields; builtin SKILL.md; `~/.agents/` listing.*

### 1.10 Skills, plugins, hooks, MCP, sidecars
- **Skills [UNADJUDICATED, 0.95]:** `skills/<name>/SKILL.md` with YAML frontmatter (name,
  description required); progressive disclosure — only name+description injected until
  activation. Rules with `trigger: model_decision` behave the same; only `always_on` rules load
  unconditionally. *Source: builtin docs/skills.md.*
- **Plugins [UNADJUDICATED, 0.93]:** directory under `plugins/` marked by `plugin.json` (only
  required file), optionally skills/, rules/, hooks.json, mcp_config.json, agents/, commands/.
  Live example already working: `~/.gemini/config/plugins/muezzin/` (plugin.json + hooks.json +
  muezzin_hook.py + rules/ + skills/), validated OK. *Source: builtin docs/plugins.md; `agy plugin validate` run.*
- **Plugin subcommands [UNADJUDICATED, 0.9]:** list (IMPORTED only — prints "No imported
  plugins." even with 8 discovered), import [gemini|claude] (a Claude Code plugin importer
  exists in the binary: `third_party/jetski/cli/plugins/claude/importer.go`), install
  (plugin@marketplace), uninstall/enable/disable (disable = rename manifest to
  `plugin.json.disabled`), validate, link. *Source: agy help plugin; rg -a agy.exe; live `sidecar.json.disabled` convention.*
- **Hooks [UNADJUDICATED, 0.95 — the key governance surface]:** hooks.json in any customization
  root or plugin. Events: PreToolUse/PostToolUse (regex `matcher` on tool name), PreInvocation,
  PostInvocation, Stop. Handlers are shell commands (`cmd /c` on Windows), cwd = hooks.json's
  dir, 30s default timeout, synchronous. Contract: JSON stdin (camelCase: conversationId,
  workspacePaths, transcriptPath, artifactDirectoryPath, modelName, toolCall, stepIdx) → JSON
  stdout. PreToolUse can return allow/deny/ask/force_ask + permissionOverrides;
  Pre/PostInvocation can injectSteps; PostInvocation can force_continue/terminate; Stop can
  return decision 'continue' to block stopping. **The muezzin plugin already wires all four
  events to muezzin_hook.py.** *Source: builtin docs/hooks.md; live `~/.gemini/config/plugins/muezzin/hooks.json`.*
- **MCP [UNADJUDICATED, 0.95]:** global `~/.gemini/config/mcp_config.json` + plugin-scoped;
  stdio or serverUrl SSE; discovered tool schemas cached at
  `~/.gemini/antigravity-cli/mcp/<server>/<tool>.json`. Live: muezzin (5 tools incl.
  orchestrate, run_mission, conduct_cycle) and searxng (SEARXNG_URL=http://nxtbeast:8080)
  already registered. *Source: mcp_config.json; cached schemas; builtin docs/mcp_servers.md.*
- **Sidecars [UNADJUDICATED, 0.8]:** `~/.gemini/config/sidecars/<name>/sidecar.json` declaring
  {command, args, env, restart_policy} for Antigravity-managed background daemons. A
  muezzin-daemon sidecar exists on this machine, disabled via `.disabled` rename.
  *Source: `sidecar.json.disabled` content; builtin guide sitemap.*
- **Product family [UNADJUDICATED, 0.85]:** four surfaces share the Cortex core: agy CLI,
  Antigravity 2.0 desktop, Antigravity IDE (VS Code fork), Python SDK
  (`pip install google-antigravity`; read-only by default until CapabilitiesConfig enables
  write tools). Subagents first-class (INVOKE_SUBAGENT/BROWSER_SUBAGENT). *Source: builtin guide refs; binary strings; webm_encoder.exe.*

### 1.11 Operational gotchas (session-receipted)
**[UNADJUDICATED, 0.9]** (1) `agy models` hangs indefinitely with an open stdin pipe — run with
stdin closed (`</dev/null`), returns ~5s; one detached agy.exe (PID 28008) survived TaskStop.
(2) `agy changelog` prints only "1.0.0: Initial release" despite v1.0.16 — useless as version
history. (3) `https://antigravity.google/docs/*` is JS-rendered, empty to plain fetchers — the
builtin skills embedded in the binary are the best offline docs. (4) GitHub
google-antigravity/antigravity-cli is an installer shell, not source.
*Source: background task receipts; agy changelog output; WebFetch attempts.*

---

## 2. Model surface, exact invocation strings, quota mechanics

### 2.1 The model list (v1.0.16, 2026-07-07)
**[VERIFIED, 0.98]** `agy models` prints exactly 8 entries, display labels only, no slugs:
```
Gemini 3.5 Flash (Medium)
Gemini 3.5 Flash (High)
Gemini 3.5 Flash (Low)
Gemini 3.1 Pro (Low)
Gemini 3.1 Pro (High)
Claude Sonnet 4.6 (Thinking)
Claude Opus 4.6 (Thinking)
GPT-OSS 120B (Medium)
```
*Source: `timeout 45 agy.exe models </dev/null` (2026-07-07); `agy --version` = 1.0.16. Reproduced byte-exact at verification (cat -A | nl).*

**[UNADJUDICATED, 0.85]** The valid set is fetched server-side per session
(`POST .../v1internal:fetchAvailableModels`), so accepted strings can change without a CLI
update; the binary embeds no label table. *Source: `cli-20260707_145205.log:106-109`; binary grep.*

### 2.2 Exact invocation strings
**[VERIFIED, 0.97]** `--model` accepts the EXACT display labels — the label string IS the CLI
id. Effort tier is selected by picking the label variant with the parenthesized tier
(Low/Medium/High/Thinking); **there is no separate effort flag**. Canonical correct form:

```
agy --model "Gemini 3.5 Flash (High)" --print-timeout 15s -p "<prompt>"
```

*Source: `cli-20260707_152909.log:97-98` (Resolving → Propagating label verbatim, then 4 successful streamGenerateContent calls); Codelabs quote 'You can use any of these model names...' with example `agy --model "Gemini 3.5 Flash (Low)"`.*

**[VERIFIED, 0.9 — FLAG-PARSING TRAP]** `--print`/`-p` is a STRING flag whose value is the
prompt. `agy --print --print-timeout 15s --model X "prompt"` consumes the literal string
`--print-timeout` as the prompt (receipt: promptLength=15, model=""), and Go flag parsing stops
at the next positional token (`15s`), so `--model` and everything after is DROPPED and the
default model runs. Prompt must be the `-p` value or come after all flags.
*Source: `cli-20260707_152706.log:63` vs `cli-20260707_152909.log:51`; agy --help confirms -p is value-taking; corroborated by identical promptLength=15/model="" signatures in `cli-20260623_002024.log:41`, `cli-20260623_014506.log:42`, and promptLength=15 WITH model set in `cli-20260623_150802.log:41`. Caveat: logs don't record argv; mechanism inferred from tight fit + Go flag semantics.*

**[VERIFIED, 0.95 — CRITICAL SILENT-FALLBACK GOTCHA]** An unrecognized `--model` value does NOT
error and does NOT abort. The CLI logs
`Failed to resolve model flag <X>: model <X> is not recognized as a known model or custom model in settings`
(severity W) and SILENTLY falls back to the settings.json default model (currently
`"Gemini 3.5 Flash (Medium)"`, settings.json:5). Verified live with `claude-opus-4-6` and
`gpt-oss-120b`. **Any dispatcher must verify the
`Propagating selected model override to backend: label="..."` line in the newest
`~/.gemini/antigravity-cli/log/cli-*.log`, never trust the flag.**
*Source: `cli-20260707_152926.log:92-93`; `cli-20260707_152935.log:106-107`; settings.json:5.*

**[VERIFIED, 0.9 — corrected count]** Slug-style ids are UNRELIABLE: `claude-sonnet-4-6` DID
resolve (→ "Claude Sonnet 4.6 (Thinking)", 865 resolve lines / 0 failures corpus-wide), but
`claude-opus-4-6`, `gpt-oss-120b`, `gemini-3.5-flash` (165/165 failures), and `claude-opus-4-5`
(verification correction: 185 failures in the cited files, 395 corpus-wide, 0 successes — not
"26x") all FAIL and silently fall back. **Only slug with a positive receipt:
`claude-sonnet-4-6`. Use display labels; treat every other slug as invalid until receipted.**
*Source: `cli-20260623_150802.log`; `cli-20260707_145205.log:107-109`; `cli-20260623_17*.log`; exhaustive slug census at verification.*

### 2.3 Scripting mechanics
**[UNADJUDICATED, 0.85]** (a) `agy models` needs stdin closed or it hangs; (b) `--print` often
exits 0 with EMPTY stdout even when the model ran (planner-loop swallow, 'PlannerResponse
without ModifiedResponse') — judge by deeds/log lines, not stdout; (c) per-invocation logs land
at `~/.gemini/antigravity-cli/log/cli-YYYYMMDD_HHMMSS.log` and are THE reliable receipt channel.
*Source: this session's hang + kill receipts; `AGY-CLI-AUTH-2026-06-23.md` print-swallow investigation.*

### 2.4 Quota mechanics
**[VERIFIED, 0.95 — exact error shape]** Quota exhaustion:
`RESOURCE_EXHAUSTED (code 429): Individual quota reached. Please upgrade your subscription to increase your limits. Resets in <duration>.`
Auto-retry backoff 1s then ~1.2-1.8s growing, wrapped as
`Encountered retryable api error... (The model API is currently overloaded and may experience intermittent errors.)`;
terminal failure: `agent executor error: model unreachable: RESOURCE_EXHAUSTED (code 429)`.
1,133 occurrences across 194 log files.
*Source: `cli-20260623_17*.log`/`18*.log`, e.g. `cli-20260623_172659.log:117,121`.*

**[UNADJUDICATED, 0.75 — REFUTES the standing memory]** The "4-hour rolling window" premise
(present in the `agy-antigravity-laptop` memory AND in agy_dispatch.mjs's header comment,
lines 12-14) is UNSUPPORTED — no source anywhere says 4 hours. Google's own plans doc says
quota "refreshed every five hours" (via WebSearch quote; page SPA-blocked). Local receipts show
reset countdowns of 1h12m-3h46m PLUS concurrent 53h47m and 99h51m countdowns on the same day
(2026-06-23) — longer weekly-class pools exist. **The memory line "shared 4-hour rolling window
across providers" should be treated as wrong.**
*Source: antigravity.google/docs/plans (via WebSearch); `cli-20260623_*.log` reset receipts.*

**[UNVERIFIED, 0.5-0.6]** Community-reported structure (consistent with the 53h/99h receipts
but unit numbers unconfirmed): ~March 2026 change → Flash-class keeps ~5-hour cycle; Gemini Pro
and Claude models moved to weekly refresh pools; pools are per model family, not shared
(forum: "Depleted use of the Claude Models" while others still work). Exhausting a weekly pool
locks that family out until weekly reset.
*Source: sabaoon.dev blog; sanj.dev (403 direct); discuss.ai.google.dev thread.*

**[UNADJUDICATED, 0.6]** No published RPM/TPM numbers; only throttle ever observed locally is
the 429 above. CLI runs a quotaRefreshLoop (quota_manager.go:72); binary carries a G1-credits
accounting layer. *Source: logs; binary strings; antigravity.google/llms.txt.*

**[UNVERIFIED, 0.3]** Context windows: NO authoritative numbers obtainable. Community claims
conflict (and 400K for GPT-OSS 120B is implausible vs its 131K native spec). Priors only: ~1M
Gemini family, ~200K Claude — all unverified for Antigravity's server-side caps.

**[UNVERIFIED, 0.5]** Model-identity fidelity: community reports Claude-labeled models
self-identifying inconsistently; Anthropic routing is via Vertex (`req_vrtx_*` trace ids in
local logs). Fine for executor seats (deed = disk); caveat for judgment/governance seats.

### 2.5 Custom/local backends
**[UNADJUDICATED, 0.8]** NOT supported in the documented surface: fixed server-curated model
list, no base-URL env override, all traffic to daily-cloudcode-pa.googleapis.com;
ollama/ollama#16329 open with no maintainer response; agentpedia explicitly retracted an
earlier claim ("does not support custom models, local endpoints, or BYOK").
**[UNADJUDICATED, 0.7]** HOWEVER an UNDOCUMENTED `customModels` mechanism exists in the binary:
`customModels[%s]: modelName is required`, settings key `customModelsConfig`
(map[string]CustomModelConfig with a `context_window` field), a printmode customModelsSetter,
and the live resolver error "...not recognized as a known model **or custom model in
settings**". Whether an entry can point at an Ollama/OpenAI-compatible endpoint is UNTESTED
(see §6). Legacy Codeium BYOK protos in the binary are Windsurf cruft, not evidence.
**[UNVERIFIED — treat as content-farm hallucination, 0.6]** Web guides claiming Ollama/LM
Studio work today via an `llm_providers` block in "antigravity.config.json" match nothing in
the real settings.json or binary; agentpedia published a correction retracting the same claim.
*Sources: github.com/ollama/ollama/issues/16329; agentpedia.codes; antigravitylab.net (bogus); rg -a agy.exe; `cli-20260707_152926.log`.*

---

## 3. Ollama Cloud API integration spec

> **GOVERNANCE BANNER [VERIFIED, 0.97]:** the standing operator ruling of 2026-07-02 is
> **"NO Ollama Cloud models — LOCAL Ollama + Claude tier only"**, and the provider was
> structurally removed 2026-07-03 (`seat_dispatch.mjs:48-55`: no seating mode, config drift,
> or env flip can dispatch to ollama.com; last real cloud dispatch 2026-07-02T13:37Z,
> 429-refused). **This section documents the API surface only. Re-enabling any cloud seat
> requires the operator's word recorded in operator-rulings.md.**
> *Source: `~/.claude/rules/operator-rulings.md`; `seat_dispatch.mjs:48-55`.*

### 3.1 Endpoint, auth, request shape
**[VERIFIED, 0.97]** Direct host `https://ollama.com`, native endpoints `/api/chat` and
`/api/tags`, auth `Authorization: Bearer $OLLAMA_API_KEY` (keys at ollama.com/settings/keys).
Verbatim docs curl:
```
curl https://ollama.com/api/chat -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -d '{"model": "gpt-oss:120b", "messages": [{"role":"user","content":"Why is the sky blue?"}], "stream": false}'
```
(Verification note: `/api/tags` answered HTTP 200 without auth on 2026-07-07 — Bearer is
demonstrated for chat generation.)
*Source: docs.ollama.com/cloud (fetched 2026-07-07, raw markdown saved at verification).*

**[VERIFIED, 0.9]** `/api/chat` streams by default (`stream` default true; set false for one
complete response); accepts `tools` (JSON-Schema function tools), `think` (boolean or
high/medium/low/max), and an `options` object with exactly: num_ctx, num_predict, temperature,
top_k, top_p, min_p, seed, stop. *Source: docs.ollama.com/cloud + /api/chat schema.*

**[VERIFIED, 0.95]** Tag convention: direct ollama.com calls use BARE tags (`gpt-oss:120b`);
cloud models proxied through local Ollama use `-cloud`/`:cloud` suffixed tags
(`gpt-oss:120b-cloud`, `glm-5.2:cloud`); library pages list the `:cloud` variant as the pull
tag for cloud-only models. Our existing heal already matches: `seat_dispatch.mjs:511` strips
both suffixes on HTTP_404. (Caveat: bare-tag form for glm-5.2 is inferred from convention; the
docs' explicit bare example is gpt-oss:120b only.)
*Source: docs.ollama.com/cloud; ollama.com/library/glm-5.2; seat_dispatch.mjs:510-511.*

### 3.2 /v1 OpenAI-compat: historical fact, current hypothesis, and the options trap
**[VERIFIED, 0.95]** `https://ollama.com/v1` WORKED in our cloud era (EXECUTED-historical):
1,612 `attempt-ok provider=ollama-cloud` lines in dispatch-heartbeat.log (last success
2026-07-01T05:14Z) from OpenAI-shape POSTs ({model, messages, tools, tool_choice}, Bearer auth,
parsing choices[0].message + usage). Current docs document /v1 ONLY at
`http://localhost:11434/v1/` — **current ollama.com/v1 availability is HYPOTHESIS**
(undocumented; unverifiable without an authenticated call, which is forbidden).
*Source: seat_dispatch.mjs:48-55,605-628; dispatch-heartbeat.log; docs.ollama.com/api/openai-compatibility.*

**[VERIFIED, 0.95]** Per-model options via /v1 are a trap: the compat endpoint cannot set
context size (docs verbatim: "The OpenAI API does not have a way of setting the context size
for a model") and lacks tool_choice, logit_bias, n, image URLs, logprobs. Live-receipted
locally: the compat shim SILENTLY IGNORES an `options` field
(`ollama_vision_verdict.mjs:45-52`; mechanism triple-confirmed at verification incl. Ollama
source `openai/openai.go` — struct has no options field, Go JSON drops unknown keys).
**Engine consequence: num_ctx control requires native `/api/chat`, whose response shape
differs: `message.content`, not `choices[0].message.content`.** (Caveat: num_ctx honored on
cloud /api/chat is extrapolation, not directly receipted.)
*Source: ollama_vision_verdict.mjs:45-52; docs.ollama.com/api/openai-compatibility.*

### 3.3 Plans, limits, error walls
**[VERIFIED, 0.95]** Usage metered by GPU time ("depends on model size and request duration");
model levels 1 (gpt-oss:20b) to 4 (deepseek-v4-pro). Tiers: Free = 1 concurrent / "Light
usage"; Pro = 3 concurrent / 50x Free; Max = 10 concurrent / 5x Pro. Docs (verification
fetch): "Each plan has session limits that reset every 5 hours and weekly limits that reset
every 7 days" — matching both observed wall classes on account markabass:
- session: `429: {"error":"you (markabass) have reached your session usage limit, upgrade for higher limits"}` (2026-06-10T13:41:06, heartbeat log line 37)
- weekly: `"you (markabass) have reached your weekly usage limit"` (2026-06-12T08:16:05, line 4845; the audited episode was 92 repeats/31h per seat_dispatch.mjs:494-498 comment — raw log total is 1,760 weekly-limit lines)
Current plan tier: NOT discoverable without an authenticated call — June walls suggest low/free
tier at that time (**HYPOTHESIS**).
*Source: ollama.com/cloud pricing (fetched at verification); dispatch-heartbeat.log; seat_dispatch.mjs:494-499.*

### 3.4 Cloud model catalog (2026-07-07) — all [UNADJUDICATED] with WebFetch-summarizer caveat
Researcher's own caveat [0.9]: library numbers passed through WebFetch's summarizer; re-check
any single load-bearing number against the raw page before seating decisions. SearXNG was
degraded/blind for this topic (byte-identical generic results for 4 distinct queries).

| Model | Variant(s) | Params | Context | Capabilities | Notes | Conf |
|---|---|---|---|---|---|---|
| kimi-k2.7-code | :cloud only | 1.04T | 256K | vision+tools+thinking | local tag of same name was a lying alias of a 30.5B Cohere-North blob (deconstructor.mjs:476) | 0.9 |
| qwen3-coder | :30b, :480b, :480b-cloud | — | 256K native | tools only | **:480b and qwen3-coder-next RETIRE 2026-07-15** → qwen3.5:397b; :30b not retiring | 0.9 |
| glm-5.2 | :cloud only | 756B | 976K | tools+thinking (High/Max effort) | glm-5 and glm-4.7 retire 2026-07-15 → glm-5.2 | 0.9 |
| deepseek-v4-pro | :cloud only | 1.6T/49B MoE | 1M | tools+thinking (3 modes) | deepseek-v4-flash is the docs' replacement for retiring v3.1/v3.2/cogito-2.1 | 0.9 |
| minimax-m3 | :cloud only | n/p | 512K-1M | vision+tools+thinking | minimax-m2.1 and gemini-3-flash-preview retire 2026-07-15 → minimax-m3 | 0.88 |
| gpt-oss | :20b, :120b, both -cloud | — | 128K | tools+thinking | not retiring; the docs' own curl example model | 0.92 |
| kimi-k2.5 | :cloud only | 1.04T | 256K | vision+tools+thinking | not retiring as of 2026-07-07; kimi-k2/k2-thinking already retired → k2.6 | 0.9 |

**[UNADJUDICATED, 0.8]** Full catalog (20 entries): glm-5.2, kimi-k2.7-code, gemma4
(12b/26b/31b), qwen3.5 (0.8b-122b shown), glm-5.1, minimax-m2.7, nemotron-3-super, glm-5,
minimax-m2.5, minimax-m3, kimi-k2.6, deepseek-v4-flash, deepseek-v4-pro, kimi-k2.5,
nemotron-3-ultra, gpt-oss, qwen3-coder, glm-4.7, gemini-3-flash-preview, minimax-m2.1.
**UNRESOLVED:** deprecation table recommends `qwen3.5:397b` but search page showed qwen3.5 only
up to 122b — verify the tag exists before seating.
*Source: ollama.com/search?c=cloud; docs.ollama.com/cloud deprecation table; ollama.com/library/* pages.*

### 3.5 What already transfers from our engine
**[UNADJUDICATED, 0.95]** Cloud-era heal classes in `seat_dispatch.mjs` healDispatch
(:491-526), built against real ollama.com error bodies: HTTP_429 weekly-limit →
circuit-break; other 429 → quadratic backoff 800ms*(n+1)^2; HTTP_503/'maximum pending' →
5000ms*(n+1)^2; HTTP_400/context → halve num_ctx (floor 8192); HTTP_404/'unknown model' →
strip :cloud/-cloud; TIMEOUT → one extend then fail over; EMPTY_CONTENT_THINKING → think:false
+ doubled max_tokens. Env keys already recognized: `OLLAMA_API_KEY` (primary, matches docs) and
`OLLAMA_CLOUD_API_KEY` (secondary) — `visual_witness.mjs:152-156` fails closed;
`doctor.mjs:21`.

---

## 4. The provider-row contract + what agy_dispatch still needs

All lens-4 claims below are **[UNADJUDICATED — the adversarial-verification array for this lens
was lost to input truncation]**, but the agy-lane claims were spot-confirmed this session by
direct reads of `agy_dispatch.mjs` (full) and `seat_dispatch.mjs:300-379` + route file.

### 4.1 The contract an agy provider row must satisfy
1. **Waterfall shape [0.97]:** there is NO PROVIDERS array anymore (removed 2026-07-03 with
   the NO-CLOUD ruling; only `LOCAL_PROVIDER = {id:'ollama-local', url:'http://nxtbeast:11434/v1/chat/completions', envKeys:[]}` survives). The "waterfall" is hardcoded lanes inside
   `dispatchWithWaterfall(baseBody, {cwd, localOnly, role})`: (a) localOnly branch, (b) agy
   lane when `routePrefersAgy()`, (c) named-Claude lane, (d) preferred-Claude route-window
   lane, (e) local lane with MAX_HEALS=3, (f) Claude tier via `claudeFallbackFor()`. **A new
   provider row = a new lane block in this function, not a registry entry.**
   *Source: seat_dispatch.mjs:48-56,694-953.*
2. **Return shape [0.96]:** a lane attempt resolves with
   `{ content: NON-EMPTY string, toolTrace: [], usage?: {prompt, completion} }`; the waterfall
   wraps `{...out, provider:'<lane-id>', heals:n}` (agy lane: `agy-${agyModel}` at :853).
   **Empty content MUST throw, never resolve** — "EMPTY CONTENT IS AN ERROR, NEVER A RESULT"
   (P0-CORPUS law, :672-682; attemptClaude enforces at :469-472).
   *Source: seat_dispatch.mjs:672-684,804,853,878,905,924,946,1014-1026.*
3. **Error contract [0.95]:** throw `WaterfallError(kind, provider, model, msg)` (:57-59).
   Kinds with distinct heals: TIMEOUT (:512-521), HTTP_429 (weekly-limit = lane give-up,
   :498-499), HTTP_503 (:504-505), HTTP_400/context (:506-509), HTTP_404 (:510-511),
   EMPTY_CONTENT/_THINKING (:522-523), other 4xx → null (:524), NETWORK/5xx (:525), plus
   SEARCH_BLIND/SEARCH_FAILED/TOOL_LOOP_CAP. **Only the local lane runs the heal loop
   (:917-936)** — named-claude gets ONE hang-retry (:872-895); **agy gets zero heals** and
   falls through the waterfall on any failure (:854-857).
   *Source: seat_dispatch.mjs:57-59,491-526,845-858,872-895,917-936.*
4. **Heartbeat contract [0.95]:** every lane MUST write
   `attempt-start/attempt-ok/attempt-fail provider=... ` lines to
   `missions/_logs/dispatch-heartbeat.log` (env MUEZZIN_HB_FILE read per call, :33) — the
   daemon's STUCK-TASK suppress/kill decision reads this log. The agy lane's heartbeats live
   in the CALLER (:848,:852,:855), not in agy_dispatch.mjs, **so an up-to-8-minute agy call
   emits nothing between attempt-start and attempt-ok/fail.**
   *Source: seat_dispatch.mjs:20-35,799-806,848-855,873-891,1011.*
5. **Timeout/tree-kill [0.9]:** TOTAL_BUDGET_MS = 12min for the whole waterfall (:693); lanes
   skipped when remaining() < 30s. CLAUDE_TIMEOUT_MS = AGY_TIMEOUT_MS = 8min (:309-310); local
   FETCH_TIMEOUT_MS = 300s per tool-round. **Windows subprocess kill must fell the whole tree:**
   attemptClaude uses `taskkill /pid <pid> /T /F` (:476-479); agy_dispatch uses
   `child.kill('SIGKILL')` (:119) which kills only the direct child — grandchildren survive
   (and one orphan agy.exe from this research session is receipted proof).
   *Source: seat_dispatch.mjs:309-310,476-479,693-697; agy_dispatch.mjs:119,144-147.*
6. **dispatchSeat envelope [0.97]:** builds body {model, messages:[system(faith+RESTRAINT+
   anchor+contract), user(framing)], max_tokens clamped 1024-65536, think:false, sampling}
   (:984-997); ANY throw becomes a BLOCK contract `{verdict:'BLOCK', _failed:true, _error,
   provider:'dispatch-failed'}` — "absence is not APPROVE" (:1005-1013); wantVerdict:true
   extracts+validates the JSON verdict and attaches witness receipts (:1016-1026).
   *Source: seat_dispatch.mjs:963-1027.*

### 4.2 What agy_dispatch.mjs already gives [0.95, spot-confirmed this session]
(a) CLI invocation `--model <m> --print --print-timeout 5m --dangerously-skip-permissions
[--add-dir <cwd>]` with prompt via stdin (ENAMETOOLONG fix) (:100-113,:135-139) — **but see
§4.4 finding S1: this arg vector is likely broken by the flag-parsing trap**; (b) structured
return `{ok, exitCode, stdout, stderr, elapsedMs, model, provider:'agy', error?:{kind,detail}}`
with kinds AGY_BINARY_MISSING/SPAWN_ERROR/TIMEOUT/NONZERO_EXIT (:71-83,:85-166); (c)
`agyAvailable()` probe (:60-63); (d) `SEAT_TO_AGY_MODEL` + `resolveAgyModel` (:48-67); (e)
`sentinelProbe` quota-tap detector (:173-182); (f) the dynamic-import selftest-guard crash fix
(:199). Already wired into seat_dispatch: import (:17), attemptAgy adapter (:349-366),
routePrefersAgy gate (:334-347), agy-first lane (:845-858), AGY_TIMEOUT_MS (:310),
AGY_EXECUTOR_SEATS restriction (:325-333).

**Stale header [0.95, confirmed this session]:** agy_dispatch.mjs:3-6 says "Not yet wired into
seat_dispatch.mjs's PROVIDERS waterfall" — **the wiring EXISTS** (seat_dispatch.mjs:845-858),
merely dormant: armed only by `USE_AGY_EXECUTOR=true`, route file `{prefer:'agy', until:<ISO>}`,
or automatically for gemini-named models when agy.exe exists (:336-337). Current route file is
`{"mode":"claude-local-hybrid"}` (re-read this session) — agy lane dormant today. A fork design
reading the header would double-build the lane. **Also stale:** header lines 12-14 assert the
"shared 4-hour rolling window" quota model that §2.4 refutes.

### 4.3 What agy_dispatch is MISSING vs the contract [original findings; item 6 completed from substrate]
1. **EMPTY-CONTENT violation:** attemptAgy substitutes placeholder text
   `'(empty stdout — agy planner-mode; verify via execReceipt)'` instead of throwing
   EMPTY_CONTENT (seat_dispatch.mjs:362-365) — acceptable for executor seats (deed = disk) but
   poisons wantVerdict:true seats. Compensating control AGY_EXECUTOR_SEATS — EXCEPT gemini
   names bypass Gate 1 (:336-337), and gemini-heavy mode seats gemini-3-flash-preview as
   validator/auditor/final_auditor (seat_modes.mjs:118-129): a swallowed-stdout gemini verdict
   seat returns the placeholder, extractJson fails, seat BLOCKs (fail-closed but burns the
   attempt).
2. **No tree-kill** (SIGKILL only, agy_dispatch.mjs:119) — needs `taskkill /pid <pid> /T /F`
   parity with attemptClaude (:476-479).
3. **No heal-class mapping** — no AGY_* branch in healDispatch; lane heal = fall-through only.
4. **No usage/token accounting** in the return — heartbeat token instrumentation blind on the
   agy lane.
5. **sentinelProbe wired NOWHERE** — only agy_dispatch's own selftest calls it (:207); the
   "skip agy lane on quota-tap" design in its comment (:169-172) is unimplemented.
6. **[completed from substrate read this session]** `SEAT_TO_AGY_MODEL` (agy_dispatch.mjs:48-58)
   has no `claude-sonnet-5` key, so `resolveAgyModel('claude-sonnet-5')` silently falls back to
   DEFAULT_MODEL `'claude-sonnet-4-6'` (:41,:65-67) — a silent model downgrade if a
   sonnet-5-class seat is ever routed through agy. *(Original claim truncated at this point;
   any further items the researcher listed are lost.)*

### 4.4 [SYNTH] New synthesis findings (cross-lens, receipted this session)
- **S1 (HYPOTHESIS, 0.85 — needs one live probe):** agy_dispatch.mjs's own arg vector
  `['--model', m, '--print', '--print-timeout', pt, '--dangerously-skip-permissions', ...]`
  (:105-110) almost certainly triggers the verified flag-parsing trap (§2.2): `--print` is a
  value-taking flag, so it consumes the literal `--print-timeout` as the PROMPT (15 chars),
  `'5m'` becomes a positional that stops Go flag parsing, and
  `--dangerously-skip-permissions` + `--add-dir` are DROPPED; the stdin prompt is then likely
  ignored. Receipt fit: `cli-20260623_150802.log:41` shows `promptLength=15` WITH model set —
  the exact log from agy_dispatch's "verified invocation" window (2026-06-23T15:08Z, header
  :22). This would also explain the "planner-loop swallow" short outputs (chars=57 failures,
  seat_dispatch.mjs:318-323): the model was answering the prompt "--print-timeout". The lane
  has never demonstrably carried a real mission prompt. **Grade: EXECUTED receipts for the trap
  mechanism; HYPOTHESIS for the causal link to agy_dispatch's arg order (logs lack argv).**
- **S2 (0.9, from verified slug census x code read):** `SEAT_TO_AGY_MODEL` values
  `'claude-opus-4-5'` (:53) and `'gemini-3.5-flash'` (:54) are slugs RECEIPTED AS FAILING to
  resolve (185x and 165x failures, §2.2) — those seats would silently run the settings.json
  default (Gemini 3.5 Flash (Medium)) while the engine reports `provider=agy-claude-opus-4-5`.
  `'gemini'`/`'gemini-3-ultra'` (:55-57) are unprobed slugs, and `gemini-3-ultra`/`gemini` do
  not appear in the current 8-label list at all. Only `'claude-sonnet-4-6'` has a positive
  resolve receipt. **The whole map must be rewritten to display labels and re-receipted, and
  the dispatcher must parse the `Propagating ... label=` line from the newest cli-*.log as a
  post-dispatch check.**

---

## 5. Ranked pitfalls with mitigations

1. **Silent model fallback (VERIFIED).** Unrecognized `--model` → warning in log + default
   model runs; no error, no abort. Compounded by S2: two of agy_dispatch's mapped slugs are
   receipted failures. *Mitigation:* use exact display labels only; rewrite SEAT_TO_AGY_MODEL;
   after every dispatch, grep the newest `~/.gemini/antigravity-cli/log/cli-*.log` for
   `Propagating selected model override to backend: label="<expected>"` and treat mismatch as
   dispatch failure (WaterfallError kind e.g. AGY_MODEL_FALLBACK).
2. **Flag-parsing trap breaking the existing lane (VERIFIED mechanism; S1 HYPOTHESIS for the
   lane).** `--print` eats the next token as the prompt; flags after the first positional are
   dropped (including `--dangerously-skip-permissions`). *Mitigation:* fix agy_dispatch's argv
   (prompt as `-p` value or all flags before it); run ONE receipted probe verifying
   `promptLength` matches the real prompt and the skip-permissions flag took effect; only then
   trust the lane. Long prompts still need the stdin path — verifying stdin-prompt behavior is
   experiment E1 (§6).
3. **Empty-stdout placeholder poisoning verdict seats (UNADJUDICATED).** attemptAgy returns
   placeholder text instead of throwing EMPTY_CONTENT; gemini names bypass the executor-only
   gate. *Mitigation:* throw EMPTY_CONTENT for wantVerdict seats (or pass a wantVerdict hint
   into attemptAgy); close the gemini bypass of Gate 1; keep executor seats on
   deed-verification via execReceipt.
4. **Quota model misunderstood (memory + code header REFUTED).** The "shared 4-hour rolling
   window" in agy_dispatch.mjs:12-14 and the laptop memory is wrong; reality is ~5h session
   pools + weekly-class pools, likely per model family. *Mitigation:* correct the header and
   the `agy-antigravity-laptop` memory; parse `Resets in <duration>` from 429 logs to
   distinguish session vs weekly walls; on weekly-class walls, circuit-break the lane for that
   model family (mirror seat_dispatch.mjs:498-499).
5. **No tree-kill on Windows (UNADJUDICATED + live orphan receipt).** SIGKILL leaves
   grandchildren (language server) running; one orphan agy.exe (PID 28008) survived this
   research session. *Mitigation:* `taskkill /pid <pid> /T /F` parity with attemptClaude
   (seat_dispatch.mjs:476-479).
6. **Rules reachability outside the home workspace (UNADJUDICATED, 0.75).** `~/.agents/`
   governance loads only because `C:\Users\marka` is the trusted workspace; running agy with
   CWD in another repo may never reach it. *Mitigation:* keep governance in the documented
   global root — the `~/.gemini/config/plugins/muezzin/` plugin (rules + hooks + skills)
   already exists and is validated; treat `~/.agents/` as bonus, not the carrier.
7. **Heartbeat silence during 8-minute agy calls (UNADJUDICATED).** Nothing written between
   attempt-start and attempt-ok/fail; the daemon's STUCK-TASK logic may kill a healthy lane.
   *Mitigation:* emit periodic `attempt-progress` hb lines from a timer inside attemptAgy, or
   tail the cli-*.log for liveness.
8. **stdin-pipe hang class (UNADJUDICATED, receipted).** `agy models` (and possibly other
   subcommands) hang forever with an open stdin pipe. *Mitigation:* always close/redirect
   stdin for non-prompt subcommands; keep hard timeouts + tree-kill on every agy spawn.
9. **Verdict-seat identity fidelity (UNVERIFIED, 0.5).** Antigravity's Claude labels route via
   Vertex and may not be behavior-identical to direct-API Claude. *Mitigation:* per the seat
   plan's existing carve-out, agy carries executor-class seats only; judgment/governance seats
   stay on direct channels.
10. **Ollama Cloud section is governance-locked (VERIFIED, 0.97).** NO-CLOUD ruling 2026-07-02
    stands; provider structurally removed. Additional technical trap if ever re-authorized:
    /v1 silently ignores `options` (no num_ctx) — integrate against native /api/chat with its
    different response shape; and 5 catalog models retire 2026-07-15. *Mitigation:* any
    re-integration starts with an operator ruling recorded in operator-rulings.md, uses
    /api/chat, and seats nothing from the deprecation table.

---

## 6. Open unknowns needing live experiments

- **E1 — Correct print-mode invocation with a long prompt (unblocks the lane; cheapest, do
  first).** Does `-p "<prompt>"` work with prompt >32K argv cap? Does stdin-prompt mode
  actually exist when no `-p` value is given, and what argv shape triggers it? Receipt: newest
  cli-*.log `promptLength=<expected>` + `Propagating ... label=` + flags honored. This
  adjudicates S1.
- **E2 — Do hooks (PreToolUse/Stop) fire in `--print` mode?** The muezzin plugin's governance
  surface is only real for daemon use if hooks run non-interactively. Receipt:
  muezzin_hook.py side-effects during a -p run.
- **E3 — `customModelsConfig` schema probe.** Add a customModels entry to a COPY of
  settings.json pointing at local Ollama (nxtbeast:11434) and see whether the resolver accepts
  it ("...or custom model in settings" implies it participates in resolution). This is the only
  plausible local-model path; everything documented says cloud-only. NOTE: compliant with the
  NO-CLOUD ruling (it targets LOCAL Ollama), but edits agy config — receipt the before/after.
- **E4 — Label-form probes for the 6 unprobed models** (Gemini 3.1 Pro Low/High, Claude Opus
  4.6 (Thinking), GPT-OSS 120B (Medium), Flash Low/Medium) and the fate of the `'gemini'` /
  `'gemini-3-ultra'` map entries (absent from the current 8-label list). One -p probe each,
  judged by the Propagating line.
- **E5 — Quota pool structure.** Instrument 429s: correlate `Resets in` durations with model
  family across days to confirm/deny the 5h-session + per-family-weekly hypothesis; determine
  current plan tier (identity-bound: may need the operator's account page).
- **E6 — Server-side context caps per model** (no authoritative numbers exist; §2.4). Probe
  with graduated prompt sizes, watch for truncation CHECKPOINT injection or 400-class errors.
- **E7 — Tree-kill parity test.** Spawn agy, taskkill /T /F, verify no surviving language-server
  children (Get-Process agy). Also sweep the existing orphan PID 28008.
- **E8 — sentinelProbe wiring decision.** Wire it as the agy-lane gate (skip lane on false) or
  delete it; currently dead code outside its selftest.
- **E9 — Ollama Cloud /v1 current availability** (HYPOTHESIS, §3.2) — requires an
  authenticated call, which requires the operator's word first (NO-CLOUD ruling). Park until
  ruled.
- **E10 — `qwen3.5:397b` tag existence** (catalog inconsistency, §3.4) — one unauthenticated
  GET of the library page. Only relevant if cloud is ever re-authorized.
- **E11 — Substrate corrections owed regardless of port decision:** fix agy_dispatch.mjs
  header (stale "not yet wired" + refuted 4-hour quota claim), fix SEAT_TO_AGY_MODEL, correct
  the `agy-antigravity-laptop` memory's 4-hour-window line.
