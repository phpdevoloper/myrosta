# Myrosta — Council Review (5 July 2026)

*Seven independent review lenses (code correctness, concurrency, security, UX, product, architecture, strategy) → 81 findings → every code claim adversarially verified against the live file (18 claims: 17 confirmed, 1 partial, 0 refuted) → synthesised by a council chair. Goal frame: “best flexible rostering solution for the healthcare sector.”*

## Executive summary

Myrosta is a genuinely well-designed product on a deliberately unusual architecture: the self-rostering fairness engine (four modes, per-fortnight quotas, progressive unlock) is a real differentiator no Australian incumbent ships, the mobile staff experience is close to excellent, and the whole-blob + CAS + 3-way-merge model is a defensible choice for one ~30-person org. However, the code review found one dominant defect family: the sync layer (mergeOnto at app.html:450-461, the realtime handler at 500-505, and the boot/error paths) silently loses or resurrects concurrent writes in at least six distinct ways — leave requests vanish, cleared shifts reappear, bookings bypass validation — and these are exactly the trust-destroying failures ("my leave request disappeared") that would kill pilot conversion, which is the single event everything else depends on. A second cluster (swap approval mutating the wrong cycle, the DST week-math bug that fires in the very next cycle starting 28 Sep 2026, the unguarded admin assign modal) undermines the app's "collision-proof" promise. Server-side, RLS lets any allow-listed staff member rewrite or delete the entire org blob — acceptable for a trust-based pilot, a hard blocker for selling to a second hospital. Strategically the position is strong: clinician-founder distribution through the FACEM network plus a fairness mechanism incumbents are culturally unable to copy quickly; the biggest product gap between here and "best flexible rostering for healthcare" is the hardcoded two-period day, which walls off every market beyond consultant groups. The right plan is: harden sync and put the code in git in the four weeks before the pilot opens, treat the pilot itself as the product until the director declares Myrosta authoritative, then execute multi-org + SSO + shift templates as one milestone — and keep the not-build list (clinical companion, payroll engines, nursing-first) firmly closed.

## Confirmed code issues (adversarially verified)

### [CRITICAL] mergeOnto keeps whole top-level arrays mine-wins — concurrent leave requests, approvals, messages, notifications, audit rows and staff edits are silently lost

*Evidence:* app.html:452 (whole-key overlay 'I changed k -> keep mine'), 454-459 (per-field reconcile for cycles only), 464-476 (cloudSave CAS+merge), 1604-1609/1610-1623 (leave request/approval via debounced save()), 2828-2835 (messages), 552/555/557 (notify/markNotifsRead/audit), 650-652 (600ms debounce). Two users mutating the same array within one sync window = the CAS loser's array clobbers the winner's new element; realtime (500-505) then propagates the loss to the victim's own screen. Consolidates two verified findings (requests/messages/leave/notifications + S.staff/S.leave whole-array clobber) sharing one root cause.

**Fix:** Extend the cycles-style 3-way treatment to requests, messages, leave, notifications, audit, feedback, and staff in mergeOnto: union by id (element present in theirs but absent from base and mine gets added), per-element field reconcile for status changes, tombstones for deletions. All elements already carry ids. ~40 lines in one function; do this in a single 'sync hardening' session with developer help BEFORE the pilot opens 3 Aug.

### [CRITICAL] Merged-in bookings skip all validation — over-max cover and booked-while-on-approved-leave states are reachable

