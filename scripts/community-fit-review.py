#!/usr/bin/env python3
"""
Community-fit architectural claim review chain runner.
Runs each P1-P6 community problem claim through the full 6-agent deliberation stack,
verifying whether the architectural claim in community-fit.md is accurate, overstated,
or missing nuance against the actual substrate.

Usage:
  python scripts/community-fit-review.py <problem> 1    -- phase 1 (gemma + qwen)
  python scripts/community-fit-review.py <problem> 2    -- phase 2 (laguna + granite + nemotron)
  default phase: 1

Between phase 1 and phase 2, Seat 3 (claude-sonnet-4-6) reads the phase 1 JSON outputs,
reads the community-fit.md claim and substrate files, and writes architect synthesis to:
  <TEMP>/community-fit-review/p-<N>/sonnet-synthesis.txt

SEAT 3 IS NOT AN AUTOMATED API CALL. Per operator-context.md Section 4.

Per canon 6agent-deliberation-stack.md:
  - check api/ps before every dispatch
  - serial inference only -- one model at a time
  - timeout=32768 non-negotiable
  - think:False top-level for qwen3.6 and nemotron-3-super
"""
import requests, json, urllib.request, urllib.parse, time, os, subprocess, sys, re, tempfile
sys.stdout.reconfigure(encoding='utf-8')

OLLAMA_HOST  = "http://localhost:11434"
SEARXNG_HOST = "http://localhost:8080"
CLAUDE_HOME  = os.path.join(os.path.expanduser("~"), ".claude")
COMMUNITY_FIT_PATH = os.path.join(CLAUDE_HOME, "practice", "community-fit.md")
RIJAL_PATH    = os.path.join(CLAUDE_HOME, "canon", "model-rijal.md")

PROBLEM_NUM = int(sys.argv[1]) if len(sys.argv) > 1 else 1
PHASE       = int(sys.argv[2]) if len(sys.argv) > 2 else 1

OUTPUT_DIR = os.path.join(tempfile.gettempdir(), f"community-fit-review", f"p-{PROBLEM_NUM}")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# -------------------------------------------------------------------
# Substrate files per problem -- what actually backs each claim
# -------------------------------------------------------------------
PROBLEM_FILES = {
    1: [  # Multi-agent delegation trust
        os.path.join(CLAUDE_HOME, "faiths", "executor.faith.md"),
        os.path.join(CLAUDE_HOME, "hooks", "subagent-start.ps1"),
    ],
    2: [  # Policy-as-guideline fragility
        os.path.join(CLAUDE_HOME, "hooks", "pre-tool-use-substrate.ps1"),
        os.path.join(CLAUDE_HOME, "hooks", "niyyah-gate.ps1"),
        os.path.join(CLAUDE_HOME, "hooks", "stop-validation.ps1"),
        os.path.join(CLAUDE_HOME, "hooks", "surrender-check.ps1"),
    ],
    3: [  # Enterprise rogue agents
        os.path.join(CLAUDE_HOME, "canon", "6agent-deliberation-stack.md"),
        os.path.join(CLAUDE_HOME, "scripts", "chain-review.py"),
    ],
    4: [  # No accountability loop
        os.path.join(CLAUDE_HOME, "hooks", "stop-validation.ps1"),
        os.path.join(CLAUDE_HOME, "hooks", "niyyah-gate.ps1"),
        os.path.join(CLAUDE_HOME, "canon", "6agent-deliberation-stack.md"),
    ],
    5: [  # Static policy / no compounding memory
        os.path.join(CLAUDE_HOME, "hooks", "pre-compact.ps1"),
        os.path.join(CLAUDE_HOME, "projects", "C--WINDOWS-system32", "memory", "failure_log.md"),
    ],
    6: [  # Auditability / cryptographic non-repudiation
        os.path.join(CLAUDE_HOME, "hooks", "git-anchor.ps1"),
        os.path.join(CLAUDE_HOME, "hooks", "session-hash-chain.ps1"),
    ],
}

# Problem labels for display
PROBLEM_LABELS = {
    1: "P1 — Multi-agent delegation trust (SAGA, NDSS 2026)",
    2: "P2 — Policy-as-guideline fragility (Aegis, arXiv:2603.16938)",
    3: "P3 — Enterprise rogue agents / multi-tenant authorization",
    4: "P4 — No accountability loop / human escalation paths",
    5: "P5 — Static policy / no compounding memory from failures",
    6: "P6 — Auditability and cryptographic non-repudiation",
}

