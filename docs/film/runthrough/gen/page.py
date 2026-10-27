#!/usr/bin/env python3
"""page.py <out.html> --root <folder with films/ chapters/ chapters-720p/ staff-9x16/> [--artifact]
Writes the chapter page: the five films, then every chapter with its card line, length, narration, step labels and files.
--artifact: video sources point at v/<id>.mp4 (the 720p copies published beside the page) and the 1080p links are left out."""
import json,os,re,subprocess,sys,html,datetime
RT=os.path.dirname(os.path.abspath(__file__)); VID=os.path.join(RT,"..","vid"); FF=open(os.path.join(VID,"ffmpeg.path")).read().strip()
def dur(p):
    r=subprocess.run([FF,"-i",p],capture_output=True,text=True); m=re.search(r"Duration: (\d+):(\d+):([\d.]+)",r.stderr); return int(m[1])*3600+int(m[2])*60+float(m[3])
def mmss(s): s=int(round(s)); return f"{s//60}:{s%60:02d}"
def mb(p): return f"{os.path.getsize(p)/1048576:.1f} MB"
out=sys.argv[1]; root=sys.argv[sys.argv.index("--root")+1]; ART="--artifact" in sys.argv
CH=json.load(open(os.path.join(RT,"chapters.json"))); C={c["id"]:c for c in CH["chapters"]}; CARDS=json.load(open(os.path.join(RT,"cards.json"))); L=json.load(open(os.path.join(RT,"aud","lines.json")))
FILMS=[("staff","Myrosta for staff","Rounds sites: the round opens, you book your share. Seven chapters on the phone."),
       ("staff-rolling","Myrosta for staff · rolling","The same film for rolling sites: book what's open, claim what's posted."),
       ("staff-instant","Myrosta for staff · book as you tap","The same film for a group that books at the first tap: no basket, nothing to confirm."),
       ("admin","Myrosta for admins","A whole cycle on the laptop: set up, people, the round, requests, the day, pay, the department, when things go wrong."),
       ("admin-rolling","Myrosta for admins · rolling","The admin film for rolling sites: place first, fill the gaps, go live."),
       ("director","Myrosta for directors","What a director sees: the board, the fairness table, the whole hospital, every change written down.")]
GROUPS=[("Staff film, chapter by chapter",["S0","S1","S2a","S2b","S3","S4","S5","S6","S7","END-S"]),("Staff modules (where a group has them on)",["M1","M2","M3","M4"]),
        ("Admin film, chapter by chapter",["A0","A1","A2","A3a","A3b","A4","A5","A6","A7","A8","END-A"]),("Admin modules",["AM1","AM2","AM3","AM4","AM5"]),("Director's cut",["D0"])]
def steps(cid):
    c=C[cid]; segs=[s for s in c["segments"] if "take" in s and s.get("steps",True)]
    if not segs: return []
    lg=json.load(open(os.path.join(RT,"logs",segs[0]["take"]+".json"))); return [e["label"] for e in lg["log"]]
def src(kind,name):   # where a file sits, as the page links it
    return {"film":f"films/{name}","chapter":f"chapters/{name}","c720":f"chapters-720p/{name}","v":f"staff-9x16/{name}"}[kind]
def vid_tag(path,poster=None):
    return f'<video controls preload="none" playsinline{(" poster=%s"%html.escape(poster,True)) if poster else ""}><source src="{html.escape(path,True)}" type="video/mp4"></video>'
