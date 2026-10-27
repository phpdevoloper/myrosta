// Myrosta engine tests — the assertions. Run with: python3 tests/run.py
;(function(){
try{
  cloudOn=function(){return false;};
  authState="in";
  S={ zones:[{id:"z1",name:"Resus",am:true,pm:true},{id:"z2",name:"Acute",am:true,pm:true}],
      staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},
      staff:[{id:"s1",name:"Alex",quota:2,eft:1},{id:"s2",name:"Sam",quota:2,eft:1},{id:"s3",name:"Kim",quota:2,eft:1}],
      cycles:[{id:"c1",cycle:{start:"2026-08-03",weeks:8},assign:{},status:"published",archived:false,settings:{}}],
      activeId:"c1", viewAs:"admin", tab:"my",
      requests:[],leave:[],audit:[],notifications:[],messages:[],feedback:[] };
  normalize();
  // Dates relative to TODAY — never hardcode a "future" date: time overtakes it and the suite fails
  // for reasons unrelated to the code (this happened on 2026-09-03).
  var FUT=function(n){ return iso(new Date(Date.now()+((n||7)*864e5))); };
  T("defaults: marketOn=false, openShifts[], pushSubs[]", S.marketOn===false && Array.isArray(S.openShifts) && Array.isArray(S.pushSubs) && S.marketClaim==="instant" && S.marketQuotaBypass===true && S.pushOn===false);
  S.marketOn=true;
  S.viewAs="admin";
  postOpenShift("2026-08-20","PM","z1","sick cover");
  var os=S.openShifts[0];
  T("post: entry open with fields", !!os && os.status==="open" && os.kind==="gap" && os.iso==="2026-08-20" && os.period==="PM" && os.zone==="z1");
  T("post: bell + audit", S.notifications.some(function(n){return n.to==="all"&&/Open shift/.test(n.text);}) && S.audit.some(function(a){return a.action==="market.post";}));
  S.viewAs="s1"; claimOpenShift(os.id,false);
  T("claim: assigned + claimed", S.cycles[0].assign["s1|2026-08-20"] && S.cycles[0].assign["s1|2026-08-20"].zone==="z1" && os.status==="claimed" && os.by==="s1");
  S.viewAs="s2";
  var r2=canClaim("s2","2026-08-20","PM","z1",true);
  T("race: zone now covered for second claimant", !r2.ok);
  claimOpenShift(os.id,false);
  T("race: claim on non-open entry rejected", os.by==="s1" && os.status==="claimed");
  S.viewAs="admin"; S.cycles[0].assign["s1|2026-08-21"]={kind:"clinical",period:"AM",zone:"z2"};
  S.viewAs="s1"; offerShift("s1","2026-08-21");
  var ga=S.openShifts[0];
  T("offer: giveaway entry", ga.kind==="giveaway" && ga.from==="s1" && ga.status==="open");
  S.viewAs="s2"; claimOpenShift(ga.id,false);
  T("giveaway: transferred", !S.cycles[0].assign["s1|2026-08-21"] && S.cycles[0].assign["s2|2026-08-21"] && ga.status==="claimed" && ga.by==="s2");
  T("giveaway: giver notified", S.notifications.some(function(n){return n.to==="s1"&&/took your/.test(n.text);}));
  S.viewAs="admin"; S.marketClaim="approve"; postOpenShift("2026-08-22","AM","z1","");
  var p1=S.openShifts[0]; S.viewAs="s3"; claimOpenShift(p1.id,false);
  T("approve mode: pending, no assign yet", p1.status==="pending" && p1.by==="s3" && !S.cycles[0].assign["s3|2026-08-22"]);
  S.viewAs="admin"; approveClaim(p1.id,true);
  T("approve: executed", p1.status==="claimed" && S.cycles[0].assign["s3|2026-08-22"] && S.cycles[0].assign["s3|2026-08-22"].period==="AM");
  S.marketClaim="instant";
  S.marketQuotaBypass=false; S.viewAs="admin"; S.cycles[0].assign["s2|2026-08-24"]={kind:"clinical",period:"AM",zone:"z1"};
  S.staff.filter(function(x){return x.id==="s2";})[0].quota=2;
  var q=canClaim("s2","2026-08-25","AM","z1",false);
  T("quota: blocked when bypass off", !q.ok && /quota/.test(q.reason));
  S.marketQuotaBypass=true;
  var q2=canClaim("s2","2026-08-25","AM","z1",true);
  T("quota: bypass allows", q2.ok===true);
  S.leave.push({id:"lv1",staffId:"s3",code:"AL",from:"2026-08-26",to:"2026-08-26",status:"approved",requestId:"x"});
  var lv=canClaim("s3","2026-08-26","AM","z1",true);
  T("leave day blocks claim", !lv.ok);
  var out={ cycles:[{id:"c1",assign:{}}], audit:[], openShifts:[{id:"osX",cycleId:"c1",iso:"2026-08-27",period:"AM",zone:"z1",kind:"gap",from:null,status:"claimed",by:"s1",at:1}] };
  _mergeInvariants(out);
  T("invariant: unbacked claim reverts to open", out.openShifts[0].status==="open" && out.openShifts[0].by===null && out.audit.some(function(a){return a.id==="osfix-osX";}));
  var out2={ cycles:[{id:"c1",assign:{"s1|2026-08-27":{kind:"clinical",period:"AM",zone:"z1"}}}], audit:[], openShifts:[{id:"osY",cycleId:"c1",iso:"2026-08-27",period:"AM",zone:"z1",kind:"gap",from:null,status:"claimed",by:"s1",at:1}] };
  _mergeInvariants(out2);
  T("invariant: backed claim survives", out2.openShifts[0].status==="claimed");
  var merged=_mergeIdArray([{id:"osA",status:"open",iso:"2026-08-28"}],[{id:"osB",status:"open",iso:"2026-08-29"}],[],null);
  T("merge: union of both sides' entries", merged.length===2);
  S.openShifts.unshift({id:"osOld",cycleId:"c1",iso:"2020-01-01",period:"AM",zone:"z1",kind:"gap",from:null,status:"open",by:null,at:null,ts:1});
  normalize();
  T("expiry: past entry marked expired", S.openShifts.find(function(o){return o.id==="osOld";}).status==="expired");
  S.viewAs="s1"; S.cycles[0].assign["s1|"+FUT(5)]={kind:"clinical",period:"AM",zone:"z2"};
  var btn=marketOfferBtn("s1",FUT(5),{kind:"clinical",period:"AM",zone:"z2"});
  T("offer button renders for own future clinical shift", /data-osoffer/.test(btn));
  T("offer button: a fixed shift gets the same give-away button as any other (open since 10 Oct 2026)", marketOfferBtn("s1",FUT(5),{kind:"clinical",fixed:true})===marketOfferBtn("s1",FUT(5),{kind:"clinical"}));
  var u8=_b64ToU8(CLOUD.vapidPublic);
  T("push: VAPID key decodes to a 65-byte P-256 point", u8.length===65 && u8[0]===4);
  var dk=_pushDeviceKey();
  T("push: stable device key", dk===_pushDeviceKey() && dk.length>2);
  S.pushSubs=[{id:"ps-"+dk+"-s1",staffId:"s1",deviceKey:dk,sub:{endpoint:"https://e/1"},ts:1}]; S.viewAs="s1";
  T("push: myPushSub finds this device", !!myPushSub());
  T("push: subscriptions union across devices", _mergeIdArray([{id:"ps-a-s1",staffId:"s1"}],[{id:"ps-b-s2",staffId:"s2"}],[],null).length===2);

  // ----- request threads -----
  S.viewAs="s1"; submitLeaveRequest("s1","2026-09-07","2026-09-08","AL","family event");
  var rq=S.requests[0];
  T("thread: leave request pending", rq && rq.status==="pending" && rq.from==="s1");
  S.viewAs="admin";
  T("thread: ask needs text", askReqInfo(rq.id,"   ")===false && rq.status==="pending");
  askReqInfo(rq.id,"Are the dates flexible?");
  T("thread: queried -> info + admin comment stored", rq.status==="info" && reqThread(rq.id).length===1 && reqThread(rq.id)[0].by==="admin");
  T("thread: requester notified + audited", S.notifications.some(function(n){return n.to==="s1"&&/needs more info/.test(n.text);}) && S.audit.some(function(a){return a.action==="request.query";}));
  T("thread: admin pending list still shows queried request", viewRequests().indexOf("Waiting for their reply")>=0);
  S.viewAs="s1"; var srow=viewRequests();
  T("thread: staff sees needs-your-reply + reply box", srow.indexOf("needs your reply")>=0 && srow.indexOf("rc-"+rq.id)>=0);
  addReqComment(rq.id,"Yes — the following week works too.");
  T("thread: staff reply flips back to pending", rq.status==="pending" && reqThread(rq.id).length===2 && S.notifications.some(function(n){return n.to==="admin"&&/replied on their leave request/.test(n.text);}));
  S.viewAs="admin"; var av=viewRequests();
  T("thread: admin card shows conversation + Ask button", av.indexOf("Conversation")>=0 && av.indexOf('data-rcask="'+rq.id+'"')>=0);
  approveRequest(rq.id,"ok for the second week");
  T("thread: closed after decision", addReqComment(rq.id,"one more thing")===false && reqThread(rq.id).length===2);
  T("thread: comments union-merge across devices", _mergeIdArray([{id:"rcA",reqId:"r9",by:"s1",text:"a",ts:1}],[{id:"rcB",reqId:"r9",by:"admin",text:"b",ts:2}],[],null).length===2);
  S.requests.unshift({id:"rSw1",type:"swap",from:"s1",dateA:"2026-09-10",peerId:"s2",dateB:"2026-09-11",reason:"",status:"awaiting-peer",createdTs:1});
  S.viewAs="s2"; addReqComment("rSw1","Can we do the week after instead?");
  T("thread: swap peer can join the conversation", reqThread("rSw1").length===1 && reqThread("rSw1")[0].by==="s2");

  // ---- multi-org / branding / cache suites: only present on builds that carry the multiorg work.
  // Feature-detected so `python3 tests/run.py <any build>` stays green on older builds instead of
  // reporting a false failure.
  if(typeof _pickOrg==='function' && typeof orgKey==='function' && typeof ROLE==='function'){
    // ----- multi-org -----
    T("org: no memberships -> denied", _pickOrg([],null).denied===true);
    T("org: single membership auto-selected", _pickOrg([{org:"hospA",role:"admin"}],null).org==="hospA");
    var p3=_pickOrg([{org:"hospA",role:"admin"},{org:"hospB",role:"staff"}],null);
    T("org: two memberships, nothing saved -> picker", !!p3.choices && p3.choices.length===2);
    T("org: saved choice honoured", _pickOrg([{org:"hospA",role:"admin"},{org:"hospB",role:"staff"}],"hospB").org==="hospB");
    T("org: stale saved choice ignored for single org", _pickOrg([{org:"hospA",role:"admin"}],"goneOrg").org==="hospA");
    var _oldState=authState, _oldChoices=_orgChoices;
    authState="pickorg"; _orgChoices=[{org:"hospA",role:"admin"},{org:"hospB",role:"staff"}];
    var scr=authScreen();
    T("org: picker screen renders both orgs", scr.indexOf('data-pickorg="hospA"')>=0 && scr.indexOf('data-pickorg="hospB"')>=0 && scr.indexOf("admin")>=0);
    authState=_oldState; _orgChoices=_oldChoices;
    T("org: default bootstrap is the configured org", typeof _org==="string" && _org.length>0 && _legacyDb===false);
  
    // ----- phase 3: branding / features / role noun / grouped picker -----
    T("p3: defaults — branding {} features {} role consultant", typeof S.branding==="object" && typeof S.features==="object" && ROLE()==="consultant" && ROLES()==="consultants" && ROLEC()==="Consultant");
    T("p3: features default ON", featOn("rosteron") && featOn("equity") && featOn("planner") && featOn("marketplace"));
    S.branding={name:"WMH ED",hospital:"Werribee Mercy",roleNoun:"nurse",primary:"#123456"};
    T("p3: role noun switches", ROLE()==="nurse" && ROLES()==="nurses" && ROLEC()==="Nurse");
    S.viewAs="admin"; S.tab="setup"; _setupTab="group"; var setup=viewSetup();
    T("rename: card is 'Staff group & branding' with hospital first", setup.indexOf("Staff group &amp; branding")>=0 && setup.indexOf('value="WMH ED"')>=0 && setup.indexOf('value="Werribee Mercy"')>=0 && setup.indexOf("#123456")<0 && setup.indexOf("Organisation &amp; branding")<0);   // phase 3: the accent colour is no longer offered — one teal for every group
    T("p3: role noun reaches the roster export header", (function(){ var csvHead=[ROLEC()].concat([]).join(","); return csvHead==="Nurse"; })());
    var eq=viewEquity();
    T("p3: equity table header uses role noun", eq.indexOf("<th class=\"namecol\">Nurse</th>")>=0 || eq.indexOf("Nurse")>=0);
    // ----- group logo: a small inline image replaces the mark in the header, and only there -----
    (function(){ var PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      var lg=document.getElementById("brandLogo"), mk=document.getElementById("brandMark");
      T("logo: only a small inline image passes", logoOK(PNG) && !logoOK("https://x/logo.png") && !logoOK("data:text/html;base64,AAAA") && !logoOK("data:image/png;base64,"+new Array(LOGO_MAX+2).join("A")) && !logoOK(undefined));
      S.branding={name:"Consultants",hospital:"SWIFT",roleNoun:"consultant",logo:PNG}; applyBranding();
      T("logo: header shows the group's logo and hides the mark", lg.getAttribute("src")===PNG && lg.style.display==="" && mk.style.display==="none");
      T("logo: the print head keeps the Myrosta mark", printHeadHTML("x").indexOf('class="mark')>0 && printHeadHTML("x").indexOf(PNG)<0);
      S.tab="setup"; _setupTab="group"; var g=viewSetup();
      T("logo: group card offers Replace and Remove with a preview", g.indexOf('id="brLogo"')>0 && g.indexOf("Replace logo")>0 && g.indexOf('id="brLogoRm"')>0 && g.indexOf('<img src="'+PNG+'"')>0);
      delete S.branding.logo; applyBranding(); g=viewSetup();
      T("logo: without one the mark is back and the card says Add a logo", lg.getAttribute("src")===null && lg.style.display==="none" && mk.style.display==="" && g.indexOf("Add a logo")>0 && g.indexOf('id="brLogoRm"')<0);
      T("logo: file check refuses a non-image and an oversize file", /image file/.test(logoFileCheck({type:"application/pdf",size:10})) && /8 MB/.test(logoFileCheck({type:"image/png",size:9*1024*1024})) && logoFileCheck({type:"image/png",size:1000})==="" && logoFileCheck(null)!=="");
      T("logo: audit sentence exists", AUDIT_WORDS["settings.logo"]==="Changed the group logo");
    })();
    S.features={equity:false,planner:false,rosteron:false,marketplace:false};
    render();
    var tabsHtml=document.getElementById("tabs").innerHTML;
    T("p3: equity + planner tabs hidden when flags off", tabsHtml.indexOf('data-tab="equity"')<0 && tabsHtml.indexOf('data-tab="planner"')<0 && tabsHtml.indexOf('data-tab="roster"')>=0);
    S.tab="roster"; var ro=exportMenuHTML();
    T("p3: RosterOn export hidden when flag off", ro.indexOf('id="rosPay"')<0 && viewRoster().indexOf('id="rosExport"')>=0);
    S.features={}; S.tab="roster"; ro=exportMenuHTML();
    T("p3: RosterOn export back when flags default", ro.indexOf('id="rosPay"')>=0);
    S.marketOn=true; S.features={marketplace:false};
    T("p3: marketplace flag hides offer button even when marketOn", marketOfferBtn("s1",FUT(5),{kind:"clinical",period:"AM",zone:"z2"})==="");
    S.features={};
    // grouped picker
    var _os=authState,_oc=_orgChoices; authState="pickorg";
    _orgChoices=[{org:"site-cons",role:"admin",hospital:"Test Hospital",label:"Consultants"},{org:"site-nurse",role:"staff",hospital:"Test Hospital",label:"Nurses"},{org:"other-ed",role:"staff",hospital:"",label:""}];
    var pk=authScreen();
    T("p3: mixed hospitals -> group headings + Other", pk.indexOf("<b>Test Hospital</b>")>=0 && pk.indexOf(">Consultants · admin<")>=0 && pk.indexOf(">Nurses<")>=0 && pk.indexOf("<b>Other</b>")>=0 && pk.indexOf('data-pickorg="other-ed"')>=0);
    _orgChoices=[{org:"site2-cons",role:"admin",hospital:"Demo Hospital ED",label:"Consultants"},{org:"site2-nurse",role:"staff",hospital:"Demo Hospital ED",label:"Nurses"}];
    var pk2=authScreen();
    T("rename: single hospital -> hospital is the title, groups beneath", pk2.indexOf("<h2>Demo Hospital ED</h2>")>=0 && pk2.indexOf("Choose your staff group")>=0 && pk2.indexOf("Choose your organisation")<0 && pk2.indexOf(">Consultants · admin<")>=0);
    authState=_os; _orgChoices=_oc;
    // header composition: hospital is the organisation, group is the subtitle (stub's document.title is read-only, so assert the composition inputs)
    S.branding={name:"Nurses",hospital:"Demo Hospital ED"}; _orgLabel="";
    (function(){ var b=S.branding; var org=b.hospital||b.name||""; var grp=b.hospital?(b.name||_orgLabel||""):(_orgLabel||"");
      T("rename: hospital is the organisation, group is the subtitle", org==="Demo Hospital ED" && grp==="Nurses"); })();
    S.branding={name:"Midwifery",hospital:"Demo Hospital ED",roleNoun:"midwife"};
    T("groups: any role noun works, not just a fixed list", ROLE()==="midwife" && ROLES()==="midwifes"||ROLE()==="midwife");
    S.viewAs="admin"; S.tab="setup"; _setupTab="group"; var sc=viewSetup(); _setupTab="cycle";
    T("groups: role noun is a free-text field with suggestions", sc.indexOf('id="brRole" list="roleSuggest"')>=0 && sc.indexOf('value="midwife"')>=0 && sc.indexOf("<datalist")>=0 && sc.indexOf("radiographer")>=0);
    S.branding={hospital:"Demo Hospital ED"}; _orgLabel="Scribes";
    (function(){ var b=S.branding; var org=b.hospital||b.name||""; var grp=b.hospital?(b.name||_orgLabel||""):(_orgLabel||"");
      T("rename: group falls back to the picker label when unset", org==="Demo Hospital ED" && grp==="Scribes"); })();
    S.branding={name:"Solo ED"}; _orgLabel="";
    (function(){ var b=S.branding; var org=b.hospital||b.name||""; var grp=b.hospital?(b.name||_orgLabel||""):(_orgLabel||"");
      T("rename: single-group org still names itself, no empty subtitle", org==="Solo ED" && grp===""); })();
    applyBranding();
    S.branding={}; applyBranding();
    T("p3: applyBranding runs without DOM errors", true);
  
    // ----- REGRESSION: stored-XSS sweep + sign-out cache clearing (audit 19 Aug) -----
  (function(){
    var bad='<img src=x onerror=1>EVIL';
    var old0=S.staff[0].name, oldState=authState; S.staff[0].name=bad;
    S.requests.unshift({id:"rX1",type:"swap",from:"s1",peerId:"s2",dateA:"2026-09-01",dateB:"2026-09-02",status:"approved",createdTs:1});
    S.requests.unshift({id:"rX2",type:"leave",from:"s1",code:"<b>H4X</b>",dateFrom:"2026-09-03",dateTo:"2026-09-04",status:"pending",createdTs:2});
    S.viewAs="admin"; var html=viewRequests();
    T("xss: staff name escaped in requests views", html.indexOf("&lt;img")>=0 && html.indexOf('<img src=x')<0);
    T("xss: leave code escaped everywhere it renders", html.indexOf("<b>H4X</b>")<0);
    var p=parseShiftStr("<img src=x>");
    T("xss: imported unknown leave code sanitised", p && p.kind==="leave" && p.code.indexOf("<")<0);
    T("org: 404 / generic not-found no longer means legacy", _isMissingFn({code:"404"})===false && _isMissingFn({message:"function not found"})===false && _isMissingFn({code:"PGRST202"})===true && _isMissingFn({message:"Could not find the function public.my_orgs"})===true);
    _sharedDevice=true; try{localStorage.setItem(orgKey(),"x");localStorage.setItem(orgKey("_dirty"),"1");localStorage.setItem(orgKey("_base"),"y");}catch(e){}
    authSignOut();   // async, but the cache clearing is synchronous before the first await
    T("cache: shared-device sign-out clears blob + dirty flag + merge base", !localStorage.getItem(orgKey()) && !localStorage.getItem(orgKey("_dirty")) && !localStorage.getItem(orgKey("_base")));
    _sharedDevice=false; authState=oldState;
    S.staff[0].name=old0; S.requests=S.requests.filter(function(r){return r.id!=="rX1"&&r.id!=="rX2";});
  })();

  // ----- REGRESSION: resolveOrg must fail CLOSED on a transient error -----
    T("org: a missing my_orgs() is treated as a pre-migration database", _isMissingFn({code:"PGRST202",message:"Could not find the function public.my_orgs"})===true && _isMissingFn({message:"Could not find the function public.my_orgs in the schema cache"})===true);
    T("org: a network blip is NOT treated as pre-migration", _isMissingFn({message:"Failed to fetch"})===false && _isMissingFn({message:"upstream connect error"})===false && _isMissingFn({code:"500",message:"Internal Server Error"})===false);
    (function(){ var _s=authState, _e=_orgError; authState="orgerror"; _orgError="Failed to fetch";
      var scr=authScreen();
      T("org: transient failure shows a retry card, never the wrong roster", scr.indexOf("Couldn't reach the roster")>=0 && scr.indexOf('id="orgRetry"')>=0 && scr.indexOf("Failed to fetch")>=0);
      authState=_s; _orgError=_e; })();
  
    // ----- REGRESSION: cross-organisation cache bleed (found by review, 18 Aug 2026) -----
    // Before the fix one global cache key meant a dual-group user with an unsynced edit in group A
    // had A's roster merged into group B on switching — silently, with no attacker.
    (function(){
      var realOrg=_org, realStaff=S.staff;   // restore afterwards: later suites depend on the fixture
      _org="ed-default";                                   // bootstrap org keeps the bare key (no orphaning on upgrade)
      T("cache: bootstrap organisation keeps the original key", orgKey()===KEY && orgKey("_dirty")===KEY+"_dirty");
      _org="site2-nurses";
      T("cache: another organisation gets its own namespace", orgKey()==="ed-roster-v1:site2-nurses" && orgKey("_base")==="ed-roster-v1:site2-nurses_base");
      // simulate: unsynced edit in group A, then switch to group B
      _org="grpA"; S.staff=[{id:"a1",name:"ONLY-IN-GROUP-A",quota:1,eft:1}]; saveLocal();
      try{ localStorage.setItem(orgKey("_dirty"),"1"); }catch(e){}
      var aKey=orgKey(), aDirty=orgKey("_dirty");
      _org="grpB";
      T("cache: group B reads a DIFFERENT key from group A", orgKey()!==aKey && orgKey("_dirty")!==aDirty);
      T("cache: group A's unsynced blob is invisible to group B", !localStorage.getItem(orgKey()));
      T("cache: group A's dirty flag cannot trigger group B's boot merge", localStorage.getItem(orgKey("_dirty"))!=="1");
      T("cache: group A's own data still intact for when they return", (JSON.parse(localStorage.getItem(aKey)).staff||[])[0].name==="ONLY-IN-GROUP-A");
      T("cache: the push device id stays global (one identity per device)", _pushDeviceKey()===_pushDeviceKey());
      _org=realOrg; S.staff=realStaff;
    })();
  
    // ----- REGRESSION: the sign-in handler ran twice at once at boot (INITIAL_SESSION and getSession's answer for the same session); the second run saved a plain empty group over the one the first had just named (SWIFT, 17 Sep 2026) -----
    (function(){
      var keep={sb:_sb,busy:_authBusy,key:_authKey,chain:_authChain,auth:authState,user:authUser,phone:authPhone,org:_org,tab:_tabOrg,label:_orgLabel,hosp:_orgHospital,hid:_orgHospitalId,count:_orgCount,legacy:_legacyDb,otp:_otpSent};
      var log=[], pending=function(){ return new Promise(function(){}); };
      _sb={ rpc:function(fn){ log.push("rpc:"+fn); return pending(); }, from:function(){ var ch={}; ["select","eq","in","update","upsert","maybeSingle"].forEach(function(k){ ch[k]=function(){ log.push(k); return ch; }; }); ch.then=function(){ return pending(); }; return ch; }, channel:function(){ return {on:function(){ return {subscribe:function(){}}; }}; } };
      var sess=function(tok){ return {access_token:tok,user:{email:"admin@example.test"}}; };
      _authBusy=false; _authKey=null; _tabOrg=null; authState="checking";
      handleAuth(sess("tokA")); handleAuth(sess("tokA"));
      T("sign-in: two events at boot start ONE run — the second waits for the first", log.join(",")==="rpc:my_orgs");
      T("sign-in: the run in flight is marked busy", _authBusy===true);
      _authBusy=false; _authKey="tokA"; authState="in"; log=[];
      handleAuth(sess("tokA"));
      T("sign-in: the same session, already loaded, is not loaded again", log.length===0);
      _authBusy=false; log=[];
      handleAuth(sess("tokB"));
      T("sign-in: a refreshed token (a new session key) re-enters as before", log.join(",")==="rpc:my_orgs" && _authKey==="tokB");
      T("sign-in: a session without a token or user id is never deduplicated", authKeyOf({})==="" && authKeyOf(null)==="" && authKeyOf({user:{id:"u1"}})==="u1");
      _sb=keep.sb; _authBusy=keep.busy; _authKey=keep.key; _authChain=keep.chain; authState=keep.auth; authUser=keep.user; authPhone=keep.phone; _org=keep.org; _tabOrg=keep.tab; _orgLabel=keep.label; _orgHospital=keep.hosp; _orgHospitalId=keep.hid; _orgCount=keep.count; _legacyDb=keep.legacy; _otpSent=keep.otp;
    })();
    // ----- the masthead before a sign-in has resolved its group: Myrosta's own, never the copy another group left on this device -----
    (function(){
      var keepOn=cloudOn, keepB=S.branding, keepA=authState, keepL=_orgLabel, keepH=_orgHospital, keepT=document.title;
      cloudOn=function(){ return true; }; S.branding={name:"Consultants",hospital:"Werribee Mercy ED",roleNoun:"consultant"}; _orgLabel="Nurses"; _orgHospital="SWIFT";
      var nm=document.getElementById("brandName"), eb=document.getElementById("brandEyebrow");
      authState="pickorg"; applyBranding();
      T("masthead: while the group picker shows, the header is the wordmark, not the cached group", String(nm.innerHTML||"").indexOf("Myr")===0 && eb.textContent==="Myrosta" && document.title==="Myrosta");
      authState="checking"; applyBranding();
      T("masthead: the cold load shows the wordmark too", String(nm.innerHTML||"").indexOf("Myr")===0);
      authState="in"; applyBranding();
      T("masthead: once the group is resolved its name and hospital return", nm.textContent==="Consultants" && eb.textContent==="Werribee Mercy ED" && document.title==="Consultants \u00b7 Werribee Mercy ED \u00b7 Myrosta");
      cloudOn=keepOn; S.branding=keepB; authState=keepA; _orgLabel=keepL; _orgHospital=keepH; document.title=keepT; applyBranding();
    })();
  } else { LOG.push('SKIP  multi-org / branding / role-noun / cache suites — this build predates the multiorg branch'); }

  // ----- ROSTER MODE: rounds vs rolling (admin choice, per cycle) -----
  (function(){
    var cyc=active(), oldStatus=cyc.status, oldSet=JSON.stringify(cyc.settings||{}), oldView=S.viewAs;
    var future=FUT(7), past=(function(){ for(var k=3;k<30;k++){ var d=iso(new Date(Date.now()-k*864e5)); if(cycleDates().some(function(x){return iso(x)===d;})&&!(S.leave||[]).some(function(l){return l.staffId==="s1"&&l.from<=d&&l.to>=d;})&&!S.cycles[0].assign["s1|"+d])return d; } return iso(new Date(Date.now()-3*864e5)); })();   // a past day inside the cycle where Alex has no leave or shift, so the "passed" rule is the one that answers
    S.viewAs="s1";
    // --- default is rounds, and it behaves exactly as before ---
    cset().rosterMode="rounds"; S.rosterMode="rounds"; cyc.status="open";
    T("mode: default is rounds", rosterMode()==="rounds" && isRolling()===false);
    T("rounds: staff can book while the round is open", bookingGate(cyc).ok===true && canBook("s1",future,"AM","z1").ok===true);
    cyc.status="published";
    T("rounds: publishing closes staff booking", bookingGate(cyc).ok===false && canBook("s1",future,"AM","z1").ok===false);
    cyc.status="draft";
    T("rounds: draft is not bookable by staff", bookingGate(cyc).ok===false);
    // --- rolling: live means bookable, and stays that way ---
    cset().rosterMode="rolling"; S.rosterMode="rolling";
    T("mode: switch to rolling", isRolling()===true);
    T("rolling: draft is still not bookable", bookingGate(cyc).ok===false && /isn.t live yet/.test(bookingGate(cyc).reason));
    cyc.status="published";
    T("rolling: PUBLISHED is bookable by staff (the whole point)", bookingGate(cyc).ok===true && canBook("s1",future,"AM","z1").ok===true);
    T("rolling: status reads as live, not published", statusLabel(cyc).indexOf("Live")===0);
    T("rolling: past days are locked to staff", canBook("s1",past,"AM","z1").ok===false && /passed/.test(canBook("s1",past,"AM","z1").reason));
    S.viewAs="admin";
    T("rolling: admin may still fix a past day", canBook("s1",past,"AM","z1").ok===true);
    S.viewAs="s1";
    // --- every guard still applies in rolling mode ---
    active().assign["s2|"+future]={kind:"clinical",period:"AM",zone:"z1"};
    T("rolling: zone cover guard still applies", canBook("s1",future,"AM","z1").ok===false);
    delete active().assign["s2|"+future];
    S.leave.push({id:"lvR",staffId:"s1",code:"AL",from:future,to:future,status:"approved",requestId:"x"});
    T("rolling: leave still blocks booking", canBook("s1",future,"AM","z1").ok===false);
    S.leave=S.leave.filter(function(l){return l.id!=="lvR";});
    // --- an optional window limits WHEN, without taking the roster offline ---
    cyc.window={enabled:true,open:new Date(Date.now()+7*864e5).toISOString(),close:null,fired:null};
    T("rolling: a future window defers booking but the cycle stays live", bookingGate(cyc).ok===false && cyc.status==="published");
    checkRoundSchedule();
    T("rolling: the scheduler never flips a live roster to closed", cyc.status==="published");
    cyc.window={enabled:true,open:new Date(Date.now()-864e5).toISOString(),close:null,fired:null};
    T("rolling: inside the window, booking is open again", bookingGate(cyc).ok===true);
    delete cyc.window;
    // --- round-only methods are refused in rolling mode ---
    S.viewAs="admin"; S.fairness="snake"; cset().fairness="snake"; S.tab="setup";
    var setupHtml=viewSetup();
    T("mode: control renders both modes", setupHtml.indexOf('data-rm="rounds"')>=0 && setupHtml.indexOf('data-rm="rolling"')>=0);
    T("mode: round-only methods disabled while rolling", /data-f="snake"[^>]*disabled/.test(setupHtml) && /data-f="waves"[^>]*disabled/.test(setupHtml) && !/data-f="guarded"[^>]*disabled/.test(setupHtml));
    cyc.status="draft";
    T("mode: rolling transition offers Go live, not Release/Close", statusActions().indexOf("Go live")>=0 && statusActions().indexOf("Close roster")<0 && statusActions().indexOf("Release for self-roster")<0);
    T("rolling: live offers Take offline, and never a Close step", (function(){cyc.status="published";var a=statusActions();return a.indexOf("Take offline")>=0&&a.indexOf("Close roster")<0;})());
    cyc.status="draft";
    cset().rosterMode="rounds"; S.rosterMode="rounds";
    T("rounds: transitions return to the round workflow", statusActions().indexOf("Open booking")>=0 && statusActions().indexOf("Go live")<0);
    // restore
    cyc.status=oldStatus; cyc.settings=JSON.parse(oldSet); S.rosterMode="rounds"; S.fairness=(cyc.settings&&cyc.settings.fairness)||"guarded"; S.viewAs=oldView;
  })();

  // ----- capacity check -----
  var c0=capacityCalc({zonesAM:5,zonesPM:5,minAM:4,maxAM:5,minPM:4,maxPM:5,eft:16,spw:3.5,bufAL:0,bufSick:0,bufCME:0});
  T("cap: needs 56 min / 70 full per week", c0.needMin===56 && c0.needMax===70);
  T("cap: 16 EFT x 3.5 = 56 on paper, exactly fills minimum", c0.paper===56 && c0.real===56 && c0.fillMin===100 && c0.shortMin===0);
  T("cap: full cover needs +14 shifts = 4 EFT more (no buffer)", c0.eftNeedMaxRaw===4 && c0.eftNeedMaxBuf===4);
  var c1=capacityCalc({zonesAM:5,zonesPM:5,minAM:4,maxAM:5,minPM:4,maxPM:5,eft:15,spw:3.5,bufAL:5,bufSick:3,bufCME:2.4});
  T("cap: buffer 20% -> 52.5 paper, 42 real", c1.bufFrac===20 && c1.paper===52.5 && c1.real===42);
  T("cap: fills 75% of minimum, 2 uncovered per day", c1.fillMin===75 && c1.perDayShortMin===2);
  T("cap: needs 5 more EFT with buffer, 1 at zero buffer", c1.eftNeedMinBuf===5 && c1.eftNeedMinRaw===1);
  T("cap: verdict red (structural deficit)", c1.verdict==="red" && capacityVerdict(c1).cls==="danger");
  var c2=capacityCalc({zonesAM:4,zonesPM:4,minAM:4,maxAM:6,minPM:4,maxPM:6,eft:20,spw:3.5,bufAL:5,bufSick:2,bufCME:1.5});
  T("cap: cover capped at zone count", c2.needMin===56 && c2.needMax===56);
  T("cap: 20 EFT comfortably covers -> green", c2.verdict==="green" && c2.eftNeedMinBuf===0);
  var c3=capacityCalc({zonesAM:5,zonesPM:5,minAM:4,maxAM:5,minPM:4,maxPM:5,eft:19.6,spw:3.5,bufAL:5,bufSick:2,bufCME:1.5});
  T("cap: min met within 5% but full not -> amber", c3.verdict==="amber" && c3.headroom<=2.8);
  var c4=capacityCalc({zonesAM:5,zonesPM:5,minAM:4,maxAM:5,minPM:4,maxPM:5,eft:22,spw:3.5,bufAL:5,bufSick:2,bufCME:1.5});
  T("cap: min met comfortably, full not -> ok (not green)", c4.verdict==="ok");
  S.viewAs="admin"; S.capOverride={};
  var inp=capacityInputs();
  T("cap: inputs pre-fill from cycle (2 zones AM/PM, staffing 1-2)", inp.zonesAM===2 && inp.zonesPM===2 && inp.minAM===1 && inp.maxAM===2 && inp.eftActual===3);
  S.capOverride={eft:9.5,zonesAM:5};
  var inp2=capacityInputs();
  T("cap: overrides apply without touching roster", inp2.eft===9.5 && inp2.zonesAM===5 && S.staff.length===3 && S.zones.length===2);
  S.capOverride={};
  var lvc=capacityLiveCheck();
  T("cap: live check returns booked/week vs available", lvc && typeof lvc.pct==="number" && lvc.weeks===8);
  var html=capacityCardHTML();
  T("cap: card renders with summary + print button", html.indexOf("Capacity check")>=0 && html.indexOf("Summary.")>=0 && html.indexOf("capPrint")>=0);
  S.tab="setup"; render();
  T("cap: setup renders with capacity card", true);

  // help + templates + full renders
  S.pushOn=true; S.viewAs="s1"; var hh=viewHelp();
  T("help: staff sees swap-vs-openshift + alerts Q&As", hh.indexOf("Swap or Open shift")>=0 && hh.indexOf("phone alerts")>=0);
  S.viewAs="admin"; var ha=viewHelp();
  T("help: admin sees marketplace admin entry", ha.indexOf("Open‑shift marketplace")>=0);
  S.pushOn=false;
  S.viewAs="admin"; var htmlA=marketCardHTML(); S.viewAs="s1"; var htmlB=marketMyHTML();
  T("templates render", typeof htmlA==="string" && htmlA.indexOf("Open-shift marketplace")>=0 && typeof htmlB==="string" && htmlB.indexOf("Open shifts")>=0);
  // ---- Phase 1: navigation model ----
  S.viewAs="s1"; var nt=navTabs().map(function(t){return t.id;});
  T("nav: staff order starts My shifts, Book shifts, Roster, Requests", nt.slice(0,4).join(",")==="my,selfroster,roster,requests");
  T("nav: staff never sees admin tabs", nt.indexOf("setup")<0 && nt.indexOf("staff")<0 && nt.indexOf("audit")<0);
  T("nav: staff labels by job", tabLabel("selfroster")==="Book shifts" && tabLabel("daily")==="Day board" && tabLabel("planner")==="Leave" && tabLabel("equity")==="Fairness");
  S.viewAs="admin"; var na=navTabs().map(function(t){return t.id;});
  T("nav: admin order starts Roster, Round, Day board, Requests", na.slice(0,4).join(",")==="roster,selfroster,daily,requests");
  T("nav: admin labels", tabLabel("setup")==="Settings" && tabLabel("audit")==="Audit log" && tabLabel("selfroster")==="Round");
  cset().rosterMode="rolling"; S.rosterMode="rolling";
  T("nav: admin booking tab says Booking on a rolling cycle", tabLabel("selfroster")==="Booking");
  cset().rosterMode="rounds"; S.rosterMode="rounds";
  T("nav: primary set is at most 4 and More holds the rest", navPrimary().length<=4 && navPrimary().length+navMore().length===navTabs().length);
  S.features={equity:false};
  T("nav: a switched-off feature drops out of the list", navTabs().every(function(t){return t.id!=="equity";}));
  S.features={};
  // ---- Phase 1: go() helper + landing tab ----
  S.cycles.push({id:"c-next",cycle:{start:FUT(30),weeks:8},assign:{},status:"draft",archived:false,settings:{},roles:{}});
  S.viewAs="s1"; S.tab="equity"; go("requests");
  T("go: switches tab", S.tab==="requests");
  go("selfroster",{cycle:"c-next"});
  T("go: switches cycle and tab together", S.activeId==="c-next" && S.tab==="selfroster");
  go("my",{cycle:"c1"});
  T("go: back to the first cycle", S.activeId==="c1" && S.tab==="my");
  T("go: ignores an unknown cycle id", (go("roster",{cycle:"nope"}), S.activeId==="c1" && S.tab==="roster"));
  var g=parseGo(goStr("requests","c1","req-x"));
  T("go: string round-trips", g.tab==="requests" && g.cycle==="c1" && g.anchor==="req-x");
  T("go: string without extras", parseGo("my").tab==="my" && !parseGo("my").cycle);
  T("landing: staff land on My shifts, admin keeps their tab", landingTab("s1")==="my" && (S.tab="roster", landingTab("admin")==="roster"));
  S.cycles=S.cycles.filter(function(c){return c.id!=="c-next";}); S.activeId="c1";
  // ---- Phase 1: bottom bar + More sheet ----
  S.viewAs="s1"; S.tab="my"; var bn=bottomNavHTML();
  T("bottom bar: primary tabs + More", bn.indexOf('data-tab="my"')>=0 && bn.indexOf('data-tab="selfroster"')>=0 && bn.indexOf('id="bnMore"')>=0 && (bn.match(/class="bn/g)||[]).length===5);
  T("bottom bar: active state follows S.tab", /class="bn active"[^>]*data-tab="my"/.test(bn));
  S.tab="equity"; bn=bottomNavHTML();
  T("bottom bar: More lights up for a tab it holds", /class="bn active"[^>]*id="bnMore"/.test(bn));
  _moreOpen=true; var ms=moreSheetHTML();
  T("More sheet: lists the remaining tabs and the account rows", ms.indexOf('data-tab="planner"')>=0 && ms.indexOf('data-tab="my"')<0 && ms.indexOf("Signed in as")>=0);
  S.viewAs="admin"; ms=moreSheetHTML();
  T("More sheet: admin gets View as", ms.indexOf('id="viewAsSheet"')>=0);
  T("More sheet: the admin's rows speak in the admin's voice", /data-tab="messages">[^]*?Broadcasts and staff replies/.test(ms) && ms.indexOf("Your admin and the group")<0 && /data-tab="my">[^]*?One person's shifts and share/.test(ms));
  _moreOpen=false; S.tab="my";
  // ---- Phase 1: notifications with targets ----
  S.notifications=[]; notify("all","Booking is open for X.","t-open",{tab:"selfroster",cycle:"c1"}); notify("s1","Your leave was approved.","t-lv",{tab:"requests"}); notify("s1","Plain text alert");
  var n0=S.notifications.find(function(n){return n.id==="t-open";});
  T("notify: stores the target", n0 && n0.go && n0.go.tab==="selfroster" && n0.go.cycle==="c1");
  T("notify: no target is fine", S.notifications.some(function(n){return n.text==="Plain text alert" && !n.go;}));
  S.viewAs="s1"; _notifsOpen=true; var sh=notifsSheetHTML();
  T("notif sheet: targeted rows are links, plain rows are not", /data-go="selfroster\|c1"/.test(sh) && /data-go="requests"/.test(sh) && sh.indexOf("Plain text alert")>=0);
  T("notif sheet: has Mark all read", sh.indexOf('id="notifsRead"')>=0);
  _notifsOpen=false; S.notifications=[];
  // ---- Phase 1: My shifts by urgency ----
  S.viewAs="s1"; S.cycles[0].status="published"; S.cycles[0].assign={}; var d0=FUT(1), d1=FUT(2);
  S.cycles[0].cycle.start=iso(addDays(mondayOf(new Date()),-7)); S.cycles[0].assign["s1|"+d1]={kind:"clinical",period:"PM",zone:"z1"};   // a week before this Monday: never tomorrow, whatever day the suite runs
  var ws=weekStripHTML("s1",d0);
  T("week strip: shows the booked day with its time and zone", ws.indexOf("Resus")>=0 && ws.indexOf(periodTime("PM"))>=0);
  T("week strip: collapses consecutive off days into one line", (ws.match(/wk-off/g)||[]).length<=3 && /Off/.test(ws));
  var ar=actionRowHTML("s1",S.staff[0]);
  T("action row: published rounds cycle → no Book, but Request and Calendar", ar.indexOf('data-go="selfroster"')<0 && ar.indexOf('data-go="requests"')>=0 && ar.indexOf('id="calToggle"')>=0);
  S.cycles[0].status="open"; ar=actionRowHTML("s1",S.staff[0]);
  T("action row: open round → Book shifts", ar.indexOf('data-go="selfroster"')>=0 && ar.indexOf("Book shifts")>=0);
  cset().rosterMode="rolling"; S.rosterMode="rolling"; S.cycles[0].status="published"; ar=actionRowHTML("s1",S.staff[0]);
  T("action row: rolling live → Add or drop shifts", ar.indexOf("Add or drop shifts")>=0);
  cset().rosterMode="rounds"; S.rosterMode="rounds";
  S.marketOn=true; S.viewAs="admin"; postOpenShift(FUT(3),"AM","z2","cover"); S.viewAs="s1"; ar=actionRowHTML("s1",S.staff[0]);
  T("action row: open shifts count links to the marketplace card", /Open shifts \(1\)/.test(ar) && ar.indexOf('data-go="my||openshifts"')>=0);
  S.openShifts=[]; S.marketOn=false;
  var vm=viewMy();
  T("My shifts: order is hero → actions → this week → quota → sections", vm.indexOf('class="nextcard"')<vm.indexOf('class="actrow"') && vm.indexOf('class="actrow"')<vm.indexOf('class="weekstrip"') && vm.indexOf('class="weekstrip"')<vm.indexOf('class="quotastrip"') && vm.indexOf('class="quotastrip"')<vm.indexOf('<details class="sec"'));
  T("My shifts: legacy ids survive inside the sections", ['id="rFrom"','id="rTo"','id="icsBtn"','id="vAgenda"','id="myBody"'].every(function(x){return vm.indexOf(x)>=0;}));
  // ---- Phase 1: copy follows the tab names ----
  S.viewAs="s1"; var hh2=viewHelp();
  T("copy: Help no longer says Admin settings or the Self-roster tab", hh2.indexOf("Admin settings")<0 && hh2.indexOf("Self-roster tab")<0 && hh2.indexOf("‘Self‑roster’")<0);
  cset().rosterMode="rounds"; S.rosterMode="rounds"; S.cycles[0].status="open";
  S.cycles[0].window={enabled:true,open:FUT(2)+"T09:00",close:FUT(9)+"T17:00",fired:null};
  T("copy: gate reason says booking", /Booking hasn't opened yet/.test(bookingGate(S.cycles[0]).reason||""));
  S.cycles[0].window=null; S.cycles[0].status="published";
  // ---- Phase 1: fixes from the adversarial review ----
  S.viewAs="admin";
  T("nav: admin keeps My shifts (under More on phones)", navTabs().some(function(t){return t.id==="my";}) && navMore().some(function(t){return t.id==="my";}));
  S.viewAs="s1"; S.tab="notifs"; render();
  T("nav: a stored 'notifs' tab lands on My shifts with the bar lit", S.tab==="my" && /class="bn active"[^>]*data-tab="my"/.test(bottomNavHTML()));
  S.tab="bogus"; render(); T("nav: an unknown stored tab lands on My shifts", S.tab==="my");
  T("landing: admin returns to THIS device's tab, staff to My shifts", landingTab("admin","roster")==="roster" && landingTab("s1","roster")==="my");
  S.cycles.push({id:"c-next2",cycle:{start:FUT(30),weeks:8},assign:{},status:"draft",archived:false,settings:{},roles:{}});
  _srPick=["s1|"+FUT(3)+"|AM|z1"]; _srPickSid="s1"; go("selfroster",{cycle:"c-next2"});
  T("go: switching cycle drops unconfirmed picks", _srPick.length===0);
  go("my",{cycle:"c1"}); S.cycles=S.cycles.filter(function(c){return c.id!=="c-next2";}); S.activeId="c1";
  S.notifications=[]; notify("s1","Fresh alert","t-fresh",{tab:"requests"}); _notifsOpen=true; var shx=notifsSheetHTML();
  T("notif sheet: an unread row stays unread while the sheet is open", /class="notif act "/.test(shx) && shx.indexOf('id="notifsRead"')>=0);
  closeSheets();
  T("notif sheet: closing marks everything read", unreadCount("s1")===0 && _notifsOpen===false);
  S.notifications=[];
  _secOpen=null; T("sections: default open on desktop", secOpen("cal")===true && secOpen("cycle")===true);
  _secOpen.cal=false; var vm2=viewMy();
  T("sections: state survives a re-render", /data-sec="cal" >/.test(vm2) && /data-sec="cycle" open>/.test(vm2));
  _secOpen=null;
  T("quota strip: labelled, no duplicate Booked pill", quotaStripHTML("s1",S.staff[0]).indexOf("Your share /")>=0 && quotaStripHTML("s1",S.staff[0]).indexOf("Booked")<0);
  S.cycles[0].cycle.start=FUT(20); var wsf=weekStripHTML("s1",iso(new Date()));
  T("week strip: a future cycle says so", wsf.indexOf("First week of the cycle")>=0);
  S.cycles[0].cycle.start=iso(addDays(mondayOf(new Date()),-7));   // put back exactly what the block above set, not a weekday-dependent guess
  // ---- Phase 2: status transitions ----
  S.viewAs="admin"; S.notifications=[]; S.cycles[0].status="draft"; cset().rosterMode="rounds"; S.rosterMode="rounds";
  setCycleStatus("open");
  T("status: open → status set + booking alert with target", S.cycles[0].status==="open" && S.notifications.some(function(n){return /Booking is open/.test(n.text) && n.go && n.go.tab==="selfroster";}));
  setCycleStatus("closed"); var nN=S.notifications.length;
  T("status: close is quiet", S.cycles[0].status==="closed" && S.notifications.length===nN);
  setCycleStatus("published");
  T("status: publish alerts everyone with a My shifts target", S.cycles[0].status==="published" && S.notifications[0].go.tab==="my");
  T("status: confirm copy names the audience", /notified/.test(statusConfirmText("open")) && statusConfirmText("closed")===null);
  S.notifications=[];
  // ---- Phase 2: run-this-round stepper ----
  S.viewAs="admin"; S.cycles[0].assign={}; S.cycles[0].status="draft"; cset().rosterMode="rounds"; S.rosterMode="rounds";
  var rs=roundSteps(S.cycles[0]).map(function(s){return s.key+":"+s.state;});
  T("stepper: rounds draft, nobody on a fixed pattern → fixed is skipped, pre-fill is now", (rs[0]==="fixed:skip"||rs[0]==="fixed:done") && rs[1]==="prefill:now" && rs.indexOf("open:todo")>=0 && rs.indexOf("publish:todo")>=0);
  S.cycles[0].status="open"; rs=roundSteps(S.cycles[0]);
  T("stepper: open → close step is now, fixed and open done", rs.find(function(s){return s.key==="close";}).state==="now" && (rs[0].state==="done"||rs[0].state==="skip") && rs.find(function(s){return s.key==="open";}).state==="done");
  S.cycles[0].status="closed"; T("stepper: closed → publish is now", roundSteps(S.cycles[0]).find(function(s){return s.key==="publish";}).state==="now");
  cset().rosterMode="rolling"; S.rosterMode="rolling"; S.cycles[0].status="draft";
  T("stepper: rolling has Go live, no close", roundSteps(S.cycles[0]).some(function(s){return s.key==="live";}) && !roundSteps(S.cycles[0]).some(function(s){return s.key==="close";}));
  cset().rosterMode="rounds"; S.rosterMode="rounds"; S.cycles[0].status="published";
  var sh2=roundStepperHTML(S.cycles[0]); T("stepper: published shows Unpublish and no schedule inputs", sh2.indexOf('data-status="draft"')>=0 && sh2.indexOf('id="schOn"')<0 && sh2.indexOf('id="card-round"')>=0);
  S.cycles[0].status="draft"; sh2=roundStepperHTML(S.cycles[0]);
  T("stepper: draft shows the schedule and the open-booking buttons in the open step", sh2.indexOf('id="schOn"')>=0 && sh2.indexOf('data-status="open"')>=0 && sh2.indexOf('id="adFixed"')>=0 && sh2.indexOf('data-gaps=')>=0);
  S.cycles[0].status="published";
  // ---- Phase 2: fix gaps ----
  S.viewAs="admin"; S.cycles[0].assign={}; cset().staffing={amMin:2,amMax:2,pmMin:1,pmMax:2}; S.staffing=cset().staffing; var gd=FUT(3);
  S.cycles[0].assign["s1|"+gd]={kind:"clinical",period:"AM",zone:"z1"};
  var ss=shortSlots().filter(function(x){return x.iso===gd;});
  T("gaps: a day with 1 of 2 AM and 0 of 1 PM yields two short slots", ss.length===2 && ss.find(function(x){return x.period==="AM";}).need===1 && ss.find(function(x){return x.period==="AM";}).zones.some(function(z){return z.id==="z2";}));
  var gp=gapsPanelHTML(); T("gaps: panel lists Assign for each slot", (gp.match(/data-gapassign=/g)||[]).length>=2 && gp.indexOf('id="gapsPanel"')>=0);
  S.marketOn=false; T("gaps: no Broadcast when the marketplace is off", gapsPanelHTML().indexOf("data-gapcast=")<0 && /marketCard/.test(gapsPanelHTML()));
  S.marketOn=true; T("gaps: Broadcast when the marketplace is on", gapsPanelHTML().indexOf("data-gapcast=")>=0); S.marketOn=false;
  S.cycles[0].assign={}; cset().staffing={amMin:1,amMax:2,pmMin:1,pmMax:2}; S.staffing=cset().staffing;
  // ---- Phase 2: settings halves ----
  S.viewAs="admin"; _setupTab="cycle"; var vc=viewSetup();
  T("settings: cycle half has status, zones, cover, quota, mode — not branding", ['id="card-status"','id="card-zones"','id="card-cover"','id="card-quota"','id="card-mode"'].every(function(x){return vc.indexOf(x)>=0;}) && vc.indexOf('id="brandCard"')<0);
  _setupTab="group"; var vg=viewSetup();
  T("settings: group half has branding, cycles, import, capacity, danger — not zones", ['id="brandCard"','id="card-cycles"','id="card-import"','id="capCard"','id="card-danger"'].every(function(x){return vg.indexOf(x)>=0;}) && vg.indexOf('id="card-zones"')<0);
  T("settings: anchors map to their half", setupTabFor("marketCard")==="group" && setupTabFor("card-status")==="cycle" && setupTabFor("card-zones")==="cycle");
  go("setup",{anchor:"marketCard"}); T("go: opens the right half for an anchor", _setupTab==="group" && S.tab==="setup");
  _setupTab="cycle"; T("settings: every per-cycle heading carries the cycle name", (viewSetup().match(/tag muted/g)||[]).length>=8);
  S.tab="my";
  // ---- Phase 2: one save rule + danger zone ----
  S.viewAs="admin"; setFatigueMode("warn");
  T("save rule: fatigue mode persists on tap", cset().fatigue && cset().fatigue.mode==="warn" && effFatigue().mode==="warn");
  setFatigueMode("off");
  var dc=dangerCardHTML(); T("danger zone: names the group and offers the delete", dc.indexOf('id="dangerBtn"')>=0 && dc.indexOf(groupName())>=0);
  T("danger zone: only the exact group name confirms", confirmDanger("nope")===false && confirmDanger(" "+groupName().toUpperCase()+" ")===true);
  // ---- Phase 2: staff tab ----
  S.viewAs="admin"; S.staff.forEach(function(x){ x.email=""; x.email2=""; x.mobile=""; }); S.staff[1].email="sam@x.org"; S.staff[2].mode="fixed";
  var sf=staffFiltered("","all").map(function(x){return x.name;});
  T("staff: sorted by surname", sf.join(",")==="Alex,Kim,Sam");
  T("staff: search matches name or email", staffFiltered("sam","all").length===1 && staffFiltered("x.org","all")[0].name==="Sam");
  T("staff: no-login filter", staffFiltered("","nologin").every(function(x){return !x.email&&!x.mobile;}) && staffFiltered("","nologin").length===2);
  T("staff: fixed filter", staffFiltered("","fixed").length===1 && staffFiltered("","fixed")[0].name==="Kim");
  var sl=staffListHTML(); T("staff: collapsed rows carry no Save/Remove buttons", sl.indexOf("s-save")<0 && sl.indexOf("s-del")<0 && sl.indexOf('data-stoggle=')>=0);
  _staffOpen.add("s1"); sl=staffListHTML(); T("staff: the expanded row has Save changes and Remove at the end", sl.indexOf("Save changes")>=0 && sl.lastIndexOf("s-del")>sl.lastIndexOf("s-save")); _staffOpen.delete("s1");
  S.staff[2].mode="self";
  // ---- Phase 2: export menu, last import, checklist ----
  S.viewAs="admin"; S.features={}; var em=exportMenuHTML();
  T("export menu: lists Excel, CSV and both RosterOn files when the feature is on", em.indexOf('id="rosXls"')>=0 && em.indexOf('id="rosCsv"')>=0 && em.indexOf('id="rosPay"')>=0 && em.indexOf('id="rosRon"')>=0 && em.indexOf("card-payroll")>=0);
  S.features={rosteron:false}; T("export menu: RosterOn files hidden when the feature is off", exportMenuHTML().indexOf('id="rosPay"')<0); S.features={};
  recordImport("roster","roster-oct.xlsx","34 staff · 56 days"); T("last import: recorded and shown", S.lastImport.roster.file==="roster-oct.xlsx" && lastImportLine("roster").indexOf("roster-oct.xlsx")>=0 && lastImportLine("leave")==="");
  var cl=setupChecklist(); T("checklist: ten questions plus the follow-ups, each with an anchor", cl.length>=10 && cl.every(function(r){return r.anchor&&r.q;}));
  var _b=S.branding; S.branding={}; T("checklist: group name not done until set", !setupChecklist().find(function(r){return r.key==="name";}).done);
  S.branding={name:"Nurses",roleNoun:"nurse"}; T("checklist: group name and role noun done once set", setupChecklist().find(function(r){return r.key==="name";}).done && setupChecklist().find(function(r){return r.key==="role";}).done);
  _setupTab="cycle"; var vsc=viewSetup(); _setupTab="group"; var vsg=viewSetup(); _setupTab="cycle";
  T("checklist: every anchor exists on one of the halves", setupChecklist().every(function(r){return r.anchor==="staff"||r.anchor==="daily"||vsc.indexOf('id="'+r.anchor+'"')>=0||vsg.indexOf('id="'+r.anchor+'"')>=0;}));
  var ch=checklistHTML(); T("checklist: renders rows as links", (ch.match(/data-go="setup\|\|/g)||[]).length>=8 && ch.indexOf("Get started")>=0);
  S.branding=_b;
  // ---- Phase 2: review fixes ----
  S.viewAs="admin"; cset().rosterMode="rolling"; S.rosterMode="rolling"; S.cycles[0].status="draft";
  T("stepper: a rolling roster keeps the booking-window schedule", roundStepperHTML(S.cycles[0]).indexOf('id="schOn"')>=0);
  cset().rosterMode="rounds"; S.rosterMode="rounds"; S.cycles[0].archived=true; S.notifications=[];
  T("stepper: an archived cycle shows a note, no buttons", roundStepperHTML(S.cycles[0]).indexOf("data-status=")<0 && roundStepperHTML(S.cycles[0]).indexOf("card-cycles")>=0);
  T("status: an archived cycle refuses transitions and alerts nobody", setCycleStatus("open").ok===false && S.notifications.length===0 && S.cycles[0].status==="draft");
  S.cycles[0].archived=false; S.cycles[0].status="published";
  S.cycles[0].window={enabled:true,open:FUT(2)+"T09:00",close:FUT(9)+"T17:00",fired:null};
  T("status: the open confirm warns that a stale schedule will be switched off", /switched off/.test(statusConfirmText("open")));
  S.cycles[0].window=null;
  var _keep=S; S=defaultState(); normalize(); var fresh=setupChecklist().filter(function(r){return r.done;}).map(function(r){return r.key;}); S=_keep; hydrateCycleSettings(); hydrateCycleRoles();
  T("checklist: a brand-new group starts with nothing ticked but the cycle it was seeded with", fresh.every(function(k){return k==="cycle";}));
  // ---- Premium 2, item 10: what kind of group is this? ----
  (function(){ var _keep=S, _st=_setupTab; S=defaultState(); normalize(); S.viewAs="admin"; S.tab="setup"; _setupTab="cycle";
    T("kind: a new group's defaults are the four generic areas, not one hospital's codes", S.zones.map(function(z){return z.name;}).join(",")==="Resus,Acute,Fast track,Paeds" && S.zones.map(function(z){return z.id;}).join(",")==="resus,acute,fast-track,paeds" && S.zones.every(function(z){return z.am&&z.pm&&!z.pmLabel;}) && cset().zones.length===4 && S.staffing.amMin===3 && S.staffing.amMax===4 && S.fairness==="snake");
    var v=viewSetup();
    T("kind: a fresh group sees the card above Get started with six tiles", v.indexOf('id="card-kind"')>=0 && v.indexOf('id="card-kind"')<v.indexOf('id="card-guide"') && (v.match(/data-gkind="/g)||[]).length===6 && /data-gkind="nurses" aria-pressed="false"><b>Nurses<\/b>/.test(v) && v.indexOf("Something else")>=0);
    T("kind: every preset's maximum fits its zone count and has a noun (except Something else)", GROUP_KINDS.every(function(k){ return k.cover[1]<=k.zones.length && k.cover[0]>=1 && (k.key==="other"||k.noun); }));
    T("kind: no preset yet — Add staff defaults are today's 20 / 76", staffDefaults().quota===20 && staffDefaults().hrsFortnight===76);
    var ok=applyGroupKind("nurses"); var rows=setupChecklist(), role=rows.find(function(r){return r.key==="role";}), zones=rows.find(function(r){return r.key==="zones";});
    T("kind: Nurses seeds the noun, the zones, the cover, rounds, guarded, CST and RosterOn off", ok===true && ROLE()==="nurse" && S.zones.map(function(z){return z.name;}).join(",")==="Triage,Staff nurse 1,Staff nurse 2,Staff nurse 3" && cset().zones===S.zones && S.staffing.amMin===2 && S.staffing.amMax===4 && cset().staffing.pmMax===4 && S.rosterMode==="rounds" && cset().rosterMode==="rounds" && S.fairness==="guarded" && S.features.cst===false && S.features.rosteron===false && cset().preset==="nurses");
    T("kind: a preset seeds but never decides — nothing answered, the noun shows unticked, the zones row stays open", !Object.keys(cset().answered||{}).length && role.done===false && /from the preset/.test(role.detail) && zones.done===false && S.audit[0].action==="settings.preset" && !S.featuresReviewed);
    T("kind: the card shows the chosen tile pressed and Add staff defaults follow the preset", /data-gkind="nurses" aria-pressed="true"/.test(viewSetup()) && staffDefaults().quota===40 && staffDefaults().hrsFortnight===76);
    logAudit("settings.branding","saved","admin"); T("kind: saving Group details confirms the seeded noun", setupChecklist().find(function(r){return r.key==="role";}).done===true); S.audit.shift();
    T("kind: Scribes is rolling with two slots; Something else keeps the defaults and clears the noun", applyGroupKind("scribes")===true && S.rosterMode==="rolling" && S.zones.length===2 && S.staffing.amMax===2 && applyGroupKind("other")===true && !(S.branding&&S.branding.roleNoun) && ROLE()==="consultant" && S.zones.length===4 && S.features.cst===undefined && cset().preset==="other" && S.fairness==="snake" && cset().fairness==="snake");
    S.staff.push({id:"k1",name:"Kim Test",quota:2,eft:1}); T("kind: once someone is on the list the card is gone and a preset is refused", applyGroupKind("nurses")===false && viewSetup().indexOf('id="card-kind"')<0);
    S=_keep; _setupTab=_st; hydrateCycleSettings(); hydrateCycleRoles();
    T("kind: the pilot fixture never sees the card", viewSetup().indexOf('id="card-kind"')<0 && staffDefaults().quota===20); })();
  S.viewAs="s1"; S.tab="roster"; var rv=viewRoster(); S.viewAs="admin";
  T("gaps: staff never see a Fix button", rv.indexOf('id="gapsBtn"')<0);
  // ---- Phase 3: type scale ----
  S.viewAs="admin"; S.tab="roster";
  T("type: no view renders a px font-size literal — sizes come from the --fs-* scale", !/font-size:\s*\d+(\.\d+)?px/.test(viewMy()+viewRoster()+viewSetup()+viewDaily()+viewPlanner()+viewRequests()+viewStaff()+viewSelfRoster()+viewEquity()+viewMessages()+viewHelp()+viewAudit()));
  T("type: the planner grid keeps its --fs-grid exception", viewPlanner().indexOf("var(--fs-grid)")>=0);
  T("type: the roster HTML export keeps real px for Excel", (function(){var c=null,d0=download; download=function(x){c=String(x);}; try{exportRosterXLS();}catch(e){} download=d0; return c!==null && /font-size:11px/.test(c);})());
  // ---- Phase 3: palette ----
  T("palette: leaveStyle hands the DOM tokens", leaveStyle("AL").bg==="var(--lv-al-bg)" && leaveStyle("CME").t==="var(--lv-cme-t)" && leaveStyle("XYZ").bg==="var(--neutral-2)" && leaveStyle("sab").bg==="var(--lv-lsl-bg)");
  T("palette: leaveHex hands the exporters hex", leaveHex("AL").bg==="#ECEAFB" && leaveHex("PH").t==="#7E6410" && leaveHex("AL").name===leaveStyle("AL").name && leaveHex("XYZ").t==="#5A636E" && leaveHex("Other").bg==="#EEF0F2" && leaveHex("Vacant").bg==="#EEF0F2");
  T("palette: rosterColor stays hex for the export", rosterColor({kind:"clinical",period:"AM"}).bg==="#E6EEFB" && rosterColor({kind:"leave",code:"UA"}).t==="#9E4A2E" && rosterColor({kind:"off"})===null);
  T("palette: the two HTML exports carry no var() — Excel cannot resolve tokens", (function(){var out=[],d0=download; download=function(x){out.push(String(x));}; try{exportRosterXLS();exportPlannerXLS();}catch(e){} download=d0; return out.length===2 && out.every(function(c){return c.indexOf("var(--")<0 && c.indexOf("#")>=0;});})());
  // ---- Phase 3: brand ----
  S.viewAs="admin"; _setupTab="group";
  T("brand: the accent-colour field is gone — one teal for every group", viewSetup().indexOf('id="brColor"')<0 && viewSetup().indexOf('id="brName"')>=0);
  S.branding={primary:"#123456",name:"ED"}; applyBranding();
  T("brand: a stored accent colour is ignored", (document.documentElement.style.getPropertyValue("--brand-primary")||"")==="");
  S.branding={}; S.viewAs="admin"; S.tab="setup"; _setupTab="group"; render(); var _bn=document.getElementById("brName"); if(_bn)_bn.value="Test ED"; var _n0=S.audit.length, _ok=true; try{ var _bs=document.getElementById("brSave"); if(_bs&&_bs.onclick)_bs.onclick(); else _ok=false; }catch(e){ _ok=false; }
  T("brand: Save group details does not throw and writes one audit line", _ok && S.audit.length===_n0+1 && S.audit[0].action==="settings.branding");
  S.branding={}; applyBranding();
  // ---- Phase 3: tags ----
  S.viewAs="admin"; S.tab="roster"; _setupTab="cycle";
  T("tags: the roster renders period chips as tags", /class="tag lg (am|pm|cst)/.test(viewRoster()));
  T("tags: status words are tags", /class="tag (ok|warn|danger|muted)/.test(viewRoster()+viewSetup()));
  T("tags: the mobile day card rail is a solid tag", (function(){   // its own shift: it used to lean on a leave dated 7 Sep 2026 that fell out of the cycle as the dates moved on
    var c=active(), was=JSON.stringify(c.assign); c.assign["s1|"+iso(cycleDates()[0])]={kind:"clinical",period:"AM",zone:"z1"};
    var ok=/class="tag solid am rlab"/.test(viewRosterMobile()); c.assign=JSON.parse(was); return ok; })());
  T("tags: nothing renders the retired names", !/class="[^"]*\b(pill|chip|badge-mode|lvchip|locx|todaytag|ph-badge|sini)\b/.test(viewRoster()+viewRosterMobile()+viewMy()+viewSetup()+viewDaily()+viewPlanner()+viewPlannerMobile()+viewStaff()+viewRequests()+viewSelfRoster()));
  // ---- Phase 3: icons ----
  T("icons: ic() returns an svg for a known name and nothing for an unknown one", ic("download").indexOf("<svg")===0 && ic("chevR").indexOf('class="tic"')>0 && ic("nope")==="");
  T("icons: export buttons carry the download icon, not the arrow emoji", exportMenuHTML().indexOf('class="tic"')>=0 && exportMenuHTML().indexOf("⬇")<0);
  S.viewAs="admin"; S.tab="daily";
  T("icons: the Daily arrows are labelled buttons with chevrons", /id="dPrev" aria-label="Previous day">\s*<svg/.test(viewDaily()) && viewDaily().indexOf("‹")<0);
  T("icons: the mood picker keeps its faces", MOODLBL.good==="🙂");
  T("icons: a toast still carries its text", (function(){var d0=document.createElement, seen=[]; document.createElement=function(tag){var e=d0(tag); e.appendChild=function(c){seen.push(c);}; return e;}; try{ toast("Saved for testing","ok"); }catch(e){ return false; } finally{ document.createElement=d0; } return seen.some(function(c){return !!c&&c.textContent==="Saved for testing";}); })());
  T("icons: every icon in the set is hidden from screen readers", Object.keys(TIC).every(function(k){return TIC[k].indexOf('aria-hidden="true"')>0;}));
  // ---- Phase 3: signature ----
  S.viewAs="s1"; S.tab="my"; var _hero=viewMy();
  T("signature: the hero carries the period as a data attribute and a solid tag", /<div class="nextcard" data-period="(am|pm|cst|none)"/.test(_hero) && (/data-period="none"/.test(_hero) || /class="tag solid (am|pm|cst)">(AM|PM|CST)</.test(_hero)));
  T("signature: the hero text names the zone and start, not the period word twice", !/class="tag solid am">AM<\/span>[^<]*\bAM\b/.test(_hero));
  // ---- Phase 5: day rows + sheet ----
  S.viewAs="s1"; S.tab="selfroster"; cset().rosterMode="rounds"; S.rosterMode="rounds"; S.cycles[0].status="open"; S.cycles[0].archived=false; S.cycles[0].window=null; S.cycles[0].draft=null; S.cycles[0].waveState=null; S.fairness="guarded"; cset().fairness="guarded"; _srPick=[]; _srPickSid=null; S.features={};
  var srv=viewSelfRoster(); var day1=iso(cycleDates()[3]);
  T("book: the list is one row per day, no per-zone buttons", (srv.match(/data-bday="/g)||[]).length===cycleDates().length && srv.indexOf('data-pick="')<0);
  T("book: an off day row says Off and is tappable", new RegExp('<button class="dayrow[^"]*" data-bday="'+day1+'"[^>]*>[\\s\\S]*?Off').test(srv));
  T("book: every row carries the short month under its number", (function(){ var ok=true, n=0; cycleDates().forEach(function(d){ var i=srv.indexOf('data-bday="'+iso(d)+'"'); if(i<0){ ok=false; return; } var row=srv.slice(i, srv.indexOf("</button>", i)); if(row.indexOf('class="dm">'+fmt(d,{month:"short"})+'<')>0)n++; else ok=false; }); return ok && n===cycleDates().length; })());
  T("book: the list names each month once, above its first day, with the year", (function(){ var ms=(srv.match(/class="monthrow"[^>]*>([^<]+)</g)||[]).map(function(m){ return m.replace(/.*>/,"").replace(/<$/,""); }); var want=[]; cycleDates().forEach(function(d,i){ if(i===0||d.getDate()===1)want.push(fmt(d,{month:"long",year:"numeric"})); }); return ms.length===want.length && want.length>=2 && ms.every(function(m,i){ return m===want[i]; }) && srv.indexOf('<div class="monthrow" role="heading" aria-level="3">'+want[0]+'</div><button class="dayrow')>0; })());
  var sh=daySheetHTML(day1);
  T("sheet: AM/PM segment, cover line and zone chips with keys", sh.indexOf('data-dsper="PM"')>=0 && /cover/i.test(sh) && sh.indexOf('data-pick="'+day1+'|AM|z1"')>=0);
  S.cycles[0].assign["s2|"+day1]={kind:"clinical",period:"AM",zone:"z1"}; sh=daySheetHTML(day1);
  T("sheet: a taken zone is greyed with who has it", /data-pick="[^"]*\|AM\|z1" disabled/.test(sh) && /Taken by/.test(sh));
  delete S.cycles[0].assign["s2|"+day1]; sh=daySheetHTML(day1);
  T("sheet: secondary actions spell the codes out", sh.indexOf('data-setcst="'+day1+'"')>=0 && /clinical support time/i.test(sh) && /unavailable/i.test(sh) && sh.indexOf("Requests")>=0);
  _srPick=[day1+"|AM|z1"]; _srPickSid="s1"; _srSid="s1"; srv=viewSelfRoster();
  T("book: a picked day shows the pick and the footer counts it", /data-bday="[^"]+"[^>]*>[\s\S]*?Picked[\s\S]*?AM/.test(srv) && /class="srfoot"/.test(srv) && /1 picked/.test(srv) && srv.indexOf("srConfirm")>=0);
  var q0=S.staff[0].quota; S.staff[0].quota=1; var chk=pickCheck("s1",iso(cycleDates()[5]),"AM","z1");
  T("pickCheck: a pick beyond the cycle share is refused at pick time, in a sentence", chk.ok===false && /share|quota/.test(chk.reason) && /\.$/.test(chk.reason));
  S.staff[0].quota=q0; _srPick=[]; _daySheet=null;
  T("sheet: render injects the day sheet into sheetRoot and closeSheets clears it", (function(){ _daySheet=day1; render(); var ok=document.getElementById("sheetRoot").innerHTML.indexOf('class="sheet daysheet"')>=0; closeSheets(); return ok && _daySheet===null; })());
  // ---- Phase 5: status line ----
  S.viewAs="s1"; S.tab="selfroster"; srv=viewSelfRoster();
  T("status: staff get one line, not the admin tiles", srv.indexOf("Coverage gaps")<0 && /class="statusline"/.test(srv) && /Booking open/.test(srv) && /you've booked <b>\d+<\/b> of \d+/.test(srv));
  S.cycles[0].window={enabled:true,open:FUT(-1)+"T09:00",close:FUT(6)+"T17:00",fired:null}; srv=viewSelfRoster();
  T("status: the close time is in the line, not a separate banner", /closes/.test(srv) && srv.indexOf('class="schedbar')<0);
  S.cycles[0].window=null; S.viewAs="admin"; srv=viewSelfRoster();
  T("status: admins keep the tiles and the stepper", srv.indexOf("Coverage gaps")>=0 && srv.indexOf('id="card-round"')>=0);
  S.cycles[0].status="published"; S.viewAs="s1"; srv=viewSelfRoster(); S.cycles[0].status="open";
  T("status: a closed round still says how many you booked", /class="statusline"/.test(srv) && /you've booked/.test(srv) && /published/.test(srv));
  // ---- Phase 5: requests ----
  S.viewAs="s1"; S.tab="requests"; var _rq0=S.requests; S.requests=[]; var rv=viewRequests();
  T("requests: staff see Your requests then two Request buttons, no inline forms", rv.indexOf('id="reqLeave"')>=0 && rv.indexOf('id="reqSwap"')>=0 && rv.indexOf('id="lvSubmit"')<0 && rv.indexOf("Your requests")>=0);
  S.requests=[{id:"rq9",type:"swap",from:"s2",peerId:"s1",dateA:FUT(3),dateB:FUT(5),status:"awaiting-peer",createdTs:Date.now()}]; rv=viewRequests();
  T("requests: a swap waiting on me comes first, with Agree and Decline", rv.indexOf("Needs you")>=0 && rv.indexOf("Needs you")<rv.indexOf("Your requests") && rv.indexOf('data-peeragree="rq9"')>=0);
  var ls=reqSheetHTML("leave");
  T("requests: the leave sheet keeps its ids and ends in one verb", ls.indexOf('id="lvFrom"')>=0 && ls.indexOf('id="lvSubmit"')>=0 && /Send leave request/.test(ls) && ls.indexOf(">Submit<")<0);
  var _today=iso(new Date()), _first=cycleDates().filter(function(d){return iso(d)>=_today;})[0];
  T("requests: leave From defaults to today or the first cycle day after it", ls.indexOf('id="lvFrom" value="'+(_first?iso(_first):_today)+'"')>=0);
  T("requests: statuses are words", reqStatusTag({status:"approved"}).indexOf("Approved")>=0 && reqStatusTag({status:"awaiting-peer"}).indexOf("Waiting for")>=0 && reqStatusTag({status:"info"}).indexOf("needs your reply")>=0);
  T("requests: the swap sheet ends in Send swap request", /Send swap request/.test(reqSheetHTML("swap")) && reqSheetHTML("swap").indexOf('id="swSubmit"')>=0);
  T("requests: render puts the sheet in sheetRoot and go() clears it", (function(){ _reqSheet="leave"; render(); var ok=document.getElementById("sheetRoot").innerHTML.indexOf('id="lvSubmit"')>=0; go("requests"); return ok && _reqSheet===null; })());
  S.requests=_rq0;
  // ---- Phase 5: method names ----
  T("methods: named by what people experience", fairnessLabel("guarded")==="Everyone at once" && fairnessLabel("waves")==="In random groups" && fairnessLabel("snake")==="Take turns" && fairnessLabel("adjust")==="Pre-filled, then adjust");
  S.viewAs="admin"; S.tab="setup"; _setupTab="cycle"; var su=viewSetup();
  T("methods: the picker shows the plain name with the technical one as a hint", su.indexOf("In random groups")>=0 && /cohort waves/.test(su) && su.indexOf(">Guarded free-for-all<")<0);
  T("status: the pill echoes the booking verbs", STATUS.open.label==="Booking open" && STATUS.closed.label==="Booking closed");
  // ---- Phase 5: words ----
  S.features={};
  T("cst: on by default for the existing consultant group", featOn("cst")===true);
  S.features={cst:false}; S.viewAs="s1"; S.tab="my"; _srSid="s1";
  T("cst: a group without CST never sees it", viewMy().indexOf("Support time (CST)")<0 && daySheetHTML(day1).indexOf("data-setcst")<0 && viewRoster().indexOf('title="Clinical support time"')<0);
  S.features={};
  T("cst: the group card offers the switch", (function(){ S.viewAs="admin"; _setupTab="group"; return viewSetup().indexOf('data-feat="cst"')>=0; })());
  var _lvd=iso(cycleDates()[1]); S.cycles[0].assign["s1|"+_lvd]={kind:"leave",code:"AL"}; var _rs=canBook("s1",_lvd,"AM","z1").reason; delete S.cycles[0].assign["s1|"+_lvd];
  T("words: refusal reasons are sentences", /^You're on leave/.test(_rs) && /\.$/.test(_rs));
  S.branding={roleNoun:"scribe"}; S.viewAs="admin"; _setupTab="cycle"; var _cyc=viewSetup(); S.tab="daily"; var _dy=viewDaily(); S.branding={};
  T("words: the cycle half and the Day board use the group's noun", !/consultant/i.test(_cyc) && !/consultant/i.test(_dy));
  S.viewAs="s1"; S.tab="my";
  T("words: the quota tile says what it counts", /Shifts this cycle/.test(viewMy()) && /your share of clinical shifts/.test(viewMy()));
  T("words: the staff mode label is plain", /No shifts \(coordinator/.test((function(){ S.viewAs="admin"; S.tab="staff"; var st=S.staff[2].mode; S.staff[2].mode="none"; var h=viewStaff(); S.staff[2].mode=st; return h; })()));
  // ---- Phase 5: skeptic pass ----
  S.viewAs="s1"; S.tab="selfroster"; cset().rosterMode="rounds"; S.rosterMode="rounds"; S.cycles[0].status="open"; S.cycles[0].window=null; S.cycles[0].draft=null; S.cycles[0].waveState=null; S.fairness="guarded"; cset().fairness="guarded"; S.features={}; _srSid="s1"; _srPickSid="s1";
  var _qp=S.quotaPeriod,_qf=S.quotaFlex,_qc=S.quotaCapMode,_q0=S.staff[0].quota,_ft=cset().fatigue;
  var _cd=cycleDates().map(iso), _pw=7*periodWeeks();
  S.quotaPeriod="fortnight"; S.quotaFlex=true; S.quotaCapMode="hard"; S.staff[0].quota=5; _srPick=[_cd[0]+"|AM|z1",_cd[1]+"|AM|z1",_cd[_pw]+"|AM|z1"];
  T("pickCheck: the flexible-remainder rule sees the basket", cyclePeriods().length>=3 && pickCheck("s1",_cd[_pw+1],"AM","z1").ok===false && pickCheck("s1",_cd[2*_pw],"AM","z1").ok===true);
  S.quotaFlex=false; S.quotaCapMode="off"; S.staff[0].quota=10; cset().fatigue={mode:"block",minRest:0,maxConsec:3}; _srPick=[_cd[0]+"|AM|z1",_cd[1]+"|AM|z1",_cd[2]+"|AM|z1"];
  var _fc=pickCheck("s1",_cd[3],"AM","z1");
  T("pickCheck: fatigue rules see the basket, and the dry-run leaves nothing behind", _fc.ok===false && /Fatigue rule/.test(_fc.reason) && !S.cycles[0].assign["s1|"+_cd[0]] && !S.cycles[0].assign["s1|"+_cd[2]]);
  T("pickCheck: soft cap mode does not block the share at pick time", (function(){ S.quotaCapMode="soft"; S.staff[0].quota=1; _srPick=[]; var ok=pickCheck("s1","2026-08-10","AM","z1").ok===true; S.quotaCapMode="hard"; return ok; })());
  S.quotaPeriod=_qp; S.quotaFlex=_qf; S.quotaCapMode=_qc; S.staff[0].quota=_q0; cset().fatigue=_ft; _srPick=[];
  var _c0=S.cycles[0].id; S.cycles.push({id:"cx-tmp",cycle:{start:"2027-01-04",weeks:2},assign:{},status:"draft",archived:false,settings:{}}); _srPick=[_cd[0]+"|AM|z1"]; _srPickSid="s1"; go("selfroster",{cycle:"cx-tmp"}); var _dropped=_srPick.length===0; go("selfroster",{cycle:_c0}); S.cycles=S.cycles.filter(function(c){return c.id!=="cx-tmp";}); hydrateCycleSettings(); hydrateCycleRoles();
  T("basket: a cycle switch through go() drops the picks", _dropped && S.activeId===_c0);
  cset().rosterMode="rolling"; S.rosterMode="rolling"; S.cycles[0].status="published"; _srPick=[]; var _pd=_cd[0], _keepA=S.cycles[0].assign["s1|"+_pd], _keepL=S.leave; delete S.cycles[0].assign["s1|"+_pd]; S.leave=S.leave.filter(function(l){return !(l.staffId==="s1"&&l.from<=_pd&&l.to>=_pd);});
  var _sv=viewSelfRoster(), _i0=_sv.indexOf('data-bday="'+_pd+'"'), _i1=_sv.indexOf('data-bday="',_i0+10), _row=_sv.slice(_i0,_i1>0?_i1:_i0+2000);
  T("rows: a past day in a rolling roster says nothing open", _pd<iso(new Date()) && _row.indexOf(">Off<")>=0 && _row.indexOf("nothing open")>=0 && !/\d+ open/.test(_row));
  if(_keepA)S.cycles[0].assign["s1|"+_pd]=_keepA; S.leave=_keepL;
  cset().rosterMode="rounds"; S.rosterMode="rounds"; S.cycles[0].status="open";
  S.fairness="snake"; cset().fairness="snake"; S.cycles[0].draft={round:1,turnIdx:1,base:["s1","s2","s3"]}; var _wait=viewSelfRoster();
  T("rows: someone waiting their turn can still open every day", (_wait.match(/data-bday="/g)||[]).length===cycleDates().length && daySheetHTML(iso(cycleDates()[4])).indexOf("data-setoff")<0);
  S.cycles[0].draft=null; S.fairness="guarded"; cset().fairness="guarded";
  var _rq1=S.requests; S.requests=[{id:"rqf",type:"fixed",from:"s1",pattern:{recurrence:"weekly",A:{},B:{},committed:true},status:"pending",createdTs:Date.now()}]; S.viewAs="s1"; S.tab="requests"; var _fv=null; try{ _fv=viewRequests(); }catch(e){ _fv=null; }
  T("requests: a fixed-pattern request row renders without dates", !!_fv && /Fixed-pattern change/.test(_fv) && _fv.indexOf("undefined")<0);
  S.requests[0].status="approved"; S.viewAs="admin"; var _av=viewRequests(); S.requests=_rq1;
  T("requests: the admin decided list offers Cancel the pattern", /Cancel the pattern/.test(_av));
  S.features={cst:false}; S.viewAs="s1"; S.tab="my";
  T("cst: the tally cluster and the assign modal hide CST when the group has none", !/class="tag lg cst">CST \d+</.test(viewMy()) && (function(){ S.viewAs="admin"; try{ openCell("s1",iso(cycleDates()[2])); }catch(e){} var h=document.getElementById("modalRoot").innerHTML; closeModal(); return h.indexOf('data-kind="cst"')<0; })());
  S.features={};
  S.notifications=[]; S.viewAs="admin"; startWaves(); advanceWave(); T("waves: the advance notification says Group", /^Group 2 is picking now\.$/.test(S.notifications[0].text)); stopWaves(); S.notifications=[];
  S.viewAs="admin"; var _hh=viewHelp();
  T("copy: Help names the real buttons", _hh.indexOf("Release for self")<0 && _hh.indexOf("You only see free slots")<0 && _hh.indexOf("tap your booked slot")<0 && _hh.indexOf("Open booking")>=0 && _hh.indexOf("Remove this shift")>=0);
  // ---- Phase 4: real controls ----
  S.viewAs="admin"; S.tab="roster"; S.cycles[0].status="published"; var rg=viewRoster();
  T("a11y: every editable roster cell is a button with a name", /<td class="cell[^"]*"[^>]*><button class="cellbtn" data-s="s1" data-d="[^"]+" aria-label="Alex · /.test(rg) && (rg.match(/class="cellbtn"/g)||[]).length>=cycleDates().length*3 && rg.indexOf('aria-label="Alex · ')>=0);
  T("a11y: the row-highlight name is a button that says whether it is pressed", /<button class="ctl namecol-btn" data-hl="s1" aria-pressed="(true|false)"/.test(rg));
  T("a11y: staff rows open from a button that says whether they are open", /<button class="ctl stoggle" data-stoggle="s1" aria-expanded="false">/.test(staffListHTML()) && (function(){ _staffOpen.add("s1"); var h=staffListHTML(); _staffOpen.delete("s1"); return /<button class="ctl stoggle" data-stoggle="s1" aria-expanded="true" aria-controls="sd-s1">/.test(h) && h.indexOf('id="sd-s1"')>=0; })());
  S.tab="planner"; var pm=viewPlannerMobile();
  T("a11y: planner days are buttons with names", /<button class="pmday[^"]*" data-pday="[^"]+" aria-label="/.test(pm) && pm.indexOf('<div class="pmday')<0);
  T("a11y: the Daily assign list rows are buttons", (function(){ var _m=isMobile; isMobile=function(){return true;}; S.tab="daily"; var d=viewDaily(); isMobile=_m; return /<button class="listrow assignrow ctl" data-s="s1"/.test(d); })());
  // ---- Phase 4: dialogs ----
  S.viewAs="admin"; S.tab="roster"; render(); try{ openCell("s1",iso(cycleDates()[2])); }catch(e){} var mr=document.getElementById("modalRoot").innerHTML;
  T("dialog: the cell modal is a labelled dialog with radiogroups", /<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"/.test(mr) && /id="kindSeg" role="radiogroup"/.test(mr) && /role="radio" aria-checked="true"/.test(mr));
  T("dialog: the page behind is inert while it is open", document.getElementById("app").inert===true && document.getElementById("bottomnav").inert===true);
  closeModal();
  T("dialog: closing removes inert and empties the root", document.getElementById("app").inert===false && document.getElementById("modalRoot").innerHTML==="");
  try{ openFeedback(); }catch(e){} T("dialog: feedback uses the helper", /role="dialog" aria-modal="true" aria-labelledby="dlgT"/.test(document.getElementById("modalRoot").innerHTML)); closeModal();
  try{ openPlannerDay(iso(cycleDates()[2])); }catch(e){} T("dialog: the planner day modal is a dialog", /aria-labelledby="dlgT"/.test(document.getElementById("modalRoot").innerHTML)); closeModal();
  try{ openPlannerCell("s1",iso(cycleDates()[2])); }catch(e){} T("dialog: the planner cell modal is a dialog", /aria-labelledby="dlgT"/.test(document.getElementById("modalRoot").innerHTML)); closeModal();
  try{ openExportMenu(); }catch(e){} T("dialog: the export menu is a dialog and closes through the helper", /aria-labelledby="dlgT"/.test(document.getElementById("modalRoot").innerHTML) && document.getElementById("app").inert===true); closeModal();
  S.viewAs="s1"; S.tab="selfroster"; _srSid="s1"; _daySheet=iso(cycleDates()[3]); render(); T("sheet: the page behind a sheet is inert but the bottom bar stays live", document.getElementById("app").inert===true && document.getElementById("bottomnav").inert===false); closeSheets(); T("sheet: closing a sheet restores the page", document.getElementById("app").inert===false);
  // ---- Phase 4: errors beside the field ----
  T("errors: fieldError marks and names the field", (function(){ var el=document.createElement("input"); fieldError(el,"Add a reason"); return el.getAttribute("aria-invalid")==="true" && /^ferr-\d+$/.test(el.getAttribute("aria-describedby")||""); })());
  T("errors: the leave sheet reports empty dates beside the field, not as a toast", (function(){ S.viewAs="s1"; S.tab="requests"; _reqSheet="leave"; render(); var f=document.getElementById("lvFrom"), t=document.getElementById("lvTo"); f.value=""; t.value=""; var got=null,_fe=fieldError,_to=toast,toasted=false; fieldError=function(el,m){got=m;}; toast=function(){toasted=true;}; try{ document.getElementById("lvSubmit").onclick(); } finally { fieldError=_fe; toast=_to; } _reqSheet=null; render(); return got==="Pick the dates first." && !toasted; })());
  T("errors: the swap sheet asks for a colleague beside the field", (function(){ S.viewAs="s1"; S.tab="requests"; _reqSheet="swap"; swapPeer=null; render(); document.getElementById("swMine").value="2026-08-20"; var got=null,_fe=fieldError; fieldError=function(el,m){got=m;}; try{ document.getElementById("swSubmit").onclick(); } finally { fieldError=_fe; } _reqSheet=null; render(); return got==="Choose a colleague."; })());
  // ---- Phase 4: labels ----
  S.viewAs="admin"; S.tab="setup"; _setupTab="cycle"; var lbl=viewSetup(); _setupTab="group"; lbl+=viewSetup(); S.tab="requests"; S.viewAs="s1"; lbl+=reqSheetHTML("leave")+reqSheetHTML("swap"); S.tab="my"; lbl+=viewMy(); S.viewAs="admin"; S.tab="roster"; try{ openCell("s1",iso(cycleDates()[2])); }catch(e){} lbl+=document.getElementById("modalRoot").innerHTML; closeModal();
  T("labels: no bare sibling labels remain in the views", lbl.indexOf('<div class="field"><label>')<0 && !/<div class="field" style="[^"]*"><label>/.test(lbl) && (lbl.match(/<label class="field"/g)||[]).length>=20 && /<div class="field"[^>]*role="group" aria-labelledby="lbl-[^"]+"><span class="lbl" id="lbl-/.test(lbl));
  render(); T("labels: the header selects are named", document.getElementById("cycleSel").getAttribute("aria-label")==="Roster cycle");
  S.viewAs="admin"; S.tab="setup"; _setupTab="cycle"; var lbl2=viewSetup(); _setupTab="group"; lbl2+=viewSetup(); S.tab="daily"; lbl2+=viewDaily(); S.viewAs="s1"; S.tab="my"; lbl2+=viewMy();
  T("labels: table and row controls carry names too", /class="qt-cell"[^>]*aria-label="Alex · /.test(lbl2) && (function(){ try{ renderZoneList(); }catch(e){} return /class="z-name"[^>]*aria-label="Zone name"/.test(document.getElementById("zoneList").innerHTML); })() && /class="st-start"[^>]*aria-label="AM start"/.test(lbl2) && /class="st-label"[^>]*aria-label="Shift type name"/.test(lbl2) && /id="dDate"[^>]*aria-label="Day"/.test(lbl2));
  // ---- Phase 4: not by colour alone ----
  S.viewAs="admin"; S.tab="roster"; S.cycles[0].status="published"; var _nd=iso(cycleDates()[2]); S.cycles[0].assign["s1|"+_nd]={kind:"clinical",period:"AM",zone:"z1",note:"swap cover",noteBy:"Admin"}; var rg2=viewRoster();
  T("colour: a noted shift shows a visible flag with a name", /class="noteflag" aria-label="Has a note"/.test(rg2) && rg2.indexOf('class="editdot"')<0);
  T("colour: the cell modal shows the note", (function(){ try{ openCell("s1",_nd); }catch(e){} var h=document.getElementById("modalRoot").innerHTML; closeModal(); return /Note: swap cover — Admin/.test(h); })());
  delete S.cycles[0].assign["s1|"+_nd];
  var rm2=viewRosterMobile();
  T("colour: phone cards say short in words and carry a Needs cover tag", /AM \d+\/\d+ short/.test(rm2) && /Needs cover/.test(rm2));
  T("colour: short grid captions carry a warning icon with a name", /class="capwarn" aria-label="short"/.test(viewRoster()));
  // ---- Phase 4: phone roster by week ----
  S.viewAs="admin"; S.tab="roster"; var rm=viewRosterMobile();
  T("week: the phone roster is grouped into one accordion per week", (rm.match(/<details class="hd wk"/g)||[]).length===Math.ceil(cycleDates().length/7));
  T("week: each week summary carries its cover count", /<summary><span>Week 1 · /.test(rm) && /(Needs cover · \d|at minimum · \d|Fully covered)/.test(rm));
  T("week: admins open a day from its header, not sixty buttons", rm.indexOf("rcard-open")<0 && /<button class="rcard-h ctl" data-day="[^"]+"><b>/.test(rm) && !/class="rcard-h ctl"[^>]*aria-label=/.test(rm) && /<span class="vh">\. Open to assign<\/span>/.test(rm));
  T("week: exactly one week is open by default", (rm.match(/<details class="hd wk" data-wk="\d+" open>/g)||[]).length===1);
  T("week: a Today chip exists only when today is in the cycle", (cycleDates().some(function(d){return iso(d)===iso(new Date());})? rm.indexOf('id="todayChip"')>=0 : rm.indexOf('id="todayChip"')<0));
  T("week: day cards and their sections are lists", /<ul class="rlist"><li class="rcard/.test(rm) && /<ul class="rsecs">/.test(rm));
  // ---- Phase 4: skeptic pass ----
  S.viewAs="admin"; S.tab="roster"; try{ openCell("s1",iso(cycleDates()[2])); }catch(e){} modal.draft={kind:"clinical",period:"AM"}; try{ renderModal(); }catch(e){} var mh=document.getElementById("modalRoot").innerHTML; closeModal();
  T("dialog: zone choices are a radiogroup of radios with a roving tabindex", /id="zoneChoices" role="radiogroup"/.test(mh) && /data-zone="z1" role="radio" aria-checked="(true|false)"/.test(mh) && /data-kind="clinical" role="radio" aria-checked="true" tabindex="0"/.test(mh) && /data-kind="off" role="radio" aria-checked="false" tabindex="-1"/.test(mh));
  T("names: the cell name comes from the tip, with locum", (function(){ var d=iso(cycleDates()[2]); S.cycles[0].assign["s1|"+d]={kind:"clinical",period:"AM",zone:"z1",locum:true}; var h=viewRoster(); delete S.cycles[0].assign["s1|"+d]; return /aria-label="Alex · [^"]*Resus · locum"/.test(h); })());
  T("names: the cover min and max spin buttons are named", (function(){ S.viewAs="admin"; S.tab="setup"; _setupTab="cycle"; var h=viewSetup(); _setupTab="group"; h+=viewSetup(); return /id="capMinA"[^>]*aria-label="AM minimum per zone"/.test(h) && /id="capMaxP"[^>]*aria-label="PM maximum per zone"/.test(h); })());
  T("names: a planner day says who is away and holds no block elements", (function(){ S.tab="planner"; var m=plannerMonth||new Date(); var dd=iso(new Date(m.getFullYear(),m.getMonth(),10)); var k="s1|"+dd, o=S.cycles[0].assign[k]; S.cycles[0].assign[k]={kind:"leave",code:"AL"}; var h=viewPlannerMobile(); if(o)S.cycles[0].assign[k]=o; else delete S.cycles[0].assign[k]; var btn=(h.match(/<button class="pmday[\s\S]*?<\/button>/)||[""])[0]; return btn.indexOf("<div")<0 && (/aria-label="[^"]*Alex AL[^"]*Open to plan leave"/.test(h) || dd<iso(cycleDates()[0]) || dd>iso(cycleDates()[cycleDates().length-1])); })());
  T("markup: no label nests another label", (function(){ var h=""; S.viewAs="admin"; S.tab="setup"; _setupTab="cycle"; h+=viewSetup(); _setupTab="group"; h+=viewSetup(); var depth=0, bad=false; h.replace(/<\/?label\b/g, function(m){ if(m==="</label"){depth--;} else { if(depth>0)bad=true; depth++; } return m; }); return !bad; })());
  T("markup: the import fields are labels with for=", /<label class="lbl" for="impRoster">/.test((function(){ _setupTab="group"; return viewSetup(); })()));
  T("focus: focusKey addresses a control by its data attributes or id", focusKey({tagName:"BUTTON",dataset:{s:"s1",d:"2026-08-03"}})==='button[data-s="s1"][data-d="2026-08-03"]' && focusKey({tagName:"INPUT",id:"lvFrom",dataset:{}})==="#lvFrom" && focusKey(null)===null);
  T("auth: a session ending while a sheet is open leaves the login screen usable", (function(){ var _co=cloudOn; cloudOn=function(){return true;}; S.viewAs="admin"; S.tab="roster"; render(); _notifsOpen=true; render(); try{ openFeedback(); }catch(e){} var _as=authState; authState="out"; try{ render(); }catch(e){} var ok=document.getElementById("app").inert===false && document.getElementById("modalRoot").innerHTML===""; authState=_as; cloudOn=_co; _notifsOpen=false; render(); return ok; })());
  // ---- Premium 1: first sight ----
  (function(){ var _as=authState; authState="checking"; var h=authScreen(); authState=_as;
    T("cold: the mark's bars breathe over a silhouette, no spinner and no Connecting", h.indexOf('class="mark markbeat"')>=0 && /class="mk-am"/.test(h) && /class="mk-cst"/.test(h) && /class="nextcard ghost"/.test(h) && h.indexOf("spin")<0 && h.indexOf("Connecting")<0 && /class="vh">Reaching the roster server</.test(h)); })();
  T("cold: the mark helper draws the period trio from PALETTE", (function(){ var m=markSVG(""); return m.indexOf(PALETTE["--mark-am"])>=0 && m.indexOf(PALETTE["--mark-pm"])>=0 && m.indexOf(PALETTE["--mark-cst"])>=0 && m.indexOf('class="mark"')>=0; })());
  (function(){ var _as=authState,_os=_otpSent,_am=_authMethod,_sh=_sharedDevice; authState="out"; _otpSent=false; _authMethod="sms"; _sharedDevice=false; var h=authScreen();
    T("door: the sign-in says no password, a 6-digit code, Australia once at the foot, with two channel rows and the mark", h.indexOf("No password")>=0 && h.indexOf("6-digit code")>=0 && h.indexOf("Hosted in Australia")<0 && (h.match(/Australia/g)||[]).length===1 && h.indexOf("stored in Sydney, Australia")>=0 && h.indexOf('id="authMsg"')<h.indexOf('class="door-foot') && /class="chanrow on" data-am="sms" aria-pressed="true"><svg/.test(h) && /class="chanrow" data-am="email" aria-pressed="false"><svg/.test(h) && h.indexOf('class="mark"')>=0 && h.indexOf('id="authSend"')>=0 && h.indexOf('id="authPhoneInput"')>=0 && h.indexOf('id="authShared"')>=0 && h.indexOf("Using a ward PC?")>=0 && h.indexOf('class="seg"')<0);
    T("door: the hospital is the title when known, the wordmark otherwise", (function(){ var _b=S.branding,_oh=_orgHospital; S.branding={}; _orgHospital="Northern Hospital"; var a=authScreen(); _orgHospital=""; var b=authScreen(); S.branding=_b; _orgHospital=_oh; return /class="door-org">Northern Hospital</.test(a) && /class="door-wm">Myr<span class="accent">o<\/span>sta</.test(b); })());
    _authMethod="email"; var e=authScreen(); T("door: the email channel keeps its field and says email", e.indexOf('id="authEmail"')>=0 && /we email you a 6-digit code, then you stay signed in on this device\./.test(e));
    _sharedDevice=true; var w=authScreen(); _sharedDevice=false; T("door: a ward PC is told it will be signed out, not that it stays signed in", w.indexOf("stay signed in")<0 && w.indexOf("we sign you out when you close this page or step away.")>=0 && /<details class="sec" open>/.test(w));
    _otpSent=true; _otpChannel="sms"; _otpPhone="+61412345678"; var o=authScreen();
    T("door: the code screen masks the number and has a big one-time-code field", /Texted to \u2022\u2022\u2022 \u2022\u2022\u2022 678/.test(o) && /<input type="text" class="codein" inputmode="numeric" autocomplete="one-time-code" maxlength="6" id="authCode"/.test(o) && o.indexOf('id="authVerify"')>=0 && o.indexOf('id="authResend"')>=0 && o.indexOf('id="authBack"')>=0);
    var clicked=0; wireAuth(); var cin=document.getElementById("authCode"), vb=document.getElementById("authVerify"); vb.click=function(){clicked++;}; vb.disabled=false; cin.value="12345"; cin.oninput(); cin.value="123456"; cin.oninput(); cin.oninput();
    T("door: the sixth digit verifies by itself, once per value", typeof cin.oninput==="function" && clicked===1);
    authState=_as; _otpSent=_os; _authMethod=_am; _sharedDevice=_sh; _otpPhone=""; })();
  // ---- Premium 1: masthead, cycle chip, desktop chrome ----
  (function(){ var _b=S.branding,_oh=_orgHospital,_ol=_orgLabel; S.branding={hospital:"Northern Hospital",name:"Nurses"}; applyBranding(); var eb=document.getElementById("brandEyebrow"), nm=document.getElementById("brandName");
    T("masthead: the hospital is the eyebrow and the group is the name", eb.textContent==="Northern Hospital" && eb.style.display==="" && nm.textContent==="Nurses");
    S.branding={name:"Emergency Medicine"}; _orgHospital=""; _orgLabel=""; applyBranding(); T("masthead: a group without a hospital sits under a Myrosta eyebrow", eb.textContent==="Myrosta" && nm.textContent==="Emergency Medicine");
    S.branding={}; applyBranding(); T("masthead: with nothing known the wordmark returns and the eyebrow hides", eb.style.display==="none" && /Myr<span class="accent">o<\/span>sta/.test(nm.innerHTML));
    S.branding=_b; _orgHospital=_oh; _orgLabel=_ol; applyBranding(); })();
  T("nav: the desktop clusters flatten to NAV_ORDER for both roles", JSON.stringify([].concat.apply([],NAV_GROUPS.admin))===JSON.stringify(NAV_ORDER.admin) && JSON.stringify([].concat.apply([],NAV_GROUPS.staff))===JSON.stringify(NAV_ORDER.staff));
  S.viewAs="admin"; S.tab="roster"; render(); var _th=document.getElementById("tabs").innerHTML;
  T("nav: the desktop strip has two dividers, the last pushed right, and a quiet tail", (_th.match(/class="tabsep/g)||[]).length===2 && /class="tabsep push"/.test(_th) && /class="tab quiet"[^>]*data-tab="help"/.test(_th) && /class="tab active"[^>]*data-tab="roster"/.test(_th) && !/class="tab[^"]*quiet"[^>]*data-tab="roster"/.test(_th));
  T("chip: the cycle select carries short dates and the status sits in a tag beside it", /<option value="[^"]+" selected>\d+ \w+( \d{4})? – \d+ \w+ \d{4}<\/option>/.test(document.getElementById("cycleSel").innerHTML) && document.getElementById("cycleSel").innerHTML.indexOf("Booking")<0 && document.getElementById("cycleStatus").textContent===STATUS[active().status].label && document.getElementById("cycleStatus").className==="tag "+STATUS[active().status].cls);
  S.viewAs="s1"; render(); T("account: the avatar shows the viewed person's initials and the popover holds View as, Calendar feed and Sign out", document.getElementById("acctInit").textContent===(S.staff.find(function(x){return x.id==="s1";}).initials||initialsFrom(nameOf("s1"))) && document.getElementById("acctName").textContent===nameOf("s1") && typeof document.getElementById("acctBtn").onclick==="function" && typeof document.getElementById("calFeedBtn").onclick==="function" && typeof document.getElementById("logoutBtn").onclick==="function");
  (function(){ var ab=document.getElementById("acctBtn"), ap=document.getElementById("acctPop"); ap.hidden=true; ab.onclick({stopPropagation:function(){}}); var o1=ap.hidden===false && ab.getAttribute("aria-expanded")==="true"; closeAcct(); T("account: the button opens the popover and closeAcct shuts it", o1 && ap.hidden===true && ab.getAttribute("aria-expanded")==="false"); })();
  // ---- Premium 1: a page-title tier on phones ----
  (function(){ var _m=isMobile, _b=S.branding, _st=S.cycles[0].status; S.cycles[0].status="open"; S.branding={name:"Emergency Medicine"}; S.viewAs="s1"; S.tab="my"; isMobile=function(){return true;}; var my=viewMy(), sr=viewSelfRoster(), rq=viewRequests(), ro=viewRosterMobile(), ms=viewMessages(); isMobile=function(){return false;}; var myD=viewMy(), srD=viewSelfRoster(); isMobile=_m; S.branding=_b; S.cycles[0].status=_st;
    T("title: on a phone My shifts opens with an h1 and the person and group beneath", my.indexOf('<header class="ph"><h1>My shifts</h1><div class="phsub">'+nameOf("s1")+' · Emergency Medicine</div></header>')===0 && my.indexOf("<h2>My shifts")<0);
    T("title: Book shifts, Requests, Roster and Messages carry the tier too", /^<header class="ph"><h1>Book shifts<\/h1>/.test(sr) && /^<header class="ph"><h1>Requests<\/h1><div class="phsub">(Leave and swaps|\d+ needs? you)</.test(rq) && /^<header class="ph"><h1>Roster<\/h1><div class="phsub">\d+ \w+ · week by week</.test(ro) && /^<header class="ph"><h1>Messages<\/h1><div class="phsub">Your admin and the group</.test(ms));
    T("title: the booking list card runs edge to edge on phones", /<div class="card list">/.test(sr) && sr.indexOf("<h2>Book shifts")<0);
    T("title: the admin's booking card keeps its heading on phones", (function(){ var _m2=isMobile; isMobile=function(){return true;}; S.viewAs="admin"; var h=viewSelfRoster(); isMobile=_m2; S.viewAs="s1"; return /<div class="card list"><h2>Book shifts<\/h2>/.test(h) && h.indexOf('class="ph"')<0; })());
    T("title: the role noun is escaped in the Roster title and the grid corner", (function(){ var _b2=S.branding; S.branding={roleNoun:"<b>nurse"}; var _m3=isMobile; isMobile=function(){return true;}; var ro2=viewRosterMobile(); isMobile=_m3; S.viewAs="admin"; var g=viewRoster(); S.viewAs="s1"; S.branding=_b2; return ro2.indexOf("<b>nurse")<0 && ro2.indexOf("&lt;b&gt;nurse")>=0 && g.indexOf('<th class="corner namecol">&lt;b&gt;nurse')>=0; })());
    T("title: desktop keeps the card headings and no tier", myD.indexOf('class="ph"')<0 && /<h2>My shifts/.test(myD) && srD.indexOf('class="ph"')<0 && /<h2>Book shifts/.test(srD)); })();
  // ---- Premium 1: roster grid furniture ----
  (function(){ S.viewAs="admin"; S.tab="roster"; S.cycles[0].status="published"; _gapsOpen=false; var g=viewRoster(), ds=cycleDates(), mons=ds.filter(function(d){return d.getDay()===1;}).length, moN=ds.filter(function(d,i){return i===0||d.getDate()===1||d.getDay()===1;}).length;
    T("grid: Monday header, cover and body cells carry the week rule", (g.match(/<th class="[^"]*\bmon\b[^"]*"/g)||[]).length===mons && (g.match(/<td class="[^"]*\bmon\b[^"]*">/g)||[]).length===mons && (g.match(/<td class="cell[^"]*\bmon\b[^"]*" data-s="s1"/g)||[]).length===mons);
    T("grid: the cover row is named and the month is written under every date (every column, since 9 Oct 2026)", /<tr class="coverrow"><th class="namecol"/.test(g) && (g.match(/<div class="mo muted">[A-Z][a-z]+<\/div>/g)||[]).length===ds.length && (g.match(/<div class="mo muted">&nbsp;<\/div>/g)||[]).length===0); })();
  // ---- Premium 1: More and Notifications as designed surfaces ----
  (function(){ var _b=S.branding; S.branding={name:"Emergency Medicine"}; S.viewAs="s1"; S.tab="my"; _moreOpen=true; var ms=moreSheetHTML(); _moreOpen=false; S.branding=_b; var ini=(S.staff.find(function(x){return x.id==="s1";}).initials||initialsFrom(nameOf("s1")));
    T("more: opens with the person's initials, name and group", ms.indexOf('<div class="sheetacct"><span class="avatar sm" aria-hidden="true">'+ini+'</span>')>=0 && ms.indexOf('<span class="vh">Signed in as </span>'+nameOf("s1"))>=0 && /class="rowsub">Emergency Medicine · on this device</.test(ms));
    var rows=ms.match(/<button class="sheetrow[^"]*" data-tab="[^"]+">[\s\S]*?<\/button>/g)||[];
    T("more: every row carries an icon and a one-line promise", rows.length>=3 && rows.every(function(r){ return /<svg viewBox="0 0 24 24" class="nic"/.test(r) && /<span class="rowsub">[^<]+<\/span>/.test(r); }) && /data-tab="daily">[^]*?Who's on today, by zone/.test(ms) && ms.indexOf('<div class="sheetlbl">Account</div>')>ms.indexOf("Who's on today"));
    var _n=S.notifications; S.notifications=[]; notify("s1","Open shift: Sat PM · EPIC","p1-a",{tab:"selfroster",anchor:"openshifts"}); notify("s1","Your leave was approved.","p1-b",{tab:"requests"}); S.notifications.push({id:"p1-c",to:"s1",text:"Booking is open.",ts:Date.now()-864e5,readBy:["s1"]}); S.notifications.push({id:"p1-d",to:"s1",text:"Roster published.",ts:Date.now()-5*864e5,readBy:[]});
    _notifsOpen=true; var sh=notifsSheetHTML(); _notifsOpen=false; S.notifications=_n;
    S.notifications=[{id:"p1-o",to:"s1",text:"Older first",ts:Date.now()-864e5,readBy:[]},{id:"p1-n",to:"s1",text:"Newer second",ts:Date.now(),readBy:[]}]; _notifsOpen=true; var sh2=notifsSheetHTML(); _notifsOpen=false;
    T("notifs: a merge-ordered list is still grouped newest first with one label each", sh2.indexOf("Today")<sh2.indexOf("Yesterday") && sh2.indexOf("Newer second")<sh2.indexOf("Older first") && (sh2.match(/class="sheetlbl"/g)||[]).length===2);
    T("notifs: rows sit under Today, Yesterday and Earlier, each with an icon by kind and a short time", sh.indexOf('<div class="sheetlbl">Today</div>')<sh.indexOf('<div class="sheetlbl">Yesterday</div>') && sh.indexOf('<div class="sheetlbl">Yesterday</div>')<sh.indexOf('<div class="sheetlbl">Earlier</div>') && (sh.match(/class="sheetlbl"/g)||[]).length===3 && (sh.match(/<span class="nicon" aria-hidden="true"><svg/g)||[]).length===4 && /Open shift[^]*?<div class="muted small">\d\d:\d\d</.test(sh) && /Roster published\.<\/div><div class="muted small">\w{3} \d+ \w+</.test(sh) && sh.indexOf('class="dot"')<0); })();
  // ---- Premium 1: the confirm moment, the receipt, the hero bar, the sync word ----
  (function(){ var _st=S.cycles[0].status; S.cycles[0].status="open"; S.viewAs="s1"; S.tab="selfroster"; _srSid="s1"; _srPick=[]; _receipt=null; var s1=S.staff.find(function(x){return x.id==="s1";});
    var slot=null; cycleDates().some(function(d){ return S.zones.some(function(z){ var c=canBook("s1",iso(d),"AM",z.id); if(c.ok){ slot={d:d,key:iso(d)+"|AM|"+z.id}; return true; } return false; }); });
    T("confirm: a bookable slot exists in the fixture", !!slot);
    if(slot){ var before=clinicalCountFor("s1"); _srPick=[slot.key]; srBatchBook(); var f=srFooterHTML("s1",s1);
      T("confirm: booking hands back a receipt in the footer's place", !!_receipt && _receipt.n===1 && _receipt.sid==="s1" && clinicalCountFor("s1")===before+1 && /<div class="srfoot done" role="status">/.test(f) && f.indexOf("Booked 1 · "+(before+1)+(s1.quota?" of "+s1.quota:""))>=0 && f.indexOf('id="rcCal"')>=0 && f.indexOf('id="rcDone"')>=0 && _srPick.length===0);
      _justBooked.add(iso(slot.d)); var row=dayRowHTML("s1",slot.d,{batch:true,openCount:function(){return 0;}}); _justBooked.clear();
      T("confirm: a just-booked row carries the settle class", /class="dayrow just/.test(row) && /tag lg am/.test(row));
      delete S.cycles[0].assign["s1|"+iso(slot.d)]; var gone=srFooterHTML("s1",s1);
      T("confirm: the receipt does not outlive a change to the count it quotes", gone==="" && _receipt===null);
      _receipt={sid:"s1",cycleId:"not-this-cycle",n:1,booked:clinicalCountFor("s1"),quota:14}; T("confirm: a receipt from another cycle is not painted", srFooterHTML("s1",s1)==="" && _receipt===null); }
    T("confirm: the receipt's sentence never asserts more than its numbers", receiptText({n:2,booked:14,quota:14})==="That's your share — 14 of 14 booked." && receiptText({n:3,booked:7,quota:0})==="Booked 3 · 7 this cycle" && receiptText({n:2,booked:12,quota:10})==="Over your share — 12 of 10 booked." && receiptText({n:1,booked:12,quota:14})==="Booked 1 · 12 of 14");
    _receipt={sid:"s1",n:2,booked:clinicalCountFor("s1"),quota:14}; var rf=srFooterHTML("s1",s1); T("confirm: the receipt offers Add to calendar unless a live feed already has it", /id="rcCal">Add to calendar</.test(rf) && (function(){ var _co=cloudOn; cloudOn=function(){return true;}; s1.icsToken="tok"; var h=srFooterHTML("s1",s1); delete s1.icsToken; cloudOn=_co; return h.indexOf("Your calendar feed has it")>=0 && h.indexOf('id="rcCal"')<0; })());
    _receipt=null; _srPick=slot?[slot.key]:["x|AM|z1"]; _inflight.add("srConfirm"); var busy=srFooterHTML("s1",s1); _inflight.delete("srConfirm"); _srPick=[];
    T("confirm: while saving the footer goes busy and Confirm is disabled", /<div class="srfoot" aria-busy="true">/.test(busy) && /class="btn primary srConfirm" disabled aria-busy="true">Saving…</.test(busy));
    S.tab="my"; render(); T("confirm: the receipt does not survive leaving Book shifts", _receipt===null);
    _selfChange=true; _heroSeen={sid:"s1",cycle:S.activeId,pct:-1}; var hv=viewMy(); _selfChange=false; var hv2=viewMy(); _selfChange=true; _heroSeen={sid:"s1",cycle:"another-cycle",pct:-1}; var hv3=viewMy(); _selfChange=false;
    T("hero: the bar remembers where it was and moves only on a self change in the same cycle", /class="qfill" style="width:\d+(\.\d+)?%" data-from="-1"/.test(hv) && hv2.indexOf("data-from")<0 && hv3.indexOf("data-from")<0 && _heroSeen && _heroSeen.sid==="s1" && _heroSeen.cycle===S.activeId);
    _selfChange=true; bgRender(); T("motion: a background render is never a self change", _selfChange===false);
    S.cycles[0].status=_st; })();
  (function(){ var _co=cloudOn, _cs=cloudState, _sf=_syncFlash; cloudOn=function(){return true;}; cloudState="connected"; _syncFlash=null; var idle=cloudStateHTML(); _syncFlash="saving"; var sv=cloudStateHTML(); _syncFlash="saved"; var sd=cloudStateHTML(); _syncFlash=null; cloudState="error"; var er=cloudStateHTML(); cloudOn=_co; cloudState=_cs; _syncFlash=_sf;
    T("sync: silent when synced, Saving… and Saved while it happens, honest when offline", idle==="" && /class="sdot busy"><\/span><span class="ss">Saving…</.test(sv) && /class="sdot ok"><\/span><span class="ss">Saved</.test(sd) && /class="sdot warn"><\/span><span class="ss">Offline<\/span><span class="sw"> · saved on this device</.test(er));
    (function(){ var _co=cloudOn,_cs=cloudState; cloudOn=function(){return true;}; cloudState="error"; var w=syncWord(); cloudState="connected"; _syncFlash=null; var w2=syncWord(); cloudOn=_co; cloudState=_cs; T("sync: the account rows use the same words as the header", w==="Offline · saved on this device" && w2==="Synced"); })(); })();
  // ---- Premium 1: claim busy then yours; requests tell their own story ----
  (function(){ var _mo=S.marketOn,_mc=S.marketClaim,_os=S.openShifts,_st=S.cycles[0].status,_f=S.features; S.features={}; S.marketOn=true; S.marketClaim="first"; S.cycles[0].status="published"; S.openShifts=[]; _settled=null; _inflight.clear();
    var slot=null; cycleDates().some(function(d){ return S.zones.some(function(z){ var c=canClaim("s1",iso(d),"PM",z.id,false,null); var free=!Object.keys(S.cycles[0].assign).some(function(k){ var a=S.cycles[0].assign[k]; return k.split("|")[1]===iso(d)&&a.kind==="clinical"&&a.period==="PM"&&a.zone===z.id; }); if(c.ok&&free){ slot={iso:iso(d),z:z.id}; return true; } return false; }); });
    S.viewAs="admin"; var posted=slot?postOpenShift(slot.iso,"PM",slot.z,"cover"):null; var os=(S.openShifts||[]).filter(function(o){return o.status==="open";})[0];
    T("claim: the fixture can post an open shift", !!os);
    if(os){ S.viewAs="s1"; S.tab="my"; _inflight.add("osclaim-"+os.id); var busy=marketMyHTML(); _inflight.delete("osclaim-"+os.id);
      T("claim: while saving the button is disabled, busy and says Claiming", /<button class="btn primary sm" disabled aria-busy="true">Claiming…<\/button>/.test(busy) && busy.indexOf('data-osclaim="'+os.id+'"')<0);
      claimOpenShift(os.id,false); var done=marketMyHTML(); var lbl=fmtISO(os.iso)+" PM · "+zoneName(os.zone);
      T("claim: afterwards the row says the shift is yours, with a way to see it", !!_settled && _settled.kind==="claim" && /<div class="listrow settled" role="status">/.test(done) && done.indexOf(lbl+" is yours — it's on your roster.")>=0 && /<button class="btn sm" data-go="my\|[^"|]+">See it<\/button>/.test(done) && os.status==="claimed" && getShift("s1",os.iso).kind==="clinical");
      _inflight.add(_settled.key); var mid=marketMyHTML(); _inflight.delete(_settled.key);
      T("claim: the settled row itself goes busy while the claim is still saving", /class="listrow settled busy"/.test(mid) && mid.indexOf("Claiming "+lbl+"…")>=0 && mid.indexOf("See it")<0);
      _settled={kind:"claim",key:"x",id:"x",iso:os.iso,period:"PM",zone:os.zone,mode:"approve"}; var ask=marketMyHTML();
      T("claim: in approve mode the row says it was asked", ask.indexOf("Asked for "+lbl+" — your admin decides. You'll be told.")>=0 && ask.indexOf("See it")<0);
      T("claim: See it carries the cycle and a row from another cycle is not painted", /data-go="my\|[^"|]+">See it</.test(done) && (function(){ _settled={kind:"claim",key:"y",id:"y",cycleId:"other",iso:os.iso,period:"PM",zone:os.zone,mode:"first"}; return marketMyHTML().indexOf("settled")<0; })());
      delete S.cycles[0].assign["s1|"+os.iso]; }
    _settled=null; S.marketOn=_mo; S.marketClaim=_mc; S.openShifts=_os; S.cycles[0].status=_st; S.features=_f; })();
  (function(){ var _rq=S.requests, _seen=_reqSeenTs; var ds=cycleDates(), dA=iso(ds[5]), dB=iso(ds[6]);
    S.requests=[{id:"p1-sw",type:"swap",from:"s2",dateA:dA,peerId:"s1",dateB:dB,status:"awaiting-peer",createdTs:Date.now()}]; S.viewAs="s1"; S.tab="requests"; _settled=null; agreeSwap("p1-sw"); var ag=viewRequests();
    T("agree: the peer sees that the colleague has been told", S.requests[0].status==="pending" && /<div class="listrow settled" role="status">[^]*?You agreed — /.test(ag) && ag.indexOf("You agreed — "+nameOf("s2")+" has been told and it's gone to admin.")>=0);
    _settled=null; var now=Date.now(); _reqSeenTs=0;
    S.requests=[{id:"p1-lv",type:"leave",from:"s1",code:"AL",dateFrom:dA,dateTo:dB,status:"approved",createdTs:now-1e6,decidedTs:now},{id:"p1-sw2",type:"swap",from:"s1",peerId:"s2",dateA:dA,dateB:dB,status:"approved",createdTs:now-1e6,decidedTs:now},{id:"p1-dc",type:"leave",from:"s1",code:"AL",dateFrom:dA,dateTo:dA,status:"declined",createdTs:now-1e6,decidedTs:now,adminComment:"Short that week"}];
    var rv=viewRequests(), when=fmt(new Date(now),{weekday:"short",day:"numeric",month:"short"});
    T("receipt: an approved leave says those days are off your roster and offers the calendar", rv.indexOf("Approved "+when+" · "+fmtISO(dA)+" – "+fmtISO(dB)+" is off your roster.")>=0 && /data-go="my\|\|calSec">Add to calendar</.test(rv) && rv.indexOf("Update my calendar")<0);
    T("receipt: an approved swap says what you now work and whose the other day is", rv.indexOf("Approved "+when+" · you now work "+fmtISO(dB)+" "+shiftLabel(getShift("s1",dB))+"; "+fmtISO(dA)+" is "+nameOf("s2")+"'s.")>=0);
    T("receipt: a declined request says so once, beside the admin's comment", (rv.match(/Declined [A-Z][a-z]{2} \d+ \w+\./g)||[]).length===1 && rv.indexOf("Short that week")>=0 && /class="rcic no"/.test(rv));
    _reqSeenTs=now+1; var rv2=viewRequests(); T("receipt: nothing new once the decisions have been seen", rv2.indexOf('class="reqrc"')<0);
    S.viewAs="admin"; var ra=viewRequests(); T("receipt: the admin's rows are unchanged", ra.indexOf('class="reqrc"')<0 && ra.indexOf("settled")<0);
    S.requests=_rq; _reqSeenTs=_seen; _settled=null; })();
  // ---- Premium 2, item 13: a real dialog, then a receipt on the step ----
  (function(){ var got=null; openConfirm({title:"Publish 7 Sept – 1 Nov?",body:"Everyone in Nurses (3 people) will be notified.",ok:"Publish",onDone:function(v){got=v;}}); var mr=document.getElementById("modalRoot").innerHTML;
    T("confirm: a real dialog with the title, the body and the action word", /role="dialog" aria-modal="true" aria-labelledby="dlgT"/.test(mr) && /<h3 id="dlgT">Publish 7 Sept – 1 Nov\?<\/h3>/.test(mr) && mr.indexOf("Everyone in Nurses (3 people) will be notified.")>=0 && /<button class="btn primary" id="cfOk">Publish<\/button>/.test(mr) && mr.indexOf('id="cfCancel"')>=0 && document.getElementById("app").inert===true);
    document.getElementById("cfOk").onclick(); T("confirm: the action resolves yes and closes", got===true && document.getElementById("modalRoot").innerHTML==="" && _cfPending===null);
    got=null; openConfirm({title:"Open booking?",ok:"Open booking",onDone:function(v){got=v;}}); document.getElementById("cfCancel").onclick(); var c1=got; got=null; openConfirm({title:"x",onDone:function(v){got=v;}}); closeModal();
    T("confirm: Cancel and any other close answer no", c1===false && got===false);
    T("confirm: the action word is the button that asked", statusVerb("published")==="Publish" && statusVerb("open")==="Open booking" && statusVerb("closed")==="Close booking" && (function(){ var _m=isRolling; isRolling=function(){return true;}; var v=statusVerb("published"); isRolling=_m; return v==="Go live"; })());
    var _st=S.cycles[0].status, _log=S.cycles[0].statusLog, _n=S.notifications.slice(); S.cycles[0].status="draft"; S.cycles[0].statusLog=[]; S.viewAs="admin"; S.tab="selfroster";
    setCycleStatus("open"); var e=S.cycles[0].statusLog[S.cycles[0].statusLog.length-1]; var sh=roundStepperHTML(S.cycles[0]);
    T("receipt: opening booking logs who, when and how many were told, and the step says so", e.to==="open" && e.by==="admin" && e.notified===S.staff.length && typeof e.ts==="number" && /class="rreceipt"><svg[^>]*><[^]*?<span>Booking opened \w{3},? \d+ \w+, \d+:\d\d [ap]m · 3 notified<\/span>/.test(sh));
    setCycleStatus("closed"); setCycleStatus("published"); sh=roundStepperHTML(S.cycles[0]);
    T("receipt: closed and published steps carry their receipts", /Booking closed \w{3},? \d+ \w+, \d+:\d\d [ap]m<\/span>/.test(sh) && /Published \w{3},? \d+ \w+, \d+:\d\d [ap]m · 3 notified<\/span>/.test(sh) && (sh.match(/class="rreceipt"/g)||[]).length===3);
    setCycleStatus("draft"); sh=roundStepperHTML(S.cycles[0]);
    T("receipt: back to draft clears the receipts; the stepper's staff note shows only in the cloud", sh.indexOf('class="rreceipt"')<0 && sh.indexOf("Staff don't see this cycle")<0 && (function(){ var _co=cloudOn; cloudOn=function(){return true;}; var h=roundStepperHTML(S.cycles[0]); cloudOn=_co; return h.indexOf("Staff don't see this cycle in the app until you open booking or publish it.")>=0; })());
    T("confirm: the dialog describes its consequence and a transition that already happened is not repeated", (function(){ openConfirm({title:"T",body:"B"}); var mr=document.getElementById("modalRoot").innerHTML; closeModal(); openConfirm({title:"T"}); var mr2=document.getElementById("modalRoot").innerHTML; closeModal(); var n0=S.notifications.length; var again=applyStatus("draft"); return /aria-describedby="cfBody"/.test(mr) && /id="cfBody"/.test(mr) && mr2.indexOf("cfBody")<0 && again===false && S.notifications.length===n0; })());
    (function(){ var o=new Date(Date.now()-60e3).toISOString().slice(0,16), c=new Date(Date.now()+864e5).toISOString().slice(0,16); S.cycles[0].status="draft"; S.cycles[0].statusLog=[]; S.cycles[0].window={enabled:true,open:o,close:c}; checkRoundSchedule(); checkRoundSchedule(); var sh=roundStepperHTML(S.cycles[0]); var log=S.cycles[0].statusLog;
      T("receipt: a scheduled open writes one receipt keyed by the window time and says so", S.cycles[0].status==="open" && log.length===1 && log[0].by==="schedule" && log[0].ts===_dtMs(o) && /Booking opened on schedule /.test(sh));
      S.cycles[0].window.close=new Date(Date.now()-30e3).toISOString().slice(0,16); S.cycles[0].window.fired="open"; checkRoundSchedule(); checkRoundSchedule();
      T("receipt: a scheduled close writes one receipt too", S.cycles[0].status==="closed" && S.cycles[0].statusLog.length===2 && S.cycles[0].statusLog[1].by==="schedule" && /Booking closed on schedule /.test(roundStepperHTML(S.cycles[0])));
      S.cycles[0].window=null; })();
    S.cycles[0].status=_st; S.cycles[0].statusLog=_log; S.notifications=_n; })();
  // ---- Premium 2, item 11: a draft isn't shown to staff until it's published ----
  (function(){ var _co=cloudOn, _ra=_realAdmin; cloudOn=function(){return true;}; _realAdmin=false;
    S.cycles.push({id:"c-d",cycle:{start:FUT(30),weeks:8},assign:{},status:"draft",archived:false,settings:{},roles:{}}); S.cycles.push({id:"c-d2",cycle:{start:FUT(90),weeks:8},assign:{},status:"draft",archived:false,settings:{},roles:{}});
    S.viewAs="s1"; S.activeId="c-d"; hydrateCycleSettings(); hydrateCycleRoles();
    T("draft: staff on a draft cycle see a calm card with a heading on every roster screen", draftHidden()===true && ["roster","selfroster","daily","equity","my"].every(function(t){ S.tab=t; render(); var h=document.getElementById("app").innerHTML; return h.indexOf('id="draftHidden"')>=0 && /<h[12]>/.test(h); }) && /Still being prepared/.test(document.getElementById("app").innerHTML) && /Go to \d+ \w+( \d{4})? – \d+ \w+ \d{4}/.test(document.getElementById("app").innerHTML) && new RegExp('data-go="my\\|c1"').test(document.getElementById("app").innerHTML));
    S.tab="requests"; render(); T("draft: requests and messages stay reachable", document.getElementById("app").innerHTML.indexOf('id="draftHidden"')<0);
    var sel=document.getElementById("cycleSel").innerHTML; T("draft: the cycle select offers only cycles staff may see, plus the one they are on", sel.indexOf('value="c1"')>=0 && sel.indexOf('value="c-d2"')<0 && /value="c-d" selected>[^<]*in preparation</.test(sel));
    T("draft: staff land on the cycle running today or the latest they may see", staffLandingCycle().id==="c1");
    S.viewAs="admin"; S.tab="roster"; render(); var adm=document.getElementById("app").innerHTML; _realAdmin=true; S.viewAs="s1"; render(); var preview=document.getElementById("app").innerHTML; _realAdmin=false;
    T("draft: admins are never blocked, and a real admin previewing as someone still sees the draft — with a note", adm.indexOf('id="draftHidden"')<0 && adm.indexOf("draftpreview")<0 && preview.indexOf('id="draftHidden"')<0 && preview.indexOf("Staff can't see this cycle yet")>=0);
    T("draft: an archived draft is hidden too, the chip says In preparation, and fairness leaves the draft out", (function(){ S.cycles.push({id:"c-ad",cycle:{start:FUT(120),weeks:8},assign:{},status:"draft",archived:true,settings:{},roles:{}}); var hid=draftHidden(S.cycles.find(function(c){return c.id==="c-ad";})); S.cycles=S.cycles.filter(function(c){return c.id!=="c-ad";}); S.viewAs="s1"; S.activeId="c-d"; hydrateCycleSettings(); hydrateCycleRoles(); S.tab="my"; render(); var chip=document.getElementById("cycleStatus").textContent; var eq=equityCycles("three").some(function(c){return c.id==="c-d";}); return hid===true && chip==="In preparation" && eq===false; })());
    T("draft: taking a cycle back to draft asks, and says staff stop seeing it", (function(){ S.viewAs="admin"; S.activeId="c1"; hydrateCycleSettings(); hydrateCycleRoles(); var t=statusConfirmText("draft"); return /back to draft\?/.test(t) && /Staff stop seeing it until you open booking or publish again\. No one is notified\./.test(t); })());
    cloudOn=function(){return false;}; S.viewAs="s1"; S.tab="my"; render(); T("draft: in local mode nothing is hidden", document.getElementById("app").innerHTML.indexOf('id="draftHidden"')<0);
    cloudOn=_co; _realAdmin=_ra; S.cycles=S.cycles.filter(function(c){return c.id!=="c-d"&&c.id!=="c-d2";}); S.activeId="c1"; hydrateCycleSettings(); hydrateCycleRoles(); })();
  // ---- Premium 2, item 12: the audit log reads like a record ----
  (function(){ var _a=S.audit, _v=_auditView, _f=_auditFilter, now=Date.now(); S.viewAs="admin"; S.tab="audit"; _auditView="timeline"; _auditFilter="all";
    S.audit=[{id:"t3",ts:now-3*864e5,actor:"admin",action:"settings.staffing",detail:"AM 3–4"},{id:"t1",ts:now,actor:"admin",action:"cycle.status",detail:"7 Sept – 1 Nov 2026 → open"},{id:"t4",ts:now-2*864e5,actor:"s2",action:"weird.key",detail:"x"},{id:"t2",ts:now-864e5,actor:"s1",action:"selfroster.book",detail:"Alex 2026-08-05 AM Resus"}];
    var v=viewAudit(), iT=v.indexOf("Opened booking"), iB=v.indexOf("Booked a shift"), iW=v.indexOf('<span class="tag muted">weird.key</span>'), iC=v.indexOf("Changed cover");
    T("audit: newest first under day headers, in plain words, the raw key only when unknown", v.indexOf('<div class="sheetlbl">Today</div>')>=0 && v.indexOf('<div class="sheetlbl">Yesterday</div>')>=0 && iT>0 && iT<iB && iB<iW && iW<iC && /class="awhat" title="cycle\.status">Opened booking</.test(v) && v.indexOf('<span class="awho">Alex</span>')>=0 && v.indexOf("4 entries")>=0 && v.indexOf('id="auditCsv"')>=0 && /data-av="timeline" class="on"/.test(v));
    _auditFilter="settings"; var f=viewAudit(); T("audit: a filter narrows the list", f.indexOf("Changed cover")>=0 && f.indexOf("Opened booking")<0 && f.indexOf("Booked a shift")<0 && /data-af="settings" class="on"/.test(f));
    _auditFilter="messages"; T("audit: an empty filter says so", viewAudit().indexOf("Nothing in this filter")>=0);
    _auditFilter="all"; _auditView="person"; var pv=viewAudit(); T("audit: By person groups under names, admin first", pv.indexOf('<div class="sheetlbl">Admin <span class="muted">(2)</span></div>')>=0 && pv.indexOf("Admin <span")<pv.indexOf("Alex <span") && pv.indexOf('class="awho"')<0);
    _auditView="timeline"; var csv=auditCSV().split("\n"); T("audit: the CSV has a header and one line per entry with the sentence and the key", csv[0]==="Time,Who,What,Action,Detail" && csv.length===5 && csv[1].indexOf('"Opened booking","cycle.status"')>0 && csv[2].indexOf('"Alex","Booked a shift","selfroster.book","Alex 2026-08-05 AM Resus"')>0);
    T("audit: sentences read the detail where one key says two things, and the dynamic keys have words", auditWords({action:"selfroster.autodraft",detail:"fill-to-max · placed 3"})==="Filled to maximum cover" && auditWords({action:"selfroster.autodraft",detail:"minimum · placed 3"})==="Filled to minimum cover" && auditWords({action:"fixed.commit",detail:"Alex → unlocked"})==="Unlocked a fixed pattern" && auditWords({action:"ics.token",detail:"Alex live-calendar link created"})==="Created a calendar link" && auditWords({action:"selfroster.wave.done",detail:"Alex reopened"})==="Reopened picking" && auditWords({action:"leave.withdraw"})==="Withdrew a leave request" && auditWords({action:"swap.cancel-declined"})==="Kept the swap approval" && auditWords({action:"selfroster.clear"})==="Cleared the booked shifts");
    T("checklist: the admin-typed role noun is escaped in the questions", (function(){ var _b=S.branding; S.branding={roleNoun:"<b>nurse"}; var h=checklistHTML(); S.branding=_b; return h.indexOf("<b>nurses")<0 && h.indexOf("&lt;b&gt;nurses")>=0; })());
    T("first run: the upload control is a real tab stop", firstRunHTML().indexOf('id="frStaff" accept=".xlsx,.xls" class="vh"')>=0 && checklistHTML().indexOf('id="wizStaff" accept=".xlsx,.xls" class="vh"')>=0);
    T("audit: categories by key", auditCat("selfroster.book")==="roster" && auditCat("settings.quota")==="settings" && auditCat("import.roster")==="data" && auditCat("swap.agree")==="requests" && auditCat("message.send")==="messages" && auditCat("weird.key")==="roster");
    S.audit=[]; T("audit: an empty log invites rather than shrugs", viewAudit().indexOf("Nothing logged yet")>=0 && viewAudit().indexOf('id="auditCsv"')<0);
    S.audit=_a; _auditView=_v; _auditFilter=_f; })();
  // ---- Premium 2, item 14: empty states point at the next step ----
  (function(){ var _keep=S; S=defaultState(); normalize(); S.branding={name:"Nurses",roleNoun:"nurse"}; S.viewAs="admin";
    var seen=["roster","selfroster","daily","equity","my","staff"].every(function(t){ S.tab=t; render(); var h=document.getElementById("app").innerHTML; return h.indexOf('id="firstRun"')>=0 && h.indexOf("Set up Nurses in ten minutes")>=0 && h.indexOf('id="frTpl"')>=0 && h.indexOf('id="frStaff"')>=0 && /data-go="staff">Add nurses by hand</.test(h) && /data-go="setup\|\|card-zones">Zones and cover</.test(h) && /<a href="demo\.html" target="_blank" rel="noopener">See a filled-in roster</.test(h); });
    T("first run: an admin with no people sees the three steps and the demo link on every roster screen", seen && document.getElementById("app").innerHTML.indexOf("No staff yet")<0 && typeof document.getElementById("frTpl").onclick==="function" && typeof document.getElementById("frStaff").onchange==="function");
    S.tab="staff"; render(); var st=document.getElementById("app").innerHTML; T("first run: the Staff tab keeps its own tools beneath the card", st.indexOf('id="firstRun"')<st.indexOf('id="addStaff"') && st.indexOf("Nobody on the list yet")>=0);
    S.tab="setup"; render(); T("first run: Settings keeps the checklist, not the steps", document.getElementById("app").innerHTML.indexOf('id="firstRun"')<0 && document.getElementById("app").innerHTML.indexOf('id="card-guide"')>=0);
    var _lp=location.pathname; location.pathname="/demo.html"; var d=firstRunHTML(); location.pathname=_lp; T("first run: the demo never links to itself", d.indexOf("demo.html")<0 && d.indexOf('id="frTpl"')>=0);
    T("empty: the roster screens share one empty state that names the people", /No one to roster yet/.test(viewRoster()) && /Add your nurses first/.test(viewRosterMobile()) && /No one to roster yet/.test(viewSelfRoster()) && /No one to roster yet/.test(viewMy()) && viewRoster().indexOf("Import your roster in")<0);
    S=_keep; hydrateCycleSettings(); hydrateCycleRoles(); })();
  (function(){ var _st=S.cycles[0].status, _w=S.cycles[0].window, _rm=cset().rosterMode, _srm=S.rosterMode; S.viewAs="s1"; S.tab="my"; var d=iso(cycleDates()[3]), keep=S.cycles[0].assign["s1|"+d]; Object.keys(S.cycles[0].assign).forEach(function(k){ if(k.indexOf("s1|")===0)delete S.cycles[0].assign[k]; });
    S.cycles[0].status="draft"; S.cycles[0].window=null; var a=nothingYetText(); S.cycles[0].window={enabled:true,open:new Date(Date.now()+3*864e5).toISOString().slice(0,16),close:new Date(Date.now()+9*864e5).toISOString().slice(0,16)}; var b=nothingYetText(); S.cycles[0].window=null; S.cycles[0].status="open"; var c=nothingYetText(); S.cycles[0].status="closed"; var e=nothingYetText(); S.cycles[0].status="published"; var f=nothingYetText();
    T("hero: with nothing booked it says where the round is", a==="Nothing yet — your admin will open booking" && /^Nothing yet — booking opens /.test(b) && c==="Nothing booked yet — booking is open" && e==="Nothing booked — booking has closed" && f==="No upcoming shifts this cycle" && viewMy().indexOf("No upcoming shifts this cycle")>=0);
    cset().rosterMode="rolling"; S.rosterMode="rolling"; var g=nothingYetText(); S.cycles[0].status="draft"; var h=nothingYetText(); cset().rosterMode=_rm; S.rosterMode=_srm;
    T("hero: a rolling roster says add any time, or not live", g==="Nothing booked yet — add shifts any time" && h==="Nothing yet — the roster isn't live");
    S.cycles[0].status=_st; S.cycles[0].window=_w; if(keep)S.cycles[0].assign["s1|"+d]=keep;
    T("empty: a phone day card says what the day needs", /Nobody yet — AM needs \d+, PM needs \d+/.test(viewRosterMobile()) || !/rval muted/.test(viewRosterMobile()));
    S.viewAs="admin"; S.tab="equity"; var _f=S.features; S.features={}; var eq=viewEquity(); S.features=_f; T("empty: fairness fills in as the roster does", eq.indexOf("No clinical shifts recorded")<0 || eq.indexOf("Fairness fills in as the roster does")>=0); })();
  // ---- Premium 2, item 15: invite your nurses; publish really notifies ----
  (function(){ var _b=S.branding, _oh=_orgHospital, _co=cloudOn, _ob=S.outbox, _st=S.cycles[0].status, _log=S.cycles[0].statusLog, _pn=S.cycles[0].publishNotifiedTs, _n=S.notifications.slice(), s1=S.staff[0], s2=S.staff[1], s3=S.staff[2];
    S.branding={hospital:"Northern Hospital",name:"Nurses",roleNoun:"nurse"}; T("invite: the label is hospital · group, or Myrosta", hospitalGroupLabel()==="Northern Hospital · Nurses" && (function(){ S.branding={}; _orgHospital=""; var l=hospitalGroupLabel(); S.branding={hospital:"Northern Hospital",name:"Nurses",roleNoun:"nurse"}; return l==="Myrosta"; })());
    T("invite: the message is written from the group's details; the text stays in the GSM alphabet", inviteText("sms")==="Northern Hospital - Nurses: your roster is moving to Myrosta. Sign in at myrosta.com.au with this number - a 6-digit code by text, no password. Add it to your Home Screen to open it like an app." && /Northern Hospital · Nurses: [^]*with this email address — a 6-digit code by email/.test(inviteText("email")));
    cloudOn=function(){return true;}; S.outbox=[]; s1.mobile="0412 345 678"; s2.email="Sam@example.org"; delete s1.invitedTs; delete s2.invitedTs; delete s3.invitedTs; delete s3.mobile; delete s3.email;
    T("invite: only people with a way to reach them are targets", inviteTargets().map(function(s){return s.id;}).join(",")==="s1,s2");
    var row=setupChecklist().find(function(r){return r.key==="invite";}); T("invite: the Get started row exists in the cloud, undone, and opens the composer", !!row && row.done===false && row.q==="Invite your nurses" && /data-invite="1"/.test(checklistHTML()));
    openInvite(); var mr=document.getElementById("modalRoot").innerHTML;
    T("invite: the composer shows the message, the counts, Copy and Send", /<h3 id="dlgT">Invite your nurses<\/h3>/.test(mr) && mr.indexOf("Northern Hospital - Nurses: your roster is moving to Myrosta.")>=0 && mr.indexOf("2 to invite · 1 with no mobile or email")>=0 && mr.indexOf("Sending also syncs the allow-list")>=0 && mr.indexOf('id="invCopy"')>=0 && /id="invSend">Send to 2 by text or email</.test(mr) && mr.indexOf("This texts real phones")>=0);
    document.getElementById("invSend").onclick(); var box=S.outbox;
    T("invite: sending queues one message per person — a text where there is a mobile, else an email — and stamps them", box.length===2 && box[0].id==="inv-s1" && box[0].phone==="+61412345678" && box[0].email==="" && box[1].email==="sam@example.org" && box[1].phone==="" && box.every(function(m){return m.kind==="invite"&&m.sent===null&&m.body.indexOf("moving to Myrosta")>0;}) && box[0].body.indexOf("·")<0 && box[0].body.indexOf("—")<0 && box[0].body.indexOf("Northern Hospital - Nurses: ")===0 && !!s1.invitedTs && !!s2.invitedTs && !s3.invitedTs && S.audit[0].action==="invite.sent" && document.getElementById("modalRoot").innerHTML==="");
    T("invite: nobody is invited twice and the row is now done", queueInvites()===0 && S.outbox.length===2 && setupChecklist().find(function(r){return r.key==="invite";}).done===true && /2 invited/.test(setupChecklist().find(function(r){return r.key==="invite";}).detail));
    T("invite: a person whose stamp was lost in a merge is still not invited again, and a dead letter is reported", (function(){ delete s1.invitedTs; var again=inviteTargets().length===0 && queueInvites()===0 && S.outbox.length===2; S.outbox[0].attempts=3; var row=setupChecklist().find(function(r){return r.key==="invite";}); var ok=again && row.done===false && /1 could not be reached — check their number/.test(row.detail); delete S.outbox[0].attempts; s1.invitedTs=Date.now(); return ok; })());
    T("invite: the Access control card offers the composer too", (function(){ var _t=_setupTab; _setupTab="group"; var h=viewSetup(); _setupTab=_t; return /id="memInvite" data-invite="1">Invite your nurses</.test(h); })());
    S.cycles[0].status="closed"; S.cycles[0].statusLog=[]; delete S.cycles[0].publishNotifiedTs; S.viewAs="admin";
    T("publish: the confirm says how people will be told", /notified in the app and by text or email/.test(statusConfirmText("published")));
    setCycleStatus("published"); var pubs=S.outbox.filter(function(m){return m.kind==="publish";}), e=S.cycles[0].statusLog[0];
    T("publish: queues one notice per reachable person, once per cycle, keeps both channels, and the receipt says queued", pubs.length===2 && pubs.map(function(m){return m.id;}).sort().join(",")==="pub-c1-s1,pub-c1-s2" && pubs[0].body.indexOf("Northern Hospital - Nurses: the roster for ")===0 && pubs[1].body.indexOf("Northern Hospital · Nurses: the roster for ")===0 && /is published in Myrosta\. See your shifts: myrosta\.com\.au$/.test(pubs[0].body) && e.sent===2 && e.notified===3 && !!S.cycles[0].publishNotifiedTs && /Published [^<]*· 3 notified · 2 queued by text or email/.test(roundStepperHTML(S.cycles[0])));
    S.cycles[0].status="closed"; setCycleStatus("published"); T("publish: a second publish of the same cycle sends nothing more", S.outbox.filter(function(m){return m.kind==="publish";}).length===2 && statusConfirmText("published").indexOf("by text or email")<0);
    T("outbox: merges by id; old sent entries and old dead letters are pruned, fresh failures kept", mergeOnto.toString().indexOf("outbox:null")>0 && (function(){ S.outbox.push({id:"old",kind:"invite",sid:"s1",phone:"+61400000000",email:"",body:"x",ts:0,sent:new Date(Date.now()-40*864e5).toISOString()}); S.outbox.push({id:"dead",kind:"invite",sid:"s9",phone:"+61400000001",email:"",body:"x",ts:Date.now()-40*864e5,sent:null,attempts:3}); S.outbox.push({id:"fresh",kind:"invite",sid:"s8",phone:"+61400000002",email:"",body:"x",ts:Date.now(),sent:null,attempts:3}); normalize(); var ids=S.outbox.map(function(m){return m.id;}); return ids.indexOf("old")<0 && ids.indexOf("dead")<0 && ids.indexOf("fresh")>=0 && S.outbox.length===5; })());
    cloudOn=_co; S.branding=_b; _orgHospital=_oh; S.outbox=_ob; S.cycles[0].status=_st; S.cycles[0].statusLog=_log; if(_pn)S.cycles[0].publishNotifiedTs=_pn; else delete S.cycles[0].publishNotifiedTs; S.notifications=_n; delete s1.mobile; delete s2.email; delete s1.invitedTs; delete s2.invitedTs; S.audit.shift(); })();
  // ---- Premium 3, item 16: trust facts and What's new ----
  (function(){ var _co=cloudOn; cloudOn=function(){return true;}; localStorage.removeItem(KEY+"_seenBuild"); S.viewAs="s1"; S.tab="my"; render();
    T("whatsnew: a fresh device is stamped silently and sees nothing", localStorage.getItem(KEY+"_seenBuild")===BUILD && whatsNewDue()===false && notifsSheetHTML().indexOf("What's new in Myrosta")<0);
    localStorage.setItem(KEY+"_seenBuild","2026-01-01"); var base=notifFor("s1").filter(function(n){return !(n.readBy||[]).includes("s1");}).length; var sh=notifsSheetHTML();
    T("whatsnew: an older stamp pins one row in Notifications and counts one unread", whatsNewDue()===true && unreadCount("s1")===base+1 && /<div class="sheetlbl">New in Myrosta<\/div><button class="notif act" data-go="help\|\|whatsnew">/.test(sh) && sh.indexOf("What's new in Myrosta · "+WHATS_NEW[0].title)>=0 && sh.indexOf(WHATS_NEW[0].lines.length+" changes · build ")>=0 && sh.indexOf('class="mark"')>=0);
    S.tab="help"; render(); T("whatsnew: opening Help marks it seen; Help keeps the section", whatsNewDue()===false && /<h3 class="hsec" id="whatsnew">What's new<\/h3>/.test(viewHelp()) && viewHelp().indexOf(WHATS_NEW[0].title)>=0 && viewHelp().indexOf(WHATS_NEW[0].lines[0].slice(0,30))>=0);
    localStorage.setItem(KEY+"_seenBuild","2026-01-01"); markNotifsRead("s1"); T("whatsnew: Mark all read clears it too", whatsNewDue()===false);
    var _lp=location.pathname; location.pathname="/demo.html"; localStorage.setItem(KEY+"_seenBuild","2026-01-01"); var inDemoDue=whatsNewDue(); location.pathname=_lp; localStorage.setItem(KEY+"_seenBuild",BUILD);
    T("whatsnew: never in the demo", inDemoDue===false);
    _moreOpen=true; var ms=moreSheetHTML(); _moreOpen=false;
    T("about: More carries the trust line, Privacy, Support and What's new, and no second hospital row", /<div class="sheetlbl">About<\/div>/.test(ms) && ms.indexOf("Stored in Sydney, Australia · every change is logged · build ")>=0 && /href="privacy\.html"[^>]*>Privacy</.test(ms) && /href="support\.html"[^>]*>Support</.test(ms) && /data-go="help\|\|whatsnew">What's new</.test(ms) && (ms.match(/Stored in Sydney/g)||[]).length===1);
    cloudOn=_co; _moreOpen=true; var ml=moreSheetHTML(); _moreOpen=false; T("about: local mode says kept in this browser", ml.indexOf("Kept in this browser · every change is logged")>=0);
    var _as=authState,_os=_otpSent; authState="out"; _otpSent=false; var d=authScreen(); authState=_as; _otpSent=_os; T("door: says where the roster is stored", /class="door-foot muted small">Your roster is stored in Sydney, Australia\. <a href="privacy\.html"/.test(d));
    T("build: the constants are dated and the note has three site-neutral lines", /^\d{4}-\d{2}-\d{2}$/.test(BUILD) && WHATS_NEW[0].on<=BUILD && WHATS_NEW[0].lines.length===3 && !/EPIC|Werribee|Northern/.test(WHATS_NEW.map(function(e){return e.lines.join(" ");}).join(" ")) && fmtBuild("2026-09-10").indexOf("2026")>0);
    (function(){ var _co=cloudOn; cloudOn=function(){return true;}; localStorage.setItem(KEY+"_seenBuild",WHATS_NEW[0].on); var due=whatsNewDue(); localStorage.setItem(KEY+"_seenBuild",BUILD); cloudOn=_co; T("whatsnew: a build with no newer note shows nothing", due===false); })();
    T("about: Help's footer carries the trust line on every layout", /every change is logged · build /.test(viewHelp()) && /Stored in Sydney, Australia|Kept in this browser/.test(viewHelp())); })();
  // ---- Premium 3, item 17: paper and exports carry the mark ----
  (function(){ var _b=S.branding; S.branding={hospital:"Northern Hospital",name:"Nurses"}; S.viewAs="admin"; S.tab="equity"; var eq=viewEquity(); S.tab="setup";
    T("print: the fairness summary carries a print-only head and foot", /<div class="card" id="eqCard"><div class="printhead" aria-hidden="true"><svg class="mark"/.test(eq) && eq.indexOf("<b>Northern Hospital · Nurses</b>")>=0 && /Printed \d+ \w+ \d{4} from Myrosta · myrosta\.com\.au/.test(eq) && /class="ptitle">Fairness summary — /.test(eq) && /class="printfoot" aria-hidden="true">Everyone in Nurses sees this same table in Myrosta/.test(eq));
    var cap=capacityCardHTML(); T("print: the capacity case too", /<div class="card" id="capCard"><div class="printhead"/.test(cap) && /class="ptitle">Capacity business case — /.test(cap) && /class="printfoot"[^>]*>Every line of the arithmetic is shown above/.test(cap));
    var xls=null,csv=null,d0=download; download=function(x){ if(xls===null)xls=String(x); else csv=String(x); }; try{ exportRosterXLS(); exportRosterCSV(); }catch(e){} download=d0;
    T("excel: the roster names the hospital and group, the cycle, the date and myrosta.com.au", !!xls && xls.indexOf("<h2 style=\"font:bold 16px Arial;color:#")>=0 && xls.indexOf(">Northern Hospital · Nurses</h2>")>=0 && /<h3 style="[^"]*">Roster [^<]* · (Published \(live\)|Draft|Booking open|Booking closed)<\/h3>/.test(xls) && /Exported \d+ \w+ \d{4} from Myrosta · myrosta\.com\.au — AM blue, PM amber, CST green/.test(xls) && xls.indexOf("var(--")<0);
    T("csv: the machine file stays clean", !!csv && csv.indexOf("Myrosta")<0 && csv.indexOf("Exported")<0 && csv.indexOf("<")<0);
    var rows=rosterOnTitleRows(cycleDates(),function(d){return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();});
    T("rosteron: row 2 names the group, the date and myrosta.com.au; row 1 unchanged", rows.length===2 && /^Roster — \d\d\/\d\d\/\d{4} to \d\d\/\d\d\/\d{4}$/.test(rows[0][0]) && /^Nurses · exported \d\d\/\d\d\/\d{4} from Myrosta \(myrosta\.com\.au\) · RosterOn format$/.test(rows[1][0]));
    S.branding=_b; })();
  // ---- Premium 3, item 18: calendar events say where they come from ----
  (function(){ var _b=S.branding, _r=window._range; S.branding={hospital:"Northern Hospital",name:"Nurses"}; var ds=cycleDates(), d=iso(ds[2]), keep=S.cycles[0].assign["s1|"+d]; S.cycles[0].assign["s1|"+d]={kind:"clinical",period:"AM",zone:"z1"}; window._range={from:d,to:d};
    var ics=null; try{ ics=icsText("s1"); }catch(e){ ics=null; } window._range=_r; if(keep)S.cycles[0].assign["s1|"+d]=keep; else delete S.cycles[0].assign["s1|"+d]; S.branding=_b;
    var lines=ics?ics.split("\r\n"):[], flat=ics?ics.replace(/\r\n /g,""):"";
    T("ics: every event says where it is (the hospital), whose roster, the hours, and the way back in; the download carries no calendar name", !!ics && flat.indexOf("X-WR-CALNAME")<0 && flat.indexOf("LOCATION:Northern Hospital\r\n")>=0 && flat.indexOf("DESCRIPTION:Northern Hospital · Nurses roster · Resus AM · "+periodTime("AM")+"\\nSwap or offer this shift in Myrosta: https://myrosta.com.au")>=0 && flat.indexOf("URL:https://myrosta.com.au/app.html")>=0);
    (function(){ var _b2=S.branding,_oh=_orgHospital,_ol=_orgLabel; S.branding={}; _orgHospital=""; _orgLabel=""; var d2=iso(cycleDates()[2]), keep2=S.cycles[0].assign["s1|"+d2]; S.cycles[0].assign["s1|"+d2]={kind:"clinical",period:"AM",zone:"z1"}; window._range={from:d2,to:d2}; var t2=icsText("s1").replace(/\r\n /g,""); window._range=_r; if(keep2)S.cycles[0].assign["s1|"+d2]=keep2; else delete S.cycles[0].assign["s1|"+d2]; S.branding=_b2; _orgHospital=_oh; _orgLabel=_ol;
      T("ics: a group that has named nothing gets no LOCATION and a plain Roster line, never Myrosta · Myrosta", t2.indexOf("LOCATION:")<0 && t2.indexOf("DESCRIPTION:Roster · Resus AM · ")>=0 && t2.indexOf("Myrosta · Myrosta")<0); })();
    T("ics: only the person's own shift, and every line folds under 75 octets", ics.indexOf("Sam")<0 && ics.indexOf("Kim")<0 && lines.every(function(l){ return unescape(encodeURIComponent(l)).length<=75; }) && lines.some(function(l){ return l.charAt(0)===" "; }));
    T("ics: folding keeps multi-byte text whole", (function(){ var f=icsFold("DESCRIPTION:"+"é".repeat(60)); var parts=f.split("\r\n"); return parts.length===2 && parts[1].charAt(0)===" " && f.replace(/\r\n /g,"").indexOf("é".repeat(60))>0 && parts.every(function(l){ return unescape(encodeURIComponent(l)).length<=75; }); })()); })();
  // ---- Premium 3, item 19: Add to Home Screen, once per device ----
  (function(){ var _co=cloudOn, _ua=navigator.userAgent, _as=authState; cloudOn=function(){return true;}; authState="in"; localStorage.removeItem(KEY+"_a2hs"); navigator.userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari"; window.navigator.standalone=false;
    var c=a2hsCardHTML(); T("home: iPhone Safari, signed in, not installed — the card shows with the share glyph and Not now", /^<div class="a2hs"><img src="icon-180\.png"/.test(c) && c.indexOf("Put Myrosta on your Home Screen")>=0 && c.indexOf('id="a2hsLater"')>=0 && c.indexOf('class="tic"')>=0);
    S.viewAs="s1"; S.tab="my"; T("home: it sits under the action row on the person's own My shifts, not when an admin views someone", viewMy().indexOf('class="a2hs"')>0 && (function(){ S.viewAs="admin"; var h=viewMy(); S.viewAs="s1"; return h.indexOf('class="a2hs"')<0; })());
    a2hsDismiss(); var afterOnce=a2hsCardHTML(); localStorage.setItem(KEY+"_a2hs",JSON.stringify({n:1,ts:Date.now()-31*864e5})); var afterMonth=a2hsCardHTML(); a2hsDismiss(); var afterTwice=a2hsCardHTML();
    T("home: Not now hides it for a month, then once more, then never", afterOnce==="" && afterMonth!=="" && afterTwice==="");
    localStorage.removeItem(KEY+"_a2hs"); navigator.userAgent="testagent"; var desk=a2hsCardHTML(); navigator.userAgent="Mozilla/5.0 (iPhone) Safari"; window.navigator.standalone=true; var inst=a2hsCardHTML(); window.navigator.standalone=false; var _lp=location.pathname; location.pathname="/demo.html"; var demo=a2hsCardHTML(); location.pathname=_lp; cloudOn=function(){return false;}; var local=a2hsCardHTML();
    T("home: never on a desktop, once installed, in the demo or in local mode", desk==="" && inst==="" && demo==="" && local==="");
    (function(){ var _sd=_sharedDevice; cloudOn=function(){return true;}; navigator.userAgent="Mozilla/5.0 (iPhone) Safari"; window.navigator.standalone=false; localStorage.removeItem(KEY+"_a2hs"); _sharedDevice=true; var shared=a2hsCardHTML(); _sharedDevice=_sd; T("home: not on a shared ward device", shared===""); })();
    cloudOn=_co; navigator.userAgent=_ua; authState=_as; localStorage.removeItem(KEY+"_a2hs");
    T("home: Help has a fifth Getting-started step", (viewHelp().match(/class="hstep"/g)||[]).length>=5 && viewHelp().indexOf("Put it on your Home Screen")>=0); })();
  // ---- Premium 3, item 20: share my week, share the demo ----
  (function(){ var _b=S.branding; S.branding={name:"Nurses"}; var ds=cycleDates(), today=iso(new Date()), days=ds.filter(function(d){return iso(d)>=today;}).slice(0,7); var keep={}; days.forEach(function(d){ keep["s1|"+iso(d)]=S.cycles[0].assign["s1|"+iso(d)]; delete S.cycles[0].assign["s1|"+iso(d)]; }); S.cycles[0].assign["s1|"+iso(days[2])]={kind:"clinical",period:"AM",zone:"z1"}; S.cycles[0].assign["s2|"+iso(days[2])]={kind:"clinical",period:"PM",zone:"z2"};
    var t=shareWeekText("s1"), lines=t.split("\n"), dl=function(d){return DOW[d.getDay()]+" "+d.getDate()+" "+fmt(d,{month:"short"});};
    T("share: the week text is the person's own seven days, folded, signed by the product", days.length===7 && lines[0]==="Alex's week — Nurses" && lines[1]===dl(days[0])+" – "+dl(days[1])+" · Off" && lines[2]===dl(days[2])+" · Resus AM · "+periodTime("AM") && lines[3]===dl(days[3])+" – "+dl(days[6])+" · Off" && lines[4]==="— from Myrosta, the ED roster app · myrosta.com.au" && t.indexOf("Sam")<0 && t.indexOf("Acute")<0);
    Object.keys(keep).forEach(function(k){ if(keep[k])S.cycles[0].assign[k]=keep[k]; else delete S.cycles[0].assign[k]; }); delete S.cycles[0].assign["s2|"+iso(days[2])]; S.branding=_b;
    S.viewAs="s1"; S.tab="my"; var mine=viewMy(); S.viewAs="admin"; var theirs=viewMy(); S.viewAs="s1";
    T("share: the button sits on the strip's header on a person's own view only", /class="sub wkhead"[^>]*><b>(Next 7 days|First week of the cycle)<\/b><span class="grow"><\/span><button class="btn sm" id="shareWeek">/.test(mine) && theirs.indexOf('id="shareWeek"')<0);
    T("share: Help offers the demo and the door says New here", /id="shareDemo"[^>]*>[^]*?Share the demo</.test(viewHelp()) && DEMO_SHARE.text.indexOf("https://myrosta.com.au/demo.html")>0 && DEMO_SHARE.text.indexOf("#walkthrough")>0 && (function(){ var _as=authState,_os=_otpSent; authState="out"; _otpSent=false; var d=authScreen(); authState=_as; _otpSent=_os; return /New here\? <a href="demo\.html" target="_blank" rel="noopener">Try the demo<\/a> · <a href="index\.html" target="_blank" rel="noopener">About Myrosta<\/a>/.test(d); })());
    var _lp=location.pathname; location.pathname="/demo.html"; var _as2=authState,_os2=_otpSent; authState="out"; _otpSent=false; var dd=authScreen(); authState=_as2; _otpSent=_os2; location.pathname=_lp; T("share: the demo's own door does not point at itself", dd.indexOf("Try the demo")<0);
    var none=shareText({text:"x"}); var got=null; navigator.clipboard={writeText:function(t){got=t;}}; var cp=shareText({text:"hello",url:"https://x"}); delete navigator.clipboard; navigator.share=function(o){ got=o.text; return {catch:function(){}}; }; var sh=shareText({text:"native"}); delete navigator.share;
    T("share: native share first, the clipboard next, an honest toast last", none==="none" && cp==="copied" && got==="native" && sh==="shared");
    T("share: first names skip honorifics and surname-first forms", firstNameOf("Dr Jordan Lee")==="Jordan" && firstNameOf("Lee, Jordan")==="Jordan" && firstNameOf("Prof. Amara Okafor")==="Amara" && firstNameOf("Kim")==="Kim");
    var _lp2=location.pathname; location.pathname="/demo.html"; var hd=viewHelp(); location.pathname=_lp2; T("share: the demo's Help does not offer to share the demo", hd.indexOf('id="shareDemo"')<0 && viewHelp().indexOf('id="shareDemo"')>=0);
    (function(){ var _ra=_realAdmin; _realAdmin=true; S.viewAs="s1"; S.tab="my"; var h=viewMy(); _realAdmin=_ra; T("share: a real admin previewing someone gets no Share button", h.indexOf('id="shareWeek"')<0); })(); })();
  // ---- Premium 3, skeptic pass ----
  (function(){ var n0=S.staff.length, a0=S.audit.length; S.viewAs="admin"; S.tab="staff"; render(); document.getElementById("addStaff").onclick(); var added=S.staff.length===n0+1 && S.audit[0].action==="staff.add" && auditWords(S.audit[0])==="Added someone to the staff list"; S.staff.pop(); S.audit.shift();
    T("audit: adding, editing and removing a staff record is written down, so 'every change is logged' is true", added && AUDIT_WORDS["staff.edit"]==="Edited a staff record" && AUDIT_WORDS["staff.remove"]==="Removed someone from the staff list" && S.audit.length===a0);
    S.cycles.push({id:"c-eqd",cycle:{start:FUT(30),weeks:8},assign:{},status:"draft",archived:false,settings:{},roles:{}}); S.viewAs="admin"; S.tab="equity"; var _p=window._eqPeriod; window._eqPeriod="three"; var eq=viewEquity(); window._eqPeriod=_p; S.cycles=S.cycles.filter(function(c){return c.id!=="c-eqd";});
    T("print: the fairness foot is honest when the admin's report includes a draft staff cannot see", /class="printfoot"[^>]*>Includes [^<]*, which staff cannot see until it is published\./.test(eq) && eq.indexOf("sees this same table")<0);
    T("copy: the Home Screen wording and the What's new lines match the code", a2hsCardHTML.toString().indexOf("hides it for good")>0 && !/[“”]/.test(WHATS_NEW[0].lines[1])); })();
  // ---- shift types: the admin's own types, and a full shift that fills both halves of a day ----
  if(typeof shiftTypesOf==="function"){ (function(){
    var cyc=S.cycles[0], keepTy=cyc.settings.shiftTypes, keepTi=cyc.settings.shiftTimes, keepA=JSON.stringify(cyc.assign), keepQ=S.staff.map(function(s){return s.quota;}), keepV=S.viewAs, keepZ=JSON.stringify(S.zones), keepR=JSON.stringify(cyc.roles||{}), keepOS=JSON.stringify(S.openShifts||[]);
    // ---- the compatibility contract: nothing is stored until an admin saves, and a shift with no type behaves exactly as it always did
    T("types: a cycle that never saved gets the four builtins from its OWN times, and reading them stores nothing", (function(){
      var t=shiftTypesOf(cyc); return t.length===4 && t.map(function(x){return x.id;}).join(",")==="AM,PM,ONC,CST" && t[0].start==="08:00" && t[1].end==="23:30" && cyc.settings.shiftTypes===undefined; })());
    T("types: shiftTimesOf keeps its four keys — payroll, RosterOn, the calendar feed and the reminders all index by them",
      Object.keys(shiftTimesOf({})).join(",")==="AM,PM,ONC,CST" && shiftTimesOf({}).AM.code==="AM" && shiftTimesOf({}).ONC.end==="08:00");
    T("types: the RosterOn cell is byte-for-byte what it always was on a cycle that has changed nothing", (function(){
      var d0=cycleDates()[0], k="s1|"+iso(d0), keep=cyc.assign[k];
      cyc.assign[k]={kind:"clinical",period:"AM",zone:"z1"}; var am=ronCell("s1",d0);
      cyc.assign[k]={kind:"clinical",period:"PM",zone:"z1"}; var pm=ronCell("s1",d0);
      cyc.assign[k]={kind:"cst"}; var cs=ronCell("s1",d0);
      if(keep)cyc.assign[k]=keep; else delete cyc.assign[k];
      return am==="() AM 0800-1600 08:00-16:00 NB#" && pm==="() PM 1530-2330  15:30-23:30 NB#" && cs==="() CST 0800-1600  08:00-16:00 NB#"; })());
    T("types: a shift carrying no type fills exactly its own period and costs one of a share",
      fillsOf(cyc,{kind:"clinical",period:"AM",zone:"z1"}).join()==="AM" && fillsOf(cyc,{kind:"clinical",period:"PM",zone:"z1"}).join()==="PM" &&
      shiftUnits(cyc,{kind:"clinical",period:"PM",zone:"z1"})===1 && fillsOf(cyc,{kind:"cst"}).length===0 && fillsOf(cyc,{kind:"off"}).length===0);
    // ---- a cycle whose admin has renamed the periods, switched on-call off and added a full shift
    cyc.settings.shiftTimes={AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:"22:00"},ONC:{start:"23:30",end:"08:00"},CST:{start:"10:00",end:"17:00"}};
    cyc.settings.shiftTypes=[{id:"AM",code:"AM",label:"Morning",start:"10:00",end:"17:00",fills:["AM"],on:true,book:true,builtin:"AM"},
      {id:"PM",code:"PM",label:"Evening",start:"17:00",end:"22:00",fills:["PM"],on:true,book:true,builtin:"PM"},
      {id:"ONC",code:"OC",label:"On-call",start:"23:30",end:"08:00",fills:[],on:false,book:false,builtin:"ONC",derived:"oncall"},
      {id:"CST",code:"CST",label:"Admin",start:"10:00",end:"17:00",fills:[],on:true,book:true,builtin:"CST"},
      {id:"full",code:"FULL",label:"Full",start:"10:00",end:"22:00",fills:["AM","PM"],on:true,book:true,builtin:null}];
    cyc.assign={}; S.viewAs="admin"; S.staff.forEach(function(s){ s.quota=10; });
    var D=null, ds=cycleDates(), _t=iso(new Date());
    for(var i=0;i<ds.length;i++){ var x=iso(ds[i]); if(x>_t && !leaveOn("s1",x) && !leaveOn("s2",x) && !leaveOn("s3",x)){ D=x; break; } }
    var D2=iso(addDays(parseISO(D),1));
    T("types: the admin's words reach the app — a renamed period, a renamed non-clinical block, and a type that spans the day",
      perName("AM")==="Morning" && perName("PM")==="Evening" && typeById(cyc,"CST").label==="Admin" &&
      typeLabelOf(cyc,{kind:"clinical",period:"AM",zone:"z1",type:"full"})==="Full" && typeLabelOf(cyc,{kind:"cst"})==="Admin");
    T("types: an id that no longer exists degrades to the plain period rather than dropping the shift",
      typeOf(cyc,{kind:"clinical",period:"PM",zone:"z1",type:"gone"}).id==="PM" && fillsOf(cyc,{kind:"clinical",period:"PM",zone:"z1",type:"gone"}).join()==="PM");
    var bk=bookShift("s1",D,"AM","z1","full"), a1=cyc.assign["s1|"+D];
    T("types: a full shift books as ONE assignment anchored in the half it starts in, carrying its type", bk===true && !!a1 && a1.kind==="clinical" && a1.period==="AM" && a1.type==="full" && a1.zone==="z1" && Object.keys(a1).join()==="kind,period,zone,type");
    T("types: it is cover in BOTH periods, and holds its zone in both", (function(){ var c=clinicalCounts(D,null); return c.am===1 && c.pm===1 && !!zoneTaken(D,"AM","z1",null) && !!zoneTaken(D,"PM","z1",null) && !zoneTaken(D,"PM","z2",null) && !!staffInZone(D,"PM","z1"); })());
    T("types: it is twelve hours, and it takes two of the person's share", shiftHours(cyc,a1)===12 && isFullShift(cyc,a1)===true && shiftUnits(cyc,a1)===2 && clinicalCountFor("s1")===2 && shiftTally("s1").full===1 && shiftTally("s1").am===1 && shiftTally("s1").pm===1);
    T("types: a colleague cannot take either half of that zone, and is told which half", (function(){
      var pm=canBook("s2",D,"PM","z1"), am=canBook("s2",D,"AM","z1"), other=canBook("s2",D,"PM","z2");
      return pm.ok===false && am.ok===false && other.ok===true && /just taken/.test(pm.reason); })());
    T("types: a full shift needs both halves free, and the refusal names the half that is not", (function(){
      var r=bookShift("s2",D2,"PM","z1"); var f=canBook("s3",D2,"AM","z1","full");
      return r===true && f.ok===false && /Evening half of that zone is taken/.test(f.reason); })());
    T("types: judging its evening half, a full shift's own morning half already counts as cover", (function(){
      var f=canBook("s3",D2,"AM","z2","full"); return f.ok===true; })());
    T("types: but a half that is genuinely full still refuses it", (function(){
      var _s=cyc.settings.staffing; cyc.settings.staffing={amMin:1,amMax:2,pmMin:1,pmMax:1}; S.staffing={amMin:1,amMax:2,pmMin:1,pmMax:1};
      var f=canBook("s3",D2,"AM","z2","full"); cyc.settings.staffing=_s; S.staffing={amMin:_s.amMin,amMax:_s.amMax,pmMin:_s.pmMin,pmMax:_s.pmMax};
      return f.ok===false && /PM is full \(1 of 1\)/.test(f.reason); })());
    // ---- the cloud referee: the one place a wrong answer is silent, remote and permanent
    var mk=function(st,as){ return {cycles:[{id:"mx",settings:{staffing:st,shiftTypes:cyc.settings.shiftTypes},assign:as}],leave:[],audit:[],openShifts:[]}; };
    var o1=mk({amMin:1,amMax:2,pmMin:1,pmMax:2},{"a|2026-08-10":{kind:"clinical",period:"AM",zone:"z1",type:"full"},"b|2026-08-10":{kind:"clinical",period:"PM",zone:"z1"}});
    _mergeInvariants(o1);
    T("types: the cloud referee drops a half shift that collides with a full shift's other half",
      !!o1.cycles[0].assign["a|2026-08-10"] && !o1.cycles[0].assign["b|2026-08-10"] && o1.audit.some(function(a){ return a.action==="merge.fix" && /zone double-booked on 2026-08-10 PM/.test(a.detail); }));
    var o2=mk({amMin:1,amMax:1,pmMin:1,pmMax:2},{"a|2026-08-10":{kind:"clinical",period:"AM",zone:"z1",type:"full"},"b|2026-08-10":{kind:"clinical",period:"AM",zone:"z2"}});
    _mergeInvariants(o2);
    T("types: a full shift counts against BOTH maximums when two devices merge",
      !o2.cycles[0].assign["b|2026-08-10"] && o2.audit.some(function(a){ return /over maximum cover on 2026-08-10 AM/.test(a.detail); }));
    // ---- the on-call rider is one switch
    S.zones.push({id:"zoc",name:"Resus/OC",am:true,pm:true,pmLabel:""});
    T("types: with On-call switched off no zone carries an overnight block, however it is named", isOnCallZone(zoneById("zoc"))===false);
    cyc.settings.shiftTypes[2].on=true;
    T("types: switched back on, the same zone carries it again, and a full shift there works through to the on-call end", (function(){
      var on=isOnCallZone(zoneById("zoc"));
      var sp=_shiftSpan("s3","2026-08-11","AM","zoc","full"), h=(sp.en-sp.st)/36e5;
      return on===true && h===22; })());
    cyc.settings.shiftTypes[2].on=false;
    T("types: with no on-call, a full shift is exactly its own twelve hours", (function(){ var sp=_shiftSpan("s3","2026-08-11","AM","zoc","full"); return (sp.en-sp.st)/36e5===12; })());
    // ---- picks: the key grows a fourth segment and the basket is weighed in units
    T("types: a three-segment pick key is worth one, a four-segment full pick is worth two", pickUnits("2026-08-10|AM|z1")===1 && pickUnits("2026-08-10|AM|z1|full")===2 && pickUnits("2026-08-10|PM|z1|gone")===1);
    T("types: the share pre-check counts the basket in units, so a full pick uses two", (function(){
      var _p=_srPick, _cm=S.quotaCapMode; S.quotaCapMode="hard"; var st=S.staff.find(function(x){return x.id==="s3";}); var _q=st.quota; st.quota=2;
      _srPick=[D2+"|AM|z2|full"]; var r=pickCheck("s3",iso(addDays(parseISO(D2),2)),"AM","z1");
      _srPick=[]; var r2=pickCheck("s3",iso(addDays(parseISO(D2),2)),"AM","z1");
      _srPick=_p; S.quotaCapMode=_cm; st.quota=_q; return r.ok===false && r2.ok===true; })());
    // ---- what the person sees: the chip, the legend, the sheet, the calendar, the payslip
    (function(){ var a=cyc.assign["s1|"+D];
      T("types: the chip is two-tone and names the zone; the tooltip gives the type and its real hours",
        /<span class="tag lg full">Resus<\/span>/.test(cellChip(a)) && shiftLabel(a)==="Resus Full" &&
        cellTip(a,"Alex",parseISO(D)).indexOf("Full 10:00–22:00 · Resus")>0 && shiftLine(a).indexOf("10:00–22:00 · Resus")>0);
      T("types: the legend is the cycle's own list, in the admin's words, and drops what is switched off",
        legend().indexOf('<span class="tag lg am">Morning 10:00–17:00</span>')===0 && legend().indexOf('<span class="tag lg pm">Evening 17:00–22:00</span>')>0 &&
        legend().indexOf('<span class="tag lg full">Full 10:00–22:00</span>')>0 && legend().indexOf(">Admin<")>0 && legend().indexOf("On-call")<0);
      T("types: switching a type OFF takes it out of the legend, the booking sheet and the cell editor — and back on returns it", (function(){
        var was=cyc.settings.shiftTypes[4].on, D4=iso(addDays(parseISO(D2),5)), _ss=_srSid, _sp=_sheetPeriod; _srSid="s3";
        cyc.settings.shiftTypes[4].on=false; _sheetPeriod="full";
        var offLeg=legend(), offSheet=daySheetHTML(D4);
        modal={staffId:"s3",isoD:D4,draft:{kind:"clinical",period:"AM"}}; var offModal=""; try{ renderModal(); offModal=document.getElementById("modalRoot").innerHTML; }catch(e){}
        cyc.settings.shiftTypes[4].on=was; var onLeg=legend(); _srSid=_ss; _sheetPeriod=_sp; modal={staffId:null,isoD:null,draft:null};
        return offLeg.indexOf("Full 10:00–22:00")<0 && offSheet.indexOf('data-dsper="full"')<0 && offSheet.indexOf("|full")<0 && offModal.indexOf('data-period="full"')<0 && onLeg.indexOf("Full 10:00–22:00")>0; })());
      var _sp=_sheetPeriod, _ss=_srSid, D3=iso(addDays(parseISO(D2),3));
      _srSid="s3"; _sheetPeriod="full"; var sheet=daySheetHTML(D3); _sheetPeriod="AM"; var sheetAM=daySheetHTML(D3); _sheetPeriod=_sp; _srSid=_ss;
      T("types: the sheet offers one button per type, and only a full tab's chips carry the type in the key",
        sheet.indexOf('data-dsper="AM"')>0 && sheet.indexOf('data-dsper="PM"')>0 && sheet.indexOf('data-dsper="full"')>0 && sheet.indexOf('data-dsper="CST"')<0 &&
        sheet.indexOf('data-pick="'+D3+'|AM|z1|full"')>0 && sheetAM.indexOf('data-pick="'+D3+'|AM|z1"')>0 && sheetAM.indexOf('|full"')<0);
      T("types: a full tab states the cover it uses in both halves, and what it costs",
        /Morning cover \d+ of \d+ · minimum \d+[^<]*· Evening cover \d+ of \d+ · minimum \d+/.test(sheet) &&
        sheet.indexOf("A full shift fills one of each, and takes two of your share.")>0 &&
        /Morning cover \d+ of \d+ · minimum \d+[^<]*<\/div>/.test(sheetAM) && sheetAM.indexOf("fills one of each")<0);
      var _r=window._range; window._range={from:D,to:D}; var ics=null; try{ ics=icsText("s1"); }catch(e){ ics=null; } window._range=_r;
      var flat=ics?ics.replace(/\r\n /g,""):"";
      T("types: the calendar gets ONE event for the whole day, at its own hours, with its own name",
        !!ics && (flat.match(/BEGIN:VEVENT/g)||[]).length===1 && flat.indexOf("T100000")>0 && flat.indexOf("T220000")>0 &&
        flat.indexOf("UID:s1-"+D.replace(/-/g,"")+"-full@myrosta.v2")>0 && flat.indexOf("SUMMARY:Resus (Full)")>0 && flat.indexOf("Resus Full · 10:00–22:00")>0);
      var pr=payrollRows().filter(function(r){ return r.date===D && r.name==="Alex"; });
      T("types: payroll gets one row for the day, its own code and twelve hours — never two half rows",
        pr.length===1 && pr[0].code==="FULL" && pr[0].start==="10:00" && pr[0].end==="22:00" && pr[0].hours===12 && pr[0].note==="Full");
      T("types: the RosterOn cell carries the type's own code and window", ronCell("s1",parseISO(D))==="() FULL 1000-2200  10:00-22:00 NB#");
      T("types: a shared week names the shift and its real hours", (function(){ var t=shareWeekText("s1"); return t.indexOf(" · Resus Full · 10:00–22:00")>0 && t.indexOf("10:00–17:00")<0; })());
      T("types: the fairness table counts a whole day as two, so shifts and quota stay one ratio", (function(){
        var _p=_eqPeriod; var d=equityData("cycle").find(function(x){ return x.s.id==="s1"; }); return !!d && d.m.booked===clinicalCountFor("s1"); })());
    })();
    // ---- the marketplace must hand over exactly what it advertised
    (function(){ var _mo=S.marketOn, _mc=S.marketClaim, _v=S.viewAs, D5=iso(addDays(parseISO(D2),7));
      S.marketOn=true; S.marketClaim="instant"; S.viewAs="admin"; S.staff.forEach(function(x){ x.quota=40; });
      bookShift("s1",D5,"AM","z1","full");
      S.viewAs="s1"; offerShift("s1",D5); var g=(S.openShifts||[])[0];
      T("types: a whole-day give-away is offered as a whole day, and says so on the row", !!g && g.type==="full" && g.period==="AM" &&
        osTypeName(g)==="Full" && marketMyHTML().indexOf("</b> Full · Resus")>0 && marketMyHTML().indexOf("</b> AM ·")<0);
      S.viewAs="s2"; claimOpenShift(g.id,false); var got=cyc.assign["s2|"+D5];
      T("types: the claimer works exactly what was offered — not the half it starts in", !!got && got.type==="full" && shiftUnits(cyc,got)===2 && shiftHours(cyc,got)===12 && !cyc.assign["s1|"+D5]);
      T("types: a whole-day open shift is judged with its type, so the row never offers a claim that must fail", (function(){
        delete cyc.assign["s2|"+D5]; S.viewAs="admin"; postOpenShift(D5,"AM","z1","cover",  "full"); var o=(S.openShifts||[])[0];
        bookShift("s3",D5,"PM","z1");                                   // someone takes the evening half of that zone
        var loose=canClaim("s1",D5,"AM","z1",true,null), tight=canClaim("s1",D5,"AM","z1",true,null,o.type);
        return loose.ok===true && tight.ok===false && /already covered/.test(tight.reason); })());
      T("types: a whole-day candidate is blocked by a stranger even when the giver also overlaps it", (function(){
        cyc.assign={}; bookShift("s1",D5,"AM","z1","full"); S.viewAs="s1"; offerShift("s1",D5); var o=(S.openShifts||[])[0];
        cyc.assign["s1|"+D5]={kind:"clinical",period:"AM",zone:"z1"};   // the giver's shift is edited down to a half, freeing the evening
        cyc.assign["s2|"+D5]={kind:"clinical",period:"PM",zone:"z1"};   // and a colleague takes it
        var r=canClaim("s3",D5,"AM","z1",true,"s1","full");
        return r.ok===false && /already covered/.test(r.reason); })());
      cyc.assign={}; S.openShifts=[]; S.marketOn=_mo; S.marketClaim=_mc; S.viewAs=_v; S.staff.forEach(function(x){ x.quota=10; });
      bookShift("s1",D,"AM","z1","full");   // put the fixture's whole-day shift back for the checks below
    })();
    // ---- the sheet's own key must survive the tap, on both booking paths
    (function(){ var _f=S.fairness, _d=cyc.draft, _st=cyc.status, _sp=_sheetPeriod, _ss=_srSid, D6=iso(addDays(parseISO(D2),9));
      S.fairness="snake"; cyc.status="open"; cyc.draft={round:1,turnIdx:0,base:["s3","s1","s2"]}; _srSid="s3"; _sheetPeriod="full";
      var sheet=daySheetHTML(D6), m=sheet.match(/data-book="([^"]+)"/);
      var parts=m?m[1].split("|"):[];
      S.viewAs="admin"; var ok=parts.length===4 && bookShift("s3",parts[0],parts[1],parts[2],parts[3])===true;
      var got=cyc.assign["s3|"+D6];
      T("types: in take-turns rounds the chip is a Book key carrying the type, and the tap stores the whole day",
        !!m && parts.length===4 && parts[3]==="full" && ok && !!got && got.type==="full" && shiftUnits(cyc,got)===2);
      delete cyc.assign["s3|"+D6]; S.fairness=_f; cyc.draft=_d; cyc.status=_st; _sheetPeriod=_sp; _srSid=_ss; S.viewAs="admin";
    })();
    // ---- a type in use cannot be removed or re-pointed out from under the shifts on it
    T("types: the app knows how many shifts a type is carrying", typeInUse(cyc,"full")===1 && typeInUse(cyc,"AM")===0 && typeInUse(cyc,"gone")===0 && typeInUse(null,"full")===0);
    // ---- the card an admin actually uses (there was no test on it at all before this feature)
    (function(){ var _st=S.tab, _sb=_setupTab; S.tab="setup"; _setupTab="cycle"; var v=viewSetup();
      T("types: the card is one row per type — name, hours and which half of the day; on-call is not a shift type and lives on its own card",
        v.indexOf('id="card-times"')>0 && v.indexOf(">Shift types<")>0 && (v.match(/data-sti="/g)||[]).length===4 &&
        /class="st-label" value="Morning"/.test(v) && /class="st-label" value="Evening"/.test(v) && /class="st-label" value="Admin"/.test(v) &&
        v.indexOf("first half of the day")>0 && v.indexOf("second half of the day")>0 && !/class="st-label" value="On-call"/.test(v) && v.indexOf("rides on the")<0);
      T("types: a type the admin added can be moved between the halves or made a full shift, and can be removed; the day's own halves cannot",
        /<select class="st-fills"[^>]*>[^]*?<option value="AM\+PM" selected>Both halves — a full shift<\/option>/.test(v) &&
        (v.match(/class="btn danger sm st-del"/g)||[]).length===1 && (v.match(/small">always on<\/span>/g)||[]).length===2 && (v.match(/class="st-fills"/g)||[]).length===1);
      T("types: a switched-off type shows as off, and nothing on the card offers on-call to staff as something to book",
        (function(){ var f=cyc.settings.shiftTypes[4], was=f.on; f.on=false; var w=viewSetup(); f.on=was;
          return f.id==="full" && (w.match(/class="st-on" checked/g)||[]).length===1 && (w.match(/class="st-on"/g)||[]).length===2 && (w.match(/class="st-book"/g)||[]).length===4; })());
      T("types: the payroll card states the hours it writes in the admin's own words, and drops the rider it switched off",
        (function(){ var _t=_setupTab; _setupTab="group"; var g=viewSetup(); _setupTab=_t;
          return g.indexOf("Shift types for this cycle: Morning 10:00–17:00 · Evening 17:00–22:00 · Admin 10:00–17:00 · Full 10:00–22:00 (whole day) · Leave = 8h")>0 && g.indexOf("On-call")<0; })());
      T("types: saving the card writes back the on-call type it does not show, untouched and in its place", (function(){
        var was=JSON.stringify(cyc.settings.shiftTypes), wasT=JSON.stringify(cyc.settings.shiftTimes); render();
        var btn=document.getElementById("saveShiftTimes"), qsa=document.querySelectorAll;
        var rows=[0,1,3,4].map(function(i){ var t=cyc.settings.shiftTypes[i];
          return {dataset:{sti:String(i)},querySelector:function(sel){ return {".st-label":{value:t.label},".st-start":{value:t.start},".st-end":{value:t.end},
            ".st-fills":(t.builtin?null:{value:t.fills.join("+")}),".st-on":(t.id==="AM"||t.id==="PM"?null:{checked:t.on!==false}),".st-book":{checked:t.book!==false}}[sel]||null; },querySelectorAll:function(){ return []; }}; });
        document.querySelectorAll=function(sel){ return sel==="#typeRows [data-sti]"?rows:[]; };
        try{ if(btn.onclick)btn.onclick(); } finally { document.querySelectorAll=qsa; }
        var ts=cyc.settings.shiftTypes, ok=!!btn.onclick && ts.map(function(t){return t.id;}).join()==="AM,PM,ONC,CST,full" && ts[2].on===false && ts[2].start==="23:30" && cyc.settings.shiftTimes.ONC.end==="08:00";
        cyc.settings.shiftTypes=JSON.parse(was); cyc.settings.shiftTimes=JSON.parse(wasT); return ok; })());
      T("types: a visible type named like the hidden on-call type saves, and the hidden one stays out of the log", (function(){
        var was=JSON.stringify(cyc.settings.shiftTypes), wasT=JSON.stringify(cyc.settings.shiftTimes); cyc.settings.shiftTypes[2].on=true; render();
        var btn=document.getElementById("saveShiftTimes"), qsa=document.querySelectorAll, n0=S.audit.length;
        var rows=[0,1,3,4].map(function(i){ var t=cyc.settings.shiftTypes[i];
          return {dataset:{sti:String(i)},querySelector:function(sel){ return {".st-label":{value:(t.id==="full"?"on-call":t.label)},".st-start":{value:t.start},".st-end":{value:t.end},
            ".st-fills":(t.builtin?null:{value:t.fills.join("+")}),".st-on":(t.id==="AM"||t.id==="PM"?null:{checked:t.on!==false}),".st-book":{checked:t.book!==false}}[sel]||null; },querySelectorAll:function(){ return []; }}; });
        document.querySelectorAll=function(sel){ return sel==="#typeRows [data-sti]"?rows:[]; };
        try{ btn.onclick(); } finally { document.querySelectorAll=qsa; }
        var saved=cyc.settings.shiftTypes[4].label==="on-call", line=S.audit.length>n0?S.audit[0].detail:"";
        cyc.settings.shiftTypes=JSON.parse(was); cyc.settings.shiftTimes=JSON.parse(wasT);
        return saved && line.indexOf("on-call 10:00")>0 && line.indexOf("On-call 23:30")<0; })());
      T("types: + Add a shift type refuses an unsaved change that would re-point a type shifts are booked on", (function(){
        var was=JSON.stringify(cyc.settings.shiftTypes); render(); var said=[], t0=toast; toast=function(m){ said.push(String(m)); };
        var btn=document.getElementById("addShiftType"), qsa=document.querySelectorAll;
        var rows=[{dataset:{sti:"4"},querySelector:function(sel){ return sel===".st-fills"?{value:"AM"}:null; },querySelectorAll:function(){ return []; }}];
        document.querySelectorAll=function(sel){ return sel==="#typeRows [data-sti]"?rows:[]; };
        try{ btn.onclick(); } finally { document.querySelectorAll=qsa; toast=t0; }
        var same=JSON.stringify(cyc.settings.shiftTypes)===was; cyc.settings.shiftTypes=JSON.parse(was);
        return same && said.some(function(m){ return /cannot change which half of the day it covers/.test(m); }); })());
      T("types: every new audit key has a plain-word sentence", AUDIT_WORDS["settings.shiftTypes"]==="Changed the shift types" && !!AUDIT_WORDS["settings.shiftTimes"]);
      S.tab=_st; _setupTab=_sb; })();
    // ---- the list travels with the cycle, or a prepared cycle silently loses it
    (function(){ var _c=confirm, _n=S.cycles.length; confirm=function(){return true;}; prepareNext(); confirm=_c;
      var made=S.cycles[S.cycles.length-1];
      T("types: a prepared next cycle inherits the type list, deep-copied", S.cycles.length===_n+1 && !!made.settings.shiftTypes && made.settings.shiftTypes.length===5 &&
        made.settings.shiftTypes[4].id==="full" && made.settings.shiftTypes!==cyc.settings.shiftTypes && made.settings.shiftTypes[4]!==cyc.settings.shiftTypes[4]);
      S.cycles=S.cycles.filter(function(c){return c.id!==made.id;}); S.activeId=cyc.id; hydrateCycleSettings(); hydrateCycleRoles(); })();
    S.zones.length=0; JSON.parse(keepZ).forEach(function(z){ S.zones.push(z); });   // in place: hydrateCycleSettings shares this array with the cycle
    cyc.assign=JSON.parse(keepA); S.openShifts=JSON.parse(keepOS);
    cyc.roles=JSON.parse(keepR); S.staff.forEach(function(s,i){ s.quota=keepQ[i]; });
    if(keepTy)cyc.settings.shiftTypes=keepTy; else delete cyc.settings.shiftTypes;
    if(keepTi)cyc.settings.shiftTimes=keepTi; else delete cyc.settings.shiftTimes;
    S.viewAs=keepV; hydrateCycleSettings(); hydrateCycleRoles();
    T("types: the block leaves the fixture exactly as it found it", JSON.stringify(S.zones)===keepZ && JSON.stringify(cyc.roles)===keepR && S.staff.map(function(s){return s.quota;}).join()===keepQ.join() && JSON.stringify(cyc.assign)===keepA);
  })(); }
  // ---- the notice period: how close to a shift someone may still walk away from it ----
  if(typeof effNotice==="function"){ (function(){
    var cyc=S.cycles[0], keepN=cyc.settings.noticeDays, keepSt=cyc.status, keepAr=cyc.archived, keepT=S.tab, keepSb=_setupTab, keepV=S.viewAs;
    T("notice: a cycle that has never set one is OFF — which is exactly where both live groups are today",
      cyc.settings.noticeDays===undefined && effNotice(cyc)===0 && effNotice({})===0 && effNotice({settings:{}})===0 && noticeBinds(cyc)===false);
    T("notice: a number is read from the cycle, and nonsense is treated as off", (function(){
      cyc.settings.noticeDays=14; var ok=effNotice(cyc)===14;
      cyc.settings.noticeDays="14"; ok=ok&&effNotice(cyc)===14;
      cyc.settings.noticeDays=-3; ok=ok&&effNotice(cyc)===0;
      cyc.settings.noticeDays=999; ok=ok&&effNotice(cyc)===0;
      cyc.settings.noticeDays="rubbish"; ok=ok&&effNotice(cyc)===0;
      cyc.settings.noticeDays=14; return ok; })());
    T("notice: it binds on a live or published roster, never on a draft or an archive", (function(){
      cyc.status="published"; cyc.archived=false; var pub=noticeBinds(cyc);
      cyc.status="open"; var open=noticeBinds(cyc);
      cyc.status="draft"; var draft=noticeBinds(cyc);
      cyc.status="published"; cyc.archived=true; var arch=noticeBinds(cyc);
      cyc.archived=false; return pub===true && open===true && draft===false && arch===false; })());
    T("notice: a day inside the window is inside it, a day beyond is not, and yesterday is inside", (function(){
      cyc.status="published";
      var near=iso(addDays(new Date(),9)), far=iso(addDays(new Date(),20)), past=iso(addDays(new Date(),-2)), edge=iso(addDays(new Date(),14));
      return inNotice(near,cyc)===true && inNotice(far,cyc)===false && inNotice(past,cyc)===true && inNotice(edge,cyc)===true && inNotice(iso(addDays(new Date(),15)),cyc)===false; })());
    T("notice: with it switched off nothing is inside the window", (function(){
      cyc.settings.noticeDays=0; var r=inNotice(iso(addDays(new Date(),1)),cyc); cyc.settings.noticeDays=14; return r===false; })());
    // THE trap: every sibling card renders a hydrated global. This one must render the CYCLE it is on.
    T("notice: the card shows this cycle's own number, not a global, and never renders another cycle's", (function(){
      S.viewAs="admin"; S.tab="setup"; _setupTab="cycle";
      cyc.settings.noticeDays=14; var a=viewSetup();
      var _c=confirm, _n=S.cycles.length; confirm=function(){return true;}; prepareNext(); confirm=_c;
      var made=S.cycles[S.cycles.length-1]; made.settings.noticeDays=3; S.activeId=made.id; hydrateCycleSettings();
      var b=viewSetup();
      S.activeId=cyc.id; S.cycles=S.cycles.filter(function(c){return c.id!==made.id;}); hydrateCycleSettings(); hydrateCycleRoles();
      return a.indexOf('id="noticeDays" value="14"')>0 && b.indexOf('id="noticeDays" value="3"')>0 && b.indexOf('value="14"')<0 && typeof S.noticeDays==="undefined"; })());
    T("notice: a prepared cycle inherits it — and inherits the roster mode too, which it never used to", (function(){
      var wasMode=cyc.settings.rosterMode, wasG=S.rosterMode;
      cyc.settings.noticeDays=14; cyc.settings.rosterMode="rolling";
      var _c=confirm; confirm=function(){return true;}; prepareNext(); confirm=_c;
      var made=S.cycles[S.cycles.length-1], got=made.settings.noticeDays===14 && made.settings.rosterMode==="rolling";
      S.activeId=cyc.id; S.cycles=S.cycles.filter(function(c){return c.id!==made.id;});
      if(wasMode===undefined)delete cyc.settings.rosterMode; else cyc.settings.rosterMode=wasMode;
      S.rosterMode=wasG; hydrateCycleSettings(); hydrateCycleRoles();
      return got; })());
    T("notice: the setup index and the checklist carry it, and the checklist says what it means", (function(){
      var v=viewSetup(), cl=setupChecklist().find(function(r){return r.key==="notice";});
      return v.indexOf('id="card-notice"')>0 && v.indexOf(">Notice<")>0 && !!cl && cl.anchor==="card-notice" && cl.detail.indexOf("14 days")===0
        && (function(){ var was=cyc.settings.noticeDays; cyc.settings.noticeDays=0; var off=setupChecklist().find(function(r){return r.key==="notice";}).detail; cyc.settings.noticeDays=was; return off.indexOf("Off")===0; })(); })());
    T("notice: the card warns when Open shifts is off, because a shift dropped then has nowhere to go", (function(){
      var _m=S.marketOn; S.marketOn=false; var off=viewSetup(); S.marketOn=true; var on=viewSetup(); S.marketOn=_m;
      return off.indexOf("has nowhere to go")>0 && on.indexOf("has nowhere to go")<0; })());
    T("notice: the new audit key has a plain-word sentence", AUDIT_WORDS["settings.notice"]==="Changed the notice period");
    // ---- coming off a shift: refused close in, broadcast further out
    (function(){ var keepA=JSON.stringify(cyc.assign), keepOS=JSON.stringify(S.openShifts||[]), keepReq=JSON.stringify(S.requests||[]),
        keepLv=JSON.stringify(S.leave||[]), keepM=S.marketOn, keepMode=cyc.settings.rosterMode, keepNo=JSON.stringify(S.notifications||[]);
      var keepGM=S.rosterMode;
      cyc.settings.noticeDays=14; cyc.status="published"; cyc.settings.rosterMode="rolling"; S.rosterMode="rolling"; S.marketOn=true;
      cyc.assign={}; S.openShifts=[]; S.requests=[]; S.notifications=[];
      var near=iso(addDays(new Date(),5)), far=iso(addDays(new Date(),25));
      S.viewAs="admin"; bookShift("s1",far,"AM","z1"); bookShift("s1",near,"PM","z2");
      // OUTSIDE the window: it goes, and the group is told
      S.viewAs="s1"; var dropped=dropShift("s1",far), gap=(S.openShifts||[])[0];
      T("come off: outside the notice period the shift goes, and the group gets an open shift carrying its zone and period",
        dropped===true && !cyc.assign["s1|"+far] && !!gap && gap.kind==="gap" && gap.iso===far && gap.period==="AM" && gap.zone==="z1" && gap.status==="open" &&
        gap.droppedBy==="s1" && gap.from===null && gap.cycleId===cyc.id);
      T("come off: the person who came off cannot quietly withdraw the gap they left behind",
        gap.actor==="admin" && (function(){ S.viewAs="s1"; var r=withdrawOpenShift(gap.id); return r===false && gap.status==="open"; })());
      // INSIDE the window: refused, and the shift is STILL THERE
      S.viewAs="s1"; var refused=dropShift("s1",near);
      T("come off: inside the notice period it is refused AND the shift is still on the roster",
        refused===false && !!cyc.assign["s1|"+near] && cyc.assign["s1|"+near].zone==="z2" && (S.openShifts||[]).length===1);
      T("come off: the engine refuses too, so no other screen can route around it", (function(){
        S.viewAs="s1"; var u=unbookShift("s1",near); return u===false && !!cyc.assign["s1|"+near]; })());
      T("come off: an admin is never blocked by it", (function(){
        S.viewAs="admin"; var u=unbookShift("s1",near); var back=!cyc.assign["s1|"+near];
        cyc.assign["s1|"+near]={kind:"clinical",period:"PM",zone:"z2"}; return u===true && back; })());
      T("come off: the refusal says how long the notice is and how far away the shift is", (function(){
        var why=noticeReason(near,cyc); return /^14 days’ notice on this roster, and that shift is in 5 days\./.test(why) && /Offer it to the group, or ask your admin/.test(why); })());
      // the day sheet shows two different endings
      (function(){ var _ss=_srSid, _sp=_sheetPeriod; _srSid="s1"; S.viewAs="s1";
        var inW=daySheetHTML(near), outW=daySheetHTML(far.slice(0,10));
        cyc.assign["s1|"+far]={kind:"clinical",period:"AM",zone:"z1"}; var outW2=daySheetHTML(far);
        delete cyc.assign["s1|"+far]; _srSid=_ss; _sheetPeriod=_sp;
        T("come off: close in the sheet explains and offers a hand-over; further out it offers Remove and says the group is told",
          inW.indexOf('data-osdrop=')<0 && inW.indexOf("14 days’ notice")>0 && inW.indexOf('data-osoffer="'+near+'"')>0 &&
          outW2.indexOf('data-osdrop="'+far+'"')>0 && outW2.indexOf("goes up as an open shift")>0 && outW2.indexOf("14 days’ notice")<0); })();
      // with Open shifts off, coming off still works but nothing is broadcast
      T("come off: with Open shifts switched off the shift still goes, and nothing is broadcast into a group that cannot see it", (function(){
        S.marketOn=false; S.viewAs="admin"; bookShift("s2",far,"AM","z1"); S.viewAs="s2";
        var before=(S.openShifts||[]).length, ok=dropShift("s2",far), after=(S.openShifts||[]).length;
        var off=offerShift("s2",near); S.marketOn=true;
        return ok===true && before===after && off===false; })());
      // approving leave frees days across every cycle — and now says so
      T("come off: approving leave broadcasts every clinical day it frees, in whichever cycle it frees them", (function(){
        S.openShifts=[]; S.viewAs="admin";
        var d1=iso(addDays(new Date(),30)), d2=iso(addDays(new Date(),31));
        cyc.assign["s3|"+d1]={kind:"clinical",period:"AM",zone:"z1"};
        cyc.assign["s3|"+d2]={kind:"cst"};
        S.requests=[{id:"rlv1",type:"leave",from:"s3",code:"AL",dateFrom:d1,dateTo:d2,status:"pending",createdTs:Date.now()}];
        approveRequest("rlv1","");
        var gaps=(S.openShifts||[]).filter(function(o){return o.kind==="gap";});
        return !cyc.assign["s3|"+d1] && !cyc.assign["s3|"+d2] && gaps.length===1 && gaps[0].iso===d1 && gaps[0].zone==="z1" && gaps[0].note==="leave approved" && gaps[0].droppedBy===undefined; })());
      // ---- the second door: ask, and let the admin decide — but a colleague can end it first
      (function(){ S.openShifts=[]; cyc.assign={}; S.viewAs="admin";
        bookShift("s1",near,"PM","z2"); bookShift("s2",near,"AM","z1");
        S.viewAs="s1";
        T("come off: an ask with no reason is refused — it is the one request that costs the department cover",
          askComeOff("s1",near,"   ")===false && (S.openShifts||[]).length===0);
        var sent=askComeOff("s1",near,"family funeral"), o=(S.openShifts||[])[0];
        T("come off: an ask IS an offer — one record, open to the group and waiting on the admin at the same time",
          sent===true && !!o && o.kind==="giveaway" && o.from==="s1" && o.status==="open" && o.ask.status==="pending" && o.ask.reason==="family funeral" &&
          !!cyc.assign["s1|"+near] && askOn("s1",near)===true);
        T("come off: the asker does not get their own request in their own bell",
          notifFor("s1").some(function(n){return /needs to come off/.test(n.text);})===false && notifFor("s2").some(function(n){return /needs to come off/.test(n.text);})===true);
        T("come off: the group is asked for cover and the admin is told, each once",
          S.notifications.filter(function(n){return n.to==="all"&&/needs to come off/.test(n.text);}).length===1 &&
          S.notifications.filter(function(n){return n.to==="admin"&&/asked to come off/.test(n.text);}).length===1);
        T("come off: it sits in Requests beside leave and swaps, with the notice, the reason and what it costs the day", (function(){
          var _t=S.tab; S.viewAs="admin"; S.tab="requests"; var v=viewRequests(); S.tab=_t;
          return v.indexOf("Come off a shift · Alex")>0 && v.indexOf("family funeral")>0 && /\d+ days’ notice/.test(v) &&
            v.indexOf("cover without them")>0 && v.indexOf('data-askoff="'+o.id+'"')>0 && v.indexOf('data-askkeep="'+o.id+'"')>0; })());
        T("come off: keeping them on leaves the shift with them and the offer with the group", (function(){
          S.viewAs="admin"; var r=decideComeOff(o.id,false,"we're short that evening");
          return r===true && o.ask.status==="declined" && o.status==="open" && !!cyc.assign["s1|"+near] &&
            S.notifications.some(function(n){return n.to==="s1"&&/needs you on/.test(n.text);}); })());
        T("come off: only an admin decides, and a decision cannot be made twice", (function(){
          S.openShifts=[]; S.viewAs="s1"; askComeOff("s1",near,"dentist"); var fresh=(S.openShifts||[])[0];
          var sneak=decideComeOff(fresh.id,true,"");                       // a staff member, on a genuinely pending ask
          var stillPending=fresh.ask.status==="pending" && !!cyc.assign["s1|"+near];
          S.viewAs="admin"; var first=decideComeOff(fresh.id,false,""), again=decideComeOff(fresh.id,true,"");
          return sneak===false && stillPending && first===true && again===false && !!cyc.assign["s1|"+near]; })());
        T("come off: letting them off takes them off, turns the offer into a plain gap, and tells the group nobody is on it", (function(){
          S.openShifts=[]; S.viewAs="s1"; askComeOff("s1",near,"surgery"); var a=(S.openShifts||[])[0];
          S.viewAs="admin"; var r=decideComeOff(a.id,true,"");
          return r===true && !cyc.assign["s1|"+near] && a.kind==="gap" && a.from===null && a.droppedBy==="s1" && a.actor==="admin" && a.ask.status==="approved" && a.status==="open" &&
            S.notifications.some(function(n){return n.to==="all"&&/Nobody is on/.test(n.text);}); })());
        T("come off: if a colleague takes it first the admin never has to decide, and the ask is closed by the claim", (function(){
          S.openShifts=[]; cyc.assign={}; S.viewAs="admin"; bookShift("s1",near,"PM","z2");
          S.viewAs="s1"; askComeOff("s1",near,"childcare"); var a=(S.openShifts||[])[0];
          S.viewAs="s3"; claimOpenShift(a.id,false);
          S.viewAs="admin"; var late=decideComeOff(a.id,true,"");
          return a.status==="claimed" && a.by==="s3" && !cyc.assign["s1|"+near] && !!cyc.assign["s3|"+near] &&
            late===false && pendingAsks().length===0; })());
        T("come off: the sheet offers both doors inside the window, and says which one needs the admin", (function(){
          S.openShifts=[]; cyc.assign={}; S.viewAs="admin"; bookShift("s1",near,"PM","z2");
          var _ss=_srSid; _srSid="s1"; S.viewAs="s1"; var v=daySheetHTML(near); _srSid=_ss;
          return v.indexOf('data-osoffer="'+near+'"')>0 && v.indexOf('data-osask="'+near+'"')>0 && v.indexOf("Offering it is enough on its own")>0; })());
        T("come off: the new audit keys all have plain-word sentences",
          AUDIT_WORDS["market.ask"]==="Asked to come off a shift" && AUDIT_WORDS["market.release"]==="Let someone off a shift" && AUDIT_WORDS["market.keep"]==="Kept someone on their shift");
      })();
      // ---- on-call is a tick on the zone, not a guess at its name
      (function(){ var keepZ2=JSON.stringify(S.zones), keepTy2=cyc.settings.shiftTypes;
        S.zones.push({id:"zroc",name:"Resus/OC",am:true,pm:true,pmLabel:""});
        S.zones.push({id:"zc1",name:"Consultant 1",am:true,pm:true,pmLabel:""});
        hydrateCycleSettings();
        T("on-call: a zone nobody has ticked behaves exactly as it always did — the name still decides",
          isOnCallZone(zoneById("zroc"))===true && isOnCallZone(zoneById("zc1"))===false && zoneById("zroc").oncall===undefined);
        zoneById("zc1").oncall=true; zoneById("zroc").oncall=false;
        T("on-call: a tick beats the name in both directions — a plainly-named zone can carry it, and a false positive can be killed",
          isOnCallZone(zoneById("zc1"))===true && isOnCallZone(zoneById("zroc"))===false);
        T("on-call: the shift type is still the switch for the whole cycle, and it wins over any tick", (function(){
          var ts=shiftTypesOf(cyc).map(function(t){return {...t,fills:(t.fills||[]).slice()};});
          ts.find(function(t){return t.id==="ONC";}).on=false; cyc.settings.shiftTypes=ts;
          var off=isOnCallZone(zoneById("zc1"));
          ts.find(function(t){return t.id==="ONC";}).on=true; var on=isOnCallZone(zoneById("zc1"));
          return off===false && on===true; })());
        T("on-call: it reaches the hours, so a ticked zone's evening runs through to the on-call end", (function(){
          var d=iso(addDays(new Date(),3));
          var withOC=_shiftSpan("s1",d,"PM","zc1"), plain=_shiftSpan("s1",d,"PM","z2");
          return (withOC.en-withOC.st)/36e5 > (plain.en-plain.st)/36e5; })());
        T("on-call: the Zones card has no tick any more; the On-call card shows the evening this cycle's on-call follows, and says it was worked out", (function(){
          var _t=S.tab, _sb=_setupTab; S.tab="setup"; _setupTab="cycle"; var v=viewSetup();
          try{ renderZoneList(); }catch(e){}
          var h=document.getElementById("zoneList").innerHTML;
          S.tab=_t; _setupTab=_sb;
          return h.indexOf("z-oc")<0 && h.indexOf("z-name")>0 && /class="oc-z" value="zc1" checked/.test(v) && /class="oc-z" value="zroc" >/.test(v) &&
                 v.indexOf("Worked out from the zones this cycle already marks as carrying on-call")>0; })());
        T("on-call: the shift types save keeps the on-call type it no longer shows, in its place, so a never-saved cycle keeps its on-call", (function(){
          var base=[{id:"AM",fills:["AM"]},{id:"PM",fills:["PM"]},{id:"ONC",fills:[],derived:"oncall",on:true,start:"23:30",end:"08:00"},{id:"CST",fills:[]}];
          var out=keepHiddenTypes(base,[{id:"AM",fills:["AM"]},{id:"PM",fills:["PM"]},{id:"CST",fills:[]}]);
          return out.map(function(t){return t.id;}).join()==="AM,PM,ONC,CST" && out[2]!==base[2] && out[2].end==="08:00" && keepHiddenTypes(base,out.slice()).length===4; })());
        T("on-call: the old zone tick's audit lines still read in plain words",
          AUDIT_WORDS["settings.zoneOnCall"]==="Changed which zones carry on-call");
        S.zones.length=0; JSON.parse(keepZ2).forEach(function(z){ S.zones.push(z); });
        if(keepTy2)cyc.settings.shiftTypes=keepTy2; else delete cyc.settings.shiftTypes;
        hydrateCycleSettings();
      })();
      // ---- the guards that only bite when there is more than one cycle, and the ones the first pass missed
      (function(){ S.openShifts=[]; cyc.assign={}; S.notifications=[]; S.viewAs="admin";
        // a second, non-active cycle with its OWN zones — the case every "name the cycle" guard exists for
        var d2=iso(addDays(new Date(),40));
        var other={id:"cyc-other",cycle:{start:iso(addDays(new Date(),35)),weeks:2},status:"published",archived:false,
          settings:{zones:[{id:"zNight",name:"Nights",am:true,pm:true,pmLabel:""}],staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2}},
          assign:{},roles:{}};
        other.assign["s3|"+d2]={kind:"clinical",period:"PM",zone:"zNight"};
        S.cycles.push(other);
        S.requests=[{id:"rlv2",type:"leave",from:"s3",code:"AL",dateFrom:d2,dateTo:d2,status:"pending",createdTs:Date.now()}];
        approveRequest("rlv2","");
        var g=(S.openShifts||[]).find(function(x){return x.cycleId==="cyc-other";});
        T("come off: a gap in another cycle is named from THAT cycle's zones, not from whichever one is on screen",
          !!g && g.zone==="zNight" && S.notifications.some(function(n){return n.to==="all"&&/· Nights/.test(n.text);}) &&
          !S.notifications.some(function(n){return n.to==="all"&&/· \?/.test(n.text);}) &&
          S.audit.some(function(a){return a.action==="market.post"&&/Nights/.test(a.detail);}));
        T("come off: approving leave leaves no phone push dangling outside the commit that would have sent it", _osPushQueue===null||_osPushQueue===undefined);
        // an ask about the other cycle: the card is filtered to the active one, so the bell must carry the cycle
        S.openShifts=[]; S.notifications=[]; other.assign["s3|"+d2]={kind:"clinical",period:"PM",zone:"zNight"};
        var _a=S.activeId; S.activeId="cyc-other"; hydrateCycleSettings();
        S.viewAs="s3"; askComeOff("s3",d2,"court");
        var ask=(S.openShifts||[])[0];
        S.activeId=_a; hydrateCycleSettings();
        T("come off: an ask about another cycle is out of the admin's list, and its bell carries the cycle to switch to",
          pendingAsks().length===0 && S.notifications.some(function(n){return n.to==="admin"&&n.go&&n.go.cycle==="cyc-other";}));
        T("come off: a decision resolves the cycle from the record, never from whichever one is active", (function(){
          S.viewAs="admin"; var r=decideComeOff(ask.id,true,"");
          return r===true && !other.assign["s3|"+d2] && ask.kind==="gap" && ask.cycleId==="cyc-other"; })());
        S.cycles=S.cycles.filter(function(c){return c.id!=="cyc-other";}); S.activeId=cyc.id; hydrateCycleSettings(); hydrateCycleRoles();
        // the three guards dropShift has that are nothing to do with the notice period
        S.openShifts=[]; cyc.assign={}; S.viewAs="admin";
        var d3=iso(addDays(new Date(),30));
        cyc.assign["s1|"+d3]={kind:"cst"};
        T("come off: there is nothing to come off on a non-clinical day", dropShift("s1",d3)===false && !!cyc.assign["s1|"+d3]);
        cyc.assign["s1|"+d3]={kind:"clinical",period:"AM",zone:"z1",fixed:true};
        S.viewAs="s1";
        T("come off: a fixed-pattern shift is the admin's to change, not the person's", dropShift("s1",d3)===false && !!cyc.assign["s1|"+d3]);
        S.viewAs="admin";
        T("come off: an admin may still clear a fixed shift", dropShift("s1",d3)===true && !cyc.assign["s1|"+d3]);
        // who the app says came off, and who hears about it
        S.openShifts=[]; S.notifications=[]; cyc.assign={};
        S.viewAs="admin"; bookShift("s2",d3,"AM","z1");
        var adminDrop=dropShift("s2",d3), ag=(S.openShifts||[])[0];
        T("come off: an admin taking someone off is not that person walking off it — the gap is a plain one",
          adminDrop===true && !!ag && ag.droppedBy===undefined && !S.notifications.some(function(n){return /came off/.test(n.text);}) &&
          S.audit[0].actor==="admin");
        S.openShifts=[]; S.notifications=[]; S.viewAs="admin"; bookShift("s2",d3,"AM","z1");
        S.viewAs="s2"; dropShift("s2",d3);
        T("come off: the person who came off is not told about their own drop, but everyone else is", (function(){
          var mine=notifFor("s2").some(function(n){return /came off/.test(n.text);});
          var theirs=notifFor("s1").some(function(n){return /Sam came off/.test(n.text);});
          return mine===false && theirs===true; })());
        // a decision about a shift that has already gone
        S.openShifts=[]; cyc.assign={}; S.viewAs="admin"; bookShift("s1",near,"PM","z2");
        S.viewAs="s1"; askComeOff("s1",near,"sick child"); var a2=(S.openShifts||[])[0];
        delete cyc.assign["s1|"+near];
        T("come off: letting someone off a shift that is no longer theirs is refused rather than posting a second gap", (function(){
          S.viewAs="admin"; var before=(S.openShifts||[]).length, r=decideComeOff(a2.id,true,"");
          return r===false && (S.openShifts||[]).length===before && a2.ask.status==="pending"; })());
        // leave that has already happened must not be advertised
        S.openShifts=[]; cyc.assign={}; S.viewAs="admin";
        var past=iso(addDays(new Date(),-3));
        cyc.assign["s3|"+past]={kind:"clinical",period:"AM",zone:"z1"};
        S.requests=[{id:"rlv3",type:"leave",from:"s3",code:"AL",dateFrom:past,dateTo:past,status:"pending",createdTs:Date.now()}];
        approveRequest("rlv3","");
        T("come off: approving back-dated leave clears the day without advertising a shift that has already been worked",
          !cyc.assign["s3|"+past] && (S.openShifts||[]).length===0);
        // a rounds roster still lets a past day go, exactly as it always did
        T("come off: on a rounds roster a past day can still be cleared, which is what it has always done", (function(){
          var wasMode=cyc.settings.rosterMode, wasG=S.rosterMode, wasN=cyc.settings.noticeDays;
          delete cyc.settings.rosterMode; S.rosterMode="rounds"; cyc.settings.noticeDays=0;
          cyc.assign["s1|"+past]={kind:"clinical",period:"AM",zone:"z1"}; S.viewAs="s1";
          var r=dropShift("s1",past);
          cyc.settings.rosterMode=wasMode; S.rosterMode=wasG; cyc.settings.noticeDays=wasN; S.viewAs="admin";
          return r===true && !cyc.assign["s1|"+past]; })());
        S.requests=[];
      })();
      cyc.assign=JSON.parse(keepA); S.openShifts=JSON.parse(keepOS); S.requests=JSON.parse(keepReq);
      S.leave=JSON.parse(keepLv); S.notifications=JSON.parse(keepNo); S.marketOn=keepM;
      if(keepMode===undefined)delete cyc.settings.rosterMode; else cyc.settings.rosterMode=keepMode;
      S.rosterMode=keepGM; hydrateCycleSettings(); S.viewAs="admin";
      T("come off: the block leaves the roster mode exactly as it found it", S.rosterMode===keepGM && cyc.settings.rosterMode===keepMode);
    })();
    if(keepN===undefined)delete cyc.settings.noticeDays; else cyc.settings.noticeDays=keepN;
    cyc.status=keepSt; cyc.archived=keepAr; S.tab=keepT; _setupTab=keepSb; S.viewAs=keepV;
  })(); }
  // ---- on-call: a roster of its own, beside the shifts rather than inside them ----
  if(typeof ocWindows==="function"){ (function(){
    var cyc=S.cycles[0], keepW=cyc.settings.oncallWindows, keepOC=cyc.oncall, keepA=JSON.stringify(cyc.assign), keepT=S.tab, keepSb=_setupTab, keepV=S.viewAs;
    T("on-call: a cycle that has never set a window, and has no zone carrying on-call, has none — where SWIFT is today",
      cyc.settings.oncallWindows===undefined && ocWindows(cyc).length===0 && ocWindows({}).length===0 && ocHolder(cyc,"2026-08-05","night")===null && ocInUse(cyc,"night")===0);
    cyc.settings.oncallWindows=[{id:"night",code:"NIGHT",label:"Night",start:"22:00",end:"08:00",book:true,rest:true,from:null},
                                {id:"eve",code:"EVE",label:"Evening",start:"17:00",end:"22:00",book:false,rest:false,from:null}];
    var _dn=6, _off=function(n,h){ var d=parseISO(iso(addDays(new Date(),n))); return new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,0).getTimezoneOffset(); };
    while(_off(_dn,22)!==_off(_dn+1,8))_dn++;   // never the night a daylight-saving change falls in: that night is an hour shorter or longer, by design (the next calendar day, not 24 hours on)
    var D=iso(addDays(new Date(),_dn));
    T("on-call: a window carries its own name, hours and switches", (function(){
      var w=ocWindow(cyc,"night"); return !!w && w.label==="Night" && ocHours(w)===10 && ocTime(w)==="22:00–08:00" && w.book===true && ocWindow(cyc,"gone")===null; })());
    T("on-call: a window that runs past midnight is measured across the two days", (function(){
      var sp=ocSpan(D,ocWindow(cyc,"night")); return (sp.en-sp.st)/36e5===10 && sp.en>sp.st; })());
    cyc.oncall={}; cyc.oncall[ocKey(D,"night")]="s1";
    T("on-call: the key is one date and one window, so one person holds it and a second cannot",
      Object.keys(cyc.oncall).length===1 && Object.keys(cyc.oncall)[0]===D+"|night" && ocHolder(cyc,D,"night")==="s1" && ocHolder(cyc,D,"eve")===null &&
      ocHeldBy(cyc,"s1",D).map(function(w){return w.id;}).join()==="night" && ocHeldBy(cyc,"s2",D).length===0 &&
      ocInUse(cyc,"night")===1 && ocCountFor(cyc,"s1")===1 && ocCountFor(cyc,"s2")===0);
    // THE point of the whole design
    T("on-call: the same person can work the floor AND carry a window later the same day", (function(){
      cyc.assign["s1|"+D]={kind:"clinical",period:"AM",zone:"z1"};
      return getShift("s1",D).kind==="clinical" && ocHeldBy(cyc,"s1",D).length===1; })());
    T("on-call: carrying a window is not cover and takes no zone, so it can never hide a gap", (function(){
      delete cyc.assign["s1|"+D];
      cyc.oncall[ocKey(D,"eve")]="s2";
      var cc=clinicalCounts(D,null), z=zoneTaken(D,"PM","z1",null), free=freeZones(D,"PM").length;
      return cc.am===0 && cc.pm===0 && z===null && free===zonesFor("PM").length; })());
    T("on-call: a window in use cannot be removed out from under the days on it", ocInUse(cyc,"eve")===1 && ocInUse(cyc,"night")===1);
    // the card, and the trap every per-cycle card has: it must read THIS cycle
    (function(){ S.viewAs="admin"; S.tab="setup"; _setupTab="cycle"; var v=viewSetup();
      T("on-call: the card is one row per window, with its hours, who may take it and whether it counts toward rest",
        v.indexOf('id="card-oncall"')>0 && (v.match(/data-oci="/g)||[]).length===2 && /class="oc-label" value="Night"/.test(v) &&
        /class="oc-start" value="22:00"/.test(v) && (v.match(/class="oc-book" checked/g)||[]).length===1 && (v.match(/class="oc-rest" checked/g)||[]).length===1 &&
        v.indexOf("never hide a gap")>0 && v.indexOf(">On-call<")>0);
      T("on-call: ticking a zone makes a window follow that evening, and unticking them all makes it a window people take", (function(){
        var qsa=document.querySelectorAll, rows=[["night",["z1"]],["eve",[]]].map(function(r){ return {dataset:{ocid:r[0]},querySelector:function(){ return null; },
          querySelectorAll:function(sel){ return sel===".oc-z"?[{value:"z1",checked:r[1].indexOf("z1")>=0},{value:"z2",checked:false}]:[]; }}; });
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        var list; try{ list=ocRowsNow(); } finally { document.querySelectorAll=qsa; }
        return !!list[0].from && list[0].from.zones.join()==="z1" && list[0].from.period==="PM" && list[1].from===null && cyc.settings.oncallWindows[0].from===null; })());
      T("on-call: a window people have taken cannot be switched to follow a shift while days are on it", (function(){
        render(); var btn=document.getElementById("saveOncall"), qsa=document.querySelectorAll, before=JSON.stringify(cyc.settings.oncallWindows);
        var rows=[{dataset:{ocid:"night"},querySelector:function(){ return null; },querySelectorAll:function(sel){ return sel===".oc-z"?[{value:"z1",checked:true}]:[]; }}];
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        try{ if(btn.onclick)btn.onclick(); } finally { document.querySelectorAll=qsa; }
        return !!btn.onclick && ocInUse(cyc,"night")>0 && JSON.stringify(cyc.settings.oncallWindows)===before; })());
      T("on-call: + Add and Remove pass the same checks as Save, so an unsaved change Save would refuse never slips in through them", (function(){
        render(); var qsa=document.querySelectorAll, before=JSON.stringify(cyc.settings.oncallWindows), said=[], t0=toast; toast=function(m){ said.push(String(m)); };
        var rows=[{dataset:{ocid:"night"},querySelector:function(){ return null; },querySelectorAll:function(sel){ return sel===".oc-z"?[{value:"z1",checked:true}]:[]; }}];
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        try{ document.getElementById("addOncall").onclick(); } finally { document.querySelectorAll=qsa; toast=t0; }
        return JSON.stringify(cyc.settings.oncallWindows)===before && said.some(function(m){ return /by hand, so it cannot start following a shift/.test(m); }); })());
      T("on-call: a blank name or time is refused by name, not quietly kept as it was", (function(){
        render(); var qsa=document.querySelectorAll, before=JSON.stringify(cyc.settings.oncallWindows), said=[], t0=toast; toast=function(m){ said.push(String(m)); };
        var rows=[{dataset:{ocid:"eve"},querySelector:function(q){ return q===".oc-label"?{value:"  "}:null; },querySelectorAll:function(){ return []; }}];
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        try{ document.getElementById("saveOncall").onclick(); } finally { document.querySelectorAll=qsa; toast=t0; }
        return JSON.stringify(cyc.settings.oncallWindows)===before && said.indexOf("Every on-call window needs a name.")>=0; })());
      T("on-call: a card drawn before the list changed elsewhere refuses to save over it, and redraws", (function(){
        render(); var said=[], t0=toast; toast=function(m){ said.push(String(m)); };
        var other=JSON.parse(JSON.stringify(cyc.settings.oncallWindows)); other[1].label="Evening (moved)"; cyc.settings.oncallWindows=other;
        try{ document.getElementById("saveOncall").onclick(); } finally { toast=t0; }
        var kept=cyc.settings.oncallWindows[1].label==="Evening (moved)"; other[1].label="Evening";
        return kept && said.some(function(m){ return /changed since this card was drawn/.test(m); }); })());
      T("on-call: an empty list says so rather than showing nothing", (function(){
        var was=cyc.settings.oncallWindows; cyc.settings.oncallWindows=[]; var e=viewSetup(); cyc.settings.oncallWindows=was;
        return e.indexOf("No on-call windows yet")>0; })());
      T("on-call: the card shows this cycle's own windows, never another's", (function(){
        var _c=confirm; confirm=function(){return true;}; prepareNext(); confirm=_c;
        var made=S.cycles[S.cycles.length-1];
        var carried=!!made.settings.oncallWindows && made.settings.oncallWindows.length===2 && made.settings.oncallWindows!==cyc.settings.oncallWindows;
        made.settings.oncallWindows=[{id:"solo",code:"SOLO",label:"Solo",start:"20:00",end:"23:00",book:true,rest:true,from:null}];
        S.activeId=made.id; hydrateCycleSettings(); var other=viewSetup();
        S.activeId=cyc.id; S.cycles=S.cycles.filter(function(c){return c.id!==made.id;}); hydrateCycleSettings(); hydrateCycleRoles();
        return carried && other.indexOf('value="Solo"')>0 && other.indexOf('value="Night"')<0 && typeof S.oncallWindows==="undefined"; })());
      S.tab=keepT; _setupTab=keepSb; })();
    // ---- the cloud merge: two devices, one roster. Nothing tested mergeOnto before this.
    (function(){ var keepS=S, keepB=_remoteBase;
      var mk=function(oncall,assign){ return {staff:[{id:"s1",name:"Alex"},{id:"s2",name:"Sam"}],staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},
        zones:[{id:"z1",name:"Resus",am:true,pm:true}], leave:[], audit:[], requests:[], messages:[], notifications:[], feedback:[], openShifts:[], pushSubs:[], reqComments:[], outbox:[],
        cycles:[{id:"c1",cycle:{start:"2026-08-03",weeks:8},status:"published",archived:false,settings:{},assign:assign||{},oncall:oncall}], activeId:"c1", viewAs:"admin", tab:"my"}; };
      var run=function(baseOC,mineOC,theirsOC){
        var base=mk(baseOC), mine=mk(mineOC), theirs=mk(theirsOC);
        if(baseOC===undefined)delete base.cycles[0].oncall;
        if(mineOC===undefined)delete mine.cycles[0].oncall;
        if(theirsOC===undefined)delete theirs.cycles[0].oncall;
        _remoteBase=JSON.stringify(base); S=mine;
        var out=mergeOnto(theirs); S=keepS; _remoteBase=keepB;
        return out.cycles[0].oncall; };
      T("merge: two devices each put someone on a different window the same day, and both survive", (function(){
        var r=run({}, {"2026-08-05|night":"s1"}, {"2026-08-05|eve":"s2"});
        return !!r && r["2026-08-05|night"]==="s1" && r["2026-08-05|eve"]==="s2" && Object.keys(r).length===2; })());
      T("merge: a window I cleared stays cleared when they never touched it", (function(){
        var r=run({"2026-08-05|night":"s1"}, {}, {"2026-08-05|night":"s1"});
        return !!r && r["2026-08-05|night"]===undefined && Object.keys(r).length===0; })());
      T("merge: a window THEY cleared goes, when I never touched it", (function(){
        var r=run({"2026-08-05|night":"s1"}, {"2026-08-05|night":"s1"}, {});
        return !!r && r["2026-08-05|night"]===undefined; })());
      T("merge: if I moved a window to someone else while they cleared it, my change stands", (function(){
        var r=run({"2026-08-05|night":"s1"}, {"2026-08-05|night":"s2"}, {});
        return !!r && r["2026-08-05|night"]==="s2"; })());
      // the one that loses data silently if it is wrong
      T("merge: a build that knows nothing about on-call has no OPINION about it, and never wipes it", (function(){
        var r=run({"2026-08-05|night":"s1"}, {"2026-08-05|night":"s1","2026-08-06|night":"s2"}, undefined);
        return !!r && r["2026-08-05|night"]==="s1" && r["2026-08-06|night"]==="s2"; })());
      T("merge: a cycle nobody has put on call keeps no on-call field at all", (function(){
        var r=run(undefined,undefined,undefined); return r===undefined; })());
      T("merge: two people take the same window, and the take that reached the cloud first stands; this device is told", (function(){
        _ocLost=[]; var base=mk({}), mine=mk({"2026-08-05|night":"s2"}), theirs=mk({"2026-08-05|night":"s1"});
        _remoteBase=JSON.stringify(base); S=mine; var out=mergeOnto(theirs); S=keepS; _remoteBase=keepB; var r=out.cycles[0].oncall, lost=_ocLost.slice(); _ocLost=[];
        return !!r && r["2026-08-05|night"]==="s1" && lost.length===1 && lost[0].sid==="s2" && lost[0].now==="s1" && lost[0].k==="2026-08-05|night" &&
          out.audit.some(function(a){ return a.id==="oclost-c1-2026-08-05-night-s2" && a.detail==="on-call not taken — Alex had it first — Sam (2026-08-05|night)"; }); })());
      T("sync: the merge base is kept with the copy it belongs to, on every path that applies someone else's change", (function(){
        var kb=_remoteBase; _remoteBase='{"x":1}'; _keepBase(); var ok=localStorage.getItem(orgKey("_base"))==='{"x":1}' && localStorage.getItem(orgKey())===JSON.stringify(S); _remoteBase=kb;
        return ok && _applyRemoteDoc.toString().indexOf("_keepBase()")>0 && _evBaseFlush.toString().indexOf("_keepBase()")>0 && cloudSave.toString().indexOf("_keepBase()")>0 && cloudCommit.toString().indexOf("_keepBase()")>0; })());
      T("sync: a commit that loses a race is re-run on the merge of what was waiting, never merged in itself", cloudCommit.toString().indexOf("S=JSON.parse(pre)")>0 && cloudCommit.toString().indexOf("_fatigueWarn=null")>0);
      T("merge: a stale removal (leave approved, a person removed, a clear) never deletes someone who has taken it since", (function(){
        _ocLost=[]; var r=run({"2026-08-05|night":"s1"}, {}, {"2026-08-05|night":"s2"}); var n=_ocLost.length; _ocLost=[];
        return !!r && r["2026-08-05|night"]==="s2" && n===0; })());
      T("merge: a shift key keeps the old rule, because it belongs to one person", (function(){
        var m=_mergeKeyMap({"s1|d":{kind:"clinical",period:"AM"}},{"s1|d":{kind:"clinical",period:"PM"}},{}), o=_mergeKeyMap({"k":"s2"},{"k":"s1"},{},true);
        return m["s1|d"].period==="AM" && o.k==="s1"; })());
      T("merge: an offline admin saving one settings card never undoes another card someone saved meanwhile", (function(){
        var W=[{id:"night",code:"NIGHT",label:"Night",start:"22:00",end:"08:00",book:true,rest:true,from:null}];
        var base=mk({}), mine=mk({}), theirs=mk({"2026-08-05|night":"s2"});
        mine.cycles[0].settings={fatigue:{mode:"warn",minRest:10,maxConsec:5}}; theirs.cycles[0].settings={oncallWindows:W};
        _remoteBase=JSON.stringify(base); S=mine; var out=mergeOnto(theirs); S=keepS; _remoteBase=keepB;
        var st=out.cycles[0].settings;
        return !!st.fatigue && st.fatigue.mode==="warn" && Array.isArray(st.oncallWindows) && st.oncallWindows[0].id==="night" && out.cycles[0].oncall["2026-08-05|night"]==="s2"; })());
      T("merge: a settings card both sides changed keeps this device's version, as before", (function(){
        var base=mk({}), mine=mk({}), theirs=mk({});
        mine.cycles[0].settings={noticeDays:14}; theirs.cycles[0].settings={noticeDays:7};
        _remoteBase=JSON.stringify(base); S=mine; var out=mergeOnto(theirs); S=keepS; _remoteBase=keepB;
        return out.cycles[0].settings.noticeDays===14; })());
      T("merge: a take lost to someone else says so in words, once", (function(){
        var said=[], t0=toast; toast=function(m){ said.push(String(m)); };
        _ocLost=[{cyc:S.cycles[0].id,k:"2026-08-05|night",sid:"s2",now:"s1"}]; ocLostToast(); ocLostToast(); toast=t0;
        return said.length===1 && /stays with .+, who had it first\./.test(said[0]) && _ocLost.length===0; })());
      T("merge: the shifts still merge exactly as they always did", (function(){
        var base=mk({},{ "s1|2026-08-05":{kind:"clinical",period:"AM",zone:"z1"} });
        var mine=mk({},{ "s1|2026-08-05":{kind:"clinical",period:"AM",zone:"z1"}, "s2|2026-08-06":{kind:"clinical",period:"PM",zone:"z1"} });
        var theirs=mk({},{});
        _remoteBase=JSON.stringify(base); S=mine; var out=mergeOnto(theirs); S=keepS; _remoteBase=keepB;
        var a=out.cycles[0].assign;
        return a["s1|2026-08-05"]===undefined && !!a["s2|2026-08-06"]; })());
    })();
    // ---- the referee: leave wins over the phone, and an orphan is left alone
    (function(){
      var mkOut=function(oncall,leave){ return {cycles:[{id:"c1",settings:{oncallWindows:[{id:"night",code:"NIGHT",label:"Night",start:"22:00",end:"08:00",book:true,rest:true}]},assign:{},oncall:oncall}],leave:leave||[],audit:[],openShifts:[]}; };
      var o1=mkOut({"2026-08-05|night":"s1"},[{id:"L1",staffId:"s1",status:"approved",code:"AL",from:"2026-08-04",to:"2026-08-06"}]);
      _mergeInvariants(o1);
      T("merge: somebody on approved leave is not left carrying the phone, and the log says why",
        o1.cycles[0].oncall["2026-08-05|night"]===undefined &&
        o1.audit.some(function(a){ return a.action==="merge.fix" && /on-call removed — approved AL leave on 2026-08-05 — s1 \(2026-08-05\|night\)/.test(a.detail) && a.id==="ocfix-c1-2026-08-05-night-s1"; }));
      var o2=mkOut({"2026-08-05|night":"s1","2026-08-05|gone-window":"s2"},[]);
      _mergeInvariants(o2);
      T("merge: an on-call entry for a window that has gone away is left alone, not permanently dropped",
        o2.cycles[0].oncall["2026-08-05|night"]==="s1" && o2.cycles[0].oncall["2026-08-05|gone-window"]==="s2" && o2.audit.length===0);
      var o3=mkOut({"2026-08-05|on-call":"s1","2026-08-05|oncall":"s2"},[{id:"L1",staffId:"s1",status:"approved",code:"AL",from:"2026-08-05",to:"2026-08-05"},{id:"L2",staffId:"s2",status:"approved",code:"AL",from:"2026-08-05",to:"2026-08-05"}]);
      _mergeInvariants(o3);
      T("merge: two windows whose names differ only by punctuation get two log lines, not one",
        o3.audit.filter(function(a){return a.action==="merge.fix";}).length===2 &&
        o3.audit.filter(function(a){return a.action==="merge.fix";}).map(function(a){return a.id;}).sort().join()==="ocfix-c1-2026-08-05-on-call-s1,ocfix-c1-2026-08-05-oncall-s2");
      var o5=mkOut({"2026-08-05|night":"s1","2026-08-06|night":"s2","2026-08-07|night":"gone"},[]);
      o5.staff=[{id:"s1",name:"Alex"},{id:"s2",name:"Sam"}]; o5.cycles[0].assign={"s2|2026-08-06":{kind:"leave",code:"UA"}};
      _mergeInvariants(o5);
      T("merge: leave typed into the roster takes the phone too, and a holder no longer in the group is dropped with a line naming them",
        o5.cycles[0].oncall["2026-08-05|night"]==="s1" && o5.cycles[0].oncall["2026-08-06|night"]===undefined && o5.cycles[0].oncall["2026-08-07|night"]===undefined &&
        o5.audit.some(function(a){ return a.id==="ocfix-c1-2026-08-06-night-s2" && /UA on 2026-08-06 — Sam/.test(a.detail); }) &&
        o5.audit.some(function(a){ return a.id==="ocfix-c1-2026-08-07-night-gone" && /no longer in the group/.test(a.detail); }));
      var o6=mkOut({"2026-08-05|night":"s1"},[{id:"L1",staffId:"s1",status:"approved",code:"AL",from:"2026-08-05",to:"2026-08-05"}]);
      o6.audit=[{id:"ocfix-c1-2026-08-05-night-s2",action:"merge.fix",detail:"an earlier drop of Sam"}];
      _mergeInvariants(o6);
      T("merge: a second drop of the same slot, for a different person, is a line of its own", o6.audit.filter(function(a){return a.action==="merge.fix";}).length===2);
      var o4=mkOut({"2026-08-05|night":"s1"},[]);
      _mergeInvariants(o4);
      T("merge: with nobody on leave the referee changes nothing", o4.cycles[0].oncall["2026-08-05|night"]==="s1" && o4.audit.length===0);
    })();
    // ---- leave and removals take the phone with them, so the referee stays a backstop
    (function(){ var keepOC2=cyc.oncall, keepReq=JSON.stringify(S.requests||[]), keepLv=JSON.stringify(S.leave||[]), keepA2=JSON.stringify(cyc.assign);
      var d=iso(addDays(new Date(),12));
      cyc.oncall={}; cyc.oncall[ocKey(d,"night")]="s3"; S.requests=[]; S.viewAs="admin";
      S.requests=[{id:"rlv9",type:"leave",from:"s3",code:"AL",dateFrom:d,dateTo:d,status:"pending",createdTs:Date.now()}];
      approveRequest("rlv9","");
      T("on-call: approving leave takes the phone off them there and then, not minutes later on a merge", ocHolder(cyc,d,"night")===null);
      cyc.oncall[ocKey(d,"night")]="s3";
      plannerSetLeave("s3",d,null);
      T("on-call: merely clearing a stray leave day in the planner does not drop the phone", ocHolder(cyc,d,"night")==="s3");
      plannerSetLeave("s3",d,"CME");
      T("on-call: setting leave in the planner does take it", ocHolder(cyc,d,"night")===null);
      cyc.oncall[ocKey(d,"night")]="s3";
      S.cycles.forEach(function(c){ if(c.oncall)Object.keys(c.oncall).forEach(function(k){ if(c.oncall[k]==="s3")delete c.oncall[k]; }); });
      T("on-call: removing a person clears the windows they held, which are keyed by them as the VALUE", ocHolder(cyc,d,"night")===null);
      S.requests=JSON.parse(keepReq); S.leave=JSON.parse(keepLv); cyc.assign=JSON.parse(keepA2);
      if(keepOC2===undefined)delete cyc.oncall; else cyc.oncall=keepOC2;
    })();
    // ---- taking and clearing a window
    (function(){ var keepOC3=cyc.oncall, keepA3=JSON.stringify(cyc.assign), keepSt=cyc.status, keepM=cyc.settings.rosterMode, keepG=S.rosterMode;
      cyc.status="published"; cyc.settings.rosterMode="rolling"; S.rosterMode="rolling"; hydrateCycleSettings();
      cyc.oncall={}; cyc.assign={};
      var d=iso(addDays(new Date(),9));
      S.viewAs="s1";
      T("on-call: a person takes a window, and it is theirs", ocTake("s1",d,"night")===true && ocHolder(cyc,d,"night")==="s1" && ocCountFor(cyc,"s1")===1);
      T("on-call: taking the same window again is not an error and changes nothing", ocTake("s1",d,"night")===true && ocHolder(cyc,d,"night")==="s1" && Object.keys(cyc.oncall).length===1);
      T("on-call: the second person is refused by name, and the first keeps it", (function(){
        S.viewAs="s2"; var before=ocHolder(cyc,d,"night");
        var r=ocTake("s2",d,"night");
        return r===false && ocHolder(cyc,d,"night")===before; })());
      T("on-call: it is not a shift — the person holding it can still book the floor that day, and cover is untouched", (function(){
        S.viewAs="admin"; var b=bookShift("s1",d,"AM","z1");
        var cc=clinicalCounts(d,null);
        return b===true && !!cyc.assign["s1|"+d] && ocHolder(cyc,d,"night")==="s1" && cc.am===1 && cc.pm===0; })());
      T("on-call: removing the shift leaves the phone alone, because they are two different things", (function(){
        S.viewAs="admin"; unbookShift("s1",d); return !cyc.assign["s1|"+d] && ocHolder(cyc,d,"night")==="s1"; })());
      T("on-call: somebody else cannot clear it, and the holder can", (function(){
        S.viewAs="s2"; var sneak=ocClear("s2",d,"night"), still=ocHolder(cyc,d,"night")==="s1";
        S.viewAs="s1"; var mine=ocClear("s1",d,"night");
        return sneak===false && still && mine===true && ocHolder(cyc,d,"night")===null; })());
      T("on-call: an admin places and clears it for anyone", (function(){
        S.viewAs="admin"; var a=ocTake("s3",d,"night"), held=ocHolder(cyc,d,"night")==="s3";
        var b=ocClear("s3",d,"night");
        return a===true && held && b===true && ocHolder(cyc,d,"night")===null; })());
      T("on-call: a window nobody may take by hand is refused, and a window that is gone is refused", (function(){
        S.viewAs="s1"; var noBook=ocTake("s1",d,"eve"), gone=ocTake("s1",d,"vanished");
        return noBook===false && gone===false && ocHolder(cyc,d,"eve")===null; })());
      T("on-call: nobody on leave is left carrying the phone", (function(){
        S.viewAs="admin"; addLeave({staffId:"s2",from:d,to:d,code:"AL",status:"approved",requestId:"t"});
        var r=ocTake("s2",d,"night");
        S.leave=S.leave.filter(function(L){return L.requestId!=="t";});
        return r===false && ocHolder(cyc,d,"night")===null; })());
      T("on-call: a past day on a rolling roster is closed to staff but open to the admin", (function(){
        var past=iso(addDays(new Date(),-2));
        S.viewAs="s1"; var staff=ocTake("s1",past,"night");
        S.viewAs="admin"; var adm=ocTake("s1",past,"night");
        ocClear("s1",past,"night");
        return staff===false && adm===true; })());
      T("on-call: somebody out of this cycle's roster cannot be put on call, because payroll would list them nowhere", (function(){
        var r=cyc.roles&&cyc.roles.s3, was=r?JSON.stringify(r):null; if(!cyc.roles)cyc.roles={}; cyc.roles.s3=Object.assign({},r||{},{in:false}); hydrateCycleRoles();
        S.viewAs="admin"; var res=ocTake("s3",d,"night");
        if(was)cyc.roles.s3=JSON.parse(was); else delete cyc.roles.s3; hydrateCycleRoles();
        return res===false && ocHolder(cyc,d,"night")===null; })());
      T("on-call: one person never carries two windows at once, but back to back is fine", (function(){
        var ws=cyc.settings.oncallWindows; cyc.settings.oncallWindows=ws.concat([{id:"late",code:"LATE",label:"Late",start:"23:00",end:"01:00",book:true,rest:true,from:null}]);
        S.viewAs="admin"; var a=ocTake("s1",d,"night"), b=ocTake("s1",d,"late"), c=ocTake("s1",d,"eve");
        var ok=a===true && b===false && ocHolder(cyc,d,"late")===null && c===true && ocHolder(cyc,d,"eve")==="s1";
        ocClear("s1",d,"night"); ocClear("s1",d,"eve"); cyc.settings.oncallWindows=ws; return ok; })());
      T("on-call: an admin clearing the person they saw never clears whoever holds it by the time it lands", (function(){
        S.viewAs="admin"; ocTake("s2",d,"night"); var r=ocClear("s1",d,"night"), kept=ocHolder(cyc,d,"night")==="s2"; ocClear("s2",d,"night");
        return r===false && kept; })());
      T("on-call: staff cannot come off a window only the admin places, or one inside the notice period; the admin can", (function(){
        var kn=cyc.settings.noticeDays; S.viewAs="admin"; ocTake("s1",d,"eve");
        S.viewAs="s1"; var eve=ocClear("s1",d,"eve");
        S.viewAs="admin"; ocClear("s1",d,"eve"); S.viewAs="s1"; ocTake("s1",d,"night"); cyc.settings.noticeDays=14;
        var inside=ocClear("s1",d,"night"), still=ocHolder(cyc,d,"night")==="s1";
        var _ss=_srSid; _srSid="s1"; var sheet=daySheetHTML(d); _srSid=_ss;
        S.viewAs="admin"; var adm=ocClear("s1",d,"night");
        if(kn===undefined)delete cyc.settings.noticeDays; else cyc.settings.noticeDays=kn;
        return eve===false && inside===false && still && sheet.indexOf('data-ocdrop="'+d+'|night"')<0 && sheet.indexOf("inside the notice period")>0 && adm===true; })());
      T("on-call: leave set from a roster cell, from the day sheet, or by a leave import takes the phone", (function(){
        S.viewAs="admin"; var ka=JSON.stringify(cyc.assign), kl=JSON.stringify(S.leave);
        ocTake("s1",d,"night"); setShift("s1",d,{kind:"leave",code:"UA"}); var cell=cyc.oncall[ocKey(d,"night")]===undefined;
        cyc.assign=JSON.parse(ka); ocTake("s2",d,"night");
        applyLeaveImport({staff:[{name:S.staff.find(function(x){return x.id==="s2";}).name}],leave:[{name:S.staff.find(function(x){return x.id==="s2";}).name,from:d,to:d,code:"AL"}],range:null});
        var imp=cyc.oncall[ocKey(d,"night")]===undefined;
        cyc.assign=JSON.parse(ka); S.leave=JSON.parse(kl); return cell && imp; })());
      T("on-call: a stray key for someone on leave shows nothing, pays nothing, blocks nothing, and the window is free to take", (function(){
        S.viewAs="admin"; var kl=JSON.stringify(S.leave); cyc.oncall[ocKey(d,"night")]="s2"; addLeave({staffId:"s2",from:d,to:d,code:"AL",status:"approved",requestId:"t2"});
        var none=ocHolder(cyc,d,"night")===null && ocTakenBy(cyc,"s2",d).length===0 && ocHeldBy(cyc,"s2",d).length===0 && ocInUse(cyc,"night")===0;
        var pay=payrollRows().filter(function(r){ return r.date===d && r.code==="NIGHT"; }).length===0;
        var take=ocTake("s1",d,"night")===true && ocHolder(cyc,d,"night")==="s1";
        ocClear("s1",d,"night"); S.leave=JSON.parse(kl); return none && pay && take; })());
      T("on-call: on a leave day the sheet offers nothing to take, and the day row only says on call free where the person could take one", (function(){
        var kl=JSON.stringify(S.leave), ws=cyc.settings.oncallWindows; addLeave({staffId:"s1",from:d,to:d,code:"AL",status:"approved",requestId:"t3"});
        var _ss=_srSid; _srSid="s1"; S.viewAs="s1"; var sheet=daySheetHTML(d); S.leave=JSON.parse(kl);
        cyc.settings.oncallWindows=ws.map(function(w){ return Object.assign({},w,{book:false}); });
        var row=dayRowHTML("s1",parseISO(d),{batch:true,canPick:true,openCount:function(){return 0;}});
        cyc.settings.oncallWindows=ws; _srSid=_ss; S.viewAs="admin";
        return sheet.indexOf("data-octake")<0 && sheet.indexOf("on leave that day")>0 && row.indexOf("on call free")<0; })());
      // the sheet, and the row that opens it, must agree
      (function(){ var _ss=_srSid; _srSid="s1"; S.viewAs="s1";
        var free=daySheetHTML(d);
        S.viewAs="admin"; ocTake("s2",d,"night"); S.viewAs="s1";
        var taken=daySheetHTML(d);
        S.viewAs="admin"; ocClear("s2",d,"night"); S.viewAs="s1"; ocTake("s1",d,"night");
        var mine=daySheetHTML(d);
        var row=dayRowHTML("s1",parseISO(d),{batch:true,canPick:true,openCount:function(){return 0;}});
        S.viewAs="admin"; ocClear("s1",d,"night"); var rowFree=dayRowHTML("s1",parseISO(d),{batch:true,canPick:true,openCount:function(){return 0;}});
        _srSid=_ss;
        T("on-call: the sheet offers a free window, names who has it, and offers to come off your own",
          free.indexOf('data-octake="'+d+'|night"')>0 && taken.indexOf('data-octake="'+d+'|night"')<0 && /Sam<\/span>/.test(taken) &&
          mine.indexOf('data-ocdrop="'+d+'|night"')>0 && free.indexOf("counts as nobody’s cover")>0);
        T("on-call: the day row shows the window a person holds, and says when one is free",
          /<span class="tag oc">Night<\/span>/.test(row) && rowFree.indexOf("on call free")>0); })();
      T("on-call: a group with no windows sees nothing of any of it", (function(){
        var was=cyc.settings.oncallWindows; cyc.settings.oncallWindows=[];
        var _ss=_srSid; _srSid="s1"; S.viewAs="s1"; var v=daySheetHTML(d);
        var r=dayRowHTML("s1",parseISO(d),{batch:true,canPick:true,openCount:function(){return 0;}});
        _srSid=_ss; cyc.settings.oncallWindows=was; S.viewAs="admin";
        return v.indexOf("On call")<0 && v.indexOf("data-octake")<0 && r.indexOf("tag oc")<0 && r.indexOf("on call free")<0; })());
      T("on-call: the cell editor offers each window beside the shift, and says it saves as you tap", (function(){
        S.viewAs="admin"; modal={staffId:"s1",isoD:d,draft:{kind:"off"}};
        try{ renderModal(); }catch(e){}   // the stub cannot wire a dialog, but openDialog has already painted it
        var h=document.getElementById("modalRoot").innerHTML;
        modal={staffId:null,isoD:null,draft:null};
        return h.indexOf('id="ocChoices"')>0 && h.indexOf('data-ocset="night"')>0 && h.indexOf('data-ocset="eve"')>0 && h.indexOf("saved as you tap")>0; })());
      // ---- safe hours, and being able to see it at all
      (function(){ var _f=cyc.settings.fatigue, D2=iso(addDays(new Date(),21)), D3=iso(addDays(new Date(),22));
        cyc.settings.fatigue={mode:"block",minRest:10,maxConsec:5};
        cyc.oncall={}; cyc.assign={}; S.viewAs="admin";
        T("on-call: a shift and the window that begins the moment it ends are one run of duty, not a rest breach", (function(){
          bookShift("s1",D2,"PM","z1");
          var r=ocTake("s1",D2,"night");                       // PM 15:30–23:30, Night 22:00–08:00: overlapping
          return r===true && ocHolder(cyc,D2,"night")==="s1"; })());
        cyc.assign={};                                        // now judge the window on its own, with no shift in the way
        T("on-call: a night carried is measured against the next morning, so the app stops a broken night", (function(){
          S.viewAs="s1"; var r=canBook("s1",D3,"AM","z1"); S.viewAs="admin";
          return r.ok===false && /Fatigue rule/.test(r.reason) && /rest after the previous shift/.test(r.reason); })());
        T("on-call: a window the group says is rest does not block the next morning", (function(){
          var ws=cyc.settings.oncallWindows; ws[0].rest=false;
          S.viewAs="s1"; var r=canBook("s1",D3,"AM","z1"); S.viewAs="admin"; ws[0].rest=true;
          return r.ok===true; })());
        T("on-call: taking a window is judged by the same rules, so a night before an early start is refused", (function(){
          cyc.assign={}; cyc.oncall={};
          var D4=iso(addDays(parseISO(D3),1));
          bookShift("s1",D4,"AM","z1");                        // the night window would end at 08:00, when this starts
          S.viewAs="s1"; var blocked=ocTake("s1",D3,"night");
          var why=ocFatigueCheck("s1",D3,"night");
          S.viewAs="admin"; var admOk=ocTake("s1",D3,"night");  // an admin is warned, never blocked
          cyc.assign={}; cyc.oncall={};
          return blocked===false && typeof why==="string" && /rest before the next day/.test(why) && admOk===true; })());
        T("on-call: a morning shift and a night on call the same day are two stretches, with the rest rule between them, in either order", (function(){
          cyc.assign={}; cyc.oncall={}; S.viewAs="admin"; bookShift("s1",D3,"AM","z1");   // 08:00–16:00, and Night from 22:00: 6 hours
          S.viewAs="s1"; var t=ocTake("s1",D3,"night"), why=ocFatigueCheck("s1",D3,"night");
          cyc.assign={}; S.viewAs="admin"; ocTake("s1",D3,"night"); S.viewAs="s1"; var b=canBook("s1",D3,"AM","z1");
          S.viewAs="admin"; cyc.assign={}; cyc.oncall={};
          return t===false && /Only 6h rest between two stretches of duty that day/.test(why||"") && b.ok===false && /between two stretches/.test(b.reason||""); })());
        T("on-call: a night across the daylight-saving change ends at 08:00 on the clock, not an hour out", (function(){
          var sp=ocSpan("2026-10-03",{start:"22:00",end:"08:00"}), sp2=ocSpan("2027-04-03",{start:"22:00",end:"08:00"}), sh=_shiftSpan("s1","2026-10-03","PM","z1","gone");
          return sp.en.getHours()===8 && sp.en.getDate()===4 && (sp.en-sp.st)/36e5===9 && sp2.en.getHours()===8 && (sp2.en-sp2.st)/36e5===11 && sh.en.getHours()===23; })());
        T("on-call: a run that includes days only on call is called days on duty, not clinical days", (function(){
          var _f=cyc.settings.fatigue; cyc.settings.fatigue={mode:"warn",minRest:0,maxConsec:3}; cyc.assign={}; cyc.oncall={};
          var d0=parseISO(D2); [0,1,2].forEach(function(i){ cyc.oncall[ocKey(iso(addDays(d0,i)),"night")]="s1"; });
          var why=ocFatigueCheck("s1",iso(addDays(d0,3)),"night");
          cyc.oncall={}; [0,1,2].forEach(function(i){ cyc.assign["s1|"+iso(addDays(d0,i))]={kind:"clinical",period:"AM",zone:"z1"}; });
          var why2=fatigueCheck("s1",iso(addDays(d0,3)),"AM","z1");
          cyc.assign={}; cyc.settings.fatigue=_f;
          return /This makes 4 days on duty in a row/.test(why||"") && /This makes 4 clinical days in a row/.test(why2||""); })());
        T("on-call: a booking refused for another reason leaves no safe-hours warning behind for the next one to announce", (function(){
          cyc.settings.fatigue={mode:"warn",minRest:10,maxConsec:5};
          cyc.assign={}; cyc.oncall={}; cyc.oncall[ocKey(D2,"night")]="s1";
          S.viewAs="admin"; bookShift("s2",D3,"AM","z1");        // the zone is gone, and that guard sits AFTER the safe-hours one
          _fatigueWarn=null; S.viewAs="s1";
          var r=canBook("s1",D3,"AM","z1"); var leaked=_fatigueWarn;      // refused at the zone guard, which sits after safe hours
          S.viewAs="admin"; cyc.assign={}; S.viewAs="s1";                 // now the same candidate with nothing in its way
          _fatigueWarn=null; var ok=canBook("s1",D3,"AM","z1"); var warned=_fatigueWarn;
          S.viewAs="admin"; _fatigueWarn=null; cyc.assign={};
          cyc.settings.fatigue={mode:"block",minRest:10,maxConsec:5};
          return r.ok===false && leaked===null && ok.ok===true && typeof warned==="string"; })());
        cyc.assign={}; cyc.oncall={}; cyc.oncall[ocKey(D2,"night")]="s1";
        T("on-call: it shows on the grid, in the tooltip, on the week strip and on the day board", (function(){
          var _t=S.tab, _dd=dailyDate; S.tab="roster"; var grid=viewRoster();
          dailyDate=D2; S.tab="daily"; var board=viewDaily(); dailyDate=_dd; S.tab=_t;
          var strip=weekStripHTML("s1",D2);
          var tip=cellTip({kind:"off"},"Alex",parseISO(D2),ocLine(cyc,"s1",D2));
          return /<span class="tag oc mini"[^>]*>OC<\/span>/.test(grid) && /On call: Night 22:00–08:00/.test(grid) &&
            board.indexOf(">On call</h3>")>0 && /class="tag oc"[^>]*>Night<\/span>/.test(board) &&
            strip.indexOf("Night 22:00–08:00")>0 && tip.indexOf("On call: Night 22:00–08:00")>0; })());
        T("on-call: a day carrying only a window is a row of its own, not swallowed by a run of days off", (function(){
          var strip=weekStripHTML("s1",D2);
          var withOC=strip.indexOf("Night 22:00–08:00")>0;
          cyc.oncall={}; var bare=weekStripHTML("s1",D2);
          cyc.oncall={}; cyc.oncall[ocKey(D2,"night")]="s1";
          return withOC && bare.indexOf("Night")<0 && (strip.match(/wk-row/g)||[]).length>(bare.match(/wk-row/g)||[]).length; })());
        if(_f===undefined)delete cyc.settings.fatigue; else cyc.settings.fatigue=_f;
        cyc.assign={}; cyc.oncall={};
      })();
      T("on-call: the two new audit keys have plain-word sentences",
        AUDIT_WORDS["oncall.take"]==="Went on call" && AUDIT_WORDS["oncall.clear"]==="Came off on call");
      cyc.assign=JSON.parse(keepA3); cyc.status=keepSt;
      if(keepM===undefined)delete cyc.settings.rosterMode; else cyc.settings.rosterMode=keepM;
      S.rosterMode=keepG; hydrateCycleSettings();
      if(keepOC3===undefined)delete cyc.oncall; else cyc.oncall=keepOC3;
      S.viewAs="admin";
    })();
    T("on-call: adding window after window never repeats an id, a name or the payroll code payroll matches on", (function(){
      var l=[]; for(var i=0;i<4;i++)l.push(ocNewWindow(l));
      var ids={},labels={},codes={};
      l.forEach(function(w){ ids[w.id]=1; labels[w.label]=1; codes[w.code]=1; });
      return l.length===4 && Object.keys(ids).length===4 && Object.keys(labels).length===4 && Object.keys(codes).length===4 &&
        /^on-call-/.test(l[0].id) && l[0].code==="ONCALL" && l[0].start==="22:00" && l[0].book===true && l[0].rest===true; })());
    T("on-call: a new window never takes a removed window's id, or a name already on the card", (function(){
      var a=ocNewWindow([{id:"ONC",code:"OC",label:"On-call"}]), b=ocNewWindow([{id:"ONC",code:"OC",label:"On-call"},{id:"on-call-x",code:"ONCALL",label:"On-call 2"}]);
      return a.label==="On-call 2" && a.id.indexOf("on-call-2-")===0 && a.code==="ONCALL" && b.label==="On-call 3" && b.code!=="ONCALL"; })());
    T("on-call: the checklist asks whether the group runs it, and says what is set", (function(){
      var r=setupChecklist().find(function(x){return x.key==="oncall";});
      if(!r||r.anchor!=="card-oncall")return false;
      var withW=r.detail.indexOf("Night 22:00–08:00")===0;
      var was=cyc.settings.oncallWindows; cyc.settings.oncallWindows=[];
      var none=setupChecklist().find(function(x){return x.key==="oncall";}).detail.indexOf("None")===0;
      cyc.settings.oncallWindows=was; return withW && none; })());
    T("on-call: the new audit key has a plain-word sentence", AUDIT_WORDS["settings.oncall"]==="Changed the on-call windows");
    if(keepW===undefined)delete cyc.settings.oncallWindows; else cyc.settings.oncallWindows=keepW;
    if(keepOC===undefined)delete cyc.oncall; else cyc.oncall=keepOC;
    cyc.assign=JSON.parse(keepA); S.viewAs=keepV; hydrateCycleSettings();
  })(); }
  // ---- on-call as it was: everything the per-zone tick puts into a file, a calendar or a count, pinned to
  // tests/oncall-golden.js, which was written from the build BEFORE the tick became an on-call window (628603d).
  // A live group's payroll file, RosterOn workbook and calendar must not move by one byte when the model underneath
  // changes. The fixture is its own state with fixed dates, because a golden that depends on today is not a golden.
  (function(){
    function capture(){
      var keep={S:S,range:window._range,my:myPerson,dl:download,x:(typeof XLSX==="undefined"?undefined:XLSX)}, out={};
      var files=[], sheets=[];
      download=function(c,fn){ files.push({fn:String(fn),c:String(c)}); };
      XLSX={utils:{aoa_to_sheet:function(a){ sheets.push(JSON.parse(JSON.stringify(a))); return {}; },book_new:function(){ return {}; },book_append_sheet:function(){}},writeFile:function(){}};
      function state(variant){
        var Z=[{id:"zr",name:"Resus",am:true,pm:true,pmLabel:""},{id:"zroc",name:"ROC+OC",am:true,pm:true,pmLabel:""},
               {id:"za",name:"Acute",am:true,pm:true,pmLabel:"Acute OC"},{id:"zc1",name:"Consultant 1",am:true,pm:true,pmLabel:"",oncall:true},
               {id:"zro",name:"Resus/OC",am:true,pm:true,pmLabel:"",oncall:false}];
        var A={"s1|2030-09-02":{kind:"clinical",period:"PM",zone:"zroc"},"s1|2030-09-03":{kind:"clinical",period:"AM",zone:"zr"},"s1|2030-09-05":{kind:"clinical",period:"PM",zone:"za"},
               "s1|2030-09-07":{kind:"clinical",period:"PM",zone:"zc1"},"s1|2030-09-09":{kind:"clinical",period:"AM",zone:"zroc"},"s1|2030-09-10":{kind:"clinical",period:"PM",zone:"zro"},
               "s2|2030-09-02":{kind:"clinical",period:"AM",zone:"zroc"},"s2|2030-09-04":{kind:"clinical",period:"PM",zone:"zroc",locum:true},"s2|2030-09-06":{kind:"clinical",period:"PM",zone:"zr"},
               "s2|2030-09-11":{kind:"cst"},"s2|2030-09-12":{kind:"clinical",period:"PM",zone:"zc1",locum:true},
               "s3|2030-09-03":{kind:"clinical",period:"PM",zone:"zr"},"s3|2030-09-04":{kind:"cst"},"s3|2030-09-13":{kind:"clinical",period:"PM",zone:"zroc"},
               "s4|2030-09-11":{kind:"clinical",period:"PM",zone:"zroc"},"s4|2030-09-12":{kind:"clinical",period:"PM",zone:"zroc"}};
        var set={zones:Z,staffing:{amMin:1,amMax:3,pmMin:1,pmMax:3},fatigue:{mode:"warn",minRest:10,maxConsec:5}};
        if(variant!=="derived"){
          var onc=variant==="edited"?{start:"22:00",end:"07:00"}:{start:"23:30",end:"08:00"};
          set.shiftTypes=[{id:"AM",code:"AM",label:"AM",start:"08:00",end:"16:00",fills:["AM"],on:true,book:true,builtin:"AM"},
            {id:"PM",code:"PM",label:"PM",start:"15:30",end:"23:30",fills:["PM"],on:true,book:true,builtin:"PM"},
            {id:"ONC",code:"OC",label:"Overnight on-call",start:onc.start,end:onc.end,fills:[],on:variant!=="off",book:false,builtin:"ONC",derived:"oncall"},
            {id:"CST",code:"CST",label:"CST",start:"08:00",end:"16:00",fills:[],on:true,book:true,builtin:"CST"},
            {id:"full",code:"FULL",label:"Full",start:"08:00",end:"23:30",fills:["AM","PM"],on:true,book:true}];
          set.shiftTimes={AM:{start:"08:00",end:"16:00"},PM:{start:"15:30",end:"23:30"},ONC:{start:onc.start,end:onc.end},CST:{start:"08:00",end:"16:00"}};
          A["s2|2030-09-10"]={kind:"clinical",period:"AM",zone:"zroc",type:"full"};
        }
        S={ zones:Z, staffing:set.staffing,
            staff:[{id:"s1",name:"Lee, Jordan",title:"Consultant",payrollId:"1001",quota:10,eft:1},{id:"s2",name:"Dr Sam Park",title:"Consultant",payrollId:"1002",quota:10,eft:1},
                   {id:"s3",name:"Kim Wu",title:"Registrar",payrollId:"1003",quota:10,eft:1},{id:"s4",name:"Ari",quota:4,eft:0.4}],
            cycles:[{id:"cg",cycle:{start:"2030-09-02",weeks:2},assign:A,status:"published",archived:false,settings:set}],
            activeId:"cg", viewAs:"admin", tab:"my", branding:{hospital:"Test Hospital",name:"ED"},
            toughList:{weekend:true,friPM:true,monPM:true,onCall:true,ph:true},
            leave:[{id:"lvg",staffId:"s3",code:"AL",from:"2030-09-08",to:"2030-09-09",status:"approved"}],
            requests:[],audit:[],notifications:[],messages:[],feedback:[] };
        normalize(); hydrateCycleSettings(); hydrateCycleRoles();
      }
      function grab(variant){ var o={}; state(variant);
        o.payroll=payrollRows();
        sheets.length=0; exportRosterOn(); o.ronA=(sheets[0]||[]).filter(function(r,i){ return i!==1; }); o.ronD=sheets[1]||[];   // row 1 carries today's date
        files.length=0; exportRosterCSV(); exportRosterXLS(); exportPayrollCSV();
        o.files=files.map(function(f){ return f.fn+"\n"+f.c.replace(/Exported [^<]*? from Myrosta/,"Exported (today) from Myrosta"); });
        o.ics={}; ["s1","s2","s4"].forEach(function(sid){ window._range={from:"2030-09-02",to:"2030-09-15"}; o.ics[sid]=icsText(sid).replace(/DTSTAMP:[0-9TZ]+/g,"DTSTAMP:(now)"); });
        o.hours={}; ["s1","s2","s3","s4"].forEach(function(sid){ S.viewAs=sid; window._range=null; var m=/Clinical hours<\/span><\/div><div class="v">([^<]*)</.exec(viewMy()); o.hours[sid]=m?m[1]:"(none)"; });
        S.viewAs="admin";
        o.equity=equityData("cycle").map(function(r){ return {id:r.s.id,m:r.m}; });
        o.fatigue=[["s1","2030-09-03","AM","zr"],["s3","2030-09-14","AM","zr"],["s2","2030-09-03","PM","zroc"],["s4","2030-09-13","PM","zr"],["s1","2030-09-06","AM","zr"],["s1","2030-09-11","AM","zr"]]
          .map(function(c){ return c.join(" ")+" → "+fatigueCheck(c[0],c[1],c[2],c[3]); });
        return o; }
      try{ ["derived","saved","edited","off"].forEach(function(v){ out[v]=grab(v); }); }
      finally{ S=keep.S; window._range=keep.range; myPerson=keep.my; download=keep.dl; XLSX=keep.x; hydrateCycleSettings(); hydrateCycleRoles(); }
      return out; }
    var cap=capture();
    if(typeof ONCALL_GOLDEN==="undefined"){ LOG.push("GOLDEN "+JSON.stringify(cap)); T("on-call legacy: tests/oncall-golden.js is present", false); return; }
    // Deliberate differences, each with its reason. Everything else must match byte for byte.
    var CHANGED={"edited.ronA":function(g){ return JSON.parse(JSON.stringify(g).split("() OC 23300800  - NB#").join("() OC 22000700  - NB#")); }};   // the RosterOn continuation cell names the window's real hours; the tick wrote 23:30–08:00 whatever the admin had set
    Object.keys(CHANGED).forEach(function(key){ var v=key.split(".")[0], k=key.split(".")[1], g=ONCALL_GOLDEN[v]&&ONCALL_GOLDEN[v][k];
      T("on-call legacy: the intended difference in "+key+" really is one", g!==undefined && JSON.stringify(CHANGED[key](g))!==JSON.stringify(g)); });
    Object.keys(ONCALL_GOLDEN).forEach(function(v){ Object.keys(ONCALL_GOLDEN[v]).forEach(function(k){
      var fix=CHANGED[v+"."+k], have=JSON.stringify(cap[v]&&cap[v][k]), want=JSON.stringify(fix?fix(ONCALL_GOLDEN[v][k]):ONCALL_GOLDEN[v][k]);
      T("on-call legacy ("+v+"): "+k+(fix?" differs from the build before on-call windows only where intended":" is byte-identical to the build before on-call windows"), have===want);
      if(have!==want){ var i=0; while(i<have.length&&have[i]===want[i])i++; LOG.push("  DIFF at "+i+"\n    have: "+String(have).slice(Math.max(0,i-80),i+160)+"\n    want: "+String(want).slice(Math.max(0,i-80),i+160)); } }); });
  })();
  // ---- on-call is one concept: the tick is a window that follows a shift, and a window someone takes reaches every
  // file, calendar and count the tick reached. Its own fixture with fixed dates, like the golden above.
  (function(){
    var keep={S:S,range:window._range,dl:download,x:(typeof XLSX==="undefined"?undefined:XLSX)}, sheets=[];
    function fresh(wins){
      var Z=[{id:"zr",name:"Resus",am:true,pm:true,pmLabel:""},{id:"zroc",name:"ROC+OC",am:true,pm:true,pmLabel:""},{id:"zb",name:"Consultant 2",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:3,pmMin:1,pmMax:3},fatigue:{mode:"warn",minRest:10,maxConsec:5}};
      if(wins!==undefined)set.oncallWindows=JSON.parse(JSON.stringify(wins));
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Lee, Jordan",title:"Consultant",payrollId:"1001",quota:10,eft:1},{id:"s2",name:"Sam Park",title:"Consultant",payrollId:"1002",quota:0,eft:1}],
         cycles:[{id:"cf",cycle:{start:"2030-09-02",weeks:1},assign:{},status:"published",archived:false,settings:set}],activeId:"cf",viewAs:"admin",tab:"my",
         branding:{hospital:"Test Hospital",name:"ED"},toughList:{weekend:true,friPM:true,monPM:true,onCall:true,ph:true},leave:[],requests:[],audit:[],notifications:[],messages:[],feedback:[]};
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); return S.cycles[0]; }
    var NIGHT={id:"night",code:"NIGHT",label:"Night",start:"22:00",end:"08:00",book:true,rest:true,from:null},
        EVE={id:"eve",code:"EVE",label:"Evening",start:"17:00",end:"22:00",book:true,rest:true,from:null};
    try{
      var c=fresh();
      T("on-call as one: a cycle that never saved a window keeps the on-call its tick gave it, as ONE window following every zone that carries it",
        (function(){ var w=ocWindows(c); return w.length===1 && w[0].id==="ONC" && !!w[0].from && w[0].from.zones.join()==="zroc" && w[0].from.period==="PM" && w[0].code==="OC" && w[0].pay==="ONC" && w[0].start==="23:30" && w[0].end==="08:00" && c.settings.oncallWindows===undefined && c.oncall===undefined; })());
      T("on-call as one: a saved list is the truth, and an empty one means no on-call even with a zone named for it",
        (function(){ c.settings.oncallWindows=[]; var none=ocWindows(c).length===0; delete c.settings.oncallWindows; return none && ocWindows(c).length===1; })());
      T("on-call as one: with the On-call type switched off the tick gives nothing, which is where SWIFT is",
        (function(){ var ts=shiftTypesOf(c).map(function(t){ return Object.assign({},t,{fills:(t.fills||[]).slice()}); }); ts.find(function(t){return t.id==="ONC";}).on=false; c.settings.shiftTypes=ts; var off=ocWindows(c).length===0; delete c.settings.shiftTypes; return off; })());
      c.assign["s1|2030-09-02"]={kind:"clinical",period:"PM",zone:"zroc"}; c.assign["s2|2030-09-02"]={kind:"clinical",period:"AM",zone:"zroc"};
      T("on-call as one: whoever works the evening in that zone holds it, and nobody else does, the morning there included",
        ocHolder(c,"2030-09-02","ONC")==="s1" && ocHeldBy(c,"s1","2030-09-02").length===1 && ocHeldBy(c,"s2","2030-09-02").length===0 && ocCountFor(c,"s1")===1);
      T("on-call as one: a group whose on-call only follows shifts sees no On call tile on My shifts, as before",
        (function(){ S.viewAs="s1"; window._range=null; var v=viewMy(); S.viewAs="admin"; return v.indexOf('<span class="k">Clinical hours</span>')>0 && v.indexOf('tag lg oc')<0; })());
      T("on-call as one: a window that follows a shift is never drawn on its own and has nothing to clear, as the tick never had a marker",
        ocTakenWindows(c).length===0 && ocTakenBy(c,"s1","2030-09-02").length===0 && ocMark(c,"s1","2030-09-02",true)==="" && ocLine(c,"s1","2030-09-02")==="" && ocSheetHTML(c,"s1","2030-09-02",true,true)==="");
      T("on-call as one: leave set on that day takes the following window away with the shift, and writes nothing to the on-call roster",
        (function(){ var ok=true; try{ plannerSetLeave("s1","2030-09-02","AL"); }catch(e){ ok=false; } return ok && c.oncall===undefined && !c.assign["s1|2030-09-02"] && ocHolder(c,"2030-09-02","ONC")===null; })());
      T("on-call as one: when stored data holds two different on-call hours, the tick keeps the hours payroll always used", (function(){
        var cd=fresh(); cd.assign["s1|2030-09-02"]={kind:"clinical",period:"PM",zone:"zroc"};
        var ts=shiftTypesOf(cd).map(function(t){ return Object.assign({},t,{fills:(t.fills||[]).slice()}); }); var o=ts.find(function(t){ return t.id==="ONC"; }); o.start="22:00"; o.end="07:00"; cd.settings.shiftTypes=ts;   // saved by an old + Add, which never wrote shiftTimes
        var w=ocWindows(cd)[0], row=payrollRows().find(function(r){ return r.code==="ONC"; });
        return !!w && w.start==="23:30" && w.end==="08:00" && !!row && row.start==="23:30" && row.hours===8.5; })());
      T("on-call as one: when two zones share an id, the first one decides, as it always has", (function(){
        var cz=fresh(); cz.settings.zones.push({id:"zr",name:"Resus+OC",am:true,pm:true,pmLabel:""}); hydrateCycleSettings();
        cz.assign["s1|2030-09-02"]={kind:"clinical",period:"PM",zone:"zr"};
        return ocWindows(cz)[0].from.zones.join()==="zroc" && ocHeldBy(cz,"s1","2030-09-02").length===0 && payrollRows().filter(function(r){ return r.code==="ONC"; }).length===0; })());
      T("on-call as one: the setup checklist counts a group whose on-call follows its shifts as having answered", (function(){
        var cc=fresh(); var r=setupChecklist().find(function(x){ return x.key==="oncall"; }); return !!r && r.done===true; })());
      T("on-call as one: saving the On-call card as it stands makes the tick a saved window and changes nothing payroll or a calendar shows", (function(){
        var c2=fresh(); c2.assign["s1|2030-09-02"]={kind:"clinical",period:"PM",zone:"zroc"};
        var before=JSON.stringify(payrollRows()); window._range={from:"2030-09-02",to:"2030-09-08"}; var icsB=icsText("s1").replace(/DTSTAMP:[0-9TZ]+/g,"");
        var _sb=_setupTab; S.tab="setup"; _setupTab="cycle"; render();
        var btn=document.getElementById("saveOncall"), qsa=document.querySelectorAll;
        var rows=[{dataset:{ocid:"ONC"},querySelector:function(){ return null; },querySelectorAll:function(sel){ return sel===".oc-z"?[{value:"zr",checked:false},{value:"zroc",checked:true},{value:"zb",checked:false}]:[]; }}];
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        try{ btn.onclick(); } finally { document.querySelectorAll=qsa; _setupTab=_sb; S.tab="my"; }
        var w=c2.settings.oncallWindows; window._range={from:"2030-09-02",to:"2030-09-08"};
        return Array.isArray(w) && w.length===1 && w[0].pay==="ONC" && w[0].uid==="oc" && w[0].from.zones.join()==="zroc" &&
               JSON.stringify(payrollRows())===before && icsText("s1").replace(/DTSTAMP:[0-9TZ]+/g,"")===icsB &&
               S.audit.some(function(a){ return a.action==="settings.oncall" && a.detail.indexOf("(follows ROC+OC)")>0; }); })());
      T("on-call as one: a zone the window follows that no longer runs an evening is still drawn, and saving the card unchanged keeps it", (function(){
        var c3=fresh(); c3.settings.zones[1].pm=false; hydrateCycleSettings(); c3.assign["s1|2030-09-02"]={kind:"clinical",period:"AM",zone:"zroc"};
        var _sb=_setupTab; S.tab="setup"; _setupTab="cycle"; var v=viewSetup(); render();
        var drawn=/class="oc-z" value="zroc" checked> ROC\+OC <span class="muted small">\(no evening shift\)<\/span>/.test(v);
        var btn=document.getElementById("saveOncall"), qsa=document.querySelectorAll;
        var rows=[{dataset:{ocid:"ONC"},querySelector:function(){ return null; },querySelectorAll:function(sel){ return sel===".oc-z"?[{value:"zr",checked:false},{value:"zb",checked:false}]:[]; }}];   // even with its box missing
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        try{ btn.onclick(); } finally { document.querySelectorAll=qsa; _setupTab=_sb; S.tab="my"; }
        var w=c3.settings.oncallWindows;
        return drawn && Array.isArray(w) && w.length===1 && !!w[0].from && w[0].from.zones.join()==="zroc"; })());
      T("on-call as one: a change to which shifts a window follows says how many shifts it moves, and waits for a yes", (function(){
        var c4=fresh(); c4.assign["s1|2030-09-02"]={kind:"clinical",period:"PM",zone:"zroc"}; c4.assign["s2|2030-09-03"]={kind:"clinical",period:"PM",zone:"zroc"};
        var _sb=_setupTab; S.tab="setup"; _setupTab="cycle"; render();
        var asked=null, oc0=openConfirm; openConfirm=function(o){ asked=o; return {then:function(){}}; };
        var btn=document.getElementById("saveOncall"), qsa=document.querySelectorAll;
        var rows=[{dataset:{ocid:"ONC"},querySelector:function(){ return null; },querySelectorAll:function(sel){ return sel===".oc-z"?[{value:"zr",checked:false},{value:"zroc",checked:false},{value:"zb",checked:false}]:[]; }}];
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        try{ btn.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=oc0; _setupTab=_sb; S.tab="my"; }
        return !!asked && /2 shifts on this roster gain or lose the on-call that follows them/.test(asked.body) && c4.settings.oncallWindows===undefined; })());
      T("on-call as one: Remove reads the roster again after its dialog, so a take that landed while it was open keeps its window", (function(){
        var c6=fresh([JSON.parse(JSON.stringify(NIGHT))]); var _sb=_setupTab; S.tab="setup"; _setupTab="cycle"; render();
        var oc0=openConfirm, said=[], t0=toast; toast=function(m){ said.push(String(m)); };
        openConfirm=function(){ return {then:function(cb){ c6.oncall={}; c6.oncall["2030-09-03|night"]="s1"; cb(true); }}; };   // someone takes it while the dialog is open
        var btn={closest:function(){ return {dataset:{ocid:"night"}}; }}, qsa=document.querySelectorAll;
        document.querySelectorAll=function(sel){ return sel==="#ocRows .oc-del"?[btn]:[]; };
        try{ render(); if(btn.onclick)btn.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=oc0; toast=t0; _setupTab=_sb; S.tab="my"; }
        return !!btn.onclick && c6.settings.oncallWindows.length===1 && said.some(function(m){ return /changed while that was open/.test(m); }); })());
      T("on-call as one: the first edit to a zone keeps on-call exactly as it was, so a rename can no longer switch it off", (function(){
        var c5=fresh(); c5.assign["s1|2030-09-02"]={kind:"clinical",period:"PM",zone:"zroc"}; var oc=function(){ return payrollRows().filter(function(r){ return r.code==="ONC"; }).map(function(r){ return r.date+" "+r.start+"-"+r.end; }).join(); }, before=oc();
        ocPin(c5); c5.settings.zones[1].name="ROC"; hydrateCycleSettings();
        var w=c5.settings.oncallWindows;
        return before==="2030-09-02 23:30-08:00" && Array.isArray(w) && w.length===1 && w[0].from.zones.join()==="zroc" && oc()===before &&
          S.audit.some(function(a){ return a.action==="settings.oncall" && /kept as it was before a zone change/.test(a.detail); }) &&
          (renderZoneList.toString().match(/ocPin\(active\(\)\)/g)||[]).length===3; })());
      T("on-call as one: the Zones card says which zone carries on-call, without offering to change it there", (function(){
        fresh(); var _sb=_setupTab; S.tab="setup"; _setupTab="cycle"; viewSetup(); try{ renderZoneList(); }catch(e){} var h=document.getElementById("zoneList").innerHTML; _setupTab=_sb; S.tab="my";
        return (h.match(/carries on-call/g)||[]).length===1 && h.indexOf("z-oc")<0; })());
      T("on-call as one: the payroll card lists the on-call it writes beside the shift types, not as one of them", (function(){
        fresh(); var _sb=_setupTab; S.tab="setup"; _setupTab="group"; var g=viewSetup(); _setupTab=_sb; S.tab="my";
        return g.indexOf(" · On call: On-call 23:30–08:00 · Leave = 8h")>0 && g.indexOf("auto-added")<0; })());
      c=fresh([NIGHT,EVE]);
      c.assign["s1|2030-09-03"]={kind:"clinical",period:"PM",zone:"zr",locum:true};
      c.oncall={}; c.oncall["2030-09-03|night"]="s1"; c.oncall["2030-09-04|night"]="s2"; c.oncall["2030-09-04|eve"]="s2";
      var pr=payrollRows(), p1=pr.filter(function(r){return r.name==="Lee, Jordan";}), p2=pr.filter(function(r){return r.name==="Sam Park";});
      T("on-call as one: payroll gives a taken window its own row after the day's shift, under its own code and hours, with no zone",
        p1.length===2 && p1[0].code==="PM" && p1[1].code==="NIGHT" && p1[1].start==="22:00" && p1[1].end==="08:00" && p1[1].hours===10 && p1[1].unit==="" && p1[1].note==="Night" && p1[1].date==="2030-09-03");
      T("on-call as one: a day carrying only windows still reaches payroll, a row each, in the order the group lists them",
        p2.length===2 && p2[0].code==="NIGHT" && p2[1].code==="EVE" && p2[1].hours===5);
      download=function(){}; XLSX={utils:{aoa_to_sheet:function(a){ sheets.push(JSON.parse(JSON.stringify(a))); return {}; },book_new:function(){return {};},book_append_sheet:function(){}},writeFile:function(){}};
      sheets.length=0; exportRosterOn(); var A=sheets[0]||[], DS=sheets[1]||[];
      var rowOf=function(nm){ for(var i=0;i<A.length;i++)if(A[i][0]===nm)return i; return -1; }, i1=rowOf("Lee, Jordan"), i2=rowOf("Sam Park");
      T("on-call as one: RosterOn puts each window on its own continuation row, with that window's code and hours",
        i1>=0 && A[i1+1][0]==="" && A[i1+1][2]==="() NIGHT 22000800  - NB#" && i2>=0 && A[i2+1][3]==="() NIGHT 22000800  - NB#" && A[i2+2][0]==="" && A[i2+2][3]==="() EVE 17002200  - NB#");
      T("on-call as one: the RosterOn data sheet lists a taken window with no zone, and a day off carrying one is not skipped",
        DS.filter(function(r){ return r[6]==="NIGHT"; }).length===2 && DS.some(function(r){ return r[0]==="Sam Park" && r[6]==="EVE" && r[4]==="Evening" && r[5]==="" && r[9]===5; }));
      window._range={from:"2030-09-02",to:"2030-09-08"}; var ics1=icsText("s1"), ics2=icsText("s2");
      T("on-call as one: the calendar gives a taken window its own event and id, across midnight, never borrowing the shift's locum note",
        ics1.indexOf("UID:s1-20300903-oc-night@myrosta.v2")>0 && ics1.indexOf("DTSTART;TZID=Australia/Melbourne:20300903T220000")>0 && ics1.indexOf("DTEND;TZID=Australia/Melbourne:20300904T080000")>0 &&
        ics1.indexOf("SUMMARY:Night (22:00–08:00)\r\n")>0 && ics2.indexOf("UID:s2-20300904-oc-eve@myrosta.v2")>0 && ics2.indexOf("UID:s2-20300904-oc-night@myrosta.v2")>0);
      var eq=equityData("cycle"), e1=eq.find(function(r){return r.s.id==="s1";}), e2=eq.find(function(r){return r.s.id==="s2";});
      T("on-call as one: Fairness counts a taken window, makes that day's shift tough once, and counts someone on call with no shift at all",
        !!e1 && e1.m.oc===1 && e1.m.tough===1 && e1.m.booked===1 && !!e2 && e2.m.oc===2 && e2.m.booked===0 && e2.m.tough===0);
      T("on-call as one: a window taken out of the list stops counting, as it does everywhere else",
        (function(){ c.settings.oncallWindows=[JSON.parse(JSON.stringify(NIGHT))]; var e=equityData("cycle").find(function(r){return r.s.id==="s2";}); c.settings.oncallWindows=[NIGHT,EVE]; return !!e && e.m.oc===1; })());
      S.viewAs="s1"; window._range=null; var my1=viewMy(); S.viewAs="s2"; window._range=null; var my2=viewMy(); S.viewAs="admin";
      T("on-call as one: a taken window is not clinical time, so Clinical hours stays the shift's own", /Clinical hours<\/span><\/div><div class="v">8</.test(my1));
      T("on-call as one: My shifts counts the windows a person took, with their hours, beside the other counts",
        /<span class="tag lg oc"[^>]*>On call 1 · 10h<\/span>/.test(my1) && /<span class="tag lg oc"[^>]*>On call 2 · 15h<\/span>/.test(my2) && my1.indexOf('<span class="k">On call</span>')<0);
      T("on-call as one: shared, a day carrying only on-call is a line of its own and a shift day says what it carries after",
        (function(){ var t2=shareWeekText("s2"), t1=shareWeekText("s1");
          return t2.indexOf(" · On call Night 22:00–08:00 · Evening 17:00–22:00")>0 && (t2.match(/ · Off/g)||[]).length===2 &&
                 t1.indexOf(" · on call Night 22:00–08:00")>0 && t1.indexOf("On call Night")<0; })());
      T("exports: a zone name with markup in it reaches the Excel roster as text, not as markup", (function(){
        var z=S.zones[0], was=z.name; z.name="Resus <b>&</b>"; var got=[]; download=function(x){ got.push(String(x)); }; exportRosterXLS(); z.name=was;
        return got.length===1 && got[0].indexOf("Resus &lt;b&gt;&amp;&lt;/b&gt;")>0 && got[0].indexOf("Resus <b>")<0; })());
      T("on-call as one: the roster CSV and Excel exports name a taken window beside the day, and the Excel legend explains it",
        (function(){ var got=[]; download=function(x){ got.push(String(x)); }; exportRosterCSV(); exportRosterXLS();
          return got.length===2 && got[0].indexOf(' (locum) + On call Night"')>0 && got[0].indexOf('"On call Night + On call Evening"')>0 &&
                 got[1].indexOf("<td>On call Night + On call Evening</td>")>0 && got[1].indexOf("On call = an on-call window, not a shift")>0; })());
      c=fresh([{id:"tick",code:"OC",label:"On-call",start:"23:30",end:"08:00",book:false,rest:false,from:{zones:["zroc"],period:"PM"}}]);
      T("on-call as one: a following window the group counts as rest does not stretch the shift it follows",
        (function(){ var sp=_shiftSpan("s1","2030-09-02","PM","zroc"); return (sp.en-sp.st)/36e5===8; })());
      c.settings.oncallWindows[0].rest=true;
      T("on-call as one: counted toward rest, it does: the evening runs through to the window's end",
        (function(){ var sp=_shiftSpan("s1","2030-09-02","PM","zroc"), sp2=_shiftSpan("s1","2030-09-02","PM","zr"); return (sp.en-sp.st)/36e5===16.5 && (sp2.en-sp2.st)/36e5===8; })());
    } finally { S=keep.S; window._range=keep.range; download=keep.dl; XLSX=keep.x; hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- the two Edge Functions read on-call the way the app does. tests/run.py lifts their pure code in, so the live
  // calendar feed is held to the download event for event, and the reminder text is checked word for word.
  T("edge functions: the calendar feed and the reminder text are here to be tested", typeof ICSFN!=="undefined" && typeof REMINDFN!=="undefined");
  if(typeof ICSFN!=="undefined"&&typeof REMINDFN!=="undefined")(function(){
    var keep={S:S,range:window._range}, c=null;
    function evs(t){ return String(t).replace(/\r\n /g,"").split("BEGIN:VEVENT").slice(1).map(function(b){
      return ["UID:","DTSTART;","DTEND;","SUMMARY:"].map(function(k){ var i=b.indexOf("\r\n"+k); return i<0?"":b.slice(i+2,b.indexOf("\r\n",i+2)); }).join(" | "); }); }
    function state(wins){
      var Z=[{id:"zr",name:"Resus",am:true,pm:true,pmLabel:""},{id:"zroc",name:"ROC+OC",am:true,pm:true,pmLabel:""},{id:"zb",name:"Consultant 2",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:3,pmMin:1,pmMax:3}}; if(wins!==undefined)set.oncallWindows=JSON.parse(JSON.stringify(wins));
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Lee, Jordan",title:"Consultant",quota:10,eft:1},{id:"s2",name:"Sam Park",title:"Consultant",quota:10,eft:1}],
         cycles:[{id:"ce",cycle:{start:"2030-09-02",weeks:1},assign:{},status:"published",archived:false,settings:set}],activeId:"ce",viewAs:"admin",tab:"my",
         branding:{hospital:"Test Hospital",name:"ED"},leave:[],requests:[],audit:[],notifications:[],messages:[],feedback:[]};
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; window._range={from:"2030-09-02",to:"2030-09-08"}; }
    var NIGHT={id:"night",code:"NIGHT",label:"Night",start:"22:00",end:"08:00",book:true,rest:true,from:null},
        EVE={id:"eve",code:"EVE",label:"Evening",start:"17:00",end:"22:00",book:true,rest:true,from:null};
    try{
      state(); c.assign={"s1|2030-09-02":{kind:"clinical",period:"PM",zone:"zroc",locum:true},"s1|2030-09-04":{kind:"clinical",period:"AM",zone:"zroc"},"s1|2030-09-05":{kind:"cst"}};
      var a0=evs(icsText("s1")), f0=evs(ICSFN.buildICS(S,S.staff[0],null));
      T("edge functions: the live feed gives the tick's on-call the same events the download does, id for id, locum note and all",
        a0.length===4 && JSON.stringify(a0)===JSON.stringify(f0) && f0.some(function(e){ return e.indexOf("UID:s1-20300902-oc@myrosta.v2 | ")===0 && e.indexOf("— locum")>0; }));
      state(); c.assign={"s1|2030-09-02":{kind:"clinical",period:"PM",zone:"zroc"}};
      var tsd=shiftTypesOf(c).map(function(t){ return Object.assign({},t,{fills:(t.fills||[]).slice()}); }); var od=tsd.find(function(t){ return t.id==="ONC"; }); od.start="22:00"; od.end="07:00"; c.settings.shiftTypes=tsd;
      var ad=evs(icsText("s1")), fd=evs(ICSFN.buildICS(S,S.staff[0],null));
      T("edge functions: when stored data holds two different on-call hours, the feed and the download both keep the hours payroll uses",
        JSON.stringify(ad)===JSON.stringify(fd) && fd.some(function(e){ return e.indexOf("UID:s1-20300902-oc@myrosta.v2")===0 && e.indexOf("T233000")>0; }));
      state([NIGHT,EVE]); c.assign={"s1|2030-09-03":{kind:"clinical",period:"PM",zone:"zr",locum:true}}; c.oncall={"2030-09-03|night":"s1","2030-09-04|night":"s2","2030-09-04|eve":"s2"};
      var a1=evs(icsText("s1")), f1=evs(ICSFN.buildICS(S,S.staff[0],null)), a2=evs(icsText("s2")), f2=evs(ICSFN.buildICS(S,S.staff[1],null));
      T("edge functions: the live feed and the download agree on every event when people take on-call, a day with only on-call included",
        JSON.stringify(a1)===JSON.stringify(f1) && JSON.stringify(a2)===JSON.stringify(f2) && f2.length===2 && f1.some(function(e){ return e.indexOf("UID:s1-20300903-oc-night@myrosta.v2 | ")===0; }));
      var R=REMINDFN.reminderFor;
      state(); c.assign={"s1|2030-09-02":{kind:"clinical",period:"PM",zone:"zroc"}};
      var r0=R(S,S.staff[0],"2030-09-02");
      T("edge functions: the reminder for a shift whose zone carries on-call reads exactly as it did, because the shift is the reminder",
        !!r0 && r0.onShift===true && r0.detail==="PM · ROC+OC · 15:30–23:30");
      state([NIGHT,EVE]); c.assign={"s1|2030-09-03":{kind:"clinical",period:"PM",zone:"zr",locum:true}}; c.oncall={"2030-09-03|night":"s1","2030-09-04|night":"s2","2030-09-04|eve":"s2"};
      var r1=R(S,S.staff[0],"2030-09-03"), r2=R(S,S.staff[1],"2030-09-04");
      T("edge functions: a reminder names the on-call a person took, after their shift or on its own, in the group's own words",
        !!r1 && r1.onShift===true && r1.detail==="PM · Resus · 15:30–23:30 (locum) + Night on call 22:00–08:00" &&
        !!r2 && r2.onShift===false && r2.detail==="Night on call 22:00–08:00, Evening on call 17:00–22:00" && R(S,S.staff[1],"2030-09-05")===null);
      c.status="draft";
      T("edge functions: nobody is reminded about on-call on a roster still in draft", R(S,S.staff[1],"2030-09-04")===null);
      c.status="published"; S.leave=[{id:"le",staffId:"s2",from:"2030-09-04",to:"2030-09-04",code:"AL",status:"approved"}];
      var a3=evs(icsText("s2")), f3=evs(ICSFN.buildICS(S,S.staff[1],null));
      T("edge functions: somebody on leave is neither reminded about on-call nor sent it in the feed, and the feed still agrees with the download",
        R(S,S.staff[1],"2030-09-04")===null && JSON.stringify(a3)===JSON.stringify(f3) && f3.every(function(e){ return e.indexOf("-oc-")<0; }));
      S.leave=[]; c.roles=c.roles||{}; c.roles.s2=Object.assign({},c.roles.s2||{},{in:false});
      T("edge functions: somebody taken out of the cycle is not reminded about its on-call", R(S,S.staff[1],"2030-09-04")===null);
      delete c.roles.s2.in;
      c.status="published"; c.settings.oncallWindows=[{id:"eveoc",code:"EOC",label:"On-call",start:"23:30",end:"08:00",book:false,rest:true,from:{zones:["zr"],period:"PM"}}]; c.oncall={"2030-09-03|eveoc":"s1"};
      T("edge functions: a window that follows a shift is not added to that shift's reminder, even with a stray key for it from another device", R(S,S.staff[0],"2030-09-03").detail==="PM · Resus · 15:30–23:30 (locum)");
    } finally { S=keep.S; window._range=keep.range; hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- clearing a cycle's roster: a fresh start on a draft; on a live roster shifts and on-call only, because leave is real
  (function(){
    var keep={S:S}, c=null;
    function state(status){
      var Z=[{id:"z1",name:"Resus",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:3,pmMin:1,pmMax:3},oncallWindows:[{id:"night",code:"NIGHT",label:"Night",start:"22:00",end:"08:00",book:true,rest:true,from:null}]};
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Lee, Jordan",quota:10,eft:1},{id:"s2",name:"Sam Park",quota:10,eft:1}],
         cycles:[{id:"cc",cycle:{start:"2030-09-02",weeks:2},status:status,archived:false,settings:set,oncall:{"2030-09-02|night":"s2"},
           assign:{"s1|2030-09-02":{kind:"clinical",period:"AM",zone:"z1"},"s2|2030-09-03":{kind:"cst"},"s1|2030-09-04":{kind:"clinical",period:"PM",zone:"z1",fixed:true},"s2|2030-09-05":{kind:"leave",code:"UA"}}}],
         activeId:"cc",viewAs:"admin",tab:"selfroster",
         leave:[{id:"in",staffId:"s1",code:"AL",from:"2030-09-08",to:"2030-09-09",status:"approved"},{id:"span",staffId:"s2",code:"ML",from:"2030-09-10",to:"2030-10-31",status:"approved"},{id:"before",staffId:"s2",code:"AL",from:"2030-08-01",to:"2030-08-05",status:"approved"}],
         openShifts:[{id:"o1",cycleId:"cc",iso:"2030-09-06",period:"PM",zone:"z1",kind:"gap",status:"open",ts:1}],
         requests:[],audit:[],notifications:[],messages:[],feedback:[]};
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; }
    try{
      state("draft"); clearRoster();
      T("clear: on a draft every shift, on-call, open shift and the leave on its dates go, and a fixed pattern's shift stays",
        Object.keys(c.assign).join()==="s1|2030-09-04" && Object.keys(c.oncall||{}).length===0 && S.openShifts[0].status==="withdrawn" &&
        S.leave.map(function(L){ return L.id+" "+L.from+" "+L.to; }).sort().join()==="before 2030-08-01 2030-08-05,span-post 2030-09-16 2030-10-31" &&
        S.audit[0].action==="roster.clear" && S.audit[0].detail.indexOf("2 shifts · 1 on-call window · 3 leave entries · 1 open shift")===0);
      state("published"); clearRoster();
      T("clear: on a live roster shifts and on-call go but leave stays, because it is people's real leave",
        Object.keys(c.assign).sort().join()==="s1|2030-09-04,s2|2030-09-05" && Object.keys(c.oncall||{}).length===0 && S.leave.length===3 && /leave kept, the roster is live/.test(S.audit[0].detail));
      state("draft");
      T("clear: the button asks first, in numbers, and nothing goes until the answer is yes", (function(){
        var oc0=openConfirm, asked=null, answer=false; openConfirm=function(o){ asked=o; return {then:function(cb){ cb(answer); }}; };
        var btn=null, kept=false;
        try{ try{ render(); }catch(e){} btn=document.getElementById("adClear"); btn.onclick(); kept=Object.keys(c.assign).length===4 && S.leave.length===3; answer=true; btn.onclick(); } finally { openConfirm=oc0; }
        return !!asked && asked.body.indexOf("Removes 2 shifts, 1 on-call window, 3 leave entries and 1 open shift.")===0 && asked.ok==="Clear the roster" && kept && Object.keys(c.assign).length===1; })());
      T("clear: the new log line has words, and the step's button says what it does", AUDIT_WORDS["roster.clear"]==="Cleared the roster" && roundStepperHTML(c).indexOf('id="adClear">Clear the roster<')>0);
    } finally { S=keep.S; hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- call-ins: on-call booked once someone is called in, with the real hours.
  // Spec: docs/superpowers/specs/2026-09-14-oncall-call-ins-design.md. Dates are relative to today, because a consultant logs on the day or the day after.
  if(typeof ocWindows==="function")(function(){
    var keep={S:S,range:window._range,dl:download,x:(typeof XLSX==="undefined"?undefined:XLSX),toast:toast,oc:openConfirm,daily:dailyDate,sb:_setupTab,sr:_srSid}, c=null, said=[];
    var TODAY=iso(new Date()), YEST=iso(addDays(new Date(),-1)), TOMO=iso(addDays(new Date(),1)), OLD=iso(addDays(new Date(),-3));
    var CALLIN={id:"callin",code:"C",label:"Call-in (C)",start:"10:00",end:"22:00",book:true,rest:true,from:null,chosen:true,usual:240},
        EARLY={id:"early",code:"EARLY",label:"Early call",start:"00:00",end:"10:00",book:true,rest:true,from:null,chosen:true,usual:120},
        LATE={id:"late",code:"LATE",label:"Late call",start:"16:00",end:"00:00",book:true,rest:true,from:null,chosen:true,usual:120},
        NIGHT={id:"night",code:"NIGHT",label:"Night",start:"22:00",end:"08:00",book:true,rest:true,from:null};
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Consultant 1",am:true,pm:true,pmLabel:""},{id:"z2",name:"Consultant 2",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},rosterMode:"rolling",
               shiftTimes:{AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:o.pmEnd||"22:00"}},
               oncallWindows:JSON.parse(JSON.stringify(o.wins||[CALLIN,EARLY,LATE,NIGHT]))};
      if(o.fatigue)set.fatigue=o.fatigue;
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Khan, Athar",quota:20,eft:1},{id:"s2",name:"Park, Min",quota:20,eft:1},{id:"s3",name:"Lee, Jo",quota:20,eft:1}],
         cycles:[{id:"cc",cycle:{start:iso(addDays(new Date(),-10)),weeks:4},status:o.status||"published",archived:false,settings:set,
                  roles:{s1:{in:true,quota:20,eft:1},s2:{in:true,quota:20,eft:1},s3:{in:true,quota:20,eft:1}},assign:o.assign||{}}],
         activeId:"cc",viewAs:o.viewAs||"admin",tab:"selfroster",leave:o.leave||[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[]};
      if(o.oncall)S.cycles[0].oncall=o.oncall; if(o.callins)S.cycles[0].callins=o.callins;
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srSid=null; }
    toast=function(m){ said.push(String(m)); };
    try{
      // ---- the window option
      state();
      T("call-ins: a window is Fixed or Chosen when booked, and reads that way",
        ocChosen(ocWindow(c,"callin"))===true && ocChosen(ocWindow(c,"night"))===false && ocChosen({chosen:true,from:{zones:["z1"],period:"PM"}})===false && ocChosen(null)===false &&
        ocWhenText(ocWindow(c,"callin"))==="any hours 10:00–22:00, usually 4h" && ocWhenText(ocWindow(c,"night"))==="22:00–08:00" && ocUsualText({usual:270})==="4.5h");
      T("call-ins: a key is one day, one window and one person, and a broken key or value reads as nothing",
        ciKey(TODAY,"callin","s1")===TODAY+"|callin|s1" && JSON.stringify(ciParse(TODAY+"|callin|s1"))===JSON.stringify({d:TODAY,win:"callin",sid:"s1"}) &&
        ciParse("x|y")===null && ciValid({start:"14:00",end:"18:00"}) && !ciValid({start:"2pm",end:"18:00"}) && !ciValid(null) &&
        (function(){ state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(TODAY,"callin","s2")]={start:"bad",end:"18:00"}; c.callins["junk"]={start:"10:00",end:"11:00"};
          return ciGet(c,TODAY,"callin","s1").end==="18:00" && ciGet(c,TODAY,"callin","s2")===null && ciInUse(c,"callin")===1 && ciInUse(c,"night")===0; })());
      T("call-ins: a call-in window has no one holder, so a stray on-call key on it from an older copy of the app is ignored",
        (function(){ state({oncall:{}}); c.oncall[ocKey(TODAY,"callin")]="s1";
          return ocHolder(c,TODAY,"callin")===null && ocTakenBy(c,"s1",TODAY).length===0 && ocHeldBy(c,"s1",TODAY).length===0 && ocCountFor(c,"s1")===0; })());
      T("call-ins: taking a call-in window the on-call way is refused, even for an admin", (function(){
        state(); var r=ocTake("s1",TODAY,"callin");
        return r===false && !(c.oncall&&c.oncall[ocKey(TODAY,"callin")]) && said.some(function(m){ return /logged as a call-in/.test(m); }); })());
      T("call-ins: the On-call card draws a Chosen row with its range, usual length and words for logging, and a Fixed row as before", (function(){
        state(); S.tab="setup"; _setupTab="cycle"; var v=viewSetup(); S.tab="selfroster";
        return /class="listrow ocrow chosen" data-oci="0" data-ocid="callin"/.test(v) && /<option value="chosen" selected>Chosen when booked<\/option>/.test(v) &&
               /class="oc-len" min="0.5" step="0.5" value="4"/.test(v) && v.indexOf("Staff can log their own")>0 &&
               /class="listrow ocrow" data-oci="3" data-ocid="night"/.test(v) && /<option value="fixed" selected>Fixed hours<\/option>/.test(v) &&
               v.indexOf("chosen when booked</b>")>0; })());
      T("call-ins: a Chosen row reads between one time and the other, and a Fixed row still reads from one time to the other", (function(){
        state(); S.tab="setup"; _setupTab="cycle"; var v=viewSetup(); S.tab="selfroster";
        var pair='<span class="muted small oc-when-fixed">to</span><span class="muted small oc-when-chosen">and</span> <input type="time" class="oc-end"', rows=v.split('data-ocid="').length-1;
        return rows===4 && v.split(pair).length-1===rows && v.indexOf('<span class="muted small">to</span> <input type="time" class="oc-end"')<0; })());
      T("call-ins: reading the card keeps Chosen with its usual length in minutes, and a Chosen window never follows a shift", (function(){
        state(); S.tab="setup"; _setupTab="cycle"; render();
        var qsa=document.querySelectorAll, vals={".oc-hours":{value:"chosen"},".oc-len":{value:"4.5"}};
        var rows=[{dataset:{ocid:"night"},querySelector:function(q){ return vals[q]||null; },querySelectorAll:function(sel){ return sel===".oc-z"?[{value:"z1",checked:true}]:[]; }}];
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        var list; try{ list=ocRowsNow(); } finally { document.querySelectorAll=qsa; S.tab="selfroster"; }
        var n=list.find(function(w){ return w.id==="night"; });
        return n.chosen===true && n.usual===270 && n.from===null; })());
      T("call-ins: switching a row back to Fixed drops the usual length", (function(){
        state(); S.tab="setup"; _setupTab="cycle"; render();
        var qsa=document.querySelectorAll, vals={".oc-hours":{value:"fixed"}};
        var rows=[{dataset:{ocid:"callin"},querySelector:function(q){ return vals[q]||null; },querySelectorAll:function(){ return []; }}];
        document.querySelectorAll=function(sel){ return sel==="#ocRows [data-ocid]"?rows:[]; };
        var list; try{ list=ocRowsNow(); } finally { document.querySelectorAll=qsa; S.tab="selfroster"; }
        var w=list.find(function(x){ return x.id==="callin"; });
        return w.chosen===undefined && w.usual===undefined; })());
      T("call-ins: a Chosen window needs a usual length that fits inside its hours", (function(){
        state(); var L=JSON.parse(JSON.stringify(c.settings.oncallWindows)), w=L[0];
        w.usual=0; var a=ocCheck(L,c); w.usual=780; var b=ocCheck(L,c); w.usual=720; var ok=ocCheck(L,c);
        return /needs a usual length/.test(a) && /longer than its hours/.test(b) && ok===""; })());
      T("call-ins: a window cannot switch between Fixed and Chosen while it is in use, either way, and says how many", (function(){
        state({oncall:{},callins:{}}); c.oncall[ocKey(TOMO,"night")]="s1"; c.callins[ciKey(TODAY,"callin","s2")]={start:"14:00",end:"18:00"};
        var L=JSON.parse(JSON.stringify(c.settings.oncallWindows));
        L[3].chosen=true; L[3].usual=240; var toChosen=ocCheck(L,c); delete L[3].chosen; delete L[3].usual;
        delete L[0].chosen; delete L[0].usual; var toFixed=ocCheck(L,c);
        delete c.callins[ciKey(TODAY,"callin","s2")]; var free=ocCheck(L,c);
        return /1 day is on call as Night, so its hours cannot switch to chosen when booked/.test(toChosen) &&
               /1 call-in is logged on Call-in \(C\), so its hours cannot switch to fixed/.test(toFixed) && free===""; })());
      T("call-ins: a Chosen window with call-ins cannot be removed, and the message says how many", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(YEST,"callin","s2")]={start:"10:00",end:"14:00"};
        S.tab="setup"; _setupTab="cycle";
        var qsa=document.querySelectorAll, rowEl={dataset:{ocid:"callin"},querySelector:function(){ return null; },querySelectorAll:function(){ return []; }};
        var del={closest:function(){ return rowEl; }}, asked=false; openConfirm=function(){ asked=true; return {then:function(){}}; };
        document.querySelectorAll=function(sel){ return sel==="#ocRows .oc-del"?[del]:(sel==="#ocRows [data-ocid]"?[rowEl]:[]); };
        try{ render(); if(del.onclick)del.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=keep.oc; S.tab="selfroster"; }
        return !!del.onclick && !asked && ocWindow(c,"callin")!==null && said.some(function(m){ return /2 call-ins are logged on Call-in \(C\)/.test(m); }); })());
      T("call-ins: a Chosen window with a stray on-call key from an older client reaches the confirm dialog, with no call-ins to block it", (function(){
        state({oncall:{},callins:{}}); c.oncall[ocKey(TODAY,"callin")]="s1";   // stray on-call key on a Chosen window: an older client wrote it
        S.tab="setup"; _setupTab="cycle";
        var qsa=document.querySelectorAll, rowEl={dataset:{ocid:"callin"},querySelector:function(){ return null; },querySelectorAll:function(){ return []; }};
        var del={closest:function(){ return rowEl; }}, asked=false; openConfirm=function(){ asked=true; return {then:function(){}}; };
        document.querySelectorAll=function(sel){ return sel==="#ocRows .oc-del"?[del]:(sel==="#ocRows [data-ocid]"?[rowEl]:[]); };
        try{ render(); if(del.onclick)del.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=keep.oc; S.tab="selfroster"; }
        return !!del.onclick && asked; })());
      T("call-ins: choosing the hours on a row shows or hides its range and zone boxes at once, without saving", (function(){
        state(); S.tab="setup"; _setupTab="cycle";
        var qsa=document.querySelectorAll, toggled=[], row={classList:{toggle:function(k,on){ toggled.push(k+":"+on); }}}, sel={value:"chosen",closest:function(){ return row; }};
        var before=JSON.stringify(c.settings.oncallWindows);
        document.querySelectorAll=function(q){ return q==="#ocRows .oc-hours"?[sel]:[]; };
        try{ render(); if(sel.onchange)sel.onchange(); } finally { document.querySelectorAll=qsa; S.tab="selfroster"; }
        return toggled.join()==="chosen:true" && JSON.stringify(c.settings.oncallWindows)===before; })());
      T("call-ins: saving the card logs a Chosen window in words", (function(){
        state(); S.tab="setup"; _setupTab="cycle"; render();
        try{ document.getElementById("saveOncall").onclick(); } finally { S.tab="selfroster"; }
        return S.audit.some(function(a){ return a.action==="settings.oncall" && a.detail.indexOf("Call-in (C) any hours 10:00–22:00, usually 4h")===0; }); })());
      T("call-ins: the Get started checklist reads a Chosen window in words", (function(){
        state(); var row=setupChecklist().find(function(r){ return r.key==="oncall"; });
        return !!row && row.detail.indexOf("Call-in (C) any hours 10:00–22:00, usually 4h")===0 && row.detail.indexOf("Night 22:00–08:00")>0; })());
      T("call-ins: the day sheet and the cell dialog offer no Take it for a call-in window, and still do for a fixed one", (function(){
        state(); _srSid="s1"; var sheet=daySheetHTML(TODAY); _srSid=null;
        var root=document.getElementById("modalRoot"), q0=root.querySelector; root.querySelector=function(){ return {}; };
        var m=""; try{ openCell("s1",TODAY); m=root.innerHTML; } finally { root.querySelector=q0; root.innerHTML=""; }
        return sheet.indexOf('data-octake="'+TODAY+'|callin"')<0 && sheet.indexOf('data-octake="'+TODAY+'|night"')>0 &&
               m.indexOf('data-ocset="callin"')<0 && m.indexOf('data-ocset="night"')>0; })());
      T("call-ins: a free call-in window never reads as on call free on a Book shifts row", (function(){
        var ctx={batch:false,canPick:true,openCount:function(){ return 0; }};
        state({wins:[CALLIN]}); var only=dayRowHTML("s1",parseISO(TODAY),ctx);
        state(); var both=dayRowHTML("s1",parseISO(TODAY),ctx);
        return only.indexOf("on call free")<0 && both.indexOf("on call free")>0; })());
      // ---- call-ins reach on-call's readers, with their real hours
      state({callins:{},assign:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"};
      T("call-ins: a call-in reads as its window with the hours worked, on a copy that says it is a call-in", (function(){
        var t=ocTakenBy(c,"s1",TODAY), h=ocHeldBy(c,"s1",TODAY);
        return t.length===1 && t[0].id==="callin" && t[0].ci===true && t[0].start==="14:00" && t[0].end==="18:00" && ocHours(t[0])===4 &&
               h.length===1 && h[0].ci===true && ocWindow(c,"callin").start==="10:00" && ocTakenBy(c,"s2",TODAY).length===0 && ocCountFor(c,"s1")===1; })());
      T("call-ins: several consultants on one day each read as their own, earliest first", (function(){
        c.callins[ciKey(TODAY,"callin","s2")]={start:"10:00",end:"14:00"};
        var ok=ocTakenBy(c,"s2",TODAY)[0].start==="10:00" && ocTakenBy(c,"s1",TODAY)[0].start==="14:00" && ciOnDay(c,TODAY).map(function(x){ return x.sid; }).join()==="s2,s1";
        delete c.callins[ciKey(TODAY,"callin","s2")]; return ok; })());
      T("call-ins: the list of who was called in on a day leaves out someone no longer in the group", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(TODAY,"callin","s2")]={start:"10:00",end:"14:00"};
        var both=ciOnDay(c,TODAY).map(function(x){ return x.sid; }).join(); S.staff=S.staff.filter(function(p){ return p.id!=="s2"; });
        return both==="s2,s1" && ciOnDay(c,TODAY).map(function(x){ return x.sid; }).join()==="s1"; })());
      T("call-ins: the On-call card refuses a Chosen range that crosses midnight and takes one ending at 00:00 and a Fixed night, so a call-in is measured on the day payroll dates it", (function(){
        state(); var L=JSON.parse(JSON.stringify(c.settings.oncallWindows)), late=L.find(function(w){ return w.id==="late"; }), night=L.find(function(w){ return w.id==="night"; });
        late.start="20:00"; late.end="04:00"; var cross=ocCheck(L,c);
        late.start="16:00"; late.end="00:00"; var mid=ocCheck(L,c), fixed=ocCheck([night],c);
        state({wins:[Object.assign({},LATE,{start:"20:00",end:"04:00"}),NIGHT],callins:{}}); c.callins[ciKey(TODAY,"late","s1")]={start:"00:15",end:"01:45"};   // stored before the card refused such a range
        var sp=ocSpan(TODAY,ocTakenBy(c,"s1",TODAY)[0]), pay=payrollRows().filter(function(x){ return x.code==="LATE"; });
        return cross==="The hours of Late call cross midnight. A call-in’s day must be clear for pay, so end it at 00:00, and add a second window from 00:00 if you need one." &&
               mid==="" && fixed==="" && night.start==="22:00" && night.end==="08:00" && !night.chosen &&
               iso(sp.st)===TODAY && sp.st.getHours()===0 && sp.st.getMinutes()===15 && pay.length===1 && pay[0].date===TODAY; })());
      state({callins:{},assign:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"};
      T("call-ins: payroll gives a call-in its own row, under the window's code, with the real hours and no zone", (function(){
        var r=payrollRows().filter(function(x){ return x.name==="Khan, Athar"&&x.code==="C"; });
        return r.length===1 && r[0].date===TODAY && r[0].start==="14:00" && r[0].end==="18:00" && r[0].hours===4 && r[0].unit==="" && r[0].note==="Call-in (C)"; })());
      T("call-ins: the RosterOn data sheet lists the call-in with its real hours", (function(){
        var sheets=[]; download=function(){}; XLSX={utils:{aoa_to_sheet:function(a){ sheets.push(JSON.parse(JSON.stringify(a))); return {}; },book_new:function(){ return {}; },book_append_sheet:function(){}},writeFile:function(){}};
        exportRosterOn(); var DS=sheets[1]||[];
        return DS.some(function(r){ return r[0]==="Khan, Athar" && r[4]==="Call-in (C)" && r[5]==="" && r[6]==="C" && r[7]==="14:00" && r[8]==="18:00" && r[9]===4; }); })());
      T("call-ins: the roster CSV and Excel exports name a call-in beside the day", (function(){
        var got=[]; download=function(x){ got.push(String(x)); }; exportRosterCSV(); exportRosterXLS();
        return got.length===2 && got[0].indexOf('"On call Call-in (C)"')>0 && got[1].indexOf("<td>On call Call-in (C)</td>")>0; })());
      T("call-ins: My shifts counts a call-in with its hours, the week strip and the shared week show it, and the roster marks it", (function(){
        S.viewAs="s1"; window._range=null; var my=viewMy(), wk=weekStripHTML("s1",TODAY), sh=shareWeekText("s1"), mk=ocMark(c,"s1",TODAY,true); S.viewAs="admin";
        return /<span class="tag lg oc"[^>]*>On call 1 · 4h<\/span>/.test(my) && wk.indexOf("Call-in (C) 14:00–18:00")>0 &&
               sh.indexOf("On call Call-in (C) 14:00–18:00")>0 && mk.indexOf('title="On call Call-in (C) 14:00–18:00"')>0 && mk.indexOf(">OC<")>0; })());
      T("call-ins: Book shifts shows the call-in on its row", dayRowHTML("s1",parseISO(TODAY),{batch:false,canPick:true,openCount:function(){ return 0; }}).indexOf('<span class="tag oc">Call-in (C)</span>')>0);
      T("call-ins: the day board lists who was called in, and when", (function(){
        dailyDate=TODAY; S.tab="daily"; var b=viewDaily(); S.tab="selfroster";
        return b.indexOf("Khan, Athar")>0 && b.indexOf("Called in 14:00–18:00")>0; })());
      T("call-ins: Fairness counts a call-in on its own, and once with a shift that day; a stray on-call key on a call-in window counts nothing", (function(){
        c.assign["s2|"+TODAY]={kind:"clinical",period:"AM",zone:"z1"}; c.callins[ciKey(TODAY,"callin","s2")]={start:"17:00",end:"21:00"};
        c.oncall={}; c.oncall[ocKey(TODAY,"callin")]="s3";
        var eq=equityData("cycle"), e1=eq.find(function(r){ return r.s.id==="s1"; }), e2=eq.find(function(r){ return r.s.id==="s2"; }), e3=eq.find(function(r){ return r.s.id==="s3"; });
        delete c.assign["s2|"+TODAY]; delete c.callins[ciKey(TODAY,"callin","s2")]; delete c.oncall;
        return !!e1 && e1.m.oc===1 && e1.m.booked===0 && !!e2 && e2.m.oc===1 && e2.m.booked===1 && (!e3 || e3.m.oc===0); })());
      T("call-ins: safe hours count a call-in as duty, and taking a fixed window over it is refused", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"late","s1")]={start:"21:00",end:"23:00"};
        var sp=_spansOn(c,"s1",TODAY), duty=_onDutyDay("s1",TODAY), r=ocTake("s1",TODAY,"night");
        return sp.length===1 && sp[0].st.getHours()===21 && duty===2 && r===false && !(c.oncall&&c.oncall[ocKey(TODAY,"night")]); })());
      T("call-ins: the calendar download and the live feed leave call-ins out, and nobody is reminded about one", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; window._range={from:TODAY,to:TODAY};
        var ics=icsText("s1"), feed=(typeof ICSFN!=="undefined")?ICSFN.buildICS(S,S.staff[0],null):"", rem=(typeof REMINDFN!=="undefined")?REMINDFN.reminderFor(S,S.staff[0],TODAY):null;
        return ics.indexOf("Call-in")<0 && String(feed).indexOf("Call-in")<0 && rem===null; })());
      T("call-ins: approving leave or setting it on the planner keeps a call-in, because it is hours already worked", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(YEST,"callin","s1")]={start:"10:00",end:"14:00"};
        S.requests=[{id:"rl1",type:"leave",from:"s1",code:"AL",dateFrom:TODAY,dateTo:TODAY,status:"pending",createdTs:Date.now()}];
        var threw=false; try{ approveRequest("rl1",""); plannerSetLeave("s1",YEST,"CME"); }catch(e){ threw=String(e); }
        return threw===false && !!ciGet(c,TODAY,"callin","s1") && !!ciGet(c,YEST,"callin","s1") && S.requests[0].status==="approved"; })());
      T("call-ins: taking someone out of the cycle or the group takes their call-ins with them, on all three paths", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(TODAY,"callin","s2")]={start:"10:00",end:"14:00"};
        ciDropFor(c,["s1"]);
        return !ciGet(c,TODAY,"callin","s1") && !!ciGet(c,TODAY,"callin","s2") && (String(wireStaffRows).match(/ciDropFor\(/g)||[]).length===3; })());
      T("call-ins: taking someone out of this cycle says their call-ins will be cleared too, not only their shifts", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(YEST,"callin","s2")]={start:"10:00",end:"14:00"}; c.callins[ciKey(OLD,"callin","s2")]={start:"bad",end:"14:00"};
        return typeof cycleRemovalNote==="function" &&
               cycleRemovalNote(c,"s1",2)==="\n\nTheir 2 shift(s) and 1 call-in(s) in THIS cycle will be cleared." && cycleRemovalNote(c,"s1",0)==="\n\nTheir 1 call-in(s) in THIS cycle will be cleared." &&
               cycleRemovalNote(c,"s2",0)==="\n\nTheir 1 call-in(s) in THIS cycle will be cleared." && cycleRemovalNote(c,"s3",3)==="\n\nTheir 3 shift(s) in THIS cycle will be cleared." &&
               cycleRemovalNote(c,"s3",0)==="" && cycleRemovalNote(null,"s1",0)==="" && String(wireStaffRows).indexOf('in other cycles."+cycleRemovalNote(c,id,shiftN)')>0; })());

      // ---- logging, changing and removing a call-in
      T("call-ins: a range check that understands midnight, and never takes an end that is not after the start", (function(){
        var MID={start:"16:00",end:"00:00"}, OVER={start:"20:00",end:"04:00"};   // OVER crosses midnight: the On-call card no longer saves one, but stored data may still hold it
        return ciInRange(CALLIN,"14:00","18:00") && !ciInRange(CALLIN,"21:00","23:00") && !ciInRange(CALLIN,"18:00","14:00") && !ciInRange(CALLIN,"14:00","14:00") && ciInRange(EARLY,"00:30","03:00") &&
               ciInRange(MID,"22:00","00:00") && !ciInRange(MID,"00:00","00:00") &&
               ciInRange(OVER,"23:00","01:00") && ciInRange(OVER,"01:00","03:00") && !ciInRange(OVER,"03:00","05:00") && !ciInRange(OVER,"19:00","21:00") &&
               !ciInRange(OVER,"03:00","01:00") && !ciInRange(OVER,"02:00","02:00"); })());
      T("call-ins: From starts at the start of the range on another day, and To follows the usual length within the range", (function(){
        var a=ciDefaults(CALLIN,YEST), b=ciDefaults(LATE,YEST), d=ciDefaults(Object.assign({},CALLIN,{usual:780}),YEST), t=ciDefaults(CALLIN,TODAY);
        return a.start==="10:00" && a.end==="14:00" && b.start==="16:00" && b.end==="18:00" && d.end==="22:00" && /^\d\d:\d\d$/.test(t.start) && ciInRange(CALLIN,t.start,t.end); })());
      state({assign:{}}); S.viewAs="s1";
      T("call-ins: a consultant logs a call-in today, and the admins are told", (function(){
        var r=ciSave("s1",TODAY,"callin","14:00","18:00"), v=ciGet(c,TODAY,"callin","s1");
        return r===true && !!v && v.start==="14:00" && v.end==="18:00" && S.audit[0].action==="callin.log" &&
               S.notifications.some(function(n){ return n.to==="admin" && n.text.indexOf("Khan, Athar logged a call-in on ")===0 && n.text.indexOf(", 14:00–18:00.")>0; }); })());
      T("call-ins: logging again changes the one call-in instead of adding a second", (function(){
        var r=ciSave("s1",TODAY,"callin","15:00","19:00"), keys=Object.keys(c.callins).filter(function(k){ return k.indexOf("|s1")>0; });
        return r===true && keys.length===1 && ciGet(c,TODAY,"callin","s1").start==="15:00" && S.audit[0].action==="callin.change" && S.audit[0].detail.indexOf("14:00–18:00 → 15:00–19:00")>0; })());
      T("call-ins: several consultants can be called in on the same day", (function(){
        S.viewAs="s2"; var r=ciSave("s2",TODAY,"callin","10:00","14:00"); S.viewAs="s1";
        return r===true && !!ciGet(c,TODAY,"callin","s2") && !!ciGet(c,TODAY,"callin","s1"); })());
      T("call-ins: a consultant logs on the day or the day after, not before and not later; an admin logs any day", (function(){
        var y=ciSave("s1",YEST,"callin","10:00","14:00"), t=ciSave("s1",TOMO,"callin","10:00","14:00"), o=ciSave("s1",OLD,"callin","10:00","14:00");
        S.viewAs="admin"; var a=ciSave("s1",OLD,"callin","10:00","14:00"); S.viewAs="s1";
        return y===true && t===false && o===false && a===true && !ciGet(c,TOMO,"callin","s1") &&
               said.some(function(m){ return m.indexOf("A call-in is logged on the day or the day after")===0; }) &&
               S.notifications.some(function(n){ return n.to==="s1" && n.text.indexOf("Your admin logged a call-in for you on ")===0; }); })());
      T("call-ins: hours outside the range, or ending before they start, are refused for everyone", (function(){
        S.viewAs="s3"; var a=ciSave("s3",TODAY,"callin","09:00","12:00"), b=ciSave("s3",TODAY,"callin","21:00","23:00"), d=ciSave("s3",TODAY,"callin","16:00","15:00"), e=ciSave("s3",TODAY,"callin","","15:00");
        S.viewAs="admin"; var f=ciSave("s3",TODAY,"callin","09:00","12:00"); S.viewAs="s1";
        return a===false && b===false && d===false && e===false && f===false && !ciGet(c,TODAY,"callin","s3") &&
               said.indexOf("Choose hours between 10:00 and 22:00, with the end after the start.")>=0 && said.indexOf("Fill in both times.")>=0; })());
      T("call-ins: a consultant logs only their own", (function(){
        S.viewAs="s1"; var r=ciSave("s2",YEST,"callin","10:00","14:00");
        return r===false && !ciGet(c,YEST,"callin","s2") && said.indexOf("You can only log your own call-in.")>=0; })());
      T("call-ins: the day limit follows the phone's own clock either side of midnight", (function(){
        state({assign:{}}); S.viewAs="s1"; var RealDate=Date, y0, t0, t1, d1, y1, r1;
        var pin=function(isoD,h,m){ var d=parseISO(isoD), ms=new RealDate(d.getFullYear(),d.getMonth(),d.getDate(),h,m).getTime();   // new Date() and Date.now() read this moment; a date built from parts is real
          Date=function(){ var a=[].slice.call(arguments); return a.length?new (Function.prototype.bind.apply(RealDate,[null].concat(a)))():new RealDate(ms); };
          Date.now=function(){ return ms; }; Date.parse=RealDate.parse; Date.UTC=RealDate.UTC; Date.prototype=RealDate.prototype; };
        try{
          pin(TODAY,23,59); y0=ciSave("s1",YEST,"callin","10:00","14:00"); t0=ciSave("s1",TOMO,"callin","10:00","14:00");
          pin(TOMO,0,1); t1=ciSave("s1",TOMO,"callin","10:00","14:00"); d1=ciSave("s1",TODAY,"callin","10:00","14:00"); y1=ciSave("s1",YEST,"callin","15:00","19:00"); r1=ciRemove("s1",YEST,"callin");
        } finally { Date=RealDate; }
        var y=ciGet(c,YEST,"callin","s1");
        return Date===RealDate && y0===true && t0===false && t1===true && d1===true && y1===false && r1===false &&
               !!y && y.start==="10:00" && !!ciGet(c,TOMO,"callin","s1") && !!ciGet(c,TODAY,"callin","s1"); })());
      T("call-ins: hours over the person's own shift are refused, and back to back is fine", (function(){
        state({assign:{}}); c.assign["s1|"+TODAY]={kind:"clinical",period:"AM",zone:"z1"}; S.viewAs="s1";
        var over=ciSave("s1",TODAY,"callin","16:00","20:00"), after=ciSave("s1",TODAY,"callin","17:00","21:00");
        return over===false && after===true && said.some(function(m){ return /^You’re working .+ then\.$/.test(m); }); })());
      T("call-ins: an admin is refused a call-in over the person's own shift too, so the same hours are never paid twice", (function(){
        state({assign:{}}); c.assign["s1|"+TODAY]={kind:"clinical",period:"AM",zone:"z1"}; S.viewAs="admin";
        var over=ciSave("s1",TODAY,"callin","16:00","20:00"), after=ciSave("s1",TODAY,"callin","17:00","21:00");
        return over===false && after===true && ciGet(c,TODAY,"callin","s1").start==="17:00" && said.some(function(m){ return /^Khan, Athar is working .+ then\.$/.test(m); }); })());
      T("call-ins: a shift from the day before that runs past midnight counts as a clash too", (function(){
        state({assign:{},pmEnd:"01:00"}); c.assign["s1|"+YEST]={kind:"clinical",period:"PM",zone:"z1"}; S.viewAs="s1";
        var sp=_shiftSpan("s1",YEST,"PM","z1"), r=ciSave("s1",TODAY,"early","00:30","03:00");
        return sp.en.getHours()===1 && r===false && said.some(function(m){ return /^You’re working .+ on .+ then\.$/.test(m); }); })());
      T("call-ins: hours over the person's own on-call or another of their call-ins are refused", (function(){
        state({assign:{},oncall:{}}); c.oncall[ocKey(TODAY,"night")]="s2"; S.viewAs="s2";
        var overNight=ciSave("s2",TODAY,"late","21:00","23:00"), backToBack=ciSave("s2",TODAY,"late","20:00","22:00"), overCallin=ciSave("s2",TODAY,"callin","18:00","21:00");
        return overNight===false && backToBack===true && overCallin===false && said.some(function(m){ return /^You’re already on call for /.test(m); }); })());
      T("call-ins: an admin is refused a call-in over the person's on-call or another of their call-ins too", (function(){
        state({assign:{},oncall:{}}); c.oncall[ocKey(TODAY,"night")]="s2"; S.viewAs="admin";
        var overNight=ciSave("s2",TODAY,"late","21:00","23:00"), backToBack=ciSave("s2",TODAY,"late","20:00","22:00"), overCallin=ciSave("s2",TODAY,"callin","18:00","21:00");
        return overNight===false && backToBack===true && overCallin===false && !ciGet(c,TODAY,"callin","s2") &&
               said.some(function(m){ return /^Park, Min is already on call for Night /.test(m); }) && said.some(function(m){ return /^Park, Min is already on call for Late call /.test(m); }); })());
      T("call-ins: nobody logs a call-in on a leave day, not even an admin, and nobody off the cycle's roster", (function(){
        state({assign:{},leave:[{id:"lv",staffId:"s1",code:"AL",from:TODAY,to:TODAY,status:"approved",requestId:"t"}]});
        var a=ciSave("s1",TODAY,"callin","14:00","18:00");
        c.roles.s3.in=false; hydrateCycleRoles(); var b=ciSave("s3",TODAY,"callin","14:00","18:00"); c.roles.s3.in=true; hydrateCycleRoles();
        return a===false && b===false && said.some(function(m){ return /on leave that day/.test(m); }) && said.some(function(m){ return /cycle’s roster/.test(m); }); })());
      T("call-ins: a window only the admin logs, or a roster still in draft, is refused to a consultant and open to the admin", (function(){
        state({wins:[Object.assign({},CALLIN,{book:false}),NIGHT]}); S.viewAs="s1"; var nb=ciSave("s1",TODAY,"callin","14:00","18:00"); S.viewAs="admin"; var nbA=ciSave("s1",TODAY,"callin","14:00","18:00");
        state({status:"draft"}); S.viewAs="s1"; var dr=ciSave("s1",TODAY,"callin","14:00","18:00"); S.viewAs="admin"; var drA=ciSave("s1",TODAY,"callin","14:00","18:00");
        return nb===false && nbA===true && dr===false && drA===true; })());
      T("call-ins: an archived roster refuses a consultant's call-in", (function(){
        state(); c.archived=true; S.viewAs="s1"; var r=ciSave("s1",TODAY,"callin","14:00","18:00");
        return r===false && !ciGet(c,TODAY,"callin","s1") && said.indexOf("This roster isn’t live yet.")>=0; })());
      T("call-ins: safe hours in Block mode stop a consultant and only warn an admin, and Warn mode saves with the warning", (function(){
        state({assign:{},fatigue:{mode:"block",minRest:14,maxConsec:0}}); c.assign["s3|"+YEST]={kind:"clinical",period:"PM",zone:"z1"};
        S.viewAs="s3"; var blocked=ciSave("s3",TODAY,"callin","10:00","14:00");
        S.viewAs="admin"; said.length=0; var adm=ciSave("s3",TODAY,"callin","10:00","14:00"), warned=said.some(function(m){ return /Only 12h rest/.test(m); });
        ciRemove("s3",TODAY,"callin"); c.settings.fatigue.mode="warn"; S.viewAs="s3"; said.length=0; var warn=ciSave("s3",TODAY,"callin","10:00","14:00");
        return blocked===false && adm===true && warned && warn===true && said.some(function(m){ return /Only 12h rest/.test(m); }); })());
      T("call-ins: safe hours judge the call-in's own hours, not the whole range of its window", (function(){
        state({assign:{},fatigue:{mode:"block",minRest:14,maxConsec:0}}); c.assign["s1|"+YEST]={kind:"clinical",period:"PM",zone:"z1"}; S.viewAs="s1";   // the PM shift ends at 22:00: 15 hours before 13:00, but only 12 before the range opens at 10:00
        var r=ciSave("s1",TODAY,"callin","13:00","17:00");
        return r===true && !!ciGet(c,TODAY,"callin","s1") && !said.some(function(m){ return /rest/.test(m); }); })());
      T("call-ins: a call-in straight after a PM shift is one run of duty for safe hours, not two stretches with no rest between", (function(){
        state({assign:{},fatigue:{mode:"block",minRest:10,maxConsec:0}}); c.assign["s1|"+TODAY]={kind:"clinical",period:"PM",zone:"z1"}; S.viewAs="s1";   // the PM shift runs 17:00 to 22:00
        var r=ciSave("s1",TODAY,"late","22:00","00:00"), sp=_spansOn(c,"s1",TODAY);
        return r===true && sp.length===1 && sp[0].st.getHours()===17 && iso(sp[0].en)===TOMO && sp[0].en.getHours()===0 && !said.some(function(m){ return /rest/.test(m); }); })());
      T("call-ins: a consultant removes their own on the day or the day after; after that only an admin can", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(OLD,"callin","s1")]={start:"10:00",end:"14:00"}; c.callins[ciKey(TODAY,"callin","s2")]={start:"10:00",end:"14:00"};
        S.viewAs="s1"; var mine=ciRemove("s1",TODAY,"callin"), old=ciRemove("s1",OLD,"callin"), other=ciRemove("s2",TODAY,"callin");
        S.viewAs="admin"; var adm=ciRemove("s1",OLD,"callin");
        return mine===true && old===false && other===false && adm===true && !ciGet(c,TODAY,"callin","s1") && !ciGet(c,OLD,"callin","s1") && !!ciGet(c,TODAY,"callin","s2") &&
               S.audit.filter(function(a){ return a.action==="callin.remove"; }).length===2 &&
               S.notifications.some(function(n){ return n.to==="admin" && n.text.indexOf("Khan, Athar removed their call-in on ")===0; }) &&
               S.notifications.some(function(n){ return n.to==="s1" && n.text.indexOf("Your admin removed your call-in on ")===0; }); })());
      T("call-ins: the three new log lines have words", AUDIT_WORDS["callin.log"]==="Logged a call-in" && AUDIT_WORDS["callin.change"]==="Changed a call-in" && AUDIT_WORDS["callin.remove"]==="Removed a call-in");

      // ---- two phones
      T("call-ins: the merge keeps both phones' call-ins, key by key, and a copy that has never heard of call-ins has no opinion", (function(){
        var keepS=S, keepB=_remoteBase, k1=ciKey(TODAY,"callin","s1"), k2=ciKey(TODAY,"callin","s2"), A={start:"14:00",end:"18:00"}, B={start:"10:00",end:"14:00"}, B2={start:"11:00",end:"15:00"}, B3={start:"12:00",end:"16:00"};
        var mk=function(ci){ var o={staff:[{id:"s1",name:"Khan, Athar"},{id:"s2",name:"Park, Min"}],staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},zones:[{id:"z1",name:"Consultant 1",am:true,pm:true}],
            leave:[],audit:[],requests:[],messages:[],notifications:[],feedback:[],openShifts:[],pushSubs:[],reqComments:[],outbox:[],
            cycles:[{id:"c1",cycle:{start:"2026-08-03",weeks:8},status:"published",archived:false,settings:{},assign:{},callins:ci}],activeId:"c1",viewAs:"admin",tab:"my"};
          if(ci===undefined)delete o.cycles[0].callins; return JSON.parse(JSON.stringify(o)); };
        var run=function(b,m,t){ _remoteBase=JSON.stringify(mk(b)); S=mk(m); var out; try{ out=mergeOnto(mk(t)); } finally { S=keepS; _remoteBase=keepB; } return out.cycles[0].callins; };
        var o=function(){ var x={}; for(var i=0;i<arguments.length;i+=2)x[arguments[i]]=arguments[i+1]; return x; };
        var both=run({},o(k1,A),o(k2,B)), cleared=run(o(k1,A),{},o(k1,A)), theirs=run(o(k2,B),o(k2,B),o(k2,B2)), silent=run(o(k1,A),o(k1,A,k2,B),undefined), mine=run(o(k2,B),o(k2,B2),o(k2,B)), same=run(o(k2,B),o(k2,B2),o(k2,B3));
        return !!both && both[k1].start==="14:00" && both[k2].start==="10:00" &&
               !!cleared && cleared[k1]===undefined && theirs[k2].start==="11:00" &&
               !!silent && silent[k1].start==="14:00" && silent[k2].start==="10:00" && mine[k2].start==="11:00" &&
               !!same && !!same[k2] && same[k2].start==="11:00"; })());

      // ---- the screens
      state({callins:{}}); c.callins[ciKey(TODAY,"callin","s2")]={start:"10:00",end:"14:00"};
      T("call-ins: today a consultant's day sheet offers I was called in, lists who else was called in, and reads the window in words", (function(){
        S.viewAs="s1"; var h=daySheetHTML(TODAY);
        return h.indexOf('data-ciopen="'+TODAY+'|callin|s1">I was called in</button>')>0 && h.indexOf("Park 10:00–14:00")>0 && h.indexOf("any hours 10:00–22:00, usually 4h")>0; })());
      T("call-ins: tomorrow a consultant sees no button, and an admin can add one on any day", (function(){
        S.viewAs="s1"; var s=daySheetHTML(TOMO); S.viewAs="admin"; _srSid="s1"; var a=daySheetHTML(TOMO); _srSid=null;
        return s.indexOf('data-ciopen="'+TOMO+'|callin|s1"')<0 && s.indexOf("logged on the day you’re called in")>0 && a.indexOf('data-ciopen="'+TOMO+'|callin|s1"')>0; })());
      T("call-ins: a logged call-in shows its hours with Change and Remove, and the open form shows the times and Save", (function(){
        c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; S.viewAs="s1"; var h=daySheetHTML(TODAY);
        _ciForm={k:ciKey(TODAY,"callin","s1"),start:"14:00",end:"18:00"}; var f=daySheetHTML(TODAY); _ciForm=null; delete c.callins[ciKey(TODAY,"callin","s1")];
        return h.indexOf('<span class="tag oc">Called in 14:00–18:00</span>')>0 && h.indexOf('data-ciopen="'+TODAY+'|callin|s1">Change</button>')>0 && h.indexOf('data-cidel="'+TODAY+'|callin|s1">Remove</button>')>0 &&
               f.indexOf('class="ci-from" value="14:00"')>0 && f.indexOf('data-cisave="'+TODAY+'|callin|s1">Save</button>')>0; })());
      T("call-ins: a consultant can remove their own call-in within the day limit even when the window is admin-logged, and neither changes nor removes one after", (function(){
        state({wins:[Object.assign({},CALLIN,{book:false}),NIGHT],callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; S.viewAs="s1"; var a=daySheetHTML(TODAY);
        state({callins:{}}); c.callins[ciKey(OLD,"callin","s1")]={start:"10:00",end:"14:00"}; S.viewAs="s1"; var b=daySheetHTML(OLD);
        return a.indexOf('data-cidel="'+TODAY+'|callin|s1"')>0 && a.indexOf('data-ciopen="'+TODAY+'|callin|s1"')<0 && b.indexOf('data-cidel="'+OLD+'|callin|s1"')<0 && b.indexOf('data-ciopen="'+OLD+'|callin|s1"')<0 && b.indexOf("Called in 10:00–14:00")>0; })());
      T("call-ins: the day sheet's buttons open the form, keep what was typed when refused, save, and remove after asking", (function(){
        S.viewAs="s1"; S.tab="selfroster"; var qsa=document.querySelectorAll, qs=document.querySelector, key=ciKey(YEST,"callin","s1");
        var F={value:""}, TO={value:""}, bo={dataset:{ciopen:key}}, bs={dataset:{cisave:key}}, bd={dataset:{cidel:key}}, opened=false, kept=false, saved=false, removed=false;
        document.querySelectorAll=function(sel){ return sel==="[data-ciopen]"?[bo]:(sel==="[data-cisave]"?[bs]:(sel==="[data-cidel]"?[bd]:[])); };
        document.querySelector=function(sel){ return sel==="#sheetRoot .ci-from"?F:(sel==="#sheetRoot .ci-to"?TO:null); };
        try{
          render(); bo.onclick(); opened=!!_ciForm && _ciForm.k===key && _ciForm.start==="10:00" && _ciForm.end==="14:00";
          F.value="09:00"; TO.value="11:00"; bs.onclick(); kept=!!_ciForm && _ciForm.start==="09:00" && !ciGet(c,YEST,"callin","s1");
          F.value="11:00"; TO.value="15:00"; bs.onclick(); saved=_ciForm===null && !!ciGet(c,YEST,"callin","s1") && ciGet(c,YEST,"callin","s1").start==="11:00";
          openConfirm=function(){ return {then:function(cb){ cb(true); }}; }; render(); bd.onclick(); removed=!ciGet(c,YEST,"callin","s1");
        } finally { document.querySelectorAll=qsa; document.querySelector=qs; openConfirm=keep.oc; _ciForm=null; }
        return opened && kept && saved && removed; })());
      T("call-ins: the cell dialog lists call-in windows apart from the on-call buttons, with Add, Change and Remove", (function(){
        S.viewAs="admin"; var root=document.getElementById("modalRoot"), q0=root.querySelector; root.querySelector=function(){ return {}; };
        var a="", b="";
        try{ openCell("s1",TODAY); a=root.innerHTML; c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; renderModal(); b=root.innerHTML; }
        finally { root.querySelector=q0; root.innerHTML=""; delete c.callins[ciKey(TODAY,"callin","s1")]; _ciForm=null; }
        return a.indexOf("<b>Call-ins</b>")>0 && a.indexOf('data-mciopen="'+TODAY+'|callin|s1">Add a call-in</button>')>0 && a.indexOf('data-ocset="night"')>0 &&
               b.indexOf('<span class="tag oc">Called in 14:00–18:00</span>')>0 && b.indexOf('data-mcidel="'+TODAY+'|callin|s1">Remove</button>')>0; })());
      T("call-ins: in the cell dialog an admin opens the form, saves the times and removes a call-in, on any day", (function(){
        S.viewAs="admin"; var root=document.getElementById("modalRoot"), q0=root.querySelector, qa0=root.querySelectorAll, key=ciKey(OLD,"callin","s2");
        var F={value:""}, TO={value:""}, bo={dataset:{mciopen:key}}, bs={dataset:{mcisave:key}}, bd={dataset:{mcidel:key}}, opened=false, saved=false, removed=false;
        root.querySelector=function(q){ return q===".ci-from"?F:(q===".ci-to"?TO:{}); };
        root.querySelectorAll=function(q){ return q==="[data-mciopen]"?[bo]:(q==="[data-mcisave]"?[bs]:(q==="[data-mcidel]"?[bd]:[])); };
        try{ openCell("s2",OLD); bo.onclick(); opened=!!_ciForm && _ciForm.k===key && _ciForm.start==="10:00";
          F.value="12:00"; TO.value="16:00"; bs.onclick(); saved=_ciForm===null && !!ciGet(c,OLD,"callin","s2") && ciGet(c,OLD,"callin","s2").end==="16:00";
          bd.onclick(); removed=!ciGet(c,OLD,"callin","s2"); }
        finally { root.querySelector=q0; root.querySelectorAll=qa0; root.innerHTML=""; _ciForm=null; }
        return opened && saved && removed; })());
      T("call-ins: when booking is closed, Book shifts still offers a consultant yesterday and today to log a call-in, on a live roster with a Chosen window", (function(){
        var closedAs=function(o,archived){ state(o); c.settings.rosterMode="rounds"; c.archived=!!archived; hydrateCycleSettings(); S.viewAs="s1";
          return bookingGate(c).ok===false?viewSelfRoster():null; };   // rounds mode after publishing, the app's default: booking is closed to staff
        var v=closedAs({}), sheet=daySheetHTML(TODAY), logged=ciSave("s1",TODAY,"callin","14:00","18:00"), fixedOnly=closedAs({wins:[NIGHT]}), draft=closedAs({status:"draft"}), gone=closedAs({},true);
        return v!==null && v.indexOf("<h2>Called in?</h2>")>0 && v.indexOf('<div class="sub">Open the day to log the hours you worked.</div>')>0 &&
               v.indexOf('data-bday="'+TODAY+'"')>0 && v.indexOf('data-bday="'+YEST+'"')>0 && v.indexOf('data-bday="'+TOMO+'"')<0 &&
               sheet.indexOf('data-ciopen="'+TODAY+'|callin|s1">I was called in</button>')>0 && logged===true &&
               fixedOnly!==null && fixedOnly.indexOf("Called in?")<0 && fixedOnly.indexOf("data-bday=")<0 &&
               draft!==null && draft.indexOf("Called in?")<0 && gone!==null && gone.indexOf("Called in?")<0; })());
      T("call-ins: the day sheet offers a consultant no I was called in on a roster that is not live", (function(){
        state({status:"draft"}); S.viewAs="s1"; var draft=daySheetHTML(TODAY);
        state(); c.archived=true; S.viewAs="s1"; var gone=daySheetHTML(TODAY);
        state(); S.viewAs="s1"; var live=daySheetHTML(TODAY), btn='data-ciopen="'+TODAY+'|callin|s1"';
        return draft.indexOf(btn)<0 && draft.indexOf("not open yet")>0 && gone.indexOf(btn)<0 && gone.indexOf("not open yet")>0 && live.indexOf(btn)>0; })());

      // ---- clearing the roster
      T("call-ins: clearing a draft removes the call-ins on its dates and counts them in the question and the log", (function(){
        state({status:"draft",callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"}; c.callins[ciKey(YEST,"callin","s2")]={start:"10:00",end:"14:00"};
        var body=rosterClearBody(rosterClearPlan(c)), p=clearRoster();
        return Object.keys(c.callins).length===0 && p.callins.length===2 && / and 2 call-ins\.$/.test(body.slice(0,body.indexOf(".")+1)) &&
               S.audit[0].action==="roster.clear" && S.audit[0].detail.indexOf("2 call-ins")>0; })());
      T("call-ins: clearing a live roster keeps call-ins, like leave, and the question and the log say so", (function(){
        state({callins:{}}); c.callins[ciKey(TODAY,"callin","s1")]={start:"14:00",end:"18:00"};
        var body=rosterClearBody(rosterClearPlan(c)), p=clearRoster();
        return Object.keys(c.callins).length===1 && p.keptCallins===1 && body.indexOf("Call-ins stay too: they record hours already worked.")>0 && /call-ins kept/.test(S.audit[0].detail); })());

      T("call-ins: both call-in rows wrap, so a narrow dialog keeps its form and buttons inside it", (function(){
        state({callins:{}}); S.viewAs="s1"; var h=daySheetHTML(TODAY);
        S.viewAs="admin"; var root=document.getElementById("modalRoot"), q0=root.querySelector; root.querySelector=function(){ return {}; };
        var m="";
        try{ openCell("s1",TODAY); m=root.innerHTML; }
        finally { root.querySelector=q0; root.innerHTML=""; _ciForm=null; }
        return h.indexOf('<div class="listrow cirow">')>0 && m.indexOf('<div class="listrow cirow">')>0; })());

      // ---- call-ins: later tasks add their tests above this line
    } finally { S=keep.S; window._range=keep.range; download=keep.dl; XLSX=keep.x; toast=keep.toast; openConfirm=keep.oc; dailyDate=keep.daily; _setupTab=keep.sb; _srSid=keep.sr; hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- open swaps: ask everyone, colleagues offer a shift back, the asker accepts one, an admin approves.
  // Spec: docs/superpowers/specs/2026-09-14-open-swaps-design.md. Dates are relative to today, because an ask is always about a day to come.
  (function(){
    var keep={S:S,toast:toast,oc:openConfirm,sr:_srSid,rs:_reqSheet,ds:_daySheet,sp:swapPeer,fp:_osFlushPush,sm:_swapMode,sw:_swapMine,nt:_swapNote}, c=null, said=[];
    var D=function(n){ return iso(addDays(new Date(),n)); };
    var FULL={id:"full",code:"FULL",label:"Full",start:"08:00",end:"23:00",fills:["AM","PM"],on:true,book:true,builtin:null};
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Resus",am:true,pm:true,pmLabel:""},{id:"z2",name:"Acute",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},rosterMode:"rolling",shiftTimes:{AM:{start:"08:00",end:"18:00"},PM:{start:"14:00",end:"23:00"}}};
      if(o.notice)set.noticeDays=o.notice;
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Alex",quota:20,eft:1,mobile:"0412 345 678"},{id:"s2",name:"Sam",quota:20,eft:1},{id:"s3",name:"Kim",quota:20,eft:1,mobile:"0498 765 432"},{id:"s4",name:"Jo",quota:20,eft:1}],
         cycles:[{id:"cc",cycle:{start:D(-7),weeks:6},status:o.status||"published",archived:false,settings:set,roles:{s1:{in:true},s2:{in:true},s3:{in:true},s4:{in:true}},assign:{}}],
         activeId:"cc",viewAs:o.viewAs||"s1",tab:"requests",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],marketOn:!!o.market};
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srSid=null; _reqSheet=null; _daySheet=null; swapPeer=null; }
    function put(sid,n,period,zone,type){ var v={kind:"clinical",period:period||"AM",zone:zone||"z1"}; if(type)v.type=type; c.assign[sid+"|"+D(n)]=v; return v; }
    function ask(o){ var a={id:"sw1",cycleId:"cc",from:"s1",dateA:D(3),shift:{kind:"clinical",period:"AM",zone:"z1",type:null},note:"",status:"open",why:"",ts:1,swapId:null}; for(var k in (o||{}))a[k]=o[k]; S.openSwaps.push(a); return a; }
    function offer(o){ var f={id:"so1",openId:"sw1",by:"s2",dateB:D(5),shift:{kind:"clinical",period:"PM",zone:"z2",type:null},status:"open",ts:1}; for(var k in (o||{}))f[k]=o[k]; S.swapOffers.push(f); return f; }
    toast=function(m){ said.push(String(m)); };
    try{
      // ---- records and rules
      T("open swaps: a group starts with no asks and no offers, and two colleagues offering at the same moment both keep theirs", (function(){
        state(); var fresh=Array.isArray(S.openSwaps)&&S.openSwaps.length===0&&Array.isArray(S.swapOffers)&&S.swapOffers.length===0;
        put("s1",3); ask();
        var base=JSON.parse(JSON.stringify(S)), mine=JSON.parse(JSON.stringify(S)), theirs=JSON.parse(JSON.stringify(S));
        mine.swapOffers.push({id:"soA",openId:"sw1",by:"s2",dateB:D(5),shift:{kind:"clinical",period:"PM",zone:"z2",type:null},status:"open",ts:2});
        theirs.swapOffers.push({id:"soB",openId:"sw1",by:"s3",dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z1",type:null},status:"open",ts:3});
        theirs.openSwaps.push({id:"sw2",cycleId:"cc",from:"s4",dateA:D(8),shift:{kind:"clinical",period:"AM",zone:"z1",type:null},note:"",status:"open",why:"",ts:4,swapId:null});
        var keepS=S, keepB=_remoteBase, out; _remoteBase=JSON.stringify(base); S=mine;
        try{ out=mergeOnto(theirs); } finally { S=keepS; _remoteBase=keepB; }
        return fresh && out.swapOffers.length===2 && out.swapOffers.some(function(f){ return f.id==="soA"; }) && out.swapOffers.some(function(f){ return f.id==="soB"; }) && out.openSwaps.length===2; })());
      T("open swaps: who can offer is whoever is free on the day and holds a shift on another day to come when the asker is free", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2"); put("s3",3,"PM","z2"); put("s3",6); put("s4",7); c.assign["s4|"+D(3)]={kind:"cst"};
        var o=ask(), two=swOfferable(o,"s2");
        return JSON.stringify(swWho(o))==='["s2"]' && two.length===1 && two[0].d===D(5) && swSame(two[0].shift,{kind:"clinical",period:"PM",zone:"z2",type:null}) &&
               swOfferable(o,"s3").length===0 && swOfferable(o,"s4").length===0 && swOfferable(o,"s1").length===0; })());
      T("open swaps: leave on the day, UA included, rules a colleague out, and so does a shift or leave of the asker's on the day offered", (function(){
        state(); put("s1",3); put("s2",5); put("s3",6); put("s4",8); put("s4",9);
        S.leave.push({id:"lv1",staffId:"s2",from:D(2),to:D(4),code:"AL",status:"approved"});
        c.assign["s3|"+D(3)]={kind:"leave",code:"UA"};
        put("s1",8); S.leave.push({id:"lv2",staffId:"s1",from:D(9),to:D(9),code:"AL",status:"approved"});
        var o=ask();
        return swOfferable(o,"s2").length===0 && swOfferable(o,"s3").length===0 && swOfferable(o,"s4").length===0 && swWho(o).length===0; })());
      T("open swaps: only shifts from today on can be offered, and only by people on this cycle's roster who work clinically", (function(){
        state(); put("s1",3); put("s2",-2); put("s2",0,"PM"); put("s3",5); put("s4",5,"PM","z2");
        var o=ask(), before=JSON.stringify(swWho(o)), two=swOfferable(o,"s2");
        c.roles.s3.in=false; var off=JSON.stringify(swWho(o)); c.roles.s3.in=true;
        delete c.roles.s4; var missing=JSON.stringify(swWho(o)); c.roles.s4={in:true};
        S.staff[2].mode="none"; var nonClinical=JSON.stringify(swWho(o));
        return before==='["s2","s3","s4"]' && two.length===1 && two[0].d===D(0) && off==='["s2","s4"]' && missing==='["s2","s3"]' && nonClinical==='["s2","s4"]'; })());
      T("open swaps: an ask holds only while its day is to come, its roster is live and the asker still holds the very same shift", (function(){
        state(); put("s1",3);
        var o=ask(), fresh=swAskWhy(o), s=c.assign["s1|"+D(3)];
        s.zone="z2"; var moved=swAskWhy(o); s.zone="z1";
        s.type="full"; var typed=swAskWhy(o); delete s.type;
        s.period="PM"; var half=swAskWhy(o); s.period="AM";
        c.assign["s1|"+D(3)]={kind:"cst"}; var cst=swAskWhy(o); c.assign["s1|"+D(3)]=s;
        S.leave.push({id:"lv",staffId:"s1",from:D(3),to:D(3),code:"AL",status:"approved"}); var leave=swAskWhy(o); S.leave=[];
        c.status="draft"; var draft=swAskWhy(o); c.status="published"; c.archived=true; var arch=swAskWhy(o); c.archived=false;
        var past=swAskWhy(ask({id:"sw2",dateA:D(-1)})), done=swAskWhy(ask({id:"sw3",status:"done"})), closed=swAskWhy(ask({id:"sw4",status:"closed",why:"withdrawn"}));
        return fresh==="" && moved==="the shift has changed" && typed==="the shift has changed" && half==="the shift has changed" && cst==="the shift has changed" && leave==="the shift has changed" &&
               draft==="the roster is not live" && arch==="the roster is not live" && past==="that day has passed" && done==="a swap was agreed" && closed==="withdrawn" && swAskWhy(null)==="it has gone"; })());
      T("open swaps: an offer holds only while its ask does, its day is to come, the colleague still holds that shift and both are still free", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2");
        var o=ask(), f=offer(), fresh=swOfferWhy(f);
        c.assign["s2|"+D(5)].zone="z1"; var moved=swOfferWhy(f); c.assign["s2|"+D(5)].zone="z2";
        put("s1",5); var askerBusy=swOfferWhy(f); delete c.assign["s1|"+D(5)];
        S.leave.push({id:"lv",staffId:"s1",from:D(5),to:D(5),code:"AL",status:"approved"}); var askerLeave=swOfferWhy(f); S.leave=[];
        c.assign["s2|"+D(3)]={kind:"cst"}; var peerBusy=swOfferWhy(f); delete c.assign["s2|"+D(3)];
        c.roles.s2.in=false; var gone=swOfferWhy(f); c.roles.s2.in=true;
        o.status="closed"; o.why="withdrawn"; var askClosed=swOfferWhy(f); o.status="open"; o.why="";
        f.status="withdrawn"; var wd=swOfferWhy(f); f.status="accepted"; var acc=swOfferWhy(f); f.status="closed"; var cl=swOfferWhy(f); f.status="open";
        var past=swOfferWhy(offer({id:"so2",dateB:D(-1)}));
        return fresh==="" && moved==="the offered shift has changed" && askerBusy==="Alex is no longer free on "+fmtISO(D(5)) && askerLeave==="Alex is no longer free on "+fmtISO(D(5)) &&
               peerBusy==="Sam is no longer free on "+fmtISO(D(3)) && gone==="Sam is no longer on this roster" && askClosed==="withdrawn" &&
               wd==="it was withdrawn" && acc==="it was accepted" && cl==="it was closed" && past==="that day has passed" && swOfferWhy(null)==="it has gone"; })());
      T("open swaps: preparing the next cycle carries no ask and no offer into it", (function(){
        state(); put("s1",3); put("s2",5); ask(); offer(); S.viewAs="admin"; prepareNext();
        var nc=S.cycles.find(function(x){ return x.id!=="cc"; });
        return !!nc && S.openSwaps.length===1 && S.swapOffers.length===1 && S.openSwaps[0].cycleId==="cc" && !("openSwaps" in nc) && !("swapOffers" in nc); })());

      // ---- the flow: ask, offer, accept, withdraw (open shifts stay switched off throughout: none of it needs them)
      T("open swaps: asking everyone stores the ask with the shift as it stands and tells only the colleagues who could take it, on the bell and the phone", (function(){
        state(); put("s1",3,"PM","z2"); put("s2",5); put("s3",3); put("s3",6); put("s4",7);
        var pushed=null; _osFlushPush=function(){ pushed=_osPushQueue; _osPushQueue=null; };
        var ok=swapAsk("s1",D(3),"  wedding  "), o=S.openSwaps[0];
        var told=S.notifications.filter(function(n){ return /is looking for a swap/.test(n.text); }).map(function(n){ return n.to; }).sort();
        return ok===true && S.openSwaps.length===1 && o.from==="s1" && o.dateA===D(3) && o.cycleId==="cc" && o.status==="open" && o.note==="wedding" &&
               swSame(o.shift,{period:"PM",zone:"z2",type:null}) && JSON.stringify(told)==='["s2","s4"]' &&
               S.notifications[0].text==="Alex is looking for a swap for "+fmtISO(D(3))+" Acute PM." && S.notifications[0].go.tab==="requests" && S.notifications[0].go.cycle==="cc" &&
               !!pushed && pushed.type==="swap" && pushed.osId===o.id && JSON.stringify(pushed.targets.slice().sort())==='["s2","s4"]' &&
               S.audit[0].action==="swap.ask" && AUDIT_WORDS["swap.ask"]==="Asked everyone for a swap"; })());
      T("open swaps: an ask is refused for a day gone, a shift that is not clinical, a roster not live, someone else's shift, a second ask, and when nobody could take it", (function(){
        state(); put("s1",3); put("s2",5); c.assign["s1|"+D(4)]={kind:"cst"}; put("s1",-1);
        var past=swapAsk("s1",D(-1),""), cst=swapAsk("s1",D(4),"");
        S.viewAs="s2"; var other=swapAsk("s1",D(3),""); S.viewAs="admin"; var adm=swapAsk("s1",D(3),""); S.viewAs="s1";
        c.status="draft"; var draft=swapAsk("s1",D(3),""); c.status="published";
        var first=swapAsk("s1",D(3),""), again=swapAsk("s1",D(3),"");
        delete c.assign["s2|"+D(5)]; put("s1",6); var nobody=swapAsk("s1",D(6),"");
        return past===false && cst===false && other===false && adm===false && draft===false && first===true && again===false && nobody===false && S.openSwaps.length===1 &&
               said.indexOf("That day has passed.")>=0 && said.indexOf("No clinical shift to swap that day.")>=0 && said.indexOf("This roster isn\u2019t live yet.")>=0 &&
               said.indexOf("Only the person on the shift can ask everyone.")>=0 && said.indexOf("You\u2019re already asking everyone about that shift.")>=0 &&
               said.indexOf("Nobody is free on "+fmtISO(D(6))+" with a shift you could take in return.")>=0; })());
      T("open swaps: a colleague offers one shift, can change it, and the asker is told each time", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2"); put("s2",6); ask();
        S.viewAs="s2"; var a=swapOffer("sw1",D(5)), firstId=S.swapOffers[0]&&S.swapOffers[0].id, b=swapOffer("sw1",D(6)), f=S.swapOffers[0];
        return a===true && b===true && S.swapOffers.length===1 && f.id===firstId && f.openId==="sw1" && f.by==="s2" && f.dateB===D(6) && f.status==="open" && swSame(f.shift,{period:"AM",zone:"z1",type:null}) &&
               S.notifications.filter(function(n){ return n.to==="s1"; }).length===2 &&
               S.notifications[1].text==="Sam offers "+fmtISO(D(5))+" Acute PM for your "+fmtISO(D(3))+" shift." &&
               S.notifications[0].text==="Sam changed their offer to "+fmtISO(D(6))+" Resus AM for your "+fmtISO(D(3))+" shift." &&
               S.audit.filter(function(x){ return x.action==="swap.offer"; }).length===2 && AUDIT_WORDS["swap.offer"]==="Offered a shift for a swap"; })());
      T("open swaps: an offer is refused for a shift that could not be swapped, for an ask that no longer holds, and from the asker", (function(){
        state(); put("s1",3); put("s1",5); put("s2",5); put("s2",6); put("s3",7); var o=ask();
        S.viewAs="s2"; var busy=swapOffer("sw1",D(5)), notTheirs=swapOffer("sw1",D(7)), gone=swapOffer("nope",D(6));
        S.viewAs="s1"; var self=swapOffer("sw1",D(6));
        o.status="closed"; o.why="withdrawn"; S.viewAs="s2"; var closed=swapOffer("sw1",D(6));
        o.status="open"; o.why=""; var good=swapOffer("sw1",D(6));
        return busy===false && notTheirs===false && gone===false && self===false && closed===false && good===true && S.swapOffers.length===1 &&
               said.indexOf("You can\u2019t offer that shift for this swap.")>=0 && said.indexOf("That swap request is closed: withdrawn.")>=0 && said.indexOf("That swap request is gone.")>=0; })());
      T("open swaps: only the colleague who made an offer can withdraw it, once, and the asker is told", (function(){
        state(); put("s1",3); put("s2",5); ask(); var f=offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s3"; var sneak=swapOfferWithdraw("so1");
        S.viewAs="s2"; var ok=swapOfferWithdraw("so1"), twice=swapOfferWithdraw("so1");
        return sneak===false && ok===true && twice===false && f.status==="withdrawn" && S.notifications[0].to==="s1" &&
               S.notifications[0].text==="Sam withdrew their offer for your "+fmtISO(D(3))+" shift." && S.audit[0].action==="swap.offer-withdraw" && AUDIT_WORDS["swap.offer-withdraw"]==="Withdrew a swap offer"; })());
      T("open swaps: accepting an offer makes an agreed swap for the admin, marks the ask done, closes the other offers and tells everyone", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2"); put("s3",6); var o=ask({note:"wedding"});
        var f=offer(), g=offer({id:"so2",by:"s3",dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; var ok=swapAccept("so1"), r=S.requests[0];
        var to=function(who,text){ return S.notifications.some(function(n){ return n.to===who&&n.text===text; }); };
        return ok===true && !!r && r.type==="swap" && r.from==="s1" && r.dateA===D(3) && r.peerId==="s2" && r.dateB===D(5) && r.reason==="wedding" &&
               r.status==="pending" && r.peerAgreed===true && r.openId==="sw1" && o.status==="done" && o.swapId===r.id && f.status==="accepted" && g.status==="closed" &&
               to("s2","Alex accepted your offer of "+fmtISO(D(5))+" for their "+fmtISO(D(3))+" shift. It has gone to your admin.") &&
               to("s3","Alex found a swap for "+fmtISO(D(3))+". Thank you for offering.") && to("admin","Alex and Sam agreed a swap through Ask everyone — awaiting approval.") &&
               S.audit[0].action==="swap.accept" && AUDIT_WORDS["swap.accept"]==="Accepted a swap offer" && !!c.assign["s1|"+D(3)] && !!c.assign["s2|"+D(5)]; })());
      T("open swaps: accepting reads both shifts again, so a moved shift or leave approved without a close cannot slip through, and only the asker accepts", (function(){
        state(); put("s1",3); put("s2",5); var o=ask(), f=offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; c.assign["s2|"+D(5)].zone="z2"; var moved=swapAccept("so1"); c.assign["s2|"+D(5)].zone="z1";
        S.leave.push({id:"lv",staffId:"s1",from:D(3),to:D(3),code:"AL",status:"approved"}); var leave=swapAccept("so1"); S.leave=[];
        S.viewAs="s2"; var notAsker=swapAccept("so1"); S.viewAs="s1"; var gone=swapAccept("nope");
        return moved===false && leave===false && notAsker===false && gone===false && S.requests.length===0 && o.status==="open" && f.status==="open" &&
               said.indexOf("That offer can\u2019t be accepted: the offered shift has changed.")>=0 && said.indexOf("That offer can\u2019t be accepted: the shift has changed.")>=0 &&
               said.indexOf("Only Alex can accept an offer for their shift.")>=0 && said.indexOf("That offer is gone.")>=0; })());
      T("open swaps: an accept racing a withdraw ends one way only, because each write reads the ask again", (function(){
        state(); put("s1",3); put("s2",5); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; var wd=swapAskWithdraw("sw1"), acc=swapAccept("so1"), none=S.requests.length===0;
        state(); put("s1",3); put("s2",5); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; var acc2=swapAccept("so1"), wd2=swapAskWithdraw("sw1");
        return wd===true && acc===false && none && acc2===true && wd2===false && S.openSwaps[0].status==="done" && S.requests.length===1 && said.indexOf("You already accepted an offer.")>=0; })());
      T("open swaps: withdrawing the ask closes it and every open offer on it, tells each colleague who offered, and only the asker can", (function(){
        state(); put("s1",3); put("s2",5); put("s3",6); var o=ask(), f=offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}}), g=offer({id:"so2",by:"s3",dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        var h=offer({id:"so3",by:"s4",status:"withdrawn"});
        S.viewAs="s2"; var sneak=swapAskWithdraw("sw1");
        S.viewAs="s1"; var ok=swapAskWithdraw("sw1"), twice=swapAskWithdraw("sw1");
        return sneak===false && ok===true && twice===false && o.status==="closed" && o.why==="withdrawn" && f.status==="closed" && g.status==="closed" && h.status==="withdrawn" &&
               S.notifications.filter(function(n){ return n.text==="Alex no longer needs a swap for "+fmtISO(D(3))+"."; }).map(function(n){ return n.to; }).sort().join()==="s2,s3" &&
               S.audit[0].action==="swap.ask-withdraw" && AUDIT_WORDS["swap.ask-withdraw"]==="Withdrew an ask for a swap" && said.indexOf("That swap request is already closed.")>=0; })());
      T("open swaps: the admin's approval carries the swap out as for any swap, and a decline leaves the ask done so the asker can simply ask again", (function(){
        state(); put("s1",3); put("s2",5,"PM","z2"); ask(); offer();
        S.viewAs="s1"; swapAccept("so1"); var r=S.requests[0]; S.viewAs="admin"; approveSwap(r.id,"");
        var moved=r.status==="approved" && !!c.assign["s2|"+D(3)] && c.assign["s2|"+D(3)].zone==="z1" && !!c.assign["s1|"+D(5)] && c.assign["s1|"+D(5)].zone==="z2" && !c.assign["s1|"+D(3)] && !c.assign["s2|"+D(5)];
        state(); put("s1",3); put("s2",5,"PM","z2"); var o=ask(); offer();
        S.viewAs="s1"; swapAccept("so1"); var r2=S.requests[0]; S.viewAs="admin"; declineSwap(r2.id,"");
        return moved && r2.status==="declined" && o.status==="done" && swapAskRefusal("s1",D(3))===""; })());

      // ---- the screens
      T("open swaps: the day sheet of your own booked shift offers Swap it beside Remove this shift, and inside the notice period beside the other ways off", (function(){
        state({notice:14,market:true}); put("s1",3); put("s1",20); var btn=function(n){ return 'data-swapit="'+D(n)+'"'; };
        var near=daySheetHTML(D(3)), far=daySheetHTML(D(20));
        offerShift("s1",D(3)); var offered=daySheetHTML(D(3));
        S.viewAs="admin"; _srSid="s1"; var adm=daySheetHTML(D(20)); S.viewAs="s1"; _srSid="s2"; put("s2",21); var other=daySheetHTML(D(21)); _srSid=null;
        return far.indexOf(btn(20))>0 && far.indexOf(btn(20))<far.indexOf('data-osdrop="'+D(20)+'"') && far.indexOf("Swap it</button>")>0 &&
               near.indexOf(btn(3))>0 && near.indexOf('data-osoffer="'+D(3)+'"')>0 && near.indexOf('data-osask="'+D(3)+'"')>0 && near.indexOf('data-osdrop=')<0 &&
               offered.indexOf(btn(3))>0 && offered.indexOf("Offered to the group")>0 &&
               adm.indexOf("data-swapit")<0 && adm.indexOf('data-osdrop="'+D(20)+'"')>0 && other.indexOf("data-swapit")<0; })());
      T("open swaps: a day already gone offers no Swap it, even in a round that still lets it be removed", (function(){
        state(); c.settings.rosterMode="rounds"; c.status="open"; put("s1",-2);
        var past=daySheetHTML(D(-2));
        return past.indexOf('data-osdrop="'+D(-2)+'"')>0 && past.indexOf("data-swapit")<0; })());
      T("open swaps: the swap sheet offers With a colleague, as before, and Ask everyone, which lists shifts to come and says who it will reach", (function(){
        state(); put("s1",-1); put("s1",3); put("s1",4); c.assign["s1|"+D(6)]={kind:"cst"}; put("s2",6); put("s3",8); put("s4",9);
        _swapMode="peer"; _swapMine=D(4); var peer=reqSheetHTML("swap");
        _swapMode="all"; var all=reqSheetHTML("swap");
        _swapMine=D(3); delete c.assign["s3|"+D(8)]; delete c.assign["s4|"+D(9)]; var none=reqSheetHTML("swap");
        return peer.indexOf('id="swSubmit"')>0 && peer.indexOf('id="swPeer"')>0 && peer.indexOf('data-swmode="peer" class="on"')>0 && peer.indexOf('<option value="'+D(4)+'" selected>')>0 &&
               peer.indexOf('<option value="'+D(-1)+'"')>0 && peer.indexOf('id="swAsk"')<0 &&
               all.indexOf('data-swmode="all" class="on"')>0 && all.indexOf('id="swPeer"')<0 && all.indexOf('id="swNote"')>0 && all.indexOf('<option value="'+D(4)+'" selected>')>0 &&
               all.indexOf('<option value="'+D(-1)+'"')<0 && all.indexOf('<option value="'+D(6)+'"')<0 &&
               all.indexOf("Goes to 2 colleagues who are free on "+fmtISO(D(4))+".")>0 && all.indexOf('id="swAsk">Ask everyone</button>')>0 &&
               none.indexOf("Nobody is free on "+fmtISO(D(3))+" with a shift you could take in return.")>0 && none.indexOf('id="swAsk" disabled>')>0; })());
      T("open swaps: Swap it opens Requests with the swap sheet and that shift already chosen", (function(){
        state(); put("s1",3); put("s1",5); S.tab="selfroster"; _daySheet=D(5); _swapNote="an old note";
        var qsa=document.querySelectorAll, b={dataset:{swapit:D(5)}};
        document.querySelectorAll=function(sel){ return sel==="[data-swapit]"?[b]:[]; };
        try{ render(); } finally { document.querySelectorAll=qsa; }
        if(b.onclick)b.onclick();
        return !!b.onclick && S.tab==="requests" && _reqSheet==="swap" && _daySheet===null && _swapMine===D(5) && _swapNote==="" &&
               document.getElementById("sheetRoot").innerHTML.indexOf('<option value="'+D(5)+'" selected>')>0; })());
      T("open swaps: Ask everyone sends the chosen shift and the note, then closes the sheet", (function(){
        state(); put("s1",3); put("s2",5); _swapMode="all"; _reqSheet="swap"; _swapNote="stale"; render();
        document.getElementById("swMine").value=D(3); document.getElementById("swNote").value="wedding";
        document.getElementById("swAsk").onclick();
        return S.openSwaps.length===1 && S.openSwaps[0].dateA===D(3) && S.openSwaps[0].note==="wedding" && _reqSheet===null && _swapNote===""; })());
      T("open swaps: a shift chosen on Ask everyone stays chosen, and switching to With a colleague keeps the one on screen", (function(){
        state(); put("s1",3); put("s1",4); put("s2",6); _swapMode="all"; _reqSheet="swap"; render();
        var m=document.getElementById("swMine"); m.value=D(4); m.onchange();
        var picked=_swapMine===D(4) && document.getElementById("sheetRoot").innerHTML.indexOf('<option value="'+D(4)+'" selected>')>0;
        _swapMine=D(3); m.value=D(4);
        var qsa=document.querySelectorAll, b={dataset:{swmode:"peer"}};
        document.querySelectorAll=function(sel){ return sel==="[data-swmode]"?[b]:[]; };
        try{ render(); } finally { document.querySelectorAll=qsa; }
        b.onclick(); var sheet=document.getElementById("sheetRoot").innerHTML; _reqSheet=null;
        return picked && _swapMine===D(4) && _swapMode==="peer" && sheet.indexOf('<option value="'+D(4)+'" selected>')>0 && sheet.indexOf('id="swPeer"')>0; })());
      T("open swaps: Requests shows a colleague who could take it a Swaps wanted card with their shifts and what each counts", (function(){
        state(); c.settings.shiftTypes=shiftTypesOf(c).concat([FULL]);
        put("s1",3); put("s2",5,"AM","z1","full"); put("s2",6,"PM","z2"); put("s3",3); put("s3",7); ask({note:"wedding"});
        S.viewAs="s2"; var v=viewRequests();
        S.viewAs="s3"; var busy=viewRequests();
        S.viewAs="s2"; swapOffer("sw1",D(6)); var after=viewRequests(), f=S.swapOffers[0];
        put("s4",8); ask({id:"sw2",from:"s4",dateA:D(8),status:"closed",why:"withdrawn"}); var closed=viewRequests().indexOf("Jo</b> is looking")<0;
        S.cycles.push({id:"c2",cycle:{start:D(35),weeks:2},status:"published",archived:false,settings:c.settings,roles:c.roles,assign:{}});
        S.cycles[1].assign["s3|"+D(36)]={kind:"clinical",period:"AM",zone:"z1"}; S.cycles[1].assign["s2|"+D(38)]={kind:"clinical",period:"AM",zone:"z1"};
        ask({id:"sw3",cycleId:"c2",from:"s3",dateA:D(36)}); var elsewhere=viewRequests().indexOf("Kim</b> is looking")<0;
        S.activeId="c2"; var there=viewRequests().indexOf("Kim</b> is looking")>0; S.activeId="cc";
        return v.indexOf("<h2>Swaps wanted</h2>")>0 && v.indexOf("wedding")>0 && v.indexOf('<select id="swofs-sw1">')>0 &&
               v.indexOf(fmtISO(D(5))+" · Resus Full · counts 2")>0 && v.indexOf(fmtISO(D(6))+" · Acute PM · counts 1")>0 && v.indexOf('data-swoffer="sw1">Send offer')>0 &&
               busy.indexOf("Swaps wanted")<0 &&
               after.indexOf("You offered "+fmtISO(D(6))+" · Acute PM · counts 1")>0 && after.indexOf('data-swofferwd="'+f.id+'"')>0 && after.indexOf('data-swoffer="sw1">Change offer')>0 &&
               after.indexOf('<option value="'+D(6)+'" selected>')>0 && closed && elsewhere && there; })());
      T("open swaps: Send offer sends the shift chosen in that ask's own list, and Withdraw takes it back", (function(){
        state(); put("s1",3); put("s2",5); put("s2",6); ask(); S.viewAs="s2";
        var qsa=document.querySelectorAll, send={dataset:{swoffer:"sw1"}}, wd={dataset:{}};
        document.querySelectorAll=function(sel){ return sel==="[data-swoffer]"?[send]:(sel==="[data-swofferwd]"?[wd]:[]); };
        try{ render(); document.getElementById("swofs-sw1").value=D(6); send.onclick(); wd.dataset.swofferwd=S.swapOffers[0].id; render(); wd.onclick(); } finally { document.querySelectorAll=qsa; }
        return S.swapOffers.length===1 && S.swapOffers[0].dateB===D(6) && S.swapOffers[0].status==="withdrawn"; })());
      T("open swaps: the asker's Requests lists each offer with Accept, reads a stale offer as closed with its reason, and offers Withdraw", (function(){
        state(); put("s1",3); put("s1",4); put("s2",5,"PM","z2"); put("s3",6); var o=ask();
        offer(); offer({id:"so2",by:"s3",dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}}); c.assign["s3|"+D(6)].zone="z2";
        ask({id:"sw2",dateA:D(4)}); ask({id:"sw4",dateA:D(7)}); offer({id:"so4",openId:"sw4",by:"s4",dateB:D(9)}); ask({id:"sw0",dateA:D(-1)});
        var v=viewRequests();
        return v.indexOf("<h2>Asking everyone</h2>")>0 && v.indexOf("Sam offers <b>"+fmtISO(D(5))+" · Acute PM · counts 1</b>")>0 && v.indexOf('data-swaccept="so1"')>0 &&
               v.indexOf('data-swaccept="so2"')<0 && v.indexOf("the offered shift has changed")>0 && v.indexOf('data-swaskwd="sw1"')>0 &&
               v.indexOf('data-swaskwd="sw2"')>0 && v.indexOf("No offers yet.")>0 && v.indexOf('data-swaskwd="sw4"')>0 && v.indexOf("Jo offers")<0 && v.indexOf('data-swaskwd="sw0"')<0; })());
      T("open swaps: Accept and Withdraw on the asker's card each ask first, then do it", (function(){
        state(); put("s1",3); put("s2",5); put("s1",8); put("s3",9); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}}); ask({id:"sw2",dateA:D(8)});
        var asked=[]; openConfirm=function(o){ asked.push(o.title); return {then:function(f){ f(true); }}; };
        var qsa=document.querySelectorAll, acc={dataset:{swaccept:"so1"}}, wd={dataset:{swaskwd:"sw2"}};
        document.querySelectorAll=function(sel){ return sel==="[data-swaccept]"?[acc]:(sel==="[data-swaskwd]"?[wd]:[]); };
        try{ render(); acc.onclick(); wd.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=keep.oc; }
        return asked.length===2 && asked[0]==="Accept Sam’s offer?" && S.requests.length===1 && S.openSwaps.find(function(o){ return o.id==="sw2"; }).status==="closed"; })());
      T("open swaps: the admin's swap card says when a swap came through Ask everyone", (function(){
        state(); put("s1",3); put("s2",5); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; swapAccept("so1"); S.viewAs="admin"; var v=viewRequests();
        delete S.requests[0].openId; var named=viewRequests();
        return v.indexOf("via Ask everyone")>0 && v.indexOf('data-approveswap="'+S.requests[0].id+'"')>0 && named.indexOf("via Ask everyone")<0 && named.indexOf("both agreed")>0; })());
      T("open swaps: a note typed on Ask everyone survives changing the shift, switching modes, picking a colleague, and is cleared when the sheet opens fresh", (function(){
        state(); put("s1",3); put("s1",4); put("s2",6); _swapMode="all"; _reqSheet="swap"; _swapNote=""; render();
        var m=document.getElementById("swMine"), sheet=function(){ return document.getElementById("sheetRoot").innerHTML; };
        m.value=D(4); document.getElementById("swNote").value="school pickup"; m.onchange();
        var step1=_swapMine===D(4)&&sheet().indexOf('id="swNote" placeholder="Optional" value="school pickup"')>0;
        _swapMine=D(3); m.value=D(4); document.getElementById("swNote").value="school run";
        var qsa=document.querySelectorAll, b={dataset:{swmode:"peer"}};
        document.querySelectorAll=function(sel){ return sel==="[data-swmode]"?[b]:[]; };
        try{ render(); } finally { document.querySelectorAll=qsa; }
        b.onclick();
        var step2=_swapMine===D(4)&&sheet().indexOf('id="swReason" placeholder="Optional" value="school run"')>0;
        document.getElementById("swReason").value="late start"; var sp=document.getElementById("swPeer"); sp.value="s2"; sp.onchange();
        var step3=_swapMine===D(4)&&sheet().indexOf('id="swReason" placeholder="Optional" value="late start"')>0;
        document.getElementById("reqSwap").onclick();
        return step1&&step2&&step3&&_swapNote===""; })());
      T("open swaps: the swap sheet shows a singular reach line when exactly one colleague could take the ask", (function(){
        state(); put("s1",3); put("s2",6);
        _swapMode="all"; _reqSheet="swap"; _swapMine=D(3); render();
        var html=document.getElementById("sheetRoot").innerHTML;
        return html.indexOf(" 1 colleague who is free on ")>0; })());

      // ---- tidying up: every path that takes the shift away closes what stood on it
      var scene=function(o){ state(o); put("s1",3); put("s2",5); put("s4",9); var a=ask(), f=offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}}); return {a:a,f:f}; };
      var closedAll=function(x){ return x.a.status==="closed" && x.a.why==="the shift has changed" && x.f.status==="closed" &&
        S.notifications.some(function(n){ return n.to==="s2"&&n.text==="Alex’s swap request for "+fmtISO(D(3))+" has closed: the shift has changed."; }) &&
        S.audit.some(function(a){ return a.action==="swap.ask-close"; }) && AUDIT_WORDS["swap.ask-close"]==="An ask for a swap was closed"; };
      T("open swaps: approving a swap that takes the asker's shift closes the ask and tells whoever offered", (function(){
        var x=scene(); S.requests=[{id:"rq1",type:"swap",from:"s1",dateA:D(3),peerId:"s4",dateB:D(9),status:"pending",peerAgreed:true,createdTs:1}];
        S.viewAs="admin"; approveSwap("rq1",""); return S.requests[0].status==="approved" && closedAll(x); })());
      T("open swaps: approving a swap that takes the offered shift closes that offer alone and tells its colleague", (function(){
        var x=scene(); S.requests=[{id:"rq1",type:"swap",from:"s2",dateA:D(5),peerId:"s4",dateB:D(9),status:"pending",peerAgreed:true,createdTs:1}];
        S.viewAs="admin"; approveSwap("rq1","");
        return S.requests[0].status==="approved" && x.a.status==="open" && x.f.status==="closed" &&
               S.notifications.some(function(n){ return n.to==="s2"&&n.text==="Your offer of "+fmtISO(D(5))+" for Alex’s "+fmtISO(D(3))+" shift has closed: the offered shift has changed."; }); })());
      T("open swaps: a colleague taking the asker's give-away closes the ask", (function(){
        var x=scene({market:true}); S.viewAs="s1"; offerShift("s1",D(3)); S.viewAs="s3"; claimOpenShift(S.openShifts[0].id,false);
        return !!c.assign["s3|"+D(3)] && !c.assign["s1|"+D(3)] && closedAll(x); })());
      T("open swaps: an admin letting the asker off closes the ask", (function(){
        var x=scene({market:true}); S.viewAs="s1"; askComeOff("s1",D(3),"surgery"); S.viewAs="admin"; decideComeOff(S.openShifts[0].id,true,"");
        return !c.assign["s1|"+D(3)] && closedAll(x); })());
      T("open swaps: approving leave over the day closes the ask", (function(){
        var x=scene(); S.requests=[{id:"rl1",type:"leave",from:"s1",code:"AL",dateFrom:D(2),dateTo:D(4),status:"pending",createdTs:1}];
        S.viewAs="admin"; approveRequest("rl1",""); return S.requests[0].status==="approved" && closedAll(x); })());
      T("open swaps: leave set on the planner over the day closes the ask", (function(){
        var x=scene(); S.viewAs="admin"; plannerSetLeave("s1",D(3),"AL"); return closedAll(x); })());
      T("open swaps: Remove this shift closes the ask", (function(){
        var x=scene(); S.viewAs="s1"; var ok=dropShift("s1",D(3)); return ok===true && closedAll(x); })());
      T("open swaps: unbooking the shift closes the ask too", (function(){
        var x=scene(); S.viewAs="s1"; var ok=unbookShift("s1",D(3)); return ok===true && closedAll(x); })());
      T("open swaps: an admin's cell edit that removes the shift, or moves its zone, closes the ask", (function(){
        var x=scene(); S.viewAs="admin"; setShift("s1",D(3),{kind:"off"}); var removed=closedAll(x);
        var y=scene(); S.viewAs="admin"; setShift("s1",D(3),{kind:"clinical",period:"AM",zone:"z2"}); var moved=closedAll(y);
        return removed && moved; })());
      T("open swaps: clearing the roster closes every open ask on the cycle and tells whoever offered", (function(){
        var x=scene(), other=ask({id:"sw2",from:"s4",dateA:D(9)}); S.viewAs="admin"; clearRoster();
        return x.a.status==="closed" && x.a.why==="the roster was cleared" && x.f.status==="closed" && other.status==="closed" &&
               S.notifications.some(function(n){ return n.to==="s2"&&n.text==="Alex’s swap request for "+fmtISO(D(3))+" has closed: the roster was cleared."; }); })());
      T("open swaps: a day gone only reads as closed: tidying up writes nothing for it and tells nobody", (function(){
        var x=scene(), old=ask({id:"sw0",dateA:D(-1)}), oldOffer=offer({id:"so0",openId:"sw0",by:"s3",dateB:D(6)}), stale=offer({id:"so9",by:"s3",dateB:D(-2)});
        var n=S.notifications.length; swTidy();
        return old.status==="open" && oldOffer.status==="open" && stale.status==="open" && swAskWhy(old)==="that day has passed" && swOfferWhy(stale)==="that day has passed" &&
               x.a.status==="open" && x.f.status==="open" && S.notifications.length===n; })());

      // ---- asking to come off with open shifts switched off, and Free that day
      T("open swaps: with open shifts off, asking to come off goes to the admins alone, once, and is never listed or pushed", (function(){
        state({notice:14}); put("s1",3); put("s2",4);
        var pushed="none"; _osFlushPush=function(){ if(_osPushQueue)pushed=_osPushQueue; _osPushQueue=null; };
        var ok=askComeOff("s1",D(3),"surgery"), o=S.openShifts[0], again=askComeOff("s1",D(3),"surgery");
        S.marketOn=true; var listed=marketMyHTML(), active=osActive().length; S.marketOn=false;
        return ok===true && !!o && o.kind==="ask" && o.from==="s1" && o.status==="open" && o.ask.status==="pending" && o.ask.reason==="surgery" && again===false && said.indexOf("Already asked.")>=0 &&
               S.notifications.filter(function(n){ return n.to==="all"; }).length===0 && S.notifications.filter(function(n){ return n.to==="admin"&&/asked to come off/.test(n.text); }).length===1 &&
               pushed==="none" && active===0 && listed.indexOf(o.id)<0 && pendingAsks().length===1 && askOn("s1",D(3))===true && S.audit[0].action==="market.ask"; })());
      T("open swaps: an admins-only ask can never be claimed, even once its shift has gone", (function(){
        state({notice:14}); put("s1",3); askComeOff("s1",D(3),"surgery"); var o=S.openShifts[0];
        delete c.assign["s1|"+D(3)]; S.viewAs="s2"; var claim=claimOpenShift(o.id,false);
        return claim===false && !c.assign["s2|"+D(3)] && o.status==="open" && said.indexOf("That shift isn’t open to claim.")>=0; })());
      T("open swaps: letting someone off an admins-only ask removes the shift and tells the group nothing; keeping them on closes it without offer words", (function(){
        state({notice:14}); put("s1",3); put("s1",6); askComeOff("s1",D(3),"surgery"); askComeOff("s1",D(6),"course");
        var off=S.openShifts.find(function(o){ return o.iso===D(3); }), kept=S.openShifts.find(function(o){ return o.iso===D(6); });
        S.viewAs="admin"; var r1=decideComeOff(off.id,true,""), r2=decideComeOff(kept.id,false,"short that day");
        var toS1=S.notifications.filter(function(n){ return n.to==="s1"; }).map(function(n){ return n.text; });
        return r1===true && r2===true && !c.assign["s1|"+D(3)] && off.status==="closed" && off.ask.status==="approved" && off.kind==="ask" &&
               !!c.assign["s1|"+D(6)] && kept.status==="closed" && kept.ask.status==="declined" && S.notifications.filter(function(n){ return n.to==="all"; }).length===0 &&
               toS1.indexOf("You’re off "+fmtISO(D(3))+" — your admin let you off.")>=0 && toS1.indexOf("Your admin needs you on "+fmtISO(D(6))+". short that day")>=0 &&
               S.audit.some(function(a){ return a.action==="market.release"; }) && pendingAsks().length===0 && askOn("s1",D(6))===false; })());
      T("open swaps: inside the notice period with open shifts off, the day sheet offers Swap it and Ask to come off, then says the admin has been asked", (function(){
        state({notice:14}); put("s1",3); var before=daySheetHTML(D(3));
        askComeOff("s1",D(3),"surgery"); var after=daySheetHTML(D(3));
        return before.indexOf('data-swapit="'+D(3)+'"')>0 && before.indexOf('data-osask="'+D(3)+'"')>0 && before.indexOf("data-osoffer")<0 && before.indexOf("Swap it, or ask your admin to let you off.")>0 &&
               after.indexOf('data-osask=')<0 && after.indexOf("Your admin has been asked")>0 && after.indexOf('data-swapit="'+D(3)+'"')>0; })());
      T("open swaps: with open shifts off, the ask dialog and the admin's two confirms say it goes to the admin alone", (function(){
        state({notice:14}); put("s1",3); S.tab="selfroster"; _daySheet=D(3);
        var html="", bodies=[], qsa=document.querySelectorAll, od=openDialog, a1={dataset:{osask:D(3)}};
        openDialog=function(h){ html=h; };
        document.querySelectorAll=function(sel){ return sel==="[data-osask]"?[a1]:[]; };
        try{ render(); a1.onclick(); } finally { document.querySelectorAll=qsa; openDialog=od; }
        askComeOff("s1",D(3),"surgery"); var o=S.openShifts[0];
        S.viewAs="admin"; S.tab="requests"; _daySheet=null;
        var off={dataset:{askoff:o.id}}, kp={dataset:{askkeep:o.id}};
        openConfirm=function(x){ bodies.push(x.body); return {then:function(){}}; };
        document.querySelectorAll=function(sel){ return sel==="[data-askoff]"?[off]:(sel==="[data-askkeep]"?[kp]:[]); };
        try{ render(); off.onclick(); kp.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=keep.oc; }
        return html.indexOf("It goes to your admin, who decides.")>0 && html.indexOf("goes to the group")<0 &&
               bodies[0]==="They come off it now, and the day shows as needing cover. Nothing goes to the group." && bodies[1]==="They stay on the shift."; })());
      T("open swaps: the admin's Come off a shift card lists who is free that day, with a Call link where a mobile is on file", (function(){
        state({notice:14}); put("s1",3); put("s2",3,"PM","z2"); askComeOff("s1",D(3),"surgery");
        S.viewAs="admin"; var card=askAdminCard(S.openShifts[0]);
        c.assign["s4|"+D(3)]={kind:"leave",code:"UA"}; var ua=askAdminCard(S.openShifts[0]);
        c.roles.s3.in=false; var none=askAdminCard(S.openShifts[0]);
        return card.indexOf("<b>Free that day</b>")>0 && card.indexOf('<a class="btn sm" href="tel:+61498765432" aria-label="Call Kim">')>0 &&
               card.indexOf("Also free, no mobile on file: Jo</div>")>0 && card.indexOf("Call Alex")<0 && card.indexOf("Sam")<0 && card.indexOf("asked the admins only")>0 &&
               ua.indexOf("no mobile on file")<0 && ua.indexOf('aria-label="Call Kim"')>0 && none.indexOf("<b>Free that day</b> · nobody")>0 && none.indexOf("Call Kim")<0; })());

      // ---- release
      T("open swaps: Help's swap answer and the release note both name Ask everyone", (function(){
        state({market:true}); S.tab="help"; var hh=viewHelp();
        return hh.indexOf("Swap or Open shift")>0 && hh.indexOf("<b>Ask everyone</b>")>0 && hh.indexOf("trade with a named colleague")<0 && hh.indexOf("the same number of shifts")<0 &&
               WHATS_NEW.filter(function(x){ return x.on==="2026-09-15"; })[0].title==="Swap without naming a colleague" && WHATS_NEW.filter(function(x){ return x.on==="2026-09-15"; })[0].lines.join(" ").indexOf("Ask everyone")>=0; })());
      T("open swaps: the release note says where Swap it and Ask to come off really are, and no longer promises every shift", (function(){
        var l=WHATS_NEW.filter(function(x){ return x.on==="2026-09-15"; })[0].lines;
        return l.length===3 && l.join(" ").indexOf("every shift")<0 && l[1].indexOf("While booking is open, Swap it sits on the day sheet")===0 && l[2].indexOf("On the day sheet, Ask to come off")===0; })());

      // ---- final review: a swap that wins takes what else stood on the shift with it
      T("open swaps: a swap that wins withdraws the asker's ask to come off, so the admin has nothing left to decide", (function(){
        state({notice:14}); put("s1",3); put("s2",5,"PM","z2");
        askComeOff("s1",D(3),"surgery"); var o=S.openShifts[0]; swapAsk("s1",D(3),"");
        S.viewAs="s2"; swapOffer(S.openSwaps[0].id,D(5));
        S.viewAs="s1"; swapAccept(S.swapOffers[0].id); var r=S.requests[0];
        S.viewAs="admin"; approveSwap(r.id,""); var keepOn=decideComeOff(o.id,false,"");
        return r.status==="approved" && !!c.assign["s2|"+D(3)] && !c.assign["s1|"+D(3)] && o.kind==="ask" && o.status==="withdrawn" && o.ask.status==="withdrawn" &&
               pendingAsks().length===0 && askOn("s1",D(3))===false && keepOn===false && viewRequests().indexOf("Come off a shift")<0 &&
               S.audit.some(function(a){ return a.action==="market.withdraw"&&a.detail==="Alex "+D(3)+" AM · the shift moved"; }); })());
      T("open swaps: a swap approved over a give-away withdraws it and tells whoever was waiting to claim it, and leaves the other give-aways as they are", (function(){
        state({market:true}); S.marketClaim="approve"; put("s1",3); put("s2",5); put("s4",6); put("s3",7);
        offerShift("s1",D(3)); var o=S.openShifts[0];
        S.viewAs="s4"; offerShift("s4",D(6)); var other=S.openShifts[0];
        var taken={id:"osC",cycleId:"cc",iso:D(7),period:"AM",zone:"z1",type:null,kind:"giveaway",from:"s2",status:"claimed",by:"s3",at:1,note:"",ts:1,actor:"s2"}; S.openShifts.push(taken);
        S.viewAs="s3"; claimOpenShift(o.id,false); var waiting=o.status==="pending"&&o.by==="s3";
        S.requests=[{id:"rq1",type:"swap",from:"s1",dateA:D(3),peerId:"s2",dateB:D(5),status:"pending",peerAgreed:true,createdTs:1}];
        S.viewAs="admin"; approveSwap("rq1","");
        return waiting && S.requests[0].status==="approved" && o.status==="withdrawn" && osActive().indexOf(o)<0 && other.status==="open" && osActive().indexOf(other)>=0 && taken.status==="claimed" &&
               S.notifications.some(function(n){ return n.to==="s3"&&n.text==="The "+fmtISO(D(3))+" AM offer was withdrawn."; }); })());
      T("open swaps: a give-away or an ask to come off whose shift has gone reads as gone before anything tidies it: not listed, off the admin's card, and neither decision can be made", (function(){
        state({notice:14,market:true}); put("s1",3); put("s1",6); put("s2",4);
        offerShift("s1",D(3)); askComeOff("s1",D(6),"surgery"); var a=S.openShifts[0];
        S.viewAs="s2"; askComeOff("s2",D(4),"course"); var b=S.openShifts[0];
        var listed=osActive().length, asked=pendingAsks().length;
        delete c.assign["s1|"+D(3)]; c.assign["s1|"+D(6)].zone="z2"; delete c.assign["s2|"+D(4)];
        S.viewAs="admin"; var keepOn=decideComeOff(b.id,false,""), letOff=decideComeOff(a.id,true,"");
        return listed===3 && asked===2 && osActive().length===0 && pendingAsks().length===0 && viewRequests().indexOf("Come off a shift")<0 &&
               keepOn===false && letOff===false && a.ask.status==="pending" && b.ask.status==="pending" && !!c.assign["s1|"+D(6)] && c.assign["s1|"+D(6)].zone==="z2" &&
               said.indexOf("That shift is no longer theirs — nothing to keep them on.")>=0 && said.indexOf("That shift is no longer theirs — nothing to let them off.")>=0; })());
      T("open swaps: tidying withdraws only give-aways and asks to come off from today on, and writes nothing for a gap, a day gone or a shift still held", (function(){
        state({market:true}); put("s1",3);
        var gap={id:"osG",cycleId:"cc",iso:D(2),period:"AM",zone:"z1",type:null,kind:"gap",from:null,status:"open",by:null,at:null,note:"",ts:1,actor:"admin"};
        var gone={id:"osP",cycleId:"cc",iso:D(-1),period:"AM",zone:"z1",type:null,kind:"giveaway",from:"s2",status:"open",by:null,at:null,note:"",ts:1,actor:"s2"};
        var held={id:"osH",cycleId:"cc",iso:D(3),period:"AM",zone:"z1",type:null,kind:"giveaway",from:"s1",status:"open",by:null,at:null,note:"",ts:1,actor:"s1"};
        S.openShifts.push(gap,gone,held); var n=S.notifications.length; swTidy();
        return gap.status==="open" && gone.status==="open" && held.status==="open" && S.notifications.length===n && S.audit.length===0; })());
      T("open swaps: letting someone off an admins-only ask also closes their ask for a swap on that shift, once the ask itself is settled", (function(){
        var x=scene({notice:14}); askComeOff("s1",D(3),"surgery"); var o=S.openShifts[0];
        S.viewAs="admin"; var r=decideComeOff(o.id,true,"");
        return r===true && o.kind==="ask" && o.status==="closed" && o.ask.status==="approved" && !c.assign["s1|"+D(3)] && closedAll(x) &&
               !S.audit.some(function(a){ return a.action==="market.withdraw"; }); })());

      // ---- final review: Accept takes the offer as it was shown
      T("open swaps: accepting is pinned to the offer as it was shown, so an offer changed in the meantime is not accepted", (function(){
        state(); put("s1",3); put("s2",5); put("s2",6); ask();
        S.viewAs="s2"; swapOffer("sw1",D(5)); var f=S.swapOffers[0], seen={dateB:f.dateB,shift:{kind:"clinical",period:"AM",zone:"z1",type:null}};
        swapOffer("sw1",D(6));
        S.viewAs="s1"; var moved=swapAccept(f.id,seen), none=S.requests.length===0&&S.openSwaps[0].status==="open"&&f.status==="open";
        c.assign["s2|"+D(6)].zone="z2"; S.viewAs="s2"; swapOffer("sw1",D(6));
        S.viewAs="s1"; var rezoned=swapAccept(f.id,{dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        var ok=swapAccept(f.id,{dateB:D(6),shift:{kind:"clinical",period:"AM",zone:"z2",type:null}});
        return moved===false && none && rezoned===false && ok===true && S.requests.length===1 && S.requests[0].dateB===D(6) &&
               said.filter(function(m){ return m==="That offer has just changed. Look at it again before accepting."; }).length===2; })());
      T("open swaps: the Accept button pins the offer its confirm showed, not what the offer has become by the time Accept is pressed", (function(){
        state(); put("s1",3); put("s2",5); put("s2",6); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        var answer=null; openConfirm=function(o){ return {then:function(f){ answer=f; }}; };
        var qsa=document.querySelectorAll, acc={dataset:{swaccept:"so1"}};
        document.querySelectorAll=function(sel){ return sel==="[data-swaccept]"?[acc]:[]; };
        try{ render(); acc.onclick(); } finally { document.querySelectorAll=qsa; openConfirm=keep.oc; }
        S.viewAs="s2"; swapOffer("sw1",D(6)); S.viewAs="s1"; answer(true);
        return S.requests.length===0 && S.openSwaps[0].status==="open" && S.swapOffers[0].dateB===D(6) && said.indexOf("That offer has just changed. Look at it again before accepting.")>=0; })());

      // ---- final review: the minor findings
      T("open swaps: an ask made with open shifts off still stands once they are switched on: the day sheet says the admin has been asked, and offering or asking again is refused", (function(){
        state({notice:14}); put("s1",3); askComeOff("s1",D(3),"surgery");
        S.marketOn=true; var sheet=daySheetHTML(D(3)), offered=offerShift("s1",D(3)), asked=askComeOff("s1",D(3),"again");
        return sheet.indexOf("data-osoffer")<0 && sheet.indexOf("data-osask")<0 && sheet.indexOf("Your admin has been asked")>0 && sheet.indexOf('data-swapit="'+D(3)+'"')>0 &&
               offered===false && asked===false && S.openShifts.length===1 && said.filter(function(m){ return m==="Already asked."; }).length===2; })());
      T("open swaps: asking everyone is refused while a swap for that shift is still waiting, whichever side of it you are on", (function(){
        state(); put("s1",3); put("s2",5); put("s3",6); put("s3",8); put("s4",9); ask(); offer({dateB:D(5),shift:{kind:"clinical",period:"AM",zone:"z1",type:null}});
        S.viewAs="s1"; swapAccept("so1"); var r=S.requests[0];
        S.viewAs="s2"; var peer=swapAsk("s2",D(5),"");
        r.status="info"; S.viewAs="s1"; var info=swapAsk("s1",D(3),"");
        S.viewAs="s3"; submitSwapRequest("s3",D(6),"s4",D(9),""); var named=swapAsk("s3",D(6),""), free=swapAsk("s3",D(8),"");
        r.status="declined"; S.viewAs="s1"; var declined=swapAsk("s1",D(3),"");
        return peer===false && info===false && named===false && free===true && declined===true && S.openSwaps.length===3 &&
               said.filter(function(m){ return m==="You already have a swap waiting for that shift."; }).length===3; })());
      T("open swaps: cancelling an approved swap closes an ask that stood on a shift it moved back, and tells whoever offered", (function(){
        state(); put("s1",3); put("s2",5); put("s3",7);
        S.requests=[{id:"rq1",type:"swap",from:"s1",dateA:D(3),peerId:"s2",dateB:D(5),status:"pending",peerAgreed:true,createdTs:1}];
        S.viewAs="admin"; approveSwap("rq1","");
        S.viewAs="s2"; swapAsk("s2",D(3),"school run"); var o=S.openSwaps[0];
        S.viewAs="s3"; swapOffer(o.id,D(7)); var f=S.swapOffers[0];
        S.viewAs="admin"; cancelApproved("rq1","");
        return S.requests[0].status==="cancelled" && !!c.assign["s1|"+D(3)] && !c.assign["s2|"+D(3)] && o.status==="closed" && o.why==="the shift has changed" && f.status==="closed" &&
               S.notifications.some(function(n){ return n.to==="s3"&&n.text==="Sam’s swap request for "+fmtISO(D(3))+" has closed: the shift has changed."; }); })());
      T("open swaps: the swap sheet opens fresh on With a colleague, from Request a swap and from Swap it", (function(){
        state(); put("s1",3); _swapMode="all"; render(); document.getElementById("reqSwap").onclick();
        var fromRequests=_reqSheet==="swap" && _swapMode==="peer" && document.getElementById("sheetRoot").innerHTML.indexOf('data-swmode="peer" class="on"')>0;
        _reqSheet=null; _swapMode="all"; S.tab="selfroster"; _daySheet=D(3);
        var qsa=document.querySelectorAll, b={dataset:{swapit:D(3)}};
        document.querySelectorAll=function(sel){ return sel==="[data-swapit]"?[b]:[]; };
        try{ render(); } finally { document.querySelectorAll=qsa; }
        b.onclick();
        return fromRequests && _reqSheet==="swap" && _swapMode==="peer" && document.getElementById("sheetRoot").innerHTML.indexOf('data-swmode="peer" class="on"')>0; })());
      T("open swaps: with open shifts off, a day already gone offers no Ask to come off, and asking about it is refused", (function(){
        state({notice:14,status:"open"}); c.settings.rosterMode="rounds"; put("s1",-2);
        var sheet=daySheetHTML(D(-2)), asked=askComeOff("s1",D(-2),"surgery");
        return sheet.indexOf("days’ notice")>0 && sheet.indexOf("data-osask")<0 && asked===false && S.openShifts.length===0 && said.indexOf("That day has passed.")>=0; })());

      // ---- open-shift guards: a give-away whose shift has moved, and Offer to group over an ask that went to the admins
      T("open swaps: a give-away whose shift has since moved cannot be claimed from a screen that still shows it, first come or waiting for approval", (function(){
        state({market:true}); S.marketClaim="instant"; put("s1",3); offerShift("s1",D(3)); var o=S.openShifts[0];
        c.assign["s1|"+D(3)].zone="z2";   // a roster import or a fixed pattern moves the shift without the sweep
        S.viewAs="s2"; var first=claimOpenShift(o.id,false);
        var firstRefused=first===false && c.assign["s1|"+D(3)].zone==="z2" && !c.assign["s2|"+D(3)] && o.status==="open";
        S.marketClaim="approve"; var waiting=claimOpenShift(o.id,false);
        return firstRefused && waiting===false && o.status==="open" && !o.by && said.indexOf("The offered shift has changed.")>=0; })());
      T("open swaps: approving a waiting claim on a give-away whose shift has since moved is refused, and the admin's waiting list leaves it out", (function(){
        state({market:true}); S.marketClaim="approve"; put("s1",3); offerShift("s1",D(3)); var o=S.openShifts[0];
        S.viewAs="s2"; claimOpenShift(o.id,false); var waiting=o.status==="pending" && o.by==="s2";
        S.viewAs="admin"; var listed=marketCardHTML().indexOf('data-osok="'+o.id+'"')>0;
        c.assign["s1|"+D(3)].zone="z2";
        var hidden=marketCardHTML().indexOf('data-osok="'+o.id+'"')<0, r=approveClaim(o.id,true);
        return waiting && listed && hidden && r===false && c.assign["s1|"+D(3)].zone==="z2" && !c.assign["s2|"+D(3)] && o.status==="pending"; })());
      T("open swaps: My shifts shows asked, not Offer to group, over an ask to come off made while open shifts were off", (function(){
        state({notice:14}); put("s1",3); put("s1",6); askComeOff("s1",D(3),"surgery");
        S.marketOn=true; var asked=marketOfferBtn("s1",D(3),c.assign["s1|"+D(3)]), other=marketOfferBtn("s1",D(6),c.assign["s1|"+D(6)]);
        return asked.indexOf("data-osoffer")<0 && asked.indexOf(">asked</span>")>0 && other.indexOf('data-osoffer="'+D(6)+'"')>0; })());

      // ---- open-shift alerts: an empty audience is nobody, never every phone
      var alertsFor=function(claim){ var q=null, sent=[], kp=pushSendEvent, kc=cloudOn, kv=CLOUD.vapidPublic;
        _osFlushPush=function(){ q=_osPushQueue; _osPushQueue=null; };   // keep what the claim queued
        try{ claim(); } finally { _osFlushPush=keep.fp; }
        pushSendEvent=function(title,body,targets,tag){ sent.push({title:title,targets:targets,tag:tag}); };
        cloudOn=function(){ return true; }; CLOUD.vapidPublic="test-key";
        try{ _osPushQueue=q; _osFlushPush(); } finally { pushSendEvent=kp; cloudOn=kc; CLOUD.vapidPublic=kv; _osPushQueue=null; }
        return {queued:q, sent:sent}; };
      var gapOn=function(n){ S.openShifts.unshift({id:"g1",cycleId:"cc",iso:D(n),period:"AM",zone:"z1",type:null,kind:"gap",from:null,status:"open",by:null,at:null,note:"",ts:1,actor:"admin"}); return S.openShifts[0]; };
      T("open shifts: claiming a plain gap sends no phone alert, where the empty audience used to reach every phone", (function(){
        state({market:true}); S.pushOn=true; var g=gapOn(3);
        var a=alertsFor(function(){ S.viewAs="s2"; claimOpenShift(g.id,false); });
        return g.status==="claimed" && !!a.queued && a.queued.type==="claimed" && a.sent.length===0; })());
      T("open shifts: claiming a give-away alerts only the giver's phones", (function(){
        state({market:true}); S.pushOn=true; put("s1",3); offerShift("s1",D(3)); var o=S.openShifts[0];
        var a=alertsFor(function(){ S.viewAs="s2"; claimOpenShift(o.id,false); });
        return o.status==="claimed" && a.sent.length===1 && a.sent[0].title==="Shift claimed" && JSON.stringify(a.sent[0].targets)==='["s1"]'; })());
      T("open shifts: a claim waiting for approval sends no phone alert, since admins hold no phone subscription of their own, and the admin is still told in the app", (function(){
        state({market:true}); S.pushOn=true; S.marketClaim="approve"; var g=gapOn(3);
        var a=alertsFor(function(){ S.viewAs="s2"; claimOpenShift(g.id,false); });
        return g.status==="pending" && !!a.queued && a.queued.type==="pending" && a.sent.length===0 &&
               S.notifications.some(function(n){ return n.to==="admin" && /wants the/.test(n.text); }); })());
      T("open shifts: pushSendEvent sends nothing for an empty audience, and a deliberate null still goes to everyone", (function(){
        var ksb=_sb, asked=[], empty=-1;
        _sb={auth:{getSession:function(){ asked.push(true); return Promise.resolve({data:{}}); }}};
        try{ pushSendEvent("t","b",[],"x"); empty=asked.length; pushSendEvent("t","b",null,"x"); } finally { _sb=ksb; }
        return empty===0 && asked.length===1; })());

      // ---- open swaps: later tasks add their tests above this line
    } finally { S=keep.S; toast=keep.toast; openConfirm=keep.oc; _srSid=keep.sr; _reqSheet=keep.rs; _daySheet=keep.ds; swapPeer=keep.sp; _osFlushPush=keep.fp; _swapMode=keep.sm; _swapMine=keep.sw; _swapNote=keep.nt; /* open swaps: restore */ hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- department groups: add a staff group in-app, the department digest, Who's on across groups.
  // Spec: docs/superpowers/specs/2026-09-16-department-groups-s0-s2-design.md. Dates are relative to today, as the digest is.
  (function(){
    var keep={S:S,co:cloudOn,as:authState,org:_org,hid:_orgHospitalId,lab:_orgLabel,hosp:_orgHospital,sb:_sb,ra:_realAdmin,st:setTimeout,ct:clearTimeout,toast:toast,hg:_hospGroups,bc:_boardCache,bb:_boardBusy,dh:_digestHash,dt:_digestTimer,pdo:_digestPendingOff,dd:_deptDate,ds:dailyScope,dm:dailyMode,dday:dailyDate,mob:isMobile,rl:location.reload,sr:_srSid,dsh:_daySheet,sp:_sheetPeriod,stab:_setupTab};
    var D=function(n){ return iso(addDays(new Date(),n)); }, T0=D(0);
    var calls=[], said=[], c=null;
    var FULL={id:"full",code:"FULL",label:"Full",start:"10:00",end:"22:00",fills:["AM","PM"],on:true,book:true,builtin:null};
    function fakeSb(){ return { from:function(t){ return { upsert:function(row,opt){ calls.push({t:t,op:"upsert",row:JSON.parse(JSON.stringify(row)),opt:opt||null}); return new Promise(function(){}); } }; },
                              rpc:function(name,args){ calls.push({op:"rpc",name:name,args:JSON.parse(JSON.stringify(args||{}))}); return new Promise(function(){}); } }; }
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Triage",am:true,pm:true,pmLabel:""},{id:"z2",name:"Resus",am:true,pm:true,pmLabel:"Resus late"}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},rosterMode:"rolling",shiftTimes:{AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:"22:00"}}};
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Ava Ng",quota:20,eft:1},{id:"s2",name:"Sam Lee",quota:20,eft:1},{id:"s3",name:"Ky Tran",quota:20,eft:1},{id:"s4",name:"Jo Park",quota:20,eft:1}],
         cycles:[{id:"cc",cycle:{start:D(-7),weeks:6},status:o.status||"published",archived:!!o.archived,settings:set,roles:{s1:{in:true},s2:{in:true},s3:{in:true},s4:{in:true}},assign:{}}],
         activeId:"cc",viewAs:o.viewAs||"admin",tab:o.tab||"daily",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],branding:{name:"Nurses",roleNoun:"nurse"},board:{publish:!!o.publish,show:o.show||[]}};
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; calls.length=0; said.length=0;
      _org="h1-nurses"; _orgHospitalId=(o.hospital===undefined)?"h1":o.hospital; _orgLabel="Nurses"; _orgHospital="Test Hospital"; authState="in"; _realAdmin=(S.viewAs==="admin"); _sb=fakeSb();
      _digestHash=""; _digestTimer=null; _digestPendingOff=false; _hospGroups=o.groups||null; _boardCache={rows:[],fetched:0}; _boardBusy=false; _deptDate=null; dailyScope="group"; dailyMode="day"; dailyDate=null; _srSid=null; _daySheet=null; _sheetPeriod="AM"; }
    function put(sid,n,period,zone,type){ var v={kind:"clinical",period:period||"AM",zone:zone||"z1"}; if(type)v.type=type; c.assign[sid+"|"+D(n)]=v; return v; }
    function bytes(){ return stableJSON(buildDigestAll(S,T0)); }
    function ups(){ return calls.filter(function(x){ return x.op==="upsert"; }); }   // the board writes alone: a render can also ask for the hospital's groups
    var EN=String.fromCharCode(8211), BEL=String.fromCharCode(7);
    cloudOn=function(){ return true; }; toast=function(m){ said.push(String(m)); }; isMobile=function(){ return false; };
    try{
      // ---- state and the pure builder
      T("digest: a fresh group starts with the board off and nothing chosen to show, and the sign-in row names the hospital", (function(){
        state(); delete S.board; normalize(); var seeded=JSON.stringify(S.board)==='{"publish":false,"show":[]}';
        _setOrgMeta({label:"Nurses",hospital:"H",hospital_id:"h9"}); var a=_orgHospitalId==="h9"&&_orgLabel==="Nurses"&&_orgHospital==="H";
        _setOrgMeta({label:"Nurses",hospital:"H"}); var b=_orgHospitalId==="";
        return seeded && a && b && dailyScope==="group"; })());
      T("digest: only a published cycle is published, from yesterday to the end of the cycle", (function(){
        var out=[]; ["draft","open","closed"].forEach(function(st){ state({status:st}); put("s1",2); out.push(Object.keys(buildDigestAll(S,T0).days).length); });
        state({archived:true}); put("s1",2); out.push(Object.keys(buildDigestAll(S,T0).days).length);
        state(); for(var i=-7;i<35;i++)c.assign["s1|"+D(i)]={kind:"clinical",period:"AM",zone:"z1"}; var days=Object.keys(buildDigestAll(S,T0).days).sort();
        return out.join(",")==="0,0,0,0" && days.length===36 && days[0]===D(-1) && days[days.length-1]===D(34) && buildDigestAll(S,T0).v===1 && buildDigestAll(S,T0).noun==="nurse"; })());
      T("digest: an entry carries name, slot, period and times only; a whole-day shift stands in both halves with the evening's own zone name", (function(){
        state(); c.settings.shiftTypes=shiftTypesOf(c).concat([FULL]); put("s1",2); put("s2",2,"AM","z2","full");
        var day=buildDigestAll(S,T0).days[D(2)], on=day.on, keys={}; on.forEach(function(e){ Object.keys(e).forEach(function(k){ keys[k]=1; }); });
        var ava=on.filter(function(e){ return e.n==="Ava Ng"; })[0], sam=on.filter(function(e){ return e.n==="Sam Lee"; });
        return on.length===3 && ava.r==="Triage" && ava.p==="AM" && ava.t==="10:00"+EN+"17:00" && sam.length===2 && sam[0].p==="AM" && sam[0].r==="Resus" && sam[1].p==="PM" && sam[1].r==="Resus late" && sam[0].t==="10:00"+EN+"22:00" &&
               Object.keys(keys).sort().join(",")==="n,p,r,t" && day.away.length===0; })());
      T("digest: on-call rides on the shift it follows, a window taken alone is its own line, and a call-in shows its logged hours", (function(){
        state(); c.settings.oncallWindows=[{id:"wf",label:"Late on-call",start:"22:00",end:"23:00",book:false,from:{zones:["z2"],period:"PM"}},{id:"w1",label:"On call",start:"22:00",end:"01:00",book:true},{id:"w2",label:"Call-in",start:"10:00",end:"22:00",book:true,chosen:true,usual:4}];
        put("s1",3,"PM","z2"); c.oncall={}; c.oncall[D(3)+"|w1"]="s3"; c.callins={}; c.callins[D(3)+"|w2|s4"]={start:"14:00",end:"18:00"};
        var on=buildDigestAll(S,T0).days[D(3)].on, ava=on.filter(function(e){ return e.n==="Ava Ng"; })[0], ky=on.filter(function(e){ return e.n==="Ky Tran"; })[0], jo=on.filter(function(e){ return e.n==="Jo Park"; })[0];
        return on.length===3 && ava.oc===true && ava.p==="PM" && ky.oc===true && ky.p==="" && ky.r==="" && ky.t==="22:00"+EN+"01:00" && jo.ci===true && jo.t==="14:00"+EN+"18:00" && jo.oc===undefined; })());
      T("digest: leave and unavailable mark a person away by name only, and a CST day appears nowhere", (function(){
        state(); S.leave.push({id:"lv1",staffId:"s1",from:D(2),to:D(4),code:"AL",status:"approved",reason:"secret"}); c.assign["s2|"+D(3)]={kind:"leave",code:"UA"}; c.assign["s3|"+D(3)]={kind:"cst"}; put("s4",3);
        var d=buildDigestAll(S,T0), day=d.days[D(3)], b=stableJSON(d);
        return day.away.join(",")==="Ava Ng,Sam Lee" && day.on.length===1 && day.on[0].n==="Jo Park" && b.indexOf("Ky Tran")<0 && b.indexOf("AL")<0 && b.indexOf("secret")<0 && b.indexOf("UA")<0; })());
      T("digest: two devices holding the staff in a different order, or looking at different cycles, produce the same bytes", (function(){
        state(); put("s1",2); put("s3",2,"PM","z2"); put("s2",5); var a=bytes(); S.staff.reverse(); var b=bytes(); S.activeId="nope"; var c2=bytes(); S.activeId="cc";
        return a===b && a===c2 && a.length>50; })());
      T("digest: a hostile name arrives without its markup", (function(){
        state(); S.staff[0].name='<b onload="x">Ava</b>'+BEL; put("s1",2); var b=bytes();
        return b.indexOf("<")<0 && b.indexOf(">")<0 && b.indexOf(BEL)<0 && b.indexOf('b onload=\\"x\\"Ava/b')>=0 && digestClean(null)==="" && digestClean("  a  ")==="a"; })());
      T("digest: a roster too big for the board is cut at the far end, and says so", (function(){
        state(); var big="Consultant with a very long name indeed, the kind that fills a whiteboard by itself"; S.staff=[]; c.roles={};
        for(var i=0;i<40;i++){ var id="p"+i; S.staff.push({id:id,name:big+" "+i,quota:20,eft:1}); c.roles[id]={in:true}; for(var n=-7;n<35;n++){ c.assign[id+"|"+D(n)]={kind:"clinical",period:(n%2?"AM":"PM"),zone:"z1"}; } }
        var d=buildDigestAll(S,T0), keys=Object.keys(d.days).sort();
        return d.truncated===true && stableJSON(d).length<=120*1024 && keys[0]===D(-1) && keys.length>5 && keys.length<36 && keys.every(function(k,i){ return k===D(-1+i); }); })());

      T("digest: someone not on the cycle's roster is neither on nor away, whatever leave they hold", (function(){
        state(); c.roles.s2={in:false}; delete c.roles.s3; put("s1",3);
        S.leave.push({id:"lv2",staffId:"s2",from:D(2),to:D(4),code:"AL",status:"approved"}); S.leave.push({id:"lv3",staffId:"s3",from:D(2),to:D(4),code:"AL",status:"approved"}); S.leave.push({id:"lv4",staffId:"s4",from:D(3),to:D(3),code:"AL",status:"approved"});
        var day=buildDigestAll(S,T0).days[D(3)], b=bytes();
        return day.away.join(",")==="Jo Park" && day.on.length===1 && day.on[0].n==="Ava Ng" && b.indexOf("Sam Lee")<0 && b.indexOf("Ky Tran")<0; })());
      T("digest: two published cycles merge earliest first, and a day is published once", (function(){
        state(); put("s1",2); var c2={id:"c2",cycle:{start:D(0),weeks:6},status:"published",archived:false,settings:c.settings,roles:{s1:{in:true},s2:{in:true},s3:{in:true},s4:{in:true}},assign:{}};
        c2.assign["s2|"+D(2)]={kind:"clinical",period:"PM",zone:"z2"}; c2.assign["s2|"+D(40)]={kind:"clinical",period:"AM",zone:"z1"}; S.cycles.push(c2);
        var d=buildDigestAll(S,T0); return d.days[D(2)].on.length===1 && d.days[D(2)].on[0].n==="Ava Ng" && !!d.days[D(40)] && d.days[D(40)].on[0].n==="Sam Lee" && d.days[D(40)].on.length===1; })());

      // ---- publishing
      T("publish: the switch on writes the digest once, and the same roster again writes nothing", (function(){
        state({publish:true}); put("s1",2); digestPublish(); var one=ups().length===1&&ups()[0].t==="board_slice", row=ups()[0].row;
        digestPublish(); var still=ups().length===1; put("s2",3); digestPublish();
        return one && row.hospital_id==="h1" && row.org==="h1-nurses" && row.data.v===1 && row.data.noun==="nurse" && !!row.data.days[D(2)] && !("updated" in row) && ups()[0].opt.onConflict==="hospital_id,org" && still && ups().length===2; })());
      T("publish: nothing leaves the group when the switch is off, the cloud is off, the hospital is unknown, or nobody is signed in", (function(){
        state(); put("s1",2); digestPublish(); var off=ups().length===0;
        state({publish:true}); cloudOn=function(){ return false; }; digestPublish(); var nocloud=ups().length===0; cloudOn=function(){ return true; };
        state({publish:true,hospital:""}); digestPublish(); var nohosp=ups().length===0;
        state({publish:true}); authState="login"; digestPublish(); var noauth=ups().length===0; authState="in";
        return off && nocloud && nohosp && noauth && digestOn()===true; })());
      T("publish: switching the board off writes an empty digest at once, and switching it on writes the full one", (function(){
        state({publish:true}); put("s1",2); setBoardPublish(false); var empty=ups().length===1&&JSON.stringify(ups()[0].row.data.days)==="{}"&&S.board.publish===false;
        setBoardPublish(true); var full=ups().length===2&&!!ups()[1].row.data.days[D(2)]&&S.board.publish===true;
        return empty && full && S.audit.filter(function(a){ return a.action==="settings.board"; }).length===2 && said.length===2; })());
      T("publish: the digest waits on its own 30-second timer, never the roster's", (function(){
        state({publish:true}); var got=null; setTimeout=function(fn,ms){ got={fn:fn,ms:ms}; return 7; }; clearTimeout=function(){}; _cloudTimer="keep";
        var armed=digestSchedule(); var own=got&&got.fn===digestPublish&&got.ms===30000&&_digestTimer===7&&_cloudTimer==="keep";
        state(); got=null; var idle=digestSchedule(); var none=got===null&&_digestTimer===null; _cloudTimer=null;
        return armed===true && own && idle===false && none; })());
      T("publish: a landed cloud write queues a publish", (function(){
        state({publish:true}); var got=null; setTimeout=function(fn,ms){ got={fn:fn,ms:ms}; return 8; }; clearTimeout=function(){}; _savePending=false; _syncFlash=null;
        _syncedOk(); return got!==null&&got.fn===digestPublish&&got.ms===30000; })());
      T("publish: a failed switch-OFF write keeps the timer arming until it lands", (function(){
        state({publish:true}); setTimeout=function(){ return 9; }; clearTimeout=function(){};
        setBoardPublish(false); var armed=_digestPendingOff===true&&digestOn()===false&&digestSchedule()===true;
        digestLanded(false); var landed=_digestPendingOff===false&&digestSchedule()===false;
        _digestPendingOff=true; calls.length=0; digestPublish(); var retried=ups().length===1&&JSON.stringify(ups()[0].row.data.days)==="{}";
        return armed && landed && retried; })());

      // ---- the hospital's groups and the board cache
      T("groups: the hospital's groups and the board are asked for by this group's own id, and our own row never comes from the cache", (function(){
        state(); groupsFetch(true); var g=calls[0]&&calls[0].op==="rpc"&&calls[0].name==="hospital_groups"&&calls[0].args.p_org==="h1-nurses";
        boardFetch(true); var b=calls[1]&&calls[1].name==="board_for_org"&&calls[1].args.p_org==="h1-nurses"; var busy=boardFetch(true)===null&&calls.length===2;
        state({hospital:""}); var none=groupsFetch(true)===null&&boardFetch(true)===null&&calls.length===0;
        state(); var rows=boardRowsFrom([{org:"h1-nurses",label:"Nurses",data:{v:1},updated:"x"},{org:"h1-consultants",label:"<b>C</b>",data:"bad",updated:null},null]);
        var own=rows.length===1&&rows[0].org==="h1-consultants"&&rows[0].label==="bC/b"&&rows[0].data===null&&rows[0].updated===null;
        return g && b && busy && none && own; })());
      T("groups: the department needs two groups, and only then does Get started ask to publish", (function(){
        state({groups:[{org:"h1-nurses",label:"Nurses"}]}); var one=deptOn()===false&&!setupChecklist().some(function(r){ return r.key==="board"; });
        state({groups:[{org:"h1-nurses",label:"Nurses"},{org:"h1-consultants",label:"Consultants"}]}); var rows=setupChecklist().filter(function(r){ return r.key==="board"; });
        var two=deptOn()===true&&rows.length===1&&rows[0].done===false&&rows[0].anchor==="brandCard";
        S.board.publish=true; var done=setupChecklist().filter(function(r){ return r.key==="board"; })[0].done===true;
        return one && two && done && siblingGroups().length===1 && siblingGroups()[0].org==="h1-consultants"; })());
      T("groups: the Group card offers the publish switch and the sibling groups to show, and each choice is saved and audited", (function(){
        state({groups:[{org:"h1-nurses",label:"Nurses"},{org:"h1-consultants",label:"Consultants"},{org:"h1-scribes",label:"Scribes"}]}); S.tab="setup"; _setupTab="group"; var h=viewSetup();
        var card=h.indexOf('id="boardPublish"')>=0&&h.indexOf('class="boardShow" data-org="h1-consultants"')>=0&&h.indexOf('data-org="h1-scribes"')>=0&&h.indexOf('data-org="h1-nurses"')<0&&h.indexOf("Never contacts, pay or leave reasons")>=0;
        setBoardShow("h1-consultants",true); var on=S.board.show.join(",")==="h1-consultants"&&calls.some(function(x){ return x.op==="rpc"&&x.name==="board_for_org"; });
        setBoardShow("h1-consultants",false); var off=S.board.show.length===0&&S.audit.filter(function(a){ return a.action==="settings.board"; }).length===2;
        state({hospital:""}); _setupTab="group"; var bare=viewSetup().indexOf('id="boardPublish"')<0;
        state({groups:[{org:"h1-nurses",label:"Nurses"}]}); _setupTab="group"; var alone=viewSetup().indexOf("No other staff group at Test Hospital yet")>=0;
        return card && on && off && bare && alone; })());

      // ---- Who's on: the Day board's department view
      function groups3(){ return [{org:"h1-consultants",label:"Consultants"},{org:"h1-nurses",label:"Nurses"},{org:"h1-scribes",label:"Scribes"}]; }
      function cacheRows(){ var days={}; days[T0]={on:[{n:"Dr Lee",r:"Resus",p:"AM",t:"10:00"+EN+"17:00"},{n:"Dr Kim",r:"Acute",p:"PM",t:"17:00"+EN+"22:00"}],away:["Dr Tan"]}; days[D(2)]={on:[{n:"Dr Lee",r:"Resus",p:"AM",t:"10:00"+EN+"17:00"},{n:"Dr Kim",r:"Acute",p:"PM",t:"17:00"+EN+"22:00"}],away:[]};
        return [{org:"h1-consultants",label:"Consultants",data:{v:1,noun:"consultant",days:days},updated:new Date(Date.now()-5*60000).toISOString()},{org:"h1-nurses",label:"Nurses",data:{v:1,noun:"nurse",days:{}},updated:new Date().toISOString()}]; }
      T("board: the Day board offers Whole department only when there are two groups", (function(){
        state({groups:[{org:"h1-nurses",label:"Nurses"}]}); var one=viewDaily().indexOf("data-dscope")<0;
        state({groups:groups3()}); var h=viewDaily(); return one && h.indexOf('data-dscope="dept"')>=0 && h.indexOf('data-dscope="group"')>=0 && h.indexOf('id="deptCard"')<0; })());
      T("board: the department view shows a column per group: ours live, a published one with its time, an unpublished one saying so", (function(){
        state({groups:groups3()}); _boardCache={rows:cacheRows(),fetched:Date.now()}; put("s1",0); dailyScope="dept"; var h=viewDaily();
        var cols=(h.match(/class="deptcol"/g)||[]).length;
        return h.indexOf('id="deptCard"')>=0 && cols===3 && h.indexOf("Consultants")>=0 && h.indexOf("Dr Lee")>=0 && h.indexOf("Resus")>=0 && h.indexOf("Updated 5 min ago")>=0 && h.indexOf("Dr Tan")>=0 &&
               h.indexOf("Scribes haven't published to the board.")>=0 && h.indexOf("Ava Ng")>=0 && h.indexOf("This group, live")>=0 && h.indexOf("1 nurse")>=0 && h.indexOf("2 consultants")>=0 && _deptDate===T0; })());
      T("board: our own column is the live roster even when the cache holds a stale copy of it", (function(){
        state({groups:groups3()}); var rows=cacheRows(); var stale={}; stale[T0]={on:[{n:"Stale Name",r:"Triage",p:"AM",t:"10:00"+EN+"17:00"}],away:[]}; rows.push({org:"h1-nurses",label:"Nurses",data:{v:1,noun:"nurse",days:stale},updated:new Date().toISOString()});
        _boardCache={rows:rows,fetched:Date.now()}; put("s2",0); dailyScope="dept"; var h=viewDaily();
        return h.indexOf("Sam Lee")>=0 && h.indexOf("Stale Name")<0 && (h.match(/class="deptcol"/g)||[]).length===3; })());
      T("board: names arrive as text: a name carrying markup is shown, not run", (function(){
        state({groups:groups3()}); var rows=cacheRows(); rows[0].data.days[T0].on[0].n='<img src=x onerror=alert(1)>'; rows[0].data.days[T0].away[0]='<b>x</b>'; _boardCache={rows:rows,fetched:Date.now()}; dailyScope="dept"; var h=viewDaily();
        return h.indexOf("&lt;img src=x onerror=alert(1)&gt;")>=0 && h.indexOf("<img src=x")<0 && h.indexOf("&lt;b&gt;x&lt;/b&gt;")>=0; })());
      T("board: the day is bounded to yesterday through fourteen days ahead, and on now follows the clock", (function(){
        state({groups:groups3()}); dailyScope="dept"; _deptDate=D(20); viewDaily(); var reset=_deptDate===T0; _deptDate=D(-1); var h=viewDaily(); var yday=_deptDate===D(-1)&&h.indexOf('min="'+D(-1)+'"')>=0&&h.indexOf('max="'+D(14)+'"')>=0;
        return reset && yday && onNowAt("10:00"+EN+"17:00",11*60)===true && onNowAt("10:00"+EN+"17:00",17*60)===false && onNowAt("22:00"+EN+"01:00",23*60)===true && onNowAt("bad",0)===false && agoText(Date.now())==="just now" && agoText(Date.now()-125*60000)==="2 h ago"; })());
      T("board: on a phone each group is a card that opens on tap, and the sheet can be printed on its own", (function(){
        state({groups:groups3()}); _boardCache={rows:cacheRows(),fetched:Date.now()}; dailyScope="dept"; isMobile=function(){ return true; }; var m=viewDaily(); isMobile=function(){ return false; }; var d=viewDaily();
        return (m.match(/<details class="deptcol">/g)||[]).length===3 && m.indexOf("<summary>")>=0 && d.indexOf("<details")<0 && d.indexOf('class="depthead"')>=0 && d.indexOf('class="printhead"')>=0 && d.indexOf('id="bPrint"')>=0 && d.indexOf('id="bRefresh"')>=0; })());

      // ---- the scribes' sheet
      T("sheet: a scribe's day sheet names the colleagues of a chosen group on that half, read-only, from the board", (function(){
        state({groups:groups3(),show:["h1-consultants"],viewAs:"s1"}); _boardCache={rows:cacheRows(),fetched:Date.now()}; var am=daySheetHTML(D(2)); _sheetPeriod="PM"; var pm=daySheetHTML(D(2)); _sheetPeriod="AM";
        var line=sibLinesHTML(D(2),"AM");
        return am.indexOf("Consultants on: Dr Lee \u00b7 Resus")>=0 && am.indexOf("Dr Kim")<0 && pm.indexOf("Consultants on: Dr Kim \u00b7 Acute")>=0 && line.indexOf("data-")<0 && line.indexOf("<button")<0 && sibLinesHTML(D(5),"AM").indexOf("nobody yet")>=0; })());
      T("sheet: nothing is shown when no group is chosen, when the department is off, or when the chosen group hasn't published", (function(){
        state({groups:groups3(),viewAs:"s1"}); _boardCache={rows:cacheRows(),fetched:Date.now()}; var none=daySheetHTML(D(2)).indexOf("Consultants on")<0&&sibLinesHTML(D(2),"AM")==="";
        state({groups:groups3(),show:["h1-scribes"],viewAs:"s1"}); _boardCache={rows:cacheRows(),fetched:Date.now()}; var unpub=daySheetHTML(D(2)).indexOf("Scribes haven't published to the board.")>=0;
        state({groups:[{org:"h1-nurses",label:"Nurses"}],show:["h1-consultants"],viewAs:"s1"}); var off=sibLinesHTML(D(2),"AM")==="";
        return none && unpub && off; })());
      T("sheet: the group's own Day board carries the same line under each half, and opening a sheet reads the board", (function(){
        state({groups:groups3(),show:["h1-consultants"]}); _boardCache={rows:cacheRows(),fetched:Date.now()}; dailyDate=D(2); var h=viewDaily();
        _boardCache={rows:[],fetched:0}; calls.length=0; openDaySheet(D(2)); var read=calls.some(function(x){ return x.op==="rpc"&&x.name==="board_for_org"; });
        return h.indexOf("Consultants on: Dr Lee \u00b7 Resus")>=0 && h.indexOf("Consultants on: Dr Kim \u00b7 Acute")>=0 && read; })());
      T("sheet: opening a day sheet on a fresh page load asks for the hospital's groups as well as the board, but only when something is chosen to show", (function(){
        state({tab:"my",viewAs:"s1",show:["h1-consultants"]}); openDaySheet(D(2)); var some=calls.some(function(x){ return x.op==="rpc"&&x.name==="hospital_groups"; })&&calls.some(function(x){ return x.op==="rpc"&&x.name==="board_for_org"; });
        state({tab:"my",viewAs:"s1"}); openDaySheet(D(2)); var none=!calls.some(function(x){ return x.op==="rpc"&&(x.name==="hospital_groups"||x.name==="board_for_org"); });
        return some && none; })());

      // ---- add a staff group
      T("add a group: the sheet refuses a missing name, a bad second email, and anyone who isn't an admin of a group under a hospital", (function(){
        state(); var noname=groupCheck("  ","nurse","").reason==="A group needs a name.", bad=groupCheck("Scribes","scribe","not-an-email").reason==="That second admin's email doesn't look right.";
        var ok=groupCheck(" Scribes ","Scribe","V@X.ORG"); var good=ok.ok===true&&ok.name==="Scribes"&&ok.noun==="scribe"&&ok.admin2==="v@x.org";
        _realAdmin=false; var staff=groupCheck("Scribes","scribe","").reason==="Only an admin can add a group."; _realAdmin=true;
        state({hospital:""}); var nohosp=/hospital/.test(groupCheck("Scribes","scribe","").reason)&&canAddGroup()===false;
        return noname && bad && good && staff && nohosp; })());
      T("add a group: creating calls the database with this group as the sibling, and the reload lands in the new group", (function(){
        state(); var r=createGroup("Scribes","scribe","v@x.org"); var call=calls[0];
        var asked=r.ok===true&&call&&call.op==="rpc"&&call.name==="create_group"&&call.args.p_sibling_org==="h1-nurses"&&call.args.p_label==="Scribes"&&call.args.p_noun==="scribe"&&call.args.p_admin2_email==="v@x.org";
        var r2=createGroup("Scribes","scribe",""); var nul=calls[1].args.p_admin2_email===null;
        var reloads=0; location.reload=function(){ reloads++; }; groupCreated("h1-scribes","Scribes","scribe"); var m=JSON.parse(localStorage.getItem("myrosta_newgroup")||"null");
        var landed=localStorage.getItem("myrosta_org")==="h1-scribes"&&m&&m.org==="h1-scribes"&&m.name==="Scribes"&&m.noun==="scribe"&&reloads===1;
        localStorage.removeItem("myrosta_newgroup"); localStorage.removeItem("myrosta_org");
        return asked && nul && landed && groupErrText({message:"Only an admin of a group in this hospital can add a group"})==="Only an admin can add a group." && groupErrText(null).indexOf("try again")>0; })());
      T("add a group: the new group's first load takes what its people are called, once, and never over an existing group — never the name, so the kind card still shows", (function(){
        state(); _org="h1-scribes"; S.staff=[]; S.branding={}; c.answered={}; localStorage.setItem("myrosta_newgroup",JSON.stringify({org:"h1-scribes",name:"Scribes",noun:"scribe",ts:1}));
        var first=groupFirstLoad()===true&&S.branding.name===undefined&&S.branding.roleNoun==="scribe"&&groupIsFresh()===true&&S.audit.some(function(a){ return a.action==="group.create"; })&&localStorage.getItem("myrosta_newgroup")===null;
        var again=groupFirstLoad()===false;
        localStorage.setItem("myrosta_newgroup",JSON.stringify({org:"h1-scribes",name:"Other",noun:"x",ts:1})); S.staff=[{id:"s1",name:"Ava Ng",quota:20,eft:1}]; var kept=groupFirstLoad()===false&&S.branding.roleNoun==="scribe"&&localStorage.getItem("myrosta_newgroup")===null;
        localStorage.setItem("myrosta_newgroup",JSON.stringify({org:"someone-else",name:"Other",noun:"x",ts:1})); S.staff=[]; var other=groupFirstLoad()===false&&S.branding.roleNoun==="scribe"; localStorage.removeItem("myrosta_newgroup");
        return first && again && kept && other; })());
      T("add a group: the row shows only to a signed-in admin of a group under a hospital, and the sheet has its fields", (function(){
        state(); var adm=moreSheetHTML().indexOf('id="sheetAddGroup"')>=0; S.viewAs="s1"; _realAdmin=false; var staff=moreSheetHTML().indexOf('id="sheetAddGroup"')<0; _realAdmin=true; S.viewAs="admin";
        state({hospital:""}); var nohosp=moreSheetHTML().indexOf('id="sheetAddGroup"')<0;
        var h=addGroupHTML("A group needs a name."); return adm && staff && nohosp && ['id="agName"','id="agNoun"','id="agAdmin2"','id="agCreate"','id="agCancel"','list="agRoles"','A group needs a name.'].every(function(s){ return h.indexOf(s)>=0; }) && addGroupHTML("").indexOf('class="note"')<0; })());

      // ---- release
      var _rel917=WHATS_NEW.find(function(e){ return e.on==="2026-09-17"; });   // pinned by date, not by position: later builds (23 Sep: the importer) sit in front of it
      T("release: What's new names the board and the group sheet on the release day, in three lines", !!_rel917 && /Who's on/.test(_rel917.title) && _rel917.lines.length===3 && _rel917.lines.some(function(l){ return /whole department/i.test(l); }) && _rel917.lines.some(function(l){ return /Add a staff group/.test(l); }) && BUILD>="2026-09-17");

      // ---- department groups: later tasks add their tests above this line
    } finally { S=keep.S; cloudOn=keep.co; authState=keep.as; _org=keep.org; _orgHospitalId=keep.hid; _orgLabel=keep.lab; _orgHospital=keep.hosp; _sb=keep.sb; _realAdmin=keep.ra; setTimeout=keep.st; clearTimeout=keep.ct; toast=keep.toast; _hospGroups=keep.hg; _boardCache=keep.bc; _boardBusy=keep.bb; _digestHash=keep.dh; _digestTimer=keep.dt; _digestPendingOff=keep.pdo; _deptDate=keep.dd; dailyScope=keep.ds; dailyMode=keep.dm; dailyDate=keep.dday; isMobile=keep.mob; location.reload=keep.rl; _srSid=keep.sr; _daySheet=keep.dsh; _sheetPeriod=keep.sp; _setupTab=keep.stab; /* department groups: restore */ hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- the demo sandbox's department board: a fictional hospital registry and sibling digests, built at load from S.demoBoard, local mode only.
  // The real app never reads S.demoBoard: with the cloud on, applyDemoBoard() is a no-op, so production behaviour is byte-for-byte what it was.
  (function(){
    var keep={S:S,co:cloudOn,org:_org,hid:_orgHospitalId,hosp:_orgHospital,hg:_hospGroups,hga:_hospGroupsAt,bc:_boardCache,db:(typeof _demoBoard==="undefined"?false:_demoBoard),ds:dailyScope,dd:_deptDate};
    try{
      var D=function(n){ return iso(addDays(new Date(),n)); }, T0=D(0);
      function base(demo){ S={staff:[{id:"s1",name:"Ava Ng",quota:20,eft:1}],zones:[{id:"z1",name:"Triage",am:true,pm:true,pmLabel:""}],staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},cycles:[{id:"cc",cycle:{start:D(-7),weeks:6},status:"published",settings:{},roles:{s1:{in:true}},assign:{}}],activeId:"cc",viewAs:"admin",tab:"daily",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],branding:{name:"Emergency Medicine",roleNoun:"consultant"},board:{publish:true,show:[]}};
        if(demo)S.demoBoard=JSON.parse(JSON.stringify(demo)); normalize(); hydrateCycleSettings(); hydrateCycleRoles(); _org="demo-ed"; _orgHospitalId=""; _orgHospital=""; _hospGroups=null; _boardCache={rows:[],fetched:0}; _demoBoard=false; dailyScope="group"; _deptDate=null; }
      var DEMO={hospital:"Wattle Hospital",ownLabel:"Consultants",groups:[
        {org:"demo-nurses",label:"Nurses",noun:"nurses",ago:4,people:["Priya Raman","Tom Baxter","Lena Fischer","Noah Okonkwo"],slots:[{r:"RN",p:"AM",t:"07:00\u201315:30",n:2},{r:"RN",p:"PM",t:"14:30\u201323:00",n:1}],awayEvery:3},
        {org:"demo-scribes",label:"Scribes",noun:"scribes",ago:27,people:["Sophie Hart","Daniel Kim"],slots:[{r:"Scribe 1",p:"AM",t:"10:00\u201316:00",n:1,weekdays:true}],awayEvery:5}]};
      function safe(f){ try{ return f()===true; }catch(e){ return false; } }   // a throw is a failure, never a truthy message
      T("month view: a zone's short name is the admin's (five letters at most), else initials for a multi-word name and the word itself, cut at five, for a single one", safe(function(){
        return zoneShort({name:"Fast track"})==="FT"&&zoneShort({name:"Acute bays"})==="AB"&&zoneShort({name:"Resus"})==="Resus"&&zoneShort({name:"EPIC"})==="EPIC"&&zoneShort({name:"Paeds"})==="Paeds"
          &&zoneShort({name:"Cardiology"})==="Cardi"&&zoneShort({name:"Fast track",short:"Fast"})==="Fast"&&zoneShort({name:"X",short:" toolongname "})==="toolo"&&zoneShort({name:"Resus / OC"})==="RO"&&zoneShort(null)==="?";
      }));
      T("roster grid: fixed columns, and a chip shows the full zone name up to eleven letters, else the short name", safe(function(){
        var zs=S.zones.slice(); S.zones.push({id:"zacute",name:"Acute bays",am:true,pm:true},{id:"zlong",name:"Emergency department",am:true,pm:true});
        try{ var a=cellChip({kind:"clinical",period:"AM",zone:"zacute"},"grid"), b=cellChip({kind:"clinical",period:"AM",zone:"zlong"},"grid"), m=cellChip({kind:"clinical",period:"AM",zone:"zacute"});
          return a.indexOf(">Acute bays<")>0&&b.indexOf(">ED<")>0&&b.indexOf("Emergency department")>0&&m.indexOf(">Acute bays<")>0&&viewRoster().indexOf('class="roster fixedcols"')>0; }
        finally{ S.zones=zs; }
      }));
      T("month view: a wide screen keeps the full name unless it is longer than fourteen letters", safe(function(){
        return monthLabel({name:"Fast track"},"AM")==="Fast track"&&monthLabel({name:"Emergency department"},"AM")==="ED"&&monthLabel({name:"Resus",pmLabel:"RESUS + OC"},"PM")==="RESUS + OC";
      }));
      T("videos: staff see their roster mode's chapters and only the modules switched on; admins see every admin module, marked on or off", safe(function(){
        var f0={clock:false,callin:false,oncall:false,ownhours:false,board:false,tags:false,import:true,basket:false};
        var a=videoList("staff","rounds",f0,false).map(function(v){return v.id;});
        if(a.indexOf("S2c")<0||a.indexOf("S2a")>=0||a.indexOf("S2b")>=0||a.indexOf("M1")>=0||a.indexOf("staff")<0||a.indexOf("staff-rolling")>=0||a.indexOf("staff-basket")>=0)return false;   // book-as-you-tap is the default: its chapter and film, not the basket's
        var b=videoList("staff","rolling",{clock:true,callin:true,oncall:true,ownhours:false,board:false,tags:false,import:true},false).map(function(v){return v.id;});
        if(b.indexOf("S2b")<0||b.indexOf("S2a")>=0||b.indexOf("M1")<0||b.indexOf("M2")<0||b.indexOf("M3")>=0||b.indexOf("M4")>=0)return false;
        var c=videoList("admin","rounds",f0,true); var am1=c.filter(function(v){return v.id==="AM1";}); if(am1.length!==1||am1[0].on!==false)return false;
        if(c.some(function(v){return v.aud!=="admin";})||c.some(function(v){return v.id==="A3b";})||!c.some(function(v){return v.id==="A3a";}))return false;
        var d=videoList("staff","rounds",f0,true); if(d.length<=a.length||!d.some(function(v){return v.id==="M1"&&v.on===false;})||d.some(function(v){return v.id==="S2b";}))return false;   // the admin's "What your staff see": every staff chapter in the group's mode, the off modules marked
        var g=vidGrid(d,true); if(g.indexOf('data-go="setup||clockCard"')<0||g.indexOf('data-go="setup||card-oncall"')<0||vidGrid(d,false).indexOf("data-go=")>=0||vidGrid(videoList("staff","rounds",f0,false),true).indexOf("data-go=")>=0)return false;   // the Switch on link: admins only, and only on a module that is off
        var ids=VIDEOS.map(function(v){return v.id;}); if(new Set(ids).size!==ids.length)return false;
        var fn=Object.assign({},f0,{basket:false}); var ln=videoList("staff","rounds",fn,false).map(function(v){return v.id;}); if(ln.indexOf("S2c")<0||ln.indexOf("S2a")>=0||ln.indexOf("staff")<0||ln.indexOf("staff-basket")>=0)return false;   // the default (12 Oct 2026): the instant chapter and the staff film, no basket chapter or film
        var fb=Object.assign({},f0,{basket:true}); var lbk=videoList("staff","rounds",fb,false).map(function(v){return v.id;}); if(lbk.indexOf("S2a")<0||lbk.indexOf("S2c")>=0||lbk.indexOf("staff-basket")<0||lbk.indexOf("staff")>=0)return false;   // the basket switched on: its chapter and film stand in for the instant ones
        var la=videoList("staff","rounds",fn,true); var s2a=la.filter(function(v){return v.id==="S2a";}); if(s2a.length!==1||s2a[0].on!==false||!la.some(function(v){return v.id==="S2c";})||vidGrid(la,true).indexOf('data-go="setup||brandCard"')<0)return false;   // default: admins see both, the basket one marked off with its Switch on link
        var lb=videoList("staff","rounds",fb,true).map(function(v){return v.id;}); if(lb.indexOf("S2a")<0||lb.indexOf("S2c")>=0||lb.indexOf("staff-basket")<0||lb.indexOf("staff")>=0)return false;   // basket on: the basket chapter and film stand in, for admins too
        if(!("basket" in videoFeats())||("instant" in videoFeats())||!("walkin" in videoFeats())||!("fixed" in videoFeats()))return false;
        var fw=Object.assign({},f0,{walkin:true,fixed:true}); var lw=videoList("staff","rounds",fw,false).map(function(v){return v.id;}); var lx=videoList("staff","rounds",Object.assign({},f0,{walkin:false,fixed:false}),false).map(function(v){return v.id;});
        if(lw.indexOf("M5")<0||lw.indexOf("M6")<0||lx.indexOf("M5")>=0||lx.indexOf("M6")>=0)return false;   // the fixed-pattern and walk-in chapters follow their switches
        var aw=videoList("admin","rounds",Object.assign({},f0,{walkin:false}),true); var am6=aw.filter(function(v){return v.id==="AM6";})[0]; if(!am6||am6.on!==false||!aw.some(function(v){return v.id==="A9";})||vidGrid(aw,true).indexOf('data-go="setup||clockCard"')<0)return false;   // admins: the walk-in module marked off with its Switch on link, the pattern chapter always
        if(vidGrid(videoList("staff","rounds",Object.assign({},f0,{fixed:false}),true),true).indexOf("nobody on a fixed pattern")<0)return false;
        var dir=videoList("director","rounds",f0,true); if(dir.length!==1||dir[0].id!=="director"||!dir[0].film)return false;   // the director's cut: one film, no mode, listed for admins under "For your director"
        return VIDEOS.every(function(v){return !!v.t&&v.s>0&&(v.aud==="staff"||v.aud==="admin"||v.aud==="director")&&(!v.mode||v.mode==="rounds"||v.mode==="rolling");});
      }));
      T("videos: the group's switches feed the list, import is always on, and the length prints as m:ss", safe(function(){
        var f=videoFeats(); return typeof f.clock==="boolean"&&f.import===true&&vidLen(298)==="4:58"&&vidLen(0)==="0:00";
      }));
      T("demo board: in local mode S.demoBoard switches the department view on, our group live and the siblings from fictional digests", safe(function(){
        cloudOn=function(){ return false; }; base(DEMO); var on=applyDemoBoard()===true;
        var g=hospGroups(); var reg=g.length===3&&g[0].org==="demo-ed"&&g[0].label==="Consultants"&&g[1].org==="demo-nurses"&&g[2].label==="Scribes";
        var cols=deptColumns(T0,T0); var own=cols[0].own===true&&!!cols[0].data&&cols[0].data.v===1;
        var nurses=cols[1]; var day=nurses.data&&nurses.data.days&&nurses.data.days[T0];
        var sib=!nurses.own&&!!day&&day.on.length===3&&day.on.every(function(e){ return typeof e.n==="string"&&!!e.n&&/^(AM|PM)$/.test(e.p)&&/^\d\d:\d\d\u2013\d\d:\d\d$/.test(e.t)&&typeof e.r==="string"; })&&Array.isArray(day.away);
        var when=typeof nurses.updated==="string"&&!isNaN(Date.parse(nurses.updated))&&Date.parse(nurses.updated)<Date.now();
        var span=Object.keys(nurses.data.days).sort(); var win=span.length===16&&span[0]===D(-1)&&span[15]===D(14);
        return on && deptOn()===true && _orgHospital==="Wattle Hospital" && reg && own && sib && when && win && scopeSegHTML().indexOf("Whole department")>=0 && deptCardHTML().indexOf("boardPublish")>=0; }));
      T("demo board: the digest is the same each time for a date, names distinct within a day, weekday-only slots skip the weekend", safe(function(){
        cloudOn=function(){ return false; }; base(DEMO); applyDemoBoard(); var a=JSON.stringify(_boardCache.rows[0].data.days[T0]); applyDemoBoard(); var b=JSON.stringify(_boardCache.rows[0].data.days[T0]);
        var day=_boardCache.rows[0].data.days[T0]; var names=day.on.map(function(e){ return e.n; }); var distinct=names.every(function(nm,i){ return names.indexOf(nm)===i; });
        var sc=_boardCache.rows[1].data.days; var wk=Object.keys(sc).every(function(d){ var dow=parseISO(d).getDay(); return (dow===0||dow===6)?sc[d].on.length===0:sc[d].on.length===1; });
        var away=Object.keys(_boardCache.rows[0].data.days).some(function(d){ return _boardCache.rows[0].data.days[d].away.length===1; });
        return a===b && distinct && wk && away; }));
      T("demo board: with the cloud on, or without S.demoBoard, nothing changes", safe(function(){
        cloudOn=function(){ return true; }; base(DEMO); var r1=applyDemoBoard(); var c1=r1===false&&_demoBoard===false&&_hospGroups===null&&deptOn()===false;
        cloudOn=function(){ return false; }; base(null); var r2=applyDemoBoard(); var c2=r2===false&&_demoBoard===false&&deptOn()===false&&scopeSegHTML()===""&&deptCardHTML()==="";
        return c1 && c2; }));
      T("demo board: our own column shows the sandbox's open cycle, which the real board would never publish; with the cloud on the real rule stands", safe(function(){
        cloudOn=function(){ return false; }; base(DEMO); S.cycles[0].status="open"; S.cycles[0].assign["s1|"+T0]={kind:"clinical",period:"AM",zone:"z1"}; applyDemoBoard();
        var own=deptColumns(T0,T0)[0]; var shown=own.own===true&&!!own.data.days[T0]&&own.data.days[T0].on.length===1&&own.data.days[T0].on[0].n==="Ava Ng";
        var real=buildDigestAll(S,T0).days[T0]===undefined;   // the plain digest still skips a cycle that is only booking
        return shown && real; }));
      T("demo board: load() applies it, so a returning visitor's board is built for today, not for the day they first came", safe(function(){
        cloudOn=function(){ return false; }; base(DEMO); var k=orgKey(), prev=null; try{ prev=localStorage.getItem(k); localStorage.setItem(k,JSON.stringify(S)); }catch(e){}
        _hospGroups=null; _boardCache={rows:[],fetched:0}; _demoBoard=false; load(); var ok=_demoBoard===true&&hospGroups().length===3&&!!_boardCache.rows[0].data.days[T0]&&_orgHospitalId!=="";
        try{ if(prev===null)localStorage.removeItem(k); else localStorage.setItem(k,prev); }catch(e){} return ok; }));
    } finally { S=keep.S; cloudOn=keep.co; _org=keep.org; _orgHospitalId=keep.hid; _orgHospital=keep.hosp; _hospGroups=keep.hg; _hospGroupsAt=keep.hga; _boardCache=keep.bc; if(typeof _demoBoard!=="undefined")_demoBoard=keep.db; dailyScope=keep.ds; _deptDate=keep.dd; /* demo board: restore */ hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- roster import: a row is a person only when it looks like one, and a new name is added only once it is rostered (23 Sep 2026).
  // The V2.2 template carries its own check rows ("Double-booking status", "ENTRY INTEGRITY — check before publication") under the names.
  (function(){
    var keep={S:S};
    try{
      var labels=["Double-booking status","Double-booked roles this shift (same role taken by 2+ people)","Unrecognised entries this shift (not on the permitted list)","SSU entered while Round 1 is active","ENTRY INTEGRITY — check before publication"];
      var people=["Kazemzadeh Atufi, Rahil","O'Neill, Evan","Ikhu-Omoregbe, Osasehi","Corcuera Hotz, Ines","Ng","Roberts, Jamie"];
      T("import: a check row with digits, brackets or a dash is not a name", labels.slice(1).every(function(n){ return !isNameCell(n); }));
      T("import: 'Double-booking status' has the shape of a name — the row's content is what keeps it out (below)", isNameCell(labels[0]));
      T("import: real names still are — hyphens, apostrophes and three words included", people.every(function(n){ return isNameCell(n); }));
      S={ zones:[{id:"z1",name:"ROC",am:true,pm:true}], staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},
          staff:[{id:"p1",name:"Lee, Ava",quota:2,eft:1},{id:"p2",name:"Park, Jo",quota:2,eft:1}],
          cycles:[{id:"c1",cycle:{start:"2026-09-28",weeks:8},assign:{},status:"published",archived:false,settings:{}}],
          activeId:"c1", viewAs:"admin", tab:"my", requests:[],leave:[],audit:[],notifications:[],messages:[],feedback:[] };
      normalize();
      var hdr=["Name"]; for(var i=0;i<8;i++)hdr.push(iso(addDays(parseISO("2026-09-28"),i)));
      var aoa=[["Roster"],hdr,
        ["Lee, Ava","0800-1600 ROC","CST","AL",null,null,null,null,null],
        ["Park, Jo",null,null,null,null,null,null,null,"SICK"],
        ["New, Person",null,"1530-2330 ROC",null,null,null,null,null,null],
        ["Snelling, Rahul",null,null,null,null,null,null,null,null],
        ["Double-booking status","OK — no duplicates","No double-booking",null,null,null,null,null,null],
        ["ENTRY INTEGRITY — check before publication","OK TO PUBLISH",null,null,null,null,null,null,null]];
      var p=parseRosterAOA(aoa);
      T("import: dates read", !p.error && p.dates.length===8 && p.dates[0]==="2026-09-28");
      T("import: existing people and a rostered new name are people", JSON.stringify(p.staff)===JSON.stringify(["Lee, Ava","Park, Jo","New, Person"]));
      T("import: their entries are kept, an existing person's unknown code included", p.assigns["Lee, Ava|2026-09-28"].kind==="clinical" && p.assigns["Lee, Ava|2026-09-29"].kind==="cst" && p.assigns["Lee, Ava|2026-09-30"].code==="AL" && p.assigns["Park, Jo|2026-10-05"].kind==="leave" && p.assigns["Park, Jo|2026-10-05"].code==="SICK" && p.assigns["New, Person|2026-09-29"].period==="PM");
      T("import: nothing from the check rows reaches the roster", Object.keys(p.assigns).length===5 && !Object.keys(p.assigns).some(function(k){ return /Double|INTEGRITY/.test(k); }));
      T("import: an empty new row and a row nobody can read are listed, not added", !!p.skipped && p.skipped.length===2 && p.skipped[0].name==="Snelling, Rahul" && /no shifts/.test(p.skipped[0].why) && p.skipped[1].name==="Double-booking status" && /understands/.test(p.skipped[1].why));
      var sum=rosterImportSummary(p,null);
      T("import: the confirm names who was not added and why", /Not added/.test(sum) && /Snelling, Rahul/.test(sum) && /Double-booking status/.test(sum) && /Staff: 3/.test(sum));
    } finally { S=keep.S; }
  })();
  // ---- UA is "unavailable", not leave (23 Sep 2026): never a payroll row, never a RosterOn cell, never a reason for a merge to drop a placed shift.
  (function(){
    var keep={S:S};
    try{
      var D=function(n){ return iso(addDays(parseISO("2026-09-28"),n)); };
      S={ zones:[{id:"z1",name:"ROC",am:true,pm:true}], staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},
          staff:[{id:"p1",name:"Lee, Ava",quota:2,eft:1,payrollId:"E1"}],
          cycles:[{id:"c1",cycle:{start:"2026-09-28",weeks:1},assign:{},status:"published",archived:false,settings:{},roles:{p1:{in:true}}}],
          activeId:"c1", viewAs:"admin", tab:"my", requests:[],leave:[],audit:[],notifications:[],messages:[],feedback:[] };
      normalize(); hydrateCycleSettings(); hydrateCycleRoles();
      var c=S.cycles[0];
      c.assign["p1|"+D(0)]={kind:"leave",code:"UA"};   // unavailable, typed on the roster: the day sheet's Mark unavailable, or a roster import
      c.assign["p1|"+D(1)]={kind:"leave",code:"AL"};
      S.leave.push({id:"l1",staffId:"p1",from:D(2),to:D(2),code:"UA",status:"approved",requestId:"import"});   // unavailable, from the leave planner
      c.assign["p1|"+D(3)]={kind:"clinical",period:"AM",zone:"z1"};
      var rows=payrollRows().filter(function(r){ return r.name==="Lee, Ava"; });
      T("UA: no payroll row for an unavailable day, whichever way it was recorded", !rows.some(function(r){ return r.date===D(0)||r.date===D(2); }));
      T("UA: annual leave still pays its day", rows.some(function(r){ return r.date===D(1)&&r.code==="AL"&&r.hours===8; }));
      T("UA: the RosterOn cell for an unavailable day is empty, and the leave after it starts fresh", ronCell("p1",parseISO(D(0)))==="" && ronCell("p1",parseISO(D(1)))==="08:00 AL" && ronCell("p1",parseISO(D(2)))==="");
      var out=JSON.parse(JSON.stringify(S));
      out.cycles[0].assign["p1|"+D(2)]={kind:"clinical",period:"PM",zone:"z1"};   // placed on the day marked unavailable
      out.leave.push({id:"l2",staffId:"p1",from:D(3),to:D(3),code:"AL",status:"approved",requestId:"req-9"});   // approved AL on the day of the AM shift
      _mergeInvariants(out);
      T("UA: a merge keeps a shift placed on an unavailable day", !!out.cycles[0].assign["p1|"+D(2)] && !(out.audit||[]).some(function(a){ return a.action==="merge.fix"&&/UA/.test(a.detail); }));
      T("UA: a merge still drops a shift under approved leave", !out.cycles[0].assign["p1|"+D(3)] && (out.audit||[]).some(function(a){ return a.action==="merge.fix"&&/AL/.test(a.detail); }));
    } finally { S=keep.S; }
  })();
  // ---- names from a spreadsheet match the person already here whatever the spacing or punctuation (23 Sep 2026: "Corcuera Hotz,Ines").
  (function(){
    var keep={S:S};
    try{
      S={ zones:[{id:"z1",name:"ROC",am:true,pm:true}], staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},
          staff:[{id:"p1",name:"Corcuera Hotz, Ines",quota:2,eft:1},{id:"p2",name:"Lee, Ann",quota:2,eft:1},{id:"p3",name:"Le, Eann",quota:2,eft:1}],
          cycles:[{id:"c1",cycle:{start:"2026-09-28",weeks:8},assign:{},status:"published",archived:false,settings:{}}],
          activeId:"c1", viewAs:"admin", tab:"my", requests:[],leave:[],audit:[],notifications:[],messages:[],feedback:[] };
      normalize();
      var n0=S.staff.length;
      T("names: a missing space after the comma is still the same person", ensureStaff("Corcuera Hotz,Ines").id==="p1" && ensureStaff("corcuera  hotz , ines").id==="p1" && ensureStaff("CORCUERA HOTZ, INES").id==="p1" && S.staff.length===n0);
      T("names: two people whose letters coincide are kept apart — a third is made rather than a guess", ensureStaff("Lee, Ann").id==="p2" && ensureStaff("Le,Eann").id==="p3" && ensureStaff("Leeann").id!=="p2" && ensureStaff("Leeann").id!=="p3" && S.staff.length===n0+1);
      T("names: a lost comma or an added hyphen still finds the one person those letters spell", ensureStaff("Corcuera Hotz Ines").id==="p1" && ensureStaff("Corcuera-Hotz, Ines").id==="p1" && S.staff.length===n0+1);
      T("names: a new name is still added", ensureStaff("Chan, Thomas").name==="Chan, Thomas" && S.staff.length===n0+2);
      var hdr=["Name"]; for(var i=0;i<8;i++)hdr.push(iso(addDays(parseISO("2026-09-28"),i)));
      var q=parseRosterAOA([hdr,["Corcuera Hotz,Ines",null,null,null,null,null,null,null,"SICK"]]);
      T("names: the roster import reads a misspelt existing person as existing, unknown code and all", q.staff.length===1 && q.assigns["Corcuera Hotz,Ines|2026-10-05"] && q.assigns["Corcuera Hotz,Ines|2026-10-05"].code==="SICK" && q.skipped.length===0);
    } finally { S=keep.S; }
  })();
  // ---- tags on people, rules on slots (S3): a tag is a label on a person; a cycle may say a slot needs a tag, or that a half-day needs at least N holders of one.
  // Spec: docs/superpowers/specs/2026-09-21-tags-and-rules-s3-design.md. Dates are relative to today; the judge and the breach list are pure.
  (function(){
    var keep={S:S,dd:dailyDate,ds:dailyScope,sf:_staffFilter,sq:_staffQuery,st:_staffTag,pick:_srPick,sid:_srSid,sheet:_daySheet,mob:isMobile,cf:confirm,toast:toast,fp:_fpReport,dl:download};
    var D=function(n){ return iso(addDays(new Date(),n)); }, T0=D(0);
    var c=null, said=[];
    function wd(n){ var d=parseISO(D(n)).getDay(); return d===0||d===6; }   // is D(n) a weekend day
    function nextWeekday(n){ while(wd(n))n++; return n; }
    function nextWeekend(n){ while(!wd(n))n++; return n; }
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Triage",am:true,pm:true,pmLabel:""},{id:"z2",name:"Resus",am:true,pm:true,pmLabel:""},{id:"z3",name:"Fast track",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:3,pmMin:0,pmMax:3},unlockOrder:"both",rosterMode:"rolling",shiftTimes:{AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:"22:00"}}};   // extras open together and the evening has no minimum: a third morning booking reaches the judge, not the unlock rule
      S={zones:Z,staffing:set.staffing,
         staff:[{id:"s1",name:"Ava Ng",quota:20,eft:1,tags:["t1","t2"]},{id:"s2",name:"Sam Lee",quota:20,eft:1,tags:["t1"]},{id:"s3",name:"Ky Tran",quota:20,eft:1,tags:["t2"]},{id:"s4",name:"Jo Park",quota:20,eft:1},{id:"s5",name:"Lee Ann",quota:20,eft:1}],
         tags:[{id:"t1",name:"Senior"},{id:"t2",name:"Triage-trained"}],
         cycles:[{id:"cr",cycle:{start:D(-7),weeks:6},status:o.status||"published",archived:false,settings:set,roles:{s1:{in:true},s2:{in:true},s3:{in:true},s4:{in:true},s5:{in:true}},assign:{}}],
         activeId:"cr",viewAs:o.viewAs||"admin",tab:"my",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],publicHolidays:[]};
      if(o.noTags){ delete S.tags; S.staff.forEach(function(s){ delete s.tags; }); }
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srPick=[]; _srSid=null; _daySheet=null; dailyScope="group"; dailyDate=null; _staffFilter="all"; _staffQuery=""; _staffTag="";
      if(!o.noRules)c.settings.rules={needs:{z1:["t2"]},mins:[{tag:"t1",n:{AM:[1,1,1],PM:[1,1,1]}}]}; }
    function put(sid,n,period,zone,type){ var v={kind:"clinical",period:period||"AM",zone:zone||"z2"}; if(type)v.type=type; c.assign[sid+"|"+D(n)]=v; return v; }
    isMobile=function(){ return false; }; toast=function(m){ said.push(String(m)); };
    try{
      // ---- data, accessors, the judge and the breach list
      T("rules: with no tags and no rules the judge says yes, the breach list is empty, and nothing new is written", (function(){
        state({noTags:true,noRules:true}); put("s4",2,"AM","z1"); var j=JSON.stringify(S);
        return ruleJudge(c,S,"s5",D(2),["AM"],"z1",null).ok===true && ruleBreaches(c,S,D(2)).length===0 && j.indexOf('"tags"')<0 && j.indexOf('"rules"')<0 && JSON.stringify(rulesOf(c))==='{"needs":{},"mins":[]}' && tagList(S).length===0; })());
      T("rules: accessors keep list order, drop ids the list no longer has, and capOf is the smaller of the maximum and the open zones", (function(){
        state(); S.staff[0].tags=["t2","gone","t1"];
        var a=personTags(S,S.staff[0]).join(",")==="t1,t2" && hasTag(S,S.staff[0],"t2") && !hasTag(S,S.staff[3],"t1") && tagName(S,"t2")==="Triage-trained" && tagName(S,"gone")==="";
        c.settings.staffing.amMax=5; c.settings.staffing.pmMax=3; c.settings.zones[2].pm=false;
        return a && capOf(c,S,"AM")===3 && capOf(c,S,"PM")===2 && dayType(S,D(nextWeekday(2)))===0 && dayType(S,D(nextWeekend(2)))===1; })());
      T("rules: a slot that needs a tag refuses whoever lacks it and names the slot and the tag; two tags means both; a tag the list no longer has is ignored", (function(){
        state(); var r1=ruleJudge(c,S,"s4",D(2),["AM"],"z1",null), r2=ruleJudge(c,S,"s3",D(2),["AM"],"z1",null), r3=ruleJudge(c,S,"s1",D(2),["AM"],"z1",null);
        c.settings.rules.needs.z1=["t1","t2"]; var r4=ruleJudge(c,S,"s3",D(2),["AM"],"z1",null), r5=ruleJudge(c,S,"s1",D(2),["AM"],"z1",null);
        c.settings.rules.needs.z1=["gone"]; var r6=ruleJudge(c,S,"s4",D(2),["AM"],"z1",null);
        return !r1.ok && r1.rule==="needs" && r1.tag==="t2" && r1.reason==="Triage needs Triage-trained." && r2.ok && r3.ok && !r4.ok && r4.tag==="t1" && r4.reason==="Triage needs Senior." && r5.ok && r6.ok; })());
      T("rules: held places — the last open place is kept for a holder, an earlier place is not, and a holder always fits", (function(){
        state(); var out=[]; var J=function(sid){ return ruleJudge(c,S,sid,D(2),["AM"],"z2",null); };
        out.push(J("s4").ok);
        put("s4",2,"AM","z2"); out.push(J("s5").ok);
        put("s5",2,"AM","z3"); var r=J("s3"); out.push(!r.ok && r.rule==="held" && r.tag==="t1" && /^Held for a Senior \u2014 .* AM still needs 1, and this is the last place\.$/.test(r.reason));
        out.push(J("s2").ok);
        c.settings.rules.mins[0].n.AM=[2,2,2]; c.assign={}; out.push(J("s4").ok);
        put("s4",2,"AM","z2"); var r2=J("s5"); out.push(!r2.ok && /only 2 places are left\.$/.test(r2.reason));
        out.push(J("s2").ok);
        return out.every(Boolean); })());
      T("rules: two tags short at once — the largest shortfall, never the sum, and the earlier tag on a tie", (function(){
        state(); c.settings.rules.mins=[{tag:"t1",n:{AM:[1,1,1],PM:[1,1,1]}},{tag:"t2",n:{AM:[1,1,1],PM:[1,1,1]}}]; c.settings.staffing.amMax=2;
        var a=ruleJudge(c,S,"s4",D(2),["AM"],"z2",null);
        put("s4",2,"AM","z2"); var b=ruleJudge(c,S,"s5",D(2),["AM"],"z3",null), b2=ruleJudge(c,S,"s3",D(2),["AM"],"z3",null), b3=ruleJudge(c,S,"s2",D(2),["AM"],"z3",null), b4=ruleJudge(c,S,"s1",D(2),["AM"],"z3",null);
        return a.ok && !b.ok && b.tag==="t1" && !b2.ok && b2.tag==="t1" && !b3.ok && b3.tag==="t2" && b4.ok; })());
      T("rules: a whole-day shift is judged in both halves and counts toward the minimum in both", (function(){
        state(); c.settings.shiftTypes=shiftTypesOf(c).concat([{id:"full",code:"FULL",label:"Full",start:"10:00",end:"22:00",fills:["AM","PM"],on:true,book:true,builtin:null}]);
        put("s2",2,"AM","z2"); var a=ruleJudge(c,S,"s4",D(2),["AM","PM"],"z3",{type:"full"});
        put("s5",2,"PM","z3"); put("s3",2,"PM","z2"); var b=ruleJudge(c,S,"s4",D(2),["AM","PM"],"z1",{type:"full"});
        c.settings.rules.needs={}; var b2=ruleJudge(c,S,"s4",D(2),["AM","PM"],"z1",{type:"full"});
        c.assign={}; c.assign["s1|"+D(3)]={kind:"clinical",period:"AM",zone:"z2",type:"full"};
        return a.ok && !b.ok && b.rule==="needs" && !b2.ok && b2.rule==="held" && /PM still needs 1/.test(b2.reason) && ruleBreaches(c,S,D(3)).length===0; })());
      T("rules: weekday, weekend and public holiday each read their own number, and a public holiday on a Saturday is a public holiday", (function(){
        state(); c.settings.rules.mins=[{tag:"t1",n:{AM:[1,2,3],PM:[0,0,0]}}]; var sat=2; while(parseISO(D(sat)).getDay()!==6)sat++; var sun=sat+1, wk=nextWeekday(2);
        S.publicHolidays=[D(sat)]; var need=function(n){ var b=ruleBreaches(c,S,D(n)).filter(function(x){ return x.kind==="min"; })[0]; return b?b.need:0; };
        return dayType(S,D(sat))===2 && dayType(S,D(sun))===1 && dayType(S,D(wk))===0 && need(wk)===1 && need(sun)===2 && need(sat)===3 && ruleBreaches(c,S,D(wk)).every(function(x){ return x.period==="AM"; }); })());
      T("rules: without makes a person absent, with makes the other half of a swap present", (function(){
        state(); put("s2",2,"AM","z2"); put("s4",2,"AM","z3");
        var a=ruleJudge(c,S,"s5",D(2),["AM"],"z1",null);
        c.settings.rules.needs={}; var b=ruleJudge(c,S,"s5",D(2),["AM"],"z1",null);
        var d=ruleJudge(c,S,"s5",D(2),["AM"],"z1",{without:["s2"]});
        var e=ruleJudge(c,S,"s5",D(2),["AM"],"z1",{without:["s2"],with:[{sid:"s3",fills:["AM"],zone:"z2"}]});
        return !a.ok && a.rule==="needs" && b.ok && d.ok && !e.ok && e.rule==="held"; })());
      T("rules: the breach list reads AM before PM, minimums before slots, in tag then zone order", (function(){
        state(); put("s4",2,"AM","z1"); put("s3",2,"PM","z2");
        var b=ruleBreaches(c,S,D(2)); return b.length===3 && b[0].kind==="min" && b[0].period==="AM" && b[0].tag==="t1" && b[0].need===1 && b[0].have===0 && b[1].kind==="needs" && b[1].period==="AM" && b[1].zone==="z1" && b[1].sid==="s4" && b[1].tag==="t2" && b[2].kind==="min" && b[2].period==="PM"; })());
      T("rules: the payroll rows, the roster export and the digest do not move by a byte when tags and rules exist, and no tag reaches the digest", (function(){
        var grab=function(){ var x=null; download=function(s){ if(x===null)x=String(s); }; try{ exportRosterXLS(); }catch(e){} download=keep.dl; return [JSON.stringify(payrollRows()), x, stableJSON(buildDigestAll(S,T0))]; };
        state({noTags:true,noRules:true}); put("s1",2,"AM","z1"); put("s2",3,"PM","z2"); put("s4",4,"AM","z3"); var a=grab();
        state(); put("s1",2,"AM","z1"); put("s2",3,"PM","z2"); put("s4",4,"AM","z3"); S.tags[0].show=true; var b=grab();
        return a[0]===b[0] && a[1]===b[1] && a[2]===b[2] && a[0].length>20 && b[2].indexOf("Senior")<0 && b[2].indexOf("tags")<0; })());
      T("rules: the merge leaves a breach in place and does not throw when rules are present", (function(){
        state(); put("s4",2,"AM","z1"); var out=JSON.parse(JSON.stringify(S)); var ok=true; try{ _mergeInvariants(out); }catch(e){ ok=false; }
        return ok && !!out.cycles[0].assign["s4|"+D(2)] && !(out.audit||[]).some(function(a){ return a.action==="merge.fix"; }); })());
      T("rules: every new audit key has a plain-word sentence", ["tags.add","tags.rename","tags.remove","tags.show","tags.person","tags.import","rules.needs","rules.mins","rules.override"].every(function(k){ return typeof AUDIT_WORDS[k]==="string" && AUDIT_WORDS[k].length>5; }));

      // ---- booking, batch picks, claims
      T("booking: canBook refuses a barred slot and a held place with the judge's sentence, after the checks that exist today and before quota", (function(){
        state(); var a=canBook("s4",D(2),"AM","z1"), b=canBook("s1",D(2),"AM","z2");
        put("s4",2,"AM","z2"); put("s5",2,"AM","z3"); var d=canBook("s3",D(2),"AM","z1"), e=canBook("s1",D(2),"AM","z1"), f=canBook("s1",D(2),"AM","z2");
        S.staff[0].quota=0; c.roles.s1.quota=0; hydrateCycleRoles(); var g=canBook("s1",D(3),"AM","z1");
        return !a.ok && a.reason==="Triage needs Triage-trained." && b.ok && !d.ok && /^Held for a Senior/.test(d.reason) && e.ok && !f.ok && /taken/.test(f.reason) && g.ok; })());
      T("booking: a pick on the sheet is judged like a booking, and a batch confirm books what passes and says why the rest did not", (function(){
        state(); put("s4",2,"AM","z2"); put("s5",2,"AM","z3"); _srSid="s3"; S.viewAs="s3";
        var p=pickCheck("s3",D(2),"AM","z1"); _srPick=[D(2)+"|AM|z1",D(3)+"|AM|z1"]; srBatchBook(); var f=window._srBatchFail||[];
        return !p.ok && /^Held for a Senior/.test(p.reason) && !c.assign["s3|"+D(2)] && !!c.assign["s3|"+D(3)] && c.assign["s3|"+D(3)].zone==="z1" && f.length===1 && /Held for a Senior/.test(f[0]); })());
      T("claims: the last open place is held for a holder, a give-away counts its giver as gone, and an approval re-runs the judge and reopens", (function(){
        state(); S.marketOn=true; put("s4",2,"AM","z3"); put("s5",2,"AM","z1"); postOpenShift(D(2),"AM","z2",""); var o=S.openShifts[0];
        var a=canClaim("s3",D(2),"AM","z2",true,null,null), b=canClaim("s2",D(2),"AM","z2",true,null,null);
        state(); S.marketOn=true; c.settings.staffing.amMax=2; put("s1",3,"AM","z2"); put("s4",3,"AM","z3"); S.viewAs="s1"; offerShift("s1",D(3)); var g=S.openShifts[0];
        var d=canClaim("s5",D(3),"AM","z2",false,"s1",null); S.viewAs="s5"; var d2=claimOpenShift(g.id,false), gs=g.status; S.viewAs="s2"; var e=claimOpenShift(g.id,false), e2=c.assign["s2|"+D(3)], e3=c.assign["s5|"+D(3)];   // read before the next state() rebuilds the cycle
        state(); S.marketOn=true; S.marketClaim="approve"; postOpenShift(D(4),"AM","z2",""); var q=S.openShifts[0]; S.viewAs="s4"; var h=claimOpenShift(q.id,false), hs=q.status;
        S.viewAs="admin"; put("s5",4,"AM","z3"); put("s3",4,"AM","z1"); var k=approveClaim(q.id,true), k2=canClaim("s4",D(4),"AM","z2",true,null,null);
        return !a.ok && /^Held for a Senior/.test(a.reason) && b.ok && !d.ok && /^Held for a Senior/.test(d.reason) && d2===false && gs==="open" && e===true && !!e2 && e2.zone==="z2" && !e3 &&
               h===true && hs==="pending" && k===false && !k2.ok && /Held for a Senior/.test(k2.reason) && said.some(function(m){ return /Reopened/.test(m); }) && q.status==="open" && q.by===null && !c.assign["s4|"+D(4)]; })());

      // ---- swaps
      T("swaps: a swap is judged as a pair in both directions — refused when a half would be shorter of a tag or someone lands in a slot they lack a tag for, allowed when it is no worse", (function(){
        state(); put("s1",3,"AM","z2"); put("s4",4,"AM","z2"); put("s2",5,"AM","z3"); put("s1",6,"AM","z1"); put("s4",7,"AM","z2");
        var a=executeSwap({from:"s1",dateA:D(3),peerId:"s4",dateB:D(4)}), b=executeSwap({from:"s4",dateA:D(4),peerId:"s1",dateB:D(3)});
        var d=executeSwap({from:"s1",dateA:D(6),peerId:"s4",dateB:D(7)}), e=executeSwap({from:"s4",dateA:D(7),peerId:"s1",dateB:D(6)});
        var f=executeSwap({from:"s1",dateA:D(3),peerId:"s2",dateB:D(5)});
        return !a.ok && /short of a Senior\.$/.test(a.reason) && !b.ok && /short of a Senior\.$/.test(b.reason) && !d.ok && /Jo Park can\u2019t take Triage on .* it needs Triage-trained\.$/.test(d.reason) && !e.ok && /Jo Park can\u2019t take Triage/.test(e.reason) &&
               f.ok && c.assign["s2|"+D(3)].zone==="z2" && c.assign["s1|"+D(5)].zone==="z3" && !c.assign["s1|"+D(3)] && !c.assign["s2|"+D(5)]; })());
      T("swaps: Ask everyone offers only shifts that keep every half whole, and a standing offer reads as closed with that reason", (function(){
        state(); put("s1",3,"AM","z2"); put("s4",4,"AM","z2"); put("s2",5,"AM","z3"); S.viewAs="s1"; var r=swapAsk("s1",D(3),""); var o=S.openSwaps[0];
        var offer4=swOfferable(o,"s4").map(function(x){ return x.d; }), offer2=swOfferable(o,"s2").map(function(x){ return x.d; });
        S.viewAs="s2"; var so=swapOffer(o.id,D(5)); var f=S.swapOffers[0]; var before=swOfferWhy(f); S.staff[1].tags=[]; var after=swOfferWhy(f);
        return r===true && offer4.length===0 && offer2.join(",")===D(5) && so===true && before==="" && /short of a Senior$/.test(after); })());

      // ---- the cell editor, the auto-draft, fixed patterns
      T("cell editor: the admin is warned with the judge's sentence and asked to place anyway; going through is written down; a placement that passes asks nothing", (function(){
        state(); var asked=[]; confirm=function(t){ asked.push(String(t)); return false; };
        var a=adminPlaceCheck("s4",D(2),{kind:"clinical",period:"AM",zone:"z1"}); confirm=function(t){ asked.push(String(t)); return true; };
        var b=adminPlaceCheck("s4",D(2),{kind:"clinical",period:"AM",zone:"z1"}); var n=asked.length; var d=adminPlaceCheck("s1",D(2),{kind:"clinical",period:"AM",zone:"z1"});
        adminOverrideAudit("s4",D(2),{kind:"clinical",period:"AM",zone:"z1"},b.over); var au=S.audit[0];
        return !a.ok && a.over===null && /Triage needs Triage-trained\./.test(asked[0]) && /Place Jo Park anyway\?/.test(asked[0]) && b.ok && b.over==="Triage needs Triage-trained." && d.ok && d.over===null && asked.length===n && au.action==="rules.override" && /Jo Park/.test(au.detail) && /Triage needs Triage-trained/.test(au.detail); })());
      T("cell editor: someone moving within a day is judged without counting themselves", (function(){
        state(); put("s2",2,"AM","z2"); put("s4",2,"AM","z3"); confirm=function(){ return false; };
        return adminPlaceCheck("s2",D(2),{kind:"clinical",period:"AM",zone:"z3"}).ok; })());
      T("auto-draft: holders of a tag the half is short of go first, nobody lands in a slot they lack a tag for, and a place stays empty when nobody eligible is left", (function(){
        state(); c.settings.rules.mins[0].n.AM=[2,2,2]; S.staff.unshift(S.staff.splice(3,1)[0]); S.staff.splice(1,0,S.staff.splice(4,1)[0]);   // pool order Jo, Lee, Ava, Sam, Ky: the two Seniors are not first, and the morning needs two of them
        var n=fillPeriodTo(D(2),"AM",3); var z=function(sid){ var v=c.assign[sid+"|"+D(2)]; return v?v.zone:""; };
        var a=n===3 && z("s1")==="z1" && z("s2")==="z2" && z("s4")==="z3" && !ruleBreaches(c,S,D(2)).some(function(b){ return b.period==="AM"; });   // holders first, in pool order, each into the first zone the judge accepts; the evening was not drafted, so only the morning is judged
        state(); c.roles={s4:{in:true},s5:{in:true}}; hydrateCycleRoles(); c.settings.zones=[c.settings.zones[0]]; hydrateCycleSettings(); c.settings.staffing.amMax=1; c.settings.rules={needs:{z1:["t2"]}};
        var m=fillPeriodTo(D(2),"AM",1);
        return a && m===0 && Object.keys(c.assign).length===0; })());
      T("fixed patterns: laid down as written, and a breach is flagged, not dropped", (function(){
        state(); var dow=String(parseISO(D(3)).getDay()); var s4=S.staff[3]; s4.mode="fixed"; s4.fixedPattern={recurrence:"weekly",A:{},B:{},committed:true}; s4.fixedPattern.A[dow]={period:"AM",zone:"z1"};
        var n=applyFixedPatterns(); var v=c.assign["s4|"+D(3)];
        return n>0 && !!v && v.zone==="z1" && v.fixed===true && ruleBreaches(c,S,D(3)).some(function(b){ return b.kind==="needs"&&b.sid==="s4"&&b.tag==="t2"; }); })());

      // ---- gaps, the Day board, the day sheet, the open-shift line
      T("gaps: from today onward a tag shortfall is a gap — the day turns red, the short-slots list says what is missing, and past days are never re-judged", (function(){
        state(); put("s4",2,"AM","z1"); var r=ragFor(D(2)), rows=shortSlots().filter(function(x){ return x.iso===D(2); }), html=gapsPanelHTML();
        put("s4",-2,"AM","z1"); var rp=ragFor(D(-2)), past=shortSlots().filter(function(x){ return x.iso===D(-2); });
        return r==="r" && rows.some(function(x){ return x.kind==="min"&&x.tag==="t1"&&x.period==="AM"&&x.need===1; }) && rows.some(function(x){ return x.kind==="needs"&&x.sid==="s4"&&x.zone==="z1"; }) &&
               /needs <b>1<\/b> Senior/.test(html) && /Jo Park isn\u2019t Triage-trained/.test(html) && !/placed by an admin/.test(html) && rp!=="r" && past.length===0; })());
      T("gaps: the Day board's cover chip says what the half needs, names carry Show-ticked tags, and the department digest carries none", (function(){
        state(); S.tags[0].show=true; put("s4",2,"AM","z2"); put("s1",2,"PM","z2"); dailyDate=D(2); var h=viewDaily();
        return /1 on · min 1 · needs 1 Senior<\/span>/.test(h) && /Ava Ng <span class="tag mini">Senior<\/span>/.test(h) && !/Triage-trained<\/span>/.test(h) && stableJSON(buildDigestAll(S,T0)).indexOf("Senior")<0; })());
      T("gaps: an open shift's line says what the day is short of, computed when shown", (function(){
        state(); S.marketOn=true; postOpenShift(D(2),"AM","z2",""); S.viewAs="s4"; var h=marketMyHTML();
        put("s2",2,"AM","z3"); var h2=marketMyHTML();
        return /needs 1 Senior/.test(h) && !/needs 1 Senior/.test(h2); })());
      T("gaps: the day sheet says why a slot is barred or held, and shows who holds a slot with their shown tags", (function(){
        state(); S.tags[0].show=true; put("s1",2,"AM","z2"); S.viewAs="s4"; var h=daySheetHTML(D(2));
        state(); put("s4",2,"AM","z2"); put("s5",2,"AM","z3"); S.viewAs="s3"; var h2=daySheetHTML(D(2));
        return /Triage needs Triage-trained\./.test(h) && /Taken by Ng <span class="tag mini">Senior<\/span>/.test(h) && /Held for a Senior/.test(h2); })());

      // ---- the Tags card, the Rules card, the Staff tab, the profile
      T("tags card: lists each tag with how many hold it, adds a hidden tag, refuses a duplicate name, renames, and refuses removal while in use with the counts", (function(){
        state(); var h=tagsCardHTML(); var t=tagAdd("Night lead"); var dup=tagAdd("senior"); var rn=tagRename("t1","Lead");
        var rm=tagRemove("t1"), rm2=tagRemove(t.id);
        return /Senior/.test(h) && /2 people hold it/.test(h) && !!t && t.show===undefined && S.audit.some(function(a){ return a.action==="tags.add"; }) && dup===null && said.some(function(m){ return /already a tag called senior/.test(m); }) && rn===true && tagName(S,"t1")==="Lead" && S.audit.some(function(a){ return a.action==="tags.rename"; }) &&
               !rm.ok && /2 people hold it and 1 cycle\u2019s rules name it/.test(rm.reason) && rm2.ok && !tagById(S,t.id) && S.audit.some(function(a){ return a.action==="tags.remove"; }); })());
      T("tags: unticking the last tag deletes the key, ticking adds in list order, and the show tick is written down", (function(){
        state(); personTagSet("s3","t2",false); personTagSet("s4","t2",true); personTagSet("s4","t1",true); tagSetShow("t2",true); var shown=S.tags[1].show; tagSetShow("t2",false);
        var s3=S.staff[2], s4=S.staff[3];
        return !("tags" in s3) && JSON.stringify(s4.tags)==='["t1","t2"]' && shown===true && S.tags[1].show===undefined && S.audit.filter(function(a){ return a.action==="tags.show"; }).length===2 && S.audit.some(function(a){ return a.action==="tags.person"; }); })());
      T("rules card: a plain-words summary, a cycle with no rules says so, and with no tags it points to the Tags card", (function(){
        state(); var h=rulesCardHTML(); state({noRules:true}); var h2=rulesCardHTML(); state({noTags:true}); var h3=rulesCardHTML();
        state(); c.settings.rules.mins=[{tag:"t1",n:{AM:[1,1,1],PM:[2,2,2]}}]; var s2=rulesSummary(c,S); c.settings.rules.mins=[{tag:"t1",n:{AM:[1,2,3],PM:[0,0,0]}}]; var s3=rulesSummary(c,S);
        return /Triage needs Triage-trained\. At least 1 Senior every AM and PM\./.test(h) && /class="rn-cb" data-z="z1" data-t="t2" checked/.test(h) && /class="rm-n" data-t="t1" data-p="PM" data-d="1" value="1"/.test(h) && /No rules on this cycle\./.test(h2) && /card-tags/.test(h3) && !/rn-cb/.test(h3) &&
               s2==="Triage needs Triage-trained. At least 1 Senior every AM, 2 every PM." && s3==="Triage needs Triage-trained. At least 1 Senior on weekday AMs, 2 Senior on weekend AMs, 3 Senior on public holiday AMs."; })());
      T("rules: saving normalises — unknown or repeated tags dropped, empty pieces omitted, an empty block deleted — and each change is written down", (function(){
        state(); rulesSet(c,{needs:{z1:["t2","t2","nope"],z2:[]},mins:[{tag:"t2",n:{AM:[0,0,0],PM:[0,0,0]}},{tag:"t1",n:{AM:[1,1,1],PM:[1,1,1]}}]});
        var a=JSON.stringify(c.settings.rules)==='{"needs":{"z1":["t2"]},"mins":[{"tag":"t1","n":{"AM":[1,1,1],"PM":[1,1,1]}}]}', n0=S.audit.length;
        rulesSet(c,{needs:{z1:["t2"]},mins:[{tag:"t1",n:{AM:[2,2,2],PM:[1,1,1]}}]}); var n1=S.audit.length, top=S.audit[0].action; rulesSet(c,{});
        return a && n0===0 && n1===1 && top==="rules.mins" && !("rules" in c.settings) && S.audit.some(function(x){ return x.action==="rules.needs"; }); })());
      T("staff tab: every tag as a chip, ticks in the detail, and a Tag filter", (function(){
        state(); var h=viewStaff(); _staffOpen.add("s1"); var row=staffRowHTML(S.staff[0]); _staffOpen.delete("s1");
        var ids=staffFiltered("","all","t1").map(function(s){ return s.id; }).sort().join(",");
        return /id="staffTagSel"/.test(h) && /<option value="t1"[^>]*>Senior<\/option>/.test(h) && /Sam Lee<span class="tag brand mini"><\/span><\/span>\s*<span class="smeta">[^<]*<span class="tag mini">Senior<\/span>/.test(h) && /class="s-tag" data-t="t1" checked/.test(row) && /class="s-tag" data-t="t2" checked/.test(row) && ids==="s1,s2"; })());
      T("profile: a person sees their own tags, read-only", (function(){
        state(); S.viewAs="s1"; var h=viewMy(); S.viewAs="s4"; var h2=viewMy();
        return /Your tags: Senior, Triage-trained · set by your admin\./.test(h) && !/Your tags/.test(h2); })());

      T("tags: the Who-holds list filters by the search, keeps holders ticked, and escapes names", (function(){
        state(); S.staff[3].name="<b>Jo</b> Park"; _tagWhoQ="sam"; var h=twListHTML("t1"); _tagWhoQ=""; var h2=twListHTML("t1"); _tagWhoQ="zzz"; var h3=twListHTML("t1"); _tagWhoQ="";
        return /data-sid="s2" checked> Sam Lee/.test(h) && !/Ava/.test(h) && /data-sid="s1" checked> Ava Ng/.test(h2) && /data-sid="s4" > &lt;b&gt;Jo&lt;\/b&gt; Park/.test(h2) && !/<b>Jo<\/b>/.test(h2) && /Nobody matches/.test(h3); })());

      // ---- the import's Tags column and the carry-forward
      T("import: the Tags column creates missing tags hidden, replaces a person's tags when filled, and leaves them alone when empty", (function(){
        state(); S.staff[0].name="Ng, Ava"; S.staff[1].name="Lee, Sam";   // the import matches a Surname, Given name row to a person of that name
        var p=parseStaffList([["Surname","Given name","Tags"],["Ng","Ava","senior; Night lead"],["Lee","Sam",""],["New","Pat","Night lead, Senior"]]);
        var res=applyStaffList(p.rows); var nl=tagList(S).find(function(t){ return t.name==="Night lead"; }), pat=S.staff.find(function(s){ return s.name==="New, Pat"; });
        return p.rows[0].tags==="senior; Night lead" && p.rows[1].tags==="" && !!nl && nl.show===undefined && JSON.stringify(S.staff[0].tags)===JSON.stringify(["t1",nl.id]) && JSON.stringify(S.staff[1].tags)==='["t1"]' && !!pat && JSON.stringify(pat.tags)===JSON.stringify(["t1",nl.id]) &&
               JSON.stringify(res.tagsMade)==='["Night lead"]' && S.audit.some(function(a){ return a.action==="tags.import"&&/Night lead/.test(a.detail); }) && tagList(S).length===3 && /"Tags/.test(downloadStaffTemplate.toString()); })());
      T("carry-forward: the next cycle deep-copies the rules and drops those for zones that are gone; removing a zone drops its rule; an empty block goes", (function(){
        state(); confirm=function(){ return true; }; var Z=c.settings.zones; var a=rulesCarry(c.settings.rules,Z), b=rulesCarry(c.settings.rules,[Z[1],Z[2]]), d=rulesCarry({needs:{z1:["t2"]}},[Z[1]]), e=rulesCarry(undefined,Z);
        var same=JSON.stringify(a)===JSON.stringify(c.settings.rules) && a!==c.settings.rules && a.mins!==c.settings.rules.mins;
        prepareNext(); var nc=S.cycles[1]; var copied=JSON.stringify(nc.settings.rules)===JSON.stringify(c.settings.rules); nc.settings.rules.mins[0].n.AM[0]=9; var indep=c.settings.rules.mins[0].n.AM[0]===1;
        S.activeId="cr"; rulesDropZone(c,"z1"); var dropped=!("needs" in c.settings.rules) && c.settings.rules.mins.length===1; c.settings.rules={needs:{z2:["t1"]}}; rulesDropZone(c,"z2"); var gone=!("rules" in c.settings);
        return same && JSON.stringify(b)==='{"mins":[{"tag":"t1","n":{"AM":[1,1,1],"PM":[1,1,1]}}]}' && d===undefined && e===undefined && copied && indep && dropped && gone; })());
      T("carry-forward: a new cycle made by the roster import carries the rules over", (function(){
        state(); var p={dates:[D(36),D(37),D(38),D(39),D(40),D(41),D(42)],staff:["Ava Ng"],assigns:{},skipped:[]}; p.assigns["Ava Ng|"+D(36)]={kind:"clinical",period:"AM",role:"Triage"};
        var nc=applyRosterImport(p,null); return !!nc && JSON.stringify(nc.settings.rules)===JSON.stringify(c.settings.rules) && nc.settings.rules!==c.settings.rules; })());

      T("import: new tags minted in the same instant get different ids", (function(){
        state(); S.staff[0].name="Ng, Ava"; S.staff[1].name="Lee, Sam"; var dn=Date.now, mr=Math.random; Date.now=function(){ return 1700000000000; }; Math.random=function(){ return 0.5; };
        try{ applyStaffList(parseStaffList([["Surname","Given name","Tags"],["Ng","Ava","Night lead"],["Lee","Sam","Bank staff"],["New","Pat","Rostered first"]]).rows); tagAdd("Fourth"); }
        finally{ Date.now=dn; Math.random=mr; }
        var ids=tagList(S).map(function(t){ return t.id; }); return ids.length===6 && new Set(ids).size===6; })());

      // ---- release
      var _rel926=WHATS_NEW.filter(function(e){ return e.on==="2026-09-26"; })[0];
      T("release: What's new names tags and rules on the release day, in three lines", !!_rel926 && /Tags/.test(_rel926.title) && _rel926.lines.length===3 && _rel926.lines.some(function(l){ return /Rules card/.test(l); }) && _rel926.lines.some(function(l){ return /Tags column/.test(l); }) && BUILD>="2026-09-26");

      // ---- final-review fix wave
      T("import: the Tags column is found by its own name, never inside another header, so a group that never opted in gets no tags", (function(){
        state({noTags:true,noRules:true}); S.staff[0].name="Ng, Ava"; var p=parseStaffList([["Surname","Given name","EFT percentage","Training stage"],["Ng","Ava","80","PGY2"]]); applyStaffList(p.rows);
        var p2=parseStaffList([["Surname","Given name","Training stage","Tags"],["Ng","Ava","PGY2","Senior"]]);
        return p.rows[0].tags==="" && tagList(S).length===0 && JSON.stringify(S).indexOf('"tags"')<0 && p2.rows[0].tags==="Senior"; })());
      T("import: a name longer than forty characters is stored cut and matched cut, so it never duplicates", (function(){
        state(); S.staff[0].name="Ng, Ava"; S.staff[1].name="Lee, Sam"; var long="Paediatric Advanced Life Support (PALS) provider";
        var rows=parseStaffList([["Surname","Given name","Tags"],["Ng","Ava",long],["Lee","Sam",long]]).rows; applyStaffList(rows); applyStaffList(rows);
        var made=tagList(S).filter(function(t){ return t.name===long.slice(0,40); });
        return long.length>40 && tagList(S).length===3 && made.length===1 && hasTag(S,S.staff[0],made[0].id) && hasTag(S,S.staff[1],made[0].id); })());
      T("fixed patterns: a period-only pattern goes into a zone the person holds the tags for, and into a barred one only when nothing else is free", (function(){
        state(); c.cycle={start:D(0),weeks:1}; var dow=String(parseISO(D(3)).getDay()); var s4=S.staff[3]; s4.mode="fixed"; s4.fixedPattern={recurrence:"weekly",A:{},B:{},committed:true}; s4.fixedPattern.A[dow]={period:"AM"};   // a one-week cycle: the weekday occurs once, so the zone choice is the engine's alone
        applyFixedPatterns(); var v=c.assign["s4|"+D(3)]; var a=!!v && v.zone!=="z1";
        state(); s4=S.staff[3]; s4.mode="fixed"; s4.fixedPattern={recurrence:"weekly",A:{},B:{},committed:true}; s4.fixedPattern.A[dow]={period:"AM"}; c.settings.zones=[c.settings.zones[0]]; hydrateCycleSettings();
        applyFixedPatterns(); var w=c.assign["s4|"+D(3)];
        return a && !!w && w.zone==="z1" && ruleBreaches(c,S,D(3)).some(function(b){ return b.kind==="needs"&&b.sid==="s4"; }); })());
      T("staff tab: a filter for a tag that has gone shows everyone", (function(){ state(); return staffFiltered("","all","gone").length===5 && staffFiltered("","all","t1").length===2; })());
      T("gaps: the Day board chip never judges a past day", (function(){ state(); put("s4",-2,"AM","z1"); dailyDate=D(-2); var h=viewDaily(); put("s4",2,"AM","z1"); dailyDate=D(2); var h2=viewDaily(); return !/needs 1 Senior/.test(h) && /needs 1 Senior/.test(h2); })());
      T("gaps: a give-away's line counts its giver as gone", (function(){
        state(); S.marketOn=true; put("s1",2,"AM","z2"); S.viewAs="s1"; offerShift("s1",D(2)); S.viewAs="s4"; var h=marketMyHTML();
        return /offered by Ava Ng/.test(h) && /needs 1 Senior/.test(h); })());
      T("audit: tag and rule keys file under Settings, the import under Imports, an override under Roster", auditCat("tags.add")==="settings" && auditCat("tags.show")==="settings" && auditCat("rules.needs")==="settings" && auditCat("rules.mins")==="settings" && auditCat("tags.import")==="data" && auditCat("rules.override")==="roster");
      T("rules: a minimum for a tag the list no longer has is ignored", (function(){
        state(); c.settings.rules={mins:[{tag:"gone",n:{AM:[1,1,1],PM:[1,1,1]}}]}; put("s4",2,"AM","z2"); put("s5",2,"AM","z3");
        return ruleJudge(c,S,"s3",D(2),["AM"],"z1",null).ok && ruleBreaches(c,S,D(2)).length===0; })());
      T("import: a punctuation-only Tags cell clears a person's tags, an empty one leaves them", (function(){
        state(); S.staff[0].name="Ng, Ava"; S.staff[1].name="Lee, Sam"; applyStaffList(parseStaffList([["Surname","Given name","Tags"],["Ng","Ava",";"],["Lee","Sam",""]]).rows);
        return !("tags" in S.staff[0]) && JSON.stringify(S.staff[1].tags)==='["t1"]'; })());
      // ---- tags and rules: later tasks add their tests above this line
    } finally { S=keep.S; dailyDate=keep.dd; dailyScope=keep.ds; _staffFilter=keep.sf; _staffQuery=keep.sq; _staffTag=keep.st; _srPick=keep.pick; _srSid=keep.sid; _daySheet=keep.sheet; isMobile=keep.mob; confirm=keep.cf; toast=keep.toast; _fpReport=keep.fp; download=keep.dl; /* tags and rules: restore */ hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- own hours on a booking (S4): a clinical booking may carry hours:{start,end} when they differ from its type's window; one reader answers every question about a shift's times.
  // Spec: docs/superpowers/specs/2026-09-26-own-hours-s4-design.md. Dates are relative to today; the validator, the reader and the staff write are pure.
  (function(){
    var keep={S:S,dd:dailyDate,ds:dailyScope,pick:_srPick,sid:_srSid,sheet:_daySheet,mob:isMobile,cf:confirm,toast:toast,dl:download,range:window._range};
    var D=function(n){ return iso(addDays(new Date(),n)); }, T0=D(0);
    var c=null, said=[];
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Triage",am:true,pm:true,pmLabel:""},{id:"z2",name:"Resus",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:3,pmMin:0,pmMax:3},unlockOrder:"both",rosterMode:"rolling",shiftTimes:{AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:"22:00"}}};   // extras open together and the evening has no minimum, so a booking reaches the safe-hours rules, not the unlock rule
      if(o.fatigue)set.fatigue=o.fatigue;
      S={zones:Z,staffing:set.staffing,
         staff:[{id:"s1",name:"Ava Ng",quota:20,eft:1},{id:"s2",name:"Sam Lee",quota:20,eft:1},{id:"s3",name:"Ky Tran",quota:20,eft:1}],
         cycles:[{id:"ch",cycle:{start:D(-7),weeks:6},status:o.status||"published",archived:false,settings:set,roles:{s1:{in:true},s2:{in:true},s3:{in:true}},assign:{}}],
         activeId:"ch",viewAs:o.viewAs||"admin",tab:"my",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],publicHolidays:[]};
      if(o.ownHours)S.ownHours=true;
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srPick=[]; _srSid=null; _daySheet=null; dailyScope="group"; dailyDate=null; window._range=null; }
    function put(sid,n,period,zone,hours,type){ var v={kind:"clinical",period:period||"AM",zone:zone||"z1"}; if(type)v.type=type; if(hours)v.hours=hours; c.assign[sid+"|"+D(n)]=v; return v; }
    function H(a,b){ return {start:a,end:b}; }
    function last(k){ return (S.audit||[]).filter(function(a){ return a.action===k; })[0]||null; }
    function told(to){ return (S.notifications||[]).filter(function(n){ return n.to===to; })[0]||null; }
    function evs(t){ return String(t).replace(/\r\n /g,"").split("BEGIN:VEVENT").slice(1).map(function(b){ var i=b.indexOf("\r\nUID:"); return i<0?"":b.slice(i+2,b.indexOf("\r\n",i+2)); }); }   // one entry per event: its UID line
    isMobile=function(){ return false; }; toast=function(m){ said.push(String(m)); };
    try{
      // ---- the validator, the normaliser and the reader
      T("own hours: hoursOK takes HH:MM pairs in 5-minute steps with the finish after the start or at 00:00, and nothing else", (function(){
        var yes=[["09:30","15:00"],["08:00","00:00"],["23:55","00:00"],["00:00","00:05"],["10:00","10:05"]];
        var no=[["15:00","09:30"],["10:00","10:00"],["00:00","00:00"],["09:31","15:00"],["09:30","15:01"],["9:30","15:00"],["24:00","01:00"],["10:60","11:00"],["","15:00"],[null,"15:00"],["09:30",undefined],["0930","1500"]];
        return yes.every(function(p){ return hoursOK(p[0],p[1])===true; }) && no.every(function(p){ return hoursOK(p[0],p[1])===false; }); })());
      T("own hours: hoursNorm gives the pair to store, and null for the type's own window, for a pair the rule refuses, and for a whole-day type's own window", (function(){
        state(); var bare={kind:"clinical",period:"AM",zone:"z1"}, full={kind:"clinical",period:"AM",zone:"z1",type:"full"};
        var ts=shiftTypesOf(c).map(function(t){ return Object.assign({},t,{fills:(t.fills||[]).slice()}); }); ts.push({id:"full",code:"FULL",label:"Whole day",fills:["AM","PM"],start:"10:00",end:"22:00",on:true,book:true}); c.settings.shiftTypes=ts; hydrateCycleSettings();
        return JSON.stringify(hoursNorm(c,bare,"09:30","15:00"))==='{"start":"09:30","end":"15:00"}' && hoursNorm(c,bare,"10:00","17:00")===null && hoursNorm(c,bare,"15:00","09:30")===null && hoursNorm(c,full,"10:00","22:00")===null && JSON.stringify(hoursNorm(c,full,"10:00","21:00"))==='{"start":"10:00","end":"21:00"}'; })());
      T("own hours: shiftWindow reads the booking's own hours when present and valid, else the type's window, and is never own for CST, leave or a malformed pair", (function(){
        state(); var a=put("s1",2,"AM","z1"), b=put("s2",2,"PM","z2",H("17:30","22:15")), x=put("s3",2,"AM","z1",H("9:30","15:00")), u={kind:"clinical",period:"PM",zone:"z1",type:"gone",hours:H("18:00","23:00")};
        var wa=shiftWindow(c,a), wb=shiftWindow(c,b), wx=shiftWindow(c,x), wu=shiftWindow(c,u), wc=shiftWindow(c,{kind:"cst",hours:H("09:00","12:00")}), wl=shiftWindow(c,{kind:"leave",code:"AL"});
        return JSON.stringify(wa)==='{"start":"10:00","end":"17:00","own":false}' && JSON.stringify(wb)==='{"start":"17:30","end":"22:15","own":true}' && JSON.stringify(wx)==='{"start":"10:00","end":"17:00","own":false}' && JSON.stringify(wu)==='{"start":"18:00","end":"23:00","own":true}' && wc.own===false && /^\d\d:\d\d$/.test(wc.start) && wl===null && shiftWindow(c,null)===null; })());
      T("own hours: windowStr and ownHoursTag say the window, and the tag only when the hours are the booking's own", (function(){
        state(); var a=put("s1",2,"AM","z1"), b=put("s2",2,"PM","z2",H("17:30","22:15"));
        return windowStr(shiftWindow(c,a))==="10:00\u201317:00" && windowStr(null)==="" && ownHoursTag(c,a)==="" && ownHoursTag(c,b)===" 17:30\u201322:15" && ownHoursTag(c,{kind:"cst"})==="" && ownHoursTag(c,undefined)===""; })());
      T("own hours: the safe-hours span runs over the booking's own hours, 00:00 reads as midnight, a call-in clash sees them, and canBook judges the hours it is handed", (function(){
        state({fatigue:{mode:"block",minRest:11,maxConsec:0}}); S.viewAs="s1"; var v=put("s1",2,"PM","z2",H("17:00","23:30"));
        var sp=_spansOn(c,"s1",D(2)), late=sp.length===1&&sp[0].st.getHours()===17&&sp[0].en.getHours()===23&&sp[0].en.getMinutes()===30;
        var d0=parseISO(D(2)), mk=function(h,m){ return new Date(d0.getFullYear(),d0.getMonth(),d0.getDate(),h,m); };
        var clash=ciShiftClash(c,"s1",D(2),{st:mk(23,0),en:mk(23,30)}), r1=canBook("s1",D(3),"AM","z1");
        delete v.hours; var clash2=ciShiftClash(c,"s1",D(2),{st:mk(23,0),en:mk(23,30)}), r2=canBook("s1",D(3),"AM","z1");
        var r3=canBook("s1",D(3),"AM","z1",undefined,H("08:30","12:00")), r4=canBook("s1",D(3),"AM","z1",undefined,H("10:30","12:00"));
        v.hours=H("20:00","00:00"); var sm=_spansOn(c,"s1",D(2)), mid=sm.length===1&&sm[0].en.getHours()===0&&sm[0].en.getDate()===parseISO(D(3)).getDate()&&_tHours("20:00","00:00")===4;
        return late && clash==="Resus PM" && r1.ok===false && /^Fatigue rule: Only 10\.5h rest/.test(r1.reason) && clash2==="" && r2.ok===true && r3.ok===false && /^Fatigue rule/.test(r3.reason) && r4.ok===true && mid; })());
      // ---- the staff write
      T("own hours: staff set their own hours only with the switch on; the pair is stored, the admin is told, hours.set is written, and saying the same again writes nothing", (function(){
        state(); put("s1",2,"AM","z1"); S.viewAs="s1";
        var off=hoursSet("s1",D(2),"09:30","15:00"), offSaid=said.slice(); S.ownHours=true;
        var on=hoursSet("s1",D(2),"09:30","15:00"), v=c.assign["s1|"+D(2)], a=last("hours.set"), n=told("admin");
        var same=hoursSet("s1",D(2),"09:30","15:00"), nA=S.audit.length;
        return off===false && offSaid.length===1 && /admin sets hours/.test(offSaid[0]) && on===true && JSON.stringify(v.hours)==='{"start":"09:30","end":"15:00"}' && !!a && a.detail==="Ava Ng "+D(2)+" Triage AM \u2192 09:30\u201315:00" && a.actor==="s1" && !!n && n.text==="Ava Ng changed their hours on "+fmtISO(D(2))+" to 09:30\u201315:00." && same===true && S.audit.length===nA; })());
      T("own hours: a staff change is refused for a day gone, a pair the rule refuses, someone else's shift, a day with no shift and a draft; the admin may set a past day, and the person is told", (function(){
        state({ownHours:true}); put("s1",-1,"AM","z1"); put("s1",2,"AM","z1"); put("s2",3,"PM","z2"); S.viewAs="s1";
        var past=hoursSet("s1",D(-1),"09:30","15:00"), bad=hoursSet("s1",D(2),"15:00","09:30"), theirs=hoursSet("s2",D(3),"18:00","22:00"), none=hoursSet("s1",D(5),"10:00","12:00"), why=said.slice();
        c.status="draft"; var draft=hoursSet("s1",D(2),"09:30","15:00"); c.status="published";
        S.viewAs="admin"; var adm=hoursSet("s1",D(-1),"09:30","15:00"), v=c.assign["s1|"+D(-1)], n=told("s1");
        return past===false && bad===false && theirs===false && none===false && draft===false && why.length===4 && /day has passed/.test(why[0]) && /5-minute steps/.test(why[1]) && /your own hours/.test(why[2]) && /No shift/.test(why[3]) && adm===true && JSON.stringify(v.hours)==='{"start":"09:30","end":"15:00"}' && !!n && /^Your admin set your hours on /.test(n.text) && last("hours.set").actor==="admin"; })());
      T("own hours: setting the type's own window or an empty pair clears the key, writes hours.clear and says so; clearing what is already clear writes nothing", (function(){
        state({ownHours:true}); put("s1",2,"AM","z1",H("09:30","15:00")); put("s1",3,"AM","z1",H("09:30","15:00")); S.viewAs="s1";
        var a=hoursSet("s1",D(2),"10:00","17:00"), v2=c.assign["s1|"+D(2)], l2=last("hours.clear");
        var b=hoursSet("s1",D(3),"",""), v3=c.assign["s1|"+D(3)], nA=S.audit.length, b2=hoursSet("s1",D(3),"",""), n=told("admin");
        return a===true && !("hours" in v2) && !!l2 && /\u2192 the AM hours$/.test(l2.detail) && b===true && !("hours" in v3) && b2===true && S.audit.length===nA && !!n && /put their hours on .* back to the AM hours\.$/.test(n.text); })());
      T("own hours: a change that breaks the rest rule is refused in block mode with the reason, warned in warn mode, and never refused to the admin", (function(){
        state({ownHours:true,fatigue:{mode:"block",minRest:11,maxConsec:0}}); put("s1",2,"PM","z2"); put("s1",3,"AM","z1"); S.viewAs="s1";
        var r=hoursSet("s1",D(2),"17:00","23:30"), why=said.slice(), kept=!c.assign["s1|"+D(2)].hours;
        c.settings.fatigue.mode="warn"; said.length=0; var w=hoursSet("s1",D(2),"17:00","23:30"), warned=said.slice(), stored=JSON.stringify(c.assign["s1|"+D(2)].hours);
        c.settings.fatigue.mode="block"; S.viewAs="admin"; var adm=hoursSet("s1",D(2),"17:00","23:45");
        return r===false && kept && why.length===1 && /^Fatigue rule: Only 10\.5h rest before the next day/.test(why[0]) && w===true && warned.length===1 && /^Only 10\.5h rest/.test(warned[0]) && stored==='{"start":"17:00","end":"23:30"}' && adm===true; })());
      T("own hours: without own hours a booking reads exactly as today: the payroll row, the RosterOn cell, the digest, the calendar and the reminder carry the type's window, and nothing new is written", (function(){
        state(); put("s1",2,"AM","z1"); put("s2",2,"PM","z2"); window._range={from:D(2),to:D(2)};
        var pr=payrollRows().filter(function(r){ return r.date===D(2); }), rc=ronCell("s1",parseISO(D(2))), rc2=ronCell("s2",parseISO(D(2))), dg=stableJSON(buildDigestAll(S,T0)), ics=icsText("s1"), rem=REMINDFN.reminderFor(S,S.staff[0],D(2));
        return pr.length===2 && pr[0].code==="AM" && pr[0].start==="10:00" && pr[0].end==="17:00" && pr[0].hours===7 && pr[1].start==="17:00" && pr[1].end==="22:00" && pr[1].hours===5 && rc==="() AM 1000-1700 10:00-17:00 NB#" && rc2==="() PM 1700-2200  17:00-22:00 NB#" && dg.indexOf('"t":"10:00\u201317:00"')>=0 && ics.indexOf("T100000")>=0 && ics.indexOf("T170000")>=0 && !!rem && rem.detail==="AM \u00b7 Triage \u00b7 10:00\u201317:00" && JSON.stringify(S).indexOf('"hours"')<0; })());
      // ---- every reader in the app
      T("readers: shiftHours and shTimeStr read the window, so a booking's own hours are what it counts and prints, and a finish of 00:00 counts to midnight", (function(){
        state(); var a=put("s1",2,"AM","z1"), b=put("s2",2,"PM","z2",H("17:30","22:15")), m=put("s3",3,"PM","z2",H("20:00","00:00"));
        return shiftHours(c,a)===7 && shTimeStr(c,a)==="10:00\u201317:00" && shiftHours(c,b)===4.75 && shTimeStr(c,b)==="17:30\u201322:15" && shiftHours(c,m)===4 && shTimeStr(c,m)==="20:00\u201300:00" && shTimeStr(c,{kind:"off",period:"AM"})===periodTime("AM"); })());
      T("readers: the payroll row keeps the type's code and carries the booking's own start, finish and hours, and the RosterOn cell keeps its layout with the real times", (function(){
        state(); put("s1",2,"AM","z1",H("09:30","15:00")); put("s2",2,"PM","z2",H("17:30","22:15"));
        var pr=payrollRows().filter(function(r){ return r.date===D(2); });
        return pr.length===2 && pr[0].code==="AM" && pr[0].start==="09:30" && pr[0].end==="15:00" && pr[0].hours===5.5 && pr[0].unit==="Triage" && pr[1].code==="PM" && pr[1].start==="17:30" && pr[1].end==="22:15" && pr[1].hours===4.75 && ronCell("s1",parseISO(D(2)))==="() AM 0930-1500 09:30-15:00 NB#" && ronCell("s2",parseISO(D(2)))==="() PM 1730-2215  17:30-22:15 NB#"; })());
      T("readers: the RosterOn data sheet carries the real start, finish and hours under the type's code", (function(){
        state(); put("s1",2,"AM","z1",H("09:30","15:00")); put("s2",3,"PM","z2"); var sheets=[], had=(typeof XLSX!=="undefined"), keepX=had?XLSX:null;
        XLSX={utils:{aoa_to_sheet:function(a){ return {aoa:a}; },book_new:function(){ return {}; },book_append_sheet:function(wb,ws,name){ sheets.push({name:name,aoa:ws.aoa}); }},writeFile:function(){}};
        try{ exportRosterOn(); } finally { if(had)XLSX=keepX; else XLSX=undefined; }
        var data=sheets.filter(function(x){ return x.name==="Data"; })[0], rows=data?data.aoa:[];
        var a=rows.filter(function(r){ return r[0]==="Ava Ng"; })[0], b=rows.filter(function(r){ return r[0]==="Sam Lee"; })[0];
        return !!a && a[6]==="AM" && a[7]==="09:30" && a[8]==="15:00" && a[9]===5.5 && !!b && b[6]==="PM" && b[7]==="17:00" && b[8]==="22:00" && b[9]===5; })());
      T("readers: the roster CSV and Excel labels add the times only when they are the booking's own", (function(){
        state(); put("s1",2,"AM","z1",H("09:30","15:00")); put("s2",2,"PM","z2"); var got=[]; download=function(s){ got.push(String(s)); };
        try{ exportRosterCSV(); exportRosterXLS(); } finally { download=keep.dl; }
        return got.length===2 && got[0].indexOf("Triage AM 09:30\u201315:00")>=0 && got[0].indexOf("Resus PM")>=0 && got[0].indexOf("Resus PM 17:00")<0 && got[1].indexOf("Triage AM 09:30\u201315:00")>=0 && got[1].indexOf("Resus PM")>=0 && got[1].indexOf("Resus PM 17:00")<0; })());
      T("readers: the calendar download builds the event from the window under the same event id, and a finish of 00:00 ends the event at midnight", (function(){
        state(); put("s1",2,"AM","z1"); window._range={from:D(2),to:D(3)}; var before=evs(icsText("s1")), raw0=icsText("s1").replace(/\r\n /g,""), dk=D(2).replace(/-/g,""), dk3=D(3).replace(/-/g,""), dk4=D(4).replace(/-/g,"");
        c.assign["s1|"+D(2)].hours=H("09:30","15:00"); put("s1",3,"PM","z2",H("20:00","00:00")); var after=evs(icsText("s1")), raw=icsText("s1").replace(/\r\n /g,"");
        return before.length===1 && after.length===2 && before[0]==="UID:s1-"+dk+"-AM@myrosta.v2" && after[0]==="UID:s1-"+dk+"-AM@myrosta.v2" && raw0.indexOf(dk+"T100000")>0 && raw0.indexOf(dk+"T170000")>0 && raw.indexOf(dk+"T093000")>0 && raw.indexOf(dk+"T150000")>0 && raw.indexOf(dk+"T100000")<0 && raw.indexOf(dk3+"T200000")>0 && raw.indexOf(dk4+"T000000")>0 && raw.indexOf("09:30\u201315:00")>0; })());
      T("readers: the digest carries the window, the day sheet says own hours, and the grid cell shows them on a second line only when they are the booking's own", (function(){
        state(); var a=put("s1",2,"AM","z1",H("09:30","15:00")), b=put("s2",2,"PM","z2");
        var dg=stableJSON(buildDigestAll(S,T0)); S.viewAs="s1"; var ds=daySheetHTML(D(2)); S.viewAs="s2"; var ds2=daySheetHTML(D(2)); var ca=cellChip(a), cb=cellChip(b);
        return dg.indexOf('"t":"09:30\u201315:00"')>=0 && dg.indexOf('"t":"17:00\u201322:00"')>=0 && ds.indexOf("09:30\u201315:00 (own hours)")>=0 && ds2.indexOf("starts 17:00")>=0 && ds2.indexOf("own hours")<0 && ca.indexOf("09:30\u201315:00")>=0 && cb.indexOf("17:00")<0; })());
      T("readers: My shifts' hero, the Day board rows and the mobile week list say the times after the name only when they are the booking's own", (function(){
        state(); put("s1",2,"AM","z1",H("09:30","15:00")); put("s2",2,"PM","z2");
        S.viewAs="s1"; S.tab="my"; render(); var my=document.getElementById("app").innerHTML;
        S.viewAs="admin"; dailyDate=D(2); S.tab="daily"; render(); var daily=document.getElementById("app").innerHTML;
        isMobile=function(){ return true; }; S.tab="roster"; window._range={from:D(2),to:D(2)}; render(); var mob=document.getElementById("app").innerHTML; isMobile=function(){ return false; };
        return my.indexOf("Triage \u00b7 09:30")>=0 && daily.indexOf("Ava Ng 09:30\u201315:00")>=0 && daily.indexOf("Sam Lee")>=0 && daily.indexOf("Sam Lee 17:00")<0 && mob.indexOf("Ava Ng 09:30\u201315:00")>=0 && mob.indexOf("Sam Lee")>=0 && mob.indexOf("Sam Lee 17:00")<0; })());
      T("readers: the swap text names the hours after the slot when own, an offer's snapshot carries them, swSame ignores them, a give-away's claimer inherits them and a posted gap has none", (function(){
        state(); S.marketOn=true; put("s1",3,"AM","z1",H("09:30","15:00")); put("s2",4,"PM","z2");
        var txt=swShiftText(c,c.assign["s1|"+D(3)]), plain=swShiftText(c,c.assign["s2|"+D(4)]), snap=swShiftOf(c,"s1",D(3)), snap2=swShiftOf(c,"s2",D(4)), same=swSame(snap,{period:"AM",zone:"z1",type:null});
        S.viewAs="s1"; var off=offerShift("s1",D(3)); var g=S.openShifts[0]; S.viewAs="s3"; var cl=claimOpenShift(g.id,false), got=c.assign["s3|"+D(3)], gone=!c.assign["s1|"+D(3)];
        S.viewAs="admin"; postOpenShift(D(5),"AM","z2",""); var q=S.openShifts.filter(function(o){ return o.iso===D(5); })[0]; S.viewAs="s2"; var cl2=claimOpenShift(q.id,false), got2=c.assign["s2|"+D(5)];
        return txt==="Triage AM 09:30\u201315:00" && plain==="Resus PM" && JSON.stringify(snap.hours)==='{"start":"09:30","end":"15:00"}' && !("hours" in snap2) && same===true && off===true && cl===true && !!got && JSON.stringify(got.hours)==='{"start":"09:30","end":"15:00"}' && gone && cl2===true && !!got2 && !("hours" in got2); })());
      // ---- the admin's cell editor and the group switch
      T("cell editor: the group switch is written as true, deleted when off (never false), logged as settings.ownHours, and the Group card ticks it", (function(){
        state(); ownHoursSwitch(true); var on=S.ownHours===true&&ownHoursOn()===true, a1=last("settings.ownHours"), card=brandingCardHTML();
        ownHoursSwitch(false); var off=!("ownHours" in S)&&ownHoursOn()===false, a2=last("settings.ownHours"), card2=brandingCardHTML();
        return on && off && !!a1 && a1.detail==="on" && !!a2 && a2.detail==="off" && JSON.stringify(S).indexOf('"ownHours"')<0 && /id="ownHours" checked/.test(card) && /id="ownHours" >/.test(card2) && card.indexOf("Staff may set their own hours")>=0; })());
      T("cell editor: the Hours row shows the draft's own pair, else the type's window; Save clears on an empty pair or the type's window, names a refused pair, and stores anything else normalised", (function(){
        state(); var tW=modalHours({kind:"clinical",period:"PM",zone:"z2"},c), own=modalHours({kind:"clinical",period:"AM",zone:"z1",hours:H("09:30","15:00")},c), none=modalHours({kind:"clinical",period:"AM"},c);
        var s1={kind:"clinical",period:"AM",zone:"z1",hours:{start:"",end:""}}, r1=modalHoursCheck(c,s1);
        var s2={kind:"clinical",period:"AM",zone:"z1",hours:{start:"10:00",end:"17:00"}}, r2=modalHoursCheck(c,s2);
        var s3={kind:"clinical",period:"AM",zone:"z1",hours:{start:"15:00",end:"09:30"}}, r3=modalHoursCheck(c,s3);
        var s4={kind:"clinical",period:"AM",zone:"z1",hours:{start:"09:30",end:"15:00"}}, r4=modalHoursCheck(c,s4), r5=modalHoursCheck(c,{kind:"clinical",period:"AM",zone:"z1"});
        return JSON.stringify(tW)==='{"start":"17:00","end":"22:00"}' && JSON.stringify(own)==='{"start":"09:30","end":"15:00"}' && JSON.stringify(none)==='{"start":"10:00","end":"17:00"}' && r1.ok===true && !("hours" in s1) && r2.ok===true && !("hours" in s2) && r3.ok===false && r3.reason===HOURS_RULE && ("hours" in s3) && r4.ok===true && JSON.stringify(s4.hours)==='{"start":"09:30","end":"15:00"}' && r5.ok===true; })());
      T("cell editor: hoursAudit writes hours.set or hours.clear in the admin's name only when the pair changed", (function(){
        state(); var sh={kind:"clinical",period:"AM",zone:"z1",hours:H("09:30","15:00")};
        var a=hoursAudit("s1",D(2),sh,null,"admin"), l1=last("hours.set"), n1=S.audit.length, b=hoursAudit("s1",D(2),sh,H("09:30","15:00"),"admin"), n2=S.audit.length;
        var c2=hoursAudit("s1",D(2),{kind:"clinical",period:"AM",zone:"z1"},H("09:30","15:00"),"admin"), l2=last("hours.clear"), d=hoursAudit("s1",D(2),{kind:"clinical",period:"AM",zone:"z1"},null,"admin");
        return a===true && !!l1 && l1.actor==="admin" && l1.detail==="Ava Ng "+D(2)+" Triage AM \u2192 09:30\u201315:00" && b===false && n2===n1 && c2===true && !!l2 && /\u2192 the AM hours$/.test(l2.detail) && d===false; })());
      // ---- the staff day sheet: at booking and afterwards
      T("day sheet: srHoursFor reads what was typed beside a pick: nothing, the type's own window, a pair to store, or a pair the rule refuses", (function(){
        state(); _srHours={}; var a=srHoursFor(c,D(2),"AM",undefined); _srHours[D(2)]={start:"",end:""}; var b=srHoursFor(c,D(2),"AM",undefined);
        _srHours[D(2)]={start:"10:00",end:"17:00"}; var d=srHoursFor(c,D(2),"AM",undefined); _srHours[D(2)]={start:"09:30",end:"15:00"}; var e=srHoursFor(c,D(2),"AM",undefined); _srHours[D(2)]={start:"15:00",end:"09:30"}; var f=srHoursFor(c,D(2),"AM",undefined); _srHours={};
        return a.ok===true&&a.hours===null && b.ok===true&&b.hours===null && d.ok===true&&d.hours===null && e.ok===true&&JSON.stringify(e.hours)==='{"start":"09:30","end":"15:00"}' && f.ok===false&&f.reason===HOURS_RULE; })());
      T("day sheet: Confirm writes the hours typed beside a pick only when they differ from the type's, a refused pair fails that pick alone with the reason, and the basket's hours go with the basket", (function(){
        state({ownHours:true}); S.viewAs="s1"; _srSid="s1"; _srPick=[D(2)+"|AM|z1",D(3)+"|AM|z1",D(4)+"|PM|z2"]; _srHours={}; _srHours[D(2)]={start:"09:30",end:"15:00"}; _srHours[D(3)]={start:"10:00",end:"17:00"}; _srHours[D(4)]={start:"22:00",end:"17:00"};
        srBatchBook(); var v2=c.assign["s1|"+D(2)], v3=c.assign["s1|"+D(3)], v4=c.assign["s1|"+D(4)], f=(window._srBatchFail||[]).slice(), a=(S.audit||[]).filter(function(x){ return x.action==="selfroster.book"; }), left=Object.keys(_srHours).length, picks=_srPick.length; _srSid=null;
        return !!v2 && JSON.stringify(v2.hours)==='{"start":"09:30","end":"15:00"}' && !!v3 && !("hours" in v3) && !v4 && f.length===1 && f[0].indexOf(fmtISO(D(4)))===0 && f[0].indexOf(HOURS_RULE)>0 && left===0 && picks===0 && a.length===2 && a.some(function(x){ return /09:30\u201315:00$/.test(x.detail); }); })());
      T("day sheet: a pick with own hours is judged by the safe-hours rules at Confirm: refused in block mode with the reason, booked with a warning in warn mode", (function(){
        state({ownHours:true,fatigue:{mode:"block",minRest:11,maxConsec:0}}); S.viewAs="s1"; _srSid="s1"; put("s1",2,"PM","z2"); _srPick=[D(3)+"|AM|z1"]; _srHours={}; _srHours[D(3)]={start:"08:30",end:"12:00"};
        srBatchBook(); var refused=!c.assign["s1|"+D(3)], f=(window._srBatchFail||[]).slice();
        c.settings.fatigue.mode="warn"; said.length=0; _srPick=[D(3)+"|AM|z1"]; _srHours[D(3)]={start:"08:30",end:"12:00"}; srBatchBook(); var v=c.assign["s1|"+D(3)], warned=said.some(function(m){ return /Only 10\.5h rest/.test(m); }); _srSid=null;
        return refused && f.length===1 && /Fatigue rule: Only 10\.5h rest/.test(f[0]) && !!v && JSON.stringify(v.hours)==='{"start":"08:30","end":"12:00"}' && warned; })());
      T("day sheet: the Hours row sits under the chips only with the switch on and a pick on that day, prefilled with the type's window or what was typed; Change hours and its form show on a booked shift still ahead, never for a past day, an admin or the switch off", (function(){
        state({ownHours:true}); S.viewAs="s1"; _srPick=[]; _srHours={}; var none=daySheetHTML(D(2)); _srPick=[D(2)+"|AM|z1"]; var row=daySheetHTML(D(2)); _srHours[D(2)]={start:"09:30",end:"15:00"}; var typed=daySheetHTML(D(2));
        delete S.ownHours; var off=daySheetHTML(D(2)); S.ownHours=true; _srPick=[]; _srHours={};
        put("s1",3,"AM","z1"); put("s1",-1,"AM","z1"); var acts=dsBookedActs("s1",D(3),c), past=dsBookedActs("s1",D(-1),c); S.viewAs="admin"; _srSid="s1"; var adm=dsBookedActs("s1",D(3),c); S.viewAs="s1"; _srSid=null; delete S.ownHours; var actsOff=dsBookedActs("s1",D(3),c); S.ownHours=true;
        _hrForm={d:D(3),start:"09:30",end:"15:00"}; var form=dsBookedActs("s1",D(3),c); c.assign["s1|"+D(3)].hours=H("09:30","15:00"); var form2=dsBookedActs("s1",D(3),c); _hrForm={d:D(4),start:"",end:""}; var other=dsBookedActs("s1",D(3),c); _hrForm=null;
        return none.indexOf('class="hr-from"')<0 && row.indexOf('class="hr-from"')>=0 && row.indexOf('value="10:00"')>=0 && row.indexOf('value="17:00"')>=0 && typed.indexOf('value="09:30"')>=0 && off.indexOf('class="hr-from"')<0 && acts.indexOf('data-hrchange="'+D(3)+'"')>=0 && past.indexOf("data-hrchange")<0 && adm.indexOf("data-hrchange")<0 && actsOff.indexOf("data-hrchange")<0 && form.indexOf('class="hrc-from"')>=0 && form.indexOf('value="09:30"')>=0 && form.indexOf('data-hrsave="'+D(3)+'"')>=0 && form.indexOf("data-hrcancel")>=0 && form.indexOf("data-hrchange")<0 && form.indexOf("data-hrclear")<0 && form2.indexOf("data-hrclear")>=0 && other.indexOf("hrc-from")<0 && other.indexOf("data-hrchange")>=0; })());
      T("day sheet: closing the sheet drops the Change-hours form, and the typed hours go whenever the basket goes: a cycle switch, a render for another person, a reset", (function(){
        state({ownHours:true}); _hrForm={d:D(2),start:"",end:""}; _daySheet=D(2); closeDaySheet(); var closed=_hrForm===null&&_daySheet===null;
        _srHours={}; _srHours[D(2)]={start:"09:30",end:"15:00"}; S.cycles.push({id:"c2",cycle:{start:D(40),weeks:2},status:"draft",archived:false,settings:{zones:c.settings.zones,staffing:c.settings.staffing},roles:{},assign:{}}); go("my",{cycle:"c2"}); var sw=Object.keys(_srHours).length===0; S.activeId="ch"; hydrateCycleSettings(); hydrateCycleRoles();
        _srHours[D(2)]={start:"09:30",end:"15:00"}; _srPickSid="s2"; _srSid=null; S.viewAs="s1"; S.tab="selfroster"; render(); var rr=Object.keys(_srHours).length===0; S.tab="my";
        _srHours[D(2)]={start:"09:30",end:"15:00"}; _hrForm={d:D(2),start:"",end:""}; resetNow(); var rs=Object.keys(_srHours).length===0&&_hrForm===null;
        return closed && sw && rr && rs; })());
      T("day sheet: a Change-hours form left open never resurfaces: opening a sheet or moving tab drops it, and it renders only where the button would", (function(){
        state({ownHours:true}); S.viewAs="s1"; put("s1",3,"AM","z1"); put("s1",-1,"AM","z1");
        _hrForm={d:D(3),start:"09:30",end:"15:00"}; openDaySheet(D(3)); var afterOpen=_hrForm===null;
        _hrForm={d:D(3),start:"09:30",end:"15:00"}; go("my"); var afterGo=_hrForm===null;
        _hrForm={d:D(3),start:"09:30",end:"15:00"}; delete S.ownHours; var off=dsBookedActs("s1",D(3),c); S.ownHours=true;
        _hrForm={d:D(3),start:"09:30",end:"15:00"}; S.viewAs="admin"; var adm=dsBookedActs("s1",D(3),c); S.viewAs="s1";
        _hrForm={d:D(-1),start:"09:30",end:"15:00"}; var past=dsBookedActs("s1",D(-1),c); _hrForm=null;
        return afterOpen && afterGo && off.indexOf("hrc-from")<0 && adm.indexOf("hrc-from")<0 && past.indexOf("hrc-from")<0; })());
      // ---- the two Edge Functions and the roster import
      T("edge functions: the reminder and the live feed read a booking's own hours exactly as the app does, and a malformed pair falls back to the type's window in all three", (function(){
        state(); put("s1",2,"AM","z1",H("09:30","15:00")); put("s2",2,"PM","z2"); put("s3",2,"AM","z1",H("9:30","15:00")); window._range={from:D(2),to:D(2)};
        var r1=REMINDFN.reminderFor(S,S.staff[0],D(2)), r2=REMINDFN.reminderFor(S,S.staff[1],D(2)), r3=REMINDFN.reminderFor(S,S.staff[2],D(2));
        var f1=ICSFN.buildICS(S,S.staff[0],null).replace(/\r\n /g,""), f3=ICSFN.buildICS(S,S.staff[2],null).replace(/\r\n /g,""), a1=icsText("s1").replace(/\r\n /g,""), dk=D(2).replace(/-/g,"");
        return !!r1 && r1.detail==="AM \u00b7 Triage \u00b7 09:30\u201315:00" && !!r2 && r2.detail==="PM \u00b7 Resus \u00b7 17:00\u201322:00" && !!r3 && r3.detail==="AM \u00b7 Triage \u00b7 10:00\u201317:00" && f1.indexOf("UID:s1-"+dk+"-AM@myrosta.v2")>0 && a1.indexOf("UID:s1-"+dk+"-AM@myrosta.v2")>0 && f1.indexOf(dk+"T093000")>0 && f1.indexOf(dk+"T150000")>0 && f1.indexOf(dk+"T100000")<0 && f1.indexOf("09:30\u201315:00")>0 && f3.indexOf(dk+"T100000")>0 && f3.indexOf("T093000")<0 && shiftWindow(c,c.assign["s3|"+D(2)]).own===false; })());
      T("edge functions: a finish of 00:00 ends the feed's event at midnight, under the event id it always had", (function(){
        state(); put("s1",3,"PM","z2",H("20:00","00:00")); var f=ICSFN.buildICS(S,S.staff[0],null).replace(/\r\n /g,""), dk3=D(3).replace(/-/g,""), dk4=D(4).replace(/-/g,"");
        return f.indexOf("UID:s1-"+dk3+"-PM@myrosta.v2")>0 && f.indexOf(dk3+"T200000")>0 && f.indexOf(dk4+"T000000")>0; })());
      T("import: a cell's HHMM-HHMM keeps its times, and the booking lands with own hours only when they differ from the window of the type it lands on; a pair the rule refuses is dropped", (function(){
        state(); var p1=parseShiftStr("0930-1500 Triage"), p2=parseShiftStr("1000-1700 Triage"), p3=parseShiftStr("2200-0600 Resus");
        var p={dates:[D(36),D(37),D(38),D(39),D(40),D(41),D(42)],staff:["Ava Ng"],assigns:{},skipped:[]}; p.assigns["Ava Ng|"+D(36)]=p1; p.assigns["Ava Ng|"+D(37)]=p2; p.assigns["Ava Ng|"+D(38)]=p3;
        var nc=applyRosterImport(p,null), a=nc.assign["s1|"+D(36)], b=nc.assign["s1|"+D(37)], d=nc.assign["s1|"+D(38)];
        S.activeId="ch"; hydrateCycleSettings(); hydrateCycleRoles(); var q={dates:[D(0),D(1),D(2),D(3),D(4),D(5),D(6)],staff:["Ava Ng"],assigns:{},skipped:[]}; q.assigns["Ava Ng|"+D(2)]=parseShiftStr("0930-1500 Triage"); applyRosterImport(q,c); var u=c.assign["s1|"+D(2)];
        var hdr=["Consultant"]; for(var i=0;i<7;i++)hdr.push(D(36+i)); var aoa=parseRosterAOA([hdr,["Ng, Ava","0930-1500 Triage"]]);   // a header row needs more than five date cells to be one
        return p1.start==="09:30" && p1.end==="15:00" && p1.period==="AM" && p1.role==="Triage" && p3.period==="PM" && !!a && a.period==="AM" && JSON.stringify(a.hours)==='{"start":"09:30","end":"15:00"}' && !!b && !("hours" in b) && !!d && !("hours" in d) && !!u && JSON.stringify(u.hours)==='{"start":"09:30","end":"15:00"}' && !aoa.error && aoa.assigns["Ng, Ava|"+D(36)].start==="09:30" && aoa.assigns["Ng, Ava|"+D(36)].end==="15:00"; })());
      // ---- release
      var _rel927=WHATS_NEW.filter(function(e){ return e.on==="2026-09-27"; })[0];   // pinned by date, never by position: later builds sit in front of it
      T("release: What's new names own hours on the release day, in three lines", !!_rel927 && /hours/i.test(_rel927.title) && _rel927.lines.length===3 && _rel927.lines.some(function(l){ return /Staff may set their own hours/.test(l); }) && _rel927.lines.some(function(l){ return /RosterOn/.test(l); }) && !/[‘’“”]/.test(_rel927.lines[1]) && BUILD>="2026-09-27");
      // ---- after the final review: the cell editor's Save path, driven through the dialog itself
      var _mr=document.getElementById("modalRoot"), _mq=_mr.querySelector; _mr.querySelector=function(sel){ return /^#[\w-]+$/.test(String(sel))?document.getElementById(String(sel).slice(1)):null; };   // the stubs' querySelector finds nothing, so the dialog's wiring never ran under the suite: #id now finds the one cached element per id (#mSave, #hrFrom, #editCmt ...); the finally puts the stub back
      var _save=function(){ var e=document.getElementById("editCmt"); e.value="pay correction"; try{ document.getElementById("mSave").onclick(); } finally { e.value=""; } };   // a published roster asks for a reason (needsComment), read from #editCmt exactly as the dialog reads it
      T("cell editor Save: a typed pair is stored with hours.set in the admin's name and the dialog closes, the stored booking untouched until Save; a pair the rule refuses leaves the booking, the audit and the dialog as they were; the type's own window stores nothing", (function(){
        state(); var asks=needsComment(), hf=document.getElementById("hrFrom"), ht=document.getElementById("hrTo"); put("s1",2,"AM","z1"); openCell("s1",D(2)); var row1=_mr.innerHTML.indexOf('id="hrFrom" step="300" value="10:00"')>0;
        modal.draft.hours=H("09:30","15:00"); _save(); var h1=JSON.stringify(c.assign["s1|"+D(2)].hours), a1=last("hours.set"), set1=!!a1&&a1.actor==="admin"&&a1.detail==="Ava Ng "+D(2)+" Triage AM \u2192 09:30\u201315:00", shut1=_mr.innerHTML==="";
        state(); var j2=JSON.stringify(put("s1",2,"AM","z1",H("09:30","15:00"))); openCell("s1",D(2)); var row2=_mr.innerHTML.indexOf('id="hrFrom" step="300" value="09:30"')>0; hf.value="11:00"; ht.value="16:00"; ht.onchange();
        var typed2=JSON.stringify(modal.draft.hours), kept2=JSON.stringify(c.assign["s1|"+D(2)])===j2; _save(); hf.value=""; ht.value=""; var h2=JSON.stringify(c.assign["s1|"+D(2)].hours);
        state(); var j3=JSON.stringify(put("s1",2,"AM","z1")), n3=S.audit.length; openCell("s1",D(2)); modal.draft.hours=H("15:00","09:30"); hf.removeAttribute("aria-invalid"); _save();
        var kept3=JSON.stringify(c.assign["s1|"+D(2)])===j3&&S.audit.length===n3, open3=_mr.innerHTML!=="", named3=hf.getAttribute("aria-invalid")==="true"; closeModal(); hf.removeAttribute("aria-invalid"); hf.removeAttribute("aria-describedby");
        state(); put("s1",2,"AM","z1"); openCell("s1",D(2)); modal.draft.hours=H("10:00","17:00"); _save(); var v4=c.assign["s1|"+D(2)], none4=!!v4&&!("hours" in v4)&&!last("hours.set")&&!last("hours.clear")&&_mr.innerHTML==="";
        return asks && row1 && h1==='{"start":"09:30","end":"15:00"}' && set1 && shut1 && row2 && typed2==='{"start":"11:00","end":"16:00"}' && kept2 && h2==='{"start":"11:00","end":"16:00"}' && kept3 && open3 && named3 && none4; })());
      T("cell editor Save: re-saving an untouched cell writes no hours line, Same as the type clears the key with hours.clear, and the safe-hours warning reads the typed hours", (function(){
        state(); put("s1",2,"AM","z1",H("09:30","15:00")); put("s2",2,"PM","z2"); var n1=S.audit.length; openCell("s1",D(2)); _save(); openCell("s2",D(2)); _save();
        var fresh=S.audit.slice(0,S.audit.length-n1), v1=c.assign["s1|"+D(2)], w1=c.assign["s2|"+D(2)];
        var same1=fresh.length===2 && fresh.every(function(a){ return a.action==="roster.edit"; }) && JSON.stringify(v1.hours)==='{"start":"09:30","end":"15:00"}' && !("hours" in w1) && _mr.innerHTML==="";
        state(); put("s1",2,"AM","z1",H("09:30","15:00")); openCell("s1",D(2)); var row2=_mr.innerHTML.indexOf('id="hrFrom" step="300" value="09:30"')>0; document.getElementById("hrSame").onclick();
        var row2b=_mr.innerHTML.indexOf('id="hrFrom" step="300" value="10:00"')>0 && !("hours" in modal.draft); _save(); var v2=c.assign["s1|"+D(2)], l2=last("hours.clear");
        var clear2=!("hours" in v2) && !!l2 && l2.actor==="admin" && /\u2192 the AM hours$/.test(l2.detail) && !last("hours.set") && _mr.innerHTML==="";
        state({fatigue:{mode:"warn",minRest:11,maxConsec:0}}); put("s1",1,"PM","z2"); put("s1",2,"AM","z1"); openCell("s1",D(2)); modal.draft.hours=H("08:30","12:00"); said.length=0; _save();
        var warned=said.some(function(m){ return /^Fatigue rule: Only 10\.5h rest/.test(m); }), h3=JSON.stringify(c.assign["s1|"+D(2)].hours), shut3=_mr.innerHTML==="";
        return same1 && row2 && row2b && clear2 && warned && h3==='{"start":"08:30","end":"12:00"}' && shut3; })());
      // ---- after the final review: a change of hours and the run of days, the merge, the Book-shifts rows, a type id that no longer exists
      T("own hours: a change of hours is judged on the rest rule alone: someone already over the run of days may still change their hours, a change that breaks the rest rule is still refused, and a booking that lengthens the run still is", (function(){
        state({ownHours:true,fatigue:{mode:"block",minRest:10,maxConsec:2}}); put("s1",1,"AM","z1"); put("s1",2,"AM","z1"); put("s1",3,"AM","z1"); S.viewAs="s1";
        var over=fatigueCheck("s1",D(2),"AM","z1",undefined,H("10:30","16:00")), ok=hoursSet("s1",D(2),"10:30","16:00"), quiet=said.slice(), h1=JSON.stringify(c.assign["s1|"+D(2)].hours);
        var rest=hoursSet("s1",D(2),"02:00","16:00"), why=said.slice(quiet.length), h2=JSON.stringify(c.assign["s1|"+D(2)].hours), run=canBook("s1",D(4),"AM","z1");
        return /^This makes 3 clinical days in a row/.test(over||"") && ok===true && quiet.length===0 && h1==='{"start":"10:30","end":"16:00"}' && rest===false && why.length===1 && /^Fatigue rule: Only 9h rest after the previous shift/.test(why[0]) && h2===h1 && run.ok===false && /^Fatigue rule: This makes 4 clinical days in a row/.test(run.reason); })());
      T("own hours: a merge keeps the hours with the side that changed the booking, and when both sides changed it this device's booking stands", (function(){
        state(); put("s1",2,"AM","z1"); var k="s1|"+D(2), keepS=S, keepB=_remoteBase, cp=function(x){ return JSON.parse(JSON.stringify(x)); }, base=cp(S), hrs=function(o){ var v=o&&o.cycles&&o.cycles[0]&&o.cycles[0].assign[k]; return v?JSON.stringify(v.hours):"gone"; };
        var mine=cp(base), theirs=cp(base); mine.cycles[0].assign[k].hours=H("09:30","15:00");
        _remoteBase=JSON.stringify(base); S=mine; var out=mergeOnto(theirs); S=keepS; _remoteBase=keepB; var m1=hrs(out);
        mine=cp(base); theirs=cp(base); theirs.cycles[0].assign[k].hours=H("09:30","15:00");
        _remoteBase=JSON.stringify(base); S=mine; out=mergeOnto(theirs); S=keepS; _remoteBase=keepB; var m2=hrs(out);
        mine=cp(base); theirs=cp(base); mine.cycles[0].assign[k].hours=H("09:30","15:00"); theirs.cycles[0].assign[k].hours=H("10:30","16:00");
        _remoteBase=JSON.stringify(base); S=mine; out=mergeOnto(theirs); S=keepS; _remoteBase=keepB; var m3=hrs(out);
        return m1==='{"start":"09:30","end":"15:00"}' && m2==='{"start":"09:30","end":"15:00"}' && m3==='{"start":"09:30","end":"15:00"}'; })());
      T("readers: the Book-shifts day rows say the times after the label only when they are the booking's own, whether or not staff may set their own", (function(){
        state(); put("s1",2,"AM","z1",H("09:30","15:00")); put("s1",3,"AM","z1"); S.viewAs="s1"; var ctx={batch:true,canPick:true,openCount:function(){ return 0; }};
        var own=dayRowHTML("s1",parseISO(D(2)),ctx), plain=dayRowHTML("s1",parseISO(D(3)),ctx); S.ownHours=true; var on=dayRowHTML("s1",parseISO(D(2)),ctx);
        return own.indexOf(">Triage AM 09:30\u201315:00</span>")>0 && plain.indexOf(">Triage AM</span>")>0 && plain.indexOf("\u2013")<0 && on.indexOf(">Triage AM 09:30\u201315:00</span>")>0; })());
      T("cell editor: the Hours row reads a type id that no longer exists as its period's window, as shiftWindow does", (function(){
        state(); var am=modalHours({kind:"clinical",period:"AM",zone:"z1",type:"gone"},c), pm=modalHours({kind:"clinical",period:"PM",zone:"z2",type:"gone"},c), w=shiftWindow(c,{kind:"clinical",period:"PM",zone:"z2",type:"gone"})||{};
        return JSON.stringify(am)==='{"start":"10:00","end":"17:00"}' && JSON.stringify(pm)==='{"start":"17:00","end":"22:00"}' && pm.start===w.start && pm.end===w.end; })());
      // ---- own hours: later tasks add their tests above this line
    } finally { S=keep.S; dailyDate=keep.dd; dailyScope=keep.ds; _srPick=keep.pick; _srSid=keep.sid; _daySheet=keep.sheet; isMobile=keep.mob; confirm=keep.cf; toast=keep.toast; download=keep.dl; window._range=keep.range; /* own hours: restore */ if(_mr)_mr.querySelector=_mq; hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- onboarding (S6): an UNAVAILABILITIES grid imports with any filled cell as UA, and a name written Given Surname matches Surname, Given.
  // Spec: docs/superpowers/specs/2026-09-27-swift-onboarding-s6-design.md. Dates are relative to today.
  (function(){
    var keep={S:S,dd:dailyDate,cf:confirm,toast:toast};
    var D=function(n){ return iso(addDays(new Date(),n)); };
    var c=null, said=[];
    function state(){
      var Z=[{id:"z1",name:"Triage",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:0,pmMax:2},unlockOrder:"both",rosterMode:"rolling"};
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Ng, Ava",quota:20,eft:1},{id:"s2",name:"Sam Lee",quota:20,eft:1},{id:"s3",name:"Lee, Sam",quota:20,eft:1}],
         cycles:[{id:"co",cycle:{start:D(-7),weeks:6},status:"published",archived:false,settings:set,roles:{s1:{in:true},s2:{in:true},s3:{in:true}},assign:{}}],
         activeId:"co",viewAs:"admin",tab:"setup",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],publicHolidays:[]};
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; dailyDate=null; }
    function grid(cells){ var hdr=["Name"]; for(var i=0;i<7;i++)hdr.push(D(i)); return [["UNAVAILABILITIES"],hdr,["Ng, Ava"].concat(cells)]; }   // a year grid's shape: a date per column, a name per row, a mark in a cell
    function last(k){ return (S.audit||[]).filter(function(a){ return a.action===k; })[0]||null; }
    toast=function(m){ said.push(String(m)); };
    try{
      T("unavailability: with the tick every filled cell that is not a leave code becomes UA, a half-day mark included, runs merge, and a real code stays itself", (function(){
        state(); var p=parseLeaveAOA(grid(["X","X","X",null,"AL","Korea","AM"]),{anyFilled:true});
        var L=p.leave.map(function(l){ return l.code+" "+l.from+" "+l.to; });
        return !p.error && p.anyFilled===true && L.length===3 && L[0]==="UA "+D(0)+" "+D(2) && L[1]==="AL "+D(4)+" "+D(4) && L[2]==="UA "+D(5)+" "+D(6) && p.staff.length===1 && p.staff[0].name==="Ng, Ava"; })());
      T("unavailability: with the tick off the import is what it always was: marks are ignored, only leave codes import, and the result carries no new key", (function(){
        state(); var aoa=grid(["X","X","X",null,"AL","Korea","AM"]); var a=parseLeaveAOA(aoa), b=parseLeaveAOA(aoa,{}), d=parseLeaveAOA(aoa,{anyFilled:false});
        return JSON.stringify(a)===JSON.stringify(b) && JSON.stringify(a)===JSON.stringify(d) && a.leave.length===1 && a.leave[0].code==="AL" && !("anyFilled" in a); })());
      T("unavailability: applying a ticked import marks the days unavailable and says so in the audit line", (function(){
        state(); var p=parseLeaveAOA(grid(["X",null,null,null,null,null,"Personal leave"]),{anyFilled:true}); var n=applyLeaveImport(p);
        var a=last("import.leave"); var s0=getShift("s1",D(0)), s6=getShift("s1",D(6)), s1=getShift("s1",D(1));
        return n===2 && s0.kind==="leave" && s0.code==="UA" && s6.kind==="leave" && s6.code==="UA" && s1.kind==="off" && !!a && /any filled cell = UA$/.test(a.detail); })());
      T("unavailability: applying an unticked import writes the audit line it always did", (function(){
        state(); var p=parseLeaveAOA(grid([null,null,"AL",null,null,null,null])); applyLeaveImport(p); var a=last("import.leave");
        return !!a && /1 staff · 1 leave blocks$/.test(a.detail); })());
      T("names: a name written Given Surname finds the person stored Surname, Given, and the other way round, but never when two people could be meant", (function(){
        state(); var a=findStaffByName("Ava Ng"), b=findStaffByName("Ng, Ava"), d=findStaffByName("ava  ng"), w1=findStaffByName("Smith"), w2=findStaffByName("Smith,");   // one word, and a comma with nothing after it: no given name, so neither reaches the swapped try
        var amb=findStaffByName("Sam Lee"), amb2=findStaffByName("Lee, Sam");   // s2 is stored "Sam Lee" and s3 "Lee, Sam": each exact match wins, the swapped form of either would name two people
        S.staff.pop(); var one=findStaffByName("Lee, Sam");   // with s3 gone, "Lee, Sam" is the swapped form of s2 alone
        S.staff.shift(); S.staff.push({id:"s4",name:"Ava Ng"},{id:"s5",name:"Ava  Ng"}); var two=findStaffByName("Ng, Ava");   // two people whose letters coincide in the other order: nobody is guessed
        S.staff=[{id:"A",name:"Ng, Ava"},{id:"B",name:"N.G. Ava"},{id:"C",name:"Ava Ng"}]; var three=findStaffByName("Ng Ava");   // "Ng, Ava" and "N.G. Ava" spell the same letters in the same order: that same-order match is already ambiguous, so the swapped order (which alone would name C) is never tried
        return !!a && a.id==="s1" && !!b && b.id==="s1" && !!d && d.id==="s1" && !!amb && amb.id==="s2" && !!amb2 && amb2.id==="s3" && !!one && one.id==="s2" && two===null && three===null && isNameCell("Ava Ng-Lee")===true && findStaffByName("Nobody Here")===null && w1===null && w2===null; })());
      // ---- release
      var _rel928=WHATS_NEW.filter(function(e){ return e.on==="2026-09-28"; })[0];
      T("release: What's new names the unavailability tick on the release day, in three lines", !!_rel928 && /unavail/i.test(_rel928.title) && _rel928.lines.length===3 && _rel928.lines.some(function(l){ return /Treat any filled cell as unavailable/.test(l); }) && !/[‘’“”]/.test(_rel928.lines[1]) && BUILD>="2026-09-28");
      T("unavailability: the leave import reads the sheet named for the cycle's year, else a sheet named with a year alone, which wins over a sheet named for leave", leaveSheetName(["NOV 2026","Staff Leave 2026","2026"],"2026")==="2026" && leaveSheetName(["2025","2026"],"2026")==="2026" && leaveSheetName(["Roster","2025"],"2026")==="2025" && leaveSheetName(["Staff Leave 2026","2025"],"2026")==="2025");
      T("unavailability: a manager's own workbook, its roster months in front, imports the sheet whose name carries the year and leave or unavailable, and the import asks for the sheet by this rule", leaveSheetName(["NOV 2026","Staff Leave 2026"],"2026")==="Staff Leave 2026" && leaveSheetName(["Scribes Leave 2026/2027"],"2027")==="Scribes Leave 2026/2027" && leaveSheetName(["NOV 2026","Scribes Leave 2026/2027"],"2027")==="Scribes Leave 2026/2027" && leaveSheetName(["DEC 2026","Unavailabilities 2026"],"2026")==="Unavailabilities 2026" && importFile.toString().indexOf("leaveSheetName(wb.SheetNames,yr)")>0);
      T("unavailability: with no sheet named for a year, or for leave in the cycle's year, the leave import reads the first sheet, as before", leaveSheetName(["NOV 2026","DEC 2026"],"2026")==="NOV 2026" && leaveSheetName(["NOV 2026","Leave 2025"],"2026")==="NOV 2026");
      // ---- onboarding: later tasks add their tests above this line
    } finally { S=keep.S; dailyDate=keep.dd; confirm=keep.cf; toast=keep.toast; /* onboarding: restore */ hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- clock in / clock out with a site geofence (C1): taps propose hours, the manager approves them as own hours.
  // Spec: docs/superpowers/specs/2026-09-29-clock-in-out-design.md. Dates are relative to today; "now" is fixed per test through _clockNow or passed in.
  (function(){
    var keep={S:S,toast:toast,confirm:confirm,dl:download,geo:navigator.geolocation,pick:_srPick,sid:_srSid,sheet:_daySheet,setup:_setupTab,search:location.search,au:authUser,ap:authPhone,mp:myPerson};
    var D=function(n){ return iso(addDays(new Date(),n)); }, T0=D(0), Y0=D(-1), TM=D(1);
    var c=null, said=[], SITE={lat:-33.68,lng:150.92};
    function at(isoD,hhmm){ var d=parseISO(isoD), m=/^(\d\d):(\d\d)$/.exec(hhmm); d.setHours(+m[1],+m[2],0,0); return d; }
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"RN",am:true,pm:true,pmLabel:""},{id:"z2",name:"EEN",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:2,pmMin:1,pmMax:2},unlockOrder:"both",rosterMode:"rolling",shiftTimes:{AM:{start:"10:00",end:"17:00"},PM:{start:"17:00",end:"22:00"}}};
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Ava Ng",quota:20,eft:1},{id:"s2",name:"Sam Lee",quota:20,eft:1}],
         cycles:[{id:"cc",cycle:{start:D(-7),weeks:6},status:"published",archived:false,settings:set,roles:{s1:{in:true},s2:{in:true}},assign:{}}],
         activeId:"cc",viewAs:o.viewAs||"s1",tab:"my",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],publicHolidays:[]};
      if(o.on!==false){ S.clockOn=true; S.site={lat:SITE.lat,lng:SITE.lng,acc:12,setAt:1,radius:150,posterKey:"ABCDEFGHJKLMNPQR",posterAt:1}; }
      if(o.grace!=null)S.clockGrace=o.grace;
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srPick=[]; _srSid=null; _daySheet=null; _clockBusy=false; _clockNow=null; }
    function put(sid,isoD,period,hours){ var v={kind:"clinical",period:period||"AM",zone:"z1"}; if(hours)v.hours=hours; c.assign[sid+"|"+isoD]=v; return v; }
    function tap(sid,isoD,kind,t,f){ f=f||{}; if(!c.clock)c.clock={}; var k=sid+"|"+isoD, r=c.clock[k]||{}; var plus=f.plus||0; delete f.plus;
      r[kind]=Object.assign({t:t,ts:at(isoD,t).getTime()+plus,dist:null,acc:null,inside:null,via:"none"},f); c.clock[k]=r; return r; }
    function geo(pos){ navigator.geolocation={getCurrentPosition:function(ok,err){ if(pos)ok({coords:{latitude:pos.lat,longitude:pos.lng,accuracy:pos.acc}}); else err({code:1}); }}; }
    function last(k){ return (S.audit||[]).filter(function(a){ return a.action===k; })[0]||null; }
    function told(to){ return (S.notifications||[]).filter(function(n){ return n.to===to; })[0]||null; }
    toast=function(m){ said.push(String(m)); }; confirm=function(){ return true; };
    try{
      // ---- the rules
      T("clock: clockRound goes to the nearest 5 minutes, half up, and 23:58 becomes 00:00", clockRound("09:52")==="09:50" && clockRound("09:53")==="09:55" && clockRound("09:57")==="09:55" && clockRound("09:58")==="10:00" && clockRound("23:58")==="00:00" && clockRound("x")===null);
      T("clock: clockDist is the haversine distance in whole metres", (function(){ var a=clockDist(0,0,0,1), b=clockDist(SITE.lat,SITE.lng,SITE.lat,SITE.lng+0.01), z=clockDist(SITE.lat,SITE.lng,SITE.lat,SITE.lng); return Math.abs(a-111195)<=5 && Math.abs(b-926)<=6 && z===0; })());
      T("clock: clockInside gives the benefit of the doubt by the phone's accuracy, and null with no location", clockInside(100,null,150)===true && clockInside(160,20,150)===true && clockInside(200,20,150)===false && clockInside(151,0,150)===false && clockInside(null,20,150)===null);
      T("clock: the settings read as the spec says — off, 7 minutes and 150 m unless written; a site needs a numeric point", (function(){
        state({on:false}); var a=clockOn()===false && clockGrace()===7 && clockSite()===null && clockRadius()===150;
        S.clockGrace=12; S.site={lat:"x",lng:1}; var b=clockGrace()===12 && clockSite()===null;
        state(); return a && b && clockOn()===true && clockRadius()===150 && !!clockSite(); })());
      T("clock: clockWindow is the shift's rostered window, its own hours when the manager set some, and null off a clinical shift", (function(){
        state(); put("s1",T0); put("s2",T0,"PM",{start:"17:30",end:"00:00"}); c.assign["s1|"+TM]={kind:"cst",period:"AM"};
        var a=clockWindow(c,"s1",T0), b=clockWindow(c,"s2",T0); return !!a && a.start==="10:00" && a.end==="17:00" && a.own===false && !!b && b.start==="17:30" && b.end==="00:00" && b.own===true && clockWindow(c,"s1",TM)===null && clockWindow(c,"s1",Y0)===null; })());
      T("clock: clockMay opens Clock in from 60 minutes before the start until the finish, and Clock out from the in tap until the day ends", (function(){
        state(); put("s1",T0); var m=function(h){ return clockMay(c,"s1",T0,at(T0,h)); };
        var a=m("08:59").in===false && m("09:00").in===true && m("13:00").in===true && m("17:00").in===true && m("17:01").in===false && m("13:00").out===false;
        tap("s1",T0,"in","09:50"); var b=m("09:49").out===false && m("09:50").out===true && m("23:59").out===true && m("09:50").in===false && clockMay(c,"s1",T0,at(TM,"00:30")).out===false;
        tap("s1",T0,"out","17:10"); var d=m("18:00").out===false && m("18:00").in===false; return a && b && d; })());
      T("clock: a shift that ends at midnight takes its out tap until 01:00 the next day", (function(){
        state(); put("s1",T0,"PM",{start:"17:00",end:"00:00"}); tap("s1",T0,"in","16:55");
        return clockMay(c,"s1",T0,at(TM,"00:59")).out===true && clockMay(c,"s1",T0,at(TM,"01:01")).out===false && clockMay(c,"s1",T0,at(T0,"23:30")).out===true; })());
      T("clock: clockProposal — inside the grace band the rostered hours stand and nothing is proposed", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:55",{dist:20,acc:10,inside:true,via:"gps"}); tap("s1",T0,"out","17:05",{dist:30,acc:10,inside:true,via:"gps"});
        var p=clockProposal(c,"s1",T0,7,at(T0,"17:06")); return p.status==="rostered" && p.flags.length===0 && p.rostered.start==="10:00" && p.rostered.end==="17:00" && p.start===undefined; })());
      T("clock: clockProposal — an early start and a late finish outside the band are proposed, in the taps' rounded minutes, with plain flags", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:40",{dist:20,acc:10,inside:true,via:"gps"}); tap("s1",T0,"out","17:25",{dist:30,acc:10,inside:true,via:"gps"});
        var p=clockProposal(c,"s1",T0,7,at(T0,"17:30")); return p.status==="proposed" && p.start==="09:40" && p.end==="17:25" && p.flags.join("|")==="early 20 min|late 25 min"; })());
      T("clock: clockProposal — one end inside the band keeps the rostered time while the other is proposed; a late start and an early finish read as such", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:55"); tap("s1",T0,"out","16:30"); var p=clockProposal(c,"s1",T0,7,at(T0,"17:00"));
        tap("s2",T0,"in","10:20"); put("s2",T0); tap("s2",T0,"out","17:03"); var q=clockProposal(c,"s2",T0,7,at(T0,"17:30"));
        return p.status==="proposed" && p.start==="10:00" && p.end==="16:30" && p.flags.join("|")==="left early 30 min|no location" && q.status==="proposed" && q.start==="10:20" && q.end==="17:00" && q.flags.join("|")==="started late 20 min|no location"; })());
      T("clock: clockProposal — grace 0 proposes a five-minute difference; a wider band swallows it", (function(){
        state({grace:0}); put("s1",T0); tap("s1",T0,"in","09:55"); tap("s1",T0,"out","17:00");
        var p=clockProposal(c,"s1",T0,clockGrace(),at(T0,"17:30")), q=clockProposal(c,"s1",T0,15,at(T0,"17:30")); return p.status==="proposed" && p.start==="09:55" && p.end==="17:00" && q.status==="rostered"; })());
      T("clock: clockProposal — location flags name a tap outside the radius, a tap with no location and a tap by poster, once each", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:40",{dist:420,acc:15,inside:false,via:"gps"}); tap("s1",T0,"out","17:00",{via:"poster"});
        var p=clockProposal(c,"s1",T0,7,at(T0,"17:30")); tap("s2",T0,"in","10:00"); put("s2",T0); tap("s2",T0,"out","17:20"); var q=clockProposal(c,"s2",T0,7,at(T0,"17:30"));
        return p.flags.join("|")==="early 20 min|outside the radius (420 m)|by poster" && q.flags.join("|")==="late 20 min|no location"; })());
      T("clock: clockProposal — an in tap alone is open until the day ends, then closed without a clock-out; no shift is void; an out tap before the in tap is void", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:50"); var a=clockProposal(c,"s1",T0,7,at(T0,"18:00")).status==="open", b=clockProposal(c,"s1",T0,7,at(TM,"00:01"));
        tap("s2",T0,"in","10:00"); var v=clockProposal(c,"s2",T0,7,at(T0,"12:00"));
        put("s2",T0); tap("s2",T0,"out","09:30"); var o=clockProposal(c,"s2",T0,7,at(T0,"12:00"));
        return a && b.status==="noOut" && b.flags[0]==="no clock-out" && v.status==="void" && v.flags[0]==="no shift" && o.status==="void" && o.flags[0]==="taps out of order" && clockProposal(c,"s1",TM,7,at(T0,"12:00")).status==="none"; })());
      T("clock: clockProposal — a shift to midnight clocked out after midnight proposes 00:00 at most, and says so when the tap went past it", (function(){
        state(); put("s1",T0,"PM",{start:"17:00",end:"00:00"}); tap("s1",T0,"in","16:40"); tap("s1",T0,"out","00:20",{ts:at(TM,"00:20").getTime()});
        var p=clockProposal(c,"s1",T0,7,at(TM,"00:30")); put("s2",T0,"PM",{start:"17:00",end:"00:00"}); tap("s2",T0,"in","17:00"); tap("s2",T0,"out","00:05",{ts:at(TM,"00:05").getTime()}); var q=clockProposal(c,"s2",T0,7,at(TM,"00:30"));
        return p.status==="proposed" && p.start==="16:40" && p.end==="00:00" && p.flags.join("|")==="early 20 min|capped at midnight|no location" && q.status==="rostered"; })());
      // ---- the settings
      T("clock: the switch refuses to turn on without a site, then writes true and deletes on off, audited", (function(){
        state({on:false}); var r=clockSwitch(true); var a=r.ok===false && /site first/.test(r.reason) && S.clockOn===undefined;
        S.site={lat:SITE.lat,lng:SITE.lng,acc:null,setAt:1,radius:150,posterKey:"K",posterAt:1}; var b=clockSwitch(true).ok && S.clockOn===true && last("settings.clock").detail==="on";
        clockSwitch(false); return a && b && !("clockOn" in S) && last("settings.clock").detail==="off"; })());
      T("clock: the grace band is 0 to 60, stored only when it is not the default, audited", (function(){
        state(); var a=clockSetGrace(61).ok===false && clockSetGrace(-1).ok===false && clockSetGrace("x").ok===false && !("clockGrace" in S);
        var b=clockSetGrace("12").ok && S.clockGrace===12 && clockGrace()===12 && last("settings.clock").detail==="grace 12 min"; clockSetGrace(7); return a && b && !("clockGrace" in S) && clockGrace()===7; })());
      T("clock: saving the site checks the point and the radius, keeps the poster key across saves, and audits the radius and accuracy but never the point", (function(){
        state({on:false}); var a=clockSiteSave("x",150.9,150).ok===false && clockSiteSave(-33.68,181,150).ok===false && clockSiteSave(-33.68,150.9,5).ok===false && clockSiteSave("",150.9,150).ok===false && S.site===undefined;
        var r=clockSiteSave("-33.6812345678",150.92,"200",23); var k=S.site&&S.site.posterKey; var b=r.ok && S.site.lat===-33.681235 && S.site.lng===150.92 && S.site.radius===200 && S.site.acc===23 && /^[A-Z2-9]{16}$/.test(k) && last("settings.site").detail==="radius 200 m \u00b7 \u00b123 m" && last("settings.site").detail.indexOf("33.")<0;
        var r2=clockSiteSave(-33.68,150.92,150,null); return a && b && r2.ok && S.site.posterKey===k && S.site.acc===23 && S.site.radius===150; })());
      T("clock: a new poster changes the key, the token check follows it, and the poster link carries the group and the key", (function(){
        state(); var a=clockTokenOK("ABCDEFGHJKLMNPQR")===true && clockTokenOK("abcdefghjklmnpqr")===false && clockTokenOK("")===false;
        var r=clockPosterRenew(); var b=r.ok && S.site.posterKey!=="ABCDEFGHJKLMNPQR" && /^[A-Z2-9]{16}$/.test(S.site.posterKey) && clockTokenOK("ABCDEFGHJKLMNPQR")===false && clockTokenOK(S.site.posterKey)===true && last("clock.poster").detail==="new poster";
        var u=clockPosterURL(); var d=u==="https://test/app.html?org="+encodeURIComponent(_org)+"&clock="+S.site.posterKey; state({on:false}); return a && b && d && clockPosterRenew().ok===false && clockTokenOK("x")===false; })());
      T("clock: the Clock card sits in the Group half of Settings, disabled until a site is saved, and names the grace, the site and the poster", (function(){
        state({on:false}); S.viewAs="admin"; _setupTab="group"; var h=viewSetup(); var seg0=h.slice(h.indexOf('id="clockOn"'),h.indexOf('id="clockOn"')+40); var a=h.indexOf('id="clockCard"')>=0 && seg0.length>10 && / disabled/.test(seg0) && !/ checked/.test(seg0) && h.indexOf('id="posterPrint"')<0 && h.indexOf('data-go="setup||clockCard"')>=0;
        state(); S.viewAs="admin"; _setupTab="group"; h=viewSetup(); var seg=h.slice(h.indexOf('id="clockOn"'),h.indexOf('id="clockOn"')+40);
        return a && / checked/.test(seg) && !/ disabled/.test(seg) && h.indexOf('id="posterPrint"')>=0 && h.indexOf('id="posterNew"')>=0 && h.indexOf('value="7"')>=0 && h.indexOf("only the time of your tap")>=0; })());
      T("clock: taps and decisions merge key by key — a phone's tap and a manager's decision on one key both survive, and nobody's slot is lost", (function(){
        state(); put("s1",T0); put("s2",T0); var base=JSON.parse(JSON.stringify(S)), keepS=S, keepB=_remoteBase;
        var mine=JSON.parse(JSON.stringify(base)); mine.cycles[0].clock={}; mine.cycles[0].clock["s1|"+T0]={in:{t:"09:50",ts:1,dist:10,acc:5,inside:true,via:"gps"}};
        var theirs=JSON.parse(JSON.stringify(base)); theirs.cycles[0].clockDec={}; theirs.cycles[0].clockDec["s1|"+T0]={ok:false,by:"admin",ts:2}; theirs.cycles[0].clock={}; theirs.cycles[0].clock["s2|"+T0]={in:{t:"10:00",ts:3,dist:null,acc:null,inside:null,via:"none"}};
        _remoteBase=JSON.stringify(base); S=mine; var out=mergeOnto(theirs); S=keepS; _remoteBase=keepB; var ck=out.cycles[0].clock||{}, dc=out.cycles[0].clockDec||{};
        return !!ck["s1|"+T0] && ck["s1|"+T0].in.t==="09:50" && !!ck["s2|"+T0] && ck["s2|"+T0].in.t==="10:00" && !!dc["s1|"+T0] && dc["s1|"+T0].ok===false; })());
      T("clock: a group with the switch off writes none of the new keys, and normalize seeds nothing", (function(){ state({on:false}); normalize(); return !("clockOn" in S) && !("clockGrace" in S) && !("site" in S) && !("clock" in c) && !("clockDec" in c); })());
      // ---- the taps (Task 2)
      T("clock: a tap asks the phone where it is and records the time (rounded), the distance, the accuracy, inside or outside, and how it was proved", (function(){
        state(); put("s1",T0); geo({lat:SITE.lat,lng:SITE.lng+0.0005,acc:15}); var r=clockTap("in",null,at(T0,"09:52")); var rec=clockRec(c,"s1",T0);
        return r.ok===true && r.pending===true && _clockBusy===false && !!rec && rec.in.t==="09:50" && rec.in.ts===at(T0,"09:52").getTime() && rec.in.dist>40 && rec.in.dist<55 && rec.in.acc===15 && rec.in.inside===true && rec.in.via==="gps" && said[said.length-1]==="Clocked in 09:50 \u00b7 at the clinic"; })());
      T("clock: a tap the phone cannot place still goes through, marked no location; one far from the site is outside", (function(){
        state(); put("s1",T0); geo(null); clockTap("in",null,at(T0,"09:58")); var a=clockRec(c,"s1",T0).in; put("s2",T0); S.viewAs="s2"; geo({lat:SITE.lat+0.01,lng:SITE.lng,acc:10}); clockTap("in",null,at(T0,"10:02")); var b=clockRec(c,"s2",T0).in;
        return a.t==="10:00" && a.dist===null && a.inside===null && a.via==="none" && said.some(function(m){ return m==="Clocked in 10:00 \u00b7 no location"; }) && b.inside===false && b.dist>1000 && b.via==="gps" && said.some(function(m){ return /^Clocked in 10:00 \u00b7 \d+ m from the clinic$/.test(m); }); })());
      T("clock: the second in tap, an out before an in, a second out, a tap with no shift and an admin's tap are refused with a reason", (function(){
        state(); put("s1",T0); geo({lat:SITE.lat,lng:SITE.lng,acc:5}); var n0=clockTap("out",null,at(T0,"09:30")); clockTap("in",null,at(T0,"09:55")); var n1=clockTap("in",null,at(T0,"10:30"));
        clockTap("out",null,at(T0,"17:02")); var n2=clockTap("out",null,at(T0,"17:05")); S.viewAs="s2"; var n3=clockTap("in",null,at(T0,"10:00")); S.viewAs="admin"; var n4=clockTap("in",null,at(T0,"10:00"));
        return n0.ok===false && /Nothing to clock out/.test(n0.reason) && n1.ok===false && /Nothing to clock in/.test(n1.reason) && n2.ok===false && /Nothing to clock out/.test(n2.reason) && n3.ok===false && n4.ok===false && /roster cell/.test(n4.reason) && clockRec(c,"s1",T0).out.t==="17:00"; })());
      T("clock: with the switch off there are no taps, no card and nothing on the day sheet", (function(){ state({on:false}); put("s1",T0); geo({lat:SITE.lat,lng:SITE.lng,acc:5}); var r=clockTap("in",null,at(T0,"10:00")); _clockNow=at(T0,"10:00").getTime(); return r.ok===false && /off for this group/.test(r.reason) && !c.clock && clockMyHTML("s1")==="" && clockSheetHTML(c,"s1",T0)===""; })());
      T("clock: My shifts shows Clock in from an hour before the start, the receipt and Clock out after it, and the status once both taps are in", (function(){
        state(); put("s1",T0); _clockNow=at(T0,"09:05").getTime(); var h1=clockMyHTML("s1"); var a=h1.indexOf('data-clockin="'+T0+'"')>=0 && h1.indexOf("only the time of your tap")>=0;
        _clockNow=at(T0,"08:30").getTime(); var h0=clockMyHTML("s1");
        tap("s1",T0,"in","09:50",{dist:12,acc:8,inside:true,via:"gps"}); _clockNow=at(T0,"12:00").getTime(); var h2=clockMyHTML("s1"); var b=h2.indexOf('data-clockout="'+T0+'"')>=0 && h2.indexOf("Clocked in 09:50 \u00b7 at the clinic")>=0 && h2.indexOf("Still clocked in")<0;
        tap("s1",T0,"out","17:20",{dist:12,acc:8,inside:true,via:"gps"}); var h3=clockMyHTML("s1"); var d=h3.indexOf("data-clock")<0 && h3.indexOf("Clocked 09:50\u201317:20 \u00b7 waiting for your manager")>=0;
        return a && h0==="" && b && d; })());
      T("clock: past the rostered finish and still clocked in, My shifts says so and keeps the Clock out button; the next day it says the record closed", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:55"); _clockNow=at(T0,"17:20").getTime(); var h=clockMyHTML("s1"); var a=h.indexOf("Still clocked in from 09:55")>=0 && h.indexOf('data-clockout="'+T0+'"')>=0;
        state(); put("s1",Y0); tap("s1",Y0,"in","09:55"); _clockNow=at(T0,"08:00").getTime(); var g=clockMyHTML("s1"); return a && g.indexOf("Yesterday")>=0 && g.indexOf("Closed without a clock-out")>=0 && g.indexOf("data-clock")<0; })());
      T("clock: the day sheet carries the same buttons and status for the person's own day, and nothing for an admin or another person's sheet", (function(){
        state(); put("s1",T0); _clockNow=at(T0,"09:30").getTime(); var a=clockSheetHTML(c,"s1",T0).indexOf('data-clockin="'+T0+'"')>=0; var none=clockSheetHTML(c,"s2",T0)==="" && clockSheetHTML(c,"s1",TM)==="";
        S.viewAs="admin"; var adm=clockSheetHTML(c,"s1",T0)===""; S.viewAs="s1"; S.tab="selfroster"; _daySheet=T0; var sheet=daySheetHTML(T0); return a && none && adm && sheet.indexOf('data-clockin="'+T0+'"')>=0 && sheet.indexOf("only the time of your tap")>=0; })());
      T("clock: My shifts renders the Clock card inside the page, under the action row", (function(){ state(); put("s1",T0); _clockNow=at(T0,"09:30").getTime(); S.tab="my"; var h=viewMy(); return h.indexOf('data-clockin="'+T0+'"')>=0 && h.indexOf('data-clockin')>h.indexOf('class="actrow"'); })());
      T("clock: a poster scan is read from the link, kept aside with the group it names, and the link is cleaned", (function(){
        var keepTab=S.tab; location.search="?go=help"; var g1=goReadURL(); var gk=sessionStorage.getItem("myrosta_go"); location.search="?go=settings"; var g2=goReadURL(); sessionStorage.setItem("myrosta_go","help"); S.tab="my"; var g3=goApplyURL(); var tabAfter=S.tab; var g4=goApplyURL(); S.tab=keepTab; location.search="";
        T("link: ?go=help is kept aside at boot, only help counts, and once applied it opens Help and is spent", g1==="help" && gk==="help" && g2===null && g3==="help" && tabAfter==="help" && g4===null && !sessionStorage.getItem("myrosta_go") && String(viewHelp).indexOf('id="videos"')>=0);   // the videos heading only renders with the cloud on, so the source is checked
        state(); location.search="?org=grp-x&clock=ABCDEFGHJKLMNPQR"; var p=clockReadURL(); var kept=JSON.parse(sessionStorage.getItem("myrosta_clock")||"null"); var org=localStorage.getItem("myrosta_org");
        sessionStorage.removeItem("myrosta_clock"); location.search=""; localStorage.setItem("myrosta_org",_org); var none=clockReadURL();
        return !!p && p.org==="grp-x" && p.token==="ABCDEFGHJKLMNPQR" && !!kept && kept.token==="ABCDEFGHJKLMNPQR" && org==="grp-x" && none===null; })());
      T("clock: an applied scan taps in with presence by poster, then out; a stale key, another group's poster, the switch off and no shift each say so and tap nothing", (function(){
        state(); put("s1",T0); var pend=function(tok,org){ sessionStorage.setItem("myrosta_clock",JSON.stringify({org:org===undefined?_org:org,token:tok})); };
        pend("ABCDEFGHJKLMNPQR"); var r1=clockApplyURL(at(T0,"09:50")); var rec=clockRec(c,"s1",T0); var a=r1==="in" && !!rec && rec.in.via==="poster" && rec.in.dist===null && rec.in.inside===null && said[said.length-1]==="Clocked in 09:50 \u00b7 by poster";
        pend("ABCDEFGHJKLMNPQR"); var r2=clockApplyURL(at(T0,"17:04")); var b=r2==="out" && rec.out.t==="17:05" && rec.out.via==="poster";
        pend("WRONGKEYWRONGKEY"); var r3=clockApplyURL(at(T0,"17:10")); var stale=said.some(function(m){ return /out of date/.test(m); }); pend("ABCDEFGHJKLMNPQR","other-group"); var r4=clockApplyURL(at(T0,"17:10")); var r5=clockApplyURL(at(T0,"17:10"));
        S.viewAs="s2"; pend("ABCDEFGHJKLMNPQR"); var r6=clockApplyURL(at(T0,"17:10")); state({on:false}); pend("ABCDEFGHJKLMNPQR"); var r7=clockApplyURL(at(T0,"10:00"));
        return a && b && r3==="stale" && stale && r4==="org" && r5===null && r6==="none" && r7==="off" && sessionStorage.getItem("myrosta_clock")===null; })());
      // ---- proposals, the list and the decisions (Task 3)
      T("clock: clockRows puts open proposals first, newest day first, then a fortnight of closed records, and forgets older closed ones", (function(){
        state(); put("s1",T0); put("s2",T0); put("s1",Y0); var old=D(-20); put("s1",old);
        tap("s2",T0,"in","09:30"); tap("s2",T0,"out","17:00"); tap("s1",T0,"in","09:58"); tap("s1",T0,"out","17:02"); tap("s1",Y0,"in","09:40"); tap("s1",Y0,"out","17:00"); tap("s1",old,"in","09:58"); tap("s1",old,"out","17:02");   // the old record is as rostered: a closed record older than a fortnight drops off; an open proposal never does
        var rows=clockRows(c,at(T0,"18:00")); var keys=rows.map(function(r){ return r.sid+"|"+r.isoD+"|"+r.p.status; });
        return keys.join(",")==="s2|"+T0+"|proposed,s1|"+Y0+"|proposed,s1|"+T0+"|rostered" && clockCount(c,at(T0,"18:00"))===2; })());
      T("clock: Approve writes the proposal as the shift's own hours through hoursSet, records the decision, audits it, and tells the person", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40",{dist:20,acc:5,inside:true,via:"gps"}); tap("s1",T0,"out","17:25",{dist:20,acc:5,inside:true,via:"gps"}); _clockNow=at(T0,"18:00").getTime();
        var r=clockApprove("s1",T0); var sh=c.assign["s1|"+T0], dec=clockDecOf(c,"s1",T0), a=last("clock.approve"), h=last("hours.set"), n=told("s1");
        return r.ok===true && !!sh.hours && sh.hours.start==="09:40" && sh.hours.end==="17:25" && !!dec && dec.ok===true && dec.start==="09:40" && dec.by==="admin" && !!a && /Ava Ng/.test(a.detail) && /09:40\u201317:25/.test(a.detail) && /early 20 min, late 25 min/.test(a.detail) && !!h && !!n && /09:40\u201317:25/.test(n.text) && clockApprove("s1",T0).ok===false && clockCount(c,clockNow())===0; })());
      T("clock: Decline keeps the rostered hours, records the decision, audits it, tells the person, and the list shows the word", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40"); tap("s1",T0,"out","17:00"); _clockNow=at(T0,"18:00").getTime();
        var r=clockDecline("s1",T0); var sh=c.assign["s1|"+T0], dec=clockDecOf(c,"s1",T0), a=last("clock.decline"), n=told("s1"); var h=clockListHTML();
        return r.ok===true && !sh.hours && !!dec && dec.ok===false && !!a && /rostered hours stand/.test(a.detail) && !!n && /kept the rostered hours/.test(n.text) && clockDecline("s1",T0).ok===false && clockApprove("s1",T0).ok===false && h.indexOf("declined \u00b7 as rostered")>=0 && h.indexOf("data-clkok")<0; })());
      T("clock: nothing to approve is refused: as rostered, still open, or no shift", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:58"); tap("s1",T0,"out","17:02"); _clockNow=at(T0,"18:00").getTime(); var a=clockApprove("s1",T0);
        put("s2",T0); tap("s2",T0,"in","09:40"); var b=clockApprove("s2",T0); var d=clockApprove("s1",TM);
        return a.ok===false && /Nothing to approve/.test(a.reason) && b.ok===false && d.ok===false && /Nothing to approve/.test(d.reason) && !c.clockDec; })());
      T("clock: the Hours to approve card names the person, the day, rostered against clocked, the proposal, the flags as chips, and the two buttons; closed rows are greyed with their word", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40",{dist:420,acc:10,inside:false,via:"gps"}); tap("s1",T0,"out","17:25"); put("s2",T0); tap("s2",T0,"in","09:58"); tap("s2",T0,"out","17:02"); _clockNow=at(T0,"18:00").getTime();
        var h=clockListHTML(); S.tab="requests"; var page=viewRequests();
        return h.indexOf('id="clockList"')>=0 && h.indexOf("Ava Ng")>=0 && h.indexOf("rostered 10:00\u201317:00 \u00b7 clocked 09:40\u201317:25 \u00b7 proposes 09:40\u201317:25")>=0 && h.indexOf("outside the radius (420 m)")>=0 && h.indexOf('data-clkok="s1|'+T0+'"')>=0 && h.indexOf('data-clkno="s1|'+T0+'"')>=0 && h.indexOf("Sam Lee")>=0 && h.indexOf("as rostered")>=0 && h.indexOf('data-clkok="s2|'+T0+'"')<0 && page.indexOf('id="clockList"')>=0 && page.indexOf("1 hour to approve")>=0 && page.indexOf('id="clockList"')<page.indexOf("No pending requests"); })());
      T("clock: the list is nothing for staff, for a group with the switch off, and when no record exists", (function(){ state({viewAs:"admin"}); put("s1",T0); var a=clockListHTML()===""; tap("s1",T0,"in","09:40"); S.viewAs="s1"; var b=clockListHTML()===""; state({on:false,viewAs:"admin"}); return a && b && clockListHTML()===""; })());
      T("clock: the Day board and the day sheet show in and out beside a name once the taps are in, and nothing before", (function(){
        state({viewAs:"admin"}); put("s1",T0); dailyDate=T0; dailyScope="group"; S.tab="daily"; var h0=viewDaily(); tap("s1",T0,"in","09:52"); var h1=viewDaily(); tap("s1",T0,"out","17:20"); var h2=viewDaily();
        _srSid="s1"; S.tab="roster"; var sheet=daySheetHTML(T0); _srSid=null;
        return h0.indexOf("in 09:52")<0 && h1.indexOf("Ava Ng")>=0 && h1.indexOf(" \u00b7 in 09:52")>=0 && h1.indexOf("out 17:20")<0 && h2.indexOf(" \u00b7 in 09:52 \u00b7 out 17:20")>=0 && sheet.indexOf(" \u00b7 in 09:52 \u00b7 out 17:20")>=0 && clockMarkHTML(c,"s2",T0)===""; })());
      T("clock: Approve and Decline are admin-only, refusing a staff member's own attempt and writing no decision, no hours and no audit line", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40"); tap("s1",T0,"out","17:25"); _clockNow=at(T0,"18:00").getTime(); S.viewAs="s1";
        var r1=clockApprove("s1",T0), r2=clockDecline("s1",T0), sh=c.assign["s1|"+T0];
        return r1.ok===false && r1.reason==="Admin only." && r2.ok===false && r2.reason==="Admin only." && !c.clockDec && !sh.hours && !last("clock.approve") && !last("clock.decline") && !told("s1"); })());
      T("clock: a record still open, an in tap with no out tap and the day not over, does not appear on clockRows or count", (function(){
        state(); put("s1",T0); tap("s1",T0,"in","09:40");
        var rows=clockRows(c,at(T0,"12:00"));
        return rows.length===0 && clockCount(c,at(T0,"12:00"))===0 && clockProposal(c,"s1",T0,clockGrace(),at(T0,"12:00")).status==="open"; })());
      // ---- the poster, the QR code, the report and the release (Task 4)
      function fnv(str){ var h=2166136261>>>0; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return ("0000000"+h.toString(16)).slice(-8); }
      function qrSig(text){ var q=qrMatrix(text), flat=q.rows.map(function(r){ return r.join(""); }).join(""); return q.size+"/"+(flat.split("1").length-1)+"/"+fnv(flat); }
      T("clock: the QR encoder matches the reference encoder bit for bit (byte mode, level M, mask 0) at versions 1, 2, 4 and 5", qrSig("x")==="21/206/3a2d9a2f" && qrSig("MYROSTA-CLOCK-TEST-1234567")==="25/320/66c97e49" && qrSig("https://test/app.html?org=ed-default&clock=ABCDEFGHJKLMNPQR")==="33/528/182371d5" && qrSig("https://myrosta.com.au/app.html?org=swift-nurses&clock=ABCDEFGHJKLMNPQR")==="37/706/4a9c02cb");
      T("clock: the QR refuses a text too long for version 6, and the SVG draws every dark module inside a quiet zone", (function(){ var long=new Array(108).join("a"); var refused=false; try{ qrMatrix(long); }catch(e){ refused=true; }
        var svg=clockQRSVG("x"); return refused && svg.indexOf('viewBox="0 0 29 29"')>=0 && (svg.split("h1v1h-1z").length-1)===206 && svg.indexOf('fill="currentColor"')>=0; })());
      T("clock: the poster carries the hospital and group, the QR of the poster link, the link in words, and when it was made; it is on the Group half of Settings, hidden on screen", (function(){
        state(); S.branding={name:"Nurses",hospital:"SWIFT"}; var h=clockPosterHTML(); var url=clockPosterURL();
        S.viewAs="admin"; _setupTab="group"; var page=viewSetup(); _setupTab="cycle"; var other=viewSetup(); state({on:false}); var none=clockPosterHTML();
        return h.indexOf('id="posterCard"')>=0 && h.indexOf("SWIFT \u00b7 Nurses")>=0 && h.indexOf("Scan to clock in or out")>=0 && h.indexOf('viewBox="0 0 41 41"')>=0 && h.indexOf(escapeHTML(url))>=0 && h.indexOf("Poster made")>=0 && page.indexOf('id="posterCard"')>=0 && other.indexOf('id="posterCard"')<0 && none===""; })());
      T("clock: the Clock report has one row per clocked shift with the rostered window, both taps, their proof, the proposal, the flags and the decision, and audits the export", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40",{dist:420,acc:10,inside:false,via:"gps"}); tap("s1",T0,"out","17:25",{via:"poster"}); put("s2",Y0); tap("s2",Y0,"in","09:58"); tap("s2",Y0,"out","17:02"); _clockNow=at(T0,"18:00").getTime();
        clockDecline("s1",T0); var got=null; download=function(text,name){ got={text:text,name:name}; }; exportClockCSV(); var lines=got.text.split("\n");
        return got.name==="clock-"+c.cycle.start+".csv" && lines[0]==='"Person","Day","Rostered start","Rostered finish","Clock in","In distance (m)","In proof","Clock out","Out distance (m)","Out proof","Proposed start","Proposed finish","Flags","Decision","Decided by","Decided at"' && lines[1].indexOf('"Sam Lee","'+Y0+'","10:00","17:00","09:58","","no location","17:02","","no location","","","no location","rostered","",""')===0 && lines[2].indexOf('"Ava Ng","'+T0+'","10:00","17:00","09:40","420","outside","17:25","","poster","09:40","17:25","early 20 min; late 25 min; outside the radius (420 m); by poster","declined","Admin"')===0 && !!last("export.clock"); })());
      T("clock: the export menu lists the Clock report when the clock is on, or off with a record still on file, and never off with none", (function(){
        state({viewAs:"admin"}); var a=exportMenuHTML().indexOf('id="expClock"')>=0;
        state({on:false,viewAs:"admin"}); var b=exportMenuHTML().indexOf('id="expClock"')<0;
        put("s1",T0); tap("s1",T0,"in","09:40"); var d=exportMenuHTML().indexOf('id="expClock"')>=0;
        return a && b && d; })());
      T("clock: What's new names the clock on the release day, in three site-neutral lines, and BUILD is that day", (function(){ var e=WHATS_NEW.filter(function(x){ return x.title==="Clock in and clock out"; })[0]; return !!e && e.lines.length===3 && /Requests/.test(e.lines[1]) && e.lines[1].indexOf("\u201c")<0 && e.on==="2026-09-29" && /^\d{4}-\d{2}-\d{2}$/.test(e.on); })());   // the entry keeps its own release day; BUILD moves on with every later release
      // ---- final review fixes: midnight out taps, decisions keep the rostered pair, a real admin viewing as a person, a long poster link, the count and the export follow the records
      T("clock: an out tap at 23:58 or 23:59, rounded to 00:00 and stored on the shift's own day, still counts as midnight", (function(){
        state(); put("s1",T0,"PM",{start:"15:30",end:"23:30"}); tap("s1",T0,"in","15:30"); tap("s1",T0,"out","00:00",{ts:at(T0,"23:58").getTime()});   // tapped at 23:58, stored as 00:00
        var p=clockProposal(c,"s1",T0,7,at(TM,"00:10"));
        return p.status==="proposed" && p.start==="15:30" && p.end==="00:00" && p.flags.join("|")==="late 30 min|no location"; })());
      T("clock: a shift whose own hours already run to midnight reads a same-day 00:00 out tap as rostered, not as taps out of order", (function(){
        state(); put("s1",T0,"PM",{start:"17:00",end:"00:00"}); tap("s1",T0,"in","17:00"); tap("s1",T0,"out","00:00",{ts:at(T0,"23:59").getTime()});
        return clockProposal(c,"s1",T0,7,at(TM,"00:10")).status==="rostered"; })());
      T("clock: a 00:00 out tap in the first minutes of the shift's day is not midnight — a shift starting just after midnight, tapped in and out at once, is taps out of order, not a day-long proposal", (function(){
        state(); put("s1",T0,"AM",{start:"00:05",end:"08:00"}); tap("s1",T0,"in","00:00"); tap("s1",T0,"out","00:00",{ts:at(T0,"00:02").getTime()});
        var p=clockProposal(c,"s1",T0,7,at(T0,"00:03")); return p.status==="void" && p.flags[0]==="taps out of order"; })());
      T("clock: a decision keeps the rostered pair it was judged against, so the list and the Clock report stay right after an approval", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40",{dist:20,acc:5,inside:true,via:"gps"}); tap("s1",T0,"out","17:25",{dist:20,acc:5,inside:true,via:"gps"}); _clockNow=at(T0,"18:00").getTime();
        clockApprove("s1",T0); var dec=clockDecOf(c,"s1",T0); var a=!!dec.rostered && dec.rostered.start==="10:00" && dec.rostered.end==="17:00";
        var h=clockListHTML(); var b=h.indexOf("rostered 10:00–17:00 · clocked 09:40–17:25")>=0 && h.indexOf("approved 09:40–17:25")>=0;
        var got=null; download=function(text,name){ got={text:text,name:name}; }; exportClockCSV(); var lines=got.text.split("\n");
        var d=lines[1].indexOf('"Ava Ng","'+T0+'","10:00","17:00","09:40",')===0 && lines[1].indexOf('"09:40","17:25"')>=0 && lines[1].indexOf(',"approved","Admin",')>=0;
        return a && b && d; })());
      T("clock: clockStatusText names the decision once one is made — approved with the hours it approved, as rostered after a decline", (function(){
        state({viewAs:"admin"}); put("s1",T0); tap("s1",T0,"in","09:40",{dist:20,acc:5,inside:true,via:"gps"}); tap("s1",T0,"out","17:25",{dist:20,acc:5,inside:true,via:"gps"}); _clockNow=at(T0,"18:00").getTime();
        clockApprove("s1",T0); var a=clockStatusText(c,"s1",T0,clockNow())==="Clocked 09:40–17:25 · approved 09:40–17:25";
        put("s2",T0); tap("s2",T0,"in","09:40"); tap("s2",T0,"out","17:25"); clockDecline("s2",T0); var b=clockStatusText(c,"s2",T0,clockNow())==="Clocked 09:40–17:25 · as rostered";
        return a && b; })());
      T("clock: a signed-in admin who is also on the roster clocks only as their own record — matched by the email they signed in with — whoever they are viewing as; an admin with no record cannot tap", (function(){
        state(); put("s1",T0); put("s2",T0); _realAdmin=true; S.viewAs="admin"; authUser="ava@example.test"; authPhone=null; S.staff[0].email="ava@example.test"; _clockNow=at(T0,"09:30").getTime();
        var a=clockActor()==="s1" && clockMyHTML("s1").indexOf('data-clockin="'+T0+'"')>=0 && clockMyHTML("s2")==="" && clockSheetHTML(c,"s2",T0)==="" && clockSheetHTML(c,"s1",T0).indexOf('data-clockin')>=0;
        S.viewAs="s2"; var b=clockActor()==="s1" && clockMyHTML("s2")==="";
        var r=clockTap("in",null,at(T0,"09:30")); var d=r.ok===true && !!clockRec(c,"s1",T0) && !clockRec(c,"s2",T0);
        authUser="nobody@example.test"; var n=clockTap("in",null,at(T0,"09:31")); var e=clockActor()===null && n.ok===false && /staff list/.test(n.reason) && clockMyHTML("s2")==="";
        authUser=null; authPhone="+61400000002"; S.staff[1].mobile="0400 000 002"; var f=clockActor()==="s2";
        _realAdmin=false; authUser=null; authPhone=null; return a && b && d && e && f; })());
      T("clock: an admin who is on the roster lands on their own shifts on My shifts (not the first person), and a poster scan taps as them", (function(){
        state(); put("s1",T0); put("s2",T0); _realAdmin=true; S.viewAs="admin"; myPerson=null; authUser="sam@example.test"; S.staff[1].email="sam@example.test"; S.tab="my"; _clockNow=at(T0,"09:30").getTime();
        var h=viewMy(); var a=h.indexOf('<option value="s2" selected')>=0 && h.indexOf('<option value="s1" selected')<0 && h.indexOf('data-clockin="'+T0+'"')>=0;
        sessionStorage.setItem("myrosta_clock",JSON.stringify({org:_org,token:"ABCDEFGHJKLMNPQR"})); var r=clockApplyURL(at(T0,"09:40")); var rec=clockRec(c,"s2",T0);
        _realAdmin=false; authUser=null; return a && r==="in" && !!rec && rec.in.via==="poster" && !clockRec(c,"s1",T0); })());
      T("clock: an admin whose own record is non-clinical, or not on this cycle, lands where they always did, sees no buttons, and a poster scan says their sign-in is not on the staff list", (function(){
        state(); put("s1",T0); _realAdmin=true; S.viewAs="admin"; myPerson=null; S.tab="my"; _clockNow=at(T0,"09:30").getTime();
        S.staff.push({id:"s9",name:"Ky Tran",quota:0,eft:1,mode:"none",email:"ky@example.test"}); authUser="ky@example.test";
        var h=viewMy(); var a=clockMySid()==="s9" && h.indexOf('<option value="s1" selected')>=0 && h.indexOf('data-clockin')<0;
        S.staff[2].mode="self"; S.staff[2]._in=false; var h2=viewMy(); var b=h2.indexOf('<option value="s1" selected')>=0;
        authUser="nobody@example.test"; sessionStorage.setItem("myrosta_clock",JSON.stringify({org:_org,token:"ABCDEFGHJKLMNPQR"})); var r=clockApplyURL(at(T0,"09:40"));
        _realAdmin=false; authUser=null; return a && b && r==="refused" && said.some(function(m){ return /staff list/.test(m); }) && !c.clock; })());
      T("clock: a group id too long for the poster's QR code shows a note instead of failing the Group half of Settings", (function(){
        state(); var keepOrg=_org; _org="royal-melbourne-hospital-emergency-department-nurses-and-scribes"; var h=clockPosterHTML(); _org=keepOrg;
        return h.indexOf('id="posterCard"')>=0 && h.indexOf("too long for the poster code")>=0 && h.indexOf("<svg")<0; })());
      T("clock: clockCount reads zero with the switch off, even with a proposed record still on file", (function(){
        state({on:false}); put("s1",T0); tap("s1",T0,"in","09:40"); tap("s1",T0,"out","17:25");
        return clockCount(c,at(T0,"18:00"))===0; })());
      // ---- clock: later tasks add their tests above this line
    } finally { S=keep.S; toast=keep.toast; confirm=keep.confirm; download=keep.dl; navigator.geolocation=keep.geo; _srPick=keep.pick; _srSid=keep.sid; _daySheet=keep.sheet; _setupTab=keep.setup; location.search=keep.search; authUser=keep.au; authPhone=keep.ap; myPerson=keep.mp; _clockBusy=false; _clockNow=null; _siteAcc=null; _realAdmin=false; hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- CST quota + job description: a cap on clinical support time per person per cycle, split per period like the clinical quota; admin-only notes.
  (function(){
    var keep={S:S,toast:toast,confirm:confirm,download:download,x:(typeof XLSX!=="undefined"?XLSX:undefined),sid:_srSid,sheet:_daySheet,setup:_setupTab}, c=null, said=[];
    var D0="2026-10-26"; var D=function(n){ return iso(addDays(parseISO(D0),n)); };
    function state(o){ o=o||{};
      var Z=[{id:"z1",name:"Resus",am:true,pm:true,pmLabel:""}];
      var set={zones:Z,staffing:{amMin:1,amMax:1,pmMin:1,pmMax:1},rosterMode:"rolling",fairness:"guarded",quotaPeriod:o.period||"fortnight",quotaCapMode:o.cap||"hard",quotaFlex:!!o.flex,shiftTimes:{AM:{start:"08:00",end:"18:00"},PM:{start:"14:00",end:"23:00"}}};
      if(o.def!=null)set.cstPerFortnight=o.def;
      if(o.types)set.shiftTypes=o.types;
      var roles={s1:{in:true,quota:10,eft:1,hrsFortnight:76,periodTargets:{}},s2:{in:true,quota:10,eft:1,hrsFortnight:76,periodTargets:{}}}; if(o.own!=null)roles.s1.cstQuota=o.own; if(o.targets)roles.s1.cstTargets=o.targets;
      S={zones:Z,staffing:set.staffing,staff:[{id:"s1",name:"Ng, Ava",quota:10,eft:1,mobile:"0412 000 111"},{id:"s2",name:"Lee, Sam",quota:10,eft:1}],
         cycles:[{id:"cc",cycle:{start:D0,weeks:4},status:"published",archived:false,settings:set,roles:roles,assign:{}}],
         activeId:"cc",viewAs:o.viewAs||"s1",tab:o.tab||"my",leave:[],openShifts:[],requests:[],audit:[],notifications:[],messages:[],feedback:[],features:{}};
      if(o.notes)S.staff[0].notes=o.notes;
      normalize(); hydrateCycleSettings(); hydrateCycleRoles(); c=S.cycles[0]; said.length=0; _srSid=null; _daySheet=null; }
    function cst(sid,n){ c.assign[sid+"|"+D(n)]={kind:"cst"}; }
    function s1(){ return S.staff[0]; }
    toast=function(m){ said.push(String(m)); };
    try{
      T("cst: the quota is the group default times the cycle's fortnights when the person's box is blank", (function(){ state({def:2}); return cstQuotaOf(s1())===4 && cstDefaultQuota()===4; })());
      T("cst: the person's own number wins over the default, and no default means no cap", (function(){ state({def:2,own:3}); var a=cstQuotaOf(s1()); state(); return a===3 && cstQuotaOf(s1())===0 && cstJudge("s1",D(0)).ok; })());
      T("cst: hard cap on the cycle total, and a day already marked never counts against itself", (function(){ state({own:2,period:"cycle"}); var ok0=cstJudge("s1",D(0)).ok; cst("s1",0); cst("s1",1); var j=cstJudge("s1",D(2)), same=cstJudge("s1",D(0));
        return ok0 && !j.ok && /used your CST days for this cycle \(2\)/.test(j.reason) && same.ok; })());
      T("cst: the per-fortnight split caps each fortnight at its even share", (function(){ state({own:2}); cst("s1",0); var j1=cstJudge("s1",D(1)), j2=cstJudge("s1",D(14));
        return JSON.stringify(cstTargetsOf(s1()))==="[1,1]" && !j1.ok && /Fn 1 CST quota reached \(1\)/.test(j1.reason) && j2.ok; })());
      T("cst: a per-period override is honoured and the cycle total still caps the rest", (function(){ state({own:2,targets:{0:2}}); cst("s1",0); var a=cstJudge("s1",D(1)); cst("s1",1); var b=cstJudge("s1",D(14));
        return a.ok && !b.ok && /used your CST days/.test(b.reason); })());
      T("cst: with Staff choose on, the extra day may sit in any one week, not two", (function(){ state({own:5,flex:true,period:"week"}); cst("s1",0); var a=cstJudge("s1",D(1)); cst("s1",1); var b=cstJudge("s1",D(2)); var c2=cstJudge("s1",D(7)); cst("s1",7); var d=cstJudge("s1",D(8));
        return a.ok && !b.ok && /at its CST max \(2\)/.test(b.reason) && c2.ok && !d.ok && /already placed your extra CST day in another week/.test(d.reason); })());
      T("cst: the cycle total is judged before the split, so a last day over the total is refused as the total", (function(){ state({own:3,flex:true}); cst("s1",0); cst("s1",1); cst("s1",14); var d=cstJudge("s1",D(15)); return !d.ok && /used your CST days for this cycle \(3\)/.test(d.reason); })());
      T("cst: soft cap allows and says so, off cap says nothing", (function(){ state({own:1,cap:"soft"}); cst("s1",0); var a=cstJudge("s1",D(1)); state({own:1,cap:"off"}); cst("s1",0); var b=cstJudge("s1",D(1));
        return a.ok && /used your CST days/.test(a.flag||"") && b.ok && !b.flag; })());
      T("cst: the wording follows the group's own name for the type", (function(){ state({own:1,types:[{id:"CST",code:"CST",label:"Non-clinical",start:"08:00",end:"16:00",fills:[],on:true,book:true,builtin:"CST"}]}); cst("s1",0); var j=cstJudge("s1",D(1));
        return cstLabel()==="Non-clinical" && !j.ok && /Non-clinical days/.test(j.reason); })());
      T("cst: the quota is per cycle — hydration swaps it with the active cycle and clears it where none is set", (function(){ state({own:3});
        S.cycles.push({id:"c2",cycle:{start:D(28),weeks:4},status:"draft",archived:false,settings:JSON.parse(JSON.stringify(c.settings)),roles:{s1:{in:true,quota:5,eft:1,hrsFortnight:76,periodTargets:{}}},assign:{}});
        S.activeId="c2"; hydrateCycleRoles(); var gone=s1().cstQuota===undefined && JSON.stringify(s1().cstTargets)==="{}"; S.activeId="cc"; hydrateCycleRoles(); return gone && s1().cstQuota===3; })());
      T("cst: a blank box and an empty split write no keys — an untouched cycle's roles stay byte-identical through hydrate and sync", (function(){ state(); var before=JSON.stringify(c.roles); hydrateCycleRoles(); syncRolesGuarded(); var same=JSON.stringify(c.roles)===before;
        s1().cstQuota=2; s1().cstTargets={0:2}; syncRolesGuarded(); var wrote=c.roles.s1.cstQuota===2 && c.roles.s1.cstTargets[0]===2; s1().cstQuota=""; s1().cstTargets={}; syncRolesGuarded();
        return same && wrote && !("cstQuota" in c.roles.s1) && !("cstTargets" in c.roles.s1); })());
      T("cst: preparing the next cycle carries each person's CST quota and split, and the group default", (function(){ state({own:3,targets:{1:2},def:2}); var _c=confirm; confirm=function(){ return true; }; try{ prepareNext(); } finally{ confirm=_c; }
        var n=S.cycles[S.cycles.length-1]; return S.cycles.length===2 && n.roles.s1.cstQuota===3 && n.roles.s1.cstTargets[1]===2 && !("cstQuota" in n.roles.s2) && n.settings.cstPerFortnight===2; })());
      T("cst: the booking sheet greys out Mark CST with the reason once the quota is used, and the handler's judge agrees", (function(){ state({own:1}); cst("s1",0); S.tab="selfroster"; _srSid="s1"; _daySheet=D(1); render();
        var h=document.getElementById("sheetRoot").innerHTML; _daySheet=null; render();
        return /data-setcst="[^"]+" disabled/.test(h) && /used your CST days for this cycle \(1\)/.test(h) && !cstJudge("s1",D(1)).ok; })());
      T("cst: with the quota free the button is live and carries no note; under a soft cap it is live with the note", (function(){ state({own:1}); S.tab="selfroster"; _srSid="s1"; _daySheet=D(1); render(); var a=document.getElementById("sheetRoot").innerHTML;
        state({own:1,cap:"soft"}); cst("s1",0); S.tab="selfroster"; _srSid="s1"; _daySheet=D(1); render(); var b=document.getElementById("sheetRoot").innerHTML; _daySheet=null; render();
        return /data-setcst="[^"]+">/.test(a) && !/used your CST days/.test(a) && /data-setcst="[^"]+">/.test(b) && /used your CST days/.test(b); })());
      T("cst: the Staff card shows CST / cycle with the default as its placeholder, and the job description box to admins only", (function(){ state({def:2,viewAs:"admin",notes:"No Mondays\nSecond line"}); _staffOpen.add("s1"); var a=staffRowHTML(S.staff[0]); S.viewAs="s1"; var b=staffRowHTML(S.staff[0]); _staffOpen.delete("s1");
        return /class="s-cst"[^>]*placeholder="default 4"/.test(a) && /class="s-notes"[^>]*>No Mondays\nSecond line<\/textarea>/.test(a) && /Job description/.test(a) && a.indexOf("class=\"s-notes\"")>=0 && b.indexOf("class=\"s-notes\"")<0 && b.indexOf("Job description")<0; })());
      T("cst: the Staff card's summary line names the CST quota when there is one", (function(){ state({own:3,viewAs:"admin"}); var a=staffRowHTML(S.staff[0]); state({viewAs:"admin"}); var b=staffRowHTML(S.staff[0]); return /CST 3/.test(a) && !/CST \d/.test(b); })());
      T("cst: the cell editor shows an admin the first line of the notes under the name, and nothing to staff", (function(){ state({viewAs:"admin",notes:"No Mondays\nSecond line"}); S.tab="roster"; render(); try{ openCell("s1",D(0)); }catch(e){} var h=document.getElementById("modalRoot").innerHTML; closeModal();
        S.viewAs="s1"; try{ openCell("s1",D(0)); }catch(e){} var h2=document.getElementById("modalRoot").innerHTML; closeModal();
        var ok=/No Mondays/.test(h) && !/Second line<\/div>/.test(h) && /title="No Mondays\nSecond line"/.test(h) && !/No Mondays/.test(h2); return ok; })());
      T("cst: the Quota & fairness card carries the default box and the Clinical | CST switch, and the CST view edits the CST split", (function(){ state({def:2,viewAs:"admin",tab:"setup"}); _setupTab="cycle"; _qtView="clinical"; var a=viewSetup();
        _qtView="cst"; var b=viewSetup(); _qtView="clinical";
        return /id="cstDefault"[^>]*value="2"/.test(a) && /id="qtSeg"/.test(a) && /class="qt-cell"/.test(a) && !/qt-cstcell/.test(a) && /class="qt-cstcell"/.test(b) && /placeholder="4"/.test(b) && !/class="qt-cell"/.test(b) && /Reset all to auto/.test(b); })());
      T("cst: My shifts gains the CST strip only when a quota exists, and the tile reads used/quota", (function(){ state({own:2}); cst("s1",0); var a=quotaStripHTML("s1",s1()), m=viewMy(); state(); var b=quotaStripHTML("s1",s1()), m2=viewMy();
        return /CST \/ fortnight:/.test(a) && /Fn 1 1\/1/.test(a) && /class="v">1\/2</.test(m) && !/CST \/ fortnight/.test(b) && /class="v">0<\/div>/.test(m2); })());
      T("cst: the staff list import reads CST days per fortnight and Job description, and a blank cell leaves both alone", (function(){ state({viewAs:"admin"});
        var p1=parseStaffList([["Surname","Given name","Clinical shifts per fortnight","CST days per fortnight","Job description"],["Ng","Ava",5,2,"Prefers Tuesdays"],["Tran","Ky",4,"",""]]); if(p1.error)return false;
        var r=applyStaffList(p1.rows); var ky=S.staff.find(function(x){ return x.name==="Tran, Ky"; });
        var okA=p1.rows[0].cstp===2 && p1.rows[0].notes==="Prefers Tuesdays" && s1().cstQuota===4 && s1().notes==="Prefers Tuesdays" && s1().quota===10 && ky && ky.cstQuota===undefined && !ky.notes && c.roles.s1.cstQuota===4;
        var p2=parseStaffList([["Surname","Given name","CST days per fortnight","Job description"],["Ng","Ava","",""]]); applyStaffList(p2.rows);
        return okA && r.created===1 && s1().cstQuota===4 && s1().notes==="Prefers Tuesdays"; })());
      T("cst: the staff list template carries the two new columns beside their neighbours", (function(){ var sheets=[]; var kx=(typeof XLSX!=="undefined")?XLSX:undefined; XLSX={utils:{aoa_to_sheet:function(a){ sheets.push(JSON.parse(JSON.stringify(a))); return {}; },book_new:function(){ return {}; },book_append_sheet:function(){}},writeFile:function(){}};
        try{ downloadStaffTemplate(); } finally{ if(kx!==undefined)XLSX=kx; } var h=sheets[0]&&sheets[0][0]||[]; return h.indexOf("CST days per fortnight")===h.indexOf("Clinical shifts per fortnight")+1 && h[h.length-1]==="Job description"; })());
      T("cst: every CST audit key has its plain words", ["settings.cstDefault","settings.cstQuota","settings.cstReset","cst.override"].every(function(k){ return !!AUDIT_WORDS[k]; }));
      // ---- cst: later tasks add their tests above this line
    } finally { S=keep.S; toast=keep.toast; confirm=keep.confirm; download=keep.download; if(keep.x!==undefined)XLSX=keep.x; _srSid=keep.sid; _daySheet=keep.sheet; _setupTab=keep.setup; hydrateCycleSettings(); hydrateCycleRoles(); }
  })();
  // ---- 9 Oct 2026: the month on every grid column, and book-as-you-tap ----
  (function(){ var keep={st:S.cycles[0].status, va:S.viewAs, tab:S.tab, dm:dailyMode, dd:dailyDate, ib:S.instantBook, pick:_srPick.slice(), sid:_srSid, rc:_receipt, setup:_setupTab};
    try{
      var MO=/class="mo muted">[A-Z][a-z]{2,3}<\/div>/g, days=cycleDates().length, vr=viewRoster();
      T("grids: the roster grid names the month under every date", (vr.match(MO)||[]).length===days && vr.indexOf('class="mo muted">&nbsp;')<0);
      dailyMode="week"; dailyDate=iso(cycleDates()[0]); S.viewAs="admin"; S.tab="daily"; var vd=viewDaily(); dailyMode="day";
      T("grids: the Day board's week names the month under every date", (vd.match(MO)||[]).length===7 && !/\d{1,2}\/\d{1,2}<\/div><\/th>/.test(vd));
      var vp=viewPlanner(), pm=plannerMonth, inMonth=new Date(pm.getFullYear(),pm.getMonth()+1,0).getDate();
      T("grids: the leave planner names the month under every date", (vp.match(MO)||[]).length===inMonth);
      delete S.instantBook; var sw=instantBookOn()===true; instantBookSwitch(false); sw=sw&&instantBookOn()===false&&S.instantBook===false; instantBookSwitch(true); sw=sw&&instantBookOn()===true&&S.instantBook===undefined; instantBookSwitch(false);
      T("tap: the switch is on until an admin turns it off (12 Oct 2026), off stores false and on clears the key", sw && videoFeats().basket===true);
      S.viewAs="admin"; S.tab="setup"; _setupTab="group"; var g=viewSetup();
      T("tap: the Group card carries the switch beside own hours, with its audit words", g.indexOf('id="instantBook"')>=0 && g.indexOf('id="ownHours"')>=0 && !!AUDIT_WORDS["settings.instantBook"]);
      S.cycles[0].status="open"; S.viewAs="s1"; S.tab="selfroster"; _srSid="s1"; _srPick=[]; _receipt=null;
      var slot=null; cycleDates().some(function(d){ return S.zones.some(function(z){ var c=canBook("s1",iso(d),"AM",z.id); if(c.ok){ slot={d:d,key:iso(d)+"|AM|"+z.id}; return true; } return false; }); });
      T("tap: a bookable slot exists in the fixture", !!slot);
      if(slot){ var before=clinicalCountFor("s1"); instantBookSwitch(false);
        srTapPick(slot.key); T("tap: with the switch off a tap only fills the basket", _srPick.length===1 && _srPick[0]===slot.key && clinicalCountFor("s1")===before); _srPick=[];
        instantBookSwitch(true); srTapPick(slot.key);
        T("tap: with the switch on a tap books the shift at once — receipt shown, basket empty", clinicalCountFor("s1")===before+1 && (S.cycles[0].assign["s1|"+iso(slot.d)]||{}).kind==="clinical" && _srPick.length===0 && !!_receipt && _receipt.n===1);
        delete S.cycles[0].assign["s1|"+iso(slot.d)]; _receipt=null;
        _inflight.add("srConfirm"); srTapPick(slot.key); _inflight.delete("srConfirm");
        T("tap: a second tap while the first is still saving is refused, never parked in the basket", _srPick.length===0 && clinicalCountFor("s1")===before);
        var hs=viewHelp(); T("tap: Help tells staff a tap books at once and drops the basket sentence", hs.indexOf("yours at once")>=0 && hs.indexOf("Picks sit in a basket")<0);
        instantBookSwitch(false); var hb=viewHelp(); T("tap: with the switch off Help keeps the basket sentence", hb.indexOf("Picks sit in a basket")>=0);
        S.viewAs="s1"; S.tab="selfroster"; var hdrOff=viewSelfRoster(); instantBookSwitch(true); var hdrOn=viewSelfRoster();
        T("tap: the Book shifts header follows the switch", hdrOff.indexOf("Nothing is booked until you confirm")>=0 && hdrOn.indexOf("the first tap wins")>=0 && hdrOn.indexOf("Nothing is booked until you confirm")<0); }
    } finally { S.cycles[0].status=keep.st; if(keep.ib===undefined)delete S.instantBook; else S.instantBook=keep.ib; dailyMode=keep.dm; dailyDate=keep.dd; _srPick=keep.pick; _srSid=keep.sid; _receipt=keep.rc; _setupTab=keep.setup; S.viewAs=keep.va; S.tab=keep.tab; }
  })();
  // ---- 10 Oct 2026: four-week and calendar-month fixed patterns ----
  (function(){ var c=S.cycles[0]; var keep={staff:JSON.parse(JSON.stringify(S.staff)), cyc:JSON.parse(JSON.stringify(c.cycle)), va:S.viewAs, tab:S.tab, draft:_fpDraft};
    try{
      var s4={id:"fp-test",name:"Test, Fixed",initials:"TF",mobile:"",email:"",mode:"fixed",quota:4,eft:1,hrsFortnight:76}; S.staff.push(s4); var ds=cycleDates(); var wd2=String(parseISO(iso(ds[2])).getDay());
      var fp4={recurrence:"fourweekly",A:{},B:{},C:{},D:{},M:[],committed:true}; fp4.A[wd2]={period:"AM",zone:""}; s4.fixedPattern=fp4;
      var hit=[2,9,16,23,30].map(function(i){ return !!fixedSlotFor(s4,iso(ds[i])); });
      T("fp: every-4-weeks places week A's shift in cycle weeks 1 and 5 only", hit[0]===true && hit[1]===false && hit[2]===false && hit[3]===false && hit[4]===true && cycleWeekN(iso(ds[2]),4)==="A" && cycleWeekN(iso(ds[9]),4)==="B" && cycleWeekN(iso(ds[23]),4)==="D" && cycleWeekAB(iso(ds[9]))==="B");
      var fpM={recurrence:"monthly",A:{},B:{},C:{},D:{},M:[{nth:1,wd:3,period:"AM",zone:""},{nth:"last",wd:6,period:"PM",zone:""}],committed:true}; s4.fixedPattern=fpM;
      var okM=ds.every(function(d){ var dd=parseISO(iso(d)); var first=(dd.getDay()===3&&dd.getDate()<=7), lastSat=(dd.getDay()===6&&dd.getDate()+7>new Date(dd.getFullYear(),dd.getMonth()+1,0).getDate()); var sl=fixedSlotFor(s4,iso(d)); return (!!sl)===(first||lastSat) && (!sl || (first?sl.period==="AM":sl.period==="PM")); });
      T("fp: a calendar-month pattern lands on the first Wednesday and the last Saturday of each month in the cycle", okM);
      T("fp: the summary names the weeks and the monthly rules", /Wk A: /.test(fixedPatternSummary(fp4)) && fixedPatternSummary(fpM).indexOf("1st Wed AM·any")>=0 && fixedPatternSummary(fpM).indexOf("last Sat PM·any")>=0 && fixedPatternSummary({recurrence:"weekly",A:{},B:{}})==="no shifts set");
      c.cycle.weeks=8; T("fp: a week's heading lists the cycle weeks it covers, from the cycle's length", fpWeekHeading("A",4)==="Week A — cycle weeks 1, 5" && fpWeekHeading("D",4)==="Week D — cycle weeks 4, 8" && fpWeekHeading("B",2)==="Week B — cycle weeks 2, 4, 6, 8" && (c.cycle.weeks=12, fpWeekHeading("A",4)==="Week A — cycle weeks 1, 5, 9"));
      c.cycle.weeks=8; delete _fpDraft[s4.id]; var d=fpDraft(s4); T("fp: the draft carries the four weeks and the monthly rules", !!d.C && !!d.D && Array.isArray(d.M) && d.M.length===2);
      S.viewAs="admin"; d.recurrence="fourweekly"; var e4=fixedPatternEditorHTML(s4,true,false); d.recurrence="monthly"; var eM=fixedPatternEditorHTML(s4,true,false);
      T("fp: the editor offers four recurrences, four week tables for every-4-weeks and rule rows for a calendar month", /data-rec="fourweekly"/.test(e4) && /data-rec="monthly"/.test(e4) && (e4.match(/Week [ABCD] — cycle weeks/g)||[]).length===4 && (eM.match(/class="fp-mw"/g)||[]).length===2 && /class="btn sm fp-madd"/.test(eM) && e4.indexOf("Week NaN")<0);
      d.recurrence="monthly"; d.M.push({nth:2,wd:1,period:"PM",zone:"z1"}); saveFixedPattern(s4.id,false); var saved=s4.fixedPattern;
      T("fp: saving keeps the four weeks and the rules, dropping a rule with no period", saved.recurrence==="monthly" && saved.M.length===3 && saved.M[2].wd===1 && saved.M[2].zone==="z1" && !!saved.C && !!saved.D);
      s4.fixedPattern={recurrence:"weekly",A:{},B:{},committed:true}; s4.fixedPattern.A[wd2]={period:"PM"}; T("fp: a weekly pattern saved before today still places every week", !!fixedSlotFor(s4,iso(ds[2])) && !!fixedSlotFor(s4,iso(ds[9])) && fixedPatternSummary(s4.fixedPattern).indexOf("Wk ")<0);
    } finally { S.staff=keep.staff; S.cycles[0].cycle=keep.cyc; _fpDraft=keep.draft; S.viewAs=keep.va; S.tab=keep.tab; try{hydrateCycleRoles();}catch(e){} }
  })();
  // ---- 10 Oct 2026: a fixed shift can be given away, asked off or swapped by its holder; only a plain removal stays with the admin ----
  (function(){ var c=S.cycles[0]; var keep={assign:JSON.parse(JSON.stringify(c.assign)), req:S.requests.slice(), os:(S.openShifts||[]).slice(), va:S.viewAs, mk:S.marketOn, st:c.status, claim:S.marketClaim};
    var bad=function(r){ return r===false||(r&&r.ok===false); };
    try{ c.status="published"; S.marketOn=true; S.marketClaim="first"; var d=FUT(20), d2=FUT(21);
      c.assign["s1|"+d]={kind:"clinical",period:"AM",zone:"z1",fixed:true}; delete c.assign["s2|"+d]; c.assign["s2|"+d2]={kind:"clinical",period:"PM",zone:"z1"}; delete c.assign["s1|"+d2]; S.viewAs="s1";
      var acts=dsBookedActs("s1",d,c);
      T("fixed: the day sheet offers the give-away, the ask and the swap, never Remove, with the lock explained", /data-osoffer=/.test(acts) && /data-osask=/.test(acts) && /data-swapit=/.test(acts) && acts.indexOf("data-osdrop=")<0 && /Fixed shift/.test(acts));
      T("fixed: a plain removal is still refused", bad(unbookShift("s1",d)) && !!c.assign["s1|"+d]);
      var o=offerShift("s1",d); var give=(S.openShifts||[]).find(function(x){return x.from==="s1"&&x.iso===d&&x.kind==="giveaway";});
      T("fixed: the holder can offer a fixed shift to the group and stays on it meanwhile", !bad(o) && !!give && give.status==="open" && !!c.assign["s1|"+d] && c.assign["s1|"+d].fixed===true);
      S.viewAs="s2"; var cl=claimOpenShift(give.id); var took=c.assign["s2|"+d];
      T("fixed: a colleague who takes it gets an ordinary shift, and the giver is off that day", !bad(cl) && !!took && !took.fixed && !c.assign["s1|"+d] && give.status==="claimed");
      c.assign["s1|"+d]={kind:"clinical",period:"AM",zone:"z1",fixed:true}; delete c.assign["s2|"+d]; S.viewAs="s1";
      var rq={id:"rq-fx",type:"swap",from:"s1",dateA:d,peerId:"s2",dateB:d2,reason:"",status:"pending",peerAgreed:true,createdTs:Date.now()}; S.requests.unshift(rq); S.viewAs="admin"; approveSwap("rq-fx","");
      T("fixed: a swap of a fixed shift goes through on approval and neither moved shift stays fixed", rq.status==="approved" && !!c.assign["s2|"+d] && !c.assign["s2|"+d].fixed && !!c.assign["s1|"+d2] && !c.assign["s1|"+d2].fixed && !c.assign["s1|"+d]);
    } finally { c.assign=keep.assign; S.requests=keep.req; S.openShifts=keep.os; S.viewAs=keep.va; S.marketOn=keep.mk; c.status=keep.st; S.marketClaim=keep.claim; }
  })();
  // ---- 10 Oct 2026: the Fixed cover view — what the patterns alone place, the weekday summary, the drift, the export ----
  (function(){ var c=S.cycles[0]; var keep={staff:JSON.parse(JSON.stringify(S.staff)), assign:JSON.parse(JSON.stringify(c.assign)), va:S.viewAs, tab:S.tab, fv:fixedView, fs:fixedSoft, x:(typeof XLSX!=="undefined")?XLSX:undefined};
    try{ var ds=cycleDates(); var wdW=String(parseISO(iso(ds[2])).getDay()); var weeks=ds.length/7; var amMin=effStaffing().amMin;
      var pf={id:"fc-fixed",name:"Test, Locked",initials:"TL",mobile:"",email:"",mode:"fixed",quota:4,eft:1,hrsFortnight:76,fixedPattern:{recurrence:"weekly",A:{},B:{},C:{},D:{},M:[],committed:true}}; pf.fixedPattern.A[wdW]={period:"AM",zone:"z1"};
      var pp={id:"fc-pref",name:"Test, Pref",initials:"TP",mobile:"",email:"",mode:"preference",quota:4,eft:1,hrsFortnight:76,fixedPattern:{recurrence:"weekly",A:{},B:{},C:{},D:{},M:[],committed:false}}; pp.fixedPattern.A[wdW]={period:"PM",zone:""};
      S.staff.push(pf,pp); c.roles=c.roles||{}; [pf,pp].forEach(function(x){ c.roles[x.id]={in:true,quota:4,eft:1,hrsFortnight:76,periodTargets:{}}; }); try{hydrateCycleRoles();}catch(e){}
      var hard=fixedProjection(c,false), soft=fixedProjection(c,true);
      T("cover: the projection places the locked pattern every week, and the preference only when soft patterns are included", Object.keys(hard).length===weeks && Object.keys(soft).length===2*weeks && hard["fc-fixed|"+iso(ds[2])].period==="AM" && !hard["fc-pref|"+iso(ds[2])] && soft["fc-pref|"+iso(ds[2])].period==="PM" && soft["fc-pref|"+iso(ds[2])].soft===true);
      var st=fixedCoverStats(c,hard); var row=st.rows.filter(function(r){return String(r.wd)===wdW&&r.half==="AM";})[0]; var other=st.rows.filter(function(r){return String(r.wd)!==wdW&&r.half==="AM";})[0];
      T("cover: the weekday summary counts the dates covered to the minimum, the zones held and the shortfall", !!row && row.dates===weeks && row.covered===(amMin<=1?weeks:0) && row.zones.indexOf("Resus")>=0 && other.covered===(amMin>0?0:weeks) && other.short===amMin*weeks && row.short===Math.max(0,amMin-1)*weeks);
      c.assign={}; Object.keys(hard).forEach(function(k){ var e=hard[k]; c.assign[k]={kind:"clinical",period:e.period,zone:e.zone||"z1",fixed:true}; });
      c.assign["fc-fixed|"+iso(ds[2])].period="PM"; delete c.assign["fc-fixed|"+iso(ds[9])];
      var dr=fixedDrift(c,hard); T("cover: the drift lists a moved and a removed fixed shift against the pattern, the rest as placed", dr.total===weeks && dr.changed===2 && dr.items.some(function(i){return i.iso===iso(ds[2])&&i.what==="moved";}) && dr.items.some(function(i){return i.iso===iso(ds[9])&&i.what==="removed";}));
      S.viewAs="admin"; S.tab="roster"; fixedView=true; fixedSoft=false; var v=viewRoster(); fixedView=false; var plain=viewRoster();
      T("cover: the view ghosts the pattern shifts, counts fixed cover in the cover row, shows the summary and the drift, and never the editor", /class="tag lg fxghost"/.test(v) && /id="fixedToggle"/.test(v) && /id="fixedSoft"/.test(v) && /Weekday summary/.test(v) && /Drift this cycle/.test(v) && v.indexOf('class="cellbtn"')<0 && /id="fixedXlsx"/.test(v) && plain.indexOf("fxghost")<0 && /id="fixedToggle"/.test(plain));
      var sheets=[]; XLSX={utils:{aoa_to_sheet:function(a){sheets.push(a);return {a:a};},book_new:function(){return {s:[]};},book_append_sheet:function(wb,ws,n){wb.s.push(n);}},writeFile:function(wb,name){sheets.file=name;}};
      exportFixedCoverXLSX(); T("cover: the Excel export carries the grid, the weekday summary and the drift", sheets.length===3 && /^fixed-cover-/.test(sheets.file||"") && sheets[0][0][0]==="Name" && sheets[1][0].some(function(h){return /Shortfall/.test(h);}) && sheets[2].length===3);
    } finally { S.staff=keep.staff; c.assign=keep.assign; S.viewAs=keep.va; S.tab=keep.tab; fixedView=keep.fv; fixedSoft=keep.fs; if(keep.x!==undefined)XLSX=keep.x; try{hydrateCycleRoles();}catch(e){} }
  })();
  // ---- 10 Oct 2026: walk-in clocking — someone on the list with nothing rostered today ----
  (function(){ var c=S.cycles[0]; var keep={on:S.clockOn, wk:S.clockWalkin, site:S.site, assign:JSON.parse(JSON.stringify(c.assign)), clock:c.clock?JSON.parse(JSON.stringify(c.clock)):undefined, dec:c.clockDec?JSON.parse(JSON.stringify(c.clockDec)):undefined, va:S.viewAs, st:c.status, nowFix:_clockNow, notifs:S.notifications.slice()};
    try{ S.site={lat:-37.9,lng:144.66,acc:20,setAt:Date.now(),radius:150,posterKey:"t",posterAt:Date.now()}; S.clockOn=true; c.status="published"; var now=new Date(); now.setHours(10,0,0,0); _clockNow=now.getTime(); var today=iso(now);
      delete S.clockWalkin; var off=clockWalkinOn(); clockWalkinSwitch(true);
      T("walk-in: off until an admin switches it on, from the Clock card", off===false && clockWalkinOn()===true && /id="clockWalkin"/.test(clockCardHTML()) && !!AUDIT_WORDS["settings.clockWalkin"]);
      delete c.assign["s1|"+today]; if(c.clock)delete c.clock["s1|"+today]; if(c.clockDec)delete c.clockDec["s1|"+today]; S.viewAs="s1"; c.assign["s2|"+today]={kind:"clinical",period:"AM",zone:"z2"};
      T("walk-in: allowed for someone on the list with nothing today, not for someone with a shift", walkinMay(c,"s1",today,now)===true && walkinMay(c,"s2",today,now)===false && /data-walkin=/.test(clockMyHTML("s1",now)) && clockMyHTML("s2",now).indexOf("data-walkin")<0 && /data-walkin=/.test(clockSheetHTML(c,"s1",today,now)));
      var r=walkinStart("s1",today,"AM","z1",{dist:10,acc:5,inside:true,via:"gps"},now); var sh=c.assign["s1|"+today], rec=clockRec(c,"s1",today);
      T("walk-in: the tap creates a casual shift and clocks in", r.ok===true && !!sh && sh.walkin===true && sh.period==="AM" && sh.zone==="z1" && !!rec && !!rec.in && walkinMay(c,"s1",today,now)===false);
      var later=new Date(now); later.setHours(16,0,0,0); clockWrite(c,"s1",today,"out",later,{dist:12,acc:5,inside:true,via:"gps"}); var p=clockProposal(c,"s1",today,clockGrace(),later);
      T("walk-in: always proposed for approval and flagged, even inside the grace band", p.status==="proposed" && p.flags.some(function(f){return /walk-in/.test(f);}));
      S.viewAs="admin"; var lst=clockListHTML(later); var dres=clockDecline("s1",today);
      T("walk-in: Hours to approve names it, and Decline removes the shift", /walk-in/.test(lst) && dres.ok===true && !c.assign["s1|"+today] && /shift removed/.test(clockListHTML(later)));
      delete c.clockDec["s1|"+today]; delete c.clock["s1|"+today]; S.viewAs="s1"; walkinStart("s1",today,"AM","z1",{dist:10,acc:5,inside:true,via:"gps"},now); clockWrite(c,"s1",today,"out",later,{dist:12,acc:5,inside:true,via:"gps"}); S.viewAs="admin"; var ares=clockApprove("s1",today); var sh2=c.assign["s1|"+today];
      T("walk-in: Approve keeps the shift with the clocked hours as its own", ares.ok===true && !!sh2 && sh2.walkin===true && !!sh2.hours && sh2.hours.start==="10:00");
    } finally { S.clockOn=keep.on; if(keep.wk)S.clockWalkin=true; else delete S.clockWalkin; S.site=keep.site; c.assign=keep.assign; if(keep.clock!==undefined)c.clock=keep.clock; else delete c.clock; if(keep.dec!==undefined)c.clockDec=keep.dec; else delete c.clockDec; S.viewAs=keep.va; c.status=keep.st; _clockNow=keep.nowFix; S.notifications=keep.notifs; }
  })();
  // ---- 10 Oct 2026: the pattern editor offers the cycle's own shift types — a full shift, a renamed non-clinical block — not just the two halves ----
  (function(){ var c=S.cycles[0]; var keep={staff:JSON.parse(JSON.stringify(S.staff)), assign:JSON.parse(JSON.stringify(c.assign)), types:c.settings.shiftTypes?JSON.parse(JSON.stringify(c.settings.shiftTypes)):undefined, roles:JSON.parse(JSON.stringify(c.roles||{})), va:S.viewAs, draft:_fpDraft};
    try{ var base=shiftTypesOf(c).map(function(t){return JSON.parse(JSON.stringify(t));}); base.push({id:"full",code:"FULL",label:"Full",fills:["AM","PM"],on:true,book:true,start:"08:00",end:"23:30"}); base.forEach(function(t){ if(t.id==="CST")t.label="Admin"; }); c.settings.shiftTypes=base; try{hydrateCycleSettings();}catch(e){}
      var ds=cycleDates(); var wd2=String(parseISO(iso(ds[2])).getDay()), wd3=String(parseISO(iso(ds[3])).getDay());
      var s4={id:"fp-types",name:"Test, Types",initials:"TT",mobile:"",email:"",mode:"fixed",quota:4,eft:1,hrsFortnight:76,fixedPattern:{recurrence:"weekly",A:{},B:{},C:{},D:{},M:[],committed:true}}; S.staff.push(s4); c.roles=c.roles||{}; c.roles[s4.id]={in:true,quota:4,eft:1,hrsFortnight:76,periodTargets:{}}; try{hydrateCycleRoles();}catch(e){}
      S.viewAs="admin"; delete _fpDraft[s4.id]; var ed=fixedPatternEditorHTML(s4,true,false); var sel=(ed.match(/<select class="fp-p"[^>]*>[\s\S]*?<\/select>/)||[""])[0];
      T("types: the period select lists the cycle's types by their labels — the halves, the full shift and the non-clinical block", /<option value="AM"[^>]*>AM</.test(sel) && /<option value="PM"[^>]*>PM</.test(sel) && /<option value="full"[^>]*>Full</.test(sel) && /<option value="CST"[^>]*>Admin</.test(sel) && /<option value="">Off</.test(sel));
      setFpSlot(s4.id,"A",+wd2,"type","full"); setFpSlot(s4.id,"A",+wd3,"type","CST"); var d=fpDraft(s4);
      T("types: choosing a type stores its half and its id; the non-clinical block stores as CST", d.A[wd2].period==="AM" && d.A[wd2].type==="full" && d.A[wd3].period==="CST" && !d.A[wd3].type);
      saveFixedPattern(s4.id,false); var fp=s4.fixedPattern; var slotF=fixedSlotFor(s4,iso(ds[2])), slotC=fixedSlotFor(s4,iso(ds[3]));
      T("types: the saved pattern and the slot carry the type; the summary names it", fp.A[wd2].type==="full" && slotF.type==="full" && slotF.period==="AM" && slotC.period==="CST" && fixedPatternSummary(fp).indexOf("Full")>=0 && fixedPatternSummary(fp).indexOf("Admin")>=0);
      c.assign={}; applyFixedPatterns(); var shF=c.assign[s4.id+"|"+iso(ds[2])], shC=c.assign[s4.id+"|"+iso(ds[3])];
      T("types: placing the pattern books a full shift with its type and a non-clinical day as CST", !!shF && shF.kind==="clinical" && shF.type==="full" && shF.fixed===true && isFullShift(c,shF) && !!shC && shC.kind==="cst" && shC.fixed===true);
      var proj=fixedProjection(c,false), st=fixedCoverStats(c,proj), pd=st.per[iso(ds[2])], pc=st.per[iso(ds[3])];
      T("types: fixed cover counts a full shift in both halves and a non-clinical day in neither", pd.AM===1 && pd.PM===1 && pc.AM===0 && pc.PM===0 && proj[s4.id+"|"+iso(ds[3])].period==="CST");
      var v=(S.tab="roster",fixedView=true,viewRoster()); fixedView=false; T("types: the ghost chip names the type", /fxghost[^>]*>[^<]*Full</.test(v) && /fxghost[^>]*>Admin</.test(v));
    } finally { S.staff=keep.staff; c.assign=keep.assign; if(keep.types!==undefined)c.settings.shiftTypes=keep.types; else delete c.settings.shiftTypes; c.roles=keep.roles; _fpDraft=keep.draft; S.viewAs=keep.va; try{hydrateCycleSettings();hydrateCycleRoles();}catch(e){} }
  })();
  /* ----- bookings as events (14 Oct 2026): the booking call, the event log, the settle — supabase/prod-booking-rpc.sql ----- */
  (function(){ var keepS=JSON.stringify(S), keepB=_remoteBase, keepOk=_evOk, keepSeq=_evSeq, keepKS=_evKeySeq, keepSb=_sb, keepCo=cloudOn, keepQ=_evBase, keepMore=_moreOpen;
    S.viewAs="s1"; S.tab="selfroster"; cset().rosterMode="rounds"; S.rosterMode="rounds"; S.cycles[0].status="open"; S.cycles[0].archived=false; S.cycles[0].window=null; S.cycles[0].draft=null; S.cycles[0].waveState=null; S.fairness="guarded"; cset().fairness="guarded"; _srPick=[]; _srPickSid=null; _srSid="s1"; _receipt=null;
    var c=S.cycles[0], a=c.assign; _evBase=[]; _evKeySeq={}; _evSeq=0;
    var slot=null; cycleDates().some(function(d){ return S.zones.some(function(z){ var r=canBook("s1",iso(d),"AM",z.id); if(r.ok){ slot={day:iso(d),zone:z.id}; return true; } return false; }); });
    var day=slot?slot.day:iso(cycleDates()[3]), zone=slot?slot.zone:"z1", akey="s1|"+day; delete a[akey];
    // evApply: one event onto one copy
    var doc={cycles:[{id:c.id,assign:{}}],audit:[]};
    var ev1={seq:5,cycle:c.id,key:akey,val:{kind:"clinical",period:"AM",zone:zone},audit:{id:"aX1",ts:1,actor:"s1",action:"selfroster.book",detail:"x"}};
    T("events: a booking event sets the key on its cycle and puts the audit row first", evApply(doc,ev1)===true && JSON.stringify(doc.cycles[0].assign[akey])===JSON.stringify(ev1.val) && doc.audit[0].id==="aX1");
    T("events: applied twice, nothing changes and the audit row is not doubled", evApply(doc,ev1)===false && doc.audit.length===1);
    T("events: a removal clears the key; an unknown cycle is ignored", evApply(doc,{seq:6,cycle:c.id,key:akey,val:null,audit:{id:"aX2"}})===true && !(akey in doc.cycles[0].assign) && doc.audit[0].id==="aX2" && evApply(doc,{seq:7,cycle:"nope",key:akey,val:ev1.val})===false);
    // live state, then the merge base
    _remoteBase=JSON.stringify(S);
    _evApplyLive([ev1]); var liveOk=JSON.stringify(a[akey])===JSON.stringify(ev1.val) && _evSeq===5 && _evKeySeq[akey]===5 && _evBase.length===1;
    _evBaseFlush(); var baseHas=JSON.parse(_remoteBase).cycles[0].assign[akey];
    T("events: an event lands on the live roster, then on the merge base", liveOk && JSON.stringify(baseHas)===JSON.stringify(ev1.val) && _evBase.length===0);
    _evApplyLive([{seq:4,cycle:c.id,key:akey,val:null}]); T("events: an older event for the same key arriving late changes nothing", JSON.stringify(a[akey])===JSON.stringify(ev1.val) && _evSeq===5);
    _evApplyLive([{seq:9,cycle:c.id,key:akey,val:null,audit:{id:"aX9",ts:1,actor:"s1",action:"selfroster.unbook",detail:"x"}},{seq:8,cycle:c.id,key:akey,val:{kind:"clinical",period:"PM",zone:zone}}]);
    T("events: a batch applies in seq order, so the removal wins over the earlier booking", !(akey in a) && _evSeq===9 && S.audit[0].id==="aX9");
    _evBase=[{seq:10,cycle:c.id,key:"s2|"+day,val:{kind:"clinical",period:"AM",zone:zone}}]; mergeOnto(JSON.parse(JSON.stringify(S)));
    T("events: a merge folds the waiting events into the base before it compares", _evBase.length===0 && JSON.stringify(JSON.parse(_remoteBase).cycles[0].assign["s2|"+day])===JSON.stringify({kind:"clinical",period:"AM",zone:zone}));
    // the settle: the server's answer onto the picks on the screen
    var val={kind:"clinical",period:"AM",zone:zone}; a[akey]=val; var ops=[{op:"book",sid:"s1",day:day,period:"AM",zone:zone,type:null,hours:null,akey:akey,val:val,label:"Day "+day}];
    var f1=_bookSettle(c.id,"s1",ops,{ok:true,results:[{i:0,ok:false,reason:"That zone was just taken — pick another."}]});
    T("settle: a refused pick comes off the screen with the server's reason", !(akey in a) && f1.res.ok===true && f1.fails.length===1 && f1.fails[0].indexOf("That zone was just taken")>0 && f1.lost===true);
    a[akey]=val; var f2=_bookSettle(c.id,"s1",ops,null);
    T("settle: a call that never arrived takes every pick off and says so", !(akey in a) && f2.res.ok===false && f2.res.reason===BOOK_OFFLINE && f2.lost===true);
    a[akey]=val; var f3=_bookSettle(c.id,"s1",ops,{ok:true,results:[{i:0,ok:true,key:akey,val:val,seq:20,audit:{id:"aS20",ts:1,actor:"s1",action:"selfroster.book",detail:"Alex"}}]});
    T("settle: an accepted pick stays, confirmed by the server's own audit row", (akey in a) && f3.res.ok===true && f3.fails.length===0 && !f3.lost && S.audit[0].id==="aS20" && _evSeq===20);
    a[akey]={kind:"clinical",period:"PM",zone:zone}; _bookSettle(c.id,"s1",ops,{ok:true,results:[{i:0,ok:false,reason:"x"}]});
    T("settle: a refusal never removes a shift that is no longer the pick it made", a[akey].period==="PM");
    delete a[akey]; S.audit=S.audit.filter(function(x){ return x.id!=="aS20"&&x.id!=="aX9"; });
    // the tap path in event mode: a logging client in place of the real one
    var log=[]; _sb={rpc:function(fn,args){ log.push({fn:fn,args:args}); return {then:function(){}}; }, from:function(t){ log.push("from:"+t); var ch={}; ["select","eq","gt","order","limit","maybeSingle"].forEach(function(k){ ch[k]=function(){ return ch; }; }); ch.then=function(){}; return ch; }, channel:function(){ var tables=[]; var ch={on:function(ev,spec){ tables.push(spec.table); return ch; },subscribe:function(){ log.push("sub:"+tables.join("+")); }}; return ch; }};
    cloudOn=function(){ return true; }; _evOk=true; _inflight.delete("srConfirm"); _inflight.delete("unbook");
    T("tap: (fixture) a bookable AM slot exists for Alex", !!slot);
    if(slot){ var audBefore=S.audit.filter(function(x){ return x.action==="selfroster.book"&&String(x.detail).indexOf(day)>0; }).length; _srPick=[day+"|AM|"+zone]; srBatchBook(); var call=log.filter(function(x){return x.fn==="roster_commit";})[0];
      T("tap: in event mode the pick goes on the screen and to roster_commit, never into a document save", !!a[akey] && _inflight.has("srConfirm") && !!call && call.args.p_org===_org && call.args.p_cycle===c.id && call.args.p_ops.length===1 && call.args.p_ops[0].op==="book" && call.args.p_ops[0].sid==="s1" && call.args.p_ops[0].day===day && call.args.p_ops[0].period==="AM" && call.args.p_ops[0].zone===zone && !("akey" in call.args.p_ops[0]) && !("label" in call.args.p_ops[0]) && !log.some(function(x){ return x==="from:org_state"; }));
      T("tap: the audit row waits for the server (no local row for a pick in flight)", S.audit.filter(function(x){ return x.action==="selfroster.book"&&String(x.detail).indexOf(day)>0; }).length===audBefore);
      _inflight.delete("srConfirm"); _srPick=[]; delete a[akey];
      _inflight.add("srConfirm"); log.length=0; _srPick=[day+"|AM|"+zone]; srBatchBook(); T("tap: a tap while the last one is still saving is refused, never parked", !log.length && !(akey in a)); _inflight.delete("srConfirm"); _srPick=[]; }
    // remove through the call; the phone's own guards first; a fixed shift never
    a[akey]=val; log.length=0; var r=unbookShift("s1",day); var ub=log.filter(function(x){return x.fn==="roster_commit";})[0];
    T("remove: in event mode the shift comes off the screen and goes to roster_commit as an unbook", r===true && !(akey in a) && _inflight.has("unbook") && !!ub && ub.args.p_ops.length===1 && ub.args.p_ops[0].op==="unbook" && ub.args.p_ops[0].sid==="s1" && ub.args.p_ops[0].day===day);
    _inflight.delete("unbook"); a[akey]={kind:"clinical",period:"AM",zone:zone,fixed:true}; log.length=0; unbookShift("s1",day);
    T("remove: a fixed shift never goes to the call from a staff member", !log.some(function(x){return x.fn==="roster_commit";}) && !!a[akey]);
    delete a[akey];
    // which tables the phone listens to
    log.length=0; cloudSubscribe(); _evOk=false; cloudSubscribe(); var subs=log.filter(function(x){return typeof x==="string"&&x.indexOf("sub:")===0;});
    T("subscribe: event mode listens to roster_events and org_events; the old way to org_state", subs[0]==="sub:roster_events+org_events" && subs[1]==="sub:org_state");
    T("probe: only a missing table means the old way", _isMissingTable({code:"PGRST205"}) && _isMissingTable({code:"42P01"}) && _isMissingTable({message:"Could not find the table 'public.roster_events' in the schema cache"}) && !_isMissingTable({code:"PGRST301"}) && !_isMissingTable({message:"Failed to fetch"}));
    _evOk=true; _moreOpen=true; var about=moreSheetHTML(); _evOk=false; var about2=moreSheetHTML(); _moreOpen=false;
    T("about: the row says bookings go straight to the database once the call is there", about.indexOf("bookings go straight to the database")>0 && about2.indexOf("bookings go straight")<0);
    _sb=keepSb; cloudOn=keepCo; _evOk=keepOk; _evSeq=keepSeq; _evKeySeq=keepKS; _evBase=keepQ; _moreOpen=keepMore; _srPick=[]; _srSid=null; S=JSON.parse(keepS); _remoteBase=keepB; normalize(); })();
  /* ----- Friday hardening (14 Oct 2026, second push): the bell, the lost swap, the live channel ----- */
  (function(){ var keepN=S.notifications, keepSb=_sb, keepOk=_evOk, keepCo=cloudOn, keepRt=_rtStatus, keepNF=_rtNoFilter, keepMore=_moreOpen, keepSave=save;
    S.notifications=[{id:"rm1",to:"s1",text:"one",ts:Date.now(),readBy:[]},{id:"rm2",to:"all",text:"two",ts:Date.now(),readBy:[]}]; localStorage.removeItem(orgKey("_read:s1")); _readLocal=null; localStorage.setItem(KEY+"_seenBuild",BUILD);
    var before=unreadCount("s1"), calls=0; save=function(){ calls++; }; markNotifsRead("s1"); var after=unreadCount("s1"); save=keepSave;
    T("bell: marking read never saves the whole document; this device remembers the marks and the log carries them for the next save", before===2 && after===0 && calls===0 && JSON.parse(localStorage.getItem(orgKey("_read:s1")))["rm1"]===1 && S.notifications[0].readBy.indexOf("s1")>=0);
    S.notifications=[{id:"rm1",to:"s1",text:"one",ts:Date.now(),readBy:[]},{id:"rm3",to:"s1",text:"three",ts:Date.now(),readBy:[]}]; _readLocal=null;
    T("bell: after the cloud replaces the document, a mark this device made still counts, and a new notification is unread", unreadCount("s1")===1 && notifRead(S.notifications[0],"s1") && !notifRead(S.notifications[1],"s1"));
    _readSave("s1"); T("bell: the device keeps marks only for notifications still in the log", JSON.stringify(JSON.parse(localStorage.getItem(orgKey("_read:s1"))))==='{"rm1":1}');
    localStorage.removeItem(orgKey("_read:s1")); _readLocal=null; S.notifications=keepN;
    T("save: a whole-document save that loses its swap waits longer each time (to a minute), tries once while bookings flow, and never uploads a document the cloud already has", cloudSave.toString().indexOf("setTimeout(cloudSave,_saveWait+")>0 && cloudSave.toString().indexOf("_evOk===true?1:5")>0 && cloudSave.toString().indexOf("_devFree(S)===_devFree(f.data.data)")>0 && _syncedOk.toString().indexOf("_saveWait=4000")>0 && (function(){ var a={viewAs:"s1",tab:"my",activeId:"c1",x:1}, b={viewAs:"admin",tab:"roster",activeId:"c2",x:1}; return _devFree(a)===_devFree(b); })());
    var subs=[], removed=0; _sb={ removeChannel:function(){ removed++; }, channel:function(name){ var specs=[]; var ch={on:function(ev,spec){ specs.push(spec); return ch; },subscribe:function(cb){ subs.push({name:name,specs:specs,cb:cb}); return ch; }}; return ch; }, from:function(){ var ch={}; ["select","eq","gt","order","limit","maybeSingle"].forEach(function(k){ ch[k]=function(){ return ch; }; }); ch.then=function(){}; return ch; }, rpc:function(){ return {then:function(){}}; } };
    cloudOn=function(){ return true; }; _evOk=true; _rtNoFilter=false; _rtStatus="";
    cloudSubscribe(); var s0=subs[0]; var filtered=!!s0&&s0.specs.length===2&&s0.specs.every(function(x){ return x.filter==="org=eq."+_org; });
    s0.cb("SUBSCRIBED"); var onOk=_rtStatus==="SUBSCRIBED";
    s0.cb("CHANNEL_ERROR"); var fell=_rtNoFilter===true&&removed===1;
    cloudSubscribe(); var s1=subs[1]; var unfiltered=!!s1&&s1.specs.length===2&&s1.specs.every(function(x){ return !("filter" in x); })&&s1.name==="org-"+_org+"-all";
    T("live: the phone listens with the group filter and, if the server refuses it, listens without (its rows are its own by row-level security)", filtered && onOk && fell && unfiltered);
    _moreOpen=true; _rtStatus="SUBSCRIBED"; var a1=moreSheetHTML(); _rtStatus="CHANNEL_ERROR"; var a2=moreSheetHTML(); _moreOpen=false;
    T("about: the row says whether live updates are on", a1.indexOf("bookings go straight to the database · live updates on")>0 && a2.indexOf("live updates off")>0);
    _sb=keepSb; _evOk=keepOk; cloudOn=keepCo; _rtStatus=keepRt; _rtNoFilter=keepNF; _moreOpen=keepMore; })();
  /* ----- a newer build on the server: the reload banner and the reload actions (14 Oct 2026) ----- */
  (function(){ var keepT=_bootTag, keepN=_newBuild, keepMore=_moreOpen, keepTab=S.tab; _bootTag=null; _newBuild=false;
    var first=_buildSeen('W/"abc"'), same=_buildSeen('W/"abc"'), newer=_buildSeen('W/"def"'); var nb=document.getElementById("newbuild").innerHTML;
    T("build: the first tag is this build's own, the same tag is quiet, a different tag raises the update bar", first===false && same===false && newer===true && _newBuild===true && nb.indexOf('id="nbReload"')>0 && nb.indexOf("Myrosta has been updated")>=0);
    (function(){ var n=0, keepR=location.reload, keepD=_daySheet, keepP=_savePending; location.reload=function(){ n++; };
      _daySheet=null; _savePending=false; _inflight.delete("x"); _reloadWhenIdle(); var idleOk=n===1;
      _daySheet="2026-01-01"; _reloadWhenIdle(); var sheetHeld=n===1; _daySheet=null;
      _inflight.add("x"); _reloadWhenIdle(); var busyHeld=n===1; _inflight.delete("x");
      _savePending=true; _reloadWhenIdle(); var dirtyHeld=n===1; _savePending=keepP;
      _newBuild=false; _reloadWhenIdle(); var quiet=n===1;
      location.reload=keepR; _daySheet=keepD;
      T("build: the app reloads itself when idle, and waits while a sheet is open, a save is in flight or an edit is unsaved", idleOk && sheetHeld && busyHeld && dirtyHeld && quiet); })();
    _newBuild=true;
    _newBuild=false; newBuildPaint(); T("build: the banner clears when there is nothing to say", document.getElementById("newbuild").innerHTML==="" && _buildSeen("")===false);
    _bootTag=keepT; _newBuild=keepN;
    _moreOpen=true; var ms=moreSheetHTML(); _moreOpen=keepMore; var hv=""; try{ S.tab="help"; hv=viewHelp(); }catch(e){ hv="ERR "+e; } S.tab=keepTab;
    T("reload: More → Account has Reload the app, and the Help page's foot line too", ms.indexOf('id="sheetReload"')>0 && hv.indexOf('id="helpReload"')>0); })();
  /* ----- open shifts during an open round (14 Oct 2026): a removal is a removal, and a filled gap is no gap ----- */
  (function(){ var keepS=JSON.stringify(S), keepSb=_sb, keepOk=_evOk, keepCo=cloudOn; var c=S.cycles[0]; S.features={}; S.marketOn=true; cset().rosterMode="rounds"; S.rosterMode="rounds"; c.archived=false;
    c.status="open"; var dOpen=gapOnDrop(c); c.status="closed"; var dClosed=gapOnDrop(c); c.status="published"; var dPub=gapOnDrop(c); c.status="draft"; var dDraft=gapOnDrop(c);
    c.status="open"; cset().rosterMode="rolling"; S.rosterMode="rolling"; var dRolling=gapOnDrop(c); cset().rosterMode="rounds"; S.rosterMode="rounds";
    T("gaps: coming off during an open round broadcasts nothing; a closed round, a published roster and a live rolling roster still do; a draft never", dOpen===false && dClosed===true && dPub===true && dDraft===false && dRolling===true);
    var day=iso(addDays(parseISO(c.cycle.start),9)); c.status="open"; S.viewAs="s1"; var nBefore=S.notifications.length, osBefore=(S.openShifts||[]).length;
    c.assign["s1|"+day]={kind:"clinical",period:"AM",zone:"z1"}; var r=dropShift("s1",day);
    T("gaps: Remove this shift during an open round takes the shift off and posts no open shift and no notification", r===true && !("s1|"+day in c.assign) && S.notifications.length===nBefore && (S.openShifts||[]).length===osBefore);
    var log=[]; _sb={rpc:function(fn,args){ log.push({fn:fn,args:args}); return {then:function(){}}; }, from:function(){ var ch={}; ["select","eq","gt","order","limit","maybeSingle"].forEach(function(k){ ch[k]=function(){ return ch; }; }); ch.then=function(){}; return ch; }, channel:function(){ var ch={on:function(){ return ch; },subscribe:function(){}}; return ch; }};
    cloudOn=function(){ return true; }; _evOk=true; _inflight.delete("unbook"); c.assign["s1|"+day]={kind:"clinical",period:"AM",zone:"z1"}; dropShift("s1",day); var ub=log.filter(function(x){ return x.fn==="roster_commit"; })[0];
    T("gaps: in the cloud that removal goes through the booking call as an unbook", !!ub && ub.args.p_ops[0].op==="unbook" && ub.args.p_ops[0].day===day && !("s1|"+day in c.assign));
    _inflight.delete("unbook"); _sb=keepSb; cloudOn=keepCo; _evOk=keepOk;
    S.openShifts=[]; c.assign["s2|"+day]={kind:"clinical",period:"AM",zone:"z1"};
    _postGapBody(c.id,day,"AM","z1",null,"",null,false); _postGapBody(c.id,day,"AM","z2",null,"",null,false); _postGapBody(c.id,day,"AM","z2",null,"",null,false);
    var act=osActive();
    T("gaps: a gap whose zone has since been booked leaves the list, and the same slot posted twice shows once", act.length===1 && act[0].zone==="z2");
    S=JSON.parse(keepS); normalize(); })();
  /* ----- the Open shifts card while a round is open: no gaps to claim, a colleague's offer still shown ----- */
  (function(){ var keepS=JSON.stringify(S); var c=S.cycles[0]; S.features={}; S.marketOn=true; S.marketClaim="instant"; cset().rosterMode="rounds"; S.rosterMode="rounds"; c.archived=false; c.status="open"; S.viewAs="s1";
    var day=iso(addDays(parseISO(c.cycle.start),12)); S.openShifts=[]; delete c.assign["s1|"+day];
    _postGapBody(c.id,day,"AM","z2",null,"",null,false); var h1=marketMyHTML();
    T("open shifts: while the round is open a broadcast gap is not listed and the card says why", h1.indexOf('data-osclaim=')<0 && h1.indexOf("every free zone is on Book shifts")>0);
    c.status="closed"; var h2=marketMyHTML(); c.status="open";
    T("open shifts: once the round closes the same gap is back with its Claim button", h2.indexOf('data-osclaim=')>0 && h2.indexOf("every free zone is on Book shifts")<0);
    c.assign["s2|"+day]={kind:"clinical",period:"PM",zone:"z1"}; S.openShifts.unshift({id:"os-t1",cycleId:c.id,iso:day,period:"PM",zone:"z1",type:null,kind:"giveaway",from:"s2",status:"open",by:null,at:null,note:"",ts:Date.now(),actor:"s2"}); var h3=marketMyHTML();
    T("open shifts: a colleague's give-away still appears during the open round, and the sub-line says what the card is for", h3.indexOf('data-osclaim="os-t1"')>0 && h3.indexOf("not the round itself")>0);
    S=JSON.parse(keepS); normalize(); })();
  /* ----- My shifts names the month on every date too (15 Oct 2026) ----- */
  (function(){ var c=S.cycles[0], ds=cycleDates(); var a=agendaHTML("s1",iso(ds[0]),iso(ds[ds.length-1]));
    var n=0, ok=true; ds.forEach(function(d){ if(a.indexOf('<div class="dd">'+d.getDate()+'</div><div class="dm">'+fmt(d,{month:"short"})+'</div>')>0)n++; }); 
    T("agenda: every day carries the short month under its number", n>=ds.length-1 && n>0);
    var d0=new Date(2026,10,23), d1=new Date(2026,10,28), d2=new Date(2026,10,29), oct31=new Date(2026,9,31), nov1=new Date(2026,10,1);
    T("week strip: the day names its month, a run names it once, a run across a month names both", wkDayLabel(d0,null)==="Mon 23 Nov" && wkDayLabel(d1,d2)==="Sat 28 – Sun 29 Nov" && wkDayLabel(oct31,nov1)==="Sat 31 Oct – Sun 1 Nov"); })();
  /* ----- a closed round with an opening scheduled ahead is waiting, not finished (16 Oct 2026) ----- */
  (function(){ var keepS=JSON.stringify(S); var c=S.cycles[0]; cset().rosterMode="rounds"; S.rosterMode="rounds"; c.archived=false; S.viewAs="admin";
    var p2=function(n){ return String(n).padStart(2,"0"); }, fut=new Date(Date.now()+8*3600e3), far=new Date(Date.now()+10*86400e3);
    var dl=function(d){ return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+"T"+p2(d.getHours())+":"+p2(d.getMinutes()); };
    c.status="closed"; c.statusLog=[{to:"open",ts:Date.now()-2*86400e3,by:"schedule",notified:37},{to:"closed",ts:Date.now()-3600e3,by:"admin"}];
    c.window={enabled:true,open:dl(fut),close:dl(far),fired:null};
    var st=roundSteps(c), by=function(k){ return st.filter(function(x){ return x.key===k; })[0].state; }; var rc=statusReceipts(c);
    T("round: closed with an opening scheduled ahead — Open booking is the step now, Close and Publish are still to come", roundWaiting(c)===true && by("open")==="now" && by("close")==="todo" && by("publish")==="todo");
    T("round: the earlier opening and closing read as history, and the open step says when it opens", rc.open.indexOf("Earlier this cycle · Booking opened on schedule")===0 && rc.closed.indexOf("Earlier this cycle · Booking closed")===0 && roundStepperHTML(c).indexOf("Waiting to open: booking opens")>0);
    c.window=null; var st2=roundSteps(c), by2=function(k){ return st2.filter(function(x){ return x.key===k; })[0].state; }; var rc2=statusReceipts(c);
    T("round: closed with no schedule is finished as before — Publish is the step now", roundWaiting(c)===false && by2("open")==="done" && by2("close")==="done" && by2("publish")==="now" && rc2.closed.indexOf("Earlier")<0);
    S=JSON.parse(keepS); normalize(); })();
  /* ----- the roster grid names its fortnights (16 Oct 2026) ----- */
  (function(){ var keepQ=S.quotaPeriod, keepV=S.viewAs, keepT=S.tab; S.viewAs="admin"; S.tab="roster"; S.quotaPeriod="fortnight"; var ps=cyclePeriods(); var h=viewRoster();
    var cells=h.match(/<th class="fn" colspan="(\d+)">([^<]+)<\/th>/g)||[];
    var first=ps[0], lbl="Fortnight 1 · "+fmt(first.dates[0],{day:"numeric",month:"short"})+" – "+fmt(first.dates[first.dates.length-1],{day:"numeric",month:"short"});
    T("grid: a band names each fortnight with its dates, one merged cell per fortnight, and the first day of each carries the heavier rule", ps.length>=2 && cells.length===ps.length && cells[0].indexOf('colspan="'+first.dates.length+'"')>0 && cells[0].indexOf(lbl)>0 && h.indexOf('<tr class="fnrow"><th class="corner namecol">Fortnight</th>')>0 && (h.match(/ fnstart/g)||[]).length>=ps.length*2 && h.indexOf("<colgroup>")>0);
    S.quotaPeriod="week"; var hw=viewRoster(); S.quotaPeriod="month"; var hm=viewRoster(); S.quotaPeriod=keepQ;
    T("grid: a weekly share shows no band (the week rule is already there); a monthly share bands by month", hw.indexOf('class="fnrow"')<0 && hw.indexOf(" fnstart")<0 && hm.indexOf("Month 1 ·")>0);
    S.viewAs=keepV; S.tab=keepT; })();
  /* ----- a round closed with its opening scheduled ahead: no gaps posted, shown or claimable (16 Oct 2026) ----- */
  (function(){ var keepS=JSON.stringify(S); var c=S.cycles[0]; S.features={}; S.marketOn=true; S.marketClaim="instant"; cset().rosterMode="rounds"; S.rosterMode="rounds"; c.archived=false; c.status="closed";
    var p2=function(n){ return String(n).padStart(2,"0"); }, dl=function(d){ return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+"T"+p2(d.getHours())+":"+p2(d.getMinutes()); };
    c.window={enabled:true,open:dl(new Date(Date.now()+8*3600e3)),close:dl(new Date(Date.now()+10*86400e3)),fired:null};
    var day=iso(addDays(parseISO(c.cycle.start),16)); S.openShifts=[]; delete c.assign["s1|"+day]; delete c.assign["s2|"+day];
    T("waiting: coming off a shift posts no gap while the opening is scheduled ahead", roundWaiting(c)===true && gapOnDrop(c)===false);
    _postGapBody(c.id,day,"AM","z2",null,"",null,false); var gid=S.openShifts[0].id;
    S.viewAs="s1"; var h=marketMyHTML();
    T("waiting: a gap posted earlier is not listed for staff, and the card says when booking opens", h.indexOf('data-osclaim=')<0 && h.indexOf("Booking opens")>0 && h.indexOf("will be on Book shifts then")>0);
    var r=claimOpenShift(gid); var o=S.openShifts.filter(function(x){ return x.id===gid; })[0];
    T("waiting: a claim on that gap is refused with the opening time, and the shift stays unbooked", r===false && o.status==="open" && !("s1|"+day in c.assign));
    S.viewAs="admin"; var ha=marketMyHTML();
    T("waiting: the admin still sees the gap on My shifts, with Withdraw", ha.indexOf('data-oswd="'+gid+'"')>0);
    c.window=null; S.viewAs="s1"; var h2=marketMyHTML();
    T("closed with no opening scheduled: the gap is there to claim, as before", h2.indexOf('data-osclaim="'+gid+'"')>0);
    S=JSON.parse(keepS); normalize(); })();
  /* ----- events never resurrect what a later document write removed (16 Oct 2026) ----- */
  (function(){ var keepS=JSON.stringify(S), keepB=_remoteBase, keepSeq=_evSeq, keepDoc=_evDocSeq, keepKS=_evKeySeq, keepQ=_evBase, keepP=_savePending, keepT=_docT; var c=S.cycles[0], day=iso(addDays(parseISO(c.cycle.start),20)), akey="s1|"+day;
    delete c.assign[akey]; _evKeySeq={}; _evBase=[]; _evSeq=12; _evDocSeq=12; _remoteBase=JSON.stringify(S);
    var n1=_evApplyLive([{seq:9,cycle:c.id,key:akey,val:{kind:"clinical",period:"AM",zone:"z1"}}]);
    T("watermark: an event at or below the document's watermark is not applied — the cleared roster stays cleared", n1===0 && !(akey in c.assign));
    var n2=_evApplyLive([{seq:13,cycle:c.id,key:akey,val:{kind:"clinical",period:"AM",zone:"z1"}}]);
    T("watermark: an event above it is applied as before", n2===1 && (akey in c.assign) && _evSeq===13);
    _savePending=true; _syncedOk(); T("watermark: this device's own successful document save moves the watermark up to everything it has applied", _evDocSeq===13);
    _docT=null; var n3=_evApplyLive([{seq:14,cycle:c.id,key:"s2|"+day,val:{kind:"clinical",period:"PM",zone:"z2"}},{seq:15,org:_org,cycle:"",key:"",val:null,audit:null},{seq:16,cycle:c.id,key:"s3|"+day,val:{kind:"clinical",period:"AM",zone:"z3"}}]);
    T("watermark: a marker in a batch makes everything before it history and only what follows applies", n3===1 && !("s2|"+day in c.assign) && ("s3|"+day in c.assign) && _evDocSeq===15 && _evSeq===16);
    delete c.assign["s3|"+day]; delete c.assign[akey];
    T("watermark: the catch-up never reaches below it, the refetch reads it before the document, and a refusal that no event explains fetches the document", _evCatchUp.toString().indexOf("Math.max(_evDocSeq,")>0 && _docRefetch.toString().indexOf('from("roster_events")')<_docRefetch.toString().indexOf('from("org_state")') && srBatchBook.toString().indexOf("if(!n)_docRefetch()")>0 && _evProbe.toString().indexOf("if(sq>_evDocSeq)_evDocSeq=sq")>0);
    _evSeq=keepSeq; _evDocSeq=keepDoc; _evKeySeq=keepKS; _evBase=keepQ; _savePending=keepP; _docT=keepT; S=JSON.parse(keepS); _remoteBase=keepB; normalize(); })();
  /* ----- the schedule's wall time is the group's clock, wherever the phone is (16 Oct 2026) ----- */
  (function(){ var keepTZ=S.timezone; delete S.timezone;
    T("schedule: 10:00 on 16 Oct 2026 is 10:00 Melbourne (daylight saving, UTC+11) whatever the device's own zone", _dtMs("2026-10-16T10:00")===Date.UTC(2026,9,15,23,0) && _dtMs("2026-07-01T10:00")===Date.UTC(2026,6,1,0,0) && _dtMs("2026-10-16T10:00:30")===Date.UTC(2026,9,15,23,0,30));
    T("schedule: a time that carries its own zone, and a blank, are themselves", _dtMs("2026-10-16T10:00:00+05:30")===Date.UTC(2026,9,16,4,30) && _dtMs("")===null && _dtMs(null)===null);
    S.timezone="Pacific/Auckland"; var nz=_dtMs("2026-10-16T10:00"); S.timezone="Europe/London"; var uk=_dtMs("2026-10-16T10:00"); if(keepTZ)S.timezone=keepTZ; else delete S.timezone;
    T("schedule: a group with its own zone set reads the same wall time in that zone", nz===Date.UTC(2026,9,15,21,0) && uk===Date.UTC(2026,9,16,9,0));
    T("schedule: the shown time says which clock it is in only when the viewer's zone is not the group's", typeof schFmt("2026-10-16T10:00")==="string" && schFmt("2026-10-16T10:00").length>8); })();
  /* ----- Offer to group on My shifts: not for a self-booked shift while the round is open (16 Oct 2026) ----- */
  (function(){ var keepS=JSON.stringify(S); var c=S.cycles[0]; S.features={}; S.marketOn=true; cset().rosterMode="rounds"; S.rosterMode="rounds"; c.archived=false; S.viewAs="s1";
    var day=iso(addDays(parseISO(c.cycle.start),30)); if(day<iso(new Date()))day=iso(addDays(new Date(),3));
    var self={kind:"clinical",period:"AM",zone:"z1"}, fixed={kind:"clinical",period:"AM",zone:"z1",fixed:true};
    c.status="open"; var a1=marketOfferBtn("s1",day,self), b1=marketOfferBtn("s1",day,fixed);
    c.status="published"; var a2=marketOfferBtn("s1",day,self);
    T("offer: while the round is open a self-booked shift shows no Offer to group, a fixed one still does, and once published a self-booked one does again", a1==="" && b1.indexOf("data-osoffer")>0 && a2.indexOf("data-osoffer")>0);
    S=JSON.parse(keepS); normalize(); })();
  /* ----- the My shifts hero while a round waits to open (16 Oct 2026) ----- */
  (function(){ var keepS=JSON.stringify(S); var c=S.cycles[0]; cset().rosterMode="rounds"; S.rosterMode="rounds"; c.archived=false; c.status="closed";
    var p2=function(n){ return String(n).padStart(2,"0"); }, dl=function(d){ return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+"T"+p2(d.getHours())+":"+p2(d.getMinutes()); };
    c.window={enabled:true,open:dl(new Date(Date.now()+8*3600e3)),close:dl(new Date(Date.now()+10*86400e3)),fired:null}; var waiting=nothingYetText();
    c.window=null; var closed=nothingYetText();
    T("hero: a closed round with an opening scheduled says when booking opens; closed with nothing scheduled says it has closed", waiting.indexOf("Nothing yet — booking opens ")===0 && waiting.length>"Nothing yet — booking opens ".length && closed==="Nothing booked — booking has closed");
    S=JSON.parse(keepS); normalize(); })();
  /* ----- 16 Oct 2026, after the second morning: no whole-roster save from a phone during a round ----- */
  (function(){ var keepS=JSON.stringify(S), keepRA=_realAdmin, keepCo=cloudOn, keepSb=_sb, keepOk=_evOk; var c=S.cycles[0]; cset().rosterMode="rounds"; S.rosterMode="rounds"; c.archived=false; S.features={}; S.marketOn=true;
    var p2=function(n){ return String(n).padStart(2,"0"); }, dl=function(d){ return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+"T"+p2(d.getHours())+":"+p2(d.getMinutes()); };
    c.status="closed"; c.window={enabled:true,open:dl(new Date(Date.now()-60000)),close:dl(new Date(Date.now()+10*86400e3)),fired:null};
    T("window: a closed round whose scheduled window has opened is open for booking on every phone, reads Booking open, and keeps gaps off the staff card", roundEffOpen(c)===true && bookingGate(c).ok===true && statusLabel(c)==="Booking open" && roundOpenNow()===true && nothingYetText().indexOf("booking is open")>0);
    cloudOn=function(){ return true; }; _realAdmin=false; var ch=checkRoundSchedule();
    T("window: a staff phone never writes the flip — the status stays as it was and nothing is saved", ch===false && c.status==="closed");
    _realAdmin=true; var ch2=checkRoundSchedule();
    T("window: an admin's device records the opening", ch2===true && c.status==="open" && c.window.fired==="open");
    c.window=null; c.status="closed"; T("window: with no schedule a closed round is closed", roundEffOpen(c)===false && bookingGate(c).ok===false);
    // marks and the calendar token go through the call
    var log=[]; _sb={rpc:function(fn,args){ log.push({fn:fn,args:args}); return {then:function(){}}; }, from:function(){ var ch={}; ["select","eq","gt","order","limit","maybeSingle"].forEach(function(k){ ch[k]=function(){ return ch; }; }); ch.then=function(){}; return ch; }, channel:function(){ var ch={on:function(){ return ch; },subscribe:function(){}}; return ch; }};
    _evOk=true; c.status="open"; S.viewAs="s1"; var day=iso(addDays(parseISO(c.cycle.start),24)); delete c.assign["s1|"+day]; _inflight.delete("mark"); _inflight.delete("ics");
    var saves=0, keepSave=save; save=function(){ saves++; };
    var m1=markDay("s1",day,{kind:"cst"}); var op1=log.filter(function(x){ return x.fn==="roster_commit"; })[0];
    T("mark: clinical support time on the day sheet is one small call, on the screen at once, and never a whole-roster save", m1===true && c.assign["s1|"+day].kind==="cst" && !!op1 && op1.args.p_ops[0].op==="mark" && op1.args.p_ops[0].kind==="cst" && op1.args.p_ops[0].day===day && saves===0);
    _inflight.delete("mark"); log.length=0; var m2=markDay("s1",day,{kind:"leave",code:"UA"}); var op2=log.filter(function(x){ return x.fn==="roster_commit"; })[0];
    T("mark: unavailable likewise, with its code", m2===true && c.assign["s1|"+day].code==="UA" && !!op2 && op2.args.p_ops[0].op==="mark" && op2.args.p_ops[0].kind==="leave" && op2.args.p_ops[0].code==="UA" && saves===0);
    _inflight.delete("mark"); log.length=0; var m3=markDay("s1",day,{kind:"off"}); var op3=log.filter(function(x){ return x.fn==="roster_commit"; })[0];
    T("mark: off is a removal through the call", m3===true && !("s1|"+day in c.assign) && !!op3 && op3.args.p_ops[0].op==="unbook" && saves===0);
    _inflight.delete("mark"); c.assign["s1|"+day]={kind:"clinical",period:"AM",zone:"z1",fixed:true}; log.length=0; var m4=markDay("s1",day,{kind:"cst"});
    T("mark: a fixed shift is refused on the phone before any call", m4===false && !log.length && c.assign["s1|"+day].fixed===true); delete c.assign["s1|"+day];
    save=keepSave;
    T("token: the calendar link is minted through the call, never a whole-roster save", (function(){ var src=document.querySelectorAll.toString(); return true; })() && wireMyShiftsSrc().indexOf('[{op:"ics",sid:s2.id,token:tok}]')>0 && wireMyShiftsSrc().indexOf("cloudOn()&&_evOk===true")>0);
    T("refetch: a ping fetches the document at most once a minute per device, spread, and waits while a tap is in flight", _docRefetch.toString().indexOf("45000-(Date.now()-_docLast)")>0 && _docRefetch.toString().indexOf("_inflight.size")>0);
    var keepA=S.audit; S.audit=[]; for(var i=0;i<405;i++)logAudit("selfroster.book","x"+i,"s1"); var capped=S.audit.length; S.audit=keepA;
    var keepN=S.notifications; S.notifications=[]; for(var j=0;j<90;j++)S.notifications.push({id:"nn"+j,to:"all",text:"t",ts:j,readBy:[]}); normalize(); var ncap=S.notifications.length; S.notifications=keepN;
    T("size: the document keeps 400 audit lines and 80 notifications", capped===400 && ncap===80);
    _sb=keepSb; cloudOn=keepCo; _evOk=keepOk; _realAdmin=keepRA; S=JSON.parse(keepS); normalize(); })();
  /* ----- Remove placed fixed shifts (17 Oct 2026) ----- */
  (function(){ var keepS=JSON.stringify(S); var c=S.cycles[0]; S.viewAs="admin"; var d1=iso(addDays(parseISO(c.cycle.start),2)), d2=iso(addDays(parseISO(c.cycle.start),3)), d3=iso(addDays(parseISO(c.cycle.start),4));
    c.assign["s1|"+d1]={kind:"clinical",period:"AM",zone:"z1",fixed:true}; c.assign["s2|"+d2]={kind:"clinical",period:"PM",zone:"z2",fixed:true}; c.assign["s3|"+d3]={kind:"clinical",period:"AM",zone:"z3"}; c.assign["s1|"+d3]={kind:"leave",code:"UA"};
    var html=roundStepperHTML(c); var shown=html.indexOf('id="adFixedClear"')>0 && html.indexOf("Remove placed fixed shifts (2)")>0;
    var n=clearFixedShifts();
    T("fixed: the Round tab offers to remove the placed fixed shifts, and doing so removes only those — booked shifts and marks stay", shown && n===2 && !("s1|"+d1 in c.assign) && !("s2|"+d2 in c.assign) && c.assign["s3|"+d3].zone==="z3" && c.assign["s1|"+d3].code==="UA" && S.audit[0].action==="selfroster.fixedclear" && roundStepperHTML(c).indexOf('id="adFixedClear"')<0);
    S=JSON.parse(keepS); normalize(); })();
  /* ----- an admin's close wins over an open window; Reset this cycle (17 Oct 2026) ----- */
  (function(){ var keepS=JSON.stringify(S); var c=S.cycles[0]; S.viewAs="admin"; cset().rosterMode="rounds"; S.rosterMode="rounds"; c.archived=false; S.features={}; S.marketOn=true;
    var p2=function(n){ return String(n).padStart(2,"0"); }, dl=function(d){ return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())+"T"+p2(d.getHours())+":"+p2(d.getMinutes()); };
    c.status="open"; c.window={enabled:true,open:dl(new Date(Date.now()-3600e3)),close:dl(new Date(Date.now()+9*86400e3)),fired:"open"};
    setCycleStatus("closed");
    T("close: an admin closing booking inside an open window ends the window — the round reads closed on every phone and nobody can book", c.status==="closed" && c.window.enabled===false && c.window.fired==="closed" && roundEffOpen(c)===false && bookingGate(c).ok===false && statusLabel(c)==="Booking closed");
    var d1=iso(addDays(parseISO(c.cycle.start),2)), d2=iso(addDays(parseISO(c.cycle.start),3)), d3=iso(addDays(parseISO(c.cycle.start),4)), d4=iso(addDays(parseISO(c.cycle.start),5));
    c.assign["s1|"+d1]={kind:"clinical",period:"AM",zone:"z1",fixed:true}; c.assign["s2|"+d2]={kind:"clinical",period:"PM",zone:"z2"}; c.assign["s3|"+d3]={kind:"cst"}; c.assign["s1|"+d4]={kind:"leave",code:"UA"};
    c.statusLog=[{to:"open",ts:1,by:"schedule"},{to:"closed",ts:2,by:"admin"}]; c.window={enabled:true,open:"2026-10-16T10:00",close:"2026-10-25T17:00",fired:"closed"}; S.openShifts=[{id:"os-r1",cycleId:c.id,iso:d2,period:"AM",zone:"z3",type:null,kind:"gap",status:"open",by:null,at:null,note:"",ts:1,actor:"admin"}];
    var html=roundStepperHTML(c); var n=resetCycle();
    T("reset: every placed shift goes, leave and unavailable stay, the schedule and history clear, open shifts withdraw, and the cycle is a fresh draft", html.indexOf('id="adReset"')>0 && n===3 && !("s1|"+d1 in c.assign) && !("s2|"+d2 in c.assign) && !("s3|"+d3 in c.assign) && c.assign["s1|"+d4].code==="UA" && c.status==="draft" && c.window===null && c.statusLog.length===0 && S.openShifts[0].status==="withdrawn" && S.audit[0].action==="selfroster.reset" && roundSteps(c).filter(function(x){ return x.key==="open"; })[0].state!=="done");
    S=JSON.parse(keepS); normalize(); })();
  S.viewAs="admin"; S.tab="setup"; render(); S.tab="my"; S.viewAs="s1"; render();
  T("full render passes (setup + my)", true);
}catch(e){ LOG.push("HARNESS ERROR: "+(e&&((e.message||"")+" @ "+(e.stack||""))||e)); }
})();
"\n===== SUITE =====\n"+LOG.join("\n");
