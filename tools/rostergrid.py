#!/usr/bin/env python3
"""grid.py — reads a consultant roster workbook's Roster sheet (or the app's HTML .xls export) into {name: {date: cell}} with the cells normalised the way the app reads them"""
import openpyxl,datetime,re,sys,html as H
from html.parser import HTMLParser
def norm(v):
    if v is None: return ""
    s=re.sub(r"\s+"," ",str(v)).strip().upper()
    return s
def from_xlsx(path):
    wb=openpyxl.load_workbook(path,data_only=True,read_only=True); ws=wb["Roster"]; rows=list(ws.iter_rows(values_only=True))
    # the date header: the row with the most date cells
    def iso(v):
        if isinstance(v,(datetime.datetime,datetime.date)): return v.strftime("%Y-%m-%d")
        if isinstance(v,str) and re.match(r"^\d{4}-\d{2}-\d{2}",v): return v[:10]
        return None
    hr=max(range(min(20,len(rows))),key=lambda i: sum(1 for v in rows[i] if iso(v)))
    dcols=[(c,iso(v)) for c,v in enumerate(rows[hr]) if iso(v)]
    grid={}
    for r in rows[hr+1:]:
        name=norm(r[0]) if r and r[0] is not None else ""
        if not name or not re.search(r"[A-Z]",name): continue
        if re.search(r"[0-9()\[\]–—]",name) or len(name.replace(","," ").split())>4: continue   # the template's check rows, as the app skips them
        if re.match(r"^(DATE|TOTAL|ANNUAL|CME|LONG SERVICE|UNAVAIL|PUBLIC HOL|NO OF STAFF|EFT OFF|TERM|SCHOOL HOL|CONF|RESIGN|VACANT|LOCUM|GAP|COVER|NOTES?|COMMENTS?|ROSTER|STAFF|NAME|CONSULTANT|REGISTRAR|TBA|TBD|N/?A|DOUBLE|UNRECOGNISED|SSU ENTERED|ENTRY INTEGRITY)",name): continue
        grid[name]={d:norm(r[c]) for c,d in dcols if c<len(r)}
    return grid,[d for _,d in dcols]
class T(HTMLParser):
    def __init__(s): super().__init__(); s.rows=[]; s.row=None; s.cell=None
    def handle_starttag(s,t,a):
        if t=="tr": s.row=[]
        elif t in("td","th") and s.row is not None: s.cell=[]
    def handle_endtag(s,t):
        if t in("td","th") and s.cell is not None and s.row is not None: s.row.append(" ".join(s.cell).strip()); s.cell=None
        elif t=="tr" and s.row is not None: s.rows.append(s.row); s.row=None
    def handle_data(s,d):
        if s.cell is not None: s.cell.append(d)
def from_export(path):
    p=T(); p.feed(open(path,encoding="utf-8").read()); rows=[r for r in p.rows if r]
    return rows
if __name__=="__main__":
    g,ds=from_xlsx(sys.argv[1]); print(len(g),"people",len(ds),"days",ds[0],"→",ds[-1]); print(sorted(g)[:3])
