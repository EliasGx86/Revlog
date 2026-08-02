import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase-counted sliding-window rate limits. At beta scale a row count on
// an indexed table beats standing up a KV service; swap for Upstash/Vercel KV
// if row counts ever get slow. Fails OPEN on DB errors — a broken limiter
// should never lock users out.

interface WindowOpts {
  /** Table whose rows represent one request each (needs user_id + created_at). */
  table: string;
  userId: string;
  seconds: number;
  max: number;
  /** Optional kind filter (for shared event tables like api_events). */
  kind?: string;
}

export async function overLimit(
  supabase: SupabaseClient,
  opts: WindowOpts
): Promise<boolean> {
  const since = new Date(Date.now() - opts.seconds * 1000).toISOString();
  let q = supabase
    .from(opts.table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", opts.userId)
    .gte("created_at", since);
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { count, error } = await q;
  if (error) return false;
  return (count ?? 0) >= opts.max;
}

/** Record one usage event (for routes without their own per-request log). */
export async function recordApiEvent(
  supabase: SupabaseClient,
  userId: string,
  kind: string
) {
  try {
    await supabase.from("api_events").insert({ user_id: userId, kind });
  } catch {
    // never fail the request over bookkeeping
  }
}
