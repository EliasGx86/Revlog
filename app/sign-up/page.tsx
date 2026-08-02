"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AuthShell, { AuthField, AuthSwitchLink } from "@/components/auth/auth-shell";

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
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold">Pull into the garage</h2>
        <AuthField
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <AuthField
          label="Password"
          type="password"
          placeholder="min 8 characters"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold tracking-wide transition-shadow hover:shadow-[0_0_24px_rgba(255,87,34,0.35)] disabled:opacity-50"
        >
          {loading ? "Firing up…" : "Create account"}
        </button>
        <p className="text-center text-[11px] leading-relaxed text-muted">
          Free while in beta — no card needed.
        </p>
        <AuthSwitchLink prompt="Already have an account?" href="/sign-in" cta="Sign in" />
      </form>
    </AuthShell>
  );
}
