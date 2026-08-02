# RevLog — Project Progress

Running log of where the project stands. Update at the end of each working session.
See [BACKLOG.md](BACKLOG.md) for the prioritized list of what's next, and
[Elias Todo.md](Elias%20Todo.md) for user-side action items.

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
- **3D visual overhaul (pass 1)**: extruded side-profile silhouettes with real wheel arches, dark glass greenhouses, clearcoat paint, spoked wheels, mirrors/bumpers/lights, showroom lighting with contact shadows and reflective floor. Dev-only `/dev/models` viewer + snapshot API for iterating without auth.

### Not working yet — blockers to a usable app
1. ~~`OPENAI_API_KEY` not set~~ — **done 2026-08-02**: key added to Vercel (Preview+Production) and `.env.local`, validated against the OpenAI API.
2. **Stripe intentionally disabled for beta** — the app is free while in beta: onboarding skips checkout (sets `onboarded=true` directly) and the home page's subscription gate is commented out ([app/page.tsx](app/page.tsx)). The Stripe routes/env plumbing still exist; when beta ends, restore the gate and wire up Stripe products/keys/webhook.
3. **`SUPABASE_SERVICE_ROLE_KEY` not set** — only needed once Stripe webhooks exist. Copy from Supabase dashboard → Settings → API.
4. **PostHog key not set** — analytics silently no-op. Optional.
5. **No user has ever signed up** — the full auth → onboarding → home flow is untested end to end.

### Known debt
- Next.js 14.2.15 has a known vulnerability; GitHub Dependabot reports 65 alerts (1 critical, 24 high) on the repo — mostly transitive. Bump Next.js + audit deps.
- No rate limiting on API routes (add before public launch).
- Mileage-based alerts are queued in the DB but nothing sends notifications yet (v2: Vercel Cron + Web Push/email).

### Suggested next session
1. Wire up the Harley motorcycle GLB (see BACKLOG P1; license info needed from Elias first).
2. End-to-end flow test once Elias signs up (see Elias Todo.md #1).
3. Next.js security bump.

### Admin
- **/admin/chats** — beta admin view of every chat exchange (question, intent, reply, user, vehicle). Access: email allowlist in [lib/admin.ts](lib/admin.ts) (`ADMIN_EMAILS` env override) + RLS admin policies in migration 0004. Non-admins get a 404.

## Issues & gotchas (so we don't re-learn them)

- **Sketchfab license fine print**: the vehicle pack's page implied CC0 but the
  GLB's embedded metadata says **CC-BY 4.0** — attribution to RgsDev is required
  and lives in the vehicle info modal. Check embedded `asset.extras.license` on
  any downloaded model, not just the listing page.
- **GLTFLoader renames nodes**: spaces become underscores ("Pickup wheel front
  left" → "Pickup_wheel_front_left"). Normalize names before matching.
- **The pack stores wheels as siblings**, not children, of each vehicle node —
  cloning just the body node silently drops the wheels.
- **The pack's front/rear wheel names are inconsistent between vehicles** (the
  sedan's "front" wheels are at its rear) — orientation is detected from the
  headlight vs rear-light material positions instead, which are reliable.
- **Middleware ate the model file**: `/models/*.glb` was auth-redirected to
  sign-in HTML, which the GLTF parser reported as cryptic JSON errors. Static
  asset extensions are now excluded in the middleware matcher.
- **Env var names**: `.env.local` had `OPENAI-API-KEY` (dashes) — invisible
  failure; the app reads `OPENAI_API_KEY`.
- **Dev-only**: the /dev/models ResizeObserver shim must defer its callback
  (setTimeout 0) — synchronous callbacks fire setState during React render and
  put Next dev into a full-reload crash loop that also exhausts WebGL contexts.
- **Vercel CLI status checks**: `vercel ls` output line numbers shift between
  invocations; grep for the `●` status marker instead of using fixed line
  numbers when scripting.

## Session log

- **2026-08-02d** — Fixed reversed hood/bed click zones (vehicles now auto-orient by headlight/rear-light material positions; per-body-type zone placement so the truck's windshield zone sits over the cab). Insurance via chat: new "insurance" intent extracts carrier/policy #/premium/coverage/renewal into `vehicle_insurance` (migration 0006), merges partial updates, answers questions from it, and shows it in the vehicle info panel.

- **2026-08-02c** — GLB vehicle pipeline: sedan/SUV/truck now render from the CC-BY "Free Low Poly Vehicles Pack" by RgsDev (`public/models/vehicles.glb`, attribution in vehicle info modal) with runtime paint tinting, dark glass, and invisible zone hit-boxes; procedural models remain as motorcycle + loading fallback. Glovebox: per-vehicle document uploads (photos/PDFs, 10 MB cap) in preset folders, private `glovebox` storage bucket + `documents` table (migration 0005). Zone modals now show per-zone trackable services + an example phrase when empty. Middleware now skips auth for static model files.

- **2026-08-02b** — OpenAI key configured + validated (fixed dashes→underscores in `.env.local`). Added `chat_messages` logging (migration 0004) and the `/admin/chats` admin view with double-layer access control.
- **2026-08-02** — 3D overhaul pass 1: rewrote `car-model.tsx` (extruded silhouettes, arches, glass, clearcoat, detailed wheels) and `car-scene.tsx` (showroom lighting, ContactShadows, MeshReflectorMaterial floor). Added `/dev/models` dev viewer + `/api/dev/snapshot` for headless visual iteration.
- **2026-08-01** — Reviewed dormant scaffold; deployed to Vercel (Pro) with GitHub auto-deploy; created Supabase project on upgraded Pro org and applied schema; renamed GarageIQ → RevLog; added VIN/plate tracking with photo OCR and motorcycle body type with 3D model. Made the app free for beta (payment step removed, subscription gate off), labeled all onboarding fields, and replaced the color picker with tap-friendly swatches. Added a curated make/model picker (6 CO-popular vehicles → mapped 3D body types) with a "request my make & model" button (new `vehicle_requests` table, migration 0003), plus a vehicle switcher and "+ Add vehicle" in the home header. Created BACKLOG.md.
