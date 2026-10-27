# Landing page redesign — design

**Date:** 8 September 2026 · **Status:** approved in conversation, awaiting written review · **Page:** `index.html` (and `deploy/index.html`), served at https://myrosta.com.au/

## Why

The landing page has not changed since the project began, while the app went through six UI phases. It now disagrees with the product in four visible ways: the favicon still shows the old red/amber/green bars; the copy says "self-roster" and "consultant" where the app says Book shifts and staff groups; the phone mockup is a hand-built picture of the pre-Phase 1 My shifts; and three equal buttons in the hero serve neither of the page's two audiences well.

The page must serve two audiences equally:

- **Staff** arriving from a link on a phone, who need Sign in in one tap.
- **Directors and nurse unit managers** evaluating Myrosta, who need to know in thirty seconds what it does, that it is safe, that it is real, and how to try it or talk to us.

An agency-style 3D experience (the example site discussed) was considered and rejected: it needs weeks of specialist work, a loading screen and a desktop browser, and it would undo at the front door the keyboard and screen-reader work Phase 4 just put into the app. What the page borrows from that genre is the structure: one story told in sequence, the product as the hero, one signature moment.

## Decisions (agreed 8 Sep 2026)

| Question | Decision |
|---|---|
| Audience | Both equally: staff sign-in and evaluators |
| Proof | Real numbers, no hospital name: "Live in a Victorian ED since June 2026 · 36 doctors on the roster · 56-day cycles · 0 passwords" |
| The ask | A four-field form handled by Netlify Forms, emailed to drranjith0713@gmail.com; a mailto fallback; the demo sandbox stays for self-serve evaluators |
| Cost | No price. Hero status line: "In daily use at a Victorian emergency department since June 2026. Taking on new departments across Australia." (changed from a "piloting" line on 9 Sep 2026 — "pilot" read as unproven). The cost FAQ: "Early departments join on pilot terms while pricing settles. Book a walkthrough and ask." |
| Hero direction | B, "the phone that works": a pinned phone frame that advances through the product as the visitor scrolls |
| Story on a phone | Option 1: the phone frame pinned in the top half, the step text scrolling under it |
| Names and zones | No real names anywhere. Fictional staff (Dr Jordan Lee and invented colleagues). Generic zones: EPIC, Resus, Paeds, SSU, Fast track, Acute bays |
| Roster offer | The soft version only: "Bring your current roster to the walkthrough and we'll show what it looks like in Myrosta." No files change hands before a call |

## The page

One file, no images, no libraries, Inter from Google Fonts as today. Budget: under 40 KB, under 450 words of visible copy. Seven sections in this order.

1. **Bar** (pinned): the mark, "Myrosta", and Sign in on the right. Staff never scroll to sign in.
2. **Hero:** headline "The ED roster, finally on every phone." One sub-line: "Book shifts, swap them, take leave and see your fair share, from the phone in your pocket. Hosted in Australia." Primary button "Try the demo" (demo.html), secondary "Book a walkthrough" (scrolls to the form). The pilot line beneath the buttons. The phone frame at its first screen.
3. **The story:** four text steps beside the pinned phone (see below).
4. **Security line:** one sentence on a navy band: "A code by text or email, no password. Data stays in Sydney. Every change is logged."
5. **Proof beside the ask:** the heading "Built in an ED, for EDs." with a forty-word block (the spreadsheet problem, the solution, built by an emergency physician — unnamed), then three figures (June 2026, live in a Victorian emergency department · 36 doctors on the roster, in 56-day cycles · 0 passwords or app-store installs), the soft roster offer, and the walkthrough form.
6. **Questions, answered:** five collapsed questions: Is it fair? · Does it work for nurses, junior doctors and clerks? · Where is the data? · Does it talk to payroll? · What does it cost? (answered with the pilot line).
7. **Footer:** Privacy · Terms · Support · Demo · Made in Melbourne.

Vocabulary follows the app: Book shifts, booking, staff, groups, roster. Never "self-roster", "consultant", "cohort", "snake", "release".

## The story (the signature)

A phone frame built from the app's own components and Phase 3 tokens (navy hero card with the period rail, `.tag` chips, the day row, the day sheet, the basket footer, the notification row), so it cannot drift from the product. It renders five screens in place, one visible at a time:

