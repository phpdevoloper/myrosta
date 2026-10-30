#!/usr/bin/env python3
"""Myrosta engine tests.

Runs the whole assertion suite against the CURRENT app.html by splicing:
    tests/stubs.js  +  <the <script> block from app.html>  +  tests/suite.js
and executing it under JavaScriptCore (macOS `osascript -l JavaScript`).

    python3 tests/run.py            # test app.html on the current branch
    python3 tests/run.py <file>     # test a specific build (e.g. deploy/app.html)

Exit code 0 = every assertion passed.
"""
import re, subprocess, sys, tempfile, pathlib
sys.stdout.reconfigure(encoding="utf-8")   # the suite prints arrows and dashes; a Windows console codepage would crash on them

root = pathlib.Path(__file__).resolve().parent.parent
target = (pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / "app.html")
sys.path.insert(0, str(root / "tools"))
import inline_app   # the app lives in src/ (Oct 2026); the lints and the engine read it inlined, as the browser sees it

html_raw = target.read_text(encoding="utf-8")
html = inline_app.inline(target)
srcs = inline_app.script_files(html_raw)
app = "\n".join(inline_app._read(target.parent, s) for s in srcs) if srcs else max(re.findall(r"<script>(.*?)</script>", html, re.S), key=len)

golden = root / "tests" / "oncall-golden.js"   # what the per-zone on-call tick produced before it became a window — see the suite

def edge_src():
    """The pure parts of the two Edge Functions, wrapped so their names cannot collide with the app's: the calendar
    feed up to its HTTP handler, and the block of the reminders function marked `---- pure:`, with its `: any`
    annotations taken off. The suite then holds them to what the app itself does."""
    ics = (root / "supabase" / "functions" / "ics" / "index.js").read_text(encoding="utf-8")
    ics = ics[:ics.index("/* ---------------- HTTP handler")]
    ics = "\n".join(l for l in ics.split("\n") if not l.startswith("import ")).replace("export function buildICS", "function buildICS")
    ns = (root / "supabase" / "functions" / "notify-shifts" / "index.ts").read_text(encoding="utf-8")
    block = re.sub(r"\?:\s*any\b|:\s*any\[\]|:\s*any\b", "", ns[ns.index("// ---- pure:"):ns.index("// ---- end pure ----")])
    return ("var ICSFN=(function(){\n" + ics + "\nreturn {buildICS:buildICS};})();\n" +
            "var REMINDFN=(function(){\n" + block + "\nreturn {reminderFor:reminderFor};})();\n")

stubs = (root / "tests" / "stubs.js").read_text(encoding="utf-8")
tail = (golden.read_text(encoding="utf-8") + "\n" if golden.exists() else "") + edge_src() + \
       (root / "tests" / "suite.js").read_text(encoding="utf-8")
src = stubs + app + "\n" + tail

def _tmp(text, suffix=".js"):
    with tempfile.NamedTemporaryFile("w", suffix=suffix, delete=False, encoding="utf-8") as f:
        f.write(text)
        return f.name

import os, shutil, json
if shutil.which("osascript"):
    cmd = ["osascript", "-l", "JavaScript", _tmp(src)]
else:   # Windows / Linux: Node. Each app file runs as its own script, as the browser loads them, so a file that needs a
        # function from a later file at load time fails here too; vm keeps `this` as the global, as JavaScriptCore does
    parts = [str(root / "tests" / "node-intl-shim.js"), _tmp(stubs)] + ([str(target.parent / s) for s in srcs] if srcs else [_tmp(app)]) + [_tmp(tail)]
    cmd = ["node", "-e", "const vm=require('vm'),fs=require('fs'),ps=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));let r;"
           "for(const p of ps){ try{ r=vm.runInThisContext(fs.readFileSync(p,'utf8').replace(/^\\uFEFF/,''),{filename:p}); }"
           "catch(e){ console.log('ERROR loading '+p+': '+(e&&e.stack||e)); } }"
           "process.stdout.write(String(r));", _tmp(json.dumps(parts), ".json")]
out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", env={**os.environ, "TZ": "Australia/Melbourne"})   # the group's clock: receipts, windows and daylight-saving checks read the same on any machine (22 Oct 2026: the suite ran abroad)
text = (out.stdout or "") + (out.stderr or "")
print(text.strip())


# ---- CSS lints: the visual system is enforced here, not by taste ----
# 1. every var(--x) used without a fallback must be defined somewhere in the file
#    (guards against the invisible-Equity-bars class of bug: `.eqfill{background:var(--teal)}` with no --teal anywhere)
def css_token_lint(html_text):
    used = set(re.findall(r"var\(\s*(--[a-zA-Z0-9-]+)\s*\)", html_text))          # no fallback given
    defined = set(re.findall(r"(--[a-zA-Z0-9-]+)\s*:", html_text))                  # any `--x:` declaration (root, rules, inline)
    return sorted(used - defined)

