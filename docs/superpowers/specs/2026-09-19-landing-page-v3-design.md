# Landing page v3 — design

**Date:** 19 Sep 2026 · **Status:** design approved section by section by Dr Ranjith (17–19 Sep 2026); "proceed with build post spec".
**Replaces the look of:** landing page v2 (`2026-09-08-landing-page-design.md`). The v2 *mechanism* — a phone pinned beside four steps that switch its screens — is kept exactly.

## Why

The owner asked for the landing page to be rebranded with GetLayers: "analyse and choose the best premium looking theme and design for our visions and purpose". The whole GetLayers library was read (48 templates, 49 Styles, 109 layout skeletons, 98 gradients, 114 scenes, 78 video backgrounds, 21 sections, 39 palettes, 15 fonts). One Style is native to healthcare and says "competent and unhurried": **Dantora**. Its native green and mint are, by coincidence, almost exactly Myrosta's own teal and mint — so the page can adopt the Style and come out *more* on-brand, not less.

The audience has not changed since v2: ED clinicians reading on a phone between patients, and the director or roster-writer who books the walkthrough, usually from a hospital Windows desktop. The 8 Sep decision stands: a 3D agency look is wrong for them.

## Decisions

1. **Style:** GetLayers `dantora-style`, committed in `getlayers.json`. Restrained: no 3D scene, no gradient, no video, **no loading curtain** (GetLayers' default loader is dropped on purpose — its own guide says to simplify for pages opened in a hurry).
2. **Palette: Myrosta's own teal, Dantora's mint, the app's pale amber.** (Section 1 of the brainstorm proposed a blue re-tint on a wrong premise — blue is only the AM-shift colour inside the mark. The brand accent is teal: the "o" of the wordmark, every button in the app. Corrected 19 Sep; the owner may still ask for blue, which is a five-token swap.)
3. **Type:** Google Sans Flex (Google Fonts), Light for display, Medium for labels. Inter is no longer requested.
4. **Structure:** unchanged order and mechanism, every section laid out to a GetLayers skeleton, plus **one new section — the director's view** — and **"No patient data."** in the assurance line (the owner's option b). A real colleague's quote is deferred until the owner brings one; nothing is invented and no placeholder ships. No founder signature.
5. **Guard-rails raised deliberately:** words 525 → 600; page size 40 KB → 48 KB; new lint rules for images, shadows, fonts and contrast.
6. **Privacy, Terms, Support and Thanks** get a light re-skin: they still wear the old brand (teal-on-grey, a red-amber-green stripe whose red `#E04B4B` the landing lint already bans).
7. **Build:** written plan, dry-run from its own text, subagent-driven, commits on `main`, the owner pushes.

## Visual system

