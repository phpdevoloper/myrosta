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

## Environments — dev vs production backend

The app is static, so the Supabase project is baked into `src/config/cloud.js` (the `CLOUD` block). Two gitignored files at the repo root hold the values; copy `.dev_config.example` / `.prod_config.example` and fill them in (project URL, **anon** key, org, admin emails, VAPID public key — never the service key).

| Command | Writes | Use for |
|---|---|---|
| `python tools/use-env.py dev` | `src/config/cloud.js` | local work / staging |
| `python tools/use-env.py prod` | `src/config/cloud.js` and `deploy/src/config/cloud.js` | building `deploy/` for myrosta.com.au |
| `python tools/use-env.py prod --check` | nothing; exit 1 if `deploy/src/config/cloud.js` differs from `.prod_config` | verify before shipping |

Rules: never copy `src/config/cloud.js` into `deploy/` by hand (it holds the dev project); run `use-env.py prod` instead. The `env-config` gate in `.claude/myrousta-dlc/gates/run_gates.py` runs the `--check` on every release and blocks a commit if `deploy/` points at the wrong project. It only warns when `.prod_config` is missing or still has placeholders.

---

## Shipping a code change

1. `python tools/build-deploy.py`. It stamps `app.html`'s tags with `?v=<code hash>` (phones learn about a new release from `app.html` changing), rebuilds `preview.html`, rewrites `deploy/` from the source tree with the production `cloud.js` from `.prod_config`, and builds `deploy/demo.html`. It refuses while `.prod_config` has placeholders; `--allow-dev` builds with the dev project for local checks only.
2. Never edit `deploy/` by hand: change the source and rebuild. The `deploy` test fails on any difference.
3. For an app release, bump `BUILD` in `src/infrastructure/local/persistence.js` to the date of the newest CHANGELOG heading (entries marked "(tools only)" or "(site only)" don't count).
4. `python tests/run.py`. On Windows and Linux it needs Node and `pip install -r tools/requirements.txt`.

---

## Important before using real staff data online
- The data includes **mobile numbers and leave** — personal information. Keep it behind a **login** (Phase B) and check your hospital's **information-governance / IT security** rules first.
- For a pilot with real data, prefer **hospital intranet hosting** (Option 3) over public hosting.
- Public Phase-A links have **no login** — only use them with **demo/anonymised data** (use *New organisation* to clear, or a sample import).

---

## Quick reference
- **Use locally:** double-click `index.html`, or serve with `python3 tools/serve.py` → http://localhost:4173
- **Back up:** automatic — the cloud database keeps continuous point‑in‑time backups (no in‑app backup to manage).
- **Start clean for a demo:** Admin settings → New organisation, then Import your cleaned roster + leave planner
