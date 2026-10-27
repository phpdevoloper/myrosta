#!/usr/bin/env python3
"""Myrosta group files: turn a manager's fortnight-grid workbook into the three files Myrosta imports, plus a settings checklist and a report.

    python3 tools/group-files.py CONFIG.json [--out DIR] [--check] [--app PATH] [--compare ROSTER.csv]
        builds the files next to the config (or in DIR); --check then runs them through the app's own importers under
        JavaScriptCore, prints what landed (the Roster as CSV export included, compared with the roster file cell by cell)
        and exits 1 when what landed differs from what the files carry; --compare makes the same cell-by-cell comparison
        for a Roster as CSV file exported from the live group after the imports
    python3 tools/group-files.py --selftest [--app PATH]
        a synthetic workbook, built and round-tripped the same way (tests/run.py runs it as a lint)

The workbook, the contacts sheet, the config and every output carry names and contact details: keep them outside the repo.

What the tool reads (the SWIFT managers' sheets, and any like them):
- Roster sheets hold fortnight blocks. A block starts at a row whose name cell begins with the block marker ("Fortnight"); the
  row below carries the dates, the row below that the per-day headings; then one row per person: the name, the work type, and
  per date a fixed group of columns (Start, Finish, Break … and for nurses an On Call column first). A block whose first date
  was already read (one fortnight on two monthly sheets) is skipped, and compared with the first read cell by cell: the report
  lists every day that differs (start, finish and, where the layout has one, on call) and anyone on one copy only. Only the
  cycle's days are read.
- A section row sets the zone and tags for the rows beneath it: a row whose name cell, or for a name-less row the text of
  columns A–D joined, matches a section's pattern as a WHOLE (case aside). Any other name-less row is ignored, and a name that
  merely contains a section's word (Elaine, under a section AIN) is a person.
- An unavailability sheet: a date per column on one row, a name per row, any mark in a cell. When no date on that row carries
  the year in the sheet's name (a stale copy of another year's grid), every date moves by the same number of years; a grid
  that crosses New Year keeps its dates as written.
- Each person is stored under ONE name that every file uses: the config's `names` override, else the contacts sheet's Surname
  and Given name, else the sheet's own words as "Surname, Given". A name the app's imports would skip (isNameCell) is left out
  of every file and reported. A start and finish the app would not keep as own hours (hoursOK) is reported, and that day lands
  on its half's type with the type's own times.

Config (JSON; paths relative to the config):
  group                the group's name, heading the checklist and the report
  prefix               the output files' names: <prefix>-staff.xlsx, -roster-<start>.xlsx, -unavailability.xlsx, -checklist.md, -report.md
  noun                 the roster file's first heading (default "Name")
  workbook             the manager's workbook (.xlsx)
  contacts             the contacts sheet (.xlsx): Name (as on the roster) and any of Surname, Given name, Email, Mobile; absent, <prefix>-contacts-template.xlsx is written to fill
  cycle                {"start": "YYYY-MM-DD", "weeks": n}: the cycle the files fill
  roster_sheets        the sheets holding fortnight blocks, read in this order
  leave_sheets         the unavailability sheets
  leave_people         "roster" (default): a grid name on no roster sheet is reported and left out; "all": it becomes a person too
  layout.name_col      the name column, 0-based (default 0)
  layout.worktype_col  the work-type column, 0-based (default 1)
  layout.block_marker  the text a block's first cell begins with (default "Fortnight")
  layout.day_offsets   {"start": k, "finish": k, "oncall": k}: where each date's Start, Finish and (optional) On Call sit, counted from the column holding the date
  layout.skip_rows     a regex searched in name cells that are not people (default ^(Total|SHIFTS TO FILL|Line \d|AVAILABLE))
  layout.sections      [{"match": a regex the whole text must match, "zone": z, "tags": [...]}]
  default              {"zone": z, "tags": [...]}: for rows above the first section
  zones                the zones the checklist sets, in order (every zone runs both halves)
  zone_slots           {z: [slot zones]}: a line group whose people take Desk 1, Desk 2 … in row order, one slot for every half a shift fills
  worktype_hours       {"<work type>": hours, "pattern": a regex whose first group is the hours}: hours per fortnight
  worktype_tags        {a regex the whole work type must match: [tags]}: added to the section's tags
  types                [{"label", "start": "HH:MM", "end": "HH:MM", "fills": ["AM"] | ["PM"] | ["AM", "PM"]}]: the first morning-only and evening-only types become the builtin AM and PM, the rest are added
  cover                {"amMin", "amMax", "pmMin", "pmMax"}
  tags                 the tags the Tags card makes
  tags_shown           the tags ticked Show on the roster
  rules                {"needs": {zone: [tags]}, "mins": [{"tag": t, "n": {"AM": [n, …], "PM": [n, …]}}]}
  switches             {"noticeDays": n, "cst": bool, "rosteron": bool, "marketOn": bool, "ownHours": bool}
  board                a line for the Department board (optional)
  names                {"a name as the sheet writes it": "Surname, Given"}: the stored name, over the contacts and the sheet
"""
import argparse, collections, datetime, json, os, pathlib, re, subprocess, sys, tempfile

try:
    import openpyxl
except ImportError:                                    # the self-test and every build need it; say so plainly
    sys.exit("openpyxl is needed: python3 -m pip install openpyxl")

REPO = pathlib.Path(__file__).resolve().parent.parent
SKIP_ROWS = r"^(Total|SHIFTS TO FILL|Line \d|AVAILABLE)"
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
DOW = "Mon Tue Wed Thu Fri Sat Sun".split()                                # by date.weekday(); the app's export heads a day "Mon 26/10"
DAYS = "Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split()
HALF_WORDS = {"AM": "First half of the day", "PM": "Second half of the day", "AM+PM": "Both halves — a full shift"}   # the Shift types card's own words


def clean(v):
    if isinstance(v, float) and v.is_integer(): v = int(v)                 # a mobile or a code Excel kept as a number
    return re.sub(r"\s+", " ", str(v).replace("\xa0", " ")).strip() if v is not None else ""


def HHMM(v):
    """A Start or Finish cell as "HH:MM": a time, a number such as 930, or text such as 9:30, 0930, 09:30, 9.30, 5:30pm or 24:00
    (midnight). "" for an empty cell (or 0, or a dash); None for anything else ("AL", "OFF"), which the build reports."""
    if v is None: return ""
    if isinstance(v, (datetime.datetime, datetime.time)): return v.strftime("%H:%M")
    if isinstance(v, datetime.timedelta):                                  # a duration-formatted cell
        m = round(v.total_seconds() / 60); return "%02d:%02d" % divmod(m % 1440, 60) if 0 <= m <= 1440 else None
    if isinstance(v, bool): return None
    if isinstance(v, (int, float)):
        if v == 0: return ""
        if 0 < v < 1: return "%02d:%02d" % divmod(round(v * 1440) % 1440, 60)   # a time Excel kept as a fraction of the day
        if v == int(v) and 100 <= v <= 2400 and int(v) % 100 < 60: return "%02d:%02d" % (int(v) // 100 % 24, int(v) % 100)
        return None
    t = clean(v).lower().replace(" ", "")
    if t in ("", "0", "-", "–", "—"): return ""
    m = re.fullmatch(r"([0-9]{1,2})(?:[:.]?([0-9]{2}))?(?::[0-9]{2})?(?:([ap])\.?m?\.?)?", t)
    if not m or (m.group(2) is None and not m.group(3)): return None
    h, mi = int(m.group(1)), int(m.group(2) or 0)
    if m.group(3):
        if not 1 <= h <= 12: return None
        h = h % 12 + (12 if m.group(3) == "p" else 0)
    if mi > 59 or h > 24 or (h == 24 and mi): return None
    return "%02d:%02d" % (h % 24, mi)


def to_date(v):
    if isinstance(v, datetime.datetime): return v.date()
    if isinstance(v, datetime.date): return v
    if isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}", v):
        try: return datetime.date.fromisoformat(v[:10])
        except ValueError: return None
    return None


def iso(d): return d.isoformat()


def count(n, one, many=None): return "%d %s" % (n, one if n == 1 else (many or one + "s"))


def long_date(d): return "%d %s %d" % (d.day, MONTHS[d.month - 1], d.year)


def split_name(n):
    """'Ava Ng' → ('Ng', 'Ava'); 'Ng, Ava' → the same; one word → (word, '')."""
    n = clean(n)
    if "," in n:
        a, b = n.split(",", 1); return a.strip(), b.strip()
    w = n.split(" ")
    return (w[-1], " ".join(w[:-1])) if len(w) > 1 else (n, "")


def stored(sur, giv): return (sur + ", " + giv) if giv else sur           # what the staff-list import makes of a Surname and a Given name


def letters(n): return re.sub(r"[^a-z]", "", str(n or "").lower())       # the app's normName: a name's letters, spacing and punctuation aside


# ---- the app's own rules, copied so the build can say what the importers will refuse (app.html: isNameCell, hoursOK, LEAVE_SET;
#      ASCII and case-insensitive, as the app's regexes are). --check compares what the files carry with what lands, and the
#      self-test holds these copies to the app's own answers, so a rule that changes in the app shows up as a difference ----
NAME_LABEL = re.compile(r"^(date|total|annual|cme|long service|mat\b|unavail|public hol|no of staff|eft off|term\b|school hol|conf\b|conference|resign|vacant|locum|gap\b|cover\b|notes?\b|comments?\b|roster\b|staff\b|name\b|consultant|registrar|tba\b|tbd\b|n/?a\b)", re.I | re.A)
LEAVE_CODES = {"AL", "CME", "UA", "UPL", "PH", "LSL", "SAB", "PL", "O", "OTHER", "ORIENTATION", "VACANT", "CONF"}   # a mark that is one of these imports as that leave, not as UA


