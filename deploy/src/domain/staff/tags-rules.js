"use strict";
// moved from js/admin.js lines 1146-1292 (Phase 1 split, no edits)
/* ---------- tags on people, rules on slots: a tag is a label on a person; a cycle may say a slot needs a tag, or that each half of a day needs at least N holders of one ----------
   Everything here takes its state explicitly (st = the group's record, cyc = the cycle judged), so the merge, a screen and a cycle that is not on screen get the same answer.
   Absent until an admin creates something: with no tags and no rules the judge says yes without reading anything else, and nothing new is written. */
function tagList(st){ return Array.isArray(st&&st.tags)?st.tags.filter(t=>t&&t.id):[]; }   // the group's tags, in the order they are shown everywhere
function tagById(st,id){ return tagList(st).find(t=>t.id===id)||null; }
function tagName(st,id){ const t=tagById(st,id); return t?String(t.name||""):""; }
function personTags(st,p){ const ids=(p&&Array.isArray(p.tags))?p.tags:[]; return tagList(st).filter(t=>ids.indexOf(t.id)>=0).map(t=>t.id); }   // only tags the list still has, in list order
function hasTag(st,p,id){ return personTags(st,p).indexOf(id)>=0; }
function rulesOf(cyc){ const r=(cyc&&cyc.settings&&cyc.settings.rules)||{}; return {needs:(r.needs&&typeof r.needs==="object")?r.needs:{},mins:Array.isArray(r.mins)?r.mins:[]}; }   // always an object with both parts
function rulesPresent(cyc){ const r=rulesOf(cyc); return Object.keys(r.needs).some(z=>Array.isArray(r.needs[z])&&r.needs[z].length>0)||r.mins.length>0; }
function dayType(st,isoD){ if(((st&&st.publicHolidays)||[]).indexOf(isoD)>=0)return 2; const w=parseISO(isoD).getDay(); return (w===0||w===6)?1:0; }   // exactly one per date: a public holiday on a Saturday is a public holiday
function minFor(m,period,dt){ const n=m&&m.n&&m.n[period]; const v=Array.isArray(n)?+n[dt]:0; return (isFinite(v)&&v>0)?Math.floor(v):0; }   // 0 or blank means no minimum in that cell
function capOf(cyc,st,period){ const sg=(cyc&&cyc.settings&&cyc.settings.staffing)||(st&&st.staffing)||{}; const zs=(cyc&&cyc.settings&&cyc.settings.zones)||(st&&st.zones)||[];
  const mx=period==="AM"?sg.amMax:sg.pmMax, open=zs.filter(z=>period==="AM"?z.am:z.pm).length; return Math.min(mx==null?99:+mx,open); }   // the places a half really has: the maximum, or the zones open then, whichever is smaller
function ruleCounts(cyc,st,isoD,o){   // who is booked in each half of isoD in this cycle: people whose clinical shift fills it, less o.without, plus o.with
  o=o||{}; const out={AM:[],PM:[]}, skip=o.without||[], a=(cyc&&cyc.assign)||{}, staff=(st&&st.staff)||[];
  Object.keys(a).forEach(k=>{ const v=a[k]; if(!v||v.kind!=="clinical")return; const i=k.indexOf("|"); if(k.slice(i+1)!==isoD)return; const sid=k.slice(0,i); if(skip.indexOf(sid)>=0)return;
    const p=staff.find(x=>x.id===sid)||null; fillsOf(cyc,v).forEach(f=>{ if(out[f])out[f].push({sid:sid,p:p,zone:v.zone}); }); });
  (o.with||[]).forEach(w=>{ const p=staff.find(x=>x.id===w.sid)||null; (w.fills||[]).forEach(f=>{ if(out[f])out[f].push({sid:w.sid,p:p,zone:w.zone||null}); }); });
  return out; }
