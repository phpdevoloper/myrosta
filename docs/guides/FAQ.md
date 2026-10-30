# Myrosta — Frequently Asked Questions

## Getting started

**Do I need to download an app from the App Store?**
No. Myrosta is a web app — open **https://myrosta.com.au** in your browser. You *can* add it to your home screen so it behaves like an app (Share → *Add to Home Screen* on iPhone; ⋮ → *Install app* on Android), but there's nothing to install from a store.

**Is there a password?**
No passwords. You sign in with a **6‑digit code** sent by **SMS or email**, then you **stay signed in** on that device — so it's effectively a one‑time login.

**I didn't get my sign‑in code.**
- Check your **junk/spam** folder.
- Codes last about an hour — if it's been a while, tap **Resend code**.
- Try **📱 Mobile (SMS)** — switch to Mobile on the sign‑in screen and enter your number (handy if your hospital email blocks external mail).
- Make sure you used the **mobile or email** your admin has on file.
- Still nothing? Your details may not be on the access list yet — contact your roster admin.

**My hospital blocks external email — can I use a personal email?**
Yes — two options: sign in by **📱 Mobile (SMS)** (a texted code, nothing to do with email), or ask your roster admin to add a **personal email** to your record (the **Alt email** field) and use that. Either way the code only carries a 6‑digit number, no roster data.

**Can I use it on more than one device?**
Yes — sign in on your phone, tablet and computer. Each stays signed in independently.

**Is this a shared or ward computer?**
Tick **This is a shared computer** at sign‑in — that session won't stay logged in and signs out when you close it or after a short idle. On your own phone, leave it unticked and you stay signed in.

**It logged me out / I'm on a new phone.**
Just sign in again with a fresh code. Your data is in the cloud, so nothing is lost.

## Using it as staff

**Where do I see my shifts?**
The **My shifts** tab — as a list or a month calendar. Tap **Add to calendar** to push them (with reminders) into your phone calendar.

**How do I pick my shifts?**
When the admin opens a round, go to **Self‑roster**. Depending on the method, you'll either take turns (waves/snake draft) or book openly — you'll only ever see slots that are still free.

**What if two of us click the same shift at the same time?**
Impossible to double‑book. The moment someone takes a slot it disappears for everyone else. If you both tap at the same instant, the app sorts it out and only one booking sticks — the other person simply sees the next available option.

**I'm last to log in — do I miss out?**
No. Fairness rules and per‑fortnight **quotas** keep it even, so the order people log in doesn't decide who gets a fair share.

**I booked the wrong shift.**
While the round is still open, tap your booked slot to **release** it, then pick the right one. If it's closed, message your admin.

**What does a pink shift mean?**
Pink with an **‘L’** marks a **locum** shift — one you're covering on top of the normal roster. It also shows in your shift tally and on exports.

**Can I send feedback or report a bug?**
Yes — **Help → 💬 Send feedback**. It goes straight to your roster admin: a bug, an idea, or something confusing.

**How do I request leave or a swap?**
**Requests → Request leave** (pick dates + type) or **Request a swap** (your shift ↔ a colleague's). It goes to the admin; you're notified when it's decided, and the roster updates automatically.

**My leave request was declined — why?**
The admin sees how many people are already away and the daily cap. If a day's already at capacity, they may ask you to pick different dates. Use the **Leave planner** to spot quieter days first.

**I have a fixed pattern that's wrong.**
If your pattern is locked, use the **request a change** option — it goes to the admin for approval rather than changing silently.

**I'm rostered but I'm off sick — what do I do?**
In **Requests → Request leave**, choose **UPL (Unplanned leave)** for the date(s). Once your admin actions it your shift comes off the roster, and the gap is visible for a colleague to pick up as locum cover.

**Will I be reminded about shifts?**
Yes — an in‑app alert when self‑roster opens, and (if your admin has reminders switched on) an email/text when a round opens and the day before a shift. Adding your shifts to your phone calendar gives you reminders too.

**Where do I get help inside the app?**
The **Help** tab — quick guides and FAQs for staff (with an extra section for admins).

## For admins

**How do I set it up with no spreadsheets?**
**Admin settings → Get started guide** → download the **Staff template**, fill it, upload. Myrosta builds the department from it. (If you *do* have spreadsheets, use **Import data** instead.)

**How is fairness actually enforced?**
Each person has a **quota** (default per fortnight, to match pay). The self‑roster methods (cohort waves, snake‑draft, guarded, auto‑draft) all track everyone against their quota and caps, so shifts spread evenly and nobody races ahead.

**How do I make someone else an admin?**
**Admin settings → Access control → Make admin** next to their name. Only an existing admin can do this, and it's enforced by the database. (Syncing the allow‑list never demotes an admin you've set.)

**Can different cycles have different settings?**
Yes — cover, zones, quotas and who's rostered are saved **per cycle**, so changing the next roster never alters a published one. **Prepare next cycle** copies the current setup to start from.

**How do I add a coordinator who doesn't work shifts?**
Add them in **Staff** and set Rostering mode to **Non‑clinical / admin** — they stay off the roster but can sign in and be made an admin.

**How does payroll work?**
One click exports every shift to **RosterOn** with correct times and leave pro‑rated by EFT. You can upload your RosterOn template so columns map automatically and choose the date format. There's also a **RosterOn sheet** export (a readable roster grouped by Title, plus a clean data sheet). **All export buttons are admin‑only.**

**Can I still edit the roster by hand?**
Yes — admins can edit any cell at any time, before or after releasing for self‑roster.

**Can I schedule when self‑roster opens and closes?**
Yes — **Self‑roster → Schedule open & close**. Myrosta auto‑opens and auto‑closes the round and notifies everyone, with a countdown banner. Email/SMS reminders can be added (see your IT setup).

**Someone called in sick — how do I cover the gap?**
They log **UPL** leave; approving it clears their shift (a gap appears). Open the vacant cell, assign whoever covers, and tick **Locum cover** — it's flagged with an **L** on the roster, a **Locum** tag in Daily, and **Locum** in the payroll export.

## Data, privacy & reliability

**Where is our data stored?**
In a secure cloud database hosted in **Sydney, Australia** (aligned with the Privacy Act 1988 & the APPs). Only people on your **access list** can read or change anything — even with a valid login, an unknown email gets a "No access" screen.

**Is it secure?**
Yes — sign‑in is required, access is limited to an approved list, all traffic is encrypted (HTTPS), and there's a full **audit log** of every approval and change.

**What happens if I lose signal mid‑booking?**
Your booking only counts once it's saved to the cloud, so you'll never half‑book. Reconnect and try again — you'll see the current, live state.

**Does everyone see the same thing live?**
Yes. Changes sync in real time — a shift booked or leave approved on one device updates for everyone within moments.

**Who do I contact for help?**
Message your roster admin from inside the app (**Messages**), or ask them directly. Admins manage staff, access and the roster.
