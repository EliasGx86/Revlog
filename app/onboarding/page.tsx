"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BodyType } from "@/lib/types";

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

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [color, setColor] = useState(COLORS[4].value); // Red
  const [bodyType, setBodyType] = useState<BodyType>("sedan");
  const [mileage, setMileage] = useState<number>(0);
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
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
        vin: vin.trim().toUpperCase() || null,
        license_plate: plate.trim().toUpperCase() || null,
      });
      if (vErr) throw vErr;

      // BETA: free for everyone — no checkout. Mark onboarding complete and go.
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ onboarded: true })
        .eq("id", user.id);
      if (pErr) throw pErr;

      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Set up your garage</h1>
      <p className="mt-1 text-sm text-muted">
        Tell us about your car or bike. We&apos;ll build a 3D model that matches.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="make" className="text-sm text-muted">Make</label>
            <input
              id="make"
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
              placeholder="e.g. Toyota"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="model" className="text-sm text-muted">Model</label>
            <input
              id="model"
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
              placeholder="e.g. Tacoma"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="year" className="text-sm text-muted">Year</label>
            <input
              id="year"
              type="number"
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
              placeholder="e.g. 2019"
              value={year}
              min={1900}
              max={2100}
              onChange={(e) => setYear(parseInt(e.target.value || "0", 10))}
              required
            />
          </div>
          <div>
            <label htmlFor="mileage" className="text-sm text-muted">Current mileage</label>
            <input
              id="mileage"
              type="number"
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2"
              placeholder="e.g. 42000"
              value={mileage}
              min={0}
              onChange={(e) => setMileage(parseInt(e.target.value || "0", 10))}
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

        <div>
          <label className="text-sm text-muted">Body type</label>
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
