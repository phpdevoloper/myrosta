"use strict";
// moved from js/admin.js lines 2896-3062 (Phase 1 split, no edits)
/* ---------- modal: assign a cell ---------- */
let modal={staffId:null,isoD:null,draft:null};
function openCell(staffId,isoD){
  _ciForm=null; modal={staffId,isoD,draft:Object.assign({},getShift(staffId,isoD))};
  renderModal();
}
function renderModal(){
  const root=document.getElementById("modalRoot");
  const s=S.staff.find(x=>x.id===modal.staffId);const d=parseISO(modal.isoD);
  const draft=modal.draft;
  const kind=draft.kind||"off";
  const period=draft.period||"AM";
  const _cy=active(), _types=bookableTypes(_cy), _tid=draft.type||period;
  const _dt=typeById(_cy,_tid)||_types[0]||null, _dfills=(_dt&&_dt.fills.length)?_dt.fills:[period];
  function periodBtn(t){   // one button per shift type this cycle offers — with two types that is the AM|PM pair it has always been
    const u=periodsUnlocked(modal.isoD,t.fills,modal.staffId);
    const on=kind==="clinical"&&_tid===t.id;
    return `<button data-period="${t.id}" role="radio" aria-checked="${on?"true":"false"}" tabindex="${on?"0":"-1"}" class="${on?"on":""}" ${u.ok||on?"":"disabled"} title="${u.ok?"":escapeHTML(u.reason||"")}">${escapeHTML(t.label)} ${typeTime(t)}</button>`;
  }
  let zoneHTML="";
  if(kind==="clinical"){
    const zs=_dfills.length>1?bothZones():zonesFor(period);   // a shift that spans the day needs a zone that runs in both halves
    zoneHTML=`<div class="zonebtns" id="zoneChoices" role="radiogroup" aria-label="Zone">`+zs.map(z=>{
      let taken=null; for(let i=0;i<_dfills.length&&!taken;i++)taken=zoneTaken(modal.isoD,_dfills[i],z.id,modal.staffId);
      const on=draft.zone===z.id;
      return `<button data-zone="${z.id}" role="radio" aria-checked="${on?"true":"false"}" class="${on?"on":""}" ${taken&&!on?"disabled":""}>
        ${escapeHTML(zoneLabelFor(_cy,z,{kind:"clinical",period:period,type:draft.type}))}${taken?`<div class="taken">${escapeHTML(taken.initials)} has it</div>`:""}</button>`;
    }).join("")+`</div>`;
    const u=periodsUnlocked(modal.isoD,_dfills,modal.staffId);
    if(!u.ok&&!(getShift(modal.staffId,modal.isoD).kind==="clinical"&&getShift(modal.staffId,modal.isoD).period===period))
      zoneHTML+=`<div class="note">${ic("lock")} ${u.reason}</div>`;
  }
  let leaveHTML="";
  if(kind==="leave"){
    leaveHTML=`<label class="field" style="margin-top:8px"><span class="lbl">Leave type</span>
      <select id="leaveSel">${LEAVE_CODES.map(c=>`<option value="${c}" ${draft.code===c?"selected":""}>${c} — ${LEAVE_LABEL[c]}</option>`).join("")}</select></label>`;
  }
  openDialog(`<div class="overlay" id="ovl"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT">
    <h3 id="dlgT">${escapeHTML(s.name)}</h3>
    <div class="muted small" style="margin-bottom:6px">${d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
    ${(isAdmin()&&String(s.notes||"").trim())?`<div class="muted small" style="margin-bottom:6px" title="${escapeHTML(String(s.notes).trim())}">${ic("edit")} ${escapeHTML(String(s.notes).trim().split("\n")[0].slice(0,160))}</div>`:""}
    ${draft.note?`<div class="note">${ic("edit")} Note: ${escapeHTML(draft.note)}${draft.noteBy?" — "+escapeHTML(draft.noteBy):""}</div>`:""}
    <div class="seg" id="kindSeg" role="radiogroup" aria-label="Day type">
      <button data-kind="off" role="radio" aria-checked="${kind==="off"?"true":"false"}" tabindex="${kind==="off"?"0":"-1"}" class="${kind==="off"?"on":""}">Off</button>
      <button data-kind="clinical" role="radio" aria-checked="${kind==="clinical"?"true":"false"}" tabindex="${kind==="clinical"?"0":"-1"}" class="${kind==="clinical"?"on":""}">Shift</button>
      ${(featOn("cst")||kind==="cst")?`<button data-kind="cst" role="radio" aria-checked="${kind==="cst"?"true":"false"}" tabindex="${kind==="cst"?"0":"-1"}" class="${kind==="cst"?"on":""}">CST</button>`:""}
      <button data-kind="leave" role="radio" aria-checked="${kind==="leave"?"true":"false"}" tabindex="${kind==="leave"?"0":"-1"}" class="${kind==="leave"?"on":""}">Leave</button>
    </div>
    ${kind==="clinical"?`<div class="seg" id="periodSeg" role="radiogroup" aria-label="Shift type">${_types.map(periodBtn).join("")}</div>${_types.map(t=>{const u=periodsUnlocked(modal.isoD,t.fills,modal.staffId);return (!u.ok&&_tid!==t.id)?`<div class="note">${ic("lock")} ${escapeHTML(t.label)}: ${escapeHTML(u.reason)}</div>`:"";}).join("")}`:""}
    ${zoneHTML}
    ${kind==="clinical"?`<label style="display:flex;align-items:center;gap:7px;margin-top:10px;font-size:var(--fs-sm);color:var(--text);cursor:pointer"><input type="checkbox" id="locumChk" ${draft.locum?"checked":""}> Locum cover (covering a sickness / leave gap)</label>`:""}
    ${kind==="clinical"?(function(){ const _h=modalHours(draft,_cy); return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px"><span class="lbl">Hours</span> <input type="time" id="hrFrom" step="300" value="${escapeHTML(_h.start)}" aria-label="Start" style="width:110px"> <span class="muted small">to</span> <input type="time" id="hrTo" step="300" value="${escapeHTML(_h.end)}" aria-label="Finish" style="width:110px"> <button class="btn sm" id="hrSame" type="button">Same as the type</button></div><div class="muted small">Own hours when they differ from the type${_dt?" ("+typeTime(_dt)+")":""}: pay, the calendar, reminders and the safe-hours rules read them; cover still counts the half.</div>`; })():""}
    ${leaveHTML}
    ${ocTakenWindows(_cy).filter(w=>!ocChosen(w)).length?`<div class="sub" style="margin-top:12px"><b>On call</b> <span class="muted small">\u00b7 saved as you tap, separately from the shift above</span></div>
      <div class="zonebtns" id="ocChoices">${ocTakenWindows(_cy).filter(w=>!ocChosen(w)).map(w=>{ const holder=ocHolder(_cy,modal.isoD,w.id), mine=holder===modal.staffId;
        return `<button data-ocset="${w.id}" class="${mine?"on":""}" title="${escapeHTML(ocTime(w))}">${escapeHTML(w.label)}${holder&&!mine?`<div class="taken">${escapeHTML((S.staff.find(x=>x.id===holder)||{initials:"?"}).initials||"?")} has it</div>`:""}</button>`; }).join("")}</div>`:""}
    ${ocTakenWindows(_cy).filter(ocChosen).length?`<div class="sub" style="margin-top:12px"><b>Call-ins</b> <span class="muted small">\u00b7 saved on their own, separately from the shift above</span></div>${ocTakenWindows(_cy).filter(ocChosen).map(w=>ciModalRowHTML(_cy,modal.staffId,modal.isoD,w)).join("")}`:""}
    ${needsComment()?`<label class="field" style="margin-top:10px"><span class="lbl">Reason for change (required — published roster)</span><input id="editCmt" value="${escapeHTML(draft.note||"")}" placeholder="e.g. swap cover, sickness"></label>`:""}
    <div class="flexbtns" style="margin-top:16px">
      ${getShift(modal.staffId,modal.isoD).kind!=="off"?`<button class="btn danger" id="mRemove">Remove shift</button>`:""}
      <span class="grow"></span>
      <button class="btn" id="mCancel">Cancel</button>
      <button class="btn primary" id="mSave">Save</button>
    </div>
  </div></div>`,{focus:_refocus||"#kindSeg .on"});
  // wire modal
  root.querySelector("#ovl").onclick=e=>{if(e.target.id==="ovl")closeModal();};
  root.querySelectorAll("[data-kind]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.kind;modal.draft={kind:k}; _refocus='[data-kind="'+k+'"]';
    if(k==="clinical"){ const t0=bookableTypes(active())[0]; modal.draft.period=(t0&&t0.fills[0])||"AM"; if(t0&&!typeIsDefault(t0))modal.draft.type=t0.id; }
    if(k==="leave")modal.draft.code="AL";
    renderModal();
  });
  root.querySelectorAll("[data-period]").forEach(b=>b.onclick=()=>{ const id=b.dataset.period, t=typeById(active(),id);
    modal.draft.period=(t&&t.fills&&t.fills.length)?t.fills[0]:id;
    if(t&&!typeIsDefault(t))modal.draft.type=t.id; else delete modal.draft.type;   // the two builtin halves are stored as a bare period, exactly as before
    delete modal.draft.zone; delete modal.draft.hours;_refocus='[data-period="'+id+'"]';renderModal();});   // a new type brings its own window: the Hours row starts again from it
  root.querySelectorAll('[role="radiogroup"]').forEach(g=>g.onkeydown=e=>{   // the radiogroup contract: arrows move the choice; only the checked one sits in the Tab order
    const step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key]; if(!step)return;
    const rs=Array.from(g.querySelectorAll('[role="radio"]:not([disabled])')); const i=rs.indexOf(e.target); if(i<0)return;
    e.preventDefault(); rs[(i+step+rs.length)%rs.length].click(); });
  root.querySelectorAll("[data-zone]").forEach(b=>b.onclick=()=>{modal.draft.zone=b.dataset.zone;_refocus='[data-zone="'+b.dataset.zone+'"]';renderModal();});
  root.querySelectorAll("[data-ocset]").forEach(b=>b.onclick=()=>{ const w=b.dataset.ocset, holder=ocHolder(active(),modal.isoD,w);
    if(holder===modal.staffId)ocClear(modal.staffId,modal.isoD,w); else ocTake(modal.staffId,modal.isoD,w);
    _refocus='[data-ocset="'+w+'"]'; renderModal(); });
  root.querySelectorAll("[data-mciopen]").forEach(b=>b.onclick=()=>{ if(ciOpenForm(b.dataset.mciopen)){ _refocus=".ci-from"; renderModal(); } });
  root.querySelectorAll("[data-mcicancel]").forEach(b=>b.onclick=()=>{ _ciForm=null; renderModal(); });
  root.querySelectorAll("[data-mcisave]").forEach(b=>b.onclick=()=>{ const f=root.querySelector(".ci-from"), t=root.querySelector(".ci-to"); ciSaveForm(b.dataset.mcisave,f?f.value:"",t?t.value:""); renderModal(); });
  root.querySelectorAll("[data-mcidel]").forEach(b=>b.onclick=()=>{ const p=ciParse(b.dataset.mcidel); if(!p)return; ciRemove(p.sid,p.d,p.win); renderModal(); });
  const ls=root.querySelector("#leaveSel");if(ls)ls.onchange=e=>{modal.draft.code=e.target.value;};
  const lck=root.querySelector("#locumChk");if(lck)lck.onchange=e=>{modal.draft.locum=e.target.checked;};
  const hrF=root.querySelector("#hrFrom"), hrT=root.querySelector("#hrTo"), hrKeep=()=>{ modal.draft.hours={start:hrF.value||"",end:hrT.value||""}; };   // a new object each time: the stored booking is never edited before Save
  if(hrF&&hrT){ hrF.onchange=hrKeep; hrT.onchange=hrKeep; }
  const hrS=root.querySelector("#hrSame"); if(hrS)hrS.onclick=()=>{ delete modal.draft.hours; _refocus="#hrFrom"; renderModal(); };
  root.querySelector("#mCancel").onclick=closeModal;
  const rm=root.querySelector("#mRemove");
  if(rm)rm.onclick=()=>{
    if(needsComment()){const c=(document.getElementById("editCmt").value||"").trim();if(!c){fieldError(document.getElementById("editCmt"),"Add a reason — the roster is published.");return;}logAudit("roster.edit",s.name+" "+modal.isoD+" → cleared · "+c,"admin");}
    setShift(modal.staffId,modal.isoD,{kind:"off"});closeModal();render();};
  root.querySelector("#mSave").onclick=()=>{
    let sh=modal.draft, _ov=null, _cstOver=null;
    if(sh.kind==="clinical"&&!sh.zone){fieldError(root.querySelector("#zoneChoices"),"Choose a zone before saving.");return;}
    const _ph=(function(){ const p=getShift(modal.staffId,modal.isoD); return (p.kind==="clinical"&&p.hours)?p.hours:null; })();   // the hours the cell held before this Save, for the audit line
    if(sh.kind==="clinical"){ const _hc=modalHoursCheck(active(),sh); if(!_hc.ok){fieldError(root.querySelector("#hrFrom"),_hc.reason);return;} }
    if(sh.kind==="clinical"){
      const _mf=fillsOf(active(),sh);
      const u=periodsUnlocked(modal.isoD,_mf,modal.staffId);
      const prev=getShift(modal.staffId,modal.isoD);
      const sameSlot=prev.kind==="clinical"&&prev.period===sh.period&&(prev.type||null)===(sh.type||null);
      if(!u.ok&&!sameSlot){fieldError(root.querySelector("#periodSeg"),u.reason);return;}
      let takenBy=null,_tf=sh.period; for(let i=0;i<_mf.length&&!takenBy;i++){ takenBy=zoneTaken(modal.isoD,_mf[i],sh.zone,modal.staffId); if(takenBy)_tf=_mf[i]; }   // admins are not exempt from double-booking a zone — mirror canBook
      if(takenBy){fieldError(root.querySelector("#zoneChoices"),(zoneById(sh.zone)?zoneById(sh.zone).name:"That zone")+" is already covered by "+takenBy.name+" that "+perName(_tf)+" — pick another zone.");return;}
      const _fvm=fatigueCheck(modal.staffId,modal.isoD,sh.period,sh.zone,sh.type,sh.hours);
      if(_fvm&&effFatigue().mode!=="off")toast("Fatigue rule: "+_fvm,"warn");   // admin assign: warn, never silently block
    }
    if(sh.kind==="leave"&&!sh.code)sh.code="AL";
    if(sh.kind==="cst"&&featOn("cst")&&getShift(modal.staffId,modal.isoD).kind!=="cst"){ const _cj=cstJudge(modal.staffId,modal.isoD); if(!_cj.ok||_cj.flag){ const _w=_cj.reason||_cj.flag; if(!confirm(_w+"\n\nPlace "+nameOf(modal.staffId)+" anyway?"))return; _cstOver=_w; } }   // the CST quota is a warning for an admin, never a block
    let _cmt=null;
    if(needsComment()){
      _cmt=(document.getElementById("editCmt").value||"").trim();
      if(!_cmt){fieldError(document.getElementById("editCmt"),"Add a reason — the roster is published.");return;}   // the reason is asked for before any rule warning, so nobody confirms twice
    }
    if(sh.kind==="clinical"){ const _pv=getShift(modal.staffId,modal.isoD), _same=_pv.kind==="clinical"&&_pv.zone===sh.zone&&_pv.period===sh.period&&(_pv.type||null)===(sh.type||null);
      if(!_same){ const _pc=adminPlaceCheck(modal.staffId,modal.isoD,sh); if(!_pc.ok)return; _ov=_pc.over; } }   // a tag rule is a warning here, never a block: the judge's sentence, then Place anyway; re-saving the same cell (a note, say) is not asked again
    if(_cmt!==null){ if(sh.kind!=="off"){sh.note=_cmt;sh.noteBy="Admin";sh.noteTs=Date.now();} logAudit("roster.edit",s.name+" "+modal.isoD+" → "+shiftLabel(sh)+" · "+_cmt,"admin"); }
    if(_ov)adminOverrideAudit(modal.staffId,modal.isoD,sh,_ov);   // written down only when the placement goes through
    if(_cstOver)logAudit("cst.override",nameOf(modal.staffId)+" "+modal.isoD+" \u00b7 "+_cstOver,"admin");
    if(sh.kind==="clinical")hoursAudit(modal.staffId,modal.isoD,sh,_ph,"admin");   // hours.set or hours.clear, only when the pair changed
    setShift(modal.staffId,modal.isoD,sh);closeModal();render();
  };
}
let _dlgReturn=null, _dlgReturnSel=null, _refocus=null, _renderFocus=null;   // the element to give focus back to when a dialog closes (+ its data address, to re-find it after a render replaced it); the control to refocus after a dialog re-renders itself; the address render() refocuses after a close-then-render
function focusKey(el){ if(!el||!el.tagName||el===document.body)return null; const esc=v=>String(v).replace(/["\\]/g,"\\$&"); if(el.id)return "#"+el.id.replace(/([^\w-])/g,"\\$1"); const ks=Object.keys(el.dataset||{}); return ks.length?el.tagName.toLowerCase()+ks.map(k=>"[data-"+k.replace(/[A-Z]/g,m=>"-"+m.toLowerCase())+'="'+esc(el.dataset[k])+'"]').join(""):null; }   // an address for a control that render() will rebuild: an id, or tag + data attributes (cellbtn data-s/data-d, pmday data-pday, stoggle, tabs)
function setInert(on,nav){ const a=document.getElementById("app"); if(a)a.inert=!!on; const tb=document.querySelector(".topbar"); if(tb)tb.inert=!!on; const bn=document.getElementById("bottomnav"); if(bn)bn.inert=!!(on&&nav); }   // sheets keep the bottom bar live (its More button closes them); modals take everything
function openDialog(html,o){ o=o||{}; const root=document.getElementById("modalRoot"); if(!root.innerHTML){ _dlgReturn=(document.activeElement&&document.activeElement!==document.body)?document.activeElement:null; _dlgReturnSel=focusKey(_dlgReturn); }
  root.innerHTML=html; setInert(true,true);
  const f=(o.focus&&root.querySelector(o.focus))||root.querySelector("input:not([type=checkbox]),select,textarea,button"); if(f&&f.focus)try{f.focus();}catch(e){} return root; }
let _cfPending=null;   // the open confirm dialog's resolver — anything that closes the modal answers "no"
function openConfirm(o){   // a real dialog in place of confirm(): title, body, one named action; resolves true/false (o.onDone gets the answer synchronously too)
  o=o||{}; return new Promise(res=>{ let done=false;
    const fin=v=>{ if(done)return; done=true; _cfPending=null; closeModal(); if(o.onDone)try{o.onDone(v);}catch(e){} res(v); };
    openDialog(`<div class="overlay" id="ovlCf"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"${o.body?' aria-describedby="cfBody"':""}><h3 id="dlgT">${escapeHTML(o.title||"Are you sure?")}</h3>${o.body?`<div class="sub" id="cfBody" style="white-space:pre-line;margin-bottom:0">${escapeHTML(o.body)}</div>`:""}<div class="flexbtns" style="margin-top:16px"><span class="grow"></span><button class="btn" id="cfCancel">Cancel</button><button class="btn ${o.danger?"danger":"primary"}" id="cfOk">${escapeHTML(o.ok||"OK")}</button></div></div></div>`,{focus:"#cfOk"});
    _cfPending=fin;
    const okb=document.getElementById("cfOk"), cb=document.getElementById("cfCancel"), ov=document.getElementById("ovlCf");
    if(okb)okb.onclick=()=>fin(true); if(cb)cb.onclick=()=>fin(false);
    if(ov){ ov.onclick=e=>{ if(e&&e.target===ov)fin(false); }; ov.onkeydown=e=>{ if(e&&e.key==="Escape"){ if(e.preventDefault)e.preventDefault(); fin(false); } }; } }); }
