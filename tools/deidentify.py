#!/usr/bin/env python3
"""De-identify a Myrosta production export into SQL for a STAGING database (never the other way round).

    python3 tools/deidentify.py production-export.json --out ~/Desktop/myrosta-staging-seed \
        --keep-email you@example.com --admin engineer@example.com

Input: the result of the export query in docs/operations/STAGING-RUNBOOK.md — one JSON object with org_state, roster_members,
orgs, hospitals and roster_events (the dashboard's JSON or CSV download of that one-row result is accepted as is).

Output (in --out): one SQL file for the registry (hospitals, orgs, members), one SQL file per group (its events and
its document), the scrubbed data as JSON, and a report that counts what changed without naming anything real.

What changes: every person gets a synthetic identity (name, initials, id, email); mobiles, payroll ids, personal notes
and every human-written note, reason or message are blanked; outbox, push subscriptions, messages and feedback are
emptied; calendar tokens and poster keys are re-minted; the site and every clock tap move to a synthetic location;
groups and hospitals are renamed demo-N. Then a text pass rewrites every string value so a name, email, phone, staff
id, group slug or hospital name cannot survive in free text, and a residual check proves it before anything is written.
Zone names, shift types, settings, dates, cycles, assignments, leave codes and the audit/event structure are kept, so
the staging copy weighs and behaves like production.

Exit code 0 only when the residual check found nothing.
"""
import argparse, csv, datetime, io, json, pathlib, random, re, sys

csv.field_size_limit(min(sys.maxsize, 2 ** 31 - 1))   # a document is one CSV cell of half a megabyte or more
SITE_LAT, SITE_LNG = -37.8136, 144.9631   # a synthetic site (Melbourne GPO) for the geofence and every clock tap
EMAIL_DOMAIN = "example.test"
FIRST = ["Avery", "Blake", "Casey", "Dana", "Eden", "Finley", "Harper", "Indigo", "Jordan", "Kai", "Lane", "Morgan", "Noor", "Oakley",
         "Parker", "Quinn", "Reese", "Sage", "Tatum", "Uma", "Vale", "Wren", "Xavi", "Yael", "Zion", "Arden", "Bryn", "Cove", "Drew",
         "Ellis", "Flynn", "Gray", "Hollis", "Ira", "Jules", "Kit", "Lior", "Marlo", "Nico", "Onyx", "Paz", "Remy", "Shay", "Teal",
         "Vesper", "Wynn", "Zephyr", "Ash"]
LAST = ["Abernathy", "Birchwood", "Calloway", "Dunmore", "Ellsworth", "Fairbanks", "Galloway", "Hartwell", "Ironside", "Jessop",
        "Kingsley", "Lockridge", "Marchetti", "Northcote", "Oakhurst", "Pemberton", "Quenneville", "Ravenscroft", "Stirling",
        "Thornbury", "Underhill", "Vanterpool", "Westergaard", "Yardley", "Zimmerly", "Ainsley", "Bellweather", "Crestfield",
        "Dorrington", "Eastwick", "Featherston", "Greyling", "Holloway", "Inglewood", "Juniper", "Kestrel", "Larkspur", "Moorcroft",
        "Nightingale", "Orchardson", "Pinegrove", "Rosewater", "Silverton", "Tamblyn", "Umberfield", "Vellacott", "Wintergreen", "Yellowood"]

BLANK_KEYS = {"note", "notes", "reason", "message", "msg", "comment", "comments", "desc", "description", "body", "subject", "jobdescription", "job", "why", "feedback"}
PHONE_KEYS = {"phone", "mobile", "tel", "sms", "mobile2", "phone2"}
EMAIL_KEYS = {"email", "email2"}
DROP_LISTS = {"outbox", "pushSubs", "messages", "feedback"}
DROP_KEYS = {"viewAs", "tab"}
GENERIC = {"hospital", "health", "medical", "centre", "center", "public", "private", "general", "district", "regional", "royal", "university",
           "emergency", "department", "ed", "nurses", "nursing", "consultants", "consultant", "doctors", "juniors", "scribes", "admin", "group",
           "team", "the", "of", "and", "st", "saint", "north", "south", "east", "west", "campus", "clinic", "service", "services", "unit", "ward",
           "default", "site", "staff", "roster", "myrosta", "org", "main", "new", "old"}
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RES = [re.compile(r"(?<![\d-])(?:\+?61[ -]?|0)4\d{2}[ -]?\d{3}[ -]?\d{3}(?!\d)"),     # Australian mobile
             re.compile(r"(?<![\d-])(?:\+61[ -]?|0)[2378][ -]?\d{4}[ -]?\d{4}(?!\d)"),       # Australian landline
             re.compile(r"\(0[2378]\)[ -]?\d{4}[ -]?\d{4}(?!\d)"),
             re.compile(r"(?<![\w.-])\+\d{9,14}(?!\d)")]                                     # international E.164


