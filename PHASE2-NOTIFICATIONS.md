# Phase 2 — email / SMS reminders for scheduled rounds

Phase 1 (in the app) flips self‑roster open/closed at the times you set and posts an **in‑app** notification. Phase 2 adds **email (and optional SMS) reminders** sent automatically: when a round **opens**, **24 h before it closes**, and when it **closes**.

It's a small **Supabase Edge Function** you deploy once. The function is at
`supabase/functions/notify-rounds/index.ts` (already written for you).

---

## What you need
- **Resend** — already set up for sign‑in emails. Reused here (no extra cost on the free tier for this volume).
- **Twilio SMS is optional.** Your OTP uses Twilio **Verify**, which *cannot* send these reminders. SMS reminders need a Twilio **Messaging** sender (a number or a registered Messaging Service) — and for Australia that sender must be **registered** (the same hurdle as before). **Email reminders work immediately; add SMS later if you want it.**

---

## Deploy (≈10 min, one‑off)

### 1. Install the Supabase CLI & log in
```bash
npm i -g supabase        # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref skpdqqhwrqgxsxawniho
```
(The function file already lives in `supabase/functions/notify-rounds/`.)

### 2. Set the secrets
```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxx \
  NOTIFY_FROM_EMAIL=noreply@myrosta.com.au \
  APP_URL=https://myrosta.com.au \
  ORG=ed-default
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't set them.

*(Optional SMS later)* add:
```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxx TWILIO_AUTH_TOKEN=xxxx TWILIO_FROM=MGxxxx
```
`TWILIO_FROM` = a **Messaging Service SID** (`MG…`) or a sender number. (Not the Verify SID.)

### 3. Deploy the function
```bash
supabase functions deploy notify-rounds --no-verify-jwt
```

### 4. Schedule it (every 5 minutes)
**Easiest — Dashboard:** Supabase → **Edge Functions → notify-rounds → Schedules → Add schedule** → cron `*/5 * * * *`.

**Or via SQL** (needs the `pg_cron` + `pg_net` extensions, enable under Database → Extensions):
```sql
select cron.schedule('myrosta-notify-rounds', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://skpdqqhwrqgxsxawniho.functions.supabase.co/notify-rounds',
    headers := jsonb_build_object('Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>')
  );
$$);
```

### 5. Test
In the app (Self‑roster → 📅 Schedule), set **Opens** to ~2 minutes from now and **Enable** → Save. Within the next 5‑minute tick the function should email everyone "Self‑roster is open." Check **Edge Functions → Logs** and your inbox.

---

## How it works / notes
- The function reads the same `cycle.window` you set in the app, plus the `roster_members` allow‑list for recipient emails/phones.
- It marks server‑side flags (`window.notif.open/reminder/close`) so each message sends **once**, and uses a compare‑and‑swap write so it never clobbers a booking made at the same moment.
- It runs independently of the in‑app Phase 1 flip — staff get both the live in‑app notification **and** the email/SMS.
- Reminders go to **everyone on the allow‑list**. If you'd rather only message people who haven't hit quota, that's a later refinement.
---

## Shift reminders ("you're on tomorrow")
A second function — `supabase/functions/notify-shifts/index.ts` — emails/texts each consultant **their own** shift for the next day (skips anyone off or on leave; notes locum shifts). It reuses the same secrets.

```bash
supabase functions deploy notify-shifts --no-verify-jwt
```
Schedule it to run **once daily** (Dashboard → Edge Functions → **notify-shifts** → Schedules), e.g. **`0 8 * * *`** — it reminds about *tomorrow*, so early‑evening is ideal. People are messaged on their **personal email / mobile**. Set a `TZ` secret if your department isn't `Australia/Melbourne`.

> Cron is in **UTC** and doesn't follow daylight saving: `0 8 * * *` ≈ 6 pm AEST / 7 pm AEDT. Nudge the hour if you want it exact year‑round.
