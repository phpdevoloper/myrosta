#!/usr/bin/env python3
"""The booking storm, on purpose: a synthetic group tapping at once against roster_commit() on a local PostgreSQL 16.

    python3 tools/storm.py                      # 36 phones, 60 s, the document padded to production size
    python3 tools/storm.py --phones 50 --seconds 90 --quota 14 --no-pad

Boots the same bundled Postgres as tests/sql/run.py (.pgtest, made with uv on first use), applies the stand-ins and
supabase/prod-booking-rpc.sql, seeds ONE synthetic group (synthetic names only), then runs one thread per phone:
each keeps its own view of the roster from the event log (as the app does), taps a zone it believes is open, and
takes the server's answer. Prints throughput, latency and refusals, then checks the invariants on the final document.
Exit code 0 = every invariant held.
"""
import argparse, datetime, json, pathlib, random, statistics, sys, threading, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tests" / "sql"))
import pglocal
pglocal.ensure_venv()
import psycopg
from psycopg.types.json import Json, Jsonb

ROOT = pglocal.ROOT
ap = argparse.ArgumentParser()
ap.add_argument("--phones", type=int, default=36)
ap.add_argument("--seconds", type=int, default=60)
ap.add_argument("--quota", type=int, default=14)
ap.add_argument("--no-pad", action="store_true", help="do not pad the document to production size")
ap.add_argument("--seed", type=int, default=14)
ap.add_argument("--savers", type=int, default=0, help="phones that keep saving the whole document with a compare-and-swap every few seconds, as every open phone did at 10:00 on 16 Oct")
ap.add_argument("--save-gap", type=float, default=8.0, help="seconds between a saver's attempts")
ap.add_argument("--refetchers", type=int, default=0, help="phones that fetch the whole document whenever a save lands")
args = ap.parse_args()
random.seed(args.seed)

ORG, CYC = "storm-org", "cyc-storm"
start = datetime.date.today() + datetime.timedelta(days=(7 - datetime.date.today().weekday()) % 7 or 7)   # next Monday
WEEKS = 8
DAYS = [(start + datetime.timedelta(days=i)).isoformat() for i in range(WEEKS * 7)]
ZONES = [{"id": "z1", "name": "Zone 1", "am": True, "pm": True}, {"id": "z2", "name": "Zone 2", "am": True, "pm": True},
         {"id": "z3", "name": "Zone 3", "am": True, "pm": True}, {"id": "z4", "name": "Zone 4", "am": True, "pm": True},
         {"id": "z5", "name": "Zone 5", "am": False, "pm": False}]   # the fifth zone unticked for round 1, as on the day
STAFFING = {"amMin": 4, "amMax": 4, "pmMin": 4, "pmMax": 4}
staff = [{"id": f"s{i:02d}", "name": f"Staff {i:02d}", "mode": "self", "quota": args.quota} for i in range(1, args.phones + 1)]
doc = {"staff": staff, "zones": ZONES, "staffing": STAFFING, "leave": [], "notifications": [], "messages": [],
       "audit": [{"id": "a0", "ts": 0, "actor": "admin", "action": "seed", "detail": "seed"}],
       "cycles": [{"id": CYC, "cycle": {"start": start.isoformat(), "weeks": WEEKS}, "status": "open", "archived": False,
                   "settings": {"staffing": STAFFING, "zones": ZONES, "shiftTypes": [{"id": "AM", "label": "AM", "fills": ["AM"]}, {"id": "PM", "label": "PM", "fills": ["PM"]}]},
                   "roles": {s["id"]: {"in": True, "quota": args.quota} for s in staff}, "assign": {}}]}
