// copy_witness.mjs -- mechanical enforcement of CONTENT-CONTRACT.md's heading/meta bans
// (QUEUE item 26 / gap-seo-cro-copy-contract). Cheap, regex-based, no DOM dependency --
// matches the repo's existing witness-script convention (searxng_preflight.mjs).
//
// Checks (per CONTENT-CONTRACT.md, both androidtv-tips and Muddy Tires variants):
//   1. Banned generic headings (About Us/Our Services/Testimonials/Welcome/Contact/Home)
//      as h1/h2/h3, case-insensitive, matched against the FULL trimmed heading text.
//   2. Brand-only H1 -- h1 text exactly equals a known brand name (site-specific list).
//   3. Single-word h2/h3 section headings (excluding a short allowlist of legitimate
//      one-word headings like "FAQ", "FAQs").
//   4. <title> present and <= 60 characters.
//   5. <meta name="description"> present and <= 160 characters.
//
// This is a WITNESS, not a full HTML parser -- regex-based extraction is intentional
// (matches the "cheap, mechanical" requirement in QUEUE item 26 part (c)); it will not
// catch headings built dynamically via JS, only literal markup in the file.

const BANNED_HEADING_PHRASES = ['about us', 'our services', 'testimonials', 'welcome', 'contact', 'home'];
const SINGLE_WORD_ALLOWLIST = ['faq', 'faqs'];

function extractHeadings(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    out.push(text);
  }
  return out;
}

function extractTitle(html) {
  const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

function extractMetaDescription(html) {
  const m = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)
    || /<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i.exec(html);
  return m ? m[1].trim() : null;
}

// checkCopyWitness -- the exported check. opts.brandNames: array of exact brand strings
// that make an h1 "brand-only" if matched case-insensitively. Returns { ok, violations }.
export function checkCopyWitness(html, opts = {}) {
  const brandNames = (opts.brandNames || []).map((b) => b.toLowerCase());
  const violations = [];

  const h1s = extractHeadings(html, 'h1');
  const h2s = extractHeadings(html, 'h2');
  const h3s = extractHeadings(html, 'h3');
  const allHeadings = [...h1s.map((t) => ['h1', t]), ...h2s.map((t) => ['h2', t]), ...h3s.map((t) => ['h3', t])];

  for (const [tag, text] of allHeadings) {
    const lower = text.toLowerCase();
    if (BANNED_HEADING_PHRASES.includes(lower)) {
      violations.push({ kind: 'banned-generic-heading', tag, text });
    }
  }

  for (const text of h1s) {
    if (brandNames.includes(text.toLowerCase())) {
      violations.push({ kind: 'brand-only-h1', tag: 'h1', text });
    }
  }

  for (const [tag, text] of [...h2s.map((t) => ['h2', t]), ...h3s.map((t) => ['h3', t])]) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1 && !SINGLE_WORD_ALLOWLIST.includes(text.toLowerCase())) {
      violations.push({ kind: 'single-word-heading', tag, text });
    }
  }

  const title = extractTitle(html);
  if (!title) {
    violations.push({ kind: 'title-missing' });
  } else if (title.length > 60) {
    violations.push({ kind: 'title-too-long', length: title.length, text: title });
  }

  const desc = extractMetaDescription(html);
  if (!desc) {
    violations.push({ kind: 'meta-description-missing' });
  } else if (desc.length > 160) {
    violations.push({ kind: 'meta-description-too-long', length: desc.length, text: desc });
  }

  return { ok: violations.length === 0, violations };
}

// ------------------------------------------------------------------------- CLI
// node copy_witness.mjs <file.html> [--brand "Site Name"]...
// Bare `node copy_witness.mjs` (no file argument) runs the offline selftest instead of
// erroring -- matches the repo's muezzin-gate pre-commit self-test convention, which
// invokes every new/modified top-level .mjs file with zero arguments and expects exit 0.
if (process.argv[1]?.endsWith('copy_witness.mjs') && !process.argv.includes('--selftest') && process.argv.length > 2) {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const brandNames = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--brand' && args[i + 1]) { brandNames.push(args[i + 1]); i++; }
  }
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(filePath, 'utf8');
  const { ok, violations } = checkCopyWitness(html, { brandNames });
  if (ok) {
    console.log(`PASS  ${filePath}  (0 violations)`);
    process.exit(0);
  }
  console.log(`FAIL  ${filePath}  (${violations.length} violation(s))`);
  for (const v of violations) console.log(`  - ${v.kind}${v.text ? `: "${v.text}"` : ''}${v.length ? ` (${v.length} chars)` : ''}`);
  process.exit(1);
}