def why_name(nm):
    """Why the app's imports would skip this name (isNameCell), or "" when they keep it."""
    if not re.search(r"[A-Za-z]", nm or ""): return "it has no letters"
    m = NAME_LABEL.match(nm)
    if m: return "it starts like a spreadsheet label (%s)" % m.group(1)
    if re.search(r"rotation|holiday", nm, re.I | re.A): return "it reads as a label (rotation, holiday)"
    if re.search(r"[0-9()\[\]–—]", nm): return "it has a digit, a bracket or a dash"
    if len(nm.replace(",", " ").split()) > 4: return "it has more than four words"
    return ""


def name_ok(nm): return not why_name(nm)


def why_hours(s, e):
    """Why the app would not keep this start and finish as own hours (hoursOK), or "" when it would."""
    a, b = (re.fullmatch(r"([01][0-9]|2[0-3]):([0-5][0-9])", x or "") for x in (s, e))
    if not a or not b: return "not a time of day the app reads"
    if int(a[2]) % 5 or int(b[2]) % 5: return "not on a 5-minute step"
    sm, em = int(a[1]) * 60 + int(a[2]), int(b[1]) * 60 + int(b[2])
    return "" if em > sm or (em == 0 and sm > 0) else "the finish is not after the start (across midnight)"


def hours_ok(s, e): return not why_hours(s, e)


def leave_code(v):
    u = str(v).strip().upper() if v is not None else ""
    return u if u in LEAVE_CODES else None


def load_contacts(path):
    """The contacts sheet, keyed by the name as the roster writes it (case aside): a header row with Name (as on the roster)
    and any of Surname, Given name, Email, Mobile."""
    out = {}
    if not path or not pathlib.Path(path).exists(): return out            # no contacts yet: the build still runs, and the report says who cannot sign in
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try: rows = [list(r) for r in wb[wb.sheetnames[0]].iter_rows(values_only=True)]
    finally: wb.close()
    if not rows: return out
    hdr = [clean(c).lower() for c in rows[0]]
    def col(test): return next((i for i, h in enumerate(hdr) if test(h)), -1)
    ci = {"name": col(lambda h: h.startswith("name") or "roster" in h), "sur": col(lambda h: "surname" in h or "last" in h),
          "giv": col(lambda h: "given" in h or "first" in h), "email": col(lambda h: "email" in h), "mobile": col(lambda h: "mobile" in h or "phone" in h)}
    for r in rows[1:]:
        g = lambda k: clean(r[ci[k]]) if 0 <= ci[k] < len(r) else ""
        if g("name"): out[g("name").lower()] = {k: g(k) for k in ("sur", "giv", "email", "mobile")}
    return out


def read_blocks(ws, lay):
    """Every fortnight block on a sheet: its dates by column, and its person rows with the section each sits under; and a line
    for every block marker skipped because the row below it holds fewer than 7 dates (a fortnight has 14)."""
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    marker = lay.get("block_marker", "Fortnight"); ncol = lay.get("name_col", 0); wcol = lay.get("worktype_col", 1)
    at = lambda r, j: clean(r[j]) if j < len(r) else ""
    blocks = []; skipped = []
    for i, r in enumerate(rows):
        if not at(r, ncol).startswith(marker): continue
        dates = [(j, to_date(v)) for j, v in enumerate(rows[i + 1] if i + 1 < len(rows) else []) if to_date(v)]
        if len(dates) < 7: skipped.append("the %s at row %d has %s on the row below it, so it is not read (a fortnight has 14)" % (marker, i + 1, count(len(dates), "date"))); continue
        people = []; sec = None
        for r2 in rows[i + 3:]:
            name = at(r2, ncol)
            if name.startswith(marker): break
            text = name or " ".join(t for t in (clean(v) for v in r2[:4]) if t)   # a name-less row speaks through columns A–D (FRONT DESK in B)
            hit = next((s for s in lay.get("sections", []) if text and re.fullmatch(s["match"], text, re.I)), None)
            if hit: sec = hit; continue                                   # a section row: its WHOLE text is a section's pattern
            if not name or re.search(lay.get("skip_rows", SKIP_ROWS), name, re.I): continue   # any other name-less row, and rows that are not people (Total, SHIFTS TO FILL)
            people.append({"raw": name, "worktype": at(r2, wcol), "sec": sec, "cells": r2})
        blocks.append({"dates": dates, "people": people})
    return blocks, skipped


def section_of(cfg, sec, worktype):
    """Zone and tags for a row: its section's (else the default's), plus the tags its work type adds."""
    d = sec or cfg["default"]; zone = d.get("zone", cfg["default"]["zone"]); tags = list(d.get("tags", []))
    for k, v in (cfg.get("worktype_tags") or {}).items():
        if worktype and re.fullmatch(k, worktype, re.I): tags += [t for t in v if t not in tags]
    return zone, tags


def hours_of(cfg, worktype):
    rule = cfg.get("worktype_hours") or {}
    if worktype in rule and worktype != "pattern": return rule[worktype]
    pat = rule.get("pattern")
    if pat:
        m = re.search(pat, worktype or "", re.I)
        if m: return float(m.group(1))
    return None


def fills_of(t): return [h for h in ("AM", "PM") if h in ((t or {}).get("fills") or [])]


def type_plan(cfg):
    """The Shift types card as the checklist has the admin set it, and as --check seeds it: the builtin AM and PM take the first
    morning-only and evening-only types' names and times, and every other type is added with the halves it fills. The app
    matches a cell's times against the types in this order."""
    T = cfg["types"]
    am = next((t for t in T if fills_of(t) == ["AM"]), None); pm = next((t for t in T if fills_of(t) == ["PM"]), None)
    return {"am": am, "pm": pm, "add": [t for t in T if t is not am and t is not pm]}


def type_for(plan, start, end):
    return next((t for t in [plan["am"], plan["pm"]] + plan["add"] if t and t["start"] == start and t["end"] == end), None)


def halves_of(plan, start, end):
    """The halves of the day a shift fills, and its type: the type's own halves, or for a span no type names the app's rule
    (a start before 12:00 is the morning half)."""
    t = type_for(plan, start, end)
    return (fills_of(t), t) if t else ((["AM"] if int(start[:2]) < 12 else ["PM"]), None)


def config_problems(cfg):
    bad = []; seen = set(); wins = {}
    for t in cfg.get("types", []):
        lbl = str(t.get("label") or "").strip()
        if not lbl: bad.append("a type has no label")
        elif lbl.lower() in seen: bad.append("two types are labelled %s, which the Shift types card refuses" % lbl)
        seen.add(lbl.lower())
        w = (str(t.get("start") or ""), str(t.get("end") or ""))
        if w in wins: bad.append("%s and %s share the window %s\u2013%s: the roster import recognises a shift by its times, so it could not tell them apart" % (wins[w], lbl or "a type", w[0], w[1]))
        else: wins[w] = lbl or "a type"
        if not all(re.fullmatch(r"([01][0-9]|2[0-3]):[0-5][0-9]", str(t.get(k) or "")) for k in ("start", "end")): bad.append("%s: start and end must be HH:MM" % (lbl or "a type"))
        if not fills_of(t) or set(t.get("fills") or []) - {"AM", "PM"}: bad.append("%s: fills must be [\"AM\"], [\"PM\"] or [\"AM\", \"PM\"]" % (lbl or "a type"))
    return bad


def cycle_days(cfg):
    d0 = datetime.date.fromisoformat(cfg["cycle"]["start"]); n = int(cfg["cycle"]["weeks"]) * 7
    return [d0 + datetime.timedelta(days=i) for i in range(n)]


