"use strict";
// moved from js/admin.js lines 438-516 (Phase 1 split, no edits)
let _staffQuery="", _staffFilter="all", _staffTag="";   // device-side: the Staff tab's search box and filter
let _qtView="clinical";   // device-side: which quota the Quota & fairness table shows — clinical | cst
function staffFiltered(q,f,tag){ q=String(q||"").trim().toLowerCase(); f=f||"all";
  const list=S.staff.filter(s=>{
    if(tag&&tagById(S,tag)&&!hasTag(S,s,tag))return false;   // a filter for a tag that has gone shows everyone
    if(f==="in"&&!inCycle(s))return false; if(f==="out"&&inCycle(s))return false;
    if(f==="nologin"&&(s.email||s.email2||s.mobile))return false; if(f==="fixed"&&s.mode!=="fixed")return false; if(f==="none"&&s.mode!=="none")return false;
    if(!q)return true; return [s.name,s.initials,s.email,s.email2,s.mobile,s.payrollId].some(v=>String(v||"").toLowerCase().indexOf(q)>=0); });
  return list.sort((a,b)=>{ const A=splitName(a.name), B=splitName(b.name); return (A.sur.localeCompare(B.sur,undefined,{sensitivity:"base"}))||(A.giv.localeCompare(B.giv,undefined,{sensitivity:"base"})); }); }
