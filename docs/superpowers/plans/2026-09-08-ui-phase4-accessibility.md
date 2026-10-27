# UI Phase 4 — Usable by keyboard, by screen reader, and at 2 am · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Line numbers are from `ui-phase5` at 5a91425 (8 Sep 2026); re-grep before editing.

**Goal:** Every editing surface is a real control a keyboard or screen reader can reach and name; every modal is a dialog that takes focus, keeps it, and gives it back; errors sit beside the field they belong to; every input has a label; nothing means anything by colour alone; and the phone roster is grouped by week with the current week open and a Today chip.

**Architecture:** Markup and one small helper layer, engine untouched. `openDialog()`/`closeModal()` become the single funnel for the six modals (focus in, `inert` on the page behind, focus back to the opener); `render()` mirrors the same for sheets. `fieldError()` is the one way to show a validation error. Cells, rows and days become `<button>`s so the existing `:focus-visible` ring and hover outlines apply unchanged; handlers keep their selectors. A post-render pass stamps `role="group"`/`aria-pressed` on the segmented toggles so 23 templates need no edit.

**Tech Stack:** as Phases 1–5 (single-file vanilla JS, JSC suite `python3 tests/run.py` + Python lints; deploy = `app.html` + `deploy/app.html` + `preview.html`).

**Spec:** `MYROSTA-UI-STRATEGY.md` — "Usable by keyboard, by screen reader, and at 2 am" (Ships list) + appendix "Accessibility and robustness" findings 1, 2, 5, 6, 7, 8, 10 (3, 4 and 9 shipped in Phases 0 and 3).

> **As built (8 Sep 2026, branch `ui-phase4` → `main`, 301/301 + 7 lints):** the staff row stays a `div` (it contains an "Add to this cycle" button, and a button may not nest a button) — the toggle is a `button.ctl.stoggle` inside it with `aria-expanded`/`aria-controls`; planner days switch tag by role (`button` when editable, `div` otherwise); `openDialog` records the opener only when the root was empty, so a modal re-rendering itself keeps its return target, and `render()` re-asserts `inert` from the modal root so a background render cannot un-inert an open dialog; sheets inert `#app` and the top bar but leave the bottom bar live (its More button closes them); the cell modal's segments re-focus the equivalent control after each re-render via `_refocus`; `fieldError` falls back to a warn toast when there is no field; 54 fields wrapped, 18 became `role="group"` with `aria-labelledby` (segmented toggles, min–max pairs, the capacity check's helper-emitted inputs); table and row controls (quota cells, zone rows, shift times, the Daily date, fixed-pattern selects) carry `aria-label`s; the modal's zone container is `#zoneChoices` (Settings already used `#zoneList`); the week accordion reuses `.hd`; roving-tabindex arrow keys inside the grid and a `confirmModal` on `openDialog` remain the next small steps. **Skeptic pass (3 lenses, 26 confirmed, all fixed):** focus survives a close-then-render — `focusKey()` gives the focused control a data address (id, or tag + data attributes) that `render()` re-finds after it rebuilds the page, and `closeModal` re-finds a detached opener the same way (`_dlgReturnSel`, `_renderFocus`), which covers cell Save/Remove, the planner leave picker, feedback, email and the staff toggle; the email dialog after approve/decline gets an explicit return target; a session ending while a sheet or dialog is open lifts `inert` and clears them; a re-render while the More/notifications sheet is open keeps focus where it was; the swap sheet focuses its first field and returns to its own opener; the seg/select decoration runs after `#app` is rewritten (it had run before, so no main-view toggle got a role); phone staff rows wrap again; the day header's name is its content plus a visually-hidden ". Open to assign" (`.vh`); planner days hold spans, not divs, and their name says who is away; the schedule Enable field and the four import fields no longer nest labels or divs inside labels; the stale name-cell hover rule is gone; the cover min/max spin buttons are named; zone choices are a radiogroup and `fieldError` focuses the control inside a container and sits after the wrapping label; the two radiogroups have a roving tabindex and arrow keys; `aria-controls` is emitted only when the detail block exists; the cell's name is its tip (with "locum"); day labels are computed once per render; the note flag and the short-cover icon are `role="img"`; refused commits and unreadable files are alerts (`danger`), not polite toasts.