def build(cfg, out_dir):
    bad = config_problems(cfg)
    if bad: raise SystemExit("config: " + "; ".join(bad))
    rep = {"people": {}, "shifts": 0, "one_offs": [], "refused_pairs": [], "clashes": [], "refused_names": [], "renamed": [], "two_sections": [],
           "twice": [], "repeats": [], "repeat_diffs": 0, "unreadable": [], "unmatched_names": [], "grid_only": [], "no_contact": [], "marks": {}, "codes": {}, "rolled": [], "sheets": []}
    plan = type_plan(cfg); contacts = load_contacts(cfg.get("contacts"))
    lay = cfg["layout"]; off = lay["day_offsets"]; days = cycle_days(cfg); dayset = set(days)
    slots = cfg.get("zone_slots") or {}                            # zone → [slot zones] for line-based groups (Desk 1 / Desk 2)

    def decide(raw):
        """The one name a sheet's name is stored under in every file: the config's override, else the contacts sheet's Surname and
        Given name, else the sheet's own words; with why the app would refuse it ("" when it would not), and whether the contacts
        changed it."""
        ov = (cfg.get("names") or {}).get(raw); c = contacts.get(raw.lower()) or {}
        if ov: sur, giv = [x.strip() for x in ov.split(",", 1)] if "," in ov else [ov.strip(), ""]
        elif c.get("sur"): sur, giv = c["sur"], c.get("giv", "")
        else: sur, giv = split_name(raw)
        nm = stored(sur, giv)
        return nm, sur, giv, (why_name(nm) or why_name(sur)), (not ov and bool(c.get("sur")) and nm != stored(*split_name(raw)))

    names = {}                                                     # a name as a sheet writes it → (stored name, surname, given name), or None when the app would refuse it
    def resolve(raw):
        if raw not in names:
            nm, sur, giv, why, renamed = decide(raw)
            if why: rep["refused_names"].append("%s (the sheet says %s): %s. The app's imports would skip it, so it is left out of every file; give it a names override in the config" % (nm, raw, why))
            elif renamed: rep["renamed"].append("stored as %s (the sheet says %s)" % (nm, raw))
            names[raw] = None if why else (nm, sur, giv)
        return names[raw]

    taken = {}                                                     # (date, half) → {zone → the stored name holding it}
    def place(d, zone, nm, fills, s, e):
        """The zone a shift lands in: in a line group (zone_slots) the first slot free in EVERY half it fills; a single zone as it
        is. Someone already holding that zone in a half it fills is a clash, reported per half."""
        if zone in slots:
            busy = {x: [h for h in fills if x in taken.get((d, h), {})] for x in slots[zone]}
            z = next((x for x in slots[zone] if not busy[x]), None) or min(slots[zone], key=lambda x: len(busy[x]))
        else: z = zone
        for h in fills:
            held = taken.setdefault((d, h), {})
            if z in held: rep["clashes"].append("%s %s, %s half: %s and %s (%s–%s)" % (iso(d), z, h, held[z], nm, s, e))
            else: held[z] = nm
        return z

    roster = {}                                                    # stored name → {date → (start, finish, zone)}
    people = {}                                                    # stored name → what the staff file says about them
    moved = set(); read = {}                                       # people reported on two rows that differ; a fortnight's first date → the sheet it was read from, and its days as written
    zt = lambda z, t: "zone %s, tags %s" % (z, ", ".join(t) or "none")
    val = lambda v: clean(v) if HHMM(v) is None else HHMM(v)      # a cell as a time where it reads as one, else as written

    def as_written(b):
        """A block's days on the cycle as written, by the name as the sheet writes it: {name → {date → (start, finish, on call)}};
        for a name on two rows, the first row that writes something on the day."""
        out = {}
        for p in b["people"]:
            mine = out.setdefault(p["raw"], {}); c = p["cells"]
            for j, d in b["dates"]:
                if d not in dayset or d in mine: continue
                w = tuple(val(c[j + off[k]]) if k in off and j + off[k] < len(c) else "" for k in ("start", "finish", "oncall"))
                if any(w): mine[d] = w
        return out

    def shown(w):
        s, f, oc = w; hrs = ("%s–%s" % (s, f)) if s and f else (s or f)
        return " and ".join(x for x in (hrs, ("on call " + oc) if oc else "") if x) or "nothing"

    def compare(first, was, had, sheet, now):
        """A fortnight read again: the copy read first is kept; the report lists, under that, every day that differs and anyone on
        one copy only."""
        a, z = (was, sheet) if was != sheet else (was + "'s first copy", sheet + "'s later copy")   # one sheet holding the fortnight twice
        fate = lambda m, what: (", so %s written there %s %s" % (count(len(m), "day"), "is" if len(m) == 1 else "are", what)) if m else " (no days written)"
        diffs = []
        for raw in list(had) + [r for r in now if r not in had]:
            if raw not in now: diffs.append("%s, %s: on %s only, not on %s%s" % (sheet, raw, a, z, fate(had[raw], "kept")))
            elif raw not in had: diffs.append("%s, %s: on %s only, not on %s%s" % (sheet, raw, z, a, fate(now[raw], "not read")))
            else:
                for d in sorted(set(had[raw]) | set(now[raw])):
                    x, y = had[raw].get(d, ("", "", "")), now[raw].get(d, ("", "", ""))
                    if x != y: diffs.append("%s, %s, %s: %s has %s (kept), %s has %s" % (sheet, raw, iso(d), a, shown(x), z, shown(y)))
        rep["repeats"].append("fortnight from %s appears again on %s, ignored: the copy on %s, read first, is kept; %s" % (iso(first), sheet, was, "where they differ:" if diffs else "the two copies match"))
        rep["repeats"].extend(diffs); rep["repeat_diffs"] += len(diffs)
    wb = openpyxl.load_workbook(cfg["workbook"], read_only=True, data_only=True)
    for sheet in cfg["roster_sheets"]:
        if sheet not in wb.sheetnames: rep["sheets"].append(sheet + ": NOT FOUND"); continue
        blocks, skipped = read_blocks(wb[sheet], lay); rep["sheets"].append("%s: %s" % (sheet, "; ".join([count(len(blocks), "fortnight block")] + skipped)))
        for b in blocks:
            first = b["dates"][0][1]
            if first in read: compare(first, read[first][0], read[first][1], sheet, as_written(b)); continue
            read[first] = (sheet, as_written(b))
            for p in b["people"]:
                who = resolve(p["raw"])
                if not who: continue
                nm = who[0]; zone, tags = section_of(cfg, p["sec"], p["worktype"])
                if nm not in people: people[nm] = {"raw": p["raw"], "sur": who[1], "giv": who[2], "zone": zone, "tags": tags, "hours": hours_of(cfg, p["worktype"]), "sec": p["sec"]}
                info = people[nm]                                  # a person on rows under two sections keeps the first row's zone and tags
                if (zone, tags) != (info["zone"], info["tags"]) and nm not in moved:
                    moved.add(nm); rep["two_sections"].append("%s is on rows %s (%s; then %s): the first row's zone and tags are kept" % (nm, "under two sections" if p["sec"] is not info["sec"] else "with two work types", zt(info["zone"], info["tags"]), zt(zone, tags)))
                for j, d in b["dates"]:
                    if d not in dayset: continue
                    c = p["cells"]; g = lambda k: c[j + off[k]] if k in off and j + off[k] < len(c) else None
                    sv, ev = g("start"), g("finish"); s, e = HHMM(sv), HHMM(ev)
                    if s is None or e is None:
                        rep["unreadable"].append("%s, %s, %s: %s" % (sheet, p["raw"], iso(d), " and ".join("%s %r is not a time" % (k, clean(v)) for k, v, t in (("start", sv, s), ("finish", ev, e)) if t is None))); continue
                    if not s and not e: continue
                    if not s or not e: rep["unreadable"].append("%s, %s, %s: a %s with no %s" % ((sheet, p["raw"], iso(d)) + (("start", "finish") if s else ("finish", "start")))); continue
                    if s == e: continue
                    had = roster.get(nm, {}).get(d)
                    if had: rep["twice"].append("%s written twice on %s: kept %s–%s, dropped %s–%s" % (nm, iso(d), had[0], had[1], s, e)); continue
                    fills, ty = halves_of(plan, s, e); z = place(d, info["zone"], nm, fills, s, e)
                    if not ty:                                     # a span no type names lands on its half's builtin type, renamed in step 1
                        lt = plan["am"] if fills == ["AM"] else plan["pm"]; lbl = lt["label"] if lt else fills[0]; why = why_hours(s, e)
                        if why: rep["refused_pairs"].append("%s %s %s–%s: %s, so it lands on %s%s without its own hours" % (nm, iso(d), s, e, why, lbl, (" " + lt["start"] + "–" + lt["end"]) if lt else ""))
                        else: rep["one_offs"].append("%s %s %s–%s: lands on %s (the %s half) with its own hours" % (nm, iso(d), s, e, lbl, fills[0]))
                    roster.setdefault(nm, {})[d] = (s, e, z); rep["shifts"] += 1
    # unavailability: a grid name is a roster person when it is stored under the same name, or has the same letters as exactly one
    alias = collections.defaultdict(set)
    for raw, who in names.items():
        if who: alias[letters(stored(*split_name(raw)))].add(who[0]); alias[letters(who[0])].add(who[0])
    def on_roster(raw):
        nm, _, _, why, _ = decide(raw)
        if not why and nm in people: return nm
        hit = alias.get(letters(stored(*split_name(raw)))) or set()
        return next(iter(hit)) if len(hit) == 1 else None
    marks = {}                                                     # stored name → {date → the mark as written}
    for sheet in cfg.get("leave_sheets", []):
        if sheet not in wb.sheetnames: rep["sheets"].append(sheet + ": NOT FOUND"); continue
        rows = [list(r) for r in wb[sheet].iter_rows(values_only=True)]
        hr = next((i for i, r in enumerate(rows) if sum(1 for v in r if to_date(v)) > 5), -1)
        if hr < 0: rep["sheets"].append(sheet + ": no date row"); continue
        dates = {j: to_date(v) for j, v in enumerate(rows[hr]) if to_date(v)}
        named = re.search(r"(20\d\d)", sheet)
        if named and not any(d.year == int(named.group(1)) for d in dates.values()):   # a stale copy: no date carries the sheet's own year, so every date moves by the same number of years
            y0 = collections.Counter(d.year for d in dates.values()).most_common(1)[0][0]; dy = int(named.group(1)) - y0; kept = {}
            for j, d in dates.items():
                try: kept[j] = d.replace(year=d.year + dy)
                except ValueError: pass                            # 29 February, in a year without one
            dates = kept; rep["rolled"].append("%s: dates rolled from %d to %d" % (sheet, y0, y0 + dy))
        for r in rows[hr + 1:]:
            raw = clean(r[0]) if r else ""
            if not raw: continue
            nm = on_roster(raw)
            if not nm:
                if cfg.get("leave_people", "roster") != "all": rep["unmatched_names"].append(sheet + ": " + raw); continue
                who = resolve(raw)
                if not who: continue
                nm = who[0]
                if nm not in people:
                    people[nm] = {"raw": raw, "sur": who[1], "giv": who[2], "zone": cfg["default"]["zone"], "tags": list(cfg["default"].get("tags", [])), "hours": None, "sec": None}; rep["grid_only"].append(nm)
            for j, d in dates.items():
                v = r[j] if j < len(r) else None
                if clean(v) == "" or d in marks.get(nm, {}): continue   # an empty cell, or a day another grid already marked
                marks.setdefault(nm, {})[d] = clean(v); code = leave_code(v)
                if code and code != "UA": rep["codes"][code] = rep["codes"].get(code, 0) + 1
                else: rep["marks"][clean(v)] = rep["marks"].get(clean(v), 0) + 1
    wb.close()
    # the three files, every one under the same stored names
    out_dir.mkdir(parents=True, exist_ok=True); pre = cfg["prefix"]
    raws = collections.defaultdict(list)
    for raw, who in names.items():
        if who: raws[who[0]].append(raw)
    wbS = openpyxl.Workbook(); ws = wbS.active; ws.title = "Staff"
    ws.append(["Surname", "Given name", "Email", "Mobile", "Tags", "Hours per fortnight", "Mode"])   # the staff-list import's own columns
    for nm in sorted(people):
        info = people[nm]; c = next((contacts[k.lower()] for k in raws[nm] + [nm] if k.lower() in contacts), {})
        if not (c.get("email") or c.get("mobile")): rep["no_contact"].append(nm)
        ws.append([info["sur"], info["giv"], c.get("email", ""), c.get("mobile", ""), "; ".join(info["tags"]), info["hours"], "self"])
        rep["people"][nm] = {"zone": info["zone"], "tags": info["tags"], "hours": info["hours"], "shifts": len(roster.get(nm, {}))}
    wbS.save(out_dir / (pre + "-staff.xlsx"))
    wbR = openpyxl.Workbook(); ws = wbR.active; ws.title = "Roster"
    ws.append([cfg.get("noun", "Name")] + [iso(d) for d in days])
    for nm in sorted(roster):
        ws.append([nm] + [("%s-%s %s" % (x[0].replace(":", ""), x[1].replace(":", ""), x[2]) if x else None) for x in (roster[nm].get(d) for d in days)])
    wbR.save(out_dir / (pre + "-roster-" + cfg["cycle"]["start"] + ".xlsx"))
    wbU = openpyxl.Workbook(); ws = wbU.active; ws.title = cfg["cycle"]["start"][:4]
    all_dates = sorted({d for m in marks.values() for d in m} | dayset)
    ws.append(["Name"] + [datetime.datetime(d.year, d.month, d.day) for d in all_dates])
    for nm in sorted(people):
        ws.append([nm] + [marks.get(nm, {}).get(d) for d in all_dates])
    wbU.save(out_dir / (pre + "-unavailability.xlsx"))
    if not (cfg.get("contacts") and pathlib.Path(cfg["contacts"]).exists()):        # a contacts template to fill: one row per person, the name as the roster writes it
        wbC = openpyxl.Workbook(); ws = wbC.active; ws.title = "Contacts"; ws.append(["Name (as on the roster)", "Surname", "Given name", "Email", "Mobile"])
        for nm in sorted(people): ws.append([people[nm]["raw"], people[nm]["sur"], people[nm]["giv"], "", ""])
        wbC.save(out_dir / (pre + "-contacts-template.xlsx")); rep["contacts_template"] = pre + "-contacts-template.xlsx"
    (out_dir / (pre + "-checklist.md")).write_text(checklist(cfg, rep), encoding="utf-8")
    (out_dir / (pre + "-report.md")).write_text(report(cfg, rep), encoding="utf-8")
    return rep


