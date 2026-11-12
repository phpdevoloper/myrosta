---
name: myrosta-daily
description: Start-of-day and end-of-day routine for working on MyRosta with the AI-DLC. Use at the start or end of a work session, or via /myrosta-daily.
---

# Daily routine

**Start**
1. Read `.claude/myrousta-dlc/state/current-run.md` and `git status` / `git log -5 --oneline` in the MyRosta repo; summarise unfinished work.
2. Run the gates (`myrosta-gates`) to get a baseline. Report current failures so they are not blamed on today's work.
3. Propose today's 3 highest-value tasks (open items in CHANGELOG.md, failing gates, known defects) and ask which to run via `/myrosta-dlc`.

**End**
1. Make sure the working tree is committed or deliberately left; list anything uncommitted.
2. Update `current-run.md` with: done today, in flight, blocked, next first task.
3. Remind the user about anything committed but not pushed or not yet applied to Supabase.

**Known state (2026-10-30)**: `tests/run.py` runs on Windows under Node (each `src/` file as its own script). It should be fully green (tests/node-intl-shim.js aligns Node's date strings with the macOS reference; `pip install -r tools/requirements.txt` for openpyxl). Architecture migration status: `docs/ARCHITECTURE.md`.
