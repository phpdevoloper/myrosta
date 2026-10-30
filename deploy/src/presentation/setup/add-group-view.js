"use strict";
// moved from js/admin.js lines 1397-1427 (Phase 1 split, no edits)
/* ---------- add a staff group in-app: one database function makes the registry row, the empty record and the admins; the new group opens on a reload ---------- */
const GROUP_NOUNS=["consultant","doctor","junior doctor","registrar","intern","nurse","midwife","scribe","clerk","paramedic","pharmacist","radiographer","technician","staff member"];
function canAddGroup(){ return cloudOn()&&authState==="in"&&_realAdmin&&!!_orgHospitalId; }
function addGroupHTML(err){ return `<div class="overlay" id="ovlAg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="agT"><h3 id="agT">Add a staff group</h3>
    <div class="sub">A new roster at ${escapeHTML(_orgHospital||"this hospital")}, beside ${escapeHTML(groupName()||"this group")}. You become its admin. It starts empty; the next screen asks what kind of group it is.</div>
    <label class="field" style="display:block;margin-top:10px"><span class="lbl">Group name</span><input id="agName" maxlength="40" placeholder="e.g. Nurses" style="width:100%"></label>
    <label class="field" style="display:block;margin-top:8px"><span class="lbl">What are its people called? <span class="muted">(singular)</span></span><input id="agNoun" list="agRoles" maxlength="30" placeholder="nurse" style="width:100%"><datalist id="agRoles">${GROUP_NOUNS.map(r=>`<option value="${r}">`).join("")}</datalist></label>
    <label class="field" style="display:block;margin-top:8px"><span class="lbl">Second admin's email <span class="muted">(optional)</span></span><input id="agAdmin2" type="email" placeholder="name@hospital.org.au" style="width:100%"></label>
    ${err?`<div class="note" style="margin-top:8px">${escapeHTML(err)}</div>`:""}
    <div class="flexbtns" style="margin-top:12px"><button class="btn primary" id="agCreate">Create the group</button><button class="btn" id="agCancel">Cancel</button></div></div></div>`; }
function openAddGroup(err,vals){ openDialog(addGroupHTML(err),{focus:"#agName"}); const v=vals||{}; ["agName","agNoun","agAdmin2"].forEach(id=>{ const el=document.getElementById(id); if(el&&v[id]!=null)el.value=v[id]; }); wireAddGroup(); }
function wireAddGroup(){ const nm=document.getElementById("agName"), cr=document.getElementById("agCreate"), cc=document.getElementById("agCancel"), ov=document.getElementById("ovlAg");
  const vals=()=>({agName:(document.getElementById("agName")||{}).value||"",agNoun:(document.getElementById("agNoun")||{}).value||"",agAdmin2:(document.getElementById("agAdmin2")||{}).value||""});
  if(nm&&cr)nm.oninput=()=>{ cr.textContent="Create "+(nm.value.trim()||"the group"); };
  if(cc)cc.onclick=closeModal; if(ov)ov.onclick=e=>{ if(e&&e.target===ov)closeModal(); };
  if(cr)cr.onclick=()=>{ const v=vals(), r=createGroup(v.agName,v.agNoun,v.agAdmin2); if(!r.ok)openAddGroup(r.reason,v); else { cr.disabled=true; cr.textContent="Creating\u2026"; } }; }
function groupCheck(name,noun,admin2){ const n=String(name||"").trim().slice(0,40), r=String(noun||"").trim().toLowerCase().slice(0,30), a=String(admin2||"").trim().toLowerCase();
  if(!canAddGroup())return {ok:false,reason:_realAdmin?"This group isn't under a hospital yet \u2014 ask Myrosta support.":"Only an admin can add a group."};
  if(!n)return {ok:false,reason:"A group needs a name."};
  if(a&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a))return {ok:false,reason:"That second admin's email doesn't look right."};
  return {ok:true,name:n,noun:r,admin2:a}; }
function createGroup(name,noun,admin2){ const c=groupCheck(name,noun,admin2); if(!c.ok)return c; if(!_sb)return {ok:false,reason:"Couldn't reach the server \u2014 try again."};
  let p=null; try{ p=_sb.rpc("create_group",{p_sibling_org:_org,p_label:c.name,p_noun:c.noun,p_admin2_email:c.admin2||null}); }catch(e){ return {ok:false,reason:"Couldn't reach the server \u2014 try again."}; }
  Promise.resolve(p).then(r=>{ if(!r||r.error||!r.data){ openAddGroup(groupErrText(r&&r.error),{agName:c.name,agNoun:c.noun,agAdmin2:c.admin2}); return; } groupCreated(String(r.data),c.name,c.noun); }).catch(()=>openAddGroup("Couldn't reach the server \u2014 try again.",{agName:c.name,agNoun:c.noun,agAdmin2:c.admin2}));
  return {ok:true,name:c.name}; }
function groupErrText(e){ const m=String((e&&e.message)||""); if(/admin/i.test(m))return "Only an admin can add a group."; if(/needs a name/i.test(m))return "A group needs a name."; if(/hospital/i.test(m))return "This group isn't under a hospital yet \u2014 ask Myrosta support."; return "Couldn't reach the server \u2014 try again."; }
function groupCreated(orgId,name,noun){ try{ localStorage.setItem("myrosta_org",orgId); localStorage.setItem("myrosta_newgroup",JSON.stringify({org:orgId,name:name,noun:noun,ts:Date.now()})); }catch(e){} location.reload(); }   // the reload is the existing switch path: no cache can bleed between groups
function groupFirstLoad(){ let m=null; try{ m=JSON.parse(localStorage.getItem("myrosta_newgroup")||"null"); }catch(e){} if(!m||m.org!==_org)return false;   // the group this device just made, on its first load only
  try{ localStorage.removeItem("myrosta_newgroup"); }catch(e){} if(!groupIsFresh())return false;
  if(!S.branding)S.branding={}; if(m.noun)S.branding.roleNoun=String(m.noun).slice(0,30);   // the name comes from the registry label (groupName() falls back to _orgLabel); setting it here would close the kind card
  logAudit("group.create",(m.name||"")+(m.noun?" \u00b7 staff = "+m.noun:""),"admin"); return true; }
