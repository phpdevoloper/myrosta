# Swaps without naming one colleague (Ask everyone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a consultant ask everyone who could take one of their shifts for a swap, accept one of the shifts offered back, and send it to an admin as an ordinary agreed swap; put **Swap it** on the day sheet; let asking to come off work with open shifts switched off; and show the admin who is free that day.

**Architecture:** Two new top-level arrays, `S.openSwaps` (the asks) and `S.swapOffers` (the offers), merged item by item like requests. The rules are pure functions over the roster (`swOfferable`, `swWho`, `swAskWhy`, `swOfferWhy`), read every time an ask or an offer is shown and again inside each write, so nothing stale can be accepted. Accepting creates an ordinary `S.requests` swap with `peerAgreed:true` and `openId`, so the admin's card, `approveSwap` and `executeSwap` are untouched. One sweep, `swTidy()`, closes whatever a roster change no longer supports, and every path that can take a shift away calls it. Asking to come off with open shifts off reuses the open-shift record with `kind:"ask"`, which is never listed and never claimable.

**Tech Stack:** Single-file vanilla JS app (`app.html`), tests under JavaScriptCore via `osascript` (`python3 tests/run.py`), Python lints in `tests/run.py`.

**Spec:** `docs/superpowers/specs/2026-09-14-open-swaps-design.md` (read it first; this plan argues from it).

## Global Constraints

- Named swaps behave exactly as today: `submitSwapRequest`, `agreeSwap`, `approveSwap`, `executeSwap`, `declineSwap`, `withdrawRequest` and `cancelApproved` keep their behaviour, and their existing tests pass unchanged.
- The Edge Functions (`supabase/functions/*`) are not edited and nothing is pasted into Supabase. Never call the notify-shifts function. An ask reaches colleagues in the app and by phone alert only, never by text.
- `tests/oncall-golden.js` must pass unchanged and is **never regenerated** to make a test pass.
- Every write to `S.openSwaps` or `S.swapOffers` goes through `commitGuarded`, and reads the rules again inside the write.
- Every `logAudit` call passes its key as a **string literal first argument**, and every key has an `AUDIT_WORDS` sentence. New keys: `swap.ask`, `swap.ask-withdraw`, `swap.ask-close`, `swap.offer`, `swap.offer-withdraw`, `swap.accept`.
- Copy: plain words, sentence case, no emoji or arrow glyphs inside buttons, notes or tags (a lint checks this).
- Test dates are relative to today (`iso(addDays(new Date(),n))`). Never hardcode a future date.
- `deploy/demo.html` must equal what `python3 tools/build-demo.py` produces from the current `app.html` (a lint checks this), so run the build before the tests in every task. `deploy/app.html` and `preview.html` are synced in Task 6.
- SWIFT's files in `~/Desktop/Myrosta site 2/` hold personal data and never enter the repo.
- Commit on `main`; do not push (the owner pushes from GitHub Desktop).

## Decisions this plan takes where the spec is silent

1. **Both sides of a swap are clinical shifts.** Swap it sits on a clinical shift, and a non-clinical day offered back is no cover and counts nothing.
2. **A colleague with no entry in the cycle's roles is not on its roster**, exactly as `hydrateCycleRoles` already treats them.
3. **Requests shows the asks and offers of the cycle on screen**, as open shifts do. Each notification carries its cycle, so a tap switches there.
4. **The swap sheet starts on With a colleague**, today's form, and remembers the chosen shift across re-renders in `_swapMine`. That also stops picking a colleague from resetting the chosen shift, which it does today.
5. **One sweep, `swTidy()`, does every explicit close**, so no path can forget a condition. It writes nothing for a day already gone (the spec: "No write is needed"). Clear the roster closes its cycle's asks itself, with the reason "the roster was cleared". The asker is not told when their own ask closes; the spec tells whoever offered.
6. **Offers are labelled with zone, type and count** ("Fri 6 Nov · Resus Full · counts 2"), like the named-swap form, which names the zone.
7. **Accept and Withdraw on the asker's card ask for confirmation**; Send offer and withdrawing an offer do not, and Send offer and Accept end with a short toast.
8. **Free that day** shows one call button per person with a mobile on file and one line naming the rest, so a long list stays short on a phone.
9. **Help's "Swap or Open shift" answer names Ask everyone** (Task 6), because it still says a swap needs a named colleague.

## How to edit `app.html`, `tests/suite.js` and `tests/run.py`

`app.html` is one large file with very long lines, and much of its script writes characters as JavaScript escapes (a backslash, `u`, four hex digits). Tool parameters can silently turn those escapes into the characters themselves, so an exact-match edit then fails, or writes the wrong thing. Make every edit through this helper, and write each such escape as `@U@` followed by the four hex digits (`@U@2019` for a right single quote, `@U@2014` for an em dash, `@U@00b7` for a middle dot, `@U@2194` for a left-right arrow). The helper swaps `@U@` for backslash-u in both the old and the new text, and refuses to write unless each old text occurs exactly once. Some old texts below contain the characters themselves (an em dash or a middle dot), because that is how `app.html` writes them on those lines; copy them exactly.

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

An edits file is plain Python calling `rep(old, new)`; both arguments are raw triple-quoted strings. If `rep.py` stops with "expected 1, found 0", nothing was written: re-read that spot of the file and correct the old text; never loosen the count.

**If `python3` or `git` stops with "You have not agreed to the Xcode license agreements"**, the command-line tools that ship with Xcode are blocked until the owner accepts the licence. Use a Python and a git that do not need Xcode, by putting two small wrappers first on `PATH` in every shell command:

```bash
mkdir -p "$SP/bin"
ln -sf ~/.local/share/uv/python/cpython-3.12-macos-aarch64-none/bin/python3.12 "$SP/bin/python3"
printf '#!/bin/sh\nG="/Applications/GitHub Desktop.app/Contents/Resources/app/git"\nGIT_EXEC_PATH="$G/libexec/git-core" exec "$G/bin/git" "$@"\n' > "$SP/bin/git" && chmod +x "$SP/bin/git"
export PATH="$SP/bin:$PATH"
```

Run every command from the repo root, `/Users/ranjithkandavelu/Desktop/Claude/Myrosta`. The test command, used throughout:

```bash
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

The baseline before Task 1 is `793 passed, 0 failed`. A test block that calls a function or reads a variable that does not exist yet stops the whole block with `HARNESS ERROR: …` (JavaScriptCore prints only the frame, for example `HARNESS ERROR: ask@` or `HARNESS ERROR: @`); that counts as the expected failure.

## File map

| File | What changes |
|---|---|
| `app.html` | Records, merge and rules (Task 1); the writes, notifications and audit words (Task 2); Swap it, the swap sheet's two choices, the Requests cards, the admin tag and the wiring (Task 3); the tidy-up sweep and its callers (Task 4); asking to come off with open shifts off, and Free that day (Task 5); What's new and Help (Task 6) |
| `tests/suite.js` | One new self-contained block, `open swaps`, before the suite's final render; each task adds tests above its marker line |
| `tests/run.py` | The tab wiring lint also reads the new renderers (Task 3) |
| `deploy/demo.html` | Rebuilt by `tools/build-demo.py` in every task |
| `deploy/app.html`, `preview.html` | Synced in Task 6 |
| `CHANGELOG.md` | New entry (Task 6) |
| `docs/superpowers/specs/2026-09-14-open-swaps-design.md` | Status and "As built" section (Task 6) |

---

### Task 1: Records and rules

**Files:**
- Modify: `app.html` (`normalize`, `mergeOnto`'s `ID_ARRAYS`, the swap section after `let swapPeer=null;`)
- Test: `tests/suite.js` (new `open swaps` block)

**Interfaces:**
- Consumes: `leaveOn(staffId,isoD)`, `isClinical(s)`, `datesOf(cycle)`, `iso(d)`, `nameOf(id)`, `fmtISO(iso)`, `mergeOnto`/`_mergeIdArray`.
- Produces:
  - `S.openSwaps: [{id, cycleId, from, dateA, shift:{kind:"clinical", period, zone, type}, note, status:"open"|"done"|"closed", why, ts, swapId}]`
  - `S.swapOffers: [{id, openId, by, dateB, shift:{kind:"clinical", period, zone, type}, status:"open"|"accepted"|"closed"|"withdrawn", ts}]`
  - `swCycleOf(o) → cycle | null`; `swLive(cyc) → boolean` (not archived, not draft).
  - `swShiftOf(cyc,sid,isoD) → {kind:"clinical",period,zone,type} | null` (clinical only; `type` is `null` when absent).
  - `swSame(a,b) → boolean` (same period, zone and type).
  - `swFree(cyc,sid,isoD) → boolean` (no assignment of any kind, and no approved leave).
  - `swOnRoster(cyc,sid) → boolean` (in the group, clinical, with a role entry that is not `in:false`).
  - `swOfferable(o,sid) → [{d, shift}]`; `swWho(o) → [staffId]`.
  - `swAskWhy(o) → ""` or one of `"it has gone"`, `"a swap was agreed"`, `o.why` (or `"it was closed"`), `"the roster is not live"`, `"that day has passed"`, `"the shift has changed"`.
  - `swOfferWhy(f) → ""` or one of `"it has gone"`, `"it was accepted"`, `"it was withdrawn"`, `"it was closed"`, the ask's reason, `"that day has passed"`, `"the offered shift has changed"`, `"<name> is no longer on this roster"`, `"<name> is no longer free on <day>"`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/sw1-suite.py`:

```python
rep(r'''  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''', r'''  // ---- open swaps: ask everyone, colleagues offer a shift back, the asker accepts one, an admin approves.
  // Spec: docs/superpowers/specs/2026-09-14-open-swaps-design.md. Dates are relative to today, because an ask is always about a day to come.
  (function(){
    var keep={S:S,toast:toast,oc:openConfirm,sr:_srSid,rs:_reqSheet,ds:_daySheet,sp:swapPeer,fp:_osFlushPush}, c=null, said=[];
    var D=function(n){ return iso(addDays(new Date(),n)); };
    var FULL={id:"full",code:"FULL",label:"Full",start:"08:00",end:"23:00",fills:["AM","PM"],on:true,book:true,builtin:null};
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Resus",am:true,pm:true,pmLabel:""},{id:"z2",name:"Acute",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},rosterMode:"rolling",shiftTimes:{AM:{start:"08:00",end:"18:00"},PM:{start:"14:00",end:"23:00"}}};
      if(o.notice)set.noticeDays=o.notice;
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Alex",quota:20,eft:1,mobile:"0412 345 678"},{id:"s2",name:"Sam",quota:20,eft:1},{id:"s3",name:"Kim",quota:20,eft:1,mobile:"0498 765 432"},{id:"s4",name:"Jo",quota:20,eft:1}],
         cycles:[{id:"cc",cycle:{start:D(-7),weeks:6},status:o.status||"published",archived:false,settings:set,roles:{s1:{in:true},s2:{in:true},s3:{in:true},s4:{in:true}},assign:{}}],
         activeId:"cc",viewAs:o.viewAs||"s1",tab:"requests",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],marketOn:!!o.market};
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srSid=null; _reqSheet=null; _daySheet=null; swapPeer=null; }
    function put(sid,n,period,zone,type){ var v={kind:"clinical",period:period||"AM",zone:zone||"z1"}; if(type)v.type=type; c.assign[sid+"|"+D(n)]=v; return v; }
    function ask(o){ var a={id:"sw1",cycleId:"cc",from:"s1",dateA:D(3),shift:{kind:"clinical",period:"AM",zone:"z1",type:null},note:"",status:"open",why:"",ts:1,swapId:null}; for(var k in (o||{}))a[k]=o[k]; S.openSwaps.push(a); return a; }
    function offer(o){ var f={id:"so1",openId:"sw1",by:"s2",dateB:D(5),shift:{kind:"clinical",period:"PM",zone:"z2",type:null},status:"open",ts:1}; for(var k in (o||{}))f[k]=o[k]; S.swapOffers.push(f); return f; }
    toast=function(m){ said.push(String(m)); };
    try{
      // ---- records and rules
      T("open swaps: a group starts with no asks and no offers, and two colleagues offering at the same moment both keep theirs", (function(){
        state(); var fresh=Array.isArray(S.openSwaps)&&S.openSwaps.length===0&&Array.isArray(S.swapOffers)&&S.swapOffers.length===0;
        put("s1",3); ask();
        var base=JSON.parse(JSON.stringify(S)), mine=JSON.parse(JSON.stringify(S)), theirs=JSON.parse(JSON.stringify(S));
        mine.swapOffers.push({id:"soA",openId:"sw1",by:"s2",dateB:D(5),shift:{kind:"clinical",period:"PM",zone:"z2",type:null},status:"open",ts:2});
        theirs.swapOffers.push({id:"soB",openId:"sw1",by:"s3",dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z1",type:null},status:"open",ts:3});
        theirs.openSwaps.push({id:"sw2",cycleId:"cc",from:"s4",dateA:D(8),shift:{kind:"clinical",period:"AM",zone:"z1",type:null},note:"",status:"open",why:"",ts:4,swapId:null});
        var keepS=S, keepB=_remoteBase, out; _remoteBase=JSON.stringify(base); S=mine;
        try{ out=mergeOnto(theirs); } finally { S=keepS; _remoteBase=keepB; }
        return fresh && out.swapOffers.length===2 && out.swapOffers.some(function(f){ return f.id==="soA"; }) && out.swapOffers.some(function(f){ return f.id==="soB"; }) && out.openSwaps.length===2; })());
      T("open swaps: who can offer is whoever is free on the day and holds a shift on another day to come when the asker is free", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2"); put("s3",3,"PM","z2"); put("s3",6); put("s4",7); c.assign["s4|"+D(3)]={kind:"cst"};
        var o=ask(), two=swOfferable(o,"s2");
        return JSON.stringify(swWho(o))==='["s2"]' && two.length===1 && two[0].d===D(5) && swSame(two[0].shift,{kind:"clinical",period:"PM",zone:"z2",type:null}) &&
               swOfferable(o,"s3").length===0 && swOfferable(o,"s4").length===0 && swOfferable(o,"s1").length===0; })());
      T("open swaps: leave on the day, UA included, rules a colleague out, and so does a shift or leave of the asker's on the day offered", (function(){
        state(); put("s1",3); put("s2",5); put("s3",6); put("s4",8); put("s4",9);
        S.leave.push({id:"lv1",staffId:"s2",from:D(2),to:D(4),code:"AL",status:"approved"});
        c.assign["s3|"+D(3)]={kind:"leave",code:"UA"};
        put("s1",8); S.leave.push({id:"lv2",staffId:"s1",from:D(9),to:D(9),code:"AL",status:"approved"});
        var o=ask();
        return swOfferable(o,"s2").length===0 && swOfferable(o,"s3").length===0 && swOfferable(o,"s4").length===0 && swWho(o).length===0; })());
      T("open swaps: only shifts from today on can be offered, and only by people on this cycle's roster who work clinically", (function(){
        state(); put("s1",3); put("s2",-2); put("s2",0,"PM"); put("s3",5); put("s4",5,"PM","z2");
        var o=ask(), before=JSON.stringify(swWho(o)), two=swOfferable(o,"s2");
        c.roles.s3.in=false; var off=JSON.stringify(swWho(o)); c.roles.s3.in=true;
        delete c.roles.s4; var missing=JSON.stringify(swWho(o)); c.roles.s4={in:true};
        S.staff[2].mode="none"; var nonClinical=JSON.stringify(swWho(o));
        return before==='["s2","s3","s4"]' && two.length===1 && two[0].d===D(0) && off==='["s2","s4"]' && missing==='["s2","s3"]' && nonClinical==='["s2","s4"]'; })());
      T("open swaps: an ask holds only while its day is to come, its roster is live and the asker still holds the very same shift", (function(){
        state(); put("s1",3);
        var o=ask(), fresh=swAskWhy(o), s=c.assign["s1|"+D(3)];
        s.zone="z2"; var moved=swAskWhy(o); s.zone="z1";
        s.type="full"; var typed=swAskWhy(o); delete s.type;
        s.period="PM"; var half=swAskWhy(o); s.period="AM";
        c.assign["s1|"+D(3)]={kind:"cst"}; var cst=swAskWhy(o); c.assign["s1|"+D(3)]=s;
        S.leave.push({id:"lv",staffId:"s1",from:D(3),to:D(3),code:"AL",status:"approved"}); var leave=swAskWhy(o); S.leave=[];
        c.status="draft"; var draft=swAskWhy(o); c.status="published"; c.archived=true; var arch=swAskWhy(o); c.archived=false;
        var past=swAskWhy(ask({id:"sw2",dateA:D(-1)})), done=swAskWhy(ask({id:"sw3",status:"done"})), closed=swAskWhy(ask({id:"sw4",status:"closed",why:"withdrawn"}));
        return fresh==="" && moved==="the shift has changed" && typed==="the shift has changed" && half==="the shift has changed" && cst==="the shift has changed" && leave==="the shift has changed" &&
               draft==="the roster is not live" && arch==="the roster is not live" && past==="that day has passed" && done==="a swap was agreed" && closed==="withdrawn" && swAskWhy(null)==="it has gone"; })());
      T("open swaps: an offer holds only while its ask does, its day is to come, the colleague still holds that shift and both are still free", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2");
        var o=ask(), f=offer(), fresh=swOfferWhy(f);
        c.assign["s2|"+D(5)].zone="z1"; var moved=swOfferWhy(f); c.assign["s2|"+D(5)].zone="z2";
        put("s1",5); var askerBusy=swOfferWhy(f); delete c.assign["s1|"+D(5)];
        S.leave.push({id:"lv",staffId:"s1",from:D(5),to:D(5),code:"AL",status:"approved"}); var askerLeave=swOfferWhy(f); S.leave=[];
        c.assign["s2|"+D(3)]={kind:"cst"}; var peerBusy=swOfferWhy(f); delete c.assign["s2|"+D(3)];
        c.roles.s2.in=false; var gone=swOfferWhy(f); c.roles.s2.in=true;
        o.status="closed"; o.why="withdrawn"; var askClosed=swOfferWhy(f); o.status="open"; o.why="";
        f.status="withdrawn"; var wd=swOfferWhy(f); f.status="accepted"; var acc=swOfferWhy(f); f.status="closed"; var cl=swOfferWhy(f); f.status="open";
        var past=swOfferWhy(offer({id:"so2",dateB:D(-1)}));
        return fresh==="" && moved==="the offered shift has changed" && askerBusy==="Alex is no longer free on "+fmtISO(D(5)) && askerLeave==="Alex is no longer free on "+fmtISO(D(5)) &&
               peerBusy==="Sam is no longer free on "+fmtISO(D(3)) && gone==="Sam is no longer on this roster" && askClosed==="withdrawn" &&
               wd==="it was withdrawn" && acc==="it was accepted" && cl==="it was closed" && past==="that day has passed" && swOfferWhy(null)==="it has gone"; })());
      T("open swaps: preparing the next cycle carries no ask and no offer into it", (function(){
        state(); put("s1",3); put("s2",5); ask(); offer(); S.viewAs="admin"; prepareNext();
        var nc=S.cycles.find(function(x){ return x.id!=="cc"; });
        return !!nc && S.openSwaps.length===1 && S.swapOffers.length===1 && S.openSwaps[0].cycleId==="cc" && !("openSwaps" in nc) && !("swapOffers" in nc); })());

      // ---- open swaps: later tasks add their tests above this line
    } finally { S=keep.S; toast=keep.toast; openConfirm=keep.oc; _srSid=keep.sr; _reqSheet=keep.rs; _daySheet=keep.ds; swapPeer=keep.sp; _osFlushPush=keep.fp; /* open swaps: restore */ hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/sw1-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then `HARNESS ERROR: ask@` and `792 passed, 1 failed`.

- [ ] **Step 3: Implement.** Create `$SP/sw1-app.py`:

```python
# the two arrays: defaulted on load, merged item by item
rep(r'''  if(!S.openShifts)S.openShifts=[];''',
r'''  if(!S.openShifts)S.openShifts=[];
  if(!Array.isArray(S.openSwaps))S.openSwaps=[]; if(!Array.isArray(S.swapOffers))S.swapOffers=[];   // Ask everyone: the asks, and the shifts colleagues offer back''')
