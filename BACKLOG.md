# RevLog — Backlog

Prioritized list of what's next and why. "Where we are" and completed work live
in [PROGRESS.md](PROGRESS.md); things only Elias can do live in
[Elias Todo.md](Elias%20Todo.md).

## P1 — makes or breaks the beta experience

### Wire up the Harley motorcycle GLB
`3D Model Files/harley-davidson_seventy-two_hd_fxt_2015.glb` (2.9 MB, downloaded
2026-08-02) replaces the procedural motorcycle. Needs: license check (read the
GLB's embedded `asset.extras.license`), node/material inspection, paint-tint
target selection, zone hit-boxes (engine/tank → "hood", wheels), then slot into
the existing pipeline in `components/car/glb-vehicle-model.tsx`. Consider
gltf-transform to shrink it first.

### Per-make/model realistic vehicles for the catalog
The GLB pipeline accepts drop-in models; what's missing is the assets. Chevy
Colorado first — paid, ~$20–60 each on CGTrader/TurboSquid; prefer "inspired-by"
models without manufacturer badges (trademark). Rank future purchases by the
`vehicle_requests` table. (Elias picks/buys; see Elias Todo.)

### End-to-end flow test with a real account
Nobody has ever signed up. Auth → onboarding → 3D garage → chat log → mileage
prompt → zone history → Glovebox upload → /admin/chats, on desktop and phone.
Blocked on Elias creating the account (admin features key off his email).

### Real license plate on the 3D model
Whatever the user typed in the plate field renders on the model's plate.
Approach: draw the plate text to a canvas → `THREE.CanvasTexture` on a small
plane overlaid on the model's rear plate position (the pack models have a white
plate mesh to anchor to; fall back to the rear bbox face). Front plate too where
the model has one. Empty plate field → leave the blank plate.

### Multi-vehicle polish
- Onboarding copy should say "Add another vehicle" for existing users (and skip
  the beta pitch).
- After adding a vehicle, land on it (currently lands on the first).
- Garage grid view once users have 3+; edit/delete a vehicle.

## P2 — before public launch

- **Next.js security bump** — 14.2.15 has a known vuln; Dependabot: 65 alerts
  (1 critical). Bump Next + audit transitive deps.
- **Rate limiting** on `/api/chat` and `/api/vision/extract` (Upstash/Vercel KV).
- **Trim the vehicles GLB** — ships 17 vehicles (3.1 MB), we use 3; strip unused
  nodes with gltf-transform.
- **Mobile perf check** — MeshReflectorMaterial adds a render pass; gate behind a
  quality toggle if low-end phones struggle.
- **Custom domain** — revlog.vercel.app is taken by someone else; current URL is
  revlog-blush.vercel.app. Buy a domain when branding settles.
- **Supabase SMTP** — default email sender is heavily rate-limited; configure a
  real sender (Resend/Postmark) before inviting beta users.
- **Re-enable Stripe when beta ends** — gate commented out in `app/page.tsx`,
  onboarding skips checkout; configure products/prices/webhook + set
  `SUPABASE_SERVICE_ROLE_KEY`.
- **Expand the make/model catalog** — validate the CO-popular first guess against
  registration data; consider NHTSA vPIC (free) for full make/model data and VIN
  decode.
- **Admin: vehicle_requests view** — even a weekly SQL query works at first.

## P3 — v2 ideas

- Alerts → actual notifications (Vercel Cron + Web Push/Resend); monthly
  mileage-update prompt.
- Receipt photo → OCR → autofill a maintenance log (vision route exists; add a
  "receipt" kind and link it to Glovebox uploads).
- Glovebox: camera capture on mobile, multi-file upload, file preview inline.
- Whisper fallback if Web Speech accuracy disappoints.
- VIN decode (NHTSA vPIC) → auto-fill year/make/model from a scanned VIN.
- Cost-of-ownership analytics, recall lookup, shop recommendations.
- Mobile app via Expo.
