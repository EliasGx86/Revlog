import { createBrowserClient } from "@supabase/ssr";

// Placeholders so prerender / build doesn't crash when env vars aren't set.
// Real values come from `.env.local` (or Vercel env) at runtime in the browser.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export function createSupabaseBrowserClient() {
  return createBrowserClient(URL, ANON);
}
