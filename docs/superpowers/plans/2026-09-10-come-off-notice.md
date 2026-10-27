# Coming off a shift: a notice period, and on-call as a tick

**Goal:** stop a live roster losing a shift silently. Close to the day, a person either hands the shift to a colleague or asks the admin; further out they may drop it, and it goes straight to the group. Separately, let an admin say which zone carries on-call instead of hiding it in the zone's name.

**Asked for on 10 Sep 2026** by the owner: *"if its rolling roster, we need to have restriction to staff coming off their shift in the 2 weeks of their shift date… also if it needs coming off in the 2 week prior to shift then need admin approval. also when come off, that shift need to go to market place for filling."* Plus: on-call should be settable to a real window such as 22:00–01:00.

**Decisions already taken (fixed):**
- **D1** Inside the window, offering the shift and having a colleague accept needs no admin. Approval is only for coming off with nobody replacing you.
- **D2** A shift dropped outside the window is broadcast to the group at once.
- **D3** On-call: an explicit per-zone tick now; on-call as its own bookable shift is a later, separate piece.
- **D4** Applies to any live or published roster, rolling and rounds alike. Not to drafts.

---

## What is actually true today (three surprises, all verified)

1. **Werribee cannot self-drop at all.** The day sheet's Remove button is gated by `canPick` (app.html:2838), which requires `bookingGate(cyc).ok`, and `bookingGate` (app.html:998) refuses a published rounds cycle. Werribee is rounds + published. Its consultants' only exit today is **Offer to group** on My shifts, which never consults `bookingGate`. So this feature changes behaviour for **rolling rosters and rounds-while-open** — SWIFT and any group mid-round. That is worth saying out loud, because it means Werribee is at very low risk from this change.
2. **Requests already carry three kinds, not two:** `swap`, `leave` and `fixed` (a pattern change), routed at app.html:2986. `requestAdminCard` (3124) is *the leave card* and is the fall-through for anything unrecognised — it reads `r.code`/`r.dateFrom`/`r.dateTo` and would throw on a fourth kind. Any new kind needs its own card **and** early returns in `approveRequest` (2930) and `declineRequest` (2946).
3. **The give-away already does the hard part.** `offerShift` (1482) posts the shift and *leaves the assignment with the giver* until `_osExecute` (1520) moves it. The gap is never open. D1 is therefore already shipped; this plan mostly decides *when the plain Remove button is allowed*.

## The shape

A notice window is **a number on the cycle**. "Ask to come off" is **the give-away record that already exists, with one object added**. A drop outside the window is **the admin's existing gap broadcast, posted by the staff member**. No new array, no fourth request kind, no new tab.

The alternative — a fourth request kind — was designed and rejected. Under D1 an ask must *also* be an offer, so it needs two rows in two independently union-merged arrays (`ID_ARRAYS`, 746) kept in step through claim, withdraw, expiry and decision, plus a new admin card to avoid throwing inside the leave card.

## The model

| Thing | Where | Notes |
|---|---|---|
| `cyc.settings.noticeDays` | per cycle | integer days, **0 = off**. Read only through `effNotice(cyc)`, argument form like `shiftTypesOf`. **Not** hydrated to a global. |
| `o.ask` | on a `kind:"giveaway"` openShift | `{status, ts, reason}` — the entire approval request |
| `o.droppedBy` | on a `kind:"gap"` openShift | display only; a gap that came from a person, not an admin |
| `z.oncall` | per zone | **tri-state**: `undefined` = today's name regex (no migration), `true` = carries on-call, `false` = explicitly not, even if the name matches |

New audit keys, each needing an `AUDIT_WORDS` sentence or the lint fails: `market.ask`, `market.release`, `market.keep`, `settings.notice`, `settings.zoneOnCall`.

## The flows

**Outside the window.** Remove, as now, but behind the house confirm dialog and followed by a broadcast in the *same* commit. The group's bell reads that the shift is open. The person's own count drops at once.

**Inside the window.** No Remove button, and `unbookShift` refuses in the engine too so no other surface routes around it. Two buttons instead: **Offer to the group** (the existing `offerShift`, no admin, ever) and **Ask to come off**, which writes `o.ask` on that same offer. So an ask is always also an offer: if a colleague takes it first, the admin never has to decide.

**The admin** decides in the Requests tab, beside leave, swaps and pattern changes. The card shows the shift, the notice remaining, the reason, whether anyone has claimed it, and that day's cover against the minimum. Two buttons: **Keep them on** and **Let them off**. Letting them off deletes the assignment and posts the gap.

## Traps the skeptic found — each one is a real bug if ignored

