"use strict";
/* Clock in / clock out — what people see: the Settings card, the My shifts and day-sheet rows, the walk-in sheet, the manager's list,
   the poster, and the scanned-poster controller. Views build HTML from the use cases; they never write state themselves. */
let _siteAcc=null, _wkPer=null, _wkZone=null;   // device-only: the accuracy the Site card just heard, the walk-in sheet's picks
const CLOCK_NOTE="Myrosta keeps only the time of your tap and how far you were from the clinic.";
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
function clockStatusText(cyc,sid,isoD,now){ const rec=clockRec(cyc,sid,isoD); if(!rec||!rec.in)return ""; const p=clockProposal(cyc,sid,isoD,clockGrace(),now), dec=clockDecOf(cyc,sid,isoD);
  if(!rec.out)return (p.status==="noOut")?"Closed without a clock-out \u2014 your manager can see it.":("Clocked in "+rec.in.t+" \u00b7 "+clockPlace(rec.in));
  const span="Clocked "+rec.in.t+"\u2013"+rec.out.t; if(dec)return span+" \u00b7 "+(dec.ok?"approved "+dec.start+"\u2013"+dec.end:"as rostered");
  if(p.status==="proposed")return span+" \u00b7 waiting for your manager"; if(p.status==="rostered")return span+" \u00b7 as rostered"; return span+" \u00b7 "+(p.flags[0]||"as rostered"); }
function clockButtonsHTML(cyc,sid,isoD,now){ const may=clockMay(cyc,sid,isoD,now); if(_clockBusy)return `<button class="btn" disabled>Finding your location\u2026</button>`;
  return may.in?`<button class="btn primary" data-clockin="${isoD}">${ic("clock")} Clock in</button>`:(may.out?`<button class="btn primary" data-clockout="${isoD}">${ic("clock")} Clock out</button>`:""); }
function walkinBtnHTML(isoD){ return `<button class="btn" data-walkin="${isoD}">${ic("clock")} Clock in \u2014 not rostered</button>`; }
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
function clockMyHTML(sid,now){ if(!clockOn()||sid!==clockActor())return ""; now=now||clockNow(); const cyc=active(), t=iso(now), y=iso(addDays(now,-1));
  const rows=[t,y].map(d=>{ const w=clockWindow(cyc,sid,d), rec=clockRec(cyc,sid,d)||{}, st=clockStatusText(cyc,sid,d,now), btn=w?clockButtonsHTML(cyc,sid,d,now):(walkinMay(cyc,sid,d,now)?walkinBtnHTML(d):""); if(!btn&&!st)return "";
    const late=d===t&&!!w&&!!rec.in&&!rec.out&&clockMin(clockNowHHMM(now))>((w.end==="00:00")?1440:clockMin(w.end));   // past the rostered finish and still clocked in: the banner
    return `<div class="listrow"><span class="grow"><b>${d===t?"Today":"Yesterday"}</b>${late?` <span class="tag warn">Still clocked in from ${escapeHTML(rec.in.t)}</span>`:""}${st?`<div class="muted small">${escapeHTML(st)}</div>`:""}</span>${btn}</div>`; }).join("");
  return rows?`<div class="card" style="margin-top:8px"><b>Clock</b>${rows}<div class="muted small">${CLOCK_NOTE}</div></div>`:""; }
function clockSheetHTML(cyc,sid,isoD,now){ if(!clockOn()||sid!==clockActor())return ""; now=now||clockNow();
  if(!clockWindow(cyc,sid,isoD))return walkinMay(cyc,sid,isoD,now)?`<div class="dsact" style="align-items:center">${walkinBtnHTML(isoD)}<span class="muted small">Nothing rostered today \u2014 clocking in creates a casual shift for your admin to approve.</span></div>`:"";
  const btn=clockButtonsHTML(cyc,sid,isoD,now), st=clockStatusText(cyc,sid,isoD,now); if(!btn&&!st)return "";
  return `<div class="dsact" style="align-items:center">${btn}${st?`<span class="muted small">${escapeHTML(st)}</span>`:""}</div><div class="muted small">${CLOCK_NOTE}</div>`; }
