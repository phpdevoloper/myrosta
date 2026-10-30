"use strict";

/* ---------- rendering ---------- */
const TABS=[["setup","Settings","admin"],["staff","Staff","admin"],["roster","Roster","all"],["selfroster","Self-roster","all"],["daily","Daily","all"],["planner","Leave planner","all"],["equity","Equity","all"],["requests","Requests","all"],["my","My shifts","all"],["messages","Messages","all"],["help","Help","all"],["audit","Audit","admin"]];
const TAB_SCOPE=Object.fromEntries(TABS.map(t=>[t[0],t[2]]));
const NAV_ORDER={ staff:["my","selfroster","roster","requests","daily","planner","equity","messages","help"],
                  admin:["roster","selfroster","daily","requests","my","staff","setup","planner","equity","messages","audit","help"] };
const NAV_GROUPS={ staff:[["my","selfroster","roster","requests"],["daily","planner","equity"],["messages","help"]],
                   admin:[["roster","selfroster","daily","requests"],["my","staff","setup","planner","equity"],["messages","audit","help"]] };   // desktop strip: the day's work · the group · the quiet tail; flattened it is NAV_ORDER
const NAV_PRIMARY={ staff:["my","selfroster","roster","requests"], admin:["roster","selfroster","requests","setup"] };   // bottom bar on phones; everything else under More
const NAV_MORE_ICON={   // the More sheet's rows: one stroke icon each, in the bottom bar's style
  daily:'<svg viewBox="0 0 24 24" class="nic" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg>',
  planner:'<svg viewBox="0 0 24 24" class="nic" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
  equity:'<svg viewBox="0 0 24 24" class="nic" aria-hidden="true"><path d="M12 3v18M6 21h12M5 7h14M5 7l-3 7h6l-3-7zM19 7l-3 7h6l-3-7z"/></svg>',
  messages:'<svg viewBox="0 0 24 24" class="nic" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/></svg>',
  help:'<svg viewBox="0 0 24 24" class="nic" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/></svg>',
  audit:'<svg viewBox="0 0 24 24" class="nic" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  staff:'<svg viewBox="0 0 24 24" class="nic" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3"/></svg>' };
const NAV_PROMISE={daily:"Who's on today, by zone",planner:"The year's leave, whole team",equity:"Who's carrying the tough shifts",messages:"Your admin and the group",help:"Guide, questions, feedback",audit:"Every change, who and when",staff:"Everyone in the group and their quotas",setup:"Cover, zones, rounds, branding",my:"Your next shift and your share",roster:"The whole grid, week by week",selfroster:"Book your share",requests:"Leave and swaps"};
const NAV_PROMISE_ADMIN={messages:"Broadcasts and staff replies",my:"One person's shifts and share"};
function navPromise(id){ return (isAdmin()&&NAV_PROMISE_ADMIN[id])||NAV_PROMISE[id]||""; }
const NAV_LABELS={setup:"Settings",staff:"Staff",roster:"Roster",daily:"Day board",planner:"Leave",equity:"Fairness",requests:"Requests",my:"My shifts",messages:"Messages",help:"Help",audit:"Audit log"};
function tabLabel(id){ if(id==="selfroster") return isAdmin()?(isRolling()?"Booking":"Round"):"Book shifts"; return NAV_LABELS[id]||id; }
function navVisible(id){ if(TAB_SCOPE[id]==="admin"&&!isAdmin())return false; if(id==="equity"&&!featOn("equity"))return false; if(id==="planner"&&!featOn("planner"))return false; return true; }
function navTabs(){ return NAV_ORDER[isAdmin()?"admin":"staff"].filter(navVisible).map(id=>({id,label:tabLabel(id)})); }
function navTabGroups(){ return NAV_GROUPS[isAdmin()?"admin":"staff"].map(g=>g.filter(navVisible).map(id=>({id,label:tabLabel(id)}))).filter(g=>g.length); }
function navPrimary(){ return NAV_PRIMARY[isAdmin()?"admin":"staff"].filter(navVisible).map(id=>({id,label:tabLabel(id)})); }
function navMore(){ const p=new Set(NAV_PRIMARY[isAdmin()?"admin":"staff"]); return navTabs().filter(t=>!p.has(t.id)); }
function bottomNavHTML(){   // phones: the four primary jobs + More; desktop hides this bar and keeps the top strip
  const prim=navPrimary(); const moreIds=navMore().map(t=>t.id); const moreActive=moreIds.includes(S.tab)||_moreOpen;
  return prim.map(({id,label})=>`<button class="bn${S.tab===id&&!_moreOpen?" active":""}" data-tab="${id}" aria-current="${S.tab===id?"page":"false"}">${NIC[id]||NIC.roster}<span>${label}</span></button>`).join("")
       +`<button class="bn${moreActive?" active":""}" id="bnMore" aria-haspopup="dialog" aria-expanded="${_moreOpen?"true":"false"}">${NIC.more}<span>More</span></button>`;
}
function moreSheetHTML(){
  const rows=navMore().map(({id,label})=>`<button class="sheetrow${S.tab===id?" on":""}" data-tab="${id}">${NAV_MORE_ICON[id]||NIC[id]||NIC.roster}<span>${label}${navPromise(id)?`<span class="rowsub">${navPromise(id)}</span>`:""}</span></button>`).join("");
  const me=nameOf(S.viewAs), st=S.staff.find(x=>x.id===S.viewAs); const who=_realAdmin?"Admin":me; const sync=syncWord();
  const ini=S.viewAs==="admin"?"A":((st&&st.initials)||initialsFrom(me)||"?");
  const acct=[`<div class="sheetacct"><span class="avatar sm" aria-hidden="true">${escapeHTML(ini)}</span><div class="grow"><b><span class="vh">Signed in as </span>${escapeHTML(who)}${_realAdmin&&S.viewAs!=="admin"?` · viewing as ${escapeHTML(me)}`:""}</b><span class="rowsub">${[escapeHTML(groupName()),cloudOn()?sync:"on this device"].filter(Boolean).join(" · ")}</span></div></div>`];
  if(!cloudOn()||_realAdmin) acct.push(`<label class="sheetrow static">View as <select id="viewAsSheet"><option value="admin">Admin</option>${S.staff.map(s=>`<option value="${s.id}" ${s.id===S.viewAs?"selected":""}>${escapeHTML(s.name)}</option>`).join("")}</select></label>`);
  if(cloudOn()&&authState==="in"&&_orgCount>1) acct.push(`<button class="sheetrow" id="sheetSwitch">Switch roster ${ic("swap")}</button>`);
  acct.push(`<button class="sheetrow" id="sheetReload">Reload the app</button>`);   // the way to pick up a new build on a phone that lives on the home screen
  if(canAddGroup()) acct.push(`<button class="sheetrow" id="sheetAddGroup">Add a staff group</button>`);
  if(cloudOn()&&authState==="in") acct.push(`<button class="sheetrow" id="sheetSignOut">Sign out</button>`);
  const about=`<div class="sheetlbl">About</div><div class="sheetrow static about"><span class="rowsub">${cloudOn()?"Stored in Sydney, Australia":"Kept in this browser"}${cloudOn()&&_evOk===true?" · bookings go straight to the database · live updates "+(_rtStatus==="SUBSCRIBED"?"on":"off \u2014 checked every 45 s instead"):""} · every change is logged · build ${fmtBuild(BUILD)}</span></div><div class="sheetrow static aboutlinks"><a href="privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="support.html" target="_blank" rel="noopener">Support</a> · <a href="#" data-go="${goStr("help","","whatsnew")}">What's new</a></div>`;
  return `<div class="overlay sheetwrap" id="ovlMore"><div class="sheet" role="dialog" aria-modal="true" aria-label="More"><div class="sheetgrab"></div>${acct[0]}${rows}<div class="sheetlbl">Account</div>${acct.slice(1).join("")}${about}</div></div>`;
}
let _sheetOpener=null;
function closeSheets(){ if(_notifsOpen)markNotifsRead(S.viewAs); _moreOpen=false; _notifsOpen=false; _daySheet=null; _reqSheet=null; render(); const back=document.getElementById(_sheetOpener==="bell"?"bell":"bnMore"); if(back&&back.focus)try{back.focus();}catch(e){} _sheetOpener=null; }
document.addEventListener("keydown",e=>{ if(e.key!=="Escape")return; if(_daySheet)closeDaySheet(); else if(_reqSheet)closeReqSheet(); else if(_moreOpen||_notifsOpen)closeSheets(); });
let _acctWired=false;   // the account popover's document listeners are added once
function closeAcct(){ const ap=document.getElementById("acctPop"), ab=document.getElementById("acctBtn"); if(ap)ap.hidden=true; if(ab&&ab.setAttribute)ab.setAttribute("aria-expanded","false"); }
let _selfChange=false;   // this render follows a tap, a key or a change on THIS device — the only renders allowed to move; bgRender() and cloud pushes never set it
let _justBooked=new Set(), _inflight=new Set(), _receipt=null, _heroSeen=null, _settled=null, _syncFlash=null, _syncT1=0, _syncT2=0;   // one-shot feedback: rows that settle, buttons that are saving, the booking receipt, the hero bar's last painted share, a row that says what just happened, the sync word
["pointerdown","keydown","change"].forEach(t=>{ try{ document.addEventListener(t,()=>{ _selfChange=true; if(_settled&&_settled.shown&&!_inflight.has(_settled.key))_settled=null; },true); }catch(e){} });   // a settled row stays until the next tap
let _reqSeenTs=0, _reqSeenWho=null;   // when this viewer last left the Requests tab on this device (localStorage) — decisions after it carry a receipt line
function reqSeenLoad(){ try{ _reqSeenTs=+(localStorage.getItem(orgKey("_reqseen_"+S.viewAs))||0); }catch(e){ _reqSeenTs=0; } }
function reqSeenMark(who){ try{ localStorage.setItem(orgKey("_reqseen_"+who),String(Date.now())); }catch(e){} }
let _coldWas=false;   // the cold-load hairline was showing on the previous render
function markSVG(cls){ return `<svg class="mark${cls?" "+cls:""}" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="${PALETTE["--navy"]}"/><path d="M17 31 L17 11 L24.5 22 L32 11 L32 31" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path class="mk-am" d="M7 13 L14 13" fill="none" stroke="${PALETTE["--mark-am"]}" stroke-width="2.2" stroke-linecap="round"/><path class="mk-pm" d="M7 21 L12 21" fill="none" stroke="${PALETTE["--mark-pm"]}" stroke-width="2.2" stroke-linecap="round"/><path class="mk-cst" d="M7 29 L14 29" fill="none" stroke="${PALETTE["--mark-cst"]}" stroke-width="2.2" stroke-linecap="round"/></svg>`; }   // the brand mark: navy square, white M, the period trio as bars
function authScreen(){
  if(authState==="checking")return `<div class="cold" role="status" aria-live="polite"><div class="cold-mark">${markSVG("markbeat")}</div><div class="nextcard ghost" aria-hidden="true"><span class="gbar w40"></span><span class="gbar w70"></span></div><div class="ghost-rows" aria-hidden="true"><span class="gbar"></span><span class="gbar"></span><span class="gbar"></span></div><span class="vh">Reaching the roster server</span></div>`;
  if(authState==="pickorg"){ const groups={}; _orgChoices.forEach(o=>{ const h=o.hospital||""; (groups[h]=groups[h]||[]).push(o); });
    const gk=Object.keys(groups).sort((a,b)=>a===""?1:b===""?-1:a.localeCompare(b));
    const only=gk.length===1&&gk[0];
    return `<div class="card" style="max-width:460px;margin:24px auto">
      ${only?`<h2>${escapeHTML(only)}</h2><div class="sub">Choose your staff group.</div>`:`<h2>Choose your staff group</h2><div class="sub">Your sign-in covers more than one.</div>`}
      ${gk.map(h=>`${(!only&&h)?`<div class="sub" style="margin-top:12px"><b>${escapeHTML(h)}</b></div>`:((!only&&gk.length>1)?`<div class="sub" style="margin-top:12px"><b>Other</b></div>`:"")}<div class="flexbtns" style="flex-direction:column;gap:8px;margin-top:8px">${groups[h].map(o=>`<button class="btn primary" data-pickorg="${escapeHTML(o.org)}">${escapeHTML(o.label||o.org)}${o.role==="admin"?" · admin":""}</button>`).join("")}</div>`).join("")}
      <div class="flexbtns" style="margin-top:12px"><button class="btn sm" id="authOut">Sign out</button></div></div>`; }
  if(authState==="orgerror")return `<div class="card" style="max-width:440px;margin:24px auto"><h2>Couldn't reach the roster</h2><div class="sub">You're signed in, but we couldn't confirm which roster you belong to. This is usually a dropped connection — your data is safe and nothing has changed.</div><div class="flexbtns" style="margin-top:10px"><button class="btn primary" id="orgRetry">Try again</button><button class="btn sm" id="authOut">Sign out</button></div>${_orgError?`<div class="muted small" style="margin-top:8px">${escapeHTML(_orgError)}</div>`:""}</div>`;
  if(authState==="denied"){ const who=authUser||(authPhone?"+"+authPhone:""); return `<div class="card" style="max-width:440px;margin:24px auto"><h2>Not on the roster yet</h2><div class="sub">You're signed in as <b>${escapeHTML(who)}</b>, but that ${authPhone&&!authUser?"number":"email address"} isn't on this roster. Ask your roster admin to add it to your details in Myrosta and sync the allow-list (Settings → Access control) — then sign in again.</div><div class="flexbtns"><button class="btn" id="authOut">Sign out</button></div></div>`; }
  if(_otpSent){ const last=String(_otpPhone||"").replace(/\D/g,"").slice(-3); const dest=_otpChannel==="sms"?("Texted to \u2022\u2022\u2022 \u2022\u2022\u2022 "+escapeHTML(last)+" \u2014 it fills itself on most phones, or type it here."):("Emailed to <b>"+escapeHTML(_otpEmail)+"</b> \u2014 type it here."); return `<div class="door"><div class="door-mark">${markSVG("")}</div><h1 class="door-h">Enter your code</h1><p class="door-sub">${dest}${_sharedDevice?" <b>Shared computer:</b> you'll be signed out when you close this or after a short idle.":""}</p>
    <label class="field"><span class="vh">6-digit code</span><input type="text" class="codein" inputmode="numeric" autocomplete="one-time-code" maxlength="6" id="authCode" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022" aria-describedby="authMsg"></label><button class="btn primary wide" id="authVerify">Verify</button>
    <div class="flexbtns center"><button class="btn sm" id="authResend">Resend code</button><button class="btn sm" id="authBack">Start over</button></div>
    <div id="authMsg" class="muted small" role="status"></div></div>`; }
  const chan=`<div class="chan" role="group" aria-label="How to get your code"><button type="button" class="chanrow${_authMethod==="sms"?" on":""}" data-am="sms" aria-pressed="${_authMethod==="sms"}">${ic("phone")}<span>Text me a code<span class="rowsub">to your mobile</span></span></button><button type="button" class="chanrow${_authMethod==="email"?" on":""}" data-am="email" aria-pressed="${_authMethod==="email"}">${ic("mail")}<span>Email me a code<span class="rowsub">to your work or personal email</span></span></button></div>`;
  const body=_authMethod==="sms"
    ? `<label class="field"><span class="lbl">Mobile number</span><input type="tel" inputmode="tel" autocomplete="tel" id="authPhoneInput" placeholder="04xx xxx xxx"></label><button class="btn primary wide" id="authSend">Send code</button>`
    : `<label class="field"><span class="lbl">Email</span><input type="email" autocomplete="email" id="authEmail" placeholder="work or personal email"></label><button class="btn primary wide" id="authSend">Send code</button>`;
  const org=(S.branding&&S.branding.hospital)||_orgHospital||"";
  return `<div class="door"><div class="door-mark">${markSVG("")}</div>${org?`<div class="door-org">${escapeHTML(org)}</div>`:`<div class="door-wm">Myr<span class="accent">o</span>sta</div>`}<h1 class="door-h">Your roster, on your phone.</h1>
    ${chan}${body}
    ${(CLOUD.sso&&(CLOUD.sso.azure||CLOUD.sso.google))?`<div style="display:flex;align-items:center;gap:10px;margin:14px 0 2px"><span style="flex:1;height:1px;background:var(--line)"></span><span class="muted small">or</span><span style="flex:1;height:1px;background:var(--line)"></span></div>
    <div class="flexbtns" style="margin-top:8px">${CLOUD.sso.azure?`<button class="btn" data-sso="azure" style="flex:1">Sign in with Microsoft</button>`:""}${CLOUD.sso.google?`<button class="btn" data-sso="google" style="flex:1">Sign in with Google</button>`:""}</div>
    <div class="muted small" style="margin-top:6px">Uses your hospital/work account \u2014 same approved-staff list applies.</div>`:""}
    <p class="door-note">No password \u2014 we ${_authMethod==="sms"?"text":"email"} you a 6-digit code, then ${_sharedDevice?"we sign you out when you close this page or step away.":"you stay signed in on this "+devNoun()+"."}</p>
    <details class="sec"${_sharedDevice?" open":""}><summary>${ic("chevR")} Using a ward PC?</summary><label class="sharechk"><input type="checkbox" id="authShared" ${_sharedDevice?"checked":""}><span>This is a <b>shared or public computer</b>.<br><span class="muted">Don't keep me signed in \u2014 sign me out when I close the page or step away.</span></span></label></details>
    <div id="authMsg" class="muted small" role="status"></div>
    ${inDemo()?"":`<div class="door-foot muted small">Your roster is stored in Sydney, Australia. <a href="privacy.html" target="_blank" rel="noopener">Privacy</a><br>New here? <a href="demo.html" target="_blank" rel="noopener">Try the demo</a> · <a href="index.html" target="_blank" rel="noopener">About Myrosta</a></div>`}</div>`;
}
function wireAuth(){
  const out=document.getElementById("authOut"); if(out)out.onclick=authSignOut;
  const orgRetryBtn=document.getElementById("orgRetry"); if(orgRetryBtn)orgRetryBtn.onclick=()=>location.reload();
  document.querySelectorAll("[data-pickorg]").forEach(b=>b.onclick=()=>{ try{localStorage.setItem("myrosta_org",b.dataset.pickorg);}catch(e){} location.reload(); });
  const setMsg=t=>{const m=document.getElementById("authMsg"); if(m)m.textContent=t;};
  document.querySelectorAll("[data-am]").forEach(b=>b.onclick=()=>{ _authMethod=b.dataset.am; render(); });
  document.querySelectorAll("[data-sso]").forEach(b=>b.onclick=async()=>{ b.disabled=true; setMsg("Opening your organisation\u2019s sign-in\u2026"); const r=await authSendSSO(b.dataset.sso); if(r!==true){ b.disabled=false; setMsg(r.error||"Couldn\u2019t start single sign-on."); } });
  const shared=document.getElementById("authShared");
  if(shared)shared.onchange=()=>{ _sharedDevice=shared.checked; try{ if(_sharedDevice)sessionStorage.setItem("myrosta_shared","1"); else sessionStorage.removeItem("myrosta_shared"); }catch(e){} render(); };
  const send=document.getElementById("authSend");
  if(send)send.onclick=async()=>{ send.disabled=true; setMsg("Sending your code…"); let r;
    if(_authMethod==="sms"){ const ph=((document.getElementById("authPhoneInput")||{}).value||"").trim(); if(!ph){send.disabled=false;setMsg("Enter your mobile number.");return;} r=await authSendPhone(ph); }
    else { const em=((document.getElementById("authEmail")||{}).value||"").trim(); if(!em){send.disabled=false;setMsg("Enter your email.");return;} r=await authSendCode(em); }
    send.disabled=false; if(r===true)render(); else setMsg((r&&r.error)||"Couldn't send — check and try again."); };
  const verify=document.getElementById("authVerify");
  if(verify)verify.onclick=async()=>{ const c=(document.getElementById("authCode").value||"").trim(); if(!c)return; verify.disabled=true; setMsg("Checking…");
    const r=await authVerifyCode(c); verify.disabled=false;
    if(r!==true)setMsg((r&&r.error)||"That code didn't work — check it, or resend a new one."); };
  const cin=document.getElementById("authCode"); if(cin){cin.focus(); cin.onkeydown=e=>{ if(e.key==="Enter"){const v=document.getElementById("authVerify"); if(v)v.click();} };
    cin.oninput=()=>{ const v=(cin.value||"").trim(); if(/^\d{6}$/.test(v)&&cin.dataset.auto!==v){ cin.dataset.auto=v; const b=document.getElementById("authVerify"); if(b&&!b.disabled)b.click(); } }; }   // the sixth digit verifies by itself (once per value, so a wrong code can be corrected)
  const pin=document.getElementById("authPhoneInput"); if(pin){pin.focus(); pin.onkeydown=e=>{ if(e.key==="Enter"&&send)send.click(); };}
  const ein=document.getElementById("authEmail"); if(ein){ein.onkeydown=e=>{ if(e.key==="Enter"&&send)send.click(); };}
  const resend=document.getElementById("authResend");
  if(resend)resend.onclick=async()=>{ resend.disabled=true; setMsg("Resending…"); const r=_otpChannel==="sms"?await authSendPhone(_otpPhone):await authSendCode(_otpEmail); resend.disabled=false; setMsg(r===true?"New code sent.":((r&&r.error)||"Couldn't resend just yet — wait a moment and try again.")); };
  const back=document.getElementById("authBack");
  if(back)back.onclick=()=>{ _otpSent=false; _otpEmail=""; _otpPhone=""; render(); };
}
let _lastTab=null;
// don't re-render while the user is typing in a field (background sync/timers would wipe their input)
function bgRender(){ const ae=document.activeElement; if(ae&&(ae.tagName==="INPUT"||ae.tagName==="TEXTAREA"||ae.tagName==="SELECT")){ return; } _selfChange=false; render(); }   // a background render never animates
function render(){
  applyBranding();
  hydrateCycleSettings();   // ensure S.* reflect the active cycle's per-cycle settings before any view reads them
  hydrateCycleRoles();      // and the active cycle's per-staff quota/EFT/participation onto the staff objects
  syncPaint();
  const authMode=cloudOn()&&authState!=="in";
  { const tb=document.getElementById("topbar"), cold=authMode&&authState==="checking"; if(tb&&tb.classList){ if(cold){ tb.classList.add("loading"); _coldWas=true; } else { tb.classList.remove("loading"); if(_coldWas){ _coldWas=false; tb.classList.add("loaded"); setTimeout(()=>tb.classList.remove("loaded"),700); } } } }   // the hairline under the header grows while the roster is arriving and completes when it lands
  document.getElementById("cycleWrap").style.display=authMode?"none":"";
  document.getElementById("bell").style.display=authMode?"none":"";
  document.getElementById("viewAsWrap").style.display=authMode?"none":"";
  document.getElementById("acctWrap").style.display=authMode?"none":"";
  document.getElementById("logoutBtn").style.display=(cloudOn()&&authState==="in")?"":"none";
  document.getElementById("switchOrgBtn").style.display=(cloudOn()&&authState==="in"&&_orgCount>1)?"":"none";
  document.getElementById("addGroupBtn").style.display=canAddGroup()?"":"none";
  if(authMode){ document.getElementById("tabs").innerHTML=""; document.getElementById("bottomnav").innerHTML=""; document.getElementById("sheetRoot").innerHTML=""; _daySheet=null; _reqSheet=null; _moreOpen=false; _notifsOpen=false; closeModal(); document.getElementById("app").innerHTML=authScreen(); wireAuth(); return; }   // a session can end while a sheet or dialog is open: drop them and lift inert, or the login form cannot be focused
  try{checkRoundSchedule();}catch(e){}
  stampBuildIfNew(); if(S.tab==="help"&&whatsNewDue())devSet("seenBuild",BUILD);
  if(!inDemo()&&cloudOn()&&standaloneNow()&&/iPhone|iPad/.test(navigator.userAgent||"")&&!devGet("a2hsHome")){ devSet("a2hsHome","1"); try{ toast("Myrosta is on your Home Screen.","ok"); }catch(e){} }
  if(S.tab==="notifs"||!TAB_SCOPE[S.tab])S.tab="my";   // the old bell stored "notifs" as a tab; unknown ids land on My shifts
  if(!isAdmin() && ["setup","staff","audit"].includes(S.tab))S.tab="my";
  { const tg=navTabGroups(); document.getElementById("tabs").innerHTML=tg.map((g,gi)=>g.map(({id,label})=>`<button class="tab${S.tab===id?" active":""}${gi===tg.length-1&&tg.length>1?" quiet":""}" role="tab" aria-selected="${S.tab===id?"true":"false"}" data-tab="${id}">${label}</button>`).join("")).map((h,gi)=>(gi?`<span class="tabsep${gi===tg.length-1?" push":""}" aria-hidden="true"></span>`:"")+h).join(""); }
  try{ const _tb=document.querySelector(".topbar"); if(_tb)document.documentElement.style.setProperty("--topbar-h",_tb.offsetHeight+"px"); }catch(e){}
  document.getElementById("bottomnav").innerHTML=bottomNavHTML();
  const _sf=(()=>{ const ae=document.activeElement; if(!ae||!ae.closest||!ae.closest("#sheetRoot .sheet"))return null; const all=Array.prototype.slice.call(document.querySelectorAll("#sheetRoot .sheet button, #sheetRoot .sheet select, #sheetRoot .sheet a[href]")); return {id:ae.id||"",key:(ae.dataset&&(ae.dataset.go||ae.dataset.tab))||"",idx:all.indexOf(ae)}; })();   // where focus sat inside the sheet before this re-render (a background sync must not throw the reader back to the top)
  document.getElementById("sheetRoot").innerHTML=_daySheet?daySheetHTML(_daySheet):(_reqSheet?reqSheetHTML(_reqSheet):(_moreOpen?moreSheetHTML():(_notifsOpen?notifsSheetHTML():"")));
  { const _mo=!!document.getElementById("modalRoot").innerHTML; setInert(_mo||!!(_daySheet||_reqSheet||_moreOpen||_notifsOpen),_mo); }   // the page behind a sheet or a dialog is inert
  if(_sheetOpener&&(_moreOpen||_notifsOpen)){ const all=Array.prototype.slice.call(document.querySelectorAll("#sheetRoot .sheet button, #sheetRoot .sheet select, #sheetRoot .sheet a[href]")); let fb=null;
    if(_sf)fb=(_sf.id&&document.getElementById(_sf.id))||(_sf.key&&all.find(b=>b.dataset&&(b.dataset.go===_sf.key||b.dataset.tab===_sf.key)))||all[Math.max(0,Math.min(_sf.idx,all.length-1))]||null;   // re-render while open: put focus back where it was
    if(!fb)fb=all[0];   // first open: land on the first control
    if(fb&&fb.focus)try{fb.focus();}catch(e){} _sheetOpener=_sheetOpener==="bell"?"bell":"bnMore"; }
  if(_lastTab!==S.tab){const _at=document.querySelector("#tabs .tab.active"); if(_at&&_at.scrollIntoView)try{_at.scrollIntoView({inline:"center",block:"nearest"});}catch(_){}}
  const uc=unreadCount(S.viewAs);
  const bb=document.getElementById("bellBadge");
  bb.textContent=uc?uc:""; bb.style.display=uc?"flex":"none";
  try{ if(navigator.setAppBadge){ if(uc)navigator.setAppBadge(uc); else if(navigator.clearAppBadge)navigator.clearAppBadge(); } }catch(e){}
  const a=active();
  const cs=document.getElementById("cycleSel");
  const ordered=S.cycles.slice().sort((x,y)=>x.cycle.start<y.cycle.start?-1:1);
  cs.innerHTML=ordered.filter(c=>!draftHidden(c)||c.id===S.activeId).map(c=>`<option value="${c.id}" ${c.id===S.activeId?"selected":""}>${cyShort(c)}${c.archived?" · archived":(draftHidden(c)?" · in preparation":"")}</option>`).join("");   // staff only choose among cycles they may see
  { const st=STATUS[a.status]||{label:a.status,cls:"muted"}, cst=document.getElementById("cycleStatus"); if(cst){ cst.className="tag "+st.cls; cst.textContent=a.archived?"Archived":(draftHidden(a)?"In preparation":st.label); } }   // the chip: dates in the select, the status as a tag beside it — never truncated together
  { const me=nameOf(S.viewAs), st=S.staff.find(x=>x.id===S.viewAs), who=_realAdmin?"Admin":me, sync=syncWord();
    const ini=document.getElementById("acctInit"); if(ini)ini.textContent=S.viewAs==="admin"?"A":((st&&st.initials)||initialsFrom(me)||"?");
    const an=document.getElementById("acctName"); if(an)an.textContent=who+(_realAdmin&&S.viewAs!=="admin"?" · viewing as "+me:"");
    const asub=document.getElementById("acctSub"); if(asub)asub.textContent=[(S.branding&&S.branding.name)||_orgLabel||"",cloudOn()?sync:""].filter(Boolean).join(" · "); }
  const vw=document.getElementById("viewAsWrap");
  if(cloudOn()&&!_realAdmin){ vw.innerHTML='<span class="muted" style="font-size:var(--fs-sm)">Signed in: <b>'+escapeHTML(nameOf(S.viewAs))+'</b></span>'; }
  else{ vw.innerHTML='View as <select id="viewAs" aria-label="View as"></select>'; const va=document.getElementById("viewAs"); va.innerHTML='<option value="admin">Admin</option>'+S.staff.map(s=>`<option value="${s.id}">${escapeHTML(s.name)}</option>`).join(""); va.value=S.viewAs; }
  const app=document.getElementById("app");
  const _ae=document.activeElement, _aeKey=(_ae&&_ae!==document.body&&app.contains&&app.contains(_ae))?focusKey(_ae):null;   // where focus sat inside the page before this render rebuilds it
  reqSeenLoad();
  const _gridSame=(_lastTab===S.tab), _gsEl=_gridSame?document.querySelector(".gridscroll"):null, _gsL=_gsEl?_gsEl.scrollLeft:0, _gsT=_gsEl?_gsEl.scrollTop:0;
  try{
    let content;
    if(draftHidden(active())&&["roster","selfroster","daily","equity","my"].includes(S.tab))content=draftHiddenHTML();   // a staff member on a draft cycle sees a calm card, never a half-built roster
    else if(isAdmin()&&!S.staff.length&&["roster","selfroster","daily","equity","my","staff"].includes(S.tab))content=firstRunHTML()+(S.tab==="staff"?viewStaff():(S.tab==="daily"?viewDaily():""));   // a group with no people: the three steps, then the Staff tab's own tools
    else if(S.tab==="setup")content=viewSetup();
    else if(S.tab==="staff")content=viewStaff();
    else if(S.tab==="roster")content=(isAdmin()&&_gapsOpen?gapsPanelHTML():"")+viewRoster();
    else if(S.tab==="selfroster")content=viewSelfRoster();
    else if(S.tab==="daily")content=viewDaily();
    else if(S.tab==="equity")content=viewEquity();
    else if(S.tab==="planner")content=viewPlanner();
    else if(S.tab==="requests")content=viewRequests();
    else if(S.tab==="audit")content=viewAudit();
    else if(S.tab==="messages")content=viewMessages();
    else if(S.tab==="notifs")content=viewNotifs();
    else if(S.tab==="help")content=viewHelp();
    else content=viewMy();
    app.innerHTML=openRoundBanner()+draftPreviewNote()+content;
  }catch(e){
    console.error("view render error",e);
    app.innerHTML=`<div class="card"><h2>Couldn't open this tab</h2><pre style="white-space:pre-wrap;font-size:var(--fs-xs);color:var(--danger-t)">${escapeHTML(String(e&&e.stack||e))}</pre><button class="btn" id="hardReset">Reset all data &amp; reload</button></div>`;
  }
  try{ document.querySelectorAll(".qfill[data-from]").forEach(el=>{ const to=el.style.width; if(typeof requestAnimationFrame!=="function"||document.hidden){ el.removeAttribute("data-from"); return; } el.style.transition="none"; el.style.width=el.dataset.from+"%"; void el.offsetWidth; requestAnimationFrame(()=>{ el.style.transition=""; el.style.width=to; el.removeAttribute("data-from"); }); }); }catch(e){}   // the hero bar: paint the old share, then let the transition carry it to the new one
  try{ const _trs=document.querySelectorAll("table.roster thead tr"), _band=(_trs[0]&&_trs[0].classList&&_trs[0].classList.contains("fnrow"))?_trs[0]:null, _hr=_band?_trs[1]:_trs[0];
    document.documentElement.style.setProperty("--hd0",(_band&&_band.offsetHeight?_band.offsetHeight:0)+"px"); if(_hr&&_hr.offsetHeight)document.documentElement.style.setProperty("--hd1",_hr.offsetHeight+"px"); }catch(e){}   // the day header sticks under the measured fortnight band, the cover row under both
  if(_gridSame&&(_gsL||_gsT)){ const _g=document.querySelector(".gridscroll"); if(_g){ _g.scrollLeft=_gsL; _g.scrollTop=_gsT; } }   // keep the roster/grid scroll position across a re-render (e.g. after editing a cell)
  if(_lastTab==="requests"&&S.tab!=="requests"&&_reqSeenWho)reqSeenMark(_reqSeenWho); _reqSeenWho=S.tab==="requests"?S.viewAs:null;   // leaving Requests marks its decisions seen
  if(_lastTab!==S.tab){ _lastTab=S.tab; app.classList.remove("tabin"); void app.offsetWidth; app.classList.add("tabin"); }
  try{ document.querySelectorAll(".seg").forEach(g=>{ if(!g.getAttribute("role"))g.setAttribute("role","group"); if(g.getAttribute("role")==="group")g.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.classList.contains("on")?"true":"false")); });
       const _cs=document.getElementById("cycleSel"); if(_cs)_cs.setAttribute("aria-label","Roster cycle"); const _va=document.getElementById("viewAs"); if(_va)_va.setAttribute("aria-label","View as"); }catch(e){}   // after #app is rewritten: segmented toggles announce their state; the header selects are named
  try{ wire(); }catch(e){ console.error("wire error",e); }
  _selfChange=false; _justBooked.clear(); if(S.tab!=="selfroster")_receipt=null; if(_settled)_settled.shown=true;   // one-shot: the next render starts quiet unless a tap causes it
  { const want=_renderFocus||_aeKey; _renderFocus=null; const ae=document.activeElement; if(want&&(!ae||ae===document.body||(document.contains&&!document.contains(ae)))){ const el=document.querySelector(want); if(el&&el.focus)try{el.focus({preventScroll:true});}catch(e){ try{el.focus();}catch(e2){} } } }   // give focus back to the same control in the new markup, or to a dialog's opener after a close-then-render
}

