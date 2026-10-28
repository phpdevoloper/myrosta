"use strict";

/* ----- auth (cloud only) ----- */
function domainOk(email){ const list=(CLOUD.allowedDomains||[]).map(d=>String(d).toLowerCase().trim()).filter(Boolean); if(!list.length)return true; const e=String(email).toLowerCase().trim(); const dom=(e.split("@")[1]||""); return list.some(x=> x.indexOf("@")>=0 ? e===x : (dom===x||dom.endsWith("."+x)) ); }
async function authSendCode(email){
  if(!domainOk(email)){ return {error:"Sign-in is restricted to: "+CLOUD.allowedDomains.join(", ")}; }
  try{ const {error}=await _sb.auth.signInWithOtp({email:email,options:{shouldCreateUser:true}}); if(error)throw error; _otpEmail=email; _otpChannel="email"; _otpSent=true; return true; }
  catch(e){ return {error:(e&&e.message)||"Couldn't send the code."}; } }
async function authSendPhone(phone){
  const e=e164(phone); if(!e||e.length<11){ return {error:"Enter a valid Australian mobile, e.g. 0412 345 678."}; }
  try{ const {error}=await _sb.auth.signInWithOtp({phone:e,options:{shouldCreateUser:true}}); if(error)throw error; _otpPhone=phone; _otpChannel="sms"; _otpSent=true; return true; }
  catch(err){ return {error:(err&&err.message)||"Couldn't send the text — check the number, or try email."}; } }
async function authSendSSO(provider){
  try{ const {error}=await _sb.auth.signInWithOAuth({provider:provider,options:{redirectTo:window.location.origin+window.location.pathname,scopes:"email"}});
    if(error)throw error; return true; }   // browser redirects to the provider; on return, detectSessionInUrl + onAuthStateChange run the normal allow-list flow
  catch(e){ return {error:(e&&e.message)||"Couldn\u2019t start single sign-on."}; } }
async function authVerifyCode(code){
  try{ const tok=String(code).replace(/\s/g,""); const args=_otpChannel==="sms"?{phone:e164(_otpPhone),token:tok,type:"sms"}:{email:_otpEmail,token:tok,type:"email"}; const {error}=await _sb.auth.verifyOtp(args); if(error)throw error; return true; }
  catch(e){ return {error:(e&&e.message)||"That code didn't work."}; } }
