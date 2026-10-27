# Call-ins (on-call booked with its real hours) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an on-call window's hours be *chosen when booked*, so a consultant logs a call-in once they are called in, with the hours they really worked, several people a day, and those hours reach pay, counts, safe hours and every screen that shows on-call.

**Architecture:** A window gains `chosen:true` and `usual` (minutes); its `start`/`end` become the allowed range. Call-ins live in their own per-cycle map, `cyc.callins = {"<iso>|<windowId>|<staffId>": {start,end}}`, never in `cyc.oncall`, so fixed windows, the golden file and both Edge Functions are untouched. The two on-call reader helpers, `ocTakenBy` and `ocHeldBy`, return a *copy* of the window carrying the call-in's real hours and `ci:true`; almost every reader (payroll, RosterOn, exports, counts, marks, week strip, safe hours) then picks call-ins up with no change of its own. The few that must differ (calendar download, Fairness, day board, two leave writers, three staff-removal paths, Clear the roster) are changed explicitly.

**Tech Stack:** Single-file vanilla JS app (`app.html`), tests under JavaScriptCore via `osascript` (`python3 tests/run.py`), Python lints in `tests/run.py`.

**Spec:** `docs/superpowers/specs/2026-09-14-oncall-call-ins-design.md` (read it first; this plan argues from it).

## Global Constraints

- Fixed windows and `cyc.oncall` behave exactly as today. `tests/oncall-golden.js` must pass unchanged and is **never regenerated** to make a test pass.
- The Edge Functions (`supabase/functions/ics/index.js`, `supabase/functions/notify-shifts/index.ts`) are not edited. Nothing is pasted into Supabase. Never call the notify-shifts function.
- Accessors take `cyc` first and are never mirrored to a global. Every write goes through `commitGuarded`.
- Every `logAudit` call passes its key as a **string literal first argument** (the audit lint rejects `logAudit(cond?"a":"b",…)`), and every key has an `AUDIT_WORDS` sentence.
- No What's new note for this feature (groups without a Chosen window would be told about something they cannot see). A CHANGELOG entry and a matching `BUILD` date, in Task 7.
- `deploy/demo.html` must equal what `python3 tools/build-demo.py` produces from the current `app.html` (a lint checks this), so run the build before running the tests in every task. `deploy/app.html` and `preview.html` are synced in Task 7.
- Test dates are relative to today (`iso(new Date())`, `addDays`), because a consultant logs on the day or the day after. Never hardcode a future date.
- Copy: plain words, sentence case, no emoji or arrow glyphs inside buttons, notes or tags (a lint checks this).
- SWIFT's files in `~/Desktop/Myrosta site 2/` hold personal data and never enter the repo.
- Commit on `main`; do not push (the owner pushes from GitHub Desktop).

## How to edit `app.html`, `tests/suite.js` and `tests/run.py`

`app.html` is one 625 KB file with very long lines, and much of its script writes characters as JavaScript escapes (a backslash, `u`, four hex digits). Tool parameters can silently turn those escapes into the characters themselves, so an exact-match edit then fails, or writes the wrong thing. Make every edit through this helper, and write each such escape as `@U@` followed by the four hex digits (`@U@2019` for a right single quote, `@U@2013` for an en dash, `@U@00b7` for a middle dot, `@U@2014` for an em dash, `@U@2192` for a right arrow). The helper swaps `@U@` for backslash-u in both the old and the new text, and refuses to write unless each old text occurs exactly once.

- [ ] **Create the helper once**, in your scratchpad directory (called `$SP` below):

```python
# $SP/rep.py  —  usage: python3 $SP/rep.py <file to edit> <edits file>
import pathlib, sys
BS = chr(92)
target = pathlib.Path(sys.argv[1]); text = [target.read_text(encoding="utf-8")]; n = [0]
def fix(t): return t.replace("@U@", BS + "u")
def rep(old, new, cnt=1):
    old = fix(old); new = fix(new); c = text[0].count(old)
    if c != cnt: sys.exit("expected %d, found %d: %r" % (cnt, c, old[:160]))
    text[0] = text[0].replace(old, new); n[0] += 1
exec(open(sys.argv[2], encoding="utf-8").read())
target.write_text(text[0], encoding="utf-8"); print("replacements:", n[0])
```

An edits file is plain Python calling `rep(old, new)`; write both arguments as raw triple-quoted strings (`r'''…'''`). If `rep.py` stops with "expected 1, found 0", nothing was written: re-read that spot of the file and correct the old text; never loosen the count.

Run every command from the repo root, `/Users/ranjithkandavelu/Desktop/Claude/Myrosta`. The test command, used throughout:

```bash
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

The baseline before Task 1 is `725 passed, 0 failed`. A test that calls a function which does not exist yet stops the suite with `HARNESS ERROR: ReferenceError: Can't find variable: …`; that counts as the expected failure.

## File map

| File | What changes |
|---|---|
| `app.html` | Window option and card (Task 1); call-in data and readers (Task 2); logging rules and writes (Task 3); merge (Task 4); day sheet, cell dialog and wiring (Task 5); Clear the roster (Task 6); `BUILD` (Task 7) |
| `tests/suite.js` | One new self-contained block, `call-ins`, before the suite's final render; each task adds tests above its marker line |
| `tests/run.py` | The tab wiring lint also checks `ciSheetRows` (Task 5) |
| `deploy/demo.html` | Rebuilt by `tools/build-demo.py` in every task |
| `deploy/app.html`, `preview.html` | Synced in Task 7 |
| `CHANGELOG.md` | New entry (Task 7) |
| `docs/superpowers/specs/2026-09-14-oncall-call-ins-design.md` | "As built" section (Task 7) |

---

### Task 1: A window's hours can be chosen when booked

**Files:**
- Modify: `app.html` (`ocTime` and the helpers after it, `ocHolder`, `ocHeldBy`, `ocTakenBy`, `ocTake`, `ocRowHTML`, `ocRowsNow`, `ocCheck`, the On-call card markup and its wiring in `wire()`, `setupChecklist`, `ocSheetHTML`, `renderModal`, `dayRowHTML`, the CSS rule for `.oc-from`)
- Test: `tests/suite.js` (new `call-ins` block)

