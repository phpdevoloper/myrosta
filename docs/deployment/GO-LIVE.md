# Myrosta — go-live runbook

Two paths. Use **A** to show the director this week; **B** for real shared multi-user use.

---

## Path A — quick demo link (≈5 min, no backend, no login)
Data stays per-device. Use demo/representative data only.

1. In the app locally: **Admin settings → New organisation**. Then either:
   - **Have spreadsheets?** → **Import data** → upload your roster, leave planner and **EFT tracker** (`.xlsx`). The app reads them as‑is (the EFT tracker also fills employee numbers used by the payroll export).
   - **No spreadsheets?** → follow the **Get started** guide at the top of Admin settings: **download the Staff template**, fill it, upload — the app builds the roster for you.
2. Go to **https://app.netlify.com/drop**.
3. Drag your project **folder** (the one containing `index.html`) onto the page.
4. You get a public link (e.g. `https://myrosta.netlify.app`). Share it. Done.
   - (Optional) Make a free Netlify account to keep the link permanent and rename it.

That's enough for a director/clinician demo. For real staff using it from their own devices, do Path B.

---

## Path B — full live multi-user (≈30 min)

You'll need: a free **Supabase** account (database + logins) and a host for the file (**Netlify**, or your **hospital intranet** — preferred for real data). Both have free tiers; the Supabase anon key is safe to put in the file (the database rules protect the data).

### Step 1 — Create the database (Supabase)
1. Go to **https://supabase.com** → sign up → **New project**. Name it, set a DB password (save it), and choose **Region: Sydney (Oceania · ap-southeast-2)** for Australian data residency. Wait ~2 min for it to provision.
2. Left menu → **SQL Editor → New query**. Open `SUPABASE.md`, copy the big SQL block, paste it in.
3. **Change the seeded admin email** in that SQL (the `insert into roster_members ... 'jamie@hospital...'` line) to **your** work email.
4. Click **Run**. You should see "Success".

### Step 2 — Get your keys
1. Left menu → **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.

### Step 3 — Put the keys in the app
1. Open `index.html` in a text editor. Near the top of the `<script>` find:
   ```js
   const CLOUD={ url:"", key:"", org:"ed-default", adminEmails:[], allowedDomains:[] };
   ```
2. Fill it in:
   ```js
   const CLOUD={ url:"https://YOURPROJECT.supabase.co", key:"YOUR-ANON-KEY",
                 org:"ed-default", adminEmails:["you@yourhospital.org.au"], allowedDomains:["yourhospital.org.au","backup-admin@gmail.com"] };
   ```
   - `adminEmails` = your email (and any other admins).
   - `allowedDomains` = your hospital email domain(s) — you can **also list a specific personal email** (e.g. a backup admin), not just domains. Leave `[]` to allow any.
3. Save the file.

### Step 4 — Host the app
- **Netlify:** go to **https://app.netlify.com/drop**, drag the folder containing your edited `index.html`. Copy the URL it gives you. (Free account = permanent + custom name.)
- **Hospital intranet:** ask IT to publish `index.html` on an internal site. **Recommended for real data.** Copy that internal URL.

### Step 5 — Tell Supabase the app's address + turn on the code email
1. **URL Configuration** — Supabase → **Authentication → URL Configuration**: set **Site URL** to your hosted URL (Step 4) and add the same URL under **Redirect URLs**. Save.
2. **Custom SMTP first** — Supabase → **Authentication → Emails → "Set up SMTP"** (or Project Settings → Authentication → SMTP). Connect an email service — **Resend** is easiest (free): host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key, sender `noreply@myrosta.com.au`. This **unlocks template editing** *and* removes the built-in email rate limit. *(Supabase won't let you edit the email body until custom SMTP is connected.)*
3. **Add the code to the email** — Supabase → **Authentication → Emails → "Magic link or OTP"** → toggle **Source** and make the body include **`{{ .Token }}`** (the 6‑digit code), e.g. a line `Your Myrosta sign-in code is {{ .Token }}`. Set the Subject to `Your Myrosta sign-in code`. Save. *(Without `{{ .Token }}` the default email only shows a magic link, not a code.)*

### Step 6 — First sign-in + load the data
1. Open your hosted URL. You'll see a **sign-in** screen. Enter your admin email → check your inbox → **type the 6‑digit code** → you're in as **admin** (you stay signed in on that device).
2. **Admin settings → New organisation** (clean slate), then **Import data** → upload your roster, leave planner and EFT tracker (or use the **Staff template** if you have no spreadsheets).
3. **Configure** (Admin settings): set zones + minimum/maximum cover and the **extra‑slot order** (AM&PM together / AM‑first / PM‑first); pick the **self‑roster method** (cohort waves / snake‑draft / guarded / auto‑draft+adjust); set how the **quota** is counted (default per fortnight, to match pay).
4. **Admin settings → Access control → "Sync allow-list from staff + admins"** — this lets your staff (by their emails) sign in. Make sure each consultant's email is filled in the **Staff** tab first. *(To give someone admin rights later, use the **Make admin** button next to their name.)*
5. Publish the cycle when ready (**Admin settings → Roster status → Publish**).

### Step 7 — Invite staff
Send them the URL. They open it → enter their work email → **type the 6‑digit code** → they're in, seeing only their own profile (and they stay signed in). Booking a shift on one device updates everyone live.

---

## Custom domain (myrosta.com.au)
Registered under your ABN — now point it at the app:
1. **Netlify → your site → Domain management → Add a domain** → `myrosta.com.au` (add `www.myrosta.com.au` too).
2. **DNS** (at your registrar): add the records Netlify shows — typically a **CNAME** `www → <your-site>.netlify.app`, plus Netlify's **A / ALIAS** record for the apex `myrosta.com.au`. *(Simplest: switch the domain's nameservers to Netlify DNS — it configures the records for you.)*
3. **HTTPS:** Netlify auto‑issues a Let's Encrypt certificate once DNS resolves (a few minutes to a couple of hours).
4. **Tell Supabase the new address:** **Authentication → URL Configuration** → set **Site URL** and add a **Redirect URL** = `https://myrosta.com.au`.
5. **Test:** open `https://myrosta.com.au` → sign in with the 6‑digit code → reload to confirm you stay signed in.

**Order matters:** get DNS + HTTPS live first, *then* update the Supabase URLs, *then* test sign‑in — otherwise the login won't land on the right address.

## Verify it's working
- Header shows **Cloud ●** (green) when connected.
- Sign in on a second device/browser as a different person → changes sync both ways.
- A non-allow-listed email → "No access" screen.

## Good to know
- **Cost:** Netlify + Supabase free tiers are fine for one ED department. Supabase free projects **pause after ~1 week of no activity** (they wake on next use; a paid tier or weekly use avoids it).
- **Governance:** real staff data (mobiles, leave) → involve **hospital IT / information governance**, and prefer **intranet hosting**. Keep the public link private if you use Netlify.
- **Turn cloud off:** set `url` and `key` back to `""` → app returns to local per-device mode.
- **Updates:** to change the app later, edit `index.html` and re-drag it to Netlify (or replace the intranet file). Data lives in Supabase, so it's unaffected.
