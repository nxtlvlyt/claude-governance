All anchors verified against a full read of the live file (matches the inventory byte-for-byte). One CONFIRMED finding beyond the inventory, receipted below (grep + full read): the stylesheet never sets `background`/`color` on `body` — the page canvas is currently UA-default dark via `color-scheme: dark`, not `--color-bg`. The restyle must bind the body to the tokens or #131313 never ships.

---

# EDIT SET — Luminous Dark values restyle of `C:\Users\marka\agy-muezzin\sites\androidtv-tips\public\assets\style.css`

Scope law applied: VALUES only (palette, typography, radii, shadows). No selector added or removed, no markup assumed changed, no spacing/margin/padding/grid values touched. All old_strings are byte-exact from the live file (LF endings; U+2013 `–` and U+2011 `‑` preserved where present). Every edit is unique-anchored — verified single-occurrence by full read.

## EDIT A — dark `:root` block (lines 4–37)

**old_string** (byte-exact, lines 4–37):

```css
:root {
  /* Color palette – dark mode by default */
  --color-bg: #0d1117;                     /* near-black page */
  --color-surface: #161b22;                /* one-step-lighter cards */
  --color-surface-2: #21262d;
  --color-text: #c9d1d9;
  --color-text-muted: #8b949e;
  --color-border: #30363d;
  --color-border-strong: #444c56;
  --color-accent: #58a6ff;                 /* single accent */
  --color-accent-strong: #1f7dc0;

  /* Layout */
  --container-max: 720px;                 /* max-width of content column */
  --container-narrow: 720px;              /* for narrow containers (same as default) */
  --gutter-inline: 20px;                  /* gutter width on all sides */
  --space-2: .5rem;
  --space-3: .75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;

  /* Typography */
  --font-sans: system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", Roboto,
    Helvetica Neue, Arial, sans-serif;

  /* Radii */
  --radius: 6px;
  --radius-lg: 10px;                      /* used for cards & buttons */
}
```

**new_string:**

```css
:root {
  /* Color palette – dark mode by default */
  --color-bg: #131313;                     /* near-black page */
  --color-surface: #1A1A1A;                /* one-step-lighter cards */
  --color-surface-2: #2a2a2a;
  --color-text: #e5e2e1;
  --color-text-muted: rgba(255, 255, 255, 0.7);
  --color-border: rgba(255, 255, 255, 0.1);
  --color-border-strong: #3d4a3f;
  --color-accent: #60f59b;                 /* single accent */
  --color-accent-strong: #3dd881;

  /* Layout */
  --container-max: 720px;                 /* max-width of content column */
  --container-narrow: 720px;              /* for narrow containers (same as default) */
  --gutter-inline: 20px;                  /* gutter width on all sides */
  --space-2: .5rem;
  --space-3: .75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", Roboto,
    Helvetica Neue, Arial, sans-serif;

  /* Radii */
  --radius: 8px;
  --radius-sm: 4px;
  --radius-lg: 12px;                      /* used for cards & buttons */

  /* Shadows – derived: reference specifies prose only ("very subtle black glow"), no numeric tokens exist */
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 14px rgba(0, 0, 0, 0.3);
  --shadow-card-hover: 0 2px 4px rgba(0, 0, 0, 0.5), 0 8px 20px rgba(0, 0, 0, 0.4);
}
```

**Mapping justifications (non-obvious ones):**

