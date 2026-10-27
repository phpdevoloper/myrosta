# Myrosta film — Higgsfield prompt pack v1

*6 October 2026. Built from `myrosta-film-script-v1.md` (approved 6 October). Every generated shot is
people and place only. Every app screen is a real recording of the demo sandbox, cut in during the
edit; the recordings are named by their file in `screen-recordings.md`. Stills first: the twelve
storyboard keyframes are generated and reviewed before any video is animated.*

## How to use this pack

1. **Characters first.** For Emma, Sam and Alex, generate the five reference stills in section 2 with
   Higgsfield's image model, keep the five that look most like the same person, and train a **Soul ID**
   from them. Name each Soul ID exactly as below. Morgan appears in one frame and needs none.
2. **Locations next.** Generate one still per location in section 3 and use it as the reference or
   start image for every frame in that place, so the corridor is the same corridor each time.
3. **The storyboard: twelve keyframes.** For each frame in section 4, generate the **keyframe image**
   with the right Soul ID selected. Review the twelve as a set before going further: same faces, same
   light, nothing readable, nothing real.
4. **The film: motion.** Animate each approved keyframe with its **motion prompt** (image to video).
   Generate 5 or 10 seconds and trim in the edit.
5. **Dialogue: pick one route per line.**
   - *Generated speech:* a model that lip-syncs in the same render (Seedance 2.0, or Kling 3.0 with
     Voice Binding to keep one voice per character). Paste the line exactly. Three takes, keep the
     cleanest.
   - *Recorded speech:* record the line (an actor, or Higgsfield Audio text to speech with an
     Australian voice), generate the shot silent, apply it in LipSync Studio.
6. **Narration is an AI voice**, generated separately and laid over the edit; direction in section 5a.
7. **Edit** in the order in section 5, cutting the real screen recordings in full-frame with a thin
   phone outline. Trims and what to show from each recording are in `screen-recordings.md`.

Model names follow what Higgsfield currently advertises; use whatever your plan offers. Keep every
frame 16:9 with the subject in the centre third, so the 9:16 crop works.

## 1. Paste into every prompt

**Style block** (append to every image and video prompt):
```
Cinematic 35mm film look, a large, busy metropolitan tertiary hospital in an Australian capital city
(a modern public-hospital tower with coloured façade panels and sun-shading louvres, a glazed atrium, an
ambulance bay with yellow-and-white chequered ambulances with no lettering, wide bright corridors with
staff in navy and teal scrubs, trolleys, nurses' stations with banks of monitors, an Australian city
skyline, eucalyptus and jacaranda in October bloom beyond the windows, hard bright sunlight and a deep
blue sky) and the Federation houses, terraces and inner-city streets around it,
naturalistic and warm. Natural daylight through windows by day; low-key practical lighting at night,
one lamp, screen glow, no harsh fluorescents. Teal and warm-white accents, nothing neon.
Shallow depth of field, soft highlights, subtle film grain, true skin tones, photorealistic.
16:9 frame with the subject in the centre third.
```

**Negative block** (paste into the negative prompt field where there is one):
```
text, captions, readable words, logos, brand names, hospital names, school names, government
insignia, patches, readable screens, readable spreadsheets, readable monitor numbers, watermarks,
distorted hands, extra fingers, warped faces, identifiable patient face, blood, cartoon,
oversaturated colour, stock-photo smiles
```

**Screens rule** (add whenever a phone or laptop is visible):
```
The phone or laptop screen faces away from camera or shows only a soft white glow on the face.
No readable interface on any screen.
```

## 2. Characters (one reference portrait each; a Soul ID can be trained from them later)

Recast 6 October 2026. The reference portraits are `~/Desktop/Myrosta film/portraits/` (emma.png, sam.png,
morgan.png, alex.png) and every frame was generated with the right ones attached.

### Emma — "Emma Walsh"
Emergency consultant, 36, the staff member. Three lines.
```
Portrait photograph of an Australian woman aged 36, Caucasian, dark blonde hair in a loose low
ponytail, blue-grey eyes, light freckles, a natural relaxed friendly smile. Completely plain navy
hospital scrubs with no text, no logos, no badges. Soft natural light, neutral background,
shallow depth of field, photographic realism.
```

