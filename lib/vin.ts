// VIN decoding via the NHTSA vPIC API — free US-government service, no key.
// Returns the trim/submodel (LX, EX-L…) that parts stores ask for, plus a few
// hardware facts worth seeding as stock specs. Coverage varies by
// manufacturer (some report Series instead of Trim, some report neither), so
// every field is optional and callers must treat a null result as normal.

export interface VinDecode {
  trim: string | null;
  /** e.g. "3.5L V6 (280 hp)" */
  engine: string | null;
  /** e.g. "4x2" / "AWD" */
  driveType: string | null;
  /** e.g. "6-speed automatic" */
  transmission: string | null;
  fuelType: string | null;
  /** Decoded year/make/model, for sanity-checking against the user's entry. */
  modelYear: string | null;
  make: string | null;
  model: string | null;
}

const VPIC_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

function clean(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s !== "Not Applicable" ? s : null;
}

/** Title-case vPIC's SHOUTED values ("HONDA" → "Honda"). */
function titleCase(v: string | null): string | null {
  if (!v) return null;
  return v.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export async function decodeVin(vin: string): Promise<VinDecode | null> {
  try {
    const res = await fetch(`${VPIC_URL}/${encodeURIComponent(vin)}?format=json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { Results?: Record<string, string>[] };
    const r = data.Results?.[0];
    if (!r || (r.ErrorCode && !/^0\b/.test(r.ErrorCode))) return null;

    // Manufacturers populate Trim, Series, or both — prefer Trim.
    const trim = clean(r.Trim) ?? clean(r.Series);

    const liters = clean(r.DisplacementL);
    const cylinders = clean(r.EngineCylinders);
    const hp = clean(r.EngineHP);
    const config = clean(r.EngineConfiguration);
    let engine: string | null = null;
    if (liters) {
      const cyl =
        cylinders && config === "V-Shaped" ? `V${cylinders}`
        : cylinders ? `I${cylinders}`
        : null;
      engine = `${parseFloat(liters).toFixed(1)}L${cyl ? ` ${cyl}` : ""}${hp ? ` (${hp} hp)` : ""}`;
    }

    const speeds = clean(r.TransmissionSpeeds);
    const style = clean(r.TransmissionStyle);
    const transmission = style
      ? `${speeds ? `${speeds}-speed ` : ""}${style.toLowerCase()}`
      : null;

    return {
      trim,
      engine,
      driveType: clean(r.DriveType),
      transmission,
      fuelType: clean(r.FuelTypePrimary),
      modelYear: clean(r.ModelYear),
      make: titleCase(clean(r.Make)),
      model: clean(r.Model),
    };
  } catch {
    return null; // network/timeout — VIN decode is always best-effort
  }
}

/** The decoded facts worth seeding as stock specs (skips empty fields). */
export function decodeToSpecs(d: VinDecode): { name: string; label: string; value: string }[] {
  const specs: { name: string; label: string; value: string }[] = [];
  if (d.engine) specs.push({ name: "engine", label: "Engine", value: d.engine });
  if (d.driveType) specs.push({ name: "drive_type", label: "Drivetrain", value: d.driveType });
  if (d.transmission) specs.push({ name: "transmission", label: "Transmission", value: d.transmission });
  if (d.fuelType) specs.push({ name: "fuel_type", label: "Fuel type", value: d.fuelType });
  return specs;
}
