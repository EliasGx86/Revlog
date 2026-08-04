"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AuthShell, { AuthPasswordField, AuthSwitchLink } from "@/components/auth/auth-shell";

// Landing page for the password-reset email link. The Supabase browser client
// exchanges the ?code= in the URL for a recovery session automatically
// (detectSessionInUrl); we wait for that session, then let the user set a new
// password. Note: the exchange only works in the browser where the reset was
// requested (PKCE) — opening the link elsewhere shows the expired-link state.

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The code→session exchange races page load; poll briefly before giving up.
    const started = Date.now();
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setReady("ok");
      } else if (Date.now() - started > 6000) {
        setReady("invalid");
      } else {
        setTimeout(check, 300);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) {
      setErr("Those passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
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
      {ready === "checking" ? (
        <p className="text-sm text-muted">Checking your reset link…</p>
      ) : ready === "invalid" ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Link expired or invalid</h2>
          <p className="text-sm leading-relaxed text-muted">
            This reset link didn&apos;t check out — it may have expired, been
            used already, or been opened on a different device than the one
            that requested it.
          </p>
          <AuthSwitchLink prompt="Try again from" href="/forgot-password" cta="Forgot password" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="text-lg font-semibold">Set a new password</h2>
          <AuthPasswordField
            label="New password"
            placeholder="min 8 characters"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <AuthPasswordField
            label="Confirm password"
            placeholder="same again"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          {err && <p className="text-sm text-red-400">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold tracking-wide transition-shadow hover:shadow-[0_0_24px_rgba(255,87,34,0.35)] disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
