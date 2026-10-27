# Myrosta — going multi-user with Supabase (shared live data)

The app is now **cloud-ready**. Out of the box it runs locally (data in each browser). Fill in three values and it switches the **whole app** to a shared Supabase database with **realtime sync** — book a shift on one device and everyone sees it.

## 1. Create a free Supabase project (~3 min)
1. Go to **https://supabase.com** → sign up → **New project**. Pick a name + a database password (save it). **Region: Sydney (Oceania · ap-southeast-2)** — keeps Australian staff data onshore, aligned with the Privacy Act 1988 & the APPs.

## 2. Create the table + policies
In the project: **SQL Editor → New query**, paste this and **Run**:

```sql
-- 1. the shared roster document, and 2. the allow-list of who may access it
create table if not exists org_state ( org text primary key, data jsonb, updated timestamptz default now() );
create table if not exists roster_members ( email text primary key, role text default 'staff', name text, phone text );

alter table org_state enable row level security;
alter table roster_members enable row level security;

-- give the logged-in role baseline table access (row-level rules below still restrict WHICH rows)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.org_state to authenticated;
grant select, insert, update, delete on public.roster_members to authenticated;

-- helpers (SECURITY DEFINER so they can check the list without recursion)
create or replace function public.is_member() returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from roster_members m
    where (lower(m.email)=lower(auth.jwt()->>'email'))
       or (nullif(auth.jwt()->>'phone','') is not null and m.phone=auth.jwt()->>'phone')); $$;
create or replace function public.is_admin_member() returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from roster_members m where m.role='admin'
    and ((lower(m.email)=lower(auth.jwt()->>'email'))
      or (nullif(auth.jwt()->>'phone','') is not null and m.phone=auth.jwt()->>'phone'))); $$;

-- only people on the allow-list can read/write the roster (drop-first so it's safe to re-run)
drop policy if exists "members all" on org_state;
create policy "members all" on org_state for all to authenticated using (public.is_member()) with check (public.is_member());
-- members can see the list; only admins can change it
drop policy if exists "list read" on roster_members;
create policy "list read"    on roster_members for select to authenticated using (public.is_member());
drop policy if exists "admins manage" on roster_members;
create policy "admins manage" on roster_members for all to authenticated using (public.is_admin_member()) with check (public.is_admin_member());

-- seed the FIRST admin so you can log in and manage everyone else (CHANGE the email):
insert into roster_members(email,role,name) values ('jamie@hospital...','admin','Admin')
  on conflict (email) do update set role='admin';

-- realtime sync (guarded so re-running won't error):
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='org_state') then
    alter publication supabase_realtime add table org_state;
  end if;
end $$;
```

After this, **only emails on `roster_members` can touch the data — even with a valid login.** You manage that list from inside the app (Admin settings → **Access control** → *Sync allow-list from staff + admins*, or add/remove individually). The seeded admin above is your bootstrap; everyone else you add from the app.

## 3. Get your keys
**Project Settings → API**: copy the **Project URL** and the **anon public** key.

## 4. Paste them into the app
Open `index.html`, near the top of the `<script>` find:

```js
const CLOUD={ url:"", key:"", org:"ed-default" };
```

Fill it in, including the **admin email(s)**:

```js
const CLOUD={ url:"https://abcd1234.supabase.co", key:"eyJhbGci...your-anon-key...", org:"ed-default",
              adminEmails:["you@yourhospital.org.au"], allowedDomains:["yourhospital.org.au","backup-admin@gmail.com"] };
```

- `allowedDomains` (optional) — the app refuses sign-in for emails outside this list (a friendly first gate; the real enforcement is the allow-list + RLS above). Each entry can be a **domain** (`yourhospital.org.au` — covers everyone on it, including subdomains) **or a specific email** (`person@gmail.com` — exactly that address, handy for a backup admin). Leave `[]` to allow any.

