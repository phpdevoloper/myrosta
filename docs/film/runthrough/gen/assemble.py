# Assembles the Myrosta film from a timeline JSON (a segment's optional cx/cy, 0..1, place the crop window when the format cuts the frame; 0.5 = centre): normalises each segment to 1920x1080/25 fps with a stereo track,
# concatenates, then lays the narration (ducking the clips' own sound under it) and the music bed.
# Usage: python3 assemble.py timeline.json out.mp4
import json,subprocess,os,sys,re
HERE=os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
FF=open("ffmpeg.path").read().strip()
tl=json.load(open(sys.argv[1])); OUT=sys.argv[2]; FMT=tl.get("format","16x9"); FPS=int(tl.get("fps",24)); SPF=48000//FPS; W,H=(1080,1920) if FMT=="9x16" else (1920,1080); PH=(1170,2392); PW_,PH_=((806,1648) if FMT=="9x16" else (468,957)); BACK="phone_backdrop_9x16.png" if FMT=="9x16" else "phone_backdrop.png"; MIXONLY="--mix-only" in sys.argv; TMP="seg_"+os.path.splitext(os.path.basename(OUT))[0]; os.makedirs(TMP,exist_ok=True)
def run(args):
    r=subprocess.run([FF,"-y","-loglevel","error"]+args,capture_output=True,text=True)
    if r.returncode: print("FFMPEG ERROR:",r.stderr[-1500:]); sys.exit(1)
def dur(path):
    r=subprocess.run([FF,"-i",path],capture_output=True,text=True); m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr); return int(m[1])*3600+int(m[2])*60+float(m[3])
def has_audio(path):
    r=subprocess.run([FF,"-i",path],capture_output=True,text=True); return "Audio:" in r.stderr
segs=[]; t=0.0; starts={}
FONT="/System/Library/Fonts/HelveticaNeue.ttc"
def labels(s,d,i):
    """drawtext chain for a segment's step labels: each shows from its time to the next (top-left, white; on a laptop frame in a dark pill)"""
    st=s.get("steps") or []
    if not st: return ""
    os.makedirs(TMP,exist_ok=True); parts=[]; big=(FMT=="9x16"); fs=46 if big else 40; x=44; y=40
    for k,e in enumerate(st):
        a=float(e["at"]); b=float(st[k+1]["at"]) if k+1<len(st) else d+1; tf=os.path.abspath(os.path.join(TMP,f"lab_{i:02d}_{k}.txt")); open(tf,"w",encoding="utf-8").write(e["text"])
        box=":box=1:boxcolor=0x0F3B45@0.82:boxborderw=16" if s.get("kind")!="phone" else ""
        parts.append(f"drawtext=fontfile={FONT}:textfile={tf}:fontsize={fs}:fontcolor=white:x={x}:y={y}{box}:enable='between(t,{a:.2f},{b:.2f})'")
    return ","+",".join(parts)
