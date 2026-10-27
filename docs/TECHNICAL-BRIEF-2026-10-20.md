# Myrosta technical brief

20 October 2026. Written for an outside engineer reviewing the system; the Claude Docs version of this brief (with an architecture diagram) is https://claude.ai/artifact/6Q2wD4tAbuhkQiRFv1yWD7.

Myrosta is a self-rostering web app for hospital emergency departments, live at myrosta.com.au since 7 September 2026 for one department of 37 consultants; this brief gives an outside engineer the architecture, the two production incidents of 14 and 16 October, what has been fixed, what still limits it, and the plan to make 100 people booking in the same minute comfortable.

## At a glance

(The architecture diagram is in the Claude Docs version of this brief. In words: phones hold the group document and tap through PostgREST to `roster_commit`; Realtime carries `roster_events` and `org_events` back; the Edge Functions read every document on a 5-minute cron and send through Twilio and Resend.)

Every phone holds a copy of its group's document and sends each tap to one Postgres function, which writes one key and one event row; Realtime fans the event rows out to the other phones. Everything an admin does still rewrites the whole document, and that is where the remaining limits sit.

## What it is

Myrosta lets a hospital department roster itself: an 8-week cycle, a booking round in which each person taps the shifts they want (first tap wins, no basket), fixed patterns for people with set days, leave, swaps, open shifts, on-call and clocking, with admins running the round, publishing and exporting to payroll. One department is live (37 consultants, five zones, cover of 4 AM + 4 PM a day); a second hospital with four groups is loaded as drafts for a 26 October 2026 launch. It is multi-tenant from the start: every group is its own row.

| Part | What it is | Notes |
| --- | --- | --- |
| Site | Static files on Netlify, served from the repository's `deploy/` folder | A push is the deployment; no server-side code, no CMS |
| App | One file, `app.html`, about 6,500 lines of plain JavaScript, installable as a PWA | The service worker is for push only and caches nothing, so every open loads the current build |
| Database | Supabase (Sydney): Postgres 16 behind PostgREST, Auth (one-time codes by SMS and email), Realtime, four Edge Functions | Compute was Nano until 17 October; now Small |
| Messaging | Twilio (SMS) and Resend (email), called from the `notify-rounds` and `notify-shifts` functions on a 5-minute cron | Shift reminders, round open/close notices, invites |

**Data model.** Each group is one JSON document in `org_state(org, data jsonb, updated)`: `staff[]`, `cycles[]` (each with `cycle{start,weeks}`, `assign{"staffId|date": shift}`, `settings`, `roles`, `statusLog`, `window`), `leave[]`, `audit[]`, `notifications[]`, `openShifts[]` and the group's settings. The live group's document is 92 KB stored and about 0.6 MB on the wire. `roster_members(org, email, role, phone)` is the allow-list, and every policy goes through `is_member(org)` / `is_admin_member(org)`. Since 14 October there are also `roster_events(seq, org, ts, cycle, key, val, audit)`, `org_events(org, ts, n)` and the function `roster_commit(org, cycle, ops)`.

**Code and tests.** One GitHub repository on `main`, pushed by the owner. `tests/run.py` runs 1,224 assertions and a set of lints against the app under JavaScriptCore; `tests/sql/run.py` runs 63 assertions against the production SQL on a bundled Postgres 16; `tools/storm.py` is a load test with synthetic names.

## The two incidents

Both were booking rounds opened at 10:00 for 36 people, and both failed within minutes; the full write-up with log extracts is `docs/INCIDENT-2026-10-14-booking-storm.md` in the repository.

| Date | What people saw | Root cause | Evidence |
| --- | --- | --- | --- |
| 14 Oct 2026, 10:00 | "Too many people booking at once", a saving wheel that never finished, picks kept on the phone then lost, zones shown open that were taken | Every tap saved the whole 0.6 MB document with a compare-and-swap on `updated` and retried six times; a server error on any attempt kept the pick "offline" and merged it later with no zone check; Realtime broadcast the whole row to every phone on every save and lost its replication slot | About 3,400 requests on the row in 30 minutes, 66 to 197 server errors, Realtime log full of statement cancellations and "replication slot does not exist" from 10:07 to 10:41 |
| 16 Oct 2026, 10:00 | "Failed to fetch" on reload, stuck loading skeletons, "check your signal", green chips that disappeared, saves of several seconds | Nano compute. Every phone open at 10:00 flipped the scheduled round and saved the whole document, then retried every 4 to 12 s as taps kept bumping `updated`; each landed save pinged all 36 phones into a 0.6 MB fetch within 2 s; marking CST or unavailable and Add to calendar were whole-document saves too; the queue on the one row exceeded the 8 s statement limit | 3,769 gateway requests in 50 minutes, 288 of them 5xx, failures from 10:00:11 to 10:17:01; 263 were 504 (the gateway giving up on a request the database had not answered), 23 were 500; by path `org_state` 123, `roster_events` 81, `roster_commit` 74; Postgres "canceling statement due to statement timeout" 78 times; PostgREST "Timed out acquiring connection from connection pool" 13 times; CPU at 97 to 100 per cent on the compute graph |

