#!/usr/bin/env python3
"""manifest.py [--write]  prints the VIDEOS manifest for app.html (and with --write replaces the block between the markers):
one row per film and per chapter a signed-in person can watch, with its audience, roster mode, the group switch it needs,
its title (from cards.json) and its length (from the delivered 720p file)."""
import json,os,re,subprocess,sys
RT=os.path.dirname(os.path.abspath(__file__)); VID=os.path.join(RT,"..","vid"); FF=open(os.path.join(VID,"ffmpeg.path")).read().strip()
OUT="/Users/ranjithkandavelu/Desktop/Myrosta film/runthrough"; APP="/Users/ranjithkandavelu/Desktop/Claude/Myrosta/app.html"
C=json.load(open(os.path.join(RT,"cards.json")))
def dur(p):
    r=subprocess.run([FF,"-i",p],capture_output=True,text=True); m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr); return int(round(int(m[1])*3600+int(m[2])*60+float(m[3])))
FILMS=[("staff","staff","rounds","Myrosta for staff","The whole film: seven things you'll do with it, from the first text to your next leave request. Booking is a tap: the first tap wins."),
       ("staff-rolling","staff","rolling","Myrosta for staff","The whole film for a rolling roster: book what's open, claim what's posted, and the rest."),
       ("staff-basket","staff","rounds","Myrosta for staff","The whole film for a group that keeps the basket: picks wait until Confirm, and the rest."),
       ("admin","admin","rounds","Myrosta for admins","A cycle, first hand: set it up, invite your people, open the round, run it day to day, pay it."),
       ("admin-rolling","admin","rolling","Myrosta for admins","A cycle on a rolling roster: set it up, place first, fill the gaps, go live, run it, pay it."),
       ("director","director",None,"Myrosta for directors","What a director sees of the roster: the board, the fairness table, the whole hospital, and every change written down.")]
MODE={"S2a":"rounds","S2b":"rolling","S2c":"rounds","A3a":"rounds","A3b":"rolling"}; REPLACES={"S2a":"S2c"}   # the basket chapter stands in for the book-as-you-tap one where the basket is switched on (12 Oct 2026)
FEAT={"S2a":"basket","M1":"clock","M2":"callin","M3":"ownhours","M4":"board","M5":"fixed","M6":"walkin","AM6":"walkin","AM1":"clock","AM2":"oncall","AM3":"tags","AM4":"ownhours","AM5":"import"}
STAFF=["S1","S2a","S2b","S2c","S3","S4","S5","S6","S7","M1","M2","M3","M4","M5","M6"]; ADMIN=["A1","A2","A3a","A3b","A4","A5","A6","A7","A8","A9","AM1","AM2","AM3","AM4","AM5","AM6"]
rows=[]
for k,aud,mode,t,d in FILMS:
    r={"id":k,"film":True,"aud":aud,"t":t,"d":d,"s":dur(os.path.join(OUT,"films",f"myrosta-{k}-720p.mp4"))}
    if mode: r["mode"]=mode
    if k=="staff-basket": r["feat"]="basket"; r["replaces"]="staff"   # stands in for the staff film where an admin keeps the basket on (book-as-you-tap is the default since 12 Oct 2026)
    rows.append(r)
for aud,ids in [("staff",STAFF),("admin",ADMIN)]:
    for cid in ids:
        when,title,sub=C[cid]; r={"id":cid,"aud":aud,"t":title,"s":dur(os.path.join(OUT,"chapters-720p",f"rt-{cid}-720p.mp4"))}
        if cid in MODE: r["mode"]=MODE[cid]
        if cid in FEAT: r["feat"]=FEAT[cid]
        if cid in REPLACES: r["replaces"]=REPLACES[cid]
        if aud=="staff": r["v"]=True   # a 9:16 cut exists
        rows.append(r)
js="const VIDEOS=[   // the run-through videos in the private \"videos\" bucket (720p; staff chapters also as <id>-9x16): audience, roster mode, the group switch each needs, title, seconds — written by docs/film/runthrough/gen/manifest.py\n"+",\n".join(" "+json.dumps(r,ensure_ascii=False) for r in rows)+"\n];"
if "--write" in sys.argv:
    s=open(APP).read(); a=s.index("/*VIDEOS-START*/"); b=s.index("/*VIDEOS-END*/")
    s=s[:a]+"/*VIDEOS-START*/\n"+js+"\n"+s[b:]; open(APP,"w").write(s); print("app.html: manifest written,",len(rows),"rows")
else: print(js)
