"use strict";

/* ---------- wiring ---------- */
function cycleRemovalNote(c,sid,shiftN){ const ciN=(c&&c.callins)?Object.keys(c.callins).filter(k=>{ const p=ciParse(k); return !!p&&p.sid===sid&&ciValid(c.callins[k]); }).length:0;
  const what=[shiftN?shiftN+" shift(s)":"",ciN?ciN+" call-in(s)":""].filter(Boolean).join(" and ");
  return what?"\n\nTheir "+what+" in THIS cycle will be cleared.":""; }   // what Remove from this cycle clears for this person: their shifts, and the call-ins ciDropFor removes
function wireStaffRows(){
    document.querySelectorAll("[data-s]").forEach(rowEl=>{
      const id=rowEl.dataset.s;const s=S.staff.find(x=>x.id===id); if(!s)return;
      const on=(sel,fn)=>{const el=rowEl.querySelector(sel); if(el)el.onchange=ev=>{ const b=JSON.stringify(s); fn(ev); if(JSON.stringify(s)!==b){ logAudit("staff.edit",s.name+" · "+sel.replace(".s-",""),"admin"); save(); } };};   // a field that really changed is written down
      on(".s-name",e=>{s.name=e.target.value;save();});
      on(".s-init",e=>{s.initials=e.target.value;save();});
      on(".s-title",e=>{s.title=e.target.value.trim();save();});
      on(".s-mob",e=>{s.mobile=e.target.value;save();});
      on(".s-email",e=>{s.email=e.target.value;save();});
      on(".s-email2",e=>{s.email2=e.target.value.trim();save();});
      on(".s-mode",e=>{s.mode=e.target.value;save();render();});
      on(".s-quota",e=>{s.quota=Math.max(0,Math.round(+e.target.value||0));e.target.value=s.quota;save();});
      on(".s-eft",e=>{s.eft=round2(e.target.value);e.target.value=(+s.eft||0).toFixed(2);save();});
      on(".s-hrs",e=>{s.hrsFortnight=round2(e.target.value);e.target.value=(+s.hrsFortnight||0).toFixed(2);save();});
      on(".s-pay",e=>{s.payrollId=e.target.value.trim();save();});
      on(".s-cst",e=>{ const v=e.target.value.trim(); if(v==="")delete s.cstQuota; else s.cstQuota=Math.max(0,Math.round(+v||0)); save(); });   // blank = the group default
      on(".s-notes",e=>{ const v=e.target.value.trim(); if(v)s.notes=v; else delete s.notes; save(); });
      rowEl.querySelectorAll(".s-tag").forEach(cb=>cb.onchange=()=>{ personTagSet(id,cb.dataset.t,cb.checked); const l=document.getElementById("staffList"); if(l){ l.innerHTML=staffListHTML(); wireStaffRows(); } });
      const del=rowEl.querySelector(".s-del"); if(del)del.onclick=(e)=>{e.stopPropagation();if(confirm("Remove "+s.name+" from the whole app (all cycles)?\n\nTo just take them out of THIS cycle, use ‘Remove from this cycle’ instead.")){logAudit("staff.remove",s.name+" (all cycles)","admin");S.staff=S.staff.filter(x=>x.id!==id);S.cycles.forEach(c=>{if(c.roles)delete c.roles[id];if(c.assign)Object.keys(c.assign).forEach(k=>{if(k.slice(0,k.indexOf("|"))===id)delete c.assign[k];});if(c.oncall)Object.keys(c.oncall).forEach(k=>{if(c.oncall[k]===id)delete c.oncall[k];});ciDropFor(c,[id]);});if(S.leave)S.leave=S.leave.filter(L=>L.staffId!==id);save();render();}};
      const ac=rowEl.querySelector(".s-addcyc"); if(ac)ac.onclick=(e)=>{e.stopPropagation();const c=active();if(c){if(!c.roles)c.roles={};c.roles[id]={in:true,quota:s.quota||20,eft:(s.eft!=null?s.eft:1),hrsFortnight:(s.hrsFortnight!=null?s.hrsFortnight:76),periodTargets:{}};}logAudit("cycle.staffadd",s.name+" → "+cyLabel(active()),"admin");save();toast(s.name+" added to "+cyLabel(active())+".");render();};
      const rc=rowEl.querySelector(".s-rmcyc"); if(rc)rc.onclick=(e)=>{e.stopPropagation();
        const c=active(); const aw=c?Object.keys(c.assign).filter(k=>k.slice(0,k.indexOf("|"))===id):[];
        const shiftN=aw.filter(k=>{const v=c.assign[k];return v.kind==="clinical"||v.kind==="cst";}).length;
        if(!confirm("Remove "+s.name+" from "+cyLabel(active())+"?\n\nThey stay on the staff list and in other cycles."+cycleRemovalNote(c,id,shiftN)))return;
        if(c){ if(!c.roles)c.roles={}; if(!c.roles[id])c.roles[id]={}; c.roles[id].in=false;
          aw.forEach(k=>{const v=c.assign[k]; if(v.kind==="clinical"||v.kind==="cst")delete c.assign[k];});
          if(c.oncall)Object.keys(c.oncall).forEach(k=>{if(c.oncall[k]===id)delete c.oncall[k];}); ciDropFor(c,[id]); }   // clear their clinical/CST shifts and any on-call so neither counts a hidden person
        logAudit("cycle.staffremove",s.name+" ✗ "+cyLabel(active())+(shiftN?" ("+shiftN+" shifts cleared)":""),"admin");save();render();};
      const sv=rowEl.querySelector(".s-save"); if(sv)sv.onclick=(e)=>{e.stopPropagation(); const _b0=JSON.stringify(s);
        const g=sel=>rowEl.querySelector(sel);   // read every visible field so Save is authoritative even if a field wasn't blurred
        if(g(".s-name"))s.name=g(".s-name").value.trim();
        if(g(".s-init"))s.initials=g(".s-init").value.trim();
        if(g(".s-title"))s.title=g(".s-title").value.trim();
        if(g(".s-mob"))s.mobile=g(".s-mob").value.trim();
        if(g(".s-mode"))s.mode=g(".s-mode").value;
        if(g(".s-email"))s.email=g(".s-email").value.trim();
        if(g(".s-email2"))s.email2=g(".s-email2").value.trim();
        if(g(".s-quota"))s.quota=Math.max(0,Math.round(+g(".s-quota").value||0));
        if(g(".s-eft"))s.eft=round2(g(".s-eft").value);
        if(g(".s-hrs"))s.hrsFortnight=round2(g(".s-hrs").value);
        if(g(".s-pay"))s.payrollId=g(".s-pay").value.trim();
        if(g(".s-cst")){ const v=g(".s-cst").value.trim(); if(v==="")delete s.cstQuota; else s.cstQuota=Math.max(0,Math.round(+v||0)); }
        if(g(".s-notes")){ const v=g(".s-notes").value.trim(); if(v)s.notes=v; else delete s.notes; }
        if(JSON.stringify(s)!==_b0)logAudit("staff.edit",s.name+" · details","admin");   // Save writes one line when something changed
        save();toastSaved("group");render();};
    });
    document.querySelectorAll("[data-stoggle]").forEach(b=>b.onclick=()=>{const sid=b.dataset.stoggle;if(_staffOpen.has(sid))_staffOpen.delete(sid);else _staffOpen.add(sid);render();});
    document.querySelectorAll(".s-fp").forEach(b=>b.onclick=(e)=>{e.stopPropagation();const sid=b.dataset.sid;if(_fpOpen.has(sid))_fpOpen.delete(sid);else _fpOpen.add(sid);render();});
    const tidy=document.getElementById("tidyStaff");if(tidy)tidy.onclick=()=>{const junk=S.staff.filter(s=>!isNameCell(s.name));if(!junk.length)return;
      if(confirm("Remove these non-staff rows imported from the spreadsheet?\n\n"+junk.map(s=>"• "+s.name).join("\n")+"\n\nTheir shifts and leave entries are removed too.")){
        const ids=new Set(junk.map(s=>s.id)); S.staff=S.staff.filter(s=>!ids.has(s.id));
        S.leave=S.leave.filter(L=>!ids.has(L.staffId));
        S.cycles.forEach(c=>{Object.keys(c.assign).forEach(k=>{if(ids.has(k.slice(0,k.indexOf("|"))))delete c.assign[k];}); if(c.oncall)Object.keys(c.oncall).forEach(k=>{if(ids.has(c.oncall[k]))delete c.oncall[k];});ciDropFor(c,Array.from(ids));});
        logAudit("staff.tidy","removed "+junk.length+" non-staff rows: "+junk.map(s=>s.name).join(", "),"admin");save();render();}};
    wireFixedEditors();
    document.getElementById("addStaff").onclick=()=>{const n="New, Staff "+(S.staff.length+1);const id=slug(n)+"-"+Date.now();const d=staffDefaults();logAudit("staff.add",n,"admin");S.staff.push({id:id,name:n,initials:"NS",mobile:"",mode:"self",quota:d.quota,eft:1,hrsFortnight:d.hrsFortnight,periodTargets:{},fixedPattern:{recurrence:"weekly",A:{},B:{},committed:false}});const c=active();if(c){if(!c.roles)c.roles={};c.roles[id]={in:true,quota:d.quota,eft:1,hrsFortnight:d.hrsFortnight,periodTargets:{}};}save();render();};
  
}
function wire(){
  // recovery + always-available controls FIRST — if a tab's wiring throws below, the bell and the error card's reset must still work
  const bell=document.getElementById("bell");
  if(bell)bell.onclick=()=>{ if(_notifsOpen){closeSheets();return;} _notifsOpen=true; _moreOpen=false; _daySheet=null; _reqSheet=null; _sheetOpener="bell"; render(); };
  const on_=document.getElementById("ovlNotifs"); if(on_)on_.onclick=e=>{ if(e.target.id==="ovlNotifs")closeSheets(); };
  const nr=document.getElementById("notifsRead"); if(nr)nr.onclick=()=>{ markNotifsRead(S.viewAs); render(); };
  const hr=document.getElementById("hardReset");
  if(hr)hr.onclick=()=>{try{localStorage.removeItem(orgKey());localStorage.removeItem(orgKey("_dirty"));localStorage.removeItem(orgKey("_base"));}catch(e){} location.reload();};
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{ if(_notifsOpen)markNotifsRead(S.viewAs); S.tab=b.dataset.tab;_moreOpen=false;_notifsOpen=false;_daySheet=null;_reqSheet=null;saveLocal();render();});
  const bm=document.getElementById("bnMore"); if(bm)bm.onclick=()=>{ if(_moreOpen){closeSheets();return;} _moreOpen=true; _notifsOpen=false; _daySheet=null; _reqSheet=null; _sheetOpener="bnMore"; render(); };
  const om=document.getElementById("ovlMore"); if(om)om.onclick=e=>{ if(e.target.id==="ovlMore")closeSheets(); };
  const vs=document.getElementById("viewAsSheet"); if(vs)vs.onchange=()=>{ S.viewAs=vs.value; _moreOpen=false; saveLocal(); render(); };
  const ss=document.getElementById("sheetSignOut"); if(ss)ss.onclick=authSignOut;
  const sw=document.getElementById("sheetSwitch"); if(sw)sw.onclick=()=>{ try{localStorage.removeItem("myrosta_org");}catch(e){} location.reload(); };
  const srl=document.getElementById("sheetReload"); if(srl)srl.onclick=()=>location.reload();
  const sag=document.getElementById("sheetAddGroup"); if(sag)sag.onclick=()=>{ _moreOpen=false; render(); openAddGroup(); };
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=e=>{ e.preventDefault(); const g=parseGo(b.dataset.go); go(g.tab,{cycle:g.cycle,anchor:g.anchor}); });
  document.querySelectorAll("[data-invite]").forEach(b=>b.onclick=e=>{ if(e&&e.preventDefault)e.preventDefault(); openInvite(); });
  const a2l=document.getElementById("a2hsLater"); if(a2l)a2l.onclick=()=>{ a2hsDismiss(); render(); };
  const swk=document.getElementById("shareWeek"); if(swk)swk.onclick=()=>shareText({title:"My week",text:shareWeekText(S.viewAs)});
  const sdm=document.getElementById("shareDemo"); if(sdm)sdm.onclick=()=>shareText(DEMO_SHARE);
  document.querySelectorAll("#setupSeg [data-st]").forEach(b=>b.onclick=()=>{ _setupTab=b.dataset.st; saveLocal(); render(); });
  const gb=document.getElementById("gapsBtn"); if(gb)gb.onclick=()=>{ _gapsOpen=!_gapsOpen; render(); };
  const gc=document.getElementById("gapsClose"); if(gc)gc.onclick=()=>{ _gapsOpen=false; render(); };
  document.querySelectorAll("[data-gaps]").forEach(b=>b.onclick=()=>{ _gapsOpen=true; go("roster"); });
  document.querySelectorAll("[data-gapassign]").forEach(b=>b.onclick=()=>{ dailyDate=b.dataset.gapassign; dailyMode="day"; go("daily"); });
  document.querySelectorAll("[data-gapcast]").forEach(b=>b.onclick=()=>{ const [d,p,z]=b.dataset.gapcast.split("|"); if(!(featOn("marketplace")&&S.marketOn)){toast("Turn on the marketplace in Settings first.");return;} postOpenShift(d,p,z,"cover needed"); });
  document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{ const to=b.dataset.status; const c=statusConfirmText(to);
    if(!c){ applyStatus(to); return; } const parts=c.split("\n\n"); openConfirm({title:parts[0],body:parts.slice(1).join("\n\n"),ok:statusVerb(to),onDone:v=>{ if(v)applyStatus(to); }}); });   // status buttons work on any tab (Settings card and the Round tab)
  const va=document.getElementById("viewAs");if(va)va.onchange=()=>{S.viewAs=va.value;closeAcct();saveLocal();render();};
  const ab=document.getElementById("acctBtn"), ap=document.getElementById("acctPop");
  if(ab&&ap){ ab.onclick=e=>{ if(e&&e.stopPropagation)e.stopPropagation(); const open=!!ap.hidden; ap.hidden=!open; ab.setAttribute("aria-expanded",open?"true":"false"); if(open){ const f=ap.querySelector&&ap.querySelector("select,button:not([style*='none'])"); if(f&&f.focus)try{f.focus();}catch(_){} } };
    if(!_acctWired){ _acctWired=true; document.addEventListener("click",e=>{ if(ap.hidden)return; const t=e.target; if(t===ab||(ab.contains&&ab.contains(t))||(ap.contains&&ap.contains(t)))return; closeAcct(); }); document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&!ap.hidden){ closeAcct(); try{ab.focus();}catch(_){} } }); } }
  const cfb=document.getElementById("calFeedBtn"); if(cfb)cfb.onclick=()=>{ closeAcct(); go("my",{anchor:"calSec"}); };
  const lo=document.getElementById("logoutBtn");if(lo)lo.onclick=()=>{ closeAcct(); authSignOut(); };
  const so=document.getElementById("switchOrgBtn");if(so)so.onclick=()=>{ try{localStorage.removeItem("myrosta_org");}catch(e){} location.reload(); };
  const agb=document.getElementById("addGroupBtn");if(agb)agb.onclick=()=>{ closeAcct(); openAddGroup(); };
  const csel=document.getElementById("cycleSel");if(csel)csel.onchange=()=>go(S.tab,{cycle:csel.value});   // go() drops the basket, re-hydrates the cycle and closes any sheet   // device-only nav; reset My-shifts/export date range to the newly selected cycle
  document.querySelectorAll("[data-gocyc]").forEach(b=>b.onclick=()=>go("selfroster",{cycle:b.dataset.gocyc}));   // open-round banner: jump to that cycle's self-roster

  if(S.tab==="setup"){
    renderZoneList(); groupsFetch();
    const rs_=document.getElementById("rulesSave"); if(rs_)rs_.onclick=()=>{ rulesSaveFromForm(); };
    const ta_=document.getElementById("tagAdd"); if(ta_)ta_.onclick=()=>{ const el=document.getElementById("tagNew"); if(tagAdd(el?el.value:"")){ render(); toastSaved("group"); } };
    document.querySelectorAll("[data-tag]").forEach(rowEl=>{ const id=rowEl.dataset.tag;
      const nm=rowEl.querySelector(".t-name"); if(nm)nm.onchange=()=>{ if(tagRename(id,nm.value))toastSaved("group"); else render(); };
      const sw=rowEl.querySelector(".t-show"); if(sw)sw.onchange=()=>{ tagSetShow(id,sw.checked); toastSaved("group"); };
      const who=rowEl.querySelector(".t-who"); if(who)who.onclick=()=>{ _tagWhoQ=""; openTagWho(id); };
      const del=rowEl.querySelector(".t-del"); if(del)del.onclick=()=>{ const r=tagRemove(id); if(!r.ok){ toast(r.reason); return; } render(); toastSaved("group"); }; });
    const bpb=document.getElementById("boardPublish"); if(bpb)bpb.onchange=()=>{ setBoardPublish(bpb.checked); };
    document.querySelectorAll(".boardShow").forEach(cb=>cb.onchange=()=>{ setBoardShow(cb.dataset.org,cb.checked); });
    document.querySelectorAll("[data-gkind]").forEach(b=>b.onclick=()=>{ const k=b.dataset.gkind; if(!applyGroupKind(k))return; if(k==="other"){ go("setup",{anchor:"brandCard"}); const el=document.getElementById("brRole"); if(el&&el.focus)try{ el.focus(); }catch(e){} } else render(); });
    const fr_=document.getElementById("featReviewed"); if(fr_)fr_.onclick=()=>{ S.featuresReviewed=true; logAudit("settings.features","reviewed","admin"); save(); toastSaved("group"); render(); };
    const brS=document.getElementById("brSave"); if(brS)brS.onclick=()=>{ if(!S.branding)S.branding={};
      const nm=document.getElementById("brName").value.trim(), hp=document.getElementById("brHosp").value.trim(), rl=((document.getElementById("brRole").value||"").trim().toLowerCase()||"consultant");
      S.branding.name=nm; S.branding.hospital=hp; S.branding.roleNoun=rl;
      logAudit("settings.branding",(hp||"—")+" · group "+(nm||"—")+" · staff = "+rl,"admin"); save(); render(); toastSaved("group"); };
    const brL=document.getElementById("brLogo"); if(brL)brL.onchange=()=>{ const f=brL.files&&brL.files[0]; if(!f)return;
      logoDataURL(f).then(u=>{ if(!S.branding)S.branding={}; S.branding.logo=u; logAudit("settings.logo","logo added · "+Math.round(u.length*3/4/1024)+" KB","admin"); save(); render(); toastSaved("group"); })
        .catch(e=>{ toast(e&&e.message||"That image couldn't be read."); brL.value=""; }); };
    const brR=document.getElementById("brLogoRm"); if(brR)brR.onclick=()=>{ if(S.branding)delete S.branding.logo; logAudit("settings.logo","logo removed","admin"); save(); render(); toastSaved("group"); };
    document.querySelectorAll(".featFlag").forEach(cb=>cb.onchange=()=>{ if(!S.features)S.features={}; S.features[cb.dataset.feat]=cb.checked; S.featuresReviewed=true; logAudit("settings.feature",cb.dataset.feat+(cb.checked?" on":" off"),"admin"); save();toastSaved("group"); render(); });
    const oh_=document.getElementById("ownHours"); if(oh_)oh_.onchange=()=>{ ownHoursSwitch(oh_.checked); toastSaved("group"); render(); };
    const ib_=document.getElementById("instantBook"); if(ib_)ib_.onchange=()=>{ instantBookSwitch(ib_.checked); toastSaved("group"); render(); };
    const ck_=document.getElementById("clockOn"); if(ck_)ck_.onchange=()=>{ const r=clockSwitch(ck_.checked); if(!r.ok){ toast(r.reason); ck_.checked=false; return; } toastSaved("group"); render(); };
    const cw_=document.getElementById("clockWalkin"); if(cw_)cw_.onchange=()=>{ clockWalkinSwitch(cw_.checked); toastSaved("group"); render(); };
    const cg_=document.getElementById("clockGrace"); if(cg_)cg_.onchange=()=>{ const r=clockSetGrace(cg_.value); if(!r.ok){ toast(r.reason); render(); return; } toastSaved("group"); };
    const sh_=document.getElementById("siteHere"); if(sh_)sh_.onclick=()=>{ sh_.disabled=true; clockLocate(p=>{ sh_.disabled=false; if(!p){ toast("Your phone didn\u2019t give a location \u2014 allow it for myrosta.com.au, or type the point."); return; } const la=document.getElementById("siteLat"), lo=document.getElementById("siteLng"), n=document.getElementById("siteNote"); if(la)la.value=String(Math.round(p.lat*1e6)/1e6); if(lo)lo.value=String(Math.round(p.lng*1e6)/1e6); _siteAcc=Math.round(p.acc||0); if(n)n.textContent="Found you, \u00b1"+_siteAcc+" m. Save site keeps it."; }); };
    const ss_=document.getElementById("siteSave"); if(ss_)ss_.onclick=()=>{ const la=document.getElementById("siteLat"), lo=document.getElementById("siteLng"), ra=document.getElementById("siteRadius"); const r=clockSiteSave(la?la.value:"",lo?lo.value:"",ra?ra.value:"",_siteAcc); _siteAcc=null; if(!r.ok){ toast(r.reason); return; } toastSaved("group"); render(); };
    const pp_=document.getElementById("posterPrint"); if(pp_)pp_.onclick=()=>{ document.body.classList.add("print-poster"); window.print(); setTimeout(()=>document.body.classList.remove("print-poster"),1200); };
    const pn_=document.getElementById("posterNew"); if(pn_)pn_.onclick=()=>{ if(!confirm("Make a new poster? Older posters stop working once this one is printed."))return; if(clockPosterRenew().ok){ toastSaved("group"); render(); } };
    (function(){ const map={capZA:"zonesAM",capZP:"zonesPM",capMinA:"minAM",capMaxA:"maxAM",capMinP:"minPM",capMaxP:"maxPM",capEft:"eft",capSpw:"spw"};
      Object.keys(map).forEach(id=>{ const el=document.getElementById(id); if(!el)return;
        el.onchange=()=>{ if(!S.capOverride)S.capOverride={}; const v=parseFloat(el.value); if(isNaN(v))delete S.capOverride[map[id]]; else S.capOverride[map[id]]=v; saveLocal(); render(); }; });
      const bmap={capAL:"al",capSick:"sick",capCME:"cme"};
      Object.keys(bmap).forEach(id=>{ const el=document.getElementById(id); if(!el)return;
        el.onchange=()=>{ if(!S.capBuffer)S.capBuffer={al:5,sick:2,cme:1.5}; const v=parseFloat(el.value); if(!isNaN(v))S.capBuffer[bmap[id]]=v; logAudit("settings.capBuffer","AL "+S.capBuffer.al+" · sick "+S.capBuffer.sick+" · CME "+S.capBuffer.cme+" wk/yr","admin"); save(); render(); }; });
      const cr=document.getElementById("capReset"); if(cr)cr.onclick=()=>{ S.capOverride={}; saveLocal(); render(); };
      const cp=document.getElementById("capPrint"); if(cp)cp.onclick=()=>{ document.body.classList.add("print-cap"); window.print(); setTimeout(()=>document.body.classList.remove("print-cap"),1200); };
    })();
    const mkSeg=document.getElementById("mkOnSeg");
    if(mkSeg)mkSeg.querySelectorAll("[data-mk]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;S.marketOn=b.dataset.mk==="on";logAudit("market.toggle",S.marketOn?"marketplace ON":"marketplace OFF","admin");save();toastSaved("group");render();});
    const mcSeg=document.getElementById("mkClaimSeg");
    if(mcSeg)mcSeg.querySelectorAll("[data-mc]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;S.marketClaim=b.dataset.mc;logAudit("market.claimMode",S.marketClaim,"admin");save();toastSaved("group");render();});
    const mqSeg=document.getElementById("mkQSeg");
    if(mqSeg)mqSeg.querySelectorAll("[data-mq]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;S.marketQuotaBypass=b.dataset.mq==="yes";logAudit("market.quotaBypass",S.marketQuotaBypass?"allowed":"blocked","admin");save();toastSaved("group");render();});
    const poSeg=document.getElementById("pushSeg");
    if(poSeg)poSeg.querySelectorAll("[data-po]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;S.pushOn=b.dataset.po==="on";logAudit("push.toggle",S.pushOn?"push ON":"push OFF","admin");save();toastSaved("group");render();});
    const mkPer=document.getElementById("mkPeriod");
    if(mkPer)mkPer.onchange=()=>{const p=mkPer.value,zs=document.getElementById("mkZone");if(zs)zs.innerHTML=(S.zones||[]).filter(z=>p==="AM"?z.am:z.pm).map(z=>`<option value="${z.id}">${escapeHTML(z.name)}</option>`).join("");};
    const mkPost=document.getElementById("mkPost");
    if(mkPost)mkPost.onclick=()=>{const d=document.getElementById("mkDate").value,p=document.getElementById("mkPeriod").value,z=document.getElementById("mkZone").value,n=document.getElementById("mkNote").value.trim();
      if(!d){toast("Pick a date.");return;} if(!z){toast("Pick a zone.");return;}
      if(!dateInCycle(parseISO(d))){toast("That date isn't in the selected cycle.");return;}
      postOpenShift(d,p,z,n);};
    document.querySelectorAll("[data-osok]").forEach(b=>b.onclick=()=>approveClaim(b.dataset.osok,true));
    document.querySelectorAll("[data-osno]").forEach(b=>b.onclick=()=>approveClaim(b.dataset.osno,false));
    document.querySelectorAll("[data-oswd]").forEach(b=>b.onclick=()=>{if(confirm("Withdraw this open shift? It goes back to being unfilled."))withdrawOpenShift(b.dataset.oswd);});
    const sc=document.getElementById("saveCycle");
    if(sc)sc.onclick=()=>{const a=active();
      a.cycle.start=document.getElementById("cycStart").value;
      a.cycle.weeks=Math.max(1,+document.getElementById("cycWeeks").value||8); markAnswered("dates"); logAudit("cycle.dates",cyLabel(a)+" · "+a.cycle.weeks+" wks","admin"); save(); toastSaved("cycle"); render();};
    const _az=document.getElementById("addZone"); if(_az)_az.onclick=()=>{markAnswered("zones");const zs=cset().zones||S.zones;zs.push({id:slug("Zone"+(zs.length+1))+"-"+Date.now(),name:"Zone"+(zs.length+1),am:true,pm:true,pmLabel:""});cset().zones=zs;S.zones=zs;save();render();};
    const _ssv=document.getElementById("saveStaffing"); if(_ssv)_ssv.onclick=()=>{
      const st={amMin:+amMin.value,amMax:+amMax.value,pmMin:+pmMin.value,pmMax:+pmMax.value};
      const c=active(); if(!c.settings)c.settings={}; c.settings.staffing=st; S.staffing={amMin:st.amMin,amMax:st.amMax,pmMin:st.pmMin,pmMax:st.pmMax}; // mirror to global = default for new cycles
      markAnswered("cover"); logAudit("settings.staffing","AM "+st.amMin+"–"+st.amMax+", PM "+st.pmMin+"–"+st.pmMax+" · "+cyLabel(c),"admin");
      save();toast("Cover saved for "+cyLabel(c)+". Other cycles are unchanged.");render();};
    document.querySelectorAll("#uoSeg [data-uo]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;const c=active();if(!c.settings)c.settings={};c.settings.unlockOrder=b.dataset.uo;S.unlockOrder=b.dataset.uo;logAudit("settings.unlockOrder",unlockOrderLabel()+" · "+cyLabel(c),"admin");save();toastSaved("cycle");render();});
    const snt=document.getElementById("saveNotice");
    if(snt)snt.onclick=()=>{ const el=document.getElementById("noticeDays"); const raw=parseInt((el||{}).value,10), v=(raw>0&&raw<=365)?raw:0;
      if((el&&String(el.value).trim()!=="")&&(isNaN(raw)||raw<0||raw>365)){ fieldError(el,"A whole number of days, 0 to 365. 0 turns the notice period off."); return; }
      cset().noticeDays=v; markAnswered("notice");   // no S mirror on purpose — see effNotice
      logAudit("settings.notice",(v?v+" days\u2019 notice":"no notice period")+" \u00b7 "+cyLabel(active()),"admin"); save(); render(); toastSaved("cycle"); };
    const slc=document.getElementById("saveLeaveCap");if(slc)slc.onclick=()=>{markAnswered("leavecap");const v=+document.getElementById("leaveCap").value||0;cset().leaveCapEft=v;S.leaveCapEft=v;logAudit("settings.leaveCap","Max EFT on leave/day = "+v+" · "+cyLabel(active()),"admin");save();toastSaved("cycle");render();};
    const sidi=document.getElementById("secIdle");if(sidi)sidi.onchange=()=>{const v=Math.min(240,Math.max(1,parseInt(sidi.value,10)||15));if(!S.security)S.security={};S.security.sharedIdleMin=v;sidi.value=v;logAudit("settings.sharedIdle","Shared-computer auto-logout = "+v+" min","admin");save();if(_sharedDevice)resetIdle();toast("Shared-computer auto-logout set to "+v+" min.");};
    const ir=document.getElementById("impRoster");if(ir)ir.onchange=e=>{if(e.target.files[0])importFile(e.target.files[0],"roster");};
    const il=document.getElementById("impLeave");if(il)il.onchange=e=>{if(e.target.files[0])importFile(e.target.files[0],"leave");};
    const ieft=document.getElementById("impEft");if(ieft)ieft.onchange=e=>{if(e.target.files[0])importEftTracker(e.target.files[0]);};
    const eeft=document.getElementById("expEft");if(eeft)eeft.onclick=exportEftTracker;
    const ist=document.getElementById("impStaff");if(ist)ist.onchange=e=>{if(e.target.files[0])importStaffList(e.target.files[0]);};
    const dst=document.getElementById("dlStaffTpl");if(dst)dst.onclick=downloadStaffTemplate;
    const ghide=document.getElementById("guideHide");if(ghide)ghide.onclick=()=>{S.guideDismissed=true;save();render();};
    const gshow=document.getElementById("guideShow");if(gshow)gshow.onclick=()=>{S.guideDismissed=false;save();render();};
    const wtpl=document.getElementById("wizTpl");if(wtpl)wtpl.onclick=downloadStaffTemplate;
    const wstf=document.getElementById("wizStaff");if(wstf)wstf.onchange=e=>{if(e.target.files[0])importStaffList(e.target.files[0]);};
    const pt=document.getElementById("payTpl");if(pt)pt.onchange=e=>{if(e.target.files[0])readPayrollTemplate(e.target.files[0]);};
    const pdf=document.getElementById("payDateFmt");if(pdf)pdf.onchange=e=>{S.payrollDateFmt=e.target.value;logAudit("payroll.dateFmt",e.target.value,"admin");save();};
    const ptc=document.getElementById("payTplClear");if(ptc)ptc.onclick=()=>{S.payrollTemplate=null;logAudit("payroll.template.clear","reverted to standard layout","admin");save();render();};
    document.querySelectorAll(".payMap").forEach(sel=>sel.onchange=e=>{const i=+e.target.dataset.col;if(S.payrollTemplate&&S.payrollTemplate.map){S.payrollTemplate.map[i]=e.target.value;save();}});
    const ms=document.getElementById("memSync");if(ms)ms.onclick=cloudMembersSync;
    const ma=document.getElementById("memAdd");if(ma)ma.onclick=()=>{const em=(document.getElementById("memEmail").value||"").trim();if(em)cloudMemberAdd(em,document.getElementById("memRole").value);};
    document.querySelectorAll("[data-memrm]").forEach(b=>b.onclick=()=>{if(confirm("Remove "+b.dataset.memrm+" from the allow-list?"))cloudMemberRemove(b.dataset.memrm);});
    document.querySelectorAll("[data-memrole]").forEach(b=>b.onclick=()=>{const to=b.dataset.memto;if(confirm(to==="admin"?("Give admin rights to "+b.dataset.memrole+"?\n\nThey'll have full admin after their next sign-in / page reload."):("Change "+b.dataset.memrole+" to staff (remove admin)?")))cloudMemberSetRole(b.dataset.memrole,to,b.dataset.memname);});
    document.querySelectorAll("#fairSeg [data-f]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;markAnswered("method");logAudit("settings.fairness",b.dataset.f+" · "+cyLabel(active()),"admin"); if(b.disabled)return; cset().fairness=b.dataset.f;S.fairness=b.dataset.f;save();toastSaved("cycle");render();});
    document.querySelectorAll("#modeSeg [data-rm]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;markAnswered("mode"); const m=b.dataset.rm; cset().rosterMode=m; S.rosterMode=m;
      if(m==="rolling"&&(S.fairness==="waves"||S.fairness==="snake")){ const was=S.fairness; cset().fairness="guarded"; S.fairness="guarded";
        toast("Switched to Everyone at once — "+fairnessLabel(was)+" needs a round with a start and an end."); }
      logAudit("settings.rosterMode",m+" · "+cyLabel(active()),"admin"); save(); toastSaved("cycle"); render(); });
    document.querySelectorAll("#wcSeg [data-wc]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;cset().waveCount=+b.dataset.wc;S.waveCount=+b.dataset.wc;save();toastSaved("cycle");render();});
    document.querySelectorAll("#qpSeg [data-qp]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;markAnswered("quota");cset().quotaPeriod=b.dataset.qp;S.quotaPeriod=b.dataset.qp;logAudit("settings.quotaPeriod",b.dataset.qp+" · "+cyLabel(active()),"admin");save();toastSaved("cycle");render();});
    document.querySelectorAll("#qcSeg [data-qc]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;cset().quotaCapMode=b.dataset.qc;S.quotaCapMode=b.dataset.qc;logAudit("settings.quotaCap",b.dataset.qc+" · "+cyLabel(active()),"admin");save();toastSaved("cycle");render();});
    document.querySelectorAll("#qfSeg [data-qf]").forEach(b=>b.onclick=()=>{if(b.classList.contains("on"))return;const v=(b.dataset.qf==="flex");cset().quotaFlex=v;S.quotaFlex=v;logAudit("settings.quotaFlex",(v?"flexible extra":"auto-placed")+" · "+cyLabel(active()),"admin");save();toastSaved("cycle");render();});
    document.querySelectorAll(".qt-cell").forEach(inp=>inp.onchange=e=>{const s=S.staff.find(x=>x.id===e.target.dataset.sid);if(!s)return;const i=+e.target.dataset.pi,v=e.target.value.trim();if(!s.periodTargets)s.periodTargets={};if(v==="")delete s.periodTargets[i];else s.periodTargets[i]=Math.max(0,Math.round(+v||0));save();
      const t=periodTargetsOf(s),row=e.target.closest("tr");if(row){row.querySelectorAll(".qt-cell").forEach((c,ci)=>{c.value=t[ci];const ov=s.periodTargets[ci]!=null&&s.periodTargets[ci]!=="";c.style.fontWeight=ov?"600":"";c.style.color=ov?"var(--accent)":"";});const tc=row.querySelector(".qt-total");if(tc){const tot=t.reduce((a,b)=>a+b,0),q=s.quota||0,off=tot!==q;tc.textContent=off?tot+" / "+q:tot;tc.style.color=off?"var(--danger-t)":"";tc.title=off?("Periods add to "+tot+" but cycle quota is "+q):"";}}});
    document.querySelectorAll("#qtSeg [data-qt]").forEach(b=>b.onclick=()=>{ if(b.classList.contains("on"))return; _qtView=b.dataset.qt; render(); });
    const _cd=document.getElementById("cstDefault"); if(_cd)_cd.onchange=e=>{ const v=e.target.value.trim(); if(v==="")delete cset().cstPerFortnight; else cset().cstPerFortnight=Math.max(0,Math.round(+v||0)); logAudit("settings.cstDefault",(v===""?"none":cset().cstPerFortnight+" a fortnight")+" \u00b7 "+cyLabel(active()),"admin"); save(); toastSaved("cycle"); render(); };
    document.querySelectorAll(".qt-cstq").forEach(inp=>inp.onchange=e=>{ const s=S.staff.find(x=>x.id===e.target.dataset.sid); if(!s)return; const v=e.target.value.trim(); if(v==="")delete s.cstQuota; else s.cstQuota=Math.max(0,Math.round(+v||0)); logAudit("settings.cstQuota",nameOf(s.id)+" \u2192 "+(v===""?"default":s.cstQuota),"admin"); save(); render(); });
    document.querySelectorAll(".qt-cstcell").forEach(inp=>inp.onchange=e=>{ const s=S.staff.find(x=>x.id===e.target.dataset.sid); if(!s)return; const i=+e.target.dataset.pi, v=e.target.value.trim(); if(!s.cstTargets)s.cstTargets={}; if(v==="")delete s.cstTargets[i]; else s.cstTargets[i]=Math.max(0,Math.round(+v||0)); logAudit("settings.cstQuota",nameOf(s.id)+" \u00b7 "+((cyclePeriods()[i]||{}).label||"")+" \u2192 "+(v===""?"auto":s.cstTargets[i]),"admin"); save(); render(); });
    const qcr=document.getElementById("qtCstReset"); if(qcr)qcr.onclick=()=>{ S.staff.forEach(s=>{ s.cstTargets={}; }); logAudit("settings.cstReset","all per-period CST targets reset to auto","admin"); save(); render(); };
    document.querySelectorAll(".qt-quota").forEach(inp=>inp.onchange=e=>{const s=S.staff.find(x=>x.id===e.target.dataset.sid);if(!s)return;s.quota=Math.max(0,Math.round(+e.target.value||0));e.target.value=s.quota;logAudit("settings.quota",nameOf(s.id)+" → "+s.quota,"admin");save();});
    const qtr=document.getElementById("qtReset");if(qtr)qtr.onclick=()=>{S.staff.forEach(s=>s.periodTargets={});logAudit("settings.quotaReset","all per-period targets reset to auto","admin");save();render();};
    const _dz=document.getElementById("dangerBtn"); if(_dz)_dz.onclick=openDangerModal;
    document.querySelectorAll("#ftSeg [data-ft]").forEach(b=>b.onclick=()=>{ if(b.classList.contains("on"))return; const r=+((document.getElementById("ftRest")||{}).value||0)||undefined, c=+((document.getElementById("ftConsec")||{}).value||0)||undefined; setFatigueMode(b.dataset.ft,{minRest:r,maxConsec:c}); render(); });
    const svf=document.getElementById("saveFatigue");
    if(svf)svf.onclick=()=>{ const cur=effFatigue(); const f={mode:cur.mode,minRest:+((document.getElementById("ftRest")||{}).value||0),maxConsec:+((document.getElementById("ftConsec")||{}).value||0)};
      cset().fatigue=f; logAudit("settings.fatigue",f.mode+" · rest "+f.minRest+"h · max "+f.maxConsec+" days · "+cyLabel(active()),"admin"); save(); render();
      toast(f.mode==="off"?"Fatigue rules off for this cycle.":("Fatigue rules "+f.mode+" — rest ≥"+f.minRest+"h, ≤"+f.maxConsec+" consecutive days."),"ok"); };
    const aoc=document.getElementById("addOncall");
    const ocStale=()=>{ if(!ocCardStale())return false; toast("The on-call windows changed since this card was drawn \u2014 check them and try again.","warn"); render(); return true; };
    if(aoc)aoc.onclick=()=>{ if(ocStale())return; const c=active(), list=ocRowsNow(), bad=ocCheck(list,c); if(bad){toast(bad);return;}
      if(ocImpact(c,list).n){ toast("Save your changes to which shifts on-call follows first.","warn"); return; }
      list.push(ocNewWindow(list)); cset().oncallWindows=list; logAudit("settings.oncall","added an on-call window \u00b7 "+cyLabel(active()),"admin"); save(); render(); };
    document.querySelectorAll("#ocRows .oc-del").forEach(b=>b.onclick=()=>{ if(ocStale())return;
      const c=active(), rowEl=b.closest?b.closest("[data-ocid]"):null, id=rowEl?rowEl.dataset.ocid:null, list=ocRowsNow(), i=list.findIndex(w=>w.id===id);
      if(i<0)return; const stored=ocWindow(c,id)||list[i], gone=stored.label, used=ocChosen(stored)?0:ocInUse(c,id);
      if(used){ toast(used+" "+(used===1?"day is":"days are")+" on call as "+gone+". Clear those first, or leave the window in place.","warn"); return; }
      const logged=ciInUse(c,id); if(logged){ toast(logged+" call-in"+(logged===1?" is":"s are")+" logged on "+gone+". Untick Staff can log their own to stop new ones, or leave the window in place.","warn"); return; }
      if(ocImpact(c,list).n){ toast("Save your changes to which shifts on-call follows first.","warn"); return; }
      const rest=list.filter(w=>w.id!==id), bad=ocCheck(rest,c); if(bad){toast(bad);return;}
      const hit=ocImpact(c,rest);   // judged on what is on the roster, never on an unsaved tick
      openConfirm({title:"Remove "+gone+"?",body:hit.n?("Whoever works the "+perName("PM")+" shift in "+ocFromText(stored)+" stops carrying "+gone+". "+ocImpactText(hit)):("Nobody is on call as "+gone+", so nothing on the roster changes."),ok:"Remove",danger:true}).then(yes=>{ if(!yes)return;
        if(ocCardStale()||(!ocChosen(ocWindow(active(),id))&&ocInUse(active(),id))||ciInUse(active(),id)){ toast("The on-call changed while that was open \u2014 check it and try again.","warn"); render(); return; }   // read again after the dialog: a take may have landed while it was open
        cset().oncallWindows=rest; logAudit("settings.oncall","removed "+gone+" \u00b7 "+cyLabel(active()),"admin"); save(); render(); }); });
    document.querySelectorAll("#ocRows .oc-hours").forEach(sel=>sel.onchange=()=>{ const rowEl=sel.closest?sel.closest("[data-ocid]"):null; if(rowEl&&rowEl.classList)rowEl.classList.toggle("chosen",sel.value==="chosen"); });   // shows the range and usual length and hides the zone boxes at once; nothing is saved until Save
    const soc=document.getElementById("saveOncall");
    if(soc)soc.onclick=()=>{ if(ocStale())return; const c=active(), out=ocRowsNow(), bad=ocCheck(out,c); if(bad){toast(bad);return;}
      const go=()=>{ if(ocStale())return; cset().oncallWindows=out; markAnswered("oncall");
        logAudit("settings.oncall",(out.length?out.map(w=>w.label+" "+ocWhenText(w)+(w.from?" (follows "+ocFromText(w)+")":"")).join(" \u00b7 "):"none")+" \u00b7 "+cyLabel(active()),"admin");
        save(); render(); toast("On-call windows saved for "+cyLabel(active())+".","ok"); };
      const hit=ocImpact(c,out); if(!hit.n)return go();
      openConfirm({title:"Change the on-call on "+hit.n+" shift"+(hit.n===1?"":"s")+"?",body:ocImpactText(hit),ok:"Save",danger:true}).then(yes=>{ if(yes)go(); }); };
    const ast=document.getElementById("addShiftType");
    if(ast)ast.onclick=()=>{ const list=typeRowsNow(), _rp=typeRepointed(list,active()); if(_rp){toast(_rp);return;}
      const am=list.find(t=>t.builtin==="AM")||{start:"08:00"}, pm=list.find(t=>t.builtin==="PM")||{end:"16:00"};
      let base="Full", k=1, id=slug(base); while(list.some(t=>t.id===id)){ k++; id=slug(base+"-"+k); }
      list.push({id:id,code:id.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6)||("T"+list.length),label:(k>1?base+" "+k:base),start:am.start,end:pm.end,fills:["AM","PM"],on:true,book:true,builtin:null});   // a new type starts as the whole day, which is what a full shift is
      cset().shiftTypes=list; logAudit("settings.shiftTypes","added a type \u2014 "+cyLabel(active()),"admin"); save(); render(); };
    document.querySelectorAll("#typeRows .st-del").forEach(b=>b.onclick=()=>{
      const rowEl=b.closest?b.closest("[data-sti]"):null; const i=rowEl?+rowEl.dataset.sti:-1; const list=typeRowsNow();
      if(i<0||!list[i]||list[i].builtin)return; const _rp=typeRepointed(list,active()); if(_rp){toast(_rp);return;} const gone=list[i].label, used=typeInUse(active(),list[i].id);
      if(used){ toast(used+" "+(used===1?"shift is":"shifts are")+" booked as "+gone+". Switch it off instead \u2014 they keep their hours, and nobody can book a new one.","warn"); return; }   // removing it would silently re-read every one of them as a plain half shift
      openConfirm({title:"Remove "+gone+"?",body:"Nobody is booked on it, so nothing on the roster changes.",ok:"Remove",danger:true}).then(yes=>{ if(!yes)return;
        list.splice(i,1); cset().shiftTypes=list; logAudit("settings.shiftTypes","removed "+gone+" \u2014 "+cyLabel(active()),"admin"); save(); render(); }); });
    const sst=document.getElementById("saveShiftTimes");
    if(sst)sst.onclick=()=>{ const base=shiftTypesOf(active()), out=[]; let bad="";
      document.querySelectorAll("#typeRows [data-sti]").forEach(rowEl=>{ const src=base[+rowEl.dataset.sti]; if(!src)return;
        const t={...src,fills:(src.fills||[]).slice()};
        const g=c=>rowEl.querySelector(c);
        t.label=String(((g(".st-label")||{}).value)||"").trim().slice(0,24);
        t.start=((g(".st-start")||{}).value)||""; t.end=((g(".st-end")||{}).value)||"";
        const fs=g(".st-fills"); if(fs&&fs.value)t.fills=String(fs.value).split("+");
        if(t.fills.join("+")!==(src.fills||[]).join("+")&&typeInUse(active(),t.id))bad=typeInUse(active(),t.id)+" shifts are booked as "+t.label+", so it cannot change which half of the day it covers. Switch it off and add a new type instead.";
        const on=g(".st-on"); t.on=typeIsDefault(t)?true:(on?!!on.checked:t.on!==false);
        const bk=g(".st-book"); if(bk)t.book=!!bk.checked;
        if(t.label!==src.label)delete t.long;   // renamed: the admin's own word is the word
        if(!t.label)bad="Every shift type needs a name."; else if(!t.start||!t.end)bad="Fill every start and end time."; else if(t.start===t.end)bad=t.label+" starts and ends at the same time.";
        out.push(t); });
      if(!out.length)return;
      keepHiddenTypes(base,out);
      if(!bad&&!(out.find(t=>t.builtin==="AM")&&out.find(t=>t.builtin==="PM")))bad="The day\u2019s two halves must both stay on.";
      const _vis=out.filter(t=>t.derived!=="oncall");   // the on-call type is not on this card, so it can never be the other half of a clash
      if(!bad&&_vis.some((t,i)=>_vis.findIndex(x=>x.label.toLowerCase()===t.label.toLowerCase())!==i))bad="Two types share a name \u2014 give each one its own.";
      if(bad){toast(bad);return;}
      cset().shiftTypes=out;
      const tm={}; ["AM","PM","ONC","CST"].forEach(k=>{ const r=out.find(x=>x.builtin===k); if(r)tm[k]={start:r.start,end:r.end}; });
      cset().shiftTimes=tm;   // payroll, RosterOn, the calendar feed and the reminders still index by these four keys
      markAnswered("times"); logAudit("settings.shiftTypes",out.filter(t=>t.on!==false&&t.derived!=="oncall").map(t=>t.label+" "+t.start+"\u2013"+t.end+((t.fills||[]).length>1?" (whole day)":"")).join(" · ")+" · "+cyLabel(active()),"admin");
      save(); render(); toast("Shift types saved for "+cyLabel(active())+".","ok"); };
    const _pn=document.getElementById("prepNext"); if(_pn)_pn.onclick=prepareNext;
    document.querySelectorAll("[data-archive]").forEach(b=>b.onclick=()=>archiveCycle(b.dataset.archive));
    document.querySelectorAll("[data-restore]").forEach(b=>b.onclick=()=>{const c=S.cycles.find(x=>x.id===b.dataset.restore);if(c){c.archived=false;save();render();}});
    document.querySelectorAll("[data-select]").forEach(b=>b.onclick=()=>{S.activeId=b.dataset.select;dailyDate=null;save();render();});
    document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const cc_=S.cycles.find(x=>x.id===b.dataset.del); if(confirm("Delete cycle "+(cc_?cyLabel(cc_):"")+" permanently? Its shifts and settings are lost; other cycles are unaffected.")){S.cycles=S.cycles.filter(x=>x.id!==b.dataset.del);if(!S.cycles.find(x=>x.id===S.activeId))S.activeId=(S.cycles.find(x=>!x.archived)||S.cycles[0]).id;save();render();}});
    document.querySelectorAll("[data-deldraft]").forEach(b=>b.onclick=()=>deleteDraft(b.dataset.deldraft));
  }
  { const ft=document.getElementById("frTpl"); if(ft)ft.onclick=downloadStaffTemplate; const fs_=document.getElementById("frStaff"); if(fs_)fs_.onchange=e=>{ if(e&&e.target&&e.target.files&&e.target.files[0])importStaffList(e.target.files[0]); }; }
  if(S.tab==="audit"){ const as_=document.getElementById("auditSeg"); if(as_&&as_.querySelectorAll)as_.querySelectorAll("[data-av]").forEach(b=>b.onclick=()=>{ if(b.classList.contains("on"))return; _auditView=b.dataset.av; render(); });
    const af_=document.getElementById("auditFilter"); if(af_&&af_.querySelectorAll)af_.querySelectorAll("[data-af]").forEach(b=>b.onclick=()=>{ if(b.classList.contains("on"))return; _auditFilter=b.dataset.af; render(); });
    const ac_=document.getElementById("auditCsv"); if(ac_)ac_.onclick=()=>{ download(auditCSV(),"myrosta-audit-"+iso(new Date())+".csv","text/csv"); }; }
  if(S.tab==="staff"){ wireStaffRows();
    const ss_=document.getElementById("staffSearch"); if(ss_)ss_.oninput=()=>{ _staffQuery=ss_.value; const l=document.getElementById("staffList"); if(l){ l.innerHTML=staffListHTML(); wireStaffRows(); } };
    document.querySelectorAll("#staffFilterSeg [data-sf]").forEach(b=>b.onclick=()=>{ _staffFilter=b.dataset.sf; render(); });
    const ts_=document.getElementById("staffTagSel"); if(ts_)ts_.onchange=()=>{ _staffTag=ts_.value; render(); };
  }
  if(S.tab==="roster"){
    document.querySelectorAll(".cellbtn").forEach(td=>td.onclick=()=>openCell(td.dataset.s,td.dataset.d));
    document.querySelectorAll(".rcard-h[data-day]").forEach(b=>b.onclick=()=>{dailyDate=b.dataset.day;dailyMode="day";S.tab="daily";render();});
    const tdc=document.getElementById("todayChip"); if(tdc)tdc.onclick=()=>{ const t=document.querySelector(".rcard.today"); if(!t)return; const dt=t.closest("details"); if(dt)dt.open=true; try{ t.scrollIntoView({block:"center",behavior:"smooth"}); }catch(e){ t.scrollIntoView(); } };
    const gt=document.getElementById("gapsToggle");if(gt)gt.onclick=()=>{gapsOn=!gapsOn;render();};
    const ft=document.getElementById("fixedToggle");if(ft)ft.onclick=()=>{fixedView=!fixedView;render();};
    const fs_=document.getElementById("fixedSoft");if(fs_)fs_.onchange=()=>{fixedSoft=fs_.checked;render();};
    const fx=document.getElementById("fixedXlsx");if(fx)fx.onclick=exportFixedCoverXLSX;
    document.querySelectorAll(".namecol-btn[data-hl]").forEach(el=>el.onclick=()=>{   // admin: toggle row highlight in place (no re-render = scroll preserved)
      const id=el.dataset.hl; _hlStaff=(_hlStaff===id?null:id);
      document.querySelectorAll("table.roster tr.rowhl").forEach(tr=>tr.classList.remove("rowhl"));
      document.querySelectorAll(".namecol-btn[data-hl]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.hl===_hlStaff?"true":"false"));
      if(_hlStaff){const row=el.closest("tr"); if(row)row.classList.add("rowhl");} });
    document.querySelectorAll("[data-phd]").forEach(th=>th.onclick=()=>{ const d=th.dataset.phd;
      if(!confirm(isPH(d)?("Remove the public-holiday mark from "+fmtISO(d)+"?"):("Mark "+fmtISO(d)+" as a public holiday?\n\nEveryone sees a PH badge on it in the roster, the Day board and Book shifts.")))return;
      togglePH(d); render(); });
    const rex=document.getElementById("rosExport"); if(rex)rex.onclick=openExportMenu;
  }
  if(S.tab==="daily"){
    const ds=cycleDates(); groupsFetch(); if(dailyScope==="dept")boardFetch();
    clearInterval(_boardTick); _boardTick=null; if(dailyScope==="dept"&&deptOn())_boardTick=setInterval(()=>{ if(S.tab==="daily"&&dailyScope==="dept"){ boardFetch(true); } else { clearInterval(_boardTick); _boardTick=null; } },60000);   // the board re-reads itself every minute while it is open, and stops when the view is left
    document.querySelectorAll("[data-dscope]").forEach(b=>b.onclick=()=>{ dailyScope=b.dataset.dscope; if(dailyScope==="dept")boardFetch(true); render(); });
    const bd=document.getElementById("bDate"); if(bd)bd.onchange=e=>{ _deptDate=e.target.value; render(); };
    const lim=deptDates(), bpv=document.getElementById("bPrev"), bnx=document.getElementById("bNext");
    if(bpv)bpv.onclick=()=>{ const nd=iso(addDays(parseISO(_deptDate||iso(new Date())),-1)); if(nd>=lim.min)_deptDate=nd; render(); };
    if(bnx)bnx.onclick=()=>{ const nd=iso(addDays(parseISO(_deptDate||iso(new Date())),1)); if(nd<=lim.max)_deptDate=nd; render(); };
    const brf=document.getElementById("bRefresh"); if(brf)brf.onclick=()=>{ groupsFetch(true); boardFetch(true); toast("Reading the board\u2026"); };
    const bpr=document.getElementById("bPrint"); if(bpr)bpr.onclick=()=>{ document.body.classList.add("print-dept"); window.print(); setTimeout(()=>document.body.classList.remove("print-dept"),1200); };
    document.querySelectorAll("[data-dm]").forEach(b=>b.onclick=()=>{dailyMode=b.dataset.dm;render();});
    const di=document.getElementById("dDate");if(di)di.onchange=e=>{dailyDate=e.target.value;render();};
    document.querySelectorAll(".assignrow").forEach(r=>r.onclick=()=>openCell(r.dataset.s,dailyDate));
    const step=dailyMode==="week"?7:1;
    const dph=document.getElementById("dPH");
    if(dph)dph.onclick=()=>{ if(!confirm(isPH(dailyDate)?("Remove the public-holiday mark from "+fmtISO(dailyDate)+"?"):("Mark "+fmtISO(dailyDate)+" as a public holiday?\n\nEveryone sees a PH badge on it in the roster, the Day board and Book shifts.")))return; togglePH(dailyDate); render(); };
    const dp=document.getElementById("dPrev"),dn=document.getElementById("dNext");
    if(dp)dp.onclick=()=>{const nd=addDays(parseISO(dailyDate),-step);if(nd>=ds[0])dailyDate=iso(nd);render();};
    if(dn)dn.onclick=()=>{const nd=addDays(parseISO(dailyDate),step);if(nd<=ds[ds.length-1])dailyDate=iso(nd);render();};
  }
  if(S.tab==="my"){
    document.querySelectorAll("[data-clockin]").forEach(b=>b.onclick=()=>{ const r=clockTap("in"); if(!r.ok)toast(r.reason); });
    document.querySelectorAll("[data-walkin]").forEach(b=>b.onclick=()=>openWalkinSheet(b.dataset.walkin));
    document.querySelectorAll("[data-clockout]").forEach(b=>b.onclick=()=>{ const r=clockTap("out"); if(!r.ok)toast(r.reason); });
    document.querySelectorAll("[data-osclaim]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.osclaim, sid=S.viewAs, st=S.staff.find(x=>x.id===sid), q=st?(+st.quota||0):0;
      let over=false;
      if(q>0&&clinicalCountFor(sid)>=q){ if(!S.marketQuotaBypass){toast("You've reached your cycle quota ("+q+").");return;}
        if(!confirm("This is one more than your cycle share ("+q+"). Take it as extra cover anyway?"))return; over=true; }
      claimOpenShift(id,over);});
    document.querySelectorAll("[data-oswd]").forEach(b=>b.onclick=()=>{ const o=(S.openShifts||[]).find(x=>x.id===b.dataset.oswd); if(confirm(o&&o.kind==="gap"?"Withdraw this open shift? It goes back to being unfilled.":"Withdraw your offer? The shift comes back to you."))withdrawOpenShift(b.dataset.oswd); });   // an admin withdraws a posted gap from here too
    document.querySelectorAll("[data-osoffer]").forEach(b=>b.onclick=()=>{const d=b.dataset.osoffer;
      if(confirm("Offer "+fmtISO(d)+" to the whole group? Whoever claims it works it instead of you."))offerShift(S.viewAs,d);});
    const pOn=document.getElementById("pushOnBtn"); if(pOn)pOn.onclick=()=>pushEnable();
    const pOff=document.getElementById("pushOff"); if(pOff)pOff.onclick=()=>pushDisable();
    const sel=document.getElementById("mySel");
    const curSid=()=>sel?sel.value:S.viewAs;
    if(sel)sel.onchange=()=>{myPerson=sel.value;render();};
    const ds=cycleDates();
    const rF=document.getElementById("rFrom"); if(rF)rF.onchange=e=>{window._range.from=e.target.value;render();};   // absent when the first-run or "still being prepared" card stands in for My shifts
    const rT=document.getElementById("rTo"); if(rT)rT.onchange=e=>{window._range.to=e.target.value;render();};
    document.querySelectorAll("[data-preset]").forEach(b=>b.onclick=()=>{
      if(b.dataset.preset==="all"){window._range={from:iso(ds[0]),to:iso(ds[ds.length-1])};}
      else{const t=new Date();let f=dateInCycle(t)?t:ds[0];window._range={from:iso(f),to:iso(addDays(f,13))};}
      render();
    });
    const _g1=document.getElementById("icsBtn"); if(_g1)_g1.onclick=()=>exportICS(curSid());
    const subLive=document.getElementById("subLive");
    if(subLive)subLive.onclick=()=>{const s2=S.staff.find(x=>x.id===curSid());if(!s2)return;
      if(!s2.icsToken){ const tok=genIcsToken(); if(cloudOn()&&_evOk===true){ s2.icsToken=tok; _inflight.add("ics"); cloudBook(S.activeId,s2.id,[{op:"ics",sid:s2.id,token:tok}]).then(res=>{ _inflight.delete("ics"); const r=res&&res.ok===true&&Array.isArray(res.results)?res.results[0]:null; if(r&&r.ok&&r.val&&r.val.token){ if(r.val.token!==s2.icsToken){ s2.icsToken=r.val.token; render(); } } else { delete s2.icsToken; toast((r&&r.reason)||(res&&res.reason)||BOOK_OFFLINE,"danger"); render(); } }); }   // 16 Oct 2026: a tiny call, not a whole-roster save; the server keeps the first token minted
        else { s2.icsToken=tok; logAudit("ics.token",nameOf(s2.id)+" live-calendar link created",S.viewAs); save(); } }   // lazily mint the personal token on first open (synced so the feed server can match it)
      window._showSub=!window._showSub;render();};
    document.querySelectorAll("details.sec[data-sec]").forEach(d=>d.ontoggle=()=>{ secOpen("cal"); _secOpen[d.dataset.sec]=d.open; if(d.id==="calSec"){const b=document.getElementById("calToggle"); if(b)b.setAttribute("aria-expanded",d.open?"true":"false");} });
    const ct=document.getElementById("calToggle"); if(ct)ct.onclick=()=>{ secOpen("cal"); const cs=document.getElementById("calSec"); const open=!(cs&&cs.open); _secOpen.cal=open; if(cs){cs.open=open; if(open&&cs.scrollIntoView)try{cs.scrollIntoView({block:"start",behavior:"smooth"});}catch(e){}} ct.setAttribute("aria-expanded",open?"true":"false"); };
    const subCopy=document.getElementById("subCopy");
    if(subCopy)subCopy.onclick=()=>{const i=document.getElementById("subUrl");i.select();i.setSelectionRange(0,99999);
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(i.value).then(()=>toast("Link copied.","ok"),()=>{document.execCommand("copy");toast("Link copied.","ok");});
      else{document.execCommand("copy");toast("Link copied.","ok");}};
    const subReset=document.getElementById("subReset");
    if(subReset)subReset.onclick=()=>{if(!confirm("Reset this calendar link?\n\nThe old link stops working immediately — any calendar subscribed with it will stop updating, and you'll need to re-subscribe with the new link."))return;
      const s2=S.staff.find(x=>x.id===curSid());if(s2){s2.icsToken=genIcsToken();logAudit("ics.token",nameOf(s2.id)+" live-calendar link reset",S.viewAs);save();render();toast("New link created — the old one no longer works.","ok");}};
    const _g2=document.getElementById("vAgenda"); if(_g2)_g2.onclick=()=>{document.getElementById("vAgenda").classList.add("on");document.getElementById("vMonth").classList.remove("on");document.getElementById("myBody").innerHTML=agendaHTML(curSid(),window._range.from,window._range.to);};
    const _g3=document.getElementById("vMonth"); if(_g3)_g3.onclick=()=>{document.getElementById("vMonth").classList.add("on");document.getElementById("vAgenda").classList.remove("on");document.getElementById("myBody").innerHTML=monthHTML(curSid(),window._range.from,window._range.to);};
    wireFixedEditors();
  }
  if(S.tab==="messages"){
    const send=document.getElementById("msgSend");
    if(send)send.onclick=()=>{
      const ta=document.getElementById("msgText");const txt=(ta.value||"").trim();if(!txt)return;
      const to=document.getElementById("msgTo").value;
      if(isAdmin()){
        S.messages.unshift({id:"m"+Date.now(),from:"admin",to,text:txt,ts:Date.now()});
        notify(to==="all"?"all":to,"New message from Admin",null,{tab:"messages"});
      }else{
        S.messages.unshift({id:"m"+Date.now(),from:S.viewAs,to,text:txt,ts:Date.now()});
        notify(to==="admin"?"admin":to,nameOf(S.viewAs)+" sent you a message",null,{tab:"messages"});
      }
      if(isAdmin()||to==="admin")logAudit("message.send","to "+(to==="all"?"All staff":to==="admin"?"Admin":nameOf(to)),S.viewAs);
      replyTo=null; save();render();
    };
    document.querySelectorAll("[data-reply]").forEach(b=>b.onclick=()=>{replyTo=b.dataset.reply;render();const t=document.getElementById("msgText");if(t)t.focus();});
  }
  if(S.tab==="requests"){
    document.querySelectorAll("[data-clkok]").forEach(b=>b.onclick=()=>{ const sid=b.dataset.clkok.split("|")[0], d=b.dataset.clkok.split("|")[1], r=clockApprove(sid,d); if(r.reason)toast(r.reason); render(); });
    document.querySelectorAll("[data-clkno]").forEach(b=>b.onclick=()=>{ const sid=b.dataset.clkno.split("|")[0], d=b.dataset.clkno.split("|")[1], r=clockDecline(sid,d); if(r.reason)toast(r.reason); render(); });
    document.querySelectorAll("[data-askoff]").forEach(b=>b.onclick=()=>{ const id=b.dataset.askoff, o=(S.openShifts||[]).find(x=>x.id===id); if(!o)return;
      openConfirm({title:"Let "+nameOf(o.from)+" off "+fmtISO(o.iso)+"?",body:o.kind==="ask"?"They come off it now, and the day shows as needing cover. Nothing goes to the group.":"They come off it now. It stays with the group as an open shift until someone claims it.",ok:"Let them off"})
        .then(yes=>{ if(yes)decideComeOff(id,true,""); }); });
    document.querySelectorAll("[data-askkeep]").forEach(b=>b.onclick=()=>{ const id=b.dataset.askkeep, o=(S.openShifts||[]).find(x=>x.id===id); if(!o)return;
      openConfirm({title:"Keep "+nameOf(o.from)+" on "+fmtISO(o.iso)+"?",body:o.kind==="ask"?"They stay on the shift.":"They stay on the shift. Their offer to the group stays open, so a colleague can still take it.",ok:"Keep them on"})
        .then(yes=>{ if(yes)decideComeOff(id,false,""); }); });
    document.querySelectorAll("[data-rcask]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.rcask, inp=document.getElementById("cmt-"+id);
      askReqInfo(id,inp?inp.value:"");});
    document.querySelectorAll("[data-rcadd]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.rcadd, inp=document.getElementById("rc-"+id);
      addReqComment(id,inp?inp.value:"");});
    const rqL=document.getElementById("reqLeave");if(rqL)rqL.onclick=()=>{_reqSheet="leave";render();const f=document.getElementById("lvFrom");if(f&&f.focus)try{f.focus();}catch(e){}};
    const rqS=document.getElementById("reqSwap");if(rqS)rqS.onclick=()=>{_swapMode="peer";_reqSheet="swap";_swapMine=null;_swapNote="";render();const f=document.getElementById("swMine");if(f&&f.focus)try{f.focus();}catch(e){}};
    const rqC=document.getElementById("reqCancel");if(rqC)rqC.onclick=closeReqSheet;
    const ovlReq=document.getElementById("ovlReq");if(ovlReq)ovlReq.onclick=e=>{if(e.target===ovlReq)closeReqSheet();};
    const lvF=document.getElementById("lvFrom"), lvT=document.getElementById("lvTo"); if(lvF&&lvT)lvF.onchange=()=>{ if(!lvT.value||lvT.value<lvF.value)lvT.value=lvF.value; };   // To follows From
    const sub=document.getElementById("lvSubmit");
    if(sub)sub.onclick=()=>{
      const from=document.getElementById("lvFrom").value, to=document.getElementById("lvTo").value;
      clearErrors(document.getElementById("sheetRoot"));
      if(!from||!to){fieldError(document.getElementById(from?"lvTo":"lvFrom"),"Pick the dates first.");return;}
      if(to<from){fieldError(document.getElementById("lvTo"),"The end date is before the start date.");return;}
      submitLeaveRequest(S.viewAs,from,to,document.getElementById("lvCode").value,document.getElementById("lvReason").value);
      _reqSheet=null; render(); toast("Leave request sent — it's in Your requests.","ok");
    };
    document.querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.approve;const c=(document.getElementById("cmt-"+id)||{}).value||"";
      approveRequest(id,c);render();openEmailModal();if(lastEmail)_dlgReturn=document.querySelector('[data-cancel="'+id+'"]')||document.querySelector("[data-approve],[data-decline]")||document.querySelector("#tabs .tab.active");});
    document.querySelectorAll("[data-decline]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.decline;const c=(document.getElementById("cmt-"+id)||{}).value||"";
      declineRequest(id,c);render();openEmailModal();if(lastEmail)_dlgReturn=document.querySelector("[data-approve],[data-decline]")||document.querySelector("#tabs .tab.active");});
    const swp=document.getElementById("swPeer");if(swp)swp.onchange=()=>{swKeepNote();swapPeer=swp.value||null;render();const f=document.getElementById("swPeer");if(f&&f.focus)try{f.focus();}catch(e){}};
    const swsub=document.getElementById("swSubmit");if(swsub)swsub.onclick=()=>{
      const mine=document.getElementById("swMine").value, theirs=(document.getElementById("swTheirs")||{}).value;
      clearErrors(document.getElementById("sheetRoot"));
      if(!mine){fieldError(document.getElementById("swMine"),"Choose one of your shifts.");return;}
      if(!swapPeer){fieldError(document.getElementById("swPeer"),"Choose a colleague.");return;}
      if(!theirs){fieldError(document.getElementById("swTheirs"),"Choose their shift.");return;}
      if(submitSwapRequest(S.viewAs,mine,swapPeer,theirs,document.getElementById("swReason").value)){_reqSheet=null; render(); toast("Swap request sent — your colleague is asked first.","ok");}};
    document.querySelectorAll("[data-swmode]").forEach(b=>b.onclick=()=>{ swKeepNote(); const m=document.getElementById("swMine"); if(m&&m.value)_swapMine=m.value; _swapMode=b.dataset.swmode==="all"?"all":"peer"; render(); const f=document.getElementById("swMine"); if(f&&f.focus)try{f.focus();}catch(e){} });
    const swm=document.getElementById("swMine"); if(swm)swm.onchange=()=>{ swKeepNote(); _swapMine=swm.value||null; if(_swapMode==="all"){ render(); const f=document.getElementById("swMine"); if(f&&f.focus)try{f.focus();}catch(e){} } };   // Ask everyone says who the chosen shift reaches
    const swask=document.getElementById("swAsk"); if(swask)swask.onclick=()=>{ const mine=(document.getElementById("swMine")||{}).value, note=(document.getElementById("swNote")||{}).value||"";
      clearErrors(document.getElementById("sheetRoot"));
      if(!mine){fieldError(document.getElementById("swMine"),"Choose one of your shifts.");return;}
      if(swapAsk(S.viewAs,mine,note)){ _reqSheet=null; _swapMine=null; _swapNote=""; render(); toast("Asked everyone who could take it. Their offers will show here.","ok"); } };
    document.querySelectorAll("[data-swoffer]").forEach(b=>b.onclick=()=>{ const id=b.dataset.swoffer, sel=document.getElementById("swofs-"+id), o=(S.openSwaps||[]).find(x=>x.id===id); if(o&&sel&&sel.value&&swapOffer(id,sel.value))toast("Offer sent. "+nameOf(o.from)+" has been told.","ok"); });
    document.querySelectorAll("[data-swofferwd]").forEach(b=>b.onclick=()=>{ swapOfferWithdraw(b.dataset.swofferwd); });
    document.querySelectorAll("[data-swaccept]").forEach(b=>b.onclick=()=>{ const f=(S.swapOffers||[]).find(x=>x.id===b.dataset.swaccept), o=f&&(S.openSwaps||[]).find(x=>x.id===f.openId); if(!o)return; const seen={dateB:f.dateB,shift:Object.assign({},f.shift)};   // pinned when the confirm opens: Accept takes the offer it shows
      openConfirm({title:"Accept "+nameOf(f.by)+"\u2019s offer?",body:"You take "+swOfferLabel(swCycleOf(o),f.dateB,f.shift)+", and they take your "+fmtISO(o.dateA)+" shift. It goes to your admin to approve, and the other offers close.",ok:"Accept"})
        .then(yes=>{ if(yes&&swapAccept(f.id,seen))toast("Accepted. It has gone to your admin to approve.","ok"); }); });
    document.querySelectorAll("[data-swaskwd]").forEach(b=>b.onclick=()=>{ const o=(S.openSwaps||[]).find(x=>x.id===b.dataset.swaskwd); if(!o)return;
      openConfirm({title:"Stop asking about "+fmtISO(o.dateA)+"?",body:"Everyone who offered is told, and their offers close.",ok:"Withdraw"})
        .then(yes=>{ if(yes)swapAskWithdraw(o.id); }); });
    document.querySelectorAll("[data-peeragree]").forEach(b=>b.onclick=()=>{agreeSwap(b.dataset.peeragree);render();});
    document.querySelectorAll("[data-peerdecline]").forEach(b=>b.onclick=()=>{declineSwapPeer(b.dataset.peerdecline);render();});
    document.querySelectorAll("[data-approveswap]").forEach(b=>b.onclick=()=>{const id=b.dataset.approveswap;approveSwap(id,(document.getElementById("cmt-"+id)||{}).value||"");render();});
    document.querySelectorAll("[data-declineswap]").forEach(b=>b.onclick=()=>{const id=b.dataset.declineswap;declineSwap(id,(document.getElementById("cmt-"+id)||{}).value||"");render();});
    document.querySelectorAll("[data-withdraw]").forEach(b=>b.onclick=()=>{if(confirm("Withdraw this request? Your admin won't see it.")){withdrawRequest(b.dataset.withdraw);render();}});
    document.querySelectorAll("[data-reqcancel]").forEach(b=>b.onclick=()=>{if(confirm("Ask to cancel this approved request? Your admin decides — the roster changes only if they agree.")){requestCancellation(b.dataset.reqcancel);render();}});
    document.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>{if(confirm("Cancel this approved request? The roster goes back to what it was before approval, and they're notified.")){cancelApproved(b.dataset.cancel,"");render();}});
    document.querySelectorAll("[data-cancelapprove]").forEach(b=>b.onclick=()=>{const id=b.dataset.cancelapprove;cancelApproved(id,(document.getElementById("cmt-"+id)||{}).value||"");render();});
    document.querySelectorAll("[data-cancelkeep]").forEach(b=>b.onclick=()=>{keepApproval(b.dataset.cancelkeep);render();});
  }
  if(S.tab==="selfroster"){
    document.querySelectorAll("[data-clockin]").forEach(b=>b.onclick=()=>{ const r=clockTap("in"); if(!r.ok)toast(r.reason); });
    document.querySelectorAll("[data-walkin]").forEach(b=>b.onclick=()=>openWalkinSheet(b.dataset.walkin));
    document.querySelectorAll("[data-clockout]").forEach(b=>b.onclick=()=>{ const r=clockTap("out"); if(!r.ok)toast(r.reason); });
    const schSave=document.getElementById("schSave");if(schSave)schSave.onclick=()=>{const o=(document.getElementById("schOpen").value||""),c=(document.getElementById("schClose").value||""),en=document.getElementById("schOn").checked;active().window={enabled:en,open:o,close:c,fired:null};logAudit("selfroster.schedule",(en?"on":"off")+" "+o+" → "+c,"admin");save();checkRoundSchedule();render();toast(en?("Schedule saved — opens "+(o?schFmt(o):"now")+(c?", closes "+schFmt(c):"")+"."):"Schedule disabled.","ok");};
    // schedule persists only via the explicit "Save schedule" button (schSave) — no silent per-keystroke writes, so a cycle only gets a window when you deliberately save one
    const adFixed=document.getElementById("adFixed");if(adFixed)adFixed.onclick=()=>{const n=applyFixedPatterns();const rp=_fpReport||{conflicts:[],gaps:[]};logAudit("selfroster.fixed","placed "+n+" fixed/preference shifts"+(rp.conflicts.length?" · "+rp.conflicts.length+" conflicts":"")+(rp.gaps.length?" · "+rp.gaps.length+" no-zone gaps":""),"admin");save();
      let msg="Laid down "+n+" fixed/preference shifts (auto-zoned the 'any zone' days, balanced).";
      if(rp.conflicts.length)msg+="\n\n"+rp.conflicts.length+" zone conflict"+(rp.conflicts.length>1?"s":"")+" (two patterns want the same zone): "+rp.conflicts.slice(0,4).join("; ")+(rp.conflicts.length>4?" …":"");
      if(rp.gaps.length)msg+="\n\n"+rp.gaps.length+" 'any zone' day"+(rp.gaps.length>1?"s":"")+" couldn't fit (all zones taken): "+rp.gaps.slice(0,4).join("; ")+(rp.gaps.length>4?" …":"");
      msg+="\n\nNext: "+(isRolling()?"go live":"open booking")+" (step 3 below) so staff fill the rest.";
      toast(msg);render();};
    const adReset=document.getElementById("adReset");if(adReset)adReset.onclick=()=>{ openConfirm({title:"Reset "+cyLabel(active())+" to a fresh draft?",body:"Removes every placed shift \u2014 booked, fixed-pattern and CST \u2014 plus on-call takes and open shifts; clears the schedule and the round\u2019s history; sets the cycle back to draft, hidden from staff until you open it again.\n\nLeave and unavailable marks stay. Fixed patterns and every setting stay: Auto-draft lays the fixed shifts down again. There is no undo.",ok:"Reset this cycle",danger:true}).then(yes=>{ if(!yes)return; const k=resetCycle(); render(); toast("Reset \u2014 "+k+" placed shift"+(k===1?"":"s")+" removed; the cycle is a fresh draft.","ok"); }); };
    const adFixedClear=document.getElementById("adFixedClear");if(adFixedClear)adFixedClear.onclick=()=>{ const n=fixedPlacedCount(active()); openConfirm({title:"Remove the "+n+" fixed-pattern shift"+(n===1?"":"s")+" from "+cyLabel(active())+"?",body:"The patterns themselves stay committed; Auto-draft fixed shifts lays them down again. Leave and unavailable marks stay. There is no undo.",ok:"Remove fixed shifts",danger:true}).then(yes=>{ if(!yes)return; const k=clearFixedShifts(); render(); toast("Removed "+k+" fixed-pattern shift"+(k===1?"":"s")+".","ok"); }); };
    const adMin=document.getElementById("adMin");if(adMin)adMin.onclick=()=>{const r=autoDraft(false);toast("Filled to minimum cover: placed "+r.filled+" shifts. Coverage gaps remaining: "+r.gaps+".");render();};
    const adMax=document.getElementById("adMax");if(adMax)adMax.onclick=()=>{const r=autoDraft(true);toast("Filled to maximum: placed "+r.filled+" shifts. Coverage gaps remaining: "+r.gaps+".");render();};
    const adClear=document.getElementById("adClear");if(adClear)adClear.onclick=()=>{ const p=rosterClearPlan(active());
      openConfirm({title:"Clear the roster for "+cyLabel(active())+"?",body:rosterClearBody(p),ok:"Clear the roster",danger:true}).then(yes=>{ if(!yes)return; clearRoster(); render(); toast("Roster cleared for "+cyLabel(active())+".","ok"); }); };
    const snStart=document.getElementById("snStart");if(snStart)snStart.onclick=()=>{startRounds();render();};
    const snAdvance=document.getElementById("snAdvance");if(snAdvance)snAdvance.onclick=()=>{advanceTurn();render();};
    const snStop=document.getElementById("snStop");if(snStop)snStop.onclick=()=>{stopRounds();render();};
    const wvStart=document.getElementById("wvStart");if(wvStart)wvStart.onclick=()=>{startWaves();render();};
    const wvNext=document.getElementById("wvNext");if(wvNext)wvNext.onclick=()=>{if(!waveAllSettled()&&!confirm("Open the next group? Not everyone in the current group has booked their share or marked themselves done."))return;advanceWave();render();};
    const wvReassign=document.getElementById("wvReassign");if(wvReassign)wvReassign.onclick=()=>{if(confirm("Re-draw the groups? The order and progress start again; booked shifts are kept."))startWaves();render();};
    const wvStop=document.getElementById("wvStop");if(wvStop)wvStop.onclick=()=>{if(confirm("Stop the groups? Everyone will be able to book at once, within the guards."))stopWaves();render();};
    const wvDone=document.getElementById("wvDone");if(wvDone)wvDone.onclick=()=>{const w=active().waveState;setWaveDone(_srSid,!(w&&w.done&&w.done[_srSid]));render();};
    const snPass=document.getElementById("snPass");if(snPass)snPass.onclick=()=>{advanceTurn();render();};
    const srWho=document.getElementById("srWho");if(srWho)srWho.onchange=()=>{myPerson=srWho.value;render();};
    document.querySelectorAll("[data-bday]").forEach(b=>b.onclick=()=>openDaySheet(b.dataset.bday));
    const dsClose=document.getElementById("dsClose");if(dsClose)dsClose.onclick=closeDaySheet; const ovlDay=document.getElementById("ovlDay");if(ovlDay)ovlDay.onclick=e=>{if(e.target===ovlDay)closeDaySheet();};
    document.querySelectorAll("[data-dsper]").forEach(b=>b.onclick=()=>{_sheetPeriod=b.dataset.dsper;render();});
    document.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>srTapPick(b.dataset.pick));
    document.querySelectorAll(".srConfirm").forEach(b=>b.onclick=srBatchBook);
    document.querySelectorAll(".srClear").forEach(b=>b.onclick=()=>{_srPick=[];_srHours={};render();});
    const rcD=document.getElementById("rcDone"); if(rcD)rcD.onclick=()=>{ _receipt=null; render(); };
    const rcC=document.getElementById("rcCal"); if(rcC)rcC.onclick=()=>{ _receipt=null; go("my",{anchor:"calSec"}); };
    document.querySelectorAll("[data-book]").forEach(b=>b.onclick=()=>{const parts=b.dataset.book.split("|");if(bookShift(_srSid||(srWho?srWho.value:S.viewAs),parts[0],parts[1],parts[2],parts[3]))closeDaySheet();});   // the fourth segment is the shift type — dropping it books a half shift where the chip offered a whole day
    document.querySelectorAll("[data-unbook]").forEach(b=>b.onclick=()=>{if(unbookShift(_srSid||(srWho?srWho.value:S.viewAs),b.dataset.unbook))closeDaySheet();});
    document.querySelectorAll("[data-osoffer]").forEach(b=>b.onclick=()=>{ const d=b.dataset.osoffer, who=_srSid||S.viewAs;   // the day sheet's own copy — the My shifts one is wired in that tab's block
      openConfirm({title:"Offer "+fmtISO(d)+" to the group?",body:"You stay on it until a colleague takes it, so the shift is never uncovered.",ok:"Offer it"})
        .then(yes=>{ if(yes&&offerShift(who,d))closeDaySheet(); }); });
    document.querySelectorAll("[data-osask]").forEach(b=>b.onclick=()=>{ const d=b.dataset.osask, who=_srSid||S.viewAs;
      openDialog(`<div class="overlay" id="ovlAsk"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="askT"><h3 id="askT">Ask to come off ${escapeHTML(fmtISO(d))}</h3>
        <div class="sub">${(featOn("marketplace")&&S.marketOn)?"It goes to the group at the same time, so a colleague can take it before your admin needs to decide.":"It goes to your admin, who decides."}</div>
        <label class="field" style="margin-top:10px"><span class="lbl">Why you need to be off it</span><input id="askWhy" placeholder="e.g. family funeral"></label>
        <div class="flexbtns" style="margin-top:16px"><span class="grow"></span><button class="btn" id="askCancel">Cancel</button><button class="btn primary" id="askSend">Send</button></div></div></div>`,{focus:"#askWhy"});
      const c=document.getElementById("askCancel"); if(c)c.onclick=closeModal;
      const g=document.getElementById("askSend"); if(g)g.onclick=()=>{ const el=document.getElementById("askWhy"), why=((el||{}).value||"").trim();
        if(!why){ fieldError(el,"Say why \u2014 your admin decides on this."); return; }
        closeModal(); if(askComeOff(who,d,why))closeDaySheet(); }; });
    document.querySelectorAll("[data-osdrop]").forEach(b=>b.onclick=()=>{ const d=b.dataset.osdrop, who=_srSid||(srWho?srWho.value:S.viewAs), cyc=active();
      const tells=gapOnDrop(cyc), mine=!isAdmin()||who===S.viewAs;
      openConfirm({title:mine?("Come off "+fmtISO(d)+"?"):("Take "+nameOf(who)+" off "+fmtISO(d)+"?"),body:(mine?"You come off it now.":nameOf(who)+" comes off it now.")+(tells?" It goes to the whole group as an open shift.":""),ok:mine?"Come off it":"Take them off",danger:true})
        .then(yes=>{ if(!yes)return; if(dropShift(who,d))closeDaySheet(); }); });
    document.querySelectorAll("[data-swapit]").forEach(b=>b.onclick=()=>{ _daySheet=null; _ciForm=null; _hrForm=null; _swapMine=b.dataset.swapit; _swapNote=""; swapPeer=null; _swapMode="peer"; S.tab="requests"; _reqSheet="swap"; saveLocal(); render(); const f=document.getElementById("swMine"); if(f&&f.focus)try{f.focus();}catch(e){} });   // the one swap screen, with this shift chosen
    document.querySelectorAll("[data-hrchange]").forEach(b=>b.onclick=()=>{ const d=b.dataset.hrchange, w=shiftWindow(active(),getShift(_srSid||S.viewAs,d))||{start:"",end:""}; _hrForm={d:d,start:w.start,end:w.end}; render(); const f=document.querySelector("#sheetRoot .hrc-from"); if(f&&f.focus)try{f.focus();}catch(e){} });
    document.querySelectorAll("[data-hrcancel]").forEach(b=>b.onclick=()=>{ _hrForm=null; render(); });
    document.querySelectorAll("[data-hrsave]").forEach(b=>b.onclick=()=>{ const f=document.querySelector("#sheetRoot .hrc-from"), t=document.querySelector("#sheetRoot .hrc-to"), a=f?f.value:"", z=t?t.value:""; if(_hrForm){ _hrForm.start=a; _hrForm.end=z; } if(hoursSet(_srSid||S.viewAs,b.dataset.hrsave,a,z)){ _hrForm=null; render(); } });   // a refused save keeps what was typed
    document.querySelectorAll("[data-hrclear]").forEach(b=>b.onclick=()=>{ if(hoursSet(_srSid||S.viewAs,b.dataset.hrclear,"","")){ _hrForm=null; render(); } });
    (function(){ const f=document.querySelector("#sheetRoot .hr-from"), t=document.querySelector("#sheetRoot .hr-to"); if(!f||!t||!_daySheet)return; const d=_daySheet, keepTyped=()=>{ _srHours[d]={start:f.value||"",end:t.value||""}; }; f.onchange=keepTyped; t.onchange=keepTyped; })();   // the Hours row beside a pick: kept by day until Confirm
    document.querySelectorAll("[data-octake]").forEach(b=>b.onclick=()=>{ const a=String(b.dataset.octake).split("|");
      if(ocTake(_srSid||S.viewAs,a[0],a[1]))render(); });
    document.querySelectorAll("[data-ocdrop]").forEach(b=>b.onclick=()=>{ const a=String(b.dataset.ocdrop).split("|");
      if(ocClear(_srSid||S.viewAs,a[0],a[1]))render(); });
    document.querySelectorAll("[data-ciopen]").forEach(b=>b.onclick=()=>{ if(ciOpenForm(b.dataset.ciopen))render(); });
    document.querySelectorAll("[data-cicancel]").forEach(b=>b.onclick=()=>{ _ciForm=null; render(); });
    document.querySelectorAll("[data-cisave]").forEach(b=>b.onclick=()=>{ const f=document.querySelector("#sheetRoot .ci-from"), t=document.querySelector("#sheetRoot .ci-to"); if(ciSaveForm(b.dataset.cisave,f?f.value:"",t?t.value:""))render(); });
    document.querySelectorAll("[data-cidel]").forEach(b=>b.onclick=()=>{ const p=ciParse(b.dataset.cidel), ci=p&&ciGet(active(),p.d,p.win,p.sid); if(!ci)return;
      openConfirm({title:"Remove this call-in?",body:"Called in "+ocTime(ci)+" on "+fmtISO(p.d)+". It comes off pay and the counts.",ok:"Remove",danger:true}).then(yes=>{ if(yes&&ciRemove(p.sid,p.d,p.win))render(); }); });
    document.querySelectorAll("[data-setcst]").forEach(b=>b.onclick=()=>{const who=_srSid||(srWho?srWho.value:S.viewAs); const _cj=getShift(who,b.dataset.setcst).kind==="cst"?{ok:true}:cstJudge(who,b.dataset.setcst); if(!_cj.ok){toast(_cj.reason);return;}   // the button is already disabled; a stale screen gets the same answer
      if(markDay(who,b.dataset.setcst,{kind:"cst"}))closeDaySheet(); });
    document.querySelectorAll("[data-setoff]").forEach(b=>b.onclick=()=>{const who=_srSid||(srWho?srWho.value:S.viewAs); if(markDay(who,b.dataset.setoff,{kind:"off"}))closeDaySheet();});
    document.querySelectorAll("[data-setua]").forEach(b=>b.onclick=()=>{const who=_srSid||(srWho?srWho.value:S.viewAs); if(markDay(who,b.dataset.setua,{kind:"leave",code:"UA"}))closeDaySheet();});
    document.querySelectorAll("[data-rmua]").forEach(b=>b.onclick=()=>{const who=_srSid||(srWho?srWho.value:S.viewAs);const d=b.dataset.rmua;setShift(who,d,{kind:"off"});clearLeaveDay(who,d);logAudit("selfroster.ua.remove",nameOf(who)+" "+d,who);save();closeDaySheet();});
  }
  if(S.tab==="equity"){
    document.querySelectorAll("[data-eqp]").forEach(b=>b.onclick=()=>{window._eqPeriod=b.dataset.eqp;render();});
    const ep=document.getElementById("eqPrint"); if(ep)ep.onclick=()=>{ document.body.classList.add("print-eq"); window.print(); setTimeout(()=>document.body.classList.remove("print-eq"),1200); };   // only the summary reaches paper, like the capacity case
    document.querySelectorAll("[data-tough]").forEach(cb=>cb.onchange=()=>{ S.toughList=S.toughList||{}; S.toughList[cb.dataset.tough]=cb.checked;
      logAudit("settings.tough",Object.keys(S.toughList).filter(k=>S.toughList[k]).join(", ")||"(none)","admin"); save(); render(); });
  }
  if(S.tab==="planner"){
    const pp=document.getElementById("plPrev"),pn=document.getElementById("plNext");
    if(pp)pp.onclick=()=>{plannerMonth=new Date(plannerMonth.getFullYear(),plannerMonth.getMonth()-1,1);render();};
    if(pn)pn.onclick=()=>{plannerMonth=new Date(plannerMonth.getFullYear(),plannerMonth.getMonth()+1,1);render();};
    const xls=document.getElementById("plXls"),csv=document.getElementById("plCsv");
    if(xls)xls.onclick=exportPlannerXLS; if(csv)csv.onclick=exportPlannerCSV;
    document.querySelectorAll("td.pcell").forEach(td=>td.onclick=()=>openPlannerCell(td.dataset.ps,td.dataset.pd));
    document.querySelectorAll(".pmday[data-pday]").forEach(el=>el.onclick=()=>openPlannerDay(el.dataset.pday));
  }
  if(S.tab==="help"){
    const hrl=document.getElementById("helpReload"); if(hrl)hrl.onclick=e=>{ e.preventDefault(); location.reload(); };
    const fb=document.getElementById("fbOpen"); if(fb)fb.onclick=openFeedback;
    document.querySelectorAll("[data-vid]").forEach(b=>b.onclick=()=>openVideo(b.dataset.vid));
    document.querySelectorAll(".fbrev").forEach(b=>b.onclick=()=>{const f=(S.feedback||[]).find(x=>x.id===b.dataset.fb); if(f){f.reviewed=!f.reviewed; save(); render();}});
    document.querySelectorAll("[data-fbreply]").forEach(b=>b.onclick=()=>{   // reply to feedback → mark it reviewed, open Messages to that staffer with a pre-filled reference
      const f=(S.feedback||[]).find(x=>x.id===b.dataset.fbreply); if(!f)return;
      f.reviewed=true; replyTo=f.from; save();                               // (a) replying marks the feedback reviewed
      S.tab="messages"; saveLocal(); render();
      const t=document.getElementById("msgText"); if(t){ const snip=(f.text||"").trim(); t.value="Re: your feedback"+(snip?` ("${snip.slice(0,60)}${snip.length>60?"…":""}")`:"")+" — "; t.focus(); t.setSelectionRange(t.value.length,t.value.length); }   // (b) pre-fill a short reference
    });
  }
}

