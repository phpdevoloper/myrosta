"use strict";
// moved from js/roster.js lines 516-555 (Phase 1 split, no edits)
/* ---------- on-call: a roster of its own ----------
   Not a shift. A shift lives in cycle.assign, which holds exactly one record per person per day, and a
   shift fills a half of the day, which is what "counts as cover" means and what takes a zone. On-call is
   neither: the same person may work the floor and carry a window later, and carrying it must never make
   a day look covered. So it lives in its own flat map, keyed the same way assign is so it merges the same
   way, and one person per window per day falls out of one key holding one value. */
/* Which windows a cycle has. A saved list is the truth, and an empty one means the group runs no on-call. A cycle
   that has never saved one still has the on-call it always had — the per-zone tick — read as ONE window that follows
   the evening shift in every zone carrying it. Nothing is written: it is worked out from the cycle's own zones and
   On-call type each time, so a live roster computes exactly what it did, and saving the On-call card is what turns it
   into an ordinary list. `pay` and `uid` are what the tick has always been exported and calendared under. */
function ocWindows(cyc){ const c=cyc||active(); if(!c)return []; const w=c.settings&&c.settings.oncallWindows; return Array.isArray(w)?w:ocFromTick(c); }
function ocFromTick(c){ const t=typeById(c,"ONC"); if(!t||t.on===false)return [];
  const all=(c.settings&&c.settings.zones)||S.zones||[], zs=all.filter((z,i)=>all.findIndex(x=>x.id===z.id)===i&&isOnCallZone(z,c,true)).map(z=>z.id); if(!zs.length)return [];   // the first zone with an id decides, as zoneById always has, even if a copy with the same id says otherwise
  const tm=shiftTimesOf(c).ONC;   // payroll, the calendar download, Clinical hours and safe hours always read the tick's hours from here; the type's own copy could differ in stored data, and pay must not move
  return [{id:"ONC",code:t.code||"OC",pay:"ONC",uid:"oc",label:t.label||"On-call",start:tm.start,end:tm.end,book:false,rest:true,from:{zones:zs,period:"PM"}}]; }
function ocTakenWindows(cyc){ const c=cyc||active(); const w=c&&c.settings&&c.settings.oncallWindows; return Array.isArray(w)?w.filter(x=>!x.from):[]; }   // the windows a person takes. One that follows a shift travels with that shift and is never drawn on its own — which is also why a never-saved cycle has none
function ocWindow(cyc,id){ return id?(ocWindows(cyc).find(w=>w.id===id)||null):null; }
function ocKey(isoD,winId){ return isoD+"|"+winId; }
function ocFollows(c,w,sh){ return !!(w&&w.from&&sh&&sh.kind==="clinical"&&(w.from.zones||[]).indexOf(sh.zone)>=0&&fillsOf(c,sh).indexOf(w.from.period||"PM")>=0); }   // a whole-day shift includes its evening
function ocHolder(cyc,isoD,winId){ const c=cyc||active(); if(!c)return null; const w=ocWindow(c,winId);
  if(ocChosen(w))return null;   // a call-in window has no one holder: each call-in belongs to whoever logged it, and a stray on-call key on it is ignored
  if(w&&w.from){ const a=c.assign||{}, p=S.staff.find(x=>ocFollows(c,w,a[x.id+"|"+isoD])); return p?p.id:null; }
  const h=c.oncall&&c.oncall[ocKey(isoD,winId)]; return (h&&ocCanHold(c,h,isoD))?h:null; }
function ocHeldBy(cyc,sid,isoD,wins){ const c=cyc||active(); if(!c||!sid)return []; const sh=(c.assign||{})[sid+"|"+isoD]; let can=null;
  const out=[]; (wins||ocWindows(c)).forEach(w=>{ if(ocChosen(w)){ const ci=ciGet(c,isoD,w.id,sid); if(ci)out.push(ciAt(w,ci)); return; }
    if(w.from){ if(ocFollows(c,w,sh))out.push(w); return; }
    if(!(c.oncall&&c.oncall[ocKey(isoD,w.id)]===sid))return; if(can===null)can=ocCanHold(c,sid,isoD); if(can)out.push(w); });
  return out; }   // every window a person carries that day, taken, following their shift, or logged as a call-in with its real hours: what pay, the calendar and the counts read
function ocTakenBy(cyc,sid,isoD){ const c=cyc||active(); if(!c||!sid)return []; const all=ocTakenWindows(c);
  let ws=c.oncall?all.filter(w=>!ocChosen(w)&&c.oncall[ocKey(isoD,w.id)]===sid):[]; if(ws.length&&!ocCanHold(c,sid,isoD))ws=[];
  all.forEach(w=>{ if(!ocChosen(w))return; const ci=ciGet(c,isoD,w.id,sid); if(ci)ws=ws.concat([ciAt(w,ci)]); });
  return ws; }   // the windows a person took, and the call-ins they logged with their real hours: what the screens draw. A call-in copy says ci:true, so a writer clearing on-call leaves it alone
function ocAnyOn(cyc,isoD){ const c=cyc||active(); if(!c)return []; return ocWindows(c).filter(w=>!!ocHolder(c,isoD,w.id)); }
function ocHours(w){ return w?_tHours(w.start,w.end):0; }
function ocFromText(w){ return ((w&&w.from&&w.from.zones)||[]).map(id=>{ const z=zoneById(id); return z?zoneLabel(z,"PM"):"a removed zone"; }).join(", "); }
function ocTime(w){ return w?(w.start+"\u2013"+w.end):""; }
function ocChosen(w){ return !!(w&&w.chosen&&!w.from); }   // hours chosen when booked: the window is a range, and each call-in carries the hours really worked
function ocUsualText(w){ return Math.round((+(w&&w.usual)||0)/6)/10+"h"; }
function ocWhenText(w){ return ocChosen(w)?("any hours "+ocTime(w)+", usually "+ocUsualText(w)):ocTime(w); }   // what a person reads beside a window's name
