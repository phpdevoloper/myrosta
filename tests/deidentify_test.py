#!/usr/bin/env python3
"""tools/deidentify.py must leave nothing identifying behind and keep the document's shape.

    python3 tests/deidentify_test.py          # the in-memory checks (fast)
    python3 tests/deidentify_test.py --pg     # also loads the generated SQL into the local Postgres harness

The fixture below is a fake production export: every name, email, phone, staff id and group slug in it is
invented for this test and plays the part of real data. The assertions treat them as secrets.
"""
import copy, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import deidentify  # noqa: E402

# ---- the "real" people of the fixture (secrets) ----
P1 = dict(name="Quill, Zebedee", first="Zebedee", last="Quill", email="zebedee.quill@gmail.com", mobile="0412 345 678",
          sid="quill-zebedee-1725000000000123", initials="ZQ")
P2 = dict(name="Vantablack, Orla", first="Orla", last="Vantablack", email="orla.v@hospital.org.au", mobile="+61 400 111 222",
          sid="vantablack-orla-1725000000001456", initials="OV")
P3 = dict(name="Zinn-Tao, Kwame", first="Kwame", last="Zinn-Tao", email="", mobile="",
          sid="zinn-tao-kwame-1725000000002789", initials="KZ")
PEOPLE = [P1, P2, P3]
OWNER = "owner@example.com"          # the owner signs in on staging with their real email: kept, never mapped
ENGINEER = "engineer@example.com"    # added as an admin on every group
REAL_ORG, REAL_ORG2 = "mercy-ed", "mercy-nurses"
REAL_HOSP_ID, REAL_HOSP = "mercy", "Mercy Hospital Werribee"
REAL_LAT, REAL_LNG = -37.8999, 144.6611
ENDPOINT = "https://fcm.googleapis.com/fcm/send/dEvIcE-tOkEn-123"
NOTE = "has a bad knee, avoid nights"
REASON = "daughter's school concert"
COMMENT = "can we swap, I owe you one"
IMPORT_FILE = "roster from Zebedee Quill.xlsx"


def staff_row(p):
    return {"id": p["sid"], "name": p["name"], "initials": p["initials"], "mobile": p["mobile"], "email": p["email"], "email2": "",
            "mode": "self", "quota": 14, "eft": 1, "hrsFortnight": 76, "payrollId": "E" + p["sid"][-4:], "title": "Consultant",
            "notes": NOTE, "tags": ["senior"], "icsToken": "ab" * 18, "periodTargets": {},
            "fixedPattern": {"recurrence": "weekly", "A": {}, "B": {}, "committed": False}}


