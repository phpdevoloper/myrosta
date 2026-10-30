"use strict";
// moved from js/admin.js lines 1334-1396 (Phase 1 split, no edits)
/* ---------- the hospital's groups and the board rows: read once, cached on this device ---------- */
function groupsFetch(force){ if(!cloudOn()||!_sb||!_orgHospitalId||authState!=="in")return null; if(!force&&_hospGroups&&Date.now()-_hospGroupsAt<600000)return null;
  let p=null; try{ p=_sb.rpc("hospital_groups",{p_org:_org}); }catch(e){ return null; }
  return Promise.resolve(p).then(r=>{ if(r&&!r.error&&Array.isArray(r.data)){ _hospGroups=r.data.map(g=>({org:String(g.org),label:digestClean(g.label||g.org)})); _hospGroupsAt=Date.now(); bgRender(); } else if(r&&r.error){ console.warn("board",r.error.message||r.error); } }).catch(e=>{ console.warn("board",e); }); }
function hospGroups(){ return _hospGroups||[]; }
/* ---------- the demo sandbox's department: S.demoBoard (written by the seed) names a fictional hospital and its other groups; their digests are built here, at every load, for today's window. Local mode only: with the cloud on this is a no-op, so the real app never reads it. ---------- */
function demoDigest(g,todayISO){ const days={}, people=(Array.isArray(g.people)?g.people:[]).map(x=>digestClean(x)).filter(Boolean), n=people.length, slots=Array.isArray(g.slots)?g.slots:[];
  if(n){ const t0=parseISO(todayISO), e0=parseISO("2026-01-05");   // a fixed Monday as the epoch: the rotation depends on the date alone, so a day reads the same at every visit
    for(let k=-1;k<=14;k++){ const dt=addDays(t0,k), d=iso(dt), di=Math.round((dt-e0)/86400e3), dow=dt.getDay(), wk=(dow===0||dow===6), on=[], away=[], used={};
      slots.forEach((sl,si)=>{ if(sl.weekdays&&wk)return; for(let j=0;j<(+sl.n||0);j++){ const who=people[(di*3+si*5+j*7)%n]; if(used[who])continue; used[who]=1; on.push({n:who,r:digestClean(sl.r||""),p:sl.p==="PM"?"PM":(sl.p==="AM"?"AM":""),t:digestClean(sl.t||"")}); } });
      if(+g.awayEvery>0&&di%(+g.awayEvery)===0){ const cand=people.filter(x=>!used[x]); if(cand.length)away.push(cand[(di*11+3)%cand.length]); }   // someone not on that day is away
      const key=e=>(e.p||"")+"|"+(e.r||"")+"|"+(e.n||"")+"|"+(e.t||""); on.sort((x,y)=>key(x)<key(y)?-1:(key(x)>key(y)?1:0)); away.sort(); days[d]={on:on,away:away}; } }
  return {v:1,noun:digestClean(g.noun||""),days:days}; }
function demoOwnPick(c){ return !!c&&!c.archived; }   // the sandbox's own column: its one cycle is open for booking, which the real board would never publish, so the demo shows it anyway
function applyDemoBoard(){ _demoBoard=false; const b=(typeof S==="object"&&S)?S.demoBoard:null; if(cloudOn()||!b||typeof b!=="object"||!Array.isArray(b.groups)||!b.groups.length)return false;
  const today=iso(new Date()), now=Date.now(), own={org:_org,label:digestClean(b.ownLabel||(S.branding&&S.branding.name)||"This group")};
  _demoBoard=true; _orgHospitalId="demo"; _orgHospital=digestClean(b.hospital||"");
  _hospGroups=[own].concat(b.groups.map(g=>({org:String(g.org),label:digestClean(g.label||g.org)}))); _hospGroupsAt=now;
  _boardCache={rows:b.groups.map(g=>({org:String(g.org),label:digestClean(g.label||g.org),data:demoDigest(g,today),updated:new Date(now-((+g.ago||5)*60000)).toISOString()})),fetched:now}; return true; }
