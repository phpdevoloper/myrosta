#!/usr/bin/env python3
"""sync.py <chapter id>…   retimes a chapter's take to its narration at the step boundaries.
rt/anchors.json gives each chapter one narration phrase per step label (null = no anchor). The take is cut at its
labels; each piece is held (40% on its first frame, 60% on its last), or sped up (at most 1.5x), so the next label
appears when the narration reaches its phrase. Phrases are located in the narration through the whisper word timings (aud/words.json), aligned to
the written line (aud/lines.json) so a misheard word does not matter. Writes clips/<take>-sync.mp4 (+ -sync9 for the
vertical cut, which has no opener) and logs/<take>-sync.json, and points the chapter's segment at the synced take."""
import json,os,re,subprocess,sys,difflib
RT=os.path.dirname(os.path.abspath(__file__)); VID=os.path.join(RT,"..","vid"); FF=open(os.path.join(VID,"ffmpeg.path")).read().strip()
MAXSPEED=1.5
HOLD_BEFORE=0.4
def norm(w): return re.sub(r"[^a-z0-9']","",w.lower().replace("’","'"))
def dur(p):
    r=subprocess.run([FF,"-i",p],capture_output=True,text=True); m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr); return int(m[1])*3600+int(m[2])*60+float(m[3])
def narr_times(key):
    text=json.load(open(os.path.join(RT,"aud","lines.json")))[key]; wh=json.load(open(os.path.join(RT,"aud","words.json")))[key+".mp3"]
    off=text.split(); offn=[norm(w) for w in off]; whn=[norm(w[2]) for w in wh]
    m={}
    for a,b,n in difflib.SequenceMatcher(None,offn,whn,autojunk=False).get_matching_blocks():
        for k in range(n): m[a+k]=wh[b+k][0]
    times=[]
    for i in range(len(off)):
        if i in m: times.append(m[i]); continue
        prev=max([j for j in m if j<i],default=None); nxt=min([j for j in m if j>i],default=None)
        if prev is None and nxt is None: times.append(0.0)
        elif prev is None: times.append(m[nxt])
        elif nxt is None: times.append(m[prev])
        else: times.append(m[prev]+(m[nxt]-m[prev])*(i-prev)/(nxt-prev))
    return offn,times,len(m),len(off)
def anchor_time(offn,times,phrase):
    pn=[norm(w) for w in phrase.split()]
    for i in range(len(offn)-len(pn)+1):
        if offn[i:i+len(pn)]==pn: return times[i]
    raise SystemExit(f"anchor not found: {phrase!r}")
def plan(cuts,targets):
    """pieces (start, natural length, speed, pad) and the output start of each piece"""
    out=[0.0]; pieces=[]
    for i in range(len(cuts)-1):
        d=cuts[i+1]-cuts[i]; tgt=targets[i] if i<len(targets) else None; start=out[-1]
        if tgt is None or d<=0.02: L=d; f=1.0; pad=0.0
        else:
            want=tgt-start
            if want>=d: L=want; f=1.0; pad=want-d
            else: f=min(d/max(want,0.05),MAXSPEED); L=d/f; pad=0.0
        pieces.append((round(cuts[i],3),round(d,3),round(f,4),round(pad,3))); out.append(start+L)
    return pieces,out
