"use strict";
// moved from js/roster.js lines 49-112 (Phase 1 split, no edits)
function isAdmin(){return S.viewAs==="admin";}
function nameOf(id){if(id==="admin")return "Admin";const s=S.staff.find(x=>x.id===id);return s?s.name:id;}
function notify(to,text,id,go,not){if(id&&(S.notifications||[]).some(n=>n.id===id))return;const n={id:id||("n"+Date.now()+Math.random().toString(36).slice(2,5)),to,text,ts:Date.now(),readBy:[]}; if(not)n.not=not; if(go&&go.tab)n.go={tab:go.tab,cycle:go.cycle||null,anchor:go.anchor||null}; S.notifications.unshift(n);}   // optional deterministic id: racing clients (e.g. the 30s scheduler tick) produce ONE notification, deduped locally and by the id-merge
function notifFor(who){return (S.notifications||[]).filter(n=>(n.not!==who)&&(who==="admin"?n.to==="admin":(n.to==="all"||n.to===who)));}
let _readLocal=null;   // this device's own "seen" marks for the bell (14 Oct 2026): the bell used to save the whole roster, which under a booking crowd loses every swap and costs the phone a megabyte a try
function _readSet(who){ if(_readLocal&&_readLocal.who===who)return _readLocal.ids; let ids={}; try{ ids=JSON.parse(localStorage.getItem(orgKey("_read:"+who))||"{}")||{}; }catch(e){ ids={}; } _readLocal={who:who,ids:ids}; return ids; }
function _readSave(who){ const ids=_readSet(who), keep={}; (S.notifications||[]).forEach(n=>{ if(n&&ids[n.id])keep[n.id]=1; }); _readLocal={who:who,ids:keep}; try{ localStorage.setItem(orgKey("_read:"+who),JSON.stringify(keep)); }catch(e){} }   // only ids still in the log
function notifRead(n,who){ return (n.readBy||[]).includes(who)||!!_readSet(who)[n.id]; }   // read in the shared log, or read on this device
function unreadCount(who){return notifFor(who).filter(n=>!notifRead(n,who)).length+(whatsNewDue()?1:0);}   // the release note counts as one until it is seen
function markNotifsRead(who){ const ids=_readSet(who); notifFor(who).forEach(n=>{ n.readBy=n.readBy||[]; if(!n.readBy.includes(who))n.readBy.push(who); ids[n.id]=1; }); _readSave(who); if(whatsNewDue())devSet("seenBuild",BUILD); saveLocal(); }   // the marks ride to the cloud with the next document save, whatever that is; this device shows them read from now
function msgsFor(who){return who==="admin"?S.messages.slice():S.messages.filter(m=>m.to==="all"||m.to===who||m.from===who);}
function logAudit(action,detail,actor){S.audit.unshift({id:"a"+Date.now()+Math.random().toString(36).slice(2,5),ts:Date.now(),actor:actor||S.viewAs,action:action,detail:detail||""}); if(S.audit.length>400)S.audit.length=400;}   // the document keeps the newest 400 lines (16 Oct 2026); every booking is in the event log for good
function leaveTok(code){const c=(code||"").toUpperCase();
  if(c==="AL")return{k:"al",name:"Annual"}; if(c==="CME")return{k:"cme",name:"CME"}; if(c==="LSL"||c==="SAB")return{k:"lsl",name:"Long service / Sabbatical"};
  if(c==="PL")return{k:"pl",name:"Mat/Pat/PL/BL"}; if(c==="UA")return{k:"ua",name:"Unavailable"}; if(c==="UPL")return{k:"upl",name:"Unplanned leave"}; if(c==="PH")return{k:"ph",name:"Public holiday"};
  return{k:null,name:LEAVE_LABEL[code]||code};}
function leaveKeys(code){const t=leaveTok(code);return{bg:t.k?"--lv-"+t.k+"-bg":"--neutral-2",t:t.k?"--lv-"+t.k+"-t":"--muted",name:t.name};}
function leaveStyle(code){const k=leaveKeys(code);return{bg:"var("+k.bg+")",t:"var("+k.t+")",name:k.name};}   // DOM: token strings — same {bg,t,name} shape as before
function leaveHex(code){const k=leaveKeys(code);return{bg:PALETTE[k.bg==="--neutral-2"?"--lv-other-bg":k.bg],t:PALETTE[k.t],name:k.name};}   // unmapped codes export in the same grey they always did       // exporters: real hex
function daysInRange(from,to){const out=[];let d=parseISO(from),e=parseISO(to);while(d<=e){out.push(iso(d));d=addDays(d,1);}return out;}
function addLeave(o){o.id=o.id||("lv"+Date.now()+Math.random().toString(36).slice(2,5));S.leave.push(o);return o;}
function leaveOn(staffId,isoD){return (S.leave||[]).find(L=>L.staffId===staffId&&L.status==="approved"&&L.from<=isoD&&L.to>=isoD)||null;}
function clearLeaveDay(staffId,isoD){const out=[];(S.leave||[]).forEach(L=>{
  if(L.staffId!==staffId||isoD<L.from||isoD>L.to){out.push(L);return;}
  const prevTo=iso(addDays(parseISO(isoD),-1)),nextFrom=iso(addDays(parseISO(isoD),1));
  if(L.from<=prevTo)out.push(Object.assign({},L,{id:L.id+"a"+Math.floor(Math.random()*9999),to:prevTo}));
  if(nextFrom<=L.to)out.push(Object.assign({},L,{id:L.id+"b"+Math.floor(Math.random()*9999),from:nextFrom}));});
  S.leave=out;}
