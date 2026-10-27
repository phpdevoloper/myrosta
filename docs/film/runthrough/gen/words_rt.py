# Word-level timestamps for the narration lines → aud/words.json  (faster-whisper, base.en)
import sys,subprocess,os,json
from faster_whisper import WhisperModel
ff=open("ffmpeg.path").read().strip(); m=WhisperModel("base.en",device="cpu",compute_type="int8")
try: out=json.load(open("../rt/aud/words.json"))
except Exception: out={}
for f in sys.argv[1:]:
    wav=f+".w.wav"; subprocess.run([ff,"-loglevel","error","-y","-i",f,"-vn","-ac","1","-ar","16000",wav],check=True)
    segs,info=m.transcribe(wav,beam_size=5,word_timestamps=True); words=[]
    for s in segs:
        for w in (s.words or []): words.append([round(w.start,2),round(w.end,2),w.word.strip()])
    out[os.path.basename(f)]=words; os.remove(wav); print(os.path.basename(f),len(words),"words",words[0][0] if words else None,"→",words[-1][1] if words else None,flush=True)
json.dump(out,open("../rt/aud/words.json","w"),indent=0)
