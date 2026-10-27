#!/usr/bin/env python3
"""SQL tests for supabase/prod-booking-rpc.sql on a local PostgreSQL 16.

    python3 tests/sql/run.py            # boots .pgtest (made on first use with uv), applies the stand-ins,
                                        # the production file TWICE (it must be idempotent), then the assertions
    python3 tests/sql/run.py --keep     # also leave the database 'myrosta_test' in place for a look

Exit code 0 = every assertion passed.
"""
import pathlib, subprocess, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pglocal
pglocal.ensure_venv()

ROOT = pglocal.ROOT
HERE = pathlib.Path(__file__).resolve().parent
srv = pglocal.server()
uri = pglocal.fresh_db(srv, "myrosta_test")
import pgserver, os
psql = os.path.join(os.path.dirname(pgserver.__file__), "pginstall", "bin", "psql")


def run_file(path, label):
    r = subprocess.run([psql, "-v", "ON_ERROR_STOP=1", "-q", "-X", uri, "-f", str(path)], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"{label}: psql failed\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r.stdout


run_file(HERE / "standins.sql", "standins")
run_file(ROOT / "supabase" / "prod-booking-rpc.sql", "prod-booking-rpc (1st)")
run_file(ROOT / "supabase" / "prod-booking-rpc.sql", "prod-booking-rpc (2nd, idempotent)")
print("PASS  prod-booking-rpc.sql applies twice without error")

# the assertion file leaves its results in a temp table, so it and the report must share one session
script = "\\o /dev/null\n" + (HERE / "roster_commit.sql").read_text(encoding="utf-8") + "\n\\o\n\\pset format unaligned\n\\pset tuples_only on\nselect case when pass then 'PASS' else 'FAIL' end || '  ' || name from t_results order by n;\n"
r = subprocess.run([psql, "-v", "ON_ERROR_STOP=1", "-q", "-X", uri], input=script, capture_output=True, text=True)
if r.returncode != 0:
    print(f"assertions: psql failed\n{r.stdout}\n{r.stderr}")
    sys.exit(1)
lines = [l for l in r.stdout.splitlines() if l.startswith("PASS") or l.startswith("FAIL")]
print("\n".join(lines))
fails = [l for l in lines if l.startswith("FAIL")]
print(f"\n{len(lines) + 1 - len(fails)} passed, {len(fails)} failed  (tests/sql)")
if "--keep" in sys.argv:
    print("kept:", uri)
sys.exit(1 if fails or not lines else 0)
