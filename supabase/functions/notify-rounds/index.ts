// Myrosta — Phase 2 notifications (Supabase Edge Function, Deno/TypeScript)
// Runs on a schedule (e.g. every 5 min). When a self-roster round's scheduled window
// opens, is closing soon (24h), or closes, it emails (Resend) and optionally texts
// (Twilio Messaging) everyone on the allow-list. Pairs with the in-app Phase 1 schedule.
//
// It reuses the cycle.window the admin sets in the app; server-side "notif" flags keep
// it from re-sending. A compare-and-swap write avoids clobbering concurrent bookings.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY")        || "";
const FROM_EMAIL    = Deno.env.get("NOTIFY_FROM_EMAIL")     || "noreply@myrosta.com.au";
const APP_URL       = Deno.env.get("APP_URL")               || "https://myrosta.com.au";
const ONLY_ORG      = Deno.env.get("ORG")                   || "";   // optional: restrict to ONE organisation; unset = every organisation
// Optional SMS via Twilio *Messaging* (not Verify). TWILIO_FROM = a Messaging Service SID
// (MG...) or a sender number. For Australia this needs a registered sender — see the guide.
const TW_SID   = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TW_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")  || "";
const TW_FROM  = Deno.env.get("TWILIO_FROM")        || "";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const TZ = Deno.env.get("MYROSTA_TZ") || "Australia/Melbourne";   // the group's clock: a bare wall time in the schedule ("2026-10-16T10:00") is this zone's, not the server's (16 Oct 2026 — the server runs in UTC and read 10:00 as 9 pm Melbourne)
const tzOffsetMin = (ms: number, tz: string) => { const g: any = {}; new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms)).forEach((x) => { g[x.type] = x.value; });
  return Math.round((Date.UTC(+g.year, +g.month - 1, +g.day, (+g.hour) % 24, +g.minute, +g.second) - ms) / 60000); };
const dtMs = (s: string) => { if (!s) return null; const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s).trim());
  if (!m) { const t = Date.parse(s); return isNaN(t) ? null : t; }
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)); let off: number; try { off = tzOffsetMin(wall, TZ); } catch (_) { const t = Date.parse(s); return isNaN(t) ? null : t; }
  let ms = wall - off * 60000; const off2 = tzOffsetMin(ms, TZ); if (off2 !== off) ms = wall - off2 * 60000; return ms; };
