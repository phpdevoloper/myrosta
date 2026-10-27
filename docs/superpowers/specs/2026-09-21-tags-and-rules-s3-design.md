# Tags on people, rules on slots (S3) — design

**Date:** 21 Sep 2026 · **Status:** design approved section by section by Dr Ranjith (21 Sep 2026). **Built 26 Sep 2026** (plan `docs/superpowers/plans/2026-09-26-tags-and-rules-s3.md`, its *As executed* section lists every departure from this text).
**Programme:** sub-project S3 of `2026-09-16-staff-group-modules-programme.md`. S0–S2 (department groups) are live. S3 is what SWIFT's nurses need before they can be onboarded (S6); junior-doctor terms (W2) and the cover matrix (W4) later build on it.

## Why

SWIFT's nurses have two rules the engine cannot express today: **Triage may only be booked by a Triage-trained nurse**, and **every shift needs at least one Senior**. The programme already chose the model — *any tag on a person; a slot may require a tag; a shift may need at least N people with a tag, the last N open places held for them* — over fixed fields and over name lists per slot. This spec makes that model exact.

## Decisions

Carried from the programme: generic tags, two rule types; **rules on the cycle, attributes on the person**; one engine, never a branch on group kind; every refusal names its reason; nothing about a person leaves the group except what the digest already carries; a group that switches nothing on sees no change.

Taken in this brainstorm:

1. **The minimum counts everyone booked in that half of the day, across the whole group** (each AM and each PM; a whole-day shift counts in both). The number may differ between AM and PM **and** between weekdays, weekends and public holidays: six numbers per tag.
2. **An admin may knowingly break a rule**, behind a warning that names it; the breach is then flagged until fixed. Staff cannot. **The after-merge check never deletes a booking over a tag rule** — a breach is shown, never auto-removed.
3. **Each tag has a "show on the roster" tick**, off by default. Tags never leave the group.
4. **Tags arrive in bulk**: the staff import gains a **Tags** column, and each tag has a "Who holds this?" checklist.
5. **Approach A — one judge, called everywhere.** Two pure functions carry all the behaviour; six sites ask the first, the gaps display reads the second.

## Data

All three shapes are **absent until an admin creates something**: a group with no tags and a cycle with no rules stores, exports and syncs exactly what it does today.

**The tag list — on the group.** `S.tags = [{id, name, show}]`. `id` is minted once (`"t"` + a base-36 stamp, unique within the list) and never reused; `name` is what people read and may be renamed freely; `show:true` is the roster tick (the key is omitted when off). The list's order is the display order everywhere and the tie-break in the judge.

**Tags on the person — global, like name and mobile.** `person.tags = [tagId, …]`. A credential is a fact about the person, not about one roster. When the last tag is unticked the key is **deleted**, never written as `[]`, because the 3-way merge decides ownership by JSON equality.

**Rules — on the cycle.** `cyc.settings.rules = { needs: { [zoneId]: [tagId, …] }, mins: [ { tag, n: { AM:[wd,we,ph], PM:[wd,we,ph] } } ] }`.
- `needs`: a zone may need several tags; the person must hold **all** of them.
- `mins`: at most one entry per tag; `0` or blank means no minimum in that cell. Index 0 weekdays, 1 weekends, 2 public holidays.
- An empty `needs` or `mins` is omitted; an empty `rules` is deleted.

**Day type.** `2` if the date is in the group's public-holiday list (the one already marked in the app), else `1` on a Saturday or Sunday, else `0`. Exactly one per date; a public holiday on a Saturday is a public holiday.

**Accessors**, all taking their state explicitly so they work from the merge, the digest and a cycle that is not on screen: `tagList(st)`, `tagById(st,id)`, `tagName(st,id)`, `personTags(st,p)` (the person's tag ids that still exist in the list, in list order), `hasTag(st,p,id)`, `rulesOf(cyc)` (always an object with `needs` and `mins`), `dayType(st,isoD)`, `capOf(cyc,st,period)` (the smaller of that cycle's maximum for the period and the number of its zones open in that period), `ruleCounts(cyc,st,isoD,o)`.

**Carry-forward.** `prepareNext` and the roster import's settings snapshot deep-copy `rules` (JSON) and drop any `needs` entry whose zone is not in the new cycle. Removing a zone in the zone editor deletes its `needs` entry. Without the carry-forward a prepared cycle would silently lose its rules.

**In use.** A tag cannot be removed while any person holds it or any non-archived cycle's rules name it; the refusal gives both counts. Renaming is always allowed.

**A tag change on a live roster.** Tags are read as they stand now. Losing a tag never removes a booking: the shifts stay and are flagged from today onward; past days are never re-judged. Gaining a tag takes effect at once. (W2 makes a grade a tag between dates, which makes this exact.)

