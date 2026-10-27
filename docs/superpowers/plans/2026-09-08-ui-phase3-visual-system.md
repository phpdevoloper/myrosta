# UI Phase 3 — One visual system · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Line numbers below are from `main` at c1112dd (8 Sep 2026); re-grep before editing — they drift as tasks land.

**Goal:** Every size, colour and small label in the app comes from one named system — a seven-step type scale in rem, a fully tokenised palette, one `.tag` component, SVG icons instead of emoji, one teal brand — with the period colours (AM blue · PM amber · CST green) as the signature on the hero card and the app icon, and a lint in the suite so no literal can creep back in.

**Architecture:** Stylesheet + template-string edits only. Tokens are declared once in `:root`; a `PALETTE` constant in the script mirrors the colour tokens for the two HTML exporters that need literal hex, and a Python lint in `tests/run.py` asserts the mirror matches. `leaveStyle()` keeps its `{bg,t,name}` shape but returns `var(--lv-*)` strings for DOM use; a new `leaveHex()` serves the exporters. Engine functions (`canBook`, cycles, sync, import parsers, `rosterColor` consumers) are untouched; `wire()` targets ids/data-attributes, never the renamed classes.

**Tech Stack:** as Phases 1–2 (single-file vanilla JS, JSC suite `python3 tests/run.py`, deploy = `app.html` + `deploy/app.html` + `preview.html`; icons rasterised with Pillow, which is installed).

**Spec:** `MYROSTA-UI-STRATEGY.md` — "One visual system" (Ships list) + appendix "Visual system" findings 1–8 and the four-phase refactor plan; brand decision = one teal (line ~118).

> **As built (8 Sep 2026, branch `ui-phase3` → `main`, 229/229 + 7 lints):** the eyebrow is one rule with the four existing class names as aliases (`.eyebrow,.tile .k,.weekhdr,.nextlbl,.sheetlbl`) rather than a template rename; `.rlab` survives as a layout-only class (46 px rail) beside `tag solid am|pm|cst|lv`; `.tag.mini` handles the in-cell badges (PH, Today, locum L); the app icon's AM bar is `#4C86E8` — a lighter blue of the same hue, because `--am-t` reads dim on the navy tile (PM `#F2A638` and CST `#2FA86E` were already the bright variants); the toast prepends an icon node and a text node instead of a glyph prefix, and the local `ic` variable inside `toast()` was renamed so it no longer shadows `ic()`; the cloud status tag says "Cloud on" / "Cloud error" in words; the hero's main line drops the period word because the solid tag carries it; the public-holiday header tint needed `table.roster thead th.phhdr` to beat the sticky surface (it had been silently white); the mirror lint reads `PALETTE` keys as token names; radii outside tags and the 354 inline `style=` attributes were left for Phase 4 (only the recurring flex row became `.cluster`). **Skeptic pass (3 lenses, 14 confirmed, all fixed):** the hero rail uses new on-navy tokens `--am-rail/--pm-rail/--cst-rail` (the `-t` text tokens were 1.8–2.7:1 on the navy); under-cover counts on day cards and the grid use `--danger-t` (the RAG red was 3.2:1 as text); the selected-state hairline on segmented and zone buttons is `--accent-ink` (the bright teal was 2.7:1); the PH tint is `#F6F2AC` so it separates from PM amber by hue; the "X has it" hint is `--muted`; unmapped leave codes still export in their old grey via `--lv-other-bg`; the "Off" tag is `tag lg muted`; `.mcell .tag.mini` keeps the in-cell badges compact; the six original icons gained `aria-hidden`; `Save group details` no longer references the deleted `col`; the ⇄ ▸ ● glyphs and the CSS-drawn `›` summary chevron became icons; notify/toast literals lost their emoji and toasts gained a `warn` type; the lints now cover 3-digit hex in the script, those glyphs, CSS `content:` strings and notify/toast literals.

## Global Constraints

- Suite stays green (203 today); new tests in `tests/suite.js` inside the IIFE, `T(name,cond)`; new lints in `tests/run.py` print `PASS  css: …` / `FAIL  css: …` lines and count as failures.
- Engine untouched. No change to `S` shape except that `S.branding.primary` is kept in storage but ignored.
- Type: seven tokens `--fs-2xs .6875rem (11) · --fs-xs .75rem (12) · --fs-sm .8125rem (13) · --fs-md .9375rem (15) · --fs-lg 1.125rem (18) · --fs-xl 1.375rem (22) · --fs-2xl 1.75rem (28)`, plus two named exceptions `--fs-grid .625rem` (captions inside the 62 px roster-grid and planner-grid cells only) and `--fs-input 1rem` (phone inputs, so iOS does not zoom). No other `font-size:<n>px` anywhere.
- Colour: no hex literal in the stylesheet outside `:root`; none in the script outside the one `PALETTE` line; the brand mark SVG in the head/body is the only other place hex may appear. `#fff`/`#000`/`rgba()` are allowed.
- One radius for tags: `--radius-xs:6px`. Spacing tokens `--sp-1..6 = 4/8/12/16/24/32`.
- Restraint: filled teal appears only on `.btn.primary` and `.tab.active`. RAG red/amber/green appears in the roster grid only on the cover row.
- Keep the strengths list (next-shift hero, AM/PM/CST colour language, capacity-check prose, lifecycle confirm texts, focus/reduced-motion bones, phone roster day cards, open-round banner).
- Emoji stay only where they are content: the feedback mood picker (`data-mood`) and user-typed text. Text arrows (→ ↔) inside sentences and audit strings stay — they are typography, not chrome.

