"use strict";

/* ---------- "What kind of group is this?" — six presets that SEED a fresh group's answers. A preset seeds; an admin decides: nothing here calls markAnswered, and the audit action matches no checklist trigger. ---------- */
const GROUP_KINDS=[
  {key:"consultants",label:"Consultants",noun:"consultant",zones:["Resus","Acute","Fast track","Paeds"],cover:[3,4],mode:"rounds",fairness:"snake",cst:true,rosteron:true,perFortnight:5,desc:"Resus, Acute, Fast track, Paeds · 3–4 on each shift · rounds"},
  {key:"nurses",label:"Nurses",noun:"nurse",zones:["Triage","Staff nurse 1","Staff nurse 2","Staff nurse 3"],cover:[2,4],mode:"rounds",fairness:"guarded",cst:false,rosteron:false,perFortnight:10,desc:"Triage and three staff-nurse slots · 2–4 on each shift · rounds"},
  {key:"jmo",label:"Junior doctors",noun:"junior doctor",zones:["Resus","Acute","Fast track","Paeds"],cover:[2,3],mode:"rounds",fairness:"guarded",cst:false,rosteron:false,perFortnight:10,desc:"Resus, Acute, Fast track, Paeds · 2–3 on each shift · rounds"},
  {key:"scribes",label:"Scribes",noun:"scribe",zones:["Scribe 1","Scribe 2"],cover:[1,2],mode:"rolling",fairness:"guarded",cst:false,rosteron:false,perFortnight:10,desc:"Two scribe slots · 1–2 on each shift · rolling, always live"},
  {key:"clerical",label:"Clerical/admin",noun:"clerk",zones:["Front desk","Back office"],cover:[1,2],mode:"rolling",fairness:"guarded",cst:false,rosteron:false,perFortnight:10,desc:"Front desk, Back office · 1–2 on each shift · rolling, always live"},
  {key:"other",label:"Something else",noun:"",zones:["Resus","Acute","Fast track","Paeds"],cover:[3,4],mode:"rounds",fairness:"snake",cst:true,rosteron:true,perFortnight:5,desc:"Keeps the defaults · you type what the people are called"}
];   // every max fits its zone count: the engine caps a period at its zones, so a preset never promises cover the roster cannot book
function groupKind(){ const k=cset().preset; return k?(GROUP_KINDS.find(g=>g.key===k)||null):null; }                                                   // the preset this cycle was seeded from, if any
function kindZoneNames(){ const k=groupKind(); return (k?k.zones:defaultZones().map(z=>z.name)).map(n=>n.toUpperCase()); }                              // what "zones untouched" means for the checklist
function groupIsFresh(){ return S.staff.length===0 && !(S.branding&&S.branding.name) && !Object.keys(cset().answered||{}).length; }                     // a person, a name or one answered question closes the kind card — the pilot never sees it
function staffDefaults(){ const k=groupKind(); if(!k)return {quota:20,hrsFortnight:76}; const fns=Math.max(1,Math.round((active().cycle.weeks||8)/2)); return {quota:k.perFortnight*fns,hrsFortnight:76}; }   // Add staff and the imports: shifts per fortnight × fortnights in this cycle; no preset = today's 20 / 76 exactly
function applyGroupKind(key){ const k=GROUP_KINDS.find(g=>g.key===key); if(!k||!groupIsFresh())return false;   // only while the group is empty — a re-seed with people on the roster would orphan their zones
  const c=cset(); if(!S.branding)S.branding={}; if(!S.features)S.features={};
  if(k.noun)S.branding.roleNoun=k.noun; else delete S.branding.roleNoun;                                                   // Something else hands the noun back to the admin
  const zs=k.zones.map(n=>({id:slug(n),name:n,am:true,pm:true,pmLabel:""})); c.zones=zs; S.zones=zs;                         // one shared reference, as the zone editor keeps it
  const st={amMin:k.cover[0],amMax:k.cover[1],pmMin:k.cover[0],pmMax:k.cover[1]}; c.staffing={...st}; S.staffing={...st};
  c.rosterMode=k.mode; S.rosterMode=k.mode; c.fairness=k.fairness; S.fairness=k.fairness;
  if(k.cst)delete S.features.cst; else S.features.cst=false; if(k.rosteron)delete S.features.rosteron; else S.features.rosteron=false;
  c.preset=k.key; hydrateCycleSettings();
  logAudit("settings.preset",k.label+" preset · "+cyLabel(active()),"admin"); save();
  toast(k.key==="other"?"Defaults kept — now say what the people are called.":(k.label+": "+k.zones.join(", ")+" · "+k.cover[0]+"–"+k.cover[1]+" on each shift · "+(k.mode==="rolling"?"rolling":"rounds")+". Change any of it below."),"ok");
  return true; }
function groupKindCardHTML(){ const cur=cset().preset||"";
  return `<div class="card" id="card-kind"><h2>What kind of group is this?</h2><div class="sub">One tap fills in what the people are called, the zones, the cover and how the roster runs — a starting point you can change below, or swap for another kind. The checklist ticks only what you confirm.</div>
    <div class="kindgrid" role="group" aria-label="What kind of group is this?">${GROUP_KINDS.map(k=>`<button type="button" class="kind${cur===k.key?" on":""}" data-gkind="${k.key}" aria-pressed="${cur===k.key?"true":"false"}"><b>${k.label}</b><span class="kd">${k.desc}</span></button>`).join("")}</div></div>`; }
function applyBranding(){ try{ const pre=cloudOn()&&authState!=="in", b=pre?{}:(S.branding||{});   // one Myrosta teal for every group: identity comes from the hospital and group names, never a per-group accent (a stored branding.primary is ignored)
  const hosp=b.hospital||(pre?"":_orgHospital)||"", grp=b.name||(pre?"":_orgLabel)||"";   // the masthead: the hospital as the eyebrow, the staff group as the name; the wordmark only when neither is known, and always until a sign-in has resolved its group (the door, the cold load, the picker): the copy cached on a multi-group device belongs to whichever group was last open here
  const eb=document.getElementById("brandEyebrow"), nm=document.getElementById("brandName");
  if(eb){ eb.textContent=hosp||"Myrosta"; eb.style.display=(hosp||grp)?"":"none"; }
  if(nm){ const main=grp||hosp; if(main){ nm.textContent=main; nm.classList.add("custom"); } else { nm.innerHTML='Myr<span class="accent">o</span>sta'; nm.classList.remove("custom"); } }
  const lg=document.getElementById("brandLogo"), mk=document.getElementById("brandMark");   // a group's own logo replaces the mark in the header; nowhere else (print, share and the door keep Myrosta's)
  if(lg&&mk){ if(logoOK(b.logo)){ if(lg.getAttribute("src")!==b.logo)lg.setAttribute("src",b.logo); lg.style.display=""; mk.style.display="none"; } else { lg.removeAttribute("src"); lg.style.display="none"; mk.style.display=""; } }
  document.title=(grp?grp+" · ":"")+(hosp?hosp+" · ":"")+"Myrosta"; }catch(e){} }
function logoOK(u){ return typeof u==="string" && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(u) && u.length<=LOGO_MAX; }   // the blob is shared by every device: only a small inline image, never a URL
const LOGO_MAX=60000;   // ~45 KB — the logo travels with every sync of the roster
function logoFileCheck(f){ if(!f)return "Choose an image file."; if(!/^image\//.test(f.type||""))return "Choose an image file — PNG, JPG or SVG."; if(f.size>8*1024*1024)return "That image is over 8 MB — pick a smaller one."; return ""; }
function logoDataURL(file){ return new Promise((res,rej)=>{ const bad=logoFileCheck(file); if(bad)return rej(new Error(bad));
  const url=URL.createObjectURL(file), im=new Image();
  im.onload=()=>{ try{ const H=64, W=Math.min(256,Math.max(1,Math.round(im.width*H/im.height))), h=Math.round(im.height*W/im.width);   // 64px tall (twice the header's 28–32px) and at most 256 wide
      const c=document.createElement("canvas"); c.width=W; c.height=h; c.getContext("2d").drawImage(im,0,0,W,h);
      let out=c.toDataURL("image/png");
      if(out.length>LOGO_MAX){ const g=c.getContext("2d"); g.globalCompositeOperation="destination-over"; g.fillStyle="#fff"; g.fillRect(0,0,W,h); out=c.toDataURL("image/jpeg",0.85); }   // a photo-like image: JPEG on white
      URL.revokeObjectURL(url); if(out.length>LOGO_MAX)return rej(new Error("That image is too detailed to keep small — try a simpler logo.")); res(out); }catch(e){ rej(new Error("That image couldn't be read.")); } };
  im.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error("That image couldn't be read.")); }; im.src=url; }); }
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
/* ----- Roster mode (per cycle, admin's choice) -----
   "rounds"  — the classic round: Draft → Open for self-roster (optionally on a schedule) → Closed → Published.
               Staff book only while the round is open; publishing freezes it.
   "rolling" — the roster goes live and STAYS live: Draft → Live. Staff add and drop shifts whenever they
               like, for as long as the cycle runs (or inside an optional booking window the admin sets).
   Every guard is identical in both modes — leave, double-booking, zone cover, fatigue and quota all apply. */
function rosterMode(cyc){ const c=cyc||active(); return ((c&&c.settings&&c.settings.rosterMode)||S.rosterMode||"rounds"); }
function isRolling(cyc){ return rosterMode(cyc)==="rolling"; }
function statusLabel(cyc){ const c=cyc||active(); if(!isRolling(c))return (c.status!=="open"&&roundEffOpen(c))?STATUS.open.label:(STATUS[c.status]||{label:c.status}).label;
  return c.status==="published"?"Live — staff booking open":(c.status==="open"?"Live — staff booking open":(c.status==="draft"?"Draft — not live yet":(STATUS[c.status]||{label:c.status}).label)); }
/* The single source of truth for "may a staff member book right now?" — the booking guard and the screen
   both read this, so they can never disagree (the UI used to allow/deny on its own). */
function bookingGate(cyc){ const c=cyc||active();
  if(c.archived)return {ok:false,reason:"This cycle is archived."};
  if(isRolling(c)){
    if(c.status!=="published"&&c.status!=="open")return {ok:false,reason:"The roster isn't live yet — your admin will switch it on."};
  } else if(c.status!=="open"&&!roundEffOpen(c)){
    return {ok:false,reason:c.status==="published"?"The roster is published — ask your admin, request a swap, or take an open shift.":(c.status==="closed"?"Booking has closed.":"Booking hasn't opened yet.")};
  }
  const ph=roundPhase(c);
  if(ph.gated&&ph.phase!=="open")return {ok:false,reason:ph.phase==="before"?"Booking hasn't opened yet.":"Booking has closed."};
  return {ok:true};
}
function roundEffOpen(cyc){ const c=cyc||active(); if(!c||c.archived||isRolling(c))return !!c&&!c.archived&&!isRolling(c)&&c.status==="open"; if(c.status==="open")return true; if(c.status!=="closed"&&c.status!=="draft")return false; const ph=roundPhase(c), w=c.window; return ph.gated&&ph.phase==="open"&&!(w&&w.fired==="closed"); }   // a rounds roster is open for booking when its status says so, or when its scheduled window is open and the status has simply not been written yet (16 Oct 2026: the flip is the server's and the admin's job; a staff phone never saves the roster for it)
function roundPhase(cyc){ const w=cyc&&cyc.window; if(!w||!w.enabled)return {gated:false,phase:"off"};
  const o=_dtMs(w.open),c=_dtMs(w.close),now=Date.now(); let phase="open";
  if(o&&now<o)phase="before"; else if(c&&now>c)phase="closed"; return {gated:true,phase,o,c}; }
function schFmt(s){const t=_dtMs(s);if(t==null)return"";const d=new Date(t);let here="";try{const z=Intl.DateTimeFormat().resolvedOptions().timeZone;if(z&&z!==groupTZ())here=" ("+z.replace(/_/g," ").replace(/^.*\//,"")+" time)";}catch(e){}return d.toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"})+", "+d.toLocaleTimeString("en-AU",{hour:"numeric",minute:"2-digit"})+here;}   // shown in the viewer's own clock, and says so when that is not the group's
function schUntil(t){if(t==null)return"";const ms=t-Date.now();if(ms<=0)return"now";const m=Math.round(ms/6e4);if(m<60)return"in "+m+" min";const h=Math.round(m/60);if(h<48)return"in "+h+" h";return"in "+Math.round(h/24)+" days";}
// scheduled rounds: auto-flip status open/closed at the set times + notify (client-side, fires on load/interaction)
function checkRoundSchedule(){ let changed=false; try{ (S.cycles||[]).forEach(cyc=>{ if(cyc.archived||cyc.status==="published")return; if(isRolling(cyc))return;   // rolling: the window limits when staff may book (bookingGate) — it never takes the roster offline
  const w=cyc.window; if(!w||!w.enabled)return;   // per-cycle: a published/live or archived cycle never auto-fires
  const o=_dtMs(w.open),c=_dtMs(w.close),now=Date.now();
  if(!_realAdmin&&cloudOn())return;   // 16 Oct 2026: a staff phone never writes the flip — the window itself opens booking on every phone (roundEffOpen), and the server and the admin's device record the status. On the morning of 16 Oct every open phone saved the whole roster at 10:00 and the saves fought the taps
  if(w.fired!=="open"&&w.fired!=="closed"&&o&&now>=o&&(!c||now<c)){ if(cyc.status==="draft"||cyc.status==="closed"){ cyc.status="open"; logStatus(cyc,{to:"open",ts:o,by:"schedule",notified:S.staff.length,sent:0}); notify("all","Booking is open — pick your shifts"+(c?" by "+schFmt(w.close):"")+".","n-auto-open-"+cyc.id+"-"+o,{tab:"selfroster",cycle:cyc.id}); logAudit("selfroster.autoopen","scheduled open · "+cyLabel(cyc),"admin"); changed=true; } w.fired="open"; }   // notify/save only when the status actually flips; deterministic id so racing clients dedupe
  if(w.fired!=="closed"&&c&&now>=c){ if(cyc.status==="open"){ cyc.status="closed"; logStatus(cyc,{to:"closed",ts:c,by:"schedule",notified:0,sent:0}); notify("all","Booking has closed for "+cyLabel(cyc)+".","n-auto-close-"+cyc.id+"-"+c,{tab:"my",cycle:cyc.id}); logAudit("selfroster.autoclose","scheduled close · "+cyLabel(cyc),"admin"); changed=true; w.fired="closed"; } else if(w.fired==="open"){ w.fired="closed"; } else { w.enabled=false; logAudit("selfroster.scheduleexpired","window elapsed without opening · "+cyLabel(cyc),"admin"); changed=true; } } });   // never-opened window that fully elapsed → expire it cleanly (stays draft to reschedule), don't get stuck
  if(changed)save(); }catch(e){console.error("schedule",e);} return changed; }
function CTX(){return active();}
function canEdit(){const a=active();return S.viewAs==="admin" && !a.archived;}
function needsComment(){return active().status==="published";}
function cyShort(c){const d=datesOf(c.cycle), a=d[0], z=d[d.length-1]; const y=a.getFullYear()!==z.getFullYear(); return fmt(a,y?{day:"numeric",month:"short",year:"numeric"}:{day:"numeric",month:"short"})+" – "+fmt(z,{day:"numeric",month:"short",year:"numeric"});}   // "7 Sept – 1 Nov 2026" for the header chip
function cyLabel(c){const d=datesOf(c.cycle);return fmt(d[0],{day:"numeric",month:"short",year:"numeric"})+" – "+fmt(d[d.length-1],{day:"numeric",month:"short",year:"numeric"});}
function cyEnd(c){const d=datesOf(c.cycle);return d[d.length-1];}
let gapsOn=false, fixedView=false, fixedSoft=false, dailyMode="day", dailyDate=null, dailyScope="group", _deptDate=null, myPerson=null, replyTo=null, _srSid=null, _srPick=[], _srPickSid=null, _hlStaff=null;
let _daySheet=null, _sheetPeriod="AM", _reqSheet=null;   // device-only: which booking day's sheet is open (and which shift TYPE it is showing — "AM"/"PM" are the two builtins' own ids), and which request form is open as a sheet
function pickFor(isoD){ return _srPick.find(k=>k.indexOf(isoD+"|")===0)||null; }
function pickUnits(k){ const x=String(k).split("|"); return x[3]?fillsOf(active(),{kind:"clinical",period:x[1],type:x[3]}).length:1; }   // a pick key is iso|PERIOD|zone[|type] — a full pick is worth two
function openDaySheet(isoD){ const sh=getShift(_srSid||S.viewAs,isoD), pk=pickFor(isoD); _daySheet=isoD; _ciForm=null; _hrForm=null; if(((S.board&&S.board.show)||[]).length){ groupsFetch(); boardFetch(); } _sheetPeriod=sh.kind==="clinical"?(sh.type||sh.period):(pk?(pk.split("|")[3]||pk.split("|")[1]):"AM"); render(); const f=document.querySelector("#sheetRoot .sheet button"); if(f&&f.focus)try{f.focus();}catch(e){} }
function closeDaySheet(){ const d=_daySheet; _daySheet=null; _ciForm=null; _hrForm=null; render(); const back=d&&document.querySelector('[data-bday="'+d+'"]'); if(back&&back.focus)try{back.focus();}catch(e){} }
function closeReqSheet(){ const k=_reqSheet; _reqSheet=null; render(); const back=document.getElementById(k==="swap"?"reqSwap":"reqLeave")||document.getElementById("reqLeave"); if(back&&back.focus)try{back.focus();}catch(e){} }
function pickCheck(sid,isoD,p,zoneId,typeId){   // dry-run for one chip: the cycle share first (so the chips agree with the sheet's own note), then the engine's own guard with the other picks standing in as booked shifts — so period caps, the flexible remainder, per-period overrides and the fatigue rules all see the basket
  const _cy=active(), st=S.staff.find(x=>x.id===sid), others=_srPick.filter(k=>k.indexOf(isoD+"|")!==0), q=st?(+st.quota||0):0;
  const _ow=others.reduce((a,k)=>a+pickUnits(k),0), _w=typeId?fillsOf(_cy,{kind:"clinical",period:p,type:typeId}).length:1;
  if((S.quotaCapMode||"hard")==="hard"&&q>0&&clinicalCountFor(sid)+_ow+_w>q)return {ok:false,reason:_w>1?("A whole-day shift takes two of your share, and you have "+Math.max(0,q-clinicalCountFor(sid)-_ow)+" left of "+q+"."):"That would be one more than your share this cycle ("+q+")."};
  const _fwKeep=_fatigueWarn, a=active().assign, added=[];   // a dry-run must not leave a warn-mode fatigue note behind for the next real commit to toast
  others.forEach(k=>{const x=k.split("|"), key=sid+"|"+x[0]; if(!a[key]){a[key]=x[3]?{kind:"clinical",period:x[1],zone:x[2],type:x[3]}:{kind:"clinical",period:x[1],zone:x[2]}; added.push(key);}});
  let c; try{ c=canBook(sid,isoD,p,zoneId,typeId); } finally{ added.forEach(k=>delete a[k]); _fatigueWarn=_fwKeep; }
  return c.ok?{ok:true}:{ok:false,reason:c.reason}; }
function archiveBanner(){ const a=active(); if(!a.archived)return ""; return `<div class="note" style="background:var(--accent-bg);color:var(--accent-ink);margin-bottom:10px"><b>Archived cycle — read only.</b> Switch cycle from the header selector to edit a live one.</div>`; }
function lockNote(){ const a=active(); return `<div class="note">${ic("lock")} ${a.archived?"Archived cycle — read only.":"View only — switch to Admin to edit."}</div>`; }
function prepareNext(){
  let latest=null; S.cycles.forEach(c=>{const e=cyEnd(c); if(!latest||e>latest)latest=e;});
  const weeks=active().cycle.weeks||8; const newStart=addDays(latest,1);
  if(!confirm("Prepare a new "+weeks+"-week cycle starting "+fmt(newStart,{day:"numeric",month:"short",year:"numeric"})+"?\n\nThe current cycle stays live — nothing is archived.")) return;
  const src=active(), ss=(src&&src.settings)||{};   // inherit the current cycle's full setup (cover, zones, rules) as the starting point
  const c={id:"cyc-"+Date.now(),cycle:{start:iso(newStart),weeks:weeks},assign:{},status:"draft",archived:false,
    settings:{
      staffing:ss.staffing?{amMin:ss.staffing.amMin,amMax:ss.staffing.amMax,pmMin:ss.staffing.pmMin,pmMax:ss.staffing.pmMax}:{amMin:S.staffing.amMin,amMax:S.staffing.amMax,pmMin:S.staffing.pmMin,pmMax:S.staffing.pmMax},
      unlockOrder:ss.unlockOrder||S.unlockOrder||"pmfirst", preset:ss.preset, noticeDays:ss.noticeDays,
      oncallWindows:ss.oncallWindows?JSON.parse(JSON.stringify(ss.oncallWindows)):undefined,
      rosterMode:ss.rosterMode,   // was missing: a prepared cycle used to fall back to whatever mode this device last hydrated
      zones:(ss.zones||S.zones||[]).map(z=>({...z})),
      fairness:ss.fairness||S.fairness, waveCount:ss.waveCount||S.waveCount, quotaPeriod:ss.quotaPeriod||S.quotaPeriod,
      quotaCapMode:ss.quotaCapMode||S.quotaCapMode, quotaFlex:ss.quotaFlex!=null?ss.quotaFlex:S.quotaFlex,
      leaveCapEft:ss.leaveCapEft!=null?ss.leaveCapEft:S.leaveCapEft, cstPerFortnight:ss.cstPerFortnight,
      shiftTypes:ss.shiftTypes?JSON.parse(JSON.stringify(ss.shiftTypes)):undefined,
      shiftTimes:ss.shiftTimes?JSON.parse(JSON.stringify(ss.shiftTimes)):undefined, fatigue:ss.fatigue?JSON.parse(JSON.stringify(ss.fatigue)):undefined,
      rules:rulesCarry(ss.rules,(ss.zones||S.zones||[])) }};   // a prepared cycle keeps its rules; without this it would silently lose them
  c.roles={}; const sr=(src&&src.roles)||{};   // carry forward the same roster + each person's quota/EFT as the starting point
  Object.keys(sr).forEach(id=>{ const r=sr[id]; if(r&&r.in!==false){ const nr={in:true,quota:r.quota||0,eft:(r.eft!=null?r.eft:1),hrsFortnight:(r.hrsFortnight!=null?r.hrsFortnight:76),periodTargets:{...(r.periodTargets||{})}};
    if(r.cstQuota!=null)nr.cstQuota=r.cstQuota; if(r.cstTargets&&Object.keys(r.cstTargets).length)nr.cstTargets={...r.cstTargets}; c.roles[id]=nr; } });   // the CST quota travels with the clinical one; a person without one stays without one
  S.cycles.push(c); S.activeId=c.id; dailyDate=null; logAudit("cycle.prepare",cyLabel(c)+" (full settings + roster copied from "+cyLabel(src)+")","admin"); save(); render();
}
function archiveCycle(id){ const c=S.cycles.find(x=>x.id===id); if(!c)return;
  if(S.cycles.filter(x=>!x.archived).length<=1){ toast("This is the only live cycle — prepare a next cycle before archiving this one."); return; }
  if(!confirm("Archive cycle "+cyLabel(c)+"? It moves to Previous cycles (read-only) and can be restored anytime.")) return;
  c.archived=true; logAudit("cycle.archive",cyLabel(c),"admin"); if(S.activeId===id)S.activeId=(S.cycles.find(x=>!x.archived)||S.cycles[0]).id; save(); render();
}
function deleteDraft(id){ const c=S.cycles.find(x=>x.id===id); if(!c)return;   // one-click delete for an unpublished draft (e.g. a duplicate prepared cycle)
  if(c.archived){ toast("Archived cycle — use Delete under Previous cycles."); return; }
  if(c.status!=="draft"){ toast("Only a draft can be deleted here. Archive an open/published cycle first."); return; }   // guard: never delete a live/published cycle this way
  if(S.cycles.filter(x=>!x.archived).length<=1){ toast("This is your only live cycle — can't delete it."); return; }
  if(!confirm("Delete this draft cycle permanently?\n\n"+cyLabel(c)+"\n\nThis cannot be undone. Your published/live cycle is not affected.")) return;
  S.cycles=S.cycles.filter(x=>x.id!==id);
  if(S.activeId===id)S.activeId=(S.cycles.find(x=>!x.archived)||S.cycles[0]).id;
  logAudit("cycle.deletedraft",cyLabel(c),"admin"); save(); render();
}
function staffInZone(isoD,period,zoneId){const _cy=active();for(const s of S.staff){const sh=getShift(s.id,isoD);if(sh.kind==="clinical"&&sh.zone===zoneId&&fillsOf(_cy,sh).indexOf(period)>=0)return s;}return null;}
function staffByKind(isoD,kind){return S.staff.filter(s=>getShift(s.id,isoD).kind===kind);}
function isClinical(s){return s&&s.mode!=="none";}                       // non-clinical/admin staff don't get rostered
function rosterStaff(){return S.staff.filter(s=>isClinical(s)&&inCycle(s));}   // clinical AND rostered in the active cycle
function save(){ syncRolesGuarded();   // persist the active cycle's per-staff role fields before storing
  try{ localStorage.setItem(orgKey(),JSON.stringify(S)); }catch(e){ console.warn("save failed",e); }
  if(cloudOn()&&!_applyingRemote){ _savePending=true; try{localStorage.setItem(orgKey("_dirty"),"1");}catch(e){} clearTimeout(_cloudTimer); _cloudTimer=setTimeout(cloudSave,600);
    clearTimeout(_syncT1); _syncT1=setTimeout(()=>{ if(_savePending&&cloudState!=="error")syncFlash("saving"); },400); } }   // "Saving…" only when a save takes longer than a blink
function _syncedOk(){ const was=_savePending; _savePending=false; _saveWait=4000; if(_evSeq>_evDocSeq)_evDocSeq=_evSeq; /* this device's own document just landed whole: every event it had applied is in it, and anything it removed stays removed */ try{localStorage.setItem(orgKey("_dirty"),"0"); localStorage.setItem(orgKey("_base"),_remoteBase||"");}catch(e){} clearTimeout(_syncT1); if(was||_syncFlash)syncFlash("saved",1200); digestSchedule(); }   // cloud write landed: clear the dirty flag + persist the new merge base for crash-safe boot
function saveLocal(){ try{ localStorage.setItem(orgKey(),JSON.stringify(S)); }catch(e){} }   // device-only: for navigation (tab / cycle / view-as) — never push UI state to the shared cloud
let _moreOpen=false, _notifsOpen=false;   // phone sheets — device-only UI state, never in S
function goStr(tab,cycle,anchor){ return [tab,cycle||"",anchor||""].join("|").replace(/\|+$/,""); }   // "tab|cycle|anchor" — ids never contain "|"
function parseGo(str){ const p=String(str||"").split("|"); return {tab:p[0]||"my",cycle:p[1]||null,anchor:p[2]||null}; }
function go(tab,o){ o=o||{}; _daySheet=null; _reqSheet=null; _hrForm=null;   // the one way to move around: optional cycle switch (hydrated) + tab + scroll to an anchor; closes any open sheet
  if(o.cycle&&o.cycle!==S.activeId&&S.cycles.some(c=>c.id===o.cycle)){ S.activeId=o.cycle; dailyDate=null; window._range=null; _srPick=[]; _srHours={}; _srPickSid=null; _receipt=null; hydrateCycleSettings(); hydrateCycleRoles(); }
  if(_notifsOpen)markNotifsRead(S.viewAs);
  try{ closeModal(); }catch(e){}
  if(tab==="setup"&&o.anchor)_setupTab=setupTabFor(o.anchor);
  S.tab=tab; _moreOpen=false; _notifsOpen=false; saveLocal(); render();
  if(o.anchor){ const el=document.getElementById(o.anchor); if(el&&el.scrollIntoView)try{ el.scrollIntoView({block:"start",behavior:"smooth"}); }catch(e){} } }
function draftHidden(c){ c=c||active(); return !!c&&c.status==="draft"&&!isAdmin()&&!(_realAdmin||!cloudOn()); }   // staff never see a cycle the admin is still preparing; a real admin (or local mode) previewing as someone still can
function staffLandingCycle(){ const seen=S.cycles.filter(c=>!c.archived&&c.status!=="draft"); if(!seen.length)return null; const t=iso(new Date());
  const now=seen.find(c=>{ const d=datesOf(c.cycle); return d.length&&iso(d[0])<=t&&iso(d[d.length-1])>=t; }); if(now)return now;
  return seen.slice().sort((a,b)=>a.cycle.start<b.cycle.start?1:-1)[0]; }   // the cycle staff should be looking at: the one running today, else the latest they may see
function draftHiddenHTML(){ const c=active(), other=staffLandingCycle(), title=({my:"My shifts",selfroster:"Book shifts",roster:"Roster",daily:"Day board",equity:"Fairness"})[S.tab]||"Roster", tier=["my","selfroster","roster"].includes(S.tab);
  return `${tier?pageHead(title,escapeHTML(groupName())):""}<div class="card" id="draftHidden">${tier?cardTitle(title):`<h2>${title}</h2>`}${emptyState(EIC.cal,"Still being prepared","Your admin is working on "+cyShort(c)+". You'll be told when "+(isRolling(c)?"the roster goes live.":"booking opens or the roster is published."))}${other&&other.id!==c.id?`<div class="flexbtns" style="justify-content:center"><button class="btn primary" data-go="${goStr("my",other.id,"")}">Go to ${escapeHTML(cyShort(other))}</button></div>`:""}</div>`; }
function inDemo(){ try{ return /demo\.html$/i.test(String(location.pathname||"")); }catch(e){ return false; } }
function firstRunHTML(){   // an admin whose group has no people yet: one card, three steps, the real buttons
  const g=groupName()||"your group", st=S.staffing||{};
  return `<div class="card" id="firstRun"><div class="cluster frhead">${markSVG("")}<h2>Set up ${escapeHTML(g)} in ten minutes</h2></div><div class="sub">Three steps, then run the first round. Everything else has a sensible default you can change later.</div>
    <div class="hstep"><div class="hnum">1</div><div class="grow"><b>Download the staff template</b><div class="muted small">One row per ${escapeHTML(ROLE())}: name, mobile, email, EFT.</div><div class="flexbtns"><button class="btn sm" id="frTpl">${ic("download")} Staff template</button></div></div></div>
    <div class="hstep"><div class="hnum">2</div><div class="grow"><b>Upload your staff list</b><div class="muted small">Or add people one at a time on the Staff tab.</div><div class="flexbtns"><label class="btn sm primary" style="cursor:pointer">Upload staff list<input type="file" id="frStaff" accept=".xlsx,.xls" class="vh"></label><a class="btn sm" href="#" data-go="staff">Add ${escapeHTML(ROLES())} by hand</a></div></div></div>
    <div class="hstep"><div class="hnum">3</div><div class="grow"><b>Set zones and cover</b><div class="muted small">${escapeHTML((S.zones||[]).map(z=>z.name).join(", "))} · AM ${st.amMin}–${st.amMax}, PM ${st.pmMin}–${st.pmMax} today.</div><div class="flexbtns"><a class="btn sm" href="#" data-go="setup||card-zones">Zones and cover</a></div></div></div>
    ${inDemo()?"":`<div class="muted small" style="margin-top:12px">Want to see one filled in first? <a href="demo.html" target="_blank" rel="noopener">See a filled-in roster</a> — sample people, nothing here changes.</div>`}</div>`; }
function nothingYetText(){   // the hero with nothing to show says where the round is, not just "nothing"
  const c=active(), w=c.window||{}, ph=roundPhase(c);
  if(isRolling(c))return c.status==="published"?"Nothing booked yet — add shifts any time":"Nothing yet — the roster isn't live";
  if(c.status==="published")return "No upcoming shifts this cycle";
  if(roundEffOpen(c)&&bookingGate(c).ok)return "Nothing booked yet — booking is open";
  if(roundWaiting(c))return "Nothing yet — booking opens "+schFmt(w.open);   // closed or draft with the opening scheduled ahead: say when, not "closed" (16 Oct 2026)
  if(c.status==="closed")return "Nothing booked — booking has closed";
  return (w.enabled&&w.open&&ph.phase==="before")?"Nothing yet — booking opens "+schFmt(w.open):"Nothing yet — your admin will open booking"; }
function hospitalGroupLabel(){ const h=(S.branding&&S.branding.hospital)||_orgHospital||"", g=groupName(); return [h,g].filter(Boolean).join(" · ")||"Myrosta"; }   // "Northern Hospital · Nurses", or just Myrosta
function orgPlace(){ return (S.branding&&S.branding.hospital)||_orgHospital||groupName()||""; }   // where a shift is: the hospital, else the group, else nothing
function rosterLabel(){ const l=hospitalGroupLabel(); return l==="Myrosta"?"Roster":l+" roster"; }
function contactOf(s){ return {phone:e164(s&&s.mobile)||"",email:String((s&&(s.email||s.email2))||"").trim().toLowerCase()}; }
function gsm(t){ return String(t).replace(/\s·\s/g," - ").replace(/\s—\s/g," - ").replace(/—/g,"-").replace(/–/g,"-").replace(/’/g,"'"); }   // a text stays in the GSM alphabet (two segments, not three): plain hyphens where the app writes dots and dashes
function inviteText(kind){ const e=kind==="email", t=hospitalGroupLabel()+": your roster is moving to Myrosta. Sign in at myrosta.com.au with this "+(e?"email address":"number")+" — a 6-digit code by "+(e?"email":"text")+", no password. Add it to your Home Screen to open it like an app."; return e?t:gsm(t); }
function invitedAlready(s){ return !!s.invitedTs||(S.outbox||[]).some(m=>m.kind==="invite"&&m.sid===s.id); }
function inviteTargets(){ return S.staff.filter(s=>!invitedAlready(s)&&(contactOf(s).phone||contactOf(s).email)); }   // people with a way to reach them who have not been invited
function inviteFailed(){ return (S.outbox||[]).filter(m=>m.kind==="invite"&&!m.sent&&(m.attempts||0)>=3); }   // the function gave up on these — a wrong number, usually
function queueInvites(){ const list=inviteTargets(), ts=Date.now(), lbl=hospitalGroupLabel();
  list.forEach(s=>{ const c=contactOf(s), id="inv-"+s.id; if(S.outbox.some(m=>m.id===id))return; S.outbox.push({id,kind:"invite",sid:s.id,phone:c.phone,email:c.email,subject:lbl+" — your roster is moving to Myrosta",body:inviteText(c.phone?"sms":"email"),ts,sent:null}); s.invitedTs=ts; });   // one id per person, so two admins sending at once queue one message; a text where there is a mobile, the email kept as the fallback
  if(list.length){ logAudit("invite.sent",list.length+" invited to Myrosta","admin"); save(); } return list.length; }
function openInvite(){ const tg=inviteTargets(), done=S.staff.filter(s=>s.invitedTs).length, noWay=S.staff.filter(s=>{ const c=contactOf(s); return !c.phone&&!c.email; }).length, n=tg.length, canSend=cloudOn()&&n>0;
  openDialog(`<div class="overlay" id="ovlInv"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h3 id="dlgT">Invite your ${escapeHTML(ROLES())}</h3><div class="sub">Written from this group's details. Copy it into your own text or email, or send it from here.</div>
    <label class="field"><span class="lbl">The message</span><textarea id="invText" rows="5" readonly>${escapeHTML(inviteText("sms"))}</textarea></label>
    <div class="muted small">${done?done+" already invited · ":""}${n} to invite${noWay?" · "+noWay+" with no mobile or email (add one on the Staff tab)":""}. People with only an email address get the email wording. Sending also syncs the allow-list, so everyone invited can sign in.</div>
    <div class="flexbtns" style="margin-top:12px"><button class="btn" id="invCopy">Copy message</button><span class="grow"></span><button class="btn" id="invClose">Close</button>${canSend?`<button class="btn primary" id="invSend">Send to ${n} by text or email</button>`:""}</div>
    ${canSend?`<div class="muted small" style="margin-top:8px">This texts real phones and emails real inboxes — one message each, within a few minutes. Nobody is invited twice.</div>`:""}</div></div>`,{focus:"#invCopy"});
  const cp=document.getElementById("invCopy"); if(cp)cp.onclick=()=>{ const txt=inviteText("sms"); let ok=false; try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt); ok=true; } }catch(e){} if(!ok){ const ta=document.getElementById("invText"); if(ta&&ta.select){ ta.select(); try{ ok=!!document.execCommand("copy"); }catch(e){} } } toast(ok?"Copied — paste it into a text or an email.":"Select the message and copy it."); };
  const cl=document.getElementById("invClose"); if(cl)cl.onclick=closeModal;
  const sd=document.getElementById("invSend"); if(sd)sd.onclick=()=>{ const k=queueInvites(); closeModal(); toast(k?(k+" invitation"+(k===1?"":"s")+" queued — they go out within a few minutes."):"Nobody left to invite.","ok"); render(); if(k&&cloudOn()){ try{ const p=cloudMembersSync(); if(p&&p.catch)p.catch(e=>console.error("invite sync",e)); }catch(e){ console.error("invite sync",e); } } }; }   // the allow-list is synced in the same tap, so everyone invited can sign in when the text arrives