if not args.no_pad:   # the live document on 14 Oct 2026 weighed 596 KB on the wire: 835 audit rows, 516 leave blocks, 98 notifications, a finished cycle, every person's pattern
    doc["audit"] += [{"id": f"apad{i}", "ts": 1760000000000 + i, "actor": "s01", "action": "selfroster.book", "detail": "Staff 01 2026-09-%02d AM Zone 1 — a padding row of the length an audit line has, names and dates and the zone's name, so the document weighs what it weighed on the day it mattered" % (i % 28 + 1)} for i in range(835)]
    doc["leave"] = [{"id": f"L{i}", "staffId": f"s{(i % args.phones) + 1:02d}", "status": "approved", "code": "AL", "from": "2027-%02d-%02d" % (i % 12 + 1, i % 27 + 1), "to": "2027-%02d-%02d" % (i % 12 + 1, i % 27 + 1), "requestId": "import", "ts": 1760000000000 + i, "note": "a padding block, the length of an imported leave block with its note and its ids", "by": "admin", "decidedTs": 1760000000000 + i} for i in range(516)]
    doc["notifications"] = [{"id": f"n{i}", "to": "all", "text": "padding notification number %d, about the length of a real one in the group's log: a name, a date, a zone and a sentence saying what happened and what to do about it" % i, "ts": 1760000000000 + i, "readBy": [f"s{j:02d}" for j in range(1, 1 + i % 20)], "go": {"tab": "my", "cycle": CYC, "anchor": "openshifts"}} for i in range(98)]
    for s in doc["staff"]: s.update({"email": "", "email2": "", "payrollId": "", "title": "", "eft": 1, "hrsFortnight": 76, "periodTargets": {}, "fixedPattern": {"recurrence": "weekly", "A": {}, "B": {}, "committed": False}, "mobile": ""})
    prev = (start - datetime.timedelta(days=WEEKS * 7)).isoformat()
    doc["cycles"].insert(0, {"id": "cyc-prev", "cycle": {"start": prev, "weeks": WEEKS}, "status": "published", "archived": True, "settings": doc["cycles"][0]["settings"],
                             "roles": doc["cycles"][0]["roles"], "assign": {f"{s['id']}|{(datetime.date.fromisoformat(prev) + datetime.timedelta(days=d)).isoformat()}": {"kind": "clinical", "period": "AM" if (d + i) % 2 else "PM", "zone": ZONES[(d + i) % 4]["id"]} for i, s in enumerate(staff) for d in range(WEEKS * 7) if (d + i) % 3}})

srv = pglocal.server()
uri = pglocal.fresh_db(srv, "myrosta_storm")
with psycopg.connect(uri, autocommit=True) as c:
    c.execute((ROOT / "tests" / "sql" / "standins.sql").read_text(encoding="utf-8"))
    c.execute((ROOT / "supabase" / "prod-booking-rpc.sql").read_text(encoding="utf-8"))
    c.execute("insert into org_state(org, data, updated) values (%s, %s, now())", (ORG, Jsonb(doc)))
    for s in staff:
        c.execute("insert into roster_members(org, email, role, name) values (%s, %s, 'staff', %s)", (ORG, f"{s['id']}@example.org", s["name"]))
    size = c.execute("select octet_length(data::text) from org_state where org = %s", (ORG,)).fetchone()[0]
print(f"phones {args.phones} · cycle {DAYS[0]} to {DAYS[-1]} · cap {STAFFING['amMax']} AM + {STAFFING['pmMax']} PM over {sum(1 for z in ZONES if z['am'])} zones · document {size / 1024:.0f} KB on the wire · {args.seconds} s")

lat, results, lock = [], [], threading.Lock()
go = threading.Event()