# 2. no font-size px literal outside :root — sizes come from the --fs-* scale. The HTML exporters (standalone files
#    opened in Excel, marked by `font-family:Arial`) are the one place a literal is legitimate: Excel cannot resolve var().
def css_fontsize_lint(html_text):
    r0 = html_text.find(":root{"); r1 = html_text.find("}", r0)
    body = html_text[:r0] + html_text[r1:]
    body = "\n".join(l for l in body.split("\n") if "font-family:Arial" not in l)
    return re.findall(r"font-size:\s*\d+(?:\.\d+)?px", body)

# 3. hex literals live in :root only (stylesheet) and on the PALETTE line only (script). #fff/#000 and rgba() are fine.
def css_hex_lint(html_text):
    st, en = html_text.find("<style>"), html_text.find("</style>")
    css = html_text[st:en]; r0 = css.find(":root{"); r1 = css.find("}", r0)
    css_body = css[:r0] + css[r1:]
    bad = [h for h in re.findall(r"#[0-9a-fA-F]{3,6}\b", css_body) if h.lower() not in ("#fff", "#ffffff", "#000")]
    script = html_text[html_text.find("<script>", en):]
    script = "\n".join(l for l in script.split("\n") if not l.lstrip().startswith("const PALETTE="))
    return bad + [h for h in re.findall(r"#[0-9a-fA-F]{3,6}\b", script) if h.lower() not in ("#fff", "#ffffff", "#000")]

# 4. every PALETTE key is a :root token carrying the same value
def palette_mirror_lint(html_text):
    root = html_text[html_text.find(":root{"):]; root = root[:root.find("}")]
    tokens = dict((k, v.upper()) for k, v in re.findall(r"(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", root))
    m = re.search(r"const PALETTE=\{([^}]*)\}", html_text)
    if not m: return ["PALETTE missing"]
    pal = re.findall(r'"(--[a-z0-9-]+)":"(#[0-9a-fA-F]{6})"', m.group(1))
    return [k for k, v in pal if tokens.get(k) != v.upper()] + ([] if pal else ["PALETTE empty"])

# 5. the nine small-label classes retired by the .tag component stay retired
RETIRED = ["pill", "chip", "badge-mode", "lvchip", "locx", "todaytag", "ph-badge", "sini"]
def retired_class_lint(html_text):
    st, en = html_text.find("<style>"), html_text.find("</style>")
    css, script = html_text[st:en], html_text[en:]
    bad = ["." + c for c in RETIRED if re.search(r"\." + re.escape(c) + r"\b", css)]
    return bad + [c for c in RETIRED if re.search(r'class(?:Name)?="[^"]*\b' + re.escape(c) + r"\b", script)]

# 6. no emoji or text glyph inside a button, a note/tag/schedbar prefix, or a bare <span> — chrome uses the SVG icon set.
#    The feedback mood picker (data-mood) is content and keeps its faces.
EMOJI = re.compile("[\u2600-\u27bf\u2b00-\u2bff\U0001F300-\U0001FAFF\u25b4\u25be\u25b8\u25cf\u2039\u203a\u21a9\u2197\u21c4]")
def button_emoji_lint(html_text):
    script = html_text[html_text.find("</style>"):]
    css = html_text[html_text.find("<style>"):html_text.find("</style>")]
    bad = ["content:" + m.group(1) for m in re.finditer(r'content:"([^"]*)"', css) if EMOJI.search(m.group(1))]   # CSS-drawn glyphs count too
    for m in re.finditer(r'\b(?:notify|toast)\((?:"[^"]*",\s*)?"([^"]*)"', script):                                # message literals reach the bell list and toasts verbatim
        if EMOJI.search(m.group(1)): bad.append(m.group(1).strip()[:40])
    for m in re.finditer(r"<button([^>]*)>([^<]{0,120})", script):
        if "data-mood" in m.group(1): continue
        if EMOJI.search(m.group(2)): bad.append(m.group(2).strip()[:40])
    for m in re.finditer(r'<(?:span|div) class="(?:note|schedbar|tag)[^"]*"[^>]*>([^<]{0,6})', script):
        if EMOJI.search(m.group(1)): bad.append(m.group(1).strip()[:40])
    for m in re.finditer(r"<span>([^<]{0,4})", script):
        if EMOJI.search(m.group(1)): bad.append(m.group(1).strip()[:40])
    return bad

# 7. the brand mark (favicon data URI + inline logo) carries the period trio — AM blue, PM amber, CST green — never the old RAG red
def icon_lint(html_text):
    marks = [l for l in html_text.split("\n") if 'rel="icon"' in l or 'class="logo"' in l]
    bad = []
    for l in marks:
        u = l.upper()
        if not all(h in u for h in ("4C86E8", "F2A638", "2FA86E")) or "E04B4B" in u: bad.append(l.strip()[:50])
    return bad if marks else ["no brand mark found"]


