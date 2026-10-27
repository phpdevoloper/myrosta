# Motion smoothness of a clip: per-frame mean absolute difference between consecutive frames (grey, 320 px wide).
# Reports the jerkiness (coefficient of variation of the motion series), the biggest single jump, and the share of
# near-still frame pairs (stutter). Lower jerkiness and fewer stutters = smoother. Usage: python smooth.py a.mp4 b.mp4 ...
import sys,subprocess,os,tempfile,numpy as np
FF=open("ffmpeg.path").read().strip()
for p in sys.argv[1:]:
    raw=subprocess.run([FF,"-loglevel","error","-i",p,"-vf","scale=320:-2,format=gray","-f","rawvideo","-"],capture_output=True).stdout
    w=320; h=len(raw)//w; # frames*h
    info=subprocess.run([FF,"-i",p],capture_output=True,text=True).stderr
    import re; m=re.search(r", (\d+)x(\d+)",info); H=int(round(320*int(m.group(2))/int(m.group(1)))); H-=H%2
    n=len(raw)//(w*H); a=np.frombuffer(raw,dtype=np.uint8)[:n*w*H].reshape(n,H,w).astype(np.float32)
    d=np.abs(np.diff(a,axis=0)).mean(axis=(1,2)); cv=float(d.std()/(d.mean()+1e-6)); big=float(d.max()/(np.median(d)+1e-6)); still=float((d<0.15*np.median(d)).mean())
    print(f"{os.path.basename(p)}: frames {n}, motion mean {d.mean():.2f}, jerkiness {cv:.2f}, biggest jump x{big:.1f}, still pairs {still*100:.0f}%")
