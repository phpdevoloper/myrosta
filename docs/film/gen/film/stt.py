# Transcribe a clip's speech locally (faster-whisper, small English model) so a spoken line can be checked without listening.
import sys,subprocess,os
from faster_whisper import WhisperModel
ff=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"ffmpeg.path")).read().strip()
m=WhisperModel("base.en",device="cpu",compute_type="int8")
for f in sys.argv[1:]:
    wav=f+".stt.wav"; subprocess.run([ff,"-loglevel","error","-y","-i",f,"-vn","-ac","1","-ar","16000",wav],check=True)
    segs,info=m.transcribe(wav,beam_size=5); print(f, "=>", " ".join(s.text.strip() for s in segs)); os.remove(wav)
