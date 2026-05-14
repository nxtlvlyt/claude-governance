#!/usr/bin/env python3
"""
General-purpose deliberation chain runner.
Runs any architectural or governance question through the full 6-agent stack.

Usage:
  python scripts/deliberate.py <question_file> 1    -- phase 1 (gemma + qwen)
  python scripts/deliberate.py <question_file> 2    -- phase 2 (laguna + granite + nemotron)

question_file format (markdown):
  First non-empty paragraph is the question sent to all agents.
  ## Substrate Files section: list of file paths (one per line, relative to ~/.claude/).
  ## Search Queries section: list of queries (one per line, one per agent seat).

Between phase 1 and phase 2, Seat 3 (claude-sonnet-4-6) reads phase 1 outputs and
writes synthesis to: <TEMP>/deliberate/<question_slug>/sonnet-synthesis.txt

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
RIJAL_PATH   = os.path.join(CLAUDE_HOME, "canon", "model-rijal.md")

if len(sys.argv) < 2:
    print("Usage: python scripts/deliberate.py <question_file> [phase]")
    sys.exit(1)

QUESTION_FILE = sys.argv[1]
PHASE = int(sys.argv[2]) if len(sys.argv) > 2 else 1

# Derive a slug from the question filename for output directory
slug = os.path.splitext(os.path.basename(QUESTION_FILE))[0]
OUTPUT_DIR = os.path.join(tempfile.gettempdir(), "deliberate", slug)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# -------------------------------------------------------------------
# Parse question file
# -------------------------------------------------------------------
def parse_question_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    question = ""
    substrate_files = []
    search_queries = []

    current_section = "question"
    lines = text.split('\n')
    question_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith('## substrate files'):
            current_section = "substrate"
            continue
        elif stripped.lower().startswith('## search queries'):
            current_section = "search"
            continue
        elif stripped.startswith('## '):
            current_section = "other"
            continue

        if current_section == "question" and stripped:
            question_lines.append(line)
        elif current_section == "substrate" and stripped and not stripped.startswith('#'):
            substrate_files.append(stripped.lstrip('- ').strip())
        elif current_section == "search" and stripped and not stripped.startswith('#'):
            search_queries.append(stripped.lstrip('- ').strip())

    question = '\n'.join(question_lines).strip()
    return question, substrate_files, search_queries

QUESTION, SUBSTRATE_FILES, SEARCH_QUERIES = parse_question_file(QUESTION_FILE)

# Build substrate context
substrate_context = ""
for rel_path in SUBSTRATE_FILES:
    full_path = rel_path if os.path.isabs(rel_path) else os.path.join(CLAUDE_HOME, rel_path)
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        substrate_context += f"\n\n=== {rel_path} ===\n{content}"
    except Exception as e:
        substrate_context += f"\n\n=== {rel_path} ===\n[UNREADABLE: {e}]"

# Default search queries if not specified (one per agent seat)
DEFAULT_QUERIES = [
    "credential storage security plaintext JSON gitignore alternative approaches 2026",
    "Windows Credential Manager DPAPI PowerShell SecureString credential storage best practices",
    "API token storage security local machine file system risks plaintext credentials",
    "governance security credential handling AI governance systems audit trail",
    "credential management secure storage key management secrets management 2026",
]
while len(SEARCH_QUERIES) < 5:
    SEARCH_QUERIES.append(DEFAULT_QUERIES[len(SEARCH_QUERIES)])

# -------------------------------------------------------------------
# Load model config
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

REVIEW_QUESTION = f"""
You are a seat in a 6-agent deliberation chain evaluating an architectural decision.

[QUESTION]
{QUESTION}

[SUBSTRATE — files relevant to this decision]
{substrate_context}

Evaluate the question above thoroughly. Consider alternatives, risks, tradeoffs, and
whether the current implementation is correct, improvable, or needs replacement.

Return ONLY valid JSON (no preamble, no markdown fences):
{{
  "verdict": "APPROVE|CONDITIONAL_APPROVE|BLOCK",
  "summary": "one paragraph",
  "concerns": [
    {{
      "id": "C1",
      "section": "specific aspect or file",
      "description": "specific issue",
      "severity": "blocking|non_blocking",
      "recommended_fix": "what should change",
      "investigation_task": "question for next agent"
    }}
  ],
  "search_findings": "what live search revealed relevant to this question",
  "closed_prior_concerns": [
    {{
      "id": "C1",
      "resolution": "one sentence: what you found",
      "closed": true,
      "close_type": "evidence | refutation | assertion"
    }}
  ]
}}

