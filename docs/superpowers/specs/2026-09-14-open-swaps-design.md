# Swaps without naming one colleague — design

**Date:** 14 September 2026 · **Status:** approved 15 Sep 2026 · **Asked for by:** SWIFT · Consultants; applies to every group

## Why

In the owner's words: "swaps cannot be completed without selecting colleague. we need to have open option to send everyone on the list rather than one consultant or send to admin for solutions and market place option if within restricted timeframe prior to shift date".

Today, Requests → Request a swap needs a named colleague and one of their shifts. The colleague agrees, then an admin approves. Separately, the day sheet of a booked shift offers *Remove this shift* when the shift is outside the notice period, or *Offer it to the group* and *Ask to come off* inside it, and both of those need the marketplace switched on. The options live in different places, and nothing lets someone ask the whole group for a swap.

## Decisions (owner, 14 Sep 2026)

| Question | Decision |
|---|---|
| Open swap | "Ask everyone": colleagues each offer one of their own shifts, and the person asking picks one. |
| Admin approval | Still needed, exactly as for a named swap. |
| Who hears about it | Only colleagues who could actually take the shift. In-app notification, plus a phone alert where alerts are on. Never a text. |
| Inside the notice period | Ask everyone, Offer it to the group and Ask to come off can all run at once. Whichever completes first wins. |
| Asking to come off | Also works when the marketplace is off, and then goes only to the admins. |
| Help for the admin | A *Free that day* list on the admin's card. |
| What a shift counts | Shown on every offer, so a full day for a half day surprises nobody. |

## How it works

### One way in

- The day sheet of a consultant's own booked clinical shift gains **Swap it**, beside *Remove this shift* outside the notice period, or beside *Offer it to the group* and *Ask to come off* inside it. Inside the notice period with the marketplace off, where today there is only the notice note, the sheet shows **Swap it** and **Ask to come off**.
- Requests → Request a swap opens the same swap screen.
- The swap screen starts with the shift, preselected when it was opened from a day sheet. Below it are two choices:
  - **With a colleague:** today's form, unchanged.
  - **Ask everyone:** an optional note, a line saying who it will reach ("Goes to 7 colleagues who are free on Mon 26 Oct"), and the **Ask everyone** button. When nobody qualifies, the line says so and the button is off.

### Who can offer

For a consultant A asking about their shift on day D, a colleague B can offer when all of these hold:

- B is on this cycle's roster and is not A.
- B has no shift (clinical or non-clinical) and no leave, UA included, on D.
- B holds at least one shift on a day E in the same cycle, where E is today or later, E is not D, and A has no shift and no leave on E.

The shifts B can offer are exactly those shifts on days like E. Only colleagues who qualify are notified: "Dr A is looking for a swap for Mon 26 Oct AM+PM."

### Colleagues answering

Requests gains a **Swaps wanted** card listing each open swap the colleague qualifies for, with the note. **Offer a shift** lists their offerable shifts, each labelled with what it counts, for example "Fri 6 Nov · AM+PM · counts 2". **Send offer** stores it and tells A.

Each colleague makes one offer per open swap, and can change or withdraw it while the swap is open.

### Choosing an offer

A's Requests shows the open swap with its offers, for example "Dr B offers Fri 6 Nov PM · counts 1", each with **Accept**. Accepting re-checks that both shifts still fit, then:

- creates an ordinary swap request `{type:"swap", from:A, dateA:D, peerId:B, dateB:E, reason:<note>, status:"pending", peerAgreed:true, openId}`, which reaches the admin through the existing swap card, tagged "via Ask everyone";
- marks the open swap done and that offer accepted, and closes the other offers;
- tells B that A accepted and it has gone to the admin, tells the other colleagues who offered that A found a swap, and tells the admins, as agreeing to a named swap does today.

**Withdraw** closes the open swap and all its offers, and tells everyone who offered.

### The admin

Approving and declining are unchanged: `approveSwap` runs `executeSwap`, which re-checks both shifts. Declining, or later cancelling an approved swap, does not reopen the open swap. A can ask everyone again.

### Tidying up

An open swap is valid only while all of these hold: it is open; D is today or later; A still holds the same shift on D (the same kind, half, zone and type as when they asked); and its cycle is live and not archived. An offer is valid only while it and its open swap are open, E is today or later, B still holds the same shift on E, and A is still free on E and B on D.

