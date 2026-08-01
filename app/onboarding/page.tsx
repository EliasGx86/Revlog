"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BodyType, Plan } from "@/lib/types";

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: "sedan", label: "Sedan" },
  { value: "truck", label: "Truck" },
  { value: "suv",   label: "SUV" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [color, setColor] = useState("#cc0000");
  const [bodyType, setBodyType] = useState<BodyType>("sedan");
  const [mileage, setMileage] = useState<number>(0);
  const [plan, setPlan] = useState<Plan>("monthly");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: vErr } = await supabase.from("vehicles").insert({
        user_id: user.id,
        make,
        model,
        year,
        color,
        body_type: bodyType,
        current_mileage: mileage,
      });
      if (vErr) throw vErr;

      // Send to Stripe checkout. On success, webhook flips profile.onboarded = true.
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Checkout failed");
      window.location.href = json.url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Set up your garage</h1>
      <p className="mt-1 text-sm text-muted">
        Tell us about your car. We&apos;ll build a 3D model that matches.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            className="rounded-md border border-border bg-surface px-3 py-2"
            placeholder="Make (e.g. Toyota)"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            required
          />
          <input
            className="rounded-md border border-border bg-surface px-3 py-2"
            placeholder="Model (e.g. Tacoma)"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            className="rounded-md border border-border bg-surface px-3 py-2"
            placeholder="Year"
            value={year}
            min={1900}
            max={2100}
            onChange={(e) => setYear(parseInt(e.target.value || "0", 10))}
            required
          />
          <input
            type="number"
            className="rounded-md border border-border bg-surface px-3 py-2"
            placeholder="Current mileage"
            value={mileage}
            min={0}
            onChange={(e) => setMileage(parseInt(e.target.value || "0", 10))}
            required
          />
        </div>

        <div>
          <label className="text-sm text-muted">Body type</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {BODY_TYPES.map((b) => (
              <button
                type="button"
                key={b.value}
                onClick={() => setBodyType(b.value)}
                className={`rounded-md border px-3 py-2 text-sm transition ${
                  bodyType === b.value
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-muted">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-16 rounded-md border border-border bg-surface"
          />
          <span className="text-sm text-muted">{color}</span>
        </div>

        <div>
          <label className="text-sm text-muted">Plan</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPlan("monthly")}
              className={`rounded-md border px-3 py-3 text-sm transition ${
                plan === "monthly"
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface"
              }`}
            >
              <div className="font-medium">Monthly</div>
              <div className="text-xs text-muted">Billed every month</div>
            </button>
            <button
              type="button"
              onClick={() => setPlan("yearly")}
              className={`rounded-md border px-3 py-3 text-sm transition ${
                plan === "yearly"
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface"
              }`}
            >
              <div className="font-medium">Yearly</div>
              <div className="text-xs text-muted">Save vs monthly</div>
            </button>
          </div>
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-3 py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Redirecting to checkout…" : "Continue to payment"}
        </button>
      </form>
    </main>
  );
}
