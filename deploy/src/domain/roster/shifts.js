"use strict";
// moved from js/roster.js lines 315-515 (Phase 1 split, no edits)
/* ---------- shift model ---------- */
function zoneById(id){return S.zones.find(z=>z.id===id);}
function zonesFor(period){return S.zones.filter(z=>period==="AM"?z.am:z.pm);}
function zoneLabel(z,period){return period==="PM"&&z.pmLabel?z.pmLabel:z.name;}
function zoneShort(z){ if(!z)return "?"; const own=String(z.short||"").trim(); if(own)return own.slice(0,5);   // the admin's short name, up to five letters
  const name=String(z.name||"").trim(), words=name.split(/[\s\/+&\-]+/).filter(w=>/[A-Za-z0-9]/.test(w));
  if(words.length>=2)return words.map(w=>w[0].toUpperCase()).join("").slice(0,5);   // "Fast track" → FT, "Acute bays" → AB
  return name.slice(0,5); }   // Resus, Paeds, EPIC stay themselves; a long single word is cut, and the Zones card lets the admin choose better
function monthLabel(z,period){ const full=zoneLabel(z,period); const narrow=(typeof window!=="undefined"&&window.innerWidth<=600); return (narrow||full.length>14)?zoneShort(z):full; }   // the month grid's chip is one fixed line: a phone shows the short name, a wide screen the full one
function _tHours(st,en){const a=String(st).split(":").map(Number),b=String(en).split(":").map(Number);let m=(b[0]*60+b[1])-(a[0]*60+a[1]);if(m<=0)m+=1440;return Math.round(m/60*100)/100;}   // overnight-safe duration in hours
function shiftTimesOf(cyc){ const d={AM:{start:"08:00",end:"16:00"},PM:{start:"15:30",end:"23:30"},ONC:{start:"23:30",end:"08:00"},CST:{start:"08:00",end:"16:00"}};
  const o=(cyc&&cyc.settings&&cyc.settings.shiftTimes)||{}; const out={};
  Object.keys(d).forEach(k=>{ const st=(o[k]&&o[k].start)||d[k].start, en=(o[k]&&o[k].end)||d[k].end; out[k]={code:k,start:st,end:en,hours:_tHours(st,en)}; });
  return out; }   // per-cycle shift times (templates phase 1) — booking labels, exports, calendar + fatigue all read these
function effShiftTimes(){ return shiftTimesOf(active()); }
/* ---------- shift types (per cycle) ----------
   AM and PM stay the engine's two periods forever — cover, zones and the unlock order all rest on them, and an
   assignment's `period` is ALWAYS one of those two (for a shift that spans the day it is the half it starts in).
   A TYPE is what a person actually works: the two builtins, the non-clinical block, the on-call rider, and any
   type an admin adds — including one whose `fills` names both periods, i.e. a full shift. The list is DERIVED on
   read from the cycle's own times, so an existing cycle behaves exactly as it did and its stored JSON is never
   rewritten until an admin saves the card. `code` is what payroll matches on and never changes; `label` is what
   people read and is theirs to rename. */
const TYPE_SEED=[{id:"AM",code:"AM",label:"AM",fills:["AM"],on:true,book:true,builtin:"AM"},
  {id:"PM",code:"PM",label:"PM",fills:["PM"],on:true,book:true,builtin:"PM"},
  {id:"ONC",code:"OC",label:"On-call",fills:[],on:true,book:false,builtin:"ONC",derived:"oncall"},
  {id:"CST",code:"CST",label:"CST",long:"clinical support time",fills:[],on:true,book:true,builtin:"CST"}];   // `long` spells a default code out in prose; renaming the type drops it, because the admin's own word needs no gloss
function shiftTypesOf(cyc){ const st=(cyc&&cyc.settings&&cyc.settings.shiftTypes);
  if(st&&st.length)return st;
  const t=shiftTimesOf(cyc); return TYPE_SEED.map(x=>({...x,fills:x.fills.slice(),start:t[x.builtin].start,end:t[x.builtin].end})); }   // seeded from THIS cycle's times, never from the module defaults