async function cloudMembersLoad(){ try{ let q=_sb.from("roster_members").select("email,role,name,phone"); if(!_legacyDb)q=q.eq("org",_org); const {data,error}=await q; if(error)throw error; _members=data||[]; }catch(e){ console.error("membersLoad",e); _members=[]; } return _members; }
async function cloudMemberAdd(email,role,name){ if(!domainOk(email)){toast("That email isn't an allowed domain.");return;} const _row={email:String(email).toLowerCase(),role:role||"staff",name:name||""}; if(!_legacyDb)_row.org=_org; const {error}=await _sb.from("roster_members").upsert(_row); if(error){toast(error.message);return;} await cloudMembersLoad(); render(); }
async function cloudMemberSetRole(email,role,name){ const _row={email:String(email).toLowerCase(),role:role,name:name||""}; if(!_legacyDb)_row.org=_org; const {error}=await _sb.from("roster_members").upsert(_row); if(error){toast(error.message);return;} await cloudMembersLoad(); render(); }
async function cloudMemberRemove(email){ let _d=_sb.from("roster_members").delete().eq("email",String(email).toLowerCase()); if(!_legacyDb)_d=_d.eq("org",_org); const {error}=await _d; if(error){toast(error.message);return;} await cloudMembersLoad(); render(); }
async function cloudMembersSync(){
  await cloudMembersLoad();   // read the current allow-list first so manual "Make admin" promotions aren't lost
  const existingRole={}; (_members||[]).forEach(m=>{ const k=String(m.email||"").toLowerCase().trim(); if(k)existingRole[k]=m.role||"staff"; });
  const roleFor=k=>existingRole[k]==="admin"?"admin":"staff";   // keep an existing admin; never auto-demote on Sync
  const map={}; (CLOUD.adminEmails||[]).forEach(e=>{const k=String(e||"").toLowerCase().trim(); if(k)map[k]={email:k,role:"admin",name:"Admin",phone:null};});
  const skipped=[];
  S.staff.forEach(s=>{ const pk=phoneKey(s.mobile)||null; const emails=[s.email,s.email2].map(e=>String(e||"").toLowerCase().trim()).filter(Boolean);
    if(emails.length){ emails.forEach(k=>{ if(map[k]){ if(s.name)map[k].name=s.name; if(pk)map[k].phone=pk; } else map[k]={email:k,role:roleFor(k),name:s.name||"",phone:pk}; }); }
    else if(pk){ const k=pk+"@sms.local"; if(!map[k])map[k]={email:k,role:roleFor(k),name:s.name||"",phone:pk}; }   // mobile-only: synthetic key so RLS can match their SMS sign-in by phone
    else { skipped.push(s.name||"(unnamed)"); }   // no email AND no mobile -> can't sign in at all
  });
  const rows=Object.values(map); if(!rows.length){toast("Nothing to sync yet — add an email or mobile to your staff (Staff tab), or set adminEmails in config.");return;}
  if(!_legacyDb)rows.forEach(r=>{r.org=_org;}); const {error}=await _sb.from("roster_members").upsert(rows); if(error){toast(error.message+(/phone/i.test(error.message)?"\n\nRun the SMS migration SQL in Supabase first (adds the phone column).":""));return;}
  await cloudMembersLoad(); const withPh=rows.filter(r=>r.phone).length;
  let msg="Allow-list synced — "+rows.length+" can reach the database ("+withPh+" set up for SMS sign-in).";
  if(skipped.length)msg+="\n\n"+skipped.length+" not synced — no email or mobile: "+skipped.slice(0,6).join(", ")+(skipped.length>6?" +"+(skipped.length-6)+" more":"")+".\nAdd a mobile or email in the Staff tab, then Sync again.";
  toast(msg); render(); }
async function authSignOut(){ clearTimeout(_idleTimer); if(_sharedDevice){try{localStorage.removeItem(orgKey());localStorage.removeItem(orgKey("_dirty"));localStorage.removeItem(orgKey("_base"));sessionStorage.removeItem("myrosta_shared");}catch(e){}} try{ await _sb.auth.signOut(); }catch(e){} authUser=null; authPhone=null; authState="login"; _subscribed=false; _otpSent=false; _otpEmail=""; _otpPhone=""; window.location.href="index.html"; }
let _authChain=Promise.resolve(), _authBusy=false, _authKey=null;   // sign-in events run one at a time, in order, and a session already loaded is not loaded again
function authKeyOf(session){ try{ return session?String(session.access_token||(session.user&&session.user.id)||""):""; }catch(e){ return ""; } }   // a refreshed token is a new key, so a token refresh still re-enters (that is how a group switched in another tab is noticed)
function handleAuth(session){   // supabase fires INITIAL_SESSION and getSession() answers for the same session at boot: two runs at once once saved a plain empty group over the one the first run had just named (SWIFT, 17 Sep 2026)
  const run=()=>{ _authBusy=true; return _handleAuth(session).catch(e=>{ console.error("handleAuth",e); }).then(()=>{ _authBusy=false; }); };
  const p=_authBusy?_authChain.then(run):run(); _authChain=p; return p; }
