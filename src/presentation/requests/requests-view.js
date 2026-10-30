"use strict";
// moved from js/admin.js lines 1695-1903 (Phase 1 split, no edits)
function staffAssignments(staffId){const a=active().assign;const out=[];cycleDates().forEach(d=>{const sh=a[staffId+"|"+iso(d)];if(sh&&(sh.kind==="clinical"||sh.kind==="cst"))out.push({date:iso(d),label:shiftLabel(sh)});});return out;}
function viewRequests(){
  if(isAdmin()){
    const pending=S.requests.filter(r=>r.status==="pending"||r.status==="info");
    const cancelReqs=S.requests.filter(r=>r.status==="approved"&&r.cancelState==="requested");
    const decided=S.requests.filter(r=>["approved","declined","cancelled","withdrawn"].includes(r.status)&&r.cancelState!=="requested");
    const asks=pendingAsks(), askCards=asks.map(askAdminCard).join("");
    const cards=(pending.length||asks.length)?(askCards+(pending.length?pending.map(r=>r.type==="swap"?swapAdminCard(r):r.type==="fixed"?fixedAdminCard(r):requestAdminCard(r)).join(""):"")):'<div class="card">'+emptyState(EIC.check,"No pending requests","Leave and swap requests will appear here for you to approve.")+'</div>';
    const cancelCard=cancelReqs.length?('<h3 style="font-size:var(--fs-md);margin:18px 0 6px">Cancellation requests</h3>'+cancelReqs.map(r=>`<div class="card" style="border-left:4px solid var(--leave-t)"><div class="row" style="align-items:flex-end"><span class="grow">${r.type==="swap"?("Swap "+escapeHTML(nameOf(r.from))+" ↔ "+escapeHTML(nameOf(r.peerId))+" · "+reqDates(r)):r.type==="fixed"?(escapeHTML(nameOf(r.from))+" · fixed-pattern change"):(escapeHTML(nameOf(r.from))+" · "+escapeHTML(LEAVE_LABEL[r.code]||r.code)+" · "+reqDates(r))} <span class="tag warn">cancellation requested</span></span><div class="field" style="flex:1;min-width:140px"><input id="cmt-${r.id}" placeholder="Comment (optional)"></div><button class="btn sm" data-cancelkeep="${r.id}">Keep the approval</button><button class="btn danger sm" data-cancelapprove="${r.id}">Cancel the ${reqKindLabel(r)}</button></div></div>`).join("")):"";
    const hist=decided.length?('<h3 style="font-size:var(--fs-md);margin:18px 0 6px">Decided</h3><div class="card">'+decided.map(r=>`<div class="listrow"><span class="grow">${r.type==="swap"?("Swap "+escapeHTML(nameOf(r.from))+" ↔ "+escapeHTML(nameOf(r.peerId))):r.type==="fixed"?(escapeHTML(nameOf(r.from))+" · fixed-pattern change"):(escapeHTML(nameOf(r.from))+" · "+escapeHTML(LEAVE_LABEL[r.code]||r.code)+" · "+reqDates(r))} ${reqStatusTag(r)}${r.adminComment?` · <span class="muted small">${escapeHTML(r.adminComment)}</span>`:""}</span>${r.status==="approved"?`<button class="btn danger sm" data-cancel="${r.id}">Cancel the ${reqKindLabel(r)}</button>`:""}</div>`).join("")+'</div>'):"";
    return `<div style="margin-bottom:8px"><h2>Requests</h2><div class="sub">${pending.length+asks.length} pending${clockCount(active(),clockNow())?(" \u00b7 "+clockCount(active(),clockNow())+" hour"+(clockCount(active(),clockNow())===1?"":"s")+" to approve"):""}${cancelReqs.length?(" · "+cancelReqs.length+" cancellation request(s)"):""}. Approvals update the roster automatically; cancelling an approved item reverses it.</div></div>${clockListHTML()}${cards}${cancelCard}${hist}`;
  }
  const me=S.viewAs, mine=S.requests.filter(r=>r.from===me);
  const peerReqs=S.requests.filter(r=>r.type==="swap"&&r.peerId===me&&r.status==="awaiting-peer"), asks=mine.filter(r=>r.status==="info");
  const agreed=(_settled&&_settled.kind==="agree")?`<div class="card"><div class="listrow settled" role="status"><span class="rcic" aria-hidden="true">${ic("check")}</span><span class="grow">You agreed — ${escapeHTML(_settled.name)} has been told and it's gone to admin.</span></div></div>`:"";
  const needsYou=(peerReqs.length||asks.length)?`<div class="card"><h2>Needs you</h2>${peerReqs.map(r=>`<div class="listrow"><span class="grow">${escapeHTML(nameOf(r.from))} offers their <b>${escapeHTML(shiftLabel(getShift(r.from,r.dateA)))}</b> on ${fmtISO(r.dateA)} for your <b>${escapeHTML(shiftLabel(getShift(r.peerId,r.dateB)))}</b> on ${fmtISO(r.dateB)}${r.reason?` · ${escapeHTML(r.reason)}`:""}</span><button class="btn danger" data-peerdecline="${r.id}">Decline</button><button class="btn primary" data-peeragree="${r.id}">Agree</button></div>`).join("")}${asks.map(myReqRow).join("")}</div>`:"";
  const list=`<div class="card"><h2>Your requests</h2>${mine.length?mine.filter(r=>r.status!=="info").map(myReqRow).join("")+(asks.length&&mine.length===asks.length?'<div class="muted small">Your open question is under Needs you.</div>':""):emptyState(EIC.doc,"No requests yet","Leave and swap requests you send will show here with their status.")}</div>`;
  const btns=`<div class="actrow"><button class="btn primary" id="reqLeave">Request leave</button><button class="btn" id="reqSwap">Request a swap</button></div>`;
  const _need=peerReqs.length+asks.length;
  return pageHead("Requests",_need?(_need+" need"+(_need>1?"":"s")+" you"):"Leave and swaps")+agreed+needsYou+swapAskingHTML(me)+swapWantedHTML(me)+list+btns;
}
function reqSheetHTML(kind){   // the leave and swap forms as sheets — same ids as before, one verb: Send … request
  const me=S.viewAs, ds=cycleDates(), today=iso(new Date()), first=ds.find(d=>iso(d)>=today), def=first?iso(first):today; let form;
  if(kind==="leave"){
    form=`<h3>Request leave</h3><div class="sub">Goes to your admin. You'll get a notification when it's decided.</div>
    <div class="row">
      <label class="field"><span class="lbl">From</span><input type="date" id="lvFrom" value="${def}"></label>
      <label class="field"><span class="lbl">To</span><input type="date" id="lvTo" value="${def}"></label>
      <label class="field"><span class="lbl">Type</span><select id="lvCode">${["AL","CME","UPL","LSL","Sab","PL","UA","PH","Other"].map(c=>`<option value="${c}">${c} — ${LEAVE_LABEL[c]||c}</option>`).join("")}</select></label>
      <label class="field" style="flex:1;min-width:160px"><span class="lbl">Reason</span><input id="lvReason" placeholder="Optional"></label>
    </div>
    <div class="flexbtns" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="reqCancel">Cancel</button><button class="btn primary" id="lvSubmit">Send leave request</button></div>`;
  } else {
    const myShifts=staffAssignments(me), others=S.staff.filter(x=>x.id!==me);
    if(swapPeer&&!others.find(o=>o.id===swapPeer))swapPeer=null;
    const peerShifts=swapPeer?staffAssignments(swapPeer):[];
    const seg=`<div class="seg" id="swModeSeg" role="group" aria-label="How to find a swap" style="margin:8px 0"><button data-swmode="peer" class="${_swapMode==="all"?"":"on"}">With a colleague</button><button data-swmode="all" class="${_swapMode==="all"?"on":""}">Ask everyone</button></div>`;
    if(_swapMode==="all")form=swapAllFormHTML(me,seg);
    else form=`<h3>Request a swap</h3>${seg}<div class="sub">You give one of your shifts and take a colleague's. They agree first, then your admin approves. Tip: agree it in Messages first.</div>
    <div class="row">
      <label class="field"><span class="lbl">My shift</span><select id="swMine">${myShifts.length?myShifts.map(x=>`<option value="${x.date}"${x.date===_swapMine?" selected":""}>${escapeHTML(fmtISO(x.date))} · ${x.label}</option>`).join(""):'<option value="">— you have no shifts —</option>'}</select></label>
      <label class="field"><span class="lbl">Colleague</span><select id="swPeer"><option value="">Select…</option>${others.map(o=>`<option value="${o.id}" ${o.id===swapPeer?"selected":""}>${escapeHTML(o.name)}</option>`).join("")}</select></label>
      <label class="field"><span class="lbl">Their shift</span><select id="swTheirs" ${swapPeer?"":"disabled"}>${peerShifts.length?peerShifts.map(x=>`<option value="${x.date}">${escapeHTML(fmtISO(x.date))} · ${x.label}</option>`).join(""):`<option value="">${swapPeer?"— none —":"pick colleague first"}</option>`}</select></label>
      <label class="field" style="flex:1;min-width:140px"><span class="lbl">Reason</span><input id="swReason" placeholder="Optional" value="${escapeHTML(_swapNote)}"></label>
    </div>
    <div class="flexbtns" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="reqCancel">Cancel</button><button class="btn primary" id="swSubmit">Send swap request</button></div>`;
  }
  return `<div class="overlay sheetwrap" id="ovlReq"><div class="sheet reqsheet" role="dialog" aria-modal="true" aria-label="${kind==="leave"?"Request leave":"Request a swap"}"><div class="sheetgrab"></div>${form}</div></div>`;
}
function swapAllFormHTML(me,seg){   // the swap sheet's Ask everyone: one of your shifts to come, an optional note, and who it will reach
  const c=active(), today=iso(new Date()), mine=staffAssignments(me).filter(x=>x.date>=today&&swShiftOf(c,me,x.date));
  const pick=mine.some(x=>x.date===_swapMine)?_swapMine:(mine[0]?mine[0].date:"");
  const bad=pick?swapAskRefusal(me,pick):"You have no shifts coming up to swap.", n=bad?0:swWho({cycleId:c.id,from:me,dateA:pick}).length;
  const reach=bad||(n?("Goes to "+n+(n===1?" colleague who is":" colleagues who are")+" free on "+fmtISO(pick)+"."):("Nobody is free on "+fmtISO(pick)+" with a shift you could take in return."));
  return `<h3>Request a swap</h3>${seg}<div class="sub">Everyone who could take it can offer one of their shifts. You pick one, then your admin approves.</div>
    <div class="row">
      <label class="field"><span class="lbl">My shift</span><select id="swMine">${mine.length?mine.map(x=>`<option value="${x.date}"${x.date===pick?" selected":""}>${escapeHTML(fmtISO(x.date)+" \u00b7 "+x.label)}</option>`).join(""):`<option value="">No shifts coming up</option>`}</select></label>
      <label class="field" style="flex:1;min-width:160px"><span class="lbl">Note</span><input id="swNote" placeholder="Optional" value="${escapeHTML(_swapNote)}"></label>
    </div>
    <div class="${n?"muted small":"note"}" id="swReach">${escapeHTML(reach)}</div>
    <div class="flexbtns" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="reqCancel">Cancel</button><button class="btn primary" id="swAsk"${n?"":" disabled"}>Ask everyone</button></div>`; }