function openRoundBanner(){   // when a self-roster round is OPEN on a cycle that isn't the one you're viewing, nudge you to it
  const cur=active(); const other=S.cycles.find(c=>c.status==="open"&&!c.archived&&c.id!==(cur&&cur.id));
  if(!other)return "";
  return `<div class="card" style="background:var(--warn);border:1px solid var(--warn-line);display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
    <span style="color:var(--ok-t);display:inline-flex">${ic("live")}</span>
    <span class="grow" style="color:var(--warn-t)"><b>Booking is open</b> for <b>${escapeHTML(cyLabel(other))}</b>${isAdmin()?".":" — pick your shifts now."}</span>
    <button class="btn sm primary" data-gocyc="${other.id}">Go to that cycle →</button></div>`;
}
function markAnswered(k){ const c=cset(); if(!c.answered)c.answered={}; c.answered[k]=true; }   // the ten-question checklist ticks on decisions, not on defaults
function toastSaved(scope){ toast("Saved for "+(scope==="group"?groupName():cyLabel(active())),"ok"); }   // every instant toggle says so, and for what
function setFatigueMode(m,n){ const cur=effFatigue(); n=n||{}; cset().fatigue={mode:m,minRest:(n.minRest!=null?n.minRest:cur.minRest),maxConsec:(n.maxConsec!=null?n.maxConsec:cur.maxConsec)}; markAnswered("fatigue"); logAudit("settings.fatigue",m+" · rest "+cur.minRest+"h · max "+cur.maxConsec+" days · "+cyLabel(active()),"admin"); save(); toastSaved("cycle"); }
function confirmDanger(v){ return String(v||"").trim().toLowerCase()===String(groupName()).trim().toLowerCase(); }
function resetNow(){ S=defaultState(); try{normalize();}catch(e){} gapsOn=false;dailyDate=null;plannerMonth=null;myPerson=null;replyTo=null;swapPeer=null;lastEmail=null; _gapsOpen=false; _moreOpen=false; _notifsOpen=false; _fpReport=null; _staffOpen.clear(); _fpOpen.clear(); _staffQuery=""; _staffFilter="all"; _staffTag=""; _secOpen=null; _hlStaff=null; _srPick=[]; _srHours={}; _hrForm=null; _srPickSid=null; window._range=null; save(); render(); }
function openDangerModal(){ const g=escapeHTML(groupName()); const root=document.getElementById("modalRoot");
  openDialog(`<div class="overlay" id="ovlDanger"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h3 id="dlgT">Delete all data for ${g}?</h3>
    <div class="muted small" style="margin:6px 0 12px">Deletes the staff list, every cycle and shift, leave, requests, messages, notifications and the audit log for this group. People keep their sign-in, but the group is left empty. There is no undo.</div>
    <label class="field">Type <b>${g}</b> to confirm<input id="dangerType" autocomplete="off"></label>
    <div class="flexbtns" style="margin-top:14px"><span class="grow"></span><button class="btn" id="dangerCancel">Cancel</button><button class="btn danger" id="dangerGo" disabled>Delete everything</button></div></div></div>`);
  const inp=document.getElementById("dangerType"), go_=document.getElementById("dangerGo");
  inp.oninput=()=>{ go_.disabled=!confirmDanger(inp.value); }; inp.focus();
  document.getElementById("dangerCancel").onclick=closeModal; root.querySelector("#ovlDanger").onclick=e=>{ if(e.target.id==="ovlDanger")closeModal(); };
  go_.onclick=()=>{ if(!confirmDanger(inp.value))return; closeModal(); logAudit("org.reset","all data deleted for "+groupName(),"admin"); resetNow(); }; }