rep(r'''openShifts:null,pushSubs:null,''', r'''openShifts:null,openSwaps:null,swapOffers:null,pushSubs:null,''')
# the rules: who can offer, and whether an ask or an offer still holds
rep(r'''let swapPeer=null;''',
r'''let swapPeer=null;
/* ---------- swaps without naming one colleague: Ask everyone ----------
   A consultant asks about one of their clinical shifts; each colleague who could take it may offer one of their own shifts
   back; the asker accepts one, and it becomes an ordinary swap request, already agreed, for an admin to approve. S.openSwaps
   holds the asks and S.swapOffers the offers, both merged item by item. Whether an ask or an offer still holds is worked out
   from the roster every time it is read, so a stale one can never be accepted, even when nothing closed it. */
function swCycleOf(o){ return (S.cycles||[]).find(c=>c.id===(o&&o.cycleId))||null; }
function swLive(cyc){ return !!cyc&&!cyc.archived&&cyc.status!=="draft"; }
function swShiftOf(cyc,sid,isoD){ const v=cyc&&cyc.assign&&cyc.assign[sid+"|"+isoD]; return (v&&v.kind==="clinical")?{kind:"clinical",period:v.period,zone:v.zone,type:v.type||null}:null; }
function swSame(a,b){ return !!a&&!!b&&a.period===b.period&&a.zone===b.zone&&(a.type||null)===(b.type||null); }
function swFree(cyc,sid,isoD){ const v=cyc&&cyc.assign&&cyc.assign[sid+"|"+isoD]; return !(v&&v.kind&&v.kind!=="off")&&!leaveOn(sid,isoD); }   // no shift of any kind and no leave, UA included
function swOnRoster(cyc,sid){ const s=S.staff.find(x=>x.id===sid), r=cyc&&cyc.roles&&cyc.roles[sid]; return !!s&&isClinical(s)&&!!r&&r.in!==false; }   // read from the cycle itself, which need not be the one on screen; no entry means not on it
function swOfferable(o,sid){ const c=swCycleOf(o), today=iso(new Date());   // the shifts sid could offer back: their own, on a day to come, where the asker is free
  if(!c||!swOnRoster(c,sid)||!swFree(c,sid,o.dateA))return [];
  return datesOf(c.cycle).map(iso).filter(d=>d>=today).map(d=>({d:d,shift:swShiftOf(c,sid,d)})).filter(x=>x.shift&&swFree(c,o.from,x.d)); }
function swWho(o){ return S.staff.filter(s=>swOfferable(o,s.id).length).map(s=>s.id); }   // everyone who could answer an ask, and so everyone told about it
function swAskWhy(o){ if(!o)return "it has gone";   // "" while the ask holds; otherwise why it reads as closed
  if(o.status==="done")return "a swap was agreed";
  if(o.status!=="open")return o.why||"it was closed";
  const c=swCycleOf(o); if(!swLive(c))return "the roster is not live";
  if(o.dateA<iso(new Date()))return "that day has passed";
  if(!swSame(swShiftOf(c,o.from,o.dateA),o.shift)||leaveOn(o.from,o.dateA))return "the shift has changed";
  return ""; }
function swOfferWhy(f){ if(!f)return "it has gone";   // "" while the offer holds
  if(f.status!=="open")return f.status==="accepted"?"it was accepted":(f.status==="withdrawn"?"it was withdrawn":"it was closed");
  const o=(S.openSwaps||[]).find(x=>x.id===f.openId), w=swAskWhy(o); if(w)return w;
  const c=swCycleOf(o);
  if(f.dateB<iso(new Date()))return "that day has passed";
  if(!swSame(swShiftOf(c,f.by,f.dateB),f.shift))return "the offered shift has changed";
  if(!swOnRoster(c,f.by))return nameOf(f.by)+" is no longer on this roster";
  if(!swFree(c,o.from,f.dateB))return nameOf(o.from)+" is no longer free on "+fmtISO(f.dateB);
  if(!swFree(c,f.by,o.dateA))return nameOf(f.by)+" is no longer free on "+fmtISO(o.dateA);
  return ""; }''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/sw1-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 3`, then `800 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js deploy/demo.html
git commit -m "Open swaps 1/6: the records and the rules. S.openSwaps holds asks and S.swapOffers the shifts colleagues offer back, both merged item by item so two colleagues offering at once both keep theirs. Who can offer is whoever is on the cycle's roster, free on the day and holding a clinical shift on another day to come when the asker is free; an ask or an offer holds only while the roster still supports it, worked out from the roster every time

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The flow: ask, offer, accept, withdraw

**Files:**
- Modify: `app.html` (after `swOfferWhy`; `AUDIT_WORDS`)
- Test: `tests/suite.js` (`open swaps` block)

**Interfaces:**
- Consumes: Task 1's helpers; `commitGuarded(mutate)`, `notify(to,text,id,go)`, `logAudit`, `_osPushQueue`/`_osFlushPush`, `zoneLabelFor(cyc,z,sh)`, `typeLabelOf(cyc,sh)`, `shiftUnits(cyc,sh)`, `active()`, `isAdmin()`.
- Produces:
  - `swShiftText(cyc,sh) → "Resus AM"`; `swOfferLabel(cyc,isoD,sh) → "Fri 6 Nov · Resus Full · counts 2"`.
  - `swapAskRefusal(sid,isoD) → ""` or `"This roster isn’t live yet."`, `"That day has passed."`, `"No clinical shift to swap that day."`, `"You’re already asking everyone about that shift."`
  - `swCloseOffers(o,text)`: closes every open offer on `o` and sends `text` to each colleague.
  - `swapAsk(sid,isoD,note)`, `swapOffer(openId,isoB)`, `swapOfferWithdraw(offerId)`, `swapAccept(offerId)`, `swapAskWithdraw(openId)`: each returns `commitGuarded`'s boolean.
  - An accepted offer creates `{id:"r…", type:"swap", from, dateA, peerId, dateB, reason, status:"pending", peerAgreed:true, openId, createdTs}` in `S.requests`, and sets the ask's `status:"done"` and `swapId`.
  - The push queued by an ask is `{type:"swap", osId, title, body, targets:[staffIds]}`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/sw2-suite.py`:

```python
rep(r'''      // ---- open swaps: later tasks add their tests above this line''', r'''      // ---- the flow: ask, offer, accept, withdraw (open shifts stay switched off throughout: none of it needs them)
      T("open swaps: asking everyone stores the ask with the shift as it stands and tells only the colleagues who could take it, on the bell and the phone", (function(){
        state(); put("s1",3,"PM","z2"); put("s2",5); put("s3",3); put("s3",6); put("s4",7);
        var pushed=null; _osFlushPush=function(){ pushed=_osPushQueue; _osPushQueue=null; };
        var ok=swapAsk("s1",D(3),"  wedding  "), o=S.openSwaps[0];
        var told=S.notifications.filter(function(n){ return /is looking for a swap/.test(n.text); }).map(function(n){ return n.to; }).sort();
        return ok===true && S.openSwaps.length===1 && o.from==="s1" && o.dateA===D(3) && o.cycleId==="cc" && o.status==="open" && o.note==="wedding" &&
               swSame(o.shift,{period:"PM",zone:"z2",type:null}) && JSON.stringify(told)==='["s2","s4"]' &&
               S.notifications[0].text==="Alex is looking for a swap for "+fmtISO(D(3))+" Acute PM." && S.notifications[0].go.tab==="requests" && S.notifications[0].go.cycle==="cc" &&
               !!pushed && pushed.type==="swap" && pushed.osId===o.id && JSON.stringify(pushed.targets.slice().sort())==='["s2","s4"]' &&
               S.audit[0].action==="swap.ask" && AUDIT_WORDS["swap.ask"]==="Asked everyone for a swap"; })());
      T("open swaps: an ask is refused for a day gone, a shift that is not clinical, a roster not live, someone else's shift, a second ask, and when nobody could take it", (function(){
        state(); put("s1",3); put("s2",5); c.assign["s1|"+D(4)]={kind:"cst"}; put("s1",-1);
        var past=swapAsk("s1",D(-1),""), cst=swapAsk("s1",D(4),"");
        S.viewAs="s2"; var other=swapAsk("s1",D(3),""); S.viewAs="admin"; var adm=swapAsk("s1",D(3),""); S.viewAs="s1";
        c.status="draft"; var draft=swapAsk("s1",D(3),""); c.status="published";
        var first=swapAsk("s1",D(3),""), again=swapAsk("s1",D(3),"");
        delete c.assign["s2|"+D(5)]; put("s1",6); var nobody=swapAsk("s1",D(6),"");
        return past===false && cst===false && other===false && adm===false && draft===false && first===true && again===false && nobody===false && S.openSwaps.length===1 &&
               said.indexOf("That day has passed.")>=0 && said.indexOf("No clinical shift to swap that day.")>=0 && said.indexOf("This roster isn’t live yet.")>=0 &&
               said.indexOf("Only the person on the shift can ask everyone.")>=0 && said.indexOf("You’re already asking everyone about that shift.")>=0 &&
               said.indexOf("Nobody is free on "+fmtISO(D(6))+" with a shift you could take in return.")>=0; })());
      T("open swaps: a colleague offers one shift, can change it, and the asker is told each time", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2"); put("s2",6); ask();
        S.viewAs="s2"; var a=swapOffer("sw1",D(5)), firstId=S.swapOffers[0]&&S.swapOffers[0].id, b=swapOffer("sw1",D(6)), f=S.swapOffers[0];
        return a===true && b===true && S.swapOffers.length===1 && f.id===firstId && f.openId==="sw1" && f.by==="s2" && f.dateB===D(6) && f.status==="open" && swSame(f.shift,{period:"AM",zone:"z1",type:null}) &&
               S.notifications.filter(function(n){ return n.to==="s1"; }).length===2 &&
               S.notifications[1].text==="Sam offers "+fmtISO(D(5))+" Acute PM for your "+fmtISO(D(3))+" shift." &&
               S.notifications[0].text==="Sam changed their offer to "+fmtISO(D(6))+" Resus AM for your "+fmtISO(D(3))+" shift." &&
               S.audit.filter(function(x){ return x.action==="swap.offer"; }).length===2 && AUDIT_WORDS["swap.offer"]==="Offered a shift for a swap"; })());
      T("open swaps: an offer is refused for a shift that could not be swapped, for an ask that no longer holds, and from the asker", (function(){
        state(); put("s1",3); put("s1",5); put("s2",5); put("s2",6); put("s3",7); var o=ask();
        S.viewAs="s2"; var busy=swapOffer("sw1",D(5)), notTheirs=swapOffer("sw1",D(7)), gone=swapOffer("nope",D(6));
        S.viewAs="s1"; var self=swapOffer("sw1",D(6));
        o.status="closed"; o.why="withdrawn"; S.viewAs="s2"; var closed=swapOffer("sw1",D(6));
        o.status="open"; o.why=""; var good=swapOffer("sw1",D(6));
        return busy===false && notTheirs===false && gone===false && self===false && closed===false && good===true && S.swapOffers.length===1 &&
               said.indexOf("You can’t offer that shift for this swap.")>=0 && said.indexOf("That swap request is closed: withdrawn.")>=0 && said.indexOf("That swap request is gone.")>=0; })());
      T("open swaps: only the colleague who made an offer can withdraw it, once, and the asker is told", (function(){
        state(); put("s1",3); put("s2",5); ask(); var f=offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s3"; var sneak=swapOfferWithdraw("so1");
        S.viewAs="s2"; var ok=swapOfferWithdraw("so1"), twice=swapOfferWithdraw("so1");
        return sneak===false && ok===true && twice===false && f.status==="withdrawn" && S.notifications[0].to==="s1" &&
               S.notifications[0].text==="Sam withdrew their offer for your "+fmtISO(D(3))+" shift." && S.audit[0].action==="swap.offer-withdraw" && AUDIT_WORDS["swap.offer-withdraw"]==="Withdrew a swap offer"; })());
      T("open swaps: accepting an offer makes an agreed swap for the admin, marks the ask done, closes the other offers and tells everyone", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2"); put("s3",6); var o=ask({note:"wedding"});
        var f=offer(), g=offer({id:"so2",by:"s3",dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; var ok=swapAccept("so1"), r=S.requests[0];
        var to=function(who,text){ return S.notifications.some(function(n){ return n.to===who&&n.text===text; }); };
        return ok===true && !!r && r.type==="swap" && r.from==="s1" && r.dateA===D(3) && r.peerId==="s2" && r.dateB===D(5) && r.reason==="wedding" &&
               r.status==="pending" && r.peerAgreed===true && r.openId==="sw1" && o.status==="done" && o.swapId===r.id && f.status==="accepted" && g.status==="closed" &&
               to("s2","Alex accepted your offer of "+fmtISO(D(5))+" for their "+fmtISO(D(3))+" shift. It has gone to your admin.") &&
               to("s3","Alex found a swap for "+fmtISO(D(3))+". Thank you for offering.") && to("admin","Alex and Sam agreed a swap through Ask everyone — awaiting approval.") &&
               S.audit[0].action==="swap.accept" && AUDIT_WORDS["swap.accept"]==="Accepted a swap offer" && !!c.assign["s1|"+D(3)] && !!c.assign["s2|"+D(5)]; })());
      T("open swaps: accepting reads both shifts again, so a moved shift or leave approved without a close cannot slip through, and only the asker accepts", (function(){
        state(); put("s1",3); put("s2",5); var o=ask(), f=offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; c.assign["s2|"+D(5)].zone="z2"; var moved=swapAccept("so1"); c.assign["s2|"+D(5)].zone="z1";
        S.leave.push({id:"lv",staffId:"s1",from:D(3),to:D(3),code:"AL",status:"approved"}); var leave=swapAccept("so1"); S.leave=[];
        S.viewAs="s2"; var notAsker=swapAccept("so1"); S.viewAs="s1"; var gone=swapAccept("nope");
        return moved===false && leave===false && notAsker===false && gone===false && S.requests.length===0 && o.status==="open" && f.status==="open" &&
               said.indexOf("That offer can’t be accepted: the offered shift has changed.")>=0 && said.indexOf("That offer can’t be accepted: the shift has changed.")>=0 &&
               said.indexOf("Only Alex can accept an offer for their shift.")>=0 && said.indexOf("That offer is gone.")>=0; })());
      T("open swaps: an accept racing a withdraw ends one way only, because each write reads the ask again", (function(){
        state(); put("s1",3); put("s2",5); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; var wd=swapAskWithdraw("sw1"), acc=swapAccept("so1"), none=S.requests.length===0;
        state(); put("s1",3); put("s2",5); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; var acc2=swapAccept("so1"), wd2=swapAskWithdraw("sw1");
        return wd===true && acc===false && none && acc2===true && wd2===false && S.openSwaps[0].status==="done" && S.requests.length===1 && said.indexOf("You already accepted an offer.")>=0; })());
      T("open swaps: withdrawing the ask closes it and every open offer on it, tells each colleague who offered, and only the asker can", (function(){
        state(); put("s1",3); put("s2",5); put("s3",6); var o=ask(), f=offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}}), g=offer({id:"so2",by:"s3",dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        var h=offer({id:"so3",by:"s4",status:"withdrawn"});
        S.viewAs="s2"; var sneak=swapAskWithdraw("sw1");
        S.viewAs="s1"; var ok=swapAskWithdraw("sw1"), twice=swapAskWithdraw("sw1");
        return sneak===false && ok===true && twice===false && o.status==="closed" && o.why==="withdrawn" && f.status==="closed" && g.status==="closed" && h.status==="withdrawn" &&
               S.notifications.filter(function(n){ return n.text==="Alex no longer needs a swap for "+fmtISO(D(3))+"."; }).map(function(n){ return n.to; }).sort().join()==="s2,s3" &&
               S.audit[0].action==="swap.ask-withdraw" && AUDIT_WORDS["swap.ask-withdraw"]==="Withdrew an ask for a swap" && said.indexOf("That swap request is already closed.")>=0; })());
      T("open swaps: the admin's approval carries the swap out as for any swap, and a decline leaves the ask done so the asker can simply ask again", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2"); ask(); offer();
        S.viewAs="s1"; swapAccept("so1"); var r=S.requests[0]; S.viewAs="admin"; approveSwap(r.id,"");
        var moved=r.status==="approved" && !!c.assign["s2|"+D(3)] && c.assign["s2|"+D(3)].zone==="z1" && !!c.assign["s1|"+D(5)] && c.assign["s1|"+D(5)].zone==="z2" && !c.assign["s1|"+D(3)] && !c.assign["s2|"+D(5)];
        state(); put("s1",3); put("s2",5,"PM","z2"); var o=ask(); offer();
        S.viewAs="s1"; swapAccept("so1"); var r2=S.requests[0]; S.viewAs="admin"; declineSwap(r2.id,"");
        return moved && r2.status==="declined" && o.status==="done" && swapAskRefusal("s1",D(3))===""; })());

      // ---- open swaps: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/sw2-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then `HARNESS ERROR: @` and `799 passed, 1 failed` (the block stops at the first call to `swapAsk`).

