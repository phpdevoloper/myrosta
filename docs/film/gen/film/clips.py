# Image-to-video for the storyboard frames. Usage: python3 clips.py <veo3_1|veo3_1_lite> [n ...]   (4 jobs at a time)
# Output: <model>/F<nn>.mp4 + .json beside it. Each clip = frame F<nn>.png as the start image + its motion prompt + the style block.
import json,subprocess,os,sys,urllib.request,shutil
HERE=os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
model=sys.argv[1]; want=[int(x) for x in sys.argv[2:]]
d=json.load(open("motion.json")); clips=[c for c in d["clips"] if not want or c["n"] in want]
os.makedirs(model,exist_ok=True)
def cmd(c):
    p=c["p"]+d["style"]; base=["higgsfield","generate","create",model,"--prompt",p,"--aspect_ratio","16:9","--duration",str(c["d"])]
    if model=="veo3_1": base+=["--quality","high"]
    if model=="veo3_1_lite": base+=["--generate_audio","true"]
    if model=="kling3_0": base=["higgsfield","generate","create",model,"--prompt",p,"--aspect_ratio","16:9","--duration","5","--mode","pro","--sound","on"]
    return base+["--image",f"F{c['n']:02d}.png","--wait","--wait-timeout","20m","--json"]
for i in range(0,len(clips),4):
    batch=clips[i:i+4]; procs=[]
    for c in batch:
        b=f"{model}/F{c['n']:02d}"; procs.append((c["n"],b,subprocess.Popen(cmd(c),stdout=open(b+".json","w"),stderr=open(b+".err","w"))))
    for n,b,pr in procs:
        pr.wait()
        try: j=json.load(open(b+".json")); j=j[0] if isinstance(j,list) else j; url=j.get("result_url"); st=j.get("status")
        except Exception as e: url=None; st="nojson %s"%e
        if url:
            with urllib.request.urlopen(url,timeout=300) as r, open(b+".mp4","wb") as o: shutil.copyfileobj(r,o)
            print(f"F{n:02d}: {st} {os.path.getsize(b+'.mp4')} bytes",flush=True)
        else: print(f"F{n:02d}: FAILED exit {pr.returncode} {st} :: {open(b+'.err').read()[:300]}",flush=True)
print("done")
