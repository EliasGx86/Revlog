import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";

const Schema = z.object({
  // JPEG data URL produced client-side (downscaled before upload)
  image: z.string().startsWith("data:image/").max(6_000_000),
  kind: z.enum(["vin", "plate"]),
});

const PROMPTS: Record<"vin" | "plate", string> = {
  vin: `Extract the VIN (Vehicle Identification Number) from this photo. A VIN is exactly 17 characters of capital letters and digits and never contains I, O, or Q. It may appear on a dashboard plate, door-jamb sticker, title, or registration document. Reply with ONLY the VIN, or NONE if no VIN is legible.`,
  plate: `Extract the license plate number from this photo of a vehicle's plate. Reply with ONLY the plate characters (letters, digits, and spaces or dashes as printed), or NONE if no plate is legible.`,
};

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

  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    max_tokens: 40,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPTS[body.kind] },
          { type: "image_url", image_url: { url: body.image, detail: "high" } },
        ],
      },
    ],
  });

  const raw = (res.choices[0]?.message?.content ?? "").trim().toUpperCase();
  if (!raw || raw === "NONE") {
    return NextResponse.json({ value: null });
  }

  let value = raw.replace(/[^A-Z0-9 -]/g, "").trim();
  if (body.kind === "vin") {
    value = value.replace(/[^A-Z0-9]/g, "");
    // VINs are 17 chars and exclude I/O/Q — reject anything that doesn't fit.
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(value)) {
      return NextResponse.json({ value: null });
    }
  } else if (value.length < 2 || value.length > 10) {
    return NextResponse.json({ value: null });
  }

  return NextResponse.json({ value });
}
