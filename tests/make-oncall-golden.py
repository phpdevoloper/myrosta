#!/usr/bin/env python3
"""Write tests/oncall-golden.js: what the per-zone on-call tick put into files, calendars and counts.

Run this ONLY against a build whose on-call output is the reference — it was run once, at 628603d, the last
build before the tick became an on-call window. Re-running it on a later build would bless whatever that build
does, which is exactly the regression the golden exists to catch.

    python3 tests/make-oncall-golden.py [app.html]
"""
import json, pathlib, re, subprocess, sys, tempfile

root = pathlib.Path(__file__).resolve().parent.parent
target = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / "app.html"
app = max(re.findall(r"<script>(.*?)</script>", target.read_text(encoding="utf-8"), re.S), key=len)
src = (root / "tests" / "stubs.js").read_text(encoding="utf-8") + app + "\n" + (root / "tests" / "suite.js").read_text(encoding="utf-8")
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
    f.write(src)
out = subprocess.run(["osascript", "-l", "JavaScript", f.name], capture_output=True, text=True).stdout
line = next((l for l in out.split("\n") if l.startswith("GOLDEN ")), None)
if not line:
    sys.exit("no GOLDEN line — is tests/oncall-golden.js already spliced in, or did the suite stop early?")
data = json.loads(line[len("GOLDEN "):])
head = sub = subprocess.run(["git", "-C", str(root), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
(root / "tests" / "oncall-golden.js").write_text(
    "// What the per-zone on-call tick produced, written by tests/make-oncall-golden.py from " + head + ".\n"
    "// Do not regenerate to make a test pass: a difference here is a change to a live group's payroll file,\n"
    "// RosterOn workbook, calendar or counts.\n"
    "var ONCALL_GOLDEN=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print("wrote tests/oncall-golden.js from", head, "—", sum(len(v) for v in data.values()), "captures")
