"use strict";
// moved from js/roster.js lines 595-668 (Phase 1 split, no edits)
/* ---------- Per-cycle staff ROLE (participation + quota/EFT/hours/period targets) ----------
   Identity (name, email, mobile, payroll, title, mode, fixedPattern) stays global on the person.
   The volatile role fields live in cycle.roles[id] so a quota/EFT change (e.g. EFT re-import) for one cycle
   never rewrites another. They're hydrated onto each staff object for reading, and synced back on save. */
let _rolesCycle=null;   // which cycle the staff objects' role fields currently reflect
function crole(id){ const c=active(); if(!c)return {}; if(!c.roles)c.roles={}; if(!c.roles[id])c.roles[id]={in:true}; return c.roles[id]; }
function inCycle(s){ return s&&s._in!==false; }   // is this person rostered in the active cycle?
function hydrateCycleRoles(){ const c=active(); if(!c)return; if(!c.roles)c.roles={};
  S.staff.forEach(s=>{ const r=c.roles[s.id];
    if(r){ if(r.quota!=null)s.quota=r.quota; if(r.eft!=null)s.eft=r.eft; if(r.hrsFortnight!=null)s.hrsFortnight=r.hrsFortnight; s.periodTargets=r.periodTargets||(r.periodTargets={}); s._in=(r.in!==false);
      if(r.cstQuota!=null)s.cstQuota=r.cstQuota; else delete s.cstQuota; s.cstTargets=r.cstTargets||{}; }   // CST: blank means the group default; a cycle with no CST data gets no key written for it
    else { s._in=false; delete s.cstQuota; s.cstTargets={}; } });   // no entry = not rostered in this cycle
  _rolesCycle=c.id;
}
function syncRolesGuarded(){ const c=active(); if(!c)return;
  if(_rolesCycle&&_rolesCycle!==c.id)return;   // active cycle changed but staff not yet re-hydrated — don't write stale role data (render() will refresh)
  if(!c.roles)c.roles={};
  S.staff.forEach(s=>{ const r=c.roles[s.id]; if(!r)return;   // only sync existing participants; addStaff/Add-to-cycle creates entries explicitly
    r.quota=s.quota; r.eft=s.eft; r.hrsFortnight=s.hrsFortnight; r.periodTargets=s.periodTargets;
    if(s.cstQuota!=null&&s.cstQuota!=="")r.cstQuota=s.cstQuota; else delete r.cstQuota; if(s.cstTargets&&Object.keys(s.cstTargets).length)r.cstTargets=s.cstTargets; else delete r.cstTargets; });
}
function periodUnlocked(isoD,period,excludeId,extra){
  const _cc=clinicalCounts(isoD,excludeId);
  const am=_cc.am+((extra&&extra.am)||0), pm=_cc.pm+((extra&&extra.pm)||0);   // `extra` is the candidate's OWN other half — a full shift fills the morning minimum it is then judged against
  const cur=period==="AM"?am:pm;
  const reqT=period==="AM"?effStaffing().amMin:effStaffing().pmMin;
  const maxT=period==="AM"?effStaffing().amMax:effStaffing().pmMax;
  const zmax=zonesFor(period).length;
  const cap=Math.min(maxT,zmax);
  if(cur>=cap)return {ok:false,reason:`${period} is full (${cur} of ${cap}).`};
  if(cur<reqT)return {ok:true};                         // still filling this period's minimum
  if(am<effStaffing().amMin||pm<effStaffing().pmMin)
    return {ok:false,reason:`Fill the minimum first — ${effStaffing().amMin} AM and ${effStaffing().pmMin} PM.`};
  const order=effUnlock();
  if(order==="both")return {ok:true};                   // extras open together — no AM/PM ordering
  const firstP=order==="amfirst"?"AM":"PM";             // ordered: "first" period's extras fill before the other's open
  if(period===firstP)return {ok:true};
  const otherCap=Math.min(firstP==="AM"?effStaffing().amMax:effStaffing().pmMax, zonesFor(firstP).length);
  const otherCur=firstP==="AM"?am:pm;
  if(otherCur>=otherCap)return {ok:true};
  return {ok:false,reason:`Extra ${firstP} opens before extra ${period} — fill ${firstP} first.`};
}
function periodsUnlocked(isoD,fills,excludeId){ for(let i=0;i<fills.length;i++){
    const extra={am:0,pm:0};
    for(let j=0;j<fills.length;j++)if(j!==i)fills[j]==="AM"?extra.am++:extra.pm++;   // judging the evening half of a full shift, its own morning half is already cover
    const u=periodUnlocked(isoD,fills[i],excludeId,extra); if(!u.ok)return u; }
  return {ok:true}; }   // a full shift is refused by the half that is full, and the reason names that half