function closeModal(){ const root=document.getElementById("modalRoot"); root.innerHTML=""; _ciForm=null; lastEmail=null; _refocus=null; if(_cfPending){ const f=_cfPending; _cfPending=null; f(false); }
  setInert(!!(_daySheet||_reqSheet||_moreOpen||_notifsOpen),false);
  let b=_dlgReturn; const sel=_dlgReturnSel; _dlgReturn=null; _dlgReturnSel=null;
  if(b&&sel&&document.contains&&!document.contains(b))b=document.querySelector(sel);   // a background render rebuilt the page while the dialog was open — re-find the opener by its address
  if(b&&b.focus&&(!document.contains||document.contains(b)))try{b.focus();}catch(e){}
  _renderFocus=sel; setTimeout(()=>{_renderFocus=null;},0); }   // Save/Remove/leave/feedback call render() in the same tick, which rebuilds #app and detaches the opener: render() re-finds the address; a close with no render drops it before it could steal focus later
function openPlannerCell(staffId,isoD){
  const root=document.getElementById("modalRoot");const cur=getShift(staffId,isoD);
  const codes=["AL","CME","LSL","Sab","PL","UA","PH","Other"];
  openDialog(`<div class="overlay" id="ovlP"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT">
    <h3 id="dlgT">${escapeHTML(nameOf(staffId))}</h3>
    <div class="muted small" style="margin-bottom:8px">${parseISO(isoD).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}${cur.kind==="clinical"?" · currently rostered "+escapeHTML(shiftLabel(cur))+" (setting leave will clear it)":(cur.kind==="leave"?" · currently "+escapeHTML(LEAVE_LABEL[cur.code]||cur.code):"")}</div>
    <div class="zonebtns">${codes.map(c=>{const l=leaveStyle(c);return `<button data-pcode="${c}" style="background:${l.bg};color:${l.t};border-color:${l.t}">${c} — ${LEAVE_LABEL[c]||c}</button>`;}).join("")}</div>
    <div class="flexbtns" style="margin-top:14px">${cur.kind==="leave"?`<button class="btn danger" id="pClear">Clear leave</button>`:""}<span class="grow"></span><button class="btn" id="pCancel">Cancel</button></div>
  </div></div>`);
  root.querySelector("#ovlP").onclick=e=>{if(e.target.id==="ovlP")closeModal();};
  root.querySelector("#pCancel").onclick=closeModal;
  const pc=root.querySelector("#pClear");if(pc)pc.onclick=()=>{plannerSetLeave(staffId,isoD,"");closeModal();render();};
  root.querySelectorAll("[data-pcode]").forEach(b=>b.onclick=()=>{plannerSetLeave(staffId,isoD,b.dataset.pcode);closeModal();render();});
}