class Phone(threading.Thread):
    def __init__(self, s):
        super().__init__(daemon=True); self.s = s; self.view = {}; self.seq = 0; self.mine = 0; self.calls = 0

    def catch_up(self, c):
        rows = c.execute("select seq, key, val from roster_events where org = %s and seq > %s order by seq", (ORG, max(0, self.seq - 50))).fetchall()
        for seq, key, val in rows:
            self.seq = max(self.seq, seq)
            if val is None: self.view.pop(key, None)
            else: self.view[key] = val

    def free_chips(self):
        taken = {}
        for key, v in self.view.items():
            day = key.split("|")[1]
            taken.setdefault(day, {"AM": set(), "PM": set(), "me": False})
            taken[day][v["period"]].add(v["zone"])
            if key.startswith(self.s["id"] + "|"): taken[day]["me"] = True
        out = []
        for day in DAYS:
            t = taken.get(day, {"AM": set(), "PM": set(), "me": False})
            if t["me"]: continue
            for half in ("AM", "PM"):
                if len(t[half]) >= STAFFING[half.lower() + "Max"]: continue
                for z in ZONES:
                    if z[half.lower()] and z["id"] not in t[half]: out.append((day, half, z["id"]))
        return out

    def run(self):
        go.wait()
        with psycopg.connect(uri, autocommit=True) as c:
            c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps({"email": f"{self.s['id']}@example.org"}),))
            deadline = time.time() + args.seconds
            while time.time() < deadline and self.mine < args.quota:
                self.catch_up(c)
                chips = self.free_chips()
                if not chips: break
                day, half, zone = random.choice(chips)
                op = {"op": "book", "sid": self.s["id"], "day": day, "period": half, "zone": zone}
                t0 = time.perf_counter()
                try:
                    r = c.execute("select roster_commit(%s, %s, %s)", (ORG, CYC, Jsonb([op]))).fetchone()[0]
                    res = r["results"][0]; ok = res["ok"]; reason = None if ok else res["reason"]
                    if ok: self.view[res["key"]] = res["val"]; self.seq = max(self.seq, res["seq"]); self.mine += 1
                except Exception as e:
                    ok, reason = False, "ERROR " + str(e).splitlines()[0]
                dt = time.perf_counter() - t0; self.calls += 1
                with lock: lat.append(dt); results.append((ok, reason))
                time.sleep(random.uniform(0.05, 0.4))   # a person looking at the next chip


saver_stats = {"attempts": 0, "wins": 0, "lat": []}
refetch_stats = {"gets": 0, "lat": []}
stop = threading.Event()


class Saver(threading.Thread):   # a phone saving the whole document the old way: read, change a flag, write with a compare-and-swap, retry on a lost swap
    def run(self):
        go.wait()
        with psycopg.connect(uri, autocommit=True) as c:
            c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps({"email": "s01@example.org"}),))
            while not stop.is_set():
                t0 = time.perf_counter()
                try:
                    row = c.execute("select data, updated from org_state where org = %s", (ORG,)).fetchone()
                    doc, upd = row[0], row[1]
                    doc["audit"].insert(0, {"id": "a%d" % time.time_ns(), "ts": int(time.time() * 1000), "actor": "admin", "action": "selfroster.schedule", "detail": "a saver's whole-document write"})
                    n = c.execute("update org_state set data = %s, updated = clock_timestamp() where org = %s and updated = %s returning updated", (Jsonb(doc), ORG, upd)).rowcount
                    with lock:
                        saver_stats["attempts"] += 1; saver_stats["lat"].append(time.perf_counter() - t0)
                        if n: saver_stats["wins"] += 1
                except Exception as e:
                    with lock: saver_stats["attempts"] += 1; results.append((False, "SAVER ERROR " + str(e).splitlines()[0]))
                stop.wait(args.save_gap * random.uniform(0.7, 1.3))


class Refetcher(threading.Thread):   # a phone that answers every ping with a whole-document fetch
    def run(self):
        go.wait(); last = 0
        with psycopg.connect(uri, autocommit=True) as c:
            c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps({"email": "s02@example.org"}),))
            while not stop.is_set():
                try:
                    mk = c.execute("select max(seq) from roster_events where org = %s and key = ''", (ORG,)).fetchone()[0] or 0
                    if mk > last:
                        last = mk; t0 = time.perf_counter(); c.execute("select data from org_state where org = %s", (ORG,)).fetchone()
                        with lock: refetch_stats["gets"] += 1; refetch_stats["lat"].append(time.perf_counter() - t0)
                except Exception as e:
                    with lock: results.append((False, "REFETCH ERROR " + str(e).splitlines()[0]))
                stop.wait(random.uniform(0.3, 2.5))


phones = [Phone(s) for s in staff]
extras = [Saver(daemon=True) for _ in range(args.savers)] + [Refetcher(daemon=True) for _ in range(args.refetchers)]
for p in phones + extras: p.start()
t_start = time.time(); go.set()
for p in phones: p.join(args.seconds + 30)
stop.set(); elapsed = time.time() - t_start
for p in extras: p.join(5)

