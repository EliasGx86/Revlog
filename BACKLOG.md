# RevLog — Backlog

Prioritized list of everything we know we want but haven't built. Keep PROGRESS.md
for "where we are"; this file is "what's next and why."

## P1 — makes or breaks the beta experience

### 3D model visual overhaul
~~Pass 1 (done 2026-08-02):~~ procedural models rebuilt — extruded side-profile
silhouettes with wheel arches, dark glass greenhouses, clearcoat paint, detailed
wheels, showroom lighting/shadows/reflective floor. Iterate with the `/dev/models`
viewer (snapshots land in `.dev-snapshots/`).

~~Pass 2 (done 2026-08-02):~~ sedan/SUV/truck swapped to artist-made GLB models
(RgsDev pack, CC-BY 4.0, runtime-tinted, zone hit-boxes). Motorcycle still
procedural — find/buy a good bike GLB.

Next levels:
1. **Per-make/model realistic models for the catalog** (Chevy Colorado first) —
   paid assets ~$20–60 each on CGTrader/TurboSquid; use "inspired-by" models
   without manufacturer badges. The `vehicle_requests` table ranks what to buy
   next. Pipeline already supports drop-in GLBs.
2. **Trim the pack GLB** — it ships 17 vehicles (3.1 MB) but we use 3; strip
   unused nodes with gltf-transform to cut load time.
3. **Not recommended:** photoreal models — heavy on mobile; stylized-consistent
   beats realistic-inconsistent.
4. Perf check on mobile: MeshReflectorMaterial adds a render pass — if low-end
   phones struggle, gate it behind a quality toggle.

### Make/model catalog expansion
Beta ships with 6 curated vehicles (CO-popular first guess: Colorado, F-150,
Ram 1500, RAV4, Outback, Civic). Validate/adjust the list against real registration
data, grow it as requests come in, and eventually back it by a proper vehicle DB
(NHTSA vPIC API is free and has every make/model — could also auto-decode VINs).

### Multi-vehicle polish
A basic switcher + "Add vehicle" button exists in the home header. Still needed:
- Onboarding copy should say "Add another vehicle" when the user already has one
  (and skip the "free while in beta" pitch).
- After adding, land on the new vehicle (currently lands on the first).
- A proper garage view (grid of vehicle cards) once users have 3+.
- Delete/edit a vehicle.

## P2 — before public launch

- **`OPENAI_API_KEY` in Vercel** — chat + photo OCR are dead until set.
- **Re-enable Stripe when beta ends** — gate is commented out in `app/page.tsx`;
  onboarding skips checkout. Restore + configure products/prices/webhook.
- **Next.js security bump** — 14.2.15 has a known vuln; Dependabot shows 65 alerts
  (1 critical). Bump Next + audit transitive deps.
- **Rate limiting** on `/api/chat` and `/api/vision/extract` (Upstash/Vercel KV).
- **Admin view for vehicle_requests** — even a weekly SQL query works at first.
- **Email confirmation UX** — verify the Supabase sign-up confirmation flow works
  end to end with a custom SMTP sender (default Supabase sender is rate-limited).

## P3 — v2 ideas

- Alerts → actual notifications (Vercel Cron + Web Push/Resend email); monthly
  mileage-update prompt.
- Receipt photo → OCR → autofill maintenance log (vision route already exists;
  add a "receipt" kind).
- Whisper for voice input if Web Speech accuracy disappoints.
- VIN decode (NHTSA vPIC) → auto-fill year/make/model from the scanned VIN.
- Cost-of-ownership analytics, recall lookup, shop recommendations.
- Mobile app via Expo.
