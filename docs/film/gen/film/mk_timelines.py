# Builds the v3 timelines (staff-first opening, two-phone approval, reassurance + leave lines, hook card) from the v2 ones,
# keeping every existing segment's fields. Usage: python3 mk_timelines.py [--bookend]   (--bookend adds F13 before F12)
import json,sys
BOOKEND="--bookend" in sys.argv
def load(f): return json.load(open(f))
def by_id(t): return {s["id"]:dict(s) for s in t["segments"]}
def nar(src,after,offset=0): return {"src":f"../aud/{src}.mp3","after":after,"offset":offset}
# ---- master
m=load("timeline-master-v2-leave-kling.json"); b=by_id(m)
hook={"id":"hook","src":"hookcard-16x9.png","kind":"still","dur":2.4}
r1=b["r1"]; r1["dur"]=7.0
r5={"id":"r5","kind":"phone2","src":"R5.mp4","in":0.6,"end":3.6,"src2":"R5L.mp4","in2":0,"dur":10}
r8=b["r8"]; r8["dur"]=16.4   # all of R8 after its 0.6 s head; the assembler clamps dur to the file length anyway
r7=b["r7"]; r7["dur"]=13.0   # the daughter's line opens F13 at 0.0 s, so the reminder line must finish inside R7
f13={"id":"f13","src":"veo3_1/F13.mp4","dur":5.0}   # the lines end at 3.6 s; after 5 s the camera swings round as she leaves
order=["hook","f03","f02","f01","r1","f04","r2","r2b","f05","r3","f06","f07","r4","f08","f09","r5","r8","f10","r6","f11","r7"]+(["f13"] if BOOKEND else [])+["f12","end"]
b.update({"hook":hook,"r5":r5,"f13":f13})
b["f04"]=dict(b["f04"]); b["f04"]["ashift"]=0.06
b["f10"]=dict(b["f10"]); b["f10"]["ashift"]=0.05   # take 3 of the office clip: both voices lead the lips by 40-80 ms   # take 2 of the café clip: its voice leads the lips by ~80 ms
segs=[b[i] for i in order]
narr=[nar("N0","hook",1.4),nar("N1a","f02",4.2),nar("N1b","f01",5.3),nar("N2v2","f04",4.4),nar("N2b","r2b",0.4),nar("N3","f07",0),nar("N3r","r5",1.2),nar("N3bv2","r8",-1.6),nar("N4","f10",5.75),nar("N5","r7",6.0),nar("N5a","r7",9.2),nar("N6","f12",1.2)]
json.dump({"fps":24,"segments":segs,"narration":narr,"music":m["music"]},open("timeline-master.json","w"),indent=1)
# ---- 90 s cut (was the 85 s cut)
c=load("timeline-cut85-v2.json"); cb=by_id(c)
f02=cb.get("f02") or dict(b["f02"]); f02=dict(f02); f02["dur"]=5.2
f01=dict(cb["f01"]); f01["dur"]=5.6
r5c=dict(r5); r5c["dur"]=7.0
r8c=dict(cb["r8"]); r8c["in"]=4.4; r8c["dur"]=12.0
cb.update({"hook":dict(hook),"f02":f02,"f01":f01,"r5":r5c,"r8":r8c})
corder=["hook","f03","f02","f01","f04","r2","f06","f07","r4","f09","r5","r8","f12","end"]
for i in corder:
    if i not in cb: cb[i]=dict(b[i])
cb["f04"]=dict(cb["f04"]); cb["f04"]["ashift"]=0.06
csegs=[cb[i] for i in corder]
old={n["src"].split("/")[-1][:-4]:n for n in c["narration"]}
cnarr=[nar("N0","hook",1.4),nar("N1a","f02",4.1),nar("N2v2","f04",4.4),old["N3s"],nar("N3r","r5",1.0),nar("N3bsv2","r8",-0.2),old["N6s"]]
json.dump({"fps":24,"segments":csegs,"narration":cnarr,"music":c["music"]},open("timeline-cut90.json","w"),indent=1)
# ---- 42 s cut
s=load("timeline-cut35-v2.json"); sb=by_id(s); sb["hook"]=dict(hook); sb["f03"]=dict(b["f03"])
sb["end"]=dict(sb["end"]); sb["end"]["dur"]=13.5
sorder=["hook","f03","f06","f07","r4","f09","end"]
ssegs=[sb[i] for i in sorder]
sold={n["src"].split("/")[-1][:-4]:n for n in s["narration"]}
sold["N6s"]=dict(sold["N6s"]); sold["N6s"]["offset"]=5.2
snarr=[nar("N0","hook",1.4)]+[sold[k] for k in ("N3s","N6s") if k in sold]
json.dump({"fps":24,"segments":ssegs,"narration":snarr,"music":s["music"]},open("timeline-cut42.json","w"),indent=1)
print("timelines written: master", len(segs), "segs; cut90", len(csegs), "; cut42", len(ssegs))
