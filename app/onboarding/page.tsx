"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BodyType } from "@/lib/types";
import { VEHICLE_CATALOG } from "@/lib/vehicle-catalog";

// Downscale a photo client-side so uploads stay small (phone photos are huge).
async function fileToDataUrl(file: File, maxDim = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

// Text input with a camera button that photographs the VIN / plate and OCRs it.
function ScanInput({
  kind,
  label,
  placeholder,
  value,
  maxLength,
  onChange,
}: {
  kind: "vin" | "plate";
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  onChange: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanErr(false);
    setScanning(true);
    try {
      const image = await fileToDataUrl(file);
      const res = await fetch("/api/vision/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, kind }),
      });
      const json = await res.json();
      if (res.ok && json.value) onChange(json.value);
      else setScanErr(true);
    } catch {
      setScanErr(true);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div>
      <label htmlFor={`scan-${kind}`} className="text-sm text-muted">{label}</label>
      <div className="mt-1 flex gap-1.5">
        <input
          id={`scan-${kind}`}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 font-mono uppercase placeholder:font-sans placeholder:normal-case"
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          title="Scan with camera"
          disabled={scanning}
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-border bg-surface px-3 text-sm disabled:opacity-50"
        >
          {scanning ? "…" : "📷"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
      </div>
      {scanning && <p className="mt-1 text-xs text-muted">Reading photo…</p>}
      {scanErr && (
        <p className="mt-1 text-xs text-red-400">
          Couldn&apos;t read it — try a closer, well-lit shot or type it in.
        </p>
      )}
    </div>
  );
}

// Shown while /api/vehicle/initialize pulls factory specs. Pure theater over
// a single API call, but "initializing" beats a blank redirect.
const INIT_LINES = [
  "Pulling factory specs…",
  "Checking fluids and filters…",
  "Sizing up the tires…",
  "Reading the build sheet…",
  "Topping off the details…",
];

function InitializingScreen({ make, model, year }: { make: string; model: string; year: number }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % INIT_LINES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
      <h1 className="mt-6 text-xl font-semibold">
        Initializing your {year} {make} {model}
      </h1>
      <p className="mt-2 text-sm text-muted">{INIT_LINES[line]}</p>
      <p className="mt-6 max-w-xs text-xs text-muted/70">
        Loading stock specs — oil, filters, tire size — into your glovebox so
        they&apos;re one question away.
      </p>
    </main>
  );
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: "sedan",      label: "Sedan" },
  { value: "truck",      label: "Truck" },
  { value: "suv",        label: "SUV" },
  { value: "motorcycle", label: "Motorcycle" },
];

