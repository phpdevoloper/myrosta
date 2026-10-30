"use strict";
// moved from js/roster.js lines 720-968 (Phase 1 split, no edits)
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
