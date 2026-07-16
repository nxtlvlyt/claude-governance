// mission_lint.mjs — the MIQAT for missions (operator 2026-06-11: "how do we fix it so
// we catch things like this"). Today's receipts showed the engine sound and the WORK
// ORDERS flawed: 4a burned 6 cycles on unstaged evidence + a jail-contradicting premise;
// fb-backlog burned 4 on a line-cite bar with no numbered source. Each flaw was
// mechanically visible IN THE MISSION TEXT before the first fire. This lint is the
// sediment of those diagnoses — like every gate, a museum of paid-for failures, run at
// the boundary so a flawed mission is refused with NAMED reasons at cost ZERO instead
// of diagnosed from receipts at cost 2-6 cycles.
//
// Verdict: { ok, problems: [{rule, detail}] }. Pure text analysis — no fs, no dispatch.

import { parseMissionClass } from './mission_class.mjs';

export function lintMission(text) {
  const t = String(text || '');
  const problems = [];
  const add = (rule, detail) => problems.push({ rule, detail });

  // Does the plan stage evidence? (gather verbs that copy/produce files in the sandbox)
  const stagesEvidence = /Copy-Item|Invoke-WebRequest|Set-Content|Out-File|curl |wget |Get-Content[^\n]*Set-Content/i.test(t);

  // RULE 1 — UNSTAGED-EVIDENCE (4a receipt, 6 cycles): demands citation of absolute
  // paths but no step stages them into the sandbox.
  const demandsAbsCites = /cit\w*[^\n]{0,80}[A-Z]:\\\\?\w|every claim[^\n]{0,80}[A-Z]:\\\\?/i.test(t) || /\[[A-Z]:\\\\?[^\]\n]{2,60}\]/.test(t);
  if (demandsAbsCites && !stagesEvidence) {
    add('unstaged-evidence', 'mission demands cites to absolute paths (C:\\...) but no gather step stages those files into the sandbox — a jailed seat cannot read or legally cite them');
  }

  // RULE 2 — JAIL-CONTRADICTION (4a receipt): asserts external paths are readable.
  if (/[A-Z]:\\\\?[\w\\-]+[^\n]{0,40}(readable|read-only|are readable|can be read)/i.test(t) && !stagesEvidence) {
    add('jail-contradiction', 'mission claims external paths are "readable" — seats are sandbox-jailed BY DESIGN; the premise is false unless the plan stages copies');
  }

  // RULE 3 — LINE-CITE BAR WITHOUT NUMBERED SOURCE (fb-backlog receipt, 4 cycles):
  // demands line-level citations but stages no line-numbered copy to cite.
  const demandsLineCites = /cit\w*[^\n]{0,60}\bline\b|\bline-level cit|file'?s line\b|\bLnn\b|:L?\d+\]|file ?\+ ?line|line that proves/i.test(t);
  const stagesNumbered = /numbered|ForEach-Object[^\n]{0,80}\$i|\bL\$i\b|cat -n|nl /i.test(t);
  if (demandsLineCites && !stagesNumbered) {
    add('line-cite-without-numbered-source', 'mission demands line-level cites but stages no line-NUMBERED source copy — the bar is unachievable, and witnesses then read section cites as fabrication');
  }

  // RULE 4 — NO DONE-MEANS (older receipt class: unjudgeable missions drift): a mission
  // the verdict panel cannot judge against is unfinishable by construction.
  if (!/done\s*(means|=)|done-means/i.test(t)) {
    add('no-done-means', 'mission has no "Done means" clause — the verdict panel has no contract to judge against');
  }

  // RULE 5 — MD-DELIVERABLE WITHOUT MISSION-CLASS (v3-frame + retro-audit receipt,
  // 2026-06-11 16:26: the validator counts .md as an implementation target ONLY under
  // MISSION-CLASS: research — without the header, a PERFECT research plan fails
  // "impl:0" three times blind. The header is load-bearing config, not decoration.)
  const mdDeliverable = /artifact[^\n]{0,80}\.md\b|ONE artifact[^\n]{0,80}\.md|deliverable[^\n]{0,60}\.md/i.test(t);
  if (mdDeliverable && /MISSION-CLASS:\s*research/i.test(t) === false && /MISSION-CLASS:\s*code-repo/i.test(t) === false) {
    add('md-deliverable-without-research-class', 'mission delivers an .md artifact but lacks "MISSION-CLASS: research" — the plan validator will count impl:0 and refuse every plan');
  }

  // RULE 6 — CODE-REPO DECLARATION (Foundation 0.4): a code-repo mission writes REAL files
  // into a declared repo, so it MUST carry REPO-ROOT + a non-empty ALLOW-FILES, must NOT
  // point REPO-ROOT at the NAS, and must NOT list a secret/.git file as a write target.
  // These flaws are mechanically visible in the mission text — refuse at the miqat, cost 0.
  if (/MISSION-CLASS:\s*code-repo/i.test(t)) {
    const mc = parseMissionClass(t);
    if (!mc.repoRoot || mc.allowFiles.length === 0) {
      add('code-repo-missing-declaration', 'MISSION-CLASS: code-repo requires both a REPO-ROOT (absolute path to an existing git repo) and a non-empty ALLOW-FILES list of the repo-relative files it may write');
    }
    // NAS BAN (hard operator ruling: never touch the NAS). Refuse a REPO-ROOT on the NAS
    // mounts (N:/W:), the NAS IP, or ANY UNC path (\\host\share) — code missions write to
    // local project repos only.
    const root = mc.repoRoot || '';
    const rawRootMatch = t.match(/REPO-ROOT:\s*([^\r\n]+)/i);
    const rawRoot = rawRootMatch ? rawRootMatch[1].trim().replace(/^["']|["']$/g, '') : root;
    if (/^[NW]:/i.test(rawRoot) || /192\.168\.2\.27/.test(rawRoot) || /^\\\\/.test(rawRoot) || /^\/\//.test(rawRoot)) {
      add('code-repo-nas-banned', `REPO-ROOT '${rawRoot}' points at the NAS or a UNC share — code-repo missions write to LOCAL project repos only; the NAS is never a write target`);
    }
    // SECRET / .git ALLOW-FILES (the kernel refuses them at write time too; flag them here
    // so a misdrawn work order is caught at the boundary, not mid-mission).
    const secretRe = /(^|\/)(\.env(\.[\w.-]+)?|id_rsa|[\w.-]+\.pem|[\w.-]+\.key|credentials[\w.-]*|secrets[\w.-]*)$/i;
    for (const af of mc.allowFiles) {
      if (af.split('/').includes('.git') || secretRe.test(af)) {
        add('code-repo-secret-target', `ALLOW-FILES entry '${af}' targets a .git internal or a secret file (.env/*.pem/*.key/id_rsa/credentials/secrets) — never a legal write target in any class`);
      }
    }
  }

  // RULE 7 — VISUAL-QC-REQUIRED WITHOUT RENDER-WITNESS (operator 2026-06-09): a mission
  // declares VISUAL-QC-REQUIRED but the Done-means clause lacks headless-browser/Playwright/
  // puppeteer/headless render/browser render verification language. Such a mission is
  // unverifiable — a visual QC cannot be performed without evidence of a render verification.
  const hasVisualQcHeader = /^.*VISUAL-QC-REQUIRED.*$/im.test(t);
  const hasRenderWitness = /\b(headless\s*browser|playwright|puppeteer|headless\s*render|browser\s*render)\b/i.test(t);
  const hasDoneMeans = /done\s*(means|=)|done-means/i.test(t);
  if (hasVisualQcHeader && hasDoneMeans && !hasRenderWitness) {
    add('visual-qc-without-render-done-means', 'mission declares VISUAL-QC-REQUIRED header but Done-means clause lacks headless-browser/Playwright/puppeteer/headless render/browser render verification language — visual QC cannot be verified without render evidence');
  }

  // RULE 8 — DEPLOY WITHOUT COMMIT (2026-06-30 receipt; RESTORED 2026-06-30 21:58Z after a
  // live chain run accidentally deleted this rule + its tests while adding RULE 7 above,
  // editing in place rather than appending — caught via git diff on the chain's own commit,
  // not assumed). muddytires' Cloudflare Pages project has no git linkage ("Git Provider:
  // No") — `wrangler pages deploy` / `wrangler deploy` ships whatever is on disk straight to
  // production, independent of git entirely. This already happened: MT_ATTRIB_FIX6 went live
  // via a deploy run from a mission worktree that was later cleaned up, landing in ZERO
  // branches anywhere — confirmed by searching every local + remote branch. A future mission
  // can trivially repeat this (it is the OBVIOUS way to "ship the fix") and the chain's own
  // seats never read STATE.md, so a note there cannot prevent a recurrence — only a mechanical
  // refusal at the miqat can. A mission whose commands deploy via wrangler MUST also commit
  // via git somewhere in the same mission, or it is refused here, cost zero, before it runs.
  const deploysViaWrangler = /\bwrangler\s+(pages\s+)?deploy\b/i.test(t);
  const commitsViaGit = /\bgit\s+commit\b/i.test(t);
  if (deploysViaWrangler && !commitsViaGit) {
    add('deploy-without-commit', 'mission runs a wrangler deploy command but contains no "git commit" step anywhere in its text — production can go live with content that exists in NO git branch (confirmed live receipt: MT_ATTRIB_FIX6 deployed straight from a since-deleted worktree, in zero branches). Every deploy step needs a paired commit in the SAME mission so git and Cloudflare never diverge.');
  }

  // RULE 9 — HANDROLLED LOCALHOST PREVIEW (2026-07-03 receipt: trip-cost.S2 FAILED x2,
  // NO_PREVIEW_BASE_URL at step 5 with steps 1-4 green): split-era mission texts bake in
  // "start a local preview server bound to PREVIEW-BASE-URL's port (localhost:8788)" exec
  // steps. Exec steps never receive a preview URL — only the verdict-phase visual witness
  // auto-provisions — so nothing ever serves that port and the step fails
  // deterministically. 31 sibling mission files carried the same pattern at rule-add time.
  // The cure is the engine-native verb (the amendment that fixed trip-cost.S2): wrangler
  // pages deploy --branch=preview, parse the emitted *.pages.dev URL, render from it — so
  // a mission that carries the wrangler deploy verb is exempt (it may legitimately mention
  // localhost:8788 in an amendment-history note).
  const handrollsLocalhost = /localhost:8788|bound to PREVIEW-BASE-URL'?s port/i.test(t);
  if (handrollsLocalhost && !deploysViaWrangler) {
    // GENERICIZED (intake N1, 2026-07-07): the cure text hardcoded --project-name=muddytires —
    // a generic engine rule prescribing one project's name is wrong for every other project
    // (genericity audit receipt). This module is PURE TEXT by contract (header line 10: no fs),
    // so the cure prescribes the lookup rather than resolving it here.
    add('handrolled-localhost-preview', "mission targets a hand-rolled localhost:8788 preview server — exec steps never receive a PREVIEW-BASE-URL value and nothing serves that port (trip-cost.S2 FAILED x2 receipt, 2026-07-03). Replace the step with the engine-native verb: wrangler pages deploy . --project-name=<the `name` field of the mission's REPO-ROOT wrangler.toml> --branch=preview (paired with the mission's git commit per RULE 8), parse the emitted *.pages.dev URL to a scratch file, render from that URL.");
  }

  // RULE 10 — CROSS-STEP SCRATCH STATE (2026-07-03, trip-cost.S2 5th-run receipt: a scratch
  // file written by one step was GONE by the next — the engine's attempt hygiene and re-entry
  // sweeps make untracked cross-step state unreliable BY DESIGN. Every passing mission
  // creates+uses+deletes its scratch inside ONE step). A scratch-file token appearing in TWO
  // OR MORE distinct numbered step lines is the doomed shape — refuse at cost zero.
  {
    const stepLines = t.split(/\r?\n/).filter((l) => /^\s*\d+\.\s/.test(l));
    const seen = new Map();
    for (let i = 0; i < stepLines.length; i++) {
      for (const m of stepLines[i].matchAll(/\bscratch-[\w.-]+\.\w+/g)) {
        const tok = m[0];
        if (!seen.has(tok)) seen.set(tok, new Set());
        seen.get(tok).add(i);
      }
    }
    for (const [tok, steps] of seen) {
      if (steps.size >= 2) {
        add('cross-step-scratch-state', `scratch file '${tok}' spans ${steps.size} step lines — cross-step untracked state is unreliable in this engine (trip-cost.S2 receipt: written green in one step, absent the next). Create, use, and delete the scratch inside ONE step.`);
        break;   // one finding names the class; no need to enumerate every token
      }
    }
  }

  // RULE 11 — GREP-ONLY VERIFICATION ON A VISUAL MISSION (2026-07-03, mobile-qc.S1.S1 panel
  // arkan F1 receipt: a QC-tool mission whose steps only Select-String'd its own code was
  // correctly REJECTED — "zero browser execution occurred"). A VISUAL-QC-REQUIRED mission
  // must contain at least one step that actually EXECUTES something (node/npx/npm/wrangler/
  // playwright invocation), not only text-match verifies.
  if (hasVisualQcHeader) {
    const stepLines2 = t.split(/\r?\n/).filter((l) => /^\s*\d+\.\s/.test(l));
    const hasExecution = stepLines2.some((l) => /\b(node|npx|npm|wrangler|playwright)\s/i.test(l));
    if (stepLines2.length && !hasExecution) {
      add('grep-only-visual-verification', 'VISUAL-QC-REQUIRED mission has no step that executes anything (node/npx/wrangler/playwright) — the verdict panel will correctly reject static text-matches as proof of a visual deliverable (mobile-qc.S1.S1 F1 arkan receipt). Add an executable outcome step.');
    }
  }

  // RULE 12 — ORPHAN PAGE (2026-07-03, trip-cost receipt: the planner shipped LIVE at
  // /trip-cost with a panel-signed render receipt, yet the homepage and map carried ZERO
  // inbound links — the operator, trying to verify it, could not navigate to it. Every
  // layer judged the deliverable in isolation; none asked "can a user get here?"). A
  // code-repo mission whose ALLOW-FILES ship a standalone page (an .html file other than
  // the site's entry surfaces index.html/map.html) must EITHER carry reachability intent
  // (an inbound-link/nav step or evidence line) OR declare `UNLINKED-OK: <why>` (e.g. the
  // page is already linked, or is deliberately direct-URL-only). The declaration forces
  // the author to actually check — the judgment that failed on trip-cost.
  const allowHtml = [...t.matchAll(/^[ \t]*-[ \t]+(\S+\.html)\s*$/gim)].map((m) => m[1].toLowerCase());
  const shipsPage = /MISSION-CLASS:\s*code-repo/i.test(t)
    && allowHtml.some((f) => !/(^|\/)(index|map)\.html$/.test(f));
  if (shipsPage) {
    const hasReachability = /\b(inbound[- ]link|nav(igation)? (link|entry|anchor)|NAV_LINK|reachab)/i.test(t)
      || /^UNLINKED-OK:/im.test(t);
    if (!hasReachability) {
      add('orphan-page-no-reachability', 'mission ships a standalone .html page but no step/evidence addresses how a user REACHES it (no inbound-link/nav step, no NAV_LINK/reachability evidence, no UNLINKED-OK declaration) — a page reachable only by typed URL is not shipped (trip-cost orphan receipt 2026-07-03). Add a nav-link step or declare UNLINKED-OK: <why>.');
    }
  }

  // RULE 13 — DESIGN PASS WITHOUT CONTRACT (QUEUE item 21; receipts 2026-07-10/11: atv-11,
  // the hand-styled design pass, rewrote the whole stylesheet from improvised per-mission
  // taste and shipped the operator's phone verdict "why is it so visually bad?" — the cure
  // that passed was atv-12-design-to-contract, which implemented a written BINDING DESIGN.md
  // with "where this mission text and DESIGN.md disagree, DESIGN.md wins". Improvised taste
  // is unreviewable; a contract file is). THE SCOPING IS THE RULE: the trigger is design-pass
  // SEMANTICS in the mission text AND a .css write target in ALLOW-FILES/steps — NEVER bare
  // VISUAL-QC-REQUIRED, which dozens of integrate missions carry without being design passes
  // (mt-integrate-testimonials class), and a copy rewrite touching html only is not a design
  // pass (mt-copy-clarity class). A mission that says "design contract" in prose both
  // triggers and binds by construction — the phrase IS the binding; the hyphenated pattern
  // name "design-to-contract" alone triggers but does NOT bind (naming the pattern is not
  // naming the contract file).
  const designPassLanguage = /design\s+(system|pass|contract)|restyle|rewrite the .*stylesheet|design-to-contract/i.test(t);
  const cssInAllowFiles = /^[ \t]*-[ \t]+\S+\.css\s*$/im.test(t);
  const cssInSteps = t.split(/\r?\n/).filter((l) => /^\s*\d+\.\s/.test(l)).some((l) => /\.css\b/i.test(l));
  const bindsDesignContract = /\bDESIGN\.md\b|design contract/i.test(t);
  if (designPassLanguage && (cssInAllowFiles || cssInSteps) && !bindsDesignContract) {
    add('design-pass-without-contract', 'mission carries design-pass semantics (design system/pass, restyle, or stylesheet-rewrite language) AND writes a .css target, but binds to NO design contract file — no DESIGN.md mention, no "design contract". Improvised per-mission taste shipped atv-11 straight to the operator\'s "why is it so visually bad?" phone verdict (2026-07-11); the shape that passed is atv-12-design-to-contract: author the contract file first, then implement it with the contract named as the spec that WINS over the mission text.');
  }

  // RULE 14 — CONTENT PASS WITHOUT CONTRACT (QUEUE item 26 / gap-seo-cro-copy-contract,
  // operator-shared SEO & CRO Voice playbook 2026-07-12: the atv homepage h1 and hub
  // headings are exactly the "clean but invisible" class the playbook names — readable,
  // on-brand, and SEO-dead. mt-copy-clarity already proved the readability half of this
  // problem (Flesch-Kincaid <=8 grading) but PROVABLY did not reach SEO semantics — no
  // page carries geo/intent modifiers, FAQ blocks, or the H1 formula, because nothing
  // mechanical ever asked. The DESIGN.md arc already answered the shape: prose taste
  // fails, a CONTRACT with mechanical gates works — CONTENT-CONTRACT.md is the copy-side
  // twin of DESIGN.md, same "where this mission text and X disagree, X wins" binding.
  // THE SCOPING IS THE RULE, mirroring RULE 13 exactly: the trigger is copy-pass
  // SEMANTICS in the mission text AND an .html target in ALLOW-FILES/steps, NEVER a bare
  // tag. Two false-positive classes this must NOT trip, both already living in this
  // file's own RULE 13 fixtures: mt-integrate-testimonials (a cherry-pick/integration
  // mission that touches .html but carries zero copy/content/heading/meta rewrite
  // language — RULE 13's own comment names this exact class) and mt-copy-clarity (a
  // READABILITY pass — "rewrite the offending strings to plain language" — is not an
  // SEO/heading/meta semantics pass; the gap receipt itself names the two as provably
  // distinct concerns). A mission that says "content contract" in prose both triggers
  // and binds by construction (the phrase IS the binding, same as RULE 13's "design
  // contract"); the hyphenated pattern name "content-to-contract" alone triggers but
  // does NOT bind (naming the pattern is not naming the contract file).
  const copyPassLanguage = /\b(copy|content)\s+(pass|contract)\b|\bheading\s*(rewrite|formula|injection)\b|\bmeta\s*(description|title)?\s*rewrite\b|rewrite the [^\n]{0,40}(headings?|h1s?|meta\b)|\bSEO\s+(copy|semantics|headings?)\b|content-to-contract/i.test(t);
  const htmlInAllowFiles = /^[ \t]*-[ \t]+\S+\.html\s*$/im.test(t);
  const htmlInSteps = t.split(/\r?\n/).filter((l) => /^\s*\d+\.\s/.test(l)).some((l) => /\.html\b/i.test(l));
  const bindsContentContract = /\bCONTENT-CONTRACT\.md\b|content contract/i.test(t);
  if (copyPassLanguage && (htmlInAllowFiles || htmlInSteps) && !bindsContentContract) {
    add('content-pass-without-contract', 'mission carries copy-pass semantics (copy/content pass-or-contract language, heading rewrite/formula/injection, meta description/title rewrite, or SEO copy/semantics/headings language) AND touches an .html target, but binds to NO content contract file — no CONTENT-CONTRACT.md mention, no "content contract". The atv homepage h1 and hub headings are exactly this "clean but invisible" class the operator-shared SEO & CRO Voice playbook named (QUEUE item 26, 2026-07-12); mt-copy-clarity already proved readability grading alone does not reach SEO semantics. The shape that should pass mirrors atv-12-design-to-contract: author CONTENT-CONTRACT.md first (the playbook\'s anti-fluff bans, H1 formula, heading keyword injection, trust architecture, high-intent FAQs, adapted per site), then implement it with the contract named as the spec that WINS over the mission text.');
  }

  // RULE 15 -- BARE COMMIT WITHOUT PATHSPEC (gap-bare-commit-sweeps-preexisting-stage,
  // 2026-07-13 receipt: commit 7e0a011, engine-verdict-merge-visibility-downgrade's own
  // commit step ran `git add -- verdict_merge.mjs` then a BARE `git commit -m ...` with no
  // pathspec -- a bare commit commits the WHOLE INDEX, silently sweeping in an unrelated,
  // already-staged conduct-cycle.mjs change from a DIFFERENT, interrupted mission. 20
  // sibling missions built the same session carried the identical pattern. The fix is
  // mechanical and cheap: scope the commit itself with an explicit pathspec (`git commit
  // -- <files> -m ...`), not just the preceding `git add`.
  // Scoped to code-repo missions specifically: the risk (a bare commit sweeping in
  // pre-existing staged content) is a property of the git_steps.mjs sandbox model those
  // missions run in. Other classes (e.g. ops-deploy) do not carry the same ALLOW-FILES/
  // containment semantics -- RULE 8's own deploy-with-commit fixture uses a bare commit
  // legitimately and is a different class entirely.
  const isCodeRepoClass = /MISSION-CLASS:\s*code-repo/i.test(t);
  const bareCommit = isCodeRepoClass && /\bgit\s+commit\s+-m\b/i.test(t);
  // ORDERING FIX (gap-mission-lint-rule15-wrong-pathspec-order, 2026-07-14): accept a
  // standalone ` -- <pathspec>` ANYWHERE on the git-commit line, not only immediately after
  // `commit`. The flags-then-pathspec ordering (`git commit -m "..." -- <files>`) is the
  // syntactically CORRECT one (`--` ends option parsing; putting it before -m swallows the
  // message as a pathspec -- reproduced live twice this session). `\s--\s+\S` requires
  // whitespace after the double-dash, so `--no-verify`-class flags never match.
  const scopedCommit = /\bgit\s+commit\b[^\n]*\s--\s+\S/i.test(t);
  if (bareCommit && !scopedCommit) {
    add('bare-commit-no-pathspec', 'mission runs `git commit -m ...` with NO pathspec on the commit itself -- a bare commit commits the WHOLE INDEX, not just what this mission\'s own `git add` staged (confirmed live: commit 7e0a011 silently absorbed an unrelated, already-staged change from a different interrupted mission this exact way). Scope the commit explicitly: `git commit -- <the mission\'s own ALLOW-FILES> -m "..."` so only this mission\'s own declared files ever land in the commit, regardless of what else happens to be staged.');
  }

  // RULE 16 -- IMPROVISE-BAIT: [command]/[verify] STEP WITHOUT A LITERAL PAYLOAD
  // (N5 item 12 prep, 2026-07-15 receipts -- five same-day failures where a seat
  // improvised the MECHANICAL part of a step because the mission text only DESCRIBED
  // the work instead of carrying it verbatim: a scratch playwright script hand-written
  // with require() inside an .mjs file (ESM/CJS mismatch); an og-meta witness that
  // checked ONE substring instead of the full tag set; three separate polarity
  // inversions on a verify command. Steps that carry LITERAL commands/scripts get
  // transcribed faithfully (mt-lane-fix-s2's "Run exactly:" convention;
  // atv-16-og-card-wire's fenced command_queue.mjs block); steps that only describe
  // work get improvised wrong -- every time, in a different way, which is why this is
  // a lint rule and not a wording reminder.
  // SCOPE: code-repo missions only (reuses isCodeRepoClass from RULE 15 above), AND
  // only step lines that carry SCRIPT/WITNESS intent (script|witness|playwright|
  // puppeteer|node|scratch-) -- a bare .mjs/.js filename MENTION is deliberately NOT
  // a trigger (dry-run false-positive: a cherry-pick step naming a file it touches,
  // e.g. "introducing build-testimonials.mjs", has zero scripted-witness intent). A
  // plain one-line command with no scripting signal at all (RULE 12's own "add the
  // nav link on index.html; evidence NAV_LINK=present" fixture) is out of this rule's
  // scope: nothing to improvise, no receipt names that class. EXEMPT even inside the
  // gate: [edit]-class steps, and any step whose own
  // line carries both "LITERAL" and "PINNED" (case-insensitive) -- an explicit author
  // declaration that the values are pinned, not seat-derived (mirrors RULE 12's
  // UNLINKED-OK escape hatch: the author checked, so trust the check).
  // LITERAL-PAYLOAD PROOF, mechanical, any ONE of:
  //   (a) the step's own line contains "Run exactly:" (the mt-lane-fix-s2 convention);
  //   (b) the mission carries a fenced shell/pwsh/bash block anywhere (```pwsh/```sh/
  //       ```bash/```powershell) -- the atv command_queue.mjs jurisdiction convention,
  //       where literal commands live in the fence, not inline per numbered step;
  //   (c) the step's own line invokes `node <path>` where <path> matches an entry in
  //       this mission's own ALLOW-FILES -- a COMMITTED path this mission itself
  //       declares, the pure-text proxy for "a file that exists" (this module is pure
  //       text by contract, header line 10: no fs -- ALLOW-FILES is the only
  //       committed-file list available as text, so it stands in for "exists");
  //   (d) the step's own line authors-and-runs a scratch script in one step -- a
  //       `scratch-*` token (RULE 10's own \bscratch-[\w.-]+\.\w+ token regex, reused
  //       verbatim rather than re-invented) that is also `node`-invoked on the SAME
  //       line. This is RULE 10's own create-use-delete-in-one-step idiom -- already
  //       governed and made safe by RULE 10 (single-step, self-contained, immediately
  //       deleted); RULE 16 does not re-litigate it.
  // None of the four -> the step is prose describing scripted work with no pinned
  // payload, which is exactly the improvise-bait shape the day's five receipts share.
  if (isCodeRepoClass) {
    const mc16 = parseMissionClass(t);
    const allowFiles16 = mc16.allowFiles || [];
    const fencedShellBlock16 = /```(pwsh|powershell|sh|bash)\b/i.test(t);
    // NOTE: bare ".mjs"/".js" filename mentions are deliberately NOT gate triggers
    // (dry-run false-positive: RULE 13c's step 1 "Cherry-pick the commit introducing
    // build-testimonials.mjs..." merely NAMES a file being cherry-picked, a pure git
    // op with no scripted-witness intent -- the same class RULE 12's nav-link step is
    // exempt from). The five real receipts all name script/witness/node/scratch- work
    // explicitly; a bare extension mention never does on its own.
    const scriptIntentGate16 = /\b(script|witness|playwright|puppeteer|node)\b|scratch-/i;
    const stepLines16 = t.split(/\r?\n/).filter((l) => /^\s*\d+\.\s/.test(l));
    for (const line of stepLines16) {
      const tagMatch = line.match(/\[(command|verify|edit)\]/i);
      if (!tagMatch) continue;
      const tag = tagMatch[1].toLowerCase();
      if (tag === 'edit') continue;
      const hasLiteralPinned = /\bLITERAL\b/i.test(line) && /\bPINNED\b/i.test(line);
      if (hasLiteralPinned) continue;
      if (!scriptIntentGate16.test(line)) continue;
      const hasRunExactly = /run exactly:/i.test(line);
      const nodeMatch = line.match(/\bnode\s+(\S+)/i);
      const hasCommittedScript = !!(nodeMatch && allowFiles16.some((af) => nodeMatch[1].includes(af) || af.includes(nodeMatch[1])));
      const scratchTokens = [...line.matchAll(/\bscratch-[\w.-]+\.\w+/g)].map((m) => m[0]);
      const hasScratchIdiom = scratchTokens.some((tok) => line.includes('node ' + tok));
      if (!hasRunExactly && !fencedShellBlock16 && !hasCommittedScript && !hasScratchIdiom) {
        const snippet = line.trim().slice(0, 120) + (line.trim().length > 120 ? '...' : '');
        add('improvise-bait', `[${tag}] step describes scripted/witness work but carries no literal executable payload ("${snippet}") -- no "Run exactly:", no fenced shell block, no node <committed-ALLOW-FILES-script>, no scratch-create-run-delete-in-one-step idiom. Today's receipts (2026-07-15, five instances across both engines): a scratch playwright script hand-written with require() inside an .mjs (ESM/CJS mismatch); an og-meta witness checking ONE substring instead of the full tag set; three separate polarity inversions on a verify command. Steps that carry the literal command/script get transcribed faithfully; steps that describe work get improvised wrong. Rewrite the step to carry "Run exactly: <literal command>", a fenced shell block, a node invocation of a script already declared in ALLOW-FILES, or the write-scratch-X/node-scratch-X-in-one-step idiom.`);
        break; // one finding names the class per mission (RULE 10's own convention)
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

// ---- selftests: node mission_lint.mjs
if (process.argv[1] && process.argv[1].endsWith('mission_lint.mjs')) {
  let pass = 0, fail = 0;
  const ck = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

  // the 4a shape (pre-revision): abs-path cites + "readable" premise, no staging
  const fourA = 'Maqsad: card. every claim carries a C:\\vanlife\\<file> cite. The C:\\vanlife files it names are readable read-only. Done means: card exists.';
  const r1 = lintMission(fourA);
  ck(!r1.ok && r1.problems.some((p) => p.rule === 'unstaged-evidence') && r1.problems.some((p) => p.rule === 'jail-contradiction'), 'the 4a mission (6 burned cycles) is REFUSED at the miqat with both its flaws named');

  // the fb-backlog shape (pre-revision): line cites, no numbered source
  const fbb = "Maqsad: ranked card. every claim cited to the staged file's line. Done means: card with line cites.";
  const r2 = lintMission(fbb);
  ck(!r2.ok && r2.problems.some((p) => p.rule === 'line-cite-without-numbered-source'), 'the fb-backlog mission (4 burned cycles) is REFUSED with the numbered-source flaw named');

  // the REVISED 4a shape: stages its evidence -> passes
  const fourARev = "Maqsad: card. COMMAND steps copy the evidence: Copy-Item 'C:\\vanlife\\PRODUCT-PLAN.md' . Then cite STAGED names. Done means: card cited to staged files.";
  ck(lintMission(fourARev).ok, 'the REVISED 4a mission (which went DONE) passes the miqat');

  // the REVISED fb-backlog shape: numbered copy staged -> passes
  const fbbRev = 'Maqsad: card. COMMAND: Get-Content src.md | ForEach-Object { $i++; "L$i: $_" } | Set-Content src.numbered.md. Claims cite [src.numbered.md Lnn]. Done means: line-cited card.';
  ck(lintMission(fbbRev).ok, 'the REVISED fb-backlog mission passes (numbered source staged)');

  // missing done-means
  ck(!lintMission('Maqsad: do a thing well.').ok, 'a mission with no Done-means is refused (unjudgeable by construction)');

  // RULE 5: the v3-frame shape — md deliverable, no MISSION-CLASS -> refused; with it -> passes
  const noClass = 'MISSION: x\nMaqsad: ONE artifact — verdict.md at root. Done means: verdict.md exists.';
  ck(!lintMission(noClass).ok && lintMission(noClass).problems.some((p) => p.rule === 'md-deliverable-without-research-class'), 'md deliverable without MISSION-CLASS: research REFUSED (the v3-frame/retro-audit 6-cycle class)');
  ck(lintMission('MISSION: x\nMISSION-CLASS: research\nMaqsad: ONE artifact — verdict.md at root. Done means: verdict.md exists.').ok, 'same mission WITH the header passes');

  // a clean ordinary mission passes (no md-artifact phrasing, code-class)
  ck(lintMission('Maqsad: write the module from the staged input. Done means: module exists with all functions tested.').ok, 'a clean code mission passes the miqat untouched');

  // ---- RULE 6: CODE-REPO declaration rules (Foundation 0.4) ----
  // a well-formed code-repo mission passes.
  const goodCode = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\bakery\nALLOW-FILES:\n  - src/cost.mjs\n  - test/cost.test.mjs\nMaqsad: add cost calc. Done means: node -c passes.';
  ck(lintMission(goodCode).ok, 'code-repo: well-formed mission (local REPO-ROOT + allowlist) passes the miqat');

  // missing ALLOW-FILES -> refused.
  const noAllow = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\bakery\nMaqsad: add a thing. Done means: it works.';
  ck(!lintMission(noAllow).ok && lintMission(noAllow).problems.some((p) => p.rule === 'code-repo-missing-declaration'), 'code-repo: missing ALLOW-FILES REFUSED (code-repo-missing-declaration)');

  // missing REPO-ROOT -> refused.
  const noRoot = 'MISSION-CLASS: code-repo\nALLOW-FILES:\n  - src/x.mjs\nMaqsad: x. Done means: y.';
  ck(!lintMission(noRoot).ok && lintMission(noRoot).problems.some((p) => p.rule === 'code-repo-missing-declaration'), 'code-repo: missing REPO-ROOT REFUSED (code-repo-missing-declaration)');

  // NAS REPO-ROOT (every form) -> refused.
  for (const nasRoot of ['N:\\repos\\x', 'W:\\share\\proj', '\\\\192.168.2.27\\volume1\\proj', '\\\\nas-host\\share\\proj']) {
    const m = `MISSION-CLASS: code-repo\nREPO-ROOT: ${nasRoot}\nALLOW-FILES:\n  - src/x.mjs\nMaqsad: x. Done means: y.`;
    ck(!lintMission(m).ok && lintMission(m).problems.some((p) => p.rule === 'code-repo-nas-banned'), `code-repo: NAS REPO-ROOT '${nasRoot}' REFUSED (code-repo-nas-banned)`);
  }

  // secret / .git ALLOW-FILES -> flagged.
  const secretAllow = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - .env\n  - config/server.key\n  - .git/config\nMaqsad: x. Done means: y.';
  const sa = lintMission(secretAllow);
  ck(!sa.ok && sa.problems.filter((p) => p.rule === 'code-repo-secret-target').length >= 2, 'code-repo: secret/.git ALLOW-FILES entries FLAGGED (code-repo-secret-target)');

  // RULE 7: visual-qc-without-render-done-means — VISUAL-QC-REQUIRED header but Done-means lacks render witness

  // a mission with VISUAL-QC-REQUIRED header but no render witness in Done-means -> refused
  const visualQcNoRender = 'MISSION: x\nVISUAL-QC-REQUIRED\nMaqsad: verify UI. Done means: UI rendered and matches snapshot.';
  ck(!lintMission(visualQcNoRender).ok && lintMission(visualQcNoRender).problems.some((p) => p.rule === 'visual-qc-without-render-done-means'), 'RULE 7: VISUAL-QC-REQUIRED header without render witness in Done-means REFUSED');

  // a mission with VISUAL-QC-REQUIRED header AND render witness language in Done-means -> passes
  const visualQcWithRender = 'MISSION: x\nVISUAL-QC-REQUIRED\nMaqsad: verify UI. Done means: UI rendered via Playwright and matches snapshot.';
  ck(lintMission(visualQcWithRender).ok, 'RULE 7: VISUAL-QC-REQUIRED header with Playwright render witness passes');

  // a mission without VISUAL-QC-REQUIRED header should not trigger this rule even with render language
  const noVisualQcHeader = 'MISSION: x\nMaqsad: verify UI via puppeteer. Done means: UI rendered via puppeteer and matches snapshot.';
  ck(lintMission(noVisualQcHeader).ok, 'RULE 7: mission without VISUAL-QC-REQUIRED header passes even with render witness language');

  // a mission with VISUAL-QC-REQUIRED header but no Done-means clause should NOT trigger this rule
  // (because the rule only fires when both VISUAL-QC-REQUIRED is present AND Done-means exists).
  // FIXED 2026-06-30: the original assertion checked .ok overall, which is ALWAYS false here
  // regardless of RULE 7 (this mission also has no Done-means at all, so RULE 4 always fires
  // independently) — checking .ok made the test fail unconditionally, masking whether RULE 7
  // itself behaved correctly. Check for the ABSENCE of the specific rule instead.
  const visualQcNoDoneMeans = 'MISSION: x\nVISUAL-QC-REQUIRED\nMaqsad: verify UI.';
  ck(!lintMission(visualQcNoDoneMeans).problems.some((p) => p.rule === 'visual-qc-without-render-done-means'), 'RULE 7: VISUAL-QC-REQUIRED header without Done-means clause does not trigger visual-qc-without-render-done-means');

  // ---- RULE 8: DEPLOY WITHOUT COMMIT (2026-06-30, MT_ATTRIB_FIX6 receipt; restored after a
  // live chain run deleted it while adding RULE 7 above) ----
  // a wrangler pages deploy with no git commit anywhere -> refused.
  const deployNoCommit = 'MISSION-CLASS: ops-deploy\nMISSION-ID: X\nREPO-ROOT: C:\\proj\\x\nMaqsad: ship it. Done means: live.\n```pwsh\nwrangler pages deploy . --project-name=x\n```';
  const dnc = lintMission(deployNoCommit);
  ck(!dnc.ok && dnc.problems.some((p) => p.rule === 'deploy-without-commit'), 'RULE 8: wrangler pages deploy with NO git commit anywhere REFUSED (the exact MT_ATTRIB_FIX6 failure shape)');

  // `wrangler deploy` (bare worker deploy, no "pages") with no commit -> also refused.
  const workerDeployNoCommit = 'MISSION-CLASS: ops-deploy\nMISSION-ID: X\nREPO-ROOT: C:\\proj\\x\nMaqsad: ship a worker. Done means: live.\n```pwsh\nwrangler deploy -c wrangler.toml\n```';
  ck(!lintMission(workerDeployNoCommit).ok && lintMission(workerDeployNoCommit).problems.some((p) => p.rule === 'deploy-without-commit'), 'RULE 8: bare "wrangler deploy" (worker, no "pages") with no commit ALSO refused');

  // a deploy PAIRED with a git commit step -> passes (the fix this rule asks for).
  const deployWithCommit = 'MISSION-CLASS: ops-deploy\nMISSION-ID: X\nREPO-ROOT: C:\\proj\\x\nMaqsad: ship it. Done means: live.\n```pwsh\ngit add .\ngit commit -m "ship the fix" --no-verify\nwrangler pages deploy . --project-name=x\n```';
  ck(lintMission(deployWithCommit).ok, 'RULE 8: wrangler deploy PAIRED with a git commit step passes — git and Cloudflare never diverge');

  // wrangler d1 execute (a DATA command, not a deploy) must NOT trip this rule even with
  // zero commits — it never bypasses git the way a pages/worker deploy does.
  const d1Mission = 'MISSION-CLASS: ops-deploy\nMISSION-ID: X\nREPO-ROOT: C:\\proj\\x\nMaqsad: load data. Done means: rows exist.\n```pwsh\nwrangler d1 execute mydb --remote --command "SELECT 1"\n```';
  ck(lintMission(d1Mission).ok, 'RULE 8: "wrangler d1 execute" is a data command, never flagged as a deploy-without-commit');

  // ---- RULE 9: HANDROLLED LOCALHOST PREVIEW (2026-07-03, trip-cost.S2 receipt) ----
  // the exact split-era shape: a step starting a localhost:8788 server, no wrangler deploy.
  const handrolled = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.html\nMaqsad: verify. Steps: 12. Start a local static/functions preview server bound to PREVIEW-BASE-URL\'s port (localhost:8788). Done means: rendered headless via playwright.';
  const hr = lintMission(handrolled);
  ck(!hr.ok && hr.problems.some((p) => p.rule === 'handrolled-localhost-preview'), 'RULE 9: hand-rolled localhost:8788 preview step REFUSED (the trip-cost.S2 FAILED x2 shape)');

  // the amended cure: mentions localhost:8788 only historically, carries the wrangler
  // deploy verb (+ git commit so RULE 8 stays satisfied) -> passes.
  const amendedCure = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nUNLINKED-OK: rule-9 fixture, reachability out of scope\nALLOW-FILES:\n  - a.html\nMaqsad: verify. Steps: 12. (amended: prior step hand-rolled a localhost:8788 server) git commit is upstream in S1; confirm clean then wrangler pages deploy . --project-name=muddytires --branch=preview, parse URL, render from it. git commit receipts named. Done means: rendered headless via playwright.';
  ck(lintMission(amendedCure).ok, 'RULE 9: the amended engine-native shape passes (localhost mention is historical, deploy verb present)');

  // "bound to PREVIEW-BASE-URL\'s port" phrasing without a literal localhost:8788 -> also refused.
  const portPhrase = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.html\nMaqsad: verify. Steps: 4. Start a server bound to PREVIEW-BASE-URL\'s port. Done means: rendered headless via playwright.';
  ck(!lintMission(portPhrase).ok && lintMission(portPhrase).problems.some((p) => p.rule === 'handrolled-localhost-preview'), 'RULE 9: the PREVIEW-BASE-URL-port phrasing is refused even without a literal localhost:8788');

  // ---- RULE 10: CROSS-STEP SCRATCH STATE (2026-07-03, trip-cost.S2 5th-run receipt) ----
  const crossStep = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.html\nMaqsad: x.\nSteps:\n  1. Deploy and write the URL to scratch-url.txt. [command]\n  2. Read scratch-url.txt and render from it. [verify]\nDone means: rendered headless via playwright; node runs the witness.';
  const cs = lintMission(crossStep);
  ck(!cs.ok && cs.problems.some((p) => p.rule === 'cross-step-scratch-state'), 'RULE 10: a scratch file spanning two steps is REFUSED (the vanishing cross-step state shape)');
  const oneStep = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nUNLINKED-OK: rule-10 fixture, reachability out of scope\nALLOW-FILES:\n  - a.html\nMaqsad: x.\nSteps:\n  1. In ONE command: deploy, capture the URL in a variable, write scratch-qc.mjs, node scratch-qc.mjs, remove it. [command]\nDone means: rendered headless via playwright.';
  ck(lintMission(oneStep).ok, 'RULE 10: create-use-delete inside ONE step passes');

  // ---- RULE 11: GREP-ONLY VISUAL VERIFICATION (2026-07-03, mobile-qc.S1.S1 panel F1) ----
  const grepOnly = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - s.mjs\nVISUAL-QC-REQUIRED\nMaqsad: extend the QC script.\nSteps:\n  1. Edit s.mjs. [edit] s.mjs\n  2. Verify s.mjs contains the new matrix via Select-String. [verify]\nDone means: rendered headless via playwright.';
  const go = lintMission(grepOnly);
  ck(!go.ok && go.problems.some((p) => p.rule === 'grep-only-visual-verification'), 'RULE 11: VISUAL mission with no executing step REFUSED (the zero-browser-execution panel receipt)');

  // ---- RULE 12: ORPHAN PAGE (2026-07-03, trip-cost live-but-unlinked receipt) ----
  const orphan = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - trip-cost.html\n  - js/trip.js\nMaqsad: ship the planner page. Done means: page renders 200.\nSteps:\n  1. author page [edit]\n';
  const ro = lintMission(orphan);
  ck(!ro.ok && ro.problems.some((p) => p.rule === 'orphan-page-no-reachability'), 'RULE 12: standalone page with no reachability intent REFUSED (trip-cost orphan class)');
  ck(lintMission(orphan + '  2. add the nav link on index.html; evidence NAV_LINK=present [command]\n').ok, 'RULE 12: page mission WITH a nav-link step passes');
  ck(lintMission('UNLINKED-OK: direct-URL tool page by design\n' + orphan).ok, 'RULE 12: explicit UNLINKED-OK declaration passes (author checked)');
  ck(lintMission('MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - map.html\nMaqsad: t. Done means: t.\nSteps:\n  1. edit [edit]\n').ok, 'RULE 12: entry-surface (map.html) edits are exempt — no false positive on the dominant mission class');
  const withRun = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - s.mjs\nVISUAL-QC-REQUIRED\nMaqsad: extend the QC script.\nSteps:\n  1. Edit s.mjs. [edit] s.mjs\n  2. Run it: node s.mjs and require coverage receipts. [command]\nDone means: rendered headless via playwright.';
  ck(lintMission(withRun).ok, 'RULE 11: VISUAL mission WITH an executing step passes');

  // ---- RULE 13: DESIGN PASS WITHOUT CONTRACT (QUEUE item 21; atv-11 phone verdict "why is
  // it so visually bad?" vs the atv-12-design-to-contract cure, 2026-07-11) ----
  // (a) the ORIGINAL atv-11 shape: stylesheet-rewrite language + css target, no DESIGN.md -> refused.
  const designPass = 'MISSION-CLASS: code-repo\nMISSION-ID: ATV-11-DESIGN-PASS\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - public/style.css\n  - public/index.html\nMaqsad: the hand-styled design pass — deliver a real design system in style.css.\nSteps:\n  1. Rewrite public/style.css into the full design system (typography scale, spacing scale, color system). [edit] public/style.css\n  2. Add the classes/wrappers the stylesheet needs to index.html, zero copy changes. [edit] public/index.html\nDone means: the homepage reads as a designed site, not a rendered markdown document.';
  const dp = lintMission(designPass);
  ck(!dp.ok && dp.problems.some((p) => p.rule === 'design-pass-without-contract'), 'RULE 13: stylesheet-rewrite design pass bound to NO contract REFUSED (the original atv-11 shape)');

  // (b) the atv-12 shape: same css rewrite but names DESIGN.md as the binding spec -> passes.
  const designToContract = 'MISSION-CLASS: code-repo\nMISSION-ID: ATV-12-DESIGN-TO-CONTRACT\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - public/assets/style.css\n  - public/index.html\nVISUAL-QC-REQUIRED\nMaqsad: implement DESIGN.md — the BINDING design contract; where this mission text and DESIGN.md disagree, DESIGN.md wins.\nSteps:\n  1. Rewrite public/assets/style.css to the contract, section by section. [edit] public/assets/style.css\n  2. In ONE command: write scratch-witness.mjs (puppeteer render of the homepage against the contract), node scratch-witness.mjs, then Remove-Item it. [command]\nDone means: the homepage renders to the DESIGN.md contract — verified by headless-browser render, not by reading the code.';
  ck(lintMission(designToContract).ok, 'RULE 13: design pass bound to DESIGN.md passes (the atv-12-design-to-contract shape)');

  // (c) the integrate class: VISUAL-QC-REQUIRED + render witness, ZERO design-pass language,
  // no css target — the flag is carried by dozens of integrate missions and never triggers.
  const integrateVisual = 'MISSION-CLASS: code-repo\nMISSION-ID: MT-INTEGRATE-TESTIMONIALS.S1\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - index.html\n  - build-testimonials.mjs\nVISUAL-QC-REQUIRED\nMaqsad: cherry-pick the testimonials commit onto main and finalize it with a clean tree.\nSteps:\n  1. Cherry-pick the commit introducing build-testimonials.mjs and the index.html testimonials section; git commit the resolution. [command]\n  2. In ONE command: wrangler pages deploy . --branch=preview, capture the emitted URL, write scratch-qc.mjs (playwright render of the testimonials section), node scratch-qc.mjs, then Remove-Item it. [command]\nDone means: index.html updated as specified — verify by headless-browser render, not by reading the code.';
  ck(lintMission(integrateVisual).ok, 'RULE 13: integrate mission with VISUAL-QC-REQUIRED + render witness but NO design-pass language passes (mt-integrate-testimonials class — the flag alone never triggers)');

  // (d) the mt-copy-clarity class: a COPY rewrite touching html only — "rewrite the offending
  // strings" is not design-pass language and no .css is targeted.
  const copyClarity = 'MISSION-CLASS: code-repo\nMISSION-ID: mt-copy-clarity.S1\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - index.html\n  - map.html\nVISUAL-QC-REQUIRED\nMaqsad: run every user-facing string through a reading-grade check; rewrite the offending strings to plain language at grade 6 or below without weakening the trust claims.\nSteps:\n  1. Rewrite the offending strings in index.html and map.html to plain language. [edit] index.html\n  2. In ONE command: write scratch-copy-grade.mjs (grade every extracted string), node scratch-copy-grade.mjs, require COPY_CLARITY_OK, then Remove-Item it. [verify]\nDone means: every user-facing copy string at grade <=8 proven by the grader AND the headless-browser render of the landing page shows the rewritten hero copy intact.';
  ck(lintMission(copyClarity).ok, 'RULE 13: copy-clarity rewrite (html targets, no stylesheet rewrite) passes (mt-copy-clarity.S1 class — a copy pass is not a design pass)');

  // ---- RULE 14: CONTENT PASS WITHOUT CONTRACT (QUEUE item 26 / gap-seo-cro-copy-contract;
  // operator-shared SEO & CRO Voice playbook 2026-07-12 — atv's "clean but invisible"
  // headings vs the CONTENT-CONTRACT.md cure, same trigger discipline as RULE 13) ----
  // (a) the atv-14 shape: SEO/heading/meta rewrite language + .html targets, no contract -> refused.
  const contentPass = 'MISSION-CLASS: code-repo\nMISSION-ID: ATV-14-HEADING-SEO-PASS\nREPO-ROOT: C:/proj/x\nALLOW-FILES:\n  - index.html\n  - map.html\nMaqsad: the SEO copy pass — rewrite the homepage and hub headings with keyword-injected H1s and fresh meta descriptions.\nSteps:\n  1. Rewrite the h1/h2 headings on index.html and map.html per the heading formula; rewrite the meta description tags. [edit] index.html\nDone means: headings read with intent modifiers and meta descriptions are present, not the clean-but-invisible defaults.';
  const cp = lintMission(contentPass);
  ck(!cp.ok && cp.problems.some((p) => p.rule === 'content-pass-without-contract'), 'RULE 14: SEO/heading/meta copy-pass language + .html targets bound to NO contract REFUSED (the atv "clean but invisible" shape)');

  // (b) the atv-15 shape: same copy pass but names CONTENT-CONTRACT.md as the binding spec -> passes.
  const contentToContract = 'MISSION-CLASS: code-repo\nMISSION-ID: ATV-15-CONTENT-TO-CONTRACT\nREPO-ROOT: C:/proj/x\nALLOW-FILES:\n  - index.html\n  - map.html\nMaqsad: implement CONTENT-CONTRACT.md — the BINDING content contract; where this mission text and CONTENT-CONTRACT.md disagree, CONTENT-CONTRACT.md wins.\nSteps:\n  1. Rewrite the h1/h2 headings and meta description tags on index.html and map.html to the contract\'s H1 formula and niche modifiers. [edit] index.html\n  2. In ONE command: write scratch-copy-witness.mjs (grep for generic headings/brand-only H1, title<=60, meta<=160), node scratch-copy-witness.mjs, require COPY_WITNESS_OK, then remove it. [command]\nDone means: the homepage and hub headings match the CONTENT-CONTRACT.md formula, proven by the copy witness script\'s COPY_WITNESS_OK receipt.';
  ck(lintMission(contentToContract).ok, 'RULE 14: copy pass bound to CONTENT-CONTRACT.md passes (the atv-15-content-to-contract shape)');

  // (c) the integrate class (reusing RULE 13's own fixture): zero copy/content/heading/meta
  // rewrite language — the flag never trips it even though it touches index.html.
  ck(!lintMission(integrateVisual).problems.some((p) => p.rule === 'content-pass-without-contract'), 'RULE 14: integrate mission (mt-integrate-testimonials class) with no copy-pass language never triggers content-pass-without-contract');

  // (d) the mt-copy-clarity class (reusing RULE 13's own fixture): a READABILITY rewrite
  // is not an SEO/heading/meta semantics pass — the gap this rule closes is a provably
  // distinct concern (mt-copy-clarity grades reading level; it never touched SEO).
  ck(!lintMission(copyClarity).problems.some((p) => p.rule === 'content-pass-without-contract'), 'RULE 14: readability-only copy-clarity rewrite (mt-copy-clarity class) never triggers content-pass-without-contract — a readability pass is not an SEO semantics pass');

  // RULE 15: BARE COMMIT WITHOUT PATHSPEC (gap-bare-commit-sweeps-preexisting-stage, 2026-07-13)
  const bareCommitCodeRepo = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.mjs\nMaqsad: fix a. Done means: node -c passes.\n```pwsh\ngit add -- a.mjs\ngit commit -m "fix a"\n```';
  ck(!lintMission(bareCommitCodeRepo).ok && lintMission(bareCommitCodeRepo).problems.some((p) => p.rule === 'bare-commit-no-pathspec'), 'RULE 15: a code-repo mission with a BARE `git commit -m` (no pathspec) is REFUSED (the exact commit-7e0a011 failure shape)');
  const scopedCommitCodeRepo = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.mjs\nMaqsad: fix a. Done means: node -c passes.\n```pwsh\ngit add -- a.mjs\ngit commit -- a.mjs -m "fix a"\n```';
  ck(lintMission(scopedCommitCodeRepo).ok, 'RULE 15: a code-repo mission with an EXPLICITLY SCOPED `git commit -- <files> -m` passes — the fix this rule asks for');
  const scopedCommitFlagsFirst = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.mjs\nMaqsad: fix a. Done means: node -c passes.\n```pwsh\ngit add -- a.mjs\ngit commit -m "fix a" -- a.mjs\n```';
  ck(lintMission(scopedCommitFlagsFirst).ok, 'RULE 15: the flags-then-pathspec ordering (git commit -m "..." -- <files>) — the syntactically CORRECT one — also passes (gap-mission-lint-rule15-wrong-pathspec-order)');
  ck(lintMission(deployWithCommit).ok, 'RULE 15: an ops-deploy mission with a bare commit is UNAFFECTED — the rule is scoped to code-repo\'s git_steps.mjs sandbox risk model, not a blanket ban on bare commits everywhere');
  const noCommitCodeRepo = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.mjs\nMaqsad: check a. Done means: node -c passes.\n```pwsh\nnode -c a.mjs\n```';
  ck(lintMission(noCommitCodeRepo).ok, 'RULE 15: a code-repo mission with NO commit step at all is unaffected — the rule only fires on a bare commit, never on the absence of one');

  // ---- RULE 16: IMPROVISE-BAIT -- [command]/[verify] script/witness step with no
  // literal payload (N5 item 12 prep, 2026-07-15 receipts: playwright require()-in-
  // .mjs, og-meta single-substring witness, 3x verify-polarity inversions) ----
  // (a) a Run-exactly step (script-intent-gated via the node/.mjs mention) passes.
  const runExactlyStep = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - a.mjs\nMaqsad: fix a. Done means: node -c passes.\nSteps:\n  1. Run exactly: node scratch-checks.mjs to verify og:image tag set is complete. [verify]\n';
  ck(lintMission(runExactlyStep).ok, 'RULE 16: a [verify] step carrying "Run exactly:" passes (the mt-lane-fix-s2 convention)');

  // (b) a committed-script step (node <ALLOW-FILES entry>, non-scratch path) passes.
  const committedScriptStep = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - tools/og-check.mjs\nMaqsad: witness it. Done means: node -c passes.\nSteps:\n  1. Execute the committed witness: node tools/og-check.mjs and require QC_OK. [command]\n';
  ck(lintMission(committedScriptStep).ok, 'RULE 16: a [command] step invoking node on a script already declared in ALLOW-FILES passes (the pure-text "file exists" proxy)');

  // (c) a prose-only script-intent step (describes work, carries no literal payload,
  // no scratch-idiom either) fails -- the exact og-meta single-substring-witness shape.
  const proseOnlyStep = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - index.html\nMaqsad: wire the OG tags. Done means: og:image present.\nSteps:\n  1. Write a small script that checks the page has the right og meta tags and run it. [verify]\n';
  const pos = lintMission(proseOnlyStep);
  ck(!pos.ok && pos.problems.some((p) => p.rule === 'improvise-bait'), 'RULE 16: a prose-only script-intent [verify] step ("write a small script that checks...") REFUSED — the og-meta single-substring-witness receipt shape');

  // (d) an [edit] step is exempt even with zero literal-payload markers.
  const editStepOnly = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - index.html\nMaqsad: restyle it. Done means: index.html updated.\nSteps:\n  1. Rewrite the hero section copy to match the new brand voice. [edit] index.html\n';
  ck(lintMission(editStepOnly).ok, 'RULE 16: an [edit] step is exempt from the literal-payload requirement (never mechanical in this sense)');

  // (e) out-of-gate plain command: no script/witness/node/.mjs signal at all -- RULE
  // 12's own nav-link fixture shape -- is out of RULE 16's scope entirely (nothing to
  // improvise; no receipt names this class). Proves the gate, not just the proofs.
  const plainCommandStep = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nUNLINKED-OK: rule-16 fixture, reachability out of scope\nALLOW-FILES:\n  - index.html\nMaqsad: link the page. Done means: page is reachable.\nSteps:\n  1. add the nav link on index.html; evidence NAV_LINK=present [command]\n';
  ck(lintMission(plainCommandStep).ok, 'RULE 16: a plain command step with no script/witness/node signal is out of scope entirely (RULE 12 nav-link-step shape) — never flagged improvise-bait');

  // (f) RULE 10's own scratch create-use-delete-in-one-step idiom passes (proof d) —
  // the exact shape RULE 13b/13c/13d, RULE 14b, and mt-lane-fix-s2 step 5 all use in
  // production; RULE 16 must not re-litigate what RULE 10 already governs.
  const scratchIdiomStep = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nUNLINKED-OK: rule-16 fixture, reachability out of scope\nALLOW-FILES:\n  - a.html\nMaqsad: witness it.\nSteps:\n  1. In ONE command: write scratch-witness.mjs (render check), node scratch-witness.mjs, then Remove-Item it. [command]\nDone means: rendered headless via playwright.\n';
  ck(lintMission(scratchIdiomStep).ok, 'RULE 16: the write-scratch-X/node-scratch-X-in-one-step idiom passes (RULE 10\'s own blessed create-use-delete shape, proof d)');

  // (g) the atv fenced command_queue.mjs jurisdiction: a gated [verify] step with no
  // inline literal marker still passes because the mission carries a fenced pwsh block
  // elsewhere (the literal payload lives in the fence, not inline).
  const fencedJurisdictionStep = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - index.html\nMaqsad: wire it. Done means: og:image present.\nSteps:\n  1. Confirm the witness script printed OG-WIRED as specified above. [verify]\n\n```pwsh\n$p = \'index.html\'; Write-Output OG-WIRED\n```\n';
  ck(lintMission(fencedJurisdictionStep).ok, 'RULE 16: a gated step with no inline literal marker passes when the mission carries a fenced shell block (atv command_queue.mjs jurisdiction convention)');

  // (h) an explicit LITERAL ... PINNED declaration on a gated step line is a manual
  // escape hatch (mirrors RULE 12's UNLINKED-OK) even with none of the four proofs.
  const literalPinnedStep = 'MISSION-CLASS: code-repo\nREPO-ROOT: C:\\proj\\x\nALLOW-FILES:\n  - index.html\nMaqsad: wire it. Done means: og:image present.\nSteps:\n  1. Write scratch-og.mjs setting the meta content to the LITERAL value PINNED in the mission provenance note above; run it. [command]\n';
  ck(lintMission(literalPinnedStep).ok, 'RULE 16: a step declaring LITERAL ... PINNED is exempt (explicit author declaration, RULE 12 UNLINKED-OK precedent)');

  // (i) non-code-repo missions are never checked (the class this rule is scoped to).
  const nonCodeRepoProse = 'Maqsad: research. Done means: report.md exists.\nSteps:\n  1. Write a small script that checks the report is complete. [verify]\n';
  ck(!lintMission(nonCodeRepoProse).problems.some((p) => p.rule === 'improvise-bait'), 'RULE 16: a non-code-repo (research-class) mission never triggers improvise-bait, regardless of step wording');

  console.log(`\n${fail ? fail + ' FAIL' : 'ALL PASS — mission miqat: flawed work orders refused at the boundary, zero cycles burned'}`);
  process.exit(fail ? 1 : 0);
}