def digits(s):
    return re.sub(r"\D", "", str(s or ""))


def norm_name(name):
    """One key for 'Last, First', 'First Last' and 'first  last': the sorted alphanumeric tokens."""
    toks = sorted(t for t in re.split(r"[^a-z0-9]+", str(name or "").lower()) if t)
    return " ".join(toks)


def is_generic_name(name):
    """'Admin', 'Staff', 'ED Admin': a role, not a person. Treating one as a person would make every
    occurrence of that ordinary word look like a surviving name (the role column, audit text, everywhere)."""
    toks = [t for t in re.split(r"[^a-z0-9]+", str(name or "").lower()) if t]
    return bool(toks) and all(t in GENERIC for t in toks)


def name_parts(name):
    """('First', 'Last', comma_form) from a stored name. Honorifics are dropped."""
    n = str(name or "").strip()
    hon = re.compile(r"^(dr|mr|mrs|ms|miss|mx|prof|a/prof|assoc)\.?$", re.I)
    if "," in n:
        last, first = n.split(",", 1)
        first_w = [w for w in first.split() if not hon.match(w)]
        return (first_w[0] if first_w else "", last.strip(), True)
    w = [x for x in n.split() if not hon.match(x)]
    if not w:
        return ("", "", False)
    if len(w) == 1:
        return (w[0], "", False)
    return (w[0], w[-1], False)


def initials_of(name):
    p = str(name or "").split(",")
    if len(p) >= 2:
        return ((p[1].strip()[:1] or "") + (p[0].strip()[:1] or "")).upper()
    w = str(name or "").strip().split()
    return "".join(x[0] for x in w)[:2].upper()


def tokens_of(name):
    """Every standalone word of a name that could identify on its own (3+ letters), hyphenated parts included."""
    out = set()
    for t in re.split(r"[\s,]+", str(name or "")):
        t = t.strip(".'")
        if len(t) >= 3 and not re.fullmatch(r"(dr|mr|mrs|ms|miss|mx|prof|assoc)\.?", t, re.I):
            out.add(t)
        for part in t.split("-"):
            if len(part) >= 3:
                out.add(part)
    return out


class Person:
    def __init__(self, idx, key, name):
        self.idx, self.key = idx, key
        self.names, self.emails, self.phones, self.ids = set(), set(), set(), set()
        self.comma = "," in str(name or "")
        self.add_name(name)
        self.first = self.last = None

    def add_name(self, name):
        if name:
            self.names.add(str(name).strip())

    @property
    def new_id(self):
        return "p%02d" % self.idx

    @property
    def new_email(self):
        return "p%02d@%s" % (self.idx, EMAIL_DOMAIN)

    def new_name(self, like=None):
        comma = ("," in like) if like else self.comma
        return ("%s, %s" % (self.last, self.first)) if comma else ("%s %s" % (self.first, self.last))


class Result:
    def __init__(self):
        self.tables, self.sql_files, self.report, self.residuals = {}, {}, "", []
        self.counts = {}


def unwrap(obj):
    """The dashboard hands the one-row export back in a few shapes; find the object with org_state in it."""
    if isinstance(obj, str):
        txt = obj.strip()
        if txt.startswith("{") or txt.startswith("["):
            return unwrap(json.loads(txt))
        rows = list(csv.DictReader(io.StringIO(txt)))
        for r in rows:
            for v in r.values():
                if isinstance(v, str) and v.strip().startswith("{"):
                    return unwrap(json.loads(v))
        raise ValueError("no JSON export found in the CSV")
    if isinstance(obj, list):
        for r in obj:
            try:
                return unwrap(r)
            except ValueError:
                continue
        raise ValueError("no export object in the list")
    if isinstance(obj, dict):
        if "org_state" in obj:
            return obj
        for k in ("export", "jsonb_build_object", "result", "data"):
            if k in obj:
                return unwrap(obj[k])
        for v in obj.values():
            if isinstance(v, (dict, list, str)):
                try:
                    return unwrap(v)
                except (ValueError, json.JSONDecodeError):
                    continue
    raise ValueError("not a Myrosta export (no org_state)")


