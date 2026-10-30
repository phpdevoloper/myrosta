# MyRosta architecture

MyRosta is moving to Clean Architecture in phases. This page describes the target layers, the rule that ties them together, and where the code stands today.

## Layers

```
src/
  config/          constants, icons, palette (defaults.js) and the Supabase CLOUD block (cloud.js)
  domain/          roster rules: shifts, dates, on-call, quota/fairness, marketplace, clocking, staff tags
  application/     use cases that combine rules with saving: booking rounds, requests, swaps, the board digest
  infrastructure/  the outside world: Supabase (cloud-store, org, events, auth), localStorage, web push, files (import/export, .ics)
  presentation/    screens and their wiring: shell (render, nav, modal), roster, setup, staff, my-shifts, leave, requests, ...
  main.js          wiring and boot (runs last)
```

**Dependency rule (target).** Code may only call down:

| Layer | May use |
|---|---|
| presentation | application, domain, config |
| application | domain, config; infrastructure through a port (a function or object passed in) |
| infrastructure | domain, config |
| domain | config only. No DOM, no Supabase, no `S` global: state is passed in |

## Where it stands (30 Oct 2026)

**Phase 1 is done.** The eight old files in `js/` were cut along their existing section headers into 55 files under `src/`. Only file boundaries changed. Every line moved byte for byte, and each file still runs as a classic browser script, sharing globals. Load order is the order of the `<script>` tags in `app.html`; **keep it**. A file whose top-level code needs a name from a later file at load time breaks, and the Node test runner reports it as `ERROR loading <file>`.

The folders show where code *belongs*, but the rule above is **not yet enforced**. Measured on 30 Oct 2026:
- 960 top-level names; about 2,000 cross-file references.
- About 100 distinct calls run upward from `domain/`: into presentation (`render`, `toast`, `escapeHTML`, `closeModal`, …), infrastructure (`cloudCommit`, `commitGuarded`, `featOn`, …) and application (`save`, `CTX`, `bookingGate`, …).
- 27 mutable globals are written from more than one file (`S`, `modal`, `_daySheet`, `_moreOpen`, …).

Several files still mix layers, and those are fixed feature by feature in Phase 2.

### Clocking: the first re-layered feature (30 Oct 2026)

| File | Layer | Holds |
|---|---|---|
| `domain/clocking/clock-rules.js` | domain | Pure rules: windows, `clockMay`, `clockProposal`, rounding, distance, `clockTapRecord` (records a tap, never saves), `clockRowsOf`, and the `…Of(state)` readers |
| `domain/clocking/own-hours.js` | domain | `hoursOK`, `hoursNorm`, `shiftWindow`, `windowStr`, `modalHours…` |
| `application/clocking/clocking.js` | application | Use cases: `clockTap`, `walkinStart`, `clockApprove`/`Decline`, the settings, `exportClockCSV`. Declares **`clockingPorts`** |
| `application/clocking/own-hours.js` | application | `hoursSet`, `hoursRefusal`, `hoursAudit`, `ownHoursSwitch` |
| `infrastructure/device/clock-device.js` | infrastructure | Geolocation, poster keys (`crypto`), the poster link, reading a scanned link |
| `presentation/clocking/clock-view.js`, `qr.js` | presentation | Every clocking card, row, sheet and the poster; the scanned-poster controller |
| `composition/clocking.js` | composition root | Fills `clockingPorts` (save, render, toast, locate, newKey, commit, shiftLabel, download) with thin lambdas, so a replaced `save` or `toast` is still the one called |

**This is the recipe for the next features:**
1. Pure rules take what they need as arguments: no `S`, no clock of their own.
2. Use cases call the outside world only through their feature's ports.
3. Views only build HTML.
4. The old global names stay as thin wrappers, so callers and `tests/suite.js` keep working.

The **`layers`** check in `tests/run.py` enforces the rule for every feature listed in its `LAYERED` table. On its first run it caught a direct `save()` the move had missed. `tests/suite.js` adds boundary tests: domain functions on a state they are handed, nothing saved by recording a tap, and settings saved through the port.

## Next phases

1. **Phase 2: fix the layering one feature at a time, still as plain scripts.** Clocking is done (above). Next: exports, leave, marketplace, on-call, staff, board, fairness, and the roster engine last. For each feature:
   - move HTML builders into `presentation/`;
   - make domain functions take `state` instead of reading `S`;
   - pass saving and notifying in as ports instead of calling `cloudCommit`, `render` or `toast` from domain.

   Each feature ships on its own, with the test suite green.
2. **Phase 3: ES modules and a bundle.** Once dependencies point down, each file gets `import`/`export` and a bundler (esbuild; needs Node 18+, this machine has 16) builds one file. Converting first would turn every upward call into an import cycle.
3. **Phase 4: enforce.** Add a lint that fails when `domain/` references a name from another layer. Retire the global names the tests still use.

## Web root, styles and images

Clean Architecture governs code dependencies, so the files below are placed by what they are and by URL:
- **The repo root is the web root.** `app.html`, `index.html`, `privacy.html`, `support.html`, `terms.html`, `thanks.html`, `manifest.json` and `sw.js` keep the paths they have on myrosta.com.au. QR posters, emails, search engines, the installed PWA and the push service worker (whose scope must be the site root) reach them by URL. They are the entry points, the outermost ring.
- **Styles are presentation:** `src/presentation/styles/` (`tokens.css` holds every colour and size token).
- **`img/`** holds only what the site serves. Brand source files are in `brand/`.
- **`deploy/` is build output.** `tools/build-deploy.py` copies every served file there (one list: `served_files()`), writes the production `cloud.js`, and builds the demo. The `deploy` test fails if `deploy/` differs from the source or holds a file with no source.

## Working rules
- **New code goes in the layer it belongs to**, even while older neighbours don't.
- **Adding a file:** add its `<script>` tag to `app.html` in the right load position, copy `app.html` to `deploy/`, and mirror the file to `deploy/src/`.
- **Single-file builds:** `tools/inline_app.py` inlines the app into one HTML file. `preview.html`, `deploy/demo.html` (`tools/build-demo.py`) and the staging copy (`tools/staging-app.py`) are all built from it.
- **Tests:** `python tests/run.py`. It uses `osascript` on macOS and Node elsewhere, and loads each `src/` file as its own script. On Node, six date-format checks fail: Node's locale data prints "Sept" where macOS prints "Sep". That is environmental.