function ruleShort(cyc,st,isoD,period,booked){   // per minimum, in tag-list order: how many holders that half still lacks
  const r=rulesOf(cyc), dt=dayType(st,isoD), order=tagList(st).map(t=>t.id);
  return r.mins.filter(m=>m&&order.indexOf(m.tag)>=0).sort((x,y)=>order.indexOf(x.tag)-order.indexOf(y.tag)).map(m=>{ const need=minFor(m,period,dt), have=booked.filter(b=>b.p&&hasTag(st,b.p,m.tag)).length; return {tag:m.tag,need:need,have:have,short:Math.max(0,need-have)}; }); }
function ruleJudge(cyc,st,sid,isoD,fills,zoneId,o){   // may this person take this slot on this day? {ok:true}, or {ok:false, rule:"needs"|"held", tag, reason}
  o=o||{}; if(!rulesPresent(cyc))return {ok:true};
  const p=((st&&st.staff)||[]).find(x=>x.id===sid)||null, r=rulesOf(cyc);
  const need=(r.needs[zoneId]||[]).filter(t=>tagById(st,t)), miss=need.find(t=>!hasTag(st,p,t));
  if(miss){ const z=(((cyc&&cyc.settings&&cyc.settings.zones)||(st&&st.zones)||[]).find(x=>x.id===zoneId)), zl=z?zoneLabelFor(cyc,z,{kind:"clinical",period:(fills&&fills[0])||"AM",type:o.type}):"That slot";
    return {ok:false,rule:"needs",tag:miss,reason:zl+" needs "+tagName(st,miss)+"."}; }   // rule 1: the slot needs a tag this person lacks
  const counts=ruleCounts(cyc,st,isoD,{without:(o.without||[]).concat([sid]),with:o.with});
  for(let i=0;i<(fills||[]).length;i++){ const P=fills[i]; if(!counts[P])continue; const booked=counts[P], open=capOf(cyc,st,P)-booked.length; let worst=null;
    ruleShort(cyc,st,isoD,P,booked).forEach(s=>{ const short=Math.max(0,s.need-(s.have+(hasTag(st,p,s.tag)?1:0))); if(short>0&&(!worst||short>worst.short))worst={tag:s.tag,short:short}; });   // the largest shortfall, never the sum: one person can hold several tags; ties go to the earlier tag
    if(worst&&open-1<worst.short){ const pl=(typeById(cyc,P)||{}).label||P;
      return {ok:false,rule:"held",tag:worst.tag,reason:"Held for a "+tagName(st,worst.tag)+" \u2014 "+fmtISO(isoD)+" "+pl+" still needs "+worst.short+", and "+(open<=1?"this is the last place.":"only "+open+" places are left.")}; } }   // rule 2: the last places are held for holders
  return {ok:true}; }
function ruleBreaches(cyc,st,isoD){   // what a day is short of, in a fixed order: AM before PM; minimums before slots; tag-list order; zone order. Callers decide which dates to ask about
  if(!rulesPresent(cyc))return []; const out=[], counts=ruleCounts(cyc,st,isoD,null), r=rulesOf(cyc), zs=(cyc&&cyc.settings&&cyc.settings.zones)||(st&&st.zones)||[];
  ["AM","PM"].forEach(P=>{ const booked=counts[P];
    ruleShort(cyc,st,isoD,P,booked).forEach(s=>{ if(s.need>0&&s.have<s.need)out.push({kind:"min",period:P,tag:s.tag,need:s.need,have:s.have}); });
    zs.forEach(z=>{ const need=(r.needs[z.id]||[]).filter(t=>tagById(st,t)); if(!need.length)return;
      booked.filter(b=>b.zone===z.id).forEach(b=>{ const miss=need.find(t=>!hasTag(st,b.p,t)); if(miss)out.push({kind:"needs",period:P,zone:z.id,sid:b.sid,tag:miss}); }); }); });
  return out; }
