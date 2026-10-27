#!/usr/bin/env python3
"""vtt.py <chapter id> [--9x16|--16x9]   the chapter's captions as WebVTT (vid/rt-<id>[-9x16].vtt) from the narration text (aud/lines.json)
timed by the whisper word timings (aud/words.json, file-relative) placed where the timeline puts the narration. Clause-first chunking,
as the burned captions had: units of at most two lines, lines of at most 38 characters (30 on the phone cut)."""
import json,os,sys,re,difflib
RT=os.path.dirname(os.path.abspath(__file__)); VID=os.path.join(RT,"..","vid")
cid=sys.argv[1]; V="--9x16" in sys.argv; name=f"rt-{cid}"+("-9x16" if V else "")
ch=[c for c in json.load(open(os.path.join(RT,"chapters.json")))["chapters"] if c["id"]==cid][0]; key=ch["narration"]
tl=json.load(open(os.path.join(VID,f"timeline-{name}.json"))); starts=json.load(open(os.path.join(VID,f"seg_starts_{name}.json")))
n=tl["narration"][0]; at=starts[n["after"]]+float(n.get("offset",0))
text=json.load(open(os.path.join(RT,"aud","lines.json")))[key]; wh=json.load(open(os.path.join(RT,"aud","words.json")))[key+".mp3"]
norm=lambda w: re.sub(r"[^a-z0-9']","",w.lower().replace("’","'"))
off=text.split(); offn=[norm(w) for w in off]; whn=[norm(w[2]) for w in wh]; m={}
for a,b,k in difflib.SequenceMatcher(None,offn,whn,autojunk=False).get_matching_blocks():
    for j in range(k): m[a+j]=(wh[b+j][0],wh[b+j][1])
ws=[]
for i in range(len(off)):
    if i in m: ws.append(m[i]); continue
    prev=max([j for j in m if j<i],default=None); nxt=min([j for j in m if j>i],default=None)
    if prev is None and nxt is None: ws.append((0.0,0.3))
    elif prev is None: ws.append((m[nxt][0],m[nxt][0]))
    elif nxt is None: ws.append((m[prev][1],m[prev][1]))
    else: f=(i-prev)/(nxt-prev); t=m[prev][1]+(m[nxt][0]-m[prev][1])*f; ws.append((t,t))
MAXC=30 if V else 38
parts=[p for p in re.split(r"(?<=[.;:!?,])\s+|(?<=…)\s+",text) if p]; units=[]; cur=""
for p in parts:
    if cur and len(cur)+1+len(p)<=2*MAXC-4: cur=cur+" "+p
    else:
        if cur: units.append(cur)
        cur=p
if cur: units.append(cur)
out=[]
for u in units:
    if len(u)<=2*MAXC-4: out.append(u); continue
    toks=u.split(); buf=[]
    for t in toks:
        if len(" ".join(buf+[t]))>2*MAXC-4 and buf: out.append(" ".join(buf)); buf=[t]
        else: buf.append(t)
    if buf: out.append(" ".join(buf))
cues=[]; wi=0; Wn=len(ws)
for u in out:
    k=len(u.split()); a=min(wi,Wn-1); b=min(wi+k-1,Wn-1); st=ws[a][0]; en=max(ws[b][1],st+0.6); wi+=k; txt=u
    if len(txt)>MAXC:
        cut=-1
        for i,c in enumerate(txt):
            if c=="," and i+1<=MAXC and len(txt)-(i+2)<=MAXC: cut=i+1
        if cut<0:
            mid=len(txt)//2; cands=[i for i,c in enumerate(txt) if c==" " and i<=MAXC and len(txt)-i-1<=MAXC]
            cut=min(cands,key=lambda i:abs(i-mid)) if cands else txt.rfind(" ",0,MAXC+1)
        txt=txt[:cut].rstrip()+"\n"+txt[cut:].lstrip()
    cues.append((st+at,en+at,txt))
for i in range(len(cues)-1):   # no overlap: a cue ends where the next begins
    if cues[i][1]>cues[i+1][0]: cues[i]=(cues[i][0],cues[i+1][0],cues[i][2])
fts=lambda t: f"{int(t//3600):02d}:{int(t%3600//60):02d}:{t%60:06.3f}"
open(os.path.join(VID,f"{name}.vtt"),"w",encoding="utf-8").write("WEBVTT\n\n"+"".join(f"{fts(a)} --> {fts(b)}\n{t}\n\n" for a,b,t in cues))
print(f"{name}.vtt: {len(cues)} cues, narration at {at:.2f}s, words matched {len(m)}/{len(off)}")
