import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { SERVICE_CATALOG, type Vehicle, type MaintenanceLog } from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  vehicleId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional()
    .default([]),
});

const SERVICE_TYPES = Object.keys(SERVICE_CATALOG);

const RouterSchema = z.object({
  intent: z.enum(["log", "query", "smalltalk"]),
});

const LogSchema = z.object({
  service_type: z.enum(SERVICE_TYPES as [string, ...string[]]),
  service_date: z.string().describe("ISO date YYYY-MM-DD; today if not stated"),
  mileage: z.number().int().nullable(),
  product_brand: z.string().nullable(),
  product_name: z.string().nullable(),
  product_details: z.record(z.string()).nullable(),
  notes: z.string().nullable(),
});

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const openai = getOpenAI();

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Verify the vehicle belongs to this user (RLS would catch it too,
  // but we want a clean error path).
  const { data: vehicle, error: vErr } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", body.vehicleId)
    .eq("user_id", user.id)
    .single<Vehicle>();
  if (vErr || !vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // Step 1: classify intent.
  const router = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You classify a user's message about their car as one of:
- "log": they're telling us they performed a maintenance service (past or completed action). Examples: "changed my oil yesterday", "just put new tires on", "got the brakes done at 50k".
- "query": they're asking a question about their maintenance history or vehicle. Examples: "when did I last change my oil?", "what brand of oil did I use?", "is my oil change due?".
- "smalltalk": anything else.

Return ONLY JSON like {"intent":"log"}.`,
      },
      { role: "user", content: body.message },
    ],
  });

  let intent: "log" | "query" | "smalltalk" = "smalltalk";
  try {
    const parsed = RouterSchema.parse(JSON.parse(router.choices[0].message.content || "{}"));
    intent = parsed.intent;
  } catch {
    intent = "smalltalk";
  }

  if (intent === "log") {
    return await handleLog(body.message, vehicle, supabase, user.id);
  }
  if (intent === "query") {
    return await handleQuery(body.message, vehicle, supabase, body.history);
  }

  // smalltalk fallback
  const reply = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You are RevLog, a friendly assistant for car maintenance. Keep responses to one or two sentences. Encourage the user to log services or ask questions about their car (a ${vehicle.year} ${vehicle.make} ${vehicle.model}).`,
      },
      ...body.history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: body.message },
    ],
  });
  return NextResponse.json({
    intent: "smalltalk",
    reply: reply.choices[0].message.content || "👍",
  });
}

async function handleLog(
  message: string,
  vehicle: Vehicle,
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string
) {
  const openai = getOpenAI();
  const today = new Date().toISOString().slice(0, 10);
  const types = SERVICE_TYPES.join(", ");

  const extraction = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Extract structured data from a maintenance message.
Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}.
Today's date is ${today}. Use this for "today", "just", "yesterday" etc.

Allowed service_type values (pick the best match, never invent new ones):
${types}

Return JSON with these fields (use null when unknown):
{
  "service_type": one of the allowed values,
  "service_date": YYYY-MM-DD,
  "mileage": integer or null,
  "product_brand": string or null,
  "product_name": string or null,
  "product_details": object of small string fields (e.g. {"viscosity":"5W-30","type":"full synthetic"}) or null,
  "notes": short string or null
}`,
      },
      { role: "user", content: message },
    ],
  });

  let extracted: z.infer<typeof LogSchema>;
  try {
    extracted = LogSchema.parse(JSON.parse(extraction.choices[0].message.content || "{}"));
  } catch (e) {
    return NextResponse.json({
      intent: "log",
      reply: "I couldn't quite parse that — can you rephrase what you serviced?",
    });
  }

  const catalogEntry = SERVICE_CATALOG[extracted.service_type as keyof typeof SERVICE_CATALOG];

  const { data: insertedLog, error: insertErr } = await supabase
    .from("maintenance_logs")
    .insert({
      vehicle_id: vehicle.id,
      user_id: userId,
      service_type: extracted.service_type,
      zone: catalogEntry?.zone ?? "other",
      service_date: extracted.service_date || today,
      mileage: extracted.mileage,
      product_brand: extracted.product_brand,
      product_name: extracted.product_name,
      product_details: extracted.product_details ?? {},
      notes: extracted.notes,
      raw_input: message,
    })
    .select()
    .single<MaintenanceLog>();

  if (insertErr || !insertedLog) {
    return NextResponse.json({ error: "Failed to save log" }, { status: 500 });
  }

  // If no mileage was provided, we'll prompt the user for it inline.
  const askMileage = extracted.mileage == null;

  // Generate next-due alert if we have a mileage interval and current mileage.
  if (catalogEntry?.mileageInterval && (extracted.mileage ?? vehicle.current_mileage) > 0) {
    const baseMileage = extracted.mileage ?? vehicle.current_mileage;
    const dueMileage = baseMileage + catalogEntry.mileageInterval;
    let dueDate: string | null = null;
    if (catalogEntry.monthInterval) {
      const d = new Date(extracted.service_date || today);
      d.setMonth(d.getMonth() + catalogEntry.monthInterval);
      dueDate = d.toISOString().slice(0, 10);
    }
    await supabase.from("alerts").insert({
      vehicle_id: vehicle.id,
      user_id: userId,
      service_type: extracted.service_type,
      due_date: dueDate,
      due_mileage: dueMileage,
      triggered_by_log_id: insertedLog.id,
    });
  }

  const summary = [
    catalogEntry?.label ?? extracted.service_type,
    extracted.product_brand && `· ${extracted.product_brand}${extracted.product_name ? " " + extracted.product_name : ""}`,
    extracted.mileage != null && `· ${extracted.mileage.toLocaleString()} mi`,
  ]
    .filter(Boolean)
    .join(" ");

  return NextResponse.json({
    intent: "log",
    logId: insertedLog.id,
    askMileage,
    reply: askMileage
      ? `Logged: ${summary}. What's the current mileage?`
      : `Logged: ${summary}. ✓`,
  });
}

async function handleQuery(
  message: string,
  vehicle: Vehicle,
  supabase: ReturnType<typeof createSupabaseServerClient>,
  history: { role: "user" | "assistant"; content: string }[]
) {
  const openai = getOpenAI();
  // Pull the most recent 50 logs for context. Cheap and well within mini's context window.
  const { data: logs } = await supabase
    .from("maintenance_logs")
    .select("service_type, service_date, mileage, product_brand, product_name, product_details, notes")
    .eq("vehicle_id", vehicle.id)
    .order("service_date", { ascending: false })
    .limit(50);

  const ctx = (logs || []).map((l) => ({
    service: SERVICE_CATALOG[l.service_type]?.label || l.service_type,
    date: l.service_date,
    mileage: l.mileage,
    brand: l.product_brand,
    product: l.product_name,
    details: l.product_details,
    notes: l.notes,
  }));

  const reply = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are RevLog, the user's car maintenance assistant.
Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}, currently ${vehicle.current_mileage.toLocaleString()} mi.
Today's date is ${new Date().toISOString().slice(0, 10)}.

Answer the user's question using ONLY the maintenance history below. If the answer isn't in the history, say so plainly. Be brief — one to three sentences. Don't invent dates, mileages, or product details.

Maintenance history (most recent first):
${JSON.stringify(ctx, null, 2)}`,
      },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ],
  });

  return NextResponse.json({
    intent: "query",
    reply: reply.choices[0].message.content || "I'm not sure — check your history.",
  });
}
