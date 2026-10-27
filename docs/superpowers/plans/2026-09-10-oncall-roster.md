# On-call as its own roster

**Goal:** let a named person carry an on-call window without being on the floor, in any window the group defines, on a day they may also be working. Give it its own counter and its own rows in every export, so it can be paid on its own terms.

**Why now.** SWIFT's owner tried to model it as two shift types, "AM on call" and "PM on call". Run against the engine, that setup reports the morning as **2 covered** when only the locum is on the floor, holds a zone so nobody else can use it, writes a 7 hour clinical payroll row, and spends one of the person's twenty shifts. On-call would hide the gaps it exists to cover.

## The decision: not a shift type, a second layer

Three requirements settle it.

1. **The same person can be on the floor and on call later the same day.** `cycle.assign` is keyed `staffId|date` and holds exactly one record per person per day. That key is relied on by `getShift`, `canBook`'s "You already have a shift that day", `_mergeInvariants`, `clearShifts`, the grid, the day sheet, every export, the ICS feed and the reminders. Making it multi-record is deep surgery. A separate layer sidesteps it completely.
2. **On-call needs its own counter.** A separate list gives that for free.
3. **On-call must never count as cover.** By construction: it is not in `clinicalCounts` and holds no zone, so it cannot hide a gap or block a booking.

**Shape:** `cyc.oncall = { "<iso date>": { "<windowId>": "<staffId>" } }`. On-call **windows** are configured like shift types: id, code, label, start, end, `book` (may staff take it themselves), `rest` (does it count toward safe hours).

## One concept, not two

The zone tick shipped in 97a34b2 says "whoever works PM in this zone also carries the phone". That is Werribee's model and it works. Rather than leave two unrelated on-call mechanisms in the product, the tick becomes an **auto-fill rule on a window**: `window.from = {zone:"<id>", period:"PM"}`. Werribee's behaviour is then a derived entry in the same on-call roster, with no visible change for them, and there is exactly one on-call concept to explain.

## Decisions taken by the owner, 10 Sep 2026

- **Both assign it.** Staff can take an on-call window from the day sheet; an admin can place or clear it from the grid. Same shape as booking.
- **Exactly one person per window per day.** The engine refuses a second, and two devices racing cannot both win it. This needs a `_mergeInvariants` rule, deterministic on every device, like the zone dedupe.
- **It counts toward safe hours.** A night carried counts toward rest, so the app warns before that person works the next morning. `_spanOfExisting` must consider the on-call roster, not only `assign`.

## What it delivers

- As many windows as the group wants: AM on call, PM on call, a night, each with its own hours.
- Its own counter on My shifts and in the Fairness tab, never mixed with clinical shifts.
- Its own rows in the payroll and RosterOn exports, carrying the window's own code, so pay can treat on-call on its own terms.
- Its own calendar event, crossing midnight correctly.
- A visible marker on the roster, which also closes the current gap where on-call is invisible on every screen.

## Build order

1. **The layer and its config.** `cyc.oncall`, on-call windows on the cycle, the accessor (`cyc` first, never mirrored to a global), carry-forward in `prepareNext` and the import snapshot, the settings card. Tests: an absent key computes as no on-call, which is where both live orgs are.
2. **Assigning it.** Take and clear from the day sheet, place and clear from the cell editor, one per window per day enforced in the engine and in `_mergeInvariants`. Tests first on the race.
3. **Seeing it.** A marker on the grid chip, the day board, the agenda, the week strip and the cell tooltip, plus a line on My shifts. Closes the "I can't see on-call" gap.
4. **Counting and exporting it.** Its own counter, safe-hours integration, payroll and RosterOn rows, the ICS event, and the reminder text.
5. **One concept.** The zone tick becomes an auto-fill rule on a window; Werribee migrates with no visible change and the duplicate mechanism goes.

## Explicitly not in scope

Billings. The owner's group is paid a percentage of what they earn in their working hours, which is why on-call needs its own counter and its own export rows. The app does not track earnings and this plan does not add them. Whether Myrosta should hold billings per person per shift is a separate product decision, and a large one.

## Immediately

Remove or untick the "AM on call" and "PM on call" shift types so nobody is rostered on them before this exists.

## As built, 10–14 Sep 2026

Commits f0f625f, da8c4a2, d6d5a10, 88c1a27, 1cc1635, d762e5d (steps 1–4), then 9f2a0b1, 10f728e, 1c15fae, c388fa9, 03656dc and the release commit (step 5 and the fold). Decisions taken while building, each for a reason worth keeping:

- **The shape is flat,** `cyc.oncall = {"<iso>|<windowId>": "<staffId>"}`, keyed like `cyc.assign` so one merge rule (`_mergeKeyMap`) serves both. One person per window per day is then structural, not refereed; the referee's only rule is that approved leave wins.
- **`from` is `{zones:[ids], period:"PM"}`, an array,** because the tick can mark several zones and a window that follows them is still one kind of duty. A following window can have several holders on one day (one per zone); a taken window has exactly one.
- **The tick is folded at read time, never migrated.** `ocWindows(cyc)` returns the saved list when `settings.oncallWindows` is an array (empty = no on-call), otherwise `ocFromTick(cyc)`: one window `{id:"ONC", code:"OC", pay:"ONC", uid:"oc", from:{zones,...}}` built from the On-call type and `isOnCallZone`. `pay` and `uid` exist only so the payroll code and calendar ids the tick always used survive, including after the card is saved.
- **Screens draw only taken windows** (`ocTakenWindows`, `ocTakenBy`); pay, calendars, reminders-for-shifts and counts read every window (`ocHeldBy`). A following window travels with its shift: the shift is on the roster already, its hours go into Clinical hours, and its reminder is the shift's own. This is what keeps a live group's screens unchanged.
- **`tests/oncall-golden.js`** holds what the tick produced at 628603d. The suite compares 32 captures byte for byte; the one intended difference (the RosterOn continuation cell now names the real hours) is listed in the test with its reason. Never regenerate it to make a test pass.
- **No What's new note:** a group with no windows to take would be told about something it cannot see.
- **The Edge Functions carry their own copies** (`windowsOf`/`heldOn` in the feed, `takenWindowsOf`/`reminderFor` in the reminders' marked pure block), and `tests/run.py` lifts both into the suite, so they can no longer drift from the app unnoticed.

## Review, 14 Sep 2026

Four reviewers (Werribee unchanged, SWIFT end to end, settings and wiring, merges) ran the finished build against simulated phones sharing one CAS-guarded row, production's own build, and the real handlers. 47 findings; all reproduced; fixed in 96a4cdf, 8eff1ef, dfe7356, 48ca0ba, f0e2dc1, 427a4c1. The decisions those fixes rest on:

- **An on-call slot is shared, a shift key is not.** `_mergeKeyMap(…, shared)` keeps theirs when both sides changed a slot and theirs holds someone, so a late take or a stale removal never displaces a newer holder. `mergeOnto` records the loss in `_ocLost` (toast via `ocLostToast`) and in the log (`oclost-…`).
- **A commit's own attempt is never merged in.** `cloudCommit` snapshots `S` before `mutate()`; on a conflict with a save pending it merges that snapshot (unless something else changed during the write) and re-runs the attempt, so the loser is refused by name and a refused retry leaves nothing behind.
- **Settings merge card by card** (per sub-key of `cyc.settings`), and the merge base is stored with the copy it belongs to (`_keepBase`) on every path that applies someone else's change.
- **Who can hold on-call is read, not only written.** `ocCanHold(c,sid,isoD)`: in the group, in the cycle, not on leave. `ocHolder`, `ocHeldBy`, `ocTakenBy`, `ocInUse` all apply it, and every leave path also clears keys (`ocClearRange`); the referee drops phantoms and roster-typed leave with the holder in the audit id.
- **The card writes what it drew.** `ocCardRows` snapshots the list (`_ocCard`); rows carry `data-ocid`; `ocRowsNow` reads by id and keeps any followed zone that has no box; `ocCheck` is the one validator for Save, + Add and Remove; `ocImpact` counts shifts a following change moves and the save waits for a yes; a stale card refuses and redraws.
- **A zone edit pins on-call** (`ocPin`) in a cycle that never saved its windows, so a name can no longer switch it on or off. The Zones card shows "carries on-call" read-only.
- **The tick's hours come from `shiftTimesOf(c).ONC`,** where payroll always read them, not the type's copy; the first zone with an id decides.
- **Accepted:** two SMS segments when a reminder carries a shift and on-call; no reason prompt for on-call taps on a published roster; a take landing in the instant its window is removed stays invisible; a re-added window gets a new payroll code; a cycle prepared on an old build during rollout does not carry its windows.