def checklist(cfg, rep):
    P = type_plan(cfg); C = cfg["cover"]; sw = cfg.get("switches", {}); pre = cfg["prefix"]; L = []
    start = datetime.date.fromisoformat(cfg["cycle"]["start"]); span = lambda t: "%s–%s" % (t["start"], t["end"])
    L.append("# %s — settings checklist\n" % cfg["group"])
    L.append("Apply in this order, in Settings, signed in as the group's admin. The roster import recognises each shift by its times, so the types come first.\n")
    L.append("## 1. This cycle\n- **Cycle dates card, first:** start **%s**, length **%d weeks**, on the group's existing cycle. The roster file in step 4 starts on the same date, so its import updates this cycle in place (its confirm says *UPDATE the existing cycle*) and keeps every setting below." % (long_date(start), int(cfg["cycle"]["weeks"])))
    L.append("- Roster mode: **rolling** · fairness **Everyone at once (guarded free-for-all)** · notice period **%s days**." % sw.get("noticeDays", 7))
    steps = [("rename **AM** to **%s** %s" % (P["am"]["label"], span(P["am"]))) if P["am"] else "leave **AM** as it is (this group has no morning-only type)",
             ("rename **PM** to **%s** %s" % (P["pm"]["label"], span(P["pm"]))) if P["pm"] else "leave **PM** as it is (this group has no evening-only type)"]
    steps += ["add **%s** %s, *%s*" % (t["label"], span(t), HALF_WORDS["+".join(fills_of(t))]) for t in P["add"]]
    steps += ["switch **CST** off (Features)" if not sw.get("cst") else "keep **CST** on (Features)"]
    L.append("- Shift types card, in this order: " + " · ".join(steps) + ". A type you add starts as a whole day: give it its name, its times and its half of the day, then **Save shift types**.")
    L.append("- On-call card: no windows (leave the On-call type as it is).")
    L.append("- Zones: " + ", ".join("**%s**" % z for z in cfg["zones"]) + " (every zone runs both halves).")
    L.append("- Cover: AM **%d–%d**, PM **%d–%d**." % (C["amMin"], C["amMax"], C["pmMin"], C["pmMax"]))
    rules = cfg.get("rules") or {}
    if rules:
        L.append("- Rules card: " + "; ".join(["%s needs %s" % (z, " and ".join(t)) for z, t in (rules.get("needs") or {}).items()] + ["at least %s %s every AM and PM" % (m["n"]["AM"][0], m["tag"]) for m in rules.get("mins", [])]) + ".")
    L.append("\n## 2. This staff group\n- Tags card: " + (", ".join("**%s**" % t for t in cfg.get("tags", [])) or "none") + (" — tick *Show on the roster* for " + ", ".join(cfg.get("tags_shown", [])) if cfg.get("tags_shown") else "") + ".")
    L.append("- Features: CST **%s** · RosterOn **%s** · Open shifts **%s** · Staff may set their own hours **%s**." % ("on" if sw.get("cst") else "off", "on" if sw.get("rosteron") else "off", "on" if sw.get("marketOn", True) else "off", "on" if sw.get("ownHours") else "off"))
    if cfg.get("board"): L.append("- Department board: " + cfg["board"])
    L.append("\n## 3. People\n- Import **%s-staff.xlsx** (Staff list). It carries names as Surname, Given (the same names the roster and unavailability files use); tags; hours per fortnight where the sheet gave a work type; email and mobile where the contacts sheet had them." % pre)
    if rep.get("contacts_template"): L.append("- No contacts sheet yet: fill **%s** (one row per person, named as the roster writes them; correct Surname and Given name where they read wrongly), save it as the config's `contacts`, and build again before importing." % rep["contacts_template"])
    if rep["no_contact"]: L.append("- No email or mobile yet, so no sign-in until one is added on the Staff tab: **%s** (%s)." % (count(len(rep["no_contact"]), "person", "people"), "; ".join(rep["no_contact"])))
    if rep["refused_names"]: L.append("- Left out of every file, because the app's imports would skip the name: **%s** (see the report). Give each a `names` override in the config and build again." % count(len(rep["refused_names"]), "name"))
    L.append("\n## 4. The roster\n- Import **%s-roster-%s.xlsx** (Roster template). Its first date is the cycle's start, so it updates the cycle dated in step 1 in place, with %d shifts." % (pre, cfg["cycle"]["start"], rep["shifts"]))
    if rep["one_offs"]: L.append("- Times no type names: **%s**, landing on their half's type with their own hours (see the report)." % count(len(rep["one_offs"]), "day"))
    if rep["refused_pairs"]: L.append("- Times the app will not keep as own hours: **%s**, landing on their half's type with its times (see the report)." % count(len(rep["refused_pairs"]), "day"))
    if rep["clashes"]: L.append("- Clashes in the report: **%s**, two people in one zone and half on the same day. Fix them on the sheet before importing, or add a zone." % count(len(rep["clashes"]), "clash", "clashes"))
    if rep["repeat_diffs"]: L.append("- A fortnight written twice differs between its copies: **%s** in the report. The copy read first is the one in the file; if the other is right, correct the sheet and build again." % count(rep["repeat_diffs"], "difference"))
    codes = (" Leave codes, imported as that leave: **%s** (%s)." % (count(sum(rep["codes"].values()), "cell"), ", ".join("%s ×%d" % kv for kv in sorted(rep["codes"].items())))) if rep["codes"] else ""
    L.append("\n## 5. Unavailability\n- Import **%s-unavailability.xlsx** (Leave planner) with **Treat any filled cell as unavailable** ticked. Marks that become UA days: **%d**.%s%s" % (pre, sum(rep["marks"].values()), codes, (" Names on the grid but not on the roster were left out: " + "; ".join(rep["unmatched_names"]) + ".") if rep["unmatched_names"] else ""))
    live = start - datetime.timedelta(days=7)
    L.append("\n## 6. Invitations and go-live\n- Access control → **Invite your …**: everyone with an email or mobile.\n- Check the roster against the manager's sheet: Roster tab → Export → Roster as CSV, then `group-files.py <this config> --compare <that .csv>` names every person and day where the app differs from the roster file (or read the Day board day by day).\n- Booking tab → Rolling roster card → **Go live** on %s %s, a week before the cycle starts; until then staff see *Still being prepared*. Decide the booking window first: it can only be set before Go live. From Go live the roster is the record, and the spreadsheet is never re-imported." % (DAYS[live.weekday()], long_date(live)))
    return "\n".join(L) + "\n"


