# Myrosta film — what exists and where (7 October 2026)

Setting (approved 6 October, evening): a large, busy metropolitan tertiary hospital in an Australian capital city — a coloured-panel tower with sun louvres, chequered ambulances with no lettering, jacaranda and eucalyptus, a city skyline, terraces and Federation houses around it. The home scenes are unchanged.

The walkthrough film was built in stages: script, then twelve stills as the approval gate, then the moving version. This folder holds the written parts, the storyboard, the generation prompts and the assembly tooling; the heavy files live outside the repo.

## The film (built 6 October 2026)

| Version | Length | Where |
|---|---|---|
| Master, 1080p | about 3 min 17 s | `~/Desktop/Myrosta film/film/myrosta-film-master-1080p.mp4` (and a 720p web copy beside it) |
| 92-second cut, with and without captions | about 1 min 32 s | same folder |
| Short cut, with and without captions | 42 s |
| Staff cut, 9:16, captioned | 38 s | same folder; a 720p copy plays on the storyboard page |

A leave beat was added on 7 October after the swap approval: Emma requests the school holidays from her phone and the rota lead approves from the card that shows the days taken this year, this request in days and hours, who else is away against the cap (recording R8, narration line N3b; the 85-second cut uses the shorter N3bs).

Re-cut on 7 October, the staff-first version, after the owner's critique that the story opened on the admin's difficulty and should solve the problem for both sides. Seven changes, all in `gen/film/mk_timelines.py` (which writes the three 16:9 timelines from the 6 October ones): (1) the "before" section now runs fridge first, then Sam's night, and names both pains in one breath (N1a "Until this cycle, Emma's week was whatever landed on the fridge." over frame 2, N1b "And Sam's Sunday nights were a spreadsheet nobody else could open." over frame 1 and the mock spreadsheet, which is cut from 12.5 s to 7 s); (2) the master opens cold on the handover, every phone buzzing at once, with N0 "Monday, five past eight. The roster just landed on every phone in the department.", and the booking narration becomes N2v2 "Now you pick your shifts…" over the café; (3) N3r "Staff choose. The rota lead still decides." sits over the approval; (4) the leave line ends "Emma knows before lunch." (N3bv2 in the master, N3bsv2 in the 92 s cut; the leave insert is held 1.6 s longer on its last frame to clear Morgan's line); (5) a bookend for Emma, frame 13: the same kitchen the next Monday, the fridge bare except a child's drawing, her daughter off camera asking "Mum, Saturday?" and Emma answering "It's in the calendar, love." as she pockets the phone and picks up her keys (still from `gen/prompts.json` frame 13 with Emma's portrait and frame 2 as references; the first result put the hospital outside her window, fixed with one nano_banana_pro edit; Veo 3.1 clip, 5.0 s used, placed before the walk-in; the reminder line N5a moves to +9.2 s inside R7, which runs 13.0 s, because the daughter's line opens the clip); (6) a 16:9 hook card opens the master (`inserts/hook-card-16x9.html`: "Your shifts. Your choice. Minutes, not nights.", 2.4 s); (7) the swap approval plays as two phones on one plate, Emma's on the left holding "Accepted, it has gone to your admin" until Sam's on the right approves, then showing her shifts (`gen/film/backdrop2.py` draws the plate with the two labels above the phones, clear of the caption band; `R5L.mp4` is R4's last frame held 2.6 s followed by R5 from 3.8 s, built with ffmpeg concat; the assembler's new `phone2` segment kind takes `src`/`in`/`end` for the right phone and `src2`/`in2`/`start2` for the left). The 85 s cut became the 92 s cut (hook, cold open, flashback, café, swap, two phones, leave, close) and the 42 s cut now opens on the hook card and the handover instead of the spreadsheet, with its last narration line moved onto the end card so it no longer starts under Sam's "Approved". Seven narration lines re-recorded with Soraya (about 2 credits), one still, one edit and one Veo clip (about 36 credits). Verified as before: every piece frame-exact, sync within 7 ms at every spoken clip, no narration over a line, Emma's mouth in the bookend opening 170 ms before her voice.

