"use strict";
// moved from js/admin.js lines 767-892 (Phase 1 split, no edits)
function viewSelfRoster(){
  const cyc=active(), adm=isAdmin(), ds=cycleDates(), _gate=bookingGate(cyc), open=_gate.ok;
  const _p2=n=>String(n).padStart(2,"0"), _dloc=(d,h,m)=>d.getFullYear()+"-"+_p2(d.getMonth()+1)+"-"+_p2(d.getDate())+"T"+_p2(h)+":"+_p2(m);
  const _schDefOpen=_dloc(new Date(Date.now()+864e5),9,0), _schDefClose=_dloc(new Date(Date.now()+6*864e5),17,0);
  const _ph=roundPhase(cyc); let schedBanner="";
  if(_ph.gated){ const w=cyc.window;
    if(_ph.phase==="before")schedBanner=`<div class="schedbar before"><span>${ic("clock")}</span><span><b>Booking opens</b> ${schFmt(w.open)} · ${schUntil(_ph.o)}</span></div>`;
    else if(_ph.phase==="open")schedBanner=`<div class="schedbar open"><span>${ic("live")}</span><span><b>Booking is open</b>${w.close?` — closes ${schFmt(w.close)} · ${schUntil(_ph.c)}`:""}</span></div>`;
    else schedBanner=`<div class="schedbar closed"><span>${ic("lock")}</span><span><b>Booking closed</b>${w.close?` · ${schFmt(w.close)}`:""}</span></div>`;
  }
  let gaps=0; ds.forEach(d=>{const g=dayGap(iso(d));gaps+=g.am+g.pm;});
  let head="";
  if(adm){
    head=roundStepperHTML(cyc,{schDefOpen:_schDefOpen,schDefClose:_schDefClose});
  }
  const summary=`<div class="card" style="padding:12px 16px"><div class="grid-tiles">
    <div class="tile"><div class="k">Cycle</div><div class="v" style="font-size:var(--fs-md)">${cyLabel(cyc)}</div></div>
    <div class="tile"><div class="k">Status</div><div class="v" style="font-size:var(--fs-md)">${escapeHTML(statusLabel(cyc))}</div></div>
    <div class="tile"><div class="k">Coverage gaps</div><div class="v" style="${gaps?"color:var(--rag-r)":""}">${gaps}</div></div>
  </div></div>`;
  if(!S.staff.length)return head+summary+'<div class="card">'+noOneHTML()+'</div>';
  const snakeDraft=S.fairness==="snake"&&!!cyc.draft;
  const wavesOn=S.fairness==="waves"&&!!cyc.waveState;
  let sid;
  if(!adm) sid=S.viewAs;
  else if(snakeDraft&&whoseTurn()) sid=whoseTurn();
  else if(wavesOn){ const cc=currentCohort(); sid=(myPerson&&cc.includes(myPerson))?myPerson:(cc.find(id=>!(cyc.waveState.done&&cyc.waveState.done[id]))||cc[0]||S.staff[0].id); }
  else sid=(myPerson&&S.staff.find(x=>x.id===myPerson))?myPerson:((rosterStaff()[0]||S.staff[0]||{}).id);
  _srSid=sid;
  const s=S.staff.find(x=>x.id===sid);
  if(!s)return head+summary+'<div class="card muted">You\'re no longer on the staff list for this group — ask your admin.</div>';
  const myTurn=(S.fairness!=="snake"||!cyc.draft||whoseTurn()===sid)&&(!wavesOn||currentCohort().includes(sid));
  let booking="";
  if(!open&&!adm){booking=`<div class="card">${cardTitle("Book shifts")}${bookingStatusHTML(cyc,sid,s,"")}<div class="sub">You can view the roster in the <a href="#" data-go="roster">Roster</a> tab.</div></div>`;
    const ciDays=(cyc.status!=="draft"&&!cyc.archived&&ocTakenWindows(cyc).some(ocChosen))?ds.filter(d=>ciOnTime(iso(d))):[];   // closed booking still leaves the way in to log a call-in: the day sheet, on the day or the day after
    if(ciDays.length)booking+=`<div class="card list">${cardTitle("Called in?")}<div class="sub">Open the day to log the hours you worked.</div><div class="srbook daylist">${ciDays.map(d=>dayRowHTML(sid,d,{batch:false,canPick:false,openCount:()=>0})).join("")}</div></div>`;}
  else{
    const canPick=(open||adm)&&myTurn;
    const batch=!snakeDraft;  // non-snake methods select-then-confirm (batch); snake books one per turn
    if(_srPickSid!==sid||!canPick){_srPick=[];_srHours={};_srPickSid=sid;}   // a basket only lives while this person can pick: a passed turn or group drops it
    const personSel=adm?(snakeDraft
      ? `<div class="sub" style="margin-bottom:8px">Booking as <b>${escapeHTML(s.name)}</b> — it's their turn. Each pick passes to the next person automatically; use <b>Skip turn</b> above to move on by hand.</div>`
      : wavesOn
      ? `<div class="row" style="margin-bottom:8px"><label class="field"><span class="lbl">Booking as (Group ${cyc.waveState.current+1})</span><select id="srWho">${currentCohort().map(id=>{const st=S.staff.find(x=>x.id===id);return `<option value="${id}" ${id===sid?"selected":""}>${st?escapeHTML(st.name):id}</option>`;}).join("")}</select></label></div>`
      : `<div class="row" style="margin-bottom:8px"><label class="field"><span class="lbl">Booking as</span><select id="srWho">${rosterStaff().map(x=>`<option value="${x.id}" ${x.id===sid?"selected":""}>${escapeHTML(x.name)}</option>`).join("")}</select></label></div>`):"";
    const openCount=isoD=>{const _fw=_fatigueWarn;let n=0;
      bookableTypes(cyc).filter(t=>adm||t.book!==false).forEach(t=>{ const tk=typeIsDefault(t)?undefined:t.id, pp=t.fills[0];
        if(!periodsUnlocked(isoD,t.fills,sid).ok)return;
        (t.fills.length>1?bothZones():zonesFor(pp)).forEach(z=>{ if(t.fills.some(f=>zoneTaken(isoD,f,z.id,sid)))return; if((batch?pickCheck(sid,isoD,pp,z.id,tk):canBook(sid,isoD,pp,z.id,tk)).ok)n++; }); });
      _fatigueWarn=_fw;return n;};   // the row's count must agree with the chips it opens onto (past days, quota, basket cap, fatigue, turn)
    const rows=ds.map((d,i)=>((i===0||d.getDate()===1)?monthRowHTML(d):"")+dayRowHTML(sid,d,{batch,canPick,openCount})).join("");   // one row per day, the month named where it begins; the day sheet holds the zones, the cover and the reasons
    const turnMsg=snakeDraft?(myTurn?"<b>It's your turn</b> — pick one shift.":"It's <b>"+escapeHTML(nameOf(whoseTurn()))+"</b>'s turn — you'll be told when it's yours."):
      wavesOn?(currentCohort().includes(sid)?"<b>Your group is picking now</b> — book up to your "+(S.quotaPeriod||"fortnight")+" share.":"Group "+(cyc.waveState.current+1)+" is picking now. "+(wavePosOf(sid)<0?"You're not in a group yet — ask your admin to re-draw the groups.":wavePosOf(sid)<cyc.waveState.current?"Your group ("+(wavePosOf(sid)+1)+") has had its turn.":wavePosOf(sid)===cyc.waveState.current+1?"Your group ("+(wavePosOf(sid)+1)+") opens next.":"Your group ("+(wavePosOf(sid)+1)+") opens later.")):
      (instantBookOn()?"Tap a day to see what's open, then a zone marked Open: the shift is yours the moment you tap it — the first tap wins, and you're told at once if a colleague got there first.":"Tap a day to see what's open. Nothing is booked until you confirm — the first to confirm gets a slot, and you're told at once if a colleague got there first.")+(hasExtraSlots()?" Extra slots (beyond the minimum) open only after minimums are met ("+unlockOrderLabel()+").":"");   // the header follows the group switch (12 Oct 2026)
    const w=cyc.waveState;
    let bottomBtns="";
    if(snakeDraft&&canPick)bottomBtns=`<div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="snPass">Pass my turn</button></div>`;
    else if(wavesOn&&currentCohort().includes(sid))bottomBtns=`<div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="wvDone">${(w.done&&w.done[sid])?ic("reply")+" Reopen — I have more to pick":ic("check")+" I'm done — pass my remaining picks"}</button></div>`;
    booking=`<div class="card list">${adm?"<h2>Book shifts</h2>":cardTitle("Book shifts — "+escapeHTML(s.name))}
      ${adm?`<div class="sub">Booked <b>${clinicalCountFor(sid)}</b> / quota ${s.quota}. ${turnMsg}</div>`:bookingStatusHTML(cyc,sid,s,turnMsg)}
      ${wavesOn?waveScheduleHTML(sid):""}
      ${personSel}<div class="srbook daylist">${rows}</div>${batch?srFooterHTML(sid,s):""}${bottomBtns}</div>`;
  }
  return (adm?schedBanner+head+summary:pageHead("Book shifts",escapeHTML(s.name)))+booking;
}
function monthRowHTML(d){ return `<div class="monthrow" role="heading" aria-level="3">${escapeHTML(fmt(d,{month:"long",year:"numeric"}))}</div>`; }   // "November 2026" above the first day of each month in the list
function dayRowHTML(sid,d,ctx){   // one 56px row per day: its state, and a chevron when there is something to do
  const isoD=iso(d), sh=getShift(sid,isoD), pk=ctx.batch?pickFor(isoD):null; let st, cls="";
  const _c=active();
  if(pk){ const a=pk.split("|"), z=zoneById(a[2]), _pt={kind:"clinical",period:a[1],zone:a[2],type:a[3]}; st=`<span class="tag lg brand">${ic("check")} Picked · ${escapeHTML(perName(a[3]||a[1]))} · ${escapeHTML(z?zoneLabelFor(_c,z,_pt):"?")}</span>`; cls=" picked"; }
  else if(sh.kind==="clinical") st=`<span class="tag lg ${typeClass(_c,sh)}">${escapeHTML(shiftLabel(sh)+ownHoursTag(_c,sh))}</span>`;
  else if(sh.kind==="cst") st=`<span class="tag lg cst">${escapeHTML(typeLabelOf(_c,sh)||"CST")}</span>`;
  else if(sh.kind==="leave"){ const ls=leaveStyle(sh.code); st=`<span class="tag lg" style="background:${ls.bg};color:${ls.t}">${escapeHTML(sh.code==="UA"?"Unavailable":ls.name)}</span>`; }
  else { const n=ctx.openCount(isoD); st=`<span class="muted">Off</span><span class="muted small"> · ${n?n+" open":"nothing open"}</span>`; }
  const _ocMine=ocTakenBy(_c,sid,isoD);
  if(_ocMine.length)st+=`<span class="tag oc">${escapeHTML(_ocMine.map(w=>w.label).join(" · "))}</span>`;
  else if(sh.kind==="off"&&ocTakenWindows(_c).some(w=>!ocChosen(w)&&!ocHolder(_c,isoD,w.id)&&(isAdmin()||(w.book!==false&&bookingGate(_c).ok&&ctx.canPick&&!(isRolling(_c)&&isoD<iso(new Date()))))))st+=`<span class="muted small"> \u00b7 on call free</span>`;
  const tappable=true, tag="button";   // every day opens its sheet — a waiting person sees what is open and why each zone is locked for them
  return `<${tag} class="dayrow${cls}${_justBooked.has(isoD)?" just":""}${[0,6].includes(d.getDay())?" we":""}${isPH(isoD)?" ph":""}"${tappable?` data-bday="${isoD}"`:""}><span class="d"><span class="dn">${DOW[d.getDay()]}</span><span class="dd">${d.getDate()}</span><span class="dm">${escapeHTML(fmt(d,{month:"short"}))}</span>${isPH(isoD)?'<span class="tag ph mini">PH</span>':""}</span><span class="grow st">${st}</span>${tappable?ic("chevR"):""}</${tag}>`; }
