"use strict";
// moved from js/roster.js lines 305-314 (Phase 1 split, no edits)
/* ---------- date helpers ---------- */
function pad(n){return String(n).padStart(2,"0");}
function iso(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function parseISO(s){const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c);}
function addDays(d,n){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);}
function fmt(d,o){return d.toLocaleDateString("en-GB",o||{day:"numeric",month:"short"});}
function datesOf(c){const out=[];let s=parseISO(c.start);for(let i=0;i<c.weeks*7;i++)out.push(addDays(s,i));return out;}
function cycleDates(){return datesOf(CTX().cycle);}
function dateInCycle(d){const ds=cycleDates();return d>=ds[0]&&d<=ds[ds.length-1];}   // is a DATE within the active cycle's span

