"use strict";
// moved from js/admin.js lines 2026-2165 (Phase 1 split, no edits)
/* ---------- import (SheetJS) ---------- */
const LEAVE_SET={AL:"AL",CME:"CME",UA:"UA",UPL:"UPL",PH:"PH",LSL:"LSL",SAB:"Sab",PL:"PL",O:"LSL",OTHER:"Other",ORIENTATION:"Orientation",VACANT:"Vacant",CONF:"Conf"};
function normCode(s){if(s==null)return null;const u=String(s).trim().toUpperCase();return LEAVE_SET[u]||null;}
function cellISO(v){if(v instanceof Date&&!isNaN(v))return iso(v);if(typeof v==="string"&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);return null;}
function parseShiftStr(v){
  if(v==null)return null;const s=String(v).trim();if(!s||s==="0")return null;
  const m=s.match(/(\d{3,4})\s*-\s*(\d{3,4})\s*(.*)/);
  if(m){const start=parseInt(m[1],10), end=parseInt(m[2],10), role=(m[3]||"").trim();
    const hhmm=x=>String(Math.floor(x/100)).padStart(2,"0")+":"+String(x%100).padStart(2,"0");
    const ty=bookableTypes(active()).find(t=>t.start===hhmm(start)&&t.end===hhmm(end));   // a span the cycle already has a type for comes back as that type, so an export re-imports whole
    const out={kind:"clinical",period:ty?ty.fills[0]:(Math.floor(start/100)<12?"AM":"PM"),role:role||"?",start:hhmm(start),end:hhmm(end)};   // the cell's own times travel with the entry: the import keeps them as own hours when they differ from the type's window
    if(ty&&!typeIsDefault(ty))out.type=ty.id;
    return out;}
  const _cstT=typeById(active(),"CST"), _u=s.toUpperCase();
  if(_u==="CST"||(_cstT&&(_u===String(_cstT.code).toUpperCase()||_u===String(_cstT.label).toUpperCase())))return {kind:"cst"};   // a renamed non-clinical block is still recognised by its own name
  const c=normCode(s);if(c)return {kind:"leave",code:c};
  return {kind:"leave",code:s.replace(/[^\w \/+.-]/g,"").slice(0,10)||"?"};   // spreadsheet cells are untrusted: strip markup-capable chars from unknown codes
}
function findHeaderRow(aoa){let best=-1,bestN=0;for(let r=0;r<Math.min(aoa.length,15);r++){let n=0;(aoa[r]||[]).forEach(v=>{if(cellISO(v))n++;});if(n>bestN){bestN=n;best=r;}}return bestN>5?best:-1;}
function isNameCell(name){ if(!name||!/[A-Za-z]/.test(name))return false;
  // reject spreadsheet labels / section headers that aren't real people
  if(/^(date|total|annual|cme|long service|mat\b|unavail|public hol|no of staff|eft off|term\b|school hol|conf\b|conference|resign|vacant|locum|gap\b|cover\b|notes?\b|comments?\b|roster\b|staff\b|name\b|consultant|registrar|tba\b|tbd\b|n\/?a\b)/i.test(name))return false;
  if(/(rotation|holiday)/i.test(name))return false;
  if(/[0-9()\[\]–—]/.test(name)||name.replace(/,/g," ").trim().split(/\s+/).length>4)return false;   // a person's name has no digits, brackets or dashes-as-punctuation, and at most four words: a template's own check rows ("ENTRY INTEGRITY — check before publication") are not people
  return true; }