- Validity is worked out every time a swap or offer is shown, and again inside the Accept write. Anything invalid shows as closed, with the reason, and cannot be accepted, even if nothing closed it explicitly.
- These paths close it explicitly, setting the status and telling the people who offered:
  - A withdraws, or accepts an offer.
  - A swap is approved that takes A's shift on D, or B's shift on E. This closes the open swaps and offers it affects.
  - A colleague claims A's give-away (`_osExecute`).
  - An admin lets A off (`decideComeOff`).
  - Leave is approved, or set on the planner, over D (`approveRequest`, `plannerSetLeave`).
  - A removes the shift with *Remove this shift*.
  - An admin's cell edit removes or changes the shift.
  - **Clear the roster** runs; it closes every open swap on the cycle.
- When the day arrives, open swaps and their offers simply read as closed ("that day has passed"). No write is needed.

### Asking to come off when the marketplace is off

Today `askComeOff` always also offers the shift to the group, which needs the marketplace on. With the marketplace off, asking creates the same record with `kind:"ask"`. It is never listed as an open shift and cannot be claimed. The admin still chooses *Keep them on* or *Let them off*. Letting them off removes the shift and broadcasts nothing, and the day then shows as needing cover, like any gap. With the marketplace on, nothing changes.

### Free that day

The admin's *Come off a shift* card lists the consultants on this cycle's roster with no shift and no leave that day, each with a Call link where a mobile is on file. Admins already see these numbers on the Staff page.

## Data

- `S.openSwaps: [{id, cycleId, from, dateA, shift:{kind, period, zone, type}, note, status:"open"|"done"|"closed", why, ts, swapId}]`
- `S.swapOffers: [{id, openId, by, dateB, shift:{kind, period, zone, type}, status:"open"|"accepted"|"closed"|"withdrawn", ts}]`
- Both are merged item by item by `_mergeIdArray` (added to `ID_ARRAYS`), so two colleagues offering at the same moment both keep theirs.
- They are kept out of `S.requests` on purpose: the admin's request lists render any request in a pending or decided status, and an unknown type would be drawn as leave.
- Writes go through `commitGuarded`, with validity re-read inside the write.
- New audit keys, each with its `AUDIT_WORDS` sentence: `swap.ask`, `swap.ask-withdraw`, `swap.ask-close`, `swap.offer`, `swap.offer-withdraw`, `swap.accept`.
- Prepare next cycle copies neither array.

## Compatibility

- Named swaps are unchanged, and their existing tests must keep passing.
- An older copy of the app keeps the two new arrays untouched, because unknown keys survive both loading and merging, and simply does not show them.
- The Edge Functions are untouched. Reminders read `cyc.assign`, which only an approved swap changes.

## Testing

In `tests/suite.js`, run by `python3 tests/run.py`:

- Who qualifies: free, on leave, UA, no offerable shift, a past day, the same day.
- Offers list only valid shifts; one offer per colleague; changing and withdrawing an offer.
- Accepting creates a pending swap with `peerAgreed`, closes the other offers, and notifies the right people.
- Approving carries the swap out; declining does not reopen the open swap.
- Every tidy-up path closes what it should. Read-time validity stops a stale accept: the shift moved zone, or leave was approved without a close.
- Merge: two offers made at once both survive. An accept racing a withdraw ends in exactly one outcome, because the write re-reads.
- Asking to come off with the marketplace off: the ask is neither listed nor claimable, and letting someone off removes the shift without a broadcast.
- The *Free that day* list.
- The lints: `AUDIT_WORDS`, and the wiring lint covering Swap it, Ask everyone, Send offer, Accept and Withdraw.

Each guard is mutation-tested.

## Build order

1. **Records and rules.** `S.openSwaps`, `S.swapOffers`, and the qualification and validity helpers, with tests and no screens.
2. **The flow.** Ask everyone, offers, accept and withdraw: the writes, notifications and audit.
3. **Screens.** Swap it on the day sheet, the swap screen's two choices, Swaps wanted, offers on the requester's Requests, and "via Ask everyone" on the admin's card.
4. **Tidying up.** The explicit close on every path listed above.
5. **Asking to come off** with the marketplace off, and *Free that day*.
6. **Docs.** CHANGELOG, a What's new note (swaps exist in every group), and the staff and admin guides in the SWIFT go-live pack (outside the repo).

