---
name: myrosta-gates
description: The MyRosta AI-DLC quality gates, how to run them, and how the commit hook enforces them.
---

# Gates

Run: `python .claude/myrousta-dlc/gates/run_gates.py --repo <repo> [--gate NAME ...] [--stamp]`

| Gate | Blocks? | Checks |
|------|---------|--------|
| syntax | yes | `node --check` on every `src/**/*.js` |
| secrets | yes | added diff lines matching service-role keys, private keys, `sk-` tokens |
| tokens | yes | no hex colours / px font sizes in `src/presentation/styles/*.css` outside `tokens.css` |
| deploy-parity | warn | served source changed without `deploy/` being rebuilt (`python tools/build-deploy.py`; `src/config/cloud.js` excluded: per-environment) |
| env-config | yes* | `deploy/src/config/cloud.js` matches `.prod_config` (`tools/use-env.py prod --check`). *Warns instead of blocking when `.prod_config` is missing or still has placeholders |
| tests | yes | `python tests/run.py` exits 0 with no FAIL |

`--stamp` records HEAD plus a hash of `git diff HEAD` after a clean pass. The PreToolUse hook `commit_guard.py` denies `git commit` in the MyRosta repo unless the stamp matches the current diff and is under an hour old. Editing code after stamping invalidates it; re-run.

Adding a gate: write `gate_<name>(repo) -> list[str]` in `run_gates.py` (empty list = pass) and register it in `GATES`.