### Tokens (page scope, on `:root`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | the page. Panels bring their own colour, so bands between them read white |
| `--panel` | `#EFF4F2` | every full-bleed or inset section panel (Dantora's mint; the app's `--accent-bg` is `#E6F5F1`) |
| `--ink` | `#000000` | all copy |
| `--ink-2` | `#666666` | the one de-emphasis grey: lead-ins of the assurance line, inactive steps, captions, small print |
| `--line` | `rgba(0,0,0,.1)` | the one hairline, 1 px |
| `--accent` | `#05665A` | eyebrows, the trust line and its tick, the primary pill, stat rules, labels, links, focus ring (the app's `--accent-ink-2`) |
| `--accent-deep` | `#044E45` | primary pill border and hover |
| `--amber` | `#FBE9CE` | the counterweight: secondary pill, the disc inside the primary pill (the app's `--pm`) |
| `--amber-line` | `#F9D7A5` | amber border and hover |
| `--glass` / `--glass-subtle` / `--glass-strong` | white at 80% / 50% / 90% | bar and pinned band / chips / form card — each over `blur(10px)` |
| `--r-mark` `--r-panel` `--r-card` `--r-section` `--r-chip` `--r-pill` | 4 / 8 / 24 / 48 / 37 / 46 px | Dantora's corner roles, verbatim |
| `--t-fast` `--t` `--t-slow` | 150 / 250 / 700 ms | |
| `--ease` | `cubic-bezier(.2,0,0,1)` | the Style's one entrance curve |
| `--font` | `"Google Sans Flex",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif` | |
| `--pw`, `--ps` | unchanged (300 px / .768 on desktop; 240 px / .608 below) | the mock-up's size |

Contrast, computed (WCAG): accent on white 6.87, on panel 6.18; white on accent 6.87, on accent-deep 9.63; ink-2 on white 5.74, on panel 5.17; ink on amber 17.65. **Both of Dantora's own greys fail** (black at 40% = `#999`, 2.85; at 50% = `#808080`, 3.95) — hence the single `#666`. This is the first of three deliberate departures from the Style, all for legibility.

**The mock-up keeps its own world.** Every token the phone's screens use today (`--navy`, `--am`, `--pm`, `--cst`, `--fs-*`, `--radius*`, `--shadow`, …) moves from `:root` to `.phone{…}`, and the mock-up's font becomes the app's own *fallback* stack (`-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif`) — what the real app shows before Inter arrives — so it costs no font bytes. The phone's CSS sits between `/*phone-css*/` and `/*/phone-css*/` markers, mirroring the `<!--phone-->` markers in the HTML, so the lint can tell page from product.

**The mark is not touched:** navy tile, white M, blue / amber / green rails, in the bar, the favicon and the mock-up. The wordmark keeps its teal "o" and is set at Medium.

### Type

| Role | Desktop | Phone | Weight | Leading |
|---|---|---|---|---|
| h1 | 60 px (`clamp` from 40) | 40 | 300 | 1.1 |
| h2 (section heading), assurance statement | 36 | 28 | 300 | 1.1 |
| lead (hero), FAQ question, form heading | 20 | 18 | 300 | 1.3 |
| body | 16 | 16 | 300 on sharp screens, **400 on standard ones** | **1.5 for paragraphs over two lines**, 1.2 otherwise |
| eyebrow, field label | 14, uppercase, accent | 13 | 500 | 1.2 |
| step numeral (decorative) | 60 | 40 | 300 | 1 |
| stat figure | 60 (`clamp` from 40) | 40 | 300 | 1.1 |

Tracking 0 everywhere (the Style's). `text-box: trim-both cap alphabetic` on headings, paragraphs, list items, labels, buttons and links — progressive: browsers without it fall back to the untrimmed box. `text-wrap: balance` on headings stays.

Departures two and three: **body is Regular (400) where `max-resolution: 1.5dppx`** — Light at 16 px turns spindly on the ordinary Windows monitors on most hospital desks — and **long paragraphs get 1.5 leading** (Dantora's copy is never longer than two lines; our FAQ answers are). The font request is one file either way: `family=Google+Sans+Flex:wght@300..500`, `display=swap` (measured: 51 KB latin, against Inter's 48 KB today).

### Anatomy (from the Dantora master, translated to plain CSS)

- **Pill** — `inline-flex`, 54 px high (48 on phones), radius 46, 1 px border, 20 px Light (18 on phones), `white-space:nowrap`. *Primary:* accent fill, accent-deep border, white text; hover turns the fill accent-deep. *With a disc* (hero primary, form submit): `padding:0 2px 0 32px; gap:10px`, and a 48 px circle (42 on phones) in amber carrying a 16 px black arrow. *Secondary:* amber fill, amber-line border, black text; hover turns the fill amber-line.
- **Chip** — the bar's "Sign in": radius 37, 1 px line border, glass-subtle over the blur, 16 px Light, padding 12 × 20; hover turns the text accent.
- **Eyebrow** — 14 px Medium uppercase accent, no tracking.
- **Trust line** — 16 px, accent, followed by a 50 × 1 px accent tick. Under it, any second sentence in `--ink-2`.
- **Stat** — figure over label, a 1 px **accent rule on the left**, 24 px (16 on phones) of padding after it.
- **Field** — label above (eyebrow style); input radius 8, 1 px line border, transparent, padding 16 × 20, 16 px (never smaller: iOS zooms); `:focus-visible` turns the border accent and adds the ring. The one placeholder that exists today (the hint on the optional field) stays, in `--ink-2`; no field relies on a placeholder for its name.
- **Focus ring** — `outline:2px solid var(--accent); outline-offset:2px` on everything interactive. Dantora's fields set `outline:none`; we do not.
- **Links in copy** — accent and underlined (never colour alone).
- **No shadows anywhere on the page.** Depth is the blur and the panel edge. (The mock-up keeps its own frame shadow inside its markers.)

## The page

Order and ids are unchanged except where stated. Grounds alternate: white (bar, hero, steps) → panel (director's view) → white (assurance) → panel (proof) with the form card riding over its edge → white (FAQ) → panel (footer). Each section names the GetLayers composition it is built to; they are references to adapt, never a generic centred stack. Every panel is the same object: full width less an inset of 12 px (phones) to 20 px (desktop) on each side, `--panel` ground, 48 px corners on every edge that meets white (24 px on phones) — so the director's view and the proof panel are rounded all round, and the footer panel only at the top.

```
 Hero and steps (desktop)                        Director's view
┌──────────────────────────────────────────┐   ╭──────────────────────────────────────────╮
│ ▣ Myrosta                    ( Sign in ) │   │ FOR WHOEVER RUNS…        Every zone and  │
├──────────────────────────────────────────┤   │ The whole roster on      every day at    │
│ The ED roster, finally      ┌─────────┐  │   │ one screen.              once, with…     │
│ on every phone.             │         │  │   │ ──────────────────────────────────────── │
│ Book shifts, swap them…     │  phone  │  │   │ ┌──────────────────────────────────────┐ │
│ (Try the demo ●) (Book a…)  │ pinned, │  │   │ │  the Roster grid (real capture)      │ │
│ ─────────────────────────   │ centred │  │   │ │                       ┌────────────┐ │ │
│ In daily use at a … 2026 ── │         │  │   │ │                       │ Fairness   │ │ │
│ Taking on new departments…  └─────────┘  │   │ └───────────────────────│ (capture)  │─┘ │
│ SEE IT WORK                              │   │                         └────────────┘   │
│ ─────────────────────────                │   ╰──────────────────────────────────────────╯
│ 01  Your next shift, at a glance.        │    Proof, with the form card riding over it
│ ─────────────────────────                │   ╭──────────────────────────────────────────╮
│ 02  Tap a day. See what's open… (grey)   │   │ Built in an ED, for EDs.                 │
└──────────────────────────────────────────┘   │ Most department rosters still…           │
                                               │ REAL ROSTER,  │June 2026 │36      │0     │
                                               │ REAL NUMBERS  │live in a…│doctors…│pass… │
                                               ╰────────╭──────────────────────╮──────────╯
                                                        │ Book a 20-minute…    │
                                                        │ NAME ___  WORK EMAIL │
                                                        │ HOSPITAL AND DEPT ___│
                                                        │ (Book a 20-minute… ●)│
                                                        ╰──────────────────────╯
```

1. **Bar** — composition `flowstate-nav` without its centre pill (we have no nav links): mark lockup left, action right. Sticky, full width, `--glass` over the blur, one hairline beneath, 60 px. "Sign in" becomes a **chip**, so each screen has one accent action. The script's `--barh` measurement is unchanged.
2. **Hero** — composition `artist-hero` (copy column beside a tall plate, closed by a ruled caption). Left: h1, lead (black, 20 px), the two pills — **"Try the demo" stays the primary** (disc), "Book a walkthrough" the secondary — then a hairline, then the trust line with its tick: *In daily use at a Victorian emergency department since June 2026.* and, beneath it in `--ink-2`, *Taking on new departments across Australia.* (today's one green-dot pill, split at its full stop; same words). Right: the phone, which is the plate. On screens at least 861 px wide and 700 px tall the intro is as tall as the viewport under the bar with its content centred, and the phone's sticky `top` holds it at the centre of the screen — the same line the script already uses to pick the current step.
3. **The four steps** — composition `artist-process`, mirrored: the pinned block is the phone, the ruled rows are the steps. `<div class="steps">` keeps its eyebrow h2 "See it work"; the four `.step` elements become `<li>`s of an `<ol>` (`data-step` and `aria-current` exactly as the script expects). Each row: hairline on top, a decorative numeral `01`–`04` (`aria-hidden`; the list itself tells a screen reader "1 of 4"), title, paragraph. **"1 of 4" … "4 of 4" leave the copy.** State: a step that is not current has title and paragraph in `--ink-2` and a numeral at 18% black; the current step has both in `--ink`, the numeral and its hairline in accent. One 150 ms colour change. Without scripts every step is simply full ink.
4. **Director's view (new)** — composition `creative-director-portfolio` adapted: a header row (eyebrow and h2 left, description right) over a hairline, then plates. A full-bleed `--panel` with 48 px corners. The wide plate is the **Roster grid**; a smaller plate, the **Fairness view**, rides over its lower-right corner on a `--glass-strong` frame. Plates: radius 24, 1 px line border, white ground, no shadow, no fake browser window. Copy (44 words): eyebrow *For whoever runs the roster* · h2 **The whole roster on one screen.** · *Every zone and every day at once, with the days that still need cover flagged. The Fairness view shows who carried the weekends and the late shifts — the same table for everyone.* `id="view"`, `aria-labelledby="viewT"`.
5. **Assurance** — composition `artist-statement`: one passage at 36 px on white with a great deal of air, no eyebrow, no signature. Today's navy band goes (the Style has no dark surface). Copy: *A code by text or email, **no password**. **No patient data.** Data **stays in Sydney**. Every change **is logged**.* — the marked claims in `--ink`, the rest in `--ink-2`; marks are spans, not bold. "No patient data." is new (3 words) and true: the product holds staff names, contact details, shifts and leave, and nothing clinical.
6. **Proof** — composition `clarix-stats`: one inset `--panel`, 48 px corners. Top-left the h2 *Built in an ED, for EDs.* and its paragraph; bottom-left the corner label *Real roster, real numbers*; bottom-right the three figures as ruled stats. No count-up (one of the figures is a date and one is zero).
7. **Walkthrough form** — composition `stride-contact` on Dantora's "rides up over" move: a `--glass-strong` card, radius 24, 1 px line, at most 720 px wide, centred, pulled 48 px up over the proof panel's bottom edge. h3 *Book a 20-minute walkthrough*, then today's offer sentence (*Bring your current roster…*) moved here as its lead, Name and Work email on one row, the other two fields full width, the submit as a primary pill with the disc, *Prefer email?* in `--ink-2`. **`id="walkthrough"` moves from the section to this card** (`scroll-margin-top` clears the bar), so the hero's second pill lands on the form. Every Netlify attribute, field name and the honeypot are untouched.
8. **FAQ** — composition `artist-faq`: a 4 | 8 split, *Questions, answered.* in the left third, the five questions as hairline-topped rows (20 px Light) with a drawn plus that turns 45° when open. Still `<details>`; no script.
9. **Footer** — composition `loopstack-footer`: a `--panel` with 48 px top corners; row one the mark lockup left and *Made in Melbourne* right, a hairline, row two the four links and *© 2026 Myrosta*. Same words as today.

Head: `theme-color` becomes `#FFFFFF`; the font link becomes the Flex request; title, description, canonical, Open Graph, JSON-LD and `og-image.png` are unchanged (the social card is current and reads better bold at thumbnail size).

**Word count:** 519 today − 8 (the four "n of 4" become numerals) + 3 ("No patient data.") + 44 (director's view) + 2 (the footer gains the wordmark lockup, which the lint reads as three tokens, and loses one separator) = **about 560 of 600**.

## Motion

One vocabulary, Dantora's: copy resolves out of a blur while rising. Its springs translate to the Style's curve: labels ≈ 450 ms, everything else ≈ 700 ms on `--ease`, with opacity landing early (400 ms).

- **Hero, on load:** the h1's seven words each `opacity 0 → 1`, `blur(20px) → 0`, `translateY(24px) → 0`, 55 ms apart (Dantora travels 60 px behind a curtain; we have no curtain, so 24). Then lead, pills, rule, trust line and caption as blocks with the element preset (`blur(12px)`, 20 px), 90 ms apart. Whole hero under one second. The phone fades with the same preset.
- **Below the fold:** one `IntersectionObserver` adds `.in` to `[data-r]` blocks as they enter (threshold 0.2), once. Dantora replays "always" because its spring engine can lose a reveal for good; ours is a CSS class, and a 3-second safety timer plus `pageshow` reveal anything still hidden in view, so copy can never stay invisible.
- **Hover:** a 150 ms colour change and nothing else. The steps' change of state is the same.
- **Never:** parallax, scroll-scrubbed motion, count-ups, cursor effects, a loader.
- **Reduce motion:** no blur, no travel — a 150 ms fade; `scroll-behavior:auto`. **No script:** reveal styles only apply under `html.js`, so everything is visible, as today. **Print:** everything visible.
- The story script (the 2.7 KB that pins the phone and picks the step) is not edited.

## Responsive

- **≤ 860 px (the existing breakpoint):** one column in the same order. The phone frame is moved by the existing script into the `.pin` band under the bar; the band becomes `--glass` over the blur with a hairline, so steps slide beneath it. Step numerals sit above their titles. Pills: side by side if they fit, else stacked, 48 px high. Director's view: header stacks; a purpose-made **narrow crop** of the grid (names and the first days, readable at 1:1), the Fairness plate beneath it, not overlapping. Proof: statement, then the three stats as ruled rows; the form card full width, riding up 24 px. FAQ: heading above the rows. Panel corners 24 px.
- **861–1099 px:** desktop layout with the 240 px phone. **≥ 1100 px:** the 300 px phone (as today).
- Landscape and short viewports keep v2's rule: nothing pins.
- No horizontal scroll at any width; nothing has a `min-width` wider than the screen.

## Accessibility

AA contrast on every ground (asserted by the lint); one h1, an h2 per section in order; the steps are an ordered list; decorative numerals, the tick, the disc arrow, the plus glyph and the whole mock-up are `aria-hidden`; visible focus ring everywhere; labels above every field with `autocomplete` as today; 44 px minimum targets; links distinguishable without colour; frosted surfaces fall back to solid white under `@supports not (backdrop-filter: blur(1px))` and under `prefers-reduced-transparency: reduce`; images have alt text without names, `width`/`height`, `loading="lazy"`, `decoding="async"`; the page survives 200% zoom and 320 px width.

## Images

Three captures of **`deploy/demo.html`** (fictional cast), taken with headless Chrome by a small script kept in `tools/capture-landing.py`, so they can be retaken when the app changes:

| File | What | Display | Budget |
|---|---|---|---|
| `deploy/view-roster.webp` | Roster grid, viewed as admin, 1440 × 900 viewport | up to 1100 px wide | ≤ 120 KB |
| `deploy/view-roster-narrow.webp` | the same grid cropped to names + first days | phones, 1:1 at 2× | ≤ 60 KB |
| `deploy/view-fairness.webp` | the Fairness (Equity) view, cropped to tiles + table | ≈ 420 px wide | ≤ 80 KB |

Capture rules: the demo's staff wording is switched from "Consultant" to **"Doctor"** for the capture only (the page bans the word; the demo and its seed are not changed); the demo's fixed "Demo sandbox" banner is hidden for the capture only; the viewer is the admin so the grid carries no "view only" note; device scale 2, exported as WebP at the highest quality that meets the budget. Alt text: *The roster grid: staff down the side, days across, every booked zone a coloured chip, cover counted under each day* and *The Fairness view: each person's share of weekends, Friday and Monday evenings and public holidays, as bars against the team average*.

## Lint (`landing_lint` in `tests/run.py`)

Changed: size budget `40*1024` → `48*1024`; word budget 525 → 600 (each with a dated comment).
New:
1. every same-origin `src` and every `srcset` URL must exist under `deploy/`; every `<img>` carries `width` and `height`; each referenced image ≤ 120 KB, all together ≤ 300 KB;
2. outside the `/*phone-css*/ … /*/phone-css*/` region the CSS has no `box-shadow`, no `Inter` and no `#0F243A`;
3. the head requests `family=Google+Sans+Flex` and does not request `family=Inter`;
4. contrast, computed from the page's own `:root` tokens: `--ink-2` on `--bg` and on `--panel`, `--accent` on `--bg` and on `--panel`, white on `--accent` and on `--accent-deep`, `--ink` on `--amber` — each ≥ 4.5;
5. `privacy.html`, `terms.html`, `support.html` and `thanks.html` no longer contain `E04B4B`.
Unchanged: both copies identical; stale words (including "consultant"); the cast; the form's attributes; deploy-only links; no price in JSON-LD; the fonts-and-self host rule; the three mark colours; `thanks.html` in sync.
`build_lint` learns one thing: a changelog heading containing `(site only)` is skipped when it looks for the newest release, so a landing-page entry does not force an app build date.

## `getlayers.json` (repo root, not deployed)

`version 1`; `brief` = `{dimensionality:["flat"], mood:["calm","luxe"], tone:["light"], motionEnergy:["subtle"], density:["balanced"]}`; `styleId: "dantora-style"`; `tokens` = the table above under the canonical `gl-*` names (`gl-bg`, `gl-bg-alt` = panel, `gl-surface` = glass, `gl-surface-raised` = glass-strong, `gl-ink`, `gl-ink-muted` = ink-2, `gl-accent`, `gl-accent-ink`, `gl-line`, `gl-glow` = amber, the two font tokens, weights, radius, durations, ease); `activeTemplateId: "dantora"` (reference only — none of its sections or its DNA scene are used); `placed` = the nine sections in page order, each with the composition id named above; `notes` = the three legibility departures, "no loader, no scene, no gradient", "palette is the brand's own teal; blue was proposed in error", and "quote slot deferred until the owner supplies a real sentence".

## Files

Changed: `index.html` = `deploy/index.html`; `thanks.html` = `deploy/thanks.html`; `deploy/privacy.html`, `deploy/terms.html`, `deploy/support.html` (and their root copies if they exist); `tests/run.py`; `CHANGELOG.md` (one `(site only)` entry); `.claude/launch.json` is local and untracked (the `landing` preview moved to port 8897 because 8899 belongs to another project on this Mac).
New: the three images; `tools/capture-landing.py`; `getlayers.json`; this spec and its plan.
Not touched: `app.html`, `deploy/app.html`, `deploy/demo.html`, `tools/demo-seed.js`, Edge Functions, SQL, `og-image.png`, the mock-up's screens, the story script.

**Small pages:** same font link and a token subset; the old stripe and teal-on-grey go; bar and footer as on the landing page; h1 40 px Light, h2 20 px Medium, body as above, measure 740 px, links accent and underlined. Their copy is not edited.

## Testing

Lint rules first and failing, then the build turns them green. `python3 tests/run.py` stays fully green (the app is untouched, so the 895 passes and the other lints must not move). Then by eye in the built-in browser (`landing` preview, port 8897) at 390, 768 and 1440 px: every section; the phone switching all four screens scrolling down and back up; the pinned band on a phone; reduce-motion; scripts off; keyboard only (tab order, ring, FAQ, form); 200% zoom; the three small pages and Thanks. After the owner pushes: one real walkthrough submission (Netlify must still catch the form — field names are unchanged) and a look on a real phone.

## Out of scope

The app and the demo; a colleague's quote and a founder signature (later, owner's call); any gradient, scene, video or loader; pricing; a new social card; dark mode; analytics.

## Later: the quote

When the owner has a real sentence from a real colleague, it goes into the proof panel between the statement and the stats, as a 20 px passage with a role-only attribution unless the person agrees to be named (a real name needs the cast rule in the lint to learn an exception). 25 words are already inside the 600 budget.

## As built (19 Sep 2026)

Found while building the page on a scratch copy, before the plan was written:

- **The mock-up shared more with the page than its tokens**: `.btn`, `.eyebrow`, `.brand`, `.logo`, `.alt`, and the global `h2` rule all reached into it. Those rules now live inside the fence as `:where(.phone) …` — `:where` adds no specificity, so they sit exactly where the old global rules sat — and the page's own classes were renamed clear of the mock-up's (`.pill`, `.chip`, `.eb`, `.lock`, `.or`). `python3 tools/capture-landing.py phone DIR` photographs the five screens and `compare` diffs two sets: **0 pixels differ** before and after.
- **Stat figures are 48 px, not 60** ("June 2026" has to fit its column; the first stat column is 1.5 × the others), and **step titles are 24 px**.
- **Field borders are `#757575`** (4.6:1): the Style's 10% hairline fails the 3:1 non-text contrast a form field's boundary needs. A fourth legibility departure, with the grey, the body weight and the long-paragraph leading.
- **The device frame lost its drop shadow** (the page has none); the screens inside keep the app's own card shadows.
- Tokens as shipped: `--r-mark` dropped (unused), `--field` added; the wordmark's "o" is `--accent`.
- The small pages were still carrying the **old mark with the red rail**; the re-skin replaces it with the current one.
- Measured: `index.html` 48,324 bytes (13.0 KB gzipped) of 49,152; 560 words of 600; images 96 KB, 54 KB and 59 KB at WebP quality 90. My brainstorm estimate of 41.5 KB was low — the fenced mock-up CSS costs about 2 KB and the new sections' CSS more than the old.
- **Found by the reviews**: the steps' list needed `role="list"` (WebKit drops list semantics under `list-style:none`, and the visible "1 of 4" had gone); the small plate's edge fade is switched off at ≤ 860 px, where nothing overlaps it; the phone crop of the grid is served only at ≤ 600 px — between 601 and 860 px the full grid shows; the footer panel keeps square bottom corners at every width; a block reveals on `focusin`; the `js` class is set in the head, after the JSON-LD, so the hero never paints before it is hidden; `.plates` reveals without blur.
- **Where the build and the prose above differ, the build stands**: the form card rides up 72 px (48 px on phones), not 48 / 24; the observer's threshold is 0.12 with a −6% bottom margin, not 0.2 (the plates block is tall); the Fairness alt text omits "and public holidays" because the crop ends at "Mon PM"; the Thanks page uses a 720 px measure and a clamped h1 because it is a card, not a document; `text-box` trimming is applied to a named list of leaf text classes rather than to every heading, paragraph and link; at 1440 px the wide plate renders about 1130 px and the small plate about 475 px, and on a 390 px phone the crop renders about 326 px wide.
- **The lint grew teeth**: every `opacity:0` rule outside the fence must be `.js`-gated; declared image sizes must equal the WebP header's; no undefined custom property; the JSON-LD block is located by its type; `compare` fails on an empty set.
- **Left alone, deliberately**: the bar's "Sign in" chip keeps its 10%-black hairline (its text identifies it); the render-blocking Google Fonts stylesheet is inherited from v2; the repo-root `privacy.html` and `support.html` are stale, unserved copies that predate this work.