## Not in scope

- Swaps across cycles, or with a shift in a draft cycle.
- Swaps that go on the roster without admin approval. A group setting could come later.
- Texts about swap requests.
- "I'll just take it" inside Ask everyone. That is what *Offer it to the group* does.
- Safe-hours checks on swaps. Named swaps do not check them today either, and the admin approves every swap.

## As built, 15 Sep 2026

Plan: `docs/superpowers/plans/2026-09-15-open-swaps.md`, six commits, then the final review's fixes. Decisions taken while building:

- **Both sides of a swap are clinical shifts.** Swap it sits on a clinical shift, and a non-clinical day offered back would be no cover and count nothing.
- **The rules are pure functions over the roster** (`swOfferable`, `swWho`, `swAskWhy`, `swOfferWhy`), read on every screen and again inside every write. A colleague with no entry in the cycle's roles is not on its roster, as the rest of the app already treats them.
- **Requests shows the cycle on screen**, like open shifts. Every notification carries its cycle, so a tap switches there.
- **One sweep, `swTidy()`, does the explicit closes.** `approveSwap`, `cancelApproved`, `_osExecute`, `decideComeOff`, `approveRequest`, `plannerSetLeave`, `dropShift`, `unbookShift` and `setShift` (the cell dialog and the day sheet's own writes) call it, and it skips a day already gone. Clear the roster closes its cycle's asks with its own reason. The asker is not told when their own ask closes; whoever offered is.
- **The swap sheet starts on With a colleague** and keeps the chosen shift in `_swapMine` and any typed note in `_swapNote` across its own re-renders, so changing the shift, switching the choice or picking a colleague no longer resets them. The note was added after the task review found it wiped.
- **Offers name the zone** as well as the type and what they count, like the named-swap form.
- **Asking to come off with open shifts off** is the same record with `kind:"ask"`: `osActive` leaves it out, `claimOpenShift` refuses it, and `_offerBody` takes an `adminOnly` flag. Clear the roster withdraws it as it withdraws open shifts.
- **Free that day** shows one call button per person with a mobile on file and one line for the rest, so a long list stays short on a phone.
- **The tab wiring lint also reads** `dsBookedActs`, `reqSheetHTML`, `swapAllFormHTML`, `swapAskingHTML` and `swapWantedHTML`.
- **Help's swap answer names Ask everyone.**
- **The ways in follow the day sheet's existing booking gate.** Swap it and Ask to come off sit on the day sheet, which opens from Book shifts while booking is open; Requests → Request a swap reaches Ask everyone at any time, which is how a rounds roster reaches it after publishing. What's new and the changelog say so rather than "every shift".
- **A give-away or an ask to come off does not outlive its shift.** `osTidy()`, run first in `swTidy()`, withdraws each open or pending give-away and ask to come off, from today on, whose giver no longer holds that exact shift (period, zone and type, in the record's own cycle); it tells a waiting claimer and logs `market.withdraw`. `osActive` and `pendingAsks` leave such records out as soon as the shift moves, and `decideComeOff` acts on neither Keep them on nor Let them off for a shift that is no longer theirs. Letting someone off settles its own record before it sweeps, or the sweep would withdraw the very ask being decided. Added after the final review, which found an ask to come off and a give-away outliving a winning swap.
- **Accept is pinned to the offer shown.** The Accept button takes a snapshot of the offer's day and shift when its confirm opens, and `swapAccept(offerId, seen)` refuses if a Change offer landed in between. `seen` is optional.
- **`swTidy()` also runs on plain-save paths** (`approveSwap`, `cancelApproved`, `approveRequest`, `plannerSetLeave`, `setShift`), not only inside `commitGuarded`. There the three-way merge, plus approval's own re-check of both shifts and the validity read again on every screen and inside every write, keeps the outcome consistent when two devices act at once.
- **Smaller fixes from the final review.** With open shifts on, an ask made while they were off still stands, so the day sheet and `_offerBody` do not ask or offer again; asking everyone about a shift is refused while a swap for it is still waiting (pending, awaiting the colleague, or with a question open), on either side of it; cancelling an approved swap tidies like approving one; the swap sheet opens fresh on With a colleague; with open shifts off, a day already gone offers no Ask to come off and `_offerBody` refuses it.