function effShiftTypes(){ return shiftTypesOf(active()); }
function typeById(cyc,id){ return id?(shiftTypesOf(cyc).find(t=>t.id===id)||null):null; }
function typeOn(cyc,id){ const t=typeById(cyc,id); return !!t&&t.on!==false; }
function typeOf(cyc,sh){ if(!sh)return null;
  if(sh.kind==="cst")return typeById(cyc,"CST");
  if(sh.kind!=="clinical")return null;
  return (sh.type&&typeById(cyc,sh.type))||typeById(cyc,sh.period); }   // an id that no longer exists degrades to the plain period — never drop a shift, an event or a reminder
function fillsOf(cyc,sh){ if(!sh||sh.kind!=="clinical")return [];
  const t=sh.type&&typeById(cyc,sh.type); const f=(t&&t.fills&&t.fills.length)?t.fills:null; return f?f.slice():[sh.period]; }   // one element for every shift that carries no type: today's behaviour, by construction
function shiftUnits(cyc,sh){ return fillsOf(cyc,sh).length||1; }   // what a shift costs against a share — a full shift is two
function isFullShift(cyc,sh){ return fillsOf(cyc,sh).length>1; }
function shiftHours(cyc,sh){ const w=shiftWindow(cyc,sh); return w?_tHours(w.start,w.end):0; }   // the window: a booking's own hours are what it counts, and a finish of 00:00 reads as midnight
function typeTime(t){ return t?(t.start+"\u2013"+t.end):""; }
function shTimeStr(cyc,sh){ const w=shiftWindow(cyc,sh); return w?windowStr(w):periodTime(sh&&sh.period); }
function typeLabelOf(cyc,sh){ const t=typeOf(cyc,sh); return (t&&t.label)||(sh&&sh.period)||""; }
function perName(p){ const t=typeById(active(),p); return (t&&t.label)||p; }   // the admin's word for a period ("Morning"), falling back to AM/PM
function typeClass(cyc,sh){ const f=fillsOf(cyc,sh); return f.length>1?"full":(f[0]==="PM"?"pm":"am"); }
function bookableTypes(cyc){ return shiftTypesOf(cyc).filter(t=>t.on!==false&&t.fills&&t.fills.length); }   // the clinical types this cycle offers, in order
function ocInUse(cyc,id){ const c=cyc||active(); if(!c||!c.oncall||!id)return 0; let n=0;
  Object.keys(c.oncall).forEach(k=>{ const h=c.oncall[k], i=k.indexOf("|"); if(h&&k.slice(i+1)===id&&ocCanHold(c,h,k.slice(0,i)))n++; }); return n; }
function ocCanHold(c,sid,isoD){ if(!S.staff.some(p=>p.id===sid))return false; const r=c&&c.roles&&c.roles[sid]; if(r&&r.in===false)return false;
  const a=c&&c.assign&&c.assign[sid+"|"+isoD]; if(a&&a.kind==="leave")return false; return !leaveOn(sid,isoD); }   // someone who has left, is out of this cycle, or is on leave carries no phone, whatever a stray key from another device says
function ocClearRange(sid,from,to){ S.cycles.forEach(c=>{ if(!c.oncall)return; Object.keys(c.oncall).forEach(k=>{ const d=k.slice(0,k.indexOf("|")); if(c.oncall[k]===sid&&d>=from&&d<=to)delete c.oncall[k]; }); }); }   // leave takes the phone, on every path that sets it
function ocClash(c,sid,isoD,w){ const s=ocSpan(isoD,w), d0=parseISO(isoD);
  const near=[-1,0,1].map(n=>iso(addDays(d0,n)));
  for(const d of near){ for(const x of ocHeldBy(c,sid,d)){ if(d===isoD&&x.id===w.id)continue; const o=ocSpan(d,x); if(o.st<s.en&&s.st<o.en)return x; } }
  return null; }   // one person never carries two windows at once: pay would count the same hours twice
function ocNewWindow(list){ const base="On-call", named=l=>list.some(w=>String(w.label).toLowerCase()===l.toLowerCase()); let k=1;
  while(named(k>1?base+" "+k:base))k++;
  const label=k>1?base+" "+k:base, stem=slug(label)+"-"+Date.now().toString(36); let id=stem, n=1; while(list.some(w=>w.id===id)){ n++; id=stem+n; }
  return {id:id,code:ocCode(list,slug(label)),label:label,start:"22:00",end:"08:00",book:true,rest:true,from:null}; }   // an id no window has had before: a take that arrives late for a removed window must never attach to a new one
