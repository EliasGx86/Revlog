"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import AuthShell, { AuthField, AuthPasswordField, AuthSwitchLink } from "@/components/auth/auth-shell";

export default function SignInPage() {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold">Back in the garage</h2>
        <AuthField
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <AuthPasswordField
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <p className="-mt-2 text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-muted underline decoration-border underline-offset-4 transition hover:text-white"
          >
            Forgot password?
          </Link>
        </p>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold tracking-wide transition-shadow hover:shadow-[0_0_24px_rgba(255,87,34,0.35)] disabled:opacity-50"
        >
          {loading ? "Starting up…" : "Sign in"}
        </button>
        <AuthSwitchLink prompt="New here?" href="/sign-up" cta="Create an account" />
      </form>
    </AuthShell>
  );
}
