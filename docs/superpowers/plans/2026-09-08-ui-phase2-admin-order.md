# UI Phase 2 — The admin's working order · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The code map for every line number below is `scratchpad/admin-map.md` (produced 8 Sep 2026 from `main`); re-grep before editing — numbers drift as tasks land.

**Goal:** An admin runs a round from one screen, fixes gaps from a list, and finds every setting in one of two halves ("This cycle" / "This staff group") with consistent saving; a new staff group's admin is walked through the ten setup questions.

**Architecture:** Presentation layer + a few small pure helpers (`setCycleStatus`, `shortSlots`, `staffFiltered`, `setupChecklist`, `setupTabFor`). Status transitions get ONE global handler (hoisted out of the Settings gate) with a confirm that names who is notified. Settings is split by a device-side `_setupTab`; every card gains an id so `go()` anchors and the checklist can reach it, and `go()` opens the right half for an anchor. The engine (`canBook`, cycles, sync, import parsers) is untouched.

**Tech Stack:** as Phase 1 (single-file vanilla JS, JSC suite `python3 tests/run.py`, deploy = `app.html` + `deploy/app.html` + `preview.html`).

**Spec:** `MYROSTA-UI-STRATEGY.md` (Phase 2 + appendix "The admin workflow"), `MYROSTA-GROUP-SETUP.md` Part B (the ten questions), `docs/superpowers/plans/2026-09-08-ui-phase1-phone-nav.md` (conventions: `go()`, `data-go`, `_secOpen`, sheets).

> **As built (8 Sep 2026, branch `ui-phase2` → `main`, 203/203):** the status buttons are verbs (Open booking / Close booking / Publish / Reopen booking / Unpublish / edit; rolling: Go live / Take offline) rather than the state names in Task 1; `roundSteps` marks the fixed step **skip** ("–") when nobody in the cycle has a fixed or preference pattern, so the round's "now" starts at pre-fill; the booking-window schedule block is shared by the open step (rounds) and the live step (rolling); `setCycleStatus` refuses archived cycles and the stepper shows a read-only note for them; `go()` closes any open modal; the open confirm warns when a stale schedule will be switched off; `S.lastImport` lives in the shared state (cloud-merged) and is saved on import; checklist rows are ticked from evidence — `cset().answered` set by the setting handlers (`markAnswered`), audit entries and a `featuresReviewed` flag — so a new group starts at 0/12 except the cycle it was seeded with; the Settings index offsets by `--topbar-h`, measured in `render()`; the fatigue segment passes typed numbers and every segmented toggle ignores a tap on the already-selected option.

## Global Constraints

- Suite stays green (161 today); new tests in `tests/suite.js` inside the IIFE, `T(name,cond)`, dates via `FUT(n)`.
- Engine untouched. Device-only UI state in module `let`s (`_setupTab`, `_gapsOpen`, `_staffQuery`, `_staffFilter`), never in `S` — except `S.lastImport` (synced, defaulted in `normalize()`).
- `statusActions()` keeps its labels (suite lines ~261–265 assert on them); the stepper composes it.
- Existing ids/handlers keep working: `data-status`, `adFixed adMin adMax adClear`, `schOpen schClose schOn schSave`, `card-status`, `marketCard`, `capCard`, `brandCard`, all Settings inputs. The four unguarded bindings in the Settings gate (`addZone`, `saveStaffing`, `resetAll`, `prepNext`) become null-guarded because only one half renders at a time.
- Every per-cycle card heading carries the cycle name via one helper `cycH2(title)`; every instant toggle toasts `Saved for <cycle>` or `Saved for <group>`; typed fields get a named button (`Save cycle dates`, `Save cover`, `Save shift times`, `Save fatigue rules`, `Save leave cap`, `Save group details`).
- 44 px floor, sentence case, "booking" wording, `Settings` not `Admin settings`.

---

### Task 1: One status handler, hoisted, with a "who is notified" confirm

**Files:** `app.html` — new `setCycleStatus(to)` next to `statusActions()` (~1606); the `[data-status]` block (~3626–3633) moves to the always-wired section (after the `[data-go]` binding ~3539) and calls it after `confirmStatus(to)`; `tests/suite.js`.

**Interfaces:** `setCycleStatus(to) → {ok:true}` (status set, schedule cleared when opened manually outside the window, notify with target for open/published, audit, save). `statusConfirmText(to) → string|null` (null = no confirm needed).

