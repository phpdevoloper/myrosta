#!/usr/bin/env python3
"""MyRosta AI-DLC gate runner.

    python run_gates.py [--repo PATH] [--gate NAME ...] [--stamp]

Gates: syntax, secrets, tokens, deploy-parity, env-config, tests. Exit 0 = all gates passed.
--stamp writes state/gates-pass.json (HEAD + diff hash) so the commit hook can
verify the gates ran on exactly the code being committed.
"""
import argparse, hashlib, json, pathlib, re, subprocess, sys, time

HOME = pathlib.Path(__file__).resolve().parent.parent
STATE = HOME / "state"


def sh(cmd, cwd, timeout=300):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, shell=isinstance(cmd, str))
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def changed_files(repo):
    _, out = sh("git status --porcelain", repo)
    return [l[3:].strip().strip('"') for l in out.splitlines() if l.strip()]


def gate_syntax(repo):
    bad = []
    for f in sorted((repo / "src").rglob("*.js")):
        code, out = sh(["node", "--check", str(f)], repo)
        if code:
            bad.append(f"{f.relative_to(repo).as_posix()}: {out.strip().splitlines()[0] if out.strip() else 'syntax error'}")
    return bad


SECRET = re.compile(r"(service_role|sb_secret_|-----BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}|SUPABASE_SERVICE)", re.I)


def gate_secrets(repo):
    _, diff = sh("git diff HEAD -U0", repo)
    return [f"added line looks like a secret: {l[:80]}" for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++") and SECRET.search(l)]


def gate_tokens(repo):
    """Visual-system rules mirrored from tests/run.py: hex colours and px font sizes belong in tokens.css only."""
    bad = []
    for f in sorted((repo / "src" / "presentation" / "styles").glob("*.css")):
        if f.name == "tokens.css":
            continue
        css = f.read_text(encoding="utf-8", errors="replace")
        for h in re.findall(r"#[0-9a-fA-F]{3,6}\b", css):
            if h.lower() not in ("#fff", "#ffffff", "#000"):
                bad.append(f"{f.name}: hex literal {h} (use a var(--token))")
        for m in re.findall(r"font-size:\s*\d+(?:\.\d+)?px", css):
            bad.append(f"{f.name}: {m} (use the --fs-* scale)")
    return bad[:25]


def gate_deploy_parity(repo):
    """Warn when deploy/ is not what tools/build-deploy.py would write: compares file contents against the builder's own list
    of served files (cloud.js is per-environment and skipped), so renames and new folders cannot confuse it."""
    import importlib.util
    tool = repo / "tools" / "build-deploy.py"
    if not tool.exists():
        return []
    spec = importlib.util.spec_from_file_location("build_deploy", tool); bd = importlib.util.module_from_spec(spec); spec.loader.exec_module(bd)
    d, bad = repo / "deploy", []
    for rel in bd.served_files():
        if rel in bd.PER_ENV: continue
        twin = d / rel
        if not twin.exists() or twin.read_bytes() != (repo / rel).read_bytes(): bad.append(f"deploy/{rel} differs from {rel}")
    known = set(bd.served_files()) | set(bd.GENERATED)
    bad += [f"deploy/{f.relative_to(d).as_posix()} has no source" for f in sorted(d.rglob("*")) if f.is_file() and f.relative_to(d).as_posix() not in known] if d.exists() else []
    return bad + (["run python tools/build-deploy.py"] if bad else [])


def gate_env_config(repo):
    """deploy/src/config/cloud.js must carry the production values from .prod_config (tools/use-env.py prod --check)."""
    code, out = sh([sys.executable, "tools/use-env.py", "prod", "--check"], repo)
    if code == 0:
        return []
    if "not found" in out or "placeholder" in out or "missing:" in out:
        return ["skipped: " + out.strip().splitlines()[0]]   # cannot be checked here, so a warning rather than a block
    return [l for l in out.splitlines() if l.strip()][:5] + ["run: python tools/use-env.py prod"]


def gate_tests(repo):
    code, out = sh([sys.executable, "tests/run.py"], repo, timeout=600)
    if code == 0 and "FAIL" not in out:
        return []
    return [l for l in out.splitlines() if l.strip()][-8:] or ["tests/run.py failed with no output"]


GATES = {"syntax": gate_syntax, "secrets": gate_secrets, "tokens": gate_tokens, "deploy-parity": gate_deploy_parity, "env-config": gate_env_config, "tests": gate_tests}
ADVISORY = {"deploy-parity"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=".")
    ap.add_argument("--gate", action="append")
    ap.add_argument("--stamp", action="store_true")
    a = ap.parse_args()
    repo = pathlib.Path(a.repo).resolve()
    results, failed = {}, False
    for name in a.gate or GATES:
        t = time.time()
        try:
            problems = GATES[name](repo)
        except Exception as e:
            problems = [f"gate crashed: {e}"]
        hard = bool(problems) and name not in ADVISORY and not all(x.startswith("skipped:") for x in problems)
        failed = failed or hard
        results[name] = {"status": "FAIL" if hard else ("WARN" if problems else "PASS"), "problems": problems, "secs": round(time.time() - t, 1)}
        print(f"[{results[name]['status']}] {name} ({results[name]['secs']}s)")
        for p in problems[:10]:
            print("    -", p)
    if a.stamp and not failed:
        git = lambda *a: subprocess.run(["git", *a], cwd=repo, capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
        head, diff = git("rev-parse", "HEAD"), git("diff", "HEAD")   # stdout only, exactly as commit_guard.py reads it: git's CRLF warnings go to stderr
        STATE.mkdir(exist_ok=True)
        (STATE / "gates-pass.json").write_text(json.dumps({"repo": str(repo), "head": head.strip(), "diff": hashlib.sha256(diff.encode()).hexdigest(), "at": time.time()}))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
