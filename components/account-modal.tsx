"use client";

import Link from "next/link";
import type { Profile, Vehicle } from "@/lib/types";

// The user's own info at a glance: account, membership, garage summary.
// Sign out lives here too (declutters the home header on phones).

interface Props {
  profile: Profile;
  vehicles: Vehicle[];
  onClose: () => void;
}

export default function AccountModal({ profile, vehicles, onClose }: Props) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Email", value: profile.email },
    {
      label: "Member since",
      value: new Date(profile.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    {
      label: "Plan",
      value: (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Beta — free
        </span>
      ),
    },
    {
      label: "Garage",
      value: `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your account</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            ✕
          </button>
        </div>

        <dl className="mt-4 divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-muted">{r.label}</dt>
              <dd className="text-sm">{r.value}</dd>
            </div>
          ))}
        </dl>

        {vehicles.length > 0 && (
          <ul className="mt-1 space-y-1">
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-xs text-muted">
                <span>
                  {v.year} {v.make} {v.model}
                </span>
                <span>{v.current_mileage.toLocaleString()} mi</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/garage"
          className="mt-2 inline-block text-xs text-muted underline decoration-border underline-offset-4 hover:text-white"
        >
          Manage garage →
        </Link>

        <form action="/auth/sign-out" method="post" className="mt-5">
          <button className="w-full rounded-md border border-border px-3 py-2 text-sm text-muted transition hover:border-red-400/50 hover:text-red-400">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
