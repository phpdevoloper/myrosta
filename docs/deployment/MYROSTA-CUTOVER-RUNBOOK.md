# Myrosta — multi-org production cutover · runbook · 19 Aug 2026

**What this is:** the single checklist for taking multi-organisation live on the production project
(`skpdqqhwrqgxsxawniho`, myrosta.com.au). One change window, every step in order, with the rollback
open in a second tab. Nothing here is run before its gate is ticked.

**Who:** "You" = Dr Ranjith (dashboard clicks, GitHub Desktop push). "Claude" = code, SQL text,
verification. The window is driven together.

---

## Phase 0 — readiness gates (between now and the window)

| # | Gate | Owner | Status |
|---|---|---|---|
| 0.1 | Pilot cycle ended (27 Sep) and conversion agreed with the group | You | ☑ satisfied differently, 7 Sep: the group has already converted — the 28 Sep–22 Nov roster was imported and **published in the app as the record** (Option B). The migration moves no roster data, and the rehearsal ran on a clone holding a live published cycle, so cutting over mid-cycle is safe |
| 0.2 | Trademark filed (TM Headstart, classes 9 + 42) | You | ☐ |
| 0.3 | **Migration rehearsal on a restored clone**: restore a production backup into a scratch Supabase project, run `supabase/prod-multiorg.sql` **twice** (idempotency), re-run `supabase/isolation-test.html` against it, then point the *release build* (multiorg) at the clone and exercise: sign-in, a booking, Sync allow-list, Make admin, a leave approval | Both | ☑ **7 Sep 2026** — see the rehearsal record below |
| 0.4 | Engine tests green on the release build: `python3 tests/run.py` (multiorg branch) | Claude | ☐ |
| 0.5 | Staging demo still green (picker, branding, capacity) — it is the same code that ships | Claude | ☐ |
| 0.6 | `supabase/rollback-multiorg.sql` verified runnable on the rehearsal clone (run it, then re-run the migration) | Both | ☑ **7 Sep 2026** — rollback → app fell back to single-org by itself → migration re-applied → app back in multi-org mode |
| 0.7 | Site-2 answers in hand (which group first, IT posture, payroll) — NOT a blocker for cutover, but shapes the week after | You | ☐ |

**Already banked (do not redo):** staging isolation test 12/12 both directions (17 Aug); v2 probes added
(unauthenticated reads + cross-org function probe); live app test on staging (picker/switch/branding);
**Realtime after the policy swap verified on staging 19 Aug** — own-org delivery works, cross-org delivery
blocked; five-group demo running; edge functions org-scoped and fail-closed; device cache org-scoped.

## Rehearsal record — 7 Sep 2026 (gate 0.3 + 0.6)

Clone: production backup of 06 Sep 15:35 UTC restored to project `myrosta-rehearsal` (`qqipyonsbnbxwnlchqjh`, same org/region) via
Database → Backups → *Restore to new project*. Kit used: `~/Desktop/Myrosta rehearsal/` (pre-check, test-user fixture, the two
scripts verbatim, org-B fixture, pre-filled isolation test, the release build pointed at the clone with a password sign-in helper).

| Step | Result |
|---|---|
| Restore | Schema, data, roles and **cron schedules** came across. The two `net.http_post` jobs point at the *production* function URLs — unscheduled on the clone first (`select cron.unschedule(jobname) from cron.job;` → 2 rows). **At the real cutover this is step 1.3 (pause crons) — nothing extra.** |
| Release build on the OLD schema (=1.8) | Straight in, no picker, Cloud ●, booking with reason + removal OK. `my_orgs` absent → `PGRST202` → legacy fallback engaged, as designed |
| `prod-multiorg.sql` ×2 (=1.9) | Both runs: `ed-default · 33 members`, no errors. External probes after: `my_orgs()` 200 `[]`, old no-arg helpers 404, org-scoped helpers answer `false` unauthenticated, `orgs` exists (anon denied), all three tables 401 to anon |
| Isolation test v3 (=1.11) | Signed in as the test admin (member of `ed-default` only) against a fixture org B: **16 PASS, 1 SKIP** (push-send — no functions on the clone). Own-org read showed 287,840 bytes of roster data intact after the no-op write probe |
| Release build on the NEW schema (=1.10) | Header shows "· Consultants" (registry label), Cloud ●, booking + removal, **Sync allow-list** (33, org-scoped), Make admin / Remove admin, leave add/remove — all clean |
| Rollback (abort path) | Old helpers restored, `my_orgs` gone; app re-opened → single-org fallback without a deploy, roster intact, booking OK |
| Migration re-applied | Same verification results; app back in multi-org mode |