function siblingGroups(){ return hospGroups().filter(g=>g.org!==_org); }
function deptOn(){ return (cloudOn()||_demoBoard)&&!!_orgHospitalId&&hospGroups().length>=2; }   // the department view needs a second group; the sandbox brings its own
function boardFetch(force){ if(!cloudOn()||!_sb||!_orgHospitalId||authState!=="in"||_boardBusy)return null; if(!force&&_boardCache.fetched&&Date.now()-_boardCache.fetched<60000)return null; _boardBusy=true;
  let p=null; try{ p=_sb.rpc("board_for_org",{p_org:_org}); }catch(e){ _boardBusy=false; return null; }
  return Promise.resolve(p).then(r=>{ _boardBusy=false; if(r&&!r.error&&Array.isArray(r.data)){ _boardCache={rows:boardRowsFrom(r.data),fetched:Date.now()}; bgRender(); } else if(r&&r.error){ console.warn("board",r.error.message||r.error); } }).catch(e=>{ _boardBusy=false; console.warn("board",e); }); }
function boardRowsFrom(list){ return (list||[]).filter(x=>x&&x.org!==_org).map(x=>({org:String(x.org),label:digestClean(x.label||x.org),data:(x.data&&typeof x.data==="object")?x.data:null,updated:x.updated||null})); }   // our own column is always the live roster, never a cached copy
function setBoardShow(orgId,on){ if(!S.board)S.board={publish:false,show:[]}; const i=S.board.show.indexOf(orgId); if(on&&i<0)S.board.show.push(orgId); if(!on&&i>=0)S.board.show.splice(i,1);
  logAudit("settings.board","booking sheet "+(on?"shows ":"hides ")+orgId,"admin"); save(); if(on)boardFetch(true); toastSaved("group"); render(); }
function deptCardHTML(){ if(!(cloudOn()||_demoBoard)||!_orgHospitalId)return ""; const b=S.board||{publish:false,show:[]}, sibs=siblingGroups(), where=escapeHTML(_orgHospital||"this hospital");
  return `<div class="sub" style="margin-top:10px"><b>Department board</b></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" id="boardPublish" ${b.publish?"checked":""}> Publish to the department board <span class="muted small">\u2014 shares names, slots and times with the other groups at ${where}. Never contacts, pay or leave reasons.</span></label>
    ${sibs.length?`<div class="muted small" style="margin-top:4px">Show on the booking sheet and the Day board:</div><div style="display:flex;flex-wrap:wrap">${sibs.map(g=>`<label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" class="boardShow" data-org="${escapeHTML(g.org)}" ${b.show.indexOf(g.org)>=0?"checked":""}> ${escapeHTML(g.label)}</label>`).join("")}</div>`:`<div class="muted small" style="margin-top:4px">No other staff group at ${where} yet.</div>`}`; }
/* ---------- Who's on: the Day board across every group in the hospital, a column per group from the digests ---------- */
function scopeSegHTML(){ if(!deptOn())return ""; return `<div class="seg" role="group" aria-label="Which roster"><button class="${dailyScope==="dept"?"":"on"}" data-dscope="group">This group</button><button class="${dailyScope==="dept"?"on":""}" data-dscope="dept">Whole department</button></div>`; }
function deptDates(){ const t=parseISO(iso(new Date())); return {min:iso(addDays(t,-1)),max:iso(addDays(t,14))}; }   // the board is a day sheet: yesterday to a fortnight ahead
function agoText(ts){ const m=Math.max(0,Math.round((Date.now()-ts)/60000)); return m<1?"just now":(m<60?(m+" min ago"):(Math.round(m/60)+" h ago")); }
function onNowAt(t,nowMin){ const m=/^(\d\d):(\d\d)\D+(\d\d):(\d\d)$/.exec(String(t||"")); if(!m)return false; const st=+m[1]*60+ +m[2]; let en=+m[3]*60+ +m[4]; if(en<=st)en+=1440; return nowMin>=st&&nowMin<en; }
function countLine(n,noun){ const r=noun||""; if(!r)return n+(n===1?" person":" people"); return n+" "+(n===1?r:(/s$/.test(r)?r:r+"s")); }
function deptColumns(d,today){ const cache={}; _boardCache.rows.forEach(r=>{ cache[r.org]=r; });   // one column per registry group: ours live, the others from the cache, a missing one says so
  return hospGroups().map(g=>{ if(g.org===_org)return {org:g.org,label:g.label,data:buildDigestAll(S,today,_demoBoard?demoOwnPick:undefined),updated:null,own:true};
    const r=cache[g.org]; return {org:g.org,label:g.label,data:r?r.data:null,updated:r?r.updated:null,own:false}; }); }
