#!/bin/zsh
# Renders the cuts with the current assembler (24 fps: 2000 samples a frame), then checks every piece (frames vs samples) and the sync of each cut.
cd "$(dirname "$0")"; FF=$(cat ffmpeg.path)
render(){ rm -rf "seg_${2%.mp4}"; python3 assemble.py "$1" "$2" > "render_${2%.mp4}.log" 2>&1; echo "$2: $(grep -E '^done' "render_${2%.mp4}.log" || echo FAILED; grep -iE 'error|Traceback' "render_${2%.mp4}.log" | head -3)"; }
render timeline-master.json myrosta-film-master-1080p.mp4
render timeline-cut90.json myrosta-film-cut90-1080p.mp4
render timeline-cut42.json myrosta-film-cut42.mp4
render timeline-staff-9x16.json myrosta-film-staff-9x16.mp4
echo "== piece lengths (frames x 1920 vs audio samples)"
for f in seg_myrosta-film-master-1080p/??.mov seg_myrosta-film-cut90-1080p/??.mov seg_myrosta-film-cut42/??.mov seg_myrosta-film-staff-9x16/??.mov; do fr=$("$FF" -i "$f" -map 0:v -c copy -f null - 2>&1 | grep -o "frame= *[0-9]*" | tail -1 | tr -dc 0-9); sm=$("$FF" -i "$f" -map 0:a -f s16le -ac 2 - 2>/dev/null | wc -c); python3 -c "fr=$fr; sm=$sm//4; d=sm-fr*2000; print('$f', fr, 'frames', 'ok' if d==0 else 'MISMATCH %+d samples (%.0f ms)'%(d,d/48))"; done | grep -c ok | sed 's/^/pieces ok: /'
for f in seg_myrosta-film-master-1080p/??.mov seg_myrosta-film-cut90-1080p/??.mov seg_myrosta-film-cut42/??.mov seg_myrosta-film-staff-9x16/??.mov; do fr=$("$FF" -i "$f" -map 0:v -c copy -f null - 2>&1 | grep -o "frame= *[0-9]*" | tail -1 | tr -dc 0-9); sm=$("$FF" -i "$f" -map 0:a -f s16le -ac 2 - 2>/dev/null | wc -c); python3 -c "fr=$fr; sm=$sm//4; d=sm-fr*2000; print('$f', fr, 'frames', 'MISMATCH %+d samples (%.0f ms)'%(d,d/48)) if d!=0 else None"; done
python3 - <<'PY'
import json,subprocess,re,os
FF=open("ffmpeg.path").read().strip()
for tl,seg,name in (("timeline-master.json","seg_myrosta-film-master-1080p","master"),("timeline-cut90.json","seg_myrosta-film-cut90-1080p","cut90"),("timeline-cut42.json","seg_myrosta-film-cut42","cut42"),("timeline-staff-9x16.json","seg_myrosta-film-staff-9x16","staff")):
    t=json.load(open(tl)); acc=0; starts={}
    for i,s in enumerate(t["segments"]):
        f=f"{seg}/{i:02d}.mov"
        if not os.path.exists(f): print("MISSING",f); continue
        r=subprocess.run([FF,"-i",f],capture_output=True,text=True); m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr); d=int(m[1])*3600+int(m[2])*60+float(m[3]); starts[s["id"]]=acc; acc+=d
    json.dump(starts,open(f"seg_starts_{name}.json","w"))
PY
st(){ python3 -c "import json;print(json.load(open('seg_starts_$1.json'))['$2'])"; }
echo "== master sync"; uv run --python 3.12 --with numpy python avcheck.py myrosta-film-master-1080p.mp4 "veo3_1/F02.mp4@$(st master f02)" "veo3_1/F06.mp4@$(st master f06)" "veo3_1/F10.mp4@$(st master f10)" "kling3_0/F11.mp4@$(st master f11)" "veo3_1/F13.mp4@$(st master f13)" 2>&1 | grep lag
echo "== cut90 sync"; uv run --python 3.12 --with numpy python avcheck.py myrosta-film-cut90-1080p.mp4 "veo3_1/F02.mp4@$(st cut90 f02)" "veo3_1/F06.mp4@$(st cut90 f06)" "veo3_1/F09.mp4@$(st cut90 f09)" 2>&1 | grep lag
echo "== cut42 sync"; uv run --python 3.12 --with numpy python avcheck.py myrosta-film-cut42.mp4 "veo3_1/F06.mp4@$(st cut42 f06)" "veo3_1/F09.mp4@$(st cut42 f09)" 2>&1 | grep lag
echo "== staff sync"; uv run --python 3.12 --with numpy python avcheck.py myrosta-film-staff-9x16.mp4 "veo3_1/F04.mp4@$(st staff f04)" "veo3_1/F06.mp4@$(st staff f06)" 2>&1 | grep lag
echo "RENDERS DONE"