function safeRenderInit(){ try{ render(); }catch(e){ console.error("render failed, resetting:",e); S=defaultState(); try{localStorage.setItem(orgKey(),JSON.stringify(S));}catch(x){} render(); } }
async function boot(){
  clockReadURL();   // a poster scan: kept aside until the sign-in has resolved its group
  goReadURL();   // the landing page's link to Help, likewise
  if(cloudOn()){
    load(); // have a valid local S so the auth screen can render while we connect
    authState="checking"; cloudState="connecting"; safeRenderInit();
    try{
      cloudInit();
      _sb.auth.onAuthStateChange((_e,sess)=>{ handleAuth(sess); });
      const {data}=await _sb.auth.getSession();
      await handleAuth(data?data.session:null);
    }catch(e){ console.error("cloud boot failed",e); cloudState="error"; _orgError="Couldn't reach the server — "+((e&&e.message)||"connection failed"); authState="orgerror"; safeRenderInit(); }
  } else { authState="local"; load(); safeRenderInit(); clockApplyURL(); goApplyURL(); }
}
let _wasMobile=isMobile();
window.addEventListener("resize",()=>{const m=isMobile(); if(m!==_wasMobile){_wasMobile=m; if(!m)_moreOpen=false; try{render();}catch(e){}}});
window.addEventListener("online",()=>{ if(cloudOn()&&_cloudDirty&&_sb&&!_applyingRemote){ cloudState="connecting"; syncFlash("online"); cloudSave(); } if(cloudOn()&&authState==="in")_evCatchUp(); });
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState!=="visible")return; if(cloudOn()&&authState==="in")_evCatchUp(); _buildCheck(); });   // back to the screen: the bookings made while it was away, and whether a push has landed
setTimeout(_buildCheck,3000); setInterval(_buildCheck,600000);   // the page's own tag once it is up, then a look every ten minutes
setInterval(()=>{ if(cloudOn()&&authState==="in"&&document.visibilityState==="visible")_evCatchUp(); },45000);   // a cheap, empty answer when nothing happened; the chips stay honest if realtime goes quiet   // the sync word says it; no toast   // auto-retry a failed save once the connection returns
// dismiss any modal with Esc or a tap on the backdrop
(function(){ const mr=document.getElementById("modalRoot"); const shut=()=>{ if(mr&&mr.innerHTML)closeModal(); };
  if(mr)mr.addEventListener("click",e=>{ if(e.target&&e.target.classList&&e.target.classList.contains("overlay"))shut(); });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape")shut(); }); })();
setInterval(()=>{ try{ if((authState==="in"||!cloudOn())&&typeof S!=="undefined"&&S.cycles){ if(checkRoundSchedule())bgRender(); } }catch(e){} },30000);
boot();
