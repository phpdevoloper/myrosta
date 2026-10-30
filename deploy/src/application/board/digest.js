"use strict";
// moved from js/admin.js lines 1293-1333 (Phase 1 split, no edits)
/* ---------- the department digest: a small, safe extract of a published roster that the hospital's other groups may read ----------
   Built from the cycle passed in, never from what is on screen, so every device of the group makes the same bytes; entries are sorted and
   the JSON is written with sorted keys for the same reason. Names, slots, periods and times only: never contacts, pay, requests or reasons. */
let _digestHash="", _digestTimer=null, _digestPendingOff=false, _hospGroups=null, _hospGroupsAt=0, _boardCache={rows:[],fetched:0}, _boardBusy=false, _boardTick=null, _demoBoard=false;   // _demoBoard: the sandbox's fictional hospital is in play (local mode only)
function digestClean(s){ return String(s==null?"":s).replace(/[<>\u0000-\u001f\u007f]/g,"").trim().slice(0,80); }   // a name can never carry markup into another group's screen
function stableJSON(o){ if(o===null||typeof o!=="object")return JSON.stringify(o); if(Array.isArray(o))return "["+o.map(stableJSON).join(",")+"]"; return "{"+Object.keys(o).sort().map(k=>JSON.stringify(k)+":"+stableJSON(o[k])).join(",")+"}"; }
function digestHash(s){ let h=5381; for(let i=0;i<s.length;i++)h=(((h*33)>>>0)^s.charCodeAt(i))>>>0; return h.toString(16)+":"+s.length; }
function digestLive(cyc){ return !!cyc&&!cyc.archived&&cyc.status==="published"; }   // published rounds, or a rolling roster that is live; never a draft or a round still booking
function digestDays(cyc,todayISO){ const from=iso(addDays(parseISO(todayISO),-1)); return datesOf(cyc.cycle).map(iso).filter(d=>d>=from); }   // yesterday to the end of the cycle
function digestNoun(st){ return digestClean((st.branding&&st.branding.roleNoun)||""); }
function buildDigest(st,cyc,todayISO){
  const zones=(cyc.settings&&cyc.settings.zones)||st.zones||[], zl=(zid,p)=>{ const z=zones.find(x=>x.id===zid); return z?digestClean(zoneLabel(z,p)):""; };
  const names={}; (st.staff||[]).forEach(s=>{ names[s.id]=digestClean(s.name); }); const lv=st.leave||[], days={};
  const ids=Object.keys(names).filter(sid=>{ const r=cyc.roles&&cyc.roles[sid]; return !!r&&r.in!==false; }).sort();   // only people on this cycle's roster: someone not in the cycle is neither on nor away, whatever leave they hold
  digestDays(cyc,todayISO).forEach(d=>{ const on=[], away=[];
    ids.forEach(sid=>{ const a=(cyc.assign||{})[sid+"|"+d], carries=ocWindows(cyc).filter(w=>ocHolder(cyc,d,w.id)===sid);   // two on-call windows both held today: the rider (oc:true) lands on whichever holder comes first in staff order — a known, harmless flip-flop
      if(a&&a.kind==="clinical"){ const f=fillsOf(cyc,a); f.forEach((p,i)=>{ const e={n:names[sid],r:zl(a.zone,p),p:p,t:windowStr(shiftWindow(cyc,a))}; if(carries.length&&i===f.length-1)e.oc=true; on.push(e); }); }
      else { if((a&&a.kind==="leave")||lv.some(L=>L.staffId===sid&&L.status==="approved"&&L.from<=d&&L.to>=d))away.push(names[sid]);
        carries.forEach(w=>{ on.push({n:names[sid],r:"",p:"",t:ocTime(w),oc:true}); }); } });   // a CST day is neither on nor away
    ciOnDay(cyc,d).forEach(x=>{ if(names[x.sid]!=null)on.push({n:names[x.sid],r:"",p:"",t:ocTime(x.w),ci:true}); });
    const key=e=>(e.p||"")+"|"+(e.r||"")+"|"+(e.n||"")+"|"+(e.t||""); on.sort((x,y)=>key(x)<key(y)?-1:(key(x)>key(y)?1:0)); away.sort();
    if(on.length||away.length)days[d]={on:on,away:away}; });
  return {v:1,noun:digestNoun(st),days:days}; }
function buildDigestAll(st,todayISO,pick){ const days={};   // every published cycle, earliest first; a day appears once (the sandbox passes its own pick: its only cycle is still booking)
  (st.cycles||[]).filter(pick||digestLive).sort((a,b)=>a.cycle.start<b.cycle.start?-1:(a.cycle.start>b.cycle.start?1:0)).forEach(c=>{ const d=buildDigest(st,c,todayISO).days; Object.keys(d).forEach(k=>{ if(!(k in days))days[k]=d[k]; }); });
  return digestTrim({v:1,noun:digestNoun(st),days:days}); }
function utf8Len(s){ let n=0; for(let i=0;i<s.length;i++){ const c=s.charCodeAt(i); n+=c<0x80?1:(c<0x800?2:((c&0xF800)===0xD800?2:3)); } return n; }
function digestTrim(out){ const cap=120*1024, keys=Object.keys(out.days).sort();   // too big for the board: drop days from the far end, and say so
  while(keys.length&&utf8Len(stableJSON(out))>cap){ delete out.days[keys.pop()]; out.truncated=true; } return out; }
/* ---------- publishing: after a cloud write lands, or a remote change arrives, the digest is rebuilt on its own timer and written only when its bytes changed ---------- */
function digestOn(){ return cloudOn()&&authState==="in"&&!!_orgHospitalId&&!!(S.board&&S.board.publish); }
function digestSchedule(){ clearTimeout(_digestTimer); _digestTimer=null; if(!digestOn()&&!_digestPendingOff)return false; _digestTimer=setTimeout(digestPublish,30000); return true; }   // its own timer: never _cloudTimer, never _savePending; armed on a pending switch-OFF retry too
function digestPublish(force){   // everything a stub can observe happens before the first await
  if(!cloudOn()||!_sb||!_orgHospitalId||authState!=="in")return null;
  const on=!!(S.board&&S.board.publish), force2=force||(!on&&_digestPendingOff); if(!on&&!force2)return null;
  const data=on?buildDigestAll(S,iso(new Date())):{v:1,noun:digestNoun(S),days:{}};   // switched off: an empty digest is how a group leaves the board, since delete is revoked
  const h=digestHash(stableJSON(data)); if(h===_digestHash&&!force2)return null; _digestHash=h;
  let p=null; try{ p=_sb.from("board_slice").upsert({hospital_id:_orgHospitalId,org:_org,data:data},{onConflict:"hospital_id,org"}); }catch(e){ _digestHash=""; return null; }   // updated is stamped by the server
  return Promise.resolve(p).then(r=>{ if(r&&r.error){ _digestHash=""; console.warn("board",r.error.message||r.error); } else digestLanded(on); return r; }).catch(e=>{ _digestHash=""; console.warn("board",e); }); }
function digestLanded(on){ if(!on)_digestPendingOff=false; }   // the off-write landed cleanly: stop the pending-off retry until the switch goes off again
function setBoardPublish(on){ if(!S.board)S.board={publish:false,show:[]}; S.board.publish=!!on; if(!on)_digestPendingOff=true; logAudit("settings.board",(on?"publishing to":"left")+" the department board","admin"); save(); digestPublish(true); toastSaved("group"); render(); }
