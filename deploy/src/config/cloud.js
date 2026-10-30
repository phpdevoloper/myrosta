"use strict";
// moved from js/config.js lines 127-133 (Phase 1 split, no edits)
// ===== Cloud (Supabase) config — leave url/key EMPTY for local-only mode. =====
// Fill these in (Supabase project URL + anon public key) to switch the whole app
// to shared cloud storage. See SUPABASE.md for the 5-minute setup.
var CLOUD = { url: "https://rrgrwddxnjrixgkudsxx.supabase.co", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3J3ZGR4bmpyaXhna3Vkc3h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MTU1NTUsImV4cCI6MjEwODQ5MTU1NX0.ycDDlk6d5bXLmnKGI1MwbRRcnL6iU7lHMERweXXH6kQ", org: "ed-default", adminEmails: ["mailtochalam@gmail.com"], allowedDomains: [], sso: { azure: false, google: false }, vapidPublic: "BF3eotweaRm_yi8aC4EfzeWJV_cdDO3gCMeuoLwJOHkoyK9nOIPtWzT8pbYEh8cAn3J7pKAogglsQLLlmZyRFgU" };   // sso: flip on AFTER configuring the provider in Supabase (see SUPABASE-SSO.md); session email flows through the same allow-list
function cloudOn() { 
  return !!(CLOUD.url && CLOUD.key); 
}
