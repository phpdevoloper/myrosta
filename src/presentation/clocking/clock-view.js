"use strict";
// moved from js/admin.js lines 1029-1145 (Phase 1 split, no edits)
/* ---------- walk-in clocking (10 Oct 2026): nothing rostered today, so the tap makes the shift ---------- */
function walkinMay(cyc,sid,isoD,now){ now=now||clockNow(); if(!clockOn()||!clockWalkinOn()||!cyc||cyc.archived||cyc.status==="draft")return false; if(isoD!==iso(now))return false;
  const s=S.staff.find(x=>x.id===sid); if(!s||!inCycle(s))return false; if(getShift(sid,isoD).kind!=="off")return false; const rec=clockRec(cyc,sid,isoD); return !(rec&&rec.in); }   // on the list, nothing rostered or on leave today, not clocked yet
function walkinBtnHTML(isoD){ return `<button class="btn" data-walkin="${isoD}">${ic("clock")} Clock in \u2014 not rostered</button>`; }
function walkinStart(sid,isoD,period,zoneId,fix,now){ now=now||clockNow(); const cyc=active();
  if(!walkinMay(cyc,sid,isoD,now))return {ok:false,reason:"Nothing to clock in to \u2014 you already have a shift today, or walk-in clocking is off for this group."};
  if(period!=="AM"&&period!=="PM")return {ok:false,reason:"Pick AM or PM."}; if(!zoneById(zoneId))return {ok:false,reason:"Pick the zone you are working in."};
  const key=sid+"|"+isoD; cyc.assign[key]={kind:"clinical",period:period,zone:zoneId,walkin:true};
  if(!clockMay(cyc,sid,isoD,now).in){ delete cyc.assign[key]; return {ok:false,reason:"Too early for a "+perName(period)+" shift \u2014 clock in from an hour before it starts, or pick the other half."}; }   // the shift is only kept when the tap can follow it
  logAudit("clock.walkin",nameOf(sid)+" "+isoD+" "+period+" "+zoneName(zoneId)+" \u2014 not rostered, created by the clock",sid);
  notify("admin",nameOf(sid)+" clocked in on "+fmtISO(isoD)+" without a rostered shift \u2014 approve or decline it under Hours to approve.","wk-"+sid+"-"+isoD,{tab:"requests",cycle:cyc.id}); save();
  return clockTap("in",fix,now); }
function walkinSheetHTML(isoD){ const per=_wkPer||(clockNow().getHours()<12?"AM":"PM"), zs=zonesFor(per);
  return `<div class="overlay" id="ovlWalkin"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="wkT"><h3 id="wkT">Clock in \u2014 not rostered today</h3><div class="sub">Pick the half and the zone you are working. The tap creates a casual shift for today and clocks you in; your admin approves it with the hours you clock.</div>
    <div class="seg" style="margin-top:8px">${["AM","PM"].map(p=>`<button class="${per===p?"on":""}" data-wkper="${p}">${escapeHTML(perName(p))}</button>`).join("")}</div>
    <div class="flexbtns" style="margin-top:8px">${zs.map(z=>`<button class="btn sm ${_wkZone===z.id?"primary":""}" data-wkzone="${z.id}">${escapeHTML(zoneLabel(z,per))}</button>`).join("")}</div>
    <div class="flexbtns" style="margin-top:12px"><button class="btn primary" id="wkGo" ${_wkZone?"":"disabled"}>${ic("clock")} Clock in</button><button class="btn" id="wkCancel">Cancel</button></div><div class="muted small" style="margin-top:8px">${CLOCK_NOTE}</div></div></div>`; }
function openWalkinSheet(isoD){ _wkPer=null; _wkZone=null;
  const draw=()=>{ const root=openDialog(walkinSheetHTML(isoD));
    root.querySelectorAll("[data-wkper]").forEach(b=>b.onclick=()=>{ _wkPer=b.dataset.wkper; _wkZone=null; closeModal(); draw(); });
    root.querySelectorAll("[data-wkzone]").forEach(b=>b.onclick=()=>{ _wkZone=b.dataset.wkzone; closeModal(); draw(); });
    const go=document.getElementById("wkGo"); if(go)go.onclick=()=>{ const per=_wkPer||(clockNow().getHours()<12?"AM":"PM"), z=_wkZone; closeModal(); const r=walkinStart(clockActor(),isoD,per,z); if(!r.ok)toast(r.reason); else if(!r.pending)render(); };
    const c=document.getElementById("wkCancel"); if(c)c.onclick=closeModal; };
  draw(); }
