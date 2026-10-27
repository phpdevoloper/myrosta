# SWIFT onboarding: nurses, scribes and admin (S6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put SWIFT's nurses, scribes and admin staff on Myrosta for Monday 26 October 2026 with the consultants: their people, settings and first rosters with true times, one staff guide and one managers' guide, and a runbook for the four weeks.

**Architecture:** One app change (the leave import's *Treat any filled cell as unavailable* tick, and a name written Given Surname matching Surname, Given) and one repo tool, `tools/group-files.py`, which turns a manager's fortnight-grid workbook into the three files Myrosta already imports (staff list, roster, unavailability grid) plus a settings checklist and a report, with a `--check` that runs the files through the app's own importers under JavaScriptCore and a `--selftest` the suite runs as a lint. Everything that carries a name lives in `~/Desktop/Myrosta site 2/groups/` (the per-group configs, the built files, the reports) and never in the repo. The guides and the runbook are documents in the site-2 folder.

**Tech Stack:** Single-file vanilla JS app (`app.html`), tests under JavaScriptCore via `osascript` (`python3 tests/run.py`), Python 3 with `openpyxl` for the tool, headless Chrome for the guides' PDFs. No SQL, no Edge Function.

**Spec:** `docs/superpowers/specs/2026-09-27-swift-onboarding-s6-design.md` (read it first; this plan argues from it). Programme: `docs/superpowers/specs/2026-09-16-staff-group-modules-programme.md`.

## Global Constraints

- **Nothing changes with the tick off.** `parseLeaveAOA(aoa)` returns exactly what it did, key for key; Werribee's planner import is untouched; every existing test passes unchanged. The tick is off by default and never remembered.
- **With the tick on**, every non-empty cell that is not a recognised leave code becomes `UA` for that day, a half-day mark ("AM", "PM") included; a recognised code still imports as itself; runs of one code merge into blocks as today; the audit line `import.leave` ends with "any filled cell = UA".
- **Names as people say them.** `findStaffByName` gains one more try: the letters of the name in the other order (Given Surname ↔ Surname, Given) when that names exactly one person; two people whose letters coincide are never guessed between. Every import goes through it.
- **The tool writes Myrosta's own formats and nothing else:** the staff list (Surname, Given name, Email, Mobile, Title, Tags, Hours per fortnight, Mode), the roster layout (a name column and one column per day of the cycle, cells `HHMM-HHMM Zone`), the leave layout (a name column and a date per column, one sheet named for the cycle's year). Names are stored "Surname, Given". A written day whose times match no type lands on its half's type with its own hours (S4's import rule) and is listed in the report; a third person in a two-slot zone, or two people in one zone and half, is a clash in the report, never placed silently.
- **Personal data stays out of the repo:** the workbooks, the contacts sheets, the configs, the built files, the reports, the guides and the runbook live in `~/Desktop/Myrosta site 2/`. The tool's self-test uses synthetic names only. The repo gets `tools/group-files.py` and its lint line.
- **The lints stay green:** `audit_words` (every `logAudit` key a string literal with an `AUDIT_WORDS` sentence — no new key here), `build` (BUILD = the changelog's newest heading = `WHATS_NEW[0].on` = 2026-09-28, three site-neutral lines, no curly quotes in line 2), `deploy` and `demo` (synced copies, rebuilt demo), the css lints (no hex or px font sizes outside :root), and the new `group files` lint.
- Copy: plain words, sentence case. Test dates relative to today; never pin `WHATS_NEW[0]` or `BUILD===` (find entries by date). `tests/oncall-golden.js` is never regenerated.
- Commit on `main`; do not push (the owner pushes from GitHub Desktop).

## Decisions this plan takes where the spec is silent or over-specified

1. **The converter is a repo tool, the configs are not.** The spec put the script in the site-2 folder; the generic part (`tools/group-files.py`, no names in it) goes in the repo so its self-test runs as a lint on every build and the next site gets it for free. Each group's config (`swift-<group>.json`: workbook, sheets, layout, sections, types, zones, name overrides) stays in `~/Desktop/Myrosta site 2/groups/`.
2. **The checklist maps the group's types onto the Shift types card the way an admin applies them:** the first morning-half type renames the builtin AM (its id stays `AM`), the first evening-half type renames the builtin PM, the rest are added; On-call and CST are switched off. `--check` seeds the same, so what it reports is what the admin gets.
3. **Zones with two slots (Desk 1/Desk 2, Scribe 1/Scribe 2) are filled in row order within a half;** the nurses keep one zone per grade (RN, EEN, AIN) as the spec says, and a second RN in the same half is a clash for the NUM to resolve on the sheet (or by adding a zone) before the import — the report names the day.
4. **The unavailability file carries only people on the roster** (the year grids list people who no longer work there); names left out are listed in the report. A year sheet whose dates were never rolled forward to its own year (a copied "Staff Leave 2027" carrying 2026 dates) is rolled to the sheet's year and reported.
5. **Hours per fortnight** come from a work type like "PT 60" (the number); casual work types leave the column empty, so the app's default stands. Shifts per fortnight are left to the preset's default (a cap, not a target).
6. **The tick's UI is one label under the leave planner's file input on the Import card**, read at import time; the confirm names the rule when it is on.
7. **The release is dated 28 Sep 2026.** If it ships on another day, change `2026-09-28` in `WHATS_NEW`, `const BUILD` and the changelog heading together.
8. **`--check` counts unavailable days from the leave records and lists days a person is both rostered and marked unavailable** (the shift stands in the app, as it always has; the manager decides which is right).

## How to edit `app.html`, `tests/suite.js`, `tests/run.py` and the docs

`app.html` is one large file with very long lines, and much of its script writes characters as JavaScript escapes (a backslash, `u`, four hex digits). Tool parameters can silently turn those escapes into the characters themselves, so an exact-match edit then fails, or writes the wrong thing. Make every edit through this helper, and write each such escape as `@U@` followed by the four hex digits (`@U@2019` for a right single quote, `@U@2014` for an em dash, `@U@2013` for an en dash, `@U@00b7` for a middle dot, `@U@2192` for an arrow). The helper turns `@U@` back into the escape in both the text it looks for and the text it writes.

- [ ] **Create the helpers once**, in your scratchpad directory (called `$SP` below):

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

Each task's edit files below are fenced blocks that begin `# file: NAME`; save each one as `$SP/NAME` exactly as printed (a script can extract them: every fenced block whose first line is `# file: NAME`). Each `rep(old,new)` must match exactly once, or the helper stops without writing. Baseline before Task 1: **998 passed** (S4's build).

---

### Task 1: The unavailability tick, names as people say them, and the release

