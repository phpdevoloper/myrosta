# SWIFT onboarding: nurses, scribes and admin together (S6) — design

**Date:** 27 Sep 2026 · **Status:** design approved section by section by Dr Ranjith (27 Sep 2026).
**Programme:** sub-project S6 of `2026-09-16-staff-group-modules-programme.md`. S0–S4 are live (S4 own hours pushed and both Edge Functions pasted 27 Sep 2026). S6 puts SWIFT's three remaining groups on Myrosta with the consultants.

## Why

SWIFT's nurses, scribes and admin staff are rostered today in three manager-kept spreadsheets: a fortnight grid of start, finish and break per person per day, a year grid of unavailability, and for the scribes an AVAILABLE row the manager allocates from. The three groups already exist in Myrosta (made from the account menu on 17 Sep 2026, seeded from their presets) with nothing in them. S3 gave nurses their tags and rules; S4 gave clerks their own hours. S6 is the move itself: the people, the settings, the first rosters with true times, the guides, and one launch date for all four groups.

## Decisions

Taken in this brainstorm (the owner's answers):

1. **One launch date: Monday 26 October 2026**, the consultants' date, a pay-fortnight Monday. Four weeks from the design.
2. **The managers' written fortnights come in with true times**, then the app is the record from launch: managers place the rest in the app, staff book and claim where the group allows, and the spreadsheets are never re-imported.
3. **Through the app's own importers, no SQL.** Per group, three files in Myrosta's import formats built from the manager's workbook, plus a one-page settings checklist the admin applies in Settings. The managers learn the tools they keep using.
4. **Flexible filling, A plus B.** Every group runs rolling and always live: managers place from the cell editor and Pre-fill, staff book what is still open within the rules and their share, and the manager posts open shifts for anything to be claimed. A manager who wants control places the fortnight first, so nothing is left open, and sets each person's share to what they should work; one who wants full self-booking leaves days open and sets shares. No rebuild either way, and the guides describe both. *(Amended 28 Sep 2026 while writing the guides: the booking window is not the lever for this — there is one window per cycle, set before Go live, and while it is shut staff cannot open the Book shifts days at all, so they lose swapping, offering, coming off, changing hours and marking unavailable from the day sheet.)*
5. **One staff guide for the three groups, one managers' guide, a 30-minute demo** by the owner on the three real groups while they are still in draft.
6. **The unavailability grids import through a new tick**, *Treat any filled cell as unavailable*, off by default, so the managers can re-import their year grid before each cycle themselves.

Carried from the programme: one engine, presets only seed; rules on the cycle, attributes on the person, hours on the booking; Werribee and the consultants see no change.

## Launch and cycles

All four groups run one first cycle, **Monday 26 October 2026 to Sunday 17 January 2027** (twelve weeks), the consultants' dates. Each of the three new groups is rolling and always live; the admin presses *Go live* in the week before launch. Notice period 7 days; open shifts on; CST off; RosterOn off; fairness guarded (the presets' choice).

## Each group's shape

Read from the managers' templates (the reading is in `~/Desktop/Myrosta site 2/group-templates-analysis-26sep2026.md`, personal data, outside the repo).

| | Admin (about 9) | Nurses (about 24) | Scribes (about 9) |
|---|---|---|---|
| Zones | Desk 1, Desk 2 | RN, EEN, AIN | Scribe 1, Scribe 2 |
| Morning-half types | Manager 09:30–15:00 · Manager long 09:30–18:00 · Day desk 09:45–17:45 · Weekend AM 09:45–14:15 | RN AM 10:00–16:30 | AM 10:00–16:00 |
| Evening-half types | Evening 17:30–22:15 · Weekend mid 13:45–18:15 · Weekend evening 17:45–22:15 | RN PM 16:00–22:30 · EEN PM 14:00–22:30 · AIN PM 14:00–22:00 · AIN late 15:30–22:00 · AIN long 12:00–22:00 *(added 28 Sep 2026: the sheet writes it ten times in November and December)* | PM 16:00–22:00 · Long PM 14:00–22:00 |
| Whole-day types (count two) | — | RN day 10:00–22:30 · EEN day 12:00–22:30 | Full 12:00–22:00 |
| Cover, each half | 1–2 | 1–3 | 0–2 |
| Tags | — | RN, EEN, AIN (shown on the roster); Regular, Casual | — |
| Rules | — | the RN zone needs RN; at least 1 RN every AM and PM | — |
| Staff may set their own hours | on (one-offs are common) | off | off |
| Also | PT 60/54/39/18 → hours per fortnight; "shifts to fill" → open shifts | the NUM's own on-call column stays out of the first cycle | the booking sheet shows the Consultants line (S2); self-booking replaces the AVAILABLE row |

