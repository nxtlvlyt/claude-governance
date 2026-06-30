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

  console.log(`\n${fail ? fail + ' FAIL' : 'ALL PASS — mission miqat: flawed work orders refused at the boundary, zero cycles burned'}`);
  process.exit(fail ? 1 : 0);
}