def doc_for(people, cyc="cyc-1"):
    staff = people
    people = (people * 3)[:3]   # a one-person group reuses that person wherever the fixture needs three
    sids = [p["sid"] for p in people]
    assign = {f"{sids[0]}|2026-11-23": {"kind": "clinical", "period": "AM", "zone": "z1"},
              f"{sids[1]}|2026-11-23": {"kind": "clinical", "period": "PM", "zone": "z2", "note": "swapped with " + people[0]["first"]},
              f"{sids[2]}|2026-11-24": {"kind": "clinical", "period": "AM", "zone": "z1"}}
    return {
        "staff": [staff_row(p) for p in staff],
        "zones": [{"id": "z1", "name": "Resus"}, {"id": "z2", "name": "Acute"}],
        "staffing": {"amMin": 4, "amMax": 4, "pmMin": 4, "pmMax": 4},
        "cycles": [{"id": cyc, "cycle": {"start": "2026-11-23", "weeks": 8}, "status": "open", "archived": False,
                    "settings": {"staffing": {"amMin": 4, "amMax": 4, "pmMin": 4, "pmMax": 4},
                                 "zones": [{"id": "z1", "name": "Resus", "am": True, "pm": True}, {"id": "z2", "name": "Acute", "am": True, "pm": True}]},
                    "roles": {s: {"in": True, "quota": 14} for s in sids}, "assign": assign,
                    "oncall": {"2026-11-23": sids[0]},
                    "callins": {"ci1": {"sid": sids[1], "phone": people[1]["mobile"], "email": people[1]["email"], "name": people[1]["name"],
                                        "reason": REASON, "answered": True}},
                    "clock": {sids[0]: [{"t": 1760000000000, "lat": REAL_LAT, "lng": REAL_LNG, "acc": 12, "note": NOTE}]},
                    "clockDec": {"d1": {"sid": sids[0], "ok": True, "note": NOTE}},
                    "statusLog": [{"ts": 1760000000000, "status": "open", "by": sids[0]}],
                    "window": {"open": "2026-10-16T10:00", "enabled": True}}],
        "leave": [{"id": "lv1", "staffId": sids[2], "status": "approved", "code": "AL", "from": "2026-12-01", "to": "2026-12-05",
                   "note": NOTE, "by": sids[0], "reason": REASON}],
        "audit": [{"id": "a1", "ts": 1760000000000, "actor": sids[0], "action": "selfroster.book",
                   "detail": f"{people[0]['name']} booked 23 Nov AM Resus ({people[0]['first']} {people[0]['last']}) for {sids[0]}"},
                  {"id": "a2", "ts": 1760000000001, "actor": "admin", "action": "staff.add", "detail": people[2]["name"]}],
        "notifications": [{"id": "n1", "to": "all", "text": f"{people[1]['first']} {people[1]['last']} gave away 23 Nov PM; call {people[1]['mobile']} or {people[1]['email']}",
                           "ts": 1760000000000, "readBy": [sids[0], sids[2]], "go": {"tab": "my", "cycle": cyc, "anchor": "openshifts"}}],
        "messages": [{"id": "m1", "text": COMMENT}],
        "feedback": [{"id": "f1", "text": COMMENT, "by": sids[1]}],
        "requests": [{"id": "r1", "sid": sids[1], "kind": "leave", "reason": REASON, "status": "pending"}],
        "reqComments": [{"id": "c1", "req": "r1", "by": sids[0], "text": COMMENT}],
        "openShifts": [{"id": "o1", "sid": sids[1], "iso": "2026-11-23", "period": "PM", "zone": "z2", "status": "open", "note": COMMENT}],
        "openSwaps": [{"id": "sw1", "sid": sids[1], "msg": COMMENT}],
        "swapOffers": [{"id": "so1", "ask": "sw1", "sid": sids[2], "message": COMMENT}],
        "outbox": [{"id": "ob1", "kind": "invite", "sid": sids[0], "phone": people[0]["mobile"], "email": people[0]["email"],
                    "subject": "your roster", "body": "Hi " + people[0]["first"], "ts": 1760000000000, "sent": None}],
        "pushSubs": [{"sid": sids[0], "endpoint": ENDPOINT, "keys": {"p256dh": "K1", "auth": "A1"}}],
        "ownHours": [{"id": "h1", "sid": sids[2], "day": "2026-11-24", "start": "08:00", "end": "17:00", "note": NOTE}],
        "site": {"lat": REAL_LAT, "lng": REAL_LNG, "acc": 20, "setAt": 1760000000000, "radius": 250, "posterKey": "ABCDEFGHJKLMNPQR", "name": "Mercy ED main entrance"},
        "branding": {"name": "Mercy ED consultants", "hospital": REAL_HOSP, "roleNoun": "consultant"},
        "lastImport": {"roster": {"file": IMPORT_FILE, "ts": 1760000000000}},
        "tags": [{"id": "senior", "label": "Senior"}],
        "viewAs": sids[0], "tab": "my", "activeId": cyc, "timezone": "Australia/Melbourne", "_privacyV1": True,
    }


