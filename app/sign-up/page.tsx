"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create your RevLog account</h1>
        <input
          className="w-full rounded-md border border-border bg-surface px-3 py-2"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-border bg-surface px-3 py-2"
          type="password"
          placeholder="password (min 8 chars)"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-3 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-white underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