async function _handleAuth(session){
  if(!session){ _authKey=null; authState="login"; authUser=null; render(); return; }
  const key=authKeyOf(session); if(key&&key===_authKey&&authState==="in")return;   // this very session is already loaded: the second of boot's two events, or a repeat
  _authKey=key;
  const _fresh=_otpSent; _otpSent=false; authUser=session.user&&session.user.email; authPhone=session.user&&session.user.phone;
  if(!(await resolveOrg()))return;   // multi-org: pick/resolve BEFORE loading any data; renders the picker or denied screen itself
  if(_tabOrg&&_tabOrg!==_org){ clearTimeout(_cloudTimer); _savePending=false; location.reload(); return; }   // another tab switched groups mid-life (e.g. token refresh re-entry): reload rather than mix orgs
  _tabOrg=_org;
  const _liveTab=S.tab; let _devTab=null; try{ _devTab=(JSON.parse(localStorage.getItem(orgKey())||"null")||{}).tab||null; }catch(x){}   // this device's own tab — the cloud blob carries the last saver's
  try{ const remote=await cloudLoad(); if(remote){ const _hadPriv=!!remote._privacyV1;
      let _dirty=false,_storedBase=null,_cachedBlob=null; try{_dirty=localStorage.getItem(orgKey("_dirty"))==="1";_storedBase=localStorage.getItem(orgKey("_base"))||null;_cachedBlob=localStorage.getItem(orgKey());}catch(x){}
      if(_dirty&&_storedBase&&_cachedBlob){ try{ load(); _remoteBase=_storedBase; S=mergeOnto(remote); }catch(x){ console.error("boot merge",x); S=remote; }   // offline edits from last session: merge them onto the fresh remote instead of discarding
        _remoteBase=_snap(remote); _keepBase(); ocLostToast(); _savePending=true; clearTimeout(_cloudTimer); _cloudTimer=setTimeout(cloudSave,600); }
      else S=remote;
      try{normalize();}catch(e){ S=defaultState(); } if(groupFirstLoad()){ try{await cloudSave();}catch(_){} } if(!_hadPriv){ try{await cloudSave();}catch(_){} } } else { load(); groupFirstLoad(); await cloudSave(); } cloudState="connected"; try{localStorage.setItem(orgKey(),JSON.stringify(S));}catch(x){} }
  catch(e){ console.error("cloudLoad after auth",e); cloudState="error";
    // never continue with whatever was boot-loaded before the org was resolved — on a multi-group
    // device that can be ANOTHER group's cache. Use this org's own cache, or stop at a retry card.
    let _cached=null; try{ _cached=localStorage.getItem(orgKey()); }catch(x){}
    if(!_cached){ _orgError="Couldn't load this group's roster — connection problem."; authState="orgerror"; render(); return; }
    try{ load(); }catch(x){} }
  await cloudMembersLoad();
  const id=resolveIdentity(authUser,authPhone);
  if(!id){ authState="denied"; render(); return; }
  if(!_fresh&&!devGet("a2hsHome"))devSet("a2hsHome","1");   // a restored session is not a first launch from the Home Screen — stamp silently, so only a fresh install hears the toast
  S.viewAs=id; _realAdmin=(id==="admin"); if(!_realAdmin&&draftHidden(active())){ const l=staffLandingCycle(); if(l)S.activeId=l.id; }   // staff land on the cycle they may see, not the last saver's draft
  S.tab=(authState==="in")?_liveTab:landingTab(id,_devTab||S.tab); authState="in"; safeRenderInit(); clockApplyURL(); goApplyURL(); startIdleWatch(); if(!_subscribed){ cloudSubscribe(); _subscribed=true; } }
function ROLE(){ const r=(S.branding&&S.branding.roleNoun)||"consultant"; return r; }                       // singular, lower-case: consultant | nurse | doctor | scribe | staff member
function ROLES(){ const r=ROLE(); return /s$/.test(r)?r:r+"s"; }                                                // plural
function ROLEC(){ const r=ROLE(); return r.charAt(0).toUpperCase()+r.slice(1); }
function ROLESC(){ const r=ROLES(); return r.charAt(0).toUpperCase()+r.slice(1); }                              // Capitalised plural                                 // Capitalised singular
function featOn(k){ const f=S.features||{}; return f[k]!==false; }                                               // flags default ON; absent = on