The first incident was the original design (one document, whole-document writes) meeting a crowd. The second was the new design's remaining whole-document paths meeting the same crowd on the smallest server, amplified by a refetch fan-out that the new design had introduced.

## What is in place now

Everything below is live on production as of 17 October 2026, tested in the suite, the SQL tests and the load test.

| Mechanism | What it does | Protects against |
| --- | --- | --- |
| `roster_commit(org, cycle, ops)` | One Postgres function per tap: locks the group's row (`select … for update`), checks each op against the roster as it stands (day in cycle, person on roster, nothing else on their day, approved leave, zone open in that half and free of overlapping colleagues, half under `min(max, zones open)`), writes the one key with `jsonb_set`, prepends the audit row, writes one `roster_events` row per op, bumps `updated` | Whole-document writes under contention; double booking; over-cover |
| Ops `book`, `unbook`, `mark`, `ics` | Booking, removal of the person's own entry (never a fixed shift unless admin), CST or unavailable marks, the personal calendar token | Every action a person takes during a round is a small call |
| `roster_events` + `org_events` + markers | Realtime carries 300-byte event rows and a one-row ping; `org_state` left the publication; a trigger writes a marker row into the event stream on every whole-document save | The 0.6 MB broadcast per save; replay of stale events over a newer document |
| Client watermark `_evDocSeq` | The newest event the held document already reflects, read before each document read; events at or below it are never applied; a marker in a batch triggers a refetch | Cleared bookings resurrected by replayed events (happened on 16 Oct, 03:00) |
| Optimistic apply with rollback | A pick shows at once; a refusal removes that pick with the server's reason; a transport failure removes all of them and says so | "Saved on this device" bookings that later lost the race |
| Scheduled opening by window | A round whose window is open is open on every phone; only the server cron and an admin's device write the status | Thirty-six phones saving the document at 10:00 |
| Save backoff and no-op skip | A whole-document save that loses its swap waits 4, 8, 16 … 60 s, tries once while bookings flow, never uploads a document the cloud already has | The retry thrash of 16 Oct |
| Refetch throttle | A ping-driven document fetch at most once a minute per phone, spread over 20 s, never while a tap is in flight | The 36 × 0.6 MB fan-out per save |
| Caps | Audit log 400 lines and notifications 80 inside the document (the call trims too) | Document growth |
| `statement_timeout = 20s` for `authenticated` | Calls may queue for 20 s instead of 8 | Taps cancelled while waiting on the lock |
| Group clock | Schedule wall times are Australia/Melbourne on every phone and in the cron | A phone abroad opening the round early; texts sent at 9 pm |
| Self-updating build | The app notices a new build on the host and reloads itself when idle | Phones running old code after a push |
| Compute Small | Upgraded from Nano on 17 Oct | CPU saturation at the margin |

## Remaining bottlenecks

The one-document model is the root of every limit below; the fixes so far keep the crowd's work off the document, they do not make the document small.