# -------------------------------------------------------------------
# Per-problem, per-role SearxNG queries
# -------------------------------------------------------------------
SEARCH_QUERIES = {
    1: {
        "workshop":         "SAGA multi-agent authorization delegation chain security NDSS 2026 AI agent trust",
        "deep-dive":        "AI agent delegation authorization chain subagent spawning Claude Code architecture prevention",
        "code-review":      "Claude Code subagent faith file executor spawning prevention authorization governance hook",
        "governance-audit": "wakala Islamic agency delegation limits re-delegation authorization chain AI governance",
        "synthesis":        "multi-agent delegation trust architectural prevention formation constraint 2026",
    },
    2: {
        "workshop":         "Aegis AI governance advisory fragility enforcement blocking hooks formation policy speed",
        "deep-dive":        "AI governance hooks blocking enforcement vs advisory guidelines bypass surface Bash PowerShell",
        "code-review":      "PowerShell PreToolUse hook substrate gate Bash bypass surface OS ACL process isolation",
        "governance-audit": "Islamic formation governance legalism structural prevention AI policy enforcement substrate",
        "synthesis":        "AI governance blocking enforcement formation advisory gap Bash bypass OS controls 2026",
    },
    3: {
        "workshop":         "Microsoft AGT CNCF enterprise rogue agents governance multi-tenant AI production failures",
        "deep-dive":        "multi-agent deliberation chain rogue detection congregation principle correction before action",
        "code-review":      "6-agent deliberation stack chain architecture workshop deep-dive synthesis code-review audit",
        "governance-audit": "Islamic congregation imam correction mutual deliberation rogue agent prevention governance",
        "synthesis":        "enterprise multi-agent rogue prevention deliberation stack architectural governance 2026",
    },
    4: {
        "workshop":         "AI agent accountability loop human escalation no loop autonomous decisions oversight",
        "deep-dive":        "AI governance escalation path deliberation chain human-in-loop stop hook accountability gate",
        "code-review":      "stop-validation hook niyyah gate deliberation chain human escalation accountability implementation",
        "governance-audit": "Islamic shura council accountability human judgment escalation governance AI autonomous",
        "synthesis":        "AI governance accountability loop human escalation deliberation chain gates 2026",
    },
    5: {
        "workshop":         "AI governance static policy failure learning compounding memory update session boundary",
        "deep-dive":        "AI governance session memory failure log pre-compact hook AnythingLLM episodic procedural",
        "code-review":      "pre-compact hook failure_log.md direct load JSONL session content verification implementation",
        "governance-audit": "Islamic ijtihad jurisprudence update learning failure governance static adaptive AI",
        "synthesis":        "AI governance compounding memory failure learning two-layer episodic procedural 2026",
    },
    6: {
        "workshop":         "AI audit trail cryptographic non-repudiation tamper-resistant logging IETF RFC 3161 TSA",
        "deep-dive":        "git SSH signing session hash chain TSA token Codeberg Forgejo independent witness anchoring",
        "code-review":      "session-hash-chain.ps1 git-anchor.ps1 SSH signing RFC3161 TSA implementation PowerShell",
        "governance-audit": "Kiraman Katibin Islamic recording angels external witness AI audit non-repudiation governance",
        "synthesis":        "cryptographic non-repudiation TSA anchoring SSH-signed git external witness AI governance 2026",
    },
}

# -------------------------------------------------------------------
# Load community-fit.md section for this problem
# -------------------------------------------------------------------
def extract_problem_section(path: str, problem_num: int) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        pattern = rf'## P{problem_num} '
        match = re.search(pattern, content)
        if not match:
            return f"[P{problem_num} section not found in community-fit.md]"
        start = match.start()
        next_sec = re.search(r'\n## ', content[start + 1:])
        end = (start + 1 + next_sec.start()) if next_sec else len(content)
        return content[start:end].strip()
    except Exception as e:
        return f"[Error reading {path}: {e}]"


