#!/usr/bin/env python3
"""Capture the landing page's images from the demo, and the phone mock-up's screens for a pixel comparison.

    python3 tools/capture-landing.py views              # writes deploy/view-roster.webp, deploy/view-roster-narrow.webp, deploy/view-fairness.webp
    python3 tools/capture-landing.py phone OUTDIR       # writes OUTDIR/phone-1.png ... one per screen of the mock-up, at 2x, in the app's fallback font
    python3 tools/capture-landing.py compare DIR_A DIR_B   # exit 1 if any screen differs by more than a hair

The demo is driven through a same-origin wrapper page: headless Chrome loads the wrapper, the wrapper loads the page in an iframe,
runs a few lines inside it (view as admin, staff wording "doctor", the tab to show; the demo banner removed), and reports the
rectangle to crop (any expression evaluated inside the page, giving [left, top, width, height]) in its <title>. Nothing in deploy/demo.html or the seed is changed.

Needs Google Chrome and Pillow (pip install pillow).
"""
import functools, http.server, json, pathlib, re, shutil, subprocess, sys, tempfile, threading, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "deploy"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SYSTEM_FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif'

WRAPPER = """<!doctype html><meta charset="utf-8"><title>wait</title>
<style>html,body{margin:0;height:100%%;overflow:hidden;background:#fff}iframe{border:0;width:100vw;height:100vh;display:block}</style>
<iframe id="f" src="%(page)s"></iframe>
<script>
var f=document.getElementById("f");
f.onload=function(){ setTimeout(function(){ var w=f.contentWindow, d=w.document;
  try{ w.eval(%(code)s); }catch(e){ document.title="ERR "+e; return; }
  setTimeout(function(){ var r; try{ r=w.eval(%(rect)s); }catch(e){ document.title="ERR rect "+e; return; }
    if(!r){ document.title="ERR nothing to crop"; return; } document.title="RECT "+JSON.stringify(r); }, %(settle)d); }, %(wait)d); };
</script>"""


def serve(directory):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k): pass
    handler = functools.partial(Quiet, directory=str(directory))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def chrome(url, width, height, png=None):
    """One headless run. With png: a 2x screenshot of the viewport. Without: the rendered DOM, to read the wrapper's <title>.
    This Chrome does not exit by itself after either job, so the process is stopped as soon as the output is complete."""
    prof = tempfile.mkdtemp(prefix="cap-prof-"); log = pathlib.Path(prof) / "dom.txt"
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
           "--disable-background-networking", "--disable-component-update", "--force-device-scale-factor=2",
           "--window-size=%d,%d" % (width, height), "--virtual-time-budget=9000", "--user-data-dir=" + prof]
    cmd += ["--screenshot=" + str(png)] if png else ["--dump-dom"]
    if png and pathlib.Path(png).exists(): pathlib.Path(png).unlink()
    with open(log, "w") as fh:
        proc = subprocess.Popen(cmd + [url], stdout=fh, stderr=subprocess.DEVNULL)
        last, stable, text = -1, 0, ""
        for _ in range(240):                                   # up to 60 s
            time.sleep(0.25)
            if png:
                size = pathlib.Path(png).stat().st_size if pathlib.Path(png).exists() else -1
                stable = stable + 1 if (size > 0 and size == last) else 0; last = size
                if stable >= 3: break
            else:
                text = log.read_text(encoding="utf-8", errors="replace")
                if "</html>" in text: break
            if proc.poll() is not None: break
        if proc.poll() is None:
            proc.terminate()
            try: proc.wait(timeout=5)
            except subprocess.TimeoutExpired: proc.kill(); proc.wait()
    if not png: text = log.read_text(encoding="utf-8", errors="replace")
    shutil.rmtree(prof, ignore_errors=True)
    return text


def shoot(tmp, port, name, page, code, rect, width, height, wait=1500, settle=700):
    """Write the wrapper, read the rectangle, take the screenshot, return (png path, rect in CSS px)."""
    (tmp / (name + ".html")).write_text(WRAPPER % {"page": page, "code": json.dumps(code), "rect": json.dumps(rect), "wait": wait, "settle": settle}, encoding="utf-8")
    url = "http://127.0.0.1:%d/%s.html" % (port, name)
    m = re.search(r"<title>(.*?)</title>", chrome(url, width, height), re.S)
    title = m.group(1) if m else "ERR no title"
    if not title.startswith("RECT "): sys.exit("capture %s failed: %s" % (name, title))
    rect = json.loads(title[5:].replace("&quot;", '"'))
    png = tmp / (name + ".png"); chrome(url, width, height, png)
    return png, rect


def crop2x(png, rect, pad=0):
    from PIL import Image
    im = Image.open(png).convert("RGB"); l, t, w, h = rect
    x, y, cw, ch = int(round((l - pad) * 2)), int(round((t - pad) * 2)), int(round((w + 2 * pad) * 2)), int(round((h + 2 * pad) * 2))   # size from the element, not from its two edges: the same element always gives the same image
    return im.crop((max(0, x), max(0, y), min(im.width, x + cw), min(im.height, y + ch)))


def save_webp(im, path, budget, width=None):
    from PIL import Image
    if width and im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    for q in (90, 86, 82, 78, 74, 70, 66, 62, 58):
        im.save(path, "WEBP", quality=q, method=6)
        if path.stat().st_size <= budget: break
    print("%s  %dx%d  %d bytes (q%d, budget %d)" % (path.name, im.width, im.height, path.stat().st_size, q, budget))
    if path.stat().st_size > budget: sys.exit("over budget: " + path.name)