function noOneHTML(){ return isAdmin()?emptyState(EIC.people,"No one to roster yet","Add your "+ROLES()+" first — the steps are above."):emptyState(EIC.people,"Nothing here yet","Ask your admin to publish the roster."); }   // every roster screen's empty state, in one place
function draftPreviewNote(){ const c=active(); return (c&&c.status==="draft"&&!c.archived&&!isAdmin()&&(_realAdmin||!cloudOn())&&cloudOn())?`<div class="note draftpreview">${ic("lock")} Staff can't see this cycle yet — it's still a draft. You can, because you're the admin.</div>`:""; }   // a real admin previewing as someone: say what the person would not see
function printHeadHTML(title){ return `<div class="printhead" aria-hidden="true">${markSVG("")}<div class="grow"><b>${escapeHTML(hospitalGroupLabel())}</b><div class="muted small">Printed ${fmt(new Date(),{day:"numeric",month:"short",year:"numeric"})} from Myrosta · myrosta.com.au</div></div><div class="ptitle">${escapeHTML(title)}</div></div>`; }   // paper says where it came from — print only
function printFootHTML(text){ return `<div class="printfoot" aria-hidden="true">${escapeHTML(text)}</div>`; }
function shareText(o){   // the native share sheet where there is one; the clipboard otherwise; never silent
  o=o||{}; try{ if(navigator.share){ const r=navigator.share({title:o.title||"Myrosta",text:o.text||"",url:o.url}); if(r&&r.catch)r.catch(()=>{}); return "shared"; } }catch(e){}
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ const done=()=>toast(o.copied||"Copied — paste it anywhere.","ok"), fail=()=>toast("Couldn't copy — select the text on the page instead."); const r=navigator.clipboard.writeText((o.text||"")+(o.url?"\n"+o.url:"")); if(r&&r.then)r.then(done,fail); else done(); return "copied"; } }catch(e){}
  toast("Couldn't share from here — copy the text from the page instead."); return "none"; }
function firstNameOf(name){ const n=String(name||"").trim(), hon=/^(dr|mr|mrs|ms|miss|mx|prof|a\/prof|assoc)\.?$/i; const given=n.indexOf(",")>0?n.split(",")[1]:n; const w=given.trim().split(/\s+/).filter(x=>!hon.test(x)); return w[0]||n; }   // "Lee, Jordan" and "Dr Jordan Lee" both give Jordan
function shareWeekText(sid){   // the person's own next seven days, folded like the strip, signed by the product — never anyone else's
  const ds=cycleDates(), today=iso(new Date()); if(!ds.length)return "";
  const start=today>=iso(ds[0])?today:iso(ds[0]); const days=ds.filter(d=>iso(d)>=start).slice(0,7);
  const dl=d=>DOW[d.getDay()]+" "+d.getDate()+" "+fmt(d,{month:"short"}); const lines=[]; let run=[];
  const flush=()=>{ if(!run.length)return; const a=run[0], b=run[run.length-1]; lines.push((run.length>1?dl(a)+" – "+dl(b):dl(a))+" · Off"); run=[]; };
  days.forEach(d=>{ const sh=getShift(sid,iso(d)), _c=active(), off=!sh||sh.kind==="off"||!sh.kind, oc=ocTakenBy(_c,sid,iso(d)).map(w=>w.label+" "+ocTime(w)).join(" · ");
    if(off&&!oc){ run.push(d); return; } flush();
    const when=(!off&&(sh.kind==="clinical"||sh.kind==="cst"))?shTimeStr(_c,sh):"";
    lines.push(dl(d)+" · "+(off?"On call "+oc:shiftLabel(sh)+(when?" · "+when:"")+(oc?" · on call "+oc:""))); });
  flush();
  return firstNameOf(nameOf(sid))+"'s week — "+(groupName()||"Myrosta")+"\n"+lines.join("\n")+"\n— from Myrosta, the ED roster app · myrosta.com.au"; }
const DEMO_SHARE={title:"Myrosta",text:"Myrosta — the roster app our ED uses. Try the demo (fictional staff): https://myrosta.com.au/demo.html · Book a 20-minute walkthrough: https://myrosta.com.au/#walkthrough",copied:"Links copied."};
function standaloneNow(){ try{ return window.navigator.standalone===true||!!(window.matchMedia&&matchMedia("(display-mode: standalone)").matches); }catch(e){ return false; } }
function iosNeedsInstall(){ try{ return /iPhone|iPad/.test(navigator.userAgent)&&!standaloneNow(); }catch(e){ return false; } }
function a2hsState(){ try{ return JSON.parse(devGet("a2hs")||"null")||{n:0,ts:0}; }catch(e){ return {n:0,ts:0}; } }
function a2hsCardHTML(){   // iPhone Safari, once per device: the product's most visible surface is its icon
  if(!cloudOn()||authState!=="in"||inDemo()||_sharedDevice||!iosNeedsInstall())return "";   // a ward iPad in shared mode is signed out when the tab closes — "stays signed in" would be false
  const st=a2hsState(); if(st.n>=2||(st.n===1&&Date.now()-st.ts<30*864e5))return "";   // the first Not now hides it for a month; the second hides it for good
  return `<div class="a2hs"><img src="img/icon-180.png" width="44" height="44" alt=""><div class="grow"><b>Put Myrosta on your Home Screen</b><div class="muted small">Tap Share ${ic("share")} then <b>Add to Home Screen</b>. It opens like an app and stays signed in.</div></div><button class="btn sm" id="a2hsLater">Not now</button></div>`; }
function a2hsDismiss(){ const st=a2hsState(); devSet("a2hs",JSON.stringify({n:(st.n||0)+1,ts:Date.now()})); }
function landingTab(viewAs,deviceTab){ return viewAs==="admin"?(deviceTab||S.tab):"my"; }   // staff land on My shifts; admins where THIS device left off
function reset(){ openDangerModal(); }   // every wipe goes through the typed confirmation

/* ---------- date helpers ---------- */
function pad(n){return String(n).padStart(2,"0");}
function iso(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function parseISO(s){const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c);}
function addDays(d,n){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);}
function fmt(d,o){return d.toLocaleDateString("en-GB",o||{day:"numeric",month:"short"});}
function datesOf(c){const out=[];let s=parseISO(c.start);for(let i=0;i<c.weeks*7;i++)out.push(addDays(s,i));return out;}
function cycleDates(){return datesOf(CTX().cycle);}
function dateInCycle(d){const ds=cycleDates();return d>=ds[0]&&d<=ds[ds.length-1];}   // is a DATE within the active cycle's span

/* ---------- shift model ---------- */
function zoneById(id){return S.zones.find(z=>z.id===id);}
function zonesFor(period){return S.zones.filter(z=>period==="AM"?z.am:z.pm);}
function zoneLabel(z,period){return period==="PM"&&z.pmLabel?z.pmLabel:z.name;}
function zoneShort(z){ if(!z)return "?"; const own=String(z.short||"").trim(); if(own)return own.slice(0,5);   // the admin's short name, up to five letters
  const name=String(z.name||"").trim(), words=name.split(/[\s\/+&\-]+/).filter(w=>/[A-Za-z0-9]/.test(w));
  if(words.length>=2)return words.map(w=>w[0].toUpperCase()).join("").slice(0,5);   // "Fast track" → FT, "Acute bays" → AB
  return name.slice(0,5); }   // Resus, Paeds, EPIC stay themselves; a long single word is cut, and the Zones card lets the admin choose better
function monthLabel(z,period){ const full=zoneLabel(z,period); const narrow=(typeof window!=="undefined"&&window.innerWidth<=600); return (narrow||full.length>14)?zoneShort(z):full; }   // the month grid's chip is one fixed line: a phone shows the short name, a wide screen the full one
function _tHours(st,en){const a=String(st).split(":").map(Number),b=String(en).split(":").map(Number);let m=(b[0]*60+b[1])-(a[0]*60+a[1]);if(m<=0)m+=1440;return Math.round(m/60*100)/100;}   // overnight-safe duration in hours
function shiftTimesOf(cyc){ const d={AM:{start:"08:00",end:"16:00"},PM:{start:"15:30",end:"23:30"},ONC:{start:"23:30",end:"08:00"},CST:{start:"08:00",end:"16:00"}};
  const o=(cyc&&cyc.settings&&cyc.settings.shiftTimes)||{}; const out={};
  Object.keys(d).forEach(k=>{ const st=(o[k]&&o[k].start)||d[k].start, en=(o[k]&&o[k].end)||d[k].end; out[k]={code:k,start:st,end:en,hours:_tHours(st,en)}; });
  return out; }   // per-cycle shift times (templates phase 1) — booking labels, exports, calendar + fatigue all read these
function effShiftTimes(){ return shiftTimesOf(active()); }
/* ---------- shift types (per cycle) ----------
   AM and PM stay the engine's two periods forever — cover, zones and the unlock order all rest on them, and an
   assignment's `period` is ALWAYS one of those two (for a shift that spans the day it is the half it starts in).
   A TYPE is what a person actually works: the two builtins, the non-clinical block, the on-call rider, and any
   type an admin adds — including one whose `fills` names both periods, i.e. a full shift. The list is DERIVED on
   read from the cycle's own times, so an existing cycle behaves exactly as it did and its stored JSON is never
   rewritten until an admin saves the card. `code` is what payroll matches on and never changes; `label` is what
   people read and is theirs to rename. */
const TYPE_SEED=[{id:"AM",code:"AM",label:"AM",fills:["AM"],on:true,book:true,builtin:"AM"},
  {id:"PM",code:"PM",label:"PM",fills:["PM"],on:true,book:true,builtin:"PM"},
  {id:"ONC",code:"OC",label:"On-call",fills:[],on:true,book:false,builtin:"ONC",derived:"oncall"},
  {id:"CST",code:"CST",label:"CST",long:"clinical support time",fills:[],on:true,book:true,builtin:"CST"}];   // `long` spells a default code out in prose; renaming the type drops it, because the admin's own word needs no gloss
function shiftTypesOf(cyc){ const st=(cyc&&cyc.settings&&cyc.settings.shiftTypes);
  if(st&&st.length)return st;
  const t=shiftTimesOf(cyc); return TYPE_SEED.map(x=>({...x,fills:x.fills.slice(),start:t[x.builtin].start,end:t[x.builtin].end})); }   // seeded from THIS cycle's times, never from the module defaults
function effShiftTypes(){ return shiftTypesOf(active()); }
function typeById(cyc,id){ return id?(shiftTypesOf(cyc).find(t=>t.id===id)||null):null; }
function typeOn(cyc,id){ const t=typeById(cyc,id); return !!t&&t.on!==false; }
function typeOf(cyc,sh){ if(!sh)return null;
  if(sh.kind==="cst")return typeById(cyc,"CST");
  if(sh.kind!=="clinical")return null;
  return (sh.type&&typeById(cyc,sh.type))||typeById(cyc,sh.period); }   // an id that no longer exists degrades to the plain period — never drop a shift, an event or a reminder
function fillsOf(cyc,sh){ if(!sh||sh.kind!=="clinical")return [];
  const t=sh.type&&typeById(cyc,sh.type); const f=(t&&t.fills&&t.fills.length)?t.fills:null; return f?f.slice():[sh.period]; }   // one element for every shift that carries no type: today's behaviour, by construction
function shiftUnits(cyc,sh){ return fillsOf(cyc,sh).length||1; }   // what a shift costs against a share — a full shift is two
function isFullShift(cyc,sh){ return fillsOf(cyc,sh).length>1; }
function shiftHours(cyc,sh){ const w=shiftWindow(cyc,sh); return w?_tHours(w.start,w.end):0; }   // the window: a booking's own hours are what it counts, and a finish of 00:00 reads as midnight
function typeTime(t){ return t?(t.start+"\u2013"+t.end):""; }
function shTimeStr(cyc,sh){ const w=shiftWindow(cyc,sh); return w?windowStr(w):periodTime(sh&&sh.period); }
function typeLabelOf(cyc,sh){ const t=typeOf(cyc,sh); return (t&&t.label)||(sh&&sh.period)||""; }
function perName(p){ const t=typeById(active(),p); return (t&&t.label)||p; }   // the admin's word for a period ("Morning"), falling back to AM/PM
function typeClass(cyc,sh){ const f=fillsOf(cyc,sh); return f.length>1?"full":(f[0]==="PM"?"pm":"am"); }
function bookableTypes(cyc){ return shiftTypesOf(cyc).filter(t=>t.on!==false&&t.fills&&t.fills.length); }   // the clinical types this cycle offers, in order
function ocInUse(cyc,id){ const c=cyc||active(); if(!c||!c.oncall||!id)return 0; let n=0;
  Object.keys(c.oncall).forEach(k=>{ const h=c.oncall[k], i=k.indexOf("|"); if(h&&k.slice(i+1)===id&&ocCanHold(c,h,k.slice(0,i)))n++; }); return n; }
function ocCanHold(c,sid,isoD){ if(!S.staff.some(p=>p.id===sid))return false; const r=c&&c.roles&&c.roles[sid]; if(r&&r.in===false)return false;
  const a=c&&c.assign&&c.assign[sid+"|"+isoD]; if(a&&a.kind==="leave")return false; return !leaveOn(sid,isoD); }   // someone who has left, is out of this cycle, or is on leave carries no phone, whatever a stray key from another device says
function ocClearRange(sid,from,to){ S.cycles.forEach(c=>{ if(!c.oncall)return; Object.keys(c.oncall).forEach(k=>{ const d=k.slice(0,k.indexOf("|")); if(c.oncall[k]===sid&&d>=from&&d<=to)delete c.oncall[k]; }); }); }   // leave takes the phone, on every path that sets it
function ocClash(c,sid,isoD,w){ const s=ocSpan(isoD,w), d0=parseISO(isoD);
  const near=[-1,0,1].map(n=>iso(addDays(d0,n)));
  for(const d of near){ for(const x of ocHeldBy(c,sid,d)){ if(d===isoD&&x.id===w.id)continue; const o=ocSpan(d,x); if(o.st<s.en&&s.st<o.en)return x; } }
  return null; }   // one person never carries two windows at once: pay would count the same hours twice
function ocNewWindow(list){ const base="On-call", named=l=>list.some(w=>String(w.label).toLowerCase()===l.toLowerCase()); let k=1;
  while(named(k>1?base+" "+k:base))k++;
  const label=k>1?base+" "+k:base, stem=slug(label)+"-"+Date.now().toString(36); let id=stem, n=1; while(list.some(w=>w.id===id)){ n++; id=stem+n; }
  return {id:id,code:ocCode(list,slug(label)),label:label,start:"22:00",end:"08:00",book:true,rest:true,from:null}; }   // an id no window has had before: a take that arrives late for a removed window must never attach to a new one
function ocCode(list,id){ let c=String(id).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6)||"OC";   // payroll matches on this, so two windows can never share one
  if(!list.some(w=>w.code===c))return c;
  for(let i=2;i<99;i++){ const t=c.slice(0,6-String(i).length)+i; if(!list.some(w=>w.code===t))return t; }
  return c+Date.now().toString(36).slice(-2); }