def load_file_content(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"[Error loading {path}: {e}]"


def build_review_context() -> str:
    claim_section = extract_problem_section(COMMUNITY_FIT_PATH, PROBLEM_NUM)

    file_blocks = []
    for path in PROBLEM_FILES.get(PROBLEM_NUM, []):
        content = load_file_content(path)
        file_blocks.append(f"--- FILE: {path} ---\n{content}")

    substrate_section = (
        "[SUBSTRATE FILES -- THE ACTUAL IMPLEMENTATION]\n" + "\n\n".join(file_blocks)
        if file_blocks else
        "[No substrate files configured for this problem]"
    )

    return "\n\n".join([
        f"[COMMUNITY-FIT CLAIM -- WHAT WE CLAIM TO SOLVE]\n{claim_section}",
        substrate_section,
    ])


REVIEW_CONTEXT = build_review_context()

REVIEW_QUESTION = f"""
You are reviewing an architectural claim in community-fit.md for an AI governance \
framework grounded in Islamic epistemic concepts.

The document claims to solve {PROBLEM_LABELS.get(PROBLEM_NUM, f'P{PROBLEM_NUM}')}.

Your job: evaluate whether the claim is accurate, overstated, or missing nuance, \
by comparing it against the actual substrate (implementation files loaded above).

{REVIEW_CONTEXT}

Evaluate on five dimensions:

1. ACCURACY -- Does the claim accurately describe what the substrate actually does? \
Are there claims in the text that the substrate does not back?

2. GAPS -- What does the substrate NOT protect that the claim implies it does? Where \
is the boundary between what is structurally enforced and what is formation-governed?

3. RESIDUALS -- The document may name documented residuals. Are those residuals \
correctly characterized? Are there undocumented residuals the claim glosses over?

4. OVERCLAIM -- Does any part of the claim overstate the strength of the solution? \
What would a rigorous external auditor challenge?

5. ROOT CAUSE -- Is the solution addressing the root cause of the community problem, \
or a symptom? What would full root-cause closure require?

Return ONLY valid JSON (no preamble, no markdown fences):
{{
  "verdict": "APPROVE|CONDITIONAL_APPROVE|BLOCK",
  "summary": "one paragraph",
  "concerns": [
    {{
      "id": "C1",
      "dimension": "accuracy|gaps|residuals|overclaim|root_cause",
      "description": "specific concern",
      "severity": "blocking|non_blocking",
      "investigation_task": "exact question for next agent"
    }}
  ],
  "search_findings": "what live search revealed relevant to this claim",
  "closed_prior_concerns": [
    {{
      "id": "C1",
      "resolution": "one sentence: what you found",
      "closed": true,
      "close_type": "evidence | refutation | assertion"
    }}
  ]
}}
"""

# -------------------------------------------------------------------
# Load model config — edit scripts/models.json to change models
# -------------------------------------------------------------------
_models_path = os.path.join(CLAUDE_HOME, "scripts", "models.json")
try:
    with open(_models_path) as f:
        _m = json.load(f)
except Exception:
    _m = {}

WORKSHOP_MODEL    = _m.get("workshop",    "gemma4:31b")
DEEP_DIVE_MODEL   = _m.get("deep_dive",   "qwen3.6:27b")
CODE_REVIEW_MODEL = _m.get("code_review", "laguna-xs.2:q4_K_M")
GOVERNANCE_MODEL  = _m.get("governance",  "granite4.1:30b")
SYNTHESIS_MODEL   = _m.get("synthesis",   "nemotron-3-super:latest")

# -------------------------------------------------------------------
# Agent configs
# -------------------------------------------------------------------
PHASE1_AGENTS = [
    {
        "name": WORKSHOP_MODEL,
        "role": "workshop",
        "search_query": SEARCH_QUERIES[PROBLEM_NUM]["workshop"],
        "think": None,
        "num_predict": 4096,
    },
    {
        "name": DEEP_DIVE_MODEL,
        "role": "deep-dive",
        "search_query": SEARCH_QUERIES[PROBLEM_NUM]["deep-dive"],
        "think": False,
        "num_predict": 4096,
    },
]

PHASE2_AGENTS = [
    {
        "name": CODE_REVIEW_MODEL,
        "role": "code-review",
        "search_query": SEARCH_QUERIES[PROBLEM_NUM]["code-review"],
        "think": None,
        "num_predict": 3072,
    },
    {
        "name": GOVERNANCE_MODEL,
        "role": "governance-audit",
        "search_query": SEARCH_QUERIES[PROBLEM_NUM]["governance-audit"],
        "think": None,
        "num_predict": 4096,
    },
    {
        "name": SYNTHESIS_MODEL,
        "role": "synthesis",
        "search_query": SEARCH_QUERIES[PROBLEM_NUM]["synthesis"],
        "think": False,
        "num_predict": 32768,
        "num_ctx": 32768,
    },
]

AGENT_CONFIGS = PHASE1_AGENTS if PHASE == 1 else PHASE2_AGENTS

# -------------------------------------------------------------------
# Utility functions
# -------------------------------------------------------------------
def get_rijal_summary(model_name: str) -> str:
    try:
        with open(RIJAL_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        for section in content.split('\n## ')[1:]:
            if section.startswith(model_name):
                if '### Dispatch Summary' in section:
                    after = section.split('### Dispatch Summary', 1)[1]
                    m = re.search(r'\*"?(.*?)"?\*', after, re.DOTALL)
                    if m:
                        return m.group(1).strip()
    except Exception:
        pass
    return ""


def searxng_search(query: str, num_results: int = 5) -> str:
    try:
        encoded = urllib.parse.quote(query)
        url = f"{SEARXNG_HOST}/search?q={encoded}&format=json"
        with urllib.request.urlopen(url, timeout=20) as r:
            data = json.loads(r.read())
        results = data.get('results', [])[:num_results]
        lines = [f"Search: {query}\n"]
        for i, res in enumerate(results, 1):
            lines.append(f"{i}. [{res.get('title', '')}]({res.get('url', '')})")
            lines.append(f"   {res.get('content', '')}\n")
        return '\n'.join(lines)
    except Exception as e:
        return f"[Search unavailable: {e}]"


def check_api_ps():
    try:
        with urllib.request.urlopen("http://localhost:11434/api/ps", timeout=10) as r:
            data = json.loads(r.read())
        models = data.get('models', [])
        return len(models) == 0, [m['name'] for m in models]
    except Exception as e:
        return False, [str(e)]


def safe_stop(model_name: str):
    try:
        subprocess.run(['ollama', 'stop', model_name], timeout=15, capture_output=True)
    except Exception:
        pass
    for _ in range(15):
        time.sleep(2)
        try:
            with urllib.request.urlopen("http://localhost:11434/api/ps", timeout=5) as r:
                data = json.loads(r.read())
            if not any(m['name'] == model_name for m in data.get('models', [])):
                return
        except Exception:
            return
    # Model stuck — force restart Ollama server with GPU acceleration
    print(f"\n  [{model_name}] stuck after 30s -- force-restarting Ollama...", flush=True)
    if sys.platform == "win32":
        subprocess.run(['taskkill', '/F', '/IM', 'ollama.exe'], capture_output=True)
        time.sleep(2)
        # CUDA_v12 override for GPU scheduling — required on some Windows installations
        ps_cmd = '$env:OLLAMA_LLM_LIBRARY = "cuda_v12"; & (Get-Command ollama).Source serve'
        subprocess.Popen(
            ['powershell', '-NonInteractive', '-Command', ps_cmd],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    else:
        subprocess.Popen(['ollama', 'serve'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(12)
    print(f"  Server restarted.", flush=True)


def collect_open_concerns(all_outputs):
    """Three-bucket algorithm per canon Gap 4 close_type schema."""
    hard_closed = set()
    assertion_closed = {}
    for out in all_outputs:
        for cc in out.get('closed_prior_concerns', []):
            if cc.get('closed'):
                ct = cc.get('close_type', 'assertion')
                if ct in ('evidence', 'refutation'):
                    hard_closed.add(cc['id'])
                else:
                    assertion_closed[cc['id']] = cc
    open_concerns, seen = [], set()
    for out in all_outputs:
        for c in out.get('concerns', []):
            if c['id'] not in hard_closed and c['id'] not in seen:
                c['agent'] = out.get('_agent', 'unknown')
                open_concerns.append(c)
                seen.add(c['id'])
    soft_notes = [v for k, v in assertion_closed.items() if k not in hard_closed]
    return open_concerns, soft_notes


def dispatch_agent(cfg, prior_verdicts, search_results, open_concerns, soft_notes=None):
    name = cfg['name']
    role = cfg['role']

    concern_block = ""
    if open_concerns:
        concern_block = "\n[PRIOR OPEN CONCERNS -- INVESTIGATE EACH]\n"
        for c in open_concerns:
            concern_block += f"- {c.get('id', '?')} ({c.get('agent', '?')}): {c.get('description', '')}\n"
            concern_block += f"  Investigation task: {c.get('investigation_task', '')}\n"

    soft_notes_block = ""
    if soft_notes:
        soft_notes_block = "\n[ASSERTION-CLOSED CONCERNS -- VERIFY INDEPENDENTLY BEFORE ACCEPTING]\n"
        for n in soft_notes:
            soft_notes_block += (
                f"- {n.get('id', '?')}: {n.get('resolution', '')} "
                f"(closed by assertion -- no evidence cited; verify before treating as resolved)\n"
            )

    rijal = get_rijal_summary(name)
    rijal_block = f"\n[RIJAL -- PRIOR PERFORMANCE NOTE FOR {name}]\n{rijal}" if rijal else ""

    prompt = "\n".join([
        f"You are the {role} agent in a 5-agent architectural claim review for {PROBLEM_LABELS.get(PROBLEM_NUM, f'P{PROBLEM_NUM}')}.",
        rijal_block,
        f"\n[LIVE SEARCH RESULTS]\n{search_results}",
        f"\n[PRIOR AGENT VERDICTS]\n{chr(10).join(prior_verdicts) if prior_verdicts else 'None -- you are first.'}",
        concern_block,
        soft_notes_block,
        f"\n[REVIEW QUESTION AND FULL CLAIM CONTEXT]\n{REVIEW_QUESTION}",
        "\nReturn ONLY valid JSON. No explanation before or after the JSON object.",
    ])

    opts = {"num_predict": cfg['num_predict'], "temperature": 0.1}
    if cfg.get('num_ctx') is not None:
        opts['num_ctx'] = cfg['num_ctx']
    body = {
        "model": name,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
        "options": opts,
    }
    if cfg.get('think') is not None:
        body['think'] = cfg['think']

    print(f"\n{'=' * 60}", flush=True)
    print(f"P{PROBLEM_NUM} | Agent: {name} | Role: {role} | Phase {PHASE}", flush=True)
    print(f"Prompt: {len(prompt)} chars | Dispatching...", flush=True)

    content = ""
    thinking_chars = 0
    start = time.time()
    out_txt = os.path.join(OUTPUT_DIR, f"{name.replace(':', '-').replace('/', '-')}.txt")
    try:
        with requests.post(f"{OLLAMA_HOST}/api/chat", json=body, stream=True, timeout=32768) as r:
            r.raise_for_status()
            with open(out_txt, 'w', encoding='utf-8') as fout:
                for line in r.iter_lines():
                    if line:
                        try:
                            chunk = json.loads(line)
                            msg   = chunk.get("message", {})
                            piece = msg.get("content", "") or chunk.get("response", "")
                            think_piece = msg.get("thinking", "")
                            if think_piece:
                                thinking_chars += len(think_piece)
                                print(f"[thinking +{len(think_piece)}chars, total={thinking_chars}]", end='\r', flush=True)
                            if piece:
                                content += piece
                                fout.write(piece)
                                fout.flush()
                                print(piece, end='', flush=True)
                            if chunk.get("done"):
                                if thinking_chars:
                                    print(f"\n[thinking total: {thinking_chars} chars]", flush=True)
                                break
                        except json.JSONDecodeError:
                            pass
    except Exception as e:
        print(f"\nDISPATCH ERROR: {e}", flush=True)
        return None

    elapsed = time.time() - start
    print(f"\nDone in {elapsed / 60:.1f} min -- {len(content)} chars", flush=True)

    try:
        start_idx = content.find('{')
        end_idx   = content.rfind('}') + 1
        if start_idx >= 0 and end_idx > start_idx:
            result = json.loads(content[start_idx:end_idx])
            result['_agent'] = name
            result['_role']  = role
            return result
    except json.JSONDecodeError:
        pass

    return {
        "_agent": name, "_role": role,
        "verdict": "PARSE_ERROR",
        "summary": content[:800],
        "concerns": [], "raw": True,
    }


# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------
def main():
    print(f"\nCOMMUNITY-FIT-REVIEW: P{PROBLEM_NUM}, Phase {PHASE}", flush=True)
    print(f"Problem: {PROBLEM_LABELS.get(PROBLEM_NUM, f'P{PROBLEM_NUM}')}", flush=True)
    print(f"Output dir: {OUTPUT_DIR}", flush=True)

    all_outputs    = []
    prior_verdicts = []
    open_concerns  = []
    soft_notes     = []

    if PHASE == 2:
        for fname in ["gemma4-31b.json", "qwen3.6-27b.json"]:
            fpath = os.path.join(OUTPUT_DIR, fname)
            if os.path.exists(fpath):
                with open(fpath, 'r', encoding='utf-8') as f:
                    out = json.load(f)
                all_outputs.append(out)
                v = (f"{out.get('_agent','?')} ({out.get('_role','?')}): "
                     f"{out.get('verdict','?')} -- {out.get('summary','')[:200]}")
                prior_verdicts.append(v)

        synth_path = os.path.join(OUTPUT_DIR, "sonnet-synthesis.txt")
        if os.path.exists(synth_path):
            with open(synth_path, 'r', encoding='utf-8') as f:
                sonnet_synthesis = f.read().strip()
            prior_verdicts.append(f"claude-sonnet-4-6 (architect seat 3):\n{sonnet_synthesis}")
        else:
            print(f"ABORT: {synth_path} not found.", flush=True)
            print(f"Seat 3 synthesis must be written by the current Claude Code session instance.", flush=True)
            print(f"Read phase 1 outputs and substrate files, write synthesis, then re-run phase 2.", flush=True)
            return

        open_concerns, soft_notes = collect_open_concerns(all_outputs)
        print(f"Phase 2 loaded {len(all_outputs)} prior outputs. "
              f"Open concerns: {len(open_concerns)}, Soft notes: {len(soft_notes)}", flush=True)

    for cfg in AGENT_CONFIGS:
        name = cfg['name']

        print(f"\nWudu check before {name}...", flush=True)
        clear, running = check_api_ps()
        if not clear:
            print(f"  Still loaded: {running} -- stopping...", flush=True)
            for m in running:
                safe_stop(m)
            time.sleep(5)
            clear, running = check_api_ps()
            if not clear:
                print(f"  STILL BLOCKED: {running}. Aborting.", flush=True)
                break
        print("  api/ps clear", flush=True)

        search_results = searxng_search(cfg['search_query'])
        result = dispatch_agent(cfg, prior_verdicts, search_results, open_concerns, soft_notes)

        if result:
            all_outputs.append(result)
            verdict_line = (f"{name} ({cfg['role']}): {result.get('verdict', '?')} -- "
                            f"{result.get('summary', '')[:200]}")
            prior_verdicts.append(verdict_line)
            open_concerns, soft_notes = collect_open_concerns(all_outputs)

            out_json = os.path.join(OUTPUT_DIR, f"{name.replace(':', '-').replace('/', '-')}.json")
            with open(out_json, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)

            print(f"\nVerdict: {result.get('verdict')} | "
                  f"Open: {len(open_concerns)} | Soft notes: {len(soft_notes)}", flush=True)
            for c in result.get('concerns', []):
                print(f"  {c.get('id')}: [{c.get('severity')}] {c.get('description', '')[:120]}", flush=True)
            for n in soft_notes:
                print(f"  ~{n.get('id')} [assertion-closed]: {n.get('resolution', '')[:100]}", flush=True)

        print(f"  Stopping {name}...", flush=True)
        safe_stop(name)
        time.sleep(5)

    report = {
        "problem": PROBLEM_NUM,
        "label": PROBLEM_LABELS.get(PROBLEM_NUM, f"P{PROBLEM_NUM}"),
        "phase": PHASE,
        "all_outputs": all_outputs,
        "prior_verdicts": prior_verdicts,
        "final_open_concerns": open_concerns,
        "final_soft_notes": soft_notes,
    }
    report_path = os.path.join(OUTPUT_DIR, f"phase-{PHASE}-report.json")
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}", flush=True)
    print(f"PHASE {PHASE} COMPLETE -- P{PROBLEM_NUM}", flush=True)
    for v in prior_verdicts:
        print(f"  {v[:160]}", flush=True)
    print(f"\nFinal open concerns: {len(open_concerns)}", flush=True)
    for c in open_concerns:
        print(f"  {c.get('id')} ({c.get('agent')}): {c.get('description', '')[:120]}", flush=True)
    if soft_notes:
        print(f"\nFinal soft notes (assertion-closed, unverified): {len(soft_notes)}", flush=True)
        for n in soft_notes:
            print(f"  ~{n.get('id')}: {n.get('resolution', '')[:120]}", flush=True)

    if PHASE == 1:
        substrate_names = [os.path.basename(p) for p in PROBLEM_FILES.get(PROBLEM_NUM, [])]
        print(f"\nNEXT STEP -- Seat 3 synthesis required before phase 2:", flush=True)
        print(f"  1. Read phase 1 outputs in {OUTPUT_DIR}", flush=True)
        print(f"  2. Read substrate files: {substrate_names}", flush=True)
        print(f"  3. Write Seat 3 synthesis (this Claude Code instance, in-session) to:", flush=True)
        print(f"     {os.path.join(OUTPUT_DIR, 'sonnet-synthesis.txt')}", flush=True)
        print(f"  4. Run:  python scripts/community-fit-review.py {PROBLEM_NUM} 2", flush=True)

    print(f"\nReport: {report_path}", flush=True)


if __name__ == '__main__':
    main()
