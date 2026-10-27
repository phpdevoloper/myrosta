# UI Phase 5 — Booking as a sheet, and the words people read · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Line numbers are from `main` at 7ab9111 (8 Sep 2026); re-grep before editing.

**Goal:** A consultant books a round on a phone one day at a time — tap a day, see what's open and why the rest isn't, pick, and confirm from a footer that never scrolls away — under one status line that says where the round is and how many they've booked; requests lead with what needs them and end in one verb; and every word a nurse or scribe at Site 2 reads is theirs: methods named by experience, codes spelled out on first use, CST a per-group switch, the group's own role noun, refusal reasons and confirmations written as sentences.

**Architecture:** Presentation only. The booking engine (`canBook`, `periodUnlocked`, `zoneTaken`, `srBatchBook`, `bookShift`, `commitGuarded`) is called, not changed — except that its reason strings become sentences. New device-side state `_daySheet`, `_sheetPeriod`, `_reqSheet` follows the `_moreOpen` pattern: `render()` injects the sheet into `#sheetRoot`; `closeSheets()`/`go()`/Escape clear it. A `pickCheck()` dry-run wraps `canBook` with the picks already made so a breaching pick is refused at pick time. The rounds/waves/snake branches keep their semantics: batch methods select-then-confirm through `_srPick` and `srBatchBook`; snake books one shift per turn through `bookShift`.

**Tech Stack:** as Phases 1–3 (single-file vanilla JS, JSC suite `python3 tests/run.py` + Python lints, deploy = `app.html` + `deploy/app.html` + `preview.html`).

**Spec:** `MYROSTA-UI-STRATEGY.md` — "Booking as a sheet, and the words people read" (Ships list); appendix "Staff on a phone" findings 3–5 (booking flow, status line, Requests) and "Wording" findings (contract codes, consultant strings, method names, form verbs, confirm() texts, guard reasons). Decisions agreed 8 Sep 2026: CST as a per-group option; single teal brand.

> **As built (8 Sep 2026, branch `ui-phase5` → `main`, 260/260 + 7 lints):** the row attribute is `data-bday` (the roster card already used `data-day` for "Open this day"); a chip tap closes the sheet (pick, unpick, book, mark) so a day is two taps; the sheet shows an "at your share" note when every chip would be refused for that reason; the closed round card carries the status line too; `bookingStatusHTML` takes the turn message as its fourth argument; Requests keeps the exact substring `needs your reply` (suite 87) and `Waiting for their reply` (suite 85); `reqDates()` renders readable dates on request rows; a `ROLESC()` helper (capitalised plural) joined `ROLE/ROLES/ROLEC`; the wave chips read "Group 2 · picking now · 3 of 5 done"; the batch-failure toast is a `warn` toast headed "Booked N. These didn't go in:" with `fmtISO` dates; the quota strip label became "Your share / fortnight"; the `confirmModal` helper and the planner EFT/Hrs columns stayed out of scope. **Skeptic pass (3 lenses, 28 confirmed, all fixed):** `pickCheck` now checks the cycle share first (hard mode only) and then re-runs `canBook` with the other picks overlaid as booked shifts, so period caps, the flexible remainder, per-period overrides and the fatigue rules all see the basket, and it saves/restores `_fatigueWarn` (the day sheet and `openCount` do too; `srBatchBook` surfaces and clears a pending warning); the row count uses the same dry-run so "N open" agrees with the chips; the basket is dropped when the person can no longer pick and on the header cycle selector / banner jump (both now go through `go()`); every day row is tappable — a waiting person gets a read-only sheet; Remove is hidden on a rolling past day; Escape returns focus to the day row or the Request button (`closeReqSheet`); the tab, bell and More handlers clear the sheets; a viewer no longer on the staff list gets a card instead of a crash; fixed-pattern requests render on both sides (they had no dates); admin cards and the nine notify/decline strings use `reqDates`/`fmtISO`; "Cancel the pattern" via `reqKindLabel`; `approveClaim` speaks about the person, not to them; the CST switch also hides the tally chip and the assign-modal button; wave messages distinguish "has had its turn", "opens next", "opens later" and "not in a group"; "Booking open" in the status line; Help, the two guides, the auto-draft toasts and the "Number of groups" label lost the old vocabulary.

## Global Constraints