const CLOCK_NOTE="Myrosta keeps only the time of your tap and how far you were from the clinic.";
function clockMyHTML(sid,now){ if(!clockOn()||sid!==clockActor())return ""; now=now||clockNow(); const cyc=active(), t=iso(now), y=iso(addDays(now,-1));
  const rows=[t,y].map(d=>{ const w=clockWindow(cyc,sid,d), rec=clockRec(cyc,sid,d)||{}, st=clockStatusText(cyc,sid,d,now), btn=w?clockButtonsHTML(cyc,sid,d,now):(walkinMay(cyc,sid,d,now)?walkinBtnHTML(d):""); if(!btn&&!st)return "";
    const late=d===t&&!!w&&!!rec.in&&!rec.out&&clockMin(clockNowHHMM(now))>((w.end==="00:00")?1440:clockMin(w.end));   // past the rostered finish and still clocked in: the banner
    return `<div class="listrow"><span class="grow"><b>${d===t?"Today":"Yesterday"}</b>${late?` <span class="tag warn">Still clocked in from ${escapeHTML(rec.in.t)}</span>`:""}${st?`<div class="muted small">${escapeHTML(st)}</div>`:""}</span>${btn}</div>`; }).join("");
  return rows?`<div class="card" style="margin-top:8px"><b>Clock</b>${rows}<div class="muted small">${CLOCK_NOTE}</div></div>`:""; }
function clockSheetHTML(cyc,sid,isoD,now){ if(!clockOn()||sid!==clockActor())return ""; now=now||clockNow();
  if(!clockWindow(cyc,sid,isoD))return walkinMay(cyc,sid,isoD,now)?`<div class="dsact" style="align-items:center">${walkinBtnHTML(isoD)}<span class="muted small">Nothing rostered today \u2014 clocking in creates a casual shift for your admin to approve.</span></div>`:"";
  const btn=clockButtonsHTML(cyc,sid,isoD,now), st=clockStatusText(cyc,sid,isoD,now); if(!btn&&!st)return "";
  return `<div class="dsact" style="align-items:center">${btn}${st?`<span class="muted small">${escapeHTML(st)}</span>`:""}</div><div class="muted small">${CLOCK_NOTE}</div>`; }