function clockListHTML(now){ if(!isAdmin()||!clockOn())return ""; now=now||clockNow(); const cyc=active(), rows=clockRows(cyc,now); if(!rows.length)return ""; const n=clockCount(cyc,now);
  const row=r=>{ const open=r.p.status==="proposed"&&!r.dec, rec=r.rec, ro=(r.dec&&r.dec.rostered)||r.p.rostered, line=(ro?"rostered "+ro.start+"\u2013"+ro.end+" \u00b7 ":"")+"clocked "+rec.in.t+"\u2013"+(rec.out?rec.out.t:"?")+(open?" \u00b7 proposes "+r.p.start+"\u2013"+r.p.end:"");
    const chips=r.p.flags.map(f=>`<span class="tag ${/outside|no location|out of order|no clock-out|no shift/.test(f)?"warn":"muted"} mini">${escapeHTML(f)}</span>`).join(" ");
    const word=r.dec?(r.dec.ok?"approved "+r.dec.start+"\u2013"+r.dec.end:(r.dec.walkin?"declined \u00b7 shift removed":"declined \u00b7 as rostered")):(open?"":(r.p.status==="rostered"?"as rostered":r.p.status==="noOut"?"no clock-out":"no proposal"));
    return `<div class="listrow${open?"":" muted"}"><span class="grow"><b>${escapeHTML(nameOf(r.sid))}</b> \u00b7 ${escapeHTML(fmtISO(r.isoD))}<div class="muted small">${escapeHTML(line)}</div>${chips?`<div>${chips}</div>`:""}</span>${word?`<span class="tag ${r.dec&&r.dec.ok?"ok":"muted"}">${escapeHTML(word)}</span>`:""}${open?`<button class="btn sm" data-clkno="${r.sid}|${r.isoD}">Decline</button><button class="btn primary sm" data-clkok="${r.sid}|${r.isoD}">Approve</button>`:""}</div>`; };
  return `<div class="card" id="clockList"><h2>Hours to approve <span class="tag ${n?"warn":"muted"}">${n}</span></h2><div class="sub">Clocked hours outside the grace band. Approve writes them as the shift\u2019s own hours for pay; Decline keeps the rostered hours. Closed records stay a fortnight, for information.</div>${rows.map(row).join("")}</div>`; }
function clockMarkHTML(cyc,sid,isoD){ const r=clockRec(cyc,sid,isoD); if(!clockOn()||!r||!r.in)return ""; return `<span class="muted small"> \u00b7 in ${escapeHTML(r.in.t)}${r.out?" \u00b7 out "+escapeHTML(r.out.t):""}</span>`; }   // who has arrived, on the Day board and the day sheet
function clockApplyURL(now){ let p=null; try{ p=JSON.parse(sessionStorage.getItem("myrosta_clock")||"null"); sessionStorage.removeItem("myrosta_clock"); }catch(e){} if(!p)return null;
  if(p.org&&p.org!==_org){ toast("That poster belongs to another group."); return "org"; }
  if(!clockOn()){ toast("Clocking is off for this group."); return "off"; }
  if(!clockTokenOK(p.token)){ toast("This poster is out of date \u2014 ask your manager for the new one."); return "stale"; }
  now=now||clockNow(); const cyc=active(), sid=clockActor(); if(!sid){ toast("Your sign-in isn\u2019t on this group\u2019s staff list, so there is nothing to clock."); return "refused"; } const kind=clockTarget(cyc,sid,"in",now)?"in":(clockTarget(cyc,sid,"out",now)?"out":null);
  if(!kind){ toast("Nothing to clock today."); return "none"; }
  const r=clockTap(kind,{dist:null,acc:null,inside:null,via:"poster"},now); if(r.ok){ toast("Clocked "+kind+" "+r.tap.t+" \u00b7 by poster","ok"); render(); return kind; } toast(r.reason); return "refused"; }
function clockQRSVG(text){ const q=qrMatrix(text), s=q.size, quiet=4; let d=""; for(let y=0;y<s;y++)for(let x=0;x<s;x++)if(q.rows[y][x])d+="M"+(x+quiet)+" "+(y+quiet)+"h1v1h-1z";
  return `<svg viewBox="0 0 ${s+2*quiet} ${s+2*quiet}" role="img" aria-label="QR code for the clock link" shape-rendering="crispEdges"><path d="${d}" fill="currentColor"/></svg>`; }
function clockPosterHTML(){ const s=clockSite(); if(!s||!s.posterKey)return ""; const url=clockPosterURL();   // rendered with the Group half of Settings, hidden on screen; Print the clock poster prints it alone
  let qr=""; try{ qr=clockQRSVG(url); }catch(e){ qr=`<div class="note">${escapeHTML("This group\u2019s link is too long for the poster code ("+url.length+" characters). Shorten the group\u2019s name in the registry, or ask Myrosta support.")}</div>`; }
  return `<div class="card" id="posterCard"><div class="poster"><div class="pbrand">${escapeHTML(hospitalGroupLabel())}</div><h1>Scan to clock in or out</h1><div class="pqr">${qr}</div><div class="purl">${escapeHTML(url)}</div><div class="pfoot">Open the camera, point it at the code, tap the link. Sign in if asked. \u00b7 Poster made ${escapeHTML(fmt(new Date(s.posterAt||0),{day:"numeric",month:"short",year:"numeric"}))} \u00b7 Myrosta</div></div></div>`; }
