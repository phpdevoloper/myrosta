#!/usr/bin/env python3
"""regen_f10.py — the office scene again, with the coffees kept in Sam's hands: Veo 3.1 from F10.png, two takes in parallel → veo3_1/F10-cups1.mp4, F10-cups2.mp4"""
import json,subprocess,os,urllib.request,shutil
MJ="/Users/ranjithkandavelu/Desktop/Claude/Myrosta/docs/film/gen/film/motion.json"; d=json.load(open(MJ)); c=[x for x in d["clips"] if x["n"]==10][0]
p=("One continuous shot, no cuts. Morgan O'Brien, 52, reading glasses pushed up, navy blazer, reads a laptop in a small hospital office; "
   "Sam Patel in teal scrubs leans in at the door holding two takeaway coffees, one in each hand, and keeps holding both the whole time; "
   "nothing is set down, and the desk holds only the laptop and a folder. Morgan, not looking up, says: \"So that's everyone.\" "
   "Sam answers, speaking clearly with his lips moving on each word, not grinning: \"Five rosters. One heading.\" Quiet office ambience.")+d["style"]
c["p_cups"]=p; json.dump(d,open(MJ,"w"),indent=1,ensure_ascii=False)
procs=[]
for k in (1,2):
    procs.append((k,subprocess.Popen(["higgsfield","generate","create","veo3_1","--prompt",p,"--aspect_ratio","16:9","--duration","8","--quality","high","--image","F10.png","--wait","--wait-timeout","20m","--json"],stdout=open(f"veo3_1/F10-cups{k}.json","w"),stderr=open(f"veo3_1/F10-cups{k}.err","w"))))
for k,pr in procs:
    pr.wait()
    try:
        j=json.load(open(f"veo3_1/F10-cups{k}.json")); j=j[0] if isinstance(j,list) else j; url=j.get("result_url")
    except Exception as e: url=None; print(k,"json error",e)
    if url:
        with urllib.request.urlopen(url,timeout=300) as r, open(f"veo3_1/F10-cups{k}.mp4","wb") as o: shutil.copyfileobj(r,o)
        print("take",k,"saved",os.path.getsize(f"veo3_1/F10-cups{k}.mp4")//1024,"KB")
    else: print("take",k,"FAILED",open(f"veo3_1/F10-cups{k}.err").read()[:300])
