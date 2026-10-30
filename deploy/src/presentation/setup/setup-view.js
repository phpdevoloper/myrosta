"use strict";
// moved from js/admin.js lines 107-437 (Phase 1 split, no edits)
function brandingCardHTML(){
  const b=S.branding||{}, f=S.features||{};
  const flag=(k,label,hint)=>`<label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" class="featFlag" data-feat="${k}" ${featOn(k)?"checked":""}> ${label}${hint?` <span class="muted small">— ${hint}</span>`:""}</label>`;
  return `<div class="card" id="brandCard">
    <h2>Staff group &amp; branding</h2>
    <div class="sub">How this staff group appears, what its people are called, and which features it uses. Per group — the hospital\u2019s other staff groups are unaffected.</div>
    <div class="row" style="align-items:flex-end;margin-top:6px">
      <label class="field"><span class="lbl">Organisation <span class="muted">(hospital / site)</span></span><input id="brHosp" value="${escapeHTML(b.hospital||"")}" placeholder="e.g. Northern Hospital ED" style="width:190px"></label>
      <label class="field"><span class="lbl">This staff group</span><input id="brName" value="${escapeHTML(b.name||_orgLabel||"")}" placeholder="e.g. Nurses" style="width:170px"></label>
      <label class="field"><span class="lbl">Staff are called <span class="muted">(singular)</span></span><input id="brRole" list="roleSuggest" value="${escapeHTML(ROLE())}" placeholder="consultant" style="width:150px"><datalist id="roleSuggest">${["consultant","doctor","junior doctor","registrar","intern","nurse","midwife","scribe","clerk","paramedic","pharmacist","radiographer","technician","staff member"].map(r=>`<option value="${escapeHTML(r)}"></option>`).join("")}</datalist></label>
      <button class="btn primary" id="brSave">Save group details</button>
    </div>
    <div class="row" style="align-items:center;margin-top:10px;gap:10px"><span class="lbl">Logo</span>${logoOK(b.logo)?`<img src="${b.logo}" alt="" style="height:28px;width:auto;max-width:112px;border-radius:6px">`:`<span class="muted small">None yet — the header shows the Myrosta mark.</span>`}
      <label class="btn sm" style="cursor:pointer">${logoOK(b.logo)?"Replace logo":"Add a logo"}<input type="file" id="brLogo" accept="image/*" class="vh"></label>${logoOK(b.logo)?`<button class="btn sm" id="brLogoRm">Remove logo</button>`:""}
      <span class="muted small">PNG, JPG or SVG · shown in this group\u2019s header, kept small.</span></div>
    <div class="sub" style="margin-top:10px"><b>Features</b></div>
    <div style="display:flex;flex-wrap:wrap">
      ${flag("rosteron","RosterOn payroll export","hide if this organisation doesn't use RosterOn")}
      ${flag("equity","Equity tab","tough‑shift share, visible to all")}
      ${flag("planner","Leave planner tab")}
      ${flag("marketplace","Open‑shift marketplace","also needs its own On switch above")}
      ${flag("cst","Clinical support time (CST)","switch off for groups without it — nurses, scribes, clerks")}
      <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" id="ownHours" ${ownHoursOn()?"checked":""}> Staff may set their own hours <span class="muted small">\u2014 admins can always set a booking\u2019s hours from the cell; this lets staff set their own, at booking and after</span></label>
      <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin:4px 14px 4px 0"><input type="checkbox" id="instantBook" ${instantBookOn()?"checked":""}> Book shifts the moment they tap <span class="muted small">\u2014 on for every group unless you switch it off: the first tap wins and the shift is theirs at once, nothing to confirm. Off, picks wait in a basket until Confirm. Own hours are then changed on the booked shift.</span></label>
    </div>
    ${deptCardHTML()}
    <div class="muted small" style="margin-top:6px">Group id <b>${escapeHTML(_org)}</b>${_orgCount>1?` · you belong to ${_orgCount} staff groups (the Group button in the header)`:""}.</div>
  </div>`;
}
let _setupTab="cycle";   // Settings has two halves: what belongs to this cycle, and what belongs to the staff group
const SETUP_CYCLE=["card-status","card-cycle","card-zones","card-cover","card-rules","card-times","card-oncall","card-fatigue","card-leavecap","card-notice","card-quota","card-mode"];
const SETUP_GROUP=["brandCard","card-tags","clockCard","card-cycles","card-import","card-payroll","card-access","marketCard","capCard","card-danger"];
function setupTabFor(anchor){ return SETUP_GROUP.includes(anchor)?"group":"cycle"; }
function cycH2(t){ return `<h2>${t} <span class="tag muted" title="Applies only to the cycle selected in the header">${escapeHTML(cyLabel(active()))}</span></h2>`; }
function setupIndexHTML(half){
  const items=half==="cycle"?[["card-status","Status"],["card-cycle","Dates"],["card-zones","Zones"],["card-cover","Cover"],["card-rules","Rules"],["card-times","Shift types"],["card-oncall","On-call"],["card-fatigue","Fatigue"],["card-leavecap","Leave cap"],["card-notice","Notice"],["card-quota","Quota"],["card-mode","Mode &amp; method"]]
                            :[["brandCard","Group"],["card-tags","Tags"],["clockCard","Clock"],["card-cycles","Cycles"],["card-import","Import"]].concat(featOn("rosteron")?[["card-payroll","Payroll"]]:[]).concat(cloudOn()?[["card-access","Access"]]:[]).concat(featOn("marketplace")?[["marketCard","Marketplace"]]:[]).concat([["capCard","Capacity"],["card-danger","Danger zone"]]);
  return `<nav class="setidx" aria-label="Settings sections">${items.map(([id,l])=>`<a href="#" data-go="setup||${id}">${l}</a>`).join("")}</nav>`; }
