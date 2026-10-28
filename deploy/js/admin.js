"use strict";

/* ----- Capacity check (director tool): does the workforce fit the layout? Pure arithmetic, every line shown. ----- */
function capacityInputs(){
  const st=effStaffing(), o=S.capOverride||{};
  const zAM=(S.zones||[]).filter(z=>z.am).length, zPM=(S.zones||[]).filter(z=>z.pm).length;
  const eftTot=Math.round(rosterStaff().reduce((a,s)=>a+(+s.eft||0),0)*100)/100;
  const b=S.capBuffer||{al:5,sick:2,cme:1.5};
  return {
    zonesAM: o.zonesAM!=null?+o.zonesAM:zAM, zonesPM: o.zonesPM!=null?+o.zonesPM:zPM,
    minAM: o.minAM!=null?+o.minAM:(+st.amMin||0), maxAM: o.maxAM!=null?+o.maxAM:(+st.amMax||0),
    minPM: o.minPM!=null?+o.minPM:(+st.pmMin||0), maxPM: o.maxPM!=null?+o.maxPM:(+st.pmMax||0),
    eft: o.eft!=null?+o.eft:eftTot, eftActual:eftTot,
    spw: o.spw!=null?+o.spw:3.5,                                     // clinical shifts per full-time EFT per week (28 per 8-week cycle)
    bufAL:+b.al||0, bufSick:+b.sick||0, bufCME:+b.cme||0,
    headcount: rosterStaff().length
  };
}
function capacityCalc(inp){
  const need=(zA,cA,zP,cP)=>Math.min(zA,cA)*7+Math.min(zP,cP)*7;   // a zone-period can only be covered once; cover can't exceed zones
  const needMin=need(inp.zonesAM,inp.minAM,inp.zonesPM,inp.minPM);
  const needMax=need(inp.zonesAM,inp.maxAM,inp.zonesPM,inp.maxPM);
  const bufFrac=Math.min(0.9,Math.max(0,(inp.bufAL+inp.bufSick+inp.bufCME)/52));
  const paper=inp.eft*inp.spw;                     // shifts/week if nobody were ever away
  const real=paper*(1-bufFrac);                    // shifts/week you can actually count on
  const r=x=>Math.round(x*10)/10;
  const eftFor=(shifts,withBuf)=>{ const denom=inp.spw*(withBuf?(1-bufFrac):1); return denom>0?shifts/denom:0; };
  const out={ needMin, needMax, bufFrac:r(bufFrac*100), paper:r(paper), real:r(real),
    fillMin: needMin>0?Math.min(100,Math.round(real/needMin*100)):100,
    fillMax: needMax>0?Math.min(100,Math.round(real/needMax*100)):100,
    shortMin:r(Math.max(0,needMin-real)), shortMax:r(Math.max(0,needMax-real)),
    perDayShortMin:r(Math.max(0,needMin-real)/7),
    eftNeedMinBuf:r(Math.max(0,eftFor(needMin,true)-inp.eft)),  eftNeedMinRaw:r(Math.max(0,eftFor(needMin,false)-inp.eft)),
    eftNeedMaxBuf:r(Math.max(0,eftFor(needMax,true)-inp.eft)),  eftNeedMaxRaw:r(Math.max(0,eftFor(needMax,false)-inp.eft)),
    eftReqMin:r(eftFor(needMin,true)), eftReqMax:r(eftFor(needMax,true)),
    headroom:r(real-needMin) };
  out.verdict = real>=needMax? "green" : real>=needMin? (real-needMin<needMin*0.05?"amber":"ok") : "red";
  return out;
}
function capacityVerdict(c){
  if(c.verdict==="green")return {cls:"ok",label:"Comfortable — full cover is within reach",note:"Your available shifts meet the maximum layout even after the buffer."};
  if(c.verdict==="ok")return {cls:"ok",label:"Minimum cover is safe",note:"Minimum cover is met with buffer to spare; the extra slots above minimum will be partly open."};
  if(c.verdict==="amber")return {cls:"warn",label:"Runs at zero buffer",note:"Minimum cover is met only just — one sick call from a gap. Plan on the marketplace or locums for peaks."};
  return {cls:"danger",label:"Structural deficit",note:"Even minimum cover can't be met from the workforce once realistic leave and sickness are counted."};
}
function capacityLiveCheck(){   // the SAME arithmetic applied to what is actually booked in this cycle
  const ds=cycleDates(); if(!ds.length)return null;
  let booked=0; ds.forEach(d=>{ const c=clinicalCounts(iso(d),null); booked+=c.am+c.pm; });
  const weeks=ds.length/7, inp=capacityInputs(), cap=capacityCalc(inp);
  const bookedPW=Math.round(booked/weeks*10)/10;
  return { bookedPW, weeks:Math.round(weeks*10)/10, realPW:cap.real, pct: cap.real>0?Math.round(bookedPW/cap.real*100):0 };
}
function capacityCardHTML(){
  const inp=capacityInputs(), c=capacityCalc(inp), v=capacityVerdict(c), live=capacityLiveCheck();
  const f=(id,val,step,w,name)=>`<input type="number" step="${step||1}" min="0" id="${id}" value="${val}" style="width:${w||70}px"${name?` aria-label="${name}"`:""}>`;
  const ovr=Object.keys(S.capOverride||{}).length>0;
  const nm=n=>escapeHTML(String(n));
  return `<div class="card" id="capCard">${printHeadHTML("Capacity business case — "+cyLabel(active()))}
    <div class="row" style="align-items:center"><h2>Capacity check</h2><span class="grow"></span><span class="tag ${v.cls}">${v.label}</span><button class="btn sm" id="capPrint">${ic("print")} Print business case</button></div>
    <div class="sub">Does the workforce fit the layout? Every line of the maths is shown. Values are pre‑filled from this cycle; edit any of them to run a what‑if — <b>nothing here changes the roster</b>.</div>
    <div class="sub" style="margin-top:8px"><b>1 · Cover needed</b></div>
    <div class="row" style="align-items:flex-end">
      <label class="field"><span class="lbl">Zones (AM)</span>${f("capZA",inp.zonesAM)}</label>
      <div class="field" role="group" aria-labelledby="lbl-g4"><span class="lbl" id="lbl-g4">Cover / zone AM min–max</span><span style="display:flex;gap:4px;align-items:center">${f("capMinA",inp.minAM,1,56,"AM minimum per zone")}–${f("capMaxA",inp.maxAM,1,56,"AM maximum per zone")}</span></div>
      <label class="field"><span class="lbl">Zones (PM)</span>${f("capZP",inp.zonesPM)}</label>
      <div class="field" role="group" aria-labelledby="lbl-g6"><span class="lbl" id="lbl-g6">Cover / zone PM min–max</span><span style="display:flex;gap:4px;align-items:center">${f("capMinP",inp.minPM,1,56,"PM minimum per zone")}–${f("capMaxP",inp.maxPM,1,56,"PM maximum per zone")}</span></div>
    </div>
    <div class="sub" style="margin-top:8px"><b>2 · Staff available</b></div>
    <div class="row" style="align-items:flex-end">
      <label class="field"><span class="lbl">Total EFT ${inp.eft!==inp.eftActual?`<span class="muted">(roster has ${nm(inp.eftActual)})</span>`:`<span class="muted">(${nm(inp.headcount)} people)</span>`}</span>${f("capEft",inp.eft,0.1,80)}</label>
      <label class="field"><span class="lbl">Shifts per full‑timer / week</span>${f("capSpw",inp.spw,0.5,70)}</label>
    </div>
    <div class="sub" style="margin-top:8px"><b>3 · Buffer</b> <span class="muted">— weeks per person per year realistically away</span></div>
    <div class="row" style="align-items:flex-end">
      <label class="field"><span class="lbl">Annual leave</span>${f("capAL",inp.bufAL,0.5,60)}</label>
      <label class="field"><span class="lbl">Sick / carer's</span>${f("capSick",inp.bufSick,0.5,60)}</label>
      <label class="field"><span class="lbl">CME / study</span>${f("capCME",inp.bufCME,0.5,60)}</label>
      <div class="field" role="group" aria-labelledby="lbl-g12"><span class="lbl" id="lbl-g12">= away</span><div style="height:38px;display:flex;align-items:center"><b>${c.bufFrac}%</b>&nbsp;<span class="muted small">of the workforce at any time</span></div></div>
      ${ovr?`<button class="btn sm" id="capReset">Reset what‑ifs</button>`:""}
    </div>
    <div style="border-top:1px solid var(--line);margin-top:12px;padding-top:12px">
      <div class="sub" style="margin-bottom:6px"><b>The maths</b> (per week)</div>
      <table style="font-size:var(--fs-sm);border-collapse:collapse;width:100%;max-width:640px">
        <tr><td>Shifts needed — <b>minimum</b> cover</td><td style="text-align:right"><b>${c.needMin}</b></td><td class="muted small" style="padding-left:12px">${inp.zonesAM}×${inp.minAM} AM + ${inp.zonesPM}×${inp.minPM} PM, ×7 days</td></tr>
        <tr><td>Shifts needed — <b>full</b> cover</td><td style="text-align:right"><b>${c.needMax}</b></td><td class="muted small" style="padding-left:12px">${inp.zonesAM}×${inp.maxAM} AM + ${inp.zonesPM}×${inp.maxPM} PM, ×7 days</td></tr>
        <tr><td>Shifts your staff can do on paper</td><td style="text-align:right"><b>${c.paper}</b></td><td class="muted small" style="padding-left:12px">${inp.eft} EFT × ${inp.spw} shifts/week</td></tr>
        <tr><td>…that you can actually count on</td><td style="text-align:right"><b>${c.real}</b></td><td class="muted small" style="padding-left:12px">after ${c.bufFrac}% away (leave, sick, CME)</td></tr>
      </table>
    </div>
    <div class="note" style="margin-top:12px;background:${v.cls==="danger"?"var(--gap-bg)":v.cls==="warn"?"var(--warn)":"var(--accent-bg)"}">
      <b>Summary.</b> You need <b>${c.needMin} shifts a week</b> for minimum cover${c.needMax>c.needMin?` (<b>${c.needMax}</b> for full cover)`:""}. Your <b>${inp.eft} EFT</b> can supply about <b>${c.paper}</b> on paper, but with <b>${c.bufFrac}% away</b> you can count on <b>${c.real}</b>.
      That fills <b>${c.fillMin}%</b> of minimum cover${c.shortMin>0?` — about <b>${c.perDayShortMin} uncovered shift${c.perDayShortMin===1?"":"s"} every day</b>`:` with <b>${c.headroom}</b> spare shifts a week`}.
      ${c.eftNeedMinBuf>0?`To run minimum cover without relying on people being un‑sick you need <b>${c.eftNeedMinBuf} more EFT</b> (${c.eftNeedMinRaw>0?c.eftNeedMinRaw+" more if you accept working at zero buffer":"none if you accept working at zero buffer"}).`:`Minimum cover is achievable from the current workforce${c.eftNeedMaxBuf>0?"":" — and so is full cover"}.`}
      ${c.needMax>c.needMin?(c.eftNeedMaxBuf>0?` Full cover (${c.needMax}/week) would need <b>${c.eftNeedMaxBuf} more EFT</b>${c.eftNeedMaxRaw>0?` (${c.eftNeedMaxRaw} at zero buffer)`:""}.`:` Full cover is also within reach.`):""}
      <div class="small" style="margin-top:6px">${v.note}</div>
    </div>
    <div class="grid-tiles" style="margin-top:12px">
      <div class="tile"><div class="k">Fill at minimum</div><div class="v">${c.fillMin}%</div></div>
      <div class="tile"><div class="k">Fill at full</div><div class="v">${c.fillMax}%</div></div>
      <div class="tile"><div class="k">EFT for min cover</div><div class="v">${c.eftReqMin}</div><div class="k">with buffer</div></div>
      <div class="tile"><div class="k">EFT for full cover</div><div class="v">${c.eftReqMax}</div><div class="k">with buffer</div></div>
      ${live?`<div class="tile" ${live.pct>=95?'style="background:var(--gap-bg)"':""}><div class="k">This cycle, as booked</div><div class="v">${live.pct}%</div><div class="k">${live.bookedPW}/wk of ${live.realPW} available</div></div>`:""}
    </div>
    ${live&&live.pct>=95?`<div class="small muted" style="margin-top:6px">${ic("warn")} The booked roster is using ${live.pct}% of what the workforce can realistically supply — one sick call from a gap.</div>`:""}
  ${printFootHTML("Every line of the arithmetic is shown above; change any number in Myrosta to run a what-if — nothing touches the roster.")}</div>`;
}
function brandingCardHTML(){
  const b=S.branding||{}, f=S.features||{};
  const flag=(k,label,hint)=>`<label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" class="featFlag" data-feat="${k}" ${featOn(k)?"checked":""}> ${label}${hint?` <span class="muted small">— ${hint}</span>`:""}</label>`;
  return `<div class="card" id="brandCard">
    <h2>Staff group &amp; branding</h2>
    <div class="sub">How this staff group appears, what its people are called, and which features it uses. Per group — the hospital\u2019s other staff groups are unaffected.</div>
    <div class="row" style="align-items:flex-end;margin-top:6px">
      <label class="field"><span class="lbl">Organisation <span class="muted">(hospital / site)</span></span><input id="brHosp" value="${escapeHTML(b.hospital||"")}" placeholder="e.g. Northern Hospital ED" style="width:190px"></label>
      <label class="field"><span class="lbl">This staff group</span><input id="brName" value="${escapeHTML(b.name||_orgLabel||"")}" placeholder="e.g. Nurses" style="width:170px"></label>
      <label class="field"><span class="lbl">Staff are called <span class="muted">(singular)</span></span><input id="brRole" list="roleSuggest" value="${escapeHTML(ROLE())}" placeholder="consultant" style="width:150px"><datalist id="roleSuggest">${["consultant","doctor","junior doctor","registrar","intern","nurse","midwife","scribe","clerk","paramedic","pharmacist","radiographer","technician","staff member"].map(r=>`<option value="${escapeHTML(r)}"></option>`).join("")}</datalist></label>
      <button class="btn primary" id="brSave">Save group details</button>
    </div>
    <div class="row" style="align-items:center;margin-top:10px;gap:10px"><span class="lbl">Logo</span>${logoOK(b.logo)?`<img src="${b.logo}" alt="" style="height:28px;width:auto;max-width:112px;border-radius:6px">`:`<span class="muted small">None yet — the header shows the Myrosta mark.</span>`}
      <label class="btn sm" style="cursor:pointer">${logoOK(b.logo)?"Replace logo":"Add a logo"}<input type="file" id="brLogo" accept="image/*" class="vh"></label>${logoOK(b.logo)?`<button class="btn sm" id="brLogoRm">Remove logo</button>`:""}
      <span class="muted small">PNG, JPG or SVG · shown in this group\u2019s header, kept small.</span></div>
    <div class="sub" style="margin-top:10px"><b>Features</b></div>
    <div style="display:flex;flex-wrap:wrap">
      ${flag("rosteron","RosterOn payroll export","hide if this organisation doesn't use RosterOn")}
      ${flag("equity","Equity tab","tough‑shift share, visible to all")}
      ${flag("planner","Leave planner tab")}
      ${flag("marketplace","Open‑shift marketplace","also needs its own On switch above")}
      ${flag("cst","Clinical support time (CST)","switch off for groups without it — nurses, scribes, clerks")}
      <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" id="ownHours" ${ownHoursOn()?"checked":""}> Staff may set their own hours <span class="muted small">\u2014 admins can always set a booking\u2019s hours from the cell; this lets staff set their own, at booking and after</span></label>
      <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" id="instantBook" ${instantBookOn()?"checked":""}> Book shifts the moment they tap <span class="muted small">\u2014 on for every group unless you switch it off: the first tap wins and the shift is theirs at once, nothing to confirm. Off, picks wait in a basket until Confirm. Own hours are then changed on the booked shift.</span></label>
    </div>
    ${deptCardHTML()}
    <div class="muted small" style="margin-top:6px">Group id <b>${escapeHTML(_org)}</b>${_orgCount>1?` · you belong to ${_orgCount} staff groups (the Group button in the header)`:""}.</div>
  </div>`;
}
let _setupTab="cycle";   // Settings has two halves: what belongs to this cycle, and what belongs to the staff group
const SETUP_CYCLE=["card-status","card-cycle","card-zones","card-cover","card-rules","card-times","card-oncall","card-fatigue","card-leavecap","card-notice","card-quota","card-mode"];
const SETUP_GROUP=["brandCard","card-tags","clockCard","card-cycles","card-import","card-payroll","card-access","marketCard","capCard","card-danger"];
function setupTabFor(anchor){ return SETUP_GROUP.includes(anchor)?"group":"cycle"; }
function cycH2(t){ return `<h2>${t} <span class="tag muted" title="Applies only to the cycle selected in the header">${escapeHTML(cyLabel(active()))}</span></h2>`; }
function setupIndexHTML(half){
  const items=half==="cycle"?[["card-status","Status"],["card-cycle","Dates"],["card-zones","Zones"],["card-cover","Cover"],["card-rules","Rules"],["card-times","Shift types"],["card-oncall","On-call"],["card-fatigue","Fatigue"],["card-leavecap","Leave cap"],["card-notice","Notice"],["card-quota","Quota"],["card-mode","Mode &amp; method"]]
                            :[["brandCard","Group"],["card-tags","Tags"],["clockCard","Clock"],["card-cycles","Cycles"],["card-import","Import"]].concat(featOn("rosteron")?[["card-payroll","Payroll"]]:[]).concat(cloudOn()?[["card-access","Access"]]:[]).concat(featOn("marketplace")?[["marketCard","Marketplace"]]:[]).concat([["capCard","Capacity"],["card-danger","Danger zone"]]);
  return `<nav class="setidx" aria-label="Settings sections">${items.map(([id,l])=>`<a href="#" data-go="setup||${id}">${l}</a>`).join("")}</nav>`; }
function dangerCardHTML(){ return `<div class="card" id="card-danger" style="border-left:4px solid var(--danger-t)"><h2>Danger zone</h2>
    <div class="sub">Deletes the staff list, every cycle and shift, leave, requests, messages, notifications and the audit log for <b>${escapeHTML(groupName())}</b>. People keep their sign-in, but this group is left empty. There is no undo.</div>
    <div class="flexbtns"><button class="btn danger" id="dangerBtn">Delete all data for ${escapeHTML(groupName())}</button></div><div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="featReviewed">${S.featuresReviewed?ic("check")+" Features reviewed":"Mark features reviewed"}</button></div></div>`; }
function viewSetup(){
  const a=active();
  const ds=datesOf(a.cycle);
  const st=STATUS[a.status];
  const live=S.cycles.filter(c=>!c.archived).sort((x,y)=>x.cycle.start<y.cycle.start?-1:1);
  const archived=S.cycles.filter(c=>c.archived).sort((x,y)=>x.cycle.start<y.cycle.start?1:-1);
  const half=_setupTab==="group"?"group":"cycle";
  const C={
    status:`
  <div class="card" id="card-status">
    <h2>Roster status — ${cyLabel(a)}</h2>
    <div class="sub">Applies to the cycle selected in the header. Each cycle has its own status.</div>
    <div class="row" style="align-items:center">
      <span class="tag ${st.cls}" style="font-size:var(--fs-sm)">${statusLabel(a)}</span>
      <span class="grow"></span>
      ${a.archived?'<span class="muted small">Archived — restore below to edit.</span>':statusActions()}
    </div>
    <div class="note">${isRolling(a)?"<b>Rolling roster:</b> Draft → build &amp; pre-fill · <b>Live</b> → staff add and drop shifts whenever they need to, for as long as this cycle runs. There is no closing round.":"Draft → build &amp; pre-fill · Open → staff self-roster · Closed → locked for review · Published → live for everyone."}${a.archived?"":" Once your next cycle is published you can <b>archive</b> this one — optional, never automatic."}</div>
    ${a.archived?`<div class="flexbtns"><button class="btn sm" data-restore="${a.id}">Restore to live</button></div>`:`<div class="flexbtns"><button class="btn sm" data-archive="${a.id}">Archive this cycle</button></div>`}
  </div>
`,
    cycle:`
  <div class="card" id="card-cycle">
    ${cycH2("Cycle dates")}
    <div class="sub">Start date and length of this cycle.</div>
    <div class="row">
      <label class="field"><span class="lbl">Start date</span><input type="date" id="cycStart" value="${a.cycle.start}" ${canEdit()?"":"disabled"}></label>
      <label class="field"><span class="lbl">Length (weeks)</span><input type="number" id="cycWeeks" min="1" max="26" value="${a.cycle.weeks}" style="width:90px" ${canEdit()?"":"disabled"}></label>
      <button class="btn primary" id="saveCycle" ${canEdit()?"":"disabled"}>Save cycle dates</button>
    </div>
    <div class="note">Selected cycle: <b>${fmt(ds[0],{day:"numeric",month:"short",year:"numeric"})}</b> → <b>${fmt(ds[ds.length-1],{day:"numeric",month:"short",year:"numeric"})}</b> · ${ds.length} days</div>
  </div>`,
    cycles:`
  <div class="card" id="card-cycles">
    <h2>Cycles</h2>
    <div class="sub">Start the next cycle while this one stays live; open, restore or delete earlier ones.</div>
    <div class="flexbtns"><button class="btn sm" id="prepNext">→ Prepare next cycle</button></div>
    <div class="muted small" style="margin-top:6px">Creates a fresh draft starting the day after your latest cycle ends. Current cycle stays live; staff, zones &amp; settings carry over.</div>
    ${live.length>1?`<h3 style="font-size:var(--fs-md);margin:16px 0 6px">Live cycles (${live.length})</h3>`+live.map(c=>`
      <div class="listrow"><span class="grow">${cyLabel(c)} <span class="tag ${STATUS[c.status].cls}" style="font-size:var(--fs-2xs)">${STATUS[c.status].label}</span>${c.id===S.activeId?' <span class="tag brand">selected</span>':""}</span>
        ${c.id===S.activeId?"":`<button class="btn sm" data-select="${c.id}">Open</button>`}${c.status==="draft"?`<button class="btn danger sm" data-deldraft="${c.id}">Delete</button>`:""}</div>`).join(""):""}
    ${archived.length?`<h3 style="font-size:var(--fs-md);margin:16px 0 6px">Previous cycles (${archived.length})</h3>`+archived.map(c=>`
      <div class="listrow"><span class="grow">${cyLabel(c)} <span class="tag muted" style="font-size:var(--fs-2xs)">archived</span></span>
        <button class="btn sm" data-select="${c.id}">View</button>
        <button class="btn sm" data-restore="${c.id}">Restore</button>
        <button class="btn danger sm" data-del="${c.id}">Delete</button></div>`).join(""):""}
  </div>
`,
    import:`
  <div class="card" id="card-import">
    <h2>Import data</h2>
    <div class="sub">Upload your organisation's Excel templates — the app reads them as-is and normalises codes. Roster → adds a new cycle. Leave planner → merges leave + EFT/hours. EFT tracker → sets EFT, hours and employee numbers (which feed the payroll export).</div>
    <div class="row">
      <div class="field"><label class="lbl" for="impStaff">Staff list (.xlsx)</label><input type="file" id="impStaff" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("staff")}</div></div>
      <div class="field"><label class="lbl" for="impRoster">Roster template (.xlsx)</label><input type="file" id="impRoster" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("roster")}</div></div>
      <div class="field"><label class="lbl" for="impLeave">Leave planner (.xlsx)</label><input type="file" id="impLeave" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("leave")}</div><label class="muted small" style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" id="impLeaveAny"> Treat any filled cell as unavailable</label></div>
      <div class="field"><label class="lbl" for="impEft">EFT tracker (.xlsx)</label><input type="file" id="impEft" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("eft")}</div></div>
    </div>
    <div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="dlStaffTpl">${ic("download")} Staff template</button><button class="btn sm" id="expEft">${ic("download")} Export EFT tracker</button></div>
    <div class="muted small" style="margin-top:6px">EFT tracker auto-detects the unit (EFT fraction or hours/week), uses the week matching this cycle, and matches ${ROLES()} by employee # or surname. Tip: import the cleaned copy for best results. Needs internet (loads the spreadsheet reader).</div>
  </div>
`,
    payroll:`
  <div class="card" id="card-payroll">
    <h2>Payroll export (RosterOn)</h2>
    <div class="sub">Roster tab → <b>Export…</b> → <b>Payroll file for RosterOn</b> builds a one-row-per-shift file. Upload RosterOn's import template here and the app exports in <b>its exact columns</b>. No template = a standard layout.</div>
    <div class="row">
      <label class="field"><span class="lbl">RosterOn template (.csv / .xlsx)</span><input type="file" id="payTpl" accept=".csv,.xlsx,.xls"></label>
      <label class="field"><span class="lbl">Date format</span><select id="payDateFmt">${DATE_FORMATS.map(f=>`<option value="${f[0]}" ${(S.payrollDateFmt||"DD/MM/YYYY")===f[0]?"selected":""}>${f[0]} — ${f[1]}</option>`).join("")}</select></label>
    </div>
    ${S.payrollTemplate&&S.payrollTemplate.headers&&S.payrollTemplate.headers.length?`
    <div class="note" style="margin-top:10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <b>Using template:</b> ${escapeHTML(S.payrollTemplate.filename||"uploaded")} <span class="tag ok">${S.payrollTemplate.headers.length} columns</span>
        <span class="grow"></span>
        <button class="btn sm" id="payTplClear">Clear template</button>
      </div>
      <div class="sub" style="margin:10px 0 0">Map each RosterOn column to the roster data that fills it — auto-detected, adjust any that are wrong.</div>
      <table class="maptbl"><tr><th>RosterOn column</th><th>Filled with</th></tr>
      ${S.payrollTemplate.headers.map((h,i)=>`<tr><td>${escapeHTML(h||"(blank)")}</td><td>
        <select class="payMap" data-col="${i}"><option value="">— leave blank —</option>${PAYROLL_FIELDS.map(f=>`<option value="${f[0]}" ${((S.payrollTemplate.map||[])[i]===f[0])?"selected":""}>${f[1]}</option>`).join("")}</select>
      </td></tr>`).join("")}
      </table>
    </div>`:`<div class="muted small" style="margin-top:6px">No template uploaded — export uses standard columns: Employee No, Surname, Given Name, Date, Shift Code, Start, End, Hours, Unit, Notes.</div>`}
    <div class="muted small" style="margin-top:8px">Shift types for this cycle: ${shiftTypesOf(active()).filter(t=>t.on!==false&&t.derived!=="oncall").map(t=>escapeHTML(t.label)+" "+typeTime(t)+((t.fills||[]).length>1?" (whole day)":"")).join(" · ")}${ocWindows(active()).length?" · On call: "+ocWindows(active()).map(w=>escapeHTML(w.label)+" "+ocTime(w)).join(" · "):""} · Leave = 8h × EFT. Edit in This cycle → <a href="#" data-go="setup||card-times">Shift types</a>.</div>
  </div>
`,
    access:`
  ${cloudOn()?`<div class="card" id="card-access">
    <h2>Access control (cloud)</h2>
    <div class="sub">Who is allowed to sign in and reach the database. Allowed email domains: <b>${(CLOUD.allowedDomains||[]).join(", ")||"any (set CLOUD.allowedDomains)"}</b>.</div>
    <div class="flexbtns"><button class="btn" id="memSync">Sync allow-list from staff + admins</button><button class="btn" id="memInvite" data-invite="1">Invite your ${escapeHTML(ROLES())}</button></div>
    <h3 style="font-size:var(--fs-md);margin:14px 0 6px">Allow-list members (${_members.length})</h3>
    ${_members.length?_members.map(m=>{const cfg=(CLOUD.adminEmails||[]).map(x=>String(x).toLowerCase()).includes(String(m.email).toLowerCase());const isAdm=m.role==="admin";const sms=/@sms\.local$/i.test(m.email||"");const disp=sms?("+"+(m.phone||(m.email||"").split("@")[0])):m.email;return `<div class="listrow"><span class="grow">${sms?ic("phone")+" ":""}${escapeHTML(disp)}${m.name?' · '+escapeHTML(m.name):""} <span class="tag ${isAdm?"ok":"muted"}">${escapeHTML(m.role||"staff")}</span>${sms?' <span class="tag muted" title="Signs in by SMS only — no email on file">SMS</span>':""}${cfg?' <span class="tag muted" title="Admin via app config — always admin">config</span>':""}</span>${cfg?"":`<button class="btn sm" data-memrole="${escapeHTML(m.email)}" data-memto="${isAdm?"staff":"admin"}" data-memname="${escapeHTML(m.name||"")}">${isAdm?"Make staff":"Make admin"}</button>`}<button class="btn danger sm" data-memrm="${escapeHTML(m.email)}">Remove</button></div>`;}).join(""):'<div class="muted">No members yet — click Sync to add your staff + admins, then only they can access the data.</div>'}
    <div class="muted small" style="margin-top:14px"><b>Add by email</b> — grant access to someone who isn't a rostered clinician (e.g. an IT or admin-only account). For doctors and coordinators, add them in the <b>Staff</b> tab (set coordinators to <b>Non-clinical / admin</b>) and click <b>Sync</b> instead — that keeps their name, mobile and SMS sign-in in step. A login alone gives no access until the person is on this list.</div>
    <div class="row" style="align-items:flex-end;margin-top:8px">
      <label class="field" style="flex:1;min-width:180px"><span class="lbl">Email</span><input id="memEmail" placeholder="person@hospital..."></label>
      <label class="field"><span class="lbl">Role</span><select id="memRole"><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
      <button class="btn primary" id="memAdd">Add</button>
    </div>
    <div class="muted small" style="margin-top:6px">Run the SQL in SUPABASE.md first to create the table + database rules. The database then blocks anyone not on this list — even if they have a login.</div>
    <h3 style="font-size:var(--fs-md);margin:16px 0 6px">Shared / public computers</h3>
    <div class="sub">At sign-in, staff can tick <b>“This is a shared or public computer”</b>. Those sessions don't stay logged in — they end when the page closes and after this idle time. Personal phones are unaffected (they stay signed in).</div>
    <div class="row" style="align-items:flex-end;margin-top:8px">
      <label class="field"><span class="lbl">Auto-logout after idle (shared only)</span><input type="number" min="1" max="240" id="secIdle" value="${(S.security&&S.security.sharedIdleMin)||15}" style="width:90px"> <span class="muted small">minutes</span></label>
    </div>
  </div>`:""}
`,
    zones:`
  <div class="card" id="card-zones">
    ${cycH2("Zones")}
    <div class="sub">Each zone is one slot per period per day. Add or remove to match your department. Tick which periods it runs in; PM label is optional. The short name, up to five letters, is what the phone\u2019s month view shows (blank means the automatic one: Resus, Paeds, FT). Which zone\u2019s evening carries on-call is set on the <b>On-call</b> card.</div>
    <div id="zoneList"></div>
    <div class="flexbtns"><button class="btn sm" id="addZone">+ Add zone</button></div>
  </div>
`,
    times:`
  <div class="card" id="card-times">
    ${cycH2("Shift types")}
    <div class="sub">What a person can be on for <b>in this cycle</b> — the name your group uses for it, its hours, and which half of the day it covers. Booking, payroll and RosterOn exports, calendar files, reminders and the safe-hours rules all read these. The day\u2019s two halves are always on; anything else can be switched off. A type that covers <b>both halves</b> is a full shift: one booking, one person, the whole day.</div>
    <div id="typeRows">${shiftTypesOf(active()).map((t,i)=>t.derived==="oncall"?"":typeRowHTML(t,i)).join("")}</div>
    <div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="addShiftType">+ Add a shift type</button><span class="grow"></span><button class="btn primary sm" id="saveShiftTimes">Save shift types</button></div>
  </div>
`,
    fatigue:`
  <div class="card" id="card-fatigue">
    ${cycH2("Fatigue &amp; safe hours")}
    <div class="sub">Safety guardrails checked at booking time (self-roster and admin assign). <b>Warn</b> allows the shift but flags it; <b>Block</b> stops staff (admins can still override, with a warning). Off by default.</div>
    ${(()=>{const f=effFatigue();return `<div class="row" style="align-items:flex-end">
      <div class="field" role="group" aria-labelledby="lbl-ftSeg"><span class="lbl" id="lbl-ftSeg">Rule mode</span><div class="seg" id="ftSeg" aria-labelledby="lbl-ftSeg"><button data-ft="off" class="${f.mode==="off"?"on":""}">Off</button><button data-ft="warn" class="${f.mode==="warn"?"on":""}">Warn</button><button data-ft="block" class="${f.mode==="block"?"on":""}">Block</button></div></div>
      <label class="field"><span class="lbl">Min rest between shifts (h)</span><input type="number" min="0" max="24" step="0.5" id="ftRest" value="${f.minRest}" style="width:90px"></label>
      <label class="field"><span class="lbl">Max consecutive clinical days</span><input type="number" min="0" max="14" id="ftConsec" value="${f.maxConsec}" style="width:90px"></label>
      <button class="btn primary sm" id="saveFatigue">Save fatigue rules</button></div>
      <div class="muted small" style="margin-top:6px">Rest is measured from the true end of the previous shift, and on-call windows that count toward rest count here too: a window that follows a shift runs that shift through to the window\u2019s end. Set a value to 0 to disable that rule.</div>`;})()}
  </div>
`,
    cover:`
  <div class="card" id="card-cover">
    ${cycH2("Staff required per shift")}
    <div class="sub">${hasExtraSlots()?`Minimums fill first; extra slots (up to max) unlock only after both minimums are met. You choose the order extras open — currently <b>${unlockOrderLabel()}</b>. `:`Minimum equals maximum, so every slot is required cover — there are no extra slots to unlock. `}<b>These settings apply to this cycle only</b> — changing them won't touch other (e.g. published) cycles.</div>
    <div class="row">
      <label class="field"><span class="lbl">AM minimum</span><input type="number" min="0" id="amMin" value="${effStaffing().amMin}" style="width:80px"></label>
      <label class="field"><span class="lbl">AM maximum</span><input type="number" min="0" id="amMax" value="${effStaffing().amMax}" style="width:80px"></label>
      <label class="field"><span class="lbl">PM minimum</span><input type="number" min="0" id="pmMin" value="${effStaffing().pmMin}" style="width:80px"></label>
      <label class="field"><span class="lbl">PM maximum</span><input type="number" min="0" id="pmMax" value="${effStaffing().pmMax}" style="width:80px"></label>
      <button class="btn primary" id="saveStaffing">Save cover</button>
    </div>
    <div class="row" style="margin-top:4px">
      <div class="field" role="group" aria-labelledby="lbl-uoSeg"><span class="lbl" id="lbl-uoSeg">Extra slots open</span>
        <div class="seg" id="uoSeg" aria-labelledby="lbl-uoSeg">
          <button data-uo="both" class="${effUnlock()==="both"?"on":""}">AM &amp; PM together</button>
          <button data-uo="amfirst" class="${effUnlock()==="amfirst"?"on":""}">AM before PM</button>
          <button data-uo="pmfirst" class="${effUnlock()==="pmfirst"?"on":""}">PM before AM</button>
        </div></div>
    </div>
    <div class="note">Min/max set how many can work each period; "Extra slots open" sets whether AM or PM extras (above the minimum) unlock first — different departments prefer different orders. Max can't exceed zones for that period (AM zones: ${zonesFor("AM").length}, PM zones: ${zonesFor("PM").length}).</div>
  </div>
`,
    notice:`
  <div class="card" id="card-notice">
    ${cycH2("Notice to come off a shift")}
    <div class="sub">How close to a shift someone may still take themselves off it. Inside the notice period they hand it to a colleague or ask you \u2014 outside it they can drop it, and it goes to the group as an open shift either way. <b>0 turns it off</b>, which is how every group starts.</div>
    <div class="row">
      <label class="field"><span class="lbl">Notice (days)</span><input type="number" step="1" min="0" max="365" id="noticeDays" value="${effNotice(active())}" style="width:90px"></label>
      <button class="btn primary" id="saveNotice">Save notice period</button>
    </div>
    ${effNotice(active())>0&&!(featOn("marketplace")&&S.marketOn)?`<div class="note">${ic("lock")} Open shifts is off for this group, so a shift someone comes off has nowhere to go. Turn it on under Group \u2192 Open shifts.</div>`:""}
  </div>
`,
    oncall:`
  <div class="card" id="card-oncall">
    ${cycH2("On-call")}
    <div class="sub">On-call is its own roster, not a shift. Whoever carries a window is <b>not</b> counted as cover and takes no zone, so it can never hide a gap \u2014 and the same person may work the floor and carry a window later the same day. A window people take has one person a day. Add as many windows as your group runs. A window is either <b>taken</b> by a person, or <b>follows</b> the ${escapeHTML(perName("PM"))} shift in the zones you tick \u2014 whoever works that evening carries it, and nobody takes it by hand. Or its hours are <b>chosen when booked</b>: a call-in, logged once someone has been called in, with the hours they worked, and as many people a day as are called in.</div>
    ${!Array.isArray(cset().oncallWindows)&&ocWindows(active()).length?`<div class="muted small" style="margin-top:6px">Worked out from the zones this cycle already marks as carrying on-call. Save to keep it as it is, or change it here.</div>`:""}
    <div id="ocRows">${ocCardRows()}</div>
    <div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="addOncall">+ Add an on-call window</button><span class="grow"></span><button class="btn primary sm" id="saveOncall">Save on-call windows</button></div>
  </div>
`,
    leavecap:`
  <div class="card" id="card-leavecap">
    ${cycH2("Leave capacity")}
    <div class="sub">Maximum total EFT allowed on leave on any single day. The leave planner flags days over this, and approvals warn when exceeded.</div>
    <div class="row">
      <label class="field"><span class="lbl">Max EFT on leave / day</span><input type="number" step="0.1" min="0" id="leaveCap" value="${S.leaveCapEft}" style="width:90px"></label>
      <button class="btn primary" id="saveLeaveCap">Save leave cap</button>
    </div>
  </div>
`,
    quota:`
  <div class="card" id="card-quota">
    ${cycH2("Quota &amp; fairness")}
    <div class="sub">Clinical-shift quota is counted and capped per this period (default <b>fortnight</b> — matches pay). The <b>Cycle</b> tab sets each ${ROLE()}'s total shifts for the cycle; the other tabs split it <b>evenly</b> across periods so they add up. <b>Edit any cell to adjust; clear it to revert to auto.</b></div>
    <div class="row">
      <div class="field" role="group" aria-labelledby="lbl-qpSeg"><span class="lbl" id="lbl-qpSeg">Count quota per</span>
        <div class="seg" id="qpSeg" aria-labelledby="lbl-qpSeg">
          <button data-qp="cycle" class="${S.quotaPeriod==="cycle"?"on":""}">Cycle</button>
          <button data-qp="week" class="${S.quotaPeriod==="week"?"on":""}">Week</button>
          <button data-qp="fortnight" class="${S.quotaPeriod==="fortnight"?"on":""}">Fortnight</button>
          <button data-qp="month" class="${S.quotaPeriod==="month"?"on":""}">Month</button>
        </div></div>
      <div class="field" role="group" aria-labelledby="lbl-qcSeg"><span class="lbl" id="lbl-qcSeg">Per-period cap</span>
        <div class="seg" id="qcSeg" aria-labelledby="lbl-qcSeg">
          <button data-qc="hard" class="${S.quotaCapMode==="hard"?"on":""}">Hard (block)</button>
          <button data-qc="soft" class="${S.quotaCapMode==="soft"?"on":""}">Soft (flag)</button>
          <button data-qc="off" class="${S.quotaCapMode==="off"?"on":""}">Off</button>
        </div></div>
      <div class="field" role="group" aria-labelledby="lbl-qfSeg"><span class="lbl" id="lbl-qfSeg">Uneven extra shift</span>
        <div class="seg" id="qfSeg" aria-labelledby="lbl-qfSeg">
          <button data-qf="locked" class="${S.quotaFlex?"":"on"}">Auto‑placed</button>
          <button data-qf="flex" class="${S.quotaFlex?"on":""}">Staff choose</button>
        </div></div>
    </div>
    ${featOn("cst")?`<div class="row" style="align-items:flex-end;margin-top:8px"><label class="field"><span class="lbl">${escapeHTML(cstLabel())} days per fortnight (default)</span><input type="number" min="0" step="1" id="cstDefault" value="${(cset().cstPerFortnight!=null&&cset().cstPerFortnight!=="")?cset().cstPerFortnight:""}" placeholder="none" style="width:90px"></label><span class="muted small">For anyone whose own ${escapeHTML(cstLabel())} / cycle box on the Staff tab is blank \u2014 ${cstDefaultQuota()||"no"} ${escapeHTML(cstLabel())} day${cstDefaultQuota()===1?"":"s"} this cycle. 0 in a person's box means no cap.</span></div>
    <div class="seg" id="qtSeg" style="margin-top:8px" role="group" aria-label="Which quota the table shows"><button data-qt="clinical" class="${_qtView==="cst"?"":"on"}">Clinical</button><button data-qt="cst" class="${_qtView==="cst"?"on":""}">${escapeHTML(cstLabel())}</button></div>`:""}
    ${S.quotaFlex?`<div class="note" style="margin-top:8px">${ic("scale")} <b>Flexible extra is on.</b> When a ${ROLE()}'s cycle quota doesn't divide evenly, each ${periodTag().toLowerCase()} runs at the even base, and they place the leftover shift(s) in whichever ${periodTag().toLowerCase()} suits — total still capped at their cycle quota, and they can't double up the extra. ${S.quotaCapMode!=="hard"?`<span class="muted">(This only blocks when <b>Per-period cap = Hard</b>; you're on <b>${S.quotaCapMode}</b>.)</span>`:""}</div>`:""}
    ${S.staff.length?((featOn("cst")&&_qtView==="cst")?cstQuotaTableHTML():(()=>{const isCycle=S.quotaPeriod==="cycle";const ps=cyclePeriods();
      const head=`<tr><th>${ROLEC()}</th>${isCycle?`<th class="num">Cycle quota</th>`:ps.map(p=>`<th class="num">${p.label}</th>`).join("")+`<th class="num">Cycle</th>`}</tr>`;
      const rows=rosterStaff().map(s=>{if(isCycle){return `<tr><td class="namecol">${escapeHTML(s.name)}</td><td class="num"><input type="number" min="0" class="qt-quota" data-sid="${s.id}" value="${s.quota||0}"></td></tr>`;}
        const hasOv=s.periodTargets&&Object.keys(s.periodTargets).length;
        if(S.quotaFlex&&!hasOv){ const ci=periodCapInfo(s), cell=ci.r>0?(ci.floor+"–"+ci.ceil):(""+ci.floor), pt=periodTag().toLowerCase();
          return `<tr><td class="namecol">${escapeHTML(s.name)}</td>${ps.map(()=>`<td class="num" style="color:var(--muted)" title="${ci.r>0?("Even base "+ci.floor+", up to "+ci.ceil+" if this "+pt+" carries one of the "+ci.r+" extra shift(s)"):("Even — "+ci.floor+" each "+pt)}">${cell}</td>`).join("")}<td class="num"><b>${ci.q}</b></td></tr>`; }
        const t=periodTargetsOf(s),tot=t.reduce((a,b)=>a+b,0),q=s.quota||0,off=tot!==q;
        return `<tr><td class="namecol">${escapeHTML(s.name)}</td>${t.map((v,i)=>{const ov=s.periodTargets&&s.periodTargets[i]!=null&&s.periodTargets[i]!=="";return `<td class="num"><input type="number" min="0" class="qt-cell" data-sid="${s.id}" data-pi="${i}" value="${v}" aria-label="${escapeHTML(s.name)} · ${escapeHTML((cyclePeriods()[i]||{}).label||("period "+(i+1)))}" style="${ov?"font-weight:600;color:var(--accent-ink)":""}"></td>`;}).join("")}<td class="num"><b class="qt-total" style="${off?"color:var(--danger-t)":""}" title="${off?("Periods add to "+tot+" but cycle quota is "+q):""}">${off?tot+" / "+q:tot}</b></td></tr>`;}).join("");
      const foot=isCycle?'<span class="muted small">Set the total shifts each ${ROLE()} does this cycle (auto from EFT — edit to round). The Week / Fortnight / Month tabs split it across periods.</span>'
        :(S.quotaFlex?'<span class="muted small">Each '+periodTag().toLowerCase()+' shows the base–ceiling. Staff place any leftover (uneven) shift in the '+periodTag().toLowerCase()+' that suits them. Switch <b>Uneven extra shift</b> back to <b>Auto‑placed</b> to set fixed per‑'+periodTag().toLowerCase()+' targets you can edit.</span>'
        :'<button class="btn sm" id="qtReset">Reset all to auto</button> <span class="muted small">Periods auto-split the cycle quota evenly — edit any cell; the Cycle total turns red if they stop adding up.</span>');
      return `<div style="overflow-x:auto;margin-top:6px"><table class="maptbl">${head}${rows}</table></div><div class="flexbtns" style="margin-top:8px">${foot}</div>`;
    })()):'<div class="muted small" style="margin-top:6px">Add staff to set quotas.</div>'}
  </div>
`,
    mode:`
  <div class="card" id="card-mode">
    ${cycH2("Roster mode")}
    <div class="sub">How this staff group runs its roster. Per cycle — different groups, and different cycles, can run differently.</div>
    <div class="seg" id="modeSeg">
      <button data-rm="rounds" class="${!isRolling()?"on":""}">Rounds (open → close → publish)</button>
      <button data-rm="rolling" class="${isRolling()?"on":""}">Rolling (always live)</button>
    </div>
    <div class="sub" style="margin-top:6px">${isRolling()
      ? "<b>Rolling.</b> You go live once and the roster stays live. Staff add or drop their own shifts whenever they need to — good for small teams and for groups that fill shifts as they come up. Set a booking window below if you want to limit <i>when</i> they may do that; the roster stays visible either way."
      : "<b>Rounds.</b> You release the roster, everyone books during the round, you close it and publish. Best when people should book together and fairly against the same open slots — and the only mode that supports In random groups and Take turns."}</div>
    <h2 style="margin-top:16px">Self-roster method</h2>
    <div class="sub">How shifts are claimed during self-rostering. All methods keep the guards: taken slots disappear, ${hasExtraSlots()?`extra slots open only after minimums (${unlockOrderLabel()}), `:""}and bookings respect each ${ROLE()}'s per-${S.quotaPeriod||"fortnight"} quota.</div>
    <div class="seg" id="fairSeg">
      <button data-f="guarded" class="${S.fairness==="guarded"?"on":""}">${fairnessLabel("guarded")} <span class="muted small">${fairnessTech("guarded")}</span></button>
      <button data-f="waves" class="${S.fairness==="waves"?"on":""}" ${isRolling()?'disabled title="In random groups needs a round with a start and an end — switch to Rounds mode to use it"':""}>${fairnessLabel("waves")} <span class="muted small">${fairnessTech("waves")}</span></button>
      <button data-f="snake" class="${S.fairness==="snake"?"on":""}" ${isRolling()?'disabled title="Take turns needs a round with a start and an end — switch to Rounds mode to use it"':""}>${fairnessLabel("snake")} <span class="muted small">${fairnessTech("snake")}</span></button>
      <button data-f="adjust" class="${S.fairness==="adjust"?"on":""}">${fairnessLabel("adjust")} <span class="muted small">${fairnessTech("adjust")}</span></button>
    </div>
    ${isRolling()?`<div class="muted small" style="margin-top:6px">In random groups and Take turns need a round with a start and an end — switch to Rounds mode to use them.</div>`:""}
    <div class="sub" style="margin-top:8px">
      ${S.fairness==="waves"?"<b>In random groups:</b> staff are split into random groups and each group books in turn; the order is re-drawn each cycle. Good when a few people always book first.":
        S.fairness==="adjust"?"<b>Pre-filled, then adjust:</b> you draft a fair, covered roster first, then open it so staff drop, claim and swap within their share. Best when the roster is mostly settled.":
        S.fairness==="snake"?"<b>Take turns:</b> strict turns that reverse each round, so no one is always last. Slowest, and the most even.":
        "<b>Everyone at once:</b> everyone books at the same time, first-come, within the guards. Best for small teams who trust first-come."}
    </div>
    ${S.fairness==="waves"?`<div class="row" style="margin-top:8px"><div class="field" role="group" aria-labelledby="lbl-wcSeg"><span class="lbl" id="lbl-wcSeg">Number of groups</span>
      <div class="seg" id="wcSeg" aria-labelledby="lbl-wcSeg">${[2,3,4].map(n=>`<button data-wc="${n}" class="${(S.waveCount||3)===n?"on":""}">${n}</button>`).join("")}</div></div></div>`:""}
  </div>`
  };
  const seg=`<div class="seg setupseg" id="setupSeg"><button data-st="cycle" class="${half==="cycle"?"on":""}">This cycle · ${escapeHTML(cyLabel(a))}</button><button data-st="group" class="${half==="group"?"on":""}">This staff group · ${escapeHTML(groupName())}</button></div>`;
  const body=half==="cycle"?[C.status,C.cycle,C.zones,C.cover,rulesCardHTML(),C.times,C.oncall,C.fatigue,C.leavecap,C.notice,C.quota,C.mode].join(""):[brandingCardHTML(),tagsCardHTML(),clockCardHTML(),C.cycles,C.import,(featOn("rosteron")?C.payroll:""),C.access,(featOn("marketplace")?marketCardHTML():""),capacityCardHTML(),dangerCardHTML(),clockPosterHTML()].join("");
  return `
  ${S.guideDismissed?'<div style="margin-bottom:8px"><button class="btn sm" id="guideShow">'+ic("chevR")+' Setup guide</button></div>':setupGuideHTML()}
  ${seg}${setupIndexHTML(half)}${body}`;
}
let _zt=null; function zonesSavedToast(){ markAnswered("zones"); clearTimeout(_zt); _zt=setTimeout(()=>toastSaved("cycle"),600); }
function renderZoneList(){
  const el=document.getElementById("zoneList");if(!el)return;
  el.innerHTML=S.zones.map(z=>`
    <div class="listrow" data-z="${z.id}">
      <input class="z-name" value="${escapeHTML(z.name)}" style="width:120px" placeholder="Name" aria-label="Zone name">
      <input class="z-short" value="${escapeHTML(z.short||"")}" placeholder="${escapeHTML(zoneShort(z))}" maxlength="5" style="width:64px" aria-label="Short name, up to five letters, for the phone’s month view" title="Short name for the phone’s month view (up to five letters); blank means the automatic one">
      <label><input type="checkbox" class="z-am" ${z.am?"checked":""}> AM</label>
      <label><input type="checkbox" class="z-pm" ${z.pm?"checked":""}> PM</label>
      <input class="z-pml" value="${z.pmLabel||""}" placeholder="PM label (opt)" style="width:130px" aria-label="PM label (optional)">${ocWindows(active()).some(w=>w.from&&(w.from.zones||[]).indexOf(z.id)>=0)?'<span class="tag oc" title="Set on the On-call card">carries on-call</span>':""}
      <span class="grow"></span>
      <button class="btn danger sm z-del">Remove</button>
    </div>`).join("");
  el.querySelectorAll("[data-z]").forEach(rowEl=>{
    const id=rowEl.dataset.z; const z=zoneById(id);
    rowEl.querySelector(".z-name").onchange=e=>{ocPin(active());z.name=e.target.value;save();zonesSavedToast();renderZoneList();};
    rowEl.querySelector(".z-short").onchange=e=>{ const v=String(e.target.value||"").trim().slice(0,5); if(v)z.short=v; else delete z.short; save(); zonesSavedToast(); renderZoneList(); };
    rowEl.querySelector(".z-am").onchange=e=>{z.am=e.target.checked;save();zonesSavedToast();};
    rowEl.querySelector(".z-pm").onchange=e=>{z.pm=e.target.checked;save();zonesSavedToast();render();};   // the On-call card only offers zones that run in the evening
    rowEl.querySelector(".z-pml").onchange=e=>{ocPin(active());z.pmLabel=e.target.value;save();zonesSavedToast();};
    rowEl.querySelector(".z-del").onclick=()=>{ocPin(active());rulesDropZone(active(),id);cset().zones=(cset().zones||S.zones).filter(x=>x.id!==id);S.zones=cset().zones;save();render();};
  });
}

let _staffQuery="", _staffFilter="all", _staffTag="";   // device-side: the Staff tab's search box and filter
let _qtView="clinical";   // device-side: which quota the Quota & fairness table shows — clinical | cst
function staffFiltered(q,f,tag){ q=String(q||"").trim().toLowerCase(); f=f||"all";
  const list=S.staff.filter(s=>{
    if(tag&&tagById(S,tag)&&!hasTag(S,s,tag))return false;   // a filter for a tag that has gone shows everyone
    if(f==="in"&&!inCycle(s))return false; if(f==="out"&&inCycle(s))return false;
    if(f==="nologin"&&(s.email||s.email2||s.mobile))return false; if(f==="fixed"&&s.mode!=="fixed")return false; if(f==="none"&&s.mode!=="none")return false;
    if(!q)return true; return [s.name,s.initials,s.email,s.email2,s.mobile,s.payrollId].some(v=>String(v||"").toLowerCase().indexOf(q)>=0); });
  return list.sort((a,b)=>{ const A=splitName(a.name), B=splitName(b.name); return (A.sur.localeCompare(B.sur,undefined,{sensitivity:"base"}))||(A.giv.localeCompare(B.giv,undefined,{sensitivity:"base"})); }); }
function staffRowHTML(s){
    const open=_staffOpen.has(s.id);
    const nonClin=s.mode==="none";
    const inCyc=inCycle(s);
    const showRole=inCyc&&!nonClin;
    const mode={self:"Self-roster",fixed:"Fixed pattern",preference:"Pref + auto-draft",none:"No shifts (coordinator / office)"}[s.mode]||s.mode;
    const committed=s.fixedPattern&&s.fixedPattern.committed, pending=S.requests.find(r=>r.type==="fixed"&&r.from===s.id&&r.status==="pending");
    const contact=s.email2||s.mobile||s.email||"";   // default to personal email / mobile; only show what exists
    const noContact=!s.email&&!s.email2&&!s.mobile;
    const meta=(showRole?[mode,"Quota "+s.quota].concat((featOn("cst")&&cstQuotaOf(s)>0)?[cstLabel()+" "+cstQuotaOf(s)]:[]).concat(["EFT "+(+s.eft||0).toFixed(2)]):[mode]).concat(contact?[contact]:[]).join(" · ");
    return `
    <div class="staffitem" data-s="${s.id}" style="${inCyc?"":"opacity:.6"}">
      <div class="staffsum">
        <button class="ctl stoggle" data-stoggle="${s.id}" aria-expanded="${open?"true":"false"}"${open?` aria-controls="sd-${s.id}"`:""}><span class="chev">${open?ic("chevD"):ic("chevR")}</span>
        <span class="snm">${escapeHTML(s.name)}<span class="tag brand mini">${escapeHTML(s.initials||"")}</span></span>
        <span class="smeta">${escapeHTML(meta)}${tagChipsAll(s)}${noContact?' <span class="tag warn" title="No email or mobile — this person cannot sign in and will not sync to the allow-list">no login</span>':""}${inCyc?"":' <span class="tag muted" title="On the staff list but not rostered in the selected cycle">not in this cycle</span>'}</span></button>
        <span class="grow"></span>
        ${inCyc?"":`<button class="btn primary sm s-addcyc" data-sid="${s.id}">+ Add to this cycle</button>`}
      </div>
      ${open?`<div class="staffdetail" id="sd-${s.id}"><div class="sd-grid">
        <label>Name<input class="s-name" value="${escapeHTML(s.name)}"></label>
        <label>Initials<input class="s-init" value="${escapeHTML(s.initials||"")}"></label>
        <label>Title / role<input class="s-title" value="${escapeHTML(s.title||"")}" placeholder="e.g. Medical Specialist"></label>
        <label>Mobile<input class="s-mob" value="${escapeHTML(s.mobile||"")}" placeholder="—"></label>
        <label>Rostering mode<select class="s-mode"><option value="self" ${s.mode==="self"?"selected":""}>Self-roster</option><option value="fixed" ${s.mode==="fixed"?"selected":""}>Fixed pattern</option><option value="preference" ${s.mode==="preference"?"selected":""}>Pref + auto-draft</option><option value="none" ${nonClin?"selected":""}>No shifts (coordinator / office)</option></select></label>
        <label>Work email<input class="s-email" value="${escapeHTML(s.email||"")}" placeholder="—"></label>
        <label>Alt / personal email<input class="s-email2" value="${escapeHTML(s.email2||"")}" placeholder="—"></label>
        ${showRole?`<label>Quota / cycle<input type="number" class="s-quota" value="${s.quota}"></label>
        <label>EFT<input type="number" step="0.01" class="s-eft" value="${(+s.eft||0).toFixed(2)}"></label>
        <label>Hours / fortnight<input type="number" step="0.01" class="s-hrs" value="${(+s.hrsFortnight||0).toFixed(2)}"></label>${featOn("cst")?`<label>${escapeHTML(cstLabel())} / cycle<input type="number" min="0" class="s-cst" value="${(s.cstQuota!=null&&s.cstQuota!=="")?s.cstQuota:""}" placeholder="${cstDefaultQuota()?("default "+cstDefaultQuota()):"no cap"}" title="Blank uses the default from Quota &amp; fairness; 0 means no cap"></label>`:""}`:""}
        <label>Payroll #<input class="s-pay" value="${escapeHTML(s.payrollId||"")}" placeholder="—"></label>
      </div>${!inCyc?`<div class="muted small" style="margin-top:8px">Not rostered in <b>${escapeHTML(cyLabel(active()))}</b>. Their name, contacts and other cycles are kept — click <b>+ Add to this cycle</b> to roster them here (quota/EFT set per cycle).</div>`:nonClin?`<div class="muted small" style="margin-top:8px">Non-clinical — no clinical shifts, quota, EFT or pattern. They won't appear in the roster, self-roster or planner. Add an email so they can sign in${(CLOUD.adminEmails||[]).length?", then make them an admin in <b>Settings → Access control</b> if they coordinate the roster.":"."}</div>`:`<div class="muted small" style="margin-top:8px">In <b>${escapeHTML(cyLabel(active()))}</b>. Quota/EFT/hours apply to this cycle only. <button class="btn sm s-rmcyc" data-sid="${s.id}" style="margin-left:4px">Remove from this cycle</button> <span class="muted">— keeps them on the staff list and in other cycles.</span></div>`}
      ${tagList(S).length?`<div style="margin-top:8px"><span class="lbl">Tags</span> ${tagList(S).map(t=>`<label style="margin-right:10px"><input type="checkbox" class="s-tag" data-t="${t.id}" ${hasTag(S,s,t.id)?"checked":""}> ${escapeHTML(t.name)}</label>`).join("")}</div>`:""}
      ${isAdmin()?`<label class="field" style="display:block;margin-top:8px"><span class="lbl" style="display:block;margin-bottom:4px">Job description</span><textarea class="s-notes" rows="3" placeholder="Bespoke considerations for the roster \u2014 only admins see this" style="width:100%;max-width:560px;font:inherit">${escapeHTML(s.notes||"")}</textarea></label>`:""}
      <div class="flexbtns" style="margin-top:10px">${(inCyc&&!nonClin)?`<button class="btn sm s-fp" data-sid="${s.id}">Pattern${committed?" "+ic("lock"):""}${pending?" "+ic("flag"):""}</button>`:""}<button class="btn primary sm s-save" data-sid="${s.id}">Save changes</button><span class="grow"></span><button class="btn danger sm s-del">Remove from staff list</button></div>
      </div>`:""}
      ${_fpOpen.has(s.id)?fixedPatternEditorHTML(s,true,false):""}
    </div>`;}
function staffListHTML(){ const list=staffFiltered(_staffQuery,_staffFilter,_staffTag); if(!S.staff.length)return '<div class="muted small">Nobody on the list yet — upload the template above, or add someone below.</div>';
  return `<div class="muted small" id="staffCount" style="margin-bottom:6px">Showing ${list.length} of ${S.staff.length}</div>`+(list.length?list.map(staffRowHTML).join(""):'<div class="muted small">No one matches.</div>'); }
function recordImport(kind,file,summary){ if(!S.lastImport)S.lastImport={}; S.lastImport[kind]={ts:Date.now(),file:String(file||""),summary:String(summary||"")}; }
function lastImportLine(kind){ const r=S.lastImport&&S.lastImport[kind]; if(!r)return ""; return "Last: "+escapeHTML(r.file)+" · "+tsFmt(r.ts)+(r.summary?" · "+escapeHTML(r.summary):""); }
function exportMenuHTML(){   // one Export button, one plain description per file
  const rows=[["rosXls","Roster as Excel","The grid as you see it, with colours — for printing or sharing."],["rosCsv","Roster as CSV","The same grid without colours — one row per person, a column per day. Opens anywhere."]]
    .concat(featOn("rosteron")?[["rosPay","Payroll file for RosterOn","One row per shift with times and hours, in your payroll template's columns."],["rosRon","RosterOn workbook","A readable roster sheet plus a one-row-per-shift data sheet."]]:[])
    .concat([["expEftM","EFT tracker","EFT for everyone in this cycle, one column per week, in the tracker's layout."]])
    .concat((clockOn()||Object.keys(active().clock||{}).length)?[["expClock","Clock report","One row per clocked shift: rostered, clocked, flags and the decision."]]:[]);
  return `<div class="overlay" id="ovlExport"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h3 id="dlgT">Export ${escapeHTML(cyLabel(active()))}</h3>
    <div style="margin-top:8px">${rows.map(([id,t,d])=>`<button class="exrow" id="${id}"><b>${ic("download")} ${t}</b><span class="muted small">${d}</span></button>`).join("")}</div>
    <div class="muted small" style="margin-top:10px">${featOn("rosteron")?`<a href="#" data-go="setup||card-payroll">Configure the payroll template</a> · `:""}<a href="#" id="exClose">Close</a></div></div></div>`; }
function openExportMenu(){ const root=openDialog(exportMenuHTML());
  const bind=(id,fn)=>{ const el=document.getElementById(id); if(el)el.onclick=()=>{ closeModal(); fn(); }; };
  bind("rosXls",exportRosterXLS); bind("rosCsv",exportRosterCSV); bind("rosPay",exportPayrollCSV); bind("rosRon",exportRosterOn); bind("expEftM",exportEftTracker); bind("expClock",exportClockCSV);
  const c=document.getElementById("exClose"); if(c)c.onclick=e=>{ e.preventDefault(); closeModal(); };
  root.querySelector("#ovlExport").onclick=e=>{ if(e.target.id==="ovlExport")closeModal(); };
  root.querySelectorAll("[data-go]").forEach(b=>b.onclick=e=>{ e.preventDefault(); closeModal(); const g=parseGo(b.dataset.go); go(g.tab,{cycle:g.cycle,anchor:g.anchor}); }); }
function viewStaff(){
  const junk=S.staff.filter(s=>!isNameCell(s.name));
  return `<div class="card">
    <h2>Staff <span class="muted small">(${S.staff.length})</span></h2>
    <div class="sub">Add / remove staff, set rostering mode and clinical-shift quota (from EFT). Import from your template lands here next.</div>
    ${junk.length?`<div class="note" style="border-left:4px solid var(--danger-t);margin-bottom:8px">${ic("warn")} ${junk.length} row${junk.length>1?"s":""} look like spreadsheet labels, not people: <b>${junk.map(s=>escapeHTML(s.name)).join(", ")}</b>. <button class="btn sm" id="tidyStaff" style="margin-left:6px">${ic("clean")} Remove ${junk.length>1?"them":"it"}</button></div>`:""}
    <div class="stafftools"><input id="staffSearch" type="search" placeholder="Search name, email, mobile…" value="${escapeHTML(_staffQuery)}" aria-label="Search staff">
      <div class="seg" id="staffFilterSeg">${[["all","All"],["in","In this cycle"],["out","Not in cycle"],["nologin","No login"],["fixed","Fixed pattern"],["none","Non-clinical"]].map(([k,l])=>`<button data-sf="${k}" class="${_staffFilter===k?"on":""}">${l}</button>`).join("")}</div>${tagList(S).length?`<select id="staffTagSel" aria-label="Tag"><option value="">Any tag</option>${tagList(S).map(t=>`<option value="${t.id}" ${_staffTag===t.id?"selected":""}>${escapeHTML(t.name)}</option>`).join("")}</select>`:""}</div>
    <div class="sub" style="margin-bottom:2px">Tap a name to expand and edit their details — fields save as you leave them.</div>
    <div id="staffList">${staffListHTML()}</div>
    <div class="flexbtns"><button class="btn sm" id="addStaff">+ Add staff</button></div>
  </div>`;
}

let _gapsOpen=false;   // device-side: the short-slot list above the roster grid
function shortSlots(){   // every (day, period) below the minimum for the active cycle, with the free zones it could be filled into; from today onward, every tag rule the day breaks
  const st=effStaffing(), out=[], today=iso(new Date()), cyc=active(); if(!S.staff.length)return out;
  cycleDates().forEach(d=>{ const isoD=iso(d); const {am,pm}=clinicalCounts(isoD,null);
    [["AM",am,st.amMin],["PM",pm,st.pmMin]].forEach(([p,have,min])=>{ const need=Math.max(0,min-have); if(!need)return;
      out.push({iso:isoD,period:p,have,min,need,zones:freeZones(isoD,p),ph:isPH(isoD)}); });
    if(isoD>=today)ruleBreaches(cyc,S,isoD).forEach(b=>{ if(b.kind==="min")out.push({kind:"min",iso:isoD,period:b.period,have:b.have,min:b.need,need:b.need-b.have,tag:b.tag,zones:freeZones(isoD,b.period),ph:isPH(isoD)});
      else out.push({kind:"needs",iso:isoD,period:b.period,have:0,min:0,need:1,tag:b.tag,sid:b.sid,zone:b.zone,zones:[],ph:isPH(isoD)}); }); });
  return out; }
function gapsPanelHTML(){
  const slots=shortSlots(); const canCast=isAdmin()&&featOn("marketplace")&&S.marketOn;
  if(!slots.length)return `<div class="card" id="gapsPanel"><h2>Short slots <span class="tag ok">none</span></h2><div class="sub">Every day meets its minimum cover.</div></div>`;
  const rows=slots.map(sl=>{ const posted=osActive().some(o=>o.iso===sl.iso&&o.period===sl.period&&o.status==="open"); const z0=sl.zones[0], tagRow=!!sl.kind;   // a tag row: Assign opens the day; only a cover row can be broadcast
    return `<div class="gaprow"><span class="gapd"><b>${fmtISO(sl.iso)}</b>${sl.ph?' <span class="tag ph mini">PH</span>':""}</span><span class="tag lg ${sl.period==="AM"?"am":"pm"}">${sl.period}</span><span class="gapn">${gapRowText(sl)}</span><span class="muted small gapz">${sl.kind==="needs"?"":(sl.zones.length?sl.zones.map(z=>escapeHTML(z.name)).join(", ")+" free":"no free zone")}</span><span class="grow"></span>
      ${(sl.zones.length||tagRow)?`<button class="btn sm" data-gapassign="${sl.iso}">Assign…</button>${canCast&&z0&&!tagRow?(posted?`<span class="tag ok">${ic("check")} broadcast</span>`:`<button class="btn sm" data-gapcast="${sl.iso}|${sl.period}|${z0.id}">Broadcast</button>`):""}`:`<span class="muted small">No zone runs this period — <a href="#" data-go="setup||card-zones">add a zone</a> or <a href="#" data-go="setup||card-cover">lower the minimum</a>.</span>`}</div>`; }).join("");
  const foot=canCast?"":`<div class="muted small" style="margin-top:8px">Broadcast to the group needs the marketplace — <a href="#" data-go="setup||marketCard">turn it on in Settings</a>.</div>`;
  return `<div class="card" id="gapsPanel"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h2>Short slots <span class="tag danger">${slots.reduce((a,x)=>a+x.need,0)}</span></h2><span class="grow"></span><button class="btn sm" id="gapsClose">Close</button></div>
    <div class="sub">Each row is a day and period below its minimum${rulesPresent(active())?", or short of a tag its rules ask for":""}. Assign opens that day; Broadcast posts the first free zone as an open shift.</div>${rows}${foot}</div>`;
}
function dayGap(isoD){const {am,pm}=clinicalCounts(isoD,null);return {am:Math.max(0,effStaffing().amMin-am),pm:Math.max(0,effStaffing().pmMin-pm)};}
function ragFor(isoD){const {am,pm}=clinicalCounts(isoD,null);const aM=effStaffing().amMin,pM=effStaffing().pmMin;if(am<aM||pm<pM)return"r";if(isoD>=iso(new Date())&&ruleBreaches(active(),S,isoD).length)return"r";if(am===aM||pm===pM)return"a";return"g";}   // from today onward a tag shortfall is a gap; past days are never re-judged
function ragColor(x){return x==="r"?"var(--rag-r)":x==="a"?"var(--rag-a)":"var(--rag-g)";}
function isMobile(){return window.matchMedia("(max-width:640px)").matches;}
function pageHead(title,sub){ return isMobile()?`<header class="ph"><h1>${title}</h1>${sub?`<div class="phsub">${sub}</div>`:""}</header>`:""; }   // phones: the screen's title sits above the cards, once; desktop keeps the card's own heading
function cardTitle(html){ return isMobile()?"":`<h2>${html}</h2>`; }
function groupName(){ return (S.branding&&S.branding.name)||_orgLabel||""; }
function viewRosterMobile(){   // phones: one accordion per week, the current week open, one control per day
  const ds=cycleDates(), todayISO=iso(new Date());
  let redD=0,ambD=0; ds.forEach(d=>{const r=ragFor(iso(d));if(r==="r")redD++;else if(r==="a")ambD++;});
  const statusPill=!S.staff.length?"":(redD?(isAdmin()?`<button class="tag danger gapsbtn" id="gapsBtn" aria-expanded="${_gapsOpen?"true":"false"}">${redD} day${redD>1?"s":""} need cover · ${_gapsOpen?"hide":"fix"}</button>`:`<span class="tag danger">${redD} day${redD>1?"s":""} need cover</span>`):(ambD?`<span class="tag warn">${ambD} at minimum</span>`:`<span class="tag ok">Fully covered</span>`));
  const card=d=>{
    const isoD=iso(d), we=[0,6].includes(d.getDay());
    const {am,pm}=clinicalCounts(isoD,null), r=ragFor(isoD);
    const amok=am>=effStaffing().amMin, pmok=pm>=effStaffing().pmMin;
    const amL=[],pmL=[],cstL=[],lvL=[],_cyD=active();
    rosterStaff().forEach(s=>{const sh=getShift(s.id,isoD);
      if(sh.kind==="clinical"){const z=zoneById(sh.zone);const _f=fillsOf(_cyD,sh),_full=_f.length>1;
        _f.forEach(f=>{const zl=z?zoneLabel(z,f):"?";(f==="AM"?amL:pmL).push(zl+" — "+s.name+(_full?" ("+typeLabelOf(_cyD,sh)+")":"")+ownHoursTag(_cyD,sh));});}
      else if(sh.kind==="cst")cstL.push(s.name);
      else if(sh.kind==="leave")lvL.push(s.name+" ("+sh.code+")");});
    const sec=(lab,cls,arr,sep)=>arr.length?`<li class="rsec"><span class="tag solid ${cls} rlab">${lab}</span><span class="rval">${arr.map(escapeHTML).join(sep)}</span></li>`:"";
    const none=(amL.length||pmL.length||cstL.length||lvL.length)?"":`<li class="rsec"><span class="rval muted">Nobody yet — ${escapeHTML(perName("AM"))} needs ${effStaffing().amMin}, ${escapeHTML(perName("PM"))} needs ${effStaffing().pmMin}</span></li>`;
    const title=`${DOW[d.getDay()]} ${d.getDate()} ${fmt(d,{month:"short"})}${phBadge(isoD)}${isoD===todayISO?' <span class="tag solid brand mini">Today</span>':""}${r==="r"?' <span class="tag danger">Needs cover</span>':""}`;
    const cover=`<span class="rcov"><span style="color:${amok?"var(--am-t)":"var(--danger-t)"}">AM ${am}/${effStaffing().amMin}${amok?"":" short"}</span> · <span style="color:${pmok?"var(--pm-t)":"var(--danger-t)"}">PM ${pm}/${effStaffing().pmMin}${pmok?"":" short"}</span></span>`;
    const head=canEdit()?`<button class="rcard-h ctl" data-day="${isoD}"><b>${title}</b>${cover}<span class="vh">. Open to assign</span></button>`:`<div class="rcard-h"><b>${title}</b>${cover}</div>`;
    return `<li class="rcard${we?" we":""}${r==="r"?" under":""}${isoD===todayISO?" today":""}${isPH(isoD)?" ph":""}">${head}<ul class="rsecs">${sec(escapeHTML(perName("AM")),"am",amL," · ")}${sec(escapeHTML(perName("PM")),"pm",pmL," · ")}${featOn("cst")?sec(escapeHTML(typeById(_cyD,"CST")?typeById(_cyD,"CST").label:"CST"),"cst",cstL,", "):""}${sec("Leave","lv",lvL,", ")}${none}</ul></li>`; };
  const weeks=[]; for(let k=0;k<ds.length;k+=7)weeks.push(ds.slice(k,k+7));
  const cur=weeks.findIndex(w=>w.some(d=>iso(d)===todayISO));
  const acc=weeks.map((w,k)=>{ const red=w.filter(d=>ragFor(iso(d))==="r").length, amb=w.filter(d=>ragFor(iso(d))==="a").length;
    const tag=!S.staff.length?"":(red?`<span class="tag danger">Needs cover · ${red}</span>`:(amb?`<span class="tag warn">at minimum · ${amb}</span>`:`<span class="tag ok">Fully covered</span>`));
    const open=(cur<0&&k===0)||k===cur;
    return `<details class="hd wk" data-wk="${k}"${open?" open":""}><summary><span>Week ${k+1} · ${escapeHTML(fmtISO(iso(w[0])))} – ${escapeHTML(fmtISO(iso(w[w.length-1])))}</span>${tag}</summary><ul class="rlist">${w.map(card).join("")}</ul></details>`; }).join("");
  const todayChip=cur>=0?`<button class="btn sm" id="todayChip">Today</button>`:"";
  return `${pageHead("Roster",rosterStaff().length+" "+escapeHTML(rosterStaff().length===1?ROLE():ROLES())+" · week by week")}<div class="card" style="padding:14px">
    ${archiveBanner()}
    <div class="cluster">${cardTitle("Roster")}${statusPill}${todayChip}</div>
    <div class="sub">Day‑by‑day view for phones, a week at a time. ${canEdit()?"Tap a day to assign shifts on the Daily screen.":"Read‑only."} The full grid shows on a larger screen.</div>
    ${S.staff.length?acc:noOneHTML()}
    ${isAdmin()?`<div class="flexbtns" style="margin-top:12px"><button class="btn sm" id="rosExport">Export…</button></div>`:""}
  </div>`;
}
function dayHeadHTML(d,badge){ return `<div class="dayname">${DOW[d.getDay()]}</div><div class="daynum">${d.getDate()}${badge||""}</div><div class="mo muted">${fmt(d,{month:"short"})}</div>`; }   // a grid's day column: weekday, day, month — the month on every column (9 Oct 2026), so a column read on its own still says when it is
function viewRoster(){
  if(isMobile())return viewRosterMobile();
  const ds=cycleDates();
  let totalGap=0;
  const fxOn=fixedView&&isAdmin(), proj=fxOn?fixedProjection(active(),fixedSoft):null, stats=fxOn?fixedCoverStats(active(),proj):null, drift=fxOn?fixedDrift(active(),proj):null;   // the Fixed cover view: the patterns' own placement stands in for the roster
  const cc=isoD=>fxOn?{am:stats.per[isoD].AM,pm:stats.per[isoD].PM}:clinicalCounts(isoD,null);
  const gapOf=isoD=>{ if(!fxOn)return dayGap(isoD); const {am,pm}=cc(isoD); return {am:Math.max(0,effStaffing().amMin-am),pm:Math.max(0,effStaffing().pmMin-pm)}; };
  const ragOf=isoD=>{ if(!fxOn)return ragFor(isoD); const {am,pm}=cc(isoD); return (am<effStaffing().amMin||pm<effStaffing().pmMin)?"r":"g"; };
  const _ps=((S.quotaPeriod||"fortnight")==="week")?[]:cyclePeriods(), fnStart={}; if(_ps.length>1)_ps.forEach(pp=>{ fnStart[pp.from]=1; });   // the quota periods as bands: fortnights (or months) the share is counted in; a weekly share already has the week rule
  const _pn=(S.quotaPeriod==="month")?"Month":(S.quotaPeriod==="fortnight"?"Fortnight":"Period"), _dm=d=>fmt(d,{day:"numeric",month:"short"});
  const fnrow=_ps.length>1?`<tr class="fnrow"><th class="corner namecol">${escapeHTML(_pn)}</th>`+_ps.map((pp,i)=>`<th class="fn" colspan="${pp.dates.length}">${escapeHTML(_pn+" "+(i+1)+" \u00b7 "+_dm(pp.dates[0])+" \u2013 "+_dm(pp.dates[pp.dates.length-1]))}</th>`).join("")+`</tr>`:"";
  const colgroup=`<colgroup><col style="width:164px">${ds.map(()=>`<col style="width:72px">`).join("")}</colgroup>`;   // fixed layout takes its widths from here, not from the band's merged cells
  const head=`<tr><th class="corner namecol">${escapeHTML(ROLEC())}</th>`+ds.map((d,di)=>{
    const we=[0,6].includes(d.getDay());const g=dayGap(iso(d));const isGap=g.am>0||g.pm>0;
    const gc=gapsOn?(isGap?"gaphdr":"dimcol"):(we?"we":"");
    const _pd=iso(d);
    return `<th class="${gc}${d.getDay()===1?" mon":""}${fnStart[_pd]?" fnstart":""}${_pd===iso(new Date())?" todaycol":""}${isPH(_pd)?" phhdr":""}${isAdmin()?" phclick":""}"${isAdmin()?` data-phd="${_pd}" title="${isPH(_pd)?"Public holiday — click to unmark":"Click to mark as public holiday"}"`:""}>${dayHeadHTML(d,phBadge(_pd))}</th>`;
  }).join("")+`</tr>`;
  const caprow=`<tr class="coverrow"><th class="namecol" style="font-weight:500;color:var(--muted);font-size:var(--fs-2xs)">Cover · ${escapeHTML(perName("AM"))} / ${escapeHTML(perName("PM"))}</th>`+ds.map(d=>{
    const isoD=iso(d);const {am,pm}=cc(isoD);const we=[0,6].includes(d.getDay());
    const g=gapOf(isoD);const isGap=g.am>0||g.pm>0;totalGap+=g.am+g.pm;
    const amok=am>=effStaffing().amMin, pmok=pm>=effStaffing().pmMin;
    const cls=gapsOn?(isGap?"gapcell":"dimcol"):(we?"we":"");
    const bar=`<div style="height:3px;border-radius:2px;background:${ragColor(ragOf(isoD))};margin:1px 5px 3px"></div>`;
    const inner=(gapsOn&&isGap)
      ? bar+`<div class="cap"><b>need ${[g.am?"AM "+g.am:"",g.pm?"PM "+g.pm:""].filter(Boolean).join(", ")}</b></div>`
      : bar+`<div class="cap"><span style="color:${amok?"var(--am-t)":"var(--danger-t)"}"><b>${am}</b></span> / <span style="color:${pmok?"var(--pm-t)":"var(--danger-t)"}"><b>${pm}</b></span>${(amok&&pmok)?"":`<span class="capwarn" aria-label="short" role="img" title="${amok?"":"AM short"}${(!amok&&!pmok)?", ":""}${pmok?"":"PM short"}">${ic("warn")}</span>`}</div>`;
    return `<td class="${cls}${d.getDay()===1?" mon":""}${fnStart[isoD]?" fnstart":""}">${inner}</td>`;
  }).join("")+`</tr>`;
  let redD=0,ambD=0; ds.forEach(d=>{const r=ragFor(iso(d));if(r==="r")redD++;else if(r==="a")ambD++;});
  const statusPill=!S.staff.length?"":(redD?(isAdmin()?`<button class="tag danger gapsbtn" id="gapsBtn" aria-expanded="${_gapsOpen?"true":"false"}">${redD} day${redD>1?"s":""} need cover · ${_gapsOpen?"hide":"fix"}</button>`:`<span class="tag danger">${redD} day${redD>1?"s":""} need cover</span>`):(ambD?`<span class="tag warn">${ambD} at minimum</span>`:`<span class="tag ok">Fully covered</span>`));
  const editable=canEdit();
  const hlTarget=isAdmin()?_hlStaff:S.viewAs;   // staff (or admin viewing-as) auto-highlights their own row; admin clicks a name
  const dayNames=ds.map(d=>fmtISO(iso(d)));   // one label per day, not per cell
  const body=rosterStaff().map(s=>{
    return `<tr class="${s.id===hlTarget?"rowhl":""}"><td class="namecol${isAdmin()?" hlname":""}"><span class="nm" title="${escapeHTML(s.name)}">${isAdmin()?`<button class="ctl namecol-btn" data-hl="${s.id}" aria-pressed="${s.id===hlTarget?"true":"false"}" title="Highlight this row">${escapeHTML(s.name)}</button>`:escapeHTML(s.name)}</span><span class="tag ${({self:"brand",fixed:"mode-fixed",preference:"mode-preference"})[s.mode]||"brand"}" title="${({self:"Self-rosters: books their own shifts",fixed:"Fixed pattern: their fixed shifts are placed before the round",preference:"Preference pattern: placed first, but open to change"})[s.mode]}">${({self:"self",fixed:"fixed",preference:"preference"})[s.mode]}</span></td>`+ds.map((d,di)=>{
      const isoD=iso(d);const sh=getShift(s.id,isoD);const we=[0,6].includes(d.getDay());
      const g=gapOf(isoD);const isGap=g.am>0||g.pm>0;
      const gc=gapsOn?(isGap?(we?"we":""):"dimcol"):(we?"we":"");
      const _cyG=active(), _ocTxt=ocLine(_cyG,s.id,isoD);
      if(fxOn){ const e=proj[s.id+"|"+isoD]; return `<td class="${gc}${d.getDay()===1?" mon":""}${fnStart[isoD]?" fnstart":""}" data-s="${s.id}" data-d="${isoD}"><span class="cellbtn ghostwrap">${e?`<span class="tag lg fxghost${e.soft?" soft":""}" title="${escapeHTML(s.name+" · "+(e.soft?"draft or preference pattern":"locked fixed pattern"))}">${escapeHTML(e.period==="CST"?fpSlotLabel(e):(e.zone?zoneName(e.zone):"any")+" "+fpSlotLabel(e))}</span>`:""}</span></td>`; }
      const tip=cellTip(sh,s.name,d,_ocTxt);
      const _ocm=ocMark(_cyG,s.id,isoD,true);
      return `<td class="${editable?"cell":""} ${gc}${d.getDay()===1?" mon":""}${fnStart[isoD]?" fnstart":""}" data-s="${s.id}" data-d="${isoD}"${tip?` title="${escapeHTML(tip)}"`:""}>${editable?`<button class="cellbtn" data-s="${s.id}" data-d="${isoD}" aria-label="${escapeHTML(tip||(s.name+" · "+dayNames[di]+" · Off"))}">${cellChip(sh,"grid")}${_ocm}${sh.note?'<span class="noteflag" aria-label="Has a note" role="img">'+ic("edit")+'</span>':""}</button>`:(cellChip(sh)+_ocm+(sh.note?'<span class="noteflag" aria-label="Has a note" role="img">'+ic("edit")+'</span>':""))}</td>`;
    }).join("")+`</tr>`;
  }).join("");
  return `<div class="card" style="padding:14px 14px 10px">
    ${archiveBanner()}
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <h2>Roster grid</h2>${statusPill}<span class="grow"></span>
      <button class="btn sm ${gapsOn?"primary":""}" id="gapsToggle">${gapsOn?ic("check")+" Gaps ("+totalGap+" short)":"Show gaps"}</button>
      ${isAdmin()?`<button class="btn sm ${fxOn?"primary":""}" id="fixedToggle" aria-pressed="${fxOn?"true":"false"}">${fxOn?ic("check")+" Fixed cover":"Fixed cover"}</button>`:""}
      ${isAdmin()?`<button class="btn sm" id="rosExport">Export…</button>`:""}
    </div>
    ${fxOn?`<div class="sub">Fixed cover: what the patterns alone would place in this cycle \u2014 no bookings, leave or swaps \u2014 ghosted so it is never mistaken for the roster. The cover row counts it against the minimum.</div><label class="muted small" style="display:flex;gap:6px;align-items:center;margin:4px 0 8px"><input type="checkbox" id="fixedSoft" ${fixedSoft?"checked":""}> Include draft and preference patterns (softer: not locked)</label>`:`<div class="sub">${editable?"Click any cell to assign. ":"Read-only. "}Capacity-aware: a zone taken by one person is disabled for everyone else${hasExtraSlots()?`; extra slots stay locked until minimums are met (${unlockOrderLabel()})`:""}.</div>`}
    ${(editable||fxOn)?"":lockNote()}
    ${S.staff.length?"":noOneHTML()}
    ${editable&&!fxOn&&needsComment()?`<div class="note">${ic("edit")} This roster is <b>Published</b> — edits are allowed but need a comment, are logged, and show on hover (cells with a change have a dot).</div>`:""}
    <div class="gridscroll"><table class="roster fixedcols">${colgroup}<thead>${fnrow}${head}${caprow}</thead><tbody>${body}</tbody></table></div>
    ${fxOn?`<h3 class="hsec" style="margin-top:14px">Weekday summary</h3><div class="sub">For each day of the week and half: how many of the cycle\u2019s dates the patterns cover to the minimum (${stats.amMin} AM, ${stats.pmMin} PM), the zones they hold, and the shortfall \u2014 the recruiting brief.</div>
    <table class="maptbl"><tr><th>Day</th><th>Half</th><th>Covered to minimum</th><th>Shortfall</th><th>Zones held</th></tr>${stats.rows.map(r=>`<tr><td>${DOW[r.wd]}</td><td>${r.half}</td><td>${r.covered} of ${r.dates}</td><td>${r.short?r.short+" shift"+(r.short>1?"s":""):"\u2014"}</td><td>${escapeHTML(r.zones.join(", ")||"\u2014")}</td></tr>`).join("")}</table>
    <h3 class="hsec" style="margin-top:14px">Drift this cycle</h3><div class="sub">${drift.total?`${drift.changed} of ${drift.total} locked fixed shifts differ from the pattern in the roster now${drift.changed?" \u2014 "+Object.keys(drift.byWd).map(k=>drift.byWd[k]+" on "+k).join(", "):""}. Structural cover minus drift is what you can rely on.`:"No locked fixed shifts in this cycle."}</div>
    ${drift.items.length?`<table class="maptbl"><tr><th>Who</th><th>Date</th><th>Pattern</th><th>Roster now</th></tr>${drift.items.slice(0,60).map(i=>`<tr><td>${escapeHTML(nameOf(i.sid))}</td><td>${escapeHTML(fmtISO(i.iso))}</td><td>${escapeHTML(i.was)}</td><td>${escapeHTML(i.now)}</td></tr>`).join("")}</table>${drift.items.length>60?`<div class="muted small">\u2026and ${drift.items.length-60} more in the export.</div>`:""}`:""}
    <div class="flexbtns" style="margin-top:10px"><button class="btn sm" id="fixedXlsx">${ic("download")} Fixed cover as Excel</button></div>`:""}
    <div class="flexbtns" style="margin-top:12px;align-items:center">${legend()}<span style="width:1px;height:14px;background:var(--line2);margin:0 4px"></span><span class="muted small" style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:var(--rag-g)"></span>covered</span><span class="muted small" style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:var(--rag-a)"></span>at minimum</span><span class="muted small" style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:50%;background:var(--rag-r)"></span>under‑staffed</span></div>
  </div>`;
}
function viewDaily(){
  if(dailyScope==="dept"&&deptOn())return deptBoardHTML();
  const ds=cycleDates();
  if(!dailyDate||!ds.some(d=>iso(d)===dailyDate)){const _t=iso(new Date());dailyDate=ds.some(d=>iso(d)===_t)?_t:iso(ds[0]);}
  const nav=`<div class="row" style="align-items:center;margin-top:4px">
    <button class="btn sm" id="dPrev" aria-label="Previous day">${ic("chevL")}</button>
    <input type="date" id="dDate" value="${dailyDate}" min="${iso(ds[0])}" max="${iso(ds[ds.length-1])}" aria-label="Day">
    <button class="btn sm" id="dNext" aria-label="Next day">${ic("chevR")}</button>${phBadge(dailyDate)}${isAdmin()?`<button class="btn sm" id="dPH">${isPH(dailyDate)?ic("x")+" Unmark public holiday":ic("holiday")+" Mark public holiday"}</button>`:""}<span class="grow"></span>
    ${scopeSegHTML()}<div class="seg"><button class="${dailyMode==="day"?"on":""}" data-dm="day">Day</button><button class="${dailyMode==="week"?"on":""}" data-dm="week">Week</button></div>
  </div>`;
  if(dailyMode==="week"){
    const idx=ds.findIndex(x=>iso(x)===dailyDate);const wk=Math.floor(idx/7);const wd=ds.slice(wk*7,wk*7+7);
    const hdr=`<tr><th class="namecol">Zone</th>`+wd.map(d=>`<th class="${[0,6].includes(d.getDay())?"we":""}">${dayHeadHTML(d)}</th>`).join("")+`</tr>`;
    const rows=p=>zonesFor(p).map(z=>`<tr><td class="namecol"><span class="tag lg ${p==="AM"?"am":"pm"}">${escapeHTML(zoneLabel(z,p))}</span></td>`+wd.map(d=>{const s=staffInZone(iso(d),p,z.id);return `<td>${s?s.initials:'<span class="muted">·</span>'}</td>`;}).join("")+`</tr>`).join("");
    return `<div class="card">${archiveBanner()}<h2>Daily roster — week ${wk+1}</h2>
      <div class="sub">Who's on each zone, ${fmt(wd[0])} – ${fmt(wd[6])}.</div>${nav}
      <div class="gridscroll" style="margin-top:12px"><table class="roster"><thead>${hdr}</thead><tbody>${rows("AM")}${rows("PM")}</tbody></table></div>
      <div class="flexbtns" style="margin-top:12px">${legend()}</div></div>`;
  }
  const d=parseISO(dailyDate);const {am,pm}=clinicalCounts(dailyDate,null);
  const cst=staffByKind(dailyDate,"cst"),leave=staffByKind(dailyDate,"leave");
  const board=p=>zonesFor(p).map(z=>{const s=staffInZone(dailyDate,p,z.id);
    return `<div class="listrow"><span class="tag lg ${p==="AM"?"am":"pm"}" style="min-width:62px;text-align:center">${zoneLabel(z,p)}</span><span class="grow">${s?escapeHTML(s.name+ownHoursTag(active(),getShift(s.id,dailyDate)))+tagChipsHTML(s)+clockMarkHTML(active(),s.id,dailyDate):'<span class="muted">— vacant</span>'}</span></div>`;}).join("");
  const assignList=(canEdit()&&isMobile())?`<h3 style="margin:18px 0 4px;font-size:var(--fs-md)">Assign shifts</h3><div class="sub" style="margin-bottom:4px">Tap a ${ROLE()} to set their zone, ${featOn("cst")?"CST, ":""}leave or off for this day.</div>`+rosterStaff().map(s=>{const sh=getShift(s.id,dailyDate);return `<button class="listrow assignrow ctl" data-s="${s.id}">${cellChip(sh)||'<span class="full-cell"><span class="tag lg muted">Off</span></span>'}<span class="grow">${escapeHTML(s.name)}${tagChipsHTML(s)}</span><span class="muted chev">${ic("chevR")}</span></button>`;}).join(""):"";
  return `<div class="card">${archiveBanner()}<h2>Daily roster</h2>
    <div class="sub">${d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>${nav}
    <h3 style="margin:16px 0 4px;font-size:var(--fs-md)">${escapeHTML(perName("AM"))} ${periodTime("AM")} <span class="tag ${(am>=effStaffing().amMin&&!ruleChip(dailyDate,"AM"))?"ok":"warn"}">${am} on · min ${effStaffing().amMin}${ruleChip(dailyDate,"AM")}</span></h3>${board("AM")}${sibLinesHTML(dailyDate,"AM")}
    ${(()=>{ const _c=active(), dISO=dailyDate, ws=ocTakenWindows(_c).filter(w=>ocHolder(_c,dISO,w.id)), cis=ciOnDay(_c,dISO);
      return (ws.length||cis.length)?`<h3 style="margin:16px 0 4px;font-size:var(--fs-md)">On call</h3>${ws.map(w=>`<div class="listrow"><span class="tag oc" style="min-width:62px;text-align:center">${escapeHTML(w.label)}</span><span class="grow">${escapeHTML(nameOf(ocHolder(_c,dISO,w.id)))}</span><span class="muted small">${ocTime(w)}</span></div>`).join("")}${cis.map(x=>`<div class="listrow"><span class="tag oc" style="min-width:62px;text-align:center">${escapeHTML(x.w.label)}</span><span class="grow">${escapeHTML(nameOf(x.sid))}</span><span class="muted small">Called in ${ocTime(x.w)}</span></div>`).join("")}`:""; })()}
    <h3 style="margin:16px 0 4px;font-size:var(--fs-md)">${escapeHTML(perName("PM"))} ${periodTime("PM")} <span class="tag ${(pm>=effStaffing().pmMin&&!ruleChip(dailyDate,"PM"))?"ok":"warn"}">${pm} on · min ${effStaffing().pmMin}${ruleChip(dailyDate,"PM")}</span></h3>${board("PM")}${sibLinesHTML(dailyDate,"PM")}
    ${(featOn("cst")&&cst.length)?`<h3 style="margin:16px 0 4px;font-size:var(--fs-md)">Clinical support time (CST)</h3><div>${cst.map(s=>`<span class="tag lg cst" style="margin:2px 4px 2px 0;display:inline-block">${escapeHTML(s.name)}</span>`).join("")}</div>`:""}
    ${leave.length?`<h3 style="margin:16px 0 4px;font-size:var(--fs-md)">Leave</h3><div>${leave.map(s=>`<span class="tag lg leave" style="margin:2px 4px 2px 0;display:inline-block">${escapeHTML(s.name)} · ${escapeHTML(getShift(s.id,dailyDate).code)}</span>`).join("")}</div>`:""}
    ${assignList}
  </div>`;
}
function zoneLabelFor(cyc,z,sh){ if(!z)return "?"; const f=fillsOf(cyc,sh);
  if(f.length>1&&z.pmLabel&&z.pmLabel!==z.name)return z.name+"/"+z.pmLabel;   // a full shift stands in both halves of a zone whose evening is named differently
  return zoneLabel(z,f[0]||sh.period); }
function shiftLabel(sh){if(!sh)return"Off";const _c=active();if(sh.kind==="clinical"){const z=zoneById(sh.zone);return zoneLabelFor(_c,z,sh)+" "+typeLabelOf(_c,sh);}if(sh.kind==="cst")return typeLabelOf(_c,sh)||"CST";if(sh.kind==="leave")return sh.code;return"Off";}
function cellChip(sh,ctx){
  const _c=active();
  if(sh.kind==="clinical"){const z=zoneById(sh.zone);const full=z?zoneLabelFor(_c,z,sh):"?";const lbl=z?(ctx==="grid"?(full.length<=11?full:zoneShort(z)):monthLabel(z,sh.period)):full;const _w=shiftWindow(_c,sh);return `<span class="full-cell" title="${escapeHTML(full)}"><span class="tag lg ${typeClass(_c,sh)}${sh.locum?" locum":""}">${escapeHTML(lbl)}${sh.locum?'<span class="tag solid locum mini">L</span>':''}</span>${(_w&&_w.own)?`<span class="muted small mcell-win" style="display:block">${escapeHTML(windowStr(_w))}</span>`:""}</span>`;}
  if(sh.kind==="cst")return `<span class="full-cell"><span class="tag lg cst">${escapeHTML(typeLabelOf(_c,sh)||"CST")}</span></span>`;
  if(sh.kind==="leave"){const ls=leaveStyle(sh.code);return `<span class="full-cell"><span class="tag lg" style="background:${ls.bg};color:${ls.t}">${escapeHTML(sh.code)}</span></span>`;}
  return "";
}
function cellTip(sh,sName,d,ocTxt){
  const dd=fmt(d,{weekday:"short",day:"numeric",month:"short"});
  let core="";
  const _c=active();
  if(sh.kind==="clinical"){const z=zoneById(sh.zone);const zl=z?zoneLabelFor(_c,z,sh):"";core=typeLabelOf(_c,sh)+" "+shTimeStr(_c,sh)+(zl?" · "+zl:"")+(sh.locum?" · locum":"");}
  else if(sh.kind==="cst"){core=(typeLabelOf(_c,sh)||"CST")+" · non-clinical · "+shTimeStr(_c,sh);}
  else if(sh.kind==="leave"){const ls=leaveStyle(sh.code);core="Leave — "+ls.name+" ("+sh.code+")";}
  else if(ocTxt)core="Off";
  else return "";
  let tip=sName+" · "+dd+" · "+core;
  if(ocTxt)tip+="  On call: "+ocTxt;
  if(sh.note)tip+="  Note: "+sh.note+" — "+(sh.noteBy||"admin");
  return tip;
}
function legend(){ const _c=active();
  const clin=bookableTypes(_c).map(t=>`<span class="tag lg ${t.fills.length>1?"full":(t.fills[0]==="PM"?"pm":"am")}">${escapeHTML(t.label)} ${typeTime(t)}</span>`).join("");
  const cstT=typeById(_c,"CST"), cst=(featOn("cst")&&cstT&&cstT.on!==false)?`<span class="tag lg cst" title="Non-clinical time">${escapeHTML(cstT.label)}</span>`:"";
  return `${clin}${cst}<span class="tag lg leave">Leave</span><span class="tag lg am locum" title="Locum cover — pink ring + L badge">Locum<span class="tag solid locum mini">L</span></span>`;
}
function escapeHTML(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
let _ferrN=0;
function clearErrors(root){ root=root||document; try{ root.querySelectorAll(".ferr").forEach(e=>e.remove()); root.querySelectorAll('[aria-invalid="true"]').forEach(e=>{e.removeAttribute("aria-invalid");e.removeAttribute("aria-describedby");}); }catch(e){} }
function fieldError(el,msg){   // the one way to show a validation error: beside the field, named for assistive tech, focus moved to it. Falls back to a toast when there is no field.
  if(!el){ toast(msg,"warn"); return msg; } const id="ferr-"+(++_ferrN);
  const at=(el.closest&&el.closest("label"))||el;   // a control wrapped in its <label> gets the error after the label, not inside it — the label text is the accessible name
  try{ const old=at.parentNode&&at.parentNode.querySelector&&at.parentNode.querySelector(".ferr"); if(old&&old.remove)old.remove(); }catch(e){}
  try{ el.setAttribute("aria-invalid","true"); el.setAttribute("aria-describedby",id); }catch(e){}
  try{ at.insertAdjacentHTML("afterend",'<div class="ferr" id="'+id+'" role="alert">'+escapeHTML(msg)+'</div>'); }catch(e){}
  try{ const f=(el.querySelector&&(el.querySelector('[aria-checked="true"]:not([disabled])')||el.querySelector("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])")))||el; if(f.focus)f.focus(); if(el.scrollIntoView)el.scrollIntoView({block:"nearest"}); }catch(e){} return msg; }
function toast(msg,type){ const hid=type==="danger"?"alerts":"toasts"; let host=document.getElementById(hid); if(!host){host=document.createElement("div");host.id=hid;host.setAttribute("role",hid==="alerts"?"alert":"status");if(hid==="toasts")host.setAttribute("aria-live","polite");host.setAttribute("aria-atomic","false");document.body.appendChild(host);} const t=document.createElement("div"); t.className="toast"+(type?(" "+type):""); const icon=type==="ok"?ic("check"):(type==="danger"||type==="warn")?ic("warn"):""; if(icon){const s=document.createElement("span"); s.className="ticon"; s.innerHTML=icon; t.appendChild(s);} t.appendChild(document.createTextNode(String(msg==null?"":msg))); host.appendChild(t); const dur=Math.max(4000,Math.min(8000,2800+String(msg||"").length*35)); const hide=()=>{t.classList.add("hide");setTimeout(()=>t.remove(),220);}; let tm=setTimeout(hide,dur); t.onmouseenter=()=>clearTimeout(tm); t.onmouseleave=()=>{tm=setTimeout(hide,1500);}; }   // at least four seconds, and a toast someone is reading stays
function roundWaiting(cyc){ const ph=roundPhase(cyc); return !isRolling(cyc)&&(cyc.status==="closed"||cyc.status==="draft")&&ph.gated&&ph.phase==="before"; }   // closed or draft with an opening scheduled ahead: the round is waiting to open again, not finished (16 Oct 2026 — a cleared round with Friday's opening set read as "ready to publish")
function roundSteps(cyc){   // the round as a checklist: which step is done, which is now, which is still to come
  const st=cyc.status, rolling=isRolling(cyc), a=cyc.assign||{}, vals=Object.keys(a).map(k=>a[k]), waiting=roundWaiting(cyc);
  const anyFixed=vals.some(x=>x&&x.fixed), anyClin=vals.some(x=>x&&x.kind==="clinical"&&!x.fixed);
  const fixedNeeded=rosterStaff().some(x=>x.mode==="fixed"||x.mode==="preference");
  const done={fixed:anyFixed||!fixedNeeded||st!=="draft", prefill:anyClin||st!=="draft", open:!waiting&&(st==="open"||st==="closed"||st==="published"), close:!waiting&&(st==="closed"||st==="published"), publish:st==="published", live:st==="published"||st==="open"};
  const skipped={prefill:!anyClin&&st!=="draft", fixed:!anyFixed&&(!fixedNeeded||st!=="draft")};
  const keys=rolling?["fixed","prefill","live"]:["fixed","prefill","open","close","publish"];
  const titles={fixed:"Place fixed shifts",prefill:"Pre-fill the rest (optional)",open:"Open booking",close:"Close booking",publish:"Publish",live:"Go live"};
  let nowSet=false;
  return keys.map(k=>{ let state="todo"; if(done[k])state=skipped[k]?"skip":"done"; else if(!nowSet){state="now";nowSet=true;} return {key:k,title:titles[k],state}; });
}
function roundStepperHTML(cyc,o){ o=o||{}; const st=cyc.status, rolling=isRolling(cyc), steps=roundSteps(cyc), gapsN=shortSlotsCount();
  if(cyc.archived)return `<div class="card" id="card-round"><h2>${rolling?"Rolling roster":"Run this round"} <span class="tag muted">archived</span></h2><div class="sub">This cycle is archived and read-only. <a href="#" data-go="setup||card-cycles">Restore it in Settings → Cycles</a> to edit or run it again.</div></div>`;
  const schedule=(st!=="published")?`<div class="muted small" style="margin-bottom:6px">Schedule it — opens booking (and tells everyone), then closes at the deadline. This cycle only.</div><div class="row">
          <label class="field"><span class="lbl">Opens</span><input type="datetime-local" id="schOpen" value="${cyc.window&&cyc.window.open?cyc.window.open:(o.schDefOpen||"")}"></label>
          <label class="field"><span class="lbl">Closes</span><input type="datetime-local" id="schClose" value="${cyc.window&&cyc.window.close?cyc.window.close:(o.schDefClose||"")}"></label>
          <div class="field" role="group" aria-labelledby="lbl-schOn"><span class="lbl" id="lbl-schOn">Enable</span><label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);min-height:38px"><input type="checkbox" id="schOn" ${cyc.window&&cyc.window.enabled?"checked":""}> on</label></div>
          <button class="btn" id="schSave">Save schedule</button></div>`:"";
  const fp=(typeof _fpReport!=="undefined"&&_fpReport)?_fpReport:null, rc=statusReceipts(cyc);
  const body={
    fixed:`<div class="muted small">Lays down every fixed and preference pattern for the people in this cycle.${fp?` Last run: ${fp.placed} placed${fp.conflicts&&fp.conflicts.length?" · "+fp.conflicts.length+" conflicts":""}.`:""}</div><div class="flexbtns"><button class="btn primary" id="adFixed">Auto-draft fixed shifts</button>${fixedPlacedCount(cyc)?`<button class="btn danger" id="adFixedClear">Remove placed fixed shifts (${fixedPlacedCount(cyc)})</button>`:""}</div>`,
    prefill:`<div class="muted small">Fill each day to the minimum (or the maximum) before opening, or leave it to staff.${gapsN?` <b>${gapsN}</b> slot${gapsN>1?"s are":" is"} short right now.`:""}</div><div class="flexbtns"><button class="btn" id="adMin">Fill to minimum cover</button><button class="btn" id="adMax">Fill to maximum</button>${gapsN?`<button class="btn" data-gaps="1">Fix gaps (${gapsN})</button>`:""}<button class="btn danger" id="adClear">Clear the roster</button></div>`,
    open:`${receiptHTML(rc.open)}${roundWaiting(cyc)?`<div class="note">${ic("clock")} Waiting to open: booking opens <b>${escapeHTML(schFmt(cyc.window.open))}</b> on the schedule below, and everyone is told then.</div>`:""}${schedule}
      ${st==="draft"?`<div class="muted small" style="margin:8px 0 4px">Or open it now:</div><div class="flexbtns">${statusActions()}</div>`:""}
      ${st==="open"?`<div class="flexbtns" style="margin-top:6px">${S.fairness==="snake"?(cyc.draft?`<span class="tag warn">Round ${cyc.draft.round} · ${escapeHTML(nameOf(whoseTurn()))}'s turn</span><button class="btn sm" id="snAdvance">Skip turn</button><button class="btn danger sm" id="snStop">Stop taking turns</button>`:`<button class="btn primary sm" id="snStart">Start taking turns</button>`):""}</div>${S.fairness==="waves"?waveControlHTML(cyc):""}`:""}`,
    close:`${receiptHTML(rc.closed)}${st==="open"?`<div class="muted small">Stops bookings so you can review and fix gaps. Staff can still see the roster; they just can't change it until you reopen or publish.</div><div class="flexbtns">${statusActions()}</div>`:`<div class="muted small">Locks the roster for review.</div>`}`,
    publish:`${receiptHTML(rc.published)}${(st==="closed"||st==="published")?`<div class="muted small">${st==="published"?"Live for everyone — edits need a reason and are logged.":"Makes the roster the record and tells everyone."}</div><div class="flexbtns">${statusActions()}</div>`:`<div class="muted small">Makes the roster the record and tells everyone.</div>`}`,
    live:`${receiptHTML(rc.published)}${st==="published"?`<div class="muted small">Live — staff add and drop shifts whenever they need to. Days that have passed are locked for staff.</div>`:`<div class="muted small">Goes live once and stays live: staff add and drop shifts whenever they need to. A window limits <i>when</i> they may book without taking the roster offline.</div>${schedule}`}<div class="flexbtns">${statusActions()}</div>`
  };
  const rows=steps.map((sp,i)=>`<li class="rstep ${sp.state==="skip"?"done skip":sp.state}"><span class="rnum">${sp.state==="done"?ic("check"):(sp.state==="skip"?"–":i+1)}</span><div class="grow"><b>${sp.title}</b>${body[sp.key]||""}</div></li>`).join("");
  return `<div class="card" id="card-round"><h2>${rolling?"Rolling roster":"Run this round"} <span class="tag ${(STATUS[st]||STATUS.draft).cls}">${escapeHTML(statusLabel(cyc))}</span></h2>
    <div class="sub">Method: <b>${escapeHTML(fairnessLabel(S.fairness))}</b> · Quota: <b>per ${S.quotaPeriod||"fortnight"}</b>${cyc.archived?" · <b>archived</b>":""}</div>
    ${st==="draft"&&cloudOn()?`<div class="note">Staff don't see this cycle in the app until you ${rolling?"go live":"open booking or publish it"}.</div>`:""}
    <ol class="rsteps">${rows}</ol>${rolling?"":`<div class="flexbtns" style="margin-top:10px;justify-content:flex-end"><button class="btn danger sm" id="adReset">Reset this cycle\u2026</button></div>`}</div>`;
}
function shortSlotsCount(){ try{ let n=0; cycleDates().forEach(d=>{const g=dayGap(iso(d)); n+=g.am+g.pm;}); return n; }catch(e){ return 0; } }
function bookingStatusHTML(cyc,sid,s,turn){   // one line for staff: where the round is, when it closes, how many they've booked, whose turn it is
  const g=bookingGate(cyc), ph=roundPhase(cyc), w=cyc.window||{}, rolling=isRolling(cyc);
  let phase=rolling?(g.ok?"<b>Live</b> — add or drop shifts any time":escapeHTML(g.reason||"Not live yet"))
    :(g.ok?"<b>Booking open</b>":(ph.gated&&ph.phase==="before"?"<b>Booking opens</b> "+escapeHTML(schFmt(w.open)):"<b>"+escapeHTML(g.reason||"Booking closed")+"</b>"));
  if(g.ok&&ph.gated&&w.close)phase+=" · closes "+escapeHTML(schFmt(w.close))+" ("+escapeHTML(schUntil(ph.c))+")";
  const q=+s.quota||0, booked=clinicalCountFor(sid); let count=" · you've booked <b>"+booked+"</b> of "+(q||"—");
  if(S.quotaPeriod&&S.quotaPeriod!=="cycle"){ const per=cyclePeriods(); if(per.length>1)count+=" <span class=\"muted\">("+per.map(p=>escapeHTML(p.label)+" "+bookedInPeriod(sid,p)+"/"+periodTarget(s,p.index)).join(" · ")+")</span>"; }
  return `<div class="statusline">${phase}${count}${turn?"<br>"+turn:""}</div>`; }
function viewSelfRoster(){
  const cyc=active(), adm=isAdmin(), ds=cycleDates(), _gate=bookingGate(cyc), open=_gate.ok;
  const _p2=n=>String(n).padStart(2,"0"), _dloc=(d,h,m)=>d.getFullYear()+"-"+_p2(d.getMonth()+1)+"-"+_p2(d.getDate())+"T"+_p2(h)+":"+_p2(m);
  const _schDefOpen=_dloc(new Date(Date.now()+864e5),9,0), _schDefClose=_dloc(new Date(Date.now()+6*864e5),17,0);
  const _ph=roundPhase(cyc); let schedBanner="";
  if(_ph.gated){ const w=cyc.window;
    if(_ph.phase==="before")schedBanner=`<div class="schedbar before"><span>${ic("clock")}</span><span><b>Booking opens</b> ${schFmt(w.open)} · ${schUntil(_ph.o)}</span></div>`;
    else if(_ph.phase==="open")schedBanner=`<div class="schedbar open"><span>${ic("live")}</span><span><b>Booking is open</b>${w.close?` — closes ${schFmt(w.close)} · ${schUntil(_ph.c)}`:""}</span></div>`;
    else schedBanner=`<div class="schedbar closed"><span>${ic("lock")}</span><span><b>Booking closed</b>${w.close?` · ${schFmt(w.close)}`:""}</span></div>`;
  }
  let gaps=0; ds.forEach(d=>{const g=dayGap(iso(d));gaps+=g.am+g.pm;});
  let head="";
  if(adm){
    head=roundStepperHTML(cyc,{schDefOpen:_schDefOpen,schDefClose:_schDefClose});
  }
  const summary=`<div class="card" style="padding:12px 16px"><div class="grid-tiles">
    <div class="tile"><div class="k">Cycle</div><div class="v" style="font-size:var(--fs-md)">${cyLabel(cyc)}</div></div>
    <div class="tile"><div class="k">Status</div><div class="v" style="font-size:var(--fs-md)">${escapeHTML(statusLabel(cyc))}</div></div>
    <div class="tile"><div class="k">Coverage gaps</div><div class="v" style="${gaps?"color:var(--rag-r)":""}">${gaps}</div></div>
  </div></div>`;
  if(!S.staff.length)return head+summary+'<div class="card">'+noOneHTML()+'</div>';
  const snakeDraft=S.fairness==="snake"&&!!cyc.draft;
  const wavesOn=S.fairness==="waves"&&!!cyc.waveState;
  let sid;
  if(!adm) sid=S.viewAs;
  else if(snakeDraft&&whoseTurn()) sid=whoseTurn();
  else if(wavesOn){ const cc=currentCohort(); sid=(myPerson&&cc.includes(myPerson))?myPerson:(cc.find(id=>!(cyc.waveState.done&&cyc.waveState.done[id]))||cc[0]||S.staff[0].id); }
  else sid=(myPerson&&S.staff.find(x=>x.id===myPerson))?myPerson:((rosterStaff()[0]||S.staff[0]||{}).id);
  _srSid=sid;
  const s=S.staff.find(x=>x.id===sid);
  if(!s)return head+summary+'<div class="card muted">You\'re no longer on the staff list for this group — ask your admin.</div>';
  const myTurn=(S.fairness!=="snake"||!cyc.draft||whoseTurn()===sid)&&(!wavesOn||currentCohort().includes(sid));
  let booking="";
  if(!open&&!adm){booking=`<div class="card">${cardTitle("Book shifts")}${bookingStatusHTML(cyc,sid,s,"")}<div class="sub">You can view the roster in the <a href="#" data-go="roster">Roster</a> tab.</div></div>`;
    const ciDays=(cyc.status!=="draft"&&!cyc.archived&&ocTakenWindows(cyc).some(ocChosen))?ds.filter(d=>ciOnTime(iso(d))):[];   // closed booking still leaves the way in to log a call-in: the day sheet, on the day or the day after
    if(ciDays.length)booking+=`<div class="card list">${cardTitle("Called in?")}<div class="sub">Open the day to log the hours you worked.</div><div class="srbook daylist">${ciDays.map(d=>dayRowHTML(sid,d,{batch:false,canPick:false,openCount:()=>0})).join("")}</div></div>`;}
  else{
    const canPick=(open||adm)&&myTurn;
    const batch=!snakeDraft;  // non-snake methods select-then-confirm (batch); snake books one per turn
    if(_srPickSid!==sid||!canPick){_srPick=[];_srHours={};_srPickSid=sid;}   // a basket only lives while this person can pick: a passed turn or group drops it
    const personSel=adm?(snakeDraft
      ? `<div class="sub" style="margin-bottom:8px">Booking as <b>${escapeHTML(s.name)}</b> — it's their turn. Each pick passes to the next person automatically; use <b>Skip turn</b> above to move on by hand.</div>`
      : wavesOn
      ? `<div class="row" style="margin-bottom:8px"><label class="field"><span class="lbl">Booking as (Group ${cyc.waveState.current+1})</span><select id="srWho">${currentCohort().map(id=>{const st=S.staff.find(x=>x.id===id);return `<option value="${id}" ${id===sid?"selected":""}>${st?escapeHTML(st.name):id}</option>`;}).join("")}</select></label></div>`
      : `<div class="row" style="margin-bottom:8px"><label class="field"><span class="lbl">Booking as</span><select id="srWho">${rosterStaff().map(x=>`<option value="${x.id}" ${x.id===sid?"selected":""}>${escapeHTML(x.name)}</option>`).join("")}</select></label></div>`):"";
    const openCount=isoD=>{const _fw=_fatigueWarn;let n=0;
      bookableTypes(cyc).filter(t=>adm||t.book!==false).forEach(t=>{ const tk=typeIsDefault(t)?undefined:t.id, pp=t.fills[0];
        if(!periodsUnlocked(isoD,t.fills,sid).ok)return;
        (t.fills.length>1?bothZones():zonesFor(pp)).forEach(z=>{ if(t.fills.some(f=>zoneTaken(isoD,f,z.id,sid)))return; if((batch?pickCheck(sid,isoD,pp,z.id,tk):canBook(sid,isoD,pp,z.id,tk)).ok)n++; }); });
      _fatigueWarn=_fw;return n;};   // the row's count must agree with the chips it opens onto (past days, quota, basket cap, fatigue, turn)
    const rows=ds.map((d,i)=>((i===0||d.getDate()===1)?monthRowHTML(d):"")+dayRowHTML(sid,d,{batch,canPick,openCount})).join("");   // one row per day, the month named where it begins; the day sheet holds the zones, the cover and the reasons
    const turnMsg=snakeDraft?(myTurn?"<b>It's your turn</b> — pick one shift.":"It's <b>"+escapeHTML(nameOf(whoseTurn()))+"</b>'s turn — you'll be told when it's yours."):
      wavesOn?(currentCohort().includes(sid)?"<b>Your group is picking now</b> — book up to your "+(S.quotaPeriod||"fortnight")+" share.":"Group "+(cyc.waveState.current+1)+" is picking now. "+(wavePosOf(sid)<0?"You're not in a group yet — ask your admin to re-draw the groups.":wavePosOf(sid)<cyc.waveState.current?"Your group ("+(wavePosOf(sid)+1)+") has had its turn.":wavePosOf(sid)===cyc.waveState.current+1?"Your group ("+(wavePosOf(sid)+1)+") opens next.":"Your group ("+(wavePosOf(sid)+1)+") opens later.")):
      (instantBookOn()?"Tap a day to see what's open, then a zone marked Open: the shift is yours the moment you tap it — the first tap wins, and you're told at once if a colleague got there first.":"Tap a day to see what's open. Nothing is booked until you confirm — the first to confirm gets a slot, and you're told at once if a colleague got there first.")+(hasExtraSlots()?" Extra slots (beyond the minimum) open only after minimums are met ("+unlockOrderLabel()+").":"");   // the header follows the group switch (12 Oct 2026)
    const w=cyc.waveState;
    let bottomBtns="";
    if(snakeDraft&&canPick)bottomBtns=`<div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="snPass">Pass my turn</button></div>`;
    else if(wavesOn&&currentCohort().includes(sid))bottomBtns=`<div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="wvDone">${(w.done&&w.done[sid])?ic("reply")+" Reopen — I have more to pick":ic("check")+" I'm done — pass my remaining picks"}</button></div>`;
    booking=`<div class="card list">${adm?"<h2>Book shifts</h2>":cardTitle("Book shifts — "+escapeHTML(s.name))}
      ${adm?`<div class="sub">Booked <b>${clinicalCountFor(sid)}</b> / quota ${s.quota}. ${turnMsg}</div>`:bookingStatusHTML(cyc,sid,s,turnMsg)}
      ${wavesOn?waveScheduleHTML(sid):""}
      ${personSel}<div class="srbook daylist">${rows}</div>${batch?srFooterHTML(sid,s):""}${bottomBtns}</div>`;
  }
  return (adm?schedBanner+head+summary:pageHead("Book shifts",escapeHTML(s.name)))+booking;
}
function monthRowHTML(d){ return `<div class="monthrow" role="heading" aria-level="3">${escapeHTML(fmt(d,{month:"long",year:"numeric"}))}</div>`; }   // "November 2026" above the first day of each month in the list
function dayRowHTML(sid,d,ctx){   // one 56px row per day: its state, and a chevron when there is something to do
  const isoD=iso(d), sh=getShift(sid,isoD), pk=ctx.batch?pickFor(isoD):null; let st, cls="";
  const _c=active();
  if(pk){ const a=pk.split("|"), z=zoneById(a[2]), _pt={kind:"clinical",period:a[1],zone:a[2],type:a[3]}; st=`<span class="tag lg brand">${ic("check")} Picked · ${escapeHTML(perName(a[3]||a[1]))} · ${escapeHTML(z?zoneLabelFor(_c,z,_pt):"?")}</span>`; cls=" picked"; }
  else if(sh.kind==="clinical") st=`<span class="tag lg ${typeClass(_c,sh)}">${escapeHTML(shiftLabel(sh)+ownHoursTag(_c,sh))}</span>`;
  else if(sh.kind==="cst") st=`<span class="tag lg cst">${escapeHTML(typeLabelOf(_c,sh)||"CST")}</span>`;
  else if(sh.kind==="leave"){ const ls=leaveStyle(sh.code); st=`<span class="tag lg" style="background:${ls.bg};color:${ls.t}">${escapeHTML(sh.code==="UA"?"Unavailable":ls.name)}</span>`; }
  else { const n=ctx.openCount(isoD); st=`<span class="muted">Off</span><span class="muted small"> · ${n?n+" open":"nothing open"}</span>`; }
  const _ocMine=ocTakenBy(_c,sid,isoD);
  if(_ocMine.length)st+=`<span class="tag oc">${escapeHTML(_ocMine.map(w=>w.label).join(" · "))}</span>`;
  else if(sh.kind==="off"&&ocTakenWindows(_c).some(w=>!ocChosen(w)&&!ocHolder(_c,isoD,w.id)&&(isAdmin()||(w.book!==false&&bookingGate(_c).ok&&ctx.canPick&&!(isRolling(_c)&&isoD<iso(new Date()))))))st+=`<span class="muted small"> \u00b7 on call free</span>`;
  const tappable=true, tag="button";   // every day opens its sheet — a waiting person sees what is open and why each zone is locked for them
  return `<${tag} class="dayrow${cls}${_justBooked.has(isoD)?" just":""}${[0,6].includes(d.getDay())?" we":""}${isPH(isoD)?" ph":""}"${tappable?` data-bday="${isoD}"`:""}><span class="d"><span class="dn">${DOW[d.getDay()]}</span><span class="dd">${d.getDate()}</span><span class="dm">${escapeHTML(fmt(d,{month:"short"}))}</span>${isPH(isoD)?'<span class="tag ph mini">PH</span>':""}</span><span class="grow st">${st}</span>${tappable?ic("chevR"):""}</${tag}>`; }
function dsBookedActs(sid,isoD,cyc){   // under a booked shift on the day sheet: Swap it, Change hours (the group switch on, a day still ahead), and coming off it the way the notice period allows
  const adm=isAdmin(), _today=iso(new Date()), _sh=(cyc.assign||{})[sid+"|"+isoD]||{}, hrOpen=!!(_hrForm&&_hrForm.d===isoD), hrMay=!adm&&sid===S.viewAs&&isoD>=_today&&ownHoursOn();
  const hrIt=(hrMay&&!hrOpen)?`<button class="btn" data-hrchange="${isoD}">${ic("edit")} Change hours</button>`:"";
  const hrForm=(hrMay&&hrOpen)?`<div class="dsact" style="align-items:center"><span class="lbl">Hours</span> <input type="time" class="hrc-from" step="300" value="${escapeHTML(_hrForm.start)}" aria-label="Start" style="width:110px"> <span class="muted small">to</span> <input type="time" class="hrc-to" step="300" value="${escapeHTML(_hrForm.end)}" aria-label="Finish" style="width:110px"> <button class="btn primary sm" data-hrsave="${isoD}">Save</button><button class="btn sm" data-hrcancel="${isoD}">Cancel</button>${_sh.hours?`<button class="btn sm" data-hrclear="${isoD}">Same as the type</button>`:""}</div><div class="muted small">Your admin is told. Pay, the calendar and reminders use these hours.</div>`:"";   // like logging a call-in: Save and Cancel, and back to the type's window when the hours are the booking's own
  const swapIt=((sid===S.viewAs&&isoD>=_today)?`<button class="btn" data-swapit="${isoD}">${ic("swap")} Swap it</button>`:"")+hrIt;
  if(adm||(!inNotice(isoD,cyc)&&!_sh.fixed))return `<div class="dsact">${swapIt}<button class="btn danger" data-osdrop="${isoD}">Remove this shift</button></div>${(!adm&&gapOnDrop(cyc))?`<div class="muted small">Coming off tells the group \u2014 it goes up as an open shift.</div>`:""}`+hrForm;
  const note=`<div class="note">${ic("lock")} ${escapeHTML(_sh.fixed?"Fixed shift \u2014 offer it to the group or swap it; you stay on it until a colleague takes it or your admin lets you off. Only your admin can remove it outright.":noticeReason(isoD,cyc))}</div>`, swapOnly=swapIt?`<div class="dsact">${swapIt}</div>`:"";   // a fixed shift takes the same paths as a shift inside the notice period: a give-away, an ask, a swap — never a plain removal (10 Oct 2026)
  if(featOn("marketplace")&&S.marketOn&&!offeredAlready(sid,isoD)&&!askOn(sid,isoD))return note+`<div class="dsact"><button class="btn primary" data-osoffer="${isoD}">${ic("arrowUR")} Offer it to the group</button><button class="btn" data-osask="${isoD}">Ask to come off</button>${swapIt}</div><div class="muted small">Offering it is enough on its own. Asking is for when you need to be off it whether or not a colleague takes it.</div>`+hrForm;
  if(offeredAlready(sid,isoD))return note+`<div class="note">${ic("check")} ${askOn(sid,isoD)?"Offered to the group, and your admin has been asked \u2014 you\u2019re on it until one of them answers.":"Offered to the group \u2014 you\u2019re on it until a colleague takes it."}</div>`+swapOnly+hrForm;
  return note+(askOn(sid,isoD)?`<div class="note">${ic("check")} Your admin has been asked \u2014 you\u2019re on it until they answer.</div>`+swapOnly:(isoD<iso(new Date())?"":`<div class="dsact">${swapIt}<button class="btn" data-osask="${isoD}">Ask to come off</button></div>`))+hrForm; }   // open shifts off: asking goes to the admins alone, and never about a day already gone
function daySheetHTML(isoD){   // the day sheet: AM | PM, cover, one chip per zone with the reason it is or isn't open, then the secondary marks
  const sid=_srSid||S.viewAs, s=S.staff.find(x=>x.id===sid); if(!s)return ""; const cyc=active(), adm=isAdmin(), sh=getShift(sid,isoD);
  const snakeDraft=S.fairness==="snake"&&!!cyc.draft, wavesOn=S.fairness==="waves"&&!!cyc.waveState, batch=!snakeDraft;
  const myTurn=(!snakeDraft||whoseTurn()===sid)&&(!wavesOn||currentCohort().includes(sid)), canPick=(bookingGate(cyc).ok||adm)&&myTurn;
  const _bt=bookableTypes(cyc).filter(t=>adm||t.book!==false);
  const _ty=_bt.find(t=>t.id===_sheetPeriod)||_bt.find(t=>t.id==="AM")||_bt[0]||null;
  const tid=_ty?_ty.id:"AM", tfills=(_ty&&_ty.fills.length)?_ty.fills:["AM"], p=tfills[0], tkey=(_ty&&!typeIsDefault(_ty))?tid:"";   // a builtin half carries no fourth segment, so an existing pick key is unchanged
  const pk=pickFor(isoD);
  const head=`<div class="dshead"><div><b>${escapeHTML(fmtISO(isoD))}</b>${isPH(isoD)?' <span class="tag ph mini">PH</span>':""}${adm?` <span class="muted small">· ${escapeHTML(s.name)}</span>`:""}</div><button class="btn sm" id="dsClose">Done</button></div>`;
  let body="";
  if(sh.kind==="leave"&&sh.code!=="UA") body=`<div class="sub">On leave — ${escapeHTML(leaveStyle(sh.code).name)}. Change it through <a href="#" data-go="requests">Requests</a>.</div>`;
  else if(sh.kind==="leave") body=`<div class="sub">Marked unavailable for this day.</div>${canPick?`<div class="dsact"><button class="btn" data-rmua="${isoD}">Remove unavailable</button></div>`:""}`;
  else if(sh.kind==="clinical") body=`<div class="sub">Booked: <b>${escapeHTML(shiftLabel(sh))}</b> · ${(function(){ const _w=shiftWindow(cyc,sh)||{}; return _w.own?(escapeHTML(windowStr(_w))+" (own hours)"):(isFullShift(cyc,sh)?("the whole day "+escapeHTML(shTimeStr(cyc,sh))):("starts "+escapeHTML(_w.start||""))); })()}${clockMarkHTML(cyc,sid,isoD)}</div>${canPick&&(adm||!isRolling(cyc)||isoD>=iso(new Date()))?dsBookedActs(sid,isoD,cyc):""}`;
  else if(!canPick&&(!bookingGate(cyc).ok||sh.kind==="cst")) body=`<div class="sub">${sh.kind==="cst"?"Clinical support time (CST).":"Off."} ${escapeHTML(bookingGate(cyc).ok?"":(bookingGate(cyc).reason||""))}</div>`;
  else {
    const cc=clinicalCounts(isoD,sid);
    const covOf=f=>({min:f==="AM"?effStaffing().amMin:effStaffing().pmMin, max:Math.min(f==="AM"?effStaffing().amMax:effStaffing().pmMax,zonesFor(f).length), cur:f==="AM"?cc.am:cc.pm});
    const seg=`<div class="seg dsper">${_bt.map(t=>`<button data-dsper="${t.id}" class="${t.id===tid?"on":""}">${escapeHTML(t.label)}</button>`).join("")}</div>`;
    const q=+s.quota||0, atShare=batch&&(S.quotaCapMode||"hard")==="hard"&&q>0&&clinicalCountFor(sid)+_srPick.filter(k=>k.indexOf(isoD+"|")!==0).reduce((a,k)=>a+pickUnits(k),0)+1>q;   // the share is used up only when even a half shift will not fit
    const covLine=tfills.map(f=>{const c=covOf(f); return escapeHTML(perName(f))+" cover "+c.cur+" of "+c.max+" · minimum "+c.min+(c.cur<c.min?" — still filling":"");}).join(" · ");
    const sib=tfills.map(f=>sibLinesHTML(isoD,f)).join(""); const cover=`<div class="muted small">${covLine}</div>${tfills.length>1?`<div class="muted small">A ${escapeHTML(_ty.label.toLowerCase())} shift fills one of each, and takes two of your share.</div>`:""}${atShare?`<div class="note" style="margin:8px 0">You've booked your share for this cycle (${q}). Remove a shift to move it here.</div>`:""}`;
    const _fwKeep=_fatigueWarn; const _zl=tfills.length>1?bothZones():zonesFor(p);
    const chips=_zl.map(z=>{ const key=isoD+"|"+p+"|"+z.id+(tkey?"|"+tkey:""), sel=batch&&pk===key;
      let taken=null; for(let i=0;i<tfills.length&&!taken;i++)taken=zoneTaken(isoD,tfills[i],z.id,sid);
      const chk=taken?{ok:false,reason:"Taken by "+shortNm(taken)}:(batch?pickCheck(sid,isoD,p,z.id,tkey||undefined):canBook(sid,isoD,p,z.id,tkey||undefined));
      return `<button class="zchip${sel?" on":""}" data-${batch?"pick":"book"}="${key}"${(!chk.ok&&!sel)?" disabled":""}><b>${escapeHTML(zoneLabelFor(cyc,z,{kind:"clinical",period:p,type:tkey||undefined}))}</b><span class="zsub">${sel?"Picked — tap to unpick":(chk.ok?"Open":escapeHTML(chk.reason)+(taken?tagChipsHTML(taken):""))}</span></button>`; }).join(""); _fatigueWarn=_fwKeep;   // the chips are a dry-run — leave only what a real commit had pending
    const _cstT=typeById(cyc,"CST"), _cstL=(_cstT&&(_cstT.long||_cstT.label))||"clinical support time";
    const _cj=(featOn("cst")&&sh.kind!=="cst")?cstJudge(sid,isoD):{ok:true};   // the CST quota, judged as a clinical pick is; a day already marked is never judged against itself
    const cst=(featOn("cst")&&_cstT&&_cstT.on!==false&&(adm||_cstT.book!==false))?`<button class="btn${sh.kind==="cst"?" primary":""}" data-setcst="${isoD}"${_cj.ok?"":" disabled"}>${sh.kind==="cst"?ic("check")+" "+escapeHTML(_cstL.charAt(0).toUpperCase()+_cstL.slice(1)):"Mark "+escapeHTML(_cstL)}</button>`:"";
    const cstNote=(cst&&(!_cj.ok||_cj.flag))?`<div class="muted small">${escapeHTML(_cj.reason||_cj.flag)}</div>`:"";
    const hrs=(ownHoursOn()&&batch&&pk&&canPick)?(function(){ const _pt=typeById(cyc,pk.split("|")[3]||pk.split("|")[1]), _h=_srHours[isoD]||(_pt?{start:_pt.start,end:_pt.end}:{start:"",end:""}); return `<div class="dsact" style="align-items:center"><span class="lbl">Hours</span> <input type="time" class="hr-from" step="300" value="${escapeHTML(_h.start)}" aria-label="Start" style="width:110px"> <span class="muted small">to</span> <input type="time" class="hr-to" step="300" value="${escapeHTML(_h.end)}" aria-label="Finish" style="width:110px"></div><div class="muted small">Your own start and finish for this shift, if they differ from the ${escapeHTML(_pt?_pt.label:"")} hours. Pay, the calendar and reminders use them.</div>`; })():"";   // the hours typed here go with the pick, and are written on Confirm
    body=_ty?`${seg}${cover}${sib}<div class="zchips">${chips||'<div class="muted small">No zone runs this period.</div>'}</div>${hrs}
      ${canPick?`${cstNote}<div class="dsact">${cst}<button class="btn" data-setoff="${isoD}">Mark off</button><button class="btn" data-setua="${isoD}">Mark unavailable (UA)</button></div>`:""}
      <div class="muted small">Annual, CME and other leave goes through <a href="#" data-go="requests">Requests</a>.</div>`
      :`<div class="sub">Your admin hasn\u2019t opened a shift type for booking yet.</div>`; }   // nothing bookable: say so rather than offering a shift nobody may take
  body+=ocSheetHTML(cyc,sid,isoD,adm,canPick); body+=clockSheetHTML(cyc,sid,isoD);
  return `<div class="overlay sheetwrap" id="ovlDay"><div class="sheet daysheet" role="dialog" aria-modal="true" aria-label="${escapeHTML(fmtISO(isoD))}"><div class="sheetgrab"></div>${head}${body}</div></div>`; }
/* ---------- own hours on a booking: a clinical shift may carry hours:{start,end} when they differ from its type's window; one reader answers every question about a shift's times ----------
   Spec: docs/superpowers/specs/2026-09-26-own-hours-s4-design.md. Cover, unlock, quota, fairness, the S3 judge and the on-call layer read the type and the half; pay, the calendar, reminders, the digest and the safe-hours rules read the window. */
const HOURS_RULE="Choose a start and a finish on the same day, in 5-minute steps, with the finish after the start (or 00:00 for midnight).";
function hoursOK(start,end){ const re=/^([01]\d|2[0-3]):([0-5]\d)$/, a=re.exec(String(start||"")), b=re.exec(String(end||"")); if(!a||!b)return false;
  if((+a[2])%5||(+b[2])%5)return false; const s=(+a[1])*60+(+a[2]), e=(+b[1])*60+(+b[2]);
  return e>s||(e===0&&s>0); }   // the finish after the start on the same day, or 00:00 for midnight; never across midnight (the call-ins rule)
function hoursNorm(cyc,sh,start,end){ if(!hoursOK(start,end))return null; const t=typeOf(cyc,sh); if(t&&t.start===start&&t.end===end)return null; return {start:start,end:end}; }   // the pair to store, or null: the type's own window is never stored, and neither is a pair the rule refuses (a caller that must say why asks hoursOK first)
function shiftWindow(cyc,sh){ const t=typeOf(cyc,sh), h=!!sh&&sh.kind==="clinical"&&sh.hours;
  if(h&&hoursOK(h.start,h.end))return {start:h.start,end:h.end,own:true};
  return t?{start:t.start,end:t.end,own:false}:null; }   // the one reader: the booking's own hours when present and valid, else the type's window; CST, leave and on-call are never own
function windowStr(w){ return w?(w.start+"\u2013"+w.end):""; }
function ownHoursTag(cyc,sh){ const w=shiftWindow(cyc,sh); return (w&&w.own)?" "+windowStr(w):""; }   // " 09:30–15:00" after a label or a name when the hours are the booking's own, else nothing
function ownHoursOn(){ return S.ownHours===true; }   // the group switch: absent means off, and normalize() seeds nothing
function hoursRefusal(c,sid,isoD,sh,start,end,clearing){ const adm=isAdmin();
  if(!sh||sh.kind!=="clinical")return "No shift that day to set hours on.";
  if(!adm){ if(sid!==S.viewAs)return "You can only change your own hours.";
    if(!ownHoursOn())return "Your admin sets hours for this group.";
    if(c.status==="draft"||c.archived)return "This roster isn\u2019t live yet.";
    if(isoD<iso(new Date()))return "That day has passed \u2014 ask your admin."; }
  if(!clearing&&!hoursOK(start,end))return HOURS_RULE;
  return ""; }   // every rule a change of hours passes, read inside the write
function hoursAudit(sid,isoD,sh,prev,actor){ const next=(sh&&sh.kind==="clinical"&&sh.hours)||null; if(JSON.stringify(next)===JSON.stringify(prev||null))return false;
  const c=active(), txt=next?windowStr(next):"the "+typeLabelOf(c,sh)+" hours";
  const line=nameOf(sid)+" "+isoD+" "+shiftLabel(sh)+" \u2192 "+txt; if(next)logAudit("hours.set",line,actor||S.viewAs); else logAudit("hours.clear",line,actor||S.viewAs); return true; }   // one line when the hours changed, none when they did not: the cell editor and hoursSet both write through here (each key a literal, for the audit lint)
function hoursSet(sid,isoD,start,end){ const clearing=!String(start||"").trim()&&!String(end||"").trim();   // set or clear a booking's own hours: a guarded write, judged again inside it; an empty pair clears
  return commitGuarded(()=>{ const c=active(), sh=(c.assign||{})[sid+"|"+isoD], adm=isAdmin();
    const bad=hoursRefusal(c,sid,isoD,sh,start,end,clearing); if(bad)return {ok:false,reason:bad};
    const prev=sh.hours||null, next=clearing?null:hoursNorm(c,sh,start,end);
    if(JSON.stringify(next)===JSON.stringify(prev))return {ok:true};   // nothing to change, nothing to say
    let _fv=null; if(next){ const f=effFatigue(); if(f.mode!=="off")_fv=_restCheck(Object.assign({},f,{maxConsec:0}),sid,isoD,_shiftSpan(sid,isoD,sh.period,sh.zone,sh.type,next),{shift:true});   // a change of hours can neither cause nor cure a run of days: the rest rule alone
      if(_fv&&f.mode==="block"&&!adm)return {ok:false,reason:"Fatigue rule: "+_fv}; }   // the safe-hours rules judge the real hours, exactly like a booking
    if(next)sh.hours=next; else delete sh.hours;
    hoursAudit(sid,isoD,sh,prev,S.viewAs);
    const txt=next?windowStr(next):"the "+typeLabelOf(c,sh)+" hours", day=fmtISO(isoD);
    if(adm){ if(sid!==S.viewAs)notify(sid,"Your admin "+(next?"set your hours on "+day+" to ":"put your hours on "+day+" back to ")+txt+".",null,{tab:"my",cycle:c.id}); }
    else notify("admin",nameOf(sid)+(next?" changed their hours on "+day+" to ":" put their hours on "+day+" back to ")+txt+".",null,{tab:"roster",cycle:c.id});
    if(_fv)_fatigueWarn=_fv;   // only on the way out, so a refusal never leaves a warning behind
    return {ok:true}; },"hr-"+sid+"|"+isoD); }
/* ---------- clock in / clock out with a site geofence (C1): a person's taps propose hours, the manager approves them as the shift's own hours ----------
   Spec: docs/superpowers/specs/2026-09-29-clock-in-out-design.md. Taps live in cyc.clock (one owner: the person), decisions in cyc.clockDec (one owner: an admin);
   a record's status is computed by clockProposal, never stored, so no device ever writes another device's slot. Only dist, acc and inside are kept about location. */
const CLOCK_EARLY=60;   // minutes before the rostered start a person may clock in
const CLOCK_KEEP=14;    // days a closed record stays on the manager's list
let _clockNow=null, _clockBusy=false, _siteAcc=null, _wkPer=null, _wkZone=null;   // device-only: a fixed "now" for tests, the location wait, the accuracy the Site card just heard
function clockNow(){ return _clockNow?new Date(_clockNow):new Date(); }
function clockMySid(){ const e=String(authUser||"").toLowerCase(), pk=phoneKey(authPhone||"")||null; const s=S.staff.find(x=>(e&&((x.email||"").toLowerCase()===e||(x.email2||"").toLowerCase()===e))||(pk&&phoneKey(x.mobile)===pk)); return s?s.id:null; }   // the signed-in person's own staff record, by the email or mobile they signed in with
function clockActor(){ if(_realAdmin)return clockMySid(); return S.viewAs==="admin"?null:S.viewAs; }   // whose taps a tap on this device is: a staff sign-in taps as themselves; an admin sign-in taps only as their own record, whoever they are viewing as
function clockOn(){ return S.clockOn===true; }   // the group switch: absent means off, and normalize() seeds nothing
function clockWalkinOn(){ return S.clockWalkin===true; }   // the group switch (10 Oct 2026): someone on the list with nothing rostered today may clock in; the tap creates a casual shift for the admin to approve
function clockWalkinSwitch(on){ if(on)S.clockWalkin=true; else delete S.clockWalkin; logAudit("settings.clockWalkin",on?"on":"off","admin"); save(); }
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
  const sM=clockMin(w.start), eM=(w.end==="00:00")?1440:clockMin(w.end), inM=clockMin(rec.in.t); let outM=clockMin(rec.out.t); if(iso(new Date(rec.out.ts))>isoD||(rec.out.t==="00:00"&&new Date(rec.out.ts).getHours()===23))outM+=1440;   // an out tap after midnight, or one at 23:58–23:59 rounded up to 00:00 on the shift's day: both mean midnight; a 00:00 in the first minutes of the day does not
  if(outM<=inM)return done("void",["taps out of order"]);
  const tm=[]; let start=(Math.abs(inM-sM)<=grace)?w.start:rec.in.t, endM=(Math.abs(outM-eM)<=grace)?eM:outM;
  if(endM>1440){ endM=1440; tm.push("capped at midnight"); }
  const end=(endM>=1440)?"00:00":clockHHMM(endM), stM=clockMin(start);
  if(stM<sM)tm.unshift("early "+(sM-stM)+" min"); else if(stM>sM)tm.unshift("started late "+(stM-sM)+" min");
  if(endM>eM)tm.push("late "+(endM-eM)+" min"); else if(endM<eM)tm.push("left early "+(eM-endM)+" min");
  const _wk=!!(((cyc.assign||{})[sid+"|"+isoD]||{}).walkin); if(_wk)tm.unshift("walk-in: not rostered, created by the clock");   // a shift the clock itself made is always the admin's to approve
  if(!_wk&&start===w.start&&end===w.end)return done("rostered",tm);
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
    <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:0 0 8px"><input type="checkbox" id="clockWalkin" ${clockWalkinOn()?"checked":""}${clockOn()?"":" disabled"}> Staff not rostered today may clock in <span class="muted small">\u2014 the tap creates a casual shift for today and clocks them in; you approve it under Hours to approve with the hours they clock, or decline and it is removed</span></label>
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
function clockTarget(cyc,sid,kind,now){ const t=iso(now), y=iso(addDays(now,-1)); if(kind==="in")return clockMay(cyc,sid,t,now).in?t:null; return clockMay(cyc,sid,t,now).out?t:(clockMay(cyc,sid,y,now).out?y:null); }   // today's shift, or yesterday's still waiting for its clock-out
function clockWrite(cyc,sid,isoD,kind,now,f){ const key=sid+"|"+isoD; if(!cyc.clock)cyc.clock={}; const rec=cyc.clock[key]||{};
  if(kind==="in"&&rec.in)return {ok:false,reason:"Already clocked in at "+rec.in.t+"."}; if(kind==="out"&&!rec.in)return {ok:false,reason:"Clock in first."}; if(kind==="out"&&rec.out)return {ok:false,reason:"Already clocked out at "+rec.out.t+"."};
  const tap={t:clockRound(clockNowHHMM(now)),ts:now.getTime(),dist:(f.dist==null)?null:Math.round(f.dist),acc:(f.acc==null)?null:Math.round(f.acc),inside:(f.inside==null)?null:!!f.inside,via:f.via||"none"};
  rec[kind]=tap; cyc.clock[key]=rec; save(); return {ok:true,tap:tap}; }
function clockPlace(tap){ if(!tap)return ""; if(tap.via==="poster")return "by poster"; if(tap.inside==null)return "no location"; return tap.inside?"at the clinic":(tap.dist+" m from the clinic"); }
function clockTap(kind,fix,now){ now=now||clockNow(); if(!clockOn())return {ok:false,reason:"Clocking is off for this group."}; const sid=clockActor(); if(!sid)return {ok:false,reason:"Your sign-in isn\u2019t on this group\u2019s staff list, so there is nothing to clock \u2014 an admin sets other people\u2019s hours from the roster cell."};
  const cyc=active(), isoD=clockTarget(cyc,sid,kind,now); if(!isoD)return {ok:false,reason:kind==="in"?"Nothing to clock in to right now.":"Nothing to clock out of right now."};
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
/* ---------- walk-in clocking (10 Oct 2026): nothing rostered today, so the tap makes the shift ---------- */
function walkinMay(cyc,sid,isoD,now){ now=now||clockNow(); if(!clockOn()||!clockWalkinOn()||!cyc||cyc.archived||cyc.status==="draft")return false; if(isoD!==iso(now))return false;
  const s=S.staff.find(x=>x.id===sid); if(!s||!inCycle(s))return false; if(getShift(sid,isoD).kind!=="off")return false; const rec=clockRec(cyc,sid,isoD); return !(rec&&rec.in); }   // on the list, nothing rostered or on leave today, not clocked yet
function walkinBtnHTML(isoD){ return `<button class="btn" data-walkin="${isoD}">${ic("clock")} Clock in \u2014 not rostered</button>`; }
function walkinStart(sid,isoD,period,zoneId,fix,now){ now=now||clockNow(); const cyc=active();
  if(!walkinMay(cyc,sid,isoD,now))return {ok:false,reason:"Nothing to clock in to \u2014 you already have a shift today, or walk-in clocking is off for this group."};
  if(period!=="AM"&&period!=="PM")return {ok:false,reason:"Pick AM or PM."}; if(!zoneById(zoneId))return {ok:false,reason:"Pick the zone you are working in."};
  const key=sid+"|"+isoD; cyc.assign[key]={kind:"clinical",period:period,zone:zoneId,walkin:true};
  if(!clockMay(cyc,sid,isoD,now).in){ delete cyc.assign[key]; return {ok:false,reason:"Too early for a "+perName(period)+" shift \u2014 clock in from an hour before it starts, or pick the other half."}; }   // the shift is only kept when the tap can follow it
  logAudit("clock.walkin",nameOf(sid)+" "+isoD+" "+period+" "+zoneName(zoneId)+" \u2014 not rostered, created by the clock",sid);
  notify("admin",nameOf(sid)+" clocked in on "+fmtISO(isoD)+" without a rostered shift \u2014 approve or decline it under Hours to approve.","wk-"+sid+"-"+isoD,{tab:"requests",cycle:cyc.id}); save();
  return clockTap("in",fix,now); }
function walkinSheetHTML(isoD){ const per=_wkPer||(clockNow().getHours()<12?"AM":"PM"), zs=zonesFor(per);
  return `<div class="overlay" id="ovlWalkin"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="wkT"><h3 id="wkT">Clock in \u2014 not rostered today</h3><div class="sub">Pick the half and the zone you are working. The tap creates a casual shift for today and clocks you in; your admin approves it with the hours you clock.</div>
    <div class="seg" style="margin-top:8px">${["AM","PM"].map(p=>`<button class="${per===p?"on":""}" data-wkper="${p}">${escapeHTML(perName(p))}</button>`).join("")}</div>
    <div class="flexbtns" style="margin-top:8px">${zs.map(z=>`<button class="btn sm ${_wkZone===z.id?"primary":""}" data-wkzone="${z.id}">${escapeHTML(zoneLabel(z,per))}</button>`).join("")}</div>
    <div class="flexbtns" style="margin-top:12px"><button class="btn primary" id="wkGo" ${_wkZone?"":"disabled"}>${ic("clock")} Clock in</button><button class="btn" id="wkCancel">Cancel</button></div><div class="muted small" style="margin-top:8px">${CLOCK_NOTE}</div></div></div>`; }
function openWalkinSheet(isoD){ _wkPer=null; _wkZone=null;
  const draw=()=>{ const root=openDialog(walkinSheetHTML(isoD));
    root.querySelectorAll("[data-wkper]").forEach(b=>b.onclick=()=>{ _wkPer=b.dataset.wkper; _wkZone=null; closeModal(); draw(); });
    root.querySelectorAll("[data-wkzone]").forEach(b=>b.onclick=()=>{ _wkZone=b.dataset.wkzone; closeModal(); draw(); });
    const go=document.getElementById("wkGo"); if(go)go.onclick=()=>{ const per=_wkPer||(clockNow().getHours()<12?"AM":"PM"), z=_wkZone; closeModal(); const r=walkinStart(clockActor(),isoD,per,z); if(!r.ok)toast(r.reason); else if(!r.pending)render(); };
    const c=document.getElementById("wkCancel"); if(c)c.onclick=closeModal; };
  draw(); }
const CLOCK_NOTE="Myrosta keeps only the time of your tap and how far you were from the clinic.";
function clockMyHTML(sid,now){ if(!clockOn()||sid!==clockActor())return ""; now=now||clockNow(); const cyc=active(), t=iso(now), y=iso(addDays(now,-1));
  const rows=[t,y].map(d=>{ const w=clockWindow(cyc,sid,d), rec=clockRec(cyc,sid,d)||{}, st=clockStatusText(cyc,sid,d,now), btn=w?clockButtonsHTML(cyc,sid,d,now):(walkinMay(cyc,sid,d,now)?walkinBtnHTML(d):""); if(!btn&&!st)return "";
    const late=d===t&&!!w&&!!rec.in&&!rec.out&&clockMin(clockNowHHMM(now))>((w.end==="00:00")?1440:clockMin(w.end));   // past the rostered finish and still clocked in: the banner
    return `<div class="listrow"><span class="grow"><b>${d===t?"Today":"Yesterday"}</b>${late?` <span class="tag warn">Still clocked in from ${escapeHTML(rec.in.t)}</span>`:""}${st?`<div class="muted small">${escapeHTML(st)}</div>`:""}</span>${btn}</div>`; }).join("");
  return rows?`<div class="card" style="margin-top:8px"><b>Clock</b>${rows}<div class="muted small">${CLOCK_NOTE}</div></div>`:""; }
function clockSheetHTML(cyc,sid,isoD,now){ if(!clockOn()||sid!==clockActor())return ""; now=now||clockNow();
  if(!clockWindow(cyc,sid,isoD))return walkinMay(cyc,sid,isoD,now)?`<div class="dsact" style="align-items:center">${walkinBtnHTML(isoD)}<span class="muted small">Nothing rostered today \u2014 clocking in creates a casual shift for your admin to approve.</span></div>`:"";
  const btn=clockButtonsHTML(cyc,sid,isoD,now), st=clockStatusText(cyc,sid,isoD,now); if(!btn&&!st)return "";
  return `<div class="dsact" style="align-items:center">${btn}${st?`<span class="muted small">${escapeHTML(st)}</span>`:""}</div><div class="muted small">${CLOCK_NOTE}</div>`; }
function clockReadURL(){ const q=String(location.search||""), m=/[?&]clock=([^&#]+)/.exec(q); if(!m)return null; const om=/[?&]org=([^&#]+)/.exec(q); let token="", org=""; try{ token=decodeURIComponent(m[1]); org=om?decodeURIComponent(om[1]):""; }catch(e){ return null; }
  const pending={org:org,token:token}; try{ sessionStorage.setItem("myrosta_clock",JSON.stringify(pending)); if(org)localStorage.setItem("myrosta_org",org); }catch(e){}   // the scan waits for the sign-in, and names the group the poster belongs to
  try{ history.replaceState(null,"",location.pathname); }catch(e){} return pending; }   // a refresh never taps again
function goReadURL(){ const m=/[?&]go=(help)\b/.exec(String(location.search||"")); if(!m)return null;   // the landing page's "Every chapter" link (12 Oct 2026): ?go=help waits for the sign-in, then opens Help at the videos
  try{ sessionStorage.setItem("myrosta_go",m[1]); }catch(e){} try{ history.replaceState(null,"",location.pathname); }catch(e){} return m[1]; }
function goApplyURL(){ let g=null; try{ g=sessionStorage.getItem("myrosta_go"); sessionStorage.removeItem("myrosta_go"); }catch(e){} if(g!=="help")return null;
  S.tab="help"; _moreOpen=false; save(); render(); setTimeout(()=>{ const h=document.getElementById("videos"); if(h&&h.scrollIntoView)h.scrollIntoView({block:"start"}); },60); return g; }
function clockApplyURL(now){ let p=null; try{ p=JSON.parse(sessionStorage.getItem("myrosta_clock")||"null"); sessionStorage.removeItem("myrosta_clock"); }catch(e){} if(!p)return null;
  if(p.org&&p.org!==_org){ toast("That poster belongs to another group."); return "org"; }
  if(!clockOn()){ toast("Clocking is off for this group."); return "off"; }
  if(!clockTokenOK(p.token)){ toast("This poster is out of date \u2014 ask your manager for the new one."); return "stale"; }
  now=now||clockNow(); const cyc=active(), sid=clockActor(); if(!sid){ toast("Your sign-in isn\u2019t on this group\u2019s staff list, so there is nothing to clock."); return "refused"; } const kind=clockTarget(cyc,sid,"in",now)?"in":(clockTarget(cyc,sid,"out",now)?"out":null);
  if(!kind){ toast("Nothing to clock today."); return "none"; }
  const r=clockTap(kind,{dist:null,acc:null,inside:null,via:"poster"},now); if(r.ok){ toast("Clocked "+kind+" "+r.tap.t+" \u00b7 by poster","ok"); render(); return kind; } toast(r.reason); return "refused"; }
function clockRows(cyc,now){ const g=clockGrace(), keepFrom=iso(addDays(now,-CLOCK_KEEP)), open=r=>r.p.status==="proposed"&&!r.dec;   // proposals first, newest day first, then a fortnight of closed records for information
  return Object.keys(cyc.clock||{}).map(k=>{ const sid=k.split("|")[0], isoD=k.split("|")[1]; return {sid:sid,isoD:isoD,p:clockProposal(cyc,sid,isoD,g,now),rec:cyc.clock[k],dec:clockDecOf(cyc,sid,isoD)}; })
    .filter(r=>r.p.status!=="none"&&r.p.status!=="open"&&(open(r)||r.isoD>=keepFrom)).sort((a,b)=>((open(a)?0:1)-(open(b)?0:1))||(a.isoD<b.isoD?1:a.isoD>b.isoD?-1:0)||nameOf(a.sid).localeCompare(nameOf(b.sid))); }
function clockCount(cyc,now){ if(!clockOn())return 0; return clockRows(cyc,now).filter(r=>r.p.status==="proposed"&&!r.dec).length; }
function clockListHTML(now){ if(!isAdmin()||!clockOn())return ""; now=now||clockNow(); const cyc=active(), rows=clockRows(cyc,now); if(!rows.length)return ""; const n=clockCount(cyc,now);
  const row=r=>{ const open=r.p.status==="proposed"&&!r.dec, rec=r.rec, ro=(r.dec&&r.dec.rostered)||r.p.rostered, line=(ro?"rostered "+ro.start+"\u2013"+ro.end+" \u00b7 ":"")+"clocked "+rec.in.t+"\u2013"+(rec.out?rec.out.t:"?")+(open?" \u00b7 proposes "+r.p.start+"\u2013"+r.p.end:"");
    const chips=r.p.flags.map(f=>`<span class="tag ${/outside|no location|out of order|no clock-out|no shift/.test(f)?"warn":"muted"} mini">${escapeHTML(f)}</span>`).join(" ");
    const word=r.dec?(r.dec.ok?"approved "+r.dec.start+"\u2013"+r.dec.end:(r.dec.walkin?"declined \u00b7 shift removed":"declined \u00b7 as rostered")):(open?"":(r.p.status==="rostered"?"as rostered":r.p.status==="noOut"?"no clock-out":"no proposal"));
    return `<div class="listrow${open?"":" muted"}"><span class="grow"><b>${escapeHTML(nameOf(r.sid))}</b> \u00b7 ${escapeHTML(fmtISO(r.isoD))}<div class="muted small">${escapeHTML(line)}</div>${chips?`<div>${chips}</div>`:""}</span>${word?`<span class="tag ${r.dec&&r.dec.ok?"ok":"muted"}">${escapeHTML(word)}</span>`:""}${open?`<button class="btn sm" data-clkno="${r.sid}|${r.isoD}">Decline</button><button class="btn primary sm" data-clkok="${r.sid}|${r.isoD}">Approve</button>`:""}</div>`; };
  return `<div class="card" id="clockList"><h2>Hours to approve <span class="tag ${n?"warn":"muted"}">${n}</span></h2><div class="sub">Clocked hours outside the grace band. Approve writes them as the shift\u2019s own hours for pay; Decline keeps the rostered hours. Closed records stay a fortnight, for information.</div>${rows.map(row).join("")}</div>`; }
function clockApprove(sid,isoD){ if(!isAdmin())return {ok:false,reason:"Admin only."}; const c=active(), p=clockProposal(c,sid,isoD,clockGrace(),clockNow()); if(p.status!=="proposed")return {ok:false,reason:"Nothing to approve."}; if(clockDecOf(c,sid,isoD))return {ok:false,reason:"Already decided."};
  if(!hoursSet(sid,isoD,p.start,p.end))return {ok:false};   // refused synchronously in local mode; in cloud mode the guarded commit answers later and says so itself
  if(!c.clockDec)c.clockDec={}; c.clockDec[sid+"|"+isoD]={ok:true,start:p.start,end:p.end,rostered:p.rostered,by:S.viewAs,ts:Date.now()};
  logAudit("clock.approve",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 "+p.start+"\u2013"+p.end+(p.flags.length?" \u00b7 "+p.flags.join(", "):""),"admin"); save(); return {ok:true}; }
function clockDecline(sid,isoD){ if(!isAdmin())return {ok:false,reason:"Admin only."}; const c=active(), p=clockProposal(c,sid,isoD,clockGrace(),clockNow()); if(p.status!=="proposed")return {ok:false,reason:"Nothing to decline."}; if(clockDecOf(c,sid,isoD))return {ok:false,reason:"Already decided."};
  const _sh=(c.assign||{})[sid+"|"+isoD], _wk=!!(_sh&&_sh.walkin);
  if(!c.clockDec)c.clockDec={}; c.clockDec[sid+"|"+isoD]={ok:false,rostered:p.rostered,by:S.viewAs,ts:Date.now(),walkin:_wk};
  if(_wk){ delete c.assign[sid+"|"+isoD]; logAudit("clock.walkin-decline",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 walk-in shift removed","admin"); notify(sid,"Your admin declined the walk-in shift on "+fmtISO(isoD)+" \u2014 it has been removed.",null,{tab:"my",cycle:c.id}); save(); return {ok:true}; }   // the clock made the shift; the decision unmakes it
  logAudit("clock.decline",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 rostered hours stand","admin");
  notify(sid,"Your admin kept the rostered hours on "+fmtISO(isoD)+".",null,{tab:"my",cycle:c.id}); save(); return {ok:true}; }
function clockMarkHTML(cyc,sid,isoD){ const r=clockRec(cyc,sid,isoD); if(!clockOn()||!r||!r.in)return ""; return `<span class="muted small"> \u00b7 in ${escapeHTML(r.in.t)}${r.out?" \u00b7 out "+escapeHTML(r.out.t):""}</span>`; }   // who has arrived, on the Day board and the day sheet
function qrMatrix(text){   // a QR code, byte mode, error level M, mask 0, versions 1 to 6 (up to 106 characters): enough for the poster's link. Checked bit for bit against a reference encoder in the plan's dry run
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
  let qr=""; try{ qr=clockQRSVG(url); }catch(e){ qr=`<div class="note">${escapeHTML("This group\u2019s link is too long for the poster code ("+url.length+" characters). Shorten the group\u2019s name in the registry, or ask Myrosta support.")}</div>`; }
  return `<div class="card" id="posterCard"><div class="poster"><div class="pbrand">${escapeHTML(hospitalGroupLabel())}</div><h1>Scan to clock in or out</h1><div class="pqr">${qr}</div><div class="purl">${escapeHTML(url)}</div><div class="pfoot">Open the camera, point it at the code, tap the link. Sign in if asked. \u00b7 Poster made ${escapeHTML(fmt(new Date(s.posterAt||0),{day:"numeric",month:"short",year:"numeric"}))} \u00b7 Myrosta</div></div></div>`; }
function exportClockCSV(){ const c=active(), now=clockNow(), g=clockGrace(), proof=t=>t?(t.via==="poster"?"poster":(t.inside==null?"no location":(t.inside?"inside":"outside"))):"";
  const rows=[["Person","Day","Rostered start","Rostered finish","Clock in","In distance (m)","In proof","Clock out","Out distance (m)","Out proof","Proposed start","Proposed finish","Flags","Decision","Decided by","Decided at"]];
  Object.keys(c.clock||{}).sort((a,b)=>{ const da=a.split("|")[1], db=b.split("|")[1]; return da<db?-1:da>db?1:nameOf(a.split("|")[0]).localeCompare(nameOf(b.split("|")[0])); }).forEach(k=>{ const sid=k.split("|")[0], d=k.split("|")[1], r=c.clock[k], p=clockProposal(c,sid,d,g,now), dec=clockDecOf(c,sid,d), ro=(dec&&dec.rostered)||p.rostered||{};
    rows.push([nameOf(sid),d,ro.start||"",ro.end||"",r.in?r.in.t:"",(r.in&&r.in.dist!=null)?r.in.dist:"",proof(r.in),r.out?r.out.t:"",(r.out&&r.out.dist!=null)?r.out.dist:"",proof(r.out),(p.status==="proposed")?p.start:((dec&&dec.ok)?dec.start:""),(p.status==="proposed")?p.end:((dec&&dec.ok)?dec.end:""),p.flags.join("; "),dec?(dec.ok?"approved":"declined"):(p.status==="proposed"?"waiting":p.status),dec?nameOf(dec.by):"",dec?new Date(dec.ts).toISOString():""]); });
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n")+"\n"; download(csv,"clock-"+c.cycle.start+".csv","text/csv"); logAudit("export.clock",cyLabel(c),"admin"); save(); }
function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }   // the Group card's tick: written as true, deleted when off, never false
function instantBookOn(){ return S.instantBook!==false; }   // the group switch (9 Oct 2026): a tap books the shift at once — first tap wins, no basket. Since 12 Oct 2026 absent means ON (the owner's call: the basket doubled the process); an admin who wants the basket switches it off, stored as false
function instantBookSwitch(on){ if(on)delete S.instantBook; else S.instantBook=false; logAudit("settings.instantBook",on?"on":"off","admin"); save(); }   // on is the default, so on clears the key
function modalHours(draft,cyc){ if(draft&&draft.hours)return {start:String(draft.hours.start||""),end:String(draft.hours.end||"")}; const t=typeOf(cyc,{kind:"clinical",period:(draft&&draft.period)||"AM",type:draft&&draft.type}); return t?{start:t.start,end:t.end}:{start:"",end:""}; }   // what the cell editor's Hours row shows: the draft's own pair, else the type's window (a type id that no longer exists reads as its period's, as shiftWindow does)
function modalHoursCheck(cyc,sh){ const h=sh&&sh.hours; if(!h)return {ok:true};   // the cell editor's Save: an empty pair or the type's own window clears, a pair the rule refuses is named, anything else is stored normalised
  const a=String(h.start||""), b=String(h.end||""); if(!a&&!b){ delete sh.hours; return {ok:true}; }
  if(!hoursOK(a,b))return {ok:false,reason:HOURS_RULE};
  const n=hoursNorm(cyc,sh,a,b); if(n)sh.hours=n; else delete sh.hours; return {ok:true}; }
function srHoursFor(cyc,isoD,p,typeId){ const h=_srHours[isoD]; if(!h)return {ok:true,hours:null};
  const a=String(h.start||"").trim(), b=String(h.end||"").trim(); if(!a&&!b)return {ok:true,hours:null};
  if(!hoursOK(a,b))return {ok:false,reason:HOURS_RULE};
  return {ok:true,hours:hoursNorm(cyc,{kind:"clinical",period:p,type:typeId||undefined},a,b)}; }   // what was typed beside a pick: nothing, the type's own window (nothing to store), a pair to store, or a pair the rule refuses
function importShift(cyc,sh){ const out=Object.assign({kind:"clinical",period:sh.period,zone:ensureZoneForRole(sh.role)},(sh.type&&typeById(cyc,sh.type))?{type:sh.type}:{});
  if(sh.start&&sh.end&&hoursOK(sh.start,sh.end)){ const h=hoursNorm(cyc,out,sh.start,sh.end); if(h)out.hours=h; } return out; }   // an imported cell: the type the cycle knows, and the cell's own times as own hours when they differ from that type's window; a pair the rule refuses is dropped
/* ---------- tags on people, rules on slots: a tag is a label on a person; a cycle may say a slot needs a tag, or that each half of a day needs at least N holders of one ----------
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
      return {ok:false,rule:"held",tag:worst.tag,reason:"Held for a "+tagName(st,worst.tag)+" \u2014 "+fmtISO(isoD)+" "+pl+" still needs "+worst.short+", and "+(open<=1?"this is the last place.":"only "+open+" places are left.")}; } }   // rule 2: the last places are held for holders
  return {ok:true}; }
function ruleBreaches(cyc,st,isoD){   // what a day is short of, in a fixed order: AM before PM; minimums before slots; tag-list order; zone order. Callers decide which dates to ask about
  if(!rulesPresent(cyc))return []; const out=[], counts=ruleCounts(cyc,st,isoD,null), r=rulesOf(cyc), zs=(cyc&&cyc.settings&&cyc.settings.zones)||(st&&st.zones)||[];
  ["AM","PM"].forEach(P=>{ const booked=counts[P];
    ruleShort(cyc,st,isoD,P,booked).forEach(s=>{ if(s.need>0&&s.have<s.need)out.push({kind:"min",period:P,tag:s.tag,need:s.need,have:s.have}); });
    zs.forEach(z=>{ const need=(r.needs[z.id]||[]).filter(t=>tagById(st,t)); if(!need.length)return;
      booked.filter(b=>b.zone===z.id).forEach(b=>{ const miss=need.find(t=>!hasTag(st,b.p,t)); if(miss)out.push({kind:"needs",period:P,zone:z.id,sid:b.sid,tag:miss}); }); }); });
  return out; }
function adminPlaceCheck(sid,isoD,sh){   // the admin's cell editor asks the judge as a warning: the sentence, then "Place ⟨Name⟩ anyway?"; the person's own shift that day does not count against them
  const cyc=active(), j=ruleJudge(cyc,S,sid,isoD,fillsOf(cyc,sh),sh.zone,{type:sh.type,without:[sid]}); if(j.ok)return {ok:true,over:null};
  if(!confirm(j.reason+"\n\nPlace "+nameOf(sid)+" anyway?"))return {ok:false,over:null}; return {ok:true,over:j.reason}; }
function adminOverrideAudit(sid,isoD,sh,reason){ logAudit("rules.override",nameOf(sid)+" "+isoD+" "+shiftLabel(sh)+" \u00b7 "+reason,"admin"); }   // who placed whom, where, against which rule
function ruleDraftPick(cyc,st,isoD,period,pool,free){   // the auto-draft's next placement in a half: holders of a tag it is short of first (largest shortfall first), then anyone; each in the first free zone the judge accepts; null when nobody eligible is left
  const place=p=>{ for(const z of free){ if(ruleJudge(cyc,st,p.id,isoD,[period],z.id,null).ok)return {sid:p.id,zone:z.id}; } return null; };
  if(rulesPresent(cyc)){ const booked=ruleCounts(cyc,st,isoD,null)[period], short=ruleShort(cyc,st,isoD,period,booked).filter(x=>x.short>0).sort((a,b)=>b.short-a.short);
    for(const s of short){ for(const p of pool){ if(!hasTag(st,p,s.tag))continue; const got=place(p); if(got)return got; } } }
  for(const p of pool){ const got=place(p); if(got)return got; } return null; }
function tagChipsHTML(s){ return personTags(S,s).filter(id=>!!(tagById(S,id)||{}).show).map(id=>' <span class="tag mini">'+escapeHTML(tagName(S,id))+'</span>').join(""); }   // only tags ticked Show, in list order — this group's own screens; the department board reads the digest, which carries none
function tagChipsAll(s){ return personTags(S,s).map(id=>' <span class="tag mini">'+escapeHTML(tagName(S,id))+'</span>').join(""); }   // the Staff tab shows every tag, whatever the tick
function ruleNeedText(cyc,st,isoD,P,o){ if(!rulesPresent(cyc))return ""; const short=ruleShort(cyc,st,isoD,P,ruleCounts(cyc,st,isoD,o||null)[P]).filter(s=>s.short>0); return short.length?"needs "+short.map(s=>s.short+" "+tagName(st,s.tag)).join(", "):""; }   // what a half is still short of, computed when shown; o.without leaves someone out, as a give-away's giver is
function ruleChip(isoD,P){ if(isoD<iso(new Date()))return ""; const t=ruleNeedText(active(),S,isoD,P); return t?" \u00b7 "+escapeHTML(t):""; }   // past days are never re-judged
function osNeedsHTML(o){ if(!o||o.status!=="open")return ""; const c=(S.cycles||[]).find(x=>x.id===o.cycleId); if(!c||!rulesPresent(c))return "";
  const parts=[]; fillsOf(c,{kind:"clinical",period:o.period,zone:o.zone,type:o.type||undefined}).forEach(P=>{ const t=ruleNeedText(c,S,o.iso,P,{without:(o.kind==="giveaway"&&o.from)?[o.from]:[]}); if(t)parts.push(escapeHTML(t)); }); return parts.length?' \u00b7 <span class="muted">'+parts.join(", ")+'</span>':""; }
function gapRowText(sl){ if(sl.kind==="needs")return `${escapeHTML(zoneName(sl.zone))} \u2014 ${escapeHTML(nameOf(sl.sid))} isn\u2019t ${escapeHTML(tagName(S,sl.tag))}`;
  if(sl.kind==="min")return `needs <b>${sl.need}</b> ${escapeHTML(tagName(S,sl.tag))}`; return `${sl.have} of ${sl.min} \u00b7 need <b>${sl.need}</b>`; }
let _tagSeq=0;
function tagNewId(){ let id; do{ id="t"+Date.now().toString(36)+(_tagSeq++).toString(36)+Math.floor(Math.random()*1296).toString(36); }while(tagById(S,id)); return id; }   // minted once, never reused: a session sequence keeps one import's new tags apart, and a clash with a tag made elsewhere is re-rolled
function tagHolders(id){ return S.staff.filter(s=>hasTag(S,s,id)); }
function tagInUse(id){ const people=tagHolders(id).length, cycles=(S.cycles||[]).filter(c=>!c.archived&&(rulesOf(c).mins.some(m=>m&&m.tag===id)||Object.keys(rulesOf(c).needs).some(z=>(rulesOf(c).needs[z]||[]).indexOf(id)>=0))).length; return {people:people,cycles:cycles}; }
function tagAdd(name){ name=String(name||"").trim().slice(0,40); if(!name)return null;
  if(tagList(S).some(t=>String(t.name).toLowerCase()===name.toLowerCase())){ toast("There is already a tag called "+name+"."); return null; }
  const t={id:tagNewId(),name:name}; (S.tags=Array.isArray(S.tags)?S.tags:[]).push(t);   // hidden until its Show tick is set
  logAudit("tags.add",name,"admin"); save(); return t; }
function tagRename(id,name){ const t=tagById(S,id); name=String(name||"").trim().slice(0,40); if(!t||!name||name===t.name)return false;
  if(tagList(S).some(x=>x.id!==id&&String(x.name).toLowerCase()===name.toLowerCase())){ toast("There is already a tag called "+name+"."); return false; }
  logAudit("tags.rename",t.name+" \u2192 "+name,"admin"); t.name=name; save(); return true; }
function tagSetShow(id,on){ const t=tagById(S,id); if(!t)return; if(on)t.show=true; else delete t.show; logAudit("tags.show",t.name+(on?" shown on the roster":" hidden on the roster"),"admin"); save(); }
function tagRemove(id){ const t=tagById(S,id); if(!t)return {ok:false,reason:"That tag is gone."}; const u=tagInUse(id);
  if(u.people||u.cycles)return {ok:false,reason:"Can\u2019t remove "+t.name+" while "+(u.people?u.people+(u.people===1?" person holds":" people hold")+" it":"")+(u.people&&u.cycles?" and ":"")+(u.cycles?u.cycles+(u.cycles===1?" cycle\u2019s rules name":" cycles\u2019 rules name")+" it":"")+". Untick it and change the rules first."};
  S.tags=tagList(S).filter(x=>x.id!==id); if(!S.tags.length)delete S.tags; logAudit("tags.remove",t.name,"admin"); save(); return {ok:true}; }
function personTagSet(sid,tagId,on){ const s=S.staff.find(x=>x.id===sid), t=tagById(S,tagId); if(!s||!t)return false;
  const cur=(Array.isArray(s.tags)?s.tags:[]).filter(x=>x!==tagId); if(on)cur.push(tagId);
  const order=tagList(S).map(x=>x.id), next=cur.filter(x=>order.indexOf(x)>=0).sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  if(next.length)s.tags=next; else delete s.tags;   // the key goes with the last tag: the 3-way merge decides ownership by JSON equality
  logAudit("tags.person",s.name+(on?" + ":" \u2212 ")+t.name,"admin"); save(); return true; }
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
    <div class="sub">A tag is a label on a person: a grade, a credential, a skill. A cycle\u2019s Rules card can then say a slot needs a tag, or that every AM or PM needs at least so many holders. Tags never leave this group.</div>
    ${rows||'<div class="muted small">No tags yet.</div>'}
    <div class="row" style="margin-top:8px"><label class="field"><span class="lbl">New tag</span><input id="tagNew" placeholder="e.g. Senior" style="width:180px"></label><button class="btn sm" id="tagAdd">Add tag</button></div>
    <div class="muted small" style="margin-top:8px">Hidden means hidden on the screens, not locked away: every member\u2019s app holds the group\u2019s whole record. Tags are for credentials and grades, not for anything confidential.</div></div>`; }
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
function twListHTML(id){ const q=String(_tagWhoQ||"").toLowerCase();   // the Who-holds checklist for one tag: everyone in the group, filtered by the search, holders ticked
  const people=S.staff.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name))).filter(s=>!q||String(s.name).toLowerCase().indexOf(q)>=0);
  return people.map(s=>`<label class="listrow"><input type="checkbox" class="tw-cb" data-sid="${s.id}" ${hasTag(S,s,id)?"checked":""}> ${escapeHTML(s.name)}</label>`).join("")||'<div class="muted small">Nobody matches.</div>'; }
function twWire(root,id){ root.querySelectorAll(".tw-cb").forEach(cb=>cb.onchange=()=>{ personTagSet(cb.dataset.sid,id,cb.checked); }); }
function openTagWho(id){ const t=tagById(S,id); if(!t)return; const root=document.getElementById("modalRoot");
  openDialog(`<div class="overlay" id="ovlTw"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h3 id="dlgT">Who holds ${escapeHTML(t.name)}?</h3>
    <input type="search" id="twQ" placeholder="Search names" value="${escapeHTML(_tagWhoQ)}" aria-label="Search names" style="width:100%;margin:6px 0">
    <div id="twList" style="max-height:50vh;overflow:auto">${twListHTML(id)}</div>
    <div class="flexbtns" style="margin-top:12px"><span class="grow"></span><button class="btn" id="twDone">Done</button></div></div></div>`);
  root.querySelector("#ovlTw").onclick=e=>{ if(e.target.id==="ovlTw"){ closeModal(); render(); } };
  const qi=root.querySelector("#twQ"); if(qi)qi.oninput=()=>{ _tagWhoQ=qi.value; const l=root.querySelector("#twList"); if(l){ l.innerHTML=twListHTML(id); twWire(root,id); } };   // patch the list only: the search box keeps its node, its caret and its text
  twWire(root,id);
  root.querySelector("#twDone").onclick=()=>{ closeModal(); render(); }; }
function myTagsHTML(s){ const ids=personTags(S,s); if(!ids.length)return ""; return `<div class="muted small" style="margin-top:4px">Your tags: ${ids.map(id=>escapeHTML(tagName(S,id))).join(", ")} \u00b7 set by your admin.</div>`; }
function tagsFromCell(str,made){   // "Senior; Triage-trained" → tag ids in list order; a name the group does not have becomes a new tag, hidden by default, and its name goes onto made
  const ids=[]; String(str||"").split(/[;,]/).map(x=>x.trim().slice(0,40)).filter(Boolean).forEach(name=>{ let t=tagList(S).find(x=>String(x.name).toLowerCase()===name.toLowerCase());   // matched on the name as it will be stored, so a long name never makes a second tag
    if(!t){ t={id:tagNewId(),name:name}; (S.tags=Array.isArray(S.tags)?S.tags:[]).push(t); if(made)made.push(t.name); }
    if(ids.indexOf(t.id)<0)ids.push(t.id); });
  const order=tagList(S).map(t=>t.id); return ids.sort((a,b)=>order.indexOf(a)-order.indexOf(b)); }
function rulesCarry(rules,zones){   // a deep copy for the next cycle, without needs for zones it does not have; undefined when nothing is left
  if(!rules||typeof rules!=="object")return undefined; const c=JSON.parse(JSON.stringify(rules)), ids=(zones||[]).map(z=>z.id);
  if(c.needs){ Object.keys(c.needs).forEach(z=>{ if(ids.indexOf(z)<0||!Array.isArray(c.needs[z])||!c.needs[z].length)delete c.needs[z]; }); if(!Object.keys(c.needs).length)delete c.needs; }
  if(c.mins&&!c.mins.length)delete c.mins;
  return Object.keys(c).length?c:undefined; }
function rulesDropZone(cyc,zoneId){ const r=cyc&&cyc.settings&&cyc.settings.rules; if(!r||!r.needs||!(zoneId in r.needs))return; delete r.needs[zoneId]; if(!Object.keys(r.needs).length)delete r.needs; if(!Object.keys(r).length)delete cyc.settings.rules; }   // a zone that goes takes its rule with it
/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------
   Built from the cycle passed in, never from what is on screen, so every device of the group makes the same bytes; entries are sorted and
   the JSON is written with sorted keys for the same reason. Names, slots, periods and times only: never contacts, pay, requests or reasons. */
let _digestHash="", _digestTimer=null, _digestPendingOff=false, _hospGroups=null, _hospGroupsAt=0, _boardCache={rows:[],fetched:0}, _boardBusy=false, _boardTick=null, _demoBoard=false;   // _demoBoard: the sandbox's fictional hospital is in play (local mode only)
function digestClean(s){ return String(s==null?"":s).replace(/[<>\u0000-\u001f\u007f]/g,"").trim().slice(0,80); }   // a name can never carry markup into another group's screen
function stableJSON(o){ if(o===null||typeof o!=="object")return JSON.stringify(o); if(Array.isArray(o))return "["+o.map(stableJSON).join(",")+"]"; return "{"+Object.keys(o).sort().map(k=>JSON.stringify(k)+":"+stableJSON(o[k])).join(",")+"}"; }
function digestHash(s){ let h=5381; for(let i=0;i<s.length;i++)h=(((h*33)>>>0)^s.charCodeAt(i))>>>0; return h.toString(16)+":"+s.length; }
function digestLive(cyc){ return !!cyc&&!cyc.archived&&cyc.status==="published"; }   // published rounds, or a rolling roster that is live; never a draft or a round still booking
function digestDays(cyc,todayISO){ const from=iso(addDays(parseISO(todayISO),-1)); return datesOf(cyc.cycle).map(iso).filter(d=>d>=from); }   // yesterday to the end of the cycle
function digestNoun(st){ return digestClean((st.branding&&st.branding.roleNoun)||""); }
function buildDigest(st,cyc,todayISO){
  const zones=(cyc.settings&&cyc.settings.zones)||st.zones||[], zl=(zid,p)=>{ const z=zones.find(x=>x.id===zid); return z?digestClean(zoneLabel(z,p)):""; };
  const names={}; (st.staff||[]).forEach(s=>{ names[s.id]=digestClean(s.name); }); const lv=st.leave||[], days={};
  const ids=Object.keys(names).filter(sid=>{ const r=cyc.roles&&cyc.roles[sid]; return !!r&&r.in!==false; }).sort();   // only people on this cycle's roster: someone not in the cycle is neither on nor away, whatever leave they hold
  digestDays(cyc,todayISO).forEach(d=>{ const on=[], away=[];
    ids.forEach(sid=>{ const a=(cyc.assign||{})[sid+"|"+d], carries=ocWindows(cyc).filter(w=>ocHolder(cyc,d,w.id)===sid);   // two on-call windows both held today: the rider (oc:true) lands on whichever holder comes first in staff order — a known, harmless flip-flop
      if(a&&a.kind==="clinical"){ const f=fillsOf(cyc,a); f.forEach((p,i)=>{ const e={n:names[sid],r:zl(a.zone,p),p:p,t:windowStr(shiftWindow(cyc,a))}; if(carries.length&&i===f.length-1)e.oc=true; on.push(e); }); }
      else { if((a&&a.kind==="leave")||lv.some(L=>L.staffId===sid&&L.status==="approved"&&L.from<=d&&L.to>=d))away.push(names[sid]);
        carries.forEach(w=>{ on.push({n:names[sid],r:"",p:"",t:ocTime(w),oc:true}); }); } });   // a CST day is neither on nor away
    ciOnDay(cyc,d).forEach(x=>{ if(names[x.sid]!=null)on.push({n:names[x.sid],r:"",p:"",t:ocTime(x.w),ci:true}); });
    const key=e=>(e.p||"")+"|"+(e.r||"")+"|"+(e.n||"")+"|"+(e.t||""); on.sort((x,y)=>key(x)<key(y)?-1:(key(x)>key(y)?1:0)); away.sort();
    if(on.length||away.length)days[d]={on:on,away:away}; });
  return {v:1,noun:digestNoun(st),days:days}; }
function buildDigestAll(st,todayISO,pick){ const days={};   // every published cycle, earliest first; a day appears once (the sandbox passes its own pick: its only cycle is still booking)
  (st.cycles||[]).filter(pick||digestLive).sort((a,b)=>a.cycle.start<b.cycle.start?-1:(a.cycle.start>b.cycle.start?1:0)).forEach(c=>{ const d=buildDigest(st,c,todayISO).days; Object.keys(d).forEach(k=>{ if(!(k in days))days[k]=d[k]; }); });
  return digestTrim({v:1,noun:digestNoun(st),days:days}); }
function utf8Len(s){ let n=0; for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); n+=c<0x80?1:(c<0x800?2:((c&0xF800)===0xD800?2:3)); } return n; }
function digestTrim(out){ const cap=120*1024, keys=Object.keys(out.days).sort();   // too big for the board: drop days from the far end, and say so
  while(keys.length&&utf8Len(stableJSON(out))>cap){ delete out.days[keys.pop()]; out.truncated=true; } return out; }
/* ---------- publishing: after a cloud write lands, or a remote change arrives, the digest is rebuilt on its own timer and written only when its bytes changed ---------- */
function digestOn(){ return cloudOn()&&authState==="in"&&!!_orgHospitalId&&!!(S.board&&S.board.publish); }
function digestSchedule(){ clearTimeout(_digestTimer); _digestTimer=null; if(!digestOn()&&!_digestPendingOff)return false; _digestTimer=setTimeout(digestPublish,30000); return true; }   // its own timer: never _cloudTimer, never _savePending; armed on a pending switch-OFF retry too
function digestPublish(force){   // everything a stub can observe happens before the first await
  if(!cloudOn()||!_sb||!_orgHospitalId||authState!=="in")return null;
  const on=!!(S.board&&S.board.publish), force2=force||(!on&&_digestPendingOff); if(!on&&!force2)return null;
  const data=on?buildDigestAll(S,iso(new Date())):{v:1,noun:digestNoun(S),days:{}};   // switched off: an empty digest is how a group leaves the board, since delete is revoked
  const h=digestHash(stableJSON(data)); if(h===_digestHash&&!force2)return null; _digestHash=h;
  let p=null; try{ p=_sb.from("board_slice").upsert({hospital_id:_orgHospitalId,org:_org,data:data},{onConflict:"hospital_id,org"}); }catch(e){ _digestHash=""; return null; }   // updated is stamped by the server
  return Promise.resolve(p).then(r=>{ if(r&&r.error){ _digestHash=""; console.warn("board",r.error.message||r.error); } else digestLanded(on); return r; }).catch(e=>{ _digestHash=""; console.warn("board",e); }); }
function digestLanded(on){ if(!on)_digestPendingOff=false; }   // the off-write landed cleanly: stop the pending-off retry until the switch goes off again
function setBoardPublish(on){ if(!S.board)S.board={publish:false,show:[]}; S.board.publish=!!on; if(!on)_digestPendingOff=true; logAudit("settings.board",(on?"publishing to":"left")+" the department board","admin"); save(); digestPublish(true); toastSaved("group"); render(); }
/* ---------- the hospital's groups and the board rows: read once, cached on this device ---------- */
function groupsFetch(force){ if(!cloudOn()||!_sb||!_orgHospitalId||authState!=="in")return null; if(!force&&_hospGroups&&Date.now()-_hospGroupsAt<600000)return null;
  let p=null; try{ p=_sb.rpc("hospital_groups",{p_org:_org}); }catch(e){ return null; }
  return Promise.resolve(p).then(r=>{ if(r&&!r.error&&Array.isArray(r.data)){ _hospGroups=r.data.map(g=>({org:String(g.org),label:digestClean(g.label||g.org)})); _hospGroupsAt=Date.now(); bgRender(); } else if(r&&r.error){ console.warn("board",r.error.message||r.error); } }).catch(e=>{ console.warn("board",e); }); }
function hospGroups(){ return _hospGroups||[]; }
/* ---------- the demo sandbox's department: S.demoBoard (written by the seed) names a fictional hospital and its other groups; their digests are built here, at every load, for today's window. Local mode only: with the cloud on this is a no-op, so the real app never reads it. ---------- */
function demoDigest(g,todayISO){ const days={}, people=(Array.isArray(g.people)?g.people:[]).map(x=>digestClean(x)).filter(Boolean), n=people.length, slots=Array.isArray(g.slots)?g.slots:[];
  if(n){ const t0=parseISO(todayISO), e0=parseISO("2026-01-05");   // a fixed Monday as the epoch: the rotation depends on the date alone, so a day reads the same at every visit
    for(let k=-1;k<=14;k++){ const dt=addDays(t0,k), d=iso(dt), di=Math.round((dt-e0)/86400e3), dow=dt.getDay(), wk=(dow===0||dow===6), on=[], away=[], used={};
      slots.forEach((sl,si)=>{ if(sl.weekdays&&wk)return; for(let j=0;j<(+sl.n||0);j++){ const who=people[(di*3+si*5+j*7)%n]; if(used[who])continue; used[who]=1; on.push({n:who,r:digestClean(sl.r||""),p:sl.p==="PM"?"PM":(sl.p==="AM"?"AM":""),t:digestClean(sl.t||"")}); } });
      if(+g.awayEvery>0&&di%(+g.awayEvery)===0){ const cand=people.filter(x=>!used[x]); if(cand.length)away.push(cand[(di*11+3)%cand.length]); }   // someone not on that day is away
      const key=e=>(e.p||"")+"|"+(e.r||"")+"|"+(e.n||"")+"|"+(e.t||""); on.sort((x,y)=>key(x)<key(y)?-1:(key(x)>key(y)?1:0)); away.sort(); days[d]={on:on,away:away}; } }
  return {v:1,noun:digestClean(g.noun||""),days:days}; }
function demoOwnPick(c){ return !!c&&!c.archived; }   // the sandbox's own column: its one cycle is open for booking, which the real board would never publish, so the demo shows it anyway
function applyDemoBoard(){ _demoBoard=false; const b=(typeof S==="object"&&S)?S.demoBoard:null; if(cloudOn()||!b||typeof b!=="object"||!Array.isArray(b.groups)||!b.groups.length)return false;
  const today=iso(new Date()), now=Date.now(), own={org:_org,label:digestClean(b.ownLabel||(S.branding&&S.branding.name)||"This group")};
  _demoBoard=true; _orgHospitalId="demo"; _orgHospital=digestClean(b.hospital||"");
  _hospGroups=[own].concat(b.groups.map(g=>({org:String(g.org),label:digestClean(g.label||g.org)}))); _hospGroupsAt=now;
  _boardCache={rows:b.groups.map(g=>({org:String(g.org),label:digestClean(g.label||g.org),data:demoDigest(g,today),updated:new Date(now-((+g.ago||5)*60000)).toISOString()})),fetched:now}; return true; }
function siblingGroups(){ return hospGroups().filter(g=>g.org!==_org); }
function deptOn(){ return (cloudOn()||_demoBoard)&&!!_orgHospitalId&&hospGroups().length>=2; }   // the department view needs a second group; the sandbox brings its own
function boardFetch(force){ if(!cloudOn()||!_sb||!_orgHospitalId||authState!=="in"||_boardBusy)return null; if(!force&&_boardCache.fetched&&Date.now()-_boardCache.fetched<60000)return null; _boardBusy=true;
  let p=null; try{ p=_sb.rpc("board_for_org",{p_org:_org}); }catch(e){ _boardBusy=false; return null; }
  return Promise.resolve(p).then(r=>{ _boardBusy=false; if(r&&!r.error&&Array.isArray(r.data)){ _boardCache={rows:boardRowsFrom(r.data),fetched:Date.now()}; bgRender(); } else if(r&&r.error){ console.warn("board",r.error.message||r.error); } }).catch(e=>{ _boardBusy=false; console.warn("board",e); }); }
function boardRowsFrom(list){ return (list||[]).filter(x=>x&&x.org!==_org).map(x=>({org:String(x.org),label:digestClean(x.label||x.org),data:(x.data&&typeof x.data==="object")?x.data:null,updated:x.updated||null})); }   // our own column is always the live roster, never a cached copy
function setBoardShow(orgId,on){ if(!S.board)S.board={publish:false,show:[]}; const i=S.board.show.indexOf(orgId); if(on&&i<0)S.board.show.push(orgId); if(!on&&i>=0)S.board.show.splice(i,1);
  logAudit("settings.board","booking sheet "+(on?"shows ":"hides ")+orgId,"admin"); save(); if(on)boardFetch(true); toastSaved("group"); render(); }
function deptCardHTML(){ if(!(cloudOn()||_demoBoard)||!_orgHospitalId)return ""; const b=S.board||{publish:false,show:[]}, sibs=siblingGroups(), where=escapeHTML(_orgHospital||"this hospital");
  return `<div class="sub" style="margin-top:10px"><b>Department board</b></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" id="boardPublish" ${b.publish?"checked":""}> Publish to the department board <span class="muted small">\u2014 shares names, slots and times with the other groups at ${where}. Never contacts, pay or leave reasons.</span></label>
    ${sibs.length?`<div class="muted small" style="margin-top:4px">Show on the booking sheet and the Day board:</div><div style="display:flex;flex-wrap:wrap">${sibs.map(g=>`<label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" class="boardShow" data-org="${escapeHTML(g.org)}" ${b.show.indexOf(g.org)>=0?"checked":""}> ${escapeHTML(g.label)}</label>`).join("")}</div>`:`<div class="muted small" style="margin-top:4px">No other staff group at ${where} yet.</div>`}`; }
/* ---------- Who's on: the Day board across every group in the hospital, a column per group from the digests ---------- */
function scopeSegHTML(){ if(!deptOn())return ""; return `<div class="seg" role="group" aria-label="Which roster"><button class="${dailyScope==="dept"?"":"on"}" data-dscope="group">This group</button><button class="${dailyScope==="dept"?"on":""}" data-dscope="dept">Whole department</button></div>`; }
function deptDates(){ const t=parseISO(iso(new Date())); return {min:iso(addDays(t,-1)),max:iso(addDays(t,14))}; }   // the board is a day sheet: yesterday to a fortnight ahead
function agoText(ts){ const m=Math.max(0,Math.round((Date.now()-ts)/60000)); return m<1?"just now":(m<60?(m+" min ago"):(Math.round(m/60)+" h ago")); }
function onNowAt(t,nowMin){ const m=/^(\d\d):(\d\d)\D+(\d\d):(\d\d)$/.exec(String(t||"")); if(!m)return false; const st=+m[1]*60+ +m[2]; let en=+m[3]*60+ +m[4]; if(en<=st)en+=1440; return nowMin>=st&&nowMin<en; }
function countLine(n,noun){ const r=noun||""; if(!r)return n+(n===1?" person":" people"); return n+" "+(n===1?r:(/s$/.test(r)?r:r+"s")); }
function deptColumns(d,today){ const cache={}; _boardCache.rows.forEach(r=>{ cache[r.org]=r; });   // one column per registry group: ours live, the others from the cache, a missing one says so
  return hospGroups().map(g=>{ if(g.org===_org)return {org:g.org,label:g.label,data:buildDigestAll(S,today,_demoBoard?demoOwnPick:undefined),updated:null,own:true};
    const r=cache[g.org]; return {org:g.org,label:g.label,data:r?r.data:null,updated:r?r.updated:null,own:false}; }); }
function deptColHTML(c,d,today,nowMin){
  const day=(c.data&&c.data.days&&c.data.days[d])||null, on=(day&&Array.isArray(day.on))?day.on:[], away=(day&&Array.isArray(day.away))?day.away:[];
  const when=c.own?"This group, live":(!c.data?"Not published yet":(c.updated?("Updated "+agoText(Date.parse(c.updated))):"Published"));
  const now=e=>d===today&&onNowAt(e.t,nowMin), noun=digestClean((c.data&&c.data.noun)||""), line=countLine(on.length,noun)+((d===today&&on.length)?(" \u00b7 "+on.filter(now).length+" on now"):"");
  const sec=(p,label,cls)=>{ const es=on.filter(e=>(e.p||"")===p); if(!es.length)return "";
    return `<h3 style="margin:10px 0 4px;font-size:var(--fs-md)">${escapeHTML(label)}</h3>`+es.map(e=>`<div class="listrow${now(e)?" onnow":""}"><span class="tag lg ${cls}" style="min-width:62px;text-align:center">${escapeHTML(e.r||(e.ci?"Called in":"On call"))}</span><span class="grow">${escapeHTML(e.n||"")}</span><span class="muted small">${escapeHTML(e.t||"")}</span></div>`).join(""); };
  const body=!c.data?`<div class="muted small">${escapeHTML(c.label)} haven't published to the board.</div>`
    :((on.length?(sec("AM","AM","am")+sec("","On call and call-ins","oc")+sec("PM","PM","pm")):`<div class="muted small">Nobody rostered.</div>`)
      +(away.length?`<h3 style="margin:10px 0 4px;font-size:var(--fs-md)">Away</h3><div>${away.map(n=>`<span class="tag lg leave" style="margin:2px 4px 2px 0;display:inline-block">${escapeHTML(String(n))}</span>`).join("")}</div>`:""));
  const head=`<b>${escapeHTML(c.label)}</b><span class="rowsub">${escapeHTML(line)} \u00b7 ${escapeHTML(when)}</span>`;
  return isMobile()?`<details class="deptcol"><summary>${head}</summary>${body}</details>`:`<div class="deptcol"><div class="depthead">${head}</div>${body}</div>`; }
function deptBoardHTML(){ const today=iso(new Date()), lim=deptDates(); if(!_deptDate||_deptDate<lim.min||_deptDate>lim.max)_deptDate=today; const d=_deptDate, dt=new Date(), nowMin=dt.getHours()*60+dt.getMinutes();
  const nav=`<div class="row" style="align-items:center;margin-top:4px"><button class="btn sm" id="bPrev" aria-label="Previous day">${ic("chevL")}</button><input type="date" id="bDate" value="${d}" min="${lim.min}" max="${lim.max}" aria-label="Day"><button class="btn sm" id="bNext" aria-label="Next day">${ic("chevR")}</button>${phBadge(d)}<span class="grow"></span>${scopeSegHTML()}<button class="btn sm" id="bRefresh">Refresh</button><button class="btn sm" id="bPrint">${ic("print")} Print</button></div>`;
  const cols=deptColumns(d,today).map(c=>deptColHTML(c,d,today,nowMin)).join("");
  return `<div class="card" id="deptCard">${printHeadHTML("Who's on \u00b7 "+fmtISO(d))}<h2>Who's on today</h2>
    <div class="sub">${escapeHTML(_orgHospital||"The department")} \u00b7 ${escapeHTML(parseISO(d).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}))}${_boardCache.fetched?` \u00b7 <span class="scronly">board read ${escapeHTML(agoText(_boardCache.fetched))}</span>`:""}</div>${nav}
    <div class="deptgrid">${cols}</div>${printFootHTML("Names, slots and times as each group published them. Contacts, pay and leave reasons never leave a group.")}</div>`; }
function sibLinesHTML(isoD,p){   // the other groups a sheet shows: who holds that half, read-only, from the board; nothing to book, nothing to wire
  const shows=(S.board&&S.board.show)||[]; if(!shows.length||!deptOn())return "";
  return shows.map(orgId=>{ const g=hospGroups().find(x=>x.org===orgId); if(!g)return ""; const row=_boardCache.rows.find(x=>x.org===orgId), label=escapeHTML(g.label);
    if(!row||!row.data)return `<div class="muted small">${label} haven't published to the board.</div>`;
    const day=row.data.days&&row.data.days[isoD], es=((day&&day.on)||[]).filter(e=>(e.p||"")===p);
    return `<div class="muted small">${label} on: ${es.length?es.map(e=>escapeHTML(e.n||"")+(e.r?" \u00b7 "+escapeHTML(e.r):"")).join(", "):"nobody yet"}</div>`; }).join(""); }
/* ---------- add a staff group in-app: one database function makes the registry row, the empty record and the admins; the new group opens on a reload ---------- */
const GROUP_NOUNS=["consultant","doctor","junior doctor","registrar","intern","nurse","midwife","scribe","clerk","paramedic","pharmacist","radiographer","technician","staff member"];
function canAddGroup(){ return cloudOn()&&authState==="in"&&_realAdmin&&!!_orgHospitalId; }
function addGroupHTML(err){ return `<div class="overlay" id="ovlAg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="agT"><h3 id="agT">Add a staff group</h3>
    <div class="sub">A new roster at ${escapeHTML(_orgHospital||"this hospital")}, beside ${escapeHTML(groupName()||"this group")}. You become its admin. It starts empty; the next screen asks what kind of group it is.</div>
    <label class="field" style="display:block;margin-top:10px"><span class="lbl">Group name</span><input id="agName" maxlength="40" placeholder="e.g. Nurses" style="width:100%"></label>
    <label class="field" style="display:block;margin-top:8px"><span class="lbl">What are its people called? <span class="muted">(singular)</span></span><input id="agNoun" list="agRoles" maxlength="30" placeholder="nurse" style="width:100%"><datalist id="agRoles">${GROUP_NOUNS.map(r=>`<option value="${r}">`).join("")}</datalist></label>
    <label class="field" style="display:block;margin-top:8px"><span class="lbl">Second admin's email <span class="muted">(optional)</span></span><input id="agAdmin2" type="email" placeholder="name@hospital.org.au" style="width:100%"></label>
    ${err?`<div class="note" style="margin-top:8px">${escapeHTML(err)}</div>`:""}
    <div class="flexbtns" style="margin-top:12px"><button class="btn primary" id="agCreate">Create the group</button><button class="btn" id="agCancel">Cancel</button></div></div></div>`; }
function openAddGroup(err,vals){ openDialog(addGroupHTML(err),{focus:"#agName"}); const v=vals||{}; ["agName","agNoun","agAdmin2"].forEach(id=>{ const el=document.getElementById(id); if(el&&v[id]!=null)el.value=v[id]; }); wireAddGroup(); }
function wireAddGroup(){ const nm=document.getElementById("agName"), cr=document.getElementById("agCreate"), cc=document.getElementById("agCancel"), ov=document.getElementById("ovlAg");
  const vals=()=>({agName:(document.getElementById("agName")||{}).value||"",agNoun:(document.getElementById("agNoun")||{}).value||"",agAdmin2:(document.getElementById("agAdmin2")||{}).value||""});
  if(nm&&cr)nm.oninput=()=>{ cr.textContent="Create "+(nm.value.trim()||"the group"); };
  if(cc)cc.onclick=closeModal; if(ov)ov.onclick=e=>{ if(e&&e.target===ov)closeModal(); };
  if(cr)cr.onclick=()=>{ const v=vals(), r=createGroup(v.agName,v.agNoun,v.agAdmin2); if(!r.ok)openAddGroup(r.reason,v); else { cr.disabled=true; cr.textContent="Creating\u2026"; } }; }
function groupCheck(name,noun,admin2){ const n=String(name||"").trim().slice(0,40), r=String(noun||"").trim().toLowerCase().slice(0,30), a=String(admin2||"").trim().toLowerCase();
  if(!canAddGroup())return {ok:false,reason:_realAdmin?"This group isn't under a hospital yet \u2014 ask Myrosta support.":"Only an admin can add a group."};
  if(!n)return {ok:false,reason:"A group needs a name."};
  if(a&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a))return {ok:false,reason:"That second admin's email doesn't look right."};
  return {ok:true,name:n,noun:r,admin2:a}; }
function createGroup(name,noun,admin2){ const c=groupCheck(name,noun,admin2); if(!c.ok)return c; if(!_sb)return {ok:false,reason:"Couldn't reach the server \u2014 try again."};
  let p=null; try{ p=_sb.rpc("create_group",{p_sibling_org:_org,p_label:c.name,p_noun:c.noun,p_admin2_email:c.admin2||null}); }catch(e){ return {ok:false,reason:"Couldn't reach the server \u2014 try again."}; }
  Promise.resolve(p).then(r=>{ if(!r||r.error||!r.data){ openAddGroup(groupErrText(r&&r.error),{agName:c.name,agNoun:c.noun,agAdmin2:c.admin2}); return; } groupCreated(String(r.data),c.name,c.noun); }).catch(()=>openAddGroup("Couldn't reach the server \u2014 try again.",{agName:c.name,agNoun:c.noun,agAdmin2:c.admin2}));
  return {ok:true,name:c.name}; }
function groupErrText(e){ const m=String((e&&e.message)||""); if(/admin/i.test(m))return "Only an admin can add a group."; if(/needs a name/i.test(m))return "A group needs a name."; if(/hospital/i.test(m))return "This group isn't under a hospital yet \u2014 ask Myrosta support."; return "Couldn't reach the server \u2014 try again."; }
function groupCreated(orgId,name,noun){ try{ localStorage.setItem("myrosta_org",orgId); localStorage.setItem("myrosta_newgroup",JSON.stringify({org:orgId,name:name,noun:noun,ts:Date.now()})); }catch(e){} location.reload(); }   // the reload is the existing switch path: no cache can bleed between groups
function groupFirstLoad(){ let m=null; try{ m=JSON.parse(localStorage.getItem("myrosta_newgroup")||"null"); }catch(e){} if(!m||m.org!==_org)return false;   // the group this device just made, on its first load only
  try{ localStorage.removeItem("myrosta_newgroup"); }catch(e){} if(!groupIsFresh())return false;
  if(!S.branding)S.branding={}; if(m.noun)S.branding.roleNoun=String(m.noun).slice(0,30);   // the name comes from the registry label (groupName() falls back to _orgLabel); setting it here would close the kind card
  logAudit("group.create",(m.name||"")+(m.noun?" \u00b7 staff = "+m.noun:""),"admin"); return true; }
function ocMark(cyc,sid,isoD,mini){ const ws=ocTakenBy(cyc,sid,isoD); if(!ws.length)return "";
  return `<span class="tag oc${mini?" mini":""}" title="${escapeHTML("On call "+ws.map(w=>w.label+" "+ocTime(w)).join(" · "))}">${escapeHTML(mini?"OC":ws.map(w=>w.label).join(" · "))}</span>`; }
function ocLine(cyc,sid,isoD){ const ws=ocTakenBy(cyc,sid,isoD); if(!ws.length)return "";
  return ws.map(w=>w.label+" "+ocTime(w)).join(" · "); }
function ocSheetHTML(cyc,sid,isoD,adm,canPick){
  const ws=ocTakenWindows(cyc).filter(w=>!ocChosen(w)), ci=ciSheetRows(cyc,sid,isoD,adm); if(!ws.length&&!ci)return "";
  const past=isRolling(cyc)&&isoD<iso(new Date()), gate=bookingGate(cyc).ok, onLeave=getShift(sid,isoD).kind==="leave", notice=inNotice(isoD,cyc);
  const rows=ws.map(w=>{ const k=ocKey(isoD,w.id), holder=ocHolder(cyc,isoD,w.id), mine=holder===sid;
    const may=adm||(w.book!==false&&gate&&canPick&&!past), mayDrop=adm||(may&&!notice);
    let ctl;
    if(mine)ctl=mayDrop?`<button class="btn" data-ocdrop="${k}">Come off it</button>`:`<span class="tag ok">yours</span>${may?`<span class="muted small">inside the notice period \u2014 ask your admin</span>`:""}`;
    else if(holder)ctl=`<span class="muted small">${escapeHTML(shortNm(S.staff.find(x=>x.id===holder)||{name:"Someone"}))}</span>`;
    else if(onLeave)ctl=`<span class="muted small">on leave that day</span>`;
    else ctl=may?`<button class="btn" data-octake="${k}">Take it</button>`:`<span class="muted small">nobody yet</span>`;
    return `<div class="listrow"><span class="grow"><b>${escapeHTML(w.label)}</b> <span class="muted small">${ocTime(w)}</span></span>${ctl}</div>`; }).join("");
  return `<div class="sub" style="margin-top:14px"><b>On call</b> \u00b7 ${ws.length?"carrying a window isn\u2019t a shift: it takes no zone and counts as nobody\u2019s cover, so you can hold one on a day you also work.":"a call-in is logged once you\u2019ve been called in, with the hours you worked. It takes no zone and isn\u2019t counted as cover."}</div><div class="daylist">${rows}${ci}</div>`; }
function ciTimesHTML(w){ return `<input type="time" class="ci-from" value="${escapeHTML(_ciForm.start)}" aria-label="${escapeHTML(w.label)}: called in from"> <span class="muted small">to</span> <input type="time" class="ci-to" value="${escapeHTML(_ciForm.end)}" aria-label="${escapeHTML(w.label)}: until">`; }   // the From and To boxes of the open call-in form, shared by the day sheet and the cell dialog
function ciOpenForm(k){ const p=ciParse(k), c=active(), w=p&&ocWindow(c,p.win); if(!w)return false;
  const ci=ciGet(c,p.d,p.win,p.sid); _ciForm=Object.assign({k:k},ci?{start:ci.start,end:ci.end}:ciDefaults(w,p.d)); return true; }   // opens the form on a call-in's own hours, or on the defaults for a new one
function ciSaveForm(k,start,end){ const p=ciParse(k); if(!p)return false;
  if(_ciForm&&_ciForm.k===k){ _ciForm.start=start; _ciForm.end=end; }   // a refused save keeps what was typed
  if(!ciSave(p.sid,p.d,p.win,start,end))return false; _ciForm=null; return true; }
function ciSheetRows(cyc,sid,isoD,adm){   // the day sheet's call-in rows: log one once called in, change or remove it, and see who else was called in that day
  const cw=ocTakenWindows(cyc).filter(ocChosen); if(!cw.length)return "";
  const day=ciOnTime(isoD), live=cyc.status!=="draft"&&!cyc.archived, onLeave=getShift(sid,isoD).kind==="leave", all=ciOnDay(cyc,isoD);
  return cw.map(w=>{ const k=ciKey(isoD,w.id,sid), mine=ciGet(cyc,isoD,w.id,sid), may=adm||(w.book!==false&&live&&day&&sid===S.viewAs), mayRemove=adm||(day&&sid===S.viewAs), form=!!(_ciForm&&_ciForm.k===k&&may);
    const others=all.filter(x=>x.w.id===w.id&&x.sid!==sid).map(x=>escapeHTML(shortNm(S.staff.find(p=>p.id===x.sid)||{name:"Someone"}))+" "+ocTime(x.w)).join(" \u00b7 ");
    let ctl;
    if(form)ctl=ciTimesHTML(w)+`<button class="btn primary" data-cisave="${k}">Save</button><button class="btn" data-cicancel="${k}">Cancel</button>`;
    else if(mine)ctl=`<span class="tag oc">Called in ${ocTime(mine)}</span>${may?`<button class="btn" data-ciopen="${k}">Change</button>`:""} ${mayRemove?`<button class="btn" data-cidel="${k}">Remove</button>`:""} `;
    else if(onLeave)ctl=`<span class="muted small">on leave that day</span>`;
    else ctl=may?`<button class="btn" data-ciopen="${k}">I was called in</button>`:`<span class="muted small">${live?"logged on the day you\u2019re called in":"not open yet"}</span>`;
    return `<div class="listrow cirow"><span class="grow"><b>${escapeHTML(w.label)}</b> <span class="muted small">${escapeHTML(ocWhenText(w))}</span>${others?`<div class="muted small">${others}</div>`:""}</span>${ctl}</div>`; }).join(""); }
function ciModalRowHTML(cyc,sid,isoD,w){   // the cell dialog's call-in row: an admin adds, changes or removes one for anyone, on any day
  const k=ciKey(isoD,w.id,sid), ci=ciGet(cyc,isoD,w.id,sid), form=!!(_ciForm&&_ciForm.k===k);
  const ctl=form?ciTimesHTML(w)+`<button class="btn primary sm" data-mcisave="${k}">Save</button><button class="btn sm" data-mcicancel="${k}">Cancel</button>`
    :(ci?`<span class="tag oc">Called in ${ocTime(ci)}</span><button class="btn sm" data-mciopen="${k}">Change</button><button class="btn sm" data-mcidel="${k}">Remove</button>`:`<button class="btn sm" data-mciopen="${k}">Add a call-in</button>`);
  return `<div class="listrow cirow"><span class="grow"><b>${escapeHTML(w.label)}</b> <span class="muted small">${escapeHTML(ocWhenText(w))}</span></span>${ctl}</div>`; }
function receiptText(r){ if(!r.quota)return `Booked ${r.n} · ${r.booked} this cycle`; if(r.booked>r.quota)return `Over your share — ${r.booked} of ${r.quota} booked.`; if(r.booked===r.quota)return `That's your share — ${r.booked} of ${r.quota} booked.`; return `Booked ${r.n} · ${r.booked} of ${r.quota}`; }   // never asserts more than the numbers show
function hasFeed(sid){ const st=S.staff.find(x=>x.id===sid); return !!(cloudOn()&&st&&st.icsToken); }   // a live calendar feed updates itself — no button needed
function calBtnHTML(sid,id){ return hasFeed(sid)?`<span class="muted small">Your calendar feed has it</span>`:`<button class="btn sm"${id?` id="${id}"`:` data-go="${goStr("my","","calSec")}"`}>Add to calendar</button>`; }
function srFooterHTML(sid,s){   // the basket: stays on screen while there are picks, projects the count after Confirm, goes busy while saving, then hands back a receipt
  if(!_srPick.length){ if(_receipt&&_receipt.sid===sid&&(clinicalCountFor(sid)!==_receipt.booked||(_receipt.cycleId&&_receipt.cycleId!==S.activeId)))_receipt=null;   // the receipt never outlives the count or the cycle it quotes
    if(_receipt&&_receipt.sid===sid)return `<div class="srfoot done" role="status"><span class="rcic" aria-hidden="true">${ic("check")}</span><span class="grow"><b>${receiptText(_receipt)}</b></span>${calBtnHTML(sid,"rcCal")}<button class="btn sm" id="rcDone">Done</button></div>`; return ""; }
  const n=_srPick.length, u=_srPick.reduce((a,k)=>a+pickUnits(k),0), now=clinicalCountFor(sid), q=+s.quota||0;   // picks are actions, units are what they cost — a whole-day pick is two
  if(_inflight.has("srConfirm"))return `<div class="srfoot" aria-busy="true"><span><b>${n} picked</b> · saving…</span><span class="grow"></span><button class="btn sm srClear" disabled>Clear</button><button class="btn primary srConfirm" disabled aria-busy="true">Saving…</button></div>`;
  return `<div class="srfoot"><span><b>${n} picked</b> · ${now} → ${now+u}${q?" of "+q:""} after confirm</span><span class="grow"></span><button class="btn sm srClear">Clear</button><button class="btn primary srConfirm">Confirm ${n} pick${n>1?"s":""}</button></div>`; }
function tsFmt(ts){return new Date(ts).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});}
function viewMessages(){
  const me=S.viewAs, adm=isAdmin(), list=msgsFor(me);
  const sel=(v,cur)=>v===cur?"selected":"";
  const composer=adm
    ? `<div class="row" style="align-items:flex-end">
        <label class="field" style="flex:1;min-width:220px"><span class="lbl">Message</span><textarea id="msgText" rows="3" style="width:100%;font-family:inherit;font-size:var(--fs-md);padding:8px 10px;border:1px solid var(--line2);border-radius:var(--radius-sm)"></textarea></label>
        <label class="field"><span class="lbl">Audience</span><select id="msgTo"><option value="all" ${sel("all",replyTo)}>All staff</option>${S.staff.map(s=>`<option value="${s.id}" ${sel(s.id,replyTo)}>${escapeHTML(s.name)}</option>`).join("")}</select></label>
        <button class="btn primary" id="msgSend">Send to all staff</button></div>`
    : `<div class="row" style="align-items:flex-end">
        <label class="field"><span class="lbl">To</span><select id="msgTo"><option value="admin" ${sel("admin",replyTo)}>Admin</option>${S.staff.filter(x=>x.id!==me).map(s=>`<option value="${s.id}" ${sel(s.id,replyTo)}>${escapeHTML(s.name)}</option>`).join("")}</select></label>
        <label class="field" style="flex:1;min-width:200px"><span class="lbl">Message</span><textarea id="msgText" rows="3" style="width:100%;font-family:inherit;font-size:var(--fs-md);padding:8px 10px;border:1px solid var(--line2);border-radius:var(--radius-sm)"></textarea></label>
        <button class="btn primary" id="msgSend">Send message</button></div>`;
  const items=list.length?list.map(m=>{
    const mine=m.from===me, toLabel=m.to==="all"?"All staff":(m.to==="admin"?"Admin":nameOf(m.to));
    const replyId=m.from==="admin"?"admin":m.from;
    return `<div class="msg ${mine?"mine":""}"><div class="meta"><span><b>${escapeHTML(nameOf(m.from))}</b> → ${escapeHTML(toLabel)}</span><span style="margin-left:auto">${tsFmt(m.ts)}</span></div><div>${escapeHTML(m.text)}</div>${mine?"":`<div style="margin-top:6px"><button class="btn sm" data-reply="${replyId}">Reply</button></div>`}</div>`;
  }).join(""):emptyState(EIC.chat,"No messages yet","Messages with your admin and the team will appear here.");
  return `${pageHead(adm?"Messages &amp; broadcasts":"Messages",adm?"":"Your admin and the group")}<div class="card">
    ${cardTitle(adm?"Messages &amp; broadcasts":"Messages")}
    <div class="sub">${adm?"Broadcast to all staff or message one person. Staff replies appear here too.":"Message admin, or a colleague directly — handy to agree a swap before sending a formal request."}</div>
    ${composer}
    <div style="margin-top:16px">${items}</div>
  </div>`;
}
function notifsSheetHTML(){   // the bell opens this sheet; rows with a target take you to the shift, request or round they mention
  const me=S.viewAs, list=notifFor(me).slice().sort((a,b)=>(b.ts||0)-(a.ts||0));   // merge order is not time order
  const today=iso(new Date()), yday=iso(new Date(Date.now()-864e5)); let lastGrp=null;
  const items=list.length?list.map(n=>{
    const read=notifRead(n,me), dk=iso(new Date(n.ts)), grp=dk===today?"Today":(dk===yday?"Yesterday":"Earlier");
    const when=dk===today?new Date(n.ts).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):fmt(new Date(n.ts),{weekday:"short",day:"numeric",month:"short"});
    const kind=n.go?(n.go.anchor==="openshifts"||n.go.anchor==="marketCard"?"live":(n.go.tab==="requests"?"check":(n.go.tab==="selfroster"||n.go.tab==="my"?"cal":(n.go.tab==="messages"?"chat":"bell")))):"bell";
    const body=`<span class="nicon" aria-hidden="true">${ic(kind)}</span><div class="grow"><div class="nt">${escapeHTML(n.text)}</div><div class="muted small">${when}</div></div>`;
    const lbl=grp!==lastGrp?`<div class="sheetlbl">${grp}</div>`:""; lastGrp=grp;
    return lbl+(n.go?`<button class="notif act ${read?"read":""}" data-go="${escapeHTML(goStr(n.go.tab,n.go.cycle,n.go.anchor))}">${body}<span class="chev">${ic("chevR")}</span></button>`:`<div class="notif ${read?"read":""}">${body}</div>`);
  }).join(""):(whatsNewDue()?"":emptyState(EIC.bell,"You're all caught up","Approvals, roster changes and alerts will appear here."));
  const wn=whatsNewDue()?`<div class="sheetlbl">New in Myrosta</div><button class="notif act" data-go="${goStr("help","","whatsnew")}"><span class="nicon brand" aria-hidden="true">${markSVG("")}</span><div class="grow"><div class="nt">What's new in Myrosta · ${escapeHTML(WHATS_NEW[0].title)}</div><div class="muted small">${WHATS_NEW[0].lines.length} changes · build ${fmtBuild(BUILD)}</div></div><span class="chev">${ic("chevR")}</span></button>`:"";
  return `<div class="overlay sheetwrap" id="ovlNotifs"><div class="sheet" role="dialog" aria-modal="true" aria-label="Notifications"><div class="sheetgrab"></div>
    <div class="sheethd"><h2 style="font-size:var(--fs-lg)">Notifications</h2><span class="grow"></span>${unreadCount(me)?`<button class="btn sm" id="notifsRead">Mark all read</button>`:""}</div>${wn}${items}</div></div>`;
}
function viewNotifs(){ return viewMy(); }   // "notifs" is no longer a tab (render() normalises it to "my" before the chrome is built)

/* ---------- requests, leave planner, audit, email, export ---------- */
let lastEmail=null, plannerMonth=null;
function requestHoursDays(r){const days=daysInRange(r.dateFrom,r.dateTo).length;const s=S.staff.find(x=>x.id===r.from)||{hrsFortnight:76};return {days:days,hrs:Math.round(days*hoursPerDay(s))};}
function submitLeaveRequest(staffId,from,to,code,reason){
  S.requests.unshift({id:"r"+Date.now(),type:"leave",from:staffId,dateFrom:from,dateTo:to,code:code,reason:reason||"",status:"pending",createdTs:Date.now()});
  notify("admin",nameOf(staffId)+" requested "+(LEAVE_LABEL[code]||code)+" · "+reqDates(S.requests[0])+".",null,{tab:"requests"});
  logAudit("leave.request",(LEAVE_LABEL[code]||code)+" "+from+"→"+to+(reason?(" · "+reason):""),staffId);
  save();
}
function approveRequest(id,comment){
  const r=S.requests.find(x=>x.id===id);if(!r)return;
  r.status="approved";r.decidedTs=Date.now();r.adminComment=comment||"";
  if(r.type==="fixed"){ const s=S.staff.find(x=>x.id===r.from); if(s){ r.pattern.committed=true; s.fixedPattern=r.pattern; }
    notify(r.from,"Your fixed-pattern change was approved."+(comment?(" "+comment):""),null,{tab:"requests"});
    logAudit("fixed.approve",nameOf(r.from)+" · "+fixedPatternSummary(r.pattern)+(comment?(" · "+comment):""),"admin"); save(); return; }
  if(r.type==="leave"){
    const dates=daysInRange(r.dateFrom,r.dateTo);
    const _today=iso(new Date());
    S.cycles.forEach(c=>dates.forEach(d=>{ const k=r.from+"|"+d, was=c.assign[k];
      delete c.assign[k];
      if(was&&was.kind==="clinical"&&d>=_today&&gapOnDrop(c))_postGapBody(c.id,d,was.period,was.zone,was.type||null,"leave approved",null,false);
      ocTakenBy(c,r.from,d).filter(w=>!w.ci).forEach(w=>{ delete c.oncall[ocKey(d,w.id)]; }); }));   // somebody on leave is not carrying the phone either   // not a day already gone, and no push: this runs outside commitGuarded, which is what sends them   // the day a person's leave frees is a gap like any other — the group hears about it
    addLeave({staffId:r.from,from:r.dateFrom,to:r.dateTo,code:r.code,status:"approved",requestId:id}); swTidy();
  }
  notify(r.from,"Your "+(LEAVE_LABEL[r.code]||r.code)+" request for "+reqDates(r)+" was approved."+(comment?(" "+comment):""),null,{tab:"requests"});
  logAudit("leave.approve",nameOf(r.from)+" "+r.code+" "+r.dateFrom+"→"+r.dateTo+(comment?(" · "+comment):""),"admin");
  prepEmail(r,"approved",comment);save();
}
function declineRequest(id,comment){
  const r=S.requests.find(x=>x.id===id);if(!r)return;
  r.status="declined";r.decidedTs=Date.now();r.adminComment=comment||"";
  if(r.type==="fixed"){ notify(r.from,"Your fixed-pattern change was declined."+(comment?(" "+comment):""),null,{tab:"requests"});
    logAudit("fixed.decline",nameOf(r.from)+(comment?(" · "+comment):""),"admin"); save(); return; }
  notify(r.from,"Your "+(LEAVE_LABEL[r.code]||r.code)+" request for "+reqDates(r)+" was declined."+(comment?(" "+comment):""),null,{tab:"requests"});
  logAudit("leave.decline",nameOf(r.from)+" "+r.code+" "+r.dateFrom+"→"+r.dateTo+(comment?(" · "+comment):""),"admin");
  prepEmail(r,"declined",comment);save();
}
function prepEmail(r,decision,comment){
  const s=S.staff.find(x=>x.id===r.from)||{name:nameOf(r.from),email:""};
  lastEmail={to:s.email||s.email2||"",subject:"Leave request "+decision+": "+r.dateFrom+" to "+r.dateTo,
    body:"Dear "+s.name+",\n\nYour request for "+(LEAVE_LABEL[r.code]||r.code)+" leave from "+r.dateFrom+" to "+r.dateTo+" has been "+decision+"."+(comment?("\n\nComment: "+comment):"")+"\n\nKind regards,\nMyrosta — Roster Admin"};
}
function openEmailModal(){
  if(!lastEmail)return;const e=lastEmail;
  const root=document.getElementById("modalRoot");
  openDialog(`<div class="overlay" id="ovlE"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT" style="max-width:540px">
    <h3 id="dlgT">Notification email</h3>
    <div class="muted small" style="margin-bottom:10px">Editable draft. In production this is sent automatically via the hospital mail service / Microsoft 365.</div>
    <label class="field" style="margin-bottom:8px"><span class="lbl">To</span><input id="emTo" value="${escapeHTML(e.to)}" placeholder="staff email"></label>
    <label class="field" style="margin-bottom:8px"><span class="lbl">Subject</span><input id="emSub" value="${escapeHTML(e.subject)}" style="width:100%"></label>
    <label class="field"><span class="lbl">Body</span><textarea id="emBody" rows="9" style="width:100%;font-family:inherit;font-size:var(--fs-md);padding:8px 10px;border:1px solid var(--line2);border-radius:var(--radius-sm)">${escapeHTML(e.body)}</textarea></label>
    <div class="flexbtns" style="margin-top:14px"><button class="btn" id="emCopy">Copy</button><span class="grow"></span><button class="btn" id="emClose">Close</button><button class="btn primary" id="emOpen">Open in email app</button></div>
  </div></div>`);
  const close=closeModal;
  document.getElementById("ovlE").onclick=ev=>{if(ev.target.id==="ovlE")close();};
  document.getElementById("emClose").onclick=close;
  document.getElementById("emCopy").onclick=()=>{try{navigator.clipboard.writeText(document.getElementById("emBody").value);}catch(x){}};
  document.getElementById("emOpen").onclick=()=>{
    const to=document.getElementById("emTo").value,su=document.getElementById("emSub").value,bo=document.getElementById("emBody").value;
    logAudit("email.sent","To "+(to||"(no address)")+" · "+su,"admin");save();
    window.location.href="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent(su)+"&body="+encodeURIComponent(bo);
    close();render();
  };
}
let swapPeer=null, _swapMode="peer", _swapMine=null, _swapNote="";   // the swap sheet: which choice is showing, the shift chosen (Swap it on a day sheet sets it), and any typed note
/* ---------- swaps without naming one colleague: Ask everyone ----------
   A consultant asks about one of their clinical shifts; each colleague who could take it may offer one of their own shifts
   back; the asker accepts one, and it becomes an ordinary swap request, already agreed, for an admin to approve. S.openSwaps
   holds the asks and S.swapOffers the offers, both merged item by item. Whether an ask or an offer still holds is worked out
   from the roster every time it is read, so a stale one can never be accepted, even when nothing closed it. */
function swCycleOf(o){ return (S.cycles||[]).find(c=>c.id===(o&&o.cycleId))||null; }
function swLive(cyc){ return !!cyc&&!cyc.archived&&cyc.status!=="draft"; }
function swShiftOf(cyc,sid,isoD){ const v=cyc&&cyc.assign&&cyc.assign[sid+"|"+isoD]; return (v&&v.kind==="clinical")?Object.assign({kind:"clinical",period:v.period,zone:v.zone,type:v.type||null},(v.hours&&hoursOK(v.hours.start,v.hours.end))?{hours:{start:v.hours.start,end:v.hours.end}}:{}):null; }   // the snapshot carries the hours so an offer can say them; swSame still reads period, zone and type alone
function swSame(a,b){ return !!a&&!!b&&a.period===b.period&&a.zone===b.zone&&(a.type||null)===(b.type||null); }
function swFree(cyc,sid,isoD){ const v=cyc&&cyc.assign&&cyc.assign[sid+"|"+isoD]; return !(v&&v.kind&&v.kind!=="off")&&!leaveOn(sid,isoD); }   // no shift of any kind and no leave, UA included
function swOnRoster(cyc,sid){ const s=S.staff.find(x=>x.id===sid), r=cyc&&cyc.roles&&cyc.roles[sid]; return !!s&&isClinical(s)&&!!r&&r.in!==false; }   // read from the cycle itself, which need not be the one on screen; no entry means not on it
function ruleSwapJudge(st,cA,a,dateA,shA,cB,b,dateB,shB){   // a swap judged as a pair: b takes a's shift on dateA, a takes b's on dateB. "" when it may go ahead, else why not — the same answer from either side
  if(!rulesPresent(cA)&&!rulesPresent(cB))return "";
  const lands=(cyc,who,d,sh)=>{ const p=((st&&st.staff)||[]).find(x=>x.id===who)||null, need=(rulesOf(cyc).needs[(sh||{}).zone]||[]).filter(t=>tagById(st,t)), miss=need.find(t=>!hasTag(st,p,t)); if(!miss)return "";
    const z=(((cyc.settings&&cyc.settings.zones)||st.zones||[]).find(x=>x.id===sh.zone)); return nameOf(who)+" can\u2019t take "+(z?zoneLabelFor(cyc,z,sh):"that slot")+" on "+fmtISO(d)+" \u2014 it needs "+tagName(st,miss)+"."; };
  const worse=(cyc,d,fills,o)=>{ const before=ruleCounts(cyc,st,d,null), after=ruleCounts(cyc,st,d,o); let bad="";   // for each half and tag: the shortfall after must not exceed the shortfall before
    fills.forEach(P=>{ if(bad)return; const b0=ruleShort(cyc,st,d,P,before[P]), a0=ruleShort(cyc,st,d,P,after[P]);
      a0.forEach((s,i)=>{ if(!bad&&s.short>(b0[i]?b0[i].short:0))bad=fmtISO(d)+" "+((typeById(cyc,P)||{}).label||P)+" would be short of a "+tagName(st,s.tag)+"."; }); }); return bad; };
  return lands(cA,b,dateA,shA)||lands(cB,a,dateB,shB)||worse(cA,dateA,fillsOf(cA,shA),{without:[a,b],with:[{sid:b,fills:fillsOf(cA,shA),zone:shA.zone}]})||worse(cB,dateB,fillsOf(cB,shB),{without:[a,b],with:[{sid:a,fills:fillsOf(cB,shB),zone:shB.zone}]}); }
function swOfferable(o,sid){ const c=swCycleOf(o), today=iso(new Date());   // the shifts sid could offer back: their own, on a day to come, where the asker is free, and where the swap keeps every half whole
  if(!c||!swOnRoster(c,sid)||!swFree(c,sid,o.dateA))return [];
  const mine=swShiftOf(c,o.from,o.dateA)||o.shift;
  return datesOf(c.cycle).map(iso).filter(d=>d>=today).map(d=>({d:d,shift:swShiftOf(c,sid,d)})).filter(x=>x.shift&&swFree(c,o.from,x.d)&&!ruleSwapJudge(S,c,o.from,o.dateA,mine,c,sid,x.d,x.shift)); }
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
  const rj=ruleSwapJudge(S,c,o.from,o.dateA,swShiftOf(c,o.from,o.dateA)||o.shift,c,f.by,f.dateB,f.shift); if(rj)return rj.replace(/\.$/,"");   // tags are read as they stand now
  return ""; }
function swShiftText(cyc,sh){ const z=((cyc&&cyc.settings&&cyc.settings.zones)||S.zones||[]).find(x=>x.id===sh.zone); return (z?zoneLabelFor(cyc,z,sh)+" ":"")+typeLabelOf(cyc,sh)+ownHoursTag(cyc,sh); }   // "Resus AM", in the ask's own cycle
function swOfferLabel(cyc,isoD,sh){ return fmtISO(isoD)+" \u00b7 "+swShiftText(cyc,sh)+" \u00b7 counts "+shiftUnits(cyc,sh); }   // every offer says what it counts, so a full day for a half day surprises nobody
function swapAskRefusal(sid,isoD){ const c=active();   // "" when sid may ask everyone about their shift on isoD, in the cycle on screen
  if(!swLive(c))return "This roster isn\u2019t live yet.";
  if(!isoD||isoD<iso(new Date()))return "That day has passed.";
  if(!swShiftOf(c,sid,isoD))return "No clinical shift to swap that day.";
  if((S.openSwaps||[]).some(o=>o.from===sid&&o.dateA===isoD&&swAskWhy(o)===""))return "You\u2019re already asking everyone about that shift.";
  if((S.requests||[]).some(r=>r.type==="swap"&&["pending","awaiting-peer","info"].indexOf(r.status)>=0&&((r.from===sid&&r.dateA===isoD)||(r.peerId===sid&&r.dateB===isoD))))return "You already have a swap waiting for that shift.";   // named or through Ask everyone, on either side of it
  return ""; }
function swTidy(){ const today=iso(new Date());   // after a roster change: close each ask and offer the roster no longer supports, and tell whoever offered. A day gone only reads as closed, so nothing is written for it
  osTidy();   // first, the give-aways and asks to come off that stood on a shift now moved
  (S.openSwaps||[]).forEach(o=>{ if(o.status!=="open"||o.dateA<today)return;
    const why=swAskWhy(o);
    if(why){ o.status="closed"; o.why=why; swCloseOffers(o,nameOf(o.from)+"\u2019s swap request for "+fmtISO(o.dateA)+" has closed: "+why+"."); logAudit("swap.ask-close",nameOf(o.from)+" "+o.dateA+" \u00b7 "+why,S.viewAs); return; }
    (S.swapOffers||[]).filter(f=>f.openId===o.id&&f.status==="open"&&f.dateB>=today).forEach(f=>{ const w=swOfferWhy(f);
      if(w){ f.status="closed"; notify(f.by,"Your offer of "+fmtISO(f.dateB)+" for "+nameOf(o.from)+"\u2019s "+fmtISO(o.dateA)+" shift has closed: "+w+".",null,{tab:"requests",cycle:o.cycleId}); } }); }); }
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
    logAudit("swap.ask",nameOf(sid)+" "+isoD+" "+swShiftText(c,o.shift)+" \u00b7 "+who.length+" asked",sid);
    _osPushQueue={type:"swap",osId:id,title:"Swap wanted \u2014 "+what,body:nameOf(sid)+" is looking for a swap. Tap to offer one of your shifts.",targets:who};   // only the colleagues who could take it
    return {ok:true}; }); }
function swapOffer(openId,isoB){
  return commitGuarded(()=>{ const me=S.viewAs, o=(S.openSwaps||[]).find(x=>x.id===openId);
    if(!o)return {ok:false,reason:"That swap request is gone."};
    const why=swAskWhy(o); if(why)return {ok:false,reason:"That swap request is closed: "+why+"."};
    const pick=swOfferable(o,me).find(x=>x.d===isoB); if(!pick)return {ok:false,reason:"You can\u2019t offer that shift for this swap."};
    const c=swCycleOf(o), mine=S.swapOffers.find(f=>f.openId===o.id&&f.by===me&&f.status==="open");   // one offer each: offering again changes it
    if(mine){ mine.dateB=isoB; mine.shift=pick.shift; mine.ts=Date.now(); }
    else S.swapOffers.unshift({id:"so"+Date.now()+Math.random().toString(36).slice(2,5),openId:o.id,by:me,dateB:isoB,shift:pick.shift,status:"open",ts:Date.now()});
    notify(o.from,nameOf(me)+(mine?" changed their offer to ":" offers ")+fmtISO(isoB)+" "+swShiftText(c,pick.shift)+" for your "+fmtISO(o.dateA)+" shift.",null,{tab:"requests",cycle:o.cycleId});
    logAudit("swap.offer",nameOf(me)+" "+isoB+" "+swShiftText(c,pick.shift)+" for "+nameOf(o.from)+" "+o.dateA,me);
    return {ok:true}; }); }
function swapOfferWithdraw(offerId){
  return commitGuarded(()=>{ const f=(S.swapOffers||[]).find(x=>x.id===offerId);
    if(!f||f.by!==S.viewAs)return {ok:false,reason:"That offer isn\u2019t yours."};
    if(f.status!=="open")return {ok:false,reason:"That offer is already closed."};
    const o=(S.openSwaps||[]).find(x=>x.id===f.openId);
    f.status="withdrawn";
    if(o&&o.status==="open")notify(o.from,nameOf(f.by)+" withdrew their offer for your "+fmtISO(o.dateA)+" shift.",null,{tab:"requests",cycle:o.cycleId});
    logAudit("swap.offer-withdraw",nameOf(f.by)+" "+f.dateB+(o?" for "+nameOf(o.from)+" "+o.dateA:""),f.by);
    return {ok:true}; }); }
function swapAccept(offerId,seen){   // seen (optional): the offer as its confirm showed it, {dateB, shift}
  return commitGuarded(()=>{ const f=(S.swapOffers||[]).find(x=>x.id===offerId), o=f&&(S.openSwaps||[]).find(x=>x.id===f.openId);
    if(!o)return {ok:false,reason:"That offer is gone."};
    if(o.from!==S.viewAs)return {ok:false,reason:"Only "+nameOf(o.from)+" can accept an offer for their shift."};
    if(seen&&(f.dateB!==seen.dateB||!swSame(f.shift,seen.shift)))return {ok:false,reason:"That offer has just changed. Look at it again before accepting."};   // a Change offer can land between the confirm opening and Accept
    const why=swOfferWhy(f); if(why)return {ok:false,reason:"That offer can\u2019t be accepted: "+why+"."};   // read again inside the write, so two phones cannot both finish it
    const rid="r"+Date.now()+Math.random().toString(36).slice(2,5);
    S.requests.unshift({id:rid,type:"swap",from:o.from,dateA:o.dateA,peerId:f.by,dateB:f.dateB,reason:o.note||"",status:"pending",peerAgreed:true,openId:o.id,createdTs:Date.now()});   // an ordinary swap, already agreed: the admin's card and approval are unchanged
    o.status="done"; o.swapId=rid; f.status="accepted";
    swCloseOffers(o,nameOf(o.from)+" found a swap for "+fmtISO(o.dateA)+". Thank you for offering.");
    notify(f.by,nameOf(o.from)+" accepted your offer of "+fmtISO(f.dateB)+" for their "+fmtISO(o.dateA)+" shift. It has gone to your admin.",null,{tab:"requests",cycle:o.cycleId});
    notify("admin",nameOf(o.from)+" and "+nameOf(f.by)+" agreed a swap through Ask everyone \u2014 awaiting approval.",null,{tab:"requests"});
    logAudit("swap.accept","with "+nameOf(f.by)+" "+o.dateA+" \u2194 "+f.dateB,o.from);
    return {ok:true}; }); }
function swapAskWithdraw(openId){
  return commitGuarded(()=>{ const o=(S.openSwaps||[]).find(x=>x.id===openId);
    if(!o||o.from!==S.viewAs)return {ok:false,reason:"That swap request isn\u2019t yours."};
    if(o.status!=="open")return {ok:false,reason:o.status==="done"?"You already accepted an offer.":"That swap request is already closed."};
    o.status="closed"; o.why="withdrawn";
    swCloseOffers(o,nameOf(o.from)+" no longer needs a swap for "+fmtISO(o.dateA)+".");
    logAudit("swap.ask-withdraw",nameOf(o.from)+" "+o.dateA,o.from);
    return {ok:true}; }); }
function staffAssignments(staffId){const a=active().assign;const out=[];cycleDates().forEach(d=>{const sh=a[staffId+"|"+iso(d)];if(sh&&(sh.kind==="clinical"||sh.kind==="cst"))out.push({date:iso(d),label:shiftLabel(sh)});});return out;}
function viewRequests(){
  if(isAdmin()){
    const pending=S.requests.filter(r=>r.status==="pending"||r.status==="info");
    const cancelReqs=S.requests.filter(r=>r.status==="approved"&&r.cancelState==="requested");
    const decided=S.requests.filter(r=>["approved","declined","cancelled","withdrawn"].includes(r.status)&&r.cancelState!=="requested");
    const asks=pendingAsks(), askCards=asks.map(askAdminCard).join("");
    const cards=(pending.length||asks.length)?(askCards+(pending.length?pending.map(r=>r.type==="swap"?swapAdminCard(r):r.type==="fixed"?fixedAdminCard(r):requestAdminCard(r)).join(""):"")):'<div class="card">'+emptyState(EIC.check,"No pending requests","Leave and swap requests will appear here for you to approve.")+'</div>';
    const cancelCard=cancelReqs.length?('<h3 style="font-size:var(--fs-md);margin:18px 0 6px">Cancellation requests</h3>'+cancelReqs.map(r=>`<div class="card" style="border-left:4px solid var(--leave-t)"><div class="row" style="align-items:flex-end"><span class="grow">${r.type==="swap"?("Swap "+escapeHTML(nameOf(r.from))+" ↔ "+escapeHTML(nameOf(r.peerId))+" · "+reqDates(r)):r.type==="fixed"?(escapeHTML(nameOf(r.from))+" · fixed-pattern change"):(escapeHTML(nameOf(r.from))+" · "+escapeHTML(LEAVE_LABEL[r.code]||r.code)+" · "+reqDates(r))} <span class="tag warn">cancellation requested</span></span><div class="field" style="flex:1;min-width:140px"><input id="cmt-${r.id}" placeholder="Comment (optional)"></div><button class="btn sm" data-cancelkeep="${r.id}">Keep the approval</button><button class="btn danger sm" data-cancelapprove="${r.id}">Cancel the ${reqKindLabel(r)}</button></div></div>`).join("")):"";
    const hist=decided.length?('<h3 style="font-size:var(--fs-md);margin:18px 0 6px">Decided</h3><div class="card">'+decided.map(r=>`<div class="listrow"><span class="grow">${r.type==="swap"?("Swap "+escapeHTML(nameOf(r.from))+" ↔ "+escapeHTML(nameOf(r.peerId))):r.type==="fixed"?(escapeHTML(nameOf(r.from))+" · fixed-pattern change"):(escapeHTML(nameOf(r.from))+" · "+escapeHTML(LEAVE_LABEL[r.code]||r.code)+" · "+reqDates(r))} ${reqStatusTag(r)}${r.adminComment?` · <span class="muted small">${escapeHTML(r.adminComment)}</span>`:""}</span>${r.status==="approved"?`<button class="btn danger sm" data-cancel="${r.id}">Cancel the ${reqKindLabel(r)}</button>`:""}</div>`).join("")+'</div>'):"";
    return `<div style="margin-bottom:8px"><h2>Requests</h2><div class="sub">${pending.length+asks.length} pending${clockCount(active(),clockNow())?(" \u00b7 "+clockCount(active(),clockNow())+" hour"+(clockCount(active(),clockNow())===1?"":"s")+" to approve"):""}${cancelReqs.length?(" · "+cancelReqs.length+" cancellation request(s)"):""}. Approvals update the roster automatically; cancelling an approved item reverses it.</div></div>${clockListHTML()}${cards}${cancelCard}${hist}`;
  }
  const me=S.viewAs, mine=S.requests.filter(r=>r.from===me);
  const peerReqs=S.requests.filter(r=>r.type==="swap"&&r.peerId===me&&r.status==="awaiting-peer"), asks=mine.filter(r=>r.status==="info");
  const agreed=(_settled&&_settled.kind==="agree")?`<div class="card"><div class="listrow settled" role="status"><span class="rcic" aria-hidden="true">${ic("check")}</span><span class="grow">You agreed — ${escapeHTML(_settled.name)} has been told and it's gone to admin.</span></div></div>`:"";
  const needsYou=(peerReqs.length||asks.length)?`<div class="card"><h2>Needs you</h2>${peerReqs.map(r=>`<div class="listrow"><span class="grow">${escapeHTML(nameOf(r.from))} offers their <b>${escapeHTML(shiftLabel(getShift(r.from,r.dateA)))}</b> on ${fmtISO(r.dateA)} for your <b>${escapeHTML(shiftLabel(getShift(r.peerId,r.dateB)))}</b> on ${fmtISO(r.dateB)}${r.reason?` · ${escapeHTML(r.reason)}`:""}</span><button class="btn danger" data-peerdecline="${r.id}">Decline</button><button class="btn primary" data-peeragree="${r.id}">Agree</button></div>`).join("")}${asks.map(myReqRow).join("")}</div>`:"";
  const list=`<div class="card"><h2>Your requests</h2>${mine.length?mine.filter(r=>r.status!=="info").map(myReqRow).join("")+(asks.length&&mine.length===asks.length?'<div class="muted small">Your open question is under Needs you.</div>':""):emptyState(EIC.doc,"No requests yet","Leave and swap requests you send will show here with their status.")}</div>`;
  const btns=`<div class="actrow"><button class="btn primary" id="reqLeave">Request leave</button><button class="btn" id="reqSwap">Request a swap</button></div>`;
  const _need=peerReqs.length+asks.length;
  return pageHead("Requests",_need?(_need+" need"+(_need>1?"":"s")+" you"):"Leave and swaps")+agreed+needsYou+swapAskingHTML(me)+swapWantedHTML(me)+list+btns;
}
function reqSheetHTML(kind){   // the leave and swap forms as sheets — same ids as before, one verb: Send … request
  const me=S.viewAs, ds=cycleDates(), today=iso(new Date()), first=ds.find(d=>iso(d)>=today), def=first?iso(first):today; let form;
  if(kind==="leave"){
    form=`<h3>Request leave</h3><div class="sub">Goes to your admin. You'll get a notification when it's decided.</div>
    <div class="row">
      <label class="field"><span class="lbl">From</span><input type="date" id="lvFrom" value="${def}"></label>
      <label class="field"><span class="lbl">To</span><input type="date" id="lvTo" value="${def}"></label>
      <label class="field"><span class="lbl">Type</span><select id="lvCode">${["AL","CME","UPL","LSL","Sab","PL","UA","PH","Other"].map(c=>`<option value="${c}">${c} — ${LEAVE_LABEL[c]||c}</option>`).join("")}</select></label>
      <label class="field" style="flex:1;min-width:160px"><span class="lbl">Reason</span><input id="lvReason" placeholder="Optional"></label>
    </div>
    <div class="flexbtns" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="reqCancel">Cancel</button><button class="btn primary" id="lvSubmit">Send leave request</button></div>`;
  } else {
    const myShifts=staffAssignments(me), others=S.staff.filter(x=>x.id!==me);
    if(swapPeer&&!others.find(o=>o.id===swapPeer))swapPeer=null;
    const peerShifts=swapPeer?staffAssignments(swapPeer):[];
    const seg=`<div class="seg" id="swModeSeg" role="group" aria-label="How to find a swap" style="margin:8px 0"><button data-swmode="peer" class="${_swapMode==="all"?"":"on"}">With a colleague</button><button data-swmode="all" class="${_swapMode==="all"?"on":""}">Ask everyone</button></div>`;
    if(_swapMode==="all")form=swapAllFormHTML(me,seg);
    else form=`<h3>Request a swap</h3>${seg}<div class="sub">You give one of your shifts and take a colleague's. They agree first, then your admin approves. Tip: agree it in Messages first.</div>
    <div class="row">
      <label class="field"><span class="lbl">My shift</span><select id="swMine">${myShifts.length?myShifts.map(x=>`<option value="${x.date}"${x.date===_swapMine?" selected":""}>${escapeHTML(fmtISO(x.date))} · ${x.label}</option>`).join(""):'<option value="">— you have no shifts —</option>'}</select></label>
      <label class="field"><span class="lbl">Colleague</span><select id="swPeer"><option value="">Select…</option>${others.map(o=>`<option value="${o.id}" ${o.id===swapPeer?"selected":""}>${escapeHTML(o.name)}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">Their shift</span><select id="swTheirs" ${swapPeer?"":"disabled"}>${peerShifts.length?peerShifts.map(x=>`<option value="${x.date}">${escapeHTML(fmtISO(x.date))} · ${x.label}</option>`).join(""):`<option value="">${swapPeer?"— none —":"pick colleague first"}</option>`}</select></label>
      <label class="field" style="flex:1;min-width:140px"><span class="lbl">Reason</span><input id="swReason" placeholder="Optional" value="${escapeHTML(_swapNote)}"></label>
    </div>
    <div class="flexbtns" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="reqCancel">Cancel</button><button class="btn primary" id="swSubmit">Send swap request</button></div>`;
  }
  return `<div class="overlay sheetwrap" id="ovlReq"><div class="sheet reqsheet" role="dialog" aria-modal="true" aria-label="${kind==="leave"?"Request leave":"Request a swap"}"><div class="sheetgrab"></div>${form}</div></div>`;
}
function swapAllFormHTML(me,seg){   // the swap sheet's Ask everyone: one of your shifts to come, an optional note, and who it will reach
  const c=active(), today=iso(new Date()), mine=staffAssignments(me).filter(x=>x.date>=today&&swShiftOf(c,me,x.date));
  const pick=mine.some(x=>x.date===_swapMine)?_swapMine:(mine[0]?mine[0].date:"");
  const bad=pick?swapAskRefusal(me,pick):"You have no shifts coming up to swap.", n=bad?0:swWho({cycleId:c.id,from:me,dateA:pick}).length;
  const reach=bad||(n?("Goes to "+n+(n===1?" colleague who is":" colleagues who are")+" free on "+fmtISO(pick)+"."):("Nobody is free on "+fmtISO(pick)+" with a shift you could take in return."));
  return `<h3>Request a swap</h3>${seg}<div class="sub">Everyone who could take it can offer one of their shifts. You pick one, then your admin approves.</div>
    <div class="row">
      <label class="field"><span class="lbl">My shift</span><select id="swMine">${mine.length?mine.map(x=>`<option value="${x.date}"${x.date===pick?" selected":""}>${escapeHTML(fmtISO(x.date)+" \u00b7 "+x.label)}</option>`).join(""):`<option value="">No shifts coming up</option>`}</select></label>
      <label class="field" style="flex:1;min-width:160px"><span class="lbl">Note</span><input id="swNote" placeholder="Optional" value="${escapeHTML(_swapNote)}"></label>
    </div>
    <div class="${n?"muted small":"note"}" id="swReach">${escapeHTML(reach)}</div>
    <div class="flexbtns" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="reqCancel">Cancel</button><button class="btn primary" id="swAsk"${n?"":" disabled"}>Ask everyone</button></div>`; }
function swKeepNote(){ const el=document.getElementById(_swapMode==="all"?"swNote":"swReason"); if(el)_swapNote=el.value||""; }   // the note survives the sheet's own re-renders
function swapAskingHTML(me){ const c=active(), today=iso(new Date());   // Requests, for the asker: each open ask with its offers, and Accept on each one that still holds
  const L=(S.openSwaps||[]).filter(o=>o.from===me&&o.cycleId===c.id&&o.status==="open"&&o.dateA>=today);
  if(!L.length)return "";
  return `<div class="card"><h2>Asking everyone</h2>${L.map(o=>{ const why=swAskWhy(o), offers=(S.swapOffers||[]).filter(f=>f.openId===o.id&&f.status==="open");
    const head=`<div class="listrow"><span class="grow"><b>${escapeHTML(fmtISO(o.dateA)+" "+swShiftText(c,o.shift))}</b>${o.note?` \u00b7 <span class="muted">${escapeHTML(o.note)}</span>`:""}${why?` <span class="tag muted">closed</span> <span class="muted small">${escapeHTML(why)}</span>`:""}</span><button class="btn sm" data-swaskwd="${o.id}">Withdraw</button></div>`;
    if(why)return head;
    return head+(offers.length?offers.map(f=>{ const w=swOfferWhy(f);
      return `<div class="listrow"><span class="grow">${escapeHTML(nameOf(f.by))} offers <b>${escapeHTML(swOfferLabel(c,f.dateB,f.shift))}</b>${w?` <span class="tag muted">closed</span> <span class="muted small">${escapeHTML(w)}</span>`:""}</span>${w?"":`<button class="btn primary sm" data-swaccept="${f.id}">Accept</button>`}</div>`; }).join(""):`<div class="muted small">No offers yet. Everyone who could take it has been asked.</div>`); }).join("")}</div>`; }
function swapWantedHTML(me){ const c=active();   // Requests, for everyone else: each ask they could answer, the shifts they could offer and what each counts
  const rows=(S.openSwaps||[]).filter(o=>o.cycleId===c.id&&swAskWhy(o)==="").map(o=>{
    const mine=(S.swapOffers||[]).find(f=>f.openId===o.id&&f.by===me&&f.status==="open"), can=swOfferable(o,me);
    if(!mine&&!can.length)return "";
    const w=mine?swOfferWhy(mine):"";
    const pickOne=can.length?`<label class="field"><span class="lbl">Offer a shift</span><select id="swofs-${o.id}">${can.map(x=>`<option value="${x.d}"${mine&&mine.dateB===x.d?" selected":""}>${escapeHTML(swOfferLabel(c,x.d,x.shift))}</option>`).join("")}</select></label><button class="btn primary sm" data-swoffer="${o.id}">${mine?"Change offer":"Send offer"}</button>`:"";
    return `<div class="listrow swrow"><span class="grow"><b>${escapeHTML(nameOf(o.from))}</b> is looking for a swap for <b>${escapeHTML(fmtISO(o.dateA)+" "+swShiftText(c,o.shift))}</b>${o.note?` \u00b7 <span class="muted">${escapeHTML(o.note)}</span>`:""}${mine?`<br><span class="small">You offered ${escapeHTML(swOfferLabel(c,mine.dateB,mine.shift))}</span>${w?` <span class="tag muted">closed</span> <span class="muted small">${escapeHTML(w)}</span>`:""}`:""}</span>${pickOne}${mine&&!w?`<button class="btn sm" data-swofferwd="${mine.id}">Withdraw</button>`:""}</div>`; }).join("");
  return rows?`<div class="card"><h2>Swaps wanted</h2>${rows}</div>`:""; }
function swapAdminCard(r){
  const aSh=getShift(r.from,r.dateA), bSh=getShift(r.peerId,r.dateB);
  return `<div class="card" style="border-left:4px solid var(--accent)">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="font-size:var(--fs-md)">Swap · ${escapeHTML(nameOf(r.from))} ↔ ${escapeHTML(nameOf(r.peerId))}</h3><span class="grow"></span><span class="tag ok">both agreed</span>${r.openId?'<span class="tag muted">via Ask everyone</span>':""}</div>
    <div class="small" style="margin:8px 0">
      <div>${escapeHTML(nameOf(r.from))} gives <b>${escapeHTML(shiftLabel(aSh))}</b> on ${fmtISO(r.dateA)} → ${escapeHTML(nameOf(r.peerId))}</div>
      <div>${escapeHTML(nameOf(r.peerId))} gives <b>${escapeHTML(shiftLabel(bSh))}</b> on ${fmtISO(r.dateB)} → ${escapeHTML(nameOf(r.from))}</div>
    </div>
    ${r.reason?`<div class="small muted">Reason: ${escapeHTML(r.reason)}</div>`:""}
    ${reqThreadHTML(r,false)}${r.status==="info"?'<div class="note" style="margin-top:6px">'+ic("help")+' Waiting for their reply — you can still approve or decline.</div>':""}
    <div class="row" style="align-items:flex-end;margin-top:6px">
      <label class="field" style="flex:1;min-width:180px"><span class="lbl">Comment (optional)</span><input id="cmt-${r.id}" placeholder="Note"></label>
      ${r.status==="pending"?`<button class="btn sm" data-rcask="${r.id}">Ask a question</button>`:""}
      <button class="btn danger" data-declineswap="${r.id}">Decline</button>
      <button class="btn primary" data-approveswap="${r.id}">Approve swap</button>
    </div></div>`;
}
function submitSwapRequest(from,dateA,peerId,dateB,reason){
  if(!dateA||!peerId||!dateB){toast("Pick your shift, a colleague, and their shift.");return false;}
  S.requests.unshift({id:"r"+Date.now(),type:"swap",from:from,dateA:dateA,peerId:peerId,dateB:dateB,reason:reason||"",status:"awaiting-peer",createdTs:Date.now()});
  notify(peerId,nameOf(from)+" requested a shift swap with you.",null,{tab:"requests"});
  logAudit("swap.request","with "+nameOf(peerId)+" "+dateA+" ↔ "+dateB,from);
  swapPeer=null;save();return true;
}
function agreeSwap(id){const r=S.requests.find(x=>x.id===id);if(!r)return;r.peerAgreed=true;r.status="pending"; _settled={kind:"agree",key:"agree-"+id,name:nameOf(r.from)};
  notify("admin",nameOf(r.peerId)+" agreed to swap with "+nameOf(r.from)+" — awaiting approval.",null,{tab:"requests"});
  notify(r.from,nameOf(r.peerId)+" agreed to your swap. Sent to admin.",null,{tab:"requests"});
  logAudit("swap.agree","with "+nameOf(r.from),r.peerId);save();}
function declineSwapPeer(id){const r=S.requests.find(x=>x.id===id);if(!r)return;r.status="declined";r.decidedTs=Date.now();
  notify(r.from,nameOf(r.peerId)+" declined your swap request.",null,{tab:"requests"});
  logAudit("swap.peer-decline","with "+nameOf(r.from),r.peerId);save();}
function cycleForDate(isoD){ return (S.cycles||[]).find(c=>!c.archived&&c.cycle&&c.cycle.start<=isoD&&isoD<=iso(cyEnd(c))); }   // the cycle whose date range contains this day — swaps must NOT depend on which cycle the admin happens to be viewing
function executeSwap(r){
  const cA=cycleForDate(r.dateA), cB=cycleForDate(r.dateB);
  if(!cA||!cB)return {ok:false,reason:"Those dates aren't in a live cycle any more."};
  const aA=cA.assign=cA.assign||{}, aB=cB.assign=cB.assign||{};
  const sA=aA[r.from+"|"+r.dateA], sB=aB[r.peerId+"|"+r.dateB];
  if(!sA)return {ok:false,reason:nameOf(r.from)+" no longer has the "+fmtISO(r.dateA)+" shift."};       // re-validate at approval time — the roster may have changed since the request
  if(!sB)return {ok:false,reason:nameOf(r.peerId)+" no longer has the "+fmtISO(r.dateB)+" shift."};
  if(aA[r.peerId+"|"+r.dateA])return {ok:false,reason:nameOf(r.peerId)+" already has a shift on "+fmtISO(r.dateA)+"."};
  if(aB[r.from+"|"+r.dateB])return {ok:false,reason:nameOf(r.from)+" already has a shift on "+fmtISO(r.dateB)+"."};
  if(leaveOn(r.peerId,r.dateA))return {ok:false,reason:nameOf(r.peerId)+" is on leave on "+fmtISO(r.dateA)+"."};
  if(leaveOn(r.from,r.dateB))return {ok:false,reason:nameOf(r.from)+" is on leave on "+fmtISO(r.dateB)+"."};
  const rj=ruleSwapJudge(S,cA,r.from,r.dateA,sA,cB,r.peerId,r.dateB,sB); if(rj)return {ok:false,reason:rj};   // judged as a pair, at approval, like every other check here
  delete aA[r.from+"|"+r.dateA]; delete aB[r.peerId+"|"+r.dateB];
  const mA=Object.assign({},sA), mB=Object.assign({},sB); delete mA.fixed; delete mB.fixed;   // a swapped shift is a one-off for whoever holds it now: the pattern's lock stays with the pattern, and the drift shows the move
  aA[r.peerId+"|"+r.dateA]=mA; aB[r.from+"|"+r.dateB]=mB;
  return {ok:true}; }
function approveSwap(id,comment){const r=S.requests.find(x=>x.id===id);if(!r)return;
  const res=executeSwap(r);
  if(!res.ok){ r.status="declined";r.decidedTs=Date.now();r.adminComment=(comment?comment+" · ":"")+"Auto-declined: "+res.reason;   // never notify "approved" for a swap that didn't happen
    notify(r.from,"Your swap couldn't go ahead — "+res.reason,null,{tab:"requests"}); notify(r.peerId,"A swap involving you couldn't go ahead — "+res.reason,null,{tab:"requests"});
    logAudit("swap.autodecline",nameOf(r.from)+" ↔ "+nameOf(r.peerId)+" · "+res.reason,"admin"); save(); toast(res.reason); return; }
  r.status="approved";r.decidedTs=Date.now();r.adminComment=comment||"";
  swTidy();   // two shifts moved: close the asks and offers that stood on them
  notify(r.from,"Your swap with "+nameOf(r.peerId)+" was approved."+(comment?(" "+comment):""),null,{tab:"requests"});
  notify(r.peerId,"Your swap with "+nameOf(r.from)+" was approved."+(comment?(" "+comment):""),null,{tab:"requests"});
  logAudit("swap.approve",nameOf(r.from)+" "+r.dateA+" ↔ "+nameOf(r.peerId)+" "+r.dateB+(comment?(" · "+comment):""),"admin");save();}
function declineSwap(id,comment){const r=S.requests.find(x=>x.id===id);if(!r)return;r.status="declined";r.decidedTs=Date.now();r.adminComment=comment||"";
  notify(r.from,"Your swap was declined."+(comment?(" "+comment):""),null,{tab:"requests"});notify(r.peerId,"A swap involving you was declined.",null,{tab:"requests"});
  logAudit("swap.decline",nameOf(r.from)+" ↔ "+nameOf(r.peerId)+(comment?(" · "+comment):""),"admin");save();}
/* withdraw (pending) + cancel (approved) */
function withdrawRequest(id){const r=S.requests.find(x=>x.id===id);if(!r||!["pending","awaiting-peer"].includes(r.status))return;
  r.status="withdrawn";r.decidedTs=Date.now();
  if(isAdmin())notify(r.from,"Admin removed your "+(r.type==="swap"?"swap":"leave")+" request.",null,{tab:"requests"});
  else{notify("admin",nameOf(r.from)+" withdrew their "+(r.type==="swap"?"swap":"leave")+" request.",null,{tab:"requests"});if(r.type==="swap"&&r.peerId)notify(r.peerId,nameOf(r.from)+" withdrew the swap request.",null,{tab:"requests"});}
  logAudit(r.type+".withdraw",(r.type==="swap"?("swap with "+nameOf(r.peerId)):(r.code+" "+r.dateFrom+"→"+r.dateTo)),S.viewAs);save();}
function reverseSwap(r){const cA=cycleForDate(r.dateA)||active(), cB=cycleForDate(r.dateB)||active();   // undo in the cycles that actually hold those dates
  const aA=cA.assign=cA.assign||{}, aB=cB.assign=cB.assign||{};
  const sOnA=aA[r.peerId+"|"+r.dateA],sOnB=aB[r.from+"|"+r.dateB];
  delete aA[r.peerId+"|"+r.dateA];delete aB[r.from+"|"+r.dateB];
  if(sOnA)aA[r.from+"|"+r.dateA]=sOnA;if(sOnB)aB[r.peerId+"|"+r.dateB]=sOnB;}
function cancelApproved(id,comment){const r=S.requests.find(x=>x.id===id);if(!r||r.status!=="approved")return;
  if(r.type==="leave")S.leave=S.leave.filter(L=>L.requestId!==id);
  else if(r.type==="swap"){ reverseSwap(r); swTidy(); }   // two shifts moved back: close the asks and offers that stood on them
  r.status="cancelled";r.cancelState=null;r.decidedTs=Date.now();if(comment)r.adminComment=comment;
  if(r.type==="swap"){notify(r.from,"Your approved swap with "+nameOf(r.peerId)+" was cancelled."+(comment?(" "+comment):""),null,{tab:"requests"});notify(r.peerId,"An approved swap with "+nameOf(r.from)+" was cancelled.",null,{tab:"requests"});}
  else notify(r.from,"Your approved "+(LEAVE_LABEL[r.code]||r.code)+" leave was cancelled."+(comment?(" "+comment):""),null,{tab:"requests"});
  logAudit(r.type+".cancel",(r.type==="swap"?("swap "+nameOf(r.from)+" ↔ "+nameOf(r.peerId)):(nameOf(r.from)+" "+r.code+" "+r.dateFrom+"→"+r.dateTo))+(comment?(" · "+comment):""),"admin");save();}
function requestCancellation(id){const r=S.requests.find(x=>x.id===id);if(!r||r.status!=="approved")return;
  r.cancelState="requested";notify("admin",nameOf(r.from)+" requested to cancel their approved "+(r.type==="swap"?"swap":(LEAVE_LABEL[r.code]||r.code)+" leave")+".",null,{tab:"requests"});
  logAudit(r.type+".cancel-request",(r.type==="swap"?("swap with "+nameOf(r.peerId)):(r.code+" "+r.dateFrom+"→"+r.dateTo)),r.from);save();}
function keepApproval(id){const r=S.requests.find(x=>x.id===id);if(!r)return;r.cancelState=null;notify(r.from,"Your cancellation request was declined — the approval stands.",null,{tab:"requests"});logAudit(r.type+".cancel-declined","kept "+nameOf(r.from),"admin");save();}
function reqActions(r){
  if(["pending","awaiting-peer"].includes(r.status))return `<button class="btn sm" data-withdraw="${r.id}">Withdraw</button>`;
  if(r.status==="approved")return r.cancelState==="requested"?'<span class="tag warn">cancellation requested</span>':`<button class="btn sm" data-reqcancel="${r.id}">Request cancellation</button>`;
  return "";}
const REQ_STATUS={pending:"Pending","awaiting-peer":"Waiting for your colleague",info:"needs your reply",approved:"Approved",declined:"Declined",withdrawn:"Withdrawn",cancelled:"Cancelled"};   // statuses are words, the same words for staff and admin
function reqStatusTag(r){ const st=r.status; if(st==="info")return `<span class="tag warn">${ic("help")} needs your reply</span>`; return `<span class="tag ${st==="approved"?"ok":(st==="declined"?"warn":"muted")}">${escapeHTML(REQ_STATUS[st]||st)}</span>`; }
function reqDates(r){ return r.type==="swap"?(fmtISO(r.dateA)+" ↔ "+fmtISO(r.dateB)):(r.dateFrom===r.dateTo?fmtISO(r.dateFrom):(fmtISO(r.dateFrom)+" – "+fmtISO(r.dateTo))); }
function myReqRow(r){
  const label=r.type==="swap"?("Swap with "+escapeHTML(nameOf(r.peerId))+" · "+reqDates(r)):r.type==="fixed"?("Fixed-pattern change · "+escapeHTML(fixedPatternSummary(r.pattern))):(escapeHTML(LEAVE_LABEL[r.code]||r.code)+" · "+reqDates(r)+(r.reason?(" · "+escapeHTML(r.reason)):""));
  const pill=reqStatusTag(r);
  let rc="";   // a decision you have not seen yet tells you what it did to your roster
  if(r.decidedTs&&r.decidedTs>_reqSeenTs&&(r.status==="approved"||r.status==="declined")){ const when=fmt(new Date(r.decidedTs),{weekday:"short",day:"numeric",month:"short"});
    if(r.status==="approved"&&r.type==="swap"){ const now=getShift(r.from,r.dateB); rc=`Approved ${when} · you now work ${fmtISO(r.dateB)} ${escapeHTML(shiftLabel(now))}; ${fmtISO(r.dateA)} is ${escapeHTML(nameOf(r.peerId))}'s.`; }
    else if(r.status==="approved"&&r.type==="leave")rc=`Approved ${when} · ${reqDates(r)} is off your roster.`;
    else if(r.status==="approved")rc=`Approved ${when}.`;
    else rc=`Declined ${when}.`;
    rc=`<div class="reqrc" role="status"><span class="rcic${r.status==="declined"?" no":""}" aria-hidden="true">${ic(r.status==="declined"?"x":"check")}</span><span class="grow">${rc}</span>${(r.status==="approved"&&r.type!=="fixed")?calBtnHTML(r.from,""):""}</div>`; }
  return `<div class="listrow"><span class="grow">${label} ${pill}${r.adminComment?` · <span class="muted small">${escapeHTML(r.adminComment)}</span>`:""}</span>${reqActions(r)}</div>${rc}${reqThreadHTML(r,["pending","info","awaiting-peer"].includes(r.status))}`;}
function requestAdminCard(r){
  const s=S.staff.find(x=>x.id===r.from)||{name:nameOf(r.from),eft:1,hrsFortnight:76};
  const {days,hrs}=requestHoursDays(r);
  const py=plannerYear(), conf=leaveDaysInRange(r.from,py.from,py.to), confHrs=Math.round(conf*hoursPerDay(s));
  const ov=awayOverlap(r.dateFrom,r.dateTo,r.from), ls=leaveStyle(r.code);
  let peakEft=0; daysInRange(r.dateFrom,r.dateTo).forEach(d=>{peakEft=Math.max(peakEft,eftOffOnDay(d)+(+s.eft||1));}); peakEft=Math.round(peakEft*100)/100;
  const overCap=peakEft>S.leaveCapEft;
  const away=ov.perStaff.length?ov.perStaff.map(o=>`<span class="tag lg cst" style="margin:2px 4px 2px 0;display:inline-block">${escapeHTML(o.staff.name)} (${o.days}d)</span>`).join(""):'<span class="muted small">No one else away</span>';
  return `<div class="card" style="border-left:4px solid ${ls.t}">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="font-size:var(--fs-md)">${escapeHTML(s.name)} — <span style="color:${ls.t}">${escapeHTML(LEAVE_LABEL[r.code]||r.code)}</span></h3><span class="grow"></span><span class="muted small">${reqDates(r)} · ${days} day${days>1?"s":""}</span></div>
    ${r.reason?`<div class="small" style="margin:4px 0">Reason: ${escapeHTML(r.reason)}</div>`:""}
    <div class="grid-tiles" style="margin:10px 0">
      <div class="tile"><div class="k">EFT</div><div class="v">${round2(s.eft)}</div></div>
      <div class="tile"><div class="k">Hrs / fortnight</div><div class="v">${round2(s.hrsFortnight)}</div></div>
      <div class="tile"><div class="k">Confirmed leave (yr)</div><div class="v">${conf}d</div><div class="k">${confHrs} hrs</div></div>
      <div class="tile"><div class="k">This request</div><div class="v">${days}d</div><div class="k">${hrs} hrs</div></div>
      <div class="tile"><div class="k">Peak overlap</div><div class="v">${ov.peak}</div><div class="k">away same day</div></div>
      <div class="tile" ${overCap?'style="background:var(--gap-bg)"':""}><div class="k">EFT off peak (incl.)</div><div class="v" ${overCap?'style="color:var(--danger-t)"':""}>${peakEft}</div><div class="k">cap ${S.leaveCapEft}</div></div>
    </div>
    ${overCap?`<div class="note" style="background:var(--gap-bg);color:var(--danger-t)">${ic("warn")} Approving this would put a day over the leave cap (${peakEft} > ${S.leaveCapEft} EFT).</div>`:""}
    <div class="small" style="margin-bottom:8px"><b>Who else is away these dates:</b> ${away}</div>
    ${reqThreadHTML(r,false)}${r.status==="info"?'<div class="note" style="margin-top:6px">'+ic("help")+' Waiting for their reply — you can still approve or decline.</div>':""}
    <div class="row" style="align-items:flex-end">
      <label class="field" style="flex:1;min-width:180px"><span class="lbl">Comment (optional)</span><input id="cmt-${r.id}" placeholder="Reason / note"></label>
      ${r.status==="pending"?`<button class="btn sm" data-rcask="${r.id}" title="Sends the comment as a question — the request waits for their reply">Ask a question</button>`:""}
      <button class="btn danger" data-decline="${r.id}">Decline</button>
      <button class="btn primary" data-approve="${r.id}">Approve</button>
    </div>
  </div>`;
}
function viewPlanner(){
  if(isMobile())return viewPlannerMobile();
  const cs=parseISO(active().cycle.start);
  if(!plannerMonth)plannerMonth=new Date(cs.getFullYear(),cs.getMonth(),1);
  const y=plannerMonth.getFullYear(), m=plannerMonth.getMonth(), total=new Date(y,m+1,0).getDate();
  const days=[];for(let d=1;d<=total;d++)days.push(new Date(y,m,d));
  const py=plannerYear();
  const hdr=`<tr><th class="corner namecol">${ROLEC()}</th><th>EFT</th><th>Hrs</th><th title="All confirmed leave days this year — every type added together">Total</th><th title="Annual leave days this year">AL</th><th title="CME days this year">CME</th>`+days.map(d=>`<th class="${[0,6].includes(d.getDay())?"we":""}">${dayHeadHTML(d)}</th>`).join("")+`</tr>`;
  const eftRow=`<tr><td class="namecol" style="font-size:var(--fs-2xs);color:var(--muted)">EFT off / day · cap ${S.leaveCapEft}</td><td></td><td></td><td></td><td></td><td></td>`+days.map(d=>{const e=eftOffOnDay(iso(d));return `<td style="font-size:var(--fs-grid);${e>S.leaveCapEft?"background:var(--gap-bg);color:var(--danger-t);font-weight:600":(e?"color:var(--muted)":"")}">${e||""}</td>`;}).join("")+`</tr>`;
  const edit=canEdit();
  const rows=rosterStaff().map(s=>{
    const yt=leaveCodeDaysInRange(s.id,py.from,py.to);   // one year-walk: total + per-code
    const conf=Object.values(yt).reduce((a,b)=>a+b,0);
    return `<tr><td class="namecol">${escapeHTML(s.name)}</td><td>${round2(s.eft)}</td><td>${round2(s.hrsFortnight)}</td><td>${conf}</td><td>${yt.AL||0}</td><td>${yt.CME||0}</td>`+days.map(d=>{
      const isoD=iso(d), we=[0,6].includes(d.getDay()), sh=getShift(s.id,isoD);
      const attrs=edit?` class="pcell ${we?"we":""}" data-ps="${s.id}" data-pd="${isoD}"`:` class="${we?"we":""}"`;
      if(sh.kind==="leave"){const l=leaveStyle(sh.code);return `<td${attrs} style="background:${l.bg};color:${l.t};font-size:var(--fs-grid)">${escapeHTML(sh.code)}</td>`;}
      return `<td${attrs}></td>`;
    }).join("")+`</tr>`;
  }).join("");
  const legendHtml=["AL","CME","LSL","PL","UA","PH"].map(c=>{const l=leaveStyle(c);return `<span class="tag lg" style="background:${l.bg};color:${l.t}">${l.name}</span>`;}).join(" ");
  return `<div class="card">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h2>Leave planner</h2><span class="grow"></span>
      <button class="btn sm" id="plPrev" aria-label="Previous month">${ic("chevL")}</button><span style="min-width:130px;text-align:center;font-weight:500">${plannerMonth.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</span><button class="btn sm" id="plNext" aria-label="Next month">${ic("chevR")}</button>
      <button class="btn sm" id="plXls">${ic("download")} Excel</button><button class="btn sm" id="plCsv">${ic("download")} CSV</button></div>
    <div class="sub">${isAdmin()?"Click any day to set or clear leave. ":"Plan around colleagues. "}Total = all confirmed leave days this year; AL / CME = annual-leave and CME days within that. Red = day over the leave cap (${S.leaveCapEft} EFT). Export covers the full year and mirrors your template (its "Conf leave" column = Total).</div>
    <div style="margin:4px 0 10px;display:flex;gap:6px;flex-wrap:wrap">${legendHtml}</div>
    <div class="gridscroll"><table class="roster"><thead>${hdr}${eftRow}</thead><tbody>${rows}</tbody></table></div>
  </div>`;
}
function shortNm(s){const n=String(s.name||"").trim();const c=n.indexOf(",");if(c>0)return n.slice(0,c);const p=n.split(/\s+/);return p.length>1?p[p.length-1]:n;}
function viewPlannerMobile(){
  const cs=parseISO(active().cycle.start);
  if(!plannerMonth)plannerMonth=new Date(cs.getFullYear(),cs.getMonth(),1);
  const y=plannerMonth.getFullYear(), m=plannerMonth.getMonth(), total=new Date(y,m+1,0).getDate();
  const edit=canEdit(), todayISO=iso(new Date());
  const legendHtml=["AL","CME","LSL","PL","UA","PH"].map(c=>{const l=leaveStyle(c);return `<span class="tag lg" style="background:${l.bg};color:${l.t}">${l.name}</span>`;}).join(" ");
  let monthLeaveDays=0, list="";
  for(let dd=1;dd<=total;dd++){
    const d=new Date(y,m,dd), isoD=iso(d), we=[0,6].includes(d.getDay()), today=isoD===todayISO;
    const away=S.staff.filter(s=>getShift(s.id,isoD).kind==="leave");
    monthLeaveDays+=away.length;
    const e=eftOffOnDay(isoD), over=e>S.leaveCapEft;
    const chips=away.length?away.map(s=>{const sh=getShift(s.id,isoD),l=leaveStyle(sh.code);return `<span class="tag" style="background:${l.bg};color:${l.t}">${escapeHTML(shortNm(s))} · ${escapeHTML(sh.code)}</span>`;}).join(""):'<span class="muted small">No one away</span>';
    const _pt=edit?"button":"div";
    const _nm=escapeHTML(fmtISO(isoD)+" — "+(away.length?away.map(s=>shortNm(s)+" "+getShift(s.id,isoD).code).join(", ")+", "+e+" EFT"+(over?" over cap":""):"no one away")+". Open to plan leave");
    list+=`<${_pt} class="pmday${we?" we":""}${today?" today":""}${over?" over":""}${edit?" ctl":""}"${edit?` data-pday="${isoD}" aria-label="${_nm}"`:""}>
      <span class="pmd"><span class="dn">${DOW[d.getDay()]}</span><span class="dd">${dd}</span></span>
      <span class="grow">${chips}</span>
      ${over?`<span class="tag warn">${e} EFT</span>`:(away.length?`<span class="muted small">${e} EFT</span>`:"")}
      ${edit?'<span class="pmchev">'+ic("chevR")+'</span>':""}
    </${_pt}>`;
  }
  return `<div class="card">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h2>Leave planner</h2><span class="grow"></span>
      <button class="btn sm" id="plPrev" aria-label="Previous month">${ic("chevL")}</button><span style="min-width:92px;text-align:center;font-weight:500;font-size:var(--fs-sm)">${plannerMonth.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</span><button class="btn sm" id="plNext" aria-label="Next month">${ic("chevR")}</button></div>
    <div class="sub">${edit?"Tap any day to set or clear leave. ":"Plan around colleagues. "}Red = over the leave cap (${S.leaveCapEft} EFT). ${monthLeaveDays} leave‑day${monthLeaveDays===1?"":"s"} this month.</div>
    <div style="margin:4px 0 10px;display:flex;gap:6px;flex-wrap:wrap">${legendHtml}</div>
    <div class="flexbtns" style="margin-bottom:6px"><button class="btn sm" id="plXls">${ic("download")} Excel</button><button class="btn sm" id="plCsv">${ic("download")} CSV</button></div>
    <div class="pmlist">${list}</div>
  </div>`;
}
function openPlannerDay(isoD){
  const root=document.getElementById("modalRoot"), d=parseISO(isoD);
  const rows=rosterStaff().map(s=>{const sh=getShift(s.id,isoD);let badge;
    if(sh.kind==="leave"){const l=leaveStyle(sh.code);badge=`<span class="tag lg" style="background:${l.bg};color:${l.t}">${escapeHTML(LEAVE_LABEL[sh.code]||sh.code)}</span>`;}
    else if(sh.kind==="clinical"||sh.kind==="cst")badge=`<span class="tag lg cst">${escapeHTML(shiftLabel(sh))}</span>`;
    else badge='<span class="muted small">—</span>';
    return `<button class="listrow pdrow ctl" data-ps="${s.id}"><span class="grow">${escapeHTML(s.name)}</span>${badge}<span class="muted chev">${ic("chevR")}</span></button>`;
  }).join("");
  openDialog(`<div class="overlay" id="ovlPD"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT">
    <h3 id="dlgT">${d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</h3>
    <div class="muted small" style="margin-bottom:10px">Tap a ${ROLE()} to set or clear their leave for this day.</div>
    <div style="max-height:60vh;overflow:auto">${rows}</div>
    <div class="flexbtns" style="margin-top:14px"><span class="grow"></span><button class="btn" id="pdClose">Close</button></div>
  </div></div>`);
  root.querySelector("#ovlPD").onclick=e=>{if(e.target.id==="ovlPD")closeModal();};
  root.querySelector("#pdClose").onclick=closeModal;
  root.querySelectorAll(".pdrow").forEach(r=>r.onclick=()=>openPlannerCell(r.dataset.ps,isoD));
}
/* ---------- the audit log as a record: plain words for every action, newest first, by day; a By-person view; filters; CSV ---------- */
const AUDIT_WORDS={"cycle.archive":"Archived a cycle","cycle.dates":"Changed the cycle dates","cycle.deletedraft":"Deleted a draft cycle","cycle.prepare":"Prepared the next cycle","cycle.staffadd":"Added someone to the cycle","cycle.staffremove":"Removed someone from the cycle","cycle.status":"Changed the roster status","tags.add":"Added a tag","tags.rename":"Renamed a tag","tags.remove":"Removed a tag","tags.show":"Changed whether a tag shows on the roster","tags.person":"Changed someone's tags","tags.import":"Created tags from the staff list","rules.needs":"Changed which slots need a tag","rules.mins":"Changed the minimum holders of a tag","rules.override":"Placed someone against a rule","hours.set":"Set a booking's own hours","hours.clear":"Put a booking's hours back to its type's","settings.ownHours":"Switched whether staff may set their own hours","settings.instantBook":"Switched whether a tap books the shift at once","settings.clockWalkin":"Switched whether unrostered staff may clock in","clock.walkin":"Clocked in without a rostered shift","clock.walkin-decline":"Declined a walk-in shift",
  "email.sent":"Sent an email","export.efttracker":"Exported the EFT tracker","export.payroll.rosteron":"Exported the payroll file","export.planner.csv":"Exported the leave planner","export.planner.xls":"Exported the leave planner","export.roster.csv":"Exported the roster","export.fixedcover":"Exported the fixed cover","export.roster.xls":"Exported the roster","export.rosteron":"Exported for RosterOn","feedback":"Sent feedback",
  "fixed.approve":"Approved a fixed pattern","fixed.commit":"Committed a fixed pattern","fixed.decline":"Declined a fixed pattern","fixed.save":"Saved a fixed pattern","ics.token":"Reset a calendar link",
  "import.eftdata":"Imported EFT data","import.efttracker":"Imported the EFT tracker","import.leave":"Imported the leave planner","import.roster":"Imported a roster","import.roster.update":"Updated a roster from a spreadsheet","import.stafflist":"Imported the staff list",
  "leave.approve":"Approved leave","leave.decline":"Declined leave","leave.request":"Requested leave",
  "market.approve":"Approved a claim","market.claim":"Claimed an open shift","market.claim.pending":"Asked for an open shift","market.claimMode":"Changed how claims are confirmed","market.decline":"Declined a claim","market.offer":"Offered a shift","market.ask":"Asked to come off a shift","market.release":"Let someone off a shift","market.keep":"Kept someone on their shift","market.post":"Posted an open shift","market.quotaBypass":"Changed the over-share rule","market.toggle":"Switched open shifts on or off","market.withdraw":"Withdrew an open shift",
  "message.send":"Sent a message","org.reset":"Deleted all data","payroll.dateFmt":"Changed the payroll date format","payroll.template.clear":"Cleared the payroll template","payroll.template.upload":"Uploaded a payroll template","ph.mark":"Marked a public holiday","ph.unmark":"Removed a public holiday","planner.edit":"Edited the leave planner","push.off":"Turned phone alerts off","push.on":"Turned phone alerts on","push.toggle":"Changed phone alerts","request.query":"Asked about a request","roster.edit":"Edited a shift",
  "selfroster.autoclose":"Booking closed on schedule","selfroster.autodraft":"Pre-filled the roster to cover","selfroster.autoopen":"Booking opened on schedule","selfroster.fixedclear":"Removed the placed fixed shifts","selfroster.reset":"Reset the cycle to a fresh draft","selfroster.book":"Booked a shift","selfroster.clear":"Cleared the booked shifts","roster.clear":"Cleared the roster","selfroster.cst":"Marked clinical support time","selfroster.fixed":"Placed fixed shifts","selfroster.off":"Marked a day off","selfroster.rounds":"Started taking turns","selfroster.schedule":"Changed the booking schedule","selfroster.scheduleexpired":"The booking schedule expired","selfroster.ua":"Marked a day unavailable","selfroster.ua.remove":"Removed an unavailable mark","selfroster.unbook":"Removed a booked shift","selfroster.wave.advance":"Opened the next group","selfroster.wave.done":"Finished picking","selfroster.waves":"Changed the groups",
  "settings.branding":"Saved group details","settings.clock":"Changed the clock settings","settings.site":"Saved the site","clock.poster":"Made a new clock poster","clock.approve":"Approved clocked hours","clock.decline":"Declined clocked hours","export.clock":"Exported the clock report","settings.logo":"Changed the group logo","settings.capBuffer":"Changed the capacity buffer","settings.fairness":"Changed how people get shifts","settings.fatigue":"Changed the safe-hours rules","settings.feature":"Changed which features are on","settings.features":"Reviewed the feature list","settings.leaveCap":"Changed the leave cap","settings.notice":"Changed the notice period","settings.oncall":"Changed the on-call windows","oncall.take":"Went on call","oncall.clear":"Came off on call","callin.log":"Logged a call-in","callin.change":"Changed a call-in","callin.remove":"Removed a call-in","settings.zoneOnCall":"Changed which zones carry on-call","settings.preset":"Chose a group preset","settings.board":"Changed the department board settings","group.create":"Created the staff group","settings.quota":"Changed a quota","settings.cstDefault":"Changed the default CST days","settings.cstQuota":"Changed a CST quota","settings.cstReset":"Reset the CST split to auto","cst.override":"Placed a CST day over the quota","settings.quotaCap":"Changed the quota cap","settings.quotaFlex":"Changed the flexible extra","settings.quotaPeriod":"Changed how quota is counted","settings.quotaReset":"Reset quotas","settings.rosterMode":"Changed how the roster runs","settings.sharedIdle":"Changed the shared-computer timeout","settings.shiftTimes":"Changed the shift times","settings.shiftTypes":"Changed the shift types","settings.staffing":"Changed cover","settings.tough":"Changed what counts as a tough shift","settings.unlockOrder":"Changed the unlock order","staff.tidy":"Tidied the staff list","staff.add":"Added someone to the staff list","staff.edit":"Edited a staff record","staff.remove":"Removed someone from the staff list",
  "invite.sent":"Invited people to Myrosta","fixed.change-request":"Asked to change a fixed pattern","swap.peer-decline":"Declined a swap from a colleague","leave.withdraw":"Withdrew a leave request","swap.withdraw":"Withdrew a swap request","fixed.withdraw":"Withdrew a fixed-pattern request","leave.cancel":"Cancelled approved leave","swap.cancel":"Cancelled an approved swap","fixed.cancel":"Cancelled a fixed pattern","leave.cancel-request":"Asked to cancel leave","swap.cancel-request":"Asked to cancel a swap","fixed.cancel-request":"Asked to cancel a fixed pattern","leave.cancel-declined":"Kept the leave approval","swap.cancel-declined":"Kept the swap approval","fixed.cancel-declined":"Kept the fixed pattern","swap.agree":"Agreed to a swap","swap.approve":"Approved a swap","swap.autodecline":"A swap was declined automatically","swap.decline":"Declined a swap","swap.request":"Requested a swap","swap.ask":"Asked everyone for a swap","swap.ask-withdraw":"Withdrew an ask for a swap","swap.offer":"Offered a shift for a swap","swap.offer-withdraw":"Withdrew a swap offer","swap.accept":"Accepted a swap offer","swap.ask-close":"An ask for a swap was closed"};
function auditWords(a){ const d=String(a.detail||"");
  if(a.action==="cycle.status"){ const to=d.split("→").pop().trim(); const w={open:"Opened booking",closed:"Closed booking",published:"Published the roster",draft:"Took the roster back to draft"}[to]; if(w)return w; }
  if(a.action==="selfroster.autodraft")return /^fill-to-max/.test(d)?"Filled to maximum cover":"Filled to minimum cover";
  if(a.action==="fixed.commit")return /unlocked$/.test(d)?"Unlocked a fixed pattern":"Locked a fixed pattern";
  if(a.action==="ics.token")return /created$/.test(d)?"Created a calendar link":"Reset a calendar link";
  if(a.action==="selfroster.wave.done")return /reopened$/.test(d)?"Reopened picking":"Finished picking";
  return AUDIT_WORDS[a.action]||""; }   // a few keys say two things: read the detail   // "" = unknown key: the raw key is shown instead
function auditCat(k){ k=String(k||""); if(k==="tags.import"||/^(import|export)\./.test(k))return "data"; if(/^(settings|payroll|push|staff|org|ics|tags)\./.test(k)||/^rules\.(needs|mins)$/.test(k)||k==="feedback")return "settings"; if(/^(leave|swap|request|fixed)\./.test(k))return "requests"; if(/^(message|email)\./.test(k))return "messages"; return "roster"; }
const AUDIT_CATS=[["all","All"],["roster","Roster"],["requests","Requests"],["settings","Settings"],["data","Imports & exports"],["messages","Messages"]];
let _auditView="timeline", _auditFilter="all";   // device-only
function auditList(){ const l=(S.audit||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0)); return _auditFilter==="all"?l:l.filter(a=>auditCat(a.action)===_auditFilter); }
function auditRowHTML(a,withWho){ const w=auditWords(a), t=new Date(a.ts||0), tm=t.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
  return `<div class="listrow audrow"><span class="muted small atime${withWho?"":" wide"}">${withWho?tm:(fmt(t,{day:"numeric",month:"short"})+" "+tm)}</span>${withWho?`<span class="awho">${escapeHTML(nameOf(a.actor))}</span>`:""}<span class="grow"><span class="awhat"${w?` title="${escapeHTML(a.action)}"`:""}>${w?escapeHTML(w):`<span class="tag muted">${escapeHTML(a.action)}</span>`}</span>${a.detail?` <span class="muted small">${escapeHTML(a.detail)}</span>`:""}</span></div>`; }
function auditCSV(){ const esc=v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"'; return ["Time,Who,What,Action,Detail"].concat(auditList().map(a=>[new Date(a.ts||0).toISOString(),nameOf(a.actor),auditWords(a)||a.action,a.action,a.detail||""].map(esc).join(","))).join("\n"); }
function viewAudit(){
  const list=auditList(), all=(S.audit||[]).length, today=iso(new Date()), yday=iso(new Date(Date.now()-864e5));
  const head=`<div class="card"><h2>Audit log <span class="muted small">(${all} ${all===1?"entry":"entries"})</span></h2><div class="sub">Every change, who made it and when. Kept with the roster.</div>
    <div class="cluster"><div class="seg" id="auditSeg" role="group" aria-label="View"><button data-av="timeline" class="${_auditView==="timeline"?"on":""}">Timeline</button><button data-av="person" class="${_auditView==="person"?"on":""}">By person</button></div>
    <div class="seg" id="auditFilter" role="group" aria-label="Show">${AUDIT_CATS.map(([k,l])=>`<button data-af="${k}" class="${_auditFilter===k?"on":""}">${l}</button>`).join("")}</div><span class="grow"></span>${all?`<button class="btn sm" id="auditCsv">${ic("download")} Download as CSV</button>`:""}</div>`;
  if(!list.length)return head+emptyState(EIC.doc,all?"Nothing in this filter":"Nothing logged yet",all?"Try another filter.":"Every change made here — a booking, a setting, an approval — is written down with who made it and when.")+`</div>`;
  let body="";
  if(_auditView==="person"){ const groups={}; list.forEach(a=>{(groups[a.actor]=groups[a.actor]||[]).push(a);});
    const order=Object.keys(groups).sort((a,b)=>a==="admin"?-1:b==="admin"?1:nameOf(a).localeCompare(nameOf(b)));
    body=order.map(actor=>`<div class="sheetlbl">${escapeHTML(nameOf(actor))} <span class="muted">(${groups[actor].length})</span></div>${groups[actor].map(a=>auditRowHTML(a,false)).join("")}`).join(""); }
  else { let last=null; body=list.map(a=>{ const dk=iso(new Date(a.ts||0)), lbl=dk===today?"Today":(dk===yday?"Yesterday":fmt(new Date(a.ts||0),{weekday:"short",day:"numeric",month:"short",year:"numeric"})); const h=lbl!==last?`<div class="sheetlbl">${lbl}</div>`:""; last=lbl; return h+auditRowHTML(a,true); }).join(""); }
  return head+body+`</div>`;
}
function download(content,filename,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
function rosterColor(sh){if(sh.kind==="clinical"){const _f=fillsOf(active(),sh); if(_f.length>1)return {bg:PALETTE["--am"],t:PALETTE["--am-t"],edge:PALETTE["--pm-t"]};   // both halves: the morning fill, edged in the evening colour
    return _f[0]==="AM"?{bg:PALETTE["--am"],t:PALETTE["--am-t"]}:{bg:PALETTE["--pm"],t:PALETTE["--pm-t"]};}if(sh.kind==="cst")return{bg:PALETTE["--cst"],t:PALETTE["--cst-t"]};if(sh.kind==="leave")return leaveHex(sh.code);return null;}   // export only: real hex

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
/* ---------- EFT tracker (org template: weekly EFT grid, keyed by Employee #) ---------- */
const FT_HRS_WEEK=38; // full-time hours/week (76/fortnight) — used to convert hours/week back to EFT fraction
function parseEftTracker(wb, cycleStartISO){
  let chosen=null, latest=null;
  wb.SheetNames.forEach(name=>{
    let aoa; try{aoa=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null});}catch(e){return;}
    let hr=-1; for(let r=0;r<Math.min(aoa.length,14);r++){ if((aoa[r]||[]).some(c=>/employee\s*#|emp\s*no|payroll/i.test(String(c==null?"":c)))){hr=r;break;} }
    if(hr<0)return;
    const dcols=[]; (aoa[hr]||[]).forEach((v,c)=>{const di=cellISO(v); if(di)dcols.push({c:c,iso:di});});
    if(!dcols.length)return;
    const cand={name:name,aoa:aoa,hr:hr,dcols:dcols,first:dcols[0].iso,last:dcols[dcols.length-1].iso};
    if(!latest||cand.first>latest.first)latest=cand;
    if(cycleStartISO>=cand.first && cycleStartISO<=iso(addDays(parseISO(cand.last),6)))chosen=cand;
  });
  const c=chosen||latest;
  if(!c)return {error:"No tracker sheet found (need an 'Employee #' header row with weekly date columns)."};
  let tc=null; c.dcols.forEach(d=>{ if(d.iso<=cycleStartISO && (!tc||d.iso>=tc.iso))tc=d; }); if(!tc)tc=c.dcols[0];
  const rows=[];
  for(let r=c.hr+1;r<c.aoa.length;r++){ const row=c.aoa[r]||[];
    const last=String(row[1]==null?"":row[1]).trim(), first=String(row[2]==null?"":row[2]).trim();
    if(!last||!/[A-Za-z]/.test(last))continue;
    let val=(typeof row[tc.c]==="number")?row[tc.c]:numFrom(row[tc.c]);
    if(val==null){ for(let k=c.dcols.length-1;k>=0;k--){const dv=row[c.dcols[k].c]; if(typeof dv==="number"){val=dv;break;}} }
    if(val==null)continue;
    const eft = val>1.5 ? round2(val/FT_HRS_WEEK) : round2(val);   // auto-detect: >1.5 = hours/week, else EFT fraction
    const emp=row[0]; rows.push({empNo: emp==null?"":String(emp).replace(/\.0+$/,"").trim(), sur:last, giv:first, eft:eft});
  }
  return {sheet:c.name, week:tc.iso, rows:rows};
}
function applyEftTracker(p){
  const byEmp={}, bySur={};
  S.staff.forEach(s=>{ if(s.payrollId)byEmp[String(s.payrollId)]=s; const sur=splitName(s.name).sur; (bySur[normName(sur)]=bySur[normName(sur)]||[]).push(s); });
  let n=0; const unmatched=[];
  p.rows.forEach(rw=>{
    let s=(rw.empNo&&byEmp[rw.empNo])||null;
    if(!s){ const cands=bySur[normName(rw.sur)]||[];
      if(cands.length===1)s=cands[0];
      else if(cands.length>1)s=cands.find(c=>normName(splitName(c.name).giv).charAt(0)===normName(rw.giv).charAt(0))||cands[0]; }
    if(!s){ unmatched.push(rw.sur+(rw.giv?", "+rw.giv:"")); return; }
    if(rw.eft!=null){ s.eft=rw.eft; s.hrsFortnight=round2(rw.eft*76); }
    if(rw.empNo && !s.payrollId)s.payrollId=rw.empNo;   // link Employee # → payroll export
    n++;
  });
  logAudit("import.efttracker",n+" "+ROLES()+" from "+p.sheet+" (week "+p.week+")","admin"); save();
  return {n:n, unmatched:unmatched};
}
function importEftTracker(file){
  if(typeof XLSX==="undefined"){toast("Spreadsheet reader not loaded — check your connection and retry.");return;}
  const reader=new FileReader();
  reader.onload=ev=>{ let wb; try{wb=XLSX.read(ev.target.result,{type:"array",cellDates:true});}catch(x){toast("Couldn't read file: "+x.message,"danger");return;}
    const p=parseEftTracker(wb, active().cycle.start);
    if(p.error){toast("EFT tracker import: "+p.error);return;}
    if(!confirm("Import EFT tracker?\n\nSheet: "+p.sheet+"\nWeek used: "+p.week+"\n"+ROLESC()+" found: "+p.rows.length+"\n\nSets each matched "+ROLE()+"'s EFT + hours, and fills their employee number (used by the payroll export). Matches by employee # or surname."))return;
    const res=applyEftTracker(p); recordImport("eft",file.name,res.n+" updated"+(res.unmatched.length?" · "+res.unmatched.length+" unmatched":"")); save();
    let msg="EFT tracker imported — updated "+res.n+" "+ROLES()+" (EFT, hours, employee #).";
    if(res.unmatched.length)msg+="\n\nNo matching "+ROLE()+" for "+res.unmatched.length+": "+res.unmatched.slice(0,8).join("; ")+(res.unmatched.length>8?" …":"");
    toast(msg); render();
  };
  reader.readAsArrayBuffer(file);
}
function exportEftTracker(){
  if(!S.staff.length){toast("No staff to export yet.");return;}
  if(typeof XLSX==="undefined"){toast("Spreadsheet reader not loaded — check your connection and retry.");return;}
  const ds=cycleDates(); const weeks=[]; for(let i=0;i<ds.length;i+=7)weeks.push(ds[i]);
  const totalEft=round2(S.staff.reduce((a,s)=>a+(+s.eft||0),0));
  const aoa=[];
  aoa.push(["Period",cyLabel(active())]);
  aoa.push([]);
  aoa.push(["Budgeted EFT","","Current EFT"].concat(weeks.map(()=>totalEft)));
  aoa.push([]);
  aoa.push(["Employee #","Last Name","First Name"].concat(weeks.map(d=>iso(d))));
  rosterStaff().forEach(s=>{const nm=splitName(s.name); aoa.push([s.payrollId||"",nm.sur,nm.giv].concat(weeks.map(()=>round2(s.eft||0))));});
  const ws=XLSX.utils.aoa_to_sheet(aoa), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"SMS EFT");
  XLSX.writeFile(wb,"eft-tracker-"+active().cycle.start+".xlsx");
  logAudit("export.efttracker",S.staff.length+" "+ROLES(),"admin");save();
}
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
/* ---------- Payroll export (RosterOn) — flat, one row per shift ---------- */
const LEAVE_DAY_HOURS=8; // a full-time leave day = one standard shift (8h); pro-rated by EFT below
function leaveHours(s){return round2(LEAVE_DAY_HOURS*(+s.eft||1));}
const DATE_FORMATS=[["DD/MM/YYYY","31/12/2026"],["YYYY-MM-DD","2026-12-31"],["DD-MMM-YYYY","31-Dec-2026"],["MM/DD/YYYY","12/31/2026"],["DD/MM/YY","31/12/26"]];
const MONTHS3=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(isoD){const p=String(isoD).split("-");if(p.length!==3)return isoD;const Y=p[0],M=p[1],D=p[2];
  switch(S.payrollDateFmt||"DD/MM/YYYY"){
    case "YYYY-MM-DD":return Y+"-"+M+"-"+D;
    case "DD-MMM-YYYY":return D+"-"+(MONTHS3[+M-1]||M)+"-"+Y;
    case "MM/DD/YYYY":return M+"/"+D+"/"+Y;
    case "DD/MM/YY":return D+"/"+M+"/"+Y.slice(2);
    default:return D+"/"+M+"/"+Y;
  }}
function splitName(n){n=String(n||"").trim();if(n.indexOf(",")>=0){const a=n.split(",");return{sur:a[0].trim(),giv:(a[1]||"").trim()};}const a=n.split(/\s+/);if(a.length<2)return{sur:n,giv:""};return{sur:a[a.length-1],giv:a.slice(0,-1).join(" ")};}
/* Which zones a cycle that has never saved its on-call windows follows (ocFromTick). Nothing sets it any more:
   the On-call card is where a group says which evening carries on-call. The On-call shift type was the switch
   for the whole cycle; this was the switch for one zone. Tri-state on purpose: a zone that has never been ticked falls
   back to the old name match, so every existing cycle at both live orgs computes exactly as it did and
   nothing is written to stored JSON. `false` is what finally lets a group say no to a false positive. */
function isOnCallZone(z,cyc,typeChecked){ if(!z)return false; const _c=cyc||active(); if(!typeChecked&&_c&&!typeOn(_c,"ONC"))return false;
  if(z.oncall!=null)return z.oncall===true;
  return /\bOC\b|ON.?CALL|\+\s*OC/i.test((z.pmLabel||"")+" "+(z.name||"")); }
function payrollRows(){
  const rows=[],ds=cycleDates(),_cyP=active(),_ocW=ocWindows(_cyP);   // once per export, never per person per day
  rosterStaff().forEach(s=>{const nm=splitName(s.name);
    ds.forEach(d=>{const isoD=iso(d),sh=getShift(s.id,isoD);
      const base={emp:s.payrollId||"",sur:nm.sur,giv:nm.giv,name:s.name,date:isoD};
      const add=(t,unit,note)=>rows.push(Object.assign({},base,{code:t.code,start:t.start,end:t.end,hours:t.hours,unit:unit||"",note:note||""}));
      if(sh.kind==="clinical"){const z=zoneById(sh.zone),zn=z?z.name:"";const T=typeOf(_cyP,sh),W=shiftWindow(_cyP,sh);   // the type's code; the booking's own start, finish and hours when it has them
        add({code:T.code,start:W.start,end:W.end,hours:_tHours(W.start,W.end)},zn,[sh.locum?"Locum":"",isFullShift(_cyP,sh)?T.label:""].filter(Boolean).join(" · "));
      } else if(sh.kind==="cst"){const T=typeOf(_cyP,sh);add({code:T.code,start:T.start,end:T.end,hours:_tHours(T.start,T.end)},"",T.label);}
      else if(sh.kind==="leave"&&sh.code!=="UA") rows.push(Object.assign({},base,{code:sh.code,start:"",end:"",hours:leaveHours(s),unit:"",note:LEAVE_LABEL[sh.code]||"Leave"}));   // UA is "unavailable", not leave: it is never a payroll row (23 Sep 2026)
      ocHeldBy(_cyP,s.id,isoD,_ocW).forEach(w=>{ const z=w.from?zoneById(sh.zone):null; add({code:w.pay||w.code,start:w.start,end:w.end,hours:ocHours(w)},z?z.name:"",w.label); });   // on-call is its own row after the day's own, with its own code, so pay can treat it on its own terms
    });
  });
  return rows;
}
// The roster data that can fill a RosterOn column:
const PAYROLL_FIELDS=[
  ["emp","Employee No"],["sur","Surname"],["giv","Given Name"],["name","Full name"],
  ["date","Date"],["code","Shift Code"],["start","Start time"],["end","End time"],
  ["hours","Hours"],["unit","Unit / area"],["note","Notes"]
];
function payrollFieldValue(r,key){switch(key){
  case "emp":return r.emp;case "sur":return r.sur;case "giv":return r.giv;case "name":return r.name;
  case "date":return fmtDate(r.date);case "code":return r.code;case "start":return r.start;case "end":return r.end;
  case "hours":return r.hours;case "unit":return r.unit;case "note":return r.note;default:return "";}}
// Guess which roster field feeds a RosterOn column from its header text:
function autoMapField(h){const s=String(h||"").toLowerCase();
  if(/surname|last\s*name|family/.test(s))return "sur";
  if(/given|first\s*name|forename|christian/.test(s))return "giv";
  if(/payroll|personnel|(emp(loyee)?|staff|pay)\s*(no|num|#|id|code)/.test(s))return "emp";
  if(/date/.test(s))return "date";
  if(/start|begin|\bfrom\b|time\s*in|commence/.test(s))return "start";
  if(/end|finish|\bto\b|time\s*out|cease/.test(s))return "end";
  if(/hour|hrs|duration|qty|quantity|\bunits?\b/.test(s))return "hours";
  if(/shift|code|activity|duty|task/.test(s))return "code";
  if(/unit|ward|cost|location|dept|department|\barea\b|team/.test(s))return "unit";
  if(/note|comment|desc|remark/.test(s))return "note";
  if(/name/.test(s))return "name";
  return "";}
function parseCSVLine(line){const out=[];let cur="",q=false;for(let i=0;i<line.length;i++){const c=line[i];
  if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
  else{if(c===','){out.push(cur);cur="";}else if(c==='"')q=true;else cur+=c;}}
  out.push(cur);return out.map(x=>x.trim());}
function readPayrollTemplate(file){
  const finish=(hdrs)=>{let headers=(hdrs||[]).map(h=>String(h==null?"":h).trim());
    while(headers.length&&headers[headers.length-1]==="")headers.pop();
    if(!headers.length){toast("No column headers found in that file's first row.");return;}
    S.payrollTemplate={headers:headers,map:headers.map(autoMapField),filename:file.name};
    logAudit("payroll.template.upload",file.name+" — "+headers.length+" columns","admin");save();render();};
  const nm=(file.name||"").toLowerCase();
  if(nm.endsWith(".csv")){const r=new FileReader();
    r.onload=ev=>{const first=String(ev.target.result||"").split(/\r?\n/).find(l=>l.trim()!=="")||"";finish(parseCSVLine(first));};
    r.readAsText(file);
  } else {
    if(typeof XLSX==="undefined"){toast("Spreadsheet reader not loaded — check your connection and retry, or upload a .csv template.");return;}
    const r=new FileReader();
    r.onload=ev=>{try{const wb=XLSX.read(ev.target.result,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});finish(aoa[0]||[]);}catch(x){toast("Couldn't read template: "+x.message);}};
    r.readAsArrayBuffer(file);
  }
}
function exportPayrollCSV(){
  if(!S.staff.length){toast("No staff/roster to export yet.");return;}
  const rows=payrollRows();
  const q=x=>`"${String(x==null?"":x).replace(/"/g,'""')}"`;
  const tpl=S.payrollTemplate;
  let head,lineVals;
  if(tpl&&tpl.headers&&tpl.headers.length){
    head=tpl.headers; lineVals=r=>tpl.headers.map((h,i)=>payrollFieldValue(r,(tpl.map||[])[i]||""));
  } else {
    head=["Employee No","Surname","Given Name","Date","Shift Code","Start","End","Hours","Unit","Notes"];
    lineVals=r=>[r.emp,r.sur,r.giv,fmtDate(r.date),r.code,r.start,r.end,r.hours,r.unit,r.note];
  }
  let csv=head.map(q).join(",")+"\n";
  rows.forEach(r=>{csv+=lineVals(r).map(q).join(",")+"\n";});
  download(csv,"rosteron-payroll-"+active().cycle.start+".csv","text/csv");
  logAudit("export.payroll.rosteron",cyLabel(active())+" — "+rows.length+" shift rows"+(tpl?" (template)":""),"admin");save();
}
function exportRosterCSV(){
  const ds=cycleDates();
  let csv=[ROLEC()].concat(ds.map(d=>DOW[d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1))).join(",")+"\n";
  rosterStaff().forEach(s=>{csv+=[s.name].concat(ds.map(d=>{const sh=getShift(s.id,iso(d));const l=shiftLabel(sh).replace(/^Off$/,"")+ownHoursTag(active(),sh), oc=ocTakenBy(active(),s.id,iso(d)).map(w=>"On call "+w.label).join(" + ");return [l&&sh.kind==="clinical"&&sh.locum?l+" (locum)":l,oc].filter(Boolean).join(" + ");})).map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")+"\n";});
  download(csv,"roster-"+active().cycle.start+".csv","text/csv");logAudit("export.roster.csv",cyLabel(active()),"admin");save();
}
function exportRosterXLS(){
  const ds=cycleDates(), _ocX=ocTakenWindows(active()).length>0;
  let h='<table border="1" style="border-collapse:collapse;font-family:Arial;font-size:11px"><tr><th>'+ROLEC()+'</th>'+ds.map(d=>`<th>${DOW[d.getDay()]}<br>${d.getDate()}/${d.getMonth()+1}</th>`).join("")+'</tr>';
  rosterStaff().forEach(s=>{h+=`<tr><td>${escapeHTML(s.name)}</td>`+ds.map(d=>{const sh=getShift(s.id,iso(d));const c=rosterColor(sh);const loc=sh.kind==="clinical"&&sh.locum;const oc=ocTakenBy(active(),s.id,iso(d)).map(w=>"On call "+escapeHTML(w.label)).join(" + ");const lbl=[sh.kind==="off"?"":(escapeHTML(shiftLabel(sh)+ownHoursTag(active(),sh))+(loc?" (L)":"")),oc].filter(Boolean).join(" + ");return c?`<td style="background-color:${c.bg};color:${c.t}${loc?";border:2px solid "+PALETTE["--locum"]:""}">${lbl}</td>`:(oc?`<td>${lbl}</td>`:'<td></td>');}).join("")+'</tr>';});
  h+='</table>';
  const doc='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><h2 style="font:bold 16px Arial;color:'+PALETTE["--navy"]+';margin:0">'+escapeHTML(hospitalGroupLabel())+'</h2><h3 style="font:bold 13px Arial;margin:4px 0 2px">Roster '+escapeHTML(cyLabel(active()))+' · '+(STATUS[active().status]?STATUS[active().status].label:active().status)+'</h3><p style="font:11px Arial;color:'+PALETTE["--muted"]+';margin:0 0 8px">Exported '+fmt(new Date(),{day:"numeric",month:"short",year:"numeric"})+' from Myrosta · myrosta.com.au — AM blue, PM amber, CST green, leave colours as in the app; L = locum'+(_ocX?"; On call = an on-call window, not a shift":"")+'</p>'+h+'</body></html>';
  download(doc,"roster-"+active().cycle.start+".xls","application/vnd.ms-excel");logAudit("export.roster.xls",cyLabel(active()),"admin");save();
}
/* ---------- RosterOn-format export: readable sheet (grouped by Title) + clean data sheet ---------- */
function ronCell(sid,d){
  const sh=getShift(sid,iso(d)), _c=active();
  const _cell=T=>{const cs=T.start.replace(":",""),ce=T.end.replace(":","");return "() "+T.code+" "+cs+"-"+ce+(T.code==="AM"?" ":"  ")+T.start+"-"+T.end+" NB#";};   // the two spaces after a PM/CST block are RosterOn's own layout — kept byte for byte
  if(sh.kind==="clinical"){ const _W=shiftWindow(_c,sh); return _cell(Object.assign({},typeOf(_c,sh),{start:_W.start,end:_W.end})); }   // the type's code and layout, the booking's own times
  if(sh.kind==="cst")return _cell(typeOf(_c,sh));
  if(sh.kind==="leave"&&sh.code!=="UA"){ const prev=new Date(d); prev.setDate(prev.getDate()-1); const ps=getShift(sid,iso(prev)); const cont=(ps.kind==="leave"&&ps.code===sh.code); return (cont?"00:00 ":"08:00 ")+sh.code; }   // an unavailable day is an empty cell, like a day off
  return "";
}
function ronOcCell(w){ return "() "+w.code+" "+w.start.replace(":","")+w.end.replace(":","")+"  - NB#"; }   // RosterOn's continuation layout. It used to say 23300800 whatever the on-call hours were
function rosterOnTitleRows(ds,dmy){ return [["Roster — "+dmy(ds[0])+" to "+dmy(ds[ds.length-1])],[(groupName()||"Roster")+" · exported "+dmy(new Date())+" from Myrosta (myrosta.com.au) · RosterOn format"]]; }   // sheet 1's two free-text lines
function exportRosterOn(){
  if(typeof XLSX==="undefined"){toast("Spreadsheet library not loaded — check your connection and retry.");return;}
  const ds=cycleDates(), staff=rosterStaff();
  if(!staff.length){toast("No clinical staff/roster to export yet.");return;}
  const dmy=d=>String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();
  const hdr=d=>DOW[d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1);
  const _cyR=active();
  const _ocW=ocWindows(_cyR), ocOn=(sid,d)=>ocHeldBy(_cyR,sid,iso(d),_ocW);   // every window carried that day: one that follows an evening in an on-call zone (a whole-day shift's included), or one taken
  // ---- Sheet 1: readable RosterOn-style layout, grouped by Title ----
  const A=[];
  rosterOnTitleRows(ds,dmy).forEach(r=>A.push(r));
  A.push([]);
  A.push(["Role/Name"].concat(ds.map(hdr)));
  const groups={}, order=[];
  staff.forEach(s=>{ const t=(s.title||"").trim()||"—"; if(!groups[t]){groups[t]=[];order.push(t);} groups[t].push(s); });
  order.sort((a,b)=> a==="—"?1:(b==="—"?-1:a.localeCompare(b)));   // titled groups first (A–Z), untitled last
  order.forEach(t=>{
    A.push([t].concat(ds.map(()=>"")));
    groups[t].slice().sort((a,b)=>splitName(a.name).sur.localeCompare(splitName(b.name).sur))
      .forEach(s=>{ A.push([s.name].concat(ds.map(d=>ronCell(s.id,d))));
        const held=ds.map(d=>ocOn(s.id,d)), deep=held.reduce((m,x)=>Math.max(m,x.length),0);
        for(let k=0;k<deep;k++)A.push([""].concat(held.map(ws=>ws[k]?ronOcCell(ws[k]):""))); });   // on-call goes on a continuation row beneath the person (RosterOn style), one row per window carried on the same day
  });
  A.push(["Totals"]);
  const ws1=XLSX.utils.aoa_to_sheet(A);
  ws1["!cols"]=[{wch:28}].concat(ds.map(()=>({wch:24})));
  ws1["!merges"]=[{s:{r:0,c:0},e:{r:0,c:ds.length}},{s:{r:1,c:0},e:{r:1,c:ds.length}}];
  // ---- Sheet 2: clean one-row-per-shift data ----
  const D=[["Name","Title","Date","Day","Type","Zone","Code","Start","End","Hours"]];
  staff.forEach(s=>ds.forEach(d=>{ const sh=getShift(s.id,iso(d)), ws=ocOn(s.id,d); if(sh.kind==="off"&&!ws.length)return;
    const date=dmy(d), day=DOW[d.getDay()];
    if(sh.kind==="clinical"){ const z=zoneById(sh.zone), zn=z?zoneLabelFor(_cyR,z,sh):""; const _tt=typeOf(_cyR,sh), _tw=shiftWindow(_cyR,sh); D.push([s.name,s.title||"",date,day,"Clinical"+(sh.locum?" (locum)":""),zn,_tt.code,_tw.start,_tw.end,_tHours(_tw.start,_tw.end)]); }
    else if(sh.kind==="cst"){ const _tc=typeOf(_cyR,sh); D.push([s.name,s.title||"",date,day,_tc.label,"",_tc.code,_tc.start,_tc.end,_tHours(_tc.start,_tc.end)]); }
    else if(sh.kind==="leave"){ D.push([s.name,s.title||"",date,day,"Leave","",sh.code,"","",""]); }
    ws.forEach(w=>{ const z=w.from?zoneById(sh.zone):null; D.push([s.name,s.title||"",date,day,w.label,z?zoneLabelFor(_cyR,z,sh):"",w.code,w.start,w.end,ocHours(w)]); });
  }));
  const ws2=XLSX.utils.aoa_to_sheet(D);
  ws2["!cols"]=[{wch:22},{wch:18},{wch:12},{wch:6},{wch:15},{wch:10},{wch:8},{wch:8},{wch:8},{wch:7}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws1,"RosterOn"); XLSX.utils.book_append_sheet(wb,ws2,"Data");
  XLSX.writeFile(wb,"rosteron-"+active().cycle.start+".xlsx");
  logAudit("export.rosteron",cyLabel(active())+" — "+staff.length+" staff, "+(D.length-1)+" shift rows","admin");save();
  toast("RosterOn workbook exported — 2 sheets: ‘RosterOn’ (readable, grouped by title) + ‘Data’ (one row per shift).");
}
function plannerExportData(){
  const py=plannerYear(), dates=daysInRange(py.from,py.to).map(parseISO);
  const rows=S.staff.map(s=>({name:s.name,eft:round2(s.eft),hrs:round2(s.hrsFortnight),conf:leaveDaysInRange(s.id,py.from,py.to),cells:dates.map(d=>{const sh=getShift(s.id,iso(d));return sh.kind==="leave"?sh.code:"";})}));
  return {dates,rows};
}
function exportPlannerCSV(){
  const {dates,rows}=plannerExportData();
  const head=[ROLEC(),"EFT","Hrs/FTN","Conf leave"].concat(dates.map(d=>d.getDate()+"/"+(d.getMonth()+1)));
  let csv=head.join(",")+"\n";
  rows.forEach(r=>{csv+=[r.name,r.eft,r.hrs,r.conf].concat(r.cells).map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")+"\n";});
  download(csv,"leave-planner.csv","text/csv");logAudit("export.planner.csv","Leave planner CSV exported","admin");save();
}
function exportPlannerXLS(){
  const {dates,rows}=plannerExportData();
  let h='<table border="1" style="border-collapse:collapse;font-family:Arial;font-size:11px"><tr><th>'+ROLEC()+'</th><th>EFT</th><th>Hrs/FTN</th><th>Conf leave</th>'+dates.map(d=>`<th>${d.getDate()}/${d.getMonth()+1}</th>`).join("")+'</tr>';
  rows.forEach(r=>{h+=`<tr><td>${escapeHTML(r.name)}</td><td>${r.eft}</td><td>${r.hrs}</td><td>${r.conf}</td>`+r.cells.map(c=>{if(!c)return '<td></td>';const l=leaveHex(c);return `<td style="background-color:${l.bg};color:${l.t}">${c}</td>`;}).join("")+'</tr>';});
  h+='</table><br><table border="1" style="border-collapse:collapse;font-family:Arial;font-size:11px"><tr><td><b>Legend</b></td><td style="border:2px solid '+PALETTE["--locum"]+';color:'+PALETTE["--locum-t"]+'">Locum (pink border + “(L)”)</td>'+["AL","CME","LSL","PL","UA","PH"].map(c=>{const l=leaveHex(c);return `<td style="background-color:${l.bg};color:${l.t}">${c} — ${l.name}</td>`;}).join("")+'</tr></table>';
  const doc='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>'+h+'</body></html>';
  download(doc,"leave-planner.xls","application/vnd.ms-excel");logAudit("export.planner.xls","Leave planner Excel exported","admin");save();
}

let _fbMood="", _fbCat=""; const MOODLBL={good:"🙂",ok:"😐",bad:"🙁"};
function openFeedback(){
  _fbMood=""; _fbCat="";
  const root=document.getElementById("modalRoot");
  openDialog(`<div class="overlay" id="ovlFb"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT">
    <h3 id="dlgT">Share feedback</h3>
    <div class="muted small" style="margin-bottom:12px">Goes straight to your roster admin — a bug, an idea, or something confusing.</div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="fbm" data-mood="good">🙂 Good</button>
      <button class="fbm" data-mood="ok">😐 Okay</button>
      <button class="fbm" data-mood="bad">🙁 Struggling</button>
    </div>
    <div class="seg" id="fbCat" style="margin:0 0 10px"><button data-cat="bug">Bug</button><button data-cat="idea">Idea</button><button data-cat="confusing">Confusing</button><button data-cat="like">Like</button></div>
    <textarea id="fbText" rows="4" placeholder="What's on your mind?" style="width:100%;box-sizing:border-box;font-family:inherit;font-size:var(--fs-md);padding:9px 11px;border:1px solid var(--line2);border-radius:var(--radius-sm)"></textarea>
    <div class="flexbtns" style="margin-top:14px;align-items:center"><span class="grow"></span><button class="btn" id="fbCancel">Cancel</button><button class="btn primary" id="fbSend">Send feedback</button></div>
  </div></div>`,{focus:"#fbText"});
  root.querySelectorAll(".fbm").forEach(b=>b.onclick=()=>{_fbMood=b.dataset.mood;root.querySelectorAll(".fbm").forEach(x=>x.classList.toggle("on",x===b));});
  root.querySelectorAll("#fbCat button").forEach(b=>b.onclick=()=>{_fbCat=b.dataset.cat;root.querySelectorAll("#fbCat button").forEach(x=>x.classList.toggle("on",x===b));});
  const ov=root.querySelector("#ovlFb"); if(ov)ov.onclick=e=>{if(e.target.id==="ovlFb")closeModal();};
  const cb=root.querySelector("#fbCancel"); if(cb)cb.onclick=closeModal;
  const ta=root.querySelector("#fbText"); if(ta)ta.focus();
  root.querySelector("#fbSend").onclick=()=>{
    const txt=(document.getElementById("fbText").value||"").trim();
    if(!_fbMood&&!_fbCat&&!txt){toast("Add a note, mood, or category first.");return;}
    S.feedback.unshift({id:"fb"+Date.now()+Math.random().toString(36).slice(2,5),ts:Date.now(),from:S.viewAs,name:nameOf(S.viewAs),mood:_fbMood,category:_fbCat,text:txt,tab:_lastTab||S.tab,reviewed:false});
    notify("admin","Feedback from "+nameOf(S.viewAs)+(_fbCat?" ("+_fbCat+")":"")+(txt?": "+txt.slice(0,70):""));
    logAudit("feedback",(_fbCat||"note")+(txt?" · "+txt.slice(0,70):""),S.viewAs);
    save(); closeModal(); render(); toast("Thanks — your feedback was sent to the roster admin.","ok");
  };
}
function viewHelp(){
  const adm=isAdmin();
  const faq=(q,a)=>`<details class="hd"><summary>${q}</summary><div class="ha">${a}</div></details>`;
  const step=(n,t,d)=>`<div class="hstep"><div class="hnum">${n}</div><div><b>${t}</b><div class="muted small">${d}</div></div></div>`;
  return `<div class="card">
    <h2>Help &amp; guide</h2>
    <div class="sub">Everything you need to use Myrosta.${adm?" The admin section is at the bottom.":" Tap any question to expand it."}</div>
    <div class="fbprompt"><span><b>How's Myrosta working for you?</b> A bug, an idea, or something confusing — tell us.</span><button class="btn primary sm" id="fbOpen" style="flex:none">${ic("chat")} Send feedback</button></div>
    ${inDemo()?"":`<div class="fbprompt"><span><b>Showing Myrosta to another department?</b> The demo is this app with made-up staff — send it, with the walkthrough link.</span><button class="btn sm" id="shareDemo" style="flex:none">${ic("arrowUR")} Share the demo</button></div>`}
    ${(cloudOn()&&!inDemo())?(()=>{ const vids=videoList(adm?"admin":"staff",rosterMode(),videoFeats(),adm); return vids.length?`<h3 class="hsec" id="videos">Watch how it works</h3>
    <div class="sub">Short recordings of this app, chapter by chapter, for your role${adm?"":" and your group’s settings"}. Tap one to watch it here; the whole film is first.</div>${(instantBookOn()&&isRolling())?`<div class="muted small" style="margin:-4px 0 8px">In this group a tap books the shift at once \u2014 the film\u2019s Confirm step doesn\u2019t apply here.</div>`:""}
    <div class="vids">${vidGrid(vids,adm)}</div>${adm?`<h3 class="hsec">What your staff see</h3>
    <div class="sub">The staff film in this group’s roster mode and the chapters a staff member sees under Help. A module marked “not switched on” stays hidden from them until you switch it on.</div>
    <div class="vids">${vidGrid(videoList("staff",rosterMode(),videoFeats(),true),true)}</div><h3 class="hsec">For your director</h3>
    <div class="sub">A two-minute cut for someone who will not run the roster: the Day board, the fairness table, the whole department and the audit log.</div>
    <div class="vids">${vidGrid(videoList("director",rosterMode(),videoFeats(),true),true)}</div>`:""}`:""; })():""}
    <h3 class="hsec">Getting started</h3>
    ${step("1","Sign in","Choose Mobile (SMS) or Email, enter it, and type the 6‑digit code. You stay signed in on the device — no password.")}
    ${step("2","See your shifts","‘My shifts’ shows only your own — list or month. Tap ‘Add to calendar’ to push them, with reminders, to your phone.")}
    ${instantBookOn()?step("3","Pick your shifts","When a round opens, go to ‘Book shifts’ and tap a day. Free zones say Open; taken ones show who has them. Tap a zone and it is yours at once — the first tap wins, so there is nothing to confirm; if a colleague got there first, you're told straight away. No two people can hold the same slot."):step("3","Pick your shifts","When a round opens, go to ‘Book shifts’ and tap a day. Free zones say Open; taken ones show who has them. Picks sit in a basket on your phone until you press Confirm — then they are checked against the live roster in one go. The first to confirm gets a slot; if a colleague got there first, you're told which pick didn't go in and why. No two people can hold the same slot.")}
    ${step("4","Leave &amp; swaps","‘Requests’ → request leave or a swap. The admin approves with context and the roster updates automatically.")}
    ${step("5","Put it on your Home Screen","On an iPhone: tap Share, then Add to Home Screen. It opens like an app, stays signed in, and your next shift is one tap away.")}
    <h3 class="hsec" id="whatsnew">What's new</h3>
    ${WHATS_NEW.map(e=>`<div class="wnew"><div class="muted small">${fmtBuild(e.on)}</div><b>${escapeHTML(e.title)}</b><ul>${e.lines.map(l=>`<li>${escapeHTML(l)}</li>`).join("")}</ul></div>`).join("")}
    <h3 class="hsec">Common questions</h3>
    ${faq("I didn’t get my sign‑in code","Check junk/spam, tap Resend, and make sure your admin has the right mobile/email on file. Hospital email blocking it? Use Mobile (SMS).")}
    ${faq("Do I have to sign in every time?","No — you stay signed in on each device. Signing out is the only thing that ends it (and takes you back to the home page).")}
    ${faq("Can two of us book the same shift?","No. The moment someone takes a slot it disappears for everyone else — it’s collision‑proof.")}
    ${faq("Am I disadvantaged if I book last?","No. Per‑fortnight quotas and fairness rules keep it even, whatever order people book in.")}
    ${faq("The roster is live all the time — when can I book?","If your group runs a <b>rolling</b> roster, the roster goes live once and stays live: add or drop your shifts whenever you need to, right through the cycle, within your quota. You can't change a day that has already passed. If your admin has set a booking window you'll see the dates on the Book shifts tab.<br><br>If your group runs <b>rounds</b>, booking is open only between the dates your admin sets — you'll get a notification when it opens and a reminder before it closes.")}
    ${faq("I booked the wrong shift","While the round is open, tap the day, choose ‘Remove this shift’, then pick the right one. If it’s closed, message your admin.")}
    ${faq("My fixed pattern is wrong","If it’s locked, use ‘Send pattern change for approval’ — it goes to the admin rather than changing silently.")}
    ${faq("The admin asked a question about my request","Open Requests — it shows <b>needs your reply</b>. Type your answer in the box under it and Send: the request goes straight back to the admin, and the whole conversation stays on the request.")}
    ${S.marketOn?faq("Swap or Open shift — which do I use?","A <b>swap</b> is a two‑way trade, with a named colleague or with whoever answers <b>Ask everyone</b> — each of you works the other\u2019s shift, and every offer says what it counts (Requests → swap). The <b>open‑shift marketplace</b> is one‑way and goes to everyone: a shift is broadcast, the first eligible person claims it. Use a swap when you can work, just not <i>that</i> day. Use <b>Offer to group</b> (My shifts) when you can’t do the shift at all — and after a give‑away, book another day to square your quota (the quota pills show the gap)."):""}
    ${S.marketOn&&S.pushOn?faq("How do phone alerts work?","On My shifts tap <b>Get open‑shift alerts on this phone</b> and approve the prompt — this phone then hears about open shifts even with the app closed. iPhone: add Myrosta to your Home Screen first (Share → Add to Home Screen) and open it from the icon."):""}
    ${adm?`<h3 class="hsec">For admins</h3>
    ${faq("Set up the department","Settings → zones, minimum/maximum cover, self‑roster method and quota period. Import your data, or use the Get‑started guide + Staff template.")}
    ${faq("Run a self‑roster round","Place fixed shifts, optionally ‘Fill to minimum cover’, then ‘Open booking’. Watch coverage and quotas fill live; edit any cell anytime.")}
    ${faq("Approve requests with context","Requests shows each leave/swap with the person’s EFT, leave already taken, who else is away, and the daily cap — approve or decline in a tap. Not clear‑cut? Type in the comment box and tap <b>Ask a question</b> — the request waits, they reply, and it returns to you with the conversation attached.")}
    ${faq("Manage staff & access","Staff tab to add people and their emails/mobiles. Settings → Access control → Sync allow‑list. ‘Make admin’ promotes a colleague.")}
    ${faq("Payroll export","Roster → Export… → Payroll file for RosterOn exports every shift in one click — correct times and leave pro‑rated by EFT.")}
    ${faq("Rounds or rolling — which roster mode?","<b>Rounds</b> (the default): you release the roster, everyone books during the round, you close it and publish. Everyone competes for the same open slots at the same time, which is the fairest way to share popular and unpopular shifts — and it is the only mode that supports In random groups and Take turns.<br><br><b>Rolling</b>: you go live once and the roster stays live. Staff add and drop their own shifts whenever they need to, right through the cycle. Good for small teams, for groups that fill shifts as they come up, and for admin/clerical rosters. Set a booking window if you want to limit when they may book — the roster stays visible either way.<br><br>It is set <b>per cycle</b> in <b>Settings → Roster mode</b>, so different staff groups (and different cycles) can run differently. Every guard is the same in both modes: leave, double-booking, zone cover, safe hours and quota all still apply, and past days can't be changed.")}
    ${faq("Capacity check — do we have enough staff?","Settings → Capacity check: it takes the cover you need (zones × min/max), your EFT and a realistic away‑buffer (leave, sick, CME) and writes out, in plain words, how many shifts a week you can fill, how many go uncovered, and how many more EFT it would take — at minimum and at full cover. Change any number for a what‑if (nothing touches the roster) and print it as a one‑page business case.")}
    ${faq("Open‑shift marketplace &amp; phone alerts","Settings → Open‑shift marketplace: broadcast an unfilled shift to the whole group, or let staff hand a shift back with Offer to group. You choose first‑come or admin‑approved claims, and whether over‑quota gap fill is allowed. Phone alerts need a one‑time server step (PUSH‑MARKETPLACE.md), then each person switches them on per phone from My shifts.")}`:""}
    ${adm&&(S.feedback||[]).length?`<h3 class="hsec">Feedback received (${S.feedback.length})</h3>${S.feedback.slice(0,40).map(f=>`<div class="fbitem${f.reviewed?" done":""}"><div class="fbmeta">${f.mood?MOODLBL[f.mood]+" ":""}<b>${escapeHTML(f.name||"")}</b>${f.category?` <span class="tag muted">${escapeHTML(f.category)}</span>`:""} <span class="muted small">· ${tsFmt(f.ts)}${f.tab?" · "+escapeHTML(f.tab):""}</span></div>${f.text?`<div class="fbtext">${escapeHTML(f.text)}</div>`:""}${(f.from&&f.from!=="admin"&&S.staff.find(x=>x.id===f.from))?`<button class="btn sm primary" data-fbreply="${f.id}">${ic("reply")} Reply</button> `:""}<button class="btn sm fbrev" data-fb="${f.id}">${f.reviewed?ic("check")+" Reviewed":"Mark reviewed"}</button></div>`).join("")}`:""}
    <div class="note" style="margin-top:14px">More: <a href="index.html" target="_blank" rel="noopener">myrosta.com.au</a> · <a href="support.html" target="_blank" rel="noopener">Support</a> · <a href="privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="#" id="helpReload">Reload the app</a><br><span class="muted">${cloudOn()?"Stored in Sydney, Australia":"Kept in this browser"}${cloudOn()&&_evOk===true?" · bookings go straight to the database · live updates "+(_rtStatus==="SUBSCRIBED"?"on":"off \u2014 checked every 45 s instead"):""} · every change is logged · build ${fmtBuild(BUILD)}</span></div>
  </div>`;
}
function shiftTally(sid){ const ds=cycleDates(); const _cy=active(); let am=0,pm=0,cst=0,locum=0,full=0; const zones={},leave={};
  ds.forEach(d=>{ const sh=getShift(sid,iso(d));
    if(sh.kind==="clinical"){ const f=fillsOf(_cy,sh); if(f.indexOf("AM")>=0)am++; if(f.indexOf("PM")>=0)pm++; if(f.length>1)full++; if(sh.locum)locum++; const z=zoneById(sh.zone),zn=z?z.name:"?"; zones[zn]=(zones[zn]||0)+1; }
    else if(sh.kind==="cst")cst++;
    else if(sh.kind==="leave")leave[sh.code]=(leave[sh.code]||0)+1; });
  return {am,pm,cst,locum,full,zones,leave}; }
/* ---------- Equity (tough-shift share) ---------- */
function equityCycles(period){
  const sorted=S.cycles.filter(c=>!draftHidden(c)).slice().sort((a,b)=>a.cycle.start<b.cycle.start?1:-1);   // newest first, archived included (history matters); a draft staff cannot see stays out of their report
  if(period==="cycle")return [active()];
  if(period==="three")return sorted.slice(0,3);
  const yr=String(parseISO(active().cycle.start).getFullYear());
  return sorted.filter(c=>{ const end=iso(cyEnd(c)); return c.cycle.start.slice(0,4)===yr||end.slice(0,4)===yr; });
}
function equityData(period){
  const yr=String(parseISO(active().cycle.start).getFullYear());
  const tl=S.toughList||{}; const rows={};
  const blank=()=>({booked:0,quota:0,we:0,fri:0,mon:0,oc:0,ph:0,locum:0,tough:0});
  equityCycles(period).forEach(cyc=>{ if(!cyc)return;
    const wins=ocWindows(cyc), taken=ocTakenWindows(cyc), oc=cyc.oncall||{};   // once per cycle, never per shift
    Object.keys(cyc.roles||{}).forEach(sid=>{ const r=cyc.roles[sid]; if(r&&r.in!==false){ (rows[sid]=rows[sid]||blank()).quota+=(+r.quota||0); } });
    Object.keys(cyc.assign||{}).forEach(k=>{ const v=cyc.assign[k]; if(!v||v.kind!=="clinical")return;
      const i=k.indexOf("|"), sid=k.slice(0,i), d=k.slice(i+1);
      if(period==="ytd"&&d.slice(0,4)!==yr)return;
      const r=rows[sid]=rows[sid]||blank(); const _f=fillsOf(cyc,v), _pm=_f.indexOf("PM")>=0; r.booked+=_f.length;   // units, so Shifts / quota is one ratio
      const dow=parseISO(d).getDay(); let tough=false;
      if(dow===0||dow===6){r.we++;if(tl.weekend)tough=true;}
      if(dow===5&&_pm){r.fri++;if(tl.friPM)tough=true;}
      if(dow===1&&_pm){r.mon++;if(tl.monPM)tough=true;}
      const _on=wins.filter(w=>ocChosen(w)?!!ciGet(cyc,d,w.id,sid):(w.from?ocFollows(cyc,w,v):oc[ocKey(d,w.id)]===sid)).length; if(_on){r.oc+=_on;if(tl.onCall)tough=true;}   // a day on call makes that day's shift tough once, however many windows
      if(isPH(d)){r.ph++;if(tl.ph)tough=true;}
      if(v.locum)r.locum++;
      if(tough)r.tough++; });
    Object.keys(oc).forEach(k=>{ const sid=oc[k]; if(!sid)return; const i=k.indexOf("|"), d=k.slice(0,i), wid=k.slice(i+1);
      if(period==="ytd"&&d.slice(0,4)!==yr)return;
      const a=(cyc.assign||{})[sid+"|"+d]; if(a&&a.kind==="clinical")return;   // counted with that day's shift above
      if(!taken.some(w=>w.id===wid&&!ocChosen(w)))return;   // a key whose window has gone counts as nothing, as everywhere else
      (rows[sid]=rows[sid]||blank()).oc++; });   // on call with no shift that day: its own count, and no tough SHIFT, because there is no shift
    Object.keys(cyc.callins||{}).forEach(k=>{ const p=ciParse(k); if(!p||!ciValid(cyc.callins[k]))return;
      if(period==="ytd"&&p.d.slice(0,4)!==yr)return;
      const a=(cyc.assign||{})[p.sid+"|"+p.d]; if(a&&a.kind==="clinical")return;   // counted with that day's shift above
      if(!taken.some(w=>w.id===p.win&&ocChosen(w)))return;
      (rows[p.sid]=rows[p.sid]||blank()).oc++; });   // a call-in with no shift that day counts on its own, like on-call
  });
  return S.staff.filter(st=>rows[st.id]&&(rows[st.id].booked>0||rows[st.id].quota>0||rows[st.id].oc>0)).map(st=>({s:st,m:rows[st.id]}));
}
function viewEquity(){
  const period=window._eqPeriod||"cycle";
  const data=equityData(period);
  const me=S.viewAs;
  const cys=equityCycles(period).filter(Boolean), drafts=cys.filter(c=>c.status==="draft");
  const plabel=period==="cycle"?cyLabel(active()):period==="three"?(cys.length+" most recent cycles"):("Year "+parseISO(active().cycle.start).getFullYear());
  const seg=`<div class="seg"><button data-eqp="cycle" class="${period==="cycle"?"on":""}">This cycle</button><button data-eqp="three" class="${period==="three"?"on":""}">Last 3 cycles</button><button data-eqp="ytd" class="${period==="ytd"?"on":""}">Year to date</button></div>`;
  if(!data.length)return `<div class="card" id="eqCard">${printHeadHTML("Fairness summary — "+cyLabel(active()))}<h2>Equity</h2><div class="sub">Who\u2019s carrying the tough shifts. ${seg}</div>${emptyState(EIC.scale,"Fairness fills in as the roster does","No clinical shifts recorded for this period yet — once shifts are booked or published, the share of tough shifts appears here.")}</div>`;
  const totB=data.reduce((a,r)=>a+r.m.booked,0), totT=data.reduce((a,r)=>a+r.m.tough,0);
  const teamShare=totB?Math.round(totT/totB*100):0;
  const shares=data.map(r=>r.m.booked?Math.round(r.m.tough/r.m.booked*100):0);
  const shmx=Math.max.apply(null,shares), shmn=Math.min.apply(null,shares);
  const heavy=data[shares.indexOf(shmx)];
  const METR=[["we","Weekends"],["fri","Fri PM"],["mon","Mon PM"],["oc","On-call"],["ph","Pub hol"],["locum","Locum"]];
  const maxOf={}; METR.forEach(mm=>{ maxOf[mm[0]]=Math.max.apply(null,data.map(r=>r.m[mm[0]]).concat([1])); });
  const avgOf={}; METR.forEach(mm=>{ avgOf[mm[0]]=data.reduce((a,r)=>a+r.m[mm[0]],0)/data.length; });
  const bar=(v,mx,av)=>{ const w=mx?Math.round(v/mx*100):0, ap=mx?Math.min(100,Math.round(av/mx*100)):0, hot=av>0&&v>=1.5*av;
    return `<span class="eqbar"><b>${v}</b><span class="eqtrack"><span class="eqfill${hot?" hot":""}" style="width:${w}%"></span><span class="eqavg" style="left:${ap}%"></span></span></span>`; };
  const rowsH=data.map((r,i)=>{ const sh=shares[i];
    const cls=teamShare&&sh>=1.3*teamShare?"hi":(teamShare&&sh<=0.7*teamShare?"lo":"mid");
    return `<tr class="${r.s.id===me?"rowhl":""}"><td class="namecol">${escapeHTML(r.s.name)}${r.s.id===me?' <span class="tag brand">you</span>':""}</td>`+
      `<td style="white-space:nowrap">${r.m.booked}${r.m.quota?` / ${r.m.quota}`:""}</td>`+
      METR.map(mm=>`<td>${bar(r.m[mm[0]],maxOf[mm[0]],avgOf[mm[0]])}</td>`).join("")+
      `<td class="eqshare ${cls}">${r.m.tough} of ${r.m.booked} · ${sh}%</td></tr>`; }).join("");
  const tl=S.toughList||{};
  const toughDef=[tl.weekend?"weekend":null,tl.monPM?"Mon PM":null,tl.friPM?"Fri PM":null,tl.onCall?"on-call":null,tl.ph?"public holiday":null].filter(Boolean).join(", ");
  const adminCard=isAdmin()?`<div class="card"><h2>What counts as a tough shift</h2>
    <div class="sub">Applies to the whole report — agree it with the group once. Public-holiday dates are the ones you mark on the Roster/Daily views.</div>
    <div class="row" style="margin-top:6px">${[["weekend","Weekend"],["monPM","Monday PM"],["friPM","Friday PM"],["onCall","On-call"],["ph","Public holiday"]].map(x=>`<label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm)"><input type="checkbox" data-tough="${x[0]}" ${tl[x[0]]?"checked":""}> ${x[1]}</label>`).join("")}</div></div>`:"";
  return `<div class="card" id="eqCard">${printHeadHTML("Fairness summary — "+cyLabel(active()))}
    <div class="row"><h2>Equity</h2><span class="grow"></span>${seg}<button class="btn sm" id="eqPrint">${ic("print")} One-page summary</button></div>
    <div class="sub">Who\u2019s carrying the tough shifts — <b>${plabel}</b>. A <b>tough shift</b> = ${escapeHTML(toughDef)||"(nothing selected)"} (a shift ticking several boxes counts once). Share = how much of <i>your</i> roster is tough, so part-timers compare fairly.</div>
    <div class="grid-tiles" style="margin:12px 0">
      <div class="tile"><div class="k">TOUGH-SHIFT SHARE</div><div class="v">${shmx}%&thinsp;–&thinsp;${shmn}%</div><div class="d">team ${teamShare}% · heaviest: ${escapeHTML(heavy?heavy.s.name:"—")}</div></div>
      <div class="tile"><div class="k">CLINICAL SHIFTS</div><div class="v">${totB}</div><div class="d">across ${data.length} ${ROLES()}</div></div>
      <div class="tile"><div class="k">TOUGH SHIFTS</div><div class="v">${totT}</div><div class="d">weekends, evenings, on-call, PH</div></div>
    </div>
    <div class="twrap" style="overflow-x:auto"><table aria-label="Equity per ${ROLE()}"><thead><tr><th class="namecol">${ROLEC()}</th><th>Shifts${data.some(r=>r.m.quota)?" / quota":""}</th>${METR.map(mm=>`<th>${mm[1]}</th>`).join("")}<th>Tough-shift share</th></tr></thead><tbody>${rowsH}</tbody></table></div>
    <div class="muted small" style="margin-top:8px">Bars scale to the team maximum; the dark tick is the team average; red = ≥1.5× average. ${drafts.length?"":`<span class="scronly">Everyone sees this same table — fairness only builds trust when it\u2019s visible.</span>`}</div>
  ${printFootHTML(drafts.length?("Includes "+drafts.map(cyShort).join(", ")+", which staff cannot see until it is published."):("Everyone in "+(groupName()||"the group")+" sees this same table in Myrosta — fairness only builds trust when it is visible."))}</div>${adminCard}`;
}
let _secOpen=null;   // My shifts sections — device-side; defaults open on desktop, closed on phones
function secOpen(k){ if(!_secOpen){ const d=!isMobile(); _secOpen={cycle:d,stats:d,cal:d}; } return !!_secOpen[k]; }
function weekStripHTML(sid,fromISO){   // the next seven days, consecutive off days folded into one line
  const ds=cycleDates(); if(!ds.length)return "";
  const start=fromISO>=iso(ds[0])?fromISO:iso(ds[0]);
  const days=ds.filter(d=>iso(d)>=start).slice(0,7); if(!days.length)return "";
  let out="", offRun=[];
  const flush=()=>{ if(!offRun.length)return; const a=offRun[0], b=offRun[offRun.length-1];
    const we=offRun.some(d=>d.getDay()===0||d.getDay()===6), ph=offRun.some(d=>isPH(iso(d)));
    out+=`<div class="wk-row wk-off${we?" we":""}"><span class="wk-d">${wkDayLabel(a,offRun.length>1?b:null)}${ph?' <span class="tag ph mini">PH</span>':""}</span><span class="wk-s muted">Off</span></div>`; offRun=[]; };
  days.forEach(d=>{ const k=iso(d), sh=getShift(sid,k), we=d.getDay()===0||d.getDay()===6, ph=isPH(k);
    if((!sh||sh.kind==="off"||!sh.kind)&&!ocTakenBy(active(),sid,k).length){ offRun.push(d); return; } flush();
    const _c=active(); const when=(sh.kind==="clinical"||sh.kind==="cst")?shTimeStr(_c,sh):"";
    const _oc=ocLine(_c,sid,k);
    out+=`<div class="wk-row ${we?"we":""} ${sh.kind} ${sh.kind==="clinical"?typeClass(_c,sh):""}"><span class="wk-d">${wkDayLabel(d,null)}${ph?' <span class="tag ph mini">PH</span>':""}</span><span class="wk-s"><b>${escapeHTML(shiftLabel(sh))}</b>${when?` · ${when}`:""}${_oc?` · <span class="tag oc mini">${escapeHTML(_oc)}</span>`:""}</span></div>`; });
  flush();
  const own=sid===S.viewAs&&S.viewAs!=="admin"&&!_realAdmin;   // a person's own week — never an admin previewing someone
  return `<div class="weekstrip"><div class="sub wkhead" style="margin-bottom:6px"><b>${start>fromISO?"First week of the cycle":"Next 7 days"}</b>${own?`<span class="grow"></span><button class="btn sm" id="shareWeek">${ic("arrowUR")} Share</button>`:""}</div>${out}</div>`;
}
function actionRowHTML(sid,s){   // what you can do about your roster right now, driven by the cycle's state
  const adm=isAdmin(), g=bookingGate(active()); const btns=[];
  if(!adm&&g.ok)btns.push(`<button class="btn primary" data-go="selfroster">${isRolling()?"Add or drop shifts":"Book shifts"}</button>`);
  if(!adm)btns.push(`<button class="btn" data-go="requests">Request leave or swap</button>`);
  if(adm)btns.push(`<button class="btn" data-go="roster">Edit roster</button>`);
  const open=(featOn("marketplace")&&S.marketOn)?osForStaff().filter(o=>o.status==="open").length:0;
  if(open)btns.push(`<button class="btn" data-go="my||openshifts">Open shifts (${open})</button>`);
  btns.push(`<button class="btn" id="calToggle" aria-expanded="${secOpen("cal")?"true":"false"}">Calendar</button>`);
  return `<div class="actrow">${btns.join("")}</div>`;
}
function cstQuotaTableHTML(){   // the Quota & fairness table in its CST view: the clinical table's shape, reading the CST quota and its split
  const L=cstLabel(), isCycle=S.quotaPeriod==="cycle", ps=cyclePeriods(), def=cstDefaultQuota();
  const head=`<tr><th>${ROLEC()}</th>${isCycle?`<th class="num">${escapeHTML(L)} / cycle</th>`:ps.map(p=>`<th class="num">${p.label}</th>`).join("")+`<th class="num">Cycle</th>`}</tr>`;
  const own=s=>(s.cstQuota!=null&&s.cstQuota!=="")?s.cstQuota:"";
  const qbox=s=>`<input type="number" min="0" class="qt-cstq" data-sid="${s.id}" value="${own(s)}" placeholder="${def||"\u2014"}" aria-label="${escapeHTML(s.name)} \u00b7 ${escapeHTML(L)} per cycle">`;
  const rows=rosterStaff().map(s=>{ if(isCycle)return `<tr><td class="namecol">${escapeHTML(s.name)}</td><td class="num">${qbox(s)}</td></tr>`;
    const hasOv=s.cstTargets&&Object.keys(s.cstTargets).length, q=cstQuotaOf(s);
    if(S.quotaFlex&&!hasOv){ const ci=cstCapInfo(s), cell=ci.r>0?(ci.floor+"\u2013"+ci.ceil):(""+ci.floor);
      return `<tr><td class="namecol">${escapeHTML(s.name)}</td>${ps.map(()=>`<td class="num" style="color:var(--muted)">${q?cell:"\u2014"}</td>`).join("")}<td class="num">${qbox(s)}</td></tr>`; }
    const t=cstTargetsOf(s), tot=t.reduce((a,b)=>a+b,0), off=q>0&&tot!==q;
    return `<tr><td class="namecol">${escapeHTML(s.name)}</td>${t.map((v,i)=>{const ov=s.cstTargets&&s.cstTargets[i]!=null&&s.cstTargets[i]!=="";return `<td class="num"><input type="number" min="0" class="qt-cstcell" data-sid="${s.id}" data-pi="${i}" value="${q?v:""}" aria-label="${escapeHTML(s.name)} \u00b7 ${escapeHTML(ps[i].label)} ${escapeHTML(L)}"${ov?' style="font-weight:600;color:var(--accent)"':""}></td>`;}).join("")}<td class="num"${off?' style="color:var(--danger-t)"':""}>${qbox(s)}</td></tr>`; }).join("");
  const foot=isCycle?`<span class="muted small">Each ${ROLE()}\u2019s ${escapeHTML(L)} days this cycle \u2014 blank uses the default above, 0 means no cap.</span>`
    :(S.quotaFlex?`<span class="muted small">Each ${periodTag().toLowerCase()} shows the base\u2013ceiling for ${escapeHTML(L)}; staff place the leftover day in the ${periodTag().toLowerCase()} that suits them.</span>`
    :`<button class="btn sm" id="qtCstReset">Reset all to auto</button> <span class="muted small">Periods split each person\u2019s ${escapeHTML(L)} days evenly \u2014 edit any cell; the Cycle box turns red if they stop adding up.</span>`);
  return `<div style="overflow-x:auto;margin-top:6px"><table class="maptbl">${head}${rows}</table></div><div class="flexbtns" style="margin-top:8px">${foot}</div>`; }
function quotaStripHTML(sid,s){
  const t=shiftTally(sid), periods=cyclePeriods(), cycClin=t.am+t.pm, quota=+s.quota||0;
  const cq=featOn("cst")?cstQuotaOf(s):0, L=cstLabel();   // the CST strip appears only once a person has a CST quota
  const cstStrip=cq?`<div class="quotastrip"><span class="muted small">${escapeHTML(L)} / ${S.quotaPeriod||"fortnight"}:</span>${periods.map(p=>{const b=cstInPeriod(sid,p),tg=cstTarget(s,p.index);return `<span class="tag ${b>tg?"warn":"ok"}">${p.label} ${b}/${tg}</span>`;}).join("")}</div>`:"";
  return `<div class="quotastrip"><span class="muted small">Your share / ${S.quotaPeriod||"fortnight"}:</span>${periods.map(p=>{const b=bookedInPeriod(sid,p),tg=periodTarget(s,p.index);return `<span class="tag ${b>=tg?"ok":"warn"}">${p.label} ${b}/${tg}</span>`;}).join("")}</div>`+cstStrip;
}
function wkDayLabel(a,b){ const m=d=>fmt(d,{month:"short"}); if(!b)return DOW[a.getDay()]+" "+a.getDate()+" "+m(a); return m(a)===m(b)?(DOW[a.getDay()]+" "+a.getDate()+" \u2013 "+DOW[b.getDay()]+" "+b.getDate()+" "+m(a)):(DOW[a.getDay()]+" "+a.getDate()+" "+m(a)+" \u2013 "+DOW[b.getDay()]+" "+b.getDate()+" "+m(b)); }   // "Mon 23 Nov"; an off run "Sat 28 \u2013 Sun 29 Nov", or both months when it crosses one
function viewMy(){
  const adm=isAdmin();
  if(!S.staff.length)return `<div class="card"><h2>My shifts</h2>${noOneHTML()}</div>`;
  const _me=adm?clockMySid():null, _meOn=!!_me&&rosterStaff().some(x=>x.id===_me);   // an admin who is on the roster lands on their own shifts; one whose record is non-clinical or off this cycle lands where they always did
  const sid=adm?(myPerson&&S.staff.find(x=>x.id===myPerson)?myPerson:(_meOn?_me:(rosterStaff()[0]||S.staff[0]||{}).id)):S.viewAs;
  const s=S.staff.find(x=>x.id===sid);
  const ds=cycleDates();
  const cycFrom=iso(ds[0]), cycTo=iso(ds[ds.length-1]);
  let r=window._range;
  if(!r || r.to<cycFrom || r.from>cycTo){ r={from:cycFrom,to:cycTo}; }   // reset if missing or left over from another cycle (no overlap → "No shifts in range")
  window._range=r;
  const items=ds.filter(d=>iso(d)>=r.from&&iso(d)<=r.to).map(d=>({d,sh:getShift(sid,iso(d))}));
  const clin=items.filter(i=>i.sh.kind==="clinical").length;
  const cst=items.filter(i=>i.sh.kind==="cst").length;
  const leave=items.filter(i=>i.sh.kind==="leave").length;
  const cme=items.filter(i=>i.sh.kind==="leave"&&i.sh.code==="CME").length;   // CME days in the selected range — consultants track this against their annual allowance
  const _st=effShiftTimes();
  const _cy=active();
  const _ocW=ocWindows(_cy), hrs=Math.round(items.reduce((a,i)=>{ if(i.sh.kind!=="clinical")return a; let h=shiftHours(_cy,i.sh);
    _ocW.forEach(w=>{ if(ocFollows(_cy,w,i.sh))h+=ocHours(w); }); return a+h; },0)*10)/10;   // a shift is worth its own hours plus any window that follows it; a window taken on its own is counted on its own
  const _ocIn=items.reduce((a,i)=>a.concat(ocTakenBy(_cy,sid,iso(i.d))),[]), _ocH=Math.round(_ocIn.reduce((a,w)=>a+ocHours(w),0)*10)/10, _ocShow=_ocIn.length>0||ocTakenWindows(_cy).length>0;   // on call taken in the range: counted on its own, never as clinical time, for a group paid on what it bills
  const t=shiftTally(sid), periods=cyclePeriods();
  const todayISO=iso(new Date());
  let nextSh=null; for(const d of ds){const id=iso(d); if(id<todayISO)continue; const sh=getShift(sid,id); if(sh.kind==="clinical"||sh.kind==="cst"){nextSh={d,sh};break;}}
  const cycClin=clinicalCountFor(sid), quota=+s.quota||0, qpct=quota?Math.min(100,Math.round(cycClin/quota*100)):0;   // cycClin is in the engine's own units, so a whole-day shift moves the bar by two
  let whenStr=""; if(nextSh){const dd=Math.round((nextSh.d-parseISO(todayISO))/864e5); whenStr=dd<=0?"Today":dd===1?"Tomorrow":("in "+dd+" days");}
  const per=nextSh?(nextSh.sh.kind==="cst"?"cst":typeClass(_cy,nextSh.sh)):"none";   // the hero carries the shift type as a solid tag, so the text names the zone and the start only
  const perTag=nextSh?(nextSh.sh.kind==="cst"?(typeLabelOf(_cy,nextSh.sh)||"CST"):typeLabelOf(_cy,nextSh.sh)):"";
  const nextMain=nextSh?(DOW[nextSh.d.getDay()]+" "+nextSh.d.getDate()+" "+fmt(nextSh.d,{month:"short"})+(nextSh.sh.kind==="clinical"?" · "+(zoneById(nextSh.sh.zone)?zoneLabelFor(_cy,zoneById(nextSh.sh.zone),nextSh.sh):"?")+" · "+((shiftWindow(_cy,nextSh.sh)||{}).start||""):" · "+((typeOf(_cy,nextSh.sh)||{}).start||effShiftTimes().CST.start))):nothingYetText();
  secOpen("cal");
  let heroFrom=null; if(_selfChange&&_heroSeen&&_heroSeen.sid===sid&&_heroSeen.cycle===S.activeId&&_heroSeen.pct!==qpct)heroFrom=_heroSeen.pct; _heroSeen={sid,cycle:S.activeId,pct:qpct};   // the bar moves from where it was last painted — only on a render this device caused
  return `${pageHead("My shifts",[adm?"":escapeHTML(s.name),escapeHTML(groupName())].filter(Boolean).join(" · "))}<div class="card">
    ${cardTitle("My shifts"+(adm?"":" — "+escapeHTML(s.name)))}
    ${adm?`<div class="row"><label class="field"><span class="lbl">${ROLEC()}</span><select id="mySel">${rosterStaff().map(x=>`<option value="${x.id}" ${x.id===sid?"selected":""}>${escapeHTML(x.name)}</option>`).join("")}</select></label></div>`:""}
    <div class="nextcard" data-period="${per}">
      <div class="nextlbl">Your next shift</div>
      <div class="nextrow"><div class="nextmain">${nextSh?`<span class="tag solid ${per}">${escapeHTML(perTag.toUpperCase())}</span>`:""}${escapeHTML(nextMain)}</div>${nextSh?`<div class="nextwhen">${whenStr}</div>`:""}</div>
      <div class="qbar"><div class="qbar-top"><span class="muted small">Booked this cycle</span><span class="qnum"><b>${cycClin}</b> / ${quota||"—"}</span></div><div class="qtrack"><div class="qfill" style="width:${qpct}%"${heroFrom!=null?` data-from="${heroFrom}"`:""}></div></div></div>
    </div>
    ${actionRowHTML(sid,s)}${clockMyHTML(sid)}${sid===S.viewAs?a2hsCardHTML():""}
    ${weekStripHTML(sid,todayISO)}
    ${quotaStripHTML(sid,s)}${myTagsHTML(s)}
    <details class="sec" data-sec="cycle" ${secOpen("cycle")?"open":""}><summary>${ic("chevR")}Whole cycle</summary>
      <div class="seg" style="margin-top:8px"><button class="on" id="vAgenda">Agenda</button><button id="vMonth">Month</button></div>
      <div id="myBody">${agendaHTML(sid,r.from,r.to)}</div>
    </details>
    <details class="sec" data-sec="stats" ${secOpen("stats")?"open":""}><summary>${ic("chevR")}Stats &amp; tally</summary>
      <div class="grid-tiles" style="margin:12px 0">
        <div class="tile"><div class="tilehead">${TIC.cal}<span class="k">Clinical shifts</span></div><div class="v">${clin}</div></div>
        ${featOn("cst")?`<div class="tile"><div class="tilehead">${TIC.cst}<span class="k">Support time (CST)</span></div><div class="v">${cst}${cstQuotaOf(s)?"/"+cstQuotaOf(s):""}</div>${cstQuotaOf(s)?`<div class="muted small">your ${escapeHTML(cstLabel())} days this cycle</div>`:""}</div>`:""}
        <div class="tile"><div class="tilehead">${TIC.leave}<span class="k">Leave days</span></div><div class="v">${leave}</div></div>
        <div class="tile"><div class="tilehead">${TIC.cme}<span class="k">CME days</span></div><div class="v">${cme}</div></div>
        <div class="tile"><div class="tilehead">${TIC.clock}<span class="k">Clinical hours</span></div><div class="v">${hrs}</div></div>
        <div class="tile"><div class="tilehead">${TIC.target}<span class="k">Shifts this cycle</span></div><div class="v">${cycClin}/${s.quota}</div><div class="muted small">your share of clinical shifts${t.full?" — a whole day counts as two":""}</div></div>
      </div>
      <div class="cluster" style="margin-bottom:8px">
        <span class="tag lg am">${escapeHTML(perName("AM"))} ${t.am}</span><span class="tag lg pm">${escapeHTML(perName("PM"))} ${t.pm}</span>${t.full?`<span class="tag lg full">Whole days ${t.full}</span>`:""}${featOn("cst")?`<span class="tag lg cst">${escapeHTML(typeById(_cy,"CST")?typeById(_cy,"CST").label:"CST")} ${t.cst}</span>`:""}${_ocShow?`<span class="tag lg oc" title="Counted apart from clinical time">On call ${_ocIn.length} · ${_ocH}h</span>`:""}
        ${Object.keys(t.zones).sort().map(zn=>`<span class="tag muted">${escapeHTML(zn)} ×${t.zones[zn]}</span>`).join("")}
        ${t.locum?`<span class="tag lg locumleg" title="Clinical shifts you covered as locum">Locum ${t.locum}</span>`:""}
      </div>
      ${Object.keys(t.leave).length?`<div class="cluster" style="margin-bottom:8px">${["CME","AL","PL","LSL","Sab","PH","UA","UPL","Other","Orientation","Vacant"].filter(c=>t.leave[c]).map(c=>{const l=leaveStyle(c);return `<span class="tag lg" style="background:${l.bg};color:${l.t}">${l.name} ${t.leave[c]}</span>`;}).join("")}</div>`:""}
      ${(()=>{const py=plannerYear(),yt=leaveCodeDaysInRange(sid,py.from,py.to),al=leaveStyle("AL"),cm=leaveStyle("CME");return `<div class="cluster"><span class="muted small">This year (${py.from.slice(0,4)}):</span><span class="tag lg" style="background:${al.bg};color:${al.t}">Annual used ${yt.AL||0}</span><span class="tag lg" style="background:${cm.bg};color:${cm.t}">CME used ${yt.CME||0}</span></div>`;})()}
    </details>
    <details class="sec" id="calSec" data-sec="cal" ${secOpen("cal")?"open":""}><summary>${ic("chevR")}Calendar &amp; export</summary>
      <div class="row" style="margin-top:8px">
        <div class="drange">
          <label class="field"><span class="lbl">From</span><input type="date" id="rFrom" value="${r.from}"></label>
          <label class="field"><span class="lbl">To</span><input type="date" id="rTo" value="${r.to}"></label>
        </div>
        <div class="presets"><button class="btn sm" data-preset="all">Whole cycle</button><button class="btn sm" data-preset="2wk">Next 2 wks</button></div>
        <button class="btn primary" id="icsBtn">Add to calendar (.ics)</button>${cloudOn()?` <button class="btn" id="subLive">Live calendar${window._showSub?" "+ic("chevU"):""}</button>`:""}
        ${window._showSub?subFeedHTML(s):""}
      </div>
    </details>
  </div>${(featOn("marketplace")&&S.marketOn)?marketMyHTML():""}${(s.mode==="fixed"||s.mode==="preference")?fixedPatternEditorHTML(s,adm||sid===S.viewAs,!adm):""}`;
}
function agendaHTML(sid,from,to){
  const ds=cycleDates();
  const items=ds.filter(d=>iso(d)>=from&&iso(d)<=to).map(d=>({d,sh:getShift(sid,iso(d))}));
  if(!items.length)return emptyState(EIC.cal,"No shifts in range","Try a wider date range, or check back once the roster is published.");
  let agenda="",lastWk=null;
  items.forEach(({d,sh})=>{
    const wk=Math.floor(Math.round((d-ds[0])/864e5)/7);   // DST-safe week index (see cycleWeekAB)
    if(wk!==lastWk){agenda+=`<div class="weekhdr">Week ${wk+1} · from ${fmt(addDays(ds[0],wk*7))}</div>`;lastWk=wk;}
    agenda+=`<div class="agday${[0,6].includes(d.getDay())?" we":""}${isPH(iso(d))?" ph":""}"><div class="d"><div class="dn">${DOW[d.getDay()]}</div><div class="dd">${d.getDate()}</div><div class="dm">${escapeHTML(fmt(d,{month:"short"}))}</div>${isPH(iso(d))?'<div class="tag ph mini" style="margin-top:2px">PH</div>':""}</div><div class="grow">${shiftLine(sh)}${marketOfferBtn(sid,iso(d),sh)}</div></div>`;
  });
  return agenda;
}
function shiftLine(sh){
  const _c=active();
  if(sh.kind==="clinical"){const z=zoneById(sh.zone);return `<span class="tag lg ${typeClass(_c,sh)}${sh.locum?" locum":""}">${shTimeStr(_c,sh)} · ${escapeHTML(z?zoneLabelFor(_c,z,sh):"?")}</span>${sh.locum?' <span class="tag locumleg">Locum</span>':''}`;}
  if(sh.kind==="cst")return `<span class="tag lg cst">${escapeHTML(typeLabelOf(_c,sh)||"CST")} · non-clinical</span>`;
  if(sh.kind==="leave"){const ls=leaveStyle(sh.code);return `<span class="tag lg" style="background:${ls.bg};color:${ls.t}">${escapeHTML(LEAVE_LABEL[sh.code]||sh.code)}</span>`;}
  return `<span class="muted small">Off</span>`;
}
function monthHTML(sid,from,to){
  const ds=cycleDates();const items=ds.filter(d=>iso(d)>=from&&iso(d)<=to);
  if(!items.length)return emptyState(EIC.cal,"No shifts in range","Try a wider date range, or check back once the roster is published.");
  const months={};items.forEach(d=>{const k=d.getFullYear()+"-"+d.getMonth();(months[k]=months[k]||[]).push(d);});
  return Object.values(months).map(arr=>{
    const first=arr[0],y=first.getFullYear(),m=first.getMonth();
    const total=new Date(y,m+1,0).getDate();
    const lead=(new Date(y,m,1).getDay()+6)%7;   // Monday-based offset (0=Mon … 6=Sun)
    let cells="";
    for(let i=0;i<lead;i++)cells+=`<div class="mcell out"></div>`;
    for(let day=1;day<=total;day++){
      const d=new Date(y,m,day),isoD=iso(d),inR=isoD>=from&&isoD<=to,sh=inR?getShift(sid,isoD):{kind:"off"},we=[0,6].includes(d.getDay());
      cells+=`<div class="mcell${inR?"":" out"}${we?" we":""}${isPH(isoD)?" ph":""}"><div class="mn">${day}${phBadge(isoD)}</div>${inR?cellChip(sh):""}</div>`;
    }
    const heads=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((x,i)=>`<div class="dow${i>=5?" we":""}">${x}</div>`).join("");
    return `<div class="weekhdr">${first.toLocaleDateString("en-GB",{month:"long",year:"numeric"})}</div>
      <div class="monthgrid">${heads}${cells}</div>`;
  }).join("");
}

/* ---------- modal: assign a cell ---------- */
let modal={staffId:null,isoD:null,draft:null};
function openCell(staffId,isoD){
  _ciForm=null; modal={staffId,isoD,draft:Object.assign({},getShift(staffId,isoD))};
  renderModal();
}
function renderModal(){
  const root=document.getElementById("modalRoot");
  const s=S.staff.find(x=>x.id===modal.staffId);const d=parseISO(modal.isoD);
  const draft=modal.draft;
  const kind=draft.kind||"off";
  const period=draft.period||"AM";
  const _cy=active(), _types=bookableTypes(_cy), _tid=draft.type||period;
  const _dt=typeById(_cy,_tid)||_types[0]||null, _dfills=(_dt&&_dt.fills.length)?_dt.fills:[period];
  function periodBtn(t){   // one button per shift type this cycle offers — with two types that is the AM|PM pair it has always been
    const u=periodsUnlocked(modal.isoD,t.fills,modal.staffId);
    const on=kind==="clinical"&&_tid===t.id;
    return `<button data-period="${t.id}" role="radio" aria-checked="${on?"true":"false"}" tabindex="${on?"0":"-1"}" class="${on?"on":""}" ${u.ok||on?"":"disabled"} title="${u.ok?"":escapeHTML(u.reason||"")}">${escapeHTML(t.label)} ${typeTime(t)}</button>`;
  }
  let zoneHTML="";
  if(kind==="clinical"){
    const zs=_dfills.length>1?bothZones():zonesFor(period);   // a shift that spans the day needs a zone that runs in both halves
    zoneHTML=`<div class="zonebtns" id="zoneChoices" role="radiogroup" aria-label="Zone">`+zs.map(z=>{
      let taken=null; for(let i=0;i<_dfills.length&&!taken;i++)taken=zoneTaken(modal.isoD,_dfills[i],z.id,modal.staffId);
      const on=draft.zone===z.id;
      return `<button data-zone="${z.id}" role="radio" aria-checked="${on?"true":"false"}" class="${on?"on":""}" ${taken&&!on?"disabled":""}>
        ${escapeHTML(zoneLabelFor(_cy,z,{kind:"clinical",period:period,type:draft.type}))}${taken?`<div class="taken">${escapeHTML(taken.initials)} has it</div>`:""}</button>`;
    }).join("")+`</div>`;
    const u=periodsUnlocked(modal.isoD,_dfills,modal.staffId);
    if(!u.ok&&!(getShift(modal.staffId,modal.isoD).kind==="clinical"&&getShift(modal.staffId,modal.isoD).period===period))
      zoneHTML+=`<div class="note">${ic("lock")} ${u.reason}</div>`;
  }
  let leaveHTML="";
  if(kind==="leave"){
    leaveHTML=`<label class="field" style="margin-top:8px"><span class="lbl">Leave type</span>
      <select id="leaveSel">${LEAVE_CODES.map(c=>`<option value="${c}" ${draft.code===c?"selected":""}>${c} — ${LEAVE_LABEL[c]}</option>`).join("")}</select></label>`;
  }
  openDialog(`<div class="overlay" id="ovl"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT">
    <h3 id="dlgT">${escapeHTML(s.name)}</h3>
    <div class="muted small" style="margin-bottom:6px">${d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
    ${(isAdmin()&&String(s.notes||"").trim())?`<div class="muted small" style="margin-bottom:6px" title="${escapeHTML(String(s.notes).trim())}">${ic("edit")} ${escapeHTML(String(s.notes).trim().split("\n")[0].slice(0,160))}</div>`:""}
    ${draft.note?`<div class="note">${ic("edit")} Note: ${escapeHTML(draft.note)}${draft.noteBy?" — "+escapeHTML(draft.noteBy):""}</div>`:""}
    <div class="seg" id="kindSeg" role="radiogroup" aria-label="Day type">
      <button data-kind="off" role="radio" aria-checked="${kind==="off"?"true":"false"}" tabindex="${kind==="off"?"0":"-1"}" class="${kind==="off"?"on":""}">Off</button>
      <button data-kind="clinical" role="radio" aria-checked="${kind==="clinical"?"true":"false"}" tabindex="${kind==="clinical"?"0":"-1"}" class="${kind==="clinical"?"on":""}">Shift</button>
      ${(featOn("cst")||kind==="cst")?`<button data-kind="cst" role="radio" aria-checked="${kind==="cst"?"true":"false"}" tabindex="${kind==="cst"?"0":"-1"}" class="${kind==="cst"?"on":""}">CST</button>`:""}
      <button data-kind="leave" role="radio" aria-checked="${kind==="leave"?"true":"false"}" tabindex="${kind==="leave"?"0":"-1"}" class="${kind==="leave"?"on":""}">Leave</button>
    </div>
    ${kind==="clinical"?`<div class="seg" id="periodSeg" role="radiogroup" aria-label="Shift type">${_types.map(periodBtn).join("")}</div>${_types.map(t=>{const u=periodsUnlocked(modal.isoD,t.fills,modal.staffId);return (!u.ok&&_tid!==t.id)?`<div class="note">${ic("lock")} ${escapeHTML(t.label)}: ${escapeHTML(u.reason)}</div>`:"";}).join("")}`:""}
    ${zoneHTML}
    ${kind==="clinical"?`<label style="display:flex;align-items:center;gap:7px;margin-top:10px;font-size:var(--fs-sm);color:var(--text);cursor:pointer"><input type="checkbox" id="locumChk" ${draft.locum?"checked":""}> Locum cover (covering a sickness / leave gap)</label>`:""}
    ${kind==="clinical"?(function(){ const _h=modalHours(draft,_cy); return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px"><span class="lbl">Hours</span> <input type="time" id="hrFrom" step="300" value="${escapeHTML(_h.start)}" aria-label="Start" style="width:110px"> <span class="muted small">to</span> <input type="time" id="hrTo" step="300" value="${escapeHTML(_h.end)}" aria-label="Finish" style="width:110px"> <button class="btn sm" id="hrSame" type="button">Same as the type</button></div><div class="muted small">Own hours when they differ from the type${_dt?" ("+typeTime(_dt)+")":""}: pay, the calendar, reminders and the safe-hours rules read them; cover still counts the half.</div>`; })():""}
    ${leaveHTML}
    ${ocTakenWindows(_cy).filter(w=>!ocChosen(w)).length?`<div class="sub" style="margin-top:12px"><b>On call</b> <span class="muted small">\u00b7 saved as you tap, separately from the shift above</span></div>
      <div class="zonebtns" id="ocChoices">${ocTakenWindows(_cy).filter(w=>!ocChosen(w)).map(w=>{ const holder=ocHolder(_cy,modal.isoD,w.id), mine=holder===modal.staffId;
        return `<button data-ocset="${w.id}" class="${mine?"on":""}" title="${escapeHTML(ocTime(w))}">${escapeHTML(w.label)}${holder&&!mine?`<div class="taken">${escapeHTML((S.staff.find(x=>x.id===holder)||{initials:"?"}).initials||"?")} has it</div>`:""}</button>`; }).join("")}</div>`:""}
    ${ocTakenWindows(_cy).filter(ocChosen).length?`<div class="sub" style="margin-top:12px"><b>Call-ins</b> <span class="muted small">\u00b7 saved on their own, separately from the shift above</span></div>${ocTakenWindows(_cy).filter(ocChosen).map(w=>ciModalRowHTML(_cy,modal.staffId,modal.isoD,w)).join("")}`:""}
    ${needsComment()?`<label class="field" style="margin-top:10px"><span class="lbl">Reason for change (required — published roster)</span><input id="editCmt" value="${escapeHTML(draft.note||"")}" placeholder="e.g. swap cover, sickness"></label>`:""}
    <div class="flexbtns" style="margin-top:16px">
      ${getShift(modal.staffId,modal.isoD).kind!=="off"?`<button class="btn danger" id="mRemove">Remove shift</button>`:""}
      <span class="grow"></span>
      <button class="btn" id="mCancel">Cancel</button>
      <button class="btn primary" id="mSave">Save</button>
    </div>
  </div></div>`,{focus:_refocus||"#kindSeg .on"});
  // wire modal
  root.querySelector("#ovl").onclick=e=>{if(e.target.id==="ovl")closeModal();};
  root.querySelectorAll("[data-kind]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.kind;modal.draft={kind:k}; _refocus='[data-kind="'+k+'"]';
    if(k==="clinical"){ const t0=bookableTypes(active())[0]; modal.draft.period=(t0&&t0.fills[0])||"AM"; if(t0&&!typeIsDefault(t0))modal.draft.type=t0.id; }
    if(k==="leave")modal.draft.code="AL";
    renderModal();
  });
  root.querySelectorAll("[data-period]").forEach(b=>b.onclick=()=>{ const id=b.dataset.period, t=typeById(active(),id);
    modal.draft.period=(t&&t.fills&&t.fills.length)?t.fills[0]:id;
    if(t&&!typeIsDefault(t))modal.draft.type=t.id; else delete modal.draft.type;   // the two builtin halves are stored as a bare period, exactly as before
    delete modal.draft.zone; delete modal.draft.hours;_refocus='[data-period="'+id+'"]';renderModal();});   // a new type brings its own window: the Hours row starts again from it
  root.querySelectorAll('[role="radiogroup"]').forEach(g=>g.onkeydown=e=>{   // the radiogroup contract: arrows move the choice; only the checked one sits in the Tab order
    const step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key]; if(!step)return;
    const rs=Array.from(g.querySelectorAll('[role="radio"]:not([disabled])')); const i=rs.indexOf(e.target); if(i<0)return;
    e.preventDefault(); rs[(i+step+rs.length)%rs.length].click(); });
  root.querySelectorAll("[data-zone]").forEach(b=>b.onclick=()=>{modal.draft.zone=b.dataset.zone;_refocus='[data-zone="'+b.dataset.zone+'"]';renderModal();});
  root.querySelectorAll("[data-ocset]").forEach(b=>b.onclick=()=>{ const w=b.dataset.ocset, holder=ocHolder(active(),modal.isoD,w);
    if(holder===modal.staffId)ocClear(modal.staffId,modal.isoD,w); else ocTake(modal.staffId,modal.isoD,w);
    _refocus='[data-ocset="'+w+'"]'; renderModal(); });
  root.querySelectorAll("[data-mciopen]").forEach(b=>b.onclick=()=>{ if(ciOpenForm(b.dataset.mciopen)){ _refocus=".ci-from"; renderModal(); } });
  root.querySelectorAll("[data-mcicancel]").forEach(b=>b.onclick=()=>{ _ciForm=null; renderModal(); });
  root.querySelectorAll("[data-mcisave]").forEach(b=>b.onclick=()=>{ const f=root.querySelector(".ci-from"), t=root.querySelector(".ci-to"); ciSaveForm(b.dataset.mcisave,f?f.value:"",t?t.value:""); renderModal(); });
  root.querySelectorAll("[data-mcidel]").forEach(b=>b.onclick=()=>{ const p=ciParse(b.dataset.mcidel); if(!p)return; ciRemove(p.sid,p.d,p.win); renderModal(); });
  const ls=root.querySelector("#leaveSel");if(ls)ls.onchange=e=>{modal.draft.code=e.target.value;};
  const lck=root.querySelector("#locumChk");if(lck)lck.onchange=e=>{modal.draft.locum=e.target.checked;};
  const hrF=root.querySelector("#hrFrom"), hrT=root.querySelector("#hrTo"), hrKeep=()=>{ modal.draft.hours={start:hrF.value||"",end:hrT.value||""}; };   // a new object each time: the stored booking is never edited before Save
  if(hrF&&hrT){ hrF.onchange=hrKeep; hrT.onchange=hrKeep; }
  const hrS=root.querySelector("#hrSame"); if(hrS)hrS.onclick=()=>{ delete modal.draft.hours; _refocus="#hrFrom"; renderModal(); };
  root.querySelector("#mCancel").onclick=closeModal;
  const rm=root.querySelector("#mRemove");
  if(rm)rm.onclick=()=>{
    if(needsComment()){const c=(document.getElementById("editCmt").value||"").trim();if(!c){fieldError(document.getElementById("editCmt"),"Add a reason — the roster is published.");return;}logAudit("roster.edit",s.name+" "+modal.isoD+" → cleared · "+c,"admin");}
    setShift(modal.staffId,modal.isoD,{kind:"off"});closeModal();render();};
  root.querySelector("#mSave").onclick=()=>{
    let sh=modal.draft, _ov=null, _cstOver=null;
    if(sh.kind==="clinical"&&!sh.zone){fieldError(root.querySelector("#zoneChoices"),"Choose a zone before saving.");return;}
    const _ph=(function(){ const p=getShift(modal.staffId,modal.isoD); return (p.kind==="clinical"&&p.hours)?p.hours:null; })();   // the hours the cell held before this Save, for the audit line
    if(sh.kind==="clinical"){ const _hc=modalHoursCheck(active(),sh); if(!_hc.ok){fieldError(root.querySelector("#hrFrom"),_hc.reason);return;} }
    if(sh.kind==="clinical"){
      const _mf=fillsOf(active(),sh);
      const u=periodsUnlocked(modal.isoD,_mf,modal.staffId);
      const prev=getShift(modal.staffId,modal.isoD);
      const sameSlot=prev.kind==="clinical"&&prev.period===sh.period&&(prev.type||null)===(sh.type||null);
      if(!u.ok&&!sameSlot){fieldError(root.querySelector("#periodSeg"),u.reason);return;}
      let takenBy=null,_tf=sh.period; for(let i=0;i<_mf.length&&!takenBy;i++){ takenBy=zoneTaken(modal.isoD,_mf[i],sh.zone,modal.staffId); if(takenBy)_tf=_mf[i]; }   // admins are not exempt from double-booking a zone — mirror canBook
      if(takenBy){fieldError(root.querySelector("#zoneChoices"),(zoneById(sh.zone)?zoneById(sh.zone).name:"That zone")+" is already covered by "+takenBy.name+" that "+perName(_tf)+" — pick another zone.");return;}
      const _fvm=fatigueCheck(modal.staffId,modal.isoD,sh.period,sh.zone,sh.type,sh.hours);
      if(_fvm&&effFatigue().mode!=="off")toast("Fatigue rule: "+_fvm,"warn");   // admin assign: warn, never silently block
    }
    if(sh.kind==="leave"&&!sh.code)sh.code="AL";
    if(sh.kind==="cst"&&featOn("cst")&&getShift(modal.staffId,modal.isoD).kind!=="cst"){ const _cj=cstJudge(modal.staffId,modal.isoD); if(!_cj.ok||_cj.flag){ const _w=_cj.reason||_cj.flag; if(!confirm(_w+"\n\nPlace "+nameOf(modal.staffId)+" anyway?"))return; _cstOver=_w; } }   // the CST quota is a warning for an admin, never a block
    let _cmt=null;
    if(needsComment()){
      _cmt=(document.getElementById("editCmt").value||"").trim();
      if(!_cmt){fieldError(document.getElementById("editCmt"),"Add a reason — the roster is published.");return;}   // the reason is asked for before any rule warning, so nobody confirms twice
    }
    if(sh.kind==="clinical"){ const _pv=getShift(modal.staffId,modal.isoD), _same=_pv.kind==="clinical"&&_pv.zone===sh.zone&&_pv.period===sh.period&&(_pv.type||null)===(sh.type||null);
      if(!_same){ const _pc=adminPlaceCheck(modal.staffId,modal.isoD,sh); if(!_pc.ok)return; _ov=_pc.over; } }   // a tag rule is a warning here, never a block: the judge's sentence, then Place anyway; re-saving the same cell (a note, say) is not asked again
    if(_cmt!==null){ if(sh.kind!=="off"){sh.note=_cmt;sh.noteBy="Admin";sh.noteTs=Date.now();} logAudit("roster.edit",s.name+" "+modal.isoD+" → "+shiftLabel(sh)+" · "+_cmt,"admin"); }
    if(_ov)adminOverrideAudit(modal.staffId,modal.isoD,sh,_ov);   // written down only when the placement goes through
    if(_cstOver)logAudit("cst.override",nameOf(modal.staffId)+" "+modal.isoD+" \u00b7 "+_cstOver,"admin");
    if(sh.kind==="clinical")hoursAudit(modal.staffId,modal.isoD,sh,_ph,"admin");   // hours.set or hours.clear, only when the pair changed
    setShift(modal.staffId,modal.isoD,sh);closeModal();render();
  };
}
let _dlgReturn=null, _dlgReturnSel=null, _refocus=null, _renderFocus=null;   // the element to give focus back to when a dialog closes (+ its data address, to re-find it after a render replaced it); the control to refocus after a dialog re-renders itself; the address render() refocuses after a close-then-render
function focusKey(el){ if(!el||!el.tagName||el===document.body)return null; const esc=v=>String(v).replace(/["\\]/g,"\\$&"); if(el.id)return "#"+el.id.replace(/([^\w-])/g,"\\$1"); const ks=Object.keys(el.dataset||{}); return ks.length?el.tagName.toLowerCase()+ks.map(k=>"[data-"+k.replace(/[A-Z]/g,m=>"-"+m.toLowerCase())+'="'+esc(el.dataset[k])+'"]').join(""):null; }   // an address for a control that render() will rebuild: an id, or tag + data attributes (cellbtn data-s/data-d, pmday data-pday, stoggle, tabs)
function setInert(on,nav){ const a=document.getElementById("app"); if(a)a.inert=!!on; const tb=document.querySelector(".topbar"); if(tb)tb.inert=!!on; const bn=document.getElementById("bottomnav"); if(bn)bn.inert=!!(on&&nav); }   // sheets keep the bottom bar live (its More button closes them); modals take everything
function openDialog(html,o){ o=o||{}; const root=document.getElementById("modalRoot"); if(!root.innerHTML){ _dlgReturn=(document.activeElement&&document.activeElement!==document.body)?document.activeElement:null; _dlgReturnSel=focusKey(_dlgReturn); }
  root.innerHTML=html; setInert(true,true);
  const f=(o.focus&&root.querySelector(o.focus))||root.querySelector("input:not([type=checkbox]),select,textarea,button"); if(f&&f.focus)try{f.focus();}catch(e){} return root; }
let _cfPending=null;   // the open confirm dialog's resolver — anything that closes the modal answers "no"
function openConfirm(o){   // a real dialog in place of confirm(): title, body, one named action; resolves true/false (o.onDone gets the answer synchronously too)
  o=o||{}; return new Promise(res=>{ let done=false;
    const fin=v=>{ if(done)return; done=true; _cfPending=null; closeModal(); if(o.onDone)try{o.onDone(v);}catch(e){} res(v); };
    openDialog(`<div class="overlay" id="ovlCf"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"${o.body?' aria-describedby="cfBody"':""}><h3 id="dlgT">${escapeHTML(o.title||"Are you sure?")}</h3>${o.body?`<div class="sub" id="cfBody" style="white-space:pre-line;margin-bottom:0">${escapeHTML(o.body)}</div>`:""}<div class="flexbtns" style="margin-top:16px"><span class="grow"></span><button class="btn" id="cfCancel">Cancel</button><button class="btn ${o.danger?"danger":"primary"}" id="cfOk">${escapeHTML(o.ok||"OK")}</button></div></div></div>`,{focus:"#cfOk"});
    _cfPending=fin;
    const okb=document.getElementById("cfOk"), cb=document.getElementById("cfCancel"), ov=document.getElementById("ovlCf");
    if(okb)okb.onclick=()=>fin(true); if(cb)cb.onclick=()=>fin(false);
    if(ov){ ov.onclick=e=>{ if(e&&e.target===ov)fin(false); }; ov.onkeydown=e=>{ if(e&&e.key==="Escape"){ if(e.preventDefault)e.preventDefault(); fin(false); } }; } }); }
function closeModal(){ const root=document.getElementById("modalRoot"); root.innerHTML=""; _ciForm=null; lastEmail=null; _refocus=null; if(_cfPending){ const f=_cfPending; _cfPending=null; f(false); }
  setInert(!!(_daySheet||_reqSheet||_moreOpen||_notifsOpen),false);
  let b=_dlgReturn; const sel=_dlgReturnSel; _dlgReturn=null; _dlgReturnSel=null;
  if(b&&sel&&document.contains&&!document.contains(b))b=document.querySelector(sel);   // a background render rebuilt the page while the dialog was open — re-find the opener by its address
  if(b&&b.focus&&(!document.contains||document.contains(b)))try{b.focus();}catch(e){}
  _renderFocus=sel; setTimeout(()=>{_renderFocus=null;},0); }   // Save/Remove/leave/feedback call render() in the same tick, which rebuilds #app and detaches the opener: render() re-finds the address; a close with no render drops it before it could steal focus later
function openPlannerCell(staffId,isoD){
  const root=document.getElementById("modalRoot");const cur=getShift(staffId,isoD);
  const codes=["AL","CME","LSL","Sab","PL","UA","PH","Other"];
  openDialog(`<div class="overlay" id="ovlP"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT">
    <h3 id="dlgT">${escapeHTML(nameOf(staffId))}</h3>
    <div class="muted small" style="margin-bottom:8px">${parseISO(isoD).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}${cur.kind==="clinical"?" · currently rostered "+escapeHTML(shiftLabel(cur))+" (setting leave will clear it)":(cur.kind==="leave"?" · currently "+escapeHTML(LEAVE_LABEL[cur.code]||cur.code):"")}</div>
    <div class="zonebtns">${codes.map(c=>{const l=leaveStyle(c);return `<button data-pcode="${c}" style="background:${l.bg};color:${l.t};border-color:${l.t}">${c} — ${LEAVE_LABEL[c]||c}</button>`;}).join("")}</div>
    <div class="flexbtns" style="margin-top:14px">${cur.kind==="leave"?`<button class="btn danger" id="pClear">Clear leave</button>`:""}<span class="grow"></span><button class="btn" id="pCancel">Cancel</button></div>
  </div></div>`);
  root.querySelector("#ovlP").onclick=e=>{if(e.target.id==="ovlP")closeModal();};
  root.querySelector("#pCancel").onclick=closeModal;
  const pc=root.querySelector("#pClear");if(pc)pc.onclick=()=>{plannerSetLeave(staffId,isoD,"");closeModal();render();};
  root.querySelectorAll("[data-pcode]").forEach(b=>b.onclick=()=>{plannerSetLeave(staffId,isoD,b.dataset.pcode);closeModal();render();});
}

/* ---------- live calendar feed (subscribe) ---------- */
function genIcsToken(){const a=new Uint8Array(18);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");}   // 36-hex personal secret — the URL is the credential
function icsFeedUrl(s,scheme){const h=String(CLOUD.url||"").replace(/^https?:\/\//,"").replace(/\/.*$/,"");return h?((scheme||"webcal")+"://"+h+"/functions/v1/ics?token="+(s.icsToken||"")):"";}
function subFeedHTML(s){ if(!cloudOn()||!s||!s.icsToken)return "";
  const w=icsFeedUrl(s,"webcal");
  return `<div class="note" style="margin-top:10px"><b>${ic("cal")} Live calendar — updates automatically.</b> Subscribe once and roster changes flow into your phone's calendar (Apple refreshes within hours; Google Calendar can take up to a day).
    <div class="row" style="margin-top:8px;align-items:center">
      <input id="subUrl" readonly value="${w}" style="flex:1;min-width:200px;font-size:var(--fs-xs);padding:8px 10px;border:1px solid var(--line2);border-radius:8px">
      <a class="btn sm primary" href="${w}">Open (iPhone)</a>
      <button class="btn sm" id="subCopy">Copy</button>
      <button class="btn sm danger" id="subReset">Reset link</button>
    </div>
    <span class="muted small">This is your personal link — don't share it (anyone with it can see your shifts; Reset kills a leaked link). <b>Google Calendar:</b> Settings → Add calendar → From URL, and paste the link with <b>https://</b> instead of webcal://. If it says "Not found", the one-time server setup hasn't been completed yet (admin: SUPABASE-CALENDAR.md).</span></div>`; }
/* ---------- .ics export ---------- */
function icsFold(line){ const bytes=ch=>{ try{ return unescape(encodeURIComponent(ch)).length; }catch(e){ return 1; } }; const out=[]; let cur="", n=0; for(const ch of String(line)){ const w=bytes(ch); if(n+w>74){ out.push(cur); cur=" "+ch; n=1+w; } else { cur+=ch; n+=w; } } out.push(cur); return out.join("\r\n"); }   // RFC 5545: content lines fold at 75 octets
function exportICS(sid){ const blob=new Blob([icsText(sid)],{type:"text/calendar;charset=utf-8"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="roster-"+sid+".ics";a.click();URL.revokeObjectURL(url); }
function icsText(sid){   // the one-off .ics: the person's own shifts, each saying where it came from
  const s=S.staff.find(x=>x.id===sid);const r=window._range;
  const ds=cycleDates().filter(d=>iso(d)>=r.from&&iso(d)<=r.to);
  const stamp=new Date().toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  const nextDay=dk=>{const dt=new Date(Date.UTC(+dk.slice(0,4),+dk.slice(4,6)-1,+dk.slice(6,8)+1));return ""+dt.getUTCFullYear()+String(dt.getUTCMonth()+1).padStart(2,"0")+String(dt.getUTCDate()).padStart(2,"0");};
  const esc=t=>String(t).replace(/[\\;,]/g,m=>"\\"+m).replace(/\n/g,"\\n");
  const TZ="Australia/Melbourne";
  const place=orgPlace(), desc=(detail,verb)=>rosterLabel()+" · "+detail+"\n"+verb+" in Myrosta: https://myrosta.com.au";   // every event says where it came from — the person's own shift only; the download carries no calendar name (Outlook would open a named file as a separate calendar)
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Myrosta//Roster//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
    // anchor every timed event to Melbourne (AEST/AEDT rules below) — floating times are ambiguous: Apple reads them as local but Google-family parsers read them as UTC, shifting shifts by +10/11h
    "BEGIN:VTIMEZONE","TZID:"+TZ,
    "BEGIN:STANDARD","DTSTART:19700405T030000","RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU","TZOFFSETFROM:+1100","TZOFFSETTO:+1000","TZNAME:AEST","END:STANDARD",
    "BEGIN:DAYLIGHT","DTSTART:19701004T020000","RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU","TZOFFSETFROM:+1000","TZOFFSETTO:+1100","TZNAME:AEDT","END:DAYLIGHT",
    "END:VTIMEZONE"];
  const timed=(uid,ds0,de0,summary,detail)=>{ L.push("BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+stamp,"DTSTART;TZID="+TZ+":"+ds0,"DTEND;TZID="+TZ+":"+de0,"SUMMARY:"+esc(summary)); if(place)L.push("LOCATION:"+esc(place)); L.push("DESCRIPTION:"+esc(desc(detail||summary,"Swap or offer this shift")),"URL:https://myrosta.com.au/app.html",
    "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+esc(summary),"TRIGGER:-PT1H","END:VALARM","END:VEVENT"); };
  const allday=(uid,dk,summary,detail)=>{ L.push("BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+stamp,"DTSTART;VALUE=DATE:"+dk,"DTEND;VALUE=DATE:"+nextDay(dk),"SUMMARY:"+esc(summary)); if(place)L.push("LOCATION:"+esc(place)); L.push("DESCRIPTION:"+esc(desc(detail||summary,"See your roster")),"URL:https://myrosta.com.au/app.html","END:VEVENT"); };
  const _cyI=active(), _ocW=ocWindows(_cyI);
  ds.forEach(d=>{
    const sh=getShift(sid,iso(d));const dk=iso(d).replace(/-/g,"");
    if(sh.kind==="clinical"){
      const z=zoneById(sh.zone);const lbl=z?zoneLabelFor(_cyI,z,sh):"";
      const _t=Object.assign({},typeOf(_cyI,sh),shiftWindow(_cyI,sh)), st=_t.start.replace(":","")+"00", _rollo=(_t.end<=_t.start), en=_t.end.replace(":","")+"00";
      timed(`${sid}-${dk}-${sh.type||sh.period}@myrosta.v2`,dk+"T"+st,(_rollo?nextDay(dk):dk)+"T"+en,lbl+" ("+_t.label+")"+(sh.locum?" — locum":""),lbl+" "+_t.label+" · "+_t.start+"–"+_t.end+(sh.locum?" · locum":""));
    }else if(sh.kind==="cst"){
      const _tc=typeOf(_cyI,sh); allday(`${sid}-${dk}-cst@myrosta.v2`,dk,_tc.label+" (non-clinical)",_tc.label+" (non-clinical) · "+_tc.start+"–"+_tc.end);
    }else if(sh.kind==="leave"){
      allday(`${sid}-${dk}-lv@myrosta.v2`,dk,LEAVE_LABEL[sh.code]||sh.code);
    }
    ocHeldBy(_cyI,sid,iso(d),_ocW).filter(w=>!w.ci).forEach(w=>{ const _oe=(w.end<=w.start?nextDay(dk):dk);
      timed(`${sid}-${dk}-${w.uid||("oc-"+w.id)}@myrosta.v2`,dk+"T"+w.start.replace(":","")+"00",_oe+"T"+w.end.replace(":","")+"00",w.label+" ("+w.start+"–"+w.end+")"+(w.from&&sh.locum?" — locum":""),w.label+" · "+w.start+"–"+w.end); });   // on-call is its own event after the day's own; the one that follows an evening shift keeps the id and the words it always had
  });
  L.push("END:VCALENDAR");
  return L.map(icsFold).join("\r\n");
}