- `adminEmails` = whoever should have admin rights (sign in with that email → full admin). You can **also promote anyone from inside the app** later — **Admin settings → Access control → Make admin** — which sets their role in the allow-list; only an existing admin can do this (enforced by the database), and `adminEmails` stays as the bootstrap so you can't be locked out.
- Everyone else signs in and is matched to their **Staff record by email** — so fill in each consultant's email in the **Staff** tab. Unknown emails get a "No access" screen.
- Keep `org` as-is, or use different values like `"ed-night"` / `"ed-day"` to run separate independent rosters from the same database.

## 4b. Logins (6-digit code, passwordless)
The app shows a **sign-in screen** in cloud mode. Each person enters their work email → Supabase emails a **6-digit code** → they **type it into the app** (no link to click, nothing leaves the page — works smoothly on mobile). **Sessions persist**, so it's effectively a **one-time sign-in per device**: staff stay signed in for weeks and don't have to log in again every time the roster opens. Role (admin vs staff) comes from the email mapping above.

**Two Supabase settings make this work — do SMTP first, because Supabase won't let you edit the email template until custom SMTP is connected:**
1. **Custom SMTP** — **Authentication → Emails → "Set up SMTP"** (or Project Settings → Authentication → SMTP). The built-in email is **rate-limited to a few per hour** *and* **the templates are locked** — connecting your own email service fixes both. **Resend** is easiest (free tier): host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key, sender `noreply@myrosta.com.au`. (SendGrid / AWS SES / hospital SMTP also work.) Persistent sessions also help: once staff are signed in they stay in, so there's no recurring login rush.
2. **Show the code in the email** — **Authentication → Emails → "Magic link or OTP"** → toggle **Source** and put **`{{ .Token }}`** (the 6-digit code) in the body, e.g. `Your Myrosta sign-in code is {{ .Token }}`; set the Subject to `Your Myrosta sign-in code`. Without `{{ .Token }}` the default email only shows a magic link, not a code.

Set **Site URL** + **Redirect URLs** (**Authentication → URL Configuration**) to your hosted app URL.

**Restrict who can sign in:** by default anyone can request a link. Tighten it in **Authentication → Providers → Email** (or Auth settings) by limiting sign-ups to your hospital email domain. The app also blocks unknown emails at the "No access" screen, but domain-restricting sign-ups is the proper server-side gate. (Even stronger: an allowlist table + RLS keyed on `auth.email()` — I can add this.)

## 4c. SMS sign-in (optional, via Twilio)
Hospital mailboxes often block external email, so Myrosta can also sign people in with a **6-digit code by SMS**. Two parts: a one-time database migration, then connecting Twilio.

### i. Run the SMS migration (SQL Editor → New query → Run)
Adds a `phone` column to the allow-list and lets the access check match a mobile number as well as an email. **Safe to re-run; existing email sign-in is unchanged.**

```sql
alter table roster_members add column if not exists phone text;

create or replace function public.is_member() returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from roster_members m
    where (lower(m.email)=lower(auth.jwt()->>'email'))
       or (nullif(auth.jwt()->>'phone','') is not null and m.phone=auth.jwt()->>'phone')); $$;

create or replace function public.is_admin_member() returns boolean language sql security definer set search_path=public as $$
  select exists(select 1 from roster_members m where m.role='admin'
    and ((lower(m.email)=lower(auth.jwt()->>'email'))
      or (nullif(auth.jwt()->>'phone','') is not null and m.phone=auth.jwt()->>'phone'))); $$;
```

Then in the app: **Admin settings → Access control → Sync allow-list** — it now also pushes each consultant's **mobile** (from the Staff tab) into the list, so they can sign in by SMS. Keep mobiles filled in as `04xx xxx xxx`. (The app normalises them to `+61…` for sending and to `61…` to match Supabase's stored number.)

### ii. Connect Twilio — use **Twilio Verify** for Australia (Supabase → Authentication → **Sign In / Providers → Phone**)
**This is the path that works for AU mobiles.** Twilio Verify provisions Twilio's own Australia‑approved sender, so there's nothing to register and no number to buy.

