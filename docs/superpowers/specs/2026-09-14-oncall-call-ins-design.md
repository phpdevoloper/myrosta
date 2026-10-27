# Call-ins: on-call booked with its real hours — design

**Date:** 14 September 2026 · **Status:** approved 15 Sep 2026 · **Asked for by:** SWIFT · Consultants; available to any group · **Builds on:** [On-call as its own roster](../plans/2026-09-10-oncall-roster.md) (live since 14 Sep 2026, 74d6263)

## Why

On-call shipped as windows with fixed hours set in Settings. Someone takes "On-call 22:00–01:00" for a day, and pay, safe hours, calendars and reminders all read those fixed hours.

That is not how SWIFT works. The legend of their 52-week sheet lists **Casual shift · code C · 4 hrs shift · "ANY 4HOURS ONCALL"** beside the full 10 AM–10 PM shift. In the owner's words: "cons 1 called in at 2PM, he comes in and cover the floor. another day cons 2 called in at 10 am". A fixed window cannot record either day.

## Decisions (owner, 14 Sep 2026)

| Question | Decision |
|---|---|
| What an on-call booking is at SWIFT | A record of a call-in. Nobody books ahead: the consultant books it once they are called in, with the real hours. What is booked is what is paid. |
| More than one a day | Yes. Several consultants can be called in on the same day, each with their own hours. |
| How late a consultant can log one | On the day or the day after. After that, an admin adds it. |
| Who is told | The admins, whenever a consultant logs, changes or removes a call-in. The consultant, whenever an admin does it for them. |
| Notice period | Does not apply. A call-in is a record of work done, not a promise. |
| Cover | Not counted toward AM or PM cover, as with on-call today. |
| Reminders and calendars | Left out, because a call-in is logged after the fact. |

## How it works

### Settings → This cycle → On-call

Each window gets a choice of **Hours**:

- **Fixed**, exactly as today: a start and an end, taken by hand or following a PM shift.
- **Chosen when booked**: a range ("between 10:00 and 22:00") and a usual length ("usually 4 hours", in half-hour steps). This kind of window is always taken by hand, so its zone boxes are hidden.

For SWIFT: one window, *Chosen when booked*, 10:00–22:00, usually 4 hours, named something like "Call-in (C)".

The card's rules, checked on Save, Add and Remove like the rest of `ocCheck`:

- The usual length is more than zero and fits inside the range.
- A Chosen window's hours may not cross midnight; they may end at 00:00.
- A window cannot switch between Fixed and Chosen while it is in use: taken days for a Fixed window, call-ins for a Chosen one. The message gives the count.
- A Chosen window with call-ins cannot be removed; the message gives the count. To stop new ones, untick *Staff can log their own*.
- Narrowing the range or the usual length later never changes call-ins already logged.

### Logging a call-in (consultant)

On today's or yesterday's day sheet, the On call section shows the window as "Call-in (C) · any hours 10:00–22:00" with **I was called in**. That opens From and To, and **Save** stores "Called in 14:00–18:00".

- **From** starts at the current time rounded down to the quarter hour, when logging today and that time is inside the range; otherwise at the start of the range. **To** starts at From plus the usual length, capped at the end of the range. Both can be changed.
- Once saved, the row reads "Called in 14:00–18:00 · Change · Remove". Other consultants' call-ins that day are listed with their names and hours.
- On other days the row has no button, and says a call-in is logged on the day.

### Admin

From the day sheet, or the On call row of the roster grid's cell dialog, an admin can add a call-in for any consultant on this cycle's roster, on any day of the cycle, and change or remove anyone's. Each change saves as it is made and goes in the audit log.

### Rules

Every rule is checked inside the write, so it is re-read when a save retries after a clash with another phone.

Refused for everyone, admins included:

- From not before To, or either time outside the window's range. A Chosen range stays within one day; it may end at 00:00.
- Hours that overlap the same person's own shift that day (including a shift from the day before that runs past midnight), another call-in of theirs, or an on-call window they hold. Otherwise the same hours would be paid twice.
- A day the person is on leave, UA included.
- A person who is not on this cycle's roster.
- A second call-in by the same person, in the same window, on the same day. The first one is changed instead.

Also refused for a consultant:

- Any day other than today or yesterday, by the phone's own date.
- A window with *Staff can log their own* unticked.
- A roster that is still a draft, or archived.
- A breach of safe hours in Block mode, when the window counts toward safe hours. In Warn mode the call-in saves with the warning. Admins are only ever warned.

Changing the hours runs the same checks. Removing needs only the day limit for a consultant; an admin can remove at any time.

### Where call-ins show

Everywhere on-call shows today, with the real hours:

- The day sheet and the day board (`ocSheetHTML`, `viewDaily`); the roster grid's OC mark, with the hours in its tooltip (`viewRoster`, `ocMark`, `ocLine`); the Book shifts rows (`dayRowHTML`); the week strip (`weekStripHTML`); the shared week text (`shareWeekText`).
- The My shifts count, for example "On call 2 · 8h" (`viewMy`, `ocCountFor`), and the Fairness on-call column (`equityData`).
- The payroll file, one row per call-in with the window's code, the real start and end, and the hours (`payrollRows`); the RosterOn workbook (`exportRosterOn`); the roster Excel and CSV (`exportRosterXLS`, `exportRosterCSV`).
- Safe hours, when the window counts toward them: spans between duty and days in a row (`_spansOn`, `_shiftSpan`, `_onDutyDay`, `ocFatigueCheck`).
- The Get started checklist's on-call line (`setupChecklist`).

Left out on purpose: the calendar download (`icsText`), the calendar feed and the evening reminder.

### Notifications and audit

- A consultant logs, changes or removes a call-in: the admins are told, for example "Dr Khan logged a call-in 14:00–18:00 on Fri 30 Oct."
- An admin adds, changes or removes a consultant's call-in: that consultant is told.
- New audit keys, each with its `AUDIT_WORDS` sentence: `callin.log`, `callin.change`, `callin.remove`.

### Leave, clearing and people leaving the roster

- Approving leave, or setting it on the planner, does not remove call-ins, because they record hours already worked. Logging a call-in on a leave day stays refused.
- **Clear the roster** removes call-ins on the cycle's dates from a draft, and keeps them on a live roster, as it already does with leave. Its confirmation says so.
- A consultant taken off the cycle's roster stops appearing with their call-ins, exactly as their shifts stop appearing.
- Prepare next cycle carries the windows forward (it already does) and no call-ins.

## Data

- **Window:** `{…, chosen:true, usual:240}`. `usual` is in minutes. On a Chosen window `start` and `end` are the range, and `from` is always `null`. A window without `chosen` is Fixed, so every existing window reads exactly as it does today.
- **Call-ins:** `cyc.callins = {"<iso>|<windowId>|<staffId>": {start:"HH:MM", end:"HH:MM"}}`. One key per person, per window, per day, so several people on one day need nothing special.
- Accessors take `cyc` first and are never mirrored to a global. Writes go through `commitGuarded`.
- **Merge:** `mergeOnto` merges `callins` key by key with `_mergeKeyMap`, not in shared mode, because each key belongs to one person, like a shift key. A copy of the state with no `callins` field has no opinion about it, as with `oncall`. The per-field loop skips `callins`.
- **Stray keys:** every reader ignores a `cyc.oncall` key that names a Chosen window.

## Compatibility

- Fixed windows and `cyc.oncall` are untouched, so `tests/oncall-golden.js` must pass unchanged. It is never regenerated to make a test pass.
- The Edge Functions are untouched. For on-call they read only `cyc.oncall`, so they never see a call-in.
- The one gap: a phone still running an older copy of the app would show a Chosen window as an ordinary window with "Take it", and could write an on-call key for the whole range. The app ignores that key, but the calendar feed and reminders would read it as on-call from 10:00 to 22:00. SWIFT switches its window before invites go out, so no older copy exists there, and no other group has a Chosen window. A defensive change to the Edge Functions is not needed now.
- Werribee and every group without a Chosen window see no change.

## Testing

In `tests/suite.js`, run by `python3 tests/run.py`:

