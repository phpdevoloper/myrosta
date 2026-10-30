# Incident: the booking storm of 14 October 2026

**What happened.** A rounds-mode cycle opened for booking at 10:00 with about 36 consultants ready on their phones.
Within three minutes the group chat read: "it has crashed", "says too many people booking shifts", "I can't book
anything", "stuck saving", "half mine saved half didn't", "app closed", "not opening". Some bookings went through
("it lets some shifts work then stops"). By 10:09 the rota lead reverted the round to the Excel workbook for Friday and
kept the app open as an exercise. Several people were booking from overseas or between patients; the goodwill cost
was real.

**What the app does on a tap (the mechanism).** The whole group lives in one row of `org_state`: one JSON document
holding every cycle, every shift, the staff list, leave, requests, notifications, messages and the audit log. A booking
runs `cloudCommit`: apply the pick locally, then `update org_state set data = <whole document> where org = X and
updated = <the version I loaded>`. If anyone else saved first, the update matches nothing; the client then fetches the
whole document again, re-runs the pick against it, and retries — six times, immediately, with no back-off. After six
losses it says **"Too many people booking at once — please try again."** Every successful save is also broadcast whole,
through Realtime, to every open phone.

**Why it failed at 10:00.**
1. *One row, many writers.* Compare-and-swap on a single row means each success invalidates everyone else's version.
   With N people tapping at once, roughly one booking lands per round of retries, so the number that get through is
   about the number of attempts allowed, not the number of people. A simple model of today's shape (6 attempts, no
   back-off): 5 people → 5 land; 10 → 6; 36 → 6, the rest give up. That is "it lets some shifts work then stops".
2. *The document is 0.6 MB on the wire, and every attempt carries it.* Measured after the event: the row is 92 KB
   stored (compressed) and 596 KB as JSON, with 835 audit rows, 98 notifications, 516 leave blocks (the morning's
   import) and 6 messages. So each attempt uploaded 0.6 MB and each conflict downloaded 0.6 MB over mobile: about a
   second each way, six attempts, the "saving" wheel. Not multi-megabyte, but enough to turn a losing retry loop into
   a minute of waiting. The audit log is unbounded and should be capped or moved, but it was not the decisive factor.
3. *The live-update feed collapsed under the write rate, not the size.* The Realtime log from 10:03 is a wall of
   "canceling statement due to user request", "too many database timeouts" and "connection closed by the pool"; at
   10:07 "replication slot does not exist" begins and repeats until after 10:40. Realtime evaluates every change
   against every subscriber's permissions; dozens of changes a second for dozens of phones timed it out and it lost
   its feed. From then on phones did not see each other's bookings, chips still said Open, and "that zone was just
   taken" multiplied. The 1 MB payload limit was not reached.
   The API log shows the storm itself: about 3,400 requests on the row in 30 minutes (OPTIONS + PATCH per attempt,
   GET per conflict) and 66 to 197 server errors, which the app treats as "offline" and keeps the pick on the phone.
4. *Phones freeze.* Each incoming change makes the app serialise the whole state twice and re-render the grid. Dozens
   of multi-megabyte events a minute on a phone browser is enough for Safari to kill the tab: "app closed".

**What was not the cause.** The cover settings (minimum 4, maximum 4, SSU off for round 1) worked as designed; the
refusals people saw were the retry loop, not the rules. Supabase was not down. Two side findings: the reminder cron
reads every group's whole document every minute and gets "permission denied for table orgs" each time (a separate
bug), and a pick kept "offline" and merged later is not re-checked against the zone, so the draft should be scanned
for two people in one zone before it is used.

**Evidence pulled from the dashboard (14 Oct, afternoon): the row-size query, the API Gateway log and the Realtime
log, all consistent with the above.** For the record, the queries:
- Row size and what fills it (SQL editor):
  `select org, pg_column_size(data)/1024 as kb, updated, jsonb_array_length(coalesce(data->'audit','[]'::jsonb)) as audit_rows, jsonb_array_length(coalesce(data->'notifications','[]'::jsonb)) as notifications, jsonb_array_length(coalesce(data->'leave','[]'::jsonb)) as leave_blocks, jsonb_array_length(coalesce(data->'messages','[]'::jsonb)) as messages from org_state;`