let _srHours={}, _hrForm=null;   // device-only: the hours typed beside a pick, by day, written on Confirm; the Change-hours form open on the day sheet {d,start,end}
let _ciForm=null;   // device-only: the call-in form open on the day sheet or in the cell dialog, {k:"<iso>|<windowId>|<staffId>", start, end}
let _ocCard=null;   // device-only: the list the On-call card was drawn from, so a save writes what the admin saw and can tell when the list changed underneath it
function ocCardRows(){ const c=active(), list=ocWindows(c).map(w=>JSON.parse(JSON.stringify(w)));
  _ocCard={cyc:c.id,stored:JSON.stringify(c.settings&&c.settings.oncallWindows),list:list};
  return list.map((w,i)=>ocRowHTML(w,i)).join("")||'<div class="muted small">No on-call windows yet. Nobody can be put on call until you add one.</div>'; }
function ocCardStale(){ const c=active(); return !_ocCard||!c||_ocCard.cyc!==c.id||_ocCard.stored!==JSON.stringify(c.settings&&c.settings.oncallWindows); }
function ocRowsNow(){ const c=active(), base=(_ocCard&&c&&_ocCard.cyc===c.id)?_ocCard.list:ocWindows(c), list=base.map(w=>JSON.parse(JSON.stringify(w)));
  try{ document.querySelectorAll("#ocRows [data-ocid]").forEach(rowEl=>{ const w=list.find(x=>x.id===rowEl.dataset.ocid); if(!w)return; const g=q=>rowEl.querySelector(q);   // by window, never by position: another device may have added or removed one since the card was drawn
    const lab=((g(".oc-label")||{}).value); if(lab!=null)w.label=String(lab).trim().slice(0,24);
    const a=((g(".oc-start")||{}).value), b=((g(".oc-end")||{}).value); if(a!=null)w.start=a; if(b!=null)w.end=b;   // a field left blank is blank, so the check can say so instead of quietly keeping the old value
    const bk=g(".oc-book"); if(bk)w.book=!!bk.checked; const rs=g(".oc-rest"); if(rs)w.rest=!!rs.checked;
    const hs=g(".oc-hours"); if(hs&&hs.value){ if(hs.value==="chosen"){ const ln=parseFloat((g(".oc-len")||{}).value); w.chosen=true; w.usual=isFinite(ln)?Math.round(ln*2)*30:0; } else { delete w.chosen; delete w.usual; } }   // usual is kept in minutes, in half hours
    const zt=rowEl.querySelectorAll(".oc-z"); if(zt&&zt.length){ const boxes=[].slice.call(zt), drawn=boxes.map(x=>x.value), kept=((w.from&&w.from.zones)||[]).filter(id=>drawn.indexOf(id)<0), on=kept.concat(boxes.filter(x=>x.checked).map(x=>x.value)); w.from=on.length?{zones:on,period:(w.from&&w.from.period)||"PM"}:null; } if(w.chosen)w.from=null; }); }catch(e){}   // a zone with no box drawn is kept, never silently dropped
  return list; }
function ocCheck(list,c){ let bad="";   // the one set of rules every write of the list passes: Save, Add and Remove alike
  list.forEach(w=>{ if(bad)return; if(!w.label)bad="Every on-call window needs a name."; else if(!w.start||!w.end)bad="Fill every start and end time."; else if(w.start===w.end)bad=w.label+" starts and ends at the same time."; });
  if(!bad&&list.some((w,i)=>list.findIndex(x=>x.label.toLowerCase()===w.label.toLowerCase())!==i))bad="Two windows share a name \u2014 give each one its own.";
  if(!bad&&list.some((w,i)=>list.findIndex(x=>x.code===w.code)!==i))bad="Two windows share a payroll code. Remove one and add it again.";
  if(!bad)list.forEach(w=>{ if(bad)return; const was=ocWindow(c,w.id), n=ocInUse(c,w.id); if(w.from&&!(was&&was.from)&&n)bad=n+" "+(n===1?"day is":"days are")+" on call as "+w.label+" by hand, so it cannot start following a shift. Clear those first, or add a new window."; });   // their keys would be read as nothing, silently
  if(!bad)list.forEach(w=>{ if(bad||!w.chosen)return; const mins=Math.round(_tHours(w.start,w.end)*60);
    if(!(+w.usual>0))bad=w.label+" needs a usual length."; else if(+w.usual>mins)bad="The usual length of "+w.label+" is longer than its hours."; });
  if(!bad)list.forEach(w=>{ if(bad)return; const was=ocWindow(c,w.id); if(!was||!!was.chosen===!!w.chosen)return;
    const n=was.chosen?ciInUse(c,w.id):ocInUse(c,w.id); if(!n)return;
    bad=was.chosen?(n+" call-in"+(n===1?" is":"s are")+" logged on "+w.label+", so its hours cannot switch to fixed. Remove them first, or add a new window.")
                  :(n+" "+(n===1?"day is":"days are")+" on call as "+w.label+", so its hours cannot switch to chosen when booked. Clear those first, or add a new window."); });   // either way, what is already on the roster would be read as nothing
  if(!bad)list.forEach(w=>{ if(bad||!w.chosen)return; if(ciMin(w.end)<=ciMin(w.start)&&w.end!=="00:00")bad="The hours of "+w.label+" cross midnight. A call-in\u2019s day must be clear for pay, so end it at 00:00, and add a second window from 00:00 if you need one."; });   // a call-in is dated by the day it is logged for, as payroll dates it, so a Chosen window's hours stay on one day. After the switch rule, so a window that cannot switch says so first
  return bad; }
function ocImpact(c,next){ const was=ocWindows(c).filter(w=>w.from), now=next.filter(w=>w.from), today=iso(new Date()); let n=0, past=0;
  if(!was.length&&!now.length)return {n:0,past:0};
  Object.keys(c.assign||{}).forEach(k=>{ const sh=c.assign[k]; if(!sh||sh.kind!=="clinical")return;
    const a=was.filter(w=>ocFollows(c,w,sh)).map(w=>w.id).sort().join(), b=now.filter(w=>ocFollows(c,w,sh)).map(w=>w.id).sort().join();
    if(a!==b){ n++; if(k.slice(k.indexOf("|")+1)<today)past++; } });
  return {n:n,past:past}; }   // how many shifts on this roster would gain or lose the on-call that follows them
function ocImpactText(hit){ return hit.n+" shift"+(hit.n===1?"":"s")+" on this roster "+(hit.n===1?"gains or loses":"gain or lose")+" the on-call that follows "+(hit.n===1?"it":"them")+(hit.past?" \u2014 "+hit.past+" already worked":"")+". Payroll, RosterOn, calendars and Fairness follow the change."; }
function ocPin(c){ if(!c||!c.settings||Array.isArray(c.settings.oncallWindows))return; const w=ocFromTick(c);
  c.settings.oncallWindows=JSON.parse(JSON.stringify(w));
  if(w.length)logAudit("settings.oncall","kept as it was before a zone change: "+w.map(x=>x.label+" "+ocTime(x)+" (follows "+ocFromText(x)+")").join(" \u00b7 ")+" \u00b7 "+cyLabel(c),"admin"); }   // from the first zone edit on, only the On-call card changes on-call: renaming a zone can no longer switch it on or off by its name
function typeRepointed(list,c){ const t=list.find(x=>{ const was=typeById(c,x.id); return was&&(x.fills||[]).join("+")!==(was.fills||[]).join("+")&&typeInUse(c,x.id); });
  return t?typeInUse(c,t.id)+" shifts are booked as "+t.label+", so it cannot change which half of the day it covers. Switch it off and add a new type instead.":""; }   // Add and Remove save the whole list, so they pass this too
function keepHiddenTypes(base,out){ base.forEach((b,i)=>{ if(b.derived==="oncall"&&!out.some(t=>t.id===b.id))out.splice(Math.min(i,out.length),0,{...b,fills:(b.fills||[]).slice()}); }); return out; }   // the on-call type is not on the Shift types card, but a save must not drop it: a cycle that never saved its on-call windows gets them from it
function typeInUse(cyc,id){ if(!id||!cyc||!cyc.assign)return 0; let n=0; Object.keys(cyc.assign).forEach(k=>{ const v=cyc.assign[k]; if(v&&v.kind==="clinical"&&v.type===id)n++; }); return n; }   // how many shifts would change meaning if this type went away
function typeRowsNow(){ const list=shiftTypesOf(active()).map(t=>({...t,fills:(t.fills||[]).slice()}));   // the stored list with whatever the admin has typed but not yet saved, so Add and Remove never discard an edit
  try{ document.querySelectorAll("#typeRows [data-sti]").forEach(rowEl=>{ const t=list[+rowEl.dataset.sti]; if(!t)return; const g=c=>rowEl.querySelector(c);
    const lab=((g(".st-label")||{}).value); if(lab!=null&&String(lab).trim())t.label=String(lab).trim().slice(0,24);
    const a=((g(".st-start")||{}).value), b=((g(".st-end")||{}).value); if(a)t.start=a; if(b)t.end=b;
    const fs=g(".st-fills"); if(fs&&fs.value)t.fills=String(fs.value).split("+");
    const on=g(".st-on"); if(on)t.on=!!on.checked; const bk=g(".st-book"); if(bk)t.book=!!bk.checked; }); }catch(e){}
  return list; }
function typeIsDefault(t){ return !!t&&t.builtin&&t.fills&&t.fills.length===1&&t.id===t.builtin; }   // AM and PM carry no `type` on the assignment, so old and new keys match
function bothZones(){ return S.zones.filter(z=>z.am&&z.pm); }   // a full shift needs a zone that runs in both periods
function effFatigue(){ const f=(active()&&active().settings&&active().settings.fatigue)||{}; return {mode:f.mode||"off",minRest:(f.minRest!=null?+f.minRest:10),maxConsec:(f.maxConsec!=null?+f.maxConsec:5)}; }   // safe-hours rules — per cycle, OFF by default
function _shiftSpan(sid,isoD,p,zoneId,typeId,hours){ const t=effShiftTimes(); const d0=parseISO(isoD); const _cy=active();   // hours: the booking's own {start,end}, when it has them
  const mk=(dt,hm)=>{const x=String(hm).split(":");return new Date(dt.getFullYear(),dt.getMonth(),dt.getDate(),+x[0],+x[1]);};
  const _ty=typeId?typeById(_cy,typeId):null;
  const base=(hours&&hoursOK(hours.start,hours.end))?hours:(_ty?_ty:(p==="AM"?t.AM:t.PM)); let st=mk(d0,base.start), en=mk(d0,base.end); if(en<=st)en=mk(addDays(d0,1),base.end);   // the next calendar day, not 24 hours on: across a daylight-saving change those differ by an hour
  if(zoneId){ const _as={kind:"clinical",period:p,zone:zoneId}; if(typeId)_as.type=typeId;
    ocWindows(_cy).forEach(w=>{ if(w.rest===false||!ocFollows(_cy,w,_as))return; const o=ocSpan(isoD,w); if(o.en>en)en=o.en; }); }   // a window that follows this shift is worked straight through to its end, as ROC+OC always was
  return {st,en}; }
/* Everything one person is committed to on one day, as absolute spans, earliest first, with touching or
   overlapping stretches merged. A shift and the on-call window that starts the moment it ends are ONE
   run of duty, not a rest breach between two. `skip` leaves out the thing being judged. */
function _coalesceSpans(l){ l=l.slice().sort((a,b)=>a.st-b.st); const out=[];
  l.forEach(s=>{ const p=out[out.length-1]; if(p&&s.st<=p.en){ if(s.en>p.en)p.en=s.en; } else out.push({st:s.st,en:s.en}); });
  return out; }
function _spansOn(cyc,sid,isoD,skip){ const c=cyc||active(), out=[];
  const sh=(c.assign||{})[sid+"|"+isoD];
  if(sh&&sh.kind==="clinical"&&!(skip&&skip.shift))out.push(_shiftSpan(sid,isoD,sh.period,sh.zone,sh.type,sh.hours));
  ocTakenBy(c,sid,isoD).forEach(w=>{ if(w.rest===false)return; if(skip&&skip.win===w.id)return; out.push(ocSpan(isoD,w)); });   // a window that follows the shift is already inside its span
  return _coalesceSpans(out); }
function _onDutyDay(sid,isoD){ const sh=getShift(sid,isoD); if(sh.kind==="clinical")return 1;
  return ocTakenBy(active(),sid,isoD).some(w=>w.rest!==false)?2:0; }   // 1 a clinical day, 2 a day on call and nothing else, 0 neither
function _restCheck(f,sid,isoD,cand,skip){
  const d0=parseISO(isoD), c=active();
  const day=_coalesceSpans(_spansOn(c,sid,isoD,skip).concat([cand]));
  if(f.minRest>0){
    const prev=_spansOn(c,sid,iso(addDays(d0,-1)),null);
    if(prev.length){ const rest=(day[0].st-prev[prev.length-1].en)/36e5; if(rest<f.minRest)return "Only "+Math.max(0,Math.round(rest*10)/10)+"h rest after the previous shift (rule: "+f.minRest+"h)."; }
    for(let i=1;i<day.length;i++){ const gap=(day[i].st-day[i-1].en)/36e5; if(gap<f.minRest)return "Only "+Math.max(0,Math.round(gap*10)/10)+"h rest between two stretches of duty that day (rule: "+f.minRest+"h)."; }   // a morning shift and a night on call the same day are two stretches, with a rest between them like any other
    const next=_spansOn(c,sid,iso(addDays(d0,1)),null);
    if(next.length){ const rest2=(next[0].st-day[day.length-1].en)/36e5; if(rest2<f.minRest)return "Only "+Math.max(0,Math.round(rest2*10)/10)+"h rest before the next day's shift (rule: "+f.minRest+"h)."; }
  }
  if(f.maxConsec>0){ let run=1, oc=!!(skip&&skip.win)&&getShift(sid,isoD).kind!=="clinical";
    for(let i=1;i<=14;i++){ const k=_onDutyDay(sid,iso(addDays(d0,-i))); if(!k)break; run++; if(k===2)oc=true; }
    for(let i=1;i<=14;i++){ const k=_onDutyDay(sid,iso(addDays(d0,i))); if(!k)break; run++; if(k===2)oc=true; }
    if(run>f.maxConsec)return "This makes "+run+(oc?" days on duty":" clinical days")+" in a row (rule: max "+f.maxConsec+")."; }   // a run that includes days only on call is not a run of clinical days
  return null; }
function fatigueCheck(sid,isoD,p,zoneId,typeId,hours){ const f=effFatigue(); if(f.mode==="off")return null;
  return _restCheck(f,sid,isoD,_shiftSpan(sid,isoD,p,zoneId,typeId,hours),{shift:true}); }
function ocFatigueCheck(sid,isoD,winId,times){ const f=effFatigue(); if(f.mode==="off")return null;   // times: a call-in's own hours
  const w=ocWindow(active(),winId); if(!w||w.rest===false||w.from)return null;   // a window that is not counted toward rest cannot breach it
  return _restCheck(f,sid,isoD,ocSpan(isoD,times?ciAt(w,times):w),{win:winId}); }
let _fatigueWarn=null, _ocLost=[];
function ocLostToast(){ if(!_ocLost.length)return; const x=_ocLost[0], more=_ocLost.length-1; _ocLost=[];
  try{ const c=(S.cycles||[]).find(cc=>cc.id===x.cyc), i=x.k.indexOf("|"), w=c?ocWindow(c,x.k.slice(i+1)):null, p=S.staff.find(s=>s.id===x.now);
    toast((w?w.label:"On-call")+" on "+fmtISO(x.k.slice(0,i))+" stays with "+(p?shortNm(p):"someone else")+", who had it first."+(more?" "+more+" more on-call change"+(more>1?"s":"")+" didn\u2019t go through.":""),"warn"); }catch(e){} }
function periodTime(p){const t=effShiftTimes();const x=p==="AM"?t.AM:t.PM;return x.start+"–"+x.end;}
function getShift(staffId,isoD){const a=CTX().assign[staffId+"|"+isoD];if(a)return a;const lv=leaveOn(staffId,isoD);if(lv)return {kind:"leave",code:lv.code};return {kind:"off"};}
function setShift(staffId,isoD,sh){const a=CTX().assign;const k=staffId+"|"+isoD; if(!sh||sh.kind==="off")delete a[k]; else a[k]=sh; if(sh&&sh.kind==="leave")ocClearRange(staffId,isoD,isoD); swTidy(); save();}   // leave set from a roster cell or the day sheet takes the phone too
function markDay(sid,isoD,sh){   // the day sheet's own marks — clinical support time, off, unavailable — through the booking call where the database has it (16 Oct 2026: each used to save the whole roster from the phone); the admin's roster cell keeps setShift
  const _cyc=S.activeId, c=active(), cur=(c.assign||{})[sid+"|"+isoD], off=!sh||sh.kind==="off";
  const _audit=()=>{ if(off)logAudit("selfroster.off",nameOf(sid)+" "+isoD,sid); else if(sh.kind==="cst")logAudit("selfroster.cst",nameOf(sid)+" "+isoD,sid); else logAudit("selfroster.ua",nameOf(sid)+" "+isoD,sid); };
  if(!(cloudOn()&&_evOk===true)){ setShift(sid,isoD,off?{kind:"off"}:sh); _audit(); return true; }
  if(cur&&cur.fixed&&!isAdmin()){ toast("Fixed shift \u2014 ask your admin to change it.","danger"); return false; }
  if(off&&!cur)return true;
  if(_inflight.has("mark")){ toast("Still saving your last tap \u2014 one moment."); return false; }
  const a=c.assign; if(off)delete a[sid+"|"+isoD]; else a[sid+"|"+isoD]=sh; if(sh&&sh.kind==="leave")ocClearRange(sid,isoD,isoD);   // on the screen now; the database confirms it
  _inflight.add("mark"); _selfChange=true; render();
  const op=off?{op:"unbook",sid:sid,day:isoD}:{op:"mark",sid:sid,day:isoD,kind:sh.kind,code:sh.code||null};
  cloudBook(_cyc,sid,[op]).then(res=>{ _inflight.delete("mark"); const r=res&&res.ok===true&&Array.isArray(res.results)?res.results[0]:null;
    if(r&&r.ok){ _evApplyLive([{seq:r.seq,cycle:_cyc,key:r.key||(sid+"|"+isoD),val:(r.val==null?null:r.val),audit:r.audit}]); const before=_snap([S.openSwaps,S.swapOffers,S.openShifts,S.notifications]); swTidy(); if(_snap([S.openSwaps,S.swapOffers,S.openShifts,S.notifications])!==before)save(); }
    else { const cc=S.cycles.find(x=>x.id===_cyc); if(cc&&cc.assign){ if(cur)cc.assign[sid+"|"+isoD]=cur; else delete cc.assign[sid+"|"+isoD]; } toast((r&&r.reason)||(res&&res.reason)||BOOK_OFFLINE,"danger"); if(r)_evCatchUp().then(n=>{ if(!n)_docRefetch(); }); }
    _selfChange=true; render(); });
  return true; }
function clinicalCounts(isoD,excludeId){
  let am=0,pm=0;
  const _cy=active();
  for(const s of S.staff){ if(s.id===excludeId)continue; const sh=getShift(s.id,isoD);
    if(sh.kind==="clinical"){ const f=fillsOf(_cy,sh); for(let i=0;i<f.length;i++)f[i]==="AM"?am++:pm++; } }   // a full shift is cover in BOTH periods
  return {am,pm};
}
function zoneTaken(isoD,period,zoneId,excludeId){
  const _cy=active();
  for(const s of S.staff){ if(s.id===excludeId)continue; const sh=getShift(s.id,isoD);
    if(sh.kind==="clinical"&&sh.zone===zoneId&&fillsOf(_cy,sh).indexOf(period)>=0)return s; }   // a full shift holds its zone in both halves
  return null;
}
// progressive unlock, parameterised by configurable staffing
/* ---------- notice period: how close to a shift a person may still walk away from it ----------
   One number on the cycle. 0 = off, which is what every existing cycle computes, so nothing changes
   until an admin sets it. Read ONLY through effNotice(cyc) — deliberately NOT hydrated onto S, because
   a mirrored global is what lets a settings card render one cycle's value and save it onto another. */
function effNotice(cyc){ const c=cyc||active(); const v=c&&c.settings&&c.settings.noticeDays; const nDays=parseInt(v,10); return (nDays>0&&nDays<=365)?nDays:0; }
function noticeBinds(cyc){ const c=cyc||active(); return !!c && !c.archived && c.status!=="draft" && effNotice(c)>0; }   // a draft is not a promise to anyone; an archived cycle is history
function daysUntil(isoD){ return Math.round((parseISO(isoD)-parseISO(iso(new Date())))/864e5); }
function inNotice(isoD,cyc){ const c=cyc||active(); if(!noticeBinds(c))return false; return daysUntil(isoD)<=effNotice(c); }   // a past day is inside it too — you cannot walk away from yesterday
/* ---------- on-call: a roster of its own ----------
   Not a shift. A shift lives in cycle.assign, which holds exactly one record per person per day, and a
   shift fills a half of the day, which is what "counts as cover" means and what takes a zone. On-call is
   neither: the same person may work the floor and carry a window later, and carrying it must never make
   a day look covered. So it lives in its own flat map, keyed the same way assign is so it merges the same
   way, and one person per window per day falls out of one key holding one value. */
/* Which windows a cycle has. A saved list is the truth, and an empty one means the group runs no on-call. A cycle
   that has never saved one still has the on-call it always had — the per-zone tick — read as ONE window that follows
   the evening shift in every zone carrying it. Nothing is written: it is worked out from the cycle's own zones and
   On-call type each time, so a live roster computes exactly what it did, and saving the On-call card is what turns it
   into an ordinary list. `pay` and `uid` are what the tick has always been exported and calendared under. */
function ocWindows(cyc){ const c=cyc||active(); if(!c)return []; const w=c.settings&&c.settings.oncallWindows; return Array.isArray(w)?w:ocFromTick(c); }
function ocFromTick(c){ const t=typeById(c,"ONC"); if(!t||t.on===false)return [];
  const all=(c.settings&&c.settings.zones)||S.zones||[], zs=all.filter((z,i)=>all.findIndex(x=>x.id===z.id)===i&&isOnCallZone(z,c,true)).map(z=>z.id); if(!zs.length)return [];   // the first zone with an id decides, as zoneById always has, even if a copy with the same id says otherwise
  const tm=shiftTimesOf(c).ONC;   // payroll, the calendar download, Clinical hours and safe hours always read the tick's hours from here; the type's own copy could differ in stored data, and pay must not move
  return [{id:"ONC",code:t.code||"OC",pay:"ONC",uid:"oc",label:t.label||"On-call",start:tm.start,end:tm.end,book:false,rest:true,from:{zones:zs,period:"PM"}}]; }
function ocTakenWindows(cyc){ const c=cyc||active(); const w=c&&c.settings&&c.settings.oncallWindows; return Array.isArray(w)?w.filter(x=>!x.from):[]; }   // the windows a person takes. One that follows a shift travels with that shift and is never drawn on its own — which is also why a never-saved cycle has none
function ocWindow(cyc,id){ return id?(ocWindows(cyc).find(w=>w.id===id)||null):null; }
function ocKey(isoD,winId){ return isoD+"|"+winId; }
function ocFollows(c,w,sh){ return !!(w&&w.from&&sh&&sh.kind==="clinical"&&(w.from.zones||[]).indexOf(sh.zone)>=0&&fillsOf(c,sh).indexOf(w.from.period||"PM")>=0); }   // a whole-day shift includes its evening
function ocHolder(cyc,isoD,winId){ const c=cyc||active(); if(!c)return null; const w=ocWindow(c,winId);
  if(ocChosen(w))return null;   // a call-in window has no one holder: each call-in belongs to whoever logged it, and a stray on-call key on it is ignored
  if(w&&w.from){ const a=c.assign||{}, p=S.staff.find(x=>ocFollows(c,w,a[x.id+"|"+isoD])); return p?p.id:null; }
  const h=c.oncall&&c.oncall[ocKey(isoD,winId)]; return (h&&ocCanHold(c,h,isoD))?h:null; }
function ocHeldBy(cyc,sid,isoD,wins){ const c=cyc||active(); if(!c||!sid)return []; const sh=(c.assign||{})[sid+"|"+isoD]; let can=null;
  const out=[]; (wins||ocWindows(c)).forEach(w=>{ if(ocChosen(w)){ const ci=ciGet(c,isoD,w.id,sid); if(ci)out.push(ciAt(w,ci)); return; }
    if(w.from){ if(ocFollows(c,w,sh))out.push(w); return; }
    if(!(c.oncall&&c.oncall[ocKey(isoD,w.id)]===sid))return; if(can===null)can=ocCanHold(c,sid,isoD); if(can)out.push(w); });
  return out; }   // every window a person carries that day, taken, following their shift, or logged as a call-in with its real hours: what pay, the calendar and the counts read
function ocTakenBy(cyc,sid,isoD){ const c=cyc||active(); if(!c||!sid)return []; const all=ocTakenWindows(c);
  let ws=c.oncall?all.filter(w=>!ocChosen(w)&&c.oncall[ocKey(isoD,w.id)]===sid):[]; if(ws.length&&!ocCanHold(c,sid,isoD))ws=[];
  all.forEach(w=>{ if(!ocChosen(w))return; const ci=ciGet(c,isoD,w.id,sid); if(ci)ws=ws.concat([ciAt(w,ci)]); });
  return ws; }   // the windows a person took, and the call-ins they logged with their real hours: what the screens draw. A call-in copy says ci:true, so a writer clearing on-call leaves it alone