- Suite stays green (231 + 7 lints today). Keep these substrings in the rewritten reasons so `tests/suite.js` 46/232/236 pass: `quota`, `isn't live yet`, `passed`; keep `needs your reply` in the staff request pill (suite 87) and `Waiting for their reply` in the admin card (suite 85).
- Engine untouched: `canBook/canClaim/periodUnlocked/bookingGate` keep their `{ok,reason}` shape and logic; only reason wording changes. `srBatchBook`, `bookShift`, `unbookShift`, `setShift`, `clearLeaveDay`, `submitLeaveRequest`, `submitSwapRequest` keep their signatures.
- Existing ids and data-attributes keep working: `data-pick`, `data-book`, `data-unbook`, `data-rmua`, `data-setcst`, `data-setoff`, `data-setua`, `.srConfirm`, `.srClear`, `srWho`, `snPass`, `wvDone`, `lvFrom lvTo lvCode lvReason lvSubmit`, `swMine swPeer swTheirs swReason swSubmit`, `data-peeragree`, `data-peerdecline`, `data-withdraw`, `data-reqcancel`, `data-cancel`.
- Sheets: `#sheetRoot` gets exactly one of `daySheetHTML`, `reqSheetHTML`, `moreSheetHTML`, `notifsSheetHTML`; `.overlay.sheetwrap > .sheet` markup; 44 px targets; Escape and overlay-tap close; focus returns to the opener.
- 44 px floor, sentence case, "booking" wording, the group's role noun via `ROLE()/ROLES()/ROLEC()`; no emoji in chrome (lint); no new hex or px literals (lints).
- `featOn("cst")` defaults ON (absent = on) so the live consultant site is unchanged.

---

### Task 1: Day rows and the day sheet

**Files:** `app.html` — `viewSelfRoster` 2334–2403 (the `rows` loop 2377–2387, `confirmBar` 2392), wiring 4003–4011, `render()` 1578, `closeSheets` 1499, Escape handler 1500, `go()`; CSS after `.sheetgrab` 230 and in the phone block ~383–384; `tests/suite.js`.

**Produces:** `let _daySheet=null,_sheetPeriod="AM"`; `openDaySheet(isoD)`, `closeDaySheet()`, `pickFor(isoD)`, `pickCheck(sid,isoD,p,zoneId)` → `{ok,reason}`, `dayRowHTML(sid,d,ctx)`, `daySheetHTML(isoD)`, `srFooterHTML(sid,s)`; CSS `.dayrow .dayrow .d .dayrow .st .srfoot .dshead .zchips .zchip .zchip.on .zchip .zsub .dsact .dsper`.

- [ ] **Step 1: Failing tests** (append before the final render line; the rounds fixture is `S.cycles[0]` with zones z1/z2 and staff s1..s3):

```js
  // ---- Phase 5: day rows + sheet ----
  S.viewAs="s1"; S.tab="selfroster"; cset().rosterMode="rounds"; S.rosterMode="rounds"; S.cycles[0].status="open"; S.cycles[0].window=null; S.cycles[0].draft=null; S.cycles[0].waveState=null; S.fairness="guarded"; cset().fairness="guarded"; _srPick=[]; _srPickSid=null;
  var srv=viewSelfRoster(); var day1=iso(cycleDates()[3]);
  T("book: the list is one row per day, no per-zone buttons", (srv.match(/data-day="/g)||[]).length===cycleDates().length && srv.indexOf('data-pick="')<0);
  T("book: an off day row says Off and is tappable", new RegExp('<button class="dayrow[^"]*" data-day="'+day1+'"[^>]*>[\\s\\S]*?Off').test(srv));
  var sh=daySheetHTML(day1);
  T("sheet: AM/PM segment, cover line and zone chips with keys", sh.indexOf('data-dsper="PM"')>=0 && /cover/i.test(sh) && sh.indexOf('data-pick="'+day1+'|AM|z1"')>=0);
  S.cycles[0].assign["s2|"+day1]={kind:"clinical",period:"AM",zone:"z1"}; sh=daySheetHTML(day1);
  T("sheet: a taken zone is greyed with who has it", /data-pick="[^"]*\|AM\|z1"[^>]*disabled/.test(sh) && /Taken by/.test(sh));
  delete S.cycles[0].assign["s2|"+day1];
  T("sheet: secondary actions spell the codes out", sh.indexOf('data-setcst="'+day1+'"')>=0 && /clinical support time/i.test(sh) && /unavailable/i.test(sh) && sh.indexOf("Requests")>=0);
  _srPick=[day1+"|AM|z1"]; _srPickSid="s1"; _srSid="s1"; srv=viewSelfRoster();
  T("book: a picked day shows the pick and the footer counts it", /data-day="[^"]+"[^>]*>[\s\S]*?Picked[\s\S]*?AM/.test(srv) && /class="srfoot"/.test(srv) && /1 picked/.test(srv) && srv.indexOf("srConfirm")>=0);
  var q0=S.staff[0].quota; S.staff[0].quota=1; var chk=pickCheck("s1",iso(cycleDates()[5]),"AM","z1");
  T("pickCheck: a pick beyond the cycle share is refused at pick time, in a sentence", chk.ok===false && /share|quota/.test(chk.reason) && /\.$/.test(chk.reason));
  S.staff[0].quota=q0; _srPick=[]; _daySheet=null;
  T("sheet: render injects the day sheet into sheetRoot and closeSheets clears it", (function(){ _daySheet=day1; render(); var ok=document.getElementById("sheetRoot").innerHTML.indexOf('class="sheet daysheet"')>=0; closeSheets(); return ok && _daySheet===null; })());
```