function logStatus(cyc,e){ const log=cyc.statusLog||[]; if(e.by==="schedule"&&log.some(x=>x.by==="schedule"&&x.to===e.to&&x.ts===e.ts))return; cyc.statusLog=log.concat([e]).slice(-24); }   // one writer for the receipts; a scheduled flip is keyed by the window's own time so racing clients write one entry
function applyStatus(to){ if(active().status===to)return false; setCycleStatus(to); render(); return true; }   // the UI's only path: a transition that already happened (a push under an open dialog) is not repeated
function setCycleStatus(to){   // the one status transition: schedule override, the two broadcast alerts, audit, save
  const a=active(); if(a.archived){ toast("This cycle is archived — restore it in Settings → Cycles first."); return {ok:false,reason:"archived"}; } a.status=to;
  if(to==="open"){ const w=a.window; if(w&&w.enabled&&roundPhase(a).phase!=="open"){ w.enabled=false; logAudit("selfroster.schedule","schedule cleared — admin opened manually outside the window","admin"); } }   // manual open overrides a stale/closed schedule so staff can actually book
  if(to==="closed"||to==="draft"){ const w=a.window; if(w&&w.enabled&&roundPhase(a).phase==="open"){ w.enabled=false; w.fired="closed"; logAudit("selfroster.schedule","schedule ended — admin closed booking inside the window","admin"); } }   // and a manual close ends an open window, so no phone treats the round as open on the window's say-so (17 Oct 2026)
  if(to==="published")notify("all",isRolling()?("Roster "+cyLabel(a)+" is live — add your shifts any time."):("Roster "+cyLabel(a)+" is published."),null,{tab:"my",cycle:a.id});
  if(to==="open")notify("all","Booking is open for "+cyLabel(a)+".",null,{tab:"selfroster",cycle:a.id});
  let sent=0; if(to==="published"&&cloudOn()&&!a.publishNotifiedTs){ const lbl=hospitalGroupLabel(), body=lbl+": the roster for "+cyShort(a)+" is "+(isRolling()?"live":"published")+" in Myrosta. See your shifts: myrosta.com.au";
    rosterStaff().forEach(s=>{ const c=contactOf(s); if(!c.phone&&!c.email)return; S.outbox.push({id:"pub-"+a.id+"-"+s.id,kind:"publish",sid:s.id,phone:c.phone,email:c.email,subject:lbl+" — roster published",body:c.phone?gsm(body):body,ts:Date.now(),sent:null}); sent++; }); a.publishNotifiedTs=Date.now(); }   // deterministic ids: two admins publishing at once queue one message per person
  logStatus(a,{to,ts:Date.now(),by:S.viewAs,notified:(to==="open"||to==="published")?S.staff.length:0,sent});   // the receipt: who moved it, when, how many were told, how many messages were queued
  logAudit("cycle.status",cyLabel(a)+" → "+to,"admin"); save(); return {ok:true}; }
