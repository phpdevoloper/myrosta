# Clock in / clock out with a site geofence (C1) — design

**Status:** brainstormed with the owner 29 Sep 2026 (seven questions, five sections, all agreed); spec for review before the plan.
**For:** SWIFT's nurses, scribes and clerical admins first; any group whose admin switches it on. Consultants keep it off.
**Builds on:** own hours (S4: `sh.hours`, `hoursSet`, `hoursOK`, `shiftWindow`), the day sheet and My shifts, the Requests tab, the Day board, the exports, the shifts/call-ins merge rule. `app.html` only — no SQL, no Edge Function.

## Why

Staff who arrive early or stay late are paid by hand today: the manager hears about it, works out the hours, and writes them into the pay run. Myrosta already lets a booking carry its own start and finish (S4) and already pays those hours through the payroll file and the RosterOn workbook. What is missing is the evidence and the decision: when did the person really start and finish, were they at the clinic, and does the manager agree to pay the difference. The clock supplies the first two; the manager keeps the third.

## Decisions (the owner's answers)

1. **Pay rule: rostered hours unless the manager approves the difference.** The clock proposes; Approve writes the proposal as the shift's own hours; Decline leaves the rostered hours. Nothing is paid on a tap alone.
2. **Geofence: soft, plus a printed poster.** A tap always goes through. The record stores the distance from the site and an inside/outside flag; the manager's list shows a warning for a tap outside the radius. A QR poster at the clinic is a second proof of presence for phones without location.
3. **Grace band per group, default 7 minutes, admin-set (0 turns it off).** A tap within the band counts as the rostered time; only real early starts and late finishes reach the manager.
4. **Forgotten taps: rostered hours stand, flagged.** A shift with an in tap and no out tap closes as "no clock-out" at the end of its day; the list shows it for information. The person may not add the missing tap afterwards. A phone reminder at the rostered finish is a later option; this build shows an in-app banner instead.
5. **Who clocks: every clinical shift in a group whose admin switches Clock in/out on.** No tag filter now.
6. **Site per group.** A Site card in each group's Settings; each SWIFT manager sets it once, standing at the clinic.
7. **Poster now, live screen later.** A printed poster whose code changes when the manager makes a new one; a live hourly code on a reception screen is a later option.

Approach chosen: clock records in the cycle, approved hours written as own hours (not a separate timesheet, not a native app).

## Data

**Group settings (global, not per cycle):**
- `S.clockOn` — `true` when the switch is on; absent means off (`normalize()` seeds nothing, like `S.ownHours`).
- `S.clockGrace` — minutes, integer 0–60, default 7 when absent.
- `S.site` — `{lat, lng, acc, setAt, radius, posterKey, posterAt}`: the point as decimal degrees, the phone's reported accuracy in metres when it was set, when, the radius in metres (default 150, 20–2000), the poster's key (16 characters from `crypto.getRandomValues`, base32 letters and digits) and when the poster was made. Absent until an admin saves the card.

**Per cycle, two maps, both keyed `sid|iso` like `assign`:**
- `cyc.clock[key] = { in:TAP, out:TAP }` — written only by the person's own device. `TAP = { t:"HH:MM", ts, dist, acc, inside, via }`: the tap in the device's local time rounded to 5 minutes (see Rules), the epoch milliseconds, distance from the site in whole metres or `null`, accuracy in metres or `null`, `inside` true/false/`null` (null = no location), `via` one of `"gps"`, `"poster"`, `"none"`. A record's status (open, rostered, proposed, no clock-out, void) is never stored: `clockProposal` computes it from the taps, the shift and the clock, so no device ever writes another device's slot.
- `cyc.clockDec[key] = { ok, start, end, rostered, by, ts }` — written only by an admin: `ok` true for Approve (with the hours written) or false for Decline; `rostered` is the pair the manager judged against, so the list and the report keep it after the shift's own hours change.

**Retention:** records stay in the cycle (they are the record). The list shows open and proposed records, plus closed ones for 14 days.

**Nothing is stored about location except `dist`, `acc` and `inside`.** Never coordinates of a person, never a track.

## Rules (pure functions, all unit-tested)

