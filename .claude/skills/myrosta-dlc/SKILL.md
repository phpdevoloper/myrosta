---
name: myrosta-dlc
description: MyRosta AI-DLC orchestrator. Runs the full cycle for a feature, fix or task (plan, write, test, format, review, docs, release) by delegating to the myrosta-* agents with gates between stages. Use when asked to build/fix/change anything in the MyRosta repo, or via /myrosta-dlc <task>.
---

# MyRosta AI-DLC orchestrator

You (the main session) are the orchestrator. Subagents cannot spawn subagents, so you dispatch every stage yourself, read each report, and decide the next step. Task: `$ARGUMENTS` (if empty, ask what to build or run `myrosta-daily`).

Work only in the MyRosta repo (`c:\xampp\htdocs\myrosta-review-main`). Keep a short stage log in `.claude/myrousta-dlc/state/current-run.md` (task, stage, verdicts) so a new session can resume.

## Pipeline

| # | Stage | Agent | Gate to pass before moving on |
|---|-------|-------|-------------------------------|
| 1 | Plan | `myrosta-planner` | Acceptance criteria and file list exist; open questions resolved (ask the user only if truly blocking) |
| 2 | Data (if needed) | `myrosta-db` | SQL written to supabase/ only, rollback note present |
| 3 | Build | `myrosta-ui-writer` and/or `myrosta-code-writer` | `node --check` clean. Independent write sets may run in parallel; overlapping files run serially |
| 4 | Test | `myrosta-tester` | Gates `syntax`, `secrets`, `tokens`, `tests` pass. Report states honestly if `tests` cannot run |
| 5 | Format | `myrosta-formatter` | Diff is cosmetic only; gates still pass |
| 6 | Review | `myrosta-reviewer` | Verdict APPROVE |
| 7 | Docs | `myrosta-docs` | CHANGELOG entry present |
| 8 | Release | `myrosta-release` | Gates stamped, local commit made. Push only if the user said ship |

## Rules

- Give each agent a self-contained prompt: the task, plan excerpt, files, and what to report. They have no memory of this conversation.
- Failure loop: tester or reviewer failure goes back to the responsible writer with the exact evidence, then re-run stages 4 to 6. Maximum 3 loops, then stop and report what is blocked and why. Never weaken a test or skip a gate to get green.
- Trust but verify: after each writer finishes, check `git diff --stat` matches what they claimed.
- Stop and ask the user before: destructive git operations, anything touching production Supabase, pushing, or changes to the retained legal/privacy pages.
- Autonomy is full inside the pipeline. The commit hook (`commit_guard.py`) physically blocks commits that have not passed gates; do not route around it.
- Finish with a 5-line summary: what changed, gate results, commit hash, what is not verified, suggested next task.
