"use strict";
// moved from js/roster.js lines 1353-1474 (Phase 1 split, no edits)
/* ---------- the Fixed cover view (10 Oct 2026): what the patterns alone would place in the active cycle, the weekday summary, the drift ---------- */
function fixedProjection(cyc,soft){ const out={}, ds=cycleDates();   // locked fixed patterns; with soft, drafts and preference patterns too
  S.staff.filter(s=>inCycle(s)&&s.fixedPattern&&(s.mode==="fixed"||(soft&&s.mode==="preference"))&&(s.fixedPattern.committed||soft)).forEach(s=>{ const hard=s.mode==="fixed"&&!!s.fixedPattern.committed;
    ds.forEach(d=>{ const isoD=iso(d), slot=fixedSlotFor(s,isoD); if(slot)out[s.id+"|"+isoD]=Object.assign({sid:s.id,iso:isoD,period:slot.period,zone:slot.zone||"",soft:!hard},slot.type?{type:slot.type}:{}); }); });
  return out; }
function fixedCoverStats(cyc,proj){ const ds=cycleDates(), st=effStaffing(), per={}; ds.forEach(d=>{ per[iso(d)]={AM:0,PM:0,zAM:new Set(),zPM:new Set()}; });
  Object.values(proj).forEach(e=>{ const p=per[e.iso]; if(!p||e.period==="CST")return; fillsOf(cyc,Object.assign({kind:"clinical",period:e.period},e.type?{type:e.type}:{})).forEach(f=>{ p[f]=(p[f]||0)+1; (f==="AM"?p.zAM:p.zPM).add(e.zone?zoneName(e.zone):"any"); }); });   // a full shift counts in both halves; a non-clinical block in neither
  const rows=[]; WD_ORDER.forEach(wd=>["AM","PM"].forEach(half=>{ const min=half==="AM"?st.amMin:st.pmMin, dates=ds.filter(d=>d.getDay()===wd), zones=new Set(); let covered=0, short=0;
    dates.forEach(d=>{ const p=per[iso(d)], n=p[half]; if(n>=min)covered++; short+=Math.max(0,min-n); (half==="AM"?p.zAM:p.zPM).forEach(z=>zones.add(z)); });
    rows.push({wd,half,dates:dates.length,covered,short,min,zones:[...zones].sort()}); }));
  return {per,rows,amMin:st.amMin,pmMin:st.pmMin,totalShort:rows.reduce((a,r)=>a+r.short,0)}; }
function fixedDrift(cyc,proj){ const a=cyc.assign||{}, items=[]; let total=0;   // the locked fixed shifts the patterns place, against the roster now
  Object.values(proj).forEach(e=>{ if(e.soft)return; total++; const sh=a[e.sid+"|"+e.iso]; let what=null;
    if(e.period==="CST"){ if(!sh||sh.kind!=="cst")what=(sh&&sh.kind==="clinical")?"moved":((sh&&sh.kind==="leave")||leaveOn(e.sid,e.iso)?"leave":"removed"); }
    else if(!sh||sh.kind!=="clinical")what=(sh&&sh.kind==="leave")||leaveOn(e.sid,e.iso)?"leave":(sh&&sh.kind==="cst")?"CST":"removed";
    else if(sh.period!==e.period||(e.zone&&sh.zone!==e.zone)||(e.type||"")!==(sh.type||""))what="moved";
    if(what)items.push({sid:e.sid,iso:e.iso,what,was:fpSlotLabel(e,cyc)+(e.period==="CST"?"":" "+(e.zone?zoneName(e.zone):"any")),now:(sh&&sh.kind==="clinical")?sh.period+" "+zoneName(sh.zone):(sh?sh.kind+(sh.code?" "+sh.code:""):(what==="leave"?"leave":"off"))}); });
  const byWd={}; items.forEach(i=>{ const k=DOW[parseISO(i.iso).getDay()]; byWd[k]=(byWd[k]||0)+1; });
  return {total,changed:items.length,items:items.sort((x,y)=>x.iso<y.iso?-1:x.iso>y.iso?1:0),byWd}; }
