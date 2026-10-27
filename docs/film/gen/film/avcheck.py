# Measures the lag of the master's audio against a source clip's audio at a known segment start: positive = master audio arrives late.
import sys,subprocess,numpy as np,os
FF=open("ffmpeg.path").read().strip()
def wav(path,ss,dur):
    out=subprocess.run([FF,"-loglevel","error","-ss",str(ss),"-t",str(dur),"-i",path,"-vn","-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout
    return np.frombuffer(out,dtype=np.float32)
master=sys.argv[1]
for spec in sys.argv[2:]:
    clip,start=spec.split("@"); start=float(start); n=int(16000*5.5)
    a=wav(clip,0,5.5)[:n]; b=wav(master,max(0,start-1.0),7.5)
    if len(a)<n or len(b)<n+8000: print(clip,"short"); continue
    a=a-a.mean(); b=b-b.mean(); a/=np.linalg.norm(a)+1e-9
    best=(-1,0)
    for lag in range(0,len(b)-n,8):
        seg=b[lag:lag+n]; c=float(np.dot(a,seg)/(np.linalg.norm(seg)+1e-9))
        if c>best[0]: best=(c,lag)
    # refine around best
    lo=max(0,best[1]-8); hi=min(len(b)-n,best[1]+8)
    for lag in range(lo,hi):
        seg=b[lag:lag+n]; c=float(np.dot(a,seg)/(np.linalg.norm(seg)+1e-9))
        if c>best[0]: best=(c,lag)
    lag_s=best[1]/16000-1.0
    print(f"{os.path.basename(clip)} at {start:7.2f}s: audio lag {lag_s*1000:+7.1f} ms (corr {best[0]:.2f})")
