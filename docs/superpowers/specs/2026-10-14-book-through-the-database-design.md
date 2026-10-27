# Book through the database — design (14 Oct 2026)

Answers `docs/INCIDENT-2026-10-14-booking-storm.md`. The owner's instruction: "I have stopped booking today due to
the glitches and crashes. Let's work on fixing this." Approved approach (14 Oct): book through the database first,
shrink and stop broadcasting the document second, load-test before any opening.

## 1. What goes wrong today

A tap writes the **whole group document** (0.6 MB on the wire) with a compare-and-swap on `org_state.updated`.
Thirty-six phones tapping at once lose the swap, download the document, re-run the checks, upload again, six times,
then give up with "Too many people booking at once". A server error on any attempt keeps the pick on the phone as
"saved on this device" and merges it later with no zone check. Every successful write is broadcast whole to every
phone through Realtime, which collapsed under the rate (statement cancellations, replication slot lost 10:07–10:41),
so phones stopped seeing each other and tapped zones that were already taken.

## 2. Decisions

**D1. A booking is a database call, not a document save.** One Postgres function, `roster_commit(p_org, p_cycle,
p_ops jsonb)`, runs as the signed-in member (`is_member` checked, security definer, `search_path=public`). It locks
the group's row (`select … for update`, so writers queue in order instead of racing), validates each op against the
locked document, applies it with `jsonb_set`/`#-` on the one key, prepends the audit row, writes one `roster_events`
row per applied op, bumps `updated` to the server clock, and returns `{ok, updated, results:[…]}`. Ops are
`{op:"book", sid, day, period, zone, type?, hours?}` and `{op:"unbook", sid, day}`; up to 60 per call; a basket
sends several, a tap sends one; each op is judged after the ones before it. Refusals are per op (`ok:false,
reason`), the same words the app uses. Structural problems (not a member, no such cycle, archived, no such person)
raise and roll the whole call back.

**D2. The server checks only what concurrency can break; the phone keeps its rules.** Server checks for a booking:
the day is in the cycle; the person is in the cycle's roster; nothing already on `sid|day` (shift, CST, leave
typed into the roster); no approved leave block that day; the zone exists and offers each half the shift fills;
no colleague holds that zone in an overlapping half ("That zone was just taken — pick another." / "The AM half of
that zone is taken — a whole-day shift needs both."); each half it fills is under its cap, `min(max, zones ticked
for that half)` ("AM is full (4 of 4)."). For an unbook: the key exists, is clinical, and is not fixed unless the
caller is an admin member. The fills of a shift come from the cycle's shift types (`settings.shiftTypes[].fills`,
else the shift's own period), exactly as `fillsOf` does. Share, period targets, fatigue, waves, notice period,
round gate and unlock order stay on the phone (`pickCheck`/`canBook` as dry runs before the call): under a race they
cannot double-book anyone; the admin can always see and fix them.

**D3. The phone never pretends.** The pick is applied optimistically so the screen settles at once; a per-op
refusal rolls that key back and shows the reason; a transport failure or server error rolls everything back and says
"Couldn't reach Myrosta — that tap wasn't saved. Check your signal and try again." No "saved on this device" for a
booking. Other edits (settings, leave, notes) keep the offline-first path unchanged.

**D4. Changes travel as events, not documents.** `roster_events(seq, org, ts, cycle, key, val, audit)` is what
Realtime broadcasts (a row of ~300 bytes); `org_state` leaves the publication. A tiny `org_events(org, ts, n)` row,
upserted by a trigger on `org_state` for writes that are not the function's (admin saves, imports, the reminder
cron), tells phones a whole-document change happened; they refetch once, coalesced with 0.3–2.5 s of jitter. Phones
apply events to the live state and to the merge base (so a missed event can never resurrect a removed shift on the
next merge), de-duplicate audit rows by id, and remember the last `seq`. They catch up with
`select … where seq > last-50` (idempotent re-application closes commit-order gaps) when a tap is refused, when the
channel (re)subscribes, when the page becomes visible or the network comes back, and every 45 s while visible.

**D5. The merge token stays honest.** After its own call the phone does not adopt the returned `updated`: it cannot
know what else landed. Its next whole-document save therefore fails the swap, refetches and merges — which is the
only safe thing a stale document can do.

**D6. Works on both schemas.** The app probes `roster_events` at load. If the table is missing (SQL not yet
pasted) it behaves exactly as today. Deploy order: app build first (it runs unchanged on the old schema), then
`supabase/prod-booking-rpc.sql`, then the About sheet reads "bookings go straight to the database".

## 3. Not in this change (follow-ups, in order)

1. `markNotifsRead` still saves the whole document from a staff phone; a `mark_read` function or device-local marks.
2. The audit log is unbounded in the document (835 rows); cap or move it.
3. The reminder cron reads every group's whole document each minute and gets "permission denied for table orgs".
4. Bind `sid` to the caller's identity server-side (today any member may write any key, as before).
5. Server-side round gate and notice period.

## 4. Testing

- `tests/sql/run.py`: boots a bundled Postgres 16 (pgserver in a git-ignored venv), creates the Supabase stand-ins
  (`auth.jwt()`, `roster_members`, `org_state`, `is_member`), runs `supabase/prod-booking-rpc.sql` twice (idempotent),
  then the assertions in `tests/sql/roster_commit.sql`: every refusal, the whole-day overlap, the cap, unbook, the
  audit row, the event row, the trigger's silence on the function's own writes, the publication.
- `tools/storm.py`: 50 simulated phones (synthetic names) tapping a synthetic 8-week cycle at once against that
  Postgres; prints taps/s and latency percentiles and checks the invariants on the final document.
- `tests/suite.js`: the op builder, event application (state + base, idempotent, audit dedupe), the settle logic
  (rollback on refusal, nothing kept on transport failure), the probe, the subscription tables, the catch-up window.
