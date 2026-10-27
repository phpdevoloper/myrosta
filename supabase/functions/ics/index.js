// Myrosta — live calendar feed (Supabase Edge Function)
// Serves a per-staff ICS calendar at:  /functions/v1/ics?token=<personal secret>
// Deploy name: "ics".  IMPORTANT: turn OFF "Enforce JWT verification" for this function
// (calendar apps can't send auth headers — the secret token in the URL is the credential).
// Reads org_state with the service-role key (auto-injected env; never lives in the app).

import { createClient } from "npm:@supabase/supabase-js@2";

/* ---------------- pure ICS builder (no Deno APIs — unit-testable) ---------------- */
const TZ = "Australia/Melbourne";
const LEAVE_LABEL = { AL:"Annual leave", CME:"CME leave", UA:"Unavailable", UPL:"Unplanned leave", PH:"Public holiday", LSL:"Long service leave", Sab:"Sabbatical", PL:"Private leave", Other:"Other", Orientation:"Orientation", Vacant:"Vacant" };

function pad(n){ return String(n).padStart(2,"0"); }
function esc(t){ return String(t).replace(/[\\;,]/g, m => "\\"+m).replace(/\n/g, "\\n"); }
function fold(line){ const bytes = ch => { try { return unescape(encodeURIComponent(ch)).length; } catch (_) { return 1; } }; const out=[]; let cur="", n=0; for (const ch of String(line)) { const w=bytes(ch); if (n+w>74) { out.push(cur); cur=" "+ch; n=1+w; } else { cur+=ch; n+=w; } } out.push(cur); return out.join("\r\n"); }   // RFC 5545: content lines fold at 75 octets
function isoAddDay(dk, n){ // dk = YYYYMMDD
  const dt = new Date(Date.UTC(+dk.slice(0,4), +dk.slice(4,6)-1, +dk.slice(6,8)+n));
  return "" + dt.getUTCFullYear() + pad(dt.getUTCMonth()+1) + pad(dt.getUTCDate());
}
function cycleDays(cyc){ // -> ISO date strings for the whole cycle
  const [y,m,d] = String(cyc.cycle.start).split("-").map(Number);
  const days = (cyc.cycle.weeks || 8) * 7, out = [];
  for (let i=0;i<days;i++){ const dt = new Date(Date.UTC(y, m-1, d+i)); out.push(dt.getUTCFullYear()+"-"+pad(dt.getUTCMonth()+1)+"-"+pad(dt.getUTCDate())); }
  return out;
}
function shiftFor(S, cyc, sid, isoD){ // mirrors the app's getShift: assign first, then approved leave
  const a = (cyc.assign || {})[sid+"|"+isoD]; if (a) return a;
  const lv = (S.leave || []).find(L => L.staffId===sid && L.status==="approved" && L.from<=isoD && L.to>=isoD);
  if (lv) return { kind:"leave", code:lv.code };
  return { kind:"off" };
}
function isOnCallZone(z){ if(!z) return false; if(z.oncall!=null) return z.oncall===true; return /\bOC\b|ON.?CALL|\+\s*OC/i.test((z.pmLabel||"")+" "+(z.name||"")); }   // an explicit tick wins; a zone never ticked falls back to the old name match
// Shift types (per cycle), mirroring app.html: the two halves of the day plus the on-call rider, the
// non-clinical block, and anything the admin added — including a type that fills BOTH halves.
// Derived from the cycle's own times when it has never been saved, so an older cycle is unchanged.
const TYPE_SEED=[{id:"AM",code:"AM",label:"AM",fills:["AM"],on:true,builtin:"AM"},
  {id:"PM",code:"PM",label:"PM",fills:["PM"],on:true,builtin:"PM"},
  {id:"ONC",code:"OC",label:"On-call",fills:[],on:true,builtin:"ONC",derived:"oncall"},
  {id:"CST",code:"CST",label:"CST",fills:[],on:true,builtin:"CST"}];
function typesOf(cyc){ const st=(cyc&&cyc.settings&&cyc.settings.shiftTypes); if(st&&st.length)return st;
  const t=timesOf(cyc); return TYPE_SEED.map(x=>({...x,fills:x.fills.slice(),start:t[x.builtin].start,end:t[x.builtin].end})); }
function byId(TY,id){ return TY.find(t=>t.id===id)||null; }
function typeOf(TY,sh){ if(sh.kind==="cst")return byId(TY,"CST"); return (sh.type&&byId(TY,sh.type))||byId(TY,sh.period); }   // an unknown id degrades to the plain period — never drop an event
function fillsOf(TY,sh){ const t=sh.type&&byId(TY,sh.type); const f=(t&&t.fills&&t.fills.length)?t.fills:null; return f?f:[sh.period]; }
function hoursOf(sh,ty){ const h=sh&&sh.kind==="clinical"&&sh.hours, re=/^([01]\d|2[0-3]):([0-5]\d)$/, a=h&&re.exec(String(h.start||"")), b=h&&re.exec(String(h.end||""));
  if(a&&b){ const s=(+a[1])*60+(+a[2]), e=(+b[1])*60+(+b[2]); if((+a[2])%5===0&&(+b[2])%5===0&&(e>s||(e===0&&s>0)))return {start:h.start,end:h.end}; }
  return {start:ty?ty.start:"",end:ty?ty.end:""}; }   // the app's shiftWindow, in three lines: the booking's own hours when it carries a pair the rule allows, else the type's window