def render(src,out,pieces):
    """each piece is cut and (if needed) sped up in one pass, then held in a second pass: tpad only pads a whole file
    in this ffmpeg build (after trim, or with -t, it adds nothing); the pieces are then joined without re-encoding"""
    tmp=out[:-4]+"-pieces"; os.makedirs(tmp,exist_ok=True); lst=[]
    for k,(s,d,f,pad) in enumerate(pieces):
        cut=os.path.join(tmp,f"p{k}.mp4"); enc=["-an","-c:v","libx264","-preset","medium","-crf","14","-pix_fmt","yuv420p","-r","25"]
        subprocess.run([FF,"-y","-loglevel","error","-i",src,"-vf",f"trim=start={s}:duration={d},setpts=(PTS-STARTPTS)/{f}"]+enc+[cut],check=True)
        if pad>0.02:   # 40% of the hold before the action (the step's first frame, while the narration introduces it), 60% after it (the result)
            a=round(pad*HOLD_BEFORE,3); b=round(pad-a,3)
            held=os.path.join(tmp,f"p{k}h.mp4"); subprocess.run([FF,"-y","-loglevel","error","-i",cut,"-vf",f"tpad=start_mode=clone:start_duration={a}:stop_mode=clone:stop_duration={b}"]+enc+[held],check=True); lst.append(held)
        else: lst.append(cut)
    open(os.path.join(tmp,"list.txt"),"w").write("".join(f"file '{p}'\n" for p in lst))
    subprocess.run([FF,"-y","-loglevel","error","-f","concat","-safe","0","-i",os.path.join(tmp,"list.txt"),"-c","copy",out],check=True)
    return [dur(p) for p in lst]   # the pieces as cut, to the frame: the label times are taken from these, not from the plan
def sync(ch,anchors):
    seg=[s for s in ch["segments"] if "take" in s and s.get("steps",True)][0]; take=seg.get("take_orig") or seg["take"]
    src=os.path.join(RT,"clips",take+".mp4"); lg=json.load(open(os.path.join(RT,"logs",take+".json"))); labels=lg["log"]
    if len(anchors)!=len(labels): raise SystemExit(f"{ch['id']}: {len(anchors)} anchors for {len(labels)} labels")
    offn,times,matched,n=narr_times(ch["narration"]); card=float(ch.get("card_dur",2.4)); narr0=float(ch.get("narr_offset",card-0.2))
    total=dur(src); cuts=[0.0]+[float(e["t"]) for e in labels]+[total]
    variants=[("-sync",card+(float(ch.get("opener_dur",3.0)) if ch.get("opener") else 0.0))]
    if ch.get("opener"): variants.append(("-sync9",card))
    for suffix,pre in variants:
        shift=narr0-pre; targets=[(anchor_time(offn,times,a)+shift if a else None) for a in anchors]
        pieces,out=plan(cuts,targets); name=take+suffix; lens=render(src,os.path.join(RT,"clips",name+".mp4"),pieces)
        out=[0.0]
        for L in lens: out.append(out[-1]+L)
        newlog={"take":name,"secs":round(out[-1],2),"fps":25,"log":[{"t":round(out[i+1],2),"label":labels[i]["label"]} for i in range(len(labels))],
                "sync":{"orig":take,"pre":pre,"anchors":anchors,"targets":[None if t is None else round(t,2) for t in targets],"pieces":pieces,"words_matched":f"{matched}/{n}"}}
        json.dump(newlog,open(os.path.join(RT,"logs",name+".json"),"w"),indent=1,ensure_ascii=False)
        if suffix=="-sync": seg["take_orig"]=take; seg["take"]=name
        else: seg["take_v"]=name
        got=dur(os.path.join(RT,"clips",name+".mp4")); held=sum(p[3] for p in pieces); sped=[p[2] for p in pieces if p[2]>1.0]
        print(f"{ch['id']:4s} {name:10s} {total:5.1f}s -> {out[-1]:5.1f}s (file {got:5.1f}s)  held {held:4.1f}s  sped {len(sped)} pieces (max x{max(sped) if sped else 1:.2f})  words {matched}/{n}")
if __name__=="__main__":
    P=os.path.join(RT,"chapters.json"); D=json.load(open(P)); A=json.load(open(os.path.join(RT,"anchors.json")))
    for cid in sys.argv[1:]:
        ch=[c for c in D["chapters"] if c["id"]==cid][0]; sync(ch,A[cid])
    json.dump(D,open(P,"w"),indent=1,ensure_ascii=False)