- [ ] **Step 2: Run** → FAIL (functions undefined).

- [ ] **Step 3: State + helpers** (near `_srPick` declaration):

```js
let _daySheet=null, _sheetPeriod="AM";   // device-only: which day's sheet is open, and which period it shows
function pickFor(isoD){ return _srPick.find(k=>k.indexOf(isoD+"|")===0)||null; }
function openDaySheet(isoD){ const sh=getShift(_srSid,isoD), pk=pickFor(isoD); _daySheet=isoD; _sheetPeriod=sh.kind==="clinical"?sh.period:(pk?pk.split("|")[1]:"AM"); render(); const f=document.querySelector("#sheetRoot .sheet button"); if(f&&f.focus)try{f.focus();}catch(e){} }
function closeDaySheet(){ const d=_daySheet; _daySheet=null; render(); const back=d&&document.querySelector('[data-day="'+d+'"]'); if(back&&back.focus)try{back.focus();}catch(e){} }
function pickCheck(sid,isoD,p,zoneId){   // dry-run for one chip: the engine's own guard plus the picks already in the basket
  const c=canBook(sid,isoD,p,zoneId); if(!c.ok)return c;
  const st=S.staff.find(x=>x.id===sid); if(!st)return {ok:true};
  const others=_srPick.filter(k=>k.indexOf(isoD+"|")!==0), q=+st.quota||0;
  if(q>0&&clinicalCountFor(sid)+others.length>=q)return {ok:false,reason:"That would be one more than your share this cycle ("+q+")."};
  if((S.quotaCapMode||"hard")==="hard"){ const per=periodOfDate(isoD); if(per){ const inPer=bookedInPeriod(sid,per)+others.filter(k=>{const d=k.split("|")[0];return d>=per.from&&d<=per.to;}).length;
    const cap=S.quotaFlex?periodCapInfo(st).ceil:periodTarget(st,per.index); if(cap>0&&inPer>=cap)return {ok:false,reason:per.label+" would be at its max ("+cap+") with your other picks."}; } }
  return {ok:true}; }
```

- [ ] **Step 4: Row + sheet + footer** (replace the `rows` loop and `confirmBar`):

```js
function dayRowHTML(sid,d,ctx){ const isoD=iso(d), sh=getShift(sid,isoD), pk=ctx.batch?pickFor(isoD):null; let st, cls="";
  if(pk){ const a=pk.split("|"), z=zoneById(a[2]); st=`<span class="tag lg brand">${ic("check")} Picked · ${a[1]} · ${escapeHTML(z?zoneLabel(z,a[1]):"?")}</span>`; cls=" picked"; }
  else if(sh.kind==="clinical") st=`<span class="tag lg ${sh.period==="AM"?"am":"pm"}">${escapeHTML(shiftLabel(sh))}</span>`;
  else if(sh.kind==="cst") st=`<span class="tag lg cst">CST</span>`;
  else if(sh.kind==="leave"){ const ls=leaveStyle(sh.code); st=`<span class="tag lg" style="background:${ls.bg};color:${ls.t}">${escapeHTML(sh.code==="UA"?"Unavailable":ls.name)}</span>`; }
  else { const n=ctx.openCount(isoD); st=`<span class="muted">Off</span>${ctx.canPick?`<span class="muted small"> · ${n?n+" open":"nothing open"}</span>`:""}`; }
  const tappable=ctx.canPick||sh.kind!=="off";
  return `<${tappable?"button":"div"} class="dayrow${cls}${[0,6].includes(d.getDay())?" we":""}${isPH(isoD)?" ph":""}" ${tappable?`data-day="${isoD}"`:""}><span class="d"><span class="dn">${DOW[d.getDay()]}</span><span class="dd">${d.getDate()}</span>${isPH(isoD)?'<span class="tag ph mini">PH</span>':""}</span><span class="grow st">${st}</span>${tappable?ic("chevR"):""}</${tappable?"button":"div"}>`; }
```
`ctx.openCount(isoD)` = number of `(p,z)` with `periodUnlocked(isoD,p,sid).ok && !zoneTaken(isoD,p,z.id,sid)`. Sheet:

