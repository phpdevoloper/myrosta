#!/usr/bin/env python3
"""A copy of the app pointed at a staging Supabase project.

    python3 tools/staging-app.py --url https://<ref>.supabase.co --key <anon key> [--out .staging/app.html]

Takes today's app.html, swaps the one CLOUD line (project URL + anon key) and writes the copy. Open the copy in a
browser (double-click it) and sign in with an email that is on the staging project's roster_members. The anon key is
the public one from Project Settings → API; never the service key. Nothing else in the app changes.
"""
import argparse, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def point(app_text, url, key):
    m = re.search(r'const CLOUD=\{ url:"[^"]*", key:"[^"]*",', app_text)
    if not m:
        raise SystemExit("the CLOUD line was not found in app.html")
    return app_text.replace(m.group(0), 'const CLOUD={ url:"%s", key:"%s",' % (url, key), 1)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True, help="https://<project-ref>.supabase.co")
    ap.add_argument("--key", required=True, help="the project's anon (public) key")
    ap.add_argument("--out", default=str(ROOT / ".staging" / "app.html"))
    a = ap.parse_args(argv)
    url = a.url.strip().rstrip("/")
    if not re.fullmatch(r"https://[a-z]{20}\.supabase\.co", url):
        raise SystemExit("--url should look like https://abcdefghijklmnopqrst.supabase.co")
    if not a.key.strip().startswith("eyJ") or "service_role" in a.key:
        raise SystemExit("--key should be the anon key (starts with eyJ), never the service key")
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(point((ROOT / "app.html").read_text(encoding="utf-8"), url, a.key.strip()), encoding="utf-8")
    print("written", out, "→ open it in a browser; it talks to", url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
