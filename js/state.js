"use strict";

let authUser=null, authPhone=null, authState="local", _subscribed=false, _members=[], _otpEmail="", _otpPhone="", _otpSent=false, _otpChannel="email", _authMethod="sms", _realAdmin=false; // local | login | denied | in
let _sharedDevice=false, _idleTimer=null, _idleBound=false; // "shared computer" mode = session-only login + idle auto-logout
try{ _sharedDevice = sessionStorage.getItem("myrosta_shared")==="1"; }catch(e){} // survives reload (same tab), dies on tab close
// Supabase auth-token store: shared-device -> sessionStorage (gone when tab closes); personal -> localStorage (stays signed in)
const _authStore={
  getItem:k=>{ try{ const sv=sessionStorage.getItem(k); return sv!==null?sv:localStorage.getItem(k); }catch(e){ return null; } },
  setItem:(k,v)=>{ try{ if(_sharedDevice||sessionStorage.getItem(k)!==null){ sessionStorage.setItem(k,v); localStorage.removeItem(k); } else { localStorage.setItem(k,v); } }catch(e){} },
  removeItem:k=>{ try{ sessionStorage.removeItem(k); localStorage.removeItem(k); }catch(e){} }
};
function sharedIdleMin(){ const v=parseInt((S&&S.security&&S.security.sharedIdleMin),10); return (v>0&&v<=240)?v:15; }
function resetIdle(){ if(!_sharedDevice)return; clearTimeout(_idleTimer); _idleTimer=setTimeout(()=>{ try{toast("Signed out — shared computer, idle for "+sharedIdleMin()+" min.");}catch(e){} authSignOut(); }, sharedIdleMin()*60000); }
function startIdleWatch(){ if(!_sharedDevice)return; if(!_idleBound){ ["mousedown","keydown","touchstart","scroll","click"].forEach(ev=>window.addEventListener(ev,resetIdle,{passive:true})); _idleBound=true; } resetIdle(); }
// AU mobile -> "61412345678" (digits, no +, to match Supabase's stored/JWT phone); e164 adds the +
function phoneKey(m){ let d=String(m||"").replace(/[^\d]/g,""); if(!d)return""; if(d[0]==="0")d="61"+d.slice(1); else if(d.slice(0,2)==="61"){} else if(d.length===9)d="61"+d; return d; }
function e164(m){ const k=phoneKey(m); return k?("+"+k):""; }
function staffIsAdmin(s){ if(!s)return false; const adm=(CLOUD.adminEmails||[]).map(x=>String(x).toLowerCase()); const e1=(s.email||"").toLowerCase(),e2=(s.email2||"").toLowerCase(); if(adm.indexOf(e1)>=0||adm.indexOf(e2)>=0)return true; return (_members||[]).some(m=>m.role==="admin"&&([e1,e2].indexOf(String(m.email||"").toLowerCase())>=0)); }
function resolveIdentity(email,phone){
  if(email){ const e=String(email).toLowerCase();
    if((CLOUD.adminEmails||[]).map(x=>String(x).toLowerCase()).includes(e))return "admin";
    if((_members||[]).some(m=>String(m.email||"").toLowerCase()===e && m.role==="admin"))return "admin";
    const s=S.staff.find(x=>(x.email||"").toLowerCase()===e || (x.email2||"").toLowerCase()===e); if(s)return staffIsAdmin(s)?"admin":s.id; }
  if(phone){ const pk=phoneKey(phone); if(pk){ const s=S.staff.find(x=>phoneKey(x.mobile)===pk); if(s)return staffIsAdmin(s)?"admin":s.id; } }
  return null; }