// -------------------------------------------------------------- OFFLINE selftest
if (process.argv[1]?.endsWith('copy_witness.mjs') && process.argv.includes('--selftest')) {
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) console.log(`    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
    ok ? pass++ : fail++;
  };
  const checkTrue = (name, cond) => {
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`);
    cond ? pass++ : fail++;
  };

  console.log('[selftest] copy_witness.mjs\n');

  // ---- clean page: no violations ----
  {
    const html = `<html><head><title>Free Camping Near Banff (2026)</title>
<meta name="description" content="A short, useful description of camping near Banff National Park, under 160 characters total for this test fixture."></head>
<body><h1>Free Camping Near Banff National Park (2026)</h1>
<h2>Bear Safety in Backcountry Areas</h2>
<h3>Frequently Asked Questions</h3></body></html>`;
    const r = checkCopyWitness(html, { brandNames: ['Muddy Tires'] });
    checkTrue('clean page passes with zero violations', r.ok === true && r.violations.length === 0);
  }

  // ---- banned generic heading ----
  {
    const html = `<html><head><title>T</title><meta name="description" content="d"></head><body><h1>About Us</h1></body></html>`;
    const r = checkCopyWitness(html);
    checkTrue('"About Us" as h1 is flagged banned-generic-heading', r.violations.some((v) => v.kind === 'banned-generic-heading' && v.text === 'About Us'));
  }
  {
    const html = `<html><head><title>T</title><meta name="description" content="d"></head><body><h1>Real Heading</h1><h2>Our Services</h2></body></html>`;
    const r = checkCopyWitness(html);
    checkTrue('"Our Services" as h2 is also flagged (not just h1)', r.violations.some((v) => v.kind === 'banned-generic-heading' && v.tag === 'h2'));
  }

  // ---- brand-only H1 ----
  {
    const html = `<html><head><title>T</title><meta name="description" content="d"></head><body><h1>Muddy Tires</h1></body></html>`;
    const r = checkCopyWitness(html, { brandNames: ['Muddy Tires'] });
    checkTrue('brand-name-only h1 is flagged brand-only-h1', r.violations.some((v) => v.kind === 'brand-only-h1'));
  }
  {
    const html = `<html><head><title>T</title><meta name="description" content="d"></head><body><h1>Muddy Tires Trail Guides</h1></body></html>`;
    const r = checkCopyWitness(html, { brandNames: ['Muddy Tires'] });
    checkTrue('brand name AS PART OF a real h1 is NOT flagged (only exact match)', !r.violations.some((v) => v.kind === 'brand-only-h1'));
  }

  // ---- single-word heading ----
  {
    const html = `<html><head><title>T</title><meta name="description" content="d"></head><body><h1>Real</h1><h2>Tips</h2></body></html>`;
    const r = checkCopyWitness(html);
    checkTrue('single-word h2 is flagged single-word-heading', r.violations.some((v) => v.kind === 'single-word-heading' && v.text === 'Tips'));
  }
  {
    const html = `<html><head><title>T</title><meta name="description" content="d"></head><body><h1>Real</h1><h3>FAQ</h3></body></html>`;
    const r = checkCopyWitness(html);
    checkTrue('"FAQ" single-word heading is allowlisted, not flagged', !r.violations.some((v) => v.kind === 'single-word-heading'));
  }

  // ---- title length ----
  {
    const longTitle = 'A'.repeat(61);
    const html = `<html><head><title>${longTitle}</title><meta name="description" content="d"></head><body><h1>Real</h1></body></html>`;
    const r = checkCopyWitness(html);
    checkTrue('title over 60 chars is flagged title-too-long', r.violations.some((v) => v.kind === 'title-too-long' && v.length === 61));
  }
  {
    const html = `<html><head><meta name="description" content="d"></head><body><h1>Real</h1></body></html>`;
    const r = checkCopyWitness(html);
    checkTrue('missing title is flagged title-missing', r.violations.some((v) => v.kind === 'title-missing'));
  }

  // ---- meta description length ----
  {
    const longDesc = 'A'.repeat(161);
    const html = `<html><head><title>T</title><meta name="description" content="${longDesc}"></head><body><h1>Real</h1></body></html>`;
    const r = checkCopyWitness(html);
    checkTrue('meta description over 160 chars is flagged meta-description-too-long', r.violations.some((v) => v.kind === 'meta-description-too-long' && v.length === 161));
  }
  {
    const html = `<html><head><title>T</title></head><body><h1>Real</h1></body></html>`;
    const r = checkCopyWitness(html);
    checkTrue('missing meta description is flagged meta-description-missing', r.violations.some((v) => v.kind === 'meta-description-missing'));
  }

  // ---- attribute order doesn't break meta extraction ----
  {
    const html = `<html><head><title>T</title><meta content="d" name="description"></head><body><h1>Real</h1></body></html>`;
    const r = checkCopyWitness(html);
    checkTrue('meta description extraction works with content= before name=', !r.violations.some((v) => v.kind === 'meta-description-missing'));
  }

  console.log(`\n[selftest] ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
