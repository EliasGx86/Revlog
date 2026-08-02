import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { SERVICE_CATALOG, type Vehicle, type MaintenanceLog } from "@/lib/types";
import { buildReminderNote, completeMatchingAlerts } from "@/lib/reminders";
import { overLimit } from "@/lib/rate-limit";

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

// Fire-and-forget beta logging: every exchange lands in chat_messages so the
// admin view can show what users actually ask. Never fails the request.
async function logChat(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  vehicleId: string,
  message: string,
  intent: string,
  reply: string
) {
  try {
    await supabase.from("chat_messages").insert({
      user_id: userId,
      vehicle_id: vehicleId,
      message,
      intent,
      reply,
    });
  } catch {
    // logging must never break chat
  }
}

const RouterSchema = z.object({
  intent: z.enum(["log", "query", "insurance", "spec", "smalltalk"]),
});

const SpecSchema = z.object({
  specs: z.array(
    z.object({
      name: z.string().regex(/^[a-z0-9_]+$/),
      label: z.string(),
      value: z.string(),
    })
  ),
});

const InsuranceSchema = z.object({
  carrier: z.string().nullable(),
  policy_number: z.string().nullable(),
  monthly_premium: z.number().nullable(),
  coverage: z.string().nullable(),
  renewal_date: z.string().nullable(),
  notes: z.string().nullable(),
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

  // Rate limit BEFORE any OpenAI call — the logged exchanges are the counter.
  if (
    (await overLimit(supabase, { table: "chat_messages", userId: user.id, seconds: 60, max: 12 })) ||
    (await overLimit(supabase, { table: "chat_messages", userId: user.id, seconds: 86_400, max: 400 }))
  ) {
    return NextResponse.json(
      { error: "You're sending messages fast — give it a minute and try again." },
      { status: 429 }
    );
  }

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
- "query": they're asking a question about their maintenance history, insurance, or vehicle. Examples: "when did I last change my oil?", "what brand of oil did I use?", "what's my policy number?", "what oil does my car take?".
- "insurance": they're SHARING insurance details to store. Examples: "my insurance is Progressive, policy ABC-123", "I pay $142 a month with Geico", "insurance renews March 15th".
- "spec": they're SHARING a fact about the vehicle's hardware or specs (not an action they performed), or asking to save a fact from the conversation. Examples: "I use 0W-20 oil", "my drain plug is 14mm", "tire size is 265/65R17", "log it" / "save that" right after a spec was discussed.
- "smalltalk": anything else.

Return ONLY JSON like {"intent":"log"}.`,
      },
      ...body.history.slice(-2).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: body.message },
    ],
  });

  let intent: z.infer<typeof RouterSchema>["intent"] = "smalltalk";
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
    return await handleQuery(body.message, vehicle, supabase, body.history, user.id);
  }
  if (intent === "insurance") {
    return await handleInsurance(body.message, vehicle, supabase, user.id);
  }
  if (intent === "spec") {
    return await handleSpec(body.message, vehicle, supabase, body.history, user.id);
  }

  // smalltalk fallback
  const reply = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You are RevLog, a friendly assistant for car maintenance. Keep responses to one or two sentences. Encourage the user to log services or ask questions about their car (a ${vehicle.year} ${vehicle.make} ${vehicle.model}). If the message is unrelated to vehicles or maintenance, give ONE brief friendly sentence steering back to their car — never engage at length with off-topic requests.`,
      },
      ...body.history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: body.message },
    ],
  });
  const smalltalkReply = reply.choices[0].message.content || "👍";
  await logChat(supabase, user.id, vehicle.id, body.message, "smalltalk", smalltalkReply);
  return NextResponse.json({
    intent: "smalltalk",
    reply: smalltalkReply,
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

Clean up the input as you extract:
- Correct obvious typos or voice-transcription mangling of brand/shop names to
  the canonical spelling (e.g. "le scab"/"les shwab" → "Les Schwab",
  "mobile one" → "Mobil 1", "penzoil" → "Pennzoil", "discount tires" →
  "Discount Tire"). Only when confident — otherwise keep what they wrote.
- If the message is inconsistent (a service attached to a part it doesn't
  belong on, a mileage that reads like a typo), still pick the most sensible
  service_type and add a short flag to notes, e.g. "assumed tires (message
  said windshield)".

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

  // Keep the vehicle's odometer in sync when the message included a newer reading.
  if (extracted.mileage != null && extracted.mileage > vehicle.current_mileage) {
    await supabase
      .from("vehicles")
      .update({
        current_mileage: extracted.mileage,
        mileage_updated_at: new Date().toISOString(),
      })
      .eq("id", vehicle.id)
      .eq("user_id", userId);
  }

  // This service satisfies any older pending reminder for the same type.
  await completeMatchingAlerts(supabase, vehicle.id, userId, extracted.service_type);

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

  // Every entry doubles as a checkup: surface anything due or coming soon.
  const effectiveMileage = Math.max(extracted.mileage ?? 0, vehicle.current_mileage);
  const reminder = await buildReminderNote(supabase, vehicle.id, effectiveMileage);

  let logReply = askMileage
    ? `Logged: ${summary}. What's the current mileage?`
    : `Logged: ${summary}. ✓`;
  if (reminder) logReply += ` ${reminder}`;
  await logChat(supabase, userId, vehicle.id, message, "log", logReply);
  return NextResponse.json({
    intent: "log",
    logId: insertedLog.id,
    askMileage,
    reply: logReply,
  });
}

