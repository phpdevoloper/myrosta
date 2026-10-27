# Generates the narration lines (narration-lines.json) with one Higgsfield text-to-speech preset voice, in parallel, into ./aud/.
# Usage: python3 narration.py <voice name, e.g. Soraya>      (ElevenLabs engine through Higgsfield; about 0.3 credits a line)
import json,subprocess,sys,os,urllib.request,shutil
HERE=os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); os.makedirs("aud",exist_ok=True)
name=sys.argv[1] if len(sys.argv)>1 else "Soraya"
voices=json.loads(subprocess.run(["higgsfield","voices","list","--json"],capture_output=True,text=True).stdout)
voices=voices if isinstance(voices,list) else (voices.get("items") or voices.get("voices") or voices.get("data"))
vid={v["name"]:v["id"] for v in voices}[name]
L=json.load(open("narration-lines.json")); procs=[]
for k,t in L.items():
    procs.append((k,subprocess.Popen(["higgsfield","generate","create","text2speech_v2","--prompt",t,"--variant","elevenlabs","--voice_type","preset","--voice_id",vid,"--wait","--wait-timeout","10m","--json"],stdout=open(f"aud/{k}.json","w"),stderr=open(f"aud/{k}.err","w"))))
for k,p in procs:
    p.wait(); j=json.load(open(f"aud/{k}.json")); j=j[0] if isinstance(j,list) else j; url=j.get("result_url")
    if url:
        ext=os.path.splitext(url.split("?")[0])[1] or ".mp3"
        with urllib.request.urlopen(url,timeout=120) as r, open(f"aud/{k}{ext}","wb") as o: shutil.copyfileobj(r,o)
        print(k,"ok")
    else: print(k,"FAILED",open(f"aud/{k}.err").read()[:200])
