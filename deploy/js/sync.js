"use strict";

/* ----- cloud storage layer (only active when cloudOn()) ----- */
let _sb=null, _cloudTimer=null, _applyingRemote=false, cloudState="local", _orgUpdated=null, _remoteBase=null, _cloudDirty=false, _cloudErrShown=false, _lastTs=0, _savePending=false;
let _evOk=null, _evSeq=0, _evDocSeq=0, _evKeySeq={}, _evBase=[], _evBaseT=null, _evCatch=false, _docT=null, _docBusy=false, _docAgain=false, _evProbeWait=2000, _rtStatus="", _rtNoFilter=false, _rtChan=null;   // _evDocSeq: the newest event the document this device holds already reflects — read from the server just BEFORE each document read, equal to _evSeq after this device's own document save, and raised by a marker the server writes into the event stream on every whole-document save. An event at or below it is never applied: the document is newer (16 Oct 2026 — a cleared roster had its test bookings replayed back onto a freshly loaded phone, then saved for everyone)   // _rtStatus: the live channel's last state word; _rtNoFilter: the server refused the group filter, so the phone listens to its own groups' rows unfiltered   // 14 Oct 2026: bookings go through roster_commit() and travel as roster_events rows (supabase/prod-booking-rpc.sql). _evOk: true once the table is seen, false when the database has none (the old way), null until probed. _evSeq: the newest event this device has applied; _evKeySeq: per key, so an older event arriving late never undoes a newer one; _evBase: events waiting to be folded into the merge base
const BOOK_OFFLINE="Couldn\u2019t reach Myrosta \u2014 that tap wasn\u2019t saved. Check your signal and try again.";
let _bootTag=null, _newBuild=false, _reloadT=null;   // the server's tag for this page at boot, and whether a newer one has been seen since: a phone kept open on the home screen across a push runs the old script until it reloads — so once a newer build is seen the app reloads itself the moment it is idle (15 Oct 2026: staff were not tapping Reload)
function _idleForReload(){ try{ if(_daySheet||_reqSheet||_moreOpen||_notifsOpen)return false; if(_inflight&&_inflight.size)return false; if(_savePending||_cloudDirty)return false;   // never mid-tap, never over an unsaved edit
  const ae=document.activeElement; if(ae&&(ae.tagName==="INPUT"||ae.tagName==="TEXTAREA"||ae.tagName==="SELECT"))return false; const mr=document.getElementById("modalRoot"); if(mr&&mr.innerHTML)return false; return true; }catch(e){ return false; } }
function _reloadWhenIdle(){ clearTimeout(_reloadT); _reloadT=null; if(!_newBuild)return; if(_idleForReload()){ location.reload(); return; } _reloadT=setTimeout(_reloadWhenIdle,2000); }   // a sheet open or a save in flight: look again in two seconds
function newBuildPaint(){ let el=document.getElementById("newbuild"); if(!el){ el=document.createElement("div"); el.id="newbuild"; el.className="newbuild"; el.setAttribute("role","status"); document.body.appendChild(el); }
  el.innerHTML=_newBuild?`<span>Myrosta has been updated \u2014 it will reload itself in a moment.</span><button class="btn sm primary" id="nbReload">Update now</button>`:""; const b=document.getElementById("nbReload"); if(b)b.onclick=()=>location.reload(); }
function _buildSeen(tag){ if(!tag)return false; if(!_bootTag){ _bootTag=tag; return false; } if(tag!==_bootTag&&!_newBuild){ _newBuild=true; newBuildPaint(); clearTimeout(_reloadT); _reloadT=setTimeout(_reloadWhenIdle,4000); } return _newBuild; }   // four seconds to read the bar, then the reload the moment the app is idle   // the first tag is this build's own; any other means a push has landed
async function _buildCheck(){ if(typeof fetch!=="function"||_newBuild)return; try{ const r=await fetch(location.pathname||"/app.html",{method:"HEAD",cache:"no-store"}); if(!r||!r.ok||!r.headers||typeof r.headers.get!=="function")return; _buildSeen(r.headers.get("etag")||r.headers.get("last-modified")||""); }catch(e){} }   // one HEAD request: the host's tag for the page, nothing downloaded   // a booking is a claim on a shared slot: the phone never keeps one the server has not confirmed
let _org=CLOUD.org, _orgChoices=[], _orgCount=1, _legacyDb=false, _orgLabel="", _orgHospital="", _orgHospitalId="", _orgError="", _tabOrg=null;   // multi-org: resolved at sign-in from my_orgs(); falls back to single-org mode on a pre-migration database
function _snap(o){ try{return JSON.stringify(o);}catch(e){return "";} }
function _keepBase(){ try{ localStorage.setItem(orgKey(),JSON.stringify(S)); localStorage.setItem(orgKey("_base"),_remoteBase||""); }catch(e){} }   // the merge base is kept WITH the copy it belongs to: a stale base at the next launch reads other people's changes as this device's own and undoes them
function nextTs(){ let t=Date.now(); if(t<=_lastTs)t=_lastTs+1; _lastTs=t; return new Date(t).toISOString(); }   // strictly-increasing per device — no two of our writes ever share a timestamp (keeps CAS airtight)
function cloudOk(){ cloudState="connected"; _cloudDirty=false; _cloudErrShown=false; }
function devNoun(){ try{ return isMobile()?"phone":"device"; }catch(e){ return "device"; } }   // the word for what the person is holding
function syncWord(){ return cloudState==="error"?("Offline · saved on this "+devNoun()):(cloudState==="checking"||cloudState==="connecting")?"Connecting…":(_syncFlash==="saving"?"Saving…":"Synced"); }   // one vocabulary for the account rows
function cloudStateHTML(){   // the sync word: silent when synced, a pulsing dot while saving, "Saved" for a moment, honest when offline
  if(!cloudOn())return ""; const w=(k,a,b)=>`<span class="sdot ${k}"></span><span class="ss">${a}</span>${b?`<span class="sw">${b}</span>`:""}`;
  if(cloudState==="error")return w("warn","Offline"," · saved on this "+devNoun());
  if(_syncFlash==="online")return w("busy","Back online"," — syncing");
  if(_syncFlash==="saving")return w("busy","Saving…");
  if(_syncFlash==="saved")return w("ok","Saved");
  if(cloudState==="checking"||cloudState==="connecting")return w("busy","Connecting…");
  return ""; }
