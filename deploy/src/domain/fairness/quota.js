"use strict";
// moved from js/roster.js lines 669-719 (Phase 1 split, no edits)
/* ---------- self-roster + auto-draft engine ---------- */
function clinicalCountFor(staffId){let n=0;const c=active(),a=c.assign;cycleDates().forEach(d=>{const sh=a[staffId+"|"+iso(d)];if(sh&&sh.kind==="clinical")n+=shiftUnits(c,sh);});return n;}   // units, not days: a full shift takes two of a person's share
/* ---------- quota periods + per-period targets ---------- */
function periodWeeks(){return {cycle:999,week:1,fortnight:2,month:4}[S.quotaPeriod||"fortnight"];}
function periodTag(){return {cycle:"Cycle",week:"Wk",fortnight:"Fn",month:"Mo"}[S.quotaPeriod||"fortnight"];}
function cyclePeriods(){ const ds=cycleDates(), per=periodWeeks()*7, out=[];
  for(let st=0; st<ds.length; st+=per){ const slice=ds.slice(st,st+per); if(!slice.length)break;
    out.push({index:out.length, dates:slice, from:iso(slice[0]), to:iso(slice[slice.length-1]),
      label:(S.quotaPeriod==="cycle"?"Cycle":periodTag()+" "+(out.length+1))}); }
  return out; }
function lrRound(weights,total){ const n=weights.length; total=Math.max(0,Math.round(total||0)); if(!n)return [];
  const sum=weights.reduce((a,b)=>a+b,0);
  if(sum<=0){ const base=Math.floor(total/n), r=total-base*n; return weights.map((_,i)=>base+(i<r?1:0)); }
  const raw=weights.map(w=>total*w/sum), floors=raw.map(Math.floor);
  let rem=total-floors.reduce((a,b)=>a+b,0);
  const order=raw.map((v,i)=>({i,frac:v-Math.floor(v)})).sort((a,b)=>b.frac-a.frac);
  const res=floors.slice(); for(let k=0;k<rem;k++)res[order[k].i]++; return res; }
function autoPeriodTargets(s){ const periods=cyclePeriods();
  return lrRound(periods.map(()=>1), s.quota||0); } // even split of the cycle quota across the periods (admin can override per cell)
function periodCapInfo(s){ const n=cyclePeriods().length||1; const q=Math.max(0,Math.round(s.quota||0)); const floor=Math.floor(q/n); const r=q-floor*n; return {n,q,floor,r,ceil:floor+(r>0?1:0)}; } // floor=even base per period, r=#periods that may carry an extra, ceil=floor+1
function periodTarget(s,i){ const ov=s.periodTargets&&s.periodTargets[i]; return (ov!=null&&ov!=="")?(+ov):autoPeriodTargets(s)[i]; }
function periodTargetsOf(s){ const auto=autoPeriodTargets(s); return cyclePeriods().map((p,i)=>{ const ov=s.periodTargets&&s.periodTargets[i]; return (ov!=null&&ov!=="")?(+ov):auto[i]; }); }
function bookedInPeriod(staffId,p){ const c=active(); return p.dates.reduce((n,d)=>{ const sh=getShift(staffId,iso(d)); return n+(sh.kind==="clinical"?shiftUnits(c,sh):0); },0); }   // same units as clinicalCountFor, so the period caps and the cycle cap agree
function periodOfDate(isoD){ return cyclePeriods().find(p=>isoD>=p.from&&isoD<=p.to)||null; }
/* ---------- CST quota: a cap on clinical support time, per person per cycle, split per period exactly like the clinical quota ----------
   The number lives on the cycle role (cstQuota, cstTargets); blank means the group default (Quota & fairness: CST days per fortnight × the cycle's fortnights); 0 = no cap. A CST day is one, never two. */
function cstFortnights(){ return Math.max(1,Math.round((active().cycle.weeks||8)/2)); }
function cstDefaultQuota(){ const per=+((cset()||{}).cstPerFortnight)||0; return per>0?Math.round(per*cstFortnights()):0; }   // the group default for the cycle; 0 = none set
function cstQuotaOf(s){ if(!s)return 0; const v=s.cstQuota; return (v!=null&&v!=="")?Math.max(0,Math.round(+v||0)):cstDefaultQuota(); }   // the person's own number when set, else the default
function cstLabel(cyc){ const t=typeById(cyc||active(),"CST"); return (t&&t.label)||"CST"; }   // a group that renamed the type sees its own word
function cstCountFor(staffId){ let n=0; const a=active().assign; cycleDates().forEach(d=>{ const sh=a[staffId+"|"+iso(d)]; if(sh&&sh.kind==="cst")n++; }); return n; }
function cstInPeriod(staffId,p){ return p.dates.reduce((n,d)=>n+(getShift(staffId,iso(d)).kind==="cst"?1:0),0); }
function cstAutoTargets(s){ return lrRound(cyclePeriods().map(()=>1),cstQuotaOf(s)); }   // even split of the CST quota across the periods (admin can override per cell)
function cstCapInfo(s){ const n=cyclePeriods().length||1; const q=cstQuotaOf(s); const floor=Math.floor(q/n); const r=q-floor*n; return {n,q,floor,r,ceil:floor+(r>0?1:0)}; }
function cstTarget(s,i){ const ov=s.cstTargets&&s.cstTargets[i]; return (ov!=null&&ov!=="")?(+ov):cstAutoTargets(s)[i]; }
function cstTargetsOf(s){ const auto=cstAutoTargets(s); return cyclePeriods().map((p,i)=>{ const ov=s.cstTargets&&s.cstTargets[i]; return (ov!=null&&ov!=="")?(+ov):auto[i]; }); }
function cstJudge(sid,isoD){   // may this person take a CST day here? the cap mode, the cycle total, the period split and the flexible extra, as canBook judges a clinical pick; the day's own CST never counts against itself
  const st=S.staff.find(x=>x.id===sid); if(!st)return {ok:false,reason:"Not on the staff list."};
  const mode=S.quotaCapMode||"hard"; if(mode==="off")return {ok:true};
  const q=cstQuotaOf(st); if(q<=0)return {ok:true};
  const L=cstLabel(), have=getShift(sid,isoD).kind==="cst"?1:0, n=cstCountFor(sid)-have, out=r=>mode==="hard"?{ok:false,reason:r}:{ok:true,flag:r};   // soft: allowed, but said
  if(n+1>q)return out("You've used your "+L+" days for this cycle ("+q+").");
  const per=periodOfDate(isoD); if(!per)return {ok:true};
  const bp=cstInPeriod(sid,per)-have, pname=S.quotaPeriod||"fortnight";
  if(S.quotaFlex&&!(st.cstTargets&&st.cstTargets[per.index]!=null&&st.cstTargets[per.index]!=="")){ const ci=cstCapInfo(st);
    if(ci.ceil>0&&bp+1>ci.ceil)return out(per.label+" is at its "+L+" max ("+ci.ceil+").");
    if(ci.r>0&&bp+1>ci.floor){ const overOthers=cyclePeriods().filter(p=>p.index!==per.index&&cstInPeriod(sid,p)>ci.floor).length;
      if(overOthers>=ci.r)return out("You've already placed your extra "+L+" day"+(ci.r>1?"s":"")+" in another "+pname+"."); }
    return {ok:true}; }
  const tgt=cstTarget(st,per.index); if(tgt>0&&bp+1>tgt)return out(per.label+" "+L+" quota reached ("+tgt+").");
  return {ok:true}; }
