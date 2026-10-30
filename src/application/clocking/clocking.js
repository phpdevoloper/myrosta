"use strict";
/* Clock in / clock out — the use cases. They read and change the group's state (S), apply the rules in domain/clocking, and reach
   the outside world only through clockingPorts: saving, redrawing, telling the person, the phone's location, a new poster key,
   the guarded commit, a file download. src/composition/clocking.js fills the ports; tests may replace any of them.
   Walk-in clocking (10 Oct 2026): someone with nothing rostered today may clock in; the tap creates a casual shift for the admin. */
const clockingPorts={ save:null, render:null, toast:null, locate:null, newKey:null, commit:null, shiftLabel:null, download:null };
let _clockNow=null, _clockBusy=false;   // device-only: a fixed "now" for tests, and the wait for a location
function clockNow(){ return _clockNow?new Date(_clockNow):new Date(); }
function clockMySid(){ const e=String(authUser||"").toLowerCase(), pk=phoneKey(authPhone||"")||null; const s=S.staff.find(x=>(e&&((x.email||"").toLowerCase()===e||(x.email2||"").toLowerCase()===e))||(pk&&phoneKey(x.mobile)===pk)); return s?s.id:null; }   // the signed-in person's own staff record, by the email or mobile they signed in with
function clockActor(){ if(_realAdmin)return clockMySid(); return S.viewAs==="admin"?null:S.viewAs; }   // whose taps a tap on this device is: a staff sign-in taps as themselves; an admin sign-in taps only as their own record, whoever they are viewing as
function clockOn(){ return S.clockOn===true; }   // the group switch: absent means off, and normalize() seeds nothing
function clockWalkinOn(){ return S.clockWalkin===true; }   // the group switch (10 Oct 2026): someone on the list with nothing rostered today may clock in; the tap creates a casual shift for the admin to approve
function clockGrace(){ return clockGraceOf(S); }
function clockSite(){ return clockSiteOf(S); }
function clockRadius(){ return clockRadiusOf(clockSite()); }
function clockTokenOK(token){ return clockTokenMatches(clockSite(),token); }
function clockPosterURL(){ const s=clockSite(); return clockPosterLink((s&&s.posterKey)||""); }
function clockWalkinSwitch(on){ if(on)S.clockWalkin=true; else delete S.clockWalkin; logAudit("settings.clockWalkin",on?"on":"off","admin"); clockingPorts.save(); }
function clockSwitch(on){ if(on&&!clockSite())return {ok:false,reason:"Save the site first \u2014 the clock needs to know where the clinic is."}; if(on)S.clockOn=true; else delete S.clockOn; logAudit("settings.clock",on?"on":"off","admin"); clockingPorts.save(); return {ok:true}; }   // written as true, deleted when off, never false
function clockSetGrace(v){ const g=Math.round(+v); if(!(g>=0&&g<=60))return {ok:false,reason:"Grace is 0 to 60 minutes."}; if(g===7)delete S.clockGrace; else S.clockGrace=g; logAudit("settings.clock","grace "+g+" min","admin"); clockingPorts.save(); return {ok:true}; }
function clockSiteSave(lat,lng,radius,acc){ if(String(lat==null?"":lat).trim()===""||String(lng==null?"":lng).trim()==="")return {ok:false,reason:"Latitude and longitude must be numbers."}; lat=+lat; lng=+lng; radius=Math.round(+radius||150);
  if(!(isFinite(lat)&&Math.abs(lat)<=90&&isFinite(lng)&&Math.abs(lng)<=180))return {ok:false,reason:"Latitude and longitude must be numbers."};
  if(!(radius>=20&&radius<=2000))return {ok:false,reason:"The radius is 20 to 2000 metres."};
  const prev=S.site||{}; S.site={lat:Math.round(lat*1e6)/1e6,lng:Math.round(lng*1e6)/1e6,acc:(acc==null)?(prev.acc==null?null:prev.acc):Math.round(acc),setAt:Date.now(),radius:radius,posterKey:prev.posterKey||clockingPorts.newKey(),posterAt:prev.posterAt||Date.now()};
  logAudit("settings.site","radius "+radius+" m"+(S.site.acc!=null?" \u00b7 \u00b1"+S.site.acc+" m":""),"admin"); clockingPorts.save(); return {ok:true}; }   // never the coordinates: the audit log says the radius and the accuracy, nothing else