function syncPaint(){ try{ const cp=document.getElementById("cloudPill"); if(!cp)return; const h=cloudStateHTML(); cp.innerHTML=h; cp.style.display=h?"":"none"; cp.className="sync"+(cloudState==="error"?" warn":""); }catch(e){} }   // paints the word alone — never a full render
function syncFlash(k,ms){ _syncFlash=k; syncPaint(); clearTimeout(_syncT2); if(ms)_syncT2=setTimeout(()=>{ if(_syncFlash===k){ _syncFlash=null; syncPaint(); } },ms); }
function cloudErr(){ cloudState="error"; _cloudDirty=true; _syncFlash=null; clearTimeout(_syncT1); syncPaint(); if(!_cloudErrShown){ _cloudErrShown=true; try{toast("Offline — your changes are saved on this "+devNoun()+" and will sync when you reconnect.");}catch(e){} } }
function cloudInit(){ if(_sb)return; _sb=window.supabase.createClient(CLOUD.url,CLOUD.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:_authStore}}); }
function _isMissingTable(e){ const c=String((e&&e.code)||""), m=String((e&&e.message)||""); return c==="PGRST205"||c==="42P01"||/could not find the table|relation .* does not exist/i.test(m); }   // the database has not had supabase/prod-booking-rpc.sql yet: book the old way
async function _evProbe(realign){   // is the booking call there? The newest event\u2019s seq is read BEFORE the document, so it is the watermark: everything at or below it is in the document about to be read
  try{ const r=await _sb.from("roster_events").select("seq").eq("org",_org).order("seq",{ascending:false}).limit(1).maybeSingle();
    if(r&&r.error){ if(_isMissingTable(r.error)){ _evOk=false; return false; } console.warn("events probe",r.error); _evOk=null; return false; }
    _evOk=true; const sq=(r&&r.data&&+r.data.seq)||0; if(sq>_evSeq)_evSeq=sq; if(sq>_evDocSeq)_evDocSeq=sq; if(realign)_docRefetch(); return true; }   // probed only after the document was read: fetch it again so the watermark and the document agree
  catch(e){ console.warn("events probe",e); _evOk=null; return false; } }
async function cloudLoad(){ await _evProbe(); const {data,error}=await _sb.from("org_state").select("data,updated").eq("org",_org).maybeSingle(); if(error)throw error; if(data){_orgUpdated=data.updated;_remoteBase=_snap(data.data);} return data?data.data:null; }
/* ----- multi-org: which organisation does this sign-in belong to? ----- */
function _pickOrg(orgs,saved){
  if(!orgs||!orgs.length)return {denied:true};
  if(orgs.length===1)return {org:orgs[0].org};
  if(saved&&orgs.find(o=>o.org===saved))return {org:saved};
  return {choices:orgs};
}
function _setOrgMeta(me){ _orgLabel=me.label||""; _orgHospital=me.hospital||""; _orgHospitalId=me.hospital_id||""; }   // my_orgs()'s fifth column names the hospital; a database without it leaves the id empty, so nothing publishes and no department switch appears
function _isMissingFn(e){ const c=String((e&&e.code)||""), m=String((e&&e.message)||""); 
  return c==="PGRST202" || /could not find the function/i.test(m); }   // ONLY PostgREST\u2019s missing-function signature — a proxy 404 or generic "not found" is transient, never legacy
async function resolveOrg(){
  let orgs=null, lastErr=null;
  for(let attempt=0; attempt<2; attempt++){
    try{ const r=await _sb.rpc("my_orgs"); if(r.error)throw r.error; orgs=r.data||[]; lastErr=null; break; }
    catch(e){ lastErr=e;
      // ONLY a genuinely missing function means "pre-migration database" → single-org mode.
      // Anything else (offline, 5xx, cold start, expired token) must NOT silently drop someone into
      // the default organisation — on a migrated database that would load the wrong roster.
      if(_isMissingFn(e)){ _legacyDb=true; _org=CLOUD.org; _orgCount=1; return true; }
      if(attempt===0)await new Promise(r2=>setTimeout(r2,900));   // one retry for a blip
    }
  }
  if(lastErr){ authState="orgerror"; _orgError=String((lastErr&&lastErr.message)||lastErr); render(); return false; }
  let saved=null; try{ saved=localStorage.getItem("myrosta_org"); }catch(e){}
  const pick=_pickOrg(orgs,saved);
  if(pick.denied){ authState="denied"; render(); return false; }
  if(pick.choices){ _orgChoices=pick.choices.map(o=>({org:o.org,role:o.role,hospital:o.hospital||"",label:o.label||""})); authState="pickorg"; render(); return false; }
  _org=pick.org; _orgCount=orgs.length;
  _setOrgMeta(orgs.find(o=>o.org===_org)||{});
  // second guard (belt and braces): a cache written under a different organisation is never reused
  try{ localStorage.setItem("myrosta_last_org",_org); }catch(e){}   // cache keys are org-scoped (orgKey) — no purge needed on switch
  try{ localStorage.setItem("myrosta_org",_org); }catch(e){}
  return true;
}
/* One key, one owner: a slot I did not touch is theirs to decide (their write, their edit or their
   DELETION); a slot I touched keeps mine, including my deletion. Shared by the shifts and the on-call
   roster, which is the whole reason the on-call key is flat. */