**Not changed:** no SQL, no Edge Function, nothing in `buildDigest` — a test pins that the digest carries no tags.

## The judge

`ruleJudge(cyc, st, sid, isoD, fills, zoneId, o)` → `{ok:true}` or `{ok:false, rule:"needs"|"held", tag, reason}`.

It runs **after** every check that exists today (leave, already working, the booking gate, fatigue, zone taken, headcount minimum and maximum, the AM/PM unlock order) and **before** turn, wave and quota — a held place is a fact about the slot, so it is the reason a person should read first. None of the existing checks change.

`o.without` is a list of people to treat as absent (the giver in a give-away, both parties' old shifts in a swap); `o.with` is a list of `{sid, fills, zone}` to treat as present (the other half of a swap).

**Rule 1 — the slot needs a tag.** If the zone's `needs` lists a tag the person lacks: refuse, `rule:"needs"`, reason **"⟨Zone⟩ needs ⟨Tag⟩."** (the zone's label for that period and shift type, as the sheet shows it).

**Rule 2 — held places.** For each half `P` in `fills`:
1. `open` = `capOf(cyc,st,P)` − everyone booked in `P` (after `without` / `with`).
2. For each entry of `mins` with `N = n[P][dayType]` > 0: `have` = holders of that tag booked in `P`, **plus one if this person holds it**; `short = max(0, N − have)`.
3. `worst` = the largest `short` (ties: the tag earlier in the tag list).
4. If `open − 1 < worst`: refuse, `rule:"held"`, reason **"Held for a ⟨Tag⟩ — ⟨Tue 29 Sep⟩ ⟨AM|PM⟩ still needs ⟨worst⟩, and ⟨this is the last place | only ⟨open⟩ places are left⟩."**

The largest shortfall, not the sum, because one person can hold several tags: the judge never refuses a booking that could still lead to a roster that satisfies every minimum. A whole-day shift is judged in both halves and counts toward the minimum in both.

`ruleBreaches(cyc, st, isoD)` → a list, in a fixed order (AM before PM; minimums before slots; tag-list order; zone order), of `{kind:"min", period, tag, need, have}` and `{kind:"needs", period, zone, sid, tag}`. It is pure; callers decide which dates to ask about (flags: today onward).

Both functions are deterministic: same roster, same tags, same answer, same sentence.

## Where the judge is asked

