# Audio-to-mouth offset for a clip: mouth opening per frame (mediapipe face mesh, inner-lip distance / face height)
# cross-correlated with the speech energy envelope. Reports the lag at which audio best matches the mouth:
# positive = the audio arrives AFTER the mouth moves (sound late), negative = sound early.
# Usage: python lipcheck.py clip.mp4[@start:dur] ...
import sys,subprocess,os,tempfile,numpy as np
import cv2, mediapipe as mp
FF=open("ffmpeg.path").read().strip(); FPS=24
mesh=mp.solutions.face_mesh.FaceMesh(static_image_mode=True,max_num_faces=1,refine_landmarks=True,min_detection_confidence=0.2,min_tracking_confidence=0.2)
CROP=os.environ.get("CROP","")
def frames(path,ss,dur):
    d=tempfile.mkdtemp(); vf=f"fps={FPS}"+(f",crop={CROP}" if CROP else "")+",scale=960:-2"; subprocess.run([FF,"-loglevel","error","-y","-ss",str(ss),"-t",str(dur),"-i",path,"-vf",vf,f"{d}/f%04d.jpg"],check=True)
    return d,sorted(os.listdir(d))
def mouth(d,names):
    out=[]
    for n in names:
        img=cv2.cvtColor(cv2.imread(os.path.join(d,n)),cv2.COLOR_BGR2RGB); r=mesh.process(img)
        if not r.multi_face_landmarks: out.append(np.nan); continue
        lm=r.multi_face_landmarks[0].landmark; h=img.shape[0]; w=img.shape[1]
        top=np.array([lm[13].x*w,lm[13].y*h]); bot=np.array([lm[14].x*w,lm[14].y*h]); chin=np.array([lm[152].x*w,lm[152].y*h]); fore=np.array([lm[10].x*w,lm[10].y*h])
        out.append(np.linalg.norm(top-bot)/(np.linalg.norm(chin-fore)+1e-6))
    return np.array(out)
def energy(path,ss,dur,n):
    raw=subprocess.run([FF,"-loglevel","error","-ss",str(ss),"-t",str(dur),"-i",path,"-vn","-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout
    a=np.frombuffer(raw,dtype=np.float32); spf=16000//FPS; e=np.array([np.sqrt((a[i*spf:(i+1)*spf]**2).mean()) if (i+1)*spf<=len(a) else 0.0 for i in range(n)]); return e
def xcorr(m,e,maxlag=15):
    ok=~np.isnan(m); m=np.where(ok,m,np.nanmean(m)); m=m-m.mean(); e=e-e.mean()
    m=m/(np.linalg.norm(m)+1e-9); e=e/(np.linalg.norm(e)+1e-9); best=[]
    for lag in range(-maxlag,maxlag+1):   # lag>0: audio shifted later than mouth
        if lag>=0: c=float(np.dot(m[:len(m)-lag],e[lag:]))
        else: c=float(np.dot(m[-lag:],e[:len(e)+lag]))
        best.append((c,lag))
    c,l=max(best); 
    # parabolic refinement
    i=[x[1] for x in best].index(l); 
    if 0<i<len(best)-1:
        y0,y1,y2=best[i-1][0],best[i][0],best[i+1][0]; den=(y0-2*y1+y2); l=l+(0.5*(y0-y2)/den if den else 0)
    return c,l,sum(ok)
for spec in sys.argv[1:]:
    path,_,rng=spec.partition("@"); ss,dur=(0,8)
    if rng: ss,dur=[float(x) for x in rng.split(":")]
    d,names=frames(path,ss,dur); m=mouth(d,names); e=energy(path,ss,dur,len(m))
    if sum(~np.isnan(m))<12 or e.max()<1e-4: print(f"{spec}: no face/speech ({sum(~np.isnan(m))} face frames)"); continue
    c,l,nf=xcorr(m,e); print(f"{spec}: audio offset {l*1000/FPS:+.0f} ms vs mouth (corr {c:.2f}, {nf} face frames)",flush=True)