- [ ] Tests:
```js
  // ---- Phase 2: status transitions ----
  S.viewAs="admin"; S.notifications=[]; S.cycles[0].status="draft"; cset().rosterMode="rounds"; S.rosterMode="rounds";
  setCycleStatus("open");
  T("status: open → status set + booking alert with target", S.cycles[0].status==="open" && S.notifications.some(function(n){return /Booking is open/.test(n.text) && n.go && n.go.tab==="selfroster";}));
  setCycleStatus("closed"); var nN=S.notifications.length; 
  T("status: close is quiet", S.cycles[0].status==="closed" && S.notifications.length===nN);
  setCycleStatus("published");
  T("status: publish alerts everyone with a My shifts target", S.cycles[0].status==="published" && S.notifications[0].go.tab==="my");
  T("status: confirm copy names the audience", /notified/.test(statusConfirmText("open")) && statusConfirmText("closed")===null);
  S.notifications=[];
```
- [ ] Implement: cut the handler body into `setCycleStatus(to)`; `statusConfirmText(to)` returns, for `open`: `Open booking for ${cyLabel(active())}?\n\nEveryone in ${groupName()} (${S.staff.length} people) will be notified.`; for `published`: rolling → `Go live with ${cyLabel}?\n\n…notified — staff can add and drop shifts from now on.`, rounds → `Publish ${cyLabel}?\n\nEveryone (${N}) will be notified and the roster becomes the record.`; else `null`. `groupName()` = `(S.branding&&S.branding.name)||ROLES()`. Handler (always-wired): `document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{ const to=b.dataset.status; const c=statusConfirmText(to); if(c&&!confirm(c))return; setCycleStatus(to); render(); });`
- [ ] Run suite → green. Commit `UI phase 2: one status handler, hoisted, confirm names who is notified`.

### Task 2: "Run this round" stepper on the Round tab

**Files:** `app.html` — `roundStepperHTML(cyc)` above `viewSelfRoster()`; replace the admin head's h2/sentence/workflow (~2191–2193) with the stepper; card id `card-round`; summary tile uses `statusLabel`; adFixed toast tail reworded; `tests/suite.js`.

**Interfaces:** `roundStepperHTML(cyc) → string`; `roundSteps(cyc) → [{key,title,state:"done"|"now"|"todo",body}]`.

- [ ] Tests:
```js
  // ---- Phase 2: run-this-round stepper ----
  S.cycles[0].status="draft"; var rs=roundSteps(S.cycles[0]).map(function(s){return s.key+":"+s.state;});
  T("stepper: rounds draft → fixed is now", rs[0]==="fixed:now" && rs.indexOf("open:todo")>=0 && rs.indexOf("publish:todo")>=0);
  S.cycles[0].status="open"; rs=roundSteps(S.cycles[0]);
  T("stepper: open → open step is now, fixed done", rs.find(function(s){return s.key==="open";}).state==="now" && rs[0].state==="done");
  S.cycles[0].status="closed"; T("stepper: closed → publish is now", roundSteps(S.cycles[0]).find(function(s){return s.key==="publish";}).state==="now");
  cset().rosterMode="rolling"; S.rosterMode="rolling"; S.cycles[0].status="draft";
  T("stepper: rolling has Go live, no close", roundSteps(S.cycles[0]).some(function(s){return s.key==="live";}) && !roundSteps(S.cycles[0]).some(function(s){return s.key==="close";}));
  cset().rosterMode="rounds"; S.rosterMode="rounds"; S.cycles[0].status="published";
  var sh2=roundStepperHTML(S.cycles[0]); T("stepper: published shows Unpublish and no schedule inputs", sh2.indexOf('data-status="draft"')>=0 && sh2.indexOf('id="schOn"')<0);
```
- [ ] Implement `roundSteps`: rounds → fixed (done if any assignment `fixed:true` or status≠draft), prefill (done if status≠draft or any non-fixed clinical), open (now when draft/closed; done when open/published), close (now when open; done when closed/published), publish (now when closed; done when published). Rolling → fixed, prefill, live (now when draft/closed/open; done when published), offline (info). Body per step: fixed → `#adFixed` (+ `_fpReport` line); prefill → `#adMin #adMax #adClear` + `Fix gaps (N)` button `data-gaps="1"`; open → schedule block (existing markup, only when not published) + `statusActions()` buttons for draft/closed; close → statusActions when open; publish → statusActions when closed; published → `statusActions()` (Unpublish). `roundStepperHTML` renders `<div class="card" id="card-round"><h2>${isRolling(cyc)?"Rolling roster":"Run this round"} <span class="pill …">${statusLabel(cyc)}</span></h2>` + steps as `.rstep.done|.now|.todo` rows (number/tick, title, body). Snake/waves controls stay inside the open step body when `S.fairness` matches.
- [ ] Reword adFixed toast tail: `"\n\nNext: open booking (step 3 below)."`. Summary tile → `statusLabel(cyc)`.
- [ ] Suite green; commit `UI phase 2: Run this round — one stepper on the Round tab`.

