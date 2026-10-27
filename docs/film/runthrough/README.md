# Myrosta run-through videos

First-person recordings of the app, chapter by chapter, made 7 October 2026 from the approved scripts in
[scripts-v1.md](scripts-v1.md): a film for staff, a film for admins (each in a rounds and a rolling version), a short
director's cut, and the module chapters a group may switch on (clock, call-ins, own hours, the department board; and
for admins the clock, on-call, tags and rules, own hours, the year-grid import). The finished files sit outside the
repo in `~/Desktop/Myrosta film/runthrough/` (films, chapters at 1080p and 720p, the staff chapters at 9:16, and
`index.html`, the chapter page). Nothing on screen is a real roster, person or hospital: every take is the Wattle
Hospital sandbox (`deploy/demo.html`), and the narrator is an AI voice (Soraya, ElevenLabs via Higgsfield) reading the
scripts, captioned word for word.

## How a chapter is made

1. **A take** is the sandbox driven by Playwright through `gen/lib.js` (installed as `.playwright-mcp/rt/lib.js` and
   run through the Playwright MCP's `browser_run_code_unsafe`): `rt.phone()` / `rt.laptop()` open a 390×844 phone at 3×
   or a 1440×810 laptop at 2× (2880×1620 frames, downscaled with Lanczos by `mk.sh … 1920`, so small text is supersampled
   rather than captured soft), `rt.open()` loads the demo with a fresh seed and any state the chapter needs (`prep`,
   `viewAs`, `tab`), `rt.tap()` taps with a ripple (a cursor glide on the laptop), `rt.zoom()` leans in on the control
   that matters, and `rt.rec()` captures 12.5 fps JPEG frames while `mark(label)` writes the step log. The recorder
   scripts, as last run, are in `gen/takes/` (one per take; `cards.js` draws the chapter cards).
2. **The log** (`gen/logs/<take>.json`) carries the step labels and their times; `vid/mk.sh` turns the frames into a
   25 fps clip.
3. **Retiming** (`gen/sync.py`, anchors in `gen/anchors.json`): each step label is tied to a phrase of the narration.
   The take is cut at its labels and each piece is held (40% on its first frame, while the narration introduces the
   step, 60% on its last, the result), or played up to 1.5× faster, so the next step appears when the narration reaches
   its phrase. Phrases are located through faster-whisper word timings of the
   narration (`gen/aud/words.json`), aligned to the written line so a misheard word does not matter.
4. **The chapter** (`gen/build.py`, specs in `gen/chapters.json`): a 2.4 s title card, an optional 3 s muted opener
   from the walkthrough film, the take on the phone plate (or full frame for the laptop, with the browser banner cropped)
   with its step labels drawn in the corner, the narration from the end of the card, music under it, captions from the
   word timings, a 720p copy, and for the staff chapters a 9:16 cut without the opener. A film is the concatenation of
   its chapters' captioned renders.
5. **QA** (`gen/qa.py`): a 4×3 contact sheet of twelve frames per chapter, read before delivery.

The assembler, caption tool and the audio helpers are the walkthrough film's, in `../gen/film/`
(`assemble.py`, `captions.py`, `words.py`).

## Lessons from the recordings

- The frame directory of a take must be clean before a re-take: a runaway capture once left 29 000 stale frames beside
  a 311-frame take, and the encoder read them all (a 4 min 43 s "chapter"). `sync.py` and `mk.sh` now read only the
  frames the log counts.
- A take that runs faster than its narration freezes on its last frame for the rest of the line; retiming at the step
  boundaries fixes every chapter at once without re-recording. Takes slower than the narration are compressed, never
  cut. `tpad` only pads a whole file in this ffmpeg build (after `trim`, or with `-t`, it adds nothing), hence the two
  passes per piece.
- The cover card saves any numbers, so a "refused save" is shown on the notice period instead (400 days is refused
  with an inline message).
- The on-call card's "Add a window" needs the card scrolled into view without smooth scrolling before the tap, or the
  tap lands elsewhere; the cell editor shows "Add a call-in" only once a chosen-when-booked window is saved.
- A native `confirm()` (the leave-planner import) is invisible to the recorder: accept it from a dialog handler and put
  its text in the step label.
- Setting a time input by value needs both `input` and `change` events; on the day sheet with own hours on, tap Done
  before Confirm.
- The sign-in take runs on a local copy of the app with only the `supabase.co` requests intercepted (not the CDN that
  serves the spreadsheet reader), a synthetic number, and the code answered by the recorder.
- The admin intro said "Nine minutes" for a film that runs under seven; a line's numbers are checked against the cut
  before delivery. The A3b line's sentence order was swapped to follow the screen (see the change log in the scripts).

## Where the videos live, and who sees them (8 October 2026)

The finished 720p files are not public. They go in a private Supabase Storage bucket, `videos`, on the app's project
(`videos-bucket.sql` in the delivery folder creates the bucket and the one policy: signed-in people may read; the owner
pastes it in the SQL editor and uploads `videos-upload/` through the dashboard). In the app, **Help → Watch how it
works** lists what fits the viewer, from the `VIDEOS` manifest in `app.html` (written by `gen/manifest.py`): staff get
the staff film in their group's roster mode and only the module chapters the group has switched on (clock, call-ins,
own hours, the department board); admins get the admin film and every admin module, marked on or off; portrait phones
get the 9:16 cuts. A tap fetches a one-hour signed link for that person (`openVideo` in `app.html`); the demo sandbox
shows nothing. `gen/stage-upload.sh` names the files as the manifest expects, and `gen/deploy-copies.py` writes the two
served copies of the app after a change. The four SWIFT guides point to the card ("Watch how it works") and were
re-exported to PDF.