def report(cfg, rep):
    L = ["# %s — build report\n" % cfg["group"], "Sheets read: " + "; ".join(rep["sheets"]), "People: %d · shifts placed on the cycle's days: %d" % (len(rep["people"]), rep["shifts"]), ""]
    L.append("## People as they will be stored")
    for nm, p in sorted(rep["people"].items()): L.append("- %s · zone %s · tags %s · hours per fortnight %s · %s" % (nm, p["zone"], ", ".join(p["tags"]) or "—", ("%g" % p["hours"]) if isinstance(p["hours"], (int, float)) else (p["hours"] or "—"), count(p["shifts"], "shift")))
    def part(title, xs):
        if xs: L.extend(["", "## " + title] + ["- " + x for x in xs])
    part("Names the app's imports would skip (left out of every file)", rep["refused_names"])
    part("Names stored differently from the sheet", rep["renamed"])
    part("On the unavailability grid only (added as people with no shifts)", rep["grid_only"])
    if rep["no_contact"]: L += ["", "## No email or mobile yet (cannot sign in)", "; ".join(rep["no_contact"])]
    part("People on rows with different zones or tags", rep["two_sections"])
    part("Fortnights that appear twice (the first read is kept)", rep["repeats"])
    part("Days written twice for one person (the first is kept)", rep["twice"])
    part("Cells that are not times (those days are left out)", rep["unreadable"])
    part("Times that match no type (land with their own hours)", rep["one_offs"])
    part("Times the app will not keep as own hours (they land on the type's window)", rep["refused_pairs"])
    part("Clashes (two people in one zone and half)", rep["clashes"])
    part("Unavailability grid names not on the roster (left out)", rep["unmatched_names"])
    part("Unavailability sheets that were a stale copy of another year", rep["rolled"])
    L += ["", "## Marks on the unavailability grid", "Become UA days: " + (", ".join("%s ×%d" % kv for kv in sorted(rep["marks"].items())) or "none"),
          "Import as leave codes: " + (", ".join("%s ×%d" % kv for kv in sorted(rep["codes"].items())) or "none")]
    return "\n".join(L) + "\n"


# ---- the round trip: the built files through the app's own importers, under JavaScriptCore (the same harness as tests/run.py) ----
CHECK_JS = r"""
;(function(){
  cloudOn=function(){return false;}; authState="in"; var IN=__DATA__, out={renders:[],errors:[]};
  S=defaultState(); normalize(); S.viewAs="admin"; S.tab="setup";
  var a=active(), c=cset();
  // the checklist's step 1, in its order: the cycle's dates first (so the roster import updates this cycle in place), then its settings
  a.cycle.start=IN.start; a.cycle.weeks=IN.weeks;
  var zs=IN.zones.map(function(n){return {id:slug(n),name:n,am:true,pm:true,pmLabel:""};}); c.zones=zs; S.zones=zs;
  c.staffing=Object.assign({},IN.cover); S.staffing=Object.assign({},IN.cover);
  // the Shift types card as the checklist sets it: AM and PM renamed and re-timed; the rest added as the card's Add makes them (full, full-2 …), then named, timed and given their halves
  var P=IN.plan, ts=shiftTypesOf(a).map(function(t){return Object.assign({},t,{fills:(t.fills||[]).slice()});});
  ts.forEach(function(t){ var r=t.id==="AM"?P.am:(t.id==="PM"?P.pm:null); if(r){t.label=r.label;t.start=r.start;t.end=r.end;} });
  P.add.forEach(function(t,i){ var id=i?"full-"+(i+1):"full"; ts.push({id:id,code:id.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6),label:t.label,start:t.start,end:t.end,fills:t.fills.slice(),on:true,book:true,builtin:null}); });
  var tm={}; ["AM","PM","ONC","CST"].forEach(function(k){ var r=ts.find(function(x){return x.builtin===k;}); if(r)tm[k]={start:r.start,end:r.end}; });   // as the card's Save writes them
  c.shiftTypes=ts; c.shiftTimes=tm; c.oncallWindows=[]; c.rosterMode="rolling"; S.rosterMode="rolling"; S.features=Object.assign({},S.features||{},{cst:IN.cst}); hydrateCycleSettings();
  // the three files, through the importers, in the checklist's order
  var ps=parseStaffList(IN.staff); if(ps.error)out.errors.push("staff: "+ps.error); var rs=applyStaffList(ps.rows||[]); out.staff={created:rs.created,updated:rs.updated,tagsMade:rs.tagsMade};
  var pr=parseRosterAOA(IN.roster); if(pr.error)out.errors.push("roster: "+pr.error);
  var match=pr.error?null:((S.cycles||[]).find(function(x){return !x.archived&&x.cycle&&x.cycle.start===pr.dates[0];})||null);   // the import screen's own choice: the cycle that starts on the sheet's first date is updated in place
  var cyc=pr.error?null:applyRosterImport(pr,match); out.inPlace=!!match; out.cycles=S.cycles.length;
  if(cyc){ S.activeId=cyc.id; hydrateCycleSettings(); hydrateCycleRoles(); out.cycle={start:cyc.cycle.start,weeks:cyc.cycle.weeks}; out.skipped=(pr.skipped||[]).map(function(x){return x.name+": "+x.why;});
    var byType={}, own=0, clashes=0, seen={}; Object.keys(cyc.assign).forEach(function(k){ var v=cyc.assign[k]; if(v.kind!=="clinical")return; var t=typeOf(cyc,v); var lbl=t?t.label:"?"; byType[lbl]=(byType[lbl]||0)+1; if(v.hours)own++;
      var sid=k.split("|")[0], d=k.split("|")[1]; fillsOf(cyc,v).forEach(function(h){ var key=d+"|"+h+"|"+v.zone; if(seen[key]&&seen[key]!==sid)clashes++; seen[key]=sid; }); });
    out.assigns=Object.keys(cyc.assign).length; out.byType=byType; out.ownHours=own; out.zoneClashes=clashes; out.zones=((cyc.settings&&cyc.settings.zones)||[]).length; }
  var pl=parseLeaveAOA(IN.leave,{anyFilled:true}); if(pl.error)out.errors.push("leave: "+pl.error); else { var n=applyLeaveImport(pl); out.leave={blocks:n,ua:pl.leave.filter(function(l){return l.code==="UA";}).length,anyFilled:pl.anyFilled===true}; }
  var days=0, conflicts=[]; if(cyc){ var d0=parseISO(cyc.cycle.start); for(var i=0;i<cyc.cycle.weeks*7;i++){ var d=iso(addDays(d0,i)); S.staff.forEach(function(s){ var lv=leaveOn(s.id,d); if(!lv||lv.code!=="UA")return; days++; var sh=cyc.assign[s.id+"|"+d]; if(sh&&sh.kind==="clinical")conflicts.push(s.name+" "+d+" "+shiftLabel(sh)); }); } }
  out.uaDays=days; out.uaConflicts=conflicts;   // a day marked unavailable that the manager also rostered: the shift stands in the app, so the manager decides which is right
  out.staffTotal=S.staff.length;   // after all three imports: a roster or grid name that matched nobody in the staff file would be a person of its own
  out.people=S.staff.map(function(s){ return {name:s.name,email:s.email||"",mobile:s.mobile||"",tags:personTags(S,s).map(function(id){return tagName(S,id);})}; });
  if(IN.samples)out.rules={names:IN.samples.names.map(function(x){return isNameCell(x);}),hours:IN.samples.hours.map(function(p){return hoursOK(p[0],p[1]);})};   // the self-test holds the tool's copies of the two rules to the app's own answers
  download=function(s){out.csv=s;}; try{ exportRosterCSV(); }catch(e){ out.errors.push("export: "+e.message); }   // the Roster tab's Roster as CSV, as the admin exports it after the imports (the download stubbed to capture it)
  ["setup","staff","roster","daily","my"].forEach(function(t){ try{ S.tab=t; render(); out.renders.push(t+":ok"); }catch(e){ out.renders.push(t+":FAIL "+e.message); } });
  return JSON.stringify(out);
})();
"""


