# Myrosta — second pilot site: multi-group plan · 10 Aug 2026

**The ask:** a second site wants Myrosta for five groups — **consultants, junior doctors, scribes, nurses, admin/clerical**.

**The answer in one line:** no separate deployment — **one multi-tenant deployment (branch `multiorg`), one org per staff group, grouped under a hospital umbrella.** Two groups work today; the other three all hinge on ONE engine upgrade (night shifts, shift-templates Phase 2), which was already scheduled "before org #2".

---

## 1. Why one org per group (not one shared roster)

Consultants, JMOs, scribes, nurses and admin never share shifts, quotas or fairness — a nurse never books a consultant slot. In roster terms they are **five independent rosters under one roof**. Myrosta's unit of isolation is exactly that: **one org = one staff list + zones + staffing + allocation method + equity**. So:

- **Five orgs, one hospital** — each group keeps clean fairness stats and its own allocation method (per-cycle selector already built).
- **Smaller build** than partitioning a single roster five ways.
- **Separate deployments — rejected.** Five copies to maintain and update by hand = the Option A model we already decided against. Multi-tenant Option B (auth/RLS/blob exist; branch `multiorg` has Phase 2 built) is the vehicle.

Add a light **hospital umbrella**: orgs carry `hospital`, a hospital super-admin sees all their orgs, and the picker shows "SiteX — Nurses / JMOs / …". Cheap; makes five orgs feel like one product.

## 2. Group-by-group fit

| Group | Fit today | Gap | Stage |
|---|---|---|---|
| **Consultants** | ✅ Full — identical to the WMH pilot | none | 1 |
| **Admin / clerical** | ✅ Fixed patterns, swaps, leave, simple staffing | rename "Consultant" labels → per-org role noun | 1 |
| **Nurses** | ◐ Structure fits; real 24/7 nursing needs **Night as a first-class shift** + large daily headcounts (rosters of 60–100+) | shift-templates Phase 2 (nights); scale test | 2 |
| **Junior doctors** | ◐ Zones + AM/PM fit; nights, grade mix, term dates per MYROSTA-JMO-CONCEPT.md | Phase 2 nights + `staff.grade` + terms (start on built A/B methods) | 2 |
| **Scribes** | ◐ Simple — but scribes are **paired to a consultant's shift** | small "shadow roster": book a slot that follows another org's shift | 3 |

## 2b. REVISED 18 Aug 2026 — the site has NO night shifts → all five groups fit the existing engine

The site's actual pattern (confirmed with them): **10:00–23:00, AM/PM only, no nights**, every group. Consultants 1–4 per shift; nurses the same shape with roles **Triage** + **Staff nurse**; junior doctors and scribes likewise; admin 1–2. That is exactly the shape the current engine handles — so **shift-templates Phase 2 (nights) is NOT on this site's critical path**. All five groups can go live in Stage 1.

**Proven on staging, 18 Aug 2026** — five orgs seeded under one hospital ("Demo Hospital ED"), each with its own branding, role noun, roles-as-zones, cover and 10:00–23:00 shift times:

| Group | Roles (zones) | Cover / shift | Staff | Role noun |
|---|---|---|---|---|
| ED Consultants | Consultant | 1–4 | 6 | consultant |
| ED Nursing | Triage + Staff nurse | 2–4 | 8 | nurse |
| ED Junior Doctors | Junior doctor | 1–3 | 5 | doctor |
| ED Scribes | Scribe | 1–2 | 3 | scribe |
| ED Administration | Clerical | 1–2 | 2 | staff member |

Booking engine verified against the nurse roster: nurse 1 takes **Triage** → nurse 2 is refused Triage ("zone already taken") but **Staff nurse** remains bookable. **Roles behave exactly as zones** — a slot is a labelled slot, whether it names a room or a job. Capacity check reads the seeded roster correctly (28 shifts/wk needed, fill % and EFT-required computed).

Demo script for the site's director: `~/Desktop/Myrosta demo script - second site.txt` (staging URL + the two demo logins + what to say).