function clockPosterRenew(){ if(!clockSite())return {ok:false,reason:"Save the site first."}; S.site.posterKey=clockingPorts.newKey(); S.site.posterAt=Date.now(); logAudit("clock.poster","new poster","admin"); clockingPorts.save(); return {ok:true}; }
function clockWrite(cyc,sid,isoD,kind,now,f){ const r=clockTapRecord(cyc,sid,isoD,kind,now,f); if(r.ok)clockingPorts.save(); return r; }
function clockTap(kind,fix,now){ now=now||clockNow(); if(!clockOn())return {ok:false,reason:"Clocking is off for this group."}; const sid=clockActor(); if(!sid)return {ok:false,reason:"Your sign-in isn\u2019t on this group\u2019s staff list, so there is nothing to clock \u2014 an admin sets other people\u2019s hours from the roster cell."};
  const cyc=active(), isoD=clockTarget(cyc,sid,kind,now); if(!isoD)return {ok:false,reason:kind==="in"?"Nothing to clock in to right now.":"Nothing to clock out of right now."};
  if(fix)return clockWrite(cyc,sid,isoD,kind,now,fix);
  if(_clockBusy)return {ok:false,reason:"Still finding your location\u2026"};
  _clockBusy=true; clockingPorts.render();
  clockingPorts.locate(pos=>{ _clockBusy=false; const site=clockSite(); let f={dist:null,acc:null,inside:null,via:"none"};
    if(pos&&site){ const d=clockDist(pos.lat,pos.lng,site.lat,site.lng); f={dist:d,acc:Math.round(pos.acc||0),inside:clockInside(d,pos.acc,clockRadius()),via:"gps"}; }
    const r=clockWrite(cyc,sid,isoD,kind,now,f); if(r.ok)clockingPorts.toast("Clocked "+kind+" "+r.tap.t+" \u00b7 "+clockPlace(r.tap),"ok"); else clockingPorts.toast(r.reason); clockingPorts.render(); });   // the tap's time is when they tapped, not when the phone answered
  return {ok:true,pending:true}; }
function walkinMay(cyc,sid,isoD,now){ now=now||clockNow(); if(!clockOn()||!clockWalkinOn()||!cyc||cyc.archived||cyc.status==="draft")return false; if(isoD!==iso(now))return false;
  const s=S.staff.find(x=>x.id===sid); if(!s||!inCycle(s))return false; if(getShift(sid,isoD).kind!=="off")return false; const rec=clockRec(cyc,sid,isoD); return !(rec&&rec.in); }   // on the list, nothing rostered or on leave today, not clocked yet
function walkinStart(sid,isoD,period,zoneId,fix,now){ now=now||clockNow(); const cyc=active();
  if(!walkinMay(cyc,sid,isoD,now))return {ok:false,reason:"Nothing to clock in to \u2014 you already have a shift today, or walk-in clocking is off for this group."};
  if(period!=="AM"&&period!=="PM")return {ok:false,reason:"Pick AM or PM."}; if(!zoneById(zoneId))return {ok:false,reason:"Pick the zone you are working in."};
  const key=sid+"|"+isoD; cyc.assign[key]={kind:"clinical",period:period,zone:zoneId,walkin:true};
  if(!clockMay(cyc,sid,isoD,now).in){ delete cyc.assign[key]; return {ok:false,reason:"Too early for a "+perName(period)+" shift \u2014 clock in from an hour before it starts, or pick the other half."}; }   // the shift is only kept when the tap can follow it
  logAudit("clock.walkin",nameOf(sid)+" "+isoD+" "+period+" "+zoneName(zoneId)+" \u2014 not rostered, created by the clock",sid);
  notify("admin",nameOf(sid)+" clocked in on "+fmtISO(isoD)+" without a rostered shift \u2014 approve or decline it under Hours to approve.","wk-"+sid+"-"+isoD,{tab:"requests",cycle:cyc.id}); clockingPorts.save();
  return clockTap("in",fix,now); }
