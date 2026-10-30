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
