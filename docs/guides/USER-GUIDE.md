# Myrosta — User Guide

*Self‑rostering, leave and shift‑swaps for the Emergency Department.*

Myrosta replaces the manual roster spreadsheet with a simple web app the whole team uses from any device. It shows each consultant their own shifts, lets the group self‑roster fairly, handles leave and swaps with full context, and exports straight to payroll. Your data lives securely in the cloud (hosted in Australia) and syncs live — book a shift on your phone and everyone sees it instantly.

---

## Getting in (everyone)

1. Open **https://myrosta.com.au** on any device and tap **Sign in**.
2. Choose **📱 Mobile (SMS)** (the default) and enter your mobile, or tap **✉️ Email** → **Send code**.
3. Type the **6‑digit code** you receive (by text or email) → **Verify**.
4. You're in. **You stay signed in on that device** — it's a one‑time thing, no password to remember.

> **On a shared or ward computer?** Tick **This is a shared computer** at sign‑in — that session won't stay logged in and signs out when you close it or after a short idle. On your own phone, leave it unticked and you stay signed in.

**Install it like an app (recommended):**
- **iPhone/iPad (Safari):** Share button → *Add to Home Screen*.
- **Android (Chrome):** ⋮ menu → *Add to Home screen / Install app*.
- **Computer (Chrome/Edge):** the install icon in the address bar.

It then opens full‑screen from your home screen, just like a native app.

> **No code arriving?** Check your junk/spam folder. Codes expire after about an hour — if it's been a while, tap **Resend code**. If your hospital email blocks external mail, use **📱 Mobile (SMS)** instead. Still nothing → contact your roster admin (your mobile/email may not be on the access list yet).

---

# For Staff

When you sign in you'll see tabs across the top: **Roster, Self‑roster, Daily, Leave planner, Requests, My shifts, Messages**. Here's what each does.

## My shifts — your shifts, on your phone
- See only **your own** shifts, as an **agenda list** or a **month calendar**.
- Weekends are shaded so they're easy to spot.
- **Locum shifts** (ones you cover on top of your roster) show in **pink with an ‘L’**, and in your shift tally.
- Tap **Add to calendar** to push your shifts (with reminders) straight into your phone's calendar (Apple/Google/Outlook/Teams) as a `.ics` file.

## Self‑roster — claiming your shifts
When the admin opens a rostering round, go to **Self‑roster** to pick your shifts. How it works depends on the method your admin chose:

- **In random groups** — everyone is split into random groups that book in turn (the order is re-drawn each cycle). When your group is picking you'll see the open slots; book yours, then tap **I'm done — pass my remaining picks** so the next group can open.
- **Take turns** — everyone picks one at a time, and the order reverses each round so no one is always last.
- **Everyone at once** — open booking, but fairness rules stop anyone racing ahead of their share.
- **Pre-filled, then adjust** — the app drafts a fair roster for you; you then tweak/swap where needed.

