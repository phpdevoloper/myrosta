# Own hours on a booking (S4) — design

**Date:** 26 Sep 2026 · **Status:** design approved section by section by Dr Ranjith (26 Sep 2026).
**Programme:** sub-project S4 of `2026-09-16-staff-group-modules-programme.md`. S0–S3 are built. S4 is what SWIFT's admin/clerical staff and scribes need before they can be onboarded (S6): their rosters list a true start and finish per person per day, and a handful of shift types cannot say them all.

## Why

A shift type says when a shift runs. SWIFT's front desk runs 09:30–15:00 inside a 10:00–17:00 morning, 17:30–22:15 past a 17:00–22:00 evening, and the odd 11:10–16:25 that no type will ever name. Pay is run from those true times. The programme chose *both*: types for the set patterns, and **own hours on the booking** for the rest, with a per-group switch for whether staff may set their own (off by default). This spec makes that exact.

## Decisions

Taken in this brainstorm:

1. **Start and finish only.** The hours a shift counts are finish minus start. Breaks stay payroll's business; a group-wide break rule can be added to the exports later if a pay run asks for it.
2. **Staff may set hours at booking and afterwards**, once the group's switch is on: a Hours row on the day sheet when a slot is picked, and *Change hours* on a booked shift that is still ahead, today included. No approval; the admin is told and the change is logged.
3. **Any start and finish on that day**, in 5-minute steps, finish after start or finish at 00:00 meaning midnight, never across midnight (the call-ins rule, reused). The shift type still decides which half of the day the booking fills for cover and the unlock order; the safe-hours rules judge the real hours.
4. **Approach A — one reader.** Hours live on the booking; one function answers "own hours if present, else the type's"; every reader of a shift's times goes through it, in the app and in the two Edge Functions.

Carried from the programme: rules on the cycle, attributes on the person, **hours on the booking**; one engine, never a branch on group kind; every refusal names its reason; a group that switches nothing on sees no change.

## Data

**On the booking.** A clinical assignment may carry `hours:{start:"HH:MM",end:"HH:MM"}`. The key is **absent** unless the times differ from the shift type's window; it is deleted when cleared or when they come to equal the type's. Changing a booking's type or period in the cell editor clears it unless hours are entered again for the new type. Swaps and give-aways move the whole booking, so hours travel with the shift; a claimer works exactly what was offered, hours included.

**Allowed.** `hoursOK(start,end)`: both `HH:MM`, minutes a multiple of 5, `end` after `start` on the same day, or `end==="00:00"` for midnight. Nothing else is stored. `hoursNorm(cyc,sh,start,end)` returns the object to store, or `null` when the pair equals the type's window.

**The group switch.** `S.ownHours===true` when an admin ticks *Staff may set their own hours* on the Group card; absent means off, and `normalize()` seeds nothing.

**Audit, in plain words:** `settings.ownHours` (switched on or off), `hours.set` (who set whose hours, which day, to what), `hours.clear`. Every key gets its `AUDIT_WORDS` sentence.

**Merge.** Untouched: hours ride inside the assignment value, which `mergeOnto` already merges key by key — the side that changed the booking wins the whole booking.

## The reader

`shiftWindow(cyc,sh)` → `{start,end,own}`: the booking's own hours when present and valid, else the type's window (`typeOf(cyc,sh)`), with `own:true` only for the former. It takes its cycle explicitly, like the S3 judge, so the digest and an off-screen cycle get the same answer.

Every reader of a shift's times goes through it: `shiftHours` (the overnight-safe `_tHours`, so an end of 00:00 reads as midnight), `shTimeStr`, the safe-hours span `_shiftSpan` (its on-call extension unchanged), the payroll rows and the RosterOn cell, the roster CSV and Excel labels, the calendar download, My shifts' hero, day rows and hours tally, the day sheet, the grid cell, the Day board rows and the mobile week list, the swap sheets' shift text, and `buildDigest`'s `t` field. Cover, the unlock order, quota, fairness, the S3 judge and the on-call layer read the type and the half, never the hours.

**The two Edge Functions.** `ics` and `notify-shifts` each gain `hoursOf(sh,ty)` — the same three lines — in the pure block the suite already lifts: the event's start and end, under the event id it has always had, and the reminder's window come from it. Both must be pasted after the build is live; until then they say the type's hours.

**The roster import.** `parseShiftStr` already reads `HHMM-HHMM role`; it now keeps the times, and `applyRosterImport` stores them as own hours when they differ from the window of the type the booking lands on. A SWIFT fortnight sheet converted to the roster layout therefore imports with everyone's true times.

## Where hours are set

