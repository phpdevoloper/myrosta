"use strict";
/* Own hours — the use cases: who may change a shift's hours, the audit line, and the guarded write. Rules in domain/clocking/own-hours.js;
   the commit and the shift's label come through clockingPorts. */
function ownHoursOn(){ return S.ownHours===true; }   // the group switch: absent means off, and normalize() seeds nothing
function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); clockingPorts.save(); }   // the Group card's tick: written as true, deleted when off, never false
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
  const line=nameOf(sid)+" "+isoD+" "+clockingPorts.shiftLabel(sh)+" \u2192 "+txt; if(next)logAudit("hours.set",line,actor||S.viewAs); else logAudit("hours.clear",line,actor||S.viewAs); return true; }   // one line when the hours changed, none when they did not: the cell editor and hoursSet both write through here (each key a literal, for the audit lint)
function hoursSet(sid,isoD,start,end){ const clearing=!String(start||"").trim()&&!String(end||"").trim();   // set or clear a booking's own hours: a guarded write, judged again inside it; an empty pair clears
  return clockingPorts.commit(()=>{ const c=active(), sh=(c.assign||{})[sid+"|"+isoD], adm=isAdmin();
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
