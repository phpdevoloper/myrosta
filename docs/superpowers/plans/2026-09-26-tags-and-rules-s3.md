# Tags on people, rules on slots (S3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin tag people (a grade, a credential), let a cycle say that a slot needs a tag or that each half of a day needs at least so many holders of one, and have every way a shift changes hands obey that — with the reason said, the admin able to override behind a warning, and a shortfall shown as a gap.

**Architecture:** Two pure functions carry all the behaviour. `ruleJudge(cyc,st,sid,isoD,fills,zoneId,o)` answers "may this person take this slot on this day" from the state it is given, and `ruleBreaches(cyc,st,isoD)` lists what a day is short of. Six sites ask the judge (booking, batch picks, claims and give-aways, swaps as a pair, the admin's cell editor as a warning, the auto-draft); the gaps display reads the breach list. Tags live on the group (`S.tags`) and on the person (`person.tags`); rules live on the cycle (`cyc.settings.rules`). All three shapes are absent until an admin creates something, so a group that switches nothing on stores, syncs and exports exactly what it does today.

**Tech Stack:** Single-file vanilla JS app (`app.html`), tests under JavaScriptCore via `osascript` (`python3 tests/run.py`), Python lints in `tests/run.py`, the demo built by `tools/build-demo.py`. No SQL, no Edge Function.

**Spec:** `docs/superpowers/specs/2026-09-21-tags-and-rules-s3-design.md` (read it first; this plan argues from it). Programme: `docs/superpowers/specs/2026-09-16-staff-group-modules-programme.md`.

## Global Constraints

- **No tags and no rules means no change.** `ruleJudge` returns `{ok:true}` without reading anything else, `ruleBreaches` returns `[]`, `normalize()` seeds nothing new, and the payroll rows, the roster export and the department digest are byte-identical with and without tags. Every existing test passes unchanged.
- **Rules on the cycle, attributes on the person, tags on the group.** `S.tags=[{id,name,show}]` (`show` omitted when off; the whole key deleted when the list empties), `person.tags=[tagId,…]` (the key is **deleted** when the last tag goes — never written as `[]`), `cyc.settings.rules={needs:{[zoneId]:[tagId,…]},mins:[{tag,n:{AM:[wd,we,ph],PM:[wd,we,ph]}}]}` (empty `needs`/`mins` omitted, an empty `rules` deleted).
- **The judge runs after every check that exists today** (leave, already working, the booking gate, fatigue, zone taken, headcount, unlock order) **and before turn, wave and quota.** None of the existing checks change.
- **Held places use the largest shortfall, never the sum.** Refuse only when `open − 1 < worst`.
- **Nothing is ever deleted over a tag rule:** not by `_mergeInvariants`, not by a lost tag, not by a fixed pattern. A breach is shown, never auto-removed. Coming off a shift and leave are never judged.
- **Tags never leave the group.** `buildDigest` is not touched; a test pins that the digest carries no tag. Badges appear only on this group's own screens.
- The Edge Functions (`supabase/functions/*`) are not edited. Nothing calls notify-shifts.
- Every `logAudit` call passes its key as a **string literal first argument**, and every key has an `AUDIT_WORDS` sentence. New keys: `tags.add`, `tags.rename`, `tags.remove`, `tags.show`, `tags.person`, `tags.import`, `rules.needs`, `rules.mins`, `rules.override`.
- Copy: plain words, sentence case, no emoji or arrow glyphs inside buttons, notes or tags (a lint checks this). Every name is rendered through `escapeHTML`.
- Test dates are relative to today (`iso(addDays(new Date(),n))`). Never hardcode a future date.
- `deploy/demo.html` must equal what `python3 tools/build-demo.py` produces from the current `app.html` (a lint checks this), so run the build before the tests in every task. `deploy/app.html` and `preview.html` are synced in Task 8.
- `tests/oncall-golden.js` must pass unchanged and is **never regenerated** to make a test pass.
- SWIFT's files in `~/Desktop/Myrosta site 2/` hold personal data and never enter the repo.
- Commit on `main`; do not push (the owner pushes from GitHub Desktop).

## Decisions this plan takes where the spec is silent or over-specified

1. **The cell editor's warning is a `confirm()`**, like every other admin confirmation in the app, wrapped in `adminPlaceCheck(sid,isoD,sh)` so the suite can drive it (the modal's own buttons are not reachable under the test DOM). The override audit line is written only when the placement goes through.
2. **The auto-draft's choice is a pure function** `ruleDraftPick(cyc,st,isoD,period,pool,free)`: it tries holders of the tag the half is short of first (largest shortfall first, pool order within), then anyone, and places each in the first free zone the judge accepts; with no rules it returns the first person and the first free zone, which is today's behaviour by construction.
3. **The swap judge is one function** `ruleSwapJudge(st,cA,a,dateA,shA,cB,b,dateB,shB)` returning `""` or a sentence, asked from `swOfferable` (so a shift that would break a rule is not offered), `swOfferWhy` (the reason a standing offer reads as closed — and `swapOffer` and `swapAccept` both read it again inside their guarded write, so an offer that no longer passes cannot be accepted) and `executeSwap` (so a named swap is re-judged at approval, like every other check there). Either direction of the same pair gives the same answer.
4. **Gap rows for tags carry `kind:"min"` or `kind:"needs"`**; cover rows carry no `kind`. A needs row counts as one in the header's total.
5. **The open-shift line reads "needs 1 Senior"** (a number, because it may be 2), computed when shown.
6. **Tags with Show ticked appear** beside names on the Day board rows and its assign list, and next to "Taken by ⟨name⟩" on the day sheet; the Staff tab shows every tag as a chip whatever the tick.
7. **The Rules card's summary sentences:** "⟨Zone⟩ needs ⟨Tag⟩ and ⟨Tag⟩." per zone; "At least n ⟨Tag⟩ every AM and PM." when all six numbers agree; "At least a ⟨Tag⟩ every AM, b every PM." when each row agrees; otherwise the non-zero cells: "At least 1 Senior on weekday AMs, 2 Senior on weekend PMs."
8. **The release note is dated 26 Sep 2026.** If the release ships on another day, change `2026-09-26` in `WHATS_NEW`, `const BUILD` and the changelog heading together (a lint keeps them equal).

## How to edit `app.html`, `tests/suite.js` and the docs

`app.html` is one large file with very long lines, and much of its script writes characters as JavaScript escapes (a backslash, `u`, four hex digits). Tool parameters can silently turn those escapes into the characters themselves, so an exact-match edit then fails, or writes the wrong thing. Make every edit through this helper, and write each such escape as `@U@` followed by the four hex digits (`@U@2019` for a right single quote, `@U@2014` for an em dash, `@U@2013` for an en dash, `@U@00b7` for a middle dot, `@U@2026` for an ellipsis, `@U@2192` for an arrow, `@U@2212` for a minus sign). The helper swaps `@U@` for backslash-u in both the old and the new text.

- [ ] **Create the helper once**, in your scratchpad directory (called `$SP` below):

```python
# file: rep.py
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

An edits file is plain Python calling `rep(old, new)`; both arguments are raw triple-quoted strings. If `rep.py` stops with "expected 1, found 0", nothing was written: re-read that spot of the file and correct the old text; never loosen the count. Every code block below that begins `# file: NAME` is saved as `$SP/NAME` exactly as printed.

**If `python3` or `git` stops with "You have not agreed to the Xcode license agreements"**, follow the memory note `reference-xcode-licence-workaround`, or ask the owner to run `sudo xcodebuild -license accept`.

- [ ] **Create the sync helper once**, also in `$SP`. The site serves `deploy/`, and a lint fails whenever `deploy/app.html` is not `app.html` byte for byte or `preview.html` is not `app.html` with the cloud blanked, so every task runs it before the tests and commits both copies:

```python
# file: sync.py
# $SP/sync.py  —  run from the repo root after any app.html change
import pathlib, re
root = pathlib.Path(".").resolve()
app = (root / "app.html").read_text(encoding="utf-8")
(root / "deploy" / "app.html").write_text(app, encoding="utf-8")
m = re.search(r'const CLOUD=\{ url:"[^"]*", key:"[^"]*",', app); assert m, "CLOUD line not found"
(root / "preview.html").write_text(app.replace(m.group(0), 'const CLOUD={ url:"", key:"",', 1), encoding="utf-8")
print("synced deploy/app.html and preview.html")
```

**Running the tests:** always `python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"`. The last line reads `N passed, M failed  (app.html)`; a `HARNESS ERROR:` line means the suite threw before it finished and the count is meaningless. Before Task 1 the suite reads `915 passed, 0 failed`.

---

### Task 1: Data, accessors, the judge and the breach list — with the matrix

