"use strict";
// moved from js/sync.js lines 41-239 (Phase 1 split, no edits)
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
