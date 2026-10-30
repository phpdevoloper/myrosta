"use strict";
// moved from js/admin.js lines 2242-2375 (Phase 1 split, no edits)
/* ---------- staff list template + bulk import (onboarding for orgs with no roster yet) ---------- */
function downloadStaffTemplate(){
  if(typeof XLSX==="undefined"){toast("Spreadsheet reader not loaded — check your connection and retry.");return;}
  const head=["Surname","Given name","EFT (0-1)","Hours per fortnight","Clinical shifts per fortnight","CST days per fortnight","Email","Mobile","Payroll #","Mode (self/fixed/preference)","Tags (Senior; Triage-trained)","Job description"];
  const ws=XLSX.utils.aoa_to_sheet([head]);
  ws["!cols"]=head.map((h,i)=>({wch:(i<2?16:(i>=5?20:16))}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Staff");
  XLSX.writeFile(wb,"myrosta-staff-template.xlsx");
}
function parseStaffList(aoa){
  let hr=-1;
  for(let r=0;r<Math.min(aoa.length,8);r++){ const row=(aoa[r]||[]).map(c=>String(c==null?"":c).toLowerCase());
    if((row.some(c=>/surname|last name/.test(c))&&row.some(c=>/given|first name/.test(c)))||row.some(c=>/^name$|consultant/.test(c))){hr=r;break;} }
  if(hr<0)return {error:"No header row found — needs 'Surname' + 'Given name' (or a single 'Name' column)."};
  const hdr=(aoa[hr]||[]).map(c=>String(c==null?"":c).toLowerCase());
  const find=(...keys)=>{for(let i=0;i<hdr.length;i++){if(keys.some(k=>hdr[i].indexOf(k)>=0))return i;}return -1;};
  const ci={cstp:find("cst day","cst per","support time"), notes:find("job description","consideration","notes"), sur:find("surname","last name"), giv:find("given","first name"), name:find("name"), eft:find("eft"), hrs:find("hour"), shifts:find("clinical shift","shifts per"), email:find("email"), mobile:find("mobile","phone"), pay:find("payroll","employee"), mode:find("mode"), tags:hdr.findIndex(h=>/^\s*tags?\b/.test(h))};   // the Tags column by its own name — never "percentage" or "stage"
  const out=[];
  for(let r=hr+1;r<aoa.length;r++){ const row=aoa[r]||[]; let sur="",giv="";
    if(ci.sur>=0){ sur=String(row[ci.sur]==null?"":row[ci.sur]).trim(); giv=ci.giv>=0?String(row[ci.giv]==null?"":row[ci.giv]).trim():""; }
    else if(ci.name>=0){ const nm=splitName(String(row[ci.name]==null?"":row[ci.name]).trim()); sur=nm.sur; giv=nm.giv; }
    if(!sur||!/[A-Za-z]/.test(sur)||!isNameCell(sur))continue;
    out.push({sur:sur, giv:giv,
      eft:ci.eft>=0?numFrom(row[ci.eft]):null, hrs:ci.hrs>=0?numFrom(row[ci.hrs]):null, shifts:ci.shifts>=0?numFrom(row[ci.shifts]):null,
      cstp:ci.cstp>=0?numFrom(row[ci.cstp]):null, notes:ci.notes>=0?String(row[ci.notes]==null?"":row[ci.notes]).trim():"",
      email:ci.email>=0?String(row[ci.email]==null?"":row[ci.email]).trim():"", mobile:ci.mobile>=0?String(row[ci.mobile]==null?"":row[ci.mobile]).trim():"",
      pay:ci.pay>=0?String(row[ci.pay]==null?"":row[ci.pay]).replace(/\.0+$/,"").trim():"", mode:ci.mode>=0?String(row[ci.mode]==null?"":row[ci.mode]).trim().toLowerCase():"", tags:ci.tags>=0?String(row[ci.tags]==null?"":row[ci.tags]).trim():""});
  }
  return {rows:out};
}
function applyStaffList(rows){
  const fns=Math.max(1,Math.round((active().cycle.weeks||8)/2));
  const byNorm={}, byPay={}; S.staff.forEach(s=>{ byNorm[normName(s.name)]=s; if(s.payrollId)byPay[String(s.payrollId)]=s; });
  let created=0, updated=0; const made=[];
  rows.forEach(rw=>{ const fullName=rw.giv?(rw.sur+", "+rw.giv):rw.sur;
    let s=(rw.pay&&byPay[rw.pay])||byNorm[normName(fullName)]||null;
    if(!s){ const d=staffDefaults(); s={id:slug(fullName)+"-"+Date.now()+Math.floor(Math.random()*999),name:fullName,initials:initialsFrom(fullName),mobile:"",email:"",mode:"self",quota:d.quota,eft:1,hrsFortnight:d.hrsFortnight,payrollId:"",fixedPattern:{recurrence:"weekly",A:{},B:{},committed:false},periodTargets:{}}; S.staff.push(s); byNorm[normName(fullName)]=s; created++; }
    else updated++;
    if(rw.eft!=null)s.eft=round2(rw.eft);
    if(rw.hrs!=null){ s.hrsFortnight=round2(rw.hrs); if(rw.eft==null)s.eft=round2(rw.hrs/76); }
    else if(rw.eft!=null)s.hrsFortnight=round2(rw.eft*76);
    if(rw.shifts!=null){ s.quota=Math.round(rw.shifts*fns); s.perFortnight=rw.shifts; }
    if(rw.cstp!=null)s.cstQuota=Math.max(0,Math.round(rw.cstp*fns));   // CST days per fortnight × fortnights, as the clinical column; a blank cell leaves the person's number alone
    if(rw.notes)s.notes=rw.notes;   // a filled Job description cell replaces the notes; an empty one leaves them alone
    if(rw.email)s.email=rw.email; if(rw.mobile)s.mobile=rw.mobile; if(rw.pay)s.payrollId=rw.pay;
    if(rw.mode&&["self","fixed","preference"].indexOf(rw.mode)>=0)s.mode=rw.mode;
    if(rw.tags){ const got=tagsFromCell(rw.tags,made); if(got.length)s.tags=got; else delete s.tags; }   // a filled Tags cell replaces the person's tags; an empty one leaves them alone
  });
  if(made.length)logAudit("tags.import",made.length+" tag"+(made.length>1?"s":"")+" created, hidden: "+made.join(", "),"admin");
  logAudit("import.stafflist",created+" added, "+updated+" updated","admin"); save();
  return {created:created, updated:updated, tagsMade:made};
}
function importStaffList(file){
  if(typeof XLSX==="undefined"){toast("Spreadsheet reader not loaded — check your connection and retry.");return;}
  const reader=new FileReader();
  reader.onload=ev=>{ let wb; try{wb=XLSX.read(ev.target.result,{type:"array"});}catch(x){toast("Couldn't read file: "+x.message,"danger");return;}
    const name=wb.SheetNames.find(n=>/staff/i.test(n))||wb.SheetNames[0];
    const p=parseStaffList(XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null}));
    if(p.error){toast("Staff list import: "+p.error);return;}
    if(!p.rows.length){toast("No staff rows found under the header.");return;}
    if(!confirm("Import staff list?\n\n"+p.rows.length+" "+(p.rows.length===1?ROLE():ROLES())+" found:\n"+p.rows.slice(0,8).map(r=>"• "+r.sur+(r.giv?", "+r.giv:"")).join("\n")+(p.rows.length>8?"\n…":"")+"\n\nNew names are added; existing ones (matched by payroll # or name) are updated."))return;
    const res=applyStaffList(p.rows);
    recordImport("staff",file.name,res.created+" added, "+res.updated+" updated"); save(); toast("Staff imported — "+res.created+" added, "+res.updated+" updated."+(res.tagsMade&&res.tagsMade.length?" New tags, hidden until you tick Show: "+res.tagsMade.join(", ")+".":"")); render();
  };
  reader.readAsArrayBuffer(file);
}
function setupChecklist(){   // the runbook's ten questions, ticked on DECISIONS (an admin saved it) — never on seeded defaults
  const b=S.branding||{}, c=cset(), a=active(), ans=c.answered||{}, audit=S.audit||[]; const K=groupKind(), DEF=kindZoneNames();   // the preset's names, or the generic four
  const heard=re=>audit.some(x=>re.test(x.action||""));
  const zonesDone=!!ans.zones||!!(c.zones&&(c.zones.length!==DEF.length||c.zones.some(z=>DEF.indexOf(String(z.name).toUpperCase())<0)));
  const nounSeeded=!!(K&&K.noun&&b.roleNoun===K.noun&&!heard(/^settings\.branding$/));   // the preset wrote it and no admin has saved Group details since
  const cycDone=!!ans.dates||heard(/^cycle\.dates$/)||a.status!=="draft"||Object.keys(a.assign||{}).length>0||S.cycles.length>1;
  const lastDay=(()=>{const ds=cycleDates();return ds.length?iso(ds[ds.length-1]):a.cycle.start;})();
  const rows=[
    {key:"name",n:"1",q:"What is this group called?",done:!!b.name,anchor:"brandCard",detail:b.name?b.name:"Appears in the picker and the header"},
    {key:"role",n:"2",q:"What are its people called?",done:!!b.roleNoun&&!nounSeeded,anchor:"brandCard",detail:b.roleNoun?(b.roleNoun+(nounSeeded?" — from the preset; save Group details to confirm":"")):"consultant, nurse, midwife, scribe…"},
    {key:"zones",n:"3",q:"What are the roles or areas per shift?",done:zonesDone,anchor:"card-zones",detail:(S.zones||[]).map(z=>z.name).join(", ")||"Rooms or jobs — a zone is a labelled slot"},
    {key:"cover",n:"4",q:"How many people per shift, min–max?",done:!!ans.cover||heard(/^settings\.staffing$/),anchor:"card-cover",detail:c.staffing?`AM ${c.staffing.amMin}–${c.staffing.amMax} · PM ${c.staffing.pmMin}–${c.staffing.pmMax}`:"The minimum is the floor"},
    {key:"times",n:"5",q:"What are the shift types and times?",done:!!ans.times||heard(/^settings\.shift(Times|Types)$/),anchor:"card-times",detail:c.shiftTypes?shiftTypesOf(a).filter(t=>t.on!==false&&t.fills&&t.fills.length).map(t=>t.label+" "+typeTime(t)).join(" · "):(c.shiftTimes?`${perName("AM")} ${periodTime("AM")} · ${perName("PM")} ${periodTime("PM")}`:"Per cycle")},
    {key:"cycle",n:"6",q:"How long is a cycle, and when does it start?",done:cycDone,anchor:"card-cycle",detail:cyLabel(a)},
    {key:"quota",n:"7",q:"How is quota counted?",done:!!ans.quota||heard(/^settings\.quotaPeriod$/),anchor:"card-quota",detail:c.quotaPeriod?("per "+c.quotaPeriod):"Per fortnight matches pay"},
    {key:"mode",n:"8",q:"How does this group run its roster?",done:!!ans.mode||heard(/^settings\.rosterMode$/),anchor:"card-mode",detail:c.rosterMode?(c.rosterMode==="rolling"?"Rolling — live all cycle":"Rounds — open, book, close, publish"):"Rounds or rolling"},
    {key:"method",n:"8a",q:"How do people get shifts?",done:!!ans.method||heard(/^settings\.fairness$/),anchor:"card-mode",detail:c.fairness?fairnessLabel(c.fairness):"Everyone at once · In random groups · Take turns · Pre-filled, then adjust"},
    {key:"fatigue",n:"9",q:"Safe-hours rules?",done:!!ans.fatigue||heard(/^settings\.fatigue$/),anchor:"card-fatigue",detail:c.fatigue?("Fatigue: "+effFatigue().mode):"Off, warn or block — decide even if off"},
    {key:"features",n:"10",q:"Which features stay on?",done:!!S.featuresReviewed,anchor:"brandCard",detail:"RosterOn export, Equity tab, Leave planner, marketplace, CST"},
    {key:"staff",n:"+",q:"Add or import your "+ROLES(),done:S.staff.length>0,anchor:"staff",detail:S.staff.length?(S.staff.length+" on the list"):"Template upload or one at a time"},
    {key:"leavecap",n:"+",q:"Set the leave cap per day",done:!!ans.leavecap||heard(/^settings\.leave/),anchor:"card-leavecap",detail:"How many EFT may be away at once"},
    {key:"oncall",n:"+",q:"Does this group run on-call?",done:!!ans.oncall||heard(/^settings\.oncall$/)||heard(/^settings\.zoneOnCall$/)||ocWindows(a).some(w=>w.from),anchor:"card-oncall",detail:ocWindows(a).length?ocWindows(a).map(w=>w.label+" "+ocWhenText(w)).join(" · "):"None \u2014 add a window if someone carries a phone"},
    {key:"notice",n:"+",q:"How much notice to come off a shift?",done:!!ans.notice||heard(/^settings\.notice$/),anchor:"card-notice",detail:effNotice(a)?(effNotice(a)+" days \u2014 closer than that, they hand it over or ask you"):"Off \u2014 anyone may drop any future shift"},
    {key:"ph",n:"+",q:"Mark the public holidays in this cycle",done:(S.publicHolidays||[]).some(d=>d>=a.cycle.start&&d<=lastDay),anchor:"daily",detail:"Day board → Mark public holiday"}];
  if(deptOn())rows.push({key:"board",n:"+",q:"Publish to the department board",done:!!(S.board&&S.board.publish),anchor:"brandCard",detail:(S.board&&S.board.publish)?"On \u2014 the other groups see who's on":"Names, slots and times only; never contacts, pay or reasons"});
  if(cloudOn())rows.push({key:"allowlist",n:"+",q:"Sync the allow-list so people can sign in",done:(typeof _members!=="undefined"&&Array.isArray(_members)&&_members.length>0),anchor:"card-access",detail:(typeof _members!=="undefined"&&_members.length)?(_members.length+" can sign in"):"Settings → Access control → Sync"});
  if(cloudOn()){ const inv=S.staff.filter(invitedAlready).length, bad=inviteFailed().length; rows.push({key:"invite",n:"+",q:"Invite your "+ROLES(),done:S.staff.length>0&&inv>0&&!inviteTargets().length&&!bad,anchor:"invite",detail:inv?(inv+" invited"+(inviteTargets().length?" · "+inviteTargets().length+" to go":"")+(bad?" · "+bad+" could not be reached — check their number":"")):"A text or email with how to sign in — no password"}); }
  return rows; }