function parseRosterAOA(aoa){
  const hr=findHeaderRow(aoa);if(hr<0)return {error:"No date header row found"};
  const dcols=[];(aoa[hr]||[]).forEach((v,c)=>{const di=cellISO(v);if(di)dcols.push({c:c,iso:di});});
  const staff=[],assigns={},skipped=[];
  for(let r=hr+1;r<aoa.length;r++){const row=aoa[r]||[];const name=row[0]==null?"":String(row[0]).trim();
    if(!isNameCell(name))continue;
    const cells=[]; let known=false;
    dcols.forEach(dc=>{const v=row[dc.c], sh=parseShiftStr(v); if(!sh)return; cells.push({iso:dc.iso,sh:sh}); if(sh.kind!=="leave"||normCode(v))known=true;});   // known = a shift, CST, or a leave code the roster has a name for
    if(!known&&!findStaffByName(name)){ skipped.push({name:name,why:cells.length?"nothing on the row is a shift, CST or a leave code the roster understands":"no shifts on this roster"}); continue; }   // a NEW name is added only once it is rostered: an empty row waits for a later import, and a template's own check rows ("Double-booking status") never become people. Existing people are updated as they always were, unknown codes included
    staff.push(name);
    cells.forEach(x=>{assigns[name+"|"+x.iso]=x.sh;});}
  return {dates:dcols.map(d=>d.iso),staff:staff,assigns:assigns,skipped:skipped};
}
function parseLeaveAOA(aoa,o){ const anyF=!!(o&&o.anyFilled);   // anyFilled: an UNAVAILABILITIES grid, where any mark in a cell means that day is unavailable (UA) — a half-day mark included; a real leave code still imports as itself
  const hr=findHeaderRow(aoa);if(hr<0)return {error:"No date header row found"};
  const dcols=[];(aoa[hr]||[]).forEach((v,c)=>{const di=cellISO(v);if(di)dcols.push({c:c,iso:di});});
  const staff=[],leave=[];
  for(let r=hr+1;r<aoa.length;r++){const row=aoa[r]||[];const name=row[0]==null?"":String(row[0]).trim();
    if(!isNameCell(name))continue;
    staff.push({name:name,eft:(typeof row[1]==="number"?row[1]:null),hrs:(typeof row[2]==="number"?row[2]:null)});
    let run=null;
    dcols.forEach(dc=>{const code=normCode(row[dc.c])||((anyF&&row[dc.c]!=null&&String(row[dc.c]).trim()!=="")?"UA":null);
      if(code){if(run&&run.code===code&&iso(addDays(parseISO(run.to),1))===dc.iso){run.to=dc.iso;}else{if(run)leave.push({name:name,from:run.from,to:run.to,code:run.code});run={code:code,from:dc.iso,to:dc.iso};}}
      else{if(run){leave.push({name:name,from:run.from,to:run.to,code:run.code});run=null;}}});
    if(run)leave.push({name:name,from:run.from,to:run.to,code:run.code});}
  const out={staff:staff,leave:leave,range:dcols.length?{from:dcols[0].iso,to:dcols[dcols.length-1].iso}:null};   // the sheet's date span — re-imports replace sheet-sourced leave within it
  if(anyF)out.anyFilled=true; return out;   // the key is there only when the tick was on, so an ordinary planner import is what it always was
}
function leaveSheetName(names,yr){ names=names||[]; return names.find(n=>n===yr)||names.find(n=>/^\d{4}$/.test(n))||names.find(n=>String(n).indexOf(yr)>=0&&/leave|unavail/i.test(n))||names[0]; }   // the sheet the leave import reads: the one named for the cycle's year, else one named with a year alone, else one whose name carries the year and the word leave or unavailable (a manager's own workbook, its roster months in front: "NOV 2026" … "Staff Leave 2026"), else the first sheet
function ensureZoneForRole(role){const base=role.replace(/\s*\+\s*OC$/i,"").trim();
  let z=S.zones.find(zz=>zz.name.toUpperCase()===base.toUpperCase());
  if(!z){z={id:slug(base)+"-"+Date.now()+Math.floor(Math.random()*999),name:base.toUpperCase(),am:true,pm:true,pmLabel:/\+\s*OC/i.test(role)?role.toUpperCase():""};S.zones.push(z);}
  else if(/\+\s*OC/i.test(role)&&!z.pmLabel){z.pmLabel=role.toUpperCase();}
  return z.id;}
