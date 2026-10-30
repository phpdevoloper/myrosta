# MyRosta docs

Every document in `docs/`, by folder. Start with [ARCHITECTURE.md](ARCHITECTURE.md) for how the code is organised. Put a new doc in the matching folder and add a line here.

## guides/ — how to use the app
| File | What it is |
|---|---|
| [ADMIN-GUIDE.md](guides/ADMIN-GUIDE.md) | For the rota lead: setting up and running the roster |
| [STAFF-GUIDE.md](guides/STAFF-GUIDE.md) | For staff: your shifts, self-rostering, leave and swaps on any device |
| [USER-GUIDE.md](guides/USER-GUIDE.md) | Combined guide to self-rostering, leave and shift swaps for the Emergency Department |
| [FAQ.md](guides/FAQ.md) | Frequently asked questions |

## deployment/ — putting it live
| File | What it is |
|---|---|
| [DEPLOY.md](deployment/DEPLOY.md) | Hosting, the Supabase backend, and dev vs production config (`tools/use-env.py`) |
| [GO-LIVE.md](deployment/GO-LIVE.md) | Go-live runbook: demo path and real multi-user path |
| [MYROSTA-CUTOVER-RUNBOOK.md](deployment/MYROSTA-CUTOVER-RUNBOOK.md) | Checklist for the multi-organisation production cutover (19 Aug 2026) |

## backend/ — Supabase setup
| File | What it is |
|---|---|
| [SUPABASE.md](backend/SUPABASE.md) | Going multi-user: schema, auth, realtime, the booking call |
| [SUPABASE-SSO.md](backend/SUPABASE-SSO.md) | Turning on single sign-on (Entra ID / Google) |
| [SUPABASE-CALENDAR.md](backend/SUPABASE-CALENDAR.md) | Live calendar feed: one-time server setup |
| [PUSH-MARKETPLACE.md](backend/PUSH-MARKETPLACE.md) | Open-shift marketplace and phone push notifications |
| [PHASE2-NOTIFICATIONS.md](backend/PHASE2-NOTIFICATIONS.md) | Email / SMS reminders for scheduled rounds |

## operations/ — incidents and reviews
| File | What it is |
|---|---|
| [INCIDENT-2026-10-14-booking-storm.md](operations/INCIDENT-2026-10-14-booking-storm.md) | The 14 Oct 2026 booking storm: logs, cause and fix |
| [STAGING-RUNBOOK.md](operations/STAGING-RUNBOOK.md) | Building a de-identified staging copy for an outside reviewer |
| [TECHNICAL-BRIEF-2026-10-20.md](operations/TECHNICAL-BRIEF-2026-10-20.md) | Architecture brief for an outside engineer |

## strategy/ — plans and product thinking
| File | What it is |
|---|---|
| [MYROSTA-UI-STRATEGY.md](strategy/MYROSTA-UI-STRATEGY.md) | UI refinement strategy (8 Sep 2026) |
| [MYROSTA-PREMIUM-STRATEGY.md](strategy/MYROSTA-PREMIUM-STRATEGY.md) | What "premium" means for the app (9 Sep 2026) |
| [MYROSTA-MULTIORG-BUILD.md](strategy/MYROSTA-MULTIORG-BUILD.md) | Build plan for the multi-tenant foundation |
| [MYROSTA-GROUP-SETUP.md](strategy/MYROSTA-GROUP-SETUP.md) | Runbook: standing up a new staff group |
| [MYROSTA-DEPARTMENT-BOARD.md](strategy/MYROSTA-DEPARTMENT-BOARD.md) | "Who's on today" department board spec |
| [MYROSTA-SITE2-PLAN.md](strategy/MYROSTA-SITE2-PLAN.md) | Second pilot site: multi-group plan |
| [MYROSTA-SHIFT-TEMPLATES-PLAN.md](strategy/MYROSTA-SHIFT-TEMPLATES-PLAN.md) | Shift templates phase 2 (nights, arbitrary shift types) |
| [MYROSTA-JMO-CONCEPT.md](strategy/MYROSTA-JMO-CONCEPT.md) | Junior doctor rostering concept |
| [MYROSTA-COUNCIL-REVIEW.md](strategy/MYROSTA-COUNCIL-REVIEW.md) | Seven-lens review of the app (5 Jul 2026) |
| [MYROSTA-COMPETITOR-IRIS.md](strategy/MYROSTA-COMPETITOR-IRIS.md) | Competitor analysis: Intelligent Roster |
| [MYROSTA-TRADEMARK.md](strategy/MYROSTA-TRADEMARK.md) | Trade mark application notes |

## comms/ — emails, announcements, scripts
| File | What it is |
|---|---|
| [INVITE-NOTE.md](comms/INVITE-NOTE.md) | Invite note for the ED team |
| [PILOT-EMAIL.md](comms/PILOT-EMAIL.md) | Staff emails for the next-cycle pilot |
| [PILOT-FEEDBACK.md](comms/PILOT-FEEDBACK.md) | Two-minute pilot feedback form |
| [SURVEY-ROUND1.md](comms/SURVEY-ROUND1.md) | Self-rostering vote, round 1 survey wording |
| [GO-LIVE-ANNOUNCEMENT.md](comms/GO-LIVE-ANNOUNCEMENT.md) | Go-live announcement to the consultant group |
| [DIRECTOR-EMAIL.md](comms/DIRECTOR-EMAIL.md) | Short follow-up email to the Director |
| [DEMO-SCRIPT.md](comms/DEMO-SCRIPT.md) | 3–4 minute demo video script |
| [TRAINING-VIDEO-SCRIPT.md](comms/TRAINING-VIDEO-SCRIPT.md) | 5–6 minute training video script |
| [myrosta-signin-email.html](comms/myrosta-signin-email.html) | HTML template for the sign-in email |

## Removed on 30 Oct 2026
The film production files (`docs/film/`), the Word/PDF/PowerPoint exports (`docs/office/`) and the September build plans (`docs/superpowers/`) were taken out to keep the repo small. They are still in git history. To get one back:

```
git checkout 64445e3 -- "docs/office/guides/Myrosta - Staff Guide.pdf"
```
