# Shift templates — Phase 2 plan (night shifts & arbitrary shift types)

**Phase 1 (DONE, 7 Jul 2026):** shift *times* are per‑cycle settings (`cycle.settings.shiftTimes` for AM/PM/ONC/CST) via `shiftTimesOf(cyc)`/`effShiftTimes()`. Labels, exports, ICS (app + edge function), hours and fatigue all read them. Defaults unchanged → zero behaviour change until edited.

**Phase 2 (post‑pilot, before org #2):** arbitrary shift *types* — e.g. a rostered **Night** shift, short twilights, 12‑hour weekend shifts.

## Target model
`cycle.settings.shiftTypes = [{id:"AM",label:"AM",start,end,counts:true},{id:"PM",...},{id:"N",label:"Night",start:"22:00",end:"08:00",counts:true}, ...]`
Assign entries become `{kind:"clinical", period:<typeId>, zone}` — the existing `period` field already carries the type id, so **data migrates untouched** (AM/PM remain valid ids).

## Touch points (the honest list)
1. `["AM","PM"]` literals: self‑roster button loops, daily board sections, auto‑draft fill loops, grids → iterate `effShiftTypes()` instead.
2. `staffing {amMin,amMax,pmMin,pmMax}` → keyed map `{[typeId]:{min,max}}` + migration shim reading the old keys.
3. `zonesFor(p)` / zone flags `z.am,z.pm` → `z.periods:[typeIds]` with back‑compat read.
4. `clinicalCounts()/dayGap()/ragFor()/periodUnlocked()` → per‑type maps; unlock order becomes an ordered list of type ids.
5. Renders: roster grid chips (per‑type colour class), daily board (a section per type), self‑roster buttons, month/agenda chips.
6. Exports: payroll/RosterOn already read times via `effShiftTimes()`; extend to type map. ICS same. Fixed patterns: slot `{period,zone}` gains type ids naturally.
7. Fatigue: `_shiftSpan` already overnight‑safe — needs only the type lookup.
8. Equity: "tough" categories per type id (e.g. Night always tough) — one mapping row.

## Sequencing rules
- Do it **while there is one org** (no tenant migrations), on a branch, with the full smoke harness + a dedicated per‑type test suite.
- Ship with **presets**: "ED consultants (AM/PM+OC)" default keeps today's behaviour; "ED with nights" adds N. 
- Estimate: 1–2 weeks incl. testing; budget a developer review of the staffing/unlock refactor.


## JMO-readiness constraints (added 7 Jul 2026 — see MYROSTA-JMO-CONCEPT.md)
Phase 2 must be designed so the junior-doctor module is *configuration*, not a rebuild:
- **ND (night) as a first-class type** with overnight span and its own cover numbers.
- Cover matrix keyed **grade × type** (`{typeId:{grade:{min,max}}}`), with a headcount-only fallback for consultant-mode departments.
- `staff.grade` (Intern/HMO/JnrReg/SnrReg/Consultant) + grade-gated zones (skill mix, e.g. senior cover on nights).
- **Per-category quotas** (a fortnight quota of N, of which ≥x ND and ≥y weekend) — powers "choice within duty" self-rostering for juniors.
- Relief/float as a zone concept; EBA rule packs as named versioned configs on the fatigue engine.