**Files:**
- Modify: `app.html` (a new section before the department-digest section; nine `AUDIT_WORDS` keys)
- Test: `tests/suite.js` (new `tags and rules` block, inserted before the suite's closing render line)

**Interfaces:**
- Consumes: `fillsOf(cyc,sh)`, `typeById(cyc,id)`, `zoneLabelFor(cyc,z,sh)`, `parseISO`, `fmtISO`.
- Produces (all take their state explicitly): `tagList(st)`, `tagById(st,id)`, `tagName(st,id)`, `personTags(st,p)`, `hasTag(st,p,id)`, `rulesOf(cyc)` → `{needs,mins}`, `rulesPresent(cyc)`, `dayType(st,isoD)` → `0|1|2`, `minFor(m,period,dt)`, `capOf(cyc,st,period)`, `ruleCounts(cyc,st,isoD,o)` → `{AM:[{sid,p,zone}],PM:[…]}`, `ruleShort(cyc,st,isoD,period,booked)` → `[{tag,need,have,short}]` in tag-list order, `ruleJudge(cyc,st,sid,isoD,fills,zoneId,o)` → `{ok:true}` or `{ok:false,rule:"needs"|"held",tag,reason}`, `ruleBreaches(cyc,st,isoD)` → `[{kind:"min",period,tag,need,have}|{kind:"needs",period,zone,sid,tag}]`.

- [ ] **Step 1: Write the failing tests.** Save as `$SP/s3-1-suite.py`:

```python
# file: s3-1-suite.py
rep(r'''  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''', r'''  // ---- tags on people, rules on slots (S3): a tag is a label on a person; a cycle may say a slot needs a tag, or that a half-day needs at least N holders of one.
  // Spec: docs/superpowers/specs/2026-09-21-tags-and-rules-s3-design.md. Dates are relative to today; the judge and the breach list are pure.
  (function(){
    var keep={S:S,dd:dailyDate,ds:dailyScope,sf:_staffFilter,sq:_staffQuery,pick:_srPick,sid:_srSid,sheet:_daySheet,mob:isMobile,cf:confirm,toast:toast,fp:_fpReport,dl:download};
    var D=function(n){ return iso(addDays(new Date(),n)); }, T0=D(0);
    var c=null, said=[];
    function wd(n){ var d=parseISO(D(n)).getDay(); return d===0||d===6; }   // is D(n) a weekend day
    function nextWeekday(n){ while(wd(n))n++; return n; }
    function nextWeekend(n){ while(!wd(n))n++; return n; }
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Triage",am:true,pm:true,pmLabel:""},{id:"z2",name:"Resus",am:true,pm:true,pmLabel:""},{id:"z3",name:"Fast track",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:3,pmMin:0,pmMax:3},unlockOrder:"both",rosterMode:"rolling",shiftTimes:{AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:"22:00"}}};   // extras open together and the evening has no minimum: a third morning booking reaches the judge, not the unlock rule
      S={zones:Z,staffing:set.staffing,
         staff:[{id:"s1",name:"Ava Ng",quota:20,eft:1,tags:["t1","t2"]},{id:"s2",name:"Sam Lee",quota:20,eft:1,tags:["t1"]},{id:"s3",name:"Ky Tran",quota:20,eft:1,tags:["t2"]},{id:"s4",name:"Jo Park",quota:20,eft:1},{id:"s5",name:"Lee Ann",quota:20,eft:1}],
         tags:[{id:"t1",name:"Senior"},{id:"t2",name:"Triage-trained"}],
         cycles:[{id:"cr",cycle:{start:D(-7),weeks:6},status:o.status||"published",archived:false,settings:set,roles:{s1:{in:true},s2:{in:true},s3:{in:true},s4:{in:true},s5:{in:true}},assign:{}}],
         activeId:"cr",viewAs:o.viewAs||"admin",tab:"my",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],publicHolidays:[]};
      if(o.noTags){ delete S.tags; S.staff.forEach(function(s){ delete s.tags; }); }
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srPick=[]; _srSid=null; _daySheet=null; dailyScope="group"; dailyDate=null; _staffFilter="all"; _staffQuery="";
      if(!o.noRules)c.settings.rules={needs:{z1:["t2"]},mins:[{tag:"t1",n:{AM:[1,1,1],PM:[1,1,1]}}]}; }
    function put(sid,n,period,zone,type){ var v={kind:"clinical",period:period||"AM",zone:zone||"z2"}; if(type)v.type=type; c.assign[sid+"|"+D(n)]=v; return v; }
    isMobile=function(){ return false; }; toast=function(m){ said.push(String(m)); };
    try{
      // ---- data, accessors, the judge and the breach list
      T("rules: with no tags and no rules the judge says yes, the breach list is empty, and nothing new is written", (function(){
        state({noTags:true,noRules:true}); put("s4",2,"AM","z1"); var j=JSON.stringify(S);
        return ruleJudge(c,S,"s5",D(2),["AM"],"z1",null).ok===true && ruleBreaches(c,S,D(2)).length===0 && j.indexOf('"tags"')<0 && j.indexOf('"rules"')<0 && JSON.stringify(rulesOf(c))==='{"needs":{},"mins":[]}' && tagList(S).length===0; })());
      T("rules: accessors keep list order, drop ids the list no longer has, and capOf is the smaller of the maximum and the open zones", (function(){
        state(); S.staff[0].tags=["t2","gone","t1"];
        var a=personTags(S,S.staff[0]).join(",")==="t1,t2" && hasTag(S,S.staff[0],"t2") && !hasTag(S,S.staff[3],"t1") && tagName(S,"t2")==="Triage-trained" && tagName(S,"gone")==="";
        c.settings.staffing.amMax=5; c.settings.staffing.pmMax=3; c.settings.zones[2].pm=false;
        return a && capOf(c,S,"AM")===3 && capOf(c,S,"PM")===2 && dayType(S,D(nextWeekday(2)))===0 && dayType(S,D(nextWeekend(2)))===1; })());
      T("rules: a slot that needs a tag refuses whoever lacks it and names the slot and the tag; two tags means both; a tag the list no longer has is ignored", (function(){
        state(); var r1=ruleJudge(c,S,"s4",D(2),["AM"],"z1",null), r2=ruleJudge(c,S,"s3",D(2),["AM"],"z1",null), r3=ruleJudge(c,S,"s1",D(2),["AM"],"z1",null);
        c.settings.rules.needs.z1=["t1","t2"]; var r4=ruleJudge(c,S,"s3",D(2),["AM"],"z1",null), r5=ruleJudge(c,S,"s1",D(2),["AM"],"z1",null);
        c.settings.rules.needs.z1=["gone"]; var r6=ruleJudge(c,S,"s4",D(2),["AM"],"z1",null);
        return !r1.ok && r1.rule==="needs" && r1.tag==="t2" && r1.reason==="Triage needs Triage-trained." && r2.ok && r3.ok && !r4.ok && r4.tag==="t1" && r4.reason==="Triage needs Senior." && r5.ok && r6.ok; })());
      T("rules: held places — the last open place is kept for a holder, an earlier place is not, and a holder always fits", (function(){
        state(); var out=[]; var J=function(sid){ return ruleJudge(c,S,sid,D(2),["AM"],"z2",null); };
        out.push(J("s4").ok);
        put("s4",2,"AM","z2"); out.push(J("s5").ok);
        put("s5",2,"AM","z3"); var r=J("s3"); out.push(!r.ok && r.rule==="held" && r.tag==="t1" && /^Held for a Senior @U@2014 .* AM still needs 1, and this is the last place\.$/.test(r.reason));
        out.push(J("s2").ok);
        c.settings.rules.mins[0].n.AM=[2,2,2]; c.assign={}; out.push(J("s4").ok);
        put("s4",2,"AM","z2"); var r2=J("s5"); out.push(!r2.ok && /only 2 places are left\.$/.test(r2.reason));
        out.push(J("s2").ok);
        return out.every(Boolean); })());
      T("rules: two tags short at once — the largest shortfall, never the sum, and the earlier tag on a tie", (function(){
        state(); c.settings.rules.mins=[{tag:"t1",n:{AM:[1,1,1],PM:[1,1,1]}},{tag:"t2",n:{AM:[1,1,1],PM:[1,1,1]}}]; c.settings.staffing.amMax=2;
        var a=ruleJudge(c,S,"s4",D(2),["AM"],"z2",null);
        put("s4",2,"AM","z2"); var b=ruleJudge(c,S,"s5",D(2),["AM"],"z3",null), b2=ruleJudge(c,S,"s3",D(2),["AM"],"z3",null), b3=ruleJudge(c,S,"s2",D(2),["AM"],"z3",null), b4=ruleJudge(c,S,"s1",D(2),["AM"],"z3",null);
        return a.ok && !b.ok && b.tag==="t1" && !b2.ok && b2.tag==="t1" && !b3.ok && b3.tag==="t2" && b4.ok; })());
      T("rules: a whole-day shift is judged in both halves and counts toward the minimum in both", (function(){
        state(); c.settings.shiftTypes=shiftTypesOf(c).concat([{id:"full",code:"FULL",label:"Full",start:"10:00",end:"22:00",fills:["AM","PM"],on:true,book:true,builtin:null}]);
        put("s2",2,"AM","z2"); var a=ruleJudge(c,S,"s4",D(2),["AM","PM"],"z3",{type:"full"});
        put("s5",2,"PM","z3"); put("s3",2,"PM","z2"); var b=ruleJudge(c,S,"s4",D(2),["AM","PM"],"z1",{type:"full"});
        c.settings.rules.needs={}; var b2=ruleJudge(c,S,"s4",D(2),["AM","PM"],"z1",{type:"full"});
        c.assign={}; c.assign["s1|"+D(3)]={kind:"clinical",period:"AM",zone:"z2",type:"full"};
        return a.ok && !b.ok && b.rule==="needs" && !b2.ok && b2.rule==="held" && /PM still needs 1/.test(b2.reason) && ruleBreaches(c,S,D(3)).length===0; })());
      T("rules: weekday, weekend and public holiday each read their own number, and a public holiday on a Saturday is a public holiday", (function(){
        state(); c.settings.rules.mins=[{tag:"t1",n:{AM:[1,2,3],PM:[0,0,0]}}]; var sat=2; while(parseISO(D(sat)).getDay()!==6)sat++; var sun=sat+1, wk=nextWeekday(2);
        S.publicHolidays=[D(sat)]; var need=function(n){ var b=ruleBreaches(c,S,D(n)).filter(function(x){ return x.kind==="min"; })[0]; return b?b.need:0; };
        return dayType(S,D(sat))===2 && dayType(S,D(sun))===1 && dayType(S,D(wk))===0 && need(wk)===1 && need(sun)===2 && need(sat)===3 && ruleBreaches(c,S,D(wk)).every(function(x){ return x.period==="AM"; }); })());
      T("rules: without makes a person absent, with makes the other half of a swap present", (function(){
        state(); put("s2",2,"AM","z2"); put("s4",2,"AM","z3");
        var a=ruleJudge(c,S,"s5",D(2),["AM"],"z1",null);
        c.settings.rules.needs={}; var b=ruleJudge(c,S,"s5",D(2),["AM"],"z1",null);
        var d=ruleJudge(c,S,"s5",D(2),["AM"],"z1",{without:["s2"]});
        var e=ruleJudge(c,S,"s5",D(2),["AM"],"z1",{without:["s2"],with:[{sid:"s3",fills:["AM"],zone:"z2"}]});
        return !a.ok && a.rule==="needs" && b.ok && d.ok && !e.ok && e.rule==="held"; })());
      T("rules: the breach list reads AM before PM, minimums before slots, in tag then zone order", (function(){
        state(); put("s4",2,"AM","z1"); put("s3",2,"PM","z2");
        var b=ruleBreaches(c,S,D(2)); return b.length===3 && b[0].kind==="min" && b[0].period==="AM" && b[0].tag==="t1" && b[0].need===1 && b[0].have===0 && b[1].kind==="needs" && b[1].period==="AM" && b[1].zone==="z1" && b[1].sid==="s4" && b[1].tag==="t2" && b[2].kind==="min" && b[2].period==="PM"; })());
      T("rules: the payroll rows, the roster export and the digest do not move by a byte when tags and rules exist, and no tag reaches the digest", (function(){
        var grab=function(){ var x=null; download=function(s){ if(x===null)x=String(s); }; try{ exportRosterXLS(); }catch(e){} download=keep.dl; return [JSON.stringify(payrollRows()), x, stableJSON(buildDigestAll(S,T0))]; };
        state({noTags:true,noRules:true}); put("s1",2,"AM","z1"); put("s2",3,"PM","z2"); put("s4",4,"AM","z3"); var a=grab();
        state(); put("s1",2,"AM","z1"); put("s2",3,"PM","z2"); put("s4",4,"AM","z3"); S.tags[0].show=true; var b=grab();
        return a[0]===b[0] && a[1]===b[1] && a[2]===b[2] && a[0].length>20 && b[2].indexOf("Senior")<0 && b[2].indexOf("tags")<0; })());
      T("rules: the merge leaves a breach in place and does not throw when rules are present", (function(){
        state(); put("s4",2,"AM","z1"); var out=JSON.parse(JSON.stringify(S)); var ok=true; try{ _mergeInvariants(out); }catch(e){ ok=false; }
        return ok && !!out.cycles[0].assign["s4|"+D(2)] && !(out.audit||[]).some(function(a){ return a.action==="merge.fix"; }); })());
      T("rules: every new audit key has a plain-word sentence", ["tags.add","tags.rename","tags.remove","tags.show","tags.person","tags.import","rules.needs","rules.mins","rules.override"].every(function(k){ return typeof AUDIT_WORDS[k]==="string" && AUDIT_WORDS[k].length>5; }));

      // ---- tags and rules: later tasks add their tests above this line
    } finally { S=keep.S; dailyDate=keep.dd; dailyScope=keep.ds; _staffFilter=keep.sf; _staffQuery=keep.sq; _srPick=keep.pick; _srSid=keep.sid; _daySheet=keep.sheet; isMobile=keep.mob; confirm=keep.cf; toast=keep.toast; _fpReport=keep.fp; download=keep.dl; /* tags and rules: restore */ hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/s3-1-suite.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then a `HARNESS ERROR:` line — the block's first assertion calls `ruleJudge`, which does not exist yet, so the suite throws before it finishes.

- [ ] **Step 3: Implement.** Save as `$SP/s3-1-app.py`:

```python
# file: s3-1-app.py
rep(r'''"cycle.status":"Changed the roster status",''', r'''"cycle.status":"Changed the roster status","tags.add":"Added a tag","tags.rename":"Renamed a tag","tags.remove":"Removed a tag","tags.show":"Changed whether a tag shows on the roster","tags.person":"Changed someone's tags","tags.import":"Created tags from the staff list","rules.needs":"Changed which slots need a tag","rules.mins":"Changed the minimum holders of a tag","rules.override":"Placed someone against a rule",''')
rep(r'''/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''',
r'''/* ---------- tags on people, rules on slots: a tag is a label on a person; a cycle may say a slot needs a tag, or that each half of a day needs at least N holders of one ----------
   Everything here takes its state explicitly (st = the group's record, cyc = the cycle judged), so the merge, a screen and a cycle that is not on screen get the same answer.
   Absent until an admin creates something: with no tags and no rules the judge says yes without reading anything else, and nothing new is written. */
function tagList(st){ return Array.isArray(st&&st.tags)?st.tags.filter(t=>t&&t.id):[]; }   // the group's tags, in the order they are shown everywhere
function tagById(st,id){ return tagList(st).find(t=>t.id===id)||null; }
function tagName(st,id){ const t=tagById(st,id); return t?String(t.name||""):""; }
function personTags(st,p){ const ids=(p&&Array.isArray(p.tags))?p.tags:[]; return tagList(st).filter(t=>ids.indexOf(t.id)>=0).map(t=>t.id); }   // only tags the list still has, in list order
function hasTag(st,p,id){ return personTags(st,p).indexOf(id)>=0; }
function rulesOf(cyc){ const r=(cyc&&cyc.settings&&cyc.settings.rules)||{}; return {needs:(r.needs&&typeof r.needs==="object")?r.needs:{},mins:Array.isArray(r.mins)?r.mins:[]}; }   // always an object with both parts
function rulesPresent(cyc){ const r=rulesOf(cyc); return Object.keys(r.needs).some(z=>Array.isArray(r.needs[z])&&r.needs[z].length>0)||r.mins.length>0; }
function dayType(st,isoD){ if(((st&&st.publicHolidays)||[]).indexOf(isoD)>=0)return 2; const w=parseISO(isoD).getDay(); return (w===0||w===6)?1:0; }   // exactly one per date: a public holiday on a Saturday is a public holiday
function minFor(m,period,dt){ const n=m&&m.n&&m.n[period]; const v=Array.isArray(n)?+n[dt]:0; return (isFinite(v)&&v>0)?Math.floor(v):0; }   // 0 or blank means no minimum in that cell
function capOf(cyc,st,period){ const sg=(cyc&&cyc.settings&&cyc.settings.staffing)||(st&&st.staffing)||{}; const zs=(cyc&&cyc.settings&&cyc.settings.zones)||(st&&st.zones)||[];
  const mx=period==="AM"?sg.amMax:sg.pmMax, open=zs.filter(z=>period==="AM"?z.am:z.pm).length; return Math.min(mx==null?99:+mx,open); }   // the places a half really has: the maximum, or the zones open then, whichever is smaller
function ruleCounts(cyc,st,isoD,o){   // who is booked in each half of isoD in this cycle: people whose clinical shift fills it, less o.without, plus o.with
  o=o||{}; const out={AM:[],PM:[]}, skip=o.without||[], a=(cyc&&cyc.assign)||{}, staff=(st&&st.staff)||[];
  Object.keys(a).forEach(k=>{ const v=a[k]; if(!v||v.kind!=="clinical")return; const i=k.indexOf("|"); if(k.slice(i+1)!==isoD)return; const sid=k.slice(0,i); if(skip.indexOf(sid)>=0)return;
    const p=staff.find(x=>x.id===sid)||null; fillsOf(cyc,v).forEach(f=>{ if(out[f])out[f].push({sid:sid,p:p,zone:v.zone}); }); });
  (o.with||[]).forEach(w=>{ const p=staff.find(x=>x.id===w.sid)||null; (w.fills||[]).forEach(f=>{ if(out[f])out[f].push({sid:w.sid,p:p,zone:w.zone||null}); }); });
  return out; }
function ruleShort(cyc,st,isoD,period,booked){   // per minimum, in tag-list order: how many holders that half still lacks
  const r=rulesOf(cyc), dt=dayType(st,isoD), order=tagList(st).map(t=>t.id);
  return r.mins.filter(m=>m&&order.indexOf(m.tag)>=0).sort((x,y)=>order.indexOf(x.tag)-order.indexOf(y.tag)).map(m=>{ const need=minFor(m,period,dt), have=booked.filter(b=>b.p&&hasTag(st,b.p,m.tag)).length; return {tag:m.tag,need:need,have:have,short:Math.max(0,need-have)}; }); }
function ruleJudge(cyc,st,sid,isoD,fills,zoneId,o){   // may this person take this slot on this day? {ok:true}, or {ok:false, rule:"needs"|"held", tag, reason}
  o=o||{}; if(!rulesPresent(cyc))return {ok:true};
  const p=((st&&st.staff)||[]).find(x=>x.id===sid)||null, r=rulesOf(cyc);
  const need=(r.needs[zoneId]||[]).filter(t=>tagById(st,t)), miss=need.find(t=>!hasTag(st,p,t));
  if(miss){ const z=(((cyc&&cyc.settings&&cyc.settings.zones)||(st&&st.zones)||[]).find(x=>x.id===zoneId)), zl=z?zoneLabelFor(cyc,z,{kind:"clinical",period:(fills&&fills[0])||"AM",type:o.type}):"That slot";
    return {ok:false,rule:"needs",tag:miss,reason:zl+" needs "+tagName(st,miss)+"."}; }   // rule 1: the slot needs a tag this person lacks
  const counts=ruleCounts(cyc,st,isoD,{without:(o.without||[]).concat([sid]),with:o.with});
  for(let i=0;i<(fills||[]).length;i++){ const P=fills[i]; if(!counts[P])continue; const booked=counts[P], open=capOf(cyc,st,P)-booked.length; let worst=null;
    ruleShort(cyc,st,isoD,P,booked).forEach(s=>{ const short=Math.max(0,s.need-(s.have+(hasTag(st,p,s.tag)?1:0))); if(short>0&&(!worst||short>worst.short))worst={tag:s.tag,short:short}; });   // the largest shortfall, never the sum: one person can hold several tags; ties go to the earlier tag
    if(worst&&open-1<worst.short){ const pl=(typeById(cyc,P)||{}).label||P;
      return {ok:false,rule:"held",tag:worst.tag,reason:"Held for a "+tagName(st,worst.tag)+" @U@2014 "+fmtISO(isoD)+" "+pl+" still needs "+worst.short+", and "+(open<=1?"this is the last place.":"only "+open+" places are left.")}; } }   // rule 2: the last places are held for holders
  return {ok:true}; }
function ruleBreaches(cyc,st,isoD){   // what a day is short of, in a fixed order: AM before PM; minimums before slots; tag-list order; zone order. Callers decide which dates to ask about
  if(!rulesPresent(cyc))return []; const out=[], counts=ruleCounts(cyc,st,isoD,null), r=rulesOf(cyc), zs=(cyc&&cyc.settings&&cyc.settings.zones)||(st&&st.zones)||[];
  ["AM","PM"].forEach(P=>{ const booked=counts[P];
    ruleShort(cyc,st,isoD,P,booked).forEach(s=>{ if(s.need>0&&s.have<s.need)out.push({kind:"min",period:P,tag:s.tag,need:s.need,have:s.have}); });
    zs.forEach(z=>{ const need=(r.needs[z.id]||[]).filter(t=>tagById(st,t)); if(!need.length)return;
      booked.filter(b=>b.zone===z.id).forEach(b=>{ const miss=need.find(t=>!hasTag(st,b.p,t)); if(miss)out.push({kind:"needs",period:P,zone:z.id,sid:b.sid,tag:miss}); }); }); });
  return out; }
/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/s3-1-app.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 2`, then `927 passed, 0 failed` and no lint line.

- [ ] **Step 5: Commit.**

```bash
git add app.html deploy/app.html preview.html deploy/demo.html tests/suite.js
git commit -q -m "Tags and rules: the data shapes, the accessors, ruleJudge (a slot that needs a tag; the last places held for holders — the largest shortfall, never the sum) and ruleBreaches, all from the state they are given; nothing changes for a group with no tags" && git log --oneline -1
```

---

### Task 2: Booking, batch picks, claims and give-aways ask the judge

**Files:**
- Modify: `app.html` (`canBook`, `canClaim`)
- Test: `tests/suite.js` (the `tags and rules` block)

**Interfaces:**
- Consumes: `ruleJudge` (Task 1); `pickCheck` and `srBatchBook` go through `canBook` unchanged; `claimOpenShift` and `approveClaim` go through `canClaim` unchanged.
- Produces: nothing new. `canBook` asks the judge after the unlock-order check and before turn, wave and quota; `canClaim` asks it after the fatigue check with the giver in `without`, before quota.

- [ ] **Step 1: Write the failing tests.** Save as `$SP/s3-2-suite.py`:

```python
# file: s3-2-suite.py
rep(r'''      // ---- tags and rules: later tasks add their tests above this line''', r'''      // ---- booking, batch picks, claims
      T("booking: canBook refuses a barred slot and a held place with the judge's sentence, after the checks that exist today and before quota", (function(){
        state(); var a=canBook("s4",D(2),"AM","z1"), b=canBook("s1",D(2),"AM","z2");
        put("s4",2,"AM","z2"); put("s5",2,"AM","z3"); var d=canBook("s3",D(2),"AM","z1"), e=canBook("s1",D(2),"AM","z1"), f=canBook("s1",D(2),"AM","z2");
        S.staff[0].quota=0; c.roles.s1.quota=0; hydrateCycleRoles(); var g=canBook("s1",D(3),"AM","z1");
        return !a.ok && a.reason==="Triage needs Triage-trained." && b.ok && !d.ok && /^Held for a Senior/.test(d.reason) && e.ok && !f.ok && /taken/.test(f.reason) && g.ok; })());
      T("booking: a pick on the sheet is judged like a booking, and a batch confirm books what passes and says why the rest did not", (function(){
        state(); put("s4",2,"AM","z2"); put("s5",2,"AM","z3"); _srSid="s3"; S.viewAs="s3";
        var p=pickCheck("s3",D(2),"AM","z1"); _srPick=[D(2)+"|AM|z1",D(3)+"|AM|z1"]; srBatchBook(); var f=window._srBatchFail||[];
        return !p.ok && /^Held for a Senior/.test(p.reason) && !c.assign["s3|"+D(2)] && !!c.assign["s3|"+D(3)] && c.assign["s3|"+D(3)].zone==="z1" && f.length===1 && /Held for a Senior/.test(f[0]); })());
      T("claims: the last open place is held for a holder, a give-away counts its giver as gone, and an approval re-runs the judge and reopens", (function(){
        state(); S.marketOn=true; put("s4",2,"AM","z3"); put("s5",2,"AM","z1"); postOpenShift(D(2),"AM","z2",""); var o=S.openShifts[0];
        var a=canClaim("s3",D(2),"AM","z2",true,null,null), b=canClaim("s2",D(2),"AM","z2",true,null,null);
        state(); S.marketOn=true; c.settings.staffing.amMax=2; put("s1",3,"AM","z2"); put("s4",3,"AM","z3"); S.viewAs="s1"; offerShift("s1",D(3)); var g=S.openShifts[0];
        var d=canClaim("s5",D(3),"AM","z2",false,"s1",null); S.viewAs="s5"; var d2=claimOpenShift(g.id,false), gs=g.status; S.viewAs="s2"; var e=claimOpenShift(g.id,false), e2=c.assign["s2|"+D(3)], e3=c.assign["s5|"+D(3)];   // read before the next state() rebuilds the cycle
        state(); S.marketOn=true; S.marketClaim="approve"; postOpenShift(D(4),"AM","z2",""); var q=S.openShifts[0]; S.viewAs="s4"; var h=claimOpenShift(q.id,false), hs=q.status;
        S.viewAs="admin"; put("s5",4,"AM","z3"); put("s3",4,"AM","z1"); var k=approveClaim(q.id,true), k2=canClaim("s4",D(4),"AM","z2",true,null,null);
        return !a.ok && /^Held for a Senior/.test(a.reason) && b.ok && !d.ok && /^Held for a Senior/.test(d.reason) && d2===false && gs==="open" && e===true && !!e2 && e2.zone==="z2" && !e3 &&
               h===true && hs==="pending" && k===false && !k2.ok && /Held for a Senior/.test(k2.reason) && said.some(function(m){ return /Reopened/.test(m); }) && q.status==="open" && q.by===null && !c.assign["s4|"+D(4)]; })());

      // ---- tags and rules: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/s3-2-suite.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then three `FAIL  booking:`/`claims:` lines and `927 passed, 3 failed`.

- [ ] **Step 3: Implement.** Save as `$SP/s3-2-app.py`:

```python
# file: s3-2-app.py
rep(r'''  const u=periodsUnlocked(isoD,_fills,sid);if(!u.ok)return u;
''', r'''  const u=periodsUnlocked(isoD,_fills,sid);if(!u.ok)return u;
  const _rj=ruleJudge(_cy,S,sid,isoD,_fills,zoneId,{type:typeId}); if(!_rj.ok)return {ok:false,reason:_rj.reason};   // a slot that needs a tag, or a place held for holders: after every check above, before turn, wave and quota
''')
rep(r'''  if(!bypassQuota){ const st=S.staff.find(x=>x.id===sid), q=st?(+st.quota||0):0;''', r'''  const _rj=ruleJudge(_cy,S,sid,isoD,want,zoneId,{type:typeId,without:giveFrom?[giveFrom]:[]}); if(!_rj.ok)return {ok:false,reason:_rj.reason};   // the giver of a give-away is already gone; an approval re-runs this, as it re-runs every other check
  if(!bypassQuota){ const st=S.staff.find(x=>x.id===sid), q=st?(+st.quota||0):0;''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/s3-2-app.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 2`, then `930 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html deploy/app.html preview.html deploy/demo.html tests/suite.js
git commit -q -m "Tags and rules: booking, the sheet's picks and batch confirm, open-shift claims and give-aways ask the judge — refused with its sentence after every existing check, the giver counted as gone, an approval re-judged and reopened" && git log --oneline -1
```

---

### Task 3: Swaps are judged as a pair

**Files:**
- Modify: `app.html` (a new `ruleSwapJudge` beside `swOfferable`; `swOfferable`, `swOfferWhy`, `executeSwap`)
- Test: `tests/suite.js` (the `tags and rules` block)

**Interfaces:**
- Consumes: `ruleCounts`, `ruleShort`, `rulesOf`, `rulesPresent`, `tagById`, `hasTag`, `tagName` (Task 1); `swShiftOf`, `swFree`, `swOnRoster`, `fillsOf`, `zoneLabelFor`, `fmtISO`, `nameOf`.
- Produces: `ruleSwapJudge(st,cA,a,dateA,shA,cB,b,dateB,shB)` → `""` when the pair may swap, else one sentence: either person lands in a slot they lack a tag for, or a half would end shorter of a tag than it is now. Asked by `swOfferable` (a shift that would break it is not offered), `swOfferWhy` (why a standing offer reads as closed) and `executeSwap` (a named swap re-judged at approval).

- [ ] **Step 1: Write the failing tests.** Save as `$SP/s3-3-suite.py`:

```python
# file: s3-3-suite.py
rep(r'''      // ---- tags and rules: later tasks add their tests above this line''', r'''      // ---- swaps
      T("swaps: a swap is judged as a pair in both directions — refused when a half would be shorter of a tag or someone lands in a slot they lack a tag for, allowed when it is no worse", (function(){
        state(); put("s1",3,"AM","z2"); put("s4",4,"AM","z2"); put("s2",5,"AM","z3"); put("s1",6,"AM","z1"); put("s4",7,"AM","z2");
        var a=executeSwap({from:"s1",dateA:D(3),peerId:"s4",dateB:D(4)}), b=executeSwap({from:"s4",dateA:D(4),peerId:"s1",dateB:D(3)});
        var d=executeSwap({from:"s1",dateA:D(6),peerId:"s4",dateB:D(7)}), e=executeSwap({from:"s4",dateA:D(7),peerId:"s1",dateB:D(6)});
        var f=executeSwap({from:"s1",dateA:D(3),peerId:"s2",dateB:D(5)});
        return !a.ok && /short of a Senior\.$/.test(a.reason) && !b.ok && /short of a Senior\.$/.test(b.reason) && !d.ok && /Jo Park can@U@2019t take Triage on .* it needs Triage-trained\.$/.test(d.reason) && !e.ok && /Jo Park can@U@2019t take Triage/.test(e.reason) &&
               f.ok && c.assign["s2|"+D(3)].zone==="z2" && c.assign["s1|"+D(5)].zone==="z3" && !c.assign["s1|"+D(3)] && !c.assign["s2|"+D(5)]; })());
      T("swaps: Ask everyone offers only shifts that keep every half whole, and a standing offer reads as closed with that reason", (function(){
        state(); put("s1",3,"AM","z2"); put("s4",4,"AM","z2"); put("s2",5,"AM","z3"); S.viewAs="s1"; var r=swapAsk("s1",D(3),""); var o=S.openSwaps[0];
        var offer4=swOfferable(o,"s4").map(function(x){ return x.d; }), offer2=swOfferable(o,"s2").map(function(x){ return x.d; });
        S.viewAs="s2"; var so=swapOffer(o.id,D(5)); var f=S.swapOffers[0]; var before=swOfferWhy(f); S.staff[1].tags=[]; var after=swOfferWhy(f);
        return r===true && offer4.length===0 && offer2.join(",")===D(5) && so===true && before==="" && /short of a Senior$/.test(after); })());

      // ---- tags and rules: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/s3-3-suite.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then two `FAIL  swaps:` lines and `930 passed, 2 failed`.

- [ ] **Step 3: Implement.** Save as `$SP/s3-3-app.py`:

```python
# file: s3-3-app.py
rep(r'''function swOfferable(o,sid){ const c=swCycleOf(o), today=iso(new Date());   // the shifts sid could offer back: their own, on a day to come, where the asker is free
  if(!c||!swOnRoster(c,sid)||!swFree(c,sid,o.dateA))return [];
  return datesOf(c.cycle).map(iso).filter(d=>d>=today).map(d=>({d:d,shift:swShiftOf(c,sid,d)})).filter(x=>x.shift&&swFree(c,o.from,x.d)); }''',
r'''function ruleSwapJudge(st,cA,a,dateA,shA,cB,b,dateB,shB){   // a swap judged as a pair: b takes a's shift on dateA, a takes b's on dateB. "" when it may go ahead, else why not — the same answer from either side
  if(!rulesPresent(cA)&&!rulesPresent(cB))return "";
  const lands=(cyc,who,d,sh)=>{ const p=((st&&st.staff)||[]).find(x=>x.id===who)||null, need=(rulesOf(cyc).needs[(sh||{}).zone]||[]).filter(t=>tagById(st,t)), miss=need.find(t=>!hasTag(st,p,t)); if(!miss)return "";
    const z=(((cyc.settings&&cyc.settings.zones)||st.zones||[]).find(x=>x.id===sh.zone)); return nameOf(who)+" can@U@2019t take "+(z?zoneLabelFor(cyc,z,sh):"that slot")+" on "+fmtISO(d)+" @U@2014 it needs "+tagName(st,miss)+"."; };
  const worse=(cyc,d,fills,o)=>{ const before=ruleCounts(cyc,st,d,null), after=ruleCounts(cyc,st,d,o); let bad="";   // for each half and tag: the shortfall after must not exceed the shortfall before
    fills.forEach(P=>{ if(bad)return; const b0=ruleShort(cyc,st,d,P,before[P]), a0=ruleShort(cyc,st,d,P,after[P]);
      a0.forEach((s,i)=>{ if(!bad&&s.short>(b0[i]?b0[i].short:0))bad=fmtISO(d)+" "+((typeById(cyc,P)||{}).label||P)+" would be short of a "+tagName(st,s.tag)+"."; }); }); return bad; };
  return lands(cA,b,dateA,shA)||lands(cB,a,dateB,shB)||worse(cA,dateA,fillsOf(cA,shA),{without:[a,b],with:[{sid:b,fills:fillsOf(cA,shA),zone:shA.zone}]})||worse(cB,dateB,fillsOf(cB,shB),{without:[a,b],with:[{sid:a,fills:fillsOf(cB,shB),zone:shB.zone}]}); }
function swOfferable(o,sid){ const c=swCycleOf(o), today=iso(new Date());   // the shifts sid could offer back: their own, on a day to come, where the asker is free, and where the swap keeps every half whole
  if(!c||!swOnRoster(c,sid)||!swFree(c,sid,o.dateA))return [];
  const mine=swShiftOf(c,o.from,o.dateA)||o.shift;
  return datesOf(c.cycle).map(iso).filter(d=>d>=today).map(d=>({d:d,shift:swShiftOf(c,sid,d)})).filter(x=>x.shift&&swFree(c,o.from,x.d)&&!ruleSwapJudge(S,c,o.from,o.dateA,mine,c,sid,x.d,x.shift)); }''')
rep(r'''  if(!swFree(c,f.by,o.dateA))return nameOf(f.by)+" is no longer free on "+fmtISO(o.dateA);
  return ""; }''', r'''  if(!swFree(c,f.by,o.dateA))return nameOf(f.by)+" is no longer free on "+fmtISO(o.dateA);
  const rj=ruleSwapJudge(S,c,o.from,o.dateA,swShiftOf(c,o.from,o.dateA)||o.shift,c,f.by,f.dateB,f.shift); if(rj)return rj.replace(/\.$/,"");   // tags are read as they stand now
  return ""; }''')
rep(r'''  delete aA[r.from+"|"+r.dateA]; delete aB[r.peerId+"|"+r.dateB];''', r'''  const rj=ruleSwapJudge(S,cA,r.from,r.dateA,sA,cB,r.peerId,r.dateB,sB); if(rj)return {ok:false,reason:rj};   // judged as a pair, at approval, like every other check here
  delete aA[r.from+"|"+r.dateA]; delete aB[r.peerId+"|"+r.dateB];''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/s3-3-app.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 3`, then `932 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html deploy/app.html preview.html deploy/demo.html tests/suite.js
git commit -q -m "Tags and rules: a swap is judged as a pair — refused when either person lands in a slot they lack a tag for or any half would end shorter of a tag, from either side; Ask everyone offers only shifts that keep every half whole, and a standing offer says why it reads as closed" && git log --oneline -1
```

---

### Task 4: The cell editor warns and records, the auto-draft places holders first, fixed patterns are flagged

**Files:**
- Modify: `app.html` (new `adminPlaceCheck`, `adminOverrideAudit`, `ruleDraftPick` in the tags-and-rules section; `renderModal`'s Save handler; `fillPeriodTo`)
- Test: `tests/suite.js` (the `tags and rules` block)

**Interfaces:**
- Consumes: `ruleJudge`, `ruleCounts`, `ruleShort`, `rulesPresent`, `hasTag` (Task 1); `confirm`, `logAudit`, `shiftLabel`, `nameOf`, `fillsOf`.
- Produces: `adminPlaceCheck(sid,isoD,sh)` → `{ok:true,over:null}` (nothing to warn about), `{ok:false,over:null}` (the admin cancelled) or `{ok:true,over:reason}` (placed anyway); `adminOverrideAudit(sid,isoD,sh,reason)` writes `rules.override`; `ruleDraftPick(cyc,st,isoD,period,pool,free)` → `{sid,zone}` or `null`. `applyFixedPatterns` is not changed: a fixed pattern is the admin's own placement, and the breach list flags it.

- [ ] **Step 1: Write the failing tests.** Save as `$SP/s3-4-suite.py`:

```python
# file: s3-4-suite.py
rep(r'''      // ---- tags and rules: later tasks add their tests above this line''', r'''      // ---- the cell editor, the auto-draft, fixed patterns
      T("cell editor: the admin is warned with the judge's sentence and asked to place anyway; going through is written down; a placement that passes asks nothing", (function(){
        state(); var asked=[]; confirm=function(t){ asked.push(String(t)); return false; };
        var a=adminPlaceCheck("s4",D(2),{kind:"clinical",period:"AM",zone:"z1"}); confirm=function(t){ asked.push(String(t)); return true; };
        var b=adminPlaceCheck("s4",D(2),{kind:"clinical",period:"AM",zone:"z1"}); var n=asked.length; var d=adminPlaceCheck("s1",D(2),{kind:"clinical",period:"AM",zone:"z1"});
        adminOverrideAudit("s4",D(2),{kind:"clinical",period:"AM",zone:"z1"},b.over); var au=S.audit[0];
        return !a.ok && a.over===null && /Triage needs Triage-trained\./.test(asked[0]) && /Place Jo Park anyway\?/.test(asked[0]) && b.ok && b.over==="Triage needs Triage-trained." && d.ok && d.over===null && asked.length===n && au.action==="rules.override" && /Jo Park/.test(au.detail) && /Triage needs Triage-trained/.test(au.detail); })());
      T("cell editor: someone moving within a day is judged without counting themselves", (function(){
        state(); put("s2",2,"AM","z2"); put("s4",2,"AM","z3"); confirm=function(){ return false; };
        return adminPlaceCheck("s2",D(2),{kind:"clinical",period:"AM",zone:"z3"}).ok; })());
      T("auto-draft: holders of a tag the half is short of go first, nobody lands in a slot they lack a tag for, and a place stays empty when nobody eligible is left", (function(){
        state(); c.settings.rules.mins[0].n.AM=[2,2,2]; S.staff.unshift(S.staff.splice(3,1)[0]); S.staff.splice(1,0,S.staff.splice(4,1)[0]);   // pool order Jo, Lee, Ava, Sam, Ky: the two Seniors are not first, and the morning needs two of them
        var n=fillPeriodTo(D(2),"AM",3); var z=function(sid){ var v=c.assign[sid+"|"+D(2)]; return v?v.zone:""; };
        var a=n===3 && z("s1")==="z1" && z("s2")==="z2" && z("s4")==="z3" && !ruleBreaches(c,S,D(2)).some(function(b){ return b.period==="AM"; });   // holders first, in pool order, each into the first zone the judge accepts; the evening was not drafted, so only the morning is judged
        state(); c.roles={s4:{in:true},s5:{in:true}}; hydrateCycleRoles(); c.settings.zones=[c.settings.zones[0]]; hydrateCycleSettings(); c.settings.staffing.amMax=1; c.settings.rules={needs:{z1:["t2"]}};
        var m=fillPeriodTo(D(2),"AM",1);
        return a && m===0 && Object.keys(c.assign).length===0; })());
      T("fixed patterns: laid down as written, and a breach is flagged, not dropped", (function(){
        state(); var dow=String(parseISO(D(3)).getDay()); var s4=S.staff[3]; s4.mode="fixed"; s4.fixedPattern={recurrence:"weekly",A:{},B:{},committed:true}; s4.fixedPattern.A[dow]={period:"AM",zone:"z1"};
        var n=applyFixedPatterns(); var v=c.assign["s4|"+D(3)];
        return n>0 && !!v && v.zone==="z1" && v.fixed===true && ruleBreaches(c,S,D(3)).some(function(b){ return b.kind==="needs"&&b.sid==="s4"&&b.tag==="t2"; }); })());

      // ---- tags and rules: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/s3-4-suite.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then a `HARNESS ERROR:` line — `adminPlaceCheck` does not exist yet.

- [ ] **Step 3: Implement.** Save as `$SP/s3-4-app.py`:

```python
# file: s3-4-app.py
rep(r'''/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''',
r'''function adminPlaceCheck(sid,isoD,sh){   // the admin's cell editor asks the judge as a warning: the sentence, then "Place ⟨Name⟩ anyway?"; the person's own shift that day does not count against them
  const cyc=active(), j=ruleJudge(cyc,S,sid,isoD,fillsOf(cyc,sh),sh.zone,{type:sh.type,without:[sid]}); if(j.ok)return {ok:true,over:null};
  if(!confirm(j.reason+"\n\nPlace "+nameOf(sid)+" anyway?"))return {ok:false,over:null}; return {ok:true,over:j.reason}; }
function adminOverrideAudit(sid,isoD,sh,reason){ logAudit("rules.override",nameOf(sid)+" "+isoD+" "+shiftLabel(sh)+" @U@00b7 "+reason,"admin"); }   // who placed whom, where, against which rule
function ruleDraftPick(cyc,st,isoD,period,pool,free){   // the auto-draft's next placement in a half: holders of a tag it is short of first (largest shortfall first), then anyone; each in the first free zone the judge accepts; null when nobody eligible is left
  const place=p=>{ for(const z of free){ if(ruleJudge(cyc,st,p.id,isoD,[period],z.id,null).ok)return {sid:p.id,zone:z.id}; } return null; };
  if(rulesPresent(cyc)){ const booked=ruleCounts(cyc,st,isoD,null)[period], short=ruleShort(cyc,st,isoD,period,booked).filter(x=>x.short>0).sort((a,b)=>b.short-a.short);
    for(const s of short){ for(const p of pool){ if(!hasTag(st,p,s.tag))continue; const got=place(p); if(got)return got; } } }
  for(const p of pool){ const got=place(p); if(got)return got; } return null; }
/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''')
rep(r'''function fillPeriodTo(isoD,period,target){let filled=0;
  while(true){const cnt=clinicalCounts(isoD,null)[period==="AM"?"am":"pm"];
    if(cnt>=target)break;
    if(!periodUnlocked(isoD,period,null).ok)break;
    const z=freeZones(isoD,period)[0];if(!z)break;
    let pool=eligibleStaff(isoD).filter(s=>clinicalCountFor(s.id)<(s.quota||999));
    if(!pool.length)pool=eligibleStaff(isoD);
    if(!pool.length)break;
    pool.sort((a,b)=>clinicalCountFor(a.id)-clinicalCountFor(b.id));
    active().assign[pool[0].id+"|"+isoD]={kind:"clinical",period:period,zone:z.id};filled++;}
  return filled;}''', r'''function fillPeriodTo(isoD,period,target){let filled=0; const _cy=active();
  while(true){const cnt=clinicalCounts(isoD,null)[period==="AM"?"am":"pm"];
    if(cnt>=target)break;
    if(!periodUnlocked(isoD,period,null).ok)break;
    const free=freeZones(isoD,period);if(!free.length)break;
    let pool=eligibleStaff(isoD).filter(s=>clinicalCountFor(s.id)<(s.quota||999));
    if(!pool.length)pool=eligibleStaff(isoD);
    if(!pool.length)break;
    pool.sort((a,b)=>clinicalCountFor(a.id)-clinicalCountFor(b.id));
    const pick=ruleDraftPick(_cy,S,isoD,period,pool,free);if(!pick)break;   // with no rules: the first person into the first free zone, as before; with rules: holders first, never a slot they lack a tag for, and a place left empty rather than filled wrongly
    active().assign[pick.sid+"|"+isoD]={kind:"clinical",period:period,zone:pick.zone};filled++;}
  return filled;}''')
rep(r'''    let sh=modal.draft;
    if(sh.kind==="clinical"&&!sh.zone){fieldError(root.querySelector("#zoneChoices"),"Choose a zone before saving.");return;}''', r'''    let sh=modal.draft, _ov=null;
    if(sh.kind==="clinical"&&!sh.zone){fieldError(root.querySelector("#zoneChoices"),"Choose a zone before saving.");return;}''')
rep(r'''      if(_fvm&&effFatigue().mode!=="off")toast("Fatigue rule: "+_fvm,"warn");   // admin assign: warn, never silently block
    }''', r'''      if(_fvm&&effFatigue().mode!=="off")toast("Fatigue rule: "+_fvm,"warn");   // admin assign: warn, never silently block
      const _pc=adminPlaceCheck(modal.staffId,modal.isoD,sh); if(!_pc.ok)return; _ov=_pc.over;   // a tag rule is a warning here, never a block: the judge's sentence, then Place anyway
    }''')
rep(r'''    setShift(modal.staffId,modal.isoD,sh);closeModal();render();
  };''', r'''    if(_ov)adminOverrideAudit(modal.staffId,modal.isoD,sh,_ov);   // written down only when the placement goes through
    setShift(modal.staffId,modal.isoD,sh);closeModal();render();
  };''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/s3-4-app.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 5`, then `936 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html deploy/app.html preview.html deploy/demo.html tests/suite.js
git commit -q -m "Tags and rules: the admin's cell editor warns with the judge's sentence and asks to place anyway, writing rules.override when it goes through; the auto-draft places holders of a short tag first, never in a slot they lack a tag for, and leaves a place empty rather than fill it wrongly; a fixed pattern that breaches is flagged, not dropped" && git log --oneline -1
```

---

### Task 5: Gaps — the red day, the short-slots list, the Day board's chip, the badges, the open-shift line

**Files:**
- Modify: `app.html` (new `tagChipsHTML`, `tagChipsAll`, `ruleNeedText`, `ruleChip`, `osNeedsHTML`, `gapRowText` in the tags-and-rules section; `ragFor`, `shortSlots`, `gapsPanelHTML`, `viewDaily`, `daySheetHTML`, `marketMyHTML`)
- Test: `tests/suite.js` (the `tags and rules` block)

**Interfaces:**
- Consumes: `ruleBreaches`, `rulesPresent`, `personTags`, `tagById`, `tagName` (Task 1); `clinicalCounts`, `effStaffing`, `freeZones`, `isPH`, `fillsOf`, `escapeHTML`.
- Produces: `tagChipsHTML(s)` (Show-ticked tags as `tag mini` chips, each preceded by a space), `tagChipsAll(s)` (every tag), `ruleNeedText(cyc,st,isoD,P)` → `"needs 1 Senior"` or `""`, `ruleChip(isoD,P)` → `" · needs 1 Senior"` escaped or `""`, `osNeedsHTML(o)`, `gapRowText(sl)`. `shortSlots()` rows gain `kind:"min"|"needs"` (cover rows carry no `kind`), `tag`, and for a needs row `sid` and `zone`. `ragFor` turns a day red for a breach from today onward; past days are never re-judged.

- [ ] **Step 1: Write the failing tests.** Save as `$SP/s3-5-suite.py`:

```python
# file: s3-5-suite.py
rep(r'''      // ---- tags and rules: later tasks add their tests above this line''', r'''      // ---- gaps, the Day board, the day sheet, the open-shift line
      T("gaps: from today onward a tag shortfall is a gap — the day turns red, the short-slots list says what is missing, and past days are never re-judged", (function(){
        state(); put("s4",2,"AM","z1"); var r=ragFor(D(2)), rows=shortSlots().filter(function(x){ return x.iso===D(2); }), html=gapsPanelHTML();
        put("s4",-2,"AM","z1"); var rp=ragFor(D(-2)), past=shortSlots().filter(function(x){ return x.iso===D(-2); });
        return r==="r" && rows.some(function(x){ return x.kind==="min"&&x.tag==="t1"&&x.period==="AM"&&x.need===1; }) && rows.some(function(x){ return x.kind==="needs"&&x.sid==="s4"&&x.zone==="z1"; }) &&
               /needs <b>1<\/b> Senior/.test(html) && /Jo Park isn@U@2019t Triage-trained \(placed by an admin\)/.test(html) && rp!=="r" && past.length===0; })());
      T("gaps: the Day board's cover chip says what the half needs, names carry Show-ticked tags, and the department digest carries none", (function(){
        state(); S.tags[0].show=true; put("s4",2,"AM","z2"); put("s1",2,"PM","z2"); dailyDate=D(2); var h=viewDaily();
        return /1 on · min 1 · needs 1 Senior<\/span>/.test(h) && /Ava Ng <span class="tag mini">Senior<\/span>/.test(h) && !/Triage-trained<\/span>/.test(h) && stableJSON(buildDigestAll(S,T0)).indexOf("Senior")<0; })());
      T("gaps: an open shift's line says what the day is short of, computed when shown", (function(){
        state(); S.marketOn=true; postOpenShift(D(2),"AM","z2",""); S.viewAs="s4"; var h=marketMyHTML();
        put("s2",2,"AM","z3"); var h2=marketMyHTML();
        return /needs 1 Senior/.test(h) && !/needs 1 Senior/.test(h2); })());
      T("gaps: the day sheet says why a slot is barred or held, and shows who holds a slot with their shown tags", (function(){
        state(); S.tags[0].show=true; put("s1",2,"AM","z2"); S.viewAs="s4"; var h=daySheetHTML(D(2));
        state(); put("s4",2,"AM","z2"); put("s5",2,"AM","z3"); S.viewAs="s3"; var h2=daySheetHTML(D(2));
        return /Triage needs Triage-trained\./.test(h) && /Taken by Ng <span class="tag mini">Senior<\/span>/.test(h) && /Held for a Senior/.test(h2); })());

      // ---- tags and rules: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/s3-5-suite.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then four `FAIL  gaps:` lines and `936 passed, 4 failed`.

- [ ] **Step 3: Implement.** Save as `$SP/s3-5-app.py`:

```python
# file: s3-5-app.py
rep(r'''/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''',
r'''function tagChipsHTML(s){ return personTags(S,s).filter(id=>!!(tagById(S,id)||{}).show).map(id=>' <span class="tag mini">'+escapeHTML(tagName(S,id))+'</span>').join(""); }   // only tags ticked Show, in list order — this group's own screens; the department board reads the digest, which carries none
function tagChipsAll(s){ return personTags(S,s).map(id=>' <span class="tag mini">'+escapeHTML(tagName(S,id))+'</span>').join(""); }   // the Staff tab shows every tag, whatever the tick
function ruleNeedText(cyc,st,isoD,P){ const short=ruleBreaches(cyc,st,isoD).filter(b=>b.kind==="min"&&b.period===P); return short.length?"needs "+short.map(b=>(b.need-b.have)+" "+tagName(st,b.tag)).join(", "):""; }   // what a half is still short of, computed when shown
function ruleChip(isoD,P){ const t=ruleNeedText(active(),S,isoD,P); return t?" @U@00b7 "+escapeHTML(t):""; }
function osNeedsHTML(o){ if(!o||o.status!=="open")return ""; const c=(S.cycles||[]).find(x=>x.id===o.cycleId); if(!c||!rulesPresent(c))return "";
  const parts=[]; fillsOf(c,{kind:"clinical",period:o.period,zone:o.zone,type:o.type||undefined}).forEach(P=>{ const t=ruleNeedText(c,S,o.iso,P); if(t)parts.push(escapeHTML(t)); }); return parts.length?' @U@00b7 <span class="muted">'+parts.join(", ")+'</span>':""; }
function gapRowText(sl){ if(sl.kind==="needs")return `${escapeHTML(zoneName(sl.zone))} @U@2014 ${escapeHTML(nameOf(sl.sid))} isn@U@2019t ${escapeHTML(tagName(S,sl.tag))} (placed by an admin)`;
  if(sl.kind==="min")return `needs <b>${sl.need}</b> ${escapeHTML(tagName(S,sl.tag))}`; return `${sl.have} of ${sl.min} @U@00b7 need <b>${sl.need}</b>`; }
/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''')
rep(r'''function ragFor(isoD){const {am,pm}=clinicalCounts(isoD,null);const aM=effStaffing().amMin,pM=effStaffing().pmMin;if(am<aM||pm<pM)return"r";if(am===aM||pm===pM)return"a";return"g";}''',
    r'''function ragFor(isoD){const {am,pm}=clinicalCounts(isoD,null);const aM=effStaffing().amMin,pM=effStaffing().pmMin;if(am<aM||pm<pM)return"r";if(isoD>=iso(new Date())&&ruleBreaches(active(),S,isoD).length)return"r";if(am===aM||pm===pM)return"a";return"g";}   // from today onward a tag shortfall is a gap; past days are never re-judged''')
rep(r'''function shortSlots(){   // every (day, period) below the minimum for the active cycle, with the free zones it could be filled into
  const st=effStaffing(), out=[]; if(!S.staff.length)return out;
  cycleDates().forEach(d=>{ const isoD=iso(d); const {am,pm}=clinicalCounts(isoD,null);
    [["AM",am,st.amMin],["PM",pm,st.pmMin]].forEach(([p,have,min])=>{ const need=Math.max(0,min-have); if(!need)return;
      out.push({iso:isoD,period:p,have,min,need,zones:freeZones(isoD,p),ph:isPH(isoD)}); }); });
  return out; }''', r'''function shortSlots(){   // every (day, period) below the minimum for the active cycle, with the free zones it could be filled into; from today onward, every tag rule the day breaks
  const st=effStaffing(), out=[], today=iso(new Date()), cyc=active(); if(!S.staff.length)return out;
  cycleDates().forEach(d=>{ const isoD=iso(d); const {am,pm}=clinicalCounts(isoD,null);
    [["AM",am,st.amMin],["PM",pm,st.pmMin]].forEach(([p,have,min])=>{ const need=Math.max(0,min-have); if(!need)return;
      out.push({iso:isoD,period:p,have,min,need,zones:freeZones(isoD,p),ph:isPH(isoD)}); });
    if(isoD>=today)ruleBreaches(cyc,S,isoD).forEach(b=>{ if(b.kind==="min")out.push({kind:"min",iso:isoD,period:b.period,have:b.have,min:b.need,need:b.need-b.have,tag:b.tag,zones:freeZones(isoD,b.period),ph:isPH(isoD)});
      else out.push({kind:"needs",iso:isoD,period:b.period,have:0,min:0,need:1,tag:b.tag,sid:b.sid,zone:b.zone,zones:[],ph:isPH(isoD)}); }); });
  return out; }''')
rep(r'''  const rows=slots.map(sl=>{ const posted=osActive().some(o=>o.iso===sl.iso&&o.period===sl.period&&o.status==="open"); const z0=sl.zones[0];
    return `<div class="gaprow"><span class="gapd"><b>${fmtISO(sl.iso)}</b>${sl.ph?' <span class="tag ph mini">PH</span>':""}</span><span class="tag lg ${sl.period==="AM"?"am":"pm"}">${sl.period}</span><span class="gapn">${sl.have} of ${sl.min} · need <b>${sl.need}</b></span><span class="muted small gapz">${sl.zones.length?sl.zones.map(z=>escapeHTML(z.name)).join(", ")+" free":"no free zone"}</span><span class="grow"></span>
      ${sl.zones.length?`<button class="btn sm" data-gapassign="${sl.iso}">Assign…</button>${canCast&&z0?(posted?`<span class="tag ok">${ic("check")} broadcast</span>`:`<button class="btn sm" data-gapcast="${sl.iso}|${sl.period}|${z0.id}">Broadcast</button>`):""}`:`<span class="muted small">No zone runs this period — <a href="#" data-go="setup||card-zones">add a zone</a> or <a href="#" data-go="setup||card-cover">lower the minimum</a>.</span>`}</div>`; }).join("");''',
    r'''  const rows=slots.map(sl=>{ const posted=osActive().some(o=>o.iso===sl.iso&&o.period===sl.period&&o.status==="open"); const z0=sl.zones[0], tagRow=!!sl.kind;   // a tag row: Assign opens the day; only a cover row can be broadcast
    return `<div class="gaprow"><span class="gapd"><b>${fmtISO(sl.iso)}</b>${sl.ph?' <span class="tag ph mini">PH</span>':""}</span><span class="tag lg ${sl.period==="AM"?"am":"pm"}">${sl.period}</span><span class="gapn">${gapRowText(sl)}</span><span class="muted small gapz">${sl.kind==="needs"?"":(sl.zones.length?sl.zones.map(z=>escapeHTML(z.name)).join(", ")+" free":"no free zone")}</span><span class="grow"></span>
      ${(sl.zones.length||tagRow)?`<button class="btn sm" data-gapassign="${sl.iso}">Assign…</button>${canCast&&z0&&!tagRow?(posted?`<span class="tag ok">${ic("check")} broadcast</span>`:`<button class="btn sm" data-gapcast="${sl.iso}|${sl.period}|${z0.id}">Broadcast</button>`):""}`:`<span class="muted small">No zone runs this period — <a href="#" data-go="setup||card-zones">add a zone</a> or <a href="#" data-go="setup||card-cover">lower the minimum</a>.</span>`}</div>`; }).join("");''')
rep(r'''    <div class="sub">Each row is a day and period below its minimum. Assign opens that day; Broadcast posts the first free zone as an open shift.</div>${rows}${foot}</div>`;''',
    r'''    <div class="sub">Each row is a day and period below its minimum${rulesPresent(active())?", or short of a tag its rules ask for":""}. Assign opens that day; Broadcast posts the first free zone as an open shift.</div>${rows}${foot}</div>`;''')
rep(r'''<span class="tag ${am>=effStaffing().amMin?"ok":"warn"}">${am} on · min ${effStaffing().amMin}</span></h3>${board("AM")}''',
    r'''<span class="tag ${(am>=effStaffing().amMin&&!ruleChip(dailyDate,"AM"))?"ok":"warn"}">${am} on · min ${effStaffing().amMin}${ruleChip(dailyDate,"AM")}</span></h3>${board("AM")}''')
rep(r'''<span class="tag ${pm>=effStaffing().pmMin?"ok":"warn"}">${pm} on · min ${effStaffing().pmMin}</span></h3>${board("PM")}''',
    r'''<span class="tag ${(pm>=effStaffing().pmMin&&!ruleChip(dailyDate,"PM"))?"ok":"warn"}">${pm} on · min ${effStaffing().pmMin}${ruleChip(dailyDate,"PM")}</span></h3>${board("PM")}''')
rep(r'''<span class="grow">${s?escapeHTML(s.name):'<span class="muted">— vacant</span>'}</span></div>`;}).join("");''',
    r'''<span class="grow">${s?escapeHTML(s.name)+tagChipsHTML(s):'<span class="muted">— vacant</span>'}</span></div>`;}).join("");''')
rep(r'''<span class="grow">${escapeHTML(s.name)}</span><span class="muted chev">${ic("chevR")}</span></button>`;}).join(""):"";''',
    r'''<span class="grow">${escapeHTML(s.name)}${tagChipsHTML(s)}</span><span class="muted chev">${ic("chevR")}</span></button>`;}).join(""):"";''')
rep(r'''<span class="zsub">${sel?"Picked — tap to unpick":(chk.ok?"Open":escapeHTML(chk.reason))}</span></button>`; }).join("");''',
    r'''<span class="zsub">${sel?"Picked — tap to unpick":(chk.ok?"Open":escapeHTML(chk.reason)+(taken?tagChipsHTML(taken):""))}</span></button>`; }).join("");''')
rep(r'''+(o.note?' @U@00b7 <span class="muted">'+escapeHTML(o.note)+'</span>':"")+'</span><span class="grow"></span>'+status+btn+'</div>'; }).join("")''',
    r'''+(o.note?' @U@00b7 <span class="muted">'+escapeHTML(o.note)+'</span>':"")+osNeedsHTML(o)+'</span><span class="grow"></span>'+status+btn+'</div>'; }).join("")''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/s3-5-app.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 11`, then `940 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html deploy/app.html preview.html deploy/demo.html tests/suite.js
git commit -q -m "Tags and rules: from today onward a tag shortfall is a gap — the day turns red, the short-slots list says what is missing and who was placed against a rule, the Day board's cover chip and an open shift's line say what a half still needs, and Show-ticked tags sit beside names on the Day board and day sheet; never on the department board" && git log --oneline -1
```

---

### Task 6: The Tags card, the Rules card, the Staff tab and the profile

**Files:**
- Modify: `app.html` (tag and rule actions, `rulesSummary`, `rulesSet`, `rulesSaveFromForm`, `tagsCardHTML`, `rulesCardHTML`, `openTagWho`, `myTagsHTML` in the tags-and-rules section; `_staffTag`; `staffFiltered`, `staffListHTML`, `viewStaff`, `staffRowHTML`, `wireStaffRows`, the Staff and Settings blocks of `wire()`; `viewSetup`'s card order, `SETUP_CYCLE`, `SETUP_GROUP`, `setupIndexHTML`; `viewMy`)
- Test: `tests/suite.js` (the `tags and rules` block; its `keep` line and `state()` gain `_staffTag`)

**Interfaces:**
- Consumes: Task 1's accessors and Task 5's `tagChipsAll`; `openDialog`, `closeModal`, `toastSaved`, `cycH2`, `logAudit`, `save`, `render`.
- Produces: `tagAdd(name)` → the tag or `null`; `tagRename(id,name)` → boolean; `tagSetShow(id,on)`; `tagHolders(id)`; `tagInUse(id)` → `{people,cycles}`; `tagRemove(id)` → `{ok}` or `{ok:false,reason}`; `personTagSet(sid,tagId,on)` (deletes the key when the last tag goes); `rulesSummary(cyc,st)` → the plain-words sentence(s); `rulesSet(cyc,rules)` normalises, stores (or deletes an empty block), audits each changed part; `rulesSaveFromForm()`; `tagsCardHTML()`, `rulesCardHTML()`, `openTagWho(id)`, `myTagsHTML(s)`; `staffFiltered(q,f,tag)`; the device-side `_staffTag`.

- [ ] **Step 1: Write the failing tests.** Save as `$SP/s3-6-suite.py`:

```python
# file: s3-6-suite.py
rep(r'''sq:_staffQuery,pick:_srPick,''', r'''sq:_staffQuery,st:_staffTag,pick:_srPick,''')
rep(r'''_staffFilter=keep.sf; _staffQuery=keep.sq; _srPick=keep.pick;''', r'''_staffFilter=keep.sf; _staffQuery=keep.sq; _staffTag=keep.st; _srPick=keep.pick;''')
rep(r'''dailyScope="group"; dailyDate=null; _staffFilter="all"; _staffQuery="";''', r'''dailyScope="group"; dailyDate=null; _staffFilter="all"; _staffQuery=""; _staffTag="";''')
rep(r'''      // ---- tags and rules: later tasks add their tests above this line''', r'''      // ---- the Tags card, the Rules card, the Staff tab, the profile
      T("tags card: lists each tag with how many hold it, adds a hidden tag, refuses a duplicate name, renames, and refuses removal while in use with the counts", (function(){
        state(); var h=tagsCardHTML(); var t=tagAdd("Night lead"); var dup=tagAdd("senior"); var rn=tagRename("t1","Lead");
        var rm=tagRemove("t1"), rm2=tagRemove(t.id);
        return /Senior/.test(h) && /2 people hold it/.test(h) && !!t && t.show===undefined && S.audit.some(function(a){ return a.action==="tags.add"; }) && dup===null && said.some(function(m){ return /already a tag called senior/.test(m); }) && rn===true && tagName(S,"t1")==="Lead" && S.audit.some(function(a){ return a.action==="tags.rename"; }) &&
               !rm.ok && /2 people hold it and 1 cycle@U@2019s rules name it/.test(rm.reason) && rm2.ok && !tagById(S,t.id) && S.audit.some(function(a){ return a.action==="tags.remove"; }); })());
      T("tags: unticking the last tag deletes the key, ticking adds in list order, and the show tick is written down", (function(){
        state(); personTagSet("s3","t2",false); personTagSet("s4","t2",true); personTagSet("s4","t1",true); tagSetShow("t2",true); var shown=S.tags[1].show; tagSetShow("t2",false);
        var s3=S.staff[2], s4=S.staff[3];
        return !("tags" in s3) && JSON.stringify(s4.tags)==='["t1","t2"]' && shown===true && S.tags[1].show===undefined && S.audit.filter(function(a){ return a.action==="tags.show"; }).length===2 && S.audit.some(function(a){ return a.action==="tags.person"; }); })());
      T("rules card: a plain-words summary, a cycle with no rules says so, and with no tags it points to the Tags card", (function(){
        state(); var h=rulesCardHTML(); state({noRules:true}); var h2=rulesCardHTML(); state({noTags:true}); var h3=rulesCardHTML();
        state(); c.settings.rules.mins=[{tag:"t1",n:{AM:[1,1,1],PM:[2,2,2]}}]; var s2=rulesSummary(c,S); c.settings.rules.mins=[{tag:"t1",n:{AM:[1,2,3],PM:[0,0,0]}}]; var s3=rulesSummary(c,S);
        return /Triage needs Triage-trained\. At least 1 Senior every AM and PM\./.test(h) && /class="rn-cb" data-z="z1" data-t="t2" checked/.test(h) && /class="rm-n" data-t="t1" data-p="PM" data-d="1" value="1"/.test(h) && /No rules on this cycle\./.test(h2) && /card-tags/.test(h3) && !/rn-cb/.test(h3) &&
               s2==="Triage needs Triage-trained. At least 1 Senior every AM, 2 every PM." && s3==="Triage needs Triage-trained. At least 1 Senior on weekday AMs, 2 Senior on weekend AMs, 3 Senior on public holiday AMs."; })());
      T("rules: saving normalises — unknown or repeated tags dropped, empty pieces omitted, an empty block deleted — and each change is written down", (function(){
        state(); rulesSet(c,{needs:{z1:["t2","t2","nope"],z2:[]},mins:[{tag:"t2",n:{AM:[0,0,0],PM:[0,0,0]}},{tag:"t1",n:{AM:[1,1,1],PM:[1,1,1]}}]});
        var a=JSON.stringify(c.settings.rules)==='{"needs":{"z1":["t2"]},"mins":[{"tag":"t1","n":{"AM":[1,1,1],"PM":[1,1,1]}}]}', n0=S.audit.length;
        rulesSet(c,{needs:{z1:["t2"]},mins:[{tag:"t1",n:{AM:[2,2,2],PM:[1,1,1]}}]}); var n1=S.audit.length, top=S.audit[0].action; rulesSet(c,{});
        return a && n0===0 && n1===1 && top==="rules.mins" && !("rules" in c.settings) && S.audit.some(function(x){ return x.action==="rules.needs"; }); })());
      T("staff tab: every tag as a chip, ticks in the detail, and a Tag filter", (function(){
        state(); var h=viewStaff(); _staffOpen.add("s1"); var row=staffRowHTML(S.staff[0]); _staffOpen.delete("s1");
        var ids=staffFiltered("","all","t1").map(function(s){ return s.id; }).sort().join(",");
        return /id="staffTagSel"/.test(h) && /<option value="t1"[^>]*>Senior<\/option>/.test(h) && /Sam Lee<span class="tag brand mini"><\/span><\/span>\s*<span class="smeta">[^<]*<span class="tag mini">Senior<\/span>/.test(h) && /class="s-tag" data-t="t1" checked/.test(row) && /class="s-tag" data-t="t2" checked/.test(row) && ids==="s1,s2"; })());
      T("profile: a person sees their own tags, read-only", (function(){
        state(); S.viewAs="s1"; var h=viewMy(); S.viewAs="s4"; var h2=viewMy();
        return /Your tags: Senior, Triage-trained · set by your admin\./.test(h) && !/Your tags/.test(h2); })());

      // ---- tags and rules: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/s3-6-suite.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 4`, then a `HARNESS ERROR:` line — the block's `keep` line reads `_staffTag`, which does not exist yet.

- [ ] **Step 3: Implement.** Save as `$SP/s3-6-app.py`:

```python
# file: s3-6-app.py
rep(r'''/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''',
r'''function tagHolders(id){ return S.staff.filter(s=>hasTag(S,s,id)); }
function tagInUse(id){ const people=tagHolders(id).length, cycles=(S.cycles||[]).filter(c=>!c.archived&&(rulesOf(c).mins.some(m=>m&&m.tag===id)||Object.keys(rulesOf(c).needs).some(z=>(rulesOf(c).needs[z]||[]).indexOf(id)>=0))).length; return {people:people,cycles:cycles}; }
function tagAdd(name){ name=String(name||"").trim().slice(0,40); if(!name)return null;
  if(tagList(S).some(t=>String(t.name).toLowerCase()===name.toLowerCase())){ toast("There is already a tag called "+name+"."); return null; }
  const t={id:"t"+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36),name:name}; (S.tags=Array.isArray(S.tags)?S.tags:[]).push(t);   // hidden until its Show tick is set
  logAudit("tags.add",name,"admin"); save(); return t; }
function tagRename(id,name){ const t=tagById(S,id); name=String(name||"").trim().slice(0,40); if(!t||!name||name===t.name)return false;
  if(tagList(S).some(x=>x.id!==id&&String(x.name).toLowerCase()===name.toLowerCase())){ toast("There is already a tag called "+name+"."); return false; }
  logAudit("tags.rename",t.name+" @U@2192 "+name,"admin"); t.name=name; save(); return true; }
function tagSetShow(id,on){ const t=tagById(S,id); if(!t)return; if(on)t.show=true; else delete t.show; logAudit("tags.show",t.name+(on?" shown on the roster":" hidden on the roster"),"admin"); save(); }
function tagRemove(id){ const t=tagById(S,id); if(!t)return {ok:false,reason:"That tag is gone."}; const u=tagInUse(id);
  if(u.people||u.cycles)return {ok:false,reason:"Can@U@2019t remove "+t.name+" while "+(u.people?u.people+(u.people===1?" person holds":" people hold")+" it":"")+(u.people&&u.cycles?" and ":"")+(u.cycles?u.cycles+(u.cycles===1?" cycle@U@2019s rules name":" cycles@U@2019 rules name")+" it":"")+". Untick it and change the rules first."};
  S.tags=tagList(S).filter(x=>x.id!==id); if(!S.tags.length)delete S.tags; logAudit("tags.remove",t.name,"admin"); save(); return {ok:true}; }
function personTagSet(sid,tagId,on){ const s=S.staff.find(x=>x.id===sid), t=tagById(S,tagId); if(!s||!t)return false;
  const cur=(Array.isArray(s.tags)?s.tags:[]).filter(x=>x!==tagId); if(on)cur.push(tagId);
  const order=tagList(S).map(x=>x.id), next=cur.filter(x=>order.indexOf(x)>=0).sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  if(next.length)s.tags=next; else delete s.tags;   // the key goes with the last tag: the 3-way merge decides ownership by JSON equality
  logAudit("tags.person",s.name+(on?" + ":" @U@2212 ")+t.name,"admin"); save(); return true; }
function rulesSummary(cyc,st){ const r=rulesOf(cyc), zs=(cyc&&cyc.settings&&cyc.settings.zones)||(st&&st.zones)||[], out=[], order=tagList(st).map(t=>t.id);
  zs.forEach(z=>{ const need=(r.needs[z.id]||[]).filter(t=>tagById(st,t)); if(need.length)out.push(z.name+" needs "+need.map(t=>tagName(st,t)).join(" and ")+"."); });
  r.mins.filter(m=>m&&order.indexOf(m.tag)>=0).sort((a,b)=>order.indexOf(a.tag)-order.indexOf(b.tag)).forEach(m=>{ const A=[0,1,2].map(d=>minFor(m,"AM",d)), P=[0,1,2].map(d=>minFor(m,"PM",d)), all=A.concat(P), nm=tagName(st,m.tag);
    if(!all.some(x=>x>0))return;
    if(all.every(x=>x===all[0])){ out.push("At least "+all[0]+" "+nm+" every AM and PM."); return; }
    if(A.every(x=>x===A[0])&&P.every(x=>x===P[0])){ const parts=[]; if(A[0]>0)parts.push(A[0]+" "+nm+" every AM"); if(P[0]>0)parts.push(P[0]+(A[0]>0?"":" "+nm)+" every PM"); out.push("At least "+parts.join(", ")+"."); return; }
    const DT=["weekday","weekend","public holiday"], parts=[]; ["AM","PM"].forEach(pp=>{ [0,1,2].forEach(d=>{ const v=minFor(m,pp,d); if(v>0)parts.push(v+" "+nm+" on "+DT[d]+" "+pp+"s"); }); }); out.push("At least "+parts.join(", ")+"."); });
  return out.join(" "); }
function rulesSet(cyc,rules){   // normalise and store: unknown or repeated tags dropped, empty pieces omitted, an empty block deleted; each part that changed is written down
  const before=rulesOf(cyc), order=tagList(S).map(t=>t.id), needs={}, mins=[];
  Object.keys((rules&&rules.needs)||{}).forEach(z=>{ const ts=(rules.needs[z]||[]).filter((t,i,a)=>order.indexOf(t)>=0&&a.indexOf(t)===i).sort((a,b)=>order.indexOf(a)-order.indexOf(b)); if(ts.length)needs[z]=ts; });
  ((rules&&rules.mins)||[]).forEach(m=>{ if(!m||order.indexOf(m.tag)<0||mins.some(x=>x.tag===m.tag))return; const n={AM:[0,1,2].map(d=>minFor(m,"AM",d)),PM:[0,1,2].map(d=>minFor(m,"PM",d))}; if(n.AM.some(x=>x>0)||n.PM.some(x=>x>0))mins.push({tag:m.tag,n:n}); });
  mins.sort((a,b)=>order.indexOf(a.tag)-order.indexOf(b.tag));
  const out={}; if(Object.keys(needs).length)out.needs=needs; if(mins.length)out.mins=mins;
  if(!cyc.settings)cyc.settings={}; if(Object.keys(out).length)cyc.settings.rules=out; else delete cyc.settings.rules;
  const after=rulesOf(cyc), sum=rulesSummary(cyc,S)||"no rules";
  if(JSON.stringify(before.needs)!==JSON.stringify(after.needs))logAudit("rules.needs",sum,"admin");
  if(JSON.stringify(before.mins)!==JSON.stringify(after.mins))logAudit("rules.mins",sum,"admin");
  save(); return after; }
function rulesSaveFromForm(){ const needs={}, mins={};
  document.querySelectorAll(".rn-cb").forEach(cb=>{ if(!cb.checked)return; (needs[cb.dataset.z]=needs[cb.dataset.z]||[]).push(cb.dataset.t); });
  document.querySelectorAll(".rm-n").forEach(inp=>{ const v=Math.max(0,Math.floor(+inp.value||0)); if(!v)return; const m=mins[inp.dataset.t]=mins[inp.dataset.t]||{tag:inp.dataset.t,n:{AM:[0,0,0],PM:[0,0,0]}}; m.n[inp.dataset.p][+inp.dataset.d]=v; });
  rulesSet(active(),{needs:needs,mins:Object.keys(mins).map(t=>mins[t])}); render(); toastSaved("cycle"); }
function tagsCardHTML(){ const tl=tagList(S);
  const rows=tl.map(t=>{ const n=tagHolders(t.id).length; return `<div class="listrow" data-tag="${t.id}"><input class="t-name" value="${escapeHTML(t.name)}" aria-label="Tag name" style="width:160px"><label><input type="checkbox" class="t-show" ${t.show?"checked":""}> Show on the roster</label><span class="muted small">${n===1?"1 person holds it":n+" people hold it"}</span><span class="grow"></span><button class="btn sm t-who">Who holds this?</button><button class="btn danger sm t-del">Remove</button></div>`; }).join("");
  return `<div class="card" id="card-tags"><h2>Tags</h2>
    <div class="sub">A tag is a label on a person: a grade, a credential, a skill. A cycle@U@2019s Rules card can then say a slot needs a tag, or that every AM or PM needs at least so many holders. Tags never leave this group.</div>
    ${rows||'<div class="muted small">No tags yet.</div>'}
    <div class="row" style="margin-top:8px"><label class="field"><span class="lbl">New tag</span><input id="tagNew" placeholder="e.g. Senior" style="width:180px"></label><button class="btn sm" id="tagAdd">Add tag</button></div>
    <div class="muted small" style="margin-top:8px">Hidden means hidden on the screens, not locked away: every member@U@2019s app holds the group@U@2019s whole record. Tags are for credentials and grades, not for anything confidential.</div></div>`; }
function rulesCardHTML(){ const c=active(), tl=tagList(S), r=rulesOf(c), zs=S.zones||[];
  const body=!tl.length?`<div class="muted small">No tags yet. <a href="#" data-go="setup||card-tags">Add tags under Group</a> first, then set the rules here.</div>`:
   `<div class="sub" style="margin-top:6px">${rulesPresent(c)?escapeHTML(rulesSummary(c,S)):"No rules on this cycle."}</div>
    <h3 style="margin:12px 0 4px;font-size:var(--fs-md)">Slots that need a tag</h3>
    ${zs.map(z=>`<div class="listrow"><span style="min-width:120px">${escapeHTML(z.name)}</span>${tl.map(t=>`<label style="margin-right:10px"><input type="checkbox" class="rn-cb" data-z="${z.id}" data-t="${t.id}" ${(r.needs[z.id]||[]).indexOf(t.id)>=0?"checked":""}> ${escapeHTML(t.name)}</label>`).join("")}</div>`).join("")}
    <h3 style="margin:12px 0 4px;font-size:var(--fs-md)">Minimums</h3>
    <div class="muted small">At least this many holders in each half of the day, across the whole group; the last places are held for them. Blank or 0 means no minimum.</div>
    <div class="gridscroll"><table class="roster"><thead><tr><th class="namecol">Tag</th><th>AM weekday</th><th>AM weekend</th><th>AM public holiday</th><th>PM weekday</th><th>PM weekend</th><th>PM public holiday</th></tr></thead><tbody>
    ${tl.map(t=>{ const m=r.mins.find(x=>x&&x.tag===t.id); return `<tr><td class="namecol">${escapeHTML(t.name)}</td>${["AM","PM"].map(pp=>[0,1,2].map(d=>`<td><input type="number" min="0" class="rm-n" data-t="${t.id}" data-p="${pp}" data-d="${d}" value="${m?(minFor(m,pp,d)||""):""}" style="width:56px" aria-label="${escapeHTML(t.name)} ${pp} ${["weekday","weekend","public holiday"][d]}"></td>`).join("")).join("")}</tr>`; }).join("")}
    </tbody></table></div>
    <div class="flexbtns" style="margin-top:10px"><button class="btn primary" id="rulesSave">Save rules</button></div>`;
  return `<div class="card" id="card-rules">${cycH2("Rules")}<div class="sub">A slot can need a tag, and each AM or PM can need at least so many holders of one. Staff are refused with the reason; an admin can place anyone behind a warning, and a shortfall shows as a gap. Rules apply to this cycle only.</div>${body}</div>`; }
let _tagWhoQ="";
function openTagWho(id){ const t=tagById(S,id); if(!t)return; const root=document.getElementById("modalRoot"), q=_tagWhoQ.toLowerCase();
  const people=S.staff.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name))).filter(s=>!q||String(s.name).toLowerCase().indexOf(q)>=0);
  openDialog(`<div class="overlay" id="ovlTw"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h3 id="dlgT">Who holds ${escapeHTML(t.name)}?</h3>
    <input type="search" id="twQ" placeholder="Search names" value="${escapeHTML(_tagWhoQ)}" aria-label="Search names" style="width:100%;margin:6px 0">
    <div style="max-height:50vh;overflow:auto">${people.map(s=>`<label class="listrow"><input type="checkbox" class="tw-cb" data-sid="${s.id}" ${hasTag(S,s,id)?"checked":""}> ${escapeHTML(s.name)}</label>`).join("")||'<div class="muted small">Nobody matches.</div>'}</div>
    <div class="flexbtns" style="margin-top:12px"><span class="grow"></span><button class="btn" id="twDone">Done</button></div></div></div>`);
  root.querySelector("#ovlTw").onclick=e=>{ if(e.target.id==="ovlTw"){ closeModal(); render(); } };
  const qi=root.querySelector("#twQ"); if(qi)qi.oninput=()=>{ _tagWhoQ=qi.value; openTagWho(id); };
  root.querySelectorAll(".tw-cb").forEach(cb=>cb.onchange=()=>{ personTagSet(cb.dataset.sid,id,cb.checked); });
  root.querySelector("#twDone").onclick=()=>{ closeModal(); render(); }; }
function myTagsHTML(s){ const ids=personTags(S,s); if(!ids.length)return ""; return `<div class="muted small" style="margin-top:4px">Your tags: ${ids.map(id=>escapeHTML(tagName(S,id))).join(", ")} @U@00b7 set by your admin.</div>`; }
/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''')
rep(r'''let _staffQuery="", _staffFilter="all";''', r'''let _staffQuery="", _staffFilter="all", _staffTag="";''')
rep(r'''function staffFiltered(q,f){ q=String(q||"").trim().toLowerCase(); f=f||"all";
  const list=S.staff.filter(s=>{
    if(f==="in"&&!inCycle(s))return false;''', r'''function staffFiltered(q,f,tag){ q=String(q||"").trim().toLowerCase(); f=f||"all";
  const list=S.staff.filter(s=>{
    if(tag&&!hasTag(S,s,tag))return false;
    if(f==="in"&&!inCycle(s))return false;''')
rep(r'''const list=staffFiltered(_staffQuery,_staffFilter);''', r'''const list=staffFiltered(_staffQuery,_staffFilter,_staffTag);''')
rep(r'''["none","Non-clinical"]].map(([k,l])=>`<button data-sf="${k}" class="${_staffFilter===k?"on":""}">${l}</button>`).join("")}</div></div>''',
    r'''["none","Non-clinical"]].map(([k,l])=>`<button data-sf="${k}" class="${_staffFilter===k?"on":""}">${l}</button>`).join("")}</div>${tagList(S).length?`<select id="staffTagSel" aria-label="Tag"><option value="">Any tag</option>${tagList(S).map(t=>`<option value="${t.id}" ${_staffTag===t.id?"selected":""}>${escapeHTML(t.name)}</option>`).join("")}</select>`:""}</div>''')
rep(r'''<span class="smeta">${escapeHTML(meta)}${noContact?''', r'''<span class="smeta">${escapeHTML(meta)}${tagChipsAll(s)}${noContact?''')
rep(r'''      <div class="flexbtns" style="margin-top:10px">${(inCyc&&!nonClin)?`<button class="btn sm s-fp"''', r'''      ${tagList(S).length?`<div style="margin-top:8px"><span class="lbl">Tags</span> ${tagList(S).map(t=>`<label style="margin-right:10px"><input type="checkbox" class="s-tag" data-t="${t.id}" ${hasTag(S,s,t.id)?"checked":""}> ${escapeHTML(t.name)}</label>`).join("")}</div>`:""}
      <div class="flexbtns" style="margin-top:10px">${(inCyc&&!nonClin)?`<button class="btn sm s-fp"''')
rep(r'''      on(".s-pay",e=>{s.payrollId=e.target.value.trim();save();});''', r'''      on(".s-pay",e=>{s.payrollId=e.target.value.trim();save();});
      rowEl.querySelectorAll(".s-tag").forEach(cb=>cb.onchange=()=>{ personTagSet(id,cb.dataset.t,cb.checked); const l=document.getElementById("staffList"); if(l){ l.innerHTML=staffListHTML(); wireStaffRows(); } });''')
rep(r'''    document.querySelectorAll("#staffFilterSeg [data-sf]").forEach(b=>b.onclick=()=>{ _staffFilter=b.dataset.sf; render(); });''', r'''    document.querySelectorAll("#staffFilterSeg [data-sf]").forEach(b=>b.onclick=()=>{ _staffFilter=b.dataset.sf; render(); });
    const ts_=document.getElementById("staffTagSel"); if(ts_)ts_.onchange=()=>{ _staffTag=ts_.value; render(); };''')
rep(r'''_staffFilter="all"; _secOpen=null;''', r'''_staffFilter="all"; _staffTag=""; _secOpen=null;''')
rep(r'''const SETUP_CYCLE=["card-status","card-cycle","card-zones","card-cover","card-times",''', r'''const SETUP_CYCLE=["card-status","card-cycle","card-zones","card-cover","card-rules","card-times",''')
rep(r'''const SETUP_GROUP=["brandCard","card-cycles",''', r'''const SETUP_GROUP=["brandCard","card-tags","card-cycles",''')
rep(r'''["card-cover","Cover"],["card-times","Shift types"]''', r'''["card-cover","Cover"],["card-rules","Rules"],["card-times","Shift types"]''')
rep(r'''[["brandCard","Group"],["card-cycles","Cycles"]''', r'''[["brandCard","Group"],["card-tags","Tags"],["card-cycles","Cycles"]''')
rep(r'''const body=half==="cycle"?[C.status,C.cycle,C.zones,C.cover,C.times,''', r'''const body=half==="cycle"?[C.status,C.cycle,C.zones,C.cover,rulesCardHTML(),C.times,''')
rep(r''':[brandingCardHTML(),C.cycles,C.import,''', r''':[brandingCardHTML(),tagsCardHTML(),C.cycles,C.import,''')
rep(r'''  if(S.tab==="setup"){
    renderZoneList(); groupsFetch();''', r'''  if(S.tab==="setup"){
    renderZoneList(); groupsFetch();
    const rs_=document.getElementById("rulesSave"); if(rs_)rs_.onclick=()=>{ rulesSaveFromForm(); };
    const ta_=document.getElementById("tagAdd"); if(ta_)ta_.onclick=()=>{ const el=document.getElementById("tagNew"); if(tagAdd(el?el.value:"")){ render(); toastSaved("group"); } };
    document.querySelectorAll("[data-tag]").forEach(rowEl=>{ const id=rowEl.dataset.tag;
      const nm=rowEl.querySelector(".t-name"); if(nm)nm.onchange=()=>{ if(tagRename(id,nm.value))toastSaved("group"); else render(); };
      const sw=rowEl.querySelector(".t-show"); if(sw)sw.onchange=()=>{ tagSetShow(id,sw.checked); toastSaved("group"); };
      const who=rowEl.querySelector(".t-who"); if(who)who.onclick=()=>{ _tagWhoQ=""; openTagWho(id); };
      const del=rowEl.querySelector(".t-del"); if(del)del.onclick=()=>{ const r=tagRemove(id); if(!r.ok){ toast(r.reason); return; } render(); toastSaved("group"); }; });''')
rep(r'''    ${quotaStripHTML(sid,s)}''', r'''    ${quotaStripHTML(sid,s)}${myTagsHTML(s)}''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/s3-6-app.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 18`, then `946 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html deploy/app.html preview.html deploy/demo.html tests/suite.js
git commit -q -m "Tags and rules: Settings gains a Tags card on the group (add, rename, show tick, Who holds this?, removal refused while in use) and a Rules card on the cycle (a plain-words summary, slots that need a tag, the six-number minimums); the Staff tab shows tags as chips with ticks and a Tag filter; a person sees their own tags on My shifts" && git log --oneline -1
```

---

### Task 7: The import's Tags column and the carry-forward

**Files:**
- Modify: `app.html` (`tagsFromCell`, `rulesCarry`, `rulesDropZone` in the tags-and-rules section; `parseStaffList`, `applyStaffList`, `importStaffList`, `downloadStaffTemplate`; `prepareNext`; `applyRosterImport`'s new-cycle branch; `renderZoneList`'s Remove)
- Test: `tests/suite.js` (the `tags and rules` block)

**Interfaces:**
- Consumes: `tagList`, `tagById`, `logAudit`, `cset`, `active`.
- Produces: `tagsFromCell(str,made)` → tag ids in list order, creating unknown names hidden and pushing their names onto `made`; `rulesCarry(rules,zones)` → a deep copy with `needs` entries for zones not in `zones` dropped, or `undefined` when nothing is left; `rulesDropZone(cyc,zoneId)`. `parseStaffList` rows gain `tags` (the raw cell); `applyStaffList` returns `{created,updated,tagsMade}` and writes `tags.import` when it created any.

- [ ] **Step 1: Write the failing tests.** Save as `$SP/s3-7-suite.py`:

```python
# file: s3-7-suite.py
rep(r'''      // ---- tags and rules: later tasks add their tests above this line''', r'''      // ---- the import's Tags column and the carry-forward
      T("import: the Tags column creates missing tags hidden, replaces a person's tags when filled, and leaves them alone when empty", (function(){
        state(); S.staff[0].name="Ng, Ava"; S.staff[1].name="Lee, Sam";   // the import matches a Surname, Given name row to a person of that name
        var p=parseStaffList([["Surname","Given name","Tags"],["Ng","Ava","senior; Night lead"],["Lee","Sam",""],["New","Pat","Night lead, Senior"]]);
        var res=applyStaffList(p.rows); var nl=tagList(S).find(function(t){ return t.name==="Night lead"; }), pat=S.staff.find(function(s){ return s.name==="New, Pat"; });
        return p.rows[0].tags==="senior; Night lead" && p.rows[1].tags==="" && !!nl && nl.show===undefined && JSON.stringify(S.staff[0].tags)===JSON.stringify(["t1",nl.id]) && JSON.stringify(S.staff[1].tags)==='["t1"]' && !!pat && JSON.stringify(pat.tags)===JSON.stringify(["t1",nl.id]) &&
               JSON.stringify(res.tagsMade)==='["Night lead"]' && S.audit.some(function(a){ return a.action==="tags.import"&&/Night lead/.test(a.detail); }) && tagList(S).length===3 && /"Tags/.test(downloadStaffTemplate.toString()); })());
      T("carry-forward: the next cycle deep-copies the rules and drops those for zones that are gone; removing a zone drops its rule; an empty block goes", (function(){
        state(); confirm=function(){ return true; }; var Z=c.settings.zones; var a=rulesCarry(c.settings.rules,Z), b=rulesCarry(c.settings.rules,[Z[1],Z[2]]), d=rulesCarry({needs:{z1:["t2"]}},[Z[1]]), e=rulesCarry(undefined,Z);
        var same=JSON.stringify(a)===JSON.stringify(c.settings.rules) && a!==c.settings.rules && a.mins!==c.settings.rules.mins;
        prepareNext(); var nc=S.cycles[1]; var copied=JSON.stringify(nc.settings.rules)===JSON.stringify(c.settings.rules); nc.settings.rules.mins[0].n.AM[0]=9; var indep=c.settings.rules.mins[0].n.AM[0]===1;
        S.activeId="cr"; rulesDropZone(c,"z1"); var dropped=!("needs" in c.settings.rules) && c.settings.rules.mins.length===1; c.settings.rules={needs:{z2:["t1"]}}; rulesDropZone(c,"z2"); var gone=!("rules" in c.settings);
        return same && JSON.stringify(b)==='{"mins":[{"tag":"t1","n":{"AM":[1,1,1],"PM":[1,1,1]}}]}' && d===undefined && e===undefined && copied && indep && dropped && gone; })());
      T("carry-forward: a new cycle made by the roster import carries the rules over", (function(){
        state(); var p={dates:[D(36),D(37),D(38),D(39),D(40),D(41),D(42)],staff:["Ava Ng"],assigns:{},skipped:[]}; p.assigns["Ava Ng|"+D(36)]={kind:"clinical",period:"AM",role:"Triage"};
        var nc=applyRosterImport(p,null); return !!nc && JSON.stringify(nc.settings.rules)===JSON.stringify(c.settings.rules) && nc.settings.rules!==c.settings.rules; })());

      // ---- tags and rules: later tasks add their tests above this line''')
```

- [ ] **Step 2: Apply it and run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/s3-7-suite.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1`, then a `HARNESS ERROR:` line — `rulesCarry` does not exist yet (the import test fails first).

- [ ] **Step 3: Implement.** Save as `$SP/s3-7-app.py`:

```python
# file: s3-7-app.py
rep(r'''/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''',
r'''function tagsFromCell(str,made){   // "Senior; Triage-trained" → tag ids in list order; a name the group does not have becomes a new tag, hidden by default, and its name goes onto made
  const ids=[]; String(str||"").split(/[;,]/).map(x=>x.trim()).filter(Boolean).forEach(name=>{ let t=tagList(S).find(x=>String(x.name).toLowerCase()===name.toLowerCase());
    if(!t){ t={id:"t"+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36)+ids.length.toString(36),name:name.slice(0,40)}; (S.tags=Array.isArray(S.tags)?S.tags:[]).push(t); if(made)made.push(t.name); }
    if(ids.indexOf(t.id)<0)ids.push(t.id); });
  const order=tagList(S).map(t=>t.id); return ids.sort((a,b)=>order.indexOf(a)-order.indexOf(b)); }
function rulesCarry(rules,zones){   // a deep copy for the next cycle, without needs for zones it does not have; undefined when nothing is left
  if(!rules||typeof rules!=="object")return undefined; const c=JSON.parse(JSON.stringify(rules)), ids=(zones||[]).map(z=>z.id);
  if(c.needs){ Object.keys(c.needs).forEach(z=>{ if(ids.indexOf(z)<0||!Array.isArray(c.needs[z])||!c.needs[z].length)delete c.needs[z]; }); if(!Object.keys(c.needs).length)delete c.needs; }
  if(c.mins&&!c.mins.length)delete c.mins;
  return Object.keys(c).length?c:undefined; }
function rulesDropZone(cyc,zoneId){ const r=cyc&&cyc.settings&&cyc.settings.rules; if(!r||!r.needs||!(zoneId in r.needs))return; delete r.needs[zoneId]; if(!Object.keys(r.needs).length)delete r.needs; if(!Object.keys(r).length)delete cyc.settings.rules; }   // a zone that goes takes its rule with it
/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------''')
rep(r'''pay:find("payroll","employee"), mode:find("mode")};''', r'''pay:find("payroll","employee"), mode:find("mode"), tags:find("tag")};''')
rep(r'''mode:ci.mode>=0?String(row[ci.mode]==null?"":row[ci.mode]).trim().toLowerCase():""});''', r'''mode:ci.mode>=0?String(row[ci.mode]==null?"":row[ci.mode]).trim().toLowerCase():"", tags:ci.tags>=0?String(row[ci.tags]==null?"":row[ci.tags]).trim():""});''')
rep(r'''  let created=0, updated=0;
  rows.forEach(rw=>{ const fullName=rw.giv?(rw.sur+", "+rw.giv):rw.sur;''', r'''  let created=0, updated=0; const made=[];
  rows.forEach(rw=>{ const fullName=rw.giv?(rw.sur+", "+rw.giv):rw.sur;''')
rep(r'''    if(rw.mode&&["self","fixed","preference"].indexOf(rw.mode)>=0)s.mode=rw.mode;
  });
  logAudit("import.stafflist",created+" added, "+updated+" updated","admin"); save();
  return {created:created, updated:updated};''', r'''    if(rw.mode&&["self","fixed","preference"].indexOf(rw.mode)>=0)s.mode=rw.mode;
    if(rw.tags){ const got=tagsFromCell(rw.tags,made); if(got.length)s.tags=got; else delete s.tags; }   // a filled Tags cell replaces the person's tags; an empty one leaves them alone
  });
  if(made.length)logAudit("tags.import",made.length+" tag"+(made.length>1?"s":"")+" created, hidden: "+made.join(", "),"admin");
  logAudit("import.stafflist",created+" added, "+updated+" updated","admin"); save();
  return {created:created, updated:updated, tagsMade:made};''')
rep(r'''toast("Staff imported — "+res.created+" added, "+res.updated+" updated.");''', r'''toast("Staff imported — "+res.created+" added, "+res.updated+" updated."+(res.tagsMade&&res.tagsMade.length?" New tags, hidden until you tick Show: "+res.tagsMade.join(", ")+".":""));''')
rep(r'''"Payroll #","Mode (self/fixed/preference)"];''', r'''"Payroll #","Mode (self/fixed/preference)","Tags (Senior; Triage-trained)"];''')
rep(r'''      shiftTimes:ss.shiftTimes?JSON.parse(JSON.stringify(ss.shiftTimes)):undefined, fatigue:ss.fatigue?JSON.parse(JSON.stringify(ss.fatigue)):undefined }};''',
    r'''      shiftTimes:ss.shiftTimes?JSON.parse(JSON.stringify(ss.shiftTimes)):undefined, fatigue:ss.fatigue?JSON.parse(JSON.stringify(ss.fatigue)):undefined,
      rules:rulesCarry(ss.rules,(ss.zones||S.zones||[])) }};   // a prepared cycle keeps its rules; without this it would silently lose them''')
rep(r'''  S.zones=_prevZones;   // restore; render() re-hydrates from the now-active cycle''', r'''  S.zones=_prevZones;   // restore; render() re-hydrates from the now-active cycle
  const _rc=rulesCarry(cset().rules,cyc.settings.zones); if(_rc)cyc.settings.rules=_rc;   // the rules come along, less any for a zone the new cycle does not have''')
rep(r'''    rowEl.querySelector(".z-del").onclick=()=>{ocPin(active());cset().zones=(cset().zones||S.zones).filter(x=>x.id!==id);S.zones=cset().zones;save();render();};''',
    r'''    rowEl.querySelector(".z-del").onclick=()=>{ocPin(active());rulesDropZone(active(),id);cset().zones=(cset().zones||S.zones).filter(x=>x.id!==id);S.zones=cset().zones;save();render();};''')
```

- [ ] **Step 4: Apply it and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/s3-7-app.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 10`, then `949 passed, 0 failed`.

- [ ] **Step 5: Commit.**

```bash
git add app.html deploy/app.html preview.html deploy/demo.html tests/suite.js
git commit -q -m "Tags and rules: the staff list import takes a Tags column (unknown names become hidden tags; a filled cell replaces, an empty one leaves alone) and the template carries it; a prepared or imported cycle carries its rules, less any for a zone it no longer has, and removing a zone drops its rule" && git log --oneline -1
```

---

### Task 8: Release — prove the guards, the release note, the synced copies

**Files:**
- Modify: `app.html` (`WHATS_NEW`, `const BUILD`), `CHANGELOG.md`, `deploy/app.html`, `preview.html`, `deploy/demo.html`
- Test: `tests/suite.js` (the `tags and rules` block), `$SP/s3-mutate.py`

- [ ] **Step 1: Write the failing test for the release copy.** Save as `$SP/s3-8-suite.py`:

```python
# file: s3-8-suite.py
rep(r'''      // ---- tags and rules: later tasks add their tests above this line''', r'''      // ---- release
      var _rel926=WHATS_NEW.filter(function(e){ return e.on==="2026-09-26"; })[0];
      T("release: What's new names tags and rules on the release day, in three lines", !!_rel926 && /Tags/.test(_rel926.title) && _rel926.lines.length===3 && _rel926.lines.some(function(l){ return /Rules card/.test(l); }) && _rel926.lines.some(function(l){ return /Tags column/.test(l); }) && BUILD>="2026-09-26");

      // ---- tags and rules: later tasks add their tests above this line''')
```

- [ ] **Step 2: Write What's new, the build date and the changelog.** Save as `$SP/s3-8-app.py`:

```python
# file: s3-8-app.py
rep(r'''const BUILD="2026-09-24";''', r'''const BUILD="2026-09-26";''')
rep(r'''const WHATS_NEW=[{on:"2026-09-17",title:"Who's on across the department"''',
    r'''const WHATS_NEW=[{on:"2026-09-26",title:"Tags on people, rules on slots",lines:["Admins can tag people (a grade, a credential) under Settings → Group → Tags, and each cycle's Rules card can say a slot needs a tag or that every AM and PM needs at least so many holders.","Booking, claims, swaps and the auto-draft follow the rules and say why a place is held; an admin can still place anyone behind a warning, and a shortfall shows as a gap.","The staff list import takes a Tags column, and tags ticked Show sit beside names on the Day board and the day sheet."]},{on:"2026-09-17",title:"Who's on across the department"''')
```

Save as `$SP/s3-8-changelog.py`:

```python
# file: s3-8-changelog.py
rep(r'''# Myrosta — changelog

## 24 Sep 2026 — Phone: a date box is as wide as the space it is given''', r'''# Myrosta — changelog

## 26 Sep 2026 — Tags on people, rules on slots

- **Tags.** Settings → Group gains a Tags card: a tag is a label on a person (a grade, a credential, a skill) — add, rename, tick *Show on the roster*, and *Who holds this?* opens a checklist. A tag in use cannot be removed; the refusal gives the counts. The Staff tab shows tags as chips, with ticks in a person's detail and a Tag filter, and the staff list import takes a **Tags** column ("Senior; Triage-trained"), creating any tag it does not know, hidden. A person sees their own tags on My shifts.
- **Rules, per cycle.** Settings → This cycle gains a Rules card after Cover: *slots that need a tag* (a person must hold every tag a zone asks for) and *minimums* (at least so many holders of a tag in each AM and PM, with separate numbers for weekdays, weekends and public holidays). The card says the rules in plain words, and a prepared or imported cycle carries them, less any for a zone it no longer has.
- **One judge, asked everywhere.** Booking, the sheet's picks and batch confirm, open-shift claims and give-aways, swaps (as a pair, from either side), the admin's cell editor (a warning, then *Place anyway*, written to the audit log as `rules.override`) and the auto-draft (holders first, never a slot they lack a tag for, a place left empty rather than filled wrongly). Every refusal names its reason: "Triage needs Triage-trained." or "Held for a Senior — Tue 29 Sep AM still needs 1, and this is the last place." The last places are held using the largest shortfall, never the sum, so a person holding two tags is never refused a place that could still end well.
- **A shortfall is a gap.** From today onward a day short of a tag turns red, the short-slots list says what is missing and who was placed against a rule, and the Day board's cover chip and an open shift's line say what a half still needs. Nothing is ever removed over a tag rule: not by a sync, not by a lost tag, not by a fixed pattern. Coming off a shift and leave are never judged.
- **Nothing changes for a group with no tags**: no new data is written, and the payroll file, the roster export and the department digest are byte for byte what they were. Tags never leave the group. `app.html` only — no SQL, no Edge Function.

## 24 Sep 2026 — Phone: a date box is as wide as the space it is given''')
```

- [ ] **Step 3: Apply all three and run the tests.**

```bash
python3 $SP/rep.py tests/suite.js $SP/s3-8-suite.py
python3 $SP/rep.py app.html $SP/s3-8-app.py
python3 $SP/rep.py CHANGELOG.md $SP/s3-8-changelog.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|ERROR|passed"
```

Expected: `replacements: 1` three times, then `950 passed, 0 failed` and no lint line.

- [ ] **Step 4: Prove the guards — every guard broken once must fail a test.** Save as `$SP/s3-mutate.py` and run it from OUTSIDE the repo (it copies the repo to a scratch directory, applies one mutation at a time, and runs the suite):

```python
# file: s3-mutate.py
import os, pathlib, shutil, subprocess, sys
root = pathlib.Path(os.environ.get("ROOT", "/Users/ranjithkandavelu/Desktop/Claude/Myrosta")).resolve()
work = pathlib.Path(os.environ["SP"]) / "s3mut" / "work"; work.parent.mkdir(parents=True, exist_ok=True)
BS = chr(92)
def fix(t): return t.replace("@U@", BS + "u")
M = [
 ("judge always yes", "o=o||{}; if(!rulesPresent(cyc))return {ok:true};", "o=o||{}; return {ok:true};"),
 ("slot needs nothing", "const need=(r.needs[zoneId]||[]).filter(t=>tagById(st,t)), miss=need.find(t=>!hasTag(st,p,t));", "const need=(r.needs[zoneId]||[]).filter(t=>tagById(st,t)), miss=null;"),
 ("held off by one", "if(worst&&open-1<worst.short){", "if(worst&&open<worst.short){"),
 ("sum, not largest", "if(short>0&&(!worst||short>worst.short))worst={tag:s.tag,short:short};", "if(short>0)worst={tag:s.tag,short:(worst?worst.short:0)+short};"),
 ("public holiday not first", "if(((st&&st.publicHolidays)||[]).indexOf(isoD)>=0)return 2; const w=parseISO(isoD).getDay();", "const w=parseISO(isoD).getDay();"),
 ("booking never asks", "const _rj=ruleJudge(_cy,S,sid,isoD,_fills,zoneId,{type:typeId}); if(!_rj.ok)return {ok:false,reason:_rj.reason};", ""),
 ("giver still counted", "{type:typeId,without:giveFrom?[giveFrom]:[]}", "{type:typeId,without:[]}"),
 ("swap never asks", "const rj=ruleSwapJudge(S,cA,r.from,r.dateA,sA,cB,r.peerId,r.dateB,sB); if(rj)return {ok:false,reason:rj};", ""),
 ("offer not filtered", "&&!ruleSwapJudge(S,c,o.from,o.dateA,mine,c,sid,x.d,x.shift)); }", "); }"),
 ("no red day for a breach", 'if(isoD>=iso(new Date())&&ruleBreaches(active(),S,isoD).length)return"r";', ""),
 ("past days re-judged", "if(isoD>=today)ruleBreaches(cyc,S,isoD).forEach(", "ruleBreaches(cyc,S,isoD).forEach("),
 ("empty tags written as []", "if(next.length)s.tags=next; else delete s.tags;", "s.tags=next;"),
 ("removal never refused", "if(u.people||u.cycles)return {ok:false,reason:", "if(false)return {ok:false,reason:"),
 ("import merges instead of replacing", "if(rw.tags){ const got=tagsFromCell(rw.tags,made); if(got.length)s.tags=got; else delete s.tags; }", "if(rw.tags){ const got=tagsFromCell(rw.tags,made); s.tags=(s.tags||[]).concat(got.filter(x=>(s.tags||[]).indexOf(x)<0)); }"),
 ("carry-forward shallow", "const c=JSON.parse(JSON.stringify(rules)), ids=(zones||[]).map(z=>z.id);", "const c=Object.assign({},rules), ids=(zones||[]).map(z=>z.id);"),
 ("auto-draft ignores holders", "if(rulesPresent(cyc)){ const booked=ruleCounts(cyc,st,isoD,null)[period], short=", "if(false){ const booked=ruleCounts(cyc,st,isoD,null)[period], short="),
 ("cell editor never warns", 'if(!confirm(j.reason+"\\n\\nPlace "+nameOf(sid)+" anyway?"))return {ok:false,over:null}; return {ok:true,over:j.reason}; }', "return {ok:true,over:null}; }"),
 ("empty rules block kept", "if(Object.keys(out).length)cyc.settings.rules=out; else delete cyc.settings.rules;", "cyc.settings.rules=out;"),
]
def sync():
    subprocess.run(["rsync","-a","--delete","--exclude",".git","--exclude","node_modules","--exclude","graphify-out","--exclude",".superpowers","--exclude","*.zip",str(root)+"/",str(work)+"/"],check=True)
survived = []
for name, old, new in M:
    sync(); app = work / "app.html"; t = app.read_text(encoding="utf-8"); o = fix(old); n = fix(new)
    if t.count(o) != 1: print("ANCHOR MISSING for %r: %d" % (name, t.count(o))); survived.append(name); continue
    app.write_text(t.replace(o, n), encoding="utf-8")
    subprocess.run([sys.executable, "tools/build-demo.py"], cwd=work, capture_output=True)
    out = subprocess.run([sys.executable, "tests/run.py"], cwd=work, capture_output=True, text=True).stdout
    killed = ("failed" in out and " 0 failed" not in out) or "HARNESS ERROR" in out
    print(("killed  " if killed else "SURVIVED") + "  " + name)
    if not killed: survived.append(name)
print("mutations:", len(M), "survived:", len(survived)); sys.exit(1 if survived else 0)
```

```bash
SP=$SP ROOT=/Users/ranjithkandavelu/Desktop/Claude/Myrosta python3 $SP/s3-mutate.py
```

Expected: eighteen `killed` lines and `mutations: 18 survived: 0`. A `SURVIVED` line means a guard has no test that bites: add the test to the block before going on, never weaken the guard. (The deploy lint fails inside the mutation copy because its served copies are stale; that is why a kill is read from the suite's own `failed` count, which is non-zero either way — a mutant that only trips the deploy lint would be a false kill, so read each named line, not only the total.)

- [ ] **Step 5: Commit the release.**

```bash
python3 tests/run.py deploy/app.html 2>&1 | tail -1
git add app.html deploy/app.html preview.html deploy/demo.html tests/suite.js CHANGELOG.md
git commit -q -m "Tags and rules release: tags on people, rules on slots — a Tags card on the group, a Rules card on the cycle, one judge asked by booking, claims, swaps, the cell editor and the auto-draft, a shortfall shown as a gap, the import's Tags column and the carry-forward. 950 passes, 18 mutations killed. app.html only" && git log --oneline -1
```

Then tell the owner: push; the live site carries build 26 Sep 2026 once Netlify has deployed. For SWIFT's nurses, at onboarding (S6): define the tags (RN, EEN, AIN), import the staff list with its Tags column, set the rules on their first cycle — the RN zone needs RN, and at least one RN in every AM and PM.

---

## As executed (26 Sep 2026)

Built with subagent-driven development on `main`, commits 525d329..HEAD; each task reviewed, the final whole-branch review on the most capable model. Departures from the text above, all reviewed:

- **Task 6, fix round 1 (2971a84):** the Who-holds search re-rendered the whole modal on every keystroke and scrambled typing after a backspace. `openTagWho` is now split into a pure `twListHTML(id)`, `twWire(root,id)` and a slim `openTagWho` whose search patches only `#twList`; a test pins the filter, the ticks and the escaping.
- **Task 7, fix round 1 (1296c9d):** new-tag ids could collide across rows of one import in the same millisecond. Both mint sites use `tagNewId()` (timestamp + a session sequence + random, re-rolled while `tagById` finds it); a test holds the clock and the dice still.
- **Final-review fix wave (2015f2b):** the Tags column is found by its own name (`/^\s*tags?\b/`), never inside "percentage" or "stage"; a long tag name is trimmed and cut to 40 before matching, so it never duplicates; a period-only fixed pattern prefers a free zone the person holds the tags for and lands in a barred one only when nothing else is free; a filter for a gone tag shows everyone; the Day board chip skips past days; a give-away's line counts its giver as gone; the gaps row no longer says "(placed by an admin)"; the cell editor asks for the published-roster reason before any rule warning and does not warn again when the same cell is re-saved; `tags.*` and `rules.needs`/`rules.mins` file under Settings in the audit view, `tags.import` under Imports. Nine tests added, one amended; the fixed-pattern test then strengthened to a one-week cycle.
- **Accepted wording departures from the spec:** the cell editor's warning is the browser's own OK/Cancel confirm, not "Place anyway" / "Cancel"; at swap approval a rule breach auto-declines the swap (the admin re-places through the cell editor); an admin on the day sheet is refused like staff — only the cell editor offers the override.
- **Parked, with rulings:** `S.tags` merges as one whole key (the same class as zones today); with rules on, the roster views recompute the breach list per day (measured 12–22 ms per view at 40 staff and 12 weeks; an index by date would remove most of it); the mutation script counts the scratch copy's stale deploy lint as a failure and needs its companion check to tell a true kill.
- **Counts:** 915 → 961 passes; 18 of 18 mutants killed; BUILD 2026-09-26.

