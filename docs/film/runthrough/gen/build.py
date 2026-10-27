#!/usr/bin/env python3
"""Builds and renders one run-through chapter (or a whole film) from rt/chapters.json.
   python3 build.py S1            -> vid/rt-S1.mp4 (+ -captioned, -720p) from the chapter card, the openers, the takes with their step labels, the narration
   python3 build.py S1 --9x16     -> the vertical version (staff chapters)
   python3 build.py film staff    -> concatenates the film's chapters in order into vid/rt-staff.mp4 (+ captioned + 720p)
A chapter: {"id":"S1","card":"S1","opener":"veo3_1/F03.mp4","narration":"S1","narr_offset":-0.2,
            "segments":[{"take":"S1"},{"take":"S1b","dur":6},{"card":"HOME","dur":6}], "hold": true}
A take segment is a phone (or laptop) recording in rt/clips/<take>.mp4 with its step log in rt/logs/<take>.json; "in"/"dur" trim it;
"laptop": true renders it full-frame (a clip) instead of on the phone plate. The chapter is padded (last take held) so the narration ends inside it."""
import json,os,sys,subprocess,re,shutil
RECAPTION=False
RT=os.path.dirname(os.path.abspath(__file__)); VID=os.path.join(RT,"..","vid"); CARDS="/Users/ranjithkandavelu/Desktop/Claude/Myrosta/.playwright-mcp/rt/cards"
FF=open(os.path.join(VID,"ffmpeg.path")).read().strip()
def dur(p):
    r=subprocess.run([FF,"-i",p],capture_output=True,text=True); m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr); return int(m[1])*3600+int(m[2])*60+float(m[3])
def pad_clip(src,extra):   # hold the last frame for `extra` seconds: a new file beside the take
    out=src.replace(".mp4",f"-pad{int(round(extra*10))}.mp4")
    if not os.path.exists(out) or os.path.getmtime(out)<os.path.getmtime(src):   # a padded copy older than its take is stale: a re-recorded take with the same sync length used to inherit the old frames (12 Oct 2026)
        subprocess.run([FF,"-y","-loglevel","error","-i",src,"-vf",f"tpad=stop_mode=clone:stop_duration={extra:.2f}","-an","-c:v","libx264","-preset","medium","-crf","15","-pix_fmt","yuv420p",out],check=True)
    return out
def chapter_timeline(ch,vertical):
    fmt="9x16" if vertical else "16x9"; segs=[]; nar=[]
    cardfile=os.path.join(CARDS,f"{ch['card']}-{fmt}.png") if ch.get("card") else None
    if cardfile: segs.append({"id":"card","src":cardfile,"kind":"still","dur":float(ch.get("card_dur",2.4))})
    if ch.get("opener") and not vertical: segs.append({"id":"opener","src":os.path.join(VID,ch["opener"]),"vol":0.0,"dur":float(ch.get("opener_dur",3.0)),"cx":float(ch.get("opener_cx",0.5))})
    for i,sg in enumerate(ch["segments"]):
        sid=f"s{i}"
        if "card" in sg: segs.append({"id":sid,"src":os.path.join(CARDS,f"{sg['card']}-{fmt}.png"),"kind":"still","dur":float(sg.get("dur",5))}); continue
        if "still" in sg: segs.append({"id":sid,"src":sg["still"],"kind":"still","dur":float(sg.get("dur",5))}); continue
        take=(sg["take_v"] if vertical and sg.get("take_v") else sg["take"]); src=os.path.join(RT,"clips",take+".mp4"); logp=os.path.join(RT,"logs",take+".json")
        steps=[]
        if os.path.exists(logp) and sg.get("steps",True):
            lg=json.load(open(logp)); tin=float(sg.get("in",0)); 
            for e in lg.get("log",[]):
                if "label" in e and e["t"]-tin>=0: steps.append({"at":round(e["t"]-tin,2),"text":e["label"]})
        s={"id":sid,"src":src}
        if sg.get("laptop"): s.update({"crop_banner":int(sg.get("crop_banner",40))})
        else: s.update({"kind":"phone","pcrop":int(sg.get("pcrop",140))})
        if "in" in sg: s["in"]=float(sg["in"])
        if "dur" in sg: s["dur"]=float(sg["dur"])
        if steps: s["steps"]=steps
        segs.append(s)
    if ch.get("narration"):
        nar.append({"src":narr_file(ch["narration"],vertical),"after":"card" if cardfile else segs[0]["id"],"offset":float(ch.get("narr_offset",(segs[0]["dur"]-0.2) if cardfile else 0.0))})
    return {"fps":24,"format":fmt,"segments":segs,"narration":nar,"music":{"src":os.path.join(VID,"..","aud","music.m4a"),"vol":float(ch.get("music",0.12))}}
def narr_file(key,vertical):
    """the delivered chapter's own mix (aud/<key>.m4a, aud/<key>-9x16.m4a for the vertical cut) when it exists — the 9 Oct rebuild reuses it, placed at the chapter start — else a fresh narration mp3"""
    c=[os.path.join(RT,"aud",key+("-9x16" if vertical else "")+".m4a"),os.path.join(RT,"aud",key+".m4a"),os.path.join(RT,"aud",key+".mp3")]
    return next(x for x in c if os.path.exists(x))
def seg_len(s):
    if s.get("kind")=="still": return float(s["dur"])
    full=dur(s["src"]); tin=float(s.get("in",0)); d=float(s.get("dur",full-tin)); return min(d,full-tin)