function ocCode(list,id){ let c=String(id).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6)||"OC";   // payroll matches on this, so two windows can never share one
  if(!list.some(w=>w.code===c))return c;
  for(let i=2;i<99;i++){ const t=c.slice(0,6-String(i).length)+i; if(!list.some(w=>w.code===t))return t; }
  return c+Date.now().toString(36).slice(-2); }
let _srHours={}, _hrForm=null;   // device-only: the hours typed beside a pick, by day, written on Confirm; the Change-hours form open on the day sheet {d,start,end}
let _ciForm=null;   // device-only: the call-in form open on the day sheet or in the cell dialog, {k:"<iso>|<windowId>|<staffId>", start, end}
let _ocCard=null;   // device-only: the list the On-call card was drawn from, so a save writes what the admin saw and can tell when the list changed underneath it
function ocCardRows(){ const c=active(), list=ocWindows(c).map(w=>JSON.parse(JSON.stringify(w)));
  _ocCard={cyc:c.id,stored:JSON.stringify(c.settings&&c.settings.oncallWindows),list:list};
  return list.map((w,i)=>ocRowHTML(w,i)).join("")||'<div class="muted small">No on-call windows yet. Nobody can be put on call until you add one.</div>'; }
function ocCardStale(){ const c=active(); return !_ocCard||!c||_ocCard.cyc!==c.id||_ocCard.stored!==JSON.stringify(c.settings&&c.settings.oncallWindows); }
function ocRowsNow(){ const c=active(), base=(_ocCard&&c&&_ocCard.cyc===c.id)?_ocCard.list:ocWindows(c), list=base.map(w=>JSON.parse(JSON.stringify(w)));
  try{ document.querySelectorAll("#ocRows [data-ocid]").forEach(rowEl=>{ const w=list.find(x=>x.id===rowEl.dataset.ocid); if(!w)return; const g=q=>rowEl.querySelector(q);   // by window, never by position: another device may have added or removed one since the card was drawn
    const lab=((g(".oc-label")||{}).value); if(lab!=null)w.label=String(lab).trim().slice(0,24);
    const a=((g(".oc-start")||{}).value), b=((g(".oc-end")||{}).value); if(a!=null)w.start=a; if(b!=null)w.end=b;   // a field left blank is blank, so the check can say so instead of quietly keeping the old value
    const bk=g(".oc-book"); if(bk)w.book=!!bk.checked; const rs=g(".oc-rest"); if(rs)w.rest=!!rs.checked;
    const hs=g(".oc-hours"); if(hs&&hs.value){ if(hs.value==="chosen"){ const ln=parseFloat((g(".oc-len")||{}).value); w.chosen=true; w.usual=isFinite(ln)?Math.round(ln*2)*30:0; } else { delete w.chosen; delete w.usual; } }   // usual is kept in minutes, in half hours
    const zt=rowEl.querySelectorAll(".oc-z"); if(zt&&zt.length){ const boxes=[].slice.call(zt), drawn=boxes.map(x=>x.value), kept=((w.from&&w.from.zones)||[]).filter(id=>drawn.indexOf(id)<0), on=kept.concat(boxes.filter(x=>x.checked).map(x=>x.value)); w.from=on.length?{zones:on,period:(w.from&&w.from.period)||"PM"}:null; } if(w.chosen)w.from=null; }); }catch(e){}   // a zone with no box drawn is kept, never silently dropped
  return list; }
