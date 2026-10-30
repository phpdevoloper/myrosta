# Staging for an outside reviewer — runbook

A staging database is a **separate Supabase organisation** holding a **de-identified copy** of production. The reviewer
gets read access to the code, the staging project and the incident write-up, and never touches production. Everything
below is done by the owner from the dashboards and this repository; nothing here needs the command line beyond two
`python3` commands.

Why a separate organisation: Supabase roles are organisation-wide. A person invited to the production organisation,
with any role, can open the production project and its data. A new organisation costs nothing on the Free plan.

Never share your own Supabase or GitHub login. A shared login cannot be limited to staging or to reading, every action
shows as yours, and taking it back means changing the password and rotating every key the other person could have seen.

## The simpler way: the reviewer hosts staging

The seed holds no real person, so the staging project can live under the **reviewer's own free Supabase account**.
Then the owner's whole part is:

1. export the incident logs before they expire (section 1)
2. push, then make the read-only mirror and add the reviewer to it (section 2)
3. export production and run the de-identifier (sections 5a and 5b); send the seed folder it writes
4. send the brief, the log CSVs and the reviewer's own instructions (section 10)

The reviewer does sections 3, 4, 5c, 6 and 8 themselves, on their own account, with the seed folder and the repository.
Nothing of the owner's is shared, nobody is invited anywhere, and the owner can still use the full path below later for
a staging project of their own.

Order of work (about two hours, most of it waiting for screens):

| # | Step | Where | Time |
| --- | --- | --- | --- |
| 1 | Export the incident logs before they expire | Supabase, production project | 20 min |
| 2 | Push, then give the reviewer read access to the repository | GitHub Desktop, github.com | 10 min |
| 3 | Create the staging organisation and project | supabase.com | 10 min |
| 4 | Build the schema on staging | Staging SQL editor | 10 min |
| 5 | Export production, de-identify it, load it into staging | Production SQL editor, this repo, staging SQL editor | 30 min |
| 6 | Create the read-only Postgres login | Staging SQL editor | 5 min |
| 7 | Invite the reviewer to the staging organisation | supabase.com | 5 min |
| 8 | Hand over: brief, write-up, logs, connection string, staging app | Email or a password-manager share | 15 min |
| 9 | Afterwards: revoke | supabase.com, github.com | 5 min |

## 1. Export the incident logs (time-limited)

The Pro plan keeps logs for **seven days**. The 16 October opening was 09:50–10:30 Melbourne time, which is
**15 October 22:50–23:30 UTC**; the dashboard shows times in UTC.

1. Supabase → production project → **Logs** (left bar) → **Logs Explorer**.
2. Set the time range to custom: **from 2026-10-15 22:45 to 2026-10-15 23:35 (UTC)**.
3. Run each query below, then use the results panel's **Download** (CSV). Name the files as shown. If a result is cut at
   the row limit, halve the time range and download twice.

API gateway, every request (`edge-16oct.csv`):

```sql
select id, timestamp, event_message
from edge_logs
order by timestamp
```

Postgres, errors and timeouts (`postgres-16oct.csv`):

```sql
select id, timestamp, event_message
from postgres_logs
order by timestamp
```

Realtime (`realtime-16oct.csv`):

```sql
select id, timestamp, event_message
from realtime_logs
order by timestamp
```

Then repeat the three with the range **2026-10-13 23:55 to 2026-10-14 00:45 (UTC)** for the 14 October opening, in case
any of it is still there (it expires first).

Before sharing: open each CSV and delete any column holding an IP address or a user agent if one is present; the
`event_message` column (method, path, status, timing, error text) is what the reviewer needs. The write-up with the
extracts already taken is `docs/operations/INCIDENT-2026-10-14-booking-storm.md` in the repository.

## 2. Repository access: a read-only mirror

A collaborator on a personal private repository always gets **write** access (the Read role exists only in GitHub
organisations), and a push to this repository deploys the live site. So the reviewer reads a **mirror**: a second
private repository that nothing deploys from. Write access there is harmless.

1. GitHub Desktop → **Push origin**.
2. Terminal, from the repository folder (the GitHub command-line tool is signed in on this Mac):

```bash
gh auth setup-git
```

```bash
gh repo create myrosta-review --private --source=. --remote=review --push --description "read-only mirror for review"
```

3. github.com → the new `myrosta-review` repository → **Settings → Collaborators → Add people** → the reviewer's GitHub
   username. They accept by email.