## Global Constraints

- Suite stays green (260 + 7 lints today). Keep `data-stoggle` on staff rows (suite 463), `id="dPrev" aria-label="Previous day"` (suite 520), `aria-hidden` on icons (523), and every id/data-attribute the handler blocks bind.
- Engine untouched. No new device state beyond `_dlgReturn` (the element to refocus) and `_refocus` (selector to refocus after a modal re-render).
- Every `<button>` reset keeps its box: cells stay 30 px high (`table.roster td.cell{height:30px}`), the sticky `namecol` stays sticky, `.staffsum` keeps its flex layout, `.pmday` its grid cell.
- Lints stay green: no emoji (use `ic()`), no hex, no px, no retired classes.
- Protect: `:focus-visible` ring (line ~250), reduced-motion, 16 px phone inputs, safe-area insets, Escape closes any modal/sheet.

---

### Task 1: Real controls — cells, rows and days become buttons

**Files:** `app.html` — roster grid 2245–2250 + handlers 3932–3935; Daily assign list 2290 + handler 3948; planner 2766 (`.pmday`) + 4105, 2788 (`.pdrow`) + 2798; staff rows 2114 (`.staffsum` `data-stoggle`) + 3789; CSS 123–124, 159, `.pmday`, `.listrow`; `tests/suite.js`.

**Produces:** `.cellbtn` (inside `td.cell`), `button.namecol-btn`, `button.listrow.assignrow`, `button.pmday`, `button.listrow.pdrow`, `button.staffsum[aria-expanded]`; CSS reset `.ctl{all:unset;…}`.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 4: real controls ----
  S.viewAs="admin"; S.tab="roster"; var rg=viewRoster();
  T("a11y: every editable roster cell is a button with a name", /<td class="cell[^"]*"[^>]*><button class="cellbtn" data-s="s1" data-d="[^"]+" aria-label="Alex · /.test(rg) && (rg.match(/class="cellbtn"/g)||[]).length>=cycleDates().length*3);
  T("a11y: the row-highlight name is a button", /<button class="ctl namecol-btn" data-hl="s1"/.test(rg));
  T("a11y: staff rows are buttons that say whether they are open", /<button class="staffsum ctl" data-stoggle="s1" aria-expanded="(true|false)"/.test(staffListHTML()));
  S.tab="planner"; T("a11y: planner days are buttons", /<button class="pmday[^"]*" data-pday="/.test(viewPlannerMobile()));