function exportFixedCoverXLSX(){ if(typeof XLSX==="undefined"){toast("Spreadsheet library not loaded — check your internet connection, then retry.");return;}
  const c=active(), ds=cycleDates(), proj=fixedProjection(c,fixedSoft), stats=fixedCoverStats(c,proj), drift=fixedDrift(c,proj);
  const hdr=["Name"].concat(ds.map(d=>DOW[d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1)));
  const people=[...new Set(Object.values(proj).map(e=>e.sid))].map(id=>S.staff.find(x=>x.id===id)).filter(Boolean).sort((x,y)=>x.name.localeCompare(y.name));
  const grid=[hdr].concat(people.map(s=>[s.name].concat(ds.map(d=>{ const e=proj[s.id+"|"+iso(d)]; return e?(fpSlotLabel(e,c)+(e.period==="CST"?"":" "+(e.zone?zoneName(e.zone):"any"))+(e.soft?" (soft)":"")):""; }))));
  grid.push(["Fixed cover AM"].concat(ds.map(d=>stats.per[iso(d)].AM)),["Fixed cover PM"].concat(ds.map(d=>stats.per[iso(d)].PM)),["Minimum AM / PM"].concat(ds.map(()=>stats.amMin+" / "+stats.pmMin)));
  const summ=[["Day","Half","Dates","Covered to minimum","Shortfall (shifts)","Zones held"]].concat(stats.rows.map(r=>[DOW[r.wd],r.half,r.dates,r.covered,r.short,r.zones.join(", ")]));
  const dr=[["Who","Date","Pattern","Roster now","Change"]].concat(drift.items.map(i=>[nameOf(i.sid),i.iso,i.was,i.now,i.what]));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(grid),"Fixed cover"); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summ),"Weekday summary"); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dr),"Drift");
  XLSX.writeFile(wb,"fixed-cover-"+c.cycle.start+".xlsx"); logAudit("export.fixedcover",cyLabel(c),"admin"); }
function applyFixedPatterns(){ // seed fixed (locked) + preference (soft) shifts where the day is free
  let placed=0; const a=active().assign, conflicts=[], gaps=[], pending=[];
  const staff=S.staff.filter(s=>(s.mode==="fixed"||s.mode==="preference")&&inCycle(s));
  const dlabel=isoD=>{const dt=parseISO(isoD);return DOW[dt.getDay()]+" "+dt.getDate()+"/"+(dt.getMonth()+1);};
  // Pass 1 — place every explicit pin (period + zone); defer period-only slots to pass 2
  const _cy=active(), _fills=slot=>fillsOf(_cy,Object.assign({kind:"clinical",period:slot.period},slot.type?{type:slot.type}:{}));   // a full shift fills both halves: both must be free
  staff.forEach(s=>{ cycleDates().forEach(d=>{ const isoD=iso(d), slot=fixedSlotFor(s,isoD); if(!slot)return;
      if(getShift(s.id,isoD).kind!=="off")return;                                  // leave / existing shift wins
      if(slot.period==="CST"){ a[s.id+"|"+isoD]={kind:"cst",fixed:(s.mode==="fixed")}; placed++; return; }   // the non-clinical block: no zone, no cover
      if(slot.zone){ const _tk=_fills(slot).find(f=>zoneTaken(isoD,f,slot.zone,s.id)); if(_tk){ conflicts.push(nameOf(s.id)+" "+dlabel(isoD)+" "+fpSlotLabel(slot,_cy)+" · "+(zoneById(slot.zone)?zoneById(slot.zone).name:"?")+" (zone taken)"); return; }
          a[s.id+"|"+isoD]=Object.assign({kind:"clinical",period:slot.period,zone:slot.zone,fixed:(s.mode==="fixed")},slot.type?{type:slot.type}:{}); placed++; }
      else pending.push({s:s,isoD:isoD,period:slot.period,type:slot.type,fills:_fills(slot)}); }); });
  // Pass 2 — fill period-only slots into a balanced free zone (after pins are locked)
  pending.forEach(p=>{ if(getShift(p.s.id,p.isoD).kind!=="off")return;
    const free=zonesFor(p.period).filter(z=>!(p.fills||[p.period]).some(f=>zoneTaken(p.isoD,f,z.id,p.s.id)));
    if(!free.length){ gaps.push(nameOf(p.s.id)+" "+dlabel(p.isoD)+" "+p.period+" (no free zone)"); return; }
    const _ok=free.filter(z=>(rulesOf(active()).needs[z.id]||[]).filter(t=>tagById(S,t)).every(t=>hasTag(S,p.s,t)));   // a zone the engine chooses is one the person holds the tags for; only when none is left does the pattern land in a barred one, flagged
    const z=balancedZoneFor(p.s.id,p.period,_ok.length?_ok:free);
    a[p.s.id+"|"+p.isoD]=Object.assign({kind:"clinical",period:p.period,zone:z.id,fixed:(p.s.mode==="fixed")},p.type?{type:p.type}:{}); placed++; });
  _fpReport={placed:placed,conflicts:conflicts,gaps:gaps};
  return placed; }
