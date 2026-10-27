#!/usr/bin/env python3
"""deploy-copies.py — deploy/app.html = app.html byte for byte; preview.html = app.html with the cloud blanked (the recipe tests/run.py checks)"""
import re,pathlib
root=pathlib.Path("/Users/ranjithkandavelu/Desktop/Claude/Myrosta"); app=(root/"app.html").read_text(encoding="utf-8")
(root/"deploy"/"app.html").write_text(app,encoding="utf-8")
m=re.search(r'const CLOUD=\{ url:"[^"]*", key:"[^"]*",',app); (root/"preview.html").write_text(app.replace(m.group(0),'const CLOUD={ url:"", key:"",',1),encoding="utf-8")
print("deploy/app.html and preview.html written")