| Limit | Why it exists | How it shows |
| --- | --- | --- |
| Document size, 0.6 MB per group | Every tap parses and rewrites it inside `roster_commit`; every app opening downloads it; every admin save uploads it; archived cycles, 516 leave blocks and the audit log all ride in it | CPU and egress on small compute; measured on an M-series Mac, a tap costs 5 ms, a whole-document save attempt 129 ms, a fetch 94 ms |
| One row per group, one lock queue | Correct for taps (milliseconds each) but any whole-document write holds it for hundreds of milliseconds | Taps queue behind admin edits, imports and cron flag writes; at the old 8 s limit they died |
| Realtime by `postgres_changes` | Row-level security is evaluated per subscriber per event (`is_member` looks up `roster_members`) | Cost grows as subscribers × events; fine at 36 phones, the next thing to saturate at 100 |
| Whole-document paths that remain | Admin edits, imports, settings, leave and swap requests, give-aways, own hours, call-ins still use the compare-and-swap document save | Each costs about 25 taps of server work; rare during a round but not absent |
| Sign-in capacity | Supabase rate-limits one-time codes per hour; SMS has a cost per code | Sessions persist on phones so few sign in at 10:00, but a new phone or an expired session at the opening minute can be refused |
| No staging environment | The SQL tests and the load test run on a local Postgres, not through Supabase's gateway, pooler and Realtime | Both incidents were first seen in production |
| PostgREST connection pool | A fixed pool of database connections per project; a request that cannot get one is refused before it reaches Postgres | "Timed out acquiring connection from connection pool" 13 times on 16 October, and 51 statement timeouts surfaced by PostgREST |
| Cron reads | `notify-rounds` reads every group's whole document every five minutes | Negligible today; linear in groups |
| Phone memory | The document and a merge-base copy of it are held as strings on the phone | Fine at 0.6 MB; a problem long before 5 MB |

## Scaling plan

In order, each step buying something on its own; steps 1 to 6 are what makes 100 people in one minute comfortable, step 8 is what makes many hospitals comfortable.

| # | Step | Effort | What it buys |
| --- | --- | --- | --- |
| 1 | Staging: a second Supabase project with the same SQL, a Netlify branch deploy pointed at it, synthetic data only | 1 day | A rehearsal ground and a safe place for an outside engineer |
| 2 | Shrink the document: audit log, notifications and leave into their own tables (bookings are already in `roster_events`); each cycle in its own row, archived cycles out of the hot row | 1 to 2 weeks, including migration and the import/export tools | The row a round touches drops from 0.6 MB to tens of kilobytes; taps and app openings cost a fifth to a tenth |
| 3 | Realtime by broadcast: `roster_commit` sends each event on one authenticated channel per group instead of a per-subscriber policy check | 2 to 3 days | Per-event cost independent of the number of phones |
| 4 | Load test against staging through PostgREST with 150 synthetic accounts (extend `tools/storm.py`) | 2 days | Numbers from the real gateway, pooler and Realtime, not a laptop |
| 5 | Sign-in review: raise code limits for opening days, confirm session lifetime, keep the self-update path | ½ day | No refusals at the door at 10:00 |
| 6 | Opening protocol and monitoring: a rehearsal with a scheduled window before every first use of a build, dashboards open, an alert on server errors | 1 day | Problems seen in rehearsal, not in production |
| 7 | Compute by the hour: Small as the floor, Medium for opening days | minutes | Margin, reversible |
| 8 | One row per shift: the conventional schema, the merge machinery retired, reads as queries | 3 to 5 weeks | Hundreds of groups on one database, large groups move to their own |

## The 100-at-10:00 target

"100 users" is two different loads. A hundred people signed in costs nothing; a hundred people tapping in the same minute is roughly 300 taps in 60 seconds with bursts of 20 a second, all on one row.

| Quantity | Today (Small, 0.6 MB document) | After steps 2 and 3 |
| --- | --- | --- |
| Server cost of one tap | about 30 ms (5 ms measured on an M-series Mac, scaled for shared compute) | about 5 ms |
| Lock queue at 20 taps/s | 60 per cent busy; a tap waits under half a second at the 95th percentile | under 10 per cent busy |
| App openings at 10:00 | 100 × 0.6 MB = 60 MB | 100 × 0.1 MB = 10 MB |
| Realtime work | 100 subscribers × 5 events/s = 500 policy evaluations a second | 5 broadcasts a second |
| Whole-document writes during the minute | none from staff phones (enforced); admin edits should wait | none |

Survivable today on Small if nobody saves the whole document during the opening minute; comfortable after the document shrink and broadcast, which is also when the claim should be proven by the staging load test rather than by this arithmetic.

## Test environment and access

There is no staging environment yet; there is a local harness and a sandbox, and a staging project is a day's work.

**What exists.** `tests/sql/run.py` boots a bundled Postgres 16, applies the production SQL twice and runs 63 assertions; `tools/storm.py` replays a booking rush (36 phones, savers and refetchers) against that database; `deploy/demo.html` is the app in local mode with a fictional department, no server. None of these exercise Supabase's gateway, pooler or Realtime.

**What a staging project needs**

