"use strict";
// moved from js/admin.js lines 1466-1516 (Phase 1 split, no edits)
function receiptText(r){ if(!r.quota)return `Booked ${r.n} · ${r.booked} this cycle`; if(r.booked>r.quota)return `Over your share — ${r.booked} of ${r.quota} booked.`; if(r.booked===r.quota)return `That's your share — ${r.booked} of ${r.quota} booked.`; return `Booked ${r.n} · ${r.booked} of ${r.quota}`; }   // never asserts more than the numbers show
function hasFeed(sid){ const st=S.staff.find(x=>x.id===sid); return !!(cloudOn()&&st&&st.icsToken); }   // a live calendar feed updates itself — no button needed
function calBtnHTML(sid,id){ return hasFeed(sid)?`<span class="muted small">Your calendar feed has it</span>`:`<button class="btn sm"${id?` id="${id}"`:` data-go="${goStr("my","","calSec")}"`}>Add to calendar</button>`; }
function srFooterHTML(sid,s){   // the basket: stays on screen while there are picks, projects the count after Confirm, goes busy while saving, then hands back a receipt
  if(!_srPick.length){ if(_receipt&&_receipt.sid===sid&&(clinicalCountFor(sid)!==_receipt.booked||(_receipt.cycleId&&_receipt.cycleId!==S.activeId)))_receipt=null;   // the receipt never outlives the count or the cycle it quotes
    if(_receipt&&_receipt.sid===sid)return `<div class="srfoot done" role="status"><span class="rcic" aria-hidden="true">${ic("check")}</span><span class="grow"><b>${receiptText(_receipt)}</b></span>${calBtnHTML(sid,"rcCal")}<button class="btn sm" id="rcDone">Done</button></div>`; return ""; }
  const n=_srPick.length, u=_srPick.reduce((a,k)=>a+pickUnits(k),0), now=clinicalCountFor(sid), q=+s.quota||0;   // picks are actions, units are what they cost — a whole-day pick is two
  if(_inflight.has("srConfirm"))return `<div class="srfoot" aria-busy="true"><span><b>${n} picked</b> · saving…</span><span class="grow"></span><button class="btn sm srClear" disabled>Clear</button><button class="btn primary srConfirm" disabled aria-busy="true">Saving…</button></div>`;
  return `<div class="srfoot"><span><b>${n} picked</b> · ${now} → ${now+u}${q?" of "+q:""} after confirm</span><span class="grow"></span><button class="btn sm srClear">Clear</button><button class="btn primary srConfirm">Confirm ${n} pick${n>1?"s":""}</button></div>`; }