A shift written with times that match no type lands on the type of its half with its own hours (S4's import rule), so nothing is lost; the build's report lists every such day so the manager can decide whether it deserves a type.

## The build: three files and a checklist per group

One script, `build-swift-groups.py`, in `~/Desktop/Myrosta site 2/` beside `build-swift.py` (personal data; never in the repo), with one configuration block per group naming the workbook, the sheets, the section-to-zone and line-to-zone mapping, the types above and the contacts block. It writes, per group:

- **The staff list** (`<group>-staff.xlsx`, Myrosta's staff-list columns): Surname, Given name, Email, Mobile, Title, Tags, Hours per fortnight, Shifts per fortnight. Names as "Surname, Given" so every later import matches. Contact details come from a contacts block the owner supplies per group (the templates carry names only); a person without email or mobile is listed in the report as unable to sign in until one is added.
- **The roster** (`<group>-roster-2026-10-26.xlsx`, the roster-import layout): one row per person, one column per day of the twelve weeks, each cell `HHMM-HHMM Zone` exactly as the manager wrote the day, the zone from the section (RN, EEN, AIN) or the line (Desk 1, Desk 2, Scribe 1, Scribe 2) with two people on one half taking Desk 1 and Desk 2 in row order. Days the manager has not written stay empty; the date header covers the whole cycle so the import creates a twelve-week cycle.
- **The unavailability grid** (`<group>-unavailability.xlsx`, the leave-import layout, one sheet named for the cycle's year): marks kept exactly as written, to be imported with the tick on.
- **The settings checklist** (`<group>-checklist.md`): the types, zones, cover, tags, rules, switches and cycle dates from the table, in the order to apply them, with the import steps between.

The order per group, which the checklist states: settings first (types, zones, cover, tags, rules, switches), so the roster import recognises each shift's type by its times; then the staff list; then the roster, which creates the 26 October cycle from the current settings (the group's empty first cycle is deleted afterwards); then the unavailability grid with the tick; then invitations from the Staff tab; then *Go live* in launch week. The script prints a report per group: people found, shifts placed, days whose times matched no type (landed as own hours), names without contact details, and marks in the unavailability grid.

*(Amended 28 Sep 2026 after the final review: the converter is the repo tool `tools/group-files.py`, run with one config per group kept in the site-2 folder (`~/Desktop/Myrosta site 2/groups/`; the configs, the workbooks and every file the tool writes carry personal data and stay outside the repo). The staff file's columns are Surname, Given name, Email, Mobile, Tags, Hours per fortnight, Mode — no Title and no Shifts per fortnight. The checklist's step 1 sets the cycle's dates on the group's existing cycle first, so the roster file, which starts on the same date, updates that cycle in place and no cycle is deleted. Invitations go out from Access control → *Invite your …*, not the Staff tab.)*

## The one app change: the unavailability tick

The Setup tab's Import card gains a tick beside the leave planner file input: **Treat any filled cell as unavailable** (`#impLeaveAny`), off by default and never remembered. `parseLeaveAOA(aoa, o)` takes an options object: with `o.anyFilled` every non-empty cell that is not a recognised leave code becomes `UA` for that day, a half-day mark such as "AM" or "PM" included (a whole day unavailable — the app has no half-day leave); a recognised leave code still imports as itself. Runs of the same code merge into blocks as today. With the tick off, `parseLeaveAOA` is byte-for-byte what it was, and a test pins Werribee's planner import unchanged. The confirm before the import says which rule is in force, and the audit line `import.leave` gains "any filled cell = UA" when it was.

## Guides and the demo

One **Myrosta for SWIFT staff** guide for nurses, scribes and clerks: sign in, My shifts, booking and claiming an open shift, swapping and coming off, your own hours, Who's on, with a short box per group saying what its people see. One **managers' guide** for the three managers, built from the consultants' admin guide with pages on placing shifts and Pre-fill, tags and rules, own hours, the unavailability import and the settings checklist. Both are written as HTML in `~/Desktop/Myrosta site 2/go-live/source/guides/` and printed to PDF as the consultants' pair were; the consultants' guides stay as they are. The demo runs on the three real groups in draft, so the managers see their own people and shifts.

## The four weeks

- **Week of 28 September:** this spec and its plan; the import tick built, reviewed and pushed; the build script written and tried against the September and October sheets.
- **Week of 5 October:** the owner supplies each group's contacts block; the managers write their 26 October fortnights in Excel as usual; the files and checklists are built.
- **Week of 12 October:** the owner applies each checklist and imports the files; every roster is checked against the manager's sheet; the demo; invitations go out.
- **Week of 19 October:** managers finish October in the app; staff sign in and check their shifts; *Go live* in each group before Monday 26 October.

## Testing

- The tick: any filled cell becomes UA; a recognised code stays itself; a half-day mark is a whole day; runs merge; the tick off gives today's bytes on the existing planner fixture; the audit line.
- The build script: a fixture workbook in the script's own test (synthetic names) round-trips through the app's own parsers under JavaScriptCore, as `build-swift.py` did: every written day lands as the right type and zone, one-offs as own hours, marks as UA, and the report lists what it should.
- Before launch, per group: the imported roster diffed cell by cell against the manager's sheet with the app's export.

## Out of scope

The NUM's on-call in the first cycle; the console (S5); nights, terms and the junior-doctor engine; payroll interfaces for the three groups; any change to the consultants' group; half-day leave.
