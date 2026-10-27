#!/usr/bin/env python3
"""leave-sim.py — what a Leave-planner import would do, before anyone presses Import.

Runs the workbook through the app's OWN parser and importer (parseLeaveAOA + applyLeaveImport from app.html,
under JavaScriptCore with tests/stubs.js), seeded with the staff named in the app's roster export, and prints
what the app would add: people matched, people it would CREATE (a name it can't match), leave blocks by code,
and the blocks per person (to a CSV, never to the screen).

    python3 tools/leave-sim.py "upload.xlsx" --export roster-2026-09-28-4.xls [--csv blocks.csv] [--any-filled]"""
import argparse,datetime,json,os,re,subprocess,sys,tempfile,pathlib,csv
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from rostergrid import from_export
ROOT=pathlib.Path(__file__).resolve().parent.parent
def aoa_of(path):
    import openpyxl
    wb=openpyxl.load_workbook(path,data_only=True,read_only=True); ws=wb[wb.sheetnames[0]]
    return [[(v.strftime("%Y-%m-%d") if isinstance(v,(datetime.datetime,datetime.date)) else v) for v in r] for r in ws.iter_rows(values_only=True)]
def run_app(aoa,names,any_filled):
    html=(ROOT/"app.html").read_text(encoding="utf-8"); app=max(re.findall(r"<script>(.*?)</script>",html,re.S),key=len); stubs=(ROOT/"tests/stubs.js").read_text(encoding="utf-8")
    driver="""
var IN=%s;
S={zones:[],staffing:{amMin:1,amMax:9,pmMin:1,pmMax:9},staff:IN.names.map(function(n,i){return {id:"s"+(i+1),name:n,initials:"",mobile:"",email:"",mode:"self",quota:20,eft:1,hrsFortnight:76};}),
   cycles:[{id:"c1",cycle:{start:"2026-09-28",weeks:8},assign:{},status:"published",archived:false,settings:{},roles:{}}],activeId:"c1",viewAs:"admin",tab:"my",requests:[],leave:[],audit:[],notifications:[],messages:[],feedback:[]};
try{normalize();}catch(e){}
var p=parseLeaveAOA(IN.aoa,{anyFilled:IN.anyFilled}); if(p.error) JSON.stringify({error:p.error}); else {
var before=S.staff.length; var eftBefore=S.staff.map(function(s){return [s.eft,s.hrsFortnight];});
var added=applyLeaveImport(p);
var byCode={}, perPerson={}; (S.leave||[]).forEach(function(L){ byCode[L.code]=(byCode[L.code]||0)+1; var nm=(S.staff.find(function(s){return s.id===L.staffId;})||{}).name||L.staffId; (perPerson[nm]=perPerson[nm]||[]).push([L.from,L.to,L.code,L.status,L.requestId]); });
var eftChanged=S.staff.slice(0,before).filter(function(s,i){return s.eft!==eftBefore[i][0]||s.hrsFortnight!==eftBefore[i][1];}).length;
JSON.stringify({parsedStaff:p.staff.length,parsedBlocks:p.leave.length,range:p.range,added:added,newStaff:S.staff.slice(before).map(function(s){return s.name;}),byCode:byCode,perPerson:perPerson,eftChanged:eftChanged,audit:(S.audit||[]).slice(-1)}); }
""" % json.dumps({"aoa":aoa,"names":names,"anyFilled":bool(any_filled)})
    with tempfile.NamedTemporaryFile("w",suffix=".js",delete=False,encoding="utf-8") as f: f.write(stubs+app+"\n"+driver); path=f.name
    try:
        out=subprocess.run(["osascript","-l","JavaScript",path],capture_output=True,text=True); txt=(out.stdout or "").strip()
    finally: os.unlink(path)
    if not txt.startswith("{"): sys.exit("the app's importer did not run: "+((out.stderr or "")+txt)[-600:])
    return json.loads(txt)
def main():
    ap=argparse.ArgumentParser(); ap.add_argument("upload"); ap.add_argument("--export",required=True); ap.add_argument("--csv"); ap.add_argument("--any-filled",action="store_true"); a=ap.parse_args()
    names=[str(r[0]).strip() for r in from_export(a.export)[1:] if str(r[0]).strip()]
    res=run_app(aoa_of(a.upload),names,a.any_filled)
    if "error" in res: sys.exit("the app refused the sheet: "+res["error"])
    print(f"people in the sheet: {res['parsedStaff']} · blocks: {res['parsedBlocks']} · span {res['range']['from']} → {res['range']['to']}")
    print(f"the app would add {res['added']} leave blocks: {res['byCode']}")
    print(f"people it would CREATE (names it can't match): {len(res['newStaff'])}   EFT/hours changed: {res['eftChanged']}")
    print("audit:",res["audit"][0]["detail"] if res["audit"] and isinstance(res["audit"][0],dict) and "detail" in res["audit"][0] else res["audit"])
    if a.csv:
        with open(a.csv,"w",newline="") as f:
            w=csv.writer(f); w.writerow(["person","from","to","code","status","source"])
            for nm,bl in sorted(res["perPerson"].items()):
                for b in bl: w.writerow([nm]+b)
        print("blocks per person →",a.csv)
if __name__=="__main__": main()
