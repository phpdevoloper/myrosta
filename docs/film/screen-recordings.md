# Myrosta film — the seven real screen recordings

*6 October 2026. Every app screen in the film is a real recording of the demo sandbox
(`deploy/demo.html`, local data only — nothing here touches a live group). The names on screen are
the sandbox's own synthetic people. For the storyboard, a still of each screen is enough; for the
film, record the sequence.*

## Set up the sandbox once

1. Open `deploy/demo.html` (or myrosta.com.au/demo.html) in a desktop browser. The demo signs you in
   as the admin.
2. Settings → Group: set the hospital name to **Wattle Hospital**. Leave the group name as it is.
3. The demo cycle is in **Booking open** (a rounds roster). Keep it that way for R2 and R3; R7 closes
   and publishes it last.
4. Phone inserts: either record on a phone pointed at the same demo, or set the browser window to a
   phone width (about 390 px) and record that window. Cut phone inserts in full-frame with a thin
   phone outline.
5. Hide anything personal: a clean browser profile, no other tabs, notifications off.

## The recordings

| # | File | Device | What to capture | Keep readable |
|---|---|---|---|---|
| R1 | `R1-mock-spreadsheet` | Laptop | A spreadsheet made for the film: a huge roster grid of initials and codes, hundreds of columns, scrolled slowly left and down. Not Myrosta. | Nothing — cells small and blurred |
| R2 | `R2-book-shifts-phone` | Phone | View as **Emma Walsh** → Book shifts → open a day → the zone chips reading *Open* → pick one → open a second day, pick → confirm → the receipt line. End on the share strip. | The chips, "Open", the receipt "That's your share — 8 of 8 booked." |
| R2b | `R2b-calendar-phone` | Phone | View as **Emma Walsh** → My shifts → *Whole cycle* → *Month*: the month view with her shifts → *Calendar & export* → *Add to calendar (.ics)*. Added 6 October for the self-rostering beat; re-captured 8 October after the month view changed (one-line chips with the zone's short name). | The month grid, "Add to calendar" |
| R3 | `R3-roster-filling-laptop` | Laptop | As admin on the Roster tab, "Booking open" in the status pill. Capture the grid at four points during the round (book a few shifts for other people between captures) and dissolve between them so it appears to fill. Re-captured 8 October after the roster grid gained fixed columns: the earlier take's columns widened between snapshots, so the grid lines jumped; recorded once more the same day with the grid's lines drawn at 16% rather than the 8% hairline that vanished in a scaled player. | The grid, the cover row, the status pill |
| R4 | `R4-swap-ask-everyone-phone` | Phone | View as **Emma Walsh** → My shifts → a **Saturday** inside the cycle → *Swap it* → *Ask everyone* → send. Then view as **Alex Campbell** → *Swaps wanted* → Emma's Saturday → offer a shift back. Then view as Emma → the offer → accept. | "Swap it", "Ask everyone", "Swaps wanted", the two shifts |
| R5 (in the film: two phones on one plate, Emma's on the left holding R4's last frame 2.6 s then R5 from 3.8 s, Sam's on the right playing R5 0.6–3.6 s then held; `R5L.mp4`, `backdrop2.py`, segment kind `phone2`) | `R5-approve-swap-phone` | Phone | View as admin → Requests → the pending swap tagged "via Ask everyone" → the two shifts side by side → *Approve*. Then view as Emma → My shifts: the Saturday is gone and Alex's shift is hers. | "via Ask everyone", the two shifts, "Approve" |
| R6 | `R6-director-glance-laptop` | Laptop | As admin → Day board (today's cover by zone) → the switch to *Whole department* → Fairness (the Equity view: who is carrying the tough shifts) → Audit log (scroll slowly). | Headings, group names and counts; no names if you prefer |
| R7 | `R7-publish-phone` | Phone | As admin → the Round tab → close the round → publish → the status reads "Published (live)". Then view as Emma → the notification that the roster is live. | "Published (live)" |
| R8 | `R8-leave-phone` | Phone | View as **Emma Walsh** → Requests → *Request leave* → From/To, type AL, reason "School holidays" → *Send leave request*. Then view as admin → Requests → the leave card (days taken this year, this request in days and hours, who else is away against the cap) → *Approve*. Then view as Emma → the request reads Approved. Added 7 October for the leave beat. | The card's numbers, "Who else is away", Approve |

**R6 and the whole department.** The demo sandbox holds one group. The *Whole department* view needs
a hospital with several published groups: record that step on the staging multi-group copy (Demo
Hospital ED, five groups — the director sign-in from your second-site demo script), with that
hospital's name set to Wattle Hospital first, or skip the step and let the narration carry it. Never
record it on a live group.

**Before recording R4 and R5,** make sure Emma holds a Saturday shift in the cycle and Alex holds a
shift on another day that Emma is free for, so the offer is one he can make.

**Stills for the storyboard:** take one screenshot at the end point of each recording (the receipt,
the filled grid, the ask, the approval, the Whole department board, "Published (live)") and name them
`R2-still.png` … `R7-still.png`. They sit beside the generated frames in the storyboard page.