---

### Task 1: Type scale, eyebrow, spacing tokens, and the font-size lint

**Files:** `app.html` (`:root` 22–38; every `font-size` rule 41–381; script template literals at 1519, 1584, 1606, 1617, 1741, 1767, 1813, 1838–1842, 1892, 1901, 1920, 2198, 2200, 2250, 2261–2267, 2310, 2345–2346, 2405, 2410, 2431, 2481, 2503–2504, 2535, 2629, 2658, 2666, 2703, 2731, 3154, 3226–3228, 3246, 3364, 3562, 3635), `tests/run.py`, `tests/suite.js`.

**Produces:** tokens `--fs-*`, `--sp-*`, `--radius-xs`; one eyebrow rule (`.eyebrow,.tile .k,.weekhdr,.nextlbl,.sheetlbl`); `.cluster` utility; lint `css_fontsize_lint(html)`.

- [ ] **Step 1: Write the failing lint** in `tests/run.py` after `css_token_lint`:

```python
def css_fontsize_lint(html_text):
    """No font-size px literal outside :root — sizes come from the --fs-* scale."""
    root_end = html_text.find('}', html_text.find(':root{'))
    body = html_text[:html_text.find(':root{')] + html_text[root_end:]
    hits = re.findall(r'font-size:\s*\d+(?:\.\d+)?px', body)
    return hits
```
and in the report section: `fs_hits = css_fontsize_lint(html)` → `PASS  css: no font-size px literals outside :root` / `FAIL  css: N font-size px literals outside :root`.

- [ ] **Step 2: Run** `python3 tests/run.py | tail -3` → expect `FAIL  css: 119 font-size px literals…` (75 style + 44 script).

- [ ] **Step 3: Add the tokens** to `:root` (line 34, beside the radii):

```css
--fs-2xs:.6875rem; --fs-xs:.75rem; --fs-sm:.8125rem; --fs-md:.9375rem; --fs-lg:1.125rem; --fs-xl:1.375rem; --fs-2xl:1.75rem;
--fs-grid:.625rem; --fs-input:1rem;   /* the two named exceptions: 62px grid captions; phone inputs at 16px so iOS does not zoom */
--sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px;
--radius:14px; --radius-sm:10px; --radius-xs:6px;
```
and `html{font-size:100%}` before `body`.

- [ ] **Step 4: Map every stylesheet size** (a Python string edit over lines 41–381, then eyeball the diff):

| literal | token | exceptions |
|---|---|---|
| 8, 9, 9.5, 10, 11, 11.5 | `--fs-2xs` | `.dayname`, `.cap` inside `table.roster`, `.mcell .chip` → `--fs-grid` |
| 12 | `--fs-xs` | |
| 13, 13.5 | `--fs-sm` | |
| 14 | `--fs-md` (`button`, `.toast`, `.schedbar`, `.hsec`) | `.brand .dot` → `--fs-sm` |
| 15 | `--fs-md` | |
| 16 | `--fs-md` (`.brand`, `.sheetrow`) | `.agday .d .dd`, `.pmd .dd` → `--fs-lg`; mobile `input,select,textarea` (351) → `--fs-input` |
| 17, 18 | `--fs-lg` | |
| 20 | `--fs-xl` | |
| 25 | `--fs-2xl` | |

