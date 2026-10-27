# Lip-sync by onsets: mouth opening per frame (mediapipe face mesh, legacy API) against VOICE-BAND energy (300–3400 Hz)
# per frame. Prints both series around the first voiced onset and the two onset times, plus a band-passed correlation lag.
# Usage: CROP=w:h:x:y python liponset.py clip.mp4[@start:dur] ...     Positive onset gap = voice starts AFTER the mouth opens.
import sys,subprocess,os,tempfile,numpy as np, cv2, mediapipe as mp
FF=open("ffmpeg.path").read().strip(); FPS=24; CROP=os.environ.get("CROP","")
mesh=mp.solutions.face_mesh.FaceMesh(static_image_mode=True,max_num_faces=1,refine_landmarks=True,min_detection_confidence=0.2,min_tracking_confidence=0.2)
def frames(path,ss,dur):
    d=tempfile.mkdtemp(); vf=f"fps={FPS}"+(f",crop={CROP}" if CROP else "")+",scale=960:-2"
    subprocess.run([FF,"-loglevel","error","-y","-ss",str(ss),"-t",str(dur),"-i",path,"-vf",vf,f"{d}/f%04d.jpg"],check=True); return d,sorted(os.listdir(d))
def mouth(d,names):
    out=[]
    for n in names:
        img=cv2.cvtColor(cv2.imread(os.path.join(d,n)),cv2.COLOR_BGR2RGB); r=mesh.process(img)
        if not r.multi_face_landmarks: out.append(np.nan); continue
        lm=r.multi_face_landmarks[0].landmark; h,w=img.shape[:2]
        top=np.array([lm[13].x*w,lm[13].y*h]); bot=np.array([lm[14].x*w,lm[14].y*h]); chin=np.array([lm[152].x*w,lm[152].y*h]); fore=np.array([lm[10].x*w,lm[10].y*h])
        out.append(np.linalg.norm(top-bot)/(np.linalg.norm(chin-fore)+1e-6))
    return np.array(out)
def voice(path,ss,dur,n):
    raw=subprocess.run([FF,"-loglevel","error","-ss",str(ss),"-t",str(dur),"-i",path,"-vn","-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout; a=np.frombuffer(raw,dtype=np.float32)
    spec=np.fft.rfft(a); f=np.fft.rfftfreq(len(a),1/16000); spec[(f<300)|(f>3400)]=0; v=np.fft.irfft(spec,len(a)); spf=16000//FPS
    return np.array([np.sqrt((v[i*spf:(i+1)*spf]**2).mean()) if (i+1)*spf<=len(v) else 0.0 for i in range(n)])
for spec in sys.argv[1:]:
    path,_,rng=spec.partition("@"); ss,dur=(0.0,6.0)
    if rng: ss,dur=[float(x) for x in rng.split(":")]
    d,names=frames(path,ss,dur); m=mouth(d,names); e=voice(path,ss,dur,len(m))
    ok=~np.isnan(m)
    if ok.sum()<10: print(f"{spec}: no face ({ok.sum()} frames)"); continue
    mm=np.where(ok,m,np.nanmedian(m)); base=np.nanpercentile(mm,15); mo=(mm-base)/(np.nanmax(mm)-base+1e-9); ev=e/(e.max()+1e-9)
    # onsets: first frame where the series stays above 35% of its range for 3 of the next 4 frames
    def onset(x,thr=0.35):
        for i in range(len(x)-4):
            if (x[i:i+4]>thr).sum()>=3: return i
        return None
    oi_m=onset(mo); oi_e=onset(ev,0.3)
    # band-passed correlation lag (positive = voice later than mouth)
    a=mo-mo.mean(); b=ev-ev.mean(); a/=np.linalg.norm(a)+1e-9; b/=np.linalg.norm(b)+1e-9; best=(-9,0)
    for lag in range(-12,13):
        c=float(np.dot(a[:len(a)-lag],b[lag:])) if lag>=0 else float(np.dot(a[-lag:],b[:len(b)+lag]))
        if c>best[0]: best=(c,lag)
    gap=(oi_e-oi_m)/FPS*1000 if (oi_m is not None and oi_e is not None) else None
    print(f"{spec}: mouth opens at {('%.2f'%(ss+oi_m/FPS)) if oi_m is not None else '?'} s, voice starts at {('%.2f'%(ss+oi_e/FPS)) if oi_e is not None else '?'} s -> gap {('%+.0f ms'%gap) if gap is not None else '?'} | corr lag {best[1]*1000/FPS:+.0f} ms (r {best[0]:.2f}) | {int(ok.sum())} face frames")
    lo=max(0,(oi_e or 0)-8); hi=min(len(mo),(oi_e or 0)+10)
    print("   t(s)  :"," ".join(f"{(ss+i/FPS):5.2f}" for i in range(lo,hi)))
    print("   mouth :"," ".join(f"{mo[i]:5.2f}" for i in range(lo,hi)))
    print("   voice :"," ".join(f"{ev[i]:5.2f}" for i in range(lo,hi)),flush=True)