DEMO_SETUP = ('S.branding=Object.assign({},S.branding||{},{roleNoun:"doctor"}); S.viewAs="admin"; go("%s");'
              'var b=document.getElementById("demoBanner"); if(b)b.remove(); document.documentElement.style.setProperty("--demo-banner","0px"); window.scrollTo(0,0);')


BOX = '(function(e){ if(!e)return null; var r=e.getBoundingClientRect(); return [r.left,r.top,r.width,r.height]; })(document.querySelector(%s))'
# the Fairness plate: from the tiles down to the last row, and across to the end of the "Mon PM" column — a window onto a wider table
EQUITY_BOX = ('(function(){ var c=document.getElementById("eqCard"), g=c&&c.querySelector(".grid-tiles"), t=c&&c.querySelector("table"); if(!g||!t)return null;'
              ' var th=t.querySelectorAll("thead th")[4], a=g.getBoundingClientRect(), b=t.getBoundingClientRect(), x=c.getBoundingClientRect().left+8;'
              ' return [x, a.top-6, th.getBoundingClientRect().right+2-x, b.bottom+1-(a.top-6)]; })()')


def views():
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="cap-views-")); shutil.copy(DEPLOY / "demo.html", tmp / "demo.html")
    srv = serve(tmp); port = srv.server_address[1]
    try:
        png, rect = shoot(tmp, port, "roster", "demo.html", DEMO_SETUP % "roster", BOX % json.dumps(".card"), 1440, 900)
        l, t, w, h = rect
        save_webp(crop2x(png, [0, 0, 1440, min(900, t + h + 28)]), DEPLOY / "view-roster.webp", 120 * 1024, width=1760)   # the app's own bar and tabs, down to just under the grid
        save_webp(crop2x(png, [l, t, 390, min(h, 560)]), DEPLOY / "view-roster-narrow.webp", 60 * 1024, width=780)          # phones: names and the first days, 1:1 at 2x
        png, rect = shoot(tmp, port, "equity", "demo.html", DEMO_SETUP % "equity", EQUITY_BOX, 1200, 1000)
        save_webp(crop2x(png, rect), DEPLOY / "view-fairness.webp", 80 * 1024, width=1000)
    finally:
        srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)


def phone(outdir):
    out = pathlib.Path(outdir); out.mkdir(parents=True, exist_ok=True)
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="cap-phone-"))
    for f in DEPLOY.iterdir():
        if f.is_file() and f.suffix in (".html", ".webp", ".png", ".svg", ".json"): shutil.copy(f, tmp / f.name)
    srv = serve(tmp); port = srv.server_address[1]
    try:
        html = (tmp / "index.html").read_text(encoding="utf-8")
        n = len(set(re.findall(r'data-screen="(\d+)"', html)))
        for i in range(1, n + 1):
            code = ('var st=document.createElement("style"); st.textContent="[data-r],.w{opacity:1!important;filter:none!important;transform:none!important;transition:none!important}"; document.head.appendChild(st);'   # the page's entrance motion is not part of the mock-up
                    'var p=document.getElementById("phone"); p.style.fontFamily=%s; p.setAttribute("data-current","%d");'
                    '[].forEach.call(p.querySelectorAll(".screen"),function(s){ s.style.transition="none"; s.classList.toggle("on",s.getAttribute("data-screen")==="%d"); });'
                    'p.style.boxShadow="none"; p.style.position="fixed"; p.style.left="100px"; p.style.top="100px"; p.style.margin="0"; p.style.zIndex="99";'
                    'var w=document.createElement("div"); w.style.cssText="position:fixed;inset:0;background:#fff;z-index:98"; document.body.appendChild(w);') % (json.dumps(SYSTEM_FONT), i, i)   # lifted to a whole-pixel position, so two captures of the same mock-up are the same pixels
            png, rect = shoot(tmp, port, "phone%d" % i, "index.html", code, BOX % json.dumps("#phone"), 1440, 900, wait=800, settle=500)
            crop2x(png, rect).save(out / ("phone-%d.png" % i)); print("phone-%d.png" % i, [round(x) for x in rect])
    finally:
        srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)


def compare(a, b):
    from PIL import Image, ImageChops
    a, b = pathlib.Path(a), pathlib.Path(b); bad = 0
    fas = sorted(a.glob("phone-*.png"))
    if not fas: sys.exit("compare: no phone-*.png found in " + str(a))   # an empty or mistyped directory must not silently "pass"
    names_a = {f.name for f in fas}
    for fa in fas:
        fb = b / fa.name
        if not fb.exists(): print("MISSING", fb); bad += 1; continue
        ia, ib = Image.open(fa).convert("RGB"), Image.open(fb).convert("RGB")
        if ia.size != ib.size: print("SIZE", fa.name, ia.size, ib.size); bad += 1; continue
        diff = ImageChops.difference(ia, ib).convert("L").point(lambda v: 255 if v > 24 else 0)
        px = sum(1 for v in diff.getdata() if v)
        share = px / float(ia.width * ia.height)
        print("%s  %d px differ (%.4f%%)" % (fa.name, px, share * 100))
        if share > 0.0005: bad += 1
    for fb in sorted(b.glob("phone-*.png")):
        if fb.name not in names_a: print("EXTRA", fb); bad += 1   # a capture only in B is as much a mismatch as one missing from B
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["views"]: views()
    elif a[:1] == ["phone"] and len(a) == 2: phone(a[1])
    elif a[:1] == ["compare"] and len(a) == 3: compare(a[1], a[2])
    else: sys.exit(__doc__)