function adminPlaceCheck(sid,isoD,sh){   // the admin's cell editor asks the judge as a warning: the sentence, then "Place ⟨Name⟩ anyway?"; the person's own shift that day does not count against them
  const cyc=active(), j=ruleJudge(cyc,S,sid,isoD,fillsOf(cyc,sh),sh.zone,{type:sh.type,without:[sid]}); if(j.ok)return {ok:true,over:null};
  if(!confirm(j.reason+"\n\nPlace "+nameOf(sid)+" anyway?"))return {ok:false,over:null}; return {ok:true,over:j.reason}; }
function adminOverrideAudit(sid,isoD,sh,reason){ logAudit("rules.override",nameOf(sid)+" "+isoD+" "+shiftLabel(sh)+" \u00b7 "+reason,"admin"); }   // who placed whom, where, against which rule
function ruleDraftPick(cyc,st,isoD,period,pool,free){   // the auto-draft's next placement in a half: holders of a tag it is short of first (largest shortfall first), then anyone; each in the first free zone the judge accepts; null when nobody eligible is left
  const place=p=>{ for(const z of free){ if(ruleJudge(cyc,st,p.id,isoD,[period],z.id,null).ok)return {sid:p.id,zone:z.id}; } return null; };
  if(rulesPresent(cyc)){ const booked=ruleCounts(cyc,st,isoD,null)[period], short=ruleShort(cyc,st,isoD,period,booked).filter(x=>x.short>0).sort((a,b)=>b.short-a.short);
    for(const s of short){ for(const p of pool){ if(!hasTag(st,p,s.tag))continue; const got=place(p); if(got)return got; } } }
  for(const p of pool){ const got=place(p); if(got)return got; } return null; }
function tagChipsHTML(s){ return personTags(S,s).filter(id=>!!(tagById(S,id)||{}).show).map(id=>' <span class="tag mini">'+escapeHTML(tagName(S,id))+'</span>').join(""); }   // only tags ticked Show, in list order — this group's own screens; the department board reads the digest, which carries none
function tagChipsAll(s){ return personTags(S,s).map(id=>' <span class="tag mini">'+escapeHTML(tagName(S,id))+'</span>').join(""); }   // the Staff tab shows every tag, whatever the tick
function ruleNeedText(cyc,st,isoD,P,o){ if(!rulesPresent(cyc))return ""; const short=ruleShort(cyc,st,isoD,P,ruleCounts(cyc,st,isoD,o||null)[P]).filter(s=>s.short>0); return short.length?"needs "+short.map(s=>s.short+" "+tagName(st,s.tag)).join(", "):""; }   // what a half is still short of, computed when shown; o.without leaves someone out, as a give-away's giver is
function ruleChip(isoD,P){ if(isoD<iso(new Date()))return ""; const t=ruleNeedText(active(),S,isoD,P); return t?" \u00b7 "+escapeHTML(t):""; }   // past days are never re-judged
function osNeedsHTML(o){ if(!o||o.status!=="open")return ""; const c=(S.cycles||[]).find(x=>x.id===o.cycleId); if(!c||!rulesPresent(c))return "";
  const parts=[]; fillsOf(c,{kind:"clinical",period:o.period,zone:o.zone,type:o.type||undefined}).forEach(P=>{ const t=ruleNeedText(c,S,o.iso,P,{without:(o.kind==="giveaway"&&o.from)?[o.from]:[]}); if(t)parts.push(escapeHTML(t)); }); return parts.length?' \u00b7 <span class="muted">'+parts.join(", ")+'</span>':""; }
function gapRowText(sl){ if(sl.kind==="needs")return `${escapeHTML(zoneName(sl.zone))} \u2014 ${escapeHTML(nameOf(sl.sid))} isn\u2019t ${escapeHTML(tagName(S,sl.tag))}`;
  if(sl.kind==="min")return `needs <b>${sl.need}</b> ${escapeHTML(tagName(S,sl.tag))}`; return `${sl.have} of ${sl.min} \u00b7 need <b>${sl.need}</b>`; }