## 9 October 2026 — rebuilt without burned-in captions

The owner found the caption band hiding the bottom of the app in every video, so the whole set was rebuilt with nothing
over the picture. Each video now has a WebVTT file beside it in the bucket (`<id>.vtt`, `<id>-9x16.vtt`) and the player
offers it through the CC button, off by default (`openVideo` adds a `<track kind="captions">`; the video is `crossorigin`
so the cross-origin file loads; the bucket accepts `text/vtt`, see `videos-bucket.sql`). The step labels in the corner
are now drawn by the assembler (`gen/assemble.py`, `steps` on a take segment, `pcrop` for the phone crop) instead of
riding on the caption pass; `gen/vtt.py` writes the cues with the clause-first chunking the burned captions had.

What survived and what did not: the session scratch folder that held the renders, clips and narration audio had been
cleared, and the frame folders of seven admin takes had been deleted earlier, so the rebuild works from a durable folder
beside the delivered films (`~/Desktop/Myrosta film/runthrough/work/`: `rt/` tooling, clips, logs and audio; `vid/`
renders; `bin/ffmpeg`, a static build from imageio-ffmpeg; `aud/music.m4a`). The narration audio is the delivered
chapters' own mix (narration and music together), extracted with the stream copied and placed at the chapter start, with
the word timings shifted by the old 2.2 s offset (`aud/words.json`; the originals in `words.orig.json`); chapters that
reuse it carry `reuse_audio`, `narr_offset 0`, `music 0`, `tail 0` in `chapters.json`. Every admin laptop take was
re-recorded on today's app (the month under every column of the grids), with the same scripts; the phone takes were
re-encoded from their frames (`gen/encode.py`, only the logged frames — a frame folder can hold a longer earlier run).

A new staff chapter, **S2c · Book as you tap: the first tap wins**, records the group switch that books a shift at the
first tap (take `takes/take-S2c.js`, narration in `aud/lines.json`, anchors in `anchors.json`, card from
`takes/cards-S2c.js`). The manifest row carries `feat: instant` and `replaces: S2a`, so staff in a group with the switch
on see it instead of the basket chapter; admins see both, the instant one marked off with a Switch on link. It is a
chapter only, not part of the films, and the note under Watch how it works says the film's basket does not apply.

Lessons: keep pipeline intermediates out of the session scratch folder; a frame folder's `log.json` is not written by
the recorder under the MCP (`require` is not available), so save the returned log by hand; iCloud resurrects deleted
frames and files as `name 2.ext` copies beside the new ones (the upload folder had 86 files, not 43); a recording must
not share the machine with an encode, or the 12.5 fps capture drifts; the phone's bottom bar is not the first
`[data-tab]` in the DOM (the hidden desktop strip is), the day sheet's halves are `[data-dsper]`, and a second booking in
the same fortnight can be refused by the share, so the take books the next fortnight.