function _mergeKeyMap(mine,theirs,base,shared){ const J=JSON.stringify, m=mine||{}, t=theirs||{}, b=base||{}, out={};
  Object.keys(m).forEach(k=>{ out[k]=m[k]; });
  const ks={}; Object.keys(m).forEach(k=>{ks[k]=1;}); Object.keys(t).forEach(k=>{ks[k]=1;}); Object.keys(b).forEach(k=>{ks[k]=1;});
  Object.keys(ks).forEach(k=>{ if(J(m[k])===J(b[k])){ if(t[k]===undefined)delete out[k]; else out[k]=t[k]; }
    else if(shared&&t[k]!=null&&J(t[k])!==J(b[k]))out[k]=t[k]; });   // a slot everyone shares (on-call): when both sides changed it, what already reached the cloud stands, so a late take or a stale removal never displaces a newer holder. A shift key belongs to one person and keeps the old rule
  return out; }
// ---- 3-way merge (mine vs theirs vs base = last-synced remote) ----
// Every id-carrying array (requests, messages, leave, notifications, audit, feedback, staff) merges per-ELEMENT:
// additions from both sides survive, deletions are honoured, and an element only takes "mine" if I actually changed it.
const _VOL_STAFF=["quota","eft","hrsFortnight","periodTargets","perFortnight","cstQuota","cstTargets"];   // hydration mirrors the active cycle's role onto these each render — not a real edit
function _stripVol(o,vol){ if(!o||!vol)return o; const c=Object.assign({},o); vol.forEach(f=>delete c[f]); return c; }
function _mergeIdArray(mine,theirs,base,vol){
  const key=o=>String(o&&o.id); const bm={},tm={},mm={};
  (base||[]).forEach(o=>{bm[key(o)]=o;}); (theirs||[]).forEach(o=>{tm[key(o)]=o;}); (mine||[]).forEach(o=>{mm[key(o)]=o;});
  const eq=(a,b)=>JSON.stringify(_stripVol(a,vol))===JSON.stringify(_stripVol(b,vol));
  const myAdds=[]; (mine||[]).forEach(m=>{ const k=key(m); if(!(k in tm)){ const b=bm[k];
    if(b===undefined)myAdds.push(m);                                     // my new item
    else if(!eq(m,b))myAdds.push(m); } });                               // they deleted it but I edited it since base — edit wins
  const out=[]; (theirs||[]).forEach(t=>{ const k=key(t), b=bm[k], m=mm[k];
    if(m===undefined){ if(b===undefined)out.push(t);                     // their new item
      else if(!eq(b,t))out.push(t); }                                    // I deleted it but they edited it — edit wins; otherwise stays deleted
    else if(b!==undefined&&!eq(m,b))out.push(m);                         // I changed it — mine
    else out.push(t); });                                                // untouched by me — theirs decides
  return myAdds.concat(out); }                                           // my additions first (arrays render newest-first)
function _fixTokens(outStaff,theirsArr,baseArr){ (outStaff||[]).forEach(s=>{   // concurrent first-mint of a calendar token → the server's wins everywhere (an explicit reset changed it FROM a base value, so that keeps mine)
  const t=(theirsArr||[]).find(x=>x.id===s.id), b=(baseArr||[]).find(x=>x.id===s.id);
  if(t&&t.icsToken&&s.icsToken&&t.icsToken!==s.icsToken&&!(b&&b.icsToken))s.icsToken=t.icsToken; }); }
