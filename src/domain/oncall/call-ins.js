"use strict";
// moved from js/roster.js lines 556-594 (Phase 1 split, no edits)
/* ---------- call-ins: on-call booked once someone is called in, with the real hours ----------
   cyc.callins = {"<iso>|<windowId>|<staffId>": {start:"HH:MM", end:"HH:MM"}}: one key per person, per window, per day, so
   several people on one day need nothing special. Kept apart from cyc.oncall, which the two Edge Functions read. */
function ciKey(isoD,winId,sid){ return isoD+"|"+winId+"|"+sid; }
function ciParse(k){ const a=String(k).split("|"); return (a.length===3&&a[0]&&a[1]&&a[2])?{d:a[0],win:a[1],sid:a[2]}:null; }
function ciValid(v){ return !!v&&/^\d\d:\d\d$/.test(v.start||"")&&/^\d\d:\d\d$/.test(v.end||""); }
function ciGet(cyc,isoD,winId,sid){ const v=cyc&&cyc.callins&&cyc.callins[ciKey(isoD,winId,sid)]; return ciValid(v)?v:null; }
function ciInUse(cyc,winId){ const c=cyc||active(); if(!c||!c.callins)return 0;
  return Object.keys(c.callins).filter(k=>{ const p=ciParse(k); return !!p&&p.win===winId&&ciValid(c.callins[k]); }).length; }
function ciMin(hm){ const x=String(hm).split(":"); return (+x[0])*60+(+x[1]); }
function ciHM(n){ n=((n%1440)+1440)%1440; return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0"); }
function ciAt(w,ci){ return Object.assign({},w,{start:ci.start,end:ci.end,ci:true}); }   // the window as this call-in worked it: the real hours on a copy, so every reader of hours reads them
function ciOnDay(cyc,isoD){ const c=cyc||active(); if(!c||!c.callins)return []; const ws=ocTakenWindows(c).filter(ocChosen), out=[];
  Object.keys(c.callins).forEach(k=>{ const p=ciParse(k), v=c.callins[k]; if(!p||p.d!==isoD||!ciValid(v)||!S.staff.some(s=>s.id===p.sid))return;
    const w=ws.find(x=>x.id===p.win); if(w)out.push({w:ciAt(w,v),sid:p.sid,k:k}); });
  return out.sort((a,b)=>ocSpan(isoD,a.w).st-ocSpan(isoD,b.w).st); }   // everyone called in that day, earliest first
function ciDropFor(cyc,ids){ if(!cyc||!cyc.callins)return; Object.keys(cyc.callins).forEach(k=>{ const p=ciParse(k); if(p&&ids.indexOf(p.sid)>=0)delete cyc.callins[k]; }); }   // someone taken out of a cycle or the group takes their call-ins with them, as their shifts go
function ocCountFor(cyc,sid){ const c=cyc||active(); if(!c||!sid)return 0; let n=0; const ws=ocWindows(c);
  datesOf(c.cycle).forEach(d=>{ n+=ocHeldBy(c,sid,iso(d),ws).length; }); return n; }
function ocSpan(isoD,w){ const d0=parseISO(isoD);
  const mk=(dt,hm)=>{const x=String(hm).split(":");return new Date(dt.getFullYear(),dt.getMonth(),dt.getDate(),+x[0],+x[1]);};
  let st=mk(d0,w.start), en=mk(d0,w.end); if(en<=st)en=mk(addDays(d0,1),w.end); return {st,en}; }   // a night ends at 08:00 on the next calendar day, even the night the clocks change
function effStaffing(){ const c=active(); return (c&&c.settings&&c.settings.staffing)||S.staffing; }   // active cycle's own staffing (falls back to global)
function effUnlock(){ const c=active(); return (c&&c.settings&&c.settings.unlockOrder)||S.unlockOrder||"pmfirst"; }
function hasExtraSlots(){ const s=effStaffing(); return (s.amMax>s.amMin)||(s.pmMax>s.pmMin); }   // are there slots beyond the minimum to "unlock"? (false when min===max → no unlock message)
function cset(){ const c=active(); if(c&&!c.settings)c.settings={}; return c?c.settings:{}; }   // active cycle's settings (ensured) — source of truth for per-cycle config
// Per-cycle settings are the source of truth; mirror the ACTIVE cycle's into the S.* globals so every existing read reflects the selected cycle.
function hydrateCycleSettings(){ const c=active(); if(!c||!c.settings)return; const s=c.settings;
  if(s.staffing)S.staffing={amMin:s.staffing.amMin,amMax:s.staffing.amMax,pmMin:s.staffing.pmMin,pmMax:s.staffing.pmMax};
  if(s.unlockOrder!=null)S.unlockOrder=s.unlockOrder;
  if(s.zones)S.zones=s.zones;                 // share the reference so in-place zone edits update the cycle
  if(s.fairness!=null)S.fairness=s.fairness;
  if(s.rosterMode!=null)S.rosterMode=s.rosterMode;
  if(s.waveCount!=null)S.waveCount=s.waveCount;
  if(s.quotaPeriod!=null)S.quotaPeriod=s.quotaPeriod;
  if(s.quotaCapMode!=null)S.quotaCapMode=s.quotaCapMode;
  if(s.quotaFlex!=null)S.quotaFlex=s.quotaFlex;
  if(s.leaveCapEft!=null)S.leaveCapEft=s.leaveCapEft;
}