for i,s in enumerate(tl["segments"]):
    out=f"{TMP}/{i:02d}.mov"; d=s.get("dur") or dur(s["src"]); d=min(d,dur(s["src"])) if s.get("kind")!="still" else d
    d=round(d*FPS)/FPS; N=int(round(d*FPS)); NS=N*SPF
    if MIXONLY and os.path.exists(out):
        real=dur(out); starts[s.get("id",str(i))]=t; segs.append(out); t+=real; continue
    vf_extra=""
    if i==0: vf_extra=",fade=t=in:st=0:d=0.7"
    if i==len(tl["segments"])-1: vf_extra+=f",fade=t=out:st={d-1.0:.2f}:d=1.0"
    lab=labels(s,d,i)
    if s.get("kind")=="phone":
        pc=int(s.get("pcrop",140))
        run(["-framerate",str(FPS),"-loop","1","-i",BACK,"-i",s["src"],"-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-filter_complex",f"[1:v]trim=start={s.get('in',0)},setpts=PTS-STARTPTS,crop=iw:ih-{pc}:0:0,scale={PW_}:{PH_},fps={FPS},tpad=stop_mode=clone:stop_duration=3,trim=end_frame={N}[p];[0:v][p]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p{lab}{vf_extra}[v];[2:a]atrim=end_sample={NS}[a]","-map","[v]","-map","[a]","-c:v","libx264","-preset","medium","-crf","18","-c:a","pcm_s16le","-r",str(FPS),out])
    elif s.get("kind")=="phone2":
        # two phones side by side: src = the right phone (in/end), src2 = the left phone (in2/end2), which holds its first frame for start2 s before it plays
        PW2,PH2=400,818; GAP=120; XL=(W-(2*PW2+GAP))//2; XR=XL+PW2+GAP; Y=(H-PH2)//2
        def chain(idx,ins,end,hold):
            t=f"[{idx}:v]trim=start={ins}"+(f":end={end}" if end else "")+f",setpts=PTS-STARTPTS,crop=iw:ih-140:0:0,scale={PW2}:{PH2},fps={FPS}"
            if hold: t+=f",tpad=start_mode=clone:start_duration={hold}"
            return t+f",tpad=stop_mode=clone:stop_duration=30,trim=end_frame={N}"
        fc=chain(1,s.get('in',0),s.get('end'),0)+"[pr];"+chain(2,s.get('in2',0),s.get('end2'),s.get('start2',0))+f"[pl];[0:v][pl]overlay={XL}:{Y}:shortest=0[b1];[b1][pr]overlay={XR}:{Y}:shortest=1,format=yuv420p{vf_extra}[v];[3:a]atrim=end_sample={NS}[a]"
        run(["-framerate",str(FPS),"-loop","1","-i","phone_backdrop2.png","-i",s["src"],"-i",s["src2"],"-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-filter_complex",fc,"-map","[v]","-map","[a]","-c:v","libx264","-preset","medium","-crf","18","-c:a","pcm_s16le","-r",str(FPS),out])
    elif s.get("kind")=="still":
        run(["-framerate",str(FPS),"-loop","1","-i",s["src"],"-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-vf",f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},trim=end_frame={N},format=yuv420p{vf_extra}","-af",f"atrim=end_sample={NS}","-c:v","libx264","-preset","medium","-crf","18","-c:a","pcm_s16le","-r",str(FPS),out])
    else:
        a=has_audio(s["src"]); inp=["-i",s["src"]]+([] if a else ["-f","lavfi","-i","anullsrc=r=48000:cl=stereo"])
        ash=float(s.get('ashift',0)); shiftf=(f"adelay={int(ash*1000)}|{int(ash*1000)}," if ash>0 else (f"atrim=start={-ash:.3f},asetpts=PTS-STARTPTS," if ash<0 else "")); cb=s.get('crop_banner',0); pre=(f"crop=iw:ih-{cb}:0:0,pad=iw:ih+{cb}:0:0:color=#f5f7f8," if cb else "")
        intrim=(f"atrim=start={float(s.get('in',0)):.3f},asetpts=PTS-STARTPTS," if float(s.get('in',0))>0 else "")   # the audio must start where the video does
        af=["-af",f"{intrim}{shiftf}loudnorm=I={s.get('lufs',-21)}:LRA=9:TP=-2,volume={s.get('vol',1.0)},aresample=48000,apad,atrim=end_sample={NS},afade=t=in:d=0.15,afade=t=out:st={max(0,d-0.15):.3f}:d=0.15"] if a else ["-af",f"atrim=end_sample={NS}"]
        run(inp+["-vf",f"trim=start={s.get('in',0)},setpts=PTS-STARTPTS,{pre}scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}:(iw-ow)*{s.get('cx',0.5)}:(ih-oh)*{s.get('cy',0.5)},fps={FPS},tpad=stop_mode=clone:stop_duration=3,trim=end_frame={N},format=yuv420p{lab}{vf_extra}"]+af+["-ac","2","-c:v","libx264","-preset","medium","-crf","18","-c:a","pcm_s16le","-r",str(FPS),out])
    real=dur(out); starts[s.get("id",str(i))]=t; segs.append(out); t+=real
    print(f"{i:02d} {s.get('id','')} {s['src']} {real:.2f}s  starts {t-real:7.2f}")
if not (MIXONLY and os.path.exists(f"{TMP}/picture.mov")):
    open(f"{TMP}/list.txt","w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in segs))
    run(["-f","concat","-safe","0","-i",f"{TMP}/list.txt","-c","copy",f"{TMP}/picture.mov"])
total=dur(f"{TMP}/picture.mov"); print("picture",f"{total:.2f}s")
# narration + music
inputs=["-i",f"{TMP}/picture.mov"]; fc=[]; nar=[]
for k,n in enumerate(tl["narration"]):
    at=starts[n["after"]]+n.get("offset",0) if "after" in n else n["at"]
    inputs+=["-i",n["src"]]; fc.append(f"[{k+1}:a]aresample=48000,volume={n.get('vol',1.0)},adelay={int(at*1000)}|{int(at*1000)}[n{k}]"); nar.append(f"[n{k}]"); print(f"narration {n['src']} at {at:.2f}s")
mi=len(tl["narration"])+1; inputs+=["-i",tl["music"]["src"]]
fc.append("[0:a]volume=0.8[duck]")
fc.append(f"[{mi}:a]aresample=48000,aloop=loop=3:size=2147483647,volume={tl['music'].get('vol',0.26)},atrim=0:{total:.2f},afade=t=in:st=0:d=2,afade=t=out:st={max(0,total-5):.2f}:d=5[mus0]")
if nar:
    fc.append("".join(nar)+f"amix=inputs={len(nar)}:normalize=0:dropout_transition=0[narB]")
    fc.append("[duck][narB]amix=inputs=2:normalize=0:dropout_transition=0,asplit=2[spk][spkkey]")
    fc.append("[mus0][spkkey]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=600:makeup=1[mus]")
    fc.append("[spk][mus]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.9:level=false:attack=5:release=60[out]")
else:   # a card-only chapter (the end cards): the clips' own silence and the music bed, no narration to duck under
    fc.append("[duck][mus0]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.9:level=false:attack=5:release=60[out]")
run(inputs+["-filter_complex",";".join(fc),"-map","0:v","-map","[out]","-c:v","copy","-c:a","aac","-b:a","256k","-t",f"{total:.3f}",OUT])
print("done",OUT,f"{dur(OUT):.2f}s",os.path.getsize(OUT)//1024,"KB")
