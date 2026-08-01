# RevLog — Project Progress

Running log of where the project stands. Update at the end of each working session.
See [BACKLOG.md](BACKLOG.md) for the prioritized list of what's next.

## Current status (2026-08-01)

**Live:** https://revlog-blush.vercel.app
(note: `revlog.vercel.app` belongs to someone else — always use the `-blush` domain or attach a custom domain later)

### Infrastructure — done
- **Vercel**: project `revlog` (team `eliasgx86s-projects`, Pro). GitHub repo `EliasGx86/Revlog` connected — every push to `main` auto-deploys to production; other branches get preview URLs.
- **Supabase**: project "RevLog" (`zscbziojvrtgutbnpsra`, org "DarkModeOrg", Pro, us-east-1). Schema applied through migration `0002`. Costs ~$10/mo compute on top of the org's $25/mo Pro base.
- **Env vars** (Vercel all environments + local `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`.

### Features — done
- Full v1 scaffold: auth (sign-in/up, middleware gate), onboarding, 3D garage home, chat bar with voice input, zone history modals, PostHog events.
- Renamed GarageIQ → RevLog throughout.
- **VIN + license plate**: optional onboarding fields, shown at a glance in the home header (plate badge, click-to-copy VIN). Migration `0002`.
- **Photo OCR capture**: 📷 button on VIN/plate fields — take a picture, gpt-4o-mini vision extracts the text (`/api/vision/extract`). Strict VIN validation (17 chars, no I/O/Q).
- **Motorcycles**: 4th body type with its own procedural 3D model (engine + wheels click zones; engine maps to the "hood" service zone).

### Not working yet — blockers to a usable app
1. **`OPENAI_API_KEY` not set** — chat (the core feature) and photo OCR are dead until this is added in Vercel → Settings → Environment Variables (and `.env.local` for local dev).
2. **Stripe intentionally disabled for beta** — the app is free while in beta: onboarding skips checkout (sets `onboarded=true` directly) and the home page's subscription gate is commented out ([app/page.tsx](app/page.tsx)). The Stripe routes/env plumbing still exist; when beta ends, restore the gate and wire up Stripe products/keys/webhook.
3. **`SUPABASE_SERVICE_ROLE_KEY` not set** — only needed once Stripe webhooks exist. Copy from Supabase dashboard → Settings → API.
4. **PostHog key not set** — analytics silently no-op. Optional.
5. **No user has ever signed up** — the full auth → onboarding → home flow is untested end to end.

### Known debt
- Next.js 14.2.15 has a known vulnerability; GitHub Dependabot reports 65 alerts (1 critical, 24 high) on the repo — mostly transitive. Bump Next.js + audit deps.
- No rate limiting on API routes (add before public launch).
- Mileage-based alerts are queued in the DB but nothing sends notifications yet (v2: Vercel Cron + Web Push/email).

### Suggested next session
1. Add `OPENAI_API_KEY`, decide on Stripe (configure test mode or bypass the gate).
2. Sign up a real account and test the whole flow, including motorcycle onboarding and photo OCR.
3. Next.js security bump.

## Session log

- **2026-08-01** — Reviewed dormant scaffold; deployed to Vercel (Pro) with GitHub auto-deploy; created Supabase project on upgraded Pro org and applied schema; renamed GarageIQ → RevLog; added VIN/plate tracking with photo OCR and motorcycle body type with 3D model. Made the app free for beta (payment step removed, subscription gate off), labeled all onboarding fields, and replaced the color picker with tap-friendly swatches. Added a curated make/model picker (6 CO-popular vehicles → mapped 3D body types) with a "request my make & model" button (new `vehicle_requests` table, migration 0003), plus a vehicle switcher and "+ Add vehicle" in the home header. Created BACKLOG.md.