| Site | Behaviour |
|---|---|
| **Booking** (`canBook`, so also the day sheet's chips, `pickCheck` and batch confirm) | refused with the reason; batch picks are judged in order, each seeing the ones before it, as today |
| **Claiming an open shift or a give-away** (`canClaim`) | the same judge, with the giver in `without`. An admin approving a claim re-runs it, as approval already re-runs every other check; a claim that no longer passes is reopened with the reason |
| **Swaps** (`swOfferable`, `swapOffer`, `swapAccept`, and the reason shown for a closed offer) | judged **as a pair** — both people, both days, each other's old shift in `without` and new shift in `with`. Refused if either lands in a zone they lack a tag for, or if any affected half ends **shorter of any tag than it is now** (for each half and tag: shortfall after > shortfall before). A swap that leaves things no worse is allowed — Senior for Senior, or a Senior leaving a half that has another |
| **The admin's cell editor** | the same judge, as a **warning**: the judge's sentence, then *"Place ⟨Name⟩ anyway?"* with **Place anyway** and **Cancel**; going through writes `rules.override` (who placed whom, where, which rule) to the audit log |
| **Auto-draft** (`fillPeriodTo`) | while a half is short of a tag, holders of it are placed first; nobody is placed in a zone they lack a tag for; when nobody eligible is left the place stays empty |
| **Fixed patterns** | laid down as written — they are the admin's own placement; a breach is flagged |

**Never asked:** coming off a shift, and leave. People get sick; a rule must not trap them. The shortfall is flagged and the gap is posted as it is today. **An open shift's line says what the day is short of** ("needs a Senior"), computed when it is shown, not stored — so it is always current — and if it is the last open place only a holder can claim it.

**After a merge:** `_mergeInvariants` is not given a tag rule. A test pins that a breach survives the merge and that the merge does not throw when rules are present.

## What people see

**Settings → Staff group → Tags** (new card). The list: name, the show tick, how many people hold it. **Who holds this?** opens a checklist of everyone in the group, with search. Add, rename; Remove is refused while the tag is in use, with the counts.

**Settings → This cycle → Rules** (new card, after Cover, labelled with the cycle like the other cycle cards). A plain-words summary first — *"Triage needs Triage-trained. At least 1 Senior every AM and PM; 2 on weekend evenings."* — then *Slots that need a tag* (a row per zone with a tag picker; most rows stay "none") and *Minimums* (the six-number grid per tag). A cycle with no rules says so. With no tags defined the card points to the Tags card.

**Staff tab.** A person's tags as chips; the admin ticks them there too; a **Tag** filter. **Import:** the template gains a **Tags** column ("Senior; Triage-trained", split on `;` or `,`, matched to tag names without regard to case). A name the group does not have becomes a new tag, hidden by default, and the import summary says which were created. For a person the import updates, a non-empty cell **replaces** their tags; an empty cell leaves them alone.

**Staff.** A barred or held slot looks like any other unavailable slot and carries its reason. Their own tags appear on their profile, read-only — *"Set by your admin."* Tags with **show** ticked appear beside names on the day sheet and on this group's Day board as small chips carrying the tag's name, in tag-list order — never on the department board.

**Admin.** From today onward a tag shortfall **is a gap** (past days are never re-judged): "N days need cover" counts it, the day turns red, and the gaps list says what is missing — *"Tue 29 PM — needs 1 Senior"*, *"Wed 30 AM · Triage — Alex Chen isn't Triage-trained (placed by an admin)"*. The Day board's cover chip gains *"needs 1 Senior"*. The cell editor shows the warning.

**Audit, in plain words** (each key gets its `AUDIT_WORDS` sentence; the lint enforces it): `tags.add`, `tags.rename`, `tags.remove`, `tags.show`, `tags.person`, `tags.import`, `rules.needs`, `rules.mins`, `rules.override`.

**What's new:** one entry, three site-neutral lines.

## One thing to be plain about

**"Hidden" means hidden on the screens; it is not a lock.** Every member's app holds the group's whole record — as it already does for mobile numbers and leave reasons — so a determined person could read a hidden tag out of it. Tags are for credentials and grades, not for anything confidential (performance, health). The Tags card says so in one line.

## Compatibility

- No tags and no rules: the judge returns `{ok:true}` without reading anything else, `ruleBreaches` returns `[]`, and nothing new is written. Tests pin the first site's roster and payroll exports and the department digest byte for byte at the defaults.
- **A phone still on last week's build has no judge**, so it could book a held place. Nothing breaks: the booking shows up flagged, exactly as an admin override does, and the app's update prompt closes the window. Accepted, and said here so nobody is surprised.
- Unknown keys ride through an old build untouched (`mergeOnto` keeps the remote value of a key this device did not change).

## Testing

- **The judge:** slot-needs-tag (one tag, two tags, a tag the list no longer has); held places at every combination of open places and shortfall; two tags at once (largest, not sum; the tie-break); whole-day shifts; the three day types including a public holiday on a Saturday; `without` / `with`.
- **Each site** in the table above, including the swap judged as a pair in both directions, the override's audit line, auto-draft placing holders first and leaving a place empty, and a fixed pattern that breaches being flagged, not dropped.
- **Data:** carry-forward is a deep copy (changing next cycle's rules leaves this one's alone) and drops rules for zones that are gone; rename; remove refused in use; the last tag unticked deletes the key; the import's Tags column (create, replace, leave alone).
- **Invariants:** the merge leaves a breach in place; the digest has no tags; the byte-for-byte pins.
- **Mutation proof:** every guard broken once must fail a test (S0–S2: 16 of 16).
- The suite is synchronous (JavaScriptCore): anything a stub must observe happens before the first await.

## Build — eight tasks, dry-run from the plan's own text

1. Data, accessors, `ruleJudge`, `ruleBreaches`, with the matrix. 2. Booking, batch confirm, claims and give-aways. 3. Swaps. 4. The cell editor, auto-draft, fixed patterns. 5. Gaps: the chip, the red day, the Day board, the gaps list, the open-shift line. 6. The Tags card, the Rules card, the Staff tab, the profile, the badges. 7. The import column and carry-forward. 8. Release: What's new, changelog, build date, demo rebuild, the mutation run.

After any `app.html` change: `python3 tools/build-demo.py`. `const BUILD` = the changelog's newest app heading = `WHATS_NEW[0].on`. Edge Functions are not touched; nothing calls notify-shifts.

**The owner's steps afterwards:** push. Then, for SWIFT's nurses: define the tags, import the staff list with its Tags column, set the rules on their first cycle (the SWIFT admin guide gains this at S6).

## Out of scope

Dated tags (W2); ratio rules ("one Senior per six nurses"); a slot needing *any of* several tags; per-zone minimums; choosing an open shift's audience by tag (W5); tags on the department board; changing the demo's sample data; a lock on hidden tags.