- Logs → API Gateway, 10:00–10:30 local: requests on `/rest/v1/org_state`, by method and status, with latencies —
  expect a burst of PATCH (the CAS writes, most matching 0 rows) and GET (the re-fetches).
- Logs → Realtime: payload-size warnings, disconnects, reconnect storms.
- The app's Audit tab → CSV: every `selfroster.book` row between 10:00 and 10:30 shows how many bookings landed
  per minute.

## The fix, in three parts

**1. Book through the database, not through the document (the real fix).** A Postgres function
`book_shift(org, cycle, staff, day, period, zone, type)` that, in one transaction, locks the org row, checks the hard
invariants against the live document — the round is open, the day is in the cycle and not past, the person is in the
cycle, the zone is free for that half (overlap-aware for full-day types), the half is under its maximum, the share for
the fortnight or cycle has room — then writes that one key with `jsonb_set`, appends the audit row, bumps `updated`,
and returns `{ok, reason, booked, quota}`. The client sends one small call per tap and paints the answer; there is no
retry loop, because the row lock queues the calls and every one gets a true answer. The same model for Remove, Claim
and a give-away take. Tags and safe-hours stay client-side warnings, as now; admin edits keep the document path (one
admin at a time is fine). The model: 36 taps at once land in about 2 seconds, 300 in under 20.

**2. Make the document small and stop broadcasting it.** Move `audit`, `notifications` and `messages` out of
`org_state.data` into their own append-only tables (the Audit tab reads the last few hundred rows; the CSV export
reads them all). Replace the whole-document Realtime event with a tiny one: a trigger writes `org_events (org, updated,
kind)` and each phone fetches the fresh state at most once every two or three seconds, with a random delay so they do
not all fetch together. Cap any array left in the document as a safety net.

**3. Prove it before anyone opens a round again.** A load-test tool that drives 50 simulated clients through the real
endpoints against a staging copy of the group (synthetic names): 50 people × 3 taps in 10 seconds must all land or be
refused with a true reason, with a p95 under 3 seconds, and Realtime must stay connected. Run it before the next
opening at the pilot department and before the second site's launch. Belt and braces for a big round: the app can open
in waves (cohorts), which spreads the first minute across several groups.

**Order.** Part 1 first; it removes the failure. Part 2 second; it removes the slowness and the 1 MB cliff. Part 3
before any opening. All three fit in the fortnight before the next launch.

**Today's bookings.** The picks that reached the database are first-come and valid. Decide whether they stand as the
first entries of the Excel round or whether the draft is cleared before transcribing; the audit log names them either
way.

---

## The fix (built 14 Oct 2026, afternoon) — and how to switch it on

**What changed.** A tap is now one database call, `roster_commit`, instead of a whole-document save. The call
locks the group's row so phones queue in order, judges the shift against the roster as it stands at that instant
(the zone, the half's cap, the person's day, their leave), writes the one key, logs it, and tells every phone with a
300-byte event row. The phone keeps a pick only once the database has confirmed it; if the call never arrives it
says "that tap wasn't saved" instead of "saved on this device". Realtime carries the small event rows and a one-row
ping for whole-document saves; the 0.6 MB document is no longer broadcast. Full design:
`docs/superpowers/specs/2026-10-14-book-through-the-database-design.md`.

**What it measured as.** `tools/storm.py` replays the morning against a local PostgreSQL 16 with the document padded to
the size it had (about 0.5 MB): 36 synthetic phones tapping at once filled the whole 8-week cycle at 4 AM + 4 PM — 448
shifts — in 3.3 seconds, 138 calls a second, median 8 ms and worst 178 ms per call, with 7 refusals ("That zone was
just taken") and every invariant intact (no zone double-booked, nobody twice in a day, no half over its maximum,
one event row per shift). The same morning took forty minutes and failed.

**Switch-on order (the owner, from GitHub Desktop and the Supabase dashboard):**

1. Push this build. The app runs unchanged on the old database: at load it looks for the `roster_events` table and,
   finding none, books the old way. Nothing changes for anyone until step 2.
2. In the Supabase SQL editor (production project), paste and run `supabase/prod-booking-rpc.sql`. It is idempotent.
   Read its four verification results at the bottom: the four functions listed; the publication carrying
   `org_events` and `roster_events` and not `org_state`; the trigger `org_state_ping` enabled; no table without RLS.
   The editor has no signed-in user, so do not call the function from it.
