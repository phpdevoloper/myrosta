#!/usr/bin/env python3
"""Stamp app.html's local script and stylesheet tags with ?v=<hash of the code>.

Why: phones learn about a new release from app.html's ETag (_buildCheck). Since the code moved out of app.html into css/ and
src/, a change to a .js or .css file alone left app.html byte for byte the same, so no phone was told to reload. The stamp
makes every code change change app.html, and stops a browser from running a cached copy of a file that has moved on.

    python tools/stamp.py           # rewrite app.html (then copy it to deploy/)
    python tools/stamp.py --check   # exit 1 if the stamp is stale

src/config/cloud.js is left out of the hash: it differs between dev and deploy/ (tools/use-env.py), and deploy/app.html must be
app.html byte for byte.
"""
import argparse, hashlib, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TAG = re.compile(r'(<script src="|<link rel="stylesheet" href=")(?!https?:)([^"?]+)(?:\?v=[^"]*)?(")')
UNHASHED = {"src/config/cloud.js"}


def code_hash(page_text, base=ROOT):
    h = hashlib.sha256()
    for rel in sorted({m.group(2) for m in TAG.finditer(page_text)} - UNHASHED):
        h.update(rel.encode() + b"\0" + (base / rel).read_bytes() + b"\0")
    return h.hexdigest()[:10]


def stamped(page_text, base=ROOT):
    v = code_hash(page_text, base)
    return TAG.sub(lambda m: m.group(1) + m.group(2) + "?v=" + v + m.group(3), page_text)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    page = ROOT / "app.html"
    raw = page.read_bytes().decode("utf-8")
    new = stamped(raw)
    if a.check:
        if new != raw:
            print("app.html's ?v= stamp is stale: run python tools/stamp.py")
            return 1
        print("stamp current:", code_hash(raw))
        return 0
    if new != raw:
        page.write_bytes(new.encode("utf-8"))
    print("stamped app.html ?v=" + code_hash(raw))
    return 0


if __name__ == "__main__":
    sys.exit(main())