function fixedPatternSummary(fp){ if(!fp)return "—"; const out=[], zn=z=>z?(zoneById(z)?zoneById(z).name:"?"):"any";
  const lab=sl=>fpSlotLabel(sl)+(sl.period==="CST"?"":"·"+zn(sl.zone));
  if(fp.recurrence==="monthly"){ (fp.M||[]).filter(r=>r.period).forEach(r=>out.push((FP_NTH[r.nth]||r.nth)+" "+DOW[+r.wd]+" "+lab(r))); return out.length?out.join(", "):"no shifts set"; }
  const wks=fpWeeksOf(fp); wks.forEach(wk=>{ const o=fp[wk]||{};
    const days=WD_ORDER.filter(wd=>o[String(wd)]&&o[String(wd)].period).map(wd=>DOW[wd]+" "+lab(o[String(wd)]));
    if(days.length)out.push((wks.length>1?("Wk "+wk+": "):"")+days.join(", ")); });
  return out.length?out.join(" · "):"no shifts set"; }
function fpDraft(s){ if(!_fpDraft[s.id]){ const src=s.fixedPattern||emptyPattern(); _fpDraft[s.id]=JSON.parse(JSON.stringify(src));
  const d=_fpDraft[s.id]; ["A","B","C","D"].forEach(k=>{ if(!d[k])d[k]={}; }); if(!Array.isArray(d.M))d.M=[]; if(!d.recurrence)d.recurrence="weekly"; } return _fpDraft[s.id]; }
