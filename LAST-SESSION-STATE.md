# LAST-SESSION-STATE.md

Written by: pre-compact.mjs hook at compaction event
Timestamp: 2026-05-19 20:42:40
Project CWD: C:\Windows\System32

## Governance constants (always true)

- Serial inference: ONE Ollama model at a time. api/ps check before every dispatch. ollama stop after.
- No frontier models: GPT/Gemini/Grok/GLM forbidden. Local quorum (gemma4:31b, qwen3.6:27b, granite4.1:30b, nemotron-super) is the governance witness.
- Authority chain: CLAUDE.md -> canon/ -> operator-context.md -> this file -> RAG

## Session state

(Not yet updated by instance - hook-written structural fallback only.)


## OPEN AT COMPACTION — last operator messages (hook-extracted)

[1] our timeouts are the length of their context window as per our substrate right


## Git state at compaction — governance repo (Codeberg+GitHub+Gitea)

branch: master
recent commits:
1db9f88 governance: session-end anchor 2026-05-19 20:05:42 +00:00
0d5eb5f governance: session-end anchor 2026-05-19 19:14:26 +00:00
725cdf6 governance: session-end anchor 2026-05-19 18:42:23 +00:00
44e3349 governance: session-end anchor 2026-05-19 18:23:45 +00:00
b2c77eb governance: session-end anchor 2026-05-19 17:45:45 +00:00
uncommitted:
(clean)
remotes:
codeberg	git@codeberg.org:nxtlvl/claude-governance.git (fetch)
codeberg	git@codeberg.org:nxtlvl/claude-governance.git (push)
forgejo	http://nxtlvl:Gitealvl1!@localhost:3002/nxtlvl/claude-governance.git (fetch)
forgejo	http://nxtlvl:Gitealvl1!@localhost:3002/nxtlvl/claude-governance.git (push)
github	git@github.com:nxtlvlyt/claude-governance.git (fetch)
github	git@github.com:nxtlvlyt/claude-governance.git (push)


## Schema v2 metadata
compaction_attempted: false
compaction_skipped_reason: ollama_busy
embedding_service_used: false
