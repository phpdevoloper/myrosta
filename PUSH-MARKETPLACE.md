# Myrosta — open-shift marketplace + phone push (setup & how it works)

Two features, shipped together (Aug 2026), both **OFF by default** until the admin switches them on.

## What they do

**Open-shift marketplace** (Admin settings → Open-shift marketplace → On)
- **Admin broadcast:** post a post-publication gap (date + period + zone + note) — every consultant sees it on *My shifts* under **Open shifts**, and the bell rings.
- **Give-away:** a consultant taps **↗ Offer to group** on one of their own upcoming shifts — colleagues can take it over; the shift transfers automatically.
- **Claims:** *First-come wins* (default) or *Admin approves* — a per-organisation setting. Every claim passes the same guards as any booking: leave, double-booking, zone cover, fatigue rules; quota is enforced unless "Over-quota gap fill: Allowed" (then the claimant confirms they're taking extra cover).
- Everything is audit-logged, race-safe (two people tapping Claim — exactly one wins, the other sees "Too late"), and merge-safe offline.

**Phone push** (same admin card → Phone notifications → On)
- Staff tap **🔔 Get open-shift alerts on this phone** on *My shifts* — after that, marketplace events reach their phone even with the app closed.
- iPhone: works on iOS 16.4+ **only when Myrosta is added to the Home Screen** (the button explains this if tapped from Safari).
- The bell inside the app keeps working regardless; push is an extra layer, and the app icon shows an unread badge where the platform supports it.

## One-time server setup (~5 minutes, needed for push only)

The marketplace works with no server setup. Push needs one function + two secrets:

1. **supabase.com → your project → Edge Functions → Deploy a new function → Via Editor.**
   Name it exactly: **`push-send`** — paste the contents of `supabase/functions/push-send/index.js`, Deploy.
2. Open the function's **Secrets** and add:
   - `VAPID_PUBLIC` — the public key (it's also embedded in the app; both copies are in *"Myrosta VAPID keys - KEEP PRIVATE.txt"* on your Desktop)
   - `VAPID_PRIVATE` — the private key from the same file. **This key exists nowhere else — not in the app, not in the repo.**
   - `SERVICE_ROLE_KEY` — already exists if the notify-* functions are set up; otherwise add it (Settings → API → service_role).
3. Turn **"Verify JWT with legacy secret" OFF** (function Settings → toggle → Save). On new-key projects the gateway's legacy check rejects genuine staff sign-in tokens; the function does its own stronger check inside (verifies the caller's token server-side, then matches them against the allow-list) — exactly the "custom auth logic" case the dashboard recommends OFF for.
4. In the app: **Admin settings → Open-shift marketplace → Phone notifications → On.** Then each person enables it per phone from *My shifts*.

## Security notes (honest)

- The function only accepts calls from **signed-in allow-listed members** (JWT verified server-side, then matched against `roster_members` by email or phone).
- Push payloads carry only what the bell shows: date, period, zone, a name — no phone numbers, no payroll data.
- Subscriptions live inside the shared org state (like the calendar tokens). A colleague could technically see another's push endpoint — it's useless without the VAPID private key, which only the server holds. Move to their own table at multi-org time (noted in MYROSTA-MULTIORG-BUILD.md).
- Expired device subscriptions cost one failed send each and self-heal when the device re-enables; they're not pruned server-side (would need a CAS write-back — not worth it at pilot scale).

## Design decisions (locked Aug 2026)

- Claim mode and over-quota bypass are **admin-configurable** (first-come vs approve; allowed-with-confirm vs blocked).
- Fixed shifts can't be given away (ask your admin — consistent with unbook rules).
- A claimed shift follows the assignment array, which is already race-hardened: if a merge ever produces a "claimed" note whose shift didn't stick, the note deterministically reverts to open (`merge.fix` audit entry).
- Entries auto-expire the day after the shift date (deterministic sweep, all devices agree).
- Web Push, not a native app: same decision as the mobile-app question — the PWA path covers it (see session notes / CHANGELOG).