function staffRowHTML(s){
    const open=_staffOpen.has(s.id);
    const nonClin=s.mode==="none";
    const inCyc=inCycle(s);
    const showRole=inCyc&&!nonClin;
    const mode={self:"Self-roster",fixed:"Fixed pattern",preference:"Pref + auto-draft",none:"No shifts (coordinator / office)"}[s.mode]||s.mode;
    const committed=s.fixedPattern&&s.fixedPattern.committed, pending=S.requests.find(r=>r.type==="fixed"&&r.from===s.id&&r.status==="pending");
    const contact=s.email2||s.mobile||s.email||"";   // default to personal email / mobile; only show what exists
    const noContact=!s.email&&!s.email2&&!s.mobile;
    const meta=(showRole?[mode,"Quota "+s.quota].concat((featOn("cst")&&cstQuotaOf(s)>0)?[cstLabel()+" "+cstQuotaOf(s)]:[]).concat(["EFT "+(+s.eft||0).toFixed(2)]):[mode]).concat(contact?[contact]:[]).join(" · ");
    return `
    <div class="staffitem" data-s="${s.id}" style="${inCyc?"":"opacity:.6"}">
      <div class="staffsum">
        <button class="ctl stoggle" data-stoggle="${s.id}" aria-expanded="${open?"true":"false"}"${open?` aria-controls="sd-${s.id}"`:""}><span class="chev">${open?ic("chevD"):ic("chevR")}</span>
        <span class="snm">${escapeHTML(s.name)}<span class="tag brand mini">${escapeHTML(s.initials||"")}</span></span>
        <span class="smeta">${escapeHTML(meta)}${tagChipsAll(s)}${noContact?' <span class="tag warn" title="No email or mobile — this person cannot sign in and will not sync to the allow-list">no login</span>':""}${inCyc?"":' <span class="tag muted" title="On the staff list but not rostered in the selected cycle">not in this cycle</span>'}</span></button>
        <span class="grow"></span>
        ${inCyc?"":`<button class="btn primary sm s-addcyc" data-sid="${s.id}">+ Add to this cycle</button>`}
      </div>
      ${open?`<div class="staffdetail" id="sd-${s.id}"><div class="sd-grid">
        <label>Name<input class="s-name" value="${escapeHTML(s.name)}"></label>
        <label>Initials<input class="s-init" value="${escapeHTML(s.initials||"")}"></label>
        <label>Title / role<input class="s-title" value="${escapeHTML(s.title||"")}" placeholder="e.g. Medical Specialist"></label>
        <label>Mobile<input class="s-mob" value="${escapeHTML(s.mobile||"")}" placeholder="—"></label>
        <label>Rostering mode<select class="s-mode"><option value="self" ${s.mode==="self"?"selected":""}>Self-roster</option><option value="fixed" ${s.mode==="fixed"?"selected":""}>Fixed pattern</option><option value="preference" ${s.mode==="preference"?"selected":""}>Pref + auto-draft</option><option value="none" ${nonClin?"selected":""}>No shifts (coordinator / office)</option></select></label>
        <label>Work email<input class="s-email" value="${escapeHTML(s.email||"")}" placeholder="—"></label>
        <label>Alt / personal email<input class="s-email2" value="${escapeHTML(s.email2||"")}" placeholder="—"></label>
        ${showRole?`<label>Quota / cycle<input type="number" class="s-quota" value="${s.quota}"></label>
        <label>EFT<input type="number" step="0.01" class="s-eft" value="${(+s.eft||0).toFixed(2)}"></label>
        <label>Hours / fortnight<input type="number" step="0.01" class="s-hrs" value="${(+s.hrsFortnight||0).toFixed(2)}"></label>${featOn("cst")?`<label>${escapeHTML(cstLabel())} / cycle<input type="number" min="0" class="s-cst" value="${(s.cstQuota!=null&&s.cstQuota!=="")?s.cstQuota:""}" placeholder="${cstDefaultQuota()?("default "+cstDefaultQuota()):"no cap"}" title="Blank uses the default from Quota &amp; fairness; 0 means no cap"></label>`:""}`:""}
        <label>Payroll #<input class="s-pay" value="${escapeHTML(s.payrollId||"")}" placeholder="—"></label>
      </div>${!inCyc?`<div class="muted small" style="margin-top:8px">Not rostered in <b>${escapeHTML(cyLabel(active()))}</b>. Their name, contacts and other cycles are kept — click <b>+ Add to this cycle</b> to roster them here (quota/EFT set per cycle).</div>`:nonClin?`<div class="muted small" style="margin-top:8px">Non-clinical — no clinical shifts, quota, EFT or pattern. They won't appear in the roster, self-roster or planner. Add an email so they can sign in${(CLOUD.adminEmails||[]).length?", then make them an admin in <b>Settings → Access control</b> if they coordinate the roster.":"."}</div>`:`<div class="muted small" style="margin-top:8px">In <b>${escapeHTML(cyLabel(active()))}</b>. Quota/EFT/hours apply to this cycle only. <button class="btn sm s-rmcyc" data-sid="${s.id}" style="margin-left:4px">Remove from this cycle</button> <span class="muted">— keeps them on the staff list and in other cycles.</span></div>`}
      ${tagList(S).length?`<div style="margin-top:8px"><span class="lbl">Tags</span> ${tagList(S).map(t=>`<label style="margin-right:10px"><input type="checkbox" class="s-tag" data-t="${t.id}" ${hasTag(S,s,t.id)?"checked":""}> ${escapeHTML(t.name)}</label>`).join("")}</div>`:""}
      ${isAdmin()?`<label class="field" style="display:block;margin-top:8px"><span class="lbl" style="display:block;margin-bottom:4px">Job description</span><textarea class="s-notes" rows="3" placeholder="Bespoke considerations for the roster \u2014 only admins see this" style="width:100%;max-width:560px;font:inherit">${escapeHTML(s.notes||"")}</textarea></label>`:""}
      <div class="flexbtns" style="margin-top:10px">${(inCyc&&!nonClin)?`<button class="btn sm s-fp" data-sid="${s.id}">Pattern${committed?" "+ic("lock"):""}${pending?" "+ic("flag"):""}</button>`:""}<button class="btn primary sm s-save" data-sid="${s.id}">Save changes</button><span class="grow"></span><button class="btn danger sm s-del">Remove from staff list</button></div>
      </div>`:""}
      ${_fpOpen.has(s.id)?fixedPatternEditorHTML(s,true,false):""}
    </div>`;}
function staffListHTML(){ const list=staffFiltered(_staffQuery,_staffFilter,_staffTag); if(!S.staff.length)return '<div class="muted small">Nobody on the list yet — upload the template above, or add someone below.</div>';
  return `<div class="muted small" id="staffCount" style="margin-bottom:6px">Showing ${list.length} of ${S.staff.length}</div>`+(list.length?list.map(staffRowHTML).join(""):'<div class="muted small">No one matches.</div>'); }