# ---- landing page (index.html): vocabulary, cast, size, links, form, mark. Python only — the page has no engine. ----
LANDING_CAST = {"Jordan Lee", "Ng", "Patel", "Okafor"}
def _lum(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def _contrast(a, b):
    la, lb = _lum(a), _lum(b); return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)   # WCAG 2 contrast ratio
def _webp_size(path):
    """Real pixel size from a WebP file's own header (RIFF container), stdlib only — no Pillow in this file."""
    data = pathlib.Path(path).read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP": return None
    tag = data[12:16]
    if tag == b"VP8X":
        w = 1 + (data[24] | (data[25] << 8) | (data[26] << 16))
        h = 1 + (data[27] | (data[28] << 8) | (data[29] << 16))
        return (w, h)
    if tag == b"VP8L":
        v = data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24)
        return (1 + (v & 0x3FFF), 1 + ((v >> 14) & 0x3FFF))
    if tag == b"VP8 ":
        return ((data[26] | (data[27] << 8)) & 0x3FFF, (data[28] | (data[29] << 8)) & 0x3FFF)
    return None
_config_js = (root / "src" / "config" / "cloud.js").read_text(encoding="utf-8")
_m = re.search(r'url:\s*"https://([^/"]+)"', _config_js)
MEDIA_HOST = _m.group(1) if _m else ""   # derived from CLOUD.url in src/config/cloud.js — change the project there, not here

