import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { overLimit, recordApiEvent } from "@/lib/rate-limit";
import { decodeVin, decodeToSpecs } from "@/lib/vin";
import type { Vehicle, VehicleSpec } from "@/lib/types";

export const runtime = "nodejs";

// Vehicle "initialization": right after onboarding, pull best-known OEM/stock
// specs for the year/make/model (oil type, filters, tire size…) so the specs
// panel isn't empty on day one. Optional plain-language customizations
// ("I run 275/60R20s and a K&N filter") override stock values and are saved
// as user-source specs. Failure here never blocks onboarding — the client
// treats it as best-effort.

const Schema = z.object({
  vehicleId: z.string().uuid(),
  customizations: z.string().max(2000).optional(),
});

const SpecsSchema = z.object({
  specs: z.array(
    z.object({
      name: z.string().regex(/^[a-z0-9_]+$/),
      label: z.string(),
      value: z.string(),
      source: z.enum(["oem", "user"]),
    })
  ),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // One initialization per vehicle-add; a tight cap stops abuse.
  if (
    await overLimit(supabase, { table: "api_events", kind: "initialize", userId: user.id, seconds: 3600, max: 6 })
  ) {
    return NextResponse.json({ error: "Too many initializations — try later." }, { status: 429 });
  }
  await recordApiEvent(supabase, user.id, "initialize");

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", body.vehicleId)
    .eq("user_id", user.id)
    .single<Vehicle>();
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // VIN on file → decode trim + hardware facts (free NHTSA API) so the spec
  // pull is trim-correct instead of "most common trim". Best-effort.
  const decoded = vehicle.vin ? await decodeVin(vehicle.vin) : null;
  if (decoded?.trim && decoded.trim !== vehicle.trim) {
    await supabase.from("vehicles").update({ trim: decoded.trim }).eq("id", vehicle.id);
  }
  const decodedLine = decoded
    ? `\nDecoded from the VIN (authoritative for THIS exact vehicle): ${[
        decoded.trim && `trim "${decoded.trim}"`,
        decoded.engine && `engine ${decoded.engine}`,
        decoded.driveType && `drivetrain ${decoded.driveType}`,
        decoded.transmission && `transmission ${decoded.transmission}`,
        decoded.fuelType && `fuel ${decoded.fuelType}`,
      ]
        .filter(Boolean)
        .join(", ")}. Use these to pick trim-correct values.\n`
    : "";

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an automotive reference. For a ${vehicle.year} ${vehicle.make} ${vehicle.model}${decoded?.trim ? ` ${decoded.trim}` : vehicle.trim ? ` ${vehicle.trim}` : ""}, return the OEM/stock specs you are REASONABLY CONFIDENT about — omit anything you'd be guessing at. Trim-level-dependent values: ${decoded?.trim || vehicle.trim ? "use the stated trim's value" : "give the most common trim's value"}.
${decodedLine}

Candidate fields (snake_case name → label):
oil_type → "Oil type" (e.g. "0W-20 full synthetic")
oil_capacity → "Oil capacity" (e.g. "4.4 qt with filter")
oil_filter_part → "Oil filter" (a common part number, e.g. "AC Delco PF63E")
oil_drain_plug_size → "Oil drain plug" (socket size, e.g. "15mm")
engine_air_filter_part → "Engine air filter"
cabin_air_filter_part → "Cabin air filter"
tire_size → "Tire size" (e.g. "215/55R17")
tire_pressure → "Tire pressure" (e.g. "33 psi front / 32 rear")
battery_group → "Battery group"
wiper_size_driver → "Wiper (driver)"
wiper_size_passenger → "Wiper (passenger)"
fuel_type → "Fuel type"
coolant_type → "Coolant type"

${body.customizations?.trim() ? `The owner describes these aftermarket customizations — parse them and OVERRIDE the matching stock values (mark those with "source":"user"; invent a fitting snake_case name/label for mods with no candidate field):
"${body.customizations.trim()}"

` : ""}Return JSON: {"specs":[{"name":"...","label":"...","value":"...","source":"oem"${body.customizations?.trim() ? ' or "user" for customized values' : ""}}]}`,
      },
    ],
  });

  let parsed: z.infer<typeof SpecsSchema>;
  try {
    parsed = SpecsSchema.parse(JSON.parse(completion.choices[0].message.content || "{}"));
  } catch {
    parsed = { specs: [] };
  }

  // Add VIN-decoded hardware facts the model didn't already cover.
  const covered = new Set(parsed.specs.map((s) => s.name));
  for (const s of decoded ? decodeToSpecs(decoded) : []) {
    if (!covered.has(s.name)) parsed.specs.push({ ...s, source: "oem" });
  }

  // Never let a stock value overwrite a spec the user stated themselves.
  const { data: existing } = await supabase
    .from("vehicle_specs")
    .select("name,source")
    .eq("vehicle_id", vehicle.id)
    .returns<Pick<VehicleSpec, "name" | "source">[]>();
  const userOwned = new Set(
    (existing ?? []).filter((s) => s.source === "user").map((s) => s.name)
  );
  const rows = parsed.specs.filter((s) => s.source === "user" || !userOwned.has(s.name));

  if (rows.length) {
    const now = new Date().toISOString();
    await supabase.from("vehicle_specs").upsert(
      rows.map((s) => ({
        vehicle_id: vehicle.id,
        user_id: user.id,
        name: s.name,
        label: s.label,
        value: s.value,
        source: s.source,
        updated_at: now,
      })),
      { onConflict: "vehicle_id,name" }
    );
  }

  return NextResponse.json({ specs: rows.length, trim: decoded?.trim ?? vehicle.trim ?? null });
}
