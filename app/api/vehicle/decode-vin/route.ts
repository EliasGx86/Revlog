import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decodeVin, decodeToSpecs } from "@/lib/vin";
import { overLimit, recordApiEvent } from "@/lib/rate-limit";
import type { Vehicle, VehicleSpec } from "@/lib/types";

export const runtime = "nodejs";

// Lightweight VIN decode (no LLM): pulls trim/submodel + a few hardware facts
// from the free NHTSA vPIC API. Used to backfill vehicles that already have
// specs (so full re-initialization isn't needed) and after a VIN is added or
// edited in the garage.

const Schema = z.object({ vehicleId: z.string().uuid() });

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

  if (
    await overLimit(supabase, { table: "api_events", kind: "decode_vin", userId: user.id, seconds: 3600, max: 12 })
  ) {
    return NextResponse.json({ error: "Too many decodes — try later." }, { status: 429 });
  }
  await recordApiEvent(supabase, user.id, "decode_vin");

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", body.vehicleId)
    .eq("user_id", user.id)
    .single<Vehicle>();
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  if (!vehicle.vin) return NextResponse.json({ trim: null });

  const decoded = await decodeVin(vehicle.vin);
  if (!decoded) return NextResponse.json({ trim: null });

  if (decoded.trim && decoded.trim !== vehicle.trim) {
    await supabase
      .from("vehicles")
      .update({ trim: decoded.trim })
      .eq("id", vehicle.id);
  }

  // Seed decoded hardware facts as stock specs — but never overwrite a value
  // the user stated or confirmed themselves.
  const specs = decodeToSpecs(decoded);
  if (specs.length) {
    const { data: existing } = await supabase
      .from("vehicle_specs")
      .select("name,source")
      .eq("vehicle_id", vehicle.id)
      .returns<Pick<VehicleSpec, "name" | "source">[]>();
    const userOwned = new Set(
      (existing ?? []).filter((s) => s.source === "user").map((s) => s.name)
    );
    const rows = specs.filter((s) => !userOwned.has(s.name));
    if (rows.length) {
      const now = new Date().toISOString();
      await supabase.from("vehicle_specs").upsert(
        rows.map((s) => ({
          vehicle_id: vehicle.id,
          user_id: user.id,
          name: s.name,
          label: s.label,
          value: s.value,
          source: "oem" as const,
          updated_at: now,
        })),
        { onConflict: "vehicle_id,name" }
      );
    }
  }

  return NextResponse.json({ trim: decoded.trim });
}
