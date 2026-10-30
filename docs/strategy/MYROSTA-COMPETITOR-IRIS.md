# Competitor analysis — Intelligent Roster ("IRIS") · 6 July 2026

**Who:** [intelligentroster.com](https://intelligentroster.com/) by Intelligent Mind® — "Emergency medicine‑first healthcare rostering." ED/ICU/anaesthetics/paramedics first, scaling to ambulance, aged care, call centres. **Positioning is word‑for‑word ours** ("ED‑first, clinician‑designed") — the market thesis is validated, and the differentiation claim is now contested.

**What it is:** an **AI‑generation** platform — LLMs (Claude for reasoning, GPT for lookups) *write* the roster, narrate their reasoning, fill gaps; humans review and publish. Swaps (direct/open/pickup), 5‑level structure (streams, patterns, vacancy planning, master templates, availability, living roster), fairness tracking over time, fatigue rules (rest, consecutive shifts, scope of practice), SSO/MFA (Microsoft/Google/OIDC), audit logs, AWS Sydney hosting option, no patient data, trial sandbox, v3.2 + public release notes. No public pricing (enterprise "contact us"). No payroll integrations listed.

## The fundamental difference
| | IRIS | Myrosta |
|---|---|---|
| Who builds the roster | **AI generates**, admin approves | **Staff self‑select**, rules keep it fair |
| Staff experience | Receive an explained roster | **Agency** — pick what suits your life |
| Engine | LLM, narrated, non‑deterministic, per‑run cost | Deterministic rules — instant, free, reproducible |
| Complexity | 5‑level hierarchy | Zero‑training, presets |
| Sales | Enterprise contact‑us | Department‑level price |
| Proof | Demo metrics, 1 testimonial | **A real ED rostering itself on it** |

**Moat (they must re‑architect to copy):** self‑rostering fairness mechanics (waves/snake/guarded/quotas), deterministic free engine, *no external AI touches staff data* (they pipe workforce data through Claude/GPT APIs), RosterOn payroll bridge, lived‑in ED proof, clinician‑founder distribution.

## Gaps they expose in us → all achievable
| Gap | Effort | Slot |
|---|---|---|
| Fairness evidence (their "fairness audits") | ~80% built — equity mock approved, on branch `equity-view` | **During pilot** |
| Fatigue/safe‑hours rules | Days — 2‑3 configurable canBook rules (min rest, max consecutive, no clinical after on‑call), warn‑or‑block admin setting | Post‑pilot, with templates |
| Shift templates / nights | 1–2 weeks — promote hardcoded AM/PM/OC to per‑cycle template array (same pattern as zones→settings) | Post‑pilot, before org #2 |
| SSO (Entra/Google OIDC) | Days — Supabase Auth native; map through existing roster_members allow‑list; hospital‑side Entra registration is the slow part | Multi‑org milestone |
| Polish (trial sandbox, release notes) | Hours — preview.html → demo subdomain; CHANGELOG.md from git | During pilot |

## Strategy
1. **Reposition:** lead with *"your staff pick their own shifts — the app keeps it fair"* (autonomy vs automation). They cannot say that sentence.
2. **Un‑park the equity report during the pilot** — direct answer to their headline feature; ours is simpler (tough‑shift share, no opaque weights).
3. **Pull fatigue rules forward** (with the templates refactor) — procurement checkbox + junior‑doctor market gate.
4. **Weaponise the pilot case study** — real conversion numbers vs their demo metrics.
5. **Publish simple department pricing** at first external sale — wins the flank their enterprise motion leaves open.
6. **Don't chase the AI arms race** — deterministic auto‑draft is a feature (governance line: "no external AI processes staff data"). Steal only the *narration* idea: a plain‑English "why this draft" summary, generated deterministically.
7. **Intel:** try their public sandbox (~1h); watch their release notes.

*Sources: intelligentroster.com (fetched 6 Jul 2026); full strategic context in MYROSTA-COUNCIL-REVIEW.md.*
