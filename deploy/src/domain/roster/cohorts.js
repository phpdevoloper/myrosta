"use strict";
// moved from js/roster.js lines 1294-1326 (Phase 1 split, no edits)
/* ---------- cohort waves ---------- */
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}
function startWaves(){ const ids=shuffle(rosterStaff().map(s=>s.id)); const n=Math.max(2,Math.min(4,S.waveCount||3));
  const cohorts=Array.from({length:n},()=>[]); ids.forEach((id,i)=>cohorts[i%n].push(id));
  active().waveState={cohorts:cohorts, order:shuffle(cohorts.map((_,i)=>i)), current:0, done:{}};
  notify("all","Booking has opened in random groups. Group 1 is picking now.",null,{tab:"selfroster"}); logAudit("selfroster.waves","started "+n+" random groups","admin"); save(); }
function stopWaves(){active().waveState=null;logAudit("selfroster.waves","stopped","admin");save();}
function waveCohortAt(pos){const w=active().waveState;return (w&&w.cohorts[w.order[pos]])||[];}
function currentCohort(){const w=active().waveState;return w?waveCohortAt(w.current):[];}
function wavePosOf(sid){const w=active().waveState;if(!w)return -1;for(let p=0;p<w.order.length;p++){if((w.cohorts[w.order[p]]||[]).includes(sid))return p;}return -1;}
function isWaveOpen(sid){const w=active().waveState;return !!w&&currentCohort().includes(sid);}
function quotaMet(sid){const s=S.staff.find(x=>x.id===sid);if(!s)return false;
  if(S.quotaFlex && !(s.periodTargets&&Object.keys(s.periodTargets).length))return clinicalCountFor(sid)>=(s.quota||0);
  return cyclePeriods().every(p=>bookedInPeriod(sid,p)>=periodTarget(s,p.index));}
function waveAllSettled(){const w=active().waveState;if(!w)return false;return currentCohort().every(sid=>(w.done&&w.done[sid])||quotaMet(sid));}
function advanceWave(){const w=active().waveState;if(!w)return;if(w.current<w.order.length-1){w.current++;notify("all","Group "+(w.current+1)+" is picking now.",null,{tab:"selfroster"});logAudit("selfroster.wave.advance","wave "+(w.current+1)+" opened","admin");}else{logAudit("selfroster.wave.advance","all waves complete","admin");}save();}
function setWaveDone(sid,v){const w=active().waveState;if(!w)return;w.done=w.done||{};if(v)w.done[sid]=true;else delete w.done[sid];logAudit("selfroster.wave.done",nameOf(sid)+(v?" done":" reopened"),sid);save();}
function fairnessLabel(f){f=f||S.fairness;return {snake:"Take turns",guarded:"Everyone at once",waves:"In random groups",adjust:"Pre-filled, then adjust"}[f]||f;}   // named by what a person experiences; the technical name is a hint for the admin
function fairnessTech(f){f=f||S.fairness;return {snake:"snake-draft rounds",guarded:"guarded free-for-all",waves:"cohort waves",adjust:"auto-draft + adjust"}[f]||"";}
function waveControlHTML(cyc){ const w=cyc.waveState;
  if(!w)return `<div class="flexbtns" style="margin-top:8px"><button class="btn primary" id="wvStart">Draw ${S.waveCount||3} random groups and start</button></div>`;
  const chips=w.order.map((ci,pos)=>{const mem=w.cohorts[ci]||[];const settled=mem.filter(id=>(w.done&&w.done[id])||quotaMet(id)).length;
    return `<span class="tag ${pos===w.current?"warn":"muted"}" title="${escapeHTML(mem.map(nameOf).join(", "))}">Group ${pos+1}${pos===w.current?" · picking now":""} · ${settled} of ${mem.length} done</span>`;}).join(" ");
  const last=w.current>=w.order.length-1;
  return `<div style="margin-top:8px">${chips}</div>
    <div class="flexbtns" style="margin-top:8px">
      ${last?'<span class="tag ok">last group is picking</span>':`<button class="btn primary" id="wvNext">Open the next group${waveAllSettled()?" — everyone's done "+ic("check"):""}</button>`}
      <button class="btn sm" id="wvReassign">Re-draw the groups</button>
      <button class="btn danger sm" id="wvStop">Stop the groups</button>
    </div>`; }
function waveScheduleHTML(sid){ const w=active().waveState; if(!w)return ""; const mine=wavePosOf(sid);
  return `<div class="cluster" style="margin:6px 0">${w.order.map((ci,pos)=>`<span class="tag ${pos===w.current?"warn":(pos===mine?"ok":"muted")}">Group ${pos+1}${pos===w.current?" · open":""}${pos===mine?" · you":""}</span>`).join("")}</div>`; }

