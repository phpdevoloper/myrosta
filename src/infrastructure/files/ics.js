"use strict";
// moved from js/admin.js lines 3063-3115 (Phase 1 split, no edits)
/* ---------- live calendar feed (subscribe) ---------- */
function genIcsToken(){const a=new Uint8Array(18);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");}   // 36-hex personal secret — the URL is the credential
function icsFeedUrl(s,scheme){const h=String(CLOUD.url||"").replace(/^https?:\/\//,"").replace(/\/.*$/,"");return h?((scheme||"webcal")+"://"+h+"/functions/v1/ics?token="+(s.icsToken||"")):"";}
function subFeedHTML(s){ if(!cloudOn()||!s||!s.icsToken)return "";
  const w=icsFeedUrl(s,"webcal");
  return `<div class="note" style="margin-top:10px"><b>${ic("cal")} Live calendar — updates automatically.</b> Subscribe once and roster changes flow into your phone's calendar (Apple refreshes within hours; Google Calendar can take up to a day).
    <div class="row" style="margin-top:8px;align-items:center">
      <input id="subUrl" readonly value="${w}" style="flex:1;min-width:200px;font-size:var(--fs-xs);padding:8px 10px;border:1px solid var(--line2);border-radius:8px">
      <a class="btn sm primary" href="${w}">Open (iPhone)</a>
      <button class="btn sm" id="subCopy">Copy</button>
      <button class="btn sm danger" id="subReset">Reset link</button>
    </div>
    <span class="muted small">This is your personal link — don't share it (anyone with it can see your shifts; Reset kills a leaked link). <b>Google Calendar:</b> Settings → Add calendar → From URL, and paste the link with <b>https://</b> instead of webcal://. If it says "Not found", the one-time server setup hasn't been completed yet (admin: SUPABASE-CALENDAR.md).</span></div>`; }
/* ---------- .ics export ---------- */
function icsFold(line){ const bytes=ch=>{ try{ return unescape(encodeURIComponent(ch)).length; }catch(e){ return 1; } }; const out=[]; let cur="", n=0; for(const ch of String(line)){ const w=bytes(ch); if(n+w>74){ out.push(cur); cur=" "+ch; n=1+w; } else { cur+=ch; n+=w; } } out.push(cur); return out.join("\r\n"); }   // RFC 5545: content lines fold at 75 octets
function exportICS(sid){ const blob=new Blob([icsText(sid)],{type:"text/calendar;charset=utf-8"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="roster-"+sid+".ics";a.click();URL.revokeObjectURL(url); }
function icsText(sid){   // the one-off .ics: the person's own shifts, each saying where it came from
  const s=S.staff.find(x=>x.id===sid);const r=window._range;
  const ds=cycleDates().filter(d=>iso(d)>=r.from&&iso(d)<=r.to);
  const stamp=new Date().toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  const nextDay=dk=>{const dt=new Date(Date.UTC(+dk.slice(0,4),+dk.slice(4,6)-1,+dk.slice(6,8)+1));return ""+dt.getUTCFullYear()+String(dt.getUTCMonth()+1).padStart(2,"0")+String(dt.getUTCDate()).padStart(2,"0");};
  const esc=t=>String(t).replace(/[\\;,]/g,m=>"\\"+m).replace(/\n/g,"\\n");
  const TZ="Australia/Melbourne";
  const place=orgPlace(), desc=(detail,verb)=>rosterLabel()+" · "+detail+"\n"+verb+" in Myrosta: https://myrosta.com.au";   // every event says where it came from — the person's own shift only; the download carries no calendar name (Outlook would open a named file as a separate calendar)
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Myrosta//Roster//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
    // anchor every timed event to Melbourne (AEST/AEDT rules below) — floating times are ambiguous: Apple reads them as local but Google-family parsers read them as UTC, shifting shifts by +10/11h
    "BEGIN:VTIMEZONE","TZID:"+TZ,
    "BEGIN:STANDARD","DTSTART:19700405T030000","RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU","TZOFFSETFROM:+1100","TZOFFSETTO:+1000","TZNAME:AEST","END:STANDARD",
    "BEGIN:DAYLIGHT","DTSTART:19701004T020000","RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU","TZOFFSETFROM:+1000","TZOFFSETTO:+1100","TZNAME:AEDT","END:DAYLIGHT",
    "END:VTIMEZONE"];
  const timed=(uid,ds0,de0,summary,detail)=>{ L.push("BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+stamp,"DTSTART;TZID="+TZ+":"+ds0,"DTEND;TZID="+TZ+":"+de0,"SUMMARY:"+esc(summary)); if(place)L.push("LOCATION:"+esc(place)); L.push("DESCRIPTION:"+esc(desc(detail||summary,"Swap or offer this shift")),"URL:https://myrosta.com.au/app.html",
    "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+esc(summary),"TRIGGER:-PT1H","END:VALARM","END:VEVENT"); };
  const allday=(uid,dk,summary,detail)=>{ L.push("BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+stamp,"DTSTART;VALUE=DATE:"+dk,"DTEND;VALUE=DATE:"+nextDay(dk),"SUMMARY:"+esc(summary)); if(place)L.push("LOCATION:"+esc(place)); L.push("DESCRIPTION:"+esc(desc(detail||summary,"See your roster")),"URL:https://myrosta.com.au/app.html","END:VEVENT"); };
  const _cyI=active(), _ocW=ocWindows(_cyI);
  ds.forEach(d=>{
    const sh=getShift(sid,iso(d));const dk=iso(d).replace(/-/g,"");
    if(sh.kind==="clinical"){
      const z=zoneById(sh.zone);const lbl=z?zoneLabelFor(_cyI,z,sh):"";
      const _t=Object.assign({},typeOf(_cyI,sh),shiftWindow(_cyI,sh)), st=_t.start.replace(":","")+"00", _rollo=(_t.end<=_t.start), en=_t.end.replace(":","")+"00";
      timed(`${sid}-${dk}-${sh.type||sh.period}@myrosta.v2`,dk+"T"+st,(_rollo?nextDay(dk):dk)+"T"+en,lbl+" ("+_t.label+")"+(sh.locum?" — locum":""),lbl+" "+_t.label+" · "+_t.start+"–"+_t.end+(sh.locum?" · locum":""));
    }else if(sh.kind==="cst"){
      const _tc=typeOf(_cyI,sh); allday(`${sid}-${dk}-cst@myrosta.v2`,dk,_tc.label+" (non-clinical)",_tc.label+" (non-clinical) · "+_tc.start+"–"+_tc.end);
    }else if(sh.kind==="leave"){
      allday(`${sid}-${dk}-lv@myrosta.v2`,dk,LEAVE_LABEL[sh.code]||sh.code);
    }
    ocHeldBy(_cyI,sid,iso(d),_ocW).filter(w=>!w.ci).forEach(w=>{ const _oe=(w.end<=w.start?nextDay(dk):dk);
      timed(`${sid}-${dk}-${w.uid||("oc-"+w.id)}@myrosta.v2`,dk+"T"+w.start.replace(":","")+"00",_oe+"T"+w.end.replace(":","")+"00",w.label+" ("+w.start+"–"+w.end+")"+(w.from&&sh.locum?" — locum":""),w.label+" · "+w.start+"–"+w.end); });   // on-call is its own event after the day's own; the one that follows an evening shift keeps the id and the words it always had
  });
  L.push("END:VCALENDAR");
  return L.map(icsFold).join("\r\n");
}