const fmt  = (s: string) => {
  const t = dtMs(s); if (t == null) return "";
  return new Date(t).toLocaleString("en-AU", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

async function sendEmail(to: string[], subject: string, text: string, strict = false) {
  if (!to.length) return;
  if (!RESEND_KEY) { if (strict) throw new Error("email not configured"); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Myrosta <${FROM_EMAIL}>`, to, subject, text }),
  });
  if (!res.ok && strict) throw new Error(`resend ${res.status} ${(await res.text()).slice(0, 160)}`);
}

// Every text stays in the GSM 03.38 alphabet: typographic dashes, dots and quotes become plain ASCII, so no carrier route can garble them
const gsmBody = (t: string) => String(t).replace(/\s·\s/g, " - ").replace(/\s—\s/g, " - ").replace(/[—–‐-―−]/g, "-").replace(/·/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/\u00a0/g, " ").replace(/‑/g, "-");
async function sendSMS(phones: string[], body: string, strict = false) {
  if (!phones.length) return;
  if (!TW_SID || !TW_TOKEN || !TW_FROM) { if (strict) throw new Error("sms not configured"); return; }
  const auth = btoa(`${TW_SID}:${TW_TOKEN}`);
  for (const p of phones) {
    const params = new URLSearchParams();
    params.set(TW_FROM.startsWith("MG") ? "MessagingServiceSid" : "From", TW_FROM);
    params.set("To", p.startsWith("+") ? p : "+" + p);
    params.set("Body", gsmBody(body));
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!res.ok && strict) throw new Error(`twilio ${res.status} ${(await res.text()).slice(0, 160)}`);   // a wrong number must not count as sent
  }
}

// One organisation's round notifications. Multi-org: called once per organisation.
async function runOrg(ORG: string) {
  const { data: row } = await sb.from("org_state").select("data,updated").eq("org", ORG).maybeSingle();
  if (!row) return { org: ORG, sent: 0, skipped: "no state" };
  const S = row.data;

  // Allow-list scoped to THIS organisation — unscoped would email other organisations' staff
  // about this organisation's round. Falls back to unscoped on a pre-migration database
  // (roster_members has no `org` column yet), where there is only one organisation anyway.
  const noOrgColumn = (e: any) => !!e && (String(e.code) === "42703" || /column .*org.* does not exist/i.test(String(e.message || "")));
  let members: any[] | null = null;
  {
    const scoped = await sb.from("roster_members").select("email,phone").eq("org", ORG);
    if (!scoped.error) members = scoped.data || [];
    else if (noOrgColumn(scoped.error)) {
      // pre-migration database: single organisation, unscoped is equivalent
      const legacy = await sb.from("roster_members").select("email,phone");
      if (legacy.error) return { org: ORG, sent: 0, skipped: "legacy members query failed" };
      members = legacy.data || [];
    } else {
      // transient/other error: send NOTHING for this organisation rather than risk mailing
      // other organisations' staff via the unscoped list. The next cron tick retries.
      return { org: ORG, sent: 0, skipped: "members query failed: " + String(scoped.error.message || "") };
    }
  }
  const emails = (members || []).map((m: any) => m.email).filter(Boolean);
  const phones = (members || []).map((m: any) => m.phone).filter(Boolean).map((p: string) => "+" + String(p).replace(/^\+/, ""));

  // the hospital and group, so five groups at one site never get five identical texts
  let lbl = [S.branding?.hospital, S.branding?.name].filter(Boolean).join(" · ");
  if (!lbl) { try { const o = await sb.from("orgs").select("label,hospital").eq("org", ORG).maybeSingle(); lbl = [o.data?.hospital, o.data?.label].filter(Boolean).join(" · "); } catch (_) { /* pre-migration: no orgs table */ } }
  lbl = lbl || "Myrosta";

  const now = Date.now();
  const toSend: { sub: string; body: string }[] = [];

  for (const cyc of (S.cycles || [])) {
    if (cyc.archived) continue;
    const w = cyc.window;
    if (!w || !w.enabled) continue;
    const o = dtMs(w.open), c = dtMs(w.close);
    w.notif = w.notif || {};
    if (o && now >= o && (!c || now < c) && !w.notif.open) {
      w.notif.open = true;
      // 16 Oct 2026: the server opens the round itself (the app used to do it on every open phone, and each of them saved the whole roster at once)
      if (cyc.status === "draft" || cyc.status === "closed") {
        cyc.status = "open"; w.fired = "open";
        const log = Array.isArray(cyc.statusLog) ? cyc.statusLog : [];
        if (!log.some((e: any) => e && e.by === "schedule" && e.to === "open" && e.ts === o)) cyc.statusLog = log.concat([{ to: "open", ts: o, by: "schedule", notified: (members || []).length, sent: 0 }]).slice(-24);
        const nid = "n-auto-open-" + cyc.id + "-" + o;   // the same id the app would use, so the two never double up
        if (!(S.notifications || []).some((n: any) => n && n.id === nid)) (S.notifications = S.notifications || []).unshift({ id: nid, to: "all", text: "Booking is open — pick your shifts" + (c ? " by " + fmt(w.close) : "") + ".", ts: Date.now(), readBy: [], go: { tab: "selfroster", cycle: cyc.id, anchor: null } });
        (S.audit = S.audit || []).unshift({ id: "a" + Date.now() + "sched", ts: Date.now(), actor: "admin", action: "selfroster.autoopen", detail: "scheduled open (server) · " + (cyc.cycle ? cyc.cycle.start : cyc.id) });
      }
      toSend.push({ sub: `${lbl} — booking is open`, body: `${lbl}: booking is open in Myrosta — book your shifts${c ? ` by ${fmt(w.close)}` : ""}.\n${APP_URL}` });
    }
    if (c && now >= c - 24 * 3600 * 1000 && now < c && !w.notif.reminder) {
      w.notif.reminder = true;
      toSend.push({ sub: `${lbl} — booking closes soon`, body: `${lbl}: booking closes ${fmt(w.close)} — book your shifts in Myrosta.\n${APP_URL}` });
    }
    if (c && now >= c && !w.notif.close) {
      w.notif.close = true;
      if (cyc.status === "open") {   // and closes it: the deadline is the server's to keep
        cyc.status = "closed"; w.fired = "closed";
        const log = Array.isArray(cyc.statusLog) ? cyc.statusLog : [];
        if (!log.some((e: any) => e && e.by === "schedule" && e.to === "closed" && e.ts === c)) cyc.statusLog = log.concat([{ to: "closed", ts: c, by: "schedule", notified: 0, sent: 0 }]).slice(-24);
      }
      toSend.push({ sub: `${lbl} — booking has closed`, body: `${lbl}: booking has closed. Your roster is set — see it in Myrosta.\n${APP_URL}` });
    }
  }

  // the app's outbox: one message per person (invites, publish notices), written by an admin in the app
  const box: any[] = Array.isArray(S.outbox) ? S.outbox : [];
  const due = box.filter((m: any) => m && m.id && !m.sent && (m.phone || m.email) && m.body);
  const stamp = new Date().toISOString();
  for (const m of due) m.sent = stamp;

  let sent = 0;
  if (toSend.length || due.length) {
    // Persist the flags FIRST with a compare-and-swap so we don't clobber concurrent
    // bookings and don't double-send. Only send if the write wins.
    const upd = await sb.from("org_state").update({ data: S, updated: new Date().toISOString() })
      .eq("org", ORG).eq("updated", row.updated).select("updated").maybeSingle();
    if (upd.data) {
      for (const m of toSend) { await sendEmail(emails, m.sub, m.body); await sendSMS(phones, m.body); sent++; }
      let changed = false;
      for (const m of due) {   // per person: a text where there is a mobile, else an email; a text that fails falls back to the email
        try {
          if (m.phone) { try { await sendSMS([String(m.phone)], String(m.body), true); } catch (e) { if (m.email) await sendEmail([String(m.email)], String(m.subject || lbl), String(m.body), true); else throw e; } }
          else if (m.email) await sendEmail([String(m.email)], String(m.subject || lbl), String(m.body), true);
          if (m.error) { delete m.error; changed = true; }
          sent++;
        } catch (e) {   // record the failure and give it two more tries on later ticks; after that it is a dead letter the app shows the admin
          m.attempts = (m.attempts || 0) + 1; m.error = String((e as any)?.message || e).slice(0, 200); if (m.attempts < 3) m.sent = null; changed = true;
          console.error("outbox", ORG, m.id, m.error);
        }
      }
      if (changed) {   // best effort: a lost race here only means the next tick retries or re-reports
        const fix = await sb.from("org_state").update({ data: S, updated: new Date().toISOString() }).eq("org", ORG).eq("updated", upd.data.updated).select("updated").maybeSingle();
        if (!fix.data) console.error("outbox", ORG, "could not record send outcomes (concurrent write) — will retry");
      }
    }
  }
  return { org: ORG, sent };
}

Deno.serve(async (req) => {
  const CRON = Deno.env.get("CRON_SECRET") || "";
  if (CRON && (req.headers.get("x-cron-key") || "") !== CRON) return new Response("401", { status: 401 });
  if (ONLY_ORG) console.warn("ORG env var is set — notify-rounds only serves: " + ONLY_ORG);
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
  for (const r of results) if ((r as any).error || (r as any).skipped) console.error("notify-rounds", (r as any).org, (r as any).error || (r as any).skipped);
  return new Response(JSON.stringify({ ok: true, orgs: results.length, sent }), { headers: { "Content-Type": "application/json" } });   // counts only — no org list or error text to callers
});