function deptColHTML(c,d,today,nowMin){
  const day=(c.data&&c.data.days&&c.data.days[d])||null, on=(day&&Array.isArray(day.on))?day.on:[], away=(day&&Array.isArray(day.away))?day.away:[];
  const when=c.own?"This group, live":(!c.data?"Not published yet":(c.updated?("Updated "+agoText(Date.parse(c.updated))):"Published"));
  const now=e=>d===today&&onNowAt(e.t,nowMin), noun=digestClean((c.data&&c.data.noun)||""), line=countLine(on.length,noun)+((d===today&&on.length)?(" \u00b7 "+on.filter(now).length+" on now"):"");
  const sec=(p,label,cls)=>{ const es=on.filter(e=>(e.p||"")===p); if(!es.length)return "";
    return `<h3 style="margin:10px 0 4px;font-size:var(--fs-md)">${escapeHTML(label)}</h3>`+es.map(e=>`<div class="listrow${now(e)?" onnow":""}"><span class="tag lg ${cls}" style="min-width:62px;text-align:center">${escapeHTML(e.r||(e.ci?"Called in":"On call"))}</span><span class="grow">${escapeHTML(e.n||"")}</span><span class="muted small">${escapeHTML(e.t||"")}</span></div>`).join(""); };
  const body=!c.data?`<div class="muted small">${escapeHTML(c.label)} haven't published to the board.</div>`
    :((on.length?(sec("AM","AM","am")+sec("","On call and call-ins","oc")+sec("PM","PM","pm")):`<div class="muted small">Nobody rostered.</div>`)
      +(away.length?`<h3 style="margin:10px 0 4px;font-size:var(--fs-md)">Away</h3><div>${away.map(n=>`<span class="tag lg leave" style="margin:2px 4px 2px 0;display:inline-block">${escapeHTML(String(n))}</span>`).join("")}</div>`:""));
  const head=`<b>${escapeHTML(c.label)}</b><span class="rowsub">${escapeHTML(line)} \u00b7 ${escapeHTML(when)}</span>`;
  return isMobile()?`<details class="deptcol"><summary>${head}</summary>${body}</details>`:`<div class="deptcol"><div class="depthead">${head}</div>${body}</div>`; }
function deptBoardHTML(){ const today=iso(new Date()), lim=deptDates(); if(!_deptDate||_deptDate<lim.min||_deptDate>lim.max)_deptDate=today; const d=_deptDate, dt=new Date(), nowMin=dt.getHours()*60+dt.getMinutes();
  const nav=`<div class="row" style="align-items:center;margin-top:4px"><button class="btn sm" id="bPrev" aria-label="Previous day">${ic("chevL")}</button><input type="date" id="bDate" value="${d}" min="${lim.min}" max="${lim.max}" aria-label="Day"><button class="btn sm" id="bNext" aria-label="Next day">${ic("chevR")}</button>${phBadge(d)}<span class="grow"></span>${scopeSegHTML()}<button class="btn sm" id="bRefresh">Refresh</button><button class="btn sm" id="bPrint">${ic("print")} Print</button></div>`;
  const cols=deptColumns(d,today).map(c=>deptColHTML(c,d,today,nowMin)).join("");
  return `<div class="card" id="deptCard">${printHeadHTML("Who's on \u00b7 "+fmtISO(d))}<h2>Who's on today</h2>
    <div class="sub">${escapeHTML(_orgHospital||"The department")} \u00b7 ${escapeHTML(parseISO(d).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}))}${_boardCache.fetched?` \u00b7 <span class="scronly">board read ${escapeHTML(agoText(_boardCache.fetched))}</span>`:""}</div>${nav}
    <div class="deptgrid">${cols}</div>${printFootHTML("Names, slots and times as each group published them. Contacts, pay and leave reasons never leave a group.")}</div>`; }
function sibLinesHTML(isoD,p){   // the other groups a sheet shows: who holds that half, read-only, from the board; nothing to book, nothing to wire
  const shows=(S.board&&S.board.show)||[]; if(!shows.length||!deptOn())return "";
  return shows.map(orgId=>{ const g=hospGroups().find(x=>x.org===orgId); if(!g)return ""; const row=_boardCache.rows.find(x=>x.org===orgId), label=escapeHTML(g.label);
    if(!row||!row.data)return `<div class="muted small">${label} haven't published to the board.</div>`;
    const day=row.data.days&&row.data.days[isoD], es=((day&&day.on)||[]).filter(e=>(e.p||"")===p);
    return `<div class="muted small">${label} on: ${es.length?es.map(e=>escapeHTML(e.n||"")+(e.r?" \u00b7 "+escapeHTML(e.r):"")).join(", "):"nobody yet"}</div>`; }).join(""); }