// deterministic post-merge repair: every device dropping the same key produces the same audit id, so entries dedupe on the next merge
function _mergeInvariants(out){ try{ (out.cycles||[]).forEach(cyc=>{ if(!cyc.assign)return;
  const st=(cyc.settings&&cyc.settings.staffing)||out.staffing||{};
  const drop=(k,why)=>{ delete cyc.assign[k]; (out.audit=out.audit||[]).unshift({id:"afix-"+cyc.id+"-"+k.replace(/[^A-Za-z0-9]/g,""),ts:Date.now(),actor:"system",action:"merge.fix",detail:why+" ("+k+")"}); };
  const zoneSeen={}, cnt={};
  Object.keys(cyc.assign).sort().forEach(k=>{ const v=cyc.assign[k]; if(!v)return; const i=k.indexOf("|"), sid=k.slice(0,i), d=k.slice(i+1);
    if(v.kind!=="leave"){ const lv=(out.leave||[]).find(L=>L.staffId===sid&&L.status==="approved"&&L.code!=="UA"&&L.from<=d&&L.to>=d);
      if(lv){ drop(k,"shift removed — approved "+lv.code+" leave on "+d); return; } }                       // leave wins over a merged-in booking; "unavailable" does not — a shift placed on such a day was placed knowingly
    if(v.kind==="clinical"){ const fl=fillsOf(cyc,v); let bad=null;                                          // a full shift occupies its zone, and counts against the maximum, in every period it fills
      for(let i=0;i<fl.length&&!bad;i++)if(zoneSeen[d+"|"+fl[i]+"|"+v.zone])bad="zone double-booked on "+d+" "+fl[i];
      if(bad){ drop(k,bad); return; }                                                                         // dedupe zone collisions deterministically (sorted key order)
      for(let i=0;i<fl.length&&!bad;i++){ const max=fl[i]==="AM"?(st.amMax||99):(st.pmMax||99); if((cnt[d+"|"+fl[i]]||0)+1>max)bad="over maximum cover on "+d+" "+fl[i]; }
      if(bad){ drop(k,bad); return; }                                                                         // cap merged-in over-max bookings
      fl.forEach(f=>{ zoneSeen[d+"|"+f+"|"+v.zone]=1; cnt[d+"|"+f]=(cnt[d+"|"+f]||0)+1; }); } });
});
  (out.cycles||[]).forEach(cyc=>{ if(!cyc.oncall)return;   // a cycle can carry on-call before anyone has booked a shift, so this is its own pass
    const staff=Array.isArray(out.staff)?out.staff:[], who=sid=>(staff.find(p=>p.id===sid)||{}).name||sid;
    const ocDrop=(k,sid,why)=>{ delete cyc.oncall[k]; (out.audit=out.audit||[]).unshift({id:"ocfix-"+cyc.id+"-"+k.replace(/[^A-Za-z0-9]+/g,"-")+"-"+String(sid).replace(/[^A-Za-z0-9]+/g,"-"),ts:Date.now(),actor:"system",action:"merge.fix",detail:why+" — "+who(sid)+" ("+k+")"}); };   // the holder is in the id, so a second drop of the same slot is a line of its own
    Object.keys(cyc.oncall).sort().forEach(k=>{ const sid=cyc.oncall[k]; if(!sid)return;
      const d=k.slice(0,k.indexOf("|"));
      if(staff.length&&!staff.some(p=>p.id===sid)){ ocDrop(k,sid,"on-call removed — no longer in the group"); return; }   // a take that raced its holder's removal: nobody could see or clear it
      const a=(cyc.assign||{})[sid+"|"+d]; if(a&&a.kind==="leave"){ ocDrop(k,sid,"on-call removed — "+(a.code||"leave")+" on "+d); return; }   // leave typed into the roster, as well as approved leave
      const lv=(out.leave||[]).find(L=>L.staffId===sid&&L.status==="approved"&&L.from<=d&&L.to>=d);
      if(lv)ocDrop(k,sid,"on-call removed — approved "+lv.code+" leave on "+d); });   // leave wins, exactly as it does over a booking. An orphan key (a window or a person that went away) is left alone: it counts as nothing and comes back if they do.
  });
  // marketplace: a claim's truth is the (already race-hardened) assignment array — a "claimed" note whose shift didn't stick reverts to open, identically on every device
  (out.openShifts||[]).forEach(o=>{ if(o.status!=="claimed")return;
    const cyc=(out.cycles||[]).find(c=>c.id===o.cycleId); if(!cyc||!cyc.assign)return;
    const a=cyc.assign[o.by+"|"+o.iso];
    const holds=a&&a.kind==="clinical"&&a.period===o.period&&a.zone===o.zone&&(a.type||null)===(o.type||null);   // a full-shift offer that landed as a half shift did not hold
    const giverFreed=o.kind!=="giveaway"||!cyc.assign[o.from+"|"+o.iso];
    if(!holds||!giverFreed){ o.status="open"; o.by=null; o.at=null;
      (out.audit=out.audit||[]).unshift({id:"osfix-"+o.id,ts:Date.now(),actor:"system",action:"merge.fix",detail:"open shift reverted — claim didn't hold ("+o.iso+" "+o.period+")"}); }
  });
  }catch(e){ console.error("mergeInvariants",e); } return out; }