function setFpRule(sid,i,key,val){ const d=fpDraft(S.staff.find(x=>x.id===sid)); const r=d.M[i]; if(!r)return; if(key==="type"){ const sl=fpSlotFrom(val)||{period:"AM"}; r.period=sl.period; if(sl.type)r.type=sl.type; else delete r.type; if(sl.period==="CST")r.zone=""; return; } r[key]=(key==="wd")?+val:val; }
function fpTypeOptions(sel,cyc){ return `<option value="">Off</option>`+fpTypes(cyc).map(t=>`<option value="${escapeHTML(t.id)}" ${sel===t.id?"selected":""}>${escapeHTML(t.label)}</option>`).join(""); }
function fpMonthTable(s,canEdit){ const d=fpDraft(s), dis=canEdit?"":"disabled";
  const rows=d.M.map((r,i)=>`<tr><td><select class="fp-mw" data-sid="${s.id}" data-i="${i}" aria-label="Rule ${i+1} — which" ${dis}>${["1","2","3","4","last"].map(k=>`<option value="${k}" ${String(r.nth)===k?"selected":""}>${FP_NTH[k]}</option>`).join("")}</select></td>
      <td><select class="fp-md" data-sid="${s.id}" data-i="${i}" aria-label="Rule ${i+1} — day" ${dis}>${WD_ORDER.map(wd=>`<option value="${wd}" ${+r.wd===wd?"selected":""}>${DOW[wd]}</option>`).join("")}</select></td>
      <td><select class="fp-mp" data-sid="${s.id}" data-i="${i}" aria-label="Rule ${i+1} — shift type" ${dis}>${fpTypeOptions(fpSlotKey(r)).replace('<option value="">Off</option>',"")}</select></td>
      <td><select class="fp-mz" data-sid="${s.id}" data-i="${i}" aria-label="Rule ${i+1} — zone" ${(canEdit&&r.period!=="CST")?"":"disabled"}><option value="">${r.period==="CST"?"no zone":"Any (auto)"}</option>${S.zones.map(z=>`<option value="${z.id}" ${r.zone===z.id?"selected":""}>${escapeHTML(z.name)}</option>`).join("")}</select></td>
      <td>${canEdit?`<button class="btn sm fp-mdel" data-sid="${s.id}" data-i="${i}" aria-label="Remove rule ${i+1}">Remove</button>`:""}</td></tr>`).join("");
  return `<div class="sub" style="margin-top:8px">Each rule is one shift a month: which ${escapeHTML("weekday")} of the calendar month, the half, the zone.</div><table class="maptbl"><tr><th>Which</th><th>Day</th><th>Shift</th><th>Zone</th><th></th></tr>${rows||`<tr><td colspan="5" class="muted small">No rules yet.</td></tr>`}</table>${canEdit?`<button class="btn sm fp-madd" data-sid="${s.id}" style="margin-top:6px">+ Add a shift</button>`:""}`; }
function setFpSlot(sid,wk,wd,key,val){ const s=S.staff.find(x=>x.id===sid); const d=fpDraft(s); d[wk]=d[wk]||{}; const k=String(wd);
  d[wk][k]=d[wk][k]||{}; if(key==="type"){ const sl=fpSlotFrom(val); if(!sl){ delete d[wk][k]; return; } d[wk][k].period=sl.period; if(sl.type)d[wk][k].type=sl.type; else delete d[wk][k].type; if(sl.period==="CST")d[wk][k].zone=""; return; }
  d[wk][k][key]=val; if(key==="period"&&!val)delete d[wk][k]; }
function fpWeekTable(s,wk,canEdit){ const o=fpDraft(s)[wk]||{};
  return `<table class="maptbl"><tr><th>Day</th><th>Shift</th><th>Zone</th></tr>`+WD_ORDER.map(wd=>{ const slot=o[String(wd)]||{};
    return `<tr><td>${DOW[wd]}</td>
      <td><select class="fp-p" data-sid="${s.id}" data-wk="${wk}" data-wd="${wd}" aria-label="Week ${wk} ${escapeHTML(String(DOW[wd]||wd))} — shift type" ${canEdit?"":"disabled"}>${fpTypeOptions(fpSlotKey(slot))}</select></td>
      <td><select class="fp-z" data-sid="${s.id}" data-wk="${wk}" data-wd="${wd}" aria-label="Week ${wk} ${escapeHTML(String(DOW[wd]||wd))} — zone" ${(canEdit&&slot.period!=="CST")?"":"disabled"}><option value="">${slot.period==="CST"?"no zone":slot.period?"Any (auto)":"—"}</option>${S.zones.map(z=>`<option value="${z.id}" ${slot.zone===z.id?"selected":""}>${escapeHTML(z.name)}</option>`).join("")}</select></td></tr>`;
  }).join("")+`</table>`; }