def fit_narration(tl,ch):
    """pads the chapter so the narration (plus a tail) ends inside it: the last take is held, or a trailing still is added"""
    if not tl["narration"]: return tl
    n=tl["narration"][0]; nd=dur(n["src"]); total=sum(seg_len(s) for s in tl["segments"]); start=sum(seg_len(s) for s in tl["segments"] if False)
    # the narration starts at the card's end-0.2 (offset is relative to the 'after' segment start)
    idx=[i for i,s in enumerate(tl["segments"]) if s["id"]==n["after"]][0]; at=sum(seg_len(s) for s in tl["segments"][:idx])+n["offset"]
    need=at+nd+float(ch.get("tail",1.0))-total
    if need>0.05:
        last=[s for s in tl["segments"] if s.get("kind")!="still"]
        if last and last[-1] is tl["segments"][-1]:
            s=tl["segments"][-1]; base=seg_len(s); s["src"]=pad_clip(s["src"],need+0.2) if s.get("kind")=="phone" or True else s["src"]; s["dur"]=round(base+need+0.2,2)
        else: tl["segments"][-1]["dur"]=round(float(tl["segments"][-1]["dur"])+need,2)
    return tl
def render(ch,vertical):
    tl=fit_narration(chapter_timeline(ch,vertical),ch); name=f"rt-{ch['id']}"+("-9x16" if vertical else "")
    tlp=os.path.join(VID,f"timeline-{name}.json"); json.dump(tl,open(tlp,"w"),indent=1)
    out=f"{name}.mp4"
    if RECAPTION and os.path.exists(os.path.join(VID,out)): pass   # keep the render, redo the captions and the 720p copy
    else:
        subprocess.run(["rm","-rf",os.path.join(VID,"seg_"+name)]); r=subprocess.run(["python3","assemble.py",f"timeline-{name}.json",out],cwd=VID,capture_output=True,text=True); open(os.path.join(VID,f"render_{name}.log"),"w").write(r.stdout+r.stderr)
        if r.returncode or "done" not in r.stdout: print(r.stdout[-800:],r.stderr[-800:]); raise SystemExit("render failed: "+name)
    # segment starts (for the VTT), then the 720p copy from the clean render and the caption file beside it — nothing burned in since 9 Oct 2026
    starts={}; acc=0.0
    for i,s in enumerate(tl["segments"]):
        f=os.path.join(VID,"seg_"+name,f"{i:02d}.mov"); starts[s["id"]]=round(acc,3); acc+=dur(f)
    json.dump(starts,open(os.path.join(VID,f"seg_starts_{name}.json"),"w"))
    w="720:-2" if vertical else "1280:-2"
    subprocess.run([FF,"-y","-loglevel","error","-i",os.path.join(VID,out),"-vf",f"scale={w}","-c:v","libx264","-preset","medium","-crf","20","-pix_fmt","yuv420p","-movflags","+faststart","-c:a","aac","-b:a","160k",os.path.join(VID,f"{name}-720p.mp4")],check=True)
    if ch.get("narration"):
        c=subprocess.run(["python3",os.path.join(RT,"vtt.py"),ch["id"],"--9x16" if vertical else "--16x9"],capture_output=True,text=True)
        if c.returncode: print(c.stdout[-600:],c.stderr[-600:]); raise SystemExit("vtt failed")
    print(f"{name}: {acc:.2f} s, {len(tl['segments'])} segments; 720p + vtt")
    return name,acc
def film(key):
    chs=json.load(open(os.path.join(RT,"chapters.json"))); order=[c for c in chs["films"][key]]
    lst=os.path.join(VID,f"rt-{key}-list.txt"); open(lst,"w").write("".join(f"file '{os.path.join(VID,'rt-'+c+'.mp4')}'\n" for c in order))
    out=os.path.join(VID,f"rt-{key}.mp4"); subprocess.run([FF,"-y","-loglevel","error","-f","concat","-safe","0","-i",lst,"-c","copy",out],check=True)
    subprocess.run([FF,"-y","-loglevel","error","-i",out,"-vf","scale=1280:-2","-c:v","libx264","-preset","medium","-crf","20","-pix_fmt","yuv420p","-movflags","+faststart","-c:a","aac","-b:a","160k",os.path.join(VID,f"rt-{key}-720p.mp4")],check=True)
    # the film's captions: each chapter's cues shifted by where the chapter starts
    cues=[]; at=0.0
    for c in order:
        vp=os.path.join(VID,f"rt-{c}.vtt")
        if os.path.exists(vp):
            for blk in open(vp,encoding="utf-8").read().split("\n\n")[1:]:
                ln=blk.strip().split("\n")
                if len(ln)<2 or "-->" not in ln[0]: continue
                a,b=[tsv(x.strip()) for x in ln[0].split("-->")]; cues.append((a+at,b+at,"\n".join(ln[1:])))
        at+=dur(os.path.join(VID,f"rt-{c}.mp4"))
    open(os.path.join(VID,f"rt-{key}.vtt"),"w",encoding="utf-8").write("WEBVTT\n\n"+"".join(f"{fts(a)} --> {fts(b)}\n{t}\n\n" for a,b,t in cues))
    print(f"film {key}: {dur(out):.2f} s, {len(order)} chapters, {len(cues)} cues")
def tsv(x):
    h,m,sec=x.split(":"); return int(h)*3600+int(m)*60+float(sec)
def fts(t):
    h=int(t//3600); m=int(t%3600//60); sec=t%60; return f"{h:02d}:{m:02d}:{sec:06.3f}"
if __name__=="__main__":
    a=sys.argv[1:]
    if a and a[0]=="film": film(a[1]); raise SystemExit
    chs=json.load(open(os.path.join(RT,"chapters.json")))["chapters"]; vertical="--9x16" in a; RECAPTION="--recaption" in a
    for cid in [x for x in a if not x.startswith("--")]:
        ch=[c for c in chs if c["id"]==cid][0]; render(ch,vertical)
