# Myrosta — live calendar feed (one-time server setup)

Staff can **subscribe** to their roster instead of downloading .ics files — changes then flow into their phone calendars automatically. The app side is already built and deployed (the **📅 Live calendar** button on *My shifts*). This doc is the **one-time server step** that switches it on.

**How it works:** each staff member gets a personal secret link like
`webcal://skpdqqhwrqgxsxawniho.supabase.co/functions/v1/ics?token=<36-char-secret>`.
A tiny server function (below) receives that request, looks up the token in your existing roster data, and returns that one person's shifts as a calendar feed. The token is minted by the app the first time someone taps **📅 Live calendar**, and can be reset (old link dies instantly) from the same panel.

---

## Switch it on (~5 minutes, Supabase dashboard)

1. Open **supabase.com → your project (skpdqqhwrqgxsxawniho) → Edge Functions** (left sidebar).
2. **Deploy a new function** → *Via Editor*. Name it exactly: **`ics`**
3. Delete the sample code and **paste the entire contents of** `supabase/functions/ics/index.js` (in this project folder). **Deploy.**
4. **Critical step:** open the function's **Details / Settings** and turn **OFF "Enforce JWT verification"**.
   *Why: calendar apps (Apple/Google) fetch the URL with no login headers — the secret token in the URL is the credential. With JWT verification on, every phone gets rejected.*
5. Test: in the app, *My shifts* → **📅 Live calendar** → **Copy**, paste into a browser **replacing `webcal://` with `https://`**. You should see calendar text starting `BEGIN:VCALENDAR` with your shifts. (`Not found` = wrong/missing token or the app hasn't synced the token yet; re-open the panel and retry.)
6. On an iPhone: tap **Open (iPhone)** → *Add Subscribed Calendar*. Done — it now updates itself.

No keys to paste anywhere: the function uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects into the function's environment automatically. The service-role key never appears in the app or this file.

## Staff instructions (once it's on)
- **iPhone:** My shifts → **📅 Live calendar** → **Open (iPhone)** → *Add Subscribed Calendar*.
- **Google Calendar:** My shifts → **📅 Live calendar** → **Copy** → Google Calendar Settings → *Add calendar → From URL* → paste, changing `webcal://` to `https://`.
- Roster changes appear automatically (Apple: within hours; Google: up to a day). The **⬇ Add to calendar (.ics)** download remains as the instant-snapshot fallback.

## Security notes (honest)
- **The link is the password.** It exposes one person's shifts (names of zones/dates only — no contact details, no payroll number). **Reset link** kills a leaked URL instantly and mints a new one; each reset is audit-logged.
- Tokens live inside the shared roster data, so signed-in colleagues could technically derive each other's links — they already see the whole roster in-app, so this exposes nothing new *within* the team. When Myrosta goes multi-org, tokens should move to their own table (noted in MYROSTA-MULTIORG-BUILD.md).
- The function returns only `open / closed / published` cycles — **drafts and archived cycles never leak**.
- Invalid or absent tokens get a bare `404 Not found` with no detail.

## What the feed contains (mirrors the fixed .ics export)
- Clinical shifts anchored to `Australia/Melbourne` (AEST/AEDT-safe): AM 08:00–16:00, PM 15:30–23:30
- The overnight **On-call (23:30–08:00)** event for ROC+OC shifts
- All-day events for CST, leave and Unavailable
- Same event IDs (`@myrosta.v2`) as the manual export, so the two sources stay consistent
