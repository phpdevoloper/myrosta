# Builds burned-in captions for a rendered cut. Usage: python3 captions.py <timeline.json> <render.mp4> <seg_starts.json> <render log> <out.mp4>
# Narration captions come from the narration text (narration-lines) timed by whisper word timestamps (aud/words.json);
# the characters' lines come from a small table of known timings inside each clip. Style: lower third, white on a soft dark box.
import json,re,sys,os,subprocess
HERE=os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); FF=open("ffmpeg.path").read().strip()
tl=json.load(open(sys.argv[1])); render=sys.argv[2]; starts=json.load(open(sys.argv[3])); log=open(sys.argv[4]).read(); OUT=sys.argv[5]
V=tl.get("format","16x9")=="9x16"; PW,PHh=(1080,1920) if V else (1920,1080); FS=54 if V else 50; MV=200 if V else 64; ML=70 if V else 160
words=json.load(open("../aud/words.json")); lines=json.load(open("../aud/lines.json"))
# spoken lines inside the clips: (segment id, start, end, text) — timings from the clip transcriptions
DIALOGUE={"f01":[(3.42,5.10,"That's three swaps since dinner.")],"f02":[(1.10,3.98,"Saturday, love. It's on the fridge.")],
 "f04":[(0.74,4.16,"Resus Tuesday… and the Thursday evening. Done.")],"f05":[(3.60,4.84,"Half full already.")],
 "f06":[(0.74,4.80,"I'll come and get her. Twenty minutes.")],"f08":[(0.42,1.30,"I'll take your Saturday.")],
 "f09":[(3.30,5.10,"Cover's fine. Approved.")],"f10":[(1.56,2.66,"So that's everyone."),(3.58,3.98,"Five rosters."),(5.10,5.56,"One heading.")],
 "f11":[(5.44,7.74,"No, I'm done. Round's closed.")],
 "f13":[(0.00,1.32,"Mum, Saturday?"),(2.34,3.62,"It's in the calendar, love.")]}
# timings re-measured 6 Oct (Australian-set clips) with faster-whisper small.en / base.en word timestamps
MAXC=30 if V else 38
def chunks(text,ws):
    # clause-first chunking: split at sentence and clause punctuation, pack clauses into units of at most two lines of MAXC,
    # split a long clause only when it alone exceeds the limit; time each unit from the whisper words by position
    import re as _re
    parts=[p for p in _re.split(r"(?<=[.;:!?,])\s+|(?<=…)\s+",text) if p]
    units=[]; cur=""
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
    res=[]; wi=0; W=len(ws)
    for u in out:
        k=len(u.split()); a=min(wi,W-1); b=min(wi+k-1,W-1); st=ws[a][0]; en=ws[b][1]; wi+=k
        txt=u
        if len(txt)>MAXC:
            # two lines: break after a comma if both halves fit, else at the word boundary nearest the middle
            cut=-1
            for i,ch in enumerate(txt):
                if ch=="," and i+1<=MAXC and len(txt)-(i+2)<=MAXC: cut=i+1
            if cut<0:
                mid=len(txt)//2; cands=[i for i,ch in enumerate(txt) if ch==" " and i<=MAXC and len(txt)-i-1<=MAXC]
                cut=min(cands,key=lambda i:abs(i-mid)) if cands else txt.rfind(" ",0,MAXC+1)
            txt=txt[:cut].rstrip()+"\\N"+txt[cut:].lstrip()
        res.append((st,en,txt))
    return res
def ts(t): h=int(t//3600); m=int(t%3600//60); s=t%60; return f"{h}:{m:02d}:{s:05.2f}"
ev=[]
for m in re.finditer(r"narration \.\./aud/(N\w+)\.mp3 at ([\d.]+)s",log):
    key,at=m.group(1),float(m.group(2)); text=lines[key]; ws=words.get(key+".mp3",[])
    if not ws: continue
    for st,en,txt in chunks(text,ws): ev.append((at+st,at+en+0.3,txt,"Narr"))
for s in tl["segments"]:
    sid=s["id"]
    if sid in DIALOGUE and sid in starts:
        for st,en,txt in DIALOGUE[sid]:
            inn=s.get("in",0); d=s.get("dur",99); sh=float(s.get("ashift",0))   # a delayed soundtrack moves the spoken words later by the same amount
            if st+sh-inn<0 or st+sh-inn>d: continue
            ev.append((starts[sid]+st+sh-inn,starts[sid]+en+sh-inn+0.35,txt,"Line"))
ev.sort()
# no two captions on screen at once: trim the earlier one if they overlap
for i in range(len(ev)-1):
    if ev[i][1]>ev[i+1][0]: ev[i]=(ev[i][0],ev[i+1][0]-0.05,ev[i][2],ev[i][3])
ass=["[Script Info]","ScriptType: v4.00+",f"PlayResX: {PW}",f"PlayResY: {PHh}","WrapStyle: 2","","[V4+ Styles]",
 "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
 f"Style: Narr,Helvetica Neue,{FS},&H00FFFFFF,&H00FFFFFF,&H00000000,&H8C000000,1,0,0,0,100,100,0,0,3,12,0,2,{ML},{ML},{MV},1",
 f"Style: Line,Helvetica Neue,{FS},&H00F4FBFA,&H00FFFFFF,&H00000000,&H8C0F3B45,0,1,0,0,100,100,0,0,3,12,0,2,{ML},{ML},{MV},1",
 "","[Events]","Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
for st,en,txt,sty in ev: ass.append(f"Dialogue: 0,{ts(st)},{ts(en)},{sty},,0,0,0,,{txt}")
base=os.path.splitext(OUT)[0]; open(base+".ass","w",encoding="utf-8").write("\n".join(ass)+"\n")
print(f"{len(ev)} captions → {base}.ass"); [print(f"  {st:6.2f}–{en:6.2f} [{sty}] {txt.replace(chr(92)+'N',' / ')}") for st,en,txt,sty in ev]
if "--no-burn" not in sys.argv:
    r=subprocess.run([FF,"-y","-loglevel","error","-i",render,"-vf",f"subtitles={base}.ass:fontsdir=/System/Library/Fonts","-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p","-c:a","copy",OUT],capture_output=True,text=True)
    print("burned:",OUT if r.returncode==0 else r.stderr[-400:])
