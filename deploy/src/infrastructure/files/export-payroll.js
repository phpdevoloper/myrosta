"use strict";
// moved from js/admin.js lines 2376-2488 (Phase 1 split, no edits)
/* ---------- Payroll export (RosterOn) — flat, one row per shift ---------- */
const LEAVE_DAY_HOURS=8; // a full-time leave day = one standard shift (8h); pro-rated by EFT below
function leaveHours(s){return round2(LEAVE_DAY_HOURS*(+s.eft||1));}
const DATE_FORMATS=[["DD/MM/YYYY","31/12/2026"],["YYYY-MM-DD","2026-12-31"],["DD-MMM-YYYY","31-Dec-2026"],["MM/DD/YYYY","12/31/2026"],["DD/MM/YY","31/12/26"]];
const MONTHS3=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(isoD){const p=String(isoD).split("-");if(p.length!==3)return isoD;const Y=p[0],M=p[1],D=p[2];
  switch(S.payrollDateFmt||"DD/MM/YYYY"){
    case "YYYY-MM-DD":return Y+"-"+M+"-"+D;
    case "DD-MMM-YYYY":return D+"-"+(MONTHS3[+M-1]||M)+"-"+Y;
    case "MM/DD/YYYY":return M+"/"+D+"/"+Y;
    case "DD/MM/YY":return D+"/"+M+"/"+Y.slice(2);
    default:return D+"/"+M+"/"+Y;
  }}
function splitName(n){n=String(n||"").trim();if(n.indexOf(",")>=0){const a=n.split(",");return{sur:a[0].trim(),giv:(a[1]||"").trim()};}const a=n.split(/\s+/);if(a.length<2)return{sur:n,giv:""};return{sur:a[a.length-1],giv:a.slice(0,-1).join(" ")};}
/* Which zones a cycle that has never saved its on-call windows follows (ocFromTick). Nothing sets it any more:
   the On-call card is where a group says which evening carries on-call. The On-call shift type was the switch
   for the whole cycle; this was the switch for one zone. Tri-state on purpose: a zone that has never been ticked falls
   back to the old name match, so every existing cycle at both live orgs computes exactly as it did and
   nothing is written to stored JSON. `false` is what finally lets a group say no to a false positive. */
function isOnCallZone(z,cyc,typeChecked){ if(!z)return false; const _c=cyc||active(); if(!typeChecked&&_c&&!typeOn(_c,"ONC"))return false;
  if(z.oncall!=null)return z.oncall===true;
  return /\bOC\b|ON.?CALL|\+\s*OC/i.test((z.pmLabel||"")+" "+(z.name||"")); }
function payrollRows(){
  const rows=[],ds=cycleDates(),_cyP=active(),_ocW=ocWindows(_cyP);   // once per export, never per person per day
  rosterStaff().forEach(s=>{const nm=splitName(s.name);
    ds.forEach(d=>{const isoD=iso(d),sh=getShift(s.id,isoD);
      const base={emp:s.payrollId||"",sur:nm.sur,giv:nm.giv,name:s.name,date:isoD};
      const add=(t,unit,note)=>rows.push(Object.assign({},base,{code:t.code,start:t.start,end:t.end,hours:t.hours,unit:unit||"",note:note||""}));
      if(sh.kind==="clinical"){const z=zoneById(sh.zone),zn=z?z.name:"";const T=typeOf(_cyP,sh),W=shiftWindow(_cyP,sh);   // the type's code; the booking's own start, finish and hours when it has them
        add({code:T.code,start:W.start,end:W.end,hours:_tHours(W.start,W.end)},zn,[sh.locum?"Locum":"",isFullShift(_cyP,sh)?T.label:""].filter(Boolean).join(" · "));
      } else if(sh.kind==="cst"){const T=typeOf(_cyP,sh);add({code:T.code,start:T.start,end:T.end,hours:_tHours(T.start,T.end)},"",T.label);}
      else if(sh.kind==="leave"&&sh.code!=="UA") rows.push(Object.assign({},base,{code:sh.code,start:"",end:"",hours:leaveHours(s),unit:"",note:LEAVE_LABEL[sh.code]||"Leave"}));   // UA is "unavailable", not leave: it is never a payroll row (23 Sep 2026)
      ocHeldBy(_cyP,s.id,isoD,_ocW).forEach(w=>{ const z=w.from?zoneById(sh.zone):null; add({code:w.pay||w.code,start:w.start,end:w.end,hours:ocHours(w)},z?z.name:"",w.label); });   // on-call is its own row after the day's own, with its own code, so pay can treat it on its own terms
    });
  });
  return rows;
}
// The roster data that can fill a RosterOn column:
const PAYROLL_FIELDS=[
  ["emp","Employee No"],["sur","Surname"],["giv","Given Name"],["name","Full name"],
  ["date","Date"],["code","Shift Code"],["start","Start time"],["end","End time"],
  ["hours","Hours"],["unit","Unit / area"],["note","Notes"]
];
function payrollFieldValue(r,key){switch(key){
  case "emp":return r.emp;case "sur":return r.sur;case "giv":return r.giv;case "name":return r.name;
  case "date":return fmtDate(r.date);case "code":return r.code;case "start":return r.start;case "end":return r.end;
  case "hours":return r.hours;case "unit":return r.unit;case "note":return r.note;default:return "";}}
