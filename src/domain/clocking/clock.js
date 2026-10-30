"use strict";
// moved from js/admin.js lines 931-1028 (Phase 1 split, no edits)
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
