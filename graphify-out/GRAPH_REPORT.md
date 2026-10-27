# Graph Report - Myrosta  (2026-08-27)

## Corpus Check
- 104 files · ~210,674 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 433 nodes · 845 edges · 25 communities (21 shown, 4 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 92 edges (avg confidence: 0.87)
- Token cost: 929,136 input · 0 output

## Community Hubs (Navigation)
- Multi-Org Strategy & Plans
- Guides & Rollout Docs
- Supabase Backend & Auth
- App Core & Features
- Website & Legal Pages
- Printable Guides (DOCX)
- Self-Roster Fairness Options
- Multi-Org SQL Schema
- ICS Calendar Function
- App Icons
- PWA Manifest (deploy)
- PWA Manifest (root)
- PWA Manifest (myrosta-deploy)
- Shift Reminder Function
- Round Reminder Function
- Test Stubs
- Staff Quick Start Poster
- Brand Logos
- Push Send Function
- OG Share Images
- Sign-In QR Code

## God Nodes (most connected - your core abstractions)
1. `Myrosta App` - 40 edges
2. `Myrosta` - 33 edges
3. `User Guide` - 22 edges
4. `Myrosta Council Review` - 22 edges
5. `Admin Guide` - 18 edges
6. `Self-roster Fairness - Director Pack` - 16 edges
7. `Changelog` - 15 edges
8. `Myrosta - User Guide` - 15 edges
9. `FAQ` - 14 edges
10. `Myrosta - IG & IT Summary` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Department Configuration` --semantically_similar_to--> `Ten Setup Questions`  [INFERRED] [semantically similar]
  Myrosta - Admin Guide.pdf → MYROSTA-GROUP-SETUP.md
- `Demo Sandbox` --semantically_similar_to--> `Demo Video Script`  [INFERRED] [semantically similar]
  CHANGELOG.md → DEMO-SCRIPT.md
- `Self-Roster Round` --conceptually_related_to--> `Self-Rostering Fairness Engine`  [INFERRED]
  Myrosta - Admin Guide.pdf → MYROSTA-COUNCIL-REVIEW.md
- `Self-Roster Methods` --conceptually_related_to--> `Self-Rostering Fairness Engine`  [INFERRED]
  Myrosta - Staff Guide.pdf → MYROSTA-COUNCIL-REVIEW.md
- `App Build (staging)` --semantically_similar_to--> `Myrosta App`  [INFERRED] [semantically similar]
  .staging/app.html → app.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Passwordless Sign-In Stack** — user_guide_passwordless_sign_in, supabase_otp_email_setup, supabase_resend, supabase_twilio_verify, supabase_roster_members_table [EXTRACTED 1.00]
- **Supabase Edge Function Suite** — phase2_notifications_notify_rounds_function, phase2_notifications_notify_shifts_function, supabase_calendar_ics_edge_function, push_marketplace_push_send_function [INFERRED 0.85]
- **Rollout Communications Kit** — invite_note_invite_note, go_live_announcement_go_live_announcement, pilot_email_pilot_emails, director_email_director_onboarding_email, demo_script_demo_video_script, training_video_script_training_video_script [INFERRED 0.75]
- **Multi-Org Milestone** — myrosta_multiorg_build_multi_tenant_foundation, myrosta_council_review_entra_id_sso, myrosta_shift_templates_plan_phase_2_shift_types, myrosta_council_review_rls_org_blob_delete_exposure [EXTRACTED 1.00]
- **Durable Moat** — myrosta_council_review_self_rostering_fairness_engine, myrosta_council_review_equity_analytics_view, myrosta_council_review_facem_distribution_channel [EXTRACTED 1.00]
- **JMO Module Composition** — myrosta_jmo_concept_choice_within_duty, myrosta_jmo_concept_open_shift_marketplace, myrosta_jmo_concept_eba_rule_packs, myrosta_jmo_concept_terms_and_rotation_model, myrosta_shift_templates_plan_phase_2_shift_types [EXTRACTED 1.00]
- **Self-roster Fairness Options A-E** — graphify_out_converted_self_roster_fairness___option_a_explained_61f200c3_option_a, graphify_out_converted_self_roster_fairness___option_b_explained_f16f9d51_option_b, graphify_out_converted_self_roster_fairness___option_c_explained_6fcd99e1_option_c, graphify_out_converted_self_roster_fairness___option_d_explained_a72fcc65_option_d, graphify_out_converted_self_roster_fairness___option_e_explained_1babf21a_option_e [EXTRACTED 1.00]
- **Option C Allocation Engine Components** — graphify_out_converted_self_roster_fairness___option_c_explained_6fcd99e1_option_c, graphify_out_converted_self_roster_fairness___option_c_explained_6fcd99e1_priority_points_carry_over, graphify_out_converted_self_roster_fairness___option_c_explained_6fcd99e1_ua_budget, graphify_out_converted_self_roster_fairness___option_c_explained_6fcd99e1_draw_receipts, graphify_out_converted_self_roster_fairness___option_c_explained_6fcd99e1_zone_profiles, graphify_out_converted_self_roster_fairness___option_c_explained_6fcd99e1_fixed_flexible_layering [EXTRACTED 1.00]
- **Myrosta Hosting and Delivery Stack** — graphify_out_converted_myrosta___ig___it_summary_58d46817_myrosta, graphify_out_converted_myrosta___ig___it_summary_58d46817_supabase, graphify_out_converted_myrosta___ig___it_summary_58d46817_netlify, graphify_out_converted_myrosta___ig___it_summary_58d46817_resend, graphify_out_converted_myrosta___ig___it_summary_58d46817_twilio [EXTRACTED 1.00]
- **Passwordless Sign-In Flow** — index_passwordless_sign_in, myrosta_deploy_index_email_otp_authentication, myrosta_signin_email_sign_in_code_email_template, support_sign_in_troubleshooting [INFERRED 0.75]
- **Multi-Org Data Isolation** — supabase_isolation_test_multi_org_isolation_test, myrosta_deploy_index_roster_members_allow_list, myrosta_deploy_index_supabase_cloud_sync, privacy_database_allow_list [INFERRED 0.75]
- **Myrosta Legal and Trust Pages** — deploy_privacy_privacy_policy, deploy_terms_terms_of_use, deploy_support_support_page [EXTRACTED 1.00]
- **Myrosta App Build Family** — app_myrosta_app, deploy_app_app_build__production_deploy_, _staging_app_app_build__staging_, deploy_staging_multiorg_app_build__staging_multiorg_, deploy_demo_app_build__demo_sandbox_, preview_app_build__local_preview_ [INFERRED 0.95]
- **Self-Rostering Subsystem** — app_self_roster_view, app_self_roster_fairness_modes, app_shift_booking_engine, app_fatigue_safe_hours_check, app_self_roster_round_scheduler, app_open_shift_marketplace [INFERRED 0.85]
- **Offline-First Cloud Sync Stack** — app_local_state_store, app_supabase_cloud_sync, app_three_way_merge_engine, app_org_state_table [INFERRED 0.85]

## Communities (25 total, 4 thin omitted)

### Community 0 - "Multi-Org Strategy & Plans"
Cohesion: 0.05
Nodes (78): Admin Guide (PDF export), Department Configuration, Self-Roster Round, Collision-Proof Booking, Frequently Asked Questions (PDF export), Passwordless OTP Sign-In, Staff Frequently Asked Questions (PDF export), My Shifts (+70 more)

### Community 1 - "Guides & Rollout Docs"
Cohesion: 0.07
Nodes (60): Access Control, Admin Guide, Alt Email, Approval Context, Audit Log, Auto Draft, Fixed Patterns, Locum Cover (+52 more)

### Community 2 - "Supabase Backend & Auth"
Cohesion: 0.08
Nodes (47): Import Data, Round Scheduling, Changelog, Equity Tab, Multiorg Foundation, Public Holiday Marking, Request Conversations, Sync Hardening (+39 more)

### Community 3 - "App Core & Features"
Cohesion: 0.08
Nodes (46): App Build (staging), Admin Setup View, Audit Log View, Audit Trail, Auth Flow, Capacity Planning, Daily View, Equity View (+38 more)

### Community 4 - "Website & Legal Pages"
Cohesion: 0.08
Nodes (37): Myrosta Landing Page, Notifiable Data Breaches Scheme, Privacy Policy, Service Providers Disclosure, Support Page, As-Is Service Basis, Official Roster Prevails, Terms of Use (+29 more)

### Community 5 - "Printable Guides (DOCX)"
Cohesion: 0.20
Nodes (34): Myrosta - Admin Guide, Locum Cover and Unplanned Leave (UPL), Payroll Export (RosterOn), RosterOn, Zones (Clinical Areas), Myrosta - Frequently Asked Questions, Collision-proof Live Booking, Myrosta - IG & IT Summary (+26 more)

### Community 6 - "Self-Roster Fairness Options"
Cohesion: 0.30
Nodes (23): Self-roster Fairness - Director Brief, Microsoft Forms, Director Recommendation of Option C, Two-Round Vote and One-Cycle Trial, Self-roster Fairness - Director Pack, Self-roster Fairness - Option A Explained, Option A - Open Booking (First Tap Wins), Self-roster Fairness - Option B Explained (+15 more)

### Community 7 - "Multi-Org SQL Schema"
Cohesion: 0.21
Nodes (8): public.is_admin_member(), public.is_member(), public.is_admin_member(), public.is_member(), org_state, public.is_admin_member(), public.is_member(), roster_members

### Community 8 - "ICS Calendar Function"
Cohesion: 0.32
Nodes (11): buildICS(), cycleDays(), esc(), hhmmss(), isoAddDay(), isOnCallZone(), LEAVE_LABEL, pad() (+3 more)

### Community 9 - "App Icons"
Cohesion: 0.20
Nodes (10): App Icon 180 (deploy), App Icon 192 (deploy), App Icon 512 (deploy), App Icon 180, App Icon 192, App Icon 512, Myrosta Icon Visual Design, App Icon 180 (myrosta-deploy) (+2 more)

### Community 10 - "PWA Manifest (deploy)"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 11 - "PWA Manifest (root)"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 12 - "PWA Manifest (myrosta-deploy)"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 13 - "Shift Reminder Function"
Cohesion: 0.33
Nodes (9): e164(), runOrg(), sb, sendEmailOne(), sendSMSOne(), TIME_DEFAULTS, timeLabel(), timesOf() (+1 more)

### Community 14 - "Round Reminder Function"
Cohesion: 0.52
Nodes (6): dtMs(), fmt(), runOrg(), sb, sendEmail(), sendSMS()

### Community 16 - "Staff Quick Start Poster"
Cohesion: 0.40
Nodes (5): Add to Home Screen (iPhone/Android), Book Shifts and Request Leave or Swaps, Myrosta Staff Quick Start Poster, View Shifts in List or Calendar, Sign In with 6-Digit Code

### Community 17 - "Brand Logos"
Cohesion: 1.00
Nodes (3): Myrosta Logo, Myrosta Logomark, Myrosta Brand

## Ambiguous Edges - Review These
- `index.html` → `SSO Guide`  [AMBIGUOUS]
  SUPABASE-SSO.md · relation: references
- `Admin Guide (PDF export)` → `Frequently Asked Questions (PDF export)`  [AMBIGUOUS]
  Myrosta - Frequently Asked Questions.pdf · relation: conceptually_related_to
- `Director Recommendation of Option C` → `Dr Ranjith Kandavelu`  [AMBIGUOUS]
  graphify-out/converted/Self-roster Fairness - Director Brief_25ddbbe5.md · relation: conceptually_related_to
- `Myrosta Landing Page` → `Terms of Use`  [AMBIGUOUS]
  index.html · relation: references

## Knowledge Gaps
- **93 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `index.html` and `SSO Guide`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Admin Guide (PDF export)` and `Frequently Asked Questions (PDF export)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Director Recommendation of Option C` and `Dr Ranjith Kandavelu`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Myrosta Landing Page` and `Terms of Use`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `Passwordless Sign In` connect `Supabase Backend & Auth` to `Guides & Rollout Docs`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Myrosta App` (e.g. with `App Build (staging)` and `App Build (production deploy)`) actually correct?**
  _`Myrosta App` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Myrosta` (e.g. with `Option A - Open Booking (First Tap Wins)` and `Option B - Turn-based Booking (Rotating Order)`) actually correct?**
  _`Myrosta` has 2 INFERRED edges - model-reasoned connections that need verification._