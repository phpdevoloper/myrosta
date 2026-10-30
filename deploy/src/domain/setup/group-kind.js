"use strict";

/* ---------- "What kind of group is this?" — six presets that SEED a fresh group's answers. A preset seeds; an admin decides: nothing here calls markAnswered, and the audit action matches no checklist trigger. ---------- */
const GROUP_KINDS=[
  {key:"consultants",label:"Consultants",noun:"consultant",zones:["Resus","Acute","Fast track","Paeds"],cover:[3,4],mode:"rounds",fairness:"snake",cst:true,rosteron:true,perFortnight:5,desc:"Resus, Acute, Fast track, Paeds · 3–4 on each shift · rounds"},
  {key:"nurses",label:"Nurses",noun:"nurse",zones:["Triage","Staff nurse 1","Staff nurse 2","Staff nurse 3"],cover:[2,4],mode:"rounds",fairness:"guarded",cst:false,rosteron:false,perFortnight:10,desc:"Triage and three staff-nurse slots · 2–4 on each shift · rounds"},
  {key:"jmo",label:"Junior doctors",noun:"junior doctor",zones:["Resus","Acute","Fast track","Paeds"],cover:[2,3],mode:"rounds",fairness:"guarded",cst:false,rosteron:false,perFortnight:10,desc:"Resus, Acute, Fast track, Paeds · 2–3 on each shift · rounds"},
  {key:"scribes",label:"Scribes",noun:"scribe",zones:["Scribe 1","Scribe 2"],cover:[1,2],mode:"rolling",fairness:"guarded",cst:false,rosteron:false,perFortnight:10,desc:"Two scribe slots · 1–2 on each shift · rolling, always live"},
  {key:"clerical",label:"Clerical/admin",noun:"clerk",zones:["Front desk","Back office"],cover:[1,2],mode:"rolling",fairness:"guarded",cst:false,rosteron:false,perFortnight:10,desc:"Front desk, Back office · 1–2 on each shift · rolling, always live"},
  {key:"other",label:"Something else",noun:"",zones:["Resus","Acute","Fast track","Paeds"],cover:[3,4],mode:"rounds",fairness:"snake",cst:true,rosteron:true,perFortnight:5,desc:"Keeps the defaults · you type what the people are called"}
];   // every max fits its zone count: the engine caps a period at its zones, so a preset never promises cover the roster cannot book
function groupKind(){ const k=cset().preset; return k?(GROUP_KINDS.find(g=>g.key===k)||null):null; }                                                   // the preset this cycle was seeded from, if any
function kindZoneNames(){ const k=groupKind(); return (k?k.zones:defaultZones().map(z=>z.name)).map(n=>n.toUpperCase()); }                              // what "zones untouched" means for the checklist
function groupIsFresh(){ return S.staff.length===0 && !(S.branding&&S.branding.name) && !Object.keys(cset().answered||{}).length; }                     // a person, a name or one answered question closes the kind card — the pilot never sees it
function staffDefaults(){ const k=groupKind(); if(!k)return {quota:20,hrsFortnight:76}; const fns=Math.max(1,Math.round((active().cycle.weeks||8)/2)); return {quota:k.perFortnight*fns,hrsFortnight:76}; }   // Add staff and the imports: shifts per fortnight × fortnights in this cycle; no preset = today's 20 / 76 exactly
function applyGroupKind(key){ const k=GROUP_KINDS.find(g=>g.key===key); if(!k||!groupIsFresh())return false;   // only while the group is empty — a re-seed with people on the roster would orphan their zones
  const c=cset(); if(!S.branding)S.branding={}; if(!S.features)S.features={};
  if(k.noun)S.branding.roleNoun=k.noun; else delete S.branding.roleNoun;                                                   // Something else hands the noun back to the admin
  const zs=k.zones.map(n=>({id:slug(n),name:n,am:true,pm:true,pmLabel:""})); c.zones=zs; S.zones=zs;                         // one shared reference, as the zone editor keeps it
  const st={amMin:k.cover[0],amMax:k.cover[1],pmMin:k.cover[0],pmMax:k.cover[1]}; c.staffing={...st}; S.staffing={...st};
  c.rosterMode=k.mode; S.rosterMode=k.mode; c.fairness=k.fairness; S.fairness=k.fairness;
  if(k.cst)delete S.features.cst; else S.features.cst=false; if(k.rosteron)delete S.features.rosteron; else S.features.rosteron=false;
  c.preset=k.key; hydrateCycleSettings();
  logAudit("settings.preset",k.label+" preset · "+cyLabel(active()),"admin"); save();
  toast(k.key==="other"?"Defaults kept — now say what the people are called.":(k.label+": "+k.zones.join(", ")+" · "+k.cover[0]+"–"+k.cover[1]+" on each shift · "+(k.mode==="rolling"?"rolling":"rounds")+". Change any of it below."),"ok");
  return true; }
