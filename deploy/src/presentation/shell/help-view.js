"use strict";
// moved from js/admin.js lines 2565-2648 (Phase 1 split, no edits)
let _fbMood="", _fbCat=""; const MOODLBL={good:"🙂",ok:"😐",bad:"🙁"};
function openFeedback(){
  _fbMood=""; _fbCat="";
  const root=document.getElementById("modalRoot");
  openDialog(`<div class="overlay" id="ovlFb"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlgT">
    <h3 id="dlgT">Share feedback</h3>
    <div class="muted small" style="margin-bottom:12px">Goes straight to your roster admin — a bug, an idea, or something confusing.</div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="fbm" data-mood="good">🙂 Good</button>
      <button class="fbm" data-mood="ok">😐 Okay</button>
      <button class="fbm" data-mood="bad">🙁 Struggling</button>
    </div>
    <div class="seg" id="fbCat" style="margin:0 0 10px"><button data-cat="bug">Bug</button><button data-cat="idea">Idea</button><button data-cat="confusing">Confusing</button><button data-cat="like">Like</button></div>
    <textarea id="fbText" rows="4" placeholder="What's on your mind?" style="width:100%;box-sizing:border-box;font-family:inherit;font-size:var(--fs-md);padding:9px 11px;border:1px solid var(--line2);border-radius:var(--radius-sm)"></textarea>
    <div class="flexbtns" style="margin-top:14px;align-items:center"><span class="grow"></span><button class="btn" id="fbCancel">Cancel</button><button class="btn primary" id="fbSend">Send feedback</button></div>
  </div></div>`,{focus:"#fbText"});
  root.querySelectorAll(".fbm").forEach(b=>b.onclick=()=>{_fbMood=b.dataset.mood;root.querySelectorAll(".fbm").forEach(x=>x.classList.toggle("on",x===b));});
  root.querySelectorAll("#fbCat button").forEach(b=>b.onclick=()=>{_fbCat=b.dataset.cat;root.querySelectorAll("#fbCat button").forEach(x=>x.classList.toggle("on",x===b));});
  const ov=root.querySelector("#ovlFb"); if(ov)ov.onclick=e=>{if(e.target.id==="ovlFb")closeModal();};
  const cb=root.querySelector("#fbCancel"); if(cb)cb.onclick=closeModal;
  const ta=root.querySelector("#fbText"); if(ta)ta.focus();
  root.querySelector("#fbSend").onclick=()=>{
    const txt=(document.getElementById("fbText").value||"").trim();
    if(!_fbMood&&!_fbCat&&!txt){toast("Add a note, mood, or category first.");return;}
    S.feedback.unshift({id:"fb"+Date.now()+Math.random().toString(36).slice(2,5),ts:Date.now(),from:S.viewAs,name:nameOf(S.viewAs),mood:_fbMood,category:_fbCat,text:txt,tab:_lastTab||S.tab,reviewed:false});
    notify("admin","Feedback from "+nameOf(S.viewAs)+(_fbCat?" ("+_fbCat+")":"")+(txt?": "+txt.slice(0,70):""));
    logAudit("feedback",(_fbCat||"note")+(txt?" · "+txt.slice(0,70):""),S.viewAs);
    save(); closeModal(); render(); toast("Thanks — your feedback was sent to the roster admin.","ok");
  };
}
function viewHelp(){
  const adm=isAdmin();
  const faq=(q,a)=>`<details class="hd"><summary>${q}</summary><div class="ha">${a}</div></details>`;
  const step=(n,t,d)=>`<div class="hstep"><div class="hnum">${n}</div><div><b>${t}</b><div class="muted small">${d}</div></div></div>`;
  return `<div class="card">
    <h2>Help &amp; guide</h2>
    <div class="sub">Everything you need to use Myrosta.${adm?" The admin section is at the bottom.":" Tap any question to expand it."}</div>
    <div class="fbprompt"><span><b>How's Myrosta working for you?</b> A bug, an idea, or something confusing — tell us.</span><button class="btn primary sm" id="fbOpen" style="flex:none">${ic("chat")} Send feedback</button></div>
    ${inDemo()?"":`<div class="fbprompt"><span><b>Showing Myrosta to another department?</b> The demo is this app with made-up staff — send it, with the walkthrough link.</span><button class="btn sm" id="shareDemo" style="flex:none">${ic("arrowUR")} Share the demo</button></div>`}
    ${(cloudOn()&&!inDemo())?(()=>{ const vids=videoList(adm?"admin":"staff",rosterMode(),videoFeats(),adm); return vids.length?`<h3 class="hsec" id="videos">Watch how it works</h3>
    <div class="sub">Short recordings of this app, chapter by chapter, for your role${adm?"":" and your group’s settings"}. Tap one to watch it here; the whole film is first.</div>${(instantBookOn()&&isRolling())?`<div class="muted small" style="margin:-4px 0 8px">In this group a tap books the shift at once \u2014 the film\u2019s Confirm step doesn\u2019t apply here.</div>`:""}
    <div class="vids">${vidGrid(vids,adm)}</div>${adm?`<h3 class="hsec">What your staff see</h3>
    <div class="sub">The staff film in this group’s roster mode and the chapters a staff member sees under Help. A module marked “not switched on” stays hidden from them until you switch it on.</div>
    <div class="vids">${vidGrid(videoList("staff",rosterMode(),videoFeats(),true),true)}</div><h3 class="hsec">For your director</h3>
    <div class="sub">A two-minute cut for someone who will not run the roster: the Day board, the fairness table, the whole department and the audit log.</div>
    <div class="vids">${vidGrid(videoList("director",rosterMode(),videoFeats(),true),true)}</div>`:""}`:""; })():""}
    <h3 class="hsec">Getting started</h3>
    ${step("1","Sign in","Choose Mobile (SMS) or Email, enter it, and type the 6‑digit code. You stay signed in on the device — no password.")}
    ${step("2","See your shifts","‘My shifts’ shows only your own — list or month. Tap ‘Add to calendar’ to push them, with reminders, to your phone.")}
    ${instantBookOn()?step("3","Pick your shifts","When a round opens, go to ‘Book shifts’ and tap a day. Free zones say Open; taken ones show who has them. Tap a zone and it is yours at once — the first tap wins, so there is nothing to confirm; if a colleague got there first, you're told straight away. No two people can hold the same slot."):step("3","Pick your shifts","When a round opens, go to ‘Book shifts’ and tap a day. Free zones say Open; taken ones show who has them. Picks sit in a basket on your phone until you press Confirm — then they are checked against the live roster in one go. The first to confirm gets a slot; if a colleague got there first, you're told which pick didn't go in and why. No two people can hold the same slot.")}
    ${step("4","Leave &amp; swaps","‘Requests’ → request leave or a swap. The admin approves with context and the roster updates automatically.")}
    ${step("5","Put it on your Home Screen","On an iPhone: tap Share, then Add to Home Screen. It opens like an app, stays signed in, and your next shift is one tap away.")}
    <h3 class="hsec" id="whatsnew">What's new</h3>
    ${WHATS_NEW.map(e=>`<div class="wnew"><div class="muted small">${fmtBuild(e.on)}</div><b>${escapeHTML(e.title)}</b><ul>${e.lines.map(l=>`<li>${escapeHTML(l)}</li>`).join("")}</ul></div>`).join("")}
    <h3 class="hsec">Common questions</h3>
    ${faq("I didn’t get my sign‑in code","Check junk/spam, tap Resend, and make sure your admin has the right mobile/email on file. Hospital email blocking it? Use Mobile (SMS).")}
    ${faq("Do I have to sign in every time?","No — you stay signed in on each device. Signing out is the only thing that ends it (and takes you back to the home page).")}
    ${faq("Can two of us book the same shift?","No. The moment someone takes a slot it disappears for everyone else — it’s collision‑proof.")}
    ${faq("Am I disadvantaged if I book last?","No. Per‑fortnight quotas and fairness rules keep it even, whatever order people book in.")}
    ${faq("The roster is live all the time — when can I book?","If your group runs a <b>rolling</b> roster, the roster goes live once and stays live: add or drop your shifts whenever you need to, right through the cycle, within your quota. You can't change a day that has already passed. If your admin has set a booking window you'll see the dates on the Book shifts tab.<br><br>If your group runs <b>rounds</b>, booking is open only between the dates your admin sets — you'll get a notification when it opens and a reminder before it closes.")}
    ${faq("I booked the wrong shift","While the round is open, tap the day, choose ‘Remove this shift’, then pick the right one. If it’s closed, message your admin.")}
    ${faq("My fixed pattern is wrong","If it’s locked, use ‘Send pattern change for approval’ — it goes to the admin rather than changing silently.")}
    ${faq("The admin asked a question about my request","Open Requests — it shows <b>needs your reply</b>. Type your answer in the box under it and Send: the request goes straight back to the admin, and the whole conversation stays on the request.")}
    ${S.marketOn?faq("Swap or Open shift — which do I use?","A <b>swap</b> is a two‑way trade, with a named colleague or with whoever answers <b>Ask everyone</b> — each of you works the other\u2019s shift, and every offer says what it counts (Requests → swap). The <b>open‑shift marketplace</b> is one‑way and goes to everyone: a shift is broadcast, the first eligible person claims it. Use a swap when you can work, just not <i>that</i> day. Use <b>Offer to group</b> (My shifts) when you can’t do the shift at all — and after a give‑away, book another day to square your quota (the quota pills show the gap)."):""}
    ${S.marketOn&&S.pushOn?faq("How do phone alerts work?","On My shifts tap <b>Get open‑shift alerts on this phone</b> and approve the prompt — this phone then hears about open shifts even with the app closed. iPhone: add Myrosta to your Home Screen first (Share → Add to Home Screen) and open it from the icon."):""}
    ${adm?`<h3 class="hsec">For admins</h3>
    ${faq("Set up the department","Settings → zones, minimum/maximum cover, self‑roster method and quota period. Import your data, or use the Get‑started guide + Staff template.")}
    ${faq("Run a self‑roster round","Place fixed shifts, optionally ‘Fill to minimum cover’, then ‘Open booking’. Watch coverage and quotas fill live; edit any cell anytime.")}
    ${faq("Approve requests with context","Requests shows each leave/swap with the person’s EFT, leave already taken, who else is away, and the daily cap — approve or decline in a tap. Not clear‑cut? Type in the comment box and tap <b>Ask a question</b> — the request waits, they reply, and it returns to you with the conversation attached.")}
    ${faq("Manage staff & access","Staff tab to add people and their emails/mobiles. Settings → Access control → Sync allow‑list. ‘Make admin’ promotes a colleague.")}
    ${faq("Payroll export","Roster → Export… → Payroll file for RosterOn exports every shift in one click — correct times and leave pro‑rated by EFT.")}
    ${faq("Rounds or rolling — which roster mode?","<b>Rounds</b> (the default): you release the roster, everyone books during the round, you close it and publish. Everyone competes for the same open slots at the same time, which is the fairest way to share popular and unpopular shifts — and it is the only mode that supports In random groups and Take turns.<br><br><b>Rolling</b>: you go live once and the roster stays live. Staff add and drop their own shifts whenever they need to, right through the cycle. Good for small teams, for groups that fill shifts as they come up, and for admin/clerical rosters. Set a booking window if you want to limit when they may book — the roster stays visible either way.<br><br>It is set <b>per cycle</b> in <b>Settings → Roster mode</b>, so different staff groups (and different cycles) can run differently. Every guard is the same in both modes: leave, double-booking, zone cover, safe hours and quota all still apply, and past days can't be changed.")}
    ${faq("Capacity check — do we have enough staff?","Settings → Capacity check: it takes the cover you need (zones × min/max), your EFT and a realistic away‑buffer (leave, sick, CME) and writes out, in plain words, how many shifts a week you can fill, how many go uncovered, and how many more EFT it would take — at minimum and at full cover. Change any number for a what‑if (nothing touches the roster) and print it as a one‑page business case.")}
    ${faq("Open‑shift marketplace &amp; phone alerts","Settings → Open‑shift marketplace: broadcast an unfilled shift to the whole group, or let staff hand a shift back with Offer to group. You choose first‑come or admin‑approved claims, and whether over‑quota gap fill is allowed. Phone alerts need a one‑time server step (PUSH‑MARKETPLACE.md), then each person switches them on per phone from My shifts.")}`:""}
    ${adm&&(S.feedback||[]).length?`<h3 class="hsec">Feedback received (${S.feedback.length})</h3>${S.feedback.slice(0,40).map(f=>`<div class="fbitem${f.reviewed?" done":""}"><div class="fbmeta">${f.mood?MOODLBL[f.mood]+" ":""}<b>${escapeHTML(f.name||"")}</b>${f.category?` <span class="tag muted">${escapeHTML(f.category)}</span>`:""} <span class="muted small">· ${tsFmt(f.ts)}${f.tab?" · "+escapeHTML(f.tab):""}</span></div>${f.text?`<div class="fbtext">${escapeHTML(f.text)}</div>`:""}${(f.from&&f.from!=="admin"&&S.staff.find(x=>x.id===f.from))?`<button class="btn sm primary" data-fbreply="${f.id}">${ic("reply")} Reply</button> `:""}<button class="btn sm fbrev" data-fb="${f.id}">${f.reviewed?ic("check")+" Reviewed":"Mark reviewed"}</button></div>`).join("")}`:""}
    <div class="note" style="margin-top:14px">More: <a href="index.html" target="_blank" rel="noopener">myrosta.com.au</a> · <a href="support.html" target="_blank" rel="noopener">Support</a> · <a href="privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="#" id="helpReload">Reload the app</a><br><span class="muted">${cloudOn()?"Stored in Sydney, Australia":"Kept in this browser"}${cloudOn()&&_evOk===true?" · bookings go straight to the database · live updates "+(_rtStatus==="SUBSCRIBED"?"on":"off \u2014 checked every 45 s instead"):""} · every change is logged · build ${fmtBuild(BUILD)}</span></div>
  </div>`;
}
function shiftTally(sid){ const ds=cycleDates(); const _cy=active(); let am=0,pm=0,cst=0,locum=0,full=0; const zones={},leave={};
  ds.forEach(d=>{ const sh=getShift(sid,iso(d));
    if(sh.kind==="clinical"){ const f=fillsOf(_cy,sh); if(f.indexOf("AM")>=0)am++; if(f.indexOf("PM")>=0)pm++; if(f.length>1)full++; if(sh.locum)locum++; const z=zoneById(sh.zone),zn=z?z.name:"?"; zones[zn]=(zones[zn]||0)+1; }
    else if(sh.kind==="cst")cst++;
    else if(sh.kind==="leave")leave[sh.code]=(leave[sh.code]||0)+1; });
  return {am,pm,cst,locum,full,zones,leave}; }
