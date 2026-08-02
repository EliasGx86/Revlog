# Elias — your todo list

Things only you can do (accounts, money, judgment calls). Everything else is in
[BACKLOG.md](BACKLOG.md).

## Do soon

1. **Sign up on the live app with `elias.gomez@live.com`** —
   https://revlog-blush.vercel.app. This exact email is what unlocks your admin
   access (the chat log at `/admin/chats` and the DB policies key off it).
   While you're in there, run the full loop: onboard a vehicle, log an oil
   change in chat, answer the mileage prompt, click the zones, upload a receipt
   to the Glovebox, then open `/admin/chats` and confirm you see your exchange.
   Tell me anything that feels off — that's the first real end-to-end test.
2. **Spin the new 3D garage on your phone** — the artist models + reflective
   floor shipped; I need to know if it feels smooth or janky on mobile hardware.
3. **Harley model license** — you dropped
   `3D Model Files/harley-davidson_seventy-two_hd_fxt_2015.glb` in the project.
   Send me the Sketchfab page link you got it from so I can record the license
   and attribution properly before wiring it in as the motorcycle model.

## Decisions when you're ready

4. **Budget for realistic catalog models** (~$20–60 per vehicle, 6 catalog
   vehicles). Say go and I'll shortlist exact models with prices for your
   approval — Chevy Colorado first.
5. **Custom domain** — revlog.vercel.app belongs to someone else. When branding
   feels settled, buy a domain (Vercel sells them, or Namecheap/Cloudflare) and
   I'll wire it up.

## Optional / later

6. **PostHog key** — analytics are silently off. Free tier at posthog.com →
   project API key → add `NEXT_PUBLIC_POSTHOG_KEY` in Vercel env vars + `.env.local`.
7. **Email sender** — before inviting other beta users, Supabase's built-in
   email sender will rate-limit sign-up confirmations. A free Resend account +
   SMTP config in Supabase Auth settings fixes it (I can walk you through it).
8. **`SUPABASE_SERVICE_ROLE_KEY`** — only needed when Stripe returns. Supabase
   dashboard → Settings → API → service_role → add to Vercel env vars.