3. Open the app on a phone that was already open: reload it. Under More → About the row should read "Stored in
   Sydney, Australia · bookings go straight to the database · live updates on · …". A phone that still shows the old
   row has not been reloaded; "live updates off" means the phone is checking every 45 s instead of hearing each tap.
4. A dry run before any real opening: on a draft or test cycle, book one shift as yourself and remove it; on a second
   signed-in device the chip should change within a second or two. Then the audit log shows the two rows.
5. On the day: nothing else needed. Waves/cohorts remain available as belt and braces but are no longer needed for
   36 people.

**If anything looks wrong**, the old way is one statement away and the app follows it at the next reload:
`alter publication supabase_realtime add table org_state;` restores the whole-document broadcast, and
`drop table roster_events;` makes the app book the old way (the data it holds is a log, not the roster).

**Still open, in order** (from the design): the whole-document save a staff phone makes when it marks notifications
read; the unbounded audit log in the document; the reminder cron's per-minute full-state reads; binding the booking
to the caller's own identity server-side; a server-side round gate.

---

## The second morning — 16 Oct 2026, 10:00

**What happened.** The retry on the new path failed too. Taps that did land were correct; 19 in the first minute, then
4 to 7 a minute, because people were waiting on calls that took seconds or failed.

The figures below are from the gateway, Postgres, PostgREST and Auth logs for 22:45–23:35 UTC, exported on 22 Oct
before the seven-day retention ran out. The de-identified copy of those logs goes with this note.

| Measure | 16 Oct 2026 |
| --- | --- |
| Gateway requests in the 50-minute window | 3,769 |
| Of those, 5xx responses | 288 |
| Busiest minute | 23:00 UTC (10:00 Melbourne), 442 requests |
| Failures ran from | 23:00:11 to 23:17:01 UTC — 17 minutes |
| Failures by status | 504 × 263, 500 × 23, 520 × 2 |
| Failures by path | `org_state` × 123, `roster_events` × 81, `roster_commit` × 74, `my_orgs` × 9 |
| Postgres errors | "canceling statement due to statement timeout" × 78, autovacuum cancelled × 2 |
| PostgREST | statement timeouts × 51, "Timed out acquiring connection from connection pool" × 13 |

Two things in that table were not in the first account of the morning. Almost every failure was a **504**, the
gateway giving up on a request the database had not answered, rather than an error the application raised: the system
was not refusing work, it was queueing. And PostgREST ran out of database connections thirteen times, so some phones
were turned away before their call reached Postgres at all.

**Why.** The project runs on Micro compute. Every write to the group's roster queues on the same row, and the booking
call's own cost (a few milliseconds on a fast machine, tens on Micro) was not the problem. Three other things were:
1. *The opening.* Every phone open at 10:00 flipped the round to open on its own copy and saved the whole 0.6 MB
   roster; most lost the swap to a colleague's tap, refetched 0.6 MB, merged, retried, and kept retrying every
   4–12 s for as long as taps kept the roster moving — which, during a round, is always. The owner's own phone showed
   "Saving…" at 10:10. Only the rare wins are visible as markers; the thrash itself leaves none.
2. *The fan-out.* Each save that landed pinged every phone, and every phone fetched the whole roster within two
   seconds: thirty-six downloads of 0.6 MB per save, twenty-five saves in twenty minutes.
3. *The other round-time actions.* Mark CST, Mark unavailable, Mark off and Add to calendar still saved the whole
   roster from the phone.
On a Micro server each whole-roster attempt or fetch costs about twenty-five taps' worth of work; the queue on the row
grew past the 8-second statement limit and calls died. `tools/storm.py --savers 15 --refetchers 36` replays it.

**The fix** (16 Oct, evening): the window opens the round on every phone without any phone writing the status, which
the server and an admin's device record; every round-time action goes through the booking call; a lost swap backs off
to a minute and never re-uploads what the cloud already has; a ping fetches at most once a minute per phone, spread;
the document is capped; signed-in calls may queue for 20 s. Owner steps: push, paste the SQL again, redeploy
`notify-rounds`, and consider Small compute for opening days.
