#!/usr/bin/env python3
"""roster-sim.py — what a Roster-template import would do, before anyone presses Import.

Runs the workbook through the app's OWN parser and importer (parseRosterAOA + applyRosterImport from
app.html, under JavaScriptCore with tests/stubs.js), then prints what the app would hold afterwards.
With the app's roster export (Roster → Export → .xls, the HTML table) it also lists every cell that
would change for the people already in the app, and checks that the grid after the import equals the
file (any difference there means the app reads a cell differently from the way you expect).

    python3 tools/roster-sim.py "upload.xlsx"                       # fresh import: summary + new people
    python3 tools/roster-sim.py "upload.xlsx" --export roster-2026-09-28-3.xls   # update-in-place of that cycle
    python3 tools/roster-sim.py "upload.xlsx" --export roster-2026-09-28-3.xls --csv changes.csv

Nothing here touches the live app or the cloud: the run is a throwaway copy of the app's state in memory.
Keep real workbooks and exports out of the repo (they hold staff names); run this from wherever they live.
The "+OC" evening label of a zone (ROC+OC PM) is folded onto the zone (ROC PM) before comparing, because the
offline copy has no zone labels; real zones keep their labels on the live app.
"""
import sys,os,re,json,csv,argparse,datetime,subprocess,tempfile,pathlib
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from rostergrid import from_export, norm
ROOT=pathlib.Path(__file__).resolve().parent.parent
def aoa_of(path):
    import openpyxl
    wb=openpyxl.load_workbook(path,data_only=True,read_only=True); ws=wb["Roster"] if "Roster" in wb.sheetnames else wb[wb.sheetnames[0]]
    return [[(v.strftime("%Y-%m-%d") if isinstance(v,(datetime.datetime,datetime.date)) else v) for v in r] for r in ws.iter_rows(values_only=True)]
def fold(v): return re.sub(r"\+\s*OC\b","",v or "",flags=re.I).replace("  "," ").strip()
def run_app(aoa,names,start):
    html=(ROOT/"app.html").read_text(encoding="utf-8"); app=max(re.findall(r"<script>(.*?)</script>",html,re.S),key=len); stubs=(ROOT/"tests/stubs.js").read_text(encoding="utf-8")
    driver="""
var IN=%s;
S={zones:[],staffing:{amMin:1,amMax:9,pmMin:1,pmMax:9},staff:IN.names.map(function(n,i){return {id:"s"+(i+1),name:n,initials:"",mobile:"",email:"",mode:"self",quota:20,eft:1,hrsFortnight:76};}),
   cycles:IN.start?[{id:"c1",cycle:{start:IN.start,weeks:8},assign:{},status:"published",archived:false,settings:{}}]:[],activeId:IN.start?"c1":null,viewAs:"admin",tab:"my",requests:[],leave:[],audit:[],notifications:[],messages:[],feedback:[]};
try{normalize();}catch(e){}
var p=parseRosterAOA(IN.aoa); if(p.error) JSON.stringify({error:p.error}); else {
var nShifts=Object.keys(p.assigns).length; var match=(S.cycles||[]).find(function(c){return !c.archived&&c.cycle&&c.cycle.start===p.dates[0];});
var cyc=applyRosterImport(p,match||null);
var grid={}; S.staff.forEach(function(s){ grid[s.name]={}; p.dates.forEach(function(d){ var sh=getShift(s.id,d); grid[s.name][d]= sh.kind==="off"?"":(sh.kind==="leave"?sh.code:(sh.kind==="cst"?"CST":((zoneById(sh.zone)||{}).name||"?")+" "+sh.period)); }); });
JSON.stringify({updateInPlace:!!match,status:cyc.status,dates0:p.dates[0],nDates:p.dates.length,nStaff:p.staff.length,nShifts:nShifts,skipped:p.skipped||[],newStaff:S.staff.slice(IN.names.length).map(function(s){return s.name;}),grid:grid}); }
""" % json.dumps({"aoa":aoa,"names":names,"start":start})
    with tempfile.NamedTemporaryFile("w",suffix=".js",delete=False,encoding="utf-8") as f: f.write(stubs+app+"\n"+driver); path=f.name
    try:
        out=subprocess.run(["osascript","-l","JavaScript",path],capture_output=True,text=True); txt=(out.stdout or "").strip()
    finally: os.unlink(path)
    if not txt.startswith("{"): sys.exit("the app's importer did not run: "+((out.stderr or "")+txt)[-600:])
    return json.loads(txt)
