// Beta admin allowlist. Must match the emails in the *_admin_select RLS
// policies (supabase/migrations/0004) — the page check hides the UI, the RLS
// policies are what actually protect the data.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "elias.gomez@live.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export function isAdminEmail(email: string | undefined | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
