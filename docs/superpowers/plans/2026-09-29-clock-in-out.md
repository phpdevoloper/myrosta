# Clock in / clock out with a site geofence (C1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff tap Clock in and Clock out on their own shift; a tap outside the grace band proposes the real hours; the manager approves them under Requests and they become the shift's own hours for pay.

**Architecture:** Everything is in `app.html`. Taps live in `cyc.clock` (one owner: the person), decisions in `cyc.clockDec` (one owner: an admin), both keyed `sid|iso` like `assign` and merged key by key like call-ins. A record's status is computed by `clockProposal`, never stored. Approve calls the existing `hoursSet`, so pay, exports, calendars, reminders and the board read the result with no new code. The group settings (`S.clockOn`, `S.clockGrace`, `S.site`) are global, not per cycle. The poster is a printable card with an inline QR encoder; a scan opens the app with `?org=…&clock=…`.

**Tech Stack:** vanilla JS in one file; tests in `tests/suite.js` run by `python3 tests/run.py` under JavaScriptCore (synchronous only — the runner never drains promise callbacks, so every path is tested through its synchronous prefix, with `navigator.geolocation` stubbed); Python for the edit scripts, the mutation proof and the QR cross-check (`qrcode` library in a scratch prefix).

**Spec:** `docs/superpowers/specs/2026-09-29-clock-in-out-design.md`

## Global Constraints

- Commit on `main`; **never push** (the owner pushes from GitHub Desktop). No SQL, no Edge Function.
- Synthetic names only in code, tests and docs (Ava Ng, Sam Lee, Ky Tran). Never a real staff name.
- After any `app.html` change: `python3 $SP/sync.py` (deploy/app.html byte-identical, preview.html with the cloud blanked) and `python3 tools/build-demo.py`, then `python3 tests/run.py` must print `0 failed`.
- `const BUILD` = the newest CHANGELOG heading date = `WHATS_NEW[0].on`; the newest What's new entry has exactly three site-neutral lines (no curly quotes in line 2). Tests find release entries by title or date, never `WHATS_NEW[0]`.
- Every `logAudit("key", …)` literal needs a sentence in `AUDIT_WORDS` (the audit lint). No hex colours or px font sizes outside `:root`. No emoji in chrome; icons through `ic("name")` from the `TIC` set (`clock`, `target`, `print`, `check`, `x`, `warn` exist).
- Nothing changes for a group with the switch off: no new keys written, `normalize()` seeds none of `clockOn`, `clockGrace`, `site`, `clock`, `clockDec`; the exports are byte for byte as today.
- Only `dist`, `acc` and `inside` are stored about location — never coordinates of a person.
- The plan's `# file:` blocks are the code: implementers extract them programmatically (`python3 $SP/s3plan.py PLAN DIR`) and run them from the repo root; they never retype. Each script asserts every anchor occurs exactly once and stops otherwise.
- Mutation proof before the final review: `c1-mutate-strict.py` (Task 4) syncs the deploy copies and rebuilds the demo for every mutant and names the failing tests; all mutants must be killed by named `clock:` tests, not by the deploy or demo lints.

## File structure

- `app.html` — one new section "clock in / clock out with a site geofence (C1)" before `function ownHoursSwitch`, holding the rules, the settings writes, the taps, the proposals, the list, the poster and the QR encoder; small insertions in `viewSetup`, `setupIndexHTML`, `SETUP_GROUP`, the setup/my/selfroster/requests wiring blocks, `viewMy`, `daySheetHTML`, `viewDaily`, `viewRequests`, `exportMenuHTML`/`openExportMenu`, `mergeOnto`, `_handleAuth`, `boot`, `AUDIT_WORDS`, the CSS, `BUILD` and `WHATS_NEW`.
- `tests/suite.js` — one new block "clock in / clock out with a site geofence (C1)" before the suite's closing render lines; each task adds its tests above the block's marker line.
- `CHANGELOG.md` — a heading for the release day.
- Outside the repo (Task 5): the SWIFT staff guide, the managers' guide and the runbook.

---

### Task 1: Settings, data and the rules

**Files:**
- Modify: `app.html` (the C1 section, the Group half of Settings, the merge, `AUDIT_WORDS`)
- Test: `tests/suite.js` (the new C1 block)

**Interfaces:**
- Produces: `clockOn()`, `clockGrace()`, `clockSite()`, `clockRadius()`, `clockMin(hhmm)`, `clockHHMM(min)`, `clockRound(hhmm)`, `clockNowHHMM(date)`, `clockNow()`, `clockDist(lat1,lng1,lat2,lng2)`, `clockInside(dist,acc,radius)`, `clockWindow(cyc,sid,isoD)`, `clockRec(cyc,sid,isoD)`, `clockDecOf(cyc,sid,isoD)`, `clockOutUntil(isoD,w)`, `clockMay(cyc,sid,isoD,now)→{in,out}`, `clockProposal(cyc,sid,isoD,grace,now)→{status,start,end,flags,rostered}`, `clockNewKey()`, `clockTokenOK(token)`, `clockPosterURL()`, `clockLocate(cb)`, `clockSwitch(on)`, `clockSetGrace(v)`, `clockSiteSave(lat,lng,radius,acc)`, `clockPosterRenew()`, `clockCardHTML()`; device-only `_clockNow`, `_clockBusy`, `_siteAcc`; constants `CLOCK_EARLY=60`, `CLOCK_KEEP=14`.
- Data: `S.clockOn===true|absent`, `S.clockGrace` (0–60, absent = 7), `S.site={lat,lng,acc,setAt,radius,posterKey,posterAt}`, `cyc.clock[sid|iso]={in:TAP,out:TAP}`, `cyc.clockDec[sid|iso]={ok,start,end,by,ts}`, `TAP={t,ts,dist,acc,inside,via}` with `via` one of `"gps"|"poster"|"none"`.
- Statuses from `clockProposal`: `"none"` (no in tap), `"void"` (no shift, or taps out of order), `"open"`, `"noOut"`, `"rostered"`, `"proposed"`.

- [ ] **Step 1: Apply the app edits**

