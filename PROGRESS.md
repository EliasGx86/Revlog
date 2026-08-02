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
- **Motorcycles**: 4th body type. Renders the artist-made "Harley-Davidson Seventy-Two HD FXT 2015" by Alex.Ka. (CC-BY 4.0, `public/models/motorcycle.glb`) with paint tinting and engine/wheel click zones; the procedural bike remains as the loading fallback.
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
1. End-to-end flow test once Elias signs up (see Elias Todo.md #1) — now also
   covers plates, reminders, and the help sheet.
2. Multi-vehicle polish (BACKLOG P1).
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
- **gltf-transform `optimize` merges materials**: its dedup/palette passes
  renamed `body_color` → `PaletteMaterialNNN` and merged `tire` into
  `headlight` (they share a texture atlas + identical props) — which would make
  the tires glow. Since our pipeline keys off material names, use the
  individual commands instead: `weld` → `simplify` → `quantize` → `prune`.
- **Never `npm run build` while the dev server runs** — both write `.next/`;
  the dev server's chunk state corrupts (MODULE_NOT_FOUND './787.js', phantom
  "Unexpected token" syntax errors on valid files). Fix: stop dev server,
  `rm -rf .next`, restart.
- **Headless `__snap` renders have no ground contact**: the snapshot path is a
  bare `gl.render` without contact-shadow/reflection passes, so every vehicle
  looks like it's floating. Compare against a known-good model (sedan) before
  chasing grounding "bugs". Animations don't advance either (no rAF in a
  hidden tab) — re-mounting (e.g. switching color) re-randomizes the pose.

## Session log

- **2026-08-02g** — Feedback sweep from Elias: year field is a real select
  (datalist was unusable on mobile); number inputs no longer pin a sticky 0
  (string state + numeric keyboard); mobile fixes (100dvh instead of vh so the
  keyboard doesn't push Save/mic off-screen, min-w-0 on chat inputs,
  safe-area padding); plate mount offset raised to 0.045 + polygonOffset (was
  clipping behind the SUV's white bumper block); cabin air filter added to the
  service catalog; zone modal shows "at N mi" with an ⓘ "what can I track
  here" expander; chat gets tap-to-fill suggestion chips on focus, extraction
  now normalizes brand typos ("le scab" → "Les Schwab") and flags
  inconsistent messages in notes; smalltalk politely declines off-topic;
  query intent may answer general vehicle questions ("what oil do I use?") as
  guidance; account modal (👤 in header: email, member since, garage list,
  sign out — moved out of the header); ← Back to garage links on admin +
  onboarding (returning users get "Add another vehicle" copy); overdue
  services light their zone red on the 3D model (pulsing hit-box + header
  hint), driven by pending alerts vs odometer/date, with a "due" toggle in
  /dev/models.

- **2026-08-02f** — Four features: (1) **License plates** — the user's plate
  text renders on the 3D models via canvas texture on a plane raycast-mounted
  to the bumper (front+rear on cars) or rear fender (bike); empty field → no
  plate ([components/car/license-plate.tsx](components/car/license-plate.tsx)).
  (2) **Auth redesign** — shared AuthShell ("garage at night": animated
  tachometer sweep, horizon glow, grain, Chakra Petch display font), both
  pages rebuilt on it. (3) **Help system** — pulsing 💡 in the home header
  opens a how-to sheet (works on mobile where hover doesn't exist); `<Tip>`
  hover tooltips on header controls appear only on hover-capable devices via
  `@media (hover:hover) and (pointer:fine)`. (4) **Reminders on every entry**
  — [lib/reminders.ts](lib/reminders.ts): each service log or mileage answer
  checks pending alerts against odometer/date and appends a 🔔 note to the
  reply (due, or within 500 mi / 21 days); logging a service auto-completes
  older pending alerts of the same type. Needs the end-to-end test (no real
  account yet).

- **2026-08-02e** — Harley GLB wired in as the motorcycle model
  (`components/car/glb-motorcycle-model.tsx`): license confirmed CC-BY 4.0 from
  the GLB's embedded metadata (author Alex.Ka., source URL embedded too — no
  Sketchfab link needed from Elias), optimized 2.87 MB → 1.49 MB with
  weld/simplify/quantize/prune (NOT `optimize` — see gotcha below), paint tint
  via the `body_color` material, headlight/brakelight emissive, engine/tank +
  wheel hit-boxes (wheel anchors derived from the `tire` material's bbox ends).
  Attribution added to the vehicle info modal for motorcycles.

- **2026-08-02d** — Fixed reversed hood/bed click zones (vehicles now auto-orient by headlight/rear-light material positions; per-body-type zone placement so the truck's windshield zone sits over the cab). Insurance via chat: new "insurance" intent extracts carrier/policy #/premium/coverage/renewal into `vehicle_insurance` (migration 0006), merges partial updates, answers questions from it, and shows it in the vehicle info panel.

- **2026-08-02c** — GLB vehicle pipeline: sedan/SUV/truck now render from the CC-BY "Free Low Poly Vehicles Pack" by RgsDev (`public/models/vehicles.glb`, attribution in vehicle info modal) with runtime paint tinting, dark glass, and invisible zone hit-boxes; procedural models remain as motorcycle + loading fallback. Glovebox: per-vehicle document uploads (photos/PDFs, 10 MB cap) in preset folders, private `glovebox` storage bucket + `documents` table (migration 0005). Zone modals now show per-zone trackable services + an example phrase when empty. Middleware now skips auth for static model files.

- **2026-08-02b** — OpenAI key configured + validated (fixed dashes→underscores in `.env.local`). Added `chat_messages` logging (migration 0004) and the `/admin/chats` admin view with double-layer access control.
- **2026-08-02** — 3D overhaul pass 1: rewrote `car-model.tsx` (extruded silhouettes, arches, glass, clearcoat, detailed wheels) and `car-scene.tsx` (showroom lighting, ContactShadows, MeshReflectorMaterial floor). Added `/dev/models` dev viewer + `/api/dev/snapshot` for headless visual iteration.
- **2026-08-01** — Reviewed dormant scaffold; deployed to Vercel (Pro) with GitHub auto-deploy; created Supabase project on upgraded Pro org and applied schema; renamed GarageIQ → RevLog; added VIN/plate tracking with photo OCR and motorcycle body type with 3D model. Made the app free for beta (payment step removed, subscription gate off), labeled all onboarding fields, and replaced the color picker with tap-friendly swatches. Added a curated make/model picker (6 CO-popular vehicles → mapped 3D body types) with a "request my make & model" button (new `vehicle_requests` table, migration 0003), plus a vehicle switcher and "+ Add vehicle" in the home header. Created BACKLOG.md.
