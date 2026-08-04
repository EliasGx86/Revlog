# RevLog — Project Progress

Running log of where the project stands. Update at the end of each working session.
See [BACKLOG.md](BACKLOG.md) for the prioritized list of what's next, and
[Elias Todo.md](Elias%20Todo.md) for user-side action items.

## Current status (2026-08-02, end of day)

**Live:** https://revlog-blush.vercel.app — Next 16 / React 19 in production.
(note: `revlog.vercel.app` belongs to someone else — always use the `-blush` domain or attach a custom domain later)

**Elias is signed up and using the app** — first real chat sessions happened
2026-08-02 and directly drove the specs feature and prompt fixes.

### Infrastructure — done
- **Vercel**: project `revlog` (team `eliasgx86s-projects`, Pro). GitHub repo `EliasGx86/Revlog` connected — every push to `main` auto-deploys to production; other branches get preview URLs.
- **Supabase**: project "RevLog" (`zscbziojvrtgutbnpsra`, org "DarkModeOrg", Pro, us-east-1). Schema applied through migration `0009`. Costs ~$10/mo compute on top of the org's $25/mo Pro base.
- **Env vars** (Vercel all environments + local `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `OPENAI_API_KEY`.
- **Stack**: next@16.2.12, React 19, three 0.185 + r3f v9 + drei v10, ESLint 9 flat config, Tailwind 3.

### Features — done
- Full v1 scaffold: auth (sign-in/up, middleware gate), onboarding, 3D garage home, chat bar with voice input, zone history modals, PostHog events.
- Renamed GarageIQ → RevLog throughout.
- **VIN + license plate**: optional onboarding fields, shown at a glance in the home header (plate badge, click-to-copy VIN). Migration `0002`.
- **Photo OCR capture**: 📷 button on VIN/plate fields — take a picture, gpt-4o-mini vision extracts the text (`/api/vision/extract`). Strict VIN validation (17 chars, no I/O/Q).
- **Motorcycles**: 4th body type. Renders the artist-made "Harley-Davidson Seventy-Two HD FXT 2015" by Alex.Ka. (CC-BY 4.0, `public/models/motorcycle.glb`) with paint tinting and engine/wheel click zones; the procedural bike remains as the loading fallback.
- **3D pipeline**: artist GLBs for sedan/SUV/truck (trimmed pack, 295 KB) + the Harley; paint tinting, license plate rendered from the user's plate text, red pulsing due-zone highlights, procedural models as loading fallback. Dev-only `/dev/models` viewer + snapshot API.
- **Chat brain**: intent router (log / query / insurance / spec / smalltalk) with brand-typo correction, inconsistency flagging, off-topic guardrail, and general-vehicle-knowledge answers that never deflect to "check your manual".
- **Vehicle specs**: hardware facts (oil type, drain plug size, filters…) stored per vehicle — stated in chat, confirmed via "log it", or auto-pulled as stock values at **initialization** (on add + backfill for older vehicles; "stock" badge; customizations field overrides).
- **Reminders & suggestions**: every entry checks pending alerts (🔔 in the reply, auto-completes satisfied ones); fresh odometer readings also nudge about never-logged services past their interval; overdue zones glow red on the model.
- **Garage** (`/garage`): card grid, edit (year/color/mileage/plate/VIN), delete with cascade warning. Onboarding lands on the new vehicle, "Add another vehicle" copy for returning users.
- **Learnability**: pulsing 💡 how-to sheet (mobile's answer to hover), desktop-only hover tooltips, chat suggestion chips, per-zone "what can I track here" ⓘ.
- **Auth screens**: "garage at night" redesign (animated tachometer, Chakra Petch).
- **Account & admin**: 👤 account modal (email, plan, garage, sign out); /admin hub + /admin/chats + /admin/requests (email allowlist + RLS, migration 0004).
- **Hardening**: rate limits on all AI routes (Supabase-counted windows, fail open), middleware static-asset exclusions, mobile safe-area/dvh layout.

### Intentionally off during beta
1. **Stripe** — the app is free: onboarding skips checkout and the home page's subscription gate is commented out ([app/page.tsx](app/page.tsx)). Restore the gate + wire products/keys/webhook + set `SUPABASE_SERVICE_ROLE_KEY` when beta ends.
2. **PostHog key not set** — analytics silently no-op. Optional (Elias Todo).
3. **Alert notifications** — reminders are in-chat only; push/email needs Vercel Cron + a sender (P3).

### Suggested next session
1. Recommendations next step (BACKLOG P2) or garage grid polish for 3+ vehicles.
2. Realistic catalog models, once Elias green-lights the budget.
3. Road trip pre-trip checkup if Elias's spec ideas are ready (parked in BACKLOG).

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
- **The dev Browser pane can permanently lose WebGL** after many 3D scene
  mounts in one session: every canvas reports `isContextLost()=true`, even in
  fresh tabs, and snapshots come out blank white. Not a code bug — verify 3D
  on a Vercel preview/real browser when it happens. (Bit us verifying the
  next16 branch.)
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

- **2026-08-03b** — Auth & account round (Elias's mid-session asks):
  **forgot password** (/forgot-password sends the Supabase reset email;
  /reset-password — public in middleware so the ?code= survives — waits for
  the recovery session, then updateUser; PKCE means the link must be opened
  in the requesting browser). **Duplicate sign-up notice** (handles both
  Supabase modes: explicit "already registered" error and the
  empty-identities obfuscated success). **Password eye toggle**
  (AuthPasswordField in auth-shell, used on sign-in/up/reset).
  **App versioning**: [lib/version.ts](lib/version.ts) `APP_VERSION`
  ("0.5.0-beta", package.json synced) shown in the account modal — bump each
  deploy batch. Also: manual VIN entry now validated (17 chars, no I/O/Q —
  Elias's test vehicles had junk VINs like "TEST" stored); junk VINs decode
  to null safely. ⚠ Supabase Auth URL config must allowlist
  /reset-password (Elias Todo) or the reset email links won't land right.

- **2026-08-03a** — Three asks from Elias: (1) **VIN → trim decode** — new
  [lib/vin.ts](lib/vin.ts) hits the free NHTSA vPIC API (no key); trim
  (LX/EX-L…) saved to `vehicles.trim` (migration 0010, applied), shown in the
  home header, info modal ("vin" badge), garage cards, and fed to the chat
  brain + spec initializer (trim-correct values instead of "most common
  trim"). Decoded engine/drivetrain/transmission/fuel also seed as oem specs.
  Light `/api/vehicle/decode-vin` route (no LLM) backfills trim for vehicles
  that already have specs (home-client triggers it once per session) and runs
  after a VIN is added/edited in the garage. Initialize + decode now both
  refuse to overwrite user-source specs with stock values. (2) **Mobile
  "blown up" fix** — root cause: every input is <16px, so iOS Safari zooms
  the page on focus and never zooms back; global CSS now forces ≥16px form
  controls on coarse pointers. All six modals capped at `max-h-[85dvh]` +
  scroll (info/zone/account had NO cap — long content was simply cut off);
  header VIN row wraps/truncates instead of overflowing 375px screens; info
  modal spec rows wrap long values. (3) **[DATA-POINTS.md](DATA-POINTS.md)**
  — canonical inventory of every tracked field (9 identity + 16 named specs +
  unlimited chat specs + 12 service types + insurance + glovebox) with
  marketing angles; update it when adding fields. NOT yet verified on a real
  phone — Elias re-checks after deploy.

- **2026-08-02l** — Night wrap: cleared .dev-snapshots (8 MB of session
  screenshots), rewrote the Current Status / Features sections to match
  reality (Next 16 live, Elias active), pruned BACKLOG of everything shipped
  today, and rebuilt Elias Todo.md (sign-up/phone-check/Harley-license/next16
  all done; new items: close the Dependabot PR, finish the E2E leftovers,
  re-check mobile after the fixes).

- **2026-08-02k** — **Next 16 merged to production** (Elias verified the 3D
  garage on the branch preview first). Stack now: next@16.2.12, React 19,
  r3f v9, drei v10, three 0.185, ESLint 9 flat config. Remaining audit item:
  sharp/libvips advisory inside Next's image optimizer (upstream). Also:
  /admin hub page (was a 404) with live user/vehicle/chat/request counts
  linking the two admin views; Dependabot's own Next-bump PR is superseded —
  Elias closes it on GitHub. Follow-up from live testing: vehicles added
  before initialization existed get backfilled (home silently pulls stock
  specs when a vehicle has zero; ↻ button in the info modal as fallback),
  init candidates gained oil filter part + drain plug size, and the query
  prompt now must give its best specific value instead of deflecting to
  "check your owner's manual".

- **2026-08-02j** — Mobile feedback round 2 + initialization. Mobile: header
  buttons icon-only on phones (labels return at sm:), viewport-fit=cover +
  bigger safe-area padding so the chat bar clears mobile browser chrome, hint
  repositioned. Chat: ✕ clear button on the transcript; help sheet portals to
  body (it rendered BEHIND the chat — the header's z-10 stacking context
  capped its z-50). Vehicle info modal gained an ✏️ Edit link (→ /garage) so
  VIN/plate can be added after creation. **Vehicle initialization**: on add,
  an "Initializing your {year make model}" screen (rotating shop-talk lines)
  while /api/vehicle/initialize pulls confident OEM specs (oil, filters, tire
  size/pressure, battery, wipers…) into vehicle_specs as source='oem'
  (migration 0009, applied) — shown with a "stock" badge; a new optional
  "Customizations" field parses plain-language mods which override stock as
  source='user'; chat statements also upgrade oem→user. Query prompt
  distinguishes confirmed facts from stock specs. Best-effort with a 20s cap
  — never blocks onboarding.

- **2026-08-02i** — Elias's first real session surfaced the missing concept:
  vehicle FACTS vs maintenance EVENTS. Shipped **vehicle_specs** (migration
  0008, applied): new "spec" chat intent saves hardware facts (oil type,
  drain plug size…) including history-aware "log it" confirmations of the
  assistant's own guidance; queries answer saved specs with certainty; specs
  section in the vehicle info modal. Also shipped **/garage** (card grid,
  edit modal, delete with cascade warning; header shows 🏠 Garage at 2+
  vehicles) and **proactive suggestions** on fresh odometer readings
  (never-logged services past their typical interval). **Next 16 migration**
  completed on branch `next16` (build/lint/tsc green, 3D unverified —
  awaiting preview check; do not merge blind). Road-trip pre-trip checkup
  re-specced and parked at the bottom of BACKLOG.md.

- **2026-08-02h** — Backlog crunch: Next.js 14.2.15 → **14.2.35** +
  `npm audit fix` (65 Dependabot alerts down to 5, all requiring the Next 16
  major migration — new backlog item); **rate limiting** on /api/chat
  (12/min, 400/day via chat_messages counts) and /api/vision/extract (8/min,
  100/day via new `api_events` table, migration 0007 — applied to prod) with
  a Supabase-counted sliding window, fails open, 429s before any OpenAI call;
  **vehicles.glb trimmed 3.1 MB → 295 KB** (scripts/trim-vehicles.mjs strips
  the 14 unused pack vehicles; full pack archived in 3D Model Files/; all 3
  vehicles verified rendering with wheels/tint/plates); **/admin/requests**
  view ranking vehicle_requests by count (cross-linked with /admin/chats);
  onboarding now lands on the newly added vehicle (`/?v=<id>`). Road trip
  feature re-specced as a pre-trip checkup and parked at the bottom of
  BACKLOG.md per Elias.

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
