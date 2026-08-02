# RevLog — Backlog

Prioritized list of what's next and why. "Where we are" and completed work live
in [PROGRESS.md](PROGRESS.md); things only Elias can do live in
[Elias Todo.md](Elias%20Todo.md).

## P1 — makes or breaks the beta experience

### Per-make/model realistic vehicles for the catalog
The GLB pipeline accepts drop-in models; what's missing is the assets. Chevy
Colorado first — paid, ~$20–60 each on CGTrader/TurboSquid; prefer "inspired-by"
models without manufacturer badges (trademark). Rank future purchases by the
`vehicle_requests` table. (Elias picks/buys; see Elias Todo.)

### End-to-end flow test with a real account
Nobody has ever signed up. Auth → onboarding → 3D garage → chat log → mileage
prompt → zone history → Glovebox upload → /admin/chats, on desktop and phone.
Blocked on Elias creating the account (admin features key off his email).

### Multi-vehicle polish
- ~~Onboarding copy should say "Add another vehicle" for existing users~~ —
  done 2026-08-02 (title swaps + back link for returning users).
- After adding a vehicle, land on it (currently lands on the first).
- Garage grid view once users have 3+; edit/delete a vehicle.

## P2 — before public launch

- **Recommendations from vehicle data** — we know year/make/model/mileage;
  suggest likely-due services and correct parts/fluids. First step shipped
  2026-08-02: the query intent now answers general questions ("what oil does
  my car use?") from model knowledge, framed as guidance, and nudges the user
  to log the confirmed answer. Next: proactive suggestions (e.g. on mileage
  update, "vehicles like yours usually need a coolant flush by 60k") — maybe
  a curated interval table per make/model or an LLM pass with confidence
  gating.

- **Watch for a Next patch fixing the sharp/libvips advisory** — the only
  remaining audit item after the Next 16 migration (merged to prod
  2026-08-02 after Elias verified the preview). Bump Next when it lands.
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

## P3 — v2 ideas

- Alerts → actual notifications (Vercel Cron + Web Push/Resend); monthly
  mileage-update prompt. (In-chat reminder pass on every entry shipped
  2026-08-02 — this item is the "reach the user when they're NOT in the app"
  half.)
- More trackables: fuel fill-ups → real MPG trend; insurance renewal reminder
  (date is already stored); registration/emissions renewal dates; tire
  tread/age (DOT date); battery age; wiper age; accident/incident notes with
  photos; car-wash/detailing; parts warranty windows (e.g. "battery has 3-yr
  warranty from 2026-08"); tolls/parking for cost tracking.
- Receipt photo → OCR → autofill a maintenance log (vision route exists; add a
  "receipt" kind and link it to Glovebox uploads).
- Glovebox: camera capture on mobile, multi-file upload, file preview inline.
- Whisper fallback if Web Speech accuracy disappoints.
- VIN decode (NHTSA vPIC) → auto-fill year/make/model from a scanned VIN.
- Cost-of-ownership analytics, recall lookup, shop recommendations.
- Mobile app via Expo.

## Parked — Road trip feature (Elias has more ideas coming; don't build yet)

A "Road trip" button that runs a **pre-trip checkup**: look at the vehicle's
data (mileage, service history, pending alerts) and highlight what to do
before leaving — "you're 4,800 mi past your last oil change", "tires were
last rotated 9k ago — check tread", "engine air filter is due". Basically the
reminder pass, but run on demand with a lower "coming up" threshold and
framed as a checklist. Later extensions: fuel fill-up logging (gallons,
price, odometer → real MPG trend), grouping fill-ups/distance/costs per trip.
