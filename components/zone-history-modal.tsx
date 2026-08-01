"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MaintenanceLog, Zone } from "@/lib/types";
import { SERVICE_CATALOG } from "@/lib/types";

const ZONE_LABELS: Record<Zone, string> = {
  hood: "Under the hood",
  wheels: "Wheels & tires",
  windshield: "Windshield",
  other: "Other",
};

const ZONE_SERVICES: Record<Zone, string[]> = {
  hood: ["oil_change","coolant_flush","brake_fluid","transmission_fluid","air_filter","battery"],
  wheels: ["brake_pads","tire_rotation","tires","rotors"],
  windshield: ["wiper_blades"],
  other: [],
};

interface Props {
  zone: Zone;
  vehicleId: string;
  onClose: () => void;
}

export default function ZoneHistoryModal({ zone, vehicleId, onClose }: Props) {
  const [logs, setLogs] = useState<MaintenanceLog[] | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const services = ZONE_SERVICES[zone];
    let q = supabase
      .from("maintenance_logs")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("service_date", { ascending: false })
      .limit(50);
    if (services.length) q = q.in("service_type", services);
    q.then(({ data }) => setLogs((data as MaintenanceLog[]) || []));
  }, [zone, vehicleId]);

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
          <h2 className="text-lg font-semibold">{ZONE_LABELS[zone]}</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            ✕
          </button>
        </div>

        <div className="mt-4">
          {logs === null && <p className="text-sm text-muted">Loading…</p>}
          {logs && logs.length === 0 && (
            <p className="text-sm text-muted">
              No history yet. Tell GarageIQ when you service something — like
              &quot;changed my oil today, full synthetic Mobil 1.&quot;
            </p>
          )}
          {logs && logs.length > 0 && (
            <ul className="space-y-2">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-lg border border-border bg-bg/60 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {SERVICE_CATALOG[log.service_type]?.label || log.service_type}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(log.service_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {log.mileage != null && <span>{log.mileage.toLocaleString()} mi · </span>}
                    {log.product_brand && <span>{log.product_brand} </span>}
                    {log.product_name && <span>{log.product_name}</span>}
                  </div>
                  {log.notes && <div className="mt-1 text-xs text-muted">{log.notes}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