function groupKindCardHTML(){ const cur=cset().preset||"";
  return `<div class="card" id="card-kind"><h2>What kind of group is this?</h2><div class="sub">One tap fills in what the people are called, the zones, the cover and how the roster runs — a starting point you can change below, or swap for another kind. The checklist ticks only what you confirm.</div>
    <div class="kindgrid" role="group" aria-label="What kind of group is this?">${GROUP_KINDS.map(k=>`<button type="button" class="kind${cur===k.key?" on":""}" data-gkind="${k.key}" aria-pressed="${cur===k.key?"true":"false"}"><b>${k.label}</b><span class="kd">${k.desc}</span></button>`).join("")}</div></div>`; }
function applyBranding(){ try{ const pre=cloudOn()&&authState!=="in", b=pre?{}:(S.branding||{});   // one Myrosta teal for every group: identity comes from the hospital and group names, never a per-group accent (a stored branding.primary is ignored)
  const hosp=b.hospital||(pre?"":_orgHospital)||"", grp=b.name||(pre?"":_orgLabel)||"";   // the masthead: the hospital as the eyebrow, the staff group as the name; the wordmark only when neither is known, and always until a sign-in has resolved its group (the door, the cold load, the picker): the copy cached on a multi-group device belongs to whichever group was last open here
  const eb=document.getElementById("brandEyebrow"), nm=document.getElementById("brandName");
  if(eb){ eb.textContent=hosp||"Myrosta"; eb.style.display=(hosp||grp)?"":"none"; }
  if(nm){ const main=grp||hosp; if(main){ nm.textContent=main; nm.classList.add("custom"); } else { nm.innerHTML='Myr<span class="accent">o</span>sta'; nm.classList.remove("custom"); } }
  const lg=document.getElementById("brandLogo"), mk=document.getElementById("brandMark");   // a group's own logo replaces the mark in the header; nowhere else (print, share and the door keep Myrosta's)
  if(lg&&mk){ if(logoOK(b.logo)){ if(lg.getAttribute("src")!==b.logo)lg.setAttribute("src",b.logo); lg.style.display=""; mk.style.display="none"; } else { lg.removeAttribute("src"); lg.style.display="none"; mk.style.display=""; } }
  document.title=(grp?grp+" · ":"")+(hosp?hosp+" · ":"")+"Myrosta"; }catch(e){} }
function logoOK(u){ return typeof u==="string" && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(u) && u.length<=LOGO_MAX; }   // the blob is shared by every device: only a small inline image, never a URL
const LOGO_MAX=60000;   // ~45 KB — the logo travels with every sync of the roster
function logoFileCheck(f){ if(!f)return "Choose an image file."; if(!/^image\//.test(f.type||""))return "Choose an image file — PNG, JPG or SVG."; if(f.size>8*1024*1024)return "That image is over 8 MB — pick a smaller one."; return ""; }
function logoDataURL(file){ return new Promise((res,rej)=>{ const bad=logoFileCheck(file); if(bad)return rej(new Error(bad));
  const url=URL.createObjectURL(file), im=new Image();
  im.onload=()=>{ try{ const H=64, W=Math.min(256,Math.max(1,Math.round(im.width*H/im.height))), h=Math.round(im.height*W/im.width);   // 64px tall (twice the header's 28–32px) and at most 256 wide
      const c=document.createElement("canvas"); c.width=W; c.height=h; c.getContext("2d").drawImage(im,0,0,W,h);
      let out=c.toDataURL("image/png");
      if(out.length>LOGO_MAX){ const g=c.getContext("2d"); g.globalCompositeOperation="destination-over"; g.fillStyle="#fff"; g.fillRect(0,0,W,h); out=c.toDataURL("image/jpeg",0.85); }   // a photo-like image: JPEG on white
      URL.revokeObjectURL(url); if(out.length>LOGO_MAX)return rej(new Error("That image is too detailed to keep small — try a simpler logo.")); res(out); }catch(e){ rej(new Error("That image couldn't be read.")); } };
  im.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error("That image couldn't be read.")); }; im.src=url; }); }
