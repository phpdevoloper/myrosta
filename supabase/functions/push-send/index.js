// Myrosta — push-send edge function
// Sends Web Push notifications to staff phones for marketplace events (open shift posted / claimed / pending).
// Caller must be a signed-in roster member (their session JWT rides in the Authorization header).
// Secrets required (Edge Functions → push-send → Secrets):
//   VAPID_PUBLIC   — the public key (same value embedded in the app)
//   VAPID_PRIVATE  — the private key (nowhere else but here)
//   SERVICE_ROLE_KEY — already set for the notify-* functions; reused here
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (body, status, extra) =>
  new Response(body, { status: status || 200, headers: { ...CORS, ...(extra || {}) } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return resp("ok");
  if (req.method !== "POST") return resp("Not found", 404);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return resp("401", 401);
    const url = Deno.env.get("SUPABASE_URL");
    const svc = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const pub = Deno.env.get("VAPID_PUBLIC"), priv = Deno.env.get("VAPID_PRIVATE");
    if (!url || !svc) return resp("service key not configured", 500);
    if (!pub || !priv) return resp("VAPID not configured", 500);

    const admin = createClient(url, svc);

    // 1) the caller must be a real signed-in user…
    const { data: userData, error: uerr } = await admin.auth.getUser(jwt);
    if (uerr || !userData || !userData.user) return resp("401", 401);
    const email = (userData.user.email || "").toLowerCase();
    const phone = String(userData.user.phone || "").replace(/\D/g, "");

    // 2) …who is on the allow-list OF THE ORG THEY ARE SENDING TO.
    //    Multi-org critical: the org comes from the request body, so the membership check MUST be
    //    scoped to that same org — otherwise any member of any organisation could push notifications
    //    to another organisation's staff. Falls back to an unscoped check on a pre-migration database
    //    (roster_members has no `org` column yet), where there is only one organisation anyway.
    const body = await req.json();
    const org = String(body.org || "ed-default");
    const noOrgColumn = (e) => !!e && (String(e.code) === "42703" || /column .*org.* does not exist/i.test(String(e.message || "")));
    let members = null;
    {
      const scoped = await admin.from("roster_members").select("email,phone").eq("org", org);
      if (!scoped.error) members = scoped.data;
      else if (noOrgColumn(scoped.error)) {
        // pre-migration database (no org column yet): one organisation exists, unscoped check is equivalent
        const legacy = await admin.from("roster_members").select("email,phone");
        if (legacy.error) return resp("403", 403);
        members = legacy.data;
      } else {
        // any OTHER error (transient, 5xx, timeout): FAIL CLOSED — never fall back to the
        // unscoped check on a migrated database, or a member of one organisation could be
        // authorised against another organisation's allow-list.
        return resp("403", 403);
      }
    }
    const isMember = (members || []).some((m) =>
      (m.email && String(m.email).toLowerCase() === email && email) ||
      (m.phone && phone && String(m.phone).replace(/\D/g, "").slice(-9) === phone.slice(-9))
    );
    if (!isMember) return resp("403", 403);

    // 3) load subscriptions from that org's state
    const { data: row } = await admin.from("org_state").select("data").eq("org", org).maybeSingle();
    const subs = (row && row.data && row.data.pushSubs) || [];

    // 4) target: array of staffIds, or everyone; optional exclude (the actor's own devices)
    let list = subs;
    if (Array.isArray(body.targets)) list = subs.filter((s) => body.targets.includes(s.staffId));
    if (body.exclude) list = list.filter((s) => s.staffId !== body.exclude);
    if (!list.length) return resp(JSON.stringify({ sent: 0, of: 0 }), 200, { "Content-Type": "application/json" });

    webpush.setVapidDetails("mailto:drranjith0713@gmail.com", pub, priv);
    const payload = JSON.stringify({
      title: String(body.title || "Myrosta").slice(0, 80),
      body: String(body.body || "").slice(0, 160),
      tag: String(body.tag || "").slice(0, 60),
    });
    const results = await Promise.allSettled(list.map((s) => webpush.sendNotification(s.sub, payload)));
    const sent = results.filter((r) => r.status === "fulfilled").length;
    // expired endpoints (410/404) are left in place — they cost one failed send and get replaced
    // when that device re-subscribes; pruning would need a CAS write-back, not worth it at this scale.
    return resp(JSON.stringify({ sent, of: list.length }), 200, { "Content-Type": "application/json" });
  } catch (_e) {
    return resp("error", 500);
  }
});