```js
function daySheetHTML(isoD){ const sid=_srSid||S.viewAs, s=S.staff.find(x=>x.id===sid); if(!s)return ""; const cyc=active(), adm=isAdmin(), sh=getShift(sid,isoD), d=parseISO(isoD);
  const snakeDraft=S.fairness==="snake"&&!!cyc.draft, wavesOn=S.fairness==="waves"&&!!cyc.waveState, batch=!snakeDraft;
  const myTurn=(!snakeDraft||whoseTurn()===sid)&&(!wavesOn||currentCohort().includes(sid)), canPick=(bookingGate(cyc).ok||adm)&&myTurn;
  const p=_sheetPeriod, pk=pickFor(isoD), head=`<div class="dshead"><div><b>${escapeHTML(fmtISO(isoD))}</b>${isPH(isoD)?' <span class="tag ph mini">PH</span>':""}</div><button class="btn sm" id="dsClose">Done</button></div>`;
  let body="";
  if(sh.kind==="leave"&&sh.code!=="UA") body=`<div class="sub">On leave — ${escapeHTML(leaveStyle(sh.code).name)}. Change it through <a href="#" data-go="requests">Requests</a>.</div>`;
  else if(sh.kind==="leave") body=`<div class="sub">Marked unavailable for this day.</div>${canPick?`<div class="dsact"><button class="btn" data-rmua="${isoD}">Remove unavailable</button></div>`:""}`;
  else if(sh.kind==="clinical") body=`<div class="sub">Booked: <b>${escapeHTML(shiftLabel(sh))}</b> · ${escapeHTML(sh.period==="AM"?effShiftTimes().AM.start:effShiftTimes().PM.start)}</div>${canPick?`<div class="dsact"><button class="btn danger" data-unbook="${isoD}">Remove this shift</button></div>`:""}`;
  else if(!canPick) body=`<div class="sub">${sh.kind==="cst"?"Clinical support time (CST).":"Off."} ${escapeHTML(bookingGate(cyc).reason||"")}</div>`;
  else {
    const cc=clinicalCounts(isoD,sid), min=p==="AM"?effStaffing().amMin:effStaffing().pmMin, max=Math.min(p==="AM"?effStaffing().amMax:effStaffing().pmMax,zonesFor(p).length), cur=p==="AM"?cc.am:cc.pm;
    const seg=`<div class="seg dsper"><button data-dsper="AM" class="${p==="AM"?"on":""}">AM</button><button data-dsper="PM" class="${p==="PM"?"on":""}">PM</button></div>`;
    const cover=`<div class="muted small">${p} cover ${cur} of ${max} · minimum ${min}${cur<min?" — still filling":""}</div>`;
    const chips=zonesFor(p).map(z=>{ const key=isoD+"|"+p+"|"+z.id, sel=batch&&pk===key, taken=zoneTaken(isoD,p,z.id,sid);
      const chk=taken?{ok:false,reason:"Taken by "+escapeHTML(shortNm(taken))}:(batch?pickCheck(sid,isoD,p,z.id):canBook(sid,isoD,p,z.id));
      return `<button class="zchip${sel?" on":""}" data-${batch?"pick":"book"}="${key}" ${(!chk.ok&&!sel)?"disabled":""}><b>${escapeHTML(zoneLabel(z,p))}</b><span class="zsub">${sel?"Picked — tap to unpick":(chk.ok?"Open":escapeHTML(chk.reason))}</span></button>`; }).join("");
    const cst=featOn("cst")?`<button class="btn ${sh.kind==="cst"?"primary":""}" data-setcst="${isoD}">${sh.kind==="cst"?ic("check")+" Clinical support time":"Mark clinical support time (CST)"}</button>`:"";
    body=`${seg}${cover}<div class="zchips">${chips||'<div class="muted small">No zone runs this period.</div>'}</div>
      <div class="dsact">${cst}<button class="btn" data-setoff="${isoD}">Mark off</button><button class="btn" data-setua="${isoD}">Mark unavailable (UA)</button></div>
      <div class="muted small">Annual, CME and other leave goes through <a href="#" data-go="requests">Requests</a>.</div>`; }
  return `<div class="overlay sheetwrap" id="ovlDay"><div class="sheet daysheet" role="dialog" aria-modal="true" aria-label="${escapeHTML(fmtISO(isoD))}"><div class="sheetgrab"></div>${head}${body}</div></div>`; }
function srFooterHTML(sid,s){ if(!_srPick.length)return ""; const n=_srPick.length, now=clinicalCountFor(sid), q=+s.quota||0;
  return `<div class="srfoot"><span><b>${n} picked</b> · ${now} → ${now+n}${q?" of "+q:""} after confirm</span><span class="grow"></span><button class="btn sm srClear">Clear</button><button class="btn primary srConfirm">Confirm ${n} pick${n>1?"s":""}</button></div>`; }
```
In `viewSelfRoster`: `rows=ds.map(d=>dayRowHTML(sid,d,{batch,canPick,openCount})).join("")`; the card becomes `…${personSel}<div class="srbook daylist">${rows}</div>${srFooterHTML(sid,s)}${bottomBtns}`; drop the CST/Off/UA paragraph (it lives in the sheet now).

