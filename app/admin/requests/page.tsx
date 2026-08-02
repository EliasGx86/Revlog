import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

// Beta admin view: which makes/models users have asked for, ranked by count —
// this is the shopping list for paid 3D models. Access mirrors /admin/chats
// (email check here + admin RLS select policy from migration 0004).

interface RequestRow {
  make: string;
  model: string;
  created_at: string;
  profiles: { email: string } | null;
}

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const { data: rows } = await supabase
    .from("vehicle_requests")
    .select("make, model, created_at, profiles(email)")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<RequestRow[]>();

  // Group by normalized make+model, keep counts and who asked.
  const groups = new Map<
    string,
    { make: string; model: string; count: number; latest: string; emails: Set<string> }
  >();
  for (const r of rows ?? []) {
    const key = `${r.make.trim().toLowerCase()}|${r.model.trim().toLowerCase()}`;
    const g = groups.get(key) ?? {
      make: r.make.trim(),
      model: r.model.trim(),
      count: 0,
      latest: r.created_at,
      emails: new Set<string>(),
    };
    g.count += 1;
    if (r.created_at > g.latest) g.latest = r.created_at;
    if (r.profiles?.email) g.emails.add(r.profiles.email);
    groups.set(key, g);
  }
  const ranked = [...groups.values()].sort((a, b) => b.count - a.count);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-muted transition hover:text-white">
        ← Back to garage
      </Link>
      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Model requests</h1>
        <Link href="/admin/chats" className="text-sm text-muted hover:text-white">
          Chat log →
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Makes &amp; models users asked for, most-requested first — the shopping
        list for paid 3D models.
      </p>

      {!ranked.length ? (
        <p className="mt-10 text-muted">No requests yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {ranked.map((g) => (
            <div
              key={`${g.make}|${g.model}`}
              className="flex items-center justify-between rounded-lg border border-border bg-surface/60 p-4"
            >
              <div>
                <div className="font-medium">
                  {g.make} {g.model}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {[...g.emails].join(", ") || "unknown"} · latest{" "}
                  {new Date(g.latest).toLocaleDateString()}
                </div>
              </div>
              <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
                ×{g.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