### Sam — "Sam Patel"
Emergency consultant and the rota lead, 40. Three lines.
```
Portrait photograph of a handsome Indian-Australian man aged 40 who looks young for his age, fit,
a neat short beard, dark hair cropped short at the sides and full on top, no glasses, a bright easy
smile. Completely plain teal hospital scrubs. Soft natural light, neutral background, shallow depth
of field, photographic realism.
```

### Morgan — "Morgan O'Brien"
Director of emergency medicine, 52. One line.
```
Portrait photograph of an Anglo-Australian man aged 52, short grey-flecked hair, clean-shaven,
reading glasses pushed up on his head, a plain navy blazer over a plain white open-collar shirt, no
tie, no badge. Office window light with venetian blinds, shallow depth of field, photographic realism.
```

### Alex — "Alex Campbell"
Emergency consultant, 40. One line.
```
Portrait photograph of a smart, composed Afro-Caribbean man aged 40 of Jamaican heritage, a short
neat fade haircut, a trimmed beard, thin dark-rimmed glasses, a calm confident closed-mouth smile.
Completely plain ceil-blue hospital scrubs. Soft natural light, neutral background, shallow depth of
field, photographic realism.
```

### Supporting (no Soul ID; describe in the frame)
- **Morgan** (frame 10): see section 2; composed, reading a laptop.
- **Sam's son** (frame 11): a boy of about ten in a football jersey with no crest, **always from
  behind**, kicking a ball.
- **Emma's daughter** (frames 2 and 6): heard, never seen. A school bag by a door at most.
- **Staff at handover** (frame 3): a dozen people in navy and ceil-blue scrubs with no patches or
  text, phones in hands, faces mostly turned to their phones.

## 3. Locations (one reference still each)

```
L1 · Sam's kitchen, night: a suburban Australian kitchen at 11 pm, one pendant lamp over a timber
table, a laptop open with a soft white glow, a cold mug, a printed sheet with pencil marks, a phone
face up, the rest of the room in shadow.
```
```
L2 · Emma's kitchen, morning: a bright small kitchen at 7 am, a fridge door with a printed sheet
pinned under a round magnet (the sheet unreadable), a school bag on the floor by the door, morning
sun on the bench.
```
```
L3 · Nurses' station, handover: a hospital emergency department nurses' station at 8 am, warm
practical light, a whiteboard blurred so nothing is readable, a dozen staff in navy and ceil-blue
scrubs standing in a loose group.
```
```
L4 · Café window: a corner café window seat in the morning, a flat white on the table, soft daylight,
the street out of focus behind.
```
```
L5 · Doctors' station: a cramped doctors' workstation in an emergency department, two computers, a
mug, a pinboard, morning light from a high window, screens a soft glow.
```
```
L6 · Corridor: a quiet side corridor off an emergency department, pale walls, a handrail, daylight
from a door at the far end, a trolley parked against the wall.
```
```
L7 · Staff car park: an outdoor staff car park at the side of a hospital, bike racks, a few cars, a
tree, bright early-afternoon light.
```
```
L8 · Director's office: a small hospital office at 8:50 am, venetian blinds half open, a laptop, a
meeting folder, a framed print turned away from camera, two takeaway coffees on the desk.
```
```
L9 · Back garden, dusk: a suburban back garden at dusk, a timber outdoor table with a phone face
down, a football on the grass, warm low sun through a fence.
```
```
L10 · Staff entrance, first light: the staff entrance of a hospital at dawn, sliding glass doors
glowing, wet pavement, a pale gold sky, two figures walking in.
```

## 4. The twelve frames

Each frame: **Keyframe** (image prompt, with the Soul ID selected), **Motion** (video prompt), any
line of dialogue, and the real recording that follows it in the edit. Add the style block, and the
screens rule where a screen appears.

### Scene 1 · Sunday, 11:10 pm — the spreadsheet night

**Frame 1 · The kitchen table, 6 s · L1 · Sam Patel**
- Keyframe: `Sam Patel in a grey hoodie at the kitchen table at night, laptop glow on his face, a cold mug, a printed sheet with pencil crossings, his phone face up beside the laptop lighting with a message.`
- Motion: `He scrolls, stops, rubs an eye; the phone buzzes and lights again; he glances at it and sighs.` + screens rule.
- Line (quiet, flat): **"That's three swaps since dinner."**
- Followed by: `R1-mock-spreadsheet` (the unreadable grid, scrolled).