Follow-up the same evening: the owner, an admin, opened the staff pack and still saw *The round opens: book your share* with the basket. The replacement now applies to admins as well once the switch is on, and the staff film has an instant variant (`films: staff-instant` in `chapters.json`, S2c in place of S2a; manifest row `feat: instant`, `replaces: staff`), so a rounds group that books at the first tap sees a film and a chapter that match. A rolling group with the switch on keeps the rolling film and the note under the videos.

## 10 October 2026 — four chapters for the day's features

A9 *Fixed patterns, and what they cover* (laptop: the editor's four recurrences and the Shift column, Save and Commit, then Roster → Fixed cover, the weekday summary and the drift; it joins both admin films before the end card), AM6 *Walk-in clocking* (laptop, prepared on a phone: a walk-in clocked in and out, then the Clock card's switch, Hours to approve with the walk-in flag, Approve), M5 *On a fixed pattern* (phone: a fixed shift's day sheet, the three choices zoomed, then the give-away and the note it leaves) and M6 *Clocking in when you're not rostered* (phone, geolocation granted and the clock pinned at 10:00: My shifts' walk-in button, the half and the zone, clocked in). Narration, anchors, cards and takes in `gen/`; the demo's reset state has no fixed-pattern people, so the takes set one up in `prep`. Lesson: the day sheet closes after a give-away, so a take that wants to show the sheet afterwards taps the day again.

## 12 October 2026 — book as you tap by default, and the zoom that greyed the booking take

The owner made book-as-you-tap the default for every group ("keep shifts confirmed as you select as default… prepare the
video to reflect this"). In the app `instantBookOn()` is now true unless the switch is stored as `false`, `videoFeats()`
reports `basket` instead of `instant`, and the manifest swaps the other way round: S2c and the `staff` film are what
everyone sees; S2a (`feat: basket, replaces: S2c`) and `staff-basket` (the row that was `staff-instant`) stand in only
where an admin keeps the basket on. `chapters.json` films: `staff` = S2c cut, `staff-basket` = S2a cut, `staff-rolling` = S2b.

The booking take looked "greyed out" because `rt.zoom` scaled `document.body`: a transformed ancestor displaces
`position: fixed` children, so the day sheet and the receipt bar left the frame and every zoom on them showed the dimmed
list behind. lib.js v5 zooms by taking a clip screenshot around the target instead (`rt.Z`, read by the frame loop;
Playwright's `clip` is viewport-relative; `scale: 'device'`), eased over 700 ms, with a target wider than the zoomed frame
anchored at its left edge. The frames then come in mixed sizes, so `encode.py --size 1170x2532` scales them back.

Re-recorded with it: S2a (basket), S2c (instant), S2b (rolling, now instant — new narration and anchors), M3 (own hours
under instant: a tap books with the type's hours, then Change hours → Save — new narration and anchors). Fresh narration
comes from `rt/narrate.py` (Higgsfield text2speech_v2, ElevenLabs, Soraya) and `words_rt.py`; the chapters' old reused
mixes moved to `rt/aud/old-reused/`. The takes find the first bookable day (`findDay`) instead of a fixed date, because
the demo's shifts move with today. The tooling lives in `~/Desktop/Myrosta film/runthrough/work/` and `rt/torepo.sh`
mirrors it here. A take file must be a bare `async (page) => {…}`: the MCP wraps it as `await (<file>)(page)`.

Upload (12 files, plus delete `staff-instant.mp4/.vtt`): S2a, S2b, S2c, M3 as `<id>.mp4/.vtt` and `<id>-9x16.mp4/.vtt`,
`staff.mp4/.vtt` (now the instant cut), `staff-basket.mp4/.vtt`, `staff-rolling.mp4/.vtt`.

**Same evening — stale padded copies.** The owner still saw grey frames in S2a and the staff film after uploading. `build.py`'s
`pad_clip` kept a padded copy of each retimed take (`<take>-sync-pad<NN>.mp4`) and reused it whenever a file of that name
existed, so a re-recorded take with the same retimed length inherited the old frames (S2a from the morning's broken take,
S2c from 9 October) while the fresh `-sync.mp4` went unused. The padded copy is now rebuilt when it is older than its take,
the stale copies were deleted, and S2a, S2c and the staff and staff-basket films were rebuilt. Check the delivered file's
frames after a re-record, not the raw clip, and look for cache files beside every stage: pads, pieces, `seg_*/NN.mov`.