let _tagSeq=0;
function tagNewId(){ let id; do{ id="t"+Date.now().toString(36)+(_tagSeq++).toString(36)+Math.floor(Math.random()*1296).toString(36); }while(tagById(S,id)); return id; }   // minted once, never reused: a session sequence keeps one import's new tags apart, and a clash with a tag made elsewhere is re-rolled
function tagHolders(id){ return S.staff.filter(s=>hasTag(S,s,id)); }
function tagInUse(id){ const people=tagHolders(id).length, cycles=(S.cycles||[]).filter(c=>!c.archived&&(rulesOf(c).mins.some(m=>m&&m.tag===id)||Object.keys(rulesOf(c).needs).some(z=>(rulesOf(c).needs[z]||[]).indexOf(id)>=0))).length; return {people:people,cycles:cycles}; }
function tagAdd(name){ name=String(name||"").trim().slice(0,40); if(!name)return null;
  if(tagList(S).some(t=>String(t.name).toLowerCase()===name.toLowerCase())){ toast("There is already a tag called "+name+"."); return null; }
  const t={id:tagNewId(),name:name}; (S.tags=Array.isArray(S.tags)?S.tags:[]).push(t);   // hidden until its Show tick is set
  logAudit("tags.add",name,"admin"); save(); return t; }
function tagRename(id,name){ const t=tagById(S,id); name=String(name||"").trim().slice(0,40); if(!t||!name||name===t.name)return false;
  if(tagList(S).some(x=>x.id!==id&&String(x.name).toLowerCase()===name.toLowerCase())){ toast("There is already a tag called "+name+"."); return false; }
  logAudit("tags.rename",t.name+" \u2192 "+name,"admin"); t.name=name; save(); return true; }
function tagSetShow(id,on){ const t=tagById(S,id); if(!t)return; if(on)t.show=true; else delete t.show; logAudit("tags.show",t.name+(on?" shown on the roster":" hidden on the roster"),"admin"); save(); }
function tagRemove(id){ const t=tagById(S,id); if(!t)return {ok:false,reason:"That tag is gone."}; const u=tagInUse(id);
  if(u.people||u.cycles)return {ok:false,reason:"Can\u2019t remove "+t.name+" while "+(u.people?u.people+(u.people===1?" person holds":" people hold")+" it":"")+(u.people&&u.cycles?" and ":"")+(u.cycles?u.cycles+(u.cycles===1?" cycle\u2019s rules name":" cycles\u2019 rules name")+" it":"")+". Untick it and change the rules first."};
  S.tags=tagList(S).filter(x=>x.id!==id); if(!S.tags.length)delete S.tags; logAudit("tags.remove",t.name,"admin"); save(); return {ok:true}; }
function personTagSet(sid,tagId,on){ const s=S.staff.find(x=>x.id===sid), t=tagById(S,tagId); if(!s||!t)return false;
  const cur=(Array.isArray(s.tags)?s.tags:[]).filter(x=>x!==tagId); if(on)cur.push(tagId);
  const order=tagList(S).map(x=>x.id), next=cur.filter(x=>order.indexOf(x)>=0).sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  if(next.length)s.tags=next; else delete s.tags;   // the key goes with the last tag: the 3-way merge decides ownership by JSON equality
  logAudit("tags.person",s.name+(on?" + ":" \u2212 ")+t.name,"admin"); save(); return true; }