Lip-sync review (7 October, evening, owner: "review lip syncs and fix any errors"): measured end to end in the delivered files, in two layers. Assembly: `avcheck.py` against every spoken clip in the 720p master, both captioned cuts (1080p and 720p) and the staff cut reads +3 to +7 ms everywhere, so the pipeline adds nothing. The clips themselves: `lipline.py` (new) finds every face in a line's window, tracks mouth opening on each, keeps the face whose mouth moves most, and correlates mouth-opening onsets with the voice band; it also writes a 24 fps mouth strip for the eye, because the numbers alone mislead (a breath, a smile or a grin opens the mouth without speech, and two faces in one frame can swap). Verdicts: F01, F02, F05, F06, F08, F09, F11 and F13 are in sync (peaks within about 40 ms; the first-opening leads of 100–200 ms on F05, F06 and F09 are the jaw opening before an unvoiced consonant or an exhale, not an offset; F13's line is spoken turned to the doorway, the lips barely in view). Two clips were wrong in a different way: Emma's café line (frame 4) was spoken over a closed-lip smile, no articulation at all, and Sam's reply in the office (frame 10) was a grin rather than speech. Frame 4 was re-generated with the line said aloud (take 2: clear articulation, the voice leading the lips by about 80 ms, so the timelines delay that clip's audio 0.06 s and the booking narration moves to +4.4 s); the old take is kept as `work/clips/F04-take1-closed-lips.mp4`. Frame 10 was re-generated too: a long two-line prompt failed on Veo, a shorter one passed (take 3: Morgan's line and Sam's both articulated, each voice leading the lips by 40–80 ms, so that clip's audio is delayed 0.05 s and the director narration moves to +5.75 s to clear Sam's "One heading"); the grinning take is kept as `work/clips/F10-take1-grin.mp4`, and a Kling take of the same prompt as `work/clips/F10-takeK.mp4`. Also fixed in passing: the assembler trimmed a clip's video at its in-point but not its audio (no spoken clip used an in-point, so nothing shipped with it).

The staff cut is the version for staff to share: a two-second hook card ("Your shifts. Your choice. Your calendar."), the café booking, the month view and Add to calendar (R2b, added 6 October), the call, the swap on the phone, the published-roster notification with "a text before your shift", and a vertical end card with one call to action. It is 9:16 and uses only phone inserts and character frames, so nothing is lost in the crop.

How it was made: each keyframe animated with Google Veo 3.1 from its still (6–8 s, 1080p, with its own sound: the characters' lines are spoken on camera and were checked by transcription); the seven app inserts are real recordings of the demo sandbox (`gen/film/record/`); the narration is a stock AI voice from Higgsfield's library (the "Soraya" preset, chosen for its Australian accent); the music bed is generated; the edit is `gen/film/assemble.py` driven by `gen/film/timeline-*.json` (clip order, trims, narration placement, music level). Spend for the moving version: about 330 credits.

Narrator: Higgsfield's preset library carries no accent labels and rejects public ElevenLabs ids, so every female preset was sampled on one sentence and ranked with an accent classifier (`gen/film/accent.py`, SpeechBrain CommonAccent); "Soraya" was the only preset whose top class was Australian, and the master uses her. To change the voice run `python3 narration.py <name>` then re-run `assemble.py`. Still the owner's call: burned-in captions for the social versions, 9:16 crops (the laptop inserts do not survive a centre crop; the phone inserts do), and the Whole department beat (not in the single-group sandbox; the narration carries it).

## The cast (recast 6 October 2026, evening)

| Character | Who | Reference portrait |
|---|---|---|
| Dr Emma Walsh (was Amara Okafor) | the staff doctor, 36, Australian, dark blonde ponytail | portraits/emma.png |
| Dr Sam Patel | the rota lead, now 40 and younger-looking, short beard, no glasses | portraits/sam.png |
| Dr Morgan O'Brien | the director, now a 52-year-old Anglo-Australian man | portraits/morgan.png |
| Dr Alex Campbell (was Alex Chen) | Afro-Caribbean, Jamaican heritage, glasses | portraits/alex.png |

The owner approved these four faces after one re-roll round. The renames reach the app recordings at run time only: the demo sandbox's seed still says Amara Okafor and Alex Chen, and `gen/film/record/takes.js` replaces the names in the saved state before each take. The first cast's material is kept in `cast1/` folders beside the new files.

## In this folder

- `myrosta-film-script-v1.md` — the approved script: six scenes, a 2:30 master with 60–90 s and 30 s cutdowns, the seven real recordings R1–R7, the twelve-frame storyboard.
- `higgsfield-prompt-pack-v1.md` — style and negative blocks, the Soul ID plan, ten locations, a keyframe prompt, a motion prompt and the lines for each frame, the assembly table, narrator direction and the pre-publish checklist.
- `screen-recordings.md` — click by click, the seven real app recordings.
- `storyboard/` — the storyboard page as published (`index.html` + `img/`): the twelve keyframes F01–F12 (1600 px wide JPEGs), the three character portraits, the thirteen real app stills R2–R7, and (on the Artifact only, too big for git) the 35-second cut.
- `inserts/` — `r1-mock-spreadsheet.html` (the unreadable spreadsheet for R1) and `end-card.html` (the end card), both captured at 1920x1080.
- `gen/` — `prompts.json` (the exact still prompts), `frames.py` (re-roll frames), `finish.py` (the storyboard JPEGs).
- `gen/film/` — the moving version: `motion.json` (each frame's motion prompt and spoken line), `clips.py` (image-to-video through the Higgsfield CLI), `narration.py` + `narration-lines.json`, `assemble.py` + the three `timeline-*.json`, `mk.sh` (captured frames → mp4), `stt.py`/`stt2.py` (local transcription to check the spoken lines and their timing), `backdrop.py` (the phone plate), `record/` (how the seven app takes were captured, every selector).

## Outside the repo (too big for git)

`~/Desktop/Myrosta film/` — `frames-2k/` (the 2k keyframes), `portraits/` (the character references every frame was generated from), `film/` (the renders) and `work/` (everything the renders are made from: the twelve Veo clips, the seven recordings as mp4, the narration and music, the end card, the timelines). To re-cut: copy `gen/film/` beside `work/`'s contents and run `python3 assemble.py timeline-master.json out.mp4` with the ffmpeg path in `ffmpeg.path` (from `uv run --with imageio-ffmpeg python -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"`).

## The shareable page

Storyboard: https://claude.ai/artifact/8B59PGEmuHe3YWUT8qT9r8 — a private Artifact; share it from the page's Share menu. Cast, the twelve frames with their narration and lines, the app inserts beside the frames they belong to.

## How the frames were made

With the Higgsfield CLI (`higgsfield`, signed in as the owner; the same route the Bedsidely film uses). Portraits: `soul_cinematic`, 3:4, 2k. Frames: `nano_banana_pro`, 16:9, 2k, the portrait(s) passed as `--image` references, prompt = the frame prompt + the style block (+ the screens block when a screen is in shot) + the negative block. Four frames were cleaned with an edit pass (same model, the frame as the reference, "edit this photograph and keep everything else exactly as it is"): F01 a laptop logo, F02 the fridge sheet made illegible, F03 the whiteboard made illegible, F04 a street sign with a hospital name removed. One portrait was cleaned the same way (printed apparel text). Two frames tripped the content filter on the first wording and were re-rolled with plainer prompts. Spend: about 35 credits.

Re-roll one frame: `python3 docs/film/gen/frames.py 7`, then `python3 docs/film/gen/finish.py`, check the new JPEG, then republish `storyboard/index.html` with `img/` as its files to the Artifact above.

Lip sync: the first renders drifted (the sound ran up to 0.7 s ahead by the end) because each piece's video came out a frame or two shorter than its audio after the 25 fps conversion and the joiner held a frame at every cut. `assemble.py` now cuts every piece to an exact N frames of video and N × 1920 samples of audio (the video padded by cloning its last frame), carries uncompressed audio between the pieces, and no longer uses the sidechain compressor; `render_all.sh` renders the three cuts and measures the offset at several points with `avcheck.py` (clip audio cross-correlated against the master). The delivered cuts measure a constant 5 ms, the limiter's lookahead.

Captions: the two social cuts also exist as captioned versions (`-captioned` files beside them). `gen/film/words.py` takes word-level timestamps of each narration line (faster-whisper); `gen/film/captions.py` turns the narration text and the characters' known lines into an ASS caption track (lower third, at most two lines, narration in bold white and the spoken lines in italic on a teal-black box, Helvetica Neue from the system fonts) and burns it in with ffmpeg's libass. Re-run after any re-cut: `python3 captions.py timeline-cut75.json myrosta-film-cut75-1080p.mp4 seg_starts_cut75.json render_myrosta-film-cut75-1080p.log myrosta-film-cut75-1080p-captioned.mp4`.

Audio pass (6 October, late): the assembler now runs at the clips' native 24 fps (the earlier 25 fps conversion duplicated a frame every second, which read as judder on fast motion such as the ball in the garden); each clip's own sound gets 150 ms fades so cuts between ambience and silence never jolt; the music bed is 3 min 15 s (the first bed was 2 min 38 s and looped with a hard restart inside the master) and ducks under narration and dialogue so it can sit higher in the gaps; the final limiter is a true limiter at −0.9 dBFS with no auto-level (the earlier mix decoded with peaks above full scale); the opening narration starts half a second earlier so it clears Emma's fridge line. Lip sync is measured two ways: `avcheck.py` (the master's audio against each clip's own audio, to catch assembly drift) and `lipcheck.py` (mouth opening from face landmarks against the speech envelope inside each clip, to catch a clip whose own audio leads or lags its lips); a clip that measures off gets an `ashift` in its timeline entry. Measured 6 October on the Australian-set clips, twice over: a first pass that cross-correlated raw loudness against mouth opening suggested the corridor, office, car-park and garden lines were 200–350 ms off, but a second pass that prints the two series side by side (`liponset.py`: mouth opening against voice-band energy, 300–3400 Hz, with the face cropped where it is small or turned) showed every line in sync within about 40 ms; the first readings were driven by grins and by ambience (a trolley, a bike) rather than speech. No per-clip shift is applied. The lesson: a correlation below about 0.5 on this measure is not evidence, and a face that is smiling or looking down needs a crop and the printed series, not the summary number.

The garden shot (frame 11) was re-staged on 6 October, twice. The first animation had Sam trapping a kicked ball and turning the phone over in six seconds, which read as jerky. The second staging (Veo, take C) was one continuous take with the boy's back to camera, but the phone in Sam's hand vanished at about three seconds, and Veo then cut mid-shot or turned the boy's face to camera in three re-rolls and failed or blocked ("nsfw", on a man and a boy in a garden) six attempts in a row; the takes are in `work/clips/f11-takes/`. The shot in the master is a Kling 3.0 take from the same still and prompt (`work/clips/F11-kling.mp4`, 8 s): one continuous shot, the boy with his back to camera, Sam tosses him the ball, says the line at 5.4–7.7 s, and the phone lies face down on the table the whole time, untouched, which is the point of the beat. Mouth and voice line up within a few hundredths of a second (`liponset.py` with `CROP=700:560:1000:0`). Two lessons: "one single continuous shot, no cuts" belongs in every motion prompt, and when Veo keeps refusing a scene with a child in it, Kling takes the same still without complaint.

## Rules the frames keep

No AI-drawn app screens (every screen in a frame is a glow or a blur; the real UI only ever comes from the recordings). Nothing readable in a generated frame. No real names, logos or hospitals (the fictional Wattle Hospital, synthetic faces). The narrator is an AI voice, never a cloned or real one. A disclosure end card.

## What remains

1. Watch the master and decide the narrator voice; regenerate with another preset if wanted (one command, a few credits) and re-run the assembly.
2. Captions for the social versions and the 9:16 crops, if they are wanted.
3. The pack's pre-publish checklist (section 6) before the film goes outside the pilot sites.

## Master v3 (12 October 2026)

The owner asked for a more energetic, positive master, a booking walkthrough that is not greyed out, and an ending that
lands for staff, admin and director alike. `film/myrosta-film-master-v3-1080p.mp4` (3:16) and `-720p.mp4`; the 7 October
master stays beside them. All fourteen narration lines were re-read (ElevenLabs v4 through Higgsfield, stability 0.35,
Soraya) to a punchier script and a brighter 200 s music bed; the finished inserts were cut out of the v2 master
(`work/v3/seg_*.mp4`) and reused; the booking insert was re-recorded in the book-as-you-tap flow with the clip zoom
(`clips/R2-v3.mp4`, in 1.0 dur 12.6); the ending runs r7 → Emma at the fridge ("Emma's Saturday is in the family calendar.
She chose it.") → Sam in the garden ("Sam's Sunday nights are his again.") → the director ("And the director sees the whole
department on one screen. Fair, and written down.") → the dawn walk-in with the closing line → end card. Pipeline:
`~/Desktop/Myrosta film/work/` (assemble.py, timeline-master-v3.json, audio/v3/).

## The vertical staff cut, v3 (12 October 2026)

For WhatsApp and phones held upright: `film/myrosta-film-staff-9x16-v3.mp4` (1080×1920, 1:45), a `-captioned`
copy with burned lower-third captions for muted viewing, and `-whatsapp` copies at 720×1280 sized to send as a normal
WhatsApp video. Timeline `work/timeline-staff-9x16-v3.json`: the hook card, the corridor and Emma's text, booking as
you tap, the calendar, the swap (Emma asks the group, Alex offers, she accepts), the leave request and its approval,
then Emma at the fridge, Sam in the garden, the director, the dawn walk-in and a staff end card (name, address, tagline), with the v3 voice and music. Two lines are the staff cut's own, voiced the same way (`work/narrate_v4.py`): the booking line (book from wherever you are, no hospital login, no hunting for the spreadsheet) and the close (you choose when you work, not have it chosen for you).
The people shots are the 16:9 clips cropped to the person (`cx`); the phone inserts were re-recorded at phone size with
the run-through recorder (`takes/take-R2b-v3.js`, `take-R4-v3.js`, `take-R8-v3.js` beside the run-through takes),
because the finished 16:9 inserts hold the phone at 468 px and would not survive the enlargement. The spreadsheet, the
director's grid and the two-phone approval are wide by nature and are left out. Captions: `work/captions_v3.py`
(the v3 narration files, segment starts read from the assembler's log).

## The run-through videos (7–8 October 2026)

Separate from the walkthrough film: first-person recordings of the app, chapter by chapter, for staff, admins and directors, with the module chapters a group may switch on. Scripts, the recorder, the retiming tool and the chapter builder are in [runthrough/](runthrough/README.md); the finished films and the chapter page sit beside this film's deliverables in `~/Desktop/Myrosta film/runthrough/`.

Month view re-capture (8 October): the app's month view gained one-line chips with the zone's short name, so R2b (Emma's month view and Add to calendar) was recorded again and the master and the staff 9:16 cut re-rendered from the same timelines; the previous renders are in `film/before-month-view/`. The other recordings show no screen that changed.

Grid lines and the three cups (8 October, owner: "at 1:00 the tab lines inconsistent, at 2:10 three coffee cups, fix wherever similar"): the roster grid's columns were auto-sized, so R3's lines jumped as cells filled; the app now fixes the columns (72 px a day) and R3 was re-captured, as were the four run-through takes where the grid changes mid-take (A3a, A3b, AM2, AM4). The office clip (F10) ended with Sam back at the door holding two cups while one stayed on the desk; it was regenerated with the coffees kept in hand (two takes, 64 credits), and the take that sets both cups down and articulates the line (correlation 0.68 against the voice band) replaced it, with its audio delayed 0.07 s. Every other generated clip was checked frame by frame and holds its props and people. Previous renders in `film/before-grid-and-cups/`.

Grid lines, second pass (8 October, owner: "still the grid needs refining?"): at full size the re-rendered master was even, but the grid's 8% hairlines vanish unevenly when a player scales 1080p down, so the app now draws the roster grid's lines at the name column's 16% (commit c259078) and every laptop take that shows the grid was recorded again: R3 in the film, and A0b, A3a, A3b, A6, AM1, AM2 and AM4 in the run-throughs. Previous master in `film/before-grid-lines/`.
