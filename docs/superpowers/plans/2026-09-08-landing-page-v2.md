# Landing page v2 — "the phone that works" · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page with one fast file that gets staff to Sign in in one tap and walks an evaluator through the product with a pinned phone that advances as they scroll, ending in a four-field walkthrough form handled by Netlify Forms.

**Architecture:** `index.html` is rewritten as a self-contained page: its own copy of the Phase 3 tokens and the few app components the phone frame needs (hero card, day row, tag, day sheet, basket footer, list row, notification row), five static screens inside one phone frame, an IntersectionObserver that switches the visible screen as the step paragraphs scroll past the middle of the viewport, and a plain HTML form Netlify handles at deploy. `deploy/index.html` is a byte copy; `thanks.html` is new in both places. A Python lint in `tests/run.py` guards vocabulary, names, size, links and the form.

**Tech Stack:** static HTML/CSS/JS, Inter from Google Fonts, Netlify Forms; tests via `python3 tests/run.py` (Python lint, no JSC needed for the page).

**Spec:** `docs/superpowers/specs/2026-09-08-landing-page-design.md`.

## Global Constraints

- One file, under 40 KB, under 450 visible words, no images, no libraries, no scripts from outside the site; fonts only from fonts.googleapis.com / fonts.gstatic.com.
- No real names: the cast is Dr Jordan Lee (the visitor), Dr Ng, Dr Patel, Dr Okafor. Zones: EPIC, Resus, Paeds, SSU, Fast track, Acute bays. Never "Jamie", never "Werribee".
- Vocabulary: Book shifts, booking, staff, groups, roster. Never self-roster, consultant, cohort, snake, release.
- Reduced motion respected; every control ≥ 44 px on phones; `:focus-visible` ring; readable with scripts off.
- The app is untouched. `demo.html`, `privacy.html`, `terms.html`, `support.html` untouched.
- Sync rule: `index.html` and `deploy/index.html` identical; `thanks.html` and `deploy/thanks.html` identical.

---

### Task 1: The landing lint (fails first)

**Files:** `tests/run.py`.

- [ ] Add `landing_lint()` to `tests/run.py` and register it in `LINTS`. It reads `index.html` and `deploy/index.html` and returns a list of problems:
  - the two copies differ; size ≥ 40 KB;
  - stale words (case-insensitive): `self-roster`, `self‑roster`, `consultant`, `cohort`, `snake`, `release for`, `E04B4B`, `Jamie`, `Werribee`;
  - names: every `Dr <Word>` and every `<Word>, <Word>` in the visible text must be in the cast list;
  - form: `name="walkthrough"`, `data-netlify="true"`, `netlify-honeypot="bot-field"`, `action="/thanks.html"`, an `<input type="email"`; `thanks.html` and `deploy/thanks.html` exist and are identical;
  - links: every `href="…"` that is not `#…`, `mailto:`, `https://fonts…`, or `https://myrosta.com.au…` must name a file that exists in the repo root;
  - external hosts: only `fonts.googleapis.com` and `fonts.gstatic.com` in `src=`/`href=`;
  - the mark: `4C86E8`, `F2A638`, `2FA86E` present; `E04B4B` absent;
  - visible word count ≤ 450 (strip tags, scripts, styles).
- [ ] Run `python3 tests/run.py | grep landing` → FAIL on the current page (vocabulary, red mark, no form).
- [ ] Commit: `git commit -am "Landing lint: vocabulary, cast, size, links, form, mark"`.

### Task 2: The phone frame and its five screens (static)

**Files:** `index.html` (new file written from scratch; the old page stays in git history).

- [ ] Write the page skeleton with the token block (copied values from app.html `:root`: navy, navy-2, teal `--accent-ink`, `--accent-bg`, am/pm/cst pairs, leave, neutral-2, line, muted, the `--fs-*` scale, radii), the base type rules, the mark SVG (AM/PM/CST bars) as favicon data URI and inline logo.
- [ ] Add the phone frame: `<div class="phone" role="group" aria-label="Myrosta on a phone" id="phone">` containing five `<div class="screen" data-screen="n">` panels, the first `aria-hidden="false"`, the rest `aria-hidden="true"`; copy the minimum CSS for `.nextcard` (with the period rail), `.tag` (am/pm/cst/lv/solid/brand/mini), `.dayrow`, `.daysheet` (`.dshead .dsper .zchips .zchip .zsub`), `.srfoot`, `.listrow`, `.notif`, `.bn` bottom bar, scaled to the frame (the frame is 270 × 560 px on desktop, scaled with `transform` on phones).
  - Screen 1 — My shifts: hero "Your next shift · Mon 28 Sept · EPIC · 08:00", "in 20 days", "Booked this cycle 11 / 14", week strip Mon EPIC AM · Tue Off · Wed Paeds PM · Thu Off · Fri Acute bays AM.
  - Screen 2 — the day sheet for Tue 29 Sept: AM | PM, "AM cover 4 of 5 · minimum 4", chips EPIC "Taken by Dr Ng", Resus "Taken by Dr Okafor", Fast track "Open", SSU "Fill the minimum first — 4 AM and 4 PM.", Paeds "Taken by Dr Patel"; the three marks.
  - Screen 3 — the list with Tue 29 "Picked · AM · Fast track" and the footer "1 picked · 11 → 12 of 14 after confirm · Clear · Confirm 1 pick".
  - Screen 4 — Requests: "Needs you" — "Dr Patel offers their Paeds PM on Sat 3 Oct for your Acute bays AM on Sun 4 Oct" with Decline / Agree; "Your requests" with one Approved row.
  - Screen 5 — the notifications sheet: "Open shift: Thu 8 Oct PM · Acute bays — tap to take it", "Booking is open · closes Fri 19 Sept 5:00 pm", "Mark all read".