function ocCheck(list,c){ let bad="";   // the one set of rules every write of the list passes: Save, Add and Remove alike
  list.forEach(w=>{ if(bad)return; if(!w.label)bad="Every on-call window needs a name."; else if(!w.start||!w.end)bad="Fill every start and end time."; else if(w.start===w.end)bad=w.label+" starts and ends at the same time."; });
  if(!bad&&list.some((w,i)=>list.findIndex(x=>x.label.toLowerCase()===w.label.toLowerCase())!==i))bad="Two windows share a name \u2014 give each one its own.";
  if(!bad&&list.some((w,i)=>list.findIndex(x=>x.code===w.code)!==i))bad="Two windows share a payroll code. Remove one and add it again.";
  if(!bad)list.forEach(w=>{ if(bad)return; const was=ocWindow(c,w.id), n=ocInUse(c,w.id); if(w.from&&!(was&&was.from)&&n)bad=n+" "+(n===1?"day is":"days are")+" on call as "+w.label+" by hand, so it cannot start following a shift. Clear those first, or add a new window."; });   // their keys would be read as nothing, silently
  if(!bad)list.forEach(w=>{ if(bad||!w.chosen)return; const mins=Math.round(_tHours(w.start,w.end)*60);
    if(!(+w.usual>0))bad=w.label+" needs a usual length."; else if(+w.usual>mins)bad="The usual length of "+w.label+" is longer than its hours."; });
  if(!bad)list.forEach(w=>{ if(bad)return; const was=ocWindow(c,w.id); if(!was||!!was.chosen===!!w.chosen)return;
    const n=was.chosen?ciInUse(c,w.id):ocInUse(c,w.id); if(!n)return;
    bad=was.chosen?(n+" call-in"+(n===1?" is":"s are")+" logged on "+w.label+", so its hours cannot switch to fixed. Remove them first, or add a new window.")
                  :(n+" "+(n===1?"day is":"days are")+" on call as "+w.label+", so its hours cannot switch to chosen when booked. Clear those first, or add a new window."); });   // either way, what is already on the roster would be read as nothing
  if(!bad)list.forEach(w=>{ if(bad||!w.chosen)return; if(ciMin(w.end)<=ciMin(w.start)&&w.end!=="00:00")bad="The hours of "+w.label+" cross midnight. A call-in\u2019s day must be clear for pay, so end it at 00:00, and add a second window from 00:00 if you need one."; });   // a call-in is dated by the day it is logged for, as payroll dates it, so a Chosen window's hours stay on one day. After the switch rule, so a window that cannot switch says so first
  return bad; }
function ocImpact(c,next){ const was=ocWindows(c).filter(w=>w.from), now=next.filter(w=>w.from), today=iso(new Date()); let n=0, past=0;
  if(!was.length&&!now.length)return {n:0,past:0};
  Object.keys(c.assign||{}).forEach(k=>{ const sh=c.assign[k]; if(!sh||sh.kind!=="clinical")return;
    const a=was.filter(w=>ocFollows(c,w,sh)).map(w=>w.id).sort().join(), b=now.filter(w=>ocFollows(c,w,sh)).map(w=>w.id).sort().join();
    if(a!==b){ n++; if(k.slice(k.indexOf("|")+1)<today)past++; } });
  return {n:n,past:past}; }   // how many shifts on this roster would gain or lose the on-call that follows them
function ocImpactText(hit){ return hit.n+" shift"+(hit.n===1?"":"s")+" on this roster "+(hit.n===1?"gains or loses":"gain or lose")+" the on-call that follows "+(hit.n===1?"it":"them")+(hit.past?" \u2014 "+hit.past+" already worked":"")+". Payroll, RosterOn, calendars and Fairness follow the change."; }
function ocPin(c){ if(!c||!c.settings||Array.isArray(c.settings.oncallWindows))return; const w=ocFromTick(c);
  c.settings.oncallWindows=JSON.parse(JSON.stringify(w));
  if(w.length)logAudit("settings.oncall","kept as it was before a zone change: "+w.map(x=>x.label+" "+ocTime(x)+" (follows "+ocFromText(x)+")").join(" \u00b7 ")+" \u00b7 "+cyLabel(c),"admin"); }   // from the first zone edit on, only the On-call card changes on-call: renaming a zone can no longer switch it on or off by its name
function typeRepointed(list,c){ const t=list.find(x=>{ const was=typeById(c,x.id); return was&&(x.fills||[]).join("+")!==(was.fills||[]).join("+")&&typeInUse(c,x.id); });
  return t?typeInUse(c,t.id)+" shifts are booked as "+t.label+", so it cannot change which half of the day it covers. Switch it off and add a new type instead.":""; }   // Add and Remove save the whole list, so they pass this too