function dangerCardHTML(){ return `<div class="card" id="card-danger" style="border-left:4px solid var(--danger-t)"><h2>Danger zone</h2>
    <div class="sub">Deletes the staff list, every cycle and shift, leave, requests, messages, notifications and the audit log for <b>${escapeHTML(groupName())}</b>. People keep their sign-in, but this group is left empty. There is no undo.</div>
    <div class="flexbtns"><button class="btn danger" id="dangerBtn">Delete all data for ${escapeHTML(groupName())}</button></div><div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="featReviewed">${S.featuresReviewed?ic("check")+" Features reviewed":"Mark features reviewed"}</button></div></div>`; }
function viewSetup(){
  const a=active();
  const ds=datesOf(a.cycle);
  const st=STATUS[a.status];
  const live=S.cycles.filter(c=>!c.archived).sort((x,y)=>x.cycle.start<y.cycle.start?-1:1);
  const archived=S.cycles.filter(c=>c.archived).sort((x,y)=>x.cycle.start<y.cycle.start?1:-1);
  const half=_setupTab==="group"?"group":"cycle";
  const C={
    status:`
  <div class="card" id="card-status">
    <h2>Roster status — ${cyLabel(a)}</h2>
    <div class="sub">Applies to the cycle selected in the header. Each cycle has its own status.</div>
    <div class="row" style="align-items:center">
      <span class="tag ${st.cls}" style="font-size:var(--fs-sm)">${statusLabel(a)}</span>
      <span class="grow"></span>
      ${a.archived?'<span class="muted small">Archived — restore below to edit.</span>':statusActions()}
    </div>
    <div class="note">${isRolling(a)?"<b>Rolling roster:</b> Draft → build &amp; pre-fill · <b>Live</b> → staff add and drop shifts whenever they need to, for as long as this cycle runs. There is no closing round.":"Draft → build &amp; pre-fill · Open → staff self-roster · Closed → locked for review · Published → live for everyone."}${a.archived?"":" Once your next cycle is published you can <b>archive</b> this one — optional, never automatic."}</div>
    ${a.archived?`<div class="flexbtns"><button class="btn sm" data-restore="${a.id}">Restore to live</button></div>`:`<div class="flexbtns"><button class="btn sm" data-archive="${a.id}">Archive this cycle</button></div>`}
  </div>
`,
    cycle:`
  <div class="card" id="card-cycle">
    ${cycH2("Cycle dates")}
    <div class="sub">Start date and length of this cycle.</div>
    <div class="row">
      <label class="field"><span class="lbl">Start date</span><input type="date" id="cycStart" value="${a.cycle.start}" ${canEdit()?"":"disabled"}></label>
      <label class="field"><span class="lbl">Length (weeks)</span><input type="number" id="cycWeeks" min="1" max="26" value="${a.cycle.weeks}" style="width:90px" ${canEdit()?"":"disabled"}></label>
      <button class="btn primary" id="saveCycle" ${canEdit()?"":"disabled"}>Save cycle dates</button>
    </div>
    <div class="note">Selected cycle: <b>${fmt(ds[0],{day:"numeric",month:"short",year:"numeric"})}</b> → <b>${fmt(ds[ds.length-1],{day:"numeric",month:"short",year:"numeric"})}</b> · ${ds.length} days</div>
  </div>`,
    cycles:`
  <div class="card" id="card-cycles">
    <h2>Cycles</h2>
    <div class="sub">Start the next cycle while this one stays live; open, restore or delete earlier ones.</div>
    <div class="flexbtns"><button class="btn sm" id="prepNext">→ Prepare next cycle</button></div>
    <div class="muted small" style="margin-top:6px">Creates a fresh draft starting the day after your latest cycle ends. Current cycle stays live; staff, zones &amp; settings carry over.</div>
    ${live.length>1?`<h3 style="font-size:var(--fs-md);margin:16px 0 6px">Live cycles (${live.length})</h3>`+live.map(c=>`
      <div class="listrow"><span class="grow">${cyLabel(c)} <span class="tag ${STATUS[c.status].cls}" style="font-size:var(--fs-2xs)">${STATUS[c.status].label}</span>${c.id===S.activeId?' <span class="tag brand">selected</span>':""}</span>
        ${c.id===S.activeId?"":`<button class="btn sm" data-select="${c.id}">Open</button>`}${c.status==="draft"?`<button class="btn danger sm" data-deldraft="${c.id}">Delete</button>`:""}</div>`).join(""):""}
    ${archived.length?`<h3 style="font-size:var(--fs-md);margin:16px 0 6px">Previous cycles (${archived.length})</h3>`+archived.map(c=>`
      <div class="listrow"><span class="grow">${cyLabel(c)} <span class="tag muted" style="font-size:var(--fs-2xs)">archived</span></span>
        <button class="btn sm" data-select="${c.id}">View</button>
        <button class="btn sm" data-restore="${c.id}">Restore</button>
        <button class="btn danger sm" data-del="${c.id}">Delete</button></div>`).join(""):""}
  </div>
`,
    import:`
  <div class="card" id="card-import">
    <h2>Import data</h2>
    <div class="sub">Upload your organisation's Excel templates — the app reads them as-is and normalises codes. Roster → adds a new cycle. Leave planner → merges leave + EFT/hours. EFT tracker → sets EFT, hours and employee numbers (which feed the payroll export).</div>
    <div class="row">
      <div class="field"><label class="lbl" for="impStaff">Staff list (.xlsx)</label><input type="file" id="impStaff" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("staff")}</div></div>
      <div class="field"><label class="lbl" for="impRoster">Roster template (.xlsx)</label><input type="file" id="impRoster" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("roster")}</div></div>
      <div class="field"><label class="lbl" for="impLeave">Leave planner (.xlsx)</label><input type="file" id="impLeave" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("leave")}</div><label class="muted small" style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" id="impLeaveAny"> Treat any filled cell as unavailable</label></div>
      <div class="field"><label class="lbl" for="impEft">EFT tracker (.xlsx)</label><input type="file" id="impEft" accept=".xlsx,.xls"><div class="muted small">${lastImportLine("eft")}</div></div>
    </div>
    <div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="dlStaffTpl">${ic("download")} Staff template</button><button class="btn sm" id="expEft">${ic("download")} Export EFT tracker</button></div>
    <div class="muted small" style="margin-top:6px">EFT tracker auto-detects the unit (EFT fraction or hours/week), uses the week matching this cycle, and matches ${ROLES()} by employee # or surname. Tip: import the cleaned copy for best results. Needs internet (loads the spreadsheet reader).</div>
  </div>
`,
    payroll:`
  <div class="card" id="card-payroll">
    <h2>Payroll export (RosterOn)</h2>
    <div class="sub">Roster tab → <b>Export…</b> → <b>Payroll file for RosterOn</b> builds a one-row-per-shift file. Upload RosterOn's import template here and the app exports in <b>its exact columns</b>. No template = a standard layout.</div>
    <div class="row">
      <label class="field"><span class="lbl">RosterOn template (.csv / .xlsx)</span><input type="file" id="payTpl" accept=".csv,.xlsx,.xls"></label>
      <label class="field"><span class="lbl">Date format</span><select id="payDateFmt">${DATE_FORMATS.map(f=>`<option value="${f[0]}" ${(S.payrollDateFmt||"DD/MM/YYYY")===f[0]?"selected":""}>${f[0]} — ${f[1]}</option>`).join("")}</select></label>
    </div>
    ${S.payrollTemplate&&S.payrollTemplate.headers&&S.payrollTemplate.headers.length?`
    <div class="note" style="margin-top:10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <b>Using template:</b> ${escapeHTML(S.payrollTemplate.filename||"uploaded")} <span class="tag ok">${S.payrollTemplate.headers.length} columns</span>
        <span class="grow"></span>
        <button class="btn sm" id="payTplClear">Clear template</button>
      </div>
      <div class="sub" style="margin:10px 0 0">Map each RosterOn column to the roster data that fills it — auto-detected, adjust any that are wrong.</div>
      <table class="maptbl"><tr><th>RosterOn column</th><th>Filled with</th></tr>
      ${S.payrollTemplate.headers.map((h,i)=>`<tr><td>${escapeHTML(h||"(blank)")}</td><td>
        <select class="payMap" data-col="${i}"><option value="">— leave blank —</option>${PAYROLL_FIELDS.map(f=>`<option value="${f[0]}" ${((S.payrollTemplate.map||[])[i]===f[0])?"selected":""}>${f[1]}</option>`).join("")}</select>
      </td></tr>`).join("")}
      </table>
    </div>`:`<div class="muted small" style="margin-top:6px">No template uploaded — export uses standard columns: Employee No, Surname, Given Name, Date, Shift Code, Start, End, Hours, Unit, Notes.</div>`}
    <div class="muted small" style="margin-top:8px">Shift types for this cycle: ${shiftTypesOf(active()).filter(t=>t.on!==false&&t.derived!=="oncall").map(t=>escapeHTML(t.label)+" "+typeTime(t)+((t.fills||[]).length>1?" (whole day)":"")).join(" · ")}${ocWindows(active()).length?" · On call: "+ocWindows(active()).map(w=>escapeHTML(w.label)+" "+ocTime(w)).join(" · "):""} · Leave = 8h × EFT. Edit in This cycle → <a href="#" data-go="setup||card-times">Shift types</a>.</div>
  </div>
`,
    access:`
  ${cloudOn()?`<div class="card" id="card-access">
    <h2>Access control (cloud)</h2>
    <div class="sub">Who is allowed to sign in and reach the database. Allowed email domains: <b>${(CLOUD.allowedDomains||[]).join(", ")||"any (set CLOUD.allowedDomains)"}</b>.</div>
    <div class="flexbtns"><button class="btn" id="memSync">Sync allow-list from staff + admins</button><button class="btn" id="memInvite" data-invite="1">Invite your ${escapeHTML(ROLES())}</button></div>
    <h3 style="font-size:var(--fs-md);margin:14px 0 6px">Allow-list members (${_members.length})</h3>
    ${_members.length?_members.map(m=>{const cfg=(CLOUD.adminEmails||[]).map(x=>String(x).toLowerCase()).includes(String(m.email).toLowerCase());const isAdm=m.role==="admin";const sms=/@sms\.local$/i.test(m.email||"");const disp=sms?("+"+(m.phone||(m.email||"").split("@")[0])):m.email;return `<div class="listrow"><span class="grow">${sms?ic("phone")+" ":""}${escapeHTML(disp)}${m.name?' · '+escapeHTML(m.name):""} <span class="tag ${isAdm?"ok":"muted"}">${escapeHTML(m.role||"staff")}</span>${sms?' <span class="tag muted" title="Signs in by SMS only — no email on file">SMS</span>':""}${cfg?' <span class="tag muted" title="Admin via app config — always admin">config</span>':""}</span>${cfg?"":`<button class="btn sm" data-memrole="${escapeHTML(m.email)}" data-memto="${isAdm?"staff":"admin"}" data-memname="${escapeHTML(m.name||"")}">${isAdm?"Make staff":"Make admin"}</button>`}<button class="btn danger sm" data-memrm="${escapeHTML(m.email)}">Remove</button></div>`;}).join(""):'<div class="muted">No members yet — click Sync to add your staff + admins, then only they can access the data.</div>'}
    <div class="muted small" style="margin-top:14px"><b>Add by email</b> — grant access to someone who isn't a rostered clinician (e.g. an IT or admin-only account). For doctors and coordinators, add them in the <b>Staff</b> tab (set coordinators to <b>Non-clinical / admin</b>) and click <b>Sync</b> instead — that keeps their name, mobile and SMS sign-in in step. A login alone gives no access until the person is on this list.</div>
    <div class="row" style="align-items:flex-end;margin-top:8px">
      <label class="field" style="flex:1;min-width:180px"><span class="lbl">Email</span><input id="memEmail" placeholder="person@hospital..."></label>
      <label class="field"><span class="lbl">Role</span><select id="memRole"><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
      <button class="btn primary" id="memAdd">Add</button>
    </div>
    <div class="muted small" style="margin-top:6px">Run the SQL in SUPABASE.md first to create the table + database rules. The database then blocks anyone not on this list — even if they have a login.</div>
    <h3 style="font-size:var(--fs-md);margin:16px 0 6px">Shared / public computers</h3>
    <div class="sub">At sign-in, staff can tick <b>“This is a shared or public computer”</b>. Those sessions don't stay logged in — they end when the page closes and after this idle time. Personal phones are unaffected (they stay signed in).</div>
    <div class="row" style="align-items:flex-end;margin-top:8px">
      <label class="field"><span class="lbl">Auto-logout after idle (shared only)</span><input type="number" min="1" max="240" id="secIdle" value="${(S.security&&S.security.sharedIdleMin)||15}" style="width:90px"> <span class="muted small">minutes</span></label>
    </div>
  </div>`:""}
`,
    zones:`
  <div class="card" id="card-zones">
    ${cycH2("Zones")}
    <div class="sub">Each zone is one slot per period per day. Add or remove to match your department. Tick which periods it runs in; PM label is optional. The short name, up to five letters, is what the phone\u2019s month view shows (blank means the automatic one: Resus, Paeds, FT). Which zone\u2019s evening carries on-call is set on the <b>On-call</b> card.</div>
    <div id="zoneList"></div>
    <div class="flexbtns"><button class="btn sm" id="addZone">+ Add zone</button></div>
  </div>
`,
    times:`
  <div class="card" id="card-times">
    ${cycH2("Shift types")}
    <div class="sub">What a person can be on for <b>in this cycle</b> — the name your group uses for it, its hours, and which half of the day it covers. Booking, payroll and RosterOn exports, calendar files, reminders and the safe-hours rules all read these. The day\u2019s two halves are always on; anything else can be switched off. A type that covers <b>both halves</b> is a full shift: one booking, one person, the whole day.</div>
    <div id="typeRows">${shiftTypesOf(active()).map((t,i)=>t.derived==="oncall"?"":typeRowHTML(t,i)).join("")}</div>
    <div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="addShiftType">+ Add a shift type</button><span class="grow"></span><button class="btn primary sm" id="saveShiftTimes">Save shift types</button></div>
  </div>
`,
    fatigue:`
  <div class="card" id="card-fatigue">
    ${cycH2("Fatigue &amp; safe hours")}
    <div class="sub">Safety guardrails checked at booking time (self-roster and admin assign). <b>Warn</b> allows the shift but flags it; <b>Block</b> stops staff (admins can still override, with a warning). Off by default.</div>
    ${(()=>{const f=effFatigue();return `<div class="row" style="align-items:flex-end">
      <div class="field" role="group" aria-labelledby="lbl-ftSeg"><span class="lbl" id="lbl-ftSeg">Rule mode</span><div class="seg" id="ftSeg" aria-labelledby="lbl-ftSeg"><button data-ft="off" class="${f.mode==="off"?"on":""}">Off</button><button data-ft="warn" class="${f.mode==="warn"?"on":""}">Warn</button><button data-ft="block" class="${f.mode==="block"?"on":""}">Block</button></div></div>
      <label class="field"><span class="lbl">Min rest between shifts (h)</span><input type="number" min="0" max="24" step="0.5" id="ftRest" value="${f.minRest}" style="width:90px"></label>
      <label class="field"><span class="lbl">Max consecutive clinical days</span><input type="number" min="0" max="14" id="ftConsec" value="${f.maxConsec}" style="width:90px"></label>
      <button class="btn primary sm" id="saveFatigue">Save fatigue rules</button></div>
      <div class="muted small" style="margin-top:6px">Rest is measured from the true end of the previous shift, and on-call windows that count toward rest count here too: a window that follows a shift runs that shift through to the window\u2019s end. Set a value to 0 to disable that rule.</div>`;})()}
  </div>
`,
    cover:`
  <div class="card" id="card-cover">
    ${cycH2("Staff required per shift")}
    <div class="sub">${hasExtraSlots()?`Minimums fill first; extra slots (up to max) unlock only after both minimums are met. You choose the order extras open — currently <b>${unlockOrderLabel()}</b>. `:`Minimum equals maximum, so every slot is required cover — there are no extra slots to unlock. `}<b>These settings apply to this cycle only</b> — changing them won't touch other (e.g. published) cycles.</div>
    <div class="row">
      <label class="field"><span class="lbl">AM minimum</span><input type="number" min="0" id="amMin" value="${effStaffing().amMin}" style="width:80px"></label>
      <label class="field"><span class="lbl">AM maximum</span><input type="number" min="0" id="amMax" value="${effStaffing().amMax}" style="width:80px"></label>
      <label class="field"><span class="lbl">PM minimum</span><input type="number" min="0" id="pmMin" value="${effStaffing().pmMin}" style="width:80px"></label>
      <label class="field"><span class="lbl">PM maximum</span><input type="number" min="0" id="pmMax" value="${effStaffing().pmMax}" style="width:80px"></label>
      <button class="btn primary" id="saveStaffing">Save cover</button>
    </div>
    <div class="row" style="margin-top:4px">
      <div class="field" role="group" aria-labelledby="lbl-uoSeg"><span class="lbl" id="lbl-uoSeg">Extra slots open</span>
        <div class="seg" id="uoSeg" aria-labelledby="lbl-uoSeg">
          <button data-uo="both" class="${effUnlock()==="both"?"on":""}">AM &amp; PM together</button>
          <button data-uo="amfirst" class="${effUnlock()==="amfirst"?"on":""}">AM before PM</button>
          <button data-uo="pmfirst" class="${effUnlock()==="pmfirst"?"on":""}">PM before AM</button>
        </div></div>
    </div>
    <div class="note">Min/max set how many can work each period; "Extra slots open" sets whether AM or PM extras (above the minimum) unlock first — different departments prefer different orders. Max can't exceed zones for that period (AM zones: ${zonesFor("AM").length}, PM zones: ${zonesFor("PM").length}).</div>
  </div>
`,
    notice:`
  <div class="card" id="card-notice">
    ${cycH2("Notice to come off a shift")}
    <div class="sub">How close to a shift someone may still take themselves off it. Inside the notice period they hand it to a colleague or ask you \u2014 outside it they can drop it, and it goes to the group as an open shift either way. <b>0 turns it off</b>, which is how every group starts.</div>
    <div class="row">
      <label class="field"><span class="lbl">Notice (days)</span><input type="number" step="1" min="0" max="365" id="noticeDays" value="${effNotice(active())}" style="width:90px"></label>
      <button class="btn primary" id="saveNotice">Save notice period</button>
    </div>
    ${effNotice(active())>0&&!(featOn("marketplace")&&S.marketOn)?`<div class="note">${ic("lock")} Open shifts is off for this group, so a shift someone comes off has nowhere to go. Turn it on under Group \u2192 Open shifts.</div>`:""}
  </div>
`,
    oncall:`
  <div class="card" id="card-oncall">
    ${cycH2("On-call")}
    <div class="sub">On-call is its own roster, not a shift. Whoever carries a window is <b>not</b> counted as cover and takes no zone, so it can never hide a gap \u2014 and the same person may work the floor and carry a window later the same day. A window people take has one person a day. Add as many windows as your group runs. A window is either <b>taken</b> by a person, or <b>follows</b> the ${escapeHTML(perName("PM"))} shift in the zones you tick \u2014 whoever works that evening carries it, and nobody takes it by hand. Or its hours are <b>chosen when booked</b>: a call-in, logged once someone has been called in, with the hours they worked, and as many people a day as are called in.</div>
    ${!Array.isArray(cset().oncallWindows)&&ocWindows(active()).length?`<div class="muted small" style="margin-top:6px">Worked out from the zones this cycle already marks as carrying on-call. Save to keep it as it is, or change it here.</div>`:""}
    <div id="ocRows">${ocCardRows()}</div>
    <div class="flexbtns" style="margin-top:8px"><button class="btn sm" id="addOncall">+ Add an on-call window</button><span class="grow"></span><button class="btn primary sm" id="saveOncall">Save on-call windows</button></div>
  </div>
`,
    leavecap:`
  <div class="card" id="card-leavecap">
    ${cycH2("Leave capacity")}
    <div class="sub">Maximum total EFT allowed on leave on any single day. The leave planner flags days over this, and approvals warn when exceeded.</div>
    <div class="row">
      <label class="field"><span class="lbl">Max EFT on leave / day</span><input type="number" step="0.1" min="0" id="leaveCap" value="${S.leaveCapEft}" style="width:90px"></label>
      <button class="btn primary" id="saveLeaveCap">Save leave cap</button>
    </div>
  </div>
`,
    quota:`
  <div class="card" id="card-quota">
    ${cycH2("Quota &amp; fairness")}
    <div class="sub">Clinical-shift quota is counted and capped per this period (default <b>fortnight</b> — matches pay). The <b>Cycle</b> tab sets each ${ROLE()}'s total shifts for the cycle; the other tabs split it <b>evenly</b> across periods so they add up. <b>Edit any cell to adjust; clear it to revert to auto.</b></div>
    <div class="row">
      <div class="field" role="group" aria-labelledby="lbl-qpSeg"><span class="lbl" id="lbl-qpSeg">Count quota per</span>
        <div class="seg" id="qpSeg" aria-labelledby="lbl-qpSeg">
          <button data-qp="cycle" class="${S.quotaPeriod==="cycle"?"on":""}">Cycle</button>
          <button data-qp="week" class="${S.quotaPeriod==="week"?"on":""}">Week</button>
          <button data-qp="fortnight" class="${S.quotaPeriod==="fortnight"?"on":""}">Fortnight</button>
          <button data-qp="month" class="${S.quotaPeriod==="month"?"on":""}">Month</button>
        </div></div>
      <div class="field" role="group" aria-labelledby="lbl-qcSeg"><span class="lbl" id="lbl-qcSeg">Per-period cap</span>
        <div class="seg" id="qcSeg" aria-labelledby="lbl-qcSeg">
          <button data-qc="hard" class="${S.quotaCapMode==="hard"?"on":""}">Hard (block)</button>
          <button data-qc="soft" class="${S.quotaCapMode==="soft"?"on":""}">Soft (flag)</button>
          <button data-qc="off" class="${S.quotaCapMode==="off"?"on":""}">Off</button>
        </div></div>
      <div class="field" role="group" aria-labelledby="lbl-qfSeg"><span class="lbl" id="lbl-qfSeg">Uneven extra shift</span>
        <div class="seg" id="qfSeg" aria-labelledby="lbl-qfSeg">
          <button data-qf="locked" class="${S.quotaFlex?"":"on"}">Auto‑placed</button>
          <button data-qf="flex" class="${S.quotaFlex?"on":""}">Staff choose</button>
        </div></div>
    </div>
    ${featOn("cst")?`<div class="row" style="align-items:flex-end;margin-top:8px"><label class="field"><span class="lbl">${escapeHTML(cstLabel())} days per fortnight (default)</span><input type="number" min="0" step="1" id="cstDefault" value="${(cset().cstPerFortnight!=null&&cset().cstPerFortnight!=="")?cset().cstPerFortnight:""}" placeholder="none" style="width:90px"></label><span class="muted small">For anyone whose own ${escapeHTML(cstLabel())} / cycle box on the Staff tab is blank \u2014 ${cstDefaultQuota()||"no"} ${escapeHTML(cstLabel())} day${cstDefaultQuota()===1?"":"s"} this cycle. 0 in a person's box means no cap.</span></div>
    <div class="seg" id="qtSeg" style="margin-top:8px" role="group" aria-label="Which quota the table shows"><button data-qt="clinical" class="${_qtView==="cst"?"":"on"}">Clinical</button><button data-qt="cst" class="${_qtView==="cst"?"on":""}">${escapeHTML(cstLabel())}</button></div>`:""}
    ${S.quotaFlex?`<div class="note" style="margin-top:8px">${ic("scale")} <b>Flexible extra is on.</b> When a ${ROLE()}'s cycle quota doesn't divide evenly, each ${periodTag().toLowerCase()} runs at the even base, and they place the leftover shift(s) in whichever ${periodTag().toLowerCase()} suits — total still capped at their cycle quota, and they can't double up the extra. ${S.quotaCapMode!=="hard"?`<span class="muted">(This only blocks when <b>Per-period cap = Hard</b>; you're on <b>${S.quotaCapMode}</b>.)</span>`:""}</div>`:""}
    ${S.staff.length?((featOn("cst")&&_qtView==="cst")?cstQuotaTableHTML():(()=>{const isCycle=S.quotaPeriod==="cycle";const ps=cyclePeriods();
      const head=`<tr><th>${ROLEC()}</th>${isCycle?`<th class="num">Cycle quota</th>`:ps.map(p=>`<th class="num">${p.label}</th>`).join("")+`<th class="num">Cycle</th>`}</tr>`;
      const rows=rosterStaff().map(s=>{if(isCycle){return `<tr><td class="namecol">${escapeHTML(s.name)}</td><td class="num"><input type="number" min="0" class="qt-quota" data-sid="${s.id}" value="${s.quota||0}"></td></tr>`;}
        const hasOv=s.periodTargets&&Object.keys(s.periodTargets).length;
        if(S.quotaFlex&&!hasOv){ const ci=periodCapInfo(s), cell=ci.r>0?(ci.floor+"–"+ci.ceil):(""+ci.floor), pt=periodTag().toLowerCase();
          return `<tr><td class="namecol">${escapeHTML(s.name)}</td>${ps.map(()=>`<td class="num" style="color:var(--muted)" title="${ci.r>0?("Even base "+ci.floor+", up to "+ci.ceil+" if this "+pt+" carries one of the "+ci.r+" extra shift(s)"):("Even — "+ci.floor+" each "+pt)}">${cell}</td>`).join("")}<td class="num"><b>${ci.q}</b></td></tr>`; }
        const t=periodTargetsOf(s),tot=t.reduce((a,b)=>a+b,0),q=s.quota||0,off=tot!==q;
        return `<tr><td class="namecol">${escapeHTML(s.name)}</td>${t.map((v,i)=>{const ov=s.periodTargets&&s.periodTargets[i]!=null&&s.periodTargets[i]!=="";return `<td class="num"><input type="number" min="0" class="qt-cell" data-sid="${s.id}" data-pi="${i}" value="${v}" aria-label="${escapeHTML(s.name)} · ${escapeHTML((cyclePeriods()[i]||{}).label||("period "+(i+1)))}" style="${ov?"font-weight:600;color:var(--accent-ink)":""}"></td>`;}).join("")}<td class="num"><b class="qt-total" style="${off?"color:var(--danger-t)":""}" title="${off?("Periods add to "+tot+" but cycle quota is "+q):""}">${off?tot+" / "+q:tot}</b></td></tr>`;}).join("");
      const foot=isCycle?'<span class="muted small">Set the total shifts each ${ROLE()} does this cycle (auto from EFT — edit to round). The Week / Fortnight / Month tabs split it across periods.</span>'
        :(S.quotaFlex?'<span class="muted small">Each '+periodTag().toLowerCase()+' shows the base–ceiling. Staff place any leftover (uneven) shift in the '+periodTag().toLowerCase()+' that suits them. Switch <b>Uneven extra shift</b> back to <b>Auto‑placed</b> to set fixed per‑'+periodTag().toLowerCase()+' targets you can edit.</span>'
        :'<button class="btn sm" id="qtReset">Reset all to auto</button> <span class="muted small">Periods auto-split the cycle quota evenly — edit any cell; the Cycle total turns red if they stop adding up.</span>');
      return `<div style="overflow-x:auto;margin-top:6px"><table class="maptbl">${head}${rows}</table></div><div class="flexbtns" style="margin-top:8px">${foot}</div>`;
    })()):'<div class="muted small" style="margin-top:6px">Add staff to set quotas.</div>'}
  </div>
