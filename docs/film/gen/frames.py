# Generates the twelve storyboard keyframes with Nano Banana Pro, each with the right portrait(s) as image references,
# four at a time; downloads each result next to its JSON. Usage: python3 frames.py [frame numbers...]
import json,subprocess,os,sys,time,urllib.request,shutil
SP=os.path.dirname(os.path.abspath(__file__)); os.chdir(SP)
d=json.load(open("prompts.json")); want=[int(x) for x in sys.argv[1:]] or [f["n"] for f in d["frames"]]
REF={"emma":"portrait_emmaA.png","sam":"portrait_samB.png","alex":"portrait_alexA.png","morgan":"portrait_morgan.png"}
def cmd_for(f):
    p=f["prompt"]+" "+d["style"]+(" "+d["screens"] if f["screen"] else "")+" "+d["neg"]
    c=["higgsfield","generate","create","nano_banana_pro","--prompt",p,"--aspect_ratio","16:9","--resolution","2k"]
    for r in f["refs"]: c+=["--image",REF[r]]
    for x in f.get("ref_files",[]): c+=["--image",x]
    c+=["--wait","--wait-timeout","10m","--json"]; return c
frames=[f for f in d["frames"] if f["n"] in want]
for i in range(0,len(frames),4):
    batch=frames[i:i+4]; procs=[]
    for f in batch:
        n=f["n"]; procs.append((n,subprocess.Popen(cmd_for(f),stdout=open(f"frame_{n:02d}.json","w"),stderr=open(f"frame_{n:02d}.err","w"))))
    for n,pr in procs:
        pr.wait(); ok=pr.returncode==0
        try:
            j=json.load(open(f"frame_{n:02d}.json")); url=(j[0] if isinstance(j,list) else j).get("result_url"); status=(j[0] if isinstance(j,list) else j).get("status")
        except Exception as e: url=None; status="no json: %s" % e
        if url:
            with urllib.request.urlopen(url,timeout=120) as r, open(f"frame_{n:02d}.png","wb") as o: shutil.copyfileobj(r,o)
            print(f"frame {n:02d}: {status}, {os.path.getsize(f'frame_{n:02d}.png')} bytes", flush=True)
        else: print(f"frame {n:02d}: FAILED exit {pr.returncode} {status} :: {open(f'frame_{n:02d}.err').read()[:200]}", flush=True)
print("done")
