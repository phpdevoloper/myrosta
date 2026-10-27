<!-- converted from Myrosta - IG & IT Summary.docx -->

Myrosta
ED consultant rostering, leave & swaps — system overview for IT & Privacy / Information Governance review
Owner: Dr Ranjith Kandavelu (ED Consultant)   |   Version 1.4   |   Status: Draft for review

## 1. Purpose
Myrosta is a web application that lets Emergency Department consultants view and self-manage their roster, leave and shift swaps, replacing a manually maintained Excel roster. It improves transparency and reduces administrative effort. It holds no patient or clinical-record data. It processes staff personal information and is intended to comply with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs), and applicable state/territory health-records legislation.
## 2. What the system is
- A single self-contained web page (HTML/JavaScript) that runs in the user's browser; a bespoke, in-house tool (no licence).
- Local mode: runs entirely on one device; data is stored only in that browser.
- Shared mode (for multi-user use): the same page connects to a hosted database so staff use it from their own devices with live shared data and individual logins.
## 3. Data held
*A free-text leave reason could disclose health information — see limitations. Data subjects: ~25–30 ED consultants (staff only); no patients or public.
## 4. Where data is held & residency
- Local mode: only in the user's browser on their device — nothing leaves the device.
- Shared mode: held in a single record in a hosted PostgreSQL database (Supabase), provisioned in Australia (Sydney, ap-southeast-2) so the roster data remains onshore.
- The application file is hosted on a static web host (Netlify) at myrosta.com.au — or the hospital intranet (recommended for production use); hosting holds only the app code, not the data.
- All connections use HTTPS/TLS; the database is encrypted at rest (provider standard).
- Third-party processors: Supabase (database — Sydney, Australia), Netlify (hosts the app code only), Resend (sign-in-code and reminder emails) and Twilio (sign-in-code SMS, plus optional reminder SMS). Only Resend and Twilio see personal data in transit — a personal email or mobile, a one-time code, or a brief reminder of the recipient’s own next shift (date/time/zone); no roster, leave or clinical dataset passes through them. Work email addresses and payroll numbers are hidden in the app by default — staff are identified and reminded by personal email or mobile.
## 5. Access & security model
- Authentication: passwordless 6-digit code by SMS or email — a one-time code typed into the app; sessions persist per device, so it is effectively a single sign-in. No passwords are stored.
- Sign-in restricted to approved email domain(s) — e.g., hospital email — and/or specific approved addresses and mobile numbers (e.g., a named backup admin).
- Shared‑device protection — on a shared/ward computer the user can mark the session as shared; it is held in session‑only storage (cleared when the browser/tab closes) and auto‑logs‑out after an admin‑set idle timeout. Personal devices stay signed in.
- Authorisation: an allow-list of approved emails and mobile numbers is enforced by database row-level security — only listed users can read or write data, even with a valid login; others are denied.
- Roles: admin (rota lead) vs staff; staff see only their own profile.
- An in-app audit log records key actions.
## 6. Data flows
- Browser ⇄ database over HTTPS.
- Sign-in codes (6-digit, one-time) are texted by SMS via Twilio Verify, or emailed via Resend; these carry only the recipient's mobile number or email address and the code — no roster, leave or clinical data. Twilio (SMS) and Resend's email sending region are currently outside Australia (a minor cross-border flow of a phone number/email + transient code); email can be switched to hospital SMTP to keep it onshore if required. The roster data itself stays in Sydney.
- Excel import/export — including a payroll export (shifts + employee numbers) for the hospital's payroll/rostering system, e.g. RosterOn — and calendar (.ics) export run locally in the browser; any exported file goes only where the admin chooses to send it.
- Leave/swap decision emails are generated as editable drafts and sent via the user's own mail app / hospital mail.
## 7. Retention, backup & deletion
- Data persists until removed. Admin can delete individual records or clear all data (“New organisation”). There is no manual in‑app backup; recovery relies on the provider's automated database backups.
- Provider automated database backups (tier-dependent). Recommend aligning retention with the health service's records-management policy.
## 8. Known limitations & recommendations for sign-off
- Fine-grained “staff edit only their own entries” rules are currently enforced in the app, not at the database (the roster is stored as one document). A per-record database design is the planned enhancement if higher assurance is needed.
- Recommend: host on the hospital intranet (or keep any public link private); use an Australian data region (Sydney); restrict sign-ups to the hospital domain; keep leave “reason” fields free of sensitive/health detail; complete a Privacy Impact Assessment (PIA) screening; engage the hospital IT security and privacy office before wider rollout.
## 9. Ownership & contact
System owner / administrator: Dr Ranjith Kandavelu, Emergency Department. (Insert work email and the hospital privacy / IT contact for the live version.)
| Data category | Examples | Personal information |
| --- | --- | --- |
| Staff details | Name, work email, work mobile, contracted hours (EFT), shift quota, payroll/employee number | Yes |
| Roster | Shift assignments (date, AM/PM, clinical area/role), non-clinical (CST) sessions | Yes |
| Leave | Leave type (annual, CME, etc.) and dates; optional free-text reason | Yes* |
| Requests | Leave and swap requests, status, admin comments | Yes |
| Messages | Internal notes between admin and staff | Yes |
| Audit log | Record of key actions (who did what, when) | Yes |
| Not held | No patient/clinical data; no passwords; no salaries, bank or financial data (an employee/payroll number is held as an identifier — see Staff details) | — |