function rulesSummary(cyc,st){ const r=rulesOf(cyc), zs=(cyc&&cyc.settings&&cyc.settings.zones)||(st&&st.zones)||[], out=[], order=tagList(st).map(t=>t.id);
  zs.forEach(z=>{ const need=(r.needs[z.id]||[]).filter(t=>tagById(st,t)); if(need.length)out.push(z.name+" needs "+need.map(t=>tagName(st,t)).join(" and ")+"."); });
  r.mins.filter(m=>m&&order.indexOf(m.tag)>=0).sort((a,b)=>order.indexOf(a.tag)-order.indexOf(b.tag)).forEach(m=>{ const A=[0,1,2].map(d=>minFor(m,"AM",d)), P=[0,1,2].map(d=>minFor(m,"PM",d)), all=A.concat(P), nm=tagName(st,m.tag);
    if(!all.some(x=>x>0))return;
    if(all.every(x=>x===all[0])){ out.push("At least "+all[0]+" "+nm+" every AM and PM."); return; }
    if(A.every(x=>x===A[0])&&P.every(x=>x===P[0])){ const parts=[]; if(A[0]>0)parts.push(A[0]+" "+nm+" every AM"); if(P[0]>0)parts.push(P[0]+(A[0]>0?"":" "+nm)+" every PM"); out.push("At least "+parts.join(", ")+"."); return; }
    const DT=["weekday","weekend","public holiday"], parts=[]; ["AM","PM"].forEach(pp=>{ [0,1,2].forEach(d=>{ const v=minFor(m,pp,d); if(v>0)parts.push(v+" "+nm+" on "+DT[d]+" "+pp+"s"); }); }); out.push("At least "+parts.join(", ")+"."); });
  return out.join(" "); }
function rulesSet(cyc,rules){   // normalise and store: unknown or repeated tags dropped, empty pieces omitted, an empty block deleted; each part that changed is written down
  const before=rulesOf(cyc), order=tagList(S).map(t=>t.id), needs={}, mins=[];
  Object.keys((rules&&rules.needs)||{}).forEach(z=>{ const ts=(rules.needs[z]||[]).filter((t,i,a)=>order.indexOf(t)>=0&&a.indexOf(t)===i).sort((a,b)=>order.indexOf(a)-order.indexOf(b)); if(ts.length)needs[z]=ts; });
  ((rules&&rules.mins)||[]).forEach(m=>{ if(!m||order.indexOf(m.tag)<0||mins.some(x=>x.tag===m.tag))return; const n={AM:[0,1,2].map(d=>minFor(m,"AM",d)),PM:[0,1,2].map(d=>minFor(m,"PM",d))}; if(n.AM.some(x=>x>0)||n.PM.some(x=>x>0))mins.push({tag:m.tag,n:n}); });
  mins.sort((a,b)=>order.indexOf(a.tag)-order.indexOf(b.tag));
  const out={}; if(Object.keys(needs).length)out.needs=needs; if(mins.length)out.mins=mins;
  if(!cyc.settings)cyc.settings={}; if(Object.keys(out).length)cyc.settings.rules=out; else delete cyc.settings.rules;
  const after=rulesOf(cyc), sum=rulesSummary(cyc,S)||"no rules";
  if(JSON.stringify(before.needs)!==JSON.stringify(after.needs))logAudit("rules.needs",sum,"admin");
  if(JSON.stringify(before.mins)!==JSON.stringify(after.mins))logAudit("rules.mins",sum,"admin");
  save(); return after; }
function rulesSaveFromForm(){ const needs={}, mins={};
  document.querySelectorAll(".rn-cb").forEach(cb=>{ if(!cb.checked)return; (needs[cb.dataset.z]=needs[cb.dataset.z]||[]).push(cb.dataset.t); });
  document.querySelectorAll(".rm-n").forEach(inp=>{ const v=Math.max(0,Math.floor(+inp.value||0)); if(!v)return; const m=mins[inp.dataset.t]=mins[inp.dataset.t]||{tag:inp.dataset.t,n:{AM:[0,0,0],PM:[0,0,0]}}; m.n[inp.dataset.p][+inp.dataset.d]=v; });
  rulesSet(active(),{needs:needs,mins:Object.keys(mins).map(t=>mins[t])}); render(); toastSaved("cycle"); }
