"use strict";
// moved from js/admin.js lines 1517-1581 (Phase 1 split, no edits)
/* ---------- requests, leave planner, audit, email, export ---------- */
let lastEmail=null, plannerMonth=null;
function requestHoursDays(r){const days=daysInRange(r.dateFrom,r.dateTo).length;const s=S.staff.find(x=>x.id===r.from)||{hrsFortnight:76};return {days:days,hrs:Math.round(days*hoursPerDay(s))};}
function submitLeaveRequest(staffId,from,to,code,reason){
  S.requests.unshift({id:"r"+Date.now(),type:"leave",from:staffId,dateFrom:from,dateTo:to,code:code,reason:reason||"",status:"pending",createdTs:Date.now()});
  notify("admin",nameOf(staffId)+" requested "+(LEAVE_LABEL[code]||code)+" · "+reqDates(S.requests[0])+".",null,{tab:"requests"});
  logAudit("leave.request",(LEAVE_LABEL[code]||code)+" "+from+"→"+to+(reason?(" · "+reason):""),staffId);
  save();
}
function approveRequest(id,comment){
  const r=S.requests.find(x=>x.id===id);if(!r)return;
  r.status="approved";r.decidedTs=Date.now();r.adminComment=comment||"";
  if(r.type==="fixed"){ const s=S.staff.find(x=>x.id===r.from); if(s){ r.pattern.committed=true; s.fixedPattern=r.pattern; }
    notify(r.from,"Your fixed-pattern change was approved."+(comment?(" "+comment):""),null,{tab:"requests"});
    logAudit("fixed.approve",nameOf(r.from)+" · "+fixedPatternSummary(r.pattern)+(comment?(" · "+comment):""),"admin"); save(); return; }
  if(r.type==="leave"){
    const dates=daysInRange(r.dateFrom,r.dateTo);
    const _today=iso(new Date());
    S.cycles.forEach(c=>dates.forEach(d=>{ const k=r.from+"|"+d, was=c.assign[k];
      delete c.assign[k];
      if(was&&was.kind==="clinical"&&d>=_today&&gapOnDrop(c))_postGapBody(c.id,d,was.period,was.zone,was.type||null,"leave approved",null,false);
      ocTakenBy(c,r.from,d).filter(w=>!w.ci).forEach(w=>{ delete c.oncall[ocKey(d,w.id)]; }); }));   // somebody on leave is not carrying the phone either   // not a day already gone, and no push: this runs outside commitGuarded, which is what sends them   // the day a person's leave frees is a gap like any other — the group hears about it
    addLeave({staffId:r.from,from:r.dateFrom,to:r.dateTo,code:r.code,status:"approved",requestId:id}); swTidy();
  }
  notify(r.from,"Your "+(LEAVE_LABEL[r.code]||r.code)+" request for "+reqDates(r)+" was approved."+(comment?(" "+comment):""),null,{tab:"requests"});
  logAudit("leave.approve",nameOf(r.from)+" "+r.code+" "+r.dateFrom+"→"+r.dateTo+(comment?(" · "+comment):""),"admin");
  prepEmail(r,"approved",comment);save();
}
function declineRequest(id,comment){
  const r=S.requests.find(x=>x.id===id);if(!r)return;
  r.status="declined";r.decidedTs=Date.now();r.adminComment=comment||"";
  if(r.type==="fixed"){ notify(r.from,"Your fixed-pattern change was declined."+(comment?(" "+comment):""),null,{tab:"requests"});
    logAudit("fixed.decline",nameOf(r.from)+(comment?(" · "+comment):""),"admin"); save(); return; }
  notify(r.from,"Your "+(LEAVE_LABEL[r.code]||r.code)+" request for "+reqDates(r)+" was declined."+(comment?(" "+comment):""),null,{tab:"requests"});
  logAudit("leave.decline",nameOf(r.from)+" "+r.code+" "+r.dateFrom+"→"+r.dateTo+(comment?(" · "+comment):""),"admin");
  prepEmail(r,"declined",comment);save();
}
function prepEmail(r,decision,comment){
  const s=S.staff.find(x=>x.id===r.from)||{name:nameOf(r.from),email:""};
  lastEmail={to:s.email||s.email2||"",subject:"Leave request "+decision+": "+r.dateFrom+" to "+r.dateTo,
    body:"Dear "+s.name+",\n\nYour request for "+(LEAVE_LABEL[r.code]||r.code)+" leave from "+r.dateFrom+" to "+r.dateTo+" has been "+decision+"."+(comment?("\n\nComment: "+comment):"")+"\n\nKind regards,\nMyrosta — Roster Admin"};
}
function openEmailModal(){
  if(!lastEmail)return;const e=lastEmail;
  const root=document.getElementById("modalRoot");
  openDialog(`<div class="overlay" id="ovlE"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT" style="max-width:540px">
    <h3 id="dlgT">Notification email</h3>
    <div class="muted small" style="margin-bottom:10px">Editable draft. In production this is sent automatically via the hospital mail service / Microsoft 365.</div>
    <label class="field" style="margin-bottom:8px"><span class="lbl">To</span><input id="emTo" value="${escapeHTML(e.to)}" placeholder="staff email"></label>
    <label class="field" style="margin-bottom:8px"><span class="lbl">Subject</span><input id="emSub" value="${escapeHTML(e.subject)}" style="width:100%"></label>
    <label class="field"><span class="lbl">Body</span><textarea id="emBody" rows="9" style="width:100%;font-family:inherit;font-size:var(--fs-md);padding:8px 10px;border:1px solid var(--line2);border-radius:var(--radius-sm)">${escapeHTML(e.body)}</textarea></label>
    <div class="flexbtns" style="margin-top:14px"><button class="btn" id="emCopy">Copy</button><span class="grow"></span><button class="btn" id="emClose">Close</button><button class="btn primary" id="emOpen">Open in email app</button></div>
  </div></div>`);
  const close=closeModal;
  document.getElementById("ovlE").onclick=ev=>{if(ev.target.id==="ovlE")close();};
  document.getElementById("emClose").onclick=close;
  document.getElementById("emCopy").onclick=()=>{try{navigator.clipboard.writeText(document.getElementById("emBody").value);}catch(x){}};
  document.getElementById("emOpen").onclick=()=>{
    const to=document.getElementById("emTo").value,su=document.getElementById("emSub").value,bo=document.getElementById("emBody").value;
    logAudit("email.sent","To "+(to||"(no address)")+" · "+su,"admin");save();
    window.location.href="mailto:"+encodeURIComponent(to)+"?subject="+encodeURIComponent(su)+"&body="+encodeURIComponent(bo);
    close();render();
  };
}
let swapPeer=null, _swapMode="peer", _swapMine=null, _swapNote="";   // the swap sheet: which choice is showing, the shift chosen (Swap it on a day sheet sets it), and any typed note