function swKeepNote(){ const el=document.getElementById(_swapMode==="all"?"swNote":"swReason"); if(el)_swapNote=el.value||""; }   // the note survives the sheet's own re-renders
function swapAskingHTML(me){ const c=active(), today=iso(new Date());   // Requests, for the asker: each open ask with its offers, and Accept on each one that still holds
  const L=(S.openSwaps||[]).filter(o=>o.from===me&&o.cycleId===c.id&&o.status==="open"&&o.dateA>=today);
  if(!L.length)return "";
  return `<div class="card"><h2>Asking everyone</h2>${L.map(o=>{ const why=swAskWhy(o), offers=(S.swapOffers||[]).filter(f=>f.openId===o.id&&f.status==="open");
    const head=`<div class="listrow"><span class="grow"><b>${escapeHTML(fmtISO(o.dateA)+" "+swShiftText(c,o.shift))}</b>${o.note?` \u00b7 <span class="muted">${escapeHTML(o.note)}</span>`:""}${why?` <span class="tag muted">closed</span> <span class="muted small">${escapeHTML(why)}</span>`:""}</span><button class="btn sm" data-swaskwd="${o.id}">Withdraw</button></div>`;
    if(why)return head;
    return head+(offers.length?offers.map(f=>{ const w=swOfferWhy(f);
      return `<div class="listrow"><span class="grow">${escapeHTML(nameOf(f.by))} offers <b>${escapeHTML(swOfferLabel(c,f.dateB,f.shift))}</b>${w?` <span class="tag muted">closed</span> <span class="muted small">${escapeHTML(w)}</span>`:""}</span>${w?"":`<button class="btn primary sm" data-swaccept="${f.id}">Accept</button>`}</div>`; }).join(""):`<div class="muted small">No offers yet. Everyone who could take it has been asked.</div>`); }).join("")}</div>`; }