**Files:**
- Modify: `app.html` (`parseLeaveAOA`, `applyLeaveImport`'s audit line, the Import card's leave field, `importFile`'s leave branch, `findStaffByName`, `const BUILD`, `WHATS_NEW`), `CHANGELOG.md`, `deploy/app.html`, `preview.html`, `deploy/demo.html`
- Test: `tests/suite.js` (new `onboarding` block before the suite's closing render line), `$SP/s6-1-mutate.py`

**Interfaces:**
- Consumes: `normCode`, `findHeaderRow`, `cellISO`, `splitName`, `normName`, `isNameCell`, `addLeave`, `logAudit`.
- Produces: `parseLeaveAOA(aoa,o)` with `o.anyFilled` (the result gains `anyFilled:true` only when on); `applyLeaveImport(p)` writes " · any filled cell = UA" when `p.anyFilled`; `#impLeaveAny` on the Import card; `findStaffByName` matches the swapped name order when unique.

- [ ] **Step 1: Write the failing tests.** Save as `$SP/s6-1-suite.py`:

```python
# file: s6-1-suite.py
rep(r'''  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''', r'''  // ---- onboarding (S6): an UNAVAILABILITIES grid imports with any filled cell as UA, and a name written Given Surname matches Surname, Given.
  // Spec: docs/superpowers/specs/2026-09-27-swift-onboarding-s6-design.md. Dates are relative to today.
  (function(){
    var keep={S:S,dd:dailyDate,cf:confirm,toast:toast};
    var D=function(n){ return iso(addDays(new Date(),n)); };
    var c=null, said=[];
    function state(){
      var Z=[{id:"z1",name:"Triage",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:0,pmMax:2},unlockOrder:"both",rosterMode:"rolling"};
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Ng, Ava",quota:20,eft:1},{id:"s2",name:"Sam Lee",quota:20,eft:1},{id:"s3",name:"Lee, Sam",quota:20,eft:1}],
         cycles:[{id:"co",cycle:{start:D(-7),weeks:6},status:"published",archived:false,settings:set,roles:{s1:{in:true},s2:{in:true},s3:{in:true}},assign:{}}],
         activeId:"co",viewAs:"admin",tab:"setup",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],publicHolidays:[]};
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; dailyDate=null; }
    function grid(cells){ var hdr=["Name"]; for(var i=0;i<7;i++)hdr.push(D(i)); return [["UNAVAILABILITIES"],hdr,["Ng, Ava"].concat(cells)]; }   // a year grid's shape: a date per column, a name per row, a mark in a cell
    function last(k){ return (S.audit||[]).filter(function(a){ return a.action===k; })[0]||null; }
    toast=function(m){ said.push(String(m)); };
    try{
      T("unavailability: with the tick every filled cell that is not a leave code becomes UA, a half-day mark included, runs merge, and a real code stays itself", (function(){
        state(); var p=parseLeaveAOA(grid(["X","X","X",null,"AL","Korea","AM"]),{anyFilled:true});
        var L=p.leave.map(function(l){ return l.code+" "+l.from+" "+l.to; });
        return !p.error && p.anyFilled===true && L.length===3 && L[0]==="UA "+D(0)+" "+D(2) && L[1]==="AL "+D(4)+" "+D(4) && L[2]==="UA "+D(5)+" "+D(6) && p.staff.length===1 && p.staff[0].name==="Ng, Ava"; })());
      T("unavailability: with the tick off the import is what it always was: marks are ignored, only leave codes import, and the result carries no new key", (function(){
        state(); var aoa=grid(["X","X","X",null,"AL","Korea","AM"]); var a=parseLeaveAOA(aoa), b=parseLeaveAOA(aoa,{}), d=parseLeaveAOA(aoa,{anyFilled:false});
        return JSON.stringify(a)===JSON.stringify(b) && JSON.stringify(a)===JSON.stringify(d) && a.leave.length===1 && a.leave[0].code==="AL" && !("anyFilled" in a); })());
      T("unavailability: applying a ticked import marks the days unavailable and says so in the audit line", (function(){
        state(); var p=parseLeaveAOA(grid(["X",null,null,null,null,null,"Personal leave"]),{anyFilled:true}); var n=applyLeaveImport(p);
        var a=last("import.leave"); var s0=getShift("s1",D(0)), s6=getShift("s1",D(6)), s1=getShift("s1",D(1));
        return n===2 && s0.kind==="leave" && s0.code==="UA" && s6.kind==="leave" && s6.code==="UA" && s1.kind==="off" && !!a && /any filled cell = UA$/.test(a.detail); })());
      T("unavailability: applying an unticked import writes the audit line it always did", (function(){
        state(); var p=parseLeaveAOA(grid([null,null,"AL",null,null,null,null])); applyLeaveImport(p); var a=last("import.leave");
        return !!a && /1 staff · 1 leave blocks$/.test(a.detail); })());
      T("names: a name written Given Surname finds the person stored Surname, Given, and the other way round, but never when two people could be meant", (function(){
        state(); var a=findStaffByName("Ava Ng"), b=findStaffByName("Ng, Ava"), d=findStaffByName("ava  ng");
        var amb=findStaffByName("Sam Lee"), amb2=findStaffByName("Lee, Sam");   // s2 is stored "Sam Lee" and s3 "Lee, Sam": each exact match wins, the swapped form of either would name two people
        S.staff.pop(); var one=findStaffByName("Lee, Sam");   // with s3 gone, "Lee, Sam" is the swapped form of s2 alone
        S.staff.shift(); S.staff.push({id:"s4",name:"Ava Ng"},{id:"s5",name:"Ava  Ng"}); var two=findStaffByName("Ng, Ava");   // two people whose letters coincide in the other order: nobody is guessed
        return !!a && a.id==="s1" && !!b && b.id==="s1" && !!d && d.id==="s1" && !!amb && amb.id==="s2" && !!amb2 && amb2.id==="s3" && !!one && one.id==="s2" && two===null && isNameCell("Ava Ng-Lee")===true && findStaffByName("Nobody Here")===null; })());
      // ---- release
      var _rel928=WHATS_NEW.filter(function(e){ return e.on==="2026-09-28"; })[0];
      T("release: What's new names the unavailability tick on the release day, in three lines", !!_rel928 && /unavail/i.test(_rel928.title) && _rel928.lines.length===3 && _rel928.lines.some(function(l){ return /Treat any filled cell as unavailable/.test(l); }) && !/[‘’“”]/.test(_rel928.lines[1]) && BUILD>="2026-09-28");
      // ---- onboarding: later tasks add their tests above this line
    } finally { S=keep.S; dailyDate=keep.dd; confirm=keep.cf; toast=keep.toast; /* onboarding: restore */ hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();''')
```

- [ ] **Step 2: Run the tests to see them fail.**

```bash
python3 $SP/rep.py tests/suite.js $SP/s6-1-suite.py
python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|HARNESS|ERROR|passed"
```

Expected: `replacements: 1`, then four failures (the ticked parse, the ticked apply, the names test and the release test) and `1000 passed, 4 failed` — the two "tick off" tests pass already, because that path is unchanged.

- [ ] **Step 3: Implement, and write the release.** Save as `$SP/s6-1-app.py`:

```python
# file: s6-1-app.py
rep(r'''function parseLeaveAOA(aoa){
  const hr=findHeaderRow(aoa);if(hr<0)return {error:"No date header row found"};
  const dcols=[];(aoa[hr]||[]).forEach((v,c)=>{const di=cellISO(v);if(di)dcols.push({c:c,iso:di});});
  const staff=[],leave=[];''', r'''function parseLeaveAOA(aoa,o){ const anyF=!!(o&&o.anyFilled);   // anyFilled: an UNAVAILABILITIES grid, where any mark in a cell means that day is unavailable (UA) — a half-day mark included; a real leave code still imports as itself
  const hr=findHeaderRow(aoa);if(hr<0)return {error:"No date header row found"};
  const dcols=[];(aoa[hr]||[]).forEach((v,c)=>{const di=cellISO(v);if(di)dcols.push({c:c,iso:di});});
  const staff=[],leave=[];''')
rep(r'''    dcols.forEach(dc=>{const code=normCode(row[dc.c]);
      if(code){if(run&&run.code===code''', r'''    dcols.forEach(dc=>{const code=normCode(row[dc.c])||((anyF&&row[dc.c]!=null&&String(row[dc.c]).trim()!=="")?"UA":null);
      if(code){if(run&&run.code===code''')
rep(r'''  return {staff:staff,leave:leave,range:dcols.length?{from:dcols[0].iso,to:dcols[dcols.length-1].iso}:null};   // the sheet's date span — re-imports replace sheet-sourced leave within it
}''', r'''  const out={staff:staff,leave:leave,range:dcols.length?{from:dcols[0].iso,to:dcols[dcols.length-1].iso}:null};   // the sheet's date span — re-imports replace sheet-sourced leave within it
  if(anyF)out.anyFilled=true; return out;   // the key is there only when the tick was on, so an ordinary planner import is what it always was
}''')
rep(r'''  logAudit("import.leave",p.staff.length+" staff · "+added+" leave blocks"+(cleared?" (replaced "+cleared+" previously imported)":""),"admin");save();return added;''', r'''  logAudit("import.leave",p.staff.length+" staff · "+added+" leave blocks"+(cleared?" (replaced "+cleared+" previously imported)":"")+(p.anyFilled?" · any filled cell = UA":""),"admin");save();return added;''')
rep(r'''      <div class="field"><label class="lbl" for="impLeave">Leave planner (.xlsx)</label><input type="file" id="impLeave" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("leave")}</div></div>''', r'''      <div class="field"><label class="lbl" for="impLeave">Leave planner (.xlsx)</label><input type="file" id="impLeave" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("leave")}</div><label class="muted small" style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" id="impLeaveAny"> Treat any filled cell as unavailable</label></div>''')
rep(r'''      const p=parseLeaveAOA(XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null}));
      if(p.error){toast("Leave import: "+p.error);return;}
      if(!confirm("Import leave planner (sheet '"+name+"')?\n\nStaff: "+p.staff.length+"\nLeave blocks: "+p.leave.length+"\n\nRe-importing REPLACES previously imported leave for these staff in this sheet's date range — no duplicates. Leave approved through the app is kept."))return;''', r'''      const _anyF=!!((document.getElementById("impLeaveAny")||{}).checked);   // an UNAVAILABILITIES grid: every mark is a day unavailable; never remembered between imports
      const p=parseLeaveAOA(XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null}),{anyFilled:_anyF});
      if(p.error){toast("Leave import: "+p.error);return;}
      if(!confirm("Import leave planner (sheet '"+name+"')?\n\nStaff: "+p.staff.length+"\nLeave blocks: "+p.leave.length+(p.anyFilled?"\nAny filled cell counts as unavailable (UA).":"")+"\n\nRe-importing REPLACES previously imported leave for these staff in this sheet's date range — no duplicates. Leave approved through the app is kept."))return;''')
rep(r'''  const k=normName(name); const m=S.staff.filter(x=>normName(x.name)===k); return m.length===1?m[0]:null; }   // letters only, when that names exactly one person; two people whose letters coincide are never guessed between''', r'''  const k=normName(name); const m=S.staff.filter(x=>normName(x.name)===k); if(m.length===1)return m[0];   // letters only, when that names exactly one person; two people whose letters coincide are never guessed between
  const sp=splitName(name); if(!sp.giv)return null; const k2=normName(String(name).indexOf(",")>=0?(sp.giv+sp.sur):(sp.sur+sp.giv)), m2=S.staff.filter(x=>normName(x.name)===k2); return m2.length===1?m2[0]:null; }   // "Ava Ng" is "Ng, Ava" (and the other way round): the letters in the other order, when that names exactly one person — a manager's grid writes names as people say them''')
rep(r'''const BUILD="2026-09-27";''', r'''const BUILD="2026-09-28";''')
rep(r'''const WHATS_NEW=[{on:"2026-09-27",title:"Own hours on a booking"''', r'''const WHATS_NEW=[{on:"2026-09-28",title:"Unavailability grids import as UA",lines:["The leave planner import gains a tick, Treat any filled cell as unavailable: with it on, every mark on a year grid (an X, a word, a half-day AM or PM) becomes a day unavailable, and a real leave code still imports as itself.","A name written the way people say it (Ava Ng) now matches the person stored surname first (Ng, Ava) in every import, when that can only mean one person.","Nothing changes with the tick off: a planner import reads exactly as before."]},{on:"2026-09-27",title:"Own hours on a booking"''')
```

Save as `$SP/s6-1-changelog.py`:

```python
# file: s6-1-changelog.py
rep(r'''# Myrosta — changelog

## 27 Sep 2026 — Own hours on a booking''', r'''# Myrosta — changelog

## 28 Sep 2026 — Unavailability grids import as UA

- **The tick.** Settings → Import → Leave planner gains *Treat any filled cell as unavailable*, off by default and never remembered. With it on, every mark on a year grid (an X, a word, a half-day AM or PM) becomes a day unavailable (UA), runs of days merge into one block as always, and a real leave code still imports as itself. The confirm says the rule is in force and the audit line `import.leave` ends with "any filled cell = UA".
- **Names as people say them.** `findStaffByName` gains a fourth try: a name written Given Surname matches the person stored Surname, Given (and the other way round), when the letters in the other order name exactly one person. Every import goes through it.
- **Nothing changes with the tick off**: `parseLeaveAOA` returns exactly what it did, key for key. For SWIFT's nurses, scribes and admin onboarding (S6).

## 27 Sep 2026 — Own hours on a booking''')
```

- [ ] **Step 4: Apply both and run the tests.**

```bash
python3 $SP/rep.py app.html $SP/s6-1-app.py
python3 $SP/rep.py CHANGELOG.md $SP/s6-1-changelog.py
python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|HARNESS|ERROR|passed"
```

Expected: `replacements: 9`, `replacements: 1`, then `1004 passed, 0 failed` and no lint line.

- [ ] **Step 5: Prove the guards.** Save as `$SP/s6-1-mutate.py` and run it from OUTSIDE the repo (it copies the repo to a scratch directory, applies one mutation at a time with the deploy copies kept in step, and runs the suite, naming the tests that killed each):

```python
# file: s6-1-mutate.py
import os, pathlib, re, shutil, subprocess, sys
root = pathlib.Path(os.environ["ROOT"]).resolve()
work = pathlib.Path(os.environ["SP"]) / "s6mut" / "work"; work.parent.mkdir(parents=True, exist_ok=True)
APP = "app.html"
M = [
 ("the tick ignored", APP, '||((anyF&&row[dc.c]!=null&&String(row[dc.c]).trim()!=="")?"UA":null)', ""),
 ("a real code turned UA under the tick", APP, 'const code=normCode(row[dc.c])||((anyF&&row[dc.c]!=null&&String(row[dc.c]).trim()!=="")?"UA":null);', 'const code=((anyF&&row[dc.c]!=null&&String(row[dc.c]).trim()!=="")?"UA":null)||normCode(row[dc.c]);'),
 ("the tick off leaves a key behind", APP, "if(anyF)out.anyFilled=true; return out;", "out.anyFilled=anyF; return out;"),
 ("the audit line says nothing", APP, '+(p.anyFilled?" · any filled cell = UA":"")', ""),
 ("the swapped name never matches", APP, 'const sp=splitName(name); if(!sp.giv)return null; const k2=normName(String(name).indexOf(",")>=0?(sp.giv+sp.sur):(sp.sur+sp.giv)), m2=S.staff.filter(x=>normName(x.name)===k2); return m2.length===1?m2[0]:null; }', "return null; }"),
 ("two people guessed between", APP, "return m2.length===1?m2[0]:null; }", "return m2.length?m2[0]:null; }"),
]
def sync():
    subprocess.run(["rsync","-a","--delete","--exclude",".git","--exclude","node_modules","--exclude","graphify-out","--exclude",".superpowers","--exclude","*.zip",str(root)+"/",str(work)+"/"],check=True)
survived = []
for name, rel, old, new in M:
    sync(); f = work / rel; t = f.read_text(encoding="utf-8")
    if t.count(old) != 1: print("ANCHOR MISSING for %r: %d" % (name, t.count(old))); survived.append(name); continue
    t = t.replace(old, new); f.write_text(t, encoding="utf-8")
    (work / "deploy" / "app.html").write_text(t, encoding="utf-8"); m = re.search(r'const CLOUD=\{ url:"[^"]*", key:"[^"]*",', t); (work / "preview.html").write_text(t.replace(m.group(0), 'const CLOUD={ url:"", key:"",', 1), encoding="utf-8")
    subprocess.run([sys.executable, "tools/build-demo.py"], cwd=work, capture_output=True)
    out = subprocess.run([sys.executable, "tests/run.py"], cwd=work, capture_output=True, text=True).stdout
    killed = ("failed" in out and " 0 failed" not in out) or "HARNESS ERROR" in out
    print(("killed  " if killed else "SURVIVED") + "  " + name)
    for l in out.splitlines():
        if l.startswith("FAIL") or "HARNESS" in l: print("          " + l[:150])
    if not killed: survived.append(name)
print("mutations:", len(M), "survived:", len(survived)); sys.exit(1 if survived else 0)
```

```bash
cd $SP && ROOT=/Users/ranjithkandavelu/Desktop/Claude/Myrosta SP=$SP python3 $SP/s6-1-mutate.py
```

Expected: `killed` on all 6 lines, each followed by the name of an `unavailability:` or `names:` test, and `mutations: 6 survived: 0`.

- [ ] **Step 6: Commit.**

```bash
git add app.html deploy/app.html preview.html deploy/demo.html tests/suite.js CHANGELOG.md
git commit -q -m "Unavailability grids import as UA: the leave import's Treat any filled cell as unavailable tick (off by default, never remembered; a half-day mark is a whole day; a real code stays itself; the audit line says so), and a name written Given Surname matches the person stored Surname, Given when that can only mean one person; BUILD 2026-09-28" && git log --oneline -1
```

---

### Task 2: `tools/group-files.py` and its lint

**Files:**
- Create: `tools/group-files.py` (the converter, its `--check` round trip and its `--selftest`)
- Modify: `tests/run.py` (a `group_files_lint` that runs the self-test against `app.html`, listed with the other lints)

**Interfaces:**
- Consumes: `tests/stubs.js` and `app.html`'s own functions under JavaScriptCore (`parseStaffList`, `applyStaffList`, `parseRosterAOA`, `applyRosterImport`, `parseLeaveAOA(...,{anyFilled:true})`, `applyLeaveImport`, `typeOf`, `fillsOf`, `leaveOn`, `render`), `openpyxl`.
- Produces: `python3 tools/group-files.py CONFIG.json [--out DIR] [--check] [--app PATH]` → `<prefix>-staff.xlsx`, `<prefix>-roster-<start>.xlsx`, `<prefix>-unavailability.xlsx`, `<prefix>-checklist.md`, `<prefix>-report.md` and, when the config's contacts sheet does not exist yet, `<prefix>-contacts-template.xlsx`; `python3 tools/group-files.py --selftest [--app PATH]` prints `selftest ok: …` or exits non-zero with what disagreed. The config schema is documented in the file's docstring and shown by the self-test's own config.

- [ ] **Step 1: Write the tool.** Save the block below as `tools/group-files.py` exactly (it is complete):

```python
# file: group-files.py
#!/usr/bin/env python3
"""Myrosta group files: turn a manager's fortnight-grid workbook into the three files Myrosta imports, plus a settings checklist and a report.

    python3 tools/group-files.py CONFIG.json            build the files next to the config (or --out DIR)
    python3 tools/group-files.py --selftest              a synthetic workbook, round-tripped through the app's own parsers

The workbook, the contacts sheet, the config and every output carry names and contact details: keep them outside the repo.
Layout the tool reads (the SWIFT managers' sheets, and any like them): monthly sheets holding fortnight blocks; each block starts
at a row whose first cell begins with the block marker ("Fortnight"), the row below carries the 14 dates, the row below that the
per-day column headings; then one row per person: name in column A, work type in column B, and per day a fixed group of columns
(Start, Finish, Break … and for nurses an On Call column first). A section row (a name-less row whose text matches a section) sets the
zone and tags for the rows beneath it. An unavailability sheet: a date per column on one row, a name per row, any mark in a cell.
"""
import argparse, datetime, json, pathlib, re, subprocess, sys, tempfile

try:
    import openpyxl
except ImportError:                                    # the self-test and every build need it; say so plainly
    sys.exit("openpyxl is needed: python3 -m pip install openpyxl")

HHMM = lambda t: t.strftime("%H:%M") if isinstance(t, (datetime.time, datetime.datetime)) else (str(t) if t else "")


def clean(v):
    return re.sub(r"\s+", " ", str(v).replace("\xa0", " ")).strip() if v is not None else ""


def to_date(v):
    if isinstance(v, datetime.datetime): return v.date()
    if isinstance(v, datetime.date): return v
    if isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}", v): return datetime.date.fromisoformat(v[:10])
    return None


def iso(d): return d.isoformat()


def split_name(n):
    """'Ava Ng' → ('Ng', 'Ava'); 'Ng, Ava' → the same; one word → (word, '')."""
    n = clean(n)
    if "," in n:
        a, b = n.split(",", 1); return a.strip(), b.strip()
    w = n.split(" ")
    return (w[-1], " ".join(w[:-1])) if len(w) > 1 else (n, "")


def stored_name(cfg, raw):
    """The name as Myrosta will store it: an override from the config, else 'Surname, Given' from the sheet's own words."""
    ov = (cfg.get("names") or {}).get(raw)
    if ov: return ov
    sur, giv = split_name(raw)
    return (sur + ", " + giv) if giv else sur


def load_contacts(path):
    """Contacts sheet: a header row with Name (as written on the roster) plus any of Surname, Given name, Email, Mobile, Title."""
    out = {}
    if not path or not pathlib.Path(path).exists(): return out            # no contacts yet: the build still runs, and the report says who cannot sign in
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True); ws = wb[wb.sheetnames[0]]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    if not rows: return out
    hdr = [clean(c).lower() for c in rows[0]]
    def col(*keys):
        for i, h in enumerate(hdr):
            if any(k in h for k in keys): return i
        return -1
    ci = {"name": col("name"), "sur": col("surname", "last"), "giv": col("given", "first"), "email": col("email"), "mobile": col("mobile", "phone"), "title": col("title")}
    for r in rows[1:]:
        key = clean(r[ci["name"]]) if ci["name"] >= 0 and ci["name"] < len(r) else ""
        if not key: continue
        g = lambda k: clean(r[ci[k]]) if ci[k] >= 0 and ci[k] < len(r) else ""
        out[key] = {"sur": g("sur"), "giv": g("giv"), "email": g("email"), "mobile": g("mobile"), "title": g("title")}
    return out


def read_blocks(ws, lay):
    """Every fortnight block on a sheet: (dates by column index, person rows with their section)."""
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    marker = lay.get("block_marker", "Fortnight"); ncol = lay.get("name_col", 0); wcol = lay.get("worktype_col", 1)
    blocks = []
    for i, r in enumerate(rows):
        if not (r and clean(r[ncol]).startswith(marker)): continue
        hdr = rows[i + 1] if i + 1 < len(rows) else []
        dates = [(j, to_date(v)) for j, v in enumerate(hdr) if to_date(v)]
        if len(dates) < 7: continue
        people = []; section = None
        for r2 in rows[i + 3:]:
            name = clean(r2[ncol]) if ncol < len(r2) else ""
            if name.startswith(marker): break
            if not name:                                            # a section row carries its text in another column (FRONT DESK), or is blank
                txt = " ".join(clean(v) for v in r2[:4] if v is not None).strip()
                if txt: section = txt
                continue
            if re.search(lay.get("skip_rows", r"^(Total|SHIFTS TO FILL|Line \d|AVAILABLE)"), name, re.I):
                if not re.search(r"^Total", name, re.I): section = section   # SHIFTS TO FILL, Line n, AVAILABLE: not people
                continue
            sec_hit = next((s for s in lay.get("sections", []) if re.search(s["match"], name, re.I)), None)
            if sec_hit:                                             # a section header written in the name column (Casual RNs, AINs)
                section = name; continue
            people.append({"raw": name, "worktype": clean(r2[wcol]) if wcol < len(r2) else "", "section": section, "cells": r2})
        blocks.append({"dates": dates, "people": people})
    return blocks


def section_of(cfg, sec_text, worktype):
    """Zone and tags for a row, from its section header (first) and its work type (added)."""
    lay = cfg["layout"]; zone = cfg["default"]["zone"]; tags = list(cfg["default"].get("tags", []))
    if sec_text:
        for s in lay.get("sections", []):
            if re.search(s["match"], sec_text, re.I): zone = s["zone"]; tags = list(s.get("tags", [])); break
    for k, v in (cfg.get("worktype_tags") or {}).items():
        if worktype and re.fullmatch(k, worktype, re.I): tags += [t for t in v if t not in tags]
    return zone, tags


def hours_of(cfg, worktype):
    rule = cfg.get("worktype_hours") or {}
    if worktype in rule: return rule[worktype]
    pat = rule.get("pattern")
    if pat:
        m = re.search(pat, worktype or "", re.I)
        if m: return float(m.group(1))
    return None


def type_for(cfg, start, end):
    for t in cfg["types"]:
        if t["start"] == start and t["end"] == end: return t
    return None


def half_of(cfg, start, end):
    t = type_for(cfg, start, end)
    if t: return t["fills"][0], t
    return ("AM" if int(start[:2]) < 12 else "PM"), None            # the app's own rule for a span no type names


def cycle_days(cfg):
    d0 = datetime.date.fromisoformat(cfg["cycle"]["start"]); n = int(cfg["cycle"]["weeks"]) * 7
    return [d0 + datetime.timedelta(days=i) for i in range(n)]


def build(cfg, out_dir):
    rep = {"people": {}, "shifts": 0, "one_offs": [], "clashes": [], "unmatched_names": [], "no_contact": [], "marks": {}, "sheets": [], "skipped_days": 0}
    contacts = load_contacts(cfg.get("contacts"))
    wb = openpyxl.load_workbook(cfg["workbook"], read_only=True, data_only=True)
    lay = cfg["layout"]; off = lay["day_offsets"]; days = cycle_days(cfg); dayset = set(days)
    roster = {}                                                    # stored name → {date → (start,end,zone,half)}
    people = {}                                                    # stored name → info
    slots = cfg.get("zone_slots") or {}                            # zone → [slot zones] for line-based groups (Desk 1 / Desk 2)
    taken = {}                                                     # (date, half) → {zone → stored name}
    for sheet in cfg["roster_sheets"]:
        if sheet not in wb.sheetnames: rep["sheets"].append(sheet + ": NOT FOUND"); continue
        blocks = read_blocks(wb[sheet], lay); rep["sheets"].append("%s: %d fortnight blocks" % (sheet, len(blocks)))
        for b in blocks:
            for p in b["people"]:
                nm = stored_name(cfg, p["raw"]); zone, tags = section_of(cfg, p["section"], p["worktype"])
                info = people.setdefault(nm, {"raw": p["raw"], "zone": zone, "tags": tags, "worktype": p["worktype"], "hours": hours_of(cfg, p["worktype"])})
                for j, d in b["dates"]:
                    if d not in dayset: continue
                    c = p["cells"]; g = lambda k: c[j + off[k]] if k in off and j + off[k] < len(c) else None
                    s, e = HHMM(g("start")), HHMM(g("finish"))
                    if not s or not e or s == e: continue
                    half, ty = half_of(cfg, s, e)
                    z = zone
                    if zone in slots:                                    # Desk 1 / Desk 2 in row order within the half
                        used = taken.setdefault((d, half), {})
                        free = [x for x in slots[zone] if x not in used]
                        if not free: rep["clashes"].append("%s %s: %s is a third person in the %s half (%s–%s)" % (iso(d), zone, nm, half, s, e)); z = slots[zone][-1]
                        else: z = free[0]; used[z] = nm
                    else:
                        used = taken.setdefault((d, half), {})
                        if zone in used and used[zone] != nm: rep["clashes"].append("%s %s: %s and %s both in the %s half (%s–%s)" % (iso(d), zone, used[zone], nm, half, s, e))
                        used[zone] = nm
                    if not ty: rep["one_offs"].append("%s %s %s–%s (lands as own hours on the %s type)" % (nm, iso(d), s, e, half))
                    roster.setdefault(nm, {})[d] = (s, e, z); rep["shifts"] += 1
    # people, contacts, tags
    staff_rows = []
    for nm, info in people.items():
        c = contacts.get(info["raw"]) or contacts.get(nm) or {}
        sur, giv = split_name(nm)
        if c.get("sur"): sur = c["sur"]; giv = c.get("giv", giv)
        if not (c.get("email") or c.get("mobile")): rep["no_contact"].append(nm)
        title = (cfg.get("titles") or {}).get(info["raw"]) or c.get("title", "")
        staff_rows.append([sur, giv, c.get("email", ""), c.get("mobile", ""), title, "; ".join(info["tags"]), info["hours"], "self"])
        rep["people"][nm] = {"zone": info["zone"], "tags": info["tags"], "hours": info["hours"], "shifts": len(roster.get(nm, {}))}
    # unavailability
    marks = {}
    for sheet in cfg.get("leave_sheets", []):
        if sheet not in wb.sheetnames: rep["sheets"].append(sheet + ": NOT FOUND"); continue
        ws = wb[sheet]; rows = [list(r) for r in ws.iter_rows(values_only=True)]
        hr = next((i for i, r in enumerate(rows) if sum(1 for v in r if to_date(v)) > 5), -1)
        if hr < 0: rep["sheets"].append(sheet + ": no date row"); continue
        year = re.search(r"(20\d\d)", sheet); dates = {}
        for j, v in enumerate(rows[hr]):
            d = to_date(v)
            if not d: continue
            if year and d.year != int(year.group(1)):                  # a copied year grid whose dates were never rolled forward
                try: d = d.replace(year=int(year.group(1)))
                except ValueError: continue
                rep.setdefault("date_fixes", set()).add(sheet)
            dates[j] = d
        for r in rows[hr + 1:]:
            raw = clean(r[0]) if r else ""
            if not raw: continue
            nm = stored_name(cfg, raw)
            if cfg.get("leave_people", "roster") == "roster" and nm not in people: rep["unmatched_names"].append(sheet + ": " + raw); continue
            for j, d in dates.items():
                v = r[j] if j < len(r) else None
                if v is None or clean(v) == "": continue
                marks.setdefault(nm, {})[d] = clean(v); rep["marks"][clean(v)] = rep["marks"].get(clean(v), 0) + 1
    # write the three files
    out_dir.mkdir(parents=True, exist_ok=True); pre = cfg["prefix"]
    wbS = openpyxl.Workbook(); ws = wbS.active; ws.title = "Staff"
    ws.append(["Surname", "Given name", "Email", "Mobile", "Title", "Tags", "Hours per fortnight", "Mode"])
    for r in sorted(staff_rows): ws.append(r)
    wbS.save(out_dir / (pre + "-staff.xlsx"))
    wbR = openpyxl.Workbook(); ws = wbR.active; ws.title = "Roster"
    ws.append([cfg.get("noun", "Name")] + [iso(d) for d in days])
    for nm in sorted(roster):
        ws.append([nm] + [("%s-%s %s" % (roster[nm][d][0].replace(":", ""), roster[nm][d][1].replace(":", ""), roster[nm][d][2]) if d in roster[nm] else None) for d in days])
    wbR.save(out_dir / (pre + "-roster-" + cfg["cycle"]["start"] + ".xlsx"))
    wbU = openpyxl.Workbook(); ws = wbU.active; ws.title = cfg["cycle"]["start"][:4]
    all_dates = sorted({d for m in marks.values() for d in m} | set(days))
    ws.append(["Name"] + [datetime.datetime(d.year, d.month, d.day) for d in all_dates])
    for nm in sorted(people):
        ws.append([nm] + [marks.get(nm, {}).get(d) for d in all_dates])
    wbU.save(out_dir / (pre + "-unavailability.xlsx"))
    if not (cfg.get("contacts") and pathlib.Path(cfg["contacts"]).exists()):        # a contacts template to fill: the names as the sheet writes them
        wbC = openpyxl.Workbook(); ws = wbC.active; ws.title = "Contacts"; ws.append(["Name (as on the roster)", "Surname", "Given name", "Email", "Mobile", "Title"])
        for nm, info in sorted(people.items(), key=lambda x: x[0]): sur, giv = split_name(nm); ws.append([info["raw"], sur, giv, "", "", (cfg.get("titles") or {}).get(info["raw"], "")])
        wbC.save(out_dir / (pre + "-contacts-template.xlsx")); rep["contacts_template"] = pre + "-contacts-template.xlsx"
    (out_dir / (pre + "-checklist.md")).write_text(checklist(cfg, rep), encoding="utf-8")
    (out_dir / (pre + "-report.md")).write_text(report(cfg, rep), encoding="utf-8")
    return rep


def checklist(cfg, rep):
    T = cfg["types"]; C = cfg["cover"]; sw = cfg.get("switches", {}); L = []
    L.append("# %s — settings checklist\n" % cfg["group"])
    L.append("Apply in this order, in Settings, signed in as the group's admin. The roster import recognises each shift by its times, so the types come first.\n")
    L.append("## 1. This cycle\n- Cycle: **%s**, %d weeks (Cycle card; or let the roster import create it in step 4 and delete the empty first cycle afterwards).\n- Roster mode: **rolling** · fairness **guarded** · notice period **%s days**." % (cfg["cycle"]["start"], cfg["cycle"]["weeks"], sw.get("noticeDays", 7)))
    L.append("- Shift types (Shift types card): " + " · ".join("**%s** %s–%s%s" % (t["label"], t["start"], t["end"], " (whole day)" if len(t["fills"]) > 1 else "") for t in T) + ". Switch off any type the group does not use (On-call stays off).")
    L.append("- Zones: " + ", ".join("**%s**" % z for z in cfg["zones"]) + " (every zone runs both halves).")
    L.append("- Cover: AM **%d–%d**, PM **%d–%d**." % (C["amMin"], C["amMax"], C["pmMin"], C["pmMax"]))
    rules = cfg.get("rules") or {}
    if rules:
        L.append("- Rules card: " + "; ".join(["%s needs %s" % (z, " and ".join(t)) for z, t in (rules.get("needs") or {}).items()] + ["at least %s %s every AM and PM" % (m["n"]["AM"][0], m["tag"]) for m in rules.get("mins", [])]) + ".")
    L.append("\n## 2. This staff group\n- Tags card: " + (", ".join("**%s**" % t for t in cfg.get("tags", [])) or "none") + (" — tick *Show on the roster* for " + ", ".join(cfg.get("tags_shown", [])) if cfg.get("tags_shown") else "") + ".")
    L.append("- Features: CST **%s** · RosterOn **%s** · Open shifts **%s** · Staff may set their own hours **%s**." % ("on" if sw.get("cst") else "off", "on" if sw.get("rosteron") else "off", "on" if sw.get("marketOn", True) else "off", "on" if sw.get("ownHours") else "off"))
    if cfg.get("board"): L.append("- Department board: " + cfg["board"])
    L.append("\n## 3. People\n- Import **%s-staff.xlsx** (Staff list). It carries names as Surname, Given; tags; hours per fortnight where the sheet gave a work type; email and mobile where the contacts sheet had them.%s" % (cfg["prefix"], (" **%d people have no email or mobile yet** and cannot sign in until one is added on the Staff tab: %s." % (len(rep["no_contact"]), ", ".join(rep["no_contact"]))) if rep["no_contact"] else ""))
    L.append("\n## 4. The roster\n- Import **%s-roster-%s.xlsx** (Roster template). It creates the %s cycle from the settings above with %d shifts.%s" % (cfg["prefix"], cfg["cycle"]["start"], cfg["cycle"]["start"], rep["shifts"], (" %d days had times no type names and land with their own hours (see the report)." % len(rep["one_offs"])) if rep["one_offs"] else ""))
    if rep["clashes"]: L.append("- **%d clashes** in the report: two people in one zone and half on the same day. Fix them on the sheet before importing, or add a zone." % len(rep["clashes"]))
    L.append("- Delete the group's empty first cycle (Cycle card → Delete draft cycle) once the imported one is active.")
    L.append("\n## 5. Unavailability\n- Import **%s-unavailability.xlsx** (Leave planner) with **Treat any filled cell as unavailable** ticked. %d marks become UA days.%s" % (cfg["prefix"], sum(rep["marks"].values()), (" Names on the grid but not on the roster were left out: " + ", ".join(rep["unmatched_names"]) + ".") if rep["unmatched_names"] else ""))
    L.append("\n## 6. Invitations and go-live\n- Staff tab → Invite: everyone with an email or mobile.\n- Check the roster against the manager's sheet (Export → roster CSV, or the Day board day by day).\n- Booking → **Go live** in launch week; the roster is then the record, and the spreadsheet is never re-imported.")
    return "\n".join(L) + "\n"


def report(cfg, rep):
    L = ["# %s — build report\n" % cfg["group"], "Sheets read: " + "; ".join(rep["sheets"]), "People: %d · shifts placed on the cycle's days: %d" % (len(rep["people"]), rep["shifts"]), ""]
    L.append("## People as they will be stored")
    for nm, p in sorted(rep["people"].items()): L.append("- %s · zone %s · tags %s · hours per fortnight %s · %d shifts" % (nm, p["zone"], ", ".join(p["tags"]) or "—", p["hours"] if p["hours"] is not None else "—", p["shifts"]))
    if rep["no_contact"]: L += ["", "## No email or mobile yet (cannot sign in)", ", ".join(rep["no_contact"])]
    if rep["one_offs"]: L += ["", "## Times that match no type (land as own hours)"] + ["- " + x for x in rep["one_offs"]]
    if rep["clashes"]: L += ["", "## Clashes (two people in one zone and half)"] + ["- " + x for x in rep["clashes"]]
    if rep["unmatched_names"]: L += ["", "## Unavailability grid names not on the roster (left out)"] + ["- " + x for x in rep["unmatched_names"]]
    if rep.get("date_fixes"): L += ["", "## Unavailability sheets whose dates carried the wrong year (rolled to the sheet's own year)", ", ".join(sorted(rep["date_fixes"]))]
    L += ["", "## Marks on the unavailability grid", ", ".join("%s ×%d" % (k, v) for k, v in sorted(rep["marks"].items())) or "none"]
    return "\n".join(L) + "\n"


# ---- the round trip: the built files through the app's own importers, under JavaScriptCore (the same harness as tests/run.py) ----
REPO = pathlib.Path(__file__).resolve().parent.parent

CHECK_JS = r"""
;(function(){
  cloudOn=function(){return false;}; authState="in"; var IN=%(data)s, out={renders:[],errors:[]};
  S=defaultState(); normalize(); S.viewAs="admin"; S.tab="setup";
  var a=active(), c=cset();
  // settings, as the checklist has the admin apply them: the builtin AM and PM take the first morning and evening types' names and times, the rest are added
  var zs=IN.zones.map(function(n){return {id:slug(n),name:n,am:true,pm:true,pmLabel:""};}); c.zones=zs; S.zones=zs;
  c.staffing=Object.assign({},IN.cover); S.staffing=Object.assign({},IN.cover);
  var ts=shiftTypesOf(a).map(function(t){return Object.assign({},t,{fills:(t.fills||[]).slice()});}), amT=null, pmT=null, extra=[];
  IN.types.forEach(function(t){ var f=t.fills.slice(); if(f.length===1&&f[0]==="AM"&&!amT)amT=t; else if(f.length===1&&f[0]==="PM"&&!pmT)pmT=t; else extra.push(t); });
  ts.forEach(function(t){ if(t.id==="AM"&&amT){t.label=amT.label;t.start=amT.start;t.end=amT.end;} if(t.id==="PM"&&pmT){t.label=pmT.label;t.start=pmT.start;t.end=pmT.end;} if(t.id==="ONC")t.on=false; if(t.id==="CST")t.on=false; });
  extra.forEach(function(t){ ts.push({id:slug(t.label),code:t.label.toUpperCase().replace(/[^A-Z0-9]+/g,"").slice(0,8)||"T",label:t.label,start:t.start,end:t.end,fills:t.fills.slice(),on:true,book:true,builtin:null}); });
  c.shiftTypes=ts; c.rosterMode="rolling"; S.rosterMode="rolling"; hydrateCycleSettings();
  // the three files, through the importers
  var ps=parseStaffList(IN.staff); if(ps.error)out.errors.push("staff: "+ps.error); var rs=applyStaffList(ps.rows||[]); out.staff={created:rs.created,updated:rs.updated,tagsMade:rs.tagsMade};
  var pr=parseRosterAOA(IN.roster); if(pr.error)out.errors.push("roster: "+pr.error); var cyc=pr.error?null:applyRosterImport(pr,null);
  if(cyc){ S.activeId=cyc.id; hydrateCycleSettings(); hydrateCycleRoles(); out.cycle={start:cyc.cycle.start,weeks:cyc.cycle.weeks}; out.skipped=(pr.skipped||[]).map(function(x){return x.name+": "+x.why;});
    var byType={}, own=0, clashes=0, seen={}; Object.keys(cyc.assign).forEach(function(k){ var v=cyc.assign[k]; if(v.kind!=="clinical")return; var t=typeOf(cyc,v); var lbl=t?t.label:"?"; byType[lbl]=(byType[lbl]||0)+1; if(v.hours)own++;
      var sid=k.split("|")[0], d=k.split("|")[1]; fillsOf(cyc,v).forEach(function(h){ var key=d+"|"+h+"|"+v.zone; if(seen[key]&&seen[key]!==sid)clashes++; seen[key]=sid; }); });
    out.assigns=Object.keys(cyc.assign).length; out.byType=byType; out.ownHours=own; out.zoneClashes=clashes; }
  var pl=parseLeaveAOA(IN.leave,{anyFilled:true}); if(pl.error)out.errors.push("leave: "+pl.error); else { var n=applyLeaveImport(pl); out.leave={blocks:n,ua:pl.leave.filter(function(l){return l.code==="UA";}).length,anyFilled:pl.anyFilled===true}; }
  var days=0, conflicts=[]; if(cyc){ var d0=parseISO(cyc.cycle.start); for(var i=0;i<cyc.cycle.weeks*7;i++){ var d=iso(addDays(d0,i)); S.staff.forEach(function(s){ var lv=leaveOn(s.id,d); if(!lv||lv.code!=="UA")return; days++; var sh=cyc.assign[s.id+"|"+d]; if(sh&&sh.kind==="clinical")conflicts.push(s.name+" "+d+" "+shiftLabel(sh)); }); } }
  out.uaDays=days; out.uaConflicts=conflicts;   // a day marked unavailable that the manager also rostered: the shift stands in the app, so the manager decides which is right
  ["setup","staff","roster","daily","my"].forEach(function(t){ try{ S.tab=t; render(); out.renders.push(t+":ok"); }catch(e){ out.renders.push(t+":FAIL "+e.message); } });
  return JSON.stringify(out);
})();
"""


def aoa_of(path):
    """A workbook's first sheet as rows of plain values: dates as ISO strings, times as HH:MM."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True); ws = wb[wb.sheetnames[0]]; out = []
    for r in ws.iter_rows(values_only=True):
        row = []
        for v in r:
            if isinstance(v, (datetime.datetime, datetime.date)): row.append(to_date(v).isoformat())
            elif isinstance(v, datetime.time): row.append(v.strftime("%H:%M"))
            else: row.append(v)
        while row and row[-1] is None: row.pop()
        out.append(row)
    return out


def check(cfg, out_dir, app_path=None):
    """Run the three built files through the app's own importers under JavaScriptCore and return what landed."""
    app_path = pathlib.Path(app_path) if app_path else REPO / "app.html"; root = app_path.resolve().parent   # tests/stubs.js sits beside the app.html being checked
    html = app_path.read_text(encoding="utf-8"); app = max(re.findall(r"<script>(.*?)</script>", html, re.S), key=len)
    pre = cfg["prefix"]
    data = {"zones": cfg["zones"], "cover": cfg["cover"], "types": cfg["types"], "staff": aoa_of(out_dir / (pre + "-staff.xlsx")),
            "roster": aoa_of(out_dir / (pre + "-roster-" + cfg["cycle"]["start"] + ".xlsx")), "leave": aoa_of(out_dir / (pre + "-unavailability.xlsx"))}
    src = (root / "tests/stubs.js").read_text(encoding="utf-8") + app + "\n" + CHECK_JS % {"data": json.dumps(data, ensure_ascii=False)}
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f: f.write(src); jsf = f.name
    o = subprocess.run(["osascript", "-l", "JavaScript", jsf], capture_output=True, text=True); txt = (o.stdout or "").strip()
    if not txt.startswith("{"): raise SystemExit("JavaScriptCore run failed:\n" + (o.stderr or "") + txt[:1500])
    return json.loads(txt)


def selftest(app_path=None):
    """A synthetic manager workbook, built and round-tripped; every number below is what the layout above must give."""
    import shutil
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="group-files-")); wbp = tmp / "manager.xlsx"
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "NOV 2026"
    T = lambda h, m=0: datetime.time(h, m)
    def block(row, start):                                       # a fortnight block in the managers' layout: 6 columns a day, dates on the row below the marker
        ws.cell(row=row, column=1, value="Fortnight 1"); ws.cell(row=row, column=2, value="Date")
        for i in range(14):
            c = 3 + i * 6; d = start + datetime.timedelta(days=i)
            ws.cell(row=row + 1, column=c, value=datetime.datetime(d.year, d.month, d.day))
            for k, h in enumerate(["Start Time", "Finish Time", "Break (Min)", "Shift Length", None, "Shift Length"]):
                if h: ws.cell(row=row + 2, column=c + k, value=h)
        ws.cell(row=row + 2, column=2, value="Work Type")
        return row + 3
    r = block(8, datetime.date(2026, 10, 26))
    people = [("PM - Pat Lead", "PT 60", [(0, T(9, 30), T(15, 0))] * 1 + [(1, T(9, 30), T(18, 0))]),
              (None, "FRONT DESK", []),
              ("Ali Desk", "PT54", [(0, T(17, 30), T(22, 15)), (1, T(9, 45), T(17, 45)), (5, T(11, 10), T(16, 25))]),
              ("Bo Casual", "CS", [(2, T(9, 45), T(17, 45)), (5, T(9, 45), T(14, 15))]),
              ("SHIFTS TO FILL", None, []), ("Total Daily Hours Week 1", None, [])]
    for name, wt, shifts in people:
        if name: ws.cell(row=r, column=1, value=name)
        if wt: ws.cell(row=r, column=2, value=wt)
        for day, s, e in shifts:
            ws.cell(row=r, column=3 + day * 6, value=s); ws.cell(row=r, column=4 + day * 6, value=e)
        r += 1
    lv = wb.create_sheet("Staff Leave 2026"); lv.cell(row=1, column=2, value="UNAVAILABILITIES")
    for i in range(20):
        d = datetime.date(2026, 10, 20) + datetime.timedelta(days=i); lv.cell(row=3, column=2 + i, value=datetime.datetime(d.year, d.month, d.day))
    lv.cell(row=4, column=1, value="Ali Desk"); lv.cell(row=4, column=9, value="X"); lv.cell(row=4, column=10, value="X"); lv.cell(row=4, column=14, value="AL")
    lv.cell(row=5, column=1, value="Bo Casual"); lv.cell(row=5, column=12, value="AM")
    lv.cell(row=6, column=1, value="Not Rostered"); lv.cell(row=6, column=12, value="X")
    wb.save(wbp)
    cfg = {"group": "Selftest · Admin", "prefix": "selftest", "noun": "Clerk", "workbook": str(wbp), "cycle": {"start": "2026-10-26", "weeks": 2},
           "roster_sheets": ["NOV 2026", "MISSING 2027"], "leave_sheets": ["Staff Leave 2026"],
           "layout": {"name_col": 0, "worktype_col": 1, "block_marker": "Fortnight", "cols_per_day": 6, "day_offsets": {"start": 0, "finish": 1, "break": 2}, "sections": [{"match": "FRONT DESK", "zone": "Desk"}], "skip_rows": r"^(Total|SHIFTS TO FILL|Line \d|AVAILABLE)"},
           "default": {"zone": "Desk"}, "zones": ["Desk 1", "Desk 2"], "zone_slots": {"Desk": ["Desk 1", "Desk 2"]}, "worktype_hours": {"pattern": r"PT\s*(\d+)"},
           "types": [{"label": "Manager", "start": "09:30", "end": "15:00", "fills": ["AM"]}, {"label": "Manager long", "start": "09:30", "end": "18:00", "fills": ["AM"]}, {"label": "Day desk", "start": "09:45", "end": "17:45", "fills": ["AM"]}, {"label": "Weekend AM", "start": "09:45", "end": "14:15", "fills": ["AM"]}, {"label": "Evening", "start": "17:30", "end": "22:15", "fills": ["PM"]}],
           "cover": {"amMin": 1, "amMax": 2, "pmMin": 1, "pmMax": 2}, "tags": [], "names": {"PM - Pat Lead": "Lead, Pat"}, "titles": {"PM - Pat Lead": "Manager"}, "switches": {"noticeDays": 7, "marketOn": True, "ownHours": True}}
    rep = build(cfg, tmp)
    exp = {"people": 3, "shifts": 7, "one_offs": 1, "clashes": 0, "unmatched": 1, "marks": 4, "hours": {"Lead, Pat": 60.0, "Desk, Ali": 54.0, "Casual, Bo": None}}
    got = {"people": len(rep["people"]), "shifts": rep["shifts"], "one_offs": len(rep["one_offs"]), "clashes": len(rep["clashes"]), "unmatched": len(rep["unmatched_names"]), "marks": sum(rep["marks"].values()), "hours": {k: v["hours"] for k, v in rep["people"].items()}}
    bad = [k for k in exp if exp[k] != got[k]]
    if bad: shutil.rmtree(tmp); raise SystemExit("selftest: the build disagrees on %s\n  expected %s\n  got      %s" % (bad, exp, got))
    if "MISSING 2027: NOT FOUND" not in rep["sheets"]: shutil.rmtree(tmp); raise SystemExit("selftest: a missing sheet must be reported")
    out = check(cfg, tmp, app_path); shutil.rmtree(tmp)
    want = {"errors": [], "assigns": 7, "ownHours": 1, "zoneClashes": 0, "uaDays": 3, "uaConflicts": 1, "staff_created": 3}   # Ali is rostered on a day marked X: the shift stands and the check says so
    have = {"errors": out.get("errors"), "assigns": out.get("assigns"), "ownHours": out.get("ownHours"), "zoneClashes": out.get("zoneClashes"), "uaDays": out.get("uaDays"), "uaConflicts": len(out.get("uaConflicts") or []), "staff_created": (out.get("staff") or {}).get("created")}
    bad = [k for k in want if want[k] != have[k]]
    fails = [r for r in out.get("renders", []) if "FAIL" in r]
    if bad or fails: raise SystemExit("selftest: the round trip disagrees on %s\n  expected %s\n  got      %s\n  renders %s" % (bad, want, have, out.get("renders")))
    bt = out.get("byType", {})
    if not (bt.get("Manager") == 2 and bt.get("Manager long") == 1 and bt.get("Day desk") == 2 and bt.get("Evening") == 1 and bt.get("Weekend AM") == 1 and len(bt) == 5):   # the one-off 11:10–16:25 lands on the morning half's builtin type (renamed Manager here) with its own hours
        raise SystemExit("selftest: types landed wrongly: %s" % bt)
    print("selftest ok: 3 people, 7 shifts (1 with own hours), 3 UA days (1 on a rostered day), every tab renders")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("config", nargs="?"); ap.add_argument("--out"); ap.add_argument("--check", action="store_true", help="after building, run the files through the app's own importers under JavaScriptCore and report what landed")
    ap.add_argument("--app", help="the app.html to check against (default: the repo's)"); ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest: return selftest(a.app)
    if not a.config: ap.error("a config file, or --selftest")
    cfgp = pathlib.Path(a.config); cfg = json.loads(cfgp.read_text(encoding="utf-8"))
    for k in ("workbook", "contacts"):
        if cfg.get(k) and not pathlib.Path(cfg[k]).is_absolute(): cfg[k] = str((cfgp.parent / cfg[k]).resolve())
    out_dir = pathlib.Path(a.out) if a.out else cfgp.parent
    rep = build(cfg, out_dir)
    print("built %s: %d people, %d shifts, %d one-offs, %d clashes, %d marks; report %s-report.md" % (cfg["group"], len(rep["people"]), rep["shifts"], len(rep["one_offs"]), len(rep["clashes"]), sum(rep["marks"].values()), cfg["prefix"]))
    if a.check:
        o = check(cfg, out_dir, a.app)
        print("round trip through the app: " + json.dumps({k: o.get(k) for k in ("errors", "staff", "cycle", "assigns", "byType", "ownHours", "zoneClashes", "leave", "uaDays", "uaConflicts", "skipped", "renders")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run its self-test against the current app (Task 1 must be on `main` first: the self-test imports the unavailability grid with the tick).**

```bash
python3 tools/group-files.py --selftest --app app.html
```

Expected: `selftest ok: 3 people, 7 shifts (1 with own hours), 3 UA days (1 on a rostered day), every tab renders`.

- [ ] **Step 3: Make the self-test a lint.** Save as `$SP/s6-2-runpy.py` and apply it to `tests/run.py`:

```python
# file: s6-2-runpy.py
rep(r'''# 8. the head: the spreadsheet library never blocks first paint, and the web font never delays the roster''', r'''# 7b. the group-files converter (tools/group-files.py): its self-test builds a synthetic manager workbook, writes the three
#     import files and runs them through THIS app's importers under JavaScriptCore — so the files it writes for a new group land
#     as they should on the build being tested
def group_files_lint():
    tool = root / "tools" / "group-files.py"
    if not tool.exists(): return ["tools/group-files.py is missing"]
    r = subprocess.run([sys.executable, str(tool), "--selftest", "--app", str(root / "app.html")], capture_output=True, text=True, cwd=str(root))
    if r.returncode != 0 or "selftest ok" not in (r.stdout or ""):
        return [((r.stdout or "") + (r.stderr or "")).strip().splitlines()[-1][:200] if ((r.stdout or "") + (r.stderr or "")).strip() else "the self-test gave no output"]
    return []

# 8. the head: the spreadsheet library never blocks first paint, and the web font never delays the roster''')
rep(r'''    ("deploy: deploy/app.html is today's app, and preview.html the same with the cloud blanked", "deploy: problems", deploy_lint()),''', r'''    ("deploy: deploy/app.html is today's app, and preview.html the same with the cloud blanked", "deploy: problems", deploy_lint()),
    ("group files: the converter's self-test round-trips its files through this app", "group files: problems", group_files_lint()),''')
```

```bash
python3 $SP/rep.py tests/run.py $SP/s6-2-runpy.py
python3 tests/run.py 2>&1 | grep -E "^FAIL|HARNESS|passed|group files"
```

Expected: `replacements: 2`, then `PASS  group files: the converter's self-test round-trips its files through this app` and `1005 passed, 0 failed`.

- [ ] **Step 4: Commit.**

```bash
git add tools/group-files.py tests/run.py
git commit -q -m "tools/group-files.py: a manager's fortnight-grid workbook becomes the three files Myrosta imports (staff list, roster with true times, unavailability grid) plus a settings checklist and a report; --check runs them through the app's own importers under JavaScriptCore; --selftest runs as a lint" && git log --oneline -1
```

---

### Task 3: Build SWIFT's three groups (outside the repo)

**Files (all in `~/Desktop/Myrosta site 2/groups/`, personal data, never committed):**
- Already present from the plan's dry run: `swift-admin.json`, `swift-nurses.json`, `swift-scribes.json` (one config per group: workbook path in `~/Downloads`, the roster and leave sheets, the layout, sections, types, zones, cover, rules, switches, name overrides and titles); the built files and reports from that run.
- Produce: the three groups' files rebuilt from `tools/group-files.py` with `--check`, and `swift-groups-findings.md` — one page for the owner listing what the reports found and the decisions only he or the managers can take.

- [ ] **Step 1: Rebuild each group with the check.**

```bash
cd "/Users/ranjithkandavelu/Desktop/Myrosta site 2/groups"
for g in swift-admin swift-nurses swift-scribes; do python3 /Users/ranjithkandavelu/Desktop/Claude/Myrosta/tools/group-files.py $g.json --check; done
```

Expected (as of the dry run on 27 Sep 2026): admin 9 people, 243 shifts on the cycle's days, 5 one-offs (own hours), 0 clashes, 17 marks; nurses 24 people, 133 shifts, 0 one-offs, 1 clash, 2 marks; scribes 8 people, 10 shifts. Every `--check` reports `errors: []`, `skipped: []` and every tab rendering. The managers keep writing their sheets, so the numbers move; the shapes of the reports do not.

- [ ] **Step 2: Read the three reports and write `swift-groups-findings.md`** with, per group: the people as they will be stored (any name that reads wrongly gets a `names` override in the config and a rebuild), who has no contact details (the `<prefix>-contacts-template.xlsx` to hand to the owner), the one-off times (a type worth adding, or own hours), the clashes with their dates, the days rostered while marked unavailable (`uaConflicts` from `--check`), names on the unavailability grid left out, and any sheet not found (a month the manager has not written yet). Known from the dry run: an admin manager's row also appears on the nurses' sheet under the casual RNs; one scribe is on the leave grid but on no roster sheet from November; one RN day in November has two RNs in the morning half; two nurses are rostered on 26 December while marked unavailable.

- [ ] **Step 3: Hand over.** The deliverable is the folder: three files and a checklist per group, the reports, the contacts templates and the findings page. Nothing is committed.

---

### Task 4: The staff guide and the managers' guide (outside the repo)

**Files (in `~/Desktop/Myrosta site 2/go-live/source/guides/`):**
- Create: `swift-staff.html` ("Myrosta for SWIFT staff": nurses, scribes and clerks) and `swift-managers.html` ("Myrosta for SWIFT managers"), both using the existing `guide.css` and `icon.png`; print each to PDF in `~/Desktop/Myrosta site 2/go-live/` as `Myrosta for SWIFT - staff guide.pdf` and `Myrosta for SWIFT - managers guide.pdf`. The consultants' `staff.html` and `admin.html` are the models for tone, structure and the cover block, and stay as they are.

- [ ] **Step 1: Write `swift-staff.html`** with these sections, each in the consultants' guide's voice (short steps, the app's own button names, no call-ins anywhere): Get started in five minutes (invite, sign in with Mobile (SMS) or Email, no password); Where things are (My shifts, Book shifts, Roster, Requests, Day board); Your group's shifts (a box each for nurses, scribes and clerks: the zones and shift types from the spec's table, and that a whole-day shift counts two); Book a shift and claim an open one (rolling, always live; the day sheet's chips; open shifts; your share); Your own hours (only where the switch is on: the Hours row beside a pick, Change hours on a booked shift, pay reads them); Swap a shift (With a colleague, Ask everyone); When you can't work a shift (notice period, Offer it, Ask to come off); Unavailability and leave (the year grid you give your manager still works; leave through Requests); Who's on across SWIFT (the Day board's Whole department; the scribes' Consultants line); Staying in the loop (notifications, the calendar link, reminders). Cover block: first roster 26 Oct 2026 – 17 Jan 2027, "Guide updated <date>".

- [ ] **Step 2: Write `swift-managers.html`** from `admin.html`'s structure: SWIFT at a glance (the three groups side by side: zones, types, cover, rules, switches); Go-live checklist (the six-step order the tool's checklist prints: settings, staff list, roster, unavailability with the tick, invitations, Go live); Settings, card by card (This cycle: Cycle, Shift types — renaming AM and PM and adding the rest —, Zones, Cover, Rules; This staff group: Tags with Show on the roster, Features and the own-hours switch, Department board); Placing shifts (the cell editor, its Hours row, Pre-fill the rest, open shifts for gaps, the booking window as the manager-placed switch); Tags and rules (nurses: RN needs RN, one RN every AM and PM, what a breach looks like); Own hours (clerks: at booking and after, what pay reads); Running the roster day to day (swaps, come-off asks, Free that day); Unavailability and leave (the year grid re-imported with the tick before each cycle; the planner); Exports and pay (the payroll rows and the roster export carry true times); If something isn't right (the troubleshooting table, with the report's clash and unavailable-while-rostered cases). Cover block as above.

- [ ] **Step 3: Print both to PDF** with headless Chrome (the recipe that worked for the consultants' pair: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="<out.pdf>" "file://<abs path to html>"`, a fresh `--user-data-dir` under `$SP`, and kill the process once the file appears), then render the pages to PNG with the scratchpad's `pdf2png.swift` (or open the PDF) and look at every page: no half-empty page, no table split at a header row, the cover block right. Report the page counts.

---

### Task 5: The runbook and the demo script (outside the repo)

**Files (in `~/Desktop/Myrosta site 2/groups/`):**
- Create: `swift-launch-runbook.md` and `swift-demo-script.md`.

- [ ] **Step 1: Write the runbook** for the owner, week by week to Monday 26 October 2026, from the spec's "The four weeks": what he does (push; the contacts blocks; applying each group's checklist and importing its files; the demo; invitations; Go live), what each manager does (finish writing October in Excel by a date; then in the app), and the verification step before each Go live (rebuild with `--check`, read `uaConflicts` and clashes, compare the app's roster export with the manager's sheet for the first fortnight). Each step names the file it uses.

- [ ] **Step 2: Write the 30-minute demo script** on the three real groups in draft: 5 minutes the roster and the day sheet as a staff member sees them, 10 minutes placing and changing shifts as a manager (the cell editor, its Hours row, Pre-fill, an open shift), 5 minutes tags and rules on the nurses' group, 5 minutes unavailability (the tick) and leave, 5 minutes questions — with the exact clicks, and what to say when a manager asks about pay (true times in the payroll rows), about staff booking (the booking window), and about the spreadsheets (the app is the record after the import).

---

## Self-review against the spec

- **Decisions 1–6** (the date; imported fortnights with true times; the app's own importers plus a checklist; flexible filling; one staff guide, one managers' guide and the demo; the tick): Tasks 1–5 cover them; Decision 4 needs no code (rolling mode is what the presets give; the checklist says so).
- **Each group's shape:** the three configs carry the spec's table exactly (types, zones, cover, tags, rules, switches); the nurses' config adds "AIN long 12:00–22:00" because the sheet writes it ten times — the report would otherwise list ten one-offs.
- **The build:** Task 2's tool writes the three files and the checklist in the order the spec states; the report lists what the spec asks (people, shifts, one-offs, contacts, marks) plus clashes and rostered-while-unavailable days.
- **The app change:** Task 1, with the tick off proven byte-identical.
- **Guides and demo, the four weeks:** Tasks 4 and 5.
- **Testing:** the tick's tests and mutations (Task 1); the synthetic round trip as a lint (Task 2); the real groups through `--check` (Task 3); the pre-launch diff in the runbook (Task 5).

## As executed (27–28 Sep 2026)

Built with subagent-driven development on `main`; each task reviewed, the final whole-branch review on the most capable model, one fix wave, one scoped re-review. Departures from the text above, all reviewed:

- **Task 1, fix round 1:** the fourth try in `findStaffByName` had let an ambiguous same-order match fall through to the swapped order; the third try's refusal was restored (`if(m.length)return m.length===1?m[0]:null;`), with a three-name probe as a test and a seventh mutation. The release copy says "the roster and leave imports", not "every import".
- **Task 2, fix round 1:** the tool as first written (the block above) had seven defects found by review: rows the importers refuse vanished while `--check` looked clean; whole-day types reserved one half; the contacts join could split a person; a person written twice on one date kept the last write silently; sections matched inside names; the checklist lacked the AM/PM rename mapping and told the admin to delete a cycle; the year roll re-dated any differing date. All fixed in one commit (87b06a2): `name_ok`/`hours_ok` mirrors held to the app's own functions by the self-test, `halves_of`, one stored name per person, keep-first with a report, whole-text section patterns, `type_plan` feeding both the checklist and `--check`, the roll only on a stale copy, and a `differences` list that fails the run.
- **Tasks 3–5 (outside the repo):** the findings page, the two guides and the runbook each had one review round; the spec's Decision 4 was amended (the booking window is one per cycle and set before Go live; a manager who wants control places first and sets shares) and its nurses' type row reconciled to the build (AIN long 12:00–22:00; the names as built).
- **Final fix wave (654a69e):** a real staff name in `split_name`'s docstring example, and a second in the names test's hyphen check, replaced with synthetic names and the unpushed history rewritten so neither reaches the remote; `leaveSheetName` (the cycle's year, a 4-digit name, a name carrying the year and leave/unavailable, else the first sheet) with tests and a mutation; the repeated-fortnight comparison in the tool's report; the checklist in the app's own words; the runbook's Go live on the Booking tab's Rolling roster card, staff checking after Go live, the roster import's confirm in its own bullet, and what `--check` proves plus two live checks; the findings page's RN-zone sentence; the spec's build paragraph.
- **Counts:** 998 → 1008 passes; Task 1's proof 8 of 8 mutants killed by named tests; the tool's self-test runs as a lint; the three real groups' files round-trip through the app with no differences. BUILD 2026-09-28.
- **Owner's steps:** push; then the runbook in `~/Desktop/Myrosta site 2/groups/swift-launch-runbook.md`.

## Follow-up (28 Sep 2026): the review's "may wait" items, tied off in the tool

- `--check` now also exports the round-tripped cycle as the Roster tab's **Roster as CSV** (the download stubbed) and compares it with the built roster file cell by cell: every person and day, the type each cell lands on and its own hours where the app keeps them; a leave code alone in the export is an empty roster day. `--compare ROSTER.csv` makes the same comparison for a file exported from the live group, so the runbook's "check the first fortnight by eye" became one command over the whole cycle.
- `differences` counts shifts per type as well as in total; two types sharing one window are refused by `config_problems`; a fortnight marker with fewer than 7 dates below it is named in the report's *Sheets read* line instead of being skipped silently.
- The checklist's step 6 names the Go live day (the Monday a week before the cycle, 19 Oct 2026 for SWIFT) and the booking-window rule, matching the runbook; the managers' guide says the same.
- Self-test: 10 of 10 mutants of the new checks killed by named assertions; the three real groups rebuilt with `--check` — differences `[]`, export cells compared 756 / 924 / 84.
