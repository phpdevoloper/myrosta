#!/usr/bin/env python3
"""narrate.py <key>…   a fresh narration for a chapter: aud/lines.json[key] read by Soraya (Higgsfield text2speech_v2, elevenlabs) → aud/<key>.mp3, with the job's JSON and stderr beside it"""
import json,os,subprocess,sys,urllib.request
RT=os.path.dirname(os.path.abspath(__file__)); AUD=os.path.join(RT,"aud"); L=json.load(open(os.path.join(AUD,"lines.json")))
VOICE="5c1d2f7f-cdb4-5b1d-bca9-156439e3275e"
for key in sys.argv[1:]:
    j=os.path.join(AUD,key+".json"); e=os.path.join(AUD,key+".err")
    with open(j,"w") as jo, open(e,"w") as eo:
        r=subprocess.run(["higgsfield","generate","create","text2speech_v2","--prompt",L[key],"--variant","elevenlabs","--voice_id",VOICE,"--voice_type","preset","--wait","--wait-timeout","10m","--json"],stdout=jo,stderr=eo)
    if r.returncode: print(key,"FAILED rc",r.returncode,open(e).read()[-300:]); continue
    d=json.load(open(j)); d=d[0] if isinstance(d,list) else d; url=d.get("result_url") or d.get("min_result_url")
    if not url: print(key,"no result_url in",j); continue
    urllib.request.urlretrieve(url,os.path.join(AUD,key+".mp3")); print(key,"ok",os.path.getsize(os.path.join(AUD,key+".mp3"))//1024,"KB",flush=True)
