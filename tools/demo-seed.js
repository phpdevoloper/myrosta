// Demo sandbox seed — injected into deploy/demo.html by tools/build-demo.py, after the app has booted in local mode.
// Runs once per browser (the demo storage key is empty on the first visit), then the visitor's own changes persist.
// Everything here is fictional: the cast and zones match the landing page's phone frame.
(function(){ try{
  if(S.staff.length) return;
  var NAMES=[["Jordan Lee","JL"],["Wei Ng","WN"],["Sam Patel","SP"],["Amara Okafor","AO"],["Alex Chen","AC"],["Morgan O'Brien","MO"],["Kim Nguyen","KN"],["Riley Silva","RS"],["Harper Singh","HS"],["Dana Kowalski","DK"],["Tom Abebe","TA"],["Lena Fischer","LF"]];
  var ZONES=[{id:"epic",name:"EPIC",am:true,pm:true,pmLabel:""},{id:"resus",name:"Resus",am:true,pm:true,pmLabel:""},{id:"paeds",name:"Paeds",am:true,pm:true,pmLabel:""},{id:"ssu",name:"SSU",am:true,pm:true,pmLabel:""},{id:"fast",name:"Fast track",am:true,pm:true,pmLabel:""},{id:"acute",name:"Acute bays",am:true,pm:true,pmLabel:""}];
  var STAFFING={amMin:2,amMax:3,pmMin:2,pmMax:2};   // a twelve-person sandbox: two on each period is the minimum; PM is full at two, so the morning always has a third slot to book
  S.branding={name:"Emergency Medicine"};
  S.staff=NAMES.map(function(n,i){return {id:"demo-"+i,name:n[0],initials:n[1],mobile:"",email:"",mode:"self",quota:i===0?14:21,eft:1,hrsFortnight:76,periodTargets:{}};});
  S.zones=JSON.parse(JSON.stringify(ZONES)); S.staffing=JSON.parse(JSON.stringify(STAFFING));
  S.fairness="guarded"; S.rosterMode="rounds"; S.quotaPeriod="fortnight"; S.quotaCapMode="hard"; S.marketOn=true; S.marketClaim="first";
  var c=active(); c.status="open"; c.roles={}; c.assign={}; c.statusLog=[{to:"open",ts:Date.now()-(4*86400e3+6*3600e3),by:"admin",notified:NAMES.length,sent:0}];   // the receipt on the Open booking step matches the seeded audit line
  var TIMES={AM:{start:"08:00",end:"16:00"},PM:{start:"15:30",end:"23:30"},ONC:{start:"23:30",end:"08:00"},CST:{start:"08:00",end:"16:00"}};
  var TYPES=[{id:"AM",code:"AM",label:"AM",start:"08:00",end:"16:00",fills:["AM"],on:true,book:true,builtin:"AM"},
    {id:"PM",code:"PM",label:"PM",start:"15:30",end:"23:30",fills:["PM"],on:true,book:true,builtin:"PM"},
    {id:"ONC",code:"OC",label:"On-call",start:"23:30",end:"08:00",fills:[],on:false,book:false,builtin:"ONC",derived:"oncall"},
    {id:"CST",code:"CST",label:"CST",long:"clinical support time",start:"08:00",end:"16:00",fills:[],on:true,book:true,builtin:"CST"},
    {id:"full",code:"LONG",label:"Long day",start:"08:00",end:"20:00",fills:["AM","PM"],on:true,book:true,builtin:null}];
  c.settings=c.settings||{}; c.settings.shiftTypes=JSON.parse(JSON.stringify(TYPES)); c.settings.shiftTimes=JSON.parse(JSON.stringify(TIMES)); c.settings.zones=JSON.parse(JSON.stringify(ZONES)); c.settings.staffing=JSON.parse(JSON.stringify(STAFFING)); c.settings.rosterMode="rounds"; c.settings.fairness="guarded"; c.settings.quotaPeriod="fortnight"; c.settings.quotaCapMode="hard";
  S.staff.forEach(function(st){ c.roles[st.id]={in:true,quota:st.quota,eft:st.eft,hrsFortnight:st.hrsFortnight,periodTargets:{}}; });
  try{ hydrateCycleSettings(); }catch(e){}
  var ds=cycleDates(), n=S.staff.length, zid=ZONES.map(function(z){return z.id;});
  // eight weeks of cover from the eleven colleagues: two on each AM and PM, rotating through the zones, so the grid reads as a healthy roster with a morning zone still open every day
  for(var i=0;i<ds.length;i++){ var d=iso(ds[i]);
    for(var k=0;k<2;k++){ var who=1+((i*4+k)%(n-1)); c.assign["demo-"+who+"|"+d]={kind:"clinical",period:"AM",zone:zid[(i+k)%6]}; }
    for(var k2=0;k2<2;k2++){ var whoPM=1+((i*4+k2+2)%(n-1)); if(!c.assign["demo-"+whoPM+"|"+d]) c.assign["demo-"+whoPM+"|"+d]={kind:"clinical",period:"PM",zone:zid[(i+k2+3)%6]}; }
    if(ds[i].getDay()===3){ var cst=1+((i+7)%(n-1)); if(!c.assign["demo-"+cst+"|"+d]) c.assign["demo-"+cst+"|"+d]={kind:"cst"}; }
  }
  // the visitor (Jordan Lee) holds eleven of a fourteen-shift share, on a free zone each time
  function freeZone(d,p){ for(var q=0;q<6;q++){ var z=zid[q], taken=Object.keys(c.assign).some(function(k){ var a=c.assign[k]; return k.split("|")[1]===d&&a.kind==="clinical"&&a.period===p&&a.zone===z; }); if(!taken)return z; } return null; }
  [[0,"AM"],[3,"AM"],[6,"AM"],[10,"AM"],[15,"AM"],[19,"AM"],[24,"AM"],[29,"AM"],[33,"AM"],[44,"AM"],[48,"AM"]].forEach(function(x){ var d=iso(ds[x[0]]), z=freeZone(d,x[1]); if(z)c.assign["demo-0|"+d]={kind:"clinical",period:x[1],zone:z}; });   // four, three, two, two across the four fortnights — room to book three more
  // one whole-day shift, so the two-tone chip and its arithmetic are visible in the sandbox
  (function(){ for(var i=6;i<ds.length;i++){ var d=iso(ds[i]);
      var amK=Object.keys(c.assign).find(function(k){var a=c.assign[k];return k.split("|")[1]===d&&a.kind==="clinical"&&a.period==="AM"&&k.indexOf("demo-0|")!==0;});
      var pmK=Object.keys(c.assign).find(function(k){var a=c.assign[k];return k.split("|")[1]===d&&a.kind==="clinical"&&a.period==="PM"&&k.indexOf("demo-0|")!==0;});
      if(!amK||!pmK)continue;
      var who=amK.split("|")[0]; delete c.assign[amK]; delete c.assign[pmK];   // free one slot in each half, then let one person cover both
      var free=zid.find(function(z){ return !Object.keys(c.assign).some(function(k){ var a=c.assign[k]; return k.split("|")[1]===d&&a.kind==="clinical"&&a.zone===z; }); });
      if(free){ c.assign[who+"|"+d]={kind:"clinical",period:"AM",zone:free,type:"full"}; return; }
      c.assign[amK]={kind:"clinical",period:"AM",zone:zid[0]}; c.assign[pmK]={kind:"clinical",period:"PM",zone:zid[1]}; } })();
  S.publicHolidays=[iso(ds[9])];
  addLeave({staffId:"demo-5",from:iso(ds[7]),to:iso(ds[11]),code:"AL",status:"approved"});
  addLeave({staffId:"demo-6",from:iso(ds[16]),to:iso(ds[16]),code:"CME",status:"approved"});
  addLeave({staffId:"demo-0",from:iso(ds[35]),to:iso(ds[39]),code:"AL",status:"approved"});
  // leave takes people off the roster; a free colleague covers the slot so the grid stays whole — except two days left short on purpose, for the Fix gaps story
  for(var j=0;j<ds.length;j++){ var dj=iso(ds[j]); ["demo-5","demo-6","demo-0"].forEach(function(sid){ var lv=S.leave.find(function(l){return l.staffId===sid&&l.from<=dj&&l.to>=dj;}); var a=c.assign[sid+"|"+dj]; if(!lv||!a)return; delete c.assign[sid+"|"+dj];
    if(a.kind!=="clinical")return; var best=null, bestN=1e9; for(var w=1;w<n;w++){ var cid="demo-"+w; if(cid===sid||c.assign[cid+"|"+dj]||S.leave.some(function(l){return l.staffId===cid&&l.from<=dj&&l.to>=dj;}))continue; var cnt=Object.keys(c.assign).filter(function(k){return k.indexOf(cid+"|")===0&&c.assign[k].kind==="clinical";}).length; if(cnt<bestN){bestN=cnt;best=cid;} } if(best)c.assign[best+"|"+dj]=a; }); }
  [[13,"PM"],[20,"AM"]].forEach(function(g){ var dg=iso(ds[g[0]]); var key=Object.keys(c.assign).find(function(k){ var a=c.assign[k]; return k.split("|")[1]===dg&&k.indexOf("demo-0|")!==0&&a.kind==="clinical"&&a.period===g[1]; }); if(key)delete c.assign[key]; });
  // a swap waiting for the viewer, an approved leave request, and an open shift broadcast by the admin
  var mine=Object.keys(c.assign).filter(function(k){return k.indexOf("demo-0|")===0&&c.assign[k].kind==="clinical";}).map(function(k){return k.split("|")[1];}).sort();
  var theirs=Object.keys(c.assign).filter(function(k){return k.indexOf("demo-2|")===0&&c.assign[k].kind==="clinical";}).map(function(k){return k.split("|")[1];}).sort();
  var dateB=mine[2]||iso(ds[4]), dateA=theirs.find(function(x){return x!==dateB&&mine.indexOf(x)<0;})||iso(ds[5]);
  S.requests=[
    {id:"demo-r1",type:"swap",from:"demo-2",dateA:dateA,peerId:"demo-0",dateB:dateB,reason:"School pickup",status:"awaiting-peer",createdTs:Date.now()-3600e3},
    {id:"demo-r2",type:"leave",from:"demo-0",code:"AL",dateFrom:iso(ds[35]),dateTo:iso(ds[39]),note:"Family trip",status:"approved",createdTs:Date.now()-86400e3*2,decidedTs:Date.now()-86400e3}
  ];
  S.viewAs="admin"; try{ for(var oi=12;oi<21;oi++){ var od=iso(ds[oi]), oz=freeZone(od,"PM"); if(oz){ var r=postOpenShift(od,"PM",oz,"Sick cover needed"); if(r&&r.ok!==false)break; } } }catch(e){}
  S.messages=[{id:"demo-m1",from:"admin",to:"all",text:"Welcome to the Myrosta demo. Everything here is sample data — book, swap and explore.",ts:Date.now()-86400e3}];
  notify("all","Booking is open — closes in two weeks. Book up to your share.");
  notify("demo-0","Your Annual leave request was approved.");
  // the audit log reads like a record: the setup days before the visitor arrived
  var H=3600e3, D=86400e3, t0=Date.now(); [
    [6*D+2*H,"admin","import.stafflist","12 consultants imported from the staff template"],[6*D+1.7*H,"admin","settings.shiftTimes","AM 08:00–16:00 · PM 15:30–23:30 · "+cyLabel(c)],[6*D+1.5*H,"admin","settings.staffing","AM 2–3 · PM 2–2 · "+cyLabel(c)],[6*D+1.2*H,"admin","cycle.dates",cyLabel(c)],
    [5*D+3*H,"admin","ph.mark",iso(ds[9])],[5*D+2*H,"admin","selfroster.fixed","11 fixed shifts placed · "+cyLabel(c)],[4*D+6*H,"admin","cycle.status",cyLabel(c)+" → open"],
    [3*D+5*H,"demo-1","selfroster.book","Wei Ng "+iso(ds[1])+" AM Resus"],[3*D+4.5*H,"demo-3","selfroster.book","Amara Okafor "+iso(ds[2])+" PM SSU"],[2*D+7*H,"demo-6","leave.request","CME "+iso(ds[16])],[2*D+3*H,"admin","leave.approve","Kim Nguyen · CME "+iso(ds[16])],
    [1*D+8*H,"demo-2","swap.request","with Jordan Lee · "+iso(ds[4])+" ↔ "+iso(ds[5])],[1*D+2*H,"demo-4","selfroster.unbook","Alex Chen "+iso(ds[12])+" AM Acute bays"]
  ].forEach(function(e,i){ S.audit.push({id:"demo-a"+i,ts:t0-e[0],actor:e[1],action:e[2],detail:e[3]}); });
  // the department board: Wattle Hospital's other staff groups, fictional people on a fixed rotation, so Whole department and the Group card work in the sandbox (built at every load by applyDemoBoard)
  S.branding.hospital="Wattle Hospital"; S.board={publish:true,show:[]};
  S.demoBoard={hospital:"Wattle Hospital",ownLabel:"Consultants",groups:[
    {org:"demo-nurses",label:"Nurses",noun:"nurses",ago:4,people:["Priya Raman","Tom Baxter","Lena Fischer","Noah Okonkwo","Grace Tan","Mia Hollis","Jack Reilly","Aisha Karim","Ben Carvalho","Zoe Lambert","Luca Moretti","Hannah Doyle"],
      slots:[{r:"RN",p:"AM",t:"07:00\u201315:30",n:3},{r:"EEN",p:"AM",t:"07:00\u201315:30",n:1},{r:"RN",p:"PM",t:"14:30\u201323:00",n:3},{r:"AIN",p:"PM",t:"14:30\u201323:00",n:1}],awayEvery:3},
    {org:"demo-juniors",label:"Junior doctors",noun:"junior doctors",ago:12,people:["Dr Eli Marsh","Dr Nina Petrov","Dr Omar Haddad","Dr Ruby Sato","Dr Finn Gallagher","Dr Leila Nasser","Dr Theo Brandt","Dr Isla Murray","Dr Kofi Mensah","Dr Yara Abboud"],
      slots:[{r:"Acute",p:"AM",t:"08:00\u201316:30",n:2},{r:"Fast track",p:"AM",t:"08:00\u201316:30",n:1},{r:"Acute",p:"PM",t:"14:00\u201322:30",n:2},{r:"Resus",p:"PM",t:"14:00\u201322:30",n:1}],awayEvery:4},
    {org:"demo-scribes",label:"Scribes",noun:"scribes",ago:27,people:["Sophie Hart","Daniel Kim","Maya Rossi","Ethan Clarke","Chloe Dubois","Arjun Mehta"],
      slots:[{r:"Scribe 1",p:"AM",t:"10:00\u201316:00",n:1},{r:"Scribe 1",p:"PM",t:"16:00\u201322:00",n:1},{r:"Scribe 2",p:"PM",t:"14:00\u201322:00",n:1,weekdays:true}],awayEvery:5},
    {org:"demo-admin",label:"Clerical admin",noun:"clerks",ago:41,people:["Pat Nolan","Jess Whitford","Rowan Ellis","Tina Marchetti","Sunil Bhatt","Carla Stone","Hugo Lindqvist"],
      slots:[{r:"Desk 1",p:"AM",t:"09:45\u201317:45",n:1},{r:"Desk 2",p:"AM",t:"09:30\u201315:00",n:1,weekdays:true},{r:"Desk 1",p:"PM",t:"17:30\u201322:15",n:1}],awayEvery:6}]};
  S.viewAs="demo-0"; S.tab="my";
  save(); applyDemoBoard(); render();
}catch(e){console.error("demo seed",e);} })();