function findStaffByName(name){ const raw=String(name||"").trim().toLowerCase(); if(!raw)return null;
  let s=S.staff.find(x=>x.name.toLowerCase()===raw); if(s)return s;
  const tight=raw.replace(/\s+/g,""); s=S.staff.find(x=>x.name.toLowerCase().replace(/\s+/g,"")===tight); if(s)return s;   // spacing aside, the same name: "Corcuera Hotz,Ines" is the Ines already here, never a second one
  const k=normName(name); const m=S.staff.filter(x=>normName(x.name)===k); if(m.length)return m.length===1?m[0]:null;   // letters only, when that names exactly one person; two people whose letters coincide are never guessed between
  const sp=splitName(name); if(!sp.giv)return null; const k2=normName(String(name).indexOf(",")>=0?(sp.giv+sp.sur):(sp.sur+sp.giv)), m2=S.staff.filter(x=>normName(x.name)===k2); return m2.length===1?m2[0]:null; }   // "Ava Ng" is "Ng, Ava" (and the other way round): the letters in the other order, when that names exactly one person — a manager's grid writes names as people say them
function ensureStaff(name){let s=findStaffByName(name);
  if(!s){const d=staffDefaults();s={id:slug(name)+"-"+Date.now()+Math.floor(Math.random()*999),name:name,initials:initialsFrom(name),mobile:"",email:"",mode:"self",quota:d.quota,eft:1,hrsFortnight:d.hrsFortnight};S.staff.push(s);}
  return s;}
function rosterImportSummary(p,eftName){ let t="Staff: "+p.staff.length+"\nDays: "+p.dates.length+" ("+p.dates[0]+" → "+p.dates[p.dates.length-1]+")\nShifts: "+Object.keys(p.assigns).length+(eftName?"\nEFT Data sheet found — will set per-fortnight quota + hours.":"");
  if(p.skipped&&p.skipped.length)t+="\n\nNot added — "+p.skipped.map(x=>x.name+" ("+x.why+")").join("; ")+".";   // who the roster left out, and why, before the admin confirms
  return t; }