def make_export():
    return {
        "org_state": [{"org": REAL_ORG, "data": doc_for(PEOPLE), "updated": "2026-10-20T02:00:00+00:00"},
                      {"org": REAL_ORG2, "data": doc_for([P2], cyc="cyc-n"), "updated": "2026-10-19T02:00:00+00:00"}],
        "roster_members": [
            {"org": REAL_ORG, "email": P1["email"], "role": "admin", "name": P1["name"], "phone": P1["mobile"]},
            {"org": REAL_ORG, "email": P2["email"], "role": "staff", "name": P2["name"], "phone": P2["mobile"]},
            {"org": REAL_ORG, "email": "kwame.zt@outlook.com", "role": "staff", "name": P3["name"], "phone": None},
            {"org": REAL_ORG, "email": OWNER, "role": "admin", "name": "Owner", "phone": None},
            {"org": REAL_ORG2, "email": P2["email"], "role": "admin", "name": P2["name"], "phone": P2["mobile"]},
        ],
        "orgs": [{"org": REAL_ORG, "label": "Mercy ED consultants", "hospital": REAL_HOSP, "hospital_id": REAL_HOSP_ID},
                 {"org": REAL_ORG2, "label": "Mercy ED nurses", "hospital": REAL_HOSP, "hospital_id": REAL_HOSP_ID}],
        "hospitals": [{"id": REAL_HOSP_ID, "name": REAL_HOSP}],
        "roster_events": [
            {"seq": 1, "org": REAL_ORG, "ts": "2026-10-14T00:01:00+00:00", "cycle": "cyc-1", "key": f"{P1['sid']}|2026-11-23",
             "val": {"kind": "clinical", "period": "AM", "zone": "z1"},
             "audit": {"id": "e1", "ts": 1760000000000, "actor": P1["sid"], "action": "selfroster.book", "detail": f"{P1['name']} booked 23 Nov AM Resus"}},
            {"seq": 2, "org": REAL_ORG, "ts": "2026-10-14T00:01:01+00:00", "cycle": "", "key": "", "val": None, "audit": None},   # a marker row
            {"seq": 3, "org": REAL_ORG, "ts": "2026-10-14T00:01:02+00:00", "cycle": "cyc-1", "key": f"{P1['sid']}|2026-11-23", "val": None,
             "audit": {"id": "e3", "ts": 1760000000002, "actor": P1["sid"], "action": "selfroster.unbook", "detail": f"{P1['first']} removed 23 Nov AM"}},
        ],
    }


SECRETS = (
    [p["name"] for p in PEOPLE] + [p["first"] for p in PEOPLE] + [p["last"] for p in PEOPLE] + [p["sid"] for p in PEOPLE]
    + [p["email"] for p in PEOPLE if p["email"]] + ["kwame.zt@outlook.com", "0412345678", "61400111222", "0412 345 678", "400 111 222"]
    + [REAL_ORG, REAL_ORG2, REAL_HOSP, "Werribee", ENDPOINT, NOTE, REASON, COMMENT, IMPORT_FILE, "Mercy", str(REAL_LAT), str(REAL_LNG), "ab" * 18]
)

fails = []


def check(cond, what):
    (print("PASS " + what) if cond else (fails.append(what), print("FAIL " + what)))