function swapWantedHTML(me){ const c=active();   // Requests, for everyone else: each ask they could answer, the shifts they could offer and what each counts
  const rows=(S.openSwaps||[]).filter(o=>o.cycleId===c.id&&swAskWhy(o)==="").map(o=>{
    const mine=(S.swapOffers||[]).find(f=>f.openId===o.id&&f.by===me&&f.status==="open"), can=swOfferable(o,me);
    if(!mine&&!can.length)return "";
    const w=mine?swOfferWhy(mine):"";
    const pickOne=can.length?`<label class="field"><span class="lbl">Offer a shift</span><select id="swofs-${o.id}">${can.map(x=>`<option value="${x.d}"${mine&&mine.dateB===x.d?" selected":""}>${escapeHTML(swOfferLabel(c,x.d,x.shift))}</option>`).join("")}</select></label><button class="btn primary sm" data-swoffer="${o.id}">${mine?"Change offer":"Send offer"}</button>`:"";
    return `<div class="listrow swrow"><span class="grow"><b>${escapeHTML(nameOf(o.from))}</b> is looking for a swap for <b>${escapeHTML(fmtISO(o.dateA)+" "+swShiftText(c,o.shift))}</b>${o.note?` \u00b7 <span class="muted">${escapeHTML(o.note)}</span>`:""}${mine?`<br><span class="small">You offered ${escapeHTML(swOfferLabel(c,mine.dateB,mine.shift))}</span>${w?` <span class="tag muted">closed</span> <span class="muted small">${escapeHTML(w)}</span>`:""}`:""}</span>${pickOne}${mine&&!w?`<button class="btn sm" data-swofferwd="${mine.id}">Withdraw</button>`:""}</div>`; }).join("");
  return rows?`<div class="card"><h2>Swaps wanted</h2>${rows}</div>`:""; }