### Task 3: Fix gaps — the list

**Files:** `app.html` — `shortSlots()`, `gapsPanelHTML()`, `_gapsOpen`; roster header pill → `#gapsBtn`; handlers `[data-gapassign]`, `[data-gapcast]`, `[data-gaps]`; `tests/suite.js`.

- [ ] Tests:
```js
  // ---- Phase 2: fix gaps ----
  S.viewAs="admin"; S.cycles[0].assign={}; cset().staffing={amMin:2,amMax:2,pmMin:1,pmMax:2}; S.staffing=cset().staffing; var gd=FUT(3);
  S.cycles[0].assign["s1|"+gd]={kind:"clinical",period:"AM",zone:"z1"};
  var ss=shortSlots().filter(function(x){return x.iso===gd;});
  T("gaps: a day with 1 of 2 AM and 0 of 1 PM yields two short slots", ss.length===2 && ss.find(function(x){return x.period==="AM";}).need===1 && ss.find(function(x){return x.period==="AM";}).zones.some(function(z){return z.id==="z2";}));
  var gp=gapsPanelHTML(); T("gaps: panel lists Assign for each slot", (gp.match(/data-gapassign=/g)||[]).length>=2);
  S.marketOn=false; T("gaps: no Broadcast when the marketplace is off", gapsPanelHTML().indexOf("data-gapcast=")<0 && /marketCard/.test(gapsPanelHTML()));
  S.marketOn=true; T("gaps: Broadcast when the marketplace is on", gapsPanelHTML().indexOf("data-gapcast=")>=0); S.marketOn=false;
  S.cycles[0].assign={}; cset().staffing={amMin:1,amMax:2,pmMin:1,pmMax:2}; S.staffing=cset().staffing;
```
- [ ] Implement per the map's sketch (`clinicalCounts`, `effStaffing`, `freeZones`, `isPH`). Panel: `<div class="card" id="gapsPanel"><h2>Short slots <span class="pill danger">${n}</span></h2>` rows `fmtISO(iso) · AM/PM · need N of min · free zones` with `<button class="btn sm" data-gapassign="${iso}">Assign…</button>` and, when `featOn("marketplace")&&S.marketOn`, `<button class="btn sm" data-gapcast="${iso}|${period}|${zones[0].id}">Broadcast</button>`; else one line with `<a data-go="setup||marketCard">Turn on the marketplace</a>`. Header pill becomes `<button class="pill danger" id="gapsBtn">● N days need cover · Fix</button>` (both roster views); `_gapsOpen` toggles the panel above the grid; stepper's `data-gaps` sets `_gapsOpen=true; go("roster")`. Handlers in the always-wired block.
- [ ] Suite green; commit `UI phase 2: Fix gaps — a list of short slots with Assign and Broadcast`.

### Task 4: Settings in two halves, with ids and an index

**Files:** `app.html` — `viewSetup()` restructure; `cycH2(title)`; card ids; `_setupTab`; `setupTabFor(anchor)`; `go()` opens the half; index nav; guard the four bindings; `tests/suite.js`.

