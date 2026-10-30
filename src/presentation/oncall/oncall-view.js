"use strict";
// moved from js/admin.js lines 1428-1465 (Phase 1 split, no edits)
function ocMark(cyc,sid,isoD,mini){ const ws=ocTakenBy(cyc,sid,isoD); if(!ws.length)return "";
  return `<span class="tag oc${mini?" mini":""}" title="${escapeHTML("On call "+ws.map(w=>w.label+" "+ocTime(w)).join(" · "))}">${escapeHTML(mini?"OC":ws.map(w=>w.label).join(" · "))}</span>`; }
function ocLine(cyc,sid,isoD){ const ws=ocTakenBy(cyc,sid,isoD); if(!ws.length)return "";
  return ws.map(w=>w.label+" "+ocTime(w)).join(" · "); }
function ocSheetHTML(cyc,sid,isoD,adm,canPick){
  const ws=ocTakenWindows(cyc).filter(w=>!ocChosen(w)), ci=ciSheetRows(cyc,sid,isoD,adm); if(!ws.length&&!ci)return "";
  const past=isRolling(cyc)&&isoD<iso(new Date()), gate=bookingGate(cyc).ok, onLeave=getShift(sid,isoD).kind==="leave", notice=inNotice(isoD,cyc);
  const rows=ws.map(w=>{ const k=ocKey(isoD,w.id), holder=ocHolder(cyc,isoD,w.id), mine=holder===sid;
    const may=adm||(w.book!==false&&gate&&canPick&&!past), mayDrop=adm||(may&&!notice);
    let ctl;
    if(mine)ctl=mayDrop?`<button class="btn" data-ocdrop="${k}">Come off it</button>`:`<span class="tag ok">yours</span>${may?`<span class="muted small">inside the notice period \u2014 ask your admin</span>`:""}`;
    else if(holder)ctl=`<span class="muted small">${escapeHTML(shortNm(S.staff.find(x=>x.id===holder)||{name:"Someone"}))}</span>`;
    else if(onLeave)ctl=`<span class="muted small">on leave that day</span>`;
    else ctl=may?`<button class="btn" data-octake="${k}">Take it</button>`:`<span class="muted small">nobody yet</span>`;
    return `<div class="listrow"><span class="grow"><b>${escapeHTML(w.label)}</b> <span class="muted small">${ocTime(w)}</span></span>${ctl}</div>`; }).join("");
  return `<div class="sub" style="margin-top:14px"><b>On call</b> \u00b7 ${ws.length?"carrying a window isn\u2019t a shift: it takes no zone and counts as nobody\u2019s cover, so you can hold one on a day you also work.":"a call-in is logged once you\u2019ve been called in, with the hours you worked. It takes no zone and isn\u2019t counted as cover."}</div><div class="daylist">${rows}${ci}</div>`; }
function ciTimesHTML(w){ return `<input type="time" class="ci-from" value="${escapeHTML(_ciForm.start)}" aria-label="${escapeHTML(w.label)}: called in from"> <span class="muted small">to</span> <input type="time" class="ci-to" value="${escapeHTML(_ciForm.end)}" aria-label="${escapeHTML(w.label)}: until">`; }   // the From and To boxes of the open call-in form, shared by the day sheet and the cell dialog
function ciOpenForm(k){ const p=ciParse(k), c=active(), w=p&&ocWindow(c,p.win); if(!w)return false;
  const ci=ciGet(c,p.d,p.win,p.sid); _ciForm=Object.assign({k:k},ci?{start:ci.start,end:ci.end}:ciDefaults(w,p.d)); return true; }   // opens the form on a call-in's own hours, or on the defaults for a new one
function ciSaveForm(k,start,end){ const p=ciParse(k); if(!p)return false;
  if(_ciForm&&_ciForm.k===k){ _ciForm.start=start; _ciForm.end=end; }   // a refused save keeps what was typed
  if(!ciSave(p.sid,p.d,p.win,start,end))return false; _ciForm=null; return true; }
function ciSheetRows(cyc,sid,isoD,adm){   // the day sheet's call-in rows: log one once called in, change or remove it, and see who else was called in that day
  const cw=ocTakenWindows(cyc).filter(ocChosen); if(!cw.length)return "";
  const day=ciOnTime(isoD), live=cyc.status!=="draft"&&!cyc.archived, onLeave=getShift(sid,isoD).kind==="leave", all=ciOnDay(cyc,isoD);
  return cw.map(w=>{ const k=ciKey(isoD,w.id,sid), mine=ciGet(cyc,isoD,w.id,sid), may=adm||(w.book!==false&&live&&day&&sid===S.viewAs), mayRemove=adm||(day&&sid===S.viewAs), form=!!(_ciForm&&_ciForm.k===k&&may);
    const others=all.filter(x=>x.w.id===w.id&&x.sid!==sid).map(x=>escapeHTML(shortNm(S.staff.find(p=>p.id===x.sid)||{name:"Someone"}))+" "+ocTime(x.w)).join(" \u00b7 ");
    let ctl;
    if(form)ctl=ciTimesHTML(w)+`<button class="btn primary" data-cisave="${k}">Save</button><button class="btn" data-cicancel="${k}">Cancel</button>`;
    else if(mine)ctl=`<span class="tag oc">Called in ${ocTime(mine)}</span>${may?`<button class="btn" data-ciopen="${k}">Change</button>`:""} ${mayRemove?`<button class="btn" data-cidel="${k}">Remove</button>`:""} `;
    else if(onLeave)ctl=`<span class="muted small">on leave that day</span>`;
    else ctl=may?`<button class="btn" data-ciopen="${k}">I was called in</button>`:`<span class="muted small">${live?"logged on the day you\u2019re called in":"not open yet"}</span>`;
    return `<div class="listrow cirow"><span class="grow"><b>${escapeHTML(w.label)}</b> <span class="muted small">${escapeHTML(ocWhenText(w))}</span>${others?`<div class="muted small">${others}</div>`:""}</span>${ctl}</div>`; }).join(""); }
function ciModalRowHTML(cyc,sid,isoD,w){   // the cell dialog's call-in row: an admin adds, changes or removes one for anyone, on any day
  const k=ciKey(isoD,w.id,sid), ci=ciGet(cyc,isoD,w.id,sid), form=!!(_ciForm&&_ciForm.k===k);
  const ctl=form?ciTimesHTML(w)+`<button class="btn primary sm" data-mcisave="${k}">Save</button><button class="btn sm" data-mcicancel="${k}">Cancel</button>`
    :(ci?`<span class="tag oc">Called in ${ocTime(ci)}</span><button class="btn sm" data-mciopen="${k}">Change</button><button class="btn sm" data-mcidel="${k}">Remove</button>`:`<button class="btn sm" data-mciopen="${k}">Add a call-in</button>`);
  return `<div class="listrow cirow"><span class="grow"><b>${escapeHTML(w.label)}</b> <span class="muted small">${escapeHTML(ocWhenText(w))}</span></span>${ctl}</div>`; }
