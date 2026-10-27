#!/usr/bin/env python3
"""encode.py <take> <frames dir> [--n N] [--width 1920] [--size WxH]   the first N logged frames (12.5 fps JPEG) → clips/<take>.mp4 at 25 fps, crf 14; a laptop capture is Lanczos-downscaled to --width"""
import sys,os,subprocess,json
RT=os.path.dirname(os.path.abspath(__file__)); FF=open(os.path.join(RT,"ffmpeg.path")).read().strip()
take=sys.argv[1]; d=sys.argv[2]; a=sys.argv[3:]; N=int(a[a.index("--n")+1]) if "--n" in a else None; W=a[a.index("--width")+1] if "--width" in a else None
SZ=a[a.index("--size")+1] if "--size" in a else None   # --size 1170x2532: every frame scaled to this (a zoomed frame is a smaller clip screenshot, see lib.js rt.zoom)
vf=f"scale={W}:-2:flags=lanczos" if W else (f"scale={SZ.replace('x',':')}:flags=lanczos" if SZ else "scale=trunc(iw/2)*2:trunc(ih/2)*2"); out=os.path.join(RT,"clips",take+".mp4")
cmd=[FF,"-y","-loglevel","error","-framerate","12.5"]+(["-t",f"{N/12.5:.3f}"] if N else [])+["-i",os.path.join(d,"f%05d.jpg"),"-vf",vf,"-r","25","-c:v","libx264","-preset","medium","-crf","14","-pix_fmt","yuv420p",out]
subprocess.run(cmd,check=True); r=subprocess.run([FF,"-i",out],capture_output=True,text=True); import re; m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr)
print(take, d, "N="+str(N), f"{int(m[1])*3600+int(m[2])*60+float(m[3]):.2f}s", os.path.getsize(out)//1024,"KB", flush=True)