function plannerSetLeave(staffId,isoD,code){
  S.cycles.forEach(c=>{delete c.assign[staffId+"|"+isoD];
    if(code)ocTakenBy(c,staffId,isoD).filter(w=>!w.ci).forEach(w=>{ delete c.oncall[ocKey(isoD,w.id)]; });});   // only when leave is being SET — clearing a stray leave day must not drop the phone
  clearLeaveDay(staffId,isoD);
  if(code)addLeave({staffId:staffId,from:isoD,to:isoD,code:code,status:"approved",requestId:"planner"});
  swTidy();
  logAudit("planner.edit",nameOf(staffId)+" "+isoD+" → "+(code||"cleared"),"admin");save();}
function round2(n){n=+n||0;return +(Math.round(n+"e2")+"e-2");}
function hoursPerDay(s){return Math.round((s.hrsFortnight||76)/10*10)/10;}
function isPH(isoD){return (S.publicHolidays||[]).indexOf(isoD)>=0;}
function togglePH(isoD){ S.publicHolidays=S.publicHolidays||[]; const i=S.publicHolidays.indexOf(isoD);
  if(i>=0){S.publicHolidays.splice(i,1);logAudit("ph.unmark","public holiday removed "+isoD,"admin");}
  else{S.publicHolidays.push(isoD);S.publicHolidays.sort();logAudit("ph.mark","public holiday "+isoD,"admin");}
  save(); }
function phBadge(isoD){return isPH(isoD)?' <span class="tag ph mini">PH</span>':"";}
function leaveDaysInRange(staffId,from,to){let n=0;for(const d of daysInRange(from,to)){if(getShift(staffId,d).kind==="leave")n++;}return n;}
function leaveCodeDaysInRange(staffId,from,to){const t={};for(const d of daysInRange(from,to)){const sh=getShift(staffId,d);if(sh.kind==="leave")t[sh.code]=(t[sh.code]||0)+1;}return t;}   // same year-walk as leaveDaysInRange, split per leave code (annual AL/CME tracking)
function plannerYear(){const y=parseISO(active().cycle.start).getFullYear();return {from:y+"-01-01",to:y+"-12-31"};}
function eftOffOnDay(isoD){let e=0;for(const s of S.staff){if(getShift(s.id,isoD).kind==="leave")e+=(+s.eft||1);}return Math.round(e*100)/100;}
function awayOverlap(from,to,excludeId){const dates=daysInRange(from,to);const perStaff=[];const perDate={};
  for(const s of S.staff){if(s.id===excludeId)continue;let cnt=0;
    for(const d of dates){if(getShift(s.id,d).kind==="leave"){cnt++;perDate[d]=(perDate[d]||0)+1;}}
    if(cnt>0)perStaff.push({staff:s,days:cnt});}
  let peak=0;for(const d in perDate)peak=Math.max(peak,perDate[d]);
  return {perStaff:perStaff.sort((a,b)=>b.days-a.days),peak:peak};}
const STATUS={draft:{label:"Draft",cls:"muted"},open:{label:"Booking open",cls:"warn"},closed:{label:"Booking closed",cls:"muted"},published:{label:"Published (live)",cls:"ok"}};   // the pill echoes the verbs: Open booking → Booking open, Close booking → Booking closed
function active(){return S.cycles.find(c=>c.id===S.activeId)||S.cycles[0];}
const TZ_DEFAULT="Australia/Melbourne";
function groupTZ(){ return (typeof S!=="undefined"&&S&&S.timezone)||TZ_DEFAULT; }   // the group's own clock; a setting later, Melbourne for every group today
function _tzOffsetMin(ms,tz){ try{ const g={}; new Intl.DateTimeFormat("en-US",{timeZone:tz,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(ms)).forEach(x=>{ g[x.type]=x.value; });
  return Math.round((Date.UTC(+g.year,+g.month-1,+g.day,(+g.hour)%24,+g.minute,+g.second)-ms)/60000); }catch(e){ return null; } }   // minutes the zone is ahead of UTC at that instant
function _dtMs(s){ if(!s)return null; const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s).trim());
  if(!m){ const t=Date.parse(s); return isNaN(t)?null:t; }   // anything carrying its own zone is itself
  const wall=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)), tz=groupTZ(), off=_tzOffsetMin(wall,tz);   // a bare wall time ("2026-10-16T10:00") is the group's, wherever the phone is (16 Oct 2026: a phone abroad used to read it in its own zone and could open the round early)
  if(off==null){ const t=Date.parse(s); return isNaN(t)?null:t; }
  let ms=wall-off*60000; const off2=_tzOffsetMin(ms,tz); if(off2!=null&&off2!==off)ms=wall-off2*60000; return ms; }