- [ ] **Step 5: Wiring.** `render()` line 1578 → `_daySheet?daySheetHTML(_daySheet):(_reqSheet?reqSheetHTML(_reqSheet):(_moreOpen?moreSheetHTML():(_notifsOpen?notifsSheetHTML():"")))`. Always-wired block: `[data-day]` → `openDaySheet`; `#dsClose` and `#ovlDay` click on the overlay itself → `closeDaySheet()`; `[data-dsper]` → `_sheetPeriod=…; render()`. `[data-pick]` handler: unpick if present, else `pickCheck` → toast reason and return, else replace any pick on that day and push; then `closeDaySheet()`. `[data-book]`, `[data-unbook]`, `[data-setcst/off/ua]`, `[data-rmua]` handlers end with `closeDaySheet()` instead of `render()`. `closeSheets()` and `go()` set `_daySheet=null`; the Escape handler covers `_daySheet`.

- [ ] **Step 6: CSS**

```css
.dayrow{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:8px 4px;border:none;border-bottom:1px solid var(--line);background:none;font:inherit;color:var(--text);text-align:left;cursor:pointer;border-radius:8px}
button.dayrow:hover{background:var(--hover)} .dayrow.picked{background:var(--accent-bg)} .dayrow.we{background:var(--we)} .dayrow.ph{background:var(--ph-bg)}
.dayrow .d{width:42px;text-align:center;flex:none;display:flex;flex-direction:column;align-items:center} .dayrow .d .dn{font-size:var(--fs-xs);color:var(--muted)} .dayrow .d .dd{font-size:var(--fs-lg);font-weight:600} .dayrow .st{display:flex;align-items:center;gap:6px;flex-wrap:wrap} .dayrow>.tic{stroke:var(--hint);flex:none}
.srfoot{position:sticky;bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--navy);color:#fff;border-radius:12px;padding:10px 14px;margin-top:10px;box-shadow:var(--shadow);z-index:5} .srfoot .btn{min-height:40px} .srfoot .btn:not(.primary){background:transparent;color:#fff;border-color:rgba(255,255,255,.4)}
.dshead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:var(--fs-lg)} .dsper{margin:0 0 8px}
.zchips{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin:8px 0 12px}
.zchip{min-height:56px;padding:8px 12px;border:1px solid var(--line2);border-radius:var(--radius-sm);background:var(--surface);font:inherit;color:var(--text);text-align:left;display:flex;flex-direction:column;gap:2px;cursor:pointer} .zchip .zsub{font-size:var(--fs-sm);color:var(--muted)} .zchip:disabled{opacity:.6;cursor:not-allowed} .zchip.on{background:var(--accent-bg);border-color:var(--accent-ink);color:var(--accent-ink)} .zchip.on .zsub{color:var(--accent-ink)}
.dsact{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}
@media(max-width:640px){ .srfoot{bottom:calc(64px + env(safe-area-inset-bottom)) } }
```

- [ ] **Step 7: Run** → PASS; review copy at 375 px: rows 56 px, sheet opens, chips 56 px, footer stays above the bottom bar while scrolling; desktop 1280: same list, sheet at the bottom.
- [ ] **Step 8: Commit** `git commit -am "UI phase 5: booking is one row per day with a day sheet — cover, dry-run reasons, one pick per day, a footer that stays on screen"`.

---

### Task 2: One status line for staff

**Files:** `app.html` — `viewSelfRoster` (`summary` 2349–2353, `schedBanner` 2338–2343, `turnMsg` 2388–2390, `booking` card 2396–2400); `tests/suite.js`.

**Produces:** `bookingStatusHTML(cyc,sid,s)` → `<div class="statusline">…</div>`; `turnMsgHTML(sid)` reworded.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 5: status line ----
  S.viewAs="s1"; S.tab="selfroster"; srv=viewSelfRoster();
  T("status: staff get one line, not the admin tiles", srv.indexOf("Coverage gaps")<0 && /class="statusline"/.test(srv) && /Round open/.test(srv) && /you.ve booked \d+ of \d+/.test(srv));
  S.cycles[0].window={enabled:true,open:FUT(-1)+"T09:00",close:FUT(6)+"T17:00",fired:null}; srv=viewSelfRoster();
  T("status: the close time is in the line, not a separate banner", /closes/.test(srv) && srv.indexOf('class="schedbar')<0);
  S.cycles[0].window=null; S.viewAs="admin"; srv=viewSelfRoster();
  T("status: admins keep the tiles and the stepper", srv.indexOf("Coverage gaps")>=0 && srv.indexOf('id="card-round"')>=0);