**Frame 2 · The fridge, 5 s · L2 · Emma Walsh**
- Keyframe: `Emma Walsh in navy scrubs at a bright kitchen fridge in the morning, one finger on a printed sheet pinned under a round magnet, the sheet unreadable, a school bag by the door.`
- Motion: `Her finger runs along a row; she turns her head toward the doorway and speaks.`
- Line (calling through, fond): **"Saturday, love. It's on the fridge."**

### Scene 2 · Monday, 8:05 am — the round opens

**Frame 3 · Handover, 5 s · L3 · staff, Sam Patel at the edge**
- Keyframe: `Morning handover at the nurses' station: a dozen staff in navy and ceil-blue scrubs, several glancing down at phones in their hands, two smiling; Sam Patel at the edge of the group sliding his own phone into his pocket.`
- Motion: `A ripple of glances down at phones, a couple of smiles, Sam pockets his phone and turns back to the group.` + screens rule.

**Frame 4 · The café, 6 s · L4 · Emma Walsh**
- Keyframe: `Emma Walsh in a denim jacket over a white tee at a café window seat with a flat white, thumb on her phone, a small satisfied nod, morning light.`
- Motion (take 2, 7 October; take 1 kept her lips closed in a smile through the line): `One continuous shot, no cuts. Emma Walsh in a denim jacket over a white tee at a café window seat, a flat white beside her, thumb moving on her phone. She lifts her head from the phone and says the line out loud, clearly, her lips moving with every word, a small satisfied nod at the end: "Resus Tuesday… and the Thursday evening. Done." Then she looks back down at the phone. Natural, unhurried movement; morning light.` + the style block. The line lands at 0.74–4.16 s; its voice leads the lips by about 80 ms, so the timelines delay that clip's audio by 0.06 s.
- Line (half to herself): **"Resus Tuesday… and the Thursday evening. Done."**
- Followed by: `R2-book-shifts-phone`.

**Frame 5 · The grid fills, 5 s · L5 · Sam Patel**
- Keyframe: `Sam Patel in teal scrubs at the doctors' station, a laptop open, its screen a soft glow, coffee in one hand, a faint smile as he watches the screen.`
- Motion: `He sips, watches, raises an eyebrow, speaks.` + screens rule.
- Line (dry): **"Half full already."**
- Followed by: `R3-roster-filling-laptop`.

### Scene 3 · Two weeks later, Thursday, 1:40 pm — life happens

**Frame 6 · The call, 6 s · L6 · Emma Walsh**
- Keyframe: `Emma Walsh in navy scrubs stepping to the side of a quiet hospital corridor, phone to her ear, listening, one hand on the handrail, daylight from the far door.`
- Motion: `She listens, closes her eyes for a beat, exhales, and answers gently.`
- Line (gentle): **"I'll come and get her. Twenty minutes."**

**Frame 7 · Ask everyone, 4 s · L6 · Emma's hands**
- Keyframe: `Close-up of a woman's hands with fair skin holding a phone in a pale corridor, thumb poised over the screen, the screen a soft white glow.`
- Motion: `Two deliberate taps, a short pause, a third; the thumb lifts.` + screens rule.
- Followed by: `R4-swap-ask-everyone-phone`.

**Frame 8 · A shift back, 5 s · L7 · Alex Campbell**
- Keyframe: `Alex Campbell beside a commuter bike in a staff car park, black cycling jacket half on over ceil-blue scrubs, reading his phone and grinning, bright afternoon light.`
- Motion: `He reads, grins, taps once, and swings the jacket on.` + screens rule.
- Line (to himself, amused): **"I'll take your Saturday."**

**Frame 9 · Approved, 5 s · L6 · Sam Patel**
- Keyframe: `Sam Patel in teal scrubs walking a hospital corridor between two doors, phone raised in one hand, not breaking stride, daylight ahead.`
- Motion: `Walking tracking shot alongside him; one tap on the phone without slowing; he speaks.` + screens rule.
- Line (matter-of-fact): **"Cover's fine. Approved."**
- Followed by: `R5-approve-swap-phone`.

