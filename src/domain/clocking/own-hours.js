"use strict";
/* Own hours on a booking — the pure rules. A clinical shift may carry hours:{start,end} when they differ from its type's window;
   one reader (shiftWindow) answers every question about a shift's times. No state, no saving: callers pass the cycle and the shift.
   Spec: docs/superpowers/specs/2026-09-26-own-hours-s4-design.md (in git history). */
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
function modalHours(draft,cyc){ if(draft&&draft.hours)return {start:String(draft.hours.start||""),end:String(draft.hours.end||"")}; const t=typeOf(cyc,{kind:"clinical",period:(draft&&draft.period)||"AM",type:draft&&draft.type}); return t?{start:t.start,end:t.end}:{start:"",end:""}; }   // what the cell editor's Hours row shows: the draft's own pair, else the type's window (a type id that no longer exists reads as its period's, as shiftWindow does)
function modalHoursCheck(cyc,sh){ const h=sh&&sh.hours; if(!h)return {ok:true};   // the cell editor's Save: an empty pair or the type's own window clears, a pair the rule refuses is named, anything else is stored normalised
  const a=String(h.start||""), b=String(h.end||""); if(!a&&!b){ delete sh.hours; return {ok:true}; }
  if(!hoursOK(a,b))return {ok:false,reason:HOURS_RULE};
  const n=hoursNorm(cyc,sh,a,b); if(n)sh.hours=n; else delete sh.hours; return {ok:true}; }
