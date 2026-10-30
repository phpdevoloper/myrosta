#!/usr/bin/env python3
"""Build deploy/ (what Netlify serves at myrosta.com.au) from the source tree. deploy/ is build output: never edit it by hand.

    python tools/build-deploy.py               # needs a filled-in .prod_config (production Supabase project)
    python tools/build-deploy.py --allow-dev   # no .prod_config yet: deploy/ keeps the dev project, with a warning

Steps: stamp app.html's tags with the code hash (tools/stamp.py), rebuild preview.html, wipe deploy/, copy every served file
(SERVED_FILES + SERVED_DIRS, same paths as on the site), write deploy/src/config/cloud.js from .prod_config, build
deploy/demo.html. tests/run.py checks deploy/ against served_files(), so the two can never disagree.
"""
import argparse, importlib.util, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "deploy"
SERVED_FILES = ["app.html", "index.html", "privacy.html", "support.html", "terms.html", "thanks.html", "manifest.json", "sw.js"]
SERVED_DIRS = ["img", "src"]
GENERATED = ["demo.html"]          # written into deploy/ by tools/build-demo.py, no source twin
PER_ENV = ["src/config/cloud.js"]  # deploy/ carries the production values (tools/use-env.py)


def served_files():
    """Every source file the site serves, as paths relative to the repo root (= relative to deploy/)."""
    out = list(SERVED_FILES)
    for d in SERVED_DIRS:
        out += sorted(f.relative_to(ROOT).as_posix() for f in (ROOT / d).rglob("*") if f.is_file() and "__pycache__" not in f.parts)
    return out


def _tool(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), ROOT / "tools" / (name + ".py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--allow-dev", action="store_true", help="build even if .prod_config is missing or unfilled (deploy/ keeps the dev project)")
    a = ap.parse_args(argv)
    sys.path.insert(0, str(ROOT / "tools"))
    import inline_app

    stamp, env = _tool("stamp"), _tool("use-env")
    prod_cfg = ROOT / ".prod_config"
    prod = env.load_env(prod_cfg) if prod_cfg.exists() else {}
    ready = all(prod.get(k) and "REPLACE" not in prod[k] and "<" not in prod[k] for k in env.REQUIRED)
    if not ready and not a.allow_dev:
        raise SystemExit(".prod_config is missing or still has placeholders. Fill it in, or pass --allow-dev to build with the dev project.")

    stamp.main([])
    (ROOT / "preview.html").write_text(inline_app.point_cloud(inline_app.inline(ROOT / "app.html"), "", ""), encoding="utf-8")

    if DEPLOY.exists():
        shutil.rmtree(DEPLOY)
    for rel in served_files():
        dst = DEPLOY / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dst)

    cloud = DEPLOY / PER_ENV[0]
    if ready:
        text = cloud.read_text(encoding="utf-8")
        cloud.write_text(env.BLOCK_RE.sub(lambda m: env.build_block(prod), text, count=1), encoding="utf-8", newline="")
        where = prod["SUPABASE_URL"]
    else:
        where = "the DEV project (--allow-dev): do not ship this to myrosta.com.au"

    (DEPLOY / "demo.html").write_text(_tool("build-demo").expected(), encoding="utf-8")

    n = sum(1 for f in DEPLOY.rglob("*") if f.is_file())
    print("deploy/ rebuilt: %d files; backend: %s" % (n, where))
    return 0


if __name__ == "__main__":
    sys.exit(main())
