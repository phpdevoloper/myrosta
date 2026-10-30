"use strict";
// moved from js/admin.js lines 1582-1694 (Phase 1 split, no edits)
/* ---------- swaps without naming one colleague: Ask everyone ----------
   A consultant asks about one of their clinical shifts; each colleague who could take it may offer one of their own shifts
   back; the asker accepts one, and it becomes an ordinary swap request, already agreed, for an admin to approve. S.openSwaps
   holds the asks and S.swapOffers the offers, both merged item by item. Whether an ask or an offer still holds is worked out
   from the roster every time it is read, so a stale one can never be accepted, even when nothing closed it. */
function swCycleOf(o){ return (S.cycles||[]).find(c=>c.id===(o&&o.cycleId))||null; }
function swLive(cyc){ return !!cyc&&!cyc.archived&&cyc.status!=="draft"; }
function swShiftOf(cyc,sid,isoD){ const v=cyc&&cyc.assign&&cyc.assign[sid+"|"+isoD]; return (v&&v.kind==="clinical")?Object.assign({kind:"clinical",period:v.period,zone:v.zone,type:v.type||null},(v.hours&&hoursOK(v.hours.start,v.hours.end))?{hours:{start:v.hours.start,end:v.hours.end}}:{}):null; }   // the snapshot carries the hours so an offer can say them; swSame still reads period, zone and type alone
function swSame(a,b){ return !!a&&!!b&&a.period===b.period&&a.zone===b.zone&&(a.type||null)===(b.type||null); }
function swFree(cyc,sid,isoD){ const v=cyc&&cyc.assign&&cyc.assign[sid+"|"+isoD]; return !(v&&v.kind&&v.kind!=="off")&&!leaveOn(sid,isoD); }   // no shift of any kind and no leave, UA included
function swOnRoster(cyc,sid){ const s=S.staff.find(x=>x.id===sid), r=cyc&&cyc.roles&&cyc.roles[sid]; return !!s&&isClinical(s)&&!!r&&r.in!==false; }   // read from the cycle itself, which need not be the one on screen; no entry means not on it
function ruleSwapJudge(st,cA,a,dateA,shA,cB,b,dateB,shB){   // a swap judged as a pair: b takes a's shift on dateA, a takes b's on dateB. "" when it may go ahead, else why not — the same answer from either side
  if(!rulesPresent(cA)&&!rulesPresent(cB))return "";
  const lands=(cyc,who,d,sh)=>{ const p=((st&&st.staff)||[]).find(x=>x.id===who)||null, need=(rulesOf(cyc).needs[(sh||{}).zone]||[]).filter(t=>tagById(st,t)), miss=need.find(t=>!hasTag(st,p,t)); if(!miss)return "";
    const z=(((cyc.settings&&cyc.settings.zones)||st.zones||[]).find(x=>x.id===sh.zone)); return nameOf(who)+" can\u2019t take "+(z?zoneLabelFor(cyc,z,sh):"that slot")+" on "+fmtISO(d)+" \u2014 it needs "+tagName(st,miss)+"."; };
  const worse=(cyc,d,fills,o)=>{ const before=ruleCounts(cyc,st,d,null), after=ruleCounts(cyc,st,d,o); let bad="";   // for each half and tag: the shortfall after must not exceed the shortfall before
    fills.forEach(P=>{ if(bad)return; const b0=ruleShort(cyc,st,d,P,before[P]), a0=ruleShort(cyc,st,d,P,after[P]);
      a0.forEach((s,i)=>{ if(!bad&&s.short>(b0[i]?b0[i].short:0))bad=fmtISO(d)+" "+((typeById(cyc,P)||{}).label||P)+" would be short of a "+tagName(st,s.tag)+"."; }); }); return bad; };
  return lands(cA,b,dateA,shA)||lands(cB,a,dateB,shB)||worse(cA,dateA,fillsOf(cA,shA),{without:[a,b],with:[{sid:b,fills:fillsOf(cA,shA),zone:shA.zone}]})||worse(cB,dateB,fillsOf(cB,shB),{without:[a,b],with:[{sid:a,fills:fillsOf(cB,shB),zone:shB.zone}]}); }
