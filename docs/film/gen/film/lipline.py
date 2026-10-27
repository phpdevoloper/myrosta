# Lip timing of one spoken line inside a clip, end to end and face-aware: finds every face in the line's window (mediapipe
# face detection), tracks mouth opening on each (legacy face mesh on a crop), keeps the face whose mouth moves most, and
# compares it with the voice-band energy (300–3400 Hz) frame by frame. Reports the lag of best onset correlation
# (positive = the voice comes AFTER the mouth, i.e. the sound is late) and the first-onset gap. Usage:
#   python lipline.py clip.mp4 t0 t1 [label]        (t0..t1 = the line window in clip seconds; a margin is added)
import sys,subprocess,os,tempfile,numpy as np,cv2,mediapipe as mp
FF=open("ffmpeg.path").read().strip(); FPS=24; SR=16000
clip,t0,t1=sys.argv[1],float(sys.argv[2]),float(sys.argv[3]); label=sys.argv[4] if len(sys.argv)>4 else clip
a0=max(0.0,t0-0.45); a1=t1+0.35; n=int(round((a1-a0)*FPS))
# frames (full size, rgb)
d=tempfile.mkdtemp()
subprocess.run([FF,"-loglevel","error","-y","-ss",f"{a0:.3f}","-i",clip,"-t",f"{a1-a0:.3f}","-vf",f"fps={FPS}","-start_number","0",f"{d}/f%04d.png"],check=True)
files=sorted(os.listdir(d)); frames=[cv2.imread(f"{d}/{f}") for f in files]; n=min(n,len(frames)); frames=frames[:n]
H,W=frames[0].shape[:2]
det=mp.solutions.face_detection.FaceDetection(model_selection=1,min_detection_confidence=0.4)
boxes=[]
for i in range(0,n,max(1,n//6)):
    r=det.process(cv2.cvtColor(frames[i],cv2.COLOR_BGR2RGB))
    for dd in (r.detections or []):
        b=dd.location_data.relative_bounding_box; boxes.append((b.xmin*W,b.ymin*H,b.width*W,b.height*H))
# cluster boxes by centre
faces=[]
for (x,y,w,h) in boxes:
    cx,cy=x+w/2,y+h/2
    for f in faces:
        if abs(f["cx"]-cx)<max(w,f["w"])*0.8 and abs(f["cy"]-cy)<max(h,f["h"])*0.8: f["cx"]=(f["cx"]+cx)/2; f["cy"]=(f["cy"]+cy)/2; f["w"]=max(f["w"],w); f["h"]=max(f["h"],h); f["n"]+=1; break
    else: faces.append({"cx":cx,"cy":cy,"w":w,"h":h,"n":1})
if not faces: print(f"{label}: NO FACE found"); sys.exit()
FACE_HINT=os.environ.get('FACE')   # 'x,y' in source pixels: keep only the face nearest that point
if FACE_HINT:
    hx,hy=[float(v) for v in FACE_HINT.split(',')]; faces=[min(faces,key=lambda f:(f['cx']-hx)**2+(f['cy']-hy)**2)]
mesh=mp.solutions.face_mesh.FaceMesh(static_image_mode=True,max_num_faces=1,refine_landmarks=True,min_detection_confidence=0.2)
def series(f):
    m=1.6; x0=int(max(0,f["cx"]-f["w"]*m)); x1=int(min(W,f["cx"]+f["w"]*m)); y0=int(max(0,f["cy"]-f["h"]*m)); y1=int(min(H,f["cy"]+f["h"]*m))
    out=np.full(n,np.nan)
    for i in range(n):
        crop=frames[i][y0:y1,x0:x1]; sc=640/max(1,crop.shape[1]); crop=cv2.resize(crop,None,fx=sc,fy=sc)
        r=mesh.process(cv2.cvtColor(crop,cv2.COLOR_BGR2RGB))
        if not r.multi_face_landmarks: continue
        L=r.multi_face_landmarks[0].landmark; fh=abs(L[152].y-L[10].y)+1e-6; out[i]=abs(L[14].y-L[13].y)/fh
    return out,(x0,y0,x1-x0,y1-y0)
best=None
for f in faces:
    s,box=series(f); ok=np.isfinite(s).sum()
    if ok<n*0.4: continue
    v=np.nanvar(s)
    if best is None or v>best[0]: best=(v,s,box,ok)
if best is None: print(f"{label}: faces found but none tracked"); sys.exit()
_,mouth,box,ok=best
# voice band energy per frame
raw=subprocess.run([FF,"-loglevel","error","-ss",f"{a0:.3f}","-i",clip,"-t",f"{a1-a0:.3f}","-vn","-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout
aud=np.frombuffer(raw,dtype=np.float32); win=1024; voice=np.zeros(n)
freqs=np.fft.rfftfreq(win,1/SR); band=(freqs>=300)&(freqs<=3400)
for i in range(n):
    c=int((i+0.5)*SR/FPS); seg=aud[max(0,c-win//2):c+win//2]
    if len(seg)<win: seg=np.pad(seg,(0,win-len(seg)))
    sp=np.abs(np.fft.rfft(seg*np.hanning(win)))**2; voice[i]=np.sqrt(sp[band].sum())
# fill mouth gaps, smooth lightly, z-score, onset (positive derivative)
m=np.array(mouth); idx=np.where(np.isfinite(m))[0]; m=np.interp(np.arange(n),idx,m[idx])
def z(x): return (x-x.mean())/(x.std()+1e-9)
mz=z(np.convolve(m,[0.25,0.5,0.25],"same")); vz=z(np.convolve(voice,[0.25,0.5,0.25],"same"))
dm=np.clip(np.diff(mz),0,None); dv=np.clip(np.diff(vz),0,None)
L=10; best_lag=None
for lag in range(-L,L+1):   # lag>0: voice later than mouth
    a=dm[max(0,-lag):n-1-max(0,lag)]; b=dv[max(0,lag):n-1-max(0,-lag)]
    if len(a)<8: continue
    r=float(np.corrcoef(a,b)[0,1]) if a.std()>0 and b.std()>0 else 0
    if best_lag is None or r>best_lag[1]: best_lag=(lag,r)
# level correlation (not just onsets)
lv=None
for lag in range(-L,L+1):
    a=mz[max(0,-lag):n-max(0,lag)]; b=vz[max(0,lag):n-max(0,-lag)]
    r=float(np.corrcoef(a,b)[0,1]); lv=(lag,r) if lv is None or r>lv[1] else lv
# first onsets inside the line (after the margin)
s0=int(round((t0-a0-0.25)*FPS)); mo=next((i for i in range(max(1,s0),n) if mz[i]-mz[i-1]>0.35 and mz[i]>-0.3),None); vo=next((i for i in range(max(1,s0),n) if vz[i]>0.0 and voice[i]>0.3*voice.max()),None)
gap=None if mo is None or vo is None else (vo-mo)/FPS*1000
print(f"{label}: onset-corr lag {best_lag[0]/FPS*1000:+.0f} ms (r {best_lag[1]:.2f}) | level-corr lag {lv[0]/FPS*1000:+.0f} ms (r {lv[1]:.2f}) | first onsets: mouth {('%.2f'%(a0+mo/FPS)) if mo is not None else '?'} s, voice {('%.2f'%(a0+vo/FPS)) if vo is not None else '?'} s -> gap {('%+.0f ms'%gap) if gap is not None else '?'} | face box {box} tracked {ok}/{n}")
sel=slice(max(0,s0-2),min(n,s0+30))
# a mouth strip at 24 fps over the line itself (the lower half of the tracked face), for the eye: lip-<label>.png
x0,y0,bw,bh=box; mx0=int(x0+bw*0.15); my0=int(y0+bh*0.45); mw=int(bw*0.7); mh=int(bh*0.45); ls=int(round((t0-a0-0.25)*FPS)); le=min(n,int(round((t1-a0+0.1)*FPS)))
tile=[cv2.resize(frames[i][my0:my0+mh,mx0:mx0+mw],(240,int(240*mh/max(1,mw)))) for i in range(max(0,ls),le)]
if tile:
    cols=10; rows=(len(tile)+cols-1)//cols; blank=np.zeros_like(tile[0]); tile+= [blank]*(rows*cols-len(tile))
    grid=np.vstack([np.hstack(tile[r*cols:(r+1)*cols]) for r in range(rows)]); safe="".join(c if c.isalnum() else "_" for c in label)[:40]
    cv2.imwrite(f"lip-{safe}.png",grid); print(f"   mouth strip lip-{safe}.png: {len(tile)-(rows*cols-len(tile))} frames from {a0+max(0,ls)/FPS:.2f} s, {cols} a row, 1/24 s apart")
print("   t     : "+" ".join(f"{a0+i/FPS:5.2f}" for i in range(sel.start,sel.stop)))
print("   mouth : "+" ".join(f"{mz[i]:5.1f}" for i in range(sel.start,sel.stop)))
print("   voice : "+" ".join(f"{vz[i]:5.1f}" for i in range(sel.start,sel.stop)))
