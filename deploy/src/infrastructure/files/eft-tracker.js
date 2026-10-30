"use strict";
// moved from js/admin.js lines 2166-2241 (Phase 1 split, no edits)
/* ---------- EFT tracker (org template: weekly EFT grid, keyed by Employee #) ---------- */
const FT_HRS_WEEK=38; // full-time hours/week (76/fortnight) — used to convert hours/week back to EFT fraction
function parseEftTracker(wb, cycleStartISO){
  let chosen=null, latest=null;
  wb.SheetNames.forEach(name=>{
    let aoa; try{aoa=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null});}catch(e){return;}
    let hr=-1; for(let r=0;r<Math.min(aoa.length,14);r++){ if((aoa[r]||[]).some(c=>/employee\s*#|emp\s*no|payroll/i.test(String(c==null?"":c)))){hr=r;break;} }
    if(hr<0)return;
    const dcols=[]; (aoa[hr]||[]).forEach((v,c)=>{const di=cellISO(v); if(di)dcols.push({c:c,iso:di});});
    if(!dcols.length)return;
    const cand={name:name,aoa:aoa,hr:hr,dcols:dcols,first:dcols[0].iso,last:dcols[dcols.length-1].iso};
    if(!latest||cand.first>latest.first)latest=cand;
    if(cycleStartISO>=cand.first && cycleStartISO<=iso(addDays(parseISO(cand.last),6)))chosen=cand;
  });
  const c=chosen||latest;
  if(!c)return {error:"No tracker sheet found (need an 'Employee #' header row with weekly date columns)."};
  let tc=null; c.dcols.forEach(d=>{ if(d.iso<=cycleStartISO && (!tc||d.iso>=tc.iso))tc=d; }); if(!tc)tc=c.dcols[0];
  const rows=[];
  for(let r=c.hr+1;r<c.aoa.length;r++){ const row=c.aoa[r]||[];
    const last=String(row[1]==null?"":row[1]).trim(), first=String(row[2]==null?"":row[2]).trim();
    if(!last||!/[A-Za-z]/.test(last))continue;
    let val=(typeof row[tc.c]==="number")?row[tc.c]:numFrom(row[tc.c]);
    if(val==null){ for(let k=c.dcols.length-1;k>=0;k--){const dv=row[c.dcols[k].c]; if(typeof dv==="number"){val=dv;break;}} }
    if(val==null)continue;
    const eft = val>1.5 ? round2(val/FT_HRS_WEEK) : round2(val);   // auto-detect: >1.5 = hours/week, else EFT fraction
    const emp=row[0]; rows.push({empNo: emp==null?"":String(emp).replace(/\.0+$/,"").trim(), sur:last, giv:first, eft:eft});
  }
  return {sheet:c.name, week:tc.iso, rows:rows};
}
function applyEftTracker(p){
  const byEmp={}, bySur={};
  S.staff.forEach(s=>{ if(s.payrollId)byEmp[String(s.payrollId)]=s; const sur=splitName(s.name).sur; (bySur[normName(sur)]=bySur[normName(sur)]||[]).push(s); });
  let n=0; const unmatched=[];
  p.rows.forEach(rw=>{
    let s=(rw.empNo&&byEmp[rw.empNo])||null;
    if(!s){ const cands=bySur[normName(rw.sur)]||[];
      if(cands.length===1)s=cands[0];
      else if(cands.length>1)s=cands.find(c=>normName(splitName(c.name).giv).charAt(0)===normName(rw.giv).charAt(0))||cands[0]; }
    if(!s){ unmatched.push(rw.sur+(rw.giv?", "+rw.giv:"")); return; }
    if(rw.eft!=null){ s.eft=rw.eft; s.hrsFortnight=round2(rw.eft*76); }
    if(rw.empNo && !s.payrollId)s.payrollId=rw.empNo;   // link Employee # → payroll export
    n++;
  });
  logAudit("import.efttracker",n+" "+ROLES()+" from "+p.sheet+" (week "+p.week+")","admin"); save();
  return {n:n, unmatched:unmatched};
}
function importEftTracker(file){
  if(typeof XLSX==="undefined"){toast("Spreadsheet reader not loaded — check your connection and retry.");return;}
  const reader=new FileReader();
  reader.onload=ev=>{ let wb; try{wb=XLSX.read(ev.target.result,{type:"array",cellDates:true});}catch(x){toast("Couldn't read file: "+x.message,"danger");return;}
    const p=parseEftTracker(wb, active().cycle.start);
    if(p.error){toast("EFT tracker import: "+p.error);return;}
    if(!confirm("Import EFT tracker?\n\nSheet: "+p.sheet+"\nWeek used: "+p.week+"\n"+ROLESC()+" found: "+p.rows.length+"\n\nSets each matched "+ROLE()+"'s EFT + hours, and fills their employee number (used by the payroll export). Matches by employee # or surname."))return;
    const res=applyEftTracker(p); recordImport("eft",file.name,res.n+" updated"+(res.unmatched.length?" · "+res.unmatched.length+" unmatched":"")); save();
    let msg="EFT tracker imported — updated "+res.n+" "+ROLES()+" (EFT, hours, employee #).";
    if(res.unmatched.length)msg+="\n\nNo matching "+ROLE()+" for "+res.unmatched.length+": "+res.unmatched.slice(0,8).join("; ")+(res.unmatched.length>8?" …":"");
    toast(msg); render();
  };
  reader.readAsArrayBuffer(file);
}
function exportEftTracker(){
  if(!S.staff.length){toast("No staff to export yet.");return;}
  if(typeof XLSX==="undefined"){toast("Spreadsheet reader not loaded — check your connection and retry.");return;}
  const ds=cycleDates(); const weeks=[]; for(let i=0;i<ds.length;i+=7)weeks.push(ds[i]);
  const totalEft=round2(S.staff.reduce((a,s)=>a+(+s.eft||0),0));
  const aoa=[];
  aoa.push(["Period",cyLabel(active())]);
  aoa.push([]);
  aoa.push(["Budgeted EFT","","Current EFT"].concat(weeks.map(()=>totalEft)));
  aoa.push([]);
  aoa.push(["Employee #","Last Name","First Name"].concat(weeks.map(d=>iso(d))));
  rosterStaff().forEach(s=>{const nm=splitName(s.name); aoa.push([s.payrollId||"",nm.sur,nm.giv].concat(weeks.map(()=>round2(s.eft||0))));});
  const ws=XLSX.utils.aoa_to_sheet(aoa), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"SMS EFT");
  XLSX.writeFile(wb,"eft-tracker-"+active().cycle.start+".xlsx");
  logAudit("export.efttracker",S.staff.length+" "+ROLES(),"admin");save();
}
