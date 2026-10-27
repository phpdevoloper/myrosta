# Myrosta — standing up a new staff group · runbook · 18 Aug 2026

**The rule: the hospital decides which staff groups it has.** There is no fixed catalogue. Werribee Mercy runs *Consultants* today. The second site runs *Consultants, Nurses, Junior doctors, Scribes, Admin*. Another hospital might run *Consultants + Registrars + Interns*, or add *Midwives*, *Pharmacists*, *Radiographers* — or a single group and nothing else. Names and role nouns are free text, not a menu.

**Every group starts from the same baseline** — same engine, every feature the consultant roster has. Setup is answering the questions below, not building anything. **Budget ~30 minutes per group**, plus staff import.

---

## Part A — create the group (hospital admin / Myrosta support)

**In the app (since 16 Sep 2026):** this needs `supabase/prod-department.sql` to have been run and the group to sit under a hospital (an org with a `hospital_id`) — otherwise the row does not appear. An admin of any group at the hospital taps their initials (top right; More on a phone) → **Add a staff group**, types the group's name, what its people are called, and optionally a second admin's email, and taps **Create**. The app switches into the new group, empty, and the *What kind of group is this?* card greets them. The group id is generated (`swift-nurses`), never typed. Nothing below is needed for that.

**Support path (SQL), for a hospital that has no group yet or an admin who cannot sign in:**

```sql
insert into orgs(org,label,hospital) values ('<group-id>','<Group name>','<Hospital>')
  on conflict (org) do update set label=excluded.label, hospital=excluded.hospital;
insert into org_state(org,data,updated) values ('<group-id>','{}'::jsonb, now()) on conflict do nothing;
insert into roster_members(org,email,role,name)
  values ('<group-id>','<their.admin@hospital>','admin','Admin')
  on conflict (org,email) do update set role='admin';
```

That admin signs in, sees the group in their picker, and works through Part B.

**Naming:** `<group-id>` is internal (e.g. `wmh-nurses`); `<Group name>` is what people see ("Nurses"); `<Hospital>` groups it in the picker ("Werribee Mercy ED").

**Don't** create a group for: a subset of the same roster (that's a zone or a fixed pattern), a single ward within one workforce, or a temporary project. A group = **its own roster, its own staff list, its own fairness**.

---

## Part B — the ten questions (Admin settings, in order)

| # | Question | Where | Notes |
|---|---|---|---|
| 1 | **What is this group called?** | Staff group & branding | Appears in the picker and header |
| 2 | **What are its people called?** | same card | Free text — consultant, nurse, midwife, registrar, scribe, radiographer… flows into every screen and export |
| 3 | **What are the roles/areas per shift?** | Zones | Rooms (Resus, Paeds) *or* jobs (Triage, Staff nurse) — a zone is just a labelled slot |
| 4 | **How many people per shift, min–max?** | Staff required per shift | The minimum is the floor; extras above it unlock in the order you choose |
| 5 | **What are the shift times?** | Shift times | Per cycle. e.g. AM 10:00–17:00, PM 16:00–23:00. (Nights need the shift-templates release.) |
| 6 | **How long is a cycle, and when does it start?** | Roster cycle | 8 weeks is typical; align to pay periods if you can |
| 7 | **How is quota counted?** | Quota & fairness | Per fortnight matches pay. Quotas auto-derive from EFT; edit any cell |
| 8 | **How does this group run its roster?** | Roster mode | **Rounds** — release, everyone books during the round, close, publish (the fair-share default) · **Rolling** — go live once and stay live; staff add and drop shifts as they need to. Per cycle, so it can change |
| 8a | **How do people get shifts?** | Self-roster method | Guarded free-for-all · Auto-draft + adjust · (Rounds only:) Cohort waves · Snake-draft |
| 9 | **Safe-hours rules?** | Fatigue rules | Off, warn, or block. Values follow *this group's* award/agreement, not the consultants' |
| 10 | **Which features stay on?** | Staff group & branding → Features | RosterOn export, Equity, Leave planner, marketplace. All on by default — switch off what doesn't apply |

**Then:** add or import staff (Staff tab or template), set the leave cap per day, mark public holidays, review the Equity "tough shift" list for this workforce, and **Sync allow-list** so people can sign in.

**Finally:** Auto-draft fixed shifts → Release for self-roster → tell the group.

---

## Part C — the decisions that differ per group (don't inherit blindly)

| Setting | Why it needs its own answer |
|---|---|
| **RosterOn / payroll export** | Mapping was built for consultant payroll. Different award or system → verify before use, or switch off |
| **Fatigue values** | Nursing, medical and junior-doctor agreements differ |
| **Leave cap per day** | "3 EFT away" suits 14 consultants, not 80 nurses |
| **Tough-shift list (Equity)** | Weekend/Fri PM/on-call is consultant-shaped; other groups may count lates |
| **Equity visible to all staff** | Fine in a small group; ask a large workforce first |
| **Self-roster method** | Some groups self-roster; others are admin-allocated (use Auto-draft + adjust) |
| **Roster mode** | A big consultant group usually wants **Rounds** (everyone books fairly at once). Small teams — scribes, admin/clerical — often prefer **Rolling** (the roster stays live; people fill shifts as they come up). Ask each group, don't assume the department's default |
| **Marketplace + phone alerts** | Off by default; switch on when the group is ready |

---

## Part D — what is *not* available yet (be honest with the site)

| Wanted | Status |
|---|---|
| **Night shifts / arbitrary shift types** | Shift-templates Phase 2 — designed, next engine release |
| **Grade mix** (never a night without a senior) | JMO module, designed |
| **Terms / rotations** (3–4 month intern terms) | JMO module, designed |
| **Credential gating** (only triage-trained take Triage) | Not designed yet — build generic, useful for every group |
| **Scribe sees the consultants on a shift** | Built 16 Sep 2026: Settings → Group → *Show on the booking sheet* names the groups whose people appear under each half of the day sheet and the Day board, read-only. A hard link to one consultant is not built |
| **"Who's on today" across groups** | Built 16 Sep 2026: Day board → **Whole department**, once each group switches on *Publish to the department board* (Settings → Group). Names, slots and times only |

**Principle:** every one of those ships as an **optional module any group can enable**, never as a hard-coded "nurse feature" or "JMO feature". One engine, one product, configuration per group — that is what keeps Myrosta consistent across organisations.

---

## Part E — quick sanity check before releasing a group's first cycle

- [ ] Cover numbers × zones × 7 days ≈ what the group can staff → run **Capacity check**
- [ ] Everyone who must sign in is in the allow-list (**Sync allow-list**)
- [ ] Fixed-pattern staff point at *this group's* zones
- [ ] Shift times right (they drive exports, calendar feeds, hours, fatigue)
- [ ] Public holidays marked for the cycle
- [ ] One test booking made and undone by a real staff member on their phone