function swOfferable(o,sid){ const c=swCycleOf(o), today=iso(new Date());   // the shifts sid could offer back: their own, on a day to come, where the asker is free, and where the swap keeps every half whole
  if(!c||!swOnRoster(c,sid)||!swFree(c,sid,o.dateA))return [];
  const mine=swShiftOf(c,o.from,o.dateA)||o.shift;
  return datesOf(c.cycle).map(iso).filter(d=>d>=today).map(d=>({d:d,shift:swShiftOf(c,sid,d)})).filter(x=>x.shift&&swFree(c,o.from,x.d)&&!ruleSwapJudge(S,c,o.from,o.dateA,mine,c,sid,x.d,x.shift)); }
function swWho(o){ return S.staff.filter(s=>swOfferable(o,s.id).length).map(s=>s.id); }   // everyone who could answer an ask, and so everyone told about it
function swAskWhy(o){ if(!o)return "it has gone";   // "" while the ask holds; otherwise why it reads as closed
  if(o.status==="done")return "a swap was agreed";
  if(o.status!=="open")return o.why||"it was closed";
  const c=swCycleOf(o); if(!swLive(c))return "the roster is not live";
  if(o.dateA<iso(new Date()))return "that day has passed";
  if(!swSame(swShiftOf(c,o.from,o.dateA),o.shift)||leaveOn(o.from,o.dateA))return "the shift has changed";
  return ""; }
function swOfferWhy(f){ if(!f)return "it has gone";   // "" while the offer holds
  if(f.status!=="open")return f.status==="accepted"?"it was accepted":(f.status==="withdrawn"?"it was withdrawn":"it was closed");
  const o=(S.openSwaps||[]).find(x=>x.id===f.openId), w=swAskWhy(o); if(w)return w;
  const c=swCycleOf(o);
  if(f.dateB<iso(new Date()))return "that day has passed";
  if(!swSame(swShiftOf(c,f.by,f.dateB),f.shift))return "the offered shift has changed";
  if(!swOnRoster(c,f.by))return nameOf(f.by)+" is no longer on this roster";
  if(!swFree(c,o.from,f.dateB))return nameOf(o.from)+" is no longer free on "+fmtISO(f.dateB);
  if(!swFree(c,f.by,o.dateA))return nameOf(f.by)+" is no longer free on "+fmtISO(o.dateA);
  const rj=ruleSwapJudge(S,c,o.from,o.dateA,swShiftOf(c,o.from,o.dateA)||o.shift,c,f.by,f.dateB,f.shift); if(rj)return rj.replace(/\.$/,"");   // tags are read as they stand now
  return ""; }
function swShiftText(cyc,sh){ const z=((cyc&&cyc.settings&&cyc.settings.zones)||S.zones||[]).find(x=>x.id===sh.zone); return (z?zoneLabelFor(cyc,z,sh)+" ":"")+typeLabelOf(cyc,sh)+ownHoursTag(cyc,sh); }   // "Resus AM", in the ask's own cycle
function swOfferLabel(cyc,isoD,sh){ return fmtISO(isoD)+" \u00b7 "+swShiftText(cyc,sh)+" \u00b7 counts "+shiftUnits(cyc,sh); }   // every offer says what it counts, so a full day for a half day surprises nobody
function swapAskRefusal(sid,isoD){ const c=active();   // "" when sid may ask everyone about their shift on isoD, in the cycle on screen
  if(!swLive(c))return "This roster isn\u2019t live yet.";
  if(!isoD||isoD<iso(new Date()))return "That day has passed.";
  if(!swShiftOf(c,sid,isoD))return "No clinical shift to swap that day.";
  if((S.openSwaps||[]).some(o=>o.from===sid&&o.dateA===isoD&&swAskWhy(o)===""))return "You\u2019re already asking everyone about that shift.";
  if((S.requests||[]).some(r=>r.type==="swap"&&["pending","awaiting-peer","info"].indexOf(r.status)>=0&&((r.from===sid&&r.dateA===isoD)||(r.peerId===sid&&r.dateB===isoD))))return "You already have a swap waiting for that shift.";   // named or through Ask everyone, on either side of it
  return ""; }
