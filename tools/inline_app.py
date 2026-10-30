#!/usr/bin/env python3
"""The app as ONE self-contained HTML file: app.html with its local stylesheets and scripts inlined in load order.

Shared by the builders that need a single file (deploy/demo.html, preview.html, the staging copy) and by tests/run.py.

    python tools/inline_app.py [--blank-cloud] [--out FILE]   # default: print to stdout
"""
import argparse, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CLOUD_RE = re.compile(r'var CLOUD = \{ url: "[^"]*", key: "[^"]*"')
SCRIPT_RE = re.compile(r'<script src="(?!https?:)([^"?]+)(?:\?[^"]*)?"></script>')   # ?v= is tools/stamp.py's
STYLE_RE = re.compile(r'<link rel="stylesheet" href="(?!https?:)([^"?]+)(?:\?[^"]*)?">')


def _read(base, rel):
    return (base / rel).read_text(encoding="utf-8").lstrip("﻿")


def script_files(page_text):
    """The page's local scripts, in load order."""
    return SCRIPT_RE.findall(page_text)


def inline(page_path=ROOT / "app.html"):
    page_path = pathlib.Path(page_path)
    base, page = page_path.parent, page_path.read_text(encoding="utf-8")
    page = STYLE_RE.sub(lambda m: "<style>\n" + _read(base, m.group(1)) + "\n</style>", page)
    return SCRIPT_RE.sub(lambda m: "<script>\n" + _read(base, m.group(1)) + "\n</script>", page)


def point_cloud(html, url, key):
    """Repoint the CLOUD block (url + anon key) of an inlined app; empty strings give local-only mode."""
    out, n = CLOUD_RE.subn('var CLOUD = { url: "%s", key: "%s"' % (url, key), html, count=1)
    if n != 1:
        raise SystemExit("the CLOUD block was not found (src/config/cloud.js)")
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--blank-cloud", action="store_true")
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    html = inline()
    if a.blank_cloud:
        html = point_cloud(html, "", "")
    if a.out:
        pathlib.Path(a.out).write_text(html, encoding="utf-8")
        print("wrote", a.out, len(html.encode("utf-8")) // 1024, "KB")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdout.write(html)
    return 0


if __name__ == "__main__":
    sys.exit(main())
