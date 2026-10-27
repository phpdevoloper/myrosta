# How the seven app recordings were captured (6 October 2026)

Each take is a Playwright function run through the Playwright MCP's run-code tool against the demo sandbox served at
`http://localhost:8903/deploy/demo.html` (the repo root on the preview server). A capture loop takes a JPEG screenshot
every 80 ms (12.5 frames a second) while the take taps through the app; `mk.sh` turns a folder of frames into a 25 fps mp4.

- **Phone takes (R2, R4, R5, R7):** a separate browser context, viewport 390x844, device scale 3, `isMobile`. The sandbox
  state is carried in by writing `localStorage['myrosta_demo_v6']` (`myrosta_demo_v7` from 7 October, when the seed gained the department board) and calling the app's own `load(); render()` — never
  `addInitScript`, which re-runs on every reload and silently resets the state. A ripple div marks each tap.
- **Laptop takes (R3, R6):** viewport 1440x810 at device scale 4/3 (a 1920x1080 frame); a fake cursor div glides to each
  control before the click. R1 (the mock spreadsheet) and the end card are plain 1920x1080 pages in `docs/film/inserts/`.
- **State between takes:** read the phone context's localStorage and write it into the laptop context (or back) so the
  story continues: the bookings, the swap, the approval, the publish. A snapshot before each take allows a retake.
- **The sandbox:** reset by removing `myrosta_demo_v6` (`_v7` from 7 October) and reloading (the seed runs again); the hospital name is set with
  `S.branding.hospital = 'Wattle Hospital'; save(); render()`. Staff ids: demo-2 Sam Patel, demo-3 Emma Walsh,
  demo-4 Alex Campbell, admin = `S.viewAs = 'admin'`.

The selectors each take uses are in `takes.js`.
