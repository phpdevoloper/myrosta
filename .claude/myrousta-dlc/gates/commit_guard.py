#!/usr/bin/env python3
"""PreToolUse hook (Bash): inside the MyRosta repo, block `git commit` / `git push` unless run_gates.py --stamp
passed on exactly the current diff. Other projects are untouched."""
import hashlib, json, pathlib, re, subprocess, sys, time

try:
    ev = json.load(sys.stdin)
except Exception:
    sys.exit(0)

cmd = (ev.get("tool_input") or {}).get("command", "")
cwd = ev.get("cwd") or "."
if "myrosta" not in cwd.lower().replace("\\", "/") or not re.search(r"\bgit\s+(commit|push)\b", cmd):
    sys.exit(0)

stamp = pathlib.Path(__file__).resolve().parent.parent / "state" / "gates-pass.json"


def git(*a):
    return subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace").stdout


def block(msg):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": msg}}))
    sys.exit(0)


if re.search(r"\bgit\s+push\b", cmd) and not re.search(r"\bgit\s+commit\b", cmd):
    sys.exit(0)  # push follows a gated commit; pushing is the release agent's explicit step

try:
    s = json.loads(stamp.read_text())
except Exception:
    block("MyRosta gate: no gate stamp. Run: python .claude/myrousta-dlc/gates/run_gates.py --repo . --stamp")

diff = hashlib.sha256(git("diff", "HEAD").encode()).hexdigest()
if s.get("head") != git("rev-parse", "HEAD").strip() or s.get("diff") != diff or time.time() - s.get("at", 0) > 3600:
    block("MyRosta gate: stamp is stale (code changed since gates ran, or >1h old). Re-run run_gates.py --stamp.")