function dsBookedActs(sid,isoD,cyc){   // under a booked shift on the day sheet: Swap it, Change hours (the group switch on, a day still ahead), and coming off it the way the notice period allows
  const adm=isAdmin(), _today=iso(new Date()), _sh=(cyc.assign||{})[sid+"|"+isoD]||{}, hrOpen=!!(_hrForm&&_hrForm.d===isoD), hrMay=!adm&&sid===S.viewAs&&isoD>=_today&&ownHoursOn();
  const hrIt=(hrMay&&!hrOpen)?`<button class="btn" data-hrchange="${isoD}">${ic("edit")} Change hours</button>`:"";
  const hrForm=(hrMay&&hrOpen)?`<div class="dsact" style="align-items:center"><span class="lbl">Hours</span> <input type="time" class="hrc-from" step="300" value="${escapeHTML(_hrForm.start)}" aria-label="Start" style="width:110px"> <span class="muted small">to</span> <input type="time" class="hrc-to" step="300" value="${escapeHTML(_hrForm.end)}" aria-label="Finish" style="width:110px"> <button class="btn primary sm" data-hrsave="${isoD}">Save</button><button class="btn sm" data-hrcancel="${isoD}">Cancel</button>${_sh.hours?`<button class="btn sm" data-hrclear="${isoD}">Same as the type</button>`:""}</div><div class="muted small">Your admin is told. Pay, the calendar and reminders use these hours.</div>`:"";   // like logging a call-in: Save and Cancel, and back to the type's window when the hours are the booking's own
  const swapIt=((sid===S.viewAs&&isoD>=_today)?`<button class="btn" data-swapit="${isoD}">${ic("swap")} Swap it</button>`:"")+hrIt;
  if(adm||(!inNotice(isoD,cyc)&&!_sh.fixed))return `<div class="dsact">${swapIt}<button class="btn danger" data-osdrop="${isoD}">Remove this shift</button></div>${(!adm&&gapOnDrop(cyc))?`<div class="muted small">Coming off tells the group \u2014 it goes up as an open shift.</div>`:""}`+hrForm;
  const note=`<div class="note">${ic("lock")} ${escapeHTML(_sh.fixed?"Fixed shift \u2014 offer it to the group or swap it; you stay on it until a colleague takes it or your admin lets you off. Only your admin can remove it outright.":noticeReason(isoD,cyc))}</div>`, swapOnly=swapIt?`<div class="dsact">${swapIt}</div>`:"";   // a fixed shift takes the same paths as a shift inside the notice period: a give-away, an ask, a swap — never a plain removal (10 Oct 2026)
  if(featOn("marketplace")&&S.marketOn&&!offeredAlready(sid,isoD)&&!askOn(sid,isoD))return note+`<div class="dsact"><button class="btn primary" data-osoffer="${isoD}">${ic("arrowUR")} Offer it to the group</button><button class="btn" data-osask="${isoD}">Ask to come off</button>${swapIt}</div><div class="muted small">Offering it is enough on its own. Asking is for when you need to be off it whether or not a colleague takes it.</div>`+hrForm;
  if(offeredAlready(sid,isoD))return note+`<div class="note">${ic("check")} ${askOn(sid,isoD)?"Offered to the group, and your admin has been asked \u2014 you\u2019re on it until one of them answers.":"Offered to the group \u2014 you\u2019re on it until a colleague takes it."}</div>`+swapOnly+hrForm;
  return note+(askOn(sid,isoD)?`<div class="note">${ic("check")} Your admin has been asked \u2014 you\u2019re on it until they answer.</div>`+swapOnly:(isoD<iso(new Date())?"":`<div class="dsact">${swapIt}<button class="btn" data-osask="${isoD}">Ask to come off</button></div>`))+hrForm; }   // open shifts off: asking goes to the admins alone, and never about a day already gone