accepted = sum(1 for ok, _ in results if ok)
refused = {}
for ok, why in results:
    if not ok: refused[why] = refused.get(why, 0) + 1
lat_s = sorted(lat)
pct = lambda q: lat_s[min(len(lat_s) - 1, int(q * len(lat_s)))] * 1000 if lat_s else 0
print(f"calls {len(results)} in {elapsed:.1f} s = {len(results) / max(elapsed, 1e-9):.1f}/s · accepted {accepted} · refused {len(results) - accepted}")
print(f"latency ms: p50 {pct(0.5):.0f} · p95 {pct(0.95):.0f} · p99 {pct(0.99):.0f} · max {pct(1.0):.0f} · mean {statistics.mean(lat) * 1000 if lat else 0:.0f}")
for why, n in sorted(refused.items(), key=lambda x: -x[1]): print(f"  refused {n:4d} × {why}")
if args.savers:
    sl = sorted(saver_stats["lat"]); sp = lambda q: sl[min(len(sl) - 1, int(q * len(sl)))] * 1000 if sl else 0
    print(f"savers {args.savers}: {saver_stats['attempts']} whole-document attempts, {saver_stats['wins']} landed · attempt p50 {sp(0.5):.0f} ms · p95 {sp(0.95):.0f} ms")
if args.refetchers:
    rl = sorted(refetch_stats["lat"]); rp = lambda q: rl[min(len(rl) - 1, int(q * len(rl)))] * 1000 if rl else 0
    print(f"refetchers {args.refetchers}: {refetch_stats['gets']} whole-document fetches · fetch p50 {rp(0.5):.0f} ms · p95 {rp(0.95):.0f} ms")

# the invariants on what the database holds now
with psycopg.connect(uri, autocommit=True) as c:
    final = c.execute("select data from org_state where org = %s", (ORG,)).fetchone()[0]
    nev = c.execute("select count(*) from roster_events where org = %s and key <> ''", (ORG,)).fetchone()[0]   # the seed's marker row is not a booking
assign = next(c for c in final["cycles"] if c["id"] == CYC)["assign"]
per_day = {}
bad = []
for key, v in assign.items():
    sid, day = key.split("|")
    d = per_day.setdefault(day, {"AM": {}, "PM": {}, "people": set()})
    if sid in d["people"]: bad.append(f"{sid} twice on {day}")
    d["people"].add(sid)
    if v["zone"] in d[v["period"]]: bad.append(f"zone {v['zone']} double-booked {day} {v['period']}: {d[v['period']][v['zone']]} and {sid}")
    d[v["period"]][v["zone"]] = sid
    if not next(z for z in ZONES if z["id"] == v["zone"])[v["period"].lower()]: bad.append(f"zone {v['zone']} not open {day} {v['period']}")
for day, d in per_day.items():
    for half in ("AM", "PM"):
        if len(d[half]) > STAFFING[half.lower() + "Max"]: bad.append(f"{day} {half} over the maximum: {len(d[half])}")
if accepted == 0: bad.append("nothing was accepted — the call itself failed")
if nev != accepted: bad.append(f"event rows {nev} != accepted calls {accepted}")
if len(assign) != accepted: bad.append(f"shifts in the document {len(assign)} != accepted calls {accepted}")
if not args.savers and len(final["audit"]) != min(400, len(doc["audit"]) + accepted): bad.append(f"audit rows {len(final['audit'])} != {min(400, len(doc['audit']) + accepted)}")   # the call keeps the newest 400 lines
over = [p.s["id"] for p in phones if p.mine > args.quota]
if over: bad.append(f"over quota (a phone-side rule, so the storm honours it): {over}")
print(f"document: {len(assign)} shifts over {len(per_day)} days · {nev} event rows · audit {len(final['audit'])} rows · phones at quota {sum(1 for p in phones if p.mine >= args.quota)}/{len(phones)}")
for b in bad: print("FAIL ", b)
print("PASS  every invariant held" if not bad else f"{len(bad)} invariant(s) broken")
sys.exit(1 if bad else 0)