- [ ] Tests:
```js
  // ---- Phase 2: settings halves ----
  S.viewAs="admin"; _setupTab="cycle"; var vc=viewSetup();
  T("settings: cycle half has status, zones, cover, quota, mode — not branding", ['id="card-status"','id="card-zones"','id="card-cover"','id="card-quota"','id="card-mode"'].every(function(x){return vc.indexOf(x)>=0;}) && vc.indexOf('id="brandCard"')<0);
  _setupTab="group"; var vg=viewSetup();
  T("settings: group half has branding, cycles, import, access/marketplace/capacity, danger — not zones", ['id="brandCard"','id="card-cycles"','id="card-import"','id="capCard"','id="card-danger"'].every(function(x){return vg.indexOf(x)>=0;}) && vg.indexOf('id="card-zones"')<0);
  T("settings: anchors map to their half", setupTabFor("marketCard")==="group" && setupTabFor("card-status")==="cycle" && setupTabFor("card-zones")==="cycle");
  go("setup",{anchor:"marketCard"}); T("go: opens the right half for an anchor", _setupTab==="group" && S.tab==="setup");
  _setupTab="cycle"; T("settings: every per-cycle heading carries the cycle name", (viewSetup().match(/pill muted/g)||[]).length>=8);
```
- [ ] Implement: `const SETUP_CYCLE=["card-status","card-cycle","card-zones","card-cover","card-times","card-fatigue","card-leavecap","card-quota","card-mode"], SETUP_GROUP=["brandCard","card-cycles","card-import","card-payroll","card-access","marketCard","capCard","card-danger"]`; `setupTabFor(a)` → group if in SETUP_GROUP else cycle. `viewSetup()` = seg (`#setupSeg [data-st="cycle"|"group"]`) + sticky index (`<nav class="setidx">` of `<a data-go="setup||id">` titles) + the half's cards in that order. Split Roster cycle into `card-cycle` (dates: cycStart/cycWeeks/saveCycle) and `card-cycles` (prepNext + lists). Move `resetAll` into `card-danger`. `cycH2(t)` = `<h2>${t} <span class="pill muted" title="Applies to this cycle only">${escapeHTML(cyLabel(active()))}</span></h2>`. In `go()`: `if(tab==="setup"&&o.anchor)_setupTab=setupTabFor(o.anchor);`. Guard `addZone`, `saveStaffing`, `resetAll`, `prepNext` with `if(el)`. CSS: `.setidx` sticky under the header (top: var(--topbar-h) fallback 0), horizontal scroll on phones.
- [ ] Suite green; commit `UI phase 2: Settings in two halves — This cycle / This staff group — with ids and an index`.

### Task 5: One save rule + Danger zone

- [ ] Tests: `setFatigueMode("warn")` persists to `cset().fatigue.mode` immediately; `dangerCardHTML()` contains the group name and `id="dangerBtn"`; `confirmDanger("wrong")` false / `confirmDanger(groupName())` true.
- [ ] Implement: `toastSaved(scope)` (`"Saved for "+cyLabel(active())` / `"Saved for "+groupName()`); call it from every instant seg/checkbox handler (uoSeg, fairSeg, modeSeg, wcSeg, qpSeg, qcSeg, qfSeg → cycle; mkOnSeg, mkClaimSeg, mkQSeg, pushSeg, .featFlag → group); Fatigue seg instant via `setFatigueMode(m)` (writes `cset().fatigue={...effFatigue(),mode:m}`; audit; save; toast) and its Save button → `Save fatigue rules` (numbers only); zone row edits toast (debounced 600 ms); button labels renamed; `saveCycle` gets toast + `logAudit("cycle.dates", …)`. Danger card: `<div class="card" id="card-danger" style="border-left:4px solid var(--danger-t)"><h2>Danger zone</h2>` + description `Deletes every cycle, shift, request and message for ${groupName()}. People keep their sign-in; this group becomes empty.` + `<button class="btn danger" id="dangerBtn">Delete all data for ${groupName()}</button>`; click → `renderModal`-style dialog with `<input id="dangerType">` "Type ${groupName()} to confirm" and a danger button enabled only when `confirmDanger(value)`; then `reset()`.
- [ ] Suite green; commit `UI phase 2: one save rule (toggles say Saved for…, named Save buttons) + Danger zone with typed confirmation`.

### Task 6: Staff tab that scales

