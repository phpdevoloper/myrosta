# Myrosta — single sign-on (Entra ID / Google) · switch-on guide

The app side is **built and dormant**: "Sign in with Microsoft / Google" buttons appear on the sign-in screen only when you flip the flags in `app.html`:

```js
const CLOUD={ ..., sso:{azure:true, google:false} };
```

SSO does **not** bypass the allow-list. The provider hands back a verified work email; Myrosta then runs the exact same `roster_members` check as OTP sign-in — unknown emails still get "No access". OTP by email/SMS keeps working alongside.

## Microsoft Entra ID (the one hospitals ask for)

**1. Hospital IT side (they do this — it's their standard "app registration"):**
- Azure Portal → **Entra ID → App registrations → New registration**
- Name: `Myrosta` · Supported accounts: *this organisation only*
- Redirect URI (Web): `https://skpdqqhwrqgxsxawniho.supabase.co/auth/v1/callback`
- After creating: copy **Application (client) ID** and create a **client secret** (Certificates & secrets)
- API permissions: `openid`, `email`, `profile` (delegated) — usually pre-granted

**2. Supabase side (you, ~2 min):**
- Dashboard → **Authentication → Sign In / Providers → Azure**
- Enable, paste **Client ID** + **Client secret**, set the **Azure tenant URL** IT gives you (e.g. `https://login.microsoftonline.com/<tenant-id>`)
- Save

**3. App side:** set `sso:{azure:true,...}` in `app.html`, commit, push (Netlify deploys).

**4. Test:** sign out → the sign-in card shows **Sign in with Microsoft** → it should round-trip to the hospital login and land signed-in (if your work email is on the allow-list).

## Google (optional, e.g. for personal fallback)
Same pattern: Google Cloud Console → OAuth client (Web) → redirect URI as above → paste client ID/secret into Supabase's Google provider → `sso:{google:true}`.

## Notes
- **Site URL / Redirect URLs** (Supabase → Authentication → URL Configuration) must include `https://myrosta.com.au` — already set for OTP; verify it lists the app page you deploy.
- Sessions, idle logout and the shared-computer mode behave identically regardless of how someone signed in.
- Rollback = set the flag back to `false`; nothing else to undo.
