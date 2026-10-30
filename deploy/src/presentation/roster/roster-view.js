"use strict";
// moved from js/admin.js lines 517-766 (Phase 1 split, no edits)
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