function tagsCardHTML(){ const tl=tagList(S);
  const rows=tl.map(t=>{ const n=tagHolders(t.id).length; return `<div class="listrow" data-tag="${t.id}"><input class="t-name" value="${escapeHTML(t.name)}" aria-label="Tag name" style="width:160px"><label><input type="checkbox" class="t-show" ${t.show?"checked":""}> Show on the roster</label><span class="muted small">${n===1?"1 person holds it":n+" people hold it"}</span><span class="grow"></span><button class="btn sm t-who">Who holds this?</button><button class="btn danger sm t-del">Remove</button></div>`; }).join("");
  return `<div class="card" id="card-tags"><h2>Tags</h2>
    <div class="sub">A tag is a label on a person: a grade, a credential, a skill. A cycle\u2019s Rules card can then say a slot needs a tag, or that every AM or PM needs at least so many holders. Tags never leave this group.</div>
    ${rows||'<div class="muted small">No tags yet.</div>'}
    <div class="row" style="margin-top:8px"><label class="field"><span class="lbl">New tag</span><input id="tagNew" placeholder="e.g. Senior" style="width:180px"></label><button class="btn sm" id="tagAdd">Add tag</button></div>
    <div class="muted small" style="margin-top:8px">Hidden means hidden on the screens, not locked away: every member\u2019s app holds the group\u2019s whole record. Tags are for credentials and grades, not for anything confidential.</div></div>`; }
function rulesCardHTML(){ const c=active(), tl=tagList(S), r=rulesOf(c), zs=S.zones||[];
  const body=!tl.length?`<div class="muted small">No tags yet. <a href="#" data-go="setup||card-tags">Add tags under Group</a> first, then set the rules here.</div>`:
   `<div class="sub" style="margin-top:6px">${rulesPresent(c)?escapeHTML(rulesSummary(c,S)):"No rules on this cycle."}</div>
    <h3 style="margin:12px 0 4px;font-size:var(--fs-md)">Slots that need a tag</h3>
    ${zs.map(z=>`<div class="listrow"><span style="min-width:120px">${escapeHTML(z.name)}</span>${tl.map(t=>`<label style="margin-right:10px"><input type="checkbox" class="rn-cb" data-z="${z.id}" data-t="${t.id}" ${(r.needs[z.id]||[]).indexOf(t.id)>=0?"checked":""}> ${escapeHTML(t.name)}</label>`).join("")}</div>`).join("")}
    <h3 style="margin:12px 0 4px;font-size:var(--fs-md)">Minimums</h3>
    <div class="muted small">At least this many holders in each half of the day, across the whole group; the last places are held for them. Blank or 0 means no minimum.</div>
    <div class="gridscroll"><table class="roster"><thead><tr><th class="namecol">Tag</th><th>AM weekday</th><th>AM weekend</th><th>AM public holiday</th><th>PM weekday</th><th>PM weekend</th><th>PM public holiday</th></tr></thead><tbody>
    ${tl.map(t=>{ const m=r.mins.find(x=>x&&x.tag===t.id); return `<tr><td class="namecol">${escapeHTML(t.name)}</td>${["AM","PM"].map(pp=>[0,1,2].map(d=>`<td><input type="number" min="0" class="rm-n" data-t="${t.id}" data-p="${pp}" data-d="${d}" value="${m?(minFor(m,pp,d)||""):""}" style="width:56px" aria-label="${escapeHTML(t.name)} ${pp} ${["weekday","weekend","public holiday"][d]}"></td>`).join("")).join("")}</tr>`; }).join("")}
    </tbody></table></div>
    <div class="flexbtns" style="margin-top:10px"><button class="btn primary" id="rulesSave">Save rules</button></div>`;
  return `<div class="card" id="card-rules">${cycH2("Rules")}<div class="sub">A slot can need a tag, and each AM or PM can need at least so many holders of one. Staff are refused with the reason; an admin can place anyone behind a warning, and a shortfall shows as a gap. Rules apply to this cycle only.</div>${body}</div>`; }
