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
3. **Re-check mobile on your phone** after the latest deploy. The big fix:
   iOS was zooming the whole page every time you tapped an input (fonts under
   16px trigger it) and never zooming back out — that's the "blown up / cut
   off" feeling. Also fixed: all modals now scroll instead of getting cut
   off, and the header VIN line wraps. If anything still looks off,
   screenshot it.
4. **Supabase Auth URL config** (needed for the new forgot-password flow):
   dashboard → your RevLog project → Authentication → URL Configuration →
   set **Site URL** to `https://revlog-blush.vercel.app` and add
   `https://revlog-blush.vercel.app/reset-password` (plus
   `http://localhost:3000/reset-password` for dev) to **Redirect URLs**.
   Then test: sign out → "Forgot password?" → check the email arrives and
   the link lets you set a new password.
5. **Your stored VINs are junk** — the Colorado has VIN "TEST" and the 2026
   Civic "865MDFSDF…" (from testing). Trim decode skips invalid VINs, so put
   the real 17-char VINs in via Garage → Edit (or the 📷 scan) to get the
   trim + engine/drivetrain specs pulled automatically. Manual VIN entry now
   rejects anything that isn't 17 valid characters.
6. **Check your trim appeared** — open the app once per vehicle; if a VIN is
   on file, the trim (LX/EX-style submodel) decodes automatically and shows
   next to the model name + in the info modal. Tell me if it decoded wrong.

## Decisions when you're ready

7. **Budget for realistic catalog models** (~$20–60 per vehicle). Say go and
   I'll shortlist exact models with prices — Chevy Colorado first, ranked by
   /admin/requests after that.
8. **Custom domain** — revlog.vercel.app belongs to someone else. When
   branding feels settled, buy a domain (Vercel sells them, or
   Namecheap/Cloudflare) and I'll wire it up.
9. **Road trip feature spec** — you said "more to come on this"; the pre-trip
   checkup concept is parked at the bottom of BACKLOG.md whenever you're
   ready to flesh it out.

## Optional / later

10. **PostHog key** — analytics are silently off. Free tier at posthog.com →
   project API key → add `NEXT_PUBLIC_POSTHOG_KEY` in Vercel env vars + `.env.local`.
11. **Email sender** — before inviting other beta users, Supabase's built-in
   email sender will rate-limit sign-up confirmations. A free Resend account +
   SMTP config in Supabase Auth settings fixes it (I can walk you through it).
12. **`SUPABASE_SERVICE_ROLE_KEY`** — only needed when Stripe returns. Supabase
   dashboard → Settings → API → service_role → add to Vercel env vars.
13. **`gh auth login`** in a terminal here, if you want me to be able to manage
    GitHub PRs/issues directly next session.

## Done (kept for the record)

- ~~Sign up with elias.gomez@live.com~~ — done 2026-08-02, admin unlocked.
- ~~Spin the 3D garage on your phone~~ — done, feedback drove the mobile fixes.
- ~~Harley model license link~~ — not needed; the GLB's embedded metadata had
  license + author + source (CC-BY 4.0, Alex.Ka.).
- ~~Verify the next16 preview~~ — done, merged to production same day.