function keepHiddenTypes(base,out){ base.forEach((b,i)=>{ if(b.derived==="oncall"&&!out.some(t=>t.id===b.id))out.splice(Math.min(i,out.length),0,{...b,fills:(b.fills||[]).slice()}); }); return out; }   // the on-call type is not on the Shift types card, but a save must not drop it: a cycle that never saved its on-call windows gets them from it
function typeInUse(cyc,id){ if(!id||!cyc||!cyc.assign)return 0; let n=0; Object.keys(cyc.assign).forEach(k=>{ const v=cyc.assign[k]; if(v&&v.kind==="clinical"&&v.type===id)n++; }); return n; }   // how many shifts would change meaning if this type went away
function typeRowsNow(){ const list=shiftTypesOf(active()).map(t=>({...t,fills:(t.fills||[]).slice()}));   // the stored list with whatever the admin has typed but not yet saved, so Add and Remove never discard an edit
  try{ document.querySelectorAll("#typeRows [data-sti]").forEach(rowEl=>{ const t=list[+rowEl.dataset.sti]; if(!t)return; const g=c=>rowEl.querySelector(c);
    const lab=((g(".st-label")||{}).value); if(lab!=null&&String(lab).trim())t.label=String(lab).trim().slice(0,24);
    const a=((g(".st-start")||{}).value), b=((g(".st-end")||{}).value); if(a)t.start=a; if(b)t.end=b;
    const fs=g(".st-fills"); if(fs&&fs.value)t.fills=String(fs.value).split("+");
    const on=g(".st-on"); if(on)t.on=!!on.checked; const bk=g(".st-book"); if(bk)t.book=!!bk.checked; }); }catch(e){}
  return list; }
function typeIsDefault(t){ return !!t&&t.builtin&&t.fills&&t.fills.length===1&&t.id===t.builtin; }   // AM and PM carry no `type` on the assignment, so old and new keys match
function bothZones(){ return S.zones.filter(z=>z.am&&z.pm); }   // a full shift needs a zone that runs in both periods
function effFatigue(){ const f=(active()&&active().settings&&active().settings.fatigue)||{}; return {mode:f.mode||"off",minRest:(f.minRest!=null?+f.minRest:10),maxConsec:(f.maxConsec!=null?+f.maxConsec:5)}; }   // safe-hours rules — per cycle, OFF by default
function _shiftSpan(sid,isoD,p,zoneId,typeId,hours){ const t=effShiftTimes(); const d0=parseISO(isoD); const _cy=active();   // hours: the booking's own {start,end}, when it has them
  const mk=(dt,hm)=>{const x=String(hm).split(":");return new Date(dt.getFullYear(),dt.getMonth(),dt.getDate(),+x[0],+x[1]);};
  const _ty=typeId?typeById(_cy,typeId):null;
  const base=(hours&&hoursOK(hours.start,hours.end))?hours:(_ty?_ty:(p==="AM"?t.AM:t.PM)); let st=mk(d0,base.start), en=mk(d0,base.end); if(en<=st)en=mk(addDays(d0,1),base.end);   // the next calendar day, not 24 hours on: across a daylight-saving change those differ by an hour
  if(zoneId){ const _as={kind:"clinical",period:p,zone:zoneId}; if(typeId)_as.type=typeId;
    ocWindows(_cy).forEach(w=>{ if(w.rest===false||!ocFollows(_cy,w,_as))return; const o=ocSpan(isoD,w); if(o.en>en)en=o.en; }); }   // a window that follows this shift is worked straight through to its end, as ROC+OC always was
  return {st,en}; }
/* Everything one person is committed to on one day, as absolute spans, earliest first, with touching or
   overlapping stretches merged. A shift and the on-call window that starts the moment it ends are ONE
   run of duty, not a rest breach between two. `skip` leaves out the thing being judged. */
function _coalesceSpans(l){ l=l.slice().sort((a,b)=>a.st-b.st); const out=[];
  l.forEach(s=>{ const p=out[out.length-1]; if(p&&s.st<=p.en){ if(s.en>p.en)p.en=s.en; } else out.push({st:s.st,en:s.en}); });
  return out; }
function _spansOn(cyc,sid,isoD,skip){ const c=cyc||active(), out=[];
  const sh=(c.assign||{})[sid+"|"+isoD];
  if(sh&&sh.kind==="clinical"&&!(skip&&skip.shift))out.push(_shiftSpan(sid,isoD,sh.period,sh.zone,sh.type,sh.hours));
  ocTakenBy(c,sid,isoD).forEach(w=>{ if(w.rest===false)return; if(skip&&skip.win===w.id)return; out.push(ocSpan(isoD,w)); });   // a window that follows the shift is already inside its span
  return _coalesceSpans(out); }
function _onDutyDay(sid,isoD){ const sh=getShift(sid,isoD); if(sh.kind==="clinical")return 1;
  return ocTakenBy(active(),sid,isoD).some(w=>w.rest!==false)?2:0; }   // 1 a clinical day, 2 a day on call and nothing else, 0 neither
