import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

// Admin hub: /admin was a 404 even for the admin — now it lands somewhere
// useful with a couple of live counts. Access mirrors the other admin pages.

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const [{ count: chats }, { count: requests }, { count: users }, { count: vehicles }] =
    await Promise.all([
      supabase.from("chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("vehicle_requests").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
    ]);

  const cards = [
    {
      href: "/admin/chats",
      title: "Chat log",
      desc: "Every exchange across all users — what people actually ask.",
      stat: `${chats ?? 0} messages`,
    },
    {
      href: "/admin/requests",
      title: "Model requests",
      desc: "Makes & models users asked for, ranked — the 3D shopping list.",
      stat: `${requests ?? 0} requests`,
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-muted transition hover:text-white">
        ← Back to garage
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Admin</h1>
      <p className="mt-1 text-sm text-muted">
        {users ?? 0} user{(users ?? 0) === 1 ? "" : "s"} · {vehicles ?? 0} vehicle
        {(vehicles ?? 0) === 1 ? "" : "s"} in the beta.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-border bg-surface/60 p-5 transition hover:border-accent/50"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{c.title}</span>
              <span className="text-xs text-accent">{c.stat}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{c.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