- [ ] **Step 3: Implement.** Create `$SP/sw2-app.py`:

```python
# the writes: ask, offer, change or withdraw an offer, accept one, withdraw the ask
rep(r'''  if(!swFree(c,f.by,o.dateA))return nameOf(f.by)+" is no longer free on "+fmtISO(o.dateA);
  return ""; }''',
r'''  if(!swFree(c,f.by,o.dateA))return nameOf(f.by)+" is no longer free on "+fmtISO(o.dateA);
  return ""; }
function swShiftText(cyc,sh){ const z=((cyc&&cyc.settings&&cyc.settings.zones)||S.zones||[]).find(x=>x.id===sh.zone); return (z?zoneLabelFor(cyc,z,sh)+" ":"")+typeLabelOf(cyc,sh); }   // "Resus AM", in the ask's own cycle
function swOfferLabel(cyc,isoD,sh){ return fmtISO(isoD)+" @U@00b7 "+swShiftText(cyc,sh)+" @U@00b7 counts "+shiftUnits(cyc,sh); }   // every offer says what it counts, so a full day for a half day surprises nobody
function swapAskRefusal(sid,isoD){ const c=active();   // "" when sid may ask everyone about their shift on isoD, in the cycle on screen
  if(!swLive(c))return "This roster isn@U@2019t live yet.";
  if(!isoD||isoD<iso(new Date()))return "That day has passed.";
  if(!swShiftOf(c,sid,isoD))return "No clinical shift to swap that day.";
  if((S.openSwaps||[]).some(o=>o.from===sid&&o.dateA===isoD&&swAskWhy(o)===""))return "You@U@2019re already asking everyone about that shift.";
  return ""; }
function swCloseOffers(o,text){ (S.swapOffers||[]).filter(f=>f.openId===o.id&&f.status==="open").forEach(f=>{ f.status="closed"; notify(f.by,text,null,{tab:"requests",cycle:o.cycleId}); }); }
function swapAsk(sid,isoD,note){
  return commitGuarded(()=>{ if(isAdmin()||sid!==S.viewAs)return {ok:false,reason:"Only the person on the shift can ask everyone."};
    const bad=swapAskRefusal(sid,isoD); if(bad)return {ok:false,reason:bad};
    const c=active(), id="sw"+Date.now()+Math.random().toString(36).slice(2,5);
    const o={id:id,cycleId:c.id,from:sid,dateA:isoD,shift:swShiftOf(c,sid,isoD),note:String(note||"").trim().slice(0,300),status:"open",why:"",ts:Date.now(),swapId:null};
    const who=swWho(o); if(!who.length)return {ok:false,reason:"Nobody is free on "+fmtISO(isoD)+" with a shift you could take in return."};
    S.openSwaps.unshift(o);
    const what=fmtISO(isoD)+" "+swShiftText(c,o.shift);
    who.forEach(b=>notify(b,nameOf(sid)+" is looking for a swap for "+what+".","swask-"+id+"-"+b,{tab:"requests",cycle:c.id}));
    logAudit("swap.ask",nameOf(sid)+" "+isoD+" "+swShiftText(c,o.shift)+" @U@00b7 "+who.length+" asked",sid);
    _osPushQueue={type:"swap",osId:id,title:"Swap wanted @U@2014 "+what,body:nameOf(sid)+" is looking for a swap. Tap to offer one of your shifts.",targets:who};   // only the colleagues who could take it
    return {ok:true}; }); }
function swapOffer(openId,isoB){
  return commitGuarded(()=>{ const me=S.viewAs, o=(S.openSwaps||[]).find(x=>x.id===openId);
    if(!o)return {ok:false,reason:"That swap request is gone."};
    const why=swAskWhy(o); if(why)return {ok:false,reason:"That swap request is closed: "+why+"."};
    const pick=swOfferable(o,me).find(x=>x.d===isoB); if(!pick)return {ok:false,reason:"You can@U@2019t offer that shift for this swap."};
    const c=swCycleOf(o), mine=S.swapOffers.find(f=>f.openId===o.id&&f.by===me&&f.status==="open");   // one offer each: offering again changes it
    if(mine){ mine.dateB=isoB; mine.shift=pick.shift; mine.ts=Date.now(); }
    else S.swapOffers.unshift({id:"so"+Date.now()+Math.random().toString(36).slice(2,5),openId:o.id,by:me,dateB:isoB,shift:pick.shift,status:"open",ts:Date.now()});
    notify(o.from,nameOf(me)+(mine?" changed their offer to ":" offers ")+fmtISO(isoB)+" "+swShiftText(c,pick.shift)+" for your "+fmtISO(o.dateA)+" shift.",null,{tab:"requests",cycle:o.cycleId});
    logAudit("swap.offer",nameOf(me)+" "+isoB+" "+swShiftText(c,pick.shift)+" for "+nameOf(o.from)+" "+o.dateA,me);
    return {ok:true}; }); }
function swapOfferWithdraw(offerId){
  return commitGuarded(()=>{ const f=(S.swapOffers||[]).find(x=>x.id===offerId);
    if(!f||f.by!==S.viewAs)return {ok:false,reason:"That offer isn@U@2019t yours."};
    if(f.status!=="open")return {ok:false,reason:"That offer is already closed."};
    const o=(S.openSwaps||[]).find(x=>x.id===f.openId);
    f.status="withdrawn";
    if(o&&o.status==="open")notify(o.from,nameOf(f.by)+" withdrew their offer for your "+fmtISO(o.dateA)+" shift.",null,{tab:"requests",cycle:o.cycleId});
    logAudit("swap.offer-withdraw",nameOf(f.by)+" "+f.dateB+(o?" for "+nameOf(o.from)+" "+o.dateA:""),f.by);
    return {ok:true}; }); }
function swapAccept(offerId){
  return commitGuarded(()=>{ const f=(S.swapOffers||[]).find(x=>x.id===offerId), o=f&&(S.openSwaps||[]).find(x=>x.id===f.openId);
    if(!o)return {ok:false,reason:"That offer is gone."};
    if(o.from!==S.viewAs)return {ok:false,reason:"Only "+nameOf(o.from)+" can accept an offer for their shift."};
    const why=swOfferWhy(f); if(why)return {ok:false,reason:"That offer can@U@2019t be accepted: "+why+"."};   // read again inside the write, so two phones cannot both finish it
    const rid="r"+Date.now()+Math.random().toString(36).slice(2,5);
    S.requests.unshift({id:rid,type:"swap",from:o.from,dateA:o.dateA,peerId:f.by,dateB:f.dateB,reason:o.note||"",status:"pending",peerAgreed:true,openId:o.id,createdTs:Date.now()});   // an ordinary swap, already agreed: the admin's card and approval are unchanged
    o.status="done"; o.swapId=rid; f.status="accepted";
    swCloseOffers(o,nameOf(o.from)+" found a swap for "+fmtISO(o.dateA)+". Thank you for offering.");
    notify(f.by,nameOf(o.from)+" accepted your offer of "+fmtISO(f.dateB)+" for their "+fmtISO(o.dateA)+" shift. It has gone to your admin.",null,{tab:"requests",cycle:o.cycleId});
    notify("admin",nameOf(o.from)+" and "+nameOf(f.by)+" agreed a swap through Ask everyone @U@2014 awaiting approval.",null,{tab:"requests"});
    logAudit("swap.accept","with "+nameOf(f.by)+" "+o.dateA+" @U@2194 "+f.dateB,o.from);
    return {ok:true}; }); }
function swapAskWithdraw(openId){
  return commitGuarded(()=>{ const o=(S.openSwaps||[]).find(x=>x.id===openId);
    if(!o||o.from!==S.viewAs)return {ok:false,reason:"That swap request isn@U@2019t yours."};
    if(o.status!=="open")return {ok:false,reason:o.status==="done"?"You already accepted an offer.":"That swap request is already closed."};
    o.status="closed"; o.why="withdrawn";
    swCloseOffers(o,nameOf(o.from)+" no longer needs a swap for "+fmtISO(o.dateA)+".");
    logAudit("swap.ask-withdraw",nameOf(o.from)+" "+o.dateA,o.from);
    return {ok:true}; }); }''')
rep(r'''"swap.request":"Requested a swap"};''', r'''"swap.request":"Requested a swap","swap.ask":"Asked everyone for a swap","swap.ask-withdraw":"Withdrew an ask for a swap","swap.offer":"Offered a shift for a swap","swap.offer-withdraw":"Withdrew a swap offer","swap.accept":"Accepted a swap offer"};''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/sw2-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed|PASS  audit"
```

Expected: `replacements: 2`, then `PASS  audit: every logged action has a plain-word sentence` and `810 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js deploy/demo.html
git commit -m "Open swaps 2/6: the flow. Ask everyone tells only the colleagues who could take the shift, in the app and by phone alert; each colleague offers one shift and can change or withdraw it; the asker accepts one, which reads both shifts again and becomes an ordinary swap request, already agreed, for the admin to approve; the other offers close and everyone is told. Withdrawing the ask closes its offers. None of it needs open shifts switched on

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Screens: Swap it, the swap sheet's two choices, the Requests cards

**Files:**
- Modify: `app.html` (`daySheetHTML` and a new `dsBookedActs` before it; `let swapPeer`; `reqSheetHTML`; new `swapAllFormHTML`, `swapAskingHTML`, `swapWantedHTML` before `swapAdminCard`; `swapAdminCard`; the staff branch of `viewRequests`; the `selfroster` and `requests` blocks of `wire()`; the `.cirow` CSS rule)
- Modify: `tests/run.py` (tab wiring lint)
- Test: `tests/suite.js` (`open swaps` block, including its `keep` and `finally` lines)

**Interfaces:**
- Consumes: Tasks 1–2; `staffAssignments(sid)`, `openConfirm({title,body,ok}) → {then}`, `clearErrors`, `fieldError`, `saveLocal`, `render`, `toast`.
- Produces:
  - `dsBookedActs(sid,isoD,cyc) → html`: the actions under a booked shift on the day sheet (Swap it, Remove this shift, or the notice period's ways off).
  - `_swapMode` (`"peer"` or `"all"`) and `_swapMine` (an ISO date or `null`), declared beside `swapPeer`.
  - `swapAllFormHTML(me,seg)`, `swapAskingHTML(me)`, `swapWantedHTML(me)` → html.
  - Attributes and ids: `data-swapit="<iso>"` (selfroster), `data-swmode="peer|all"`, `data-swoffer="<openId>"` with its select `id="swofs-<openId>"`, `data-swofferwd="<offerId>"`, `data-swaccept="<offerId>"`, `data-swaskwd="<openId>"`, and `id="swNote"`, `id="swReach"`, `id="swAsk"` (requests).
  - The admin swap card gains `<span class="tag muted">via Ask everyone</span>` when the request has `openId`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/sw3-suite.py`:

```python
rep(r'''    var keep={S:S,toast:toast,oc:openConfirm,sr:_srSid,rs:_reqSheet,ds:_daySheet,sp:swapPeer,fp:_osFlushPush}, c=null, said=[];''',
r'''    var keep={S:S,toast:toast,oc:openConfirm,sr:_srSid,rs:_reqSheet,ds:_daySheet,sp:swapPeer,fp:_osFlushPush,sm:_swapMode,sw:_swapMine,tab:S.tab}, c=null, said=[];''')
rep(r'''_osFlushPush=keep.fp; /* open swaps: restore */''', r'''_osFlushPush=keep.fp; _swapMode=keep.sm; _swapMine=keep.sw; /* open swaps: restore */''')
rep(r'''      // ---- open swaps: later tasks add their tests above this line''', r'''      // ---- the screens
      T("open swaps: the day sheet of your own booked shift offers Swap it beside Remove this shift, and inside the notice period beside the other ways off", (function(){
        state({notice:14,market:true}); put("s1",3); put("s1",20); var btn=function(n){ return 'data-swapit="'+D(n)+'"'; };
        var near=daySheetHTML(D(3)), far=daySheetHTML(D(20));
        offerShift("s1",D(3)); var offered=daySheetHTML(D(3));
        S.viewAs="admin"; _srSid="s1"; var adm=daySheetHTML(D(20)); S.viewAs="s1"; _srSid="s2"; put("s2",21); var other=daySheetHTML(D(21)); _srSid=null;
        return far.indexOf(btn(20))>0 && far.indexOf(btn(20))<far.indexOf('data-osdrop="'+D(20)+'"') && far.indexOf("Swap it</button>")>0 &&
               near.indexOf(btn(3))>0 && near.indexOf('data-osoffer="'+D(3)+'"')>0 && near.indexOf('data-osask="'+D(3)+'"')>0 && near.indexOf('data-osdrop=')<0 &&
               offered.indexOf(btn(3))>0 && offered.indexOf("Offered to the group")>0 &&
               adm.indexOf("data-swapit")<0 && adm.indexOf('data-osdrop="'+D(20)+'"')>0 && other.indexOf("data-swapit")<0; })());
      T("open swaps: a day already gone offers no Swap it, even in a round that still lets it be removed", (function(){
        state(); c.settings.rosterMode="rounds"; c.status="open"; put("s1",-2);
        var past=daySheetHTML(D(-2));
        return past.indexOf('data-osdrop="'+D(-2)+'"')>0 && past.indexOf("data-swapit")<0; })());
      T("open swaps: the swap sheet offers With a colleague, as before, and Ask everyone, which lists shifts to come and says who it will reach", (function(){
        state(); put("s1",-1); put("s1",3); put("s1",4); c.assign["s1|"+D(6)]={kind:"cst"}; put("s2",6); put("s3",8); put("s4",9);
        _swapMode="peer"; _swapMine=D(4); var peer=reqSheetHTML("swap");
        _swapMode="all"; var all=reqSheetHTML("swap");
        _swapMine=D(3); delete c.assign["s3|"+D(8)]; delete c.assign["s4|"+D(9)]; var none=reqSheetHTML("swap");
        return peer.indexOf('id="swSubmit"')>0 && peer.indexOf('id="swPeer"')>0 && peer.indexOf('data-swmode="peer" class="on"')>0 && peer.indexOf('<option value="'+D(4)+'" selected>')>0 &&
               peer.indexOf('<option value="'+D(-1)+'"')>0 && peer.indexOf('id="swAsk"')<0 &&
               all.indexOf('data-swmode="all" class="on"')>0 && all.indexOf('id="swPeer"')<0 && all.indexOf('id="swNote"')>0 && all.indexOf('<option value="'+D(4)+'" selected>')>0 &&
               all.indexOf('<option value="'+D(-1)+'"')<0 && all.indexOf('<option value="'+D(6)+'"')<0 &&
               all.indexOf("Goes to 2 colleagues who are free on "+fmtISO(D(4))+".")>0 && all.indexOf('id="swAsk">Ask everyone</button>')>0 &&
               none.indexOf("Nobody is free on "+fmtISO(D(3))+" with a shift you could take in return.")>0 && none.indexOf('id="swAsk" disabled>')>0; })());
      T("open swaps: Swap it opens Requests with the swap sheet and that shift already chosen", (function(){
        state(); put("s1",3); put("s1",5); S.tab="selfroster"; _daySheet=D(5);
        var qsa=document.querySelectorAll, b={dataset:{swapit:D(5)}};
        document.querySelectorAll=function(sel){ return sel==="[data-swapit]"?[b]:[]; };
        try{ render(); } finally { document.querySelectorAll=qsa; }
        if(b.onclick)b.onclick();
        return !!b.onclick && S.tab==="requests" && _reqSheet==="swap" && _daySheet===null && _swapMine===D(5) &&
               document.getElementById("sheetRoot").innerHTML.indexOf('<option value="'+D(5)+'" selected>')>0; })());
      T("open swaps: Ask everyone sends the chosen shift and the note, then closes the sheet", (function(){
        state(); put("s1",3); put("s2",5); _swapMode="all"; _reqSheet="swap"; render();
        document.getElementById("swMine").value=D(3); document.getElementById("swNote").value="wedding";
        document.getElementById("swAsk").onclick();
        return S.openSwaps.length===1 && S.openSwaps[0].dateA===D(3) && S.openSwaps[0].note==="wedding" && _reqSheet===null; })());
      T("open swaps: a shift chosen on Ask everyone stays chosen, and switching to With a colleague keeps the one on screen", (function(){
        state(); put("s1",3); put("s1",4); put("s2",6); _swapMode="all"; _reqSheet="swap"; render();
        var m=document.getElementById("swMine"); m.value=D(4); m.onchange();
        var picked=_swapMine===D(4) && document.getElementById("sheetRoot").innerHTML.indexOf('<option value="'+D(4)+'" selected>')>0;
        _swapMine=D(3); m.value=D(4);
        var qsa=document.querySelectorAll, b={dataset:{swmode:"peer"}};
        document.querySelectorAll=function(sel){ return sel==="[data-swmode]"?[b]:[]; };
        try{ render(); } finally { document.querySelectorAll=qsa; }
        b.onclick(); var sheet=document.getElementById("sheetRoot").innerHTML; _reqSheet=null;
        return picked && _swapMine===D(4) && _swapMode==="peer" && sheet.indexOf('<option value="'+D(4)+'" selected>')>0 && sheet.indexOf('id="swPeer"')>0; })());
      T("open swaps: Requests shows a colleague who could take it a Swaps wanted card with their shifts and what each counts", (function(){
        state(); c.settings.shiftTypes=shiftTypesOf(c).concat([FULL]);
        put("s1",3); put("s2",5,"AM","z1","full"); put("s2",6,"PM","z2"); put("s3",3); put("s3",7); ask({note:"wedding"});
        S.viewAs="s2"; var v=viewRequests();
        S.viewAs="s3"; var busy=viewRequests();
        S.viewAs="s2"; swapOffer("sw1",D(6)); var after=viewRequests(), f=S.swapOffers[0];
        put("s4",8); ask({id:"sw2",from:"s4",dateA:D(8),status:"closed",why:"withdrawn"}); var closed=viewRequests().indexOf("Jo</b> is looking")<0;
        S.cycles.push({id:"c2",cycle:{start:D(35),weeks:2},status:"published",archived:false,settings:c.settings,roles:c.roles,assign:{}});
        S.cycles[1].assign["s3|"+D(36)]={kind:"clinical",period:"AM",zone:"z1"}; S.cycles[1].assign["s2|"+D(38)]={kind:"clinical",period:"AM",zone:"z1"};
        ask({id:"sw3",cycleId:"c2",from:"s3",dateA:D(36)}); var elsewhere=viewRequests().indexOf("Kim</b> is looking")<0;
        S.activeId="c2"; var there=viewRequests().indexOf("Kim</b> is looking")>0; S.activeId="cc";
        return v.indexOf("<h2>Swaps wanted</h2>")>0 && v.indexOf("wedding")>0 && v.indexOf('<select id="swofs-sw1">')>0 &&
               v.indexOf(fmtISO(D(5))+" · Resus Full · counts 2")>0 && v.indexOf(fmtISO(D(6))+" · Acute PM · counts 1")>0 && v.indexOf('data-swoffer="sw1">Send offer')>0 &&
               busy.indexOf("Swaps wanted")<0 &&
               after.indexOf("You offered "+fmtISO(D(6))+" · Acute PM · counts 1")>0 && after.indexOf('data-swofferwd="'+f.id+'"')>0 && after.indexOf('data-swoffer="sw1">Change offer')>0 &&
               after.indexOf('<option value="'+D(6)+'" selected>')>0 && closed && elsewhere && there; })());
      T("open swaps: Send offer sends the shift chosen in that ask's own list, and Withdraw takes it back", (function(){
        state(); put("s1",3); put("s2",5); put("s2",6); ask(); S.viewAs="s2";
        var qsa=document.querySelectorAll, send={dataset:{swoffer:"sw1"}}, wd={dataset:{}};
        document.querySelectorAll=function(sel){ return sel==="[data-swoffer]"?[send]:(sel==="[data-swofferwd]"?[wd]:[]); };
        try{ render(); document.getElementById("swofs-sw1").value=D(6); send.onclick(); wd.dataset.swofferwd=S.swapOffers[0].id; render(); wd.onclick(); } finally { document.querySelectorAll=qsa; }
        return S.swapOffers.length===1 && S.swapOffers[0].dateB===D(6) && S.swapOffers[0].status==="withdrawn"; })());
      T("open swaps: the asker's Requests lists each offer with Accept, reads a stale offer as closed with its reason, and offers Withdraw", (function(){
        state(); put("s1",3); put("s1",4); put("s2",5,"PM","z2"); put("s3",6); var o=ask();
        offer(); offer({id:"so2",by:"s3",dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}}); c.assign["s3|"+D(6)].zone="z2";
        ask({id:"sw2",dateA:D(4)}); ask({id:"sw4",dateA:D(7)}); offer({id:"so4",openId:"sw4",by:"s4",dateB:D(9)}); ask({id:"sw0",dateA:D(-1)});
        var v=viewRequests();
        return v.indexOf("<h2>Asking everyone</h2>")>0 && v.indexOf("Sam offers <b>"+fmtISO(D(5))+" · Acute PM · counts 1</b>")>0 && v.indexOf('data-swaccept="so1"')>0 &&
               v.indexOf('data-swaccept="so2"')<0 && v.indexOf("the offered shift has changed")>0 && v.indexOf('data-swaskwd="sw1"')>0 &&
               v.indexOf('data-swaskwd="sw2"')>0 && v.indexOf("No offers yet.")>0 && v.indexOf('data-swaskwd="sw4"')>0 && v.indexOf("Jo offers")<0 && v.indexOf('data-swaskwd="sw0"')<0; })());
      T("open swaps: Accept and Withdraw on the asker's card each ask first, then do it", (function(){
        state(); put("s1",3); put("s2",5); put("s1",8); put("s3",9); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}}); ask({id:"sw2",dateA:D(8)});
        var asked=[]; openConfirm=function(o){ asked.push(o.title); return {then:function(f){ f(true); }}; };
        var qsa=document.querySelectorAll, acc={dataset:{swaccept:"so1"}}, wd={dataset:{swaskwd:"sw2"}};
        document.querySelectorAll=function(sel){ return sel==="[data-swaccept]"?[acc]:(sel==="[data-swaskwd]"?[wd]:[]); };
        try{ render(); acc.onclick(); wd.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=keep.oc; }
        return asked.length===2 && asked[0]==="Accept Sam’s offer?" && S.requests.length===1 && S.openSwaps.find(function(o){ return o.id==="sw2"; }).status==="closed"; })());
      T("open swaps: the admin's swap card says when a swap came through Ask everyone", (function(){
        state(); put("s1",3); put("s2",5); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; swapAccept("so1"); S.viewAs="admin"; var v=viewRequests();
        delete S.requests[0].openId; var named=viewRequests();
        return v.indexOf("via Ask everyone")>0 && v.indexOf('data-approveswap="'+S.requests[0].id+'"')>0 && named.indexOf("via Ask everyone")<0 && named.indexOf("both agreed")>0; })());

      // ---- open swaps: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/sw3-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 3`, then `HARNESS ERROR: @` and `792 passed, 1 failed` (the block's first line reads `_swapMode`, which does not exist yet).

- [ ] **Step 3: Implement.** Create `$SP/sw3-app.py`:

```python
# the day sheet: the actions under a booked shift move into one helper, which adds Swap it
rep(r'''function daySheetHTML(isoD){''', r'''function dsBookedActs(sid,isoD,cyc){   // under a booked shift on the day sheet: Swap it, and coming off it the way the notice period allows
  const adm=isAdmin(), swapIt=(sid===S.viewAs&&isoD>=iso(new Date()))?`<button class="btn" data-swapit="${isoD}">${ic("swap")} Swap it</button>`:"";
  if(adm||!inNotice(isoD,cyc))return `<div class="dsact">${swapIt}<button class="btn danger" data-osdrop="${isoD}">Remove this shift</button></div>${(!adm&&gapOnDrop(cyc))?`<div class="muted small">Coming off tells the group @U@2014 it goes up as an open shift.</div>`:""}`;
  const note=`<div class="note">${ic("lock")} ${escapeHTML(noticeReason(isoD,cyc))}</div>`, alone=swapIt?`<div class="dsact">${swapIt}</div>`:"";
  if(featOn("marketplace")&&S.marketOn&&!offeredAlready(sid,isoD))return note+`<div class="dsact"><button class="btn primary" data-osoffer="${isoD}">${ic("arrowUR")} Offer it to the group</button><button class="btn" data-osask="${isoD}">Ask to come off</button>${swapIt}</div><div class="muted small">Offering it is enough on its own. Asking is for when you need to be off it whether or not a colleague takes it.</div>`;
  if(offeredAlready(sid,isoD))return note+`<div class="note">${ic("check")} ${askOn(sid,isoD)?"Offered to the group, and your admin has been asked @U@2014 you@U@2019re on it until one of them answers.":"Offered to the group @U@2014 you@U@2019re on it until a colleague takes it."}</div>`+alone;
  return note+alone; }
function daySheetHTML(isoD){''')
rep(r'''</div>${canPick&&(adm||!isRolling(cyc)||isoD>=iso(new Date()))?(
      (!adm&&inNotice(isoD,cyc))
        ? `<div class="note">${ic("lock")} ${escapeHTML(noticeReason(isoD,cyc))}</div>${(featOn("marketplace")&&S.marketOn&&!offeredAlready(sid,isoD))?`<div class="dsact"><button class="btn primary" data-osoffer="${isoD}">${ic("arrowUR")} Offer it to the group</button><button class="btn" data-osask="${isoD}">Ask to come off</button></div><div class="muted small">Offering it is enough on its own. Asking is for when you need to be off it whether or not a colleague takes it.</div>`:(offeredAlready(sid,isoD)?`<div class="note">${ic("check")} ${askOn(sid,isoD)?"Offered to the group, and your admin has been asked @U@2014 you@U@2019re on it until one of them answers.":"Offered to the group @U@2014 you@U@2019re on it until a colleague takes it."}</div>`:"")}`
        : `<div class="dsact"><button class="btn danger" data-osdrop="${isoD}">Remove this shift</button></div>${(!adm&&gapOnDrop(cyc))?`<div class="muted small">Coming off tells the group @U@2014 it goes up as an open shift.</div>`:""}`
      ):""}`;''', r'''</div>${canPick&&(adm||!isRolling(cyc)||isoD>=iso(new Date()))?dsBookedActs(sid,isoD,cyc):""}`;''')
# the swap sheet: two choices, and the shift stays chosen across re-renders
rep(r'''let swapPeer=null;''', r'''let swapPeer=null, _swapMode="peer", _swapMine=null;   // the swap sheet: which choice is showing, and the shift chosen (Swap it on a day sheet sets it)''')
rep(r'''    const peerShifts=swapPeer?staffAssignments(swapPeer):[];
    form=`<h3>Request a swap</h3><div class="sub">''', r'''    const peerShifts=swapPeer?staffAssignments(swapPeer):[];
    const seg=`<div class="seg" id="swModeSeg" role="group" aria-label="How to find a swap" style="margin:8px 0"><button data-swmode="peer" class="${_swapMode==="all"?"":"on"}">With a colleague</button><button data-swmode="all" class="${_swapMode==="all"?"on":""}">Ask everyone</button></div>`;
    if(_swapMode==="all")form=swapAllFormHTML(me,seg);
    else form=`<h3>Request a swap</h3>${seg}<div class="sub">''')
rep(r'''<select id="swMine">${myShifts.length?myShifts.map(x=>`<option value="${x.date}">''', r'''<select id="swMine">${myShifts.length?myShifts.map(x=>`<option value="${x.date}"${x.date===_swapMine?" selected":""}>''')
rep(r'''function swapAdminCard(r){''', r'''function swapAllFormHTML(me,seg){   // the swap sheet's Ask everyone: one of your shifts to come, an optional note, and who it will reach
  const c=active(), today=iso(new Date()), mine=staffAssignments(me).filter(x=>x.date>=today&&swShiftOf(c,me,x.date));
  const pick=mine.some(x=>x.date===_swapMine)?_swapMine:(mine[0]?mine[0].date:"");
  const bad=pick?swapAskRefusal(me,pick):"You have no shifts coming up to swap.", n=bad?0:swWho({cycleId:c.id,from:me,dateA:pick}).length;
  const reach=bad||(n?("Goes to "+n+(n===1?" colleague who is":" colleagues who are")+" free on "+fmtISO(pick)+"."):("Nobody is free on "+fmtISO(pick)+" with a shift you could take in return."));
  return `<h3>Request a swap</h3>${seg}<div class="sub">Everyone who could take it can offer one of their shifts. You pick one, then your admin approves.</div>
    <div class="row">
      <label class="field"><span class="lbl">My shift</span><select id="swMine">${mine.length?mine.map(x=>`<option value="${x.date}"${x.date===pick?" selected":""}>${escapeHTML(fmtISO(x.date)+" @U@00b7 "+x.label)}</option>`).join(""):`<option value="">No shifts coming up</option>`}</select></label>
      <label class="field" style="flex:1;min-width:160px"><span class="lbl">Note</span><input id="swNote" placeholder="Optional"></label>
    </div>
    <div class="${n?"muted small":"note"}" id="swReach">${escapeHTML(reach)}</div>
    <div class="flexbtns" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="reqCancel">Cancel</button><button class="btn primary" id="swAsk"${n?"":" disabled"}>Ask everyone</button></div>`; }
function swapAskingHTML(me){ const c=active(), today=iso(new Date());   // Requests, for the asker: each open ask with its offers, and Accept on each one that still holds
  const L=(S.openSwaps||[]).filter(o=>o.from===me&&o.cycleId===c.id&&o.status==="open"&&o.dateA>=today);
  if(!L.length)return "";
  return `<div class="card"><h2>Asking everyone</h2>${L.map(o=>{ const why=swAskWhy(o), offers=(S.swapOffers||[]).filter(f=>f.openId===o.id&&f.status==="open");
    const head=`<div class="listrow"><span class="grow"><b>${escapeHTML(fmtISO(o.dateA)+" "+swShiftText(c,o.shift))}</b>${o.note?` @U@00b7 <span class="muted">${escapeHTML(o.note)}</span>`:""}${why?` <span class="tag muted">closed</span> <span class="muted small">${escapeHTML(why)}</span>`:""}</span><button class="btn sm" data-swaskwd="${o.id}">Withdraw</button></div>`;
    if(why)return head;
    return head+(offers.length?offers.map(f=>{ const w=swOfferWhy(f);
      return `<div class="listrow"><span class="grow">${escapeHTML(nameOf(f.by))} offers <b>${escapeHTML(swOfferLabel(c,f.dateB,f.shift))}</b>${w?` <span class="tag muted">closed</span> <span class="muted small">${escapeHTML(w)}</span>`:""}</span>${w?"":`<button class="btn primary sm" data-swaccept="${f.id}">Accept</button>`}</div>`; }).join(""):`<div class="muted small">No offers yet. Everyone who could take it has been asked.</div>`); }).join("")}</div>`; }
function swapWantedHTML(me){ const c=active();   // Requests, for everyone else: each ask they could answer, the shifts they could offer and what each counts
  const rows=(S.openSwaps||[]).filter(o=>o.cycleId===c.id&&swAskWhy(o)==="").map(o=>{
    const mine=(S.swapOffers||[]).find(f=>f.openId===o.id&&f.by===me&&f.status==="open"), can=swOfferable(o,me);
    if(!mine&&!can.length)return "";
    const w=mine?swOfferWhy(mine):"";
    const pickOne=can.length?`<label class="field"><span class="lbl">Offer a shift</span><select id="swofs-${o.id}">${can.map(x=>`<option value="${x.d}"${mine&&mine.dateB===x.d?" selected":""}>${escapeHTML(swOfferLabel(c,x.d,x.shift))}</option>`).join("")}</select></label><button class="btn primary sm" data-swoffer="${o.id}">${mine?"Change offer":"Send offer"}</button>`:"";
    return `<div class="listrow swrow"><span class="grow"><b>${escapeHTML(nameOf(o.from))}</b> is looking for a swap for <b>${escapeHTML(fmtISO(o.dateA)+" "+swShiftText(c,o.shift))}</b>${o.note?` @U@00b7 <span class="muted">${escapeHTML(o.note)}</span>`:""}${mine?`<br><span class="small">You offered ${escapeHTML(swOfferLabel(c,mine.dateB,mine.shift))}</span>${w?` <span class="tag muted">closed</span> <span class="muted small">${escapeHTML(w)}</span>`:""}`:""}</span>${pickOne}${mine&&!w?`<button class="btn sm" data-swofferwd="${mine.id}">Withdraw</button>`:""}</div>`; }).join("");
  return rows?`<div class="card"><h2>Swaps wanted</h2>${rows}</div>`:""; }
function swapAdminCard(r){''')
rep(r'''<span class="tag ok">both agreed</span></div>''', r'''<span class="tag ok">both agreed</span>${r.openId?'<span class="tag muted">via Ask everyone</span>':""}</div>''')
rep(r'''+agreed+needsYou+list+btns;''', r'''+agreed+needsYou+swapAskingHTML(me)+swapWantedHTML(me)+list+btns;''')
# wiring: Swap it on the day sheet; the sheet's choices, Ask everyone, and the cards' buttons on Requests
rep(r'''    document.querySelectorAll("[data-octake]").forEach(b=>b.onclick=()=>{ const a=String(b.dataset.octake).split("|");''',
r'''    document.querySelectorAll("[data-swapit]").forEach(b=>b.onclick=()=>{ _daySheet=null; _ciForm=null; _swapMine=b.dataset.swapit; swapPeer=null; S.tab="requests"; _reqSheet="swap"; saveLocal(); render(); const f=document.getElementById("swMine"); if(f&&f.focus)try{f.focus();}catch(e){} });   // the one swap screen, with this shift chosen
    document.querySelectorAll("[data-octake]").forEach(b=>b.onclick=()=>{ const a=String(b.dataset.octake).split("|");''')
rep(r'''const rqS=document.getElementById("reqSwap");if(rqS)rqS.onclick=()=>{_reqSheet="swap";render();''', r'''const rqS=document.getElementById("reqSwap");if(rqS)rqS.onclick=()=>{_reqSheet="swap";_swapMine=null;render();''')
rep(r'''    document.querySelectorAll("[data-peeragree]").forEach(b=>b.onclick=()=>{agreeSwap(b.dataset.peeragree);render();});''',
r'''    document.querySelectorAll("[data-swmode]").forEach(b=>b.onclick=()=>{ const m=document.getElementById("swMine"); if(m&&m.value)_swapMine=m.value; _swapMode=b.dataset.swmode==="all"?"all":"peer"; render(); const f=document.getElementById("swMine"); if(f&&f.focus)try{f.focus();}catch(e){} });
    const swm=document.getElementById("swMine"); if(swm)swm.onchange=()=>{ _swapMine=swm.value||null; if(_swapMode==="all"){ render(); const f=document.getElementById("swMine"); if(f&&f.focus)try{f.focus();}catch(e){} } };   // Ask everyone says who the chosen shift reaches
    const swask=document.getElementById("swAsk"); if(swask)swask.onclick=()=>{ const mine=(document.getElementById("swMine")||{}).value, note=(document.getElementById("swNote")||{}).value||"";
      clearErrors(document.getElementById("sheetRoot"));
      if(!mine){fieldError(document.getElementById("swMine"),"Choose one of your shifts.");return;}
      if(swapAsk(S.viewAs,mine,note)){ _reqSheet=null; _swapMine=null; render(); toast("Asked everyone who could take it. Their offers will show here.","ok"); } };
    document.querySelectorAll("[data-swoffer]").forEach(b=>b.onclick=()=>{ const id=b.dataset.swoffer, sel=document.getElementById("swofs-"+id), o=(S.openSwaps||[]).find(x=>x.id===id); if(o&&sel&&sel.value&&swapOffer(id,sel.value))toast("Offer sent. "+nameOf(o.from)+" has been told.","ok"); });
    document.querySelectorAll("[data-swofferwd]").forEach(b=>b.onclick=()=>{ swapOfferWithdraw(b.dataset.swofferwd); });
    document.querySelectorAll("[data-swaccept]").forEach(b=>b.onclick=()=>{ const f=(S.swapOffers||[]).find(x=>x.id===b.dataset.swaccept), o=f&&(S.openSwaps||[]).find(x=>x.id===f.openId); if(!o)return;
      openConfirm({title:"Accept "+nameOf(f.by)+"@U@2019s offer?",body:"You take "+swOfferLabel(swCycleOf(o),f.dateB,f.shift)+", and they take your "+fmtISO(o.dateA)+" shift. It goes to your admin to approve, and the other offers close.",ok:"Accept"})
        .then(yes=>{ if(yes&&swapAccept(f.id))toast("Accepted. It has gone to your admin to approve.","ok"); }); });
    document.querySelectorAll("[data-swaskwd]").forEach(b=>b.onclick=()=>{ const o=(S.openSwaps||[]).find(x=>x.id===b.dataset.swaskwd); if(!o)return;
      openConfirm({title:"Stop asking about "+fmtISO(o.dateA)+"?",body:"Everyone who offered is told, and their offers close.",ok:"Withdraw"})
        .then(yes=>{ if(yes)swapAskWithdraw(o.id); }); });
    document.querySelectorAll("[data-peeragree]").forEach(b=>b.onclick=()=>{agreeSwap(b.dataset.peeragree);render();});''')
rep(r'''.cirow>.grow{min-width:200px}''', r'''.cirow>.grow{min-width:200px} .swrow{flex-wrap:wrap} .swrow>.grow{min-width:200px}''')
```

And `$SP/sw3-run.py`, so the wiring lint reads the new renderers:

```python
rep(r'''("dayRowHTML", "selfroster")):''', r'''("dayRowHTML", "selfroster"), ("dsBookedActs", "selfroster"), ("reqSheetHTML", "requests"), ("swapAllFormHTML", "requests"), ("swapAskingHTML", "requests"), ("swapWantedHTML", "requests")):''')
```

- [ ] **Step 4: Apply both and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/sw3-app.py
python3 $SP/rep.py tests/run.py $SP/sw3-run.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed|PASS  wiring"
```

Expected: `replacements: 12`, `replacements: 1`, then `PASS  wiring: a tab's own controls are wired in its own block` and `821 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js tests/run.py deploy/demo.html
git commit -m "Open swaps 3/6: the screens. Swap it sits on the day sheet of a consultant's own booked shift, beside Remove this shift or the notice period's ways off, and opens the swap sheet with that shift chosen; the sheet offers With a colleague, as before, and Ask everyone, which says who it will reach; Requests shows Swaps wanted to the colleagues who could take an ask, with what each offered shift counts, and Asking everyone to the asker, with Accept on each offer that still holds; the admin's card says when a swap came through Ask everyone. The chosen shift now survives picking a colleague

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Tidying up

**Files:**
- Modify: `app.html` (new `swTidy` before `swCloseOffers`; `AUDIT_WORDS`; `approveSwap`, `_osExecute`, `decideComeOff`, `approveRequest`, `plannerSetLeave`, `dropShift`, `unbookShift`, `setShift`, `clearRoster`)
- Test: `tests/suite.js` (`open swaps` block)

**Interfaces:**
- Consumes: Tasks 1–2 (`swAskWhy`, `swOfferWhy`, `swCloseOffers`).
- Produces: `swTidy()`: for each open ask whose day is to come, closes it with `why` set to `swAskWhy(o)` and tells whoever offered (`"<Asker>’s swap request for <day> has closed: <why>."`, audit `swap.ask-close`); for an ask that holds, closes each open offer on a day to come that no longer holds and tells its colleague (`"Your offer of <day> for <Asker>’s <day> shift has closed: <why>."`). A day already gone is never written.

- [ ] **Step 1: Write the failing tests.** Create `$SP/sw4-suite.py`:

```python
rep(r'''      // ---- open swaps: later tasks add their tests above this line''', r'''      // ---- tidying up: every path that takes the shift away closes what stood on it
      var scene=function(o){ state(o); put("s1",3); put("s2",5); put("s4",9); var a=ask(), f=offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}}); return {a:a,f:f}; };
      var closedAll=function(x){ return x.a.status==="closed" && x.a.why==="the shift has changed" && x.f.status==="closed" &&
        S.notifications.some(function(n){ return n.to==="s2"&&n.text==="Alex’s swap request for "+fmtISO(D(3))+" has closed: the shift has changed."; }) &&
        S.audit.some(function(a){ return a.action==="swap.ask-close"; }) && AUDIT_WORDS["swap.ask-close"]==="An ask for a swap was closed"; };
      T("open swaps: approving a swap that takes the asker's shift closes the ask and tells whoever offered", (function(){
        var x=scene(); S.requests=[{id:"rq1",type:"swap",from:"s1",dateA:D(3),peerId:"s4",dateB:D(9),status:"pending",peerAgreed:true,createdTs:1}];
        S.viewAs="admin"; approveSwap("rq1",""); return S.requests[0].status==="approved" && closedAll(x); })());
      T("open swaps: approving a swap that takes the offered shift closes that offer alone and tells its colleague", (function(){
        var x=scene(); S.requests=[{id:"rq1",type:"swap",from:"s2",dateA:D(5),peerId:"s4",dateB:D(9),status:"pending",peerAgreed:true,createdTs:1}];
        S.viewAs="admin"; approveSwap("rq1","");
        return S.requests[0].status==="approved" && x.a.status==="open" && x.f.status==="closed" &&
               S.notifications.some(function(n){ return n.to==="s2"&&n.text==="Your offer of "+fmtISO(D(5))+" for Alex’s "+fmtISO(D(3))+" shift has closed: the offered shift has changed."; }); })());
      T("open swaps: a colleague taking the asker's give-away closes the ask", (function(){
        var x=scene({market:true}); S.viewAs="s1"; offerShift("s1",D(3)); S.viewAs="s3"; claimOpenShift(S.openShifts[0].id,false);
        return !!c.assign["s3|"+D(3)] && !c.assign["s1|"+D(3)] && closedAll(x); })());
      T("open swaps: an admin letting the asker off closes the ask", (function(){
        var x=scene({market:true}); S.viewAs="s1"; askComeOff("s1",D(3),"surgery"); S.viewAs="admin"; decideComeOff(S.openShifts[0].id,true,"");
        return !c.assign["s1|"+D(3)] && closedAll(x); })());
      T("open swaps: approving leave over the day closes the ask", (function(){
        var x=scene(); S.requests=[{id:"rl1",type:"leave",from:"s1",code:"AL",dateFrom:D(2),dateTo:D(4),status:"pending",createdTs:1}];
        S.viewAs="admin"; approveRequest("rl1",""); return S.requests[0].status==="approved" && closedAll(x); })());
      T("open swaps: leave set on the planner over the day closes the ask", (function(){
        var x=scene(); S.viewAs="admin"; plannerSetLeave("s1",D(3),"AL"); return closedAll(x); })());
      T("open swaps: Remove this shift closes the ask", (function(){
        var x=scene(); S.viewAs="s1"; var ok=dropShift("s1",D(3)); return ok===true && closedAll(x); })());
      T("open swaps: unbooking the shift closes the ask too", (function(){
        var x=scene(); S.viewAs="s1"; var ok=unbookShift("s1",D(3)); return ok===true && closedAll(x); })());
      T("open swaps: an admin's cell edit that removes the shift, or moves its zone, closes the ask", (function(){
        var x=scene(); S.viewAs="admin"; setShift("s1",D(3),{kind:"off"}); var removed=closedAll(x);
        var y=scene(); S.viewAs="admin"; setShift("s1",D(3),{kind:"clinical",period:"AM",zone:"z2"}); var moved=closedAll(y);
        return removed && moved; })());
      T("open swaps: clearing the roster closes every open ask on the cycle and tells whoever offered", (function(){
        var x=scene(), other=ask({id:"sw2",from:"s4",dateA:D(9)}); S.viewAs="admin"; clearRoster();
        return x.a.status==="closed" && x.a.why==="the roster was cleared" && x.f.status==="closed" && other.status==="closed" &&
               S.notifications.some(function(n){ return n.to==="s2"&&n.text==="Alex’s swap request for "+fmtISO(D(3))+" has closed: the roster was cleared."; }); })());
      T("open swaps: a day gone only reads as closed: tidying up writes nothing for it and tells nobody", (function(){
        var x=scene(), old=ask({id:"sw0",dateA:D(-1)}), oldOffer=offer({id:"so0",openId:"sw0",by:"s3",dateB:D(6)}), stale=offer({id:"so9",by:"s3",dateB:D(-2)});
        var n=S.notifications.length; swTidy();
        return old.status==="open" && oldOffer.status==="open" && stale.status==="open" && swAskWhy(old)==="that day has passed" && swOfferWhy(stale)==="that day has passed" &&
               x.a.status==="open" && x.f.status==="open" && S.notifications.length===n; })());

      // ---- open swaps: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/sw4-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then ten `FAIL  open swaps: …` lines (one for each path), `HARNESS ERROR: @` (the last test calls `swTidy`, which does not exist yet) and `820 passed, 11 failed`.

- [ ] **Step 3: Implement.** Create `$SP/sw4-app.py`:

```python
# one sweep, called by every path that can take a shift away
rep(r'''function swCloseOffers(o,text){''', r'''function swTidy(){ const today=iso(new Date());   // after a roster change: close each ask and offer the roster no longer supports, and tell whoever offered. A day gone only reads as closed, so nothing is written for it
  (S.openSwaps||[]).forEach(o=>{ if(o.status!=="open"||o.dateA<today)return;
    const why=swAskWhy(o);
    if(why){ o.status="closed"; o.why=why; swCloseOffers(o,nameOf(o.from)+"@U@2019s swap request for "+fmtISO(o.dateA)+" has closed: "+why+"."); logAudit("swap.ask-close",nameOf(o.from)+" "+o.dateA+" @U@00b7 "+why,S.viewAs); return; }
    (S.swapOffers||[]).filter(f=>f.openId===o.id&&f.status==="open"&&f.dateB>=today).forEach(f=>{ const w=swOfferWhy(f);
      if(w){ f.status="closed"; notify(f.by,"Your offer of "+fmtISO(f.dateB)+" for "+nameOf(o.from)+"@U@2019s "+fmtISO(o.dateA)+" shift has closed: "+w+".",null,{tab:"requests",cycle:o.cycleId}); } }); }); }
function swCloseOffers(o,text){''')
rep(r'''"swap.accept":"Accepted a swap offer"};''', r'''"swap.accept":"Accepted a swap offer","swap.ask-close":"An ask for a swap was closed"};''')
# the paths: an approved swap, a claimed give-away, being let off, leave approved or planned, Remove this shift, unbooking, a cell edit
rep(r'''  notify(r.from,"Your swap with "+nameOf(r.peerId)+" was approved."''', r'''  swTidy();   // two shifts moved: close the asks and offers that stood on them
  notify(r.from,"Your swap with "+nameOf(r.peerId)+" was approved."''')
rep(r'''  o.status="claimed"; o.by=sid; o.at=Date.now();''', r'''  o.status="claimed"; o.by=sid; o.at=Date.now(); swTidy();''')
rep(r'''    delete cyc.assign[sid+"|"+o.iso];''', r'''    delete cyc.assign[sid+"|"+o.iso]; swTidy();''')
rep(r'''    addLeave({staffId:r.from,from:r.dateFrom,to:r.dateTo,code:r.code,status:"approved",requestId:id});''', r'''    addLeave({staffId:r.from,from:r.dateFrom,to:r.dateTo,code:r.code,status:"approved",requestId:id}); swTidy();''')
rep(r'''  if(code)addLeave({staffId:staffId,from:isoD,to:isoD,code:code,status:"approved",requestId:"planner"});''', r'''  if(code)addLeave({staffId:staffId,from:isoD,to:isoD,code:code,status:"approved",requestId:"planner"});
  swTidy();''')
rep(r'''    delete a[sid+"|"+isoD];
    logAudit("selfroster.unbook",nameOf(sid)+" "+isoD,S.viewAs);''', r'''    delete a[sid+"|"+isoD]; swTidy();
    logAudit("selfroster.unbook",nameOf(sid)+" "+isoD,S.viewAs);''')
rep(r'''delete a[sid+"|"+isoD]; logAudit("selfroster.unbook",nameOf(sid)+" "+isoD,sid); }''', r'''delete a[sid+"|"+isoD]; logAudit("selfroster.unbook",nameOf(sid)+" "+isoD,sid); swTidy(); }''')
rep(r'''if(sh&&sh.kind==="leave")ocClearRange(staffId,isoD,isoD); save();}''', r'''if(sh&&sh.kind==="leave")ocClearRange(staffId,isoD,isoD); swTidy(); save();}''')
# Clear the roster closes every open ask on the cycle, whatever it stood on
rep(r'''  p.offers.forEach(o=>{ if(o.status==="pending"&&o.by)notify(o.by,"The "+fmtISO(o.iso)+" "+o.period+" offer was withdrawn.",null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"}); o.status="withdrawn"; });''',
r'''  p.offers.forEach(o=>{ if(o.status==="pending"&&o.by)notify(o.by,"The "+fmtISO(o.iso)+" "+o.period+" offer was withdrawn.",null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"}); o.status="withdrawn"; });
  (S.openSwaps||[]).filter(o=>o.cycleId===c.id&&o.status==="open").forEach(o=>{ o.status="closed"; o.why="the roster was cleared"; swCloseOffers(o,nameOf(o.from)+"@U@2019s swap request for "+fmtISO(o.dateA)+" has closed: the roster was cleared."); });''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/sw4-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 11`, then `832 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js deploy/demo.html
git commit -m "Open swaps 4/6: tidying up. One sweep closes the asks and offers a roster change no longer supports and tells whoever offered; an approved swap, a claimed give-away, being let off, approved or planned leave, Remove this shift, unbooking and an admin's cell edit all call it, and Clear the roster closes its cycle's asks itself. A day already gone is never written, only read as closed

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Asking to come off with open shifts off, and Free that day

**Files:**
- Modify: `app.html` (`_offerBody`, `askComeOff`, `osActive`, `claimOpenShift`, `decideComeOff`, `dsBookedActs`, `noticeReason`, the ask dialog and the admin's two confirms in `wire()`, new `freeThatDay`/`freeThatDayHTML` before `askAdminCard`, `askAdminCard`)
- Test: `tests/suite.js` (`open swaps` block)

**Interfaces:**
- Consumes: Task 1 (`swOnRoster`, `swFree`), Task 3 (`dsBookedActs`), Task 4 (the `swTidy();` call in `decideComeOff`); `askOn(sid,isoD)`, `offeredAlready(sid,isoD)`, `e164(mobile)`, `ic("phone")`.
- Produces:
  - `_offerBody(sid,isoD,adminOnly)`: with `adminOnly`, skips the open-shifts check and refuses a second ask with `"Already asked."`.
  - An ask made while open shifts are off is `{…, kind:"ask", ask:{status:"pending",…}}` in `S.openShifts`: left out of `osActive()`, refused by `claimOpenShift` (`"That shift isn’t open to claim."`), closed (`status:"closed"`) by either decision, and never broadcast.
  - `freeThatDay(cyc,isoD) → [staff]`; `freeThatDayHTML(isoD) → html`.

- [ ] **Step 1: Write the failing tests.** Create `$SP/sw5-suite.py`:

```python
rep(r'''      // ---- open swaps: later tasks add their tests above this line''', r'''      // ---- asking to come off with open shifts switched off, and Free that day
      T("open swaps: with open shifts off, asking to come off goes to the admins alone, once, and is never listed or pushed", (function(){
        state({notice:14}); put("s1",3); put("s2",4);
        var pushed="none"; _osFlushPush=function(){ if(_osPushQueue)pushed=_osPushQueue; _osPushQueue=null; };
        var ok=askComeOff("s1",D(3),"surgery"), o=S.openShifts[0], again=askComeOff("s1",D(3),"surgery");
        S.marketOn=true; var listed=marketMyHTML(), active=osActive().length; S.marketOn=false;
        return ok===true && !!o && o.kind==="ask" && o.from==="s1" && o.status==="open" && o.ask.status==="pending" && o.ask.reason==="surgery" && again===false && said.indexOf("Already asked.")>=0 &&
               S.notifications.filter(function(n){ return n.to==="all"; }).length===0 && S.notifications.filter(function(n){ return n.to==="admin"&&/asked to come off/.test(n.text); }).length===1 &&
               pushed==="none" && active===0 && listed.indexOf(o.id)<0 && pendingAsks().length===1 && askOn("s1",D(3))===true && S.audit[0].action==="market.ask"; })());
      T("open swaps: an admins-only ask can never be claimed, even once its shift has gone", (function(){
        state({notice:14}); put("s1",3); askComeOff("s1",D(3),"surgery"); var o=S.openShifts[0];
        delete c.assign["s1|"+D(3)]; S.viewAs="s2"; var claim=claimOpenShift(o.id,false);
        return claim===false && !c.assign["s2|"+D(3)] && o.status==="open" && said.indexOf("That shift isn’t open to claim.")>=0; })());
      T("open swaps: letting someone off an admins-only ask removes the shift and tells the group nothing; keeping them on closes it without offer words", (function(){
        state({notice:14}); put("s1",3); put("s1",6); askComeOff("s1",D(3),"surgery"); askComeOff("s1",D(6),"course");
        var off=S.openShifts.find(function(o){ return o.iso===D(3); }), kept=S.openShifts.find(function(o){ return o.iso===D(6); });
        S.viewAs="admin"; var r1=decideComeOff(off.id,true,""), r2=decideComeOff(kept.id,false,"short that day");
        var toS1=S.notifications.filter(function(n){ return n.to==="s1"; }).map(function(n){ return n.text; });
        return r1===true && r2===true && !c.assign["s1|"+D(3)] && off.status==="closed" && off.ask.status==="approved" && off.kind==="ask" &&
               !!c.assign["s1|"+D(6)] && kept.status==="closed" && kept.ask.status==="declined" && S.notifications.filter(function(n){ return n.to==="all"; }).length===0 &&
               toS1.indexOf("You’re off "+fmtISO(D(3))+" — your admin let you off.")>=0 && toS1.indexOf("Your admin needs you on "+fmtISO(D(6))+". short that day")>=0 &&
               S.audit.some(function(a){ return a.action==="market.release"; }) && pendingAsks().length===0 && askOn("s1",D(6))===false; })());
      T("open swaps: inside the notice period with open shifts off, the day sheet offers Swap it and Ask to come off, then says the admin has been asked", (function(){
        state({notice:14}); put("s1",3); var before=daySheetHTML(D(3));
        askComeOff("s1",D(3),"surgery"); var after=daySheetHTML(D(3));
        return before.indexOf('data-swapit="'+D(3)+'"')>0 && before.indexOf('data-osask="'+D(3)+'"')>0 && before.indexOf("data-osoffer")<0 && before.indexOf("Swap it, or ask your admin to let you off.")>0 &&
               after.indexOf('data-osask=')<0 && after.indexOf("Your admin has been asked")>0 && after.indexOf('data-swapit="'+D(3)+'"')>0; })());
      T("open swaps: with open shifts off, the ask dialog and the admin's two confirms say it goes to the admin alone", (function(){
        state({notice:14}); put("s1",3); S.tab="selfroster"; _daySheet=D(3);
        var html="", bodies=[], qsa=document.querySelectorAll, od=openDialog, a1={dataset:{osask:D(3)}};
        openDialog=function(h){ html=h; };
        document.querySelectorAll=function(sel){ return sel==="[data-osask]"?[a1]:[]; };
        try{ render(); a1.onclick(); } finally { document.querySelectorAll=qsa; openDialog=od; }
        askComeOff("s1",D(3),"surgery"); var o=S.openShifts[0];
        S.viewAs="admin"; S.tab="requests"; _daySheet=null;
        var off={dataset:{askoff:o.id}}, kp={dataset:{askkeep:o.id}};
        openConfirm=function(x){ bodies.push(x.body); return {then:function(){}}; };
        document.querySelectorAll=function(sel){ return sel==="[data-askoff]"?[off]:(sel==="[data-askkeep]"?[kp]:[]); };
        try{ render(); off.onclick(); kp.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=keep.oc; }
        return html.indexOf("It goes to your admin, who decides.")>0 && html.indexOf("goes to the group")<0 &&
               bodies[0]==="They come off it now, and the day shows as needing cover. Nothing goes to the group." && bodies[1]==="They stay on the shift."; })());
      T("open swaps: the admin's Come off a shift card lists who is free that day, with a Call link where a mobile is on file", (function(){
        state({notice:14}); put("s1",3); put("s2",3,"PM","z2"); askComeOff("s1",D(3),"surgery");
        S.viewAs="admin"; var card=askAdminCard(S.openShifts[0]);
        c.assign["s4|"+D(3)]={kind:"leave",code:"UA"}; var ua=askAdminCard(S.openShifts[0]);
        c.roles.s3.in=false; var none=askAdminCard(S.openShifts[0]);
        return card.indexOf("<b>Free that day</b>")>0 && card.indexOf('<a class="btn sm" href="tel:+61498765432" aria-label="Call Kim">')>0 &&
               card.indexOf("Also free, no mobile on file: Jo</div>")>0 && card.indexOf("Call Alex")<0 && card.indexOf("Sam")<0 && card.indexOf("asked the admins only")>0 &&
               ua.indexOf("no mobile on file")<0 && ua.indexOf('aria-label="Call Kim"')>0 && none.indexOf("<b>Free that day</b> · nobody")>0 && none.indexOf("Call Kim")<0; })());

      // ---- open swaps: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/sw5-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then `FAIL  open swaps: with open shifts off, asking to come off goes to the admins alone, once, and is never listed or pushed`, `HARNESS ERROR: @` and `831 passed, 2 failed`.

- [ ] **Step 3: Implement.** Create `$SP/sw5-app.py`:

```python
# asking to come off works with open shifts off: the same record, kind "ask", for the admins alone
rep(r'''function _offerBody(sid,isoD){''', r'''function _offerBody(sid,isoD,adminOnly){''')
rep(r'''  if(!featOn("marketplace")||!S.marketOn)return {ok:false,reason:"Open shifts is off for this group''', r'''  if(!adminOnly&&(!featOn("marketplace")||!S.marketOn))return {ok:false,reason:"Open shifts is off for this group''')
rep(r'''  if(offeredAlready(sid,isoD))return {ok:false,reason:"Already offered."};''', r'''  if(adminOnly?askOn(sid,isoD):offeredAlready(sid,isoD))return {ok:false,reason:adminOnly?"Already asked.":"Already offered."};   // adminOnly: an ask to come off while open shifts are off, which goes to the admins alone''')
rep(r'''  return commitGuarded(()=>{ const _p=_offerBody(sid,isoD); if(!_p.ok)return _p; const cur=_p.cur;
    const why=String(reason||"").trim().slice(0,300);''', r'''  return commitGuarded(()=>{ const alone=!(featOn("marketplace")&&S.marketOn), _p=_offerBody(sid,isoD,alone); if(!_p.ok)return _p; const cur=_p.cur;   // with open shifts off the ask goes to the admins alone: never listed, never claimable, nothing broadcast
    const why=String(reason||"").trim().slice(0,300);''')
rep(r'''kind:"giveaway",from:sid,status:"open",by:null,at:null,note:"",ts:Date.now(),actor:sid,ask:{''', r'''kind:alone?"ask":"giveaway",from:sid,status:"open",by:null,at:null,note:"",ts:Date.now(),actor:sid,ask:{''')
rep(r'''    notify("all",nameOf(sid)+" needs to come off "''', r'''    if(!alone)notify("all",nameOf(sid)+" needs to come off "''')
rep(r'''    _osPushQueue={type:"post",osId:id,title:"Cover needed''', r'''    if(!alone)_osPushQueue={type:"post",osId:id,title:"Cover needed''')
rep(r'''function osActive(){ return (S.openShifts||[]).filter(o=>o.cycleId===S.activeId); }''', r'''function osActive(){ return (S.openShifts||[]).filter(o=>o.cycleId===S.activeId&&o.kind!=="ask"); }   // an ask made while open shifts were off is for the admins alone''')
rep(r'''    if(!o||o.status!=="open")return {ok:false,reason:"Someone claimed it just before you."};''', r'''    if(!o||o.status!=="open")return {ok:false,reason:"Someone claimed it just before you."};
    if(o.kind==="ask")return {ok:false,reason:"That shift isn@U@2019t open to claim."};''')
rep(r'''    if(!letOff){ o.ask.status="declined"; o.ask.note=why;
      notify(sid,"Your admin needs you on "+fmtISO(o.iso)+"."+(why?(" "+why):"")+" Your offer to the group is still open — if a colleague takes it, you@U@2019re off.",null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"});''',
r'''    const alone=o.kind==="ask";   // asked while open shifts were off: no offer stays open, and nothing goes to the group
    if(!letOff){ o.ask.status="declined"; o.ask.note=why; if(alone)o.status="closed";
      notify(sid,"Your admin needs you on "+fmtISO(o.iso)+"."+(why?(" "+why):"")+(alone?"":" Your offer to the group is still open @U@2014 if a colleague takes it, you@U@2019re off."),null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"});''')
rep(r'''    delete cyc.assign[sid+"|"+o.iso]; swTidy();
    o.ask.status="approved";''', r'''    delete cyc.assign[sid+"|"+o.iso]; swTidy();
    if(alone){ o.ask.status="approved"; o.ask.note=why; o.status="closed"; o.droppedBy=sid; o.actor="admin";   // the day shows as needing cover, like any gap
      notify(sid,"You@U@2019re off "+fmtISO(o.iso)+" @U@2014 your admin let you off."+(why?(" "+why):""),null,{tab:"my",cycle:o.cycleId});
      logAudit("market.release",nameOf(sid)+" "+o.iso+" "+zoneName(o.zone)+(why?(" @U@00b7 "+why):""),"admin"); return {ok:true}; }
    o.ask.status="approved";''')
# the day sheet, the notice words, the ask dialog and the admin's confirms
rep(r'''  return note+alone; }
function daySheetHTML(isoD){''', r'''  return note+(askOn(sid,isoD)?`<div class="note">${ic("check")} Your admin has been asked @U@2014 you@U@2019re on it until they answer.</div>`+alone:`<div class="dsact">${swapIt}<button class="btn" data-osask="${isoD}">Ask to come off</button></div>`); }   // open shifts off: asking goes to the admins alone
function daySheetHTML(isoD){''')
rep(r'''+". Offer it to the group, or ask your admin to let you off."; }''', r'''+". "+((featOn("marketplace")&&S.marketOn)?"Offer it to the group, or ask your admin to let you off.":"Swap it, or ask your admin to let you off."); }''')
rep(r'''        <div class="sub">It goes to the group at the same time, so a colleague can take it before your admin needs to decide.</div>''', r'''        <div class="sub">${(featOn("marketplace")&&S.marketOn)?"It goes to the group at the same time, so a colleague can take it before your admin needs to decide.":"It goes to your admin, who decides."}</div>''')
rep(r'''body:"They come off it now. It stays with the group as an open shift until someone claims it."''', r'''body:o.kind==="ask"?"They come off it now, and the day shows as needing cover. Nothing goes to the group.":"They come off it now. It stays with the group as an open shift until someone claims it."''')
rep(r'''body:"They stay on the shift. Their offer to the group stays open, so a colleague can still take it."''', r'''body:o.kind==="ask"?"They stay on the shift.":"They stay on the shift. Their offer to the group stays open, so a colleague can still take it."''')
# Free that day, on the admin's card
rep(r'''function askAdminCard(o){''', r'''function freeThatDay(cyc,isoD){ return S.staff.filter(s=>swOnRoster(cyc,s.id)&&swFree(cyc,s.id,isoD)); }   // on this cycle's roster, with no shift and no leave that day
function freeThatDayHTML(isoD){ const free=freeThatDay(active(),isoD), call=free.filter(s=>e164(s.mobile)), rest=free.filter(s=>!e164(s.mobile));   // who an admin could ring (the Staff page already shows admins these numbers): one button each, so a long list stays short on a phone
  return `<div class="small" style="margin-top:8px"><b>Free that day</b>${free.length?"":" @U@00b7 nobody"}</div>`
    +(call.length?`<div class="dsact">${call.map(s=>`<a class="btn sm" href="tel:${e164(s.mobile)}" aria-label="Call ${escapeHTML(s.name)}">${ic("phone")} ${escapeHTML(s.name)}</a>`).join("")}</div>`:"")
    +(rest.length?`<div class="small muted">${call.length?"Also free, no mobile on file: ":"No mobile on file: "}${escapeHTML(rest.map(s=>s.name).join(", "))}</div>`:""); }
function askAdminCard(o){''')
rep(r'''offered to the group</div>
    <div class="small muted">Reason: ${escapeHTML(o.ask.reason)}</div>''', r'''${o.kind==="ask"?"asked the admins only":"offered to the group"}</div>
    <div class="small muted">Reason: ${escapeHTML(o.ask.reason)}</div>''')
rep(r'''    <div class="flexbtns" style="margin-top:10px"><button class="btn" data-askkeep="${o.id}">Keep them on</button>''', r'''    ${freeThatDayHTML(o.iso)}
    <div class="flexbtns" style="margin-top:10px"><button class="btn" data-askkeep="${o.id}">Keep them on</button>''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/sw5-app.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 19`, then `838 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html tests/suite.js deploy/demo.html
git commit -m "Open swaps 5/6: asking to come off works with open shifts switched off. It goes to the admins alone, is never listed or claimable, and letting someone off removes the shift without telling the group; inside the notice period the day sheet offers Swap it and Ask to come off, and the notice words, the ask dialog and the admin's confirms say what happens. The admin's Come off a shift card lists who is free that day, with a call button where a mobile is on file

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Release: prove the guards, docs, check it in the browser, and ship

**Files:**
- Modify: `app.html` (`WHATS_NEW`; Help's "Swap or Open shift" answer), `tests/suite.js`, `CHANGELOG.md`, `deploy/app.html`, `preview.html`, `deploy/demo.html`, `docs/superpowers/specs/2026-09-14-open-swaps-design.md`

- [ ] **Step 1: Write the failing test for the release copy.** Create `$SP/sw6-suite.py`:

```python
rep(r'''      // ---- open swaps: later tasks add their tests above this line''', r'''      // ---- release
      T("open swaps: Help's swap answer and the release note both name Ask everyone", (function(){
        state({market:true}); S.tab="help"; var hh=viewHelp();
        return hh.indexOf("Swap or Open shift")>0 && hh.indexOf("<b>Ask everyone</b>")>0 && hh.indexOf("trade with a named colleague")<0 && hh.indexOf("the same number of shifts")<0 &&
               WHATS_NEW[0].title==="Swap without naming a colleague" && WHATS_NEW[0].lines.join(" ").indexOf("Ask everyone")>=0; })());

      // ---- open swaps: later tasks add their tests above this line''')
```

```bash
python3 $SP/rep.py tests/suite.js $SP/sw6-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `FAIL  open swaps: Help's swap answer and the release note both name Ask everyone` and `838 passed, 1 failed`.

- [ ] **Step 2: Write What's new, Help's answer and the changelog.** The release note is dated the day it ships; every date below assumes 15 Sep 2026. If the release is on another day, change `2026-09-15` in `WHATS_NEW` and `const BUILD="2026-09-15";` in `app.html` to that date, and the changelog heading to match (a lint keeps all three equal). Create `$SP/sw6-app.py`:

```python
rep(r'''const WHATS_NEW=[{on:"2026-09-10",''', r'''const WHATS_NEW=[{on:"2026-09-15",title:"Swap without naming a colleague",lines:["Request a swap now has Ask everyone: colleagues free that day offer a shift, you pick one, and your admin approves.","Swap it sits on the day sheet of every shift you have booked.","Asking to come off works with open shifts switched off too, and goes to your admin."]},{on:"2026-09-10",''')
rep(r'''trade with a named colleague''', r'''trade, with a named colleague or with whoever answers <b>Ask everyone</b>''')
rep(r'''you both work the same number of shifts, just on different days (Requests''', r'''each of you works the other@U@2019s shift, and every offer says what it counts (Requests''')
```

And `$SP/sw6-changelog.py` (if Steps 3 and 4 report a different pass count or mutation count from 839 and 90, put the real ones in its last line):

```python
rep(r'''# Myrosta — changelog

''', r'''# Myrosta — changelog

## 15 Sep 2026 — Swaps: ask everyone

- **A swap no longer needs one named colleague.** Requests → Request a swap offers two choices: **With a colleague**, the form as before, and **Ask everyone**. Asking everyone reaches only the colleagues who could take the shift: free that day, with a shift of their own on a later day when the asker is free. They hear in the app, and on their phone where alerts are on, never by text. Asked for by SWIFT, whose consultants could not complete a swap without choosing someone first.
- **Colleagues answer under Swaps wanted.** Each offers one of their own shifts, labelled with its zone, type and what it counts (for example "Fri 6 Nov · Resus Full · counts 2"), and can change or withdraw it. The asker sees the offers under Asking everyone and accepts one. Accepting checks both shifts again and becomes an ordinary swap, already agreed, on the admin's card with the tag "via Ask everyone"; approving and declining work exactly as before. The other offers close, and everyone who offered is told.
- **Swap it** sits on the day sheet of every shift a consultant has booked, beside Remove this shift, or inside the notice period beside Offer it to the group and Ask to come off, and opens the same swap screen with that shift already chosen. The chosen shift now also survives picking a colleague, which used to reset it.
- **Nothing stale can be accepted.** An ask holds only while its day is to come, the roster is live and the asker still has exactly that shift; an offer holds only while both people are still free and the colleague still has the shift offered. That is worked out each time either is shown, and again inside the accept. An approved swap, a claimed give-away, being let off, approved or planned leave, Remove this shift, an admin's cell edit and Clear the roster each close what stood on the shift and tell whoever offered. A day gone simply reads as closed.
- **Asking to come off works with open shifts switched off.** It then goes to the admins alone: it is never listed and cannot be claimed, and letting someone off removes the shift without telling the group, so the day shows as needing cover. Inside the notice period the day sheet offers Swap it and Ask to come off. The admin's Come off a shift card lists who is free that day, with a Call link where a mobile is on file.
- Named swaps and the Edge Functions are unchanged. 839 passes, 90 mutations, all killed.

''')
```

```bash
python3 $SP/rep.py app.html $SP/sw6-app.py
python3 $SP/rep.py CHANGELOG.md $SP/sw6-changelog.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed|PASS  build"
```

Expected: `replacements: 3`, `replacements: 1`, then `PASS  build: the constants are dated and the note has three site-neutral lines`, `PASS  build: BUILD and What's new match the changelog's latest heading` and `839 passed, 0 failed`.

- [ ] **Step 3: Prove every guard is tested.** Create `$SP/sw-mutate.py`. Each mutation breaks one rule in a copy of the app's script; the suite must fail on every copy.

```python
import pathlib, re, subprocess, tempfile, os
from concurrent.futures import ThreadPoolExecutor
root = pathlib.Path("/Users/ranjithkandavelu/Desktop/Claude/Myrosta")
html = (root / "app.html").read_text(encoding="utf-8")
def edge_src():
    ics = (root / "supabase/functions/ics/index.js").read_text(encoding="utf-8"); ics = ics[:ics.index("/* ---------------- HTTP handler")]
    ics = "\n".join(l for l in ics.split("\n") if not l.startswith("import ")).replace("export function buildICS", "function buildICS")
    ns = (root / "supabase/functions/notify-shifts/index.ts").read_text(encoding="utf-8")
    b = re.sub(r"\?:\s*any\b|:\s*any\[\]|:\s*any\b", "", ns[ns.index("// ---- pure:"):ns.index("// ---- end pure ----")])
    return "var ICSFN=(function(){\n" + ics + "\nreturn {buildICS:buildICS};})();\nvar REMINDFN=(function(){\n" + b + "\nreturn {reminderFor:reminderFor};})();\n"
head = (root / "tests/stubs.js").read_text(encoding="utf-8")
tail = "\n" + (root / "tests/oncall-golden.js").read_text(encoding="utf-8") + "\n" + edge_src() + (root / "tests/suite.js").read_text(encoding="utf-8")
BS = chr(92)
MUTS=[
 # task 1: records and rules
 ("merge: arrays merged whole", 'openShifts:null,openSwaps:null,swapOffers:null,', 'openShifts:null,'),
 ("offerable: roster ignored", 'if(!c||!swOnRoster(c,sid)||!swFree(c,sid,o.dateA))return [];', 'if(!c||!swFree(c,sid,o.dateA))return [];'),
 ("offerable: busy on the day", 'if(!c||!swOnRoster(c,sid)||!swFree(c,sid,o.dateA))return [];', 'if(!c||!swOnRoster(c,sid))return [];'),
 ("offerable: past days", '.filter(d=>d>=today).map(d=>({d:d,shift:swShiftOf(c,sid,d)}))', '.map(d=>({d:d,shift:swShiftOf(c,sid,d)}))'),
 ("offerable: asker busy on E", '.filter(x=>x.shift&&swFree(c,o.from,x.d)); }', '.filter(x=>x.shift); }'),
 ("free: approved leave ignored", 'return !(v&&v.kind&&v.kind!=="off")&&!leaveOn(sid,isoD); }', 'return !(v&&v.kind&&v.kind!=="off"); }'),
 ("free: only clinical counts", 'return !(v&&v.kind&&v.kind!=="off")&&!leaveOn(sid,isoD); }', 'return !(v&&v.kind==="clinical")&&!leaveOn(sid,isoD); }'),
 ("roster: non-clinical", 'return !!s&&isClinical(s)&&!!r&&r.in!==false; }', 'return !!s&&!!r&&r.in!==false; }'),
 ("roster: no entry", 'return !!s&&isClinical(s)&&!!r&&r.in!==false; }', 'return !!s&&isClinical(s)&&!(r&&r.in===false); }'),
 ("roster: in false", 'return !!s&&isClinical(s)&&!!r&&r.in!==false; }', 'return !!s&&isClinical(s)&&!!r; }'),
 ("ask why: done", '  if(o.status==="done")return "a swap was agreed";\n', ''),
 ("ask why: not live", '  const c=swCycleOf(o); if(!swLive(c))return "the roster is not live";', '  const c=swCycleOf(o);'),
 ("live: archived", 'function swLive(cyc){ return !!cyc&&!cyc.archived&&cyc.status!=="draft"; }', 'function swLive(cyc){ return !!cyc&&cyc.status!=="draft"; }'),
 ("live: draft", 'function swLive(cyc){ return !!cyc&&!cyc.archived&&cyc.status!=="draft"; }', 'function swLive(cyc){ return !!cyc&&!cyc.archived; }'),
 ("ask why: passed", '  if(o.dateA<iso(new Date()))return "that day has passed";\n', ''),
 ("ask why: leave", '||leaveOn(o.from,o.dateA))return "the shift has changed";', ')return "the shift has changed";'),
 ("same: period", 'return !!a&&!!b&&a.period===b.period&&a.zone===b.zone&&', 'return !!a&&!!b&&a.zone===b.zone&&'),
 ("same: zone", 'return !!a&&!!b&&a.period===b.period&&a.zone===b.zone&&', 'return !!a&&!!b&&a.period===b.period&&'),
 ("same: type", '&&(a.type||null)===(b.type||null); }', '; }'),
 ("offer why: status", '  if(f.status!=="open")return f.status==="accepted"', '  if(false)return f.status==="accepted"'),
 ("offer why: passed", '  if(f.dateB<iso(new Date()))return "that day has passed";\n', ''),
 ("offer why: shift moved", '  if(!swSame(swShiftOf(c,f.by,f.dateB),f.shift))return "the offered shift has changed";\n', ''),
 ("offer why: roster", '  if(!swOnRoster(c,f.by))return nameOf(f.by)+" is no longer on this roster";\n', ''),
 ("offer why: asker busy", '  if(!swFree(c,o.from,f.dateB))return nameOf(o.from)+" is no longer free on "+fmtISO(f.dateB);\n', ''),
 ("offer why: colleague busy", '  if(!swFree(c,f.by,o.dateA))return nameOf(f.by)+" is no longer free on "+fmtISO(o.dateA);\n  return ""; }\nfunction swShiftText', '  return ""; }\nfunction swShiftText'),
 # task 2: the flow
 ("ask: anyone may ask", 'if(isAdmin()||sid!==S.viewAs)return {ok:false,reason:"Only the person on the shift can ask everyone."};', ''),
 ("ask: not live", '  if(!swLive(c))return "This roster isn@U@2019t live yet.";\n', ''),
 ("ask: passed", '  if(!isoD||isoD<iso(new Date()))return "That day has passed.";\n', ''),
 ("ask: no clinical shift", '  if(!swShiftOf(c,sid,isoD))return "No clinical shift to swap that day.";\n', ''),
 ("ask: second ask", '&&swAskWhy(o)===""))return "You@U@2019re already asking everyone about that shift.";', '&&false))return "You@U@2019re already asking everyone about that shift.";'),
 ("ask: nobody", 'if(!who.length)return {ok:false,reason:"Nobody is free on "', 'if(false)return {ok:false,reason:"Nobody is free on "'),
 ("ask: push to all", 'Tap to offer one of your shifts.",targets:who};', 'Tap to offer one of your shifts.",targets:null};'),
 ("offer: closed ask", 'const why=swAskWhy(o); if(why)return {ok:false,reason:"That swap request is closed: "+why+"."};', 'const why="";'),
 ("offer: any shift", 'const pick=swOfferable(o,me).find(x=>x.d===isoB);', 'const pick=swOfferable(o,me).find(x=>true);'),
 ("offer: always new", 'mine=S.swapOffers.find(f=>f.openId===o.id&&f.by===me&&f.status==="open");', 'mine=null;'),
 ("offer withdraw: not theirs", 'if(!f||f.by!==S.viewAs)return {ok:false,reason:"That offer isn@U@2019t yours."};', 'if(!f)return {ok:false,reason:"That offer isn@U@2019t yours."};'),
 ("offer withdraw: twice", 'if(f.status!=="open")return {ok:false,reason:"That offer is already closed."};', ''),
 ("accept: anyone", 'if(o.from!==S.viewAs)return {ok:false,reason:"Only "+nameOf(o.from)+" can accept an offer for their shift."};', ''),
 ("accept: stale", 'const why=swOfferWhy(f); if(why)return {ok:false,reason:"That offer can@U@2019t be accepted: "+why+"."};', 'const why="";'),
 ("accept: others stay open", '    swCloseOffers(o,nameOf(o.from)+" found a swap for "', '    if(0)swCloseOffers(o,nameOf(o.from)+" found a swap for "'),
 ("ask withdraw: not theirs", 'if(!o||o.from!==S.viewAs)return {ok:false,reason:"That swap request isn@U@2019t yours."};', 'if(!o)return {ok:false,reason:"That swap request isn@U@2019t yours."};'),
 ("ask withdraw: twice", 'if(o.status!=="open")return {ok:false,reason:o.status==="done"?"You already accepted an offer.":"That swap request is already closed."};', ''),
 # task 3: screens
 ("swap it: someone else's day", 'swapIt=(sid===S.viewAs&&isoD>=iso(new Date()))', 'swapIt=(isoD>=iso(new Date()))'),
 ("swap it: past day", 'swapIt=(sid===S.viewAs&&isoD>=iso(new Date()))', 'swapIt=(sid===S.viewAs)'),
 ("all form: past shifts", 'mine=staffAssignments(me).filter(x=>x.date>=today&&swShiftOf(c,me,x.date));', 'mine=staffAssignments(me).filter(x=>swShiftOf(c,me,x.date));'),
 ("all form: cst shifts", 'mine=staffAssignments(me).filter(x=>x.date>=today&&swShiftOf(c,me,x.date));', 'mine=staffAssignments(me).filter(x=>x.date>=today);'),
 ("all form: never disabled", 'id="swAsk"${n?"":" disabled"}>', 'id="swAsk">'),
 ("wanted: shown to all", '    if(!mine&&!can.length)return "";\n', ''),
 ("wanted: closed asks", 'o.cycleId===c.id&&swAskWhy(o)==="").map', 'o.cycleId===c.id).map'),
 ("asking: accept on stale", '${w?"":`<button class="btn primary sm" data-swaccept="${f.id}">Accept</button>`}', '${`<button class="btn primary sm" data-swaccept="${f.id}">Accept</button>`}'),
 ("admin tag always", '${r.openId?\'<span class="tag muted">via Ask everyone</span>\':""}', '<span class="tag muted">via Ask everyone</span>'),
 ("swap it: no shift chosen", '_swapMine=b.dataset.swapit; swapPeer=null;', 'swapPeer=null;'),
 ("sheet: choice forgets the shift", 'const swm=document.getElementById("swMine"); if(swm)swm.onchange=()=>{ _swapMine=swm.value||null;', 'const swm=document.getElementById("swMine"); if(swm)swm.onchange=()=>{'),
 ("sheet: switch forgets the shift", 'const m=document.getElementById("swMine"); if(m&&m.value)_swapMine=m.value; _swapMode=', 'const m=document.getElementById("swMine"); _swapMode='),
 ("sheet: peer form not preselected", '<option value="${x.date}"${x.date===_swapMine?" selected":""}>', '<option value="${x.date}">'),
 ("wanted: other cycles", "const rows=(S.openSwaps||[]).filter(o=>o.cycleId===c.id&&swAskWhy(o)", "const rows=(S.openSwaps||[]).filter(o=>swAskWhy(o)"),
 ("asking: past asks", 'o.cycleId===c.id&&o.status==="open"&&o.dateA>=today);', 'o.cycleId===c.id&&o.status==="open");'),
 ("asking: offers under a closed ask", '    if(why)return head;\n', ''),
 ("close offers: re-closes withdrawn", 'filter(f=>f.openId===o.id&&f.status==="open").forEach(f=>{ f.status="closed"; notify(f.by,text', 'filter(f=>f.openId===o.id).forEach(f=>{ f.status="closed"; notify(f.by,text'),
 # task 4: tidying up
 ("tidy: approveSwap", '  swTidy();   // two shifts moved', '  // two shifts moved'),
 ("tidy: claim", 'o.status="claimed"; o.by=sid; o.at=Date.now(); swTidy();', 'o.status="claimed"; o.by=sid; o.at=Date.now();'),
 ("tidy: let off", 'delete cyc.assign[sid+"|"+o.iso]; swTidy();', 'delete cyc.assign[sid+"|"+o.iso];'),
 ("tidy: leave approved", 'requestId:id}); swTidy();', 'requestId:id});'),
 ("tidy: planner", 'requestId:"planner"});\n  swTidy();', 'requestId:"planner"});'),
 ("tidy: drop", 'delete a[sid+"|"+isoD]; swTidy();\n', 'delete a[sid+"|"+isoD];\n'),
 ("tidy: unbook", 'nameOf(sid)+" "+isoD,sid); swTidy(); }', 'nameOf(sid)+" "+isoD,sid); }'),
 ("tidy: setShift", 'ocClearRange(staffId,isoD,isoD); swTidy(); save();}', 'ocClearRange(staffId,isoD,isoD); save();}'),
 ("tidy: clear roster", '(S.openSwaps||[]).filter(o=>o.cycleId===c.id&&o.status==="open").forEach(o=>{ o.status="closed"; o.why="the roster was cleared";', '(S.openSwaps||[]).filter(o=>false).forEach(o=>{ o.status="closed"; o.why="the roster was cleared";'),
 ("tidy: writes past asks", 'if(o.status!=="open"||o.dateA<today)return;', 'if(o.status!=="open")return;'),
 ("tidy: writes past offers", 'f.status==="open"&&f.dateB>=today).forEach', 'f.status==="open").forEach'),
 # task 5: asking to come off with open shifts off, free that day
 ("ask body: needs open shifts", 'if(!adminOnly&&(!featOn("marketplace")||!S.marketOn))', 'if((!featOn("marketplace")||!S.marketOn))'),
 ("ask body: asks twice", 'if(adminOnly?askOn(sid,isoD):offeredAlready(sid,isoD))', 'if(offeredAlready(sid,isoD))'),
 ("ask: listed kind", 'kind:alone?"ask":"giveaway"', 'kind:"giveaway"'),
 ("ask: tells all", 'if(!alone)notify("all",nameOf(sid)+" needs to come off "', 'notify("all",nameOf(sid)+" needs to come off "'),
 ("ask: pushes", 'if(!alone)_osPushQueue={type:"post"', '_osPushQueue={type:"post"'),
 ("osActive: lists asks", '&&o.kind!=="ask"); }', '); }'),
 ("claim: asks claimable", '    if(o.kind==="ask")return {ok:false,reason:"That shift isn@U@2019t open to claim."};\n', ''),
 ("keep: stays open", 'o.ask.note=why; if(alone)o.status="closed";', 'o.ask.note=why;'),
 ("keep: offer words", '(alone?"":" Your offer to the group is still open', '(" Your offer to the group is still open'),
 ("let off: broadcast", '    if(alone){ o.ask.status="approved";', '    if(false){ o.ask.status="approved";'),
 ("sheet: asks again", 'return note+(askOn(sid,isoD)?', 'return note+(false?'),
 ("notice words", '((featOn("marketplace")&&S.marketOn)?"Offer it to the group, or ask your admin to let you off.":', '(true?"Offer it to the group, or ask your admin to let you off.":'),
 ("dialog words", '${(featOn("marketplace")&&S.marketOn)?"It goes to the group at the same time', '${true?"It goes to the group at the same time'),
 ("confirm off words", 'body:o.kind==="ask"?"They come off it now, and the day', 'body:false?"They come off it now, and the day'),
 ("confirm keep words", 'body:o.kind==="ask"?"They stay on the shift.":', 'body:false?"They stay on the shift.":'),
 ("card words", '${o.kind==="ask"?"asked the admins only":"offered to the group"}', 'offered to the group'),
 ("free: roster", 'S.staff.filter(s=>swOnRoster(cyc,s.id)&&swFree(cyc,s.id,isoD));', 'S.staff.filter(s=>swFree(cyc,s.id,isoD));'),
 ("free: busy", 'S.staff.filter(s=>swOnRoster(cyc,s.id)&&swFree(cyc,s.id,isoD));', 'S.staff.filter(s=>swOnRoster(cyc,s.id));'),
 ("free: no call link", 'call=free.filter(s=>e164(s.mobile)), rest=', 'call=[], rest='),
 ("free: no names without a mobile", 'rest=free.filter(s=>!e164(s.mobile));', 'rest=[];'),
]
def run(m):
    name, old, new = m; old = old.replace("@U@", BS + "u"); new = new.replace("@U@", BS + "u")
    if html.count(old) != 1: return name, "NOT APPLIED (found %d)" % html.count(old)
    app = max(re.findall(r"<script>(.*?)</script>", html.replace(old, new), re.S), key=len)
    fd, p = tempfile.mkstemp(suffix=".js"); os.close(fd); pathlib.Path(p).write_text(head + app + tail, encoding="utf-8")
    r = subprocess.run(["osascript", "-l", "JavaScript", p], capture_output=True, text=True); os.unlink(p)
    text = (r.stdout or "") + (r.stderr or "")
    broke = "PASS" not in text or "FAIL" in text or "HARNESS" in text
    return name, ("KILLED" if broke else "SURVIVED")
with ThreadPoolExecutor(6) as ex:
    res = list(ex.map(run, MUTS))
for name, r in res: print(r.ljust(24), name)
print("TOTAL", len(res), "killed", sum(1 for _, r in res if r == "KILLED"))
```

```bash
python3 $SP/sw-mutate.py
```

Expected: every line reads `KILLED`, and `TOTAL 90 killed 90`. A `SURVIVED` line means a rule with no test: write the test that kills it, commit it on its own, and run the mutations again. A `NOT APPLIED` line means the code differs from the plan: read the spot, correct the mutation's old text, and run again.

- [ ] **Step 4: Sync the deployed copies and rebuild the demo.**

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

Expected: `synced deploy/app.html and preview.html`, then `839 passed, 0 failed` for both `app.html` and `deploy/app.html`.

- [ ] **Step 5: Check it in the browser.** (This needs the Browser pane, so the controller does it; an implementer without one skips it and says so.) Start the `landing` preview (it serves `deploy/`) and open `http://localhost:8899/demo.html`. The demo keeps its data in the browser, so clear the site's local storage first. As the demo consultant:
  1. Book shifts, then a booked day from tomorrow on: the sheet shows **Swap it** beside **Remove this shift**.
  2. **Swap it** opens Requests with the swap sheet, that shift chosen, on **With a colleague**. Switch to **Ask everyone**: the line says how many colleagues it goes to. Add a note and press **Ask everyone**: an **Asking everyone** card shows the shift with No offers yet.
  3. View as one of the colleagues it reached: **Swaps wanted** lists the ask, with Offer a shift and what each shift counts. Send an offer: the row says You offered, with Change offer and Withdraw.
  4. View as the consultant again: the offer has **Accept**. Accept and confirm: the request is Pending under Your requests.
  5. View as the admin: the swap card carries **via Ask everyone**. Approve it: the two shifts move on the roster.
  6. At phone width (375 px), check the Swaps wanted card, and an admin's Come off a shift card (ask to come off as a consultant first): nothing runs off the screen, and Free that day stays short.
  7. Read the browser console: no errors.

  Take a screenshot of the swap sheet on Ask everyone, and one of the admin's card.

- [ ] **Step 6: Record what was built.** Create `$SP/sw6-spec.py`:

```python
rep(r'''**Status:** approved in conversation, awaiting written review''', r'''**Status:** approved 15 Sep 2026''')
rep(r'''- Safe-hours checks on swaps. Named swaps do not check them today either, and the admin approves every swap.
''', r'''- Safe-hours checks on swaps. Named swaps do not check them today either, and the admin approves every swap.

## As built, 15 Sep 2026

Plan: `docs/superpowers/plans/2026-09-15-open-swaps.md`, six commits. Decisions taken while building:

- **Both sides of a swap are clinical shifts.** Swap it sits on a clinical shift, and a non-clinical day offered back would be no cover and count nothing.
- **The rules are pure functions over the roster** (`swOfferable`, `swWho`, `swAskWhy`, `swOfferWhy`), read on every screen and again inside every write. A colleague with no entry in the cycle's roles is not on its roster, as the rest of the app already treats them.
- **Requests shows the cycle on screen**, like open shifts. Every notification carries its cycle, so a tap switches there.
- **One sweep, `swTidy()`, does the explicit closes.** `approveSwap`, `_osExecute`, `decideComeOff`, `approveRequest`, `plannerSetLeave`, `dropShift`, `unbookShift` and `setShift` (the cell dialog and the day sheet's own writes) call it, and it skips a day already gone. Clear the roster closes its cycle's asks with its own reason. The asker is not told when their own ask closes; whoever offered is.
- **The swap sheet starts on With a colleague** and keeps the chosen shift in `_swapMine` across re-renders, so picking a colleague no longer resets it.
- **Offers name the zone** as well as the type and what they count, like the named-swap form.
- **Asking to come off with open shifts off** is the same record with `kind:"ask"`: `osActive` leaves it out, `claimOpenShift` refuses it, and `_offerBody` takes an `adminOnly` flag. Clear the roster withdraws it as it withdraws open shifts.
- **Free that day** shows one call button per person with a mobile on file and one line for the rest, so a long list stays short on a phone.
- **The tab wiring lint also reads** `dsBookedActs`, `reqSheetHTML`, `swapAllFormHTML`, `swapAskingHTML` and `swapWantedHTML`.
- **Help's swap answer names Ask everyone.**
''')
```

```bash
python3 $SP/rep.py docs/superpowers/specs/2026-09-14-open-swaps-design.md $SP/sw6-spec.py
```

Expected: `replacements: 2`.

- [ ] **Step 7: Commit the release.**

```bash
git add CHANGELOG.md app.html tests/suite.js deploy/app.html preview.html deploy/demo.html docs/superpowers/specs/2026-09-14-open-swaps-design.md
git commit -m "Open swaps 6/6: release notes, a What's new note and Help's swap answer name Ask everyone; the deployed copies are synced; the spec is marked approved with its As built section. Every guard mutation-proven. Nothing to paste into Supabase

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git log --oneline -8
```

Tell the owner: push `main` from GitHub Desktop. No Edge Function paste is needed. The swap pages of the SWIFT staff and admin guides (in `~/Desktop/Myrosta site 2/go-live/source/guides/`, outside the repo) then get rewritten to match.

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| Swap it on the day sheet beside Remove this shift, or beside Offer it to the group and Ask to come off inside the notice period; Swap it and Ask to come off with open shifts off | 3, 5 |
| Requests → Request a swap opens the same screen; the shift preselected from a day sheet; With a colleague unchanged; Ask everyone with a note, who it reaches, and the button off when nobody qualifies | 3 |
| Who can offer: on the roster, not the asker, free on the day (UA included), a shift on a day to come when the asker is free | 1 |
| Only colleagues who qualify are told, in the app and by phone alert, never by text | 2 |
| Swaps wanted with the note; offerable shifts labelled with what they count; one offer each, changed or withdrawn while open | 2 (rules), 3 (screen) |
| The asker's offers with Accept; accepting re-checks and creates the pending swap with `peerAgreed` and `openId`; done, accepted, the others closed; the colleague, the other offerers and the admins told | 2, 3 |
| Withdraw closes the ask and its offers and tells everyone who offered | 2, 3 |
| The admin: approve and decline unchanged; declining or cancelling never reopens; the card tagged via Ask everyone | 2, 3 |
| Validity read on every display and inside the accept; a stale ask or offer reads as closed with its reason | 1, 2, 3 |
| Explicit closes: withdraw, accept, an approved swap on either shift, a claimed give-away, being let off, leave approved or planned, Remove this shift, an admin's cell edit, Clear the roster; a day gone reads as closed with no write | 2, 4 |
| Asking to come off with open shifts off: `kind:"ask"`, never listed or claimable, admins only; Keep them on or Let them off; letting off removes the shift and broadcasts nothing | 5 |
| Free that day on the admin's Come off a shift card, with a Call link where a mobile is on file | 5 |
| Data: both arrays in `ID_ARRAYS`, out of `S.requests`, written through `commitGuarded`; the six audit keys; Prepare next cycle copies neither | 1, 2, 4 |
| Compatibility: named swaps unchanged; an older copy keeps the arrays; Edge Functions untouched | every task's test run; Global Constraints |
| Testing: every item in the spec's list, the lints, and each guard mutation-tested | 1–5 (tests), 3 (wiring lint), 6 (mutations) |
| Docs: CHANGELOG and a What's new note; the SWIFT guides outside the repo | 6 |