function _restCheck(f,sid,isoD,cand,skip){
  const d0=parseISO(isoD), c=active();
  const day=_coalesceSpans(_spansOn(c,sid,isoD,skip).concat([cand]));
  if(f.minRest>0){
    const prev=_spansOn(c,sid,iso(addDays(d0,-1)),null);
    if(prev.length){ const rest=(day[0].st-prev[prev.length-1].en)/36e5; if(rest<f.minRest)return "Only "+Math.max(0,Math.round(rest*10)/10)+"h rest after the previous shift (rule: "+f.minRest+"h)."; }
    for(let i=1;i<day.length;i++){ const gap=(day[i].st-day[i-1].en)/36e5; if(gap<f.minRest)return "Only "+Math.max(0,Math.round(gap*10)/10)+"h rest between two stretches of duty that day (rule: "+f.minRest+"h)."; }   // a morning shift and a night on call the same day are two stretches, with a rest between them like any other
    const next=_spansOn(c,sid,iso(addDays(d0,1)),null);
    if(next.length){ const rest2=(next[0].st-day[day.length-1].en)/36e5; if(rest2<f.minRest)return "Only "+Math.max(0,Math.round(rest2*10)/10)+"h rest before the next day's shift (rule: "+f.minRest+"h)."; }
  }
  if(f.maxConsec>0){ let run=1, oc=!!(skip&&skip.win)&&getShift(sid,isoD).kind!=="clinical";
    for(let i=1;i<=14;i++){ const k=_onDutyDay(sid,iso(addDays(d0,-i))); if(!k)break; run++; if(k===2)oc=true; }
    for(let i=1;i<=14;i++){ const k=_onDutyDay(sid,iso(addDays(d0,i))); if(!k)break; run++; if(k===2)oc=true; }
    if(run>f.maxConsec)return "This makes "+run+(oc?" days on duty":" clinical days")+" in a row (rule: max "+f.maxConsec+")."; }   // a run that includes days only on call is not a run of clinical days
  return null; }
function fatigueCheck(sid,isoD,p,zoneId,typeId,hours){ const f=effFatigue(); if(f.mode==="off")return null;
  return _restCheck(f,sid,isoD,_shiftSpan(sid,isoD,p,zoneId,typeId,hours),{shift:true}); }
function ocFatigueCheck(sid,isoD,winId,times){ const f=effFatigue(); if(f.mode==="off")return null;   // times: a call-in's own hours
  const w=ocWindow(active(),winId); if(!w||w.rest===false||w.from)return null;   // a window that is not counted toward rest cannot breach it
  return _restCheck(f,sid,isoD,ocSpan(isoD,times?ciAt(w,times):w),{win:winId}); }
let _fatigueWarn=null, _ocLost=[];
function ocLostToast(){ if(!_ocLost.length)return; const x=_ocLost[0], more=_ocLost.length-1; _ocLost=[];
  try{ const c=(S.cycles||[]).find(cc=>cc.id===x.cyc), i=x.k.indexOf("|"), w=c?ocWindow(c,x.k.slice(i+1)):null, p=S.staff.find(s=>s.id===x.now);
    toast((w?w.label:"On-call")+" on "+fmtISO(x.k.slice(0,i))+" stays with "+(p?shortNm(p):"someone else")+", who had it first."+(more?" "+more+" more on-call change"+(more>1?"s":"")+" didn\u2019t go through.":""),"warn"); }catch(e){} }