**Interfaces:**
- Consumes: existing `ocWindow(cyc,id)`, `ocWindows(cyc)`, `ocTakenWindows(cyc)`, `ocInUse(cyc,id)`, `_tHours(start,end)`.
- Produces:
  - `ocChosen(w) → boolean`: true for a window with `chosen:true` and no `from`.
  - `ocUsualText(w) → string`, e.g. `"4h"`, `"4.5h"`.
  - `ocWhenText(w) → string`: `"any hours 10:00–22:00, usually 4h"` for a Chosen window, `"22:00–08:00"` otherwise.
  - `ciKey(isoD,winId,sid) → "<iso>|<windowId>|<staffId>"`.
  - `ciParse(k) → {d,win,sid} | null`.
  - `ciValid(v) → boolean`: `v.start` and `v.end` are both `HH:MM`.
  - `ciGet(cyc,isoD,winId,sid) → {start,end} | null`.
  - `ciInUse(cyc,winId) → number` of valid call-ins on that window.
  - Window fields: `chosen:true`, `usual:<minutes>`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/ci1-suite.py`:

```python
rep(r'''  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''', r'''  // ---- call-ins: on-call booked once someone is called in, with the real hours.
  // Spec: docs/superpowers/specs/2026-09-14-oncall-call-ins-design.md. Dates are relative to today, because a consultant logs on the day or the day after.
  if(typeof ocWindows==="function")(function(){
    var keep={S:S,range:window._range,dl:download,x:(typeof XLSX==="undefined"?undefined:XLSX),toast:toast,oc:openConfirm,daily:dailyDate,sb:_setupTab,sr:_srSid}, c=null, said=[];
    var TODAY=iso(new Date()), YEST=iso(addDays(new Date(),-1)), TOMO=iso(addDays(new Date(),1)), OLD=iso(addDays(new Date(),-3));
    var CALLIN={id:"callin",code:"C",label:"Call-in (C)",start:"10:00",end:"22:00",book:true,rest:true,from:null,chosen:true,usual:240},
        EARLY={id:"early",code:"EARLY",label:"Early call",start:"00:00",end:"10:00",book:true,rest:true,from:null,chosen:true,usual:120},
        LATE={id:"late",code:"LATE",label:"Late call",start:"20:00",end:"04:00",book:true,rest:true,from:null,chosen:true,usual:120},
        NIGHT={id:"night",code:"NIGHT",label:"Night",start:"22:00",end:"08:00",book:true,rest:true,from:null};
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Consultant 1",am:true,pm:true,pmLabel:""},{id:"z2",name:"Consultant 2",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},rosterMode:"rolling",
               shiftTimes:{AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:o.pmEnd||"22:00"}},
               oncallWindows:JSON.parse(JSON.stringify(o.wins||[CALLIN,EARLY,LATE,NIGHT]))};
      if(o.fatigue)set.fatigue=o.fatigue;
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Khan, Athar",quota:20,eft:1},{id:"s2",name:"Park, Min",quota:20,eft:1},{id:"s3",name:"Lee, Jo",quota:20,eft:1}],
         cycles:[{id:"cc",cycle:{start:iso(addDays(new Date(),-10)),weeks:4},status:o.status||"published",archived:false,settings:set,
                  roles:{s1:{in:true,quota:20,eft:1},s2:{in:true,quota:20,eft:1},s3:{in:true,quota:20,eft:1}},assign:o.assign||{}}],
         activeId:"cc",viewAs:o.viewAs||"admin",tab:"selfroster",leave:o.leave||[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[]};
      if(o.oncall)S.cycles[0].oncall=o.oncall; if(o.callins)S.cycles[0].callins=o.callins;
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srSid=null; }
    toast=function(m){ said.push(String(m)); };
    try{
      // ---- the window option
      state();
      T("call-ins: a window is Fixed or Chosen when booked, and reads that way",
        ocChosen(ocWindow(c,"callin"))===true && ocChosen(ocWindow(c,"night"))===false && ocChosen({chosen:true,from:{zones:["z1"],period:"PM"}})===false && ocChosen(null)===false &&
        ocWhenText(ocWindow(c,"callin"))==="any hours 10:00–22:00, usually 4h" && ocWhenText(ocWindow(c,"night"))==="22:00–08:00" && ocUsualText({usual:270})==="4.5h");
      T("call-ins: a key is one day, one window and one person, and a broken key or value reads as nothing",
        ciKey(TODAY,"callin","s1")===TODAY+"|callin|s1" && JSON.stringify(ciParse(TODAY+"|callin|s1"))===JSON.stringify({d:TODAY,win:"callin",sid:"s1"}) &&
        ciParse("x|y")===null && ciValid({start:"14:00",end:"18:00"}) && !ciValid({start:"2pm",end:"18:00"}) && !ciValid(null) &&
        (function(){ state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(TODAY,"callin","s2")]={start:"bad",end:"18:00"}; c.callins["junk"]={start:"10:00",end:"11:00"};
          return ciGet(c,TODAY,"callin","s1").end==="18:00" && ciGet(c,TODAY,"callin","s2")===null && ciInUse(c,"callin")===1 && ciInUse(c,"night")===0; })());
      T("call-ins: a call-in window has no one holder, so a stray on-call key on it from an older copy of the app is ignored",
        (function(){ state({oncall:{}}); c.oncall[ocKey(TODAY,"callin")]="s1";
          return ocHolder(c,TODAY,"callin")===null && ocTakenBy(c,"s1",TODAY).length===0 && ocHeldBy(c,"s1",TODAY).length===0 && ocCountFor(c,"s1")===0; })());
      T("call-ins: taking a call-in window the on-call way is refused, even for an admin", (function(){
        state(); var r=ocTake("s1",TODAY,"callin");
        return r===false && !(c.oncall&&c.oncall[ocKey(TODAY,"callin")]) && said.some(function(m){ return /logged as a call-in/.test(m); }); })());
      T("call-ins: the On-call card draws a Chosen row with its range, usual length and words for logging, and a Fixed row as before", (function(){
        state(); S.tab="setup"; _setupTab="cycle"; var v=viewSetup(); S.tab="selfroster";
        return /class="listrow ocrow chosen" data-oci="0" data-ocid="callin"/.test(v) && /<option value="chosen" selected>Chosen when booked<\/option>/.test(v) &&
               /class="oc-len" min="0.5" step="0.5" value="4"/.test(v) && v.indexOf("Staff can log their own")>0 &&
               /class="listrow ocrow" data-oci="3" data-ocid="night"/.test(v) && /<option value="fixed" selected>Fixed hours<\/option>/.test(v) &&
               v.indexOf("chosen when booked</b>")>0; })());
      T("call-ins: reading the card keeps Chosen with its usual length in minutes, and a Chosen window never follows a shift", (function(){
        state(); S.tab="setup"; _setupTab="cycle"; render();
        var qsa=document.querySelectorAll, vals={".oc-hours":{value:"chosen"},".oc-len":{value:"4.5"}};
        var rows=[{dataset:{ocid:"night"},querySelector:function(q){ return vals[q]||null; },querySelectorAll:function(sel){ return sel===".oc-z"?[{value:"z1",checked:true}]:[]; }}];
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        var list; try{ list=ocRowsNow(); } finally { document.querySelectorAll=qsa; S.tab="selfroster"; }
        var n=list.find(function(w){ return w.id==="night"; });
        return n.chosen===true && n.usual===270 && n.from===null; })());
      T("call-ins: switching a row back to Fixed drops the usual length", (function(){
        state(); S.tab="setup"; _setupTab="cycle"; render();
        var qsa=document.querySelectorAll, vals={".oc-hours":{value:"fixed"}};
        var rows=[{dataset:{ocid:"callin"},querySelector:function(q){ return vals[q]||null; },querySelectorAll:function(){ return []; }}];
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        var list; try{ list=ocRowsNow(); } finally { document.querySelectorAll=qsa; S.tab="selfroster"; }
        var w=list.find(function(x){ return x.id==="callin"; });
        return w.chosen===undefined && w.usual===undefined; })());
      T("call-ins: a Chosen window needs a usual length that fits inside its hours", (function(){
        state(); var L=JSON.parse(JSON.stringify(c.settings.oncallWindows)), w=L[0];
        w.usual=0; var a=ocCheck(L,c); w.usual=780; var b=ocCheck(L,c); w.usual=720; var ok=ocCheck(L,c);
        return /needs a usual length/.test(a) && /longer than its hours/.test(b) && ok===""; })());
      T("call-ins: a window cannot switch between Fixed and Chosen while it is in use, either way, and says how many", (function(){
        state({oncall:{},callins:{}}); c.oncall[ocKey(TOMO,"night")]="s1"; c.callins[ciKey(TODAY,"callin","s2")]={start:"14:00",end:"18:00"};
        var L=JSON.parse(JSON.stringify(c.settings.oncallWindows));
        L[3].chosen=true; L[3].usual=240; var toChosen=ocCheck(L,c); delete L[3].chosen; delete L[3].usual;
        delete L[0].chosen; delete L[0].usual; var toFixed=ocCheck(L,c);
        delete c.callins[ciKey(TODAY,"callin","s2")]; var free=ocCheck(L,c);
        return /1 day is on call as Night, so its hours cannot switch to chosen when booked/.test(toChosen) &&
               /1 call-in is logged on Call-in \(C\), so its hours cannot switch to fixed/.test(toFixed) && free===""; })());
      T("call-ins: a Chosen window with call-ins cannot be removed, and the message says how many", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(YEST,"callin","s2")]={start:"10:00",end:"14:00"};
        S.tab="setup"; _setupTab="cycle";
        var qsa=document.querySelectorAll, rowEl={dataset:{ocid:"callin"},querySelector:function(){ return null; },querySelectorAll:function(){ return []; }};
        var del={closest:function(){ return rowEl; }}, asked=false; openConfirm=function(){ asked=true; return {then:function(){}}; };
        document.querySelectorAll=function(sel){ return sel==="#ocRows .oc-del"?[del]:(sel==="#ocRows [data-ocid]"?[rowEl]:[]); };
        try{ render(); if(del.onclick)del.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=keep.oc; S.tab="selfroster"; }
        return !!del.onclick && !asked && ocWindow(c,"callin")!==null && said.some(function(m){ return /2 call-ins are logged on Call-in \(C\)/.test(m); }); })());
      T("call-ins: choosing the hours on a row shows or hides its range and zone boxes at once, without saving", (function(){
        state(); S.tab="setup"; _setupTab="cycle";
        var qsa=document.querySelectorAll, toggled=[], row={classList:{toggle:function(k,on){ toggled.push(k+":"+on); }}}, sel={value:"chosen",closest:function(){ return row; }};
        var before=JSON.stringify(c.settings.oncallWindows);
        document.querySelectorAll=function(q){ return q==="#ocRows .oc-hours"?[sel]:[]; };
        try{ render(); if(sel.onchange)sel.onchange(); } finally { document.querySelectorAll=qsa; S.tab="selfroster"; }
        return toggled.join()==="chosen:true" && JSON.stringify(c.settings.oncallWindows)===before; })());
      T("call-ins: saving the card logs a Chosen window in words", (function(){
        state(); S.tab="setup"; _setupTab="cycle"; render();
        try{ document.getElementById("saveOncall").onclick(); } finally { S.tab="selfroster"; }
        return S.audit.some(function(a){ return a.action==="settings.oncall" && a.detail.indexOf("Call-in (C) any hours 10:00–22:00, usually 4h")===0; }); })());
      T("call-ins: the Get started checklist reads a Chosen window in words", (function(){
        state(); var row=setupChecklist().find(function(r){ return r.key==="oncall"; });
        return !!row && row.detail.indexOf("Call-in (C) any hours 10:00–22:00, usually 4h")===0 && row.detail.indexOf("Night 22:00–08:00")>0; })());
      T("call-ins: the day sheet and the cell dialog offer no Take it for a call-in window, and still do for a fixed one", (function(){
        state(); _srSid="s1"; var sheet=daySheetHTML(TODAY); _srSid=null;
        var root=document.getElementById("modalRoot"), q0=root.querySelector; root.querySelector=function(){ return {}; };
        var m=""; try{ openCell("s1",TODAY); m=root.innerHTML; } finally { root.querySelector=q0; root.innerHTML=""; }
        return sheet.indexOf('data-octake="'+TODAY+'|callin"')<0 && sheet.indexOf('data-octake="'+TODAY+'|night"')>0 &&
               m.indexOf('data-ocset="callin"')<0 && m.indexOf('data-ocset="night"')>0; })());
      T("call-ins: a free call-in window never reads as on call free on a Book shifts row", (function(){
        var ctx={batch:false,canPick:true,openCount:function(){ return 0; }};
        state({wins:[CALLIN]}); var only=dayRowHTML("s1",parseISO(TODAY),ctx);
        state(); var both=dayRowHTML("s1",parseISO(TODAY),ctx);
        return only.indexOf("on call free")<0 && both.indexOf("on call free")>0; })());
      // ---- call-ins: later tasks add their tests above this line
    } finally { S=keep.S; window._range=keep.range; download=keep.dl; XLSX=keep.x; toast=keep.toast; openConfirm=keep.oc; dailyDate=keep.daily; _setupTab=keep.sb; _srSid=keep.sr; hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/ci1-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `HARNESS ERROR: ReferenceError: Can't find variable: ocChosen`.

- [ ] **Step 3: Implement.** Create `$SP/ci1-app.py`:

```python
# helpers: the window option and the call-in record
rep(r'''function ocTime(w){ return w?(w.start+"@U@2013"+w.end):""; }''',
r'''function ocTime(w){ return w?(w.start+"@U@2013"+w.end):""; }
function ocChosen(w){ return !!(w&&w.chosen&&!w.from); }   // hours chosen when booked: the window is a range, and each call-in carries the hours really worked
function ocUsualText(w){ return Math.round((+(w&&w.usual)||0)/6)/10+"h"; }
function ocWhenText(w){ return ocChosen(w)?("any hours "+ocTime(w)+", usually "+ocUsualText(w)):ocTime(w); }   // what a person reads beside a window's name
/* ---------- call-ins: on-call booked once someone is called in, with the real hours ----------
   cyc.callins = {"<iso>|<windowId>|<staffId>": {start:"HH:MM", end:"HH:MM"}}: one key per person, per window, per day, so
   several people on one day need nothing special. Kept apart from cyc.oncall, which the two Edge Functions read. */
function ciKey(isoD,winId,sid){ return isoD+"|"+winId+"|"+sid; }
function ciParse(k){ const a=String(k).split("|"); return (a.length===3&&a[0]&&a[1]&&a[2])?{d:a[0],win:a[1],sid:a[2]}:null; }
function ciValid(v){ return !!v&&/^\d\d:\d\d$/.test(v.start||"")&&/^\d\d:\d\d$/.test(v.end||""); }
function ciGet(cyc,isoD,winId,sid){ const v=cyc&&cyc.callins&&cyc.callins[ciKey(isoD,winId,sid)]; return ciValid(v)?v:null; }
function ciInUse(cyc,winId){ const c=cyc||active(); if(!c||!c.callins)return 0;
  return Object.keys(c.callins).filter(k=>{ const p=ciParse(k); return !!p&&p.win===winId&&ciValid(c.callins[k]); }).length; }''')
# a call-in window has no holder, is never carried as on-call, and is never taken the on-call way
rep(r'''const w=ocWindow(c,winId);
  if(w&&w.from){ const a=c.assign||{}, p=S.staff.find(x=>ocFollows(c,w,a[x.id+"|"+isoD])); return p?p.id:null; }''',
r'''const w=ocWindow(c,winId);
  if(ocChosen(w))return null;   // a call-in window has no one holder: each call-in belongs to whoever logged it, and a stray on-call key on it is ignored
  if(w&&w.from){ const a=c.assign||{}, p=S.staff.find(x=>ocFollows(c,w,a[x.id+"|"+isoD])); return p?p.id:null; }''')
rep(r'''return (wins||ocWindows(c)).filter(w=>{ if(w.from)return ocFollows(c,w,sh);''',
r'''return (wins||ocWindows(c)).filter(w=>{ if(ocChosen(w))return false; if(w.from)return ocFollows(c,w,sh);''')
rep(r'''const ws=ocTakenWindows(c).filter(w=>c.oncall[ocKey(isoD,w.id)]===sid);''',
r'''const ws=ocTakenWindows(c).filter(w=>!ocChosen(w)&&c.oncall[ocKey(isoD,w.id)]===sid);''')
rep(r'''if(w.from)return {ok:false,reason:w.label+" follows the roster @U@2014 it isn@U@2019t taken by hand."};''',
r'''if(w.from)return {ok:false,reason:w.label+" follows the roster @U@2014 it isn@U@2019t taken by hand."};
    if(ocChosen(w))return {ok:false,reason:w.label+" is logged as a call-in, with the hours worked."};''')
# the card row
rep(r'''gone=fz.filter(id=>!zoneById(id));
  return `<div class="listrow ocrow" data-oci="${i}" data-ocid="${escapeHTML(w.id)}">''',
r'''gone=fz.filter(id=>!zoneById(id)), ch=ocChosen(w);
  return `<div class="listrow ocrow${ch?" chosen":""}" data-oci="${i}" data-ocid="${escapeHTML(w.id)}">''')
rep(r'''    <input type="time" class="oc-start" value="${w.start}" aria-label="${escapeHTML(w.label)} start"> <span class="muted small">to</span> <input type="time" class="oc-end" value="${w.end}" aria-label="${escapeHTML(w.label)} end">
    <span class="muted small">${ocHours(w)}h</span>''',
r'''    <select class="oc-hours" aria-label="${escapeHTML(w.label)}: hours"><option value="fixed"${ch?"":" selected"}>Fixed hours</option><option value="chosen"${ch?" selected":""}>Chosen when booked</option></select>
    <span class="muted small oc-when-chosen">between</span> <input type="time" class="oc-start" value="${w.start}" aria-label="${escapeHTML(w.label)} start"> <span class="muted small">to</span> <input type="time" class="oc-end" value="${w.end}" aria-label="${escapeHTML(w.label)} end">
    <span class="muted small oc-when-fixed">${ocHours(w)}h</span>
    <label class="oc-when-chosen"><span class="muted small">usually</span> <input type="number" class="oc-len" min="0.5" step="0.5" value="${ch?Math.round((+w.usual||240)/30)/2:4}" style="width:64px" aria-label="${escapeHTML(w.label)}: usual length in hours"> <span class="muted small">hours</span></label>''')
rep(r'''<label><input type="checkbox" class="oc-book" ${w.book!==false?"checked":""}> Staff can take it</label>''',
r'''<label><input type="checkbox" class="oc-book" ${w.book!==false?"checked":""}> <span class="oc-when-fixed">Staff can take it</span><span class="oc-when-chosen">Staff can log their own</span></label>''')
# reading the card
rep(r'''const bk=g(".oc-book"); if(bk)w.book=!!bk.checked; const rs=g(".oc-rest"); if(rs)w.rest=!!rs.checked;''',
r'''const bk=g(".oc-book"); if(bk)w.book=!!bk.checked; const rs=g(".oc-rest"); if(rs)w.rest=!!rs.checked;
    const hs=g(".oc-hours"); if(hs&&hs.value){ if(hs.value==="chosen"){ const ln=parseFloat((g(".oc-len")||{}).value); w.chosen=true; w.usual=isFinite(ln)?Math.round(ln*2)*30:0; } else { delete w.chosen; delete w.usual; } }   // usual is kept in minutes, in half hours''')
rep(r'''w.from=on.length?{zones:on,period:(w.from&&w.from.period)||"PM"}:null; } }); }catch(e){}''',
r'''w.from=on.length?{zones:on,period:(w.from&&w.from.period)||"PM"}:null; } if(w.chosen)w.from=null; }); }catch(e){}''')
# the card's rules
rep(r'''Clear those first, or add a new window."; });   // their keys would be read as nothing, silently
  return bad; }''',
r'''Clear those first, or add a new window."; });   // their keys would be read as nothing, silently
  if(!bad)list.forEach(w=>{ if(bad||!w.chosen)return; const mins=Math.round(_tHours(w.start,w.end)*60);
    if(!(+w.usual>0))bad=w.label+" needs a usual length."; else if(+w.usual>mins)bad="The usual length of "+w.label+" is longer than its hours."; });
  if(!bad)list.forEach(w=>{ if(bad)return; const was=ocWindow(c,w.id); if(!was||!!was.chosen===!!w.chosen)return;
    const n=was.chosen?ciInUse(c,w.id):ocInUse(c,w.id); if(!n)return;
    bad=was.chosen?(n+" call-in"+(n===1?" is":"s are")+" logged on "+w.label+", so its hours cannot switch to fixed. Remove them first, or add a new window.")
                  :(n+" "+(n===1?"day is":"days are")+" on call as "+w.label+", so its hours cannot switch to chosen when booked. Clear those first, or add a new window."); });   // either way, what is already on the roster would be read as nothing
  return bad; }''')
rep(r'''if(used){ toast(used+" "+(used===1?"day is":"days are")+" on call as "+gone+". Clear those first, or leave the window in place.","warn"); return; }''',
r'''if(used){ toast(used+" "+(used===1?"day is":"days are")+" on call as "+gone+". Clear those first, or leave the window in place.","warn"); return; }
      const logged=ciInUse(c,id); if(logged){ toast(logged+" call-in"+(logged===1?" is":"s are")+" logged on "+gone+". Untick Staff can log their own to stop new ones, or leave the window in place.","warn"); return; }''')
rep(r'''if(ocCardStale()||ocInUse(active(),id)){''', r'''if(ocCardStale()||ocInUse(active(),id)||ciInUse(active(),id)){''')
rep(r'''out.map(w=>w.label+" "+ocTime(w)+(w.from?''', r'''out.map(w=>w.label+" "+ocWhenText(w)+(w.from?''')
rep(r'''    const soc=document.getElementById("saveOncall");''',
r'''    document.querySelectorAll("#ocRows .oc-hours").forEach(sel=>sel.onchange=()=>{ const rowEl=sel.closest?sel.closest("[data-ocid]"):null; if(rowEl&&rowEl.classList)rowEl.classList.toggle("chosen",sel.value==="chosen"); });   // shows the range and usual length and hides the zone boxes at once; nothing is saved until Save
    const soc=document.getElementById("saveOncall");''')
rep(r'''.oc-from{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px}''',
r'''.oc-from{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px} .ocrow .oc-when-chosen{display:none} .ocrow.chosen .oc-when-chosen{display:inline} .ocrow.chosen .oc-when-fixed,.ocrow.chosen .oc-from{display:none}''')
rep(r'''whoever works that evening carries it, and nobody takes it by hand.</div>''',
r'''whoever works that evening carries it, and nobody takes it by hand. Or its hours are <b>chosen when booked</b>: a call-in, logged once someone has been called in, with the hours they worked, and as many people a day as are called in.</div>''')
rep(r'''detail:ocWindows(a).length?ocWindows(a).map(w=>w.label+" "+ocTime(w))''', r'''detail:ocWindows(a).length?ocWindows(a).map(w=>w.label+" "+ocWhenText(w))''')
# no Take it for a call-in window on the day sheet, in the cell dialog, or as "on call free"
rep(r'''const ws=ocTakenWindows(cyc); if(!ws.length)return "";''', r'''const ws=ocTakenWindows(cyc).filter(w=>!ocChosen(w)); if(!ws.length)return "";''')
rep(r'''${ocTakenWindows(_cy).length?`<div class="sub" style="margin-top:12px"><b>On call</b>''', r'''${ocTakenWindows(_cy).filter(w=>!ocChosen(w)).length?`<div class="sub" style="margin-top:12px"><b>On call</b>''')
rep(r'''<div class="zonebtns" id="ocChoices">${ocTakenWindows(_cy).map(w=>{''', r'''<div class="zonebtns" id="ocChoices">${ocTakenWindows(_cy).filter(w=>!ocChosen(w)).map(w=>{''')
rep(r'''ocTakenWindows(_c).some(w=>!ocHolder(_c,isoD,w.id)&&''', r'''ocTakenWindows(_c).some(w=>!ocChosen(w)&&!ocHolder(_c,isoD,w.id)&&''')
```

- [ ] **Step 4: Apply it and run the tests to see them pass.**

```bash
python3 $SP/rep.py app.html $SP/ci1-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 22`, then no `FAIL` or `ERROR` lines and `… passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js deploy/demo.html
git commit -m "Call-ins 1/7: an on-call window's hours can be chosen when booked. The card gains Fixed hours or Chosen when booked, with a range and a usual length; a Chosen window never follows a shift, cannot switch either way while in use, and cannot be removed while call-ins are logged on it. It has no holder and is never taken the on-call way, so the day sheet, cell dialog and Book shifts rows stop offering it

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Call-ins reach on-call's readers, with their real hours

**Files:**
- Modify: `app.html` (helpers after `ciInUse`, `ocSpan`, `ocHeldBy`, `ocTakenBy`, `approveRequest`, `plannerSetLeave`, `icsText`, `equityData`, `viewDaily`, `wireStaffRows`)
- Test: `tests/suite.js`

**Interfaces:**
- Consumes: Task 1's `ocChosen`, `ciParse`, `ciValid`, `ciGet`.
- Produces:
  - `ciMin("HH:MM") → minutes` and `ciHM(minutes) → "HH:MM"` (wraps at 24 hours).
  - `ciAt(w,{start,end}) → {…w, start, end, ci:true, night:boolean}`. `night` is true when the window's range crosses midnight and the call-in starts before the range does.
  - `ocSpan(isoD,w)` starts on the next calendar day when `w.night`.
  - `ciOnDay(cyc,isoD) → [{w, sid, k}]`, everyone called in that day, earliest first.
  - `ciDropFor(cyc, ids[])` deletes those people's call-ins.
  - `ocTakenBy` and `ocHeldBy` include call-in copies. A writer that clears on-call from them must skip `w.ci`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/ci2-suite.py`:

```python
MARK = r'''      // ---- call-ins: later tasks add their tests above this line'''
rep(MARK, r'''      // ---- call-ins reach on-call's readers, with their real hours
      state({callins:{},assign:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"};
      T("call-ins: a call-in reads as its window with the hours worked, on a copy that says it is a call-in", (function(){
        var t=ocTakenBy(c,"s1",TODAY), h=ocHeldBy(c,"s1",TODAY);
        return t.length===1 && t[0].id==="callin" && t[0].ci===true && t[0].start==="14:00" && t[0].end==="18:00" && ocHours(t[0])===4 &&
               h.length===1 && h[0].ci===true && ocWindow(c,"callin").start==="10:00" && ocTakenBy(c,"s2",TODAY).length===0 && ocCountFor(c,"s1")===1; })());
      T("call-ins: several consultants on one day each read as their own, earliest first", (function(){
        c.callins[ciKey(TODAY,"callin","s2")]={start:"10:00",end:"14:00"};
        var ok=ocTakenBy(c,"s2",TODAY)[0].start==="10:00" && ocTakenBy(c,"s1",TODAY)[0].start==="14:00" && ciOnDay(c,TODAY).map(function(x){ return x.sid; }).join()==="s2,s1";
        delete c.callins[ciKey(TODAY,"callin","s2")]; return ok; })());
      T("call-ins: in a range that crosses midnight, a call-in that starts before the range does is that night's small hours", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"late","s1")]={start:"00:15",end:"01:45"}; c.callins[ciKey(YEST,"late","s2")]={start:"23:00",end:"01:00"};
        var a=ocSpan(TODAY,ocTakenBy(c,"s1",TODAY)[0]), b=ocSpan(YEST,ocTakenBy(c,"s2",YEST)[0]), next=addDays(parseISO(TODAY),1), y=parseISO(YEST);
        return a.st.getDate()===next.getDate() && a.st.getHours()===0 && a.st.getMinutes()===15 && a.en.getHours()===1 && a.en.getMinutes()===45 &&
               b.st.getDate()===y.getDate() && b.st.getHours()===23 && b.en.getDate()===parseISO(TODAY).getDate() && b.en.getHours()===1; })());
      state({callins:{},assign:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"};
      T("call-ins: payroll gives a call-in its own row, under the window's code, with the real hours and no zone", (function(){
        var r=payrollRows().filter(function(x){ return x.name==="Khan, Athar"&&x.code==="C"; });
        return r.length===1 && r[0].date===TODAY && r[0].start==="14:00" && r[0].end==="18:00" && r[0].hours===4 && r[0].unit==="" && r[0].note==="Call-in (C)"; })());
      T("call-ins: the RosterOn data sheet lists the call-in with its real hours", (function(){
        var sheets=[]; download=function(){}; XLSX={utils:{aoa_to_sheet:function(a){ sheets.push(JSON.parse(JSON.stringify(a))); return {}; },book_new:function(){ return {}; },book_append_sheet:function(){}},writeFile:function(){}};
        exportRosterOn(); var DS=sheets[1]||[];
        return DS.some(function(r){ return r[0]==="Khan, Athar" && r[4]==="Call-in (C)" && r[5]==="" && r[6]==="C" && r[7]==="14:00" && r[8]==="18:00" && r[9]===4; }); })());
      T("call-ins: the roster CSV and Excel exports name a call-in beside the day", (function(){
        var got=[]; download=function(x){ got.push(String(x)); }; exportRosterCSV(); exportRosterXLS();
        return got.length===2 && got[0].indexOf('"On call Call-in (C)"')>0 && got[1].indexOf("<td>On call Call-in (C)</td>")>0; })());
      T("call-ins: My shifts counts a call-in with its hours, the week strip and the shared week show it, and the roster marks it", (function(){
        S.viewAs="s1"; window._range=null; var my=viewMy(), wk=weekStripHTML("s1",TODAY), sh=shareWeekText("s1"), mk=ocMark(c,"s1",TODAY,true); S.viewAs="admin";
        return /<span class="tag lg oc"[^>]*>On call 1 · 4h<\/span>/.test(my) && wk.indexOf("Call-in (C) 14:00–18:00")>0 &&
               sh.indexOf("On call Call-in (C) 14:00–18:00")>0 && mk.indexOf('title="On call Call-in (C) 14:00–18:00"')>0 && mk.indexOf(">OC<")>0; })());
      T("call-ins: Book shifts shows the call-in on its row", dayRowHTML("s1",parseISO(TODAY),{batch:false,canPick:true,openCount:function(){ return 0; }}).indexOf('<span class="tag oc">Call-in (C)</span>')>0);
      T("call-ins: the day board lists who was called in, and when", (function(){
        dailyDate=TODAY; S.tab="daily"; var b=viewDaily(); S.tab="selfroster";
        return b.indexOf("Khan, Athar")>0 && b.indexOf("Called in 14:00–18:00")>0; })());
      T("call-ins: Fairness counts a call-in on its own, and once with a shift that day; a stray on-call key on a call-in window counts nothing", (function(){
        c.assign["s2|"+TODAY]={kind:"clinical",period:"AM",zone:"z1"}; c.callins[ciKey(TODAY,"callin","s2")]={start:"17:00",end:"21:00"};
        c.oncall={}; c.oncall[ocKey(TODAY,"callin")]="s3";
        var eq=equityData("cycle"), e1=eq.find(function(r){ return r.s.id==="s1"; }), e2=eq.find(function(r){ return r.s.id==="s2"; }), e3=eq.find(function(r){ return r.s.id==="s3"; });
        delete c.assign["s2|"+TODAY]; delete c.callins[ciKey(TODAY,"callin","s2")]; delete c.oncall;
        return !!e1 && e1.m.oc===1 && e1.m.booked===0 && !!e2 && e2.m.oc===1 && e2.m.booked===1 && (!e3 || e3.m.oc===0); })());
      T("call-ins: safe hours count a call-in as duty, and taking a fixed window over it is refused", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"late","s1")]={start:"21:00",end:"23:00"};
        var sp=_spansOn(c,"s1",TODAY), duty=_onDutyDay("s1",TODAY), r=ocTake("s1",TODAY,"night");
        return sp.length===1 && sp[0].st.getHours()===21 && duty===2 && r===false && !(c.oncall&&c.oncall[ocKey(TODAY,"night")]); })());
      T("call-ins: the calendar download and the live feed leave call-ins out, and nobody is reminded about one", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; window._range={from:TODAY,to:TODAY};
        var ics=icsText("s1"), feed=(typeof ICSFN!=="undefined")?ICSFN.buildICS(S,S.staff[0],null):"", rem=(typeof REMINDFN!=="undefined")?REMINDFN.reminderFor(S,S.staff[0],TODAY):null;
        return ics.indexOf("Call-in")<0 && String(feed).indexOf("Call-in")<0 && rem===null; })());
      T("call-ins: approving leave or setting it on the planner keeps a call-in, because it is hours already worked", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(YEST,"callin","s1")]={start:"10:00",end:"14:00"};
        S.requests=[{id:"rl1",type:"leave",from:"s1",code:"AL",dateFrom:TODAY,dateTo:TODAY,status:"pending",createdTs:Date.now()}];
        var threw=false; try{ approveRequest("rl1",""); plannerSetLeave("s1",YEST,"CME"); }catch(e){ threw=String(e); }
        return threw===false && !!ciGet(c,TODAY,"callin","s1") && !!ciGet(c,YEST,"callin","s1") && S.requests[0].status==="approved"; })());
      T("call-ins: taking someone out of the cycle or the group takes their call-ins with them, on all three paths", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(TODAY,"callin","s2")]={start:"10:00",end:"14:00"};
        ciDropFor(c,["s1"]);
        return !ciGet(c,TODAY,"callin","s1") && !!ciGet(c,TODAY,"callin","s2") && (String(wireStaffRows).match(/ciDropFor\(/g)||[]).length===3; })());
''' + "\n" + MARK)
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/ci2-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `FAIL  call-ins: a call-in reads as its window with the hours worked…`, then a `HARNESS ERROR` (a TypeError reading `start` of a call-in the readers do not return yet).

- [ ] **Step 3: Implement.** Create `$SP/ci2-app.py`:

```python
rep(r'''  return Object.keys(c.callins).filter(k=>{ const p=ciParse(k); return !!p&&p.win===winId&&ciValid(c.callins[k]); }).length; }''',
r'''  return Object.keys(c.callins).filter(k=>{ const p=ciParse(k); return !!p&&p.win===winId&&ciValid(c.callins[k]); }).length; }
function ciMin(hm){ const x=String(hm).split(":"); return (+x[0])*60+(+x[1]); }
function ciHM(n){ n=((n%1440)+1440)%1440; return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0"); }
function ciAt(w,ci){ return Object.assign({},w,{start:ci.start,end:ci.end,ci:true,night:ciMin(w.end)<=ciMin(w.start)&&ciMin(ci.start)<ciMin(w.start)}); }   // the window as this call-in worked it: the real hours on a copy, so every reader of hours reads them. In a range that crosses midnight, a call-in starting before the range does is that night's small hours
function ciOnDay(cyc,isoD){ const c=cyc||active(); if(!c||!c.callins)return []; const ws=ocTakenWindows(c).filter(ocChosen), out=[];
  Object.keys(c.callins).forEach(k=>{ const p=ciParse(k), v=c.callins[k]; if(!p||p.d!==isoD||!ciValid(v)||!S.staff.some(s=>s.id===p.sid))return;
    const w=ws.find(x=>x.id===p.win); if(w)out.push({w:ciAt(w,v),sid:p.sid,k:k}); });
  return out.sort((a,b)=>ocSpan(isoD,a.w).st-ocSpan(isoD,b.w).st); }   // everyone called in that day, earliest first
function ciDropFor(cyc,ids){ if(!cyc||!cyc.callins)return; Object.keys(cyc.callins).forEach(k=>{ const p=ciParse(k); if(p&&ids.indexOf(p.sid)>=0)delete cyc.callins[k]; }); }   // someone taken out of a cycle or the group takes their call-ins with them, as their shifts go''')
rep(r'''function ocSpan(isoD,w){ const d0=parseISO(isoD);''', r'''function ocSpan(isoD,w){ const d0=(w&&w.night)?addDays(parseISO(isoD),1):parseISO(isoD);   // a call-in in the small hours of a range that crosses midnight belongs to the next calendar day''')
rep(r'''return (wins||ocWindows(c)).filter(w=>{ if(ocChosen(w))return false; if(w.from)return ocFollows(c,w,sh); if(!(c.oncall&&c.oncall[ocKey(isoD,w.id)]===sid))return false; if(can===null)can=ocCanHold(c,sid,isoD); return can; }); }   // every window a person carries that day, taken or following their shift: what pay, the calendar and the counts read''',
r'''const out=[]; (wins||ocWindows(c)).forEach(w=>{ if(ocChosen(w)){ const ci=ciGet(c,isoD,w.id,sid); if(ci)out.push(ciAt(w,ci)); return; }
    if(w.from){ if(ocFollows(c,w,sh))out.push(w); return; }
    if(!(c.oncall&&c.oncall[ocKey(isoD,w.id)]===sid))return; if(can===null)can=ocCanHold(c,sid,isoD); if(can)out.push(w); });
  return out; }   // every window a person carries that day, taken, following their shift, or logged as a call-in with its real hours: what pay, the calendar and the counts read''')
rep(r'''function ocTakenBy(cyc,sid,isoD){ const c=cyc||active(); if(!c||!c.oncall||!sid)return []; const ws=ocTakenWindows(c).filter(w=>!ocChosen(w)&&c.oncall[ocKey(isoD,w.id)]===sid); return (ws.length&&!ocCanHold(c,sid,isoD))?[]:ws; }   // only the windows a person took: what the screens draw, and all there is to clear''',
r'''function ocTakenBy(cyc,sid,isoD){ const c=cyc||active(); if(!c||!sid)return []; const all=ocTakenWindows(c);
  let ws=c.oncall?all.filter(w=>!ocChosen(w)&&c.oncall[ocKey(isoD,w.id)]===sid):[]; if(ws.length&&!ocCanHold(c,sid,isoD))ws=[];
  all.forEach(w=>{ if(!ocChosen(w))return; const ci=ciGet(c,isoD,w.id,sid); if(ci)ws=ws.concat([ciAt(w,ci)]); });
  return ws; }   // the windows a person took, and the call-ins they logged with their real hours: what the screens draw. A call-in copy says ci:true, so a writer clearing on-call leaves it alone''')
# the two writers that clear on-call through ocTakenBy leave call-ins alone (they are hours already worked)
rep(r'''ocTakenBy(c,r.from,d).forEach(w=>{ delete c.oncall[ocKey(d,w.id)]; });''', r'''ocTakenBy(c,r.from,d).filter(w=>!w.ci).forEach(w=>{ delete c.oncall[ocKey(d,w.id)]; });''')
rep(r'''if(code)ocTakenBy(c,staffId,isoD).forEach(w=>{ delete c.oncall[ocKey(isoD,w.id)]; });''', r'''if(code)ocTakenBy(c,staffId,isoD).filter(w=>!w.ci).forEach(w=>{ delete c.oncall[ocKey(isoD,w.id)]; });''')
# calendars leave call-ins out: they are logged after the fact
rep(r'''ocHeldBy(_cyI,sid,iso(d),_ocW).forEach(w=>{''', r'''ocHeldBy(_cyI,sid,iso(d),_ocW).filter(w=>!w.ci).forEach(w=>{''')
# Fairness
rep(r'''const _on=wins.filter(w=>w.from?ocFollows(cyc,w,v):oc[ocKey(d,w.id)]===sid).length;''', r'''const _on=wins.filter(w=>ocChosen(w)?!!ciGet(cyc,d,w.id,sid):(w.from?ocFollows(cyc,w,v):oc[ocKey(d,w.id)]===sid)).length;''')
rep(r'''if(!taken.some(w=>w.id===wid))return;''', r'''if(!taken.some(w=>w.id===wid&&!ocChosen(w)))return;''')
rep(r'''(rows[sid]=rows[sid]||blank()).oc++; });   // on call with no shift that day: its own count, and no tough SHIFT, because there is no shift''',
r'''(rows[sid]=rows[sid]||blank()).oc++; });   // on call with no shift that day: its own count, and no tough SHIFT, because there is no shift
    Object.keys(cyc.callins||{}).forEach(k=>{ const p=ciParse(k); if(!p||!ciValid(cyc.callins[k]))return;
      if(period==="ytd"&&p.d.slice(0,4)!==yr)return;
      const a=(cyc.assign||{})[p.sid+"|"+p.d]; if(a&&a.kind==="clinical")return;   // counted with that day's shift above
      if(!taken.some(w=>w.id===p.win&&ocChosen(w)))return;
      (rows[p.sid]=rows[p.sid]||blank()).oc++; });   // a call-in with no shift that day counts on its own, like on-call''')
# the day board
rep(r'''ws=ocTakenWindows(_c).filter(w=>ocHolder(_c,dISO,w.id));
      return ws.length?`''', r'''ws=ocTakenWindows(_c).filter(w=>ocHolder(_c,dISO,w.id)), cis=ciOnDay(_c,dISO);
      return (ws.length||cis.length)?`''')
rep(r'''<span class="muted small">${ocTime(w)}</span></div>`).join("")}`:""; })()}''',
r'''<span class="muted small">${ocTime(w)}</span></div>`).join("")}${cis.map(x=>`<div class="listrow"><span class="tag oc" style="min-width:62px;text-align:center">${escapeHTML(x.w.label)}</span><span class="grow">${escapeHTML(nameOf(x.sid))}</span><span class="muted small">Called in ${ocTime(x.w)}</span></div>`).join("")}`:""; })()}''')
# the three ways a person leaves a cycle or the group
rep(r'''if(c.oncall)Object.keys(c.oncall).forEach(k=>{if(c.oncall[k]===id)delete c.oncall[k];});});''', r'''if(c.oncall)Object.keys(c.oncall).forEach(k=>{if(c.oncall[k]===id)delete c.oncall[k];});ciDropFor(c,[id]);});''')
rep(r'''if(c.oncall)Object.keys(c.oncall).forEach(k=>{if(c.oncall[k]===id)delete c.oncall[k];}); }''', r'''if(c.oncall)Object.keys(c.oncall).forEach(k=>{if(c.oncall[k]===id)delete c.oncall[k];}); ciDropFor(c,[id]); }''')
rep(r'''if(c.oncall)Object.keys(c.oncall).forEach(k=>{if(ids.has(c.oncall[k]))delete c.oncall[k];});});''', r'''if(c.oncall)Object.keys(c.oncall).forEach(k=>{if(ids.has(c.oncall[k]))delete c.oncall[k];});ciDropFor(c,Array.from(ids));});''')
```

- [ ] **Step 4: Apply it and run the tests to see them pass.**

```bash
python3 $SP/rep.py app.html $SP/ci2-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 15`, no `FAIL` or `ERROR`, and `tests/oncall-golden.js` comparisons still pass (they are part of the run).

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js deploy/demo.html
git commit -m "Call-ins 2/7: a call-in reaches every reader on-call reaches, with its real hours. ocTakenBy and ocHeldBy hand back a copy of the window carrying the call-in's hours and ci:true, so payroll, RosterOn, the roster exports, My shifts, the week strip, the shared week, the grid marks and safe hours read call-ins with no change of their own; a call-in in the small hours of a range that crosses midnight is measured on the next calendar day. The calendar download leaves call-ins out, Fairness and the day board count and list them, approving leave keeps them, and the three ways someone leaves a cycle or the group take them

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Logging, changing and removing a call-in

**Files:**
- Modify: `app.html` (new functions after `ocClear`, `ocFatigueCheck`, `AUDIT_WORDS`)
- Test: `tests/suite.js`

**Interfaces:**
- Consumes: Task 1's `ocChosen`, `ciKey`, `ciGet`; Task 2's `ciMin`, `ciHM`, `ciAt`, and `ocHeldBy` including call-ins (which `ocClash` reads).
- Produces:
  - `ciOnTime(isoD) → boolean`: the day is today or yesterday, by the phone's own date.
  - `ciInRange(w,start,end) → boolean`.
  - `ciDefaults(w,isoD) → {start,end}`.
  - `ciShiftClash(c,sid,isoD,span) → ""`, or the clashing shift's label (with " on <day>" when the shift is on the day before or after).
  - `ciRefusal(c,w,sid,isoD,start,end) → ""` or the reason.
  - `ciSave(sid,isoD,winId,start,end) → boolean` and `ciRemove(sid,isoD,winId) → boolean`, both through `commitGuarded` (false means refused, with a toast).
  - `ocFatigueCheck(sid,isoD,winId,times)`: optional `times` `{start,end}`.
  - Audit keys `callin.log`, `callin.change`, `callin.remove`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/ci3-suite.py`:

```python
MARK = r'''      // ---- call-ins: later tasks add their tests above this line'''
rep(MARK, r'''      // ---- logging, changing and removing a call-in
      T("call-ins: a range check that understands midnight",
        ciInRange(CALLIN,"14:00","18:00") && !ciInRange(CALLIN,"21:00","23:00") && !ciInRange(CALLIN,"18:00","14:00") && !ciInRange(CALLIN,"14:00","14:00") &&
        ciInRange(LATE,"23:00","01:00") && ciInRange(LATE,"01:00","03:00") && !ciInRange(LATE,"03:00","05:00") && !ciInRange(LATE,"19:00","21:00") && ciInRange(EARLY,"00:30","03:00"));
      T("call-ins: From starts at the start of the range on another day, and To follows the usual length within the range", (function(){
        var a=ciDefaults(CALLIN,YEST), b=ciDefaults(LATE,YEST), d=ciDefaults(Object.assign({},CALLIN,{usual:780}),YEST), t=ciDefaults(CALLIN,TODAY);
        return a.start==="10:00" && a.end==="14:00" && b.start==="20:00" && b.end==="22:00" && d.end==="22:00" && /^\d\d:\d\d$/.test(t.start) && ciInRange(CALLIN,t.start,t.end); })());
      state({assign:{}}); S.viewAs="s1";
      T("call-ins: a consultant logs a call-in today, and the admins are told", (function(){
        var r=ciSave("s1",TODAY,"callin","14:00","18:00"), v=ciGet(c,TODAY,"callin","s1");
        return r===true && !!v && v.start==="14:00" && v.end==="18:00" && S.audit[0].action==="callin.log" &&
               S.notifications.some(function(n){ return n.to==="admin" && n.text.indexOf("Khan, Athar logged a call-in on ")===0 && n.text.indexOf(", 14:00–18:00.")>0; }); })());
      T("call-ins: logging again changes the one call-in instead of adding a second", (function(){
        var r=ciSave("s1",TODAY,"callin","15:00","19:00"), keys=Object.keys(c.callins).filter(function(k){ return k.indexOf("|s1")>0; });
        return r===true && keys.length===1 && ciGet(c,TODAY,"callin","s1").start==="15:00" && S.audit[0].action==="callin.change" && S.audit[0].detail.indexOf("14:00–18:00 → 15:00–19:00")>0; })());
      T("call-ins: several consultants can be called in on the same day", (function(){
        S.viewAs="s2"; var r=ciSave("s2",TODAY,"callin","10:00","14:00"); S.viewAs="s1";
        return r===true && !!ciGet(c,TODAY,"callin","s2") && !!ciGet(c,TODAY,"callin","s1"); })());
      T("call-ins: a consultant logs on the day or the day after, not before and not later; an admin logs any day", (function(){
        var y=ciSave("s1",YEST,"callin","10:00","14:00"), t=ciSave("s1",TOMO,"callin","10:00","14:00"), o=ciSave("s1",OLD,"callin","10:00","14:00");
        S.viewAs="admin"; var a=ciSave("s1",OLD,"callin","10:00","14:00"); S.viewAs="s1";
        return y===true && t===false && o===false && a===true && !ciGet(c,TOMO,"callin","s1") &&
               said.some(function(m){ return m.indexOf("A call-in is logged on the day or the day after")===0; }) &&
               S.notifications.some(function(n){ return n.to==="s1" && n.text.indexOf("Your admin logged a call-in for you on ")===0; }); })());
      T("call-ins: hours outside the range, or ending before they start, are refused for everyone", (function(){
        S.viewAs="s3"; var a=ciSave("s3",TODAY,"callin","09:00","12:00"), b=ciSave("s3",TODAY,"callin","21:00","23:00"), d=ciSave("s3",TODAY,"callin","16:00","15:00"), e=ciSave("s3",TODAY,"callin","","15:00");
        S.viewAs="admin"; var f=ciSave("s3",TODAY,"callin","09:00","12:00"); S.viewAs="s1";
        return a===false && b===false && d===false && e===false && f===false && !ciGet(c,TODAY,"callin","s3") &&
               said.indexOf("Choose hours between 10:00 and 22:00, with the end after the start.")>=0 && said.indexOf("Fill in both times.")>=0; })());
      T("call-ins: a consultant logs only their own", (function(){
        S.viewAs="s1"; var r=ciSave("s2",YEST,"callin","10:00","14:00");
        return r===false && !ciGet(c,YEST,"callin","s2") && said.indexOf("You can only log your own call-in.")>=0; })());
      T("call-ins: hours over the person's own shift are refused, and back to back is fine", (function(){
        state({assign:{}}); c.assign["s1|"+TODAY]={kind:"clinical",period:"AM",zone:"z1"}; S.viewAs="s1";
        var over=ciSave("s1",TODAY,"callin","16:00","20:00"), after=ciSave("s1",TODAY,"callin","17:00","21:00");
        return over===false && after===true && said.some(function(m){ return /^You’re working .+ then\.$/.test(m); }); })());
      T("call-ins: a shift from the day before that runs past midnight counts as a clash too", (function(){
        state({assign:{},pmEnd:"01:00"}); c.assign["s1|"+YEST]={kind:"clinical",period:"PM",zone:"z1"}; S.viewAs="s1";
        var sp=_shiftSpan("s1",YEST,"PM","z1"), r=ciSave("s1",TODAY,"early","00:30","03:00");
        return sp.en.getHours()===1 && r===false && said.some(function(m){ return /^You’re working .+ on .+ then\.$/.test(m); }); })());
      T("call-ins: hours over the person's own on-call or another of their call-ins are refused", (function(){
        state({assign:{},oncall:{}}); c.oncall[ocKey(TODAY,"night")]="s2"; S.viewAs="s2";
        var overNight=ciSave("s2",TODAY,"late","21:00","23:00"), backToBack=ciSave("s2",TODAY,"late","20:00","22:00"), overCallin=ciSave("s2",TODAY,"callin","18:00","21:00");
        return overNight===false && backToBack===true && overCallin===false && said.some(function(m){ return /^You’re already on call for /.test(m); }); })());
      T("call-ins: nobody logs a call-in on a leave day, not even an admin, and nobody off the cycle's roster", (function(){
        state({assign:{},leave:[{id:"lv",staffId:"s1",code:"AL",from:TODAY,to:TODAY,status:"approved",requestId:"t"}]});
        var a=ciSave("s1",TODAY,"callin","14:00","18:00");
        c.roles.s3.in=false; hydrateCycleRoles(); var b=ciSave("s3",TODAY,"callin","14:00","18:00"); c.roles.s3.in=true; hydrateCycleRoles();
        return a===false && b===false && said.some(function(m){ return /on leave that day/.test(m); }) && said.some(function(m){ return /cycle’s roster/.test(m); }); })());
      T("call-ins: a window only the admin logs, or a roster still in draft, is refused to a consultant and open to the admin", (function(){
        state({wins:[Object.assign({},CALLIN,{book:false}),NIGHT]}); S.viewAs="s1"; var nb=ciSave("s1",TODAY,"callin","14:00","18:00"); S.viewAs="admin"; var nbA=ciSave("s1",TODAY,"callin","14:00","18:00");
        state({status:"draft"}); S.viewAs="s1"; var dr=ciSave("s1",TODAY,"callin","14:00","18:00"); S.viewAs="admin"; var drA=ciSave("s1",TODAY,"callin","14:00","18:00");
        return nb===false && nbA===true && dr===false && drA===true; })());
      T("call-ins: safe hours in Block mode stop a consultant and only warn an admin, and Warn mode saves with the warning", (function(){
        state({assign:{},fatigue:{mode:"block",minRest:14,maxConsec:0}}); c.assign["s3|"+YEST]={kind:"clinical",period:"PM",zone:"z1"};
        S.viewAs="s3"; var blocked=ciSave("s3",TODAY,"callin","10:00","14:00");
        S.viewAs="admin"; said.length=0; var adm=ciSave("s3",TODAY,"callin","10:00","14:00"), warned=said.some(function(m){ return /Only 12h rest/.test(m); });
        ciRemove("s3",TODAY,"callin"); c.settings.fatigue.mode="warn"; S.viewAs="s3"; said.length=0; var warn=ciSave("s3",TODAY,"callin","10:00","14:00");
        return blocked===false && adm===true && warned && warn===true && said.some(function(m){ return /Only 12h rest/.test(m); }); })());
      T("call-ins: a consultant removes their own on the day or the day after; after that only an admin can", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(OLD,"callin","s1")]={start:"10:00",end:"14:00"}; c.callins[ciKey(TODAY,"callin","s2")]={start:"10:00",end:"14:00"};
        S.viewAs="s1"; var mine=ciRemove("s1",TODAY,"callin"), old=ciRemove("s1",OLD,"callin"), other=ciRemove("s2",TODAY,"callin");
        S.viewAs="admin"; var adm=ciRemove("s1",OLD,"callin");
        return mine===true && old===false && other===false && adm===true && !ciGet(c,TODAY,"callin","s1") && !ciGet(c,OLD,"callin","s1") && !!ciGet(c,TODAY,"callin","s2") &&
               S.audit.filter(function(a){ return a.action==="callin.remove"; }).length===2 &&
               S.notifications.some(function(n){ return n.to==="admin" && n.text.indexOf("Khan, Athar removed their call-in on ")===0; }) &&
               S.notifications.some(function(n){ return n.to==="s1" && n.text.indexOf("Your admin removed your call-in on ")===0; }); })());
      T("call-ins: the three new log lines have words", AUDIT_WORDS["callin.log"]==="Logged a call-in" && AUDIT_WORDS["callin.change"]==="Changed a call-in" && AUDIT_WORDS["callin.remove"]==="Removed a call-in");
''' + "\n" + MARK)
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/ci3-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `HARNESS ERROR: ReferenceError: Can't find variable: ciInRange`.

- [ ] **Step 3: Implement.** Create `$SP/ci3-app.py`:

```python
rep(r'''    return {ok:true}; },"octake-"+isoD+"-"+winId);
}
function unbookShift(sid,isoD){''',
r'''    return {ok:true}; },"octake-"+isoD+"-"+winId);
}
function ciOnTime(isoD){ return isoD===iso(new Date())||isoD===iso(addDays(new Date(),-1)); }   // a consultant logs, changes or removes a call-in on the day or the day after, by the phone's own date
function ciInRange(w,start,end){ const r0=ciMin(w.start); let r1=ciMin(w.end); if(r1<=r0)r1+=1440;
  let a=ciMin(start), b=ciMin(end); if(a<r0)a+=1440; if(b<=a)b+=1440;
  return a>=r0&&b<=r1; }   // inside the window's range with the end after the start; a range that crosses midnight takes times that do
function ciDefaults(w,isoD){ const r0=ciMin(w.start); let r1=ciMin(w.end); if(r1<=r0)r1+=1440; let st=r0;
  if(isoD===iso(new Date())){ const now=new Date(); let n=Math.floor((now.getHours()*60+now.getMinutes())/15)*15; if(n<r0)n+=1440; if(n<r1)st=n; }
  return {start:ciHM(st),end:ciHM(Math.min(st+(+w.usual||240),r1))}; }   // From is now, to the quarter hour, when logging today inside the range, otherwise the start of the range; To follows the usual length
function ciShiftClash(c,sid,isoD,s){ const d0=parseISO(isoD);
  for(const n of [-1,0,1]){ const d=iso(addDays(d0,n)), sh=(c.assign||{})[sid+"|"+d]; if(!sh||(sh.kind!=="clinical"&&sh.kind!=="cst"))continue;
    let sp=null; if(sh.kind==="clinical")sp=_shiftSpan(sid,d,sh.period,sh.zone,sh.type); else { const t=typeOf(c,sh); if(t&&t.start&&t.end)sp=ocSpan(d,t); }
    if(sp&&sp.st<s.en&&s.st<sp.en)return shiftLabel(sh)+(d===isoD?"":" on "+fmtISO(d)); }
  return ""; }   // a shift that day, or one either side that runs into it: the same hours are never paid twice
function ciRefusal(c,w,sid,isoD,start,end){ const adm=isAdmin(), who=(sid===S.viewAs?"You@U@2019re":nameOf(sid)+" is");
  if(!adm&&sid!==S.viewAs)return "You can only log your own call-in.";
  if(!rosterStaff().some(p=>p.id===sid))return nameOf(sid)+" isn@U@2019t on this cycle@U@2019s roster.";   // payroll and RosterOn only list the roster
  if(!adm){ if(w.book===false)return "Your admin logs "+w.label+".";
    if(c.status==="draft"||c.archived)return "This roster isn@U@2019t live yet.";
    if(!ciOnTime(isoD))return "A call-in is logged on the day or the day after. Ask your admin to add this one."; }
  if(getShift(sid,isoD).kind==="leave")return who+" on leave that day.";
  if(!/^\d\d:\d\d$/.test(start||"")||!/^\d\d:\d\d$/.test(end||""))return "Fill in both times.";
  if(!ciInRange(w,start,end))return "Choose hours between "+w.start+" and "+w.end+", with the end after the start.";
  const cand=ciAt(w,{start:start,end:end}), s=ocSpan(isoD,cand);
  const sh=ciShiftClash(c,sid,isoD,s); if(sh)return who+" working "+sh+" then.";
  const x=ocClash(c,sid,isoD,cand); if(x)return who+" already on call for "+x.label+" "+ocTime(x)+" then.";
  return ""; }   // every rule a call-in passes, read inside the write, so a retry after another phone's save is judged again
function ciSave(sid,isoD,winId,start,end){ const k=ciKey(isoD,winId,sid);   // log a call-in, or change its hours: one per person, per window, per day
  return commitGuarded(()=>{ const c=active(), w=ocWindow(c,winId), adm=isAdmin();
    if(!ocChosen(w))return {ok:false,reason:"That call-in window is gone."};
    const bad=ciRefusal(c,w,sid,isoD,start,end); if(bad)return {ok:false,reason:bad};
    const had=ciGet(c,isoD,winId,sid); if(had&&had.start===start&&had.end===end)return {ok:true};
    const _fv=ocFatigueCheck(sid,isoD,winId,{start:start,end:end});
    if(_fv&&effFatigue().mode==="block"&&!adm)return {ok:false,reason:"Fatigue rule: "+_fv};
    if(!c.callins)c.callins={};
    c.callins[k]={start:start,end:end};
    const hrs=start+"@U@2013"+end, day=fmtISO(isoD);
    if(had)logAudit("callin.change",nameOf(sid)+" "+isoD+" "+w.label+" "+had.start+"@U@2013"+had.end+" @U@2192 "+hrs,S.viewAs);
    else logAudit("callin.log",nameOf(sid)+" "+isoD+" "+w.label+" "+hrs,S.viewAs);
    if(adm)notify(sid,(had?"Your admin changed your call-in on "+day+" to ":"Your admin logged a call-in for you on "+day+", ")+hrs+".",null,{tab:"my",cycle:c.id});
    else notify("admin",nameOf(sid)+(had?" changed their call-in on "+day+" to ":" logged a call-in on "+day+", ")+hrs+".",null,{tab:"roster",cycle:c.id});
    if(_fv)_fatigueWarn=_fv;   // only on the way out, so a refusal never leaves a warning behind
    return {ok:true}; },"ci-"+k);
}
function ciRemove(sid,isoD,winId){ const k=ciKey(isoD,winId,sid);
  return commitGuarded(()=>{ const c=active(), w=ocWindow(c,winId), adm=isAdmin(), had=ciGet(c,isoD,winId,sid);
    if(!had)return {ok:true};
    if(!adm){ if(sid!==S.viewAs)return {ok:false,reason:"That call-in isn@U@2019t yours."};
      if(!ciOnTime(isoD))return {ok:false,reason:"A call-in can be removed on the day or the day after. Ask your admin to remove this one."}; }
    delete c.callins[k];
    const hrs=had.start+"@U@2013"+had.end, day=fmtISO(isoD);
    logAudit("callin.remove",nameOf(sid)+" "+isoD+" "+((w&&w.label)||winId)+" "+hrs,S.viewAs);
    if(adm)notify(sid,"Your admin removed your call-in on "+day+" ("+hrs+").",null,{tab:"my",cycle:c.id});
    else notify("admin",nameOf(sid)+" removed their call-in on "+day+" ("+hrs+").",null,{tab:"roster",cycle:c.id});
    return {ok:true}; },"ci-"+k);
}
function unbookShift(sid,isoD){''')
rep(r'''function ocFatigueCheck(sid,isoD,winId){ const f=effFatigue(); if(f.mode==="off")return null;''', r'''function ocFatigueCheck(sid,isoD,winId,times){ const f=effFatigue(); if(f.mode==="off")return null;   // times: a call-in's own hours''')
rep(r'''return _restCheck(f,sid,isoD,ocSpan(isoD,w),{win:winId}); }''', r'''return _restCheck(f,sid,isoD,ocSpan(isoD,times?ciAt(w,times):w),{win:winId}); }''')
rep(r'''"oncall.clear":"Came off on call",''', r'''"oncall.clear":"Came off on call","callin.log":"Logged a call-in","callin.change":"Changed a call-in","callin.remove":"Removed a call-in",''')
```

- [ ] **Step 4: Apply it and run the tests to see them pass.**

```bash
python3 $SP/rep.py app.html $SP/ci3-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 4`, no `FAIL` or `ERROR`. `PASS  audit: every logged action has a plain-word sentence` must be among the lints.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js deploy/demo.html
git commit -m "Call-ins 3/7: logging, changing and removing a call-in. A consultant logs their own on the day or the day after; an admin logs anyone's on any day. Refused for everyone outside the window's range, over the person's own shift (a night shift from the day before included), over their on-call or another call-in, on a leave day, or off the cycle's roster; refused to a consultant on a window only the admin logs, on a draft, and when safe hours block. Logging again changes the one call-in. The admins hear of every call-in a consultant logs, changes or removes, and a consultant hears when an admin does it for them

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Two phones logging at once both keep theirs

**Files:**
- Modify: `app.html` (`mergeOnto`)
- Test: `tests/suite.js`

**Interfaces:**
- Consumes: existing `_mergeKeyMap(mine,theirs,base,shared)`, `mergeOnto(theirs)`, the global `_remoteBase`.
- Produces: `mergeOnto` merges `cyc.callins` key by key, not in shared mode. A copy with no `callins` field has no opinion.

- [ ] **Step 1: Write the failing test.** Create `$SP/ci4-suite.py`:

```python
MARK = r'''      // ---- call-ins: later tasks add their tests above this line'''
rep(MARK, r'''      // ---- two phones
      T("call-ins: the merge keeps both phones' call-ins, key by key, and a copy that has never heard of call-ins has no opinion", (function(){
        var keepS=S, keepB=_remoteBase, k1=ciKey(TODAY,"callin","s1"), k2=ciKey(TODAY,"callin","s2"), A={start:"14:00",end:"18:00"}, B={start:"10:00",end:"14:00"}, B2={start:"11:00",end:"15:00"};
        var mk=function(ci){ var o={staff:[{id:"s1",name:"Khan, Athar"},{id:"s2",name:"Park, Min"}],staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},zones:[{id:"z1",name:"Consultant 1",am:true,pm:true}],
            leave:[],audit:[],requests:[],messages:[],notifications:[],feedback:[],openShifts:[],pushSubs:[],reqComments:[],outbox:[],
            cycles:[{id:"c1",cycle:{start:"2026-08-03",weeks:8},status:"published",archived:false,settings:{},assign:{},callins:ci}],activeId:"c1",viewAs:"admin",tab:"my"};
          if(ci===undefined)delete o.cycles[0].callins; return JSON.parse(JSON.stringify(o)); };
        var run=function(b,m,t){ _remoteBase=JSON.stringify(mk(b)); S=mk(m); var out; try{ out=mergeOnto(mk(t)); } finally { S=keepS; _remoteBase=keepB; } return out.cycles[0].callins; };
        var o=function(){ var x={}; for(var i=0;i<arguments.length;i+=2)x[arguments[i]]=arguments[i+1]; return x; };
        var both=run({},o(k1,A),o(k2,B)), cleared=run(o(k1,A),{},o(k1,A)), theirs=run(o(k2,B),o(k2,B),o(k2,B2)), silent=run(o(k1,A),o(k1,A,k2,B),undefined), mine=run(o(k2,B),o(k2,B2),o(k2,B));
        return !!both && both[k1].start==="14:00" && both[k2].start==="10:00" &&
               !!cleared && cleared[k1]===undefined && theirs[k2].start==="11:00" &&
               !!silent && silent[k1].start==="14:00" && silent[k2].start==="10:00" && mine[k2].start==="11:00"; })());
''' + "\n" + MARK)
```

- [ ] **Step 2: Apply it and run the tests to see it fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/ci4-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `FAIL  call-ins: the merge keeps both phones' call-ins, key by key, …`. Today the whole field goes to whichever side changed it, so the other phone's call-in is lost.

- [ ] **Step 3: Implement.** Create `$SP/ci4-app.py`:

```python
rep(r'''if(f==="assign"||f==="oncall")return;''', r'''if(f==="assign"||f==="oncall"||f==="callins")return;''')
rep(r'''if(Object.keys(om).length)oc.oncall=om; else if("oncall" in oc)oc.oncall=om; }''',
r'''if(Object.keys(om).length)oc.oncall=om; else if("oncall" in oc)oc.oncall=om; }
      if(("callins" in oc)||("callins" in tc)||(bc&&("callins" in bc))){   // call-ins merge key by key like shifts: each key is one person's, so two phones logging at once both keep theirs
        const cm=_mergeKeyMap(oc.callins,("callins" in tc)?tc.callins:(bc&&bc.callins),bc&&bc.callins);   // a copy that has never heard of call-ins has no opinion about them
        if(Object.keys(cm).length)oc.callins=cm; else if("callins" in oc)oc.callins=cm; }''')
```

- [ ] **Step 4: Apply it and run the tests to see them pass.**

```bash
python3 $SP/rep.py app.html $SP/ci4-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 2`, no `FAIL` or `ERROR`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js deploy/demo.html
git commit -m "Call-ins 4/7: two phones logging call-ins at the same moment both keep theirs. The merge reads cyc.callins key by key, as it reads shifts, instead of letting whichever side changed the field replace it, and a copy of the app that has never heard of call-ins has no opinion about them

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The screens: the day sheet and the cell dialog

**Files:**
- Modify: `app.html` (state and resets, `ocSheetHTML`, new `ciSheetRows` and `ciModalRowHTML`, `renderModal` markup and wiring, the Book shifts block of `wire()`)
- Modify: `tests/run.py` (the tab wiring lint also checks `ciSheetRows`)
- Test: `tests/suite.js`

**Interfaces:**
- Consumes: `ciSave`, `ciRemove`, `ciDefaults` (Task 3); `ciOnDay`, `ciGet`, `ciParse`, `ocWhenText` (Tasks 1 and 2).
- Produces:
  - Device-only state `_ciForm = {k, start, end} | null`, cleared whenever the day sheet or the cell dialog opens or closes.
  - `ciSheetRows(cyc,sid,isoD,adm) → html`.
  - `ciModalRowHTML(cyc,sid,isoD,w) → html`.
  - `ciTimesHTML(w) → html`: the From and To boxes of the open form, shared by both surfaces.
  - `ciOpenForm(k) → boolean`: opens the form for a key, on its own hours or the defaults.
  - `ciSaveForm(k,start,end) → boolean`: keeps what was typed, then saves through `ciSave`; true only when saved.
  - Day sheet controls `data-ciopen`, `data-cisave`, `data-cicancel` and `data-cidel`, wired in the `selfroster` block.
  - Cell dialog controls `data-mciopen`, `data-mcisave`, `data-mcicancel` and `data-mcidel`, wired in `renderModal`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/ci5-suite.py`:

```python
MARK = r'''      // ---- call-ins: later tasks add their tests above this line'''
rep(MARK, r'''      // ---- the screens
      state({callins:{}}); c.callins[ciKey(TODAY,"callin","s2")]={start:"10:00",end:"14:00"};
      T("call-ins: today a consultant's day sheet offers I was called in, lists who else was called in, and reads the window in words", (function(){
        S.viewAs="s1"; var h=daySheetHTML(TODAY);
        return h.indexOf('data-ciopen="'+TODAY+'|callin|s1">I was called in</button>')>0 && h.indexOf("Park 10:00–14:00")>0 && h.indexOf("any hours 10:00–22:00, usually 4h")>0; })());
      T("call-ins: tomorrow a consultant sees no button, and an admin can add one on any day", (function(){
        S.viewAs="s1"; var s=daySheetHTML(TOMO); S.viewAs="admin"; _srSid="s1"; var a=daySheetHTML(TOMO); _srSid=null;
        return s.indexOf('data-ciopen="'+TOMO+'|callin|s1"')<0 && s.indexOf("logged on the day you’re called in")>0 && a.indexOf('data-ciopen="'+TOMO+'|callin|s1"')>0; })());
      T("call-ins: a logged call-in shows its hours with Change and Remove, and the open form shows the times and Save", (function(){
        c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; S.viewAs="s1"; var h=daySheetHTML(TODAY);
        _ciForm={k:ciKey(TODAY,"callin","s1"),start:"14:00",end:"18:00"}; var f=daySheetHTML(TODAY); _ciForm=null; delete c.callins[ciKey(TODAY,"callin","s1")];
        return h.indexOf('<span class="tag oc">Called in 14:00–18:00</span>')>0 && h.indexOf('data-ciopen="'+TODAY+'|callin|s1">Change</button>')>0 && h.indexOf('data-cidel="'+TODAY+'|callin|s1">Remove</button>')>0 &&
               f.indexOf('class="ci-from" value="14:00"')>0 && f.indexOf('data-cisave="'+TODAY+'|callin|s1">Save</button>')>0; })());
      T("call-ins: the day sheet's buttons open the form, keep what was typed when refused, save, and remove after asking", (function(){
        S.viewAs="s1"; S.tab="selfroster"; var qsa=document.querySelectorAll, qs=document.querySelector, key=ciKey(YEST,"callin","s1");
        var F={value:""}, TO={value:""}, bo={dataset:{ciopen:key}}, bs={dataset:{cisave:key}}, bd={dataset:{cidel:key}}, opened=false, kept=false, saved=false, removed=false;
        document.querySelectorAll=function(sel){ return sel==="[data-ciopen]"?[bo]:(sel==="[data-cisave]"?[bs]:(sel==="[data-cidel]"?[bd]:[])); };
        document.querySelector=function(sel){ return sel==="#sheetRoot .ci-from"?F:(sel==="#sheetRoot .ci-to"?TO:null); };
        try{
          render(); bo.onclick(); opened=!!_ciForm && _ciForm.k===key && _ciForm.start==="10:00" && _ciForm.end==="14:00";
          F.value="09:00"; TO.value="11:00"; bs.onclick(); kept=!!_ciForm && _ciForm.start==="09:00" && !ciGet(c,YEST,"callin","s1");
          F.value="11:00"; TO.value="15:00"; bs.onclick(); saved=_ciForm===null && !!ciGet(c,YEST,"callin","s1") && ciGet(c,YEST,"callin","s1").start==="11:00";
          openConfirm=function(){ return {then:function(cb){ cb(true); }}; }; render(); bd.onclick(); removed=!ciGet(c,YEST,"callin","s1");
        } finally { document.querySelectorAll=qsa; document.querySelector=qs; openConfirm=keep.oc; _ciForm=null; }
        return opened && kept && saved && removed; })());
      T("call-ins: the cell dialog lists call-in windows apart from the on-call buttons, with Add, Change and Remove", (function(){
        S.viewAs="admin"; var root=document.getElementById("modalRoot"), q0=root.querySelector; root.querySelector=function(){ return {}; };
        var a="", b="";
        try{ openCell("s1",TODAY); a=root.innerHTML; c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; renderModal(); b=root.innerHTML; }
        finally { root.querySelector=q0; root.innerHTML=""; delete c.callins[ciKey(TODAY,"callin","s1")]; _ciForm=null; }
        return a.indexOf("<b>Call-ins</b>")>0 && a.indexOf('data-mciopen="'+TODAY+'|callin|s1">Add a call-in</button>')>0 && a.indexOf('data-ocset="night"')>0 &&
               b.indexOf('<span class="tag oc">Called in 14:00–18:00</span>')>0 && b.indexOf('data-mcidel="'+TODAY+'|callin|s1">Remove</button>')>0; })());
      T("call-ins: in the cell dialog an admin opens the form, saves the times and removes a call-in, on any day", (function(){
        S.viewAs="admin"; var root=document.getElementById("modalRoot"), q0=root.querySelector, qa0=root.querySelectorAll, key=ciKey(OLD,"callin","s2");
        var F={value:""}, TO={value:""}, bo={dataset:{mciopen:key}}, bs={dataset:{mcisave:key}}, bd={dataset:{mcidel:key}}, opened=false, saved=false, removed=false;
        root.querySelector=function(q){ return q===".ci-from"?F:(q===".ci-to"?TO:{}); };
        root.querySelectorAll=function(q){ return q==="[data-mciopen]"?[bo]:(q==="[data-mcisave]"?[bs]:(q==="[data-mcidel]"?[bd]:[])); };
        try{ openCell("s2",OLD); bo.onclick(); opened=!!_ciForm && _ciForm.k===key && _ciForm.start==="10:00";
          F.value="12:00"; TO.value="16:00"; bs.onclick(); saved=_ciForm===null && !!ciGet(c,OLD,"callin","s2") && ciGet(c,OLD,"callin","s2").end==="16:00";
          bd.onclick(); removed=!ciGet(c,OLD,"callin","s2"); }
        finally { root.querySelector=q0; root.querySelectorAll=qa0; root.innerHTML=""; _ciForm=null; }
        return opened && saved && removed; })());
''' + "\n" + MARK)
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/ci5-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `FAIL` on the first three day sheet tests, then a `HARNESS ERROR` (a TypeError: the call-in buttons are not wired yet, so `onclick` is undefined).

- [ ] **Step 3: Implement.** Create `$SP/ci5-app.py`:

```python
rep(r'''let _ocCard=null;''', r'''let _ciForm=null;   // device-only: the call-in form open on the day sheet or in the cell dialog, {k:"<iso>|<windowId>|<staffId>", start, end}
let _ocCard=null;''')
rep(r'''_daySheet=isoD; _sheetPeriod=''', r'''_daySheet=isoD; _ciForm=null; _sheetPeriod=''')
rep(r'''function closeDaySheet(){ const d=_daySheet; _daySheet=null;''', r'''function closeDaySheet(){ const d=_daySheet; _daySheet=null; _ciForm=null;''')
rep(r'''modal={staffId,isoD,draft:Object.assign({},getShift(staffId,isoD))};''', r'''_ciForm=null; modal={staffId,isoD,draft:Object.assign({},getShift(staffId,isoD))};''')
rep(r'''function closeModal(){ const root=document.getElementById("modalRoot"); root.innerHTML="";''', r'''function closeModal(){ const root=document.getElementById("modalRoot"); root.innerHTML=""; _ciForm=null;''')
# the day sheet
rep(r'''const ws=ocTakenWindows(cyc).filter(w=>!ocChosen(w)); if(!ws.length)return "";''', r'''const ws=ocTakenWindows(cyc).filter(w=>!ocChosen(w)), ci=ciSheetRows(cyc,sid,isoD,adm); if(!ws.length&&!ci)return "";''')
rep(r'''return `<div class="sub" style="margin-top:14px"><b>On call</b> @U@00b7 carrying a window isn@U@2019t a shift: it takes no zone and counts as nobody@U@2019s cover, so you can hold one on a day you also work.</div><div class="daylist">${rows}</div>`; }''',
r'''return `<div class="sub" style="margin-top:14px"><b>On call</b> @U@00b7 ${ws.length?"carrying a window isn@U@2019t a shift: it takes no zone and counts as nobody@U@2019s cover, so you can hold one on a day you also work.":"a call-in is logged once you@U@2019ve been called in, with the hours you worked. It takes no zone and isn@U@2019t counted as cover."}</div><div class="daylist">${rows}${ci}</div>`; }''')
rep(r'''function receiptText(r){''', r'''function ciTimesHTML(w){ return `<input type="time" class="ci-from" value="${escapeHTML(_ciForm.start)}" aria-label="${escapeHTML(w.label)}: called in from"> <span class="muted small">to</span> <input type="time" class="ci-to" value="${escapeHTML(_ciForm.end)}" aria-label="${escapeHTML(w.label)}: until">`; }   // the From and To boxes of the open call-in form, shared by the day sheet and the cell dialog
function ciOpenForm(k){ const p=ciParse(k), c=active(), w=p&&ocWindow(c,p.win); if(!w)return false;
  const ci=ciGet(c,p.d,p.win,p.sid); _ciForm=Object.assign({k:k},ci?{start:ci.start,end:ci.end}:ciDefaults(w,p.d)); return true; }   // opens the form on a call-in's own hours, or on the defaults for a new one
function ciSaveForm(k,start,end){ const p=ciParse(k); if(!p)return false;
  if(_ciForm&&_ciForm.k===k){ _ciForm.start=start; _ciForm.end=end; }   // a refused save keeps what was typed
  if(!ciSave(p.sid,p.d,p.win,start,end))return false; _ciForm=null; return true; }
function ciSheetRows(cyc,sid,isoD,adm){   // the day sheet's call-in rows: log one once called in, change or remove it, and see who else was called in that day
  const cw=ocTakenWindows(cyc).filter(ocChosen); if(!cw.length)return "";
  const day=ciOnTime(isoD), live=cyc.status!=="draft"&&!cyc.archived, onLeave=getShift(sid,isoD).kind==="leave", all=ciOnDay(cyc,isoD);
  return cw.map(w=>{ const k=ciKey(isoD,w.id,sid), mine=ciGet(cyc,isoD,w.id,sid), may=adm||(w.book!==false&&live&&day&&sid===S.viewAs), form=!!(_ciForm&&_ciForm.k===k&&may);
    const others=all.filter(x=>x.w.id===w.id&&x.sid!==sid).map(x=>escapeHTML(shortNm(S.staff.find(p=>p.id===x.sid)||{name:"Someone"}))+" "+ocTime(x.w)).join(" @U@00b7 ");
    let ctl;
    if(form)ctl=ciTimesHTML(w)+`<button class="btn primary" data-cisave="${k}">Save</button><button class="btn" data-cicancel="${k}">Cancel</button>`;
    else if(mine)ctl=`<span class="tag oc">Called in ${ocTime(mine)}</span>${may?`<button class="btn" data-ciopen="${k}">Change</button><button class="btn" data-cidel="${k}">Remove</button>`:""}`;
    else if(onLeave)ctl=`<span class="muted small">on leave that day</span>`;
    else ctl=may?`<button class="btn" data-ciopen="${k}">I was called in</button>`:`<span class="muted small">${live?"logged on the day you@U@2019re called in":"not open yet"}</span>`;
    return `<div class="listrow"><span class="grow"><b>${escapeHTML(w.label)}</b> <span class="muted small">${escapeHTML(ocWhenText(w))}</span>${others?`<div class="muted small">${others}</div>`:""}</span>${ctl}</div>`; }).join(""); }
function ciModalRowHTML(cyc,sid,isoD,w){   // the cell dialog's call-in row: an admin adds, changes or removes one for anyone, on any day
  const k=ciKey(isoD,w.id,sid), ci=ciGet(cyc,isoD,w.id,sid), form=!!(_ciForm&&_ciForm.k===k);
  const ctl=form?ciTimesHTML(w)+`<button class="btn primary sm" data-mcisave="${k}">Save</button><button class="btn sm" data-mcicancel="${k}">Cancel</button>`
    :(ci?`<span class="tag oc">Called in ${ocTime(ci)}</span><button class="btn sm" data-mciopen="${k}">Change</button><button class="btn sm" data-mcidel="${k}">Remove</button>`:`<button class="btn sm" data-mciopen="${k}">Add a call-in</button>`);
  return `<div class="listrow"><span class="grow"><b>${escapeHTML(w.label)}</b> <span class="muted small">${escapeHTML(ocWhenText(w))}</span></span>${ctl}</div>`; }
function receiptText(r){''')
# the cell dialog
rep(r'''${needsComment()?`<label class="field" style="margin-top:10px">''', r'''${ocTakenWindows(_cy).filter(ocChosen).length?`<div class="sub" style="margin-top:12px"><b>Call-ins</b> <span class="muted small">@U@00b7 saved on their own, separately from the shift above</span></div>${ocTakenWindows(_cy).filter(ocChosen).map(w=>ciModalRowHTML(_cy,modal.staffId,modal.isoD,w)).join("")}`:""}
    ${needsComment()?`<label class="field" style="margin-top:10px">''')
# wiring: the day sheet, in the Book shifts block
rep(r'''      if(ocClear(_srSid||S.viewAs,a[0],a[1]))render(); });''', r'''      if(ocClear(_srSid||S.viewAs,a[0],a[1]))render(); });
    document.querySelectorAll("[data-ciopen]").forEach(b=>b.onclick=()=>{ if(ciOpenForm(b.dataset.ciopen))render(); });
    document.querySelectorAll("[data-cicancel]").forEach(b=>b.onclick=()=>{ _ciForm=null; render(); });
    document.querySelectorAll("[data-cisave]").forEach(b=>b.onclick=()=>{ const f=document.querySelector("#sheetRoot .ci-from"), t=document.querySelector("#sheetRoot .ci-to"); if(ciSaveForm(b.dataset.cisave,f?f.value:"",t?t.value:""))render(); });
    document.querySelectorAll("[data-cidel]").forEach(b=>b.onclick=()=>{ const p=ciParse(b.dataset.cidel), ci=p&&ciGet(active(),p.d,p.win,p.sid); if(!ci)return;
      openConfirm({title:"Remove this call-in?",body:"Called in "+ocTime(ci)+" on "+fmtISO(p.d)+". It comes off pay and the counts.",ok:"Remove",danger:true}).then(yes=>{ if(yes&&ciRemove(p.sid,p.d,p.win))render(); }); });''')
# wiring: the cell dialog
rep(r'''_refocus='[data-ocset="'+w+'"]'; renderModal(); });''', r'''_refocus='[data-ocset="'+w+'"]'; renderModal(); });
  root.querySelectorAll("[data-mciopen]").forEach(b=>b.onclick=()=>{ if(ciOpenForm(b.dataset.mciopen)){ _refocus=".ci-from"; renderModal(); } });
  root.querySelectorAll("[data-mcicancel]").forEach(b=>b.onclick=()=>{ _ciForm=null; renderModal(); });
  root.querySelectorAll("[data-mcisave]").forEach(b=>b.onclick=()=>{ const f=root.querySelector(".ci-from"), t=root.querySelector(".ci-to"); ciSaveForm(b.dataset.mcisave,f?f.value:"",t?t.value:""); renderModal(); });
  root.querySelectorAll("[data-mcidel]").forEach(b=>b.onclick=()=>{ const p=ciParse(b.dataset.mcidel); if(!p)return; ciRemove(p.sid,p.d,p.win); renderModal(); });''')
```

Create `$SP/ci5-run.py`:

```python
rep(r'''for fn, tab in (("daySheetHTML", "selfroster"), ("ocSheetHTML", "selfroster"), ("dayRowHTML", "selfroster")):''',
    r'''for fn, tab in (("daySheetHTML", "selfroster"), ("ocSheetHTML", "selfroster"), ("ciSheetRows", "selfroster"), ("dayRowHTML", "selfroster")):''')
```

- [ ] **Step 4: Apply both and run the tests to see them pass.**

```bash
python3 $SP/rep.py app.html $SP/ci5-app.py
python3 $SP/rep.py tests/run.py $SP/ci5-run.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 11` then `replacements: 1`, no `FAIL` or `ERROR`, and `PASS  wiring: a tab's own controls are wired in its own block`.

Then prove the lint now guards the new buttons, by unwiring one and putting it back:

```bash
cp app.html $SP/app.bak
python3 - <<'PYEOF'
import pathlib
p = pathlib.Path("app.html"); t = p.read_text(encoding="utf-8")
i = t.index('document.querySelectorAll("[data-cidel]")'); j = t.index("\n", t.index("}); });", i))
p.write_text(t[:i] + t[j:], encoding="utf-8")
PYEOF
python3 tests/run.py 2>&1 | grep "wiring"
cp $SP/app.bak app.html
python3 tests/run.py 2>&1 | grep -E "wiring|passed"
```

Expected: first `FAIL  wiring: controls rendered on a tab but wired elsewhere (1): data-cidel is drawn by ciSheetRows but wired outside the selfroster block`, then, after the restore, `PASS  wiring: …` and `… passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js tests/run.py deploy/demo.html
git commit -m "Call-ins 5/7: logging a call-in on the day sheet and in the cell dialog. Today and yesterday a consultant's day sheet offers I was called in, with From and To filled in from now and the usual length, then Change and Remove; other consultants called in that day are listed. An admin adds, changes or removes anyone's from the day sheet or the roster cell, on any day. A refused save keeps what was typed. The wiring lint now also reads the call-in rows, so their buttons cannot be drawn without being wired

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Clear the roster clears call-ins on a draft and keeps them on a live roster

**Files:**
- Modify: `app.html` (`rosterClearPlan`, `rosterClearWords`, new `rosterClearBody`, `clearRoster`, the `adClear` handler in `wire()`)
- Test: `tests/suite.js`

**Interfaces:**
- Consumes: `ciParse` (Task 1).
- Produces:
  - `rosterClearPlan(cyc)` returns two more fields: `callins` (keys to remove; on a draft only) and `keptCallins` (a count; on a live roster only).
  - `rosterClearBody(p) → string`: the confirmation text, now shared by the button and the tests.

- [ ] **Step 1: Write the failing tests.** Create `$SP/ci6-suite.py`:

```python
MARK = r'''      // ---- call-ins: later tasks add their tests above this line'''
rep(MARK, r'''      // ---- clearing the roster
      T("call-ins: clearing a draft removes the call-ins on its dates and counts them in the question and the log", (function(){
        state({status:"draft",callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(YEST,"callin","s2")]={start:"10:00",end:"14:00"};
        var body=rosterClearBody(rosterClearPlan(c)), p=clearRoster();
        return Object.keys(c.callins).length===0 && p.callins.length===2 && / and 2 call-ins\.$/.test(body.slice(0,body.indexOf(".")+1)) &&
               S.audit[0].action==="roster.clear" && S.audit[0].detail.indexOf("2 call-ins")>0; })());
      T("call-ins: clearing a live roster keeps call-ins, like leave, and the question and the log say so", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"};
        var body=rosterClearBody(rosterClearPlan(c)), p=clearRoster();
        return Object.keys(c.callins).length===1 && p.keptCallins===1 && body.indexOf("Call-ins stay too: they record hours already worked.")>0 && /call-ins kept/.test(S.audit[0].detail); })());
''' + "\n" + MARK)
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/ci6-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `HARNESS ERROR: ReferenceError: Can't find variable: rosterClearBody`.

- [ ] **Step 3: Implement.** Create `$SP/ci6-app.py`:

```python
rep(r'''  const offers=(S.openShifts||[]).filter(o=>o.cycleId===c.id&&(o.status==="open"||o.status==="pending"));
  return {c:c,draft:draft,from:from,to:to,shifts:shifts,cellLeave:cellLeave,oncall:oncall,leave:leave,offers:offers}; }''',
r'''  const offers=(S.openShifts||[]).filter(o=>o.cycleId===c.id&&(o.status==="open"||o.status==="pending"));
  const ciAll=Object.keys(c.callins||{}).filter(k=>{ const p=ciParse(k); return !!p&&p.d>=from&&p.d<=to; });   // call-ins are hours already worked: a draft clears them, a live roster keeps them, like leave
  return {c:c,draft:draft,from:from,to:to,shifts:shifts,cellLeave:cellLeave,oncall:oncall,leave:leave,offers:offers,callins:draft?ciAll:[],keptCallins:draft?0:ciAll.length}; }''')
rep(r'''.concat(p.offers.length?[n(p.offers.length,"open shift","open shifts")]:[]); }''', r'''.concat(p.offers.length?[n(p.offers.length,"open shift","open shifts")]:[]).concat(p.callins&&p.callins.length?[n(p.callins.length,"call-in","call-ins")]:[]); }
function rosterClearBody(p){ const w=rosterClearWords(p);   // the question Clear the roster asks, in numbers
  return "Removes "+w.slice(0,-1).join(", ")+(w.length>1?" and ":"")+w[w.length-1]+"."+(p.draft?" Leave that runs past the cycle keeps the part outside it.":" Leave stays, because on a live roster it is people@U@2019s real leave.")+(p.keptCallins?" Call-ins stay too: they record hours already worked.":"")+" Shifts laid down by fixed patterns stay. There is no undo."; }''')
rep(r'''  if(c.oncall)p.oncall.forEach(k=>{ delete c.oncall[k]; });''', r'''  if(c.oncall)p.oncall.forEach(k=>{ delete c.oncall[k]; });
  if(c.callins)p.callins.forEach(k=>{ delete c.callins[k]; });''')
rep(r'''(p.draft?"":" @U@00b7 leave kept, the roster is live")+" @U@00b7 "+cyLabel(c),"admin");''', r'''(p.draft?"":" @U@00b7 leave kept, the roster is live")+(p.keptCallins?" @U@00b7 call-ins kept":"")+" @U@00b7 "+cyLabel(c),"admin");''')
rep(r'''const p=rosterClearPlan(active()), w=rosterClearWords(p);
      openConfirm({title:"Clear the roster for "+cyLabel(active())+"?",body:"Removes "+w.slice(0,-1).join(", ")+(w.length>1?" and ":"")+w[w.length-1]+"."+(p.draft?" Leave that runs past the cycle keeps the part outside it.":" Leave stays, because on a live roster it is people@U@2019s real leave.")+" Shifts laid down by fixed patterns stay. There is no undo.",ok:''',
r'''const p=rosterClearPlan(active());
      openConfirm({title:"Clear the roster for "+cyLabel(active())+"?",body:rosterClearBody(p),ok:''')
```

- [ ] **Step 4: Apply it and run the tests to see them pass.**

```bash
python3 $SP/rep.py app.html $SP/ci6-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 5`, no `FAIL` or `ERROR`. The older clear tests (`clear: on a draft every shift…`, `clear: the button asks first, in numbers…`) must still pass unchanged.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js deploy/demo.html
git commit -m "Call-ins 6/7: Clear the roster removes call-ins from a draft and keeps them on a live roster, as it treats leave, because a call-in records hours already worked. The question it asks and the log line both say so, and the question is now one function the button and the tests share

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Release: prove the guards, check it in the browser, and ship

**Files:**
- Modify: `CHANGELOG.md`, `app.html` (`BUILD`), `deploy/app.html`, `preview.html`, `deploy/demo.html`, `docs/superpowers/specs/2026-09-14-oncall-call-ins-design.md`

- [ ] **Step 1: Prove every guard is tested.** Create `$SP/ci-mutate.py`. Each mutation breaks one rule in a copy of `app.html`; the suite must fail on every copy.

```python
import pathlib, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor
BS = chr(92)
root = pathlib.Path("/Users/ranjithkandavelu/Desktop/Claude/Myrosta")
html = (root / "app.html").read_text(encoding="utf-8")
MUTS = [
  ("staff day limit", r'''if(!ciOnTime(isoD))return "A call-in is logged''', r'''if(false)return "A call-in is logged'''),
  ("range", r'''if(!ciInRange(w,start,end))return''', r'''if(false)return'''),
  ("own shift", r'''const sh=ciShiftClash(c,sid,isoD,s); if(sh)return''', r'''const sh=""; if(sh)return'''),
  ("own on-call", r'''const x=ocClash(c,sid,isoD,cand); if(x)return''', r'''const x=null; if(x)return'''),
  ("leave", r'''if(getShift(sid,isoD).kind==="leave")return who+" on leave that day.";''', r''''''),
  ("roster", r'''if(!rosterStaff().some(p=>p.id===sid))return nameOf(sid)''', r'''if(false)return nameOf(sid)'''),
  ("own only", r'''if(!adm&&sid!==S.viewAs)return "You can only log your own call-in.";''', r''''''),
  ("admin-only window", r'''if(w.book===false)return "Your admin logs "+w.label+".";''', r''''''),
  ("draft", r'''if(c.status==="draft"||c.archived)return "This roster isn@U@2019t live yet.";''', r''''''),
  ("fatigue block", r'''if(_fv&&effFatigue().mode==="block"&&!adm)return {ok:false,reason:"Fatigue rule: "+_fv};''', r''''''),
  ("remove day limit", r'''if(!ciOnTime(isoD))return {ok:false,reason:"A call-in can be removed''', r'''if(false)return {ok:false,reason:"A call-in can be removed'''),
  ("merge", r'''const cm=_mergeKeyMap(oc.callins,("callins" in tc)?tc.callins:(bc&&bc.callins),bc&&bc.callins);''', r'''const cm=oc.callins||{};'''),
  ("readers", r'''if(ci)ws=ws.concat([ciAt(w,ci)]);''', r''''''),
  ("calendar", r'''ocHeldBy(_cyI,sid,iso(d),_ocW).filter(w=>!w.ci).forEach(''', r'''ocHeldBy(_cyI,sid,iso(d),_ocW).forEach('''),
  ("leave writer", r'''ocTakenBy(c,r.from,d).filter(w=>!w.ci).forEach(''', r'''ocTakenBy(c,r.from,d).forEach('''),
  ("fairness", r'''(rows[p.sid]=rows[p.sid]||blank()).oc++;''', r''''''),
  ("clear draft", r'''if(c.callins)p.callins.forEach(k=>{ delete c.callins[k]; });''', r''''''),
  ("switch guard", r'''const n=was.chosen?ciInUse(c,w.id):ocInUse(c,w.id);''', r'''const n=0;'''),
  ("remove guard", r'''const logged=ciInUse(c,id); if(logged){''', r'''const logged=0; if(logged){'''),
  ("holder", r'''if(ocChosen(w))return null;   // a call-in window has no one holder''', r'''if(false)return null;   // a call-in window has no one holder'''),
  ("night", r'''const d0=(w&&w.night)?addDays(parseISO(isoD),1):parseISO(isoD);''', r'''const d0=parseISO(isoD);'''),
  ("sheet day limit", r'''may=adm||(w.book!==false&&live&&day&&sid===S.viewAs)''', r'''may=adm||(w.book!==false&&live&&sid===S.viewAs)'''),
  ("people leaving", r'''ciDropFor(c,[id]); }''', r''' }'''),
]
def run(m):
    name, old, new = m; old = old.replace("@U@", BS + "u"); new = new.replace("@U@", BS + "u")
    if html.count(old) != 1: return name, "NOT APPLIED (found %d)" % html.count(old)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html.replace(old, new)); p = f.name
    r = subprocess.run(["python3", str(root / "tests" / "run.py"), p], capture_output=True, text=True)
    pathlib.Path(p).unlink()
    return name, ("KILLED" if r.returncode else "SURVIVED")
with ThreadPoolExecutor(3) as ex:
    for name, res in ex.map(run, MUTS): print(res.ljust(24), name)
```

```bash
python3 $SP/ci-mutate.py
```

Expected: every line reads `KILLED`. A `SURVIVED` line means a rule with no test: write the test that kills it, commit it on its own, and run the mutations again. A `NOT APPLIED` line means the code differs from the plan: read the spot, correct the mutation's old text, and run again.

- [ ] **Step 2: Write the changelog entry and set the build date.** Use the release day's date, written the way the existing headings are, in both places. For a release on 15 Sep 2026, `app.html` changes from `const BUILD="2026-09-14";` to `const BUILD="2026-09-15";`, and `CHANGELOG.md` gains this section directly under `# Myrosta — changelog` (replace `N` and `M` with the real pass count and the number of mutations killed):

```markdown
## 15 Sep 2026 — Call-ins: on-call booked with its real hours

- **An on-call window's hours can be chosen when booked.** Settings → This cycle → On-call: each window is **Fixed hours**, as before, or **Chosen when booked**, with a range and a usual length. Built for SWIFT, whose own sheet reads "Casual shift · C · any 4 hours on call": a consultant logs a call-in once they have been called in, with the hours they really worked, and several can be called in on the same day.
- **Logging one.** On today's or yesterday's day sheet: **I was called in**, check From and To, Save. The consultant can change or remove it until the end of the next day. After that, and for anyone at any time, an admin adds, changes or removes it from the day sheet or the roster cell. The admins are told about every call-in a consultant logs, changes or removes.
- **It is refused** outside the window's range, over the person's own shift or on-call, on a leave day, for someone off the cycle's roster, and when safe hours are set to block.
- **It reaches everything on-call reaches, with the real hours:** the day board, the roster, Book shifts, the week strip and shared week, the On call count on My shifts, Fairness, the payroll file, the RosterOn workbook and the roster exports. It is left out of calendars and reminders, because it is logged after the fact, so neither Edge Function changes.
- Two phones logging at once both keep theirs. Leave approved later keeps a call-in, because it is hours already worked. Clear the roster removes call-ins from a draft and keeps them on a live roster. N passes, M mutations, all killed.
```

- [ ] **Step 3: Sync the deployed copies and rebuild the demo.**

```bash
python3 - <<'PYEOF'
import pathlib, re
root = pathlib.Path("/Users/ranjithkandavelu/Desktop/Claude/Myrosta")
app = (root / "app.html").read_text(encoding="utf-8")
(root / "deploy" / "app.html").write_text(app, encoding="utf-8")
m = re.search(r'const CLOUD=\{ url:"[^"]*", key:"[^"]*",', app); assert m
(root / "preview.html").write_text(app.replace(m.group(0), 'const CLOUD={ url:"", key:"",', 1), encoding="utf-8")
print("synced deploy/app.html and preview.html")
PYEOF
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
python3 tests/run.py deploy/app.html 2>&1 | tail -1
```

Expected: `synced deploy/app.html and preview.html`, then `… passed, 0 failed` for both `app.html` and `deploy/app.html`, including `PASS  build: BUILD and What's new match the changelog's latest heading`.

- [ ] **Step 4: Check it in the browser.** Start the `landing` preview (it serves `deploy/`) and open `http://localhost:8899/demo.html`. As the admin:
  1. Settings → This cycle → On-call. Add a window, set **Chosen when booked** from 10:00 to 22:00, usually 4 hours, and Save. The row shows the range and usual length, and no zone boxes.
  2. Open a person's cell for today on the roster grid, then **Add a call-in**, 14:00–18:00, Save. The dialog reads "Called in 14:00–18:00".
  3. The day board for today lists that person under On call with "Called in 14:00–18:00".
  4. View as that person, then Book shifts → today → **I was called in**. From and To are filled in; Change and Remove work.
  5. Read the browser console: no errors.

  Take a screenshot of the day sheet with the form open, and one of the day board.

- [ ] **Step 5: Record what was built** by appending to `docs/superpowers/specs/2026-09-14-oncall-call-ins-design.md`:

```markdown
## As built, 15 Sep 2026

Plan: `docs/superpowers/plans/2026-09-15-oncall-call-ins.md`, seven commits. Decisions taken while building, each for a reason worth keeping:

- **Readers get a copy of the window with the call-in's hours** (`ciAt`, `ci:true`) from `ocTakenBy` and `ocHeldBy`, so payroll, RosterOn, the exports, counts, marks and safe hours needed no change of their own. Writers that clear on-call through those helpers (`approveRequest`, `plannerSetLeave`) skip `ci` copies, and the calendar download filters them out.
- **`night`** marks a call-in in the small hours of a range that crosses midnight; `ocSpan` starts it on the next calendar day.
- **The confirmation of Clear the roster is one function**, `rosterClearBody`, shared by the button and the tests.
- **The tab wiring lint also reads `ciSheetRows`**, so a call-in button cannot be drawn on the day sheet without being wired.
- **`ciDropFor`** is called on all three paths that take someone out of a cycle or the group; a test counts the calls.
- **The day sheet and the cell dialog share the form's pieces** (`ciTimesHTML`, `ciOpenForm`, `ciSaveForm`), and one predicate, `ciOnTime`, says whether a consultant may still act on a day. Each surface keeps its own literal button attributes, so the wiring lint still reads them.
```

- [ ] **Step 6: Commit the release.**

```bash
git add CHANGELOG.md app.html deploy/app.html preview.html deploy/demo.html docs/superpowers/specs/2026-09-14-oncall-call-ins-design.md
git commit -m "Call-ins 7/7: release notes and build date, the deployed copies synced, and the spec's As built section. Every guard mutation-proven. Nothing to paste into Supabase: neither Edge Function reads call-ins

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git log --oneline -8
```

Tell the owner: push `main` from GitHub Desktop. No Edge Function paste is needed. Then SWIFT's admin sets their on-call window to **Chosen when booked** (10:00 to 22:00, usually 4 hours) before invites go out, and the on-call pages of the SWIFT staff and admin guides (in `~/Desktop/Myrosta site 2/go-live/source/guides/`, outside the repo) are rewritten to match.

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| Window option Fixed or Chosen when booked; range and usual length in half hours; zone boxes hidden | 1 |
| Card rules: usual length fits; no switch while in use; no removal with call-ins; narrowing never changes logged call-ins | 1 (rules), 3 (logged call-ins keep their own hours) |
| I was called in on today's or yesterday's sheet; From and To defaults; Change and Remove; others listed; no button on other days | 3 (defaults), 5 (screens) |
| Admin adds, changes or removes from the day sheet or the cell dialog, any day | 3, 5 |
| Refusals for everyone and for consultants; checked inside the write | 3 |
| Where call-ins show: day sheet, day board, grid, Book shifts rows, week strip, shared week, My shifts, Fairness, payroll, RosterOn, Excel and CSV, safe hours, checklist | 1 (checklist), 2, 5 |
| Left out of the calendar download, the feed and reminders | 2 |
| Notifications and audit keys | 3 |
| Leave approval and the planner keep call-ins; Clear the roster draft vs live; people leaving | 2, 6 |
| Data shape and accessors; stray on-call keys on Chosen windows ignored | 1, 2 |
| Merge key by key, no opinion from copies without the field | 4 |
| Compatibility: golden file unchanged, Edge Functions untouched | every task's test run; Global Constraints |
| Docs: CHANGELOG, no What's new, guides outside the repo | 7 |