def main():
    export = make_export()
    before = copy.deepcopy(export)
    res = deidentify.deidentify(export, admins=[ENGINEER], keep_emails=[OWNER], seed=3)
    check(export == before, "the input is not modified")
    check(res.residuals == [], "the tool's own residual check finds nothing: " + "; ".join(res.residuals[:5]))

    blob = json.dumps(res.tables, sort_keys=True) + "\n" + "\n".join(res.sql_files.values()) + "\n" + res.report
    low = blob.lower()
    leaked = [s for s in SECRETS if s.lower() in low]
    check(not leaked, "no fixture secret survives anywhere in the JSON, the SQL or the report: " + ", ".join(leaked[:6]))
    check(not re.search(r"[A-Za-z0-9._%+-]+@(?!example\.test\b|example\.com\b)[A-Za-z0-9.-]+\.[a-z]{2,}", blob),
          "every email left is @example.test (or a kept one)")
    check(not re.search(r"(?<![\d-])(?:\+?61|0)4\d{2}[ -]?\d{3}[ -]?\d{3}(?!\d)", blob), "no Australian mobile number is left")

    t = res.tables
    orgs = [r["org"] for r in t["org_state"]]
    check(len(t["org_state"]) == 2 and all(o.startswith("demo-") for o in orgs), "two groups, renamed demo-N: " + ", ".join(orgs))
    d = next(r["data"] for r in t["org_state"] if r["org"] == orgs[0])
    d2 = next(r["data"] for r in t["org_state"] if r["org"] == orgs[1])
    ids = [s["id"] for s in d["staff"]]
    check(len(d["staff"]) == 3 and len(set(ids)) == 3 and all(re.fullmatch(r"p\d{2}", i) for i in ids), "three staff with fresh ids p01 style: " + ", ".join(ids))
    names = [s["name"] for s in d["staff"]]
    check(all("," in n for n in names) and len(set(names)) == 3, "names stay in 'Last, First' form and are unique: " + ", ".join(names))
    check(all(s["initials"] == deidentify.initials_of(s["name"]) for s in d["staff"]), "initials are regenerated from the synthetic names")
    check(all(re.fullmatch(r"[0-9a-f]{36}", s["icsToken"]) and s["icsToken"] != "ab" * 18 for s in d["staff"]), "calendar tokens are fresh 36-hex secrets")
    check(all(s["email"].endswith("@example.test") and s["mobile"] == "" and s["notes"] == "" and s["payrollId"] == "" for s in d["staff"]),
          "staff emails are synthetic, mobiles, notes and payroll ids blank")
    check(all(s["title"] == "Consultant" and s["tags"] == ["senior"] and s["quota"] == 14 for s in d["staff"]), "titles, tags and quotas are kept")

    cyc = d["cycles"][0]
    akeys = list(cyc["assign"].keys())
    check(len(akeys) == 3 and all(k.split("|")[0] in ids for k in akeys), "assignment keys carry the new ids: " + ", ".join(akeys))
    check(set(cyc["roles"].keys()) == set(ids), "cycle roles are keyed by the new ids")
    check(cyc["oncall"]["2026-11-23"] in ids and cyc["statusLog"][0]["by"] in ids, "on-call and status log point at new ids")
    check(d["leave"][0]["staffId"] in ids and d["leave"][0]["note"] == "" and d["leave"][0]["reason"] == "", "leave keeps its person, loses its note")
    check(d["audit"][0]["actor"] in ids and d["staff"][0]["name"] in d["audit"][0]["detail"] and ids[0] in d["audit"][0]["detail"],
          "audit text carries the synthetic name and id of the same person")
    s2 = d["staff"][1]
    ntext = d["notifications"][0]["text"]
    check(s2["name"].split(", ")[1] in ntext and s2["name"].split(", ")[0] in ntext and s2["email"] in ntext and "[phone]" in ntext,
          "notification text maps first and last names and the email, and blanks the phone: " + ntext)
    check(set(d["notifications"][0]["readBy"]) <= set(ids), "readBy lists carry new ids")
    check(d["outbox"] == [] and d["pushSubs"] == [] and d["messages"] == [] and d["feedback"] == [] and d["lastImport"] == {},
          "outbox, push subscriptions, messages, feedback and the import memory are emptied")
    check("viewAs" not in d and "tab" not in d, "device-local fields are dropped")
    check(d["reqComments"][0]["text"] == "" and d["requests"][0]["reason"] == "" and d["openShifts"][0]["note"] == ""
          and d["openSwaps"][0]["msg"] == "" and d["swapOffers"][0]["message"] == "" and d["ownHours"][0]["note"] == "",
          "human free text is blanked wherever it lives")
    ci = cyc["callins"]["ci1"]
    check(ci["phone"] == "" and ci["email"].endswith("@example.test") and ci["name"] == s2["name"] and ci["reason"] == "" and ci["sid"] == s2["id"],
          "call-in records lose contact details and keep the mapped person")
    ck = cyc["clock"][ids[0]][0]
    check(ck["lat"] == deidentify.SITE_LAT and ck["lng"] == deidentify.SITE_LNG and ck["note"] == "" and ck["t"] == 1760000000000,
          "clock taps move to the synthetic site and lose their notes")
    check(cyc["clockDec"]["d1"]["sid"] == ids[0] and cyc["clockDec"]["d1"]["note"] == "", "clock decisions follow the person and lose notes")
    check(d["site"]["lat"] == deidentify.SITE_LAT and d["site"]["posterKey"] != "ABCDEFGHJKLMNPQR" and len(d["site"]["posterKey"]) == 16
          and d["site"]["name"] == "Demo site", "the site is synthetic with a fresh poster key")
    check(d["branding"]["name"].startswith("Demo") and d["branding"]["hospital"].startswith("Demo") and d["branding"]["roleNoun"] == "consultant",
          "branding is renamed, the role noun kept")
    check(d["activeId"] == "cyc-1" and d["timezone"] == "Australia/Melbourne" and d["zones"][0]["name"] == "Resus", "cycle ids, timezone and zone names are untouched")
    check(cyc["assign"][akeys[1]]["note"] == "", "a note inside an assignment is blanked")
    # the same real person in two groups is the same synthetic person
    check(d2["staff"][0]["name"] == s2["name"] and d2["staff"][0]["id"] == s2["id"], "one person, one synthetic identity across groups")

    m = t["roster_members"]
    o1 = [r for r in m if r["org"] == orgs[0]]
    check(any(r["email"] == OWNER and r["role"] == "admin" for r in o1), "the owner's kept email stays as admin")
    check(all(any(r["email"] == ENGINEER and r["role"] == "admin" for r in m if r["org"] == o) for o in orgs), "the engineer is an admin on every group")
    s2m = [r for r in o1 if r["name"] == s2["name"]]
    check(len(s2m) == 1 and s2m[0]["email"] == s2["email"] and s2m[0]["phone"] is None and s2m[0]["role"] == "staff",
          "a member row maps to the same synthetic person as the staff row, phone gone")
    check(all(r["phone"] is None for r in m) and all(r["email"] == OWNER or r["email"] == ENGINEER or r["email"].endswith("@example.test") for r in m),
          "member phones are null and emails synthetic")
    check(sorted(r["org"] for r in t["orgs"]) == sorted(orgs) and all(r["hospital_id"].startswith("demo") for r in t["orgs"])
          and all(h["name"].startswith("Demo") for h in t["hospitals"]), "orgs and hospitals are renamed")

    ev = t["roster_events"]
    check(len(ev) == 2 and all(e["org"] == orgs[0] for e in ev) and all(e["key"].split("|")[0] == ids[0] for e in ev), "marker rows dropped, event keys carry the new id")
    check(ev[0]["val"] == {"kind": "clinical", "period": "AM", "zone": "z1"} and ev[1]["val"] is None, "event values are kept, including the null of an unbook")
    check(d["staff"][0]["name"] in ev[0]["audit"]["detail"] and ev[0]["audit"]["actor"] == ids[0], "event audit text is mapped")

    sqls = res.sql_files
    check(any("registry" in k for k in sqls) and sum(1 for k in sqls if "-org-" in k) == 2, "one registry file and one file per group: " + ", ".join(sorted(sqls)))
    reg = next(v for k, v in sqls.items() if "registry" in k)
    check("insert into hospitals" in reg and "insert into orgs" in reg and "insert into roster_members" in reg and OWNER in reg, "the registry file seeds hospitals, orgs and members")
    org_sql = next(v for k, v in sqls.items() if k.endswith(orgs[0] + ".sql"))
    check("insert into roster_events" in org_sql and "insert into org_state" in org_sql and org_sql.index("roster_events") < org_sql.index("into org_state"),
          "a group file inserts its events before its document (so the marker is newest)")
    check("delete from org_state where org = '" + orgs[0] + "'" in org_sql and not re.search(r"delete from \w+;", org_sql) and "truncate" not in org_sql.lower(),
          "a group file replaces only its own rows")
    tag = re.search(r"\$([a-z0-9_]+)\$", org_sql).group(1)
    check(("$" + tag + "$") not in json.dumps(d), "the dollar-quote tag does not occur in the document")

    res2 = deidentify.deidentify(make_export(), admins=[ENGINEER], keep_emails=[OWNER], seed=3)
    check(json.dumps(res2.tables, sort_keys=True) == json.dumps(res.tables, sort_keys=True) and all(k not in res.sql_files or res.sql_files[k] == res2.sql_files[k] for k in res2.sql_files),
          "the same input and seed give the same output")
    check("4 people" in res.report and "2 groups" in res.report and not any(s.lower() in res.report.lower() for s in SECRETS),
          "the report counts (three on rosters plus one member-only) and names nothing real")

    # a leak must be caught: a real name smuggled into a field the structural pass does not know
    bad = make_export()
    bad["org_state"][0]["data"]["cycles"][0]["settings"]["motto"] = "Ask " + P1["first"] + " " + P1["last"]
    r3 = deidentify.deidentify(bad, admins=[], keep_emails=[OWNER], seed=3)
    check(r3.residuals == [] and P1["last"].lower() not in json.dumps(r3.tables).lower(), "a name in an unknown field is still replaced by the text pass")
    bad2 = make_export()
    bad2["org_state"][0]["data"]["cycles"][0]["settings"]["ref"] = "see " + REAL_HOSP
    r4 = deidentify.deidentify(bad2, admins=[], keep_emails=[OWNER], seed=3)
    check(r4.residuals == [] and "werribee" not in json.dumps(r4.tables).lower(), "a hospital name in an unknown field is replaced too")
    # CSV and list-wrapped exports are accepted
    wrapped = [{"export": make_export()}]
    r5 = deidentify.deidentify(deidentify.unwrap(wrapped), admins=[], keep_emails=[OWNER], seed=3)
    check(json.dumps(r5.tables, sort_keys=True) == json.dumps(deidentify.deidentify(make_export(), admins=[], keep_emails=[OWNER], seed=3).tables, sort_keys=True),
          "a list-wrapped dashboard export unwraps to the same result")

    # the five per-table downloads, as JSON lists and as the dashboard's CSV, merge to the same export
    import csv, io, tempfile
    ex = make_export()
    files = []
    with tempfile.TemporaryDirectory() as td:
        def csv_of(rows):
            cols = list(rows[0].keys())
            buf = io.StringIO(); w = csv.DictWriter(buf, fieldnames=cols); w.writeheader()
            for r in rows:
                w.writerow({k: (json.dumps(v) if isinstance(v, (dict, list)) else ("" if v is None else v)) for k, v in r.items()})
            return buf.getvalue()
        for name, text in (("org_state.json", json.dumps(ex["org_state"])), ("roster_members.csv", csv_of(ex["roster_members"])),
                           ("orgs.json", json.dumps(ex["orgs"])), ("hospitals.csv", csv_of(ex["hospitals"])), ("roster_events.csv", csv_of(ex["roster_events"]))):
            p = pathlib.Path(td) / name; p.write_text(text, encoding="utf-8"); files.append(str(p))
        merged = deidentify.load_inputs(files)
        one = deidentify.load_inputs([str(pathlib.Path(td) / "all.json")]) if (pathlib.Path(td) / "all.json").write_text(json.dumps([{"export": ex}]), encoding="utf-8") else None
    r6 = deidentify.deidentify(merged, admins=[ENGINEER], keep_emails=[OWNER], seed=3)
    r7 = deidentify.deidentify(one, admins=[ENGINEER], keep_emails=[OWNER], seed=3)
    check(sorted(merged.keys()) == sorted(ex.keys()) and len(merged["roster_events"]) == 3 and merged["roster_events"][1]["val"] is None
          and merged["roster_events"][0]["seq"] == 1 and isinstance(merged["org_state"][0]["data"], dict),
          "five per-table downloads (JSON and CSV) merge back into one export with types restored")
    check(json.dumps(r6.tables, sort_keys=True) == json.dumps(res.tables, sort_keys=True) == json.dumps(r7.tables, sort_keys=True),
          "the merged export and the one-cell export de-identify to the same result")

    if "--pg" in sys.argv:
        pg_round_trip(res)

    print(f"\ndeidentify: {len(fails)} failed")
    if not fails:
        print("selftest ok")
    sys.exit(1 if fails else 0)