```
- [ ] **Step 2: Implement.** Non-admin: `head=""`, `summary=""`, `schedBanner=""`; the booking card's `.sub` becomes `bookingStatusHTML(cyc,sid,s)`: phase word (`Round open` / `Booking opens Fri 19 Sep 9:00 am` / `Booking closed` / rolling: `Live — add or drop shifts any time`) + ` · closes ${schFmt(w.close)} (${schUntil})` when scheduled + ` · you've booked ${clinicalCountFor(sid)} of ${quota}` + per-period counts `(F1 3/7 · F2 3/7)` when `S.quotaPeriod!=="cycle"` + the turn message. Turn messages: snake — "It's your turn — pick one shift." / "It's "+nameOf(whoseTurn())+"'s turn — you'll be told when it's yours."; waves — "Your group is picking now — book up to your "+pname+" share." / "Group "+(cur+1)+" is picking now. Your group ("+(mine+1)+") opens next."; guarded — "Taken slots disappear as others book." + the unlock sentence when `hasExtraSlots()`.
- [ ] **Step 3: Run** → PASS; commit `"UI phase 5: one status line for staff — phase, close time, booked count, whose turn"`.

---

### Task 3: Requests — needs-you first, forms as sheets, one verb

**Files:** `app.html` — `viewRequests` staff branch 2512–2535, `myReqRow` 2621–2624, admin decided list 2509, cancellation card 2508, handlers 3954–3978, `render()`/`closeSheets`; `tests/suite.js`.

**Produces:** `let _reqSheet=null` ("leave"|"swap"); `reqSheetHTML(kind)`; `REQ_STATUS` label table; `reqStatusTag(r)`.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 5: requests ----
  S.viewAs="s1"; S.tab="requests"; S.requests=[]; var rv=viewRequests();
  T("requests: staff see Your requests then two Request buttons, no inline forms", rv.indexOf('id="reqLeave"')>=0 && rv.indexOf('id="reqSwap"')>=0 && rv.indexOf('id="lvSubmit"')<0 && rv.indexOf("Your requests")>=0);
  S.requests=[{id:"rq9",type:"swap",from:"s2",peerId:"s1",dateA:FUT(3),dateB:FUT(5),status:"awaiting-peer",createdTs:Date.now()}]; rv=viewRequests();
  T("requests: a swap waiting on me comes first, with Agree and Decline", rv.indexOf("Needs you")>=0 && rv.indexOf("Needs you")<rv.indexOf("Your requests") && rv.indexOf('data-peeragree="rq9"')>=0);
  var ls=reqSheetHTML("leave");
  T("requests: the leave sheet keeps its ids and ends in one verb", ls.indexOf('id="lvFrom"')>=0 && ls.indexOf('id="lvSubmit"')>=0 && /Send leave request/.test(ls) && ls.indexOf(">Submit<")<0);
  T("requests: leave From defaults to today or the first cycle day after it", new RegExp('id="lvFrom" value="('+iso(new Date())+'|'+iso(cycleDates().find(function(d){return iso(d)>=iso(new Date());})||cycleDates()[0])+')"').test(ls));
  T("requests: statuses are words", reqStatusTag({status:"approved"}).indexOf("Approved")>=0 && reqStatusTag({status:"awaiting-peer"}).indexOf("Waiting for")>=0 && reqStatusTag({status:"info"}).indexOf("needs your reply")>=0);
  S.requests=[];
