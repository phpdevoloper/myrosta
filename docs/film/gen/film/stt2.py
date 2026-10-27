# Like stt.py but prints each spoken segment with its start and end (seconds) — for placing narration around the lines.
import sys,subprocess,os
from faster_whisper import WhisperModel
ff=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"ffmpeg.path")).read().strip()
m=WhisperModel("base.en",device="cpu",compute_type="int8")
for f in sys.argv[1:]:
    wav=f+".stt.wav"; subprocess.run([ff,"-loglevel","error","-y","-i",f,"-vn","-ac","1","-ar","16000",wav],check=True)
    segs,info=m.transcribe(wav,beam_size=5,word_timestamps=True)
    out=[]
    for s in segs:
        ws=list(s.words or [])
        if ws: out.append(f"{ws[0].start:.2f}-{ws[-1].end:.2f} {s.text.strip()}")
        else: out.append(f"{s.start:.2f}-{s.end:.2f} {s.text.strip()}")
    print(f, "=>", " || ".join(out)); os.remove(wav)
