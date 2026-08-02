import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

// Beta admin view: every chat exchange across all users. Access is enforced
// twice — this email check 404s for non-admins, and the RLS admin policies
// (migration 0004) are what actually release other users' rows.

interface ChatRow {
  id: string;
  message: string;
  intent: string;
  reply: string;
  created_at: string;
  profiles: { email: string } | null;
  vehicles: { year: number; make: string; model: string } | null;
}

const INTENT_STYLES: Record<string, string> = {
  log: "bg-emerald-500/15 text-emerald-400",
  query: "bg-sky-500/15 text-sky-400",
  insurance: "bg-violet-500/15 text-violet-400",
  spec: "bg-amber-500/15 text-amber-400",
  smalltalk: "bg-zinc-500/15 text-zinc-400",
};

export const dynamic = "force-dynamic";

export default async function AdminChatsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const { data: rows } = await supabase
    .from("chat_messages")
    .select(
      "id, message, intent, reply, created_at, profiles(email), vehicles(year, make, model)"
    )
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ChatRow[]>();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-muted transition hover:text-white">
        ← Back to garage
      </Link>
      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Chat log</h1>
        <Link href="/admin/requests" className="text-sm text-muted hover:text-white">
          Model requests →
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Last {rows?.length ?? 0} exchanges across all users, newest first.
        You&apos;re seeing this because you&apos;re signed in as an admin.
      </p>

      {!rows?.length ? (
        <p className="mt-10 text-muted">No chat messages yet.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-surface/60 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span
                  className={`rounded-full px-2 py-0.5 font-medium capitalize ${
                    INTENT_STYLES[r.intent] ?? INTENT_STYLES.smalltalk
                  }`}
                >
                  {r.intent}
                </span>
                <span>{r.profiles?.email ?? "unknown user"}</span>
                {r.vehicles && (
                  <span>
                    · {r.vehicles.year} {r.vehicles.make} {r.vehicles.model}
                  </span>
                )}
                <span className="ml-auto">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm">
                <span className="text-muted">Q:</span> {r.message}
              </p>
              <p className="mt-1 text-sm">
                <span className="text-muted">A:</span> {r.reply}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
