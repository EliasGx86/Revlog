import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Stripe needs the raw body to verify the signature.
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const stripe = getStripe();
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ error: `Webhook error: ${msg}` }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        if (userId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await supabase
            .from("profiles")
            .update({
              subscription_status: sub.status,
              subscription_plan: (sub.metadata?.plan as "monthly" | "yearly") || null,
              subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
              onboarded: true,
            })
            .eq("id", userId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (userId) {
          await supabase
            .from("profiles")
            .update({
              subscription_status: sub.status,
              subscription_plan: (sub.metadata?.plan as "monthly" | "yearly") || null,
              subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            })
            .eq("id", userId);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "handler error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
