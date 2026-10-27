// Myrosta — shift reminders (Supabase Edge Function, Deno/TypeScript)
// Runs once a day (e.g. early evening). Emails/texts each consultant their shift for
// TOMORROW. Reads the shared org_state; each person is messaged on their personal
// email / mobile (work email was cleared for privacy).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")    || "";
const FROM_EMAIL   = Deno.env.get("NOTIFY_FROM_EMAIL") || "noreply@myrosta.com.au";
const APP_URL      = Deno.env.get("APP_URL")           || "https://myrosta.com.au";
const ONLY_ORG     = Deno.env.get("ORG")               || "";   // optional: restrict to ONE organisation; unset = every organisation
const TZ           = Deno.env.get("TZ")                || "Australia/Melbourne";
const TW_SID   = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TW_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")  || "";
const TW_FROM  = Deno.env.get("TWILIO_FROM")        || "";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ---- pure: what a reminder says (tests/run.py lifts this block out and runs it, so keep it to plain code and `: any`) ----
// Shift times are a PER-CYCLE setting in the app (organisations differ: 08:00–16:00 here,
// 10:00–17:00 there). Read them from the cycle the shift belongs to; fall back to the
// organisation default, then to these built-in defaults.
const TIME_DEFAULTS: any = {
  AM: { start: "08:00", end: "16:00" }, PM: { start: "15:30", end: "23:30" },
  ONC: { start: "23:30", end: "08:00" }, CST: { start: "08:00", end: "16:00" },
};
function timesOf(S: any, cyc: any) {
  const t = (cyc && cyc.settings && cyc.settings.shiftTimes) || (S && S.shiftTimes) || {};
  const out: any = {};
  for (const k of Object.keys(TIME_DEFAULTS)) out[k] = { ...TIME_DEFAULTS[k], ...(t[k] || {}) };
  return out;
}
// Shift types (per cycle), mirroring app.html and the ics feed. A type may fill BOTH halves of the day —
// a full shift — and the admin may rename or switch off any of them. Derived when a cycle has never saved one.
const TYPE_SEED: any[] = [{ id: "AM", code: "AM", label: "AM", fills: ["AM"], on: true, builtin: "AM" },
  { id: "PM", code: "PM", label: "PM", fills: ["PM"], on: true, builtin: "PM" },
  { id: "ONC", code: "OC", label: "On-call", fills: [], on: true, builtin: "ONC", derived: "oncall" },
  { id: "CST", code: "CST", label: "CST", fills: [], on: true, builtin: "CST" }];
