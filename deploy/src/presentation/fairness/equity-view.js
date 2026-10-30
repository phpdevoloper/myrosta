"use strict";
// moved from js/admin.js lines 2649-2729 (Phase 1 split, no edits)
/* ---------- Equity (tough-shift share) ---------- */
function equityCycles(period){
  const sorted=S.cycles.filter(c=>!draftHidden(c)).slice().sort((a,b)=>a.cycle.start<b.cycle.start?1:-1);   // newest first, archived included (history matters); a draft staff cannot see stays out of their report
  if(period==="cycle")return [active()];
  if(period==="three")return sorted.slice(0,3);
  const yr=String(parseISO(active().cycle.start).getFullYear());
  return sorted.filter(c=>{ const end=iso(cyEnd(c)); return c.cycle.start.slice(0,4)===yr||end.slice(0,4)===yr; });
}
function equityData(period){
  const yr=String(parseISO(active().cycle.start).getFullYear());
  const tl=S.toughList||{}; const rows={};
  const blank=()=>({booked:0,quota:0,we:0,fri:0,mon:0,oc:0,ph:0,locum:0,tough:0});
  equityCycles(period).forEach(cyc=>{ if(!cyc)return;
    const wins=ocWindows(cyc), taken=ocTakenWindows(cyc), oc=cyc.oncall||{};   // once per cycle, never per shift
    Object.keys(cyc.roles||{}).forEach(sid=>{ const r=cyc.roles[sid]; if(r&&r.in!==false){ (rows[sid]=rows[sid]||blank()).quota+=(+r.quota||0); } });
    Object.keys(cyc.assign||{}).forEach(k=>{ const v=cyc.assign[k]; if(!v||v.kind!=="clinical")return;
      const i=k.indexOf("|"), sid=k.slice(0,i), d=k.slice(i+1);
      if(period==="ytd"&&d.slice(0,4)!==yr)return;
      const r=rows[sid]=rows[sid]||blank(); const _f=fillsOf(cyc,v), _pm=_f.indexOf("PM")>=0; r.booked+=_f.length;   // units, so Shifts / quota is one ratio
      const dow=parseISO(d).getDay(); let tough=false;
      if(dow===0||dow===6){r.we++;if(tl.weekend)tough=true;}
      if(dow===5&&_pm){r.fri++;if(tl.friPM)tough=true;}
      if(dow===1&&_pm){r.mon++;if(tl.monPM)tough=true;}
      const _on=wins.filter(w=>ocChosen(w)?!!ciGet(cyc,d,w.id,sid):(w.from?ocFollows(cyc,w,v):oc[ocKey(d,w.id)]===sid)).length; if(_on){r.oc+=_on;if(tl.onCall)tough=true;}   // a day on call makes that day's shift tough once, however many windows
      if(isPH(d)){r.ph++;if(tl.ph)tough=true;}
      if(v.locum)r.locum++;
      if(tough)r.tough++; });
    Object.keys(oc).forEach(k=>{ const sid=oc[k]; if(!sid)return; const i=k.indexOf("|"), d=k.slice(0,i), wid=k.slice(i+1);
      if(period==="ytd"&&d.slice(0,4)!==yr)return;
      const a=(cyc.assign||{})[sid+"|"+d]; if(a&&a.kind==="clinical")return;   // counted with that day's shift above
      if(!taken.some(w=>w.id===wid&&!ocChosen(w)))return;   // a key whose window has gone counts as nothing, as everywhere else
      (rows[sid]=rows[sid]||blank()).oc++; });   // on call with no shift that day: its own count, and no tough SHIFT, because there is no shift
    Object.keys(cyc.callins||{}).forEach(k=>{ const p=ciParse(k); if(!p||!ciValid(cyc.callins[k]))return;
      if(period==="ytd"&&p.d.slice(0,4)!==yr)return;
      const a=(cyc.assign||{})[p.sid+"|"+p.d]; if(a&&a.kind==="clinical")return;   // counted with that day's shift above
      if(!taken.some(w=>w.id===p.win&&ocChosen(w)))return;
      (rows[p.sid]=rows[p.sid]||blank()).oc++; });   // a call-in with no shift that day counts on its own, like on-call
  });
  return S.staff.filter(st=>rows[st.id]&&(rows[st.id].booked>0||rows[st.id].quota>0||rows[st.id].oc>0)).map(st=>({s:st,m:rows[st.id]}));
}
function viewEquity(){
  const period=window._eqPeriod||"cycle";
  const data=equityData(period);
  const me=S.viewAs;
  const cys=equityCycles(period).filter(Boolean), drafts=cys.filter(c=>c.status==="draft");
  const plabel=period==="cycle"?cyLabel(active()):period==="three"?(cys.length+" most recent cycles"):("Year "+parseISO(active().cycle.start).getFullYear());
  const seg=`<div class="seg"><button data-eqp="cycle" class="${period==="cycle"?"on":""}">This cycle</button><button data-eqp="three" class="${period==="three"?"on":""}">Last 3 cycles</button><button data-eqp="ytd" class="${period==="ytd"?"on":""}">Year to date</button></div>`;
  if(!data.length)return `<div class="card" id="eqCard">${printHeadHTML("Fairness summary — "+cyLabel(active()))}<h2>Equity</h2><div class="sub">Who\u2019s carrying the tough shifts. ${seg}</div>${emptyState(EIC.scale,"Fairness fills in as the roster does","No clinical shifts recorded for this period yet — once shifts are booked or published, the share of tough shifts appears here.")}</div>`;
  const totB=data.reduce((a,r)=>a+r.m.booked,0), totT=data.reduce((a,r)=>a+r.m.tough,0);
  const teamShare=totB?Math.round(totT/totB*100):0;
  const shares=data.map(r=>r.m.booked?Math.round(r.m.tough/r.m.booked*100):0);
  const shmx=Math.max.apply(null,shares), shmn=Math.min.apply(null,shares);
  const heavy=data[shares.indexOf(shmx)];
  const METR=[["we","Weekends"],["fri","Fri PM"],["mon","Mon PM"],["oc","On-call"],["ph","Pub hol"],["locum","Locum"]];
  const maxOf={}; METR.forEach(mm=>{ maxOf[mm[0]]=Math.max.apply(null,data.map(r=>r.m[mm[0]]).concat([1])); });
  const avgOf={}; METR.forEach(mm=>{ avgOf[mm[0]]=data.reduce((a,r)=>a+r.m[mm[0]],0)/data.length; });
  const bar=(v,mx,av)=>{ const w=mx?Math.round(v/mx*100):0, ap=mx?Math.min(100,Math.round(av/mx*100)):0, hot=av>0&&v>=1.5*av;
    return `<span class="eqbar"><b>${v}</b><span class="eqtrack"><span class="eqfill${hot?" hot":""}" style="width:${w}%"></span><span class="eqavg" style="left:${ap}%"></span></span></span>`; };
  const rowsH=data.map((r,i)=>{ const sh=shares[i];
    const cls=teamShare&&sh>=1.3*teamShare?"hi":(teamShare&&sh<=0.7*teamShare?"lo":"mid");
    return `<tr class="${r.s.id===me?"rowhl":""}"><td class="namecol">${escapeHTML(r.s.name)}${r.s.id===me?' <span class="tag brand">you</span>':""}</td>`+
      `<td style="white-space:nowrap">${r.m.booked}${r.m.quota?` / ${r.m.quota}`:""}</td>`+
      METR.map(mm=>`<td>${bar(r.m[mm[0]],maxOf[mm[0]],avgOf[mm[0]])}</td>`).join("")+
      `<td class="eqshare ${cls}">${r.m.tough} of ${r.m.booked} · ${sh}%</td></tr>`; }).join("");
  const tl=S.toughList||{};
  const toughDef=[tl.weekend?"weekend":null,tl.monPM?"Mon PM":null,tl.friPM?"Fri PM":null,tl.onCall?"on-call":null,tl.ph?"public holiday":null].filter(Boolean).join(", ");
  const adminCard=isAdmin()?`<div class="card"><h2>What counts as a tough shift</h2>
    <div class="sub">Applies to the whole report — agree it with the group once. Public-holiday dates are the ones you mark on the Roster/Daily views.</div>
    <div class="row" style="margin-top:6px">${[["weekend","Weekend"],["monPM","Monday PM"],["friPM","Friday PM"],["onCall","On-call"],["ph","Public holiday"]].map(x=>`<label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm)"><input type="checkbox" data-tough="${x[0]}" ${tl[x[0]]?"checked":""}> ${x[1]}</label>`).join("")}</div></div>`:"";
  return `<div class="card" id="eqCard">${printHeadHTML("Fairness summary — "+cyLabel(active()))}
    <div class="row"><h2>Equity</h2><span class="grow"></span>${seg}<button class="btn sm" id="eqPrint">${ic("print")} One-page summary</button></div>
    <div class="sub">Who\u2019s carrying the tough shifts — <b>${plabel}</b>. A <b>tough shift</b> = ${escapeHTML(toughDef)||"(nothing selected)"} (a shift ticking several boxes counts once). Share = how much of <i>your</i> roster is tough, so part-timers compare fairly.</div>
    <div class="grid-tiles" style="margin:12px 0">
      <div class="tile"><div class="k">TOUGH-SHIFT SHARE</div><div class="v">${shmx}%&thinsp;–&thinsp;${shmn}%</div><div class="d">team ${teamShare}% · heaviest: ${escapeHTML(heavy?heavy.s.name:"—")}</div></div>
      <div class="tile"><div class="k">CLINICAL SHIFTS</div><div class="v">${totB}</div><div class="d">across ${data.length} ${ROLES()}</div></div>
      <div class="tile"><div class="k">TOUGH SHIFTS</div><div class="v">${totT}</div><div class="d">weekends, evenings, on-call, PH</div></div>
    </div>
    <div class="twrap" style="overflow-x:auto"><table aria-label="Equity per ${ROLE()}"><thead><tr><th class="namecol">${ROLEC()}</th><th>Shifts${data.some(r=>r.m.quota)?" / quota":""}</th>${METR.map(mm=>`<th>${mm[1]}</th>`).join("")}<th>Tough-shift share</th></tr></thead><tbody>${rowsH}</tbody></table></div>
    <div class="muted small" style="margin-top:8px">Bars scale to the team maximum; the dark tick is the team average; red = ≥1.5× average. ${drafts.length?"":`<span class="scronly">Everyone sees this same table — fairness only builds trust when it\u2019s visible.</span>`}</div>
  ${printFootHTML(drafts.length?("Includes "+drafts.map(cyShort).join(", ")+", which staff cannot see until it is published."):("Everyone in "+(groupName()||"the group")+" sees this same table in Myrosta — fairness only builds trust when it is visible."))}</div>${adminCard}`;
}
