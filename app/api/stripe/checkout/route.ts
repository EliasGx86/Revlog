import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStripe, priceIdForPlan } from "@/lib/stripe";

const Schema = z.object({ plan: z.enum(["monthly", "yearly"]) });

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const stripe = getStripe();

  // Reuse Stripe customer if we have one.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdForPlan(body.plan), quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?checkout=cancelled`,
    metadata: { supabase_user_id: user.id, plan: body.plan },
    subscription_data: {
      metadata: { supabase_user_id: user.id, plan: body.plan },
    },
  });

  return NextResponse.json({ url: session.url });
}
