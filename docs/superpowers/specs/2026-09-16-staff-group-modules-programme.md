# Staff-group modules — programme design · 16 Sep 2026

**Status:** approved in brainstorm 16 Sep 2026; each sub-project gets its own spec and plan before it is built.
**Owner:** Dr Ranjith. **Sites:** SWIFT (site 2, five staff groups, 10:00–22:00, no nights) first; Werribee Mercy ED's own junior doctors (24/7) second; then any hospital.

## 1. What this programme delivers

Four kinds of staff group beyond consultants — **junior doctors, nurses, scribes, clerical/admin** — running on the one Myrosta engine, plus the **console** a hospital admin uses to run several groups from one seat. Nothing here is a "nurse feature" or a "JMO feature": every capability is an optional module any group can switch on, so one product stays consistent across hospitals (the principle recorded in MYROSTA-GROUP-SETUP.md, Part D).

## 2. Decisions carried forward (already on record)

| Decision | Source |
|---|---|
| One org per staff group, grouped under a hospital umbrella; never separate deployments; never a fork of app.html | MYROSTA-SITE2-PLAN.md §1, multi-org plan |
| Every capability an optional module a group enables; names and role nouns are free text, not a catalogue | MYROSTA-GROUP-SETUP.md |
| Shift times, including nights, fully admin-set per cycle; no hardcoded patterns | JMO concept, decisions 7 Jul 2026 |
| Junior rosters are stable **lines** that people **occupy** for date ranges; changeover is an occupant handover, not a re-roster | JMO concept, terms model |
| The open-shift marketplace is the CMO offer pool; CMO-claimed shifts count as agency spend avoided | JMO concept, decisions 7 Jul 2026 |
| EBA pack #1 is Victoria's doctors-in-training agreement; roster legality only, never pay interpretation | JMO concept |
| Build nights while the tenant count is small; AM and PM stay valid ids so existing rosters migrate untouched | MYROSTA-SHIFT-TEMPLATES-PLAN.md |
| Cross-group data is published as a digest per group, one row per (hospital, group), row-level security; never one shared row | MYROSTA-DEPARTMENT-BOARD.md v2 |
| Hospital identity must be an id, not free text | MYROSTA-DEPARTMENT-BOARD.md v2 §4 |
| Settings and rules belong to the cycle (hydration model); identity fields belong to the person | project-per-cycle-architecture |
| Scope is rostering only | project-ed-roster-app |
| No external AI touches staff data; the engine is deterministic and explainable | competitor positioning, MYROSTA-COMPETITOR-IRIS.md |
| The owner pastes SQL and Edge Functions into the Supabase dashboard by hand; nothing may call notify-shifts from the app | working agreement |

## 3. Decisions taken 16 Sep 2026

1. **Order:** all four groups, phased — **SWIFT first**, then Werribee's junior doctors as the 24/7 customer (Medical Workforce Unit), then the generic product.
2. **"Admin module" means both:** the clerical staff group's roster, *and* a console for whoever runs several groups.
3. **Scribes at SWIFT see who's on** — their booking sheet shows the consultants holding that shift, read-only. No hard link to a named consultant (kept as a possible later switch).
4. **SWIFT nurses need two rules:** a credential that gates a slot (Triage needs Triage-trained) and a grade with a minimum per shift (at least one senior on every shift).
5. **SWIFT junior doctors need nothing beyond what is live** — AM/PM booking like the consultants.
6. **SWIFT clerical staff need both** named slots at set times (shift types, already possible) *and* per-person hours that vary by day (an override on the booking).
7. **The console holds four things:** today's cover and gaps across groups; the "who's on today" board for everyone; add a staff group in-app; leave across the department.
8. **The junior-doctor engine is a wizard** that asks, in order: roster cycle → doctors available per grade → shifts and zones per day → doctors per shift → leave → an EBA-valid draft → a capacity calculator.

## 4. The three forks, and the picks