- [ ] `python3 tests/run.py | grep landing` still FAIL (page incomplete) — that is expected; check the frame renders at http://localhost:8898/ (copy to the review site) at 1280 and 375.
- [ ] Commit: `"Landing v2: the phone frame and its five screens"`.

### Task 3: The page around it

**Files:** `index.html`, `thanks.html`, `deploy/thanks.html`, `deploy/index.html`.

- [ ] Sections 1–7 per the spec with the exact copy: pinned bar (mark, Myrosta, Sign in → app.html), hero (headline, sub-line, Try the demo → demo.html, Book a walkthrough → #walkthrough, pilot line, the phone), the story (four numbered `<p class="step">` with the phone beside), the navy security line, proof (three figures) + soft roster offer + the form, the five `<details>` FAQs, footer.
- [ ] `thanks.html`: one paragraph, links Home and Try the demo; same bar and footer; noindex.
- [ ] Meta: title, description (rewritten), canonical, JSON-LD SoftwareApplication (kept, name/description updated), theme-color navy.
- [ ] `cp index.html deploy/index.html; cp thanks.html deploy/thanks.html`; `python3 tests/run.py | grep landing` → PASS.
- [ ] Commit: `"Landing v2: the page — bar, hero, story, proof, form, FAQ"`.

### Task 4: The story moves

**Files:** `index.html` (+ deploy copy).

- [ ] Layout: desktop `.story{display:grid;grid-template-columns:1fr 300px}` with `.phone{position:sticky;top:96px}`; phones (`max-width:640px`) `.phone{position:sticky;top:64px;height:46vh}` above the steps, steps padded so each can reach the middle of the viewport.
- [ ] Script (inline, ~25 lines): `IntersectionObserver` on `.step` with `rootMargin:"-45% 0px -45% 0px"`; on intersect set `data-current` on the phone and toggle `aria-hidden` on the screens; screens cross-fade with `opacity .3s` unless `prefers-reduced-motion`. With no script the first screen shows and the steps read as a list.
- [ ] Check in the browser at both widths: scroll advances 1→5; reduced-motion emulation switches instantly; Tab reaches Sign in, Try the demo, Book a walkthrough, the FAQ summaries, the form, the footer.
- [ ] Commit: `"Landing v2: the phone advances as you scroll; pinned on desktop and on phones"`.

### Task 5: Review, docs, merge, deploy step

- [ ] Workflow: 3 skeptics (copy and claims vs the app as shipped; accessibility of the story and form; performance/robustness — size, fonts, no-JS, Safari sticky). Fix confirmed items.
- [ ] CHANGELOG entry "8 Sep 2026 — Landing page v2"; memory note.
- [ ] Fast-forward `main`; user pushes; verify https://myrosta.com.au/ serves the new page and https://myrosta.com.au/thanks.html exists.
- [ ] Owner step 1 (guided, before the deploy that carries the form): Netlify → Site configuration → Forms → **Enable form detection** (off by default for sites created after April 2023); then deploy or redeploy — Netlify only parses `data-netlify` forms on a build after detection is on; without it a submit returns Netlify's 404 and nothing is stored.
- [ ] Owner step 2 (guided): Netlify → Forms → walkthrough → Form notifications → Email to drranjith0713@gmail.com; then submit one test entry from the live page and confirm it lands on /thanks.html and the email arrives.

## Self-review
- Spec coverage: audiences (bar + hero CTAs), proof line, form + thanks + notification step, pilot line, direction B + phone behaviour, cast and zones, soft offer, seven sections, five screens, visual system, tests, out of scope — all in Tasks 1–5.
- No placeholders; copy is in the spec; the cast and zones are fixed.
- Names used consistently: `landing_lint`, `.phone`, `.screen[data-screen]`, `.step`, `#walkthrough`, `thanks.html`.