function clockReadURL(){ const q=String(location.search||""), m=/[?&]clock=([^&#]+)/.exec(q); if(!m)return null; const om=/[?&]org=([^&#]+)/.exec(q); let token="", org=""; try{ token=decodeURIComponent(m[1]); org=om?decodeURIComponent(om[1]):""; }catch(e){ return null; }
  const pending={org:org,token:token}; try{ sessionStorage.setItem("myrosta_clock",JSON.stringify(pending)); if(org)localStorage.setItem("myrosta_org",org); }catch(e){}   // the scan waits for the sign-in, and names the group the poster belongs to
  try{ history.replaceState(null,"",location.pathname); }catch(e){} return pending; }   // a refresh never taps again
function goReadURL(){ const m=/[?&]go=(help)\b/.exec(String(location.search||"")); if(!m)return null;   // the landing page's "Every chapter" link (12 Oct 2026): ?go=help waits for the sign-in, then opens Help at the videos
  try{ sessionStorage.setItem("myrosta_go",m[1]); }catch(e){} try{ history.replaceState(null,"",location.pathname); }catch(e){} return m[1]; }
function goApplyURL(){ let g=null; try{ g=sessionStorage.getItem("myrosta_go"); sessionStorage.removeItem("myrosta_go"); }catch(e){} if(g!=="help")return null;
  S.tab="help"; _moreOpen=false; save(); render(); setTimeout(()=>{ const h=document.getElementById("videos"); if(h&&h.scrollIntoView)h.scrollIntoView({block:"start"}); },60); return g; }
function clockApplyURL(now){ let p=null; try{ p=JSON.parse(sessionStorage.getItem("myrosta_clock")||"null"); sessionStorage.removeItem("myrosta_clock"); }catch(e){} if(!p)return null;
  if(p.org&&p.org!==_org){ toast("That poster belongs to another group."); return "org"; }
  if(!clockOn()){ toast("Clocking is off for this group."); return "off"; }
  if(!clockTokenOK(p.token)){ toast("This poster is out of date \u2014 ask your manager for the new one."); return "stale"; }
  now=now||clockNow(); const cyc=active(), sid=clockActor(); if(!sid){ toast("Your sign-in isn\u2019t on this group\u2019s staff list, so there is nothing to clock."); return "refused"; } const kind=clockTarget(cyc,sid,"in",now)?"in":(clockTarget(cyc,sid,"out",now)?"out":null);
  if(!kind){ toast("Nothing to clock today."); return "none"; }
  const r=clockTap(kind,{dist:null,acc:null,inside:null,via:"poster"},now); if(r.ok){ toast("Clocked "+kind+" "+r.tap.t+" \u00b7 by poster","ok"); render(); return kind; } toast(r.reason); return "refused"; }
function clockRows(cyc,now){ const g=clockGrace(), keepFrom=iso(addDays(now,-CLOCK_KEEP)), open=r=>r.p.status==="proposed"&&!r.dec;   // proposals first, newest day first, then a fortnight of closed records for information
  return Object.keys(cyc.clock||{}).map(k=>{ const sid=k.split("|")[0], isoD=k.split("|")[1]; return {sid:sid,isoD:isoD,p:clockProposal(cyc,sid,isoD,g,now),rec:cyc.clock[k],dec:clockDecOf(cyc,sid,isoD)}; })
    .filter(r=>r.p.status!=="none"&&r.p.status!=="open"&&(open(r)||r.isoD>=keepFrom)).sort((a,b)=>((open(a)?0:1)-(open(b)?0:1))||(a.isoD<b.isoD?1:a.isoD>b.isoD?-1:0)||nameOf(a.sid).localeCompare(nameOf(b.sid))); }
function clockCount(cyc,now){ if(!clockOn())return 0; return clockRows(cyc,now).filter(r=>r.p.status==="proposed"&&!r.dec).length; }
function clockListHTML(now){ if(!isAdmin()||!clockOn())return ""; now=now||clockNow(); const cyc=active(), rows=clockRows(cyc,now); if(!rows.length)return ""; const n=clockCount(cyc,now);
  const row=r=>{ const open=r.p.status==="proposed"&&!r.dec, rec=r.rec, ro=(r.dec&&r.dec.rostered)||r.p.rostered, line=(ro?"rostered "+ro.start+"\u2013"+ro.end+" \u00b7 ":"")+"clocked "+rec.in.t+"\u2013"+(rec.out?rec.out.t:"?")+(open?" \u00b7 proposes "+r.p.start+"\u2013"+r.p.end:"");
    const chips=r.p.flags.map(f=>`<span class="tag ${/outside|no location|out of order|no clock-out|no shift/.test(f)?"warn":"muted"} mini">${escapeHTML(f)}</span>`).join(" ");
    const word=r.dec?(r.dec.ok?"approved "+r.dec.start+"\u2013"+r.dec.end:(r.dec.walkin?"declined \u00b7 shift removed":"declined \u00b7 as rostered")):(open?"":(r.p.status==="rostered"?"as rostered":r.p.status==="noOut"?"no clock-out":"no proposal"));
    return `<div class="listrow${open?"":" muted"}"><span class="grow"><b>${escapeHTML(nameOf(r.sid))}</b> \u00b7 ${escapeHTML(fmtISO(r.isoD))}<div class="muted small">${escapeHTML(line)}</div>${chips?`<div>${chips}</div>`:""}</span>${word?`<span class="tag ${r.dec&&r.dec.ok?"ok":"muted"}">${escapeHTML(word)}</span>`:""}${open?`<button class="btn sm" data-clkno="${r.sid}|${r.isoD}">Decline</button><button class="btn primary sm" data-clkok="${r.sid}|${r.isoD}">Approve</button>`:""}</div>`; };
  return `<div class="card" id="clockList"><h2>Hours to approve <span class="tag ${n?"warn":"muted"}">${n}</span></h2><div class="sub">Clocked hours outside the grace band. Approve writes them as the shift\u2019s own hours for pay; Decline keeps the rostered hours. Closed records stay a fortnight, for information.</div>${rows.map(row).join("")}</div>`; }
function clockApprove(sid,isoD){ if(!isAdmin())return {ok:false,reason:"Admin only."}; const c=active(), p=clockProposal(c,sid,isoD,clockGrace(),clockNow()); if(p.status!=="proposed")return {ok:false,reason:"Nothing to approve."}; if(clockDecOf(c,sid,isoD))return {ok:false,reason:"Already decided."};
  if(!hoursSet(sid,isoD,p.start,p.end))return {ok:false};   // refused synchronously in local mode; in cloud mode the guarded commit answers later and says so itself
  if(!c.clockDec)c.clockDec={}; c.clockDec[sid+"|"+isoD]={ok:true,start:p.start,end:p.end,rostered:p.rostered,by:S.viewAs,ts:Date.now()};
  logAudit("clock.approve",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 "+p.start+"\u2013"+p.end+(p.flags.length?" \u00b7 "+p.flags.join(", "):""),"admin"); save(); return {ok:true}; }
function clockDecline(sid,isoD){ if(!isAdmin())return {ok:false,reason:"Admin only."}; const c=active(), p=clockProposal(c,sid,isoD,clockGrace(),clockNow()); if(p.status!=="proposed")return {ok:false,reason:"Nothing to decline."}; if(clockDecOf(c,sid,isoD))return {ok:false,reason:"Already decided."};
  const _sh=(c.assign||{})[sid+"|"+isoD], _wk=!!(_sh&&_sh.walkin);
  if(!c.clockDec)c.clockDec={}; c.clockDec[sid+"|"+isoD]={ok:false,rostered:p.rostered,by:S.viewAs,ts:Date.now(),walkin:_wk};
  if(_wk){ delete c.assign[sid+"|"+isoD]; logAudit("clock.walkin-decline",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 walk-in shift removed","admin"); notify(sid,"Your admin declined the walk-in shift on "+fmtISO(isoD)+" \u2014 it has been removed.",null,{tab:"my",cycle:c.id}); save(); return {ok:true}; }   // the clock made the shift; the decision unmakes it
  logAudit("clock.decline",nameOf(sid)+" \u00b7 "+fmtISO(isoD)+" \u00b7 rostered hours stand","admin");
  notify(sid,"Your admin kept the rostered hours on "+fmtISO(isoD)+".",null,{tab:"my",cycle:c.id}); save(); return {ok:true}; }
function clockMarkHTML(cyc,sid,isoD){ const r=clockRec(cyc,sid,isoD); if(!clockOn()||!r||!r.in)return ""; return `<span class="muted small"> \u00b7 in ${escapeHTML(r.in.t)}${r.out?" \u00b7 out "+escapeHTML(r.out.t):""}</span>`; }   // who has arrived, on the Day board and the day sheet
function qrMatrix(text){   // a QR code, byte mode, error level M, mask 0, versions 1 to 6 (up to 106 characters): enough for the poster's link. Checked bit for bit against a reference encoder in the plan's dry run
  const bytes=[]; for(const ch of unescape(encodeURIComponent(String(text))))bytes.push(ch.charCodeAt(0));
  const EC=[10,16,26,18,24,16], BLOCKS=[1,1,1,2,2,4], TOTAL=[26,44,70,100,134,172];
  let ver=-1; for(let v=0;v<6;v++){ if(bytes.length<=TOTAL[v]-EC[v]*BLOCKS[v]-2){ ver=v; break; } } if(ver<0)throw new Error("too long for the poster code");
  const size=21+4*ver, dataCw=TOTAL[ver]-EC[ver]*BLOCKS[ver], bits=[], put=(val,n)=>{ for(let i=n-1;i>=0;i--)bits.push((val>>i)&1); };
  put(4,4); put(bytes.length,8); bytes.forEach(b=>put(b,8)); put(0,Math.min(4,dataCw*8-bits.length)); while(bits.length%8)bits.push(0);
  for(let pad=0xEC;bits.length<dataCw*8;pad^=(0xEC^0x11))put(pad,8);
  const data=[]; for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(""),2));
  const EXP=new Array(512), LOG=new Array(256); for(let i=0,x=1;i<255;i++){ EXP[i]=x; LOG[x]=i; x=(x<<1)^((x&0x80)?0x11D:0); } for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
  const mul=(a,b)=>(a&&b)?EXP[LOG[a]+LOG[b]]:0, ecLen=EC[ver]; let gen=[1]; for(let i=0;i<ecLen;i++){ const next=new Array(gen.length+1).fill(0); for(let j=0;j<gen.length;j++){ next[j]^=gen[j]; next[j+1]^=mul(gen[j],EXP[i]); } gen=next; }
  const rs=block=>{ const res=block.concat(new Array(ecLen).fill(0)); for(let i=0;i<block.length;i++){ const f=res[i]; if(!f)continue; for(let j=0;j<gen.length;j++)res[i+j]^=mul(gen[j],f); } return res.slice(block.length); };
  const nb=BLOCKS[ver], per=dataCw/nb, blocks=[], ecs=[]; for(let b=0;b<nb;b++){ const blk=data.slice(b*per,(b+1)*per); blocks.push(blk); ecs.push(rs(blk)); }
  const cw=[]; for(let i=0;i<per;i++)for(let b=0;b<nb;b++)cw.push(blocks[b][i]); for(let i=0;i<ecLen;i++)for(let b=0;b<nb;b++)cw.push(ecs[b][i]);
  const M=[], F=[]; for(let y=0;y<size;y++){ M.push(new Array(size).fill(0)); F.push(new Array(size).fill(false)); }
  const set=(x,y,v)=>{ M[y][x]=v?1:0; F[y][x]=true; };
  const finder=(cx,cy)=>{ for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){ const x=cx+dx, y=cy+dy; if(x<0||y<0||x>=size||y>=size)continue; const d=Math.max(Math.abs(dx),Math.abs(dy)); set(x,y,d!==2&&d!==4); } };
  finder(3,3); finder(size-4,3); finder(3,size-4);
  for(let i=8;i<size-8;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
  if(ver>0){ const c=size-7; for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(c+dx,c+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1); }
  const fb=0x5412, bit=i=>(fb>>i)&1;   // the format word for error level M with mask 0
  for(let i=0;i<=5;i++)set(8,i,bit(i)); set(8,7,bit(6)); set(8,8,bit(7)); set(7,8,bit(8)); for(let i=9;i<15;i++)set(14-i,8,bit(i));
  for(let i=0;i<8;i++)set(size-1-i,8,bit(i)); for(let i=8;i<15;i++)set(8,size-15+i,bit(i)); set(8,size-8,true);
  let k=0; for(let right=size-1;right>=1;right-=2){ if(right===6)right=5; for(let vert=0;vert<size;vert++){ for(let j=0;j<2;j++){ const x=right-j, up=((right+1)&2)===0, y=up?size-1-vert:vert; if(F[y][x])continue; let v=0; if(k<cw.length*8)v=(cw[k>>3]>>(7-(k&7)))&1; k++; if(((x+y)&1)===0)v^=1; M[y][x]=v; } } }
  return {size:size,rows:M}; }
function clockQRSVG(text){ const q=qrMatrix(text), s=q.size, quiet=4; let d=""; for(let y=0;y<s;y++)for(let x=0;x<s;x++)if(q.rows[y][x])d+="M"+(x+quiet)+" "+(y+quiet)+"h1v1h-1z";
  return `<svg viewBox="0 0 ${s+2*quiet} ${s+2*quiet}" role="img" aria-label="QR code for the clock link" shape-rendering="crispEdges"><path d="${d}" fill="currentColor"/></svg>`; }
function clockPosterHTML(){ const s=clockSite(); if(!s||!s.posterKey)return ""; const url=clockPosterURL();   // rendered with the Group half of Settings, hidden on screen; Print the clock poster prints it alone
  let qr=""; try{ qr=clockQRSVG(url); }catch(e){ qr=`<div class="note">${escapeHTML("This group\u2019s link is too long for the poster code ("+url.length+" characters). Shorten the group\u2019s name in the registry, or ask Myrosta support.")}</div>`; }
  return `<div class="card" id="posterCard"><div class="poster"><div class="pbrand">${escapeHTML(hospitalGroupLabel())}</div><h1>Scan to clock in or out</h1><div class="pqr">${qr}</div><div class="purl">${escapeHTML(url)}</div><div class="pfoot">Open the camera, point it at the code, tap the link. Sign in if asked. \u00b7 Poster made ${escapeHTML(fmt(new Date(s.posterAt||0),{day:"numeric",month:"short",year:"numeric"}))} \u00b7 Myrosta</div></div></div>`; }
function exportClockCSV(){ const c=active(), now=clockNow(), g=clockGrace(), proof=t=>t?(t.via==="poster"?"poster":(t.inside==null?"no location":(t.inside?"inside":"outside"))):"";
  const rows=[["Person","Day","Rostered start","Rostered finish","Clock in","In distance (m)","In proof","Clock out","Out distance (m)","Out proof","Proposed start","Proposed finish","Flags","Decision","Decided by","Decided at"]];
  Object.keys(c.clock||{}).sort((a,b)=>{ const da=a.split("|")[1], db=b.split("|")[1]; return da<db?-1:da>db?1:nameOf(a.split("|")[0]).localeCompare(nameOf(b.split("|")[0])); }).forEach(k=>{ const sid=k.split("|")[0], d=k.split("|")[1], r=c.clock[k], p=clockProposal(c,sid,d,g,now), dec=clockDecOf(c,sid,d), ro=(dec&&dec.rostered)||p.rostered||{};
    rows.push([nameOf(sid),d,ro.start||"",ro.end||"",r.in?r.in.t:"",(r.in&&r.in.dist!=null)?r.in.dist:"",proof(r.in),r.out?r.out.t:"",(r.out&&r.out.dist!=null)?r.out.dist:"",proof(r.out),(p.status==="proposed")?p.start:((dec&&dec.ok)?dec.start:""),(p.status==="proposed")?p.end:((dec&&dec.ok)?dec.end:""),p.flags.join("; "),dec?(dec.ok?"approved":"declined"):(p.status==="proposed"?"waiting":p.status),dec?nameOf(dec.by):"",dec?new Date(dec.ts).toISOString():""]); });
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n")+"\n"; download(csv,"clock-"+c.cycle.start+".csv","text/csv"); logAudit("export.clock",cyLabel(c),"admin"); save(); }
function ownHoursSwitch(on){ if(on)S.ownHours=true; else delete S.ownHours; logAudit("settings.ownHours",on?"on":"off","admin"); save(); }   // the Group card's tick: written as true, deleted when off, never false
function instantBookOn(){ return S.instantBook!==false; }   // the group switch (9 Oct 2026): a tap books the shift at once — first tap wins, no basket. Since 12 Oct 2026 absent means ON (the owner's call: the basket doubled the process); an admin who wants the basket switches it off, stored as false
function instantBookSwitch(on){ if(on)delete S.instantBook; else S.instantBook=false; logAudit("settings.instantBook",on?"on":"off","admin"); save(); }   // on is the default, so on clears the key
function modalHours(draft,cyc){ if(draft&&draft.hours)return {start:String(draft.hours.start||""),end:String(draft.hours.end||"")}; const t=typeOf(cyc,{kind:"clinical",period:(draft&&draft.period)||"AM",type:draft&&draft.type}); return t?{start:t.start,end:t.end}:{start:"",end:""}; }   // what the cell editor's Hours row shows: the draft's own pair, else the type's window (a type id that no longer exists reads as its period's, as shiftWindow does)
function modalHoursCheck(cyc,sh){ const h=sh&&sh.hours; if(!h)return {ok:true};   // the cell editor's Save: an empty pair or the type's own window clears, a pair the rule refuses is named, anything else is stored normalised
  const a=String(h.start||""), b=String(h.end||""); if(!a&&!b){ delete sh.hours; return {ok:true}; }
  if(!hoursOK(a,b))return {ok:false,reason:HOURS_RULE};
  const n=hoursNorm(cyc,sh,a,b); if(n)sh.hours=n; else delete sh.hours; return {ok:true}; }
function srHoursFor(cyc,isoD,p,typeId){ const h=_srHours[isoD]; if(!h)return {ok:true,hours:null};
  const a=String(h.start||"").trim(), b=String(h.end||"").trim(); if(!a&&!b)return {ok:true,hours:null};
  if(!hoursOK(a,b))return {ok:false,reason:HOURS_RULE};
  return {ok:true,hours:hoursNorm(cyc,{kind:"clinical",period:p,type:typeId||undefined},a,b)}; }   // what was typed beside a pick: nothing, the type's own window (nothing to store), a pair to store, or a pair the rule refuses
function importShift(cyc,sh){ const out=Object.assign({kind:"clinical",period:sh.period,zone:ensureZoneForRole(sh.role)},(sh.type&&typeById(cyc,sh.type))?{type:sh.type}:{});
  if(sh.start&&sh.end&&hoursOK(sh.start,sh.end)){ const h=hoursNorm(cyc,out,sh.start,sh.end); if(h)out.hours=h; } return out; }   // an imported cell: the type the cycle knows, and the cell's own times as own hours when they differ from that type's window; a pair the rule refuses is dropped