```
- [ ] **Step 2: Implement.** Staff branch returns `needsYou + list + `<div class="actrow"><button class="btn primary" id="reqLeave">Request leave</button><button class="btn" id="reqSwap">Request a swap</button></div>``. `needsYou` = peer swap rows (44 px Agree/Decline) + my `status==="info"` rows, heading "Needs you"; omitted when empty. `reqSheetHTML(kind)` wraps the existing form markup (ids unchanged) in `.overlay.sheetwrap > .sheet`, heading "Request leave" / "Request a swap", sub "Goes to your admin. You'll get a notification when it's decided.", button `Send leave request` / `Send swap request`, a "Cancel" link. Defaults: `lvFrom` = first cycle day ≥ today (else today), `lvTo` = same; `lvFrom` onchange bumps `lvTo` when earlier. Handlers: `reqLeave/reqSwap` → `_reqSheet=…; render()`; `lvSubmit` → after `submitLeaveRequest`: `_reqSheet=null; render(); toast("Leave request sent — it's in Your requests.","ok")`; `swSubmit` likewise with "Swap request sent — your colleague is asked first." `REQ_STATUS={pending:"Pending","awaiting-peer":"Waiting for your colleague",info:"needs your reply",approved:"Approved",declined:"Declined",withdrawn:"Withdrawn",cancelled:"Cancelled"}`; `reqStatusTag(r)` used by `myReqRow` and the admin decided list. Cancellation card buttons: "Keep the approval" / "Cancel the leave" (swap: "Cancel the swap"). Other verbs: fixed pattern "Send pattern change for approval"; messages admin "Send to all staff", staff "Send message"; feedback "Send feedback"; admin cards both "Ask a question".
- [ ] **Step 3: Run** → PASS; commit `"UI phase 5: Requests lead with what needs you; leave and swap forms are sheets ending in Send … request; statuses are words"`.

---

### Task 4: Methods named by experience; the status pill echoes the verbs

**Files:** `app.html` — `fairnessLabel` 1366, segment 2028–2031, descriptions 2035–2037, toast 3831, wave chips 1370–1376, wave confirms 3997–3999, snake strings 2323/2372, Help FAQ 3298+, `STATUS` 829; `tests/suite.js`.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 5: method names ----
  T("methods: named by what people experience", fairnessLabel("guarded")==="Everyone at once" && fairnessLabel("waves")==="In random groups" && fairnessLabel("snake")==="Take turns" && fairnessLabel("adjust")==="Pre-filled, then adjust");
  S.viewAs="admin"; S.tab="setup"; _setupTab="cycle"; var su=viewSetup();
  T("methods: the picker shows the plain name with the technical one as a hint", su.indexOf("In random groups")>=0 && /Cohort waves/.test(su) && su.indexOf(">Guarded free-for-all<")<0);
  T("status: the pill echoes the booking verbs", STATUS.open.label==="Booking open" && STATUS.closed.label==="Booking closed");
```
- [ ] **Step 2: Implement.** `fairnessLabel` map → the four names; `fairnessTech(f)` → the old names; segment buttons `${fairnessLabel(k)} <span class="muted small">${fairnessTech(k)}</span>`; descriptions as when-to-use sentences ("Everyone at once — best for small teams who trust first-come; the guards keep it fair." / "In random groups — three random groups book in turn; good when a few people always book first." / "Take turns — strict turns that reverse each round; slowest, fairest." / "Pre-filled, then adjust — you draft a fair roster, then staff drop, claim and swap within their share."); toast "Switched to Everyone at once — In random groups needs a round with a start and an end."; wave chips "Group 2 · picking now · 3 of 5 done"; buttons "Open next group" / "Re-shuffle groups" / "Stop the groups"; wave confirms reworded; snake tag "Round 2 · Kim's turn", "Skip turn" stays; Help FAQ sentences updated; `STATUS.open.label="Booking open"`, `STATUS.closed.label="Booking closed"` (check `statusLabel` for rolling: "Live" / "Draft — not live yet" stay). grep the suite for "Open for self-roster" and retarget if present.
- [ ] **Step 3: Run** → PASS; commit `"UI phase 5: methods named by what people experience; status pill echoes the booking verbs"`.

---

### Task 5: The words — CST as a group switch, codes spelled out, the group's noun, reasons and confirmations as sentences

**Files:** `app.html` — flags 1785–1788, `featOn` 776; CST surfaces 1926 (shift-times row stays), 2183 (roster mobile sections), 2271 (Daily CST section), 2295 (legend), 3457 (My shifts tile), day sheet (Task 1); quota labels 3411/3461; consultant literals 1864, 1977, 1998, 2266, 2858, 2903, 2912–2915, 2934, 2991, 3047; examples (guide "ROC, RAP, PFT, ASAP", placeholder "e.g. Werribee Mercy ED", "ROC → ROC+OC"); mode label 2083/2102; kind button 3562; reasons `canBook` 1089–1113, `canClaim` 1141–1156, `periodUnlocked` 1020–1039, claim strings ~1180/1190 ("Gone.", "Too late — already taken."), batch toast 1131; confirm texts 3796, 3857, 3873, 3884, 3894, 3896, 3898, 3975–3977, 3992, 3997–3999; `tests/suite.js`.