```python
# file: c1-1-app.py
import pathlib, sys
P=pathlib.Path("app.html"); s=P.read_text(encoding="utf-8")
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: sys.exit("c1-1-app: expected one occurrence, found %d:\n%s" % (n, old[:160]))
    s=s.replace(old,new)

CORE=r'''/* ---------- clock in / clock out with a site geofence (C1): a person's taps propose hours, the manager approves them as the shift's own hours ----------
   Spec: docs/superpowers/specs/2026-09-29-clock-in-out-design.md. Taps live in cyc.clock (one owner: the person), decisions in cyc.clockDec (one owner: an admin);
   a record's status is computed by clockProposal, never stored, so no device ever writes another device's slot. Only dist, acc and inside are kept about location. */
const CLOCK_EARLY=60;   // minutes before the rostered start a person may clock in
const CLOCK_KEEP=14;    // days a closed record stays on the manager's list
let _clockNow=null, _clockBusy=false, _siteAcc=null;   // device-only: a fixed "now" for tests, the location wait, the accuracy the Site card just heard
function clockNow(){ return _clockNow?new Date(_clockNow):new Date(); }
function clockOn(){ return S.clockOn===true; }   // the group switch: absent means off, and normalize() seeds nothing
function clockGrace(){ const g=S.clockGrace; return (typeof g==="number"&&g>=0&&g<=60)?Math.round(g):7; }
function clockSite(){ const s=S.site; return (s&&typeof s.lat==="number"&&typeof s.lng==="number"&&isFinite(s.lat)&&isFinite(s.lng))?s:null; }
function clockRadius(){ const s=clockSite(), r=s?+s.radius:0; return (r>=20&&r<=2000)?Math.round(r):150; }
function clockMin(hhmm){ const m=/^(\d\d):(\d\d)$/.exec(String(hhmm||"")); return m?(+m[1])*60+(+m[2]):null; }
function clockHHMM(min){ min=((min%1440)+1440)%1440; return String(Math.floor(min/60)).padStart(2,"0")+":"+String(min%60).padStart(2,"0"); }
function clockRound(hhmm){ const m=clockMin(hhmm); return m==null?null:clockHHMM(Math.round(m/5)*5); }   // to the nearest 5 minutes, half up; 23:58 becomes 00:00
function clockNowHHMM(d){ return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
function clockDist(lat1,lng1,lat2,lng2){ const R=6371000, r=Math.PI/180, dLat=(lat2-lat1)*r, dLng=(lng2-lng1)*r, a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)*Math.sin(dLng/2); return Math.round(2*R*Math.asin(Math.sqrt(a))); }   // haversine, whole metres
function clockInside(dist,acc,radius){ if(dist==null)return null; return (dist-(acc||0))<=radius; }   // the benefit of the doubt: a poor fix inside the building is never "outside"
function clockWindow(cyc,sid,isoD){ const sh=(cyc.assign||{})[sid+"|"+isoD]; if(!sh||sh.kind!=="clinical")return null; const w=shiftWindow(cyc,sh); return w?{start:w.start,end:w.end,own:!!w.own}:null; }
function clockRec(cyc,sid,isoD){ return (cyc.clock||{})[sid+"|"+isoD]||null; }
function clockDecOf(cyc,sid,isoD){ return (cyc.clockDec||{})[sid+"|"+isoD]||null; }
function clockOutUntil(isoD,w){ const d=parseISO(isoD); if(w&&w.end==="00:00"){ d.setDate(d.getDate()+1); d.setHours(1,0,0,0); } else d.setHours(23,59,59,999); return d.getTime(); }   // the last moment an out tap is accepted
function clockMay(cyc,sid,isoD,now){ const w=clockWindow(cyc,sid,isoD); if(!w)return {in:false,out:false}; const rec=clockRec(cyc,sid,isoD)||{}, t=now.getTime();
  const d0=parseISO(isoD), s=clockMin(w.start), e=(w.end==="00:00")?1440:clockMin(w.end), from=new Date(d0.getTime()), to=new Date(d0.getTime()); from.setHours(0,s-CLOCK_EARLY,0,0); to.setHours(0,e,0,0);
  return {in:!rec.in&&t>=from.getTime()&&t<=to.getTime(), out:!!rec.in&&!rec.out&&t>=rec.in.ts&&t<=clockOutUntil(isoD,w)}; }
function clockProposal(cyc,sid,isoD,grace,now){   // what the taps say against the rostered window: the status, and the pair to approve when there is one
  const w=clockWindow(cyc,sid,isoD), rec=clockRec(cyc,sid,isoD); if(!rec||!rec.in)return {status:"none",flags:[],rostered:null};
  const loc=[]; [rec.in,rec.out].forEach(tap=>{ if(!tap)return; if(tap.via==="poster")loc.push("by poster"); else if(tap.inside==null)loc.push("no location"); else if(tap.inside===false)loc.push("outside the radius ("+tap.dist+" m)"); });
  const done=(status,tm,extra)=>Object.assign({status:status,flags:(tm||[]).concat(loc.filter((f,i)=>loc.indexOf(f)===i)),rostered:w?{start:w.start,end:w.end}:null},extra||{});
  if(!w)return done("void",["no shift"]);
  if(!rec.out)return (now.getTime()>clockOutUntil(isoD,w))?done("noOut",["no clock-out"]):done("open");
  const sM=clockMin(w.start), eM=(w.end==="00:00")?1440:clockMin(w.end), inM=clockMin(rec.in.t); let outM=clockMin(rec.out.t); if(iso(new Date(rec.out.ts))>isoD)outM+=1440;   // an out tap after midnight, on a shift that ends at midnight
  if(outM<=inM)return done("void",["taps out of order"]);
  const tm=[]; let start=(Math.abs(inM-sM)<=grace)?w.start:rec.in.t, endM=(Math.abs(outM-eM)<=grace)?eM:outM;
  if(endM>1440){ endM=1440; tm.push("capped at midnight"); }
  const end=(endM>=1440)?"00:00":clockHHMM(endM), stM=clockMin(start);
  if(stM<sM)tm.unshift("early "+(sM-stM)+" min"); else if(stM>sM)tm.unshift("started late "+(stM-sM)+" min");
  if(endM>eM)tm.push("late "+(endM-eM)+" min"); else if(endM<eM)tm.push("left early "+(eM-endM)+" min");
  if(start===w.start&&end===w.end)return done("rostered",tm);
  if(!hoursOK(start,end))return done("void",["taps out of order"]);
  return done("proposed",tm,{start:start,end:end}); }
function clockNewKey(){ const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b=new Uint8Array(16); crypto.getRandomValues(b); let k=""; for(let i=0;i<16;i++)k+=A[b[i]%32]; return k; }
function clockTokenOK(token){ const s=clockSite(); return !!(s&&s.posterKey)&&String(token||"")===s.posterKey; }
function clockPosterURL(){ const s=clockSite(); return location.origin+location.pathname.replace(/[^\/]*$/,"")+"app.html?org="+encodeURIComponent(_org)+"&clock="+encodeURIComponent((s&&s.posterKey)||""); }
function clockLocate(cb){   // one answer, once: the phone's position, or null when it refuses, times out or has no location at all
  const g=(typeof navigator!=="undefined")&&navigator.geolocation; if(!g||!g.getCurrentPosition){ cb(null); return; } let done=false; const fin=v=>{ if(done)return; done=true; cb(v); };
  try{ g.getCurrentPosition(p=>fin({lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy}),()=>fin(null),{enableHighAccuracy:true,timeout:10000,maximumAge:0}); }catch(e){ fin(null); } setTimeout(()=>fin(null),11000); }
function clockSwitch(on){ if(on&&!clockSite())return {ok:false,reason:"Save the site first \u2014 the clock needs to know where the clinic is."}; if(on)S.clockOn=true; else delete S.clockOn; logAudit("settings.clock",on?"on":"off","admin"); save(); return {ok:true}; }   // written as true, deleted when off, never false
function clockSetGrace(v){ const g=Math.round(+v); if(!(g>=0&&g<=60))return {ok:false,reason:"Grace is 0 to 60 minutes."}; if(g===7)delete S.clockGrace; else S.clockGrace=g; logAudit("settings.clock","grace "+g+" min","admin"); save(); return {ok:true}; }
function clockSiteSave(lat,lng,radius,acc){ if(String(lat==null?"":lat).trim()===""||String(lng==null?"":lng).trim()==="")return {ok:false,reason:"Latitude and longitude must be numbers."}; lat=+lat; lng=+lng; radius=Math.round(+radius||150);
  if(!(isFinite(lat)&&Math.abs(lat)<=90&&isFinite(lng)&&Math.abs(lng)<=180))return {ok:false,reason:"Latitude and longitude must be numbers."};
  if(!(radius>=20&&radius<=2000))return {ok:false,reason:"The radius is 20 to 2000 metres."};
  const prev=S.site||{}; S.site={lat:Math.round(lat*1e6)/1e6,lng:Math.round(lng*1e6)/1e6,acc:(acc==null)?(prev.acc==null?null:prev.acc):Math.round(acc),setAt:Date.now(),radius:radius,posterKey:prev.posterKey||clockNewKey(),posterAt:prev.posterAt||Date.now()};
  logAudit("settings.site","radius "+radius+" m"+(S.site.acc!=null?" \u00b7 \u00b1"+S.site.acc+" m":""),"admin"); save(); return {ok:true}; }   // never the coordinates: the audit log says the radius and the accuracy, nothing else
function clockPosterRenew(){ if(!clockSite())return {ok:false,reason:"Save the site first."}; S.site.posterKey=clockNewKey(); S.site.posterAt=Date.now(); logAudit("clock.poster","new poster","admin"); save(); return {ok:true}; }
function clockCardHTML(){ const s=clockSite(), site=S.site||{}, when=t=>fmt(new Date(t||0),{day:"numeric",month:"short",year:"numeric"});
  return `<div class="card" id="clockCard"><h2>Clock in / clock out</h2>
    <div class="sub">Staff tap Clock in and Clock out on their own shift. A tap outside the grace band proposes the real hours; you approve them under Requests, and they become the shift\u2019s own hours for pay. Rostered hours stand until you do.</div>
    <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:8px 0"><input type="checkbox" id="clockOn" ${clockOn()?"checked":""}${s?"":" disabled"}> Clock in/out <span class="muted small">\u2014 ${s?"every clinical shift in this group":"save the site first"}</span></label>
    <div class="row" style="align-items:flex-end">
      <label class="field"><span class="lbl">Grace <span class="muted">(minutes)</span></span><input type="number" id="clockGrace" min="0" max="60" step="1" value="${clockGrace()}" style="width:90px"></label>
      <span class="muted small">A tap within the band counts as the rostered time; 0 means every difference is proposed.</span></div>
    <div class="sub" style="margin-top:10px"><b>Site</b> \u2014 where the clinic is; every tap records its distance from this point.</div>
    <div class="row" style="align-items:flex-end">
      <label class="field"><span class="lbl">Latitude</span><input id="siteLat" inputmode="decimal" value="${s?s.lat:""}" placeholder="-33.68" style="width:120px"></label>
      <label class="field"><span class="lbl">Longitude</span><input id="siteLng" inputmode="decimal" value="${s?s.lng:""}" placeholder="150.92" style="width:120px"></label>
      <label class="field"><span class="lbl">Radius <span class="muted">(m)</span></span><input type="number" id="siteRadius" min="20" max="2000" value="${clockRadius()}" style="width:90px"></label>
      <button class="btn" id="siteHere">${ic("target")} Use my location here</button><button class="btn primary" id="siteSave">Save site</button></div>
    <div class="muted small" id="siteNote">${s?("Set "+escapeHTML(when(site.setAt))+(site.acc!=null?" \u00b7 the phone said \u00b1"+site.acc+" m":"")):"Stand at the clinic and tap Use my location here, or type the point."}</div>
    <div class="row" style="align-items:center;margin-top:10px;gap:10px"><span class="lbl">Poster</span>${s?`<button class="btn" id="posterPrint">${ic("print")} Print the clock poster</button><button class="btn sm" id="posterNew">New poster</button><span class="muted small">Poster made ${escapeHTML(when(site.posterAt))} \u00b7 a new one makes older posters stop working.</span>`:`<span class="muted small">Save the site first.</span>`}</div>
    <div class="muted small" style="margin-top:8px">Staff see: \u201cMyrosta keeps only the time of your tap and how far you were from the clinic.\u201d Nothing else about location is stored.</div>
  </div>`; }
'''
rep('function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }',
    CORE+'function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }')

# the Group half of Settings: the card, its index entry and its anchor list
rep('[brandingCardHTML(),tagsCardHTML(),C.cycles,', '[brandingCardHTML(),tagsCardHTML(),clockCardHTML(),C.cycles,')
rep('[["brandCard","Group"],["card-tags","Tags"],["card-cycles","Cycles"]', '[["brandCard","Group"],["card-tags","Tags"],["clockCard","Clock"],["card-cycles","Cycles"]')
rep('const SETUP_GROUP=["brandCard","card-tags","card-cycles",', 'const SETUP_GROUP=["brandCard","card-tags","clockCard","card-cycles",')

# the card's wiring, beside the own-hours tick
rep('''    const oh_=document.getElementById("ownHours"); if(oh_)oh_.onchange=()=>{ ownHoursSwitch(oh_.checked); toastSaved("group"); render(); };
''', '''    const oh_=document.getElementById("ownHours"); if(oh_)oh_.onchange=()=>{ ownHoursSwitch(oh_.checked); toastSaved("group"); render(); };
    const ck_=document.getElementById("clockOn"); if(ck_)ck_.onchange=()=>{ const r=clockSwitch(ck_.checked); if(!r.ok){ toast(r.reason); ck_.checked=false; return; } toastSaved("group"); render(); };
    const cg_=document.getElementById("clockGrace"); if(cg_)cg_.onchange=()=>{ const r=clockSetGrace(cg_.value); if(!r.ok){ toast(r.reason); render(); return; } toastSaved("group"); };
    const sh_=document.getElementById("siteHere"); if(sh_)sh_.onclick=()=>{ sh_.disabled=true; clockLocate(p=>{ sh_.disabled=false; if(!p){ toast("Your phone didn\\u2019t give a location \\u2014 allow it for myrosta.com.au, or type the point."); return; } const la=document.getElementById("siteLat"), lo=document.getElementById("siteLng"), n=document.getElementById("siteNote"); if(la)la.value=String(Math.round(p.lat*1e6)/1e6); if(lo)lo.value=String(Math.round(p.lng*1e6)/1e6); _siteAcc=Math.round(p.acc||0); if(n)n.textContent="Found you, \\u00b1"+_siteAcc+" m. Save site keeps it."; }); };
    const ss_=document.getElementById("siteSave"); if(ss_)ss_.onclick=()=>{ const la=document.getElementById("siteLat"), lo=document.getElementById("siteLng"), ra=document.getElementById("siteRadius"); const r=clockSiteSave(la?la.value:"",lo?lo.value:"",ra?ra.value:"",_siteAcc); _siteAcc=null; if(!r.ok){ toast(r.reason); return; } toastSaved("group"); render(); };
    const pn_=document.getElementById("posterNew"); if(pn_)pn_.onclick=()=>{ if(!confirm("Make a new poster? Older posters stop working once this one is printed."))return; if(clockPosterRenew().ok){ toastSaved("group"); render(); } };
''')

# the audit sentences
rep('"settings.branding":"Saved group details",', '"settings.branding":"Saved group details","settings.clock":"Changed the clock settings","settings.site":"Saved the site","clock.poster":"Made a new clock poster","clock.approve":"Approved clocked hours","clock.decline":"Declined clocked hours","export.clock":"Exported the clock report",')

# the merge: taps and decisions key by key, like call-ins
rep('if(f==="assign"||f==="oncall"||f==="callins")return;', 'if(f==="assign"||f==="oncall"||f==="callins"||f==="clock"||f==="clockDec")return;')
rep('''        if(Object.keys(cm).length)oc.callins=cm; else if("callins" in oc)oc.callins=cm; }
''', '''        if(Object.keys(cm).length)oc.callins=cm; else if("callins" in oc)oc.callins=cm; }
      ["clock","clockDec"].forEach(f=>{ if(!((f in oc)||(f in tc)||(bc&&(f in bc))))return;   // clock taps and decisions merge key by key like call-ins: a person's phone owns the taps, an admin's screen the decisions
        const m=_mergeKeyMap(oc[f],(f in tc)?tc[f]:(bc&&bc[f]),bc&&bc[f]); if(Object.keys(m).length)oc[f]=m; else if(f in oc)oc[f]=m; });
''')
P.write_text(s,encoding="utf-8"); print("c1-1-app: done")
```