function mergeOnto(theirs){ _evBaseFlush(); let base={}; try{base=_remoteBase?JSON.parse(_remoteBase):{};}catch(e){} let out; try{out=JSON.parse(JSON.stringify(theirs||{}));}catch(e){out={};}
  const ID_ARRAYS={requests:null,messages:null,leave:null,notifications:null,audit:null,feedback:null,openShifts:null,openSwaps:null,swapOffers:null,pushSubs:null,reqComments:null,outbox:null,staff:_VOL_STAFF};
  const keys={}; Object.keys(S).forEach(k=>keys[k]=1); Object.keys(theirs||{}).forEach(k=>keys[k]=1);
  Object.keys(keys).forEach(k=>{ if(k in ID_ARRAYS||k==="cycles")return; if(JSON.stringify(S[k])!==JSON.stringify(base[k])) out[k]=S[k]; });   // scalar/simple keys: mine if I changed them, else theirs
  Object.keys(ID_ARRAYS).forEach(k=>{ out[k]=_mergeIdArray(S[k],(theirs||{})[k],base[k],ID_ARRAYS[k]); });
  _fixTokens(out.staff,(theirs||{}).staff,base.staff);
  // cycles: start from whichever side changed the array, then reconcile per-cycle per-field and per-assign-key
  out.cycles=JSON.parse(JSON.stringify(JSON.stringify(S.cycles)!==JSON.stringify(base.cycles)?(S.cycles||[]):(((theirs||{}).cycles)||[])));
  if(theirs&&theirs.cycles){
    out.cycles.forEach(oc=>{ const tc=theirs.cycles.find(c=>c.id===oc.id), bc=(base.cycles||[]).find(c=>c.id===oc.id); if(!tc)return;
      Object.keys(tc).forEach(f=>{ if(f==="assign"||f==="oncall"||f==="callins"||f==="clock"||f==="clockDec")return; const b=JSON.stringify(bc?bc[f]:undefined); if(JSON.stringify(oc[f])===b && JSON.stringify(tc[f])!==b) oc[f]=tc[f]; });   // field I didn't change but THEIRS did → theirs
      if(oc.settings&&tc.settings&&oc.settings!==tc.settings){ const bs=(bc&&bc.settings)||{}, sk={};
        [oc.settings,tc.settings,bs].forEach(o=>Object.keys(o).forEach(k=>{sk[k]=1;}));
        Object.keys(sk).forEach(k=>{ const b=JSON.stringify(bs[k]); if(JSON.stringify(oc.settings[k])===b&&JSON.stringify(tc.settings[k])!==b){ if(tc.settings[k]===undefined)delete oc.settings[k]; else oc.settings[k]=tc.settings[k]; } }); }   // settings are many cards: saving one never overwrites another card's newer change — the on-call windows people are taking included
      oc.assign=_mergeKeyMap(oc.assign,tc.assign,bc&&bc.assign);
      if(("oncall" in oc)||("oncall" in tc)||(bc&&("oncall" in bc))){   // on-call merges key by key like the shifts do — a whole-field rule would lose whichever device added second
        const _t=("oncall" in tc)?tc.oncall:(bc&&bc.oncall);            // a build with no on-call has no OPINION about it; it has not deleted everyone's
        const om=_mergeKeyMap(oc.oncall,_t,bc&&bc.oncall,true), _ob=(bc&&bc.oncall)||{};
        Object.keys(oc.oncall||{}).forEach(k=>{ const v=oc.oncall[k]; if(!(v&&v!==_ob[k]&&om[k]!==v))return; _ocLost.push({cyc:oc.id,k:k,sid:v,now:om[k]||null});   // a take of this device's that lost to one already in the cloud: it says so, here and in the log
          const nm=id=>((out.staff||[]).find(p=>p.id===id)||{}).name||id; (out.audit=out.audit||[]).unshift({id:"oclost-"+oc.id+"-"+k.replace(/[^A-Za-z0-9]+/g,"-")+"-"+String(v).replace(/[^A-Za-z0-9]+/g,"-"),ts:Date.now(),actor:"system",action:"merge.fix",detail:"on-call not taken — "+nm(om[k])+" had it first — "+nm(v)+" ("+k+")"}); });
        if(Object.keys(om).length)oc.oncall=om; else if("oncall" in oc)oc.oncall=om; }
      if(("callins" in oc)||("callins" in tc)||(bc&&("callins" in bc))){   // call-ins merge key by key like shifts: each key is one person's, so two phones logging at once both keep theirs
        const cm=_mergeKeyMap(oc.callins,("callins" in tc)?tc.callins:(bc&&bc.callins),bc&&bc.callins);   // a copy that has never heard of call-ins has no opinion about them
        if(Object.keys(cm).length)oc.callins=cm; else if("callins" in oc)oc.callins=cm; }
      ["clock","clockDec"].forEach(f=>{ if(!((f in oc)||(f in tc)||(bc&&(f in bc))))return;   // clock taps and decisions merge key by key like call-ins: a person's phone owns the taps, an admin's screen the decisions
        const m=_mergeKeyMap(oc[f],(f in tc)?tc[f]:(bc&&bc[f]),bc&&bc[f]); if(Object.keys(m).length)oc[f]=m; else if(f in oc)oc[f]=m; });
    });
    theirs.cycles.forEach(tc=>{ if(!out.cycles.find(c=>c.id===tc.id) && !(base.cycles||[]).find(c=>c.id===tc.id)) out.cycles.push(JSON.parse(JSON.stringify(tc))); });   // cycle THEIRS added concurrently (but not one I deliberately deleted)
  }
  _mergeInvariants(out);
  return out; }
