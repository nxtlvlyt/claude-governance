Is the following proposed change to bootstrap-gate.mjs correct, complete, and governance-safe?

## Proposed Change

File: `~/.claude/hooks/bootstrap-gate.mjs` lines 44–47

Current REQUIRED array:
```javascript
const REQUIRED = [
  { suffix: '.claude/practice/core.md',   label: '~/.claude/practice/core.md' },
  { suffix: '.claude/CANON-MANIFEST.md',  label: '~/.claude/CANON-MANIFEST.md' },
];
```

Proposed:
```javascript
const REQUIRED = [
  { suffix: '.claude/practice/core.md',       label: '~/.claude/practice/core.md' },
  { suffix: '.claude/CANON-MANIFEST.md',      label: '~/.claude/CANON-MANIFEST.md' },
  { suffix: '.claude/operator-context.md',    label: '~/.claude/operator-context.md' },
];
```

## Problem Being Solved

operator-context.md is the cold instance brief — it contains:
- The 6-agent chain dispatch pattern (deliberate.py, not MCP calls)
- FM-1 through FM-10 failure modes
- Session start checklist (api/ps check, niyyah discipline, wudu before dispatch)
- The OPERATOR OVERRIDE prohibiting frontier models

Instances that skip reading it act from training knowledge. The chain confusion this session (treating a single MCP laguna call as "the chain") is the direct result of operator-context.md not being read at boot. The bootstrap gate currently allows instances to pass without reading it.

## Questions for the Chain

1. Is adding operator-context.md to the bootstrap gate REQUIRED array the correct structural fix, or is there a better location for this enforcement?
2. operator-context.md is 728 lines (~45KB). Does adding it to required reads create unacceptable boot overhead, or is this justified by the failure pattern?
3. Are there failure modes this change introduces? (deadlock if operator-context.md path changes, bootstrap-file passthrough logic needing update at lines 56–60)
4. Should the passthrough logic at lines 56–60 also be updated to allow operator-context.md reads through without blocking?
5. Is this sufficient, or does session-start.mjs also need to unconditionally load operator-context.md (currently conditional on LOAD_OPERATOR_CONTEXT=true)?

## Substrate Files

hooks/bootstrap-gate.mjs
hooks/session-start.mjs
operator-context.md

## Search Queries

- bootstrap gate session orientation required reads cold instance formation governance
- session start hook mandatory substrate reads enforcement pattern
- FM-1 prevention training knowledge override operator context required read
- Claude Code PreToolUse hook required file read enforcement gate
- session bootstrap gate deadlock prevention required file path resilience