function checklistHTML(){
  const rows=setupChecklist(), done=rows.filter(r=>r.done).length, rolling=isRolling(active());
  const items=rows.map((r,i)=>`<a class="ckrow ${r.done?"done":""}" href="#" ${r.anchor==="invite"?'data-invite="1"':`data-go="${(r.anchor==="staff"||r.anchor==="daily")?r.anchor:"setup||"+r.anchor}"`}><span class="tag ${r.done?"ok":"muted"}" style="min-width:22px;text-align:center">${r.done?ic("check"):r.n}</span><span class="grow"><b>${escapeHTML(r.q)}</b><span class="muted small ckd">${escapeHTML(r.detail)}</span></span><span class="chev">${ic("chevR")}</span></a>`).join("");
  return `<div class="card" id="card-guide" style="border-left:4px solid var(--accent)">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">Get started</h2><span class="tag ${done===rows.length?"ok":"warn"}">${done}/${rows.length}</span><span class="grow"></span><button class="btn sm" id="guideHide">Hide guide</button></div>
    <div class="sub" style="margin-top:4px">The ten questions, then the follow-ups. Every staff group starts from the same engine; setup is answering these, not building anything. Tap a row to go to its card. Have spreadsheets? <a href="#" data-go="setup||card-import">Import data</a> fills most of it.<div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="wizTpl">Download staff template</button><label class="btn sm" style="cursor:pointer">Upload staff list<input type="file" id="wizStaff" accept=".xlsx,.xls" class="vh"></label></div></div>
    ${items}
    <div class="muted small" style="margin-top:10px">Then: <a href="#" data-go="selfroster||card-round">${rolling?"go live":"run the round"}</a> — place fixed shifts, pre-fill, ${rolling?"go live":"open booking, close, publish"}.</div>
  </div>`; }