| Property | Value | Reference role | Note |
|---|---|---|---|
| `--color-bg` | `#131313` | background/surface | Discrepancy resolved per reference doc's own note: JSON prose says #0F0F0F but namedColors + shipped homepage body use #131313 — "**#131313 is what ships**". |
| `--color-surface` | `#1A1A1A` | surface-card | Uppercase preserved byte-exact from reference. |
| `--color-surface-2` | `#2a2a2a` | surface-container-high | No direct "surface-2" role exists; current usage (.prose code/pre bg, tbody hover, .chip bg) needs a step above the card surface — surface-container-high is the Material token one visible step above #1A1A1A. Confidence 0.8 (alternative: surface-container #201f1f, too close to card to read as a step). |
| `--color-text-muted` | `rgba(255, 255, 255, 0.7)` | text-muted | Exact token. Flows into `.card-desc` untouched, satisfying contract "~70% opacity equivalent" literally. |
| `--color-border` | `rgba(255, 255, 255, 0.1)` | border-subtle | Exact token; reference mandates it as the 1px border on all cards/interactive containers. |
| `--color-border-strong` | `#3d4a3f` | outline-variant | Reference defines no "strong border" role. Used only on form inputs and secondary buttons. outline-variant is byte-exact from namedColors and is measurably one step brighter than border-subtle composited on #131313 (≈#2b2b2b), keeping the green-tinted-neutral language. Confidence 0.75; named alternative: `outline` #869487 (Material's text-field role, but far more prominent than anything in the shipped homepage). |
| `--color-accent` | `#60f59b` | primary | Links, nav hover, focus — flows through all existing `var(--color-accent)` uses including `:focus-visible`. |
| `--color-accent-strong` | `#3dd881` | primary-container / brand seed | Reference table's "Accent-strong". Used on .btn-primary hover: darkens from #60f59b, same direction as the old blue pair. |
| `--font-sans` | `'Inter', system-ui, …` | Inter | Reference typeface is Inter via Google Fonts, but the zero-external-requests law is explicitly NOT overridden by V3. Local-first `'Inter',` costs zero requests and honors the reference where Inter is installed; system stack remains the guaranteed fallback (contract v1 "system font stack" survives as the fallback chain). |
| `--radius` | `8px` | rounded DEFAULT 0.5rem / ROUND_EIGHT | Buttons/inputs "8-10px" per reference component prose. |
| `--radius-sm` | `4px` | rounded sm 0.25rem | NEW property — repairs the inventory's confirmed defect (`.prose code` line 301 references `--radius-sm` which is defined nowhere, currently computing to 0). Fixing at the token layer means the defective usage line stays untouched. |
| `--radius-lg` | `12px` | cards 12px | Reference component spec + V2 taste both say 12px. |
| `--shadow-card(-hover)` | (values above) | "very subtle black glow", hover "intensifies slightly" | DERIVED — the reference doc states "No numeric shadow tokens exist in any of the three files". Values marked derived in the CSS comment itself. NEW properties; light block overrides them (EDIT B1). |

`--container-max` 720px and `--gutter-inline` 20px already equal the reference (container-max 720px, gutter 20px) — unchanged. `--space-*` ladder untouched (spacing out of scope).

## EDIT B1 — light-mode `:root` override (lines 519–535)

**old_string** (byte-exact; `‑` is U+2011):

```css
@media (prefers-color-scheme: light) {
  :root {
    --color-bg: #f2f3f5;            /* near‑white background */
    --color-surface: #ffffff;
    --color-surface-2: #edeef1;
    --color-text: #1d2128;          /* dark gray / near‑black */
    --color-text-muted: #636770;
    --color-border: #c8ccd4;
    --color-border-strong: #a5abba;
    --color-accent: #0366d6;        /* accessible blue for light mode */
    --color-accent-strong: #01408a;
  }

  body {
    color-scheme: light;
  }
}
```

**new_string:**

```css
@media (prefers-color-scheme: light) {
  :root {
    --color-bg: #ececec;            /* near‑white background */
    --color-surface: #e5e5e5;
    --color-surface-2: #d5d5d5;
    --color-text: #313030;          /* dark gray / near‑black */
    --color-text-muted: rgba(0, 0, 0, 0.7);
    --color-border: rgba(0, 0, 0, 0.1);
    --color-border-strong: rgba(0, 0, 0, 0.25);
    --color-accent: #006d3a;        /* accessible green for light mode */
    --color-accent-strong: #00592f;
    --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.1), 0 4px 14px rgba(0, 0, 0, 0.07);
    --shadow-card-hover: 0 2px 4px rgba(0, 0, 0, 0.14), 0 8px 20px rgba(0, 0, 0, 0.1);
  }

  body {
    color-scheme: light;
  }
}
```