1. **The settings card must read `cset().noticeDays`, not a global.** Every sibling per-cycle card (`card-leavecap` 2360, `card-fatigue` 2325) renders a *hydrated global* because `hydrateCycleSettings` mirrors it. `noticeDays` is deliberately not hydrated. Copying `card-leavecap`'s shape blind renders 0 for a cycle set to 14, and one tap on Save writes 0 over it behind a "Saved" toast. **Highest-risk single line in the whole plan.**
2. **Do not widen the Remove button in rounds.** Today's condition is `canPick && (adm || !isRolling(cyc) || isoD >= today)`; `canPick` carries `myTurn`. A new `dropOptions()` that drops those terms hands a Remove button to someone whose snake turn it is not.
3. **`offerShift` has no marketplace guard of its own** (1482) — the only gate is `marketOfferBtn`'s render check. A second call site needs `featOn("marketplace") && S.marketOn` added inside it, or an Offer button appears with the marketplace off.
4. **Do not nest `commitGuarded`.** `offerShift` is already a `commitGuarded` call; calling it inside another mutate fires two CAS commits and overwrites `_osPushQueue`. Factor a plain `_offerBody` the way `_osExecute` relates to `claimOpenShift`.
5. **`commitGuarded` returns `true` synchronously in cloud mode** (799). A success *toast* would be a claim the code cannot yet make. Use the `_settled` receipt pattern, as claims already do.
6. **Resolve the cycle by `o.cycleId`**, as `_osExecute` does (1521) — never by `cycleForDate`, which returns the first non-archived cycle containing the date.
7. **Keep the ask list to the active cycle** (`osActive()`), the marketplace's own unit of work. A cross-cycle list computes every fact against the wrong cycle: `canClaim`, `getShift`, `clinicalCounts`, `effStaffing` and `zoneById` all read `active()`.
8. **No notifications from `normalize()`** — it runs under `_applyingRemote` on every device and does not save.
9. **`_postGap`'s actor must not be written to `o.actor`**, or the dropper regains the right to withdraw their own gap (`withdrawOpenShift`, 1499).
10. **Do not notify the dropper about their own drop** — `notifFor` (936) delivers `to:"all"` to everyone including them.
11. **`applyRosterImport`'s settings literal (3354) is already missing `rosterMode`.** Fix that in the same pass rather than widening the same silent-loss bug by one more key.

## Build order

1. **The number and the gate.** `cyc.settings.noticeDays`, `effNotice(cyc)`, carried through `prepareNext` and the import snapshot; the `card-notice` Settings card reading the *cycle's* value; the checklist row. Tests: `effNotice` returns 0 for a cycle whose settings lack the key — the state both live orgs are in right now.
2. **A dropped shift goes to the group.** `_postGap` factored out of `postOpenShift`; `dropShift` doing delete-and-post in one mutate; the confirm dialog. Tests first on `unbookShift`, which has **zero coverage today**.
3. **Two doors inside the window.** `o.ask`, `askComeOff`, `decideComeOff`, the admin card in Requests. The test that matters most: inside the window a staff drop is refused **and the assignment is still there** — a careless implementation returns `{ok:false}` after deleting.
4. **On-call is a tick.** `z.oncall` tri-state; `isOnCallZone` keeps the ONC type gate first, then the flag, then the regex. The three existing on-call assertions must pass **unchanged** — that is the proof the migration is safe. The duplicated `isOnCallZone` in both Edge Functions needs the same change.

## Deliberately not building

The cross-cycle ask list; a "2 colleagues are free" scan and an [Open that day] button on the ask card; an `S.noticeDays` global that nothing sets; quick-pick chips beside a number input; five bespoke notification strings where three do; renaming `marketOfferBtn`; a staff-side mirror of pending asks in Requests.

## Answered by the owner, 10 Sep 2026

1. **The back door is in scope.** Approving leave deletes assignments across every cycle with a bare `delete` (`approveRequest`, 2936) — no broadcast, no cover check, nobody told. Once `_postGap` exists, each freed clinical day is posted in that same loop. Goes in **commit 2**, beside the drop path, because they share the helper. Note the loop spans cycles, so `_postGap` must take the cycle id explicitly rather than assuming the active one.
2. **No cap on repeat drops.** Every drop is broadcast and logged, so the pattern is visible in the audit log and in Open shifts; a repeat offender is a conversation, not a rule. Revisit only if it actually happens.

## Judgements made without asking

Default `0` (off) everywhere, so nothing changes for either live org on upgrade day and the admin turns it on per cycle. A reason is **required** on an ask, unlike leave and swap, because it is the one request that costs the department cover. Letting someone off below the minimum shows the consequence and asks for a confirm rather than refusing.