4. Whenever the mirror should catch up with new commits:

```bash
git push review main
```

Longer term, a free GitHub organisation with the repository transferred into it gives true Read roles; not before the
26 October launch, because the site's deploy connection would have to be re-made.

The repository has been checked across its whole history: it holds no staff names, phone numbers or keys. The only
email in it is the owner's own, as the bootstrap admin.

## 3. The staging organisation and project

1. supabase.com → the organisation switcher (top left) → **New organisation** → name `Myrosta staging`, plan **Free**.
2. **New project** → name `myrosta-staging`, region **Sydney**, a long generated database password (save it in the
   password manager; it is not needed again unless a direct `postgres` connection is), compute the default.
3. Wait until the project shows as healthy (a few minutes).
4. **Authentication → Sign In / Providers → Email**: enabled, with **Confirm email off** (codes, not links). Leave Phone
   off: SMS sign-in is not configured on staging; everyone signs in with an email code. The built-in mailer allows a
   handful of codes an hour, which is enough for a reviewer.

## 4. The schema

Staging project → **SQL Editor → New query**. Paste each file whole from the repository, in this order, and press Run.
Each is safe to run twice.

1. `supabase/staging-multiorg.sql` — the base tables, the access rules and the multi-group migration (it also makes two
   test groups; they are removed in step 5)
2. `supabase/staging-department.sql` — hospitals and the department board
3. `supabase/prod-booking-rpc.sql` — the booking call, the event stream, the 20 s statement limit

## 5. The de-identified copy

### 5a. Export from production (one query, one download)

Production project → **SQL Editor → New query** → paste → Run → in the results panel choose **Export → JSON** and save
the file as `production-export.json` **outside the repository**, for example on the Desktop. This file holds real names
and numbers: treat it like the roster workbook.

```sql
select jsonb_build_object(
  'org_state',      (select coalesce(jsonb_agg(jsonb_build_object('org', org, 'data', data, 'updated', updated)), '[]'::jsonb) from org_state),
  'roster_members', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from roster_members m),
  'orgs',           (select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) from orgs o),
  'hospitals',      (select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) from hospitals h),
  'roster_events',  (select coalesce(jsonb_agg(to_jsonb(e) order by e.seq), '[]'::jsonb) from roster_events e)
) as export;
```

If the editor refuses to export one large cell, run five plain queries instead (`select * from org_state;`,
`select * from roster_members;`, `select * from orgs;`, `select * from hospitals;`, `select * from roster_events order by seq;`),
export each as JSON, and pass all five files to the tool in the next step; it recognises each table by its columns.

### 5b. De-identify

In Terminal, from the repository folder:

```bash
python3 tools/deidentify.py ~/Desktop/production-export.json --out ~/Desktop/myrosta-staging-seed --keep-email YOUR-OWN@EMAIL --admin REVIEWER@EMAIL
```

- `--keep-email` keeps that one address as it is, so the owner can sign in on staging; everyone else becomes
  `pNN@example.test`.
- `--admin` adds the reviewer as an admin of every group on staging (their sign-in is by email code).
- The tool prints a report and refuses to write anything if its residual check finds a real name, email, phone, staff
  id or group slug anywhere in the output. The report names nothing real and is safe to share.

What comes out in `~/Desktop/myrosta-staging-seed`: `staging-seed-00-registry.sql`, one `staging-seed-NN-org-demo-N.sql`
per group, `staging-seed.json` (the same data, for reading) and `deidentify-report.txt`. The export file can then be
deleted or kept with the other personal-data files; it never enters the repository or the staging project.

What the copy keeps: every cycle, assignment, leave block, audit line and booking event, the settings, zones and shift
types, the fixed patterns, the document's size. What it changes: names (synthetic, consistent across groups), initials,
staff ids, emails, mobiles, payroll ids, notes and every human-written message or reason (blanked), calendar tokens and
poster keys (re-minted), the site location and clock taps (a synthetic site), group and hospital names (`demo-N`).

### 5c. Load into staging

Staging project → SQL Editor. Paste and Run, one file at a time, in name order: `staging-seed-00-registry.sql` first,
then each group file. Then remove the test groups the schema step created:

```sql
delete from roster_members where org like 'test-org%';
delete from org_state where org like 'test-org%';
delete from orgs where org like 'test-org%';
```

Check:

```sql
select org, octet_length(data::text) / 1024 as kb, jsonb_array_length(data -> 'staff') as people from org_state order by org;
select org, count(*) from roster_members group by org order by org;
select count(*) filter (where key <> '') as events, count(*) filter (where key = '') as markers from roster_events;
```

## 6. The read-only Postgres login

1. Open `supabase/staging-reviewer.sql`, replace `REPLACE-WITH-A-LONG-RANDOM-PASSWORD` with a generated password, and
   keep that password in the password manager.
2. Staging project → SQL Editor → paste the whole file → Run.
3. **Project Settings → Database → Connection string → Session pooler**: copy it, change the user from `postgres.<ref>`
   to `reviewer.<ref>`, and that string plus the password is what the reviewer gets. The role can read every table and
   write nothing.

## 7. Invite the reviewer to the staging organisation

supabase.com → organisation `Myrosta staging` → **Organization settings → Team → Invite** → the reviewer's email → role
**Developer** (or **Read-only** if the plan offers it). Developer can run SQL and see logs on staging, which is useful
to them and harmless here: the data is synthetic.

## 8. Hand over

Send the reviewer:

- the technical brief (Word) and a pointer to `docs/operations/INCIDENT-2026-10-14-booking-storm.md`
- the log CSVs from step 1
- the staging project's URL and anon key (Project Settings → API), and the line to build their own copy of the app:
  `python3 tools/staging-app.py --url https://<ref>.supabase.co --key <anon key>` writes `.staging/app.html`; opened
  in a browser it talks to staging only, and they sign in with the email code
- the reviewer connection string and password, by a password-manager share or a separate channel from the email
- `deidentify-report.txt`

A short confidentiality line for the covering email: *"The code and the staging data are confidential. The staging
data is synthetic; it holds no real person. Please keep both to your own machines, do not copy them into other
services, and delete them when the review ends. The credentials are personal to you."*

## 9. Afterwards

- Staging SQL editor: `drop owned by reviewer; drop role reviewer;`
- Organisation settings → Team → remove the reviewer; GitHub → the mirror's Collaborators → remove (or delete the mirror).
- Keep the staging project for rehearsals and load tests, or delete it; re-seeding later is steps 5a to 5c again.

## 10. For the reviewer (when they host staging themselves)

Send with the seed folder; it assumes they have the mirror and the brief.

1. Supabase: a free organisation and a project (Sydney to match production; **Authentication → Providers → Email** on
   with confirm email off; Phone off).
2. The three schema files from the repository, in order (`supabase/staging-multiorg.sql`, `supabase/staging-department.sql`,
   `supabase/prod-booking-rpc.sql`), then the seed files in name order (`00` first), then the three delete lines and the
   check queries from 5c. `psql` is the easier route: the live department's seed file is about 420 KB in one statement,
   which a browser editor can struggle with.

```bash
export CONN='postgresql://postgres.<ref>:<password>@<host>:5432/postgres'   # Project Settings → Database → Connection string → URI
for f in supabase/staging-multiorg.sql supabase/staging-department.sql supabase/prod-booking-rpc.sql seed/staging-seed-*.sql; do psql "$CONN" -f "$f"; done
```
3. Make yourself an admin of every group, with your own email:

```sql
insert into roster_members(org, email, role, name)
select org, 'YOU@EXAMPLE.COM', 'admin', 'Reviewer' from orgs
on conflict (org, email) do update set role = 'admin';
```

4. For the app: `python3 tools/staging-app.py --url https://<ref>.supabase.co --key <anon key>`
   writes `.staging/app.html`; open it in a browser and sign in with the email code (Supabase's built-in mailer sends a
   few an hour).
5. A direct Postgres login if you want one: `supabase/staging-reviewer.sql` with its password set, then the Session
   pooler connection string with the user `reviewer.<ref>`.
6. The local harness: `python3 tests/sql/run.py` (a bundled Postgres via uv), `python3 tools/storm.py` (the load test).
   The app suite `python3 tests/run.py` runs on macOS only (it drives JavaScriptCore through osascript).
7. Not in the staging copy, so say so rather than let them wonder: the four Edge Functions are not deployed, so a
   scheduled window will not flip a round by itself and no notices are sent (booking, events, Realtime and the load
   test all work without them); and sign-in codes come from Supabase's built-in mailer, a couple an hour on a new
   project, which their own SMTP under Authentication → Emails removes.
8. The code and the data are confidential; the data is synthetic and holds no real person. Keep both to your own
   machines, do not copy them into other services, and delete them when the review ends.