**Justification:** Reference light mode is prose-only ("perfect inversion — near-white bg, cards one step darker (very light gray), near-black text; no light hex tokens defined"). Derivations, each named:
- `#ececec` / `#e5e5e5` / `#d5d5d5` = per-channel arithmetic inversions of #131313 / #1A1A1A / #2a2a2a. This deliberately FLIPS the current relationship (old light block had cards #ffffff LIGHTER than page #f2f3f5; reference prose says cards one step DARKER — reference wins per V3).
- `--color-text: #313030` = `inverse-on-surface` — byte-exact substrate token whose Material role is literally "text on inverse surface". 
- `--color-accent: #006d3a` = `inverse-primary` — byte-exact substrate token, Material's "primary on inverse surfaces"; #60f59b itself fails contrast on near-white. `--color-accent-strong: #00592f` = `on-primary-container`, the next darker green step (hover darkens, same direction as dark scheme).
- Muted/borders = alpha inversions of the dark tokens (chromatic channel-inversion would produce magenta from #3d4a3f, so border-strong uses neutral black alpha instead — derived, confidence 0.7).
- Shadow overrides implement the reference's "light mode: soft, low-opacity gray shadow".
- Satisfies V2 MUST #1 (complete inversion, no component stays dark) and V2 MUST #5 (title contrast via `--color-text` in both schemes), and removes the last blue accent so single-accent holds post-restyle.

## EDIT B2 — bind body to the palette + body-main typography (lines 40–43)

CONFIRMED defect (full read + grep receipts above): no rule anywhere sets `background: var(--color-bg)` or body `color`; grep for `--color-bg` usage shows only buttons/forms/skip-link. The page canvas is UA-default dark via `color-scheme`. Without this edit the served page background is whatever the browser picks, not #131313, and body text color is UA default, not #e5e2e1. Reference body base is `color: #e5e2e1; background: #131313`; reference body-main line-height 1.6 (contract agrees: "Body 1rem/1.6" — current base line-height is browser default, only `.prose` sets one).

**old_string:**

```css
body {
  font-family: var(--font-sans);
  color-scheme: dark;
}
```

**new_string:**

```css
body {
  font-family: var(--font-sans);
  color-scheme: dark;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
}
```

(Light mode keeps working: the light `:root` swaps the same tokens; the existing `body { color-scheme: light }` override survives untouched.)

## EDIT B3 — card radius literal (line 190)

Reference: cards 12px; contract V2 taste: 12px (so contract and reference agree — the "contract" comment stays true). `–` is U+2013.

**old_string:** `  border-radius: 10px;               /* contract – 10px radius */`
**new_string:** `  border-radius: 12px;               /* contract – 12px radius */`

(`padding: 18px` on the line above stays — reference card-padding is 18px, exact match.)

## EDIT B4 — card shadow + transition (line 195)

Reference: cards carry a soft shadow plus the 1px border; transition 150ms ease (current `.15s` already equals 150ms).

**old_string:** `  transition: border-color .15s ease, transform .15s ease;`
**new_string:**

```css
  box-shadow: var(--shadow-card);
  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
```

(Unique anchor — the `.btn` transition string at line 147 differs.)

## EDIT B5 — card hover shadow intensifies (lines 197–201)

Reference: "Hover/focus: card lifts translateY(-2px), shadow intensifies slightly". Lift and accent border already present — only the shadow is missing.

**old_string:**

```css
a.card:hover,
a.card:focus-visible {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}
```

**new_string:**

```css
a.card:hover,
a.card:focus-visible {
  border-color: var(--color-accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}
```

## EDIT B6 — hero h1 fluid clamp + tracking (line 119)

Reference headline-h1: `clamp(1.9rem, 6vw, 2.6rem)` / 700 / 1.1 / letter-spacing `-0.02em`. Current line-height 1.1 already matches (untouched); h1 element weight is 700 by default.

**old_string:** `  font-size: clamp(2rem,5vw,3rem);`
**new_string:**

```css
  font-size: clamp(1.9rem, 6vw, 2.6rem);
  letter-spacing: -0.02em;
```

## EDIT B7 — section h2 fluid token (lines 246–247)

Reference headline-h2: `clamp(1.25rem, 4vw, 1.75rem)` / 650 / 1.2. `.section-title` is the only declared h2-class size in the file. (Margins untouched — spacing out of scope; `.prose h2` declares no size, so there is no value there to restyle.)

**old_string:**

```css
.section-title {
  font-size: 1.75rem;
```

**new_string:**

```css
.section-title {
  font-size: clamp(1.25rem, 4vw, 1.75rem);
  font-weight: 650;
  line-height: 1.2;
```

(Weight 650 requires a variable font; Segoe UI Variable/SF/system stacks and locally-installed Inter all resolve it, and non-variable fallbacks round to 600/700 harmlessly.)

## EDIT B8 — card-title token (lines 223–226)

Reference card-title: 1.05rem / 600 / 1.3 — and contract v1 independently mandates "title 1.05rem/600 first line", yet no rule in the file declares it (latent contract gap). The existing `.card h2, .card h3` rule (comment: "Card title styling") is the declared home for it; `a.card` carries class `card`, so headings inside anchor-cards match. Confidence 0.7 that card titles are h2/h3 elements (the rule's existence and comment say so); if markup uses another element this edit is inert, not harmful.

**old_string:**

```css
.card h2,
.card h3 {
  margin-top: 0;
}
```

**new_string:**

```css
.card h2,
.card h3 {
  margin-top: 0;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
}
```

## EDIT B9 — prose line-height (line 266)

Reference body-main is 1.6; contract also says 1.6 ("paragraphs max 65ch measure, line-height 1.6"). Current 1.7 conflicts with both.

**old_string:** `  line-height: 1.7;`
**new_string:** `  line-height: 1.6;`

---

## (3) UNTOUCHED — must NOT change

- **`.card-desc` rule (lines 227–232)** — contract marker, byte-preserved including the `/* contract – muted typography */` comment. It becomes fully reference-conformant with zero edits: `.9rem` = label-muted 0.9rem, `margin-top: 6px` = reference's 6px, and color flows to `rgba(255, 255, 255, 0.7)` via EDIT A. Satisfies V2 MUST #4.
- **`ul.card-grid { list-style: none; padding-left: 0; }` (217–220)** — V2 MUST #3 / reference "no bullets ever".
- **`:focus-visible` outlines (46–49, 396–402)** — accessibility; 2px stays, color goes green via token.
- **`.visually-hidden` (429–439) and `.skip-link` (440–454)** — accessibility patterns.
- **`@media (prefers-reduced-motion: reduce)` (457–466)** — accessibility.
- **High-contrast title rule (507–516)** — V2 MUST #5; works in both schemes through `--color-text`.
- **`.prose code` line 301 (`var(--radius-sm)`)** — defect repaired at the token layer by EDIT A, not by touching the usage.
- **`.chip-accent` color-mix lines (380–382)** — token-driven (goes green automatically); the missing-space and `!important` bytes preserved exactly.
- **All spacing/layout**: `--space-*` ladder, container/gutter (already equal reference at 720px/20px), `.card-grid` minmax/gap, nav paddings 12px/8px, section paddings, hero paddings, `.chip` 999px, `.skip-link -999px`, the empty dark-scheme media placeholder, all section banners and Unicode comment bytes.
- **Deferred, explicitly NOT in this edit set** (need markup/pseudo-elements or external requests — outside a values restyle): nav hover 8px pill (needs padding + bg on hover state), the h2 `.section-rule` 32px accent underline (element/pseudo-element addition; when built, use the shipped-HTML variant `rgba(96, 245, 155, 0.4)` per the reference's own discrepancy note), Google Fonts Inter / Material Symbols loading (barred by zero-external-requests; local-first `'Inter'` in EDIT A is the compliant maximum).

---

## (4) FIDELITY CHECK — served-vs-authority gate (advisory)

Shape for e.g. `sites/androidtv-tips/tools/fidelity-check.mjs` (Node 18+, zero deps):

```js
#!/usr/bin/env node
// fidelity-check.mjs — asserts the DEPLOYED stylesheet carries the Luminous Dark
// reference values and has shed the GitHub-dark palette. ADVISORY gate: exit codes
// are receipts for the board, never a deploy DENY.
const url = process.env.ATV_STYLE_URL ?? 'https://androidtv.tips/assets/style.css';

const MUST_HAVE = [            // top reference values (lowercased)
  ['page-bg',       '#131313'],
  ['card-surface',  '#1a1a1a'],
  ['primary-text',  '#e5e2e1'],
  ['accent',        '#60f59b'],
  ['accent-strong', '#3dd881'],
  ['muted-text',    'rgba(255,255,255,0.7)'],
];
const MUST_NOT = [             // GitHub-dark/light values that must be gone
  ['gh-page-bg',      '#0d1117'],
  ['gh-accent',       '#58a6ff'],
  ['gh-surface',      '#161b22'],
  ['gh-text',         '#c9d1d9'],
  ['gh-accent-strong','#1f7dc0'],
  ['gh-light-accent', '#0366d6'],
];

let css;
try {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) { console.log(JSON.stringify({ gate: 'luminous-dark-fidelity', verdict: 'UNJUDGEABLE', url, status: res.status })); process.exit(2); }
  css = (await res.text()).toLowerCase().replace(/\s+/g, '');   // whitespace-normalize: survives minification
} catch (err) {
  console.log(JSON.stringify({ gate: 'luminous-dark-fidelity', verdict: 'UNJUDGEABLE', url, error: String(err) }));
  process.exit(2);
}

const missing = MUST_HAVE.filter(([, v]) => !css.includes(v)).map(([k, v]) => `${k}=${v}`);
const stale   = MUST_NOT .filter(([, v]) =>  css.includes(v)).map(([k, v]) => `${k}=${v}`);
const verdict = !missing.length && !stale.length ? 'REFERENCE-LIVE' : 'DRIFT';

console.log(JSON.stringify({ gate: 'luminous-dark-fidelity', verdict, url, bytes: css.length, missing, stale }, null, 2));
process.exit(verdict === 'REFERENCE-LIVE' ? 0 : 1);   // 0 = reference live; 1 = drift receipt (advisory); 2 = could not judge
```

Design notes: needles are lowercased and whitespace-stripped to match the normalized CSS, so `#1A1A1A` vs `#1a1a1a` and minifier spacing cannot false-DRIFT (`rgba(255, 255, 255, 0.7)` is checked as `rgba(255,255,255,0.7)`; a minifier rewriting `0.7`→`.7` would need a needle variant — acceptable for an advisory gate, note it in the runbook). Exit 2 (fetch failure) is distinct from exit 1 (drift) so the caller never reads an outage as palette drift. All six MUST_NOT values exist today only in the two `:root` blocks, so post-edit absence is guaranteed by EDITs A and B1 alone — the gate then detects any future regression or stale-CDN serve.

**Risk register (confidences):** EDIT A/B1/B2/B3/B9 = 0.95 (byte-verified anchors, exact reference tokens). B4/B5 shadow values = derived, 0.8 on values, 0.95 on the mechanism. B6/B7 = 0.9. B8 = 0.7 on element match (inert if wrong). Border-strong mapping = 0.75 with named alternative. The witness bar (contract): after applying, run the atv-11b computed-style witness + 375px/1280px screenshots in BOTH schemes before deploy — the light-mode inversion flip (cards now darker than page) is the highest-visual-change item and needs eyes.