def pg_round_trip(res):
    """Load the generated SQL into the local harness (stand-ins + the production booking SQL) and book one shift on it."""
    sys.path.insert(0, str(ROOT / "tests" / "sql"))
    import pglocal
    pglocal.ensure_venv()
    import psycopg
    srv = pglocal.server()
    uri = pglocal.fresh_db(srv, "myrosta_deid")
    with psycopg.connect(uri, autocommit=True) as c:
        c.execute((ROOT / "tests" / "sql" / "standins.sql").read_text(encoding="utf-8"))
        c.execute((ROOT / "supabase" / "prod-booking-rpc.sql").read_text(encoding="utf-8"))
        for name in sorted(res.sql_files):
            c.execute(res.sql_files[name])
        n_state = c.execute("select count(*) from org_state").fetchone()[0]
        n_mem = c.execute("select count(*) from roster_members").fetchone()[0]
        n_ev = c.execute("select count(*) from roster_events where key <> ''").fetchone()[0]
        n_mark = c.execute("select count(*) from roster_events where key = ''").fetchone()[0]
        check(n_state == 2 and n_mem == len(res.tables["roster_members"]) and n_ev == 2 and n_mark == 2,
              f"the SQL loads into Postgres: {n_state} documents, {n_mem} members, {n_ev} events, {n_mark} markers")
        org = res.tables["org_state"][0]["org"]
        sid = res.tables["org_state"][0]["data"]["staff"][2]["id"]
        c.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps({"email": "p01@example.test", "role": "authenticated"}),))
        c.execute("insert into roster_members(org, email, role, name) values (%s, 'p01@example.test', 'admin', 'tester') on conflict do nothing", (org,))
        from psycopg.types.json import Jsonb
        r = c.execute("select roster_commit(%s, 'cyc-1', %s)", (org, Jsonb([{"op": "book", "sid": sid, "day": "2026-11-25", "period": "AM", "zone": "z1"}]))).fetchone()[0]
        check(r.get("ok") and r["results"][0]["ok"], "a booking lands on the seeded document through roster_commit: " + json.dumps(r)[:160])


if __name__ == "__main__":
    main()