**Still true:** a FUTURE site whose junior doctors work nights needs shift-templates Phase 2 (arbitrary shift types). Data seeded on AM/PM today keeps working unchanged after that release — AM/PM stay valid ids. Recommended order: merge multi-org → onboard this site on AM/PM → build Phase 2 nights before any 24/7 site.

## 2c. Roster mode — BUILT 3 Sep 2026 (their requirement)

The site asked for both ways of running a roster, admin-selectable **per staff group**:

| Mode | How it runs | Suits |
|---|---|---|
| **Rounds** (default) | Draft → Open for self-roster (optionally on a schedule with open/close dates) → Closed → Published | Groups that should book together and fairly against the same slots — their consultants, nurses, junior doctors |
| **Rolling** (new) | Draft → **Live, and stays live** — staff add and drop shifts whenever they need to, all cycle. An optional window limits *when* they may book without taking the roster offline | Small teams filling shifts as they come up — likely their scribes and admin/clerical |

Set per cycle in **Admin settings → Roster mode**, so a group can change its mind next cycle and different groups can differ. Every guard is identical in both modes (leave, double-booking, zone cover, safe hours, quota), and staff cannot alter a day that has passed. Cohort waves and snake-draft are round-only and are disabled in rolling mode.

Ships with the multi-org cutover — it is a per-cycle setting in the roster data, so it needs **no database change** and adds no migration risk.

## 3. Staged plan

**Stage 1 — finish multi-org, land what works (weeks 1–3)**
1. Isolation test on **staging** (hard gate — Org A provably denied Org B). Never on the live pilot project.
2. Phase 3: per-org branding + feature flags (already spec'd in MYROSTA-MULTIORG-BUILD.md).
3. Hospital umbrella (`hospital` on org rows, super-admin visibility, grouped picker).
4. Per-org **role noun** (consultant / nurse / doctor / scribe) replacing hardcoded "Consultant" in labels + exports.
5. Onboard the site's **consultants first, admin second** — value inside a month; the site learns the app while Stage 2 builds.

**Stage 2 — shift templates Phase 2: nights & arbitrary shift types (weeks 3–8)**
- The single engine change that unlocks nurses AND JMOs. Do it **while there is still one production org** (per MYROSTA-SHIFT-TEMPLATES-PLAN.md — no tenant migrations later), on a branch, with a dedicated per-type test suite + full smoke.
- Then nurses go live; then JMOs on the existing A/B methods (the full JMO module — grade mix, terms, offer pool — stays the MWU pitch, not a Stage-2 dependency).

**Stage 3 — scribes' shadow roster (opportunistic)**
- Once the site's consultants are live: "scribe follows consultant slot" as a small feature on top.

## 4. Questions for the site (before dates are committed)

1. **Which group first?** (Recommend consultants — instant win on proven ground.)
2. **Nurse roster reality:** headcount, night structure, and whether their existing (often tool-heavy) nurse rostering actually wants replacing — biggest scope, highest scope-creep risk.
3. **IT / access posture:** SSO via Entra is dormant-ready (SUPABASE-SSO.md); start the hospital-IT conversation early. Data map / controls answer pack: see the IT brief notes (Sydney hosting, RLS allow-list, no clinical data, audit log).
4. Any RosterOn/payroll differences (export mapping was built against WMH's sheet).

## 5. Honest sizing

- Stage 1 is a contained task on top of the existing branch (days).
- Stage 2 (nights) is the **largest engine change since the fairness hardening** — weeks, not days, and it needs test coverage before touching a live nurse roster.
- Message to the site: **"consultants first, nights-based rosters next"** — not "everything on day one".

## 6. Prerequisites outside the code

- **Trademark filing** (TM Headstart, classes 9 + 42) — do it before Myrosta is visible outside WMH.
- Staging Supabase project for the isolation test.
- Pilot conversion at WMH (end of current cycle) so main can take the multi-org merge.

*Companion docs: MYROSTA-MULTIORG-BUILD.md (foundation + isolation test), MYROSTA-SHIFT-TEMPLATES-PLAN.md (Phase 2), MYROSTA-JMO-CONCEPT.md (junior-doctor module), SUPABASE-SSO.md.*