function daySheetHTML(isoD){   // the day sheet: AM | PM, cover, one chip per zone with the reason it is or isn't open, then the secondary marks
  const sid=_srSid||S.viewAs, s=S.staff.find(x=>x.id===sid); if(!s)return ""; const cyc=active(), adm=isAdmin(), sh=getShift(sid,isoD);
  const snakeDraft=S.fairness==="snake"&&!!cyc.draft, wavesOn=S.fairness==="waves"&&!!cyc.waveState, batch=!snakeDraft;
  const myTurn=(!snakeDraft||whoseTurn()===sid)&&(!wavesOn||currentCohort().includes(sid)), canPick=(bookingGate(cyc).ok||adm)&&myTurn;
  const _bt=bookableTypes(cyc).filter(t=>adm||t.book!==false);
  const _ty=_bt.find(t=>t.id===_sheetPeriod)||_bt.find(t=>t.id==="AM")||_bt[0]||null;
  const tid=_ty?_ty.id:"AM", tfills=(_ty&&_ty.fills.length)?_ty.fills:["AM"], p=tfills[0], tkey=(_ty&&!typeIsDefault(_ty))?tid:"";   // a builtin half carries no fourth segment, so an existing pick key is unchanged
  const pk=pickFor(isoD);
  const head=`<div class="dshead"><div><b>${escapeHTML(fmtISO(isoD))}</b>${isPH(isoD)?' <span class="tag ph mini">PH</span>':""}${adm?` <span class="muted small">· ${escapeHTML(s.name)}</span>`:""}</div><button class="btn sm" id="dsClose">Done</button></div>`;
  let body="";
  if(sh.kind==="leave"&&sh.code!=="UA") body=`<div class="sub">On leave — ${escapeHTML(leaveStyle(sh.code).name)}. Change it through <a href="#" data-go="requests">Requests</a>.</div>`;
  else if(sh.kind==="leave") body=`<div class="sub">Marked unavailable for this day.</div>${canPick?`<div class="dsact"><button class="btn" data-rmua="${isoD}">Remove unavailable</button></div>`:""}`;
  else if(sh.kind==="clinical") body=`<div class="sub">Booked: <b>${escapeHTML(shiftLabel(sh))}</b> · ${(function(){ const _w=shiftWindow(cyc,sh)||{}; return _w.own?(escapeHTML(windowStr(_w))+" (own hours)"):(isFullShift(cyc,sh)?("the whole day "+escapeHTML(shTimeStr(cyc,sh))):("starts "+escapeHTML(_w.start||""))); })()}${clockMarkHTML(cyc,sid,isoD)}</div>${canPick&&(adm||!isRolling(cyc)||isoD>=iso(new Date()))?dsBookedActs(sid,isoD,cyc):""}`;
  else if(!canPick&&(!bookingGate(cyc).ok||sh.kind==="cst")) body=`<div class="sub">${sh.kind==="cst"?"Clinical support time (CST).":"Off."} ${escapeHTML(bookingGate(cyc).ok?"":(bookingGate(cyc).reason||""))}</div>`;
  else {
    const cc=clinicalCounts(isoD,sid);
    const covOf=f=>({min:f==="AM"?effStaffing().amMin:effStaffing().pmMin, max:Math.min(f==="AM"?effStaffing().amMax:effStaffing().pmMax,zonesFor(f).length), cur:f==="AM"?cc.am:cc.pm});
    const seg=`<div class="seg dsper">${_bt.map(t=>`<button data-dsper="${t.id}" class="${t.id===tid?"on":""}">${escapeHTML(t.label)}</button>`).join("")}</div>`;
    const q=+s.quota||0, atShare=batch&&(S.quotaCapMode||"hard")==="hard"&&q>0&&clinicalCountFor(sid)+_srPick.filter(k=>k.indexOf(isoD+"|")!==0).reduce((a,k)=>a+pickUnits(k),0)+1>q;   // the share is used up only when even a half shift will not fit
    const covLine=tfills.map(f=>{const c=covOf(f); return escapeHTML(perName(f))+" cover "+c.cur+" of "+c.max+" · minimum "+c.min+(c.cur<c.min?" — still filling":"");}).join(" · ");
    const sib=tfills.map(f=>sibLinesHTML(isoD,f)).join(""); const cover=`<div class="muted small">${covLine}</div>${tfills.length>1?`<div class="muted small">A ${escapeHTML(_ty.label.toLowerCase())} shift fills one of each, and takes two of your share.</div>`:""}${atShare?`<div class="note" style="margin:8px 0">You've booked your share for this cycle (${q}). Remove a shift to move it here.</div>`:""}`;
    const _fwKeep=_fatigueWarn; const _zl=tfills.length>1?bothZones():zonesFor(p);
    const chips=_zl.map(z=>{ const key=isoD+"|"+p+"|"+z.id+(tkey?"|"+tkey:""), sel=batch&&pk===key;
      let taken=null; for(let i=0;i<tfills.length&&!taken;i++)taken=zoneTaken(isoD,tfills[i],z.id,sid);
      const chk=taken?{ok:false,reason:"Taken by "+shortNm(taken)}:(batch?pickCheck(sid,isoD,p,z.id,tkey||undefined):canBook(sid,isoD,p,z.id,tkey||undefined));
      return `<button class="zchip${sel?" on":""}" data-${batch?"pick":"book"}="${key}"${(!chk.ok&&!sel)?" disabled":""}><b>${escapeHTML(zoneLabelFor(cyc,z,{kind:"clinical",period:p,type:tkey||undefined}))}</b><span class="zsub">${sel?"Picked — tap to unpick":(chk.ok?"Open":escapeHTML(chk.reason)+(taken?tagChipsHTML(taken):""))}</span></button>`; }).join(""); _fatigueWarn=_fwKeep;   // the chips are a dry-run — leave only what a real commit had pending
    const _cstT=typeById(cyc,"CST"), _cstL=(_cstT&&(_cstT.long||_cstT.label))||"clinical support time";
    const _cj=(featOn("cst")&&sh.kind!=="cst")?cstJudge(sid,isoD):{ok:true};   // the CST quota, judged as a clinical pick is; a day already marked is never judged against itself
    const cst=(featOn("cst")&&_cstT&&_cstT.on!==false&&(adm||_cstT.book!==false))?`<button class="btn${sh.kind==="cst"?" primary":""}" data-setcst="${isoD}"${_cj.ok?"":" disabled"}>${sh.kind==="cst"?ic("check")+" "+escapeHTML(_cstL.charAt(0).toUpperCase()+_cstL.slice(1)):"Mark "+escapeHTML(_cstL)}</button>`:"";
    const cstNote=(cst&&(!_cj.ok||_cj.flag))?`<div class="muted small">${escapeHTML(_cj.reason||_cj.flag)}</div>`:"";
    const hrs=(ownHoursOn()&&batch&&pk&&canPick)?(function(){ const _pt=typeById(cyc,pk.split("|")[3]||pk.split("|")[1]), _h=_srHours[isoD]||(_pt?{start:_pt.start,end:_pt.end}:{start:"",end:""}); return `<div class="dsact" style="align-items:center"><span class="lbl">Hours</span> <input type="time" class="hr-from" step="300" value="${escapeHTML(_h.start)}" aria-label="Start" style="width:110px"> <span class="muted small">to</span> <input type="time" class="hr-to" step="300" value="${escapeHTML(_h.end)}" aria-label="Finish" style="width:110px"></div><div class="muted small">Your own start and finish for this shift, if they differ from the ${escapeHTML(_pt?_pt.label:"")} hours. Pay, the calendar and reminders use them.</div>`; })():"";   // the hours typed here go with the pick, and are written on Confirm
    body=_ty?`${seg}${cover}${sib}<div class="zchips">${chips||'<div class="muted small">No zone runs this period.</div>'}</div>${hrs}
      ${canPick?`${cstNote}<div class="dsact">${cst}<button class="btn" data-setoff="${isoD}">Mark off</button><button class="btn" data-setua="${isoD}">Mark unavailable (UA)</button></div>`:""}
      <div class="muted small">Annual, CME and other leave goes through <a href="#" data-go="requests">Requests</a>.</div>`
      :`<div class="sub">Your admin hasn\u2019t opened a shift type for booking yet.</div>`; }   // nothing bookable: say so rather than offering a shift nobody may take
  body+=ocSheetHTML(cyc,sid,isoD,adm,canPick); body+=clockSheetHTML(cyc,sid,isoD);
  return `<div class="overlay sheetwrap" id="ovlDay"><div class="sheet daysheet" role="dialog" aria-modal="true" aria-label="${escapeHTML(fmtISO(isoD))}"><div class="sheetgrab"></div>${head}${body}</div></div>`; }
function srHoursFor(cyc,isoD,p,typeId){ const h=_srHours[isoD]; if(!h)return {ok:true,hours:null};
  const a=String(h.start||"").trim(), b=String(h.end||"").trim(); if(!a&&!b)return {ok:true,hours:null};
  if(!hoursOK(a,b))return {ok:false,reason:HOURS_RULE};
  return {ok:true,hours:hoursNorm(cyc,{kind:"clinical",period:p,type:typeId||undefined},a,b)}; }   // what was typed beside a pick: nothing, the type's own window (nothing to store), a pair to store, or a pair the rule refuses