def main():
    ap=argparse.ArgumentParser(); ap.add_argument("upload"); ap.add_argument("--export",help="the app's roster export (.xls HTML table) of the cycle being updated"); ap.add_argument("--csv",help="write the cell changes here"); a=ap.parse_args()
    aoa=aoa_of(a.upload); names=[]; app={}
    if a.export:
        rows=from_export(a.export); hdr=rows[0]
        def iso_of(h):
            m=re.search(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?",h or ""); return None if not m else (f"{int(m[3]) if m[3] and len(m[3])==4 else datetime.date.today().year}-{int(m[2]):02d}-{int(m[1]):02d}")
        cols=[(i,iso_of(h)) for i,h in enumerate(hdr) if iso_of(h)]
        names=[r[0].strip() for r in rows[1:] if norm(r[0])]; app={norm(r[0]):{d:fold(norm(r[i]) if i<len(r) else "") for i,d in cols} for r in rows[1:] if norm(r[0])}
    first=next((v for r in aoa[:20] for v in r if isinstance(v,str) and re.match(r"^\d{4}-\d{2}-\d{2}$",v)),None)
    r=run_app(aoa,names,first if a.export else None)
    if "error" in r: sys.exit("Roster import: "+r["error"])
    print(f"{'UPDATE-IN-PLACE of the cycle starting '+r['dates0'] if r['updateInPlace'] else 'NEW cycle starting '+r['dates0']} · status {r['status']}")
    print(f"the import dialog should read: Staff: {r['nStaff']} · Days: {r['nDates']} ({r['dates0']} → {max(d for g in r['grid'].values() for d in g) if r['grid'] else '?'}) · Shifts: {r['nShifts']}")
    print("new people the import would create:",r["newStaff"] or "none"); print("rows not added:",[(s["name"],s["why"]) for s in r["skipped"]] or "none")
    if not a.export: return
    grid={norm(n):{d:fold(v) for d,v in g.items()} for n,g in r["grid"].items()}; dates=sorted({d for g in grid.values() for d in g})
    # the file re-read through the same cell rules, to prove the after-import grid IS the file
    vocab=lambda v:(lambda s,m: fold(f"{m[3]} {'AM' if int(m[1])<1200 else 'PM'}") if m else fold(s))(norm(v),re.match(r"^(\d{3,4})-(\d{3,4})\s+(.+)$",norm(v)))
    hr=next(i for i,row in enumerate(aoa[:20]) if sum(1 for v in row if isinstance(v,str) and re.match(r"^\d{4}-\d{2}-\d{2}$",v))>5); dcols=[(c,v) for c,v in enumerate(aoa[hr]) if isinstance(v,str) and re.match(r"^\d{4}-\d{2}-\d{2}$",v)]
    filegrid={norm(row[0]):{d:vocab(row[c] if c<len(row) else "") for c,d in dcols} for row in aoa[hr+1:] if row and row[0] and norm(row[0]) in grid}
    off=[(n,d,grid[n][d],filegrid[n][d]) for n in filegrid for _,d in dcols if grid[n].get(d,"")!=filegrid[n][d]]
    print(f"after the import, grid vs file: {len(off)} differences"+(" — "+str(off[:6]) if off else " (the app reads every cell the way the file means it)"))
    ch=[(n,d,app[n][d],grid[n][d]) for n in app for _,d in cols if n in grid and app[n][d]!=grid[n].get(d,"")]
    missing=[n for n in app if n not in grid]
    print(f"cells that change for the {len(app)} people already in the app: {len(ch)}"+(f" · {sum(1 for _,d,_,_ in ch if d<datetime.date.today().isoformat())} in the past" if ch else ""))
    if missing: print("IN THE APP BUT NOT IN THE FILE (their shifts would be wiped — the import replaces every cell):",missing)
    for n,d,x,y in sorted(ch)[:400]: print(f"  {n:34} {d} {x or '(blank)':>12} -> {y or '(blank)'}")
    if a.csv:
        with open(a.csv,"w",newline="") as f: w=csv.writer(f); w.writerow(["person","date","app now","after import"]); w.writerows(sorted(ch))
        print("written:",a.csv)
if __name__=="__main__": main()
