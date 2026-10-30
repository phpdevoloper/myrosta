"use strict";
// moved from js/roster.js lines 113-304 (Phase 1 split, no edits)
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

