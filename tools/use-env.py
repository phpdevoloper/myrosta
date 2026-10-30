#!/usr/bin/env python3
"""Point the app at the dev or prod Supabase project from a KEY=value env file.

    python tools/use-env.py dev      # reads .dev_config,  rewrites src/config/cloud.js
    python tools/use-env.py prod     # reads .prod_config, rewrites src/config/cloud.js and deploy/src/config/cloud.js
    python tools/use-env.py prod --check   # no writes; exit 1 if the files differ from .prod_config

Only the `var CLOUD = {...};` block changes. The anon key is the public one (Project Settings -> API), never the service key.
"""
import argparse, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL_RE = re.compile(r"https://[a-z]{20}\.supabase\.co")
BLOCK_RE = re.compile(r"var CLOUD = \{.*?\};", re.S)
REQUIRED = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "ORG", "VAPID_PUBLIC"]


def load_env(path):
    env = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            v = re.split(r"\s#", v, maxsplit=1)[0].strip()   # inline comment: whitespace then #
            env[k.strip()] = v
    return env


def csv(s):
    return [x.strip() for x in s.split(",") if x.strip()]


def build_block(env):
    flag = lambda k: "true" if env.get(k, "false").lower() == "true" else "false"
    return ("var CLOUD = { url: %s, key: %s, org: %s, adminEmails: %s, allowedDomains: %s, "
            "sso: { azure: %s, google: %s }, vapidPublic: %s };") % (
        json.dumps(env["SUPABASE_URL"].rstrip("/")), json.dumps(env["SUPABASE_ANON_KEY"]), json.dumps(env["ORG"]),
        json.dumps(csv(env.get("ADMIN_EMAILS", ""))), json.dumps(csv(env.get("ALLOWED_DOMAINS", ""))),
        flag("SSO_AZURE"), flag("SSO_GOOGLE"), json.dumps(env["VAPID_PUBLIC"]))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("env", choices=["dev", "prod"])
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    cfg = ROOT / ("." + a.env + "_config")
    if not cfg.exists():
        raise SystemExit("%s not found - copy %s.example and fill it in" % (cfg.name, cfg.name))
    env = load_env(cfg)
    missing = [k for k in REQUIRED if not env.get(k)]
    if missing:
        raise SystemExit("%s is missing: %s" % (cfg.name, ", ".join(missing)))
    if not URL_RE.fullmatch(env["SUPABASE_URL"].rstrip("/")):
        raise SystemExit("SUPABASE_URL should look like https://abcdefghijklmnopqrst.supabase.co")
    if any("REPLACE" in env[k] or "<" in env[k] for k in ("SUPABASE_ANON_KEY", "VAPID_PUBLIC")):
        raise SystemExit("%s still has placeholder values" % cfg.name)
    block = build_block(env)
    cloud = pathlib.Path("src", "config", "cloud.js")
    targets = [ROOT / cloud] + ([ROOT / "deploy" / cloud] if a.env == "prod" else [])
    bad = False
    for t in targets:
        text = t.read_text(encoding="utf-8")
        if not BLOCK_RE.search(text):
            raise SystemExit("CLOUD block not found in %s" % t)
        new = BLOCK_RE.sub(lambda m: block, text, count=1)
        if a.check:
            if new != text:
                print("DIFFERS:", t.relative_to(ROOT)); bad = True
        else:
            t.write_text(new, encoding="utf-8", newline="")
            print("wrote", t.relative_to(ROOT))
    print("%s -> %s (org %s)" % (a.env, env["SUPABASE_URL"], env["ORG"]))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