- [ ] Tests: `staffFiltered("nguyen","all")` finds by surname; `staffFiltered("","nologin")` only people without contact; sorted by surname; `staffFiltered("","out")` = not in cycle.
- [ ] Implement: `_staffQuery=""`, `_staffFilter="all"`; `staffFiltered(q,f)` (match on name/initials/email/mobile, lower-case; filters all|in|out|nologin|fixed|none; sort by `splitName(name).sur` then given); `viewStaff()` = toolbar (`#staffSearch` input, `#staffFilterSeg` seg, count `Showing n of m`) + `<div id="staffList">${staffListHTML()}</div>`; collapsed row shows chevron, name, meta pills and (only) `+ Add to this cycle` when out of cycle; `Pattern`, `Save changes`, `Remove from staff list` move into the expanded detail (Remove at the far end). Search input `oninput` → `_staffQuery=v; document.getElementById("staffList").innerHTML=staffListHTML(); wireStaffRows();` (extract the per-row wiring into `wireStaffRows()`; the toolbar isn't re-rendered so focus is kept). Filter seg → same.
- [ ] Suite green; commit `UI phase 2: Staff tab — search, filters, sorted by surname, actions inside the row`.

### Task 7: Export menu, last-import record, the ten-question checklist

- [ ] Tests: `exportMenuHTML()` lists Excel/CSV and gates RosterOn rows on `featOn("rosteron")`; after `applyRosterImport(p,null)` in the harness, `S.lastImport.roster.summary` is set (call `recordImport("roster","file.xlsx","34 staff · 56 days")` directly and assert); `setupChecklist()` returns ≥10 rows each with `anchor` present in `viewSetup()` for its half; `S.branding.name=""` → Q1 not done; set → done.
- [ ] Implement: grid buttons → one `<button class="btn sm" id="rosExport">Export…</button>` (+ Show gaps stays); modal `exportMenuHTML()` rows `{id,title,desc,fn,gate}`: Excel (`rosXls`), CSV (`rosCsv`), Payroll file for RosterOn (`rosPay`, rosteron), RosterOn workbook (`rosRon`, rosteron), EFT tracker (`expEft`); footer `<a data-go="setup||card-payroll">Configure payroll template</a>`. Handlers bind inside the modal by the same ids to the same functions. `recordImport(kind,filename,summary)` → `S.lastImport[kind]={ts:Date.now(),file:filename,summary}`; called from importFile (roster/leave), importEftTracker, importStaffList; Import card shows `Last: file · date · summary` under each input; `normalize()` defaults `S.lastImport={}`. Checklist: `setupChecklist()` → rows for Q1–Q10 (+ staff added, allow-list synced when cloud) with `done` checks: Q1 `!!(S.branding&&S.branding.name)`, Q2 `!!(S.branding&&S.branding.roleNoun)`, Q3 zones changed from defaults (`cset().zones` exists and (length!==4 or any name not in ROC/RAP/PFT/ASAP)), Q4 `!!cset().staffing`, Q5 `!!cset().shiftTimes`, Q6 `active().status!=="draft"||Object.keys(active().assign).length>0||S.cycles.length>1`, Q7 `!!cset().quotaPeriod`, Q8 `!!cset().rosterMode`, Q8a `!!cset().fairness`, Q9 `!!cset().fatigue`, Q10 `!!S.featuresReviewed` (set true by any `.featFlag` change or a `Mark features reviewed` button in brandCard); anchors: brandCard, brandCard, card-zones, card-cover, card-times, card-cycle, card-quota, card-mode, card-mode, card-fatigue, brandCard; then `Staff added` (card-import / Staff tab via data-go="staff"), `Allow-list synced` (card-access). `checklistHTML()` replaces `setupGuideHTML()` (same guideHide/guideShow, wizTpl/wizStaff kept in the staff row); pill `${done}/${rows.length}`; the verb in the last line follows the mode (`Open booking` / `Go live`) and links to `selfroster||card-round`.
- [ ] Suite green; commit `UI phase 2: one Export menu, last-import record, the ten-question setup checklist`.

### Task 8: Sync, measure, adversarial review, merge

- [x] `cp app.html deploy/app.html`; regenerate `preview.html`; suite on both; rebuild the review copy; measure: Settings halves render at 375 px and 1280 px, index sticky, no id duplicates, Round tab stepper as admin (draft/open/closed/published), gaps panel opens from the pill, export modal, staff search keeps focus (JS: set value, dispatch input, check `document.activeElement`).
- [x] Workflow: 3 skeptics (wiring/ids/gates; state & save semantics incl. rolling, archived cycles, cloud merge of `S.lastImport`; copy & checklist logic). Fix confirmed items.
- [x] CHANGELOG + strategy note; fast-forward `main`; user pushes; `curl` check.

## Self-review
- Coverage: stepper (T2), gaps (T3), halves + index + ids (T4), save rule + danger (T5), staff (T6), export menu + last import + checklist (T7); "Fix gaps" reachable from the stepper (T2/T3) and the pill (T3); confirm names audience (T1).
- Type consistency: `setCycleStatus(to)`, `statusConfirmText(to)`, `roundSteps(cyc)`, `roundStepperHTML(cyc)`, `shortSlots()`, `gapsPanelHTML()`, `_gapsOpen`, `_setupTab`, `setupTabFor(anchor)`, `cycH2(t)`, `toastSaved(scope)`, `setFatigueMode(m)`, `groupName()`, `dangerCardHTML()`, `confirmDanger(v)`, `staffFiltered(q,f)`, `staffListHTML()`, `wireStaffRows()`, `exportMenuHTML()`, `recordImport(kind,file,summary)`, `setupChecklist()`, `checklistHTML()`.
