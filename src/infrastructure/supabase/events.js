"use strict";
// moved from js/sync.js lines 240-286 (Phase 1 split, no edits)
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