function swapAdminCard(r){
  const aSh=getShift(r.from,r.dateA), bSh=getShift(r.peerId,r.dateB);
  return `<div class="card" style="border-left:4px solid var(--accent)">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="font-size:var(--fs-md)">Swap · ${escapeHTML(nameOf(r.from))} ↔ ${escapeHTML(nameOf(r.peerId))}</h3><span class="grow"></span><span class="tag ok">both agreed</span>${r.openId?'<span class="tag muted">via Ask everyone</span>':""}</div>
    <div class="small" style="margin:8px 0">
      <div>${escapeHTML(nameOf(r.from))} gives <b>${escapeHTML(shiftLabel(aSh))}</b> on ${fmtISO(r.dateA)} → ${escapeHTML(nameOf(r.peerId))}</div>
      <div>${escapeHTML(nameOf(r.peerId))} gives <b>${escapeHTML(shiftLabel(bSh))}</b> on ${fmtISO(r.dateB)} → ${escapeHTML(nameOf(r.from))}</div>
    </div>
    ${r.reason?`<div class="small muted">Reason: ${escapeHTML(r.reason)}</div>`:""}
    ${reqThreadHTML(r,false)}${r.status==="info"?'<div class="note" style="margin-top:6px">'+ic("help")+' Waiting for their reply — you can still approve or decline.</div>':""}
    <div class="row" style="align-items:flex-end;margin-top:6px">
      <label class="field" style="flex:1;min-width:180px"><span class="lbl">Comment (optional)</span><input id="cmt-${r.id}" placeholder="Note"></label>
      ${r.status==="pending"?`<button class="btn sm" data-rcask="${r.id}">Ask a question</button>`:""}
      <button class="btn danger" data-declineswap="${r.id}">Decline</button>
      <button class="btn primary" data-approveswap="${r.id}">Approve swap</button>
    </div></div>`;
}
function submitSwapRequest(from,dateA,peerId,dateB,reason){
  if(!dateA||!peerId||!dateB){toast("Pick your shift, a colleague, and their shift.");return false;}
  S.requests.unshift({id:"r"+Date.now(),type:"swap",from:from,dateA:dateA,peerId:peerId,dateB:dateB,reason:reason||"",status:"awaiting-peer",createdTs:Date.now()});
  notify(peerId,nameOf(from)+" requested a shift swap with you.",null,{tab:"requests"});
  logAudit("swap.request","with "+nameOf(peerId)+" "+dateA+" ↔ "+dateB,from);
  swapPeer=null;save();return true;
}
function agreeSwap(id){const r=S.requests.find(x=>x.id===id);if(!r)return;r.peerAgreed=true;r.status="pending"; _settled={kind:"agree",key:"agree-"+id,name:nameOf(r.from)};
  notify("admin",nameOf(r.peerId)+" agreed to swap with "+nameOf(r.from)+" — awaiting approval.",null,{tab:"requests"});
  notify(r.from,nameOf(r.peerId)+" agreed to your swap. Sent to admin.",null,{tab:"requests"});
  logAudit("swap.agree","with "+nameOf(r.from),r.peerId);save();}