- Every refusal above, for a consultant and for an admin. The day limit with a pinned clock either side of midnight. A range that crosses midnight. An overlap with the previous day's shift that runs past midnight.
- Several consultants on one day; one call-in per person, per window, per day.
- Merge: two phones logging different consultants at once both keep theirs; the same key changed on two phones follows the key rule; a copy without `callins` has no opinion.
- Payroll, RosterOn, Excel and CSV rows, the My shifts count and Fairness include call-ins with their real hours; `icsText` does not.
- Safe hours: a call-in straight after a PM shift is one run of duty; Block refuses a consultant, and an admin is only warned.
- Card rules: the switch is refused while in use, removal is refused with the count, and a Chosen window hides its zone boxes.
- Clear the roster removes call-ins from a draft and keeps them on a live roster. Leave approval keeps them.
- The golden file passes unchanged, and the lints pass: `AUDIT_WORDS`, and the wiring lint covering the new buttons.

Each guard is mutation-tested, as the on-call layer's were.

## Build order

1. **The window option.** `chosen` and `usual`, the card's Hours control and rules, the checklist wording.
2. **The layer.** `cyc.callins`, its accessors, logging, changing and removing under every rule, the merge, audit and notifications.
3. **Seeing it.** The day sheet, the cell dialog, the day board, the grid, the Book shifts rows, the week strip and the shared week text.
4. **Counting and exporting it.** The My shifts count, Fairness, payroll, RosterOn, Excel and CSV, safe hours, and Clear the roster.
5. **Docs.** CHANGELOG. No What's new note, for the reason the on-call roster had none: groups without a Chosen window would be told about something they cannot see. The SWIFT staff and admin guides in the go-live pack (outside the repo) get their on-call pages rewritten.

## Not in scope

- More than one call-in by the same person, in the same window, on the same day.
- Admins approving call-ins before they count for pay.
- Rates, allowances and billings.
- Counting a call-in as AM or PM cover.
- Calendar events and reminders for call-ins.

## As built, 15 Sep 2026

Plan: `docs/superpowers/plans/2026-09-15-oncall-call-ins.md`, the Call-ins 1/7 to 7/7 commits and their review fixes. Decisions taken while building, each for a reason worth keeping:

- **Readers get a copy of the window with the call-in's hours** (`ciAt`, `ci:true`) from `ocTakenBy` and `ocHeldBy`, so payroll, RosterOn, the exports, counts, marks and safe hours needed no change of their own. Writers that clear on-call through those helpers (`approveRequest`, `plannerSetLeave`) skip `ci` copies, and the calendar download filters them out.
- **The confirmation of Clear the roster is one function**, `rosterClearBody`, shared by the button and the tests.
- **The tab wiring lint also reads `ciSheetRows`**, so a call-in button cannot be drawn on the day sheet without being wired.
- **`ciDropFor`** is called on all three paths that take someone out of a cycle or the group; a test counts the calls.
- **The day sheet and the cell dialog share the form's pieces** (`ciTimesHTML`, `ciOpenForm`, `ciSaveForm`), and one predicate, `ciOnTime`, says whether a consultant may still act on a day. Each surface keeps its own literal button attributes, so the wiring lint still reads them.
- **A Chosen window is never blocked from removal by a stray on-call key** an older copy of the app left on it; only its call-ins count (Task 1 review).
- **The merge test also covers both phones changing the same call-in**, where the phone's own change stands, so a shared-mode slip on the call-ins merge fails it (Task 4 review).
- **Remove has its own gate on the day sheet**, `mayRemove`: a consultant keeps Remove on their own call-in within the day limit even on a window only the admin logs, because the spec says removing needs only the day limit (Task 5 review).
- **The range check needs the end after the start** (`ciInRange`): a From before the range starts, or a To at or before its start, is read as after midnight, and the call-in is accepted only when its end comes after its start and within the range. It used to push a To past its From, so a range that crossed or ended at midnight took reversed or equal times and could record up to 24 paid hours (final review).
- **A Chosen range stays within one day; it may end at 00:00** (`ocCheck`), because a call-in's date must be clear for pay: payroll and RosterOn date it by the day it is logged for, and weekend and public-holiday rates follow that date. Overnight cover uses two windows, one ending at 00:00 and one from 00:00. This replaced the `night` flag, which measured a small-hours call-in on the next day for safe hours and clashes while payroll dated it on the day it was logged for. The rule is checked after the Fixed or Chosen switch rule, so a window in use that cannot switch says so first (final review).
- **When booking is closed to a consultant, Book shifts still offers yesterday and today** under **Called in?**, on a live roster with a Chosen window, because the day sheet is the only way in to log a call-in, and a closed booking draws no day rows: in rounds mode once the roster is published, or outside a booking window (final review).
