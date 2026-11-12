---
name: myrosta-conventions
description: Project knowledge for MyRosta (ED self-rostering PWA): layout, stack, design-token rules, test and deploy facts. Loaded by the myrosta-* agents before they touch code.
---

# MyRosta facts

- **What**: PWA for Emergency Department roster self-booking. Live at myrosta.com.au, in daily use; real staff data lives in Supabase (never in the repo).
- **Stack**: vanilla JS (no framework, no bundler; classic scripts sharing globals, loaded in `app.html` order), Supabase JS v2, SheetJS (xlsx), Google Fonts. Static hosting; `python tools/serve.py` serves locally (port 4173).
- **Layout**: the root is the web root: entry pages at their live URLs (`app.html`, `index.html`, privacy/support/terms/thanks, `manifest.json`, `sw.js`), `img/` (served images only), `preview.html` plus `README.md`, `CHANGELOG.md` and the env templates (`.dev_config.example`, `.prod_config.example`). `src/` in Clean Architecture layers (`config/`, `domain/<feature>/`, `application/<feature>/`, `infrastructure/{supabase,local,push,files}/`, `presentation/<feature>/`, `composition/` (fills each re-layered feature's ports, loaded before `main.js`), `main.js`; rules and current status in `docs/ARCHITECTURE.md`), styles in `src/presentation/styles/` (tokens, components, roster, responsive), `brand/` (design source, not served), `deploy/` (BUILD OUTPUT: `python tools/build-deploy.py`; never hand-edit), `supabase/` (prod-*/staging-* SQL, `functions/`), `tests/`, `tools/` (Python sims, builders, serve.py), `media/` (the refined demo and training videos only).
- **Docs** (`docs/`): `guides/` (admin, staff, user, FAQ md), `deployment/` (DEPLOY, GO-LIVE, cutover runbook), `backend/` (SUPABASE*, push, notifications), `strategy/` (MYROSTA-* plans), `comms/` (emails, announcements, scripts), `operations/` (incident reports, staging runbook, technical brief). `docs/README.md` indexes every file: put new docs in the matching folder and add a line there. Film assets, Office exports and old build plans were removed on 30 Oct 2026 (in git history at `64445e3`); `docs/superpowers/...` paths in code comments point there.
- **Design system**: tokens in `src/presentation/styles/tokens.css`; no hex outside it (except #fff/#000); `--fs-*` font scale; SVG icons, no emoji in chrome; `.tag` replaces retired label classes; AM blue / PM amber / CST green period colours.
- **Roles/views**: Admin, Staff, Director. Roster modes: Rounds and Rolling. Fairness: snake and others. Leave codes in `src/config/defaults.js`; Supabase project in `src/config/cloud.js` (written by `tools/use-env.py`).
- **Tests**: `tests/suite.js` (assertions, `T(name, cond)`), `tests/stubs.js` (DOM stubs), `tests/oncall-golden.js`, `tests/run.py`. Runner is macOS-only and expects an inline script in app.html; currently stale after the js/ split (known defect).
- **Environment**: Windows 11, PowerShell/Git Bash, Node 16, `python` (not `python3`). TZ for rostering: Australia/Melbourne.
- **Git**: branch `main`, remote origin (GitHub). Commit locally freely; push only on explicit ship.
- **Privacy**: names, mobiles and leave are personal information; fixtures must be de-identified (`tools/deidentify.py`).
