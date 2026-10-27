# Myrosta — deployment guide

The app is a single self-contained file: **`index.html`**. It runs entirely in the browser and stores its data in that browser (localStorage). No server is needed to *use* it — but to let staff use it from their **own devices with shared data**, you need hosting + a shared backend (see Phase B).

---

## Phase A — put it online (fast, for the demo / single-admin use)

Data still lives per-device (each browser keeps its own copy). Good for: a director demo, or one admin driving the roster on screen and sharing exports.

**Option 1 — instant shareable link (≈2 min, no account):**
1. Go to **https://app.netlify.com/drop**
2. Drag **`index.html`** onto the page.
3. You get a public URL (e.g. `https://random-name.netlify.app`) you can send to anyone.
   - Create a free Netlify account to make the link permanent and rename it.

**Option 2 — permanent free hosting:** Netlify, Vercel, Cloudflare Pages, or GitHub Pages — all free for a static file. Create an account, upload `index.html`, done.

**Option 3 — hospital intranet / SharePoint:** ask IT to host `index.html` on an internal site. Best for governance (data stays inside the hospital network). **Recommended for real staff data.**

To load data onto the hosted version, sign in as admin and use **Admin settings → Import data** (your roster, leave planner and EFT files), or the **Staff template** if you have no spreadsheets. Once configured, the data lives in the cloud database and syncs across devices — there's no file to copy by hand.

---

## Phase B — true multi-user (staff self-roster from their own devices, shared live data)

This needs a **backend** (a shared database + simple login) because browsers can't share localStorage. The app is already structured for this: all reads/writes go through two functions (`load()` and `save()`), so wiring a backend is a contained change.

**Recommended stack (free tier, no server to manage):**
- **Static hosting:** Netlify/Vercel (Phase A).
- **Backend:** **Supabase** (free) — a hosted database with built-in **auth** (per-person login) and **realtime** sync.

**What it involves (I do the coding):**
1. You create a free Supabase project (5 min) and send me the **project URL** + **anon public key**.
2. I wire `load()`/`save()` to read/write the roster from Supabase instead of localStorage, add **login** (passwordless 6‑digit email code, with sessions that persist per device), and **roles** (admin vs staff) enforced server-side.
3. Realtime so a shift booked on one device updates everyone; per-record writes so concurrent edits don't clobber.

**Effort:** roughly a focused build once the Supabase project exists. *(Done — Myrosta now runs on Supabase with passwordless login, an access allow‑list, realtime sync, and provider‑automated backups.)*

---

## Important before using real staff data online
- The data includes **mobile numbers and leave** — personal information. Keep it behind a **login** (Phase B) and check your hospital's **information-governance / IT security** rules first.
- For a pilot with real data, prefer **hospital intranet hosting** (Option 3) over public hosting.
- Public Phase-A links have **no login** — only use them with **demo/anonymised data** (use *New organisation* to clear, or a sample import).

---

## Quick reference
- **Use locally:** double-click `index.html`, or serve with `python3 serve.py` → http://localhost:4173
- **Back up:** automatic — the cloud database keeps continuous point‑in‑time backups (no in‑app backup to manage).
- **Start clean for a demo:** Admin settings → New organisation, then Import your cleaned roster + leave planner