def landing_lint():
    bad = []
    a, b = root / "index.html", root / "deploy" / "index.html"
    if not a.exists(): return ["index.html missing"]
    page = a.read_text(encoding="utf-8")
    if not b.exists() or b.read_text(encoding="utf-8") != page: bad.append("deploy/index.html differs from index.html")
    if len(page.encode("utf-8")) >= 54 * 1024: bad.append("index.html is %d KB (budget 54)" % (len(page.encode("utf-8")) // 1024))   # 50 until 12 Oct 2026: the film section (a poster, one tap) and its player CSS   # 48 until 28 Sep 2026: the mock-up's bottom bar now carries the app's own five icons, drawn once as symbols   # 40 until v3 (19 Sep 2026): the director's view and the fenced mock-up CSS are worth their bytes
    low = page.lower()
    for w in ("self-roster", "self\u2011roster", "consultant", "cohort", "snake", "release for", "e04b4b", "jamie", "werribee"):
        if w in low: bad.append("stale word: " + w)
    visible = re.sub(r"<script.*?</script>|<style.*?</style>", " ", page, flags=re.S)
    prose = re.sub(r"<!--phone-->.*?<!--/phone-->", " ", visible, flags=re.S)   # the phone's own screens are product UI, not copy
    attrs = " ".join(re.findall(r'\b(?:content|aria-label|placeholder|alt|title)="([^"]*)"', visible))   # names hide in attributes too
    visible = re.sub(r"<[^>]+>", " ", visible) + " " + attrs; prose = re.sub(r"<[^>]+>", " ", prose)
    NAME = r"(?:(?:de|van|von|da|di|du|la|le) )?[A-Z](?:\.|[A-Za-z\-]*(?:['’][A-Z][A-Za-z]+)?)"   # Smith / J. / O'Brien / de Souza / NG / McDonald
    for m in re.finditer(r"\bDr (" + NAME + r"(?: " + NAME + r")?)", visible):
        nm = m.group(1).rstrip("."); parts = nm.split()
        if nm not in LANDING_CAST and parts[0] not in LANDING_CAST and parts[-1] not in LANDING_CAST: bad.append("name outside the cast: Dr " + nm)
    for m in re.finditer(r"\b([A-Z][a-z]+), ([A-Z][a-z]+)\b", visible):
        if m.group(1) not in LANDING_CAST: bad.append("name outside the cast: " + m.group(0))
    words = len(prose.split())
    if words > 600: bad.append("%d visible words outside the phone (budget 600)" % words)   # 525 until v3 (19 Sep 2026): the director's view needs 44, and a colleague's quote is to come
    for need in ('<form name="walkthrough"', 'name="form-name" value="walkthrough"', 'data-netlify="true"', 'netlify-honeypot="bot-field"', 'action="/thanks.html"', 'type="email"'):
        if need not in page: bad.append("form is missing " + need)
    ta, tb = root / "thanks.html", root / "deploy" / "thanks.html"
    if not (ta.exists() and tb.exists() and ta.read_text(encoding="utf-8") == tb.read_text(encoding="utf-8")): bad.append("thanks.html missing or out of sync")
    thanks = ta.read_text(encoding="utf-8") if ta.exists() else ""
    for src, text in (("index.html", page), ("thanks.html", thanks)):
        for href in re.findall(r'href="([^"]+)"', text):
            if href.startswith(("#", "mailto:", "https://fonts.", "https://myrosta.com.au", "data:", "https://" + MEDIA_HOST)): continue
            f = href.split("#")[0].split("?")[0].lstrip("/")
            if f and not (root / f).exists() and not (root / "deploy" / f).exists(): bad.append(src + " links to a file the site does not have: " + href)   # the source tree is the site; generated pages (demo.html) exist only in deploy/
    ld = re.search(r'<script type="application/ld\+json">(.*?)</script>', page, re.S)
    if not ld: bad.append("JSON-LD block missing")
    elif "offers" in ld.group(1) or '"price"' in ld.group(1): bad.append("JSON-LD claims a price")
    for host in set(re.findall(r'(?:src|href)="https?://([^/"]+)', page)):
        if host not in ("fonts.googleapis.com", "fonts.gstatic.com", "myrosta.com.au", MEDIA_HOST): bad.append("external host: " + host)
    up = page.upper()
    for h in ("4C86E8", "F2A638", "2FA86E"):
        if h not in up: bad.append("mark is missing " + h)
    # v3: the page and the product are fenced apart in the CSS as they are in the HTML, and the page keeps the Style's rules
    css = "".join(re.findall(r"<style>(.*?)</style>", page, flags=re.S))
    if "/*phone-css*/" not in css or "/*/phone-css*/" not in css: bad.append("the mock-up CSS is not fenced with /*phone-css*/ and /*/phone-css*/")
    page_css = re.sub(r"/\*phone-css\*/.*?/\*/phone-css\*/", " ", css, flags=re.S)
    for w in ("box-shadow", "Inter", "#0F243A", "#0f243a"):
        if w in page_css: bad.append("page CSS outside the mock-up contains " + w)
    # every var(--name) used anywhere in the page's <style> (inside or outside the fence) must be defined
    # somewhere in that <style>, or set inline in the markup (style="--d:..."), or carry a fallback (var(--name, ...)) —
    # a usage with no fallback and no definition is the invisible-content bug class (e.g. --fs-xl before it existed)
    defined_props = set(re.findall(r"(--[a-zA-Z0-9-]+)\s*:", css))
    inline_props = set(re.findall(r'style="[^"]*?(--[a-zA-Z0-9-]+)\s*:', page))
    naked_props = set(re.findall(r"var\(\s*(--[a-zA-Z0-9-]+)\s*\)", css))   # no comma before the close-paren: no fallback
    for name in sorted(naked_props - defined_props - inline_props):
        bad.append("CSS reads an undefined custom property: " + name)
    if "family=Google+Sans+Flex" not in page: bad.append("the head does not request Google Sans Flex")
    if "family=Inter" in page: bad.append("the head still requests Inter")
    tok = dict(re.findall(r"(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\b", page_css[:page_css.find("}")]))   # the page's own :root
    for a, b in (("--ink-2", "--bg"), ("--ink-2", "--panel"), ("--accent", "--bg"), ("--accent", "--panel"), ("#FFFFFF", "--accent"), ("#FFFFFF", "--accent-deep"), ("--ink", "--amber")):
        ca, cb = tok.get(a, a), tok.get(b, b)
        if not (ca.startswith("#") and cb.startswith("#")): bad.append("contrast token missing: %s on %s" % (a, b)); continue
        if _contrast(ca, cb) < 4.5: bad.append("contrast %s on %s is %.2f (needs 4.5)" % (a, b, _contrast(ca, cb)))
    imgs, total = set(), 0   # every image the page shows is deployed, sized, and light
    for tag in re.findall(r"<(?:img|source|video)\b[^>]*>", page):   # a <video poster> is an image the page shows too
        urls = re.findall(r'\bsrc="([^"]+)"', tag) + re.findall(r'\bposter="([^"]+)"', tag) + [u.strip().split(" ")[0] for s in re.findall(r'\bsrcset="([^"]+)"', tag) for u in s.split(",")]
        imgs.update(u.split("?")[0].lstrip("/") for u in urls if not u.startswith(("http", "data:", "//")))
        needs_size = tag.startswith("<img") or "srcset=" in tag   # a <source srcset> can be blown up just as badly as a bare <img>
        wm, hm = re.search(r'(?<![\w-])width="(\d+)"', tag), re.search(r'(?<![\w-])height="(\d+)"', tag)
        if needs_size and not (wm and hm):
            bad.append(("an <img>" if tag.startswith("<img") else "a <source srcset>") + " has no width and height: " + tag[:70]); continue
        if needs_size:   # declared numbers must match reality: the capture tool's crops can change shape when re-run
            local = [u for u in urls if u.split("?")[0].lower().endswith(".webp") and not u.startswith(("http", "data:", "//"))]
            if len(local) == 1:
                f = root / local[0].lstrip("/")
                real = _webp_size(f) if f.exists() else None
                if real and real != (int(wm.group(1)), int(hm.group(1))):
                    bad.append("%s is %dx%d but the page declares %sx%s" % (local[0], real[0], real[1], wm.group(1), hm.group(1)))
    for u in sorted(imgs):
        f = root / u
        if not f.exists(): bad.append("image missing: " + u); continue
        total += f.stat().st_size
        if f.stat().st_size > 120 * 1024: bad.append("%s is %d KB (budget 120)" % (u, f.stat().st_size // 1024))
    if total > 300 * 1024: bad.append("landing images total %d KB (budget 300)" % (total // 1024))
    for need in ("img/landing/view-roster.webp", "img/landing/view-roster-narrow.webp", "img/landing/view-fairness.webp"):
        if need not in imgs: bad.append("the director's view does not show " + need)
    # every rule (anywhere, including inside @media — matched innermost) whose declarations set opacity:0 (not
    # opacity:0.x) must have EVERY comma-separated selector start with ".js " — .w{opacity:0} or a mixed selector
    # list like ".js [data-r],.w{opacity:0}" used to slip past a check that only ever looked at "[data-r]"
    css_nocomments = re.sub(r"/\*.*?\*/", "", page_css, flags=re.S)
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css_nocomments):
        sel, decl = m.group(1).strip(), m.group(2)
        if re.search(r"opacity:0(?![.\d])", decl) and not all(s.strip().startswith(".js ") for s in sel.split(",")):
            bad.append("a rule hides content without .js: " + sel[:60])   # with scripts off everything must simply be visible
    for need in ("[data-r]", "prefers-reduced-motion", "setTimeout(sweep"):
        if need not in page: bad.append("motion: missing " + need)
    for name in ("privacy.html", "terms.html", "support.html", "thanks.html"):   # the small pages wear the same brand
        f = root / name; t = f.read_text(encoding="utf-8") if f.exists() else ""
        if re.search("e04b4b", t, re.I): bad.append(name + " still carries the old red (E04B4B)")
        if "family=Inter" in t or "family=Google+Sans+Flex" not in t: bad.append(name + " does not use the page's font")
    return bad


# ---- demo sandbox: deploy/demo.html must be exactly what tools/build-demo.py produces from today's app + seed ----
def demo_lint():
    import importlib.util
    bad = []
    spec = importlib.util.spec_from_file_location("build_demo", root / "tools" / "build-demo.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    want = mod.expected(); have = root / "deploy" / "demo.html"
    if not have.exists(): return ["deploy/demo.html missing — run python3 tools/build-demo.py"]
    if have.read_text(encoding="utf-8") != want: bad.append("deploy/demo.html is out of date — run python3 tools/build-demo.py")
    seed = (root / "tools" / "demo-seed.js").read_text(encoding="utf-8")
    for w in ("Jamie", "Werribee", '"ROC"', '"RAP"', "Riverside"):
        if w in seed: bad.append("demo seed carries a real-world name: " + w)
    for z in ("EPIC", "Resus", "Paeds", "SSU", "Fast track", "Acute bays"):
        if z not in seed: bad.append("demo seed is missing the zone " + z)
    return bad

# 7b. the served copies: the site serves deploy/, which tools/build-deploy.py builds from the source tree. Every served source
#     file has an identical twin there (src/config/cloud.js aside: it carries the production project), nothing else is there
#     but the generated demo, and preview.html is the inlined app with the cloud blanked (23 Sep 2026: a build reached main
#     without this copy, and the live app kept the old date; 30 Oct 2026: deploy/ had drifted into the only copy of five files)
def deploy_lint():
    import importlib.util
    spec = importlib.util.spec_from_file_location("build_deploy", root / "tools" / "build-deploy.py"); bd = importlib.util.module_from_spec(spec); spec.loader.exec_module(bd)
    bad, d = [], root / "deploy"
    want = bd.served_files()
    for rel in want:
        if rel in bd.PER_ENV: continue
        twin = d / rel
        if not twin.exists() or twin.read_bytes() != (root / rel).read_bytes(): bad.append("deploy/" + rel + " differs from " + rel)
    known = set(want) | set(bd.GENERATED)
    for f in sorted(d.rglob("*")) if d.exists() else []:
        if f.is_file() and f.relative_to(d).as_posix() not in known: bad.append("deploy/" + f.relative_to(d).as_posix() + " has no source (stale or hand-made)")
    pv = root / "preview.html"
    if not pv.exists() or pv.read_text(encoding="utf-8") != inline_app.point_cloud(inline_app.inline(root / "app.html"), "", ""):
        bad.append("preview.html is not the inlined app with the cloud blanked")
    if bad: bad.append("run python tools/build-deploy.py")
    return bad

# 7c. the group-files converter (tools/group-files.py): its self-test builds a synthetic manager workbook, writes the three
#     import files and runs them through THIS app's importers under JavaScriptCore — so the files it writes for a new group land
#     as they should on the build being tested. On a failure the lint carries the self-test's whole message (what disagreed,
#     what it expected, what it got), not just its last line
def group_files_lint():
    tool = root / "tools" / "group-files.py"
    if not tool.exists(): return ["tools/group-files.py is missing"]
    try:
        r = subprocess.run([sys.executable, str(tool), "--selftest", "--app", str(target)], capture_output=True, text=True, cwd=str(root), timeout=180)
    except subprocess.TimeoutExpired:
        return ["the self-test did not finish in 180 s"]
    if r.returncode != 0 or "selftest ok" not in (r.stdout or ""):
        lines = [l.strip()[:300] for l in ((r.stdout or "") + (r.stderr or "")).strip().splitlines()]
        at = next((i for i, l in enumerate(lines) if "selftest:" in l), None)
        return lines[at:] if at is not None else (lines[-3:] or ["the self-test gave no output"])
    return []

# 7c'. the layer rule (docs/ARCHITECTURE.md), enforced for each feature once it has been re-layered (clocking: 30 Oct 2026).
#     Domain files are pure: no state, DOM, browser, saving or notifying. Application files reach the outside world only
#     through their ports. Strings and comments are blanked first, so a word in a message is never mistaken for a call.
LAYERED = {
    "domain": ["src/domain/clocking"],
    "application": ["src/application/clocking"],
}
LAYER_BANNED = {
    "domain": ["S", "document", "window", "location", "navigator", "localStorage", "sessionStorage", "crypto", "active(", "isAdmin(",
               "render(", "toast(", "save(", "notify(", "logAudit(", "commitGuarded(", "clockingPorts", "Date.now("],
    "application": ["document", "window", "location", "navigator", "localStorage", "sessionStorage", "render(", "toast(", "save(",
                    "download(", "commitGuarded(", "shiftLabel(", "clockLocate(", "clockNewKey("],
}
def _code_only(js):
    js = re.sub(r"/\*.*?\*/", " ", js, flags=re.S)
    js = re.sub(r"`(?:\\.|[^`\\])*`", "``", js, flags=re.S)
    js = re.sub(r'"(?:\\.|[^"\\\n])*"', '""', js)
    js = re.sub(r"'(?:\\.|[^'\\\n])*'", "''", js)
    return re.sub(r"//[^\n]*", " ", js)
def layering_lint():
    bad = []
    for layer, dirs in LAYERED.items():
        for d in dirs:
            for f in sorted((root / d).glob("*.js")):
                code = _code_only(f.read_text(encoding="utf-8"))
                for name in LAYER_BANNED[layer]:
                    word = name.rstrip("(")
                    pat = r"(?<![\w$.])" + re.escape(word) + (r"\s*\(" if name.endswith("(") else r"(?![\w$])")
                    if re.search(pat, code): bad.append(f.relative_to(root).as_posix() + " uses " + name)
    return bad

# 7d. the de-identifier (tools/deidentify.py): its self-test runs a fake production export through it and checks that no name,
#     email, phone, staff id or group slug survives anywhere in the SQL it would write, while the document keeps its shape.
def deidentify_lint():
    t = root / "tests" / "deidentify_test.py"
    if not t.exists() or not (root / "tools" / "deidentify.py").exists(): return ["tools/deidentify.py or tests/deidentify_test.py is missing"]
    try:
        r = subprocess.run([sys.executable, str(t)], capture_output=True, text=True, cwd=str(root), timeout=120)
    except subprocess.TimeoutExpired:
        return ["the de-identifier self-test did not finish in 120 s"]
    if r.returncode != 0 or "selftest ok" not in (r.stdout or ""):
        lines = [l.strip()[:300] for l in (r.stdout or "").splitlines() if l.startswith("FAIL")]
        return lines or [l.strip()[:300] for l in ((r.stdout or "") + (r.stderr or "")).strip().splitlines()[-3:]] or ["the self-test gave no output"]
    return []

# 8. the head: the spreadsheet library never blocks first paint, and the web font never delays the roster
def head_lint(html_text):
    head = html_text[:html_text.find("<style>")]
    bad = []
    if not re.search(r'<script defer src="[^"]*xlsx[^"]*"></script>', head): bad.append("xlsx not deferred")
    if "display=optional" not in head: bad.append("Inter not display=optional")
    css = html_text[html_text.find("<style>"):html_text.find("</style>")]
    if re.search(r"(^|[\s}])\.ph\{", css): bad.append(".ph{ rule collides with the public-holiday token (scope it to header.ph)")
    return bad

# 9. every audit action the app writes has a plain-word sentence in AUDIT_WORDS
def audit_words_lint(html_text):
    keys = set(re.findall(r'logAudit\("([a-zA-Z.-]+)"', html_text))
    for suffix in re.findall(r'logAudit\(r\.type\+"(\.[a-zA-Z.-]+)"', html_text):   # dynamic: leave/swap/fixed + suffix
        for t in ("leave", "swap", "fixed"): keys.add(t + suffix)
    odd = [c for c in re.findall(r'logAudit\(([^\n]{1,30})', html_text) if not (c.startswith('"') or c.startswith('r.type+"') or c.startswith('action,detail,actor'))]
    m = re.search(r"const AUDIT_WORDS=\{(.*?)\};", html_text, re.S)
    if not m: return ["AUDIT_WORDS missing"]
    have = set(re.findall(r'"([a-zA-Z.-]+)":"', m.group(1)))
    return sorted(keys - have) + ["unrecognised logAudit form: " + o for o in odd]

# 10. BUILD and the newest What's new entry carry the date of CHANGELOG.md's first heading
def build_lint(html_text):
    bad = []
    m = re.search(r'const BUILD="(\d{4}-\d{2}-\d{2})"', html_text)
    if not m: return ["BUILD missing"]
    build = m.group(1)
    try:
        head = next(l for l in (root / "CHANGELOG.md").read_text(encoding="utf-8").splitlines() if l.startswith("## ") and "(site only)" not in l and "(tools only)" not in l)   # a landing-page or tooling entry is not an app release
    except StopIteration:
        return ["CHANGELOG has no heading"]
    hm = re.match(r"## (\d{1,2}) (\w{3})\w* (\d{4})", head)
    months = {"Jan":"01","Feb":"02","Mar":"03","Apr":"04","May":"05","Jun":"06","Jul":"07","Aug":"08","Sep":"09","Oct":"10","Nov":"11","Dec":"12"}
    if not hm or hm.group(2) not in months: return ["CHANGELOG heading date unreadable: " + head[:40]]
    head_date = "%s-%s-%02d" % (hm.group(3), months[hm.group(2)], int(hm.group(1)))
    if build != head_date: bad.append("BUILD %s != CHANGELOG %s" % (build, head_date))
    heads = set()
    for l in (root / "CHANGELOG.md").read_text(encoding="utf-8").splitlines():
        if "(site only)" in l: continue   # a landing-page entry is not an app release, same as the newest-heading lookup above
        h = re.match(r"## (\d{1,2}) (\w{3})\w* (\d{4})", l)
        if h and h.group(2) in months: heads.add("%s-%s-%02d" % (h.group(3), months[h.group(2)], int(h.group(1))))
    ons = re.findall(r'\{on:"(\d{4}-\d{2}-\d{2})"', html_text[html_text.find("const WHATS_NEW="):html_text.find("];", html_text.find("const WHATS_NEW="))])
    if not ons: bad.append("WHATS_NEW empty")
    else:
        if ons[0] > build: bad.append("WHATS_NEW[0].on %s is after BUILD %s" % (ons[0], build))
        if ons != sorted(ons, reverse=True): bad.append("WHATS_NEW not newest first")
        for o in ons:
            if o not in heads: bad.append("WHATS_NEW date %s has no CHANGELOG heading" % o)
    return bad

# 11. a booking key is iso|PERIOD|zone|type — every handler that splits one must pass the type on, or a
#     whole-day chip silently books the half shift it starts in (the snake-rounds path did exactly that).
def pick_key_lint(html_text):
    bad = []
    for m in re.finditer(r'dataset\.(book|pick)\.split\("\|"\)', html_text):
        if "[3]" not in html_text[m.end():m.end() + 400]:
            bad.append("the data-" + m.group(1) + " handler drops the type segment")
    if "canBook(sid,a[0],a[1],a[2],a[3])" not in html_text:
        bad.append("srBatchBook drops the type segment")
    if "pickCheck(_srSid||S.viewAs,a[0],a[1],a[2],a[3])" not in html_text:
        bad.append("the pick handler judges a different shift from the chip it was rendered from")
    return bad

# 12. a control rendered on one tab must be wired inside that tab's block in wire(), or it renders and does
#     nothing. The come-off decision buttons are drawn by an admin card on Requests; wiring them beside the
#     day-sheet handlers (the obvious place, since that is where the rest of the feature lives) is silent.
GLOBAL_ATTRS = {"data-go", "data-sec", "data-tab"}   # wired once for the whole app, not per tab


def _wire_block(html_text, tab):
    i = html_text.find('if(S.tab==="%s"){' % tab)
    if i < 0:
        return None
    j = html_text.find('if(S.tab==="', i + 10)
    return html_text[i:(j if j > 0 else len(html_text))]


def tab_wiring_lint(html_text):
    bad = []
    # every control a renderer draws must be wired in the block of the tab that shows that renderer
    for fn, tab in (("daySheetHTML", "selfroster"), ("ocSheetHTML", "selfroster"), ("ciSheetRows", "selfroster"), ("dayRowHTML", "selfroster"), ("dsBookedActs", "selfroster"), ("reqSheetHTML", "requests"), ("swapAllFormHTML", "requests"), ("swapAskingHTML", "requests"), ("swapWantedHTML", "requests")):
        i = html_text.find("function %s(" % fn)
        if i < 0:
            bad.append("no %s to check" % fn)
            continue
        j = html_text.find("\nfunction ", i + 10)
        body = html_text[i:(j if j > 0 else len(html_text))]
        block = _wire_block(html_text, tab)
        if block is None:
            bad.append("no wire() block for the %s tab" % tab)
            continue
        for a in sorted(set(re.findall(r'(data-[a-z]+)="', body))) :
            if a in GLOBAL_ATTRS:
                continue
            if ('querySelectorAll("[%s]")' % a) not in block:
                bad.append("%s is drawn by %s but wired outside the %s block" % (a, fn, tab))
    for tab, attrs in (("requests", ["data-askoff", "data-askkeep"]),):
        block = _wire_block(html_text, tab)
        if block is None:
            bad.append("no wire() block for the %s tab" % tab)
            continue
        for a in attrs:
            if ('querySelectorAll("[%s]")' % a) not in block:
                bad.append("%s is rendered on the %s tab but wired outside its block" % (a, tab))
    return bad

# 13. the newer-build check runs when the app comes back to the screen and on a slow interval (a phone on the home screen
#     keeps the old script until it reloads — 14 Oct 2026)
def stamp_lint():
    """app.html's script and stylesheet tags carry the current ?v= code hash (tools/stamp.py): without it a change to src/ or
    src/ alone leaves app.html unchanged, and _buildCheck never tells a phone to reload (30 Oct 2026)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("stamp", root / "tools" / "stamp.py"); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    raw = (root / "app.html").read_bytes().decode("utf-8")
    return [] if mod.stamped(raw) == raw else ["app.html's ?v= stamp is stale — run python tools/stamp.py"]

def build_check_lint(html_text):
    bad = []
    vis = [l for l in html_text.split("\n") if 'addEventListener("visibilitychange"' in l]
    if not vis or "_buildCheck()" not in vis[0]: bad.append("visibilitychange does not call _buildCheck()")
    if "setInterval(_buildCheck," not in html_text: bad.append("no interval for _buildCheck")
    return bad

LINTS = [
    ("stamp: every code tag in app.html carries the current code hash", "stamp: problems", lambda: stamp_lint()),
    ("build: the newer-build check is wired to visibility and a slow interval", "build-check: problems", lambda: build_check_lint(html)),
    ("wiring: a tab's own controls are wired in its own block", "wiring: controls rendered on a tab but wired elsewhere", lambda: tab_wiring_lint(html)),
    ("keys: every booking-key handler carries the shift type", "keys: handlers that drop the type segment", lambda: pick_key_lint(html)),
    ("build: BUILD and What's new match the changelog's latest heading", "build: problems", lambda: build_lint(html)),
    ("audit: every logged action has a plain-word sentence", "audit: actions without a sentence", lambda: audit_words_lint(html)),
    ("head: SheetJS is deferred and Inter is optional", "head: problems", lambda: head_lint(html)),
    ("demo: deploy/demo.html is built from today's app and a fictional seed", "demo: problems", lambda: demo_lint()),
    ("deploy: deploy/app.html is today's app, and preview.html the same with the cloud blanked", "deploy: problems", lambda: deploy_lint()),
    ("group files: the converter's self-test round-trips its files through this app", "group files: problems", lambda: group_files_lint()),
    ("layers: re-layered features keep the dependency rule", "layers: a re-layered feature reaches past its layer", lambda: layering_lint()),
    ("de-identify: a fake export comes out with nothing identifying left and its shape intact", "de-identify: problems", lambda: deidentify_lint()),
    ("landing: vocabulary, cast, size, links, form and mark are right", "landing: problems", lambda: landing_lint()),
    ("icon: the brand mark bars are AM / PM / CST", "icon: brand mark still carries the RAG red", lambda: icon_lint(html)),
    ("css: no emoji in buttons, notes, tags or banners", "css: emoji still used as chrome", lambda: button_emoji_lint(html)),
    ("css: the retired small-label classes are gone", "css: retired small-label classes still used", lambda: retired_class_lint(html)),
    ("css: hex literals only in :root and PALETTE", "css: hex literals outside :root / PALETTE", lambda: css_hex_lint(html)),
    ("css: PALETTE mirrors :root", "css: PALETTE keys that differ from :root", lambda: palette_mirror_lint(html)),
    ("css: every var(--x) reference is defined", "css: var() references with no definition and no fallback", lambda: css_token_lint(html)),
    ("css: no font-size px literal outside :root", "css: font-size px literals outside :root", lambda: css_fontsize_lint(html)),
]
def _run_lint(fn):
    try:
        return fn()
    except Exception as e:   # a lint that cannot run is a failure to report, not a crash that hides every later lint
        return ["lint crashed: %s: %s" % (type(e).__name__, e)]

for ok_msg, fail_msg, fn in LINTS:
    bad = _run_lint(fn)
    line = ("FAIL  " + fail_msg + " (" + str(len(bad)) + "): " + ", ".join(str(b) for b in bad[:12])) if bad else ("PASS  " + ok_msg)
    print(line); text += "\n" + line
fails = [l for l in text.splitlines() if l.startswith("FAIL") or "ERROR" in l]
passes = [l for l in text.splitlines() if l.startswith("PASS")]
print(f"\n{len(passes)} passed, {len(fails)} failed  ({target.name if target.parent == root else target})")
sys.exit(1 if fails or not passes else 0)