| Who | Where | Rules |
|---|---|---|
| **Admin** | The cell editor (also reached from the Day board's assign list): a Hours row under the type and zone choices, Start and Finish prefilled with the type's window, *Same as the type* to clear | Any day, past days included (pay corrections). Saving writes `hours.set`/`hours.clear` only when the times changed; a change of type or period clears the row to the new type's window |
| **Staff, at booking** (switch on) | The day sheet: once a zone chip is picked, a Hours row under the chips, prefilled with the type's window | Held with the pick (`_srHours[isoD]`), written on Confirm only when different from the type's; the pick key is unchanged |
| **Staff, afterwards** (switch on) | *Change hours* beside *Swap it* on a booked shift still ahead, today included; a small inline form like logging a call-in, Save and Cancel | The same guarded write as a booking (`hoursSet`); refused inline when invalid; the admin is told; `hours.set` logged. Past days stay as they are |
| **Staff, switch off** | The hours show, read-only | They ask the admin |

**The guards.** Safe-hours judges the real hours: in block mode a change that breaks the rest rule is refused with the reason, in warn mode it is warned, exactly like a booking. Changing hours is not coming off, so the notice period does not apply; a department that wants control keeps the switch off. Cover, unlock, quota and the S3 rules are not consulted.

## What people see

- **Grid cell:** a small second line with the times, only when they are the booking's own.
- **Day sheet:** "Booked: Front desk AM · 09:45–17:45 (own hours)"; the Hours row and *Change hours* as above.
- **Day board and the mobile week list:** the times after the name when own.
- **My shifts:** the hero, the day rows and the hours tally read the window.
- **Swaps:** the shift text names the hours after the slot when own, so an offer is clear.
- **Notifications:** the admin is told when staff change hours ("Jo Park changed their hours on Tue 29 Sep to 09:30–15:00").
- **Settings → Group:** *Staff may set their own hours* beside the other feature flags, off by default, with one line: "Admins can always set a booking's hours from the cell; this lets staff set their own, at booking and after."

## Pay, exports, the calendar, reminders, the board

- **Payroll rows** keep the type's code; start, finish and hours come from the window. The **RosterOn cell** keeps its code and layout and carries the real times: `() AM 0930-1500 09:30-15:00 NB#`.
- **The roster export** (CSV and Excel) adds the times after the label when own — "Front desk AM 09:30–15:00" — and nothing otherwise.
- **The calendar** download and live feed build the event from the window under the same event id, so a subscriber's calendar updates the event in place.
- **The SMS reminder** says the window: "Front desk · 09:30–15:00".
- **The digest** carries the window, so the Who's on board and the scribes' sheet line show real hours; a change of hours republishes it like any change.
- **Fairness, cover and the S3 rules** count shifts and halves, not hours, and are untouched. Hours per fortnight and the hours tally read the window.

## Compatibility

- **No own hours: no change.** Tests pin the payroll rows, the RosterOn cell, the roster export and the digest byte for byte at the defaults; `tests/oncall-golden.js` keeps guarding the on-call rows.
- **A phone on last week's build** shows and reminds the type's hours until it updates. Accepted.
- **Unknown keys ride through an old build untouched.**

## Testing

- **The validator and the reader:** every branch of `hoursOK` (steps, order, midnight, malformed); `hoursNorm` returning `null` for the type's own window; `shiftWindow` with and without hours, for a half and a whole-day type, for CST (never own) and for an unknown type id.
- **Every reader** in the list above, with and without own hours, including the digest bytes and the swap text.
- **The cell editor:** set, clear, clear on type change, the audit lines, a past day allowed.
- **The day sheet:** a pick with hours written on Confirm only when different; *Change hours* on a shift ahead; refused for a past day, for an invalid pair, and by safe-hours in block mode; the admin's notification; the switch off hides the controls.
- **The Edge Function blocks** through the suite: a reminder and a calendar event with own hours say them; without, the type's.
- **The import** keeping times that differ and dropping times that equal the type's.
- **The merge:** hours survive a merge and the side that changed the booking wins.
- **Mutation proof:** every guard broken once must fail a test.

## Build — six tasks, dry-run from the plan's own text

1. The data, the validator, the reader and the audit words. 2. Every reader in the app. 3. The admin's cell editor and the Group switch. 4. The staff day sheet, at booking and afterwards. 5. The two Edge Functions and the roster import. 6. Release: What's new, changelog, build date, demo rebuild, the mutation run, and the deploy note — paste `supabase/functions/ics` and `supabase/functions/notify-shifts` after the build is live.

After any `app.html` change: `python3 tools/build-demo.py`. `const BUILD` = the changelog's newest app heading = `WHATS_NEW[0].on`. Nothing calls notify-shifts.

**The owner's steps afterwards:** push; paste both Edge Functions; for SWIFT's admin and scribes at onboarding (S6): shift types for the set patterns, the group switch on if they are to set their own, and the converted fortnight sheets imported with their true times.

## Out of scope

Breaks (per booking or as a rule); a person's usual hours as a default; own hours on non-clinical blocks or on on-call windows (call-ins already carry chosen hours); hours across midnight; an approval step for staff changes; hours-based fairness.