function swTidy(){ const today=iso(new Date());   // after a roster change: close each ask and offer the roster no longer supports, and tell whoever offered. A day gone only reads as closed, so nothing is written for it
  osTidy();   // first, the give-aways and asks to come off that stood on a shift now moved
  (S.openSwaps||[]).forEach(o=>{ if(o.status!=="open"||o.dateA<today)return;
    const why=swAskWhy(o);
    if(why){ o.status="closed"; o.why=why; swCloseOffers(o,nameOf(o.from)+"\u2019s swap request for "+fmtISO(o.dateA)+" has closed: "+why+"."); logAudit("swap.ask-close",nameOf(o.from)+" "+o.dateA+" \u00b7 "+why,S.viewAs); return; }
    (S.swapOffers||[]).filter(f=>f.openId===o.id&&f.status==="open"&&f.dateB>=today).forEach(f=>{ const w=swOfferWhy(f);
      if(w){ f.status="closed"; notify(f.by,"Your offer of "+fmtISO(f.dateB)+" for "+nameOf(o.from)+"\u2019s "+fmtISO(o.dateA)+" shift has closed: "+w+".",null,{tab:"requests",cycle:o.cycleId}); } }); }); }
function swCloseOffers(o,text){ (S.swapOffers||[]).filter(f=>f.openId===o.id&&f.status==="open").forEach(f=>{ f.status="closed"; notify(f.by,text,null,{tab:"requests",cycle:o.cycleId}); }); }
function swapAsk(sid,isoD,note){
  return commitGuarded(()=>{ if(isAdmin()||sid!==S.viewAs)return {ok:false,reason:"Only the person on the shift can ask everyone."};
    const bad=swapAskRefusal(sid,isoD); if(bad)return {ok:false,reason:bad};
    const c=active(), id="sw"+Date.now()+Math.random().toString(36).slice(2,5);
    const o={id:id,cycleId:c.id,from:sid,dateA:isoD,shift:swShiftOf(c,sid,isoD),note:String(note||"").trim().slice(0,300),status:"open",why:"",ts:Date.now(),swapId:null};
    const who=swWho(o); if(!who.length)return {ok:false,reason:"Nobody is free on "+fmtISO(isoD)+" with a shift you could take in return."};
    S.openSwaps.unshift(o);
    const what=fmtISO(isoD)+" "+swShiftText(c,o.shift);
    who.forEach(b=>notify(b,nameOf(sid)+" is looking for a swap for "+what+".","swask-"+id+"-"+b,{tab:"requests",cycle:c.id}));
    logAudit("swap.ask",nameOf(sid)+" "+isoD+" "+swShiftText(c,o.shift)+" \u00b7 "+who.length+" asked",sid);
    _osPushQueue={type:"swap",osId:id,title:"Swap wanted \u2014 "+what,body:nameOf(sid)+" is looking for a swap. Tap to offer one of your shifts.",targets:who};   // only the colleagues who could take it
    return {ok:true}; }); }
function swapOffer(openId,isoB){
  return commitGuarded(()=>{ const me=S.viewAs, o=(S.openSwaps||[]).find(x=>x.id===openId);
    if(!o)return {ok:false,reason:"That swap request is gone."};
    const why=swAskWhy(o); if(why)return {ok:false,reason:"That swap request is closed: "+why+"."};
    const pick=swOfferable(o,me).find(x=>x.d===isoB); if(!pick)return {ok:false,reason:"You can\u2019t offer that shift for this swap."};
    const c=swCycleOf(o), mine=S.swapOffers.find(f=>f.openId===o.id&&f.by===me&&f.status==="open");   // one offer each: offering again changes it
    if(mine){ mine.dateB=isoB; mine.shift=pick.shift; mine.ts=Date.now(); }
    else S.swapOffers.unshift({id:"so"+Date.now()+Math.random().toString(36).slice(2,5),openId:o.id,by:me,dateB:isoB,shift:pick.shift,status:"open",ts:Date.now()});
    notify(o.from,nameOf(me)+(mine?" changed their offer to ":" offers ")+fmtISO(isoB)+" "+swShiftText(c,pick.shift)+" for your "+fmtISO(o.dateA)+" shift.",null,{tab:"requests",cycle:o.cycleId});
    logAudit("swap.offer",nameOf(me)+" "+isoB+" "+swShiftText(c,pick.shift)+" for "+nameOf(o.from)+" "+o.dateA,me);
    return {ok:true}; }); }