function ocAnyOn(cyc,isoD){ const c=cyc||active(); if(!c)return []; return ocWindows(c).filter(w=>!!ocHolder(c,isoD,w.id)); }
function ocHours(w){ return w?_tHours(w.start,w.end):0; }
function ocFromText(w){ return ((w&&w.from&&w.from.zones)||[]).map(id=>{ const z=zoneById(id); return z?zoneLabel(z,"PM"):"a removed zone"; }).join(", "); }
function ocTime(w){ return w?(w.start+"\u2013"+w.end):""; }
function ocChosen(w){ return !!(w&&w.chosen&&!w.from); }   // hours chosen when booked: the window is a range, and each call-in carries the hours really worked
function ocUsualText(w){ return Math.round((+(w&&w.usual)||0)/6)/10+"h"; }
function ocWhenText(w){ return ocChosen(w)?("any hours "+ocTime(w)+", usually "+ocUsualText(w)):ocTime(w); }   // what a person reads beside a window's name
/* ---------- call-ins: on-call booked once someone is called in, with the real hours ----------
   cyc.callins = {"<iso>|<windowId>|<staffId>": {start:"HH:MM", end:"HH:MM"}}: one key per person, per window, per day, so
   several people on one day need nothing special. Kept apart from cyc.oncall, which the two Edge Functions read. */
function ciKey(isoD,winId,sid){ return isoD+"|"+winId+"|"+sid; }
function ciParse(k){ const a=String(k).split("|"); return (a.length===3&&a[0]&&a[1]&&a[2])?{d:a[0],win:a[1],sid:a[2]}:null; }
function ciValid(v){ return !!v&&/^\d\d:\d\d$/.test(v.start||"")&&/^\d\d:\d\d$/.test(v.end||""); }
function ciGet(cyc,isoD,winId,sid){ const v=cyc&&cyc.callins&&cyc.callins[ciKey(isoD,winId,sid)]; return ciValid(v)?v:null; }
function ciInUse(cyc,winId){ const c=cyc||active(); if(!c||!c.callins)return 0;
  return Object.keys(c.callins).filter(k=>{ const p=ciParse(k); return !!p&&p.win===winId&&ciValid(c.callins[k]); }).length; }