function fixedPatternEditorHTML(s,canEdit,asStaff){ const d=fpDraft(s); const committed=!!(s.fixedPattern&&s.fixedPattern.committed);
  const pending=S.requests.find(r=>r.type==="fixed"&&r.from===s.id&&r.status==="pending");
  if(s.mode==="self") return `<div class="card" style="margin-top:8px;background:var(--hover)"><b>Fixed pattern — ${escapeHTML(s.name)}</b> <span class="tag brand">self</span><div class="muted small" style="margin-top:6px">On <b>Self-roster</b> — no fixed pattern. Switch mode to “Fixed pattern” or “Pref + auto-draft” to set one.</div></div>`;
  return `<div class="card" style="margin-top:8px;background:var(--hover)">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <b>Fixed pattern — ${escapeHTML(s.name)}</b> <span class="tag ${s.mode==="fixed"?"mode-fixed":"mode-preference"}">${s.mode==="fixed"?"fixed":"preference"}</span>
      ${committed?'<span class="tag ok">'+ic("lock")+' committed</span>':'<span class="tag muted">draft</span>'}
      ${pending?'<span class="tag warn">'+ic("flag")+' change pending</span>':""}</div>
    <div class="seg" style="margin-top:8px">${[["weekly","Weekly"],["fortnightly","Fortnightly A/B"],["fourweekly","Every 4 weeks A\u2013D"],["monthly","Calendar month"]].map(([k,l])=>`<button class="fp-rec ${d.recurrence===k?"on":""}" data-sid="${s.id}" data-rec="${k}" ${canEdit?"":"disabled"}>${l}</button>`).join("")}</div>
    ${d.recurrence==="monthly"?fpMonthTable(s,canEdit):(FP_N[d.recurrence]||1)>1?fpWeeksOf(d).map(wk=>`<div class="sub" style="margin-top:8px">${escapeHTML(fpWeekHeading(wk,FP_N[d.recurrence]))}</div>${fpWeekTable(s,wk,canEdit)}`).join(""):fpWeekTable(s,"A",canEdit)}
    ${canEdit?`<div class="flexbtns" style="margin-top:10px">
      <button class="btn primary fp-save" data-sid="${s.id}" data-asstaff="${asStaff?1:0}">${(asStaff&&committed)?"Send pattern change for approval":"Save pattern"}</button>
      ${asStaff?"":`<button class="btn fp-commit" data-sid="${s.id}">${committed?"Un-commit":"Commit (lock)"}</button>`}
      <button class="btn fp-cancel" data-sid="${s.id}">Discard</button></div>
      ${(asStaff&&committed)?'<div class="muted small" style="margin-top:6px">'+ic("flag")+' This pattern is committed — your edits go to admin for approval, so committed fixed shifts stay fair.</div>':""}`:'<div class="muted small" style="margin-top:6px">Read-only.</div>'}
  </div>`; }
function saveFixedPattern(sid,asStaff){ const s=S.staff.find(x=>x.id===sid); const d=fpDraft(s);
  const committed=!!(s.fixedPattern&&s.fixedPattern.committed);
  const clean={recurrence:d.recurrence||"weekly",A:d.A||{},B:d.B||{},C:d.C||{},D:d.D||{},M:(d.M||[]).filter(r=>r&&r.period).map(r=>Object.assign({nth:r.nth==="last"?"last":+r.nth||1,wd:+r.wd||0,period:r.period,zone:r.zone||""},r.type?{type:r.type}:{})),committed:committed};
  if(asStaff&&committed){
    S.requests.unshift({id:"r"+Date.now(),type:"fixed",from:sid,pattern:clean,status:"pending",createdTs:Date.now()});
    notify("admin",nameOf(sid)+" requested a change to their committed fixed pattern.",null,{tab:"requests"});
    logAudit("fixed.change-request",nameOf(sid)+" · "+fixedPatternSummary(clean),sid); toast("Sent to admin for approval.");
  } else { s.fixedPattern=clean; logAudit("fixed.save",nameOf(sid)+(isAdmin()?" (admin)":"")+" · "+fixedPatternSummary(clean),S.viewAs);
    if(isAdmin()&&sid!==S.viewAs)notify(sid,"Your fixed pattern was updated by admin.",null,{tab:"my"}); }
  delete _fpDraft[sid]; _fpOpen.delete(sid); save(); render(); }