function declineSwapPeer(id){const r=S.requests.find(x=>x.id===id);if(!r)return;r.status="declined";r.decidedTs=Date.now();
  notify(r.from,nameOf(r.peerId)+" declined your swap request.",null,{tab:"requests"});
  logAudit("swap.peer-decline","with "+nameOf(r.from),r.peerId);save();}
function cycleForDate(isoD){ return (S.cycles||[]).find(c=>!c.archived&&c.cycle&&c.cycle.start<=isoD&&isoD<=iso(cyEnd(c))); }   // the cycle whose date range contains this day — swaps must NOT depend on which cycle the admin happens to be viewing
function executeSwap(r){
  const cA=cycleForDate(r.dateA), cB=cycleForDate(r.dateB);
  if(!cA||!cB)return {ok:false,reason:"Those dates aren't in a live cycle any more."};
  const aA=cA.assign=cA.assign||{}, aB=cB.assign=cB.assign||{};
  const sA=aA[r.from+"|"+r.dateA], sB=aB[r.peerId+"|"+r.dateB];
  if(!sA)return {ok:false,reason:nameOf(r.from)+" no longer has the "+fmtISO(r.dateA)+" shift."};       // re-validate at approval time — the roster may have changed since the request
  if(!sB)return {ok:false,reason:nameOf(r.peerId)+" no longer has the "+fmtISO(r.dateB)+" shift."};
  if(aA[r.peerId+"|"+r.dateA])return {ok:false,reason:nameOf(r.peerId)+" already has a shift on "+fmtISO(r.dateA)+"."};
  if(aB[r.from+"|"+r.dateB])return {ok:false,reason:nameOf(r.from)+" already has a shift on "+fmtISO(r.dateB)+"."};
  if(leaveOn(r.peerId,r.dateA))return {ok:false,reason:nameOf(r.peerId)+" is on leave on "+fmtISO(r.dateA)+"."};
  if(leaveOn(r.from,r.dateB))return {ok:false,reason:nameOf(r.from)+" is on leave on "+fmtISO(r.dateB)+"."};
  const rj=ruleSwapJudge(S,cA,r.from,r.dateA,sA,cB,r.peerId,r.dateB,sB); if(rj)return {ok:false,reason:rj};   // judged as a pair, at approval, like every other check here
  delete aA[r.from+"|"+r.dateA]; delete aB[r.peerId+"|"+r.dateB];
  const mA=Object.assign({},sA), mB=Object.assign({},sB); delete mA.fixed; delete mB.fixed;   // a swapped shift is a one-off for whoever holds it now: the pattern's lock stays with the pattern, and the drift shows the move
  aA[r.peerId+"|"+r.dateA]=mA; aB[r.from+"|"+r.dateB]=mB;
  return {ok:true}; }