function ciMin(hm){ const x=String(hm).split(":"); return (+x[0])*60+(+x[1]); }
function ciHM(n){ n=((n%1440)+1440)%1440; return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0"); }
function ciAt(w,ci){ return Object.assign({},w,{start:ci.start,end:ci.end,ci:true}); }   // the window as this call-in worked it: the real hours on a copy, so every reader of hours reads them
function ciOnDay(cyc,isoD){ const c=cyc||active(); if(!c||!c.callins)return []; const ws=ocTakenWindows(c).filter(ocChosen), out=[];
  Object.keys(c.callins).forEach(k=>{ const p=ciParse(k), v=c.callins[k]; if(!p||p.d!==isoD||!ciValid(v)||!S.staff.some(s=>s.id===p.sid))return;
    const w=ws.find(x=>x.id===p.win); if(w)out.push({w:ciAt(w,v),sid:p.sid,k:k}); });
  return out.sort((a,b)=>ocSpan(isoD,a.w).st-ocSpan(isoD,b.w).st); }   // everyone called in that day, earliest first
function ciDropFor(cyc,ids){ if(!cyc||!cyc.callins)return; Object.keys(cyc.callins).forEach(k=>{ const p=ciParse(k); if(p&&ids.indexOf(p.sid)>=0)delete cyc.callins[k]; }); }   // someone taken out of a cycle or the group takes their call-ins with them, as their shifts go
function ocCountFor(cyc,sid){ const c=cyc||active(); if(!c||!sid)return 0; let n=0; const ws=ocWindows(c);
  datesOf(c.cycle).forEach(d=>{ n+=ocHeldBy(c,sid,iso(d),ws).length; }); return n; }
function ocSpan(isoD,w){ const d0=parseISO(isoD);
  const mk=(dt,hm)=>{const x=String(hm).split(":");return new Date(dt.getFullYear(),dt.getMonth(),dt.getDate(),+x[0],+x[1]);};
  let st=mk(d0,w.start), en=mk(d0,w.end); if(en<=st)en=mk(addDays(d0,1),w.end); return {st,en}; }   // a night ends at 08:00 on the next calendar day, even the night the clocks change
function effStaffing(){ const c=active(); return (c&&c.settings&&c.settings.staffing)||S.staffing; }   // active cycle's own staffing (falls back to global)
function effUnlock(){ const c=active(); return (c&&c.settings&&c.settings.unlockOrder)||S.unlockOrder||"pmfirst"; }
function hasExtraSlots(){ const s=effStaffing(); return (s.amMax>s.amMin)||(s.pmMax>s.pmMin); }   // are there slots beyond the minimum to "unlock"? (false when min===max → no unlock message)
function cset(){ const c=active(); if(c&&!c.settings)c.settings={}; return c?c.settings:{}; }   // active cycle's settings (ensured) — source of truth for per-cycle config
// Per-cycle settings are the source of truth; mirror the ACTIVE cycle's into the S.* globals so every existing read reflects the selected cycle.
function hydrateCycleSettings(){ const c=active(); if(!c||!c.settings)return; const s=c.settings;
  if(s.staffing)S.staffing={amMin:s.staffing.amMin,amMax:s.staffing.amMax,pmMin:s.staffing.pmMin,pmMax:s.staffing.pmMax};
  if(s.unlockOrder!=null)S.unlockOrder=s.unlockOrder;
  if(s.zones)S.zones=s.zones;                 // share the reference so in-place zone edits update the cycle
  if(s.fairness!=null)S.fairness=s.fairness;
  if(s.rosterMode!=null)S.rosterMode=s.rosterMode;
  if(s.waveCount!=null)S.waveCount=s.waveCount;
  if(s.quotaPeriod!=null)S.quotaPeriod=s.quotaPeriod;
  if(s.quotaCapMode!=null)S.quotaCapMode=s.quotaCapMode;
  if(s.quotaFlex!=null)S.quotaFlex=s.quotaFlex;
  if(s.leaveCapEft!=null)S.leaveCapEft=s.leaveCapEft;
}
/* ---------- Per-cycle staff ROLE (participation + quota/EFT/hours/period targets) ----------
   Identity (name, email, mobile, payroll, title, mode, fixedPattern) stays global on the person.
   The volatile role fields live in cycle.roles[id] so a quota/EFT change (e.g. EFT re-import) for one cycle
   never rewrites another. They're hydrated onto each staff object for reading, and synced back on save. */
let _rolesCycle=null;   // which cycle the staff objects' role fields currently reflect
function crole(id){ const c=active(); if(!c)return {}; if(!c.roles)c.roles={}; if(!c.roles[id])c.roles[id]={in:true}; return c.roles[id]; }
function inCycle(s){ return s&&s._in!==false; }   // is this person rostered in the active cycle?
function hydrateCycleRoles(){ const c=active(); if(!c)return; if(!c.roles)c.roles={};
  S.staff.forEach(s=>{ const r=c.roles[s.id];
    if(r){ if(r.quota!=null)s.quota=r.quota; if(r.eft!=null)s.eft=r.eft; if(r.hrsFortnight!=null)s.hrsFortnight=r.hrsFortnight; s.periodTargets=r.periodTargets||(r.periodTargets={}); s._in=(r.in!==false);
      if(r.cstQuota!=null)s.cstQuota=r.cstQuota; else delete s.cstQuota; s.cstTargets=r.cstTargets||{}; }   // CST: blank means the group default; a cycle with no CST data gets no key written for it
    else { s._in=false; delete s.cstQuota; s.cstTargets={}; } });   // no entry = not rostered in this cycle
  _rolesCycle=c.id;
}
function syncRolesGuarded(){ const c=active(); if(!c)return;
  if(_rolesCycle&&_rolesCycle!==c.id)return;   // active cycle changed but staff not yet re-hydrated — don't write stale role data (render() will refresh)
  if(!c.roles)c.roles={};
  S.staff.forEach(s=>{ const r=c.roles[s.id]; if(!r)return;   // only sync existing participants; addStaff/Add-to-cycle creates entries explicitly
    r.quota=s.quota; r.eft=s.eft; r.hrsFortnight=s.hrsFortnight; r.periodTargets=s.periodTargets;
    if(s.cstQuota!=null&&s.cstQuota!=="")r.cstQuota=s.cstQuota; else delete r.cstQuota; if(s.cstTargets&&Object.keys(s.cstTargets).length)r.cstTargets=s.cstTargets; else delete r.cstTargets; });
}
function periodUnlocked(isoD,period,excludeId,extra){
  const _cc=clinicalCounts(isoD,excludeId);
  const am=_cc.am+((extra&&extra.am)||0), pm=_cc.pm+((extra&&extra.pm)||0);   // `extra` is the candidate's OWN other half — a full shift fills the morning minimum it is then judged against
  const cur=period==="AM"?am:pm;
  const reqT=period==="AM"?effStaffing().amMin:effStaffing().pmMin;
  const maxT=period==="AM"?effStaffing().amMax:effStaffing().pmMax;
  const zmax=zonesFor(period).length;
  const cap=Math.min(maxT,zmax);
  if(cur>=cap)return {ok:false,reason:`${period} is full (${cur} of ${cap}).`};
  if(cur<reqT)return {ok:true};                         // still filling this period's minimum
  if(am<effStaffing().amMin||pm<effStaffing().pmMin)
    return {ok:false,reason:`Fill the minimum first — ${effStaffing().amMin} AM and ${effStaffing().pmMin} PM.`};
  const order=effUnlock();
  if(order==="both")return {ok:true};                   // extras open together — no AM/PM ordering
  const firstP=order==="amfirst"?"AM":"PM";             // ordered: "first" period's extras fill before the other's open
  if(period===firstP)return {ok:true};
  const otherCap=Math.min(firstP==="AM"?effStaffing().amMax:effStaffing().pmMax, zonesFor(firstP).length);
  const otherCur=firstP==="AM"?am:pm;
  if(otherCur>=otherCap)return {ok:true};
  return {ok:false,reason:`Extra ${firstP} opens before extra ${period} — fill ${firstP} first.`};
}
function periodsUnlocked(isoD,fills,excludeId){ for(let i=0;i<fills.length;i++){
    const extra={am:0,pm:0};
    for(let j=0;j<fills.length;j++)if(j!==i)fills[j]==="AM"?extra.am++:extra.pm++;   // judging the evening half of a full shift, its own morning half is already cover
    const u=periodUnlocked(isoD,fills[i],excludeId,extra); if(!u.ok)return u; }
  return {ok:true}; }   // a full shift is refused by the half that is full, and the reason names that half
function ocRowHTML(w,i){ const fz=(w.from&&w.from.zones)||[], eve=S.zones.filter(z=>z.pm||fz.indexOf(z.id)>=0), gone=fz.filter(id=>!zoneById(id)), ch=ocChosen(w);
  return `<div class="listrow ocrow${ch?" chosen":""}" data-oci="${i}" data-ocid="${escapeHTML(w.id)}">
    <input class="oc-label" value="${escapeHTML(w.label)}" style="width:118px" placeholder="Name" aria-label="On-call window name">
    <select class="oc-hours" aria-label="${escapeHTML(w.label)}: hours"><option value="fixed"${ch?"":" selected"}>Fixed hours</option><option value="chosen"${ch?" selected":""}>Chosen when booked</option></select>
    <span class="muted small oc-when-chosen">between</span> <input type="time" class="oc-start" value="${w.start}" aria-label="${escapeHTML(w.label)} start"> <span class="muted small oc-when-fixed">to</span><span class="muted small oc-when-chosen">and</span> <input type="time" class="oc-end" value="${w.end}" aria-label="${escapeHTML(w.label)} end">
    <span class="muted small oc-when-fixed">${ocHours(w)}h</span>
    <label class="oc-when-chosen"><span class="muted small">usually</span> <input type="number" class="oc-len" min="0.5" step="0.5" value="${ch?Math.round((+w.usual||240)/30)/2:4}" style="width:64px" aria-label="${escapeHTML(w.label)}: usual length in hours"> <span class="muted small">hours</span></label>
    <span class="grow"></span>
    ${fz.length?`<span class="muted small">follows the roster</span>`:""}<label><input type="checkbox" class="oc-book" ${w.book!==false?"checked":""}> <span class="oc-when-fixed">Staff can take it</span><span class="oc-when-chosen">Staff can log their own</span></label>
    <label title="A window that counts toward safe hours warns before the person works again too soon"><input type="checkbox" class="oc-rest" ${w.rest!==false?"checked":""}> Counts toward safe hours</label>
    <button class="btn danger sm oc-del">Remove</button>
    ${(eve.length||gone.length)?`<div class="oc-from" role="group" aria-label="${escapeHTML(w.label)}: follows the ${escapeHTML(perName("PM"))} shift in"><span class="muted small">Follows the ${escapeHTML(perName("PM"))} shift in</span>${eve.map(z=>`<label><input type="checkbox" class="oc-z" value="${escapeHTML(z.id)}" ${fz.indexOf(z.id)>=0?"checked":""}> ${escapeHTML(zoneLabel(z,"PM"))}${z.pm?"":' <span class="muted small">(no evening shift)</span>'}</label>`).join("")}${gone.map(id=>`<label><input type="checkbox" class="oc-z" value="${escapeHTML(id)}" checked> <span class="muted small">a removed zone</span></label>`).join("")}<span class="muted small">leave them all unticked for a window people take</span></div>`:""}
  </div>`; }
function typeRowHTML(t,i){ const lock=typeIsDefault(t), clin=!!(t.fills&&t.fills.length), sig=(t.fills||[]).join("+");
  const half=sig==="AM+PM"?`<span class="tag full">both halves \u2014 a full shift</span>`:(sig==="PM"?`<span class="tag pm">second half of the day</span>`:`<span class="tag am">first half of the day</span>`);
  return `<div class="listrow" data-sti="${i}">
    <input class="st-label" value="${escapeHTML(t.label)}" style="width:118px" placeholder="Name" aria-label="Shift type name">
    <input type="time" class="st-start" value="${t.start}" aria-label="${escapeHTML(t.label)} start"> <span class="muted small">to</span> <input type="time" class="st-end" value="${t.end}" aria-label="${escapeHTML(t.label)} end">
    <span class="muted small">${_tHours(t.start,t.end)}h</span>
    ${!clin?`<span class="tag cst">non-clinical</span>`:(lock?half:`<select class="st-fills" aria-label="Which half of the day this covers"><option value="AM"${sig==="AM"?" selected":""}>First half of the day</option><option value="PM"${sig==="PM"?" selected":""}>Second half of the day</option><option value="AM+PM"${sig==="AM+PM"?" selected":""}>Both halves \u2014 a full shift</option></select>`)}
    <span class="grow"></span>
    ${lock?`<span class="muted small">always on</span>`:`<label><input type="checkbox" class="st-on" ${t.on!==false?"checked":""}> On</label>`}
    <label><input type="checkbox" class="st-book" ${t.book!==false?"checked":""}> Staff can book</label>
    ${t.builtin?"":`<button class="btn danger sm st-del">Remove</button>`}
  </div>`; }
function unlockOrderLabel(){return {both:"AM & PM open together",amfirst:"AM before PM",pmfirst:"PM before AM"}[effUnlock()];}

/* ---------- self-roster + auto-draft engine ---------- */
function clinicalCountFor(staffId){let n=0;const c=active(),a=c.assign;cycleDates().forEach(d=>{const sh=a[staffId+"|"+iso(d)];if(sh&&sh.kind==="clinical")n+=shiftUnits(c,sh);});return n;}   // units, not days: a full shift takes two of a person's share
/* ---------- quota periods + per-period targets ---------- */
function periodWeeks(){return {cycle:999,week:1,fortnight:2,month:4}[S.quotaPeriod||"fortnight"];}
function periodTag(){return {cycle:"Cycle",week:"Wk",fortnight:"Fn",month:"Mo"}[S.quotaPeriod||"fortnight"];}
function cyclePeriods(){ const ds=cycleDates(), per=periodWeeks()*7, out=[];
  for(let st=0; st<ds.length; st+=per){ const slice=ds.slice(st,st+per); if(!slice.length)break;
    out.push({index:out.length, dates:slice, from:iso(slice[0]), to:iso(slice[slice.length-1]),
      label:(S.quotaPeriod==="cycle"?"Cycle":periodTag()+" "+(out.length+1))}); }
  return out; }
function lrRound(weights,total){ const n=weights.length; total=Math.max(0,Math.round(total||0)); if(!n)return [];
  const sum=weights.reduce((a,b)=>a+b,0);
  if(sum<=0){ const base=Math.floor(total/n), r=total-base*n; return weights.map((_,i)=>base+(i<r?1:0)); }
  const raw=weights.map(w=>total*w/sum), floors=raw.map(Math.floor);
  let rem=total-floors.reduce((a,b)=>a+b,0);
  const order=raw.map((v,i)=>({i,frac:v-Math.floor(v)})).sort((a,b)=>b.frac-a.frac);
  const res=floors.slice(); for(let k=0;k<rem;k++)res[order[k].i]++; return res; }
function autoPeriodTargets(s){ const periods=cyclePeriods();
  return lrRound(periods.map(()=>1), s.quota||0); } // even split of the cycle quota across the periods (admin can override per cell)
function periodCapInfo(s){ const n=cyclePeriods().length||1; const q=Math.max(0,Math.round(s.quota||0)); const floor=Math.floor(q/n); const r=q-floor*n; return {n,q,floor,r,ceil:floor+(r>0?1:0)}; } // floor=even base per period, r=#periods that may carry an extra, ceil=floor+1
function periodTarget(s,i){ const ov=s.periodTargets&&s.periodTargets[i]; return (ov!=null&&ov!=="")?(+ov):autoPeriodTargets(s)[i]; }
function periodTargetsOf(s){ const auto=autoPeriodTargets(s); return cyclePeriods().map((p,i)=>{ const ov=s.periodTargets&&s.periodTargets[i]; return (ov!=null&&ov!=="")?(+ov):auto[i]; }); }
function bookedInPeriod(staffId,p){ const c=active(); return p.dates.reduce((n,d)=>{ const sh=getShift(staffId,iso(d)); return n+(sh.kind==="clinical"?shiftUnits(c,sh):0); },0); }   // same units as clinicalCountFor, so the period caps and the cycle cap agree
function periodOfDate(isoD){ return cyclePeriods().find(p=>isoD>=p.from&&isoD<=p.to)||null; }
/* ---------- CST quota: a cap on clinical support time, per person per cycle, split per period exactly like the clinical quota ----------
   The number lives on the cycle role (cstQuota, cstTargets); blank means the group default (Quota & fairness: CST days per fortnight × the cycle's fortnights); 0 = no cap. A CST day is one, never two. */
function cstFortnights(){ return Math.max(1,Math.round((active().cycle.weeks||8)/2)); }
function cstDefaultQuota(){ const per=+((cset()||{}).cstPerFortnight)||0; return per>0?Math.round(per*cstFortnights()):0; }   // the group default for the cycle; 0 = none set
function cstQuotaOf(s){ if(!s)return 0; const v=s.cstQuota; return (v!=null&&v!=="")?Math.max(0,Math.round(+v||0)):cstDefaultQuota(); }   // the person's own number when set, else the default
function cstLabel(cyc){ const t=typeById(cyc||active(),"CST"); return (t&&t.label)||"CST"; }   // a group that renamed the type sees its own word
function cstCountFor(staffId){ let n=0; const a=active().assign; cycleDates().forEach(d=>{ const sh=a[staffId+"|"+iso(d)]; if(sh&&sh.kind==="cst")n++; }); return n; }
function cstInPeriod(staffId,p){ return p.dates.reduce((n,d)=>n+(getShift(staffId,iso(d)).kind==="cst"?1:0),0); }
function cstAutoTargets(s){ return lrRound(cyclePeriods().map(()=>1),cstQuotaOf(s)); }   // even split of the CST quota across the periods (admin can override per cell)
function cstCapInfo(s){ const n=cyclePeriods().length||1; const q=cstQuotaOf(s); const floor=Math.floor(q/n); const r=q-floor*n; return {n,q,floor,r,ceil:floor+(r>0?1:0)}; }
function cstTarget(s,i){ const ov=s.cstTargets&&s.cstTargets[i]; return (ov!=null&&ov!=="")?(+ov):cstAutoTargets(s)[i]; }
function cstTargetsOf(s){ const auto=cstAutoTargets(s); return cyclePeriods().map((p,i)=>{ const ov=s.cstTargets&&s.cstTargets[i]; return (ov!=null&&ov!=="")?(+ov):auto[i]; }); }
function cstJudge(sid,isoD){   // may this person take a CST day here? the cap mode, the cycle total, the period split and the flexible extra, as canBook judges a clinical pick; the day's own CST never counts against itself
  const st=S.staff.find(x=>x.id===sid); if(!st)return {ok:false,reason:"Not on the staff list."};
  const mode=S.quotaCapMode||"hard"; if(mode==="off")return {ok:true};
  const q=cstQuotaOf(st); if(q<=0)return {ok:true};
  const L=cstLabel(), have=getShift(sid,isoD).kind==="cst"?1:0, n=cstCountFor(sid)-have, out=r=>mode==="hard"?{ok:false,reason:r}:{ok:true,flag:r};   // soft: allowed, but said
  if(n+1>q)return out("You've used your "+L+" days for this cycle ("+q+").");
  const per=periodOfDate(isoD); if(!per)return {ok:true};
  const bp=cstInPeriod(sid,per)-have, pname=S.quotaPeriod||"fortnight";
  if(S.quotaFlex&&!(st.cstTargets&&st.cstTargets[per.index]!=null&&st.cstTargets[per.index]!=="")){ const ci=cstCapInfo(st);
    if(ci.ceil>0&&bp+1>ci.ceil)return out(per.label+" is at its "+L+" max ("+ci.ceil+").");
    if(ci.r>0&&bp+1>ci.floor){ const overOthers=cyclePeriods().filter(p=>p.index!==per.index&&cstInPeriod(sid,p)>ci.floor).length;
      if(overOthers>=ci.r)return out("You've already placed your extra "+L+" day"+(ci.r>1?"s":"")+" in another "+pname+"."); }
    return {ok:true}; }
  const tgt=cstTarget(st,per.index); if(tgt>0&&bp+1>tgt)return out(per.label+" "+L+" quota reached ("+tgt+").");
  return {ok:true}; }
function staffBusyOn(staffId,isoD){return getShift(staffId,isoD).kind!=="off";}
function freeZones(isoD,period){return zonesFor(period).filter(z=>!zoneTaken(isoD,period,z.id,null));}
function eligibleStaff(isoD){return rosterStaff().filter(s=>!staffBusyOn(s.id,isoD));}
function fillPeriodTo(isoD,period,target){let filled=0; const _cy=active();
  while(true){const cnt=clinicalCounts(isoD,null)[period==="AM"?"am":"pm"];
    if(cnt>=target)break;
    if(!periodUnlocked(isoD,period,null).ok)break;
    const free=freeZones(isoD,period);if(!free.length)break;
    let pool=eligibleStaff(isoD).filter(s=>clinicalCountFor(s.id)<(s.quota||999));
    if(!pool.length)pool=eligibleStaff(isoD);
    if(!pool.length)break;
    pool.sort((a,b)=>clinicalCountFor(a.id)-clinicalCountFor(b.id));
    const pick=ruleDraftPick(_cy,S,isoD,period,pool,free);if(!pick)break;   // with no rules: the first person into the first free zone, as before; with rules: holders first, never a slot they lack a tag for, and a place left empty rather than filled wrongly
    active().assign[pick.sid+"|"+isoD]={kind:"clinical",period:period,zone:pick.zone};filled++;}
  return filled;}
function autoDraft(toMax){
  const ds=cycleDates();let filled=0;
  filled+=applyFixedPatterns(); // lock in fixed/preference patterns before fair-filling the rest
  ds.forEach(d=>{const i=iso(d);filled+=fillPeriodTo(i,"AM",effStaffing().amMin);filled+=fillPeriodTo(i,"PM",effStaffing().pmMin);});
  if(toMax){ds.forEach(d=>{const i=iso(d);filled+=fillPeriodTo(i,"PM",Math.min(effStaffing().pmMax,zonesFor("PM").length));filled+=fillPeriodTo(i,"AM",Math.min(effStaffing().amMax,zonesFor("AM").length));});}
  let gaps=0;ds.forEach(d=>{const g=dayGap(iso(d));gaps+=g.am+g.pm;});
  logAudit("selfroster.autodraft",(toMax?"fill-to-max":"minimum")+" · placed "+filled+" · gaps left "+gaps,"admin");save();
  return {filled:filled,gaps:gaps};}
/* Clearing a cycle's roster, so a group can start fresh: every shift (a fixed pattern's shifts stay, because step 1 lays them
   down again), every on-call someone took, every open shift offered on the cycle, and — on a draft only — the leave on its
   dates. On a live roster leave is people's real leave, so it stays. Leave that runs past the cycle keeps the part outside it. */
function resetCycle(){   // the round back to the start, like a cycle just prepared (17 Oct 2026): every placed shift off — booked, fixed-pattern and CST — the schedule and its history gone, the status draft; leave and unavailable marks stay, and so do the patterns and the settings
  const c=active(), a=c.assign||{}; let n=0; Object.keys(a).forEach(k=>{ const v=a[k]; if(v&&v.kind!=="leave"){ delete a[k]; n++; } });
  const p=rosterClearPlan(c); if(c.oncall)p.oncall.forEach(k=>{ delete c.oncall[k]; });
  p.offers.forEach(o=>{ if(o.status==="pending"&&o.by)notify(o.by,"The "+fmtISO(o.iso)+" "+o.period+" offer was withdrawn.",null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"}); o.status="withdrawn"; });
  c.status="draft"; c.statusLog=[]; c.window=null; c.draft=null; c.waveState=null; delete c.publishNotifiedTs; swTidy();
  logAudit("selfroster.reset",cyLabel(c)+" reset to a fresh draft · "+n+" placed shift"+(n===1?"":"s")+" removed, leave kept","admin"); save(); return n; }
function fixedPlacedCount(cyc){ const a=(cyc||active()).assign||{}; return Object.keys(a).filter(k=>a[k]&&a[k].fixed).length; }
function clearFixedShifts(){   // the admin takes every shift the fixed patterns laid down back off this cycle (17 Oct 2026); the patterns stay committed and Auto-draft lays them down again
  const c=active(), a=c.assign||{}; let n=0; Object.keys(a).forEach(k=>{ if(a[k]&&a[k].fixed){ delete a[k]; n++; } });
  if(n){ swTidy(); logAudit("selfroster.fixedclear",n+" fixed-pattern shift"+(n===1?"":"s")+" removed · "+cyLabel(c),"admin"); save(); } return n; }
function rosterClearPlan(cyc){ const c=cyc||active(), a=c.assign||{}, draft=c.status==="draft"&&!c.archived, ds=datesOf(c.cycle), from=iso(ds[0]), to=iso(ds[ds.length-1]);
  const shifts=Object.keys(a).filter(k=>{ const v=a[k]; return !!v&&((v.kind==="clinical"&&!v.fixed)||v.kind==="cst"); });
  const cellLeave=draft?Object.keys(a).filter(k=>a[k]&&a[k].kind==="leave"):[];
  const oncall=Object.keys(c.oncall||{}).filter(k=>c.oncall[k]);
  const leave=draft?(S.leave||[]).filter(L=>!(L.to<from||L.from>to)):[];
  const offers=(S.openShifts||[]).filter(o=>o.cycleId===c.id&&(o.status==="open"||o.status==="pending"));
  const ciAll=Object.keys(c.callins||{}).filter(k=>{ const p=ciParse(k); return !!p&&p.d>=from&&p.d<=to; });   // call-ins are hours already worked: a draft clears them, a live roster keeps them, like leave
  return {c:c,draft:draft,from:from,to:to,shifts:shifts,cellLeave:cellLeave,oncall:oncall,leave:leave,offers:offers,callins:draft?ciAll:[],keptCallins:draft?0:ciAll.length}; }
function rosterClearWords(p){ const n=(x,one,many)=>x+" "+(x===1?one:many), lv=p.leave.length+p.cellLeave.length;
  return [n(p.shifts.length,"shift","shifts"),n(p.oncall.length,"on-call window","on-call windows")].concat(p.draft?[n(lv,"leave entry","leave entries")]:[]).concat(p.offers.length?[n(p.offers.length,"open shift","open shifts")]:[]).concat(p.callins&&p.callins.length?[n(p.callins.length,"call-in","call-ins")]:[]); }
function rosterClearBody(p){ const w=rosterClearWords(p);   // the question Clear the roster asks, in numbers
  return "Removes "+w.slice(0,-1).join(", ")+(w.length>1?" and ":"")+w[w.length-1]+"."+(p.draft?" Leave that runs past the cycle keeps the part outside it.":" Leave stays, because on a live roster it is people\u2019s real leave.")+(p.keptCallins?" Call-ins stay too: they record hours already worked.":"")+" Shifts laid down by fixed patterns stay. There is no undo."; }
function clearRoster(){ const p=rosterClearPlan(active()), c=p.c, a=c.assign||{};
  p.shifts.concat(p.cellLeave).forEach(k=>{ delete a[k]; });
  if(c.oncall)p.oncall.forEach(k=>{ delete c.oncall[k]; });
  if(c.callins)p.callins.forEach(k=>{ delete c.callins[k]; });
  if(p.draft){ const out=[]; (S.leave||[]).forEach(L=>{ if(L.to<p.from||L.from>p.to){ out.push(L); return; }
      if(L.from<p.from)out.push(Object.assign({},L,{id:L.id+"-pre",to:iso(addDays(parseISO(p.from),-1))}));
      if(L.to>p.to)out.push(Object.assign({},L,{id:L.id+"-post",from:iso(addDays(parseISO(p.to),1))})); });
    S.leave=out; }
  p.offers.forEach(o=>{ if(o.status==="pending"&&o.by)notify(o.by,"The "+fmtISO(o.iso)+" "+o.period+" offer was withdrawn.",null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"}); o.status="withdrawn"; });
  (S.openSwaps||[]).filter(o=>o.cycleId===c.id&&o.status==="open").forEach(o=>{ o.status="closed"; o.why="the roster was cleared"; swCloseOffers(o,nameOf(o.from)+"\u2019s swap request for "+fmtISO(o.dateA)+" has closed: the roster was cleared."); });
  logAudit("roster.clear",rosterClearWords(p).join(" \u00b7 ")+(p.draft?"":" \u00b7 leave kept, the roster is live")+(p.keptCallins?" \u00b7 call-ins kept":"")+" \u00b7 "+cyLabel(c),"admin");
  save(); return p; }
function canBook(sid,isoD,p,zoneId,typeId,hours){   // hours (optional): the booking's own {start,end}, judged by the safe-hours rules in place of the type's window
  const sh=getShift(sid,isoD);
  if(sh.kind==="leave")return {ok:false,reason:"You're on leave that day."};
  if(sh.kind!=="off")return {ok:false,reason:"You already have a shift that day."};
  if(!isAdmin()){ const _g=bookingGate(active()); if(!_g.ok)return {ok:false,reason:_g.reason};
    if(isRolling()&&isoD<iso(new Date()))return {ok:false,reason:"That day has passed."}; }   // the booking guard must agree with the schedule banner (admins exempt)
  const _cy=active(), _fills=typeId?fillsOf(_cy,{kind:"clinical",period:p,type:typeId}):[p], w=_fills.length;
  const _fv=fatigueCheck(sid,isoD,p,zoneId,typeId,hours);
  if(_fv&&effFatigue().mode==="block"&&!isAdmin())return {ok:false,reason:"Fatigue rule: "+_fv};   // warn mode (or admin override): allow the booking, but only attach the warning to a booking that actually happens
  for(let i=0;i<_fills.length;i++){ const _tk=zoneTaken(isoD,_fills[i],zoneId,sid);
    if(_tk)return {ok:false,reason:w>1?("The "+perName(_fills[i])+" half of that zone is taken — a whole-day shift needs both."):"That zone was just taken — pick another."}; }
  const u=periodsUnlocked(isoD,_fills,sid);if(!u.ok)return u;
  const _rj=ruleJudge(_cy,S,sid,isoD,_fills,zoneId,{type:typeId}); if(!_rj.ok)return {ok:false,reason:_rj.reason};   // a slot that needs a tag, or a place held for holders: after every check above, before turn, wave and quota
  if(S.fairness==="snake"&&active().draft&&whoseTurn()!==sid)return {ok:false,reason:"It's "+nameOf(whoseTurn())+"'s turn — you'll be told when it's yours."};
  if(S.fairness==="waves"&&active().waveState&&!currentCohort().includes(sid)){const _wp=wavePosOf(sid),_wc=active().waveState.current;return {ok:false,reason:_wp<0?"You're not in a booking group yet — ask your admin to re-draw the groups.":_wp<_wc?"Your group has had its turn — ask your admin if you still need shifts.":_wp===_wc+1?"Your group opens next — you'll get a notification.":"Your group opens later — you'll get a notification."};}
  if((S.quotaCapMode||"hard")==="hard"){ const per=periodOfDate(isoD), st=S.staff.find(x=>x.id===sid);
    if(per&&st){
      if(S.quotaFlex && !(st.periodTargets&&st.periodTargets[per.index]!=null&&st.periodTargets[per.index]!=="")){
        // Flexible remainder: each period up to ceil, but only r periods may exceed the even base; cycle total still capped.
        const ci=periodCapInfo(st), pname=S.quotaPeriod||"fortnight";
        if(ci.q>0 && clinicalCountFor(sid)+w>ci.q) return {ok:false,reason:w>1?("A whole-day shift takes two of your share, and you have "+Math.max(0,ci.q-clinicalCountFor(sid))+" left of "+ci.q+"."):("Cycle quota reached ("+ci.q+") — unbook elsewhere to move a shift.")};
        const bp=bookedInPeriod(sid,per);
        if(ci.ceil>0 && bp+w>ci.ceil) return {ok:false,reason:per.label+" is at its max ("+ci.ceil+")."+(w>1?" A whole-day shift takes two.":"")};
        if(ci.r>0 && bp+w>ci.floor){ const overOthers=cyclePeriods().filter(p=>p.index!==per.index && bookedInPeriod(sid,p)>ci.floor).length;
          if(overOthers>=ci.r) return {ok:false,reason:"You've already placed your extra shift"+(ci.r>1?"s":"")+" in another "+pname+". Each "+pname+" otherwise caps at "+ci.floor+" — unbook one to move it here."}; }
      } else { const tgt=periodTarget(st,per.index); if(tgt>0&&bookedInPeriod(sid,per)+w>tgt)
        return {ok:false,reason:w>1?(per.label+" has "+Math.max(0,tgt-bookedInPeriod(sid,per))+" of "+tgt+" left, and a whole-day shift takes two."):(per.label+" quota reached ("+tgt+") — book in a "+(S.quotaPeriod||"fortnight")+" that still needs shifts.")}; }
    } }
  if(_fv)_fatigueWarn=_fv;
  return {ok:true};}
function bookShift(sid,isoD,p,zoneId,typeId){
  return commitGuarded(()=>{ const c=canBook(sid,isoD,p,zoneId,typeId); if(!c.ok)return {ok:false,reason:c.reason};
    active().assign[sid+"|"+isoD]=typeId?{kind:"clinical",period:p,zone:zoneId,type:typeId}:{kind:"clinical",period:p,zone:zoneId};
    logAudit("selfroster.book",nameOf(sid)+" "+isoD+" "+(typeId?perName(typeId):p)+" "+(zoneById(zoneId)?zoneById(zoneId).name:""),sid);
    if(S.fairness==="snake"&&active().draft)advanceTurn(); return {ok:true}; });
}
/* Coming off a shift outside the notice window. The delete and the broadcast are one mutate, so a
   device can never land the delete and lose the gap. Inside the window this is refused — the person
   hands the shift over or asks, which is what keeps the gap filled. */
function gapOnDrop(cyc){ return featOn("marketplace")&&S.marketOn&&!!cyc&&!cyc.archived&&cyc.status!=="draft"&&!(cyc.status==="open"&&!isRolling(cyc))&&!roundWaiting(cyc); }   // while a round is open the slot simply returns to Book shifts, where everyone already sees it: no open-shift post, no notification (14 Oct 2026 — a round of removals had posted 36 of them). A live rolling roster, a closed round and a published roster still broadcast the gap
function dropShift(sid,isoD){
  if(!gapOnDrop(active()))return unbookShift(sid,isoD);   // nothing to broadcast: a plain removal, which goes through the booking call where the database has it
  return commitGuarded(()=>{ const cyc=active(), a=cyc.assign, cur=a[sid+"|"+isoD];
    if(!cur||cur.kind!=="clinical")return {ok:false,reason:"No shift to come off that day."};
    if(cur.fixed&&!isAdmin())return {ok:false,reason:"Fixed shift — ask your admin to change it."};
    if(!isAdmin()){ if(isRolling(cyc)&&isoD<iso(new Date()))return {ok:false,reason:"That day has passed."};   // the same rule unbookShift has always had — a rounds roster still allows a past day
      if(inNotice(isoD,cyc))return {ok:false,reason:noticeReason(isoD,cyc)}; }
    const p=cur.period, z=cur.zone, ty=cur.type||null, own=!isAdmin()||sid===S.viewAs;   // an admin clearing someone else's day did not "come off" it
    delete a[sid+"|"+isoD]; swTidy();
    logAudit("selfroster.unbook",nameOf(sid)+" "+isoD,S.viewAs);
    if(gapOnDrop(cyc))_postGapBody(cyc.id,isoD,p,z,ty,"",own?sid:null,true);
    return {ok:true}; });
}
function noticeReason(isoD,cyc){ const c=cyc||active(), d=daysUntil(isoD);
  return effNotice(c)+" days\u2019 notice on this roster, and that shift is "+(d<=0?"today":(d===1?"tomorrow":"in "+d+" days"))+". "+((featOn("marketplace")&&S.marketOn)?"Offer it to the group, or ask your admin to let you off.":"Swap it, or ask your admin to let you off."); }
function ocTake(sid,isoD,winId){
  return commitGuarded(()=>{ const cyc=active(), w=ocWindow(cyc,winId);
    if(!w)return {ok:false,reason:"That on-call window is gone."};
    if(w.from)return {ok:false,reason:w.label+" follows the roster \u2014 it isn\u2019t taken by hand."};
    if(ocChosen(w))return {ok:false,reason:w.label+" is logged as a call-in, with the hours worked."};
    if(!rosterStaff().some(p=>p.id===sid))return {ok:false,reason:nameOf(sid)+" isn\u2019t on this cycle\u2019s roster."};   // payroll and RosterOn only list the roster: a window carried by anyone else would be paid nowhere
    if(getShift(sid,isoD).kind==="leave")return {ok:false,reason:"You\u2019re on leave that day."};
    if(!isAdmin()){ if(w.book===false)return {ok:false,reason:"Your admin places "+w.label+"."};
      const g=bookingGate(cyc); if(!g.ok)return {ok:false,reason:g.reason};
      if(isRolling(cyc)&&isoD<iso(new Date()))return {ok:false,reason:"That day has passed."}; }
    const _fv=ocFatigueCheck(sid,isoD,winId);
    if(_fv&&effFatigue().mode==="block"&&!isAdmin())return {ok:false,reason:"Fatigue rule: "+_fv};
    const cur=ocHolder(cyc,isoD,winId);   // a stray key for someone who has left or is on leave is no holder
    if(cur===sid)return {ok:true};
    if(cur)return {ok:false,reason:shortNm(S.staff.find(x=>x.id===cur)||{name:"Someone"})+" is on call for "+w.label+" that day."};   // re-read on every CAS retry, so the second person loses honestly
    const clash=ocClash(cyc,sid,isoD,w);
    if(clash)return {ok:false,reason:(sid===S.viewAs?"You\u2019re":shortNm(S.staff.find(x=>x.id===sid)||{name:"They"})+" is")+" already on call for "+clash.label+" "+ocTime(clash)+" then."};
    if(!cyc.oncall)cyc.oncall={};
    cyc.oncall[ocKey(isoD,winId)]=sid;
    logAudit("oncall.take",nameOf(sid)+" "+isoD+" "+w.label,S.viewAs);
    if(_fv)_fatigueWarn=_fv;   // only on the way out, so a refusal never leaves a warning to surface on the next success
    return {ok:true}; },"octake-"+isoD+"-"+winId);
}
function ocClear(sid,isoD,winId){
  return commitGuarded(()=>{ const cyc=active(), w=ocWindow(cyc,winId);
    if(w&&w.from)return {ok:false,reason:w.label+" follows the roster \u2014 change the shift instead."};
    if(!cyc.oncall)return {ok:true};
    const cur=cyc.oncall[ocKey(isoD,winId)];
    if(!cur)return {ok:true};
    if(cur!==sid)return {ok:false,reason:isAdmin()?shortNm(S.staff.find(x=>x.id===cur)||{name:"Someone else"})+" is on call for "+((w&&w.label)||"that window")+" that day now.":"That one isn\u2019t yours."};   // admins too: clear the person you meant, never whoever holds it by the time the write lands
    if(!isAdmin()){ if(w&&w.book===false)return {ok:false,reason:"Your admin places "+w.label+" \u2014 ask them to take you off it."};
      const g=bookingGate(cyc); if(!g.ok)return {ok:false,reason:g.reason};
      if(isRolling(cyc)&&isoD<iso(new Date()))return {ok:false,reason:"That day has passed."};
      if(inNotice(isoD,cyc))return {ok:false,reason:"That\u2019s inside the "+effNotice(cyc)+"-day notice period \u2014 ask your admin to take you off "+((w&&w.label)||"it")+"."}; }   // a window dropped close to the day is a gap to plan for, exactly as a shift is
    delete cyc.oncall[ocKey(isoD,winId)];
    logAudit("oncall.clear",nameOf(cur)+" "+isoD+" "+((w&&w.label)||winId),S.viewAs);
    return {ok:true}; },"octake-"+isoD+"-"+winId);
}
function ciOnTime(isoD){ return isoD===iso(new Date())||isoD===iso(addDays(new Date(),-1)); }   // a consultant logs, changes or removes a call-in on the day or the day after, by the phone's own date
function ciInRange(w,start,end){ const r0=ciMin(w.start); let r1=ciMin(w.end); if(r1<=r0)r1+=1440;
  let a=ciMin(start), b=ciMin(end); if(a<r0)a+=1440; if(b<=r0)b+=1440;
  return a>=r0&&b>a&&b<=r1; }   // inside the window's range, with the end after the start. A From before the range starts, or a To at or before it, is read as after midnight, which is how a range ending at 00:00 takes 00:00 as its end; nothing moves a To past its From
function ciDefaults(w,isoD){ const r0=ciMin(w.start), r1=w.end==="00:00"?1440:ciMin(w.end); let st=r0;
  if(isoD===iso(new Date())){ const now=new Date(), n=Math.floor((now.getHours()*60+now.getMinutes())/15)*15; if(n>=r0&&n<r1)st=n; }
  return {start:ciHM(st),end:ciHM(Math.min(st+(+w.usual||240),r1))}; }   // From is now, to the quarter hour, when logging today inside the range, otherwise the start of the range; To follows the usual length, capped at the end of the range, where an end of 00:00 is midnight
function ciShiftClash(c,sid,isoD,s){ const d0=parseISO(isoD);
  for(const n of [-1,0,1]){ const d=iso(addDays(d0,n)), sh=(c.assign||{})[sid+"|"+d]; if(!sh||(sh.kind!=="clinical"&&sh.kind!=="cst"))continue;
    let sp=null; if(sh.kind==="clinical")sp=_shiftSpan(sid,d,sh.period,sh.zone,sh.type,sh.hours); else { const t=typeOf(c,sh); if(t&&t.start&&t.end)sp=ocSpan(d,t); }
    if(sp&&sp.st<s.en&&s.st<sp.en)return shiftLabel(sh)+(d===isoD?"":" on "+fmtISO(d)); }
  return ""; }   // a shift that day, or one either side that runs into it: the same hours are never paid twice
function ciRefusal(c,w,sid,isoD,start,end){ const adm=isAdmin(), who=(sid===S.viewAs?"You\u2019re":nameOf(sid)+" is");
  if(!adm&&sid!==S.viewAs)return "You can only log your own call-in.";
  if(!rosterStaff().some(p=>p.id===sid))return nameOf(sid)+" isn\u2019t on this cycle\u2019s roster.";   // payroll and RosterOn only list the roster
  if(!adm){ if(w.book===false)return "Your admin logs "+w.label+".";
    if(c.status==="draft"||c.archived)return "This roster isn\u2019t live yet.";
    if(!ciOnTime(isoD))return "A call-in is logged on the day or the day after. Ask your admin to add this one."; }
  if(getShift(sid,isoD).kind==="leave")return who+" on leave that day.";
  if(!/^\d\d:\d\d$/.test(start||"")||!/^\d\d:\d\d$/.test(end||""))return "Fill in both times.";
  if(!ciInRange(w,start,end))return "Choose hours between "+w.start+" and "+w.end+", with the end after the start.";
  const cand=ciAt(w,{start:start,end:end}), s=ocSpan(isoD,cand);
  const sh=ciShiftClash(c,sid,isoD,s); if(sh)return who+" working "+sh+" then.";
  const x=ocClash(c,sid,isoD,cand); if(x)return who+" already on call for "+x.label+" "+ocTime(x)+" then.";
  return ""; }   // every rule a call-in passes, read inside the write, so a retry after another phone's save is judged again
function ciSave(sid,isoD,winId,start,end){ const k=ciKey(isoD,winId,sid);   // log a call-in, or change its hours: one per person, per window, per day
  return commitGuarded(()=>{ const c=active(), w=ocWindow(c,winId), adm=isAdmin();
    if(!ocChosen(w))return {ok:false,reason:"That call-in window is gone."};
    const bad=ciRefusal(c,w,sid,isoD,start,end); if(bad)return {ok:false,reason:bad};
    const had=ciGet(c,isoD,winId,sid); if(had&&had.start===start&&had.end===end)return {ok:true};
    const _fv=ocFatigueCheck(sid,isoD,winId,{start:start,end:end});
    if(_fv&&effFatigue().mode==="block"&&!adm)return {ok:false,reason:"Fatigue rule: "+_fv};
    if(!c.callins)c.callins={};
    c.callins[k]={start:start,end:end};
    const hrs=start+"\u2013"+end, day=fmtISO(isoD);
    if(had)logAudit("callin.change",nameOf(sid)+" "+isoD+" "+w.label+" "+had.start+"\u2013"+had.end+" \u2192 "+hrs,S.viewAs);
    else logAudit("callin.log",nameOf(sid)+" "+isoD+" "+w.label+" "+hrs,S.viewAs);
    if(adm)notify(sid,(had?"Your admin changed your call-in on "+day+" to ":"Your admin logged a call-in for you on "+day+", ")+hrs+".",null,{tab:"my",cycle:c.id});
    else notify("admin",nameOf(sid)+(had?" changed their call-in on "+day+" to ":" logged a call-in on "+day+", ")+hrs+".",null,{tab:"roster",cycle:c.id});
    if(_fv)_fatigueWarn=_fv;   // only on the way out, so a refusal never leaves a warning behind
    return {ok:true}; },"ci-"+k);
}
function ciRemove(sid,isoD,winId){ const k=ciKey(isoD,winId,sid);
  return commitGuarded(()=>{ const c=active(), w=ocWindow(c,winId), adm=isAdmin(), had=ciGet(c,isoD,winId,sid);
    if(!had)return {ok:true};
    if(!adm){ if(sid!==S.viewAs)return {ok:false,reason:"That call-in isn\u2019t yours."};
      if(!ciOnTime(isoD))return {ok:false,reason:"A call-in can be removed on the day or the day after. Ask your admin to remove this one."}; }
    delete c.callins[k];
    const hrs=had.start+"\u2013"+had.end, day=fmtISO(isoD);
    logAudit("callin.remove",nameOf(sid)+" "+isoD+" "+((w&&w.label)||winId)+" "+hrs,S.viewAs);
    if(adm)notify(sid,"Your admin removed your call-in on "+day+" ("+hrs+").",null,{tab:"my",cycle:c.id});
    else notify("admin",nameOf(sid)+" removed their call-in on "+day+" ("+hrs+").",null,{tab:"roster",cycle:c.id});
    return {ok:true}; },"ci-"+k);
}
function unbookShift(sid,isoD){
  const _cyc=S.activeId, _cur=active().assign[sid+"|"+isoD];
  if(cloudOn()&&_evOk===true&&_cur&&_cur.kind==="clinical"&&!_cur.fixed){   // the booking call removes it; the checks the phone owns run first, in the same words as below
    if(!isAdmin()&&isRolling()&&isoD<iso(new Date())){ toast("That day has passed.","danger"); return false; }
    if(!isAdmin()&&inNotice(isoD,active())){ toast(noticeReason(isoD,active()),"danger"); return false; }
    if(_inflight.has("unbook")){ toast("Still saving your last tap \u2014 one moment."); return false; }
    delete active().assign[sid+"|"+isoD]; _inflight.add("unbook"); _selfChange=true; render();
    cloudBook(_cyc,sid,[{op:"unbook",sid:sid,day:isoD}]).then(res=>{ _inflight.delete("unbook"); const r=res&&res.ok===true&&Array.isArray(res.results)?res.results[0]:null;
      if(r&&r.ok){ _evApplyLive([{seq:r.seq,cycle:_cyc,key:r.key||(sid+"|"+isoD),val:null,audit:r.audit}]); const before=_snap([S.openSwaps,S.swapOffers,S.openShifts,S.notifications]); swTidy(); if(_snap([S.openSwaps,S.swapOffers,S.openShifts,S.notifications])!==before)save(); }   // an ask or offer that stood on the shift closes, and that is a document edit
      else { const c=S.cycles.find(x=>x.id===_cyc); if(c&&c.assign&&!c.assign[sid+"|"+isoD])c.assign[sid+"|"+isoD]=_cur; toast((r&&r.reason)||(res&&res.reason)||BOOK_OFFLINE,"danger"); if(r)_evCatchUp().then(n=>{ if(!n)_docRefetch(); }); }
      _selfChange=true; render(); });
    return true; }
  return commitGuarded(()=>{ const a=active().assign; const cur=a[sid+"|"+isoD];
    if(cur){ if(cur.fixed&&!isAdmin())return {ok:false,reason:"Fixed shift — ask your admin to change it."};
      if(!isAdmin()&&isRolling()&&isoD<iso(new Date()))return {ok:false,reason:"That day has passed."};
      if(!isAdmin()&&cur.kind==="clinical"&&inNotice(isoD,active()))return {ok:false,reason:noticeReason(isoD,active())};   // the guard lives here, not only on the screen
      delete a[sid+"|"+isoD]; logAudit("selfroster.unbook",nameOf(sid)+" "+isoD,sid); swTidy(); } return {ok:true}; });
}
function srTapPick(k){ const i=_srPick.indexOf(k);   // a chip on the day sheet: into the basket — or, with the group's switch on, booked there and then
  if(i>=0){ _srPick.splice(i,1); delete _srHours[k.split("|")[0]]; }   // a day's typed hours go with its pick
  else { const a=k.split("|"), chk=pickCheck(_srSid||S.viewAs,a[0],a[1],a[2],a[3]); if(!chk.ok){toast(chk.reason);return;}
    if(instantBookOn()){ if(_inflight.has("srConfirm")){toast("Still saving your last tap — one moment.");return;} _srPick=[k]; _srHours={}; _receipt=null; closeDaySheet(); srBatchBook(); return; }   // first tap wins: the one pick goes down Confirm's own path, so the checks and the receipt are the same — and a tap during a save is refused, never parked
    _srPick=_srPick.filter(x=>x.indexOf(a[0]+"|")!==0); _srPick.push(k); delete _srHours[a[0]]; _receipt=null; }   // one pick per day: a new pick replaces that day's earlier one
  if(ownHoursOn())render(); else closeDaySheet(); }   // with the hours switch on the sheet stays open, so the Hours row is right there under the chips
function srBatchBook(){ const picks=_srPick.slice(); if(!picks.length||_inflight.has("srConfirm"))return; const sid=_srSid, cyc=S.activeId;
  const plan=()=>{ const fail=[], ops=[]; picks.forEach(key=>{const a=key.split("|"); const _hr=srHoursFor(active(),a[0],a[1],a[3]); const c=!_hr.ok?{ok:false,reason:_hr.reason}:(_hr.hours?canBook(sid,a[0],a[1],a[2],a[3],_hr.hours):canBook(sid,a[0],a[1],a[2],a[3]));   // the hours typed beside the pick are judged with it: the safe-hours rules see the real hours
    if(c.ok){ const _na=a[3]?{kind:"clinical",period:a[1],zone:a[2],type:a[3]}:{kind:"clinical",period:a[1],zone:a[2]}; if(_hr.hours)_na.hours=_hr.hours; active().assign[sid+"|"+a[0]]=_na;
      ops.push({op:"book",sid:sid,day:a[0],period:a[1],zone:a[2],type:a[3]||null,hours:_hr.hours||null,akey:sid+"|"+a[0],val:_na,label:fmtISO(a[0])+" "+(a[3]?perName(a[3]):a[1])}); }   // the pick goes on the screen now; what confirms it depends on the path below
    else fail.push(fmtISO(a[0])+" "+(a[3]?perName(a[3]):a[1])+" — "+c.reason); }); return {fail:fail,ops:ops}; };
  const mutate=()=>{ const p=plan(); p.ops.forEach(o=>logAudit("selfroster.book",nameOf(sid)+" "+o.day+" "+(o.type?perName(o.type):o.period)+" "+(zoneById(o.zone)?zoneById(o.zone).name:"")+(o.hours?" "+windowStr(o.hours):""),sid)); window._srBatchFail=p.fail; return {ok:true}; };
  const after=res=>{ const fw=_fatigueWarn; _fatigueWarn=null; _inflight.delete("srConfirm"); _srPick=[]; _srHours={}; const f=window._srBatchFail||[]; const okN=(res&&res.ok===false)?0:picks.length-f.length;
    if(okN>0&&S.activeId===cyc){ const st=S.staff.find(x=>x.id===sid)||{}; picks.forEach(k=>{ const d=k.split("|")[0]; if(!f.some(x=>x.indexOf(fmtISO(d))===0))_justBooked.add(d); }); _receipt={sid,cycleId:cyc,n:okN,booked:clinicalCountFor(sid),quota:+st.quota||0}; }   // the rows settle and the receipt takes the footer's place — only under the cycle that was booked
    _selfChange=true; render();
    if(res&&res.ok===false&&res.reason)toast(res.reason); else { if(f.length)toast("Booked "+okN+". These didn't go in:\n• "+f.join("\n• "),"warn"); if(fw)toast(fw,"warn"); } };
  if(!cloudOn()){ mutate(); save(); after({ok:true}); }
  else if(_evOk===true){ const p=plan(); window._srBatchFail=p.fail; _inflight.add("srConfirm"); _selfChange=true; render();   // the picks the phone's own rules allow are on the screen; the database says which stand
    const send=p.ops.map(o=>({op:o.op,sid:o.sid,day:o.day,period:o.period,zone:o.zone,type:o.type,hours:o.hours}));
    (p.ops.length?cloudBook(cyc,sid,send):Promise.resolve({ok:true,results:[]})).then(res=>{ const f=_bookSettle(cyc,sid,p.ops,res); window._srBatchFail=p.fail.concat(f.fails); after(f.res); if(f.lost)_evCatchUp().then(n=>{ if(!n)_docRefetch(); }); }); }   // a refusal means the chips were stale: catch up, and if the events explain nothing, fetch the document
  else { const p=cloudCommit(mutate); _inflight.add("srConfirm"); _selfChange=true; render(); p.then(after); } }   // the old way (no booking call in this database yet): the picks are already in the roster (mutate ran synchronously): paint now, with the Confirm button saving, then settle
function draftBaseOrder(){return rosterStaff().slice().sort((a,b)=>clinicalCountFor(a.id)-clinicalCountFor(b.id)).map(s=>s.id);}
function startRounds(){active().draft={round:1,turnIdx:0,base:draftBaseOrder()};logAudit("selfroster.rounds","snake rounds started","admin");save();}
function draftOrder(){const d=active().draft;if(!d)return [];const o=d.base.slice();return (d.round%2===0)?o.reverse():o;}
/* ----- open-shift marketplace (broadcast gaps + give-aways) ----- */
function zoneName(z){const x=zoneById(z);return x?x.name:"?";}
function osTypeName(o){ return o&&o.type?perName(o.type):perName(o&&o.period);}   // an open shift or give-away is advertised as what the claimer will actually work
function fmtISO(i){const d=parseISO(i);return DOW[d.getDay()]+" "+d.getDate()+" "+fmt(d,{month:"short"});}
function osActive(){ const cyc=active(), seen={};   // an ask made while open shifts were off is for the admins alone; a give-away stands only while its giver still holds the shift
  return (S.openShifts||[]).filter(o=>{ if(!o||o.cycleId!==S.activeId||o.kind==="ask")return false; if(o.kind==="giveaway"&&!osHolds(o))return false;
    if(o.kind==="gap"&&o.status==="open"){ const fl=fillsOf(cyc,{kind:"clinical",period:o.period,type:o.type||undefined});
      if(fl.some(f=>zoneTaken(o.iso,f,o.zone,null)))return false;   // a gap someone has since filled by booking is no gap: it leaves the list on every device alike
      const k=o.iso+"|"+o.period+"|"+o.zone+"|"+(o.type||""); if(seen[k])return false; seen[k]=1; }   // the same slot posted twice shows once
    return true; }); }
function canClaim(sid,isoD,p,zoneId,bypassQuota,giveFrom,typeId){
  const sh=getShift(sid,isoD);
  if(sh.kind==="leave")return {ok:false,reason:"You're on leave that day."};
  if(sh.kind!=="off")return {ok:false,reason:"You're already working that day."};
  const _cy=active(), a=_cy.assign; let holder=null;
  const want=typeId?fillsOf(_cy,{kind:"clinical",period:p,type:typeId}):[p], _w=want.length;
  for(const k in a){ const v=a[k]; if(!v||v.kind!=="clinical")continue; const i=k.indexOf("|");
    if(k.slice(i+1)!==isoD)continue; if(v.zone!==zoneId||!fillsOf(_cy,v).some(x=>want.indexOf(x)>=0))continue;   // overlap, not equality: a half shift blocks a whole-day one and the other way round
    const who=k.slice(0,i); if(who===sid||who===giveFrom)continue;   // my own shift, or the giver still holding what they offered
    holder=who; break; }   // a whole-day candidate can overlap TWO people — the giver AND someone else; only a stranger blocks it
  if(holder)return {ok:false,reason:"That zone is already covered."};
  const _fv=fatigueCheck(sid,isoD,p,zoneId,typeId);
  if(_fv&&effFatigue().mode==="block"&&!isAdmin())return {ok:false,reason:"Fatigue rule: "+_fv};
  const _rj=ruleJudge(_cy,S,sid,isoD,want,zoneId,{type:typeId,without:giveFrom?[giveFrom]:[]}); if(!_rj.ok)return {ok:false,reason:_rj.reason};   // the giver of a give-away is already gone; an approval re-runs this, as it re-runs every other check
  if(!bypassQuota){ const st=S.staff.find(x=>x.id===sid), q=st?(+st.quota||0):0;
    if(q>0&&clinicalCountFor(sid)+_w>q)return {ok:false,reason:"You've reached your cycle quota ("+q+")."+(_w>1?" A whole-day shift takes two.":"")}; }
  if(_fv)_fatigueWarn=_fv;
  return {ok:true};
}
/* The gap broadcast, as a plain body so a mutate that is already running can call it — the shape
   _osExecute has to claimOpenShift. The CYCLE is named, never assumed to be the active one: approving
   leave frees days across every cycle at once. `droppedBy` is display only and is deliberately NOT
   written to `actor`, because withdrawOpenShift grants withdrawal to o.actor and a person must not be
   able to quietly withdraw the gap they just created. */
function _postGapBody(cycId,isoD,p,zoneId,typeId,note,droppedBy,push){
  const id="os"+Date.now()+Math.random().toString(36).slice(2,5);
  const row={id,cycleId:cycId,iso:isoD,period:p,zone:zoneId,type:typeId||null,kind:"gap",from:null,status:"open",by:null,at:null,note:note||"",ts:Date.now(),actor:"admin"};
  if(droppedBy)row.droppedBy=droppedBy;
  (S.openShifts=S.openShifts||[]).unshift(row);
  const _c=S.cycles.find(c=>c.id===cycId)||null;   // the names come from the cycle the shift is IN, not whichever one is on screen
  const _z=((_c&&_c.settings&&_c.settings.zones)||S.zones||[]).find(z=>z.id===zoneId), zn=_z?_z.name:"?";
  const _ty=(typeId&&_c)?typeById(_c,typeId):null, pn=_ty?_ty.label:p;
  const what=fmtISO(isoD)+" "+pn+" · "+zn;
  notify("all",(droppedBy?(shortNm(S.staff.find(x=>x.id===droppedBy)||{name:"Someone"})+" came off "+what):("Open shift: "+what))+(note?" — "+note:"")+". First to claim it takes it.","os-post-"+id,{tab:"my",cycle:cycId,anchor:"openshifts"},droppedBy||null);   // the person who came off already knows
  logAudit("market.post","open shift "+isoD+" "+p+" "+zn+(droppedBy?" · came off":""),droppedBy||"admin");
  if(push)_osPushQueue={type:"post",osId:id,title:"Open shift — "+fmtISO(isoD)+" "+pn,body:zn+(note?" · "+note:"")+" — first to claim takes it.",targets:null};
  return id;
}
function postOpenShift(isoD,p,zoneId,note,typeId){
  return commitGuarded(()=>{ if(!isAdmin())return {ok:false,reason:"Admin only."};
    const _fl=typeId?fillsOf(active(),{kind:"clinical",period:p,type:typeId}):[p];
    for(let i=0;i<_fl.length;i++)if(zoneTaken(isoD,_fl[i],zoneId,null))return {ok:false,reason:"That zone is already covered — pick another."};
    _postGapBody(S.activeId,isoD,p,zoneId,typeId,note,null,true);
    return {ok:true}; });
}
function _offerBody(sid,isoD,adminOnly){   // the give-away, as a plain body — nesting commitGuarded would fire a second CAS commit and lose the push
  const cur=active().assign[sid+"|"+isoD];
  if(!cur||cur.kind!=="clinical")return {ok:false,reason:"No clinical shift to offer."};
  if(!adminOnly&&(!featOn("marketplace")||!S.marketOn))return {ok:false,reason:"Open shifts is off for this group — ask your admin."};   // the button used to be the only guard
  if(adminOnly&&isoD<iso(new Date()))return {ok:false,reason:"That day has passed."};   // an ask to the admins alone is about a day to come
  if(active().archived||active().status==="draft")return {ok:false,reason:"This roster isn\u2019t live yet."};
  if(adminOnly?askOn(sid,isoD):offeredAlready(sid,isoD))return {ok:false,reason:adminOnly?"Already asked.":"Already offered."};   // adminOnly: an ask to come off while open shifts are off, which goes to the admins alone
  if(!adminOnly&&askOn(sid,isoD))return {ok:false,reason:"Already asked."};   // an ask made while open shifts were off still stands once they are switched on
  return {ok:true,cur:cur};
}
function offerShift(sid,isoD){
  return commitGuarded(()=>{ const _p=_offerBody(sid,isoD); if(!_p.ok)return _p; const cur=_p.cur;
    const id="os"+Date.now()+Math.random().toString(36).slice(2,5);
    (S.openShifts=S.openShifts||[]).unshift({id,cycleId:S.activeId,iso:isoD,period:cur.period,zone:cur.zone,type:cur.type||null,kind:"giveaway",from:sid,status:"open",by:null,at:null,note:"",ts:Date.now(),actor:sid});
    const _cl=cur.type?perName(cur.type):cur.period;   // a 12-hour give-away must not be re-posted as a plain morning
    notify("all",nameOf(sid)+" offered their "+fmtISO(isoD)+" "+_cl+" ("+zoneName(cur.zone)+") to the group.","os-post-"+id,{tab:"my",cycle:S.activeId,anchor:"openshifts"},sid);   // they just tapped it
    notify("admin",nameOf(sid)+" offered "+fmtISO(isoD)+" "+_cl+" to the group.","os-adm-"+id,{tab:"setup",anchor:"marketCard"});
    logAudit("market.offer",nameOf(sid)+" offered "+isoD+" "+_cl,sid);
    _osPushQueue={type:"post",osId:id,title:"Shift offered — "+fmtISO(isoD)+" "+_cl,body:nameOf(sid)+" can't do "+zoneName(cur.zone)+" — tap to take it.",targets:null};
    return {ok:true}; });
}
function withdrawOpenShift(osId){
  return commitGuarded(()=>{ const o=(S.openShifts||[]).find(x=>x.id===osId);
    if(!o)return {ok:false,reason:"That open shift is gone."};
    if(!(isAdmin()||o.from===S.viewAs||o.actor===S.viewAs))return {ok:false,reason:"Not yours to withdraw."};
    if(o.status!=="open"&&o.status!=="pending")return {ok:false,reason:"Already "+o.status+"."};
    if(o.status==="pending"&&o.by)notify(o.by,"The "+fmtISO(o.iso)+" "+o.period+" offer was withdrawn.",null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"});
    o.status="withdrawn"; logAudit("market.withdraw",o.iso+" "+o.period,S.viewAs); return {ok:true}; });
}
/* Asking to come off is the give-away plus one object. With open shifts on it is always also an offer, so if a
   colleague takes it first the admin never has to decide — which is the whole point of D1. With open shifts off
   the ask goes to the admins alone: never listed, never claimable, and nothing goes to the group. */
function askComeOff(sid,isoD,reason){
  return commitGuarded(()=>{ const alone=!(featOn("marketplace")&&S.marketOn), _p=_offerBody(sid,isoD,alone); if(!_p.ok)return _p; const cur=_p.cur;   // with open shifts off the ask goes to the admins alone: never listed, never claimable, nothing broadcast
    const why=String(reason||"").trim().slice(0,300);
    if(!why)return {ok:false,reason:"Say why you need to come off — your admin decides on it."};
    const id="os"+Date.now()+Math.random().toString(36).slice(2,5);
    (S.openShifts=S.openShifts||[]).unshift({id,cycleId:S.activeId,iso:isoD,period:cur.period,zone:cur.zone,type:cur.type||null,kind:alone?"ask":"giveaway",from:sid,status:"open",by:null,at:null,note:"",ts:Date.now(),actor:sid,ask:{status:"pending",ts:Date.now(),reason:why}});
    const _cl=cur.type?perName(cur.type):cur.period;
    if(!alone)notify("all",nameOf(sid)+" needs to come off "+fmtISO(isoD)+" "+_cl+" ("+zoneName(cur.zone)+") — take it and they\u2019re off.","os-post-"+id,{tab:"my",cycle:S.activeId,anchor:"openshifts"},sid);   // they just tapped it
    notify("admin",nameOf(sid)+" asked to come off "+fmtISO(isoD)+" "+_cl+" — "+daysUntil(isoD)+" days\u2019 notice.","os-ask-"+id,{tab:"requests",cycle:S.activeId});   // the card is filtered to one cycle, so the tap has to switch to it
    logAudit("market.ask",nameOf(sid)+" "+isoD+" "+_cl+" · "+why,sid);
    if(!alone)_osPushQueue={type:"post",osId:id,title:"Cover needed — "+fmtISO(isoD)+" "+_cl,body:nameOf(sid)+" needs to come off "+zoneName(cur.zone)+" — tap to take it.",targets:null};
    return {ok:true}; });
}
function decideComeOff(osId,letOff,note){
  return commitGuarded(()=>{ if(!isAdmin())return {ok:false,reason:"Admin only."};
    const o=(S.openShifts||[]).find(x=>x.id===osId);
    if(!o||!o.ask||o.ask.status!=="pending")return {ok:false,reason:"Nothing to decide."};
    if(o.status!=="open")return {ok:false,reason:"A colleague has already taken it — they\u2019re off it either way."};
    const cyc=S.cycles.find(c=>c.id===o.cycleId); if(!cyc)return {ok:false,reason:"That roster cycle is missing."};   // the record carries its cycle; never guess from the date
    const sid=o.from, why=String(note||"").trim().slice(0,300);
    if(!osHolds(o))return {ok:false,reason:"That shift is no longer theirs — nothing to "+(letOff?"let them off.":"keep them on.")};   // read again inside the write: a swap, a cell edit or leave may have moved it
    const alone=o.kind==="ask";   // asked while open shifts were off: no offer stays open, and nothing goes to the group
    if(!letOff){ o.ask.status="declined"; o.ask.note=why; if(alone)o.status="closed";
      notify(sid,"Your admin needs you on "+fmtISO(o.iso)+"."+(why?(" "+why):"")+(alone?"":" Your offer to the group is still open \u2014 if a colleague takes it, you\u2019re off."),null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"});
      logAudit("market.keep",nameOf(sid)+" "+o.iso+(why?(" · "+why):""),"admin"); return {ok:true}; }
    delete cyc.assign[sid+"|"+o.iso];   // each branch sweeps once its own record is settled, or the sweep would withdraw the very ask being decided
    if(alone){ o.ask.status="approved"; o.ask.note=why; o.status="closed"; o.droppedBy=sid; o.actor="admin"; swTidy();   // the day shows as needing cover, like any gap
      notify(sid,"You\u2019re off "+fmtISO(o.iso)+" \u2014 your admin let you off."+(why?(" "+why):""),null,{tab:"my",cycle:o.cycleId});
      logAudit("market.release",nameOf(sid)+" "+o.iso+" "+zoneName(o.zone)+(why?(" \u00b7 "+why):""),"admin"); return {ok:true}; }
    o.ask.status="approved"; o.ask.note=why; o.kind="gap"; o.from=null; o.droppedBy=sid; o.actor="admin"; swTidy();   // it becomes a plain gap: nobody is on it now
    notify(sid,"You\u2019re off "+fmtISO(o.iso)+" — your admin let you off."+(why?(" "+why):"")+" The shift is with the group.",null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"});
    notify("all","Nobody is on "+fmtISO(o.iso)+" "+(o.type?perName(o.type):o.period)+" · "+zoneName(o.zone)+" — first to claim it takes it.","os-gap-"+o.id,{tab:"my",cycle:o.cycleId,anchor:"openshifts"});
    logAudit("market.release",nameOf(sid)+" "+o.iso+" "+zoneName(o.zone)+(why?(" · "+why):""),"admin");
    return {ok:true}; });
}
function pendingAsks(){ return (S.openShifts||[]).filter(o=>o&&o.ask&&o.ask.status==="pending"&&o.status==="open"&&o.cycleId===S.activeId&&osHolds(o)); }   // the active cycle, like the rest of the marketplace, and only while the giver still holds that shift
function freeThatDay(cyc,isoD){ return S.staff.filter(s=>swOnRoster(cyc,s.id)&&swFree(cyc,s.id,isoD)); }   // on this cycle's roster, with no shift and no leave that day
function freeThatDayHTML(isoD){ const free=freeThatDay(active(),isoD), call=free.filter(s=>e164(s.mobile)), rest=free.filter(s=>!e164(s.mobile));   // who an admin could ring (the Staff page already shows admins these numbers): one button each, so a long list stays short on a phone
  return `<div class="small" style="margin-top:8px"><b>Free that day</b>${free.length?"":" \u00b7 nobody"}</div>`
    +(call.length?`<div class="dsact">${call.map(s=>`<a class="btn sm" href="tel:${e164(s.mobile)}" aria-label="Call ${escapeHTML(s.name)}">${ic("phone")} ${escapeHTML(s.name)}</a>`).join("")}</div>`:"")
    +(rest.length?`<div class="small muted">${call.length?"Also free, no mobile on file: ":"No mobile on file: "}${escapeHTML(rest.map(s=>s.name).join(", "))}</div>`:""); }
function askAdminCard(o){ const cov=clinicalCounts(o.iso,null), fl=fillsOf(active(),{kind:"clinical",period:o.period,type:o.type||undefined});
  const shortfall=fl.map(f=>{ const cur=(f==="AM"?cov.am:cov.pm)-1, min=(f==="AM"?effStaffing().amMin:effStaffing().pmMin);
    return {f:f,cur:cur,min:min,under:cur<min}; });
  const under=shortfall.filter(x=>x.under);
  return `<div class="card" style="border-left:4px solid var(--leave-t)">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="font-size:var(--fs-md)">Come off a shift · ${escapeHTML(nameOf(o.from))}</h3><span class="grow"></span><span class="tag warn">${daysUntil(o.iso)} days\u2019 notice</span></div>
    <div class="small" style="margin:8px 0"><b>${fmtISO(o.iso)}</b> · ${escapeHTML((o.type?perName(o.type):o.period)+" · "+zoneName(o.zone))} · ${o.kind==="ask"?"asked the admins only":"offered to the group"}</div>
    <div class="small muted">Reason: ${escapeHTML(o.ask.reason)}</div>
    <div class="small muted">${shortfall.map(x=>escapeHTML(perName(x.f))+" cover without them "+x.cur+" · minimum "+x.min).join(" · ")}</div>
    ${under.length?`<div class="note" style="margin-top:6px">${ic("lock")} Letting them off leaves ${fmtISO(o.iso)} below the minimum until someone claims it.</div>`:""}
    ${freeThatDayHTML(o.iso)}
    <div class="flexbtns" style="margin-top:10px"><button class="btn" data-askkeep="${o.id}">Keep them on</button><button class="btn primary" data-askoff="${o.id}">Let them off</button></div>
  </div>`; }
function claimOpenShift(osId,confirmedOver){
  return commitGuarded(()=>{ const o=(S.openShifts||[]).find(x=>x.id===osId);
    if(!o||o.status!=="open")return {ok:false,reason:"Someone claimed it just before you."};
    if(o.kind==="ask")return {ok:false,reason:"That shift isn\u2019t open to claim."};
    const sid=S.viewAs; if(sid==="admin")return {ok:false,reason:"Switch \u201cView as\u201d to a "+ROLE()+" to claim."};
    if(o.cycleId!==S.activeId)return {ok:false,reason:"Switch to that roster cycle first."};
    if(o.kind==="gap"&&roundWaiting(active()))return {ok:false,reason:"Booking opens "+schFmt(active().window.open)+" \u2014 that zone will be on Book shifts then."};   // no early claims ahead of a scheduled opening
    if(o.kind==="giveaway"&&o.from===sid)return {ok:false,reason:"That's your own shift."};
    if(o.kind==="giveaway"&&!osHolds(o))return {ok:false,reason:"The offered shift has changed."};   // a screen can still show a give-away whose shift an import or a fixed pattern has moved
    const c=canClaim(sid,o.iso,o.period,o.zone,S.marketQuotaBypass&&confirmedOver===true,o.kind==="giveaway"?o.from:null,o.type);
    if(!c.ok)return {ok:false,reason:c.reason};
    if(S.marketClaim==="approve"){ o.status="pending"; o.by=sid; o.at=Date.now();
      notify("admin",nameOf(sid)+" wants the "+fmtISO(o.iso)+" "+o.period+" open shift — approve in Settings.","os-pend-"+o.id,{tab:"setup",anchor:"marketCard"});
      logAudit("market.claim.pending",nameOf(sid)+" "+o.iso+" "+o.period,sid);
      _osPushQueue={type:"pending",osId:o.id,title:"Claim to approve",body:nameOf(sid)+" wants "+fmtISO(o.iso)+" "+o.period+".",targets:[]};   // nobody by phone: admins hold no phone subscription of their own (the alerts button is for staff), and they are told in the app
      _settled={kind:"claim",key:"osclaim-"+o.id,id:o.id,cycleId:o.cycleId,iso:o.iso,period:o.period,type:o.type,zone:o.zone,mode:"approve"}; return {ok:true}; }
    const r=_osExecute(o,sid); if(r.ok)_settled={kind:"claim",key:"osclaim-"+o.id,id:o.id,cycleId:o.cycleId,iso:o.iso,period:o.period,type:o.type,zone:o.zone,mode:"first"}; return r;   // the row says what just happened
  },"osclaim-"+osId);
}
function _osExecute(o,sid){
  const cyc=S.cycles.find(c=>c.id===o.cycleId); if(!cyc)return {ok:false,reason:"Cycle missing."};
  let _gh=null;   // the giver's own hours: the claimer works exactly what was offered
  if(o.kind==="giveaway"){ const gk=o.from+"|"+o.iso, ga=cyc.assign[gk];
    if(!ga||ga.kind!=="clinical")return {ok:false,reason:"The offered shift no longer exists."};
    if(!osHolds(o))return {ok:false,reason:"The offered shift has changed."};   // never take the giver's moved shift and hand over the old slot
    _gh=(ga.hours&&hoursOK(ga.hours.start,ga.hours.end))?{start:ga.hours.start,end:ga.hours.end}:null; delete cyc.assign[gk]; }
  const _na=o.type?{kind:"clinical",period:o.period,zone:o.zone,type:o.type}:{kind:"clinical",period:o.period,zone:o.zone}; if(_gh)_na.hours=_gh; cyc.assign[sid+"|"+o.iso]=_na;   // the claimer works exactly what was offered
  o.status="claimed"; o.by=sid; o.at=Date.now(); swTidy();
  if(o.kind==="giveaway"&&o.from)notify(o.from,nameOf(sid)+" took your "+fmtISO(o.iso)+" "+o.period+" shift — you're off that day.",null,{tab:"my"});
  notify("admin",nameOf(sid)+" claimed the "+fmtISO(o.iso)+" "+o.period+" "+(o.kind==="giveaway"?"give-away":"open shift")+".","os-done-"+o.id,{tab:"setup",anchor:"marketCard"});
  logAudit("market.claim",nameOf(sid)+" claimed "+o.iso+" "+o.period+" "+zoneName(o.zone),sid);
  _osPushQueue={type:"claimed",osId:o.id,title:"Shift claimed",body:nameOf(sid)+" took "+fmtISO(o.iso)+" "+o.period+".",targets:o.kind==="giveaway"&&o.from?[o.from]:[]};   // the giver's phones; a claimed gap has nobody to alert, and the admin is told in the app
  return {ok:true};
}
function approveClaim(osId,ok){
  return commitGuarded(()=>{ if(!isAdmin())return {ok:false,reason:"Admin only."};
    const o=(S.openShifts||[]).find(x=>x.id===osId);
    if(!o||o.status!=="pending"||!o.by)return {ok:false,reason:"Nothing pending."};
    if(!ok){ const was=o.by; o.status="open"; o.by=null; o.at=null;
      notify(was,"Your claim on "+fmtISO(o.iso)+" "+o.period+" wasn't approved — the shift is open again.",null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"});
      logAudit("market.decline",nameOf(was)+" "+o.iso+" "+o.period,"admin"); return {ok:true}; }
    const sid=o.by, c=canClaim(sid,o.iso,o.period,o.zone,S.marketQuotaBypass,o.kind==="giveaway"?o.from:null,o.type);
    if(!c.ok){ o.status="open"; o.by=null; o.at=null; const why=c.reason.replace(/^You're /,nameOf(sid)+" is ").replace(/^You've reached your /,nameOf(sid)+" has reached their "); return {ok:false,reason:"Can't approve — "+why+" Reopened."}; }
    const r=_osExecute(o,sid); if(r.ok){ notify(sid,"Approved — "+fmtISO(o.iso)+" "+o.period+" is yours.",null,{tab:"my"}); logAudit("market.approve",nameOf(sid)+" "+o.iso+" "+o.period,"admin"); }
    return r; });
}
function askOn(sid,isoD){ return (S.openShifts||[]).some(o=>o&&o.ask&&o.ask.status==="pending"&&o.from===sid&&o.iso===isoD&&o.status==="open"); }
function offeredAlready(sid,isoD){ return (S.openShifts||[]).some(o=>o.kind==="giveaway"&&o.from===sid&&o.iso===isoD&&(o.status==="open"||o.status==="pending")); }
function osHolds(o){ return swSame(swShiftOf(swCycleOf(o),o&&o.from,o&&o.iso),o); }   // a give-away or an ask to come off stands only while its giver still holds that very shift (period, zone and type), in the record's own cycle
function osTidy(){ const today=iso(new Date());   // swTidy runs it first: withdraw each give-away and ask to come off, from today on, whose giver no longer holds that shift, and tell anyone waiting to claim it
  (S.openShifts||[]).forEach(o=>{ if(!o||(o.kind!=="giveaway"&&o.kind!=="ask")||(o.status!=="open"&&o.status!=="pending")||o.iso<today||osHolds(o))return;
    if(o.status==="pending"&&o.by)notify(o.by,"The "+fmtISO(o.iso)+" "+o.period+" offer was withdrawn.",null,{tab:"my",cycle:o.cycleId,anchor:"openshifts"});
    o.status="withdrawn"; if(o.ask&&o.ask.status==="pending")o.ask.status="withdrawn";
    logAudit("market.withdraw",nameOf(o.from)+" "+o.iso+" "+o.period+" \u00b7 the shift moved",S.viewAs); }); }
function marketOfferBtn(sid,isoD,sh){
  if(!featOn("marketplace")||!S.marketOn||isAdmin()||sid!==S.viewAs)return "";
  if(!sh||sh.kind!=="clinical"||isoD<iso(new Date()))return "";   // a fixed shift may be given away too (10 Oct 2026): nobody comes off until a colleague takes it, and the drift shows the move
  if(active().status==="draft"||active().archived)return "";
  if(!sh.fixed&&(roundOpenNow()||roundWaiting(active())))return "";   // while a round is open (or about to open) a self-booked shift is simply removed and the slot is back on Book shifts; only a fixed shift still needs a taker (16 Oct 2026)
  const already=offeredAlready(sid,isoD);
  return already?' <span class="tag warn" style="margin-left:6px">offered</span>':askOn(sid,isoD)?' <span class="tag warn" style="margin-left:6px">asked</span>':' <button class="btn sm" data-osoffer="'+isoD+'" style="margin-left:6px">'+ic("arrowUR")+' Offer to group</button>';
}
function roundOpenNow(){ const c=active(); return !!c&&!isRolling(c)&&roundEffOpen(c); }   // a rounds roster with booking open: every free zone is on Book shifts, so a broadcast gap has nothing to add there
function osForStaff(){ const ro=(roundOpenNow()||roundWaiting(active()))&&!isAdmin(); return osActive().filter(o=>!(ro&&o.kind==="gap")); }   // the admin keeps seeing them, with Withdraw   // and not while the round is closed with its opening scheduled ahead: the slot will be on Book shifts at the opening, and nobody takes it early from here   // what the staff card and its counts show: no gaps while the round is open (they come back if still open when it closes); a colleague's offer always
function marketMyHTML(){
  const sid=S.viewAs, roundOpen=roundOpenNow();
  const list=osForStaff().filter(o=>o.status==="open"||(o.status==="pending"&&(o.by===sid||o.from===sid||isAdmin())));
  const pushBtn=(S.pushOn&&cloudOn()&&CLOUD.vapidPublic&&!isAdmin())?('<div style="margin-top:8px">'+(myPushSub()?'<button class="btn sm" id="pushOff">'+ic("bellOff")+' Alerts on this phone: ON \u2014 turn off</button>':'<button class="btn sm" id="pushOnBtn">'+ic("bell")+' Get open-shift alerts on this phone</button>')+'</div>'):"";
  const settledRow=(_settled&&_settled.kind==="claim"&&(!_settled.cycleId||_settled.cycleId===S.activeId))?(()=>{ const busy=_inflight.has(_settled.key), lbl=fmtISO(_settled.iso)+" "+perName(_settled.type||_settled.period)+" \u00b7 "+zoneName(_settled.zone);
      const txt=busy?("Claiming "+lbl+"\u2026"):(_settled.mode==="approve"?("Asked for "+lbl+" \u2014 your admin decides. You'll be told."):(lbl+" is yours \u2014 it's on your roster."));
      return '<div class="listrow settled'+(busy?' busy':'')+'" role="status"><span class="rcic" aria-hidden="true">'+(busy?'<span class="sdot busy"></span>':ic("check"))+'</span><span class="grow">'+escapeHTML(txt)+'</span>'+((busy||_settled.mode==="approve")?"":'<button class="btn sm" data-go="'+goStr("my",_settled.cycleId||"","")+'">See it</button>')+'</div>'; })():"";
  const nothing=roundOpen?('While the round is open, every free zone is on Book shifts \u2014 nothing to claim here. A shift a colleague offers would still appear.'):roundWaiting(active())?('Booking opens '+schFmt(active().window.open)+' \u2014 every free zone will be on Book shifts then. A shift a colleague offers would still appear here.'):('Nothing '+(settledRow?'else ':'')+'open right now. When a gap is broadcast or a colleague offers a shift, it appears here'+(S.pushOn?" (and on your phone if alerts are on)":"")+'.');
  if(!list.length)return '<div class="card" id="openshifts"><h2>Open shifts</h2>'+settledRow+'<div class="sub">'+nothing+'</div>'+pushBtn+'</div>';
  return '<div class="card" id="openshifts"><h2>Open shifts</h2>'+settledRow+'<div class="sub">Shifts a colleague has given up, or cover your admin has asked for \u2014 not the round itself, which is on Book shifts. '+(S.marketClaim==="approve"?"Claims are confirmed by the admin":"First to claim takes it")+' \u2014 same checks as any booking.</div>'
    +list.map(o=>{ const mine=o.from===sid;
      const c=(o.status==="open"&&!mine&&sid!=="admin")?canClaim(sid,o.iso,o.period,o.zone,true,o.kind==="giveaway"?o.from:null,o.type):null;
      const status=o.status==="pending"?(o.by===sid?'<span class="tag warn">waiting for admin</span>':'<span class="tag warn">claim pending \u2014 '+escapeHTML(nameOf(o.by))+'</span>'):"";
      const btn=o.status==="open"?(mine?('<button class="btn sm" data-oswd="'+o.id+'">Withdraw</button>'):(sid==="admin"?('<button class="btn sm" data-oswd="'+o.id+'">Withdraw</button>'):(c&&!c.ok?('<span class="muted small">'+escapeHTML(c.reason)+'</span>'):(_inflight.has("osclaim-"+o.id)?'<button class="btn primary sm" disabled aria-busy="true">Claiming\u2026</button>':('<button class="btn primary sm" data-osclaim="'+o.id+'">Claim</button>'))))):"";
      return '<div class="listrow"><span><b>'+fmtISO(o.iso)+'</b> '+escapeHTML(osTypeName(o))+' \u00b7 '+escapeHTML(zoneName(o.zone))+(o.kind==="giveaway"?' \u2014 <span class="muted">offered by '+escapeHTML(nameOf(o.from))+'</span>':"")+(o.note?' \u00b7 <span class="muted">'+escapeHTML(o.note)+'</span>':"")+osNeedsHTML(o)+'</span><span class="grow"></span>'+status+btn+'</div>'; }).join("")
    +pushBtn+'</div>';
}
function marketCardHTML(){
  const pend=(S.openShifts||[]).filter(o=>o.status==="pending"&&(o.kind!=="giveaway"||osHolds(o)));   // a waiting claim on a give-away whose shift has moved cannot be approved, so it is not listed
  const openList=osActive().filter(o=>o.status==="open");
  const zopts=(S.zones||[]).filter(z=>z.am).map(z=>'<option value="'+z.id+'">'+escapeHTML(z.name)+'</option>').join("");
  return '<div class="card" id="marketCard">'
    +'<h2>Open-shift marketplace</h2>'
    +'<div class="sub">Broadcast a gap to the whole group, and let staff hand a shift they can\u2019t do back to the group. Claims pass the same guards as any booking (leave, double-booking, zone, fatigue'+(S.marketQuotaBypass?"":", quota")+').</div>'
    +'<div class="seg" id="mkOnSeg" style="margin:8px 0"><button data-mk="on" class="'+(S.marketOn?"on":"")+'">On</button><button data-mk="off" class="'+(S.marketOn?"":"on")+'">Off</button></div>'
    +(S.marketOn?(
      '<div class="row">'
      +'<div class="field" role="group" aria-labelledby="lbl-mkClaimSeg"><span class="lbl" id="lbl-mkClaimSeg">Claims</span><div class="seg" id="mkClaimSeg" aria-labelledby="lbl-mkClaimSeg"><button data-mc="instant" class="'+((S.marketClaim||"instant")==="instant"?"on":"")+'">First-come wins</button><button data-mc="approve" class="'+(S.marketClaim==="approve"?"on":"")+'">Admin approves</button></div></div>'
      +'<div class="field" role="group" aria-labelledby="lbl-mkQSeg"><span class="lbl" id="lbl-mkQSeg">Over-quota gap fill</span><div class="seg" id="mkQSeg" aria-labelledby="lbl-mkQSeg"><button data-mq="yes" class="'+(S.marketQuotaBypass?"on":"")+'">Allowed (confirm)</button><button data-mq="no" class="'+(S.marketQuotaBypass?"":"on")+'">Blocked</button></div></div>'
      +'</div>'
      +'<div class="row" style="align-items:flex-end">'
      +'<label class="field"><span class="lbl">Date</span><input type="date" id="mkDate"></label>'
      +'<label class="field"><span class="lbl">Period</span><select id="mkPeriod"><option>AM</option><option>PM</option></select></label>'
      +'<label class="field"><span class="lbl">Zone</span><select id="mkZone">'+zopts+'</select></label>'
      +'<label class="field grow"><span class="lbl">Note (optional)</span><input id="mkNote" placeholder="e.g. sick cover needed"></label>'
      +'<button class="btn primary" id="mkPost">Broadcast open shift</button>'
      +'</div>'
      +(pend.length?('<div class="sub" style="margin-top:10px"><b>Waiting for approval</b></div>'+pend.map(o=>'<div class="listrow"><span>'+fmtISO(o.iso)+' '+escapeHTML(osTypeName(o))+' \u00b7 '+escapeHTML(zoneName(o.zone))+' \u2014 <b>'+escapeHTML(nameOf(o.by))+'</b>'+(o.kind==="giveaway"?' (from '+escapeHTML(nameOf(o.from))+')':"")+'</span><span class="grow"></span><button class="btn sm" data-osok="'+o.id+'">Approve</button><button class="btn danger sm" data-osno="'+o.id+'">Decline</button></div>').join("")):"")
      +(openList.length?('<div class="sub" style="margin-top:10px"><b>Open now</b></div>'+openList.map(o=>'<div class="listrow"><span>'+fmtISO(o.iso)+' '+escapeHTML(osTypeName(o))+' \u00b7 '+escapeHTML(zoneName(o.zone))+(o.kind==="giveaway"?' \u2014 offered by '+escapeHTML(nameOf(o.from)):"")+(o.note?' \u00b7 '+escapeHTML(o.note):"")+'</span><span class="grow"></span><button class="btn danger sm" data-oswd="'+o.id+'">Withdraw</button></div>').join("")):'<div class="muted small" style="margin-top:8px">Nothing open right now.</div>')
      +'<div class="sub" style="margin-top:12px"><b>Phone notifications (web push)</b></div>'
      +'<div class="seg" id="pushSeg"><button data-po="on" class="'+(S.pushOn?"on":"")+'">On</button><button data-po="off" class="'+(S.pushOn?"":"on")+'">Off</button></div>'
      +'<div class="muted small" style="margin-top:4px">'+(S.pushOn?(CLOUD.vapidPublic?"Staff enable it per phone on My shifts. Needs the push-send function deployed once \u2014 see PUSH-MARKETPLACE.md.":"Add the VAPID key to the app config first (PUSH-MARKETPLACE.md)."):"Off \u2014 open shifts still ring the in-app bell.")+'</div>'
    ):"")
    +'</div>';
}
/* ----- request threads (query + comments before a decision) ----- */
function reqKindLabel(r){ return r.type==="swap"?"swap":r.type==="fixed"?"pattern":"leave"; }
function reqThread(reqId){ return (S.reqComments||[]).filter(c=>c.reqId===reqId).sort((a,b)=>a.ts-b.ts); }
function addReqComment(reqId,text){
  const r=S.requests.find(x=>x.id===reqId); if(!r){toast("Request gone.");return false;}
  if(!["pending","info","awaiting-peer"].includes(r.status)){toast("This request is decided — the conversation is closed.");return false;}
  const me=S.viewAs;
  if(!(isAdmin()||r.from===me||(r.type==="swap"&&r.peerId===me))){toast("Not your request.","danger");return false;}
  const t=String(text||"").trim(); if(!t){toast("Write a comment first.");return false;}
  (S.reqComments=S.reqComments||[]).push({id:"rc"+Date.now()+Math.random().toString(36).slice(2,5),reqId:reqId,by:isAdmin()?"admin":me,text:t.slice(0,500),ts:Date.now()});
  if(isAdmin()){ notify(r.from,"Admin commented on your "+reqKindLabel(r)+" request: "+t.slice(0,80),null,{tab:"requests"}); }
  else{ if(r.status==="info")r.status="pending";   // their answer puts it back in the admin's court
        notify("admin",nameOf(me)+" replied on their "+reqKindLabel(r)+" request: "+t.slice(0,80),null,{tab:"requests"}); }
  save(); render(); return true;
}
function askReqInfo(reqId,text){
  if(!isAdmin())return false;
  const r=S.requests.find(x=>x.id===reqId); if(!r||r.status!=="pending"){toast("Only pending requests can be queried.");return false;}
  const t=String(text||"").trim(); if(!t){toast("Type your question in the comment box first, then tap Ask.");return false;}
  (S.reqComments=S.reqComments||[]).push({id:"rc"+Date.now()+Math.random().toString(36).slice(2,5),reqId:reqId,by:"admin",text:t.slice(0,500),ts:Date.now()});
  r.status="info";
  notify(r.from,"Your "+reqKindLabel(r)+" request needs more info — see Requests: "+t.slice(0,80),null,{tab:"requests"});
  logAudit("request.query",nameOf(r.from)+" · "+t.slice(0,60),"admin");
  save(); render();
  if(S.pushOn&&cloudOn()&&CLOUD.vapidPublic){ try{ pushSendEvent("Question about your request",t.slice(0,120),[r.from],"rq-"+reqId); }catch(e){} }
  return true;
}
function reqThreadHTML(r,editable){
  const th=reqThread(r.id);
  const rows=th.map(c=>'<div class="rcrow'+(c.by==="admin"?" adm":"")+'"><b>'+escapeHTML(c.by==="admin"?"Admin":nameOf(c.by))+'</b> <span class="muted small">'+tsFmt(c.ts)+'</span><div>'+escapeHTML(c.text)+'</div></div>').join("");
  const box=editable?('<div class="row" style="margin-top:6px"><div class="field grow"><input id="rc-'+r.id+'" placeholder="Reply to the admin…" maxlength="500"></div><button class="btn sm" data-rcadd="'+r.id+'">Send</button></div>'):"";
  if(!rows&&!box)return "";
  return '<div class="rcthread">'+(rows?('<div class="sub" style="margin:6px 0 2px"><b>Conversation</b></div>'+rows):"")+box+'</div>';
}
/* ----- web push (phones hear about open shifts even with the app closed) ----- */
let _osPushQueue=null;
function _osFlushPush(){ const q=_osPushQueue; _osPushQueue=null; if(!q||!S.pushOn||!cloudOn()||!CLOUD.vapidPublic)return;
  if(Array.isArray(q.targets)&&!q.targets.length)return;   // an empty audience is nobody; only null means the whole group
  try{ pushSendEvent(q.title,q.body,q.targets,"os-"+q.type+"-"+q.osId); }catch(e){} }
function _pushDeviceKey(){ try{ let k=localStorage.getItem(KEY+"_pushdev"); if(!k){k="d"+Date.now()+Math.random().toString(36).slice(2,8);localStorage.setItem(KEY+"_pushdev",k);} return k; }catch(e){ return "d0"; } }
function myPushSub(){ const sid=S.viewAs; const dk=_pushDeviceKey(); return (S.pushSubs||[]).find(p=>p.staffId===sid&&p.deviceKey===dk); }
function _b64ToU8(b64){ const pad="=".repeat((4-b64.length%4)%4); const raw=atob((b64+pad).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
async function pushEnable(){
  if(!(S.pushOn&&cloudOn()&&CLOUD.vapidPublic)){ toast("Push isn't switched on for this organisation yet."); return; }
  if(!("serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window)){ toast("This browser can't do notifications."); return; }
  const iosNotInstalled=iosNeedsInstall();
  if(iosNotInstalled){ toast("First add Myrosta to your Home Screen (Share \u2192 Add to Home Screen), then open it from the icon and tap this again."); return; }
  const perm=await Notification.requestPermission(); if(perm!=="granted"){ toast("Notifications are blocked for this site."); return; }
  let reg=null; try{ reg=await navigator.serviceWorker.register("sw.js"); }catch(e){ console.error("sw",e); }
  if(!reg){ toast("Couldn't set up notifications."); return; }
  try{ const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:_b64ToU8(CLOUD.vapidPublic)});
    const j=sub.toJSON(), sid=S.viewAs, dk=_pushDeviceKey();
    commitGuarded(()=>{ S.pushSubs=(S.pushSubs||[]).filter(p=>!(p.staffId===sid&&p.deviceKey===dk));
      S.pushSubs.unshift({id:"ps-"+dk+"-"+sid,staffId:sid,deviceKey:dk,sub:j,ua:(navigator.userAgent||"").slice(0,80),ts:Date.now()});
      logAudit("push.on",nameOf(sid)+" enabled phone alerts",sid); return {ok:true}; });
    toast("Alerts on \u2014 this phone will now hear about open shifts.","ok");
  }catch(e){ console.error(e); toast("Couldn't subscribe this device."); }
}
async function pushDisable(){
  try{ const reg=await navigator.serviceWorker.getRegistration("sw.js"); const sub=reg&&await reg.pushManager.getSubscription(); if(sub)await sub.unsubscribe(); }catch(e){}
  const sid=S.viewAs, dk=_pushDeviceKey();
  commitGuarded(()=>{ S.pushSubs=(S.pushSubs||[]).filter(p=>!(p.staffId===sid&&p.deviceKey===dk));
    logAudit("push.off",nameOf(sid)+" disabled phone alerts",sid); return {ok:true}; });
}
async function pushSendEvent(title,body,targets,tag){
  if(Array.isArray(targets)&&!targets.length)return;   // nobody to tell: push-send would read a missing audience as every phone in the group
  try{ const {data}=await _sb.auth.getSession(); const tok=data&&data.session&&data.session.access_token; if(!tok)return;
    fetch(CLOUD.url+"/functions/v1/push-send",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":CLOUD.key},
      body:JSON.stringify({org:_org,title:title,body:body,targets:Array.isArray(targets)?targets:null,tag:tag,exclude:S.viewAs})}).catch(()=>{});
  }catch(e){}
}
function whoseTurn(){const d=active().draft;if(!d)return null;return draftOrder()[d.turnIdx]||null;}
function advanceTurn(){const d=active().draft;if(!d)return;d.turnIdx++;if(d.turnIdx>=d.base.length){d.round++;d.turnIdx=0;}save();}
function stopRounds(){active().draft=null;save();}

/* ---------- cohort waves ---------- */
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}
function startWaves(){ const ids=shuffle(rosterStaff().map(s=>s.id)); const n=Math.max(2,Math.min(4,S.waveCount||3));
  const cohorts=Array.from({length:n},()=>[]); ids.forEach((id,i)=>cohorts[i%n].push(id));
  active().waveState={cohorts:cohorts, order:shuffle(cohorts.map((_,i)=>i)), current:0, done:{}};
  notify("all","Booking has opened in random groups. Group 1 is picking now.",null,{tab:"selfroster"}); logAudit("selfroster.waves","started "+n+" random groups","admin"); save(); }
function stopWaves(){active().waveState=null;logAudit("selfroster.waves","stopped","admin");save();}
function waveCohortAt(pos){const w=active().waveState;return (w&&w.cohorts[w.order[pos]])||[];}
function currentCohort(){const w=active().waveState;return w?waveCohortAt(w.current):[];}
function wavePosOf(sid){const w=active().waveState;if(!w)return -1;for(let p=0;p<w.order.length;p++){if((w.cohorts[w.order[p]]||[]).includes(sid))return p;}return -1;}
function isWaveOpen(sid){const w=active().waveState;return !!w&&currentCohort().includes(sid);}
function quotaMet(sid){const s=S.staff.find(x=>x.id===sid);if(!s)return false;
  if(S.quotaFlex && !(s.periodTargets&&Object.keys(s.periodTargets).length))return clinicalCountFor(sid)>=(s.quota||0);
  return cyclePeriods().every(p=>bookedInPeriod(sid,p)>=periodTarget(s,p.index));}
function waveAllSettled(){const w=active().waveState;if(!w)return false;return currentCohort().every(sid=>(w.done&&w.done[sid])||quotaMet(sid));}
function advanceWave(){const w=active().waveState;if(!w)return;if(w.current<w.order.length-1){w.current++;notify("all","Group "+(w.current+1)+" is picking now.",null,{tab:"selfroster"});logAudit("selfroster.wave.advance","wave "+(w.current+1)+" opened","admin");}else{logAudit("selfroster.wave.advance","all waves complete","admin");}save();}
function setWaveDone(sid,v){const w=active().waveState;if(!w)return;w.done=w.done||{};if(v)w.done[sid]=true;else delete w.done[sid];logAudit("selfroster.wave.done",nameOf(sid)+(v?" done":" reopened"),sid);save();}
function fairnessLabel(f){f=f||S.fairness;return {snake:"Take turns",guarded:"Everyone at once",waves:"In random groups",adjust:"Pre-filled, then adjust"}[f]||f;}   // named by what a person experiences; the technical name is a hint for the admin
function fairnessTech(f){f=f||S.fairness;return {snake:"snake-draft rounds",guarded:"guarded free-for-all",waves:"cohort waves",adjust:"auto-draft + adjust"}[f]||"";}
function waveControlHTML(cyc){ const w=cyc.waveState;
  if(!w)return `<div class="flexbtns" style="margin-top:8px"><button class="btn primary" id="wvStart">Draw ${S.waveCount||3} random groups and start</button></div>`;
  const chips=w.order.map((ci,pos)=>{const mem=w.cohorts[ci]||[];const settled=mem.filter(id=>(w.done&&w.done[id])||quotaMet(id)).length;
    return `<span class="tag ${pos===w.current?"warn":"muted"}" title="${escapeHTML(mem.map(nameOf).join(", "))}">Group ${pos+1}${pos===w.current?" · picking now":""} · ${settled} of ${mem.length} done</span>`;}).join(" ");
  const last=w.current>=w.order.length-1;
  return `<div style="margin-top:8px">${chips}</div>
    <div class="flexbtns" style="margin-top:8px">
      ${last?'<span class="tag ok">last group is picking</span>':`<button class="btn primary" id="wvNext">Open the next group${waveAllSettled()?" — everyone's done "+ic("check"):""}</button>`}
      <button class="btn sm" id="wvReassign">Re-draw the groups</button>
      <button class="btn danger sm" id="wvStop">Stop the groups</button>
    </div>`; }
function waveScheduleHTML(sid){ const w=active().waveState; if(!w)return ""; const mine=wavePosOf(sid);
  return `<div class="cluster" style="margin:6px 0">${w.order.map((ci,pos)=>`<span class="tag ${pos===w.current?"warn":(pos===mine?"ok":"muted")}">Group ${pos+1}${pos===w.current?" · open":""}${pos===mine?" · you":""}</span>`).join("")}</div>`; }

/* ---------- fixed patterns (weekly + fortnightly A/B) ---------- */
let _fpDraft={};            // sid -> in-progress edit copy (survives re-render)
let _fpOpen=new Set();      // which staff editors are expanded on the Staff tab
let _staffOpen=new Set();   // which staff rows are expanded to the roomy detail view
const WD_ORDER=[1,2,3,4,5,6,0]; // Mon..Sun (getDay() indices)
function emptyPattern(){return {recurrence:"weekly",A:{},B:{},C:{},D:{},M:[],committed:false};}   // weeks A–D for the weekly, fortnightly and every-4-weeks recurrences; M = the calendar-month rules
const FP_WEEKS={weekly:["A"],fortnightly:["A","B"],fourweekly:["A","B","C","D"],monthly:[]}, FP_N={weekly:1,fortnightly:2,fourweekly:4}, FP_NTH={1:"1st",2:"2nd",3:"3rd",4:"4th",last:"last"};
function fpWeeksOf(fp){ return FP_WEEKS[(fp&&fp.recurrence)||"weekly"]||["A"]; }
function fpTypes(cyc){ const c=cyc||active(), out=bookableTypes(c).map(t=>({id:t.id,label:t.label||t.id})); const cst=typeById(c,"CST"); if(cst&&cst.on!==false)out.push({id:"CST",label:cst.label||"CST"}); return out; }   // what a pattern may name: the cycle's clinical types (a full shift among them) and its non-clinical block
function fpSlotFrom(val,cyc){ if(!val)return null; if(val==="CST")return {period:"CST"}; const t=typeById(cyc||active(),val); if(!t||!t.fills||!t.fills.length)return {period:val}; return typeIsDefault(t)?{period:t.fills[0]}:{period:t.fills[0],type:t.id}; }   // the half it fills, and the type's id when it is not a built-in half
function fpSlotKey(slot){ return slot?(slot.type||slot.period||""):""; }
function fpSlotLabel(slot,cyc){ if(!slot||!slot.period)return ""; const c=cyc||active(); if(slot.period==="CST"){ const t=typeById(c,"CST"); return (t&&t.label)||"CST"; } const t=typeById(c,slot.type||slot.period); return (t&&t.label)||slot.period; }
function cycleWeekN(isoD,n){const ds=cycleDates();const wk=Math.floor(Math.round((parseISO(isoD)-ds[0])/864e5)/7);return "ABCD"[((wk%n)+n)%n];}   // the week letter of a date, counting cycle weeks from the start; round the DAY count first (a DST day is 23/25 h)
function cycleWeekAB(isoD){ return cycleWeekN(isoD,2); }
function nthWeekdayOf(isoD){ const d=parseISO(isoD), last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); return {nth:Math.floor((d.getDate()-1)/7)+1, last:d.getDate()+7>last}; }   // "the 2nd Wednesday", and whether it is the month's last one
function fpWeekHeading(wk,n){ const total=(active().cycle||{}).weeks||8, i="ABCD".indexOf(wk), list=[]; for(let w=1;w<=total;w++) if((w-1)%n===i) list.push(w); return "Week "+wk+" \u2014 cycle week"+(list.length===1?" ":"s ")+list.join(", "); }   // from the cycle's own length, so a 12-week cycle reads 1, 5, 9   // round the DAY count first: across a DST change a "day" is 23/25h, and flooring raw ms puts every later date in the wrong week
function fixedSlotFor(s,isoD){ if(!s||(s.mode!=="fixed"&&s.mode!=="preference"))return null; const fp=s.fixedPattern; if(!fp)return null;
  const wd=String(parseISO(isoD).getDay()); let slot=null;
  if(fp.recurrence==="monthly"){ const k=nthWeekdayOf(isoD); slot=(fp.M||[]).find(r=>String(r.wd)===wd&&r.period&&(r.nth==="last"?k.last:+r.nth===k.nth))||null; }   // the first Wednesday, the last Saturday: of each calendar month the cycle touches
  else { const n=FP_N[fp.recurrence]||1; slot=(fp[n>1?cycleWeekN(isoD,n):"A"]||{})[wd]||null; }
  if(!slot||!slot.period)return null; return Object.assign({period:slot.period,zone:slot.zone||""},slot.type?{type:slot.type}:{}); }  // zone "" = any (auto-balanced); a type beyond the two halves travels with the slot
function balancedZoneFor(sid,period,free){   // free = zone objects still open that day/period; pick the one this person has done least (tie-break: least-used overall)
  const mine={},all={}; free.forEach(z=>{mine[z.id]=0;all[z.id]=0;});
  cycleDates().forEach(d=>{ const isoD=iso(d); S.staff.forEach(s2=>{ const sh=getShift(s2.id,isoD); if(sh.kind==="clinical"&&all[sh.zone]!=null){ all[sh.zone]++; if(s2.id===sid)mine[sh.zone]++; } }); });
  return free.slice().sort((x,y)=>(mine[x.id]-mine[y.id])||(all[x.id]-all[y.id]))[0]; }
let _fpReport=null;   // last applyFixedPatterns run: {placed, conflicts:[], gaps:[]}
/* ---------- the Fixed cover view (10 Oct 2026): what the patterns alone would place in the active cycle, the weekday summary, the drift ---------- */
function fixedProjection(cyc,soft){ const out={}, ds=cycleDates();   // locked fixed patterns; with soft, drafts and preference patterns too
  S.staff.filter(s=>inCycle(s)&&s.fixedPattern&&(s.mode==="fixed"||(soft&&s.mode==="preference"))&&(s.fixedPattern.committed||soft)).forEach(s=>{ const hard=s.mode==="fixed"&&!!s.fixedPattern.committed;
    ds.forEach(d=>{ const isoD=iso(d), slot=fixedSlotFor(s,isoD); if(slot)out[s.id+"|"+isoD]=Object.assign({sid:s.id,iso:isoD,period:slot.period,zone:slot.zone||"",soft:!hard},slot.type?{type:slot.type}:{}); }); });
  return out; }
function fixedCoverStats(cyc,proj){ const ds=cycleDates(), st=effStaffing(), per={}; ds.forEach(d=>{ per[iso(d)]={AM:0,PM:0,zAM:new Set(),zPM:new Set()}; });
  Object.values(proj).forEach(e=>{ const p=per[e.iso]; if(!p||e.period==="CST")return; fillsOf(cyc,Object.assign({kind:"clinical",period:e.period},e.type?{type:e.type}:{})).forEach(f=>{ p[f]=(p[f]||0)+1; (f==="AM"?p.zAM:p.zPM).add(e.zone?zoneName(e.zone):"any"); }); });   // a full shift counts in both halves; a non-clinical block in neither
  const rows=[]; WD_ORDER.forEach(wd=>["AM","PM"].forEach(half=>{ const min=half==="AM"?st.amMin:st.pmMin, dates=ds.filter(d=>d.getDay()===wd), zones=new Set(); let covered=0, short=0;
    dates.forEach(d=>{ const p=per[iso(d)], n=p[half]; if(n>=min)covered++; short+=Math.max(0,min-n); (half==="AM"?p.zAM:p.zPM).forEach(z=>zones.add(z)); });
    rows.push({wd,half,dates:dates.length,covered,short,min,zones:[...zones].sort()}); }));
  return {per,rows,amMin:st.amMin,pmMin:st.pmMin,totalShort:rows.reduce((a,r)=>a+r.short,0)}; }
function fixedDrift(cyc,proj){ const a=cyc.assign||{}, items=[]; let total=0;   // the locked fixed shifts the patterns place, against the roster now
  Object.values(proj).forEach(e=>{ if(e.soft)return; total++; const sh=a[e.sid+"|"+e.iso]; let what=null;
    if(e.period==="CST"){ if(!sh||sh.kind!=="cst")what=(sh&&sh.kind==="clinical")?"moved":((sh&&sh.kind==="leave")||leaveOn(e.sid,e.iso)?"leave":"removed"); }
    else if(!sh||sh.kind!=="clinical")what=(sh&&sh.kind==="leave")||leaveOn(e.sid,e.iso)?"leave":(sh&&sh.kind==="cst")?"CST":"removed";
    else if(sh.period!==e.period||(e.zone&&sh.zone!==e.zone)||(e.type||"")!==(sh.type||""))what="moved";
    if(what)items.push({sid:e.sid,iso:e.iso,what,was:fpSlotLabel(e,cyc)+(e.period==="CST"?"":" "+(e.zone?zoneName(e.zone):"any")),now:(sh&&sh.kind==="clinical")?sh.period+" "+zoneName(sh.zone):(sh?sh.kind+(sh.code?" "+sh.code:""):(what==="leave"?"leave":"off"))}); });
  const byWd={}; items.forEach(i=>{ const k=DOW[parseISO(i.iso).getDay()]; byWd[k]=(byWd[k]||0)+1; });
  return {total,changed:items.length,items:items.sort((x,y)=>x.iso<y.iso?-1:x.iso>y.iso?1:0),byWd}; }
function exportFixedCoverXLSX(){ if(typeof XLSX==="undefined"){toast("Spreadsheet library not loaded — check your internet connection, then retry.");return;}
  const c=active(), ds=cycleDates(), proj=fixedProjection(c,fixedSoft), stats=fixedCoverStats(c,proj), drift=fixedDrift(c,proj);
  const hdr=["Name"].concat(ds.map(d=>DOW[d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1)));
  const people=[...new Set(Object.values(proj).map(e=>e.sid))].map(id=>S.staff.find(x=>x.id===id)).filter(Boolean).sort((x,y)=>x.name.localeCompare(y.name));
  const grid=[hdr].concat(people.map(s=>[s.name].concat(ds.map(d=>{ const e=proj[s.id+"|"+iso(d)]; return e?(fpSlotLabel(e,c)+(e.period==="CST"?"":" "+(e.zone?zoneName(e.zone):"any"))+(e.soft?" (soft)":"")):""; }))));
  grid.push(["Fixed cover AM"].concat(ds.map(d=>stats.per[iso(d)].AM)),["Fixed cover PM"].concat(ds.map(d=>stats.per[iso(d)].PM)),["Minimum AM / PM"].concat(ds.map(()=>stats.amMin+" / "+stats.pmMin)));
  const summ=[["Day","Half","Dates","Covered to minimum","Shortfall (shifts)","Zones held"]].concat(stats.rows.map(r=>[DOW[r.wd],r.half,r.dates,r.covered,r.short,r.zones.join(", ")]));
  const dr=[["Who","Date","Pattern","Roster now","Change"]].concat(drift.items.map(i=>[nameOf(i.sid),i.iso,i.was,i.now,i.what]));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(grid),"Fixed cover"); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summ),"Weekday summary"); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dr),"Drift");
  XLSX.writeFile(wb,"fixed-cover-"+c.cycle.start+".xlsx"); logAudit("export.fixedcover",cyLabel(c),"admin"); }
function applyFixedPatterns(){ // seed fixed (locked) + preference (soft) shifts where the day is free
  let placed=0; const a=active().assign, conflicts=[], gaps=[], pending=[];
  const staff=S.staff.filter(s=>(s.mode==="fixed"||s.mode==="preference")&&inCycle(s));
  const dlabel=isoD=>{const dt=parseISO(isoD);return DOW[dt.getDay()]+" "+dt.getDate()+"/"+(dt.getMonth()+1);};
  // Pass 1 — place every explicit pin (period + zone); defer period-only slots to pass 2
  const _cy=active(), _fills=slot=>fillsOf(_cy,Object.assign({kind:"clinical",period:slot.period},slot.type?{type:slot.type}:{}));   // a full shift fills both halves: both must be free
  staff.forEach(s=>{ cycleDates().forEach(d=>{ const isoD=iso(d), slot=fixedSlotFor(s,isoD); if(!slot)return;
      if(getShift(s.id,isoD).kind!=="off")return;                                  // leave / existing shift wins
      if(slot.period==="CST"){ a[s.id+"|"+isoD]={kind:"cst",fixed:(s.mode==="fixed")}; placed++; return; }   // the non-clinical block: no zone, no cover
      if(slot.zone){ const _tk=_fills(slot).find(f=>zoneTaken(isoD,f,slot.zone,s.id)); if(_tk){ conflicts.push(nameOf(s.id)+" "+dlabel(isoD)+" "+fpSlotLabel(slot,_cy)+" · "+(zoneById(slot.zone)?zoneById(slot.zone).name:"?")+" (zone taken)"); return; }
          a[s.id+"|"+isoD]=Object.assign({kind:"clinical",period:slot.period,zone:slot.zone,fixed:(s.mode==="fixed")},slot.type?{type:slot.type}:{}); placed++; }
      else pending.push({s:s,isoD:isoD,period:slot.period,type:slot.type,fills:_fills(slot)}); }); });
  // Pass 2 — fill period-only slots into a balanced free zone (after pins are locked)
  pending.forEach(p=>{ if(getShift(p.s.id,p.isoD).kind!=="off")return;
    const free=zonesFor(p.period).filter(z=>!(p.fills||[p.period]).some(f=>zoneTaken(p.isoD,f,z.id,p.s.id)));
    if(!free.length){ gaps.push(nameOf(p.s.id)+" "+dlabel(p.isoD)+" "+p.period+" (no free zone)"); return; }
    const _ok=free.filter(z=>(rulesOf(active()).needs[z.id]||[]).filter(t=>tagById(S,t)).every(t=>hasTag(S,p.s,t)));   // a zone the engine chooses is one the person holds the tags for; only when none is left does the pattern land in a barred one, flagged
    const z=balancedZoneFor(p.s.id,p.period,_ok.length?_ok:free);
    a[p.s.id+"|"+p.isoD]=Object.assign({kind:"clinical",period:p.period,zone:z.id,fixed:(p.s.mode==="fixed")},p.type?{type:p.type}:{}); placed++; });
  _fpReport={placed:placed,conflicts:conflicts,gaps:gaps};
  return placed; }
function fixedPatternSummary(fp){ if(!fp)return "—"; const out=[], zn=z=>z?(zoneById(z)?zoneById(z).name:"?"):"any";
  const lab=sl=>fpSlotLabel(sl)+(sl.period==="CST"?"":"·"+zn(sl.zone));
  if(fp.recurrence==="monthly"){ (fp.M||[]).filter(r=>r.period).forEach(r=>out.push((FP_NTH[r.nth]||r.nth)+" "+DOW[+r.wd]+" "+lab(r))); return out.length?out.join(", "):"no shifts set"; }
  const wks=fpWeeksOf(fp); wks.forEach(wk=>{ const o=fp[wk]||{};
    const days=WD_ORDER.filter(wd=>o[String(wd)]&&o[String(wd)].period).map(wd=>DOW[wd]+" "+lab(o[String(wd)]));
    if(days.length)out.push((wks.length>1?("Wk "+wk+": "):"")+days.join(", ")); });
  return out.length?out.join(" · "):"no shifts set"; }
function fpDraft(s){ if(!_fpDraft[s.id]){ const src=s.fixedPattern||emptyPattern(); _fpDraft[s.id]=JSON.parse(JSON.stringify(src));
  const d=_fpDraft[s.id]; ["A","B","C","D"].forEach(k=>{ if(!d[k])d[k]={}; }); if(!Array.isArray(d.M))d.M=[]; if(!d.recurrence)d.recurrence="weekly"; } return _fpDraft[s.id]; }
function setFpRule(sid,i,key,val){ const d=fpDraft(S.staff.find(x=>x.id===sid)); const r=d.M[i]; if(!r)return; if(key==="type"){ const sl=fpSlotFrom(val)||{period:"AM"}; r.period=sl.period; if(sl.type)r.type=sl.type; else delete r.type; if(sl.period==="CST")r.zone=""; return; } r[key]=(key==="wd")?+val:val; }
function fpTypeOptions(sel,cyc){ return `<option value="">Off</option>`+fpTypes(cyc).map(t=>`<option value="${escapeHTML(t.id)}" ${sel===t.id?"selected":""}>${escapeHTML(t.label)}</option>`).join(""); }
function fpMonthTable(s,canEdit){ const d=fpDraft(s), dis=canEdit?"":"disabled";
  const rows=d.M.map((r,i)=>`<tr><td><select class="fp-mw" data-sid="${s.id}" data-i="${i}" aria-label="Rule ${i+1} — which" ${dis}>${["1","2","3","4","last"].map(k=>`<option value="${k}" ${String(r.nth)===k?"selected":""}>${FP_NTH[k]}</option>`).join("")}</select></td>
      <td><select class="fp-md" data-sid="${s.id}" data-i="${i}" aria-label="Rule ${i+1} — day" ${dis}>${WD_ORDER.map(wd=>`<option value="${wd}" ${+r.wd===wd?"selected":""}>${DOW[wd]}</option>`).join("")}</select></td>
      <td><select class="fp-mp" data-sid="${s.id}" data-i="${i}" aria-label="Rule ${i+1} — shift type" ${dis}>${fpTypeOptions(fpSlotKey(r)).replace('<option value="">Off</option>',"")}</select></td>
      <td><select class="fp-mz" data-sid="${s.id}" data-i="${i}" aria-label="Rule ${i+1} — zone" ${(canEdit&&r.period!=="CST")?"":"disabled"}><option value="">${r.period==="CST"?"no zone":"Any (auto)"}</option>${S.zones.map(z=>`<option value="${z.id}" ${r.zone===z.id?"selected":""}>${escapeHTML(z.name)}</option>`).join("")}</select></td>
      <td>${canEdit?`<button class="btn sm fp-mdel" data-sid="${s.id}" data-i="${i}" aria-label="Remove rule ${i+1}">Remove</button>`:""}</td></tr>`).join("");
  return `<div class="sub" style="margin-top:8px">Each rule is one shift a month: which ${escapeHTML("weekday")} of the calendar month, the half, the zone.</div><table class="maptbl"><tr><th>Which</th><th>Day</th><th>Shift</th><th>Zone</th><th></th></tr>${rows||`<tr><td colspan="5" class="muted small">No rules yet.</td></tr>`}</table>${canEdit?`<button class="btn sm fp-madd" data-sid="${s.id}" style="margin-top:6px">+ Add a shift</button>`:""}`; }
function setFpSlot(sid,wk,wd,key,val){ const s=S.staff.find(x=>x.id===sid); const d=fpDraft(s); d[wk]=d[wk]||{}; const k=String(wd);
  d[wk][k]=d[wk][k]||{}; if(key==="type"){ const sl=fpSlotFrom(val); if(!sl){ delete d[wk][k]; return; } d[wk][k].period=sl.period; if(sl.type)d[wk][k].type=sl.type; else delete d[wk][k].type; if(sl.period==="CST")d[wk][k].zone=""; return; }
  d[wk][k][key]=val; if(key==="period"&&!val)delete d[wk][k]; }
function fpWeekTable(s,wk,canEdit){ const o=fpDraft(s)[wk]||{};
  return `<table class="maptbl"><tr><th>Day</th><th>Shift</th><th>Zone</th></tr>`+WD_ORDER.map(wd=>{ const slot=o[String(wd)]||{};
    return `<tr><td>${DOW[wd]}</td>
      <td><select class="fp-p" data-sid="${s.id}" data-wk="${wk}" data-wd="${wd}" aria-label="Week ${wk} ${escapeHTML(String(DOW[wd]||wd))} — shift type" ${canEdit?"":"disabled"}>${fpTypeOptions(fpSlotKey(slot))}</select></td>
      <td><select class="fp-z" data-sid="${s.id}" data-wk="${wk}" data-wd="${wd}" aria-label="Week ${wk} ${escapeHTML(String(DOW[wd]||wd))} — zone" ${(canEdit&&slot.period!=="CST")?"":"disabled"}><option value="">${slot.period==="CST"?"no zone":slot.period?"Any (auto)":"—"}</option>${S.zones.map(z=>`<option value="${z.id}" ${slot.zone===z.id?"selected":""}>${escapeHTML(z.name)}</option>`).join("")}</select></td></tr>`;
  }).join("")+`</table>`; }
function fixedPatternEditorHTML(s,canEdit,asStaff){ const d=fpDraft(s); const committed=!!(s.fixedPattern&&s.fixedPattern.committed);
  const pending=S.requests.find(r=>r.type==="fixed"&&r.from===s.id&&r.status==="pending");
  if(s.mode==="self") return `<div class="card" style="margin-top:8px;background:var(--hover)"><b>Fixed pattern — ${escapeHTML(s.name)}</b> <span class="tag brand">self</span><div class="muted small" style="margin-top:6px">On <b>Self-roster</b> — no fixed pattern. Switch mode to “Fixed pattern” or “Pref + auto-draft” to set one.</div></div>`;
  return `<div class="card" style="margin-top:8px;background:var(--hover)">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <b>Fixed pattern — ${escapeHTML(s.name)}</b> <span class="tag ${s.mode==="fixed"?"mode-fixed":"mode-preference"}">${s.mode==="fixed"?"fixed":"preference"}</span>
      ${committed?'<span class="tag ok">'+ic("lock")+' committed</span>':'<span class="tag muted">draft</span>'}
      ${pending?'<span class="tag warn">'+ic("flag")+' change pending</span>':""}</div>
    <div class="seg" style="margin-top:8px">${[["weekly","Weekly"],["fortnightly","Fortnightly A/B"],["fourweekly","Every 4 weeks A\u2013D"],["monthly","Calendar month"]].map(([k,l])=>`<button class="fp-rec ${d.recurrence===k?"on":""}" data-sid="${s.id}" data-rec="${k}" ${canEdit?"":"disabled"}>${l}</button>`).join("")}</div>
    ${d.recurrence==="monthly"?fpMonthTable(s,canEdit):(FP_N[d.recurrence]||1)>1?fpWeeksOf(d).map(wk=>`<div class="sub" style="margin-top:8px">${escapeHTML(fpWeekHeading(wk,FP_N[d.recurrence]))}</div>${fpWeekTable(s,wk,canEdit)}`).join(""):fpWeekTable(s,"A",canEdit)}
    ${canEdit?`<div class="flexbtns" style="margin-top:10px">
      <button class="btn primary fp-save" data-sid="${s.id}" data-asstaff="${asStaff?1:0}">${(asStaff&&committed)?"Send pattern change for approval":"Save pattern"}</button>
      ${asStaff?"":`<button class="btn fp-commit" data-sid="${s.id}">${committed?"Un-commit":"Commit (lock)"}</button>`}
      <button class="btn fp-cancel" data-sid="${s.id}">Discard</button></div>
      ${(asStaff&&committed)?'<div class="muted small" style="margin-top:6px">'+ic("flag")+' This pattern is committed — your edits go to admin for approval, so committed fixed shifts stay fair.</div>':""}`:'<div class="muted small" style="margin-top:6px">Read-only.</div>'}
  </div>`; }
function saveFixedPattern(sid,asStaff){ const s=S.staff.find(x=>x.id===sid); const d=fpDraft(s);
  const committed=!!(s.fixedPattern&&s.fixedPattern.committed);
  const clean={recurrence:d.recurrence||"weekly",A:d.A||{},B:d.B||{},C:d.C||{},D:d.D||{},M:(d.M||[]).filter(r=>r&&r.period).map(r=>Object.assign({nth:r.nth==="last"?"last":+r.nth||1,wd:+r.wd||0,period:r.period,zone:r.zone||""},r.type?{type:r.type}:{})),committed:committed};
  if(asStaff&&committed){
    S.requests.unshift({id:"r"+Date.now(),type:"fixed",from:sid,pattern:clean,status:"pending",createdTs:Date.now()});
    notify("admin",nameOf(sid)+" requested a change to their committed fixed pattern.",null,{tab:"requests"});
    logAudit("fixed.change-request",nameOf(sid)+" · "+fixedPatternSummary(clean),sid); toast("Sent to admin for approval.");
  } else { s.fixedPattern=clean; logAudit("fixed.save",nameOf(sid)+(isAdmin()?" (admin)":"")+" · "+fixedPatternSummary(clean),S.viewAs);
    if(isAdmin()&&sid!==S.viewAs)notify(sid,"Your fixed pattern was updated by admin.",null,{tab:"my"}); }
  delete _fpDraft[sid]; _fpOpen.delete(sid); save(); render(); }
function toggleFixedCommit(sid){ const s=S.staff.find(x=>x.id===sid); s.fixedPattern=s.fixedPattern||emptyPattern();
  s.fixedPattern.committed=!s.fixedPattern.committed; logAudit("fixed.commit",nameOf(sid)+" → "+(s.fixedPattern.committed?"committed (locked)":"unlocked"),"admin");
  notify(sid,"Your fixed pattern was "+(s.fixedPattern.committed?"committed (locked)":"unlocked")+" by admin.",null,{tab:"my"}); delete _fpDraft[sid]; if(s.fixedPattern.committed)_fpOpen.delete(sid); save(); render(); }
function wireFixedEditors(){
  document.querySelectorAll(".fp-p,.fp-z").forEach(sel=>sel.onchange=e=>{const t=e.target;setFpSlot(t.dataset.sid,t.dataset.wk,+t.dataset.wd,t.classList.contains("fp-p")?"type":"zone",t.value); if(t.classList.contains("fp-p"))render();});
  document.querySelectorAll(".fp-rec").forEach(b=>b.onclick=()=>{const s=S.staff.find(x=>x.id===b.dataset.sid);fpDraft(s).recurrence=b.dataset.rec;render();});
  document.querySelectorAll(".fp-mw,.fp-md,.fp-mp,.fp-mz").forEach(sel=>sel.onchange=e=>{const t=e.target;setFpRule(t.dataset.sid,+t.dataset.i,{"fp-mw":"nth","fp-md":"wd","fp-mp":"type","fp-mz":"zone"}[t.className],t.value); if(t.className==="fp-mp")render();});
  document.querySelectorAll(".fp-madd").forEach(b=>b.onclick=()=>{fpDraft(S.staff.find(x=>x.id===b.dataset.sid)).M.push({nth:1,wd:1,period:"AM",zone:""});render();});
  document.querySelectorAll(".fp-mdel").forEach(b=>b.onclick=()=>{fpDraft(S.staff.find(x=>x.id===b.dataset.sid)).M.splice(+b.dataset.i,1);render();});
  document.querySelectorAll(".fp-save").forEach(b=>b.onclick=()=>saveFixedPattern(b.dataset.sid,b.dataset.asstaff==="1"));
  document.querySelectorAll(".fp-commit").forEach(b=>b.onclick=()=>toggleFixedCommit(b.dataset.sid));
  document.querySelectorAll(".fp-cancel").forEach(b=>b.onclick=()=>{delete _fpDraft[b.dataset.sid];_fpOpen.delete(b.dataset.sid);render();});
}
function fixedAdminCard(r){ return `<div class="card"><div class="row" style="align-items:flex-end">
  <span class="grow"><b>${escapeHTML(nameOf(r.from))}</b> · fixed-pattern change <span class="tag warn">approval needed</span>
  <div class="muted small" style="margin-top:4px">${escapeHTML(fixedPatternSummary(r.pattern))}</div></span>
  <div class="field" style="flex:1;min-width:140px"><input id="cmt-${r.id}" placeholder="Comment (optional)"></div>
  ${r.status==="pending"?`<button class="btn sm" data-rcask="${r.id}">Ask a question</button>`:""}<button class="btn sm" data-decline="${r.id}">Decline</button><button class="btn primary sm" data-approve="${r.id}">Approve</button></div>${reqThreadHTML(r,false)}</div>`; }

