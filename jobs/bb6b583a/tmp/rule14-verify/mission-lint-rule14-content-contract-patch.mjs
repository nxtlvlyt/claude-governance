#!/usr/bin/env node
// mission-lint-rule14-content-contract-patch.mjs — one-shot patcher adding RULE 14 to
// mission_lint.mjs (gap-seo-cro-copy-contract, QUEUE item 26 sub-part (b), 2026-07-12).
// Committed as a mission input artifact per the srcsha-anchor-patch / heal-selftest-race
// precedent: literal scripted precision, never an LLM edit-step on a multi-region change.
// Idempotent: exits 0 with ALREADY-PATCHED if RULE 14 is already present.
//
// What RULE 14 closes (QUEUE item 26, operator-shared SEO & CRO Voice playbook,
// 2026-07-12): mt-copy-clarity grades readability (Flesch-Kincaid <=8) but nothing
// mechanical enforces SEO semantics — the atv homepage h1 and hub headings are exactly
// the "clean but invisible" class the playbook names. The DESIGN.md arc already proved
// the cure shape (RULE 13): prose taste fails, a CONTRACT with mechanical gates works.
// RULE 14 mirrors RULE 13's exact trigger discipline (semantics + target, never a bare
// tag) for the copy/content side, binding to a new CONTENT-CONTRACT.md file instead of
// DESIGN.md.
import { readFileSync, writeFileSync } from 'fs';

const path = 'mission_lint.mjs';
let t = readFileSync(path, 'utf8');

if (t.includes('RULE 14 — CONTENT PASS WITHOUT CONTRACT')) {
  console.log('ALREADY-PATCHED');
  process.exit(0);
}

const edits = [
  // Edit 1: insert the RULE 14 logic block right after RULE 13's closing brace, before
  // the function's return statement.
  {
    old: String.raw`  }

  return { ok: problems.length === 0, problems };
}`,
    new: String.raw`  }

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

  return { ok: problems.length === 0, problems };
}`,
  },
  // Edit 2: insert the RULE 14 selftest fixtures right after RULE 13's last assertion
  // (the copyClarity ck() line), reusing RULE 13's own integrateVisual + copyClarity
  // fixtures to prove RULE 14 shares the same two false-positive guards.
  {
    old: String.raw`  ck(lintMission(copyClarity).ok, 'RULE 13: copy-clarity rewrite (html targets, no stylesheet rewrite) passes (mt-copy-clarity.S1 class — a copy pass is not a design pass)');`,
    new: String.raw`  ck(lintMission(copyClarity).ok, 'RULE 13: copy-clarity rewrite (html targets, no stylesheet rewrite) passes (mt-copy-clarity.S1 class — a copy pass is not a design pass)');

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
  ck(!lintMission(copyClarity).problems.some((p) => p.rule === 'content-pass-without-contract'), 'RULE 14: readability-only copy-clarity rewrite (mt-copy-clarity class) never triggers content-pass-without-contract — a readability pass is not an SEO semantics pass');`,
  },
];

for (const [i, e] of edits.entries()) {
  const n = t.split(e.old).length - 1;
  if (n !== 1) {
    console.error(`EDIT-${i}-NOT-UNIQUE: found ${n} occurrences of anchor (expected exactly 1)`);
    process.exit(1);
  }
  t = t.replace(e.old, e.new);
}

writeFileSync(path, t);
console.log('PATCHED');