function recordImport(kind,file,summary){ if(!S.lastImport)S.lastImport={}; S.lastImport[kind]={ts:Date.now(),file:String(file||""),summary:String(summary||"")}; }
function lastImportLine(kind){ const r=S.lastImport&&S.lastImport[kind]; if(!r)return ""; return "Last: "+escapeHTML(r.file)+" · "+tsFmt(r.ts)+(r.summary?" · "+escapeHTML(r.summary):""); }
function exportMenuHTML(){   // one Export button, one plain description per file
  const rows=[["rosXls","Roster as Excel","The grid as you see it, with colours — for printing or sharing."],["rosCsv","Roster as CSV","The same grid without colours — one row per person, a column per day. Opens anywhere."]]
    .concat(featOn("rosteron")?[["rosPay","Payroll file for RosterOn","One row per shift with times and hours, in your payroll template's columns."],["rosRon","RosterOn workbook","A readable roster sheet plus a one-row-per-shift data sheet."]]:[])
    .concat([["expEftM","EFT tracker","EFT for everyone in this cycle, one column per week, in the tracker's layout."]])
    .concat((clockOn()||Object.keys(active().clock||{}).length)?[["expClock","Clock report","One row per clocked shift: rostered, clocked, flags and the decision."]]:[]);
  return `<div class="overlay" id="ovlExport"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h3 id="dlgT">Export ${escapeHTML(cyLabel(active()))}</h3>
    <div style="margin-top:8px">${rows.map(([id,t,d])=>`<button class="exrow" id="${id}"><b>${ic("download")} ${t}</b><span class="muted small">${d}</span></button>`).join("")}</div>
    <div class="muted small" style="margin-top:10px">${featOn("rosteron")?`<a href="#" data-go="setup||card-payroll">Configure the payroll template</a> · `:""}<a href="#" id="exClose">Close</a></div></div></div>`; }
function openExportMenu(){ const root=openDialog(exportMenuHTML());
  const bind=(id,fn)=>{ const el=document.getElementById(id); if(el)el.onclick=()=>{ closeModal(); fn(); }; };
  bind("rosXls",exportRosterXLS); bind("rosCsv",exportRosterCSV); bind("rosPay",exportPayrollCSV); bind("rosRon",exportRosterOn); bind("expEftM",exportEftTracker); bind("expClock",exportClockCSV);
  const c=document.getElementById("exClose"); if(c)c.onclick=e=>{ e.preventDefault(); closeModal(); };
  root.querySelector("#ovlExport").onclick=e=>{ if(e.target.id==="ovlExport")closeModal(); };
  root.querySelectorAll("[data-go]").forEach(b=>b.onclick=e=>{ e.preventDefault(); closeModal(); const g=parseGo(b.dataset.go); go(g.tab,{cycle:g.cycle,anchor:g.anchor}); }); }
function viewStaff(){
  const junk=S.staff.filter(s=>!isNameCell(s.name));
  return `<div class="card">
    <h2>Staff <span class="muted small">(${S.staff.length})</span></h2>
    <div class="sub">Add / remove staff, set rostering mode and clinical-shift quota (from EFT). Import from your template lands here next.</div>
    ${junk.length?`<div class="note" style="border-left:4px solid var(--danger-t);margin-bottom:8px">${ic("warn")} ${junk.length} row${junk.length>1?"s":""} look like spreadsheet labels, not people: <b>${junk.map(s=>escapeHTML(s.name)).join(", ")}</b>. <button class="btn sm" id="tidyStaff" style="margin-left:6px">${ic("clean")} Remove ${junk.length>1?"them":"it"}</button></div>`:""}
    <div class="stafftools"><input id="staffSearch" type="search" placeholder="Search name, email, mobile…" value="${escapeHTML(_staffQuery)}" aria-label="Search staff">
      <div class="seg" id="staffFilterSeg">${[["all","All"],["in","In this cycle"],["out","Not in cycle"],["nologin","No login"],["fixed","Fixed pattern"],["none","Non-clinical"]].map(([k,l])=>`<button data-sf="${k}" class="${_staffFilter===k?"on":""}">${l}</button>`).join("")}</div>${tagList(S).length?`<select id="staffTagSel" aria-label="Tag"><option value="">Any tag</option>${tagList(S).map(t=>`<option value="${t.id}" ${_staffTag===t.id?"selected":""}>${escapeHTML(t.name)}</option>`).join("")}</select>`:""}</div>
    <div class="sub" style="margin-bottom:2px">Tap a name to expand and edit their details — fields save as you leave them.</div>
    <div id="staffList">${staffListHTML()}</div>
    <div class="flexbtns"><button class="btn sm" id="addStaff">+ Add staff</button></div>
  </div>`;
}