def aoa_of(path):
    """A workbook's first sheet as rows of plain values: dates as ISO strings, times as HH:MM."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True); out = []
    try:
        for r in wb[wb.sheetnames[0]].iter_rows(values_only=True):
            row = []
            for v in r:
                if isinstance(v, (datetime.datetime, datetime.date)): row.append(to_date(v).isoformat())
                elif isinstance(v, datetime.time): row.append(v.strftime("%H:%M"))
                else: row.append(v)
            while row and row[-1] is None: row.pop()
            out.append(row)
    finally: wb.close()
    return out


def roster_cell(plan, v):
    """A built roster cell ("0945-1745 Desk 1") as the app's roster import reads it: its times and zone, the type it lands on (the
    type with those times, else its half's builtin: the first half when the start is before 12:00) and whether the app keeps
    its own hours (no type has the times, and hoursOK accepts them)."""
    m = re.match(r"\s*(\d{3,4})\s*-\s*(\d{3,4})\s*(.*?)\s*$", str(v))
    if not m: return None
    s, e = ("%02d:%02d" % divmod(int(x), 100) for x in m.groups()[:2]); t = type_for(plan, s, e); half = "am" if int(s[:2]) < 12 else "pm"
    return {"start": s, "end": e, "zone": m.group(3), "type": t, "label": t["label"] if t else (plan[half]["label"] if plan[half] else half.upper()), "own": not t and hours_ok(s, e)}


def export_differences(cfg, roster, text):
    """The app's Roster as CSV export against the built roster file, cell by cell: every person and day where what the app shows is
    not what the file placed, and how many cells were compared. A cell the app shows as a leave code alone (UA, AL, ...) is an
    empty day of the roster, as the file has it; a person in the export with no shifts at all is not a difference."""
    import csv, io
    plan = type_plan(cfg); days = [iso(d) for d in cycle_days(cfg)]; rows = [r for r in csv.reader(io.StringIO(text)) if r]
    if not rows: return ["the export is empty"], 0
    head = [clean(x) for x in rows[0][1:]]; want = ["%s %d/%d" % (DOW[d.weekday()], d.day, d.month) for d in cycle_days(cfg)]
    if head != want: return ["the export's days are not this cycle's: it starts %s and has %s, the cycle starts %s and has %s" % (head[0] if head else "nowhere", count(len(head), "day"), want[0], count(len(want), "day"))], 0
    def expect(v):
        c = roster_cell(plan, v) if clean(v) != "" else None
        return (c["zone"] + " " + c["label"] + ((" " + c["start"] + "\u2013" + c["end"]) if c["own"] else "")) if c else ""
    def shown(v): return "" if clean(v).upper() in LEAVE_CODES and clean(v).upper() == clean(v) else clean(v)
    cells = lambda rs, f: {clean(r[0]): {d: f(r[j + 1] if j + 1 < len(r) else "") for j, d in enumerate(days)} for r in rs if r and clean(r[0])}
    file, app = cells(roster[1:], expect), cells(rows[1:], shown); diffs = []; n = 0
    for nm in sorted(set(file) | set(app)):
        if nm not in app: diffs.append("%s: in the roster file, not in the export" % nm); continue
        if nm not in file and not any(app[nm].values()): continue
        for d in days:
            n += 1; x, y = file.get(nm, {}).get(d, ""), app[nm].get(d, "")
            if x != y: diffs.append("%s, %s: the file has %s, the app shows %s" % (nm, d, x or "nothing", y or "nothing"))
    return diffs, n


def differences(cfg, data, out, clashes=None):
    """Every count where what landed is not what the build wrote: the three files' rows, shifts, own hours and marks, counted the way
    the app's importers count them, and the clashes the build reported (a whole day placed in one half only shows up here)."""
    plan = type_plan(cfg); days = {iso(d) for d in cycle_days(cfg)}
    rows = lambda k: [r for r in data[k][1:] if r and clean(r[0])]
    shifts = own = ua = 0; by_type = {}
    for r in rows("roster"):
        for v in r[1:]:
            if clean(v) == "": continue
            shifts += 1; c = roster_cell(plan, v)
            if c:
                by_type[c["label"]] = by_type.get(c["label"], 0) + 1
                if c["own"]: own += 1
    lh = data["leave"][0] if data["leave"] else []
    for r in rows("leave"):
        ua += sum(1 for j, v in enumerate(r) if 0 < j < len(lh) and lh[j] in days and clean(v) != "" and leave_code(v) in (None, "UA"))
    staff = len(rows("staff"))
    checks = (("people: %s in the staff file, %s created by its import", staff, (out.get("staff") or {}).get("created")),
              ("people after all three imports: %s in the staff file, %s in the app", staff, out.get("staffTotal")),
              ("shifts: %s in the roster file, %s landed", shifts, out.get("assigns")),
              ("own hours: %s one-offs the app keeps, %s landed with their own hours", own, out.get("ownHours")),
              ("UA days on the cycle's days: %s marked, %s landed", ua, out.get("uaDays")),
              ("zones: %s set by the checklist, %s after the roster import", len(cfg["zones"]), out.get("zones"))) + \
             ((("clashes: %s in the build's report, %s in the app", clashes, out.get("zoneClashes")),) if clashes is not None else ()) + \
             tuple(("shifts on %s: %%s in the roster file, %%s landed" % lbl.replace("%", "%%%%"), by_type.get(lbl, 0), (out.get("byType") or {}).get(lbl, 0)) for lbl in sorted(set(by_type) | set(out.get("byType") or {})))
    diffs = ["import error: " + x for x in out.get("errors") or []] + [t % (want, have) for t, want, have in checks if want != have]
    if out.get("inPlace") is False: diffs.append("the roster import added a cycle instead of updating the one step 1 dates")
    return diffs


def check(cfg, out_dir, app_path=None, clashes=None, samples=None):
    """Run the three built files through the app's own importers under JavaScriptCore and return what landed, with
    `differences`: every count where that is not what the build wrote (clashes: how many the build reported)."""
    app_path = pathlib.Path(app_path) if app_path else REPO / "app.html"
    stubs = app_path.resolve().parent / "tests" / "stubs.js"
    if not stubs.exists(): stubs = REPO / "tests" / "stubs.js"            # an app.html outside a checkout (deploy/app.html) runs with this repo's stubs
    html = app_path.read_text(encoding="utf-8"); app = max(re.findall(r"<script>(.*?)</script>", html, re.S), key=len)
    pre = cfg["prefix"]; plan = type_plan(cfg); pick = lambda t: {"label": t["label"], "start": t["start"], "end": t["end"], "fills": fills_of(t)} if t else None
    data = {"start": cfg["cycle"]["start"], "weeks": int(cfg["cycle"]["weeks"]), "zones": cfg["zones"], "cover": cfg["cover"], "cst": bool((cfg.get("switches") or {}).get("cst")),
            "plan": {"am": pick(plan["am"]), "pm": pick(plan["pm"]), "add": [pick(t) for t in plan["add"]]}, "samples": samples,
            "staff": aoa_of(out_dir / (pre + "-staff.xlsx")), "roster": aoa_of(out_dir / (pre + "-roster-" + cfg["cycle"]["start"] + ".xlsx")), "leave": aoa_of(out_dir / (pre + "-unavailability.xlsx"))}
    src = stubs.read_text(encoding="utf-8") + app + "\n" + CHECK_JS.replace("__DATA__", json.dumps(data))
    fd, jsf = tempfile.mkstemp(suffix=".js")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f: f.write(src)
        o = subprocess.run(["osascript", "-l", "JavaScript", jsf], capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired: raise SystemExit("JavaScriptCore run did not finish in 120 s")
    finally: os.unlink(jsf)
    txt = (o.stdout or "").strip()
    if not txt.startswith("{"): raise SystemExit("JavaScriptCore run failed:\n" + (o.stderr or "") + txt[:1500])
    out = json.loads(txt); out["differences"] = differences(cfg, data, out, clashes)
    xd, out["exportCells"] = export_differences(cfg, data["roster"], out.get("csv") or "")
    out["differences"] += ["export: " + x for x in xd]
    return out


def selftest(app_path=None):
    """A synthetic manager workbook (every name made up), built and round-tripped; every number is what the layout above must give."""
    import shutil
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="group-files-"))
    try: _selftest(tmp, app_path)
    finally: shutil.rmtree(tmp, ignore_errors=True)


