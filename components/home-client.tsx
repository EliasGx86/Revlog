"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Profile, Vehicle, Zone } from "@/lib/types";
import ChatBar from "@/components/chat-bar";
import ZoneHistoryModal from "@/components/zone-history-modal";
import VehicleInfoModal from "@/components/vehicle-info-modal";
import GloveboxModal from "@/components/glovebox-modal";
import { trackEvent } from "@/components/posthog-provider";

// Three.js is heavy and DOM-dependent — load only on the client.
const CarScene = dynamic(() => import("@/components/car/car-scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-muted">
      Loading garage…
    </div>
  ),
});

interface Props {
  profile: Profile;
  vehicle: Vehicle;
  vehicles: Vehicle[];
}

export default function HomeClient({ profile, vehicle, vehicles }: Props) {
  const router = useRouter();
  const [zone, setZone] = useState<Zone | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showGlovebox, setShowGlovebox] = useState(false);
  const [vinCopied, setVinCopied] = useState(false);

  function copyVin() {
    if (!vehicle.vin) return;
    navigator.clipboard.writeText(vehicle.vin).then(() => {
      setVinCopied(true);
      setTimeout(() => setVinCopied(false), 1500);
    });
  }

  function handleZoneClick(z: Zone) {
    trackEvent("zone_clicked", { zone: z });
    setZone(z);
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* top bar */}
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 py-4">
        <div>
          <button
            onClick={() => setShowInfo(true)}
            className="-mx-2 -my-1 rounded-md px-2 py-1 text-left transition hover:bg-surface/60"
            aria-label="Vehicle info"
          >
            <div className="text-sm font-medium">
              {vehicle.year} {vehicle.make} {vehicle.model}
              <span className="ml-1.5 text-xs text-muted">ⓘ</span>
            </div>
            <div className="text-xs text-muted">
              {vehicle.current_mileage.toLocaleString()} mi
            </div>
          </button>
          {(vehicle.license_plate || vehicle.vin) && (
            <div className="mt-1.5 flex items-center gap-2">
              {vehicle.license_plate && (
                <span className="rounded border border-border bg-surface/70 px-1.5 py-0.5 font-mono text-[11px] tracking-widest">
                  {vehicle.license_plate}
                </span>
              )}
              {vehicle.vin && (
                <button
                  onClick={copyVin}
                  title="Click to copy VIN"
                  className="font-mono text-[11px] text-muted transition hover:text-white"
                >
                  VIN {vehicle.vin}{vinCopied ? " ✓ copied" : ""}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {vehicles.length > 1 && (
            <select
              value={vehicle.id}
              onChange={(e) => router.push(`/?v=${e.target.value}`)}
              aria-label="Switch vehicle"
              className="rounded-md border border-border bg-surface/60 px-2 py-1.5 text-xs"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowGlovebox(true)}
            className="rounded-md border border-border bg-surface/60 px-3 py-1.5 text-xs text-muted hover:text-white"
          >
            🗂 Glovebox
          </button>
          <Link
            href="/onboarding"
            className="rounded-md border border-border bg-surface/60 px-3 py-1.5 text-xs text-muted hover:text-white"
          >
            + Add vehicle
          </Link>
          <form action="/auth/sign-out" method="post">
            <button className="rounded-md border border-border bg-surface/60 px-3 py-1.5 text-xs text-muted hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* 3D scene fills the viewport */}
      <div className="absolute inset-0">
        <CarScene
          bodyType={vehicle.body_type}
          color={vehicle.color}
          onZoneClick={handleZoneClick}
        />
      </div>

      {/* hint */}
      <div className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 text-center text-xs text-muted">
        Drag to rotate · click a zone to see history · use the chat bar to log or ask
      </div>

      {/* pinned chat bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-5 pt-3">
        <ChatBar vehicleId={vehicle.id} currentMileage={vehicle.current_mileage} />
      </div>

      {showInfo && (
        <VehicleInfoModal vehicle={vehicle} onClose={() => setShowInfo(false)} />
      )}

      {showGlovebox && (
        <GloveboxModal vehicleId={vehicle.id} onClose={() => setShowGlovebox(false)} />
      )}

      {/* zone modal */}
      {zone && (
        <ZoneHistoryModal
          zone={zone}
          vehicleId={vehicle.id}
          onClose={() => setZone(null)}
        />
      )}

      {/* hide profile var warning */}
      <span className="hidden">{profile.id}</span>
    </div>
  );
}