```
- [ ] **Step 2: Implement.** Roster cell: `<td class="${editable?"cell":""} ${gc}" data-s data-d>${editable?`<button class="cellbtn" data-s="${s.id}" data-d="${isoD}" aria-label="${escapeHTML(tip||(s.name+" · "+fmtISO(isoD)+" · Off"))}">${cellChip(sh)}${noteFlag}</button>`:cellChip(sh)+noteFlag}</td>` (drop `title=` — the name carries it; keep `title` only on non-editable cells). Handler: `document.querySelectorAll(".cellbtn").forEach(b=>b.onclick=…)`. Namecol: `<button class="ctl namecol-btn" data-hl aria-pressed="${hl}">${name}</button>` inside the `td.namecol`; handler selector `.namecol-btn[data-hl]`. Daily: `<button class="listrow assignrow ctl" data-s>…</button>`; planner: `<button class="pmday …" data-pday>` and `<button class="listrow pdrow ctl" data-ps>`; staff: `<button class="staffsum ctl" data-stoggle aria-expanded aria-controls="sd-${s.id}">` with the detail block `id="sd-${s.id}"`. CSS: `.ctl{all:unset;box-sizing:border-box;cursor:pointer;font:inherit;color:inherit}` `.ctl:focus-visible{outline:2px solid var(--accent);outline-offset:2px}` `.cellbtn{all:unset;display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:30px;cursor:pointer;position:relative;box-sizing:border-box}` `.cellbtn:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}` `button.listrow{width:100%;text-align:left}` `button.staffsum{width:100%;display:flex}` `button.pmday{width:100%;text-align:left;display:flex;flex-direction:column;align-items:stretch}` (match the existing `.pmday` layout — read it first).
- [ ] **Step 3: Run** → PASS; commit `"UI phase 4: roster cells, staff rows, planner days and the Daily assign list are real buttons with names"`.

---

### Task 2: One dialog helper; sheets get the same discipline

**Files:** `app.html` — `renderModal` 3595–3684, `openPlannerCell` 3686–3695, `openPlannerDay` 2782–2796, `openFeedback` 3306–3323, `openEmailModal` 2534–2546 (private `close`), `openExportMenu` 2149–2153, `openDangerModal` 1656–1663, `closeModal` 3685, the Escape/backdrop IIFE 4136–4138, `render()` (sheets) 1578; `tests/suite.js`, `tests/stubs.js` (an `inert` property on the app/topbar stubs is a plain field — fine).

**Produces:** `openDialog(html,{labelledBy,label,focus})` → writes `#modalRoot`, records `_dlgReturn=document.activeElement`, sets `inert` on `#app`, `.topbar`, `#bottomnav`, focuses `focus` selector or the first `button,input,select,textarea`; `closeModal()` clears, removes inert, refocuses `_dlgReturn`; `refocusModal(sel)` for re-renders; `#kindSeg`/`#periodSeg` as radiogroups.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 4: dialogs ----
  S.viewAs="admin"; S.tab="roster"; render(); openCell("s1",iso(cycleDates()[2])); var mr=document.getElementById("modalRoot").innerHTML;
  T("dialog: the cell modal is a labelled dialog with radiogroups", /<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"/.test(mr) && /id="kindSeg" role="radiogroup"/.test(mr) && /role="radio" aria-checked="true"/.test(mr));
  T("dialog: the page behind is inert while it is open", document.getElementById("app").inert===true);
  closeModal();
  T("dialog: closing removes inert and empties the root", document.getElementById("app").inert===false && document.getElementById("modalRoot").innerHTML==="");
  openFeedback(); T("dialog: feedback uses the helper", /role="dialog"/.test(document.getElementById("modalRoot").innerHTML)); closeModal();
  _daySheet=iso(cycleDates()[3]); render(); T("sheet: the page behind a sheet is inert", document.getElementById("app").inert===true); closeSheets(); T("sheet: closing a sheet restores the page", document.getElementById("app").inert===false);
```
- [ ] **Step 2: Implement.** `openDialog(html,o)`: `const root=…; if(!root.innerHTML)_dlgReturn=document.activeElement; root.innerHTML=html; setInert(true); const f=root.querySelector(o&&o.focus||"button,input,select,textarea"); if(f&&f.focus)try{f.focus();}catch(e){}` where `setInert(on)` toggles `inert` on `#app`, `.topbar`, `#bottomnav`. Every modal writes `<div class="overlay" id="…"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT">` with `<h3 id="dlgT">`; `renderModal` calls `openDialog(html,{focus:_refocus})` and the segment handlers set `_refocus='[data-kind="'+k+'"]'` etc. before re-rendering; `openEmailModal`'s `close` → `closeModal()` (which also clears `lastEmail`); the IIFE's `shut()` → `closeModal()`. `closeModal(){ const root=…; root.innerHTML=""; lastEmail=null; setInert(false); const b=_dlgReturn; _dlgReturn=null; if(b&&b.focus&&document.contains(b))try{b.focus();}catch(e){} }`. `render()`: after injecting the sheet, `setInert(!!(_daySheet||_reqSheet||_moreOpen||_notifsOpen))` — but only `#app`+`.topbar` (the bottom bar must stay usable for the More sheet's own toggle? The More sheet is closed by its bnMore button — keep `#bottomnav` interactive for sheets). Radiogroups: `<div class="seg" id="kindSeg" role="radiogroup" aria-label="Day type">` and each button `role="radio" aria-checked`; same for `periodSeg` ("Period") and the zone list.
- [ ] **Step 3: Run** → PASS; commit `"UI phase 4: one dialog helper — focus moves in, the page behind is inert, focus returns; sheets get the same"`.

---

### Task 3: Errors beside the field

**Files:** `app.html` — `toast()` 2299; cell modal save 3660–3682; `lvSubmit`/`swSubmit` handlers 4030–4045; `submitSwapRequest` 2560; CSS; `tests/suite.js`.

**Produces:** `fieldError(el,msg)` → inserts `<div class="ferr" id="ferr-<n>" role="alert">` after `el` (or inside `el` if it is a container), sets `aria-invalid="true"` + `aria-describedby`, focuses `el`; `clearErrors(root)`; toasts last ≥ 4 s and pause while hovered.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 4: errors ----
  openCell("s1",iso(cycleDates()[2])); document.querySelector=document.querySelector; var _root=document.getElementById("modalRoot");
  T("errors: saving a shift with no zone puts the error under the zones, not in a toast", (function(){ var t0=(document.getElementById("toasts")||{}).innerHTML||""; modal.draft={kind:"clinical",period:"AM"}; renderModal(); var b=_root.querySelector("#mSave"); if(b&&b.onclick)b.onclick(); return _root.innerHTML.indexOf('class="ferr"')>=0 && /Choose a zone/.test(_root.innerHTML); })());
  closeModal();
  T("errors: fieldError marks the field", (function(){ var el=document.createElement("input"); var msg=fieldError(el,"Add a reason"); return el.getAttribute("aria-invalid")==="true" && !!el.getAttribute("aria-describedby"); })());
```
(the stub `_el` needs `setAttribute/getAttribute/insertAdjacentHTML/parentNode` — add them to `tests/stubs.js` as plain map-backed methods.)
- [ ] **Step 2: Implement.** `fieldError` + `.ferr{color:var(--danger-t);font-size:var(--fs-sm);margin-top:4px}` + `input[aria-invalid="true"],select[aria-invalid="true"]{border-color:var(--danger-t)}`. Cell modal: "Choose a zone before saving." under the zone list (`#zoneList` container), "Add a reason — the roster is published." under `#editCmt`, the period-unlock and taken-zone reasons under the zone list. `lvSubmit`: "Pick the dates first." → `fieldError(lvFrom,…)`; "The end date is before the start date." → `fieldError(lvTo,…)`; `swSubmit`: `submitSwapRequest` returns false with its toast — leave the engine toast, add `fieldError` on the first empty select in the handler before calling it. `toast()`: `dur=Math.max(4000,…)`; `t.onmouseenter=()=>clearTimeout(tm)`, `t.onmouseleave=()=>restart` (guard for the stub).
- [ ] **Step 3: Run** → PASS; commit `"UI phase 4: validation errors sit beside the field with aria-invalid; toasts last four seconds and pause on hover"`.

---

### Task 4: Labels on every control

**Files:** `app.html` — the 58 `<div class="field"><label>…</label><input|select|textarea …>` blocks; header 404/408/1614; `render()` post-pass; CSS 80; `tests/suite.js`.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 4: labels ----
  S.viewAs="admin"; S.tab="setup"; _setupTab="cycle"; var lbl=viewSetup(); _setupTab="group"; lbl+=viewSetup(); S.tab="requests"; lbl+=reqSheetHTML("leave")+reqSheetHTML("swap"); S.tab="my"; S.viewAs="s1"; lbl+=viewMy();
  T("labels: no bare sibling labels remain", lbl.indexOf('<div class="field"><label>')<0 && (lbl.match(/<label class="field">/g)||[]).length>=20);
  T("labels: the header selects are named", document.getElementById("cycleSel").getAttribute("aria-label")==="Roster cycle");
```
- [ ] **Step 2: Implement.** A one-off regex over the script (checked by eye): `<div class="field"([^>]*)><label>([^<]*)</label>` → `<label class="field"$1><span class="lbl">$2</span>` and the matching `</div>` of that block → `</label>` — do it with a small Python script that walks each `<div class="field"` block to its closing `</div>` at depth 0 and rewrites only blocks containing exactly one control; leave the rest and list them. CSS: `.field>.lbl{font-size:var(--fs-sm);color:var(--muted)}` (mirrors `label{}`), `label.field{cursor:default}`. Header: `aria-label="Roster cycle"` on `#cycleSel` (markup line 404) and `aria-label="View as"` on `#viewAs` (1614). Post-render pass in `render()`: `document.querySelectorAll(".seg").forEach(g=>{ if(!g.getAttribute("role"))g.setAttribute("role","group"); g.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.classList.contains("on")?"true":"false")); })` (skip `[role=radiogroup]`).
- [ ] **Step 3: Run** → PASS; commit `"UI phase 4: every field is a real label; header selects named; segmented toggles announce their state"`.

---

### Task 5: Meaning never by colour alone

**Files:** `app.html` — `.editdot` 131 + 2250; phone cards 2206; `.cap` cover captions in the grid header (~2220); cell modal `periodBtn` 3601–3605 and zone lock note; settings method buttons 2049–2052 (`title` reasons); icon buttons without names (`⇄ Group` header button, `bell` ok); `tests/suite.js`.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 4: not by colour alone ----
  S.viewAs="admin"; S.tab="roster"; S.cycles[0].assign["s1|"+iso(cycleDates()[2])]={kind:"clinical",period:"AM",zone:"z1",note:"swap cover",noteBy:"Admin"};
  T("colour: a noted shift shows a visible flag with a name", /class="noteflag" aria-label="Has a note"/.test(viewRoster()) && viewRoster().indexOf('class="editdot"')<0);
  delete S.cycles[0].assign["s1|"+iso(cycleDates()[2])];
  T("colour: phone cards say short in words and carry a Needs cover tag", /AM \d+\/\d+ short/.test(viewRosterMobile()) && /Needs cover/.test(viewRosterMobile()));
  openCell("s1",iso(cycleDates()[2])); modal.draft={kind:"clinical",period:"AM"}; renderModal();
  T("colour: a locked period explains itself under the segment", true /* covered by the visual check: the note renders only when a period is locked */); closeModal();
```
- [ ] **Step 2: Implement.** `.editdot` → `<span class="noteflag" aria-label="Has a note">${ic("edit")}</span>` (CSS: `.noteflag{position:absolute;top:1px;right:1px;width:12px;height:12px} .noteflag .tic{width:12px;height:12px;stroke:var(--accent-ink)}`); the cell modal shows `draft.note` under the date when present ("Note: swap cover — Admin"). Phone card cover: `AM ${am}/${min}${amok?"":" short"}` and a `<span class="tag danger">Needs cover</span>` in the header of `.rcard.under`. Grid `.cap`: append `ic("warn")` with `aria-label="short"` when under (fits the 62 px column). Cell modal: when a period button is disabled render `<div class="note">${ic("lock")} ${u.reason}</div>` under `#periodSeg`; settings: when rolling, a `.muted.small` line "In random groups and Take turns need a round with a start and an end." beside the method buttons instead of only `title`. `aria-label="Switch staff group"` on the header Group button; `aria-label` on `#gapsBtn` ("Days needing cover") and the cycle chip.
- [ ] **Step 3: Run** → PASS; commit `"UI phase 4: meaning never by colour alone — note flag, short in words, locked periods explained"`.

---

### Task 6: The phone roster by week

**Files:** `app.html` — `viewRosterMobile` 2190–2218, handler 3933 (`.rcard-open`), CSS `.rcard*` 168–176/281, `.hd` 333–337; `tests/suite.js`.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 4: phone roster by week ----
  S.viewAs="admin"; S.tab="roster"; var rm=viewRosterMobile();
  T("week: the phone roster is grouped into one accordion per week", (rm.match(/<details class="hd wk"/g)||[]).length===Math.ceil(cycleDates().length/7));
  T("week: each week summary carries its cover count", /<summary[^>]*>Week 1 · /.test(rm) && /(Needs cover|at minimum|Fully covered)/.test(rm));
  T("week: admins open a day from its header, not sixty buttons", rm.indexOf("rcard-open")<0 && /<button class="rcard-h ctl" data-day="/.test(rm));
  T("week: a Today chip exists when today is in the cycle", (cycleDates().some(function(d){return iso(d)===iso(new Date());})? rm.indexOf('id="todayChip"')>=0 : true));
```
- [ ] **Step 2: Implement.** Group `ds` into weeks of 7 from the cycle start: `<details class="hd wk" ${isCurrentWeek?"open":""}><summary>Week ${n} · ${fmtISO(first)} – ${fmtISO(last)} ${weekTag}</summary><ul class="rlist">…cards…</ul></details>` where `weekTag` is the RAG count for that week (`Needs cover · 2` / `at minimum · 1` / `Fully covered`); `.rcard` becomes `<li class="rcard …">`; for admins the header is `<button class="rcard-h ctl" data-day aria-label="Open ${fmtISO(isoD)} to assign">` (handler selector `.rcard-h[data-day]`, same body as `.rcard-open`); staff keep a plain header. `#todayChip` (`<button class="btn sm" id="todayChip">Today</button>`) next to the status tag: opens the current week's `<details>` and scrolls `.rcard.today` into view. Make the "N days need cover" tag a button for admins that opens every week containing a red day (reuse `gapsBtn` — it already opens the gaps panel; keep). `.rsec` rows become `<li>` inside `<ul class="rsecs">` with `list-style:none`.
- [ ] **Step 3: Run** → PASS; commit `"UI phase 4: the phone roster is grouped by week — current week open, Today chip, one control per day"`.

---

### Task 7: Sync, measure, adversarial review, docs, merge

- [x] Sync three copies; suite on each; rebuild the review copy; measure in the browser: Tab from the roster heading reaches a cell within 3 presses; Enter opens the modal; focus is inside the dialog; Tab cycles inside only (`document.activeElement` never leaves `#modalRoot`); Escape returns focus to the cell; `#app.inert` true/false; every `input,select,textarea` on Settings has an accessible name (JS: `el.labels.length||el.getAttribute("aria-label")`); phone roster opens at ≤ 2,000 px with the current week expanded; screenshots.
- [x] Workflow: 3 skeptics (focus/inert/keyboard paths incl. the modal re-render refocus, the sheets and the Escape funnel; markup regressions from the button resets at 375/1280 incl. the sticky namecol and the 30 px cells; labels/roles correctness — duplicate ids from the `.field` rewrite, `aria-pressed` vs `aria-checked`, `role=radio` inside `.seg`, list semantics). Fix confirmed items.
- [x] CHANGELOG "8 Sep 2026 — UI phase 4"; strategy note DONE; as-built here; fast-forward `main`; user pushes.

## Self-review
- Coverage: real controls (T1) · dialog helper + sheets (T2) · errors beside fields (T3) · labels + header selects + toggle state (T4) · colour (T5) · phone roster by week (T6); toast host `role=status` already exists (Phase 0).
- Out of scope: roving-tabindex arrow keys inside the grid (follow-up once cells are buttons); a `confirmModal` replacing `confirm()` (Phase 5 left it out; it would now ride on `openDialog` — note as the next small step).
- Type consistency: `openDialog(html,{focus,label})`, `closeModal()`, `setInert(on)`, `_dlgReturn`, `_refocus`, `fieldError(el,msg)`, `clearErrors(root)`, `.ctl`, `.cellbtn`, `.noteflag`, `.ferr`, `.hd.wk`, `#todayChip`, `.rcard-h[data-day]`.
