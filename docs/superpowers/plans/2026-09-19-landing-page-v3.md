# Landing page v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin myrosta.com.au's landing page to the GetLayers *Dantora* style in Myrosta's own teal, add the director's-view section and "No patient data.", and bring Privacy, Terms, Support and Thanks into the same look — without changing a pixel of the phone mock-up or a line of the script that drives it.

**Architecture:** `index.html` stays one self-contained file (inline CSS and script), identical at the repo root and in `deploy/`. The page's CSS is rewritten around a new `:root` token set; the mock-up's CSS is fenced between `/*phone-css*/` and `/*/phone-css*/` with its own tokens on `.phone` and the page-level rules it used to inherit re-declared as `:where(.phone) …`. Each task applies one prepared edit script, so every byte of the result was dry-run before the plan was written. `landing_lint()` in `tests/run.py` gains one rule per task, added failing first.

**Tech Stack:** plain HTML/CSS/vanilla JS; Python 3 (stdlib + Pillow 11) for the lint, the edit scripts and `tools/capture-landing.py`; headless Google Chrome for the captures; Google Fonts (Google Sans Flex, one variable file).

**Spec:** `docs/superpowers/specs/2026-09-19-landing-page-v3-design.md` (read it first; its "As built" section, added in Task 7, records what the dry-run found).

## Global Constraints

- Work on `main`. **Commit, never push** — the owner pushes from GitHub Desktop. End every commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Never touch** `app.html`, `deploy/app.html`, `deploy/demo.html`, `preview.html`, `tools/demo-seed.js`, `tools/build-demo.py`, anything under `supabase/`, or `deploy/og-image.png`.
- **The mock-up is not yours to change.** Between `<!--phone-->` and `<!--/phone-->` only the opening tag may gain `data-r style="--d:300ms"` (Task 5). The first `<script>` after it (the story script) is not edited at all. Steps in Tasks 3 and 5 prove both, and a pixel comparison proves the mock-up renders identically.
- `index.html` and `deploy/index.html` must be byte-identical; so must `thanks.html` and `deploy/thanks.html`. Root `privacy.html` and `support.html` are older, unserved copies: leave them alone.
- The suite is `python3 tests/run.py`; it must end `895 passed, 0 failed  (app.html)` with every lint line `PASS` at the end of every task. A lint line reads `FAIL  landing: problems (N): …` when the landing lint is unhappy.
- `$SP` below means the scratchpad directory `/private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad` — edit scripts are created there, never in the repo. Use the absolute path; shell state does not persist between commands.
- Exact values (colours, sizes, copy) are in the scripts. Transcribe them; do not improve them. The copy of the page may not be reworded.
- Banned words on the landing page (the lint enforces them): self-roster, consultant, cohort, snake, "release for", e04b4b, jamie, werribee. People named on the page come only from the cast Jordan Lee, Ng, Patel, Okafor.

### The edit helper

Several steps apply an *edits file* — lines of `rep(old, new)` — with `$SP/rep.py`. If `$SP/rep.py` does not exist, create it:

```python
# $SP/rep.py  —  usage: python3 $SP/rep.py <file to edit> <edits file>
import pathlib, sys
BS = chr(92)
target = pathlib.Path(sys.argv[1]); text = [target.read_text(encoding="utf-8")]; n = [0]
def fix(t): return t.replace("@U@", BS + "u")
def rep(old, new, cnt=1):
    old = fix(old); new = fix(new); c = text[0].count(old)
    if c != cnt: sys.exit("expected %d, found %d: %r" % (cnt, c, old[:160]))
    text[0] = text[0].replace(old, new); n[0] += 1
exec(open(sys.argv[2], encoding="utf-8").read())
target.write_text(text[0], encoding="utf-8"); print("replacements:", n[0])
```

`rep(old, new, cnt=1)` replaces exactly `cnt` occurrences and stops with an error if the count is different, so a script can never half-apply. Usage: `python3 $SP/rep.py <file to edit> <edits file>`.

---

### Task 1: Guard-rails — the two budgets, and a changelog heading that is not an app release

**Files:**
- Modify: `tests/run.py` (`landing_lint`, `build_lint`)

**Interfaces:**
- Produces: `landing_lint()` allows 600 words and 48 KB. `build_lint()` ignores any `## ` heading containing `(site only)` when it looks for the newest release — Task 7's changelog entry relies on that.

- [ ] **Step 1: Write the failing check.** Put a site-only heading at the top of the changelog, temporarily:

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 - <<'EOF'
import pathlib
p = pathlib.Path("CHANGELOG.md"); s = p.read_text(encoding="utf-8")
p.write_text(s.replace("## 17 Sep 2026", "## 19 Sep 2026 — Landing page v3 (site only)\n\n- placeholder for the test\n\n## 17 Sep 2026", 1), encoding="utf-8")
EOF
```

- [ ] **Step 2: Run the suite and see it fail.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed"`
Expected: a `FAIL` line containing `BUILD 2026-09-17 != CHANGELOG 2026-09-19`, and `894 passed, 1 failed`.

- [ ] **Step 3: Create `$SP/lv3-t1-lint.py`**

```python
rep('    if len(page.encode("utf-8")) >= 40 * 1024: bad.append("index.html is %d KB (budget 40)" % (len(page.encode("utf-8")) // 1024))',
    '    if len(page.encode("utf-8")) >= 48 * 1024: bad.append("index.html is %d KB (budget 48)" % (len(page.encode("utf-8")) // 1024))   # 40 until v3 (19 Sep 2026): the director\'s view and the fenced mock-up CSS are worth their bytes')
rep('    if words > 525: bad.append("%d visible words outside the phone (budget 525)" % words)   # 500 + the confirm-mechanics sentence on step 3 (10 Sep 2026): worth its words',
    '    if words > 600: bad.append("%d visible words outside the phone (budget 600)" % words)   # 525 until v3 (19 Sep 2026): the director\'s view needs 44, and a colleague\'s quote is to come')
rep('        head = next(l for l in (root / "CHANGELOG.md").read_text(encoding="utf-8").splitlines() if l.startswith("## "))',
    '        head = next(l for l in (root / "CHANGELOG.md").read_text(encoding="utf-8").splitlines() if l.startswith("## ") and "(site only)" not in l)   # a landing-page entry is not an app release')
```

- [ ] **Step 4: Apply it and see the suite pass.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/rep.py tests/run.py /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-t1-lint.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed"`
Expected: `replacements: 3` then `895 passed, 0 failed  (app.html)` and no `FAIL` line.

- [ ] **Step 5: Take the temporary heading out again** (Task 7 writes the real entry) and confirm nothing else changed.

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && git checkout CHANGELOG.md && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed" && git status --short`
Expected: `895 passed, 0 failed  (app.html)`; `git status` lists only ` M tests/run.py`.

- [ ] **Step 6: Commit**

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && git add tests/run.py && git commit -q -m "Landing lint: budgets for v3 (600 words, 48 KB), and a changelog heading marked (site only) is not an app release

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 2: The capture tool, the three images, and the mock-up's "before" pictures

**Files:**
- Create: `tools/capture-landing.py`
- Create: `deploy/view-roster.webp`, `deploy/view-roster-narrow.webp`, `deploy/view-fairness.webp`
- Create (outside the repo): `$SP/lv3-phone-before/phone-1.png` … `phone-5.png`

