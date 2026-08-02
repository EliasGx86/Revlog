"use client";

import { useState } from "react";
import type { Vehicle } from "@/lib/types";

// At-a-glance text info for the selected vehicle. Opened from the home header.

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

const BODY_LABELS: Record<Vehicle["body_type"], string> = {
  sedan: "Sedan",
  suv: "SUV",
  truck: "Truck",
  motorcycle: "Motorcycle",
};

export default function VehicleInfoModal({ vehicle, onClose }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  const rows: { label: string; value: React.ReactNode; copyValue?: string }[] = [
    { label: "Vehicle", value: `${vehicle.year} ${vehicle.make} ${vehicle.model}` },
    { label: "Body type", value: BODY_LABELS[vehicle.body_type] },
    {
      label: "Color",
      value: (
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-4 w-4 rounded-full border border-border"
            style={{ backgroundColor: vehicle.color }}
          />
          {vehicle.color}
        </span>
      ),
    },
    {
      label: "Mileage",
      value: `${vehicle.current_mileage.toLocaleString()} mi (updated ${new Date(
        vehicle.mileage_updated_at
      ).toLocaleDateString()})`,
    },
    {
      label: "VIN",
      value: vehicle.vin ?? <span className="text-muted">not on file</span>,
      copyValue: vehicle.vin ?? undefined,
    },
    {
      label: "License plate",
      value: vehicle.license_plate ?? <span className="text-muted">not on file</span>,
      copyValue: vehicle.license_plate ?? undefined,
    },
    { label: "Added", value: new Date(vehicle.created_at).toLocaleDateString() },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vehicle info</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            ✕
          </button>
        </div>

        <dl className="mt-4 divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-muted">{r.label}</dt>
              <dd className="flex items-center gap-2 text-sm">
                {r.value}
                {r.copyValue && (
                  <button
                    onClick={() => copy(r.label, r.copyValue!)}
                    className="rounded border border-border px-1.5 py-0.5 text-xs text-muted hover:text-white"
                  >
                    {copied === r.label ? "Copied ✓" : "Copy"}
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-muted">
          Service history lives on the 3D model — click the hood, wheels, or
          windshield. Ask the chat bar anything else.
        </p>
      </div>
    </div>
  );
}
