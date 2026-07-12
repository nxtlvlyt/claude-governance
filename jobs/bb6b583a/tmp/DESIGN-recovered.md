# DESIGN.md — androidtv.tips design contract (v1, 2026-07-11)

Authored by the conductor from the operator's phone screenshot verdict (2026-07-11
~21:4xZ: "why is it so visually bad?") — three receipted defects drive every rule here.
This file is BINDING on implementation missions: a css/markup change that contradicts a
rule here is wrong even if its validation passes (spec yields to contract, D13 shape).
Iterate the contract, never silently diverge from it.

## The three receipted defects this contract exists to kill

1. Nav rendered as a full-screen vertical stack of bare links on phone width.
2. Body text ran edge-to-edge — zero gutters, no max-width.
3. Card anatomy wrong: only the title <a> was boxed; descriptions floated outside the
   cards as orphan "— …" lines; a stray "." text node; clipped title text.

## Layout

- Content column: max-width 720px, margin-inline auto, at EVERY width.
- Gutters: 20px inline padding on the body/main container at every width. NOTHING
  touches the viewport edge.
- Vertical rhythm: sections separated by 40-48px; paragraphs at readable measure
  (max 65ch), line-height 1.6.

## Navigation (the #1 defect)

- One horizontal, WRAPPING link bar at ALL widths: display:flex; flex-wrap:wrap;
  gap 8px 16px. Never a vertical stack — if links exceed one line they wrap into a
  second compact line, still reading as a bar.
- Brand ("androidtv.tips") is the first item, visually distinct (font-weight 700);
  section links smaller (0.9rem), muted until hover/focus.
- Nav sits inside the same 720px column (respects gutters); a subtle bottom border
  separates it from content. No sticky behavior in v1.

## Typography

- System font stack (unchanged). Body 1rem/1.6.
- h1: 1.75rem, weight 700, tight leading (1.15), max ~2 lines.
- h2: 1.25rem, weight 650, 40px top margin, 12px bottom.
- Secondary/description text: 0.9rem, muted foreground (not pure white — ~70% opacity
  equivalent), never clipped (no fixed heights, no overflow:hidden on text).

## Cards (the #3 defect)

- A card is the WHOLE unit: title AND description live INSIDE the same
  <a class="card"> element. Markup fix required: move each description text node
  inside its anchor as <span class="card-desc">, strip the leading "— ", delete the
  stray "." text node. Content wording stays byte-identical otherwise.
- Card anatomy: padding 18px; border-radius 10px; 1px subtle border; background one
  step lighter than page. Title (1.05rem, weight 600) on the first line; description
  (card-desc styling per Typography) below it. No clipping, ever.
- Grid: 1 column below 640px; 2 columns 640-959px; 3 columns at 960px+; gap 16px.
- Hover/focus-visible: slight lift (translateY(-2px)) + accent-colored border. Cards
  are fully clickable.
- INVARIANT the witness must assert: ul.card-grid and its li elements contain NO
  visible text nodes outside .card elements.

## Color

- Keep the dark scheme + existing single accent. Page background near-black (not
  pure #000), card background one step lighter, borders subtle (low-contrast gray).
- prefers-color-scheme light keeps working; same structure, inverted lightness.

## Footer

- Single muted horizontal bar inside the content column: site line + home link,
  0.85rem, top border, 48px top margin.

## V2 ADDENDUM (2026-07-11 ~23:0x — first vision-iteration pass: Gemini QC verdict
## ITERATE on atv12-375.png, conductor humble-validated every finding by eye)

1. LIGHT SCHEME MUST BE COMPLETE: prefers-color-scheme light inverts ALL surfaces —
   page, nav, cards, footer — together. A component may never stay dark on a light
   page (the v1 render: white page, dark nav/cards/footer). Both schemes must be
   witnessed (puppeteer emulateMediaFeatures, dark AND light screenshots).
2. GUTTERS APPLY TO TEXT: h1, paragraphs, and section headings must sit inside the
   padded column — witness asserts computed paddingLeft > 0 on the h1's layout parent
   (v1: text touched the left screen edge; the witness never checked).
3. NO LIST MARKERS: ul.card-grid gets list-style:none AND padding-left:0 — zero
   bullet dots may render beside cards (v1: bullets visible outside every card).
4. CARD-DESC IS A BLOCK: .card-desc renders display:block with ~6px top margin —
   title and description never concatenate (v1: "Kodisetup...").
5. TITLE CONTRAST: card title color is the high-contrast foreground token in BOTH
   schemes — never near-black on a dark card (v1 light-mode failure).

## V2 TASTE RULES (2026-07-11 ~23:0x — operator verdict on the v1 render: "is that a
## website from 1999?" — correctness is not design; these rules buy the decade back)

- HERO: the h1 block gets visual weight — larger fluid type (clamp(1.9rem, 6vw, 2.6rem)),
  tighter tracking, and a subtle accent treatment (a thin accent rule above it, or a very
  soft radial accent tint behind the header area — CSS only, no images).
- FLUID TYPE SCALE: use clamp() for h1/h2 so desktop breathes and mobile stays tight;
  body stays 1rem/1.6.
- DEPTH: cards get a soft shadow (dark scheme: subtle black glow; light: soft gray) plus
  the 1px border — flat gray boxes are the 1999 tell. Radius 12px. Hover adds accent
  border + slightly stronger shadow with a 150ms ease transition.
- ACCENT WITH INTENT: exactly one accent color, used on: link color, nav hover/current,
  the hero rule/tint, card hover border, and the footer link — nowhere else. Muted
  everything else.
- SECTION RHYTHM: h2 sections get an eyebrow feel — h2 slightly smaller than v1 hero,
  56px top margin, and a short muted underline rule (2px, 32px wide, accent at 40%
  opacity) under each h2.
- NAV POLISH: nav links get 6px 10px padding and a 8px radius hover pill (accent-tinted
  background at low opacity) instead of bare text hover; brand stays bold and larger.
- WHITESPACE IS THE DESIGN: 24px card gap on desktop, 64px between major sections,
  hero block gets 48px top/bottom padding. When in doubt, add space, never boxes.

## Hard constraints (unchanged from mission law)

- Zero external requests: no @import, no remote fonts/urls.
- Every class used in any public/*.html has a selector in public/assets/style.css.
- Witness bar: computed styles over a real local HTTP render (atv-11b template) PLUS
  the card-anatomy invariant above PLUS fresh 375px + 1280px screenshots for a vision
  verdict and the operator's own eyes on a preview deploy before production.
