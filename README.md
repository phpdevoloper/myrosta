# MyRosta

Self-rostering web app for hospital emergency departments. Staff book their own shifts, swaps and leave from their phones; the rota lead approves and publishes. Live at **myrosta.com.au** and in daily use.

**Stack:** plain JavaScript (no framework, no bundler), Supabase (auth, Postgres, realtime, edge functions), SheetJS for Excel import/export. Static hosting on Netlify. Installable as a PWA.

---

## Quick start

```
pip install -r tools/requirements.txt   # Python helpers (openpyxl)
python tools/serve.py                   # http://localhost:4173/app.html
python tests/run.py                     # the full test suite (needs Node on Windows/Linux)
```

- `app.html`: the app (talks to the Supabase project in `src/config/cloud.js`).
- `preview.html`: the same app in local-only mode, with data kept in the browser. No sign-in is needed.
- `index.html`: the landing page.

---

## Project structure

```
myrosta/
├── app.html  index.html            ← web entry points: the repo root IS the web root,
├── privacy.html  support.html        so every page keeps its live URL
├── terms.html  thanks.html
├── manifest.json  sw.js            ← PWA manifest and push service worker
├── img/                            ← images the site serves (icons, social preview, landing/ screenshots)
│
├── src/                            ← all app code, in Clean Architecture layers
│   ├── config/                     constants, icons, palette; cloud.js = the Supabase project
│   ├── domain/<feature>/           pure roster rules
│   ├── application/<feature>/      use cases: apply rules, save, notify
│   ├── infrastructure/             Supabase, localStorage, web push, files (import/export, .ics), device
│   ├── presentation/<feature>/     screens and wiring; styles/ holds the CSS
│   ├── composition/                fills each feature's ports
│   └── main.js                     boot (runs last)
│
├── deploy/                         ← BUILD OUTPUT served by Netlify. Never edit by hand.
├── preview.html                    ← generated: the app in one file, local-only
├── supabase/                       SQL migrations (prod-*, staging-*) and edge functions
├── tests/                          test runner, suite, stubs
├── tools/                          build, deploy, config and simulation scripts
├── brand/                          logo, mark, QR, quick-start sheet (design source, not served)
├── media/                          demo and training videos
└── docs/                           all documentation (start at docs/README.md)
```

---

## Architecture

The code follows Clean Architecture. Dependencies point inward:

| Layer | May use |
|---|---|
| `presentation` | application, domain, config |
| `application` | domain, config; the outside world only through its feature's **ports** |
| `infrastructure` | domain, config |
| `domain` | config only: no `S` global, no DOM, no saving; state is passed in |

The files are classic browser scripts that share globals. **Load order is the order of the `<script>` tags in `app.html`.**

The migration is happening feature by feature. **Clocking** is done and is the model to copy, and the `layers` test enforces the rule for it. The other features have their folders but still mix layers.

The full picture, the measured debt and the recipe for the next feature are in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

**Where new code goes:**

| You are adding… | Put it in |
|---|---|
| A roster rule or calculation | `src/domain/<feature>/` (pure: take state as arguments) |
| An action that changes and saves data | `src/application/<feature>/` (save through ports) |
| Supabase, storage, files, device APIs | `src/infrastructure/` |
| A screen, card, sheet or its event wiring | `src/presentation/<feature>/` |
| Styles | `src/presentation/styles/` (colours and sizes only as tokens in `tokens.css`) |
| A new page with a public URL | the repo root |

A new `.js` file also needs a `<script>` tag in `app.html`, in the right load position.

---

## Configuration: dev vs production

The Supabase project is baked into `src/config/cloud.js`. Two gitignored files hold the values:

```
cp .dev_config.example  .dev_config     # fill in: project URL, anon key, admin emails, VAPID key …
cp .prod_config.example .prod_config    # same keys, production project
python tools/use-env.py dev             # point src/config/cloud.js at dev
python tools/use-env.py dev --check     # exit 1 if it doesn't match .dev_config
```

Each key is explained inline in the example files. Only ever use the **anon** key, never the service key.

---

## Testing

```
python tests/run.py
```

- About 1,230 checks: the roster engine (`tests/suite.js`), the on-call golden output, both edge functions, and lints for CSS tokens, accessibility, the landing page, the deploy copy, the `?v=` stamp and the layer rule.
- On macOS it runs under JavaScriptCore. Elsewhere it runs under Node, loading each `src/` file as its own script as a browser does. `tests/node-intl-shim.js` aligns Node's date formatting with the macOS reference.
- Quality gates (run before every commit; the commit hook checks they passed):
  ```
  python .claude/myrousta-dlc/gates/run_gates.py --repo . --stamp
  ```

---

## Deploying

```
python tools/build-deploy.py
```

This one command:
- stamps `app.html`'s tags with `?v=<code hash>`, so phones notice the new build;
- rebuilds `preview.html`;
- rewrites `deploy/` from the source tree, with the production `cloud.js` from `.prod_config`;
- builds `deploy/demo.html`.

It refuses while `.prod_config` has placeholders. `--allow-dev` builds against the dev project, for local checks only.

For an app release, bump `BUILD` in `src/infrastructure/local/persistence.js` to the date of the newest `CHANGELOG.md` heading.

The full checklist is in **[docs/deployment/DEPLOY.md](docs/deployment/DEPLOY.md)**.

---

## Useful tools

| Script | What it does |
|---|---|
| `tools/serve.py` | Local web server on port 4173 |
| `tools/build-deploy.py` | Builds `deploy/` (see above) |
| `tools/use-env.py` | Switches `src/config/cloud.js` between dev and prod |
| `tools/stamp.py` | Stamps `app.html` with the code hash (`--check` to verify) |
| `tools/inline_app.py` | Inlines the app into one HTML file |
| `tools/build-demo.py` | The public demo sandbox (`deploy/demo.html`) |
| `tools/staging-app.py` | A copy of the app pointed at a staging project |
| `tools/group-files.py` | Turns a manager's roster workbook into Myrosta's import files |
| `tools/deidentify.py` | De-identified copy of production data for staging |
| `tools/roster-sim.py`, `leave-sim.py`, `storm.py` | Simulations and load tests |

---

## Documentation

- [docs/README.md](docs/README.md): index of every document
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): code structure and layer rules
- [docs/deployment/DEPLOY.md](docs/deployment/DEPLOY.md): hosting, environments, shipping
- [docs/backend/SUPABASE.md](docs/backend/SUPABASE.md): database, auth, realtime
- [docs/guides/](docs/guides/): admin, staff and user guides, FAQ
- [CHANGELOG.md](CHANGELOG.md): what changed, newest first
