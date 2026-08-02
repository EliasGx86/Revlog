import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { overLimit, recordApiEvent } from "@/lib/rate-limit";
import type { Vehicle } from "@/lib/types";

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

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an automotive reference. For a ${vehicle.year} ${vehicle.make} ${vehicle.model}, return the OEM/stock specs you are REASONABLY CONFIDENT about — omit anything you'd be guessing at. Trim-level-dependent values: give the most common trim's value.

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
    return NextResponse.json({ specs: 0 });
  }

  if (parsed.specs.length) {
    const now = new Date().toISOString();
    await supabase.from("vehicle_specs").upsert(
      parsed.specs.map((s) => ({
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

  return NextResponse.json({ specs: parsed.specs.length });
}