function applyRosterImport(p,target){
  if(target){   // UPDATE-IN-PLACE: re-importing the same dates replaces that cycle's SHIFTS from the spreadsheet — no duplicate cycle. Status, settings (times/fatigue/cover) and existing per-person quotas are preserved.
    const cyc=target;
    cyc.cycle={start:p.dates[0],weeks:Math.max(1,Math.round(p.dates.length/7))};
    if(!cyc.settings)cyc.settings={};
    if(!cyc.settings.zones)cyc.settings.zones=(S.zones||[]).map(z=>({...z}));
    const _pz=S.zones; S.zones=cyc.settings.zones;   // zone lookups/additions go into THIS cycle's zones (ids preserved → existing colours/settings keep working)
    const na={};
    Object.keys(p.assigns).forEach(k=>{const i=k.indexOf("|");const name=k.slice(0,i),isoD=k.slice(i+1),sh=p.assigns[k];const s=ensureStaff(name);
      na[s.id+"|"+isoD]=(sh.kind==="clinical")?importShift(cyc,sh):sh;});
    S.zones=_pz;
    cyc.assign=na;   // the spreadsheet is the source of truth for shifts — full replacement
    cyc.roles=cyc.roles||{}; const _pt=new Set(Object.keys(na).map(k=>k.slice(0,k.indexOf("|"))));
    (p.staff||[]).forEach(st=>{ const nm=st&&st.name?st.name:st; if(nm){const s=ensureStaff(nm); if(s)_pt.add(s.id);} });
    _pt.forEach(id=>{ const s=S.staff.find(x=>x.id===id); if(!s)return;
      if(!cyc.roles[id])cyc.roles[id]={in:true,quota:s.quota||0,eft:(s.eft!=null?s.eft:1),hrsFortnight:(s.hrsFortnight!=null?s.hrsFortnight:76),periodTargets:{...(s.periodTargets||{})}};
      else if(cyc.roles[id].in===false)cyc.roles[id].in=true; });   // keep existing quota/EFT edits; just ensure everyone rostered is IN
    S.activeId=cyc.id;
    hydrateCycleSettings(); hydrateCycleRoles();   // hydrate FIRST so save()'s role-sync writes back exactly the cycle's own (possibly admin-edited) quotas — never stale staff values
    logAudit("import.roster.update",p.staff.length+" staff · "+Object.keys(na).length+" shifts replaced"+(p.skipped&&p.skipped.length?" · "+p.skipped.length+" row"+(p.skipped.length>1?"s":"")+" not added":"")+" · "+cyLabel(cyc),"admin");save();
    return cyc;
  }
  const cyc={id:"cyc-"+Date.now(),cycle:{start:p.dates[0],weeks:Math.max(1,Math.round(p.dates.length/7))},assign:{},status:"draft",archived:false};
  cyc.settings={ zones:(S.zones||[]).map(z=>({...z})), staffing:{...effStaffing()}, unlockOrder:effUnlock(), noticeDays:cset().noticeDays, rosterMode:cset().rosterMode, oncallWindows:(cset().oncallWindows?JSON.parse(JSON.stringify(cset().oncallWindows)):undefined), fairness:S.fairness, waveCount:S.waveCount, quotaPeriod:S.quotaPeriod, quotaCapMode:S.quotaCapMode, quotaFlex:S.quotaFlex, leaveCapEft:S.leaveCapEft, shiftTypes:(cset().shiftTypes?JSON.parse(JSON.stringify(cset().shiftTypes)):undefined), shiftTimes:(cset().shiftTimes?JSON.parse(JSON.stringify(cset().shiftTimes)):undefined), fatigue:(cset().fatigue?JSON.parse(JSON.stringify(cset().fatigue)):undefined) };
  const _prevZones=S.zones; S.zones=cyc.settings.zones;   // ensureZoneForRole builds into THIS cycle's zones, not a shared/other cycle's
  Object.keys(p.assigns).forEach(k=>{const i=k.indexOf("|");const name=k.slice(0,i),isoD=k.slice(i+1),sh=p.assigns[k];const s=ensureStaff(name);
    cyc.assign[s.id+"|"+isoD]=(sh.kind==="clinical")?importShift(cyc,sh):sh;});
  S.zones=_prevZones;   // restore; render() re-hydrates from the now-active cycle
  const _rc=rulesCarry(cset().rules,cyc.settings.zones); if(_rc)cyc.settings.rules=_rc;   // the rules come along, less any for a zone the new cycle does not have
  // seed per-cycle roles for everyone in this imported roster (participants = anyone with a shift, plus the imported staff list)
  cyc.roles={}; const _parts=new Set(Object.keys(cyc.assign).map(k=>k.slice(0,k.indexOf("|"))));
  (p.staff||[]).forEach(st=>{ const nm=st&&st.name?st.name:st; if(nm){const s=ensureStaff(nm); if(s)_parts.add(s.id);} });
  _parts.forEach(id=>{ const s=S.staff.find(x=>x.id===id); if(s)cyc.roles[id]={in:true,quota:s.quota||0,eft:(s.eft!=null?s.eft:1),hrsFortnight:(s.hrsFortnight!=null?s.hrsFortnight:76),periodTargets:{...(s.periodTargets||{})}}; });
  if(S.cycles.length===1 && Object.keys(S.cycles[0].assign).length===0){cyc.id=S.cycles[0].id;S.cycles[0]=cyc;} // replace empty starter cycle
  else S.cycles.push(cyc);
  S.activeId=cyc.id;
  logAudit("import.roster",p.staff.length+" staff · "+p.dates.length+" days"+(p.skipped&&p.skipped.length?" · "+p.skipped.length+" row"+(p.skipped.length>1?"s":"")+" not added":"")+" · "+cyLabel(cyc),"admin");save();
  hydrateCycleSettings(); hydrateCycleRoles();   // make the new cycle active so a following EFT-Data apply syncs into IT
  return cyc;
}
function applyLeaveImport(p){let added=0,cleared=0; const c=active();
  p.staff.forEach(st=>{const s=ensureStaff(st.name);if(st.eft!=null)s.eft=round2(st.eft);if(st.hrs!=null)s.hrsFortnight=round2(st.hrs);
    if(c){ if(!c.roles)c.roles={}; if(!c.roles[s.id])c.roles[s.id]={in:true,quota:s.quota||20,eft:(s.eft!=null?s.eft:1),hrsFortnight:(s.hrsFortnight!=null?s.hrsFortnight:76),periodTargets:{}}; } });   // roster any newly-imported person into the active cycle so they appear
  // the sheet is the source of truth for SHEET-SOURCED leave: remove previously-imported blocks for these staff within the sheet's date span (leave approved through the app — requestId ≠ "import" — is never touched). Re-imports never duplicate; leave cancelled in Excel disappears here too.
  if(p.range){ const ids=new Set(p.staff.map(st=>{const s=findStaffByName(st.name);return s&&s.id;}).filter(Boolean));
    const before=S.leave.length;
    S.leave=S.leave.filter(L=>!(L.requestId==="import"&&ids.has(L.staffId)&&L.from<=p.range.to&&L.to>=p.range.from));
    cleared=before-S.leave.length; }
  p.leave.forEach(L=>{const s=findStaffByName(L.name);if(!s)return;addLeave({staffId:s.id,from:L.from,to:L.to,code:L.code,status:"approved",requestId:"import"});ocClearRange(s.id,L.from,L.to);added++;});
  logAudit("import.leave",p.staff.length+" staff · "+added+" leave blocks"+(cleared?" (replaced "+cleared+" previously imported)":"")+(p.anyFilled?" · any filled cell = UA":""),"admin");save();return added;
}
function normName(n){return String(n||"").toLowerCase().replace(/[^a-z]/g,"");}   // for fuzzy name matching across sheets
function numFrom(v){if(v==null)return null;const m=String(v).match(/\d+(\.\d+)?/);return m?+m[0]:null;}   // "5*" -> 5
function parseEftSheet(aoa){
  let hr=-1; for(let r=0;r<Math.min(aoa.length,20);r++){const row=(aoa[r]||[]).map(c=>String(c==null?"":c).toLowerCase()); if(row.some(c=>/clinical shift/.test(c))){hr=r;break;}}
  if(hr<0)return null;
  const hdr=(aoa[hr]||[]).map(c=>String(c==null?"":c).toLowerCase());
  let nameCol=hdr.findIndex(c=>/name/.test(c)); if(nameCol<0)nameCol=0;
  const hoursCol=hdr.findIndex(c=>/hour/.test(c)), shiftCol=hdr.findIndex(c=>/clinical shift/.test(c));
  const out=[]; for(let r=hr+1;r<aoa.length;r++){const row=aoa[r]||[];const nm=String(row[nameCol]==null?"":row[nameCol]).trim();
    if(!isNameCell(nm))continue; out.push({name:nm, hrs:hoursCol>=0?numFrom(row[hoursCol]):null, shifts:shiftCol>=0?numFrom(row[shiftCol]):null}); }
  return out;
}
function applyEftData(rows,cyc){
  const fns=Math.max(1,Math.round((cyc.cycle.weeks||8)/2)); const byNorm={}; S.staff.forEach(s=>byNorm[normName(s.name)]=s); let n=0;
  rows.forEach(rw=>{const s=byNorm[normName(rw.name)]; if(!s)return;
    if(rw.shifts!=null){s.quota=Math.round(rw.shifts*fns); s.perFortnight=rw.shifts;}
    if(rw.hrs!=null){s.hrsFortnight=round2(rw.hrs); if(s.eft==null||s.eft===1)s.eft=round2(rw.hrs/76);} n++;});
  logAudit("import.eftdata",n+" "+ROLES()+" · per-fortnight quota+hours · "+fns+" fortnights/cycle","admin");save();return n;
}
function importShift(cyc,sh){ const out=Object.assign({kind:"clinical",period:sh.period,zone:ensureZoneForRole(sh.role)},(sh.type&&typeById(cyc,sh.type))?{type:sh.type}:{});
  if(sh.start&&sh.end&&hoursOK(sh.start,sh.end)){ const h=hoursNorm(cyc,out,sh.start,sh.end); if(h)out.hours=h; } return out; }   // an imported cell: the type the cycle knows, and the cell's own times as own hours when they differ from that type's window; a pair the rule refuses is dropped