function approveSwap(id,comment){const r=S.requests.find(x=>x.id===id);if(!r)return;
  const res=executeSwap(r);
  if(!res.ok){ r.status="declined";r.decidedTs=Date.now();r.adminComment=(comment?comment+" · ":"")+"Auto-declined: "+res.reason;   // never notify "approved" for a swap that didn't happen
    notify(r.from,"Your swap couldn't go ahead — "+res.reason,null,{tab:"requests"}); notify(r.peerId,"A swap involving you couldn't go ahead — "+res.reason,null,{tab:"requests"});
    logAudit("swap.autodecline",nameOf(r.from)+" ↔ "+nameOf(r.peerId)+" · "+res.reason,"admin"); save(); toast(res.reason); return; }
  r.status="approved";r.decidedTs=Date.now();r.adminComment=comment||"";
  swTidy();   // two shifts moved: close the asks and offers that stood on them
  notify(r.from,"Your swap with "+nameOf(r.peerId)+" was approved."+(comment?(" "+comment):""),null,{tab:"requests"});
  notify(r.peerId,"Your swap with "+nameOf(r.from)+" was approved."+(comment?(" "+comment):""),null,{tab:"requests"});
  logAudit("swap.approve",nameOf(r.from)+" "+r.dateA+" ↔ "+nameOf(r.peerId)+" "+r.dateB+(comment?(" · "+comment):""),"admin");save();}
function declineSwap(id,comment){const r=S.requests.find(x=>x.id===id);if(!r)return;r.status="declined";r.decidedTs=Date.now();r.adminComment=comment||"";
  notify(r.from,"Your swap was declined."+(comment?(" "+comment):""),null,{tab:"requests"});notify(r.peerId,"A swap involving you was declined.",null,{tab:"requests"});
  logAudit("swap.decline",nameOf(r.from)+" ↔ "+nameOf(r.peerId)+(comment?(" · "+comment):""),"admin");save();}
/* withdraw (pending) + cancel (approved) */
function withdrawRequest(id){const r=S.requests.find(x=>x.id===id);if(!r||!["pending","awaiting-peer"].includes(r.status))return;
  r.status="withdrawn";r.decidedTs=Date.now();
  if(isAdmin())notify(r.from,"Admin removed your "+(r.type==="swap"?"swap":"leave")+" request.",null,{tab:"requests"});
  else{notify("admin",nameOf(r.from)+" withdrew their "+(r.type==="swap"?"swap":"leave")+" request.",null,{tab:"requests"});if(r.type==="swap"&&r.peerId)notify(r.peerId,nameOf(r.from)+" withdrew the swap request.",null,{tab:"requests"});}
  logAudit(r.type+".withdraw",(r.type==="swap"?("swap with "+nameOf(r.peerId)):(r.code+" "+r.dateFrom+"→"+r.dateTo)),S.viewAs);save();}
function reverseSwap(r){const cA=cycleForDate(r.dateA)||active(), cB=cycleForDate(r.dateB)||active();   // undo in the cycles that actually hold those dates
  const aA=cA.assign=cA.assign||{}, aB=cB.assign=cB.assign||{};
  const sOnA=aA[r.peerId+"|"+r.dateA],sOnB=aB[r.from+"|"+r.dateB];
  delete aA[r.peerId+"|"+r.dateA];delete aB[r.from+"|"+r.dateB];
  if(sOnA)aA[r.from+"|"+r.dateA]=sOnA;if(sOnB)aB[r.peerId+"|"+r.dateB]=sOnB;}
function cancelApproved(id,comment){const r=S.requests.find(x=>x.id===id);if(!r||r.status!=="approved")return;
  if(r.type==="leave")S.leave=S.leave.filter(L=>L.requestId!==id);
  else if(r.type==="swap"){ reverseSwap(r); swTidy(); }   // two shifts moved back: close the asks and offers that stood on them
  r.status="cancelled";r.cancelState=null;r.decidedTs=Date.now();if(comment)r.adminComment=comment;
  if(r.type==="swap"){notify(r.from,"Your approved swap with "+nameOf(r.peerId)+" was cancelled."+(comment?(" "+comment):""),null,{tab:"requests"});notify(r.peerId,"An approved swap with "+nameOf(r.from)+" was cancelled.",null,{tab:"requests"});}
  else notify(r.from,"Your approved "+(LEAVE_LABEL[r.code]||r.code)+" leave was cancelled."+(comment?(" "+comment):""),null,{tab:"requests"});
  logAudit(r.type+".cancel",(r.type==="swap"?("swap "+nameOf(r.from)+" ↔ "+nameOf(r.peerId)):(nameOf(r.from)+" "+r.code+" "+r.dateFrom+"→"+r.dateTo))+(comment?(" · "+comment):""),"admin");save();}