// CAS-guarded save: writes only if the record hasn't changed since we synced; on conflict it merges our
// changes onto the latest remote and retries — so a plain save can never clobber someone else's concurrent work.
let _saveWait=4000;   // the pause after a lost swap: doubles each time to a minute, back to four seconds once a save lands (16 Oct 2026: a fixed 4–12 s pause from thirty phones was itself the storm)
function _devFree(o){ try{ const c=JSON.parse(JSON.stringify(o||{})); delete c.viewAs; delete c.tab; delete c.activeId; return JSON.stringify(c); }catch(e){ return ""; } }   // the document without this device's own navigation
async function cloudSave(){ if(!_sb)return; let didMerge=false; const tries=_evOk===true?1:5;   // with bookings going through the database, a lost swap means a crowd is booking: one try, then wait
  for(let i=0;i<tries;i++){
    const ts=nextTs();
    let r; try{ r=await _sb.from("org_state").update({data:S,updated:ts}).eq("org",_org).eq("updated",_orgUpdated).select("updated").maybeSingle(); }
    catch(e){ console.error("cloudSave",e); cloudErr(); return; }
    if(r&&r.data){ _orgUpdated=r.data.updated; _remoteBase=_snap(S); cloudOk(); _syncedOk(); if(didMerge)bgRender(); return; }
    const f=await _sb.from("org_state").select("data,updated").eq("org",_org).maybeSingle();
    if(!f||!f.data){ try{ const ins=await _sb.from("org_state").upsert({org:_org,data:S,updated:ts}).select("updated").maybeSingle(); _orgUpdated=(ins.data&&ins.data.updated)||ts; _remoteBase=_snap(S); cloudOk(); _syncedOk(); }catch(e){ console.error(e); cloudErr(); } return; }
    didMerge=true; const merged=mergeOnto(f.data.data);
    const _va=S.viewAs,_tab=S.tab,_aid=S.activeId; _applyingRemote=true; S=merged; if(_va!=null)S.viewAs=_va; if(_tab!=null)S.tab=_tab; if(_aid!=null&&S.cycles&&S.cycles.find(c=>c.id===_aid))S.activeId=_aid; try{normalize();}catch(e){} _applyingRemote=false;
    _orgUpdated=f.data.updated; _remoteBase=_snap(f.data.data); _keepBase(); ocLostToast();
    if(_devFree(S)===_devFree(f.data.data)){ cloudOk(); _syncedOk(); if(didMerge)bgRender(); return; }   // nothing of ours is missing from the cloud's copy: there is nothing to upload
  }
  console.warn("cloudSave: swap lost \u2014 trying again in "+Math.round(_saveWait/1000)+" s"); clearTimeout(_cloudTimer); _cloudTimer=setTimeout(cloudSave,_saveWait+Math.random()*_saveWait*0.5); _saveWait=Math.min(60000,_saveWait*2); }   // the edits stay pending (the pill says Saving\u2026) and go up once the crowd eases; never dropped
// Atomic compare-and-swap: applies `mutate` to the freshest state and writes only if the
// record hasn't changed since we loaded it. On conflict it pulls the latest and re-runs
// `mutate` (which re-validates capacity), so concurrent bookings merge instead of clobbering.
async function cloudCommit(mutate){
  for(let i=0;i<6;i++){
    _fatigueWarn=null; const pre=_snap(S);   // this device's own unsaved edits WITHOUT this attempt
    const res=mutate(); if(!res.ok)return res;
    const post=_snap(S);
    clearTimeout(_cloudTimer);
    const ts=nextTs();
    let r; try{ r=await _sb.from("org_state").update({data:S,updated:ts}).eq("org",_org).eq("updated",_orgUpdated).select("updated").maybeSingle(); }
    catch(e){ console.error("commit",e); cloudErr(); try{localStorage.setItem(orgKey(),JSON.stringify(S));localStorage.setItem(orgKey("_dirty"),"1");}catch(_){} _savePending=true; return {ok:true,pending:true}; }   // honest: booked on THIS device, not yet in the cloud
    if(r.error){ console.error(r.error); cloudErr(); try{localStorage.setItem(orgKey(),JSON.stringify(S));localStorage.setItem(orgKey("_dirty"),"1");}catch(_){} _savePending=true; return {ok:true,pending:true}; }
    if(r.data){ _orgUpdated=r.data.updated; _remoteBase=_snap(S); cloudOk(); _syncedOk(); try{localStorage.setItem(orgKey(),JSON.stringify(S));}catch(_){} return {ok:true}; }
    const f=await _sb.from("org_state").select("data,updated").eq("org",_org).maybeSingle();   // CAS conflict -> reload + retry
    if(f.data){ const _va=S.viewAs,_tab=S.tab,_aid=S.activeId; _applyingRemote=true;
      if(_savePending&&_snap(S)===post){ try{ S=JSON.parse(pre); }catch(e){} }   // fold in what was waiting, but not the attempt itself: merged in, a take that lost the race would be kept as if it were an edit, and a refused retry would still save it. If anything else changed while the write was out, all of it is kept
      const merged=_savePending?mergeOnto(f.data.data):f.data.data;   // don't drop edits still waiting in the save debounce — fold them onto the fresh remote
      S=merged; if(_va!=null)S.viewAs=_va; if(_tab!=null)S.tab=_tab; if(_aid!=null&&S.cycles&&S.cycles.find(c=>c.id===_aid))S.activeId=_aid; _orgUpdated=f.data.updated; _remoteBase=_snap(f.data.data); try{normalize();}catch(e){} _applyingRemote=false; _keepBase(); ocLostToast(); }
  }
  return {ok:false,reason:"Too many people booking at once — please try again."};
}
// Runs a validate+mutate atomically: synchronous in local mode, CAS-guarded in cloud mode.
function commitGuarded(mutate,busyKey){
  const _fw=()=>{ if(_fatigueWarn){ toast(_fatigueWarn,"warn"); _fatigueWarn=null; } };
  if(!cloudOn()){ _fatigueWarn=null; const res=mutate(); if(!res.ok){ _fatigueWarn=null; _osPushQueue=null; if(res.reason)toast(res.reason,"danger"); return false; } save(); render(); _fw(); _osFlushPush(); return true; }
  const p=cloudCommit(mutate); if(busyKey){ _inflight.add(busyKey); _selfChange=true; render(); }   // the mutation already ran: paint it, with the button that asked for it saving
  p.then(res=>{ if(busyKey)_inflight.delete(busyKey); _selfChange=true; if(!res.ok){ _fatigueWarn=null; if(_settled&&_settled.key===busyKey)_settled=null; _osPushQueue=null; if(res.reason)toast(res.reason,"danger"); } else if(res.pending){ _osPushQueue=null; toast("Saved on this device — it will sync to everyone when you're back online."); } else { _fw(); _osFlushPush(); } render(); });
  return true;
}
function _applyRemoteDoc(data,updated){   // a whole document from the cloud: the realtime row of the old way, or the refetch a ping asks for. This viewer's own navigation and unsaved edits survive it
    _orgUpdated=updated; const incoming=JSON.stringify(data); if(incoming===JSON.stringify(S))return;
    const _va=S.viewAs, _tab=S.tab, _aid=S.activeId;   // keep THIS viewer's own navigation — never let another user's save move their screen
    const dirty=_savePending||_cloudDirty; _applyingRemote=true;
    S=dirty?mergeOnto(data):data;   // if my own edits are still in the save debounce, fold the remote in — never wipe them
    _remoteBase=incoming;
    if(_va!=null)S.viewAs=_va; if(_tab!=null)S.tab=_tab; if(_aid!=null && S.cycles && S.cycles.find(c=>c.id===_aid))S.activeId=_aid;
    try{normalize();}catch(e){} if(!_realAdmin&&draftHidden(active())){ const l=staffLandingCycle(); if(l)S.activeId=l.id; }   // the admin took this cycle back to draft — move the viewer to one they may see
    _keepBase(); _applyingRemote=false; if(dirty)ocLostToast();
    if(dirty){ clearTimeout(_cloudTimer); _cloudTimer=setTimeout(cloudSave,600); }   // push the merged result so my edits reach everyone
    digestSchedule(); bgRender(); }
