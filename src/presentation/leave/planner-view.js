"use strict";
// moved from js/admin.js lines 1904-1983 (Phase 1 split, no edits)
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