function requestCancellation(id){const r=S.requests.find(x=>x.id===id);if(!r||r.status!=="approved")return;
  r.cancelState="requested";notify("admin",nameOf(r.from)+" requested to cancel their approved "+(r.type==="swap"?"swap":(LEAVE_LABEL[r.code]||r.code)+" leave")+".",null,{tab:"requests"});
  logAudit(r.type+".cancel-request",(r.type==="swap"?("swap with "+nameOf(r.peerId)):(r.code+" "+r.dateFrom+"→"+r.dateTo)),r.from);save();}
function keepApproval(id){const r=S.requests.find(x=>x.id===id);if(!r)return;r.cancelState=null;notify(r.from,"Your cancellation request was declined — the approval stands.",null,{tab:"requests"});logAudit(r.type+".cancel-declined","kept "+nameOf(r.from),"admin");save();}
function reqActions(r){
  if(["pending","awaiting-peer"].includes(r.status))return `<button class="btn sm" data-withdraw="${r.id}">Withdraw</button>`;
  if(r.status==="approved")return r.cancelState==="requested"?'<span class="tag warn">cancellation requested</span>':`<button class="btn sm" data-reqcancel="${r.id}">Request cancellation</button>`;
  return "";}
const REQ_STATUS={pending:"Pending","awaiting-peer":"Waiting for your colleague",info:"needs your reply",approved:"Approved",declined:"Declined",withdrawn:"Withdrawn",cancelled:"Cancelled"};   // statuses are words, the same words for staff and admin
function reqStatusTag(r){ const st=r.status; if(st==="info")return `<span class="tag warn">${ic("help")} needs your reply</span>`; return `<span class="tag ${st==="approved"?"ok":(st==="declined"?"warn":"muted")}">${escapeHTML(REQ_STATUS[st]||st)}</span>`; }
function reqDates(r){ return r.type==="swap"?(fmtISO(r.dateA)+" ↔ "+fmtISO(r.dateB)):(r.dateFrom===r.dateTo?fmtISO(r.dateFrom):(fmtISO(r.dateFrom)+" – "+fmtISO(r.dateTo))); }
function myReqRow(r){
  const label=r.type==="swap"?("Swap with "+escapeHTML(nameOf(r.peerId))+" · "+reqDates(r)):r.type==="fixed"?("Fixed-pattern change · "+escapeHTML(fixedPatternSummary(r.pattern))):(escapeHTML(LEAVE_LABEL[r.code]||r.code)+" · "+reqDates(r)+(r.reason?(" · "+escapeHTML(r.reason)):""));
  const pill=reqStatusTag(r);
  let rc="";   // a decision you have not seen yet tells you what it did to your roster
  if(r.decidedTs&&r.decidedTs>_reqSeenTs&&(r.status==="approved"||r.status==="declined")){ const when=fmt(new Date(r.decidedTs),{weekday:"short",day:"numeric",month:"short"});
    if(r.status==="approved"&&r.type==="swap"){ const now=getShift(r.from,r.dateB); rc=`Approved ${when} · you now work ${fmtISO(r.dateB)} ${escapeHTML(shiftLabel(now))}; ${fmtISO(r.dateA)} is ${escapeHTML(nameOf(r.peerId))}'s.`; }
    else if(r.status==="approved"&&r.type==="leave")rc=`Approved ${when} · ${reqDates(r)} is off your roster.`;
    else if(r.status==="approved")rc=`Approved ${when}.`;
    else rc=`Declined ${when}.`;
    rc=`<div class="reqrc" role="status"><span class="rcic${r.status==="declined"?" no":""}" aria-hidden="true">${ic(r.status==="declined"?"x":"check")}</span><span class="grow">${rc}</span>${(r.status==="approved"&&r.type!=="fixed")?calBtnHTML(r.from,""):""}</div>`; }
  return `<div class="listrow"><span class="grow">${label} ${pill}${r.adminComment?` · <span class="muted small">${escapeHTML(r.adminComment)}</span>`:""}</span>${reqActions(r)}</div>${rc}${reqThreadHTML(r,["pending","info","awaiting-peer"].includes(r.status))}`;}
