#!/usr/bin/env python3
"""qa.py <chapter>…  -> qa/tile-<chapter>.jpg: twelve frames spread evenly over the caption-free render, tiled 4x3"""
import subprocess,re,sys,os
FF=open("../vid/ffmpeg.path").read().strip()
def dur(p):
    r=subprocess.run([FF,"-i",p],capture_output=True,text=True); m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr); return int(m[1])*3600+int(m[2])*60+float(m[3])
os.makedirs("qa",exist_ok=True)
for n in sys.argv[1:]:
    f=f"../vid/rt-{n}.mp4"
    if not os.path.exists(f): print("missing",n); continue
    d=dur(f); step=d/12; sel="+".join(f"eq(n\\,{int(round((i+0.5)*step*24))})" for i in range(12))
    r=subprocess.run([FF,"-y","-loglevel","error","-i",f,"-vf",f"select='{sel}',scale=480:-2,tile=4x3","-vsync","vfr","-frames:v","1","-q:v","4",f"qa/tile-{n}.jpg"],capture_output=True,text=True)
    print(("tile " if r.returncode==0 else "FAILED ")+n,f"({d:.1f} s)",r.stderr[-200:])