function clockRows(cyc,now){ return clockRowsOf(cyc,clockGrace(),now,nameOf); }   // proposals first, newest day first, then a fortnight of closed records
function clockCount(cyc,now){ if(!clockOn())return 0; return clockRows(cyc,now).filter(r=>r.p.status==="proposed"&&!r.dec).length; }
function clockApprove(sid,isoD){ if(!isAdmin())return {ok:false,reason:"Admin only."}; const c=active(), p=clockProposal(c,sid,isoD,clockGrace(),clockNow()); if(p.status!=="proposed")return {ok:false,reason:"Nothing to approve."}; if(clockDecOf(c,sid,isoD))return {ok:false,reason:"Already decided."};
  if(!hoursSet(sid,isoD,p.start,p.end))return {ok:false};   // refused synchronously in local mode; in cloud mode the guarded commit answers later and says so itself
  if(!c.clockDec)c.clockDec={}; c.clockDec[sid+"|"+isoD]={ok:true,start:p.start,end:p.end,rostered:p.rostered,by:S.viewAs,ts:Date.now()};
  logAudit("clock.approve",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 "+p.start+"\u2013"+p.end+(p.flags.length?" \u00b7 "+p.flags.join(", "):""),"admin"); clockingPorts.save(); return {ok:true}; }
function clockDecline(sid,isoD){ if(!isAdmin())return {ok:false,reason:"Admin only."}; const c=active(), p=clockProposal(c,sid,isoD,clockGrace(),clockNow()); if(p.status!=="proposed")return {ok:false,reason:"Nothing to decline."}; if(clockDecOf(c,sid,isoD))return {ok:false,reason:"Already decided."};
  const _sh=(c.assign||{})[sid+"|"+isoD], _wk=!!(_sh&&_sh.walkin);
  if(!c.clockDec)c.clockDec={}; c.clockDec[sid+"|"+isoD]={ok:false,rostered:p.rostered,by:S.viewAs,ts:Date.now(),walkin:_wk};
  if(_wk){ delete c.assign[sid+"|"+isoD]; logAudit("clock.walkin-decline",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 walk-in shift removed","admin"); notify(sid,"Your admin declined the walk-in shift on "+fmtISO(isoD)+" \u2014 it has been removed.",null,{tab:"my",cycle:c.id}); clockingPorts.save(); return {ok:true}; }   // the clock made the shift; the decision unmakes it
  logAudit("clock.decline",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 rostered hours stand","admin");
  notify(sid,"Your admin kept the rostered hours on "+fmtISO(isoD)+".",null,{tab:"my",cycle:c.id}); clockingPorts.save(); return {ok:true}; }
function exportClockCSV(){ const c=active(), now=clockNow(), g=clockGrace(), proof=t=>t?(t.via==="poster"?"poster":(t.inside==null?"no location":(t.inside?"inside":"outside"))):"";
  const rows=[["Person","Day","Rostered start","Rostered finish","Clock in","In distance (m)","In proof","Clock out","Out distance (m)","Out proof","Proposed start","Proposed finish","Flags","Decision","Decided by","Decided at"]];
  Object.keys(c.clock||{}).sort((a,b)=>{ const da=a.split("|")[1], db=b.split("|")[1]; return da<db?-1:da>db?1:nameOf(a.split("|")[0]).localeCompare(nameOf(b.split("|")[0])); }).forEach(k=>{ const sid=k.split("|")[0], d=k.split("|")[1], r=c.clock[k], p=clockProposal(c,sid,d,g,now), dec=clockDecOf(c,sid,d), ro=(dec&&dec.rostered)||p.rostered||{};
    rows.push([nameOf(sid),d,ro.start||"",ro.end||"",r.in?r.in.t:"",(r.in&&r.in.dist!=null)?r.in.dist:"",proof(r.in),r.out?r.out.t:"",(r.out&&r.out.dist!=null)?r.out.dist:"",proof(r.out),(p.status==="proposed")?p.start:((dec&&dec.ok)?dec.start:""),(p.status==="proposed")?p.end:((dec&&dec.ok)?dec.end:""),p.flags.join("; "),dec?(dec.ok?"approved":"declined"):(p.status==="proposed"?"waiting":p.status),dec?nameOf(dec.by):"",dec?new Date(dec.ts).toISOString():""]); });
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n")+"\n"; clockingPorts.download(csv,"clock-"+c.cycle.start+".csv","text/csv"); logAudit("export.clock",cyLabel(c),"admin"); clockingPorts.save(); }
