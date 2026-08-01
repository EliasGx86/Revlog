# RevLog — Backlog

Prioritized list of everything we know we want but haven't built. Keep PROGRESS.md
for "where we are"; this file is "what's next and why."

## P1 — makes or breaks the beta experience

### 3D model visual overhaul
The procedural primitive models (boxes + cylinders) read as programmer art. Plan:

1. **Short term (recommended next step):** swap the primitives for real low-poly
   stylized GLB models — one per body type (sedan, truck, SUV, motorcycle), sourced
   from CC0/low-cost packs (Poly Pizza, Sketchfab, Kenney car kit). Recolor the body
   material at runtime to the user's chosen color. Keep the existing prop interface
   (`car-model.tsx` was designed to be swapped) and use invisible hit-box meshes for
   the hood/wheels/windshield click zones so nothing else changes. Add soft-shadow
   ground, better HDR environment, subtle bloom — lighting is half the perceived
   quality.
2. **Medium term:** per-make/model GLBs for the catalog vehicles (Chevy Colorado
   first). The `vehicle_requests` table tells us exactly which models to buy/commission
   next — prioritize by request count.
3. **Not recommended:** photoreal models or runtime-generated meshes — heavy, slow
   on mobile, and stylized-consistent beats realistic-inconsistent.

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