def rows_of(raw):
    """Rows from a per-table download: a JSON list of rows, or the dashboard's CSV of one (JSON cells decoded, blanks as null)."""
    txt = raw.strip()
    if txt.startswith("["):
        return [r for r in json.loads(txt) if isinstance(r, dict)]
    if txt.startswith("{"):
        o = json.loads(txt)
        for v in o.values():
            if isinstance(v, list):
                return [r for r in v if isinstance(r, dict)]
        return [o]
    out = []
    for r in csv.DictReader(io.StringIO(txt)):
        row = {}
        for k, v in r.items():
            if k is None:
                continue
            if v is None or v == "":
                row[k] = None
            elif v.lstrip().startswith(("{", "[")):
                try:
                    row[k] = json.loads(v)
                except json.JSONDecodeError:
                    row[k] = v
            elif k == "seq" and v.isdigit():
                row[k] = int(v)
            else:
                row[k] = v
        out.append(row)
    return out


def infer_table(rows):
    """Which production table a per-table download came from, told by its columns."""
    if not rows:
        return None
    keys = set(rows[0].keys())
    if {"org", "data"} <= keys:
        return "org_state"
    if {"email", "role"} <= keys:
        return "roster_members"
    if {"key", "val"} <= keys or "seq" in keys:
        return "roster_events"
    if {"org", "label"} <= keys:
        return "orgs"
    if {"id", "name"} <= keys and "org" not in keys:
        return "hospitals"
    return None


def load_inputs(paths):
    """One export object from one or more downloads: the one-cell export query, or the five per-table downloads (JSON or CSV)."""
    export = {}
    for p in paths:
        raw = pathlib.Path(p).read_text(encoding="utf-8")
        try:
            obj = unwrap(raw)
            if isinstance(obj, dict) and "org_state" in obj:
                for k, v in obj.items():
                    if isinstance(v, list):
                        export.setdefault(k, []).extend(v)
                continue
        except (ValueError, json.JSONDecodeError):
            pass
        rows = rows_of(raw)
        t = infer_table(rows)
        if not t:
            raise ValueError("%s: these rows do not look like any of the five tables" % p)
        export.setdefault(t, []).extend(rows)
    if "org_state" not in export:
        raise ValueError("no org_state rows among the inputs")
    return export