function cloudSubscribe(){ try{
    if(_evOk===null){ setTimeout(()=>{ _evProbe(true).then(()=>{ cloudSubscribe(); }); },_evProbeWait); _evProbeWait=Math.min(60000,_evProbeWait*2); return; }   // not probed yet (the first read failed, e.g. booted offline): try again after a growing pause, then listen the right way
    if(!_evOk){ _sb.channel("org-"+_org).on("postgres_changes",{event:"*",schema:"public",table:"org_state",filter:"org=eq."+_org},p=>{ if(p.new&&p.new.data)_applyRemoteDoc(p.new.data,p.new.updated); }).subscribe(); return; }   // the old way: the whole document, every save
    const spec=(table,event)=>{ const o={event:event,schema:"public",table:table}; if(!_rtNoFilter)o.filter="org=eq."+_org; return o; };   // the filter is a courtesy to the server: row-level security already keeps other groups' rows away, so a server that refuses it is listened to without it
    _rtChan=_sb.channel("org-"+_org+(_rtNoFilter?"-all":""))
      .on("postgres_changes",spec("roster_events","INSERT"),p=>{ if(p.new&&p.new.org===_org)_evApplyLive([p.new]); })   // a booking or a removal: 300 bytes, applied in place
      .on("postgres_changes",spec("org_events","*"),p=>{ if(!p.new||p.new.org===_org)_docRefetch(); })   // anything else changed the document: fetch it once, soon
      .subscribe(st=>{ _rtStatus=st; if(st==="SUBSCRIBED")_evCatchUp();   // (re)connected: whatever was missed while away
        else if((st==="CHANNEL_ERROR"||st==="TIMED_OUT")&&!_rtNoFilter){ _rtNoFilter=true; try{ _sb.removeChannel(_rtChan); }catch(e){} setTimeout(cloudSubscribe,1500); } });   // refused with the filter: once more without it
  }catch(e){ console.error("subscribe",e); } }
/* ----- bookings as events (14 Oct 2026) ----- */
function evApply(doc,ev){   // one event onto one copy of the document: the key set or cleared on its cycle, the audit row put first unless it is there already. True when something changed
  if(!doc||!ev||!ev.key)return false; const c=(doc.cycles||[]).find(x=>x.id===ev.cycle); if(!c)return false; if(!c.assign)c.assign={};
  let changed=false; const J=JSON.stringify, cur=c.assign[ev.key];
  if(ev.val==null){ if(cur!==undefined){ delete c.assign[ev.key]; changed=true; } }
  else if(J(cur)!==J(ev.val)){ c.assign[ev.key]=JSON.parse(J(ev.val)); changed=true; }
  if(ev.audit&&ev.audit.id){ if(!Array.isArray(doc.audit))doc.audit=[]; if(!doc.audit.some(a=>a&&a.id===ev.audit.id)){ doc.audit.unshift(JSON.parse(J(ev.audit))); changed=true; } }
  return changed; }
function _evApplyLive(evs){   // events reaching this device, in seq order: onto the live state now and, after a beat, onto the merge base. Returns how many were applied
  const marks=(evs||[]).filter(e=>e&&!e.key&&+e.seq>0).map(e=>+e.seq);   // a marker (no key) is the server saying "the document changed here": everything before it is history, and the document is fetched again
  if(marks.length){ const m=Math.max.apply(null,marks); if(m>_evDocSeq){ _evDocSeq=m; if(m>_evSeq)_evSeq=m; _docRefetch(); } }
  let changed=false, n=0; (evs||[]).slice().sort((a,b)=>(+a.seq||0)-(+b.seq||0)).forEach(ev=>{ if(!ev||!ev.key)return; const sq=+ev.seq||0;
    if(sq&&sq<=_evDocSeq)return;   // the document this device holds is newer than this event: a whole-document save since (a clear, an admin edit) is the truth, not the replay
    if(sq&&_evKeySeq[ev.key]&&_evKeySeq[ev.key]>=sq)return;   // an older event for this key arriving late changes nothing
    if(sq){ _evKeySeq[ev.key]=sq; if(sq>_evSeq)_evSeq=sq; }
    _evBase.push(ev); n++; if(evApply(S,ev))changed=true; });
  clearTimeout(_evBaseT); _evBaseT=setTimeout(_evBaseFlush,250);
  if(changed){ try{localStorage.setItem(orgKey(),JSON.stringify(S));}catch(e){} bgRender(); } return n; }