function ocRowHTML(w,i){ const fz=(w.from&&w.from.zones)||[], eve=S.zones.filter(z=>z.pm||fz.indexOf(z.id)>=0), gone=fz.filter(id=>!zoneById(id)), ch=ocChosen(w);
  return `<div class="listrow ocrow${ch?" chosen":""}" data-oci="${i}" data-ocid="${escapeHTML(w.id)}">
    <input class="oc-label" value="${escapeHTML(w.label)}" style="width:118px" placeholder="Name" aria-label="On-call window name">
    <select class="oc-hours" aria-label="${escapeHTML(w.label)}: hours"><option value="fixed"${ch?"":" selected"}>Fixed hours</option><option value="chosen"${ch?" selected":""}>Chosen when booked</option></select>
    <span class="muted small oc-when-chosen">between</span> <input type="time" class="oc-start" value="${w.start}" aria-label="${escapeHTML(w.label)} start"> <span class="muted small oc-when-fixed">to</span><span class="muted small oc-when-chosen">and</span> <input type="time" class="oc-end" value="${w.end}" aria-label="${escapeHTML(w.label)} end">
    <span class="muted small oc-when-fixed">${ocHours(w)}h</span>
    <label class="oc-when-chosen"><span class="muted small">usually</span> <input type="number" class="oc-len" min="0.5" step="0.5" value="${ch?Math.round((+w.usual||240)/30)/2:4}" style="width:64px" aria-label="${escapeHTML(w.label)}: usual length in hours"> <span class="muted small">hours</span></label>
    <span class="grow"></span>
    ${fz.length?`<span class="muted small">follows the roster</span>`:""}<label><input type="checkbox" class="oc-book" ${w.book!==false?"checked":""}> <span class="oc-when-fixed">Staff can take it</span><span class="oc-when-chosen">Staff can log their own</span></label>
    <label title="A window that counts toward safe hours warns before the person works again too soon"><input type="checkbox" class="oc-rest" ${w.rest!==false?"checked":""}> Counts toward safe hours</label>
    <button class="btn danger sm oc-del">Remove</button>
    ${(eve.length||gone.length)?`<div class="oc-from" role="group" aria-label="${escapeHTML(w.label)}: follows the ${escapeHTML(perName("PM"))} shift in"><span class="muted small">Follows the ${escapeHTML(perName("PM"))} shift in</span>${eve.map(z=>`<label><input type="checkbox" class="oc-z" value="${escapeHTML(z.id)}" ${fz.indexOf(z.id)>=0?"checked":""}> ${escapeHTML(zoneLabel(z,"PM"))}${z.pm?"":' <span class="muted small">(no evening shift)</span>'}</label>`).join("")}${gone.map(id=>`<label><input type="checkbox" class="oc-z" value="${escapeHTML(id)}" checked> <span class="muted small">a removed zone</span></label>`).join("")}<span class="muted small">leave them all unticked for a window people take</span></div>`:""}
  </div>`; }
function typeRowHTML(t,i){ const lock=typeIsDefault(t), clin=!!(t.fills&&t.fills.length), sig=(t.fills||[]).join("+");
  const half=sig==="AM+PM"?`<span class="tag full">both halves \u2014 a full shift</span>`:(sig==="PM"?`<span class="tag pm">second half of the day</span>`:`<span class="tag am">first half of the day</span>`);
  return `<div class="listrow" data-sti="${i}">
    <input class="st-label" value="${escapeHTML(t.label)}" style="width:118px" placeholder="Name" aria-label="Shift type name">
    <input type="time" class="st-start" value="${t.start}" aria-label="${escapeHTML(t.label)} start"> <span class="muted small">to</span> <input type="time" class="st-end" value="${t.end}" aria-label="${escapeHTML(t.label)} end">
    <span class="muted small">${_tHours(t.start,t.end)}h</span>
    ${!clin?`<span class="tag cst">non-clinical</span>`:(lock?half:`<select class="st-fills" aria-label="Which half of the day this covers"><option value="AM"${sig==="AM"?" selected":""}>First half of the day</option><option value="PM"${sig==="PM"?" selected":""}>Second half of the day</option><option value="AM+PM"${sig==="AM+PM"?" selected":""}>Both halves \u2014 a full shift</option></select>`)}
    <span class="grow"></span>
    ${lock?`<span class="muted small">always on</span>`:`<label><input type="checkbox" class="st-on" ${t.on!==false?"checked":""}> On</label>`}
    <label><input type="checkbox" class="st-book" ${t.book!==false?"checked":""}> Staff can book</label>
    ${t.builtin?"":`<button class="btn danger sm st-del">Remove</button>`}
  </div>`; }
function unlockOrderLabel(){return {both:"AM & PM open together",amfirst:"AM before PM",pmfirst:"PM before AM"}[effUnlock()];}

