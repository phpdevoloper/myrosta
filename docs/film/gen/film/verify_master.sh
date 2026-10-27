#!/bin/zsh
# Verifies the rendered master: piece lengths, segment starts, sync at the spoken clips, narration vs lines, levels; then the 720p copy and check strips.
cd "$(dirname "$0")"; FF=$(cat ffmpeg.path)
echo "== render"; grep -E '^done' render_myrosta-film-master-1080p.log; "$FF" -i myrosta-film-master-1080p.mp4 2>&1 | grep Duration
echo "== pieces"; ok=0; bad=0; for f in seg_myrosta-film-master-1080p/??.mov; do fr=$("$FF" -i "$f" -map 0:v -c copy -f null - 2>&1 | grep -o "frame= *[0-9]*" | tail -1 | tr -dc 0-9); sm=$("$FF" -i "$f" -map 0:a -f s16le -ac 2 - 2>/dev/null | wc -c); d=$(( sm/4 - fr*2000 )); if [ "$d" -eq 0 ]; then ok=$((ok+1)); else bad=$((bad+1)); echo "MISMATCH $f $d"; fi; done; echo "pieces ok $ok bad $bad"
python3 - <<'PY'
import json,subprocess,re
FF=open("ffmpeg.path").read().strip()
t=json.load(open("timeline-master.json")); acc=0; starts={}
for i,s in enumerate(t["segments"]):
    f=f"seg_myrosta-film-master-1080p/{i:02d}.mov"; r=subprocess.run([FF,"-i",f],capture_output=True,text=True); m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr); d=int(m[1])*3600+int(m[2])*60+float(m[3]); starts[s["id"]]=round(acc,3); acc+=d
json.dump(starts,open("seg_starts_master.json","w")); print("starts", {k:round(v,1) for k,v in starts.items()}, "total %.2f"%acc)
def dur(p):
    r=subprocess.run([FF,"-i",p],capture_output=True,text=True); m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr); return int(m[1])*3600+int(m[2])*60+float(m[3])
lines={"f01":(3.42,5.10),"f02":(1.10,3.98),"f04":(0.74,4.16),"f05":(3.60,4.84),"f06":(0.74,4.80),"f08":(0.42,1.30),"f09":(3.30,5.10),"f10":(1.56,5.56),"f11":(5.44,7.74),"f13":(0.00,3.62)}
segs={s["id"]:s for s in t["segments"]}
print("== narration vs lines")
for n in t["narration"]:
    a=starts[n["after"]]+n.get("offset",0); b=a+dur(n["src"]); clash=[]
    for sid,(x,y) in lines.items():
        if sid in starts and segs[sid].get("vol",1)!=0:
            ls=starts[sid]+x; le=starts[sid]+min(y,segs[sid].get("dur",99))
            if a<le and b>ls: clash.append(f"{sid} {ls:.1f}-{le:.1f}")
    print(f"{n['src'][7:-4]:7s} {a:7.2f}-{b:7.2f} {'CLASH '+','.join(clash) if clash else 'clear'}")
PY
st(){ python3 -c "import json;print(json.load(open('seg_starts_master.json'))['$1'])"; }
echo "== sync"; uv run --python 3.12 --with numpy python avcheck.py myrosta-film-master-1080p.mp4 "veo3_1/F02.mp4@$(st f02)" "veo3_1/F04.mp4@$(st f04)" "veo3_1/F06.mp4@$(st f06)" "veo3_1/F09.mp4@$(st f09)" "veo3_1/F10.mp4@$(st f10)" "kling3_0/F11.mp4@$(st f11)" "veo3_1/F13.mp4@$(st f13)" 2>&1 | grep lag
echo "== levels"; "$FF" -i myrosta-film-master-1080p.mp4 -vn -af "astats=measure_overall=Peak_level:measure_perchannel=0" -f null - 2>&1 | grep "Peak level" | tail -1; "$FF" -i myrosta-film-master-1080p.mp4 -vn -af "ebur128" -f null - 2>&1 | grep -E "^\s+I:" | tail -1
echo "== 720p"; "$FF" -v error -y -i myrosta-film-master-1080p.mp4 -vf "scale=1280:-2" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k myrosta-film-master-720p.mp4 && ls -la myrosta-film-master-720p.mp4
echo "== strips"; "$FF" -v error -y -t 30 -i myrosta-film-master-1080p.mp4 -vf "fps=1/2,scale=320:-1,tile=8x2" -frames:v 1 master-head.png; S=$(st f13); "$FF" -v error -y -ss $(python3 -c "print($S-13)") -t 20 -i myrosta-film-master-1080p.mp4 -vf "fps=1,scale=320:-1,tile=10x2" -frames:v 1 master-tail.png; echo "VERIFY DONE"