def deidentify(export, admins=(), keep_emails=(), seed=0):
    export = json.loads(json.dumps(export))   # never touch the caller's object
    keep = {e.strip().lower() for e in keep_emails if e and e.strip()}
    admins = [a.strip().lower() for a in admins if a and a.strip()]
    res = Result()

    # ---------- registry: people, groups, hospitals ----------
    states = sorted((r for r in (export.get("org_state") or []) if r and r.get("org")), key=lambda r: r["org"])
    org_map = {r["org"]: "demo-%d" % (i + 1) for i, r in enumerate(states)}
    for r in (export.get("orgs") or []) + (export.get("roster_members") or []) + (export.get("roster_events") or []):
        o = r.get("org") if isinstance(r, dict) else None
        if o and o not in org_map:
            org_map[o] = "demo-%d" % (len(org_map) + 1)
    hosp_rows = [h for h in (export.get("hospitals") or []) if h and h.get("id")]
    hosp_map = {h["id"]: ("demo-hospital-%d" % (i + 1), "Demo Hospital %d" % (i + 1)) for i, h in enumerate(hosp_rows)}
    for o in (export.get("orgs") or []):
        hid = o.get("hospital_id")
        if hid and hid not in hosp_map:
            hosp_map[hid] = ("demo-hospital-%d" % (len(hosp_map) + 1), "Demo Hospital %d" % (len(hosp_map) + 1))
    hosp_names = {str(h.get("name") or "").strip() for h in hosp_rows} | {str(o.get("hospital") or "").strip() for o in (export.get("orgs") or [])}
    hosp_names |= {str((r.get("data") or {}).get("branding", {}).get("hospital") or "").strip() for r in states if isinstance(r.get("data"), dict)}
    org_labels = {str(o.get("label") or "").strip() for o in (export.get("orgs") or [])}
    org_labels |= {str((r.get("data") or {}).get("branding", {}).get("name") or "").strip() for r in states if isinstance(r.get("data"), dict)}
    org_labels |= {str((r.get("data") or {}).get("site", {}).get("name") or "").strip() for r in states if isinstance(r.get("data"), dict)}
    hosp_names.discard(""); org_labels.discard("")

    people, by_key = [], {}

    def person_for(name, org=None, sid=None):
        key = norm_name(name)
        if not key or is_generic_name(name):
            return None
        p = by_key.get(key)
        if p is not None and org is not None and sid is not None and sid not in p.ids and any(i.startswith(org + "\x00") for i in p.org_ids):
            key = key + "#" + sid   # two different people with one name inside one group stay two people
            p = by_key.get(key)
        if p is None:
            p = Person(len(people) + 1, key, name)
            p.org_ids = set()
            people.append(p); by_key[key] = p
        p.add_name(name)
        if org is not None and sid is not None:
            p.ids.add(sid); p.org_ids.add(org + "\x00" + sid)
        return p

    for r in states:
        d = r.get("data") or {}
        for s in (d.get("staff") or []):
            if not isinstance(s, dict):
                continue
            p = person_for(s.get("name") or s.get("id") or "", r["org"], str(s.get("id") or ""))
            if p is None:
                continue
            for k in EMAIL_KEYS:
                v = str(s.get(k) or "").strip().lower()
                if v and v not in keep:
                    p.emails.add(v)
            for k in PHONE_KEYS:
                v = digits(s.get(k))
                if len(v) >= 8:
                    p.phones.add(v)
    for m in (export.get("roster_members") or []):
        if not isinstance(m, dict):
            continue
        p = person_for(m.get("name") or "")
        em = str(m.get("email") or "").strip().lower()
        if p is not None:
            if em and em not in keep:
                p.emails.add(em)
            v = digits(m.get("phone"))
            if len(v) >= 8:
                p.phones.add(v)

    # synthetic identities, deterministic for a seed, never colliding with a real token
    real_tokens = {t.lower() for p in people for n in p.names for t in tokens_of(n)}
    rnd = random.Random(seed)
    firsts, lasts = FIRST[:], LAST[:]
    rnd.shuffle(firsts); rnd.shuffle(lasts)
    used = set()
    for i, p in enumerate(people):
        j = i
        while True:
            f, l = firsts[j % len(firsts)], lasts[(j // len(firsts) + j) % len(lasts)]
            if (f, l) not in used and f.lower() not in real_tokens and l.lower() not in real_tokens:
                break
            j += 1
        used.add((f, l)); p.first, p.last = f, l

    email_map = {}
    for p in people:
        for e in p.emails:
            email_map[e] = p.new_email
    stray_emails = {}

    def map_email(e):
        e = e.lower()
        if e in keep:
            return e
        if e in email_map:
            return email_map[e]
        if e.endswith("@" + EMAIL_DOMAIN):
            return e
        if e not in stray_emails:
            stray_emails[e] = "someone-%d@%s" % (len(stray_emails) + 1, EMAIL_DOMAIN)
        return stray_emails[e]

    # ---------- the text pass: ids, slugs, hospitals, names, emails, phones — on string VALUES ----------
    id_pairs = sorted(((old, p.new_id) for p in people for old in p.ids if old), key=lambda x: -len(x[0]))
    slug_res = [(re.compile(r"(?<![A-Za-z0-9_-])" + re.escape(o) + r"(?![A-Za-z0-9_-])"), n) for o, n in sorted(org_map.items(), key=lambda x: -len(x[0]))]
    hosp_res = [(re.compile(re.escape(n), re.I), hosp_map[h["id"]][1]) for h in hosp_rows for n in [str(h.get("name") or "").strip()] if n]
    hosp_res += [(re.compile(re.escape(n), re.I), "Demo Hospital") for n in sorted(hosp_names, key=len, reverse=True)]
    hosp_res += [(re.compile(re.escape(n), re.I), "Demo group") for n in sorted(org_labels, key=len, reverse=True)]
    place_tokens = {t for n in (hosp_names | org_labels) for t in re.split(r"[^A-Za-z]+", n) if len(t) >= 4 and t.lower() not in GENERIC and t.lower() not in real_tokens}
    place_res = [(re.compile(r"\b" + re.escape(t) + r"\b", re.I), "Demo") for t in sorted(place_tokens, key=len, reverse=True)]
    name_res = []
    for p in people:
        forms = set()
        for n in p.names:
            f, l, _ = name_parts(n)
            forms.add(n)
            if f and l:
                forms.add("%s, %s" % (l, f)); forms.add("%s %s" % (f, l))
        for n in sorted(forms, key=len, reverse=True):
            name_res.append((re.compile(r"(?<![A-Za-z])" + re.escape(n) + r"(?![A-Za-z])", re.I), p.new_name(n)))
        toks = set()
        for n in p.names:
            f, l, _ = name_parts(n)
            for t in tokens_of(n):
                toks.add((t, p.last if (l and (t.lower() == l.lower() or t.lower() in l.lower().split("-"))) else p.first))
        for t, rep in sorted(toks, key=lambda x: -len(x[0])):
            name_res.append((re.compile(r"(?<![A-Za-z])" + re.escape(t) + r"(?![A-Za-z])", re.I), rep))
    phone_digit_res = [re.compile(r"(?<![\d+])\+?" + r"[\s().-]*".join(re.escape(c) for c in d) + r"(?!\d)") for p in people for d in p.phones]
    phone_digit_res += [re.compile(r"(?<![\d+])\+?" + r"[\s().-]*".join(re.escape(c) for c in d[-9:]) + r"(?!\d)") for p in people for d in p.phones if len(d) > 9]

    def scrub_text(v):
        if not isinstance(v, str) or not v:
            return v
        s = EMAIL_RE.sub(lambda m: map_email(m.group(0)), v)   # emails first: a name inside one must not be rewritten before the whole address is mapped
        for old, new in id_pairs:
            if old in s:
                s = s.replace(old, new)
        for rx, new in slug_res:
            s = rx.sub(new, s)
        for rx, new in hosp_res:
            s = rx.sub(new, s)
        for rx, new in name_res:
            s = rx.sub(new, s)
        for rx, new in place_res:
            s = rx.sub(new, s)
        whole = s.strip()
        for rx in PHONE_RES + phone_digit_res:
            if rx.fullmatch(whole):
                return ""
            s = rx.sub("[phone]", s)
        return s

    def scrub_key(k):
        """A key is scrubbed like a value, anywhere inside it: a call-in is keyed day|zone|staffId, so a staff id
        is not always the first segment (22 Oct 2026)."""
        if not isinstance(k, str) or not k:
            return k
        s = EMAIL_RE.sub(lambda m: map_email(m.group(0)), k) if "@" in k else k
        for old, new in id_pairs:
            if old in s:
                s = s.replace(old, new)
        for rx, new in slug_res:
            s = rx.sub(new, s)
        for rx, new in hosp_res:
            s = rx.sub(new, s)
        for rx, new in name_res:
            s = rx.sub(new, s)
        return s

    blanked = [0]

    def walk(v, key=None, path=""):
        """Structural rules by key name, then the text pass on every string value."""
        if isinstance(v, dict):
            out = {}
            for k, x in v.items():
                lk = str(k).lower()
                if k in DROP_KEYS and path == "":
                    continue
                if k in DROP_LISTS and path == "" and isinstance(x, list):
                    out[k] = []; continue
                if lk in BLANK_KEYS and isinstance(x, str):
                    if x:
                        blanked[0] += 1
                    out[k] = ""; continue
                if lk in PHONE_KEYS and isinstance(x, str):
                    out[k] = ""; continue
                if lk in EMAIL_KEYS and isinstance(x, str):
                    out[k] = map_email(x.strip()) if x.strip() and EMAIL_RE.fullmatch(x.strip()) else ("" if x.strip() else x); continue
                if lk == "lat" and isinstance(x, (int, float)) and not isinstance(x, bool):
                    out[k] = SITE_LAT; continue
                if lk == "lng" and isinstance(x, (int, float)) and not isinstance(x, bool):
                    out[k] = SITE_LNG; continue
                if lk == "endpoint" or lk == "keys" and isinstance(x, dict) and ("p256dh" in x or "auth" in x):
                    continue
                out[scrub_key(k)] = walk(x, k, path + "/" + str(k))
            return out
        if isinstance(v, list):
            return [walk(x, key, path + "/[]") for x in v]
        if isinstance(v, str):
            return scrub_text(v)
        return v

    # ---------- the tables ----------
    out_states = []
    for r in states:
        d = json.loads(json.dumps(r.get("data") or {}))
        for s in (d.get("staff") or []):
            if not isinstance(s, dict):
                continue
            p = by_key.get(norm_name(s.get("name") or s.get("id") or ""))
            for cand in people:
                if str(s.get("id") or "") in cand.ids:
                    p = cand; break
            if p is None:
                continue
            s["id"] = p.new_id
            s["name"] = p.new_name(s.get("name") or "")
            s["initials"] = initials_of(s["name"])
            if "email" in s: s["email"] = p.new_email
            if "email2" in s: s["email2"] = ""
            for k in PHONE_KEYS:
                if k in s: s[k] = ""
            if "payrollId" in s: s["payrollId"] = ""
            if "notes" in s: s["notes"] = ""
            if s.get("icsToken"): s["icsToken"] = mint_hex(seed, "ics", p.idx, r["org"])
            if s.get("posterKey"): s["posterKey"] = mint_key(seed, "poster", p.idx, r["org"])
        if isinstance(d.get("site"), dict):
            site = d["site"]
            site["lat"], site["lng"] = SITE_LAT, SITE_LNG
            if "acc" in site and site["acc"] is not None: site["acc"] = 20
            if "posterKey" in site: site["posterKey"] = mint_key(seed, "site", 0, r["org"])
            if "name" in site: site["name"] = "Demo site"
        if isinstance(d.get("branding"), dict):
            b = d["branding"]
            if b.get("name"): b["name"] = "Demo %s" % org_map[r["org"]]
            if b.get("hospital"): b["hospital"] = "Demo Hospital"
        d["lastImport"] = {}
        for c in (d.get("reqComments") or []):
            if isinstance(c, dict) and "text" in c:
                c["text"] = ""
        d = walk(d)
        out_states.append({"org": org_map[r["org"]], "data": d, "updated": r.get("updated")})
    res.tables["org_state"] = out_states

    out_hosp = [{"id": hosp_map[h["id"]][0], "name": hosp_map[h["id"]][1]} for h in hosp_rows]
    res.tables["hospitals"] = out_hosp
    out_orgs = []
    seen = set()
    for o in (export.get("orgs") or []):
        if not isinstance(o, dict) or not o.get("org") or o["org"] not in org_map:
            continue
        hid = o.get("hospital_id")
        row = {"org": org_map[o["org"]], "label": "Demo group %s" % org_map[o["org"]].split("-")[1],
               "hospital": (hosp_map[hid][1] if hid in hosp_map else ("Demo Hospital" if o.get("hospital") else None)),
               "hospital_id": (hosp_map[hid][0] if hid in hosp_map else None)}
        if row["org"] not in seen:
            seen.add(row["org"]); out_orgs.append(row)
    for o in org_map.values():
        if o not in seen:
            out_orgs.append({"org": o, "label": "Demo group %s" % o.split("-")[1], "hospital": None, "hospital_id": None}); seen.add(o)
    res.tables["orgs"] = out_orgs

    members, mkeys = [], set()
    for m in (export.get("roster_members") or []):
        if not isinstance(m, dict) or not m.get("email") or not m.get("org") or m["org"] not in org_map:
            continue
        p = by_key.get(norm_name(m.get("name") or ""))
        em = map_email(str(m["email"]).strip())
        nm = str(m.get("name") or "")
        row = {"org": org_map[m["org"]], "email": em, "role": m.get("role") or "staff",
               "name": (p.new_name(nm) if p else (nm if is_generic_name(nm) else ("Member %d" % (len(members) + 1)))), "phone": None}
        k = (row["org"], row["email"])
        if k in mkeys:
            continue
        mkeys.add(k); members.append(row)
    for o in sorted(org_map.values(), key=lambda x: int(x.split("-")[1])):
        for a in admins:
            k = (o, a)
            if k in mkeys:
                for row in members:
                    if (row["org"], row["email"]) == k:
                        row["role"] = "admin"
            else:
                mkeys.add(k); members.append({"org": o, "email": a, "role": "admin", "name": "Reviewer", "phone": None})
    res.tables["roster_members"] = members

    events = []
    for e in sorted((x for x in (export.get("roster_events") or []) if isinstance(x, dict)), key=lambda x: (x.get("seq") or 0)):
        if not e.get("key") or e.get("org") not in org_map:
            continue   # markers are re-made by the seed insert; rows of unknown groups have no home
        events.append({"org": org_map[e["org"]], "ts": e.get("ts"), "cycle": scrub_text(str(e.get("cycle") or "")), "key": scrub_key(str(e["key"])),
                       "val": walk(e.get("val")) if e.get("val") is not None else None,
                       "audit": walk(e.get("audit")) if e.get("audit") is not None else None})
    res.tables["roster_events"] = events

    # ---------- the SQL ----------
    stamp = datetime.date.today().isoformat()
    blob_json = json.dumps(res.tables, ensure_ascii=False)
    tag = "deid"
    while ("$" + tag + "$") in blob_json:
        tag += "x"
    q = lambda s: "null" if s is None else "'" + str(s).replace("'", "''") + "'"
    j = lambda v: "null" if v is None else "$" + tag + "$" + json.dumps(v, ensure_ascii=False, separators=(",", ":")) + "$" + tag + "$::jsonb"
    head = "-- Myrosta STAGING seed · generated %s by tools/deidentify.py · de-identified · run on a staging project only, never on production\n" % stamp
    reg = [head, "begin;"]
    for h in out_hosp:
        reg.append("insert into hospitals(id, name) values (%s, %s) on conflict (id) do update set name = excluded.name;" % (q(h["id"]), q(h["name"])))
    for o in out_orgs:
        reg.append("insert into orgs(org, label, hospital, hospital_id) values (%s, %s, %s, %s) on conflict (org) do update set label = excluded.label, hospital = excluded.hospital, hospital_id = excluded.hospital_id;"
                   % (q(o["org"]), q(o["label"]), q(o["hospital"]), q(o["hospital_id"])))
    reg.append("delete from roster_members where org in (%s);" % ", ".join(q(o) for o in sorted(set(m["org"] for m in members))) if members else "-- no members")
    if members:
        reg.append("insert into roster_members(org, email, role, name, phone) values\n  " + ",\n  ".join(
            "(%s, %s, %s, %s, null)" % (q(m["org"]), q(m["email"]), q(m["role"]), q(m["name"])) for m in members) + ";")
    reg.append("commit;")
    res.sql_files["staging-seed-00-registry.sql"] = "\n".join(reg) + "\n"
    for i, r in enumerate(out_states):
        o = r["org"]
        ev = [e for e in events if e["org"] == o]
        lines = [head, "begin;",
                 "delete from roster_events where org = %s;" % q(o), "delete from org_events where org = %s;" % q(o), "delete from org_state where org = %s;" % q(o)]
        if ev:
            lines.append("insert into roster_events(org, ts, cycle, key, val, audit) values\n  " + ",\n  ".join(
                "(%s, %s::timestamptz, %s, %s, %s, %s)" % (q(e["org"]), q(e["ts"]), q(e["cycle"]), q(e["key"]), j(e["val"]), j(e["audit"])) for e in ev) + ";")
        lines.append("insert into org_state(org, data, updated) values (%s, %s, now());" % (q(o), j(r["data"])))
        lines.append("commit;")
        res.sql_files["staging-seed-%02d-org-%s.sql" % (i + 1, o)] = "\n".join(lines) + "\n"

    # ---------- the residual check: nothing real anywhere in what will be written ----------
    everything = (json.dumps(res.tables, ensure_ascii=False) + "\n" + "\n".join(res.sql_files.values())).lower()
    for e in sorted(keep | set(admins), key=len, reverse=True):
        everything = everything.replace(e, " ")   # an email kept on purpose may carry its owner's name; it is not a leak
    found = []
    for p in people:
        for n in p.names:
            if re.search(r"(?<![a-z])" + re.escape(n.lower()) + r"(?![a-z])", everything):
                found.append("a full name survives")
            for t in tokens_of(n):
                if re.search(r"(?<![a-z])" + re.escape(t.lower()) + r"(?![a-z])", everything):
                    found.append("a name word survives")
        for e in p.emails:
            if e in everything:
                found.append("an email survives")
        for d in p.phones:
            if re.search(r"(?<!\d)" + r"[\s().-]*".join(re.escape(c) for c in d[-9:]) + r"(?!\d)", everything):
                found.append("a phone number survives")
        for old in p.ids:
            if old.lower() in everything:
                found.append("an old staff id survives")
    for o in org_map:
        if re.search(r"(?<![a-z0-9_-])" + re.escape(o.lower()) + r"(?![a-z0-9_-])", everything):
            found.append("a group slug survives")
    for n in hosp_names | org_labels:
        if n.lower() in everything:
            found.append("a hospital or group name survives")
    for t in place_tokens:
        if re.search(r"\b" + re.escape(t.lower()) + r"\b", everything):
            found.append("a place word survives")
    for m in EMAIL_RE.finditer(everything):
        e = m.group(0)
        if e not in keep and not e.endswith("@" + EMAIL_DOMAIN) and e not in admins:
            found.append("an unmapped email survives")
    for rx in PHONE_RES[:1]:
        if rx.search(everything):
            found.append("a mobile-shaped number survives")
    res.residuals = sorted(set(found))
    res.counts = {"people": len(people), "groups": len(out_states), "hospitals": len(out_hosp), "members": len(members), "events": len(events),
                  "blanked_fields": blanked[0], "stray_emails": len(stray_emails), "kept_emails": len(keep), "admins_added": len(admins)}
    c = res.counts
    res.report = ("deidentify · %s\n%d people, %d groups, %d hospitals, %d member rows, %d booking events\n"
                  "%d free-text fields blanked, %d unknown emails mapped, %d emails kept as given, %d reviewer admins added per group\n"
                  "site and clock taps moved to %s, %s; calendar tokens and poster keys re-minted; outbox, push subscriptions, messages and feedback emptied\n"
                  "residual check: %s\n") % (stamp, c["people"], c["groups"], c["hospitals"], c["members"], c["events"], c["blanked_fields"], c["stray_emails"],
                                             c["kept_emails"], c["admins_added"], SITE_LAT, SITE_LNG,
                                             ("clean" if not res.residuals else "FAILED: " + "; ".join(res.residuals)))
    res.mapping = {"people": [{"synthetic": p.new_name(), "id": p.new_id, "email": p.new_email, "real_names": sorted(p.names), "real_emails": sorted(p.emails), "real_ids": sorted(p.ids)} for p in people],
                   "orgs": org_map, "hospitals": {k: v[0] for k, v in hosp_map.items()}}
    return res


def mint_hex(seed, kind, idx, org):
    r = random.Random("%s|%s|%s|%s" % (seed, kind, idx, org))
    return "".join("%02x" % r.randrange(256) for _ in range(18))


def mint_key(seed, kind, idx, org):
    r = random.Random("%s|%s|%s|%s" % (seed, kind, idx, org))
    a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(a[r.randrange(32)] for _ in range(16))


def main(argv=None):
    ap = argparse.ArgumentParser(description="De-identify a Myrosta production export into staging seed SQL.")
    ap.add_argument("export", nargs="+", help="the export query's result (JSON or the dashboard's CSV of it), or the five per-table downloads")
    ap.add_argument("--out", required=True, help="folder for the SQL files, the scrubbed JSON and the report")
    ap.add_argument("--keep-email", action="append", default=[], help="an email to keep as it is (the owner's own sign-in on staging); repeatable")
    ap.add_argument("--admin", action="append", default=[], help="an email to add as admin on every group (the reviewer); repeatable")
    ap.add_argument("--seed", type=int, default=0, help="which synthetic names to deal; the same seed gives the same output")
    ap.add_argument("--mapping", help="also write the real-to-synthetic mapping here (PERSONAL DATA: keep it out of the repo and off the staging project)")
    a = ap.parse_args(argv)
    try:
        export = load_inputs(a.export)
    except (ValueError, json.JSONDecodeError) as e:
        print("could not read the export: %s" % e, file=sys.stderr)
        return 2
    res = deidentify(export, admins=a.admin, keep_emails=a.keep_email, seed=a.seed)
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    print(res.report)
    if res.residuals:
        print("nothing written: the residual check found something real in the output", file=sys.stderr)
        return 1
    for name, text in res.sql_files.items():
        (out / name).write_text(text, encoding="utf-8")
    (out / "staging-seed.json").write_text(json.dumps(res.tables, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "deidentify-report.txt").write_text(res.report, encoding="utf-8")
    if a.mapping:
        pathlib.Path(a.mapping).write_text(json.dumps(res.mapping, ensure_ascii=False, indent=1), encoding="utf-8")
    sizes = ", ".join("%s (%d KB)" % (n, len(t.encode("utf-8")) // 1024) for n, t in sorted(res.sql_files.items()))
    print("written to %s: %s, staging-seed.json, deidentify-report.txt" % (out, sizes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
