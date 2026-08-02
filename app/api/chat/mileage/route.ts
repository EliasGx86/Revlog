import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildReminderNote } from "@/lib/reminders";

const Schema = z.object({
  logId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  mileage: z.number().int().min(0),
});

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Update the log's mileage.
  const { error: logErr } = await supabase
    .from("maintenance_logs")
    .update({ mileage: body.mileage })
    .eq("id", body.logId)
    .eq("user_id", user.id);
  if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

  // If this is newer than the vehicle's current mileage, update that too.
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("current_mileage")
    .eq("id", body.vehicleId)
    .eq("user_id", user.id)
    .single();
  if (vehicle && body.mileage > vehicle.current_mileage) {
    await supabase
      .from("vehicles")
      .update({ current_mileage: body.mileage, mileage_updated_at: new Date().toISOString() })
      .eq("id", body.vehicleId)
      .eq("user_id", user.id);
  }

  // A fresh odometer reading is the best moment to check what's now due.
  const effectiveMileage = Math.max(body.mileage, vehicle?.current_mileage ?? 0);
  const reminder = await buildReminderNote(supabase, body.vehicleId, effectiveMileage);

  return NextResponse.json({ ok: true, reminder });
}