// Guess which roster field feeds a RosterOn column from its header text:
function autoMapField(h){const s=String(h||"").toLowerCase();
  if(/surname|last\s*name|family/.test(s))return "sur";
  if(/given|first\s*name|forename|christian/.test(s))return "giv";
  if(/payroll|personnel|(emp(loyee)?|staff|pay)\s*(no|num|#|id|code)/.test(s))return "emp";
  if(/date/.test(s))return "date";
  if(/start|begin|\bfrom\b|time\s*in|commence/.test(s))return "start";
  if(/end|finish|\bto\b|time\s*out|cease/.test(s))return "end";
  if(/hour|hrs|duration|qty|quantity|\bunits?\b/.test(s))return "hours";
  if(/shift|code|activity|duty|task/.test(s))return "code";
  if(/unit|ward|cost|location|dept|department|\barea\b|team/.test(s))return "unit";
  if(/note|comment|desc|remark/.test(s))return "note";
  if(/name/.test(s))return "name";
  return "";}
function parseCSVLine(line){const out=[];let cur="",q=false;for(let i=0;i<line.length;i++){const c=line[i];
  if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
  else{if(c===','){out.push(cur);cur="";}else if(c==='"')q=true;else cur+=c;}}
  out.push(cur);return out.map(x=>x.trim());}
function readPayrollTemplate(file){
  const finish=(hdrs)=>{let headers=(hdrs||[]).map(h=>String(h==null?"":h).trim());
    while(headers.length&&headers[headers.length-1]==="")headers.pop();
    if(!headers.length){toast("No column headers found in that file's first row.");return;}
    S.payrollTemplate={headers:headers,map:headers.map(autoMapField),filename:file.name};
    logAudit("payroll.template.upload",file.name+" — "+headers.length+" columns","admin");save();render();};
  const nm=(file.name||"").toLowerCase();
  if(nm.endsWith(".csv")){const r=new FileReader();
    r.onload=ev=>{const first=String(ev.target.result||"").split(/\r?\n/).find(l=>l.trim()!=="")||"";finish(parseCSVLine(first));};
    r.readAsText(file);
  } else {
    if(typeof XLSX==="undefined"){toast("Spreadsheet reader not loaded — check your connection and retry, or upload a .csv template.");return;}
    const r=new FileReader();
    r.onload=ev=>{try{const wb=XLSX.read(ev.target.result,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});finish(aoa[0]||[]);}catch(x){toast("Couldn't read template: "+x.message);}};
    r.readAsArrayBuffer(file);
  }
}
function exportPayrollCSV(){
  if(!S.staff.length){toast("No staff/roster to export yet.");return;}
  const rows=payrollRows();
  const q=x=>`"${String(x==null?"":x).replace(/"/g,'""')}"`;
  const tpl=S.payrollTemplate;
  let head,lineVals;
  if(tpl&&tpl.headers&&tpl.headers.length){
    head=tpl.headers; lineVals=r=>tpl.headers.map((h,i)=>payrollFieldValue(r,(tpl.map||[])[i]||""));
  } else {
    head=["Employee No","Surname","Given Name","Date","Shift Code","Start","End","Hours","Unit","Notes"];
    lineVals=r=>[r.emp,r.sur,r.giv,fmtDate(r.date),r.code,r.start,r.end,r.hours,r.unit,r.note];
  }
  let csv=head.map(q).join(",")+"\n";
  rows.forEach(r=>{csv+=lineVals(r).map(q).join(",")+"\n";});
  download(csv,"rosteron-payroll-"+active().cycle.start+".csv","text/csv");
  logAudit("export.payroll.rosteron",cyLabel(active())+" — "+rows.length+" shift rows"+(tpl?" (template)":""),"admin");save();
}
function exportRosterCSV(){
  const ds=cycleDates();
  let csv=[ROLEC()].concat(ds.map(d=>DOW[d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1))).join(",")+"\n";
  rosterStaff().forEach(s=>{csv+=[s.name].concat(ds.map(d=>{const sh=getShift(s.id,iso(d));const l=shiftLabel(sh).replace(/^Off$/,"")+ownHoursTag(active(),sh), oc=ocTakenBy(active(),s.id,iso(d)).map(w=>"On call "+w.label).join(" + ");return [l&&sh.kind==="clinical"&&sh.locum?l+" (locum)":l,oc].filter(Boolean).join(" + ");})).map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")+"\n";});
  download(csv,"roster-"+active().cycle.start+".csv","text/csv");logAudit("export.roster.csv",cyLabel(active()),"admin");save();
}
function exportRosterXLS(){
  const ds=cycleDates(), _ocX=ocTakenWindows(active()).length>0;
  let h='<table border="1" style="border-collapse:collapse;font-family:Arial;font-size:11px"><tr><th>'+ROLEC()+'</th>'+ds.map(d=>`<th>${DOW[d.getDay()]}<br>${d.getDate()}/${d.getMonth()+1}</th>`).join("")+'</tr>';
  rosterStaff().forEach(s=>{h+=`<tr><td>${escapeHTML(s.name)}</td>`+ds.map(d=>{const sh=getShift(s.id,iso(d));const c=rosterColor(sh);const loc=sh.kind==="clinical"&&sh.locum;const oc=ocTakenBy(active(),s.id,iso(d)).map(w=>"On call "+escapeHTML(w.label)).join(" + ");const lbl=[sh.kind==="off"?"":(escapeHTML(shiftLabel(sh)+ownHoursTag(active(),sh))+(loc?" (L)":"")),oc].filter(Boolean).join(" + ");return c?`<td style="background-color:${c.bg};color:${c.t}${loc?";border:2px solid "+PALETTE["--locum"]:""}">${lbl}</td>`:(oc?`<td>${lbl}</td>`:'<td></td>');}).join("")+'</tr>';});
  h+='</table>';
  const doc='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><h2 style="font:bold 16px Arial;color:'+PALETTE["--navy"]+';margin:0">'+escapeHTML(hospitalGroupLabel())+'</h2><h3 style="font:bold 13px Arial;margin:4px 0 2px">Roster '+escapeHTML(cyLabel(active()))+' · '+(STATUS[active().status]?STATUS[active().status].label:active().status)+'</h3><p style="font:11px Arial;color:'+PALETTE["--muted"]+';margin:0 0 8px">Exported '+fmt(new Date(),{day:"numeric",month:"short",year:"numeric"})+' from Myrosta · myrosta.com.au — AM blue, PM amber, CST green, leave colours as in the app; L = locum'+(_ocX?"; On call = an on-call window, not a shift":"")+'</p>'+h+'</body></html>';
  download(doc,"roster-"+active().cycle.start+".xls","application/vnd.ms-excel");logAudit("export.roster.xls",cyLabel(active()),"admin");save();
}