Replace the five eyebrow rules with one: `.eyebrow,.tile .k,.weekhdr,.nextlbl,.sheetlbl{font-size:var(--fs-2xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}` (keep each class's own margin/colour overrides: `.nextlbl{color:var(--navy-muted)}` lands in Task 2, until then keep `#9FB6C8`). Add `table.roster,.rcov,.qnum,.eqbar b{font-variant-numeric:tabular-nums}`. Add `.cluster{display:flex;gap:var(--sp-2);flex-wrap:wrap;align-items:center}`.

- [ ] **Step 5: Map the script literals.** Same table; grid exceptions: 2198, 2250 (9 px) and 2658, 2666 (10 px) are planner/roster grid cells → `--fs-grid`; 1617 (`font-size:20px` on the 🟢 span) is deleted in Task 4 — for now `--fs-xl`. Replace the exact inline pattern `style="display:flex;gap:6px;flex-wrap:wrap"` and `…;align-items:center"` with `class="cluster"` where the element has no other class (else append `cluster` to the class list).

- [ ] **Step 6: Suite tests** (append before the final render line of `tests/suite.js`):

```js
  // ---- Phase 3: type scale ----
  T("type: My shifts uses no px font-size literal", !/font-size:\s*\d+(\.\d+)?px/.test(viewMy()));
  T("type: the roster grid keeps its --fs-grid exception", viewRoster().indexOf("--fs-grid")>=0 || viewRoster().indexOf("font-size")<0);
```

- [ ] **Step 7: Run** `python3 tests/run.py | tail -3` → all PASS. Open the review copy at 375 px and 1280 px: My shifts, Roster, Daily, Settings — nothing wraps that did not wrap before; roster grid columns unchanged.

- [ ] **Step 8: Commit** `git commit -am "UI phase 3: seven-step type scale in rem, one eyebrow rule, spacing tokens, font-size lint"`.

---

### Task 2: Palette — every colour named, PALETTE mirror, PH stops borrowing PM amber

**Files:** `app.html` (`:root` 22–38; hex rules at 149, 159, 164, 167, 231, 233, 235, 246–247, 266–270, 274, 279, 293, 301–302, 305, 308, 323, 380–381; script 783–790 `leaveStyle`, 1616, 1748, 2001, 2735 `rosterColor`, 3155, 3227–3228, 3833), `tests/run.py`, `tests/suite.js`.

**Produces:** tokens `--neutral-2 --navy-2 --navy-muted --accent-line --warn-line --ph-bg --ph-t --lv-{al,cme,lsl,pl,ua,upl,ph}-{bg,t}`; `PALETTE` (script, one line, keys = token names); `leaveHex(code)`; `leaveStyle()` returns `var()` strings; lint `css_hex_lint`, `palette_mirror_lint`.

- [ ] **Step 1: Write the failing lints** in `tests/run.py`:

```python
def css_hex_lint(html_text):
    """Stylesheet hex only inside :root; script hex only on the PALETTE line."""
    st, en = html_text.find('<style>'), html_text.find('</style>')
    css = html_text[st:en]; r0 = css.find(':root{'); r1 = css.find('}', r0)
    css_body = css[:r0] + css[r1:]
    bad = [h for h in re.findall(r'#[0-9a-fA-F]{3,6}\b', css_body) if h.lower() not in ('#fff','#ffffff','#000')]
    script = html_text[html_text.find('<script>', en):]
    script = '\n'.join(l for l in script.split('\n') if not l.lstrip().startswith('const PALETTE='))
    bad += re.findall(r'#[0-9a-fA-F]{6}\b', script)
    return bad

def palette_mirror_lint(html_text):
    """Every PALETTE key is a :root token with the same value."""
    root = html_text[html_text.find(':root{'):]; root = root[:root.find('}')]
    tokens = dict((k, v.strip().upper()) for k, v in re.findall(r'(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})', root))
    m = re.search(r'const PALETTE=\{([^}]*)\}', html_text)
    if not m: return ['PALETTE missing']
    pal = re.findall(r'"(--[a-z0-9-]+)":"(#[0-9a-fA-F]{6})"', m.group(1))
    return [k for k, v in pal if tokens.get(k) != v.upper()] + ([] if pal else ['PALETTE empty'])
```
Report both as PASS/FAIL lines.

- [ ] **Step 2: Run** → FAIL (≈57 stylesheet + 33 script hex; PALETTE missing).

- [ ] **Step 3: Tokens.** Add to `:root`:

```css
--neutral-2:#F1F3F5; --hover:var(--neutral-2);
--navy-2:#16384F; --navy-muted:#9FB6C8; --accent-line:#CFE6E0; --warn-line:#E8D08A;
--ph-bg:#F6F2AC; --ph-t:#7E6410;
--lv-al-bg:#ECEAFB; --lv-al-t:#5448A8; --lv-cme-bg:#CFE7D5; --lv-cme-t:#1C5733; --lv-lsl-bg:#E7E9F1; --lv-lsl-t:#4C5474;
--lv-pl-bg:#FBE6EE; --lv-pl-t:#9B3D63; --lv-ua-bg:#F8E2DB; --lv-ua-t:#9E4A2E; --lv-upl-bg:#EFE6DD; --lv-upl-t:#6E5440;
--lv-ph-bg:#F6F2AC; --lv-ph-t:#7E6410;
```
(`--hover` was `#F1F3F5` — same value, now an alias; the seven leave pairs keep today's hex.)

- [ ] **Step 4: Collapse the stylesheet literals** (each → token):
`#F4F6F8` `#F6F8FA` `#f0f2f5` `#EEF1F4` `#F5F7F9` → `var(--neutral-2)` · `#eee` fallback at 164 → drop · print `#ddd` → `var(--line2)` · `.bell-badge #e23b3b`, `.toast.danger #9A2F33` → `var(--danger-t)` · `.toast #11233A` → `var(--navy)` · `.toast.ok #15633F` → `var(--ok-t)` · `.nextcard` gradient end `#16384F` → `var(--navy-2)` · `#9FB6C8` (302, 308) → `var(--navy-muted)` · `.nextwhen #CFE6E0`, `.fbprompt` border, `.msg.mine` border `#cfe0fb` → `var(--accent-line)` · `.rcrow.adm #EAF6F2` → `var(--accent-bg)` · `.rlab.am/.pm/.cst/.lv` → `var(--am-t)/(--pm-t)/(--cst-t)/(--leave-t)` · `.eqshare.lo` fallback → `var(--warn-t)`, `.eqshare.mid` → `var(--ok-t)` · PH family: `.ph-badge` → `color:var(--ph-t);background:var(--ph-bg);border-color:var(--warn-line)`; `th.phhdr`, `.mcell.ph`, `.agday.ph .d`, `.rcard.ph` background → `var(--ph-bg)`, `.rcard.ph` border → `var(--warn-line)`.

- [ ] **Step 5: Script.** Add after `EIC` (line 411):

```js
const PALETTE={"--am":"#E6EEFB","--am-t":"#2D5BA6","--pm":"#FBE9CE","--pm-t":"#8A5A12","--cst":"#E4F2E8","--cst-t":"#2F6B43","--locum":"#D6336C","--locum-t":"#A01F55","--neutral-2":"#F1F3F5","--muted":"#5A636E","--lv-al-bg":"#ECEAFB","--lv-al-t":"#5448A8","--lv-cme-bg":"#CFE7D5","--lv-cme-t":"#1C5733","--lv-lsl-bg":"#E7E9F1","--lv-lsl-t":"#4C5474","--lv-pl-bg":"#FBE6EE","--lv-pl-t":"#9B3D63","--lv-ua-bg":"#F8E2DB","--lv-ua-t":"#9E4A2E","--lv-upl-bg":"#EFE6DD","--lv-upl-t":"#6E5440","--lv-ph-bg":"#F6F2AC","--lv-ph-t":"#7E6410"};   // mirrors :root — the lint in tests/run.py fails if a value drifts; only the HTML exporters read it
```
Rewrite `leaveStyle`:

```js
function leaveTok(code){const c=(code||"").toUpperCase();
  if(c==="AL")return{k:"al",name:"Annual"}; if(c==="CME")return{k:"cme",name:"CME"}; if(c==="LSL"||c==="SAB")return{k:"lsl",name:"Long service / Sabbatical"};
  if(c==="PL")return{k:"pl",name:"Mat/Pat/PL/BL"}; if(c==="UA")return{k:"ua",name:"Unavailable"}; if(c==="UPL")return{k:"upl",name:"Unplanned leave"}; if(c==="PH")return{k:"ph",name:"Public holiday"};
  return{k:null,name:LEAVE_LABEL[code]||code};}
function leaveStyle(code){const t=leaveTok(code);const bg=t.k?"--lv-"+t.k+"-bg":"--neutral-2",tx=t.k?"--lv-"+t.k+"-t":"--muted";return{bg:"var("+bg+")",t:"var("+tx+")",name:t.name};}   // DOM: tokens
function leaveHex(code){const t=leaveTok(code);const bg=t.k?"--lv-"+t.k+"-bg":"--neutral-2",tx=t.k?"--lv-"+t.k+"-t":"--muted";return{bg:PALETTE[bg],t:PALETTE[tx],name:t.name};}   // exporters: real hex
```
`rosterColor` → `PALETTE["--am"]…` and `leaveHex(sh.code)`. Exporters: 3155 `#D6336C` → `${PALETTE["--locum"]}`; 3227 `leaveStyle(c)` → `leaveHex(c)`; 3228 `leaveStyle(c)` → `leaveHex(c)`, `#D6336C`/`#A01F55` → PALETTE. 1616 `#E8D08A` → `var(--warn-line)`; 1748 `#FFF7E6` → `var(--warn)`, `#EAF6F2` → `var(--accent-bg)`; 2001 and 3833 `#C0392B` → `var(--danger-t)`.

- [ ] **Step 6: Suite tests:**

```js
  // ---- Phase 3: palette ----
  T("palette: leaveStyle hands the DOM tokens", leaveStyle("AL").bg==="var(--lv-al-bg)" && leaveStyle("CME").t==="var(--lv-cme-t)" && leaveStyle("XYZ").bg==="var(--neutral-2)");
  T("palette: leaveHex hands the exporters hex", leaveHex("AL").bg==="#ECEAFB" && leaveHex("PH").t==="#7E6410" && leaveHex("AL").name===leaveStyle("AL").name);
  T("palette: rosterColor stays hex for the export", rosterColor({kind:"clinical",period:"AM"}).bg==="#E6EEFB" && rosterColor({kind:"leave",code:"UA"}).t==="#9E4A2E");
  var _dl=null, _dl0=download; download=function(c){_dl=String(c);}; try{ exportRosterXLS(); }catch(e){} download=_dl0;
  T("palette: the roster HTML export carries no var() — Excel cannot resolve tokens", _dl!==null && _dl.indexOf("var(--")<0);
```
(if `download` is not reassignable in the harness, stub `URL.createObjectURL` instead — check `tests/stubs.js`.)

- [ ] **Step 7: Run** → all PASS. Review copy: Planner (leave chips unchanged), Roster header on a PH day (pale yellow, not amber), toasts, Equity.

- [ ] **Step 8: Commit** `git commit -am "UI phase 3: palette tokenised — leave pairs, neutral, navy-2, PH colours; PALETTE mirror for exporters; hex lint"`.

---

### Task 3: One `.tag` component

**Files:** `app.html` (rules 84–87, 97–99, 126, 152, 166–167, 186, 195, 199, 265–266; template classes `pill` ×51, `chip` ×30, `badge-mode` ×6, `ph-badge` ×6, `locx` ×2, `lvchip` `todaytag` `sini` `rlab` ×1; `button.gapsbtn` 208), `tests/run.py`, `tests/suite.js` (2 `pill` references).

**Produces:** `.tag` with modifiers `lg mini solid am pm cst leave lv locum ok warn danger muted brand ph`; retired names gone; lint `retired_class_lint`.

- [ ] **Step 1: Failing lint:**

```python
RETIRED = ['pill','chip','badge-mode','lvchip','locx','todaytag','ph-badge','sini']
def retired_class_lint(html_text):
    st, en = html_text.find('<style>'), html_text.find('</style>')
    css = html_text[st:en]; script = html_text[en:]
    bad = [c for c in RETIRED if re.search(r'\.' + re.escape(c) + r'\b', css)]
    bad += [c for c in RETIRED if re.search(r'class="[^"]*\b' + re.escape(c) + r'\b', script)]
    return bad
```

- [ ] **Step 2: Run** → FAIL listing all eight.

- [ ] **Step 3: CSS.** Replace rules 84–87, 97–99, 126, 152, 166–167, 186, 195, 199, 265–266 with:

```css
.tag{display:inline-block;font-size:var(--fs-2xs);font-weight:600;line-height:1.3;padding:3px 8px;border-radius:var(--radius-xs);white-space:nowrap;vertical-align:middle;background:var(--neutral-2);color:var(--text)}
.tag.lg{font-size:var(--fs-xs);padding:4px 10px} .tag.mini{padding:0 4px;line-height:1.35;margin-left:4px}
.tag.am{background:var(--am);color:var(--am-t)} .tag.pm{background:var(--pm);color:var(--pm-t)} .tag.cst{background:var(--cst);color:var(--cst-t)} .tag.leave,.tag.lv{background:var(--leave);color:var(--leave-t)}
.tag.ok{background:var(--ok);color:var(--ok-t)} .tag.warn{background:var(--warn);color:var(--warn-t)} .tag.danger{background:var(--danger-bg);color:var(--danger-t)} .tag.muted{background:var(--neutral-2);color:var(--muted)}
.tag.brand{background:var(--accent-bg);color:var(--accent-ink)} .tag.ph{background:var(--ph-bg);color:var(--ph-t);border:1px solid var(--warn-line);font-weight:800;letter-spacing:.03em}
.tag.locum{box-shadow:0 0 0 2px var(--locum)} .locumleg{background:var(--locum-bg);color:var(--locum-t)}
.tag.solid{color:#fff;font-weight:700;letter-spacing:.03em;text-transform:uppercase;box-shadow:none} .tag.solid.am{background:var(--am-t)} .tag.solid.pm{background:var(--pm-t)} .tag.solid.cst{background:var(--cst-t)} .tag.solid.leave,.tag.solid.lv{background:var(--leave-t)} .tag.solid.locum{background:var(--locum)} .tag.solid.brand{background:var(--accent-ink)}
.rlab{flex:0 0 46px;text-align:center;padding-left:0;padding-right:0}   /* layout only — the colour comes from .tag.solid.* */
.mcell .tag{font-size:var(--fs-grid);padding:2px 5px;max-width:100%;white-space:normal;word-break:break-word;line-height:1.2;box-sizing:border-box}
```
Keep `button.gapsbtn` (208) and `.staffsum .chev` as they are.

- [ ] **Step 4: Templates** (sed inside `class="…"` only, then re-grep):
`pill` → `tag` · `chip` → `tag lg` (incl. dynamic `chip ${…}`) · `badge-mode` → `tag brand` · `lvchip` → `tag` · `locx` → `tag solid locum mini` · `todaytag` → `tag solid brand mini` · `ph-badge` → `tag ph mini` · `sini` → `tag brand mini` · `rlab ${cls}` → `tag solid ${cls} rlab`. Check the nine bare `chip` uses: each either sets an inline background (leave chips) or names a zone/time in the Daily board — keep them `tag lg`. Update the two `pill` references in `tests/suite.js`.

- [ ] **Step 5: Suite tests:**

```js
  // ---- Phase 3: tags ----
  S.viewAs="admin"; S.tab="roster";
  T("tags: the roster renders period chips as tags", /class="tag lg (am|pm|cst)/.test(viewRoster()));
  T("tags: the status pill is a tag", /class="tag (ok|warn|danger|muted)/.test(viewRoster()+viewSetup()));
  T("tags: nothing renders the retired names", !/class="[^"]*\b(pill|chip|badge-mode|lvchip|locx|todaytag|ph-badge|sini)\b/.test(viewRoster()+viewMy()+viewSetup()+viewDaily()+viewPlanner()));
```

- [ ] **Step 6: Run** → PASS. Review copy: Roster grid (chips), Roster mobile cards (solid rails), Planner (leave chips), Today/PH header badges, Staff list (`Make admin` etc. unaffected), Settings status pills.

- [ ] **Step 7: Commit** `git commit -am "UI phase 3: one .tag component replaces nine small labels"`.

---

### Task 4: SVG icons in place of emoji

**Files:** `app.html` (TIC 410, EIC 411, `.tic` 299, bell markup 390, `.bell` 230; emoji lines 390, 868, 1368, 1430–1431, 1438, 1510, 1556, 1617, 1717, 1799, 1858, 1893, 1993, 2086, 2105, 2131, 2152, 2228, 2234, 2243–2245, 2261, 2293 (toast), 2323, 2335–2337, 2378, 2380, 2390, 2428, 2541, 2618, 2641, 2673–2674, 2698, 2703, 2706, 2716, 3017, 3270, 3272, 3277, 3284–3286, 3295–3296, 3366, 3472, 3544, 3633), `tests/run.py`, `tests/suite.js`.

**Produces:** `TIC` + `download print lock unlock flag clockS live chevL chevR chevD chevU swap arrowUR holiday check x edit warn phone mail chat reply help clean scale calendar`; `ic(name)` → svg string or `""`; `.btn .tic,.note .tic,.tag .tic,.schedbar .tic{width:16px;height:16px;stroke:currentColor}`; lint `button_emoji_lint`.

- [ ] **Step 1: Failing lint:**

```python
EMOJI = re.compile('[☀-➿⬀-⯿\U0001F300-\U0001FAFF▴▾‹›↩↗]')
def button_emoji_lint(html_text):
    script = html_text[html_text.find('</style>'):]
    bad = []
    for m in re.finditer(r'<button([^>]*)>([^<]{0,120})', script):
        if 'data-mood' in m.group(1): continue
        if EMOJI.search(m.group(2)): bad.append(m.group(2).strip()[:40])
    for m in re.finditer(r'<(?:span|div) class="(?:note|schedbar|tag)[^"]*"[^>]*>([^<]{0,6})', script):
        if EMOJI.search(m.group(1)): bad.append(m.group(1).strip()[:40])
    return bad
```

- [ ] **Step 2: Run** → FAIL (~45).

- [ ] **Step 3: Icons.** Extend `TIC` (same 24-grid, stroke 1.7; every entry `<svg viewBox="0 0 24 24" class="tic">…</svg>`):

```js
download:'<path d="M12 4v11M7 10l5 5 5-5M4 19h16"/>', print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', flag:'<path d="M5 21V4h11l-1.5 4 1.5 4H5"/>', live:'<circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4"/>',
chevL:'<path d="M15 5l-7 7 7 7"/>', chevR:'<path d="M9 5l7 7-7 7"/>', chevD:'<path d="M5 9l7 7 7-7"/>', chevU:'<path d="M5 15l7-7 7 7"/>',
swap:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>', arrowUR:'<path d="M7 17L17 7M9 7h8v8"/>', holiday:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4M12 12l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 18l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z"/>',
check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>', edit:'<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/>', warn:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>',
phone:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>', mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', chat:'<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
reply:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>', help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.5"/>', clean:'<path d="M3 21l6-6M14 4l6 6-8 8-6-6z"/>',
scale:'<path d="M12 3v18M4 7h16M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>'
```
`function ic(n){const s=TIC[n];return s?s:"";}` — and `.btn .tic,.note .tic,.tag .tic,.schedbar .tic,.bell .tic{width:16px;height:16px;stroke:currentColor;vertical-align:-3px}`; `.bell .tic{width:20px;height:20px}`.

- [ ] **Step 4: Replace.** Buttons: `⬇` → `${ic("download")}` (`capPrint`/`eqPrint` → `print`); `✓ ` prefixes → `${ic("check")}`; `‹`/`›` nav buttons → `chevL`/`chevR`; `📱`/`✉️` auth method → `phone`/`mail`; `↩` → `reply`; `💬` → `chat`; Pattern button `🔒`/`⚑` → `lock`/`flag`; `▴` → `chevU`; header bell `🔔` → `${EIC.bell}` with class `tic`; `⇄` Group switcher → `swap`. Chrome prefixes: `.schedbar` 🕒/🟢/🔒 → `clockS`(=clock)/`live`/`lock`; `.note` 🔒 → `lock`, ✎ → `edit`, ❓ → `help`, ⚠ → `warn`, 📅 → `calendar`(=cal), ⚖️ → `scale`, 🧹 → `clean`; open-round banner (1617) 🟢 span → `${ic("live")}` with `color:var(--ok-t)`; tags 🔒/⚑/❓/✓ → icons; list-row `›` chevrons → `chevR`; `.chev` ▾/▸ → `chevD`/`chevR`; stepper `✓` (2323) → `check`; checklist `✓` (3017) → `check`. Toast (2293): build `t.innerHTML=(type==="ok"?ic("check"):type==="danger"?ic("warn"):"")` then `t.appendChild(document.createTextNode(String(msg)))`. Help copy 3272/3277/3284–3286/3295: drop the glyphs, keep the words. `📱 +61…` (1893) → `${ic("phone")} +61…`. `MOODLBL` and the three mood buttons keep their emoji.

- [ ] **Step 5: Suite tests:**

```js
  // ---- Phase 3: icons ----
  T("icons: ic() returns an svg for a known name and nothing for an unknown one", ic("download").indexOf("<svg")===0 && ic("nope")==="");
  T("icons: export buttons carry the download icon, not the arrow emoji", exportMenuHTML().indexOf('class="tic"')>=0 && exportMenuHTML().indexOf("⬇")<0);
  T("icons: the mood picker keeps its emoji", viewMy().indexOf("🙂")>=0 || typeof MOODLBL==="object");
```

- [ ] **Step 6: Run** → PASS. Review copy: header bell 44 px with SVG; export menu; Daily arrows; auth method buttons; schedule banner; roster notes.

- [ ] **Step 7: Commit** `git commit -am "UI phase 3: SVG icons replace emoji in buttons, banners and notes; ic() helper; button-emoji lint"`.

---

### Task 5: One teal — brand by identity; quiet the filled-teal states

**Files:** `app.html` (rules 50, 66, 136, 140, 175, 285–286, 315; `applyBranding` 768–770; branding card 1775; validator 3761), `tests/suite.js`.

- [ ] **Step 1: Failing tests:**

```js
  // ---- Phase 3: brand ----
  S.viewAs="admin"; _setupTab="group";
  T("brand: the accent-colour field is gone — one teal for every group", viewSetup().indexOf('id="brColor"')<0);
  S.branding={primary:"#123456"}; applyBranding();
  T("brand: a stored accent colour is ignored", (document.documentElement.style.getPropertyValue("--brand-primary")||"")==="");
  S.branding={};
```

- [ ] **Step 2: Run** → 2 FAIL.

- [ ] **Step 3: Implement.** Delete the `setProperty("--brand-primary",…)` line in `applyBranding` (keep the wordmark/name logic); rules 50/285/286 → `var(--accent-ink-2)` / `var(--navy)` / `var(--accent-ink)`; remove the Accent colour `<div class="field">` at 1775 and the hex validation + `primary:` write at 3761 (keep other branding fields). Restraint: `.seg button.on{background:var(--accent-bg);color:var(--accent-ink);box-shadow:inset 0 0 0 1px var(--accent);font-weight:600}`; `.zonebtns button.on{background:var(--accent-bg);border-color:var(--accent);color:var(--accent-ink)}`; `.hnum{background:var(--neutral-2);color:var(--navy)}`; `.agday.we .d .dn{color:var(--muted)}`. Group-setup runbook/Help copy that mentions an accent colour → remove the sentence.

- [ ] **Step 4: Run** → PASS. Review copy: Settings → Group card; segmented toggles; zone buttons in booking; agenda weekend labels.

- [ ] **Step 5: Commit** `git commit -am "UI phase 3: one teal for every group — accent-colour field removed; filled teal reserved for primary buttons and the active tab"`.

---

### Task 6: The signature — period colours on the hero and the app icon

**Files:** `app.html` (`.nextcard` 301–311, hero markup 3436–3440, favicon line 14, logo 386), `icon-180.png icon-192.png icon-512.png` (+ `deploy/`), `tests/suite.js`, `tests/run.py`, scratchpad `make-icons.py`.

- [ ] **Step 1: Failing tests:**

```js
  // ---- Phase 3: signature ----
  S.viewAs="s1"; S.tab="my"; var _hero=viewMy();
  T("signature: the hero carries the period as a solid tag and a data-period", /<div class="nextcard" data-period="(am|pm|cst)"/.test(_hero) && /class="tag solid (am|pm|cst)/.test(_hero));
```
and in `run.py`: `PASS  icon: brand mark bars are AM/PM/CST` when line 14 and the logo both contain `2D5BA6`, `F2A638`, `2FA86E` and no `E04B4B`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Hero.** `.nextcard{…;border-left:5px solid var(--accent);position:relative}` `.nextcard[data-period="am"]{border-left-color:var(--am-t)} …pm…cst`; `.nextcard .tag.solid{margin-right:8px}`. Markup: `<div class="nextcard" data-period="${per}">` where `per=nextSh?(nextSh.sh.kind==="cst"?"cst":nextSh.sh.period.toLowerCase()):"none"`, and the main line becomes `<div class="nextmain">${nextSh?`<span class="tag solid ${per}">${per.toUpperCase()}</span>`:""}${escapeHTML(nextMain)}</div>` — `shiftLabel` still says "AM · ROC", so keep the tag as the period word and strip the duplicate "AM"/"PM"/"CST" prefix from `nextMain` when the tag carries it.

- [ ] **Step 4: Icon.** Line 14 and line 386: `#E04B4B` → `#2D5BA6` (AM), keep `#F2A638` (PM), keep `#2FA86E` (CST). `scratchpad/make-icons.py` (Pillow): navy `#0F243A` rounded square (rx = 27.5 % of side), white M polyline (17,31)-(17,11)-(24.5,22)-(32,11)-(32,31) on the 40-grid, stroke 3.2/40, round joins; bars (7→14,13) blue, (7→12,21) amber, (7→14,29) green, stroke 2.2/40 round caps; render 180 (white background under the rounded square), 192 (transparent), 512 (full-bleed navy, mark scaled to the inner 80 % for maskable). Write both root and `deploy/`.

- [ ] **Step 5: Run** → PASS. Review copy: My shifts hero at 375 px (rail + tag, one line); compare icons with `Read` on the PNGs.

- [ ] **Step 6: Commit** `git commit -am "UI phase 3: the period rail on the hero; app icon bars become AM/PM/CST"`.

---

### Task 7: Sync, measure, adversarial review, docs, merge

- [x] `cp app.html deploy/app.html`; regenerate `preview.html`; suite on both; rebuild the review copy; measure at 375 and 1280: `getComputedStyle` font sizes on My shifts hero/tiles/roster grid, no horizontal scroll, header height unchanged (≤ 120 at 375), 0 hex in stylesheet outside :root, 0 emoji in buttons, PALETTE mirror green; before/after screenshots of My shifts, Roster, Daily, Settings.
- [x] Workflow: 3 skeptics (contrast of every new pair on its background ≥ 4.5:1 for text, the `.tag.solid.*` whites included; export HTML/Excel unchanged cell colours; class-rename fallout in class-based selectors and tests). Fix confirmed items.
- [x] CHANGELOG "8 Sep 2026 — UI phase 3"; strategy note DONE; as-built note here; fast-forward `main`; user pushes; `curl` check for `--fs-md`.

## Self-review
- Coverage: type scale + eyebrow + tabular-nums (T1) · palette + PALETTE + PH (T2) · tag (T3) · icons (T4) · brand + restraint (T5) · signature hero + icon (T6) · token check in suite (T1/T2/T3/T4 lints) · spacing tokens + `.cluster` (T1).
- Out of scope (noted for Phase 4): the 354 inline `style=` attributes beyond the recurring flex cluster; the button class-order normalisation; dark mode.
- Type consistency: `ic(name)`, `leaveTok(code)`, `leaveStyle(code)`, `leaveHex(code)`, `PALETTE` (keys = token names), `.tag` modifiers `lg mini solid am pm cst leave lv locum ok warn danger muted brand ph`, `--fs-*`, `--sp-*`, `--radius-xs`, `--neutral-2 --navy-2 --navy-muted --accent-line --warn-line --ph-bg --ph-t --lv-*`.