**Found by the rehearsal and fixed before it could matter:** the isolation test's own-org write probe *replaced the roster blob with a
marker* and its delete probe *really tried to delete* — harmless on staging's dummy orgs, fatal at step 1.11 on production.
Both are now no-op checks (v3): the write probe writes the row's own `updated` back to itself; the delete probe uses an
impossible filter so the revoked privilege errors before any row can match.

Clean-up: delete `myrosta-rehearsal` after the production cutover (Project Settings → General).

## Phase 1 — the window (~45 min, after the last cycle closes, before the next round opens)

Do these **in order**. The order is load-bearing: the app is inert on the old schema, the functions
carry pre-migration fallbacks, but the OLD app must never run against the NEW schema.

| # | Step | How |
|---|---|---|
| 1.1 | Announce a 1-hour maintenance pause to the group (optional but kind) | You |
| 1.2 | Fresh database backup + note the time | Dashboard → Database → Backups |
| 1.3 | **Pause the cron schedules** for notify-rounds / notify-shifts | Dashboard → Edge Functions / Cron |
| 1.4 | **Merge `multiorg` → `main`**, delete `deploy/staging-multiorg.html` in the same commit, push | Claude prepares; you push |
| 1.5 | Netlify deploys; confirm myrosta.com.au serves the new build (view-source: `orgKey(` present) and staging page returns 404 | Claude |
| 1.6 | **Redeploy all four edge functions** from `supabase/functions/*` (paste → Deploy, one by one) | You (Claude dictates) |
| 1.7 | **Unset env vars**: `ORG` on notify-rounds and notify-shifts; `MYROSTA_ORG` on ics — otherwise new organisations are silently skipped | You |
| 1.7b | **Set `CRON_SECRET`** (any long random string) on notify-rounds + notify-shifts, and add the matching `x-cron-key` header to their two cron schedules — without it these endpoints are publicly invocable mass-SMS/email | You (Claude dictates) |
| 1.8 | Sign in to the live app once — confirm normal single-org behaviour (legacy fallback active) | Both |
| 1.9 | **Run `supabase/prod-multiorg.sql`** in the production SQL Editor (check project name top-left). Read its three verification outputs | You paste; both read |
| 1.10 | Reload the live app, sign in — straight in (one org), roster intact, make + undo one test booking | Both |
| 1.11 | **Run `supabase/isolation-test.html` (v3 — every probe non-destructive)** against production (prod URL + anon key; org A = `ed-default`, org B = any name that doesn't exist yet): sign in with your own account (email code works on production) → all probes green **including the cross-org push-send probe and the unauthenticated reads** | Both |
| 1.12 | **Realtime check**: two browsers, same org — book in one, see it appear in the other within seconds | Both |
| 1.13 | Un-pause the cron schedules; invoke notify-rounds manually once → expect one result per organisation (currently 1) | You |
| 1.14 | Calendar feed spot-check: open one existing subscribed ICS link — still returns the calendar | Both |
| 1.15 | Stand down the maintenance pause. Window closed | You |

**Abort rule:** any red at 1.9–1.12 → run `supabase/rollback-multiorg.sql` (second tab, already open),
reload the app (it falls back to single-org automatically once `my_orgs()` is gone), verify a booking,
un-pause crons. The migration moves no roster data, so rollback is policies-only and safe.

## CUTOVER RECORD — done 7 Sep 2026, ~22:00–23:15 AEST

| Step | Result |
|---|---|
| 1.2 | Snapshot of `org_state` (`ed-default`) exported to CSV on the admin's Mac — the last automatic backup (06 Sep) predated the day's import |
| 1.3 | Both notify schedules paused (`cron.alter_job … active := false`) |
| 1.4–1.5 | `main` fast-forwarded to `multiorg` (25 commits) with `deploy/staging-multiorg.html` removed; pushed; myrosta.com.au served the new build within a minute (`orgKey(` ×16, `rosterMode` ×5), staging page 404 |
| 1.6 | notify-rounds, notify-shifts, push-send redeployed via the dashboard editor. **`ics` had never been created on production** — the Live-calendar button had returned "Not found" since it shipped. Created tonight (Via Editor, JWT verification OFF); the function now reads the custom `SERVICE_ROLE_KEY` first (commit 3da27bd) |
| 1.7 | `ORG` secret deleted (`MYROSTA_ORG` never existed); `CRON_SECRET` set. External probes: notify-* → 401 without `x-cron-key`, ics → 404 on a bogus token (JWT off), push-send → 401 anonymous |
| 1.8 | Live app on the old schema: normal single-org behaviour |
| 1.9 | `prod-multiorg.sql` run once on production — `ed-default` members intact, no errors. Seven external probes identical to the rehearsal |
| 1.10 | Live app on the new schema: header "· Consultants", both cycles intact, booking + removal OK |
| 1.11 | Isolation test v3 on production as the admin: **17 PASS, 0 SKIP** (push-send cross-org → 403; unauthenticated reads denied; roster blob 371,981 bytes untouched) |
| 1.12 | Realtime: Mac booking appeared on the phone within seconds |
| 1.13 | Schedules re-created with the `x-cron-key` header: jobids 9 (`*/5 * * * *`) and 10 (`0 8 * * *`), both active |
| 1.14 | Live calendar feed returns `BEGIN:VCALENDAR` — first time ever live |
| 1.15 | Window closed. No rollback needed |
| 8 Sep am | **Post-cutover fix:** cron calls were 401 overnight — the `CRON_SECRET` value had been pasted into the Supabase secret with a trailing line-break (the `.txt` ends with one), so the function's `x-cron-key` comparison failed. Re-entered the value (double-click selects just the code) → 200s from 23:20 UTC. Nothing missed (no round open; shift reminder not yet due). Lesson: verify `net._http_response` shows 200 before closing the window. |

Left to do: delete `myrosta-rehearsal` after a quiet day; switch the 28 Sep cycle to **Rolling** (Option B for new starters); watch audit + reports 2–3 days (Phase 2); then seed site 2.

## Phase 2 — the week after

- Watch the audit trail + any staff reports for 2–3 days before touching anything else.
- Move `pushSubs` + `icsToken`s to their own tables (long-noted hardening; now worthwhile).
- Seed **site 2** in its own window: `hospitals`/orgs rows, their admin, consultants group first —
  per MYROSTA-GROUP-SETUP.md (Part A then the ten questions), with the Capacity check run before
  their first cycle releases.

## Phase 3 — build roadmap after cutover (the "best engine" sequence)

| Order | Build | Size | Why this order |
|---|---|---|---|
| 1 | **Department board v2** (MYROSTA-DEPARTMENT-BOARD.md) | 4–6 d | Turns five rosters into one department; the site-2 wow feature; needs the settled multi-org base |
| 2 | **Shift-templates Phase 2 — nights/arbitrary types**, behind a per-org flag | 1–2 wk | Unlocks every 24/7 site, nurses at scale, and JMO Layer 1; per-org flag means zero risk to live groups |
| 3 | **Preference-week + draw engine (Option C)** as a fifth selectable method (+ D points layer later) | ~1 wk | Completes the allocation-method set; already fully spec'd from the fairness vote |
| 4 | **Scribe shadow-roster** (follows a consultant's shift) | 2–3 d | Site-2 polish once their consultants are live |
| 5 | **Add-staff-group wizard** (Phase 4) | 3–4 d | When a third site appears; wraps the runbook's ten questions; super-admin design done carefully |
| 6 | **Credential gating** (only triage-trained take Triage) — generic module | 3–4 d | Requested-when-requested; useful to every group |

*Principle unchanged: one engine, per-group configuration, every capability an optional module — never a per-customer fork.*
