"use strict";
// moved from js/admin.js lines 2730-2895 (Phase 1 split, no edits)
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