function requestAdminCard(r){
  const s=S.staff.find(x=>x.id===r.from)||{name:nameOf(r.from),eft:1,hrsFortnight:76};
  const {days,hrs}=requestHoursDays(r);
  const py=plannerYear(), conf=leaveDaysInRange(r.from,py.from,py.to), confHrs=Math.round(conf*hoursPerDay(s));
  const ov=awayOverlap(r.dateFrom,r.dateTo,r.from), ls=leaveStyle(r.code);
  let peakEft=0; daysInRange(r.dateFrom,r.dateTo).forEach(d=>{peakEft=Math.max(peakEft,eftOffOnDay(d)+(+s.eft||1));}); peakEft=Math.round(peakEft*100)/100;
  const overCap=peakEft>S.leaveCapEft;
  const away=ov.perStaff.length?ov.perStaff.map(o=>`<span class="tag lg cst" style="margin:2px 4px 2px 0;display:inline-block">${escapeHTML(o.staff.name)} (${o.days}d)</span>`).join(""):'<span class="muted small">No one else away</span>';
  return `<div class="card" style="border-left:4px solid ${ls.t}">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="font-size:var(--fs-md)">${escapeHTML(s.name)} — <span style="color:${ls.t}">${escapeHTML(LEAVE_LABEL[r.code]||r.code)}</span></h3><span class="grow"></span><span class="muted small">${reqDates(r)} · ${days} day${days>1?"s":""}</span></div>
    ${r.reason?`<div class="small" style="margin:4px 0">Reason: ${escapeHTML(r.reason)}</div>`:""}
    <div class="grid-tiles" style="margin:10px 0">
      <div class="tile"><div class="k">EFT</div><div class="v">${round2(s.eft)}</div></div>
      <div class="tile"><div class="k">Hrs / fortnight</div><div class="v">${round2(s.hrsFortnight)}</div></div>
      <div class="tile"><div class="k">Confirmed leave (yr)</div><div class="v">${conf}d</div><div class="k">${confHrs} hrs</div></div>
      <div class="tile"><div class="k">This request</div><div class="v">${days}d</div><div class="k">${hrs} hrs</div></div>
      <div class="tile"><div class="k">Peak overlap</div><div class="v">${ov.peak}</div><div class="k">away same day</div></div>
      <div class="tile" ${overCap?'style="background:var(--gap-bg)"':""}><div class="k">EFT off peak (incl.)</div><div class="v" ${overCap?'style="color:var(--danger-t)"':""}>${peakEft}</div><div class="k">cap ${S.leaveCapEft}</div></div>
    </div>
    ${overCap?`<div class="note" style="background:var(--gap-bg);color:var(--danger-t)">${ic("warn")} Approving this would put a day over the leave cap (${peakEft} > ${S.leaveCapEft} EFT).</div>`:""}
    <div class="small" style="margin-bottom:8px"><b>Who else is away these dates:</b> ${away}</div>
    ${reqThreadHTML(r,false)}${r.status==="info"?'<div class="note" style="margin-top:6px">'+ic("help")+' Waiting for their reply — you can still approve or decline.</div>':""}
    <div class="row" style="align-items:flex-end">
      <label class="field" style="flex:1;min-width:180px"><span class="lbl">Comment (optional)</span><input id="cmt-${r.id}" placeholder="Reason / note"></label>
      ${r.status==="pending"?`<button class="btn sm" data-rcask="${r.id}" title="Sends the comment as a question — the request waits for their reply">Ask a question</button>`:""}
      <button class="btn danger" data-decline="${r.id}">Decline</button>
      <button class="btn primary" data-approve="${r.id}">Approve</button>
    </div>
  </div>`;
}