def _selftest(tmp, app_path):
    def fail(what, want, got): raise SystemExit("selftest: %s\n  expected %s\n  got      %s" % (what, want, got))
    T = lambda h, m=0: datetime.time(h, m); day = datetime.date; D = lambda d: datetime.datetime(d.year, d.month, d.day)
    run = lambda d0, n: [d0 + datetime.timedelta(days=k) for k in range(n)]
    wb = openpyxl.Workbook(); wb.remove(wb.active)
    def block(ws, row, start, entries):                        # a fortnight block in the managers' layout: 6 columns a day, the dates on the row below the marker
        ws.cell(row=row, column=1, value="Fortnight"); ws.cell(row=row, column=2, value="Date")
        for i, d in enumerate(run(start, 14)):
            c = 3 + i * 6; ws.cell(row=row + 1, column=c, value=D(d))
            for k, h in enumerate(["Start Time", "Finish Time", "Break (Min)", "Shift Length", None, "Shift Length"]):
                if h: ws.cell(row=row + 2, column=c + k, value=h)
        ws.cell(row=row + 2, column=2, value="Work Type"); r = row + 3
        for name, b, shifts in entries:
            if name: ws.cell(row=r, column=1, value=name)
            if b: ws.cell(row=r, column=2, value=b)
            for i, s, e in shifts: ws.cell(row=r, column=3 + i * 6, value=s); ws.cell(row=r, column=4 + i * 6, value=e)
            r += 1
        return r + 1
    # fortnight 1, Mon 26 Oct (day 0) to Sun 8 Nov (day 13)
    F1 = [("PM - Pat Lead", "PT 60", [(0, T(9, 30), T(15)), (1, T(9, 30), T(18)), (2, "AL", None), (7, "9:30", "1500"), (8, 930, 1800)]),   # a names override; times as text and as numbers; a cell that is no time
          (None, "FRONT DESK", []),                                                              # a section written in column B of a name-less row
          ("Ali Desk", "PT54", [(0, T(17, 30), T(22, 15)), (1, T(9, 45), T(17, 45)), (3, T(17, 30), T(22, 15)), (5, T(11, 10), T(16, 25))]),   # the contacts store the name as Desk, Alison; a one-off on Sat 31 Oct
          ("Bo Casual", "CS", [(2, T(9, 45), T(17, 45)), (5, T(9, 45), T(14, 15))]),
          ("Cam Long", "CS", [(3, T(9, 45), T(22, 15))]),                                        # a whole day beside Ali's evening on Thu 29 Oct: the other desk, no clash
          ("Ray Stone (new)", "CS", [(6, T(9, 45), T(17, 45))]),                                 # a name the app refuses
          ("SHIFTS TO FILL", None, [(4, T(9, 45), T(17, 45))]),
          ("OFFICE", None, []),                                                                  # a section written in the name column
          ("Jo Officer", "PT 39", [(3, T(17, 30), T(22, 15))]),                                  # a name holding a section's word
          (None, "see the roster notes", []),                                                    # a name-less row that is no section
          ("Kim Lane", "PT 18", [(3, T(9, 45), T(22, 15)), (4, T(21), T(1))]),                   # a whole day over Jo's evening in a single zone: a clash; a pair across midnight
          ("Bo Casual", "CS", [(2, T(17, 30), T(22, 15)), (6, T(9, 45), T(14, 15))]),            # Bo again, under another section: 28 Oct written twice
          ("Total Daily Hours Week 1", None, [])]
    F2 = [("PM - Pat Lead", "PT 60", [(0, T(9, 30), T(15))]), (None, "FRONT DESK", []), ("Ali Desk", "PT54", [(0, T(17, 30), T(22, 15))])]   # from Mon 23 Nov
    F2b = F2[:2] + [("Ali Desk", "PT54", [(0, T(18), T(22, 15))]), ("Dee Extra", "CS", [(1, T(9, 45), T(17, 45))])]   # the same fortnight copied, then edited: Ali's first evening starts at 18:00, and a casual is added
    nov = wb.create_sheet("NOV 2026"); r_short = block(nov, block(nov, 8, day(2026, 10, 26), F1), day(2026, 11, 23), F2)
    nov.cell(row=r_short, column=1, value="Fortnight (being written)")                          # a block started but dated three days through: not read, and said so
    for i in range(3): nov.cell(row=r_short + 1, column=3 + i * 6, value=D(day(2027, 1, 18) + datetime.timedelta(days=i)))
    block(wb.create_sheet("DEC 2026"), 8, day(2026, 11, 23), F2b)                                # the fortnight that crosses into December, again on the next month's sheet
    def grid(ws, at, dates, rows):                             # an unavailability grid: the dates on one row, a name per row beneath, marks in the cells
        col = {d: 2 + i for i, d in enumerate(dates)}
        for d, c in col.items(): ws.cell(row=at, column=c, value=D(d))
        for k, (name, marks) in enumerate(rows):
            ws.cell(row=at + 1 + k, column=1, value=name)
            for d, v in marks: ws.cell(row=at + 1 + k, column=col[d], value=v)
    lv = wb.create_sheet("Staff Leave 2026"); lv.cell(row=1, column=2, value="UNAVAILABILITIES")
    grid(lv, 3, run(day(2026, 10, 20), 20) + run(day(2026, 12, 28), 12),                         # crosses New Year: its 2027 days stay in 2027
         [("Ali Desk", [(day(2026, 10, 27), "X"), (day(2026, 10, 28), "X"), (day(2026, 11, 1), "AL")]),   # 27 Oct is also rostered; AL stays AL
          ("Bo Casual", [(day(2026, 10, 22), "X"), (day(2026, 10, 30), "AM")]),                  # 22 Oct is before the cycle; a half-day mark is a day
          ("Not Rostered", [(day(2026, 10, 30), "X")]),
          ("Kim Lane", [(day(2027, 1, 5), "X"), (day(2027, 1, 6), "X")])])
    grid(wb.create_sheet("Leave 2026 (copy)"), 2, run(day(2025, 11, 2), 11), [("Pat Lead", [(day(2025, 11, 4), "X")])])   # a 2025 grid never re-dated: rolled to 2026
    wbp = tmp / "manager.xlsx"; wb.save(wbp)
    ct = openpyxl.Workbook(); ws = ct.active; ws.append(["Name (as on the roster)", "Surname", "Given name", "Email", "Mobile"])
    ws.append(["Ali Desk", "Desk", "Alison", "alison@example.test", None]); ws.append(["Bo Casual", None, None, None, "0400 000 001"]); ct.save(tmp / "contacts.xlsx")
    types = [("Manager", "09:30", "15:00", ["AM"]), ("Manager long", "09:30", "18:00", ["AM"]), ("Day desk", "09:45", "17:45", ["AM"]),
             ("Weekend AM", "09:45", "14:15", ["AM"]), ("Evening", "17:30", "22:15", ["PM"]), ("Full", "09:45", "22:15", ["AM", "PM"])]
    cfg = {"group": "Selftest · Admin", "prefix": "selftest", "noun": "Clerk", "workbook": str(wbp), "contacts": str(tmp / "contacts.xlsx"),
           "cycle": {"start": "2026-10-26", "weeks": 12}, "roster_sheets": ["NOV 2026", "DEC 2026", "MISSING 2027"], "leave_sheets": ["Staff Leave 2026", "Leave 2026 (copy)"],
           "layout": {"name_col": 0, "worktype_col": 1, "block_marker": "Fortnight", "day_offsets": {"start": 0, "finish": 1, "break": 2},
                      "sections": [{"match": "FRONT DESK", "zone": "Desk"}, {"match": "OFFICE", "zone": "Office", "tags": ["Office"]}], "skip_rows": SKIP_ROWS},
           "default": {"zone": "Desk"}, "zones": ["Desk 1", "Desk 2", "Office"], "zone_slots": {"Desk": ["Desk 1", "Desk 2"]},
           "worktype_hours": {"pattern": r"PT\s*(\d+)"}, "worktype_tags": {"CS": ["Casual"]},
           "types": [{"label": l, "start": s, "end": e, "fills": f} for l, s, e, f in types],
           "cover": {"amMin": 1, "amMax": 3, "pmMin": 1, "pmMax": 3}, "tags": ["Casual", "Office"], "names": {"PM - Pat Lead": "Lead, Pat"},
           "switches": {"noticeDays": 7, "marketOn": True, "ownHours": True}}
    out = tmp / "out"; rep = build(cfg, out)
    exp = {"people": 6, "shifts": 17, "one_offs": 1, "refused_pairs": 1, "clashes": 1, "refused_names": 1, "renamed": 1, "two_sections": 1, "twice": 1, "repeats": 3,
           "unreadable": 1, "unmatched_names": 1, "rolled": 1, "no_contact": 4, "ua_marks": 7, "codes": {"AL": 1}}
    got = dict({k: len(rep[k]) for k in exp if isinstance(rep.get(k), list)}, people=len(rep["people"]), shifts=rep["shifts"], ua_marks=sum(rep["marks"].values()), codes=rep["codes"])
    if got != exp: fail("the build's counts", exp, got)
    if "MISSING 2027: NOT FOUND" not in rep["sheets"]: fail("a missing sheet is reported", "MISSING 2027: NOT FOUND", rep["sheets"])
    short = "NOV 2026: 2 fortnight blocks; the Fortnight at row %d has 3 dates on the row below it, so it is not read (a fortnight has 14)" % r_short
    if short not in rep["sheets"]: fail("a block with too few dates is reported, not skipped silently", short, rep["sheets"])
    dup = config_problems(dict(cfg, types=cfg["types"] + [{"label": "Manager (copy)", "start": "09:30", "end": "15:00", "fills": ["AM"]}]))
    if dup != ["Manager and Manager (copy) share the window 09:30\u201315:00: the roster import recognises a shift by its times, so it could not tell them apart"]: fail("two types sharing a window are refused", "one line naming both", dup)
    want = {"Lead, Pat": ("Desk", [], 60.0), "Desk, Alison": ("Desk", [], 54.0), "Casual, Bo": ("Desk", ["Casual"], None), "Long, Cam": ("Desk", ["Casual"], None),
            "Officer, Jo": ("Office", ["Office"], 39.0), "Lane, Kim": ("Office", ["Office"], 18.0)}
    who = {nm: (p["zone"], p["tags"], p["hours"]) for nm, p in rep["people"].items()}
    if who != want: fail("the people (zone, tags, hours)", want, who)
    lines = {"clashes": ["2026-10-29 Office, PM half: Officer, Jo and Lane, Kim (09:45–22:15)"], "twice": ["Casual, Bo written twice on 2026-10-28: kept 09:45–17:45, dropped 17:30–22:15"],
             "repeats": ["fortnight from 2026-11-23 appears again on DEC 2026, ignored: the copy on NOV 2026, read first, is kept; where they differ:",
                         "DEC 2026, Ali Desk, 2026-11-23: NOV 2026 has 17:30–22:15 (kept), DEC 2026 has 18:00–22:15",    # the edited day
                         "DEC 2026, Dee Extra: on DEC 2026 only, not on NOV 2026, so 1 day written there is not read"],  # the person added to the copy
             "renamed": ["stored as Desk, Alison (the sheet says Ali Desk)"],
             "rolled": ["Leave 2026 (copy): dates rolled from 2025 to 2026"], "one_offs": ["Desk, Alison 2026-10-31 11:10–16:25: lands on Manager (the AM half) with its own hours"],
             "refused_pairs": ["Lane, Kim 2026-10-30 21:00–01:00: the finish is not after the start (across midnight), so it lands on Evening 17:30–22:15 without its own hours"],
             "unreadable": ["NOV 2026, PM - Pat Lead, 2026-10-28: start 'AL' is not a time"], "unmatched_names": ["Staff Leave 2026: Not Rostered"],
             "two_sections": ["Casual, Bo is on rows under two sections (zone Desk, tags Casual; then zone Office, tags Office, Casual): the first row's zone and tags are kept"]}
    for k, v in lines.items():
        if rep[k] != v: fail("the report's %s" % k, v, rep[k])
    if not rep["refused_names"][0].startswith("(new), Ray Stone (the sheet says Ray Stone (new)): it has a digit, a bracket or a dash"): fail("the refused name", "(new), Ray Stone …", rep["refused_names"])
    def at(path, nm, d):                                       # one cell of a built file: the row named nm, the column headed d
        rows = aoa_of(out / path); row = next((r for r in rows[1:] if r and r[0] == nm), None); j = rows[0].index(d) if d in rows[0] else -1
        return row[j] if row and 0 <= j < len(row) else None
    R, U = "selftest-roster-2026-10-26.xlsx", "selftest-unavailability.xlsx"
    cells = {(R, "Desk, Alison", "2026-10-29"): "1730-2215 Desk 1", (R, "Long, Cam", "2026-10-29"): "0945-2215 Desk 2", (R, "Lane, Kim", "2026-10-29"): "0945-2215 Office",
             (R, "Casual, Bo", "2026-10-28"): "0945-1745 Desk 1", (R, "Casual, Bo", "2026-11-01"): "0945-1415 Desk 1", (R, "Lead, Pat", "2026-11-02"): "0930-1500 Desk 1",
             (R, "(new), Ray Stone", "2026-11-01"): None, (U, "Lane, Kim", "2027-01-05"): "X", (U, "Lead, Pat", "2026-11-04"): "X", (U, "Desk, Alison", "2026-10-27"): "X"}
    for (f, nm, d), v in cells.items():
        if at(f, nm, d) != v: fail("%s, %s on %s" % (f, nm, d), v, at(f, nm, d))
    ck = (out / "selftest-checklist.md").read_text(encoding="utf-8")
    for s in ("start **26 Oct 2026**, length **12 weeks**", "rename **AM** to **Manager** 09:30–15:00 · rename **PM** to **Evening** 17:30–22:15 · add **Manager long** 09:30–18:00, *First half of the day*",
              "add **Full** 09:45–22:15, *Both halves — a full shift* · switch **CST** off (Features). A type you add", "\n- On-call card: no windows (leave the On-call type as it is).\n",
              "fairness **Everyone at once (guarded free-for-all)**", "updates the cycle dated in step 1 in place, with 17 shifts", "differs between its copies: **2 differences** in the report",
              "\n- Access control → **Invite your …**: everyone with an email or mobile.", "Roster tab → Export → Roster as CSV, then `group-files.py <this config> --compare <that .csv>`",
              "Booking tab → Rolling roster card → **Go live** on Monday 19 Oct 2026, a week before the cycle starts", "it can only be set before Go live"):
        if s not in ck: fail("the checklist says", s, "not there")
    for s in ("switch **On-call** off", "Staff tab → Invite", "roster CSV", "Morning half", "in launch week"):   # the words the app does not have, and the runbook's date said vaguely
        if s in ck: fail("the checklist never says", s, "there")
    if re.search(r"delete", ck, re.I): fail("the checklist never deletes a cycle", "no 'delete'", "a 'delete' line")
    rep2 = build(dict(cfg, contacts=str(tmp / "no-contacts.xlsx"), leave_people="all"), tmp / "bare")   # no contacts yet: a template, named in the People step; and every grid name a person
    if "fill **selftest-contacts-template.xlsx**" not in (tmp / "bare" / "selftest-checklist.md").read_text(encoding="utf-8") or rep2["grid_only"] != ["Rostered, Not"] or len(rep2["no_contact"]) != 7:
        fail("the contacts template and leave_people all", "named in the checklist; Rostered, Not on the grid only; 7 without contact", (rep2.get("contacts_template"), rep2["grid_only"], len(rep2["no_contact"])))
    samples = {"names": ["Lead, Pat", "Stone (new), Ray", "Cover, Kim", "Van Der Berg, Anna Maria", "Holidays, Jo", "Smith – Jones, Al", "Matéo, Jo", "N/A", "Rostered, Not"],
               "hours": [["09:30", "15:00"], ["09:32", "15:00"], ["21:00", "01:00"], ["22:00", "00:00"], ["00:00", "00:00"], ["24:00", "01:00"], ["9:30", "15:00"]]}
    o = check(cfg, out, app_path, len(rep["clashes"]), samples)
    mine = {"names": [name_ok(x) for x in samples["names"]], "hours": [hours_ok(*p) for p in samples["hours"]]}
    if o.get("rules") != mine: fail("the tool's copies of isNameCell and hoursOK against the app's", o.get("rules"), mine)
    want = {"errors": [], "differences": [], "created": 6, "staffTotal": 6, "assigns": 17, "ownHours": 1, "zoneClashes": 1, "uaDays": 6, "uaConflicts": 1, "inPlace": True, "cycles": 1, "exportCells": 6 * 84,
            "byType": {"Manager": 4, "Manager long": 2, "Day desk": 2, "Weekend AM": 2, "Evening": 5, "Full": 2}}   # the one-off lands on Manager with its own hours; the pair across midnight on Evening without
    have = {k: o.get(k) for k in want}; have["created"] = (o.get("staff") or {}).get("created"); have["uaConflicts"] = len(o.get("uaConflicts") or [])
    if have != want: fail("the round trip", want, have)
    pp = {p["name"]: p for p in o.get("people", [])}
    got = {nm: (pp.get(nm, {}).get("email"), pp.get(nm, {}).get("mobile"), pp.get(nm, {}).get("tags")) for nm in ("Desk, Alison", "Casual, Bo", "Officer, Jo")}
    want = {"Desk, Alison": ("alison@example.test", "", []), "Casual, Bo": ("", "0400 000 001", ["Casual"]), "Officer, Jo": ("", "", ["Office"])}
    if got != want: fail("contacts and tags as they landed", want, got)
    if [r for r in o.get("renders", []) if "FAIL" in r] or len(o.get("renders", [])) != 5: fail("every tab renders", "5 × ok", o.get("renders"))
    text = o["csv"]; xd, n = export_differences(cfg, aoa_of(out / R), text.replace('"Office Full"', '"Office Evening"', 1))   # the app's export with one cell changed, as a manager's edit after import would show
    if n != 6 * 84 or xd != ["Lane, Kim, 2026-10-29: the file has Office Full, the app shows Office Evening"]: fail("a cell changed in the app shows up in the export compare", "one line for Lane, Kim on 2026-10-29", (n, xd))
    if 'Manager 11:10\u201316:25' not in text: fail("the export shows the one-off's own hours after its type", "Desk 1 Manager 11:10\u201316:25", text[:300])
    xd = export_differences(cfg, aoa_of(out / R), "Clerk,Mon 2/11\n")[0]
    if xd != ["the export's days are not this cycle's: it starts Mon 2/11 and has 1 day, the cycle starts Mon 26/10 and has 84 days"]: fail("an export of another cycle is refused", "one line", xd)
    wb = openpyxl.load_workbook(out / "selftest-staff.xlsx"); wb.active.append(["(new)", "Ray Stone", None, None, "Casual", None, "self"]); wb.save(out / "selftest-staff.xlsx")
    wb = openpyxl.load_workbook(out / R); wb.active.append(["(new), Ray Stone"] + [None] * 6 + ["0945-1745 Desk 2"]); wb.save(out / R)   # the refused name written anyway, as a build that did not know the rule would
    bad = check(cfg, out, app_path, len(rep["clashes"]))["differences"]
    if len(bad) != 5: fail("a refused name written anyway shows up as differences", "5 (people, people after the imports, shifts, shifts on Day desk, the export)", bad)
    print("selftest ok: 6 people, 17 shifts (1 with own hours, 1 pair the app refuses), 1 clash, 6 UA days (1 on a rostered day), 1 name refused, a block too short to read, "
          "a fortnight copied and edited reported day by day; the round trip matches the files cell by cell (504 export cells), a refused name written anyway gives 5 differences; every tab renders")