function typesOf(S: any, cyc: any) {
  const st = cyc && cyc.settings && cyc.settings.shiftTypes;
  if (st && st.length) return st;
  const t = timesOf(S, cyc);
  return TYPE_SEED.map((x: any) => ({ ...x, fills: x.fills.slice(), start: t[x.builtin].start, end: t[x.builtin].end }));
}
const byId = (TY: any[], id: any) => TY.find((t: any) => t.id === id) || null;
function typeOf(TY: any[], sh: any) {
  if (sh.kind === "cst") return byId(TY, "CST");
  return (sh.type && byId(TY, sh.type)) || byId(TY, sh.period);   // an unknown id degrades to the plain period — never skip a reminder
}
function fillsOf(TY: any[], sh: any) {
  const t = sh.type && byId(TY, sh.type);
  return (t && t.fills && t.fills.length) ? t.fills : [sh.period];
}
function hoursOf(sh: any, ty: any) {   // the app's shiftWindow, in three lines: the booking's own hours when it carries a pair the rule allows, else the type's window
  const h = sh && sh.kind === "clinical" && sh.hours, re = /^([01]\d|2[0-3]):([0-5]\d)$/, a = h && re.exec(String(h.start || "")), b = h && re.exec(String(h.end || ""));
  if (a && b) { const s = (+a[1]) * 60 + (+a[2]), e = (+b[1]) * 60 + (+b[2]); if ((+a[2]) % 5 === 0 && (+b[2]) % 5 === 0 && (e > s || (e === 0 && s > 0))) return { start: h.start, end: h.end }; }
  return { start: (ty && ty.start) || "", end: (ty && ty.end) || "" };
}
function zoneLabel(S: any, cyc: any, zoneId: any, period: any, both?: any) {
  const zones = (cyc && cyc.settings && cyc.settings.zones) || S.zones || [];   // per-cycle zones first — same rule as the ics feed
  const z = zones.find((z: any) => z.id === zoneId);
  if (!z) return "";
  if (both && z.pmLabel && z.pmLabel !== z.name) return z.name + "/" + z.pmLabel;   // a whole-day shift stands in both halves of a zone whose evening is named differently
  return period === "PM" && z.pmLabel ? z.pmLabel : z.name;
}
// On-call a person TOOK is reminded like a shift. A window that follows a shift (the old per-zone tick included) is
// not mentioned: that shift's own reminder is the reminder, as it always was.
function takenWindowsOf(cyc: any) { const w = cyc && cyc.settings && cyc.settings.oncallWindows; return Array.isArray(w) ? w.filter((x: any) => !x.from) : []; }
function ocWords(w: any) { const l = String(w.label || "On-call").slice(0, 24); return (/call/i.test(l) ? l : l + " on call") + " " + w.start + "–" + w.end; }
// What tomorrow holds for one person: null for nothing, else the words for it and whether a shift is among it.
function reminderFor(S: any, s: any, target: any) {
  let sh: any = null, shCyc: any = null; const oc: any[] = [];
  const onLeave = (S.leave || []).some((L: any) => L.staffId === s.id && L.status === "approved" && L.from <= target && L.to >= target);
  for (const cyc of (S.cycles || [])) {
    if (cyc.archived || cyc.status === "draft") continue;   // a draft is not the roster yet — never remind anyone about it
    const a = cyc.assign && cyc.assign[s.id + "|" + target];
    if (a && !sh) { sh = a; shCyc = cyc; }
    if (onLeave || (a && a.kind === "leave") || (cyc.roles && cyc.roles[s.id] && cyc.roles[s.id].in === false)) continue;   // on leave, or out of this cycle: no phone, as in the app
    for (const w of takenWindowsOf(cyc)) if (cyc.oncall && cyc.oncall[target + "|" + w.id] === s.id) oc.push(w);
  }
  const onShift = !!sh && (sh.kind === "clinical" || sh.kind === "cst");
  if (!onShift && !oc.length) return null;
  let detail = "";
  if (onShift) {
    const TY = typesOf(S, shCyc);   // this cycle's real types and hours, not a hardcoded guess
    const ty0 = typeOf(TY, sh) || { label: sh.period, start: "", end: "" }, ty = { ...ty0, ...hoursOf(sh, ty0) };   // the type's label, the booking's own start and finish
    const win = `${ty.start || ""}–${ty.end || ""}`;
    if (sh.kind === "clinical") {
      const fl = fillsOf(TY, sh);
      const zl = zoneLabel(S, shCyc, sh.zone, fl[0] || sh.period, fl.length > 1);   // the half the TYPE covers, not the half stored before the admin last edited it
      detail = `${String(ty.label).slice(0, 24)} · ${zl}${zl ? " · " : ""}${win}${sh.locum ? " (locum)" : ""}`;
    } else {
      detail = `${String(ty.label).slice(0, 24)} (non-clinical) · ${win}`;
    }
  }
  const ocTxt = oc.map(ocWords).join(", ");
  if (ocTxt) detail = detail ? detail + " + " + ocTxt : ocTxt;
  return { detail, onShift };
}
// ---- end pure ----

function e164(m: string) {
  let d = String(m || "").replace(/\D/g, "");
  if (!d) return "";
  if (d[0] === "0") d = "61" + d.slice(1);
  else if (d.slice(0, 2) !== "61" && d.length === 9) d = "61" + d;
  return "+" + d;
}

