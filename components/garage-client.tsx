"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/types";

// Garage grid: card per vehicle with open / edit / delete. Editing covers the
// facts that change (year, color, mileage, plate, VIN, make/model text) —
// body type is fixed at onboarding since the 3D model hangs off it.

const BODY_LABELS: Record<Vehicle["body_type"], string> = {
  sedan: "Sedan",
  suv: "SUV",
  truck: "Truck",
  motorcycle: "Motorcycle",
};

const COLORS = [
  "#f2f2f2", "#111114", "#c7c9cc", "#6b6f75", "#cc2222",
  "#1e4fd8", "#1f7a3d", "#e46b1a", "#e8c020", "#6b4a2f",
];

interface Props {
  vehicles: Vehicle[];
}

export default function GarageClient({ vehicles }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function deleteVehicle(v: Vehicle) {
    const ok = window.confirm(
      `Delete the ${v.year} ${v.make} ${v.model}? This permanently removes its service history, documents, specs, and insurance info.`
    );
    if (!ok) return;
    setBusy(v.id);
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("vehicles").delete().eq("id", v.id);
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="text-sm text-muted transition hover:text-white">
        ← Back to garage view
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your garage</h1>
        <Link
          href="/onboarding"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium"
        >
          + Add vehicle
        </Link>
      </div>

      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {vehicles.map((v) => (
          <div
            key={v.id}
            className="rounded-xl border border-border bg-surface/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: v.color }}
                  />
                  <span className="font-medium">
                    {v.year} {v.make} {v.model}
                    {v.trim && (
                      <span className="ml-1 text-xs font-normal text-muted">{v.trim}</span>
                    )}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {BODY_LABELS[v.body_type]} · {v.current_mileage.toLocaleString()} mi
                  {v.license_plate && (
                    <span className="ml-2 rounded border border-border bg-bg/60 px-1.5 py-0.5 font-mono text-[10px] tracking-widest">
                      {v.license_plate}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                href={`/?v=${v.id}`}
                className="rounded-md bg-accent/90 px-3 py-1.5 text-xs font-medium"
              >
                Open
              </Link>
              <button
                onClick={() => setEditing(v)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-white"
              >
                Edit
              </button>
              <button
                onClick={() => deleteVehicle(v)}
                disabled={busy === v.id}
                className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs text-muted transition hover:border-red-400/50 hover:text-red-400 disabled:opacity-50"
              >
                {busy === v.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditVehicleModal
          vehicle={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function EditVehicleModal({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [make, setMake] = useState(vehicle.make);
  const [model, setModel] = useState(vehicle.model);
  const [year, setYear] = useState(vehicle.year);
  const [color, setColor] = useState(vehicle.color);
  const [mileage, setMileage] = useState(String(vehicle.current_mileage || ""));
  const [plate, setPlate] = useState(vehicle.license_plate ?? "");
  const [vin, setVin] = useState(vehicle.vin ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    const newMileage = parseInt(mileage || "0", 10);
    const newVin = vin.trim().toUpperCase() || null;
    const { error } = await supabase
      .from("vehicles")
      .update({
        make: make.trim(),
        model: model.trim(),
        year,
        color,
        current_mileage: newMileage,
        ...(newMileage !== vehicle.current_mileage
          ? { mileage_updated_at: new Date().toISOString() }
          : {}),
        license_plate: plate.trim().toUpperCase() || null,
        vin: newVin,
      })
      .eq("id", vehicle.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // New/changed VIN → refresh the decoded trim + stock facts (best-effort).
    if (newVin && newVin !== vehicle.vin) {
      fetch("/api/vehicle/decode-vin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: vehicle.id }),
      }).catch(() => {});
    }
    onSaved();
  }

  const field =
    "mt-1 w-full rounded-md border border-border bg-bg/70 px-3 py-2 text-sm";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit vehicle</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-white">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm text-muted">
            Make
            <input className={field} value={make} onChange={(e) => setMake(e.target.value)} required />
          </label>
          <label className="block text-sm text-muted">
            Model
            <input className={field} value={model} onChange={(e) => setModel(e.target.value)} required />
          </label>
          <label className="block text-sm text-muted">
            Year
            <select
              className={field}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
            >
              {Array.from({ length: 60 }, (_, i) => new Date().getFullYear() + 1 - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-muted">
            Mileage
            <input
              className={field}
              type="text"
              inputMode="numeric"
              value={mileage}
              onChange={(e) => setMileage(e.target.value.replace(/[^0-9]/g, ""))}
              required
            />
          </label>
          <label className="block text-sm text-muted">
            License plate
            <input
              className={`${field} font-mono uppercase`}
              value={plate}
              maxLength={10}
              onChange={(e) => setPlate(e.target.value)}
            />
          </label>
          <label className="block text-sm text-muted">
            VIN
            <input
              className={`${field} font-mono uppercase`}
              value={vin}
              maxLength={17}
              onChange={(e) => setVin(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-3">
          <span className="text-sm text-muted">Color</span>
          <div className="mt-2 grid grid-cols-10 gap-1.5">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={`h-8 rounded-md border-2 ${
                  color === c ? "border-accent" : "border-border"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-5 w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