Run: `python3 $SP/s3dry/edits/c1-1-app.py` (from the repo root, after extracting the plan's blocks) — Expected: `c1-1-app: done`.

- [ ] **Step 2: Add the test block with Task 1's tests**

```python
# file: c1-1-tests.py
import pathlib, sys
P=pathlib.Path("tests/suite.js"); s=P.read_text(encoding="utf-8")
BLOCK=r'''  // ---- clock in / clock out with a site geofence (C1): taps propose hours, the manager approves them as own hours.
  // Spec: docs/superpowers/specs/2026-09-29-clock-in-out-design.md. Dates are relative to today; "now" is fixed per test through _clockNow or passed in.
  (function(){
    var keep={S:S,toast:toast,confirm:confirm,dl:download,geo:navigator.geolocation,pick:_srPick,sid:_srSid,sheet:_daySheet,setup:_setupTab,search:location.search};
    var D=function(n){ return iso(addDays(new Date(),n)); }, T0=D(0), Y0=D(-1), TM=D(1);
    var c=null, said=[], SITE={lat:-33.68,lng:150.92};
    function at(isoD,hhmm){ var d=parseISO(isoD), m=/^(\d\d):(\d\d)$/.exec(hhmm); d.setHours(+m[1],+m[2],0,0); return d; }
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"RN",am:true,pm:true,pmLabel:""},{id:"z2",name:"EEN",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},unlockOrder:"both",rosterMode:"rolling",shiftTimes:{AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:"22:00"}}};
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Ava Ng",quota:20,eft:1},{id:"s2",name:"Sam Lee",quota:20,eft:1}],
         cycles:[{id:"cc",cycle:{start:D(-7),weeks:6},status:"published",archived:false,settings:set,roles:{s1:{in:true},s2:{in:true}},assign:{}}],
         activeId:"cc",viewAs:o.viewAs||"s1",tab:"my",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],publicHolidays:[]};
      if(o.on!==false){ S.clockOn=true; S.site={lat:SITE.lat,lng:SITE.lng,acc:12,setAt:1,radius:150,posterKey:"ABCDEFGHJKLMNPQR",posterAt:1}; }
      if(o.grace!=null)S.clockGrace=o.grace;
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srPick=[]; _srSid=null; _daySheet=null; _clockBusy=false; _clockNow=null; }
    function put(sid,isoD,period,hours){ var v={kind:"clinical",period:period||"AM",zone:"z1"}; if(hours)v.hours=hours; c.assign[sid+"|"+isoD]=v; return v; }
    function tap(sid,isoD,kind,t,f){ f=f||{}; if(!c.clock)c.clock={}; var k=sid+"|"+isoD, r=c.clock[k]||{}; var plus=f.plus||0; delete f.plus;
      r[kind]=Object.assign({t:t,ts:at(isoD,t).getTime()+plus,dist:null,acc:null,inside:null,via:"none"},f); c.clock[k]=r; return r; }
    function geo(pos){ navigator.geolocation={getCurrentPosition:function(ok,err){ if(pos)ok({coords:{latitude:pos.lat,longitude:pos.lng,accuracy:pos.acc}}); else err({code:1}); }}; }
    function last(k){ return (S.audit||[]).filter(function(a){ return a.action===k; })[0]||null; }
    function told(to){ return (S.notifications||[]).filter(function(n){ return n.to===to; })[0]||null; }
    toast=function(m){ said.push(String(m)); }; confirm=function(){ return true; };
    try{
      // ---- the rules
      T("clock: clockRound goes to the nearest 5 minutes, half up, and 23:58 becomes 00:00", clockRound("09:52")==="09:50" && clockRound("09:53")==="09:55" && clockRound("09:57")==="09:55" && clockRound("09:58")==="10:00" && clockRound("23:58")==="00:00" && clockRound("x")===null);
      T("clock: clockDist is the haversine distance in whole metres", (function(){ var a=clockDist(0,0,0,1), b=clockDist(SITE.lat,SITE.lng,SITE.lat,SITE.lng+0.01), z=clockDist(SITE.lat,SITE.lng,SITE.lat,SITE.lng); return Math.abs(a-111195)<=5 && Math.abs(b-926)<=6 && z===0; })());
      T("clock: clockInside gives the benefit of the doubt by the phone's accuracy, and null with no location", clockInside(100,null,150)===true && clockInside(160,20,150)===true && clockInside(200,20,150)===false && clockInside(151,0,150)===false && clockInside(null,20,150)===null);
      T("clock: the settings read as the spec says — off, 7 minutes and 150 m unless written; a site needs a numeric point", (function(){
        state({on:false}); var a=clockOn()===false && clockGrace()===7 && clockSite()===null && clockRadius()===150;
        S.clockGrace=12; S.site={lat:"x",lng:1}; var b=clockGrace()===12 && clockSite()===null;
        state(); return a && b && clockOn()===true && clockRadius()===150 && !!clockSite(); })());
      T("clock: clockWindow is the shift's rostered window, its own hours when the manager set some, and null off a clinical shift", (function(){
        state(); put("s1",T0); put("s2",T0,"PM",{start:"17:30",end:"00:00"}); c.assign["s1|"+TM]={kind:"cst",period:"AM"};
        var a=clockWindow(c,"s1",T0), b=clockWindow(c,"s2",T0); return !!a && a.start==="10:00" && a.end==="17:00" && a.own===false && !!b && b.start==="17:30" && b.end==="00:00" && b.own===true && clockWindow(c,"s1",TM)===null && clockWindow(c,"s1",Y0)===null; })());
      T("clock: clockMay opens Clock in from 60 minutes before the start until the finish, and Clock out from the in tap until the day ends", (function(){
        state(); put("s1",T0); var m=function(h){ return clockMay(c,"s1",T0,at(T0,h)); };
        var a=m("08:59").in===false && m("09:00").in===true && m("13:00").in===true && m("17:00").in===true && m("17:01").in===false && m("13:00").out===false;
        tap("s1",T0,"in","09:50"); var b=m("09:49").out===false && m("09:50").out===true && m("23:59").out===true && m("09:50").in===false && clockMay(c,"s1",T0,at(TM,"00:30")).out===false;
        tap("s1",T0,"out","17:10"); var d=m("18:00").out===false && m("18:00").in===false; return a && b && d; })());
      T("clock: a shift that ends at midnight takes its out tap until 01:00 the next day", (function(){
        state(); put("s1",T0,"PM",{start:"17:00",end:"00:00"}); tap("s1",T0,"in","16:55");
        return clockMay(c,"s1",T0,at(TM,"00:59")).out===true && clockMay(c,"s1",T0,at(TM,"01:01")).out===false && clockMay(c,"s1",T0,at(T0,"23:30")).out===true; })());
      T("clock: clockProposal — inside the grace band the rostered hours stand and nothing is proposed", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:55",{dist:20,acc:10,inside:true,via:"gps"}); tap("s1",T0,"out","17:05",{dist:30,acc:10,inside:true,via:"gps"});
        var p=clockProposal(c,"s1",T0,7,at(T0,"17:06")); return p.status==="rostered" && p.flags.length===0 && p.rostered.start==="10:00" && p.rostered.end==="17:00" && p.start===undefined; })());
      T("clock: clockProposal — an early start and a late finish outside the band are proposed, in the taps' rounded minutes, with plain flags", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:40",{dist:20,acc:10,inside:true,via:"gps"}); tap("s1",T0,"out","17:25",{dist:30,acc:10,inside:true,via:"gps"});
        var p=clockProposal(c,"s1",T0,7,at(T0,"17:30")); return p.status==="proposed" && p.start==="09:40" && p.end==="17:25" && p.flags.join("|")==="early 20 min|late 25 min"; })());
      T("clock: clockProposal — one end inside the band keeps the rostered time while the other is proposed; a late start and an early finish read as such", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:55"); tap("s1",T0,"out","16:30"); var p=clockProposal(c,"s1",T0,7,at(T0,"17:00"));
        tap("s2",T0,"in","10:20"); put("s2",T0); tap("s2",T0,"out","17:03"); var q=clockProposal(c,"s2",T0,7,at(T0,"17:30"));
        return p.status==="proposed" && p.start==="10:00" && p.end==="16:30" && p.flags.join("|")==="left early 30 min|no location" && q.status==="proposed" && q.start==="10:20" && q.end==="17:00" && q.flags.join("|")==="started late 20 min|no location"; })());
      T("clock: clockProposal — grace 0 proposes a five-minute difference; a wider band swallows it", (function(){
        state({grace:0}); put("s1",T0); tap("s1",T0,"in","09:55"); tap("s1",T0,"out","17:00");
        var p=clockProposal(c,"s1",T0,clockGrace(),at(T0,"17:30")), q=clockProposal(c,"s1",T0,15,at(T0,"17:30")); return p.status==="proposed" && p.start==="09:55" && p.end==="17:00" && q.status==="rostered"; })());
      T("clock: clockProposal — location flags name a tap outside the radius, a tap with no location and a tap by poster, once each", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:40",{dist:420,acc:15,inside:false,via:"gps"}); tap("s1",T0,"out","17:00",{via:"poster"});
        var p=clockProposal(c,"s1",T0,7,at(T0,"17:30")); tap("s2",T0,"in","10:00"); put("s2",T0); tap("s2",T0,"out","17:20"); var q=clockProposal(c,"s2",T0,7,at(T0,"17:30"));
        return p.flags.join("|")==="early 20 min|outside the radius (420 m)|by poster" && q.flags.join("|")==="late 20 min|no location"; })());
      T("clock: clockProposal — an in tap alone is open until the day ends, then closed without a clock-out; no shift is void; an out tap before the in tap is void", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:50"); var a=clockProposal(c,"s1",T0,7,at(T0,"18:00")).status==="open", b=clockProposal(c,"s1",T0,7,at(TM,"00:01"));
        tap("s2",T0,"in","10:00"); var v=clockProposal(c,"s2",T0,7,at(T0,"12:00"));
        put("s2",T0); tap("s2",T0,"out","09:30"); var o=clockProposal(c,"s2",T0,7,at(T0,"12:00"));
        return a && b.status==="noOut" && b.flags[0]==="no clock-out" && v.status==="void" && v.flags[0]==="no shift" && o.status==="void" && o.flags[0]==="taps out of order" && clockProposal(c,"s1",TM,7,at(T0,"12:00")).status==="none"; })());
      T("clock: clockProposal — a shift to midnight clocked out after midnight proposes 00:00 at most, and says so when the tap went past it", (function(){
        state(); put("s1",T0,"PM",{start:"17:00",end:"00:00"}); tap("s1",T0,"in","16:40"); tap("s1",T0,"out","00:20",{plus:86400000});
        var p=clockProposal(c,"s1",T0,7,at(TM,"00:30")); put("s2",T0,"PM",{start:"17:00",end:"00:00"}); tap("s2",T0,"in","17:00"); tap("s2",T0,"out","00:05",{plus:86400000}); var q=clockProposal(c,"s2",T0,7,at(TM,"00:30"));
        return p.status==="proposed" && p.start==="16:40" && p.end==="00:00" && p.flags.join("|")==="early 20 min|capped at midnight|no location" && q.status==="rostered"; })());
      // ---- the settings
      T("clock: the switch refuses to turn on without a site, then writes true and deletes on off, audited", (function(){
        state({on:false}); var r=clockSwitch(true); var a=r.ok===false && /site first/.test(r.reason) && S.clockOn===undefined;
        S.site={lat:SITE.lat,lng:SITE.lng,acc:null,setAt:1,radius:150,posterKey:"K",posterAt:1}; var b=clockSwitch(true).ok && S.clockOn===true && last("settings.clock").detail==="on";
        clockSwitch(false); return a && b && !("clockOn" in S) && last("settings.clock").detail==="off"; })());
      T("clock: the grace band is 0 to 60, stored only when it is not the default, audited", (function(){
        state(); var a=clockSetGrace(61).ok===false && clockSetGrace(-1).ok===false && clockSetGrace("x").ok===false && !("clockGrace" in S);
        var b=clockSetGrace("12").ok && S.clockGrace===12 && clockGrace()===12 && last("settings.clock").detail==="grace 12 min"; clockSetGrace(7); return a && b && !("clockGrace" in S) && clockGrace()===7; })());
      T("clock: saving the site checks the point and the radius, keeps the poster key across saves, and audits the radius and accuracy but never the point", (function(){
        state({on:false}); var a=clockSiteSave("x",150.9,150).ok===false && clockSiteSave(-33.68,181,150).ok===false && clockSiteSave(-33.68,150.9,5).ok===false && clockSiteSave("",150.9,150).ok===false && S.site===undefined;
        var r=clockSiteSave("-33.6812345678",150.92,"200",23); var k=S.site&&S.site.posterKey; var b=r.ok && S.site.lat===-33.681235 && S.site.lng===150.92 && S.site.radius===200 && S.site.acc===23 && /^[A-Z2-9]{16}$/.test(k) && last("settings.site").detail==="radius 200 m \u00b7 \u00b123 m" && last("settings.site").detail.indexOf("33.")<0;
        var r2=clockSiteSave(-33.68,150.92,150,null); return a && b && r2.ok && S.site.posterKey===k && S.site.acc===23 && S.site.radius===150; })());
      T("clock: a new poster changes the key, the token check follows it, and the poster link carries the group and the key", (function(){
        state(); var a=clockTokenOK("ABCDEFGHJKLMNPQR")===true && clockTokenOK("abcdefghjklmnpqr")===false && clockTokenOK("")===false;
        var r=clockPosterRenew(); var b=r.ok && S.site.posterKey!=="ABCDEFGHJKLMNPQR" && /^[A-Z2-9]{16}$/.test(S.site.posterKey) && clockTokenOK("ABCDEFGHJKLMNPQR")===false && clockTokenOK(S.site.posterKey)===true && last("clock.poster").detail==="new poster";
        var u=clockPosterURL(); var d=u==="https://test/app.html?org="+encodeURIComponent(_org)+"&clock="+S.site.posterKey; state({on:false}); return a && b && d && clockPosterRenew().ok===false && clockTokenOK("x")===false; })());
      T("clock: the Clock card sits in the Group half of Settings, disabled until a site is saved, and names the grace, the site and the poster", (function(){
        state({on:false}); S.viewAs="admin"; _setupTab="group"; var h=viewSetup(); var seg0=h.slice(h.indexOf('id="clockOn"'),h.indexOf('id="clockOn"')+40); var a=h.indexOf('id="clockCard"')>=0 && seg0.length>10 && / disabled/.test(seg0) && !/ checked/.test(seg0) && h.indexOf('id="posterPrint"')<0 && h.indexOf('data-go="setup||clockCard"')>=0;
        state(); S.viewAs="admin"; _setupTab="group"; h=viewSetup(); var seg=h.slice(h.indexOf('id="clockOn"'),h.indexOf('id="clockOn"')+40);
        return a && / checked/.test(seg) && !/ disabled/.test(seg) && h.indexOf('id="posterPrint"')>=0 && h.indexOf('id="posterNew"')>=0 && h.indexOf('value="7"')>=0 && h.indexOf("only the time of your tap")>=0; })());
      T("clock: taps and decisions merge key by key — a phone's tap and a manager's decision on one key both survive, and nobody's slot is lost", (function(){
        state(); put("s1",T0); put("s2",T0); var base=JSON.parse(JSON.stringify(S)), keepS=S, keepB=_remoteBase;
        var mine=JSON.parse(JSON.stringify(base)); mine.cycles[0].clock={}; mine.cycles[0].clock["s1|"+T0]={in:{t:"09:50",ts:1,dist:10,acc:5,inside:true,via:"gps"}};
        var theirs=JSON.parse(JSON.stringify(base)); theirs.cycles[0].clockDec={}; theirs.cycles[0].clockDec["s1|"+T0]={ok:false,by:"admin",ts:2}; theirs.cycles[0].clock={}; theirs.cycles[0].clock["s2|"+T0]={in:{t:"10:00",ts:3,dist:null,acc:null,inside:null,via:"none"}};
        _remoteBase=JSON.stringify(base); S=mine; var out=mergeOnto(theirs); S=keepS; _remoteBase=keepB; var ck=out.cycles[0].clock||{}, dc=out.cycles[0].clockDec||{};
        return !!ck["s1|"+T0] && ck["s1|"+T0].in.t==="09:50" && !!ck["s2|"+T0] && ck["s2|"+T0].in.t==="10:00" && !!dc["s1|"+T0] && dc["s1|"+T0].ok===false; })());
      T("clock: a group with the switch off writes none of the new keys, and normalize seeds nothing", (function(){ state({on:false}); normalize(); return !("clockOn" in S) && !("clockGrace" in S) && !("site" in S) && !("clock" in c) && !("clockDec" in c); })());
      // ---- clock: later tasks add their tests above this line
    } finally { S=keep.S; toast=keep.toast; confirm=keep.confirm; download=keep.dl; navigator.geolocation=keep.geo; _srPick=keep.pick; _srSid=keep.sid; _daySheet=keep.sheet; _setupTab=keep.setup; location.search=keep.search; _clockBusy=false; _clockNow=null; _siteAcc=null; hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
'''
ANCHOR='''  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();
  T("full render passes (setup + my)", true);'''
n=s.count(ANCHOR)
if n!=1: sys.exit("c1-1-tests: the suite's closing lines were not found once (%d)" % n)
s=s.replace(ANCHOR, BLOCK+ANCHOR); P.write_text(s,encoding="utf-8"); print("c1-1-tests: done")
```

- [ ] **Step 3: Sync, build the demo, run the suite**

Run: `python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py | tail -3` — Expected: `0 failed`, and every `clock:` line above `PASS`.

- [ ] **Step 4: Commit**

```bash
git add app.html deploy/app.html deploy/demo.html preview.html tests/suite.js
git commit -m "Clock (C1) 1/4: the group settings, the site, the rules and the merge — clockProposal computes a record's status from its taps; nothing is written for a group with the switch off"
```

### Task 2: The taps — buttons, the phone's location, the poster link

**Files:**
- Modify: `app.html` (the C1 section, `viewMy`, `daySheetHTML`, the my/selfroster wiring blocks, `_handleAuth`, `boot`)
- Test: `tests/suite.js` (inside the C1 block, above its marker)

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: `clockTarget(cyc,sid,kind,now)→iso|null`, `clockWrite(cyc,sid,isoD,kind,now,fix)→{ok,tap|reason}`, `clockTap(kind,fix,now)→{ok,pending?|tap|reason}`, `clockPlace(tap)`, `clockStatusText(cyc,sid,isoD,now)`, `clockMyHTML(sid,now)`, `clockSheetHTML(cyc,sid,isoD,now)`, `clockReadURL()`, `clockApplyURL(now)→"in"|"out"|"org"|"off"|"stale"|"none"|"refused"|null`. Buttons carry `data-clockin="<iso>"` and `data-clockout="<iso>"`, wired in both the My shifts and the day sheet blocks.
- The URL scheme: `app.html?org=<orgId>&clock=<posterKey>`; the pending scan waits in `sessionStorage["myrosta_clock"]` until the sign-in has resolved its group.

- [ ] **Step 1: Apply the app edits**

```python
# file: c1-2-app.py
import pathlib, sys
P=pathlib.Path("app.html"); s=P.read_text(encoding="utf-8")
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: sys.exit("c1-2-app: expected one occurrence, found %d:\n%s" % (n, old[:160]))
    s=s.replace(old,new)

TAPS=r'''function clockTarget(cyc,sid,kind,now){ const t=iso(now), y=iso(addDays(now,-1)); if(kind==="in")return clockMay(cyc,sid,t,now).in?t:null; return clockMay(cyc,sid,t,now).out?t:(clockMay(cyc,sid,y,now).out?y:null); }   // today's shift, or yesterday's still waiting for its clock-out
function clockWrite(cyc,sid,isoD,kind,now,f){ const key=sid+"|"+isoD; if(!cyc.clock)cyc.clock={}; const rec=cyc.clock[key]||{};
  if(kind==="in"&&rec.in)return {ok:false,reason:"Already clocked in at "+rec.in.t+"."}; if(kind==="out"&&!rec.in)return {ok:false,reason:"Clock in first."}; if(kind==="out"&&rec.out)return {ok:false,reason:"Already clocked out at "+rec.out.t+"."};
  const tap={t:clockRound(clockNowHHMM(now)),ts:now.getTime(),dist:(f.dist==null)?null:Math.round(f.dist),acc:(f.acc==null)?null:Math.round(f.acc),inside:(f.inside==null)?null:!!f.inside,via:f.via||"none"};
  rec[kind]=tap; cyc.clock[key]=rec; save(); return {ok:true,tap:tap}; }
function clockPlace(tap){ if(!tap)return ""; if(tap.via==="poster")return "by poster"; if(tap.inside==null)return "no location"; return tap.inside?"at the clinic":(tap.dist+" m from the clinic"); }
function clockTap(kind,fix,now){ now=now||clockNow(); if(!clockOn())return {ok:false,reason:"Clocking is off for this group."}; if(isAdmin())return {ok:false,reason:"Admins set hours from the roster cell."};
  const cyc=active(), sid=S.viewAs, isoD=clockTarget(cyc,sid,kind,now); if(!isoD)return {ok:false,reason:kind==="in"?"Nothing to clock in to right now.":"Nothing to clock out of right now."};
  if(fix)return clockWrite(cyc,sid,isoD,kind,now,fix);
  if(_clockBusy)return {ok:false,reason:"Still finding your location\u2026"};
  _clockBusy=true; render();
  clockLocate(pos=>{ _clockBusy=false; const site=clockSite(); let f={dist:null,acc:null,inside:null,via:"none"};
    if(pos&&site){ const d=clockDist(pos.lat,pos.lng,site.lat,site.lng); f={dist:d,acc:Math.round(pos.acc||0),inside:clockInside(d,pos.acc,clockRadius()),via:"gps"}; }
    const r=clockWrite(cyc,sid,isoD,kind,now,f); if(r.ok)toast("Clocked "+kind+" "+r.tap.t+" \u00b7 "+clockPlace(r.tap),"ok"); else toast(r.reason); render(); });   // the tap's time is when they tapped, not when the phone answered
  return {ok:true,pending:true}; }
function clockStatusText(cyc,sid,isoD,now){ const rec=clockRec(cyc,sid,isoD); if(!rec||!rec.in)return ""; const p=clockProposal(cyc,sid,isoD,clockGrace(),now), dec=clockDecOf(cyc,sid,isoD);
  if(!rec.out)return (p.status==="noOut")?"Closed without a clock-out \u2014 your manager can see it.":("Clocked in "+rec.in.t+" \u00b7 "+clockPlace(rec.in));
  const span="Clocked "+rec.in.t+"\u2013"+rec.out.t; if(dec)return span+" \u00b7 "+(dec.ok?"approved "+dec.start+"\u2013"+dec.end:"as rostered");
  if(p.status==="proposed")return span+" \u00b7 waiting for your manager"; if(p.status==="rostered")return span+" \u00b7 as rostered"; return span+" \u00b7 "+(p.flags[0]||"as rostered"); }
function clockButtonsHTML(cyc,sid,isoD,now){ const may=clockMay(cyc,sid,isoD,now); if(_clockBusy)return `<button class="btn" disabled>Finding your location\u2026</button>`;
  return may.in?`<button class="btn primary" data-clockin="${isoD}">${ic("clock")} Clock in</button>`:(may.out?`<button class="btn primary" data-clockout="${isoD}">${ic("clock")} Clock out</button>`:""); }
const CLOCK_NOTE="Myrosta keeps only the time of your tap and how far you were from the clinic.";
function clockMyHTML(sid,now){ if(!clockOn()||isAdmin()||sid!==S.viewAs)return ""; now=now||clockNow(); const cyc=active(), t=iso(now), y=iso(addDays(now,-1));
  const rows=[t,y].map(d=>{ const w=clockWindow(cyc,sid,d), rec=clockRec(cyc,sid,d)||{}, st=clockStatusText(cyc,sid,d,now), btn=w?clockButtonsHTML(cyc,sid,d,now):""; if(!btn&&!st)return "";
    const late=d===t&&!!w&&!!rec.in&&!rec.out&&clockMin(clockNowHHMM(now))>((w.end==="00:00")?1440:clockMin(w.end));   // past the rostered finish and still clocked in: the banner
    return `<div class="listrow"><span class="grow"><b>${d===t?"Today":"Yesterday"}</b>${late?` <span class="tag warn">Still clocked in from ${escapeHTML(rec.in.t)}</span>`:""}${st?`<div class="muted small">${escapeHTML(st)}</div>`:""}</span>${btn}</div>`; }).join("");
  return rows?`<div class="card" style="margin-top:8px"><b>Clock</b>${rows}<div class="muted small">${CLOCK_NOTE}</div></div>`:""; }
function clockSheetHTML(cyc,sid,isoD,now){ if(!clockOn()||isAdmin()||sid!==S.viewAs||!clockWindow(cyc,sid,isoD))return ""; now=now||clockNow(); const btn=clockButtonsHTML(cyc,sid,isoD,now), st=clockStatusText(cyc,sid,isoD,now); if(!btn&&!st)return "";
  return `<div class="dsact" style="align-items:center">${btn}${st?`<span class="muted small">${escapeHTML(st)}</span>`:""}</div><div class="muted small">${CLOCK_NOTE}</div>`; }
function clockReadURL(){ const q=String(location.search||""), m=/[?&]clock=([^&#]+)/.exec(q); if(!m)return null; const om=/[?&]org=([^&#]+)/.exec(q); let token="", org=""; try{ token=decodeURIComponent(m[1]); org=om?decodeURIComponent(om[1]):""; }catch(e){ return null; }
  const pending={org:org,token:token}; try{ sessionStorage.setItem("myrosta_clock",JSON.stringify(pending)); if(org)localStorage.setItem("myrosta_org",org); }catch(e){}   // the scan waits for the sign-in, and names the group the poster belongs to
  try{ history.replaceState(null,"",location.pathname); }catch(e){} return pending; }   // a refresh never taps again
function clockApplyURL(now){ let p=null; try{ p=JSON.parse(sessionStorage.getItem("myrosta_clock")||"null"); sessionStorage.removeItem("myrosta_clock"); }catch(e){} if(!p)return null;
  if(p.org&&p.org!==_org){ toast("That poster belongs to another group."); return "org"; }
  if(!clockOn()){ toast("Clocking is off for this group."); return "off"; }
  if(!clockTokenOK(p.token)){ toast("This poster is out of date \u2014 ask your manager for the new one."); return "stale"; }
  now=now||clockNow(); const cyc=active(), sid=S.viewAs, kind=clockTarget(cyc,sid,"in",now)?"in":(clockTarget(cyc,sid,"out",now)?"out":null);
  if(!kind){ toast("Nothing to clock today."); return "none"; }
  const r=clockTap(kind,{dist:null,acc:null,inside:null,via:"poster"},now); if(r.ok){ toast("Clocked "+kind+" "+r.tap.t+" \u00b7 by poster","ok"); render(); return kind; } toast(r.reason); return "refused"; }
'''
rep('function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }',
    TAPS+'function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }')

# My shifts: the Clock card under the action row; the day sheet: the buttons after the on-call block
rep('${actionRowHTML(sid,s)}${sid===S.viewAs?a2hsCardHTML():""}', '${actionRowHTML(sid,s)}${clockMyHTML(sid)}${sid===S.viewAs?a2hsCardHTML():""}')
rep('  body+=ocSheetHTML(cyc,sid,isoD,adm,canPick);\n', '  body+=ocSheetHTML(cyc,sid,isoD,adm,canPick); body+=clockSheetHTML(cyc,sid,isoD);\n')

# the wiring: both tabs draw the same two buttons
rep('''  if(S.tab==="my"){
    document.querySelectorAll("[data-osclaim]")''', '''  if(S.tab==="my"){
    document.querySelectorAll("[data-clockin]").forEach(b=>b.onclick=()=>{ const r=clockTap("in"); if(!r.ok)toast(r.reason); });
    document.querySelectorAll("[data-clockout]").forEach(b=>b.onclick=()=>{ const r=clockTap("out"); if(!r.ok)toast(r.reason); });
    document.querySelectorAll("[data-osclaim]")''')
rep('''  if(S.tab==="selfroster"){
''', '''  if(S.tab==="selfroster"){
    document.querySelectorAll("[data-clockin]").forEach(b=>b.onclick=()=>{ const r=clockTap("in"); if(!r.ok)toast(r.reason); });
    document.querySelectorAll("[data-clockout]").forEach(b=>b.onclick=()=>{ const r=clockTap("out"); if(!r.ok)toast(r.reason); });
''')

# the poster link: read at boot, applied once the sign-in has resolved its group (and straight away in local mode)
rep('''async function boot(){
  if(cloudOn()){''', '''async function boot(){
  clockReadURL();   // a poster scan: kept aside until the sign-in has resolved its group
  if(cloudOn()){''')
rep('''} else { authState="local"; load(); safeRenderInit(); }''', '''} else { authState="local"; load(); safeRenderInit(); clockApplyURL(); }''')
rep('''S.tab=(authState==="in")?_liveTab:landingTab(id,_devTab||S.tab); authState="in"; safeRenderInit(); startIdleWatch();''', '''S.tab=(authState==="in")?_liveTab:landingTab(id,_devTab||S.tab); authState="in"; safeRenderInit(); clockApplyURL(); startIdleWatch();''')
P.write_text(s,encoding="utf-8"); print("c1-2-app: done")
```

- [ ] **Step 2: Add Task 2's tests above the block's marker**

```python
# file: c1-2-tests.py
import pathlib, sys
P=pathlib.Path("tests/suite.js"); s=P.read_text(encoding="utf-8")
TESTS=r'''      // ---- the taps (Task 2)
      T("clock: a tap asks the phone where it is and records the time (rounded), the distance, the accuracy, inside or outside, and how it was proved", (function(){
        state(); put("s1",T0); geo({lat:SITE.lat,lng:SITE.lng+0.0005,acc:15}); var r=clockTap("in",null,at(T0,"09:52")); var rec=clockRec(c,"s1",T0);
        return r.ok===true && r.pending===true && _clockBusy===false && !!rec && rec.in.t==="09:50" && rec.in.ts===at(T0,"09:52").getTime() && rec.in.dist>40 && rec.in.dist<55 && rec.in.acc===15 && rec.in.inside===true && rec.in.via==="gps" && said[said.length-1]==="Clocked in 09:50 \u00b7 at the clinic"; })());
      T("clock: a tap the phone cannot place still goes through, marked no location; one far from the site is outside", (function(){
        state(); put("s1",T0); geo(null); clockTap("in",null,at(T0,"09:58")); var a=clockRec(c,"s1",T0).in; put("s2",T0); S.viewAs="s2"; geo({lat:SITE.lat+0.01,lng:SITE.lng,acc:10}); clockTap("in",null,at(T0,"10:02")); var b=clockRec(c,"s2",T0).in;
        return a.t==="10:00" && a.dist===null && a.inside===null && a.via==="none" && said.some(function(m){ return m==="Clocked in 10:00 \u00b7 no location"; }) && b.inside===false && b.dist>1000 && b.via==="gps" && said.some(function(m){ return /^Clocked in 10:00 \u00b7 \d+ m from the clinic$/.test(m); }); })());
      T("clock: the second in tap, an out before an in, a second out, a tap with no shift and an admin's tap are refused with a reason", (function(){
        state(); put("s1",T0); geo({lat:SITE.lat,lng:SITE.lng,acc:5}); var n0=clockTap("out",null,at(T0,"09:30")); clockTap("in",null,at(T0,"09:55")); var n1=clockTap("in",null,at(T0,"10:30"));
        clockTap("out",null,at(T0,"17:02")); var n2=clockTap("out",null,at(T0,"17:05")); S.viewAs="s2"; var n3=clockTap("in",null,at(T0,"10:00")); S.viewAs="admin"; var n4=clockTap("in",null,at(T0,"10:00"));
        return n0.ok===false && /Nothing to clock out/.test(n0.reason) && n1.ok===false && /Nothing to clock in/.test(n1.reason) && n2.ok===false && /Nothing to clock out/.test(n2.reason) && n3.ok===false && n4.ok===false && /roster cell/.test(n4.reason) && clockRec(c,"s1",T0).out.t==="17:00"; })());
      T("clock: with the switch off there are no taps, no card and nothing on the day sheet", (function(){ state({on:false}); put("s1",T0); geo({lat:SITE.lat,lng:SITE.lng,acc:5}); var r=clockTap("in",null,at(T0,"10:00")); _clockNow=at(T0,"10:00").getTime(); return r.ok===false && /off for this group/.test(r.reason) && !c.clock && clockMyHTML("s1")==="" && clockSheetHTML(c,"s1",T0)===""; })());
      T("clock: My shifts shows Clock in from an hour before the start, the receipt and Clock out after it, and the status once both taps are in", (function(){
        state(); put("s1",T0); _clockNow=at(T0,"09:05").getTime(); var h1=clockMyHTML("s1"); var a=h1.indexOf('data-clockin="'+T0+'"')>=0 && h1.indexOf("only the time of your tap")>=0;
        _clockNow=at(T0,"08:30").getTime(); var h0=clockMyHTML("s1");
        tap("s1",T0,"in","09:50",{dist:12,acc:8,inside:true,via:"gps"}); _clockNow=at(T0,"12:00").getTime(); var h2=clockMyHTML("s1"); var b=h2.indexOf('data-clockout="'+T0+'"')>=0 && h2.indexOf("Clocked in 09:50 \u00b7 at the clinic")>=0 && h2.indexOf("Still clocked in")<0;
        tap("s1",T0,"out","17:20",{dist:12,acc:8,inside:true,via:"gps"}); var h3=clockMyHTML("s1"); var d=h3.indexOf("data-clock")<0 && h3.indexOf("Clocked 09:50\u201317:20 \u00b7 waiting for your manager")>=0;
        return a && h0==="" && b && d; })());
      T("clock: past the rostered finish and still clocked in, My shifts says so and keeps the Clock out button; the next day it says the record closed", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:55"); _clockNow=at(T0,"17:20").getTime(); var h=clockMyHTML("s1"); var a=h.indexOf("Still clocked in from 09:55")>=0 && h.indexOf('data-clockout="'+T0+'"')>=0;
        state(); put("s1",Y0); tap("s1",Y0,"in","09:55"); _clockNow=at(T0,"08:00").getTime(); var g=clockMyHTML("s1"); return a && g.indexOf("Yesterday")>=0 && g.indexOf("Closed without a clock-out")>=0 && g.indexOf("data-clock")<0; })());
      T("clock: the day sheet carries the same buttons and status for the person's own day, and nothing for an admin or another person's sheet", (function(){
        state(); put("s1",T0); _clockNow=at(T0,"09:30").getTime(); var a=clockSheetHTML(c,"s1",T0).indexOf('data-clockin="'+T0+'"')>=0; var none=clockSheetHTML(c,"s2",T0)==="" && clockSheetHTML(c,"s1",TM)==="";
        S.viewAs="admin"; var adm=clockSheetHTML(c,"s1",T0)===""; S.viewAs="s1"; S.tab="selfroster"; _daySheet=T0; var sheet=daySheetHTML(T0); return a && none && adm && sheet.indexOf('data-clockin="'+T0+'"')>=0 && sheet.indexOf("only the time of your tap")>=0; })());
      T("clock: My shifts renders the Clock card inside the page, under the action row", (function(){ state(); put("s1",T0); _clockNow=at(T0,"09:30").getTime(); S.tab="my"; var h=viewMy(); return h.indexOf('data-clockin="'+T0+'"')>=0 && h.indexOf('data-clockin')>h.indexOf('class="actrow"'); })());
      T("clock: a poster scan is read from the link, kept aside with the group it names, and the link is cleaned", (function(){
        state(); location.search="?org=grp-x&clock=ABCDEFGHJKLMNPQR"; var p=clockReadURL(); var kept=JSON.parse(sessionStorage.getItem("myrosta_clock")||"null"); var org=localStorage.getItem("myrosta_org");
        sessionStorage.removeItem("myrosta_clock"); location.search=""; localStorage.setItem("myrosta_org",_org); var none=clockReadURL();
        return !!p && p.org==="grp-x" && p.token==="ABCDEFGHJKLMNPQR" && !!kept && kept.token==="ABCDEFGHJKLMNPQR" && org==="grp-x" && none===null; })());
      T("clock: an applied scan taps in with presence by poster, then out; a stale key, another group's poster, the switch off and no shift each say so and tap nothing", (function(){
        state(); put("s1",T0); var pend=function(tok,org){ sessionStorage.setItem("myrosta_clock",JSON.stringify({org:org===undefined?_org:org,token:tok})); };
        pend("ABCDEFGHJKLMNPQR"); var r1=clockApplyURL(at(T0,"09:50")); var rec=clockRec(c,"s1",T0); var a=r1==="in" && !!rec && rec.in.via==="poster" && rec.in.dist===null && rec.in.inside===null && said[said.length-1]==="Clocked in 09:50 \u00b7 by poster";
        pend("ABCDEFGHJKLMNPQR"); var r2=clockApplyURL(at(T0,"17:04")); var b=r2==="out" && rec.out.t==="17:05" && rec.out.via==="poster";
        pend("WRONGKEYWRONGKEY"); var r3=clockApplyURL(at(T0,"17:10")); var stale=said.some(function(m){ return /out of date/.test(m); }); pend("ABCDEFGHJKLMNPQR","other-group"); var r4=clockApplyURL(at(T0,"17:10")); var r5=clockApplyURL(at(T0,"17:10"));
        S.viewAs="s2"; pend("ABCDEFGHJKLMNPQR"); var r6=clockApplyURL(at(T0,"17:10")); state({on:false}); pend("ABCDEFGHJKLMNPQR"); var r7=clockApplyURL(at(T0,"10:00"));
        return a && b && r3==="stale" && stale && r4==="org" && r5===null && r6==="none" && r7==="off" && sessionStorage.getItem("myrosta_clock")===null; })());
'''
MARK='      // ---- clock: later tasks add their tests above this line\n'
n=s.count(MARK)
if n!=1: sys.exit("c1-2-tests: the block marker was not found once (%d)" % n)
s=s.replace(MARK, TESTS+MARK); P.write_text(s,encoding="utf-8"); print("c1-2-tests: done")
```

- [ ] **Step 3: Sync, build the demo, run the suite**

Run: `python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py | tail -3` — Expected: `0 failed`.

- [ ] **Step 4: Commit**

```bash
git add app.html deploy/app.html deploy/demo.html preview.html tests/suite.js
git commit -m "Clock (C1) 2/4: Clock in and Clock out on My shifts and the day sheet, the phone's location at the tap, the receipt, the forgotten clock-out banner, and the poster link applied once the sign-in has resolved its group"
```

---

### Task 3: Proposals, the manager's list, Approve and Decline, the board marks

**Files:**
- Modify: `app.html` (the C1 section, `viewRequests`, the requests wiring block, `viewDaily`, `daySheetHTML`)
- Test: `tests/suite.js` (inside the C1 block, above its marker)

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: `clockRows(cyc,now)→[{sid,isoD,p,rec,dec}]`, `clockCount(cyc,now)`, `clockListHTML(now)`, `clockApprove(sid,isoD)→{ok,reason?}`, `clockDecline(sid,isoD)→{ok,reason?}`, `clockMarkHTML(cyc,sid,isoD)`. Buttons `data-clkok="<sid>|<iso>"` and `data-clkno="<sid>|<iso>"`, wired in the requests block.
- Approve writes through `hoursSet(sid,isoD,start,end)` (its own `hours.set` audit line and notification), then the decision and a `clock.approve` line. Decline writes the decision, a `clock.decline` line and tells the person.

- [ ] **Step 1: Apply the app edits**

```python
# file: c1-3-app.py
import pathlib, sys
P=pathlib.Path("app.html"); s=P.read_text(encoding="utf-8")
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: sys.exit("c1-3-app: expected one occurrence, found %d:\n%s" % (n, old[:160]))
    s=s.replace(old,new)

LIST=r'''function clockRows(cyc,now){ const g=clockGrace(), keepFrom=iso(addDays(now,-CLOCK_KEEP)), open=r=>r.p.status==="proposed"&&!r.dec;   // proposals first, newest day first, then a fortnight of closed records for information
  return Object.keys(cyc.clock||{}).map(k=>{ const sid=k.split("|")[0], isoD=k.split("|")[1]; return {sid:sid,isoD:isoD,p:clockProposal(cyc,sid,isoD,g,now),rec:cyc.clock[k],dec:clockDecOf(cyc,sid,isoD)}; })
    .filter(r=>r.p.status!=="none"&&(open(r)||r.isoD>=keepFrom)).sort((a,b)=>((open(a)?0:1)-(open(b)?0:1))||(a.isoD<b.isoD?1:a.isoD>b.isoD?-1:0)||nameOf(a.sid).localeCompare(nameOf(b.sid))); }
function clockCount(cyc,now){ return clockRows(cyc,now).filter(r=>r.p.status==="proposed"&&!r.dec).length; }
function clockListHTML(now){ if(!isAdmin()||!clockOn())return ""; now=now||clockNow(); const cyc=active(), rows=clockRows(cyc,now); if(!rows.length)return ""; const n=clockCount(cyc,now);
  const row=r=>{ const open=r.p.status==="proposed"&&!r.dec, rec=r.rec, ro=r.p.rostered, line=(ro?"rostered "+ro.start+"\u2013"+ro.end+" \u00b7 ":"")+"clocked "+rec.in.t+"\u2013"+(rec.out?rec.out.t:"?")+(open?" \u00b7 proposes "+r.p.start+"\u2013"+r.p.end:"");
    const chips=r.p.flags.map(f=>`<span class="tag ${/outside|no location|out of order|no clock-out|no shift/.test(f)?"warn":"muted"} mini">${escapeHTML(f)}</span>`).join(" ");
    const word=r.dec?(r.dec.ok?"approved "+r.dec.start+"\u2013"+r.dec.end:"declined \u00b7 as rostered"):(open?"":(r.p.status==="rostered"?"as rostered":r.p.status==="noOut"?"no clock-out":r.p.status==="void"?"no proposal":"still clocked in"));
    return `<div class="listrow${open?"":" muted"}"><span class="grow"><b>${escapeHTML(nameOf(r.sid))}</b> \u00b7 ${escapeHTML(fmtISO(r.isoD))}<div class="muted small">${escapeHTML(line)}</div>${chips?`<div>${chips}</div>`:""}</span>${word?`<span class="tag ${r.dec&&r.dec.ok?"ok":"muted"}">${escapeHTML(word)}</span>`:""}${open?`<button class="btn sm" data-clkno="${r.sid}|${r.isoD}">Decline</button><button class="btn primary sm" data-clkok="${r.sid}|${r.isoD}">Approve</button>`:""}</div>`; };
  return `<div class="card" id="clockList"><h2>Hours to approve <span class="tag ${n?"warn":"muted"}">${n}</span></h2><div class="sub">Clocked hours outside the grace band. Approve writes them as the shift\u2019s own hours for pay; Decline keeps the rostered hours. Closed records stay a fortnight, for information.</div>${rows.map(row).join("")}</div>`; }
function clockApprove(sid,isoD){ const c=active(), p=clockProposal(c,sid,isoD,clockGrace(),clockNow()); if(p.status!=="proposed")return {ok:false,reason:"Nothing to approve."}; if(clockDecOf(c,sid,isoD))return {ok:false,reason:"Already decided."};
  if(!hoursSet(sid,isoD,p.start,p.end))return {ok:false};   // refused, and said, by the own-hours write itself
  if(!c.clockDec)c.clockDec={}; c.clockDec[sid+"|"+isoD]={ok:true,start:p.start,end:p.end,by:S.viewAs,ts:Date.now()};
  logAudit("clock.approve",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 "+p.start+"\u2013"+p.end+(p.flags.length?" \u00b7 "+p.flags.join(", "):""),"admin"); save(); return {ok:true}; }
function clockDecline(sid,isoD){ const c=active(), p=clockProposal(c,sid,isoD,clockGrace(),clockNow()); if(p.status!=="proposed")return {ok:false,reason:"Nothing to decline."}; if(clockDecOf(c,sid,isoD))return {ok:false,reason:"Already decided."};
  if(!c.clockDec)c.clockDec={}; c.clockDec[sid+"|"+isoD]={ok:false,by:S.viewAs,ts:Date.now()}; logAudit("clock.decline",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 rostered hours stand","admin");
  notify(sid,"Your admin kept the rostered hours on "+fmtISO(isoD)+".",null,{tab:"my",cycle:c.id}); save(); return {ok:true}; }
function clockMarkHTML(cyc,sid,isoD){ const r=clockRec(cyc,sid,isoD); if(!clockOn()||!r||!r.in)return ""; return `<span class="muted small"> \u00b7 in ${escapeHTML(r.in.t)}${r.out?" \u00b7 out "+escapeHTML(r.out.t):""}</span>`; }   // who has arrived, on the Day board and the day sheet
'''
rep('function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }',
    LIST+'function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }')

# Requests: the list at the top, the count in the sub-line, the wiring
rep('${cards}${cancelCard}${hist}`;', '${clockListHTML()}${cards}${cancelCard}${hist}`;')
rep('${pending.length+asks.length} pending${cancelReqs.length?', '${pending.length+asks.length} pending${clockCount(active(),clockNow())?(" \\u00b7 "+clockCount(active(),clockNow())+" hours to approve"):""}${cancelReqs.length?')
rep('''  if(S.tab==="requests"){
''', '''  if(S.tab==="requests"){
    document.querySelectorAll("[data-clkok]").forEach(b=>b.onclick=()=>{ const sid=b.dataset.clkok.split("|")[0], d=b.dataset.clkok.split("|")[1], r=clockApprove(sid,d); if(r.reason)toast(r.reason); render(); });
    document.querySelectorAll("[data-clkno]").forEach(b=>b.onclick=()=>{ const sid=b.dataset.clkno.split("|")[0], d=b.dataset.clkno.split("|")[1], r=clockDecline(sid,d); if(r.reason)toast(r.reason); render(); });
''')

# the marks: the Day board's rows and the day sheet's booked line
rep('''+tagChipsHTML(s):'<span class="muted">— vacant</span>'}''', '''+tagChipsHTML(s)+clockMarkHTML(active(),s.id,dailyDate):'<span class="muted">— vacant</span>'}''')
rep('''("starts "+escapeHTML(_w.start||""))); })()}</div>''', '''("starts "+escapeHTML(_w.start||""))); })()}${clockMarkHTML(cyc,sid,isoD)}</div>''')
P.write_text(s,encoding="utf-8"); print("c1-3-app: done")
```

- [ ] **Step 2: Add Task 3's tests above the block's marker**

```python
# file: c1-3-tests.py
import pathlib, sys
P=pathlib.Path("tests/suite.js"); s=P.read_text(encoding="utf-8")
TESTS=r'''      // ---- proposals, the list and the decisions (Task 3)
      T("clock: clockRows puts open proposals first, newest day first, then a fortnight of closed records, and forgets older closed ones", (function(){
        state(); put("s1",T0); put("s2",T0); put("s1",Y0); var old=D(-20); put("s1",old);
        tap("s2",T0,"in","09:30"); tap("s2",T0,"out","17:00"); tap("s1",T0,"in","09:58"); tap("s1",T0,"out","17:02"); tap("s1",Y0,"in","09:40"); tap("s1",Y0,"out","17:00"); tap("s1",old,"in","09:58"); tap("s1",old,"out","17:02");   // the old record is as rostered: a closed record older than a fortnight drops off; an open proposal never does
        var rows=clockRows(c,at(T0,"18:00")); var keys=rows.map(function(r){ return r.sid+"|"+r.isoD+"|"+r.p.status; });
        return keys.join(",")==="s2|"+T0+"|proposed,s1|"+Y0+"|proposed,s1|"+T0+"|rostered" && clockCount(c,at(T0,"18:00"))===2; })());
      T("clock: Approve writes the proposal as the shift's own hours through hoursSet, records the decision, audits it, and tells the person", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40",{dist:20,acc:5,inside:true,via:"gps"}); tap("s1",T0,"out","17:25",{dist:20,acc:5,inside:true,via:"gps"}); _clockNow=at(T0,"18:00").getTime();
        var r=clockApprove("s1",T0); var sh=c.assign["s1|"+T0], dec=clockDecOf(c,"s1",T0), a=last("clock.approve"), h=last("hours.set"), n=told("s1");
        return r.ok===true && !!sh.hours && sh.hours.start==="09:40" && sh.hours.end==="17:25" && !!dec && dec.ok===true && dec.start==="09:40" && dec.by==="admin" && !!a && /Ava Ng/.test(a.detail) && /09:40\u201317:25/.test(a.detail) && /early 20 min, late 25 min/.test(a.detail) && !!h && !!n && /09:40\u201317:25/.test(n.text) && clockApprove("s1",T0).ok===false && clockCount(c,clockNow())===0; })());
      T("clock: Decline keeps the rostered hours, records the decision, audits it, tells the person, and the list shows the word", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40"); tap("s1",T0,"out","17:00"); _clockNow=at(T0,"18:00").getTime();
        var r=clockDecline("s1",T0); var sh=c.assign["s1|"+T0], dec=clockDecOf(c,"s1",T0), a=last("clock.decline"), n=told("s1"); var h=clockListHTML();
        return r.ok===true && !sh.hours && !!dec && dec.ok===false && !!a && /rostered hours stand/.test(a.detail) && !!n && /kept the rostered hours/.test(n.text) && clockDecline("s1",T0).ok===false && clockApprove("s1",T0).ok===false && h.indexOf("declined \u00b7 as rostered")>=0 && h.indexOf("data-clkok")<0; })());
      T("clock: nothing to approve is refused: as rostered, still open, or no shift", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:58"); tap("s1",T0,"out","17:02"); _clockNow=at(T0,"18:00").getTime(); var a=clockApprove("s1",T0);
        put("s2",T0); tap("s2",T0,"in","09:40"); var b=clockApprove("s2",T0); return a.ok===false && /Nothing to approve/.test(a.reason) && b.ok===false && !c.clockDec; })());
      T("clock: the Hours to approve card names the person, the day, rostered against clocked, the proposal, the flags as chips, and the two buttons; closed rows are greyed with their word", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40",{dist:420,acc:10,inside:false,via:"gps"}); tap("s1",T0,"out","17:25"); put("s2",T0); tap("s2",T0,"in","09:58"); tap("s2",T0,"out","17:02"); _clockNow=at(T0,"18:00").getTime();
        var h=clockListHTML(); S.tab="requests"; var page=viewRequests();
        return h.indexOf('id="clockList"')>=0 && h.indexOf("Ava Ng")>=0 && h.indexOf("rostered 10:00\u201317:00 \u00b7 clocked 09:40\u201317:25 \u00b7 proposes 09:40\u201317:25")>=0 && h.indexOf("outside the radius (420 m)")>=0 && h.indexOf('data-clkok="s1|'+T0+'"')>=0 && h.indexOf('data-clkno="s1|'+T0+'"')>=0 && h.indexOf("Sam Lee")>=0 && h.indexOf("as rostered")>=0 && h.indexOf('data-clkok="s2|'+T0+'"')<0 && page.indexOf('id="clockList"')>=0 && page.indexOf("1 hours to approve")>=0 && page.indexOf('id="clockList"')<page.indexOf("No pending requests"); })());
      T("clock: the list is nothing for staff, for a group with the switch off, and when no record exists", (function(){ state({viewAs:"admin"}); put("s1",T0); var a=clockListHTML()===""; tap("s1",T0,"in","09:40"); S.viewAs="s1"; var b=clockListHTML()===""; state({on:false,viewAs:"admin"}); return a && b && clockListHTML()===""; })());
      T("clock: the Day board and the day sheet show in and out beside a name once the taps are in, and nothing before", (function(){
        state({viewAs:"admin"}); put("s1",T0); dailyDate=T0; dailyScope="group"; S.tab="daily"; var h0=viewDaily(); tap("s1",T0,"in","09:52"); var h1=viewDaily(); tap("s1",T0,"out","17:20"); var h2=viewDaily();
        _srSid="s1"; S.tab="roster"; var sheet=daySheetHTML(T0); _srSid=null;
        return h0.indexOf("in 09:52")<0 && h1.indexOf("Ava Ng")>=0 && h1.indexOf(" \u00b7 in 09:52")>=0 && h1.indexOf("out 17:20")<0 && h2.indexOf(" \u00b7 in 09:52 \u00b7 out 17:20")>=0 && sheet.indexOf(" \u00b7 in 09:52 \u00b7 out 17:20")>=0 && clockMarkHTML(c,"s2",T0)===""; })());
'''
MARK='      // ---- clock: later tasks add their tests above this line\n'
n=s.count(MARK)
if n!=1: sys.exit("c1-3-tests: the block marker was not found once (%d)" % n)
s=s.replace(MARK, TESTS+MARK); P.write_text(s,encoding="utf-8"); print("c1-3-tests: done")
```

- [ ] **Step 3: Sync, build the demo, run the suite**

Run: `python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py | tail -3` — Expected: `0 failed`.

- [ ] **Step 4: Commit**

```bash
git add app.html deploy/app.html deploy/demo.html preview.html tests/suite.js
git commit -m "Clock (C1) 3/4: Hours to approve on Requests — Approve writes the proposal as own hours through hoursSet, Decline keeps the rostered hours, both audited; in and out marks on the Day board and the day sheet"
```

### Task 4: The poster with its QR code, the Clock report, and the release

**Files:**
- Modify: `app.html` (the C1 section, `viewSetup`, `exportMenuHTML`/`openExportMenu`, the setup wiring block, the CSS, `BUILD`, `WHATS_NEW`), `CHANGELOG.md`, the spec (one wording)
- Test: `tests/suite.js` (inside the C1 block, above its marker)
- Proof: `c1-4-qrcheck.py` (the encoder against a reference library), `c1-mutate-strict.py` (26 mutants)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `qrMatrix(text)→{size,rows}` (byte mode, error level M, mask 0, versions 1–6), `clockQRSVG(text)`, `clockPosterHTML()` (a `#posterCard`, hidden on screen, printed alone under `body.print-poster`), `exportClockCSV()`, the export row `expClock`, the release entry "Clock in and clock out".

- [ ] **Step 1: Apply the app edits**

```python
# file: c1-4-app.py
import pathlib, sys, datetime
P=pathlib.Path("app.html"); s=P.read_text(encoding="utf-8")
def rep(old,new):
    global s
    n=s.count(old)
    if n!=1: sys.exit("c1-4-app: expected one occurrence, found %d:\n%s" % (n, old[:160]))
    s=s.replace(old,new)

POSTER=r'''function qrMatrix(text){   // a QR code, byte mode, error level M, mask 0, versions 1 to 6 (up to 106 characters): enough for the poster's link. Checked bit for bit against a reference encoder in the plan's dry run
  const bytes=[]; for(const ch of unescape(encodeURIComponent(String(text))))bytes.push(ch.charCodeAt(0));
  const EC=[10,16,26,18,24,16], BLOCKS=[1,1,1,2,2,4], TOTAL=[26,44,70,100,134,172];
  let ver=-1; for(let v=0;v<6;v++){ if(bytes.length<=TOTAL[v]-EC[v]*BLOCKS[v]-2){ ver=v; break; } } if(ver<0)throw new Error("too long for the poster code");
  const size=21+4*ver, dataCw=TOTAL[ver]-EC[ver]*BLOCKS[ver], bits=[], put=(val,n)=>{ for(let i=n-1;i>=0;i--)bits.push((val>>i)&1); };
  put(4,4); put(bytes.length,8); bytes.forEach(b=>put(b,8)); put(0,Math.min(4,dataCw*8-bits.length)); while(bits.length%8)bits.push(0);
  for(let pad=0xEC;bits.length<dataCw*8;pad^=(0xEC^0x11))put(pad,8);
  const data=[]; for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(""),2));
  const EXP=new Array(512), LOG=new Array(256); for(let i=0,x=1;i<255;i++){ EXP[i]=x; LOG[x]=i; x=(x<<1)^((x&0x80)?0x11D:0); } for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
  const mul=(a,b)=>(a&&b)?EXP[LOG[a]+LOG[b]]:0, ecLen=EC[ver]; let gen=[1]; for(let i=0;i<ecLen;i++){ const next=new Array(gen.length+1).fill(0); for(let j=0;j<gen.length;j++){ next[j]^=gen[j]; next[j+1]^=mul(gen[j],EXP[i]); } gen=next; }
  const rs=block=>{ const res=block.concat(new Array(ecLen).fill(0)); for(let i=0;i<block.length;i++){ const f=res[i]; if(!f)continue; for(let j=0;j<gen.length;j++)res[i+j]^=mul(gen[j],f); } return res.slice(block.length); };
  const nb=BLOCKS[ver], per=dataCw/nb, blocks=[], ecs=[]; for(let b=0;b<nb;b++){ const blk=data.slice(b*per,(b+1)*per); blocks.push(blk); ecs.push(rs(blk)); }
  const cw=[]; for(let i=0;i<per;i++)for(let b=0;b<nb;b++)cw.push(blocks[b][i]); for(let i=0;i<ecLen;i++)for(let b=0;b<nb;b++)cw.push(ecs[b][i]);
  const M=[], F=[]; for(let y=0;y<size;y++){ M.push(new Array(size).fill(0)); F.push(new Array(size).fill(false)); }
  const set=(x,y,v)=>{ M[y][x]=v?1:0; F[y][x]=true; };
  const finder=(cx,cy)=>{ for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){ const x=cx+dx, y=cy+dy; if(x<0||y<0||x>=size||y>=size)continue; const d=Math.max(Math.abs(dx),Math.abs(dy)); set(x,y,d!==2&&d!==4); } };
  finder(3,3); finder(size-4,3); finder(3,size-4);
  for(let i=8;i<size-8;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
  if(ver>0){ const c=size-7; for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(c+dx,c+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1); }
  const fb=0x5412, bit=i=>(fb>>i)&1;   // the format word for error level M with mask 0
  for(let i=0;i<=5;i++)set(8,i,bit(i)); set(8,7,bit(6)); set(8,8,bit(7)); set(7,8,bit(8)); for(let i=9;i<15;i++)set(14-i,8,bit(i));
  for(let i=0;i<8;i++)set(size-1-i,8,bit(i)); for(let i=8;i<15;i++)set(8,size-15+i,bit(i)); set(8,size-8,true);
  let k=0; for(let right=size-1;right>=1;right-=2){ if(right===6)right=5; for(let vert=0;vert<size;vert++){ for(let j=0;j<2;j++){ const x=right-j, up=((right+1)&2)===0, y=up?size-1-vert:vert; if(F[y][x])continue; let v=0; if(k<cw.length*8)v=(cw[k>>3]>>(7-(k&7)))&1; k++; if(((x+y)&1)===0)v^=1; M[y][x]=v; } } }
  return {size:size,rows:M}; }
function clockQRSVG(text){ const q=qrMatrix(text), s=q.size, quiet=4; let d=""; for(let y=0;y<s;y++)for(let x=0;x<s;x++)if(q.rows[y][x])d+="M"+(x+quiet)+" "+(y+quiet)+"h1v1h-1z";
  return `<svg viewBox="0 0 ${s+2*quiet} ${s+2*quiet}" role="img" aria-label="QR code for the clock link" shape-rendering="crispEdges"><path d="${d}" fill="currentColor"/></svg>`; }
function clockPosterHTML(){ const s=clockSite(); if(!s||!s.posterKey)return ""; const url=clockPosterURL();   // rendered with the Group half of Settings, hidden on screen; Print the clock poster prints it alone
  return `<div class="card" id="posterCard"><div class="poster"><div class="pbrand">${escapeHTML(hospitalGroupLabel())}</div><h1>Scan to clock in or out</h1><div class="pqr">${clockQRSVG(url)}</div><div class="purl">${escapeHTML(url)}</div><div class="pfoot">Open the camera, point it at the code, tap the link. Sign in if asked. \u00b7 Poster made ${escapeHTML(fmt(new Date(s.posterAt||0),{day:"numeric",month:"short",year:"numeric"}))} \u00b7 Myrosta</div></div></div>`; }
function exportClockCSV(){ const c=active(), now=clockNow(), g=clockGrace(), proof=t=>t?(t.via==="poster"?"poster":(t.inside==null?"no location":(t.inside?"inside":"outside"))):"";
  const rows=[["Person","Day","Rostered start","Rostered finish","Clock in","In distance (m)","In proof","Clock out","Out distance (m)","Out proof","Proposed start","Proposed finish","Flags","Decision","Decided by","Decided at"]];
  Object.keys(c.clock||{}).sort((a,b)=>{ const da=a.split("|")[1], db=b.split("|")[1]; return da<db?-1:da>db?1:nameOf(a.split("|")[0]).localeCompare(nameOf(b.split("|")[0])); }).forEach(k=>{ const sid=k.split("|")[0], d=k.split("|")[1], r=c.clock[k], p=clockProposal(c,sid,d,g,now), dec=clockDecOf(c,sid,d), ro=p.rostered||{};
    rows.push([nameOf(sid),d,ro.start||"",ro.end||"",r.in?r.in.t:"",(r.in&&r.in.dist!=null)?r.in.dist:"",proof(r.in),r.out?r.out.t:"",(r.out&&r.out.dist!=null)?r.out.dist:"",proof(r.out),p.status==="proposed"?p.start:"",p.status==="proposed"?p.end:"",p.flags.join("; "),dec?(dec.ok?"approved":"declined"):(p.status==="proposed"?"waiting":p.status),dec?nameOf(dec.by):"",dec?new Date(dec.ts).toISOString():""]); });
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n")+"\n"; download(csv,"clock-"+c.cycle.start+".csv","text/csv"); logAudit("export.clock",cyLabel(c),"admin"); save(); }
'''
rep('function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }',
    POSTER+'function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }')

# the poster travels with the Group half; the export menu lists the report when the clock is on; the print button
rep('capacityCardHTML(),dangerCardHTML()].join("")', 'capacityCardHTML(),dangerCardHTML(),clockPosterHTML()].join("")')
rep('''    .concat([["expEftM","EFT tracker","EFT for everyone in this cycle, one column per week, in the tracker's layout."]]);''', '''    .concat([["expEftM","EFT tracker","EFT for everyone in this cycle, one column per week, in the tracker's layout."]])
    .concat(clockOn()?[["expClock","Clock report","One row per clocked shift: rostered, clocked, flags and the decision."]]:[]);''')
rep('bind("expEftM",exportEftTracker);', 'bind("expEftM",exportEftTracker); bind("expClock",exportClockCSV);')
rep('''    const pn_=document.getElementById("posterNew"); if(pn_)pn_.onclick=()=>{''', '''    const pp_=document.getElementById("posterPrint"); if(pp_)pp_.onclick=()=>{ document.body.classList.add("print-poster"); window.print(); setTimeout(()=>document.body.classList.remove("print-poster"),1200); };
    const pn_=document.getElementById("posterNew"); if(pn_)pn_.onclick=()=>{''')

# the CSS: the poster is hidden on screen, printed alone
rep('  .printhead,.printfoot{display:none}', '  .printhead,.printfoot{display:none} #posterCard{display:none} .poster{text-align:center;padding:24px 12px} .poster h1{font-size:var(--fs-2xl);margin:12px 0} .poster .pbrand{font-size:var(--fs-lg);font-weight:700;color:var(--navy)} .poster .pqr svg{width:72vw;max-width:520px;height:auto} .poster .purl{font-size:var(--fs-sm);color:var(--muted);word-break:break-all;margin-top:10px} .poster .pfoot{font-size:var(--fs-sm);color:var(--muted);margin-top:14px}')
rep('    body.print-cap #app>*:not(#capCard){display:none !important}', '    body.print-poster #app>*:not(#posterCard){display:none !important} body.print-poster #posterCard{display:block !important} body.print-cap #app>*:not(#capCard){display:none !important}')

# the release: BUILD, the What's new entry, the changelog heading — dated the day this lands
today=datetime.date.today(); iso=today.isoformat(); head=today.strftime("%-d %b %Y")
import re
m=re.search(r'const BUILD="(\d{4}-\d{2}-\d{2})"', s); s=s.replace(m.group(0), 'const BUILD="%s"' % iso)
rep('const WHATS_NEW=[', 'const WHATS_NEW=[{on:"%s",title:"Clock in and clock out",lines:["Staff tap Clock in and Clock out on their own shift, on My shifts or the day sheet; a tap outside the grace band proposes the real hours.","Admins approve them under Requests, and approved hours become the shift\'s own hours for pay.","Settings, This staff group, Clock: the switch, the grace band, the site and a poster to scan."]},' % iso)
P.write_text(s,encoding="utf-8")
C=pathlib.Path("CHANGELOG.md"); t=C.read_text(encoding="utf-8")
entry='''## %s — Clock in and clock out

- **Two taps on a shift.** With Settings → This staff group → Clock switched on, staff see Clock in from 60 minutes before the rostered start and Clock out until the day ends (01:00 the next day for a shift to midnight), on My shifts and on the day sheet. A tap asks the phone where it is and stores the time in 5-minute steps, the distance from the site, the phone's accuracy, inside or outside the radius (the accuracy is subtracted first) and how presence was proved; a phone that refuses still taps, marked no location. Records live in `cyc.clock`, one per person and day, written only by that person's device; a record's status is computed by `clockProposal`, never stored.
- **The grace band and the proposal.** A tap within the band (default 7 minutes, admin-set) counts as the rostered time; both ends inside means as rostered and nothing to approve. Otherwise the record proposes the rounded taps, with plain flags (early 20 min, late 25 min, outside the radius, no location, by poster, capped at midnight, taps out of order). No clock-out by the end of the day closes the record as such; the person cannot add the tap afterwards.
- **Hours to approve** on the Requests tab: Approve writes the proposal through the own-hours function (`hours.set`, the person told), then a `clock.approve` line and the decision in `cyc.clockDec`; Decline keeps the rostered hours (`clock.decline`, the person told). Closed records stay a fortnight for information. The Day board and the day sheet say in 09:52 · out 17:20 beside a name.
- **The Site and the poster.** The Clock card holds the point (Use my location here, or typed), the radius (default 150 m) and a poster key; the audit line says the radius and the accuracy, never the point. Print the clock poster prints a QR code (drawn by an inline encoder, byte mode, error level M, mask 0, versions 1–6; no outside service) whose link `app.html?org=…&clock=…` taps in or out with presence by poster once the sign-in has resolved its group; New poster renews the key and older posters stop working. Roster → Export gains a Clock report CSV.
- **Nothing changes with the switch off:** no keys written, `normalize()` seeds nothing, the exports byte for byte as before. Taps and decisions merge key by key like call-ins.

''' % head
assert t.startswith("# Myrosta — changelog\n\n"), "CHANGELOG head"
C.write_text(t.replace("# Myrosta — changelog\n\n", "# Myrosta — changelog\n\n"+entry, 1), encoding="utf-8")
SP_=pathlib.Path("docs/superpowers/specs/2026-09-29-clock-in-out-design.md"); sp=SP_.read_text(encoding="utf-8")
old='calls `hoursSet(sid, isoD, start, end)` (audit `hours.set` with the detail ending "· from clock"), writes `clockDec`'
if sp.count(old)==1: SP_.write_text(sp.replace(old,'calls `hoursSet(sid, isoD, start, end)` (its usual `hours.set` audit line and notification), writes `clockDec` and a `clock.approve` line that names the hours and the flags'),encoding="utf-8")
print("c1-4-app: done, release dated", iso)
```

- [ ] **Step 2: Add Task 4's tests above the block's marker**

```python
# file: c1-4-tests.py
import pathlib, sys
P=pathlib.Path("tests/suite.js"); s=P.read_text(encoding="utf-8")
TESTS=r'''      // ---- the poster, the QR code, the report and the release (Task 4)
      function fnv(str){ var h=2166136261>>>0; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return ("0000000"+h.toString(16)).slice(-8); }
      function qrSig(text){ var q=qrMatrix(text), flat=q.rows.map(function(r){ return r.join(""); }).join(""); return q.size+"/"+(flat.split("1").length-1)+"/"+fnv(flat); }
      T("clock: the QR encoder matches the reference encoder bit for bit (byte mode, level M, mask 0) at versions 1, 2, 4 and 5", qrSig("x")==="21/206/3a2d9a2f" && qrSig("MYROSTA-CLOCK-TEST-1234567")==="25/320/66c97e49" && qrSig("https://test/app.html?org=ed-default&clock=ABCDEFGHJKLMNPQR")==="33/528/182371d5" && qrSig("https://myrosta.com.au/app.html?org=swift-nurses&clock=ABCDEFGHJKLMNPQR")==="37/706/4a9c02cb");
      T("clock: the QR refuses a text too long for version 6, and the SVG draws every dark module inside a quiet zone", (function(){ var long=new Array(108).join("a"); var refused=false; try{ qrMatrix(long); }catch(e){ refused=true; }
        var svg=clockQRSVG("x"); return refused && svg.indexOf('viewBox="0 0 29 29"')>=0 && (svg.split("h1v1h-1z").length-1)===206 && svg.indexOf('fill="currentColor"')>=0; })());
      T("clock: the poster carries the hospital and group, the QR of the poster link, the link in words, and when it was made; it is on the Group half of Settings, hidden on screen", (function(){
        state(); S.branding={name:"Nurses",hospital:"SWIFT"}; var h=clockPosterHTML(); var url=clockPosterURL();
        S.viewAs="admin"; _setupTab="group"; var page=viewSetup(); _setupTab="cycle"; var other=viewSetup(); state({on:false}); var none=clockPosterHTML();
        return h.indexOf('id="posterCard"')>=0 && h.indexOf("SWIFT \u00b7 Nurses")>=0 && h.indexOf("Scan to clock in or out")>=0 && h.indexOf('viewBox="0 0 41 41"')>=0 && h.indexOf(escapeHTML(url))>=0 && h.indexOf("Poster made")>=0 && page.indexOf('id="posterCard"')>=0 && other.indexOf('id="posterCard"')<0 && none===""; })());
      T("clock: the Clock report has one row per clocked shift with the rostered window, both taps, their proof, the proposal, the flags and the decision, and audits the export", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40",{dist:420,acc:10,inside:false,via:"gps"}); tap("s1",T0,"out","17:25",{via:"poster"}); put("s2",Y0); tap("s2",Y0,"in","09:58"); tap("s2",Y0,"out","17:02"); _clockNow=at(T0,"18:00").getTime();
        clockDecline("s1",T0); var got=null; download=function(text,name){ got={text:text,name:name}; }; exportClockCSV(); var lines=got.text.split("\n");
        return got.name==="clock-"+c.cycle.start+".csv" && lines[0]==='"Person","Day","Rostered start","Rostered finish","Clock in","In distance (m)","In proof","Clock out","Out distance (m)","Out proof","Proposed start","Proposed finish","Flags","Decision","Decided by","Decided at"' && lines[1].indexOf('"Sam Lee","'+Y0+'","10:00","17:00","09:58","","no location","17:02","","no location","","","no location","rostered","",""')===0 && lines[2].indexOf('"Ava Ng","'+T0+'","10:00","17:00","09:40","420","outside","17:25","","poster","09:40","17:25","early 20 min; late 25 min; outside the radius (420 m); by poster","declined","Admin"')===0 && !!last("export.clock"); })());
      T("clock: the export menu lists the Clock report only when the clock is on", (function(){ state({viewAs:"admin"}); var a=exportMenuHTML().indexOf('id="expClock"')>=0; state({on:false,viewAs:"admin"}); return a && exportMenuHTML().indexOf('id="expClock"')<0; })());
      T("clock: What's new names the clock on the release day, in three site-neutral lines, and BUILD is that day", (function(){ var e=WHATS_NEW.filter(function(x){ return x.title==="Clock in and clock out"; })[0]; return !!e && e.lines.length===3 && /Requests/.test(e.lines[1]) && e.lines[1].indexOf("\u201c")<0 && BUILD===e.on && /^\d{4}-\d{2}-\d{2}$/.test(e.on); })());
'''
MARK='      // ---- clock: later tasks add their tests above this line\n'
n=s.count(MARK)
if n!=1: sys.exit("c1-4-tests: the block marker was not found once (%d)" % n)
s=s.replace(MARK, TESTS+MARK); P.write_text(s,encoding="utf-8"); print("c1-4-tests: done")
```

- [ ] **Step 3: Sync, build the demo, run the suite**

Run: `python3 $SP/sync.py && python3 tools/build-demo.py && python3 tests/run.py | tail -3` — Expected: `0 failed`.

- [ ] **Step 4: Prove the encoder against a reference library**

Install once into a scratch prefix (never into the repo): `python3 -m pip install --quiet --target $SP/pyqr qrcode`, then run `PYTHONPATH=$SP/pyqr python3 $SP/s3dry/edits/c1-4-qrcheck.py` — Expected: `qr ok: 40/40 match`.

```python
# file: c1-4-qrcheck.py
import re, pathlib, subprocess, json, random, string, sys, tempfile, os
import qrcode, qrcode.util as U
html=pathlib.Path("app.html").read_text(encoding="utf-8"); app=max(re.findall(r"<script>(.*?)</script>", html, re.S), key=len); stubs=pathlib.Path("tests/stubs.js").read_text(encoding="utf-8")
random.seed(29); texts=["x","MYROSTA-CLOCK-TEST-1234567","https://myrosta.com.au/app.html?org=swift-clerical-admins&clock=ABCDEFGHJKLMNPQR"]
while len(texts)<40: texts.append("".join(random.choice(string.ascii_letters+string.digits+"-_?=&/:.") for _ in range(random.randint(1,100))))
probe=";(function(){ var T=%s; return JSON.stringify(T.map(function(t){ var q=qrMatrix(t); return q.rows.map(function(r){ return r.join(''); }).join('|'); })); })();" % json.dumps(texts)
fd,path=tempfile.mkstemp(suffix=".js"); os.write(fd,(stubs+app+"\n"+probe).encode("utf-8")); os.close(fd)
out=subprocess.run(["osascript","-l","JavaScript",path],capture_output=True,text=True,timeout=300); os.unlink(path)
js=json.loads(out.stdout.strip())
ok=0
for t,m in zip(texts,js):
    q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, mask_pattern=0, border=0); q.add_data(U.QRData(t.encode("utf-8"), mode=U.MODE_8BIT_BYTE)); q.make(fit=True)
    ref="|".join("".join("1" if v else "0" for v in row) for row in q.get_matrix())
    if ref==m: ok+=1
    else: print("MISMATCH", repr(t), "version", q.version)
print("qr ok: %d/%d match" % (ok,len(texts))); sys.exit(0 if ok==len(texts) else 1)
```

- [ ] **Step 5: The mutation proof**

Run: `python3 $SP/s3dry/edits/c1-mutate-strict.py` — Expected: `26/26 killed by named clock tests`, exit 0. Every mutant must be killed by a `clock:` test; the deploy copies are synced and the demo rebuilt for each mutant, so the deploy and demo lints never mask a survivor.

```python
# file: c1-mutate-strict.py
import pathlib, subprocess, sys, re
ROOT=pathlib.Path(".").resolve(); APP=ROOT/"app.html"; good=APP.read_text(encoding="utf-8")
def sync():
    a=APP.read_text(encoding="utf-8"); (ROOT/"deploy"/"app.html").write_text(a,encoding="utf-8")
    m=re.search(r'const CLOUD=\{ url:"[^"]*", key:"[^"]*",',a); (ROOT/"preview.html").write_text(a.replace(m.group(0),'const CLOUD={ url:"", key:"",',1),encoding="utf-8")
    subprocess.run([sys.executable,"tools/build-demo.py"],check=True,capture_output=True)
def suite():
    r=subprocess.run([sys.executable,"tests/run.py"],capture_output=True,text=True,timeout=900); return [l.strip() for l in (r.stdout+r.stderr).splitlines() if l.startswith("FAIL")]
M=[
 ("round: no rounding", "return m==null?null:clockHHMM(Math.round(m/5)*5); }", "return m==null?null:clockHHMM(m); }"),
 ("inside: accuracy ignored", "return (dist-(acc||0))<=radius; }", "return dist<=radius; }"),
 ("may: no early margin", "from.setHours(0,s-CLOCK_EARLY,0,0);", "from.setHours(0,s,0,0);"),
 ("may: out accepted a day late", "t<=clockOutUntil(isoD,w)}; }", "t<=clockOutUntil(isoD,w)+864e5}; }"),
 ("may: a second in tap allowed", "return {in:!rec.in&&t>=from.getTime()", "return {in:t>=from.getTime()"),
 ("proposal: grace ignored on the start", "let start=(Math.abs(inM-sM)<=grace)?w.start:rec.in.t", "let start=rec.in.t"),
 ("proposal: never as rostered", 'if(start===w.start&&end===w.end)return done("rostered",tm);', 'if(false)return done("rostered",tm);'),
 ("proposal: midnight out tap not carried over", "if(iso(new Date(rec.out.ts))>isoD)outM+=1440;", "if(false)outM+=1440;"),
 ("proposal: cap not said", 'if(endM>1440){ endM=1440; tm.push("capped at midnight"); }', 'if(endM>1440){ endM=1440; }'),
 ("proposal: no-location flag dropped", 'else if(tap.inside==null)loc.push("no location");', 'else if(false)loc.push("no location");'),
 ("proposal: outside flag dropped", 'else if(tap.inside===false)loc.push("outside the radius ("+tap.dist+" m)");', 'else if(false)loc.push("outside the radius ("+tap.dist+" m)");'),
 ("switch: on without a site", 'if(on&&!clockSite())return {ok:false,reason:"Save the site first', 'if(false)return {ok:false,reason:"Save the site first'),
 ("site: any radius", 'if(!(radius>=20&&radius<=2000))return {ok:false,reason:"The radius is 20 to 2000 metres."};', 'if(false)return {ok:false,reason:"The radius is 20 to 2000 metres."};'),
 ("token: any token accepted", 'return !!(s&&s.posterKey)&&String(token||"")===s.posterKey; }', 'return !!(s&&s.posterKey); }'),
 ("merge: clock maps not merged key by key", '["clock","clockDec"].forEach(f=>{ if(!((f in oc)||(f in tc)||(bc&&(f in bc))))return;', '["clock","clockDec"].forEach(f=>{ return;'),
 ("tap: admins may tap", 'if(isAdmin())return {ok:false,reason:"Admins set hours from the roster cell."};', 'if(false)return {ok:false,reason:"Admins set hours from the roster cell."};'),
 ("tap: the tap time is when the phone answered", "const r=clockWrite(cyc,sid,isoD,kind,now,f); if(r.ok)toast(", "const r=clockWrite(cyc,sid,isoD,kind,new Date(),f); if(r.ok)toast("),
 ("poster: a stale key accepted", 'if(!clockTokenOK(p.token)){ toast(', 'if(false){ toast('),
 ("poster: another group's poster applied here", 'if(p.org&&p.org!==_org){ toast(', 'if(false){ toast('),
 ("approve: hours never written", "if(!hoursSet(sid,isoD,p.start,p.end))return {ok:false};", "if(false)return {ok:false};"),
 ("decline: the person not told", 'notify(sid,"Your admin kept the rostered hours on "+fmtISO(isoD)+".",null,{tab:"my",cycle:c.id});', ''),
 ("rows: closed records kept forever", "keepFrom=iso(addDays(now,-CLOCK_KEEP))", "keepFrom=iso(addDays(now,-CLOCK_KEEP*100))"),
 ("marks: never shown", 'const r=clockRec(cyc,sid,isoD); if(!clockOn()||!r||!r.in)return ""; return `<span class="muted small"> \\u00b7 in', 'const r=clockRec(cyc,sid,isoD); if(true)return ""; return `<span class="muted small"> \\u00b7 in'),
 ("report: a header column dropped", '"Person","Day","Rostered start","Rostered finish"', '"Person","Day","Rostered finish"'),
 ("qr: mask not applied", "if(((x+y)&1)===0)v^=1;", "if(false)v^=1;"),
 ("qr: wrong error-correction length at version 5", "const EC=[10,16,26,18,24,16]", "const EC=[10,16,26,18,22,16]"),
]
killed=0; bad=[]
try:
    for name,old,new in M:
        if good.count(old)!=1: print("ANCHOR   | %s | found %d times" % (name, good.count(old))); bad.append(name); continue
        APP.write_text(good.replace(old,new),encoding="utf-8"); sync(); fails=suite(); named=[f for f in fails if "clock:" in f]
        print(("KILLED  " if named else "SURVIVED")+" | "+name+" | "+"; ".join(f[6:96] for f in fails[:3]))
        if named: killed+=1
        else: bad.append(name)
finally:
    APP.write_text(good,encoding="utf-8"); sync()
print("%d/%d killed by named clock tests" % (killed,len(M))); sys.exit(1 if bad else 0)
```

- [ ] **Step 6: Commit**

```bash
git add app.html deploy/app.html deploy/demo.html preview.html tests/suite.js CHANGELOG.md docs/superpowers/specs/2026-09-29-clock-in-out-design.md
git commit -m "Clock (C1) 4/4: the clock poster with its own QR encoder, the Clock report export, and the release — BUILD, What's new and the changelog"
```

---

### Task 5: The SWIFT guides and the runbook (outside the repo)

**Files (personal-data folder, never in the repo):**
- Modify: `~/Desktop/Myrosta site 2/go-live/source/guides/swift-staff.html` and `swift-managers.html`; reprint both PDFs with `$SP/s6g/print.sh` (fresh Chrome profile, kill after the file appears) into `~/Desktop/Myrosta site 2/go-live/`, the previous PDFs copied to `previous-<date>/` first; check page counts and page starts with `pypdf`, and render changed pages with `pypdf` + `sips` to look at them.
- Modify: `~/Desktop/Myrosta site 2/groups/swift-launch-runbook.md`.

**Interfaces:** none — words only. Synthetic names only; real staff names never appear.

- [ ] **Step 1: The staff guide gains a section "Clock in and out"** after "Your own hours", in the guide's own voice, with these facts and no others: the two buttons on My shifts and the day sheet; Clock in from an hour before the start, Clock out until the day ends; the phone asks once for location and the tap goes through either way; the poster at reception for a phone without location; inside the grace band the rostered hours stand and nothing more happens; outside it, "waiting for your manager", then approved hours or as rostered; a forgotten clock-out closes the record and the manager sees it, the person cannot add it later; the one privacy line, quoted exactly: "Myrosta keeps only the time of your tap and how far you were from the clinic."
- [ ] **Step 2: The managers' guide gains a section "The clock"** after "Own hours", with a card for the Clock card (switch, grace, site set standing at the clinic with Use my location here, radius, Print the clock poster, New poster), a card for Hours to approve (what a row shows, Approve writes own hours, Decline keeps rostered, closed rows a fortnight), a line for the in/out marks on the Day board, a line for the Clock report export, and a table of the flags in plain words. The go-live checklist gains one tick: "Clock (if the group uses it): save the Site standing at the clinic, print the poster, switch Clock in/out on."
- [ ] **Step 3: The runbook** gains, under the week of 5 October, a manager step: set the Site at the clinic, print the poster for reception, decide the grace band; and under launch day, "switch Clock in/out on when you want taps to start; nothing is paid on a tap alone."
- [ ] **Step 4: Reprint, check page starts and counts, install the PDFs, and report** which pages changed.

---

## Self-review against the spec

| Spec section | Where |
|---|---|
| Decisions 1–7 | Task 1 rules (grace, proposal), Task 2 taps (soft geofence, poster), Task 3 approvals, Task 4 poster; per-group site and switch in Task 1 |
| Data (`clockOn`, `clockGrace`, `site`, `clock`, `clockDec`, TAP, retention) | Task 1 core; retention `CLOCK_KEEP` in Task 3 `clockRows` |
| Rules (round, may, dist, inside, proposal, token, poster URL) | Task 1 `clock*` functions and tests |
| Taps, the poster link, receipts | Task 2 |
| Proposals and decisions, Settings card | Task 3, Task 1 |
| What people see (My shifts, banner, day sheet, list, board marks, report, poster) | Tasks 2–4 |
| Sync and merge | Task 1 merge edit and test |
| Compatibility (switch off, prepared cycles, digest untouched, reminders unchanged) | Task 1 test "writes none of the new keys"; the digest and reminders are not touched by any task |
| Testing (pure rules, harness, lints, mutation) | every task's tests; Task 4 Steps 4–5 |
| Out of scope | untouched |

Placeholder scan: none. Type consistency: `clockProposal` returns `{status, flags, rostered, start?, end?}` everywhere; `TAP.via` is `"gps"|"poster"|"none"` in Tasks 1–4; buttons `data-clockin/out` in Task 2 and both wiring blocks; decisions `{ok,start,end,by,ts}` in Tasks 3–4. One departure from the spec, recorded and amended in Task 4 Step 1: Approve keeps `hours.set`'s own audit line and adds a `clock.approve` line naming the hours and flags, rather than a "· from clock" suffix.

## Dry run before execution

From a scratch copy of the working tree: `python3 $SP/s3plan.py PLAN $SP/c1dry/edits`, then in the copy run `c1-1-app.py`, `c1-1-tests.py`, sync + demo + suite; `c1-2-*`, `c1-3-*`, `c1-4-*` likewise; then the QR cross-check and the mutation script. Every step must pass before Task 1 is dispatched.

## Dry run (29 Sep 2026, before execution)

From a scratch copy of the working tree, the plan's own scripts applied in order: Task 1 → 1037 passes, Task 2 → 1047, Task 3 → 1054, Task 4 → 1060, `0 failed` at every step with the deploy copies synced and the demo rebuilt. The QR cross-check against the reference library: 40 of 40 matrices identical (versions 1 to 6, byte mode, level M, mask 0). The strict mutation script: 26 of 26 mutants killed by named `clock:` tests. In the built preview: the Clock card renders on the Group half with the switch disabled until a site is saved; saving a typed site through the card enables it, audits `radius 150 m` and no coordinates, and the poster renders with a scannable-looking code, the link and the date. Three test defects found by the dry run and fixed in this text: a proposal test that forgot its taps' `no location` flag, a fixture whose old record was an open proposal (which never expires, by design), and a toast assertion made after a later `state()` had cleared the toasts.

## As executed (29 Sep 2026)

Built with subagent-driven development on `main`, sonnet implementers transcribing the plan's scripts, sonnet task reviewers, the final whole-branch review on fable and its fix wave re-reviewed on opus. Commits 67ffbf5 (Task 1), 73e1ff7 (Task 2), c3a7b70 + b5572e0 (Task 3 and its fix round), 74cab64 (Task 4), 8e65431 (the final fix wave); Task 5 outside the repo (the staff guide 4 → 5 pages, the managers' guide 5 → 6, the runbook). Final counts: 1069 passes, 27 of 27 mutants killed by named clock tests, the QR encoder 40 of 40 against the reference library.

