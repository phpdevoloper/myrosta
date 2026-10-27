<!-- converted from Myrosta - Admin Guide.docx -->

Myrosta — Admin Guide
For the rota lead — setting up and running the roster.
As admin you see everything staff see, plus three extra tabs: Admin settings, Staff, Audit. This guide covers the rota‑lead workflow end to end. (For the staff‑facing basics, see the Staff Guide.)
Signing in
Same as everyone: open https://myrosta.com.au, tap Sign in, choose Mobile (SMS) or Email, and type the 6‑digit code. Because your email is set as an admin, you land with the admin tabs available, and you stay signed in on your device.
1. First‑time setup
Admin settings → New organisation (clean slate), then either:
- Have spreadsheets? → Import data → upload your roster, leave planner and EFT files. Myrosta reads them as‑is, pulling in EFT, hours and employee numbers.
- No spreadsheets? → follow the Get started guide: download the Staff template, fill it, upload — Myrosta builds the department for you.
2. Configure the department (Admin settings)
- Zones — your clinical areas; set how many are needed each period/day.
- Minimum & maximum cover — the floor and ceiling for each day.
- Extra‑slot unlock order — AM & PM together, AM first, or PM first.
- Self‑roster method — cohort waves / snake‑draft / guarded / auto‑draft + adjust.
- Fixed patterns, ‘Any (auto)’ zone — a fixed‑pattern day can set a period (AM/PM) and leave the zone as ‘Any (auto)’; auto‑draft then places it in a balanced free zone, around anyone with a fixed zone, and flags any clashes.
- Quota period — how quotas are counted (default per fortnight, to match pay).
- Uneven quota — set ‘Staff choose’ so a consultant whose quota doesn't divide evenly places the extra shift in whichever fortnight suits (still capped at their total).
- Per‑cycle — cover, zones, self‑roster method and quotas apply to the selected cycle only; changing them never alters another (e.g. published) cycle. ‘Prepare next cycle’ copies the current setup as a starting point.
3. Run a self‑roster round
1. Build the base roster — import, or Self‑roster → Auto‑draft → minimum cover to draft a fair, fully‑covered roster in seconds (it skips anyone on leave).
2. Release for self‑roster. With cohort waves, start the waves — they advance automatically as each cohort marks Done.
3. Watch coverage and quotas fill live; edit any cell by hand whenever you need.
4. Schedule it (optional). On the Self‑roster tab, set Schedule open & close date‑times — Myrosta auto‑opens and auto‑closes the round, shows a countdown banner, and notifies everyone. (Email/SMS reminders are an optional add‑on — see your IT setup.)
4. Approve requests with context
Requests shows each leave/swap with the context to decide: the person's EFT, leave already taken, who else is away those days, and whether you'd breach the daily cap. Approve or decline in a tap — Myrosta updates the roster + leave planner, notifies the person, and drafts the confirmation email.
Unplanned leave (sick days) & locum cover
When a consultant calls in sick, they log UPL — Unplanned leave (Requests → Request leave → UPL). Approving it clears their booked shift, leaving a visible gap on the roster. If a colleague covers the gap, open that vacant cell in the Roster grid, assign them, and tick Locum cover — the shift is flagged with an L badge on the roster, a Locum tag in Daily, and Locum in the payroll export.
5. Manage staff & access
- Staff tab — add/remove people; set rostering mode, EFT/hours, payroll number, an Alt email (a personal address for anyone whose hospital blocks external mail — they can sign in with either), and fixed patterns (weekly or fortnightly A/B; Commit (lock) to fix them — staff changes to a locked pattern come to you for approval).
- Non‑clinical / admin — set anyone who doesn't work clinical shifts (coordinator, clerk) to this mode to keep them off the roster. Who's rostered and each person's quota/EFT are per‑cycle (use ‘+ Add to this cycle’ / ‘Remove from this cycle’); a ‘Title’ field groups people in the RosterOn export.
- Admin settings → Access control — Sync allow‑list from staff + admins so your team (by email) can sign in. To grant admin rights, use Make admin next to a person (only an existing admin can do this).
- Shared / ward computers — at sign‑in, staff can tick ‘This is a shared computer’; that session won't stay logged in and auto‑logs‑out after the idle time you set in Access control.
6. Payroll export
When the roster's set, the Payroll (RosterOn) button exports every shift in one click — correct times (AM, PM, on‑call, CST) and leave pro‑rated by EFT, with no re‑keying. Upload your RosterOn import template so the columns map automatically, and choose the date format.
Export for RosterOn — the ‘RosterOn sheet’ button builds a two‑sheet workbook: a readable roster grouped by Title (matching RosterOn's cell format, including overnight OC) plus a clean one‑row‑per‑shift data sheet. All export buttons are admin‑only.
7. Publish, back up, audit
- Roster status → Publish when the cycle is ready.
- Backups are automatic — the cloud database keeps continuous point‑in‑time backups, so there's nothing to download or restore by hand.
- Audit logs every approval and change — nothing happens off the record.
Good practice
- Set zones, cover and the self‑roster method before releasing a round.
- Auto‑draft to minimum cover first, eyeball it, then release for self‑roster.
- Keep each consultant's personal email / mobile filled in (Staff tab) and Sync the allow‑list before inviting people — that's how sign‑in and reminders reach them. (Work emails and payroll numbers are hidden by default for privacy.)
- Reach for the Audit log if anyone ever queries a change.