function swapOfferWithdraw(offerId){
  return commitGuarded(()=>{ const f=(S.swapOffers||[]).find(x=>x.id===offerId);
    if(!f||f.by!==S.viewAs)return {ok:false,reason:"That offer isn\u2019t yours."};
    if(f.status!=="open")return {ok:false,reason:"That offer is already closed."};
    const o=(S.openSwaps||[]).find(x=>x.id===f.openId);
    f.status="withdrawn";
    if(o&&o.status==="open")notify(o.from,nameOf(f.by)+" withdrew their offer for your "+fmtISO(o.dateA)+" shift.",null,{tab:"requests",cycle:o.cycleId});
    logAudit("swap.offer-withdraw",nameOf(f.by)+" "+f.dateB+(o?" for "+nameOf(o.from)+" "+o.dateA:""),f.by);
    return {ok:true}; }); }
function swapAccept(offerId,seen){   // seen (optional): the offer as its confirm showed it, {dateB, shift}
  return commitGuarded(()=>{ const f=(S.swapOffers||[]).find(x=>x.id===offerId), o=f&&(S.openSwaps||[]).find(x=>x.id===f.openId);
    if(!o)return {ok:false,reason:"That offer is gone."};
    if(o.from!==S.viewAs)return {ok:false,reason:"Only "+nameOf(o.from)+" can accept an offer for their shift."};
    if(seen&&(f.dateB!==seen.dateB||!swSame(f.shift,seen.shift)))return {ok:false,reason:"That offer has just changed. Look at it again before accepting."};   // a Change offer can land between the confirm opening and Accept
    const why=swOfferWhy(f); if(why)return {ok:false,reason:"That offer can\u2019t be accepted: "+why+"."};   // read again inside the write, so two phones cannot both finish it
    const rid="r"+Date.now()+Math.random().toString(36).slice(2,5);
    S.requests.unshift({id:rid,type:"swap",from:o.from,dateA:o.dateA,peerId:f.by,dateB:f.dateB,reason:o.note||"",status:"pending",peerAgreed:true,openId:o.id,createdTs:Date.now()});   // an ordinary swap, already agreed: the admin's card and approval are unchanged
    o.status="done"; o.swapId=rid; f.status="accepted";
    swCloseOffers(o,nameOf(o.from)+" found a swap for "+fmtISO(o.dateA)+". Thank you for offering.");
    notify(f.by,nameOf(o.from)+" accepted your offer of "+fmtISO(f.dateB)+" for their "+fmtISO(o.dateA)+" shift. It has gone to your admin.",null,{tab:"requests",cycle:o.cycleId});
    notify("admin",nameOf(o.from)+" and "+nameOf(f.by)+" agreed a swap through Ask everyone \u2014 awaiting approval.",null,{tab:"requests"});
    logAudit("swap.accept","with "+nameOf(f.by)+" "+o.dateA+" \u2194 "+f.dateB,o.from);
    return {ok:true}; }); }
function swapAskWithdraw(openId){
  return commitGuarded(()=>{ const o=(S.openSwaps||[]).find(x=>x.id===openId);
    if(!o||o.from!==S.viewAs)return {ok:false,reason:"That swap request isn\u2019t yours."};
    if(o.status!=="open")return {ok:false,reason:o.status==="done"?"You already accepted an offer.":"That swap request is already closed."};
    o.status="closed"; o.why="withdrawn";
    swCloseOffers(o,nameOf(o.from)+" no longer needs a swap for "+fmtISO(o.dateA)+".");
    logAudit("swap.ask-withdraw",nameOf(o.from)+" "+o.dateA,o.from);
    return {ok:true}; }); }