// Tap-friendly preset swatches — much easier than a native color wheel on mobile.
const COLORS: { value: string; label: string }[] = [
  { value: "#f2f2f2", label: "White" },
  { value: "#111114", label: "Black" },
  { value: "#c7c9cc", label: "Silver" },
  { value: "#6b6f75", label: "Gray" },
  { value: "#cc2222", label: "Red" },
  { value: "#1e4fd8", label: "Blue" },
  { value: "#1f7a3d", label: "Green" },
  { value: "#e46b1a", label: "Orange" },
  { value: "#e8c020", label: "Yellow" },
  { value: "#6b4a2f", label: "Brown" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [pick, setPick] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [color, setColor] = useState(COLORS[4].value); // Red
  const [bodyType, setBodyType] = useState<BodyType>("sedan");
  const [mileage, setMileage] = useState("");
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [customizations, setCustomizations] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  // Returning users (adding another vehicle) get a way back; first-timers
  // have no garage to go back to yet.
  const [hasVehicles, setHasVehicles] = useState(false);

  useEffect(() => {
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setHasVehicles((count ?? 0) > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPick(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setPick(v);
    setRequestSent(false);
    const cat = VEHICLE_CATALOG.find((c) => c.id === v);
    if (cat) {
      setMake(cat.make);
      setModel(cat.model);
      setBodyType(cat.bodyType);
    } else {
      setMake("");
      setModel("");
      setBodyType(v === "motorcycle" ? "motorcycle" : "sedan");
    }
  }

  async function requestModel() {
    setErr(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("vehicle_requests").insert({
        user_id: user.id,
        make: make.trim(),
        model: model.trim(),
      });
      if (error) throw error;
      setRequestSent(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Couldn't send the request");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: created, error: vErr } = await supabase
        .from("vehicles")
        .insert({
          user_id: user.id,
          make,
          model,
          year,
          color,
          body_type: bodyType,
          current_mileage: parseInt(mileage || "0", 10),
          vin: vin.trim().toUpperCase() || null,
          license_plate: plate.trim().toUpperCase() || null,
        })
        .select("id")
        .single();
      if (vErr) throw vErr;

      // BETA: free for everyone — no checkout. Mark onboarding complete and go.
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ onboarded: true })
        .eq("id", user.id);
      if (pErr) throw pErr;

      // Initialization: pull OEM/stock specs (and parse any customizations)
      // so the specs panel isn't empty on day one. Best-effort — a failure
      // or slow model never blocks entry to the garage.
      if (created?.id) {
        setInitializing(true);
        try {
          await Promise.race([
            fetch("/api/vehicle/initialize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                vehicleId: created.id,
                customizations: customizations.trim() || undefined,
              }),
            }),
            new Promise((resolve) => setTimeout(resolve, 20_000)),
          ]);
        } catch {
          // proceed regardless
        }
      }

      // Land on the vehicle that was just added, not the first in the garage.
      router.push(created?.id ? `/?v=${created.id}` : "/");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
      setInitializing(false);
    }
  }

  if (initializing) {
    return <InitializingScreen make={make} model={model} year={year} />;
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      {hasVehicles && (
        <Link href="/" className="text-sm text-muted transition hover:text-white">
          ← Back to garage
        </Link>
      )}
      <h1 className={`text-2xl font-semibold ${hasVehicles ? "mt-3" : ""}`}>
        {hasVehicles ? "Add another vehicle" : "Set up your garage"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Tell us about your car or bike. We&apos;ll build a 3D model that matches.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="pick" className="text-sm text-muted">Vehicle</label>
          <select
            id="pick"
            value={pick}
            onChange={onPick}
            required
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5"
          >
            <option value="" disabled>Choose your vehicle…</option>
            {VEHICLE_CATALOG.map((v) => (
              <option key={v.id} value={v.id}>{v.make} {v.model}</option>
            ))}
            <option value="motorcycle">Motorcycle</option>
            <option value="other">My vehicle isn&apos;t listed…</option>
          </select>
          {VEHICLE_CATALOG.some((c) => c.id === pick) && (
            <p className="mt-1 text-xs text-muted">
              Renders as a {bodyType === "suv" ? "SUV" : bodyType} in your 3D garage.
            </p>
          )}
        </div>

        {(pick === "motorcycle" || pick === "other") && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="make" className="text-sm text-muted">Make</label>
              <input
                id="make"
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                placeholder={pick === "motorcycle" ? "e.g. Harley-Davidson" : "e.g. Toyota"}
                value={make}
                onChange={(e) => { setMake(e.target.value); setRequestSent(false); }}
                required
              />
            </div>
            <div>
              <label htmlFor="model" className="text-sm text-muted">Model</label>
              <input
                id="model"
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
                placeholder={pick === "motorcycle" ? "e.g. Street Glide" : "e.g. Tacoma"}
                value={model}
                onChange={(e) => { setModel(e.target.value); setRequestSent(false); }}
                required
              />
            </div>
          </div>
        )}

        {pick === "other" && (
          <div className="rounded-md border border-border bg-surface/50 p-3">
            <p className="text-xs text-muted">
              You can still use RevLog with a generic model — pick the closest body
              type below. Want a 3D model of your actual vehicle? Request it and
              we&apos;ll prioritize the most-asked-for cars.
            </p>
            <button
              type="button"
              disabled={!make.trim() || !model.trim() || requestSent}
              onClick={requestModel}
              className="mt-2 rounded-md border border-accent px-3 py-1.5 text-sm text-accent transition disabled:opacity-40"
            >
              {requestSent ? "Request sent ✓" : "Request my make & model"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="year" className="text-sm text-muted">Year</label>
            {/* real select — the number+datalist combo was painful on mobile */}
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              required
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5"
            >
              {Array.from(
                { length: 60 },
                (_, i) => new Date().getFullYear() + 1 - i
              ).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mileage" className="text-sm text-muted">Current mileage</label>
            {/* text+numeric keyboard: starts empty and every digit deletes,
                unlike a number-typed controlled input that pins a 0 */}
            <input
              id="mileage"
              type="text"
              inputMode="numeric"
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
              placeholder="e.g. 42000"
              value={mileage}
              onChange={(e) => setMileage(e.target.value.replace(/[^0-9]/g, ""))}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ScanInput
            kind="vin"
            label="VIN (optional)"
            placeholder="Type or scan"
            value={vin}
            maxLength={17}
            onChange={setVin}
          />
          <ScanInput
            kind="plate"
            label="License plate (optional)"
            placeholder="Type or scan"
            value={plate}
            maxLength={10}
            onChange={setPlate}
          />
        </div>

        {pick === "other" && (
          <div>
            <label className="text-sm text-muted">Closest body type</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
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
        )}

        <div>
          <label className="text-sm text-muted">
            Color · <span className="text-white">{COLORS.find((c) => c.value === color)?.label ?? color}</span>
          </label>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c.value}
                title={c.label}
                aria-label={c.label}
                onClick={() => setColor(c.value)}
                className={`h-11 rounded-md border-2 transition ${
                  color === c.value ? "border-accent scale-105" : "border-border"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="customizations" className="text-sm text-muted">
            Customizations (optional)
          </label>
          <textarea
            id="customizations"
            rows={2}
            value={customizations}
            onChange={(e) => setCustomizations(e.target.value)}
            placeholder='Aftermarket stuff, plain language — e.g. "running 275/60R20s and a K&N filter"'
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/70"
          />
          <p className="mt-1 text-xs text-muted">
            We&apos;ll pull your vehicle&apos;s stock specs automatically — list
            anything that&apos;s not stock and we&apos;ll use yours instead.
          </p>
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-3 py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Setting up your garage…" : "Enter my garage"}
        </button>
        <p className="text-center text-xs text-muted">
          RevLog is free while in beta.
        </p>
      </form>
    </main>
  );
}