function toggleFixedCommit(sid){ const s=S.staff.find(x=>x.id===sid); s.fixedPattern=s.fixedPattern||emptyPattern();
  s.fixedPattern.committed=!s.fixedPattern.committed; logAudit("fixed.commit",nameOf(sid)+" → "+(s.fixedPattern.committed?"committed (locked)":"unlocked"),"admin");
  notify(sid,"Your fixed pattern was "+(s.fixedPattern.committed?"committed (locked)":"unlocked")+" by admin.",null,{tab:"my"}); delete _fpDraft[sid]; if(s.fixedPattern.committed)_fpOpen.delete(sid); save(); render(); }
function wireFixedEditors(){
  document.querySelectorAll(".fp-p,.fp-z").forEach(sel=>sel.onchange=e=>{const t=e.target;setFpSlot(t.dataset.sid,t.dataset.wk,+t.dataset.wd,t.classList.contains("fp-p")?"type":"zone",t.value); if(t.classList.contains("fp-p"))render();});
  document.querySelectorAll(".fp-rec").forEach(b=>b.onclick=()=>{const s=S.staff.find(x=>x.id===b.dataset.sid);fpDraft(s).recurrence=b.dataset.rec;render();});
  document.querySelectorAll(".fp-mw,.fp-md,.fp-mp,.fp-mz").forEach(sel=>sel.onchange=e=>{const t=e.target;setFpRule(t.dataset.sid,+t.dataset.i,{"fp-mw":"nth","fp-md":"wd","fp-mp":"type","fp-mz":"zone"}[t.className],t.value); if(t.className==="fp-mp")render();});
  document.querySelectorAll(".fp-madd").forEach(b=>b.onclick=()=>{fpDraft(S.staff.find(x=>x.id===b.dataset.sid)).M.push({nth:1,wd:1,period:"AM",zone:""});render();});
  document.querySelectorAll(".fp-mdel").forEach(b=>b.onclick=()=>{fpDraft(S.staff.find(x=>x.id===b.dataset.sid)).M.splice(+b.dataset.i,1);render();});
  document.querySelectorAll(".fp-save").forEach(b=>b.onclick=()=>saveFixedPattern(b.dataset.sid,b.dataset.asstaff==="1"));
  document.querySelectorAll(".fp-commit").forEach(b=>b.onclick=()=>toggleFixedCommit(b.dataset.sid));
  document.querySelectorAll(".fp-cancel").forEach(b=>b.onclick=()=>{delete _fpDraft[b.dataset.sid];_fpOpen.delete(b.dataset.sid);render();});
}
function fixedAdminCard(r){ return `<div class="card"><div class="row" style="align-items:flex-end">
  <span class="grow"><b>${escapeHTML(nameOf(r.from))}</b> · fixed-pattern change <span class="tag warn">approval needed</span>
  <div class="muted small" style="margin-top:4px">${escapeHTML(fixedPatternSummary(r.pattern))}</div></span>
  <div class="field" style="flex:1;min-width:140px"><input id="cmt-${r.id}" placeholder="Comment (optional)"></div>
  ${r.status==="pending"?`<button class="btn sm" data-rcask="${r.id}">Ask a question</button>`:""}<button class="btn sm" data-decline="${r.id}">Decline</button><button class="btn primary sm" data-approve="${r.id}">Approve</button></div>${reqThreadHTML(r,false)}</div>`; }