| Step text (scrolls) | Phone screen |
|---|---|
| Your next shift, at a glance. | My shifts: "Your next shift · Mon 28 Sept · EPIC · 08:00", the week strip with EPIC AM, Paeds PM, off days |
| Tap a day. See what's open and why. | The day sheet for Tue 29: "AM cover 3 of 5 · minimum 4 — still filling", EPIC "Taken by Dr Ng", Resus "Taken by Dr Okafor", Fast track "Open", SSU "Open", Paeds "Taken by Dr Patel" |
| Pick. Confirm from a footer that never scrolls away. | Fast track picked, the footer "1 picked · 11 → 12 of 14 after confirm", then the confirmed row |
| Swaps, leave and open shifts come to you. | Requests: "Needs you — Dr Patel offers Sat 3 Oct PM for your Sun 4 Oct AM"; then the notification "Open shift: Thu 8 Oct PM · Acute bays" |

Mechanism: the steps are plain paragraphs; an IntersectionObserver marks the step nearest the middle of the viewport as current and the frame cross-fades to that screen (0.3 s). On desktop the frame is `position: sticky` beside the steps; on phones it is sticky at the top, about 46 % of the viewport tall, with the steps scrolling beneath it. With `prefers-reduced-motion: reduce` the screens switch with no animation. The frame is decorative for assistive technology (`aria-hidden`): the four numbered steps carry the meaning, so a screen reader hears the story once, not five mock screens of pseudo-buttons. Nothing on the page depends on JavaScript to be readable: with scripts off, the first screen shows and the steps read as a list.

## The form

```html
<form name="walkthrough" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field">
```

Fields: Name · Work email · Hospital and department · What runs your roster today? (optional) · hidden `bot-field`. Button: "Book a 20-minute walkthrough". Each field is a real `<label>`; errors, if any, follow the app's `fieldError` pattern (beside the field). `thanks.html` is a one-paragraph page: "Thanks. You'll hear from us within two working days." with links back and to the demo. Under the form: "Prefer email? hello@myrosta.com.au" as a mailto link (the domain address forwards to the owner's inbox; set up 9 Sep 2026 via ImprovMX).

Netlify detects the form at deploy, but only once form detection is switched on (it is off by default for sites created after April 2023, and this site has never had a form). **Two manual steps for the owner:** (1) Netlify → Site configuration → Forms → Enable form detection, then trigger a redeploy; (2) Netlify → Forms → walkthrough → Form notifications → add an email notification to drranjith0713@gmail.com; then submit one test entry from the live page and confirm it lands on /thanks.html and the email arrives. Submissions also stay in the dashboard. Free tier: 100 submissions a month.

## Visual system

The app's Phase 3 tokens and rules, copied into the page's own stylesheet (the page must not load app.html): navy `#0F243A` hero, teal `#067A67` for buttons and links, the period colours for the phone's chips and rail, the seven-step type scale in rem, the 44 px floor on phones, the `:focus-visible` ring, reduced-motion respected. The favicon and the inline mark use the AM/PM/CST bars (`#4C86E8`, `#F2A638`, `#2FA86E`) like the app icon. Restraint: one filled-navy button in the hero, one navy band, the rest white and neutral.

## Testing

A landing-page check in `tests/run.py` (Python, no JSC): the file exists in both copies and they are identical; size under 40 KB; no stale vocabulary (`self-roster`, `consultant`, `cohort`, `snake`, `Release for`, `E04B4B`); no real staff names: the page's people are a fixed fictional cast listed in the test (Dr Jordan Lee, Dr Ng, Dr Patel, Dr Okafor), and the check fails on any "Dr <Name>" or "<Surname>, <Given>" outside that list and on "Jamie"; the form carries `data-netlify="true"`, `netlify-honeypot`, `name="walkthrough"`, and `action="/thanks.html"` with `thanks.html` present; every internal link resolves to a file in the repo; the only external hosts are fonts.googleapis.com and fonts.gstatic.com; the mark hexes are present and the old red is not.

Browser verification before merge: 375 px and 1280 px screenshots; the story advances on scroll and holds with reduced motion; Tab reaches Sign in, the demo button, every step, the form and the footer; the form posts to thanks.html on the deployed site (Netlify Forms only works on Netlify, not locally). Three skeptics review the branch as in every phase.

## Out of scope

The demo sandbox (demo.html), the privacy, terms and support pages, an Open Graph image, analytics, and any change to the app.

## Effort

Four to five days: the phone frame and its five screens first, then the page around it, then the form and the thanks page, then the checks and the review. Deploy is the normal push; the Netlify notification is the one manual step.
