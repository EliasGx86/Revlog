# GarageIQ

Talk to your car. Log maintenance and ask questions about your car's history — all through natural language. A 3D model of your actual vehicle (body type + color) sits at the center of the home screen, with clickable zones for hood, wheels, and windshield.

**Stack:** Next.js (App Router) on Vercel · Supabase (Postgres + Auth) · Stripe (subscriptions) · OpenAI GPT-4o Mini · Three.js / React Three Fiber · PostHog · Tailwind.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# fill in Supabase, OpenAI, Stripe, PostHog values

# 3. Apply database schema (paste supabase/migrations/0001_init.sql in Supabase SQL editor,
#    or use the Supabase CLI: supabase db push)

# 4. Run
npm run dev
# open http://localhost:3000
```

---

## Setup details

### Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Settings → API: copy the project URL and `anon` and `service_role` keys into `.env.local`.
3. Run `supabase/migrations/0001_init.sql` in the SQL editor. This creates `profiles`, `vehicles`, `maintenance_logs`, `alerts`, RLS policies, and an auth trigger that auto-creates a profile row on signup.
4. Authentication → Providers: enable Email (the default).

### OpenAI
- Create a key at [platform.openai.com](https://platform.openai.com).
- The app uses `gpt-4o-mini` for both the intent router and the log-extraction / Q&A prompts. Costs are negligible for v1.

### Stripe
1. Create two recurring prices in test mode (one monthly, one yearly) on a single product.
2. Copy the price IDs into `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_YEARLY`.
3. Copy your test secret key into `STRIPE_SECRET_KEY` and publishable key into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. Local webhook forwarding for testing:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
5. In production (Vercel), add the same env vars and create a webhook endpoint pointing at `https://your-domain/api/stripe/webhook` with the events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

### PostHog
- Create a project, copy the project API key into `NEXT_PUBLIC_POSTHOG_KEY`. Default host is US cloud; set `NEXT_PUBLIC_POSTHOG_HOST` to `https://eu.i.posthog.com` for EU. Pageviews capture automatically; explicit events fired so far: `zone_clicked`, `voice_input_start`, `chat_message_sent`.

### Vercel
- Push to GitHub and import the repo into Vercel. Add all `.env.local` vars to the project settings. Set `NEXT_PUBLIC_APP_URL` to your production domain (used for Stripe redirects).

---

## How the LLM flows work

**Logging** — user says "just changed my oil with Mobil 1 full synthetic":
1. `/api/chat` calls GPT-4o Mini with a tiny router prompt → classifies as `log`.
2. Second call extracts `{service_type, service_date, mileage, product_brand, product_name, product_details, notes}` as JSON.
3. Row written to `maintenance_logs` with `raw_input` preserved.
4. If a mileage interval applies (e.g. oil change every 5,000 mi) and we know the current mileage, an `alerts` row is queued for the next due service.
5. If no mileage was given, the chat bar inline-prompts: "What's the current mileage?"

**Querying** — user asks "when did I last change my oil?":
1. Router classifies as `query`.
2. Last 50 logs for this vehicle are loaded and passed as JSON context.
3. GPT-4o Mini answers in 1–3 sentences, grounded in the history (instructed not to invent facts).

**Smalltalk** — anything else gets a brief friendly nudge to log or ask a question.

---

## Architecture notes

- **Auth & access gate.** `middleware.ts` redirects unauthenticated users to `/sign-in`. The home page additionally redirects to `/onboarding` if the user has no vehicle or doesn't have an active subscription. The Stripe webhook flips `profiles.subscription_status` to `active` and `onboarded` to `true`.
- **Procedural 3D car.** [components/car/car-model.tsx](components/car/car-model.tsx) builds the car from Three.js primitives. Body type swaps proportions (sedan, SUV, truck with bed); color is a material prop. Hood, wheels, and windshield are separate click groups. To swap in real GLB models later, replace this file's contents and keep the same prop interface — the rest of the app doesn't need to change.
- **Voice input.** Web Speech API (`webkitSpeechRecognition`). Free, browser-native, fine for short utterances. Upgrade path to Whisper is a single API route swap.
- **Rate limiting / abuse.** Not in v1. Add Upstash Ratelimit or Vercel KV in front of `/api/chat` before public launch.
- **Mileage reminders.** Schema supports `alerts.due_mileage` and `alerts.due_date`. Push notifications and a monthly mileage-update prompt are scheduled work — wire to Vercel Cron + a notification provider (Web Push, Resend, Twilio) in v2.

---

## File layout

```
app/
  page.tsx                  home (3D + chat)
  sign-in/                  auth pages
  sign-up/
  onboarding/               vehicle setup + plan selection
  api/
    chat/route.ts           LLM router + log + query
    chat/mileage/route.ts   inline mileage answer
    stripe/checkout/route.ts
    stripe/webhook/route.ts
  auth/sign-out/route.ts
components/
  car/car-scene.tsx         R3F canvas + lights + controls
  car/car-model.tsx         procedural car geometry
  chat-bar.tsx              pinned bottom bar w/ voice
  home-client.tsx           home shell
  zone-history-modal.tsx    per-zone log list
  posthog-provider.tsx
lib/
  supabase/{client,server}.ts
  stripe.ts
  openai.ts
  types.ts                  shared types + SERVICE_CATALOG
middleware.ts               auth gate
supabase/migrations/0001_init.sql
```

---

## V2 ideas (not in this scaffold)

- Whisper for voice transcription if Web Speech accuracy is insufficient
- Vercel Cron job for monthly mileage prompt push
- Web Push / email reminders when an alert is due
- Real GLB car models per make/model
- Photo upload for receipts → OCR → autofill log
- Mobile app via Expo (the API and schema are already ready)
- Cost-of-ownership analytics, service shop recommendations, recall lookup