> ⚠️ **Do NOT use a Messaging Service with an Alphanumeric Sender ID ("Myrosta") for Australia** — AU now requires alphanumeric Sender IDs to be **pre‑registered**, and an unregistered one fails with **Twilio error 21703** ("the Messaging Service has no sender that can deliver to this number" — the `From` shows blank, every message Failed). Registration takes days; Verify avoids it entirely. The branded "Myrosta" sender is a nice‑to‑have to add later, once registered.

1. **Twilio Console → Verify → Services → Create new** → name it `Myrosta` → copy the **Verify Service SID** (`VA…`).
2. **Supabase → Phone provider** → set **SMS provider = Twilio Verify** → paste **Account SID**, **Auth Token**, **Verify Service SID** (`VA…`) → **Save**. (No app redeploy — the sign‑in flow is identical; Verify issues the 6‑digit code that lands in the app's box.)
3. A **trial** Twilio account only texts **verified** numbers — **add credit / upgrade** before inviting the team.

In the app's sign-in screen **Mobile (SMS)** is the default; **Email** is one tap away as a fallback. Admins listed only in `adminEmails` (not as staff) still sign in by email.

## 5. Host it (so staff reach it)
Host `index.html` as in **DEPLOY.md** (hospital intranet recommended). Everyone who opens that URL now shares the same live data. A **Cloud ●** badge appears in the header when connected.

---

## How it works
- The entire app state is stored as one row in `org_state` (keyed by `org`).
- The app loads it on open, **saves changes back** (debounced), and **subscribes to realtime** — remote changes refresh automatically.
- First run with an empty database seeds it from whatever's currently in the app (use **New organisation** then import your cleaned files for a clean start).

## Security — current state
- **Login required** (passwordless 6‑digit email code; sessions persist per device). The public anon key alone reads nothing.
- **Allow-list + RLS (done):** the database only lets **emails (or mobiles) on `roster_members`** read/write — so even someone with a valid login but not on the list gets nothing, whether they use the app or call the database directly. Manage the list from the app (Access control).
- **Domain gate (done):** `allowedDomains` blocks sign-in attempts from outside your hospital domain(s). For belt-and-braces, also restrict sign-ups in **Supabase → Authentication** settings.
- **What's still app-side (not yet at the database):** the fine-grained *admin-vs-staff* and *"staff edit only their own bookings"* rules are enforced in the app, not the database — because the whole roster is stored as one document. A determined allow-listed member could, in theory, edit fields the UI wouldn't let them. For most ED teams that's an acceptable pilot risk; the full fix is **per-record tables** (one row per booking, with row-level rules) — a larger change to do if/when you need that level of assurance.
- For real staff data, still prefer **hospital intranet hosting** and involve **IT / information governance**.

## Concurrency note
The roster is stored as a single document (simple, matches the app). **Since 14 Oct 2026 a booking is a database call, not a document save:** `roster_commit()` (`supabase/prod-booking-rpc.sql`) locks the group's row, judges the shift against the roster as it is at that instant (the zone, the half's cap, the person's day, their leave), writes the one key and logs it, and every phone hears about it through a 300-byte `roster_events` row — so the whole group can tap at the same minute. The phone keeps a pick only once the database has confirmed it. Before that date each booking was a whole-document compare-and-swap, which lost under thirty-six simultaneous writers (`docs/INCIDENT-2026-10-14-booking-storm.md`). Other (admin) edits still save the whole document with a compare-and-swap and a merge, with a one-row `org_events` ping telling phones to refetch — fine for a small ED group. The app runs on a database without the booking call too: it probes for `roster_events` at load and otherwise books the old way.

## To turn cloud OFF again
Set `url` and `key` back to `""` — the app returns to local (per-device) mode.

## Security hardening (run once — 5 Jul 2026 council review)
The app never issues a DELETE on `org_state`, but the default grants allow any allow-listed member's browser to. Remove that ability (zero app impact):

```sql
revoke delete on public.org_state from authenticated;
```

Full server-side role enforcement (admin-gated settings/staff/structure writes) is scheduled inside the multi-org build — see MYROSTA-MULTIORG-BUILD.md.