function setupGuideHTML(){ return (groupIsFresh()?groupKindCardHTML():"")+checklistHTML(); }   // the kind card sits above Get started only while the group is empty; Hide guide hides both
function importFile(file,kind){
  if(typeof XLSX==="undefined"){toast("Spreadsheet library not loaded — check your internet connection, then retry.");return;}
  const reader=new FileReader();
  reader.onload=ev=>{let wb;try{wb=XLSX.read(ev.target.result,{type:"array",cellDates:true});}catch(x){toast("Couldn't read file: "+x.message,"danger");return;}
    if(kind==="roster"){
      const ws=wb.Sheets["Roster"]||wb.Sheets[wb.SheetNames[0]];
      const p=parseRosterAOA(XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null}));
      if(p.error){toast("Roster import: "+p.error);return;}
      const eftName=wb.SheetNames.find(n=>/eft\s*data/i.test(n));
      const summary=rosterImportSummary(p,eftName);
      const match=(S.cycles||[]).find(c=>!c.archived&&c.cycle&&c.cycle.start===p.dates[0]);   // same start date = re-import of that cycle → update it, never duplicate
      if(match){
        if(!confirm("UPDATE the existing cycle "+cyLabel(match)+" ("+(STATUS[match.status]?STATUS[match.status].label:match.status)+")?\n\n"+summary+"\n\nIts shifts will be REPLACED by this spreadsheet — no duplicate cycle is created. Settings, quotas and status are kept, so you can review the roster and then Publish."))return;
      }else{
        if(!confirm("Import roster?\n\n"+summary+"\n\nAdds a NEW cycle — existing data untouched."))return;
      }
      const cyc=applyRosterImport(p,match||null); recordImport("roster",file.name,p.staff.length+" staff · "+p.dates.length+" days → "+cyLabel(cyc)); save();
      if(eftName){const er=parseEftSheet(XLSX.utils.sheet_to_json(wb.Sheets[eftName],{header:1,raw:true,defval:null})); if(er&&er.length){const n=applyEftData(er,cyc); toast("Roster imported. Per-fortnight quota + hours set for "+n+" "+ROLES()+" from the EFT Data sheet.");}}
      S.tab="roster";render();
    }else{
      const yr=String(parseISO(active().cycle.start).getFullYear());
      const name=leaveSheetName(wb.SheetNames,yr);
      const _anyF=!!((document.getElementById("impLeaveAny")||{}).checked);   // an UNAVAILABILITIES grid: every mark is a day unavailable; never remembered between imports
      const p=parseLeaveAOA(XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null}),{anyFilled:_anyF});
      if(p.error){toast("Leave import: "+p.error);return;}
      if(!confirm("Import leave planner (sheet '"+name+"')?\n\nStaff: "+p.staff.length+"\nLeave blocks: "+p.leave.length+(p.anyFilled?"\nAny filled cell counts as unavailable (UA).":"")+"\n\nRe-importing REPLACES previously imported leave for these staff in this sheet's date range — no duplicates. Leave approved through the app is kept."))return;
      recordImport("leave",file.name,p.staff.length+" staff · "+p.leave.length+" leave blocks"); applyLeaveImport(p);S.tab="planner";render();
    }};
  reader.readAsArrayBuffer(file);
}