### Scene 4 · Friday, 8:50 am — the director's glance

**Frame 10 · The glance, 7 s · L8 · Morgan and Sam Patel · dialogue**
- Keyframe: `Morgan, Morgan O'Brien, an Anglo-Australian man of 52 with short grey-flecked hair and reading glasses pushed up on his head, a navy blazer over a white open-collar shirt, reading a laptop in a small hospital office with venetian blinds; Sam Patel leaning in at the door holding two takeaway coffees.`
- Motion (take 3, 7 October; take 1 had Sam grinning through his reply, take 2's longer prompt failed): `One continuous shot, no cuts. Morgan O'Brien, 52, reading glasses pushed up, navy blazer, reads a laptop in a small hospital office; Sam Patel in teal scrubs leans in at the door with two takeaway coffees and sets one down. Morgan, not looking up, says: "So that's everyone." Sam answers, speaking clearly with his lips moving on each word, not grinning: "Five rosters. One heading." Quiet office ambience.` + the style block. Lines at 1.56–2.66, 3.58–3.98 and 5.10–5.56 s; the clip's audio is delayed 0.05 s in the timeline.
- Lines: **Morgan** (not looking up): **"So that's everyone."** · **Sam:** **"Five rosters. One heading."**
- Followed by: `R6-director-glance-laptop`.

### Scene 5 · Sunday, 6:40 pm — Sam's evening

**Frame 11 · The garden, 8 s · L9 · Sam Patel and the son from behind** (animated on Kling 3.0: Veo cut mid-shot, lost the phone, or refused the scene in nine attempts)
- Keyframe: `A back garden at dusk: a boy of about ten seen from behind kicking a football toward Sam Patel in a faded navy polo; on the outdoor table a phone lying face down; warm low sun through the fence.`
- Motion (as used): `One continuous shot, no cuts. A back garden at dusk. In the foreground a boy of about ten with his back to the camera holds a football under his arm. Beyond him Sam Patel, in a faded navy polo, sits at the timber outdoor table, looks up at the boy and says easily: "No, I'm done. Round's closed." and stands up, smiling. Slow, natural movement. Warm low sun, evening garden ambience.` + the style block. Kling staged it with Sam standing, tossing the ball to the boy, the phone face down on the table throughout; the line lands at 5.4–7.7 s.
- Line (to his son, easy): **"No, I'm done. Round's closed."**
- Followed by: `R7-publish-phone`.

### Scene 6 · Monday, 7:20 am — close

**Frame 13 · Emma's bookend, 8 s · the kitchen of frame 2 · Emma Walsh** (added 7 October; placed before frame 12)
- Keyframe: `The same bright small kitchen as frame 2, 7 am the next Monday: Emma Walsh, an emergency doctor in plain navy hospital scrubs, slipping her phone into her pocket with one hand and lifting her car keys from the bench with the other, glancing back toward the doorway with a fond smile. The fridge door beside her is bare except one child's crayon drawing under a round magnet: no roster, no printed sheet, no paper, no lists. Morning sun on the bench, a school bag by the door.` with Emma's portrait and frame 2 as image references; the window then needed one edit (`Edit this photograph: change only the view through the window to a quiet Australian suburban street…`) because the style block put the hospital outside her kitchen.
- Motion: `One continuous shot, no cuts. A bright small kitchen at 7 am. Emma Walsh, in plain navy hospital scrubs, slips her phone into her pocket and picks up her car keys from the bench. From the next room a child's voice calls, off camera: "Mum, Saturday?" Emma glances toward the doorway, smiles and answers warmly: "It's in the calendar, love." then heads for the door. The fridge beside her stays bare except a child's drawing under a magnet. Natural, unhurried movement; morning light.` + the style block.
- Lines: **her daughter** (off camera) "Mum, Saturday?" · **Emma** "It's in the calendar, love."
- Followed by: frame 12 and the end card.

**Frame 12 · Walking in, 7 s · L10 · Emma Walsh and Sam Patel**
- Keyframe: `Emma Walsh and Sam Patel in scrubs walking in through the staff entrance of a hospital at first light, side by side, phones in pockets, mid-conversation, the glass doors sliding open ahead of them.`
- Motion: `Slow tracking shot from behind as they walk in and the doors open onto the light.`
- Followed by: the end card.

## 5. Assembly: picture, inserts and narration

| Time | Frames | Real recording cut in | Narration (AI voice) |
|---|---|---|---|
| 0:00 | 1 · 2 | `R1-mock-spreadsheet` after frame 1 | "Eleven at night, and the roster is a spreadsheet on a kitchen table. Every swap is a text, every leave request an email, and the only copy that matters is on one laptop." |
| 0:25 | 3 · 4 · 5 | `R2-book-shifts-phone` after 4; `R3-roster-filling-laptop` after 5 | "With Myrosta, the rota lead opens the round, and the roster lands on every phone at once. Each person books their own shifts, up to a fair share, and the grid fills itself." |
| 0:50 | 6 · 7 · 8 · 9 | `R4-swap-ask-everyone-phone` after 7; `R5-approve-swap-phone` after 9 | "Two weeks later, life happens. From the shift itself, Emma asks the whole group. Alex offers a shift back; she accepts; and the rota lead approves it in a minute, with cover and fairness in front of him. Nobody rings around." |
| 1:25 | 10 | `R6-director-glance-laptop` after 10 | "The director sees what the spreadsheet never showed: today's cover, every roster in the department under one heading, who is carrying the tough shifts, and every change written down. Myrosta holds no patient data, and it's hosted in Sydney." |
| 1:50 | 11 | `R7-publish-phone` after 11 | "And the rota lead gets the evening back." |
| 2:05 | 12 · end card | — | "Myrosta was built in an emergency department by an emergency doctor, because a roster should live on the phone in your pocket, be fair to the people on it, and take minutes, not nights. One department. One eight-week pilot." |

**End card:** Myrosta wordmark · myrosta.com.au. Small print: "Dramatisation. Characters and hospital
are fictional. Scenes and voices created with AI; app screens are real recordings of Myrosta."

### 5a. The narrator's voice

- **Tool:** Higgsfield Audio text to speech, or any text-to-speech service your plan allows. One stock
  voice from its library for every line. Never clone or imitate a real person's voice, the founder's
  included.
- **Voice:** Australian English, a woman in her 40s, a lower and slower register than Emma's. Warm,
  calm, close to the microphone. A documentary read, about 140 words a minute, not an advert. Where
  the tool takes a voice description, paste:
  ```
  Australian English narrator, a woman in her 40s with a low, unhurried voice. Warm, calm and
  grounded, close to the microphone. Documentary pacing, about 140 words a minute, natural pauses at
  full stops. Not an advert: no announcer lift, no rising intonation at the ends of sentences.
  ```
- **Generate line by line**, same voice and settings each time, so each line can be timed to its
  frame. Three takes of each; keep the most natural.
- **Say it right:** Myrosta is "my-ROSS-ta"; resus is "REE-sus"; rota is "ROH-ta".
- **Licence:** before publishing, confirm the plan allows commercial use of the generated audio.

**Sound:** soft department ambience under the hospital scenes, a kettle and a clock in the kitchens,
traffic under the café and car park; phones buzz and chime quietly; music sparse and warm, lifting
at the handover and again at first light. Burned-in captions on every social version.

**Cutdowns:** 60–90 s uses frames 1 (short), 3, 4, 6, 7, 9 and 12. The 30 s version uses frames 1,
6, 7, 9 and the end card with "Nobody rings around" and the narrator's last two sentences. The pitch
cut holds `R6-director-glance-laptop` ten seconds longer. The 9:16 versions are centre crops.

## 6. Check before anything is published

- [ ] No readable text, logo, insignia, school name, spreadsheet cell or monitor number in any
      generated frame.
- [ ] No patient is identifiable in any frame; Sam's son is never seen from the front.
- [ ] Hands and faces hold up at full size; Emma, Sam and Alex look the same in every frame.
- [ ] Every app screen is a real recording of the demo sandbox with the hospital set to Wattle
      Hospital and only the sandbox's synthetic names on it.
- [ ] No line claims a saving, a pay outcome or anything the app does not do.
- [ ] The end card disclosure is present in every version, including the 30 s cut, and says the
      voices are AI.
- [ ] The narrator is a stock AI voice: no cloned or imitated real voice, no line in the first person,
      and the plan's licence covers commercial use.
