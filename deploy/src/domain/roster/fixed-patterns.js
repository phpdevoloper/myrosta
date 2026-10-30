"use strict";
// moved from js/roster.js lines 1327-1352 (Phase 1 split, no edits)
/* ---------- fixed patterns (weekly + fortnightly A/B) ---------- */
let _fpDraft={};            // sid -> in-progress edit copy (survives re-render)
let _fpOpen=new Set();      // which staff editors are expanded on the Staff tab
let _staffOpen=new Set();   // which staff rows are expanded to the roomy detail view
const WD_ORDER=[1,2,3,4,5,6,0]; // Mon..Sun (getDay() indices)
function emptyPattern(){return {recurrence:"weekly",A:{},B:{},C:{},D:{},M:[],committed:false};}   // weeks A–D for the weekly, fortnightly and every-4-weeks recurrences; M = the calendar-month rules
const FP_WEEKS={weekly:["A"],fortnightly:["A","B"],fourweekly:["A","B","C","D"],monthly:[]}, FP_N={weekly:1,fortnightly:2,fourweekly:4}, FP_NTH={1:"1st",2:"2nd",3:"3rd",4:"4th",last:"last"};
function fpWeeksOf(fp){ return FP_WEEKS[(fp&&fp.recurrence)||"weekly"]||["A"]; }
function fpTypes(cyc){ const c=cyc||active(), out=bookableTypes(c).map(t=>({id:t.id,label:t.label||t.id})); const cst=typeById(c,"CST"); if(cst&&cst.on!==false)out.push({id:"CST",label:cst.label||"CST"}); return out; }   // what a pattern may name: the cycle's clinical types (a full shift among them) and its non-clinical block
function fpSlotFrom(val,cyc){ if(!val)return null; if(val==="CST")return {period:"CST"}; const t=typeById(cyc||active(),val); if(!t||!t.fills||!t.fills.length)return {period:val}; return typeIsDefault(t)?{period:t.fills[0]}:{period:t.fills[0],type:t.id}; }   // the half it fills, and the type's id when it is not a built-in half
function fpSlotKey(slot){ return slot?(slot.type||slot.period||""):""; }
function fpSlotLabel(slot,cyc){ if(!slot||!slot.period)return ""; const c=cyc||active(); if(slot.period==="CST"){ const t=typeById(c,"CST"); return (t&&t.label)||"CST"; } const t=typeById(c,slot.type||slot.period); return (t&&t.label)||slot.period; }
function cycleWeekN(isoD,n){const ds=cycleDates();const wk=Math.floor(Math.round((parseISO(isoD)-ds[0])/864e5)/7);return "ABCD"[((wk%n)+n)%n];}   // the week letter of a date, counting cycle weeks from the start; round the DAY count first (a DST day is 23/25 h)
function cycleWeekAB(isoD){ return cycleWeekN(isoD,2); }
function nthWeekdayOf(isoD){ const d=parseISO(isoD), last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); return {nth:Math.floor((d.getDate()-1)/7)+1, last:d.getDate()+7>last}; }   // "the 2nd Wednesday", and whether it is the month's last one
function fpWeekHeading(wk,n){ const total=(active().cycle||{}).weeks||8, i="ABCD".indexOf(wk), list=[]; for(let w=1;w<=total;w++) if((w-1)%n===i) list.push(w); return "Week "+wk+" \u2014 cycle week"+(list.length===1?" ":"s ")+list.join(", "); }   // from the cycle's own length, so a 12-week cycle reads 1, 5, 9   // round the DAY count first: across a DST change a "day" is 23/25h, and flooring raw ms puts every later date in the wrong week
function fixedSlotFor(s,isoD){ if(!s||(s.mode!=="fixed"&&s.mode!=="preference"))return null; const fp=s.fixedPattern; if(!fp)return null;
  const wd=String(parseISO(isoD).getDay()); let slot=null;
  if(fp.recurrence==="monthly"){ const k=nthWeekdayOf(isoD); slot=(fp.M||[]).find(r=>String(r.wd)===wd&&r.period&&(r.nth==="last"?k.last:+r.nth===k.nth))||null; }   // the first Wednesday, the last Saturday: of each calendar month the cycle touches
  else { const n=FP_N[fp.recurrence]||1; slot=(fp[n>1?cycleWeekN(isoD,n):"A"]||{})[wd]||null; }
  if(!slot||!slot.period)return null; return Object.assign({period:slot.period,zone:slot.zone||""},slot.type?{type:slot.type}:{}); }  // zone "" = any (auto-balanced); a type beyond the two halves travels with the slot
function balancedZoneFor(sid,period,free){   // free = zone objects still open that day/period; pick the one this person has done least (tie-break: least-used overall)
  const mine={},all={}; free.forEach(z=>{mine[z.id]=0;all[z.id]=0;});
  cycleDates().forEach(d=>{ const isoD=iso(d); S.staff.forEach(s2=>{ const sh=getShift(s2.id,isoD); if(sh.kind==="clinical"&&all[sh.zone]!=null){ all[sh.zone]++; if(s2.id===sid)mine[sh.zone]++; } }); });
  return free.slice().sort((x,y)=>(mine[x.id]-mine[y.id])||(all[x.id]-all[y.id]))[0]; }
let _fpReport=null;   // last applyFixedPatterns run: {placed, conflicts:[], gaps:[]}
