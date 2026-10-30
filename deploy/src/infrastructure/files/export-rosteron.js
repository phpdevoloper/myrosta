"use strict";
// moved from js/admin.js lines 2489-2564 (Phase 1 split, no edits)
/* ---------- RosterOn-format export: readable sheet (grouped by Title) + clean data sheet ---------- */
function ronCell(sid,d){
  const sh=getShift(sid,iso(d)), _c=active();
  const _cell=T=>{const cs=T.start.replace(":",""),ce=T.end.replace(":","");return "() "+T.code+" "+cs+"-"+ce+(T.code==="AM"?" ":"  ")+T.start+"-"+T.end+" NB#";};   // the two spaces after a PM/CST block are RosterOn's own layout — kept byte for byte
  if(sh.kind==="clinical"){ const _W=shiftWindow(_c,sh); return _cell(Object.assign({},typeOf(_c,sh),{start:_W.start,end:_W.end})); }   // the type's code and layout, the booking's own times
  if(sh.kind==="cst")return _cell(typeOf(_c,sh));
  if(sh.kind==="leave"&&sh.code!=="UA"){ const prev=new Date(d); prev.setDate(prev.getDate()-1); const ps=getShift(sid,iso(prev)); const cont=(ps.kind==="leave"&&ps.code===sh.code); return (cont?"00:00 ":"08:00 ")+sh.code; }   // an unavailable day is an empty cell, like a day off
  return "";
}
function ronOcCell(w){ return "() "+w.code+" "+w.start.replace(":","")+w.end.replace(":","")+"  - NB#"; }   // RosterOn's continuation layout. It used to say 23300800 whatever the on-call hours were
function rosterOnTitleRows(ds,dmy){ return [["Roster — "+dmy(ds[0])+" to "+dmy(ds[ds.length-1])],[(groupName()||"Roster")+" · exported "+dmy(new Date())+" from Myrosta (myrosta.com.au) · RosterOn format"]]; }   // sheet 1's two free-text lines
function exportRosterOn(){
  if(typeof XLSX==="undefined"){toast("Spreadsheet library not loaded — check your connection and retry.");return;}
  const ds=cycleDates(), staff=rosterStaff();
  if(!staff.length){toast("No clinical staff/roster to export yet.");return;}
  const dmy=d=>String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();
  const hdr=d=>DOW[d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1);
  const _cyR=active();
  const _ocW=ocWindows(_cyR), ocOn=(sid,d)=>ocHeldBy(_cyR,sid,iso(d),_ocW);   // every window carried that day: one that follows an evening in an on-call zone (a whole-day shift's included), or one taken
  // ---- Sheet 1: readable RosterOn-style layout, grouped by Title ----
  const A=[];
  rosterOnTitleRows(ds,dmy).forEach(r=>A.push(r));
  A.push([]);
  A.push(["Role/Name"].concat(ds.map(hdr)));
  const groups={}, order=[];
  staff.forEach(s=>{ const t=(s.title||"").trim()||"—"; if(!groups[t]){groups[t]=[];order.push(t);} groups[t].push(s); });
  order.sort((a,b)=> a==="—"?1:(b==="—"?-1:a.localeCompare(b)));   // titled groups first (A–Z), untitled last
  order.forEach(t=>{
    A.push([t].concat(ds.map(()=>"")));
    groups[t].slice().sort((a,b)=>splitName(a.name).sur.localeCompare(splitName(b.name).sur))
      .forEach(s=>{ A.push([s.name].concat(ds.map(d=>ronCell(s.id,d))));
        const held=ds.map(d=>ocOn(s.id,d)), deep=held.reduce((m,x)=>Math.max(m,x.length),0);
        for(let k=0;k<deep;k++)A.push([""].concat(held.map(ws=>ws[k]?ronOcCell(ws[k]):""))); });   // on-call goes on a continuation row beneath the person (RosterOn style), one row per window carried on the same day
  });
  A.push(["Totals"]);
  const ws1=XLSX.utils.aoa_to_sheet(A);
  ws1["!cols"]=[{wch:28}].concat(ds.map(()=>({wch:24})));
  ws1["!merges"]=[{s:{r:0,c:0},e:{r:0,c:ds.length}},{s:{r:1,c:0},e:{r:1,c:ds.length}}];
  // ---- Sheet 2: clean one-row-per-shift data ----
  const D=[["Name","Title","Date","Day","Type","Zone","Code","Start","End","Hours"]];
  staff.forEach(s=>ds.forEach(d=>{ const sh=getShift(s.id,iso(d)), ws=ocOn(s.id,d); if(sh.kind==="off"&&!ws.length)return;
    const date=dmy(d), day=DOW[d.getDay()];
    if(sh.kind==="clinical"){ const z=zoneById(sh.zone), zn=z?zoneLabelFor(_cyR,z,sh):""; const _tt=typeOf(_cyR,sh), _tw=shiftWindow(_cyR,sh); D.push([s.name,s.title||"",date,day,"Clinical"+(sh.locum?" (locum)":""),zn,_tt.code,_tw.start,_tw.end,_tHours(_tw.start,_tw.end)]); }
    else if(sh.kind==="cst"){ const _tc=typeOf(_cyR,sh); D.push([s.name,s.title||"",date,day,_tc.label,"",_tc.code,_tc.start,_tc.end,_tHours(_tc.start,_tc.end)]); }
    else if(sh.kind==="leave"){ D.push([s.name,s.title||"",date,day,"Leave","",sh.code,"","",""]); }
    ws.forEach(w=>{ const z=w.from?zoneById(sh.zone):null; D.push([s.name,s.title||"",date,day,w.label,z?zoneLabelFor(_cyR,z,sh):"",w.code,w.start,w.end,ocHours(w)]); });
  }));
  const ws2=XLSX.utils.aoa_to_sheet(D);
  ws2["!cols"]=[{wch:22},{wch:18},{wch:12},{wch:6},{wch:15},{wch:10},{wch:8},{wch:8},{wch:8},{wch:7}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws1,"RosterOn"); XLSX.utils.book_append_sheet(wb,ws2,"Data");
  XLSX.writeFile(wb,"rosteron-"+active().cycle.start+".xlsx");
  logAudit("export.rosteron",cyLabel(active())+" — "+staff.length+" staff, "+(D.length-1)+" shift rows","admin");save();
  toast("RosterOn workbook exported — 2 sheets: ‘RosterOn’ (readable, grouped by title) + ‘Data’ (one row per shift).");
}
function plannerExportData(){
  const py=plannerYear(), dates=daysInRange(py.from,py.to).map(parseISO);
  const rows=S.staff.map(s=>({name:s.name,eft:round2(s.eft),hrs:round2(s.hrsFortnight),conf:leaveDaysInRange(s.id,py.from,py.to),cells:dates.map(d=>{const sh=getShift(s.id,iso(d));return sh.kind==="leave"?sh.code:"";})}));
  return {dates,rows};
}
function exportPlannerCSV(){
  const {dates,rows}=plannerExportData();
  const head=[ROLEC(),"EFT","Hrs/FTN","Conf leave"].concat(dates.map(d=>d.getDate()+"/"+(d.getMonth()+1)));
  let csv=head.join(",")+"\n";
  rows.forEach(r=>{csv+=[r.name,r.eft,r.hrs,r.conf].concat(r.cells).map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")+"\n";});
  download(csv,"leave-planner.csv","text/csv");logAudit("export.planner.csv","Leave planner CSV exported","admin");save();
}
function exportPlannerXLS(){
  const {dates,rows}=plannerExportData();
  let h='<table border="1" style="border-collapse:collapse;font-family:Arial;font-size:11px"><tr><th>'+ROLEC()+'</th><th>EFT</th><th>Hrs/FTN</th><th>Conf leave</th>'+dates.map(d=>`<th>${d.getDate()}/${d.getMonth()+1}</th>`).join("")+'</tr>';
  rows.forEach(r=>{h+=`<tr><td>${escapeHTML(r.name)}</td><td>${r.eft}</td><td>${r.hrs}</td><td>${r.conf}</td>`+r.cells.map(c=>{if(!c)return '<td></td>';const l=leaveHex(c);return `<td style="background-color:${l.bg};color:${l.t}">${c}</td>`;}).join("")+'</tr>';});
  h+='</table><br><table border="1" style="border-collapse:collapse;font-family:Arial;font-size:11px"><tr><td><b>Legend</b></td><td style="border:2px solid '+PALETTE["--locum"]+';color:'+PALETTE["--locum-t"]+'">Locum (pink border + “(L)”)</td>'+["AL","CME","LSL","PL","UA","PH"].map(c=>{const l=leaveHex(c);return `<td style="background-color:${l.bg};color:${l.t}">${c} — ${l.name}</td>`;}).join("")+'</tr></table>';
  const doc='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>'+h+'</body></html>';
  download(doc,"leave-planner.xls","application/vnd.ms-excel");logAudit("export.planner.xls","Leave planner Excel exported","admin");save();
}