- [ ] **Step 1: Failing tests**
```js
  // ---- Phase 5: words ----
  T("cst: on by default for the existing consultant group", featOn("cst")===true);
  S.features={cst:false}; S.viewAs="s1"; S.tab="my";
  T("cst: a group without CST never sees it", viewMy().indexOf('class="k">CST')<0 && daySheetHTML(day1).indexOf("data-setcst")<0 && viewRoster().indexOf(">CST<")<0);
  S.features={};
  T("cst: the group card offers the switch", (function(){ S.viewAs="admin"; _setupTab="group"; return viewSetup().indexOf('data-feat="cst"')>=0; })());
  T("words: refusal reasons are sentences", /^You're on leave/.test(canBook("s1",(function(){ var d=iso(cycleDates()[1]); S.cycles[0].assign["s1|"+d]={kind:"leave",code:"AL"}; return d; })(),"AM","z1").reason) && /\.$/.test(canBook("s1",iso(cycleDates()[1]),"AM","z1").reason));
  delete S.cycles[0].assign["s1|"+iso(cycleDates()[1])];
  S.branding={roleNoun:"scribe"}; S.viewAs="admin"; _setupTab="cycle";
  T("words: the cycle half and the Day board use the group's noun", !/consultant/i.test(viewSetup()) && !/consultant/i.test(viewDaily()));
  S.branding={};
  T("words: the quota tile says what it counts", /Shifts this cycle/.test((function(){ S.viewAs="s1"; return viewMy(); })()));
```
- [ ] **Step 2: Implement.** `flag("cst","Clinical support time (CST)","switch off for groups without it — nurses, scribes, clerks")`; gate the five CST surfaces with `featOn("cst")`; checklist detail for question 10 adds "CST". Tile "Shifts this cycle" + small line "your share of clinical shifts"; quota strip label "Your share / fortnight:"; Daily hint and settings sub-lines via `ROLE()/ROLES()`; import confirms/toasts via `ROLES()`; examples generic; mode label "No shifts (coordinator / office)"; kind button "Shift". Reasons (keep the three regex words): "You're on leave that day." · "You already have a shift that day." · "That zone was just taken — pick another." · "It's "+name+"'s turn — you'll be told when it's yours." · "Your group opens next — you'll get a notification." · periodUnlocked: "AM is full (4 of 4)." · "Fill the minimum first — 4 AM and 4 PM." · "Extra AM opens before extra PM — fill AM first." · canClaim: "You're on leave that day." · "You're already working that day." · "That zone is already covered." · "You've reached your cycle quota ("+q+")." · claims: "That open shift is gone." · "Someone claimed it just before you." Batch failures: `toast("Booked "+ok+". These didn't go in:\n• "+fail.map(f=>fmtISO(date)+" "+p+" — "+reason))`. Confirm texts: "Delete cycle "+cyLabel(c)+" permanently? Its shifts and settings are lost; other cycles are unaffected." · "Cancel "+name+"'s approved "+what+"? The roster goes back to what it was before approval, and they're notified." · "This is one more than your cycle share ("+q+"). Take it as extra cover anyway?" · "Offer "+fmtISO(d)+" "+period+" to the whole group? Whoever claims it works it instead of you." · "Withdraw this offer? The shift comes back to you." · "Withdraw this request? Your admin won't see it." · "Clear every shift in "+cyLabel(active())+"? Leave is kept." · PH texts with `fmtISO`.
- [ ] **Step 3: Run** → PASS; commit `"UI phase 5: CST is a group switch; codes spelled out on first use; the group's own noun everywhere; refusal reasons and confirmations as sentences"`.

---

### Task 6: Sync, measure, adversarial review, docs, merge

- [x] Sync three copies; suite on each; rebuild the review copy; measure at 375: booking list rows ≥ 56 px, sheet chips ≥ 56 px, footer visible after scrolling to week 6, no horizontal scroll; Requests order; screenshots of the day sheet and the footer.
- [x] Workflow: 3 skeptics (booking semantics — pickCheck vs srBatchBook agreement, one-per-day, snake/waves/rolling/admin-booking-as branches, sheet state across render/go/cycle switch; wiring — ids, handlers, focus, Escape, overlay; copy — every reason sentence, every confirm, the three regex words, CST gating completeness incl. exports/ics/legend/shift-times, ROLE nouns). Fix confirmed items.
- [x] CHANGELOG "8 Sep 2026 — UI phase 5"; strategy note DONE; as-built here; fast-forward `main`; user pushes; rehearsal note: two consultants try the sheet on the 23 Nov cycle before the round opens.

## Self-review
- Coverage: day rows + sheet + cover + reasons + footer (T1) · status line (T2) · Requests order, sheets, one verb, statuses (T3) · method names + status verbs (T4) · CST switch, codes, noun, reasons, confirms (T5).
- Type consistency: `_daySheet`, `_sheetPeriod`, `_reqSheet`, `pickFor(isoD)`, `pickCheck(sid,isoD,p,zoneId)`, `dayRowHTML(sid,d,ctx)`, `daySheetHTML(isoD)`, `srFooterHTML(sid,s)`, `bookingStatusHTML(cyc,sid,s)`, `reqSheetHTML(kind)`, `REQ_STATUS`, `reqStatusTag(r)`, `fairnessTech(f)`.
- Out of scope: a `confirmModal` helper (call sites would go async); the planner EFT/Hrs columns; the desktop avatar menu.