function statusVerb(to){ const r=isRolling(); return {open:"Open booking",closed:"Close booking",published:r?"Go live":"Publish",draft:r?"Take offline":"Back to draft"}[to]||"Confirm"; }   // the dialog's action word = the button that asked
function statusReceipts(cyc){   // what each done step says: the entries since the last return to draft
  const log=(cyc&&cyc.statusLog)||[]; let from=0; log.forEach((e,i)=>{ if(e.to==="draft")from=i+1; }); const out={};
  log.slice(from).forEach(e=>{ if(e.to==="draft")return; const when=schFmt(new Date(e.ts).toISOString()), r=isRolling(cyc);
    const verb=(e.to==="open"?"Booking opened":(e.to==="closed"?"Booking closed":(r?"Live since":"Published")))+(e.by==="schedule"?" on schedule":"");
    out[e.to]=verb+" "+when+(e.notified?" · "+e.notified+" notified":"")+(e.sent?" · "+e.sent+" queued by text or email":""); });
  if(roundWaiting(cyc))Object.keys(out).forEach(k=>{ out[k]="Earlier this cycle · "+out[k]; });   // a round waiting to open again: what happened before is history, not the state of this step
  return out; }
function receiptHTML(text){ return text?`<div class="rreceipt">${ic("check")}<span>${escapeHTML(text)}</span></div>`:""; }
function statusConfirmText(to){   // only the transitions that message everyone ask first — and say so
  const n=S.staff.length, who=(groupName()||"this group")+" ("+n+" "+(n===1?"person":"people")+")";
  if(to==="open"){ const w=active().window, stale=w&&w.enabled&&roundPhase(active()).phase!=="open"; return "Open booking for "+cyLabel(active())+"?\n\nEveryone in "+who+" will be notified."+(stale?"\n\nThe saved schedule for this cycle will be switched off.":""); }
  if(to==="draft"&&cloudOn()&&active().status!=="draft")return (isRolling()?"Take ":"Take ")+cyLabel(active())+" back to draft?\n\nStaff stop seeing it until you "+(isRolling()?"go live":"open booking or publish")+" again. No one is notified.";
  const how=cloudOn()&&!active().publishNotifiedTs?" in the app and by text or email":"";
  if(to==="published")return isRolling()?("Go live with "+cyLabel(active())+"?\n\nEveryone in "+who+" will be notified"+how+" — staff can add and drop shifts from now on."):("Publish "+cyLabel(active())+"?\n\nEveryone in "+who+" will be notified"+how+" and the roster becomes the record.");
  return null; }
function statusActions(){
  const map=isRolling()?{
    draft:[["published","Go live","primary"]],
    open:[["published","Go live","primary"],["draft","Back to draft",""]],
    closed:[["published","Go live","primary"],["draft","Back to draft",""]],
    published:[["draft","Take offline / edit",""]]
  }:{
    draft:[["open","Open booking","primary"],["published","Publish without booking",""]],
    open:[["closed","Close booking","primary"],["draft","Back to draft",""]],
    closed:[["published","Publish","primary"],["open","Reopen booking",""],["draft","Back to draft",""]],
    published:[["draft","Unpublish / edit",""]]
  };
  return (map[active().status]||[]).map(([to,l,c])=>`<button class="btn ${c} sm" data-status="${to}">${l}</button>`).join("");
}
