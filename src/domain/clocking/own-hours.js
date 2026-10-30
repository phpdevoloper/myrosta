"use strict";
// moved from js/admin.js lines 893-930 (Phase 1 split, no edits)
/* ---------- own hours on a booking: a clinical shift may carry hours:{start,end} when they differ from its type's window; one reader answers every question about a shift's times ----------
   Spec: docs/superpowers/specs/2026-09-26-own-hours-s4-design.md. Cover, unlock, quota, fairness, the S3 judge and the on-call layer read the type and the half; pay, the calendar, reminders, the digest and the safe-hours rules read the window. */
const HOURS_RULE="Choose a start and a finish on the same day, in 5-minute steps, with the finish after the start (or 00:00 for midnight).";
function hoursOK(start,end){ const re=/^([01]\d|2[0-3]):([0-5]\d)$/, a=re.exec(String(start||"")), b=re.exec(String(end||"")); if(!a||!b)return false;
  if((+a[2])%5||(+b[2])%5)return false; const s=(+a[1])*60+(+a[2]), e=(+b[1])*60+(+b[2]);
  return e>s||(e===0&&s>0); }   // the finish after the start on the same day, or 00:00 for midnight; never across midnight (the call-ins rule)
function hoursNorm(cyc,sh,start,end){ if(!hoursOK(start,end))return null; const t=typeOf(cyc,sh); if(t&&t.start===start&&t.end===end)return null; return {start:start,end:end}; }   // the pair to store, or null: the type's own window is never stored, and neither is a pair the rule refuses (a caller that must say why asks hoursOK first)
function shiftWindow(cyc,sh){ const t=typeOf(cyc,sh), h=!!sh&&sh.kind==="clinical"&&sh.hours;
  if(h&&hoursOK(h.start,h.end))return {start:h.start,end:h.end,own:true};
  return t?{start:t.start,end:t.end,own:false}:null; }   // the one reader: the booking's own hours when present and valid, else the type's window; CST, leave and on-call are never own
function windowStr(w){ return w?(w.start+"\u2013"+w.end):""; }
function ownHoursTag(cyc,sh){ const w=shiftWindow(cyc,sh); return (w&&w.own)?" "+windowStr(w):""; }   // " 09:30–15:00" after a label or a name when the hours are the booking's own, else nothing
function ownHoursOn(){ return S.ownHours===true; }   // the group switch: absent means off, and normalize() seeds nothing
function hoursRefusal(c,sid,isoD,sh,start,end,clearing){ const adm=isAdmin();
  if(!sh||sh.kind!=="clinical")return "No shift that day to set hours on.";
  if(!adm){ if(sid!==S.viewAs)return "You can only change your own hours.";
    if(!ownHoursOn())return "Your admin sets hours for this group.";
    if(c.status==="draft"||c.archived)return "This roster isn\u2019t live yet.";
    if(isoD<iso(new Date()))return "That day has passed \u2014 ask your admin."; }
  if(!clearing&&!hoursOK(start,end))return HOURS_RULE;
  return ""; }   // every rule a change of hours passes, read inside the write
function hoursAudit(sid,isoD,sh,prev,actor){ const next=(sh&&sh.kind==="clinical"&&sh.hours)||null; if(JSON.stringify(next)===JSON.stringify(prev||null))return false;
  const c=active(), txt=next?windowStr(next):"the "+typeLabelOf(c,sh)+" hours";
  const line=nameOf(sid)+" "+isoD+" "+shiftLabel(sh)+" \u2192 "+txt; if(next)logAudit("hours.set",line,actor||S.viewAs); else logAudit("hours.clear",line,actor||S.viewAs); return true; }   // one line when the hours changed, none when they did not: the cell editor and hoursSet both write through here (each key a literal, for the audit lint)
function hoursSet(sid,isoD,start,end){ const clearing=!String(start||"").trim()&&!String(end||"").trim();   // set or clear a booking's own hours: a guarded write, judged again inside it; an empty pair clears
  return commitGuarded(()=>{ const c=active(), sh=(c.assign||{})[sid+"|"+isoD], adm=isAdmin();
    const bad=hoursRefusal(c,sid,isoD,sh,start,end,clearing); if(bad)return {ok:false,reason:bad};
    const prev=sh.hours||null, next=clearing?null:hoursNorm(c,sh,start,end);
    if(JSON.stringify(next)===JSON.stringify(prev))return {ok:true};   // nothing to change, nothing to say
    let _fv=null; if(next){ const f=effFatigue(); if(f.mode!=="off")_fv=_restCheck(Object.assign({},f,{maxConsec:0}),sid,isoD,_shiftSpan(sid,isoD,sh.period,sh.zone,sh.type,next),{shift:true});   // a change of hours can neither cause nor cure a run of days: the rest rule alone
      if(_fv&&f.mode==="block"&&!adm)return {ok:false,reason:"Fatigue rule: "+_fv}; }   // the safe-hours rules judge the real hours, exactly like a booking
    if(next)sh.hours=next; else delete sh.hours;
    hoursAudit(sid,isoD,sh,prev,S.viewAs);
    const txt=next?windowStr(next):"the "+typeLabelOf(c,sh)+" hours", day=fmtISO(isoD);
    if(adm){ if(sid!==S.viewAs)notify(sid,"Your admin "+(next?"set your hours on "+day+" to ":"put your hours on "+day+" back to ")+txt+".",null,{tab:"my",cycle:c.id}); }
    else notify("admin",nameOf(sid)+(next?" changed their hours on "+day+" to ":" put their hours on "+day+" back to ")+txt+".",null,{tab:"roster",cycle:c.id});
    if(_fv)_fatigueWarn=_fv;   // only on the way out, so a refusal never leaves a warning behind
    return {ok:true}; },"hr-"+sid+"|"+isoD); }
