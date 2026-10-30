"use strict";
// moved from js/roster.js lines 1219-1252 (Phase 1 split, no edits)
/* ----- request threads (query + comments before a decision) ----- */
function reqKindLabel(r){ return r.type==="swap"?"swap":r.type==="fixed"?"pattern":"leave"; }
function reqThread(reqId){ return (S.reqComments||[]).filter(c=>c.reqId===reqId).sort((a,b)=>a.ts-b.ts); }
function addReqComment(reqId,text){
  const r=S.requests.find(x=>x.id===reqId); if(!r){toast("Request gone.");return false;}
  if(!["pending","info","awaiting-peer"].includes(r.status)){toast("This request is decided — the conversation is closed.");return false;}
  const me=S.viewAs;
  if(!(isAdmin()||r.from===me||(r.type==="swap"&&r.peerId===me))){toast("Not your request.","danger");return false;}
  const t=String(text||"").trim(); if(!t){toast("Write a comment first.");return false;}
  (S.reqComments=S.reqComments||[]).push({id:"rc"+Date.now()+Math.random().toString(36).slice(2,5),reqId:reqId,by:isAdmin()?"admin":me,text:t.slice(0,500),ts:Date.now()});
  if(isAdmin()){ notify(r.from,"Admin commented on your "+reqKindLabel(r)+" request: "+t.slice(0,80),null,{tab:"requests"}); }
  else{ if(r.status==="info")r.status="pending";   // their answer puts it back in the admin's court
        notify("admin",nameOf(me)+" replied on their "+reqKindLabel(r)+" request: "+t.slice(0,80),null,{tab:"requests"}); }
  save(); render(); return true;
}
function askReqInfo(reqId,text){
  if(!isAdmin())return false;
  const r=S.requests.find(x=>x.id===reqId); if(!r||r.status!=="pending"){toast("Only pending requests can be queried.");return false;}
  const t=String(text||"").trim(); if(!t){toast("Type your question in the comment box first, then tap Ask.");return false;}
  (S.reqComments=S.reqComments||[]).push({id:"rc"+Date.now()+Math.random().toString(36).slice(2,5),reqId:reqId,by:"admin",text:t.slice(0,500),ts:Date.now()});
  r.status="info";
  notify(r.from,"Your "+reqKindLabel(r)+" request needs more info — see Requests: "+t.slice(0,80),null,{tab:"requests"});
  logAudit("request.query",nameOf(r.from)+" · "+t.slice(0,60),"admin");
  save(); render();
  if(S.pushOn&&cloudOn()&&CLOUD.vapidPublic){ try{ pushSendEvent("Question about your request",t.slice(0,120),[r.from],"rq-"+reqId); }catch(e){} }
  return true;
}
function reqThreadHTML(r,editable){
  const th=reqThread(r.id);
  const rows=th.map(c=>'<div class="rcrow'+(c.by==="admin"?" adm":"")+'"><b>'+escapeHTML(c.by==="admin"?"Admin":nameOf(c.by))+'</b> <span class="muted small">'+tsFmt(c.ts)+'</span><div>'+escapeHTML(c.text)+'</div></div>').join("");
  const box=editable?('<div class="row" style="margin-top:6px"><div class="field grow"><input id="rc-'+r.id+'" placeholder="Reply to the admin…" maxlength="500"></div><button class="btn sm" data-rcadd="'+r.id+'">Send</button></div>'):"";
  if(!rows&&!box)return "";
  return '<div class="rcthread">'+(rows?('<div class="sub" style="margin:6px 0 2px"><b>Conversation</b></div>'+rows):"")+box+'</div>';
}
