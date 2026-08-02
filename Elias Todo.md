# Elias — your todo list

Things only you can do (accounts, money, judgment calls). Everything else is in
[BACKLOG.md](BACKLOG.md).

## Do soon

1. **Close the Dependabot PR** on GitHub (branch
   `dependabot/npm_and_yarn/...` — its Vercel build shows red). It wanted to
   bump Next; we've since gone all the way to Next 16 ourselves, so it's
   superseded. Repo → Pull requests → close.
2. **Finish kicking the tires** (the E2E leftovers in BACKLOG): upload
   something to the Glovebox, scan a VIN/plate with the 📷 button, tell the
   chat your insurance, and add a second vehicle to see the new
   "Initializing…" flow + customizations field. Report anything weird.
3. **Re-check the two mobile complaints** after the latest deploy: chat bar
   vs. the browser's bottom bar, and the header buttons (now icon-only on
   phones). If the chat still hides behind the URL bar, screenshot it.

## Decisions when you're ready

4. **Budget for realistic catalog models** (~$20–60 per vehicle). Say go and
   I'll shortlist exact models with prices — Chevy Colorado first, ranked by
   /admin/requests after that.
5. **Custom domain** — revlog.vercel.app belongs to someone else. When
   branding feels settled, buy a domain (Vercel sells them, or
   Namecheap/Cloudflare) and I'll wire it up.
6. **Road trip feature spec** — you said "more to come on this"; the pre-trip
   checkup concept is parked at the bottom of BACKLOG.md whenever you're
   ready to flesh it out.

## Optional / later

7. **PostHog key** — analytics are silently off. Free tier at posthog.com →
   project API key → add `NEXT_PUBLIC_POSTHOG_KEY` in Vercel env vars + `.env.local`.
8. **Email sender** — before inviting other beta users, Supabase's built-in
   email sender will rate-limit sign-up confirmations. A free Resend account +
   SMTP config in Supabase Auth settings fixes it (I can walk you through it).
9. **`SUPABASE_SERVICE_ROLE_KEY`** — only needed when Stripe returns. Supabase
   dashboard → Settings → API → service_role → add to Vercel env vars.
10. **`gh auth login`** in a terminal here, if you want me to be able to manage
    GitHub PRs/issues directly next session.

## Done (kept for the record)

- ~~Sign up with elias.gomez@live.com~~ — done 2026-08-02, admin unlocked.
- ~~Spin the 3D garage on your phone~~ — done, feedback drove the mobile fixes.
- ~~Harley model license link~~ — not needed; the GLB's embedded metadata had
  license + author + source (CC-BY 4.0, Alex.Ka.).
- ~~Verify the next16 preview~~ — done, merged to production same day.
