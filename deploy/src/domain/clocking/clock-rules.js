"use strict";
/* Clock in / clock out — the pure rules (C1 + walk-in). Taps live in cyc.clock (one owner: the person), decisions in cyc.clockDec
   (one owner: an admin); a record's status is computed by clockProposal, never stored. Everything here takes what it needs as
   arguments: no S, no DOM, no saving, no clock of its own (now is passed in). Spec: docs/superpowers/specs/2026-09-29-clock-in-out-design.md
   (in git history). Saving, notifying and the device live in application/clocking and infrastructure/device. */
const CLOCK_EARLY=60;   // minutes before the rostered start a person may clock in
const CLOCK_KEEP=14;    // days a closed record stays on the manager's list
function clockGraceOf(state){ const g=state.clockGrace; return (typeof g==="number"&&g>=0&&g<=60)?Math.round(g):7; }
function clockSiteOf(state){ const s=state.site; return (s&&typeof s.lat==="number"&&typeof s.lng==="number"&&isFinite(s.lat)&&isFinite(s.lng))?s:null; }
function clockRadiusOf(s){ const r=s?+s.radius:0; return (r>=20&&r<=2000)?Math.round(r):150; }
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
function clockTokenMatches(s,token){ return !!(s&&s.posterKey)&&String(token||"")===s.posterKey; }
function clockTarget(cyc,sid,kind,now){ const t=iso(now), y=iso(addDays(now,-1)); if(kind==="in")return clockMay(cyc,sid,t,now).in?t:null; return clockMay(cyc,sid,t,now).out?t:(clockMay(cyc,sid,y,now).out?y:null); }   // today's shift, or yesterday's still waiting for its clock-out
function clockTapRecord(cyc,sid,isoD,kind,now,f){ const key=sid+"|"+isoD; if(!cyc.clock)cyc.clock={}; const rec=cyc.clock[key]||{};
  if(kind==="in"&&rec.in)return {ok:false,reason:"Already clocked in at "+rec.in.t+"."}; if(kind==="out"&&!rec.in)return {ok:false,reason:"Clock in first."}; if(kind==="out"&&rec.out)return {ok:false,reason:"Already clocked out at "+rec.out.t+"."};
  const tap={t:clockRound(clockNowHHMM(now)),ts:now.getTime(),dist:(f.dist==null)?null:Math.round(f.dist),acc:(f.acc==null)?null:Math.round(f.acc),inside:(f.inside==null)?null:!!f.inside,via:f.via||"none"};
  rec[kind]=tap; cyc.clock[key]=rec; return {ok:true,tap:tap}; }   // the caller saves
function clockPlace(tap){ if(!tap)return ""; if(tap.via==="poster")return "by poster"; if(tap.inside==null)return "no location"; return tap.inside?"at the clinic":(tap.dist+" m from the clinic"); }
function clockRowsOf(cyc,g,now,name){ const keepFrom=iso(addDays(now,-CLOCK_KEEP)), open=r=>r.p.status==="proposed"&&!r.dec;   // proposals first, newest day first, then a fortnight of closed records for information
  return Object.keys(cyc.clock||{}).map(k=>{ const sid=k.split("|")[0], isoD=k.split("|")[1]; return {sid:sid,isoD:isoD,p:clockProposal(cyc,sid,isoD,g,now),rec:cyc.clock[k],dec:clockDecOf(cyc,sid,isoD)}; })
    .filter(r=>r.p.status!=="none"&&r.p.status!=="open"&&(open(r)||r.isoD>=keepFrom)).sort((a,b)=>((open(a)?0:1)-(open(b)?0:1))||(a.isoD<b.isoD?1:a.isoD>b.isoD?-1:0)||name(a.sid).localeCompare(name(b.sid))); }   // name: the caller's id-to-name reader