Departures from the text above, all reviewed:
- **Task 3, fix round 1:** `clockApprove` and `clockDecline` open with the app's admin-only guard (`Admin only.`), `clockRows` leaves records still open off the Hours to approve list, the Requests sub-line says "1 hour", and the no-shift refusal is asserted.
- **Final fix wave (8e65431):** an out tap stored as "00:00" on the shift's day (23:58–23:59, rounded) counts as midnight; a decision stores the rostered pair it was judged against and the list and the Clock report prefer it, with the decided pair in the report's Proposed columns; a real admin viewing as a person (`_realAdmin`) sees no buttons and is refused; `clockPosterHTML` catches a link too long for the code and prints a note; `clockCount` is 0 with the switch off; the Clock report row stays in the export menu while the cycle holds clock records; the spec's `clockProposal` and `clockDec` bullets corrected; the managers' guide uses the app's literal labels.
- **Parked at the final review's cap, with rulings in the session record:** the same-day "00:00" rule also fires for an out tap at 00:00–00:02 on a shift starting right after midnight (harmless; tighten to the 23:00 hour on the next touch); an admin who also works shifts cannot clock and sets hours from the roster cell (a decision for the owner); flags recompute after an Approve (store them on the decision later); the too-long-link note shows only on paper.
- **Lessons:** the harness never drains microtasks, so async paths are tested by their synchronous prefix with never-resolving fakes; a mutation script must sync the deploy copies and rebuild the demo per mutant; a fix that changes a line a mutant anchors on must update the mutant; a reference-library cross-check is the right proof for an encoder.