function _evBaseFlush(){ if(!_evBase.length)return; const q=_evBase; _evBase=[]; let b=null; try{ b=_remoteBase?JSON.parse(_remoteBase):null; }catch(e){ b=null; } if(!b)return; q.forEach(ev=>evApply(b,ev)); _remoteBase=_snap(b); _keepBase(); }
async function _evCatchUp(since){   // the events this device may have missed: fifty back from where it was but never below the watermark, re-applied (a no-op where they already landed) — on a refusal, a reconnect, a return to the screen, and every 45 s while it is open. Returns how many were applied
  if(_evOk!==true||!_sb||_evCatch)return 0; _evCatch=true; let n=0;
  try{ const from=Math.max(_evDocSeq,(since!=null?since:_evSeq)-50);
    const r=await _sb.from("roster_events").select("seq,cycle,key,val,audit").eq("org",_org).gt("seq",from).order("seq",{ascending:true}).limit(500);
    if(r&&r.data&&r.data.length)n=_evApplyLive(r.data); }
  catch(e){ console.warn("catch-up",e); } finally{ _evCatch=false; } return n; }
let _docLast=0;   // when this device last fetched the whole document on a ping
function _docRefetch(){ if(_docT)return;   // a ping says the document changed outside the booking call: one fetch, at most once a minute on any device and spread across the group (16 Oct 2026: thirty-six phones fetching 0.6 MB within two seconds of every save was a storm of its own), never while a tap is in flight
  const gap=Math.max(0,45000-(Date.now()-_docLast))+Math.random()*20000;
  _docT=setTimeout(async()=>{ _docT=null; if(_docBusy||_inflight.size){ _docAgain=true; if(_inflight.size)setTimeout(_docRefetch,3000); return; } _docBusy=true; _docLast=Date.now();
    try{ let wm=_evDocSeq; try{ const m=await _sb.from("roster_events").select("seq").eq("org",_org).order("seq",{ascending:false}).limit(1).maybeSingle(); if(m&&m.data&&+m.data.seq>wm)wm=+m.data.seq; }catch(e){}   // the watermark is read BEFORE the document, so everything at or below it is in what we are about to read
      const f=await _sb.from("org_state").select("data,updated").eq("org",_org).maybeSingle(); if(f&&f.data&&f.data.data){ _applyRemoteDoc(f.data.data,f.data.updated); if(wm>_evDocSeq)_evDocSeq=wm; if(wm>_evSeq)_evSeq=wm; await _evCatchUp(); } }   // events that landed while the document was in flight go back on top of it
    catch(e){ console.warn("refetch",e); } finally{ _docBusy=false; if(_docAgain){ _docAgain=false; _docRefetch(); } } },gap); }
async function cloudBook(cyc,sid,ops){   // the booking call: one round trip, judged on the server against the roster as it is at that instant (supabase/prod-booking-rpc.sql)
  try{ const r=await _sb.rpc("roster_commit",{p_org:_org,p_cycle:cyc,p_ops:ops});
    if(r&&r.error){ console.error("roster_commit",r.error); const m=String(r.error.message||"");
      return {ok:false,reason:_isMissingFn(r.error)?"Booking isn’t switched on for this group yet — ask your admin.":(/Not a member|cycle is gone|archived|No roster/.test(m)?m:BOOK_OFFLINE)}; }
    return (r&&r.data)||{ok:false,reason:BOOK_OFFLINE}; }
  catch(e){ console.error("roster_commit",e); return {ok:false,reason:BOOK_OFFLINE}; } }
function _bookSettle(cyc,sid,ops,res){   // the server's answer onto the picks already on the screen: an accepted pick is confirmed with the server's own event, a refused one comes off with its reason, and if the call never arrived they all come off
  const c=S.cycles.find(x=>x.id===cyc), a=c&&c.assign, fails=[]; let lost=false;
  const undo=o=>{ if(a&&a[o.akey]&&JSON.stringify(a[o.akey])===JSON.stringify(o.val))delete a[o.akey]; };   // only the pick this device put there a moment ago
  if(!res||res.ok!==true||!Array.isArray(res.results)){ ops.forEach(undo); return {res:{ok:false,reason:(res&&res.reason)||BOOK_OFFLINE},fails:[],lost:true}; }
  const evs=[]; ops.forEach((o,i)=>{ const r=res.results.find(x=>x&&+x.i===i)||null;
    if(r&&r.ok){ evs.push({seq:r.seq,cycle:cyc,key:r.key||o.akey,val:(r.val==null?null:r.val),audit:r.audit}); }
    else { undo(o); fails.push(o.label+" — "+((r&&r.reason)||"not saved")); lost=true; } });
  if(evs.length)_evApplyLive(evs);
  return {res:{ok:true},fails:fails,lost:lost}; }