**How one group sees another.** *Digest table* (each group publishes a small extract; the hospital reads it) versus *direct reads* (scribes made viewers of the consultants' whole record) versus **hybrid — chosen**: the digest for everything staff-facing; the console reads, read-only and through its own path, the full records of the groups the signed-in person already administers. Direct reads were rejected for staff because a viewer would see everything (emails, pay, leave reasons) and a 100-nurse record would sync to every scribe's phone.

**Credentials and seniority.** *Fixed fields* (a grade box and a triage tick, rules hard-coded) versus *name lists per slot* versus **tags plus two rule types — chosen**: any tag on a person; a slot may *require* a tag; a shift may *need at least N* with a tag, the last N open places held for them. The same module gives junior doctors their grade mix.

**Clerical hours.** *More shift types* versus *own hours on the booking* versus **both — chosen**: types for set patterns, an override for the rest, and a per-group setting for whether staff may set their own hours (off by default).

## 5. Sub-projects

| # | Sub-project | Delivers | Depends on | Size | Owner pastes |
|---|---|---|---|---|---|
| **S0** | Add a staff group in-app | `create_group` RPC; the sheet in the account popover; `hospitals` registry with `orgs.hospital_id` backfilled | — | 3–4 days | SQL (with S1) |
| **S1** | Department digest | Per-group published extract of live rosters into `board_slice`; deterministic build, hash-gated, size-capped; publish switch per group, off by default | S0 | 4–5 days | SQL (one file with S0) |
| **S2** | Who's on today | Day board gains *This group · Whole department*; printable; scribes' booking sheet shows chosen sibling groups | S1 | 3–4 days | — |
| **S3** | Tags on people, rules on slots | Tags per person; per-cycle rules: slot needs tag, shift needs ≥N with tag (held places); enforced in booking, claims, swaps, auto-draft, admin placement; gaps show a missing tag | — | 5–6 days | — |
| **S4** | Own hours on a booking | `hours:{start,end}` on an assignment; admin from the cell, staff when allowed; read by pay, RosterOn, calendar, reminders, safe hours, Day board, digest | — | 4–5 days | Edge Functions `ics`, `notify-shifts` |
| **S5** | The console | *Department* for admins of ≥2 groups: today across groups, leave across the department, add a group; read-only peek path, no writes | S0 | 5–6 days | — |
| **S6** | SWIFT onboarding | Four groups made through S0, presets, invites, guides | S0–S5 | — | — |
| **W1** | Nights | Periods become an admin-set list per cycle; everything keyed on AM/PM rekeyed; presets *AM/PM* and *24/7*; a lint against "else PM" | — | 3–4 weeks | both Edge Functions |
| **W2** | Terms | `terms:[{from,to,grade}]` on a person; membership and pro-rated share from dates; grade = tag between dates; orientation and first-week rules; Fairness "this term" | S3 | 1–2 weeks | — |
| **W3** | EBA rule packs | Named, versioned packs extending safe hours (min break, max shift, max consecutive days, night limits and recovery, weekend frequency, hours per fortnight); blank = not enforced; audited | — | 1 week | — |
| **W4** | Junior-doctor engine | The seven-step wizard; cover matrix grade × period; lines then occupants; block/warn validation; per-category shares; four presets; capacity calculator with printable business case | W1 W2 W3 S3 | 4–6 weeks | — |
| **W5** | Relief and escalation | Relief line; escalation view relief → under-hours juniors → CMO pool (marketplace, audience by tag) → locum → declared gap; avoided-agency-spend counter | W4 | 1–2 weeks | — |
| **G** | Generic | 24/7 presets, MYROSTA-GROUP-SETUP.md rewritten around S0, guides, demo | as each lands | ongoing | — |

Sizes are build-and-review days in the working pattern used for call-ins and open swaps (spec → plan dry-run → subagent tasks with reviews → final review → mutation checks).

## 6. Sequencing and gates

1. **S0 + S1 + S2 first** — after them all five SWIFT groups can run with the board. SQL is one idempotent file; **the isolation test (v4) must pass on production** before SWIFT's four groups are created.
2. **S3, S4, S5** in that order; S6 as soon as S3 and S4 land (nurses and clerical are the two groups that need them).
3. **W1 nights** before any 24/7 group, on a branch, with its own per-period test suite and the full smoke; W2 and W3 may run in parallel with W1's review.
4. **W4** only after W1–W3 are live; W5 after W4.
5. Every sub-project: own spec (`docs/superpowers/specs/`), own plan dry-run from its text, `python3 tests/run.py` green, `python3 tools/build-demo.py`, CHANGELOG entry, `const BUILD` = latest heading date, commit on main, the owner pushes.

## 7. Principles every sub-project must keep

- **One engine.** No branch of behaviour keyed on a group kind; presets only *seed* settings.
- **Rules on the cycle, attributes on the person.** A published cycle never changes because a rule was edited later.
- **Privacy by construction across groups.** Only display name, slot, period, times, on-call/call-in, and an *away* flag ever leave a group. No reasons, contacts, pay, requests, notes.
- **Deterministic and explainable.** Same inputs, same bytes; every refusal names its reason; every draft decision can be shown.
- **Backward compatible.** Werribee and SWIFT see no change until an admin switches something on.
- **The merge invariants are the riskiest site.** Anything that adds a rule the 3-way merge must respect (held places, tags on zones) is tested under `_mergeInvariants`.
- **Edge Functions lag app.html.** Unknown fields degrade to today's behaviour, never drop an event or skip a reminder.

## 8. Open questions (do not block S0–S2)

- SWIFT: headcount per group; whether anyone besides Ranjith and Vijay administers a group; whether the board should show *away* people (default: yes, as "Away", no reason).
- Werribee juniors: the MWU as customer; the actual Victorian DiT EBA clause values; HMO and registrar term calendars; the department's current cover matrix.
- Whether a scribe should ever be *booked to* a consultant (fork 3 of Q3, option C) — revisit after a cycle on the read-only sheet.

## 9. Out of scope

Clinical content of any kind; pay interpretation; per-record database tables; dark mode and tablet layout; cross-hospital views; any change to the tab set or `NAV_ORDER`.
