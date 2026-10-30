"use strict";
// moved from js/roster.js lines 969-1218 (Phase 1 split, no edits)
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