function zoneLabelFor(TY,z,sh){ if(!z)return "?"; const f=fillsOf(TY,sh); if(f.length>1&&z.pmLabel&&z.pmLabel!==z.name)return z.name+"/"+z.pmLabel; return zoneLabel(z,f[0]||sh.period); }
function timesOf(cyc){ const d={AM:["08:00","16:00"],PM:["15:30","23:30"],ONC:["23:30","08:00"],CST:["08:00","16:00"]};
  const o=(cyc.settings&&cyc.settings.shiftTimes)||{}; const out={};
  Object.keys(d).forEach(k=>{ out[k]={start:(o[k]&&o[k].start)||d[k][0], end:(o[k]&&o[k].end)||d[k][1]}; }); return out; }   // per-cycle shift times, matching the app
const hhmmss = t => String(t).replace(":","")+"00";
function zoneLabel(z, period){ return (period==="PM" && z && z.pmLabel) ? z.pmLabel : (z ? z.name : "?"); }
// On-call windows (per cycle), mirroring app.html. A saved list is the truth, and an empty one means no on-call. A cycle
// that has never saved one still has its per-zone tick, read as ONE window following the evening shift in every zone
// carrying it — under the id the tick's events have always had, so no calendar sees an event vanish and come back.
function windowsOf(cyc, zones, TY){ const w = cyc.settings && cyc.settings.oncallWindows; if (Array.isArray(w)) return w;
  const t = byId(TY, "ONC"); if (!t || t.on === false) return [];
  const zs = zones.filter((z, i) => zones.findIndex(x => x.id === z.id) === i && isOnCallZone(z)).map(z => z.id); if (!zs.length) return [];   // the first zone with an id decides, as in the app
  const tm = timesOf(cyc).ONC;   // the hours payroll has always used for the tick, as the app reads them
  return [{ id:"ONC", code:t.code || "OC", pay:"ONC", uid:"oc", label:t.label || "On-call", start:tm.start, end:tm.end, book:false, rest:true, from:{ zones:zs, period:"PM" } }]; }
function heldOn(cyc, TY, wins, sid, isoD, sh){   // taken by the person, or following the shift they work that day
  const out = cyc.roles && cyc.roles[sid] && cyc.roles[sid].in === false;   // out of this cycle, or on leave that day: no phone, as in the app
  return wins.filter(w => w.from ? (sh.kind === "clinical" && (w.from.zones || []).includes(sh.zone) && fillsOf(TY, sh).includes(w.from.period || "PM")) : (!out && sh.kind !== "leave" && (cyc.oncall || {})[isoD+"|"+w.id] === sid)); }