`,
    mode:`
  <div class="card" id="card-mode">
    ${cycH2("Roster mode")}
    <div class="sub">How this staff group runs its roster. Per cycle — different groups, and different cycles, can run differently.</div>
    <div class="seg" id="modeSeg">
      <button data-rm="rounds" class="${!isRolling()?"on":""}">Rounds (open → close → publish)</button>
      <button data-rm="rolling" class="${isRolling()?"on":""}">Rolling (always live)</button>
    </div>
    <div class="sub" style="margin-top:6px">${isRolling()
      ? "<b>Rolling.</b> You go live once and the roster stays live. Staff add or drop their own shifts whenever they need to — good for small teams and for groups that fill shifts as they come up. Set a booking window below if you want to limit <i>when</i> they may do that; the roster stays visible either way."
      : "<b>Rounds.</b> You release the roster, everyone books during the round, you close it and publish. Best when people should book together and fairly against the same open slots — and the only mode that supports In random groups and Take turns."}</div>
    <h2 style="margin-top:16px">Self-roster method</h2>
    <div class="sub">How shifts are claimed during self-rostering. All methods keep the guards: taken slots disappear, ${hasExtraSlots()?`extra slots open only after minimums (${unlockOrderLabel()}), `:""}and bookings respect each ${ROLE()}'s per-${S.quotaPeriod||"fortnight"} quota.</div>
    <div class="seg" id="fairSeg">
      <button data-f="guarded" class="${S.fairness==="guarded"?"on":""}">${fairnessLabel("guarded")} <span class="muted small">${fairnessTech("guarded")}</span></button>
      <button data-f="waves" class="${S.fairness==="waves"?"on":""}" ${isRolling()?'disabled title="In random groups needs a round with a start and an end — switch to Rounds mode to use it"':""}>${fairnessLabel("waves")} <span class="muted small">${fairnessTech("waves")}</span></button>
      <button data-f="snake" class="${S.fairness==="snake"?"on":""}" ${isRolling()?'disabled title="Take turns needs a round with a start and an end — switch to Rounds mode to use it"':""}>${fairnessLabel("snake")} <span class="muted small">${fairnessTech("snake")}</span></button>
      <button data-f="adjust" class="${S.fairness==="adjust"?"on":""}">${fairnessLabel("adjust")} <span class="muted small">${fairnessTech("adjust")}</span></button>
    </div>
    ${isRolling()?`<div class="muted small" style="margin-top:6px">In random groups and Take turns need a round with a start and an end — switch to Rounds mode to use them.</div>`:""}
    <div class="sub" style="margin-top:8px">
      ${S.fairness==="waves"?"<b>In random groups:</b> staff are split into random groups and each group books in turn; the order is re-drawn each cycle. Good when a few people always book first.":
        S.fairness==="adjust"?"<b>Pre-filled, then adjust:</b> you draft a fair, covered roster first, then open it so staff drop, claim and swap within their share. Best when the roster is mostly settled.":
        S.fairness==="snake"?"<b>Take turns:</b> strict turns that reverse each round, so no one is always last. Slowest, and the most even.":
        "<b>Everyone at once:</b> everyone books at the same time, first-come, within the guards. Best for small teams who trust first-come."}
    </div>
    ${S.fairness==="waves"?`<div class="row" style="margin-top:8px"><div class="field" role="group" aria-labelledby="lbl-wcSeg"><span class="lbl" id="lbl-wcSeg">Number of groups</span>
      <div class="seg" id="wcSeg" aria-labelledby="lbl-wcSeg">${[2,3,4].map(n=>`<button data-wc="${n}" class="${(S.waveCount||3)===n?"on":""}">${n}</button>`).join("")}</div></div></div>`:""}
  </div>`
  };
  const seg=`<div class="seg setupseg" id="setupSeg"><button data-st="cycle" class="${half==="cycle"?"on":""}">This cycle · ${escapeHTML(cyLabel(a))}</button><button data-st="group" class="${half==="group"?"on":""}">This staff group · ${escapeHTML(groupName())}</button></div>`;
  const body=half==="cycle"?[C.status,C.cycle,C.zones,C.cover,rulesCardHTML(),C.times,C.oncall,C.fatigue,C.leavecap,C.notice,C.quota,C.mode].join(""):[brandingCardHTML(),tagsCardHTML(),clockCardHTML(),C.cycles,C.import,(featOn("rosteron")?C.payroll:""),C.access,(featOn("marketplace")?marketCardHTML():""),capacityCardHTML(),dangerCardHTML(),clockPosterHTML()].join("");
  return `
  ${S.guideDismissed?'<div style="margin-bottom:8px"><button class="btn sm" id="guideShow">'+ic("chevR")+' Setup guide</button></div>':setupGuideHTML()}
  ${seg}${setupIndexHTML(half)}${body}`;
}
let _zt=null; function zonesSavedToast(){ markAnswered("zones"); clearTimeout(_zt); _zt=setTimeout(()=>toastSaved("cycle"),600); }
function renderZoneList(){
  const el=document.getElementById("zoneList");if(!el)return;
  el.innerHTML=S.zones.map(z=>`
    <div class="listrow" data-z="${z.id}">
      <input class="z-name" value="${escapeHTML(z.name)}" style="width:120px" placeholder="Name" aria-label="Zone name">
      <input class="z-short" value="${escapeHTML(z.short||"")}" placeholder="${escapeHTML(zoneShort(z))}" maxlength="5" style="width:64px" aria-label="Short name, up to five letters, for the phone’s month view" title="Short name for the phone’s month view (up to five letters); blank means the automatic one">
      <label><input type="checkbox" class="z-am" ${z.am?"checked":""}> AM</label>
      <label><input type="checkbox" class="z-pm" ${z.pm?"checked":""}> PM</label>
      <input class="z-pml" value="${z.pmLabel||""}" placeholder="PM label (opt)" style="width:130px" aria-label="PM label (optional)">${ocWindows(active()).some(w=>w.from&&(w.from.zones||[]).indexOf(z.id)>=0)?'<span class="tag oc" title="Set on the On-call card">carries on-call</span>':""}
      <span class="grow"></span>
      <button class="btn danger sm z-del">Remove</button>
    </div>`).join("");
  el.querySelectorAll("[data-z]").forEach(rowEl=>{
    const id=rowEl.dataset.z; const z=zoneById(id);
    rowEl.querySelector(".z-name").onchange=e=>{ocPin(active());z.name=e.target.value;save();zonesSavedToast();renderZoneList();};
    rowEl.querySelector(".z-short").onchange=e=>{ const v=String(e.target.value||"").trim().slice(0,5); if(v)z.short=v; else delete z.short; save(); zonesSavedToast(); renderZoneList(); };
    rowEl.querySelector(".z-am").onchange=e=>{z.am=e.target.checked;save();zonesSavedToast();};
    rowEl.querySelector(".z-pm").onchange=e=>{z.pm=e.target.checked;save();zonesSavedToast();render();};   // the On-call card only offers zones that run in the evening
    rowEl.querySelector(".z-pml").onchange=e=>{ocPin(active());z.pmLabel=e.target.value;save();zonesSavedToast();};
    rowEl.querySelector(".z-del").onclick=()=>{ocPin(active());rulesDropZone(active(),id);cset().zones=(cset().zones||S.zones).filter(x=>x.id!==id);S.zones=cset().zones;save();render();};
  });
}