*Evidence:* app.html:457 (assign union adds keys with no checks), 452 (mine-wins keeps my cycles), 672 (admin setShift via plain save(), not cloudCommit), 790-793 (canBook's leave/zone/cap guards run only at click time), 810-815 (cloudCommit re-validates only its own conflicts), 1610-1623 (approveRequest deletes shifts + adds leave via plain save()). Race: admin grid edit or leave approval CAS-conflicts with a staff booking → union admits both → capacity cap and leave guard never re-run; getShift (671) checks assign before leave so the clinician renders as rostered while on approved leave.

**Fix:** Add a post-merge invariant pass in cloudSave after any didMerge: drop assign entries that violate leaveOn, zoneTaken, or period max-cover in deterministic priority (leave wins, first-booker wins), logging each drop to audit. Alternatively route admin setShift/approveRequest through cloudCommit. Bundle into the same sync-hardening session.

### [CRITICAL] RLS lets every allow-listed staff member overwrite or DELETE the entire org state — admin role exists only in client JS

*Evidence:* SUPABASE.md:21 (grant select/insert/update/delete on org_state to authenticated), SUPABASE.md:36 ('members all' policy gated only on is_member()); app.html:608/1015-1016 (canEdit/tab gating are browser JS); the blob includes security settings, everyone's icsTokens, and the audit log (so evidence of tampering is erasable). roster_members writes ARE admin-gated, so this is data-level, not role-escalation.

**Fix:** Today: run `revoke delete on public.org_state from authenticated;` — one line, app never issues DELETE, zero risk. Properly: server-side write authority in the multi-org build (edge function or per-key RLS requiring is_admin_member() for settings/staff/cycle-structure writes, member-scoped writes for own bookings). Acceptable for the 20-consultant pilot; a procurement blocker for hospital #2, so it belongs in the multi-org milestone, not post-hoc.

### [HIGH] Shift deletions are resurrected by the merge — leave-approval clearing and admin unbookings silently reappear

*Evidence:* app.html:456 (per-field loop explicitly skips f==="assign"), 457 (union only ADDs; base-guard protects only the merging device's own deletions), 1618 (leave approval deletes booked shifts), 672 (setShift-to-off deletes key), 2738 (staff delete strips keys). Any other device that changed anything in cycles and then merges re-writes the deleted keys; a stale/offline device merging later (online retry at 2940 uses a stale base with no refetch) resurrects every interim deletion.

**Fix:** Reconcile assign per-key three-way against base: key in base but absent from theirs = their deletion, remove it from out unless I re-added it after base. ~10 lines inside the existing assign block. Same sync-hardening session.

### [HIGH] Realtime apply unconditionally replaces S, wiping local edits still inside the 600ms save debounce

*Evidence:* app.html:500-505 (only guard is string equality; no _cloudTimer/_cloudDirty check, no merge; overwrites localStorage too), 652 (600ms debounce). With multiple active users every keystroke-to-save window is a loss window; the victim's pending cloudSave then pushes the remote data back unchanged — permanent, silent. During booking windows every booking broadcasts a whole-blob event, so collisions are frequent.

**Fix:** In the realtime handler: if _cloudTimer is pending or _cloudDirty, run S=mergeOnto(p.new.data) (machinery already exists) instead of plain assignment, then schedule a save. ~5 lines. Same sync-hardening session.

### [HIGH] Swap approval mutates whichever cycle the admin is viewing and never re-validates — silent shift loss with false 'approved' notifications

*Evidence:* app.html:1727-1729 (executeSwap uses active().assign; requests store only dates, no cycle id — 1715), 1730-1733 (marks approved and notifies both parties unconditionally), 1743-1745 (reverseSwap same). Approving from the wrong cycle is a no-op that still notifies success (prepareNext at 630 auto-switches the admin to the new cycle, making this likely); no occupancy/staleness check means line 1729 overwrites any shift the peer already holds, and a since-removed offered shift (sA undefined) deletes the peer's shift with nothing given back.

**Fix:** In executeSwap/reverseSwap: resolve the cycle whose date range contains dateA/dateB instead of active(); before executing verify sA and sB still exist and both target slots are free; otherwise auto-decline with a toast explaining why. ~20 lines, self-contained — safe to fix before the pilot.

### [HIGH] DST spring-forward breaks fortnightly A/B week math — wrong week's Monday shifts seeded for every Monday after 4 Oct 2026

*Evidence:* app.html:872 (cycleWeekAB uses Math.floor over ms difference of local-midnight dates; Mondays after the clock change compute wk*7d−1h → wk−1, flipping A/B parity), 873-875/881-898 (fixedSlotFor/applyFixedPatterns seed the wrong shifts into shared state), 2471 (agendaHTML same math shifts 'Week n' headers to Tuesday). Fires in the cycle immediately after the pilot (starts 28 Sep 2026, spans the transition).

**Fix:** wk = Math.round((parseISO(isoD)-ds[0])/864e5)/7|0 (round the day difference before dividing by 7) in both cycleWeekAB and agendaHTML. Two-line fix, trivially testable; must land before the 28 Sep cycle is prepared.

### [MEDIUM] Hydration writes cycle-specific fields onto S.staff after _remoteBase is snapshotted raw — false 'I changed staff' diffs make the staff-array clobber near-systematic

*Evidence:* app.html:503 (_remoteBase=raw incoming, then normalize mutates S), 490 (same pre-normalize snapshot on conflict reload), 707-712 (hydrateCycleRoles writes quota/eft/_in from the viewer-local active cycle onto S.staff), 452 (whole-array mine-wins then clobbers the other admin's genuine staff edits — new member, corrected email, fresh icsToken).

**Fix:** Snapshot _remoteBase from a normalized copy, and strip hydrated fields (_in and role-mirrored quota/eft/hrsFortnight/periodTargets) from both the diff and the persisted payload. Amplifier of the top finding — same session.

### [MEDIUM] normalize() re-seeds every staff member into EVERY cycle with in:true on each load, polluting past-cycle payroll

*Evidence:* app.html:437 (unconditional seeding across all cycles incl. archived/published, on every load/remote-apply at 440/473/490/505/544), contradicting the no-entry-means-not-rostered semantics at 707-710 and undoing applyRosterImport's participants-only seeding (1937-1939). payrollRows (2165) and exportRosterOn (2266) then emit pro-rated leave rows (2175) for people never in that cycle.

**Fix:** Seed missing role entries with in:false (or seed only draft/open cycles), keeping the explicit add-to-cycle path (2739) as the way in. One-word change plus a data-repair pass over existing cycles.

### [MEDIUM] Admin cell-assign modal saves without re-checking zoneTaken — double-booked zones despite the 'collision-proof' FAQ promise

*Evidence:* app.html:2576-2592 (mSave checks periodUnlocked only), 2524-2527 (zone buttons disabled only at modal open; modal survives realtime applies since render never touches #modalRoot), 457 (merge union keeps both keys), 646 vs 673 (staffInZone shows one, clinicalCounts counts both — coverage looks met when a zone is doubled and another empty), 2370/2375 (Help/FAQ claim). Self-roster path is properly guarded (792, 810-815); this is the admin hole.

**Fix:** In mSave, if sh.kind==='clinical' and zoneTaken(modal.isoD,period,zone,modal.staffId), toast and abort — mirror canBook line 792. ~4 lines.

### [MEDIUM] Schedule banner and booking guard disagree — staff can book while the banner says self-roster hasn't opened / has closed

*Evidence:* app.html:596-598 (roundPhase is display-only, sole consumer is the banner at 1481-1486), 1529-1531 (gate is cyc.status only), 788-809 (canBook has no window/status check), 604-605 (fired flags block re-fire after reopen), 2945 (auto-close depends on some client's 30s tick, so post-deadline bookings succeed for up to ~one tick).

**Fix:** Make canBook return {ok:false, reason} when a window is enabled and roundPhase!=='open' (admins exempt), and have the admin 'Reopen' action offer to clear/extend cyc.window so deliberate reopens still work — matching the owner's preference for explicit admin choice.

### [MEDIUM] Stored HTML injection: zone and staff names from spreadsheet cells rendered unescaped in inputs, buttons and option lists

*Evidence:* app.html:1273/1276 (zone-edit input values), 1546 (zoneLabel in slot buttons), 1397 (grid name column), 1538/1574/2427 (option lists), 1921-1928 (names originate from arbitrary import cell text). escapeHTML exists (1475) and is used in ~50 other sinks; no CSP. RLS means any signed-in member can write hostile names into the shared blob that then render for every user.

**Fix:** Route these seven-odd sinks through the existing escapeHTML. Mechanical, ~30 minutes; add a CSP meta tag as belt-and-braces when convenient.

### [MEDIUM] cloudCommit failure path returns {ok:true} for a booking that never reached the cloud — later merges it in unvalidated; conflict reload also drops debounce-pending edits

*Evidence:* app.html:486-487 (catch/r.error → save local, return ok:true — user sees a confirmed booking), flush happens via cloudSave/mergeOnto (452/457) with canBook never re-run; 483 (clearTimeout kills a pending unrelated save), 490 (conflict reload replaces S wholesale, re-applying only the booking mutate).

**Fix:** Return a distinct 'saved on this device — will confirm when online' status and toast it; mark those assign keys pending-revalidation and re-run canBook on flush (drop + notify if invalid). Re-apply, don't discard, pending dirty deltas after the conflict reload.

### [MEDIUM] icsToken lazy-mint races between devices and is wiped by the staff-array clobber — subscribed calendar feeds silently go stale

*Evidence:* app.html:2809 (mint on Subscribe open), 2817 (reset re-mint), both via plain save(); 452 (whole-array mine-wins keeps exactly one token); supabase/functions/ics/index.js:86-87 (exact-match else bare 404 — the feed just stops updating, noticed weeks later). Feature not yet switched on, so fix before dashboard enable.

**Fix:** Mint only via an explicit user action routed through cloudCommit (or server-side in the edge function), and in the merge treat a non-empty icsToken as preferred-existing — never overwrite one non-empty token with a different one except on explicit reset. Do before enabling the calendar feature.

### [MEDIUM] Post-auth boot sets S=remote unconditionally — offline edits from a previous session are discarded despite the 'will sync' toast

*Evidence:* app.html:544 (S=remote + localStorage overwrite whenever a remote row exists), 442 (_remoteBase/_cloudDirty are in-memory only, so no merge base survives a reload), 446 (toast promises sync), 2940 (online retry can't fire after reload since the dirty flag resets). Real path on mobile: tab eviction while dirty.

**Fix:** Persist _remoteBase and a dirty flag to localStorage alongside S; on boot, if dirty, run mergeOnto(remote) instead of assignment. Depends on the merge fixes above landing first.

### [MEDIUM] wire() has unguarded getElementById calls — a throw leaves the notification bell and even the error card's 'Reset all data' recovery button dead

*Evidence:* app.html:2799-2819 (unguarded rFrom/rTo/icsBtn/vAgenda/vMonth on the 'my' tab, which early-returns controls at 2397 with zero staff), 2673/2709/2716/2771 (setup/staff tabs same), 1049-1051 (error card whose only control is hardReset), 1055 (wire error swallowed), 2919-2922 (bell and hardReset wired LAST, so they never wire after a throw). Tab bar itself survives (wired at 2661), so users are inconvenienced, not fully bricked.

**Fix:** Wire hardReset and the bell FIRST in wire(), and guard the unguarded lookups with the const el=...; if(el) pattern already used elsewhere. ~15 minutes.

### [LOW] PARTIAL — auto-open write herd: every signed-in client ticks checkRoundSchedule every 30s and races to flip the cycle open

*Evidence:* app.html:2945 (30s interval on all clients incl. staff), 602-606 (each firer flips status + notification + audit + save), 604-605 (fired flags mutate without save). Verified but overstated: interval phases are staggered and realtime propagation (~1-2s) means the realistic herd is 1-3 devices, duplicates are accidentally suppressed by the very mine-wins merge behaviour flagged above, and present-day harm is near zero.

**Fix:** Note the coupling: when the notifications/audit arrays get union-by-id merging (top finding), add a dedupe key to schedule-fired notifications (e.g. id = cycleId+'|open') so N racing clients produce one entry, and save() the fired-flag mutation. Fold into the sync-hardening session rather than fixing standalone.

## Design gaps

- **Shift model** — The day is hardcoded to two clinical periods (AM 08:00-16:00 / PM 15:30-23:30) plus CST/on-call — no night shifts, no configurable shift templates, no variable lengths.
  *Impact:* The single biggest blocker to 'best flexible rostering for healthcare': almost every other ED runs rostered nights, and nursing/junior-doctor markets are unusable out of the box. Promote SHIFT_TIMES to a per-cycle template array ({code,label,start,end,hours,countsAsNight}) with AM/PM as the migration default so the pilot org sees zero change; do this refactor BEFORE multi-org so N tenants never need migrating.
- **Safe hours / fatigue** — canBook has zero rest-break or consecutive-shift rules — PM (ends 23:30) then AM next day (08:00, 8.5h break) books cleanly, as do unlimited consecutive days and post-on-call mornings.
  *Impact:* Real clinical-safety exposure while live, a headline feature of Allocate HealthRoster, and a procurement checklist item. 2-3 configurable rules (min break hours, max consecutive days, no clinical shift after on-call night) evaluated in canBook with admin override matches both the market and the owner's configurability preference — and is the gate to the junior-doctor market.
- **Skill mix / seniority** — Cover is bare headcount ({amMin,amMax,pmMin,pmMax}); staff.title is display-only free text — no 'at least 1 senior decision-maker per shift' or credential-gated zones.
  *Impact:* A shift can be 'green' with three juniors and no senior the moment the cohort isn't homogeneous consultants. Blocks nursing and mixed SMO/registrar rosters. Defer until those markets are actually entered; then per-cycle role tags + per-zone rules like {tag:'senior',min:1}.
- **Enterprise auth** — Email/SMS OTP against a hand-maintained allow-list; no SSO, no automatic deprovisioning when staff leave.
  *Impact:* Australian health services require Entra ID SSO for staff-facing apps — this vetoes every sale beyond the home department. Supabase already supports Azure/Entra OIDC, so it is configuration-plus-UI, but it must land inside the multi-org milestone; retrofitting after tenants onboard is far costlier.
- **Engineering foundation** — Not a git repo; hand-zipped deploys with three near-duplicate copies of the app file (app.html, deploy/, myrosta-deploy/, drifted preview.html); zero tests for quota math, date logic, merge semantics or export cells.
  *Impact:* One bad edit is unrecoverable and the edit-the-wrong-file trap is armed. For a solo non-developer owner, git init + GitHub + Netlify-from-repo is the highest-value 30 minutes available; a single no-framework tests.html asserting on the pure functions makes every future AI-assisted change safe.
- **Public holidays** — 'PH' is only a personal leave code — the roster has no PH calendar, no per-PH cover overrides, no PH-shift fairness accounting or payroll flagging.
  *Impact:* Admins carry PH awareness in their heads; PH shifts (penalty rates, contested) are invisible to the fairness engine. A per-cycle PH date list with column tint and per-person PH count is small and high-visibility.
- **Fairness evidence** — No longitudinal equity reporting — weekend, Friday-PM, on-call and PH counts are not aggregated across cycles; quota treats Tuesday AM and Saturday PM+OC identically.
  *Impact:* Perceived inequity is the number-one social failure mode of clinician self-rostering, and the equity report is also the moat artifact (see strategy). All data already exists in S.cycles[].assign — a read-only Equity tab needs no schema change.
- **Part-cycle membership** — cycle.roles is all-or-nothing with a flat quota — a week-4 starter or mid-cycle parental leave needs manual periodTargets surgery and still counts in gaps.
  *Impact:* Healthcare has constant mid-cycle churn; from/to dates on cycle.roles that pro-rate quota and exclude out-of-range days from canBook/gaps cover ~80% of the junior-doctor rotation case too.
- **Swap/coverage workflows** — Only 1:1 like-for-like swaps — no 'release this shift to anyone eligible', no give-away, no admin-posted vacant shifts staff can claim.
  *Impact:* Maps directly to ED reality (sudden unavailability, locum gaps — a locum flag exists with no fill workflow) and is the retention feature of Deputy/RosterElf. Reuses existing requests+notifications+canBook plumbing.
- **Hours reconciliation** — EFT and hrsFortnight exist but rostered-vs-contracted hours are never computed or flagged; no TIL/overtime awareness.
  *Impact:* Under/over-rostering is a payroll dispute generator; a 'rostered 68/76h' pill per person per fortnight is the minimum admins expect before trusting exports to payroll. Full award interpretation stays out of scope.
- **Cloud cost structure** — Every save ships the whole blob up and back down to every subscribed client; a busy booking evening ≈ 1GB+ realtime egress, growing with the unpruned blob, and the multi-org plan multiplies it per org.
  *Impact:* An architecture quirk becomes the product's marginal cost. Staged mitigation: prune/archive cold cycles out of the hot blob → split active-cycle state → eventually per-booking rows with realtime on that table.
- **Configuration surface** — 4 fairness modes × quota periods × cap modes × waves × windows, all per-cycle — fine while the configurer is the author, a combinatorial wall for org #5's new admin.
  *Impact:* 'Zero-training UX' dies on the settings page. Package 3-4 named presets ('Consultant self-select', 'Fair draft', 'Admin-led with staff adjust') with raw controls behind an Advanced toggle — this is also the multi-org onboarding story.
- **Mobile UX** — The staff mobile experience is close to excellent (16px inputs, safe-area, next-shift hero, day cards, .ics feed); remaining gaps are connective tissue — being told when something needs you, finding today fast, not fearing destructive taps, dead-zone behaviour.
  *Impact:* Closing these small gaps on the existing surface will move pilot NPS more than any new feature — reinforces the 'rostering only' scope decision.

## Improvements (prioritised)

### Now (before the pilot opens 3 Aug)
- **git init + private GitHub repo + Netlify deploy-from-repo; delete or clearly rename preview.html and the duplicate deploy copies**
  30 minutes that converts every risky change from irreversible to revertible and kills the edit-the-wrong-file trap — the prerequisite for safely making all other fixes.
- **Run `revoke delete on public.org_state from authenticated;` in Supabase**
  One line of SQL, zero app change, removes the ability of any staff member to wipe the entire org row during the pilot.
- **One 'sync hardening' session (with developer help): union-by-id merge for top-level arrays, per-key 3-way assign reconcile incl. deletions, post-merge invariant pass (leave/zone/max-cover), merge-not-replace in the realtime handler when dirty, normalize-before-base-snapshot + strip hydrated staff fields**
  Six verified silent-data-loss defects share this one root; a lost leave request or resurrected shift during the pilot is the trust event most likely to prevent conversion. All fixes live in ~5 functions (mergeOnto, cloudSave, realtime handler, normalize/hydrate). Add tests.html asserting mergeOnto scenarios as part of the session.
- **Fix swap approval: resolve cycle by date range, re-validate both shifts exist and both targets are free, auto-decline with reason otherwise**
  Silent shift destruction plus false 'approved' notifications is a user-facing correctness failure reachable in normal admin workflow (prepareNext auto-switches the viewed cycle).
- **Small guard fixes: zoneTaken re-check in mSave; canBook respects the schedule window (admin exempt, reopen clears window); escapeHTML the seven unescaped name/zone sinks; wire bell+hardReset first and null-guard the my/setup/staff lookups; normalize seeds in:false**
  Each is minutes-to-an-hour, individually verified, and together they close the 'collision-proof' promise gap, the booking-while-banner-says-closed confusion, a stored-injection vector, a dead recovery button, and past-cycle payroll pollution — all before staff form first impressions on 3 Aug.

### During the pilot
- **Fix the DST week-math bug (Math.round the day difference in cycleWeekAB and agendaHTML) before the 28 Sep cycle is prepared**
  The very next cycle after the pilot spans the 4 Oct 2026 spring-forward; without the fix every Monday after the change seeds the wrong fortnight-week's fixed-pattern shifts.
- **Agree written conversion criteria with the ED director and capture the before/after admin-hours number**
  E.g. ≥90% self-booked by deadline, zero payroll discrepancies vs the RosterOn export, measured admin time saved. This is the gate for all downstream investment and becomes the sales artifact for every subsequent department.
- **Resolve the RosterOn .xls-vs-.xlsx import question end-to-end with payroll**
  The payroll bridge is the strongest 'retire Excel' argument; an import failure discovered at cycle end would stall conversion.
- **Build the fairness/equity analytics view (weekend, Friday-PM, on-call, PH counts per person across cycles; quota-vs-actual drift) as a read-only tab, exportable as a one-page summary**
  Cheap (renders over existing assign data, no schema change), it is simultaneously the pilot's trust-builder, the director's adoption justification, and the start of the moat's evidence layer.
- **Harden icsToken (explicit mint via cloudCommit or server-side; merge prefers existing non-empty token) before switching on the subscribed calendar feed**
  The current lazy-mint via plain save() can silently kill feeds — a failure users notice weeks later as a stale on-call calendar, and calendars are a daily-touch trust surface.
- **Persist _remoteBase + dirty flag to localStorage; boot merges instead of clobbering; cloudCommit failure returns an honest 'pending sync' status**
  Closes the remaining offline data-loss paths once the core merge fixes exist; mobile tab eviction makes the boot clobber a realistic pilot scenario.

### Post-pilot
- **Execute the multi-org build (MYROSTA-MULTIORG-BUILD.md) WITH server-side write authority (admin-gated settings/staff/structure writes via edge function or per-key RLS) and Entra ID SSO as an org-level option, plus a short procurement pack (privacy impact statement, data residency, deprovisioning story)**
  These three are one milestone because the first external-hospital conversation stalls without all of them, and retrofitting role enforcement or SSO after tenants onboard is far more expensive.
- **Shift-template refactor (per-cycle template array replacing hardcoded AM/PM) before onboarding tenant #2**
  Large but mechanical; doing it while there is one org means zero tenant migrations, and it unlocks every market beyond consultant groups — the critical product gap for the stated goal.
- **Split app.html into 4-6 plain script-tag .js files (state/cloud, views, self-roster, import/export) and adopt one-statement-per-line when touching code**
  Preserves the no-build ethos while keeping AI-assisted editing reliable; the multi-org build will push past 350-400KB and should not be done inside a single 3,000-line file.
- **Configuration presets: package the fairness/quota/cap/wave matrix into 3-4 named presets with raw controls behind 'Advanced'**
  Prevents configuration sprawl from killing zero-training onboarding at org #3-5; becomes the 'pick how your department rosters' onboarding flow.
- **Configurable fatigue rules (min break, max consecutive days, no clinical shift post-on-call) as canBook warnings/blocks with admin override**
  Clinical-safety exposure while live, a procurement checklist item, and the feature gate to the junior-doctor market in year two.

### Later
- **Part-cycle from/to dates on cycle.roles with quota pro-rating; per-cycle public-holiday calendar with cover overrides**
  Handles mid-cycle churn and PH fairness/payroll visibility; sequenced after templates since both reuse that machinery.
- **'Release shift' marketplace (broadcast to eligible staff, first canBook-valid claimer, admin approval) reusing requests+notifications plumbing**
  High retention value and maps to ED reality, but only after the sync layer is trustworthy — it multiplies concurrent writes.
- **Generic payroll CSV column-mapping (keep RosterOn as a preset); rostered-vs-contracted hours pill; per-booking relational table + skill-mix rules**
  Each should be pulled by a committed customer, not built ahead: new payroll formats by org #2-3's payroll office, relational bookings and skill mix by an actual nursing/JMO go-decision.

## Scaling path

The whole-blob-per-org + CAS + 3-way-merge model is the right architecture for the next 12 months — ~30 users, bursty booking windows, one row per org — and multi-org Option B (blob per org, org-scoped RLS) correctly preserves it as the cheapest path to hospital #2. But it has three ceilings that should be hit in a planned order, not discovered. First (now, in-model): the merge semantics themselves — the verified defect family shows the blob model is only safe if mergeOnto is genuinely 3-way for every collection, deletions are tombstoned, and a post-merge invariant pass re-validates bookings; fixing this keeps the architecture viable through the pilot and multi-org. Second (pilot-to-3-orgs): egress and realtime fanout scale as blob-size × saves × connected clients — a 300KB blob on a busy booking evening (~150 bookings × 25 clients) is ~1GB of realtime egress in one night, and multi-org multiplies it per org into the product's marginal cost structure. Staged mitigations: prune archived cycles out of the hot blob into a cold row/table (also caps localStorage growth), then split active-cycle state from historical state so realtime only carries the active cycle. Third (nursing/JMO scale, 100+ staff per unit): per-shift granularity forces relational booking rows — cloudCommit's mutate/re-validate structure maps cleanly onto row-level writes with realtime on a bookings table, so the migration is tractable, but it is the real cost of entering those markets and must appear as a line item in any nursing/JMO go-decision. In parallel, the codebase itself scales the same way: git + Netlify-from-repo now, a no-framework tests.html over the pure functions (mergeOnto, quota, date math, export cells) during the pilot, and a 4-6-file plain-script split BEFORE the multi-org build — each step is the minimum that keeps a solo non-developer owner able to change the system safely at the next stage's size. Server-side write authority (admin-gated mutations via edge function or per-key RLS) rides in with the multi-org milestone, converting the current client-side-only role model into something a hospital security review can pass.

## Strategy

### Branch IN (build into the core)
- Fairness/equity analytics ('staff pick, the system keeps it fair' — and here's the proof): weekend/night/on-call/PH distribution per person across cycles, quota-vs-actual drift, exportable one-page report for directors. Build first; it is the moat's evidence layer.
- Shift templates (configurable start/end/length incl. nights) — the gate to every healthcare market beyond consultant groups; refactor before multi-org onboarding.
- Configurable fatigue/safe-hours rules in canBook — clinical safety, procurement checklist item, and the junior-doctor unlock.
- Entra ID SSO + procurement pack (privacy impact statement, deprovisioning, data residency) — scheduled inside the multi-org milestone, not after.
- Deeper leave management (accrual visibility, conflict warnings) — leave/EFT is already in the product, so this is core rostering, not scope creep. The line: anything about WHO WORKS WHEN is in.
- Open-shift 'release/claim' workflow and part-cycle membership dates — pulled by pilot feedback and the JMO market respectively, after sync hardening.
- Configuration presets (3-4 named rostering styles) — converts the owner's make-it-configurable habit into an onboarding asset instead of a settings wall.

### Branch OUT (markets, in order)
- 1st: other senior-medical departments — EDs elsewhere, ICU, anaesthetics senior rosters. Identical workflow (small cohort, fortnightly quotas, self-selection culture, EFT); needs only multi-org. Start with 1-2 departments in the same hospital (same buyer relationships, free multi-org QA), then external ED groups via the ACEM/EM-director network.
- 2nd (year two): junior doctors (HMO/registrar) — large, high-pain market with a medical-workforce-unit buyer; requires fatigue rules, term/rotation dates, part-cycle membership. A 2-3 feature delta, feasible after the templates refactor.
- Explicitly deferred: nursing — the biggest prize and the wrong first move (100+ staff/unit, per-shift skill mix, ratios, union rules, Allocate entrenchment, and it forces the relational-booking migration). Say 'not nursing yet' out loud so pilot feedback doesn't drag the roadmap there.
- Skip: GP clinics / allied health — different buyer (practice manager), price-sensitive, crowded with Deputy/Tanda, and the fairness engine is wasted there.

### Do NOT build
- Clinical-companion features — keep the previously-closed door closed: TGA software-as-medical-device exposure, different risk profile, dilutes 'best flexible rostering'.
- Payroll calculation / award interpretation — a graveyard; be the roster of record and bridge to incumbents (the RosterOn export is the right architecture).
- Time-and-attendance / clock-in — hardware, disputes, different buyer.
- Credentialing/CPD tracking — adjacent-sounding but a compliance-database product, not rostering.
- Generic all-industry rostering — competing with Deputy/Tanda on price destroys the healthcare-specialist positioning.
- APIs or new payroll integrations ahead of a committed customer — generalise the existing CSV export mapping only when org #2-3's payroll office asks.

### 12-month path

Jul 2026 (pre-pilot, ~4 weeks): git + sync hardening + the small guard fixes; feature freeze otherwise. Aug-Sep 2026 (pilot): treat the pilot as the product — agree written conversion criteria with the director, resolve the RosterOn .xls question, ship the fairness analytics view, fix DST before the 28 Sep cycle, capture the admin-hours before/after. Oct 2026 (convert): Myrosta becomes authoritative for the next ED cycle; write the case study (uptake %, hours saved, zero payroll discrepancies). Nov 2026-Jan 2027 (multi-org milestone): file split, shift-template refactor, MYROSTA-MULTIORG-BUILD.md with server-side role enforcement, Entra SSO, presets, procurement pack. Feb-Mar 2027: onboard 1-2 more departments in the same hospital as orgs #2/#3. Apr-Jun 2027: 2-3 external ED groups via clinician-to-clinician referral (ACEM ASM, state EM director forums — present the pilot there); add fatigue rules in this window to open the junior-doctor conversation for year two. Decide and document department-level flat pricing (roughly AUD 2-5k/yr — under the director's discretionary/procurement threshold) BEFORE the first external conversation, because the first price quoted anchors the sector. Explicitly deferred past 12 months: JMO rotations, nursing, any integration beyond the RosterOn export. Gate rule: nothing on this path is built ahead of the step it unblocks, and the multi-org build does not start until conversion criteria are met.

### Moat

The self-rostering fairness engine — four modes (guarded free-for-all, snake, cohort waves, auto-draft+adjust) with per-fortnight flexible quotas — is a mechanism incumbents (RosterOn/Altera, Allocate/RLDatix, UKG) are architecturally and culturally unable to ship quickly: they are top-down allocation tools sold to payroll/HR departments. But the mechanism alone is copyable; the durable moat is (1) the EVIDENCE layer — fairness analytics built from data the app already records, which makes staff trust the roster and gives directors the adoption justification — and (2) the distribution channel: a FACEM founder who rosters with his own product every fortnight, selling director-to-director through the college network, a channel vendors cannot authentically access. Instrument the product to carry the channel: myrosta.com.au in every subscribed calendar and export, the equity report as a shareable one-pager, the pilot case study presented at EM director forums. Keep the Myrosta name decision closed (word mark in progress) — renaming would burn the compounding brand touches.

### Biggest risk

The pilot never converts from parallel-run to authoritative — if the 3 Aug-27 Sep cycle ends with 'nice, but Excel stays', Myrosta is a hobby app and every downstream investment (multi-org, SSO, templates) is wasted. The most likely trigger for that outcome is now identified and fixable: the verified silent-data-loss family in the sync layer, where a vanished leave request or a resurrected shift during the pilot would destroy exactly the trust self-rostering depends on. So the risk mitigation is concrete and sequenced: harden sync before 3 Aug, define conversion criteria with the director in writing, prove the payroll bridge, and put the fairness evidence on screen — then, and only then, build for org #2. Secondary risks: solo-owner bus factor becoming a due-diligence objection at the first external sale (mitigate with a documented restore runbook, the smoke-test harness, and a named developer/partner in the support answer), and configuration sprawl eroding the zero-training differentiator as orgs multiply (mitigate with presets).