## Follow-up (29 Sep 2026, evening): the two parked items resolved at the owner's request

- **Managers who also work rostered shifts clock as themselves.** `clockMySid()` finds the signed-in person's own staff record by the email or mobile they signed in with (the same identity the sign-in uses); `clockActor()` is who a tap on a device belongs to — a staff sign-in taps as themselves, an admin sign-in only as their own record, whoever they are viewing as; the four gates (`clockTap`, `clockMyHTML`, `clockSheetHTML`, `clockApplyURL`) use it; My shifts lands an admin who is on the roster on their own shifts, and where it always did when their record is non-clinical or off the cycle. A sign-in with no record on the staff list is told so.
- **The same-day "00:00" rule tightened:** an out tap stored as "00:00" on the shift's day counts as midnight only when it was tapped in the 23:00 hour; tapped in the first minutes of the day it reads as before any in tap. Tests use explicit timestamps (`{ts:…}`), so a daylight-saving day cannot move them.
- **Parked:** an in tap at 23:58–23:59 on a shift that ends at midnight rounds up to "00:00" and reads as the start of the day (the record is void); no SWIFT shift starts then. The midnight rules use the time zone of the device that computes the proposal (the person's phone for their own status, the manager's screen for the list and the report), as the next-day rule always did; one-site groups sit in one zone.
- Reviewed on opus; one fix round (the landing check against the roster, a landing test that proves the change, DST-safe timestamps, the changelog's "same-day", the no-record wording). Counts after: 1072 passes.
- Mutation proof after the fix round: 32 mutants across the clock functions on a scratch copy (each mutant synced to the deploy copies, the demo rebuilt), 32/32 killed by named `clock:` tests.
