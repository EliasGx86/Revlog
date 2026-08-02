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
import AccountModal from "@/components/account-modal";
import { HelpButton, Tip } from "@/components/help-tips";
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
  /** Zones with an overdue service — highlighted red on the model. */
  dueZones?: Zone[];
}

export default function HomeClient({ profile, vehicle, vehicles, dueZones }: Props) {
  const router = useRouter();
  const [zone, setZone] = useState<Zone | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showGlovebox, setShowGlovebox] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
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
    // dvh (not vh): mobile keyboards/browser chrome shrink the visual
    // viewport, and 100vh would push the chat bar's buttons off-screen.
    <div className="relative h-[100dvh] w-screen overflow-hidden">
      {/* top bar */}
      <header className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 py-4">
        <div>
          <Tip label="Vehicle info — VIN, plate, mileage, insurance">
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
          </Tip>
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
        {/* icon-only on phones (labels from sm: up) so nothing gets cut off */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {vehicles.length > 1 && (
            <select
              value={vehicle.id}
              onChange={(e) => router.push(`/?v=${e.target.value}`)}
              aria-label="Switch vehicle"
              className="max-w-[7rem] rounded-md border border-border bg-surface/60 px-2 py-1.5 text-xs sm:max-w-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model}
                </option>
              ))}
            </select>
          )}
          <Tip label="Documents: registration, insurance card, receipts">
            <button
              onClick={() => setShowGlovebox(true)}
              aria-label="Glovebox"
              className="rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-xs text-muted hover:text-white sm:px-3"
            >
              🗂<span className="hidden sm:inline"> Glovebox</span>
            </button>
          </Tip>
          {vehicles.length > 1 ? (
            <Tip label="All your vehicles — open, edit, add, delete">
              <Link
                href="/garage"
                aria-label="Garage"
                className="rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-xs text-muted hover:text-white sm:px-3"
              >
                🏠<span className="hidden sm:inline"> Garage</span>
              </Link>
            </Tip>
          ) : (
            <Tip label="Put another vehicle in your garage">
              <Link
                href="/onboarding"
                aria-label="Add vehicle"
                className="rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-xs text-muted hover:text-white sm:px-3"
              >
                ＋<span className="hidden sm:inline"> Add vehicle</span>
              </Link>
            </Tip>
          )}
          <HelpButton />
          <Tip label="Your account — email, plan, sign out">
            <button
              onClick={() => setShowAccount(true)}
              aria-label="Your account"
              className="rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-sm text-muted hover:text-white"
            >
              👤
            </button>
          </Tip>
        </div>
      </header>

      {/* 3D scene fills the viewport */}
      <div className="absolute inset-0">
        <CarScene
          bodyType={vehicle.body_type}
          color={vehicle.color}
          licensePlate={vehicle.license_plate}
          dueZones={dueZones}
          onZoneClick={handleZoneClick}
        />
      </div>

      {/* hint — lower on phones so it clears the (taller) wrapped header */}
      <div className="pointer-events-none absolute left-1/2 top-32 w-full max-w-md -translate-x-1/2 px-6 text-center text-xs text-muted sm:top-20">
        {dueZones && dueZones.length > 0 ? (
          <span className="text-red-400">
            ● Service due — check the highlighted zone{dueZones.length > 1 ? "s" : ""}
          </span>
        ) : (
          "Drag to rotate · click a zone to see history · use the chat bar to log or ask"
        )}
      </div>

      {/* pinned chat bar — generous bottom padding: mobile browsers overlay
          their own chrome at the bottom edge (safe-area covers standalone;
          the extra rem covers floating URL bars) */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
        <ChatBar vehicleId={vehicle.id} currentMileage={vehicle.current_mileage} />
      </div>

      {showInfo && (
        <VehicleInfoModal vehicle={vehicle} onClose={() => setShowInfo(false)} />
      )}
      {showAccount && (
        <AccountModal
          profile={profile}
          vehicles={vehicles}
          onClose={() => setShowAccount(false)}
        />
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
