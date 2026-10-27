"""A local PostgreSQL 16 for the SQL tests and the load test — no Homebrew, no Docker.

`pgserver` (PyPI) bundles the Postgres binaries; it lives in a git-ignored venv under .pgtest/ made with uv:
    uv venv -p 3.12 .pgtest/venv && uv pip install -p .pgtest/venv/bin/python pgserver "psycopg[binary]"
Both tests/sql/run.py and tools/storm.py run THEMSELVES under that venv (re-exec) when they are not already in it.
"""
import os, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
VENV = ROOT / ".pgtest" / "venv"
DATA = ROOT / ".pgtest" / "data"


def ensure_venv():
    """Re-exec the current script under the pgtest venv, creating it on first use."""
    py = VENV / "bin" / "python"
    if pathlib.Path(sys.executable).resolve() == py.resolve():
        return
    if not py.exists():
        uv = subprocess.run(["which", "uv"], capture_output=True, text=True).stdout.strip()
        if not uv:
            sys.exit("needs uv (https://docs.astral.sh/uv/) to make .pgtest/venv")
        (ROOT / ".pgtest").mkdir(exist_ok=True)
        subprocess.run([uv, "venv", "-q", "-p", "3.12", str(VENV)], check=True)
        subprocess.run([uv, "pip", "install", "-q", "-p", str(py), "pgserver", "psycopg[binary]"], check=True)
    os.execv(str(py), [str(py)] + sys.argv)


def server():
    import pgserver  # only importable inside the venv
    DATA.mkdir(parents=True, exist_ok=True)
    return pgserver.get_server(str(DATA))


def fresh_db(srv, name):
    """Drop and recreate a database; returns its URI."""
    srv.psql(f"drop database if exists {name};")
    srv.psql(f"create database {name};")
    base = srv.get_uri()   # postgresql://postgres:@/postgres?host=<socket dir>
    head, _, tail = base.partition("?")
    return head.rsplit("/", 1)[0] + "/" + name + ("?" + tail if tail else "")