function normalize(){
  if(!S.zones||!S.staff||!S.staffing)throw new Error("incomplete state");
  if(!S.cycles){ // migrate old single-cycle shape -> multi-cycle
    const first={id:"cyc-"+Date.now(),cycle:S.cycle||{start:"2026-06-08",weeks:8},assign:S.assign||{},status:S.status||"draft",archived:false};
    const arch=(S.archive||[]).map(a=>({id:a.id,cycle:a.cycle,assign:a.assign||{},status:a.status||"published",archived:true}));
    S.cycles=[first].concat(arch); S.activeId=first.id;
    delete S.cycle; delete S.assign; delete S.status; delete S.archive;
  }
  if(!S.activeId||!S.cycles.find(c=>c.id===S.activeId))S.activeId=(S.cycles.find(c=>!c.archived)||S.cycles[0]).id;
  if(!S.messages)S.messages=[]; if(!S.notifications)S.notifications=[]; if(!S.feedback)S.feedback=[];
  if(S.notifications.length>80)S.notifications=S.notifications.slice(0,80); if(Array.isArray(S.audit)&&S.audit.length>400)S.audit=S.audit.slice(0,400);   // the document stays small: the bell keeps 80, the log 400 (16 Oct 2026)
  if(!S.requests)S.requests=[]; if(!S.leave)S.leave=[]; if(!S.audit)S.audit=[];
  if(!Array.isArray(S.outbox))S.outbox=[]; S.outbox=S.outbox.filter(m=>m&&m.id&&(m.sent?(Date.now()-Date.parse(m.sent))<30*864e5:((m.attempts||0)<3||(Date.now()-(m.ts||0))<30*864e5)));   // sent ones and dead letters fall away after a month   // messages for notify-rounds to send (invites, publish notices); sent ones fall away after a month
  if(S.leaveCapEft==null)S.leaveCapEft=3;
  if(!Array.isArray(S.publicHolidays))S.publicHolidays=[];
  if(!S.lastImport||typeof S.lastImport!=="object")S.lastImport={};   // what was last imported, per kind — shown under the Import card   // admin-marked public-holiday dates (ISO) — badge/tint across roster views
  if(!S.toughList)S.toughList={weekend:true,friPM:true,monPM:true,onCall:true,ph:true};   // what counts as a "tough shift" in the Equity tab — admin-editable
  if(S.payrollDateFmt==null)S.payrollDateFmt="DD/MM/YYYY";
  if(S.quotaPeriod==null)S.quotaPeriod="fortnight";   // cycle | week | fortnight | month — how clinical quota is counted/capped
  if(S.quotaCapMode==null)S.quotaCapMode="hard";       // hard | soft | off — whether per-period target caps booking
  if(S.quotaFlex==null)S.quotaFlex=false;               // uneven remainder: false = auto-placed (locked) | true = staff choose which period carries the extra
  if(S.waveCount==null)S.waveCount=3;                   // number of cohorts for "waves" fairness mode
  if(S.marketOn==null)S.marketOn=false;                 // open-shift marketplace (broadcast gaps + give-aways) — admin switch
  if(S.marketClaim==null)S.marketClaim="instant";       // instant = first claim wins | approve = admin confirms each claim
  if(S.marketQuotaBypass==null)S.marketQuotaBypass=true; // gap-fills may exceed quota (extra cover) after an explicit confirm
  if(S.pushOn==null)S.pushOn=false;                     // web-push to phones — admin switch (needs push-send function; PUSH-MARKETPLACE.md)
  if(!S.openShifts)S.openShifts=[];
  if(!Array.isArray(S.openSwaps))S.openSwaps=[]; if(!Array.isArray(S.swapOffers))S.swapOffers=[];   // Ask everyone: the asks, and the shifts colleagues offer back
  if(!S.board||typeof S.board!=="object")S.board={publish:false,show:[]}; S.board.publish=!!S.board.publish; if(!Array.isArray(S.board.show))S.board.show=[];   // the department board: whether this group publishes to it, and which sibling groups its booking sheet shows
  if(!S.pushSubs)S.pushSubs=[];
  if(!S.reqComments)S.reqComments=[];   // per-request conversation threads (requester + admin), union-merged
  if(!S.branding)S.branding={};                        // per-org: {name, primary, roleNoun, hospital} — absent = today's Myrosta look
  if(!S.features)S.features={};                        // per-org flags: {rosteron, equity, planner, marketplace} — absent = on
  if(!S.capBuffer)S.capBuffer={al:5,sick:2,cme:1.5};   // Capacity check: weeks/year away per person (AL, sick, CME/study) — buffer = sum/52
  if(S.capOverride==null)S.capOverride={};             // Capacity check what-ifs (eft, zones, cover, spw) — director scratch values, never affect the roster
  S.openShifts.forEach(o=>{ if((o.status==="open"||o.status==="pending")&&o.iso<iso(new Date()))o.status="expired"; });   // deterministic day-after sweep — every device agrees
  if(S.guideDismissed==null)S.guideDismissed=false;     // setup wizard shown until dismissed
  if(S.unlockOrder==null)S.unlockOrder="pmfirst";       // extra-slot unlock order: both | amfirst | pmfirst (global default for new cycles)
  // Per-cycle settings: staffing min/max + unlock order live ON the cycle so changing one cycle never re-evaluates another (e.g. retroactive gaps on a published cycle).
  const _gs=S.staffing; S.cycles.forEach(c=>{ if(!c.settings)c.settings={}; const cs=c.settings;
    if(!cs.staffing)cs.staffing={amMin:_gs.amMin,amMax:_gs.amMax,pmMin:_gs.pmMin,pmMax:_gs.pmMax};
    if(cs.unlockOrder==null)cs.unlockOrder=S.unlockOrder||"pmfirst";
    if(!cs.zones)cs.zones=(S.zones||[]).map(z=>({...z}));          // deep copy; ids preserved so existing assignments still resolve
    if(cs.fairness==null)cs.fairness=S.fairness||"snake";
    if(cs.waveCount==null)cs.waveCount=S.waveCount||3;
    if(cs.quotaPeriod==null)cs.quotaPeriod=S.quotaPeriod||"fortnight";
    if(cs.quotaCapMode==null)cs.quotaCapMode=S.quotaCapMode||"hard";
    if(cs.quotaFlex==null)cs.quotaFlex=!!S.quotaFlex;
    if(cs.leaveCapEft==null)cs.leaveCapEft=(S.leaveCapEft!=null?S.leaveCapEft:3);
  });
  hydrateCycleSettings();   // pull the active cycle's settings into the globals so all reads reflect it
  if(!S.security)S.security={}; if(S.security.sharedIdleMin==null)S.security.sharedIdleMin=15; // auto-logout minutes for "shared computer" sign-ins
  S.staff.forEach(s=>{ if(s.eft==null)s.eft=1; if(s.hrsFortnight==null)s.hrsFortnight=76; if(s.email==null)s.email=""; if(s.email2==null)s.email2=""; if(s.payrollId==null)s.payrollId=""; if(s.title==null)s.title=""; if(!s.fixedPattern)s.fixedPattern={recurrence:"weekly",A:{},B:{},committed:false}; if(!s.periodTargets)s.periodTargets={}; });
  if(!S._privacyV1){ S.staff.forEach(s=>{ s.email=""; s.payrollId=""; }); S._privacyV1=true; }   // privacy: clear work emails + payroll once (admins can re-enter; won't re-clear)
  // Per-cycle staff roles: seed every existing cycle with all current staff (in:true) carrying their current quota/EFT/hours/targets.
  S.cycles.forEach(c=>{ const seeded=!!c.roles; if(!c.roles)c.roles={}; S.staff.forEach(s=>{ if(!c.roles[s.id])c.roles[s.id]={in:!seeded,quota:s.quota||0,eft:(s.eft!=null?s.eft:1),hrsFortnight:(s.hrsFortnight!=null?s.hrsFortnight:76),periodTargets:{...(s.periodTargets||{})}}; }); });   // first-ever migration seeds everyone in; AFTER that, staff missing from a cycle stay OUT (in:false) — being added later must not retro-pollute published/past cycles
  hydrateCycleRoles();   // pull the active cycle's role fields onto the staff objects
}
function load(){ try{ S=JSON.parse(localStorage.getItem(orgKey()))||defaultState(); normalize(); }catch(e){ S=defaultState(); } applyDemoBoard(); }   // the sandbox's fictional department, if the seed left one; a no-op with the cloud on