- `clockOn()` — `S.clockOn===true`.
- `clockWindow(cyc, sid, isoD)` — the rostered window the taps are compared with: `shiftWindow(cyc, sh)` (the type's hours, or own hours the manager already set). Only a `clinical` shift has a window; call-ins, CST and leave never get the clock.
- `clockRound(hhmm)` — to the nearest 5 minutes, half up; 23:58 rounds to 00:00 and is kept on the same day as "00:00".
- `clockMay(cyc, sid, isoD, now)` — `{in, out}` booleans: **in** from 60 minutes before the rostered start until the rostered finish, when no in tap exists; **out** once an in tap exists, until 23:59 of the shift's day, or 01:00 the next day when the rostered finish is 00:00.
- `clockDist(lat1, lng1, lat2, lng2)` — haversine, whole metres.
- `clockInside(dist, acc, radius)` — `null` when `dist` is null; else `dist - (acc||0) <= radius` (the benefit of the doubt).
- `clockProposal(cyc, sid, isoD, grace, now)` → `{ status, start, end, flags, rostered }`:
  - no in tap → `status:"none"`; an in tap on a day with no clinical shift → `"void"` with the flag `no shift`;
  - in tap only and the day not over → `"open"`; day over → `"noOut"`;
  - out tap not after the in tap → `"void"`, flag `taps out of order`; an out tap stored as `"00:00"` on the shift's day whose timestamp is in the 23:00 hour (a tap at 23:58 or 23:59, rounded up) means midnight, like an out tap after midnight; a "00:00" tapped in the first minutes of the day is that day's midnight and reads before any in tap;
  - otherwise start = rostered start when `|in − start| ≤ grace` else the rounded in; finish likewise against the rostered finish; a finish past midnight becomes `"00:00"` with the flag `capped at midnight`; both equal to the rostered pair → `"rostered"`; else `"proposed"` with `start`, `end` passing `hoursOK`, and flags `early N min` / `late N min` / `left early N min` / `started late N min`, `outside the radius (d m)`, `no location`, `by poster`.
- `clockTokenOK(token)` — `!!S.site && token===S.site.posterKey`.
- `clockPosterURL()` — `https://<host>/app.html?org=<_org>&clock=<posterKey>`.

## Where things happen

**Taps (staff, own shift only).** `clockTap(kind)` on the device: asks `navigator.geolocation.getCurrentPosition` with high accuracy and a 10-second timeout; on success computes `dist`, `acc`, `inside`; on refusal or timeout records `via:"none"`; writes the TAP into `cyc.clock` and `save()`s. Rounding happens at the tap. A second in tap on the same day is never offered — the button is gone — and refused if forced. Clock in looks at the shift's own day only, so a shift starting within an hour of midnight can be clocked into from 00:00. A signed-in admin taps only as their own staff record — the one holding the email or mobile they signed in with (`clockMySid`) — whoever they are viewing as (`clockActor`); an admin with no record of their own sees no buttons and is refused, and viewing as another person never taps for them. On My shifts an admin who is on the roster lands on their own shifts.

**The poster.** The app reads `?org=` and `?clock=` at boot. Not signed in: the door shows and the token waits in `sessionStorage` until the sign-in resolves. Signed in to another group the person belongs to: the app switches groups first (the picker's own path). Then, if the token matches, it performs the tap the window allows (in, else out) with `via:"poster"`, `dist:null`, and shows the receipt; a token that does not match: "This poster is out of date — ask your manager for the new one."; no shift today: "Nothing to clock today." The URL is cleaned afterwards so a refresh does not tap again.

**Proposals and decisions (admin).** `clockApprove(sid, isoD)`: computes the proposal, calls `hoursSet(sid, isoD, start, end)` (its usual `hours.set` audit line and notification), writes `clockDec` and a `clock.approve` line that names the hours and the flags, and runs the same safe-hours check own hours run (warned, never blocked). `clockDecline(sid, isoD)`: writes `clockDec` with `ok:false`, audit `clock.decline`. A record already decided shows its decision, not buttons; the manager's later edit from the cell editor overwrites approved hours as it overwrites any own hours.

**Settings (admin).** The Clock card under This staff group: the switch (audit `settings.clock`), the grace minutes, the Site: Use my location here (reads the phone's position once, shows "±25 m"), latitude and longitude fields for typing, the radius, Save site (audit `settings.site` with radius and accuracy, never the coordinates), Print the clock poster, New poster (renews `posterKey`, audit `clock.poster`), "Poster made 29 Sep 2026". The switch cannot be turned on until a site is saved.

## What people see

- **Staff, My shifts and today's day sheet:** a Clock in button from 60 minutes before the start; after it, the receipt "Clocked in 09:52 · at the clinic" (or "· 420 m from the clinic", "· no location", "· by poster") and a Clock out button until the day ends; then "Clocked 09:52–17:20 · as rostered" or "· waiting for your manager", later "· approved 09:50–17:20" (the hours then show wherever own hours show) or "· as rostered" after a decline. Under the buttons, always: "Myrosta keeps only the time of your tap and how far you were from the clinic."
- **Forgotten clock-out:** opening the app after the rostered finish with an open in tap shows a banner on My shifts, "Still clocked in from 09:52", with a Clock out button, for that day only; the next day the banner reads "Yesterday closed without a clock-out; your manager can see it."
- **Admin, Requests → Hours to approve:** newest first: person, day, "rostered 10:00–17:00 · clocked 09:52–17:20 · proposes 10:00–17:20", the flags as chips, Approve and Decline. Closed-as-rostered, no-clock-out and void records appear below the proposals, greyed, for 14 days. The tab's count includes proposals only.
- **Day board and day sheet (any viewer):** "in 09:52" beside a name after an in tap, "out 17:20" after the out tap, for the day being viewed.
- **Roster → Export → Clock report (CSV):** Person, Day, Rostered start, Rostered finish, Clock in, In distance, In proof, Clock out, Out distance, Out proof, Proposed start, Proposed finish, Flags, Decision, Decided by, Decided at — the cycle's rows, for the pay office.
- **The poster:** a printable page: the hospital and group, the QR, "Scan to clock in or out", the URL in small type, "Poster made <date>", the Myrosta mark. The QR is drawn by a small inline encoder (byte mode, error level M); no image leaves the device and no outside service is called.

## Sync and merge

`cyc.clock` and `cyc.clockDec` merge like `callins`: key by key, a slot this device touched keeps its value, a slot it did not touch takes the other side's, including a deletion. A person's phone owns the tap slots; an admin's screen owns the decision slots; the two never contend for one slot. Approved hours are `sh.hours` and merge as own hours already do. Offline taps sit in the device cache and sync through the ordinary save path.

## Compatibility

- With the switch off: no buttons, no records, no list, the exports byte for byte as today; `normalize()` seeds none of the new keys.
- A group that turns the switch off keeps its records: the Clock report stays under Roster → Export while the cycle holds clock records, so the pay office can still read the last rows.
- A cycle prepared from another carries no clock records; the settings are group-wide and carry over by being global.
- The department digest does not carry taps (the "in 09:52" mark is the group's own view).
- The shift reminder, the calendar and the feed are unchanged: they read own hours, which the clock only writes through Approve.

## Testing

- Pure rules: `clockRound`, `clockMay` (each edge of both windows, the midnight case), `clockDist` against known distances, `clockInside` with and without accuracy, `clockProposal` for every status and flag, `clockTokenOK`, the CSV rows.
- Harness: `navigator.geolocation` stubbed (success, refusal, timeout); the tap writes the record and the receipt; the second in tap refused; the poster URL applies a tap once and cleans the URL; Approve writes `hours.set` and the decision; Decline writes `clock.decline`; the list orders and greys correctly; the Day board marks; the banner; the switch refuses to turn on without a site; the merge scenario (a phone's tap and a manager's decision on one key, both kept).
- Lints: every new audit key in `AUDIT_WORDS`; the exports byte-identical for a fixture without the switch.
- A strict mutation script (deploy copies synced, the demo rebuilt, failing tests named): at least 20 mutants of the rules and the write paths, all killed by named tests.

## Build outline (for the plan)

1. Settings and data: the Clock card, `S.site`, the rules as pure functions, tests and mutations.
2. Taps: the buttons and windows, geolocation, the receipt, the poster URL at boot, the banner.
3. Proposals and decisions: the list on Requests, Approve/Decline, the Day board marks.
4. The poster page with the inline QR encoder, the Clock report export.
5. Outside the repo: the SWIFT staff guide, the managers' guide and the runbook gain a Clock section (site setup at the clinic, the poster, the approval list).

## Out of scope (later, each its own piece)

A live hourly QR on a reception screen; a push reminder at the rostered finish (needs a scheduled function); a hard geofence; a tag filter on who clocks; a hospital-wide site; paying actual hours without approval for a group that wants it; clocking for call-ins.