let _tagWhoQ="";
function twListHTML(id){ const q=String(_tagWhoQ||"").toLowerCase();   // the Who-holds checklist for one tag: everyone in the group, filtered by the search, holders ticked
  const people=S.staff.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name))).filter(s=>!q||String(s.name).toLowerCase().indexOf(q)>=0);
  return people.map(s=>`<label class="listrow"><input type="checkbox" class="tw-cb" data-sid="${s.id}" ${hasTag(S,s,id)?"checked":""}> ${escapeHTML(s.name)}</label>`).join("")||'<div class="muted small">Nobody matches.</div>'; }
function twWire(root,id){ root.querySelectorAll(".tw-cb").forEach(cb=>cb.onchange=()=>{ personTagSet(cb.dataset.sid,id,cb.checked); }); }
function openTagWho(id){ const t=tagById(S,id); if(!t)return; const root=document.getElementById("modalRoot");
  openDialog(`<div class="overlay" id="ovlTw"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h3 id="dlgT">Who holds ${escapeHTML(t.name)}?</h3>
    <input type="search" id="twQ" placeholder="Search names" value="${escapeHTML(_tagWhoQ)}" aria-label="Search names" style="width:100%;margin:6px 0">
    <div id="twList" style="max-height:50vh;overflow:auto">${twListHTML(id)}</div>
    <div class="flexbtns" style="margin-top:12px"><span class="grow"></span><button class="btn" id="twDone">Done</button></div></div></div>`);
  root.querySelector("#ovlTw").onclick=e=>{ if(e.target.id==="ovlTw"){ closeModal(); render(); } };
  const qi=root.querySelector("#twQ"); if(qi)qi.oninput=()=>{ _tagWhoQ=qi.value; const l=root.querySelector("#twList"); if(l){ l.innerHTML=twListHTML(id); twWire(root,id); } };   // patch the list only: the search box keeps its node, its caret and its text
  twWire(root,id);
  root.querySelector("#twDone").onclick=()=>{ closeModal(); render(); }; }
function myTagsHTML(s){ const ids=personTags(S,s); if(!ids.length)return ""; return `<div class="muted small" style="margin-top:4px">Your tags: ${ids.map(id=>escapeHTML(tagName(S,id))).join(", ")} \u00b7 set by your admin.</div>`; }
function tagsFromCell(str,made){   // "Senior; Triage-trained" → tag ids in list order; a name the group does not have becomes a new tag, hidden by default, and its name goes onto made
  const ids=[]; String(str||"").split(/[;,]/).map(x=>x.trim().slice(0,40)).filter(Boolean).forEach(name=>{ let t=tagList(S).find(x=>String(x.name).toLowerCase()===name.toLowerCase());   // matched on the name as it will be stored, so a long name never makes a second tag
    if(!t){ t={id:tagNewId(),name:name}; (S.tags=Array.isArray(S.tags)?S.tags:[]).push(t); if(made)made.push(t.name); }
    if(ids.indexOf(t.id)<0)ids.push(t.id); });
  const order=tagList(S).map(t=>t.id); return ids.sort((a,b)=>order.indexOf(a)-order.indexOf(b)); }
function rulesCarry(rules,zones){   // a deep copy for the next cycle, without needs for zones it does not have; undefined when nothing is left
  if(!rules||typeof rules!=="object")return undefined; const c=JSON.parse(JSON.stringify(rules)), ids=(zones||[]).map(z=>z.id);
  if(c.needs){ Object.keys(c.needs).forEach(z=>{ if(ids.indexOf(z)<0||!Array.isArray(c.needs[z])||!c.needs[z].length)delete c.needs[z]; }); if(!Object.keys(c.needs).length)delete c.needs; }
  if(c.mins&&!c.mins.length)delete c.mins;
  return Object.keys(c).length?c:undefined; }
function rulesDropZone(cyc,zoneId){ const r=cyc&&cyc.settings&&cyc.settings.rules; if(!r||!r.needs||!(zoneId in r.needs))return; delete r.needs[zoneId]; if(!Object.keys(r.needs).length)delete r.needs; if(!Object.keys(r).length)delete cyc.settings.rules; }   // a zone that goes takes its rule with it