- [ ] A second Supabase project in Sydney (Small, about $15 a month; Micro is covered by the plan credit)
- [ ] `supabase/prod-multiorg.sql`, `prod-department.sql` and `prod-booking-rpc.sql` applied in that order, plus the SMS sign-in migration from `SUPABASE.md`
- [ ] `roster_members` rows for synthetic accounts and an `org_state` document built from synthetic names (the storm tool builds one); no production data, ever
- [ ] The four Edge Functions deployed with staging secrets, messaging pointed at test numbers or disabled
- [ ] A Netlify branch deploy of the site with `app.html` pointed at the staging URL and key (one line in the file), for example staging.myrosta.com.au
- [ ] The storm tool extended to call PostgREST with 150 synthetic sessions

**Access for an outside engineer.** Read access to the GitHub repository (or collaborator if they will commit); membership of the Supabase organisation with the Developer role on the staging project only; this brief, the incident write-up and the design note. Production holds staff names and phone numbers and should stay out of scope unless a specific investigation needs it, in which case a read-only look with the owner present.

## Where to look

| Path | What is there |
| --- | --- |
| `app.html` | The whole app. Cloud layer: `cloudLoad`, `cloudSave`, `cloudCommit`, `mergeOnto`, `_applyRemoteDoc`; booking: `srBatchBook`, `cloudBook`, `_bookSettle`, `markDay`, `canBook`, `pickCheck`; events: `evApply`, `_evApplyLive`, `_evCatchUp`, `_docRefetch`, `_evProbe`; rounds: `roundEffOpen`, `checkRoundSchedule`, `roundStepperHTML` |
| `supabase/prod-booking-rpc.sql` | `roster_commit`, `roster_events`, `org_events`, the ping trigger with its marker, the publication change, the statement limit |
| `supabase/prod-multiorg.sql`, `prod-department.sql` | Tenancy: `roster_members`, `is_member`, policies, `orgs`, `hospitals`, the department board |
| `supabase/functions/` | `notify-rounds` (round open/close and texts, now flips the status itself), `notify-shifts`, `push-send`, `ics` |
| `tests/run.py`, `tests/suite.js`, `tests/stubs.js` | The app suite and lints (JavaScriptCore) |
| `tests/sql/` | The SQL harness, stand-ins for Supabase, 63 assertions |
| `tools/storm.py` | The load test; `--savers` and `--refetchers` replay 16 October |
| `docs/INCIDENT-2026-10-14-booking-storm.md` | Both incidents with log extracts and the fix runbook |
| `docs/superpowers/specs/2026-10-14-book-through-the-database-design.md` | The design decisions behind the booking call |
| `SUPABASE.md`, `CHANGELOG.md` | Setup history and a dated change log |

**Diagnostic queries used so far** (Supabase SQL editor, production):

```sql
-- taps and whole-document saves per minute
select to_char(ts at time zone 'Australia/Melbourne', 'HH24:MI') as minute, count(*) filter (where key = '') as roster_saves, count(*) filter (where key <> '') as taps from roster_events where ts >= '2026-10-15 22:55+00' and ts < '2026-10-15 23:20+00' group by 1 order by 1;
-- document size on the wire and stored
select org, octet_length(data::text) / 1024 as kb_on_the_wire, pg_column_size(data) / 1024 as kb_stored, jsonb_array_length(data -> 'audit') as audit_rows from org_state;
-- the role's statement limit and the function's ops
select (select setconfig::text from pg_db_role_setting rs join pg_roles r on r.oid = rs.setrole where r.rolname = 'authenticated'), (select prosrc like '%''ics''%' from pg_proc where proname = 'roster_commit');
```

## Open questions

**For the owner to decide**

- [ ] Scope of the engagement: a review and a load test with on-call cover for two openings, or hands-on work on steps 2 and 3 of the plan
- [ ] Approval for the staging project (about $15 a month) and who sets it up
- [ ] The date of the next app-run round, which sets the deadline for steps 1, 4, 5 and 6
- [ ] Whether the engineer may see production data at all (recommended: no; staging only)

**For the engineer to answer**

- [ ] Is the per-row schema (step 8) worth starting now, or is the document shrink (step 2) enough for the next year?
- [ ] Review of the security-definer functions and policies: `roster_commit` trusts any member to write any person's key, as the document model always did; should the caller be bound to their own staff id server-side?
- [ ] Broadcast versus `postgres_changes` for Realtime at 100 to 500 phones, and private-channel authorisation
- [ ] PostgREST pool size and `statement_timeout` on Small; whether the 20 s limit should stay
- [ ] What to monitor and alert on, and from where