async function handleInsurance(
  message: string,
  vehicle: Vehicle,
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string
) {
  const openai = getOpenAI();
  const today = new Date().toISOString().slice(0, 10);

  const extraction = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Extract insurance details from the user's message about their ${vehicle.year} ${vehicle.make} ${vehicle.model}.
Today's date is ${today} (for relative dates like "next month").

Return JSON with these fields (null when not mentioned):
{
  "carrier": insurer name, e.g. "Progressive",
  "policy_number": string exactly as written,
  "monthly_premium": number in dollars (convert "yearly"/"every 6 months" to monthly),
  "coverage": short description like "full coverage" or "liability only",
  "renewal_date": "YYYY-MM-DD",
  "notes": anything else worth keeping, short
}`,
      },
      { role: "user", content: message },
    ],
  });

  let extracted: z.infer<typeof InsuranceSchema>;
  try {
    extracted = InsuranceSchema.parse(JSON.parse(extraction.choices[0].message.content || "{}"));
  } catch {
    return NextResponse.json({
      intent: "insurance",
      reply: "I couldn't quite parse that — try something like \"my insurance is Progressive, policy ABC-123, $140 a month\".",
    });
  }

  // Merge over the existing record so partial updates never wipe stored fields.
  const { data: existing } = await supabase
    .from("vehicle_insurance")
    .select("*")
    .eq("vehicle_id", vehicle.id)
    .maybeSingle();

  const merged = {
    vehicle_id: vehicle.id,
    user_id: userId,
    carrier: extracted.carrier ?? existing?.carrier ?? null,
    policy_number: extracted.policy_number ?? existing?.policy_number ?? null,
    monthly_premium: extracted.monthly_premium ?? existing?.monthly_premium ?? null,
    coverage: extracted.coverage ?? existing?.coverage ?? null,
    renewal_date: extracted.renewal_date ?? existing?.renewal_date ?? null,
    notes: extracted.notes ?? existing?.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error: upErr } = await supabase.from("vehicle_insurance").upsert(merged);
  if (upErr) {
    return NextResponse.json({ error: "Failed to save insurance info" }, { status: 500 });
  }

  const bits = [
    merged.carrier,
    merged.policy_number && `policy ${merged.policy_number}`,
    merged.monthly_premium != null && `$${merged.monthly_premium}/mo`,
    merged.renewal_date && `renews ${merged.renewal_date}`,
  ].filter(Boolean);
  const reply = `Saved your insurance info: ${bits.join(" · ") || "noted"}. It's in the vehicle info panel (tap your car's name up top).`;

  await logChat(supabase, userId, vehicle.id, message, "insurance", reply);
  return NextResponse.json({ intent: "insurance", reply });
}

async function handleSpec(
  message: string,
  vehicle: Vehicle,
  supabase: ReturnType<typeof createSupabaseServerClient>,
  history: { role: "user" | "assistant"; content: string }[],
  userId: string
) {
  const openai = getOpenAI();

  // History matters here: "log it" refers to a fact from the previous
  // exchange (often the assistant's own guidance answer).
  const extraction = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `The user is stating (or confirming) facts about their ${vehicle.year} ${vehicle.make} ${vehicle.model}'s hardware/specs. Extract them so they can be saved.

