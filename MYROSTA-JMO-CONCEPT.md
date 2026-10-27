# Myrosta — Junior Doctor (JMO) rostering concept · 7 Jul 2026

**Headline strategy: constrained self‑rostering for junior doctors — "choice within duty."**
No Australian hospital offers juniors self‑rostering (rosters come top‑down from the MWU in Excel); wellbeing bodies (e.g. RCEM sustainable‑working guidance) recommend it but no tooling supports it. Myrosta's consultant engine already contains most of the mechanics. The promise: *you can't choose whether you do your share of nights and weekends — you choose which ones.* Autonomy over timing, not burden.

## Scope
- Grades: **Intern, HMO, Junior Registrar (training), Senior Registrar, Non-trainee Registrar, CMO** (+ Consultant in the existing mode). Grade is **term-scoped, not person-fixed** — this year's HMO is next year's registrar; the person (login, calendar feed, equity history) persists across grade changes.
- 24/7 cover in three periods: **AM / PM / ND** — all shift times **fully admin-set per department/cycle** (DECIDED 7 Jul: hospitals differ, no hardcoded patterns — the Phase-1 per-cycle shiftTimes machinery already establishes this; ND joins it as a first-class type in Phase 2).
- Cover is a **matrix: grade × period** (from the department's Future State table):
  Registrars 7/7/5 · HMOs 5/5/3 · Interns 1/0/0 (+ consultants 5/5 in the existing roster).

## Capacity & demand analysis (the establishment calculator)
Weekly demand = matrix × 7: Registrars 133 shifts/wk · HMOs 91 · Interns 7.
Full‑timer ≈ 5 shifts/wk → floor FTE: Reg ≈ 26.6, HMO ≈ 18.2, Intern ≈ 1.4.
**Buffer:** AL (~5wk) + sick (~2wk) + study/exam (~1–2wk) + teaching ≈ 17–22% off the floor →
**establishment ≈ Reg 33 · HMO 22 · Intern 2 FTE.**
Product feature: given (cover matrix, FTE pool, leave assumptions) → surplus/deficit per grade/period/day, buffer‑health dial ("rostered at 96% capacity — one sick call from a gap"), and the director's business‑case export. Pure arithmetic — deterministic, explainable.

## Buffer by design (sickness resilience)
- **Relief/float lines**: generator rosters 1–2 doctors/day as RELIEF (a zone) — cover sickness first, floor otherwise.
- **Escalation ladder** on a sick call: today's relief → juniors under fortnight hours → **CMO offer pool (broadcast + claim)** → locum → declared gap vs safe minimum. The open-shift offer/claim marketplace is therefore CORE to the JMO module, not a later add-on.

## Rule engine (EBA pack + humane layer)
Hard floors from the enterprise agreement (encode per agreement, HR sign‑off; roster-legality only — never pay interpretation): min break between shifts, max shift length, max consecutive days, night limits, weekend frequency. The fatigue chassis (built 7 Jul) extends to these. Humane layer: forward rotation (AM→PM→ND), ND blocks of 3–4 with 48h recovery, no isolated single days off, weekend fairness via the Equity tab.

## The workflow: an admin-composed pipeline (updated 7 Jul 2026 — admin control is the product)
Four modes, deployed by the ADMIN per grade, per cycle, per planning stage — control never leaves them:
1. **Fully allocated** — engine generates rotating pattern lines (deterministic, phase-shifted, EBA-validated).
2. **Auto-draft + adjust** — engine drafts, juniors trade within rules.
3. **Guarded self-select** — per-category quotas (owes x ND + y weekends), waves/snake ordering, canBook enforces grade-mix + EBA at pick time, deadline auto-fill completes unpicked slots.
4. **Offer-based (the CMO mode)** — admin broadcasts open shifts to an eligible pool; pool members claim; admin confirms (or first-eligible-claimer, admin's choice). Reuses notifications + requests + canBook plumbing. DECIDED 7 Jul: **CMOs fill the shifts that would otherwise go to agency locums** — every CMO-claimed shift is an avoided agency fee, so the offer pool carries a direct, measurable ROI ("locum shifts avoided × agency premium" as a headline metric — the JMO module can pay for itself here).

> **The open-shift marketplace is CROSS-WORKFORCE, not JMO-only (confirmed 7 Jul 2026).** It also serves CONSULTANT rosters — and is *simpler* there (no grade-mix/EBA constraints; consultants interchangeable for cover). Two shapes: (a) **admin-posted open shift** for a post-publication gap (sickness, unfilled slot); (b) **staff give-away** — release a shift you can't do to the whole group instead of a 1:1 like-for-like swap (fixes the council-flagged swap limitation). It's the app replacement for the "anyone free Saturday?" WhatsApp, with audit trail + fairness lens + instant calendar update. Build = assembly of existing parts (dayGap, broadcast, cloudCommit+canBook [race-safe post-hardening], requests, locum flag). Design choices (admin-configurable): first-come-disappears vs admin-approve; relax the hard quota cap for extra-cover gap-fills (confirm "over quota, still take it?"); auto-exclude already-working / on-leave / fatigue-breaching; whole-group vs targeted broadcast. **Timing: strong FAST-FOLLOW** — targets the sickness-gap pain the consultant pilot will surface; the council parked it only because it multiplies concurrent writes, and the 5 Jul sync hardening removed exactly that blocker.
A roster is planned as a STAGED PIPELINE the admin composes, e.g.: ① generate lines (all grades) → ② adjust/swap window (regs+HMOs) → ③ guarded self-select on remaining slots → ④ CMO offer round for leftover gaps → ⑤ admin review → publish. Admin can skip, reorder, or stop at ①. Ship as NAMED PRESETS ("Fully managed" / "Managed + swaps" / "Choice within duty" / "Max autonomy") with the stage editor behind Advanced — presets guard against the configuration wall.

## Engine deltas required (feeds shift‑templates Phase 2 design)
1. ND / arbitrary shift types first‑class (Phase 2 core).
2. Cover matrix keyed **grade × period** (staffing today is headcount only).
3. `staff.grade` + grade‑gated zones (skill mix: e.g. never ND without a senior reg).
4. **Per‑category quotas** (N of the fortnight quota must be ND/weekend).
5. Term/rotation membership dates with pro‑rated quotas (already roadmapped).
6. Relief zone concept + escalation view.
7. EBA rule packs as named, versioned configs.

## Terms & rotation model (added 7 Jul 2026 — the churn is structural, not an event)
Term lengths differ **by grade**: Interns & HMOs rotate every **3–4 months**, training registrars **6–12 months**, non-trainee registrars **6–24 months**, CMOs **ad hoc/ongoing**. Boundaries are staggered (Feb/May/Aug/Nov HMO terms; Feb/Aug registrar terms) and never align with 8-week roster cycles → almost every cycle straddles someone's changeover. Consequences:
1. **Line vs occupant**: the template defines stable roster LINES (repeating AM/PM/ND patterns, EBA-validated once); people occupy lines for date ranges. Changeover = occupant handover on a live line, not a re-roster.
2. **`staff.terms = [{from,to,grade}]`** — membership + grade + quota pro-rating all derive from term dates (supersedes the simpler "part-cycle from/to" roadmap item).
3. **Changeover-aware generation**: orientation/supernumerary days for incoming cohort; "no ND in first week of term"; "every ND in a changeover fortnight includes ≥1 carry-over doctor" (carry-over registrars/CMOs provide continuity through changeover).
4. **Fairness per term**: equity periods must include "this person's term" (an intern's fair share lives inside their 13 weeks); calendar-year comparisons are meaningless across 3–24-month tenures.
5. **Mode per grade**: CMOs → **offer-based ad hoc gap-fillers** (not a rostered line — they fill junior gaps when requested, the elastic capacity layer); interns → allocated; HMOs/registrars → adjust or guarded self-select. One department, mixed modes — per-grade, per-stage config.
6. **Vacancy planning per term**: unfilled lines for a term (recruitment gaps) are a distinct input to the establishment calculator, separate from the leave/sickness buffer.

## Sequencing
Pilot (consultants) → conversion → multi‑org + templates Phase 2 **designed JMO‑ready** → JMO pilot with our own department's junior roster (MWU as first customer; recruitment angle: "our ED lets you choose your shifts"). Buyer = Medical Workforce Unit — bigger budget than any consultant group.

## Decisions (locked 7 Jul 2026)
- **Shift times incl. ND: fully admin-set** per department/cycle — hospitals differ; no hardcoded patterns.
- **EBA pack #1: Victoria** (Doctors-in-Training agreement) — clause set to be encoded with HR/MWU sign-off.
- **CMOs fill locum-equivalent shifts** via the offer pool → ROI metric = avoided agency locum spend.
- **Interns rotate every 3–4 months**; start fully allocated.

## Open questions
1. Is our own MWU the pilot customer (junior ED roster currently in Excel)?
2. Actual WMH term calendars (HMO term dates vs registrar rotation dates) — needed to size the changeover-overlap rules.
3. Current Vic DiT EBA clause values (min break, max consecutive days, night limits, weekend frequency) — obtain the document itself.