def main():
    ap = argparse.ArgumentParser(description="A manager's fortnight-grid workbook → the three files Myrosta imports, a settings checklist and a report.")
    ap.add_argument("config", nargs="?"); ap.add_argument("--out")
    ap.add_argument("--check", action="store_true", help="after building, run the files through the app's own importers under JavaScriptCore; exit 1 on any difference from what the files carry")
    ap.add_argument("--app", help="the app.html to check against (default: the repo's)"); ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--compare", metavar="ROSTER.csv", help="the live group's Roster tab → Export → Roster as CSV, downloaded after the imports: compared cell by cell with the roster file this build writes; exit 1 on any difference")
    a = ap.parse_args()
    if a.selftest: return selftest(a.app)
    if not a.config: ap.error("a config file, or --selftest")
    cfgp = pathlib.Path(a.config); cfg = json.loads(cfgp.read_text(encoding="utf-8"))
    for k in ("workbook", "contacts"):
        if cfg.get(k) and not pathlib.Path(cfg[k]).is_absolute(): cfg[k] = str((cfgp.parent / cfg[k]).resolve())
    out_dir = pathlib.Path(a.out) if a.out else cfgp.parent
    rep = build(cfg, out_dir)
    print("built %s: %s, %s, %s, %s the app will not keep as own hours, %s, %s refused, %s; report %s-report.md"
          % (cfg["group"], count(len(rep["people"]), "person", "people"), count(rep["shifts"], "shift"), count(len(rep["one_offs"]), "one-off"), count(len(rep["refused_pairs"]), "pair"),
             count(len(rep["clashes"]), "clash", "clashes"), count(len(rep["refused_names"]), "name"), count(sum(rep["marks"].values()), "UA mark"), cfg["prefix"]))
    if a.check:
        o = check(cfg, out_dir, a.app, len(rep["clashes"]))
        print("round trip through the app: " + json.dumps({k: o.get(k) for k in ("errors", "staff", "staffTotal", "cycle", "inPlace", "assigns", "byType", "ownHours", "zoneClashes", "leave", "uaDays", "uaConflicts", "skipped", "renders", "exportCells", "differences")}, ensure_ascii=False))
        if o["differences"]:
            print("DIFFERENCES between the files and what landed:\n  - " + "\n  - ".join(o["differences"])); sys.exit(1)
    if a.compare:
        xd, n = export_differences(cfg, aoa_of(out_dir / (cfg["prefix"] + "-roster-" + cfg["cycle"]["start"] + ".xlsx")), pathlib.Path(a.compare).read_text(encoding="utf-8-sig"))
        print("export compare: %s of the app's export against the roster file, %s" % (count(n, "cell"), count(len(xd), "difference")))
        if xd: print("  - " + "\n  - ".join(xd)); sys.exit(1)


if __name__ == "__main__":
    main()