async function sendEmailOne(to: string, subject: string, text: string) {
  if (!RESEND_KEY || !to) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Myrosta <${FROM_EMAIL}>`, to: [to], subject, text }),
  });
  if (!r.ok) console.error("resend", r.status);
}
// Every text stays in the GSM 03.38 alphabet: typographic dashes, dots and quotes become plain ASCII, so no carrier route can garble them
const gsmBody = (t: string) => String(t).replace(/\s·\s/g, " - ").replace(/\s—\s/g, " - ").replace(/[—–‐-―−]/g, "-").replace(/·/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/\u00a0/g, " ");
async function sendSMSOne(phone: string, body: string) {
  if (!TW_SID || !TW_TOKEN || !TW_FROM || !phone) return;
  const auth = btoa(`${TW_SID}:${TW_TOKEN}`);
  const params = new URLSearchParams();
  params.set(TW_FROM.startsWith("MG") ? "MessagingServiceSid" : "From", TW_FROM);
  params.set("To", phone);
  params.set("Body", gsmBody(body));
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!r.ok) console.error("twilio", r.status);
}

// One organisation's "you're on tomorrow" reminders. Multi-org: called once per organisation.
async function runOrg(ORG: string) {
  const { data: row } = await sb.from("org_state").select("data").eq("org", ORG).maybeSingle();
  if (!row) return { org: ORG, sent: 0, skipped: "no state" };
  const S = row.data;
  let hosp = S.branding?.hospital || "", grp = S.branding?.name || "";
  if (!hosp || !grp) { try { const o = await sb.from("orgs").select("label,hospital").eq("org", ORG).maybeSingle(); hosp = hosp || o.data?.hospital || ""; grp = grp || o.data?.label || ""; } catch (_) { /* pre-migration: no orgs table */ } }   // branding first, then the org registry — the app's precedence
  const lbl = [hosp, grp].filter(Boolean).join(" · ");   // the reminder says where it comes from; nothing when nothing is known
  const gsm = (t: string) => String(t).replace(/\s·\s/g, " - ").replace(/\s—\s/g, " - ").replace(/[—–‐-―−]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\u00a0/g, " ");   // texts stay in the GSM alphabet: one segment, not two

  // tomorrow's date in the department's timezone (YYYY-MM-DD)
  const target = new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: TZ });
  const pretty = new Date(target + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  let sent = 0;
  for (const s of (S.staff || [])) {
    const r = reminderFor(S, s, target);   // tomorrow's shift, and any on-call they took, across the cycles that are the roster
    if (!r) continue;
    const { detail, onShift } = r;

    const to    = (s.email2 || s.email || "").trim();
    const phone = e164(s.mobile);
    const first = String(s.name || "").split(",").pop()?.trim() || "there";

    await sendEmailOne(to, `Tomorrow ${pretty}: ${detail}${lbl ? " — " + lbl : ""}`,
      `Hi ${first},\n\nYou're ${onShift ? "rostered" : "on call"} tomorrow (${pretty})${lbl ? " — " + lbl : ""}:\n  ${detail}\n\n${onShift ? "Swap or offer this shift, or add it to your calendar," : "See it, or add it to your calendar,"} in Myrosta: ${APP_URL}`);
    await sendSMSOne(phone, `${lbl ? gsm(lbl) : "Myrosta"}: you're ${onShift ? "on" : "on call"} tomorrow ${pretty} - ${gsm(detail)}. ${APP_URL}`);
    if (to || phone) sent++;
  }
  return { org: ORG, target, sent };
}

Deno.serve(async (req) => {
  // Cron auth: when CRON_SECRET is set, callers must present it — this endpoint can text/email
  // every member of every organisation, so it must not stay publicly invocable. (Unset = open,
  // preserving behaviour until the scheduler is configured with the header; see runbook.)
  const CRON = Deno.env.get("CRON_SECRET") || "";
  if (CRON && (req.headers.get("x-cron-key") || "") !== CRON) return new Response("401", { status: 401 });
  if (ONLY_ORG) console.warn("ORG env var is set — notify-shifts only serves: " + ONLY_ORG);
  // Multi-org: process every organisation, or just ONLY_ORG when the env var is set.
  let orgs: string[] = [];
  if (ONLY_ORG) orgs = [ONLY_ORG];
  else { const list = await sb.from("org_state").select("org"); orgs = (list.data || []).map((r: any) => r.org).filter(Boolean); }
  const results = [];
  for (const org of orgs) {
    try { results.push(await runOrg(org)); }
    catch (e) { results.push({ org, sent: 0, error: String((e as any)?.message || e) }); }   // one organisation failing must not stop the rest
  }
  const sent = results.reduce((a, r: any) => a + (r.sent || 0), 0);
  for (const r of results) if ((r as any).error || (r as any).skipped) console.error("notify-shifts", (r as any).org, (r as any).error || (r as any).skipped);
  return new Response(JSON.stringify({ ok: true, orgs: results.length, sent }), { headers: { "Content-Type": "application/json" } });   // counts only — no per-org detail or error text to callers
});