parts=[]; today=datetime.date.today().strftime("%-d %B %Y")
parts.append(f"""<title>Myrosta run-throughs</title>
<style>
:root{{--bg:#f6f9f8;--fg:#10211f;--muted:#5b6b69;--accent:#0f766e;--accent-2:#14b8a6;--card:#ffffff;--line:#d8e3e0;--chip:#e6f4f1}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#0d1716;--fg:#e8f1ef;--muted:#9bb0ac;--accent:#2dd4bf;--accent-2:#14b8a6;--card:#132220;--line:#24403b;--chip:#173430;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#0d1716;--fg:#e8f1ef;--muted:#9bb0ac;--accent:#2dd4bf;--accent-2:#14b8a6;--card:#132220;--line:#24403b;--chip:#173430;color-scheme:dark}}
body{{background:var(--bg);color:var(--fg);font-family:-apple-system,"Inter",system-ui,Segoe UI,Roboto,sans-serif;line-height:1.5;margin:0;padding-block:0 48px;padding-inline:16px}}
main{{max-width:980px;margin:0 auto}} h1{{font-size:2rem;letter-spacing:-.02em;margin:32px 0 6px;text-wrap:balance}} h2{{font-size:1.25rem;margin:40px 0 12px;padding-top:12px;border-top:1px solid var(--line)}}
.lede{{color:var(--muted);max-width:66ch;margin:0 0 8px}} .meta{{color:var(--muted);font-size:.9rem}}
.films{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}}
.film,.chapter{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;min-width:0}}
.film h3,.chapter h3{{margin:0 0 4px;font-size:1.05rem}} .when{{color:var(--accent);font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;font-weight:600}}
video{{width:100%;max-width:100%;aspect-ratio:16/9;background:#000;border-radius:8px;margin:10px 0 6px;display:block}} video.v{{aspect-ratio:9/16;max-height:520px;width:auto;margin-inline:auto}}
.chapters{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}}
ol.steps{{margin:8px 0 0;padding-left:1.2em;font-size:.9rem}} ol.steps li{{margin:2px 0}}
details{{margin-top:8px;font-size:.92rem}} summary{{cursor:pointer;color:var(--accent);font-weight:600}} details p{{margin:6px 0 0;max-width:66ch}}
.links{{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;font-size:.85rem}} .links a{{background:var(--chip);color:var(--fg);padding:4px 10px;border-radius:999px;text-decoration:none;border:1px solid var(--line)}} .links a:hover{{border-color:var(--accent)}}
a{{color:var(--accent)}} .note{{font-size:.9rem;color:var(--muted);max-width:70ch}} .tag{{display:inline-block;background:var(--chip);border-radius:6px;padding:0 6px;font-size:.8rem;color:var(--muted)}}
</style>
<main>
<h1>Myrosta run-throughs</h1>
<p class="lede">First-person recordings of the app, chapter by chapter: a film for staff, a film for admins, and a short one for directors, with the modules a group may switch on. Real screens from the Wattle Hospital sandbox, a step label in the corner of every tap, captions throughout.</p>
<p class="meta">Built {today}. The two staff and admin films come in a rounds version and a rolling version; pick the one for your site.</p>
<h2>The films</h2><div class="films">""")
for key,title,blurb in FILMS:
    f1080=os.path.join(root,"films",f"myrosta-{key}.mp4"); f720=os.path.join(root,"films",f"myrosta-{key}-720p.mp4")
    if not os.path.exists(f720): continue
    links=[]
    if ART:
        vsrc=f"v/film-{key}.mp4" if os.path.exists(os.path.join(os.environ.get("ARTV",""),f"film-{key}.mp4")) else None
    else: vsrc=src("film",f"myrosta-{key}-720p.mp4"); links=[(src("film",f"myrosta-{key}.mp4"),f"1080p · {mb(f1080)}"),(src("film",f"myrosta-{key}-720p.mp4"),f"720p · {mb(f720)}")]
    player=vid_tag(vsrc) if vsrc else '<p class="note">Too large for this page: the film is in the delivery folder.</p>'
    parts.append(f'<div class="film"><h3>{html.escape(title)}</h3><div class="meta">{mmss(dur(f720))}</div>{player}<p class="note">{html.escape(blurb)}</p><div class="links">'+"".join(f'<a href="{html.escape(h,True)}" download>{html.escape(t)}</a>' for h,t in links)+'</div></div>')
parts.append("</div>")
for gtitle,ids in GROUPS:
    parts.append(f"<h2>{html.escape(gtitle)}</h2><div class=\"chapters\">")
    for cid in ids:
        c720=os.path.join(root,"chapters-720p",f"rt-{cid}-720p.mp4"); c1080=os.path.join(root,"chapters",f"rt-{cid}.mp4"); v9=os.path.join(root,"staff-9x16",f"rt-{cid}-9x16-720p.mp4")
        if not os.path.exists(c720): continue
        when,title,sub=CARDS.get(cid.replace("-",""),CARDS.get(cid,["","",""]))
        card_key=cid.replace("-","") if cid.replace("-","") in CARDS else cid
        when,title,sub=CARDS.get(card_key,["",cid,""])
        nar=L.get(C[cid].get("narration",""),"") if cid in C else ""
        st=steps(cid) if cid in C else []
        vsrc=f"v/{cid}.mp4" if ART else src("c720",f"rt-{cid}-720p.mp4")
        links=[] if ART else [(src("chapter",f"rt-{cid}.mp4"),f"1080p · {mb(c1080)}"),(src("c720",f"rt-{cid}-720p.mp4"),f"720p · {mb(c720)}")]+([(src("v",f"rt-{cid}-9x16-720p.mp4"),"9:16 for phones")] if os.path.exists(v9) else [])
        body=f'<div class="chapter"><div class="when">{html.escape(when or cid)}</div><h3>{html.escape(title)}</h3><div class="meta">{mmss(dur(c720))}{(" · "+html.escape(sub)) if sub else ""}</div>{vid_tag(vsrc)}'
        if st: body+='<ol class="steps">'+"".join(f"<li>{html.escape(re.sub(r'^[0-9]+ · ','',s))}</li>" for s in st)+"</ol>"
        if nar: body+=f'<details><summary>Narration</summary><p>{html.escape(nar)}</p></details>'
        body+='<div class="links">'+"".join(f'<a href="{html.escape(h,True)}" download>{html.escape(t)}</a>' for h,t in links)+'</div></div>'
        parts.append(body)
    parts.append("</div>")
parts.append("""<h2>How these were made, and what they leave out</h2>
<p class="note">Every chapter is a recording of the real app in the Wattle Hospital sandbox, driven tap by tap, with a short zoom on the control that matters and the step written in the corner. The narration is an AI voice reading the approved scripts; its captions are there word for word through the player’s CC button, and nothing is drawn over the picture. The sign-in chapter was taken on a local copy of the app with the code request answered by the recorder, so no text was sent and no real code typed. Three things the sandbox cannot show are told on a card or in a label instead: the live calendar link, Access control (cloud only), and the native confirm box before an import. Nothing on screen is a real roster, person or hospital.</p>
</main>""")
open(out,"w").write("\n".join(parts)); print("wrote",out,os.path.getsize(out),"bytes")