function periodTime(p){const t=effShiftTimes();const x=p==="AM"?t.AM:t.PM;return x.start+"–"+x.end;}
function getShift(staffId,isoD){const a=CTX().assign[staffId+"|"+isoD];if(a)return a;const lv=leaveOn(staffId,isoD);if(lv)return {kind:"leave",code:lv.code};return {kind:"off"};}
function setShift(staffId,isoD,sh){const a=CTX().assign;const k=staffId+"|"+isoD; if(!sh||sh.kind==="off")delete a[k]; else a[k]=sh; if(sh&&sh.kind==="leave")ocClearRange(staffId,isoD,isoD); swTidy(); save();}   // leave set from a roster cell or the day sheet takes the phone too
function markDay(sid,isoD,sh){   // the day sheet's own marks — clinical support time, off, unavailable — through the booking call where the database has it (16 Oct 2026: each used to save the whole roster from the phone); the admin's roster cell keeps setShift
  const _cyc=S.activeId, c=active(), cur=(c.assign||{})[sid+"|"+isoD], off=!sh||sh.kind==="off";
  const _audit=()=>{ if(off)logAudit("selfroster.off",nameOf(sid)+" "+isoD,sid); else if(sh.kind==="cst")logAudit("selfroster.cst",nameOf(sid)+" "+isoD,sid); else logAudit("selfroster.ua",nameOf(sid)+" "+isoD,sid); };
  if(!(cloudOn()&&_evOk===true)){ setShift(sid,isoD,off?{kind:"off"}:sh); _audit(); return true; }
  if(cur&&cur.fixed&&!isAdmin()){ toast("Fixed shift \u2014 ask your admin to change it.","danger"); return false; }
  if(off&&!cur)return true;
  if(_inflight.has("mark")){ toast("Still saving your last tap \u2014 one moment."); return false; }
  const a=c.assign; if(off)delete a[sid+"|"+isoD]; else a[sid+"|"+isoD]=sh; if(sh&&sh.kind==="leave")ocClearRange(sid,isoD,isoD);   // on the screen now; the database confirms it
  _inflight.add("mark"); _selfChange=true; render();
  const op=off?{op:"unbook",sid:sid,day:isoD}:{op:"mark",sid:sid,day:isoD,kind:sh.kind,code:sh.code||null};
  cloudBook(_cyc,sid,[op]).then(res=>{ _inflight.delete("mark"); const r=res&&res.ok===true&&Array.isArray(res.results)?res.results[0]:null;
    if(r&&r.ok){ _evApplyLive([{seq:r.seq,cycle:_cyc,key:r.key||(sid+"|"+isoD),val:(r.val==null?null:r.val),audit:r.audit}]); const before=_snap([S.openSwaps,S.swapOffers,S.openShifts,S.notifications]); swTidy(); if(_snap([S.openSwaps,S.swapOffers,S.openShifts,S.notifications])!==before)save(); }
    else { const cc=S.cycles.find(x=>x.id===_cyc); if(cc&&cc.assign){ if(cur)cc.assign[sid+"|"+isoD]=cur; else delete cc.assign[sid+"|"+isoD]; } toast((r&&r.reason)||(res&&res.reason)||BOOK_OFFLINE,"danger"); if(r)_evCatchUp().then(n=>{ if(!n)_docRefetch(); }); }
    _selfChange=true; render(); });
  return true; }
function clinicalCounts(isoD,excludeId){
  let am=0,pm=0;
  const _cy=active();
  for(const s of S.staff){ if(s.id===excludeId)continue; const sh=getShift(s.id,isoD);
    if(sh.kind==="clinical"){ const f=fillsOf(_cy,sh); for(let i=0;i<f.length;i++)f[i]==="AM"?am++:pm++; } }   // a full shift is cover in BOTH periods
  return {am,pm};
}
function zoneTaken(isoD,period,zoneId,excludeId){
  const _cy=active();
  for(const s of S.staff){ if(s.id===excludeId)continue; const sh=getShift(s.id,isoD);
    if(sh.kind==="clinical"&&sh.zone===zoneId&&fillsOf(_cy,sh).indexOf(period)>=0)return s; }   // a full shift holds its zone in both halves
  return null;
}
// progressive unlock, parameterised by configurable staffing
/* ---------- notice period: how close to a shift a person may still walk away from it ----------
   One number on the cycle. 0 = off, which is what every existing cycle computes, so nothing changes
   until an admin sets it. Read ONLY through effNotice(cyc) — deliberately NOT hydrated onto S, because
   a mirrored global is what lets a settings card render one cycle's value and save it onto another. */
function effNotice(cyc){ const c=cyc||active(); const v=c&&c.settings&&c.settings.noticeDays; const nDays=parseInt(v,10); return (nDays>0&&nDays<=365)?nDays:0; }
function noticeBinds(cyc){ const c=cyc||active(); return !!c && !c.archived && c.status!=="draft" && effNotice(c)>0; }   // a draft is not a promise to anyone; an archived cycle is history
function daysUntil(isoD){ return Math.round((parseISO(isoD)-parseISO(iso(new Date())))/864e5); }
function inNotice(isoD,cyc){ const c=cyc||active(); if(!noticeBinds(c))return false; return daysUntil(isoD)<=effNotice(c); }   // a past day is inside it too — you cannot walk away from yesterday
