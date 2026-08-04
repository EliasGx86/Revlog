"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AuthShell, { AuthField, AuthSwitchLink } from "@/components/auth/auth-shell";

// Request a password-reset email. The link lands on /reset-password (must be
// an allowed redirect URL in Supabase Auth settings). Always shows the same
// "sent" message so the form can't be used to probe which emails exist.

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="text-sm leading-relaxed text-muted">
            If an account exists for <span className="text-white">{email}</span>,
            a reset link is on its way. Open it on this device to set a new
            password.
          </p>
          <AuthSwitchLink prompt="Remembered it after all?" href="/sign-in" cta="Sign in" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="text-lg font-semibold">Locked out?</h2>
          <p className="text-sm leading-relaxed text-muted">
            Enter your email and we&apos;ll send you a link to set a new
            password.
          </p>
          <AuthField
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold tracking-wide transition-shadow hover:shadow-[0_0_24px_rgba(255,87,34,0.35)] disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <AuthSwitchLink prompt="Back to" href="/sign-in" cta="Sign in" />
        </form>
      )}
    </AuthShell>
  );
}