close_type REQUIRED on every closed concern:
  evidence   = primary source, test result, or spec citation found (fully closed)
  refutation = logical argument the concern does not apply (fully closed)
  assertion  = opinion without specific evidence (carried forward as low-confidence note)
"""

PHASE1_AGENTS = [
    {
        "name": WORKSHOP_MODEL,
        "role": "workshop",
        "search_query": SEARCH_QUERIES[0],
        "think": None,
        "num_predict": 4096,
    },
    {
        "name": DEEP_DIVE_MODEL,
        "role": "deep-dive",
        "search_query": SEARCH_QUERIES[1],
        "think": False,
        "num_predict": 4096,
    },
]

PHASE2_AGENTS = [
    {
        "name": CODE_REVIEW_MODEL,
        "role": "code-review",
        "search_query": SEARCH_QUERIES[2],
        "think": None,
        "num_predict": 3072,
    },
    {
        "name": GOVERNANCE_MODEL,
        "role": "governance-audit",
        "search_query": SEARCH_QUERIES[3],
        "think": None,
        "num_predict": 4096,
    },
    {
        "name": SYNTHESIS_MODEL,
        "role": "synthesis",
        "search_query": SEARCH_QUERIES[4],
        "think": False,
        "num_predict": 32768,
        "num_ctx": 32768,
    },
]

AGENT_CONFIGS = PHASE1_AGENTS if PHASE == 1 else PHASE2_AGENTS


def get_rijal_summary(model_name):
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


def searxng_search(query, num_results=5):
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


def safe_stop(model_name):
    try:
        subprocess.run(['ollama', 'stop', model_name], timeout=30, capture_output=True)
        time.sleep(3)
    except Exception:
        pass


def collect_open_concerns(all_outputs):
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
        f"You are the {role} agent in a 5-agent review chain.",
        rijal_block,
        f"\n[LIVE SEARCH RESULTS]\n{search_results}",
        f"\n[PRIOR AGENT VERDICTS]\n{chr(10).join(prior_verdicts) if prior_verdicts else 'None -- you are first.'}",
        concern_block,
        soft_notes_block,
        f"\n[REVIEW QUESTION AND SUBSTRATE]\n{REVIEW_QUESTION}",
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
    print(f"Agent: {name} | Role: {role}", flush=True)
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


def main():
    print(f"\nDELIBERATE: Phase {PHASE}", flush=True)
    print(f"Question file: {QUESTION_FILE}", flush=True)
    print(f"Output dir: {OUTPUT_DIR}", flush=True)
    print(f"Question: {QUESTION[:200]}...", flush=True)

    all_outputs    = []
    prior_verdicts = []
    open_concerns  = []
    soft_notes     = []

    if PHASE >= 2:
        load_files = [
            f"{WORKSHOP_MODEL.replace(':', '-').replace('/', '-')}.json",
            f"{DEEP_DIVE_MODEL.replace(':', '-').replace('/', '-')}.json",
        ]
        if PHASE >= 3:
            load_files.append(f"{CODE_REVIEW_MODEL.replace(':', '-').replace('/', '-')}.json")
        if PHASE >= 4:
            load_files.append(f"{GOVERNANCE_MODEL.replace(':', '-').replace('/', '-')}.json")

        for fname in load_files:
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
            print(f"Write your synthesis to: {synth_path}", flush=True)
            return

        open_concerns, soft_notes = collect_open_concerns(all_outputs)
        print(f"Phase {PHASE} loaded {len(all_outputs)} prior outputs. "
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
        "phase": PHASE,
        "question_file": QUESTION_FILE,
        "question": QUESTION,
        "all_outputs": all_outputs,
        "prior_verdicts": prior_verdicts,
        "final_open_concerns": open_concerns,
        "final_soft_notes": soft_notes,
    }
    report_path = os.path.join(OUTPUT_DIR, f"phase-{PHASE}-report.json")
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}", flush=True)
    print("DELIBERATE CHAIN COMPLETE", flush=True)
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
        print(f"\nNEXT STEP -- Seat 3 synthesis required before phase 2:", flush=True)
        print(f"  1. Read phase 1 outputs in: {OUTPUT_DIR}", flush=True)
        print(f"  2. Write synthesis to: {os.path.join(OUTPUT_DIR, 'sonnet-synthesis.txt')}", flush=True)
        print(f"  3. Run: python scripts/deliberate.py {QUESTION_FILE} 2", flush=True)

    print(f"\nReport: {report_path}", flush=True)


if __name__ == '__main__':
    main()