**Interfaces:**
- Produces: `python3 tools/capture-landing.py views` (writes the three images, exits non-zero if one is over budget); `python3 tools/capture-landing.py phone OUTDIR` (one PNG per mock-up screen, in the app's fallback font, on a white sheet, at a whole-pixel position); `python3 tools/capture-landing.py compare DIR_A DIR_B` (prints `N px differ` per screen, exit 1 if any screen differs by more than 0.05%). Tasks 3 and 5 compare against `$SP/lv3-phone-before`, which **must be captured in this task, before the page changes**.

- [ ] **Step 1: Create `tools/capture-landing.py`**

```python
#!/usr/bin/env python3
"""Capture the landing page's images from the demo, and the phone mock-up's screens for a pixel comparison.

    python3 tools/capture-landing.py views              # writes deploy/view-roster.webp, deploy/view-roster-narrow.webp, deploy/view-fairness.webp
    python3 tools/capture-landing.py phone OUTDIR       # writes OUTDIR/phone-1.png ... one per screen of the mock-up, at 2x, in the app's fallback font
    python3 tools/capture-landing.py compare DIR_A DIR_B   # exit 1 if any screen differs by more than a hair

The demo is driven through a same-origin wrapper page: headless Chrome loads the wrapper, the wrapper loads the page in an iframe,
runs a few lines inside it (view as admin, staff wording "doctor", the tab to show; the demo banner removed), and reports the
rectangle to crop (any expression evaluated inside the page, giving [left, top, width, height]) in its <title>. Nothing in deploy/demo.html or the seed is changed.
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
            except subprocess.TimeoutExpired: proc.kill()
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
    png, rect = shoot(tmp, port, "roster", "demo.html", DEMO_SETUP % "roster", BOX % json.dumps(".card"), 1440, 900)
    l, t, w, h = rect
    save_webp(crop2x(png, [0, 0, 1440, min(900, t + h + 28)]), DEPLOY / "view-roster.webp", 120 * 1024, width=1760)   # the app's own bar and tabs, down to just under the grid
    save_webp(crop2x(png, [l, t, 390, min(h, 560)]), DEPLOY / "view-roster-narrow.webp", 60 * 1024, width=780)          # phones: names and the first days, 1:1 at 2x
    png, rect = shoot(tmp, port, "equity", "demo.html", DEMO_SETUP % "equity", EQUITY_BOX, 1200, 1000)
    save_webp(crop2x(png, rect), DEPLOY / "view-fairness.webp", 80 * 1024, width=1000)
    srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)


def phone(outdir):
    out = pathlib.Path(outdir); out.mkdir(parents=True, exist_ok=True)
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="cap-phone-"))
    for f in DEPLOY.iterdir():
        if f.is_file() and f.suffix in (".html", ".webp", ".png", ".svg", ".json"): shutil.copy(f, tmp / f.name)
    srv = serve(tmp); port = srv.server_address[1]
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
    srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)


def compare(a, b):
    from PIL import Image, ImageChops
    a, b = pathlib.Path(a), pathlib.Path(b); bad = 0
    for fa in sorted(a.glob("phone-*.png")):
        fb = b / fa.name
        if not fb.exists(): print("MISSING", fb); bad += 1; continue
        ia, ib = Image.open(fa).convert("RGB"), Image.open(fb).convert("RGB")
        if ia.size != ib.size: print("SIZE", fa.name, ia.size, ib.size); bad += 1; continue
        diff = ImageChops.difference(ia, ib).convert("L").point(lambda v: 255 if v > 24 else 0)
        px = sum(1 for v in diff.getdata() if v)
        share = px / float(ia.width * ia.height)
        print("%s  %d px differ (%.4f%%)" % (fa.name, px, share * 100))
        if share > 0.0005: bad += 1
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["views"]: views()
    elif a[:1] == ["phone"] and len(a) == 2: phone(a[1])
    elif a[:1] == ["compare"] and len(a) == 3: compare(a[1], a[2])
    else: sys.exit(__doc__)
```

- [ ] **Step 2: Capture the three images.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 tools/capture-landing.py views`
Expected: three lines naming `view-roster.webp` (1760 px wide, under 122880 bytes), `view-roster-narrow.webp` (780 px wide, under 61440) and `view-fairness.webp` (1000 px wide, under 81920). Each run takes about ten seconds. Sizes vary by a few hundred bytes from run to run because the demo's dates follow today's date.

- [ ] **Step 3: Look at them.** Open each `.webp` (the Read tool shows images). `view-roster.webp` must show the app's bar and tabs, the heading "Roster grid", a first column headed **Doctor** (not "Consultant"), coloured zone chips, and no "Demo sandbox" banner. `view-fairness.webp` must show two tiles ("TOUGH-SHIFT SHARE", "CLINICAL SHIFTS") above a table of names with green and red bars, ending cleanly after the "Mon PM" column with no half-cut column or footer text. If a capture is blank or shows the staff view ("View only"), run Step 2 again — do not edit the tool to make it pass.

- [ ] **Step 4: Photograph the mock-up as it is today.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 tools/capture-landing.py phone /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-before && python3 tools/capture-landing.py phone /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-check && python3 tools/capture-landing.py compare /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-before /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-check`
Expected: five `phone-N.png [100, 100, 300, 504]` lines, twice, then five lines `phone-N.png  0 px differ (0.0000%)` — two captures of an unchanged page are the same pixels, which is what makes the comparison in Tasks 3 and 5 mean something.

- [ ] **Step 5: Run the suite.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed"`
Expected: `895 passed, 0 failed  (app.html)`.

- [ ] **Step 6: Commit**

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && git add tools/capture-landing.py deploy/view-roster.webp deploy/view-roster-narrow.webp deploy/view-fairness.webp && git commit -q -m "Landing v3: a capture tool that drives the demo through headless Chrome — the director's-view images (roster grid, its phone crop, the Fairness view), and a pixel comparison of the phone mock-up's screens

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 3: The page — head, tokens, the fenced mock-up CSS, and every existing section

**Files:**
- Modify: `tests/run.py` (`landing_lint`: the fence, shadows, font, contrast)
- Modify: `deploy/index.html` and `index.html` (identical)

**Interfaces:**
- Consumes: `$SP/lv3-phone-before` and `tools/capture-landing.py` from Task 2.
- Produces: the page's `:root` tokens (`--bg --panel --ink --ink-2 --line --field --accent --accent-deep --amber --amber-line --glass --glass-subtle --glass-strong --blur --r-panel --r-card --r-section --r-chip --r-pill --t-fast --t --t-slow --ease --font --pw --ps --barh`); classes `.panel .eb .pill(.primary|.secondary|.disc) .dc .chip .lock .rule .trust .tick .cap .step .num .assure .state .k .pgrid .pstate .why .corner .stats .stat .formcard .offer .fields .field(.wide) .lbl .opt .or .fgrid .q .plus .frow`; the CSS markers `/*/phone-css*/` (Task 4 inserts after it), `/* assurance` and `/* frosted surfaces fall back` (Task 5 inserts before it); `<section class="assure">` (Task 4 inserts before it). `id="walkthrough"` is now on the `<form>`.

- [ ] **Step 1: Create `$SP/lv3-t3-lint.py`**

```python
rep('LANDING_CAST = {"Jordan Lee", "Ng", "Patel", "Okafor"}\n',
    'LANDING_CAST = {"Jordan Lee", "Ng", "Patel", "Okafor"}\n'
    'def _lum(h):\n'
    '    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]\n'
    '    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]\n'
    '    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]\n'
    'def _contrast(a, b):\n'
    '    la, lb = _lum(a), _lum(b); return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)   # WCAG 2 contrast ratio\n')
rep('    up = page.upper()\n    for h in ("4C86E8", "F2A638", "2FA86E"):\n        if h not in up: bad.append("mark is missing " + h)\n',
    '    up = page.upper()\n    for h in ("4C86E8", "F2A638", "2FA86E"):\n        if h not in up: bad.append("mark is missing " + h)\n'
    '    # v3: the page and the product are fenced apart in the CSS as they are in the HTML, and the page keeps the Style\'s rules\n'
    '    css = "".join(re.findall(r"<style>(.*?)</style>", page, flags=re.S))\n'
    '    if "/*phone-css*/" not in css or "/*/phone-css*/" not in css: bad.append("the mock-up CSS is not fenced with /*phone-css*/ and /*/phone-css*/")\n'
    '    page_css = re.sub(r"/\\*phone-css\\*/.*?/\\*/phone-css\\*/", " ", css, flags=re.S)\n'
    '    for w in ("box-shadow", "Inter", "#0F243A", "#0f243a"):\n'
    '        if w in page_css: bad.append("page CSS outside the mock-up contains " + w)\n'
    '    if "family=Google+Sans+Flex" not in page: bad.append("the head does not request Google Sans Flex")\n'
    '    if "family=Inter" in page: bad.append("the head still requests Inter")\n'
    '    tok = dict(re.findall(r"(--[a-z0-9-]+):\\s*(#[0-9A-Fa-f]{6})\\b", page_css[:page_css.find("}")]))   # the page\'s own :root\n'
    '    for a, b in (("--ink-2", "--bg"), ("--ink-2", "--panel"), ("--accent", "--bg"), ("--accent", "--panel"), ("#FFFFFF", "--accent"), ("#FFFFFF", "--accent-deep"), ("--ink", "--amber")):\n'
    '        ca, cb = tok.get(a, a), tok.get(b, b)\n'
    '        if not (ca.startswith("#") and cb.startswith("#")): bad.append("contrast token missing: %s on %s" % (a, b)); continue\n'
    '        if _contrast(ca, cb) < 4.5: bad.append("contrast %s on %s is %.2f (needs 4.5)" % (a, b, _contrast(ca, cb)))\n')
```

- [ ] **Step 2: Apply it and see the lint fail.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/rep.py tests/run.py /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-t3-lint.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed" | cut -c1-420`
Expected: `replacements: 2`, then one `FAIL  landing: problems (…)` line that names the missing fence, `box-shadow`, `Inter` and `#0F243A` in the page CSS, the missing Google Sans Flex request, the Inter request, and missing contrast tokens; `894 passed, 1 failed`.

- [ ] **Step 3: Create `$SP/lv3-t3-page.py`**

```python
# lv3-t3-page.py — re-skin index.html to the v3 design (run from the repo root): head, tokens, the fenced mock-up CSS, every existing section
import pathlib, re, sys
ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")
p = (ROOT / "deploy" / "index.html").read_text(encoding="utf-8")
PAGE_A = r""":root{
  --bg:#FFFFFF;--panel:#EFF4F2;--ink:#000000;--ink-2:#666666;--line:rgba(0,0,0,.1);--field:#757575;
  --accent:#05665A;--accent-deep:#044E45;--amber:#FBE9CE;--amber-line:#F9D7A5;
  --glass:rgba(255,255,255,.8);--glass-subtle:rgba(255,255,255,.5);--glass-strong:rgba(255,255,255,.9);--blur:10px;
  --r-panel:8px;--r-card:24px;--r-section:48px;--r-chip:37px;--r-pill:46px;
  --t-fast:150ms;--t:250ms;--t-slow:700ms;--ease:cubic-bezier(.2,0,0,1);
  --font:"Google Sans Flex",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --pw:300px;--ps:.768;--barh:60px;
}
*{box-sizing:border-box}
html{font-size:100%;scroll-behavior:smooth;scroll-padding-top:calc(var(--barh) + 20px);-webkit-text-size-adjust:100%}
body{margin:0;font-family:var(--font);font-size:1rem;font-weight:300;line-height:1.5;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}
@media (max-resolution:1.5dppx){body{font-weight:400}}   /* Light at 16px is spindly on an ordinary monitor */
h1,h2,h3,p,ol{margin:0} ol{padding:0;list-style:none}
a{color:var(--accent);text-underline-offset:.18em}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.wrap{max-width:1180px;margin:0 auto;padding:0 max(24px,env(safe-area-inset-right)) 0 max(24px,env(safe-area-inset-left))}
.intro h1,.lead,.trust,.cap,.eb,.pill,.chip,.step h3,.num,.vhead h2,.state,.pgrid h2,.stat b,.formcard h3,.lbl,.fgrid h2,.q summary{text-box:trim-both cap alphabetic}   /* progressive: without text-box the full line box stays */
.bar,.pin,.chip,.formcard,.plate.small{-webkit-backdrop-filter:blur(var(--blur));backdrop-filter:blur(var(--blur))}
.vhead h2,.pgrid h2,.fgrid h2,.state{font-size:clamp(1.75rem,1rem + 2vw,2.25rem);font-weight:300;line-height:1.1}
.panel{margin-inline:clamp(12px,1.6vw,20px);background:var(--panel);border-radius:var(--r-section)}
.eb{font-size:.875rem;font-weight:500;line-height:1.2;text-transform:uppercase;color:var(--accent)}
.pill{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:54px;padding:0 28px;border:1px solid transparent;border-radius:var(--r-pill);font:inherit;font-size:1.25rem;font-weight:300;line-height:1.2;white-space:nowrap;text-decoration:none;cursor:pointer;transition:background-color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.pill.primary{background:var(--accent);border-color:var(--accent-deep);color:#fff}
.pill.primary:hover{background:var(--accent-deep)}
.pill.secondary{background:var(--amber);border-color:var(--amber-line);color:var(--ink)}
.pill.secondary:hover{background:var(--amber-line)}
.pill.disc{padding:0 2px 0 32px}
.dc{display:grid;place-items:center;width:48px;height:48px;flex:none;border-radius:50%;background:var(--amber);color:var(--ink)}
.dc svg{width:16px;height:16px}
.chip{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border:1px solid var(--line);border-radius:var(--r-chip);background:var(--glass-subtle);color:var(--ink);text-decoration:none;transition:color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.chip:hover{color:var(--accent);border-color:var(--accent)}
/* bar */
.bar{position:sticky;top:0;z-index:20;background:var(--glass);border-bottom:1px solid var(--line)}
.bar .wrap{display:flex;align-items:center;justify-content:space-between;min-height:60px;padding-top:max(0px,env(safe-area-inset-top))}
.lock{display:flex;align-items:center;gap:10px;min-height:44px;font-size:1.25rem;font-weight:500;line-height:1.1;color:var(--ink);text-decoration:none}
.lock svg{width:28px;height:28px;flex:none} .lock .wm{white-space:nowrap} .lock .o{color:var(--accent)}
/* hero (GetLayers artist-hero): the plate is the phone */
.hero{padding:0 0 24px}
.hero .wrap{display:grid;grid-template-columns:minmax(0,1fr) var(--pw);gap:0 72px;align-items:start}
.intro{grid-column:1;grid-row:1;display:flex;flex-direction:column;justify-content:center;min-height:calc(100svh - var(--barh));padding:48px 0}
.intro h1{font-size:clamp(2.5rem,1.3rem + 3.4vw,3.75rem);font-weight:300;line-height:1.1;text-wrap:balance;max-width:11em}
.lead{font-size:1.25rem;line-height:1.3;margin-top:32px;max-width:27em}
.cta{display:flex;flex-wrap:wrap;gap:8px;margin-top:40px}
.rule{width:100%;height:1px;margin:48px 0 0;border:0;background:var(--line)}
.trust{display:flex;align-items:center;gap:12px;margin-top:24px;line-height:1.2;color:var(--accent)}
.tick{flex:none;width:50px;height:1px;background:var(--accent)}
.cap{margin-top:14px;line-height:1.2;color:var(--ink-2)}
.hero .phone{grid-column:2;grid-row:1 / span 2;margin-left:auto}
.hero .phone.sticky{position:sticky;top:max(calc(var(--barh) + 24px),calc(50svh + var(--barh) / 2 - (640px * var(--ps) + 12px) / 2))}   /* the centre of the screen: the line the story script reads */
/* steps (GetLayers artist-process, mirrored) */
.steps{grid-column:1;grid-row:2;padding:24px 0 220px}   /* room for the pinned phone beside the last step */
.steps .eb{margin-bottom:24px}
.step{display:grid;grid-template-columns:104px minmax(0,1fr);align-content:start;padding:32px 0 44px;border-top:1px solid var(--line)}
.step,.num,.step h3,.step p{transition:color var(--t-fast) var(--ease),border-color var(--t-fast) var(--ease)}
.num{grid-row:1 / span 2;font-size:3.75rem;line-height:1;color:rgba(0,0,0,.18)}
.step h3{font-size:1.5rem;font-weight:300;line-height:1.2}
.step p{margin-top:16px;max-width:33em}
.js .step h3,.js .step p{color:var(--ink-2)}
.js .step[aria-current="step"]{border-top-color:var(--accent)}
.js .step[aria-current="step"] h3,.js .step[aria-current="step"] p{color:var(--ink)}
.js .step[aria-current="step"] .num{color:var(--accent)}
"""
PAGE_B = r"""/* assurance (GetLayers artist-statement) */
.assure{padding:128px 0}
.state{line-height:1.2;color:var(--ink-2);max-width:23em;text-wrap:balance}
.k{color:var(--ink)}
/* proof (GetLayers clarix-stats) and the form card riding over its edge (stride-contact) */
.pgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2.6fr);gap:88px 72px;padding-top:96px;padding-bottom:152px}
.pstate{grid-column:1 / -1;max-width:44em}
.why{margin-top:28px}
.corner{align-self:end}
.stats{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:16px}
.stat{display:flex;flex-direction:column;gap:22px;padding-left:24px;border-left:1px solid var(--accent)}
.stat b{font-size:clamp(2.25rem,1.4rem + 1.6vw,3rem);font-weight:300;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap}
.stat span{font-size:.9375rem;line-height:1.35}
.formcard{position:relative;display:block;max-width:720px;margin:-72px auto 0;padding:48px;border:1px solid var(--line);border-radius:var(--r-card);background:var(--glass-strong);scroll-margin-top:calc(var(--barh) + 24px)}
.formcard h3{font-size:1.5rem;font-weight:300;line-height:1.2}
.offer{margin-top:16px;color:var(--ink-2)}
.fields{display:grid;grid-template-columns:1fr 1fr;gap:24px 16px;margin-top:36px}
.field{display:flex;flex-direction:column;gap:12px} .field.wide{grid-column:1 / -1}
.lbl{font-size:.875rem;font-weight:500;line-height:1.2;text-transform:uppercase;color:var(--accent)}
.opt{font-weight:300;text-transform:none;color:var(--ink-2)}
input{font:inherit;width:100%;min-height:52px;padding:14px 20px;border:1px solid var(--field);border-radius:var(--r-panel);background:transparent;color:var(--ink)}
input::placeholder{color:var(--ink-2);opacity:1}
input:focus-visible{border-color:var(--accent)}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.formcard .pill{margin-top:36px}
.or{margin-top:24px;color:var(--ink-2)}
/* faq (GetLayers artist-faq) */
.faq{padding:152px 0 128px}
.fgrid{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:40px 72px}
.fgrid h2{text-wrap:balance}
.q{border-top:1px solid var(--line)} .q:last-child{border-bottom:1px solid var(--line)}
.q summary{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:76px;padding:24px 0;font-size:1.25rem;line-height:1.3;cursor:pointer;list-style:none}
.q summary::-webkit-details-marker{display:none}
.plus{position:relative;flex:none;width:18px;height:18px;color:var(--accent);transition:transform var(--t) var(--ease)}
.plus::before,.plus::after{content:"";position:absolute;left:0;right:0;top:calc(50% - .75px);height:1.5px;background:currentColor}
.plus::after{transform:rotate(90deg)}
.q[open] .plus{transform:rotate(45deg)}
.q p{padding:0 56px 32px 0;max-width:41em}
/* footer (GetLayers loopstack-footer) */
.foot{padding:64px 0 max(44px,env(safe-area-inset-bottom));border-radius:var(--r-section) var(--r-section) 0 0}
.frow{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px}
.frow + .frow{margin-top:32px;padding-top:28px;border-top:1px solid var(--line);font-size:.9375rem;color:var(--ink-2)}
.frow + .frow a{color:var(--ink-2)} .frow + .frow a:hover{color:var(--accent)}
/* frosted surfaces fall back to solid white */
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.bar,.pin,.formcard,.chip{background:#fff}}
@media (prefers-reduced-transparency:reduce){.bar,.pin,.formcard,.chip{background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto} .step,.num,.step h3,.step p,.plus,.pill,.chip{transition:none}}
@media (min-width:861px) and (max-height:699px){.intro{min-height:0}}
@media (max-width:1099px){:root{--pw:240px;--ps:.608} .hero .wrap{gap:0 48px}}
@media (max-width:860px){
  .wrap{padding:0 max(20px,env(safe-area-inset-right)) 0 max(20px,env(safe-area-inset-left))}
  .panel{border-radius:var(--r-card)}
  .pill{height:48px;padding:0 22px;font-size:1.125rem} .pill.disc{padding:0 2px 0 24px} .dc{width:42px;height:42px}
  .hero{padding:0 0 8px}
  .hero .wrap{grid-template-columns:minmax(0,1fr);gap:20px 0}
  .intro{min-height:0;padding:44px 0 12px;grid-row:1} .hero .phone,.pin{grid-column:1;grid-row:2} .steps{grid-row:3}
  .lead{font-size:1.125rem;margin-top:24px} .cta{margin-top:32px} .rule{margin-top:36px}
  .trust{align-items:flex-start} .tick{display:none}
  .hero .phone,.hero .phone.sticky{position:static;margin:0 auto}
  .pin{position:sticky;top:var(--barh,60px);z-index:5;margin:0 -20px;padding:10px 20px 14px;background:var(--glass);border-bottom:1px solid var(--line)}   /* the steps slide beneath it */
  .pin .phone,.pin .phone.sticky{position:relative;top:auto;margin:0 auto}   /* relative: the frame must stay the block that clips its screens */
  .steps{padding:20px 0 40px}
  .step{grid-template-columns:minmax(0,1fr);padding:24px 0 32px} .js .step{min-height:46vh}
  .num{grid-row:auto;font-size:2.5rem;margin-bottom:20px} .step h3{font-size:1.25rem}
  .view{padding:72px 0 64px} .vhead{grid-template-columns:minmax(0,1fr);padding-bottom:32px}
  .plates{margin-top:36px;padding-bottom:0} .plate.small{position:static;width:auto;margin-top:12px}
  .plate.cut::after{content:"";position:absolute;inset:auto 0 0;height:72px;background:linear-gradient(rgba(255,255,255,0),#fff)} .plate.cut img{-webkit-mask-image:linear-gradient(to right,#000 80%,transparent);mask-image:linear-gradient(to right,#000 80%,transparent)}
  .assure{padding:88px 0}
  .pgrid{grid-template-columns:minmax(0,1fr);gap:48px;padding-top:64px;padding-bottom:96px}
  .stats{grid-template-columns:minmax(0,1fr);gap:28px} .stat{gap:14px;padding-left:16px}
  .formcard{margin-top:-48px;padding:32px 24px} .fields{grid-template-columns:minmax(0,1fr)} .field.wide{grid-column:auto}
  .formcard .pill{width:100%;height:auto;min-height:52px;justify-content:space-between;white-space:normal;text-align:left;padding-block:4px;font-size:1rem}
  .faq{padding:104px 0 88px} .fgrid{grid-template-columns:minmax(0,1fr)}
  .q summary{font-size:1.125rem;min-height:64px;padding:20px 0} .q p{padding-right:0}
  .foot{padding-top:48px}
}
@media (max-width:860px) and (max-height:620px){
  .pin{position:static;border-bottom:0;margin-bottom:8px}   /* short screens: nothing pins */
  .js .step{min-height:0}
}
@media print{.bar{position:static}}
"""

def rep(old, new, cnt=1):
    global p
    c = p.count(old)
    if c != cnt: sys.exit("expected %d, found %d: %r" % (cnt, c, old[:120]))
    p = p.replace(old, new)

# ---- head
rep('<meta name="theme-color" content="#0F243A">', '<meta name="theme-color" content="#FFFFFF">')
rep('<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">',
    '<link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@300..500&display=swap" rel="stylesheet">')

# ---- css: page part A, the fenced phone region, page part B
css = re.search(r"<style>(.*?)</style>", p, re.S).group(1)
i, j = css.find("/* the phone */"), css.find("/* band, proof")
root = re.search(r":root\{(.*?)\n\}", css, re.S).group(1)
tokens = "".join(l.strip() for l in root.splitlines())
tokens = re.sub(r"--pw:[^;]+;--ps:[^;]+;", "", tokens)                                   # the frame's size stays a page token
_used = set(re.findall(r"var\((--[a-z0-9-]+)", css[i:j] + re.search(r"<!--phone-->(.*?)<!--/phone-->", p, re.S).group(1))) | {"--font"}
for _ in range(3): _used |= set(re.findall(r"var\((--[a-z0-9-]+)", ";".join(t for t in tokens.split(";") if t.split(":")[0] in _used)))   # tokens that other kept tokens refer to
tokens = ";".join(t for t in tokens.split(";") if t and t.split(":")[0] in _used) + ";"
tokens = re.sub(r'--font:[^;]+;', '--font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;', tokens)   # the app's own fallback stack: what it shows before Inter arrives
phone = css[i:j]
phone = phone.replace(".phone{width:var(--pw);", ".phone{" + tokens + "font-family:var(--font);font-size:var(--fs-md);font-weight:400;line-height:1.55;letter-spacing:normal;color:var(--text);width:var(--pw);", 1)
phone = phone.replace("box-shadow:var(--shadow);flex:none;isolation:isolate", "flex:none;isolation:isolate", 1)   # the device frame loses its drop shadow: the page has none
phone = phone.replace(".phone.sticky{position:sticky;top:90px}   /* declared after .phone, whose position:relative would otherwise win */\n", "", 1)
phone = phone.replace("@media (prefers-reduced-motion:reduce){.screen,.step{transition:none}html{scroll-behavior:auto}}", "@media (prefers-reduced-motion:reduce){.screen{transition:none}}", 1)
scoped = (':where(.phone) h2{letter-spacing:-.015em;color:var(--navy);text-wrap:balance;font-size:var(--fs-xl);font-weight:700}\n'
          ':where(.phone) .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:10px 18px;border-radius:var(--radius-sm);border:1px solid var(--line2);background:var(--surface);color:var(--text);font:inherit;font-weight:600;text-decoration:none;cursor:pointer}\n'
          ':where(.phone) .btn.primary{background:var(--navy);border-color:var(--navy);color:#fff}\n'
          ':where(.phone) .eyebrow{font-size:var(--fs-2xs);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}\n'
          ':where(.phone) .brand{display:flex;align-items:center;gap:9px;min-height:44px;font-weight:700;font-size:var(--fs-lg);color:var(--navy);text-decoration:none}\n'
          ':where(.phone) .logo{width:28px;height:28px;flex:none}\n'
          ':where(.phone) .alt{font-size:var(--fs-sm);color:var(--muted);margin-top:10px;text-align:center}\n')   # the page-level rules the mock-up used to inherit, at their old specificity (:where adds none), ahead of the mock-up's own rules as they always were
phone = phone.replace("/* the phone */\n", "/*phone-css*/   /* the mock-up is product UI: it keeps the app's own tokens, type and components, fenced off from the page */\n", 1)
k = phone.index("\n.screens{")
phone = phone[:k] + "\n" + scoped.rstrip("\n") + phone[k:]
phone = phone.rstrip("\n") + "\n/*/phone-css*/\n"
newcss = "\n" + PAGE_A + phone + PAGE_B
p = p.replace(css, newcss, 1)

# ---- body
MARK = re.search(r'<svg class="logo"(.*?)</svg>', p, re.S).group(0)
SYMBOL = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="mk" viewBox="0 0 40 40">' + re.search(r'<svg class="logo"[^>]*>(.*?)</svg>', MARK, re.S).group(1) + '</symbol></svg>'
USE = '<svg viewBox="0 0 40 40" aria-hidden="true"><use href="#mk"/></svg>'
ARROW = '<span class="dc" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
rep('<body>\n', '<body>\n' + SYMBOL + '\n')
rep('  <a class="brand" href="/">' + MARK + '<span class="wm">Myr<span class="o">o</span>sta</span></a>\n  <a class="btn primary" href="app.html">Sign in</a>',
    '  <a class="lock" href="/">' + USE + '<span class="wm">Myr<span class="o">o</span>sta</span></a>\n  <a class="chip" href="app.html">Sign in</a>')
rep('    <div class="cta"><a class="btn primary" href="demo.html">Try the demo</a><a class="btn" href="#walkthrough">Book a walkthrough</a></div>\n    <p class="pilot"><i></i>In daily use at a Victorian emergency department since June 2026. Taking on new departments across Australia.</p>',
    '    <div class="cta"><a class="pill primary disc" href="demo.html">Try the demo' + ARROW + '</a><a class="pill secondary" href="#walkthrough">Book a walkthrough</a></div>\n    <hr class="rule">\n    <p class="trust">In daily use at a Victorian emergency department since June 2026.<span class="tick" aria-hidden="true"></span></p>\n    <p class="cap">Taking on new departments across Australia.</p>')
rep('    <h2 id="storyT" class="eyebrow" style="margin:0 0 6px 25px">See it work</h2>\n', '    <h2 id="storyT" class="eb">See it work</h2>\n    <ol>\n')
for n in "1234":
    cur = ' aria-current="step"' if n == "1" else ""
    rep('    <div class="step" data-step="%s"%s><span class="n">%s of 4</span>' % (n, cur, n), '    <li class="step" data-step="%s"%s><span class="num" aria-hidden="true">0%s</span>' % (n, cur, n))
rep("not messages to chase.</p></div>\n  </div>\n", "not messages to chase.</p></li>\n    </ol>\n  </div>\n")
p = re.sub(r'(<li class="step".*?</p>)</div>', r"\1</li>", p)
rep('<section class="band"><div class="wrap"><p>A code by text or email, <b>no password</b>. Data stays in <b>Sydney</b>. Every change is <b>logged</b>.</p></div></section>',
    '<section class="assure"><div class="wrap"><p class="state">A code by text or email, <span class="k">no password</span>. <span class="k">No patient data.</span> Data <span class="k">stays in Sydney</span>. Every change <span class="k">is logged</span>.</p></div></section>')
old_proof = p[p.index('<section class="proof" id="walkthrough"'):p.index('<section class="faq"')]
new_proof = '''<section class="proof" aria-labelledby="proofT">
  <div class="panel"><div class="wrap pgrid">
    <div class="pstate">
      <h2 id="proofT">Built in an ED, for EDs.</h2>
      <p class="why">Most department rosters still live in a 56-column spreadsheet that one person can edit. Myrosta puts the whole thing on every phone, with the fairness rules built in. It was built by an emergency physician who ran his own department's roster.</p>
    </div>
    <p class="eb corner">Real roster, real numbers</p>
    <div class="stats">
      <div class="stat"><b>June 2026</b><span>live in a Victorian emergency department</span></div>
      <div class="stat"><b>36</b><span>doctors on the roster, in 56-day cycles</span></div>
      <div class="stat"><b>0</b><span>passwords or app-store installs</span></div>
    </div>
  </div></div>
  <div class="wrap"><form name="walkthrough" id="walkthrough" class="formcard" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field">
    <h3>Book a 20-minute walkthrough</h3>
    <p class="offer">Bring your current roster to the walkthrough and we'll show what it looks like in Myrosta.</p>
    <input type="hidden" name="form-name" value="walkthrough">
    <p class="hp" aria-hidden="true"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
    <div class="fields">
      <label class="field"><span class="lbl">Name</span><input name="name" autocomplete="name" required></label>
      <label class="field"><span class="lbl">Work email</span><input type="email" name="email" autocomplete="email" required></label>
      <label class="field wide"><span class="lbl">Hospital and department</span><input name="hospital" autocomplete="organization" required></label>
      <label class="field wide"><span class="lbl">What runs your roster today? <span class="opt">(optional)</span></span><input name="today" placeholder="A spreadsheet, a whiteboard, another app…"></label>
    </div>
    <button class="pill primary disc" type="submit">Book a 20-minute walkthrough''' + ARROW + '''</button>
    <p class="or">Prefer email? <a href="mailto:hello@myrosta.com.au?subject=Myrosta%20walkthrough">hello@myrosta.com.au</a></p>
  </form></div>
</section>

'''
p = p.replace(old_proof, new_proof, 1)
rep('<section class="faq" aria-labelledby="faqT"><div class="wrap">\n  <h2 id="faqT">Questions, answered.</h2>\n', '<section class="faq" aria-labelledby="faqT"><div class="wrap fgrid">\n  <h2 id="faqT">Questions, answered.</h2>\n  <div>\n')
rep('<details class="hd">', '<details class="q">', 5)
rep('<span class="mk" aria-hidden="true"></span>', '<span class="plus" aria-hidden="true"></span>', 5)
rep("Book a walkthrough and ask.</p></details>\n</div></section>", "Book a walkthrough and ask.</p></details>\n  </div>\n</div></section>")
rep('<footer class="foot"><div class="wrap">\n  <span>© 2026 Myrosta · Made in Melbourne</span>\n  <span><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="support.html">Support</a> · <a href="demo.html">Demo</a></span>\n</div></footer>',
    '<footer class="foot panel"><div class="wrap">\n  <div class="frow"><a class="lock" href="/">' + USE + '<span class="wm">Myr<span class="o">o</span>sta</span></a><span>Made in Melbourne</span></div>\n  <div class="frow"><span><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="support.html">Support</a> · <a href="demo.html">Demo</a></span><span>© 2026 Myrosta</span></div>\n</div></footer>')
for f in (ROOT / "deploy" / "index.html", ROOT / "index.html"): f.write_text(p, encoding="utf-8")
print("index.html re-skinned:", len(p.encode("utf-8")), "bytes")
```

- [ ] **Step 4: Apply it and see the suite pass.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-t3-page.py . && cmp index.html deploy/index.html && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed"`
Expected: `index.html re-skinned: 43968 bytes`, no output from `cmp`, then `895 passed, 0 failed  (app.html)`.

- [ ] **Step 5: Prove the mock-up's markup and the story script did not change.**

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 - <<'EOF'
import re, subprocess
new = open("deploy/index.html", encoding="utf-8").read()
old = subprocess.run(["git", "show", "HEAD:deploy/index.html"], capture_output=True, text=True).stdout
blk = lambda s: re.search(r"<!--phone-->(.*?)<!--/phone-->", s, re.S).group(1)
story = lambda s: [x for x in re.findall(r"<script>(.*?)</script>", s, re.S) if "data-current" in x][0]
assert blk(old) == blk(new), "the mock-up's markup changed"
assert story(old) == story(new), "the story script changed"
print("mock-up markup and story script unchanged")
EOF
```

Expected: `mock-up markup and story script unchanged`.

- [ ] **Step 6: Prove the mock-up renders the same pixels.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 tools/capture-landing.py phone /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-after3 >/dev/null && python3 tools/capture-landing.py compare /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-before /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-after3`
Expected: five lines, each `0 px differ (0.0000%)`. Any other number means a page rule is reaching into the mock-up: stop and report it — do not adjust the comparison.

- [ ] **Step 7: Commit**

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && git add tests/run.py index.html deploy/index.html && git commit -q -m "Landing v3: the page in the Dantora style and Myrosta's teal — Google Sans Flex Light, frosted bar, pills, hairlines, no shadows; steps as ruled index rows, the assurance line as a statement with 'No patient data.', proof as an inset panel with ruled stats, the form as a card riding over its edge, a ruled FAQ, a panel footer. The mock-up's CSS is fenced off with its own tokens: its markup, the story script and its pixels are unchanged. The lint now checks the fence, shadows, the font and AA contrast from the page's tokens

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 4: The director's view

**Files:**
- Modify: `tests/run.py` (`landing_lint`: images)
- Modify: `deploy/index.html` and `index.html` (identical)

**Interfaces:**
- Consumes: the three images from Task 2; the markers `/*/phone-css*/` and `<section class="assure">` from Task 3.
- Produces: `<section class="view panel" id="view" aria-labelledby="viewT">` with `.vhead`, `.plates`, `.plate`, `.plate.small`, `.plate.cut` (Task 5 puts `data-r` on `.vhead` and `.plates`).

- [ ] **Step 1: Create `$SP/lv3-t4-lint.py`**

```python
rep('        if _contrast(ca, cb) < 4.5: bad.append("contrast %s on %s is %.2f (needs 4.5)" % (a, b, _contrast(ca, cb)))\n',
    '        if _contrast(ca, cb) < 4.5: bad.append("contrast %s on %s is %.2f (needs 4.5)" % (a, b, _contrast(ca, cb)))\n'
    '    imgs, total = set(), 0   # every image the page shows is deployed, sized, and light\n'
    '    for tag in re.findall(r"<(?:img|source)\\b[^>]*>", page):\n'
    '        urls = re.findall(r\'\\bsrc="([^"]+)"\', tag) + [u.strip().split(" ")[0] for s in re.findall(r\'\\bsrcset="([^"]+)"\', tag) for u in s.split(",")]\n'
    '        imgs.update(u.split("?")[0].lstrip("/") for u in urls if not u.startswith(("http", "data:")))\n'
    '        if tag.startswith("<img") and not (re.search(r\'\\bwidth="\\d+"\', tag) and re.search(r\'\\bheight="\\d+"\', tag)): bad.append("an <img> has no width and height: " + tag[:70])\n'
    '    for u in sorted(imgs):\n'
    '        f = root / "deploy" / u\n'
    '        if not f.exists(): bad.append("image missing from deploy/: " + u); continue\n'
    '        total += f.stat().st_size\n'
    '        if f.stat().st_size > 120 * 1024: bad.append("%s is %d KB (budget 120)" % (u, f.stat().st_size // 1024))\n'
    '    if total > 300 * 1024: bad.append("landing images total %d KB (budget 300)" % (total // 1024))\n'
    '    for need in ("view-roster.webp", "view-roster-narrow.webp", "view-fairness.webp"):\n'
    '        if need not in imgs: bad.append("the director\'s view does not show " + need)\n')
```

- [ ] **Step 2: Apply it and see the lint fail.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/rep.py tests/run.py /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-t4-lint.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed" | cut -c1-300`
Expected: `replacements: 1`, then `FAIL  landing: problems (3): the director's view does not show view-roster.webp, … view-roster-narrow.webp, … view-fairness.webp`; `894 passed, 1 failed`.

- [ ] **Step 3: Create `$SP/lv3-t4-view.py`**

```python
# lv3-t4-view.py — add the director's view: its CSS after the fenced mock-up CSS, its section before the assurance line (run from the repo root)
import pathlib, sys
ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")
p = (ROOT / "deploy" / "index.html").read_text(encoding="utf-8")
VIEW_CSS = r"""/* director's view (GetLayers creative-director-portfolio) */
.view{padding:104px 0 88px}
.vhead{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px 72px;align-items:end;padding-bottom:44px;border-bottom:1px solid var(--line)}
.vhead h2{margin-top:24px;text-wrap:balance}
.vhead > p{max-width:33em}
.plates{position:relative;margin-top:56px;padding-bottom:72px}
.plate{position:relative;display:block;overflow:hidden;border:1px solid var(--line);border-radius:var(--r-card);background:#fff}
.plate img{display:block;width:100%;height:auto}
.plate.small{position:absolute;right:40px;bottom:0;width:min(42%,480px);padding:10px;background:var(--glass-strong)}
.plate.small img{border-radius:14px;-webkit-mask-image:linear-gradient(to right,#000 80%,transparent);mask-image:linear-gradient(to right,#000 80%,transparent)}
"""
VIEW_HTML = r"""<section class="view panel" id="view" aria-labelledby="viewT"><div class="wrap">
  <div class="vhead">
    <div><p class="eb">For whoever runs the roster</p><h2 id="viewT">The whole roster on one screen.</h2></div>
    <p>Every zone and every day at once, with the days that still need cover flagged. The Fairness view shows who carried the weekends and the late shifts — the same table for everyone.</p>
  </div>
  <div class="plates">
    <picture class="plate cut"><source media="(max-width:860px)" srcset="view-roster-narrow.webp" width="780" height="1120"><img src="view-roster.webp" width="1760" height="989" alt="The roster grid: staff down the side, days across, every booked zone a coloured chip, cover counted under each day" loading="lazy" decoding="async"></picture>
    <div class="plate small"><img src="view-fairness.webp" width="1000" height="756" alt="The Fairness view: each person's share of weekends, Friday and Monday evenings, as bars against the team average" loading="lazy" decoding="async"></div>
  </div>
</div></section>
"""
def rep(old, new, cnt=1):
    global p
    c = p.count(old)
    if c != cnt: sys.exit("expected %d, found %d: %r" % (cnt, c, old[:120]))
    p = p.replace(old, new)
rep("/*/phone-css*/\n", "/*/phone-css*/\n" + VIEW_CSS)
rep('<section class="assure">', VIEW_HTML.rstrip("\n") + '\n\n<section class="assure">')
for f in (ROOT / "deploy" / "index.html", ROOT / "index.html"): f.write_text(p, encoding="utf-8")
print("director's view added:", len(p.encode("utf-8")), "bytes")
```

- [ ] **Step 4: Apply it and see the suite pass.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-t4-view.py . && cmp index.html deploy/index.html && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed"`
Expected: `director's view added: 45857 bytes`, no output from `cmp`, `895 passed, 0 failed  (app.html)`.

- [ ] **Step 5: Commit**

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && git add tests/run.py index.html deploy/index.html && git commit -q -m "Landing v3: the director's view — a header row over the Roster grid, with the Fairness view riding over its corner; a purpose-made crop on phones. The lint checks every image the page shows is deployed, sized and light

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 5: Motion — copy that resolves out of a blur, once, and only with scripts

**Files:**
- Modify: `tests/run.py` (`landing_lint`: the reveal's gate)
- Modify: `deploy/index.html` and `index.html` (identical)

**Interfaces:**
- Consumes: the marker `/* frosted surfaces fall back` and the elements `.lead .cta .rule .trust .cap #phone .vhead .plates .state .pstate .stats .formcard #faqT` from Tasks 3 and 4.
- Produces: `[data-r]` blocks and the headline's `.w` word spans, hidden only under `html.js`, shown by a second `<script>` that adds `.in` (IntersectionObserver, a 3-second sweep, `pageshow`).

- [ ] **Step 1: Create `$SP/lv3-t5-lint.py`**

```python
rep('        if need not in imgs: bad.append("the director\'s view does not show " + need)\n',
    '        if need not in imgs: bad.append("the director\'s view does not show " + need)\n'
    '    if re.search(r"(?<!\\.js )\\[data-r\\][^{}]*\\{[^}]*opacity:0", css): bad.append("a reveal style hides content without .js")   # with scripts off everything must simply be visible\n'
    '    for need in ("[data-r]", "prefers-reduced-motion", "setTimeout(sweep"):\n'
    '        if need not in page: bad.append("motion: missing " + need)\n')
```

- [ ] **Step 2: Apply it and see the lint fail.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/rep.py tests/run.py /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-t5-lint.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed" | cut -c1-300`
Expected: `replacements: 1`, then `FAIL  landing: problems (2): motion: missing [data-r], motion: missing setTimeout(sweep`; `894 passed, 1 failed`.

- [ ] **Step 3: Create `$SP/lv3-t5-motion.py`**

```python
# lv3-t5-motion.py — the reveal: CSS before the fallbacks, attributes on the blocks, the headline's word spans, and the small script (run from the repo root)
import pathlib, sys
ROOT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")
p = (ROOT / "deploy" / "index.html").read_text(encoding="utf-8")
MOTION_CSS = r"""/* reveal: out of a blur, rising; only under .js, once */
.js [data-r],.js .w{opacity:0;filter:blur(12px);transform:translateY(20px);transition:opacity 400ms var(--ease) var(--d,0ms),filter var(--t-slow) var(--ease) var(--d,0ms),transform var(--t-slow) var(--ease) var(--d,0ms)}
.js .w{display:inline-block;filter:blur(20px);transform:translateY(24px)}
.js [data-r="w"],.js .in,.js .in .w{opacity:1;filter:none;transform:none}
@media (prefers-reduced-motion:reduce){.js [data-r],.js .w{filter:none;transform:none;transition:opacity 150ms linear}}
@media print{.js [data-r],.js .w{opacity:1;filter:none;transform:none}}
"""
def rep(old, new, cnt=1):
    global p
    c = p.count(old)
    if c != cnt: sys.exit("expected %d, found %d: %r" % (cnt, c, old[:120]))
    p = p.replace(old, new)
rep("/* frosted surfaces fall back", MOTION_CSS + "/* frosted surfaces fall back")
words = "The ED roster, finally on every phone.".split(" ")
rep('<h1 id="h1">The ED roster, finally on every phone.</h1>', '<h1 id="h1" data-r="w">' + " ".join('<span class="w" style="--d:%dms">%s</span>' % (i * 55, w) for i, w in enumerate(words)) + '</h1>')
rep('<p class="lead">', '<p class="lead" data-r style="--d:420ms">')
rep('<div class="cta">', '<div class="cta" data-r style="--d:510ms">')
rep('<hr class="rule">', '<hr class="rule" data-r style="--d:600ms">')
rep('<p class="trust">', '<p class="trust" data-r style="--d:690ms">')
rep('<p class="cap">', '<p class="cap" data-r style="--d:780ms">')
rep('<div class="phone sticky" id="phone"', '<div class="phone sticky" id="phone" data-r style="--d:300ms"')
rep('<div class="vhead">', '<div class="vhead" data-r>')
rep('<div class="plates">', '<div class="plates" data-r>')
rep('<p class="state">', '<p class="state" data-r>')
rep('<div class="pstate">', '<div class="pstate" data-r>')
rep('<div class="stats">', '<div class="stats" data-r>')
rep('class="formcard" method="POST"', 'class="formcard" data-r method="POST"')
rep('<h2 id="faqT">', '<h2 id="faqT" data-r>')
REVEAL = """<script>
(function(){
  var els=[].slice.call(document.querySelectorAll("[data-r]")); function show(e){ e.classList.add("in"); }
  if(!("IntersectionObserver" in window)){ els.forEach(show); return; }
  var io=new IntersectionObserver(function(es){ es.forEach(function(x){ if(x.isIntersecting){ show(x.target); io.unobserve(x.target); } }); },{threshold:0.12,rootMargin:"0px 0px -6% 0px"});
  els.forEach(function(e){ io.observe(e); });
  function sweep(){ els.forEach(function(e){ var r=e.getBoundingClientRect(); if(r.top<window.innerHeight&&r.bottom>0)show(e); }); }   // nothing in view may stay hidden: a missed callback heals itself
  setTimeout(sweep,3000); window.addEventListener("pageshow",sweep);
})();
</script>
"""
rep("</script>\n</body>", "</script>\n" + REVEAL + "</body>")

for f in (ROOT / "deploy" / "index.html", ROOT / "index.html"): f.write_text(p, encoding="utf-8")
print("motion added:", len(p.encode("utf-8")), "bytes")
```

- [ ] **Step 4: Apply it and see the suite pass.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-t5-motion.py . && cmp index.html deploy/index.html && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed"`
Expected: `motion added: 47694 bytes`, no output from `cmp`, `895 passed, 0 failed  (app.html)`.

- [ ] **Step 5: Prove the mock-up is still untouched** — its opening tag gained the reveal attribute and nothing else, the story script is the same, and the pixels are the same.

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 - <<'EOF'
import re, subprocess
new = open("deploy/index.html", encoding="utf-8").read()
old = subprocess.run(["git", "show", "HEAD:deploy/index.html"], capture_output=True, text=True).stdout
blk = lambda s: re.search(r"<!--phone-->(.*?)<!--/phone-->", s, re.S).group(1)
story = lambda s: [x for x in re.findall(r"<script>(.*?)</script>", s, re.S) if "data-current" in x][0]
assert blk(old) == blk(new).replace(' data-r style="--d:300ms"', "", 1), "the mock-up's markup changed beyond the reveal attribute"
assert story(old) == story(new), "the story script changed"
print("mock-up markup and story script unchanged")
EOF
python3 tools/capture-landing.py phone /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-after5 >/dev/null && python3 tools/capture-landing.py compare /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-before /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-phone-after5
```

Expected: `mock-up markup and story script unchanged`, then five lines of `0 px differ (0.0000%)`.

- [ ] **Step 6: Commit**

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && git add tests/run.py index.html deploy/index.html && git commit -q -m "Landing v3: the Style's one motion — the headline resolves word by word out of a blur, blocks follow as they enter the screen, once; nothing is hidden without scripts, reduce-motion gets a plain fade, and a sweep reveals anything a missed callback left behind

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 6: Privacy, Terms, Support and Thanks

**Files:**
- Modify: `tests/run.py` (`landing_lint`: the small pages)
- Modify: `deploy/privacy.html`, `deploy/terms.html`, `deploy/support.html`
- Modify: `deploy/thanks.html` and `thanks.html` (identical)

**Interfaces:**
- Consumes: nothing from the landing page but its look (tokens are repeated in each small page; they are standalone files).

- [ ] **Step 1: Create `$SP/lv3-t6-lint.py`**

```python
rep('        if need not in page: bad.append("motion: missing " + need)\n',
    '        if need not in page: bad.append("motion: missing " + need)\n'
    '    for name in ("privacy.html", "terms.html", "support.html", "thanks.html"):   # the small pages wear the same brand\n'
    '        f = root / "deploy" / name; t = f.read_text(encoding="utf-8") if f.exists() else ""\n'
    '        if re.search("e04b4b", t, re.I): bad.append(name + " still carries the old red (E04B4B)")\n'
    '        if "family=Inter" in t or "family=Google+Sans+Flex" not in t: bad.append(name + " does not use the page\'s font")\n')
```

- [ ] **Step 2: Apply it and see the lint fail.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/rep.py tests/run.py /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-t6-lint.py && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed" | cut -c1-420`
Expected: `replacements: 1`, then `FAIL  landing: problems (7): …` — the old red in Privacy, Terms and Support, and all four pages not using the page's font; `894 passed, 1 failed`.

- [ ] **Step 3: Create `$SP/lv3-t6-small.py`**

```python
# smallpages.py — re-skin Privacy, Terms, Support (deploy/ only: the root copies are older and unserved) and Thanks (both copies, identical)
import pathlib, re, sys
W = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")
FONT = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@300..500&display=swap" rel="stylesheet">\n')
TOKENS = ':root{--ink:#000000;--ink-2:#666666;--line:rgba(0,0,0,.1);--accent:#05665A;--accent-deep:#044E45;--amber:#FBE9CE;--amber-line:#F9D7A5;--panel:#EFF4F2;--font:"Google Sans Flex",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}'
BASE = ('*{box-sizing:border-box}\n  body{margin:0;font-family:var(--font);font-weight:300;line-height:1.6;background:#fff;color:var(--ink);-webkit-font-smoothing:antialiased}\n'
        '  @media (max-resolution:1.5dppx){body{font-weight:400}}\n  a{color:var(--accent);text-underline-offset:.18em}\n  :focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n'
        '  .brand{display:flex;align-items:center;gap:10px;min-height:44px;font-size:1.25rem;font-weight:500;line-height:1.1;color:var(--ink);text-decoration:none}.brand .o{color:var(--accent)}\n'
        '  .chip{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border:1px solid var(--line);border-radius:37px;color:var(--ink);text-decoration:none}.chip:hover{color:var(--accent);border-color:var(--accent)}\n')
DOC = ('\n  ' + TOKENS + '\n  ' + BASE +
       '  .wrap{max-width:740px;margin:0 auto;padding:0 24px}\n  nav{display:flex;align-items:center;justify-content:space-between;min-height:60px;border-bottom:1px solid var(--line)}\n  nav > a:last-child:not(.chip){color:var(--ink-2)}\n'
       '  h1{margin:64px 0 20px;font-size:2.5rem;font-weight:300;line-height:1.1}\n  .lead{margin:0 0 36px;font-size:1.25rem;line-height:1.35;color:var(--ink-2)}\n  h2{margin:40px 0 12px;font-size:1.25rem;font-weight:500;line-height:1.3}\n'
       '  p,li{margin:0 0 10px;font-size:1rem}\n  ol,ul{margin:0;padding-left:22px}\n  strong{font-weight:500}\n'
       '  .note{margin:28px 0;padding:20px 24px;border-radius:24px;background:var(--panel);font-size:.9375rem}\n  footer{margin-top:64px;padding:28px 0 44px;border-top:1px solid var(--line);font-size:.875rem;color:var(--ink-2)}footer a{color:var(--ink-2)}\n')
FOOT = {"privacy": '<a href="/">Home</a> · <a href="terms.html">Terms</a> · <a href="support.html">Support</a>',
        "support": '<a href="/">Home</a> · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a>',
        "terms":   '<a href="/">Home</a> · <a href="privacy.html">Privacy</a> · <a href="support.html">Support</a>'}

MARK = ('<svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#0F243A"/><path d="M17 31 L17 11 L24.5 22 L32 11 L32 31" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
        '<path d="M7 13 L14 13" fill="none" stroke="#4C86E8" stroke-width="2.2" stroke-linecap="round"/><path d="M7 21 L12 21" fill="none" stroke="#F2A638" stroke-width="2.2" stroke-linecap="round"/><path d="M7 29 L14 29" fill="none" stroke="#2FA86E" stroke-width="2.2" stroke-linecap="round"/></svg>')

def once(s, old, new):
    assert s.count(old) == 1, (old[:70], s.count(old)); return s.replace(old, new)

for name in ("privacy", "support", "terms"):
    f = W / "deploy" / (name + ".html"); s = f.read_text(encoding="utf-8")
    s = once(s, '<meta name="theme-color" content="#0F243A">', '<meta name="theme-color" content="#FFFFFF">')
    s = once(s, "<style>", FONT + "<style>")
    s = s[:s.index("<style>") + 7] + DOC + s[s.index("</style>"):]
    s = once(s, '<div class="stripe"><i class="r"></i><i class="a"></i><i class="g"></i></div>\n', "")
    s = re.sub(r'(<a class="brand" href="/">)<svg.*?</svg>', lambda m: m.group(1) + MARK, s, count=1, flags=re.S)   # the small pages still carried the old mark, red rail and all
    if name == "support": s = once(s, '<a class="btn" href="app.html">Sign in</a>', '<a class="chip" href="app.html">Sign in</a>')
    s = re.sub(r"<footer>.*?</footer>", "<footer>© 2026 Myrosta · Made in Melbourne · " + FOOT[name] + "</footer>", s, count=1, flags=re.S)
    f.write_text(s, encoding="utf-8")

THANKS = ('\n' + TOKENS + '\n' + BASE.replace("\n  ", "\n") +
          '.wrap{max-width:1180px;margin:0 auto;padding:0 24px}\n.bar{border-bottom:1px solid var(--line)}.bar .wrap{display:flex;align-items:center;justify-content:space-between;min-height:60px}\n.logo{width:28px;height:28px;flex:none}.brand .wm{white-space:nowrap}\n'
          'main .wrap{max-width:720px;padding:96px 24px 120px}\nh1{margin:0 0 24px;font-size:clamp(2rem,1.2rem + 2.6vw,2.5rem);font-weight:300;line-height:1.1;text-wrap:balance}\np{margin:0;font-size:1.25rem;line-height:1.35;color:var(--ink-2)}\n.cta{display:flex;flex-wrap:wrap;gap:8px;margin-top:40px}\n'
          '.pill{display:inline-flex;align-items:center;justify-content:center;min-height:54px;padding:0 28px;border:1px solid transparent;border-radius:46px;font-size:1.25rem;line-height:1.2;white-space:nowrap;text-decoration:none}\n'
          '.pill.primary{background:var(--accent);border-color:var(--accent-deep);color:#fff}.pill.primary:hover{background:var(--accent-deep)}\n.pill.secondary{background:var(--amber);border-color:var(--amber-line);color:var(--ink)}.pill.secondary:hover{background:var(--amber-line)}\n'
          '.foot{padding:28px 0 44px;border-top:1px solid var(--line);font-size:.875rem;color:var(--ink-2)}.foot a{color:var(--ink-2)}\n')
s = (W / "deploy" / "thanks.html").read_text(encoding="utf-8")
s = once(s, '<meta name="theme-color" content="#0F243A">', '<meta name="theme-color" content="#FFFFFF">') if 'content="#0F243A"' in s else s
s = re.sub(r"<link[^>]*fonts\.googleapis\.com/css2\?family=Inter[^>]*>\n?", "", s)
s = s if "Google+Sans+Flex" in s else once(s, "<style>", (FONT if "fonts.gstatic.com" not in s else FONT.split("\n", 2)[2]) + "<style>")
s = s[:s.index("<style>") + 7] + THANKS + s[s.index("</style>"):]
s = once(s, '<a class="btn primary" href="app.html">Sign in</a>', '<a class="chip" href="app.html">Sign in</a>')
s = once(s, '<a class="btn primary" href="demo.html">Try the demo</a><a class="btn" href="/">Back to the front page</a>', '<a class="pill primary" href="demo.html">Try the demo</a><a class="pill secondary" href="/">Back to the front page</a>')
for f in (W / "deploy" / "thanks.html", W / "thanks.html"): f.write_text(s, encoding="utf-8")
print("small pages done")
```

- [ ] **Step 4: Apply it and see the suite pass.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 /private/tmp/claude-501/-Users-ranjithkandavelu-Desktop-Claude-Myrosta/e2612bea-8043-4ed1-8665-5b177ea218c6/scratchpad/lv3-t6-small.py . && cmp thanks.html deploy/thanks.html && python3 tests/run.py 2>&1 | grep -E "^FAIL|passed" && git status --short`
Expected: `small pages done`, no output from `cmp`, `895 passed, 0 failed  (app.html)`, and `git status` listing exactly `deploy/privacy.html`, `deploy/support.html`, `deploy/terms.html`, `deploy/thanks.html`, `thanks.html` and `tests/run.py`.

- [ ] **Step 5: Check the copy is untouched.** The words of the four pages must be the same apart from the footer line and the removed stripe:

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 - <<'EOF'
import re, subprocess
def words(s):
    s = s[s.find("<body"):]; s = re.sub(r"<footer.*?</footer>", " ", s, flags=re.S); s = re.sub(r"<svg.*?</svg>|<style.*?</style>", " ", s, flags=re.S)
    return re.sub(r"<[^>]+>", " ", s).split()
for name in ("deploy/privacy.html", "deploy/terms.html", "deploy/support.html", "deploy/thanks.html"):
    old = subprocess.run(["git", "show", "HEAD:" + name], capture_output=True, text=True).stdout
    assert words(old) == words(open(name, encoding="utf-8").read()), name + ": body copy changed"
print("small-page copy unchanged")
EOF
```

Expected: `small-page copy unchanged`.

- [ ] **Step 6: Commit**

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && git add tests/run.py deploy/privacy.html deploy/terms.html deploy/support.html deploy/thanks.html thanks.html && git commit -q -m "Landing v3: Privacy, Terms, Support and Thanks in the same look — the page's font and tokens, the current mark instead of the old red-rail one, the stripe gone; their copy is untouched

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

### Task 7: Release — the Style of record, the changelog, the spec's as-built notes

**Files:**
- Create: `getlayers.json` (repo root; not deployed)
- Modify: `CHANGELOG.md` (one `(site only)` entry at the top)
- Modify: `docs/superpowers/specs/2026-09-19-landing-page-v3-design.md` (append "As built")

**Interfaces:**
- Consumes: `build_lint`'s `(site only)` skip from Task 1.

- [ ] **Step 1: Create `getlayers.json`**

```json
{
  "version": 1,
  "brief": {
    "dimensionality": ["flat"],
    "mood": ["calm", "luxe"],
    "tone": ["light"],
    "motionEnergy": ["subtle"],
    "density": ["balanced"]
  },
  "styleId": "dantora-style",
  "tokens": {
    "gl-bg": "#FFFFFF",
    "gl-bg-alt": "#EFF4F2",
    "gl-surface": "rgba(255,255,255,.8)",
    "gl-surface-raised": "rgba(255,255,255,.9)",
    "gl-ink": "#000000",
    "gl-ink-muted": "#666666",
    "gl-accent": "#05665A",
    "gl-accent-ink": "#FFFFFF",
    "gl-line": "rgba(0,0,0,.1)",
    "gl-glow": "#FBE9CE",
    "gl-font-display": "\"Google Sans Flex\", ui-sans-serif, system-ui, sans-serif",
    "gl-font-body": "\"Google Sans Flex\", ui-sans-serif, system-ui, sans-serif",
    "gl-tracking-display": "0",
    "gl-weight-display": "300",
    "gl-weight-body": "300 (400 at or below 1.5dppx)",
    "gl-radius": "1.5rem",
    "gl-radius-lg": "3rem",
    "gl-border": "1px",
    "gl-duration-fast": "150ms",
    "gl-duration": "250ms",
    "gl-duration-slow": "700ms",
    "gl-ease": "cubic-bezier(0.2, 0, 0, 1)"
  },
  "activeTemplateId": "dantora",
  "placed": [
    { "sectionId": "bar", "slot": 0, "compositionId": "flowstate-nav" },
    { "sectionId": "hero", "slot": 1, "compositionId": "artist-hero" },
    { "sectionId": "steps", "slot": 2, "compositionId": "artist-process" },
    { "sectionId": "view", "slot": 3, "compositionId": "creative-director-portfolio" },
    { "sectionId": "assure", "slot": 4, "compositionId": "artist-statement" },
    { "sectionId": "proof", "slot": 5, "compositionId": "clarix-stats" },
    { "sectionId": "walkthrough", "slot": 6, "compositionId": "stride-contact" },
    { "sectionId": "faq", "slot": 7, "compositionId": "artist-faq" },
    { "sectionId": "foot", "slot": 8, "compositionId": "loopstack-footer" }
  ],
  "notes": "Landing page v3, 19 Sep 2026 (spec: docs/superpowers/specs/2026-09-19-landing-page-v3-design.md). Dantora is the Style of record and a reference only: none of its sections, its DNA scene or its loader is used, and no scene, gradient or video is placed. The palette is Myrosta's own teal (#05665A) on Dantora's mint, with the app's pale amber where Dantora uses lime; a blue re-tint was proposed in error and corrected. Four legibility departures from the Style: one AA grey (#666) instead of its two failing greys, Regular body weight on standard-density screens, 1.5 leading on long paragraphs, and #757575 field borders. The phone mock-up is product UI and is fenced off from the Style (/*phone-css*/). A colleague's quote is deferred until the owner supplies a real sentence."
}
```

- [ ] **Step 2: Add the changelog entry** directly above the line `## 17 Sep 2026 — Who's on across the department, and a group made in the app`, followed by one blank line:

```markdown
## 19 Sep 2026 — Landing page v3 (site only)

- **The front page wears a new look**: the GetLayers *Dantora* style in Myrosta's own teal and mint — Light type (Google Sans Flex), a frosted bar, pill buttons, hairlines, no shadows. What makes the page work is unchanged: the phone pinned beside four steps that switch its screens, pixel-identical to before.
- **A new section shows the director's side**: the Roster grid and the Fairness view, real captures of the demo (`python3 tools/capture-landing.py views` retakes them). The assurance line now says **No patient data.**
- **Privacy, Terms, Support and Thanks match**, and lose the old red-rail mark.
- The landing lint's budgets are 600 words and 48 KB, and it now checks that every image is deployed, sized and light, that the page CSS outside the mock-up has no shadows and asks for one font, that the reveal only hides content under `.js`, and AA contrast computed from the page's own tokens. No app change: `app.html`, the demo, the Edge Functions and the SQL are untouched.
```

- [ ] **Step 3: Append this section to the end of the spec:**

```markdown
## As built (19 Sep 2026)

Found while building the page on a scratch copy, before the plan was written:

- **The mock-up shared more with the page than its tokens**: `.btn`, `.eyebrow`, `.brand`, `.logo`, `.alt`, and the global `h2` rule all reached into it. Those rules now live inside the fence as `:where(.phone) …` — `:where` adds no specificity, so they sit exactly where the old global rules sat — and the page's own classes were renamed clear of the mock-up's (`.pill`, `.chip`, `.eb`, `.lock`, `.or`). `python3 tools/capture-landing.py phone DIR` photographs the five screens and `compare` diffs two sets: **0 pixels differ** before and after.
- **Stat figures are 48 px, not 60** ("June 2026" has to fit its column; the first stat column is 1.5 × the others), and **step titles are 24 px**.
- **Field borders are `#757575`** (4.6:1): the Style's 10% hairline fails the 3:1 non-text contrast a form field's boundary needs. A fourth legibility departure, with the grey, the body weight and the long-paragraph leading.
- **The device frame lost its drop shadow** (the page has none); the screens inside keep the app's own card shadows.
- Tokens as shipped: `--r-mark` dropped (unused), `--field` added; the wordmark's "o" is `--accent`.
- The small pages were still carrying the **old mark with the red rail**; the re-skin replaces it with the current one.
- Measured: `index.html` 47,694 bytes (13.1 KB gzipped) of 49,152; 560 words of 600; images 96 KB, 54 KB and 59 KB at WebP quality 90. My brainstorm estimate of 41.5 KB was low — the fenced mock-up CSS costs about 2 KB and the new sections' CSS more than the old.
```

- [ ] **Step 4: Run the whole suite and read every line.**

Run: `cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 tests/run.py 2>&1 | grep -E "^FAIL|landing: vocab|BUILD|passed"`
Expected: `PASS  landing: vocabulary, cast, size, links, form and mark are right`, a `PASS` line for the build date, `895 passed, 0 failed  (app.html)`, and no `FAIL`. (The changelog's newest heading is now 19 Sep and the app's BUILD is still 17 Sep: the suite stays green only because the heading says `(site only)`.)

- [ ] **Step 5: Final numbers.**

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && python3 - <<'EOF'
import re, gzip, pathlib
p = pathlib.Path("deploy/index.html").read_bytes(); t = p.decode()
v = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S); v = re.sub(r"<!--phone-->.*?<!--/phone-->", " ", v, flags=re.S)
print("index.html %d bytes of %d (gzip %d) | %d words of 600" % (len(p), 48 * 1024, len(gzip.compress(p, 9)), len(re.sub(r"<[^>]+>", " ", v).split())))
for f in sorted(pathlib.Path("deploy").glob("view-*.webp")): print(f.name, f.stat().st_size)
EOF
git status --short
```

Expected: `index.html 47694 bytes of 49152 (gzip ≈13080) | 560 words of 600`, the three image sizes, and `git status` listing `getlayers.json` (untracked), `CHANGELOG.md` and the spec.

- [ ] **Step 6: Commit**

```bash
cd /Users/ranjithkandavelu/Desktop/Claude/Myrosta && git add getlayers.json CHANGELOG.md docs/superpowers/specs/2026-09-19-landing-page-v3-design.md && git commit -q -m "Landing v3: getlayers.json records the Style, tokens and the composition behind each section; the changelog entry is marked site only; the spec gains its as-built notes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git log --oneline -1
```

---

## After the last task (controller, not a subagent)

1. Visual pass in the built-in browser on the `landing` preview (port 8897) at 390, 768 and 1440 px: every section; the phone switching all four screens scrolling down and back up; the pinned band on a phone; reduce-motion; scripts off; keyboard only; 200% zoom; the four small pages.
2. Final whole-branch review, one fix wave if needed, then superpowers:finishing-a-development-branch. The owner pushes.
3. Owner's steps after the push: check myrosta.com.au, submit one real walkthrough (Netlify must still catch the form — its name and fields are unchanged), look on a real phone. When a colleague's sentence arrives, the quote goes into the proof panel (spec, "Later: the quote").