function tsFmt(ts){return new Date(ts).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});}
function viewMessages(){
  const me=S.viewAs, adm=isAdmin(), list=msgsFor(me);
  const sel=(v,cur)=>v===cur?"selected":"";
  const composer=adm
    ? `<div class="row" style="align-items:flex-end">
        <label class="field" style="flex:1;min-width:220px"><span class="lbl">Message</span><textarea id="msgText" rows="3" style="width:100%;font-family:inherit;font-size:var(--fs-md);padding:8px 10px;border:1px solid var(--line2);border-radius:var(--radius-sm)"></textarea></label>
        <label class="field"><span class="lbl">Audience</span><select id="msgTo"><option value="all" ${sel("all",replyTo)}>All staff</option>${S.staff.map(s=>`<option value="${s.id}" ${sel(s.id,replyTo)}>${escapeHTML(s.name)}</option>`).join("")}</select></label>
        <button class="btn primary" id="msgSend">Send to all staff</button></div>`
    : `<div class="row" style="align-items:flex-end">
        <label class="field"><span class="lbl">To</span><select id="msgTo"><option value="admin" ${sel("admin",replyTo)}>Admin</option>${S.staff.filter(x=>x.id!==me).map(s=>`<option value="${s.id}" ${sel(s.id,replyTo)}>${escapeHTML(s.name)}</option>`).join("")}</select></label>
        <label class="field" style="flex:1;min-width:200px"><span class="lbl">Message</span><textarea id="msgText" rows="3" style="width:100%;font-family:inherit;font-size:var(--fs-md);padding:8px 10px;border:1px solid var(--line2);border-radius:var(--radius-sm)"></textarea></label>
        <button class="btn primary" id="msgSend">Send message</button></div>`;
  const items=list.length?list.map(m=>{
    const mine=m.from===me, toLabel=m.to==="all"?"All staff":(m.to==="admin"?"Admin":nameOf(m.to));
    const replyId=m.from==="admin"?"admin":m.from;
    return `<div class="msg ${mine?"mine":""}"><div class="meta"><span><b>${escapeHTML(nameOf(m.from))}</b> → ${escapeHTML(toLabel)}</span><span style="margin-left:auto">${tsFmt(m.ts)}</span></div><div>${escapeHTML(m.text)}</div>${mine?"":`<div style="margin-top:6px"><button class="btn sm" data-reply="${replyId}">Reply</button></div>`}</div>`;
  }).join(""):emptyState(EIC.chat,"No messages yet","Messages with your admin and the team will appear here.");
  return `${pageHead(adm?"Messages &amp; broadcasts":"Messages",adm?"":"Your admin and the group")}<div class="card">
    ${cardTitle(adm?"Messages &amp; broadcasts":"Messages")}
    <div class="sub">${adm?"Broadcast to all staff or message one person. Staff replies appear here too.":"Message admin, or a colleague directly — handy to agree a swap before sending a formal request."}</div>
    ${composer}
    <div style="margin-top:16px">${items}</div>
  </div>`;
}
function notifsSheetHTML(){   // the bell opens this sheet; rows with a target take you to the shift, request or round they mention
  const me=S.viewAs, list=notifFor(me).slice().sort((a,b)=>(b.ts||0)-(a.ts||0));   // merge order is not time order
  const today=iso(new Date()), yday=iso(new Date(Date.now()-864e5)); let lastGrp=null;
  const items=list.length?list.map(n=>{
    const read=notifRead(n,me), dk=iso(new Date(n.ts)), grp=dk===today?"Today":(dk===yday?"Yesterday":"Earlier");
    const when=dk===today?new Date(n.ts).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):fmt(new Date(n.ts),{weekday:"short",day:"numeric",month:"short"});
    const kind=n.go?(n.go.anchor==="openshifts"||n.go.anchor==="marketCard"?"live":(n.go.tab==="requests"?"check":(n.go.tab==="selfroster"||n.go.tab==="my"?"cal":(n.go.tab==="messages"?"chat":"bell")))):"bell";
    const body=`<span class="nicon" aria-hidden="true">${ic(kind)}</span><div class="grow"><div class="nt">${escapeHTML(n.text)}</div><div class="muted small">${when}</div></div>`;
    const lbl=grp!==lastGrp?`<div class="sheetlbl">${grp}</div>`:""; lastGrp=grp;
    return lbl+(n.go?`<button class="notif act ${read?"read":""}" data-go="${escapeHTML(goStr(n.go.tab,n.go.cycle,n.go.anchor))}">${body}<span class="chev">${ic("chevR")}</span></button>`:`<div class="notif ${read?"read":""}">${body}</div>`);
  }).join(""):(whatsNewDue()?"":emptyState(EIC.bell,"You're all caught up","Approvals, roster changes and alerts will appear here."));
  const wn=whatsNewDue()?`<div class="sheetlbl">New in Myrosta</div><button class="notif act" data-go="${goStr("help","","whatsnew")}"><span class="nicon brand" aria-hidden="true">${markSVG("")}</span><div class="grow"><div class="nt">What's new in Myrosta · ${escapeHTML(WHATS_NEW[0].title)}</div><div class="muted small">${WHATS_NEW[0].lines.length} changes · build ${fmtBuild(BUILD)}</div></div><span class="chev">${ic("chevR")}</span></button>`:"";
  return `<div class="overlay sheetwrap" id="ovlNotifs"><div class="sheet" role="dialog" aria-modal="true" aria-label="Notifications"><div class="sheetgrab"></div>
    <div class="sheethd"><h2 style="font-size:var(--fs-lg)">Notifications</h2><span class="grow"></span>${unreadCount(me)?`<button class="btn sm" id="notifsRead">Mark all read</button>`:""}</div>${wn}${items}</div></div>`;
}
function viewNotifs(){ return viewMy(); }   // "notifs" is no longer a tab (render() normalises it to "my" before the chrome is built)

