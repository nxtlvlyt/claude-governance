---
name: muezzin
description: Run a mission to verified completion through the muezzin orchestration — decompose into atomic steps, implement each with a cloud seat, witness each by a real execution receipt, commit or roll back and self-heal. State the mission as objective + intention (Maqsad + niyyah), never step-by-step mechanics.
---

# /muezzin — run a mission to witnessed completion

`$ARGUMENTS` is the **mission**, stated as **Maqsad (the objective) + niyyah (the intention)** — *not* step-by-step instructions. The chain holds the framework; it finds the *how* (the Mu'ādh-ibn-Jabal delegation principle: give the destination, trust the reasoning).

Run it as one command — it creates a fresh git sandbox, runs the mission, and prints the JSON result:

```bash
node "${CLAUDE_PLUGIN_ROOT}/orchestrate-cli.mjs" "<the mission, stated as Maqsad + niyyah>"
```
(Requires `OLLAMA_CLOUD_API_KEY` in the environment — the open-weight seats dispatch via Ollama Cloud. Pass an optional second arg to run inside an existing git working directory instead of a fresh sandbox.)

The pipeline, per atomic step: **deconstruct** (architect → atomic `micro_queue`) → **executor** writes the file → **integrity-guard** the edit (a green that tampered with the verifier is blocked) → **witness** by a real `execReceipt` the muezzin runs → **repair once** on failure → **commit** on pass, or **rollback + halt** on fail. It never advances past a failed step. The result reports each step's verdict, its commit sha, and whether it self-healed (`repaired`).

**The contract:** nothing is reported done unless a real execution receipt the muezzin produced *itself* proves it. Claims are not deeds — and that binds the conductor too.