If the message is a confirmation like "log it" / "save that", pull the fact from the recent conversation (usually the assistant's last answer). Prefer the USER's stated value when it differs from the assistant's guidance.

Return JSON:
{
  "specs": [
    { "name": "snake_case_key", "label": "Display label", "value": "the fact" }
  ]
}

Use stable, canonical keys so repeats overwrite instead of duplicating:
oil_type, oil_capacity, oil_filter, oil_drain_plug_size, tire_size,
tire_pressure, battery_group, wiper_size_driver, wiper_size_passenger,
cabin_air_filter_part, engine_air_filter_part, coolant_type, fuel_type…
Invent a similar key if none fits. Empty array if there's no clear fact.`,
      },
      ...history.slice(-4).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ],
  });

  let extracted: z.infer<typeof SpecSchema>;
  try {
    extracted = SpecSchema.parse(JSON.parse(extraction.choices[0].message.content || "{}"));
  } catch {
    extracted = { specs: [] };
  }

  if (!extracted.specs.length) {
    const reply =
      "I couldn't pin down a spec to save — try something like \"my oil is 0W-20 full synthetic\" or \"drain plug is 14mm\".";
    await logChat(supabase, userId, vehicle.id, message, "spec", reply);
    return NextResponse.json({ intent: "spec", reply });
  }

  const rows = extracted.specs.map((s) => ({
    vehicle_id: vehicle.id,
    user_id: userId,
    name: s.name,
    label: s.label,
    value: s.value,
    source: "user" as const, // a user statement upgrades an OEM guess
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("vehicle_specs")
    .upsert(rows, { onConflict: "vehicle_id,name" });
  if (error) {
    return NextResponse.json({ error: "Failed to save spec" }, { status: 500 });
  }

  const summary = extracted.specs.map((s) => `${s.label}: ${s.value}`).join(" · ");
  const reply = `Saved to your ${vehicle.make}'s specs — ${summary}. Ask me anytime.`;
  await logChat(supabase, userId, vehicle.id, message, "spec", reply);
  return NextResponse.json({ intent: "spec", reply });
}

async function handleQuery(
  message: string,
  vehicle: Vehicle,
  supabase: ReturnType<typeof createSupabaseServerClient>,
  history: { role: "user" | "assistant"; content: string }[],
  userId: string
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

  // Insurance record (if any) so questions like "what's my policy number" work.
  const { data: insurance } = await supabase
    .from("vehicle_insurance")
    .select("carrier, policy_number, monthly_premium, coverage, renewal_date, notes")
    .eq("vehicle_id", vehicle.id)
    .maybeSingle();

  // Saved specs (oil type, drain plug size…). source 'user' = confirmed by
  // the owner; 'oem' = stock value pulled automatically at initialization.
  const { data: specs } = await supabase
    .from("vehicle_specs")
    .select("label, value, source")
    .eq("vehicle_id", vehicle.id);

  const reply = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `You are RevLog, the user's car maintenance assistant.
Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}, currently ${vehicle.current_mileage.toLocaleString()} mi.
Today's date is ${new Date().toISOString().slice(0, 10)}.

Answer questions about their history using ONLY the data below — never invent dates, mileages, product details, or policy info; if it isn't there, say so plainly.

Saved specs with source "user" are the owner's confirmed facts — answer from them with certainty, no hedging. Specs with source "oem" are stock values loaded automatically — answer from them but note they're the factory spec (e.g. "your stock spec is…"); the user can correct them anytime.

For general questions NOT covered by saved data (what oil it takes, tire size, typical service timing), you MAY answer from general automotive knowledge — clearly framed as guidance, e.g. "A ${vehicle.year} ${vehicle.make} ${vehicle.model} typically takes 0W-20 full synthetic — check the oil cap or manual to confirm." Then add that they can reply "log it" to save it to their specs.

Be brief — one to three sentences.

Saved specs (confirmed facts about this vehicle):
${JSON.stringify(specs?.length ? specs : "none")}

Maintenance history (most recent first):
${JSON.stringify(ctx, null, 2)}

Insurance on file:
${JSON.stringify(insurance ?? "none")}`,
      },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ],
  });

  const queryReply = reply.choices[0].message.content || "I'm not sure — check your history.";
  await logChat(supabase, userId, vehicle.id, message, "query", queryReply);
  return NextResponse.json({
    intent: "query",
    reply: queryReply,
  });
}