In every method:
- You only see slots that are **still available** — once someone takes a shift it disappears for everyone else, so **two people can never book the same slot** (it's collision‑proof).
- Your progress shows against your **quota** (how many shifts you owe, usually counted per fortnight to match pay).
- Tap a slot to **book**; tap your own booked slot to **release** it (while the round is open).

## Requesting leave
1. **Requests → Request leave**.
2. Pick the **dates** and the **type** (Annual, CME, Long service, Parental, Public holiday, etc.) and add a note if needed.
3. Submit. Your admin sees it with full context and approves it. You'll be **notified**, and it appears on the **Leave planner** and your roster automatically.

> **Off sick?** Choose **UPL — Unplanned leave**. Once your admin actions it, your shift comes off the roster and the gap is visible for a colleague to pick up as **locum** cover.

## Requesting a shift swap
1. **Requests → Request a swap**.
2. Choose **your shift**, the **colleague**, and **their shift** you'd like to swap into.
3. Submit. The swap goes to the admin (and the colleague is notified). Once approved, both rosters update.

## The Leave planner — plan around the whole team
- A colour‑coded grid of the **whole year's leave** for everyone, by type.
- See at a glance **how many people are away** on any day, so you can plan requests that are likely to be approved.

## Fixed patterns (if you work a set pattern)
If you have a recurring pattern (e.g. every Tuesday AM, or a fortnightly A/B week):
- See it under your name in the **Staff** view (your admin sets these up).
- If your pattern is **committed/locked** and you need a change, use **Submit change for approval** — it goes to the admin rather than changing silently.

## Messages, reminders & help
- The **bell** shows alerts: approvals, roster changes, when self‑roster opens, messages.
- You may also get an **email or text** when a round opens or before a shift (if your admin has reminders on).
- The **Help** tab has quick guides and FAQs any time.
- **Send feedback** — *Help → 💬 Send feedback* goes straight to your roster admin (a bug, an idea, or something confusing).
- **Messages** lets you message the admin or the team.

---

# For Admins

Admins see everything staff see **plus** three tabs: **Admin settings, Staff, Audit**.

## 1. First‑time setup
From **Admin settings → New organisation** (clean slate), then either:
- **Have spreadsheets?** → **Import data** → upload your **roster**, **leave planner**, and **EFT** files. Myrosta reads them as‑is, pulling in everyone's EFT, hours and employee numbers.
- **No spreadsheets?** → follow the **Get started guide** at the top of Admin settings: download the **Staff template**, fill it in, upload — Myrosta builds the department for you.

## 2. Configure the department (Admin settings)
- **Zones** — your clinical areas; set how many are needed each period/day.
- **Minimum & maximum cover** — the floor and ceiling for each day.
- **Extra‑slot unlock order** — when both AM and PM open together, AM first, or PM first.
- **Self‑roster method** — cohort waves / snake‑draft / guarded / auto‑draft+adjust. Fixed patterns can leave the zone **Any (auto)** — auto‑draft places that shift in a balanced free zone around any fixed‑zone pins, and flags clashes.
- **Quota period** — how shift quotas are counted (default **per fortnight**, to match pay; also cycle/week/month).
- **Uneven quota & per‑cycle** — **Staff choose** lets a consultant place an uneven extra shift in the fortnight that suits. Cover, zones, method and quotas are saved **per cycle**, so changes never alter a published cycle; **Prepare next cycle** copies the current setup.

## 3. Run a self‑roster round
1. Build the base roster (import, or **Self‑roster → Auto‑draft → minimum cover** to have Myrosta draft a fair, fully‑covered roster in seconds).
2. **Release for self‑roster.** With **cohort waves**, start the waves and they advance automatically as each cohort finishes.
3. Watch coverage and quotas fill in real time. Step in to **manually edit** any cell whenever you need.
4. **Schedule it (optional).** On the Self‑roster tab, set **Schedule open & close** date‑times — Myrosta auto‑opens and auto‑closes the round, shows a countdown, and notifies everyone. (Email/SMS reminders are an optional add‑on.)

## 4. Approve requests with context
**Requests** shows each leave/swap with the context you need to decide: the person's **EFT**, **leave already taken**, **who else is away** those days, and whether you'd **breach the daily cap**. Approve or decline in one tap — Myrosta updates the roster + leave planner, notifies the person, and even drafts the confirmation email.

## Unplanned leave (sick days) & locum cover
When someone calls in sick, they log **UPL — Unplanned leave**; approving it **clears their booked shift**, leaving a visible gap. If a colleague covers, open that vacant cell in the **Roster** grid, assign them, and tick **Locum cover** — flagged with an **L** on the roster, a **Locum** tag in Daily, and **Locum** in the payroll export.

## 5. Manage staff & access
- **Staff** tab — add/remove people, set rostering mode, EFT/hours, payroll number, and **fixed patterns** (weekly or fortnightly A/B; **Commit (lock)** to fix them; staff changes to a locked pattern come to you for approval).
- **Non‑clinical / admin & per‑cycle roster** — set coordinators/clerks to **Non‑clinical** to keep them off the roster; **who's rostered and each person's quota/EFT are per cycle** (**+ Add to this cycle** / **Remove from this cycle**). A **Title** field groups people in the RosterOn export.
- **Admin settings → Access control** — **Sync allow‑list** so your staff (by email) can sign in. To give someone admin rights, use **Make admin** next to their name. (Only existing admins can do this.)
- **Shared / ward computers** — staff can mark a session as shared at sign‑in; set the **idle auto‑logout** time here in Access control.

## 6. Payroll export
Once the roster's set, the **Payroll (RosterOn)** button exports every shift in one click — correct shift times (AM 08:00–16:00, PM 15:30–23:30, on‑call, CST) and leave pro‑rated by EFT, with no re‑keying. You can upload your own RosterOn import template so the columns map automatically, and choose the date format. The **RosterOn sheet** button builds a readable roster (grouped by **Title**, with overnight **OC**) plus a clean data sheet. **All export buttons are admin‑only.**

## 7. Publish & audit
- **Roster status → Publish** when the cycle is ready.
- **Backups are automatic** — the cloud database keeps continuous point‑in‑time backups, so there's nothing to download or restore by hand.
- **Audit** logs every approval and change — nothing happens off the record.

---

## Good practice for the whole team
- **Sign in once on your phone and install it** — then you're always one tap away, already logged in.
- **Add your shifts to your calendar** so you get reminders.
- **Use the Leave planner** before requesting leave — it shows who's already away.
- **Book promptly when self‑roster opens**, but don't worry about being last — fairness rules and quotas mean everyone gets a fair go.
- **Questions?** Message the admin from inside the app.