export function buildICS(S, staff, reg){
  const stamp = "20260101T000000Z"; // static DTSTAMP: feed content defines identity; avoids needless churn for clients
  const b = S.branding || {}, r = reg || {};
  const hosp = b.hospital || r.hospital || "", grp = b.name || r.label || "";   // branding first, then the org registry — the same precedence as the app
  const label = [hosp, grp].filter(Boolean).join(" · "), place = hosp || grp || "";   // every event says where it came from — the person's own shift only
  const desc = (detail, verb) => (label ? label + " roster" : "Roster") + " · " + detail + "\n" + verb + " in Myrosta: https://myrosta.com.au";
  const L = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Myrosta//Feed//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
    "X-WR-CALNAME:"+esc((place || "Myrosta")+" · Myrosta"),
    "X-WR-TIMEZONE:"+TZ,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H","X-PUBLISHED-TTL:PT6H",
    "BEGIN:VTIMEZONE","TZID:"+TZ,
    "BEGIN:STANDARD","DTSTART:19700405T030000","RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU","TZOFFSETFROM:+1100","TZOFFSETTO:+1000","TZNAME:AEST","END:STANDARD",
    "BEGIN:DAYLIGHT","DTSTART:19701004T020000","RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU","TZOFFSETFROM:+1000","TZOFFSETTO:+1100","TZNAME:AEDT","END:DAYLIGHT",
    "END:VTIMEZONE"];
  const seen = {};
  const timed = (uid, ds, de, summary, detail) => { if (seen[uid]) return; seen[uid]=1;
    L.push("BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+stamp,"DTSTART;TZID="+TZ+":"+ds,"DTEND;TZID="+TZ+":"+de,"SUMMARY:"+esc(summary)); if (place) L.push("LOCATION:"+esc(place)); L.push("DESCRIPTION:"+esc(desc(detail||summary,"Swap or offer this shift")),"URL:https://myrosta.com.au/app.html",
      "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+esc(summary),"TRIGGER:-PT1H","END:VALARM","END:VEVENT"); };
  const allday = (uid, dk, summary, detail) => { if (seen[uid]) return; seen[uid]=1;
    L.push("BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+stamp,"DTSTART;VALUE=DATE:"+dk,"DTEND;VALUE=DATE:"+isoAddDay(dk,1),"SUMMARY:"+esc(summary)); if (place) L.push("LOCATION:"+esc(place)); L.push("DESCRIPTION:"+esc(desc(detail||summary,"See your roster")),"URL:https://myrosta.com.au/app.html","END:VEVENT"); };

  const live = (S.cycles || []).filter(c => !c.archived && ["open","closed","published"].includes(c.status)); // drafts stay private
  for (const cyc of live){
    const zones = (cyc.settings && cyc.settings.zones) || S.zones || [];
    const zoneById = id => zones.find(z => z.id===id);
    const TY = typesOf(cyc), wins = windowsOf(cyc, zones, TY);   // once per cycle, never inside the day loop
    for (const isoD of cycleDays(cyc)){
      const sh = shiftFor(S, cyc, staff.id, isoD);
      const dk = isoD.replace(/-/g, "");
      if (sh.kind === "clinical"){
        const z = zoneById(sh.zone), ty0 = typeOf(TY, sh), tt = Object.assign({}, ty0, hoursOf(sh, ty0)), lbl = zoneLabelFor(TY, z, sh);   // the type's label and code, the booking's own start and finish
        const enD=(tt.end<=tt.start)?isoAddDay(dk,1):dk;
        timed(`${staff.id}-${dk}-${sh.type||sh.period}@myrosta.v2`, dk+"T"+hhmmss(tt.start), enD+"T"+hhmmss(tt.end), lbl+" ("+tt.label+")"+(sh.locum?" — locum":""), lbl+" "+tt.label+" · "+tt.start+"–"+tt.end+(sh.locum?" · locum":""));
      } else if (sh.kind === "cst"){
        const ct=typeOf(TY,sh);
        allday(`${staff.id}-${dk}-cst@myrosta.v2`, dk, ct.label+" (non-clinical)", ct.label+" (non-clinical) · "+ct.start+"–"+ct.end);
      } else if (sh.kind === "leave"){
        allday(`${staff.id}-${dk}-lv@myrosta.v2`, dk, LEAVE_LABEL[sh.code] || sh.code);
      }
      for (const w of heldOn(cyc, TY, wins, staff.id, isoD, sh)){ const ocD = (w.end<=w.start) ? isoAddDay(dk,1) : dk;   // on-call is its own event after the day's own, as in the app's download
        timed(`${staff.id}-${dk}-${w.uid || ("oc-"+w.id)}@myrosta.v2`, dk+"T"+hhmmss(w.start), ocD+"T"+hhmmss(w.end), w.label+" ("+w.start+"–"+w.end+")"+(w.from && sh.locum ? " — locum" : ""), w.label+" · "+w.start+"–"+w.end); }
    }
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n");
}

/* ---------------- HTTP handler ---------------- */
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("token") || "").trim();
    if (!/^[a-f0-9]{24,64}$/i.test(token)) return new Response("Not found", { status: 404 }); // no detail leaks
    const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))   // this project needs the custom SERVICE_ROLE_KEY secret (the auto-injected one did not work for notify-*); fall back to the auto one elsewhere;
    // Multi-org: the token alone identifies the person, so we must find WHICH organisation owns it
    // (previously this read one hard-wired org, which 404s every other organisation's calendar links).
    // Fast path: let Postgres find the row whose staff array contains this token.
    // Fallback: scan every organisation's state — correct, just heavier; also covers a
    // pre-migration single-org database, where there is exactly one row to scan.
    let S = null, orgId = "";
    try {
      const q = await sb.from("org_state").select("org,data").contains("data->staff", JSON.stringify([{ icsToken: token }])).limit(1);
      if (!q.error && q.data && q.data.length && q.data[0].data) { S = q.data[0].data; orgId = q.data[0].org; }
    } catch (_e) { /* fall through to the scan */ }
    if (!S) {
      const all = await sb.from("org_state").select("org,data");
      if (!all.error && all.data) {
        for (const r of all.data) {
          const d = r && r.data;
          if (d && (d.staff || []).some(x => x.icsToken && x.icsToken === token)) { S = d; orgId = r.org; break; }
        }
      }
    }
    if (!S) return new Response("Not found", { status: 404 });
    const staff = (S.staff || []).find(x => x.icsToken && x.icsToken === token);
    if (!staff) return new Response("Not found", { status: 404 });
    let reg = null;   // the org registry (label + hospital) fills in what branding does not say — the same fallback the app uses
    if (orgId && !((S.branding || {}).hospital && (S.branding || {}).name)) { try { const o = await sb.from("orgs").select("label,hospital").eq("org", orgId).maybeSingle(); reg = o.data || null; } catch (_) { /* pre-migration: no orgs table */ } }
    return new Response(buildICS(S, staff, reg), { headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=myrosta.ics",
      "Cache-Control": "private, max-age=300"
    }});
  } catch (_e) {
    return new Response("Error", { status: 500 });
  }
});
