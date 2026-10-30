#!/usr/bin/env python3
"""Build deploy/demo.html from the inlined app (tools/inline_app.py) + tools/demo-seed.js.

The demo is the real app, in local mode, with sample data: same script, same CSS, so it can never fall behind the
product. The test runner rebuilds it in memory and fails if deploy/demo.html differs ("run tools/build-demo.py").

    python3 tools/build-demo.py          # writes deploy/demo.html
"""
import pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import inline_app

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEMO_KEY = "myrosta_demo_v7"   # bump when the seed changes shape, so earlier visitors reseed

BANNER = '''
<div id="demoBanner" style="position:fixed;left:0;right:0;bottom:0;z-index:400;background:#0F243A;color:#fff;font-size:12px;line-height:1.35;padding:6px 12px calc(6px + env(safe-area-inset-bottom));text-align:center">
  <b>Demo sandbox</b> · sample data, kept in this browser · you're Dr Jordan Lee, use <b>View as</b> to be the admin · <a href="/" style="color:#7FD8C8;white-space:nowrap">myrosta.com.au</a>
</div>
<script>
(function(){ function lift(){ var b=document.getElementById("demoBanner"), n=document.getElementById("bottomnav"); if(!b)return; var h=b.offsetHeight; if(n)n.style.bottom=h+"px"; document.documentElement.style.setProperty("--demo-banner",h+"px"); }   // the bottom bar sits above the banner whatever its height
  lift(); window.addEventListener("resize",lift); setTimeout(lift,300); })();
</script>
<style>.wrap{padding-bottom:calc(var(--demo-banner,60px) + 70px)} #sheetRoot .sheet{padding-bottom:calc(var(--demo-banner,60px) + 16px)}</style>
'''


def build(app_html: str, seed_js: str) -> str:
    s = app_html
    # head: search engines out, a demo title, no PWA install (it must not sit on a home screen as the real app)
    s = s.replace("<title>Myrosta</title>", '<meta name="robots" content="noindex,nofollow">\n<title>DEMO · Myrosta</title>', 1)
    s = re.sub(r'<link rel="manifest" href="manifest.json">\n', "", s, count=1)
    s = re.sub(r'<meta name="apple-mobile-web-app-[^"]*" content="[^"]*">\n', "", s)
    s = re.sub(r'<meta name="mobile-web-app-capable" content="[^"]*">\n', "", s)
    # local mode: no cloud, its own storage key
    s = inline_app.point_cloud(s, "", "")
    s, n = re.subn(r'const KEY="[^"]+";', 'const KEY="%s";' % DEMO_KEY, s, count=1)
    assert n == 1, "KEY line not found"
    # inject at the REAL closing body tag: the Excel exporters contain literal '</body>' inside JS strings
    i = s.rfind("</body>")
    assert i > 0, "no closing body tag"
    inject = BANNER + "<script>\n" + seed_js.strip() + "\n</script>\n"
    return s[:i] + inject + s[i:]


def expected() -> str:
    return build(inline_app.inline(ROOT / "app.html"), (ROOT / "tools" / "demo-seed.js").read_text(encoding="utf-8"))


if __name__ == "__main__":
    out = ROOT / "deploy" / "demo.html"
    html = expected()
    out.write_text(html, encoding="utf-8")
    print("wrote", out, len(html.encode("utf-8")) // 1024, "KB")
    sys.exit(0)
